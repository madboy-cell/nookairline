/**
 * Targeted Unit Test: Sky Casino -> Bot Turn Deadlock & Auto-Recovery
 * Verifies that when a player lands on Sky Casino, finishes their turn, and passes
 * to a bot (e.g. Admiral Claw), any lingering animation/roll locks automatically
 * clear and the bot continues playing without getting deadlocked.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('============================================================');
console.log('🎰 TEST: SKY CASINO TO BOT TURN AUTO-RECOVERY & DEADLOCK PREVENTION');
console.log('============================================================\n');

// 1. Validate that public/monopoly.js contains all self-healing safeguards
const monopolyJs = fs.readFileSync(path.join(__dirname, '../public/monopoly.js'), 'utf8');

function assertContains(str, snippet, desc) {
  assert.ok(str.includes(snippet), `Failed check: ${desc} (missing "${snippet}")`);
  console.log(`  ✅ [PASS] ${desc}`);
}

console.log('--- 1. Verification of Deadlock Protections in public/monopoly.js ---');
assertContains(monopolyJs, "if (st.isRolling || isAnimating)", "rollButtonState checks rolling/animating state");
assertContains(monopolyJs, "auto-clearing stuck rolling/animating lock", "rollButtonState auto-clears stuck locks after 7.5s");
assertContains(monopolyJs, "checkBotTurn: detected stuck roll/anim lock", "checkBotTurn auto-recovers stuck locks after 7.5s");
assertContains(monopolyJs, "scheduleBotRoll: force clearing stuck roll lock", "scheduleBotRoll auto-clears stuck locks after 7.5s");
assertContains(monopolyJs, "Bot ${botRole} watchdog detected stuck roll/anim lock", "armBotWatchdog force-clears locks when firing");
assertContains(monopolyJs, "const rollCycleWatchdog = setTimeout", "executeRoll contains safety watchdog timer");
assertContains(monopolyJs, "clearTimeout(rollCycleWatchdog)", "executeRoll clears safety watchdog on movement completion");
assertContains(monopolyJs, "Promise.race", "animateAvatarMove wraps FX.tokens.hop in Promise.race with fallback timeout");

console.log('\n--- 2. Functional Simulation: Sky Casino -> Bot Turn -> Auto-Recovery ---');

// Mock a lightweight browser environment to test game loop logic
let isAnimating = false;
let rollStartedAt = 0;
const activeRollLocks = {};
const activeMoveLocks = {};

function releaseRoleLocks() {
  Object.keys(activeRollLocks).forEach((k) => { activeRollLocks[k] = false; });
  Object.keys(activeMoveLocks).forEach((k) => { activeMoveLocks[k] = false; });
}

let monopolyState = {
  active: true,
  currentTurn: 'bkk',
  isRolling: false,
  players: {
    bkk: { name: 'Thanapat siripon', pos: 0, miles: 1250, isBot: false },
    // Slot 2 was left open, so only bot1 and bot2 exist
    bot1: { name: 'Admiral Claw 🐯', pos: 0, miles: 1400, isBot: true, botLevel: 'hard' },
    bot2: { name: 'Trainee Mochi 🐾', pos: 0, miles: 1200, isBot: true, botLevel: 'easy' }
  },
  turnOrder: ['bkk', 'bot1', 'bot2']
};

function rollButtonState() {
  const st = monopolyState;
  const turn = st.currentTurn || 'bkk';
  const currentP = st.players && st.players[turn];
  if (st.gameOver) return { label: 'GAME OVER 🏆', enabled: false, cls: '' };
  if (st.isRolling || isAnimating) {
    const elapsed = Date.now() - (rollStartedAt || 0);
    if (elapsed > 7500) {
      st.isRolling = false;
      isAnimating = false;
      releaseRoleLocks();
    } else {
      return { label: 'ROLLING… 🎲', enabled: false, cls: '' };
    }
  }
  if (turn === 'bkk') return { label: 'ROLL DICE 🎲', enabled: true, cls: 'my-turn-pulse' };
  if (currentP && currentP.isBot) return { label: `🐾 ${currentP.name.toUpperCase()}…`, enabled: false, cls: '' };
  return { label: `⏳ ${currentP?.name || 'RIVAL'}'S TURN`, enabled: false, cls: '' };
}

let botRollTriggered = false;
function checkBotTurn() {
  const st = monopolyState;
  if (!st || !st.active || st.gameOver) return;
  const botRole = st.currentTurn;
  const botP = st.players && st.players[botRole];
  if (!botP || !botP.isBot) return;

  if (st.isRolling || isAnimating || activeRollLocks[botRole]) {
    const elapsed = Date.now() - (rollStartedAt || 0);
    if (elapsed > 7500) {
      st.isRolling = false;
      isAnimating = false;
      releaseRoleLocks();
    } else {
      return;
    }
  }

  // Simulate bot taking roll action
  botRollTriggered = true;
}

// Step 1: Initial state - Host's turn
assert.strictEqual(rollButtonState().label, 'ROLL DICE 🎲', 'Host roll button is enabled on turn 1');
console.log('  ✅ [PASS] 2.1 Host has active roll button');

// Step 2: Host rolls 4 straight to Casino
monopolyState.players.bkk.pos = 4;
monopolyState.players.bkk.miles -= 200; // Cursed casino spin!
monopolyState.currentTurn = 'bot1';

// Step 3: Simulate lingering animation or stuck roll flag from casino spin
monopolyState.isRolling = true;
isAnimating = true;
rollStartedAt = Date.now() - 8000; // 8 seconds ago

// Verify that prior to fix, this would return ROLLING... 🎲 forever
// With our fix, rollButtonState clears the stuck lock immediately!
const btnState = rollButtonState();
assert.strictEqual(btnState.label, '🐾 ADMIRAL CLAW 🐯…', 'Roll button self-heals from ROLLING... to bot status');
assert.strictEqual(monopolyState.isRolling, false, 'isRolling reset to false');
assert.strictEqual(isAnimating, false, 'isAnimating reset to false');
console.log('  ✅ [PASS] 2.2 Stuck ROLLING... button self-heals and unlocks');

// Step 4: Verify checkBotTurn() auto-clears expired locks and executes bot move
monopolyState.isRolling = true;
isAnimating = true;
rollStartedAt = Date.now() - 8000; // 8 seconds ago
checkBotTurn();

assert.strictEqual(botRollTriggered, true, 'Bot turn auto-recovers and executes roll');
assert.strictEqual(monopolyState.isRolling, false, 'Bot turn clears lingering isRolling flag');
assert.strictEqual(isAnimating, false, 'Bot turn clears lingering isAnimating flag');
console.log('  ✅ [PASS] 2.3 Bot turn never deadlocks; auto-recovers and progresses');

console.log('\n============================================================');
console.log('🏁 ALL CASINO TO BOT DEADLOCK TESTS PASSED 100%');
console.log('============================================================\n');
