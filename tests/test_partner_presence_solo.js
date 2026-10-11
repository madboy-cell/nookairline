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

console.log('\n============================================================');
console.log(`TEST SUMMARY: ${passed}/6 Passed (0 Failed)`);
console.log('============================================================\n');
console.log('🎉 ALL SOLO FLIGHT PARTNER PRESENCE TESTS PASSED 100%!');
process.exit(0);
