// tests/monument_rules.test.js — Verification for Monument Rules & Camp Props (Master Plan v2 §11.4–§11.5).
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MONUMENTS,
  CUT_WONDERS,
  CAMP_PROPS,
  COSMETIC_DECOR,
  PROTECTED_DECOR,
  CUT_DECOR,
  monumentState,
  isUnlocked,
  contributeStage,
  dailyWish,
  wellRestedBuff,
  dateBuff,
  propProduction,
  WISH_TABLE,
} from '../shared/monument_rules.js';
import { isMaterial } from '../shared/materials_catalog.js';
import { DECOR, WONDERS } from '../shared/catalog_landmarks.js';

// Seeded PRNG (Mulberry32) for deterministic statistical tests
function mulberry32(seed) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('all costs across monuments, camp props, and cosmetic decor use real materials', () => {
  // 1. Monuments
  for (const [id, mon] of Object.entries(MONUMENTS)) {
    assert.ok(typeof mon.id === 'string', `${id} must have string id`);
    assert.ok(typeof mon.name === 'string', `${id} must have string name`);
    assert.ok(Array.isArray(mon.stages) && mon.stages.length >= 2, `${id} must have >= 2 stages`);
    for (let i = 0; i < mon.stages.length; i++) {
      const stage = mon.stages[i];
      assert.ok(typeof stage.gold === 'number' && stage.gold > 0, `${id} stage ${i} must require gold`);
      for (const [matId, qty] of Object.entries(stage)) {
        if (matId === 'gold') continue;
        assert.ok(isMaterial(matId), `${id} stage ${i} material "${matId}" must exist in materials catalog`);
        assert.ok(Number.isInteger(qty) && qty > 0, `${id} stage ${i} material "${matId}" qty must be > 0`);
      }
    }
  }

  // 2. Camp Props
  assert.equal(Object.keys(CAMP_PROPS).length, 8, 'Must have exactly 8 camp props');
  for (const [id, prop] of Object.entries(CAMP_PROPS)) {
    assert.ok(prop.cost && typeof prop.cost === 'object', `${id} must have cost object`);
    for (const [matId, qty] of Object.entries(prop.cost)) {
      assert.ok(isMaterial(matId), `${id} material "${matId}" must exist in materials catalog`);
      assert.ok(Number.isInteger(qty) && qty > 0, `${id} material "${matId}" qty must be > 0`);
    }
  }

  // 3. Cosmetic Decor
  assert.equal(Object.keys(COSMETIC_DECOR).length, 12, 'Must have exactly 12 cosmetic decor');
  for (const [id, decor] of Object.entries(COSMETIC_DECOR)) {
    assert.ok(decor.cost && typeof decor.cost === 'object', `${id} must have cost object`);
    for (const [matId, qty] of Object.entries(decor.cost)) {
      assert.ok(isMaterial(matId), `${id} material "${matId}" must exist in materials catalog`);
      assert.ok(Number.isInteger(qty) && qty > 0, `${id} material "${matId}" qty must be > 0`);
    }
  }
});

test('decor partition covers every DECOR key exactly once and the museum is protected', () => {
  const allDecorKeys = Object.keys(DECOR);
  assert.equal(allDecorKeys.length, 38, 'catalog_landmarks.js DECOR must have 38 keys');

  const campKeys = Object.keys(CAMP_PROPS);
  const cosmeticKeys = Object.keys(COSMETIC_DECOR);
  const protectedKeys = [...PROTECTED_DECOR];
  const cutKeys = [...CUT_DECOR];

  assert.equal(campKeys.length, 8, '8 camp props');
  assert.equal(cosmeticKeys.length, 12, '12 cosmetic decor');
  assert.equal(protectedKeys.length, 1, '1 protected decor');
  assert.equal(cutKeys.length, 17, '17 cut decor');

  // Verify museum protection
  assert.deepEqual(protectedKeys, ['dec_nookairline_museum'], 'Museum must be protected');
  assert.ok(!cutKeys.includes('dec_nookairline_museum'), 'Museum must not be in CUT_DECOR');

  // Check partition: disjointness
  const combined = [...campKeys, ...cosmeticKeys, ...protectedKeys, ...cutKeys];
  assert.equal(combined.length, 38, 'Total sum of partition sizes must equal 38');

  const uniqueKeys = new Set(combined);
  assert.equal(uniqueKeys.size, 38, 'All keys in the partition must be mutually exclusive');

  // Check union covers all DECOR keys exactly
  for (const key of allDecorKeys) {
    assert.ok(uniqueKeys.has(key), `DECOR key "${key}" must be included in the partition`);
  }
});

test('wonders partition: 4 launch monuments + 4 update 1 monuments + 4 cut wonders cover all 12 WONDERS', () => {
  const allWonderKeys = Object.keys(WONDERS);
  assert.equal(allWonderKeys.length, 12, 'catalog_landmarks.js WONDERS must have 12 keys');

  const monumentKeys = Object.keys(MONUMENTS);
  assert.equal(monumentKeys.length, 8, '8 monuments total');

  const launchMonuments = monumentKeys.filter((k) => MONUMENTS[k].launch === true);
  const update1Monuments = monumentKeys.filter((k) => MONUMENTS[k].launch === false);

  assert.equal(launchMonuments.length, 4, '4 launch monuments');
  assert.deepEqual(launchMonuments.sort(), ['wnd_ferris', 'wnd_fountain', 'wnd_onsen', 'wnd_tea_pavilion'].sort());

  assert.equal(update1Monuments.length, 4, '4 update1 monuments');
  assert.deepEqual(update1Monuments.sort(), ['wnd_atlantis_sanctuary', 'wnd_aurora_observatory', 'wnd_mirage_palace', 'wnd_world_tree'].sort());

  assert.equal(CUT_WONDERS.length, 4, '4 cut wonders');
  assert.deepEqual(CUT_WONDERS.slice().sort(), ['wnd_burj_khalifa', 'wnd_casino_dome', 'wnd_sakura_pagoda', 'wnd_sky_airship_dock'].sort());

  const union = new Set([...monumentKeys, ...CUT_WONDERS]);
  assert.equal(union.size, 12, 'Union must be exactly 12 wonders without overlap');
  for (const wk of allWonderKeys) {
    assert.ok(union.has(wk), `Wonder key "${wk}" must be in monuments or cut wonders`);
  }
});

test('unlock chain: wnd_fountain is free, wnd_onsen needs story, tea & ferris unlock when wnd_onsen is built', () => {
  // 1. Fresh state
  const state = monumentState();

  // Fountain is free from start
  assert.equal(isUnlocked('wnd_fountain', []), true);
  assert.equal(isUnlocked('wnd_fountain', state), true);

  // Onsen is locked from start
  assert.equal(isUnlocked('wnd_onsen', []), false);
  assert.equal(isUnlocked('wnd_onsen', state), false);

  // Tea and Ferris are locked
  assert.equal(isUnlocked('wnd_tea_pavilion', []), false);
  assert.equal(isUnlocked('wnd_ferris', []), false);
  assert.equal(isUnlocked('wnd_tea_pavilion', state), false);
  assert.equal(isUnlocked('wnd_ferris', state), false);

  // 2. Story chapter 4 unlocks Onsen
  state.unlocked.push('wnd_onsen');
  assert.equal(isUnlocked('wnd_onsen', ['wnd_onsen']), true);
  assert.equal(isUnlocked('wnd_onsen', state), true);

  // Tea & Ferris are STILL locked because Onsen is not built yet
  assert.equal(isUnlocked('wnd_tea_pavilion', ['wnd_onsen'], state), false);
  assert.equal(isUnlocked('wnd_ferris', ['wnd_onsen'], state), false);

  // 3. Complete Onsen
  state.wnd_onsen.stage = 2;
  state.wnd_onsen.built = true;

  // Now Tea and Ferris are unlocked!
  assert.equal(isUnlocked('wnd_tea_pavilion', state), true);
  assert.equal(isUnlocked('wnd_ferris', state), true);
  assert.equal(isUnlocked('wnd_tea_pavilion', ['wnd_onsen'], state), true);
  assert.equal(isUnlocked('wnd_ferris', ['wnd_onsen'], state), true);

  // Also supports explicit unlocked token
  assert.equal(isUnlocked('wnd_tea_pavilion', ['wnd_onsen_built']), true);
  assert.equal(isUnlocked('wnd_ferris', ['wnd_tea_pavilion', 'wnd_ferris']), true);

  // Update 1 monuments stay locked unless explicitly granted
  assert.equal(isUnlocked('wnd_world_tree', state), false);
  assert.equal(isUnlocked('wnd_world_tree', ['wnd_world_tree']), true);
});

test('stage payment atomicity: all or nothing, stage advances, error handling', () => {
  const state = monumentState();
  state.unlocked.push('wnd_onsen');

  // Stage 0 requirements for wnd_onsen: { wood: 40, stone: 40, gold: 2000 }
  // Test 1: Missing gold
  const stores1 = { wood: 100, stone: 100 };
  const wallet1 = { gold: 1500 }; // need 2000
  const res1 = contributeStage(state, 'wnd_onsen', stores1, null, wallet1);
  assert.equal(res1.ok, false);
  assert.equal(res1.error, 'missing');
  assert.equal(res1.stage, 0);
  assert.equal(stores1.wood, 100, 'Wood must not be deducted on failure');
  assert.equal(stores1.stone, 100, 'Stone must not be deducted on failure');
  assert.equal(wallet1.gold, 1500, 'Gold must not be deducted on failure');
  assert.equal(state.wnd_onsen.stage, 0);

  // Test 2: Missing one material (stone)
  const stores2 = { wood: 50, stone: 30 }; // need 40 stone
  const wallet2 = { gold: 5000 };
  const res2 = contributeStage(state, 'wnd_onsen', stores2, null, wallet2);
  assert.equal(res2.ok, false);
  assert.equal(res2.error, 'missing');
  assert.equal(res2.stage, 0);
  assert.equal(stores2.wood, 50, 'Wood must not be deducted on failure');
  assert.equal(stores2.stone, 30, 'Stone must not be deducted on failure');
  assert.equal(wallet2.gold, 5000, 'Gold must not be deducted on failure');

  // Test 3: Exact payment with takeFn
  const stores3 = { warehouse: { items: { wood: 40, stone: 40 } } };
  const wallet3 = { gold: 2000 };
  let takeFnCalled = false;
  const customTakeFn = (stores, items) => {
    takeFnCalled = true;
    for (const [k, v] of Object.entries(items)) {
      stores.warehouse.items[k] -= v;
    }
  };

  const res3 = contributeStage(state, 'wnd_onsen', stores3, customTakeFn, wallet3);
  assert.equal(res3.ok, true);
  assert.equal(res3.stage, 1);
  assert.equal(res3.built, false);
  assert.equal(takeFnCalled, true);
  assert.equal(stores3.warehouse.items.wood, 0);
  assert.equal(stores3.warehouse.items.stone, 0);
  assert.equal(wallet3.gold, 0);
  assert.equal(state.wnd_onsen.stage, 1);
  assert.equal(state.wnd_onsen.built, false);

  // Test 4: Cannot pay stage 1 if missing materials
  // Stage 1 requirements: { plank: 30, crystal_glass: 10, boss_core_moss: 2, gold: 4000 }
  const stores4 = { plank: 30, crystal_glass: 10 }; // missing boss_core_moss
  const res4 = contributeStage(state, 'wnd_onsen', stores4, null, 10000);
  assert.equal(res4.ok, false);
  assert.equal(res4.error, 'missing');
  assert.equal(res4.stage, 1);
  assert.equal(stores4.plank, 30, 'Plank preserved on failure');
  assert.equal(stores4.crystal_glass, 10, 'Glass preserved on failure');

  // Test 5: Successful completion of stage 1
  const stores5 = { plank: 50, crystal_glass: 20, boss_core_moss: 5 };
  const wallet5 = { gold: 10000 };
  const res5 = contributeStage(state, 'wnd_onsen', stores5, null, wallet5);
  assert.equal(res5.ok, true);
  assert.equal(res5.stage, 2);
  assert.equal(res5.built, true);
  assert.equal(stores5.plank, 20);
  assert.equal(stores5.crystal_glass, 10);
  assert.equal(stores5.boss_core_moss, 3);
  assert.equal(wallet5.gold, 6000);
  assert.equal(state.wnd_onsen.stage, 2);
  assert.equal(state.wnd_onsen.built, true);

  // Onsen being built automatically unlocked tea & ferris in state
  assert.equal(isUnlocked('wnd_tea_pavilion', state), true);
  assert.equal(isUnlocked('wnd_ferris', state), true);

  // Test 6: Contributing to a completed monument returns 'done'
  const res6 = contributeStage(state, 'wnd_onsen', { wood: 999 }, null, 99999);
  assert.equal(res6.ok, false);
  assert.equal(res6.error, 'done');
  assert.equal(res6.stage, 2);

  // Test 7: Contributing to a locked monument returns 'locked'
  const lockedState = monumentState();
  const res7 = contributeStage(lockedState, 'wnd_onsen', { wood: 999, stone: 999 }, null, 99999);
  assert.equal(res7.ok, false);
  assert.equal(res7.error, 'locked');
  assert.equal(res7.stage, 0);
});

test('dailyWish distribution sanity with seeded rng and exact boundary tests', () => {
  // 1. Boundary checks
  assert.deepEqual(dailyWish(() => 0.0), { crystal_glass: 2 });
  assert.deepEqual(dailyWish(() => 0.39999), { crystal_glass: 2 });
  assert.deepEqual(dailyWish(() => 0.40), { ancient_gear: 1 });
  assert.deepEqual(dailyWish(() => 0.54999), { ancient_gear: 1 });
  assert.deepEqual(dailyWish(() => 0.55), { boss_core_moss: 1 });
  assert.deepEqual(dailyWish(() => 0.64999), { boss_core_moss: 1 });
  assert.deepEqual(dailyWish(() => 0.65), { starlight_essence: 1 });
  assert.deepEqual(dailyWish(() => 0.69999), { starlight_essence: 1 });
  assert.deepEqual(dailyWish(() => 0.70), { honey: 5 });
  assert.deepEqual(dailyWish(() => 0.99999), { honey: 5 });

  // 2. Statistical sanity test (10,000 draws)
  const rng = mulberry32(1337);
  const counts = {
    crystal_glass: 0,
    ancient_gear: 0,
    boss_core_moss: 0,
    starlight_essence: 0,
    honey: 0,
  };

  const N = 10000;
  for (let i = 0; i < N; i++) {
    const wish = dailyWish(rng);
    const item = Object.keys(wish)[0];
    counts[item]++;
  }

  // Tolerances: 40% -> [38%, 42%], 30% -> [28%, 32%], 15% -> [13.5%, 16.5%], 10% -> [8.5%, 11.5%], 5% -> [3.8%, 6.2%]
  const glassPct = counts.crystal_glass / N;
  const honeyPct = counts.honey / N;
  const gearPct = counts.ancient_gear / N;
  const mossPct = counts.boss_core_moss / N;
  const starPct = counts.starlight_essence / N;

  assert.ok(glassPct >= 0.38 && glassPct <= 0.42, `crystal_glass expected ~40%, got ${(glassPct * 100).toFixed(1)}%`);
  assert.ok(honeyPct >= 0.28 && honeyPct <= 0.32, `honey expected ~30%, got ${(honeyPct * 100).toFixed(1)}%`);
  assert.ok(gearPct >= 0.135 && gearPct <= 0.165, `ancient_gear expected ~15%, got ${(gearPct * 100).toFixed(1)}%`);
  assert.ok(mossPct >= 0.085 && mossPct <= 0.115, `boss_core_moss expected ~10%, got ${(mossPct * 100).toFixed(1)}%`);
  assert.ok(starPct >= 0.038 && starPct <= 0.062, `starlight_essence expected ~5%, got ${(starPct * 100).toFixed(1)}%`);
});

test('propProduction handles cycle calculation and offline catch-up capped at 6 cycles', () => {
  const beehive = CAMP_PROPS.dec_honey_beehive;
  const pond = CAMP_PROPS.dec_koi_barrel_pond;

  const every2h = beehive.effect.everyMs; // 2 hours = 7,200,000 ms
  const every3h = pond.effect.everyMs;    // 3 hours = 10,800,000 ms

  const t0 = 1_000_000_000;

  // 1. Partial cycle: no items
  const rPartial = propProduction(beehive, t0, t0 + 0.5 * every2h);
  assert.deepEqual(rPartial.items, {});
  assert.equal(rPartial.nextLastAt, t0);

  // 2. Exactly 1 cycle
  const r1 = propProduction(beehive, t0, t0 + 1 * every2h);
  assert.deepEqual(r1.items, { honey: 1 });
  assert.equal(r1.nextLastAt, t0 + every2h);

  // 3. 3.5 cycles: produces 3 cycles, nextLastAt preserves remainder
  const r3 = propProduction(beehive, t0, t0 + 3.5 * every2h);
  assert.deepEqual(r3.items, { honey: 3 });
  assert.equal(r3.nextLastAt, t0 + 3 * every2h);

  // 4. Exactly 6 cycles (at cap)
  const r6 = propProduction(beehive, t0, t0 + 6 * every2h);
  assert.deepEqual(r6.items, { honey: 6 });
  assert.equal(r6.nextLastAt, t0 + 6 * every2h);

  // 5. 10 cycles (exceeds cap): capped at 6 cycles, overflow discarded
  const t10 = t0 + 10.25 * every2h;
  const r10 = propProduction(beehive, t0, t10);
  assert.deepEqual(r10.items, { honey: 6 }, 'Must be capped at 6 cycles');
  // nextLastAt preserves the 0.25 cycle fraction of current time
  assert.equal(r10.nextLastAt, t10 - 0.25 * every2h);

  // 6. Calling again immediately at t10 with nextLastAt yields 0 items (no backdoor overflow)
  const rImmediate = propProduction(beehive, r10.nextLastAt, t10);
  assert.deepEqual(rImmediate.items, {}, 'Immediate second call must yield nothing');

  // 7. Testing koi pond (every 3h produces 1 fish)
  const rPond = propProduction(pond, t0, t0 + 20 * every3h); // 20 cycles
  assert.deepEqual(rPond.items, { fish: 6 }, 'Koi pond capped at 6 fish');

  // 8. Non-producing props return empty items
  const rTent = propProduction(CAMP_PROPS.dec_tent, t0, t0 + 100_000_000);
  assert.deepEqual(rTent.items, {});

  // 9. Can accept prop key as string
  const rString = propProduction('dec_honey_beehive', t0, t0 + 2 * every2h);
  assert.deepEqual(rString.items, { honey: 2 });
});

test('buff generators return expected duration and values', () => {
  const now = 1_700_000_000_000;

  const rested = wellRestedBuff(now);
  assert.equal(rested.type, 'well_rested');
  assert.equal(rested.yieldPct, 15);
  assert.equal(rested.startedAt, now);
  assert.equal(rested.durationMs, 30 * 60e3);
  assert.equal(rested.until, now + 30 * 60e3);

  const date = dateBuff(now);
  assert.equal(date.type, 'date_buff');
  assert.equal(date.pct, 10);
  assert.equal(date.startedAt, now);
  assert.equal(date.durationMs, 30 * 60e3);
  assert.equal(date.until, now + 30 * 60e3);
});
