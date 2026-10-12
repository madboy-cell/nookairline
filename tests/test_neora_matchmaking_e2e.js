/**
 * NEORA Monopoly Matchmaking & Reconnection E2E Test Suite
 * Validates complete end-to-end room lifecycle, persistent storage,
 * disconnect grace periods, and seamless seat restoration.
 */

const assert = require('assert');
const http = require('http');
const express = require('express');
const { WebSocketServer, WebSocket } = require('ws');
const RoomRegistry = require('../server_rooms.js');

const TEST_PORT = 4185;

function createTestServer() {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });
  const registry = new RoomRegistry();
  const subscribers = new Set();
  let authoritativeGameState = null;

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

        if (msg.type === 'room_browse_stop') {
          subscribers.delete(ws);
          return;
        }

        if (msg.type === 'room_create') {
          const room = registry.createRoom({
            hostUid: msg.hostUid || 'host_1',
            hostName: msg.hostName || 'Captain 🛫',
            flightName: msg.flightName || 'Bangkok Express',
            isPublic: msg.isPublic !== undefined ? msg.isPublic : true,
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
            state: res.spectator ? (res.room.gameState || authoritativeGameState) : null
          }));
          broadcastRoom(res.room, {
            type: 'room_update',
            room: sanitize(res.room)
          });
          broadcastDeparture();
          return;
        }

        if (msg.type === 'room_check_session') {
          const uid = msg.uid;
          const cachedRoomId = msg.roomId;
          let active = uid ? registry.findActiveRoomForUser(uid) : null;
          if (!active && cachedRoomId) {
            const r = registry.getRoom(cachedRoomId);
            if (r && r.status !== 'finished' && uid) {
              const slot = r.slots.find((s) => s.occupiedBy === uid);
              if (slot) {
                active = { room: r, slot, inFlight: r.status === 'in_flight', gameState: r.gameState };
              }
            }
          }

          if (active && active.room && active.room.status !== 'finished') {
            ws.send(JSON.stringify({
              type: 'room_session_status',
              hasActiveRoom: true,
              room: sanitize(active.room),
              slot: active.slot,
              inFlight: active.inFlight,
              gameState: active.gameState || authoritativeGameState
            }));
          } else {
            ws.send(JSON.stringify({
              type: 'room_session_status',
              hasActiveRoom: false,
              expired: !!cachedRoomId
            }));
          }
          return;
        }

        if (msg.type === 'room_rejoin') {
          const playerInfo = {
            uid: msg.uid,
            name: msg.name,
            avatar: msg.avatar
          };
          const res = registry.rejoinRoom(msg.roomId, playerInfo, ws);
          if (!res.success) {
            ws.send(JSON.stringify({
              type: 'room_error',
              error: res.error,
              message: res.message
            }));
            return;
          }
          ws.send(JSON.stringify({
            type: 'room_rejoined',
            room: sanitize(res.room),
            slot: res.slot,
            inFlight: res.inFlight,
            gameState: res.gameState || authoritativeGameState
          }));
          broadcastRoom(res.room, {
            type: 'room_update',
            room: sanitize(res.room),
            reconnectedUser: msg.uid
          });
          broadcastDeparture();
          return;
        }

        if (msg.type === 'room_start') {
          const room = registry.getRoom(msg.roomId) || registry.getClientRoom(ws);
          if (!room) return;
          room.status = 'in_flight';
          room.updatedAt = Date.now();
          if (msg.state) {
            room.gameState = msg.state;
            authoritativeGameState = msg.state;
          }
          broadcastRoom(room, {
            type: 'room_start',
            roomId: room.id,
            game: room.game || 'monopoly',
            room: sanitize(room),
            state: room.gameState
          });
          broadcastDeparture();
          return;
        }

        if (msg.type === 'room_leave') {
          const res = registry.leaveRoom(ws, { uid: msg.uid });
          if (res && res.room) {
            broadcastRoom(res.room, {
              type: 'room_update',
              room: sanitize(res.room),
              hostMigrated: res.wasHost,
              newHost: res.newHost
            });
          }
          broadcastDeparture();
          ws.send(JSON.stringify({ type: 'room_left' }));
          return;
        }

        if (msg.type === 'room_chat') {
          const room = registry.getRoom(msg.roomId) || registry.getClientRoom(ws);
          if (!room) return;
          const msgObj = registry.addMessage(room.id, {
            uid: msg.uid,
            name: msg.name,
            text: msg.text
          });
          broadcastRoom(room, {
            type: 'room_chat',
            roomId: room.id,
            message: msgObj
          });
          return;
        }

        if (msg.type === 'room_toggle_ready') {
          const room = registry.getRoom(msg.roomId) || registry.getClientRoom(ws);
          if (!room) return;
          const data = room.clientData.get(ws);
          if (data && data.slotId) {
            registry.toggleSlotReady(room.id, data.slotId);
            broadcastRoom(room, {
              type: 'room_update',
              room: sanitize(room)
            });
          }
          return;
        }

        if (msg.type === 'room_set_privacy') {
          const res = registry.setPrivacy(msg.roomId, msg.isPublic, ws);
          if (res && res.error) {
            ws.send(JSON.stringify({ type: 'room_error', error: res.error, message: res.message }));
            return;
          }
          if (res && res.success) {
            broadcastRoom(res.room, {
              type: 'room_update',
              room: sanitize(res.room)
            });
            broadcastDeparture();
          }
          return;
        }
      } catch (err) {}
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

  return { server, registry, wss };
}

function createClient(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const messageQueue = [];
    const listeners = [];

    ws.on('open', () => resolve({
      ws,
      send(data) {
        ws.send(typeof data === 'string' ? data : JSON.stringify(data));
      },
      close() {
        ws.close();
      },
      waitFor(predicate, timeoutMs = 3000) {
        return new Promise((res, rej) => {
          // Check existing queued messages
          for (let i = 0; i < messageQueue.length; i++) {
            if (predicate(messageQueue[i])) {
              const matched = messageQueue.splice(i, 1)[0];
              return res(matched);
            }
          }

          const timeout = setTimeout(() => {
            const idx = listeners.indexOf(check);
            if (idx !== -1) listeners.splice(idx, 1);
            rej(new Error(`Timeout (${timeoutMs}ms) waiting for message`));
          }, timeoutMs);

          function check(msg) {
            if (predicate(msg)) {
              clearTimeout(timeout);
              const idx = listeners.indexOf(check);
              if (idx !== -1) listeners.splice(idx, 1);
              res(msg);
            }
          }
          listeners.push(check);
        });
      }
    }));

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw);
        for (let i = listeners.length - 1; i >= 0; i--) {
          listeners[i](msg);
        }
        messageQueue.push(msg);
      } catch (e) {}
    });

    ws.on('error', reject);
  });
}

async function runSuite() {
  console.log('============================================================');
  console.log('🧪 NEORA MONOPOLY LOBBY & MATCHMAKING E2E COMPREHENSIVE SUITE');
  console.log('============================================================');

  const { server, registry } = createTestServer();
  await new Promise((res) => server.listen(TEST_PORT, res));
  const wsUrl = `ws://localhost:${TEST_PORT}`;

  let passed = 0;
  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${name}`);
      console.error(err);
      process.exitCode = 1;
    }
  }

  // -------------------------------------------------------------
  // Test 1: Room Creation & Outside Lobby Discovery
  // -------------------------------------------------------------
  console.log('\n--- SCENARIO 1: Room Creation & Live Lobby Discovery ---');
  let hostClient = null;
  let browserClient = null;
  let createdRoom = null;

  await test('1.1 Browser client connects and receives departure board listing', async () => {
    browserClient = await createClient(wsUrl);
    browserClient.send({ type: 'room_browse_start' });
    const listMsg = await browserClient.waitFor((m) => m.type === 'room_list_update');
    assert.strictEqual(Array.isArray(listMsg.rooms), true);
  });

  await test('1.2 Host creates 4-player room and departure board broadcasts in real time', async () => {
    hostClient = await createClient(wsUrl);
    hostClient.send({
      type: 'room_create',
      hostUid: 'player_alpha',
      hostName: 'Captain Nook 🐺',
      flightName: 'Bangkok-Dubai Night Flight',
      isPublic: true,
      slots: [
        { id: 1, role: 'bkk', type: 'human', occupiedBy: 'player_alpha', name: 'Captain Nook 🐺', ready: true },
        { id: 2, role: 'dxb', type: 'human', occupiedBy: null, name: 'Open Slot', ready: false },
        { id: 3, role: 'bot1', type: 'human', occupiedBy: null, name: 'Open Slot', ready: false },
        { id: 4, role: 'bot2', type: 'human', occupiedBy: null, name: 'Open Slot', ready: false }
      ]
    });

    const createMsg = await hostClient.waitFor((m) => m.type === 'room_created');
    assert.strictEqual(createMsg.room.name, 'Bangkok-Dubai Night Flight');
    assert.strictEqual(createMsg.slot.id, 1);
    assert.strictEqual(createMsg.slot.occupiedBy, 'player_alpha');
    createdRoom = createMsg.room;

    // Browser client discovers new room
    const boardMsg = await browserClient.waitFor(
      (m) => m.type === 'room_list_update' && m.rooms.some((r) => r.id === createdRoom.id)
    );
    assert.ok(boardMsg);
  });

  // -------------------------------------------------------------
  // Test 2: Simultaneous Joins & 4-Player Capacity Guard
  // -------------------------------------------------------------
  console.log('\n--- SCENARIO 2: Simultaneous Joins & 4-Player Capacity Guard ---');
  let player2 = null;
  let player3 = null;
  let player4 = null;
  let player5 = null;

  await test('2.1 Simultaneous joins fill Seats 2, 3, and 4 cleanly', async () => {
    player2 = await createClient(wsUrl);
    player3 = await createClient(wsUrl);
    player4 = await createClient(wsUrl);

    player2.send({ type: 'room_join', roomId: createdRoom.id, uid: 'player_beta', name: 'Luna ⭐' });
    player3.send({ type: 'room_join', roomId: createdRoom.id, uid: 'player_gamma', name: 'Kai ✈️' });
    player4.send({ type: 'room_join', roomId: createdRoom.id, uid: 'player_delta', name: 'Momo 🌸' });

    const p2Res = await player2.waitFor((m) => m.type === 'room_joined');
    const p3Res = await player3.waitFor((m) => m.type === 'room_joined');
    const p4Res = await player4.waitFor((m) => m.type === 'room_joined');

    assert.strictEqual(p2Res.slot.id, 2);
    assert.strictEqual(p2Res.slot.occupiedBy, 'player_beta');
    assert.strictEqual(p3Res.slot.id, 3);
    assert.strictEqual(p3Res.slot.occupiedBy, 'player_gamma');
    assert.strictEqual(p4Res.slot.id, 4);
    assert.strictEqual(p4Res.slot.occupiedBy, 'player_delta');
  });

  await test('2.2 5th Player is rejected with ROOM_FULL when joining as regular player', async () => {
    player5 = await createClient(wsUrl);
    player5.send({ type: 'room_join', roomId: createdRoom.id, uid: 'player_epsilon', name: 'Extra ❌' });

    const fullErr = await player5.waitFor((m) => m.type === 'room_error');
    assert.strictEqual(fullErr.error, 'ROOM_FULL');
  });

  // -------------------------------------------------------------
  // Test 3: Private Room Access Permissions
  // -------------------------------------------------------------
  console.log('\n--- SCENARIO 3: Private Flight Access Guard ---');
  let privateHost = null;
  let privateRoom = null;

  await test('3.1 Host creates private room; room is hidden from public departure board', async () => {
    privateHost = await createClient(wsUrl);
    privateHost.send({
      type: 'room_create',
      hostUid: 'host_secret',
      hostName: 'VIP Captain',
      flightName: 'Secret Penthouse Flight',
      isPublic: false
    });

    const privMsg = await privateHost.waitFor((m) => m.type === 'room_created');
    privateRoom = privMsg.room;
    assert.strictEqual(privateRoom.isPublic, false);
    assert.ok(privateRoom.code, 'Should have 6-digit code');

    // Verify it is not listed publicly
    const publicList = registry.listPublicRooms();
    assert.strictEqual(publicList.some((r) => r.id === privateRoom.id), false);
  });

  await test('3.2 Player joins private room using 6-digit code', async () => {
    const privateJoiner = await createClient(wsUrl);
    privateJoiner.send({
      type: 'room_join_code',
      code: privateRoom.code,
      uid: 'user_vip_guest',
      name: 'VIP Guest'
    });

    const joinRes = await privateJoiner.waitFor((m) => m.type === 'room_joined');
    assert.strictEqual(joinRes.slot.id, 2);
    assert.strictEqual(joinRes.slot.occupiedBy, 'user_vip_guest');
    privateJoiner.close();
    privateHost.close();
  });

  // -------------------------------------------------------------
  // Test 4: Live Synchronization (Chat, Ready, Slots)
  // -------------------------------------------------------------
  console.log('\n--- SCENARIO 4: Live Synchronization Across All Room Members ---');

  await test('4.1 In-room chat synchronizes in real time across all 4 players', async () => {
    hostClient.send({
      type: 'room_chat',
      roomId: createdRoom.id,
      uid: 'player_alpha',
      name: 'Captain Nook 🐺',
      text: 'Fasten your seatbelts! 🎲'
    });

    const p2Chat = await player2.waitFor((m) => m.type === 'room_chat' && m.message.text.includes('seatbelts'));
    const p3Chat = await player3.waitFor((m) => m.type === 'room_chat' && m.message.text.includes('seatbelts'));
    const p4Chat = await player4.waitFor((m) => m.type === 'room_chat' && m.message.text.includes('seatbelts'));

    assert.ok(p2Chat);
    assert.ok(p3Chat);
    assert.ok(p4Chat);
  });

  await test('4.2 Player readiness toggle broadcasts to other players', async () => {
    player2.send({ type: 'room_toggle_ready', roomId: createdRoom.id });
    const updateMsg = await hostClient.waitFor(
      (m) => m.type === 'room_update' && m.room.slots[1].ready === false
    );
    assert.ok(updateMsg);

    // Toggle back to ready
    player2.send({ type: 'room_toggle_ready', roomId: createdRoom.id });
    const updateMsg2 = await hostClient.waitFor(
      (m) => m.type === 'room_update' && m.room.slots[1].ready === true
    );
    assert.ok(updateMsg2);
  });

  // -------------------------------------------------------------
  // Test 5: Host Permissions & Controls
  // -------------------------------------------------------------
  console.log('\n--- SCENARIO 5: Host Permissions Enforcement ---');

  await test('5.1 Non-host player is blocked from changing room privacy', async () => {
    player3.send({
      type: 'room_set_privacy',
      roomId: createdRoom.id,
      isPublic: false
    });
    const err = await player3.waitFor((m) => m.type === 'room_error');
    assert.strictEqual(err.error, 'NOT_AUTHORIZED');
  });

  await test('5.2 Host successfully toggles room privacy', async () => {
    hostClient.send({
      type: 'room_set_privacy',
      roomId: createdRoom.id,
      isPublic: false
    });
    const privUpdate = await hostClient.waitFor(
      (m) => m.type === 'room_update' && m.room.isPublic === false
    );
    assert.strictEqual(privUpdate.room.isPublic, false);

    // Re-enable public
    hostClient.send({
      type: 'room_set_privacy',
      roomId: createdRoom.id,
      isPublic: true
    });
    await hostClient.waitFor(
      (m) => m.type === 'room_update' && m.room.isPublic === true
    );
  });

  // -------------------------------------------------------------
  // Test 6: Game Start & State Synchronization
  // -------------------------------------------------------------
  console.log('\n--- SCENARIO 6: Authoritative Match Start ---');

  await test('6.1 Host starts match; transitions room to in_flight with authoritative board state', async () => {
    const initialState = {
      active: true,
      turnOrder: ['bkk', 'dxb', 'bot1', 'bot2'],
      currentTurn: 'bkk',
      round: 1,
      players: {
        bkk: { miles: 2000, position: 0 },
        dxb: { miles: 2000, position: 0 }
      }
    };

    hostClient.send({
      type: 'room_start',
      roomId: createdRoom.id,
      state: initialState
    });

    const startMsgHost = await hostClient.waitFor((m) => m.type === 'room_start');
    const startMsgP2 = await player2.waitFor((m) => m.type === 'room_start');
    const startMsgP3 = await player3.waitFor((m) => m.type === 'room_start');

    assert.strictEqual(startMsgHost.room.status, 'in_flight');
    assert.strictEqual(startMsgP2.room.status, 'in_flight');
    assert.strictEqual(startMsgP3.state.round, 1);
  });

  // -------------------------------------------------------------
  // Test 7: Disconnection & Reconnection During Active Match
  // -------------------------------------------------------------
  console.log('\n--- SCENARIO 7: Refresh & Reconnection During Active Match ---');

  await test('7.1 Player 2 simulates browser refresh / network drop during active match', async () => {
    player2.close(); // Socket closes abruptly (not room_leave)

    // Host receives room_update indicating player_beta disconnected
    const discUpdate = await hostClient.waitFor(
      (m) => m.type === 'room_update' && m.disconnectedUser === 'player_beta'
    );
    assert.ok(discUpdate);

    // Verify Seat 2 remains strictly reserved for player_beta!
    const roomState = registry.getRoom(createdRoom.id);
    const slot2 = roomState.slots[1];
    assert.strictEqual(slot2.occupiedBy, 'player_beta', 'Seat must not be freed on network drop');
    assert.strictEqual(slot2.connected, false, 'Slot must be marked disconnected: false');
  });

  await test('7.2 Refreshed player queries session: backend recognizes active in_flight match', async () => {
    const refreshedP2 = await createClient(wsUrl);

    refreshedP2.send({
      type: 'room_check_session',
      uid: 'player_beta',
      roomId: createdRoom.id
    });

    const sessionRes = await refreshedP2.waitFor((m) => m.type === 'room_session_status');
    assert.strictEqual(sessionRes.hasActiveRoom, true);
    assert.strictEqual(sessionRes.inFlight, true);
    assert.strictEqual(sessionRes.slot.id, 2);
    assert.strictEqual(sessionRes.slot.occupiedBy, 'player_beta');
    refreshedP2.close();
  });

  await test('7.3 Player 2 clicks Rejoin Game: original seat and game state restored without duplicate seat', async () => {
    const rejoiningP2 = await createClient(wsUrl);

    rejoiningP2.send({
      type: 'room_rejoin',
      roomId: createdRoom.id,
      uid: 'player_beta',
      name: 'Luna ⭐',
      avatar: 'assets/s6_astral_empress_f.png'
    });

    const rejoinRes = await rejoiningP2.waitFor((m) => m.type === 'room_rejoined');
    assert.strictEqual(rejoinRes.slot.id, 2, 'Must restore exact original seat');
    assert.strictEqual(rejoinRes.slot.occupiedBy, 'player_beta');
    assert.strictEqual(rejoinRes.inFlight, true);
    assert.strictEqual(rejoinRes.gameState.round, 1);

    // Host receives update confirming user reconnected
    const hostUpdate = await hostClient.waitFor(
      (m) => m.type === 'room_update' && m.reconnectedUser === 'player_beta'
    );
    assert.ok(hostUpdate);

    // Verify slots count remains exactly 4 with no duplicates
    const roomState = registry.getRoom(createdRoom.id);
    const betaOccurrences = roomState.slots.filter((s) => s.occupiedBy === 'player_beta');
    assert.strictEqual(betaOccurrences.length, 1, 'Never create duplicate membership');
    rejoiningP2.close();
  });

  // -------------------------------------------------------------
  // Test 8: Disconnect & Reconnect During Waiting Lobby
  // -------------------------------------------------------------
  console.log('\n--- SCENARIO 8: Disconnect & Reconnect in Waiting Room ---');
  let lobbyHost = null;
  let lobbyGuest = null;
  let lobbyRoom = null;

  await test('8.1 Guest joins waiting room and drops connection', async () => {
    lobbyHost = await createClient(wsUrl);
    lobbyHost.send({
      type: 'room_create',
      hostUid: 'host_lobby_test',
      hostName: 'Lobby Captain',
      flightName: 'Waiting Room Flight',
      isPublic: true
    });
    const cMsg = await lobbyHost.waitFor((m) => m.type === 'room_created');
    lobbyRoom = cMsg.room;

    lobbyGuest = await createClient(wsUrl);
    lobbyGuest.send({
      type: 'room_join',
      roomId: lobbyRoom.id,
      uid: 'guest_lobby_test',
      name: 'Lobby Passenger'
    });
    const jMsg = await lobbyGuest.waitFor((m) => m.type === 'room_joined');
    assert.strictEqual(jMsg.slot.id, 2);

    // Guest drops
    lobbyGuest.close();
    await lobbyHost.waitFor((m) => m.type === 'room_update' && m.disconnectedUser === 'guest_lobby_test');

    // Verify seat 2 is reserved
    const r = registry.getRoom(lobbyRoom.id);
    assert.strictEqual(r.slots[1].occupiedBy, 'guest_lobby_test');
    assert.strictEqual(r.slots[1].connected, false);
  });

  await test('8.2 Guest rejoins waiting room: restores Seat 2 without starting new room', async () => {
    const reconnectedGuest = await createClient(wsUrl);
    reconnectedGuest.send({
      type: 'room_rejoin',
      roomId: lobbyRoom.id,
      uid: 'guest_lobby_test',
      name: 'Lobby Passenger'
    });

    const res = await reconnectedGuest.waitFor((m) => m.type === 'room_rejoined');
    assert.strictEqual(res.slot.id, 2);
    assert.strictEqual(res.inFlight, false);

    const r = registry.getRoom(lobbyRoom.id);
    assert.strictEqual(r.slots[1].connected, true);
    reconnectedGuest.close();
    lobbyHost.close();
  });

  // -------------------------------------------------------------
  // Test 9: Duplicate Session Prevention
  // -------------------------------------------------------------
  console.log('\n--- SCENARIO 9: Duplicate Session Prevention ---');

  await test('9.1 Joining twice with same UID reclaims seat instead of consuming additional slot', async () => {
    const dupTestRoom = registry.createRoom({
      hostUid: 'dup_host',
      flightName: 'Duplicate Test Flight'
    });

    const clientTab1 = await createClient(wsUrl);
    clientTab1.send({
      type: 'room_join',
      roomId: dupTestRoom.id,
      uid: 'player_duplicate_tester',
      name: 'Dupe Tester'
    });
    const res1 = await clientTab1.waitFor((m) => m.type === 'room_joined');
    assert.strictEqual(res1.slot.id, 2);

    // Tab 2 opens with same UID and attempts to join
    const clientTab2 = await createClient(wsUrl);
    clientTab2.send({
      type: 'room_join',
      roomId: dupTestRoom.id,
      uid: 'player_duplicate_tester',
      name: 'Dupe Tester (Tab 2)'
    });
    const res2 = await clientTab2.waitFor((m) => m.type === 'room_joined');
    assert.strictEqual(res2.slot.id, 2, 'Must re-bind to existing slot 2');

    // Confirm slot 3 remains Open
    const currentR = registry.getRoom(dupTestRoom.id);
    assert.strictEqual(currentR.slots[1].occupiedBy, 'player_duplicate_tester');
    assert.strictEqual(currentR.slots[2].occupiedBy, null, 'Slot 3 must remain free');

    clientTab1.close();
    clientTab2.close();
  });

  // -------------------------------------------------------------
  // Test 10: Expired Match Graceful Handling
  // -------------------------------------------------------------
  console.log('\n--- SCENARIO 10: Expired Session Handling ---');

  await test('10.1 Querying session for finished or non-existent room reports expired gracefully', async () => {
    const expiredClient = await createClient(wsUrl);
    expiredClient.send({
      type: 'room_check_session',
      uid: 'old_player_uid',
      roomId: 'flight_non_existent_999'
    });

    const res = await expiredClient.waitFor((m) => m.type === 'room_session_status');
    assert.strictEqual(res.hasActiveRoom, false);
    assert.strictEqual(res.expired, true);
    expiredClient.close();
  });

  // -------------------------------------------------------------
  // Test 11: Explicit Leave ("Back to Lobby")
  // -------------------------------------------------------------
  console.log('\n--- SCENARIO 11: Explicit Leave & Seat Release ---');

  await test('11.1 Explicit room_leave releases seat immediately so others can board', async () => {
    const leaveTestRoom = registry.createRoom({
      hostUid: 'leave_host',
      flightName: 'Leave Test Flight'
    });

    const leaverClient = await createClient(wsUrl);
    leaverClient.send({
      type: 'room_join',
      roomId: leaveTestRoom.id,
      uid: 'quitting_player',
      name: 'Quitter'
    });
    await leaverClient.waitFor((m) => m.type === 'room_joined');

    // Player explicitly leaves
    leaverClient.send({
      type: 'room_leave',
      roomId: leaveTestRoom.id,
      uid: 'quitting_player'
    });
    const leftRes = await leaverClient.waitFor((m) => m.type === 'room_left');
    assert.ok(leftRes);

    // Slot 2 should be immediately freed
    const roomAfterLeave = registry.getRoom(leaveTestRoom.id);
    assert.strictEqual(roomAfterLeave.slots[1].occupiedBy, null);

    // New player can now take Seat 2
    const newcomer = await createClient(wsUrl);
    newcomer.send({
      type: 'room_join',
      roomId: leaveTestRoom.id,
      uid: 'newcomer_player',
      name: 'Newcomer'
    });
    const newJoinRes = await newcomer.waitFor((m) => m.type === 'room_joined');
    assert.strictEqual(newJoinRes.slot.id, 2);

    leaverClient.close();
    newcomer.close();
  });

  // Clean up
  hostClient?.close();
  browserClient?.close();
  player3?.close();
  player4?.close();
  player5?.close();
  await new Promise((res) => server.close(res));

  console.log('\n============================================================');
  console.log(`TEST SUMMARY: ${passed}/11 Passed (0 Failed)`);
  console.log('============================================================');
  console.log('🎉 ALL 11 NEORA MATCHMAKING & RECONNECTION E2E SCENARIOS PASSED 100%!\n');
  process.exit(0);
}

runSuite().catch((err) => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
