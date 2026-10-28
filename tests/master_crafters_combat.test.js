// tests/master_crafters_combat.test.js — Master Crafters Combat, Living Ecology, Alpha Elites, 12 Boss Weapons & 20 Monster Skills test suite.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ACCESSORIES,
  COMBAT_CLASSES,
  STARTER_WEAPON_IDS,
  resolveWeaponClass,
} from '../shared/catalog_gear_pets.js';
import { visibleSlotId, activeWeaponClass } from '../shared/accessory_attach.js';
import {
  STAT_META,
  computeUniversalStats,
  inspectItemAttune,
  skyFrontierMods,
} from '../shared/universal_stats.js';
import {
  ALPHA_ELITE,
  MONSTERS,
  BOSSES,
  WEAPON_CLASSES,
  playerMaxHp,
  classComboDamage,
  classAttackCooldownMs,
  BOSS_WEAPON_FORGE,
  MONSTER_SKILLS,
  MONSTER_SKILL_IDS,
  MONSTER_CODEX_META,
  MONSTER_CODEX_IDS,
  buildMonsterCodex,
  SKILL_DROP_RATES,
  skillCooldownMs,
  computeSkillNumbers,
  rollMonsterSkillDrop,
} from '../shared/combat_rules.js';
import { REGIONS } from '../shared/sky_frontier_rules.js';
import {
  defaultFrontier,
  createStarterProfile,
  defaultProfile,
  migrateProfile,
  ensureStarterCosmetics,
} from '../server/profile_factory.js';
import {
  migrateRpg,
  wardrobeEquip,
  wardrobeGlamour,
  blacksmithForge,
  gearAttune,
  attuneGear,
} from '../server/rpg_service.js';
import { createBasecampService } from '../server/basecamp_service.js';
import { createSkyFrontierService, COMBAT } from '../server/sky_frontier_service.js';

function makeSeededRng(seed = 42) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createCombatEnv({ initialNow = 10_000_000, rng = null } = {}) {
  let currentTime = initialNow;
  let rngFn = rng || makeSeededRng(42);
  const profiles = new Map();
  const marked = new Set();
  const instances = new Map();
  const presence = new Map();
  const broadcasts = [];
  const changedProfiles = [];
  const worldZones = new Map();

  const db = {
    getProfile: (id) => profiles.get(id) || null,
    markProfile: (id) => marked.add(id),
    getWorldZone: (id) => worldZones.get(id) || null,
    putWorldZone: (id, kind, state) => {
      worldZones.set(id, { zone_id: id, kind, state: JSON.parse(JSON.stringify(state)) });
    },
    listWorldZones: (kind) => [...worldZones.values()].filter((z) => !kind || z.kind === kind),
  };

  const service = createSkyFrontierService({
    db,
    instances,
    presence,
    send: () => {},
    broadcast: (instId, msg) => broadcasts.push({ instId, msg }),
    isCouple: (p) => Boolean(p?.partner_id && profiles.has(p.partner_id) && profiles.get(p.partner_id).partner_id === p.id),
    onProfileChanged: (p) => changedProfiles.push(p.id),
    now: () => currentTime,
    rng: () => rngFn(),
    defaultFrontier,
    setIntervalFn: () => ({ unref() {} }),
    clearIntervalFn: () => {},
  });

  return {
    service,
    db,
    profiles,
    marked,
    instances,
    presence,
    broadcasts,
    changedProfiles,
    setTime: (t) => { currentTime = t; },
    advanceTime: (dt) => { currentTime += dt; return currentTime; },
    getTime: () => currentTime,
    setRng: (fn) => { rngFn = fn; },
  };
}

function spawnTestMob(sh, id, type, x, z, { hp = 200, regionId = 'meadow', kind = 'ambient', dmg = 18, speed = 2.0 } = {}) {
  const mob = {
    id,
    type,
    kind,
    regionId,
    x,
    z,
    hp,
    maxHp: hp,
    dmg,
    speed,
    ranged: false,
    targetId: null,
    atkCdUntil: 0,
    stunUntil: 0,
    slowUntil: 0,
    frozenUntil: 0,
    homeX: x,
    homeZ: z,
    hits: {},
    dmgMult: 1,
    ...(kind === 'boss' ? { stage: 0, ledger: {}, startedAt: 10_000_000, encounterUid: `enc_${id}` } : {}),
  };
  sh.live.monsters.set(id, mob);
  if (kind === 'boss') sh.live.bosses.set(regionId, id);
  return mob;
}

// =================================================================================================
// 1. Catalog 103 gloves_* Combat Classes, Starter Weapons, 12 Boss Weapons & Glamour Resolution
// =================================================================================================
test('1. All 103 gloves_* items define valid combatClass; starter weapons granted on new/migrated profiles; activeWeaponClass follows Glamour || Equipped', () => {
  const gloveEntries = Object.entries(ACCESSORIES).filter(([, def]) => def.slot === 'gloves');
  assert.equal(gloveEntries.length, 103, `Expected 103 gloves_* items, found ${gloveEntries.length}`);
  for (const [id, def] of gloveEntries) {
    assert.ok(COMBAT_CLASSES.includes(def.combatClass), `${id} must have valid combatClass, got ${def.combatClass}`);
    assert.equal(resolveWeaponClass(id), def.combatClass);
  }

  assert.deepEqual([...STARTER_WEAPON_IDS], ['gloves_starter_sword', 'gloves_starter_shortbow', 'gloves_starter_wand']);
  assert.equal(ACCESSORIES.gloves_starter_sword.combatClass, 'melee');
  assert.equal(ACCESSORIES.gloves_starter_shortbow.combatClass, 'ranged');
  assert.equal(ACCESSORIES.gloves_starter_wand.combatClass, 'magic');
  for (const swId of STARTER_WEAPON_IDS) {
    assert.equal(ACCESSORIES[swId].starterCosmetic, true, `${swId} marked starterCosmetic`);
  }
  const bossWeapons = Object.entries(ACCESSORIES).filter(([, def]) => def.bossCraft);
  assert.equal(bossWeapons.length, 12);
  assert.equal(Object.keys(BOSS_WEAPON_FORGE.RECIPES).length, 12);

  // New profiles via createStarterProfile & defaultProfile receive all 3 starter weapons + initialized frontier.skills & basecamp.weaponForge
  const starterBoy = createStarterProfile('hero_boy', '1234', 'bkk');
  const starterGirl = defaultProfile({ id: 'hero_girl', username: 'hero_girl', lineage: 'dxb' });
  for (const p of [starterBoy, starterGirl]) {
    for (const swId of STARTER_WEAPON_IDS) {
      assert.ok(p.inventory[swId], `${p.id} must own ${swId} on Day 1`);
    }
    assert.deepEqual(p.frontier.skills, { unlocked: {}, equipped: [null, null, null, null], passive: null, passives: {}, presets: [null, null, null], essence: 0, reactionsFound: {} });
    assert.deepEqual(p.basecamp.weaponForge, { pity: 0, pending: null });
  }

  // Legacy migration via migrateProfile & migrateRpg grants starter weapons without losing existing skill/forge state (and cleans up legacy bossPity)
  const legacy = {
    id: 'legacy_adv',
    username: 'legacy_adv',
    lineage: 'bkk',
    inventory: { newbie_outfit: { refine: 0, dupes: 0 } },
    frontier: { skills: { unlocked: { sk_tusk_rush: 2 }, equipped: ['sk_tusk_rush', null], bossPity: 5 } },
    basecamp: { weaponForge: { pity: 4, pending: null } },
  };
  migrateProfile(legacy);
  migrateRpg(legacy);
  for (const swId of STARTER_WEAPON_IDS) {
    assert.ok(legacy.inventory[swId], `Migrated profile must receive ${swId}`);
  }
  assert.equal(legacy.frontier.skills.unlocked.sk_tusk_rush, 2);
  assert.deepEqual(legacy.frontier.skills.equipped, ['sk_tusk_rush', null, null, null], 'Legacy 2-slot loadouts migrate to 4 slots');
  assert.equal(legacy.frontier.skills.bossPity, undefined);
  assert.equal(legacy.basecamp.weaponForge.pity, 4);

  // activeWeaponClass follows Glamour || Equipped (visibleSlotId)
  wardrobeEquip(starterBoy, { slot: 'gloves', itemId: 'gloves_starter_sword' });
  assert.equal(visibleSlotId(starterBoy.equipped, 'gloves'), 'gloves_starter_sword');
  assert.equal(activeWeaponClass(starterBoy.equipped), 'melee');

  wardrobeGlamour(starterBoy, { slot: 'gloves', itemId: 'gloves_starter_shortbow' });
  assert.equal(visibleSlotId(starterBoy.equipped, 'gloves'), 'gloves_starter_shortbow');
  assert.equal(activeWeaponClass(starterBoy.equipped), 'ranged');

  wardrobeGlamour(starterBoy, { slot: 'gloves', itemId: 'gloves_starter_wand' });
  assert.equal(activeWeaponClass(starterBoy.equipped), 'magic');

  wardrobeGlamour(starterBoy, { slot: 'gloves', itemId: null });
  assert.equal(activeWeaponClass(starterBoy.equipped), 'melee');
});

// =================================================================================================
// 2. Vitality (fortune) & Swiftness Scaling
// =================================================================================================
test('2. 💖 Vitality (fortune) scales playerMaxHp, healShieldMult & gatherYieldMult; ⚡ Swiftness scales skillHasteMult & lowers cooldowns', () => {
  assert.equal(STAT_META.fortune.label, 'Vitality');
  assert.equal(STAT_META.fortune.icon, '💖');
  assert.equal(STAT_META.swiftness.label, 'Swiftness');

  const lowStats = { fortune: 20, swiftness: 15, power: 25, luck: 15 };
  const highVitStats = { fortune: 220, swiftness: 15, power: 25, luck: 15 };
  const highSwfStats = { fortune: 20, swiftness: 240, power: 25, luck: 15 };

  const hpLow = playerMaxHp(10, lowStats);
  const hpHigh = playerMaxHp(10, highVitStats);
  assert.ok(hpHigh > hpLow + 80, `High Vitality should add substantial Max HP (${hpLow} -> ${hpHigh})`);

  const modsLow = skyFrontierMods(lowStats);
  const modsVit = skyFrontierMods(highVitStats);
  assert.ok(modsVit.maxHpBonus > modsLow.maxHpBonus);
  assert.ok(modsVit.healShieldMult > modsLow.healShieldMult);
  assert.ok(modsVit.gatherYieldMult > modsLow.gatherYieldMult);

  const modsSwf = skyFrontierMods(highSwfStats);
  assert.ok(modsSwf.skillHasteMult > modsLow.skillHasteMult);
  assert.ok(modsSwf.moveSpeedMult > modsLow.moveSpeedMult);

  for (const skId of MONSTER_SKILL_IDS) {
    const cdBase = skillCooldownMs(skId, lowStats);
    const cdFast = skillCooldownMs(skId, highSwfStats);
    assert.ok(cdFast < cdBase, `Swiftness must reduce ${skId} cooldown (${cdBase} -> ${cdFast})`);
    assert.ok(cdFast >= 1500);
  }
  assert.ok(classAttackCooldownMs('melee', highSwfStats, 1) < classAttackCooldownMs('melee', lowStats, 1));
});

// =================================================================================================
// 3. Tinker's Workshop Weapon Forge (roll / keep / take, 10-Pity, Dupes, +5 Refine & Attunement)
// =================================================================================================
test('3. Workshop Weapon Forge: material/gold deduction, B/A/S/SS + 10-roll pity, +1 dupe on Keep & Take, +5 Refine & Attunement on rolledStats', () => {
  let rngQueue = [];
  const nextRng = () => (rngQueue.length ? rngQueue.shift() : 0.4);
  const bc = createBasecampService({ rng: nextRng, now: () => 1_000_000 });

  const p = createStarterProfile('master_smith', '1234', 'bkk');
  migrateRpg(p);
  p.gold = 100_000;
  p.berries = 5_000;

  // Fails before Workshop is built
  const noWs = bc.craftDecor(p, 'weapon_forge:roll:gloves_boss_moss_cleaver');
  assert.equal(noWs.ok, false);
  assert.equal(noWs.error, 'workshop_required');

  // Build Workshop in village
  p.village.copies.workshop = 1;
  p.village.levels.workshop = 1;

  // Unknown weapon & missing material / gold checks
  assert.equal(bc.craftDecor(p, 'weapon_forge:roll:gloves_fake').error, 'unknown_weapon');
  assert.equal(bc.craftDecor(p, 'weapon_forge:roll:gloves_boss_moss_cleaver').error, 'not_enough_materials');

  p.frontier.warehouse.items = {
    boss_core_moss: 60,
    ingot: 120,
    plank: 120,
    boss_core_weaver: 8,
    mithril_ingot: 16,
    crystal_glass: 12,
  };
  const savedGold = p.gold;
  p.gold = 500;
  assert.equal(bc.craftDecor(p, 'weapon_forge:roll:gloves_boss_moss_cleaver').error, 'not_enough_gold');
  p.gold = savedGold;

  // Roll #1 (First craft): grade B (u=0.10), mainStat='power' (0.0), secStat='fortune' (0.4 -> idx 1 of ['swiftness','fortune','luck'])
  rngQueue = [0.10, 0.0, 0.40];
  const r1 = bc.craftDecor(p, 'weapon_forge:roll:gloves_boss_moss_cleaver');
  assert.equal(r1.ok, true);
  assert.equal(r1.weaponForge.mode, 'created');
  assert.equal(r1.weaponForge.grade, 'B');
  assert.equal(r1.weaponForge.pity, 1);
  assert.equal(p.gold, savedGold - 1500);
  assert.equal(p.frontier.warehouse.items.boss_core_moss, 57);
  assert.equal(p.frontier.warehouse.items.ingot, 114);
  assert.equal(p.frontier.warehouse.items.plank, 114);
  assert.ok(p.inventory.gloves_boss_moss_cleaver);
  assert.equal(p.inventory.gloves_boss_moss_cleaver.dupes, 0);
  assert.equal(p.equipped.gloves.id, 'gloves_boss_moss_cleaver', 'Auto-equipped into empty gloves slot');
  assert.deepEqual(p.equipped.gloves.rolledStats, r1.weaponForge.rolledStats);

  // Repeat crafts #2..#9 (all grade B/A) -> test BOTH `keep` and `take`, verifying +1 dupe on EVERY roll
  for (let attempt = 2; attempt <= 9; attempt++) {
    // u=0.20 -> B (attempts 2..5) or u=0.60 -> A (attempts 6..9)
    rngQueue = [attempt <= 5 ? 0.20 : 0.60, 0.05, 0.70];
    const rollRes = bc.craftDecor(p, 'weapon_forge:roll:gloves_boss_moss_cleaver');
    assert.equal(rollRes.ok, true);
    assert.equal(rollRes.weaponForge.mode, 'choice');
    assert.equal(rollRes.weaponForge.pity, attempt);
    assert.equal(p.inventory.gloves_boss_moss_cleaver.dupes, attempt - 1, `+1 dupe granted immediately on repeat roll #${attempt}`);

    // Cannot roll again until pending choice resolved
    const blocked = bc.craftDecor(p, 'weapon_forge:roll:gloves_boss_moss_cleaver');
    assert.equal(blocked.ok, false);
    assert.equal(blocked.error, 'pending_roll_choice');

    if (attempt % 2 === 0) {
      const keepRes = bc.craftDecor(p, 'weapon_forge:keep:gloves_boss_moss_cleaver');
      assert.equal(keepRes.ok, true);
      assert.equal(keepRes.weaponForge.mode, 'kept');
      assert.equal(p.inventory.gloves_boss_moss_cleaver.dupes, attempt - 1, 'Dupe preserved on Keep');
    } else {
      const takeRes = bc.craftDecor(p, 'weapon_forge:take:gloves_boss_moss_cleaver');
      assert.equal(takeRes.ok, true);
      assert.equal(takeRes.weaponForge.mode, 'taken');
      assert.equal(p.inventory.gloves_boss_moss_cleaver.dupes, attempt - 1, 'Dupe preserved on Take');
      assert.deepEqual(p.equipped.gloves.rolledStats, takeRes.weaponForge.rolledStats, 'Equipped rolledStats synced on Take');
    }
  }

  // Attempt #10: wf.pity === 9 -> guaranteed Master Smith pityHit (rng < 0.30 -> SS Masterwork!)
  assert.equal(p.basecamp.weaponForge.pity, 9);
  // rngQueue: [0.10 -> SS!, 0.0 -> mainStat 'power', 0.90 -> secStat 'luck']
  rngQueue = [0.10, 0.0, 0.90];
  const r10 = bc.craftDecor(p, 'weapon_forge:roll:gloves_boss_moss_cleaver');
  assert.equal(r10.ok, true);
  assert.equal(r10.weaponForge.candidate.grade, 'SS');
  assert.equal(r10.weaponForge.candidate.pityHit, true);
  assert.equal(r10.weaponForge.pity, 0, 'Pity resets to 0 on S/SS hit');
  assert.equal(p.inventory.gloves_boss_moss_cleaver.dupes, 9);

  const takeSS = bc.craftDecor(p, 'weapon_forge:take:gloves_boss_moss_cleaver');
  assert.equal(takeSS.ok, true);
  assert.equal(p.inventory.gloves_boss_moss_cleaver.forgeGrade, 'SS');
  // Meadow baseMain=18 * 1.30 = 23, baseSec=14 * 1.30 = 18
  assert.deepEqual(p.inventory.gloves_boss_moss_cleaver.rolledStats, { power: 23, luck: 18 });

  // Also verify Hollow recipe + p.basecamp.bag material fallback
  const pBag = {
    id: 'bag_smith',
    username: 'bag_smith',
    level: 20,
    gold: 10_000,
    inventory: {},
    equipped: { outfit: { id: 'newbie_outfit', refine: 0 }, gloves: null },
    basecamp: {
      buildings: ['workshop'],
      bag: { boss_core_weaver: 4, mithril_ingot: 8, crystal_glass: 6 },
    },
  };
  rngQueue = [0.99, 0.26, 0.0]; // SS grade (u=0.99 >= 0.96), main='swiftness', sec='power'
  const hollowRes = bc.craftDecor(pBag, 'weapon_forge:roll:gloves_boss_weaver_cane');
  assert.equal(hollowRes.ok, true);
  assert.equal(hollowRes.weaponForge.grade, 'SS');
  assert.equal(pBag.gold, 6_000);
  assert.equal(pBag.basecamp.bag.boss_core_weaver, undefined);

  // Star-Force Refine to +5 using the dupes earned from Weapon Forge (rng=0 -> guaranteed success)
  p.equipped.outfit = { id: 'newbie_outfit', refine: 0 };
  p.equipped.pet = null;
  for (let step = 0; step < 5; step++) {
    const fRes = blacksmithForge(p, { itemId: 'gloves_boss_moss_cleaver' }, 1_000_000, () => 0.0);
    assert.equal(fRes.ok, true);
    assert.equal(fRes.success, true);
  }
  assert.equal(p.inventory.gloves_boss_moss_cleaver.refine, 5);
  assert.equal(p.equipped.gloves.refine, 5);
  assert.deepEqual(p.equipped.gloves.rolledStats, { power: 23, luck: 18 });

  // Verify computeUniversalStats scales rolledStats by (1 + 0.15 * 5) = 1.75
  // newbie_outfit gives { all: 2 } at +0 -> +2 to each gear stat
  // gloves_boss_moss_cleaver gives power: round(23 * 1.75) = 40, luck: round(18 * 1.75) = 32
  const outfitBaseAll = computeUniversalStats({ ...p, equipped: { ...p.equipped, gloves: null } }).gear.power;
  const uniBeforeAttune = computeUniversalStats(p);
  assert.equal(uniBeforeAttune.gear.power, outfitBaseAll + Math.round(23 * 1.75));
  assert.equal(uniBeforeAttune.gear.luck, outfitBaseAll + Math.round(18 * 1.75));
  assert.equal(uniBeforeAttune.gear.fortune, outfitBaseAll);

  // Inspect & Attune secondary rolled stat (luck -> fortune / Vitality) at +5
  const attInfo = inspectItemAttune('gloves_boss_moss_cleaver', 5, null, {
    rolledStats: p.inventory.gloves_boss_moss_cleaver.rolledStats,
  });
  assert.equal(attInfo.attunable, true);
  assert.equal(attInfo.unlocked, true);
  assert.equal(attInfo.mainStat, 'power');
  assert.equal(attInfo.defaultSecStat, 'luck');

  const attRes = attuneGear(p, { itemId: 'gloves_boss_moss_cleaver', stat: 'fortune' });
  assert.equal(attRes.ok, true);
  assert.equal(attRes.spent.gold, 0, 'First attunement is free');
  assert.equal(gearAttune, attuneGear);

  const uniAfterAttune = computeUniversalStats(p);
  assert.equal(uniAfterAttune.gear.power, outfitBaseAll + Math.round(23 * 1.75));
  assert.equal(uniAfterAttune.gear.fortune, outfitBaseAll + Math.round(18 * 1.75), 'Secondary rolled stat moved to Vitality');
  assert.equal(uniAfterAttune.gear.luck, outfitBaseAll, 'Old secondary rolled stat zeroed');
});

// =================================================================================================
// 4. Sky Frontier sf_attack 1-2-3 Combos (Melee, Ranged Twin Volley, Magic Starburst + Heal) & Glamour Swap
// =================================================================================================
test('4. Sky Frontier sf_attack 1-2-3 combos across melee, ranged (Twin Volley), magic (Starburst AoE + Co-Op heal) & Glamour weapon swap', () => {
  const env = createCombatEnv({ initialNow: 20_000_000, rng: () => 0.99 }); // rng=0.99 -> deterministic non-crit
  const instId = 'frontier:sf_1~meadow';
  const ws = { instanceId: instId };

  const p1 = createStarterProfile('combo_hero', '1234', 'bkk');
  migrateRpg(p1);
  p1.level = 15;
  const ally = createStarterProfile('combo_ally', '1234', 'dxb');
  migrateRpg(ally);
  ally.level = 15;

  env.profiles.set(p1.id, p1);
  env.profiles.set(ally.id, ally);
  env.instances.set(instId, new Set([p1.id, ally.id]));
  env.presence.set(p1.id, { instanceId: instId, x: 0, z: 0, t: env.getTime() });
  env.presence.set(ally.id, { instanceId: instId, x: 2.0, z: 0, t: env.getTime() });

  const sh = env.service.loadShard('sf_1');

  // --- A. MELEE 1-2-3 Combo (knockback + stagger on Hit 3) ---
  wardrobeEquip(p1, { slot: 'gloves', itemId: 'gloves_starter_sword' });
  const meleeMob = spawnTestMob(sh, 'mob_melee', 'moss_slime', 0, -1.5, { hp: 500 });

  const m1 = env.service.handle(ws, p1, { type: 'sf_attack', targetId: meleeMob.id });
  assert.equal(m1.ok, true);
  assert.equal(m1.weaponClass, 'melee');
  assert.equal(m1.comboStep, 1);
  assert.equal(m1.vfxId, 'combo_melee_1');

  env.advanceTime(m1.cooldownMs + 10);
  const m2 = env.service.handle(ws, p1, { type: 'sf_attack', targetId: meleeMob.id });
  assert.equal(m2.comboStep, 2);
  assert.ok(m2.hits[0][1] > m1.hits[0][1], 'Hit 2 deals more damage than Hit 1');

  env.advanceTime(m2.cooldownMs + 10);
  const zBeforeFinisher = meleeMob.z;
  const m3 = env.service.handle(ws, p1, { type: 'sf_attack', targetId: meleeMob.id });
  assert.equal(m3.comboStep, 3);
  assert.equal(m3.vfxId, 'combo_melee_3');
  assert.ok(m3.hits[0][1] > m2.hits[0][1], 'Hit 3 finisher deals highest combo damage');
  assert.ok(meleeMob.z < zBeforeFinisher - 0.5, 'Melee Hit 3 knocks monster back ~0.95m');
  assert.ok(meleeMob.stunUntil >= env.getTime() + 400, 'Melee Hit 3 staggers monster for 420ms');

  // Next hit wraps 3 -> 1
  env.advanceTime(m3.cooldownMs + 10);
  meleeMob.z = -1.5;
  const mWrap = env.service.handle(ws, p1, { type: 'sf_attack', targetId: meleeMob.id });
  assert.equal(mWrap.comboStep, 1);

  // --- B. RANGED 1-2-3 Combo (7.2m range + Hit-3 Twin Volley 2x hits) ---
  sh.live.monsters.clear();
  wardrobeEquip(p1, { slot: 'gloves', itemId: 'gloves_starter_shortbow' });
  env.advanceTime(2500); // reset combo window
  const rangedMob = spawnTestMob(sh, 'mob_ranged', 'thornback_boar', 0, -6.5, { hp: 500 });

  const r1 = env.service.handle(ws, p1, { type: 'sf_attack', targetId: rangedMob.id });
  assert.equal(r1.weaponClass, 'ranged');
  assert.equal(r1.comboStep, 1);
  assert.equal(r1.hits.length, 1);

  env.advanceTime(r1.cooldownMs + 10);
  const r2 = env.service.handle(ws, p1, { type: 'sf_attack', targetId: rangedMob.id });
  assert.equal(r2.comboStep, 2);

  env.advanceTime(r2.cooldownMs + 10);
  const r3 = env.service.handle(ws, p1, { type: 'sf_attack', targetId: rangedMob.id });
  assert.equal(r3.comboStep, 3);
  assert.equal(r3.vfxId, 'combo_ranged_3');
  const twinHits = r3.hits.filter(([id]) => id === rangedMob.id);
  assert.equal(twinHits.length, 2, 'Ranged Hit 3 Twin Volley strikes target twice');
  const singleBase = classComboDamage({ weaponClass: 'ranged', comboStep: 3, stats: computeUniversalStats(p1).total, crit: false });
  assert.equal(twinHits[0][1], Math.round(singleBase * 0.56));
  assert.equal(twinHits[1][1], Math.round(singleBase * 0.56));

  // --- C. MAGIC + Glamour Swap: +10 melee stats kept while Glamour wand casts Magic Starburst AoE + Co-Op heal! ---
  p1.inventory.gloves_vorax_cyan = { refine: 10, dupes: 0, pity: 0 };
  wardrobeEquip(p1, { slot: 'gloves', itemId: 'gloves_vorax_cyan' });
  const statsBeforeGlam = computeUniversalStats(p1).total;
  wardrobeGlamour(p1, { slot: 'gloves', itemId: 'gloves_starter_wand' });
  const statsAfterGlam = computeUniversalStats(p1).total;
  assert.deepEqual(statsAfterGlam, statsBeforeGlam, '+10 equipped weapon stats remain 100% intact under Glamour');
  assert.equal(activeWeaponClass(p1.equipped, p1.glamour), 'magic');

  // Hurt both caster and nearby ally to verify Hit-3 party heal
  const p1State = sh.live.players.get(p1.id);
  p1State.hp = 60;
  sh.live.players.set(ally.id, {
    hp: 50, maxHp: 180, downUntil: 0, lastAttackAt: 0, attackReadyAt: 0, comboStep: 0,
    ultReadyAt: 0, skillCds: [0, 0], buffs: {}, shield: 0, shieldHp: 0, shieldUntil: 0, lastHitAt: 0, lastRegenAt: 0,
  });

  sh.live.monsters.clear();
  const magPrimary = spawnTestMob(sh, 'mob_mag_1', 'moss_slime', 0, -4.5, { hp: 500 });
  const magSplash = spawnTestMob(sh, 'mob_mag_2', 'moss_slime', 1.6, -4.5, { hp: 500 }); // 1.6m from primary (outside narrow bolt, inside 2.2m splash!)

  env.advanceTime(2500);
  const mg1 = env.service.handle(ws, p1, { type: 'sf_attack', targetId: magPrimary.id });
  assert.equal(mg1.weaponClass, 'magic');
  assert.equal(mg1.comboStep, 1);
  assert.equal(mg1.hits.length, 1, 'Magic Hit 1 hits primary bolt target only');

  env.advanceTime(mg1.cooldownMs + 10);
  const mg2 = env.service.handle(ws, p1, { type: 'sf_attack', targetId: magPrimary.id });
  assert.equal(mg2.comboStep, 2);

  env.advanceTime(mg2.cooldownMs + 10);
  const mg3 = env.service.handle(ws, p1, { type: 'sf_attack', targetId: magPrimary.id });
  assert.equal(mg3.comboStep, 3);
  assert.equal(mg3.vfxId, 'combo_magic_3');
  const hitSet = new Set(mg3.hits.map(([id]) => id));
  assert.ok(hitSet.has(magPrimary.id) && hitSet.has(magSplash.id), 'Magic Hit 3 Starburst splashes monsters within 2.2m');
  assert.ok(p1State.hp > 60, 'Magic Hit 3 heals caster');
  assert.ok(sh.live.players.get(ally.id).hp > 50, 'Magic Hit 3 heals nearby Co-Op ally within 6m');
  assert.equal(mg3.partyHeals.length, 2);

  const lastFx = [...env.broadcasts].reverse().find((b) => b.msg.type === 'sf_fx' && b.msg.kind === 'attack');
  assert.ok(lastFx);
  assert.equal(lastFx.msg.vfxId, 'combo_magic_3');

  env.service.stopAll();
});

// =================================================================================================
// 5. Equipping & Casting All 8 Monster Skills (0 Energy Cost, Cooldowns, Zones, Shields, CC & Boss Hits)
// =================================================================================================
test('5. Equipping (sf_pouch_set) and casting (sf_ultimate) all 8 Monster Skills with 0 Energy cost', () => {
  const env = createCombatEnv({ initialNow: 30_000_000 });
  const instId = 'frontier:sf_skills~meadow';
  const ws = { instanceId: instId };

  const p = createStarterProfile('skill_mage', '1234', 'bkk');
  migrateRpg(p);
  p.level = 20;
  const ally = createStarterProfile('skill_ally', '1234', 'dxb');
  migrateRpg(ally);
  ally.level = 20;

  env.profiles.set(p.id, p);
  env.profiles.set(ally.id, ally);
  env.instances.set(instId, new Set([p.id, ally.id]));
  env.presence.set(p.id, { instanceId: instId, x: 0, z: 0, t: env.getTime() });
  env.presence.set(ally.id, { instanceId: instId, x: 2.0, z: 0, t: env.getTime() });

  const sh = env.service.loadShard('sf_skills');

  // Validation: bad slot & locked skill rejected
  assert.equal(env.service.handle(ws, p, { type: 'sf_pouch_set', skillAction: 'equip', slot: 4, skillId: 'sk_pollen_ring' }).error, 'bad_skill_slot');
  assert.equal(env.service.handle(ws, p, { type: 'sf_pouch_set', skillAction: 'equip', slot: 0, skillId: 'sk_pollen_ring' }).error, 'skill_locked');
  assert.equal(env.service.handle(ws, p, { type: 'sf_ultimate', skillSlot: 0 }).error, 'no_skill_equipped');

  // Unlock all 8 skills at Lv.3 (and sk_crystal_fan / sk_prism_beam at Lv.5)
  for (const skId of MONSTER_SKILL_IDS) {
    p.frontier.skills.unlocked[skId] = (skId === 'sk_crystal_fan' || skId === 'sk_prism_beam') ? 5 : 3;
  }

  // Equip slot 0 & slot 1, and verify duplicate-prevention swap
  assert.equal(env.service.handle(ws, p, { type: 'sf_pouch_set', skillAction: 'equip', slot: 0, skillId: 'sk_pollen_ring' }).ok, true);
  assert.equal(env.service.handle(ws, p, { type: 'sf_pouch_set', skillAction: 'equip', slot: 1, skillId: 'sk_jelly_shield' }).ok, true);
  assert.deepEqual(p.frontier.skills.equipped.slice(0, 2), ['sk_pollen_ring', 'sk_jelly_shield']);
  assert.equal(env.service.handle(ws, p, { type: 'sf_pouch_set', skillAction: 'equip', slot: 0, skillId: 'sk_jelly_shield' }).ok, true);
  assert.deepEqual(p.frontier.skills.equipped.slice(0, 2), ['sk_jelly_shield', 'sk_pollen_ring'], 'Equipping into other slot swaps cleanly without duplicates');

  const energyStart = p.frontier.energy.cur;

  // Suppress random ambient spawns during deterministic skill zone & shield ticks
  let bgCount1 = 0;
  for (const type of ['pollen_wisp', 'moss_slime', 'thornback_boar', 'meadow_zephyr_hare']) {
    const pk = MONSTERS[type]?.packSize || 7;
    for (let k = 0; k < pk; k++) {
      spawnTestMob(sh, `bg_${type}_${k}`, type, -30, 30, { hp: 500 });
      bgCount1 += 1;
    }
  }
  sh.live.regions.set('meadow', { count: bgCount1, ambientAlive: bgCount1, ambientDue: [], dirty: new Set(), lastDeltaAt: 0, outpostDirty: false, lastOutpostAt: 0, skillZones: [] });

  // --- Skill 1: sk_pollen_ring (immediate heal + 4x 1000ms sanctuary pulses) ---
  env.service.handle(ws, p, { type: 'sf_pouch_set', skillAction: 'equip', slot: 0, skillId: 'sk_pollen_ring' });
  const ps = sh.live.players.get(p.id) || (() => { env.service.handle(ws, p, { type: 'sf_state' }); return null; })();
  // Initialize player states via damage or state
  const allyFirstEq = env.service.handle(ws, ally, { type: 'sf_pouch_set', skillAction: 'equip', slot: 0, skillId: null });
  assert.equal(allyFirstEq.ok, true);

  // Trigger combat context to create ps for p & ally
  spawnTestMob(sh, 'dummy_init', 'moss_slime', 20, 20, { hp: 50 });
  env.service.handle(ws, ally, { type: 'sf_attack', targetId: 'dummy_init' });
  env.service.handle(ws, p, { type: 'sf_attack', targetId: 'dummy_init' });
  sh.live.monsters.delete('dummy_init');

  const pPs = sh.live.players.get(p.id);
  const aPs = sh.live.players.get(ally.id);
  pPs.hp = 40; pPs.lastHitAt = env.getTime();
  aPs.hp = 40; aPs.lastHitAt = env.getTime();

  const cPollen = env.service.handle(ws, p, { type: 'sf_ultimate', skillSlot: 0 });
  assert.equal(cPollen.ok, true);
  assert.equal(cPollen.skillId, 'sk_pollen_ring');
  assert.equal(p.frontier.energy.cur, energyStart, 'Monster skills cost 0 Energy');
  const hpAfterPulse1 = pPs.hp;
  assert.ok(hpAfterPulse1 > 40, 'Immediate sanctuary heal pulse applied');
  assert.ok(aPs.hp > 40, 'Nearby ally healed by sanctuary pulse #1');

  // Cooldown enforced immediately
  const cdFail = env.service.handle(ws, p, { type: 'sf_ultimate', skillSlot: 0 });
  assert.equal(cdFail.ok, false);
  assert.equal(cdFail.error, 'skill_cooldown');
  assert.ok(cdFail.remainingMs > 0);

  // Tick 4 remaining seconds (keep lastHitAt fresh so passive regen doesn't confound sanctuary tick check)
  for (let sec = 1; sec <= 4; sec++) {
    env.advanceTime(1000);
    pPs.lastHitAt = env.getTime();
    aPs.lastHitAt = env.getTime();
    const beforeTick = pPs.hp;
    env.service._tick('sf_skills', env.getTime());
    assert.ok(pPs.hp > beforeTick, `Sanctuary tick #${sec + 1} healed player`);
  }

  // --- Skill 2: sk_jelly_shield (Vitality shield absorption + 40% mob slow) ---
  env.advanceTime(20_000);
  env.service.handle(ws, p, { type: 'sf_pouch_set', skillAction: 'equip', slot: 1, skillId: 'sk_jelly_shield' });
  const slowMob = spawnTestMob(sh, 'mob_slow', 'thornback_boar', 0, -2.5, { hp: 300, dmg: 25, speed: 3.0 });
  const cShield = env.service.handle(ws, p, { type: 'sf_ultimate', skillSlot: 1 });
  assert.equal(cShield.ok, true);
  assert.ok(cShield.shieldHp >= 30);
  assert.equal(pPs.shieldHp, cShield.shieldHp);
  assert.equal(aPs.shieldHp, cShield.shieldHp, 'Ally within 4.8m receives Jelly Shield');
  assert.equal(slowMob.slowPct, 0.40);
  assert.ok(slowMob.slowUntil > env.getTime());

  // Move slowMob into melee range and let it hit player -> shield absorbs damage before HP!
  slowMob.x = 0; slowMob.z = -0.8;
  pPs.hp = pPs.maxHp;
  const hpBeforeMobHit = pPs.hp;
  const shieldBeforeHit = pPs.shieldHp;
  env.advanceTime(100);
  env.service._tick('sf_skills', env.getTime());
  assert.equal(pPs.hp, hpBeforeMobHit, 'Jelly Shield absorbed 100% of incoming monster hit');
  assert.equal(pPs.shieldHp, shieldBeforeHit - 25);

  // Overflow hit: set shieldHp to 10 and let 25-dmg monster strike again -> 10 absorbed, 15 overflow to HP
  pPs.shieldHp = 10; pPs.shield = 10;
  slowMob.atkCdUntil = 0;
  env.advanceTime(100);
  env.service._tick('sf_skills', env.getTime());
  assert.equal(pPs.shieldHp, 0);
  assert.equal(pPs.hp, hpBeforeMobHit - 15, 'Only overflow damage past shield reduces player HP');
  sh.live.monsters.clear();

  // --- Skill 3: sk_tusk_rush (5.2m dash + line damage + 850ms stun) ---
  env.advanceTime(20_000);
  env.presence.set(p.id, { instanceId: instId, x: 0, z: 0, t: env.getTime() });
  env.service.handle(ws, p, { type: 'sf_pouch_set', skillAction: 'equip', slot: 0, skillId: 'sk_tusk_rush' });
  const rushMob = spawnTestMob(sh, 'mob_rush', 'thornback_boar', 0, -3.0, { hp: 400 });
  const cRush = env.service.handle(ws, p, { type: 'sf_ultimate', skillSlot: 0, facing: { x: 0, z: -1 } });
  assert.equal(cRush.ok, true);
  assert.ok(Math.abs(cRush.pos.z - (-5.2)) < 0.05, `Expected dash z ~ -5.2, got ${cRush.pos.z}`);
  assert.equal(env.presence.get(p.id).z, cRush.pos.z);
  assert.equal(cRush.hits.length, 1);
  assert.ok(rushMob.hp < 400);
  assert.ok(rushMob.stunUntil >= env.getTime() + 800, 'Tusk Rush stuns hit monster for 850ms');
  sh.live.monsters.clear();

  // --- Skill 4: sk_crystal_fan (5.6m cone, 76° at Lv.5) ---
  env.advanceTime(20_000);
  env.presence.set(p.id, { instanceId: instId, x: 0, z: 0, t: env.getTime() });
  env.service.handle(ws, p, { type: 'sf_pouch_set', skillAction: 'equip', slot: 0, skillId: 'sk_crystal_fan' });
  const coneFront = spawnTestMob(sh, 'mob_cone_in', 'crystal_beetle', 1.2, -4.2, { hp: 400 });
  const coneBehind = spawnTestMob(sh, 'mob_cone_out', 'crystal_beetle', 0, 3.0, { hp: 400 });
  const cFan = env.service.handle(ws, p, { type: 'sf_ultimate', skillSlot: 0, facing: { x: 0, z: -1 } });
  assert.equal(cFan.ok, true);
  assert.equal(cFan.hits.length, 1);
  assert.equal(cFan.hits[0][0], coneFront.id);
  assert.equal(coneBehind.hp, 400, 'Monster behind caster unaffected by cone');
  sh.live.monsters.clear();

  // --- Skill 5: sk_echo_drain (3.8m AoE damage + 25% HP leech) ---
  env.advanceTime(20_000);
  pPs.hp = 50;
  env.service.handle(ws, p, { type: 'sf_pouch_set', skillAction: 'equip', slot: 0, skillId: 'sk_echo_drain' });
  spawnTestMob(sh, 'mob_drain_1', 'lantern_bat', 1.5, 0, { hp: 400 });
  spawnTestMob(sh, 'mob_drain_2', 'lantern_bat', -1.5, 0, { hp: 400 });
  const cDrain = env.service.handle(ws, p, { type: 'sf_ultimate', skillSlot: 0 });
  assert.equal(cDrain.ok, true);
  assert.equal(cDrain.hits.length, 2);
  assert.ok(pPs.hp > 50, 'Echo Drain siphoned HP back to caster');
  assert.ok(cDrain.healAmount >= 4);
  sh.live.monsters.clear();

  // --- Skill 6: sk_gravity_spin (4.6m pull to ~1.1m on mobs, boss unmoved but damaged) ---
  env.advanceTime(20_000);
  env.service.handle(ws, p, { type: 'sf_pouch_set', skillAction: 'equip', slot: 0, skillId: 'sk_gravity_spin' });
  const pullMob = spawnTestMob(sh, 'mob_pull', 'quartz_golemling', 4.0, 0, { hp: 400 });
  const pullBoss = spawnTestMob(sh, 'boss_pull', 'elder_moss_golem', 0, -4.0, { hp: 2000, kind: 'boss' });
  const cGrav = env.service.handle(ws, p, { type: 'sf_ultimate', skillSlot: 0 });
  assert.equal(cGrav.ok, true);
  assert.equal(cGrav.hits.length, 2);
  assert.ok(Math.hypot(pullMob.x, pullMob.z) <= 1.25, `Pulled mob inward to ~1.1m, got ${Math.hypot(pullMob.x, pullMob.z)}`);
  assert.equal(pullBoss.z, -4.0, 'Boss position is not pulled');
  assert.ok(pullBoss.hp < 2000, 'Boss still takes Gravity Spin damage');
  sh.live.monsters.clear();
  sh.live.bosses.clear();

  // --- Skill 7: sk_earthshatter (ground AoE within 5.5m, 1500ms mob stun & 700ms boss stagger) ---
  env.advanceTime(20_000);
  env.service.handle(ws, p, { type: 'sf_pouch_set', skillAction: 'equip', slot: 0, skillId: 'sk_earthshatter' });
  const quakeMob = spawnTestMob(sh, 'mob_quake', 'moss_slime', 3.0, -3.0, { hp: 500 });
  const quakeBoss = spawnTestMob(sh, 'boss_quake', 'elder_moss_golem', 4.0, -3.0, { hp: 2000, kind: 'boss' });
  const cQuake = env.service.handle(ws, p, { type: 'sf_ultimate', skillSlot: 0, targetX: 3.5, targetZ: -3.0 });
  assert.equal(cQuake.ok, true);
  assert.equal(cQuake.hits.length, 2);
  assert.equal(quakeMob.stunUntil, env.getTime() + 1500);
  assert.equal(quakeBoss.stunUntil, env.getTime() + 700);
  sh.live.monsters.clear();
  sh.live.bosses.clear();

  // --- Skill 8: sk_prism_beam (9.5m piercing ray hitting lined-up mobs + boss & granting kill loot) ---
  env.advanceTime(20_000);
  env.service.handle(ws, p, { type: 'sf_pouch_set', skillAction: 'equip', slot: 0, skillId: 'sk_prism_beam' });
  const beamNear = spawnTestMob(sh, 'mob_beam_1', 'moss_slime', 0.3, -3.5, { hp: 10 }); // dies to beam!
  const beamFar = spawnTestMob(sh, 'mob_beam_2', 'crystal_beetle', -0.4, -8.8, { hp: 500 });
  const beamBoss = spawnTestMob(sh, 'boss_beam', 'hollow_crystal_weaver', 0, -7.0, { hp: 2500, kind: 'boss' });
  const killsBefore = p.frontier.stats.kills || 0;
  const cBeam = env.service.handle(ws, p, { type: 'sf_ultimate', skillSlot: 0, facing: { x: 0, z: -1 } });
  assert.equal(cBeam.ok, true);
  assert.equal(cBeam.hits.length, 3, 'Prism Beam pierces all 3 targets along 9.5m line');
  assert.equal(sh.live.monsters.has(beamNear.id), false, 'Low-HP mob killed by Prism Beam');
  assert.equal(p.frontier.stats.kills, killsBefore + 1, 'Skill kill awards standard monster kill & loot');
  assert.ok(beamFar.hp < 500 && beamBoss.hp < 2500);
  assert.equal(p.frontier.energy.cur, energyStart, 'Energy remains completely untouched after all 8 skills');

  const numsCheck = computeSkillNumbers('sk_prism_beam', 5, computeUniversalStats(p).total, pPs.maxHp);
  assert.ok(numsCheck.damage > 50);

  env.service.stopAll();
});

// =================================================================================================
// 6. Monster & Boss Skill Scroll Drops (Auto-Equip, Lv.1->Lv.5, Excess Gold & 12-Kill Boss Pity)
// =================================================================================================
test('6. Monster & Boss Skill Scroll drops: pure RNG + Luck scaling, auto-equip, Lv.1 -> Lv.5 leveling, and excess Gold conversion', () => {
  const env = createCombatEnv({ initialNow: 50_000_000, rng: () => 0.001 }); // rng=0.001 -> guaranteed mob scroll drop (< 0.02)
  const instId = 'frontier:sf_drops~meadow';
  const ws = { instanceId: instId };

  const p = createStarterProfile('scroll_hunter', '1234', 'bkk');
  migrateRpg(p);
  wardrobeEquip(p, { slot: 'gloves', itemId: 'gloves_starter_sword' });
  env.profiles.set(p.id, p);
  env.instances.set(instId, new Set([p.id]));
  env.presence.set(p.id, { instanceId: instId, x: 0, z: 0, t: env.getTime() });

  const sh = env.service.loadShard('sf_drops');

  // Kill 5 pollen_wisp mobs -> sk_pollen_ring levels Lv.1 -> Lv.5, auto-equipping into slot 0 on first drop!
  for (let lv = 1; lv <= 5; lv++) {
    env.advanceTime(1000);
    const wisp = spawnTestMob(sh, `wisp_${lv}`, 'pollen_wisp', 0, -1.2, { hp: 1 });
    const atk = env.service.handle(ws, p, { type: 'sf_attack', targetId: wisp.id });
    assert.equal(atk.ok, true);
    assert.equal(p.frontier.skills.unlocked.sk_pollen_ring, lv);
    if (lv === 1) {
      assert.equal(p.frontier.skills.equipped[0], 'sk_pollen_ring', 'First unlocked scroll auto-equips into empty Slot 0');
    }
  }

  // 6th pollen_wisp scroll drop at Lv.5 MAX converts to +1,200 Gold!
  const goldBeforeMobExcess = p.gold;
  env.advanceTime(1000);
  const wisp6 = spawnTestMob(sh, 'wisp_6', 'pollen_wisp', 0, -1.2, { hp: 1 });
  env.service.handle(ws, p, { type: 'sf_attack', targetId: wisp6.id });
  assert.equal(p.frontier.skills.unlocked.sk_pollen_ring, 5);
  assert.equal(p.gold, goldBeforeMobExcess + SKILL_DROP_RATES.EXCESS_GOLD_MOB);

  const dropFx = [...env.broadcasts].reverse().find((b) => b.msg.type === 'sf_fx' && b.msg.kind === 'skill_scroll_drop');
  assert.ok(dropFx);
  assert.equal(dropFx.msg.maxedGold, 1200);

  // Pure RNG Boss Skill Scroll Drop with a bad-luck FLOOR: kills 1-4 at rng=0.99 stay dry, kill #5 guarantees the first scroll.
  assert.equal(SKILL_DROP_RATES.BOSS_PITY, undefined);
  env.setRng(() => 0.99);
  for (let kill = 1; kill <= 4; kill++) {
    env.service._grantBossRewards({
      bossId: 'elder_moss_golem',
      encounterUid: `golem_enc_${kill}`,
      ledger: { [p.id]: { dmg: 1000, heal: 0, repair: 0, score: 1000 } },
      instanceId: instId,
    });
    assert.equal(p.frontier.skills.bossPity, undefined);
    assert.equal(p.frontier.skills.unlocked.sk_earthshatter, undefined);
  }
  env.service._grantBossRewards({
    bossId: 'elder_moss_golem',
    encounterUid: 'golem_enc_floor',
    ledger: { [p.id]: { dmg: 1000, heal: 0, repair: 0, score: 1000 } },
    instanceId: instId,
  });
  assert.equal(p.frontier.skills.unlocked.sk_earthshatter, 1, '5th boss kill hits the SCROLL_FLOOR_KILLS.boss guarantee');
  const floorFx = [...env.broadcasts].reverse().find((b) => b.msg.type === 'sf_fx' && b.msg.kind === 'skill_scroll_drop' && b.msg.skillId === 'sk_earthshatter');
  assert.equal(floorFx?.msg.floor, true);
  // Reset so the natural-RNG path below is exercised from Lv.0
  delete p.frontier.skills.unlocked.sk_earthshatter;
  p.frontier.skills.equipped = p.frontier.skills.equipped.map((x) => (x === 'sk_earthshatter' ? null : x));

  // Natural RNG hit (rng=0.05 < 0.10 BOSS_BASE * rareFindMult) -> drops sk_earthshatter Lv.1 + auto-equips into empty Slot 1!
  env.setRng(() => 0.05);
  env.service._grantBossRewards({
    bossId: 'elder_moss_golem',
    encounterUid: 'golem_enc_hit',
    ledger: { [p.id]: { dmg: 1000, heal: 0, repair: 0, score: 1000 } },
    instanceId: instId,
  });
  assert.equal(p.frontier.skills.unlocked.sk_earthshatter, 1);
  assert.equal(p.frontier.skills.equipped[1], 'sk_earthshatter', 'Second unlocked scroll auto-equips into Slot 1');

  // Max sk_earthshatter to Lv.5 and verify excess boss scroll awards +3,000 Gold
  p.frontier.skills.unlocked.sk_earthshatter = 5;
  const goldBeforeBossExcess = p.gold;
  env.setRng(() => 0.01); // < 0.10 BOSS_BASE -> drops immediately
  env.service._grantBossRewards({
    bossId: 'elder_moss_golem',
    encounterUid: 'golem_enc_excess',
    ledger: { [p.id]: { dmg: 1000, heal: 0, repair: 0, score: 1000 } },
    instanceId: instId,
  });
  assert.equal(p.gold, goldBeforeBossExcess + SKILL_DROP_RATES.EXCESS_GOLD_BOSS);

  // Sanity check ensureStarterCosmetics export from profile_factory
  assert.equal(typeof ensureStarterCosmetics, 'function');

  env.service.stopAll();
});

// =================================================================================================
// 7. Live Server WebSocket Round-Trip (bc_craft_decor weapon_forge, sf_pouch_set, sf_attack, sf_ultimate)
// =================================================================================================
test('7. Live Server WebSocket round-trip: Workshop Weapon Forge, Monster Skill equip & cast, and Class Combo sf_fx', async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const { WebSocket } = await import('ws');
  const { startServer } = await import('../server/server.js');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'neora-mc-combat-ws-'));
  const dataFile = path.join(tmpDir, 'db.json');
  const srv = await startServer({ port: 0, dataFile, quiet: true });
  const ws = new WebSocket(`ws://127.0.0.1:${srv.port}/ws`);

  const inbox = [];
  const waiters = [];
  ws.on('message', (raw) => {
    const m = JSON.parse(String(raw));
    for (let i = 0; i < waiters.length; i++) {
      if (waiters[i].pred(m)) {
        const w = waiters.splice(i, 1)[0];
        w.resolve(m);
        return;
      }
    }
    inbox.push(m);
  });
  const waitFor = (pred, timeoutMs = 4000) => {
    for (let i = 0; i < inbox.length; i++) {
      if (pred(inbox[i])) return Promise.resolve(inbox.splice(i, 1)[0]);
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('WS timeout: ' + pred.toString())), timeoutMs);
      waiters.push({
        pred,
        resolve: (m) => { clearTimeout(timer); resolve(m); },
      });
    });
  };
  await new Promise((res) => ws.once('open', res));

  try {
    // Register/login brand-new character via /api/auth/login -> receives all 3 starter weapons on Day 1
    const baseUrl = `http://127.0.0.1:${srv.port}`;
    const authRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'ws_crafter', password: '1234', lineage: 'bkk' }),
    }).then((r) => r.json());
    assert.ok(authRes.token);
    assert.ok(authRes.profile.inventory.gloves_starter_sword);
    assert.ok(authRes.profile.inventory.gloves_starter_shortbow);
    assert.ok(authRes.profile.inventory.gloves_starter_wand);

    ws.send(JSON.stringify({ type: 'auth', token: authRes.token }));
    await waitFor((m) => m.type === 'auth_ok');
    await waitFor((m) => m.type === 'instance_snapshot');

    // Seed Workshop + Boss materials on isolated temp DB profile and test bc_craft_decor weapon_forge:roll
    const liveProf = srv.db.getProfile('ws_crafter');
    liveProf.gold = 20_000;
    liveProf.village.copies.workshop = 1;
    liveProf.frontier.warehouse.items = { boss_core_moss: 6, ingot: 12, plank: 12 };
    liveProf.frontier.skills.unlocked.sk_tusk_rush = 2;

    ws.send(JSON.stringify({ type: 'bc_craft_decor', decor: 'weapon_forge:roll:gloves_boss_moss_staff', reqId: 101 }));
    const forgeRes = await waitFor((m) => m.type === 'action_result' && m.reqId === 101);
    assert.equal(forgeRes.ok, true);
    assert.equal(forgeRes.weaponForge.mode, 'created');
    assert.equal(forgeRes.weaponForge.weaponId, 'gloves_boss_moss_staff');
    assert.ok(liveProf.equipped.gloves?.rolledStats, 'Forged boss staff equipped with rolledStats');

    // Enter Sky Frontier, equip sk_tusk_rush via sf_pouch_set, cast via sf_ultimate, and fire sf_attack combo
    ws.send(JSON.stringify({ type: 'instance_switch', to: 'frontier' }));
    await waitFor((m) => m.type === 'instance_snapshot' && m.layout?.kind === 'sky_frontier');

    ws.send(JSON.stringify({ type: 'sf_pouch_set', skillAction: 'equip', slot: 0, skillId: 'sk_tusk_rush', reqId: 102 }));
    const eqRes = await waitFor((m) => m.type === 'action_result' && m.reqId === 102);
    assert.equal(eqRes.ok, true);
    assert.equal(eqRes.skills.equipped[0], 'sk_tusk_rush');

    ws.send(JSON.stringify({ type: 'sf_ultimate', skillSlot: 0, facing: { x: 0, z: -1 }, reqId: 103 }));
    const castRes = await waitFor((m) => m.type === 'action_result' && m.reqId === 103);
    assert.equal(castRes.ok, true);
    assert.equal(castRes.skillId, 'sk_tusk_rush');
    const skillFx = await waitFor((m) => m.type === 'sf_fx' && m.kind === 'monster_skill' && m.skillId === 'sk_tusk_rush');
    assert.ok(skillFx);

    ws.send(JSON.stringify({ type: 'sf_attack', facing: { x: 0, z: -1 }, reqId: 104 }));
    const atkRes = await waitFor((m) => m.type === 'action_result' && m.reqId === 104);
    assert.equal(atkRes.ok, true);
    assert.equal(atkRes.weaponClass, 'magic');
    assert.equal(atkRes.comboStep, 1);
    const atkFx = await waitFor((m) => m.type === 'sf_fx' && m.kind === 'attack' && m.vfxId === 'combo_magic_1');
    assert.ok(atkFx);
  } finally {
    if (ws.readyState === WebSocket.OPEN) ws.close();
    await srv.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// =================================================================================================
// 8. Monster Codex Drop Tables (20 Monsters/Bosses, 🍀 Luck & 💖 Vitality Scaling) + Defeat Tracking
// =================================================================================================
test('8. Monster Codex builds all 20 monsters/bosses with live Luck/Vitality drop rates and tracks killsByMob', () => {
  assert.equal(MONSTER_CODEX_IDS.length, 20);
  for (const id of MONSTER_CODEX_IDS) {
    assert.ok(MONSTER_CODEX_META[id]?.sprite.startsWith('/assets/village/sf_'));
    assert.ok(Number.isFinite(MONSTER_CODEX_META[id]?.coords?.x));
    assert.ok(Number.isFinite(MONSTER_CODEX_META[id]?.coords?.z));
  }

  // Base codex (0 Luck, 0 Vitality) — pure RNG drop table with zero pity fields
  const baseCodex = buildMonsterCodex({
    stats: { power: 0, swiftness: 0, fortune: 0, luck: 0 },
    skills: { unlocked: { sk_pollen_ring: 3 }, equipped: ['sk_pollen_ring', null] },
    killsByMob: { pollen_wisp: 14, elder_moss_golem: 4 },
  });
  assert.equal(baseCodex.length, 20);

  const wispBase = baseCodex.find((e) => e.id === 'pollen_wisp');
  assert.equal(wispBase.kills, 14);
  assert.equal(wispBase.scrollDrop.skillId, 'sk_pollen_ring');
  assert.equal(wispBase.scrollDrop.level, 3);
  assert.equal(wispBase.scrollDrop.baseChancePct, 2);
  assert.equal(wispBase.scrollDrop.liveChancePct, 2);
  assert.equal(wispBase.scrollDrop.pityCur, undefined);
  assert.equal(wispBase.scrollDrop.pityMax, undefined);
  assert.equal(wispBase.materialDrops[0].itemId, 'herb_seed');
  assert.equal(wispBase.materialDrops[0].liveChancePct, 100);

  const golemBase = baseCodex.find((e) => e.id === 'elder_moss_golem');
  assert.equal(golemBase.isBoss, true);
  assert.equal(golemBase.kills, 4);
  assert.equal(golemBase.scrollDrop.baseChancePct, 10);
  assert.equal(golemBase.scrollDrop.pityCur, undefined);
  assert.equal(golemBase.scrollDrop.pityMax, undefined);
  assert.equal(golemBase.materialDrops[0].itemId, 'boss_core_moss');
  assert.equal(golemBase.charmDrops.length, 1);
  assert.equal(golemBase.charmDrops[0].baseChancePct, 18);
  assert.equal(golemBase.charmDrops[0].liveChancePct, 18);
  assert.equal(golemBase.charmDrops[0].pityCur, undefined);
  assert.equal(golemBase.charmDrops[0].pityMax, undefined);

  // Boosted codex (high Luck & Vitality)
  const boostedCodex = buildMonsterCodex({
    stats: { power: 100, swiftness: 100, fortune: 200, luck: 200 },
    skills: { unlocked: {}, equipped: [null, null] },
  });
  const wispBoosted = boostedCodex.find((e) => e.id === 'pollen_wisp');
  const golemBoosted = boostedCodex.find((e) => e.id === 'elder_moss_golem');
  assert.ok(wispBoosted.scrollDrop.liveChancePct > wispBase.scrollDrop.liveChancePct, 'Luck increases live Skill Scroll drop %');
  assert.ok(golemBoosted.charmDrops[0].liveChancePct > golemBase.charmDrops[0].liveChancePct, 'Luck increases live Boss Charm drop %');
  assert.ok(wispBoosted.yieldMult > 1.2, 'Vitality increases loot yield multiplier');

  // Verify server increments frontier.stats.killsByMob on field mob & boss kills
  const env = createCombatEnv({ initialNow: 50_000_000, rng: () => 0.5 });
  const instId = 'frontier:sf_codex~meadow';
  const ws = { instanceId: instId };
  const hero = createStarterProfile('codex_hunter', '1234', 'bkk');
  migrateRpg(hero);
  hero.level = 30;
  wardrobeEquip(hero, { slot: 'gloves', itemId: 'gloves_starter_sword' });
  env.profiles.set(hero.id, hero);
  env.instances.set(instId, new Set([hero.id]));
  env.presence.set(hero.id, { instanceId: instId, x: -20, z: -18, t: env.getTime() });

  const sh = env.service.loadShard('sf_codex');
  const slime = spawnTestMob(sh, 'mob_slime_1', 'moss_slime', -20, -19, { hp: 1 });
  const atk = env.service.handle(ws, hero, { type: 'sf_attack', targetId: slime.id });
  assert.equal(atk.ok, true);
  assert.equal(hero.frontier.stats.killsByMob?.moss_slime, 1, 'Field mob kill increments killsByMob.moss_slime');

  // Summon & defeat Elder Moss Golem
  const startBoss = env.service.handle(ws, hero, { type: 'sf_boss_start', bossId: 'elder_moss_golem' });
  assert.equal(startBoss.ok, true);
  const bossEntId = sh.live.bosses.get('meadow');
  const boss = sh.live.monsters.get(bossEntId);
  boss.ledger[hero.id] = { dmg: 1500, heal: 0, repair: 0, score: 1500 };
  boss.hp = 1;
  env.advanceTime(1000);
  const killBoss = env.service.handle(ws, hero, { type: 'sf_attack', targetId: boss.id });
  assert.equal(killBoss.ok, true);
  assert.equal(hero.frontier.stats.killsByMob?.elder_moss_golem, 1, 'Boss kill increments killsByMob.elder_moss_golem');

  env.service.stopAll();
});

// =================================================================================================
// 9. All 20 Monster Skill Descriptions & Pure 3D Effekseer Skill Alignment (No Legacy Lv.5 VFX Gating)
// =================================================================================================
test('9. All 20 Monster Skills have upgraded 3D descriptions, biome-matched SKILL_VFX_DEFS, and zero lv5Only VFX gating', async () => {
  const { SKILL_VFX_DEFS, resolveSkillVfxRecipe } = await import('../shared/skill_vfx_defs.js');

  assert.equal(MONSTER_SKILL_IDS.length, 20);
  for (const skillId of MONSTER_SKILL_IDS) {
    const sk = MONSTER_SKILLS[skillId];
    const rec = SKILL_VFX_DEFS[skillId];
    assert.ok(sk, `Missing MONSTER_SKILLS entry for ${skillId}`);
    assert.ok(rec, `Missing SKILL_VFX_DEFS recipe for ${skillId}`);
    assert.ok(typeof rec.label === 'string' && rec.label.length >= 6, `${skillId} VFX label '${rec.label}' must be non-empty`);
    assert.equal(rec.biomeHint, sk.region, `${skillId} biomeHint must match skill region ${sk.region}`);
    assert.equal(rec.category, sk.isBossSkill ? 'boss_skill' : 'monster_skill', `${skillId} category must match boss vs monster skill`);
    assert.ok(typeof sk.desc === 'string' && sk.desc.length >= 40, `${skillId} must have a descriptive RPG tooltip`);

    for (const layer of rec.effekseer.layers) {
      assert.equal(layer.lv5Only, undefined, `${skillId} must fire full 3D Effekseer layers at Lv.1 without lv5Only gating`);
      assert.equal(layer.lv5ScaleMult, undefined, `${skillId} must not gate scale behind lv5ScaleMult`);
    }
    assert.equal(resolveSkillVfxRecipe(skillId), rec);
  }
});

// =================================================================================================
// 10. Pre-Built EffekseerForWebGL 1.80.7 Runtime + 281 CC0 .efkefc Catalog & 31 Exclusive Recipes
// =================================================================================================
test('10. EffekseerForWebGL 1.80.7 runtime, 281 CC0 .efkefc catalog, and all 31 exclusive Effekseer specs (30 SKILL_VFX_DEFS + ALPHA_ELITE_AURA_SPEC) exist on disk', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const {
    PREBUILT_EFFEKSEER_SPECS,
    SKILL_VFX_DEFS,
    ALPHA_ELITE_AURA_SPEC,
    resolveSkillVfxRecipe,
  } = await import('../shared/skill_vfx_defs.js');

  const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const clientDir = path.join(rootDir, 'client');

  assert.ok(fs.existsSync(path.join(clientDir, 'vendor/effekseer/effekseer.min.js')), 'effekseer.min.js missing');
  assert.ok(fs.existsSync(path.join(clientDir, 'vendor/effekseer/effekseer.wasm')), 'effekseer.wasm missing');

  const catalogPath = path.join(clientDir, 'assets/effekseer/catalog.json');
  assert.ok(fs.existsSync(catalogPath), 'effekseer catalog.json missing');
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  assert.equal(catalog.count, 281);
  assert.equal(catalog.effects.length, 281);

  assert.equal(Object.keys(SKILL_VFX_DEFS).length, 30, 'Must define all 20 Monster Skills + 1 Ultimate + 9 Class Combos');
  assert.ok(ALPHA_ELITE_AURA_SPEC?.effekseer && Array.isArray(ALPHA_ELITE_AURA_SPEC.effekseer.layers), 'ALPHA_ELITE_AURA_SPEC must be defined');
  assert.ok(ALPHA_ELITE_AURA_SPEC.effekseer.layers.length >= 1 && ALPHA_ELITE_AURA_SPEC.effekseer.layers.length <= 3, 'ALPHA_ELITE_AURA_SPEC must have 1..3 layers');
  assert.equal(resolveSkillVfxRecipe('alpha_elite_aura'), ALPHA_ELITE_AURA_SPEC);

  const ownerByUrl = new Map();
  for (const [id, rec] of Object.entries(SKILL_VFX_DEFS)) {
    assert.ok(PREBUILT_EFFEKSEER_SPECS[id], `Missing PREBUILT_EFFEKSEER_SPECS for ${id}`);
    assert.ok(rec.effekseer && Array.isArray(rec.effekseer.layers) && rec.effekseer.layers.length >= 1, `${id} missing effekseer.layers`);
    assert.ok(rec.effekseer.layers.length <= 4, `${id} exceeds max layer budget`);
    assert.ok(rec.effekseer.peakMs > 0, `${id} missing effekseer.peakMs`);

    for (const layer of rec.effekseer.layers) {
      assert.ok(layer.url.startsWith('/assets/effekseer/'), `${id} invalid effekseer url: ${layer.url}`);
      const fullPath = path.join(clientDir, layer.url);
      assert.ok(fs.existsSync(fullPath), `${id} missing .efkefc file on disk: ${fullPath}`);
      const existingOwner = ownerByUrl.get(layer.url);
      assert.ok(
        !existingOwner || existingOwner === id,
        `Effekseer effect '${layer.url}' is shared between ${existingOwner} and ${id} — every skill/combo must own exclusive pre-built FX!`
      );
      ownerByUrl.set(layer.url, id);
    }

    assert.equal(resolveSkillVfxRecipe(id), rec);
  }

  for (const layer of ALPHA_ELITE_AURA_SPEC.effekseer.layers) {
    assert.ok(layer.url.startsWith('/assets/effekseer/'), `alpha_elite_aura invalid effekseer url: ${layer.url}`);
    const fullPath = path.join(clientDir, layer.url);
    assert.ok(fs.existsSync(fullPath), `alpha_elite_aura missing .efkefc file on disk: ${fullPath}`);
    const existingOwner = ownerByUrl.get(layer.url);
    assert.ok(
      !existingOwner || existingOwner === 'alpha_elite_aura',
      `Effekseer effect '${layer.url}' is shared between ${existingOwner} and alpha_elite_aura — Alpha Elite aura must own exclusive FX!`
    );
    ownerByUrl.set(layer.url, 'alpha_elite_aura');
  }
});

// =================================================================================================
// 11. Living Habitat Clusters, Passive Grazer vs Pack Predator AI, Pack Assist & 13m Habitat Leash
// =================================================================================================
test('11. Living Habitat Clusters across all 4 regions, Passive Grazer vs Pack Predator AI, 6.5m Pack Assist & 13m Habitat Leash', () => {
  const env = createCombatEnv({ initialNow: 60_000_000, rng: makeSeededRng(777) });
  const sh = env.service.loadShard('sf_eco');

  // Verify NODE_PLAN layouts across all 4 regions + named habitat cluster spawns (16 mobs = 4 per species)
  for (const regionId of ['meadow', 'hollow', 'reef', 'caldera']) {
    const instId = `frontier:sf_eco~${regionId}`;
    const layout = env.service.layoutPayload(instId);
    assert.ok(layout.nodes.length >= 20, `${regionId} must generate >= 20 resource nodes, got ${layout.nodes.length}`);

    const watcher = createStarterProfile(`watch_${regionId}`, '1234', 'bkk');
    env.profiles.set(watcher.id, watcher);
    env.instances.set(instId, new Set([watcher.id]));
    const reg = REGIONS[regionId];
    env.presence.set(watcher.id, { instanceId: instId, x: reg.spawn.x, z: reg.spawn.z, t: env.getTime() });

    env.service._tick('sf_eco', env.getTime());

    const regMobs = [...sh.live.monsters.values()].filter((m) => m.regionId === regionId && m.kind === 'ambient');
    assert.equal(regMobs.length, 28, `${regionId} must spawn 28 ambient monsters (4 packs of 7)`);

    const bySpecies = {};
    for (const m of regMobs) {
      bySpecies[m.type] = (bySpecies[m.type] || 0) + 1;
      const habPoi = reg.pois[MONSTERS[m.type].habitatPoi];
      assert.ok(habPoi, `${m.type} habitatPoi ${MONSTERS[m.type].habitatPoi} must exist in ${regionId}`);
      const dHab = Math.hypot(m.homeX - habPoi.x, m.homeZ - habPoi.z);
      assert.ok(dHab <= 6.5, `${m.type} home (${m.homeX}, ${m.homeZ}) must cluster near ${MONSTERS[m.type].habitatPoi}, dist=${dHab}`);
      assert.ok(Math.hypot(m.homeX - reg.spawn.x, m.homeZ - reg.spawn.z) > 5.0, `${m.type} must stay clear of spawn`);
      assert.ok(Math.hypot(m.homeX - reg.pois.outpost.x, m.homeZ - reg.pois.outpost.z) > 5.0, `${m.type} must stay clear of outpost`);
    }
    for (let i = 0; i < regMobs.length; i++) {
      for (let j = i + 1; j < regMobs.length; j++) {
        const sep = Math.hypot(regMobs[i].homeX - regMobs[j].homeX, regMobs[i].homeZ - regMobs[j].homeZ);
        assert.ok(sep >= 0.85, `${regionId} mobs ${regMobs[i].type} & ${regMobs[j].type} must not stack at identical home pos (sep=${sep})`);
      }
    }
    assert.equal(Object.keys(bySpecies).length, 4, `${regionId} must populate all 4 species`);
    for (const [sp, cnt] of Object.entries(bySpecies)) {
      assert.equal(cnt, 7, `${sp} must have packSize 7`);
    }
  }

  // Verify fast 6.5s ambient respawn cadence when hunting thornback_boar
  const meadowBoarsBefore = [...sh.live.monsters.values()].filter((m) => m.regionId === 'meadow' && m.type === 'thornback_boar');
  assert.equal(meadowBoarsBefore.length, 7);
  meadowBoarsBefore[0].hp = 0;
  env.service._tick('sf_eco', env.getTime());
  assert.equal(
    [...sh.live.monsters.values()].filter((m) => m.regionId === 'meadow' && m.type === 'thornback_boar').length,
    6,
    'Slain thornback_boar enters respawn queue'
  );
  env.advanceTime(6600);
  env.service._tick('sf_eco', env.getTime());
  assert.equal(
    [...sh.live.monsters.values()].filter((m) => m.regionId === 'meadow' && m.type === 'thornback_boar').length,
    7,
    'Slain thornback_boar respawns cleanly after 6.5s'
  );

  // Test Passive Grazer vs Pack Predator AI + Pack Assist + 13m Leash on isolated shard
  const shAi = env.service.loadShard('sf_ai');
  const instAi = 'frontier:sf_ai~meadow';
  const wsAi = { instanceId: instAi };
  const hero = createStarterProfile('eco_ranger', '1234', 'bkk');
  migrateRpg(hero);
  wardrobeEquip(hero, { slot: 'gloves', itemId: 'gloves_starter_sword' });
  env.profiles.set(hero.id, hero);
  env.instances.set(instAi, new Set([hero.id]));
  env.presence.set(hero.id, { instanceId: instAi, x: 0, z: 0, t: env.getTime() });

  // Fill background ambient cap far away so _tick doesn't spawn extra mobs near (0, 0)
  for (const type of ['pollen_wisp', 'moss_slime', 'thornback_boar', 'meadow_zephyr_hare']) {
    const pk = MONSTERS[type]?.packSize || 7;
    for (let k = 0; k < pk; k++) {
      spawnTestMob(shAi, `cap_${type}_${k}`, type, -30, 30, { hp: 500 });
    }
  }

  // 1) Passive Grazer (meadow_zephyr_hare) ignores unprovoked player 1.0m away, then retaliates when hit!
  const hare = env.service._spawnMonster(shAi, 'meadow', 'meadow_zephyr_hare', 'ambient', 0, -1.0, { forceElite: false });
  // Ensure playerState exists
  env.service.handle(wsAi, hero, { type: 'sf_state' });
  const initDummy = spawnTestMob(shAi, 'init_ps', 'moss_slime', 25, 25, { hp: 50 });
  env.service.handle(wsAi, hero, { type: 'sf_attack', targetId: initDummy.id });
  shAi.live.monsters.delete('init_ps');
  const ps = shAi.live.players.get(hero.id);
  ps.hp = ps.maxHp;

  env.advanceTime(2500);
  env.service._tick('sf_ai', env.getTime());
  assert.equal(hare.targetId, null, 'Unprovoked passive Zephyr Hare ignores nearby player');
  assert.equal(ps.hp, ps.maxHp, 'Passive Zephyr Hare deals 0 unprovoked damage');

  // Attack hare -> provokedUntil set on passive mob (without provoking passive neighbors)
  const hareMate = env.service._spawnMonster(shAi, 'meadow', 'meadow_zephyr_hare', 'ambient', 3.5, -1.0, { forceElite: false });
  const atkHare = env.service.handle(wsAi, hero, { type: 'sf_attack', targetId: hare.id });
  assert.equal(atkHare.ok, true);
  assert.ok(hare.provokedUntil > env.getTime(), 'Damaged passive mob becomes provoked');
  assert.equal(hareMate.provokedUntil, 0, 'Passive grazer neighbors stay calm until hit');

  env.advanceTime(200);
  hare.stunUntil = 0;
  env.service._tick('sf_ai', env.getTime());
  assert.equal(hare.targetId, hero.id, 'Provoked passive mob targets attacker');
  assert.ok(ps.hp < ps.maxHp, 'Provoked passive mob counterattacks player');

  // 2) 13.0m Habitat Leash resets provocation and walks mob back toward home
  hare.x = 0; hare.z = -15.0; // 14.0m from home (0, -1.0) > 13.0m leash!
  env.presence.set(hero.id, { instanceId: instAi, x: 0, z: -15.5, t: env.getTime() });
  env.advanceTime(200);
  env.service._tick('sf_ai', env.getTime());
  assert.equal(hare.provokedUntil, 0, 'Exceeding 13m habitat leash clears provocation');
  assert.equal(hare.targetId, null, 'Leashed-out mob drops targetId and walks home');
  assert.ok(hare.z > -15.0, 'Leashed-out mob steps back toward homeZ (-1.0)');

  // 3) Pack Predator (thornback_boar) aggros unprovoked player on sight AND triggers 6.5m Pack Assist when hit!
  env.presence.set(hero.id, { instanceId: instAi, x: 10, z: 10, t: env.getTime() });
  const boar = env.service._spawnMonster(shAi, 'meadow', 'thornback_boar', 'ambient', 10, 8.5, { forceElite: false });
  const boarMate = env.service._spawnMonster(shAi, 'meadow', 'thornback_boar', 'ambient', 14.5, 8.5, { forceElite: false });
  env.advanceTime(2500);
  env.service._tick('sf_ai', env.getTime());
  assert.equal(boar.targetId, hero.id, 'Pack predator aggros unprovoked player on sight');
  const atkBoar = env.service.handle(wsAi, hero, { type: 'sf_attack', targetId: boar.id });
  assert.equal(atkBoar.ok, true);
  assert.ok(boarMate.provokedUntil > env.getTime(), 'Nearby packmate within 6.5m is provoked via Pack Assist');

  env.service.stopAll();
});

// =================================================================================================
// 12. Star-Crowned Alpha Elites (4x HP, 1.45x DMG, 7-Tuple Wire, Telegraphed Skill, Stun Cancel & 3x/4x Drops)
// =================================================================================================
test('12. Star-Crowned Alpha Elites: 4x HP / 1.45x DMG, compactMonster[6]=1, 1.1s telegraphed AoE skill, stun interrupt, 3x mats + 150g + 4x scroll rate', () => {
  const env = createCombatEnv({ initialNow: 70_000_000, rng: () => 0.5 });
  const instId = 'frontier:sf_alpha~reef';
  const ws = { instanceId: instId };

  const pHit = createStarterProfile('alpha_tank', '1234', 'bkk');
  migrateRpg(pHit);
  pHit.level = 25;
  wardrobeEquip(pHit, { slot: 'gloves', itemId: 'gloves_starter_sword' });

  const pDodge = createStarterProfile('alpha_dodger', '1234', 'dxb');
  migrateRpg(pDodge);
  pDodge.level = 25;
  wardrobeEquip(pDodge, { slot: 'gloves', itemId: 'gloves_starter_shortbow' });

  env.profiles.set(pHit.id, pHit);
  env.profiles.set(pDodge.id, pDodge);
  env.instances.set(instId, new Set([pHit.id, pDodge.id]));
  env.presence.set(pHit.id, { instanceId: instId, x: 0, z: 0, t: env.getTime() });
  env.presence.set(pDodge.id, { instanceId: instId, x: 5.0, z: 0, t: env.getTime() }); // outside 3.4m telegraph radius

  const sh = env.service.loadShard('sf_alpha');
  for (const type of ['reef_sakura_kitsune', 'reef_pearl_snapper', 'reef_cloud_crane', 'reef_bell_spirit']) {
    for (let k = 0; k < 4; k++) {
      spawnTestMob(sh, `bg_reef_${type}_${k}`, type, -30, 30, { hp: 500, regionId: 'reef' });
    }
  }

  // Spawn normal vs Alpha Elite reef_cloud_crane (note: crane is passive normally, but Alpha Elite overrides passive!)
  const normalCrane = env.service._spawnMonster(sh, 'reef', 'reef_cloud_crane', 'ambient', -15, -15, { forceElite: false });
  const alphaCrane = env.service._spawnMonster(sh, 'reef', 'reef_cloud_crane', 'ambient', 0, -2.5, { forceElite: true });

  assert.equal(normalCrane.isElite, false);
  assert.equal(alphaCrane.isElite, true);
  assert.equal(alphaCrane.maxHp, Math.round(MONSTERS.reef_cloud_crane.hp * ALPHA_ELITE.HP_MULT));
  assert.equal(alphaCrane.dmg, Math.round(MONSTERS.reef_cloud_crane.dmg * ALPHA_ELITE.DMG_MULT));

  const spawnFx = env.broadcasts.find((b) => b.msg.type === 'sf_fx' && b.msg.kind === 'alpha_spawn' && b.msg.id === alphaCrane.id);
  assert.ok(spawnFx, 'Alpha Elite spawn broadcasts sf_fx alpha_spawn');

  const snap = env.service.layoutPayload(instId);
  const normTuple = snap.monsters.find((t) => t[0] === normalCrane.id);
  const eliteTuple = snap.monsters.find((t) => t[0] === alphaCrane.id);
  assert.equal(normTuple.length, 9, 'Wire tuple: [id,type,x,z,hp,maxHp,isElite,tagMask,poise]');
  assert.equal(normTuple[6], 0, 'Normal monster wire tuple has isElite=0');
  assert.equal(eliteTuple[6], 1, 'Alpha Elite monster wire tuple has isElite=1');

  // Verify MAX_PER_REGION cap (2) when RNG=0.01 tries to roll a 3rd natural Alpha Elite
  const alpha2 = env.service._spawnMonster(sh, 'reef', 'reef_sakura_kitsune', 'ambient', -10, -10, { forceElite: true });
  assert.equal(alpha2.isElite, true);
  env.setRng(() => 0.01); // < 0.08 SPAWN_CHANCE, but 2 elites already alive in reef!
  const cappedMob = env.service._spawnMonster(sh, 'reef', 'reef_pearl_snapper', 'ambient', -12, -12);
  assert.equal(cappedMob.isElite, false, 'Natural Alpha Elite spawn capped at ALPHA_ELITE.MAX_PER_REGION (2)');
  sh.live.monsters.delete(alpha2.id);
  sh.live.monsters.delete(cappedMob.id);
  env.setRng(() => 0.5);

  // Initialize player states
  env.service.handle(ws, pHit, { type: 'sf_attack', targetId: normalCrane.id });
  env.service.handle(ws, pDodge, { type: 'sf_attack', targetId: normalCrane.id });
  const psHit = sh.live.players.get(pHit.id);
  const psDodge = sh.live.players.get(pDodge.id);
  psHit.hp = psHit.maxHp;
  psDodge.hp = psDodge.maxHp;

  // Ready Alpha Elite signature skill -> tick triggers 1100ms alpha_telegraph!
  alphaCrane.skillCdUntil = env.getTime();
  env.advanceTime(100);
  env.service._tick('sf_alpha', env.getTime());
  assert.ok(alphaCrane.telegraph, 'Alpha Elite begins telegraphing signature skill');
  assert.equal(alphaCrane.telegraph.skillId, 'sk_tailwind_gale');
  const teleFx = [...env.broadcasts].reverse().find((b) => b.msg.type === 'sf_fx' && b.msg.kind === 'alpha_telegraph');
  assert.ok(teleFx);
  assert.equal(teleFx.msg.durationMs, ALPHA_ELITE.TELEGRAPH_MS);
  assert.equal(psHit.hp, psHit.maxHp, 'Telegraph windup deals 0 damage before 1100ms');

  // Advance past 1100ms -> alpha_skill_cast detonates, hitting pHit inside 3.4m and missing pDodge at 5.0m!
  env.advanceTime(ALPHA_ELITE.TELEGRAPH_MS + 50);
  env.service._tick('sf_alpha', env.getTime());
  assert.equal(alphaCrane.telegraph, null);
  assert.ok(psHit.hp < psHit.maxHp, 'Player standing in 3.4m danger zone takes 1.65x Alpha Skill damage');
  assert.equal(psDodge.hp, psDodge.maxHp, 'Player outside 3.4m danger zone dodges Alpha Skill cleanly');
  const castFx = [...env.broadcasts].reverse().find((b) => b.msg.type === 'sf_fx' && b.msg.kind === 'alpha_skill_cast');
  assert.ok(castFx);
  assert.equal(castFx.msg.vfxId, 'sk_tailwind_gale');

  // Stun interrupt: start another telegraph and stun Alpha Elite -> telegraph cancelled!
  alphaCrane.skillCdUntil = env.getTime();
  env.advanceTime(100);
  env.service._tick('sf_alpha', env.getTime());
  assert.ok(alphaCrane.telegraph);
  alphaCrane.stunUntil = env.getTime() + 1500;
  env.advanceTime(100);
  env.service._tick('sf_alpha', env.getTime());
  assert.equal(alphaCrane.telegraph, null, 'Stunning Alpha Elite interrupts active telegraph');

  // Defeat Alpha Elite -> 3x material drops, +150 Gold bonus, stats.elites incremented, and 4x scroll drop rate check
  alphaCrane.stunUntil = 0;
  alphaCrane.x = 0;
  alphaCrane.z = -1.2;
  alphaCrane.hits = {};
  alphaCrane.hp = 1;
  pHit.frontier.warehouse.items = {};
  const goldBeforeKill = pHit.gold;
  env.advanceTime(2500);
  const killRes = env.service.handle(ws, pHit, { type: 'sf_attack', targetId: alphaCrane.id });
  assert.equal(killRes.ok, true);
  assert.equal(killRes.hits.length, 1);
  assert.equal(pHit.gold, goldBeforeKill + ALPHA_ELITE.GOLD_BONUS, 'Alpha Elite kill awards +150 Gold bonus');
  assert.equal(pHit.frontier.stats.elites, 1, 'Alpha Elite kill increments frontier.stats.elites');
  assert.ok((pHit.frontier.warehouse.items.feather || 0) >= 6, 'Alpha Elite awards 3x feather drop multiplier');
  assert.ok((pHit.frontier.warehouse.items.cloud_lotus || 0) >= 3, 'Alpha Elite awards 3x cloud_lotus drop multiplier');
  const deadMsg = [...env.broadcasts].reverse().find((b) => b.msg.type === 'sf_monster_dead' && b.msg.id === alphaCrane.id);
  assert.equal(deadMsg?.msg.isElite, true);

  // Verify 4x scroll drop rate math (rng=0.05 fails normal 2%, succeeds Alpha Elite 8%!)
  assert.equal(rollMonsterSkillDrop({ sourceId: 'reef_cloud_crane', isElite: false, rareFindMult: 1, rng: () => 0.05 }).dropped, false);
  assert.equal(rollMonsterSkillDrop({ sourceId: 'reef_cloud_crane', isElite: true, rareFindMult: 1, rng: () => 0.05 }).dropped, true);

  env.service.stopAll();
});

// =================================================================================================
// 13. 4-Region Gates (Ch.5 Reef & Ch.6 Caldera + Couple Guest), Reef/Caldera Bosses & All 12 Boss Weapons
// =================================================================================================
test('13. 4-Region Gates (Ch.5 Reef, Ch.6 Caldera & Couple guest sharing), Kitsune & Bahamut boss kills, and all 12 Boss Weapons forgeable', () => {
  const env = createCombatEnv({ initialNow: 80_000_000, rng: () => 0.25 });

  const host = createStarterProfile('gate_host', '1234', 'bkk');
  migrateRpg(host);
  host.level = 30;
  wardrobeEquip(host, { slot: 'gloves', itemId: 'gloves_starter_sword' });

  const partner = createStarterProfile('gate_guest', '1234', 'dxb');
  migrateRpg(partner);
  host.partner_id = partner.id;
  partner.partner_id = host.id;

  env.profiles.set(host.id, host);
  env.profiles.set(partner.id, partner);

  // Put both in Hollow near gate_reef (24, 18)
  const instHollow = 'frontier:sf_gates~hollow';
  env.instances.set(instHollow, new Set([host.id, partner.id]));
  env.presence.set(host.id, { instanceId: instHollow, x: 24, z: 18, t: env.getTime() });
  env.presence.set(partner.id, { instanceId: instHollow, x: 24, z: 18, t: env.getTime() });

  // Locked before Chapter 5
  assert.equal(env.service.regionTransfer({ instanceId: instHollow }, host, 'reef').error, 'gate_locked');

  // Advance host to Chapter 5 -> walking/transferring at gate_reef completes c5_visit_gate_reef & opens Reef!
  host.story.chapter = 5;
  host.story.completed = [0, 1, 2, 3, 4];
  const trReef = env.service.regionTransfer({ instanceId: instHollow }, host, 'reef');
  assert.equal(trReef.ok, true);
  assert.equal(trReef.targetId, 'frontier:sf_gates~reef');
  assert.equal(host.story.progress.c5_visit_gate_reef, 1);
  assert.ok(host.frontier.unlocks.regions.includes('reef'));

  // Couple partner (still Chapter 0!) traverses hollow -> reef as guest!
  const trPartnerReef = env.service.regionTransfer({ instanceId: instHollow }, partner, 'reef');
  assert.equal(trPartnerReef.ok, true);
  assert.equal(trPartnerReef.guest, true);

  // Move both into Reef near gate_caldera (14, -30) -> locked before Chapter 6 completion
  const instReef = 'frontier:sf_gates~reef';
  env.instances.set(instHollow, new Set());
  env.instances.set(instReef, new Set([host.id, partner.id]));
  env.presence.set(host.id, { instanceId: instReef, x: 14, z: -30, t: env.getTime() });
  env.presence.set(partner.id, { instanceId: instReef, x: 14, z: -30, t: env.getTime() });
  assert.equal(env.service.regionTransfer({ instanceId: instReef }, host, 'caldera').error, 'gate_locked');

  // Summon & defeat Lady Tamamo (sakura_nine_tail_kitsune) at Reef boss POI (0, -26) during Chapter 6
  host.story.chapter = 6;
  host.story.completed = [0, 1, 2, 3, 4, 5];
  env.presence.set(host.id, { instanceId: instReef, x: 0, z: -26, t: env.getTime() });
  const sh = env.service.loadShard('sf_gates');
  const startKitsune = env.service.handle({ instanceId: instReef }, host, { type: 'sf_boss_start', bossId: 'sakura_nine_tail_kitsune' });
  assert.equal(startKitsune.ok, true);
  const kitsuneEnt = sh.live.monsters.get(sh.live.bosses.get('reef'));
  assert.equal(kitsuneEnt.maxHp, BOSSES.sakura_nine_tail_kitsune.hp * 1.5, '2 players in Reef scales Kitsune HP by 1.5x');
  kitsuneEnt.ledger[host.id] = { dmg: 3000, heal: 0, repair: 0, score: 3000 };
  kitsuneEnt.hp = 1;
  env.advanceTime(1000);
  assert.equal(env.service.handle({ instanceId: instReef }, host, { type: 'sf_attack', targetId: kitsuneEnt.id }).ok, true);
  assert.ok((host.frontier.warehouse.items.boss_core_kitsune || 0) >= 2, 'Defeating Kitsune grants boss_core_kitsune');
  assert.equal(host.story.progress.c6_defeat_sakura_kitsune, 1, 'Defeating Kitsune records Chapter 6 boss step');

  // Complete Chapter 6 -> Caldera unlocks for host AND Couple guest partner!
  host.story.completed.push(6);
  host.story.chapter = 7;
  env.presence.set(host.id, { instanceId: instReef, x: 14, z: -30, t: env.getTime() });
  const trCaldera = env.service.regionTransfer({ instanceId: instReef }, host, 'caldera');
  assert.equal(trCaldera.ok, true);
  assert.equal(trCaldera.targetId, 'frontier:sf_gates~caldera');
  const trPartnerCaldera = env.service.regionTransfer({ instanceId: instReef }, partner, 'caldera');
  assert.equal(trPartnerCaldera.ok, true);
  assert.equal(trPartnerCaldera.guest, true);
  assert.equal(env.service.resolveEntry(partner, 'frontier:sf_gates~caldera').regionId, 'caldera');

  // Summon & defeat Chronos-Solar Bahamut in Caldera at boss POI (0, -26)
  const instCaldera = 'frontier:sf_gates~caldera';
  env.instances.set(instReef, new Set());
  env.instances.set(instCaldera, new Set([host.id]));
  env.presence.set(host.id, { instanceId: instCaldera, x: 0, z: -26, t: env.getTime() });
  const startBahamut = env.service.handle({ instanceId: instCaldera }, host, { type: 'sf_boss_start', bossId: 'chronos_solar_bahamut' });
  assert.equal(startBahamut.ok, true);
  const bahamutEnt = sh.live.monsters.get(sh.live.bosses.get('caldera'));
  bahamutEnt.ledger[host.id] = { dmg: 5000, heal: 0, repair: 0, score: 5000 };
  bahamutEnt.hp = 1;
  env.advanceTime(1000);
  assert.equal(env.service.handle({ instanceId: instCaldera }, host, { type: 'sf_attack', targetId: bahamutEnt.id }).ok, true);
  assert.ok((host.frontier.warehouse.items.boss_core_bahamut || 0) >= 2, 'Defeating Bahamut grants boss_core_bahamut');

  // Verify Workshop Weapon Forge crafts all 12 Boss Weapons across Meadow, Hollow, Reef & Caldera
  const bc = createBasecampService({ rng: () => 0.98, now: () => 80_000_000 });
  host.village.copies.workshop = 1;
  host.gold = 500_000;
  host.frontier.warehouse.items = {
    boss_core_moss: 40, ingot: 80, plank: 80,
    boss_core_weaver: 40, mithril_ingot: 80, crystal_glass: 80,
    boss_core_kitsune: 40, sakura_timber: 80, celestial_pearl: 80,
    boss_core_bahamut: 40, orichalcum_ore: 80, astral_prism: 80,
  };
  for (const weaponId of Object.keys(BOSS_WEAPON_FORGE.RECIPES)) {
    const forgeRes = bc.craftDecor(host, `weapon_forge:roll:${weaponId}`);
    assert.equal(forgeRes.ok, true, `Failed to forge ${weaponId}: ${JSON.stringify(forgeRes)}`);
    assert.ok(host.inventory[weaponId], `Forged ${weaponId} missing from inventory`);
  }

  env.service.stopAll();
});

// =================================================================================================
// 14. Casting All 12 New Monster Skills (Reef, Caldera, Meadow Hare & Hollow Myconid)
// =================================================================================================
test('14. Casting all 12 new Monster Skills: backstep vault, frost vuln, foxfire split/focus, mirror dmg_reduce, tailwind crit_up, whirlpool, following sakura tempest, meteor burn, 4-bounce lightning, star brand +25% vuln, time dilation CD refund & supernova cleave', () => {
  const env = createCombatEnv({ initialNow: 90_000_000, rng: () => 0.99 });
  const instId = 'frontier:sf_newskills~caldera';
  const ws = { instanceId: instId };

  const p = createStarterProfile('arch_caster', '1234', 'bkk');
  migrateRpg(p);
  p.level = 25;
  wardrobeEquip(p, { slot: 'gloves', itemId: 'gloves_starter_sword' });

  const ally = createStarterProfile('arch_ally', '1234', 'dxb');
  migrateRpg(ally);
  ally.level = 25;
  wardrobeEquip(ally, { slot: 'gloves', itemId: 'gloves_starter_wand' });

  env.profiles.set(p.id, p);
  env.profiles.set(ally.id, ally);
  env.instances.set(instId, new Set([p.id, ally.id]));
  env.presence.set(p.id, { instanceId: instId, x: 0, z: 0, t: env.getTime() });
  env.presence.set(ally.id, { instanceId: instId, x: 2.0, z: 0, t: env.getTime() });

  const sh = env.service.loadShard('sf_newskills');
  const fillBg = () => {
    sh.live.monsters.clear();
    sh.live.bosses.clear();
    const calR = sh.live.regions.get('caldera');
    if (calR?.skillZones) calR.skillZones.length = 0;
    for (const type of ['sanctum_cinder_salamander', 'sanctum_arc_automaton', 'sanctum_star_gargoyle', 'sanctum_chrono_sentinel']) {
      for (let k = 0; k < 4; k++) {
        spawnTestMob(sh, `bg_cal_${type}_${k}`, type, -30, 30, { hp: 900, regionId: 'caldera' });
      }
    }
  };
  fillBg();

  for (const skId of MONSTER_SKILL_IDS) {
    p.frontier.skills.unlocked[skId] = 4;
  }

  // Initialize player combat states
  const dummy = spawnTestMob(sh, 'init_cal', 'sanctum_star_gargoyle', 20, 20, { hp: 100, regionId: 'caldera' });
  env.service.handle(ws, p, { type: 'sf_attack', targetId: dummy.id });
  env.service.handle(ws, ally, { type: 'sf_attack', targetId: dummy.id });
  sh.live.monsters.delete('init_cal');
  const pPs = sh.live.players.get(p.id);
  const aPs = sh.live.players.get(ally.id);

  // 1) sk_zephyr_vault: cone damage + 35% slow + 3.4m backward vault + haste buff
  env.service.handle(ws, p, { type: 'sf_pouch_set', skillAction: 'equip', slot: 0, skillId: 'sk_zephyr_vault' });
  const mVault = spawnTestMob(sh, 'm_vault', 'sanctum_cinder_salamander', 0, -4.0, { hp: 800, regionId: 'caldera' });
  const rVault = env.service.handle(ws, p, { type: 'sf_ultimate', skillSlot: 0, facing: { x: 0, z: -1 } });
  assert.equal(rVault.ok, true);
  assert.equal(rVault.hits.length, 1);
  assert.equal(mVault.slowPct, 0.35);
  assert.ok(Math.abs(rVault.pos.z - 3.4) < 0.05, `Expected backward vault to z=+3.4, got ${rVault.pos.z}`);
  assert.ok(pPs.buffs.haste?.until > env.getTime());

  // 2) sk_frost_nova: 4.5m AoE freeze (1600ms mob / 750ms boss) + 50% chill + +15% frozen vulnerability
  fillBg();
  env.advanceTime(20_000);
  env.presence.set(p.id, { instanceId: instId, x: 0, z: 0, t: env.getTime() });
  env.service.handle(ws, p, { type: 'sf_pouch_set', skillAction: 'equip', slot: 0, skillId: 'sk_frost_nova' });
  const mFrost = spawnTestMob(sh, 'm_frost', 'sanctum_arc_automaton', 0, -2.0, { hp: 1000, regionId: 'caldera' });
  const bFrost = spawnTestMob(sh, 'b_frost', 'chronos_solar_bahamut', 2.0, 0, { hp: 5000, regionId: 'caldera', kind: 'boss' });
  const rFrost = env.service.handle(ws, p, { type: 'sf_ultimate', skillSlot: 0 });
  assert.equal(rFrost.ok, true);
  assert.equal(rFrost.hits.length, 2);
  assert.equal(mFrost.frozenUntil, env.getTime() + 1600);
  assert.equal(bFrost.frozenUntil, env.getTime() + 750);
  assert.equal(mFrost.vuln, 0.15);

  // 3) sk_foxfire_wisps: 3 homing orbs focus 1 target when solo, and split across 3 targets when 3 are nearby
  fillBg();
  env.advanceTime(20_000);
  env.service.handle(ws, p, { type: 'sf_pouch_set', skillAction: 'equip', slot: 0, skillId: 'sk_foxfire_wisps' });
  const mFoxSolo = spawnTestMob(sh, 'm_fox_solo', 'sanctum_cinder_salamander', 0, -5.0, { hp: 1000, regionId: 'caldera' });
  const rFoxSolo = env.service.handle(ws, p, { type: 'sf_ultimate', skillSlot: 0 });
  assert.equal(rFoxSolo.hits.length, 3, 'All 3 foxfire orbs focus onto single target');
  assert.ok(rFoxSolo.hits.every(([id]) => id === mFoxSolo.id));

  fillBg();
  env.advanceTime(20_000);
  spawnTestMob(sh, 'm_fox_1', 'sanctum_cinder_salamander', -2, -4, { hp: 1000, regionId: 'caldera' });
  spawnTestMob(sh, 'm_fox_2', 'sanctum_cinder_salamander', 0, -5, { hp: 1000, regionId: 'caldera' });
  spawnTestMob(sh, 'm_fox_3', 'sanctum_cinder_salamander', 2, -6, { hp: 1000, regionId: 'caldera' });
  const rFoxSplit = env.service.handle(ws, p, { type: 'sf_ultimate', skillSlot: 0 });
  assert.equal(new Set(rFoxSplit.hits.map(([id]) => id)).size, 3, '3 foxfire orbs split across 3 nearby targets');

  // 4) sk_mirror_shell: shield + 45% dmg_reduce buff + 4.6m shockwave damage
  fillBg();
  env.advanceTime(20_000);
  env.service.handle(ws, p, { type: 'sf_pouch_set', skillAction: 'equip', slot: 0, skillId: 'sk_mirror_shell' });
  const mMirror = spawnTestMob(sh, 'm_mirror', 'sanctum_star_gargoyle', 0, -1.0, { hp: 1000, dmg: 100, regionId: 'caldera' });
  const rMirror = env.service.handle(ws, p, { type: 'sf_ultimate', skillSlot: 0 });
  assert.equal(rMirror.ok, true);
  assert.ok(rMirror.shieldHp >= 30);
  assert.equal(pPs.buffs.dmg_reduce?.pct, 0.45);
  assert.equal(aPs.buffs.dmg_reduce?.pct, 0.45);
  assert.equal(rMirror.hits.length, 1);
  // Test dmg_reduce: set shield to 0 and let 100-dmg mob strike -> reduced by 45% to 55 damage!
  pPs.shield = 0; pPs.shieldHp = 0; pPs.hp = pPs.maxHp;
  mMirror.atkCdUntil = 0;
  env.advanceTime(100);
  env.service._tick('sf_newskills', env.getTime());
  assert.equal(pPs.hp, pPs.maxHp - 55, 'dmg_reduce (45%) cuts 100 incoming damage down to 55');

  // 5) sk_tailwind_gale: party heal + +35% haste + +20% crit_up
  fillBg();
  env.advanceTime(20_000);
  pPs.hp = 50; aPs.hp = 50;
  env.service.handle(ws, p, { type: 'sf_pouch_set', skillAction: 'equip', slot: 0, skillId: 'sk_tailwind_gale' });
  const rGale = env.service.handle(ws, p, { type: 'sf_ultimate', skillSlot: 0 });
  assert.equal(rGale.ok, true);
  assert.ok(pPs.hp > 50 && aPs.hp > 50, 'Tailwind Gale heals caster and nearby ally');
  assert.equal(pPs.buffs.haste?.pct, 0.35);
  assert.equal(pPs.buffs.crit_up?.pct, 0.20);
  // With rng=0.22 (> base 0.15 crit, < 0.15 + 0.20 = 0.35), attack crits thanks to crit_up!
  env.setRng(() => 0.22);
  const mCrit = spawnTestMob(sh, 'm_crit', 'sanctum_arc_automaton', 0, -1.5, { hp: 500, regionId: 'caldera' });
  const rCritAtk = env.service.handle(ws, p, { type: 'sf_attack', targetId: mCrit.id });
  assert.equal(rCritAtk.crit, true, '+20% crit_up buff turns 0.22 roll into a critical hit');
  env.setRng(() => 0.99);

  // 6) sk_koi_whirlpool: pulls mob to ~0.9m of ground target + 3 zone pulses (4 total hits)
  fillBg();
  env.advanceTime(20_000);
  env.service.handle(ws, p, { type: 'sf_pouch_set', skillAction: 'equip', slot: 0, skillId: 'sk_koi_whirlpool' });
  const mKoi = spawnTestMob(sh, 'm_koi', 'sanctum_cinder_salamander', 3.0, -4.0, { hp: 2000, regionId: 'caldera', speed: 0.01 });
  const rKoi = env.service.handle(ws, p, { type: 'sf_ultimate', skillSlot: 0, targetX: 0, targetZ: -4.0 });
  assert.equal(rKoi.ok, true);
  assert.ok(Math.hypot(mKoi.x - 0, mKoi.z - (-4.0)) <= 1.05, 'Koi Whirlpool pulls monster inward to ~0.9m');
  const hpAfterKoiCast = mKoi.hp;
  assert.ok(hpAfterKoiCast < 2000);
  for (let sec = 1; sec <= 3; sec++) {
    env.advanceTime(1000);
    const prev = mKoi.hp;
    env.service._tick('sf_newskills', env.getTime());
    assert.ok(mKoi.hp < prev, `Koi Whirlpool zone pulse #${sec + 1} damaged monster`);
  }

  // 7) sk_sakura_tempest: immediate AoE damage + heal, plus 2 following pulses moving with caster!
  fillBg();
  env.advanceTime(20_000);
  env.presence.set(p.id, { instanceId: instId, x: 0, z: 0, t: env.getTime() });
  pPs.hp = 60; pPs.lastHitAt = env.getTime();
  env.service.handle(ws, p, { type: 'sf_pouch_set', skillAction: 'equip', slot: 0, skillId: 'sk_sakura_tempest' });
  const mSakura1 = spawnTestMob(sh, 'm_sakura_1', 'sanctum_cinder_salamander', 0, -3.0, { hp: 2000, regionId: 'caldera', speed: 0.01 });
  const mSakura2 = spawnTestMob(sh, 'm_sakura_2', 'sanctum_cinder_salamander', 12.0, 0, { hp: 2000, regionId: 'caldera', speed: 0.01 });
  const rSakura = env.service.handle(ws, p, { type: 'sf_ultimate', skillSlot: 0 });
  assert.equal(rSakura.ok, true);
  assert.ok(mSakura1.hp < 2000 && mSakura2.hp === 2000);
  assert.ok(pPs.hp > 60);
  // Move caster next to mSakura2 at (10, 0) -> following tempest hits mSakura2 on next tick!
  env.presence.set(p.id, { instanceId: instId, x: 10.0, z: 0, t: env.getTime() });
  env.advanceTime(1000);
  pPs.lastHitAt = env.getTime();
  const hpBeforeFollow = pPs.hp;
  env.service._tick('sf_newskills', env.getTime());
  assert.ok(mSakura2.hp < 2000, 'Following Sakura Tempest moves with caster and hits distant mob');
  assert.ok(pPs.hp > hpBeforeFollow, 'Following Sakura Tempest heals caster on tick');

  // 8) sk_solar_meteor: impact damage + 2 solar_burn DoT pulses
  fillBg();
  env.advanceTime(20_000);
  env.presence.set(p.id, { instanceId: instId, x: 0, z: 0, t: env.getTime() });
  env.service.handle(ws, p, { type: 'sf_pouch_set', skillAction: 'equip', slot: 0, skillId: 'sk_solar_meteor' });
  const mMeteor = spawnTestMob(sh, 'm_meteor', 'sanctum_chrono_sentinel', 0, -5.0, { hp: 2500, regionId: 'caldera', speed: 0.01 });
  const rMeteor = env.service.handle(ws, p, { type: 'sf_ultimate', skillSlot: 0, targetX: 0, targetZ: -5.0 });
  assert.equal(rMeteor.ok, true);
  const impactDealt = 2500 - mMeteor.hp;
  assert.ok(impactDealt > 30);
  env.advanceTime(1000);
  env.service._tick('sf_newskills', env.getTime());
  assert.equal(mMeteor.hp, 2500 - impactDealt - Math.max(1, Math.round(impactDealt * 0.25)), 'Solar burn tick deals 25% of impact damage');

  // 9) sk_chain_lightning: bounces across up to 4 monsters within 5.5m and micro-stuns each (5th untouched)
  fillBg();
  env.advanceTime(20_000);
  env.service.handle(ws, p, { type: 'sf_pouch_set', skillAction: 'equip', slot: 0, skillId: 'sk_chain_lightning' });
  const c1 = spawnTestMob(sh, 'c_1', 'sanctum_arc_automaton', 0, -4.0, { hp: 1000, regionId: 'caldera' });
  const c2 = spawnTestMob(sh, 'c_2', 'sanctum_arc_automaton', 3.5, -4.0, { hp: 1000, regionId: 'caldera' });
  const c3 = spawnTestMob(sh, 'c_3', 'sanctum_arc_automaton', 7.0, -4.0, { hp: 1000, regionId: 'caldera' });
  const c4 = spawnTestMob(sh, 'c_4', 'sanctum_arc_automaton', 10.5, -4.0, { hp: 1000, regionId: 'caldera' });
  const c5 = spawnTestMob(sh, 'c_5', 'sanctum_arc_automaton', 14.0, -4.0, { hp: 1000, regionId: 'caldera' });
  const rChain = env.service.handle(ws, p, { type: 'sf_ultimate', skillSlot: 0, targetId: c1.id });
  assert.equal(rChain.ok, true);
  assert.equal(rChain.hits.length, 4, 'Chain Lightning arcs across 4 distinct monsters');
  for (const cm of [c1, c2, c3, c4]) {
    assert.ok(cm.hp < 1000);
    assert.equal(cm.stunUntil, env.getTime() + 550);
  }
  assert.equal(c5.hp, 1000, '5th monster beyond 4-bounce cap is untouched');

  // 10) sk_star_brand: ground AoE damage + +25% vulnPct amplification on subsequent hits!
  fillBg();
  env.advanceTime(20_000);
  env.service.handle(ws, p, { type: 'sf_pouch_set', skillAction: 'equip', slot: 0, skillId: 'sk_star_brand' });
  const unbranded = spawnTestMob(sh, 'm_unbrand', 'sanctum_star_gargoyle', -1.2, -1.2, { hp: 2000, regionId: 'caldera' });
  const branded = spawnTestMob(sh, 'm_brand', 'sanctum_star_gargoyle', 0, -5.0, { hp: 2000, regionId: 'caldera' });
  const baseAtk = env.service.handle(ws, p, { type: 'sf_attack', targetId: unbranded.id });
  const baseHitDmg = baseAtk.hits.find(([id]) => id === unbranded.id)[1];
  sh.live.monsters.delete(unbranded.id);

  const rBrand = env.service.handle(ws, p, { type: 'sf_ultimate', skillSlot: 0, targetX: 0, targetZ: -5.0 });
  assert.equal(rBrand.ok, true);
  assert.equal(branded.vulnPct, 0.25);
  assert.equal(branded.vulnUntil, env.getTime() + 5000);
  branded.x = 0; branded.z = -1.2;
  env.advanceTime(2500); // reset combo to step 1 while keeping 5s vulnUntil active!
  const boostedAtk = env.service.handle(ws, p, { type: 'sf_attack', targetId: branded.id });
  const boostedHitDmg = boostedAtk.hits[0][1];
  assert.equal(boostedHitDmg, Math.round(baseHitDmg * 1.25), 'Star Brand amplifies party damage by +25%');

  // 11) sk_time_dilation: 65% slow + shockwave damage + 2500ms cooldown refund on other skill slot!
  fillBg();
  env.advanceTime(20_000);
  env.service.handle(ws, p, { type: 'sf_pouch_set', skillAction: 'equip', slot: 0, skillId: 'sk_star_brand' });
  env.service.handle(ws, p, { type: 'sf_pouch_set', skillAction: 'equip', slot: 1, skillId: 'sk_time_dilation' });
  const slot0Cast = env.service.handle(ws, p, { type: 'sf_ultimate', skillSlot: 0, targetX: 0, targetZ: -3.0 });
  const cd0Before = slot0Cast.cooldownUntil;
  const mTime = spawnTestMob(sh, 'm_time', 'sanctum_chrono_sentinel', 0, -2.5, { hp: 1000, regionId: 'caldera' });
  const rTime = env.service.handle(ws, p, { type: 'sf_ultimate', skillSlot: 1 });
  assert.equal(rTime.ok, true);
  assert.equal(mTime.slowPct, 0.65);
  assert.equal(rTime.skillCds[0], cd0Before - 2500, 'Time Dilation rewinds 2.5s off Slot 0 cooldown');

  // 12) sk_supernova_cleave: 7.5m 95° cone colossal damage + 1400ms mob stun / 700ms boss stagger
  fillBg();
  env.advanceTime(20_000);
  env.service.handle(ws, p, { type: 'sf_pouch_set', skillAction: 'equip', slot: 0, skillId: 'sk_supernova_cleave' });
  const mNova = spawnTestMob(sh, 'm_nova', 'sanctum_cinder_salamander', 3.0, -5.5, { hp: 2000, regionId: 'caldera' });
  const bNova = spawnTestMob(sh, 'b_nova', 'chronos_solar_bahamut', -3.0, -5.5, { hp: 6000, regionId: 'caldera', kind: 'boss' });
  const rNova = env.service.handle(ws, p, { type: 'sf_ultimate', skillSlot: 0, facing: { x: 0, z: -1 } });
  assert.equal(rNova.ok, true);
  assert.equal(rNova.hits.length, 2, '95° 7.5m Supernova Cleave hits wide cone targets');
  assert.equal(mNova.stunUntil, env.getTime() + 1400);
  assert.equal(bNova.stunUntil, env.getTime() + 700);

  env.service.stopAll();
});

// =================================================================================================
// 15. Smoothness & Optimization Contracts: sf_attack skillSlot, 6-Tuple Hits, Zone Tick FX, Thorns & Hibernation
// =================================================================================================
test('15. Smoothness contracts: sf_attack skillSlot routing, 6-tuple pull coords, zone_tick FX, Mirror Shell 35% thorns, and 60s idle hibernation', () => {
  const env = createCombatEnv({ initialNow: 95_000_000, rng: () => 0.42 });
  const instId = 'frontier:sf_smooth~meadow';
  const ws = { instanceId: instId };

  const p = createStarterProfile('smooth_hero', '1234', 'bkk');
  migrateRpg(p);
  wardrobeEquip(p, { slot: 'gloves', itemId: 'gloves_starter_sword' });
  p.frontier.skills.unlocked = {
    sk_zephyr_vault: 3,
    sk_gravity_spin: 3,
    sk_mirror_shell: 3,
    sk_koi_whirlpool: 3,
  };
  env.profiles.set(p.id, p);
  env.instances.set(instId, new Set([p.id]));
  env.presence.set(p.id, { instanceId: instId, x: 0, z: 0, t: env.getTime() });

  const sh = env.service.loadShard('sf_smooth');
  env.service.handle(ws, p, { type: 'sf_state' });

  // 1) sf_attack with skillSlot routes to castMonsterSkill (zero profile spam) + grants Haste buffs + dash grace window
  env.service.handle(ws, p, { type: 'sf_pouch_set', skillAction: 'equip', slot: 0, skillId: 'sk_zephyr_vault' });
  const vaultMob = spawnTestMob(sh, 'm_vault_s', 'moss_slime', 0, -2.0, { hp: 500 });
  const rVault = env.service.handle(ws, p, { type: 'sf_attack', skillSlot: 0, facing: { x: 0, z: -1 } });
  assert.equal(rVault.ok, true);
  assert.equal(rVault.skillId, 'sk_zephyr_vault');
  assert.ok(rVault.buffs && rVault.buffs.hasteUntil > env.getTime(), 'sf_attack skill cast returns active hasteUntil buff');
  assert.ok(env.presence.get(p.id).t <= env.getTime() - 900, 'Dash sets anti-rubberband presence grace timestamp');
  assert.equal(rVault.hits[0].length, 6, 'Hit tuple carries 6 elements [id, dealt, crit, hp, monX, monZ]');
  sh.live.monsters.delete(vaultMob.id);

  // 2) sk_gravity_spin emits displaced post-pull coordinates in 6-tuple hits
  env.advanceTime(20_000);
  env.presence.set(p.id, { instanceId: instId, x: 0, z: 0, t: env.getTime() });
  env.service.handle(ws, p, { type: 'sf_pouch_set', skillAction: 'equip', slot: 0, skillId: 'sk_gravity_spin' });
  const pullMob = spawnTestMob(sh, 'm_pull_6t', 'thornback_boar', 4.0, 0, { hp: 600 });
  const rPull = env.service.handle(ws, p, { type: 'sf_attack', skillSlot: 0 });
  assert.equal(rPull.ok, true);
  const hitTuple = rPull.hits.find(([id]) => id === pullMob.id);
  assert.ok(hitTuple && hitTuple.length === 6);
  assert.ok(Math.abs(hitTuple[4] - pullMob.x) < 0.05 && hitTuple[4] < 1.3, '6-tuple hit carries pulled monster X');
  sh.live.monsters.delete(pullMob.id);

  // 3) sk_koi_whirlpool persistent zone broadcasts sf_fx kind === 'zone_tick' with 6-tuple hits
  env.advanceTime(20_000);
  env.service.handle(ws, p, { type: 'sf_pouch_set', skillAction: 'equip', slot: 1, skillId: 'sk_koi_whirlpool' });
  const koiMob = spawnTestMob(sh, 'm_koi_tick', 'moss_slime', 3.2, -4.0, { hp: 800, speed: 0.01 });
  const rKoi = env.service.handle(ws, p, { type: 'sf_attack', skillSlot: 1, targetX: 0, targetZ: -4.0 });
  assert.equal(rKoi.ok, true);
  env.broadcasts.length = 0;
  env.advanceTime(1000);
  env.service._tick('sf_smooth', env.getTime());
  const zoneFx = env.broadcasts.find((b) => b.msg.type === 'sf_fx' && b.msg.kind === 'zone_tick' && b.msg.zoneKind === 'koi_whirlpool');
  assert.ok(zoneFx, 'Active Koi Whirlpool broadcasts sf_fx zone_tick on pulse');
  const koiHit = zoneFx.msg.hits.find(([id]) => id === koiMob.id);
  assert.ok(koiHit && koiHit.length === 6 && koiHit[4] < 3.2, 'zone_tick carries pulled 6-tuple monster coords');
  sh.live.monsters.delete(koiMob.id);
  sh.live.regions.get('meadow').skillZones = [];

  // 4) sk_mirror_shell reflects 35% raw monster damage back onto attacker (clamped hp >= 1)
  env.advanceTime(20_000);
  env.service.handle(ws, p, { type: 'sf_pouch_set', skillAction: 'equip', slot: 0, skillId: 'sk_mirror_shell' });
  const rShell = env.service.handle(ws, p, { type: 'sf_attack', skillSlot: 0 });
  assert.equal(rShell.ok, true);
  const attacker = spawnTestMob(sh, 'm_thorns', 'thornback_boar', 0, -0.8, { hp: 200, dmg: 40 });
  env.advanceTime(100);
  env.service._tick('sf_smooth', env.getTime());
  assert.equal(attacker.hp, 200 - Math.round(40 * 0.35), 'Mirror Shell reflects 35% water thorns damage onto attacker');

  // 5) Empty region on an active shard hibernates ambient monsters after 60s and repopulates immediately on player entry
  const hollowInstId = 'frontier:sf_smooth~hollow';
  env.instances.set(instId, new Set());
  env.instances.set(hollowInstId, new Set([p.id]));
  env.presence.set(p.id, { instanceId: hollowInstId, x: 0, z: 0, t: env.getTime() });
  env.advanceTime(61_000);
  env.service._tick('sf_smooth', env.getTime());
  const regState = sh.live.regions.get('meadow');
  assert.equal(regState.hibernated, true, 'Empty region hibernates after 60s while player explores another region');
  const meadowMobsDuringHib = [...sh.live.monsters.values()].filter((m) => m.regionId === 'meadow');
  assert.equal(meadowMobsDuringHib.length, 0, 'Hibernated region clears idle ambient monsters');

  // Player re-enters meadow -> wakes immediately and repopulates ambient packs!
  env.instances.set(hollowInstId, new Set());
  env.instances.set(instId, new Set([p.id]));
  env.presence.set(p.id, { instanceId: instId, x: 0, z: 0, t: env.getTime() });
  const snapAfterWake = env.service.handle(ws, p, { type: 'sf_state' });
  assert.equal(regState.hibernated, false);
  assert.ok(snapAfterWake.layout.monsters.length >= 12, 'Hibernated region repopulates habitat packs immediately on entry');

  env.service.stopAll();
});

// =================================================================================================
// 16. Authoritative Combat Sync: 💖 Vitality Passive HP/s & 10s Ticker, 4s Sanctuary, Snapshot HP & Zero-Whiff sf_attack
// =================================================================================================
test('16. 💖 Vitality passive HP/s regen & 10s ticker, 4000ms Sanctuary delay, authoritative combatSnapshot HP, and zero-whiff sf_attack readyAt / out_of_range', () => {
  // 1) skyFrontierMods hpRegenPerSec scales smoothly with fortune (💖 Vitality)
  const zeroVit = skyFrontierMods({ fortune: 0 });
  const lowVit = skyFrontierMods({ fortune: 20 });
  const highVit = skyFrontierMods({ fortune: 280 });
  assert.equal(zeroVit.hpRegenPerSec, 0.6);
  assert.ok(lowVit.hpRegenPerSec > zeroVit.hpRegenPerSec, 'Starter Vitality increases hpRegenPerSec above 0.6');
  assert.ok(highVit.hpRegenPerSec > lowVit.hpRegenPerSec * 2.5 && highVit.hpRegenPerSec <= 5.0, `High Vitality scales hpRegenPerSec meaningfully (${lowVit.hpRegenPerSec} -> ${highVit.hpRegenPerSec})`);

  const env = createCombatEnv({ initialNow: 100_000_000, rng: () => 0.99 });
  const instId = 'frontier:sf_vit16~meadow';
  const ws = { instanceId: instId };

  const pLow = createStarterProfile('vit_starter', '1234', 'bkk');
  migrateRpg(pLow);
  pLow.level = 15;
  wardrobeEquip(pLow, { slot: 'gloves', itemId: 'gloves_starter_sword' });

  const pHigh = createStarterProfile('vit_guardian', '1234', 'dxb');
  migrateRpg(pHigh);
  pHigh.level = 15;
  pHigh.inventory.gloves_boss_moss_cleaver = {
    refine: 10,
    dupes: 0,
    forgeGrade: 'SS',
    rolledStats: { fortune: 95, power: 20 },
  };
  wardrobeEquip(pHigh, { slot: 'gloves', itemId: 'gloves_boss_moss_cleaver' });

  env.profiles.set(pLow.id, pLow);
  env.profiles.set(pHigh.id, pHigh);
  env.instances.set(instId, new Set([pLow.id, pHigh.id]));
  // Place both at (20, 20), well outside Meadow Outpost Sanctuary at (0, 4)
  env.presence.set(pLow.id, { instanceId: instId, x: 20, z: 20, t: env.getTime() });
  env.presence.set(pHigh.id, { instanceId: instId, x: 21, z: 20, t: env.getTime() });

  const sh = env.service.loadShard('sf_vit16');

  // 2) combatSnapshot (sf_state / layout.playerHp[uid]) ALWAYS populates playerHp even before any combat action
  assert.equal(sh.live.players.has(pLow.id), false);
  const initialState = env.service.handle(ws, pLow, { type: 'sf_state' });
  assert.ok(initialState.layout.playerHp[pLow.id], 'Initial sf_state populates layout.playerHp[pLow]');
  assert.ok(initialState.layout.playerHp[pHigh.id], 'Initial sf_state populates layout.playerHp[pHigh]');
  assert.equal(initialState.layout.playerHp[pLow.id].hp, initialState.layout.playerHp[pLow.id].maxHp);

  // Fill ambient monster cap far away so random ambient spawns do not interfere
  sh.live.monsters.clear();
  let bgCount16 = 0;
  for (const type of ['pollen_wisp', 'moss_slime', 'thornback_boar', 'meadow_zephyr_hare']) {
    const pk = MONSTERS[type]?.packSize || 7;
    for (let k = 0; k < pk; k++) {
      spawnTestMob(sh, `bg16_${type}_${k}`, type, -30, 30, { hp: 500 });
      bgCount16 += 1;
    }
  }
  sh.live.regions.set('meadow', { count: bgCount16, ambientAlive: bgCount16, ambientDue: [], dirty: new Set(), lastDeltaAt: 0, outpostDirty: false, lastOutpostAt: 0, skillZones: [] });

  // Inflict monster damage onto both full-HP players and verify combatSnapshot preserves exact damaged HP
  const psLow = sh.live.players.get(pLow.id);
  const psHigh = sh.live.players.get(pHigh.id);
  const hitter1 = spawnTestMob(sh, 'hit_low', 'thornback_boar', 20, 19.5, { hp: 300, dmg: psLow.maxHp - 50 });
  const hitter2 = spawnTestMob(sh, 'hit_high', 'thornback_boar', 24, 19.5, { hp: 300, dmg: psHigh.maxHp - 50 });
  env.presence.set(pHigh.id, { instanceId: instId, x: 24, z: 20, t: env.getTime() });
  hitter1.targetId = pLow.id;
  hitter2.targetId = pHigh.id;
  env.advanceTime(100);
  env.service._tick('sf_vit16', env.getTime());
  sh.live.monsters.delete(hitter1.id);
  sh.live.monsters.delete(hitter2.id);

  assert.equal(psLow.hp, 50);
  assert.equal(psHigh.hp, 50);
  const damagedSnap = env.service.handle(ws, pLow, { type: 'sf_state' });
  assert.equal(damagedSnap.layout.playerHp[pLow.id].hp, 50, 'combatSnapshot preserves current damaged HP without resetting');
  assert.equal(damagedSnap.layout.playerHp[pHigh.id].hp, 50);

  // 3) tickPlayers regenerates HP every second from 💖 Vitality (faster for high fortune) & emits vitalityTickHeal at 10,000ms
  env.broadcasts.length = 0;

  for (let sec = 1; sec <= 9; sec++) {
    env.advanceTime(1000);
    env.service._tick('sf_vit16', env.getTime());
  }
  assert.ok(psLow.hp > 50, 'Starter Vitality regenerated HP prior to 10s');
  assert.ok(psHigh.hp > psLow.hp + 10, `High Vitality regenerates much faster than starter (${psHigh.hp} vs ${psLow.hp})`);
  const prematureTicker = env.broadcasts.find((b) => b.msg.type === 'sf_player_hp' && b.msg.vitalityTickHeal > 0);
  assert.equal(prematureTicker, undefined, 'No 10s vitalityTickHeal emitted before 10,000ms (unless topped off)');

  // 10th second (10,000ms mark) -> emits vitalityTickHeal > 0 on sf_player_hp!
  env.broadcasts.length = 0;
  env.advanceTime(1000);
  env.service._tick('sf_vit16', env.getTime());
  const lowTickMsg = env.broadcasts.find((b) => b.msg.type === 'sf_player_hp' && b.msg.id === pLow.id && b.msg.vitalityTickHeal > 0);
  const highTickMsg = env.broadcasts.find((b) => b.msg.type === 'sf_player_hp' && b.msg.id === pHigh.id && b.msg.vitalityTickHeal > 0);
  assert.ok(lowTickMsg, 'Starter Vitality emits vitalityTickHeal at 10,000ms');
  assert.ok(highTickMsg, 'High Vitality emits vitalityTickHeal at 10,000ms');
  assert.equal(lowTickMsg.msg.source, 'vitality');
  assert.ok(highTickMsg.msg.vitalityTickHeal > lowTickMsg.msg.vitalityTickHeal, 'High Vitality 10s ticker heal exceeds starter Vitality');

  // Outpost Sanctuary waits 4000ms (COMBAT.SANCTUARY_DELAY_MS) after taking a hit before +12%/s burst-healing
  assert.equal(COMBAT.SANCTUARY_DELAY_MS, 4000);
  env.presence.set(pLow.id, { instanceId: instId, x: 0, z: 4, t: env.getTime() }); // Meadow Outpost (0, 4)
  psLow.hp = psLow.maxHp;
  const opHitter = spawnTestMob(sh, 'hit_op', 'thornback_boar', 0, 3.5, { hp: 200, dmg: psLow.maxHp - 40 });
  opHitter.targetId = pLow.id;
  env.advanceTime(100);
  env.service._tick('sf_vit16', env.getTime());
  sh.live.monsters.delete(opHitter.id);
  assert.equal(psLow.hp, 40);
  env.broadcasts.length = 0;

  for (let sec = 1; sec <= 3; sec++) {
    env.advanceTime(1000);
    env.service._tick('sf_vit16', env.getTime());
  }
  const earlySanctuary = env.broadcasts.find((b) => b.msg.type === 'sf_player_hp' && b.msg.id === pLow.id && b.msg.source === 'sanctuary');
  assert.equal(earlySanctuary, undefined, 'Outpost Sanctuary does NOT burst-heal within 3000ms of taking damage');

  const hpBeforeSanctuary = psLow.hp;
  env.broadcasts.length = 0;
  env.advanceTime(1000); // 4000ms since lastHitAt -> Sanctuary kicks in!
  env.service._tick('sf_vit16', env.getTime());
  const sanctMsg = env.broadcasts.find((b) => b.msg.type === 'sf_player_hp' && b.msg.id === pLow.id && b.msg.source === 'sanctuary');
  assert.ok(sanctMsg, 'Outpost Sanctuary burst-heals at 4000ms out of combat');
  assert.equal(psLow.hp, Math.min(psLow.maxHp, hpBeforeSanctuary + Math.ceil(psLow.maxHp * COMBAT.SANCTUARY_REGEN_PCT)));

  // 4) Zero-Whiff sf_attack: out_of_range at dist=9.0 preserves cooldown; range + 0.75 hits & returns readyAt + serverNow
  env.advanceTime(5000);
  env.presence.set(pLow.id, { instanceId: instId, x: 20, z: 20, t: env.getTime() });
  const lastAtkBefore = psLow.lastAttackAt;
  const comboBefore = psLow.comboStep;
  const farMob = spawnTestMob(sh, 'mob_far_9m', 'moss_slime', 20, 11.0, { hp: 300 }); // dist = 9.0m

  const whiffRes = env.service.handle(ws, pLow, { type: 'sf_attack', targetId: farMob.id });
  assert.equal(whiffRes.ok, false);
  assert.equal(whiffRes.error, 'out_of_range');
  assert.equal(whiffRes.dist, 9);
  assert.equal(whiffRes.monsterX, 20);
  assert.equal(whiffRes.monsterZ, 11);
  assert.equal(psLow.lastAttackAt, lastAtkBefore, 'out_of_range does NOT consume lastAttackAt cooldown');
  assert.equal(psLow.comboStep, comboBefore, 'out_of_range does NOT consume comboStep');

  // Move target to range + 0.75 (within range + 0.85 targeted slack) and swing immediately with 0ms wait!
  const meleeRange = WEAPON_CLASSES.melee.range;
  farMob.x = 20;
  farMob.z = 20 - (meleeRange + 0.75);
  env.broadcasts.length = 0;
  const hitRes = env.service.handle(ws, pLow, { type: 'sf_attack', targetId: farMob.id });
  assert.equal(hitRes.ok, true, 'Immediate follow-up swing at range + 0.75 connects without cooldown block');
  assert.equal(hitRes.hits.length, 1);
  assert.equal(hitRes.hits[0][0], farMob.id);
  assert.equal(hitRes.serverNow, env.getTime());
  assert.equal(hitRes.readyAt, env.getTime() + hitRes.cooldownMs, 'sf_attack returns authoritative readyAt');
  const atkFx = env.broadcasts.find((b) => b.msg.type === 'sf_fx' && b.msg.kind === 'attack' && b.msg.by === pLow.id);
  assert.ok(atkFx);
  assert.equal(atkFx.msg.readyAt, hitRes.readyAt, 'sf_fx attack broadcast carries readyAt');

  env.service.stopAll();
});

// =================================================================================================
// 17. Extended Mage (6.5m) & Ranger (7.8m) Ranges, Buffed Ranged/Ground Skill Reach & 3D Projectiles
// =================================================================================================
test('17. Mage (6.5m) & Ranger (7.8m) basic attack reach, buffed ranged/ground Monster Skill cast ranges, and 3D projectile combo layers', async () => {
  const { SKILL_VFX_DEFS } = await import('../shared/skill_vfx_defs.js');
  assert.equal(WEAPON_CLASSES.melee.range, 2.2);
  assert.equal(WEAPON_CLASSES.magic.range, 6.5);
  assert.equal(WEAPON_CLASSES.ranged.range, 7.8);

  // Every Mage & Ranger 1-2-3 combo owns a genuine `at: 'projectile'` 3D flight layer
  for (const comboId of [
    'combo_magic_1', 'combo_magic_2', 'combo_magic_3',
    'combo_ranged_1', 'combo_ranged_2', 'combo_ranged_3',
  ]) {
    const layers = SKILL_VFX_DEFS[comboId]?.effekseer?.layers || [];
    const projLayer = layers.find((l) => l.at === 'projectile');
    assert.ok(projLayer, `${comboId} must include an at: 'projectile' 3D flight layer`);
    assert.ok(Number(projLayer.travelMs) >= 150 && Number(projLayer.travelMs) <= 260, `${comboId} travelMs must be crisp (150-260ms)`);
  }

  // Verify buffed MONSTER_SKILLS ranges & castRange metadata
  assert.equal(MONSTER_SKILLS.sk_crystal_fan.range, 7.2);
  assert.equal(MONSTER_SKILLS.sk_earthshatter.castRange, 7.5);
  assert.equal(MONSTER_SKILLS.sk_prism_beam.range, 10.0);
  assert.equal(MONSTER_SKILLS.sk_zephyr_vault.range, 7.6);
  assert.equal(MONSTER_SKILLS.sk_foxfire_wisps.range, 8.6);
  assert.equal(MONSTER_SKILLS.sk_koi_whirlpool.castRange, 7.8);
  assert.equal(MONSTER_SKILLS.sk_solar_meteor.castRange, 8.2);
  assert.equal(MONSTER_SKILLS.sk_chain_lightning.range, 8.5);
  assert.equal(MONSTER_SKILLS.sk_chain_lightning.bounceRange, 6.0);
  assert.equal(MONSTER_SKILLS.sk_star_brand.castRange, 8.0);
  assert.equal(MONSTER_SKILLS.sk_supernova_cleave.range, 8.5);

  const env = createCombatEnv({ initialNow: 130_000_000, rng: () => 0.5 });
  const instId = 'frontier:sf_range17~caldera';
  const ws = { instanceId: instId };

  const mage = createStarterProfile('range_mage', '1234', 'bkk');
  const ranger = createStarterProfile('range_ranger', '1234', 'cnx');
  const frontAlly = createStarterProfile('front_ally', '1234', 'bkk');
  for (const u of [mage, ranger, frontAlly]) {
    migrateRpg(u);
    u.story.chapter = 7;
    u.story.completed = [0, 1, 2, 3, 4, 5, 6];
    u.frontier.unlocks.regions = ['meadow', 'hollow', 'reef', 'caldera'];
    for (const skId of MONSTER_SKILL_IDS) u.frontier.skills.unlocked[skId] = 5;
    env.profiles.set(u.id, u);
  }
  wardrobeEquip(mage, { slot: 'gloves', itemId: 'gloves_starter_wand' });
  wardrobeEquip(ranger, { slot: 'gloves', itemId: 'gloves_starter_shortbow' });
  wardrobeEquip(frontAlly, { slot: 'gloves', itemId: 'gloves_starter_sword' });

  env.instances.set(instId, new Set([mage.id, ranger.id, frontAlly.id]));
  env.presence.set(mage.id, { instanceId: instId, x: 0, z: 0, t: env.getTime() });
  env.presence.set(ranger.id, { instanceId: instId, x: 0, z: 0, t: env.getTime() });
  env.presence.set(frontAlly.id, { instanceId: instId, x: 0, z: -7.2, t: env.getTime() }); // 7.2m away from backline Mage!

  const sh = env.service.loadShard('sf_range17');
  env.service.handle(ws, mage, { type: 'sf_state' });
  env.service.handle(ws, ranger, { type: 'sf_state' });
  env.service.handle(ws, frontAlly, { type: 'sf_state' });

  const allyPs = sh.live.players.get(frontAlly.id);
  allyPs.hp = 50;

  // 1) Mage hits cleanly at 6.4m across 1-2-3 combo and Hit 3 heals frontline ally at 7.2m!
  const mageTarget = spawnTestMob(sh, 'm_mage_64', 'sanctum_chrono_sentinel', 0, -6.4, { hp: 3000, regionId: 'caldera' });
  for (let step = 1; step <= 3; step++) {
    env.advanceTime(800);
    const r = env.service.handle(ws, mage, { type: 'sf_attack', targetId: mageTarget.id, facing: { x: 0, z: -1 }, comboStep: step });
    assert.equal(r.ok, true, `Mage step ${step} hits at 6.4m`);
    assert.equal(r.hits.length, 1);
  }
  assert.ok(allyPs.hp > 50, 'Backline Mage Hit-3 heals frontline ally up to 7.5m away');
  sh.live.monsters.delete(mageTarget.id);

  // 2) Ranger hits cleanly at 7.7m!
  env.advanceTime(1000);
  const rangerTarget = spawnTestMob(sh, 'm_rng_77', 'sanctum_chrono_sentinel', 0, -7.7, { hp: 3000, regionId: 'caldera' });
  const rRng = env.service.handle(ws, ranger, { type: 'sf_attack', targetId: rangerTarget.id, facing: { x: 0, z: -1 }, comboStep: 1 });
  assert.equal(rRng.ok, true, 'Ranger hits cleanly at 7.7m');
  assert.equal(rRng.hits.length, 1);
  sh.live.monsters.delete(rangerTarget.id);

  // 3) Buffed ranged/ground/homing/chain skills reach targets from Mage/Ranger max combat distance!
  const longRangeSkillChecks = [
    ['sk_crystal_fan', 7.0],
    ['sk_earthshatter', 7.3],
    ['sk_prism_beam', 9.8],
    ['sk_zephyr_vault', 7.4],
    ['sk_foxfire_wisps', 8.4],
    ['sk_koi_whirlpool', 7.6],
    ['sk_solar_meteor', 8.0],
    ['sk_chain_lightning', 8.3],
    ['sk_star_brand', 7.8],
    ['sk_supernova_cleave', 8.3],
  ];
  for (const [skId, distZ] of longRangeSkillChecks) {
    env.advanceTime(25_000);
    env.presence.set(mage.id, { instanceId: instId, x: 0, z: 0, t: env.getTime() });
    env.service.handle(ws, mage, { type: 'sf_pouch_set', skillAction: 'equip', slot: 0, skillId: skId });
    const mob = spawnTestMob(sh, `m_${skId}`, 'sanctum_chrono_sentinel', 0, -distZ, { hp: 3000, regionId: 'caldera' });
    const res = env.service.handle(ws, mage, {
      type: 'sf_attack',
      skillSlot: 0,
      targetId: mob.id,
      facing: { x: 0, z: -1 },
      targetX: 0,
      targetZ: -distZ,
    });
    assert.equal(res.ok, true, `${skId} cast succeeds`);
    assert.ok(res.hits.length >= 1, `${skId} hits target at ${distZ}m`);
    sh.live.monsters.delete(mob.id);
    sh.live.regions.get('caldera').skillZones.length = 0;
  }

  env.service.stopAll();
});

// =================================================================================================
// 18. Team Puzzle Metadata, Multi-Stat Scaling & 0ms Authoritative Status Sync (hitStates & frozenIds)
// =================================================================================================
test('18. All 20 skills define teamRole, puzzleHint, statScaling & computeSkillNumbers multi-stat pills; sk_frost_nova emits 0ms hitStates (frozen+chilled bits) and frozenIds', () => {
  // 1) All 20 MONSTER_SKILLS metadata + computeSkillNumbers multi-stat scaling & starter duration preservation
  const starterStats = { power: 30, fortune: 25, swiftness: 60, luck: 20 };
  const endgameStats = { power: 120, fortune: 100, swiftness: 140, luck: 90 };

  for (const id of MONSTER_SKILL_IDS) {
    const sk = MONSTER_SKILLS[id];
    assert.ok(typeof sk.desc === 'string' && sk.desc.length >= 40, `${id} must have rich desc`);
    assert.ok(typeof sk.teamRole === 'string' && sk.teamRole.length >= 4, `${id} must have teamRole`);
    assert.ok(typeof sk.puzzleHint === 'string' && sk.puzzleHint.length >= 20, `${id} must have puzzleHint`);
    assert.ok(Array.isArray(sk.statScaling) && sk.statScaling.length >= 3, `${id} must have statScaling array`);

    const nStart = computeSkillNumbers(id, 3, starterStats, 180);
    const nHigh = computeSkillNumbers(id, 3, endgameStats, 250);
    assert.ok(Array.isArray(nHigh.scaling) && nHigh.scaling.length >= 3, `${id} computeSkillNumbers must return >= 3 scaling pills`);
    assert.ok(nHigh.cooldownMs < nStart.cooldownMs, `${id} cooldownMs scales down with Swiftness`);
    assert.ok(nHigh.skillCritPct > nStart.skillCritPct, `${id} skillCritPct scales up with Luck`);
  }

  // Starter swiftness <= 80 preserves exact 1600ms / 750ms freezeMs & 1500ms / 550ms / 1400ms stunMs
  const frostStart = computeSkillNumbers('sk_frost_nova', 3, { power: 40, fortune: 30, swiftness: 80, luck: 20 }, 180);
  const frostFast = computeSkillNumbers('sk_frost_nova', 3, endgameStats, 250);
  assert.equal(frostStart.freezeMs, 1600, 'Starter swiftness <= 80 keeps exact 1600ms freezeMs');
  assert.equal(frostStart.bossFreezeMs, 750, 'Starter swiftness <= 80 keeps exact 750ms bossFreezeMs');
  assert.ok(frostFast.freezeMs > 1600, `Swiftness > 80 extends freezeMs (${frostFast.freezeMs} > 1600)`);
  assert.ok(frostFast.bossFreezeMs > 750, `Swiftness > 80 extends bossFreezeMs (${frostFast.bossFreezeMs} > 750)`);

  const quakeStart = computeSkillNumbers('sk_earthshatter', 3, starterStats, 180);
  const quakeFast = computeSkillNumbers('sk_earthshatter', 3, endgameStats, 250);
  assert.equal(quakeStart.stunMs, 1500);
  assert.ok(quakeFast.stunMs > 1500, 'Swiftness > 80 extends sk_earthshatter stunMs');

  const chainFast = computeSkillNumbers('sk_chain_lightning', 3, endgameStats, 250);
  assert.ok(chainFast.stunMs > 550, 'Swiftness > 80 extends sk_chain_lightning stunMs');

  const novaFast = computeSkillNumbers('sk_supernova_cleave', 3, endgameStats, 250);
  assert.ok(novaFast.stunMs > 1400 && novaFast.bossStunMs > 700, 'Swiftness > 80 extends sk_supernova_cleave stunMs');

  const drainStart = computeSkillNumbers('sk_echo_drain', 3, starterStats, 180);
  const drainHigh = computeSkillNumbers('sk_echo_drain', 3, endgameStats, 250);
  assert.ok(drainHigh.leechPct > drainStart.leechPct, 'Vitality increases sk_echo_drain leechPct');

  // 2) 0ms authoritative hitStates & frozenIds on sk_frost_nova (including against crystal_beetle!)
  const env = createCombatEnv({ initialNow: 150_000_000, rng: () => 0.5 });
  const instId = 'frontier:sf_sync18~hollow';
  const ws = { instanceId: instId };
  const hero = createStarterProfile('cryo_hero', '1234', 'bkk');
  migrateRpg(hero);
  hero.level = 20;
  wardrobeEquip(hero, { slot: 'gloves', itemId: 'gloves_starter_sword' });
  hero.frontier.skills.unlocked.sk_frost_nova = 3;
  env.profiles.set(hero.id, hero);
  env.instances.set(instId, new Set([hero.id]));
  env.presence.set(hero.id, { instanceId: instId, x: 0, z: 0, t: env.getTime() });

  const sh = env.service.loadShard('sf_sync18');
  env.service.handle(ws, hero, { type: 'sf_state' });
  sh.live.monsters.clear();

  env.service.handle(ws, hero, { type: 'sf_pouch_set', skillAction: 'equip', slot: 0, skillId: 'sk_frost_nova' });
  const mBat = spawnTestMob(sh, 'm_sync_bat', 'lantern_bat', 0, -2.0, { hp: 800, regionId: 'hollow' });
  const mBeetle = spawnTestMob(sh, 'm_sync_beetle', 'crystal_beetle', 2.0, 0, { hp: 800, regionId: 'hollow' });
  env.broadcasts.length = 0;

  const rFrost = env.service.handle(ws, hero, { type: 'sf_attack', skillSlot: 0 });
  assert.equal(rFrost.ok, true);
  assert.equal(rFrost.hits.length, 2);
  assert.ok(Array.isArray(rFrost.hitStates) && rFrost.hitStates.length === 2, 'castMonsterSkill returns hitStates for all hit monsters');
  assert.ok(Array.isArray(rFrost.frozenIds) && rFrost.frozenIds.includes(mBat.id) && rFrost.frozenIds.includes(mBeetle.id), 'frozenIds contains all frozen monster IDs');

  for (const state of rFrost.hitStates) {
    assert.equal((state[1] & 16) === 16, true, `Monster ${state[0]} hitState has frozen bit (16) set immediately`);
    assert.equal((state[1] & 8) === 8, true, `Monster ${state[0]} hitState has chilled bit (8) set immediately`);
  }

  const skillFx = env.broadcasts.find((b) => b.msg.type === 'sf_fx' && b.msg.kind === 'monster_skill' && b.msg.skillId === 'sk_frost_nova');
  assert.ok(skillFx, 'sf_fx monster_skill broadcast emitted');
  assert.deepEqual(skillFx.msg.hitStates, rFrost.hitStates, 'sf_fx broadcast carries identical 0ms hitStates');
  assert.deepEqual(skillFx.msg.frozenIds, rFrost.frozenIds, 'sf_fx broadcast carries identical frozenIds');

  env.service.stopAll();
});
