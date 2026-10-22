// tests/couple_rules.test.js — Verification of Twin Isles + Heart Isle couple rules.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  HEART_ISLE,
  DECOR_FOOTPRINTS,
  FORMATION,
  DAILY_SEND_RAMP,
  decorFootprint,
  isDecorAllowed,
  heartIsleId,
  defaultHeartIsle,
  canFormCouple,
  dailySendCap,
  canSend,
  editAllowed,
  deposit,
  withdraw,
  splitCouple,
  restoreHeartIsle,
  placeDecor,
  removeDecor,
} from '../shared/couple_rules.js';

const HOUR_MS = 3600 * 1000;
const DAY_MS = 24 * HOUR_MS;

test('HEART_ISLE specification and immutability', () => {
  assert.equal(HEART_ISLE.size, 20);
  assert.equal(HEART_ISLE.biome, 'biome_rose_garden');
  assert.deepEqual(HEART_ISLE.fixed, ['love_pavilion', 'shared_chest']);
  assert.deepEqual(HEART_ISLE.decor, [
    'heart_arch',
    'twin_lanterns',
    'photo_booth',
    'rose_hedge',
    'wisteria_pergola',
    'couple_bench',
  ]);
  assert.ok(Object.isFrozen(HEART_ISLE));
  assert.ok(Object.isFrozen(HEART_ISLE.fixed));
  assert.ok(Object.isFrozen(HEART_ISLE.decor));
});

test('heartIsleId and defaultHeartIsle initialization', () => {
  // Deterministic ID with sorting
  assert.equal(heartIsleId('userB', 'userA'), 'heart:userA:userB');
  assert.equal(heartIsleId('alice', 'bob'), 'heart:alice:bob');
  assert.equal(heartIsleId('bob', 'alice'), 'heart:alice:bob');

  const now = 1_700_000_000_000;
  const isle = defaultHeartIsle('bob', 'alice', now);

  assert.equal(isle.id, 'heart:alice:bob');
  assert.deepEqual(isle.owners, ['alice', 'bob']);
  assert.equal(isle.createdAt, now);
  assert.deepEqual(isle.layout, { decor: [] });
  assert.deepEqual(isle.storage, {
    items: {},
    ledger: {
      alice: {},
      bob: {},
    },
  });
  assert.deepEqual(isle.monuments, {});
  assert.equal(isle.frozen, false);
  assert.equal(isle.frozenAt, 0);
});

test('canFormCouple: friendship requirement and split cooldown rules', () => {
  const now = 1_700_000_000_000;
  assert.equal(FORMATION.MIN_FRIEND_DAYS, 3);
  assert.equal(FORMATION.SPLIT_COOLDOWN_MS, 72 * HOUR_MS);

  // 1. Friendship duration < 3 days fails
  const res1 = canFormCouple({
    friendSince: now - (2 * DAY_MS),
    now,
  });
  assert.equal(res1.ok, false);
  assert.equal(res1.error, 'too_soon_friends');

  // 2. Friendship duration >= 3 days succeeds
  const res2 = canFormCouple({
    friendSince: now - (3 * DAY_MS),
    now,
  });
  assert.equal(res2.ok, true);

  // 3. Recent split (< 72 hours) with new partner fails with cooldown
  const res3 = canFormCouple({
    friendSince: now - (10 * DAY_MS),
    now,
    lastSplitAt: now - (24 * HOUR_MS), // 24 hours ago
    sameAsEx: false,
  });
  assert.equal(res3.ok, false);
  assert.equal(res3.error, 'cooldown');

  // 4. Cooldown expired (>= 72 hours) succeeds
  const res4 = canFormCouple({
    friendSince: now - (10 * DAY_MS),
    now,
    lastSplitAt: now - (72 * HOUR_MS),
    sameAsEx: false,
  });
  assert.equal(res4.ok, true);

  // 5. Immediate re-coupling with the same ex bypasses 72h cooldown
  const res5 = canFormCouple({
    friendSince: now - (10 * DAY_MS),
    now,
    lastSplitAt: now - (1 * HOUR_MS), // only 1 hour ago
    sameAsEx: true,
  });
  assert.equal(res5.ok, true);
});

test('dailySendCap: 7-day progression ramp', () => {
  const coupleSince = 1_700_000_000_000;

  // Day 0: [0, 24h) -> 50 units
  assert.equal(dailySendCap(coupleSince, coupleSince), 50);
  assert.equal(dailySendCap(coupleSince, coupleSince + 12 * HOUR_MS), 50);
  assert.equal(dailySendCap(coupleSince, coupleSince + 24 * HOUR_MS - 1), 50);

  // Day 1: [24h, 48h) -> 100 units
  assert.equal(dailySendCap(coupleSince, coupleSince + 24 * HOUR_MS), 100);

  // Day 2: [48h, 72h) -> 200 units
  assert.equal(dailySendCap(coupleSince, coupleSince + 48 * HOUR_MS), 200);

  // Day 3: [72h, 96h) -> 400 units
  assert.equal(dailySendCap(coupleSince, coupleSince + 72 * HOUR_MS), 400);

  // Day 4: [96h, 120h) -> 800 units
  assert.equal(dailySendCap(coupleSince, coupleSince + 96 * HOUR_MS), 800);

  // Day 5: [120h, 144h) -> 1600 units
  assert.equal(dailySendCap(coupleSince, coupleSince + 120 * HOUR_MS), 1600);

  // Day 6: [144h, 168h) -> 3200 units
  assert.equal(dailySendCap(coupleSince, coupleSince + 144 * HOUR_MS), 3200);

  // Day >= 7: [168h, ...) -> Infinity (uncapped)
  assert.equal(dailySendCap(coupleSince, coupleSince + 168 * HOUR_MS), Infinity);
  assert.equal(dailySendCap(coupleSince, coupleSince + 365 * DAY_MS), Infinity);
});

test('canSend: rejects gold and rare-tier items', () => {
  const coupleSince = 1_700_000_000_000;
  const now = coupleSince; // Day 0: cap 50

  // Gold cannot be sent
  const goldRes = canSend({
    items: { gold: 100 },
    coupleSince,
    now,
    sentToday: 0,
  });
  assert.equal(goldRes.ok, false);
  assert.equal(goldRes.error, 'not_sendable');
  assert.equal(goldRes.cap, 50);
  assert.equal(goldRes.remaining, 50);

  // Rare-tier items cannot be sent
  for (const rareItem of ['boss_core_moss', 'boss_core_weaver', 'ancient_gear', 'starlight_essence']) {
    const rareRes = canSend({
      items: { [rareItem]: 1 },
      coupleSince,
      now,
      sentToday: 0,
    });
    assert.equal(rareRes.ok, false);
    assert.equal(rareRes.error, 'not_sendable');
  }

  // Non-material cannot be sent
  const bogusRes = canSend({
    items: { mystery_laser: 1 },
    coupleSince,
    now,
    sentToday: 0,
  });
  assert.equal(bogusRes.ok, false);
  assert.equal(bogusRes.error, 'not_sendable');
});

test('canSend: daily send cap enforcement', () => {
  const coupleSince = 1_700_000_000_000;
  const now = coupleSince; // Day 0: cap 50

  // 1. Send within cap on Day 0
  const okSend = canSend({
    items: { wood: 20, plank: 10 },
    coupleSince,
    now,
    sentToday: 0,
  });
  assert.equal(okSend.ok, true);
  assert.equal(okSend.cap, 50);
  assert.equal(okSend.remaining, 20); // 50 - 30 = 20 remaining

  // 2. Exceeding remaining cap fails with 'cap' error
  const overSend = canSend({
    items: { wood: 30 },
    coupleSince,
    now,
    sentToday: 30, // 20 remaining
  });
  assert.equal(overSend.ok, false);
  assert.equal(overSend.error, 'cap');
  assert.equal(overSend.cap, 50);
  assert.equal(overSend.remaining, 20); // 20 units still remaining

  // 3. Day 7+ has no cap (Infinity)
  const uncappedSend = canSend({
    items: { wood: 50_000, ingot: 25_000 },
    coupleSince,
    now: coupleSince + 7 * DAY_MS,
    sentToday: 100_000,
  });
  assert.equal(uncappedSend.ok, true);
  assert.equal(uncappedSend.cap, Infinity);
  assert.equal(uncappedSend.remaining, Infinity);
});

test('editAllowed: owners only and read-only when frozen', () => {
  const now = 1_700_000_000_000;
  const isle = defaultHeartIsle('alice', 'bob', now);

  assert.equal(editAllowed(isle, 'alice'), true);
  assert.equal(editAllowed(isle, 'bob'), true);
  assert.equal(editAllowed(isle, 'charlie'), false);

  isle.frozen = true;
  assert.equal(editAllowed(isle, 'alice'), false);
  assert.equal(editAllowed(isle, 'bob'), false);
  assert.equal(editAllowed(isle, 'charlie'), false);
});

test('deposit and withdraw: shared storage and ledger updates', () => {
  const now = 1_700_000_000_000;
  const isle = defaultHeartIsle('alice', 'bob', now);

  // 1. Alice deposits 100 wood and 50 stone
  const dep1 = deposit(isle, 'alice', { wood: 100, stone: 50 });
  assert.equal(dep1.ok, true);
  assert.deepEqual(isle.storage.items, { wood: 100, stone: 50 });
  assert.deepEqual(isle.storage.ledger.alice, { wood: 100, stone: 50 });
  assert.deepEqual(isle.storage.ledger.bob, {});

  // 2. Bob deposits 20 wood
  const dep2 = deposit(isle, 'bob', { wood: 20 });
  assert.equal(dep2.ok, true);
  assert.deepEqual(isle.storage.items, { wood: 120, stone: 50 });
  assert.deepEqual(isle.storage.ledger.bob, { wood: 20 });

  // 3. Non-owner cannot deposit
  const badDep = deposit(isle, 'eve', { wood: 10 });
  assert.equal(badDep.ok, false);
  assert.equal(badDep.error, 'not_owner');

  // 4. Bob withdraws 30 wood: reduces Bob's ledger first (20), then Alice's ledger (10)
  const wd1 = withdraw(isle, 'bob', { wood: 30 });
  assert.equal(wd1.ok, true);
  assert.equal(isle.storage.items.wood, 90);
  assert.equal(isle.storage.ledger.bob.wood, 0); // Bob's 20 exhausted
  assert.equal(isle.storage.ledger.alice.wood, 90); // Alice's reduced by 10

  // 5. Withdrawal fails atomically if insufficient items
  const badWd = withdraw(isle, 'alice', { stone: 60 });
  assert.equal(badWd.ok, false);
  assert.equal(badWd.error, 'insufficient_items');
  assert.equal(isle.storage.items.stone, 50); // unchanged

  // 6. Frozen isle rejects deposit and withdrawal
  isle.frozen = true;
  assert.equal(deposit(isle, 'alice', { wood: 5 }).ok, false);
  assert.equal(deposit(isle, 'alice', { wood: 5 }).error, 'frozen');
  assert.equal(withdraw(isle, 'alice', { wood: 5 }).ok, false);
  assert.equal(withdraw(isle, 'alice', { wood: 5 }).error, 'frozen');
});

test('deposit and withdraw atomic callbacks (takeFn, addFn)', () => {
  const now = 1_700_000_000_000;
  const isle = defaultHeartIsle('alice', 'bob', now);

  // Failed takeFn aborts deposit without side-effects
  let playerInventory = { wood: 10 };
  const takeFnFail = () => false;
  const depFail = deposit(isle, 'alice', { wood: 20 }, takeFnFail);
  assert.equal(depFail.ok, false);
  assert.equal(isle.storage.items.wood, undefined);

  // Successful takeFn completes deposit
  const takeFnSuccess = (items) => {
    playerInventory.wood -= items.wood;
    return true;
  };
  const depOk = deposit(isle, 'alice', { wood: 10 }, takeFnSuccess);
  assert.equal(depOk.ok, true);
  assert.equal(playerInventory.wood, 0);
  assert.equal(isle.storage.items.wood, 10);

  // Failed addFn aborts withdraw without side-effects
  const addFnFail = () => false;
  const wdFail = withdraw(isle, 'alice', { wood: 5 }, addFnFail);
  assert.equal(wdFail.ok, false);
  assert.equal(isle.storage.items.wood, 10);
});

test('splitCouple: 50/50 vs ledger split with odd units', () => {
  const now = 1_700_000_000_000;

  // Case 1: Sole depositor gets everything back
  const isle1 = defaultHeartIsle('alice', 'bob', now);
  deposit(isle1, 'alice', { diamond_gem: 10 });
  const split1 = splitCouple(isle1, now + 1000);
  assert.deepEqual(split1.shares.alice, { diamond_gem: 10 });
  assert.deepEqual(split1.shares.bob, {});
  assert.equal(split1.isle.frozen, true);
  assert.equal(split1.isle.frozenAt, now + 1000);
  assert.deepEqual(split1.isle.storage.items, {});

  // Case 2: Unequal depositors (Alice: 8, Bob: 2, Total in storage: 7)
  // Alice share: floor(7 * 8 / 10) = 5
  // Bob share: floor(7 * 2 / 10) = 1
  // Remainder: 7 - (5 + 1) = 1 unit.
  // Larger depositor (Alice: 8 > 2) gets the odd unit -> Alice: 6, Bob: 1.
  const isle2 = defaultHeartIsle('alice', 'bob', now);
  deposit(isle2, 'alice', { wood: 8 });
  deposit(isle2, 'bob', { wood: 2 });
  isle2.storage.items.wood = 7; // simulate 3 wood consumed
  const split2 = splitCouple(isle2, now + 2000);
  assert.equal(split2.shares.alice.wood, 6);
  assert.equal(split2.shares.bob.wood, 1);

  // Case 3: Empty ledger -> 50/50 split, odd units go by userId sort order
  const isle3 = defaultHeartIsle('bob', 'alice', now); // owners sorted: ['alice', 'bob']
  isle3.storage.items = { stone: 11 }; // no ledger entries
  const split3 = splitCouple(isle3, now + 3000);
  // 11 split 50/50: 5 each, 1 remainder. Ties broken by userId sort -> alice gets 6, bob gets 5
  assert.equal(split3.shares.alice.stone, 6);
  assert.equal(split3.shares.bob.stone, 5);

  // Case 4: Equal depositors with odd remainder
  const isle4 = defaultHeartIsle('alice', 'bob', now);
  deposit(isle4, 'alice', { flour: 10 });
  deposit(isle4, 'bob', { flour: 10 });
  isle4.storage.items.flour = 9; // 9 remaining
  const split4 = splitCouple(isle4, now + 4000);
  // floor(9 * 10 / 20) = 4 each. Remainder = 1. Tie -> alice gets 5, bob gets 4
  assert.equal(split4.shares.alice.flour, 5);
  assert.equal(split4.shares.bob.flour, 4);
});

test('restoreHeartIsle: unfreezes Heart Isle upon re-coupling', () => {
  const now = 1_700_000_000_000;
  const isle = defaultHeartIsle('alice', 'bob', now);
  splitCouple(isle, now + 1000);
  assert.equal(isle.frozen, true);
  assert.equal(editAllowed(isle, 'alice'), false);

  restoreHeartIsle(isle, now + 5000);
  assert.equal(isle.frozen, false);
  assert.equal(isle.frozenAt, 0);
  assert.equal(editAllowed(isle, 'alice'), true);
  assert.equal(editAllowed(isle, 'bob'), true);
});

test('placeDecor and removeDecor: validation, footprints, bounds, and Memory Museum', () => {
  const now = 1_700_000_000_000;
  const isle = defaultHeartIsle('alice', 'bob', now);

  // Footprint checks
  assert.deepEqual(decorFootprint('dec_nookairline_museum'), { w: 2, h: 2 });
  assert.deepEqual(decorFootprint('wisteria_pergola'), { w: 2, h: 2 });
  assert.deepEqual(decorFootprint('photo_booth'), { w: 2, h: 2 });
  assert.deepEqual(decorFootprint('heart_arch'), { w: 1, h: 1 });
  assert.deepEqual(decorFootprint('couple_bench'), { w: 1, h: 1 });

  // Protected Memory Landmark dec_nookairline_museum is allowed
  assert.equal(isDecorAllowed('dec_nookairline_museum'), true);
  assert.equal(isDecorAllowed('heart_arch'), true);
  assert.equal(isDecorAllowed('unauthorized_monument'), false);

  // 1. Place 2x2 Memory Museum at (0, 0)
  const placeMuseum = placeDecor(isle, 'alice', {
    type: 'dec_nookairline_museum',
    x: 0,
    y: 0,
  });
  assert.equal(placeMuseum.ok, true);
  assert.equal(isle.layout.decor.length, 1);

  // 2. Overlap rejection: placing at (1, 1) overlaps (0, 0) 2x2
  const placeOverlap = placeDecor(isle, 'bob', {
    type: 'heart_arch',
    x: 1,
    y: 1,
  });
  assert.equal(placeOverlap.ok, false);
  assert.equal(placeOverlap.error, 'overlap');

  // 3. Non-overlapping placement at (2, 0) succeeds
  const placeArch = placeDecor(isle, 'bob', {
    type: 'heart_arch',
    x: 2,
    y: 0,
  });
  assert.equal(placeArch.ok, true);
  assert.equal(isle.layout.decor.length, 2);

  // 4. Out of bounds check: Heart Isle size is 20
  // A 2x2 building at (19, 0) exceeds width (19 + 2 = 21 > 20)
  const placeOOB = placeDecor(isle, 'alice', {
    type: 'wisteria_pergola',
    x: 19,
    y: 0,
  });
  assert.equal(placeOOB.ok, false);
  assert.equal(placeOOB.error, 'out_of_bounds');

  // Negative coords
  assert.equal(placeDecor(isle, 'alice', { type: 'heart_arch', x: -1, y: 0 }).error, 'out_of_bounds');

  // 5. Invalid decor type rejected
  const placeInvalid = placeDecor(isle, 'alice', {
    type: 'random_sword',
    x: 5,
    y: 5,
  });
  assert.equal(placeInvalid.ok, false);
  assert.equal(placeInvalid.error, 'invalid_type');

  // 6. Frozen isle rejects placement
  isle.frozen = true;
  assert.equal(placeDecor(isle, 'alice', { type: 'couple_bench', x: 5, y: 5 }).error, 'frozen');
  isle.frozen = false;

  // 7. removeDecor by ID
  const removeRes1 = removeDecor(isle, 'alice', placeArch.decor.id);
  assert.equal(removeRes1.ok, true);
  assert.equal(isle.layout.decor.length, 1);

  // 8. removeDecor by coordinate
  const removeRes2 = removeDecor(isle, 'bob', { x: 1, y: 1 }); // inside 2x2 museum at (0, 0)
  assert.equal(removeRes2.ok, true);
  assert.equal(removeRes2.removed.type, 'dec_nookairline_museum');
  assert.equal(isle.layout.decor.length, 0);

  // 9. removeDecor on non-existent item
  const removeNotFound = removeDecor(isle, 'alice', 'non_existent_id');
  assert.equal(removeNotFound.ok, false);
  assert.equal(removeNotFound.error, 'not_found');
});
