/**
 * Test: Bot Insane Selection in NEORA Lobby & Create Room
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RoomRegistry = require('../server_rooms');

console.log('============================================================');
console.log('🧪 TEST: BOT INSANE SELECTION IN NEORA LOBBY SUITE');
console.log('============================================================\n');

function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(err);
    process.exit(1);
  }
}

// -------------------------------------------------------------
// 1. DOM Markup Validation
// -------------------------------------------------------------
runTest('1.1 index.html contains Bot Insane option in Waiting Room Popover', () => {
  const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
  assert.ok(html.includes('data-opt="insane"'), 'Popover must have data-opt="insane"');
  assert.ok(html.includes('opt-insane'), 'Popover must have opt-insane class');
  assert.ok(html.includes('Bot (Insane)'), 'Popover must display Bot (Insane) text');
});

runTest('1.2 index.html contains Bot Insane options in Create Room selects (slots 2, 3, 4)', () => {
  const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
  [2, 3, 4].forEach((slotId) => {
    const selectSnippet = html.slice(html.indexOf(`id="createSlot${slotId}Select"`), html.indexOf(`</select>`, html.indexOf(`id="createSlot${slotId}Select"`)));
    assert.ok(selectSnippet.includes('value="insane"'), `Slot ${slotId} select must have value="insane"`);
    assert.ok(selectSnippet.includes('Bot (Insane ⚡)'), `Slot ${slotId} select must display Bot (Insane ⚡)`);
  });
});

// -------------------------------------------------------------
// 2. Server RoomRegistry Logic for Bot Insane
// -------------------------------------------------------------
runTest('2.1 RoomRegistry.createRoom supports Bot Insane custom slots with mythic titles', () => {
  const registry = new RoomRegistry();
  const customSlots = [
    { id: 1, role: 'bkk', type: 'human', difficulty: null, occupiedBy: 'host_wolf', name: 'Nook ✈️', avatar: 'assets/avatar.png' },
    { id: 2, role: 'dxb', type: 'bot', difficulty: 'insane', occupiedBy: null },
    { id: 3, role: 'bot1', type: 'bot', difficulty: 'insane', occupiedBy: null },
    { id: 4, role: 'bot2', type: 'bot', difficulty: 'insane', occupiedBy: null }
  ];

  const room = registry.createRoom({
    hostUid: 'host_wolf',
    hostName: 'Nook ✈️',
    slots: customSlots
  });

  assert.ok(room && room.id);
  assert.strictEqual(room.slots[1].difficulty, 'insane');
  assert.strictEqual(room.slots[1].name, 'Astral Sovereign 🌌');
  assert.strictEqual(room.slots[1].controller, 'BOT_PERMANENT');

  assert.strictEqual(room.slots[2].difficulty, 'insane');
  assert.strictEqual(room.slots[2].name, 'Chrono Sovereign ⏳');
  assert.strictEqual(room.slots[2].controller, 'BOT_PERMANENT');

  assert.strictEqual(room.slots[3].difficulty, 'insane');
  assert.strictEqual(room.slots[3].name, 'Apex Sovereign ⚡');
  assert.strictEqual(room.slots[3].controller, 'BOT_PERMANENT');
});

runTest('2.2 Host dynamically updates slot to Bot Insane in Waiting Room', () => {
  const registry = new RoomRegistry();
  const room = registry.createRoom({
    hostUid: 'host_wolf',
    hostName: 'Nook ✈️'
  });
  const hostWs = {};
  room.clients.add(hostWs);
  room.clientData.set(hostWs, { uid: 'host_wolf', slotId: 1 });

  // Update Slot 3 to Insane
  const updateRes = registry.updateSlot(room.id, 3, { type: 'bot', difficulty: 'insane' }, hostWs);
  assert.strictEqual(updateRes.success, true);
  assert.strictEqual(room.slots[2].type, 'bot');
  assert.strictEqual(room.slots[2].difficulty, 'insane');
  assert.strictEqual(room.slots[2].name, 'Chrono Sovereign ⏳');
  assert.strictEqual(room.slots[2].controller, 'BOT_PERMANENT');
  assert.strictEqual(room.slots[2].ready, true);

  // Update Slot 4 to Insane
  const updateRes4 = registry.updateSlot(room.id, 4, { type: 'bot', difficulty: 'insane' }, hostWs);
  assert.strictEqual(updateRes4.success, true);
  assert.strictEqual(room.slots[3].type, 'bot');
  assert.strictEqual(room.slots[3].difficulty, 'insane');
  assert.strictEqual(room.slots[3].name, 'Apex Sovereign ⚡');
});

// -------------------------------------------------------------
// 3. Client Simulation: Submit Create Room with Bot Insane
// -------------------------------------------------------------
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
  let signalingPayload = null;

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
    sendSignaling: (msg) => {
      if (msg && msg.type === 'room_create') {
        signalingPayload = msg;
      }
    }
  };

  ctx.window = ctx;
  const scriptContent = fs.readFileSync(path.join(__dirname, '../public/monopoly.js'), 'utf8');
  vm.createContext(ctx);
  vm.runInContext(scriptContent, ctx);

  return { ctx, getEl, getSignalingPayload: () => signalingPayload };
}

runTest('3.1 submitNeoraCreateRoom correctly submits Bot Insane slots', () => {
  const { ctx, getEl, getSignalingPayload } = createClientMock('bkk', 'assets/wolf.png', 'Lord Wolf 🐺');

  // Pre-populate elements
  getEl('createRoomNameInput').value = 'Test Apex Flight';
  getEl('createRoomDescInput').value = 'Insane bot clash';
  getEl('createSlot2Select').value = 'insane';
  getEl('createSlot3Select').value = 'insane';
  getEl('createSlot4Select').value = 'open';

  assert.ok(typeof ctx.submitNeoraCreateRoom === 'function', 'submitNeoraCreateRoom must be defined');
  ctx.submitNeoraCreateRoom();

  const payload = getSignalingPayload();
  assert.ok(payload, 'room_create signaling message must be dispatched');
  assert.strictEqual(payload.slots.length, 4);

  // Slot 2: Bot Insane
  assert.strictEqual(payload.slots[1].type, 'bot');
  assert.strictEqual(payload.slots[1].difficulty, 'insane');
  assert.strictEqual(payload.slots[1].name, 'Astral Sovereign 🌌');

  // Slot 3: Bot Insane
  assert.strictEqual(payload.slots[2].type, 'bot');
  assert.strictEqual(payload.slots[2].difficulty, 'insane');
  assert.strictEqual(payload.slots[2].name, 'Chrono Sovereign ⏳');

  // Slot 4: Open Slot
  assert.strictEqual(payload.slots[3].type, 'human');
  assert.strictEqual(payload.slots[3].name, 'Open Slot');
});

console.log('\n============================================================');
console.log('🎉 ALL BOT INSANE SELECTION TESTS PASSED 100%!');
console.log('============================================================');
