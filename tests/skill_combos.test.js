// tests/skill_combos.test.js — Master Crafters Build-Craft Layer & Combo System test suite.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  STATUS_TAGS,
  STATUS_TAG_IDS,
  TIMED_TAG_IDS,
  tagActive,
  tagMask,
  decodeTagMask,
  applyTag,
  clearTag,
  extendTags,
  SKILL_ROLES,
  SKILL_TRAITS,
  SKILL_COMBO,
  ZONE_COMBO,
  REACTIONS,
  REACTION_IDS,
  REACTION_DMG_CAP,
  REACTION_DISCOVERY_DIAMONDS,
  RESONANCE,
  resolveReactions,
  reactionDamageMult,
  comboPartners,
  isPayoffAgainst,
  STUN_SKILLS,
  WEAPON_ECHO,
  weaponEchoFor,
  HIT3_PRIMES,
  MONSTER_PASSIVES,
  MONSTER_PASSIVE_IDS,
  PASSIVE_DROP_RATES,
  passiveBySource,
  passiveValue,
  passiveDescFor,
  rollMonsterPassiveDrop,
  activePassive,
  SKILL_SLOT_COUNT,
  PRESET_COUNT,
  PRESET_COMBAT_LOCK_MS,
  defaultFrontierSkills,
  normalizeFrontierSkills,
  SLOT_UNLOCK_RULES,
  masteredSpeciesCount,
  skillSlotUnlocks,
  ESSENCE,
  SCROLL_FLOOR_KILLS,
  essenceCraftCost,
  canEssenceCraft,
  MONSTER_ARCHETYPES,
  MONSTER_ARCHETYPE_BY_TYPE,
  archetypeOf,
  elementMult,
  isTagImmune,
  POISE,
  maxPoiseFor,
  poiseWire,
} from '../shared/skill_combos.js';

import {
  MONSTERS,
  BOSSES,
  MONSTER_SKILLS,
  MONSTER_SKILL_IDS,
  SKILL_DROP_RATES,
  skillCooldownMs,
  computeSkillNumbers,
  rollMonsterSkillDrop,
} from '../shared/combat_rules.js';

import { ACCESSORIES, COMBAT_CLASSES, resolveWeaponClass } from '../shared/catalog_gear_pets.js';
import { visibleSlotId, activeWeaponClass } from '../shared/accessory_attach.js';
import { computeUniversalStats, skyFrontierMods } from '../shared/universal_stats.js';
import { REGIONS } from '../shared/sky_frontier_rules.js';
import {
  defaultFrontier,
  createStarterProfile,
  defaultProfile,
  migrateProfile,
} from '../server/profile_factory.js';
import { migrateRpg, wardrobeEquip, wardrobeGlamour } from '../server/rpg_service.js';
import { createSkyFrontierService, COMBAT } from '../server/sky_frontier_service.js';

// Environment helpers (copied from tests/master_crafters_combat.test.js as specified)
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
    tags: {},
    burnDps: 0,
    burnBy: null,
    burnNextAt: 0,
    missUntil: 0,
    missPct: 0,
    wardHp: 0,
    wardUntil: 0,
    wardNextAt: 0,
    maxPoise: 0,
    poise: 0,
    breakUntil: 0,
    poiseHitAt: 0,
    ...(kind === 'boss' ? { stage: 0, ledger: {}, startedAt: 10_000_000, encounterUid: `enc_${id}` } : {}),
  };
  sh.live.monsters.set(id, mob);
  if (kind === 'boss') sh.live.bosses.set(regionId, id);
  return mob;
}

// =================================================================================================
// 1. Pure Module: tagMask / decodeTagMask roundtrip, applyTag, clearTag, extendTags
// =================================================================================================
test('1. Pure Module: STATUS_TAGS definition, tagActive, tagMask & decodeTagMask roundtrip, applyTag, clearTag & extendTags', () => {
  assert.equal(STATUS_TAG_IDS.length, 11);
  assert.equal(TIMED_TAG_IDS.length, 7);

  const now = 5000;
  const mob = {
    tags: {
      soaked: now + 4000,
      burning: now + 3000,
      chilled: now - 500, // expired
    },
    frozenUntil: now + 2000,
    stunUntil: 0,
    breakUntil: 0,
    wardUntil: now + 1000,
    wardHp: 50,
  };

  assert.equal(tagActive(mob, 'soaked', now), true);
  assert.equal(tagActive(mob, 'burning', now), true);
  assert.equal(tagActive(mob, 'chilled', now), false, 'Expired timed tag is not active');
  assert.equal(tagActive(mob, 'frozen', now), true, 'Derived frozen tag is active');
  assert.equal(tagActive(mob, 'stunned', now), false);
  assert.equal(tagActive(mob, 'broken', now), false);
  assert.equal(tagActive(mob, 'warded', now), true, 'Derived warded tag with positive wardHp is active');

  // tagMask bitmask roundtrip
  const mask = tagMask(mob, now);
  const expectedMask = STATUS_TAGS.soaked.bit | STATUS_TAGS.burning.bit | STATUS_TAGS.frozen.bit | STATUS_TAGS.warded.bit;
  assert.equal(mask, expectedMask, 'tagMask matches active tags bitwise OR');

  const decoded = decodeTagMask(mask);
  assert.deepEqual(decoded.sort(), ['burning', 'frozen', 'soaked', 'warded'].sort(), 'decodeTagMask roundtrip returns active tag IDs');
  assert.deepEqual(decodeTagMask(0), []);

  // applyTag on timed vs derived
  const tExp = applyTag(mob, 'shocked', now, 2500, 1.2);
  assert.equal(tExp, now + Math.round(2500 * 1.2));
  assert.equal(tagActive(mob, 'shocked', now), true);
  assert.equal(applyTag(mob, 'frozen', now), 0, 'applyTag on derived tag is rejected and returns 0');

  // clearTag
  clearTag(mob, 'soaked', now);
  assert.equal(tagActive(mob, 'soaked', now), false);
  mob.burnDps = 24;
  mob.burnBy = 'hero_1';
  clearTag(mob, 'burning', now);
  assert.equal(tagActive(mob, 'burning', now), false);
  assert.equal(mob.burnDps, 0);
  assert.equal(mob.burnBy, null);
  clearTag(mob, 'frozen', now);
  assert.equal(mob.frozenUntil, now, 'clearTag on frozen sets frozenUntil to now');

  // extendTags extends timed tags, frozenUntil, slowUntil by pct
  mob.tags.marked = now + 2000;
  mob.frozenUntil = now + 1000;
  mob.slowUntil = now + 1500;
  extendTags(mob, now, 0.5);
  assert.equal(mob.tags.marked, now + 3000, 'marked extended from 2000 remaining to 3000');
  assert.equal(mob.frozenUntil, now + 1500, 'frozen extended by 50%');
  assert.equal(mob.slowUntil, now + 2250, 'slow extended by 50%');
});

// =================================================================================================
// 2. Pure Module: resolveReactions for all 7 reactions, Scald directions, Exposed rules, and cap 2.5
// =================================================================================================
test('2. Pure Module: resolveReactions for all 7 reactions (both Scald directions, Exposed only for source skill, no self-combo), and reactionDamageMult cap 2.5', () => {
  const now = 10_000;

  // 1) Conduction (shock on soaked)
  const m1 = { tags: { soaked: now + 3000 } };
  const r1 = resolveReactions(m1, { traits: ['shock'], source: 'skill' }, now);
  assert.equal(r1.length, 1);
  assert.equal(r1[0].id, 'conduction');
  assert.equal(r1[0].dmgMult, 1.5);
  assert.equal(r1[0].stunMs, 1200);
  assert.equal(r1[0].extraBounces, 3);
  assert.deepEqual(r1[0].consume, ['soaked', 'shocked']);

  // 2) Deep Freeze (chill on soaked)
  const r2 = resolveReactions(m1, { traits: ['chill'], source: 'skill' }, now);
  assert.equal(r2.length, 1);
  assert.equal(r2[0].id, 'deep_freeze');
  assert.equal(r2[0].freezeMult, 2);

  // 3) Shatter (heavy on frozen)
  const mFrozen = { frozenUntil: now + 3000 };
  const r3 = resolveReactions(mFrozen, { traits: ['heavy'], source: 'skill' }, now);
  assert.equal(r3.length, 1);
  assert.equal(r3[0].id, 'shatter');
  assert.equal(r3[0].dmgMult, 1.6);
  assert.deepEqual(r3[0].consume, ['frozen']);

  // 4) Wildfire (wind on burning)
  const mBurn = { tags: { burning: now + 3000 } };
  const r4 = resolveReactions(mBurn, { traits: ['wind'], source: 'skill' }, now);
  assert.equal(r4.length, 1);
  assert.equal(r4[0].id, 'wildfire');
  assert.equal(r4[0].spreadRadius, 3.0);

  // 5) Scald — BOTH Directions
  // Direction A: trait 'fire' on tag 'soaked'
  const r5A = resolveReactions(m1, { traits: ['fire'], source: 'skill' }, now);
  assert.equal(r5A.length, 1);
  assert.equal(r5A[0].id, 'scald');
  assert.equal(r5A[0].missPct, 0.30);
  // Direction B: trait 'water' on tag 'burning'
  const r5B = resolveReactions(mBurn, { traits: ['water'], source: 'skill' }, now);
  assert.equal(r5B.length, 1);
  assert.equal(r5B[0].id, 'scald');

  // 6) Crush (ground on gathered)
  const mGather = { tags: { gathered: now + 2000 } };
  const r6 = resolveReactions(mGather, { traits: ['ground'], source: 'skill' }, now);
  assert.equal(r6.length, 1);
  assert.equal(r6[0].id, 'crush');
  assert.equal(r6[0].dmgMult, 1.4);

  // 7) Exposed (source 'skill' on stunned or staggered)
  const mStun = { stunUntil: now + 2000 };
  const mStag = { tags: { staggered: now + 2000 } };
  const r7Stun = resolveReactions(mStun, { traits: [], source: 'skill' }, now);
  assert.equal(r7Stun.length, 1);
  assert.equal(r7Stun[0].id, 'exposed');
  assert.equal(r7Stun[0].crit, true);

  const r7Stag = resolveReactions(mStag, { traits: [], source: 'skill' }, now);
  assert.equal(r7Stag.length, 1);
  assert.equal(r7Stag[0].id, 'exposed');

  // Exposed is ONLY for source 'skill' — basic attack finishers do not trigger Exposed
  const r7BasicStun = resolveReactions(mStun, { traits: [], source: 'basic' }, now);
  assert.equal(r7BasicStun.length, 0, 'Basic attacks must not trigger Exposed');
  const r7BasicStag = resolveReactions(mStag, { traits: [], source: 'basic' }, now);
  assert.equal(r7BasicStag.length, 0, 'Basic attacks must not trigger Exposed');

  // A skill never reacts with tags it hasn't applied yet (raw un-tagged mob yields 0 reactions)
  const mClean = { tags: {}, frozenUntil: 0, stunUntil: 0 };
  assert.deepEqual(resolveReactions(mClean, { traits: ['shock', 'fire', 'heavy'], source: 'skill' }, now), []);

  // reactionDamageMult capping at 2.5
  assert.equal(reactionDamageMult([]), 1);
  assert.equal(reactionDamageMult([REACTIONS.conduction]), 1.5);
  assert.equal(reactionDamageMult([REACTIONS.conduction, REACTIONS.scald]), 1.5 * 1.25);
  // Conduction (1.5) * Shatter (1.6) * Crush (1.4) = 3.36 -> capped at 2.5
  assert.equal(reactionDamageMult([REACTIONS.conduction, REACTIONS.shatter, REACTIONS.crush]), REACTION_DMG_CAP);
});

// =================================================================================================
// 3. Pure Module: weaponEchoFor per class, comboPartners, and isPayoffAgainst
// =================================================================================================
test('3. Pure Module: weaponEchoFor modifiers per class, comboPartners for sk_chain_lightning, and isPayoffAgainst tag mask', () => {
  // Melee echo: radiusMult 1.2 on self_aoe & sk_tusk_rush, appliesOnHit ['staggered']
  const meleeDrain = weaponEchoFor('sk_echo_drain', 'melee');
  assert.equal(meleeDrain.radiusMult, 1.2);
  assert.deepEqual(meleeDrain.appliesOnHit, ['staggered']);

  const meleeRush = weaponEchoFor('sk_tusk_rush', 'melee');
  assert.equal(meleeRush.radiusMult, 1.2);

  const meleePrism = weaponEchoFor('sk_prism_beam', 'melee');
  assert.equal(meleePrism.radiusMult, 1.0, 'Non-self-aoe does not receive melee radius boost');
  assert.deepEqual(meleePrism.appliesOnHit, ['staggered']);

  // Ranged echo: rangeMult 1.25, extraProjectiles 1 on cone/line/homing/chain; excludes sk_tusk_rush
  const rngFan = weaponEchoFor('sk_crystal_fan', 'ranged');
  assert.equal(rngFan.rangeMult, 1.25);
  assert.equal(rngFan.extraProjectiles, 1);

  const rngBeam = weaponEchoFor('sk_prism_beam', 'ranged');
  assert.equal(rngBeam.rangeMult, 1.25);
  assert.equal(rngBeam.extraProjectiles, 1);

  const rngFox = weaponEchoFor('sk_foxfire_wisps', 'ranged');
  assert.equal(rngFox.rangeMult, 1.25);
  assert.equal(rngFox.extraProjectiles, 1);

  const rngChain = weaponEchoFor('sk_chain_lightning', 'ranged');
  assert.equal(rngChain.rangeMult, 1.25);
  assert.equal(rngChain.extraProjectiles, 1);

  const rngRush = weaponEchoFor('sk_tusk_rush', 'ranged');
  assert.equal(rngRush.rangeMult, 1.0, 'sk_tusk_rush is excluded from ranged echo');
  assert.equal(rngRush.extraProjectiles, 0);

  // Magic echo: extraZoneTicks 1, tagDurMult 1.3
  const magKoi = weaponEchoFor('sk_koi_whirlpool', 'magic');
  assert.equal(magKoi.extraZoneTicks, 1);
  assert.equal(magKoi.tagDurMult, 1.3);

  // comboPartners for sk_chain_lightning returns conduction partners
  const partners = comboPartners('sk_chain_lightning');
  const condPayoffs = partners.filter((p) => p.reactionId === 'conduction' && p.direction === 'payoff');
  const payoffIds = condPayoffs.map((p) => p.skillId);
  assert.ok(payoffIds.includes('sk_koi_whirlpool'), 'sk_koi_whirlpool is a conduction setup partner for chain lightning');
  assert.ok(payoffIds.includes('sk_jelly_shield'), 'sk_jelly_shield is a conduction setup partner for chain lightning');
  assert.ok(payoffIds.includes('sk_mirror_shell'), 'sk_mirror_shell is a conduction setup partner for chain lightning');

  // isPayoffAgainst
  const soakedMask = STATUS_TAGS.soaked.bit;
  assert.equal(isPayoffAgainst('sk_chain_lightning', soakedMask), true, 'chain_lightning is payoff against soaked');
  assert.equal(isPayoffAgainst('sk_frost_nova', soakedMask), true, 'frost_nova is payoff against soaked');
  assert.equal(isPayoffAgainst('sk_tusk_rush', soakedMask), false, 'tusk_rush is not payoff against soaked');
});

// =================================================================================================
// 4. Pure Module: normalizeFrontierSkills, skillSlotUnlocks, canEssenceCraft, poiseWire & archetypes
// =================================================================================================
test('4. Pure Module: normalizeFrontierSkills migration, skillSlotUnlocks rules, canEssenceCraft validations, poiseWire values & archetype modifiers', () => {
  // normalizeFrontierSkills migrates legacy shape, removes bossPity, ensures 4 slots, 3 presets, essence
  const legacy = {
    unlocked: { sk_tusk_rush: 2 },
    equipped: ['sk_tusk_rush', null],
    bossPity: 5,
  };
  const norm = normalizeFrontierSkills(legacy);
  assert.equal(norm.bossPity, undefined, 'Legacy bossPity must be removed');
  assert.equal(norm.equipped.length, 4, 'equipped normalized to 4 slots');
  assert.deepEqual(norm.equipped, ['sk_tusk_rush', null, null, null]);
  assert.equal(norm.presets.length, 3, 'presets normalized to 3 slots');
  assert.deepEqual(norm.presets, [null, null, null]);
  assert.equal(norm.essence, 0);
  assert.deepEqual(norm.passives, {});
  assert.deepEqual(norm.reactionsFound, {});

  // null / empty input returns clean defaults
  const defs = normalizeFrontierSkills(null);
  assert.equal(defs.equipped.length, 4);
  assert.equal(defs.presets.length, 3);

  // skillSlotUnlocks rules
  const pLv1 = { level: 1, story: { chapter: 0, completed: [] }, frontier: { stats: { killsByMob: {} } } };
  assert.deepEqual(skillSlotUnlocks(pLv1), [true, true, false, false]);

  const pLv12 = { level: 12, story: { chapter: 0, completed: [] }, frontier: { stats: { killsByMob: {} } } };
  assert.deepEqual(skillSlotUnlocks(pLv12), [true, true, true, false]);

  const pStoryCh3 = { level: 1, story: { chapter: 3, completed: [] }, frontier: { stats: { killsByMob: {} } } };
  assert.deepEqual(skillSlotUnlocks(pStoryCh3), [true, true, true, false], 'Slot 2 unlocked by Story Chapter 3');

  const pStoryDone2 = { level: 1, story: { chapter: 1, completed: [2] }, frontier: { stats: { killsByMob: {} } } };
  assert.deepEqual(skillSlotUnlocks(pStoryDone2), [true, true, true, false], 'Slot 2 unlocked by completed chapter 2');

  const pLv25 = { level: 25, story: { chapter: 0, completed: [] }, frontier: { stats: { killsByMob: {} } } };
  assert.deepEqual(skillSlotUnlocks(pLv25), [true, true, true, true]);

  // Master 6 species (30 kills each) unlocks slot 4 even at Lv.1
  const masterKills = {
    thornback_boar: 30,
    moss_slime: 35,
    pollen_wisp: 40,
    crystal_beetle: 30,
    lantern_bat: 30,
    quartz_golemling: 30,
  };
  const pMaster = { level: 1, story: { chapter: 0, completed: [] }, frontier: { stats: { killsByMob: masterKills } } };
  assert.equal(masteredSpeciesCount(pMaster), 6);
  assert.deepEqual(skillSlotUnlocks(pMaster), [true, true, false, true], 'Slot 3 unlocked by mastering 6 species');

  // canEssenceCraft validations
  assert.equal(canEssenceCraft(pLv1, 'sk_nonexistent').error, 'unknown_skill');

  // Mob skill with < 10 kills -> codex_locked
  pLv1.frontier.stats.killsByMob.thornback_boar = 8;
  const cLocked = canEssenceCraft(pLv1, 'sk_tusk_rush');
  assert.equal(cLocked.ok, false);
  assert.equal(cLocked.error, 'codex_locked');
  assert.equal(cLocked.need, 10);
  assert.equal(cLocked.have, 8);

  // Boss skill (sk_earthshatter from elder_moss_golem) with < 1 kill -> codex_locked
  const cBossLocked = canEssenceCraft(pLv1, 'sk_earthshatter');
  assert.equal(cBossLocked.ok, false);
  assert.equal(cBossLocked.error, 'codex_locked');
  assert.equal(cBossLocked.need, 1);

  // Enough kills but not enough essence
  pLv1.frontier.stats.killsByMob.thornback_boar = 15;
  pLv1.frontier.skills = { unlocked: { sk_tusk_rush: 1 }, essence: 3 };
  const cNoEss = canEssenceCraft(pLv1, 'sk_tusk_rush');
  assert.equal(cNoEss.ok, false);
  assert.equal(cNoEss.error, 'not_enough_essence');
  assert.equal(cNoEss.need, 6);
  assert.equal(cNoEss.have, 3);

  // Skill maxed (level 5)
  pLv1.frontier.skills.unlocked.sk_tusk_rush = 5;
  pLv1.frontier.skills.essence = 20;
  assert.equal(canEssenceCraft(pLv1, 'sk_tusk_rush').error, 'maxed');

  // Passive maxed (level 3)
  pLv1.frontier.skills.passives = { ps_thick_hide: 3 };
  assert.equal(canEssenceCraft(pLv1, 'ps_thick_hide').error, 'maxed');

  // Successful craft verification
  pLv1.frontier.skills.unlocked.sk_tusk_rush = 2;
  const cOk = canEssenceCraft(pLv1, 'sk_tusk_rush');
  assert.equal(cOk.ok, true);
  assert.equal(cOk.cost, 6);
  assert.equal(cOk.kind, 'skill');

  // poiseWire values
  const nowT = 1000;
  assert.equal(poiseWire(null, nowT), null);
  assert.equal(poiseWire({ maxPoise: 0 }, nowT), null);
  assert.equal(poiseWire({ maxPoise: 100, poise: 75, breakUntil: 0 }, nowT), 75);
  assert.equal(poiseWire({ maxPoise: 60, poise: 0, breakUntil: nowT + 2000 }, nowT), -1, 'Broken poise wire returns -1');

  // archetypeOf & elementMult
  assert.equal(archetypeOf('quartz_golemling').archetype, 'armored');
  assert.equal(archetypeOf('quartz_golemling').def.maxPoise, 40);
  assert.equal(elementMult('crystal_beetle', ['fire']), 1.35, 'Fire against Chill elemental deals 1.35x');
  assert.equal(elementMult('crystal_beetle', ['chill']), 0.6, 'Chill against Chill elemental deals 0.6x');
  assert.equal(elementMult('crystal_beetle', ['wind']), 1.0);
  assert.equal(isTagImmune('crystal_beetle', 'chilled'), true);
});

// =================================================================================================
// 5. Server reactions end-to-end via sf_attack { skillSlot }
// =================================================================================================
test('5. Server reactions end-to-end: Conduction (1.5x + stun + extra bounces), Deep Freeze (2x freeze), Shatter (breaks freeze), Wildfire (3m spread), Exposed (guaranteed crit), and Reaction Discovery Diamonds', () => {
  const env = createCombatEnv({ initialNow: 10_000_000, rng: () => 0.42 });
  const instId = 'frontier:sf_react~meadow';
  const ws = { instanceId: instId };

  // Use starter wand (magic) so basic skills do not apply melee staggered echo
  const p = createStarterProfile('combo_master', '1234', 'bkk');
  p.diamonds = 0;
  migrateRpg(p);
  wardrobeEquip(p, { slot: 'gloves', itemId: 'gloves_starter_wand' });
  p.frontier.skills.unlocked = {
    sk_koi_whirlpool: 3,
    sk_chain_lightning: 3,
    sk_frost_nova: 3,
    sk_crystal_fan: 3,
    sk_solar_meteor: 3,
    sk_zephyr_vault: 3,
  };
  p.frontier.skills.equipped = ['sk_koi_whirlpool', 'sk_chain_lightning', null, null];
  env.profiles.set(p.id, p);
  env.instances.set(instId, new Set([p.id]));
  env.presence.set(p.id, { instanceId: instId, x: 0, z: 0, t: env.getTime() });

  const sh = env.service.loadShard('sf_react');
  env.service.handle(ws, p, { type: 'sf_state' });

  // 1) Conduction: koi_whirlpool (applies soaked) then chain_lightning -> conduction reaction, x1.5 dmg vs control, stun, bounces
  const mobA = spawnTestMob(sh, 'm_cond_a', 'moss_slime', 0, -3.0, { hp: 2000 });
  const mobB = spawnTestMob(sh, 'm_cond_b', 'moss_slime', 8.0, -3.0, { hp: 2000 }); // outside 4.6m koi zone
  const mobC = spawnTestMob(sh, 'm_cond_c', 'moss_slime', 16.0, -3.0, { hp: 2000 });

  // Cast koi_whirlpool at (0, -3) to apply soaked to mobA
  const rKoi = env.service.handle(ws, p, { type: 'sf_attack', skillSlot: 0, targetX: 0, targetZ: -3.0 });
  assert.equal(rKoi.ok, true);
  assert.equal(tagActive(mobA, 'soaked', env.getTime()), true, 'mobA is soaked by koi_whirlpool');

  // Control cast of chain_lightning on unsoaked mobC in fresh env with matching magic wand
  const envCtrl = createCombatEnv({ initialNow: 10_000_000, rng: () => 0.42 });
  const pCtrl = createStarterProfile('ctrl_hero', '1234', 'bkk');
  migrateRpg(pCtrl);
  wardrobeEquip(pCtrl, { slot: 'gloves', itemId: 'gloves_starter_wand' });
  pCtrl.frontier.skills.unlocked = { sk_chain_lightning: 3 };
  pCtrl.frontier.skills.equipped = ['sk_chain_lightning', null, null, null];
  envCtrl.profiles.set(pCtrl.id, pCtrl);
  envCtrl.instances.set(instId, new Set([pCtrl.id]));
  envCtrl.presence.set(pCtrl.id, { instanceId: instId, x: 0, z: 0, t: envCtrl.getTime() });
  const shCtrl = envCtrl.service.loadShard('sf_react');
  envCtrl.service.handle(ws, pCtrl, { type: 'sf_state' });
  const mobCtrl = spawnTestMob(shCtrl, 'm_ctrl', 'moss_slime', 0, -3.0, { hp: 2000 });
  const rCtrl = envCtrl.service.handle(ws, pCtrl, { type: 'sf_attack', skillSlot: 0, targetId: mobCtrl.id });
  const ctrlDmg = rCtrl.hits[0][1];

  // Cast chain_lightning on soaked mobA
  env.advanceTime(100);
  const rChain = env.service.handle(ws, p, { type: 'sf_attack', skillSlot: 1, targetId: mobA.id });
  assert.equal(rChain.ok, true);
  const condEntry = rChain.reactions.find((entry) => entry[1] === 'conduction');
  assert.ok(condEntry, 'Conduction reaction registered in rChain.reactions');
  const chainHitDmg = rChain.hits.find(([id]) => id === mobA.id)[1];
  assert.equal(chainHitDmg, Math.round(ctrlDmg * 1.5), 'Conduction deals exactly 1.5x base damage');
  assert.ok(mobA.stunUntil > env.getTime(), 'Conduction applies stun to the soaked target');
  assert.equal(tagActive(mobA, 'soaked', env.getTime()), false, 'Conduction consumed the soaked tag');

  // First reaction discovered grants 30 diamonds and emits reaction_discovered broadcast
  assert.equal(p.diamonds, 30, 'First reaction discovery grants +30 diamonds');
  const discoFx = env.broadcasts.find((b) => b.msg.type === 'sf_fx' && b.msg.kind === 'reaction_discovered' && b.msg.reactionId === 'conduction');
  assert.ok(discoFx, 'Broadcast reaction_discovered was emitted');
  assert.equal(p.frontier.skills.reactionsFound.conduction, 1);

  // Triggering conduction a 2nd time increments reactionsFound but grants no diamonds
  sh.live.monsters.delete(mobA.id);
  mobB.x = 0;
  mobB.z = -3.0;
  applyTag(mobB, 'soaked', env.getTime());
  const ps = sh.live.players.get(p.id);
  ps.skillCds[1] = 0; // reset cooldown for test
  env.broadcasts.length = 0;
  env.service.handle(ws, p, { type: 'sf_attack', skillSlot: 1, targetId: mobB.id });
  assert.equal(p.diamonds, 30, 'Second conduction trigger grants no additional diamonds');
  assert.equal(p.frontier.skills.reactionsFound.conduction, 2);
  const discoFx2 = env.broadcasts.find((b) => b.msg.type === 'sf_fx' && b.msg.kind === 'reaction_discovered');
  assert.equal(discoFx2, undefined, 'No reaction_discovered broadcast on 2nd trigger');

  // 2) Deep Freeze: frost_nova on soaked mob doubles freeze duration
  env.advanceTime(20_000);
  p.frontier.skills.equipped = ['sk_frost_nova', null, null, null];
  ps.skillCds = [0, 0, 0, 0];
  const mobDF = spawnTestMob(sh, 'm_df', 'moss_slime', 0, -2.5, { hp: 1000 });
  applyTag(mobDF, 'soaked', env.getTime());
  const rFrost = env.service.handle(ws, p, { type: 'sf_attack', skillSlot: 0 });
  assert.ok(rFrost.reactions.some((entry) => entry[1] === 'deep_freeze'), 'Deep freeze reaction triggered');
  // Normal freeze with magic wand (1.3x durMult) is 1600 * 1.3 = 2080, deep freeze doubles it to 4160ms
  const expectedFreeze = Math.round(1600 * 2 * 1.3);
  assert.equal(mobDF.frozenUntil, env.getTime() + expectedFreeze, 'Deep freeze doubles freeze duration');

  // 3) Shatter: frozen mob + crystal_fan or melee basic Hit-3 consumes freeze and deals +60% DMG
  env.advanceTime(20_000);
  p.frontier.skills.equipped = ['sk_crystal_fan', null, null, null];
  ps.skillCds = [0, 0, 0, 0];
  const mobShatter = spawnTestMob(sh, 'm_shatter', 'moss_slime', 0, -2.0, { hp: 1000 });
  mobShatter.frozenUntil = env.getTime() + 5000;
  assert.equal(tagActive(mobShatter, 'frozen', env.getTime()), true);
  const rShatter = env.service.handle(ws, p, { type: 'sf_attack', skillSlot: 0, targetId: mobShatter.id });
  assert.ok(rShatter.reactions.some((entry) => entry[1] === 'shatter'), 'Shatter reaction triggered');
  assert.equal(tagActive(mobShatter, 'frozen', env.getTime()), false, 'Shatter consumed frozen tag');

  // Shatter via melee basic Hit-3 finisher
  wardrobeEquip(p, { slot: 'gloves', itemId: 'gloves_starter_sword' });
  env.advanceTime(5000);
  const mobShatterBasic = spawnTestMob(sh, 'm_shatter_b', 'moss_slime', 0, -1.0, { hp: 1000 });
  mobShatterBasic.frozenUntil = env.getTime() + 5000;
  env.advanceTime(500);
  env.service.handle(ws, p, { type: 'sf_attack', targetId: mobShatterBasic.id, comboStep: 1 });
  env.advanceTime(500);
  env.service.handle(ws, p, { type: 'sf_attack', targetId: mobShatterBasic.id, comboStep: 2 });
  env.advanceTime(500);
  const rHit3 = env.service.handle(ws, p, { type: 'sf_attack', targetId: mobShatterBasic.id, comboStep: 3 });
  assert.ok(rHit3.reactions.some((entry) => entry[1] === 'shatter'), 'Melee basic Hit-3 triggered Shatter on frozen mob');
  assert.equal(tagActive(mobShatterBasic, 'frozen', env.getTime()), false, 'Melee basic Hit-3 consumed freeze');

  // 4) Wildfire: solar_meteor burning + zephyr_vault spreads fire to neighbours within 3m
  env.advanceTime(20_000);
  p.frontier.skills.equipped = ['sk_solar_meteor', 'sk_zephyr_vault', null, null];
  ps.skillCds = [0, 0, 0, 0];
  const mobBurn1 = spawnTestMob(sh, 'm_burn1', 'moss_slime', 0, -3.0, { hp: 1000 });

  env.service.handle(ws, p, { type: 'sf_attack', skillSlot: 0, targetX: 0, targetZ: -3.0 });
  assert.equal(tagActive(mobBurn1, 'burning', env.getTime()), true);

  // Spawn mobBurn2 (1.8m away < 3.0m) and mobFar (5.0m away > 3.0m) before casting wind payoff
  const mobBurn2 = spawnTestMob(sh, 'm_burn2', 'moss_slime', 1.8, -3.0, { hp: 1000 });
  const mobFar = spawnTestMob(sh, 'm_far', 'moss_slime', 5.0, -3.0, { hp: 1000 });
  assert.equal(tagActive(mobBurn2, 'burning', env.getTime()), false, 'mobBurn2 has no burning initially');

  env.advanceTime(100);
  const rWild = env.service.handle(ws, p, { type: 'sf_attack', skillSlot: 1, targetX: 0, targetZ: -3.0 });
  assert.ok(rWild.reactions.some((entry) => entry[1] === 'wildfire'), 'Wildfire reaction triggered');
  assert.equal(tagActive(mobBurn2, 'burning', env.getTime()), true, 'Wildfire spread burning to neighbor within 3m');
  assert.equal(tagActive(mobFar, 'burning', env.getTime()), false, 'Wildfire did not spread to mob 5m away');

  // 5) Exposed: stunned mob + skill yields guaranteed critical (hit tuple crit flag true)
  env.advanceTime(20_000);
  p.frontier.skills.equipped = ['sk_crystal_fan', null, null, null];
  ps.skillCds = [0, 0, 0, 0];
  const mobStun = spawnTestMob(sh, 'm_stunned', 'moss_slime', 0, -2.0, { hp: 1000 });
  mobStun.stunUntil = env.getTime() + 4000;
  // Ensure RNG would normally NOT crit (rng returns 0.99)
  env.setRng(() => 0.99);
  const rExp = env.service.handle(ws, p, { type: 'sf_attack', skillSlot: 0, targetId: mobStun.id });
  assert.ok(rExp.reactions.some((entry) => entry[1] === 'exposed'), 'Exposed reaction triggered');
  const stunHit = rExp.hits.find(([id]) => id === mobStun.id);
  assert.ok(stunHit, 'Hit registered on stunned mob');
  assert.equal(stunHit[2], true, 'Hit tuple crit flag is true via Exposed guaranteed critical');
});

// =================================================================================================
// 6. Burning DoT ticks via _tick every 1000ms & Marked damage modifier (+15%, no stack with star_brand)
// =================================================================================================
test('6. Burning DoT ticks via _tick every 1000ms and stops after expiry; marked tag gives +15% damage (and does NOT stack with star_brand vuln)', () => {
  const env = createCombatEnv({ initialNow: 10_000_000, rng: () => 0.99 });
  const instId = 'frontier:sf_burn~meadow';
  const ws = { instanceId: instId };

  const p = createStarterProfile('burn_tester', '1234', 'bkk');
  migrateRpg(p);
  wardrobeEquip(p, { slot: 'gloves', itemId: 'gloves_starter_sword' });
  env.profiles.set(p.id, p);
  env.instances.set(instId, new Set([p.id]));
  env.presence.set(p.id, { instanceId: instId, x: 0, z: 0, t: env.getTime() });

  const sh = env.service.loadShard('sf_burn');
  env.service.handle(ws, p, { type: 'sf_state' });

  // Burning DoT test with 4000ms standard duration
  const mob = spawnTestMob(sh, 'm_burn_dot', 'moss_slime', 0, -2.0, { hp: 500 });
  const startT = env.getTime();
  applyTag(mob, 'burning', startT, 4000); // 4000ms standard duration
  mob.burnDps = 25;
  mob.burnBy = p.id;
  mob.burnNextAt = startT + 1000;

  // Tick 1 (+1000ms)
  env.advanceTime(1000);
  env.service._tick('sf_burn', env.getTime());
  assert.equal(mob.hp, 475, 'HP reduced by burnDps 25 on 1st tick');

  // Tick 2 (+1000ms)
  env.advanceTime(1000);
  env.service._tick('sf_burn', env.getTime());
  assert.equal(mob.hp, 450, 'HP reduced by burnDps 25 on 2nd tick');

  // Tick 3 (+1000ms)
  env.advanceTime(1000);
  env.service._tick('sf_burn', env.getTime());
  assert.equal(mob.hp, 425, 'HP reduced by burnDps 25 on 3rd tick');

  // Tick 4 (+1000ms, at 4000ms expiry)
  env.advanceTime(1000);
  env.service._tick('sf_burn', env.getTime());
  assert.equal(mob.hp, 425, 'No damage dealt after burning tag expired');
  assert.equal(mob.burnDps, 0);
  assert.equal(mob.burnBy, null);

  // Marked tag +15% damage vs Star-Brand Vuln non-stacking
  const mPlain = spawnTestMob(sh, 'm_plain', 'moss_slime', 0, -1.0, { hp: 1000 });
  const mMarked = spawnTestMob(sh, 'm_marked', 'moss_slime', 0, -1.0, { hp: 1000 });
  const mBoth = spawnTestMob(sh, 'm_both', 'moss_slime', 0, -1.0, { hp: 1000 });

  applyTag(mMarked, 'marked', env.getTime(), 5000);

  // Set star_brand vuln (25%) AND marked tag (15%) on mBoth
  mBoth.vulnUntil = env.getTime() + 5000;
  mBoth.vulnPct = 0.25;
  applyTag(mBoth, 'marked', env.getTime(), 5000);

  // Attack plain mob
  env.advanceTime(1000);
  const rPlain = env.service.handle(ws, p, { type: 'sf_attack', targetId: mPlain.id, comboStep: 1 });
  const plainDmg = rPlain.hits[0][1];

  // Attack marked mob
  env.advanceTime(1000);
  const rMarked = env.service.handle(ws, p, { type: 'sf_attack', targetId: mMarked.id, comboStep: 1 });
  const markedDmg = rMarked.hits[0][1];
  assert.equal(markedDmg, Math.round(plainDmg * 1.15), 'Marked tag increases damage taken by 15%');

  // Attack both (vuln + marked) mob
  env.advanceTime(1000);
  const rBoth = env.service.handle(ws, p, { type: 'sf_attack', targetId: mBoth.id, comboStep: 1 });
  const bothDmg = rBoth.hits[0][1];
  assert.equal(bothDmg, Math.round(plainDmg * 1.25), 'Star-Brand vuln (+25%) overrides Marked (+15%) without stacking to +40%');
});

// =================================================================================================
// 7. Guard / Poise: Armored mobs, Boss/Elite Guard Break, Telegraph Clear & Restoration
// =================================================================================================
test('7. Guard/poise: boss & forced Alpha elite spawn maxPoise 100/60; armored (quartz_golemling) takes -45% until poise broken; guard_break broadcast, breakUntil +50% dmg, telegraph cleared, restored after expiry', () => {
  const env = createCombatEnv({ initialNow: 10_000_000, rng: () => 0.5 });
  const instId = 'frontier:sf_poise~meadow';
  const ws = { instanceId: instId };

  const p = createStarterProfile('poise_slayer', '1234', 'bkk');
  migrateRpg(p);
  wardrobeEquip(p, { slot: 'gloves', itemId: 'gloves_starter_sword' });
  env.profiles.set(p.id, p);
  env.instances.set(instId, new Set([p.id]));
  env.presence.set(p.id, { instanceId: instId, x: 0, z: 0, t: env.getTime() });

  const sh = env.service.loadShard('sf_poise');
  env.service.handle(ws, p, { type: 'sf_state' });

  // 1) Spawn validations: Boss elder_moss_golem (100), Forced Alpha Elite (60), Armored Mob (40)
  const boss = env.service._spawnMonster(sh, 'meadow', 'elder_moss_golem', 'boss', 10.0, 10.0, { boss: BOSSES.elder_moss_golem });
  sh.live.bosses.set('meadow', boss.id);
  assert.equal(boss.maxPoise, 100);
  assert.equal(boss.poise, 100);

  const elite = env.service._spawnMonster(sh, 'meadow', 'moss_slime', 'ambient', 0, -1.0, { forceElite: true });
  assert.equal(elite.maxPoise, 60);
  assert.equal(elite.poise, 60);

  const armored = env.service._spawnMonster(sh, 'meadow', 'quartz_golemling', 'ambient', 0, -1.0);
  assert.equal(armored.maxPoise, 40);
  assert.equal(armored.poise, 40);

  // 2) Armored archetype takes -45% damage while Guard is intact
  const plainMob = spawnTestMob(sh, 'm_plain_ref', 'moss_slime', 0, -1.0, { hp: 1000 });
  env.advanceTime(1000);
  const rPlain = env.service.handle(ws, p, { type: 'sf_attack', targetId: plainMob.id, comboStep: 1 });
  const plainDmg = rPlain.hits[0][1];

  env.advanceTime(1000);
  const rArmored = env.service.handle(ws, p, { type: 'sf_attack', targetId: armored.id, comboStep: 1 });
  const armoredDmg = rArmored.hits[0][1];
  assert.equal(armoredDmg, Math.round(plainDmg * 0.55), 'Armored mob takes exactly 55% damage (45% reduction) with Guard intact');

  // 3) Breaking Guard on Elite: Elite has 60 maxPoise
  p.frontier.skills.unlocked = { sk_tusk_rush: 1 };
  p.frontier.skills.equipped = ['sk_tusk_rush', null, null, null];

  // Set an active Alpha Elite telegraph on the elite mob
  elite.telegraph = {
    skillId: 'sk_earthshatter',
    targetX: 0, targetZ: 0, facing: { x: 0, z: -1 }, radius: 3.4, fireAt: env.getTime() + 5000,
  };
  assert.ok(elite.telegraph);

  // Cast sk_tusk_rush on a pre-chipped elite (50/60): chips 51 poise (4 skill + 12 heavy + 10 stagger [deduped with Melee Echo] + 25 stun), breaking Guard
  elite.poise = 50;
  env.broadcasts.length = 0;
  env.advanceTime(1000);
  const rRush1 = env.service.handle(ws, p, { type: 'sf_attack', skillSlot: 0, targetId: elite.id });
  assert.equal(rRush1.ok, true);
  assert.equal(elite.poise, 0, 'Elite poise reduced to 0');
  assert.ok(elite.breakUntil > env.getTime(), 'breakUntil is set on elite');
  assert.equal(elite.telegraph, null, 'Telegraph was cancelled on Guard break');

  // Guard break broadcast
  const breakBcast = env.broadcasts.find((b) => b.msg.type === 'sf_fx' && b.msg.kind === 'guard_break' && b.msg.id === elite.id);
  assert.ok(breakBcast, 'guard_break broadcast emitted');
  assert.equal(breakBcast.msg.breakUntil, elite.breakUntil);

  // Broken mob takes +50% bonus damage (step up to mob after rush dash)
  env.presence.get(p.id).z = elite.z + 1.0;
  env.advanceTime(1000);
  const rBroken = env.service.handle(ws, p, { type: 'sf_attack', targetId: elite.id, comboStep: 1 });
  assert.equal(rBroken.ok, true);
  const brokenDmg = rBroken.hits[0][1];
  assert.equal(brokenDmg, Math.round(plainDmg * 1.50), 'Broken mob takes 150% damage (+50% bonus)');

  // Wire representation reflects broken Guard (-1)
  assert.equal(poiseWire(elite, env.getTime()), -1);

  // bossWire carries poise / maxPoise / breakUntil
  const layout = env.service.layoutPayload(ws.instanceId);
  assert.ok(layout.boss, 'layoutPayload returns bossWire');
  assert.equal(layout.boss.poise, 100);
  assert.equal(layout.boss.maxPoise, 100);
  assert.equal(layout.boss.breakUntil, 0);

  // Restoration after breakUntil expires
  env.setTime(elite.breakUntil + 10);
  env.service._tick('sf_poise', env.getTime());
  assert.equal(elite.breakUntil, 0);
  assert.equal(elite.poise, elite.maxPoise, 'Poise restored to maxPoise once break window expires');
  assert.equal(poiseWire(elite, env.getTime()), 100);
});

// =================================================================================================
// 8. Archetypes in _tick: Support (mob_ward), Kiter (retreat), Swarm (pack DMG), and Scald Miss
// =================================================================================================
test('8. Monster archetypes in _tick: support (reef_bell_spirit) wards nearby allies, kiter (reef_cloud_crane) retreats, swarm (lantern_bat) deals bonus pack damage, and scald missPct whiffs attacks', () => {
  const env = createCombatEnv({ initialNow: 10_000_000, rng: () => 0.5 });
  const instId = 'frontier:sf_arch~reef';
  const ws = { instanceId: instId };

  const p = createStarterProfile('arch_hero', '1234', 'bkk');
  migrateRpg(p);
  wardrobeEquip(p, { slot: 'gloves', itemId: 'gloves_starter_sword' });
  env.profiles.set(p.id, p);
  env.instances.set(instId, new Set([p.id]));
  env.presence.set(p.id, { instanceId: instId, x: 0, z: 0, t: env.getTime() });

  const sh = env.service.loadShard('sf_arch');
  env.service.handle(ws, p, { type: 'sf_state' });

  // 1) Support (reef_bell_spirit): wards nearby allies
  const spirit = env.service._spawnMonster(sh, 'reef', 'reef_bell_spirit', 'ambient', 0, 1.0);
  const snapper = env.service._spawnMonster(sh, 'reef', 'reef_pearl_snapper', 'ambient', 1.0, 1.0);
  spirit.provokedUntil = env.getTime() + 10_000;
  spirit.targetId = p.id;
  spirit.wardNextAt = 0; // ready to ward

  env.broadcasts.length = 0;
  env.service._tick('sf_arch', env.getTime());
  const wardFx = env.broadcasts.find((b) => b.msg.type === 'sf_fx' && b.msg.kind === 'mob_ward' && b.msg.id === spirit.id);
  assert.ok(wardFx, 'Support spirit cast mob_ward on nearby ally');
  assert.ok(snapper.wardHp > 0, 'Snapper ally received wardHp shield');
  assert.ok(snapper.wardUntil > env.getTime(), 'Snapper ally received wardUntil timestamp');

  // Ward absorbs incoming damage before mob HP drops
  const snapHpBefore = snapper.hp;
  const initialWard = snapper.wardHp;
  env.advanceTime(1000);
  env.service.handle(ws, p, { type: 'sf_attack', targetId: snapper.id, comboStep: 1 });
  assert.equal(snapper.hp, snapHpBefore, 'Mob HP did not decrease; ward absorbed the attack damage');
  assert.ok(snapper.wardHp < initialWard, 'wardHp absorbed the damage');

  // 2) Kiter (reef_cloud_crane): moves away from a close provoked player
  const crane = env.service._spawnMonster(sh, 'reef', 'reef_cloud_crane', 'ambient', 0, 1.0);
  crane.homeX = 0;
  crane.homeZ = 0;
  crane.provokedUntil = env.getTime() + 10_000;
  crane.targetId = p.id; // player is at (0, 0), crane is at (0, 1.0), distance = 1.0 < keepAway (4.2m)

  const zBefore = crane.z;
  env.advanceTime(200);
  env.service._tick('sf_arch', env.getTime());
  assert.ok(crane.z > zBefore, 'Kiter crane backed away from close player (z coordinate increased away from player at 0)');

  // 3) Swarm (lantern_bat): hits harder with packmates nearby (+10% per ally, max +40%)
  sh.live.monsters.clear();
  const bat1 = env.service._spawnMonster(sh, 'reef', 'lantern_bat', 'ambient', 0, 0.5);
  bat1.targetId = p.id;
  bat1.atkCdUntil = 0;

  const ps = sh.live.players.get(p.id);
  ps.hp = ps.maxHp;
  env.service._tick('sf_arch', env.getTime());
  const dmgSingle = ps.maxHp - ps.hp;
  assert.equal(dmgSingle, bat1.dmg, 'Single bat deals base damage');

  // Now spawn 2 packmates within 4m
  const bat2 = env.service._spawnMonster(sh, 'reef', 'lantern_bat', 'ambient', 0.5, 0.5);
  const bat3 = env.service._spawnMonster(sh, 'reef', 'lantern_bat', 'ambient', -0.5, 0.5);
  bat2.atkCdUntil = env.getTime() + 99999;
  bat3.atkCdUntil = env.getTime() + 99999;
  bat1.atkCdUntil = 0;
  ps.hp = ps.maxHp;
  env.advanceTime(COMBAT.MONSTER_ATK_CD_MS + 10);
  env.service._tick('sf_arch', env.getTime());
  const dmgSwarm = ps.maxHp - ps.hp;
  assert.ok(dmgSwarm > dmgSingle, 'Swarm bat deals more damage when packmates are nearby');
  assert.equal(dmgSwarm, Math.round(bat1.dmg * 1.20), 'Swarm bonus gives +20% damage for 2 nearby allies');

  // 4) Scald miss: missPct makes monster attack whiff
  bat1.missUntil = env.getTime() + 4000;
  bat1.missPct = 0.30;
  bat1.atkCdUntil = 0;
  ps.hp = ps.maxHp;

  // Force RNG < 0.30 so the attack whiffs
  env.setRng(() => 0.10);
  env.service._tick('sf_arch', env.getTime());
  assert.equal(ps.hp, ps.maxHp, 'Monster attack whiffed due to Scald steam missPct');

  // Force RNG > 0.30 so the attack lands
  bat1.atkCdUntil = 0;
  env.setRng(() => 0.50);
  env.service._tick('sf_arch', env.getTime());
  assert.ok(ps.hp < ps.maxHp, 'Monster attack landed when RNG exceeded missPct');
});

// =================================================================================================
// 9. Slots & Loadouts: Slot 2 Gating, Cooldowns, time_dilation refund, Presets & Passive Equip
// =================================================================================================
test('9. Slots & loadouts: slot 2 rejected with slot_locked at Lv.1 & accepted at Lv.12, locked cast rejected, slot swapping, 4-length cds, time_dilation refund 2.5s on all other slots, presets & passive_equip', () => {
  const env = createCombatEnv({ initialNow: 10_000_000, rng: () => 0.5 });
  const instId = 'frontier:sf_slots~meadow';
  const ws = { instanceId: instId };

  const p = createStarterProfile('slot_hero', '1234', 'bkk');
  migrateRpg(p);
  wardrobeEquip(p, { slot: 'gloves', itemId: 'gloves_starter_sword' });
  p.frontier.skills.unlocked = {
    sk_tusk_rush: 2,
    sk_jelly_shield: 2,
    sk_crystal_fan: 2,
    sk_time_dilation: 2,
  };
  env.profiles.set(p.id, p);
  env.instances.set(instId, new Set([p.id]));
  env.presence.set(p.id, { instanceId: instId, x: 0, z: 0, t: env.getTime() });

  const sh = env.service.loadShard('sf_slots');
  env.service.handle(ws, p, { type: 'sf_state' });

  // 1) Equip slot 2 rejected at Lv.1
  const rEqLv1 = env.service.handle(ws, p, { type: 'sf_pouch_set', skillAction: 'equip', slot: 2, skillId: 'sk_crystal_fan' });
  assert.equal(rEqLv1.ok, false);
  assert.equal(rEqLv1.error, 'slot_locked');
  assert.equal(rEqLv1.slot, 2);

  // Accepted at Lv.12
  p.level = 12;
  const rEqLv12 = env.service.handle(ws, p, { type: 'sf_pouch_set', skillAction: 'equip', slot: 2, skillId: 'sk_crystal_fan' });
  assert.equal(rEqLv12.ok, true);
  assert.equal(p.frontier.skills.equipped[2], 'sk_crystal_fan');

  // 2) Casting from locked slot 3 rejected
  const rCastLocked = env.service.handle(ws, p, { type: 'sf_attack', skillSlot: 3 });
  assert.equal(rCastLocked.ok, false);
  assert.equal(rCastLocked.error, 'slot_locked');

  // 3) Equipping a skill already in another slot swaps it
  env.service.handle(ws, p, { type: 'sf_pouch_set', skillAction: 'equip', slot: 0, skillId: 'sk_tusk_rush' });
  env.service.handle(ws, p, { type: 'sf_pouch_set', skillAction: 'equip', slot: 1, skillId: 'sk_jelly_shield' });
  assert.equal(p.frontier.skills.equipped[0], 'sk_tusk_rush');
  assert.equal(p.frontier.skills.equipped[1], 'sk_jelly_shield');

  // Swap by equipping sk_tusk_rush into slot 1
  env.service.handle(ws, p, { type: 'sf_pouch_set', skillAction: 'equip', slot: 1, skillId: 'sk_tusk_rush' });
  assert.equal(p.frontier.skills.equipped[1], 'sk_tusk_rush', 'Slot 1 now has sk_tusk_rush');
  assert.equal(p.frontier.skills.equipped[0], 'sk_jelly_shield', 'Slot 0 swapped to sk_jelly_shield');

  // 4) skillCds has length 4
  const ps = sh.live.players.get(p.id);
  assert.equal(ps.skillCds.length, 4);

  // 5) time_dilation refunds 2.5s on ALL other slots
  p.level = 25; // unlock slot 3
  env.service.handle(ws, p, { type: 'sf_pouch_set', skillAction: 'equip', slot: 3, skillId: 'sk_time_dilation' });
  ps.skillCds[0] = env.getTime() + 5000;
  ps.skillCds[1] = env.getTime() + 6000;
  ps.skillCds[2] = env.getTime() + 4000;

  spawnTestMob(sh, 'm_td', 'moss_slime', 0, -2.0);
  const rTD = env.service.handle(ws, p, { type: 'sf_attack', skillSlot: 3 });
  assert.equal(rTD.ok, true);
  assert.equal(ps.skillCds[0], env.getTime() + 2500, 'Slot 0 cooldown refunded by 2.5s');
  assert.equal(ps.skillCds[1], env.getTime() + 3500, 'Slot 1 cooldown refunded by 2.5s');
  assert.equal(ps.skillCds[2], env.getTime() + 1500, 'Slot 2 cooldown refunded by 2.5s');

  // 6) Presets: save, in_combat lock, empty rejection & load roundtrip
  p.frontier.skills.passives = { ps_thick_hide: 1 };
  p.frontier.skills.passive = 'ps_thick_hide';
  const rSave = env.service.handle(ws, p, { type: 'sf_pouch_set', skillAction: 'preset_save', preset: 0, name: 'BossFarm' });
  assert.equal(rSave.ok, true);
  assert.equal(p.frontier.skills.presets[0].name, 'BossFarm');
  assert.deepEqual(p.frontier.skills.presets[0].equipped, p.frontier.skills.equipped);

  // Attempt preset_load on empty preset 1
  const rEmpty = env.service.handle(ws, p, { type: 'sf_pouch_set', skillAction: 'preset_load', preset: 1 });
  assert.equal(rEmpty.ok, false);
  assert.equal(rEmpty.error, 'empty_preset');

  // Simulate in-combat state (within 4000ms of attack)
  ps.lastAttackAt = env.getTime() - 1000;
  const rInCombat = env.service.handle(ws, p, { type: 'sf_pouch_set', skillAction: 'preset_load', preset: 0 });
  assert.equal(rInCombat.ok, false);
  assert.equal(rInCombat.error, 'in_combat');

  // Out of combat: preset_load succeeds and restores loadout
  env.advanceTime(5000);
  p.frontier.skills.equipped = [null, null, null, null];
  p.frontier.skills.passive = null;
  const rLoad = env.service.handle(ws, p, { type: 'sf_pouch_set', skillAction: 'preset_load', preset: 0 });
  assert.equal(rLoad.ok, true);
  assert.equal(p.frontier.skills.equipped[1], 'sk_tusk_rush');
  assert.equal(p.frontier.skills.passive, 'ps_thick_hide');

  // 7) passive_equip rejects un-owned passive
  const rPassUnowned = env.service.handle(ws, p, { type: 'sf_pouch_set', skillAction: 'passive_equip', passiveId: 'ps_bloodthirst' });
  assert.equal(rPassUnowned.ok, false);
  assert.equal(rPassUnowned.error, 'passive_locked');

  // Accepts owned passive
  const rPassOwned = env.service.handle(ws, p, { type: 'sf_pouch_set', skillAction: 'passive_equip', passiveId: 'ps_thick_hide' });
  assert.equal(rPassOwned.ok, true);
  assert.equal(p.frontier.skills.passive, 'ps_thick_hide');
});

// =================================================================================================
// 10. Weapon Echo: Melee Radius Boost (1.15x), Magic Extra Zone Tick, and Ranged Extra Projectiles
// =================================================================================================
test('10. Weapon Echo: melee glamour hits at 1.15x base radius that magic misses, magic koi zone lasts 1 extra tick, and ranged foxfire fires 4 orbs', () => {
  const env = createCombatEnv({ initialNow: 10_000_000, rng: () => 0.5 });
  const instId = 'frontier:sf_echo~meadow';
  const ws = { instanceId: instId };

  const p = createStarterProfile('echo_hero', '1234', 'bkk');
  migrateRpg(p);
  p.frontier.skills.unlocked = {
    sk_echo_drain: 3,
    sk_koi_whirlpool: 3,
    sk_foxfire_wisps: 3,
  };
  p.frontier.skills.equipped = ['sk_echo_drain', 'sk_koi_whirlpool', 'sk_foxfire_wisps', null];
  p.level = 20;
  env.profiles.set(p.id, p);
  env.instances.set(instId, new Set([p.id]));
  env.presence.set(p.id, { instanceId: instId, x: 0, z: 0, t: env.getTime() });

  const sh = env.service.loadShard('sf_echo');
  env.service.handle(ws, p, { type: 'sf_state' });

  // 1) Melee glamour self-AoE +20% radius:
  // sk_echo_drain base radius = 3.8. 1.15x = 4.37.
  // Mob at dist = 4.37 is within melee radius (3.8 * 1.2 = 4.56), but outside magic radius (3.8 * 1.0 = 3.8).
  const mobBorder = spawnTestMob(sh, 'm_border', 'moss_slime', 0, -4.37, { hp: 1000 });

  // Equip magic wand -> misses mobBorder
  wardrobeGlamour(p, { slot: 'gloves', itemId: 'gloves_starter_wand' });
  assert.equal(activeWeaponClass(p.equipped, p.glamour), 'magic');
  const ps = sh.live.players.get(p.id);
  ps.skillCds = [0, 0, 0, 0];
  const rMagicDrain = env.service.handle(ws, p, { type: 'sf_attack', skillSlot: 0 });
  assert.equal(rMagicDrain.hits.length, 0, 'Magic caster misses mob placed at 1.15x base radius');

  // Equip melee sword -> hits mobBorder
  wardrobeGlamour(p, { slot: 'gloves', itemId: 'gloves_starter_sword' });
  assert.equal(activeWeaponClass(p.equipped, p.glamour), 'melee');
  ps.skillCds = [0, 0, 0, 0];
  const rMeleeDrain = env.service.handle(ws, p, { type: 'sf_attack', skillSlot: 0 });
  assert.equal(rMeleeDrain.hits.length, 1, 'Melee caster hits mob placed at 1.15x base radius (+20% radius echo)');

  // 2) Magic koi zone lasts one extra tick
  // Cast with melee -> endsAt is t + 4000
  ps.skillCds = [0, 0, 0, 0];
  env.service.handle(ws, p, { type: 'sf_attack', skillSlot: 1, targetX: 0, targetZ: -2.0 });
  const meleeZone = sh.live.regions.get('meadow').skillZones[0];
  const meleeDuration = meleeZone.endsAt - env.getTime();
  assert.equal(meleeDuration, 4000, 'Non-magic koi zone lasts 4000ms');

  // Clear zones and cast with magic wand -> endsAt is t + 5000 (extraZoneTicks: 1)
  sh.live.regions.get('meadow').skillZones = [];
  wardrobeGlamour(p, { slot: 'gloves', itemId: 'gloves_starter_wand' });
  ps.skillCds = [0, 0, 0, 0];
  env.service.handle(ws, p, { type: 'sf_attack', skillSlot: 1, targetX: 0, targetZ: -2.0 });
  const magicZone = sh.live.regions.get('meadow').skillZones[0];
  const magicDuration = magicZone.endsAt - env.getTime();
  assert.equal(magicDuration, 5000, 'Magic koi zone lasts 5000ms (+1000ms extra tick duration)');

  // 3) Ranged foxfire fires 4 orbs (vs 3 base)
  sh.live.monsters.delete(mobBorder.id);
  spawnTestMob(sh, 'm_big', 'moss_slime', 0, -3.0, { hp: 5000 });

  // With melee glamour: fires 3 orbs
  wardrobeGlamour(p, { slot: 'gloves', itemId: 'gloves_starter_sword' });
  ps.skillCds = [0, 0, 0, 0];
  const rMeleeFox = env.service.handle(ws, p, { type: 'sf_attack', skillSlot: 2 });
  assert.equal(rMeleeFox.hits.length, 3, 'Melee caster fires 3 foxfire orbs');

  // With ranged glamour: fires 4 orbs
  wardrobeGlamour(p, { slot: 'gloves', itemId: 'gloves_starter_shortbow' });
  ps.skillCds = [0, 0, 0, 0];
  const rRangedFox = env.service.handle(ws, p, { type: 'sf_attack', skillSlot: 2 });
  assert.equal(rRangedFox.hits.length, 4, 'Ranged caster fires 4 foxfire orbs (+1 extra projectile)');
});

// =================================================================================================
// 11. Monster Passives in Action
// =================================================================================================
test('11. Passives: thick_hide reduces mob damage, gel_regen boosts tickPlayers regen, star_sight raises crit, foxfire_trail Hit-3 burns, static_core shocks & triggers conduction, and tide_blessing increases shieldHp', () => {
  const env = createCombatEnv({ initialNow: 10_000_000, rng: () => 0.5 });
  const instId = 'frontier:sf_pas~meadow';
  const ws = { instanceId: instId };

  const p = createStarterProfile('pas_hero', '1234', 'bkk');
  migrateRpg(p);
  wardrobeEquip(p, { slot: 'gloves', itemId: 'gloves_starter_sword' });
  p.frontier.skills.passives = {
    ps_thick_hide: 1, // 6%
    ps_gel_regen: 1, // +0.6 HP/s
    ps_star_sight: 1, // +4% crit
    ps_foxfire_trail: 1, // 2000ms burn on hit3
    ps_static_core: 1, // 12% shock
    ps_tide_blessing: 1, // +10% shield
  };
  p.frontier.skills.unlocked = { sk_jelly_shield: 2 };
  p.frontier.skills.equipped = ['sk_jelly_shield', null, null, null];
  env.profiles.set(p.id, p);
  env.instances.set(instId, new Set([p.id]));
  env.presence.set(p.id, { instanceId: instId, x: 0, z: 0, t: env.getTime() });

  const sh = env.service.loadShard('sf_pas');
  env.service.handle(ws, p, { type: 'sf_state' });
  const ps = sh.live.players.get(p.id);

  // 1) ps_thick_hide reduces monster damage (Lv.1 = 6%)
  p.frontier.skills.passive = null;
  ps.hp = ps.maxHp;
  const mob = spawnTestMob(sh, 'm_pas_test', 'moss_slime', 0, 0.5, { dmg: 50 });
  mob.targetId = p.id;
  mob.atkCdUntil = 0;
  env.service._tick('sf_pas', env.getTime());
  const unreduced = ps.maxHp - ps.hp;

  p.frontier.skills.passive = 'ps_thick_hide';
  ps.hp = ps.maxHp;
  mob.atkCdUntil = 0;
  env.service._tick('sf_pas', env.getTime());
  const reduced = ps.maxHp - ps.hp;
  assert.equal(reduced, Math.round(unreduced * 0.94), 'thick_hide reduced damage by 6%');

  // 2) ps_gel_regen adds regen in tickPlayers
  p.frontier.skills.passive = 'ps_gel_regen';
  ps.hp = ps.maxHp - 50;
  ps.lastRegenAt = 0;
  ps.lastHitAt = 0;
  env.advanceTime(1000);
  env.service._tick('sf_pas', env.getTime());
  // Base 0.6 + passive 0.6 = 1.2 HP/s -> vitalityFrac gains 1.2, whole=1 added to hp
  assert.ok(ps.hp > ps.maxHp - 50, 'gel_regen increased player HP in tickPlayers');

  // 3) ps_star_sight raises crit chance
  p.frontier.skills.passive = 'ps_star_sight';
  // With ps_star_sight (+0.04), crit chance is 0.164 (base 0.124 + 0.04)
  // Force rng to 0.14 -> without passive this is a non-crit (0.14 >= 0.124), with passive it is a crit (0.14 < 0.164)
  env.setRng(() => 0.14);
  env.advanceTime(1000);
  const rCritWith = env.service.handle(ws, p, { type: 'sf_attack', targetId: mob.id, comboStep: 1 });
  assert.equal(rCritWith.crit, true, 'RNG 0.14 critically strikes due to star_sight +4% crit chance');

  p.frontier.skills.passive = null;
  env.advanceTime(rCritWith.cooldownMs + 10);
  const rCritWithout = env.service.handle(ws, p, { type: 'sf_attack', targetId: mob.id, comboStep: 1 });
  assert.equal(rCritWithout.crit, false, 'RNG 0.14 does not crit without star_sight');

  // 4) ps_foxfire_trail applies burning on basic Hit-3
  p.frontier.skills.passive = 'ps_foxfire_trail';
  const mobBurn = spawnTestMob(sh, 'm_pas_burn', 'moss_slime', 0, -1.0, { hp: 1000 });
  env.advanceTime(1000);
  env.service.handle(ws, p, { type: 'sf_attack', targetId: mobBurn.id, comboStep: 1 });
  env.advanceTime(1000);
  env.service.handle(ws, p, { type: 'sf_attack', targetId: mobBurn.id, comboStep: 2 });
  assert.equal(tagActive(mobBurn, 'burning', env.getTime()), false, 'Hits 1 and 2 do not apply burning');

  env.advanceTime(1000);
  env.service.handle(ws, p, { type: 'sf_attack', targetId: mobBurn.id, comboStep: 3 });
  assert.equal(tagActive(mobBurn, 'burning', env.getTime()), true, 'foxfire_trail Hit-3 applied burning to target');

  // 5) ps_static_core shock chance triggers conduction on a soaked target
  p.frontier.skills.passive = 'ps_static_core';
  const mobShock = spawnTestMob(sh, 'm_pas_shock', 'moss_slime', 0, -1.0, { hp: 1000 });
  applyTag(mobShock, 'soaked', env.getTime());
  // Force rng < 0.12 so shock procs
  env.setRng(() => 0.05);
  env.advanceTime(1000);
  const rShockAtk = env.service.handle(ws, p, { type: 'sf_attack', targetId: mobShock.id, comboStep: 1 });
  assert.ok(rShockAtk.reactions.some((entry) => entry[1] === 'conduction'), 'static_core shock proc triggered Conduction on soaked mob');

  // 6) ps_tide_blessing increases jelly_shield shieldHp by 10%
  p.frontier.skills.passive = null;
  ps.skillCds[0] = 0;
  const rShieldBase = env.service.handle(ws, p, { type: 'sf_attack', skillSlot: 0 });
  const baseShield = rShieldBase.shieldHp;

  p.frontier.skills.passive = 'ps_tide_blessing';
  ps.skillCds[0] = 0;
  const rShieldBoost = env.service.handle(ws, p, { type: 'sf_attack', skillSlot: 0 });
  const boostedShield = rShieldBoost.shieldHp;
  assert.equal(boostedShield, Math.round(baseShield * 1.10), 'tide_blessing increased shieldHp by 10%');
});

// =================================================================================================
// 12. Drops: 30-Kill Bad-Luck Floor, Passive Drops, Excess Scrolls & Essence Crafting
// =================================================================================================
test('12. Drops: 30-kill bad-luck floor guarantees first scroll with floor: true at rng=0.99, passive drop at rng < 1.2% auto-equips, excess Lv.5 scrolls grant gold & essence, and essence_craft levels skill', () => {
  const env = createCombatEnv({ initialNow: 10_000_000, rng: () => 0.5 });
  const instId = 'frontier:sf_drops~meadow';
  const ws = { instanceId: instId };

  const p = createStarterProfile('drops_hero', '1234', 'bkk');
  migrateRpg(p);
  wardrobeEquip(p, { slot: 'gloves', itemId: 'gloves_starter_sword' });
  p.frontier.stats ||= {};
  p.frontier.stats.killsByMob ||= {};
  env.profiles.set(p.id, p);
  env.instances.set(instId, new Set([p.id]));
  env.presence.set(p.id, { instanceId: instId, x: 0, z: 0, t: env.getTime() });

  const sh = env.service.loadShard('sf_drops');
  env.service.handle(ws, p, { type: 'sf_state' });

  // 1) 30-kill bad-luck floor: 29 kills prior, 30th kill drops scroll with floor: true even at rng=0.99
  p.frontier.stats.killsByMob.thornback_boar = 29;
  assert.equal(p.frontier.skills.unlocked.sk_tusk_rush, undefined);

  const mobFloor = env.service._spawnMonster(sh, 'meadow', 'thornback_boar', 'ambient', 0, -1.0);
  mobFloor.hp = 1; // 1 HP so one basic attack kills it
  env.setRng(() => 0.99); // would fail normal roll
  env.broadcasts.length = 0;

  env.advanceTime(1000);
  env.service.handle(ws, p, { type: 'sf_attack', targetId: mobFloor.id, comboStep: 1 });
  assert.equal(p.frontier.stats.killsByMob.thornback_boar, 30);
  assert.equal(p.frontier.skills.unlocked.sk_tusk_rush, 1, 'First scroll granted via bad-luck floor');
  assert.equal(p.frontier.skills.equipped[0], 'sk_tusk_rush', 'Auto-equipped into empty slot 0');

  const floorDropFx = env.broadcasts.find((b) => b.msg.type === 'sf_fx' && b.msg.kind === 'skill_scroll_drop');
  assert.ok(floorDropFx, 'skill_scroll_drop broadcast emitted');
  assert.equal(floorDropFx.msg.floor, true, 'Broadcast marks floor: true');
  assert.equal(floorDropFx.msg.skillId, 'sk_tusk_rush');

  // 2) Passive drop at rng < 1.2% grants Lv.1 + auto-equips
  assert.equal(p.frontier.skills.passive, null);
  const mobPassive = env.service._spawnMonster(sh, 'meadow', 'thornback_boar', 'ambient', 0, -1.0);
  mobPassive.hp = 1;
  env.setRng(() => 0.005); // < 0.012 mob base rate
  env.broadcasts.length = 0;

  env.advanceTime(1000);
  env.service.handle(ws, p, { type: 'sf_attack', targetId: mobPassive.id, comboStep: 1 });
  assert.equal(p.frontier.skills.passives.ps_thick_hide, 1);
  assert.equal(p.frontier.skills.passive, 'ps_thick_hide', 'Passive auto-equipped on first drop');

  const pasDropFx = env.broadcasts.find((b) => b.msg.type === 'sf_fx' && b.msg.kind === 'passive_drop');
  assert.ok(pasDropFx, 'passive_drop broadcast emitted');
  assert.equal(pasDropFx.msg.passiveId, 'ps_thick_hide');
  assert.equal(pasDropFx.msg.autoEquipped, true);

  // 3) Excess Lv.5 scrolls grant gold AND essence
  p.frontier.skills.unlocked.sk_tusk_rush = 5;
  p.gold = 0;
  p.frontier.skills.essence = 0;

  const mobExcess = env.service._spawnMonster(sh, 'meadow', 'thornback_boar', 'ambient', 0, -1.0, { forceElite: false });
  mobExcess.hp = 1;
  env.setRng(() => 0.001); // guaranteed scroll drop
  env.broadcasts.length = 0;

  env.advanceTime(1000);
  env.service.handle(ws, p, { type: 'sf_attack', targetId: mobExcess.id, comboStep: 1 });
  assert.equal(p.frontier.skills.unlocked.sk_tusk_rush, 5, 'Level capped at 5');
  assert.equal(p.gold, SKILL_DROP_RATES.EXCESS_GOLD_MOB, 'Excess mob scroll converted to 1200 gold');
  assert.equal(p.frontier.skills.essence, 1, 'Excess mob scroll granted 1 essence');

  const excessFx = env.broadcasts.find((b) => b.msg.type === 'sf_fx' && b.msg.kind === 'skill_scroll_drop');
  assert.equal(excessFx.msg.maxedGold, SKILL_DROP_RATES.EXCESS_GOLD_MOB);
  assert.equal(excessFx.msg.essenceGain, 1);

  // 4) essence_craft spends essence and levels the skill
  p.frontier.skills.unlocked.sk_tusk_rush = 2;
  p.frontier.skills.essence = 10;
  p.frontier.stats.killsByMob.thornback_boar = 35; // meets >= 10 requirement

  const rCraft = env.service.handle(ws, p, {
    type: 'sf_pouch_set',
    skillAction: 'essence_craft',
    skillId: 'sk_tusk_rush',
  });
  assert.equal(rCraft.ok, true);
  assert.equal(rCraft.kind, 'skill');
  assert.equal(rCraft.newLevel, 3);
  assert.equal(rCraft.cost, 6);
  assert.equal(p.frontier.skills.essence, 4, 'Essence deducted from 10 to 4');
  assert.equal(p.frontier.skills.unlocked.sk_tusk_rush, 3, 'Skill level increased to 3');
});

// =================================================================================================
// 13. New Reactions: Frostwind, Judgement, Siphon, Water-on-Shocked Conduction & Frostwind -> Shatter Chain
// =================================================================================================
test('13. New reactions: frostwind (+20% dmg, freeze 1.2s, boss x0.4), judgement (+60% dmg, marked consumed), siphon (+30% dmg, 2x heal), water-on-shocked conduction, and frostwind -> shatter chain', () => {
  const env = createCombatEnv({ initialNow: 10_000_000, rng: () => 0.5 });
  const instId = 'frontier:sf_new_react~meadow';
  const ws = { instanceId: instId };

  const p = createStarterProfile('react_tester', '1234', 'bkk');
  p.level = 25;
  p.diamonds = 0;
  migrateRpg(p);
  wardrobeEquip(p, { slot: 'gloves', itemId: 'gloves_starter_wand' }); // wand (magic) so no melee staggered echo
  p.frontier.skills.unlocked = {
    sk_zephyr_vault: 3,
    sk_crystal_fan: 3,
    sk_prism_beam: 3,
    sk_echo_drain: 3,
    sk_koi_whirlpool: 3,
  };
  p.frontier.skills.equipped = ['sk_zephyr_vault', 'sk_crystal_fan', 'sk_prism_beam', 'sk_echo_drain'];
  env.profiles.set(p.id, p);
  env.instances.set(instId, new Set([p.id]));
  env.presence.set(p.id, { instanceId: instId, x: 0, z: 0, t: env.getTime() });

  const sh = env.service.loadShard('sf_new_react');
  env.service.handle(ws, p, { type: 'sf_state' });
  const ps = sh.live.players.get(p.id);

  // 1) Frostwind on normal mob (wind on chilled): +20% dmg, frozenUntil set to t + 1200, chilled consumed
  // Control cast of sk_zephyr_vault on clean mob
  const mobCtrlWind = spawnTestMob(sh, 'm_ctrl_wind', 'moss_slime', 0, -2.0, { hp: 2000 });
  const rCtrlWind = env.service.handle(ws, p, { type: 'sf_attack', skillSlot: 0, targetId: mobCtrlWind.id });
  const ctrlWindDmg = rCtrlWind.hits[0][1];
  sh.live.monsters.delete(mobCtrlWind.id);

  env.advanceTime(20_000);
  ps.skillCds = [0, 0, 0, 0];
  const mobFrost = spawnTestMob(sh, 'm_frost_mob', 'moss_slime', 0, -2.0, { hp: 2000 });
  applyTag(mobFrost, 'chilled', env.getTime());
  assert.equal(tagActive(mobFrost, 'chilled', env.getTime()), true);

  const rFrostwind = env.service.handle(ws, p, { type: 'sf_attack', skillSlot: 0, targetId: mobFrost.id });
  assert.ok(rFrostwind.reactions.some((entry) => entry[1] === 'frostwind'), 'Frostwind reaction triggered');
  const frostDmg = rFrostwind.hits.find(([id]) => id === mobFrost.id)[1];
  assert.equal(frostDmg, Math.round(ctrlWindDmg * 1.20), 'Frostwind deals +20% damage');
  assert.equal(mobFrost.frozenUntil, env.getTime() + 1200, 'Frostwind freezes normal mob for 1200ms');
  assert.equal(tagActive(mobFrost, 'chilled', env.getTime()), false, 'Frostwind consumed chilled tag');

  // 2) Frostwind -> Shatter chain: frozen target from frostwind hit with heavy skill (sk_crystal_fan) triggers Shatter!
  env.advanceTime(100);
  ps.skillCds[1] = 0;
  env.presence.get(p.id).x = 0;
  env.presence.get(p.id).z = 0;
  assert.ok(mobFrost.frozenUntil > env.getTime(), 'mobFrost is still frozen from Frostwind');
  const rShatterChain = env.service.handle(ws, p, { type: 'sf_attack', skillSlot: 1, targetId: mobFrost.id });
  assert.ok(rShatterChain.reactions.some((entry) => entry[1] === 'shatter'), 'Shatter reaction triggered on Frostwind-frozen mob');
  assert.equal(tagActive(mobFrost, 'frozen', env.getTime()), false, 'Shatter broke the ice');
  sh.live.monsters.delete(mobFrost.id);

  // 3) Frostwind on Boss (elder_moss_golem): freeze duration is scaled by 0.4x (1200 * 0.4 = 480ms)
  env.advanceTime(20_000);
  ps.skillCds = [0, 0, 0, 0];
  env.presence.get(p.id).x = 0;
  env.presence.get(p.id).z = 0;
  const boss = env.service._spawnMonster(sh, 'meadow', 'elder_moss_golem', 'boss', 0, -2.0, { boss: BOSSES.elder_moss_golem });
  applyTag(boss, 'chilled', env.getTime());
  const rBossWind = env.service.handle(ws, p, { type: 'sf_attack', skillSlot: 0, targetId: boss.id });
  assert.ok(rBossWind.reactions.some((entry) => entry[1] === 'frostwind'), 'Frostwind triggered on boss');
  assert.equal(boss.frozenUntil, env.getTime() + Math.round(1200 * 0.4), 'Frostwind freeze on boss is scaled to 480ms (x0.4)');
  sh.live.monsters.delete(boss.id);

  // 3) Judgement: sk_prism_beam (light) on marked mob -> x1.6 dmg, marked consumed
  env.advanceTime(20_000);
  ps.skillCds = [0, 0, 0, 0];
  env.presence.get(p.id).x = 0;
  env.presence.get(p.id).z = 0;
  const mobCtrlLight = spawnTestMob(sh, 'm_ctrl_light', 'moss_slime', 0, -3.0, { hp: 2000 });
  const rCtrlLight = env.service.handle(ws, p, { type: 'sf_attack', skillSlot: 2, targetId: mobCtrlLight.id });
  const ctrlLightDmg = rCtrlLight.hits[0][1];
  sh.live.monsters.delete(mobCtrlLight.id);

  env.advanceTime(20_000);
  ps.skillCds = [0, 0, 0, 0];
  env.presence.get(p.id).x = 0;
  env.presence.get(p.id).z = 0;
  const mobJudge = spawnTestMob(sh, 'm_judge_mob', 'moss_slime', 0, -3.0, { hp: 2000 });
  applyTag(mobJudge, 'marked', env.getTime());
  const rJudge = env.service.handle(ws, p, { type: 'sf_attack', skillSlot: 2, targetId: mobJudge.id });
  assert.ok(rJudge.reactions.some((entry) => entry[1] === 'judgement'), 'Judgement reaction triggered');
  const judgeDmg = rJudge.hits.find(([id]) => id === mobJudge.id)[1];
  assert.equal(judgeDmg, Math.round(ctrlLightDmg * 1.60), 'Judgement deals x1.6 damage');
  assert.equal(tagActive(mobJudge, 'marked', env.getTime()), false, 'Judgement consumed marked tag');
  sh.live.monsters.delete(mobJudge.id);

  // 4) Siphon: sk_echo_drain on soaked/burning/shocked/chilled -> +30% dmg and doubled self-heal vs control
  env.advanceTime(20_000);
  ps.skillCds = [0, 0, 0, 0];
  env.presence.get(p.id).x = 0;
  env.presence.get(p.id).z = 0;
  const mobCtrlDrain = spawnTestMob(sh, 'm_ctrl_drain', 'moss_slime', 0, -2.0, { hp: 2000 });
  ps.hp = ps.maxHp - 200;
  const rCtrlDrain = env.service.handle(ws, p, { type: 'sf_attack', skillSlot: 3 });
  assert.ok(rCtrlDrain.hits && rCtrlDrain.hits.length > 0, 'Control drain hit mob');
  const ctrlDrainDmg = rCtrlDrain.hits[0][1];
  const ctrlDrainHeal = rCtrlDrain.healAmount;
  sh.live.monsters.delete(mobCtrlDrain.id);

  env.advanceTime(20_000);
  ps.skillCds = [0, 0, 0, 0];
  env.presence.get(p.id).x = 0;
  env.presence.get(p.id).z = 0;
  const mobSiphon = spawnTestMob(sh, 'm_siphon_mob', 'moss_slime', 0, -2.0, { hp: 2000 });
  applyTag(mobSiphon, 'soaked', env.getTime()); // also works on burning, shocked, chilled
  ps.hp = ps.maxHp - 200;
  const rSiphon = env.service.handle(ws, p, { type: 'sf_attack', skillSlot: 3 });
  assert.ok(rSiphon.reactions.some((entry) => entry[1] === 'siphon'), 'Siphon reaction triggered on soaked mob');
  const siphonDmg = rSiphon.hits.find(([id]) => id === mobSiphon.id)[1];
  assert.equal(siphonDmg, Math.round(ctrlDrainDmg * 1.30), 'Siphon deals +30% damage');
  assert.equal(rSiphon.healAmount, ctrlDrainHeal * 2, 'Siphon doubles self-heal vs control cast');
  sh.live.monsters.delete(mobSiphon.id);

  // 5) Conduction water-on-shocked: sk_koi_whirlpool (water) on shocked mob triggers Conduction and consumes both
  p.frontier.skills.equipped[0] = 'sk_koi_whirlpool';
  ps.skillCds[0] = 0;
  env.presence.get(p.id).x = 0;
  env.presence.get(p.id).z = 0;
  const mobWaterShock = spawnTestMob(sh, 'm_water_shock', 'moss_slime', 0, -2.0, { hp: 2000 });
  applyTag(mobWaterShock, 'shocked', env.getTime());
  const rWaterShock = env.service.handle(ws, p, { type: 'sf_attack', skillSlot: 0, targetX: 0, targetZ: -2.0 });
  assert.ok(rWaterShock.reactions.some((entry) => entry[1] === 'conduction'), 'Water on shocked triggers Conduction');
  assert.equal(tagActive(mobWaterShock, 'shocked', env.getTime()), false, 'Conduction consumed shocked tag');
});

// =================================================================================================
// 14. 🎶 RESONANCE: Sustain/Support Prime, +25% DMG on Next Damaging Skill, 5s Window & Support Safety
// =================================================================================================
test('14. RESONANCE: casting sustain/support primes resonance (resonancePrimed: true, buffs.resonanceUntil > now), next damaging skill deals x1.25 and returns resonanceUsed: true, 5s window expires, support skill never consumes', () => {
  const env = createCombatEnv({ initialNow: 10_000_000, rng: () => 0.5 });
  const instId = 'frontier:sf_res~meadow';
  const ws = { instanceId: instId };

  const p = createStarterProfile('res_hero', '1234', 'bkk');
  p.level = 20;
  migrateRpg(p);
  wardrobeEquip(p, { slot: 'gloves', itemId: 'gloves_starter_wand' });
  p.frontier.skills.unlocked = {
    sk_pollen_ring: 3,
    sk_tailwind_gale: 3,
    sk_crystal_fan: 3,
  };
  p.frontier.skills.equipped = ['sk_pollen_ring', 'sk_tailwind_gale', 'sk_crystal_fan', null];
  env.profiles.set(p.id, p);
  env.instances.set(instId, new Set([p.id]));
  env.presence.set(p.id, { instanceId: instId, x: 0, z: 0, t: env.getTime() });

  const sh = env.service.loadShard('sf_res');
  env.service.handle(ws, p, { type: 'sf_state' });
  const ps = sh.live.players.get(p.id);

  // 1) Baseline un-resonated damaging skill (sk_crystal_fan) on clean mob
  const mobCtrl = spawnTestMob(sh, 'm_ctrl_fan', 'moss_slime', 0, -2.0, { hp: 2000 });
  const rCtrlFan = env.service.handle(ws, p, { type: 'sf_attack', skillSlot: 2, targetId: mobCtrl.id });
  const ctrlFanDmg = rCtrlFan.hits[0][1];
  assert.equal(rCtrlFan.resonanceUsed, false, 'Unprimed cast does not use resonance');
  sh.live.monsters.delete(mobCtrl.id);

  // 2) Prime Resonance with sustain skill (sk_pollen_ring)
  env.advanceTime(20_000);
  ps.skillCds = [0, 0, 0, 0];
  const rPrime = env.service.handle(ws, p, { type: 'sf_attack', skillSlot: 0 });
  assert.equal(rPrime.resonancePrimed, true, 'Sustain skill returns resonancePrimed: true');
  assert.equal(rPrime.resonanceUsed, false, 'Sustain skill does not consume resonance');
  assert.ok(rPrime.buffs && rPrime.buffs.resonanceUntil > env.getTime(), 'buffs.resonanceUntil is set');
  assert.ok(ps.buffs.resonance && ps.buffs.resonance.until === env.getTime() + 5000, 'ps.buffs.resonance set for 5000ms');

  // 3) Support skill (sk_tailwind_gale) never consumes resonance; it refreshes it
  env.advanceTime(1000);
  ps.skillCds[1] = 0;
  const rSupp = env.service.handle(ws, p, { type: 'sf_attack', skillSlot: 1 });
  assert.equal(rSupp.resonancePrimed, true);
  assert.equal(rSupp.resonanceUsed, false, 'Support skill never consumes resonance');
  assert.ok(ps.buffs.resonance, 'ps.buffs.resonance is still active after support cast');
  assert.equal(ps.buffs.resonance.until, env.getTime() + 5000, 'Resonance window refreshed to 5000ms from support cast');

  // 4) Next damaging skill (sk_crystal_fan) within 5s deals x1.25 damage and consumes resonance
  env.advanceTime(1000);
  ps.skillCds[2] = 0;
  const mobRes = spawnTestMob(sh, 'm_res_fan', 'moss_slime', 0, -2.0, { hp: 2000 });
  const rDmg = env.service.handle(ws, p, { type: 'sf_attack', skillSlot: 2, targetId: mobRes.id });
  assert.equal(rDmg.resonanceUsed, true, 'Damaging skill consumed resonance');
  const resFanDmg = rDmg.hits.find(([id]) => id === mobRes.id)[1];
  assert.equal(resFanDmg, Math.round(ctrlFanDmg * 1.25), 'Resonance boosted damage by exactly +25%');
  assert.equal(ps.buffs.resonance, undefined, 'ps.buffs.resonance deleted after consumption');
  sh.live.monsters.delete(mobRes.id);

  // 5) Window expires after 5s without damaging cast
  env.advanceTime(20_000);
  ps.skillCds = [0, 0, 0, 0];
  env.service.handle(ws, p, { type: 'sf_attack', skillSlot: 0 }); // prime again
  assert.ok(ps.buffs.resonance);

  env.advanceTime(5100); // 5.1s later (past 5000ms window)
  ps.skillCds[2] = 0;
  const mobExpired = spawnTestMob(sh, 'm_exp_fan', 'moss_slime', 0, -2.0, { hp: 2000 });
  const rExpFan = env.service.handle(ws, p, { type: 'sf_attack', skillSlot: 2, targetId: mobExpired.id });
  assert.equal(rExpFan.resonanceUsed, false, 'Expired resonance does nothing');
  const expFanDmg = rExpFan.hits.find(([id]) => id === mobExpired.id)[1];
  assert.equal(expFanDmg, ctrlFanDmg, 'Damage returns to base 1.0x after resonance window expired');
});

// =================================================================================================
// 15. Crowd Scaling: 3-Player Region Instance Herd Scaling & Shortened Respawn Delay
// =================================================================================================
test('15. Crowd scaling: 3 players in a region instance scales herd packSize to 7 + 4 = 11 (44 total ambient), respawn delay shortens to ~5242ms; 1 player keeps 7/species (28 total)', () => {
  // Test 1-player baseline
  const env1 = createCombatEnv({ initialNow: 10_000_000, rng: () => 0.5 });
  const instId1 = 'frontier:sf_crowd1~meadow';
  env1.instances.set(instId1, new Set(['hero_solo']));
  env1.presence.set('hero_solo', { instanceId: instId1, x: 0, z: 0, t: env1.getTime() });
  const sh1 = env1.service.loadShard('sf_crowd1');
  env1.service._tick('sf_crowd1', env1.getTime());

  let soloAmbient = 0;
  for (const m of sh1.live.monsters.values()) if (m.regionId === 'meadow' && m.kind === 'ambient') soloAmbient++;
  assert.equal(soloAmbient, 28, '1 player in Meadow spawns 4 species x 7 packSize = 28 ambient mobs');

  // 1-player respawn delay on kill
  const soloMob = [...sh1.live.monsters.values()].find((m) => m.kind === 'ambient');
  soloMob.hp = 0;
  env1.service._tick('sf_crowd1', env1.getTime());
  const soloDue = sh1.live.regions.get('meadow').ambientDue;
  assert.equal(soloDue.length, 1);
  assert.equal(soloDue[0].at - env1.getTime(), 6500, '1 player respawn delay is standard 6500ms');

  // Test 3-player crowd scaling
  const env3 = createCombatEnv({ initialNow: 10_000_000, rng: () => 0.5 });
  const instId3 = 'frontier:sf_crowd3~meadow';
  env3.instances.set(instId3, new Set(['p1', 'p2', 'p3']));
  env3.presence.set('p1', { instanceId: instId3, x: 0, z: 0, t: env3.getTime() });
  env3.presence.set('p2', { instanceId: instId3, x: 1, z: 1, t: env3.getTime() });
  env3.presence.set('p3', { instanceId: instId3, x: 2, z: 2, t: env3.getTime() });
  const sh3 = env3.service.loadShard('sf_crowd3');
  env3.service._tick('sf_crowd3', env3.getTime());

  let crowdAmbient = 0;
  for (const m of sh3.live.monsters.values()) if (m.regionId === 'meadow' && m.kind === 'ambient') crowdAmbient++;
  assert.equal(crowdAmbient, 44, '3 players in Meadow scales herd packSize to 7 + 4 = 11 per species (44 ambient mobs total)');

  // 3-player respawn delay shortening: Math.round(6500 / (1 + 0.12 * 2)) = 5242ms
  const crowdMob = [...sh3.live.monsters.values()].find((m) => m.kind === 'ambient');
  crowdMob.hp = 0;
  env3.service._tick('sf_crowd3', env3.getTime());
  const crowdDue = sh3.live.regions.get('meadow').ambientDue;
  assert.equal(crowdDue.length, 1);
  const expectedRespawn = Math.max(3500, Math.round(6500 / (1 + 0.12 * 2))); // 5242
  assert.equal(crowdDue[0].at - env3.getTime(), expectedRespawn, '3 players speeds respawn delay to 5242ms');
});

// =================================================================================================
// 16. Boss Sync: Damaging Boss Marks bossDirty, _tick Emits sf_boss Update Throttled to >= 250ms
// =================================================================================================
test('16. Boss sync: damaging boss marks bossDirty, _tick broadcasts sf_boss update carrying hp/poise/maxPoise/breakUntil, throttled to >= 250ms apart', () => {
  const env = createCombatEnv({ initialNow: 10_000_000, rng: () => 0.5 });
  const instId = 'frontier:sf_boss_sync~meadow';
  const ws = { instanceId: instId };

  const p = createStarterProfile('boss_sync_hero', '1234', 'bkk');
  migrateRpg(p);
  wardrobeEquip(p, { slot: 'gloves', itemId: 'gloves_starter_sword' });
  env.profiles.set(p.id, p);
  env.instances.set(instId, new Set([p.id]));
  env.presence.set(p.id, { instanceId: instId, x: 0, z: 0, t: env.getTime() });

  const sh = env.service.loadShard('sf_boss_sync');
  env.service.handle(ws, p, { type: 'sf_state' });

  const boss = env.service._spawnMonster(sh, 'meadow', 'elder_moss_golem', 'boss', 10, 10, { boss: BOSSES.elder_moss_golem });
  sh.live.bosses.set('meadow', boss.id);

  // 1) Damaging boss marks bossDirty
  env.broadcasts.length = 0;
  boss.hp -= 100;
  sh.live.regions.get('meadow').bossDirty = true;

  // Next _tick broadcasts sf_boss event: 'update'
  env.service._tick('sf_boss_sync', env.getTime());
  const bcast1 = env.broadcasts.find((b) => b.msg.type === 'sf_boss' && b.msg.event === 'update');
  assert.ok(bcast1, 'sf_boss update broadcast emitted on tick after boss damage');
  assert.equal(bcast1.msg.hp, boss.hp);
  assert.equal(bcast1.msg.poise, boss.poise);
  assert.equal(bcast1.msg.maxPoise, boss.maxPoise);
  assert.equal(bcast1.msg.breakUntil, boss.breakUntil);
  assert.equal(sh.live.regions.get('meadow').bossDirty, false, 'bossDirty reset to false after broadcast');

  // 2) Throttled when damaging again within < 250ms
  env.broadcasts.length = 0;
  env.advanceTime(100); // only 100ms elapsed (< 250ms)
  boss.hp -= 100;
  sh.live.regions.get('meadow').bossDirty = true;

  env.service._tick('sf_boss_sync', env.getTime());
  const bcastThrottled = env.broadcasts.find((b) => b.msg.type === 'sf_boss' && b.msg.event === 'update');
  assert.equal(bcastThrottled, undefined, 'sf_boss update broadcast throttled (< 250ms since last)');
  assert.equal(sh.live.regions.get('meadow').bossDirty, true, 'bossDirty remains true while throttled');

  // 3) Broadcast fires once >= 250ms elapsed
  env.advanceTime(160); // 100 + 160 = 260ms (>= 250ms)
  env.service._tick('sf_boss_sync', env.getTime());
  const bcast2 = env.broadcasts.find((b) => b.msg.type === 'sf_boss' && b.msg.event === 'update');
  assert.ok(bcast2, 'sf_boss update broadcast emitted after >= 250ms delay');
  assert.equal(bcast2.msg.hp, boss.hp);
});

// =================================================================================================
// 17. Preset Load Deduping: Preset with Duplicate Skill IDs Equips Only Once
// =================================================================================================
test('17. preset_load dedupes: a preset whose equipped array contains the same skill twice equips it only once (other slot null)', () => {
  const env = createCombatEnv({ initialNow: 10_000_000, rng: () => 0.5 });
  const instId = 'frontier:sf_dupe~meadow';
  const ws = { instanceId: instId };

  const p = createStarterProfile('dupe_tester', '1234', 'bkk');
  p.level = 15; // unlock slots 0, 1, 2
  migrateRpg(p);
  p.frontier.skills.unlocked = {
    sk_tusk_rush: 2,
    sk_crystal_fan: 2,
  };
  env.profiles.set(p.id, p);
  env.instances.set(instId, new Set([p.id]));
  env.presence.set(p.id, { instanceId: instId, x: 0, z: 0, t: env.getTime() });

  const sh = env.service.loadShard('sf_dupe');
  env.service.handle(ws, p, { type: 'sf_state' });

  // Preset with duplicate sk_tusk_rush in slot 0 and slot 1
  p.frontier.skills.presets[0] = {
    name: 'DuplicatePreset',
    equipped: ['sk_tusk_rush', 'sk_tusk_rush', 'sk_crystal_fan', null],
    passive: null,
  };

  const rLoad = env.service.handle(ws, p, { type: 'sf_pouch_set', skillAction: 'preset_load', preset: 0 });
  assert.equal(rLoad.ok, true);
  assert.equal(p.frontier.skills.equipped[0], 'sk_tusk_rush', 'First occurrence equipped in slot 0');
  assert.equal(p.frontier.skills.equipped[1], null, 'Duplicate occurrence in slot 1 stripped to null');
  assert.equal(p.frontier.skills.equipped[2], 'sk_crystal_fan', 'Unique skill equipped in slot 2');
  assert.equal(p.frontier.skills.equipped[3], null);
});

// =================================================================================================
// 18. Expired Tag Cleanup in _tick
// =================================================================================================
test('18. Expired tags cleanup: _tick deletes expired tags (tags[k] <= t) from mon.tags while retaining active tags', () => {
  const env = createCombatEnv({ initialNow: 10_000_000, rng: () => 0.5 });
  const instId = 'frontier:sf_cleanup~meadow';
  const ws = { instanceId: instId };

  const p = createStarterProfile('clean_hero', '1234', 'bkk');
  migrateRpg(p);
  env.profiles.set(p.id, p);
  env.instances.set(instId, new Set([p.id]));
  env.presence.set(p.id, { instanceId: instId, x: 0, z: 0, t: env.getTime() });

  const sh = env.service.loadShard('sf_cleanup');
  env.service.handle(ws, p, { type: 'sf_state' });

  const mob = spawnTestMob(sh, 'm_tag_clean', 'moss_slime', 0, -2.0);
  const now = env.getTime();
  mob.tags = {
    chilled: now - 200,   // expired
    marked: now,          // expired (<= now)
    soaked: now + 3000,   // active
    burning: now + 4000,  // active
  };

  assert.equal('chilled' in mob.tags, true);
  assert.equal('marked' in mob.tags, true);

  // Run _tick at timestamp `now`
  env.service._tick('sf_cleanup', now);

  assert.equal(mob.tags.chilled, undefined, 'Expired chilled tag was deleted from mon.tags');
  assert.equal(mob.tags.marked, undefined, 'Expired marked tag (at now) was deleted from mon.tags');
  assert.ok(mob.tags.soaked > now, 'Active soaked tag is retained');
  assert.ok(mob.tags.burning > now, 'Active burning tag is retained');
});

