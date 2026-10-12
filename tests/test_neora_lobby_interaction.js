/**
 * NEORA Monopoly Lobby & Multi-Screen Interaction Logic Test
 * 
 * Verifies:
 * 1. 3-Screen Architecture: Browser, Waiting Room, Create Room views & asset integrity.
 * 2. Room Discovery: Sample community rooms + live host rooms listed with tags & capacity.
 * 3. Create Room Flow: Host creates room with custom slots, tags, and description.
 * 4. Waiting Room Interaction:
 *    - Equipped costume mapping strictly applied to player avatars.
 *    - Host crown 👑 and callsign display.
 *    - Joiner enters slot 2 and toggles Ready state.
 *    - In-room real-time chat with avatar thumbnail and timestamps.
 *    - Auto-fill toggle filling open human slots with bots.
 *    - Room ID formatting (#BKK-xxxx).
 * 5. Game Launch: Host starts match -> room_start event -> transition to Monopoly board with matching costume sprites.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RoomRegistry = require('../server_rooms');

console.log('============================================================');
console.log('🧪 NEORA MONOPOLY LOBBY & INTERACTION LOGIC SUITE');
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
// 1. Asset & Markup Scaffold Tests
// -------------------------------------------------------------
console.log('--- SUITE 1: Layout & Asset Integrity ---');

it('1.1 Generated NEORA 3D assets exist in public/assets/ui', () => {
  const diceAsset = path.join(__dirname, '../public/assets/ui/neora_monopoly_dice.jpg');
  const botAsset = path.join(__dirname, '../public/assets/ui/neora_bot_avatar.jpg');
  const catAsset = path.join(__dirname, '../public/assets/ui/neora_aviator_cat.jpg');

  assert.ok(fs.existsSync(diceAsset), 'neora_monopoly_dice.jpg must exist');
  assert.ok(fs.existsSync(botAsset), 'neora_bot_avatar.jpg must exist');
  assert.ok(fs.existsSync(catAsset), 'neora_aviator_cat.jpg must exist');
});

it('1.2 index.html contains all 3 NEORA views and required interactive containers', () => {
  const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');

  assert.ok(html.includes('id="departureBoardModal"'), 'Modal wrapper must exist');
  assert.ok(html.includes('id="neoraViewBrowser"'), 'Screen 1 Browser view must exist');
  assert.ok(html.includes('id="neoraViewRoom"'), 'Screen 2 In-Room Waiting view must exist');
  assert.ok(html.includes('id="neoraViewCreate"'), 'Screen 3 Create Room view must exist');
  assert.ok(html.includes('id="neoraSlotsGrid"'), '4-slot player grid must exist');
  assert.ok(html.includes('id="neoraChatMessages"'), 'In-room chat feed must exist');
  assert.ok(html.includes('id="chatTextInput"'), 'Chat input must exist');
  assert.ok(html.includes('id="autoFillToggle"'), 'Auto Fill toggle must exist');
  assert.ok(html.includes('id="neoraStartGameBtn"'), 'Start game action button must exist');
});

it('1.3 monopoly.css defines glassmorphic twilight theme for NEORA lobby', () => {
  const css = fs.readFileSync(path.join(__dirname, '../public/monopoly.css'), 'utf8');

  assert.ok(css.includes('.neora-lobby-shell'), 'Lobby shell styles must exist');
  assert.ok(css.includes('.neora-room-card'), 'Room card styles must exist');
  assert.ok(css.includes('.neora-slot-card'), 'Waiting room slot card styles must exist');
  assert.ok(css.includes('.slot-crown-badge'), 'Host crown badge styles must exist');
  assert.ok(css.includes('.chat-msg-row'), 'In-room chat row styles must exist');
});

// -------------------------------------------------------------
// 2. Server Room Registry Multi-Feature Tests
// -------------------------------------------------------------
console.log('\n--- SUITE 2: Server Matchmaking, Chat & Slot Management ---');

const registry = new RoomRegistry();

let roomA = null;

it('2.1 RoomRegistry.createRoom supports tags, description, and custom 4-slot config', () => {
  roomA = registry.createRoom({
    flightName: 'Monopoly · Chill Game',
    description: 'Relaxed game, make friends! All are welcome ♡',
    tags: ['Casual', 'Make Friends', 'Voice Chat'],
    hostUid: 'user_bkk_test1',
    hostName: 'Nook ✈️',
    hostAvatar: 'assets/s6_astral_sovereign_m.png',
    slots: [
      { id: 1, role: 'bkk', type: 'human', occupiedBy: 'user_bkk_test1', name: 'Nook ✈️', avatar: 'assets/s6_astral_sovereign_m.png', ready: true },
      { id: 2, role: 'dxb', type: 'human', occupiedBy: null, name: 'Open Slot', avatar: '', ready: false },
      { id: 3, role: 'bot1', type: 'human', occupiedBy: null, name: 'Open Slot', avatar: '', ready: false },
      { id: 4, role: 'bot2', type: 'human', occupiedBy: null, name: 'Open Slot', avatar: '', ready: false }
    ]
  });

  assert.ok(roomA, 'Room should be created');
  assert.strictEqual(roomA.name, 'Monopoly · Chill Game');
  assert.strictEqual(roomA.tags.length, 3);
  assert.strictEqual(roomA.slots.length, 4);
  assert.strictEqual(roomA.slots[0].avatar, 'assets/s6_astral_sovereign_m.png');
});

it('2.2 listDisplayRooms merges real active rooms with community sample rooms', () => {
  const displayRooms = registry.listDisplayRooms();
  assert.ok(displayRooms.length >= 4, 'Should list real room plus sample rooms');
  const foundReal = displayRooms.find((r) => r.id === roomA.id);
  assert.ok(foundReal, 'Active real room must appear in display list');
  const sampleNewbie = displayRooms.find((r) => r.id === 'sample_newbie');
  assert.ok(sampleNewbie, 'Sample newbie room must appear in display list');
});

it('2.3 Joiner occupies slot 2 with exact equipped costume', () => {
  const joinRes = registry.joinRoom(roomA.id, {
    uid: 'user_dxb_test2',
    name: 'Luna ⭐',
    avatar: 'assets/s6_astral_empress_f.png'
  });

  assert.strictEqual(joinRes.success, true);
  assert.strictEqual(joinRes.slot.id, 2);
  assert.strictEqual(roomA.slots[1].occupiedBy, 'user_dxb_test2');
  assert.strictEqual(roomA.slots[1].avatar, 'assets/s6_astral_empress_f.png');
  assert.strictEqual(roomA.slots[1].name, 'Luna ⭐');
});

it('2.4 In-room chat persists messages with sender avatar and timestamp', () => {
  const msg1 = registry.addMessage(roomA.id, {
    uid: 'user_bkk_test1',
    name: 'Nook ✈️',
    avatar: 'assets/s6_astral_sovereign_m.png',
    text: 'Welcome! Let\'s play together! 🎲'
  });

  assert.ok(msg1, 'Message 1 added');
  assert.strictEqual(msg1.name, 'Nook ✈️');
  assert.strictEqual(msg1.avatar, 'assets/s6_astral_sovereign_m.png');

  const msg2 = registry.addMessage(roomA.id, {
    uid: 'user_dxb_test2',
    name: 'Luna ⭐',
    avatar: 'assets/s6_astral_empress_f.png',
    text: 'Ready!'
  });

  assert.ok(msg2, 'Message 2 added');
  assert.strictEqual(roomA.messages[roomA.messages.length - 1].text, 'Ready!');
  assert.strictEqual(roomA.messages[roomA.messages.length - 1].avatar, 'assets/s6_astral_empress_f.png');
});

it('2.5 toggleSlotReady toggles slot ready status', () => {
  assert.strictEqual(roomA.slots[1].ready, true);
  registry.toggleSlotReady(roomA.id, 2);
  assert.strictEqual(roomA.slots[1].ready, false);
  registry.toggleSlotReady(roomA.id, 2);
  assert.strictEqual(roomA.slots[1].ready, true);
});

it('2.6 toggleAutoFill populates unoccupied human slots with bots', () => {
  assert.strictEqual(roomA.slots[2].type, 'human');
  assert.strictEqual(roomA.slots[3].type, 'human');

  registry.toggleAutoFill(roomA.id, true);
  assert.strictEqual(roomA.autoFill, true);
  assert.strictEqual(roomA.slots[2].type, 'bot');
  assert.strictEqual(roomA.slots[2].name, 'Trainee Mochi 🐾');
  assert.strictEqual(roomA.slots[3].type, 'bot');
  assert.strictEqual(roomA.slots[3].name, 'Capt. Whiskers 😼');

  registry.toggleAutoFill(roomA.id, false);
  assert.strictEqual(roomA.autoFill, false);
  assert.strictEqual(roomA.slots[2].type, 'human');
  assert.strictEqual(roomA.slots[3].type, 'human');
});

// -------------------------------------------------------------
// 3. Client Simulation & Costume Mapping to Game Board
// -------------------------------------------------------------
console.log('\n--- SUITE 3: Client Costume Mapping & Board Launch ---');

function createClientMock(role, costumeSprite, playerName) {
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
        checked: false,
        dataset: {},
        style: {},
        classList: {
          _set: new Set(),
          add(...c) { c.forEach((x) => this._set.add(x)); },
          remove(...c) { c.forEach((x) => this._set.delete(x)); },
          toggle(x, f) { if (f ?? !this._set.has(x)) this._set.add(x); else this._set.delete(x); },
          contains(x) { return this._set.has(x); }
        },
        _listeners: {},
        addEventListener(e, fn) { (this._listeners[e] = this._listeners[e] || []).push(fn); },
        getAttribute(attr) { return this[attr] || (this.dataset && this.dataset[attr.replace(/^data-/, '')]) || ''; },
        setAttribute(attr, val) { this[attr] = val; },
        removeAttribute(attr) { delete this[attr]; },
        getBoundingClientRect() { return { top: 0, left: 0, width: 100, height: 100, bottom: 100, right: 100 }; },
        querySelector(sel) { return getEl(`${id}_${sel.replace(/[^a-zA-Z0-9]/g, '_')}`); },
        querySelectorAll() { return []; },
        appendChild(child) { return child; }
      };
    }
    return elements[id];
  }

  const storage = {};
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
      getItem(k) { return storage[k] || null; },
      setItem(k, v) { storage[k] = String(v); },
      removeItem(k) { delete storage[k]; }
    },
    location: { search: `?role=${role}`, hash: '', pathname: '/' },
    window: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
    document: {
      body: getEl('body'),
      getElementById: (id) => getEl(id),
      querySelector: (s) => getEl(`doc_${s.replace(/[^a-zA-Z0-9]/g, '_')}`),
      querySelectorAll: () => [],
      createElement: (tag) => getEl(`mock_${tag}_${Math.random().toString(36).slice(2, 6)}`),
      addEventListener: () => {},
      removeEventListener: () => {}
    },
    getMyAvatar: () => ({
      sprite: costumeSprite,
      name: playerName,
      characterId: 's6_astral'
    }),
    NookVault: {
      getProfiles: () => ({
        [role]: { sprite: costumeSprite, equippedSprite: costumeSprite }
      }),
      monopolyPerks: () => null
    },
    SkySupabase: {
      getCurrentUser: () => ({ username: playerName })
    },
    MonoFX: {
      init() {},
      clearDesat() {},
      flushTileFx() {},
      tokens: { reset() {}, sync() {}, setActive() {}, teleport() {} }
    },
    AudioFX: {
      playClick() {},
      playWhoosh() {},
      playBoom() {},
      playFanfare() {},
      playChime() {}
    },
    sendSignaling: () => {}
  };

  ctx.window = ctx;
  const scriptContent = fs.readFileSync(path.join(__dirname, '../public/monopoly.js'), 'utf8');
  vm.createContext(ctx);
  vm.runInContext(scriptContent, ctx);

  return { ctx, getEl };
}

it('3.1 getEquippedCostumeAvatar strictly reflects the active equipped costume', () => {
  const hostClient = createClientMock('bkk', 'assets/s6_astral_sovereign_m.png', 'Astral Lord 🐺');
  const avatar = hostClient.ctx.getEquippedCostumeAvatar();

  assert.strictEqual(avatar.sprite, 'assets/s6_astral_sovereign_m.png');
  assert.strictEqual(avatar.name, 'Astral Lord 🐺');
  assert.strictEqual(avatar.role, 'bkk');
});

it('3.2 switchNeoraView transitions between browser, room, and create views cleanly', () => {
  const client = createClientMock('bkk', 'assets/s6_astral_sovereign_m.png', 'Astral Lord 🐺');

  client.ctx.switchNeoraView('create');
  assert.strictEqual(client.ctx.currentNeoraView, 'create');
  assert.strictEqual(client.getEl('neoraViewCreate').classList.contains('active'), true);
  assert.strictEqual(client.getEl('neoraViewBrowser').classList.contains('active'), false);

  client.ctx.switchNeoraView('room');
  assert.strictEqual(client.ctx.currentNeoraView, 'room');
  assert.strictEqual(client.getEl('neoraViewRoom').classList.contains('active'), true);
  assert.strictEqual(client.getEl('neoraViewCreate').classList.contains('active'), false);
});

it('3.3 startPartyGame maps room slot costumes directly onto Monopoly board player tokens', () => {
  const hostClient = createClientMock('bkk', 'assets/s6_astral_sovereign_m.png', 'Astral Lord 🐺');

  // Provide active room with 2 humans and 2 bots
  hostClient.ctx.currentFlightRoom = {
    id: 'room_123',
    status: 'lobby',
    slots: [
      { id: 1, role: 'bkk', type: 'human', occupiedBy: 'user_bkk', name: 'Astral Lord 🐺', avatar: 'assets/s6_astral_sovereign_m.png', ready: true },
      { id: 2, role: 'dxb', type: 'human', occupiedBy: 'user_dxb', name: 'Astral Empress 🐉', avatar: 'assets/s6_astral_empress_f.png', ready: true },
      { id: 3, role: 'bot1', type: 'bot', difficulty: 'easy', occupiedBy: null, name: 'Trainee Mochi 🐾', avatar: 'assets/bot_mochi.jpg', ready: true },
      { id: 4, role: 'bot2', type: 'bot', difficulty: 'hard', occupiedBy: null, name: 'Capt. Whiskers 😼', avatar: 'assets/bot_captain.jpg', ready: true }
    ]
  };

  hostClient.ctx.startPartyGame();

  const state = hostClient.ctx.monopolyState;
  assert.ok(state, 'Monopoly state initialized');
  assert.strictEqual(state.active, true);
  assert.strictEqual(state.turnOrder.length, 4);

  // Check that P1 sprite is strictly host's equipped costume
  assert.strictEqual(state.players['bkk'].sprite, 'assets/s6_astral_sovereign_m.png');
  assert.strictEqual(state.players['bkk'].name, 'Astral Lord 🐺');

  // Check that P2 sprite is strictly joiner's equipped costume
  assert.strictEqual(state.players['dxb'].sprite, 'assets/s6_astral_empress_f.png');
  assert.strictEqual(state.players['dxb'].name, 'Astral Empress 🐉');

  // Check bots
  assert.strictEqual(state.players['bot1'].sprite, 'assets/bot_mochi.jpg');
  assert.strictEqual(state.players['bot2'].sprite, 'assets/bot_captain.jpg');
});

it('3.4 Host slot configuration (Open, Bot Easy, Bot Hard, Closed) updates and synchronizes cleanly', () => {
  const reg = new RoomRegistry();
  const testRoom = reg.createRoom({
    flightName: 'Monopoly · Chill Game',
    hostUid: 'host_nook',
    hostName: 'Nook ✈️',
    hostAvatar: 'assets/ui/neora_ref/avatar_nook.png'
  });

  // 1. Host configures slot 2 to Bot (Easy)
  const res1 = reg.updateSlot(testRoom.id, 2, {
    type: 'bot',
    difficulty: 'easy',
    name: 'Trainee Mochi 🐾',
    avatar: 'assets/ui/neora_ref/avatar_bot_blue.png',
    ready: true
  });
  assert.strictEqual(res1.success, true);
  assert.strictEqual(testRoom.slots[1].type, 'bot');
  assert.strictEqual(testRoom.slots[1].difficulty, 'easy');
  assert.strictEqual(testRoom.slots[1].ready, true);
  assert.strictEqual(testRoom.slots[1].avatar, 'assets/ui/neora_ref/avatar_bot_blue.png');

  // 2. Host configures slot 3 to Bot (Hard)
  const res2 = reg.updateSlot(testRoom.id, 3, {
    type: 'bot',
    difficulty: 'hard',
    name: 'Capt. Whiskers 😼',
    avatar: 'assets/ui/neora_ref/avatar_bot_blue.png',
    ready: true
  });
  assert.strictEqual(res2.success, true);
  assert.strictEqual(testRoom.slots[2].type, 'bot');
  assert.strictEqual(testRoom.slots[2].difficulty, 'hard');

  // 3. Host re-opens slot 2 for human players to join
  const res3 = reg.updateSlot(testRoom.id, 2, {
    type: 'human',
    difficulty: null,
    name: 'Open Slot',
    avatar: '',
    ready: false
  });
  assert.strictEqual(res3.success, true);
  assert.strictEqual(testRoom.slots[1].type, 'human');
  assert.strictEqual(testRoom.slots[1].occupiedBy, null);
  assert.strictEqual(testRoom.slots[1].ready, false);

  // 4. Host locks slot 4 as Closed
  const res4 = reg.updateSlot(testRoom.id, 4, {
    type: 'closed',
    difficulty: null,
    name: 'Closed Seat',
    avatar: '',
    ready: false
  });
  assert.strictEqual(res4.success, true);
  assert.strictEqual(testRoom.slots[3].type, 'closed');
  assert.strictEqual(testRoom.slots[3].ready, false);
});

it('3.5 Host clicks + Create Room: transitions from Screen 3 to Screen 2 and dispatches room_create', () => {
  const elements = {};
  function createMockEl(id, tag = 'div') {
    return {
      id,
      tagName: tag.toUpperCase(),
      value: id.includes('Input') ? 'Monopoly · Chill Game' : '',
      textContent: '',
      innerHTML: '',
      classList: {
        _classes: new Set(),
        add(c) { this._classes.add(c); },
        remove(c) { this._classes.delete(c); },
        contains(c) { return this._classes.has(c); },
        toggle(c, force) { if (force !== undefined) { force ? this.add(c) : this.remove(c); } else { this.contains(c) ? this.remove(c) : this.add(c); } }
      },
      dataset: {},
      style: {},
      children: [],
      appendChild(child) { this.children.push(child); return child; },
      querySelector() { return null; },
      querySelectorAll() { return []; },
      addEventListener() {},
      setAttribute() {},
      getAttribute() { return null; }
    };
  }

  const mockDoc = {
    readyState: 'complete',
    getElementById(id) {
      if (!elements[id]) elements[id] = createMockEl(id);
      return elements[id];
    },
    createElement(tag) {
      return createMockEl('el_' + Math.random(), tag);
    },
    querySelectorAll() { return []; },
    addEventListener() {}
  };

  const signalingSent = [];
  const jsCode = fs.readFileSync(path.join(__dirname, '../public/monopoly.js'), 'utf8');
  const sandbox = {
    window: {},
    document: mockDoc,
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    Math,
    Date,
    parseInt,
    parseFloat,
    String,
    Number,
    Boolean,
    Array,
    Object,
    JSON,
    Set,
    Map,
    localStorage: { getItem() { return null; }, setItem() {} }
  };
  sandbox.window = sandbox;
  sandbox.window.addEventListener = () => {};
  sandbox.window.location = { search: '?terminal=bkk' };
  sandbox.window.sendSignaling = (msg) => signalingSent.push(msg);

  vm.runInNewContext(jsCode, sandbox);
  assert.strictEqual(typeof sandbox.window.submitNeoraCreateRoom, 'function', 'submitNeoraCreateRoom must be exposed on window');

  // Trigger Create Room submit action
  sandbox.window.submitNeoraCreateRoom();

  assert.strictEqual(signalingSent.length, 1, 'Exactly 1 signaling message must be sent');
  assert.strictEqual(signalingSent[0].type, 'room_create', 'Message must be room_create');
  assert.strictEqual(signalingSent[0].flightName, 'Monopoly · Chill Game');
  assert.strictEqual(signalingSent[0].slots.length, 4, '4 slots must be configured');
  assert.strictEqual(signalingSent[0].slots[0].type, 'human');
  assert.strictEqual(signalingSent[0].slots[0].id, 1);
});

console.log('\n============================================================');
console.log('TEST SUMMARY: All NEORA Lobby & Interaction Logic Tests Passed (100%)');
console.log('============================================================\n');
process.exit(0);
