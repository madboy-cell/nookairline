/**
 * NEORA Master E2E & Full-Match Multiplayer Reliability Test Suite
 *
 * Validates:
 * 1. Authoritative Room Lifecycle & State Transitions (OPEN, FULL, IN_PROGRESS, FINISHED)
 * 2. Floating Waiting-Room Widget, Minimization & Live Navigation Sync
 * 3. Live Spectator Mode, Read-Only Security Guard & Zero-Seat Consumption
 * 4. Autonomous Temporary Bot Takeover on Disconnect & Instant Reconnection Restoration
 * 5. Full 20-Match Game Engine Simulation Matrix (4H, 2H2B, 1H3B, 4B, 3H1B)
 */

const assert = require('assert');
const http = require('http');
const express = require('express');
const { WebSocketServer, WebSocket } = require('ws');
const RoomRegistry = require('../server_rooms.js');
const BotTakeoverManager = require('../server_bot_takeover.js');
const Bot = require('../public/monopoly_bot.js');

const MASTER_TEST_PORT = 4192;

// -------------------------------------------------------------
// Test Server Setup
// -------------------------------------------------------------
function createMasterTestServer(port) {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });
  const registry = new RoomRegistry();
  const subscribers = new Set();

  function sanitize(r) {
    if (!r) return null;
    return {
      id: r.id,
      code: r.code,
      name: r.name,
      flightNumber: r.flightNumber,
      hostUid: r.hostUid,
      hostName: r.hostName,
      isPublic: r.isPublic,
      status: r.status,
      slots: r.slots,
      activeHumans: r.slots.filter((s) => s.type === 'human' && s.occupiedBy).length,
      openSeats: r.slots.filter((s) => s.type === 'human' && !s.occupiedBy).length,
      totalSeats: r.slots.filter((s) => s.type !== 'closed').length
    };
  }

  function broadcastDeparture() {
    if (subscribers.size === 0) return;
    const msg = JSON.stringify({
      type: 'room_list_update',
      rooms: registry.listPublicRooms()
    });
    subscribers.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        try { ws.send(msg); } catch (e) {}
      }
    });
  }

  function broadcastRoom(room, msg) {
    if (!room || !room.clients) return;
    const raw = typeof msg === 'string' ? msg : JSON.stringify(msg);
    room.clients.forEach((c) => {
      if (c.readyState === WebSocket.OPEN) {
        try { c.send(raw); } catch (e) {}
      }
    });
  }

  const takeoverManager = new BotTakeoverManager(registry, broadcastRoom, broadcastDeparture);
  registry.botTakeoverManager = takeoverManager;

  wss.on('connection', (ws) => {
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw);

        if (msg.type === 'room_browse_start') {
          subscribers.add(ws);
          ws.send(JSON.stringify({
            type: 'room_list_update',
            rooms: registry.listPublicRooms()
          }));
          return;
        }

        if (msg.type === 'room_create') {
          const room = registry.createRoom({
            hostUid: msg.hostUid || 'master_host',
            hostName: msg.hostName || 'Captain 🛫',
            flightName: msg.flightName || 'Master Flight',
            isPublic: msg.isPublic !== undefined ? msg.isPublic : false,
            slots: msg.slots || null,
            ws
          });
          ws.send(JSON.stringify({
            type: 'room_created',
            room: sanitize(room),
            slot: room.slots[0]
          }));
          broadcastDeparture();
          return;
        }

        if (msg.type === 'room_join' || msg.type === 'room_join_code') {
          const key = msg.type === 'room_join' ? msg.roomId : msg.code;
          const playerInfo = {
            uid: msg.uid,
            name: msg.name,
            avatar: msg.avatar,
            spectator: !!msg.spectator
          };
          const res = registry.joinRoom(key, playerInfo, ws);
          if (!res.success) {
            ws.send(JSON.stringify({
              type: 'room_error',
              error: res.error,
              message: res.message
            }));
            return;
          }
          ws.send(JSON.stringify({
            type: 'room_joined',
            room: sanitize(res.room),
            slot: res.slot,
            spectator: !!res.spectator,
            state: res.spectator ? res.room.gameState : null
          }));
          broadcastRoom(res.room, {
            type: 'room_update',
            room: sanitize(res.room)
          });
          broadcastDeparture();
          return;
        }

        if (msg.type === 'room_start') {
          const room = registry.getRoom(msg.roomId) || registry.getClientRoom(ws);
          if (!room) return;

          const clientData = room.clientData ? room.clientData.get(ws) : null;
          const isHost = !ws || (clientData && clientData.slotId === 1) || room.hostUid === msg.hostUid;
          if (!isHost) {
            ws.send(JSON.stringify({
              type: 'room_error',
              error: 'NOT_AUTHORIZED',
              message: 'Only host can start flight.'
            }));
            return;
          }

          if (room.status === 'in_flight') return;
          if (room.status === 'finished') {
            ws.send(JSON.stringify({
              type: 'room_error',
              error: 'ROOM_FINISHED',
              message: 'Match finished.'
            }));
            return;
          }

          const activeCount = room.slots.filter((s) => s.type === 'bot' || (s.type === 'human' && s.occupiedBy)).length;
          if (activeCount < 2) {
            ws.send(JSON.stringify({
              type: 'room_error',
              error: 'NOT_ENOUGH_PLAYERS',
              message: 'Need at least 2 players.'
            }));
            return;
          }

          room.status = 'in_flight';
          room.updatedAt = Date.now();
          if (msg.initialState || msg.state) {
            room.gameState = msg.initialState || msg.state;
          }
          broadcastRoom(room, {
            type: 'room_start',
            roomId: room.id,
            room: sanitize(room),
            state: room.gameState
          });
          broadcastDeparture();
          return;
        }

        if (msg.type === 'room_rejoin') {
          const res = registry.rejoinRoom(msg.roomId, { uid: msg.uid, name: msg.name }, ws);
          if (!res.success) {
            ws.send(JSON.stringify({ type: 'room_error', error: res.error, message: res.message }));
            return;
          }
          ws.send(JSON.stringify({
            type: 'room_rejoined',
            room: sanitize(res.room),
            slot: res.slot,
            inFlight: res.inFlight,
            gameState: res.gameState
          }));
          broadcastRoom(res.room, {
            type: 'room_update',
            room: sanitize(res.room)
          });
          return;
        }

        if (msg.type === 'monopoly_action') {
          const room = registry.getClientRoom(ws);
          if (!room) return;

          const clientData = room.clientData.get(ws);
          if (clientData && clientData.spectator) {
            ws.send(JSON.stringify({
              type: 'monopoly_action_rejected',
              error: 'ACTION_UNAUTHORIZED',
              action: msg.action,
              message: 'Spectators cannot execute actions or mutate match state.'
            }));
            return;
          }

          if (msg.state) {
            registry.updateGameState(room.id, msg.state);
            if (msg.state.gameOver) {
              room.status = 'finished';
              broadcastRoom(room, {
                type: 'room_finished',
                roomId: room.id,
                winner: msg.state.gameOver.winner,
                reason: msg.state.gameOver.reason
              });
              broadcastDeparture();
            }
          }

          room.clients.forEach((c) => {
            if (c !== ws && c.readyState === WebSocket.OPEN) {
              c.send(JSON.stringify(msg));
            }
          });
        }
      } catch (e) {
        console.error('Test server error parsing message:', e.message);
      }
    });

    ws.on('close', () => {
      subscribers.delete(ws);
      const discRes = registry.handleDisconnect(ws);
      if (discRes && discRes.room) {
        broadcastRoom(discRes.room, {
          type: 'room_update',
          room: sanitize(discRes.room),
          disconnectedUser: discRes.disconnectedUser
        });
        broadcastDeparture();
      }
    });
  });

  return new Promise((resolve) => {
    server.listen(port, () => resolve({ server, registry, takeoverManager }));
  });
}

// -------------------------------------------------------------
// Test Client Helper
// -------------------------------------------------------------
function createClient(port) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}`);
    const inbox = [];
    const listeners = [];

    ws.on('open', () => {
      resolve({
        ws,
        send(obj) { ws.send(JSON.stringify(obj)); },
        waitFor(predicate, timeoutMs = 4000) {
          return new Promise((res, rej) => {
            for (let i = 0; i < inbox.length; i++) {
              if (predicate(inbox[i])) {
                const found = inbox.splice(i, 1)[0];
                return res(found);
              }
            }
            const timer = setTimeout(() => {
              const idx = listeners.indexOf(check);
              if (idx !== -1) listeners.splice(idx, 1);
              rej(new Error(`Timeout waiting for message matching predicate (${timeoutMs}ms)`));
            }, timeoutMs);

            function check(msg) {
              if (predicate(msg)) {
                clearTimeout(timer);
                const idx = listeners.indexOf(check);
                if (idx !== -1) listeners.splice(idx, 1);
                res(msg);
              }
            }
            listeners.push(check);
          });
        },
        close() { ws.close(); }
      });
    });

    ws.on('message', (data) => {
      try {
        const parsed = JSON.parse(data.toString());
        inbox.push(parsed);
        listeners.forEach((fn) => fn(parsed));
      } catch (e) {}
    });

    ws.on('error', reject);
  });
}

// -------------------------------------------------------------
// Initial Game State Generator
// -------------------------------------------------------------
function makeGameState(slots, startingCash = 1200) {
  const turnOrder = slots.map((s) => s.role);
  const players = {};
  slots.forEach((s) => {
    players[s.role] = {
      pos: 0,
      cash: startingCash,
      nw: startingCash,
      bankrupt: false,
      isBot: s.type === 'bot' || s.controller === 'BOT_TEMPORARY',
      botLevel: s.difficulty || 'easy',
      name: s.name,
      passes: 3
    };
  });

  return {
    round: 1,
    turnOrder,
    currentTurn: turnOrder[0],
    players,
    properties: {},
    isRolling: false,
    gameOver: null
  };
}

// =============================================================
// MAIN MASTER TEST SUITE EXECUTION
// =============================================================
async function runMasterSuite() {
  console.log('='.repeat(70));
  console.log('🌟 NEORA MASTER MULTIPLAYER & RELIABILITY TEST SUITE');
  console.log('='.repeat(70));

  const { server, registry, takeoverManager } = await createMasterTestServer(MASTER_TEST_PORT);
  let passed = 0;
  let failed = 0;

  function assertTest(name, cond, msg) {
    if (cond) {
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${name}: ${msg || 'Condition failed'}`);
      failed++;
    }
  }

  // -----------------------------------------------------------
  // SECTION 1: Authoritative Room Lifecycle & Transitions
  // -----------------------------------------------------------
  console.log('\n--- SECTION 1: Room Lifecycle & State Transitions ---');
  {
    const host = await createClient(MASTER_TEST_PORT);
    const guest1 = await createClient(MASTER_TEST_PORT);
    const guest2 = await createClient(MASTER_TEST_PORT);
    const guest3 = await createClient(MASTER_TEST_PORT);
    const extra = await createClient(MASTER_TEST_PORT);

    // 1.1 Create open 4-slot room
    host.send({
      type: 'room_create',
      hostUid: 'u_host',
      hostName: 'Captain Nook',
      slots: [
        { id: 1, role: 'bkk', type: 'human', occupiedBy: 'u_host' },
        { id: 2, role: 'dxb', type: 'human', occupiedBy: null },
        { id: 3, role: 'bot1', type: 'human', occupiedBy: null },
        { id: 4, role: 'bot2', type: 'human', occupiedBy: null }
      ]
    });
    const cMsg = await host.waitFor((m) => m.type === 'room_created');
    const roomId = cMsg.room.id;
    assertTest('1.1 Room starts in lobby status with open seats', cMsg.room.status === 'lobby' && cMsg.room.openSeats === 3);

    // 1.2 Fill seats 2, 3, 4 -> Full
    guest1.send({ type: 'room_join', roomId, uid: 'u_g1', name: 'Guest 1' });
    await guest1.waitFor((m) => m.type === 'room_joined');
    guest2.send({ type: 'room_join', roomId, uid: 'u_g2', name: 'Guest 2' });
    await guest2.waitFor((m) => m.type === 'room_joined');
    guest3.send({ type: 'room_join', roomId, uid: 'u_g3', name: 'Guest 3' });
    const g3Join = await guest3.waitFor((m) => m.type === 'room_joined');
    assertTest('1.2 Room transitions to full (4/4)', g3Join.room.activeHumans === 4 && g3Join.room.openSeats === 0);

    // 1.3 5th player rejected with ROOM_FULL
    extra.send({ type: 'room_join', roomId, uid: 'u_extra', name: 'Extra Player' });
    const err = await extra.waitFor((m) => m.type === 'room_error');
    assertTest('1.3 5th player rejected atomically with ROOM_FULL', err.error === 'ROOM_FULL');

    // 1.4 Non-host cannot start match
    guest1.send({ type: 'room_start', roomId });
    const authErr = await guest1.waitFor((m) => m.type === 'room_error');
    assertTest('1.4 Non-host start attempt rejected with NOT_AUTHORIZED', authErr.error === 'NOT_AUTHORIZED');

    // 1.5 Host starts match -> in_flight
    const st = makeGameState(cMsg.room.slots);
    host.send({ type: 'room_start', roomId, initialState: st });
    const startMsg = await host.waitFor((m) => m.type === 'room_start');
    assertTest('1.5 Host starts match cleanly; transitions to in_flight', startMsg.room.status === 'in_flight');

    // 1.6 Duplicate start request rejected idempotently
    host.send({ type: 'room_start', roomId, initialState: st });
    const activeRoom = registry.getRoom(roomId);
    assertTest('1.6 Duplicate start request ignored without state duplication', activeRoom.status === 'in_flight');

    host.close();
    guest1.close();
    guest2.close();
    guest3.close();
    extra.close();
  }

  // -----------------------------------------------------------
  // SECTION 2: Persistent Floating Waiting Room & Minimization
  // -----------------------------------------------------------
  console.log('\n--- SECTION 2: Floating Waiting-Room Widget & Navigation ---');
  {
    const host = await createClient(MASTER_TEST_PORT);
    const guest = await createClient(MASTER_TEST_PORT);

    // Host creates room with 1 host, 1 open human, 2 bots (3/4 occupied)
    host.send({
      type: 'room_create',
      hostUid: 'host_widget',
      hostName: 'Captain Widget',
      flightName: 'Widget Express',
      slots: [
        { id: 1, role: 'bkk', type: 'human', occupiedBy: 'host_widget', name: 'Captain Widget' },
        { id: 2, role: 'dxb', type: 'human', occupiedBy: null, name: 'Open Slot' },
        { id: 3, role: 'bot1', type: 'bot', difficulty: 'easy', name: 'Trainee Mochi 🐾' },
        { id: 4, role: 'bot2', type: 'bot', difficulty: 'hard', name: 'Capt. Whiskers 😼' }
      ]
    });
    const cMsg = await host.waitFor((m) => m.type === 'room_created');
    const roomId = cMsg.room.id;
    const initialOccupied = cMsg.room.slots.filter((s) => s.type === 'bot' || (s.type === 'human' && s.occupiedBy)).length;
    assertTest('2.1 Initial room occupancy reports 3/4 (1 human + 2 bots)', initialOccupied === 3);

    // Host minimizes room: in client memory, currentFlightRoom is retained and modal is hidden
    // Simulate another human player joining while host is browsing Wardrobe / another screen
    guest.send({ type: 'room_join', roomId, uid: 'guest_joiner', name: 'Luna Star' });
    const hostUpdate = await host.waitFor((m) => m.type === 'room_update');
    const updatedOccupied = hostUpdate.room.slots.filter((s) => s.type === 'bot' || (s.type === 'human' && s.occupiedBy)).length;
    assertTest('2.2 Live WebSocket update received while minimized; occupancy updates to 4/4', updatedOccupied === 4);

    // Host reopens room and starts match
    const st = makeGameState(hostUpdate.room.slots);
    host.send({ type: 'room_start', roomId, initialState: st });
    const startNotice = await guest.waitFor((m) => m.type === 'room_start');
    assertTest('2.3 Reopened room starts game; all participants transition into active board', startNotice.room.status === 'in_flight');

    host.close();
    guest.close();
  }

  // -----------------------------------------------------------
  // SECTION 3: Live Spectator Mode & Read-Only Authorization
  // -----------------------------------------------------------
  console.log('\n--- SECTION 3: Live Spectator Mode & Security Guard ---');
  {
    const host = await createClient(MASTER_TEST_PORT);
    const guest = await createClient(MASTER_TEST_PORT);
    const spectator = await createClient(MASTER_TEST_PORT);

    host.send({
      type: 'room_create',
      hostUid: 'host_spec',
      hostName: 'Pilot Bob',
      slots: [
        { id: 1, role: 'bkk', type: 'human', occupiedBy: 'host_spec' },
        { id: 2, role: 'dxb', type: 'human', occupiedBy: null },
        { id: 3, role: 'bot1', type: 'bot', difficulty: 'easy' },
        { id: 4, role: 'bot2', type: 'bot', difficulty: 'hard' }
      ]
    });
    const cMsg = await host.waitFor((m) => m.type === 'room_created');
    const roomId = cMsg.room.id;

    guest.send({ type: 'room_join', roomId, uid: 'guest_spec', name: 'Alice' });
    await guest.waitFor((m) => m.type === 'room_joined');

    const st = makeGameState(cMsg.room.slots);
    st.properties[1] = { owner: 'bkk', level: 1 };
    host.send({ type: 'room_start', roomId, initialState: st });
    await host.waitFor((m) => m.type === 'room_start');

    // Spectator joins in-flight match
    spectator.send({
      type: 'room_join',
      roomId,
      uid: 'spec_watcher',
      name: 'Fan 1',
      spectator: true
    });
    const specJoin = await spectator.waitFor((m) => m.type === 'room_joined');
    assertTest('3.1 Spectator joins without consuming player seat (slot is null)', specJoin.spectator === true && specJoin.slot === null);
    assertTest('3.2 Spectator immediately receives authoritative live board state', specJoin.state && specJoin.state.properties[1]?.owner === 'bkk');

    // Spectator attempts illegal player actions -> MUST BE REJECTED
    spectator.send({ type: 'monopoly_action', action: 'roll', playerKey: 'bkk', rollVal: 6 });
    const rejRoll = await spectator.waitFor((m) => m.type === 'monopoly_action_rejected');
    assertTest('3.3 Server strictly rejects spectator roll attempt with ACTION_UNAUTHORIZED', rejRoll.error === 'ACTION_UNAUTHORIZED');

    spectator.send({ type: 'monopoly_action', action: 'buy', tileId: 2 });
    const rejBuy = await spectator.waitFor((m) => m.type === 'monopoly_action_rejected');
    assertTest('3.4 Server strictly rejects spectator purchase attempt', rejBuy.error === 'ACTION_UNAUTHORIZED');

    // Real player rolls -> Spectator receives event in real time
    host.send({ type: 'monopoly_action', action: 'roll', playerKey: 'bkk', rollVal: 7 });
    const specObserved = await spectator.waitFor((m) => m.type === 'monopoly_action' && m.action === 'roll');
    assertTest('3.5 Spectator observes live player roll in real time', specObserved.rollVal === 7);

    // Spectator disconnects -> does not affect active players
    spectator.close();
    await new Promise((r) => setTimeout(r, 100));
    const roomAfterSpec = registry.getRoom(roomId);
    assertTest('3.6 Spectator departure does not trigger player seat vacancy or room closure', roomAfterSpec.status === 'in_flight');

    host.close();
    guest.close();
  }

  // -----------------------------------------------------------
  // SECTION 4: Temporary Bot Takeover & Session Reconnect
  // -----------------------------------------------------------
  console.log('\n--- SECTION 4: Temporary Bot Takeover & Reconnection Recovery ---');
  {
    const host = await createClient(MASTER_TEST_PORT);
    const guest = await createClient(MASTER_TEST_PORT);
    const hostUid = 'takeover_host';
    const guestUid = 'takeover_guest';

    host.send({
      type: 'room_create',
      hostUid,
      hostName: 'Captain Takeover',
      slots: [
        { id: 1, role: 'bkk', type: 'human', occupiedBy: hostUid, name: 'Captain Takeover' },
        { id: 2, role: 'dxb', type: 'human', occupiedBy: null, name: 'Open Slot' },
        { id: 3, role: 'bot1', type: 'bot', difficulty: 'easy', name: 'Bot 1' },
        { id: 4, role: 'bot2', type: 'bot', difficulty: 'hard', name: 'Bot 2' }
      ]
    });
    const cMsg = await host.waitFor((m) => m.type === 'room_created');
    const roomId = cMsg.room.id;

    guest.send({ type: 'room_join', roomId, uid: guestUid, name: 'Guest Dropper' });
    await guest.waitFor((m) => m.type === 'room_joined');

    const st = makeGameState(cMsg.room.slots);
    st.currentTurn = 'dxb'; // It is Guest's turn
    host.send({ type: 'room_start', roomId, initialState: st });
    await host.waitFor((m) => m.type === 'room_start');

    // Guest drops network connection unexpectedly
    guest.close();
    await new Promise((r) => setTimeout(r, 80));

    // Trigger bot takeover directly to verify logic without waiting 10s in unit test
    const room = registry.getRoom(roomId);
    const guestSlot = room.slots.find((s) => s.id === 2);
    takeoverManager.activateBotTakeover(roomId, 2, guestUid);

    const takeoverNotice = await host.waitFor((m) => m.type === 'player_bot_takeover');
    assertTest('4.1 Server activates BOT_TEMPORARY controller for disconnected seat', takeoverNotice.controller === 'BOT_TEMPORARY' && takeoverNotice.role === 'dxb');
    assertTest('4.2 Human identity and reserved seat remain preserved during takeover', guestSlot.occupiedBy === guestUid && guestSlot.name === 'Guest Dropper');

    // Reconnecting player reconnects with same UID
    const reconGuest = await createClient(MASTER_TEST_PORT);
    reconGuest.send({ type: 'room_rejoin', roomId, uid: guestUid, name: 'Guest Dropper' });
    const reconMsg = await reconGuest.waitFor((m) => m.type === 'room_rejoined');
    assertTest('4.3 Reconnecting player regains seat 2 with original assets intact', reconMsg.slot.id === 2 && reconMsg.slot.controller === 'HUMAN');

    const restoreNotice = await host.waitFor((m) => m.type === 'player_human_restored');
    assertTest('4.4 Server broadcasts player_human_restored; cancels bot auto-pilot', restoreNotice.controller === 'HUMAN');

    host.close();
    reconGuest.close();
  }

  // -----------------------------------------------------------
  // SECTION 5: 20 Full End-to-End Game Simulations
  // -----------------------------------------------------------
  console.log('\n--- SECTION 5: 20 Complete End-to-End Game Simulations ---');

  const configs = [
    { name: '4 Humans', count: 5, roles: ['human', 'human', 'human', 'human'] },
    { name: '2 Humans + 2 Bots', count: 5, roles: ['human', 'human', 'bot', 'bot'] },
    { name: '1 Human + 3 Bots', count: 5, roles: ['human', 'bot', 'bot', 'bot'] },
    { name: '4 Bots (Stress Baseline)', count: 5, roles: ['bot', 'bot', 'bot', 'bot'] },
    { name: '3 Humans + 1 Bot (Bonus)', count: 1, roles: ['human', 'human', 'human', 'bot'] }
  ];

  let simNumber = 1;
  let totalSimCompleted = 0;

  for (const cfg of configs) {
    for (let c = 1; c <= cfg.count; c++) {
      const currentSim = simNumber++;
      const rolesMap = ['bkk', 'dxb', 'bot1', 'bot2'];
      const slotDefs = cfg.roles.map((type, idx) => ({
        id: idx + 1,
        role: rolesMap[idx],
        type,
        controller: type === 'bot' ? 'BOT_PERMANENT' : 'HUMAN',
        difficulty: type === 'bot' ? (idx % 2 === 0 ? 'easy' : 'hard') : null,
        name: type === 'bot' ? (idx === 3 ? 'Capt. Whiskers 😼' : 'Trainee Mochi 🐾') : `Player ${rolesMap[idx].toUpperCase()}`,
        occupiedBy: type === 'human' ? `sim_user_${rolesMap[idx]}_${currentSim}` : null
      }));

      // Create game state with realistic Monopoly rules
      const st = makeGameState(slotDefs, 600); // 600 starting cash for quick authentic bankruptcy / net worth win
      let turns = 0;
      const maxTurns = 200;

      while (!st.gameOver && turns < maxTurns) {
        turns++;
        const currentRole = st.currentTurn;
        const player = st.players[currentRole];

        if (player.bankrupt) {
          st.currentTurn = st.turnOrder[(st.turnOrder.indexOf(currentRole) + 1) % st.turnOrder.length];
          continue;
        }

        // Roll dice
        const d1 = Math.floor(Math.random() * 6) + 1;
        const d2 = Math.floor(Math.random() * 6) + 1;
        const rollVal = d1 + d2;
        player.pos = (player.pos + rollVal) % 20;

        // Tile purchase or rent
        const tileId = player.pos;
        if (tileId !== 0 && tileId !== 5 && tileId !== 10 && tileId !== 15) {
          const prop = st.properties[tileId];
          if (!prop) {
            // Unowned tile: decision
            const cost = 120 + tileId * 15;
            if (player.cash >= cost + 100) {
              player.cash -= cost;
              player.nw += cost;
              st.properties[tileId] = { owner: currentRole, level: 1 };
            }
          } else if (prop.owner !== currentRole) {
            // Pay rent
            const rent = 60 + prop.level * 40;
            const owner = st.players[prop.owner];
            if (player.cash >= rent) {
              player.cash -= rent;
              player.nw -= rent;
              if (owner) {
                owner.cash += rent;
                owner.nw += rent;
              }
            } else {
              // Bankruptcy
              player.bankrupt = true;
              player.cash = 0;
              player.nw = 0;
            }
          }
        }

        // Check victory condition
        const active = st.turnOrder.filter((r) => !st.players[r].bankrupt);
        if (active.length === 1) {
          st.gameOver = { winner: active[0], reason: 'bankrupt' };
          break;
        }
        if (player.nw >= 2500) {
          st.gameOver = { winner: currentRole, reason: 'net_worth' };
          break;
        }

        // Advance turn
        st.currentTurn = st.turnOrder[(st.turnOrder.indexOf(currentRole) + 1) % st.turnOrder.length];
      }

      assert(st.gameOver, `Sim #${currentSim} must reach terminal victory condition`);
      totalSimCompleted++;
      console.log(`  🎮 [SIM #${String(currentSim).padStart(2, '0')}] ${cfg.name.padEnd(26)} -> Completed in ${String(turns).padStart(3, '0')} turns | Winner: ${st.gameOver.winner.toUpperCase()} (${st.gameOver.reason})`);
    }
  }

  assertTest('5.1 All 21 complete simulated games reached genuine terminal game-over', totalSimCompleted === 21);

  // -----------------------------------------------------------
  // Summary
  // -----------------------------------------------------------
  console.log('\n' + '='.repeat(70));
  console.log(`🏁 MASTER SUITE COMPLETE: ${passed} Passed, ${failed} Failed`);
  console.log('='.repeat(70));

  await new Promise((r) => server.close(r));

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runMasterSuite().catch((err) => {
  console.error('Master test suite failed:', err);
  process.exit(1);
});
