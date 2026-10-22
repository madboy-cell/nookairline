// tests/production_rules.test.js — Verification of Sky Frontier village production rules.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MATERIALS,
  isMaterial,
  materialTier,
} from '../shared/materials_catalog.js';

import {
  PRODUCTION_BUILDINGS,
  RECIPES,
  CROPS,
  WATER_SPEEDUP,
  storeOf,
  storeCap,
  storeUsed,
  canAdd,
  addItems,
  hasItems,
  takeItems,
  storeUpgradeCost,
  queueSlots,
  enqueue,
  settle,
  collect,
  skipCostDiamonds,
  plant,
  water,
  harvest,
  createProductionState,
  createStores,
  createPlot,
} from '../shared/production_rules.js';

test('recipe validity: every input/output is a real material and tool recipes have tool', () => {
  assert.equal(typeof PRODUCTION_BUILDINGS, 'object');
  const expectedBuildings = [
    'windmill_bakery',
    'patisserie',
    'mint',
    'workshop',
    'flower_greenhouse',
  ];

  for (const b of expectedBuildings) {
    assert.ok(Array.isArray(PRODUCTION_BUILDINGS[b]), `Building ${b} has recipes array`);
    for (const rId of PRODUCTION_BUILDINGS[b]) {
      const rec = RECIPES[rId];
      assert.ok(rec, `Recipe ${rId} exists in RECIPES`);
      assert.equal(rec.id, rId);
      assert.equal(rec.building, b, `Recipe ${rId} building must match ${b}`);
      assert.ok(rec.ms > 0, `Recipe ${rId} duration ms must be > 0`);

      // Inputs must all be valid materials from materials_catalog
      assert.ok(rec.inputs && Object.keys(rec.inputs).length > 0, `Recipe ${rId} must have inputs`);
      for (const [inKey, count] of Object.entries(rec.inputs)) {
        assert.ok(isMaterial(inKey), `Input ${inKey} of ${rId} is a valid material`);
        assert.ok(count > 0, `Input ${inKey} count must be > 0`);
      }

      // Check outputs or tool
      if (rec.tool) {
        assert.ok(['pickaxe', 'axe', 'staff'].includes(rec.tool.kind), `Tool kind ${rec.tool.kind} valid`);
        assert.ok(rec.tool.tier >= 1, `Tool tier ${rec.tool.tier} valid`);
        assert.deepEqual(rec.outputs, {}, `Tool recipe ${rId} outputs must be empty object`);
        assert.equal(rec.minLv, 2, `Tool recipe ${rId} requires minLv 2`);
        assert.equal(rec.ms, 600000, `Tool recipe ${rId} duration is 600s`);
      } else {
        assert.ok(rec.outputs && Object.keys(rec.outputs).length > 0, `Recipe ${rId} must have outputs`);
        for (const [outKey, count] of Object.entries(rec.outputs)) {
          assert.ok(isMaterial(outKey), `Output ${outKey} of ${rId} is a valid material`);
          assert.ok(count > 0, `Output ${outKey} count must be > 0`);
        }
      }
    }
  }

  // Check specific recipe properties
  assert.equal(RECIPES.golden_croissant.minLv, 3);
  assert.equal(RECIPES.golden_croissant.ms, 1200000);
  assert.equal(RECIPES.flour.minLv, 1);
  assert.equal(RECIPES.bread.minLv, 1);
});

test('enqueue errors: bad_recipe, wrong_building, level, queue_full, missing_inputs', () => {
  const stores = createStores(1, 1);
  const state = createProductionState();

  // 1. bad_recipe
  const resBad = enqueue(state, stores, 'non_existent_recipe', 'patisserie', 1, 1000);
  assert.deepEqual(resBad, { ok: false, error: 'bad_recipe' });

  // 2. wrong_building
  const resWrongBld = enqueue(state, stores, 'bread', 'windmill_bakery', 1, 1000);
  assert.deepEqual(resWrongBld, { ok: false, error: 'wrong_building' });

  // 3. level
  const resLv = enqueue(state, stores, 'golden_croissant', 'patisserie', 2, 1000);
  assert.deepEqual(resLv, { ok: false, error: 'level' });

  // 4. missing_inputs
  const resMissing = enqueue(state, stores, 'bread', 'patisserie', 1, 1000);
  assert.deepEqual(resMissing, { ok: false, error: 'missing_inputs' });

  // Stock enough flour for 3 breads (2 each = 6 flour)
  addItems(stores, { flour: 10 });
  assert.equal(hasItems(stores, { flour: 6 }), true);

  // Enqueue 3 breads at lv 1 (queueSlots(1) = 3)
  assert.ok(enqueue(state, stores, 'bread', 'patisserie', 1, 1000).ok);
  assert.ok(enqueue(state, stores, 'bread', 'patisserie', 1, 1000).ok);
  assert.ok(enqueue(state, stores, 'bread', 'patisserie', 1, 1000).ok);
  assert.equal(state.queue.length, 3);

  // 5. queue_full
  const resFull = enqueue(state, stores, 'bread', 'patisserie', 1, 1000);
  assert.deepEqual(resFull, { ok: false, error: 'queue_full' });
});

test('sequential timing and speedMult in job queue', () => {
  const stores = createStores(5, 5);
  addItems(stores, { sky_wheat: 20 });
  const state = createProductionState();

  // Job 1: flour takes 60,000 ms at normal speed
  const r1 = enqueue(state, stores, 'flour', 'windmill_bakery', 10, 1000);
  assert.ok(r1.ok);
  assert.equal(state.queue[0].startAt, 1000);
  assert.equal(state.queue[0].doneAt, 61000);

  // Job 2: enqueued at t=5000, must start after Job 1 finishes (t=61000)
  const r2 = enqueue(state, stores, 'flour', 'windmill_bakery', 10, 5000);
  assert.ok(r2.ok);
  assert.equal(state.queue[1].startAt, 61000);
  assert.equal(state.queue[1].doneAt, 121000);

  // Job 3: enqueued with speedMult=2, duration is 60,000 / 2 = 30,000 ms
  const r3 = enqueue(state, stores, 'flour', 'windmill_bakery', 10, 6000, { speedMult: 2 });
  assert.ok(r3.ok);
  assert.equal(state.queue[2].startAt, 121000);
  assert.equal(state.queue[2].doneAt, 151000);

  // Settle at t=160000 (all done)
  assert.equal(settle(state, 160000), 3);
  assert.equal(state.queue.length, 0);

  // Job 4: enqueued at t=200000 (after queue has cleared), starts at t=200000
  const r4 = enqueue(state, stores, 'flour', 'windmill_bakery', 10, 200000);
  assert.ok(r4.ok);
  assert.equal(state.queue[0].startAt, 200000);
  assert.equal(state.queue[0].doneAt, 260000);
});

test('offline settle of multiple jobs including tools', () => {
  const stores = createStores(5, 5);
  addItems(stores, {
    wood: 10,
    ingot: 20,
    plank: 20,
  });
  const state = createProductionState();

  // Enqueue 2 planks (60s each) and 1 pickaxe II (600s) on workshop lv 4 (4 slots)
  assert.ok(enqueue(state, stores, 'plank', 'workshop', 4, 0).ok);          // doneAt 60,000
  assert.ok(enqueue(state, stores, 'plank', 'workshop', 4, 0).ok);          // doneAt 120,000
  assert.ok(enqueue(state, stores, 'tool_pickaxe_2', 'workshop', 4, 0).ok); // doneAt 720,000

  assert.equal(state.queue.length, 3);

  // Fast forward offline to t=90s (1st plank done, 2nd plank in progress)
  const settled1 = settle(state, 90000);
  assert.equal(settled1, 1);
  assert.equal(state.queue.length, 2);
  assert.deepEqual(state.output, { plank: 1 });
  assert.deepEqual(state.tools, []);

  // Fast forward offline to t=1000s (all finished)
  const settled2 = settle(state, 1000000);
  assert.equal(settled2, 2);
  assert.equal(state.queue.length, 0);
  assert.deepEqual(state.output, { plank: 2 });
  assert.deepEqual(state.tools, [{ kind: 'pickaxe', tier: 2 }]);
});

test('collect with overflow: output stays in building until space is freed', () => {
  const stores = createStores(1, 1); // pantry cap = 100
  // Fill pantry with 95 honey buns
  addItems(stores, { honey_bun: 95 });
  assert.equal(storeUsed(stores.pantry), 95);

  const state = createProductionState();
  state.output = { bread: 10 }; // goods tier -> pantry
  state.tools = [{ kind: 'staff', tier: 1 }];

  // Collect: only 5 bread can fit into pantry, 5 overflow
  const res = collect(state, stores, 0);
  assert.equal(res.ok, false);
  assert.deepEqual(res.collected, { bread: 5 });
  assert.deepEqual(res.leftover, { bread: 5 });
  assert.deepEqual(res.tools, [{ kind: 'staff', tier: 1 }]);

  // Leftover bread stays in building output
  assert.deepEqual(state.output, { bread: 5 });
  // Tools are cleared from state
  assert.deepEqual(state.tools, []);
  assert.equal(storeUsed(stores.pantry), 100);

  // Upgrade pantry to lv 2 (cap 200)
  stores.pantry.lv = 2;
  const res2 = collect(state, stores, 0);
  assert.equal(res2.ok, true);
  assert.deepEqual(res2.collected, { bread: 5 });
  assert.deepEqual(res2.leftover, {});
  assert.deepEqual(res2.tools, []);
  assert.deepEqual(state.output, {});
  assert.equal(storeUsed(stores.pantry), 105);
});

test('atomic take: take nothing unless all requested items are present', () => {
  const stores = createStores(1, 1);
  addItems(stores, { wood: 5, stone: 3 });

  // Asking for wood: 5 and stone: 4 (stone is 1 short)
  const success = takeItems(stores, { wood: 5, stone: 4 });
  assert.equal(success, false);

  // None of the items were deducted
  assert.equal(stores.warehouse.items.wood, 5);
  assert.equal(stores.warehouse.items.stone, 3);

  // Valid take
  const success2 = takeItems(stores, { wood: 2, stone: 3 });
  assert.equal(success2, true);
  assert.equal(stores.warehouse.items.wood, 3);
  assert.equal(stores.warehouse.items.stone, undefined); // deleted when 0
});

test('queue slot counts scale with building level', () => {
  assert.equal(queueSlots(1), 3);
  assert.equal(queueSlots(2), 3);
  assert.equal(queueSlots(3), 3);
  assert.equal(queueSlots(4), 4);
  assert.equal(queueSlots(5), 4);
  assert.equal(queueSlots(6), 4);
  assert.equal(queueSlots(7), 5);
  assert.equal(queueSlots(8), 5);
  assert.equal(queueSlots(9), 5);
  assert.equal(queueSlots(10), 6);
  assert.equal(queueSlots(15), 6);
});

test('plot lifecycle: plant, water speedup, not_ready, and harvest', () => {
  const plot = createPlot('owner_alice');
  const stores = createStores(1, 1);

  // Empty plot cannot be harvested or watered
  assert.deepEqual(harvest(plot, stores, 1000), { ok: false, error: 'empty' });
  assert.deepEqual(water(plot, 'helper_bob', 1000), { ok: false, error: 'empty' });

  // 1. Plant without required seeds fails
  assert.deepEqual(plant(plot, stores, 'herb', 1000), { ok: false, error: 'missing_seed' });

  // 2. Plant sky_wheat (no seed required)
  const plantRes = plant(plot, stores, 'sky_wheat', 1000);
  assert.ok(plantRes.ok);
  assert.equal(plot.crop, 'sky_wheat');
  assert.equal(plot.plantedAt, 1000);
  assert.equal(plot.readyAt, 121000); // 1000 + 120,000 ms
  assert.equal(plot.wateredBy, null);

  // Cannot plant while busy
  assert.deepEqual(plant(plot, stores, 'sky_wheat', 2000), { ok: false, error: 'busy' });

  // 3. Water restrictions: owner cannot water own crop if ownerId is set
  const waterOwner = water(plot, 'owner_alice', 21000);
  assert.deepEqual(waterOwner, { ok: false, error: 'owner' });

  // Helper bob waters at t=21,000 (remaining: 100,000 ms, speedup 25% = 25,000 ms)
  const waterHelper = water(plot, 'helper_bob', 21000);
  assert.ok(waterHelper.ok);
  assert.equal(plot.wateredBy, 'helper_bob');
  assert.equal(plot.readyAt, 96000); // 121000 - 25000

  // Water can only happen once per crop
  assert.deepEqual(water(plot, 'helper_charlie', 25000), { ok: false, error: 'already_watered' });

  // 4. Harvest before readyAt fails
  assert.deepEqual(harvest(plot, stores, 90000), { ok: false, error: 'not_ready' });

  // 5. Harvest when ready (t=96000)
  const harvestRes = harvest(plot, stores, 96000);
  assert.ok(harvestRes.ok);
  assert.deepEqual(harvestRes.items, { sky_wheat: 4 });

  // Plot is reset
  assert.equal(plot.crop, null);
  assert.equal(plot.plantedAt, 0);
  assert.equal(plot.readyAt, 0);
  assert.equal(plot.wateredBy, null);

  // Harvested items are deposited into stores
  assert.equal(stores.warehouse.items.sky_wheat, 4);

  // 6. Planting crops that consume seeds
  addItems(stores, { herb_seed: 2 });
  assert.ok(plant(plot, stores, 'herb', 100000).ok);
  assert.equal(stores.warehouse.items.herb_seed, 1); // 1 seed consumed
});

test('storeOf: goods tier goes to pantry, all other tiers go to warehouse', () => {
  // Goods tier -> pantry
  assert.equal(storeOf('bread'), 'pantry');
  assert.equal(storeOf('honey_bun'), 'pantry');
  assert.equal(storeOf('fish_pie'), 'pantry');
  assert.equal(storeOf('berry_tart'), 'pantry');
  assert.equal(storeOf('boba_tea'), 'pantry');
  assert.equal(storeOf('golden_croissant'), 'pantry');
  assert.equal(storeOf('potion_small'), 'pantry');
  assert.equal(storeOf('repair_kit'), 'pantry');
  assert.equal(storeOf('pet_treat'), 'pantry');

  // Refined tier -> warehouse
  assert.equal(storeOf('plank'), 'warehouse');
  assert.equal(storeOf('ingot'), 'warehouse');
  assert.equal(storeOf('crystal_glass'), 'warehouse');
  assert.equal(storeOf('flour'), 'warehouse');
  assert.equal(storeOf('herb'), 'warehouse');
  assert.equal(storeOf('thread'), 'warehouse');

  // Raw tier -> warehouse
  assert.equal(storeOf('wood'), 'warehouse');
  assert.equal(storeOf('stone'), 'warehouse');
  assert.equal(storeOf('crystal_ore'), 'warehouse');
  assert.equal(storeOf('sky_wheat'), 'warehouse');
  assert.equal(storeOf('golden_wheat'), 'warehouse');
  assert.equal(storeOf('berries_crop'), 'warehouse');

  // Rare tier -> warehouse
  assert.equal(storeOf('ancient_gear'), 'warehouse');
  assert.equal(storeOf('boss_core_moss'), 'warehouse');
});

test('storage capacities, upgrade costs, and diamond skips', () => {
  // Store capacities: warehouse 300*lv, pantry 100*lv
  assert.equal(storeCap('warehouse', 1), 300);
  assert.equal(storeCap('warehouse', 2), 600);
  assert.equal(storeCap('warehouse', 3), 900);
  assert.equal(storeCap('pantry', 1), 100);
  assert.equal(storeCap('pantry', 2), 200);

  // Upgrade costs: {plank: 10*lv, ingot: 5*lv, ancient_gear: lv>=2 ? lv-1 : 0} (zero keys omitted)
  assert.deepEqual(storeUpgradeCost('warehouse', 1), { plank: 10, ingot: 5 });
  assert.deepEqual(storeUpgradeCost('warehouse', 2), { plank: 20, ingot: 10, ancient_gear: 1 });
  assert.deepEqual(storeUpgradeCost('pantry', 3), { plank: 30, ingot: 15, ancient_gear: 2 });

  // canAdd simulation without mutation
  const stores = createStores(1, 1);
  addItems(stores, { wood: 295 });
  const checkFit = canAdd(stores, { wood: 10 });
  assert.equal(checkFit.ok, false);
  assert.deepEqual(checkFit.overflow, { wood: 5 });
  // stores was not mutated
  assert.equal(stores.warehouse.items.wood, 295);

  // Diamond skips: ceil(msLeft / 60000) * 2
  assert.equal(skipCostDiamonds(0), 0);
  assert.equal(skipCostDiamonds(-500), 0);
  assert.equal(skipCostDiamonds(1), 2);
  assert.equal(skipCostDiamonds(60000), 2);
  assert.equal(skipCostDiamonds(60001), 4);
  assert.equal(skipCostDiamonds(120000), 4);
});
