/**
 * 🧪 Test Suite: Solo Flight vs Coupled Partner Avatar Presence & Warm Hug Logic
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('============================================================');
console.log('🧪 SUITE: SOLO FLIGHT PARTNER PRESENCE & WARM HUG TEST');
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
    process.exit(1);
  }
}

// 1. Static HTML Assertions
console.log('--- SUITE 1: DOM Markup Scaffold in index.html ---');
const indexHtml = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');

it('1.1 index.html hides partnerAvatar by default', () => {
  assert.ok(indexHtml.includes('id="partnerAvatar"'), 'partnerAvatar exists in HTML');
  assert.ok(
    indexHtml.includes('class="avatar-entity idle hidden"') ||
    indexHtml.includes('style="display: none;"'),
    'partnerAvatar has hidden class or display: none by default'
  );
});

// 2. Sandbox VM Execution
console.log('\n--- SUITE 2: Avatar Stage Presence & Solo Warm Hug Sandbox ---');

class MockElement {
  constructor(id = '', tag = 'div') {
    this.id = id;
    this.tagName = tag.toUpperCase();
    this.classes = new Set();
    this.classList = {
      add: (...cls) => cls.forEach(c => this.classes.add(c)),
      remove: (...cls) => cls.forEach(c => this.classes.delete(c)),
      contains: (c) => this.classes.has(c),
      has: (c) => this.classes.has(c),
      toggle: (c, force) => {
        if (typeof force === 'boolean') {
          if (force) this.classes.add(c); else this.classes.delete(c);
          return force;
        }
        if (this.classes.has(c)) { this.classes.delete(c); return false; }
        this.classes.add(c); return true;
      }
    };
    this.style = {
      setProperty: (k, v) => { this.style[k] = v; }
    };
    this.innerHTML = '';
    this.textContent = '';
    this.listeners = new Map();
  }
  addEventListener(event, fn) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event).push(fn);
  }
  removeEventListener(event, fn) {
    if (this.listeners.has(event)) {
      this.listeners.set(event, this.listeners.get(event).filter(f => f !== fn));
    }
  }
  dispatchEvent(event) {
    const list = this.listeners.get(event.type) || [];
    for (const fn of list) fn(event);
  }
  closest() { return null; }
  appendChild(child) { return child; }
  remove() {}
  querySelector(sel) {
    if (!this._children) this._children = new Map();
    if (!this._children.has(sel)) this._children.set(sel, new MockElement('', 'span'));
    return this._children.get(sel);
  }
  querySelectorAll() { return []; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 400, height: 600 }; }
}

const elements = new Map();
function getOrCreate(id) {
  if (!elements.has(id)) elements.set(id, new MockElement(id));
  return elements.get(id);
}

const windowListeners = new Map();
const mockWindow = {
  document: {
    getElementById: (id) => getOrCreate(id),
    createElement: (tag) => new MockElement('', tag),
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
    removeEventListener: () => {},
    body: new MockElement('body'),
    hidden: false
  },
  localStorage: {
    getItem: () => null,
    setItem: () => {}
  },
  location: {
    pathname: '/bkk',
    search: ''
  },
  navigator: {
    vibrate: () => {}
  },
  addEventListener: (ev, fn) => {
    if (!windowListeners.has(ev)) windowListeners.set(ev, []);
    windowListeners.get(ev).push(fn);
  },
  dispatchEvent: (ev) => {
    const list = windowListeners.get(ev.type) || [];
    for (const fn of list) fn(ev);
  },
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  setInterval: setInterval,
  clearInterval: clearInterval,
  Date: Date,
  Math: Math,
  console: console,
  URLSearchParams: URLSearchParams,
  nookPartnerOnline: false,
  SkySupabase: {
    coupleStatus: { isCouple: false, partner: null },
    isCouple: () => false,
    getProfile: () => ({ username: 'Nook' })
  }
};
mockWindow.window = mockWindow;

const context = vm.createContext(mockWindow);
const avatarJsContent = fs.readFileSync(path.join(__dirname, '../public/avatar.js'), 'utf8');
vm.runInContext(avatarJsContent, context);

it('2.1 isPartnerActive returns false when unlinked and no peer connected', () => {
  assert.strictEqual(context.isPartnerActive(), false, 'isPartnerActive() must be false');
});

it('2.2 initAvatarStage leaves partnerAvatar hidden on solo flight', () => {
  context.initAvatarStage();
  const partnerEl = elements.get('partnerAvatar');
  assert.strictEqual(partnerEl.style.display, 'none', 'partnerAvatar style.display must be none');
  assert.ok(partnerEl.classList.has('hidden'), 'partnerAvatar must contain hidden class');
});

it('2.3 triggerWarmHug executes triggerSoloWarmHug when partner is not active', () => {
  assert.strictEqual(typeof context.triggerSoloWarmHug, 'function');
  context.triggerWarmHug(true);
  const myEl = elements.get('myAvatar');
  assert.ok(myEl.classList.has('happy-bounce'), 'myAvatar should bounce happily in solo hug');
  const vignette = elements.get('hugScreenVignette');
  assert.ok(vignette.classList.has('active'), 'Screen warmth vignette activates');
});

it('2.4 updatePartnerPresence(true) unhides partner avatar when partner boards', () => {
  context.updatePartnerPresence(true);
  const partnerEl = elements.get('partnerAvatar');
  assert.strictEqual(partnerEl.style.display, '', 'partnerAvatar style.display should be empty');
  assert.strictEqual(partnerEl.classList.has('hidden'), false, 'partnerAvatar should not have hidden class');
});

it('2.5 updatePartnerPresence(false) re-hides partner avatar on disconnect', () => {
  context.mockWindow = context;
  context.nookPartnerOnline = false;
  context.SkySupabase.coupleStatus = { isCouple: false, partner: null };
  context.updatePartnerPresence(false);
  const partnerEl = elements.get('partnerAvatar');
  assert.strictEqual(partnerEl.style.display, 'none', 'partnerAvatar style.display should be none');
  assert.ok(partnerEl.classList.has('hidden'), 'partnerAvatar should have hidden class');
});

console.log('\n--- SUITE 3: Couple Features Gating (Daily, Vault, Cat Lounge, Rewards) ---');

// 3.1 Rewards Pool Gating
const rewardsJs = fs.readFileSync(path.join(__dirname, '../public/rewards.js'), 'utf8');
const rewardsContext = vm.createContext({
  window: {},
  module: { exports: {} },
  exports: {}
});
rewardsContext.window = rewardsContext;
vm.runInContext(rewardsJs, rewardsContext);
const Rewards = rewardsContext.NookRewards || rewardsContext.module.exports;

it('3.1 Rewards questsFor filters out couple-gated quests when flying solo', () => {
  const soloQuests = Rewards.questsFor('2026-10-12', 'bkk', { cats: true, couple: false });
  const coupleGated = ['hug6', 'call20', 'call45', 'envelope1'];
  for (const q of soloQuests) {
    assert.strictEqual(coupleGated.includes(q.id), false, `Quest ${q.id} requires a couple but was offered to solo player!`);
  }
});

// 3.2 Daily Flight Log Solo Gating
const dailyJs = fs.readFileSync(path.join(__dirname, '../public/daily.js'), 'utf8');
assert.ok(dailyJs.includes('soloStreakCard'), 'daily.js contains soloStreakCard');
assert.ok(dailyJs.includes('soloCallCard'), 'daily.js contains soloCallCard');
assert.ok(dailyJs.includes('Couple Streak & Shared Chests Locked'), 'daily.js contains Couple Streak Locked Banner');
assert.ok(dailyJs.includes('🔒 Together Time (Couple Only)'), 'daily.js contains Together Time couple lock');

it('3.2 daily.js renders solo attendance streak and gates Together Time for couples', () => {
  assert.ok(dailyJs.includes('if (!sv.isPair)'), 'daily.js branches to soloStreakCard when isPair is false');
  assert.ok(dailyJs.includes('if (!isPair) {\n      return soloCallCard();'), 'daily.js branches to soloCallCard when isPair is false');
});

// 3.3 Red Envelope Gating in Vault
const vaultJs = fs.readFileSync(path.join(__dirname, '../public/vault.js'), 'utf8');
assert.ok(vaultJs.includes('vault-gift-locked'), 'vault.js toggles vault-gift-locked when couple is unlinked');
assert.ok(vaultJs.includes('Couple Gifting Locked'), 'vault.js renders Couple Gifting Locked screen');

it('3.3 vault.js blocks envelope sending and reflects locked status when unlinked', () => {
  assert.ok(vaultJs.includes('if (!isCoupleActive())'), 'vault.js gates submitEnvelope when couple is inactive');
  assert.ok(vaultJs.includes('Gifting Red Envelopes is exclusive to linked couples'), 'vault.js updates tooltip for unlinked players');
});

// 3.4 Cat Lounge Solo Companion Bond & Handoff Gating
const catloungeJs = fs.readFileSync(path.join(__dirname, '../public/catlounge.js'), 'utf8');
assert.ok(catloungeJs.includes('soloBondData'), 'catlounge.js contains soloBondData');
assert.ok(catloungeJs.includes('cl-bond-solo'), 'catlounge.js renders cl-bond-solo');
assert.ok(catloungeJs.includes('Couple Shift Handoff Locked'), 'catlounge.js displays Couple Shift Handoff Locked');

it('3.4 catlounge.js renders personal affection bond and gates shift handoff for solo flyers', () => {
  assert.ok(catloungeJs.includes('if (!isCoupleActive()) return;'), 'catlounge.js gates couple bonuses when unlinked');
  assert.ok(catloungeJs.includes('Purrst Class Sanctuary 🐾'), 'catlounge.js displays solo sanctuary title');
});

// 3.5 Server Authority Gating
const serverCatsJs = fs.readFileSync(path.join(__dirname, '../server_cats.js'), 'utf8');
it('3.5 server_cats.js accepts features and suppresses partner bonuses and broadcasts when solo', () => {
  assert.ok(serverCatsJs.includes('features'), 'server_cats.js accepts features parameter');
  assert.ok(serverCatsJs.includes('if (!isCouple()) return [];'), 'checkHandoff returns empty array when isCouple() is false');
});

console.log('\n============================================================');
console.log(`TEST SUMMARY: ${passed}/11 Passed (0 Failed)`);
console.log('============================================================\n');
console.log('🎉 ALL SOLO FLIGHT PARTNER PRESENCE & FEATURE GATING TESTS PASSED 100%!');
process.exit(0);
