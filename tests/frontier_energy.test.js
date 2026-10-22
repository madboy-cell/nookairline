// tests/frontier_energy.test.js — Sky Frontier energy, buffs, storage caps & camp crate tests.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ENERGY,
  WAREHOUSE_CAP_PER_LV,
  PANTRY_CAP_PER_LV,
  CAMP_CRATE_EXPIRE_MS,
  utcDayOf,
  claimDailyEnergy,
  diamondRefill,
  canGiftPartner,
  applyPartnerGift,
  activeMealBuff,
  eatFood,
  warehouseCap,
  pantryCap,
  totalStoreUnits,
  warehouseFreeSpace,
  pantryFreeSpace,
  grantItems,
  claimCrate,
  applyYieldBonus,
  regenEnergy,
  addEnergy,
  spendEnergy,
} from '../shared/sky_frontier_rules.js';

import { FOOD, MEAL_BUFF_MS, MATERIALS } from '../shared/materials_catalog.js';
import { createSkyFrontierService, regionNodes } from '../server/sky_frontier_service.js';
import { defaultFrontier } from '../server/profile_factory.js';

// =================================================================================================
// 1. Pure Helpers: Daily Energy Claim
// =================================================================================================
test('utcDayOf computes correct UTC day boundaries', () => {
  const day0 = 0;
  const day1 = 86_400_000;
  const day1Mid = 86_400_000 + 43_200_000;
  assert.equal(utcDayOf(day0), 0);
  assert.equal(utcDayOf(day1 - 1), 0);
  assert.equal(utcDayOf(day1), 1);
  assert.equal(utcDayOf(day1Mid), 1);
  assert.equal(utcDayOf(86_400_000 * 10), 10);
});

test('claimDailyEnergy: adds 200 energy once per UTC day, regens first, rejects duplicate', () => {
  const now = 86_400_000 * 5; // day 5
  const fr = defaultFrontier();
  fr.energy.cur = 50;
  fr.energy.max = 200;
  fr.energy.lastRegenAt = now;

  // First claim of the day
  const res1 = claimDailyEnergy(fr, now);
  assert.equal(res1.ok, true);
  assert.equal(fr.energy.cur, 250); // 50 + 200
  assert.equal(fr.energy.dailyFreeDay, 5);

  // Duplicate claim on same day
  const res2 = claimDailyEnergy(fr, now + 3600_000);
  assert.equal(res2.ok, false);
  assert.equal(res2.error, 'claimed');
  assert.equal(fr.energy.cur, 250);

  // Next UTC day: can claim again
  const nextDay = now + 86_400_000;
  const res3 = claimDailyEnergy(fr, nextDay);
  assert.equal(res3.ok, true);
  assert.equal(fr.energy.dailyFreeDay, 6);
  // Cap at 400 (2 * max)
  assert.equal(fr.energy.cur, 400); // 250 + 200 capped at 400
});

// =================================================================================================
// 2. Pure Helpers: Diamond Refills
// =================================================================================================
test('diamondRefill: max 2 refills per UTC day with tiered costs [50, 100]', () => {
  const now = 86_400_000 * 3;
  const fr = defaultFrontier();
  fr.energy.cur = 0;
  fr.energy.lastRegenAt = now;

  // Attempt 1 without enough diamonds
  const fail1 = diamondRefill(fr, 40, now);
  assert.equal(fail1.ok, false);
  assert.equal(fail1.error, 'diamonds');
  assert.equal(fail1.cost, 50);

  // Attempt 1 with 150 diamonds (costs 50)
  const ok1 = diamondRefill(fr, 150, now);
  assert.equal(ok1.ok, true);
  assert.equal(ok1.cost, 50);
  assert.equal(fr.energy.cur, 200);
  assert.equal(fr.energy.diamondRefillsDay, 3);
  assert.equal(fr.energy.diamondRefillsCount, 1);

  // Attempt 2 without enough diamonds for second tier (costs 100)
  const fail2 = diamondRefill(fr, 90, now);
  assert.equal(fail2.ok, false);
  assert.equal(fail2.error, 'diamonds');
  assert.equal(fail2.cost, 100);

  // Attempt 2 with 100 diamonds
  const ok2 = diamondRefill(fr, 100, now);
  assert.equal(ok2.ok, true);
  assert.equal(ok2.cost, 100);
  assert.equal(fr.energy.cur, 400); // 200 + 200
  assert.equal(fr.energy.diamondRefillsCount, 2);

  // Attempt 3 on same day (limit reached)
  const fail3 = diamondRefill(fr, 1000, now);
  assert.equal(fail3.ok, false);
  assert.equal(fail3.error, 'limit');

  // Next UTC day: count resets, costs 50 again
  const nextDay = now + 86_400_000;
  const okNext = diamondRefill(fr, 60, nextDay);
  assert.equal(okNext.ok, true);
  assert.equal(okNext.cost, 50);
  assert.equal(fr.energy.diamondRefillsDay, 4);
  assert.equal(fr.energy.diamondRefillsCount, 1);
});

// =================================================================================================
// 3. Pure Helpers: Partner Gift
// =================================================================================================
test('canGiftPartner & applyPartnerGift: once per UTC day, grants receiver +50 energy', () => {
  const now = 86_400_000 * 2;
  const senderFr = defaultFrontier();
  const receiverFr = defaultFrontier();
  receiverFr.energy.cur = 100;
  receiverFr.energy.lastRegenAt = now;

  assert.equal(canGiftPartner(senderFr, now), true);

  const res1 = applyPartnerGift(senderFr, receiverFr, now);
  assert.equal(res1.ok, true);
  assert.equal(senderFr.energy.partnerGiftDay, 2);
  assert.equal(receiverFr.energy.cur, 150);
  assert.equal(canGiftPartner(senderFr, now), false);

  // Cannot gift twice on same day
  const res2 = applyPartnerGift(senderFr, receiverFr, now + 1000);
  assert.equal(res2.ok, false);
  assert.equal(res2.error, 'already_gifted');
  assert.equal(receiverFr.energy.cur, 150);

  // Next UTC day resets (receiver regenerates to max 200 over 24h, then receives +50 gift = 250)
  const nextDay = now + 86_400_000;
  assert.equal(canGiftPartner(senderFr, nextDay), true);
  const res3 = applyPartnerGift(senderFr, receiverFr, nextDay);
  assert.equal(res3.ok, true);
  assert.equal(senderFr.energy.partnerGiftDay, 3);
  assert.equal(receiverFr.energy.cur, 250);
});

// =================================================================================================
// 4. Pure Helpers: Eat Food, Buff Replacement, Expiry, and 400 Cap Overflow
// =================================================================================================
test('eatFood consumes from pantry, overflows to 400 cap, replaces mealBuff, expires cleanly', () => {
  const now = 1_000_000;
  const fr = defaultFrontier();
  fr.energy.cur = 300;
  fr.energy.max = 200;
  fr.energy.lastRegenAt = now;
  fr.pantry = {
    lv: 1,
    items: {
      bread: 2,
      fish_pie: 1,
      golden_croissant: 1,
    },
  };

  // 1. Reject invalid food id
  const errFood = eatFood(fr, 'stone', now);
  assert.equal(errFood.ok, false);
  assert.equal(errFood.error, 'not_food');

  // 2. Reject food not in pantry
  const errNone = eatFood(fr, 'honey_bun', now);
  assert.equal(errNone.ok, false);
  assert.equal(errNone.error, 'none');

  // 3. Eat bread (energy +30, no buff)
  const resBread = eatFood(fr, 'bread', now);
  assert.equal(resBread.ok, true);
  assert.equal(fr.pantry.items.bread, 1);
  assert.equal(fr.energy.cur, 330);
  assert.equal(fr.mealBuff, null);

  // 4. Eat fish_pie (energy +80, buff 'yield')
  const resFish = eatFood(fr, 'fish_pie', now);
  assert.equal(resFish.ok, true);
  assert.equal(fr.pantry.items.fish_pie, undefined); // deleted since 0
  assert.equal(fr.energy.cur, 400); // 330 + 80 capped at 400
  assert.deepEqual(fr.mealBuff, {
    id: 'yield',
    food: 'fish_pie',
    until: now + MEAL_BUFF_MS,
  });
  assert.deepEqual(activeMealBuff(fr, now + 10_000), fr.mealBuff);

  // 5. Eat golden_croissant (energy +150, buff 'yield_plus') — replaces existing buff
  const resCroissant = eatFood(fr, 'golden_croissant', now + 20_000);
  assert.equal(resCroissant.ok, true);
  assert.equal(fr.energy.cur, 400); // capped at 400
  assert.deepEqual(fr.mealBuff, {
    id: 'yield_plus',
    food: 'golden_croissant',
    until: now + 20_000 + MEAL_BUFF_MS,
  });

  // 6. Check buff expiry
  const afterExpiry = now + 20_000 + MEAL_BUFF_MS + 1;
  assert.equal(activeMealBuff(fr, afterExpiry), null);
  assert.equal(fr.mealBuff, null);
});

// =================================================================================================
// 5. Pure Helpers: Storage Caps, grantItems, campCrate Overflow & Claim
// =================================================================================================
test('storage cap helpers and grantItems pantry/warehouse routing', () => {
  assert.equal(warehouseCap(1), 300);
  assert.equal(warehouseCap(2), 600);
  assert.equal(pantryCap(1), 100);
  assert.equal(pantryCap(3), 300);

  const fr = defaultFrontier();
  fr.pantry = { lv: 1, items: {} };
  fr.warehouse = { lv: 1, items: {} };

  // Grant mixture of raw, refined, goods, and rare
  const now = 500_000;
  grantItems(fr, {
    wood: 50,
    ingot: 20,
    bread: 10,
    fish_pie: 5,
    ancient_gear: 2,
  }, now);

  // Pantry gets goods tier
  assert.deepEqual(fr.pantry.items, {
    bread: 10,
    fish_pie: 5,
  });
  assert.equal(totalStoreUnits(fr.pantry.items), 15);
  assert.equal(pantryFreeSpace(fr.pantry), 85);

  // Warehouse gets non-goods tier
  assert.deepEqual(fr.warehouse.items, {
    wood: 50,
    ingot: 20,
    ancient_gear: 2,
  });
  assert.equal(totalStoreUnits(fr.warehouse.items), 72);
  assert.equal(warehouseFreeSpace(fr.warehouse), 228);

  // Nothing overflowed yet
  assert.deepEqual(fr.campCrate.items, {});
  assert.equal(fr.campCrate.expiresAt, 0);
});

test('grantItems overflows to campCrate and extends expiresAt; claimCrate restores items', () => {
  const now = 1_000_000;
  const fr = defaultFrontier();
  fr.warehouse = { lv: 1, items: { wood: 290 } }; // free space = 10
  fr.pantry = { lv: 1, items: { bread: 95 } };     // free space = 5

  // Grant 25 wood (10 fits, 15 to crate) and 12 bread (5 fits, 7 to crate)
  const res = grantItems(fr, { wood: 25, bread: 12 }, now);
  assert.deepEqual(res.granted, { wood: 10, bread: 5 });
  assert.deepEqual(res.overflow, { wood: 15, bread: 7 });

  assert.equal(fr.warehouse.items.wood, 300);
  assert.equal(fr.pantry.items.bread, 100);
  assert.deepEqual(fr.campCrate.items, { wood: 15, bread: 7 });
  assert.equal(fr.campCrate.expiresAt, now + CAMP_CRATE_EXPIRE_MS);

  // Free some space in warehouse and pantry
  fr.warehouse.items.wood = 295; // 5 free
  fr.pantry.items.bread = 90;    // 10 free

  // Claim crate: moves 5 wood (10 left in crate) and all 7 bread (0 left)
  const claim1 = claimCrate(fr, now + 1000);
  assert.equal(claim1.ok, true);
  assert.deepEqual(claim1.moved, { wood: 5, bread: 7 });
  assert.equal(fr.warehouse.items.wood, 300);
  assert.equal(fr.pantry.items.bread, 97);
  assert.deepEqual(fr.campCrate.items, { wood: 10 });
  assert.equal(fr.campCrate.expiresAt, now + CAMP_CRATE_EXPIRE_MS);

  // Expired crate: after 24h, claim empties crate first
  const afterExpiry = now + CAMP_CRATE_EXPIRE_MS + 100;
  fr.warehouse.items.wood = 200; // lots of space
  const claimExpired = claimCrate(fr, afterExpiry);
  assert.equal(claimExpired.ok, true);
  assert.deepEqual(claimExpired.moved, {});
  assert.deepEqual(fr.campCrate.items, {});
  assert.equal(fr.campCrate.expiresAt, 0);
  assert.equal(fr.warehouse.items.wood, 200); // unchanged
});

// =================================================================================================
// 6. Pure Helpers: Yield Bonus Math
// =================================================================================================
test('applyYieldBonus: +20% for yield, +35% for yield_plus, floor with min +1', () => {
  // Zero / negative base
  assert.equal(applyYieldBonus(0, 'yield'), 0);
  assert.equal(applyYieldBonus(-5, 'yield_plus'), 0);
  assert.equal(applyYieldBonus(10, 'other_buff'), 0);
  assert.equal(applyYieldBonus(10, null), 0);

  // yield (+20%)
  assert.equal(applyYieldBonus(1, 'yield'), 1); // floor(0.2) = 0 -> min 1
  assert.equal(applyYieldBonus(4, 'yield'), 1); // floor(0.8) = 0 -> min 1
  assert.equal(applyYieldBonus(5, 'yield'), 1); // floor(1.0) = 1
  assert.equal(applyYieldBonus(6, 'yield'), 1); // floor(1.2) = 1
  assert.equal(applyYieldBonus(10, 'yield'), 2); // floor(2.0) = 2
  assert.equal(applyYieldBonus(15, 'yield'), 3); // floor(3.0) = 3

  // yield_plus (+35%)
  assert.equal(applyYieldBonus(1, 'yield_plus'), 1); // floor(0.35) = 0 -> min 1
  assert.equal(applyYieldBonus(2, 'yield_plus'), 1); // floor(0.70) = 0 -> min 1
  assert.equal(applyYieldBonus(3, 'yield_plus'), 1); // floor(1.05) = 1
  assert.equal(applyYieldBonus(6, 'yield_plus'), 2); // floor(2.10) = 2
  assert.equal(applyYieldBonus(10, 'yield_plus'), 3); // floor(3.50) = 3
  assert.equal(applyYieldBonus(20, 'yield_plus'), 7); // floor(7.00) = 7
});

// =================================================================================================
// 7. Service-Level Tests: Handlers and Grant Routing
// =================================================================================================
function createFakeEnv(initialNow = 1_000_000) {
  let currentTime = initialNow;
  const profiles = new Map();
  const marked = new Set();
  const instances = new Map();
  const presence = new Map();
  const broadcasts = [];
  const changedProfiles = [];

  const db = {
    getProfile: (id) => profiles.get(id) || null,
    markProfile: (id) => marked.add(id),
    getWorldZone: () => null,
    putWorldZone: () => {},
    listWorldZones: () => [],
  };

  const service = createSkyFrontierService({
    db,
    instances,
    presence,
    send: () => {},
    broadcast: (instId, msg) => broadcasts.push({ instId, msg }),
    isCouple: (p) => Boolean(p.partner_id && profiles.has(p.partner_id) && profiles.get(p.partner_id).partner_id === p.id),
    onProfileChanged: (p) => changedProfiles.push(p.id),
    now: () => currentTime,
    defaultFrontier,
  });

  return {
    service,
    profiles,
    marked,
    instances,
    presence,
    broadcasts,
    changedProfiles,
    setTime: (t) => { currentTime = t; },
    getTime: () => currentTime,
  };
}

test('service handle: sf_energy_daily', () => {
  const env = createFakeEnv(86_400_000 * 10);
  const p = { id: 'p1', frontier: defaultFrontier() };
  p.frontier.energy.cur = 50;
  p.frontier.energy.lastRegenAt = env.getTime();
  env.profiles.set(p.id, p);

  const ws = { instanceId: 'frontier:shard1~meadow' };
  const res1 = env.service.handle(ws, p, { type: 'sf_energy_daily' });
  assert.equal(res1.ok, true);
  assert.equal(res1.energy.cur, 250);
  assert.equal(p.frontier.energy.dailyFreeDay, 10);
  assert.ok(env.marked.has('p1'));

  // Duplicate rejected
  const res2 = env.service.handle(ws, p, { type: 'sf_energy_daily' });
  assert.equal(res2.ok, false);
  assert.equal(res2.error, 'claimed');
  assert.equal(res2.energy.cur, 250);
});

test('service handle: sf_energy_diamond deducts player diamonds', () => {
  const env = createFakeEnv(86_400_000 * 10);
  const p = { id: 'p1', diamonds: 120, frontier: defaultFrontier() };
  p.frontier.energy.cur = 0;
  p.frontier.energy.lastRegenAt = env.getTime();
  env.profiles.set(p.id, p);

  const ws = { instanceId: 'frontier:shard1~meadow' };

  // Refill 1: costs 50
  const res1 = env.service.handle(ws, p, { type: 'sf_energy_diamond' });
  assert.equal(res1.ok, true);
  assert.equal(res1.cost, 50);
  assert.equal(res1.diamonds, 70);
  assert.equal(p.diamonds, 70);
  assert.equal(res1.energy.cur, 200);

  // Refill 2: costs 100, player has 70 -> fails
  const res2 = env.service.handle(ws, p, { type: 'sf_energy_diamond' });
  assert.equal(res2.ok, false);
  assert.equal(res2.error, 'diamonds');
  assert.equal(res2.cost, 100);
  assert.equal(p.diamonds, 70);

  // Give player 50 more diamonds (total 120)
  p.diamonds = 120;
  const res3 = env.service.handle(ws, p, { type: 'sf_energy_diamond' });
  assert.equal(res3.ok, true);
  assert.equal(res3.cost, 100);
  assert.equal(res3.diamonds, 20);
  assert.equal(p.diamonds, 20);
  assert.equal(res3.energy.cur, 400);

  // Refill 3: limit reached
  const res4 = env.service.handle(ws, p, { type: 'sf_energy_diamond' });
  assert.equal(res4.ok, false);
  assert.equal(res4.error, 'limit');
});

test('service handle: sf_energy_gift requires couple and calls onProfileChanged(receiver)', () => {
  const env = createFakeEnv(86_400_000 * 4);
  const p1 = { id: 'p1', partner_id: 'p2', frontier: defaultFrontier() };
  const p2 = { id: 'p2', partner_id: 'p1', frontier: defaultFrontier() };
  p1.frontier.energy.lastRegenAt = env.getTime();
  p2.frontier.energy.cur = 100;
  p2.frontier.energy.lastRegenAt = env.getTime();
  env.profiles.set('p1', p1);
  env.profiles.set('p2', p2);

  const ws = { instanceId: 'frontier:shard1~meadow' };

  // Non-couple test
  const solo = { id: 'solo', partner_id: null, frontier: defaultFrontier() };
  const resNoCouple = env.service.handle(ws, solo, { type: 'sf_energy_gift' });
  assert.equal(resNoCouple.ok, false);
  assert.equal(resNoCouple.error, 'no_couple');

  // Valid couple gift
  const resGift = env.service.handle(ws, p1, { type: 'sf_energy_gift' });
  assert.equal(resGift.ok, true);
  assert.ok(resGift.energy);
  assert.equal(p1.frontier.energy.partnerGiftDay, 4);
  assert.equal(p2.frontier.energy.cur, 150);
  assert.ok(env.marked.has('p1'));
  assert.ok(env.marked.has('p2'));
  assert.ok(env.changedProfiles.includes('p2'));

  // Duplicate gift rejected
  const resDup = env.service.handle(ws, p1, { type: 'sf_energy_gift' });
  assert.equal(resDup.ok, false);
  assert.equal(resDup.error, 'already_gifted');
});

test('service handle: sf_eat & sf_pouch_set', () => {
  const env = createFakeEnv(2_000_000);
  const p = { id: 'p1', frontier: defaultFrontier() };
  p.frontier.pantry = { lv: 1, items: { honey_bun: 2 } };
  p.frontier.energy.cur = 50;
  p.frontier.energy.lastRegenAt = env.getTime();
  env.profiles.set('p1', p);

  const ws = { instanceId: 'frontier:shard1~meadow' };

  // sf_pouch_set: bad slot
  const badSlot = env.service.handle(ws, p, { type: 'sf_pouch_set', slot: 5, foodId: 'honey_bun' });
  assert.equal(badSlot.ok, false);
  assert.equal(badSlot.error, 'bad_slot');

  // sf_pouch_set: bad food id
  const badFood = env.service.handle(ws, p, { type: 'sf_pouch_set', slot: 0, foodId: 'iron_ore' });
  assert.equal(badFood.ok, false);
  assert.equal(badFood.error, 'not_food');

  // sf_pouch_set: valid food
  const setOk = env.service.handle(ws, p, { type: 'sf_pouch_set', slot: 0, foodId: 'honey_bun' });
  assert.equal(setOk.ok, true);
  assert.deepEqual(p.frontier.foodPouch, ['honey_bun', null, null, null]);

  // sf_eat: honey_bun (energy +50, buff 'regen')
  const eatOk = env.service.handle(ws, p, { type: 'sf_eat', foodId: 'honey_bun' });
  assert.equal(eatOk.ok, true);
  assert.equal(eatOk.foodId, 'honey_bun');
  assert.equal(eatOk.energy.cur, 100);
  assert.equal(eatOk.buff.id, 'regen');
  assert.equal(p.frontier.pantry.items.honey_bun, 1);
});

test('service handle: sf_crate_claim moves items back to pantry & warehouse', () => {
  const env = createFakeEnv(3_000_000);
  const p = { id: 'p1', frontier: defaultFrontier() };
  p.frontier.warehouse = { lv: 1, items: { wood: 200 } }; // cap 300, 100 free
  p.frontier.pantry = { lv: 1, items: { bread: 80 } };     // cap 100, 20 free
  p.frontier.campCrate = {
    items: { wood: 40, bread: 30 },
    expiresAt: 3_000_000 + CAMP_CRATE_EXPIRE_MS,
  };
  env.profiles.set('p1', p);

  const ws = { instanceId: 'frontier:shard1~meadow' };
  const res = env.service.handle(ws, p, { type: 'sf_crate_claim' });

  assert.equal(res.ok, true);
  assert.deepEqual(res.moved, { wood: 40, bread: 20 });
  assert.equal(p.frontier.warehouse.items.wood, 240);
  assert.equal(p.frontier.pantry.items.bread, 100);
  assert.deepEqual(p.frontier.campCrate.items, { bread: 10 });
  assert.ok(res.energy);
});

// =================================================================================================
// 8. Service-Level Tests: Strike Break with Yield and Yield Plus Buffs
// =================================================================================================
test('strike break: player with active yield (+20%) or yield_plus (+35%) gets bonus share', () => {
  const env = createFakeEnv(10_000_000);
  const shardId = 'sf_yield_test';
  const instanceId = `frontier:${shardId}~meadow`;
  const ws = { instanceId };

  // Set up instance in instances map
  env.instances.set(instanceId, new Set(['p_yield', 'p_yield_plus', 'p_normal']));

  // Player 1: yield buff
  const p1 = { id: 'p_yield', frontier: defaultFrontier() };
  p1.frontier.toolbelt.axe = 1;
  p1.frontier.mealBuff = { id: 'yield', food: 'fish_pie', until: 10_000_000 + MEAL_BUFF_MS };
  env.profiles.set(p1.id, p1);

  // Player 2: yield_plus buff
  const p2 = { id: 'p_yield_plus', frontier: defaultFrontier() };
  p2.frontier.toolbelt.axe = 1;
  p2.frontier.mealBuff = { id: 'yield_plus', food: 'golden_croissant', until: 10_000_000 + MEAL_BUFF_MS };
  env.profiles.set(p2.id, p2);

  // Player 3: no buff
  const p3 = { id: 'p_normal', frontier: defaultFrontier() };
  p3.frontier.toolbelt.axe = 1;
  env.profiles.set(p3.id, p3);

  // Load shard and find a real tree node in meadow
  const sh = env.service.loadShard(shardId);
  const treeNode = regionNodes('meadow').find((n) => n.type === 'tree');
  assert.ok(treeNode, 'Must have tree node in meadow');

  // Position all 3 players right at the tree
  env.presence.set(p1.id, { x: treeNode.x, z: treeNode.z });
  env.presence.set(p2.id, { x: treeNode.x, z: treeNode.z });
  env.presence.set(p3.id, { x: treeNode.x, z: treeNode.z });

  // Tree HP is 8.
  // Each player strikes equally so contributions are equal:
  sh.durable.nodes[treeNode.id] = { hp: 4, depletedUntil: 0 };
  let hits = new Map();
  hits.set(p1.id, 1);
  hits.set(p2.id, 1);
  hits.set(p3.id, 1);
  sh.live.hits.set(treeNode.id, hits);

  // Set time between strikes to respect swing gap
  env.setTime(10_000_000);
  env.service.strike(ws, p1, { nodeId: treeNode.id });

  env.setTime(10_001_000);
  env.service.strike(ws, p2, { nodeId: treeNode.id });

  env.setTime(10_002_000);
  env.service.strike(ws, p3, { nodeId: treeNode.id });

  // Final breaking strike by p1
  env.setTime(10_003_000);
  const breakRes = env.service.strike(ws, p1, { nodeId: treeNode.id });

  assert.equal(breakRes.ok, true);
  assert.equal(breakRes.broke, true);

  // Node broke broadcast was emitted
  const breakEvt = env.broadcasts.find((b) => b.msg.type === 'sf_node_break');
  assert.ok(breakEvt, 'Must broadcast sf_node_break');

  const finalShares = breakEvt.msg.shares;
  const s1 = finalShares[p1.id].wood;
  const s2 = finalShares[p2.id].wood;
  const s3 = finalShares[p3.id].wood;

  assert.ok(s1 > 0, 'Player 1 must receive wood');
  assert.ok(s2 > 0, 'Player 2 must receive wood');
  assert.ok(s3 > 0, 'Player 3 must receive wood');

  // Verify p1 warehouse got s1 wood, p2 warehouse got s2 wood, p3 warehouse got s3 wood
  assert.equal(p1.frontier.warehouse.items.wood, s1);
  assert.equal(p2.frontier.warehouse.items.wood, s2);
  assert.equal(p3.frontier.warehouse.items.wood, s3);
});

test('strike break solo with yield buff increases drop share by +20% (min +1)', () => {
  const env = createFakeEnv(20_000_000);
  const shardId = 'sf_solo_yield';
  const instanceId = `frontier:${shardId}~meadow`;
  const ws = { instanceId };

  env.instances.set(instanceId, new Set(['solo_player']));

  const p = { id: 'solo_player', frontier: defaultFrontier() };
  p.frontier.toolbelt.axe = 1;
  p.frontier.mealBuff = { id: 'yield', food: 'fish_pie', until: 20_000_000 + MEAL_BUFF_MS };
  env.profiles.set(p.id, p);

  const sh = env.service.loadShard(shardId);
  const treeNode = regionNodes('meadow').find((n) => n.type === 'tree');
  assert.ok(treeNode);
  env.presence.set(p.id, { x: treeNode.x, z: treeNode.z });

  // Base drop of tree is 6 wood. Solo drop without buff = 6.
  // With 'yield' (+20%): floor(6 * 0.20) = 1, so bonus is 1. Final share = 7.
  sh.durable.nodes[treeNode.id] = { hp: 1, depletedUntil: 0 };
  const res = env.service.strike(ws, p, { nodeId: treeNode.id });

  assert.equal(res.ok, true);
  assert.equal(res.broke, true);
  assert.equal(res.share.wood, 7);
  assert.equal(p.frontier.warehouse.items.wood, 7);
});

test('strike break solo with yield_plus buff increases drop share by +35% (min +1)', () => {
  const env = createFakeEnv(30_000_000);
  const shardId = 'sf_solo_yield_plus';
  const instanceId = `frontier:${shardId}~meadow`;
  const ws = { instanceId };

  env.instances.set(instanceId, new Set(['croissant_player']));

  const p = { id: 'croissant_player', frontier: defaultFrontier() };
  p.frontier.toolbelt.axe = 1;
  p.frontier.mealBuff = { id: 'yield_plus', food: 'golden_croissant', until: 30_000_000 + MEAL_BUFF_MS };
  env.profiles.set(p.id, p);

  const sh = env.service.loadShard(shardId);
  const treeNode = regionNodes('meadow').find((n) => n.type === 'tree');
  assert.ok(treeNode);
  env.presence.set(p.id, { x: treeNode.x, z: treeNode.z });

  // Base drop of tree is 6 wood. Solo drop without buff = 6.
  // With 'yield_plus' (+35%): floor(6 * 0.35) = 2, so bonus is 2. Final share = 8.
  sh.durable.nodes[treeNode.id] = { hp: 1, depletedUntil: 0 };
  const res = env.service.strike(ws, p, { nodeId: treeNode.id });

  assert.equal(res.ok, true);
  assert.equal(res.broke, true);
  assert.equal(res.share.wood, 8);
  assert.equal(p.frontier.warehouse.items.wood, 8);
});
