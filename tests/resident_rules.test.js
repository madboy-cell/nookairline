// tests/resident_rules.test.js — Pure game rules tests for village residents (Master Plan §11.3).
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  RESIDENTS,
  MEAL_INTERVAL_MS,
  MEAL_QUALITY,
  RESIDENTS_PER_COTTAGE,
  residentsPerCottage,
  clamp,
  cottageCap,
  housingCap,
  isFed,
  staffBonus,
  assignResident,
  residentForBuilding,
  buildingSpeedMult,
  buildingBonusChance,
  rollBonusOutput,
  feedResidents,
} from '../shared/resident_rules.js';

test('RESIDENTS catalog schema, launch vs update1 residents', () => {
  assert.equal(typeof RESIDENTS, 'object');
  const keys = Object.keys(RESIDENTS);
  assert.deepEqual(keys, [
    'baker',
    'miner',
    'smith',
    'botanist',
    'pet_keeper',
    'captain',
    'cartographer',
  ]);

  // 5 launch residents, 2 update 1
  const launch = keys.filter((k) => !RESIDENTS[k].update1);
  const update1 = keys.filter((k) => RESIDENTS[k].update1);
  assert.equal(launch.length, 5);
  assert.equal(update1.length, 2);
  assert.deepEqual(launch, ['baker', 'miner', 'smith', 'botanist', 'pet_keeper']);
  assert.deepEqual(update1, ['captain', 'cartographer']);

  // Check specific definitions
  assert.equal(RESIDENTS.baker.name, 'Mira the Baker');
  assert.equal(RESIDENTS.baker.emoji, '👩‍🍳');
  assert.equal(RESIDENTS.baker.building, 'patisserie');
  assert.equal(RESIDENTS.baker.speed, 0.25);
  assert.equal(RESIDENTS.baker.bonusChance, 0.10);

  assert.equal(RESIDENTS.miner.name, 'Bram the Miner');
  assert.equal(RESIDENTS.miner.emoji, '⛏️');
  assert.equal(RESIDENTS.miner.building, 'mint');
  assert.equal(RESIDENTS.miner.speed, 0.20);
  assert.equal(RESIDENTS.miner.bonusChance, 0.10);
  assert.deepEqual(RESIDENTS.miner.frontierPassive, { ore: 0.1 });

  assert.equal(RESIDENTS.smith.name, 'Old Tomas');
  assert.equal(RESIDENTS.smith.emoji, '🔨');
  assert.equal(RESIDENTS.smith.building, 'workshop');
  assert.equal(RESIDENTS.smith.speed, 0.25);
  assert.equal(RESIDENTS.smith.bonusChance, 0.08);

  assert.equal(RESIDENTS.botanist.name, 'Sister Lene');
  assert.equal(RESIDENTS.botanist.emoji, '🌿');
  assert.equal(RESIDENTS.botanist.building, 'flower_greenhouse');
  assert.equal(RESIDENTS.botanist.speed, 0.25);
  assert.equal(RESIDENTS.botanist.bonusChance, 0.12);

  assert.equal(RESIDENTS.pet_keeper.name, 'Pip the Keeper');
  assert.equal(RESIDENTS.pet_keeper.emoji, '🐾');
  assert.equal(RESIDENTS.pet_keeper.building, 'nest');
  assert.equal(RESIDENTS.pet_keeper.speed, 0.2);
  assert.equal(RESIDENTS.pet_keeper.bonusChance, 0.1);

  assert.equal(RESIDENTS.captain.building, 'dock');
  assert.equal(RESIDENTS.captain.update1, true);

  assert.equal(RESIDENTS.cartographer.building, 'starlight_lighthouse');
  assert.equal(RESIDENTS.cartographer.update1, true);
});

test('constants: MEAL_INTERVAL_MS, MEAL_QUALITY, residentsPerCottage', () => {
  assert.equal(MEAL_INTERVAL_MS, 4 * 3600 * 1000);
  assert.equal(RESIDENTS_PER_COTTAGE, 2);
  assert.equal(residentsPerCottage, 2);

  assert.deepEqual(MEAL_QUALITY, {
    bread: 1,
    boba_tea: 1,
    honey_bun: 2,
    berry_tart: 2,
    fish_pie: 3,
    golden_croissant: 4,
  });
});

test('cottageCap scaling and housingCap math', () => {
  // clamp(1 + floor(comfort / 1500), 1, 4)
  assert.equal(cottageCap(0), 1);
  assert.equal(cottageCap(500), 1);
  assert.equal(cottageCap(1499), 1);
  assert.equal(cottageCap(1500), 2);
  assert.equal(cottageCap(2999), 2);
  assert.equal(cottageCap(3000), 3);
  assert.equal(cottageCap(4499), 3);
  assert.equal(cottageCap(4500), 4);
  assert.equal(cottageCap(6000), 4);
  assert.equal(cottageCap(15000), 4);
  assert.equal(cottageCap(-500), 1); // clamped min 1

  // housingCap = 2 per placed cottage
  assert.equal(housingCap(0), 0);
  assert.equal(housingCap(1), 2);
  assert.equal(housingCap(2), 4);
  assert.equal(housingCap(3), 6);
  assert.equal(housingCap(4), 8);
  assert.equal(housingCap({ copies: { cottage: 3 } }), 6);
  assert.equal(housingCap({ buildings: [{ type: 'cottage' }, { type: 'cottage' }] }), 4);
});

test('assignResident: validation rules and unassignment', () => {
  const residents = {
    baker: { id: 'baker', building: null },
    miner: { id: 'miner', building: null },
  };
  const placedTypes = new Set(['patisserie', 'mint']);

  // 1. Assign to valid designated placed building
  const okRes = assignResident(residents, 'baker', 'patisserie', placedTypes);
  assert.deepEqual(okRes, { ok: true });
  assert.equal(residents.baker.building, 'patisserie');

  // 2. Unassigning is always ok
  const unRes = assignResident(residents, 'baker', null, placedTypes);
  assert.deepEqual(unRes, { ok: true });
  assert.equal(residents.baker.building, null);

  // 3. Unknown resident id
  const errUnknown = assignResident(residents, 'alchemist', 'patisserie', placedTypes);
  assert.deepEqual(errUnknown, { ok: false, error: 'unknown' });

  // 4. Wrong building type (baker cannot staff mint)
  const errWrong = assignResident(residents, 'baker', 'mint', placedTypes);
  assert.deepEqual(errWrong, { ok: false, error: 'wrong_building' });

  // 5. Building not placed
  const unplacedTypes = new Set(['workshop']);
  const errNotPlaced = assignResident(residents, 'baker', 'patisserie', unplacedTypes);
  assert.deepEqual(errNotPlaced, { ok: false, error: 'not_placed' });

  // 6. Works with array placedTypes
  const arrayPlaced = ['patisserie', 'mint'];
  const okArray = assignResident(residents, 'miner', 'mint', arrayPlaced);
  assert.deepEqual(okArray, { ok: true });
  assert.equal(residents.miner.building, 'mint');

  // 7. Works when residents is an Array
  const residentsArray = [{ id: 'smith', building: null }];
  const okArrRes = assignResident(residentsArray, 'smith', 'workshop', ['workshop']);
  assert.deepEqual(okArrRes, { ok: true });
  assert.equal(residentsArray[0].building, 'workshop');

  // 8. Works with placedTypes as object or village layout
  assert.deepEqual(assignResident(residents, 'baker', 'patisserie', { patisserie: true }), { ok: true });
  assert.deepEqual(assignResident(residents, 'baker', 'patisserie', { buildings: [{ type: 'patisserie' }] }), { ok: true });
});

test('isFed helper evaluates fed status strictly', () => {
  assert.equal(isFed(null, 1000), false);
  assert.equal(isFed({}, 1000), false);
  assert.equal(isFed({ fedUntil: 500 }, 1000), false);
  assert.equal(isFed({ fedUntil: 1000 }, 1000), false); // fedUntil <= now is hungry
  assert.equal(isFed({ fedUntil: 1001 }, 1000), true);
  assert.equal(isFed({ fedUntil: 2000 }, 1000), true);
});

test('staffBonus: hungry = half bonus, mood scales bonusChance', () => {
  const def = RESIDENTS.baker; // speed: 0.25, bonusChance: 0.10

  // Fed resident at baseline mood 0
  const fed0 = staffBonus({ fedUntil: 2000, mood: 0 }, def, 1000);
  assert.equal(fed0.speedMult, 1.25);
  assert.equal(fed0.bonusChance, 0.10);

  // Fed resident at max mood 100
  const fed100 = staffBonus({ fedUntil: 2000, mood: 100 }, def, 1000);
  assert.equal(fed100.speedMult, 1.25);
  assert.equal(fed100.bonusChance, 0.15);

  // Hungry resident at baseline mood 0 gives HALF bonus
  const hungry0 = staffBonus({ fedUntil: 500, mood: 0 }, def, 1000);
  assert.equal(hungry0.speedMult, 1.125);
  assert.equal(hungry0.bonusChance, 0.05);

  // Hungry resident at mood 100 gives half base bonus chance scaled by mood
  const hungry100 = staffBonus({ fedUntil: 500, mood: 100 }, def, 1000);
  assert.equal(hungry100.speedMult, 1.125);
  assert.equal(hungry100.bonusChance, 0.075);

  // Unstaffed building / missing resident returns identity
  const empty = staffBonus(null, def, 1000);
  assert.equal(empty.speedMult, 1);
  assert.equal(empty.bonusChance, 0);

  // Infer def from res.id when def is omitted
  const inferred = staffBonus({ id: 'baker', fedUntil: 2000, mood: 0 }, null, 1000);
  assert.equal(inferred.speedMult, 1.25);
  assert.equal(inferred.bonusChance, 0.10);

  // Mood clamping: negative mood or mood > 100 clamped
  const clampedNeg = staffBonus({ id: 'baker', fedUntil: 2000, mood: -50 }, null, 1000);
  assert.equal(clampedNeg.bonusChance, 0.10);
  const clampedOver = staffBonus({ id: 'baker', fedUntil: 2000, mood: 250 }, null, 1000);
  assert.equal(clampedOver.bonusChance, 0.15);
});

test('buildingSpeedMult and buildingBonusChance from assigned residents', () => {
  const now = 10000;
  const residents = {
    baker: { id: 'baker', building: 'patisserie', fedUntil: now + 5000, mood: 100 },
    miner: { id: 'miner', building: 'mint', fedUntil: now - 1000, mood: 0 }, // hungry
  };

  // Baker at patisserie (fed, mood 100)
  assert.equal(buildingSpeedMult(residents, 'patisserie', now), 1.25);
  assert.equal(buildingBonusChance(residents, 'patisserie', now), 0.15);

  // Miner at mint (hungry, half bonus)
  assert.equal(buildingSpeedMult(residents, 'mint', now), 1 + 0.20 * 0.5); // 1.10
  assert.equal(buildingBonusChance(residents, 'mint', now), 0.10 * 0.5); // 0.05

  // Workshop has no resident
  assert.equal(buildingSpeedMult(residents, 'workshop', now), 1);
  assert.equal(buildingBonusChance(residents, 'workshop', now), 0);
});

test('feedResidents: eats BEST available meal and mutates pantry', () => {
  const now = 1000;
  const residents = {
    baker: { id: 'baker', fedUntil: now, mood: 0 },
  };
  // Pantry has bread (quality 1) and fish_pie (quality 3)
  const pantry = {
    bread: 2,
    fish_pie: 1,
  };

  const res = feedResidents(residents, pantry, now);

  // Should have chosen fish_pie (quality 3) over bread (quality 1)
  assert.deepEqual(res.eaten, { fish_pie: 1 });
  assert.deepEqual(res.hungry, []);
  assert.equal(pantry.fish_pie, undefined); // deleted when 0
  assert.equal(pantry.bread, 2);

  // fedUntil extended by MEAL_INTERVAL_MS
  assert.equal(residents.baker.fedUntil, now + MEAL_INTERVAL_MS);

  // mood: clamp(0 * 0.5 + 3 * 25, 0, 100) = 75
  assert.equal(residents.baker.mood, 75);
});

test('feedResidents: hungry resident stays hungry when pantry is empty', () => {
  const now = 1000;
  const residents = {
    baker: { id: 'baker', fedUntil: now - 100, mood: 50 },
    miner: { id: 'miner', fedUntil: now + 5000, mood: 80 }, // already fed
  };
  const pantry = {};

  const res = feedResidents(residents, pantry, now);

  assert.deepEqual(res.eaten, {});
  assert.deepEqual(res.hungry, ['baker']); // baker remains hungry
  assert.equal(residents.baker.fedUntil, now - 100); // not extended
  assert.equal(residents.baker.mood, 50); // unchanged
});

test('feedResidents catch-up: eats up to 3 missed meals and caps offline duration', () => {
  const t0 = 0;
  // Resident offline for 12 hours (3 intervals of 4h)
  const now12h = 12 * 3600 * 1000;
  const resOffline12h = {
    baker: { id: 'baker', fedUntil: t0, mood: 0 },
  };
  const pantry12h = {
    bread: 10,
  };

  const feed12h = feedResidents(resOffline12h, pantry12h, now12h);

  // Exactly 3 meals eaten (catch-up cap)
  assert.deepEqual(feed12h.eaten, { bread: 3 });
  assert.equal(pantry12h.bread, 7);
  assert.equal(resOffline12h.baker.fedUntil, now12h + MEAL_INTERVAL_MS);

  // Mood step-by-step:
  // initial: 0
  // meal 1: 0 * 0.5 + 1 * 25 = 25
  // meal 2: 25 * 0.5 + 25 = 37.5
  // meal 3: 37.5 * 0.5 + 25 = 43.75
  assert.equal(resOffline12h.baker.mood, 43.75);

  // Resident offline for 48 hours (extreme offline) still caps at 3 meals
  const now48h = 48 * 3600 * 1000;
  const resOffline48h = {
    miner: { id: 'miner', fedUntil: t0, mood: 0 },
  };
  const pantry48h = {
    golden_croissant: 10,
  };

  const feed48h = feedResidents(resOffline48h, pantry48h, now48h);
  assert.deepEqual(feed48h.eaten, { golden_croissant: 3 });
  assert.equal(pantry48h.golden_croissant, 7);
  assert.equal(resOffline48h.miner.fedUntil, now48h + MEAL_INTERVAL_MS);
  assert.equal(resOffline48h.miner.mood, 100);
});

test('feedResidents catch-up: partial pantry satisfies hunger with available meals', () => {
  const now12h = 12 * 3600 * 1000;
  const residents = {
    baker: { id: 'baker', fedUntil: 0, mood: 0 },
  };
  // Needs 3 meals, but pantry only has 1 bread
  const pantry = { bread: 1 };

  const res = feedResidents(residents, pantry, now12h);

  assert.deepEqual(res.eaten, { bread: 1 });
  assert.deepEqual(res.hungry, []); // Not hungry because they ate
  assert.equal(pantry.bread, undefined);
  assert.equal(residents.baker.fedUntil, now12h + MEAL_INTERVAL_MS);
  assert.equal(residents.baker.mood, 25);
});

test('feedResidents: multi-resident competition for pantry items', () => {
  const now = 2000;
  const residents = {
    baker: { id: 'baker', fedUntil: now - 100, mood: 50 },
    miner: { id: 'miner', fedUntil: now - 200, mood: 50 },
  };
  // Pantry has only 1 meal
  const pantry = { golden_croissant: 1 };

  const res = feedResidents(residents, pantry, now);

  // Baker gets the meal, miner remains hungry
  assert.deepEqual(res.eaten, { golden_croissant: 1 });
  assert.deepEqual(res.hungry, ['miner']);
  assert.equal(residents.baker.fedUntil, now + MEAL_INTERVAL_MS);
  assert.equal(residents.miner.fedUntil, now - 200);
});

test('feedResidents: supports nested stores object structure', () => {
  const now = 5000;
  const residents = {
    baker: { id: 'baker', fedUntil: now, mood: 0 },
  };
  const stores = {
    pantry: {
      items: {
        honey_bun: 2,
      },
    },
  };

  const res = feedResidents(residents, stores, now);
  assert.deepEqual(res.eaten, { honey_bun: 1 });
  assert.equal(stores.pantry.items.honey_bun, 1);
});

test('rollBonusOutput: +1 of each output item when hitting bonus chance', () => {
  const outputs = { bread: 2, honey_bun: 1 };
  const chance = 0.10;

  // RNG roll below chance hits
  const hitRng = () => 0.05;
  const hitRes = rollBonusOutput(outputs, chance, hitRng);
  assert.deepEqual(hitRes, { bread: 1, honey_bun: 1 });

  // RNG roll above chance misses
  const missRng = () => 0.20;
  const missRes = rollBonusOutput(outputs, chance, missRng);
  assert.deepEqual(missRes, {});

  // Zero or negative chance always misses
  assert.deepEqual(rollBonusOutput(outputs, 0, hitRng), {});
  assert.deepEqual(rollBonusOutput(outputs, -0.5, hitRng), {});

  // Empty or invalid outputs returns empty object
  assert.deepEqual(rollBonusOutput({}, chance, hitRng), {});
  assert.deepEqual(rollBonusOutput(null, chance, hitRng), {});

  // Ignores non-positive items
  assert.deepEqual(rollBonusOutput({ bread: 0, honey_bun: 2 }, 0.5, () => 0.1), {
    honey_bun: 1,
  });

  // Array outputs format
  assert.deepEqual(rollBonusOutput(['ingot', 'crystal_glass'], 0.5, () => 0.1), {
    ingot: 1,
    crystal_glass: 1,
  });
});
