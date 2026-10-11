/**
 * 🧪 Test Concurrency, Anti-Overshoot, and Self-Echo Guards in Sky Monopoly
 */
const fs = require('fs');
const path = require('path');

// Mock browser globals
globalThis.window = globalThis;
globalThis.window.addEventListener = () => {};
globalThis.window.removeEventListener = () => {};
globalThis.window.location = { search: '', pathname: '' };
globalThis.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {}
};
globalThis.document = {
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener: () => {},
  removeEventListener: () => {}
};
globalThis.$m = () => null;

const NookCostumes = require('../public/costumes.js');
const NookMonoRules = require('../public/monopoly_rules.js');
const NookMonoBot = require('../public/monopoly_bot.js');

globalThis.NookCostumes = NookCostumes;
globalThis.NookMonoRules = NookMonoRules;
globalThis.NookMonoBot = NookMonoBot;

// Mock MonoFX
globalThis.MonoFX = new Proxy({
  init: () => {},
  clearDesat: () => {},
  tokens: new Proxy({}, {
    get: (target, prop) => {
      if (prop === 'hop') return () => new Promise(r => setTimeout(r, 20));
      return () => Promise.resolve();
    }
  }),
  coins: () => {}
}, {
  get: (target, prop) => {
    if (prop in target) return target[prop];
    return () => Promise.resolve();
  }
});

// Load monopoly.js
const monopolySrc = fs.readFileSync(path.join(__dirname, '../public/monopoly.js'), 'utf8');
eval(monopolySrc);

let passed = 0;
let total = 0;

function assert(condition, message) {
  total++;
  if (condition) {
    passed++;
    console.log(`  ✅ [PASS] ${message}`);
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    process.exitCode = 1;
  }
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('🧪 TESTING MONOPOLY CONCURRENCY & MOVEMENT INTEGRITY');
  console.log('='.repeat(60));

  // Initialize test state
  monopolyState = createDefaultMonopolyState();
  monopolyState.active = true;
  monopolyState.players.bkk.pos = 0;

  // Test 1: Single movement from 0 with roll 6
  await new Promise((resolve) => {
    animateAvatarMove('bkk', 6, () => {
      resolve();
    });
  });
  assert(monopolyState.players.bkk.pos === 6, `Roll 6 from 0 moved strictly to pos 6 (actual: ${monopolyState.players.bkk.pos})`);
  assert(activeMoveLocks.bkk === false, 'activeMoveLocks.bkk released after completion');
  assert(activeRollLocks.bkk === false, 'activeRollLocks.bkk released after completion');

  // Test 2: Concurrent animateAvatarMove calls for same player
  // Suppose player is at tile 6 and two concurrent calls attempt to move 6 steps
  let call1Done = false;
  let call2Done = false;
  const p1 = new Promise((resolve) => {
    animateAvatarMove('bkk', 6, () => {
      call1Done = true;
      resolve();
    });
  });
  const p2 = new Promise((resolve) => {
    animateAvatarMove('bkk', 6, () => {
      call2Done = true;
      resolve();
    });
  });
  await Promise.all([p1, p2]);

  // The second concurrent call should have been blocked, so pos is strictly 12, NEVER 18 (2x overshoot)
  assert(monopolyState.players.bkk.pos === 12, `Concurrent move was blocked: pos is strictly 12, not 18 (actual: ${monopolyState.players.bkk.pos})`);

  // Test 3: Self-echo rejection in handleMonopolyMessage
  window.myMonopolyRole = 'bkk';
  let rollExecuted = false;
  const origExecuteRoll = executeRoll;
  window.executeRoll = () => { rollExecuted = true; };

  // Send roll with playerKey matching our own role (self-echo)
  handleMonopolyMessage({
    type: 'monopoly_action',
    action: 'roll',
    playerKey: 'bkk',
    rollVal: 4
  });
  assert(rollExecuted === false, 'Self-echo roll message from BKK was cleanly dropped without re-executing roll');

  // Test 4: Incoming roll while activeRollLocks is true
  activeRollLocks.dxb = true;
  handleMonopolyMessage({
    type: 'monopoly_action',
    action: 'roll',
    playerKey: 'dxb',
    rollVal: 5
  });
  assert(rollExecuted === false, 'Duplicate roll message for DXB while activeRollLocks is active was dropped');
  activeRollLocks.dxb = false;

  // Test 5: Wrapping around board from pos 18 + 6 steps = 4
  monopolyState.players.bkk.pos = 18;
  await new Promise((resolve) => {
    animateAvatarMove('bkk', 6, () => {
      resolve();
    });
  });
  assert(monopolyState.players.bkk.pos === 4, `Board wrap-around from 18 + 6 steps landed accurately on pos 4 (actual: ${monopolyState.players.bkk.pos})`);

  // Restore executeRoll
  window.executeRoll = origExecuteRoll;

  console.log('='.repeat(60));
  console.log(`RESULTS: ${passed}/${total} tests passed!`);
  console.log('='.repeat(60));
  process.exit(passed === total ? 0 : 1);
}

runTests();
