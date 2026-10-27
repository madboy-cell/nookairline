// tests/sky_frontier_rules.test.js — Verification of Sky Frontier pure rules and materials catalog.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MATERIALS,
  FOOD,
  MEAL_BUFF_MS,
  isMaterial,
  materialTier,
  isSendableToPartner,
} from '../shared/materials_catalog.js';

import {
  isFrontierInstance,
  shardIdOf,
  frontierInstanceId,
  MAX_PLAYERS_PER_SHARD,
  MAX_PARTY,
  SWING_MS,
  STRIKE_RANGE,
  MIN_STRIKE_GAP_RATIO,
  PERFECT_WEIGHT,
  SPLIT_MIN_SHARE,
  HELPER_BONUS,
  RESPAWN_MS,
  ENERGY,
  REGIONS,
  NODE_TYPES,
  HARVEST_RARITIES,
  regenEnergy,
  spendEnergy,
  addEnergy,
  canStrike,
  splitLoot,
  rollRares,
  rollHarvestRarity,
  isGateOpen,
  clampToRegion,
  FRONTIER_ITEM_SOURCES,
  resolveFrontierTarget,
  FIELD_BOUNTY_STAMP_REWARD,
  ensureFieldBounties,
  recordBountyProgress,
  claimFieldBounty,
  claimFieldBountyBonus,
} from '../shared/sky_frontier_rules.js';

test('materials catalog: covers raw, refined, goods, and rare tiers with stack limits', () => {
  const expectedRaw = [
    'wood', 'stone', 'crystal_ore', 'sky_wheat', 'herb_seed', 'honey',
    'fish', 'feather', 'cloud_silk', 'monster_gel', 'monster_fang',
    'golden_wheat', 'berries_crop',
  ];
  const expectedRefined = ['plank', 'ingot', 'crystal_glass', 'flour', 'herb', 'thread'];
  const expectedGoods = [
    'bread', 'honey_bun', 'fish_pie', 'berry_tart', 'boba_tea',
    'golden_croissant', 'potion_small', 'repair_kit', 'pet_treat',
  ];
  const expectedRare = ['boss_core_moss', 'boss_core_weaver', 'ancient_gear', 'starlight_essence'];

  for (const id of expectedRaw) {
    assert.equal(isMaterial(id), true, `raw material missing: ${id}`);
    assert.equal(materialTier(id), 'raw');
    assert.equal(MATERIALS[id].stack, 999);
    assert.equal(isSendableToPartner(id), true);
  }

  for (const id of expectedRefined) {
    assert.equal(isMaterial(id), true, `refined material missing: ${id}`);
    assert.equal(materialTier(id), 'refined');
    assert.equal(MATERIALS[id].stack, 999);
    assert.equal(isSendableToPartner(id), true);
  }

  for (const id of expectedGoods) {
    assert.equal(isMaterial(id), true, `goods material missing: ${id}`);
    assert.equal(materialTier(id), 'goods');
    assert.equal(MATERIALS[id].stack, 999);
    assert.equal(isSendableToPartner(id), true);
  }

  for (const id of expectedRare) {
    assert.equal(isMaterial(id), true, `rare material missing: ${id}`);
    assert.equal(materialTier(id), 'rare');
    assert.equal(MATERIALS[id].stack, 99);
    assert.equal(isSendableToPartner(id), false, `rare material ${id} must not be sendable to partner`);
  }

  assert.equal(isMaterial('non_existent_item'), false);
  assert.equal(materialTier('non_existent_item'), null);
  assert.equal(isSendableToPartner('non_existent_item'), false);
});

test('food catalog: meal values and MEAL_BUFF_MS', () => {
  assert.equal(MEAL_BUFF_MS, 30 * 60 * 1000);
  assert.deepEqual(FOOD.bread, { energy: 30 });
  assert.deepEqual(FOOD.honey_bun, { energy: 50, buff: 'regen' });
  assert.deepEqual(FOOD.fish_pie, { energy: 80, buff: 'yield' });
  assert.deepEqual(FOOD.berry_tart, { energy: 40, buff: 'party', party: true });
  assert.deepEqual(FOOD.boba_tea, { energy: 20, buff: 'speed' });
  assert.deepEqual(FOOD.golden_croissant, { energy: 150, buff: 'yield_plus' });
});

test('frontier instance helpers: isFrontierInstance, shardIdOf, frontierInstanceId', () => {
  assert.equal(isFrontierInstance('frontier:s1'), true);
  assert.equal(isFrontierInstance('frontier:alpha_42'), true);
  assert.equal(isFrontierInstance('village:player1'), false);
  assert.equal(isFrontierInstance('townhall'), false);
  assert.equal(isFrontierInstance(''), false);
  assert.equal(isFrontierInstance(null), false);
  assert.equal(isFrontierInstance(undefined), false);

  assert.equal(shardIdOf('frontier:shard-10'), 'shard-10');
  assert.equal(shardIdOf('village:user1'), null);
  assert.equal(shardIdOf(null), null);

  assert.equal(frontierInstanceId('shard-99'), 'frontier:shard-99');
  assert.equal(frontierInstanceId('frontier:shard-99'), 'frontier:shard-99');
});

test('constants: match locked sky frontier specifications', () => {
  assert.equal(MAX_PLAYERS_PER_SHARD, 10);
  assert.equal(MAX_PARTY, 4);
  assert.equal(SWING_MS, 750);
  assert.equal(STRIKE_RANGE, 3.2);
  assert.equal(MIN_STRIKE_GAP_RATIO, 0.9);
  assert.equal(PERFECT_WEIGHT, 1.5);
  assert.equal(SPLIT_MIN_SHARE, 0.10);
  assert.equal(HELPER_BONUS, 0.10);
  assert.equal(RESPAWN_MS, 45000);

  assert.equal(ENERGY.MAX, 200);
  assert.equal(ENERGY.REGEN_MS, 120000);
  assert.equal(ENERGY.DAILY_FREE, 200);
  assert.equal(ENERGY.PARTNER_GIFT, 50);
  assert.equal(ENERGY.DIAMOND_REFILL, 200);
  assert.equal(ENERGY.DIAMOND_REFILLS_PER_DAY, 2);
  assert.deepEqual(ENERGY.DIAMOND_COSTS, [50, 100]);
});

test('all region POIs and spawns lie within halfSize - 2', () => {
  for (const [regionId, region] of Object.entries(REGIONS)) {
    const halfSize = region.zone.halfSize;
    const limit = halfSize - 2;

    // Check spawn point
    assert.ok(
      Math.abs(region.spawn.x) <= limit,
      `${regionId} spawn x (${region.spawn.x}) exceeds limit ${limit}`
    );
    assert.ok(
      Math.abs(region.spawn.z) <= limit,
      `${regionId} spawn z (${region.spawn.z}) exceeds limit ${limit}`
    );

    // Check all POIs
    for (const [poiName, pos] of Object.entries(region.pois)) {
      assert.ok(
        Math.abs(pos.x) <= limit,
        `${regionId} poi ${poiName} x (${pos.x}) exceeds limit ${limit}`
      );
      assert.ok(
        Math.abs(pos.z) <= limit,
        `${regionId} poi ${poiName} z (${pos.z}) exceeds limit ${limit}`
      );
    }
  }
});

test('clampToRegion respects region boundaries', () => {
  const pOutside = clampToRegion('meadow', 50, -50, 0.4);
  const meadowLimit = REGIONS.meadow.zone.halfSize - 0.4;
  assert.equal(pOutside.x, meadowLimit);
  assert.equal(pOutside.z, -meadowLimit);

  const pInside = clampToRegion('meadow', 10, 15, 0.4);
  assert.equal(pInside.x, 10);
  assert.equal(pInside.z, 15);
});

test('energy mechanics: regenEnergy, spendEnergy, addEnergy and caps', () => {
  const t0 = 1000000;

  // 1. Initial full state stays full and resets lastRegenAt to now
  const full = { cur: 200, max: 200, lastRegenAt: t0 - 500000 };
  const regFull = regenEnergy(full, t0);
  assert.equal(regFull.cur, 200);
  assert.equal(regFull.lastRegenAt, t0);

  // 2. Spending energy deducts cur correctly
  const spend1 = spendEnergy(regFull, 1, t0);
  assert.equal(spend1.ok, true);
  assert.equal(spend1.energy.cur, 199);
  assert.equal(spend1.energy.lastRegenAt, t0);

  // 3. Regen 1 unit after REGEN_MS (120,000 ms)
  const t1 = t0 + ENERGY.REGEN_MS;
  const reg1 = regenEnergy(spend1.energy, t1);
  assert.equal(reg1.cur, 200);
  assert.equal(reg1.lastRegenAt, t1);

  // 4. Partial regen: 2 intervals elapsed on 10 missing units
  const depleted = { cur: 190, max: 200, lastRegenAt: t0 };
  const regPartial = regenEnergy(depleted, t0 + ENERGY.REGEN_MS * 2 + 30000);
  assert.equal(regPartial.cur, 192);
  assert.equal(regPartial.lastRegenAt, t0 + ENERGY.REGEN_MS * 2);

  // 5. Excessive elapsed time caps at max and sets lastRegenAt to now
  const regCapped = regenEnergy(depleted, t0 + ENERGY.REGEN_MS * 50);
  assert.equal(regCapped.cur, 200);
  assert.equal(regCapped.lastRegenAt, t0 + ENERGY.REGEN_MS * 50);

  // 6. Insufficient energy rejection
  const empty = { cur: 0, max: 200, lastRegenAt: t0 };
  const spendFail = spendEnergy(empty, 5, t0);
  assert.equal(spendFail.ok, false);
  assert.equal(spendFail.energy.cur, 0);

  // 7. addEnergy allows overflow beyond max up to 2×MAX (400)
  const baseFull = { cur: 200, max: 200, lastRegenAt: t0 };
  const addedFood = addEnergy(baseFull, 50, t0);
  assert.equal(addedFood.cur, 250);
  assert.equal(addedFood.lastRegenAt, t0);

  // Overflow is capped strictly at 2×MAX (400)
  const megaAdd = addEnergy(addedFood, 300, t0);
  assert.equal(megaAdd.cur, 400);

  // Passive regen does not add anything when cur >= max
  const passiveOnOverflow = regenEnergy(addedFood, t0 + ENERGY.REGEN_MS * 10);
  assert.equal(passiveOnOverflow.cur, 250);
  assert.equal(passiveOnOverflow.lastRegenAt, t0 + ENERGY.REGEN_MS * 10);
});

test('canStrike codes: out_of_range, tool_tier, too_fast, and ok', () => {
  const tree = NODE_TYPES.tree; // minTier: 1
  const quartz = NODE_TYPES.quartz; // minTier: 2
  const now = 10000;

  // 1. Out of range (> STRIKE_RANGE = 3.2)
  const resRange = canStrike({
    playerPos: { x: 0, z: 0 },
    nodePos: { x: 0, z: 3.5 },
    toolTier: 1,
    node: tree,
    lastStrikeAt: 0,
    now,
  });
  assert.equal(resRange.ok, false);
  assert.equal(resRange.code, 'out_of_range');

  // 2. Tool tier too low
  const resTier = canStrike({
    playerPos: { x: 0, z: 0 },
    nodePos: { x: 0, z: 2.0 },
    toolTier: 1,
    node: quartz, // requires tier 2
    lastStrikeAt: 0,
    now,
  });
  assert.equal(resTier.ok, false);
  assert.equal(resTier.code, 'tool_tier');

  // 3. Too fast: gap < 0.9 * SWING_MS (750 * 0.9 = 675 ms)
  const resFast = canStrike({
    playerPos: { x: 0, z: 0 },
    nodePos: { x: 0, z: 2.0 },
    toolTier: 1,
    node: tree,
    lastStrikeAt: now - 500, // 500 ms < 675 ms
    now,
    swingMs: SWING_MS,
  });
  assert.equal(resFast.ok, false);
  assert.equal(resFast.code, 'too_fast');

  // 4. Valid strike passes
  const resOk = canStrike({
    playerPos: { x: 0, z: 0 },
    nodePos: { x: 0, z: 2.0 },
    toolTier: 2,
    node: tree,
    lastStrikeAt: now - 700, // 700 ms >= 675 ms
    now,
    swingMs: SWING_MS,
  });
  assert.equal(resOk.ok, true);
  assert.equal(resOk.code, null);
});

test('splitLoot: sum exactness, 10% threshold excluding leecher, 3-player helper bonus, and perfect weighting', () => {
  // Scenario 1: 10% threshold excluding a leecher
  // Total hits: 10 + 9 + 1 = 20. 10% threshold is 2.0.
  // user_c has 1 hit (5%), so user_c is excluded.
  const drop1 = { wood: 10 };
  const split1 = splitLoot({
    hits: { user_a: 10, user_b: 9, user_c: 1 },
    baseDrop: drop1,
  });

  assert.deepEqual(split1.qualifying, ['user_a', 'user_b']);
  assert.equal(split1.shares.user_c, undefined);

  // 2 qualifying players: helper bonus = 1 + 0.10 * (2 - 1) = 1.10
  // total wood = floor(10 * 1.10) = 11
  const sum1 = split1.shares.user_a.wood + split1.shares.user_b.wood;
  assert.equal(sum1, 11, 'Sum of shares must exactly equal total drop (11)');

  // Scenario 2: Helper bonus with 3 players
  // q = 3 -> multiplier = 1 + 0.10 * (3 - 1) = 1.20
  // baseDrop stone: 15 -> total = floor(15 * 1.20) = 18
  const split2 = splitLoot({
    hits: { p1: 4, p2: 4, p3: 4 },
    baseDrop: { stone: 15 },
  });
  assert.equal(split2.qualifying.length, 3);
  assert.equal(split2.shares.p1.stone, 6);
  assert.equal(split2.shares.p2.stone, 6);
  assert.equal(split2.shares.p3.stone, 6);
  assert.equal(split2.shares.p1.stone + split2.shares.p2.stone + split2.shares.p3.stone, 18);

  // Scenario 3: Perfect weighting (1.5x)
  // Player A landed 2 normal hits (2 * 1.0 = 2.0)
  // Player B landed 2 perfect hits (2 * PERFECT_WEIGHT = 3.0)
  // Total hits = 5.0. Shares should be proportional to 2:3.
  const split3 = splitLoot({
    hits: { pA: 2.0, pB: 2.0 * PERFECT_WEIGHT },
    baseDrop: { crystal_ore: 10 },
  });
  // q = 2 -> total = floor(10 * 1.10) = 11
  // pA gets 2/5 * 11 = 4.4 -> floor 4
  // pB gets 3/5 * 11 = 6.6 -> floor 6
  // Remainder = 11 - 10 = 1. Largest fraction is pB (0.6 > 0.4), so pB gets +1 = 7.
  assert.equal(split3.shares.pA.crystal_ore, 4);
  assert.equal(split3.shares.pB.crystal_ore, 7);
  assert.equal(split3.shares.pA.crystal_ore + split3.shares.pB.crystal_ore, 11);

  // Scenario 4: Sum exactness across various non-trivial remainder distributions
  for (let base = 1; base <= 25; base++) {
    const res = splitLoot({
      hits: { alpha: 3.5, beta: 5.0, gamma: 1.5 },
      baseDrop: { mat_a: base, mat_b: base * 2 },
    });
    const totalA = Math.floor(base * (1 + 0.10 * 2));
    const totalB = Math.floor(base * 2 * (1 + 0.10 * 2));

    const sumA = res.shares.alpha.mat_a + res.shares.beta.mat_a + res.shares.gamma.mat_a;
    const sumB = res.shares.alpha.mat_b + res.shares.beta.mat_b + res.shares.gamma.mat_b;

    assert.equal(sumA, totalA, `Material A sum must match total for base=${base}`);
    assert.equal(sumB, totalB, `Material B sum must match total for base=${base}`);
  }
});

test('rollRares: independent rolls with seeded RNG', () => {
  // Seeded PRNG for deterministic test
  function createSeededRng(seed = 42) {
    let s = seed;
    return function rng() {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  const rareTable = { ancient_gear: 0.25 };
  const qualifying = ['player_1', 'player_2'];

  const rng1 = createSeededRng(100);
  const res1 = rollRares(rareTable, qualifying, rng1, 1.0);

  const rng2 = createSeededRng(100);
  const res2 = rollRares(rareTable, qualifying, rng2, 1.0);

  assert.deepEqual(res1, res2, 'Same seed produces identical rare drops');

  // Deterministic mock RNG where first roll wins, second loses
  const rolls = [0.01, 0.99];
  let rollIdx = 0;
  const mockRng = () => rolls[rollIdx++];
  const resMock = rollRares(rareTable, qualifying, mockRng, 1.0);

  assert.deepEqual(resMock.player_1, { ancient_gear: 1 });
  assert.equal(resMock.player_2, undefined);
});

test('gate logic: requires, guest bypass, and bidirectional gate checks', () => {
  // Meadow -> Hollow requires 'hollow'
  assert.equal(
    isGateOpen('meadow', 'hollow', { regions: ['meadow'], gates: [] }),
    false,
    'Player without hollow unlock cannot pass'
  );

  assert.equal(
    isGateOpen('meadow', 'hollow', { regions: ['meadow', 'hollow'] }),
    true,
    'Player with hollow unlock can pass'
  );

  assert.equal(
    isGateOpen('meadow', 'hollow', ['hollow']),
    true,
    'Array unlocks work'
  );

  // Guest of unlocked player bypasses requirement
  assert.equal(
    isGateOpen('meadow', 'hollow', { regions: ['meadow'] }, { guestOfUnlocked: true }),
    true,
    'Guest of unlocked party member can pass'
  );

  // Hollow -> Meadow has requires: null (always open)
  assert.equal(
    isGateOpen('hollow', 'meadow', { regions: [] }),
    true,
    'Return gate to meadow is open to all'
  );

  // Invalid gate returns false
  assert.equal(isGateOpen('meadow', 'non_existent_gate', {}), false);
  assert.equal(isGateOpen('unknown_region', 'hollow', {}), false);
});

test('rollHarvestRarity: rolls Common (1x), Uncommon (1.5x), Rare (2x), and Epic (3x) with PERFECT! strike boosts and bonusDrops', () => {
  assert.equal(HARVEST_RARITIES.common.mult, 1.0);
  assert.equal(HARVEST_RARITIES.uncommon.mult, 1.5);
  assert.equal(HARVEST_RARITIES.rare.mult, 2.0);
  assert.equal(HARVEST_RARITIES.epic.mult, 3.0);

  // Every node type has rarityDrops for uncommon, rare, and epic
  for (const [nodeKey, def] of Object.entries(NODE_TYPES)) {
    assert.ok(def.rarityDrops?.uncommon, `${nodeKey} missing uncommon rarityDrops`);
    assert.ok(def.rarityDrops?.rare, `${nodeKey} missing rare rarityDrops`);
    assert.ok(def.rarityDrops?.epic, `${nodeKey} missing epic rarityDrops`);
  }

  // Epic roll (rng = 0.005)
  const epicTree = rollHarvestRarity({
    nodeType: 'tree',
    perfectCount: 3,
    totalSwings: 8,
    luckMult: 1.1,
    rng: () => 0.005,
  });
  assert.equal(epicTree.id, 'epic');
  assert.equal(epicTree.mult, 3.0);
  assert.deepEqual(epicTree.bonusDrops, { honey: 3, feather: 2, ancient_gear: 1 });
  assert.ok(epicTree.rareBoostPct > 0);

  // Rare roll (rng = 0.12 with 3 perfects)
  const rareBoulder = rollHarvestRarity({
    nodeType: 'boulder',
    perfectCount: 3,
    totalSwings: 8,
    luckMult: 1.0,
    rng: () => 0.12,
  });
  assert.equal(rareBoulder.id, 'rare');
  assert.equal(rareBoulder.mult, 2.0);
  assert.deepEqual(rareBoulder.bonusDrops, { crystal_ore: 3 });

  // Uncommon roll (rng = 0.45 with 2 perfects)
  const uncWheat = rollHarvestRarity({
    nodeType: 'wheat',
    perfectCount: 2,
    totalSwings: 4,
    luckMult: 1.0,
    rng: () => 0.45,
  });
  assert.equal(uncWheat.id, 'uncommon');
  assert.equal(uncWheat.mult, 1.5);
  assert.deepEqual(uncWheat.bonusDrops, { golden_wheat: 1 });

  // Common roll (rng = 0.95 with 0 perfects)
  const comHerb = rollHarvestRarity({
    nodeType: 'herb',
    perfectCount: 0,
    totalSwings: 4,
    luckMult: 1.0,
    rng: () => 0.95,
  });
  assert.equal(comHerb.id, 'common');
  assert.equal(comHerb.mult, 1.0);
  assert.deepEqual(comHerb.bonusDrops, {});

  // Perfect strikes progressively increase rareBoostPct
  const boost0 = rollHarvestRarity({ nodeType: 'crystal', perfectCount: 0, totalSwings: 10, rng: () => 0.99 }).rareBoostPct;
  const boost2 = rollHarvestRarity({ nodeType: 'crystal', perfectCount: 2, totalSwings: 10, rng: () => 0.99 }).rareBoostPct;
  const boost5 = rollHarvestRarity({ nodeType: 'crystal', perfectCount: 5, totalSwings: 10, rng: () => 0.99 }).rareBoostPct;
  assert.ok(boost2 > boost0, `Expected 2 perfects (${boost2}%) > 0 perfects (${boost0}%)`);
  assert.ok(boost5 > boost2, `Expected 5 perfects (${boost5}%) > 2 perfects (${boost2}%)`);
});

test('resolveFrontierTarget: resolves gather nodes, monsters, bosses, POIs, altRegions, and locked-gate redirects', () => {
  assert.ok(FRONTIER_ITEM_SOURCES.wood);
  assert.ok(FRONTIER_ITEM_SOURCES.crystal_ore);
  assert.ok(FRONTIER_ITEM_SOURCES.monster_gel);

  const woodTarget = resolveFrontierTarget('wood', { regions: ['meadow'] }, 'meadow');
  assert.equal(woodTarget.kind, 'node');
  assert.equal(woodTarget.region, 'meadow');
  assert.deepEqual(woodTarget.nodeTypes, ['tree']);

  // Stone prefers current region when hollow is unlocked via altRegions
  const stoneInHollow = resolveFrontierTarget('stone', { regions: ['meadow', 'hollow'] }, 'hollow');
  assert.equal(stoneInHollow.region, 'hollow');

  // Crystal ore redirects to gate_hollow in meadow when hollow is still locked
  const lockedCrystal = resolveFrontierTarget('crystal_ore', { regions: ['meadow'], gates: [] }, 'meadow');
  assert.equal(lockedCrystal.kind, 'gate');
  assert.equal(lockedCrystal.region, 'meadow');
  assert.equal(lockedCrystal.gateTo, 'hollow');

  // Crystal ore resolves directly to hollow crystal veins when hollow is unlocked
  const unlockedCrystal = resolveFrontierTarget('crystal_ore', { regions: ['meadow', 'hollow'] }, 'meadow');
  assert.equal(unlockedCrystal.kind, 'node');
  assert.equal(unlockedCrystal.region, 'hollow');
  assert.ok(unlockedCrystal.nodeTypes.includes('crystal'));

  // Boss & POI targets
  const golem = resolveFrontierTarget('elder_moss_golem', { regions: ['meadow'] }, 'meadow');
  assert.equal(golem.kind, 'boss');
  assert.equal(golem.bossId, 'elder_moss_golem');

  const outpost = resolveFrontierTarget('outpost', { regions: ['meadow'] }, 'meadow');
  assert.equal(outpost.kind, 'poi');
  assert.equal(outpost.x, 0);
  assert.equal(outpost.z, 4);
});

test('Field Bounties & Goddess Stamp Chest: deterministic daily deal, progress tracking, 3/3 auto round rollover, and daily bonus', () => {
  const now = 1_750_000_000_000;
  const fr = {
    unlocks: { regions: ['meadow'], gates: [] },
    energy: { cur: 100, max: 200, updatedAt: now },
    warehouse: { lv: 1, items: {} },
    pantry: { lv: 1, items: {} },
    campCrate: { items: {}, expiresAt: 0 },
  };

  const b1 = ensureFieldBounties(fr, now);
  assert.equal(b1.round, 1);
  assert.equal(b1.stamps, 0);
  assert.equal(b1.cards.length, 3);
  // With only meadow unlocked, zero hollow-only cards should be dealt
  assert.ok(b1.cards.every((c) => c.region === 'meadow'));

  // Cannot claim incomplete card or bonus chest early
  assert.equal(claimFieldBounty(fr, 0, now).ok, false);
  assert.equal(claimFieldBountyBonus(fr, now).ok, false);

  // Progress each card to completion via matching events
  for (const card of [...b1.cards]) {
    const evt = {
      kind: card.kind,
      target: card.target,
      region: card.region,
      amount: card.goal,
    };
    const changed = recordBountyProgress(fr, evt, now);
    assert.ok(changed.includes(card.slot), `Expected slot ${card.slot} (${card.kind}) to advance`);
    assert.equal(fr.bounties.cards[card.slot].have, card.goal);
  }

  const r0 = claimFieldBounty(fr, 0, now);
  assert.equal(r0.ok, true);
  assert.equal(r0.stamps, 1);
  assert.equal(r0.roundAdvanced, false);
  assert.ok(r0.goldGain > 0);

  const r1 = claimFieldBounty(fr, 1, now);
  assert.equal(r1.ok, true);
  assert.equal(r1.stamps, 2);
  assert.equal(r1.roundAdvanced, false);

  // Claiming 3rd card awards 3rd stamp, marks bonusReady, and automatically deals Round 2!
  const r2 = claimFieldBounty(fr, 2, now);
  assert.equal(r2.ok, true);
  assert.equal(r2.stamps, 3);
  assert.equal(r2.bonusReady, true);
  assert.equal(r2.roundAdvanced, true);
  assert.equal(fr.bounties.round, 2);
  assert.equal(fr.bounties.cards.length, 3);
  assert.ok(fr.bounties.cards.every((c) => !c.claimed && c.have === 0));

  // Claim Daily 3/3 Goddess Stamp Chest
  const bonus = claimFieldBountyBonus(fr, now);
  assert.equal(bonus.ok, true);
  assert.equal(bonus.goldGain, FIELD_BOUNTY_STAMP_REWARD.gold);
  assert.equal(bonus.diamondGain, FIELD_BOUNTY_STAMP_REWARD.diamonds);
  assert.equal(fr.pantry.items.repair_kit >= 1, true);
  assert.equal(fr.pantry.items.bread >= 1, true);

  // Second claim on same UTC day is rejected
  const bonusDup = claimFieldBountyBonus(fr, now);
  assert.equal(bonusDup.ok, false);
  assert.equal(bonusDup.error, 'already_claimed');

  // Next UTC day resets round, stamps, and bonusClaimed
  const nextDay = now + 86_400_000;
  const bNext = ensureFieldBounties(fr, nextDay);
  assert.equal(bNext.round, 1);
  assert.equal(bNext.stamps, 0);
  assert.equal(bNext.bonusClaimed, false);
});
