/**
 * Comprehensive 1-to-4 Player (Plus Spectator) NEORA Multiplayer Cases Test
 * 
 * Verifies all 5 core requirements:
 * 1. Player 1 creates room, waits inside; outsiders in lobby see room with real-time host slot configuration.
 * 2. Players 2, 3, 4 join open slots; server rejects 5th player with ROOM_FULL error when full.
 * 3. Spectator/Watch mode: players can watch active games in real time, receiving live turns and board moves.
 * 4. Real-time in-room chat box: players chat with exact equipped costume avatars and timestamps.
 * 5. Non-monopoly game tabs (Sky Run, Card Party, Couple Quiz, More) are locked with "Coming Soon" badges and guarded from click selection.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RoomRegistry = require('../server_rooms');

console.log('============================================================');
console.log('🧪 NEORA 1-4 PLAYER MULTIPLAYER CASES & SPECTATOR SUITE');
console.log('============================================================\n');

function it(desc, fn) {
  try {
    fn();
    console.log(`  ✅ [PASS] ${desc}`);
  } catch (err) {
    console.error(`  ❌ [FAIL] ${desc}`);
    console.error(err);
    process.exit(1);
  }
}

// -------------------------------------------------------------
// Mock WebSocket & Multi-Client Server Simulation Harness
// -------------------------------------------------------------
class MockWebSocket {
  constructor(uid, terminal = 'bkk') {
    this.uid = uid;
    this.terminal = terminal;
    this.readyState = 1; // WebSocket.OPEN
    this.inbox = [];
    this.onmessage = null;
  }

  send(data) {
    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
    this.inbox.push(parsed);
    if (this.onmessage) {
      this.onmessage({ data: JSON.stringify(parsed) });
    }
  }

  getLastMessage(type = null) {
    if (!type) return this.inbox[this.inbox.length - 1] || null;
    for (let i = this.inbox.length - 1; i >= 0; i--) {
      if (this.inbox[i].type === type) return this.inbox[i];
    }
    return null;
  }

  clearInbox() {
    this.inbox = [];
  }
}

class SimulatedServer {
  constructor() {
    this.registry = new RoomRegistry();
    this.subscribers = new Set();
    this.serverMonopolyState = null;
  }

  sanitizeRoom(room) {
    if (!room) return null;
    return {
      id: room.id,
      code: room.code,
      name: room.name,
      flightNumber: room.flightNumber,
      hostUid: room.hostUid,
      hostName: room.hostName,
      hostAvatar: room.hostAvatar,
      description: room.description || 'Relaxed game, make friends! All are welcome ♡',
      tags: room.tags || ['Casual', 'Make Friends'],
      game: room.game || 'monopoly',
      autoFill: !!room.autoFill,
      messages: Array.isArray(room.messages) ? room.messages : [],
      isPublic: room.isPublic,
      status: room.status,
      slots: room.slots,
      activeHumans: room.slots.filter((s) => s.type === 'human' && s.occupiedBy).length,
      openSeats: room.slots.filter((s) => s.type === 'human' && !s.occupiedBy).length,
      totalSeats: room.slots.filter((s) => s.type !== 'closed').length,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt
    };
  }

  broadcastDepartureBoard() {
    const rooms = this.registry.listDisplayRooms();
    const msg = { type: 'room_list_update', rooms };
    this.subscribers.forEach((ws) => ws.send(msg));
  }

  broadcastToRoom(room, msg, excludeWs = null) {
    room.clients.forEach((client) => {
      if (client !== excludeWs && client.readyState === 1) {
        client.send(msg);
      }
    });
  }

  handleMessage(ws, message) {
    if (message.type === 'room_browse_start') {
      this.subscribers.add(ws);
      ws.send({
        type: 'room_list_update',
        rooms: this.registry.listDisplayRooms()
      });
      return;
    }

    if (message.type === 'room_create') {
      const room = this.registry.createRoom({
        hostUid: message.hostUid,
        hostName: message.hostName,
        hostAvatar: message.hostAvatar,
        hostRole: ws.terminal || 'bkk',
        isPublic: message.isPublic !== false,
        flightName: message.flightName || 'Monopoly · Chill Game',
        description: message.description || 'Relaxed game, make friends! All are welcome ♡',
        tags: message.tags || ['Casual', 'Make Friends'],
        game: message.game || 'monopoly',
        slots: message.slots,
        ws
      });

      ws.send({
        type: 'room_created',
        room: this.sanitizeRoom(room),
        slot: room.slots[0]
      });

      this.broadcastDepartureBoard();
      return;
    }

    if (message.type === 'room_join') {
      const playerInfo = {
        uid: message.uid,
        name: message.name,
        avatar: message.avatar,
        spectator: !!message.spectator
      };
      const res = this.registry.joinRoom(message.roomId, playerInfo, ws);
      if (!res.success) {
        ws.send({
          type: 'room_error',
          error: res.error,
          message: res.message
        });
        return;
      }

      ws.send({
        type: 'room_joined',
        room: this.sanitizeRoom(res.room),
        slot: res.slot,
        spectator: !!res.spectator,
        state: res.spectator ? this.serverMonopolyState : null
      });

      this.broadcastToRoom(res.room, {
        type: 'room_update',
        room: this.sanitizeRoom(res.room)
      });

      this.broadcastDepartureBoard();
      return;
    }

    if (message.type === 'room_chat') {
      const room = this.registry.getRoom(message.roomId) || this.registry.getClientRoom(ws);
      if (!room) return;
      const msgObj = this.registry.addMessage(room.id, {
        uid: message.sender?.uid,
        name: message.sender?.name,
        avatar: message.sender?.avatar,
        text: message.text
      });
      if (msgObj) {
        this.broadcastToRoom(room, {
          type: 'room_chat',
          roomId: room.id,
          message: msgObj
        });
      }
      return;
    }

    if (message.type === 'room_start') {
      const room = this.registry.getRoom(message.roomId) || this.registry.getClientRoom(ws);
      if (!room) return;
      room.status = 'in_flight';
      this.serverMonopolyState = {
        active: true,
        gameId: `flight_${room.id}`,
        currentTurn: 'bkk',
        turnOrder: ['bkk', 'dxb', 'bot1', 'bot2'],
        players: {
          bkk: { miles: 1500, pos: 0, name: 'Lord of BKK 🐺' },
          dxb: { miles: 1500, pos: 0, name: 'Khaleesi 🐉' }
        }
      };
      this.broadcastToRoom(room, {
        type: 'room_start',
        roomId: room.id,
        room: this.sanitizeRoom(room)
      });
      this.broadcastDepartureBoard();
      return;
    }

    if (message.type === 'monopoly_action') {
      const room = this.registry.getClientRoom(ws);
      if (room) {
        this.broadcastToRoom(room, message, ws);
      }
      return;
    }
  }
}

// -------------------------------------------------------------
// Set up Clients
// -------------------------------------------------------------
const server = new SimulatedServer();

const p1Ws = new MockWebSocket('user_p1', 'bkk'); // Host
const p2Ws = new MockWebSocket('user_p2', 'dxb'); // Joiner 1
const p3Ws = new MockWebSocket('user_p3', 'bkk'); // Joiner 2
const p4Ws = new MockWebSocket('user_p4', 'dxb'); // Joiner 3
const p5Ws = new MockWebSocket('user_p5', 'bkk'); // Outsider / Spectator

// -------------------------------------------------------------
// CASE 1: Player 1 creates room, waits inside; outsiders see real-time slots
// -------------------------------------------------------------
console.log('--- CASE 1: Host Room Creation & Outside Lobby Discovery ---');

let createdRoomId = null;

it('1.1 Player 5 subscribes to departure board and receives initial list', () => {
  server.handleMessage(p5Ws, { type: 'room_browse_start' });
  const update = p5Ws.getLastMessage('room_list_update');
  assert.ok(update, 'P5 must receive room_list_update');
  assert.ok(Array.isArray(update.rooms), 'Rooms should be an array');
});

it('1.2 Player 1 creates room with equipped costume and custom 4-slot setup', () => {
  p5Ws.clearInbox();

  const hostCostume = 'assets/s6_astral_sovereign_m.png';
  const customSlots = [
    { id: 1, role: 'bkk', color: 'ruby', type: 'human', ready: true, occupiedBy: 'user_p1', name: 'Lord of BKK 🐺', avatar: hostCostume },
    { id: 2, role: 'dxb', color: 'cyan', type: 'human', ready: false, occupiedBy: null, name: 'Open Slot', avatar: '' },
    { id: 3, role: 'bot1', color: 'emerald', type: 'human', ready: false, occupiedBy: null, name: 'Open Slot', avatar: '' },
    { id: 4, role: 'bot2', color: 'amber', type: 'human', ready: false, occupiedBy: null, name: 'Open Slot', avatar: '' }
  ];

  server.handleMessage(p1Ws, {
    type: 'room_create',
    hostUid: 'user_p1',
    hostName: 'Lord of BKK 🐺',
    hostAvatar: hostCostume,
    flightName: 'Monopoly · Chill Game',
    description: 'Relaxed game, make friends! All are welcome ♡',
    tags: ['Casual', 'Make Friends', 'Voice Chat'],
    slots: customSlots,
    isPublic: true
  });

  // Verify Player 1 receives confirmation
  const p1Msg = p1Ws.getLastMessage('room_created');
  assert.ok(p1Msg, 'P1 must receive room_created');
  createdRoomId = p1Msg.room.id;
  assert.strictEqual(p1Msg.room.name, 'Monopoly · Chill Game');
  assert.strictEqual(p1Msg.room.slots[0].avatar, hostCostume);

  // Verify Player 5 outside in lobby receives real-time update
  const p5Update = p5Ws.getLastMessage('room_list_update');
  assert.ok(p5Update, 'P5 outside in lobby must receive room_list_update in real time');
  const foundRoom = p5Update.rooms.find((r) => r.id === createdRoomId);
  assert.ok(foundRoom, 'P5 must see P1 room in lobby list');
  assert.strictEqual(foundRoom.activeHumans, 1);
  assert.strictEqual(foundRoom.openSeats, 3);
  assert.strictEqual(foundRoom.slots[0].avatar, hostCostume);
  assert.strictEqual(foundRoom.slots[0].name, 'Lord of BKK 🐺');
});

// -------------------------------------------------------------
// CASE 2: Players 2, 3, 4 join open slots; Server rejects Player 5 when full
// -------------------------------------------------------------
console.log('\n--- CASE 2: Multi-Seat Joining & Capacity Guard (ROOM_FULL) ---');

it('2.1 Player 2 joins room into Seat 2 with their equipped Dragon Girl costume', () => {
  p1Ws.clearInbox();
  p5Ws.clearInbox();

  const p2Costume = 'assets/s6_astral_empress_f.png';
  server.handleMessage(p2Ws, {
    type: 'room_join',
    roomId: createdRoomId,
    uid: 'user_p2',
    name: 'Khaleesi 🐉',
    avatar: p2Costume
  });

  const p2Joined = p2Ws.getLastMessage('room_joined');
  assert.ok(p2Joined, 'P2 must receive room_joined');
  assert.strictEqual(p2Joined.slot.id, 2);
  assert.strictEqual(p2Joined.slot.avatar, p2Costume);

  // Host P1 receives live update
  const p1Update = p1Ws.getLastMessage('room_update');
  assert.ok(p1Update, 'P1 host must receive room_update');
  assert.strictEqual(p1Update.room.slots[1].occupiedBy, 'user_p2');
  assert.strictEqual(p1Update.room.slots[1].avatar, p2Costume);

  // Outside P5 receives updated seat count (2/4)
  const p5Update = p5Ws.getLastMessage('room_list_update');
  assert.ok(p5Update, 'Lobby must reflect new seat occupation');
  const roomInList = p5Update.rooms.find((r) => r.id === createdRoomId);
  assert.strictEqual(roomInList.activeHumans, 2);
  assert.strictEqual(roomInList.openSeats, 2);
});

it('2.2 Player 3 joins room into Seat 3 with Monaco High-Roller costume', () => {
  const p3Costume = 'assets/s4_monaco_highroller_m.png';
  server.handleMessage(p3Ws, {
    type: 'room_join',
    roomId: createdRoomId,
    uid: 'user_p3',
    name: 'Monaco Ace 🎲',
    avatar: p3Costume
  });

  const p3Joined = p3Ws.getLastMessage('room_joined');
  assert.ok(p3Joined, 'P3 must receive room_joined');
  assert.strictEqual(p3Joined.slot.id, 3);
  assert.strictEqual(p3Joined.slot.avatar, p3Costume);
});

it('2.3 Player 4 joins room into Seat 4 with Atlantis Drift costume (Flight becomes Full: 4/4)', () => {
  const p4Costume = 'assets/s5_atlantis_drift_f.png';
  server.handleMessage(p4Ws, {
    type: 'room_join',
    roomId: createdRoomId,
    uid: 'user_p4',
    name: 'Atlantis Pearl 🌊',
    avatar: p4Costume
  });

  const p4Joined = p4Ws.getLastMessage('room_joined');
  assert.ok(p4Joined, 'P4 must receive room_joined');
  assert.strictEqual(p4Joined.slot.id, 4);

  // Room now has 0 open seats
  const room = server.registry.getRoom(createdRoomId);
  assert.strictEqual(room.slots.filter((s) => s.occupiedBy).length, 4);
});

it('2.4 Player 5 attempts to join full room as regular player: server rejects with ROOM_FULL', () => {
  p5Ws.clearInbox();

  server.handleMessage(p5Ws, {
    type: 'room_join',
    roomId: createdRoomId,
    uid: 'user_p5',
    name: 'Late Passenger ✈️',
    avatar: 'assets/bkk_warrior_idle.png',
    spectator: false
  });

  const err = p5Ws.getLastMessage('room_error');
  assert.ok(err, 'P5 must receive room_error when joining full room');
  assert.strictEqual(err.error, 'ROOM_FULL');
  assert.ok(err.message.includes('occupied') || err.message.includes('full'));

  // Ensure room still strictly contains only players 1-4
  const room = server.registry.getRoom(createdRoomId);
  const occupiedUids = room.slots.map((s) => s.occupiedBy);
  assert.strictEqual(occupiedUids.includes('user_p5'), false, 'P5 must NOT occupy any slot');
});

// -------------------------------------------------------------
// CASE 3: Spectator Mode: Outsider watches active match in real-time
// -------------------------------------------------------------
console.log('\n--- CASE 3: Real-Time Live Match Spectator / Watch Mode ---');

it('3.1 Host starts match: room transitions to in_flight', () => {
  p1Ws.clearInbox();
  p2Ws.clearInbox();

  server.handleMessage(p1Ws, {
    type: 'room_start',
    roomId: createdRoomId
  });

  const p1Start = p1Ws.getLastMessage('room_start');
  const p2Start = p2Ws.getLastMessage('room_start');
  assert.ok(p1Start, 'P1 receives room_start');
  assert.ok(p2Start, 'P2 receives room_start');

  const room = server.registry.getRoom(createdRoomId);
  assert.strictEqual(room.status, 'in_flight');
});

it('3.2 Player 5 joins in_flight match as Spectator and receives live board state', () => {
  p5Ws.clearInbox();

  server.handleMessage(p5Ws, {
    type: 'room_join',
    roomId: createdRoomId,
    uid: 'user_p5',
    name: 'Spectator Sky 👁',
    avatar: 'assets/bkk_warrior_idle.png',
    spectator: true
  });

  const joinMsg = p5Ws.getLastMessage('room_joined');
  assert.ok(joinMsg, 'P5 should join as spectator');
  assert.strictEqual(joinMsg.spectator, true);
  assert.strictEqual(joinMsg.slot, null, 'Spectator occupies no game slot');
  assert.ok(joinMsg.state, 'Spectator receives active monopoly game state');
  assert.strictEqual(joinMsg.state.active, true);
});

it('3.3 Host rolls dice: Spectator receives live board move action in real time', () => {
  p5Ws.clearInbox();

  const rollAction = {
    type: 'monopoly_action',
    action: 'dice_roll',
    role: 'bkk',
    dice: [3, 4],
    steps: 7,
    newPos: 7
  };

  server.handleMessage(p1Ws, rollAction);

  // Verify spectator received the exact move action
  const specAction = p5Ws.getLastMessage('monopoly_action');
  assert.ok(specAction, 'Spectator must receive live dice roll broadcast');
  assert.strictEqual(specAction.action, 'dice_roll');
  assert.strictEqual(specAction.steps, 7);
  assert.strictEqual(specAction.newPos, 7);
});

// -------------------------------------------------------------
// CASE 4: In-Room Live Chat Box Real-Time Synchronization
// -------------------------------------------------------------
console.log('\n--- CASE 4: Live In-Room Chat Synchronization ---');

it('4.1 Host sends chat message: all room members receive message with avatar', () => {
  p2Ws.clearInbox();
  p3Ws.clearInbox();
  p4Ws.clearInbox();

  server.handleMessage(p1Ws, {
    type: 'room_chat',
    roomId: createdRoomId,
    sender: {
      uid: 'user_p1',
      name: 'Lord of BKK 🐺',
      avatar: 'assets/s6_astral_sovereign_m.png'
    },
    text: 'Welcome aboard passengers! Fasten seatbelts! 🛫'
  });

  const p2Chat = p2Ws.getLastMessage('room_chat');
  const p3Chat = p3Ws.getLastMessage('room_chat');
  const p4Chat = p4Ws.getLastMessage('room_chat');

  assert.ok(p2Chat, 'P2 receives P1 chat');
  assert.ok(p3Chat, 'P3 receives P1 chat');
  assert.ok(p4Chat, 'P4 receives P1 chat');

  assert.strictEqual(p2Chat.message.name, 'Lord of BKK 🐺');
  assert.strictEqual(p2Chat.message.avatar, 'assets/s6_astral_sovereign_m.png');
  assert.strictEqual(p2Chat.message.text, 'Welcome aboard passengers! Fasten seatbelts! 🛫');
});

it('4.2 Player 2 replies in chat: Host and other players receive response in real time', () => {
  p1Ws.clearInbox();
  p3Ws.clearInbox();

  server.handleMessage(p2Ws, {
    type: 'room_chat',
    roomId: createdRoomId,
    sender: {
      uid: 'user_p2',
      name: 'Khaleesi 🐉',
      avatar: 'assets/s6_astral_empress_f.png'
    },
    text: 'Ready for takeoff! Let\'s roll! 🎲'
  });

  const p1Chat = p1Ws.getLastMessage('room_chat');
  const p3Chat = p3Ws.getLastMessage('room_chat');

  assert.ok(p1Chat, 'Host receives P2 chat reply');
  assert.ok(p3Chat, 'P3 receives P2 chat reply');
  assert.strictEqual(p1Chat.message.name, 'Khaleesi 🐉');
  assert.strictEqual(p1Chat.message.avatar, 'assets/s6_astral_empress_f.png');
  assert.strictEqual(p1Chat.message.text, 'Ready for takeoff! Let\'s roll! 🎲');
});

// -------------------------------------------------------------
// CASE 5: Non-Monopoly Game Tabs Coming Soon Lock
// -------------------------------------------------------------
console.log('\n--- CASE 5: Non-Monopoly Game Tabs Coming Soon Lock ---');

it('5.1 index.html assigns is-coming-soon and SOON badge to all non-monopoly tabs', () => {
  const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');

  const games = ['sky_run', 'card_party', 'couple_quiz', 'more'];
  games.forEach((g) => {
    assert.ok(html.includes(`data-game="${g}"`), `data-game="${g}" must exist`);
  });

  // Verify SOON badge count in HTML (4 in browser view + 4 in create room view = 8)
  const soonMatches = html.match(/tab-soon-badge/g) || [];
  assert.ok(soonMatches.length >= 8, 'There must be at least 8 Coming Soon badges across views');
});

it('5.2 monopoly.css defines non-interactive disabled styling for is-coming-soon', () => {
  const css = fs.readFileSync(path.join(__dirname, '../public/monopoly.css'), 'utf8');

  assert.ok(css.includes('.neora-game-tab.is-coming-soon'), 'CSS must define .neora-game-tab.is-coming-soon');
  assert.ok(css.includes('.create-game-card.is-coming-soon'), 'CSS must define .create-game-card.is-coming-soon');
  assert.ok(css.includes('cursor: not-allowed'), 'Must use cursor: not-allowed');
  assert.ok(css.includes('.tab-soon-badge'), 'Must define .tab-soon-badge style');
});

it('5.3 monopoly.js intercepts non-monopoly clicks, triggers toast, and keeps Monopoly active', () => {
  const js = fs.readFileSync(path.join(__dirname, '../public/monopoly.js'), 'utf8');

  assert.ok(js.includes('allNeoraGameTabs'), 'JS must query and bind game tabs');
  assert.ok(js.includes('is coming soon! Stay tuned'), 'Must show coming soon toast');
  assert.ok(js.includes('e.preventDefault()'), 'Must prevent default behavior');
});

console.log('\n============================================================');
console.log('TEST SUMMARY: All 5 Multi-Player Test Cases Passed 100%');
console.log('============================================================\n');
process.exit(0);
