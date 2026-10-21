// tests/universal_stats.test.js — Verification of shared authoritative 4-stat formula. Run: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STAT_KEYS,
  GEAR_SLOTS,
  softCap,
  computeUniversalStats,
} from '../shared/universal_stats.js';

test('STAT_KEYS contains exactly the 4 universal stats', () => {
  assert.deepEqual(STAT_KEYS, ['fortune', 'swiftness', 'power', 'luck']);
  assert.deepEqual(GEAR_SLOTS, ['outfit', 'hat', 'face', 'gloves', 'boots', 'wings']);
});

test('base excluded from bonus: bonus = gear + pet only', () => {
  const profile = { level: 5 };
  const res = computeUniversalStats(profile);

  // Level 5 base: fortune 20+5*4=40, swiftness 15+5*3=30, power 25+5*5=50, luck 15+5*3=30
  assert.deepEqual(res.base, {
    fortune: 40,
    swiftness: 30,
    power: 50,
    luck: 30,
  });

  // No gear or pet equipped -> gear and pet are 0
  assert.deepEqual(res.gear, { fortune: 0, swiftness: 0, power: 0, luck: 0 });
  assert.deepEqual(res.pet, { fortune: 0, swiftness: 0, power: 0, luck: 0 });

  // Bonus must be strictly gear + pet, completely excluding base
  assert.deepEqual(res.bonus, { fortune: 0, swiftness: 0, power: 0, luck: 0 });
  assert.deepEqual(res.total, res.base);

  // When gear is equipped, bonus = gear, total = base + bonus
  const profileWithGear = {
    level: 5,
    equipped: {
      wings: { id: 'wings_crystal_butterfly', refine: 0 }, // stats: { all: 10 }
    },
  };
  const resGear = computeUniversalStats(profileWithGear);
  assert.deepEqual(resGear.gear, { fortune: 10, swiftness: 10, power: 10, luck: 10 });
  assert.deepEqual(resGear.bonus, { fortune: 10, swiftness: 10, power: 10, luck: 10 });
  assert.deepEqual(resGear.total, { fortune: 50, swiftness: 40, power: 60, luck: 40 });

  // Verify total - base equals bonus for every stat
  for (const k of STAT_KEYS) {
    assert.equal(resGear.total[k] - resGear.base[k], resGear.bonus[k]);
  }
});

test('{all:N} item adds N*mult to all 4 stats and refine +10 → 2.5×', () => {
  // wings_crystal_butterfly has stats: { all: 10 }
  // Refine 0: mult = 1.0 -> 10 to all 4 stats
  const prof0 = {
    level: 1,
    equipped: {
      wings: { id: 'wings_crystal_butterfly', refine: 0 },
    },
  };
  const res0 = computeUniversalStats(prof0);
  assert.deepEqual(res0.gear, { fortune: 10, swiftness: 10, power: 10, luck: 10 });

  // Refine 10: mult = 1 + 0.15 * 10 = 2.5 -> 10 * 2.5 = 25 to all 4 stats
  const prof10 = {
    level: 1,
    equipped: {
      wings: { id: 'wings_crystal_butterfly', refine: 10 },
    },
  };
  const res10 = computeUniversalStats(prof10);
  assert.deepEqual(res10.gear, { fortune: 25, swiftness: 25, power: 25, luck: 25 });
});

test('super_mythic outfit counts as {all:24}', () => {
  // sm_eclipse_dragon has rarity: 'super_mythic' and no explicit stats object
  // Must count as rarity 3 -> default { all: 24 }
  const prof0 = {
    level: 1,
    equipped: {
      outfit: { id: 'sm_eclipse_dragon', refine: 0 },
    },
  };
  const res0 = computeUniversalStats(prof0);
  assert.deepEqual(res0.gear, { fortune: 24, swiftness: 24, power: 24, luck: 24 });

  // At refine +10, 24 * 2.5 = 60
  const prof10 = {
    level: 1,
    equipped: {
      outfit: { id: 'sm_eclipse_dragon', refine: 10 },
    },
  };
  const res10 = computeUniversalStats(prof10);
  assert.deepEqual(res10.gear, { fortune: 60, swiftness: 60, power: 60, luck: 60 });
});

test('pet family passive routed to correct stat: nyx (swiftness), ragdoll (fortune), kitsune (luck)', () => {
  // pet_nyx: family 'dragons' -> routed to swiftness
  // Stars 1, Level 1: petPassivePct = 15, familyBonus = round(15 * 2.5) = 38
  const profNyx = {
    level: 1,
    equipped: {
      pet: { id: 'pet_nyx', stars: 1, level: 1 },
    },
  };
  const resNyx = computeUniversalStats(profNyx);
  assert.deepEqual(resNyx.pet, { fortune: 0, swiftness: 38, power: 0, luck: 0 });

  // pet_ragdoll: family 'cats' -> routed to fortune
  const profRagdoll = {
    level: 1,
    equipped: {
      pet: { id: 'pet_ragdoll', stars: 1, level: 1 },
    },
  };
  const resRagdoll = computeUniversalStats(profRagdoll);
  assert.deepEqual(resRagdoll.pet, { fortune: 38, swiftness: 0, power: 0, luck: 0 });

  // pet_kitsune: family 'kitsune' -> routed to luck
  const profKitsune = {
    level: 1,
    equipped: {
      pet: { id: 'pet_kitsune', stars: 1, level: 1 },
    },
  };
  const resKitsune = computeUniversalStats(profKitsune);
  assert.deepEqual(resKitsune.pet, { fortune: 0, swiftness: 0, power: 0, luck: 38 });
});

test('pet trait multipliers: fortune*4, swiftness*6, power*5, luck*6', () => {
  // Pet with fortune and swiftness trait slots
  const prof1 = {
    level: 1,
    equipped: {
      pet: { id: 'pet_nyx', stars: 2, level: 1 },
    },
    pets: [
      {
        id: 'pet_nyx',
        stars: 2,
        level: 1,
        slots: [
          { stat: 'fortune', tier: 'common', value: 0.10 },
          { stat: 'swiftness', tier: 'common', value: 0.05 },
        ],
      },
    ],
  };

  const res1 = computeUniversalStats(prof1);
  // Stars 2 Nyx family passive: petPassivePct = 25 -> round(25 * 2.5) = 63 to swiftness
  // Trait passives: fortune 10 * 4 = 40, swiftness 5 * 6 = 30 (+ 63 family = 93)
  assert.deepEqual(res1.pet, {
    fortune: 40,
    swiftness: 93,
    power: 0,
    luck: 0,
  });

  // Pet with power and luck trait slots
  const prof2 = {
    level: 1,
    equipped: {
      pet: { id: 'pet_nyx', stars: 2, level: 1 },
    },
    pets: [
      {
        id: 'pet_nyx',
        stars: 2,
        level: 1,
        slots: [
          { stat: 'power', tier: 'common', value: 0.08 },
          { stat: 'luck', tier: 'common', value: 0.12 },
        ],
      },
    ],
  };

  const res2 = computeUniversalStats(prof2);
  // Trait passives: power 8 * 5 = 40, luck 12 * 6 = 72
  assert.deepEqual(res2.pet, {
    fortune: 0,
    swiftness: 63,
    power: 40,
    luck: 72,
  });
});

test('attune moves secondary line to attune.stat (only if differing from main line)', () => {
  // hat_glowing_bunny has stats: { power: 25, luck: 22 }
  // Primary/main line: power (25), Secondary line: luck (22)

  // 1. Without attune
  const profBase = {
    level: 1,
    equipped: {
      hat: { id: 'hat_glowing_bunny', refine: 0 },
    },
  };
  const resBase = computeUniversalStats(profBase);
  assert.deepEqual(resBase.gear, { fortune: 0, swiftness: 0, power: 25, luck: 22 });

  // 2. Attune to swiftness (differs from main line power) -> secondary line luck (22) moves to swiftness
  const profAttuneSwift = {
    level: 1,
    equipped: {
      hat: { id: 'hat_glowing_bunny', refine: 0, attune: { stat: 'swiftness' } },
    },
  };
  const resAttuneSwift = computeUniversalStats(profAttuneSwift);
  assert.deepEqual(resAttuneSwift.gear, { fortune: 0, swiftness: 22, power: 25, luck: 0 });

  // 3. Attune to power (matches main line power) -> secondary line cannot stack into main, so no-op
  const profAttunePower = {
    level: 1,
    equipped: {
      hat: { id: 'hat_glowing_bunny', refine: 0, attune: { stat: 'power' } },
    },
  };
  const resAttunePower = computeUniversalStats(profAttunePower);
  assert.deepEqual(resAttunePower.gear, { fortune: 0, swiftness: 0, power: 25, luck: 22 });

  // 4. Attune + refine 10 (mult 2.5): power 25*2.5=63, fortune 22*2.5=55
  const profAttuneFortune10 = {
    level: 1,
    equipped: {
      hat: { id: 'hat_glowing_bunny', refine: 10, attune: { stat: 'fortune' } },
    },
  };
  const resAttuneFortune10 = computeUniversalStats(profAttuneFortune10);
  assert.deepEqual(resAttuneFortune10.gear, { fortune: 55, swiftness: 0, power: 63, luck: 0 });
});

test('dice slot is excluded from universal stats', () => {
  const prof = {
    level: 1,
    equipped: {
      dice: { id: 'dice_zeus_thunder', refine: 10 },
    },
  };
  const res = computeUniversalStats(prof);
  assert.deepEqual(res.gear, { fortune: 0, swiftness: 0, power: 0, luck: 0 });
});

test('softCap helper computes exponential curve towards cap', () => {
  assert.equal(softCap(0, 100), 0);
  assert.equal(softCap(-5, 100), 0);
  // softCap(60, 100, 60) = 100 * (1 - 1/e) ~ 63.21205588
  const atK = softCap(60, 100, 60);
  assert.ok(Math.abs(atK - 63.212) < 0.01);
  // At large stat, softCap approaches cap
  const high = softCap(1000, 50, 60);
  assert.ok(Math.abs(high - 50) < 0.001);
});
