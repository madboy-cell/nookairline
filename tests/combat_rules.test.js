// tests/combat_rules.test.js — Verification of authoritative combat, invasion, boss, and ultimate rules.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MONSTERS,
  BOSSES,
  WEAPONS,
  toolTierMult,
  weaponDamage,
  attackCooldownMs,
  hitsInArc,
  ULTIMATES,
  ultimateCooldownMs,
  INVASION,
  nextInvasionAt,
  waveComposition,
  OUTPOST,
  applyOutpostDamage,
  repairOutpost,
  contributionLedger,
  addContribution,
  qualifiers,
  rollBossLoot,
} from '../shared/combat_rules.js';

import { MATERIALS } from '../shared/materials_catalog.js';
import { CHARMS } from '../shared/charm_catalog.js';

test('1. Monster and Boss tables are valid with drops in materials catalog', () => {
  // Verify all monsters have valid schema and material drops
  const monsterIds = Object.keys(MONSTERS);
  assert.equal(monsterIds.length, 6);

  for (const [id, monster] of Object.entries(MONSTERS)) {
    assert.equal(monster.id, id);
    assert.ok(monster.name, `Monster ${id} missing name`);
    assert.ok(['meadow', 'hollow'].includes(monster.region), `Monster ${id} invalid region`);
    assert.ok(monster.hp > 0, `Monster ${id} hp must be > 0`);
    assert.ok(monster.dmg > 0, `Monster ${id} dmg must be > 0`);
    assert.ok(monster.speed > 0, `Monster ${id} speed must be > 0`);
    assert.ok(monster.drop && typeof monster.drop === 'object', `Monster ${id} missing drop table`);

    for (const [matId, qty] of Object.entries(monster.drop)) {
      assert.ok(MATERIALS[matId], `Monster ${id} drop item '${matId}' not found in MATERIALS catalog`);
      assert.ok(qty > 0, `Monster ${id} drop qty must be > 0`);
    }
  }

  // Specific monster checks
  assert.equal(MONSTERS.moss_slime.region, 'meadow');
  assert.equal(MONSTERS.moss_slime.drop.monster_gel, 2);
  assert.equal(MONSTERS.thornback_boar.drop.monster_fang, 1);
  assert.equal(MONSTERS.thornback_boar.drop.monster_gel, 1);
  assert.equal(MONSTERS.pollen_wisp.ranged, true);
  assert.equal(MONSTERS.pollen_wisp.drop.herb_seed, 1);
  assert.equal(MONSTERS.crystal_beetle.region, 'hollow');
  assert.equal(MONSTERS.crystal_beetle.drop.crystal_ore, 2);
  assert.equal(MONSTERS.quartz_golemling.hp, 140);

  // Verify all bosses
  const bossIds = Object.keys(BOSSES);
  assert.equal(bossIds.length, 2);

  for (const [id, boss] of Object.entries(BOSSES)) {
    assert.equal(boss.id, id);
    assert.ok(boss.name, `Boss ${id} missing name`);
    assert.ok(boss.hp > 0, `Boss ${id} hp must be > 0`);
    assert.ok(boss.dmg > 0, `Boss ${id} dmg must be > 0`);
    assert.ok(boss.pity > 0, `Boss ${id} pity must be > 0`);
    assert.ok(boss.charmTiers && typeof boss.charmTiers === 'object');

    for (const [matId, range] of Object.entries(boss.drop)) {
      assert.ok(MATERIALS[matId], `Boss ${id} drop item '${matId}' not in MATERIALS catalog`);
      assert.ok(Array.isArray(range) && range.length === 2 && range[0] <= range[1]);
    }
  }

  assert.equal(BOSSES.elder_moss_golem.pity, 6);
  assert.deepEqual(BOSSES.elder_moss_golem.phases, [1, 0.6, 0.3]);
  assert.equal(BOSSES.hollow_crystal_weaver.pity, 10);
  assert.equal(BOSSES.hollow_crystal_weaver.charmTiers[1], 0.10);
  assert.equal(BOSSES.hollow_crystal_weaver.charmTiers[2], 0.12);
});

test('2. Weapon damage scaling, tier multipliers, and power soft cap', () => {
  // Tool tier multiplier: 1 + 0.35 * (tier - 1)
  assert.equal(toolTierMult(1), 1.0);
  assert.equal(toolTierMult(2), 1.35);
  assert.equal(toolTierMult(3), 1.70);
  assert.equal(toolTierMult(0), 1.0); // clamped to min tier 1

  // Base damages with no power bonus:
  // Pickaxe: base 12
  assert.equal(weaponDamage({ tool: 'pickaxe', tier: 1 }), 12);
  assert.equal(weaponDamage({ tool: 'pickaxe', tier: 1, crit: true }), 18);
  // Axe: base 10
  assert.equal(weaponDamage({ tool: 'axe', tier: 1 }), 10);
  assert.equal(weaponDamage({ tool: 'axe', tier: 1, crit: true }), 15);
  // Staff: base 8
  assert.equal(weaponDamage({ tool: 'staff', tier: 1 }), 8);
  assert.equal(weaponDamage({ tool: 'staff', tier: 1, crit: true }), 12);

  // Tier 2 weapon damage:
  // Pickaxe: 12 * 1.35 = 16.2 -> round is 16
  assert.equal(weaponDamage({ tool: 'pickaxe', tier: 2 }), 16);
  assert.equal(weaponDamage({ tool: 'pickaxe', tier: 2, crit: true }), 24);

  // Axe tier 2: 10 * 1.35 = 13.5 -> round is 14
  assert.equal(weaponDamage({ tool: 'axe', tier: 2 }), 14);
  assert.equal(weaponDamage({ tool: 'axe', tier: 2, crit: true }), 21);

  // Power stat scaling and soft-cap:
  // At power 140, softCap(140, 0.6, 140) = 0.6 * (1 - 1/e) ≈ 0.37927
  // Axe base 10: 10 * 1.37927 = 13.79 -> 14
  const dmg140 = weaponDamage({ tool: 'axe', tier: 1, stats: { power: 140 } });
  assert.equal(dmg140, 14);

  // At extremely high power (e.g. 50,000), softCap asymptotes towards cap 0.60
  // Axe base 10: 10 * 1.6 = 16
  const dmgMax = weaponDamage({ tool: 'axe', tier: 1, stats: { power: 50000 } });
  assert.equal(dmgMax, 16);

  // Pickaxe max power: 12 * 1.6 = 19.2 -> 19
  const pickaxeDmgMax = weaponDamage({ tool: 'pickaxe', tier: 1, stats: { power: 50000 } });
  assert.equal(pickaxeDmgMax, 19);
});

test('3. Attack cooldown formula and swiftness soft cap', () => {
  // attackCooldownMs(stats) = round(650 / (1 + softCap(stats.swiftness, 0.25, 140)))
  // Base cooldown (0 swiftness)
  assert.equal(attackCooldownMs({ swiftness: 0 }), 650);
  assert.equal(attackCooldownMs(), 650);

  // Swiftness = 140: bonus ≈ 0.25 * (1 - 1/e) ≈ 0.15803 -> round(650 / 1.15803) = 561
  assert.equal(attackCooldownMs({ swiftness: 140 }), 561);

  // Swiftness very high -> asymptotes to cap 0.25 -> round(650 / 1.25) = 520
  assert.equal(attackCooldownMs({ swiftness: 100000 }), 520);
});

test('4. hitsInArc geometry detects targets within distance and cone arc', () => {
  const origin = { x: 0, z: 0 };
  const facing = { x: 0, z: 1 }; // Facing along positive Z axis

  const targets = [
    { id: 'in_front_close', x: 0, z: 1 },        // dist 1, angle 0 deg -> HIT
    { id: 'in_front_edge', x: 0.5, z: 1 },       // dist ~1.12, angle ~26.5 deg -> HIT for arc 70 deg
    { id: 'out_of_angle', x: 1, z: 0.1 },        // dist ~1, angle ~84 deg -> MISS for arc 70 deg
    { id: 'behind', x: 0, z: -1 },               // dist 1, angle 180 deg -> MISS
    { id: 'out_of_range', x: 0, z: 3 },          // dist 3 > range 2 -> MISS
    { id: 'at_origin', x: 0, z: 0 },             // dist 0 -> HIT
  ];

  // Pickaxe: range 1.6, arc 70 deg
  const pickaxeHits = hitsInArc({
    origin,
    facing,
    range: 1.6,
    arcDeg: 70,
    targets,
  });

  assert.ok(pickaxeHits.includes('in_front_close'));
  assert.ok(pickaxeHits.includes('in_front_edge'));
  assert.ok(pickaxeHits.includes('at_origin'));
  assert.ok(!pickaxeHits.includes('out_of_angle'));
  assert.ok(!pickaxeHits.includes('behind'));
  assert.ok(!pickaxeHits.includes('out_of_range'));

  // Wide cleave (arc 180 deg) includes side targets
  const wideHits = hitsInArc({
    origin,
    facing,
    range: 1.6,
    arcDeg: 180,
    targets,
  });
  assert.ok(wideHits.includes('out_of_angle'));
  assert.ok(!wideHits.includes('behind')); // behind is 180 deg, half arc is 90 deg -> miss
});

test('5. All 16 charms have ultimates matching design mapping', () => {
  const catalogCharmIds = Object.keys(CHARMS);
  assert.equal(catalogCharmIds.length, 16);

  const ultimateIds = Object.keys(ULTIMATES);
  assert.equal(ultimateIds.length, 16);

  // Ensure 1:1 key mapping with charm catalog
  for (const charmId of catalogCharmIds) {
    const ult = ULTIMATES[charmId];
    assert.ok(ult, `Missing ultimate for charm ${charmId}`);
    assert.ok(ult.name, `Ultimate ${charmId} missing name`);
    assert.ok(ult.cooldownMs >= 45000 && ult.cooldownMs <= 90000, `Cooldown out of range: ${ult.cooldownMs}`);
    assert.ok(ult.radius !== undefined, `Ultimate ${charmId} missing radius`);
    assert.ok(ult.effect && ult.effect.type, `Ultimate ${charmId} missing effect type`);
  }

  // Verify all 16 distinct effects
  assert.equal(ULTIMATES.charm_berry_perfume.effect.type, 'loot_boost');
  assert.equal(ULTIMATES.charm_berry_perfume.effect.pct, 0.30);
  assert.equal(ULTIMATES.charm_berry_perfume.effect.ms, 10000);

  assert.equal(ULTIMATES.charm_clover_bell.effect.type, 'rare_reroll');
  assert.equal(ULTIMATES.charm_clover_bell.effect.swings, 5);

  assert.equal(ULTIMATES.charm_ribbon_musicbox.effect.type, 'haste');
  assert.equal(ULTIMATES.charm_ribbon_musicbox.effect.pct, 0.35);
  assert.equal(ULTIMATES.charm_ribbon_musicbox.effect.party, true);

  assert.equal(ULTIMATES.charm_honeybee_lantern.effect.type, 'heal_field');
  assert.equal(ULTIMATES.charm_honeybee_lantern.effect.pctPerSec, 0.06);

  assert.equal(ULTIMATES.charm_cinderella_watch.effect.type, 'slow');
  assert.equal(ULTIMATES.charm_cinderella_watch.effect.pct, 0.50);
  assert.equal(ULTIMATES.charm_cinderella_watch.radius, 8);

  assert.equal(ULTIMATES.charm_siren_pearl.effect.type, 'pull');
  assert.equal(ULTIMATES.charm_siren_pearl.radius, 7);

  assert.equal(ULTIMATES.charm_roulette_watch.effect.type, 'free_swings');
  assert.equal(ULTIMATES.charm_roulette_watch.effect.n, 8);

  assert.equal(ULTIMATES.charm_phantom_mirror.effect.type, 'clone');
  assert.equal(ULTIMATES.charm_phantom_mirror.effect.ms, 6000);

  assert.equal(ULTIMATES.charm_kitsune_omamori.effect.type, 'homing');
  assert.equal(ULTIMATES.charm_kitsune_omamori.effect.n, 6);
  assert.equal(ULTIMATES.charm_kitsune_omamori.effect.dmgMult, 1.2);
  assert.equal(ULTIMATES.charm_kitsune_omamori.effect.reveals, true);

  assert.equal(ULTIMATES.charm_glacial_snowglobe.effect.type, 'freeze');
  assert.equal(ULTIMATES.charm_glacial_snowglobe.effect.ms, 2000);
  assert.equal(ULTIMATES.charm_glacial_snowglobe.effect.vuln, 0.50);

  assert.equal(ULTIMATES.charm_pharaoh_ankh.effect.type, 'nuke');
  assert.equal(ULTIMATES.charm_pharaoh_ankh.effect.mult, 4);
  assert.equal(ULTIMATES.charm_pharaoh_ankh.effect.armorBreak, true);

  assert.equal(ULTIMATES.charm_tsukuyomi_mirror.effect.type, 'stun');
  assert.equal(ULTIMATES.charm_tsukuyomi_mirror.effect.ms, 2500);

  assert.equal(ULTIMATES.charm_emperor_mochi_crown.effect.type, 'summon');
  assert.equal(ULTIMATES.charm_emperor_mochi_crown.effect.ms, 12000);

  assert.equal(ULTIMATES.charm_golden_pinata_trophy.effect.type, 'loot_shower');
  assert.equal(ULTIMATES.charm_golden_pinata_trophy.effect.ms, 10000);

  assert.equal(ULTIMATES.charm_seraphim_rose_halo.effect.type, 'shield');
  assert.equal(ULTIMATES.charm_seraphim_rose_halo.effect.dmgPct, 0.25);

  assert.equal(ULTIMATES.charm_eclipse_dragon_core.effect.type, 'cone');
  assert.equal(ULTIMATES.charm_eclipse_dragon_core.effect.mult, 2.5);
  assert.equal(ULTIMATES.charm_eclipse_dragon_core.effect.nodeCrack, 0.5);
});

test('6. Ultimate cooldown with tea buff is 20% shorter', () => {
  const baseCd = ULTIMATES.charm_berry_perfume.cooldownMs; // 45000
  assert.equal(ultimateCooldownMs('charm_berry_perfume'), 45000);
  assert.equal(ultimateCooldownMs('charm_berry_perfume', { teaBuff: false }), 45000);

  const teaCd = ultimateCooldownMs('charm_berry_perfume', { teaBuff: true });
  assert.equal(teaCd, Math.round(45000 * 0.8)); // 36000

  // Works with short charm id (without prefix)
  assert.equal(ultimateCooldownMs('berry_perfume', { teaBuff: true }), 36000);
});

test('7. Invasion interval and wave scaling for 1 vs 10 players', () => {
  // Interval range
  assert.equal(INVASION.INTERVAL_MIN_MS, 45 * 60e3);
  assert.equal(INVASION.INTERVAL_MAX_MS, 60 * 60e3);
  assert.equal(INVASION.WARNING_MS, 120e3);

  const now = 1000000;
  const nextMin = nextInvasionAt(now, () => 0);
  assert.equal(nextMin, now + INVASION.INTERVAL_MIN_MS);

  const nextMax = nextInvasionAt(now, () => 1);
  assert.equal(nextMax, now + INVASION.INTERVAL_MAX_MS);

  // Wave 1, 1 player
  // total = round(6 * (1 + 0) * (1 + 0)) = 6
  // hpMultiplier = 1.0
  const waveSolo1 = waveComposition({ region: 'meadow', wave: 1, activePlayers: 1 });
  assert.equal(waveSolo1.total, 6);
  assert.equal(waveSolo1.hpMultiplier, 1.0);
  const sumSolo1 = waveSolo1.reduce((sum, m) => sum + m.count, 0);
  assert.equal(sumSolo1, 6);
  // All monsters are meadow monsters
  waveSolo1.forEach((m) => {
    assert.equal(MONSTERS[m.type].region, 'meadow');
  });

  // Wave 3, 1 player
  // total = round(6 * 1 * (1 + 0.3 * 2)) = round(6 * 1.6) = 10
  const waveSolo3 = waveComposition({ region: 'meadow', wave: 3, activePlayers: 1 });
  assert.equal(waveSolo3.total, 10);
  assert.equal(waveSolo3.reduce((sum, m) => sum + m.count, 0), 10);

  // Wave 1, 10 players
  // total = round(6 * (1 + 0.55 * 9) * 1) = round(6 * 5.95) = 36
  // hpMultiplier = 1 + 0.15 * 9 = 2.35
  const wave10p1 = waveComposition({ region: 'hollow', wave: 1, activePlayers: 10 });
  assert.equal(wave10p1.total, 36);
  assert.equal(wave10p1.hpMultiplier, 2.35);
  assert.equal(wave10p1.reduce((sum, m) => sum + m.count, 0), 36);
  // All monsters are hollow monsters
  wave10p1.forEach((m) => {
    assert.equal(MONSTERS[m.type].region, 'hollow');
  });

  // Wave 3, 10 players
  // total = round(6 * 5.95 * 1.6) = round(57.12) = 57
  const wave10p3 = waveComposition({ region: 'hollow', wave: 3, activePlayers: 10 });
  assert.equal(wave10p3.total, 57);
  assert.equal(wave10p3.reduce((sum, m) => sum + m.count, 0), 57);
});

test('8. Outpost offline on destruction and repair without kit wastage', () => {
  const outpost = { hp: 1000, offline: false };

  // Partial damage keeps outpost online
  applyOutpostDamage(outpost, 400);
  assert.equal(outpost.hp, 600);
  assert.equal(outpost.offline, false);

  // Lethal damage drops hp to 0 and marks offline
  applyOutpostDamage(outpost, 800);
  assert.equal(outpost.hp, 0);
  assert.equal(outpost.offline, true);

  // Excess damage does not drop below 0
  applyOutpostDamage(outpost, 500);
  assert.equal(outpost.hp, 0);
  assert.equal(outpost.offline, true);

  // Repair from 0 HP with 10 kits:
  // Missing 1000 HP -> 1000 / 250 = 4 kits needed
  // Player offers 10 kits -> only 4 used! 6 kits not wasted!
  const used = repairOutpost(outpost, 10);
  assert.equal(used, 4);
  assert.equal(outpost.hp, 1000);
  assert.equal(outpost.offline, false);

  // Repair when already full uses 0 kits
  assert.equal(repairOutpost(outpost, 5), 0);
  assert.equal(outpost.hp, 1000);

  // Partial repair: 1 kit brings it back online
  applyOutpostDamage(outpost, 1000);
  assert.equal(outpost.offline, true);
  const singleKitUsed = repairOutpost(outpost, 1);
  assert.equal(singleKitUsed, 1);
  assert.equal(outpost.hp, 250);
  assert.equal(outpost.offline, false);
});

test('9. Contribution ledger and 5% qualifiers threshold', () => {
  const ledger = contributionLedger();

  // Score formula: dmg + heal * 1.5 + repair * 2
  addContribution(ledger, 'alice', { dmg: 50, heal: 20, repair: 10 }); // 50 + 30 + 20 = 100
  addContribution(ledger, 'bob', { dmg: 30, heal: 0, repair: 0 });     // 30
  addContribution(ledger, 'charlie', { dmg: 0, heal: 2, repair: 1 });  // 3 + 2 = 5
  addContribution(ledger, 'david', { dmg: 1, heal: 0, repair: 0 });    // 1

  // Total score = 100 + 30 + 5 + 1 = 136
  // Alice: 100 / 136 ≈ 73.5% >= 5% -> qualifies
  // Bob: 30 / 136 ≈ 22.1% >= 5% -> qualifies
  // Charlie: 5 / 136 ≈ 3.67% < 5% -> DOES NOT qualify
  // David: 1 / 136 ≈ 0.74% < 5% -> DOES NOT qualify

  const qualified = qualifiers(ledger, 0.05);
  assert.deepEqual(qualified.sort(), ['alice', 'bob'].sort());

  // Accumulating more contribution for charlie pushes them over 5%
  addContribution(ledger, 'charlie', { repair: 5 }); // +10 score -> score 15
  // Total score = 146; charlie = 15 / 146 ≈ 10.27% >= 5% -> now qualifies
  const qualified2 = qualifiers(ledger, 0.05);
  assert.ok(qualified2.includes('charlie'));
});

test('10. Boss loot pity and independent rolls with seeded RNG', () => {
  // Deterministic mock RNG sequence
  function createMockRng(values) {
    let idx = 0;
    return () => {
      const val = values[idx % values.length];
      idx++;
      return val;
    };
  }

  // Test Elder Moss Golem (drop: boss_core_moss: [2, 4], charmTiers: { 1: 0.18 }, pity: 6)
  // Call 1 per user is core count: min + floor(rng * 3)
  // Call 2 per user is charm roll

  // User 1: pity reached (pityByUser = 5 -> 5 + 1 = 6 >= pity 6)
  // RNG produces high value (0.95), so natural roll (0.18) fails, but pity triggers!
  const pityRng = createMockRng([0.5, 0.95]); // 0.5 -> core = 2 + floor(1.5) = 3; 0.95 -> natural fail
  const pityLoot = rollBossLoot({
    bossId: 'elder_moss_golem',
    qualifying: ['pity_player'],
    rng: pityRng,
    pityByUser: { pity_player: 5 },
  });

  assert.equal(pityLoot.pity_player.items.boss_core_moss, 3);
  assert.equal(pityLoot.pity_player.items.core, 3);
  assert.equal(pityLoot.pity_player.charmTier, 1);
  assert.equal(pityLoot.pity_player.pityReset, true);

  // User 2: pity NOT reached (pityByUser = 2), natural roll fails (0.90)
  const noDropRng = createMockRng([0.1, 0.90]);
  const noDropLoot = rollBossLoot({
    bossId: 'elder_moss_golem',
    qualifying: ['unlucky_player'],
    rng: noDropRng,
    pityByUser: { unlucky_player: 2 },
  });

  assert.equal(noDropLoot.unlucky_player.charmTier, null);
  assert.equal(noDropLoot.unlucky_player.pityReset, false);

  // User 3: natural drop hits (rng = 0.05 < 0.18)
  const dropRng = createMockRng([0.99, 0.05]);
  const dropLoot = rollBossLoot({
    bossId: 'elder_moss_golem',
    qualifying: ['lucky_player'],
    rng: dropRng,
    pityByUser: { lucky_player: 0 },
  });

  assert.equal(dropLoot.lucky_player.charmTier, 1);
  assert.equal(dropLoot.lucky_player.pityReset, true);

  // Test Hollow Crystal Weaver (charmTiers: { 1: 0.10, 2: 0.12 }, pity: 10)
  // Tier 2 evaluated first (0.12), then Tier 1 (0.10)
  // Roll < 0.12 -> drops Tier 2
  const t2Rng = createMockRng([0.0, 0.08]);
  const t2Loot = rollBossLoot({
    bossId: 'hollow_crystal_weaver',
    qualifying: ['t2_winner'],
    rng: t2Rng,
  });
  assert.equal(t2Loot.t2_winner.charmTier, 2);
  assert.equal(t2Loot.t2_winner.pityReset, true);

  // Roll between 0.12 and 0.22 -> drops Tier 1
  const t1Rng = createMockRng([0.0, 0.15]);
  const t1Loot = rollBossLoot({
    bossId: 'hollow_crystal_weaver',
    qualifying: ['t1_winner'],
    rng: t1Rng,
  });
  assert.equal(t1Loot.t1_winner.charmTier, 1);
  assert.equal(t1Loot.t1_winner.pityReset, true);

  // Pity guarantee for Hollow Crystal Weaver gives lowest tier (1)
  const weaverPityRng = createMockRng([0.0, 0.80]);
  const weaverPityLoot = rollBossLoot({
    bossId: 'hollow_crystal_weaver',
    qualifying: ['weaver_pity'],
    rng: weaverPityRng,
    pityByUser: { weaver_pity: 9 }, // 9 + 1 = 10 >= 10
  });
  assert.equal(weaverPityLoot.weaver_pity.charmTier, 1);
  assert.equal(weaverPityLoot.weaver_pity.pityReset, true);
});
