// tests/cloud_dash_meta_retention.test.js — Cloud Dash meta-progression & retention tests.
// Covers: 11 Build identities, diffBuilds & celebrations, Sky Weather & deterministic track,
// Cloud League ladder math, 3-mission daily retention, and Server RPG Loadout Presets & Hybrid discovery.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALL_BUILDS,
  diffBuilds,
  SKY_WEATHERS,
  getWeeklyWeather,
  dashModsFromStats,
  CLOUD_LEAGUE_TIERS,
  leagueTierFor,
  computeLeagueDelta,
  DASH_DAILY_CHEST_MAX,
  DASH_CHEST_BAR_MAX,
  DASH_MISSION_POOL,
  dailyMissionsForDay,
  ensureDashDaily,
  detectBuild,
} from '../shared/dash_builds.js';
import { buildTrack } from '../shared/cloud_dash_track.js';
import { createStarterProfile } from '../server/profile_factory.js';
import * as rpg from '../server/rpg_service.js';
import { computeUniversalStats } from '../shared/universal_stats.js';

test('1. ALL_BUILDS catalog: contains 11 unique entries (4 main, 6 hybrid, 1 balanced)', () => {
  assert.equal(ALL_BUILDS.length, 11, 'ALL_BUILDS has exactly 11 entries');

  const mainBuilds = ALL_BUILDS.filter((b) => b.kind === 'main');
  const hybridBuilds = ALL_BUILDS.filter((b) => b.kind === 'hybrid');
  const balancedBuilds = ALL_BUILDS.filter((b) => b.kind === 'balanced');

  assert.equal(mainBuilds.length, 4, '4 main builds (speedster, smasher, collector, trickster)');
  assert.equal(hybridBuilds.length, 6, '6 hybrid builds');
  assert.equal(balancedBuilds.length, 1, '1 balanced build');

  const ids = ALL_BUILDS.map((b) => b.id);
  const uniqueIds = new Set(ids);
  assert.equal(uniqueIds.size, 11, 'all build ids must be unique');

  // Verify expected IDs
  assert.deepEqual(
    mainBuilds.map((b) => b.id).sort(),
    ['collector', 'smasher', 'speedster', 'trickster'].sort()
  );
  assert.deepEqual(
    hybridBuilds.map((b) => b.id).sort(),
    ['gambler', 'jackpot', 'juggernaut', 'phantom', 'sugar_rocket', 'treasure_breaker'].sort()
  );
  assert.equal(balancedBuilds[0].id, 'balanced');

  for (const b of ALL_BUILDS) {
    assert.ok(b.id && typeof b.id === 'string', `${b.id} has id string`);
    assert.ok(b.name && typeof b.name === 'string', `${b.id} has name`);
    assert.ok(b.icon && typeof b.icon === 'string', `${b.id} has icon`);
    assert.ok(Array.isArray(b.perks) && b.perks.length > 0, `${b.id} has perks list`);
  }
});

test('2. diffBuilds: stat deltas, topStat, tierUp, hybridDiscovered, and toast formatting', () => {
  // A. Stat deltas and topStat detection
  const before1 = { swiftness: 100, power: 50, fortune: 20, luck: 10 };
  const after1 = { swiftness: 180, power: 50, fortune: 20, luck: 10 };
  const diff1 = diffBuilds(before1, after1);

  assert.equal(diff1.deltas.swiftness, 80);
  assert.equal(diff1.deltas.power, 0);
  assert.equal(diff1.deltas.fortune, 0);
  assert.equal(diff1.deltas.luck, 0);
  assert.equal(diff1.topStat, 'swiftness');

  // B. Detect tierUp: true when main build rises in tier (e.g. Speedster I -> Speedster II)
  // swiftness thresholds: Tier I = 100, Tier II = 350
  const beforeTier = { swiftness: 150 }; // Speedster Tier 1 (share 100%)
  const afterTier = { swiftness: 380 };  // Speedster Tier 2 (share 100%)
  const diffTier = diffBuilds(beforeTier, afterTier);

  assert.equal(diffTier.before.id, 'speedster');
  assert.equal(diffTier.before.tier, 1);
  assert.equal(diffTier.after.id, 'speedster');
  assert.equal(diffTier.after.tier, 2);
  assert.equal(diffTier.tierUp, true);
  assert.equal(diffTier.hybridDiscovered, false);
  assert.ok(diffTier.toast.includes('TIER UP!'));
  assert.ok(diffTier.toast.includes('SPEEDSTER II'));

  // C. Detect hybridDiscovered: true when transitioning into a hybrid build
  // Juggernaut requires swiftness >= 350 and power >= 325, both >= 30% share
  const beforeMain = { swiftness: 400 }; // Speedster Tier II
  const afterHybrid = { swiftness: 400, power: 400 }; // Juggernaut (swiftness 50%, power 50%)
  const diffHybrid = diffBuilds(beforeMain, afterHybrid);

  assert.equal(diffHybrid.after.kind, 'hybrid');
  assert.equal(diffHybrid.after.id, 'juggernaut');
  assert.equal(diffHybrid.hybridDiscovered, true);
  assert.equal(diffHybrid.tierUp, false);
  assert.ok(diffHybrid.toast.includes('SECRET HYBRID!'));
  assert.ok(diffHybrid.toast.includes('JUGGERNAUT'));
  assert.ok(diffHybrid.toast.includes('⚡🔥'));
});

test('3. Sky Weather: getWeeklyWeather deterministic rotation & dashModsFromStats weather boosts', () => {
  assert.equal(SKY_WEATHERS.length, 4);

  // A. Deterministic by UTC week timestamp
  const t0 = 0; // week 0
  const t1 = 7 * 86400_000; // week 1
  const t2 = 14 * 86400_000; // week 2
  const t3 = 21 * 86400_000; // week 3
  const t4 = 28 * 86400_000; // week 4 (cycles back to week 0)

  const w0 = getWeeklyWeather(t0);
  const w1 = getWeeklyWeather(t1);
  const w2 = getWeeklyWeather(t2);
  const w3 = getWeeklyWeather(t3);
  const w4 = getWeeklyWeather(t4);

  assert.equal(w0.id, 'storm');
  assert.equal(w1.id, 'jelly');
  assert.equal(w2.id, 'tailwind');
  assert.equal(w3.id, 'prism');
  assert.equal(w4.id, w0.id, 'rotates back to storm on 4th week');
  assert.equal(getWeeklyWeather(t0).id, getWeeklyWeather(t0 + 1000).id, 'deterministic within same week');

  // B. dashModsFromStats applies tailwind speed bonus and faster slipFill
  const speedBonus = { swiftness: 200 };
  const baseMods = dashModsFromStats(speedBonus);
  const tailwindMods = dashModsFromStats(speedBonus, { weather: 'tailwind' });

  // Tailwind grants +0.02 statSpeed and slips fill 15% faster (slipFillMul *= 0.85)
  assert.ok(tailwindMods.statSpeed > baseMods.statSpeed, 'tailwind increases statSpeed');
  assert.equal(Math.round((tailwindMods.statSpeed - baseMods.statSpeed) * 1000) / 1000, 0.02);
  assert.ok(tailwindMods.slipFillMul < baseMods.slipFillMul, 'tailwind makes slipFill faster (lower multiplier)');
  assert.equal(
    Math.round(tailwindMods.slipFillMul * 1000) / 1000,
    Math.round((baseMods.slipFillMul * 0.85) * 1000) / 1000
  );

  // C. Balanced build extra tailwind / weather resilience
  const balNoW = dashModsFromStats({}, {});
  const balTailwind = dashModsFromStats({}, { weather: 'tailwind' });

  // Balanced gets +0.025 statSpeed for weather (instead of +0.01) + 0.02 for tailwind = 0.045
  assert.equal(balNoW.statSpeed, 0.01);
  assert.equal(balTailwind.statSpeed, 0.045, 'balanced statSpeed gets 0.025 resilience + 0.02 tailwind = 0.045');
  assert.equal(balTailwind.magnetMul, 1.15, 'balanced gets 1.15 magnetMul when weather is active (vs 1.1 default)');
});

test('4. buildTrack determinism and track modifiers (weather, chaos, noPrisms)', () => {
  // A. buildTrack(7) with no opts is 100% deterministic
  const tA = buildTrack(7);
  const tB = buildTrack(7);
  assert.equal(JSON.stringify(tA), JSON.stringify(tB), 'same seed produces identical track');

  // B. noPrisms: true removes all mystery prisms
  const tNoPrisms = buildTrack(7, { noPrisms: true });
  assert.equal(tNoPrisms.items.filter((it) => it.t === 'prism').length, 0, 'noPrisms: true has 0 prisms');

  // C. chaos: true or weather: 'prism' has more prisms than default
  const defaultPrisms = tA.items.filter((it) => it.t === 'prism').length;
  const chaosTrack = buildTrack(7, { chaos: true });
  const chaosPrisms = chaosTrack.items.filter((it) => it.t === 'prism').length;
  const weatherPrismTrack = buildTrack(7, { weather: 'prism' });
  const weatherPrisms = weatherPrismTrack.items.filter((it) => it.t === 'prism').length;

  assert.ok(chaosPrisms > defaultPrisms, `chaos prisms (${chaosPrisms}) > default (${defaultPrisms})`);
  assert.ok(weatherPrisms > defaultPrisms, `weather prism (${weatherPrisms}) > default (${defaultPrisms})`);
  assert.equal(chaosPrisms, weatherPrisms, 'chaos and weather: prism use the same dense prism layout');

  // D. weather: 'jelly' converts coins to berries → more berries than default
  const defaultBerries = tA.items.filter((it) => it.t === 'berry').length;
  const jellyTrack = buildTrack(7, { weather: 'jelly' });
  const jellyBerries = jellyTrack.items.filter((it) => it.t === 'berry').length;
  assert.ok(jellyBerries > defaultBerries, `jelly weather berries (${jellyBerries}) > default (${defaultBerries})`);

  // E. weather: 'tailwind' adds speed pads
  const defaultPads = tA.items.filter((it) => it.t === 'pad').length;
  const tailwindTrack = buildTrack(7, { weather: 'tailwind' });
  const tailwindPads = tailwindTrack.items.filter((it) => it.t === 'pad').length;
  assert.ok(tailwindPads > defaultPads, `tailwind pads (${tailwindPads}) > default (${defaultPads})`);

  // F. weather: 'storm' adds storm clouds
  const defaultClouds = tA.items.filter((it) => it.t === 'cloud').length;
  const stormTrack = buildTrack(7, { weather: 'storm' });
  const stormClouds = stormTrack.items.filter((it) => it.t === 'cloud').length;
  assert.ok(stormClouds > defaultClouds, `storm clouds (${stormClouds}) > default (${defaultClouds})`);
});

test('5. Cloud League math: tier thresholds, LP deltas, promotion & demotion protection', () => {
  // A. leagueTierFor tier boundaries
  assert.equal(leagueTierFor(0).id, 'bronze');
  assert.equal(leagueTierFor(299).id, 'bronze');
  assert.equal(leagueTierFor(300).id, 'silver');
  assert.equal(leagueTierFor(599).id, 'silver');
  assert.equal(leagueTierFor(700).id, 'gold');
  assert.equal(leagueTierFor(1200).id, 'rainbow');
  assert.equal(leagueTierFor(1800).id, 'sovereign');

  // B. computeLeagueDelta(1, 280) promotes from bronze to silver: +35 LP -> 315 LP
  const promo = computeLeagueDelta(1, 280);
  assert.equal(promo.beforeLp, 280);
  assert.equal(promo.afterLp, 315);
  assert.equal(promo.delta, 35);
  assert.equal(promo.beforeTier.id, 'bronze');
  assert.equal(promo.afterTier.id, 'silver');
  assert.equal(promo.promoted, true);

  // In cloud_dash_service, promotion sets promoDiamonds = 25
  const promoRewardDiamonds = promo.promoted ? 25 : 0;
  assert.equal(promoRewardDiamonds, 25);

  // C. Demotion protection:
  // Bronze tier has floor: true (minLp: 0) -> LP cannot go below 0
  const bronzeFloor = computeLeagueDelta(4, 0);
  assert.equal(bronzeFloor.beforeLp, 0);
  assert.equal(bronzeFloor.afterLp, 0);
  assert.equal(bronzeFloor.delta, 0);

  // Silver tier has floor: true (minLp: 300) -> 4th place at 300 stays at 300 (demotion-protected)
  const silverFloor = computeLeagueDelta(4, 300);
  assert.equal(silverFloor.beforeLp, 300);
  assert.equal(silverFloor.afterLp, 300);
  assert.equal(silverFloor.delta, 0);
  assert.equal(silverFloor.afterTier.id, 'silver');

  // At 400 LP in Silver, 4th place loses 10 LP -> 390 LP
  const silverLoss = computeLeagueDelta(4, 400);
  assert.equal(silverLoss.beforeLp, 400);
  assert.equal(silverLoss.afterLp, 390);
  assert.equal(silverLoss.delta, -10);
  assert.equal(silverLoss.afterTier.id, 'silver');

  // In Bronze, 4th place loses 10 LP down to floor, remaining safely in Bronze tier
  const bronzeLoss = computeLeagueDelta(4, 150);
  assert.equal(bronzeLoss.beforeLp, 150);
  assert.equal(bronzeLoss.afterLp, 140);
  assert.equal(bronzeLoss.delta, -10);
  assert.equal(bronzeLoss.afterTier.id, 'bronze');
});

test('6. Daily retention: dailyMissionsForDay returns 3 distinct missions & ensureDashDaily resets on new day', () => {
  // A. dailyMissionsForDay returns 3 distinct missions
  const day1 = '2026-10-19';
  const m1 = dailyMissionsForDay(day1);
  assert.equal(m1.length, 3, 'returns exactly 3 missions');
  const uniqueMissions = new Set(m1.map((m) => m.id));
  assert.equal(uniqueMissions.size, 3, 'all 3 missions must be distinct');

  // Deterministic for same dayKey
  const m1Again = dailyMissionsForDay(day1);
  assert.deepEqual(m1, m1Again);

  // B. ensureDashDaily initializes profile.dash_daily
  const p = { dash_daily: null };
  const d1 = ensureDashDaily(p, day1);
  assert.equal(d1.day, day1);
  assert.equal(d1.chests, 0);
  assert.equal(d1.chestPts, 0);
  assert.equal(d1.missions.length, 3);

  // Player makes progress on mission and gains chest bar points
  d1.missions[0].progress = 1;
  d1.chests = 2;
  d1.chestPts = 45;

  // Same day keeps state
  const dSame = ensureDashDaily(p, day1);
  assert.equal(dSame.chests, 2);
  assert.equal(dSame.chestPts, 45);
  assert.equal(dSame.missions[0].progress, 1);

  // C. Changing dayKey resets chests and missions, but carries over chestPts!
  const day2 = '2026-10-20';
  const d2 = ensureDashDaily(p, day2);
  assert.equal(d2.day, day2);
  assert.equal(d2.chests, 0, 'daily chests reset to 0');
  assert.equal(d2.chestPts, 45, 'chestPts carries over across days');
  assert.equal(d2.missions.length, 3);
  assert.equal(d2.missions[0].progress, 0, 'fresh missions start at 0 progress');
});

test('7. Server RPG Preset & Discovery: dashPresetSave, dashPresetEquip, and Secret Hybrid 50-diamond reward', () => {
  const p = createStarterProfile('rpg_preset_test', '1234', 'bkk');
  rpg.migrateRpg(p);

  // Prepare a pet with mythic traits for Swiftness and Power
  p.pets[0].stars = 3;
  p.pets[0].level = 30;
  p.pets[0].mood = 100;
  p.pets[0].slots = [
    { stat: 'power', tier: 'mythic' },
    { stat: 'ult_charge', tier: 'mythic' },
    { stat: 'mach_wing', tier: 'mythic' },
  ];

  // Set up owned gear in inventory
  p.inventory.epic_sakura_samurai = { refine: 10, dupes: 0, pity: 0 };
  p.inventory.hat_mythic_dragon_hoard_crown = { refine: 10, dupes: 0, pity: 0, attune: { stat: 'swiftness', count: 1 } };
  p.inventory.gloves_mythic_vault_key_scepter = { refine: 10, dupes: 0, pity: 0, attune: { stat: 'swiftness', count: 1 } };
  p.inventory.boots_epic_locomotive_wheel_boots = { refine: 10, dupes: 0, pity: 0 };
  p.inventory.wings_golden_seraphim = { refine: 10, dupes: 0, pity: 0 };
  p.inventory.s1_naga_sovereign = { refine: 0, dupes: 0, pity: 0 };

  // Equip full Juggernaut gear + set glamour
  p.equipped = {
    outfit: { id: 'epic_sakura_samurai', refine: 10 },
    hat: { id: 'hat_mythic_dragon_hoard_crown', refine: 10, attune: { stat: 'swiftness', count: 1 } },
    gloves: { id: 'gloves_mythic_vault_key_scepter', refine: 10, attune: { stat: 'swiftness', count: 1 } },
    boots: { id: 'boots_epic_locomotive_wheel_boots', refine: 10 },
    wings: { id: 'wings_golden_seraphim', refine: 10 },
    pet: { id: p.pets[0].id, uid: p.pets[0].uid },
  };
  p.glamour.outfit = 's1_naga_sovereign';
  rpg.syncGlamourAndAttune(p);

  // A. dashPresetSave saves current equipped gear, glamour, and pet into slot 0..2 with custom name
  const saveResult = rpg.dashPresetSave(p, { slotIdx: 0, name: 'Speed Juggernaut' });
  assert.equal(saveResult.ok, true);
  assert.equal(saveResult.slotIdx, 0);
  assert.equal(saveResult.preset.name, 'Speed Juggernaut');
  assert.equal(saveResult.preset.equipped.outfit.id, 'epic_sakura_samurai');
  assert.equal(saveResult.preset.equipped.pet.id, p.pets[0].id);
  assert.equal(saveResult.preset.glamour.outfit, 's1_naga_sovereign');

  // Change equipped items and glamour to newbie outfit (balanced build)
  p.equipped = { outfit: { id: 'newbie_outfit', refine: 0 }, pet: null };
  p.glamour.outfit = null;
  rpg.syncGlamourAndAttune(p);

  // Ensure builds_found only has balanced
  p.dash_builds_found = ['balanced'];
  const startDiamonds = 500;
  p.diamonds = startDiamonds;

  // B. dashPresetEquip restores equipped items + glamour and returns buildUpdate
  const equipResult = rpg.dashPresetEquip(p, { slotIdx: 0 });
  assert.equal(equipResult.ok, true);
  assert.equal(equipResult.slotIdx, 0);
  assert.equal(p.equipped.outfit.id, 'epic_sakura_samurai');
  assert.equal(p.equipped.gloves.id, 'gloves_mythic_vault_key_scepter');
  assert.equal(p.equipped.pet.id, p.pets[0].id);
  assert.equal(p.glamour.outfit, 's1_naga_sovereign');

  // C. Discovering Secret Hybrid build for the 1st time grants +50 diamonds
  assert.ok(equipResult.buildUpdate);
  assert.equal(equipResult.buildUpdate.build.kind, 'hybrid');
  assert.equal(equipResult.buildUpdate.build.id, 'juggernaut');
  assert.equal(equipResult.buildUpdate.newlyFound, true);
  assert.equal(equipResult.buildUpdate.hybridBonusDiamonds, 50);
  assert.equal(p.diamonds, startDiamonds + 50);
  assert.ok(p.dash_builds_found.includes('juggernaut'));

  // D. Does NOT grant +50 diamonds a second time for the same hybrid
  p.equipped = { outfit: { id: 'newbie_outfit', refine: 0 }, pet: null };
  rpg.syncGlamourAndAttune(p);

  const equipSecondResult = rpg.dashPresetEquip(p, { slotIdx: 0 });
  assert.equal(equipSecondResult.ok, true);
  assert.equal(equipSecondResult.buildUpdate.newlyFound, false);
  assert.equal(equipSecondResult.buildUpdate.hybridBonusDiamonds, 0);
  assert.equal(p.diamonds, startDiamonds + 50, 'diamonds remain unchanged on 2nd equip of same hybrid');

  // Also test discovery via wardrobeEquip
  p.dash_builds_found = ['balanced'];
  p.diamonds = startDiamonds;
  p.equipped.gloves = null;
  rpg.syncGlamourAndAttune(p);

  const equipDirectResult = rpg.wardrobeEquip(p, { slot: 'gloves', itemId: 'gloves_mythic_vault_key_scepter' });
  assert.equal(equipDirectResult.ok, true);
  assert.equal(equipDirectResult.buildUpdate.newlyFound, true);
  assert.equal(equipDirectResult.buildUpdate.hybridBonusDiamonds, 50);
  assert.equal(p.diamonds, startDiamonds + 50);
});
