/**
 * Phase 2 Unit & Concurrency Test: Room Registry & Flight Matchmaking Engine
 *
 * Verifies:
 * 1. Room Code Uniqueness: 10,000 codes generated with 0 collisions.
 * 2. Privacy Filtering: Public rooms appear on Departure Board; Private flights remain hidden.
 * 3. Capacity Guard: Rejects joins with ROOM_FULL when all human seats are occupied.
 * 4. Host Disconnect & Migration: Migrates host privileges cleanly to remaining passenger.
 * 5. Deserted Room Cleanup: Completely removes empty rooms and frees codes.
 * 6. Code Lookup: 6-digit flight code joins accurately assign open seats.
 * 7. Stale Room Sweeper: Cleans up abandoned rooms beyond threshold.
 */

const assert = require('assert');
const RoomRegistry = require('../server_rooms.js');

console.log('============================================================');
console.log('🧪 PHASE 2: FLIGHT ROOM REGISTRY & MATCHMAKING LOGIC SUITE');
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
// Test 2.1: Room Code Uniqueness
// -------------------------------------------------------------
it('Test 2.1: Generates 10,000 unique 6-digit room codes with zero collisions', () => {
  const registry = new RoomRegistry();
  const seenCodes = new Set();
  const iterations = 10000;

  for (let i = 0; i < iterations; i++) {
    const code = registry.generateRoomCode();
    assert.strictEqual(code.length, 6, `Code must be exactly 6 characters (got ${code})`);
    assert.ok(/^\d{6}$/.test(code), `Code must be 6 numeric digits (got ${code})`);
    assert.strictEqual(seenCodes.has(code), false, `Code collision detected: ${code}`);
    seenCodes.add(code);
    registry.codeToRoomId.set(code, `room_${i}`);
  }
  assert.strictEqual(seenCodes.size, iterations);
});

// -------------------------------------------------------------
// Test 2.2: Privacy Filtering on Departure Board
// -------------------------------------------------------------
it('Test 2.2: Departure Board lists only public flights and hides private flights', () => {
  const registry = new RoomRegistry();

  // Create 5 public flights
  for (let i = 1; i <= 5; i++) {
    registry.createRoom({
      hostUid: `pub_host_${i}`,
      hostName: `Captain Public ${i}`,
      flightName: `Public Express #${i}`,
      isPublic: true
    });
  }

  // Create 5 private flights
  const privateCodes = [];
  for (let i = 1; i <= 5; i++) {
    const room = registry.createRoom({
      hostUid: `priv_host_${i}`,
      hostName: `Captain Secret ${i}`,
      flightName: `VIP Charter #${i}`,
      isPublic: false
    });
    privateCodes.push(room.code);
  }

  const publicList = registry.listPublicRooms();
  assert.strictEqual(publicList.length, 5, `Expected 5 public rooms, got ${publicList.length}`);

  // Ensure no private flights leak onto the board
  publicList.forEach((room) => {
    assert.strictEqual(room.isPublic, true);
    assert.ok(!privateCodes.includes(room.code), `Private code ${room.code} leaked to public board!`);
    assert.ok(room.name.includes('Public Express'));
  });

  // Verify private flights are still directly accessible by 6-digit code
  privateCodes.forEach((code) => {
    const found = registry.getRoomByCode(code);
    assert.ok(found, `Private flight with code ${code} must be retrievable by code`);
    assert.strictEqual(found.isPublic, false);
  });
});

// -------------------------------------------------------------
// Test 2.3: Capacity Guard
// -------------------------------------------------------------
it('Test 2.3: Capacity Guard rejects passenger when all available seats are occupied', () => {
  const registry = new RoomRegistry();
  const mockWsHost = { id: 'ws_host' };
  const mockWsGuest1 = { id: 'ws_guest1' };
  const mockWsGuest2 = { id: 'ws_guest2' };

  // Create room with 2 human seats and 2 closed slots
  const slots = [
    { id: 1, role: 'bkk', color: 'ruby', type: 'human', difficulty: null, ready: true },
    { id: 2, role: 'dxb', color: 'cyan', type: 'human', difficulty: null, ready: false },
    { id: 3, role: 'bot1', color: 'emerald', type: 'closed', difficulty: null, ready: false },
    { id: 4, role: 'bot2', color: 'amber', type: 'closed', difficulty: null, ready: false }
  ];

  const room = registry.createRoom({
    hostUid: 'host_ruby',
    hostName: 'Ruby Pilot',
    slots,
    ws: mockWsHost
  });

  // Guest 1 joins -> fills Seat 2
  const join1 = registry.joinRoom(room.id, { uid: 'guest_cyan', name: 'Cyan Passenger' }, mockWsGuest1);
  assert.strictEqual(join1.success, true);
  assert.strictEqual(join1.slot.id, 2);

  // Guest 2 tries to join -> No open human seats left
  const join2 = registry.joinRoom(room.id, { uid: 'guest_extra', name: 'Extra Passenger' }, mockWsGuest2);
  assert.strictEqual(join2.success, undefined);
  assert.strictEqual(join2.error, 'ROOM_FULL');
});

// -------------------------------------------------------------
// Test 2.4: Host Disconnect & Migration
// -------------------------------------------------------------
it('Test 2.4: Host disconnect migrates host privileges to remaining passenger', () => {
  const registry = new RoomRegistry();
  const mockWsHost = { id: 'ws_host' };
  const mockWsGuest = { id: 'ws_guest' };

  const room = registry.createRoom({
    hostUid: 'original_host',
    hostName: 'Original Captain 🐺',
    ws: mockWsHost
  });

  registry.joinRoom(room.id, { uid: 'guest_dragon', name: 'Empress Sarah 🐉' }, mockWsGuest);

  // Verify original host
  assert.strictEqual(room.hostUid, 'original_host');
  assert.strictEqual(room.clients.size, 2);

  // Host disconnects / leaves room
  const leaveResult = registry.leaveRoom(mockWsHost);
  assert.strictEqual(leaveResult.wasHost, true);
  assert.strictEqual(leaveResult.empty, false);
  assert.strictEqual(room.hostUid, 'guest_dragon');
  assert.strictEqual(room.hostName, 'Empress Sarah 🐉');
  assert.strictEqual(room.clients.size, 1);

  // Remaining passenger leaves -> room cleans up
  const finalLeave = registry.leaveRoom(mockWsGuest);
  assert.strictEqual(finalLeave.empty, true);
  assert.strictEqual(finalLeave.deleted, true);
  assert.strictEqual(registry.getRoom(room.id), null);
  assert.strictEqual(registry.getRoomByCode(room.code), null);
});

// -------------------------------------------------------------
// Test 2.5: Code Lookup & Direct Boarding
// -------------------------------------------------------------
it('Test 2.5: Direct boarding by 6-digit code accurately maps to room and seat', () => {
  const registry = new RoomRegistry();
  const mockWsHost = { id: 'ws_host' };
  const mockWsPassenger = { id: 'ws_pass' };

  const room = registry.createRoom({
    hostUid: 'host_bkk',
    hostName: 'Captain Thanapat',
    flightName: 'Bangkok-Dubai Direct #888',
    isPublic: false,
    ws: mockWsHost
  });

  const code = room.code;
  const joinRes = registry.joinRoom(code, { uid: 'pass_dxb', name: 'First Officer Sarah' }, mockWsPassenger);

  assert.strictEqual(joinRes.success, true);
  assert.strictEqual(joinRes.room.id, room.id);
  assert.strictEqual(joinRes.slot.id, 2);
  assert.strictEqual(joinRes.slot.occupiedBy, 'pass_dxb');
  assert.strictEqual(registry.getClientRoom(mockWsPassenger).id, room.id);
});

// -------------------------------------------------------------
// Test 2.6: Stale Room Sweeper
// -------------------------------------------------------------
it('Test 2.6: Stale room sweeper removes deserted rooms older than threshold', () => {
  const registry = new RoomRegistry();
  const room1 = registry.createRoom({ hostName: 'Host 1' });
  const room2 = registry.createRoom({ hostName: 'Host 2' });

  // Simulate room 1 deserted 40 minutes ago
  room1.updatedAt = Date.now() - (40 * 60 * 1000);
  // Simulate room 2 created 5 minutes ago
  room2.updatedAt = Date.now() - (5 * 60 * 1000);

  const cleaned = registry.cleanStaleRooms(30 * 60 * 1000);
  assert.strictEqual(cleaned, 1);
  assert.strictEqual(registry.getRoom(room1.id), null);
  assert.ok(registry.getRoom(room2.id) !== null);
});

// -------------------------------------------------------------
// Test 2.7: Dynamic Privacy Toggle
// -------------------------------------------------------------
it('Test 2.7: Host can dynamically toggle flight privacy between Public and Private', () => {
  const registry = new RoomRegistry();
  const mockWsHost = { id: 'ws_host' };
  const mockWsGuest = { id: 'ws_guest' };

  const room = registry.createRoom({
    hostUid: 'captain_jack',
    isPublic: true,
    ws: mockWsHost
  });

  registry.joinRoom(room.id, { uid: 'guest_bob' }, mockWsGuest);

  // Guest attempts to toggle privacy -> rejected
  const guestToggle = registry.setPrivacy(room.id, false, mockWsGuest);
  assert.strictEqual(guestToggle.error, 'NOT_AUTHORIZED');
  assert.strictEqual(room.isPublic, true);

  // Host toggles privacy to private -> allowed
  const hostToggle = registry.setPrivacy(room.id, false, mockWsHost);
  assert.strictEqual(hostToggle.success, true);
  assert.strictEqual(room.isPublic, false);
  assert.strictEqual(registry.listPublicRooms().length, 0);

  // Host toggles back to public
  registry.setPrivacy(room.id, true, mockWsHost);
  assert.strictEqual(room.isPublic, true);
  assert.strictEqual(registry.listPublicRooms().length, 1);
});

console.log('\n============================================================');
console.log(`TEST SUMMARY: ${passed}/${passed + failed} Passed (${failed} Failed)`);
console.log('============================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL PHASE 2 ROOM REGISTRY LOGIC TESTS PASSED 100%!');
  process.exit(0);
}
