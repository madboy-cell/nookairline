// tests/order_rules.test.js — Verification of NPC Order Board & Big Order pure rules.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ITEM_VALUE,
  ORDER_CFG,
  NPC_NAMES,
  clamp,
  calculateItemQty,
  generateOrder,
  generateBigOrder,
  fillOrder,
  isBigOrderComplete,
  contributeBigOrder,
  distributeProportional,
  bigOrderRewards,
  createBoard,
  ensureBoard,
  discardOrder,
  completeSlot,
} from '../shared/order_rules.js';

// Seeded PRNG: mulberry32
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('ORDER_CFG & ITEM_VALUE constants match specification', () => {
  assert.equal(ORDER_CFG.SLOTS_BASE, 3);
  assert.equal(ORDER_CFG.SLOTS_COURIER, 6);
  assert.equal(ORDER_CFG.REFRESH_MS, 5 * 60 * 1000);
  assert.deepEqual(ORDER_CFG.BIG_ORDER_ITEMS, [3, 5]);
  assert.equal(ORDER_CFG.BIG_ORDER_MULT, 2.5);
  assert.equal(ORDER_CFG.XP_PER_GOLD, 0.1);

  const expectedValues = {
    flour: 12,
    bread: 30,
    honey_bun: 55,
    fish_pie: 90,
    berry_tart: 60,
    boba_tea: 40,
    golden_croissant: 220,
    ingot: 45,
    crystal_glass: 60,
    plank: 15,
    thread: 50,
    herb: 20,
    potion_small: 70,
    repair_kit: 140,
    pet_treat: 45,
    sky_wheat: 4,
    berries_crop: 5,
  };

  assert.equal(Object.keys(ITEM_VALUE).length, 17);
  for (const [k, v] of Object.entries(expectedValues)) {
    assert.equal(ITEM_VALUE[k], v, `ITEM_VALUE[${k}] should be ${v}`);
  }

  assert.ok(NPC_NAMES.includes('Baker Mira'));
  assert.ok(NPC_NAMES.includes('Old Tomas'));
  assert.ok(NPC_NAMES.includes('Courier Pip'));
  assert.ok(NPC_NAMES.includes('Sister Lene'));
  assert.ok(NPC_NAMES.includes('Smith Bram'));
});

test('generateOrder determinism: same seed produces identical orders', () => {
  const unlocked = ['flour', 'bread', 'plank', 'herb', 'potion_small'];
  const rng1 = mulberry32(12345);
  const rng2 = mulberry32(12345);

  const order1 = generateOrder({ unlockedItems: unlocked, rng: rng1, now: 10000, id: 'ord_1' });
  const order2 = generateOrder({ unlockedItems: unlocked, rng: rng2, now: 10000, id: 'ord_1' });

  assert.deepEqual(order1, order2);
  assert.equal(order1.id, 'ord_1');
  assert.equal(order1.createdAt, 10000);
});

test('generateOrder unlocked items filtering and edge cases', () => {
  const rng = mulberry32(42);

  // Return null if unlockedItems is empty or has no item in ITEM_VALUE
  assert.equal(generateOrder({ unlockedItems: [], rng }), null);
  assert.equal(generateOrder({ unlockedItems: ['wood', 'stone', 'crystal_ore'], rng }), null);
  assert.equal(generateOrder({ unlockedItems: null, rng }), null);

  // Single unlocked item
  const single = generateOrder({ unlockedItems: ['bread'], rng });
  assert.ok(single);
  assert.deepEqual(Object.keys(single.items), ['bread']);

  // Set input
  const setOrder = generateOrder({ unlockedItems: new Set(['plank', 'herb']), rng });
  assert.ok(setOrder);
  for (const k of Object.keys(setOrder.items)) {
    assert.ok(['plank', 'herb'].includes(k));
  }

  // Object input
  const objOrder = generateOrder({ unlockedItems: { bread: true, wood: true, flour: 1, stone: 0 }, rng });
  assert.ok(objOrder);
  for (const k of Object.keys(objOrder.items)) {
    assert.ok(['bread', 'flour'].includes(k));
  }

  // 1-3 distinct items
  const manyUnlocked = Object.keys(ITEM_VALUE);
  for (let i = 0; i < 50; i++) {
    const o = generateOrder({ unlockedItems: manyUnlocked, rng });
    const count = Object.keys(o.items).length;
    assert.ok(count >= 1 && count <= 3, `Distinct items count ${count} should be in [1, 3]`);
    for (const item of Object.keys(o.items)) {
      assert.ok(ITEM_VALUE[item] !== undefined, `Item ${item} must have ITEM_VALUE`);
    }
  }
});

test('generateOrder quantities: 1-6 bounds and cheaper items get larger quantities', () => {
  const rng = mulberry32(999);
  const cheapItem = 'sky_wheat'; // value 4
  const expensiveItem = 'golden_croissant'; // value 220

  let cheapTotalQty = 0;
  let expensiveTotalQty = 0;
  const N = 500;

  for (let i = 0; i < N; i++) {
    const cheapQty = calculateItemQty(ITEM_VALUE[cheapItem], rng);
    const expensiveQty = calculateItemQty(ITEM_VALUE[expensiveItem], rng);

    assert.ok(cheapQty >= 1 && cheapQty <= 6);
    assert.ok(expensiveQty >= 1 && expensiveQty <= 6);

    cheapTotalQty += cheapQty;
    expensiveTotalQty += expensiveQty;
  }

  const cheapAvg = cheapTotalQty / N;
  const expensiveAvg = expensiveTotalQty / N;

  assert.ok(cheapAvg >= 5.0, `Expected cheap average >= 5.0, got ${cheapAvg}`);
  assert.ok(expensiveAvg <= 2.0, `Expected expensive average <= 2.0, got ${expensiveAvg}`);
  assert.ok(cheapAvg > expensiveAvg * 2.5, 'Cheaper items should have significantly higher average quantity');
});

test('generateOrder reward math: gold and xp formulas', () => {
  const rng = mulberry32(777);
  const unlocked = ['bread', 'honey_bun', 'ingot'];

  for (let i = 0; i < 20; i++) {
    const order = generateOrder({ unlockedItems: unlocked, rng, now: 5000 });
    let expectedBase = 0;
    for (const [it, qty] of Object.entries(order.items)) {
      expectedBase += ITEM_VALUE[it] * qty;
    }
    const expectedGold = Math.round(expectedBase * 1.25);
    const expectedXp = Math.round(expectedGold * ORDER_CFG.XP_PER_GOLD);

    assert.equal(order.gold, expectedGold, 'Gold reward should be round(sum(value*qty)*1.25)');
    assert.equal(order.xp, expectedXp, 'XP reward should be round(gold*XP_PER_GOLD)');
  }
});

test('generateOrder extra bonus: 15% bonus rate, ancient_gear 3%, herb_seed 12%', () => {
  const rng = mulberry32(314159);
  const unlocked = ['flour', 'bread', 'herb'];
  const N = 10000;

  let bonusCount = 0;
  let ancientGearCount = 0;
  let herbSeedCount = 0;

  for (let i = 0; i < N; i++) {
    const order = generateOrder({ unlockedItems: unlocked, rng });
    if (order.extra.ancient_gear) {
      assert.equal(order.extra.ancient_gear, 1, 'ancient_gear qty must be 1');
      ancientGearCount++;
      bonusCount++;
    } else if (order.extra.herb_seed) {
      assert.equal(order.extra.herb_seed, 2, 'herb_seed qty must be 2');
      herbSeedCount++;
      bonusCount++;
    } else {
      assert.deepEqual(order.extra, {}, 'extra must be empty when no bonus');
    }
  }

  const totalBonusRate = bonusCount / N;
  const gearRate = ancientGearCount / N;
  const seedRate = herbSeedCount / N;

  // Expected 15% total bonus (allow 13.5% - 16.5%)
  assert.ok(totalBonusRate >= 0.135 && totalBonusRate <= 0.165, `Total bonus rate ${totalBonusRate} near 0.15`);
  // Expected 3% ancient gear (allow 2.4% - 3.6%)
  assert.ok(gearRate >= 0.024 && gearRate <= 0.036, `Ancient gear rate ${gearRate} near 0.03`);
  // Expected 12% herb seed (allow 10.5% - 13.5%)
  assert.ok(seedRate >= 0.105 && seedRate <= 0.135, `Herb seed rate ${seedRate} near 0.12`);
});

test('generateBigOrder: distinct items, 2.5x multiplier, day tracking', () => {
  const rng = mulberry32(888);
  const unlocked = ['bread', 'honey_bun', 'fish_pie', 'berry_tart', 'boba_tea', 'plank'];

  const big = generateBigOrder({ unlockedItems: unlocked, rng, now: 50000, day: 4 });
  assert.ok(big);
  assert.equal(big.day, 4);
  assert.equal(big.id, 'big_4');
  assert.deepEqual(big.contributors, {});
  assert.equal(big.complete, false);

  const itemCount = Object.keys(big.items).length;
  assert.ok(itemCount >= 3 && itemCount <= 5, `Item count ${itemCount} should be in [3, 5]`);

  let baseVal = 0;
  for (const [it, q] of Object.entries(big.items)) {
    baseVal += ITEM_VALUE[it] * q;
  }
  const baseGold = Math.round(baseVal * 1.25);
  const expectedGold = Math.round(baseGold * ORDER_CFG.BIG_ORDER_MULT);
  const expectedXp = Math.round(expectedGold * ORDER_CFG.XP_PER_GOLD);

  assert.equal(big.gold, expectedGold);
  assert.equal(big.xp, expectedXp);
});

test('fillOrder: atomicity with hasItemsFn and takeItemsFn', () => {
  const order = {
    id: 'ord_test',
    items: { bread: 3, flour: 2 },
    gold: 150,
    xp: 15,
  };

  const inventory = { bread: 3, flour: 1 }; // missing 1 flour
  let took = null;

  const hasItems = (needed) => {
    for (const [it, q] of Object.entries(needed)) {
      if ((inventory[it] || 0) < q) return false;
    }
    return true;
  };
  const takeItems = (items) => {
    took = { ...items };
    for (const [it, q] of Object.entries(items)) {
      inventory[it] -= q;
    }
  };

  // Missing items -> fails atomically without taking anything
  const res1 = fillOrder(order, hasItems, takeItems);
  assert.equal(res1.ok, false);
  assert.equal(res1.error, 'missing_items');
  assert.equal(took, null);
  assert.equal(inventory.bread, 3);
  assert.equal(inventory.flour, 1);

  // Now inventory has enough
  inventory.flour = 5;
  const res2 = fillOrder(order, hasItems, takeItems);
  assert.equal(res2.ok, true);
  assert.deepEqual(took, { bread: 3, flour: 2 });
  assert.equal(inventory.bread, 0);
  assert.equal(inventory.flour, 3);
});

test('contributeBigOrder: partial contribution, capping, and completion', () => {
  const big = {
    id: 'big_1',
    day: 1,
    items: { bread: 5, plank: 4 },
    fulfilled: {},
    remaining: { bread: 5, plank: 4 },
    contributors: {},
    gold: 500,
    xp: 50,
  };

  const userInv = { bread: 10, plank: 2 };
  let taken = null;

  const hasItems = (toTake) => {
    for (const [it, q] of Object.entries(toTake)) {
      if ((userInv[it] || 0) < q) return false;
    }
    return true;
  };
  const takeItems = (toTake) => {
    taken = { ...toTake };
    for (const [it, q] of Object.entries(toTake)) {
      userInv[it] -= q;
    }
  };

  // User 1 offers 10 bread (only 5 needed) and 2 planks
  const step1 = contributeBigOrder(big, 'alice', { bread: 10, plank: 2 }, hasItems, takeItems);
  assert.equal(step1.ok, true);
  assert.deepEqual(step1.contributed, { bread: 5, plank: 2 });
  assert.equal(step1.complete, false);
  assert.deepEqual(taken, { bread: 5, plank: 2 });
  assert.equal(userInv.bread, 5);
  assert.equal(userInv.plank, 0);
  assert.equal(big.contributors.alice, 7); // 5 + 2 units
  assert.equal(big.remaining.bread, 0);
  assert.equal(big.remaining.plank, 2);

  // User 2 offers bread (none needed) -> not_needed
  const step2 = contributeBigOrder(big, 'bob', { bread: 5 }, hasItems, takeItems);
  assert.equal(step2.ok, false);
  assert.equal(step2.error, 'not_needed');

  // User 2 offers 2 planks but doesn't have them in inventory
  const user2Inv = { plank: 1 };
  const hasUser2 = (toTake) => {
    for (const [it, q] of Object.entries(toTake)) {
      if ((user2Inv[it] || 0) < q) return false;
    }
    return true;
  };
  const takeUser2 = (toTake) => {
    for (const [it, q] of Object.entries(toTake)) user2Inv[it] -= q;
  };
  const step3 = contributeBigOrder(big, 'bob', { plank: 2 }, hasUser2, takeUser2);
  assert.equal(step3.ok, false);
  assert.equal(step3.error, 'missing_items');
  assert.equal(user2Inv.plank, 1); // nothing taken

  // User 2 gets another plank and completes the big order
  user2Inv.plank = 2;
  const step4 = contributeBigOrder(big, 'bob', { plank: 2 }, hasUser2, takeUser2);
  assert.equal(step4.ok, true);
  assert.deepEqual(step4.contributed, { plank: 2 });
  assert.equal(step4.complete, true);
  assert.equal(big.contributors.bob, 2);
  assert.equal(user2Inv.plank, 0);
  assert.equal(isBigOrderComplete(big), true);

  // Once complete, further contribution rejected
  const step5 = contributeBigOrder(big, 'charlie', { plank: 1 }, hasItems, takeItems);
  assert.equal(step5.ok, false);
  assert.equal(step5.error, 'already_complete');
  assert.equal(step5.complete, true);
});

test('bigOrderRewards: proportional rewards sum exactly to total gold and xp (largest-remainder rounding)', () => {
  // Test case 1: 3 equal contributors on 100 gold, 10 xp
  const big1 = {
    gold: 100,
    xp: 10,
    contributors: { alice: 1, bob: 1, charlie: 1 },
  };
  const rew1 = bigOrderRewards(big1);
  const totalGold1 = rew1.alice.gold + rew1.bob.gold + rew1.charlie.gold;
  const totalXp1 = rew1.alice.xp + rew1.bob.xp + rew1.charlie.xp;
  assert.equal(totalGold1, 100, 'Sum of gold must equal 100 exactly');
  assert.equal(totalXp1, 10, 'Sum of xp must equal 10 exactly');
  // 100 / 3 = 33 r 1 -> one gets 34, two get 33
  const golds1 = [rew1.alice.gold, rew1.bob.gold, rew1.charlie.gold].sort();
  assert.deepEqual(golds1, [33, 33, 34]);

  // Test case 2: 2 contributors: 3 units and 1 unit (75% / 25%) on 500 gold, 50 xp
  const big2 = {
    gold: 500,
    xp: 50,
    contributors: { alice: 3, bob: 1 },
  };
  const rew2 = bigOrderRewards(big2);
  assert.equal(rew2.alice.gold, 375);
  assert.equal(rew2.bob.gold, 125);
  assert.equal(rew2.alice.xp, 38);
  assert.equal(rew2.bob.xp, 12);
  assert.equal(rew2.alice.gold + rew2.bob.gold, 500);
  assert.equal(rew2.alice.xp + rew2.bob.xp, 50);

  // Test case 3: 7 contributors with prime units on odd gold (777 gold, 77 xp)
  const big3 = {
    gold: 777,
    xp: 77,
    contributors: {
      u1: 1,
      u2: 2,
      u3: 3,
      u4: 5,
      u5: 7,
      u6: 11,
      u7: 13,
    },
  };
  const rew3 = bigOrderRewards(big3);
  let sumGold3 = 0;
  let sumXp3 = 0;
  for (const [uid, r] of Object.entries(rew3)) {
    assert.equal(r.units, big3.contributors[uid]);
    sumGold3 += r.gold;
    sumXp3 += r.xp;
  }
  assert.equal(sumGold3, 777, 'Arbitrary prime split gold sum must equal 777 exactly');
  assert.equal(sumXp3, 77, 'Arbitrary prime split xp sum must equal 77 exactly');
});

test('board state & ensureBoard: slots, refresh timing, and daily big order replacement', () => {
  const rng = mulberry32(112233);
  const unlocked = ['flour', 'bread', 'plank', 'herb', 'potion_small', 'repair_kit'];

  const board = createBoard({ slots: ORDER_CFG.SLOTS_BASE });
  assert.equal(board.slots.length, 3);
  assert.deepEqual(board.slots, [null, null, null]);

  // Initial ensure fills all 3 slots and creates big order for day 1
  ensureBoard(board, { slots: 3, unlockedItems: unlocked, rng, now: 1000, day: 1 });
  assert.equal(board.slots.length, 3);
  assert.ok(board.slots[0] !== null);
  assert.ok(board.slots[1] !== null);
  assert.ok(board.slots[2] !== null);
  assert.ok(board.big !== null);
  assert.equal(board.big.day, 1);

  // Add partial contribution to day 1 big order
  board.big.contributors.alice = 4;

  // Same day ensureBoard preserves big order and contributors
  ensureBoard(board, { slots: 3, unlockedItems: unlocked, rng, now: 2000, day: 1 });
  assert.equal(board.big.day, 1);
  assert.equal(board.big.contributors.alice, 4);

  // Day 2 ensureBoard replaces big order
  ensureBoard(board, { slots: 3, unlockedItems: unlocked, rng, now: 3000, day: 2 });
  assert.equal(board.big.day, 2);
  assert.deepEqual(board.big.contributors, {});

  // Courier expands slots to 6
  ensureBoard(board, { slots: ORDER_CFG.SLOTS_COURIER, unlockedItems: unlocked, rng, now: 4000, day: 2 });
  assert.equal(board.slots.length, 6);
  for (let i = 0; i < 6; i++) {
    assert.ok(board.slots[i] !== null, `Slot ${i} should be filled`);
  }
});

test('discardOrder and completeSlot: sets nextRefreshAt and ensures delayed refill', () => {
  const rng = mulberry32(445566);
  const unlocked = ['bread', 'honey_bun', 'plank'];
  const board = ensureBoard(null, { slots: 3, unlockedItems: unlocked, rng, now: 1000, day: 1 });

  const slot0Before = board.slots[0];
  const slot1Before = board.slots[1];
  assert.ok(slot0Before);
  assert.ok(slot1Before);

  // Discard slot 0 at now = 10,000
  discardOrder(board, 0, 10000);
  assert.equal(board.slots[0], null);
  assert.equal(board.nextRefreshAt[0], 10000 + ORDER_CFG.REFRESH_MS);

  // Complete slot 1 at now = 12,000
  completeSlot(board, 1, 12000);
  assert.equal(board.slots[1], null);
  assert.equal(board.nextRefreshAt[1], 12000 + ORDER_CFG.REFRESH_MS);

  // Advance time by 2 minutes (now = 130,000): neither slot should refill yet
  ensureBoard(board, { slots: 3, unlockedItems: unlocked, rng, now: 130000, day: 1 });
  assert.equal(board.slots[0], null);
  assert.equal(board.slots[1], null);
  assert.ok(board.slots[2] !== null);

  // Advance time past slot 0 refresh (now = 310,001 >= 310,000): slot 0 refills, slot 1 still pending
  ensureBoard(board, { slots: 3, unlockedItems: unlocked, rng, now: 310001, day: 1 });
  assert.ok(board.slots[0] !== null, 'Slot 0 should refill after REFRESH_MS');
  assert.equal(board.nextRefreshAt[0], undefined);
  assert.equal(board.slots[1], null, 'Slot 1 still in cooldown');

  // Advance time past slot 1 refresh (now = 312,001 >= 312,000): slot 1 refills
  ensureBoard(board, { slots: 3, unlockedItems: unlocked, rng, now: 312001, day: 1 });
  assert.ok(board.slots[1] !== null, 'Slot 1 should refill after REFRESH_MS');
  assert.equal(board.nextRefreshAt[1], undefined);
});
