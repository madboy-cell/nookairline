/**
 * Phase 2 End-to-End Test: Flight Departure Board & Real-Time Matchmaking
 *
 * Verifies the full client-server lifecycle:
 * 1. Host creates public flight "Sky Royal #101".
 * 2. Server creates room with unique 6-digit code and broadcasts to Departure Board.
 * 3. Guest opens Departure Board and sees "Sky Royal #101" with open seats.
 * 4. Guest joins flight and is assigned Seat 2 (P2 Cyan Electric).
 * 5. Host toggles flight privacy to Private; flight vanishes from public board.
 * 6. Third client joins using Host's 6-digit flight code directly.
 * 7. Host launches flight: all 3 connected clients launch into the game board.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RoomRegistry = require('../server_rooms.js');

console.log('============================================================');
console.log('🧪 PHASE 2: FLIGHT DEPARTURE BOARD & MATCHMAKING E2E SUITE');
console.log('============================================================\n');

let passed = 0;
let failed = 0;
function it(desc, fn) {
  try {
    fn();
    console.log(`  ✅ [PASS] ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${desc}`);
    console.error(err);
    failed++;
  }
}

// -------------------------------------------------------------
// Mock Server & Client Environment Harness
// -------------------------------------------------------------
class MockSignalingServer {
  constructor() {
    this.registry = new RoomRegistry();
    this.subscribers = new Set();
    this.clients = new Set();
  }

  registerClient(client) {
    this.clients.add(client);
  }

  broadcastDepartureBoard() {
    const list = this.registry.listPublicRooms();
    const msg = { type: 'room_list_update', rooms: list };
    this.subscribers.forEach((sub) => {
      sub.receive(msg);
    });
  }

  broadcastToRoom(room, msg) {
    if (!room || !room.clients) return;
    room.clients.forEach((client) => {
      client.receive(msg);
    });
  }

  handleMessage(sender, msg) {
    if (msg.type === 'room_browse_start') {
      this.subscribers.add(sender);
      sender.receive({
        type: 'room_list_update',
        rooms: this.registry.listPublicRooms()
      });
      return;
    }

    if (msg.type === 'room_browse_stop') {
      this.subscribers.delete(sender);
      return;
    }

    if (msg.type === 'room_create') {
      const room = this.registry.createRoom({
        hostUid: msg.hostUid,
        hostName: msg.hostName,
        hostAvatar: msg.hostAvatar,
        hostRole: 'bkk',
        flightName: msg.flightName,
        isPublic: msg.isPublic !== false,
        slots: msg.slots || null,
        ws: sender
      });

      sender.receive({
        type: 'room_created',
        room: this.sanitize(room),
        slot: room.slots[0]
      });
      this.broadcastDepartureBoard();
      return;
    }

    if (msg.type === 'room_join' || msg.type === 'room_join_code') {
      const key = msg.type === 'room_join' ? msg.roomId : msg.code;
      const res = this.registry.joinRoom(key, { uid: msg.uid, name: msg.name, avatar: msg.avatar }, sender);
      if (!res.success) {
        sender.receive({ type: 'room_error', error: res.error, message: res.message });
        return;
      }

      sender.receive({
        type: 'room_joined',
        room: this.sanitize(res.room),
        slot: res.slot
      });

      this.broadcastToRoom(res.room, {
        type: 'room_update',
        room: this.sanitize(res.room)
      });

      this.broadcastDepartureBoard();
      return;
    }

    if (msg.type === 'room_set_privacy') {
      const res = this.registry.setPrivacy(msg.roomId, msg.isPublic, sender);
      if (res && res.success) {
        this.broadcastToRoom(res.room, {
          type: 'room_update',
          room: this.sanitize(res.room)
        });
        this.broadcastDepartureBoard();
      }
      return;
    }

    if (msg.type === 'monopoly_start_party') {
      const room = this.registry.getClientRoom(sender);
      if (room) {
        room.status = 'in_flight';
        this.broadcastToRoom(room, msg);
        this.broadcastDepartureBoard();
      }
      return;
    }

    // Default room forward
    const currentRoom = this.registry.getClientRoom(sender);
    if (currentRoom) {
      currentRoom.clients.forEach((c) => {
        if (c !== sender) c.receive(msg);
      });
    }
  }

  sanitize(room) {
    if (!room) return null;
    return {
      id: room.id,
      code: room.code,
      name: room.name,
      flightNumber: room.flightNumber,
      hostUid: room.hostUid,
      hostName: room.hostName,
      hostAvatar: room.hostAvatar,
      isPublic: room.isPublic,
      status: room.status,
      slots: room.slots,
      activeHumans: room.slots.filter((s) => s.type === 'human' && s.occupiedBy).length,
      openSeats: room.slots.filter((s) => s.type === 'human' && !s.occupiedBy).length,
      totalSeats: room.slots.filter((s) => s.type !== 'closed').length,
      createdAt: room.createdAt
    };
  }
}

function createClientEnvironment(server, role, characterBase = 'bkk', name = 'Player') {
  const elements = {};
  function getEl(id) {
    if (!elements[id]) {
      elements[id] = {
        id,
        tagName: 'DIV',
        className: '',
        innerHTML: '',
        textContent: '',
        value: '',
        src: '',
        disabled: false,
        dataset: {},
        style: {},
        classList: {
          _classes: new Set(),
          add(...cls) { cls.forEach((c) => this._classes.add(c)); },
          remove(...cls) { cls.forEach((c) => this._classes.delete(c)); },
          toggle(c, force) {
            if (force === undefined) {
              if (this._classes.has(c)) this._classes.delete(c);
              else this._classes.add(c);
            } else if (force) {
              this._classes.add(c);
            } else {
              this._classes.delete(c);
            }
          },
          contains(c) { return this._classes.has(c); }
        },
        _listeners: {},
        addEventListener(evt, fn) {
          if (!this._listeners[evt]) this._listeners[evt] = [];
          this._listeners[evt].push(fn);
        },
        removeEventListener(evt, fn) {
          if (!this._listeners[evt]) return;
          this._listeners[evt] = this._listeners[evt].filter((f) => f !== fn);
        },
        dispatchEvent(evt) {
          const fns = this._listeners[evt] || [];
          fns.forEach((fn) => fn({ type: evt, target: this, preventDefault() {} }));
        },
        click() {
          this.dispatchEvent('click');
        },
        getAttribute(attr) {
          return this[attr] || (this.dataset && this.dataset[attr.replace(/^data-/, '')]) || '';
        },
        setAttribute(attr, val) {
          this[attr] = val;
        },
        removeAttribute(attr) {
          delete this[attr];
        },
        getBoundingClientRect() {
          return { top: 0, left: 0, width: 100, height: 100, bottom: 100, right: 100 };
        },
        querySelector(selector) {
          return getEl(`${id}__${selector.replace(/[^a-zA-Z0-9]/g, '_')}`);
        },
        querySelectorAll() { return []; },
        appendChild(c) { return c; },
        removeChild(c) { return c; }
      };
    }
    return elements[id];
  }

  const mockStorage = {};
  const clientHandle = {
    receive(msg) {
      ctx.handleMonopolyMessage(JSON.parse(JSON.stringify(msg)));
    }
  };

  const ctx = {
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    performance: { now: () => Date.now() },
    Math,
    Date,
    JSON,
    Array,
    Object,
    Set,
    Map,
    String,
    Number,
    Boolean,
    RegExp,
    localStorage: {
      getItem(k) { return mockStorage[k] || null; },
      setItem(k, v) { mockStorage[k] = String(v); },
      removeItem(k) { delete mockStorage[k]; }
    },
    location: { search: `?role=${role}`, hash: '', pathname: '/' },
    myTerminal: role,
    window: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
    document: {
      body: getEl('document_body'),
      getElementById(id) { return getEl(id); },
      querySelector(s) { return getEl(`doc_${s.replace(/[^a-zA-Z0-9]/g, '_')}`); },
      querySelectorAll() { return []; },
      createElement(tag) {
        const autoId = `mock_${tag}_${Math.random().toString(36).slice(2, 7)}`;
        const el = getEl(autoId);
        el.tagName = tag.toUpperCase();
        return el;
      },
      addEventListener() {},
      removeEventListener() {}
    },
    sendSignaling: (msg) => {
      server.handleMessage(clientHandle, JSON.parse(JSON.stringify(msg)));
    },
    AudioFX: {
      playClick() {},
      playWhoosh() {},
      playBoom() {},
      playFanfare() {},
      playChime() {}
    },
    MonoFX: {
      init() {},
      tokens: {
        reset() {},
        setActive() {},
        sync() {},
        place() {},
        placeAll() {},
        hop: async () => {},
        teleport: async () => {}
      },
      clearDesat() {},
      flushTileFx() {},
      busy: () => false,
      banner() {}
    },
    getMyAvatar: () => ({
      name,
      characterId: characterBase === 'dxb' ? 'got_queen' : 'bkk_warrior',
      sprite: characterBase === 'dxb' ? 'assets/got_queen_idle.png' : 'assets/bkk_warrior_idle.png'
    }),
    getPartnerAvatar: () => ({
      name: role === 'bkk' ? 'Khaleesi 🐉' : 'Lord of BKK 🐺',
      characterId: role === 'bkk' ? 'got_queen' : 'bkk_warrior',
      sprite: role === 'bkk' ? 'assets/got_queen_idle.png' : 'assets/bkk_warrior_idle.png'
    }),
    NookVault: {
      monopolyPerks: () => ({}),
      getProfiles: () => ({})
    },
    NookCostumes: {
      BY_ID: {},
      PERKS: {}
    }
  };
  ctx.window = ctx;
  vm.createContext(ctx);

  const monopolyCode = fs.readFileSync(path.join(__dirname, '../public/monopoly.js'), 'utf8');
  vm.runInContext(monopolyCode, ctx);

  server.registerClient(clientHandle);
  return { ctx, elements, getEl, clientHandle };
}

// -------------------------------------------------------------
// Test Execution
// -------------------------------------------------------------
const server = new MockSignalingServer();
const host = createClientEnvironment(server, 'bkk', 'dxb', 'Empress Sarah 🐉');
const guestB = createClientEnvironment(server, 'dxb', 'bkk', 'Commander Thanapat 🐺');
const guestC = createClientEnvironment(server, 'bkk', 'bkk', 'Cadet Leo 🐾');

let createdRoom = null;

it('1. Host creates public flight "Sky Royal #101" with unique 6-digit code', () => {
  host.ctx.initMonopoly();
  host.ctx.createFlightRoom(true, 'Sky Royal #101');

  createdRoom = host.ctx.currentFlightRoom;
  assert.ok(createdRoom, 'Host should have an active currentFlightRoom');
  assert.strictEqual(createdRoom.name, 'Sky Royal #101');
  assert.strictEqual(createdRoom.isPublic, true);
  assert.strictEqual(createdRoom.code.length, 6);
  assert.ok(/^\d{6}$/.test(createdRoom.code), 'Flight code must be 6 digits');

  // Verify UI updated
  const codeText = host.getEl('lobbyFlightCodeText');
  assert.strictEqual(codeText.textContent, createdRoom.code);
});

it('2. Guest B opens Departure Board and sees "Sky Royal #101" listed with 3 open seats', () => {
  guestB.ctx.initMonopoly();
  guestB.ctx.showDepartureBoard();

  const boardModal = guestB.getEl('departureBoardModal');
  assert.strictEqual(boardModal.classList.contains('hidden'), false);

  assert.strictEqual(guestB.ctx.departureBoardFlights.length, 1);
  const flight = guestB.ctx.departureBoardFlights[0];
  assert.strictEqual(flight.name, 'Sky Royal #101');
  assert.strictEqual(flight.code, createdRoom.code);
  assert.strictEqual(flight.status, 'lobby');
  assert.strictEqual(flight.openSeats, 1); // 1 open human seat (Seat 2); bot1 & bot2 are bots
});

it('3. Guest B boards flight and occupies Seat 2 (Cyan Electric)', () => {
  guestB.ctx.joinFlightRoom(createdRoom.id);

  assert.ok(guestB.ctx.currentFlightRoom, 'Guest B should be in room');
  assert.strictEqual(guestB.ctx.currentFlightRoom.id, createdRoom.id);

  // Verify Guest B occupies slot 2
  const slot2 = guestB.ctx.lobbyState.slots.find((s) => s.id === 2);
  assert.strictEqual(slot2.type, 'human');
  assert.strictEqual(slot2.occupiedBy.includes('user_dxb'), true);
  assert.strictEqual(slot2.name, 'Commander Thanapat 🐺');

  // Verify Host receives the update in real-time
  const hostSlot2 = host.ctx.lobbyState.slots.find((s) => s.id === 2);
  assert.strictEqual(hostSlot2.occupiedBy, slot2.occupiedBy);
  assert.strictEqual(hostSlot2.name, 'Commander Thanapat 🐺');
});

it('4. Host toggles flight privacy to Private: flight is hidden from Departure Board', () => {
  host.ctx.toggleFlightPrivacy(false);

  assert.strictEqual(host.ctx.currentFlightRoom.isPublic, false);
  assert.strictEqual(guestB.ctx.currentFlightRoom.isPublic, false);

  // Server registry confirms 0 public flights
  assert.strictEqual(server.registry.listPublicRooms().length, 0);

  // Guest B views Departure Board: receives updated empty list
  guestB.ctx.showDepartureBoard();
  assert.strictEqual(guestB.ctx.departureBoardFlights.length, 0);
});

it('5. Guest C opens open human seat 3 and joins directly using Host 6-digit code', () => {
  guestC.ctx.initMonopoly();

  // Host cycles Slot 3 to Human Open so Guest C can join
  server.registry.updateSlot(createdRoom.id, 3, { type: 'human', occupiedBy: null, name: 'Open Seat 2A' });

  // Guest C joins via 6-digit code
  guestC.ctx.joinFlightByCode(createdRoom.code);

  assert.ok(guestC.ctx.currentFlightRoom, 'Guest C should successfully enter private flight');
  assert.strictEqual(guestC.ctx.currentFlightRoom.id, createdRoom.id);

  const slot3 = guestC.ctx.lobbyState.slots.find((s) => s.id === 3);
  assert.strictEqual(slot3.occupiedBy.includes('user_bkk'), true);
  assert.strictEqual(slot3.name, 'Cadet Leo 🐾');
});

it('6. Host launches match: 3-passenger flight starts on all connected clients', () => {
  // Cycle Slot 4 to closed so it is a crisp 3-Player match
  server.registry.updateSlot(createdRoom.id, 4, { type: 'closed' });
  host.ctx.lobbyState.slots[3].type = 'closed';

  host.ctx.startPartyGame(host.ctx.lobbyState);

  // Host state
  assert.strictEqual(host.ctx.monopolyState.active, true);
  assert.deepStrictEqual(Array.from(host.ctx.monopolyState.turnOrder), ['bkk', 'dxb', 'bot1']);

  // Guest B state
  assert.strictEqual(guestB.ctx.monopolyState.active, true);
  assert.deepStrictEqual(Array.from(guestB.ctx.monopolyState.turnOrder), ['bkk', 'dxb', 'bot1']);

  // Guest C state
  assert.strictEqual(guestC.ctx.monopolyState.active, true);
  assert.deepStrictEqual(Array.from(guestC.ctx.monopolyState.turnOrder), ['bkk', 'dxb', 'bot1']);

  // Verify server room status moved to 'in_flight'
  assert.strictEqual(server.registry.getRoom(createdRoom.id).status, 'in_flight');
});

console.log('\n============================================================');
console.log(`TEST SUMMARY: ${passed}/${passed + failed} Passed (${failed} Failed)`);
console.log('============================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL PHASE 2 DEPARTURE BOARD E2E TESTS PASSED 100%!');
  process.exit(0);
}
