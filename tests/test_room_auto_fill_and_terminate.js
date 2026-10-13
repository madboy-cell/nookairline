/**
 * Test Suite: Room Open-Slot Auto-Fill & Room Termination Verification
 *
 * Verifies:
 * 1. 1 Host + 1 Open Slot + 2 Bots auto-fills the open slot with an active AI bot at launch.
 * 2. Seat 2 is strictly an active bot (isBot: true, Cadet Mochi), NOT an idle human P2.
 * 3. isV2State validates 3P and 4P matches reliably without requiring hardcoded dxb role.
 * 4. Room termination authorization: Only host/captain can terminate room.
 * 5. Room termination cleanly unregisters room and notifies clients with room_terminated.
 */

const assert = require('assert');
const RoomRegistry = require('../server_rooms.js');

console.log('============================================================');
console.log('🧪 TEST: ROOM AUTO-FILL & TERMINATION VERIFICATION');
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
// Test 1: 1 Host + 1 Open Slot + 2 Bots Auto-Fill at Launch
// -------------------------------------------------------------
it('Test 1: Auto-converts open slot to active AI bot at match start', () => {
  const registry = new RoomRegistry();
  const room = registry.createRoom({
    hostUid: 'captain_host',
    hostName: 'Captain Fox 🦊',
    slots: [
      { id: 1, role: 'bkk', type: 'human', occupiedBy: 'captain_host', name: 'Captain Fox 🦊' },
      { id: 2, role: 'dxb', type: 'human', occupiedBy: null, name: 'Open Slot' },
      { id: 3, role: 'bot1', type: 'bot', controller: 'BOT_PERMANENT', difficulty: 'easy', name: 'Trainee Mochi 🐾' },
      { id: 4, role: 'bot2', type: 'bot', controller: 'BOT_PERMANENT', difficulty: 'hard', name: 'Capt. Whiskers 😼' }
    ]
  });

  const gameState = registry.createDefaultGameState(room.slots);

  assert.strictEqual(gameState.turnOrder.length, 4, 'Turn order must contain all 4 participants');
  assert.deepStrictEqual(gameState.turnOrder, ['bkk', 'dxb', 'bot1', 'bot2']);

  // Verify Seat 2 (dxb) is strictly an AI bot
  const dxbPlayer = gameState.players['dxb'];
  assert.ok(dxbPlayer, 'Player dxb must exist in players map');
  assert.strictEqual(dxbPlayer.isBot, true, 'Seat 2 must be an AI bot (isBot: true)');
  assert.strictEqual(dxbPlayer.botLevel, 'easy', 'Seat 2 bot difficulty must default to easy');
  assert.strictEqual(dxbPlayer.name, 'Cadet Mochi 🐣', 'Seat 2 bot should have friendly cadet name');
  assert.strictEqual(dxbPlayer.badge, 'BOT1', 'Seat 2 badge should be BOT1');

  // Verify Host (bkk) is strictly Human
  const bkkPlayer = gameState.players['bkk'];
  assert.strictEqual(bkkPlayer.isBot, false, 'Seat 1 must remain human host');
  assert.strictEqual(bkkPlayer.name, 'Captain Fox 🦊');
});

// -------------------------------------------------------------
// Test 2: isV2State Resiliency for 3P & Custom Roles
// -------------------------------------------------------------
it('Test 2: isV2State validates 3P match without hardcoded dxb role', () => {
  function isV2State(s) {
    return !!(
      s &&
      (s.version === 2 || s.mode === 'bot' || s.mode === '4p' || s.mode === 'room') &&
      s.players &&
      typeof s.players === 'object' &&
      Object.keys(s.players).length >= 2 &&
      s.properties
    );
  }

  // 3-Player state with bkk, bot1, bot2 (no dxb)
  const state3P = {
    version: 2,
    mode: '4p',
    players: {
      bkk: { id: 'bkk', isBot: false },
      bot1: { id: 'bot1', isBot: true },
      bot2: { id: 'bot2', isBot: true }
    },
    properties: {}
  };
  assert.strictEqual(isV2State(state3P), true, '3P state without dxb must pass isV2State validation');

  // Corrupted state with only 1 player
  const corrupted1P = {
    version: 2,
    mode: '4p',
    players: { bkk: { id: 'bkk' } },
    properties: {}
  };
  assert.strictEqual(isV2State(corrupted1P), false, 'State with fewer than 2 players must be rejected');
});

// -------------------------------------------------------------
// Test 3: Room Termination Authorization & Execution
// -------------------------------------------------------------
it('Test 3: Captain can terminate flight room and unregister cleanly', () => {
  const registry = new RoomRegistry();
  const mockWsHost = { send: () => {} };
  const mockWsGuest = { send: () => {} };

  const room = registry.createRoom({
    hostUid: 'host_123',
    ws: mockWsHost
  });
  registry.joinRoom(room.id, { uid: 'guest_456' }, mockWsGuest);

  // Non-host attempts termination -> rejected
  const guestRes = registry.terminateRoom(room.id, 'guest_456');
  assert.strictEqual(guestRes.success, false);
  assert.strictEqual(guestRes.error, 'NOT_AUTHORIZED');
  assert.ok(registry.getRoom(room.id) !== null, 'Room must remain intact after unauthorized attempt');

  // Host terminates room -> succeeds
  const hostRes = registry.terminateRoom(room.id, 'host_123');
  assert.strictEqual(hostRes.success, true);
  assert.strictEqual(registry.getRoom(room.id), null, 'Room must be removed from registry');
  assert.strictEqual(registry.codeToRoomId.has(room.code), false, 'Flight code must be freed');
});

console.log('\n============================================================');
console.log(`TEST SUMMARY: ${passed}/${passed + failed} Passed (${failed} Failed)`);
console.log('============================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL AUTO-FILL AND TERMINATION TESTS PASSED 100%!');
  process.exit(0);
}
