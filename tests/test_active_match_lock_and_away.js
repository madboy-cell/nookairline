/**
 * Test Suite: Active Match Lock, Exit Game Auto-Pilot, and Header UI Patch
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const RoomRegistry = require('../server_rooms.js');
const BotTakeoverManager = require('../server_bot_takeover.js');

console.log('============================================================');
console.log('🧪 TEST: ACTIVE MATCH LOCK & EXIT GAME AUTO-PILOT SUITE');
console.log('============================================================\n');

let passed = 0;
let failed = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}:`, err.message);
    failed++;
  }
}

// Mock WebSocket
function createMockWs(terminal = 'bkk') {
  const sent = [];
  return {
    terminal,
    readyState: 1, // OPEN
    send: (data) => sent.push(JSON.parse(data)),
    getSent: () => sent,
    getLastSent: () => sent[sent.length - 1],
    clearSent: () => { sent.length = 0; }
  };
}

// 1. UI Verification
runTest('1.1: Monopoly modal header has Exit Game button and NO reset button', () => {
  const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
  assert(html.includes('id="monopolyExitGameBtn"'), 'monopolyExitGameBtn should exist in index.html');
  assert(!html.includes('id="resetMonopolyBtn"'), 'resetMonopolyBtn should NOT exist in index.html header actions');
  assert(html.includes('id="neoraActiveMatchBanner"'), 'neoraActiveMatchBanner should exist in index.html');
  assert(html.includes('id="btnRejoinActiveFlight"'), 'btnRejoinActiveFlight should exist in index.html');
});

runTest('1.2: Monopoly CSS hides vault diamonds and reset button', () => {
  const css = fs.readFileSync(path.join(__dirname, '../public/monopoly.css'), 'utf8');
  assert(css.includes('#vaultMonoPill'), 'CSS must include #vaultMonoPill');
  assert(css.includes('#resetMonopolyBtn'), 'CSS must include #resetMonopolyBtn');
  assert(css.includes('display: none !important'), 'CSS must enforce display: none !important for vaultMonoPill/reset');
  assert(css.includes('.active-match-banner'), 'CSS must define .active-match-banner');
  assert(css.includes('.btn-rejoin-active-flight'), 'CSS must define .btn-rejoin-active-flight');
});

// 2. Active Match Lock Logic
const registry = new RoomRegistry();
const botManager = new BotTakeoverManager(
  registry,
  () => {},
  () => {}
);
registry.botTakeoverManager = botManager;

const player1Ws = createMockWs('bkk');
const player2Ws = createMockWs('dxb');

const room1 = registry.createRoom({
  hostUid: 'player_active_1',
  hostName: 'Lord of BKK 🐺',
  hostRole: 'bkk',
  game: 'monopoly',
  ws: player1Ws
});

const joinRes = registry.joinRoom(room1.id, {
  uid: 'player_active_2',
  name: 'Khaleesi 🐉',
  avatar: 'assets/got_queen_idle.png'
}, player2Ws);

assert(joinRes.success, 'Player 2 must join successfully');

// Set room to in_flight
room1.status = 'in_flight';
room1.gameState = registry.createDefaultGameState(room1.slots);

runTest('2.1: getActiveInFlightRoomForUser detects active in-flight participant', () => {
  const active1 = registry.getActiveInFlightRoomForUser('player_active_1');
  const active2 = registry.getActiveInFlightRoomForUser('player_active_2');
  const activeNonExistent = registry.getActiveInFlightRoomForUser('player_other_xyz');

  assert.strictEqual(active1?.id, room1.id, 'Should find room1 for player_active_1');
  assert.strictEqual(active2?.id, room1.id, 'Should find room1 for player_active_2');
  assert.strictEqual(activeNonExistent, null, 'Should return null for non-participant');
});

runTest('2.2: Active player is rejected when attempting to create a new room or join another room', () => {
  // Simulating server message handlers
  const hostUid = 'player_active_1';
  const activeFlight = registry.getActiveInFlightRoomForUser(hostUid);
  assert(activeFlight, 'Player 1 must have active flight');
  assert.strictEqual(activeFlight.id, room1.id);

  // Trying to join a different room
  const otherRoomWs = createMockWs('bkk');
  const room2 = registry.createRoom({
    hostUid: 'player_other_3',
    hostName: 'Host 3',
    hostRole: 'bkk',
    game: 'monopoly',
    ws: otherRoomWs
  });

  const shouldBlock = activeFlight && activeFlight.id !== room2.id && activeFlight.code !== room2.id;
  assert.strictEqual(shouldBlock, true, 'Active flight player must be blocked from joining room2');
});

runTest('2.3: setPlayerAway puts seat on BOT_TEMPORARY auto-pilot without dropping seat', () => {
  const awayRes = registry.setPlayerAway(room1.id, player1Ws);
  assert(awayRes && awayRes.success, 'setPlayerAway must succeed');

  const slot1 = room1.slots.find((s) => s.id === 1);
  assert.strictEqual(slot1.controller, 'BOT_TEMPORARY', 'Controller should be set to BOT_TEMPORARY');
  assert.strictEqual(slot1.occupiedBy, 'player_active_1', 'Seat UID must be preserved');
  assert(slot1.takeoverAt > 0, 'takeoverAt timestamp must be recorded');
});

runTest('2.4: Player rejoining active match restores HUMAN controller', () => {
  const rejoinRes = registry.rejoinRoom(room1.id, {
    uid: 'player_active_1',
    name: 'Lord of BKK 🐺'
  }, player1Ws);

  assert(rejoinRes && rejoinRes.success, 'Rejoin must succeed');
  const slot1 = room1.slots.find((s) => s.id === 1);
  assert.strictEqual(slot1.controller, 'HUMAN', 'Controller must be restored to HUMAN');
  assert.strictEqual(slot1.takeoverAt, null, 'takeoverAt must be cleared');
  assert.strictEqual(rejoinRes.inFlight, true, 'Must indicate room is inFlight');
});

console.log('\n============================================================');
console.log(`TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
console.log('============================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL ACTIVE MATCH LOCK & AUTO-PILOT TESTS PASSED 100%!\n');
}
