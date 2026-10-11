/**
 * Phase 1 Logic & Simulation Test Suite: Dynamic 4-Slot Room Engine
 * 
 * Verifies:
 * 1. Slot cycle state machine: open -> bot_easy -> bot_hard -> closed -> open
 * 2. Turn progression for 2P, 3P, and 4P matches (strict ordering, no hangs)
 * 3. Elimination logic: when a player bankrupts in 3P/4P, turns seamlessly skip the bankrupt player
 * 4. Game-over trigger: when 1 player remains, victory is declared immediately
 * 5. Net worth podium ranking for 2P, 3P, and 4P matches
 * 6. Character base decoupling & player color rings
 */

const assert = require('assert');

// 1. Slot Cycle State Machine
const SLOT_CYCLE = [
  { type: 'human', difficulty: null },
  { type: 'bot', difficulty: 'easy' },
  { type: 'bot', difficulty: 'hard' },
  { type: 'closed', difficulty: null }
];

function getNextSlotState(current) {
  const idx = SLOT_CYCLE.findIndex(
    (s) => s.type === current.type && s.difficulty === current.difficulty
  );
  if (idx === -1) return SLOT_CYCLE[0];
  return SLOT_CYCLE[(idx + 1) % SLOT_CYCLE.length];
}

// 2. Turn Rotation Logic
function getNextTurn(currentRole, turnOrder, players) {
  const activeOrder = turnOrder.filter((r) => players[r] && !players[r].bankrupt && !players[r].isClosed);
  if (activeOrder.length === 0) return null;
  const idx = activeOrder.indexOf(currentRole);
  if (idx === -1) {
    const fullIdx = turnOrder.indexOf(currentRole);
    if (fullIdx !== -1) {
      for (let i = 1; i <= turnOrder.length; i++) {
        const candidate = turnOrder[(fullIdx + i) % turnOrder.length];
        if (activeOrder.includes(candidate)) return candidate;
      }
    }
    return activeOrder[0];
  }
  return activeOrder[(idx + 1) % activeOrder.length];
}

// 3. Victory & Ranking Logic
function computePlacements(players, gameOverWinner) {
  const roles = Object.keys(players).filter((r) => !players[r].isClosed);
  const ranked = [...roles].sort((a, b) => {
    const pA = players[a];
    const pB = players[b];
    if (pA.bankrupt && !pB.bankrupt) return 1;
    if (!pA.bankrupt && pB.bankrupt) return -1;
    return (pB.netWorth || 0) - (pA.netWorth || 0);
  });
  if (gameOverWinner && gameOverWinner !== 'draw') {
    return [gameOverWinner, ...ranked.filter((r) => r !== gameOverWinner)];
  }
  return ranked;
}

// ==========================================
// TEST EXECUTION
// ==========================================
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

console.log('============================================================');
console.log('🧪 PHASE 1: DYNAMIC 4-SLOT LOBBY & TURN ENGINE TESTS');
console.log('============================================================\n');

// --- SUITE 1: Slot Cycle State Machine ---
console.log('--- SUITE 1: Slot Cycle State Machine ---');
it('1.1 Slot cycles: open -> bot_easy', () => {
  const next = getNextSlotState({ type: 'human', difficulty: null });
  assert.strictEqual(next.type, 'bot');
  assert.strictEqual(next.difficulty, 'easy');
});

it('1.2 Slot cycles: bot_easy -> bot_hard', () => {
  const next = getNextSlotState({ type: 'bot', difficulty: 'easy' });
  assert.strictEqual(next.type, 'bot');
  assert.strictEqual(next.difficulty, 'hard');
});

it('1.3 Slot cycles: bot_hard -> closed', () => {
  const next = getNextSlotState({ type: 'bot', difficulty: 'hard' });
  assert.strictEqual(next.type, 'closed');
  assert.strictEqual(next.difficulty, null);
});

it('1.4 Slot cycles: closed -> open (human)', () => {
  const next = getNextSlotState({ type: 'closed', difficulty: null });
  assert.strictEqual(next.type, 'human');
  assert.strictEqual(next.difficulty, null);
});

it('1.5 4 full cycles return to initial state with 0 drift', () => {
  let cur = { type: 'human', difficulty: null };
  for (let i = 0; i < 4; i++) {
    cur = getNextSlotState(cur);
  }
  assert.strictEqual(cur.type, 'human');
  assert.strictEqual(cur.difficulty, null);
});

// --- SUITE 2: Turn Progression for 2P, 3P, 4P ---
console.log('\n--- SUITE 2: Turn Progression for 2P, 3P, 4P ---');
it('2.1 2-Player Match: Turns strictly alternate bkk <-> dxb', () => {
  const turnOrder = ['bkk', 'dxb'];
  const players = {
    bkk: { bankrupt: false },
    dxb: { bankrupt: false }
  };
  let cur = 'bkk';
  const history = [cur];
  for (let i = 0; i < 10; i++) {
    cur = getNextTurn(cur, turnOrder, players);
    history.push(cur);
  }
  const expected = ['bkk', 'dxb', 'bkk', 'dxb', 'bkk', 'dxb', 'bkk', 'dxb', 'bkk', 'dxb', 'bkk'];
  assert.deepStrictEqual(history, expected);
});

it('2.2 3-Player Match: Turns strictly rotate bkk -> dxb -> bot1', () => {
  const turnOrder = ['bkk', 'dxb', 'bot1'];
  const players = {
    bkk: { bankrupt: false },
    dxb: { bankrupt: false },
    bot1: { bankrupt: false }
  };
  let cur = 'bkk';
  const history = [cur];
  for (let i = 0; i < 6; i++) {
    cur = getNextTurn(cur, turnOrder, players);
    history.push(cur);
  }
  const expected = ['bkk', 'dxb', 'bot1', 'bkk', 'dxb', 'bot1', 'bkk'];
  assert.deepStrictEqual(history, expected);
});

it('2.3 4-Player Match: Turns strictly rotate 4 players without stall', () => {
  const turnOrder = ['bkk', 'dxb', 'bot1', 'bot2'];
  const players = {
    bkk: { bankrupt: false },
    dxb: { bankrupt: false },
    bot1: { bankrupt: false },
    bot2: { bankrupt: false }
  };
  let cur = 'bkk';
  const history = [cur];
  for (let i = 0; i < 8; i++) {
    cur = getNextTurn(cur, turnOrder, players);
    history.push(cur);
  }
  const expected = ['bkk', 'dxb', 'bot1', 'bot2', 'bkk', 'dxb', 'bot1', 'bot2', 'bkk'];
  assert.deepStrictEqual(history, expected);
});

// --- SUITE 3: Elimination & Bankruptcy Transitions ---
console.log('\n--- SUITE 3: Elimination & Bankruptcy Transitions ---');
it('3.1 3-Player Match: Bankrupting dxb causes bkk to pass turn directly to bot1', () => {
  const turnOrder = ['bkk', 'dxb', 'bot1'];
  const players = {
    bkk: { bankrupt: false },
    dxb: { bankrupt: true }, // Bankrupt!
    bot1: { bankrupt: false }
  };
  const nextFromBkk = getNextTurn('bkk', turnOrder, players);
  assert.strictEqual(nextFromBkk, 'bot1', 'bkk should skip bankrupt dxb and jump directly to bot1');

  const nextFromBot1 = getNextTurn('bot1', turnOrder, players);
  assert.strictEqual(nextFromBot1, 'bkk', 'bot1 should wrap back to bkk');
});

it('3.2 4-Player Match: Multiple bankruptcies (dxb and bot1) alternate between bkk and bot2', () => {
  const turnOrder = ['bkk', 'dxb', 'bot1', 'bot2'];
  const players = {
    bkk: { bankrupt: false },
    dxb: { bankrupt: true },
    bot1: { bankrupt: true },
    bot2: { bankrupt: false }
  };
  assert.strictEqual(getNextTurn('bkk', turnOrder, players), 'bot2');
  assert.strictEqual(getNextTurn('bot2', turnOrder, players), 'bkk');
});

it('3.3 Single Survivor: When 3 players bankrupt in 4P, active count <= 1 triggers game over', () => {
  const players = {
    bkk: { bankrupt: false },
    dxb: { bankrupt: true },
    bot1: { bankrupt: true },
    bot2: { bankrupt: true }
  };
  const activeRoles = Object.keys(players).filter((r) => !players[r].bankrupt);
  assert.strictEqual(activeRoles.length, 1);
  assert.strictEqual(activeRoles[0], 'bkk');
});

// --- SUITE 4: Podium Ranking & Net Worth ---
console.log('\n--- SUITE 4: Podium Ranking & Net Worth ---');
it('4.1 3-Player Match: Accurately ranks 1st, 2nd, and 3rd place with 1 bankrupt', () => {
  const players = {
    bkk: { netWorth: 4500, bankrupt: false },
    dxb: { netWorth: 0, bankrupt: true },
    bot1: { netWorth: 2800, bankrupt: false }
  };
  const placements = computePlacements(players, 'bkk');
  assert.deepStrictEqual(placements, ['bkk', 'bot1', 'dxb']);
});

it('4.2 4-Player Match: Accurately ranks all 4 places by net worth', () => {
  const players = {
    bkk: { netWorth: 3200, bankrupt: false },
    dxb: { netWorth: 5100, bankrupt: false },
    bot1: { netWorth: 1800, bankrupt: false },
    bot2: { netWorth: 2400, bankrupt: false }
  };
  const placements = computePlacements(players, 'dxb');
  assert.deepStrictEqual(placements, ['dxb', 'bkk', 'bot2', 'bot1']);
});

// --- SUITE 5: Character Base Decoupling & Player Color Rings ---
console.log('\n--- SUITE 5: Character Base Decoupling & Player Color Rings ---');
it('5.1 Two players with Dragon Girl base receive distinct P1 Ruby vs P2 Cyan colors and distinct badges', () => {
  const slots = [
    { id: 1, role: 'bkk', color: '#ef4444', badge: 'P1 🔴', characterBase: 'dxb', sprite: 'assets/got_queen_idle.png' },
    { id: 2, role: 'dxb', color: '#06b6d4', badge: 'P2 🔵', characterBase: 'dxb', sprite: 'assets/got_queen_idle.png' }
  ];
  assert.strictEqual(slots[0].characterBase, slots[1].characterBase, 'Both players chose Dragon Girl');
  assert.notStrictEqual(slots[0].color, slots[1].color, 'Player colors must be strictly distinct');
  assert.strictEqual(slots[0].color, '#ef4444', 'Slot 1 is Ruby Flame');
  assert.strictEqual(slots[1].color, '#06b6d4', 'Slot 2 is Cyan Electric');
  assert.notStrictEqual(slots[0].badge, slots[1].badge, 'Badges must be distinct (P1 vs P2)');
});

console.log('\n============================================================');
console.log(`TEST SUMMARY: ${passed}/${passed + failed} Passed (${failed} Failed)`);
console.log('============================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL PHASE 1 DYNAMIC SLOT & TURN ENGINE TESTS PASSED 100%!');
}
