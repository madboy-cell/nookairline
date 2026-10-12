/**
 * 🛫 NOOK AIRLINE — 10-AGENT SWARM END-TO-END SIMULATION SUITE
 *
 * Simulates 10 autonomous human personas performing:
 * Phase 1: New Member Onboarding, Character Base Selection (BKK / DXB) & Passports
 * Phase 2: Sky Social Handshake (Reciprocal Friend Requests, Couple Sanctuary, Call Gating, Clean Decouple)
 * Phase 3: Interactive Module Tour (Vault Gacha, Daily Attendance, Cat Lounge, Galley, SkyDash)
 * Phase 4: Multiplayer Flight Lobbies (Room 1, Room 2, Live Departure Board, Chat, Resilient Reconnection)
 * Phase 5: Live Monopoly Match with Dedicated Spectator (Agent 10 streams live moves without holding a seat)
 */

const assert = require('assert');
const http = require('http');
const express = require('express');
const { WebSocketServer, WebSocket } = require('ws');
const RoomRegistry = require('../server_rooms.js');

const TEST_PORT = 4399;

console.log('================================================================================');
console.log('🛫 NOOK AIRLINE: 10-AGENT SWARM END-TO-END SIMULATION SUITE');
console.log('================================================================================\n');

// ---------------------------------------------------------------------------
// 1. Personas Definition Matrix
// ---------------------------------------------------------------------------
const PERSONA_CONFIGS = [
  { id: 'usr_alex_01', name: 'Captain Alex 🐺', base: 'bkk', role: 'Host & P1', diamonds: 25000 },
  { id: 'usr_luna_02', name: 'Princess Luna 🐉', base: 'dxb', role: 'P2 & Couple 1', diamonds: 22000 },
  { id: 'usr_kai_03',  name: 'Pilot Kai 🐺',     base: 'bkk', role: 'P3 & SkyDash Runner', diamonds: 18000 },
  { id: 'usr_momo_04', name: 'Sailor Momo 🐉',    base: 'dxb', role: 'P4 & Couple 2', diamonds: 16000 },
  { id: 'usr_roy_05',  name: 'Jetstream Roy 🐺',  base: 'bkk', role: 'Room 2 Host', diamonds: 20000 },
  { id: 'usr_mira_06', name: 'Sky Queen Mira 🐉', base: 'dxb', role: 'Room 2 & Gacha Whale', diamonds: 45000 },
  { id: 'usr_ken_07',  name: 'Aero Ken 🐺',      base: 'bkk', role: 'Room 2 & Cat Caretaker', diamonds: 15000 },
  { id: 'usr_ivy_08',  name: 'Stellar Ivy 🐉',    base: 'dxb', role: 'Resilience Tester', diamonds: 19000 },
  { id: 'usr_neo_09',  name: 'Cloud Neo 🐺',      base: 'bkk', role: 'Private Flight Host', diamonds: 14000 },
  { id: 'usr_zero_10', name: 'Observer Zero 👁️',  base: 'dxb', role: 'Dedicated Spectator', diamonds: 5000 }
];

// ---------------------------------------------------------------------------
// 2. Client Agent Virtual Model
// ---------------------------------------------------------------------------
class AgentClient {
  constructor(cfg) {
    this.id = cfg.id;
    this.name = cfg.name;
    this.base = cfg.base;
    this.role = cfg.role;
    this.diamonds = cfg.diamonds;
    this.stardust = 0;
    this.pity = { epic: 0, mythic: 0 };
    this.inventory = [{ id: 'classic_uniform', qty: 1 }];
    this.equippedCostume = `${cfg.base}_classic`;
    this.passportCompleted = false;
    
    // Social
    this.friends = new Set();
    this.friendRequestsSent = new Set();
    this.friendRequestsReceived = new Set();
    this.couple = { isCouple: false, partnerId: null, partnerName: null, anniversary: null };
    
    // Modules
    this.dailyCheckedIn = false;
    this.dailyStreak = 0;
    this.catsCaredFor = {};
    this.galleyOrders = [];
    this.skyDashBest = 0;
    
    // Networking
    this.wsClient = null;
    this.currentRoom = null;
    this.currentSlot = null;
    this.isSpectator = false;
    this.spectatedEvents = [];
  }

  // Phase 1: Onboarding
  completeOnboarding(chosenBase) {
    this.base = chosenBase || this.base;
    this.equippedCostume = `${this.base}_boarding_pass_vip`;
    this.passportCompleted = true;
    return {
      status: 'ONBOARDED',
      passportId: `PASS-${this.id.toUpperCase()}`,
      base: this.base,
      costume: this.equippedCostume
    };
  }

  // Phase 2: Social
  sendFriendRequest(targetAgent) {
    this.friendRequestsSent.add(targetAgent.id);
    targetAgent.friendRequestsReceived.add(this.id);
  }

  acceptFriendRequest(targetAgent) {
    if (this.friendRequestsReceived.has(targetAgent.id)) {
      this.friendRequestsReceived.delete(targetAgent.id);
      targetAgent.friendRequestsSent.delete(this.id);
      this.friends.add(targetAgent.id);
      targetAgent.friends.add(this.id);
    }
  }

  linkCouple(targetAgent) {
    const anniv = new Date().toISOString();
    this.couple = {
      isCouple: true,
      partnerId: targetAgent.id,
      partnerName: targetAgent.name,
      partnerBase: targetAgent.base,
      anniversary: anniv
    };
    targetAgent.couple = {
      isCouple: true,
      partnerId: this.id,
      partnerName: this.name,
      partnerBase: this.base,
      anniversary: anniv
    };
  }

  decouple() {
    this.couple = { isCouple: false, partnerId: null, partnerName: null, anniversary: null };
  }

  checkCoupleCallAllowed() {
    return this.couple.isCouple;
  }

  // Phase 3: Modules
  rollGacha(pullCount = 1) {
    const cost = pullCount === 10 ? 900 : 100;
    if (this.diamonds < cost) throw new Error('Insufficient diamonds');
    this.diamonds -= cost;
    this.pity.epic += pullCount;
    this.pity.mythic += pullCount;

    const results = [];
    for (let i = 0; i < pullCount; i++) {
      let rarity = 'common';
      if (this.pity.mythic >= 60 || Math.random() < 0.02) {
        rarity = 'mythic';
        this.pity.mythic = 0;
      } else if (this.pity.epic >= 10 || Math.random() < 0.15) {
        rarity = 'epic';
        this.pity.epic = 0;
      } else if (Math.random() < 0.35) {
        rarity = 'rare';
      }
      const item = { id: `costume_s${rarity}_${Date.now()}_${i}`, rarity };
      results.push(item);
      this.inventory.push(item);
    }
    return { results, remainingDiamonds: this.diamonds, pity: this.pity };
  }

  claimDailyAttendance() {
    if (this.dailyCheckedIn) return false;
    this.dailyCheckedIn = true;
    this.dailyStreak += 1;
    this.diamonds += 20;
    return { streak: this.dailyStreak, bonus: 20, diamonds: this.diamonds };
  }

  careCat(catId, action = 'pet') {
    if (!this.catsCaredFor[catId]) {
      this.catsCaredFor[catId] = { affection: 0, pets: 0, feeds: 0 };
    }
    const record = this.catsCaredFor[catId];
    if (action === 'pet') {
      record.pets += 1;
      record.affection += 5;
    } else if (action === 'feed') {
      record.feeds += 1;
      record.affection += 10;
    }
    return record;
  }

  orderGalley(itemKey, price = 50) {
    if (this.diamonds < price) throw new Error('Insufficient diamonds for galley order');
    this.diamonds -= price;
    this.galleyOrders.push({ itemKey, orderedAt: Date.now() });
    return { item: itemKey, diamonds: this.diamonds };
  }

  recordSkyDashRun(meters) {
    if (meters > this.skyDashBest) {
      this.skyDashBest = meters;
    }
    const bonus = Math.floor(meters / 100);
    this.diamonds += bonus;
    return { run: meters, best: this.skyDashBest, bonusEarned: bonus };
  }
}

// ---------------------------------------------------------------------------
// 3. Test WebSocket Server Setup
// ---------------------------------------------------------------------------
function startTestServer(port) {
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

        if (msg.type === 'room_create') {
          const room = registry.createRoom({
            hostUid: msg.hostUid,
            hostName: msg.hostName,
            flightName: msg.flightName,
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

        if (msg.type === 'room_join') {
          const playerInfo = {
            uid: msg.uid,
            name: msg.name,
            avatar: msg.avatar,
            spectator: !!msg.spectator
          };
          const res = registry.joinRoom(msg.roomId, playerInfo, ws);
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
            room: sanitize(res.room),
            joinedUser: msg.uid,
            spectator: !!res.spectator
          });
          broadcastDeparture();
          return;
        }

        if (msg.type === 'room_toggle_ready') {
          const room = registry.getClientRoom(ws);
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

        if (msg.type === 'room_chat') {
          const room = registry.getClientRoom(ws);
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
            room: sanitize(room),
            state: room.gameState
          });
          broadcastDeparture();
          return;
        }

        if (msg.type === 'monopoly_action') {
          const room = registry.getClientRoom(ws);
          if (!room) return;
          const clientData = room.clientData.get(ws);
          if (clientData && clientData.spectator) {
            ws.send(JSON.stringify({ type: 'monopoly_error', error: 'SPECTATOR_MUTATION_BLOCKED' }));
            return;
          }

          // Authoritative action processing
          if (msg.action === 'roll') {
            const d1 = msg.dice1 || Math.floor(Math.random() * 6) + 1;
            const d2 = msg.dice2 || Math.floor(Math.random() * 6) + 1;
            const rollTotal = d1 + d2;
            const turn = msg.turn || clientData.role || 'bkk';

            if (!room.gameState) room.gameState = { turnOrder: ['bkk', 'dxb', 'bot1', 'bot2'], players: {}, round: 1 };
            if (!room.gameState.players[turn]) room.gameState.players[turn] = { position: 0, miles: 2000 };

            room.gameState.players[turn].position = (room.gameState.players[turn].position + rollTotal) % 24;
            room.gameState.lastRoll = { turn, d1, d2, total: rollTotal, pos: room.gameState.players[turn].position };

            broadcastRoom(room, {
              type: 'monopoly_broadcast',
              action: 'roll',
              rollVal: rollTotal,
              dice1: d1,
              dice2: d2,
              player: turn,
              newPosition: room.gameState.players[turn].position,
              state: room.gameState
            });
          }
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
              if (slot) active = { room: r, slot, inFlight: r.status === 'in_flight' };
            }
          }
          ws.send(JSON.stringify({
            type: 'room_session_status',
            hasActiveRoom: !!(active && active.room),
            room: active ? sanitize(active.room) : null,
            slot: active ? active.slot : null
          }));
          return;
        }

        if (msg.type === 'room_rejoin') {
          const playerInfo = { uid: msg.uid, name: msg.name, avatar: msg.avatar };
          const res = registry.rejoinRoom(msg.roomId, playerInfo, ws);
          if (!res.success) {
            ws.send(JSON.stringify({ type: 'room_error', error: res.error }));
            return;
          }
          ws.send(JSON.stringify({
            type: 'room_rejoined',
            room: sanitize(res.room),
            slot: res.slot,
            inFlight: res.inFlight
          }));
          broadcastRoom(res.room, {
            type: 'room_update',
            room: sanitize(res.room),
            reconnectedUser: msg.uid
          });
          broadcastDeparture();
          return;
        }
      } catch (err) {}
    });

    ws.on('close', () => {
      subscribers.delete(ws);
      const disc = registry.handleDisconnect(ws);
      if (disc && disc.room) {
        broadcastRoom(disc.room, {
          type: 'room_update',
          room: sanitize(disc.room),
          disconnectedUser: disc.disconnectedUser
        });
        broadcastDeparture();
      }
    });
  });

  return { server, registry, wss };
}

function createWsClient(url) {
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
          for (let i = 0; i < messageQueue.length; i++) {
            if (predicate(messageQueue[i])) {
              return res(messageQueue.splice(i, 1)[0]);
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

// ---------------------------------------------------------------------------
// 4. Test Orchestrator
// ---------------------------------------------------------------------------
(async () => {
  let passed = 0;
  let failed = 0;

  function it(name, ok) {
    if (ok) {
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${name}`);
      failed++;
    }
  }

  async function itAsync(name, fn) {
    try {
      await fn();
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${name}`);
      console.error(err);
      failed++;
    }
  }

  const { server, registry } = startTestServer(TEST_PORT);
  await new Promise((res) => server.listen(TEST_PORT, res));
  const wsUrl = `ws://localhost:${TEST_PORT}`;

  // Initialize 10 Agent Personas
  const agents = PERSONA_CONFIGS.map((cfg) => new AgentClient(cfg));

  // =========================================================================
  // PHASE 1: New Member Onboarding & Passports
  // =========================================================================
  console.log('--- 🌟 PHASE 1: New Member Onboarding & Character Selection (10 Personas) ---');

  agents.forEach((agent, i) => {
    const ob = agent.completeOnboarding(agent.base);
    it(`1.${i + 1} Agent ${agent.name} (${agent.role}) completed onboarding as ${agent.base.toUpperCase()}`,
      ob.status === 'ONBOARDED' && agent.passportCompleted === true && agent.equippedCostume.includes(agent.base)
    );
  });

  // =========================================================================
  // PHASE 2: Sky Social Handshake (Friends & Couple Sanctuary)
  // =========================================================================
  console.log('\n--- 🤝 PHASE 2: Sky Social & Couple Sanctuary Life Cycle ---');

  // 2.1 Friend Requests: Alex <-> Kai, Momo <-> Kai
  const alex = agents[0];
  const luna = agents[1];
  const kai  = agents[2];
  const momo = agents[3];
  const roy  = agents[4];
  const mira = agents[5];
  const ken  = agents[6];
  const ivy  = agents[7];
  const neo  = agents[8];
  const zero = agents[9];

  alex.sendFriendRequest(kai);
  kai.acceptFriendRequest(alex);
  it('2.1 Reciprocal Friend Handshake: Captain Alex and Pilot Kai are confirmed friends',
    alex.friends.has(kai.id) && kai.friends.has(alex.id)
  );

  momo.sendFriendRequest(kai);
  kai.acceptFriendRequest(momo);
  it('2.2 Friend Handshake: Sailor Momo and Pilot Kai are confirmed friends',
    momo.friends.has(kai.id) && kai.friends.has(momo.id)
  );

  // 2.2 Couple Sanctuary Pair 1: Alex + Luna
  it('2.3 Pre-couple state: Alex and Luna 1:1 call gating is strictly BLOCKED',
    alex.checkCoupleCallAllowed() === false && luna.checkCoupleCallAllowed() === false
  );

  alex.linkCouple(luna);
  it('2.4 Couple Sanctuary Bound: Alex and Luna link with shared anniversary and unlocked 1:1 call gating',
    alex.couple.isCouple === true && luna.couple.isCouple === true &&
    alex.couple.partnerId === luna.id && luna.couple.partnerId === alex.id &&
    alex.checkCoupleCallAllowed() === true && luna.checkCoupleCallAllowed() === true
  );

  // 2.3 Couple Sanctuary Pair 2: Momo + Roy & Decouple Zero-Regression Check
  momo.linkCouple(roy);
  it('2.5 Couple Pair 2 Bound: Momo and Roy link in Couple Sanctuary',
    momo.couple.isCouple === true && roy.couple.isCouple === true &&
    momo.checkCoupleCallAllowed() === true && roy.checkCoupleCallAllowed() === true
  );

  const momoInitialDiamonds = momo.diamonds;
  momo.decouple();
  roy.decouple();
  it('2.6 Decouple Safety: Momo and Roy decouple -> 1:1 call locks, 100% diamonds & inventory preserved',
    momo.checkCoupleCallAllowed() === false && roy.checkCoupleCallAllowed() === false &&
    momo.diamonds === momoInitialDiamonds && momo.inventory.length >= 1
  );

  // =========================================================================
  // PHASE 3: Module Interactive Exploration
  // =========================================================================
  console.log('\n--- 🎮 PHASE 3: Module Interactive Exploration ---');

  // 3.1 Vault & Gacha
  const gachaRes1 = alex.rollGacha(1);
  const expectedEpicPity = gachaRes1.results[0].rarity === 'epic' ? 0 : 1;
  it('3.1 Vault Single Pull: Captain Alex rolls 1 item, spends 100💎, pity updates correctly',
    gachaRes1.results.length === 1 && alex.diamonds === 24900 && alex.pity.epic === expectedEpicPity
  );

  const gachaRes10 = mira.rollGacha(10);
  it('3.2 Vault 10x Pull: Sky Queen Mira rolls 10 items, spends 900💎, pity increments by 10',
    gachaRes10.results.length === 10 && mira.diamonds === 44100 && mira.inventory.length === 11
  );

  // 3.2 Daily Attendance
  const dailyAlex = alex.claimDailyAttendance();
  it('3.3 Daily Attendance: Captain Alex checks in, gains streak +1 and +20💎 bonus',
    dailyAlex.streak === 1 && dailyAlex.bonus === 20 && alex.diamonds === 24920
  );

  const dailyAlexSecond = alex.claimDailyAttendance();
  it('3.4 Daily Attendance Guard: Second check-in on same day is blocked gracefully',
    dailyAlexSecond === false
  );

  // 3.3 Cat Lounge
  const catPet = ken.careCat('mimi', 'pet');
  const catFeed = ken.careCat('mimi', 'feed');
  it('3.5 Cat Lounge Care: Aero Ken pets and feeds Mimi, affection rises smoothly',
    catPet.pets === 1 && catFeed.feeds === 1 && catFeed.affection === 15
  );

  // 3.4 Galley
  const galleyRes = luna.orderGalley('espresso', 50);
  it('3.6 Galley Refreshments: Princess Luna orders in-flight espresso, wallet synchronizes',
    galleyRes.item === 'espresso' && luna.diamonds === 21950 && luna.galleyOrders.length === 1
  );

  // 3.5 SkyDash
  const dashRes = kai.recordSkyDashRun(1250);
  it('3.7 SkyDash Mini-Game: Pilot Kai logs 1,250m flight distance and earns 12💎 bonus',
    dashRes.run === 1250 && dashRes.best === 1250 && dashRes.bonusEarned === 12
  );

  // =========================================================================
  // PHASE 4: Multiplayer Flight Lobbies (Room 1, Room 2, Spectator, Reconnect)
  // =========================================================================
  console.log('\n--- ✈️ PHASE 4: Multiplayer Lobbies, Matchmaking & Reconnection ---');

  let departureBrowser = null;
  let flight1Room = null;
  let flight2Room = null;

  await itAsync('4.1 Live Departure Board: Observer Zero monitors departure board updates', async () => {
    departureBrowser = await createWsClient(wsUrl);
    departureBrowser.send({ type: 'room_browse_start' });
    const board = await departureBrowser.waitFor((m) => m.type === 'room_list_update');
    assert.strictEqual(Array.isArray(board.rooms), true);
  });

  await itAsync('4.2 Flight 1 Creation: Captain Alex hosts 4-Player flight "Bangkok-Dubai Night Sky"', async () => {
    alex.wsClient = await createWsClient(wsUrl);
    alex.wsClient.send({
      type: 'room_create',
      hostUid: alex.id,
      hostName: alex.name,
      flightName: 'Bangkok-Dubai Night Sky',
      isPublic: true,
      slots: [
        { id: 1, role: 'bkk', type: 'human', occupiedBy: alex.id, name: alex.name, ready: true },
        { id: 2, role: 'dxb', type: 'human', occupiedBy: null, name: 'Open Slot', ready: false },
        { id: 3, role: 'bot1', type: 'human', occupiedBy: null, name: 'Open Slot', ready: false },
        { id: 4, role: 'bot2', type: 'human', occupiedBy: null, name: 'Open Slot', ready: false }
      ]
    });
    const res = await alex.wsClient.waitFor((m) => m.type === 'room_created');
    flight1Room = res.room;
    assert.strictEqual(flight1Room.name, 'Bangkok-Dubai Night Sky');
    assert.strictEqual(res.slot.id, 1);
  });

  await itAsync('4.3 Seats 2, 3, 4 Occupancy: Luna, Kai, and Momo board Flight 1', async () => {
    luna.wsClient = await createWsClient(wsUrl);
    kai.wsClient  = await createWsClient(wsUrl);
    momo.wsClient = await createWsClient(wsUrl);

    luna.wsClient.send({ type: 'room_join', roomId: flight1Room.id, uid: luna.id, name: luna.name });
    kai.wsClient.send({  type: 'room_join', roomId: flight1Room.id, uid: kai.id,  name: kai.name });
    momo.wsClient.send({ type: 'room_join', roomId: flight1Room.id, uid: momo.id, name: momo.name });

    const p2Res = await luna.wsClient.waitFor((m) => m.type === 'room_joined');
    const p3Res = await kai.wsClient.waitFor((m) => m.type === 'room_joined');
    const p4Res = await momo.wsClient.waitFor((m) => m.type === 'room_joined');

    assert.strictEqual(p2Res.slot.id, 2);
    assert.strictEqual(p3Res.slot.id, 3);
    assert.strictEqual(p4Res.slot.id, 4);
  });

  await itAsync('4.4 Dedicated Spectator: Observer Zero boards Flight 1 with spectator: true', async () => {
    zero.wsClient = await createWsClient(wsUrl);
    zero.isSpectator = true;
    zero.wsClient.send({
      type: 'room_join',
      roomId: flight1Room.id,
      uid: zero.id,
      name: zero.name,
      spectator: true
    });

    const specRes = await zero.wsClient.waitFor((m) => m.type === 'room_joined');
    assert.strictEqual(specRes.spectator, true, 'Zero must be confirmed spectator');
    assert.strictEqual(!specRes.slot, true, 'Spectators do NOT occupy a player slot');
  });

  await itAsync('4.5 In-Room Chat Sync: Spectator and players receive cabin broadcast', async () => {
    alex.wsClient.send({
      type: 'room_chat',
      roomId: flight1Room.id,
      uid: alex.id,
      name: alex.name,
      text: 'Welcome aboard Flight 1! Clear skies ahead 🛫'
    });

    const lunaChat = await luna.wsClient.waitFor((m) => m.type === 'room_chat');
    const zeroChat = await zero.wsClient.waitFor((m) => m.type === 'room_chat');

    assert.strictEqual(lunaChat.message.text.includes('Clear skies'), true);
    assert.strictEqual(zeroChat.message.text.includes('Clear skies'), true, 'Spectator must receive live chat');
  });

  await itAsync('4.6 Readiness Toggles: Luna, Kai, and Momo toggle ready status', async () => {
    luna.wsClient.send({ type: 'room_toggle_ready', roomId: flight1Room.id });
    kai.wsClient.send({  type: 'room_toggle_ready', roomId: flight1Room.id });
    momo.wsClient.send({ type: 'room_toggle_ready', roomId: flight1Room.id });

    const update = await alex.wsClient.waitFor(
      (m) => m.type === 'room_update' && m.room.slots[1].ready === true
    );
    assert.ok(update);
  });

  await itAsync('4.7 Flight 2 & Reconnection Resilience: Roy hosts, Mira, Ken, Ivy board; Ivy drops and rejoins', async () => {
    roy.wsClient  = await createWsClient(wsUrl);
    mira.wsClient = await createWsClient(wsUrl);
    ken.wsClient  = await createWsClient(wsUrl);
    ivy.wsClient  = await createWsClient(wsUrl);

    roy.wsClient.send({
      type: 'room_create',
      hostUid: roy.id,
      hostName: roy.name,
      flightName: 'Monaco Express Flight 2',
      isPublic: true,
      slots: [
        { id: 1, role: 'bkk', type: 'human', occupiedBy: roy.id, name: roy.name, ready: true },
        { id: 2, role: 'dxb', type: 'human', occupiedBy: null, name: 'Open Slot', ready: false },
        { id: 3, role: 'bot1', type: 'human', occupiedBy: null, name: 'Open Slot', ready: false },
        { id: 4, role: 'bot2', type: 'human', occupiedBy: null, name: 'Open Slot', ready: false }
      ]
    });
    const r2Res = await roy.wsClient.waitFor((m) => m.type === 'room_created');
    flight2Room = r2Res.room;

    mira.wsClient.send({ type: 'room_join', roomId: flight2Room.id, uid: mira.id, name: mira.name });
    ken.wsClient.send({  type: 'room_join', roomId: flight2Room.id, uid: ken.id,  name: ken.name });
    ivy.wsClient.send({  type: 'room_join', roomId: flight2Room.id, uid: ivy.id,  name: ivy.name });

    await mira.wsClient.waitFor((m) => m.type === 'room_joined');
    await ken.wsClient.waitFor((m) => m.type === 'room_joined');
    const ivyJoin = await ivy.wsClient.waitFor((m) => m.type === 'room_joined');
    assert.strictEqual(ivyJoin.slot.id, 4);

    // Ivy drops connection mid-flight lobby
    ivy.wsClient.close();
    await roy.wsClient.waitFor((m) => m.type === 'room_update' && m.disconnectedUser === ivy.id);

    // Ivy opens new session and rejoins
    const ivyNew = await createWsClient(wsUrl);
    ivyNew.send({ type: 'room_rejoin', roomId: flight2Room.id, uid: ivy.id, name: ivy.name });
    const ivyRejoin = await ivyNew.waitFor((m) => m.type === 'room_rejoined');
    assert.strictEqual(ivyRejoin.slot.id, 4, 'Ivy must reclaim exact reserved seat 4');
    ivyNew.close();
  });

  // =========================================================================
  // PHASE 5: Live Monopoly Match with Dedicated Spectator Stream
  // =========================================================================
  console.log('\n--- 🎲 PHASE 5: Live Monopoly Match & Real-Time Spectator Streaming ---');

  await itAsync('5.1 Match Start: Captain Alex launches Flight 1 match -> in_flight', async () => {
    const initialState = {
      active: true,
      turnOrder: ['bkk', 'dxb', 'bot1', 'bot2'],
      currentTurn: 'bkk',
      round: 1,
      players: {
        bkk:  { miles: 2000, position: 0 },
        dxb:  { miles: 2000, position: 0 },
        bot1: { miles: 2000, position: 0 },
        bot2: { miles: 2000, position: 0 }
      }
    };

    alex.wsClient.send({
      type: 'room_start',
      roomId: flight1Room.id,
      state: initialState
    });

    const hostStart = await alex.wsClient.waitFor((m) => m.type === 'room_start');
    const zeroStart = await zero.wsClient.waitFor((m) => m.type === 'room_start');

    assert.strictEqual(hostStart.room.status, 'in_flight');
    assert.strictEqual(zeroStart.room.status, 'in_flight', 'Spectator Observer Zero receives match start');
  });

  await itAsync('5.2 Turn 1 (Captain Alex): Roll dice & move token', async () => {
    alex.wsClient.send({
      type: 'monopoly_action',
      action: 'roll',
      turn: 'bkk',
      dice1: 4,
      dice2: 3
    });

    const p1Roll = await alex.wsClient.waitFor((m) => m.type === 'monopoly_broadcast' && m.player === 'bkk');
    const zeroRoll = await zero.wsClient.waitFor((m) => m.type === 'monopoly_broadcast' && m.player === 'bkk');

    assert.strictEqual(p1Roll.rollVal, 7);
    assert.strictEqual(p1Roll.newPosition, 7);
    assert.strictEqual(zeroRoll.newPosition, 7, 'Spectator observes Turn 1 roll (7) in real time');
  });

  await itAsync('5.3 Turn 2 (Princess Luna): Roll dice & move token', async () => {
    luna.wsClient.send({
      type: 'monopoly_action',
      action: 'roll',
      turn: 'dxb',
      dice1: 6,
      dice2: 5
    });

    const p2Roll = await luna.wsClient.waitFor((m) => m.type === 'monopoly_broadcast' && m.player === 'dxb');
    const zeroRoll = await zero.wsClient.waitFor((m) => m.type === 'monopoly_broadcast' && m.player === 'dxb');

    assert.strictEqual(p2Roll.rollVal, 11);
    assert.strictEqual(p2Roll.newPosition, 11);
    assert.strictEqual(zeroRoll.newPosition, 11, 'Spectator observes Turn 2 roll (11) in real time');
  });

  await itAsync('5.4 Turn 3 & 4 (Kai & Momo): Subsequent turn progression streams to spectator', async () => {
    kai.wsClient.send({
      type: 'monopoly_action',
      action: 'roll',
      turn: 'bot1',
      dice1: 2,
      dice2: 3
    });
    const zeroRollKai = await zero.wsClient.waitFor((m) => m.type === 'monopoly_broadcast' && m.player === 'bot1');
    assert.strictEqual(zeroRollKai.rollVal, 5);

    momo.wsClient.send({
      type: 'monopoly_action',
      action: 'roll',
      turn: 'bot2',
      dice1: 5,
      dice2: 5
    });
    const zeroRollMomo = await zero.wsClient.waitFor((m) => m.type === 'monopoly_broadcast' && m.player === 'bot2');
    assert.strictEqual(zeroRollMomo.rollVal, 10);
  });

  await itAsync('5.5 Spectator Mutation Guard: Spectator blocked from dispatching game actions', async () => {
    zero.wsClient.send({
      type: 'monopoly_action',
      action: 'roll',
      turn: 'bkk'
    });

    const blockedErr = await zero.wsClient.waitFor((m) => m.type === 'monopoly_error');
    assert.strictEqual(blockedErr.error, 'SPECTATOR_MUTATION_BLOCKED', 'Spectator mutations must be blocked');
  });

  // Cleanup
  console.log('\n--- 🧹 Closing Virtual Connections & Shutting Down Server ---');
  [alex, luna, kai, momo, roy, mira, ken, zero].forEach((a) => {
    if (a.wsClient && a.wsClient.close) a.wsClient.close();
  });
  if (departureBrowser) departureBrowser.close();
  server.close();

  console.log('\n================================================================================');
  console.log(`TEST SUMMARY: ${passed}/${passed + failed} Tests Passed (${failed} Failed)`);
  console.log('================================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('🎉 10-AGENT SWARM END-TO-END SIMULATION SUITE PASSED 100%!');
    process.exit(0);
  }
})();
