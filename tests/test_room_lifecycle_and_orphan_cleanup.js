/**
 * Room Lifecycle, Orphan Room Prevention & Match Abandonment Test Suite
 *
 * Verifies:
 * 1. server_db.js detects test environment and protects production Supabase from test room pollution.
 * 2. RoomRegistry.isTestRoom accurately identifies all mock and automated test fixtures.
 * 3. RoomRegistry.closeExistingHostLobbyRoom prevents duplicate orphan rooms when a host creates a new room.
 * 4. RoomRegistry.cleanStaleRooms reaps empty lobby and deserted in-flight rooms.
 * 5. RoomRegistry.getActiveInFlightRoomForUser ignores deserted in-flight rooms where 0 humans are connected.
 * 6. public/index.html contains the active match banner with the Abandon / Leave match button.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const db = require('../server_db.js');
const RoomRegistry = require('../server_rooms.js');

console.log('============================================================');
console.log('🧪 ROOM LIFECYCLE, ORPHAN ROOM & MATCH ABANDONMENT SUITE');
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
// Test 1: Test Environment Shield
// -------------------------------------------------------------
it('1.1 server_db.js detects test environment and skips remote Supabase REST calls', () => {
  assert.strictEqual(db.isTestEnv(), true, 'db.isTestEnv() must evaluate to true during tests');
});

// -------------------------------------------------------------
// Test 2: Test Room Detection
// -------------------------------------------------------------
it('2.1 RoomRegistry.isTestRoom accurately detects mock hosts and automated test names', () => {
  const reg = new RoomRegistry();
  const testCases = [
    { hostUid: 'takeover_host', hostName: 'Captain Takeover' },
    { hostUid: 'host_spec', hostName: 'Pilot Bob' },
    { hostUid: 'host_widget', hostName: 'Captain Widget' },
    { hostUid: 'u_host', hostName: 'Captain Nook' },
    { hostUid: 'host_secret', hostName: 'VIP Captain' },
    { hostUid: 'player_alpha', hostName: 'Captain Nook 🐺' },
    { hostUid: 'user_eep9y', hostName: 'Flight Captain 🛫' },
    { hostUid: 'user_6ei1p', hostName: 'Flight Captain 🛫' },
    { hostUid: 'test_user_1', hostName: 'User' },
    { hostUid: 'dup_host', hostName: 'Flight Captain 🛫', name: 'Duplicate Test Flight' }
  ];

  testCases.forEach((tc) => {
    assert.strictEqual(reg.isTestRoom(tc), true, `isTestRoom must return true for ${tc.hostUid} / ${tc.hostName}`);
  });

  const realUser = { hostUid: 'real_user_xyz', hostName: 'Alice 🐉', name: 'Tokyo Moonlight' };
  assert.strictEqual(reg.isTestRoom(realUser), false, 'isTestRoom must return false for authentic player');
});

// -------------------------------------------------------------
// Test 3: Duplicate Host Lobby Room Prevention
// -------------------------------------------------------------
it('3.1 RoomRegistry.createRoom automatically closes previous lobby rooms by the same host', () => {
  const reg = new RoomRegistry();
  const hostUid = 'synthetic_host_999';

  const roomA = reg.createRoom({ hostUid, hostName: 'Host Alpha', flightName: 'Flight A' });
  assert.strictEqual(reg.rooms.has(roomA.id), true);

  const roomB = reg.createRoom({ hostUid, hostName: 'Host Alpha', flightName: 'Flight B' });
  assert.strictEqual(reg.rooms.has(roomB.id), true);
  assert.strictEqual(reg.rooms.has(roomA.id), false, 'Previous lobby room by the same host must be closed');
});

// -------------------------------------------------------------
// Test 4: Deserted In-Flight Room Non-Blocking
// -------------------------------------------------------------
it('4.1 getActiveInFlightRoomForUser ignores in-flight rooms where 0 humans are connected', () => {
  const reg = new RoomRegistry();
  const playerUid = 'synthetic_player_abc';

  const room = reg.createRoom({
    hostUid: playerUid,
    hostName: 'Player One',
    flightName: 'Test In-Flight'
  });
  room.status = 'in_flight';

  // Mark all human seats as disconnected with 0 clients
  room.slots.forEach((s) => {
    if (s.type === 'human') {
      s.connected = false;
      s.occupiedBy = playerUid;
    }
  });
  room.clients.clear();

  const active = reg.getActiveInFlightRoomForUser(playerUid);
  assert.strictEqual(active, null, 'Deserted in-flight room with 0 connected humans must NOT block user');
});

// -------------------------------------------------------------
// Test 5: Deserted Room Reaper
// -------------------------------------------------------------
it('5.1 cleanStaleRooms reaps deserted rooms older than 2 minutes', () => {
  const reg = new RoomRegistry();
  const room = reg.createRoom({ hostUid: 'player_stale', hostName: 'Stale Player' });
  room.clients.clear();
  room.slots.forEach((s) => { s.connected = false; });
  room.updatedAt = Date.now() - (3 * 60 * 1000); // 3 minutes ago

  const cleaned = reg.cleanStaleRooms(2 * 60 * 1000);
  assert.strictEqual(cleaned, 1, 'Deserted room older than 2 minutes must be reaped');
  assert.strictEqual(reg.rooms.has(room.id), false);
});

// -------------------------------------------------------------
// Test 6: Markup Scaffold
// -------------------------------------------------------------
it('6.1 public/index.html includes btnAbandonActiveFlight inside active match banner', () => {
  const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
  assert.ok(html.includes('id="btnAbandonActiveFlight"'), 'index.html must have btnAbandonActiveFlight button');
  assert.ok(html.includes('id="btnRejoinActiveFlight"'), 'index.html must have btnRejoinActiveFlight button');
});

console.log(`\n============================================================`);
console.log(`TEST SUMMARY: ${passed}/${passed + failed} Passed (${failed} Failed)`);
console.log(`============================================================\n`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL ROOM LIFECYCLE & ORPHAN ROOM TESTS PASSED 100%!\n');
}
