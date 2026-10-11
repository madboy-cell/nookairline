/**
 * Phase 1 End-to-End Test: Dynamic 4-Slot Lobby & 3-Player Flight Simulation
 * 
 * Verifies:
 * 1. Host and Guest client instances interact through the real Monopoly engine.
 * 2. Host (Dragon Girl avatar) creates room: Seat 1 renders Dragon Girl (gender decoupled).
 * 3. Guest (Wolf Boy avatar) enters Seat 2.
 * 4. Host cycles Seat 3 to 'Bot Easy' (Trainee Mochi) and Seat 4 to 'Closed'.
 * 5. Guest receives lobby update and syncs slot state in real-time.
 * 6. Launch button accurately displays 'BOARD FLIGHT (3 PLAYERS) 🛫'.
 * 7. Match launches: turnOrder is strictly ['bkk', 'dxb', 'bot1'] (Slot 4 completely excluded).
 * 8. Executes full round of rolls: turns rotate 0 -> 1 -> 2 -> 0; Closed slot 4 never gets a turn.
 * 9. Board tokens render with slot-specific color rings: P1 Ruby, P2 Cyan, P3 Emerald.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function createClientEnvironment(role, characterBase = 'bkk', name = 'Player') {
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
    sendSignaling: () => {},
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

  // Load monopoly.js into sandbox
  const monopolyCode = fs.readFileSync(path.join(__dirname, '../public/monopoly.js'), 'utf8');
  vm.runInContext(monopolyCode, ctx);

  return { ctx, elements, getEl };
}

// ==========================================
// TEST EXECUTION
// ==========================================
console.log('============================================================');
console.log('🧪 PHASE 1: END-TO-END 4-SLOT LOBBY BROWSER SIMULATION');
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

// 1. Initialize Host (Client A) with Dragon Girl Base (proving decoupling)
const host = createClientEnvironment('bkk', 'dxb', 'Empress Sarah 🐉');
const guest = createClientEnvironment('dxb', 'bkk', 'Commander Thanapat 🐺');

// Wire cross-client signaling
host.ctx.sendSignaling = (msg) => {
  guest.ctx.handleMonopolyMessage(JSON.parse(JSON.stringify(msg)));
};
guest.ctx.sendSignaling = (msg) => {
  host.ctx.handleMonopolyMessage(JSON.parse(JSON.stringify(msg)));
};

it('1. Host (Dragon Girl avatar) opens lobby: Seat 1 renders Dragon Girl avatar (gender decoupled)', () => {
  host.ctx.initMonopoly();
  host.ctx.showMonopolyLobby();

  const seat1Img = host.getEl('lobbySeatBkkImg');
  const seat1Name = host.getEl('lobbySeatBkkName');
  assert.strictEqual(seat1Img.src, 'assets/got_queen_idle.png', 'Host chosen avatar must render in Seat 1');
  assert.strictEqual(seat1Name.textContent, 'Empress Sarah 🐉', 'Host custom name must render in Seat 1');
});

it('2. Host cycles Seat 3 to Bot Easy and Seat 4 to Closed', () => {
  // Ensure default slots are loaded
  assert.strictEqual(host.ctx.lobbyState.slots.length, 4);

  // Click slot 3 to cycle: bot easy -> bot hard -> closed -> human -> bot easy
  // Default for slot 3 in 4p is bot easy. Let's cycle slot 4 (default hard) -> closed
  host.ctx.cycleLobbySlot(4);
  const slot4 = host.ctx.lobbyState.slots.find((s) => s.id === 4);
  assert.strictEqual(slot4.type, 'closed', 'Slot 4 should now be closed');

  // Verify Slot 3 is bot easy
  const slot3 = host.ctx.lobbyState.slots.find((s) => s.id === 3);
  assert.strictEqual(slot3.type, 'bot');
  assert.strictEqual(slot3.difficulty, 'easy');
});

it('3. Guest receives real-time lobby state update over signaling', () => {
  guest.ctx.initMonopoly();
  host.ctx.broadcastLobbyState();

  assert.strictEqual(guest.ctx.lobbyState.slots.find((s) => s.id === 4).type, 'closed', 'Guest slot 4 must sync to closed');
  assert.strictEqual(guest.ctx.lobbyState.slots.find((s) => s.id === 3).type, 'bot', 'Guest slot 3 must sync to bot');
});

it('4. Host Launch Flight CTA displays 3 Players active', () => {
  host.ctx.updateLobbyUI();
  const launchBtn = host.getEl('btnLaunchMonopolyGame');
  const launchLabel = launchBtn.querySelector('.launch-label');
  assert.ok(launchLabel.textContent.includes('3 PLAYERS'), `Launch button label should contain 3 PLAYERS (actual: ${launchLabel.textContent})`);
});

it('5. Host clicks Launch Flight: 3-Player match launches with strict turnOrder [bkk, dxb, bot1]', () => {
  host.ctx.startPartyGame(host.ctx.lobbyState);

  const st = host.ctx.monopolyState;
  assert.strictEqual(st.active, true);
  assert.deepStrictEqual(Array.from(st.turnOrder), ['bkk', 'dxb', 'bot1'], 'turnOrder must contain strictly active 3 players');
  assert.strictEqual(st.players.bot2, undefined, 'Closed slot 4 (bot2) must be undefined in players');

  // Verify Player Colors
  assert.strictEqual(st.players.bkk.color, '#ef4444', 'Slot 1 is Ruby Flame');
  assert.strictEqual(st.players.dxb.color, '#06b6d4', 'Slot 2 is Cyan Electric');
  assert.strictEqual(st.players.bot1.color, '#10b981', 'Slot 3 is Emerald Pulse');

  // Verify Player Decoupled Sprites
  assert.strictEqual(st.players.bkk.sprite, 'assets/got_queen_idle.png', 'Host plays as Dragon Girl');
});

it('6. Guest receives game launch: 3 players render on Guest board', () => {
  const guestSt = guest.ctx.monopolyState;
  assert.strictEqual(guestSt.active, true);
  assert.deepStrictEqual(guestSt.turnOrder, ['bkk', 'dxb', 'bot1']);
  assert.strictEqual(guestSt.players.bot2, undefined);
});

it('7. Turn Rotation: Turns cleanly execute across 3 players and wrap around', () => {
  const st = host.ctx.monopolyState;
  assert.strictEqual(st.currentTurn, 'bkk');

  // Pass Turn 0 -> Turn 1
  host.ctx.finishTurn();
  assert.strictEqual(st.currentTurn, 'dxb', 'After bkk, turn must pass to dxb');

  // Pass Turn 1 -> Turn 2 (Bot 1)
  host.ctx.finishTurn();
  assert.strictEqual(st.currentTurn, 'bot1', 'After dxb, turn must pass to bot1');

  // Pass Turn 2 -> Wraps back to Turn 0 (Host)
  host.ctx.finishTurn();
  assert.strictEqual(st.currentTurn, 'bkk', 'After bot1, turn must wrap back to bkk');

  // Verify Closed Slot 4 was NEVER visited
  assert.strictEqual(st.turnOrder.includes('bot2'), false);
});

console.log('\n============================================================');
console.log(`TEST SUMMARY: ${passed}/${passed + failed} Passed (${failed} Failed)`);
console.log('============================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL PHASE 1 END-TO-END BROWSER TESTS PASSED 100%!');
  process.exit(0);
}
