// shared/combat_rules.js — Authoritative combat, invasion, boss, and ultimate rules for Sky Frontier (V2).
// Pure functions, zero I/O. Deterministic with now/rng parameters.

import { softCap } from './universal_stats.js';

// ============================================================================
// 1. MONSTERS & BOSSES
// ============================================================================

export const ALPHA_ELITE = Object.freeze({
  SPAWN_CHANCE: 0.08,     // 8% chance when spawning a habitat mob
  MAX_PER_REGION: 2,      // max 2 active Star-Crowned Alpha Elites per region
  HP_MULT: 4.0,
  DMG_MULT: 1.45,
  SCALE_MULT: 1.45,
  SCROLL_MULT: 4.0,       // 4x Skill Scroll drop rate (8.0% base * Luck)
  MAT_MULT: 3,            // 3x guaranteed material yield
  XP_MULT: 3,
  GOLD_BONUS: 150,
  SKILL_CD_MS: 7500,
  TELEGRAPH_MS: 1100,
  PACK_ASSIST_RADIUS: 5.2,
});

export const MONSTERS = Object.freeze({
  // ── Region 1: Whispering Meadow (4 Habitat Species) ──
  moss_slime: Object.freeze({
    id: 'moss_slime',
    name: 'Moss Slime',
    region: 'meadow',
    habitatPoi: 'grove',
    aggroStyle: 'passive',
    packSize: 7,
    hp: 30,
    dmg: 4,
    speed: 1.4,
    xp: 5,
    drop: Object.freeze({ monster_gel: 2 }),
  }),
  thornback_boar: Object.freeze({
    id: 'thornback_boar',
    name: 'Thornback Boar',
    region: 'meadow',
    habitatPoi: 'boulders',
    aggroStyle: 'pack',
    packSize: 7,
    hp: 60,
    dmg: 8,
    speed: 2.2,
    drop: Object.freeze({ monster_fang: 1, monster_gel: 1 }),
  }),
  pollen_wisp: Object.freeze({
    id: 'pollen_wisp',
    name: 'Pollen Wisp',
    region: 'meadow',
    habitatPoi: 'wheat',
    aggroStyle: 'passive',
    packSize: 7,
    hp: 20,
    dmg: 3,
    speed: 2.6,
    ranged: true,
    drop: Object.freeze({ herb_seed: 1 }),
  }),
  meadow_zephyr_hare: Object.freeze({
    id: 'meadow_zephyr_hare',
    name: 'Zephyr Sylph-Hare',
    region: 'meadow',
    habitatPoi: 'grotto',
    aggroStyle: 'passive',
    packSize: 7,
    hp: 42,
    dmg: 6,
    speed: 2.7,
    ranged: true,
    xp: 7,
    drop: Object.freeze({ feather: 2, herb_seed: 1 }),
  }),

  // ── Region 2: Crystal Hollow (4 Habitat Species) ──
  crystal_beetle: Object.freeze({
    id: 'crystal_beetle',
    name: 'Crystal Beetle',
    region: 'hollow',
    habitatPoi: 'quartz',
    aggroStyle: 'pack',
    packSize: 7,
    hp: 95,
    dmg: 11,
    speed: 1.65,
    drop: Object.freeze({ crystal_ore: 2, monster_gel: 1 }),
  }),
  lantern_bat: Object.freeze({
    id: 'lantern_bat',
    name: 'Lantern Bat',
    region: 'hollow',
    habitatPoi: 'mithril',
    aggroStyle: 'pack',
    packSize: 7,
    hp: 52,
    dmg: 8,
    speed: 3.0,
    drop: Object.freeze({ monster_fang: 1 }),
  }),
  quartz_golemling: Object.freeze({
    id: 'quartz_golemling',
    name: 'Quartz Golemling',
    region: 'hollow',
    habitatPoi: 'sanctum_guard',
    aggroStyle: 'pack',
    packSize: 7,
    hp: 140,
    dmg: 16,
    speed: 1.15,
    drop: Object.freeze({ crystal_ore: 3, monster_fang: 1 }),
  }),
  hollow_frost_shroom: Object.freeze({
    id: 'hollow_frost_shroom',
    name: 'Frostcap Myconid',
    region: 'hollow',
    habitatPoi: 'frost_glade',
    aggroStyle: 'passive',
    packSize: 7,
    hp: 78,
    dmg: 9,
    speed: 1.45,
    xp: 12,
    drop: Object.freeze({ herb_seed: 2, monster_gel: 2 }),
  }),

  // ── Region 3: Celestial Sakura Reef (4 Habitat Species) ──
  reef_sakura_kitsune: Object.freeze({
    id: 'reef_sakura_kitsune',
    name: 'Sakura Shrine Kitsune',
    region: 'reef',
    habitatPoi: 'shrine_woods',
    aggroStyle: 'pack',
    packSize: 7,
    hp: 125,
    dmg: 15,
    speed: 2.4,
    ranged: true,
    xp: 18,
    drop: Object.freeze({ sakura_timber: 2, cloud_silk: 1 }),
  }),
  reef_pearl_snapper: Object.freeze({
    id: 'reef_pearl_snapper',
    name: 'Tide-Pearl Snapper',
    region: 'reef',
    habitatPoi: 'pearl_shoals',
    aggroStyle: 'passive',
    packSize: 7,
    hp: 175,
    dmg: 18,
    speed: 1.25,
    xp: 20,
    drop: Object.freeze({ celestial_pearl: 2, fish: 1 }),
  }),
  reef_cloud_crane: Object.freeze({
    id: 'reef_cloud_crane',
    name: 'Celestial Cloud-Crane',
    region: 'reef',
    habitatPoi: 'crane_roost',
    aggroStyle: 'passive',
    packSize: 7,
    hp: 110,
    dmg: 14,
    speed: 2.8,
    ranged: true,
    xp: 17,
    drop: Object.freeze({ feather: 2, cloud_lotus: 1 }),
  }),
  reef_bell_spirit: Object.freeze({
    id: 'reef_bell_spirit',
    name: 'Furin Tide-Bell Spirit',
    region: 'reef',
    habitatPoi: 'bell_lagoon',
    aggroStyle: 'pack',
    packSize: 7,
    hp: 135,
    dmg: 16,
    speed: 2.0,
    ranged: true,
    xp: 19,
    drop: Object.freeze({ cloud_lotus: 2, monster_gel: 1 }),
  }),

  // ── Region 4: Clockwork Star-Caldera (4 Habitat Species) ──
  sanctum_cinder_salamander: Object.freeze({
    id: 'sanctum_cinder_salamander',
    name: 'Solar-Cinder Salamander',
    region: 'caldera',
    habitatPoi: 'cinder_vents',
    aggroStyle: 'pack',
    packSize: 7,
    hp: 195,
    dmg: 22,
    speed: 2.0,
    xp: 26,
    drop: Object.freeze({ orichalcum_ore: 2, monster_fang: 1 }),
  }),
  sanctum_arc_automaton: Object.freeze({
    id: 'sanctum_arc_automaton',
    name: 'Aether-Owl Automaton',
    region: 'caldera',
    habitatPoi: 'gear_foundry',
    aggroStyle: 'pack',
    packSize: 7,
    hp: 165,
    dmg: 21,
    speed: 2.3,
    ranged: true,
    xp: 25,
    drop: Object.freeze({ orichalcum_ore: 1, crystal_ore: 2 }),
  }),
  sanctum_star_gargoyle: Object.freeze({
    id: 'sanctum_star_gargoyle',
    name: 'Astral-Shard Griffon',
    region: 'caldera',
    habitatPoi: 'prism_spires',
    aggroStyle: 'pack',
    packSize: 7,
    hp: 215,
    dmg: 25,
    speed: 2.5,
    xp: 28,
    drop: Object.freeze({ astral_prism: 2, monster_fang: 2 }),
  }),
  sanctum_chrono_sentinel: Object.freeze({
    id: 'sanctum_chrono_sentinel',
    name: 'Chrono-Gear Sentinel',
    region: 'caldera',
    habitatPoi: 'chrono_ring',
    aggroStyle: 'pack',
    packSize: 7,
    hp: 260,
    dmg: 28,
    speed: 1.35,
    xp: 32,
    drop: Object.freeze({ astral_prism: 2, orichalcum_ore: 2 }),
  }),
});

export const BOSSES = Object.freeze({
  elder_moss_golem: Object.freeze({
    id: 'elder_moss_golem',
    name: 'Elder Moss Golem',
    region: 'meadow',
    hp: 2800,
    dmg: 24,
    phases: Object.freeze([1, 0.6, 0.3]),
    drop: Object.freeze({ boss_core_moss: Object.freeze([2, 4]) }),
    charmTiers: Object.freeze({ 1: 0.18 }),
  }),
  hollow_crystal_weaver: Object.freeze({
    id: 'hollow_crystal_weaver',
    name: 'Hollow Crystal Weaver',
    region: 'hollow',
    hp: 5200,
    dmg: 34,
    phases: Object.freeze([1, 0.6, 0.3]),
    drop: Object.freeze({ boss_core_weaver: Object.freeze([2, 4]) }),
    charmTiers: Object.freeze({ 1: 0.10, 2: 0.12 }),
  }),
  sakura_nine_tail_kitsune: Object.freeze({
    id: 'sakura_nine_tail_kitsune',
    name: 'Lady Tamamo, Nine-Tail Kitsune',
    region: 'reef',
    hp: 7800,
    dmg: 42,
    phases: Object.freeze([1, 0.6, 0.3]),
    drop: Object.freeze({
      boss_core_kitsune: Object.freeze([2, 4]),
      celestial_pearl: Object.freeze([3, 6]),
    }),
    charmTiers: Object.freeze({ 1: 0.08, 2: 0.16 }),
  }),
  chronos_solar_bahamut: Object.freeze({
    id: 'chronos_solar_bahamut',
    name: 'Chronos-Solar Bahamut',
    region: 'caldera',
    hp: 11200,
    dmg: 52,
    phases: Object.freeze([1, 0.6, 0.3]),
    drop: Object.freeze({
      boss_core_bahamut: Object.freeze([2, 4]),
      starlight_essence: Object.freeze([2, 4]),
    }),
    charmTiers: Object.freeze({ 1: 0.06, 2: 0.22 }),
  }),
});

// ============================================================================
// 2. WEAPONS & COMBAT
// ============================================================================

export const WEAPONS = Object.freeze({
  pickaxe: Object.freeze({
    id: 'pickaxe',
    base: 12,
    style: 'stagger',
    range: 1.6,
    arc: 70,
    knockback: 1.2,
  }),
  axe: Object.freeze({
    id: 'axe',
    base: 10,
    style: 'cleave',
    range: 1.8,
    arc: 150,
  }),
  staff: Object.freeze({
    id: 'staff',
    base: 8,
    style: 'ranged',
    range: 7,
    arc: 20,
    heal: 4,
  }),
});

export function toolTierMult(tier) {
  const t = Math.max(1, Number(tier) || 1);
  return 1 + 0.35 * (t - 1);
}

export function weaponDamage({ tool, tier = 1, stats = {}, crit = false } = {}) {
  const w = typeof tool === 'string' ? WEAPONS[tool] : (tool || WEAPONS.pickaxe);
  const base = w?.base ?? 10;
  const tierMult = toolTierMult(tier);
  const power = Number(stats?.power) || 0;
  const raw = Math.round(base * tierMult * (1 + softCap(power, 0.6, 140)));
  const mult = crit ? 1.5 : 1;
  return Math.round(raw * mult);
}

export function attackCooldownMs(stats = {}) {
  const swiftness = Number(stats?.swiftness) || 0;
  return Math.round(650 / (1 + softCap(swiftness, 0.25, 140)));
}

export function hitsInArc({ origin, facing, range, arcDeg, targets = [] } = {}) {
  if (!origin || !facing || !range || range <= 0 || !Array.isArray(targets)) return [];
  const fx = Number(facing.x) || 0;
  const fz = Number(facing.z) || 0;
  const fMag = Math.hypot(fx, fz);
  if (fMag === 0) return [];

  const ox = Number(origin.x) || 0;
  const oz = Number(origin.z) || 0;
  const halfArcDeg = (Number(arcDeg) || 0) / 2;
  const eps = 1e-7;

  const hits = [];
  for (const t of targets) {
    if (!t) continue;
    const dx = (Number(t.x) || 0) - ox;
    const dz = (Number(t.z) || 0) - oz;
    const dist = Math.hypot(dx, dz);
    if (dist > range + eps) continue;

    if (dist <= eps) {
      hits.push(t.id);
      continue;
    }

    const dot = (fx * dx + fz * dz) / (fMag * dist);
    const clampedDot = Math.max(-1, Math.min(1, dot));
    const angleDeg = Math.acos(clampedDot) * (180 / Math.PI);

    if (angleDeg <= halfArcDeg + eps) {
      hits.push(t.id);
    }
  }
  return hits;
}

// ============================================================================
// 3. ULTIMATES (16 Drop-Only Ragnarok Charms)
// ============================================================================

export const ULTIMATES = Object.freeze({
  charm_berry_perfume: Object.freeze({
    id: 'charm_berry_perfume',
    name: 'Sweet Burst',
    cooldownMs: 45000,
    radius: 0,
    effect: Object.freeze({
      type: 'loot_boost',
      pct: 0.30,
      ms: 10000,
    }),
  }),
  charm_clover_bell: Object.freeze({
    id: 'charm_clover_bell',
    name: 'Lucky Ring',
    cooldownMs: 50000,
    radius: 0,
    effect: Object.freeze({
      type: 'rare_reroll',
      swings: 5,
    }),
  }),
  charm_ribbon_musicbox: Object.freeze({
    id: 'charm_ribbon_musicbox',
    name: 'Allegro',
    cooldownMs: 50000,
    radius: 8,
    effect: Object.freeze({
      type: 'haste',
      pct: 0.35,
      ms: 8000,
      party: true,
    }),
  }),
  charm_honeybee_lantern: Object.freeze({
    id: 'charm_honeybee_lantern',
    name: 'Nectar Field',
    cooldownMs: 55000,
    radius: 8,
    effect: Object.freeze({
      type: 'heal_field',
      pctPerSec: 0.06,
      ms: 6000,
    }),
  }),
  charm_cinderella_watch: Object.freeze({
    id: 'charm_cinderella_watch',
    name: 'Midnight',
    cooldownMs: 60000,
    radius: 8,
    effect: Object.freeze({
      type: 'slow',
      pct: 0.50,
      ms: 4000,
    }),
  }),
  charm_siren_pearl: Object.freeze({
    id: 'charm_siren_pearl',
    name: 'Undertow',
    cooldownMs: 60000,
    radius: 7,
    effect: Object.freeze({
      type: 'pull',
      radius: 7,
    }),
  }),
  charm_roulette_watch: Object.freeze({
    id: 'charm_roulette_watch',
    name: 'All-In',
    cooldownMs: 60000,
    radius: 0,
    effect: Object.freeze({
      type: 'free_swings',
      n: 8,
    }),
  }),
  charm_phantom_mirror: Object.freeze({
    id: 'charm_phantom_mirror',
    name: 'Twin Cast',
    cooldownMs: 60000,
    radius: 0,
    effect: Object.freeze({
      type: 'clone',
      ms: 6000,
    }),
  }),
  charm_kitsune_omamori: Object.freeze({
    id: 'charm_kitsune_omamori',
    name: 'Fox-Fire',
    cooldownMs: 70000,
    radius: 18,
    effect: Object.freeze({
      type: 'homing',
      n: 6,
      dmgMult: 1.2,
      reveals: true,
    }),
  }),
  charm_glacial_snowglobe: Object.freeze({
    id: 'charm_glacial_snowglobe',
    name: 'Frost Nova',
    cooldownMs: 70000,
    radius: 6,
    effect: Object.freeze({
      type: 'freeze',
      ms: 2000,
      vuln: 0.50,
    }),
  }),
  charm_pharaoh_ankh: Object.freeze({
    id: 'charm_pharaoh_ankh',
    name: 'Sun Pillar',
    cooldownMs: 75000,
    radius: 6,
    effect: Object.freeze({
      type: 'nuke',
      mult: 4,
      armorBreak: true,
    }),
  }),
  charm_tsukuyomi_mirror: Object.freeze({
    id: 'charm_tsukuyomi_mirror',
    name: 'Eclipse',
    cooldownMs: 75000,
    radius: 7,
    effect: Object.freeze({
      type: 'stun',
      ms: 2500,
    }),
  }),
  charm_emperor_mochi_crown: Object.freeze({
    id: 'charm_emperor_mochi_crown',
    name: 'Royal Guard',
    cooldownMs: 85000,
    radius: 0,
    effect: Object.freeze({
      type: 'summon',
      ms: 12000,
    }),
  }),
  charm_golden_pinata_trophy: Object.freeze({
    id: 'charm_golden_pinata_trophy',
    name: 'Jackpot',
    cooldownMs: 80000,
    radius: 8,
    effect: Object.freeze({
      type: 'loot_shower',
      ms: 10000,
    }),
  }),
  charm_seraphim_rose_halo: Object.freeze({
    id: 'charm_seraphim_rose_halo',
    name: 'Sanctuary',
    cooldownMs: 90000,
    radius: 8,
    effect: Object.freeze({
      type: 'shield',
      pct: 0.25,
      ms: 6000,
      dmgPct: 0.25,
    }),
  }),
  charm_eclipse_dragon_core: Object.freeze({
    id: 'charm_eclipse_dragon_core',
    name: 'Cataclysm',
    cooldownMs: 90000,
    radius: 10,
    effect: Object.freeze({
      type: 'cone',
      mult: 2.5,
      nodeCrack: 0.5,
    }),
  }),
});

export function ultimateCooldownMs(charmId, opts = {}) {
  const teaBuff = typeof opts === 'boolean' ? opts : Boolean(opts?.teaBuff);
  const key = typeof charmId === 'string' && !charmId.startsWith('charm_') && ULTIMATES['charm_' + charmId]
    ? 'charm_' + charmId
    : charmId;
  const def = ULTIMATES[key];
  const cd = def?.cooldownMs ?? 60000;
  return teaBuff ? Math.round(cd * 0.8) : cd;
}

// ============================================================================
// 4. INVASIONS & OUTPOST
// ============================================================================

export const INVASION = Object.freeze({
  INTERVAL_MIN_MS: 45 * 60e3,
  INTERVAL_MAX_MS: 60 * 60e3,
  WARNING_MS: 120e3,
  WAVES: 3,
  WAVE_GAP_MS: 25e3,
  BASE_COUNT: 6,
  PER_PLAYER_SCALE: 0.55,
});

export function nextInvasionAt(now, rng = Math.random) {
  const r = typeof rng === 'function' ? rng() : (typeof rng === 'number' ? rng : Math.random());
  const span = INVASION.INTERVAL_MAX_MS - INVASION.INTERVAL_MIN_MS;
  return Number(now) + INVASION.INTERVAL_MIN_MS + Math.round(r * span);
}

export function waveComposition({ region = 'meadow', wave = 1, activePlayers = 1, rng = Math.random } = {}) {
  const players = Math.max(1, Number(activePlayers) || 1);
  const w = Math.max(1, Number(wave) || 1);

  const total = Math.round(
    INVASION.BASE_COUNT *
    (1 + INVASION.PER_PLAYER_SCALE * (players - 1)) *
    (1 + 0.3 * (w - 1))
  );

  const hpMultiplier = +(1 + 0.15 * (players - 1)).toFixed(4);

  const regionMonsters = Object.values(MONSTERS).filter((m) => m.region === region).map((m) => m.id);
  const candidateTypes = regionMonsters.length > 0 ? regionMonsters : Object.keys(MONSTERS);

  const n = candidateTypes.length;
  const counts = new Array(n).fill(Math.floor(total / n));
  let remainder = total % n;

  let step = 0;
  while (remainder > 0) {
    const idx = typeof rng === 'function' ? Math.floor(rng() * n) : (step % n);
    counts[idx] = (counts[idx] || 0) + 1;
    remainder--;
    step++;
  }

  const result = candidateTypes.map((type, i) => ({
    type,
    count: counts[i],
    hpMultiplier,
  })).filter((item) => item.count > 0);

  result.total = total;
  result.hpMultiplier = hpMultiplier;
  result.monsters = result;

  return result;
}

export const OUTPOST = Object.freeze({
  maxHp: 1000,
  repairKitHeal: 250,
  offlineBelow: 0,
});

export function applyOutpostDamage(outpost, dmg) {
  if (!outpost) return outpost;
  const amount = Math.max(0, Number(dmg) || 0);
  const currentHp = outpost.hp !== undefined ? outpost.hp : OUTPOST.maxHp;
  outpost.hp = Math.max(0, currentHp - amount);
  if (outpost.hp <= OUTPOST.offlineBelow) {
    outpost.offline = true;
  }
  return outpost;
}

export function repairOutpost(outpost, kits) {
  if (!outpost) return 0;
  const availableKits = Math.max(0, Math.floor(Number(kits) || 0));
  if (availableKits <= 0) return 0;

  const currentHp = Math.max(0, Number(outpost.hp) || 0);
  const missingHp = Math.max(0, OUTPOST.maxHp - currentHp);
  if (missingHp <= 0) return 0;

  const kitsNeeded = Math.ceil(missingHp / OUTPOST.repairKitHeal);
  const kitsUsed = Math.min(availableKits, kitsNeeded);

  outpost.hp = Math.min(OUTPOST.maxHp, currentHp + kitsUsed * OUTPOST.repairKitHeal);
  if (outpost.hp > 0) {
    outpost.offline = false;
  }

  return kitsUsed;
}

// ============================================================================
// 5. CONTRIBUTION LEDGER & QUALIFIERS
// ============================================================================

export function contributionLedger() {
  return {};
}

export function addContribution(ledger, userId, { dmg = 0, heal = 0, repair = 0 } = {}) {
  if (!ledger || !userId) return null;
  const entries = ledger.entries || ledger;
  const existing = entries[userId] || { dmg: 0, heal: 0, repair: 0, score: 0 };

  const addDmg = Number(dmg) || 0;
  const addHeal = Number(heal) || 0;
  const addRepair = Number(repair) || 0;

  existing.dmg += addDmg;
  existing.heal += addHeal;
  existing.repair += addRepair;
  existing.score = existing.dmg + existing.heal * 1.5 + existing.repair * 2;

  entries[userId] = existing;
  return existing;
}

export function qualifiers(ledger, minShare = 0.05) {
  if (!ledger) return [];
  const entries = ledger.entries || ledger;
  const userIds = Object.keys(entries);
  if (userIds.length === 0) return [];

  const totalScore = userIds.reduce((sum, u) => sum + (Number(entries[u]?.score) || 0), 0);
  if (totalScore <= 0) return [];

  const threshold = minShare - 1e-9;
  return userIds.filter((u) => {
    const score = Number(entries[u]?.score) || 0;
    return (score / totalScore) >= threshold;
  });
}

// ============================================================================
// 6. BOSS LOOT (Pure % × Luck RNG + Guaranteed Boss Cores)
// ============================================================================

export function rollBossLoot({
  bossId,
  qualifying,
  rng = Math.random,
  luckByUser = {},
} = {}) {
  const boss = BOSSES[bossId];
  if (!boss) throw new Error(`Unknown bossId: ${bossId}`);

  const users = Array.isArray(qualifying)
    ? qualifying
    : (qualifying && typeof qualifying === 'object' ? Object.keys(qualifying) : []);

  const results = {};

  const listedTiers = Object.keys(boss.charmTiers).map(Number).sort((a, b) => a - b);
  const descendingTiers = [...listedTiers].reverse();

  for (const u of users) {
    const items = {};
    for (const [matId, range] of Object.entries(boss.drop)) {
      const [min, max] = Array.isArray(range) ? range : [range, range];
      const count = min + Math.floor(rng() * (max - min + 1));
      items[matId] = count;
      items.core = count;
    }

    const userLuck = Number(luckByUser[u]) || 0;
    const luckMult = 1 + softCap(userLuck, 0.25, 140);

    const roll = rng();
    let charmTier = null;
    let cumulative = 0;
    for (const tier of descendingTiers) {
      const baseRate = boss.charmTiers[tier] || 0;
      const chance = baseRate * luckMult;
      cumulative += chance;
      if (roll < cumulative) {
        charmTier = tier;
        break;
      }
    }

    results[u] = {
      items,
      charmTier,
    };
  }

  return results;
}

// ============================================================================
// 7. MASTER CRAFTERS V2 — 3 WEAPON CLASSES, VITALITY HP & COMBOS
// ============================================================================

export const WEAPON_CLASSES = Object.freeze({
  melee: Object.freeze({
    id: 'melee',
    label: 'Melee',
    icon: '⚔️',
    base: 14,
    range: 2.2,
    arc: 135,
    cooldownMs: 560,
    comboMults: Object.freeze([1.0, 1.12, 1.38]),
    finisherStaggerMs: 420,
    knockback: 0.95,
  }),
  ranged: Object.freeze({
    id: 'ranged',
    label: 'Ranged',
    icon: '🏹',
    base: 12,
    range: 7.8,
    arc: 28,
    cooldownMs: 520,
    comboMults: Object.freeze([1.0, 1.08, 1.44]), // Hit 3 fires Twin Volley (2x 0.72x)
    twinVolley: true,
    knockback: 0.35,
  }),
  magic: Object.freeze({
    id: 'magic',
    label: 'Magic',
    icon: '🪄',
    base: 12,
    range: 6.5,
    arc: 40,
    cooldownMs: 600,
    comboMults: Object.freeze([1.0, 1.10, 1.25]),
    finisherSplashRadius: 2.2,
    finisherPartyHealBase: 5,
    knockback: 0.45,
  }),
});

export function playerMaxHp(level = 1, stats = {}) {
  const lv = Math.max(1, Number(level) || 1);
  const vit = Math.max(0, Number(stats?.fortune) || 0);
  const vitBonus = Math.round(softCap(vit, 140, 150));
  return 100 + 2 * lv + vitBonus;
}

export function classComboDamage({ weaponClass = 'melee', comboStep = 1, stats = {}, crit = false } = {}) {
  const cls = WEAPON_CLASSES[weaponClass] || WEAPON_CLASSES.melee;
  const stepIdx = Math.max(0, Math.min(2, (Number(comboStep) || 1) - 1));
  const comboMult = cls.comboMults[stepIdx] ?? 1.0;
  const power = Math.max(0, Number(stats?.power) || 0);
  const pwrMult = 1 + softCap(power, 0.85, 150);
  const raw = cls.base * comboMult * pwrMult;
  return Math.max(1, Math.round(raw * (crit ? 1.55 : 1)));
}

export function classAttackCooldownMs(weaponClass = 'melee', stats = {}, comboStep = 1) {
  const cls = WEAPON_CLASSES[weaponClass] || WEAPON_CLASSES.melee;
  const swiftness = Math.max(0, Number(stats?.swiftness) || 0);
  const stepFactor = comboStep === 3 ? 1.12 : 1.0;
  return Math.round((cls.cooldownMs * stepFactor) / (1 + softCap(swiftness, 0.28, 140)));
}

// ============================================================================
// 8. TINKER'S WORKSHOP — BOSS WEAPON FORGE (B / A / S / SS + 10-PITY)
// ============================================================================

export const BOSS_WEAPON_FORGE = Object.freeze({
  PITY_MAX: 10,
  STAT_POOL: Object.freeze(['power', 'swiftness', 'fortune', 'luck']),
  GRADES: Object.freeze([
    Object.freeze({ grade: 'B',  label: 'Sturdy',     rate: 0.50, mult: 0.86, color: '#8ab4f8' }),
    Object.freeze({ grade: 'A',  label: 'Fine',       rate: 0.32, mult: 1.00, color: '#6ee7b7' }),
    Object.freeze({ grade: 'S',  label: 'Heroic',     rate: 0.14, mult: 1.15, color: '#fbbf24' }),
    Object.freeze({ grade: 'SS', label: 'Masterwork', rate: 0.04, mult: 1.30, color: '#f472b6' }),
  ]),
  RECIPES: Object.freeze({
    gloves_boss_moss_cleaver: Object.freeze({
      id: 'gloves_boss_moss_cleaver',
      tier: 'meadow',
      rarity: 2,
      combatClass: 'melee',
      bossId: 'elder_moss_golem',
      gold: 1500,
      mats: Object.freeze({ boss_core_moss: 3, ingot: 6, plank: 6 }),
      baseMain: 18,
      baseSec: 14,
    }),
    gloves_boss_moss_longbow: Object.freeze({
      id: 'gloves_boss_moss_longbow',
      tier: 'meadow',
      rarity: 2,
      combatClass: 'ranged',
      bossId: 'elder_moss_golem',
      gold: 1500,
      mats: Object.freeze({ boss_core_moss: 3, ingot: 6, plank: 6 }),
      baseMain: 18,
      baseSec: 14,
    }),
    gloves_boss_moss_staff: Object.freeze({
      id: 'gloves_boss_moss_staff',
      tier: 'meadow',
      rarity: 2,
      combatClass: 'magic',
      bossId: 'elder_moss_golem',
      gold: 1500,
      mats: Object.freeze({ boss_core_moss: 3, ingot: 6, plank: 6 }),
      baseMain: 18,
      baseSec: 14,
    }),
    gloves_boss_weaver_scythe: Object.freeze({
      id: 'gloves_boss_weaver_scythe',
      tier: 'hollow',
      rarity: 3,
      combatClass: 'melee',
      bossId: 'hollow_crystal_weaver',
      gold: 4000,
      mats: Object.freeze({ boss_core_weaver: 4, mithril_ingot: 8, crystal_glass: 6 }),
      baseMain: 30,
      baseSec: 24,
    }),
    gloves_boss_weaver_bow: Object.freeze({
      id: 'gloves_boss_weaver_bow',
      tier: 'hollow',
      rarity: 3,
      combatClass: 'ranged',
      bossId: 'hollow_crystal_weaver',
      gold: 4000,
      mats: Object.freeze({ boss_core_weaver: 4, mithril_ingot: 8, crystal_glass: 6 }),
      baseMain: 30,
      baseSec: 24,
    }),
    gloves_boss_weaver_cane: Object.freeze({
      id: 'gloves_boss_weaver_cane',
      tier: 'hollow',
      rarity: 3,
      combatClass: 'magic',
      bossId: 'hollow_crystal_weaver',
      gold: 4000,
      mats: Object.freeze({ boss_core_weaver: 4, mithril_ingot: 8, crystal_glass: 6 }),
      baseMain: 30,
      baseSec: 24,
    }),
    gloves_boss_kitsune_blade: Object.freeze({
      id: 'gloves_boss_kitsune_blade',
      tier: 'reef',
      rarity: 3,
      combatClass: 'melee',
      bossId: 'sakura_nine_tail_kitsune',
      gold: 6500,
      mats: Object.freeze({ boss_core_kitsune: 4, sakura_timber: 12, celestial_pearl: 10 }),
      baseMain: 36,
      baseSec: 28,
    }),
    gloves_boss_kitsune_bow: Object.freeze({
      id: 'gloves_boss_kitsune_bow',
      tier: 'reef',
      rarity: 3,
      combatClass: 'ranged',
      bossId: 'sakura_nine_tail_kitsune',
      gold: 6500,
      mats: Object.freeze({ boss_core_kitsune: 4, sakura_timber: 12, celestial_pearl: 10 }),
      baseMain: 36,
      baseSec: 28,
    }),
    gloves_boss_kitsune_staff: Object.freeze({
      id: 'gloves_boss_kitsune_staff',
      tier: 'reef',
      rarity: 3,
      combatClass: 'magic',
      bossId: 'sakura_nine_tail_kitsune',
      gold: 6500,
      mats: Object.freeze({ boss_core_kitsune: 4, sakura_timber: 12, celestial_pearl: 10 }),
      baseMain: 36,
      baseSec: 28,
    }),
    gloves_boss_bahamut_cleaver: Object.freeze({
      id: 'gloves_boss_bahamut_cleaver',
      tier: 'caldera',
      rarity: 3,
      combatClass: 'melee',
      bossId: 'chronos_solar_bahamut',
      gold: 9500,
      mats: Object.freeze({ boss_core_bahamut: 4, orichalcum_ore: 12, astral_prism: 10 }),
      baseMain: 42,
      baseSec: 34,
    }),
    gloves_boss_bahamut_bow: Object.freeze({
      id: 'gloves_boss_bahamut_bow',
      tier: 'caldera',
      rarity: 3,
      combatClass: 'ranged',
      bossId: 'chronos_solar_bahamut',
      gold: 9500,
      mats: Object.freeze({ boss_core_bahamut: 4, orichalcum_ore: 12, astral_prism: 10 }),
      baseMain: 42,
      baseSec: 34,
    }),
    gloves_boss_bahamut_staff: Object.freeze({
      id: 'gloves_boss_bahamut_staff',
      tier: 'caldera',
      rarity: 3,
      combatClass: 'magic',
      bossId: 'chronos_solar_bahamut',
      gold: 9500,
      mats: Object.freeze({ boss_core_bahamut: 4, orichalcum_ore: 12, astral_prism: 10 }),
      baseMain: 42,
      baseSec: 34,
    }),
  }),
});

export function rollBossWeaponStats({ weaponId, pity = 0, rng = Math.random } = {}) {
  const recipe = BOSS_WEAPON_FORGE.RECIPES[weaponId];
  if (!recipe) return null;

  const nextAttempt = (Math.max(0, pity | 0)) + 1;
  const pityHit = nextAttempt >= BOSS_WEAPON_FORGE.PITY_MAX;
  let chosen = BOSS_WEAPON_FORGE.GRADES[0];

  if (pityHit) {
    // Master Smith 10-roll guarantee: 70% S, 30% SS Masterwork
    chosen = rng() < 0.30 ? BOSS_WEAPON_FORGE.GRADES[3] : BOSS_WEAPON_FORGE.GRADES[2];
  } else {
    const u = rng();
    let acc = 0;
    for (const g of BOSS_WEAPON_FORGE.GRADES) {
      acc += g.rate;
      if (u < acc) {
        chosen = g;
        break;
      }
    }
  }

  const pool = [...BOSS_WEAPON_FORGE.STAT_POOL];
  const idx1 = Math.min(pool.length - 1, Math.floor(rng() * pool.length));
  const mainStat = pool.splice(idx1, 1)[0];
  const idx2 = Math.min(pool.length - 1, Math.floor(rng() * pool.length));
  const secStat = pool[idx2];

  const mainVal = Math.max(1, Math.round(recipe.baseMain * chosen.mult));
  const secVal = Math.max(1, Math.round(recipe.baseSec * chosen.mult));
  const rolledStats = { [mainStat]: mainVal, [secStat]: secVal };
  const isHigh = chosen.grade === 'S' || chosen.grade === 'SS';

  return {
    weaponId,
    grade: chosen.grade,
    gradeLabel: chosen.label,
    rolledStats,
    mainStat,
    secStat,
    pityHit,
    pityNext: isHigh ? 0 : nextAttempt,
  };
}

// ============================================================================
// 9. 8 MASTER CRAFTERS × RAGNAROK MONSTER SKILL SCROLLS
// ============================================================================

export const SKILL_DROP_RATES = Object.freeze({
  MOB_BASE: 0.02,         // 2.0% base * rareFindMult on field mobs
  BOSS_BASE: 0.10,        // 10.0% base * rareFindMult on bosses
  MAX_LEVEL: 5,           // 1 scroll = Lv.1, +4 dupes = Lv.5 MAX (5 total)
  EXCESS_GOLD_MOB: 1200,
  EXCESS_GOLD_BOSS: 3000,
});

export const MONSTER_SKILLS = Object.freeze({
  sk_pollen_ring: Object.freeze({
    id: 'sk_pollen_ring',
    name: 'Golden Pollen Sanctuary',
    icon: '🌸',
    sourceId: 'pollen_wisp',
    sourceName: 'Pollen Wisp',
    region: 'meadow',
    isBossSkill: false,
    cooldownMs: 14000,
    scalingStat: 'fortune',
    aimType: 'self_aoe',
    radius: 4.4,
    durationMs: 5000,
    ticks: 5,
    healPctPerTick: Object.freeze([0.055, 0.064, 0.073, 0.082, 0.095]),
    desc: 'Unfurls a 4.4m golden pollen sacred seal & fairy-mote sanctuary that heals you and nearby Co-Op allies every second for 5s (scales with 💖 Vitality).',
  }),
  sk_jelly_shield: Object.freeze({
    id: 'sk_jelly_shield',
    name: 'Dewdrop Aqua Canopy',
    icon: '🫧',
    sourceId: 'moss_slime',
    sourceName: 'Moss Slime',
    region: 'meadow',
    isBossSkill: false,
    cooldownMs: 12000,
    scalingStat: 'fortune',
    aimType: 'self_aoe',
    radius: 4.2,
    durationMs: 6000,
    shieldMaxHpPct: Object.freeze([0.28, 0.33, 0.38, 0.43, 0.48]),
    slowPct: 0.40,
    slowMs: 3000,
    desc: 'Splashes an emerald-aqua dewdrop ring & translucent 3D bubble canopy around nearby Co-Op allies, granting a 💖 Vitality shield and slowing monsters by 40%.',
  }),
  sk_tusk_rush: Object.freeze({
    id: 'sk_tusk_rush',
    name: 'Gale-Tusk Spiral Charge',
    icon: '💨',
    sourceId: 'thornback_boar',
    sourceName: 'Thornback Boar',
    region: 'meadow',
    isBossSkill: false,
    cooldownMs: 7000,
    scalingStat: 'power',
    aimType: 'line',
    dashDist: 5.2,
    lineWidth: 2.0,
    dmgMult: Object.freeze([1.80, 2.05, 2.30, 2.60, 2.95]),
    stunMs: 850,
    desc: 'Drills 5.2m forward inside a spiraling meadow gale shockwave cone, damaging and stunning every monster along your path for 0.85s (scales with 🔥 Power).',
  }),
  sk_crystal_fan: Object.freeze({
    id: 'sk_crystal_fan',
    name: 'Prism Shard Volley',
    icon: '💎',
    sourceId: 'crystal_beetle',
    sourceName: 'Crystal Beetle',
    region: 'hollow',
    isBossSkill: false,
    cooldownMs: 6500,
    scalingStat: 'power',
    aimType: 'cone',
    range: 7.2,
    arcDeg: 62,
    dmgMult: Object.freeze([2.10, 2.40, 2.70, 3.05, 3.45]),
    desc: 'Blasts a 7.2m, 62° cone spray of cyan-sapphire prism shards that shatter into 3D crystal clusters on impact (scales with 🔥 Power).',
  }),
  sk_echo_drain: Object.freeze({
    id: 'sk_echo_drain',
    name: 'Crimson Lantern Siphon',
    icon: '🦇',
    sourceId: 'lantern_bat',
    sourceName: 'Lantern Bat',
    region: 'hollow',
    isBossSkill: false,
    cooldownMs: 10000,
    scalingStat: 'power',
    aimType: 'self_aoe',
    radius: 3.8,
    dmgMult: Object.freeze([1.65, 1.88, 2.12, 2.36, 2.65]),
    leechPct: 0.25,
    desc: 'Spins a 3.8m crimson-violet nocturnal siphon vortex around you, damaging nearby monsters and leeching 25% of damage dealt back as HP (scales with 🔥 Power).',
  }),
  sk_gravity_spin: Object.freeze({
    id: 'sk_gravity_spin',
    name: 'Astral Mandala Vortex',
    icon: '🪨',
    sourceId: 'quartz_golemling',
    sourceName: 'Quartz Golemling',
    region: 'hollow',
    isBossSkill: false,
    cooldownMs: 11000,
    scalingStat: 'power',
    aimType: 'self_aoe',
    radius: 4.4,
    pullRadius: 4.6,
    dmgMult: Object.freeze([2.00, 2.28, 2.58, 2.88, 3.25]),
    desc: 'Orbits 3D sacred quartz rune-mandalas inside an amethyst cosmic gravity well, pulling nearby monsters inward and cleaving them (scales with 🔥 Power).',
  }),
  sk_earthshatter: Object.freeze({
    id: 'sk_earthshatter',
    name: 'Ancient Megalith Quake',
    icon: '🌲',
    sourceId: 'elder_moss_golem',
    sourceName: 'Elder Moss Golem',
    region: 'meadow',
    isBossSkill: true,
    cooldownMs: 15000,
    scalingStat: 'power',
    aimType: 'ground_aoe',
    castRange: 7.5,
    radius: 4.8,
    dmgMult: Object.freeze([3.00, 3.45, 3.90, 4.35, 4.85]),
    stunMs: 1500,
    desc: 'Boss Relic Skill — Slams the earth up to 7.5m away to erupt 3D granite megaliths and golden seismic shockwaves across a 4.8m crater, dealing heavy 🔥 Power DMG and stunning foes for 1.5s.',
  }),
  sk_prism_beam: Object.freeze({
    id: 'sk_prism_beam',
    name: 'Celestial Prism Ray',
    icon: '🕸️',
    sourceId: 'hollow_crystal_weaver',
    sourceName: 'Hollow Crystal Weaver',
    region: 'hollow',
    isBossSkill: true,
    cooldownMs: 16000,
    scalingStat: 'power',
    aimType: 'line',
    range: 10.0,
    lineWidth: 1.9,
    dmgMult: Object.freeze([3.40, 3.90, 4.40, 4.90, 5.45]),
    desc: 'Boss Relic Skill — Anchors a glowing crystalline hexagram seal beneath your feet and fires a 10.0m piercing starlight prism laser through every foe in a line (scales with 🔥 Power).',
  }),
  sk_zephyr_vault: Object.freeze({
    id: 'sk_zephyr_vault',
    name: 'Zephyr Backstep Volley',
    icon: '🍃',
    sourceId: 'meadow_zephyr_hare',
    sourceName: 'Zephyr Sylph-Hare',
    region: 'meadow',
    isBossSkill: false,
    cooldownMs: 7500,
    scalingStat: 'power',
    aimType: 'cone',
    range: 7.6,
    arcDeg: 70,
    backstepDist: 3.4,
    slowPct: 0.35,
    slowMs: 2500,
    hastePct: 0.30,
    hasteMs: 3500,
    dmgMult: Object.freeze([1.75, 2.00, 2.25, 2.55, 2.90]),
    desc: 'Fires a 7.6m emerald wind-cutter volley in a 70° cone (slowing foes by 35% for 2.5s) while vaulting 3.4m backward to safety and granting +30% Attack Haste for 3.5s (scales with 🔥 Power).',
  }),
  sk_frost_nova: Object.freeze({
    id: 'sk_frost_nova',
    name: 'Permafrost Spore Nova',
    icon: '❄️',
    sourceId: 'hollow_frost_shroom',
    sourceName: 'Frostcap Myconid',
    region: 'hollow',
    isBossSkill: false,
    cooldownMs: 11500,
    scalingStat: 'power',
    aimType: 'self_aoe',
    radius: 4.5,
    freezeMs: 1600,
    slowPct: 0.50,
    slowMs: 4000,
    dmgMult: Object.freeze([1.85, 2.12, 2.40, 2.70, 3.05]),
    desc: 'Detonates a 4.5m ring of crystalline frost spores around you, freezing monsters solid for 1.6s and chilling them by 50% for 4s (scales with 🔥 Power).',
  }),
  sk_foxfire_wisps: Object.freeze({
    id: 'sk_foxfire_wisps',
    name: 'Nine-Shrine Foxfire Orbs',
    icon: '🦊',
    sourceId: 'reef_sakura_kitsune',
    sourceName: 'Sakura Shrine Kitsune',
    region: 'reef',
    isBossSkill: false,
    cooldownMs: 8500,
    scalingStat: 'power',
    aimType: 'homing',
    range: 8.6,
    orbCount: 3,
    dmgMult: Object.freeze([2.25, 2.58, 2.92, 3.28, 3.70]),
    desc: 'Conjures 3 homing sakura-pink spirit foxfire orbs that lock onto nearby foes within 8.6m and detonate on impact (scales with 🔥 Power).',
  }),
  sk_mirror_shell: Object.freeze({
    id: 'sk_mirror_shell',
    name: 'Tide-Pearl Mirror Carapace',
    icon: '🦪',
    sourceId: 'reef_pearl_snapper',
    sourceName: 'Tide-Pearl Snapper',
    region: 'reef',
    isBossSkill: false,
    cooldownMs: 13000,
    scalingStat: 'fortune',
    aimType: 'self_aoe',
    radius: 4.6,
    durationMs: 5000,
    dmgReducePct: 0.45,
    reflectPct: 0.35,
    shieldMaxHpPct: Object.freeze([0.30, 0.35, 0.40, 0.45, 0.52]),
    dmgMult: Object.freeze([1.55, 1.78, 2.02, 2.28, 2.60]),
    desc: 'Encases you in an iridescent pearl barrier for 5s (absorbing 💖 Vitality shield HP, cutting incoming damage by 45%, and reflecting 35% water thorns) while pulsing a 4.6m tide shockwave.',
  }),
  sk_tailwind_gale: Object.freeze({
    id: 'sk_tailwind_gale',
    name: 'Celestial Crane Tailwind',
    icon: '🦢',
    sourceId: 'reef_cloud_crane',
    sourceName: 'Celestial Cloud-Crane',
    region: 'reef',
    isBossSkill: false,
    cooldownMs: 12500,
    scalingStat: 'fortune',
    aimType: 'self_aoe',
    radius: 5.5,
    durationMs: 6000,
    hastePct: 0.35,
    critBonusPct: 0.20,
    healPctPerTick: Object.freeze([0.12, 0.14, 0.16, 0.18, 0.21]),
    desc: 'Summons an uplifting crane feather gale across 5.5m, healing nearby Co-Op allies and granting +35% Move/Attack Haste & +20% Crit for 6s (scales with 💖 Vitality).',
  }),
  sk_koi_whirlpool: Object.freeze({
    id: 'sk_koi_whirlpool',
    name: 'Turquoise Tide Whirlpool',
    icon: '🌊',
    sourceId: 'reef_bell_spirit',
    sourceName: 'Furin Tide-Bell Spirit',
    region: 'reef',
    isBossSkill: false,
    cooldownMs: 12000,
    scalingStat: 'power',
    aimType: 'ground_aoe',
    castRange: 7.8,
    radius: 4.6,
    pullRadius: 4.8,
    durationMs: 4000,
    ticks: 4,
    dmgMult: Object.freeze([0.72, 0.82, 0.94, 1.06, 1.20]),
    desc: 'Anchors a 4.6m spinning turquoise lagoon whirlpool up to 7.8m away that continuously pulls monsters inward and deals 4 pulses of 🔥 Power damage.',
  }),
  sk_sakura_tempest: Object.freeze({
    id: 'sk_sakura_tempest',
    name: 'Nine-Tail Blossom Tempest',
    icon: '🌸',
    sourceId: 'sakura_nine_tail_kitsune',
    sourceName: 'Lady Tamamo, Nine-Tail Kitsune',
    region: 'reef',
    isBossSkill: true,
    cooldownMs: 16500,
    scalingStat: 'power',
    aimType: 'self_aoe',
    radius: 5.6,
    durationMs: 3000,
    ticks: 3,
    dmgMult: Object.freeze([1.22, 1.40, 1.58, 1.78, 2.00]),
    healPctPerTick: Object.freeze([0.06, 0.07, 0.08, 0.09, 0.105]),
    desc: 'Boss Relic Skill — Unleashes Lady Tamamo’s 5.6m sakura shrine storm for 3s, dealing 3 sweeping waves of 🔥 Power DMG to foes while healing Co-Op allies inside!',
  }),
  sk_solar_meteor: Object.freeze({
    id: 'sk_solar_meteor',
    name: 'Cinder-Star Meteor Drop',
    icon: '☄️',
    sourceId: 'sanctum_cinder_salamander',
    sourceName: 'Solar-Cinder Salamander',
    region: 'caldera',
    isBossSkill: false,
    cooldownMs: 10500,
    scalingStat: 'power',
    aimType: 'ground_aoe',
    castRange: 8.2,
    radius: 4.4,
    durationMs: 3000,
    ticks: 3,
    dmgMult: Object.freeze([2.45, 2.80, 3.18, 3.58, 4.05]),
    desc: 'Calls down a blazing solar-cinder meteor up to 8.2m away onto a 4.4m impact zone, dealing massive 🔥 Power impact damage and leaving scorched embers for 3s.',
  }),
  sk_chain_lightning: Object.freeze({
    id: 'sk_chain_lightning',
    name: 'Aether-Coil Chain Arc',
    icon: '⚡',
    sourceId: 'sanctum_arc_automaton',
    sourceName: 'Aether-Owl Automaton',
    region: 'caldera',
    isBossSkill: false,
    cooldownMs: 7500,
    scalingStat: 'power',
    aimType: 'chain',
    range: 8.5,
    bounces: 4,
    bounceRange: 6.0,
    stunMs: 550,
    dmgMult: Object.freeze([2.15, 2.46, 2.80, 3.15, 3.55]),
    desc: 'Discharges high-voltage aether lightning that arcs across up to 4 monsters within 8.5m, dealing 🔥 Power DMG and micro-stunning each target for 0.55s.',
  }),
  sk_star_brand: Object.freeze({
    id: 'sk_star_brand',
    name: 'Astral Griffon Judgement',
    icon: '🌠',
    sourceId: 'sanctum_star_gargoyle',
    sourceName: 'Astral-Shard Griffon',
    region: 'caldera',
    isBossSkill: false,
    cooldownMs: 11000,
    scalingStat: 'power',
    aimType: 'ground_aoe',
    castRange: 8.0,
    radius: 4.2,
    vulnPct: 0.25,
    vulnMs: 5000,
    dmgMult: Object.freeze([2.20, 2.52, 2.86, 3.22, 3.65]),
    desc: 'Calls down an amethyst starlight spear up to 8.0m away across 4.2m, dealing 🔥 Power DMG and branding struck foes to take +25% bonus damage from all party members for 5s!',
  }),
  sk_time_dilation: Object.freeze({
    id: 'sk_time_dilation',
    name: 'Chronos Astrolabe Field',
    icon: '⏳',
    sourceId: 'sanctum_chrono_sentinel',
    sourceName: 'Chrono-Gear Sentinel',
    region: 'caldera',
    isBossSkill: false,
    cooldownMs: 14000,
    scalingStat: 'fortune',
    aimType: 'self_aoe',
    radius: 5.0,
    slowPct: 0.65,
    slowMs: 4500,
    cdRefundMs: 2500,
    dmgMult: Object.freeze([1.65, 1.90, 2.15, 2.42, 2.75]),
    desc: 'Expands a 5.0m golden clockwork time-dome that slows monsters by 65% for 4.5s, deals shockwave DMG, and rewinds 2.5s off your other Monster Skill cooldown!',
  }),
  sk_supernova_cleave: Object.freeze({
    id: 'sk_supernova_cleave',
    name: 'Solar-Bahamut Supernova',
    icon: '☀️',
    sourceId: 'chronos_solar_bahamut',
    sourceName: 'Chronos-Solar Bahamut',
    region: 'caldera',
    isBossSkill: true,
    cooldownMs: 17500,
    scalingStat: 'power',
    aimType: 'cone',
    range: 8.5,
    arcDeg: 95,
    stunMs: 1400,
    dmgMult: Object.freeze([3.65, 4.18, 4.72, 5.28, 5.90]),
    desc: 'Boss Relic Skill — Channels Chronos-Solar Bahamut’s 95° golden supernova cataclysm up to 8.5m forward, dealing colossal 🔥 Power DMG and stunning foes for 1.4s!',
  }),
});

export const MONSTER_SKILL_IDS = Object.freeze(Object.keys(MONSTER_SKILLS));

const SKILL_BY_SOURCE = Object.freeze(
  Object.fromEntries(Object.values(MONSTER_SKILLS).map((sk) => [sk.sourceId, sk])),
);

export function skillBySource(sourceId) {
  return SKILL_BY_SOURCE[sourceId] || null;
}

export function skillCooldownMs(skillId, stats = {}) {
  const def = MONSTER_SKILLS[skillId];
  if (!def) return 10000;
  const swiftness = Math.max(0, Number(stats?.swiftness) || 0);
  const hasteMult = 1 + softCap(swiftness, 0.35, 150);
  return Math.max(1500, Math.round(def.cooldownMs / hasteMult));
}

export function computeSkillNumbers(skillId, level = 1, stats = {}, maxHp = 100) {
  const def = MONSTER_SKILLS[skillId];
  if (!def) return { damage: 0, healPerTick: 0, shieldHp: 0 };
  const lvIdx = Math.max(0, Math.min(4, (Number(level) || 1) - 1));
  const power = Math.max(0, Number(stats?.power) || 0);
  const vit = Math.max(0, Number(stats?.fortune) || 0);
  const pwrMult = 1 + softCap(power, 0.85, 150);
  const healMult = 1 + softCap(vit, 0.65, 150);

  const dmgScale = def.dmgMult ? def.dmgMult[lvIdx] : 0;
  const damage = dmgScale > 0 ? Math.max(1, Math.round(16 * dmgScale * pwrMult)) : 0;

  const healPct = def.healPctPerTick ? def.healPctPerTick[lvIdx] : 0;
  const healPerTick = healPct > 0 ? Math.max(2, Math.round(maxHp * healPct * healMult)) : 0;

  const shieldPct = def.shieldMaxHpPct ? def.shieldMaxHpPct[lvIdx] : 0;
  const shieldHp = shieldPct > 0 ? Math.max(8, Math.round(maxHp * shieldPct * healMult)) : 0;

  return { damage, healPerTick, shieldHp, lv: lvIdx + 1 };
}

export function rollMonsterSkillDrop({
  sourceId,
  isBoss = false,
  isElite = false,
  rareFindMult = 1,
  rng = Math.random,
} = {}) {
  const sk = skillBySource(sourceId);
  if (!sk) return { dropped: false, skillId: null };

  const mult = Math.max(1, Number(rareFindMult) || 1);
  if (isBoss) {
    const chance = Math.min(0.50, SKILL_DROP_RATES.BOSS_BASE * mult);
    if (rng() < chance) {
      return { dropped: true, skillId: sk.id };
    }
    return { dropped: false, skillId: null };
  }

  const base = isElite
    ? SKILL_DROP_RATES.MOB_BASE * ALPHA_ELITE.SCROLL_MULT
    : SKILL_DROP_RATES.MOB_BASE;
  const cap = isElite ? 0.35 : 0.15;
  const chance = Math.min(cap, base * mult);
  if (rng() < chance) {
    return { dropped: true, skillId: sk.id, isElite };
  }
  return { dropped: false, skillId: null };
}

// ============================================================================
// 8. MONSTER CODEX & DROP GUIDE (Bestiary Metadata + Exact Drop % Calculator)
// ============================================================================

export const MONSTER_CODEX_META = Object.freeze({
  moss_slime: Object.freeze({
    id: 'moss_slime',
    isBoss: false,
    icon: '🫧',
    sprite: '/assets/village/sf_mob_moss_slime.png',
    role: 'Gentle · Jelly Shield',
    habitatName: 'Whispering Grove',
    poiKey: 'grove',
    coords: Object.freeze({ x: -22, z: 8 }),
    lore: 'Bouncy emerald slimes clustering near shaded forest streams. Gentle grazers until struck — drops Dewdrop Aqua Canopy!',
  }),
  pollen_wisp: Object.freeze({
    id: 'pollen_wisp',
    isBoss: false,
    icon: '🧚',
    sprite: '/assets/village/sf_mob_pollen_wisp.png',
    role: 'Gentle · Ranged Spirit',
    habitatName: 'Windmill Wheatfields',
    poiKey: 'wheat',
    coords: Object.freeze({ x: 20, z: 12 }),
    lore: 'Nimble golden-pollen sprites floating over sunlit wheatfields. Unboxes the coveted Golden Pollen Sanctuary healing scroll!',
  }),
  meadow_zephyr_hare: Object.freeze({
    id: 'meadow_zephyr_hare',
    isBoss: false,
    icon: '🐰',
    sprite: '/assets/village/sf_mob_zephyr_hare.png',
    role: 'Gentle · Wind Skirmisher',
    habitatName: 'Sunlit Breeze Grotto',
    poiKey: 'grotto',
    coords: Object.freeze({ x: 24, z: -14 }),
    lore: 'Leaf-eared sylph rabbits riding clover wind-currents around the eastern grotto. Teaches Rangers & Mystics Zephyr Backstep Volley!',
  }),
  thornback_boar: Object.freeze({
    id: 'thornback_boar',
    isBoss: false,
    icon: '🐗',
    sprite: '/assets/village/sf_mob_thornback_boar.png',
    role: 'Pack · Tusk Charger',
    habitatName: 'Granite Foothills',
    poiKey: 'boulders',
    coords: Object.freeze({ x: -16, z: -8 }),
    lore: 'Territorial tusked boars patrolling mossy granite boulders in packs of 4. Drops Monster Fangs and Gale-Tusk Spiral Charge.',
  }),
  elder_moss_golem: Object.freeze({
    id: 'elder_moss_golem',
    isBoss: true,
    icon: '👑',
    sprite: '/assets/village/sf_boss_moss_golem.png',
    role: '3-Phase Region Boss',
    habitatName: 'Moss Golem Altar',
    poiKey: 'golem',
    coords: Object.freeze({ x: -20, z: -18 }),
    craftTierLabel: '★2 Epic Meadow Boss Arms',
    lore: 'Ancient megalith guardian of Whispering Meadow. Summon at the southwestern altar to farm Elder Moss Cores, Tier 1 Charms, and Ancient Megalith Quake.',
  }),
  hollow_frost_shroom: Object.freeze({
    id: 'hollow_frost_shroom',
    isBoss: false,
    icon: '🍄',
    sprite: '/assets/village/sf_mob_frost_shroom.png',
    role: 'Gentle · Cryo Spore',
    habitatName: 'Rime-Crystal Glade',
    poiKey: 'frost_glade',
    coords: Object.freeze({ x: -18, z: 16 }),
    lore: 'Plump ice-capped cavern myconids puffing shimmering frost motes. Drops the crowd-control powerhouse Permafrost Spore Nova!',
  }),
  crystal_beetle: Object.freeze({
    id: 'crystal_beetle',
    isBoss: false,
    icon: '🪲',
    sprite: '/assets/village/sf_mob_crystal_beetle.png',
    role: 'Pack · Prism Carapace',
    habitatName: 'Violet Quartz Cavern',
    poiKey: 'quartz',
    coords: Object.freeze({ x: -20, z: 0 }),
    lore: 'Armored cavern beetles encrusted with cyan prism spikes. Reliable Crystal Hollow farm for Crystal Ore and Prism Shard Volley.',
  }),
  lantern_bat: Object.freeze({
    id: 'lantern_bat',
    isBoss: false,
    icon: '🦇',
    sprite: '/assets/village/sf_mob_lantern_bat.png',
    role: 'Pack · Swift Leecher',
    habitatName: 'Mithril Deep Vein',
    poiKey: 'mithril',
    coords: Object.freeze({ x: 20, z: -10 }),
    lore: 'Plump subterranean bats carrying warm amber lantern-orbs. Unlocks Crimson Lantern Siphon for self-sustaining melee brawlers.',
  }),
  quartz_golemling: Object.freeze({
    id: 'quartz_golemling',
    isBoss: false,
    icon: '🗿',
    sprite: '/assets/village/sf_mob_quartz_golemling.png',
    role: 'Pack · Gravity Sentinel',
    habitatName: 'Sanctum Approach',
    poiKey: 'sanctum_guard',
    coords: Object.freeze({ x: 14, z: -20 }),
    lore: 'Chunky amethyst-infused stone sentinels guarding the Weaver approach. Drops Astral Mandala Vortex to vacuum whole packs together!',
  }),
  hollow_crystal_weaver: Object.freeze({
    id: 'hollow_crystal_weaver',
    isBoss: true,
    icon: '👑',
    sprite: '/assets/village/sf_boss_crystal_weaver.png',
    role: '3-Phase Mythic Boss',
    habitatName: 'Weaver Boss Sanctum',
    poiKey: 'boss',
    coords: Object.freeze({ x: 0, z: -26 }),
    craftTierLabel: '★3 Mythic Hollow Boss Arms',
    lore: 'Sovereign crystalline arachnid-guardian of Crystal Hollow. Drops Crystal Weaver Cores for ★3 Mythic Workshop weapons, Tier 2 Charms, and Celestial Prism Ray!',
  }),
  reef_sakura_kitsune: Object.freeze({
    id: 'reef_sakura_kitsune',
    isBoss: false,
    icon: '🦊',
    sprite: '/assets/village/sf_mob_sakura_kitsune.png',
    role: 'Pack · Foxfire Spirit',
    habitatName: 'Torii Blossom Woods',
    poiKey: 'shrine_woods',
    coords: Object.freeze({ x: -22, z: 10 }),
    lore: 'Mischievous shrine fox-spirits wreathed in rose-pink lantern flames. Drops Sakura Timber and Nine-Shrine Foxfire Orbs!',
  }),
  reef_pearl_snapper: Object.freeze({
    id: 'reef_pearl_snapper',
    isBoss: false,
    icon: '🐢',
    sprite: '/assets/village/sf_mob_pearl_snapper.png',
    role: 'Gentle · Shell Bastion',
    habitatName: 'Luminous Pearl Shoals',
    poiKey: 'pearl_shoals',
    coords: Object.freeze({ x: 22, z: 10 }),
    lore: 'Mossy reef terrapins carrying iridescent pearls on their shells. Drops Celestial Pearls and Tide-Pearl Mirror Carapace!',
  }),
  reef_cloud_crane: Object.freeze({
    id: 'reef_cloud_crane',
    isBoss: false,
    icon: '🦢',
    sprite: '/assets/village/sf_mob_cloud_crane.png',
    role: 'Gentle · Gale Dancer',
    habitatName: 'Cloud-Lotus Roost',
    poiKey: 'crane_roost',
    coords: Object.freeze({ x: -20, z: -14 }),
    lore: 'Graceful ribbon-crowned sky cranes gliding over lotus pools. Grants the party haste & crit anthem Celestial Crane Tailwind!',
  }),
  reef_bell_spirit: Object.freeze({
    id: 'reef_bell_spirit',
    isBoss: false,
    icon: '🎐',
    sprite: '/assets/village/sf_mob_bell_spirit.png',
    role: 'Pack · Tide Caller',
    habitatName: 'Singing Furin Lagoon',
    poiKey: 'bell_lagoon',
    coords: Object.freeze({ x: 20, z: -14 }),
    lore: 'Translucent aqua wind-bell jellyfish chiming in harmony. Drops Cloud Lotus and Turquoise Tide Whirlpool!',
  }),
  sakura_nine_tail_kitsune: Object.freeze({
    id: 'sakura_nine_tail_kitsune',
    isBoss: true,
    icon: '👑',
    sprite: '/assets/village/sf_boss_sakura_kitsune.png',
    role: '3-Phase Shrine Sovereign',
    habitatName: 'Grand Sakura Torii Altar',
    poiKey: 'boss',
    coords: Object.freeze({ x: 0, z: -26 }),
    craftTierLabel: '★3 Mythic Sakura Boss Arms',
    lore: 'Revered nine-tailed shrine sovereign of Celestial Sakura Reef. Drops Nine-Tail Kitsune Cores, Tier 2 Charms, and Nine-Tail Blossom Tempest!',
  }),
  sanctum_cinder_salamander: Object.freeze({
    id: 'sanctum_cinder_salamander',
    isBoss: false,
    icon: '🦎',
    sprite: '/assets/village/sf_mob_cinder_salamander.png',
    role: 'Pack · Solar Pyro',
    habitatName: 'Solar-Ember Vents',
    poiKey: 'cinder_vents',
    coords: Object.freeze({ x: -22, z: 10 }),
    lore: 'Obsidian-plated salamanders crowned with glowing amber solar crystals. Drops Orichalcum Ore and Cinder-Star Meteor Drop!',
  }),
  sanctum_arc_automaton: Object.freeze({
    id: 'sanctum_arc_automaton',
    isBoss: false,
    icon: '🦉',
    sprite: '/assets/village/sf_mob_arc_automaton.png',
    role: 'Pack · Tesla Construct',
    habitatName: ' Brass Gear Foundry',
    poiKey: 'gear_foundry',
    coords: Object.freeze({ x: 22, z: 10 }),
    lore: 'Clockwork brass owl constructs crackling with twin aether coils. Teaches the multi-bounce AoE clearer Aether-Coil Chain Arc!',
  }),
  sanctum_star_gargoyle: Object.freeze({
    id: 'sanctum_star_gargoyle',
    isBoss: false,
    icon: '🦅',
    sprite: '/assets/village/sf_mob_star_gargoyle.png',
    role: 'Pack · Astral Lancer',
    habitatName: 'Amethyst Prism Spires',
    poiKey: 'prism_spires',
    coords: Object.freeze({ x: -20, z: -14 }),
    lore: 'Winged obsidian-and-gold griffon sentinels wielding starlight halberds. Unlocks the +25% party vulnerability mark Astral Griffon Judgement!',
  }),
  sanctum_chrono_sentinel: Object.freeze({
    id: 'sanctum_chrono_sentinel',
    isBoss: false,
    icon: '🤖',
    sprite: '/assets/village/sf_mob_chrono_sentinel.png',
    role: 'Pack · Time Guardian',
    habitatName: 'Grand Orrery Ring',
    poiKey: 'chrono_ring',
    coords: Object.freeze({ x: 20, z: -14 }),
    lore: 'Towering clockwork knights bearing living chest-chronometers. Drops Chronos Astrolabe Field to freeze time and rewind skill cooldowns!',
  }),
  chronos_solar_bahamut: Object.freeze({
    id: 'chronos_solar_bahamut',
    isBoss: true,
    icon: '👑',
    sprite: '/assets/village/sf_boss_solar_bahamut.png',
    role: '3-Phase Starforge Apex Boss',
    habitatName: 'Apex Solar Astrolabe Altar',
    poiKey: 'boss',
    coords: Object.freeze({ x: 0, z: -26 }),
    craftTierLabel: '★3 Sovereign-Forge Bahamut Arms',
    lore: 'Apex clockwork-solar dragon ruler of the Star-Caldera. Drops Chronos-Solar Cores for pinnacle Workshop weapons, Tier 2 Charms, and Solar-Bahamut Supernova!',
  }),
});

export const MONSTER_CODEX_IDS = Object.freeze(Object.keys(MONSTER_CODEX_META));

/**
 * Pure Monster Codex builder returning complete monster stats, habitat coordinates,
 * and exact Base vs Live (🍀 Luck / 💖 Vitality) drop tables for all 8 Frontier foes.
 */
export function buildMonsterCodex({
  stats = {},
  skills = null,
  killsByMob = null,
} = {}) {
  const luck = Math.max(0, Number(stats?.luck) || 0);
  const vit = Math.max(0, Number(stats?.fortune) || 0);
  const rareFindMult = 1 + softCap(luck, 0.35, 140);
  const charmLuckMult = 1 + softCap(luck, 0.25, 140);
  const yieldMult = 1 + softCap(vit, 0.50, 140);
  const unlockedSkills = skills?.unlocked || {};
  const equippedSkills = Array.isArray(skills?.equipped) ? skills.equipped : [null, null];

  return MONSTER_CODEX_IDS.map((id) => {
    const meta = MONSTER_CODEX_META[id];
    const isBoss = Boolean(meta.isBoss);
    const src = isBoss ? BOSSES[id] : MONSTERS[id];
    const sk = skillBySource(id);
    const kills = Math.max(0, Number(killsByMob?.[id]) || 0);

    // 1. Material / Boss Core drops (100% guaranteed per kill)
    const materialDrops = Object.entries(src?.drop || {}).map(([itemId, qtySpec]) => {
      const isRange = Array.isArray(qtySpec);
      const minQty = isRange ? qtySpec[0] : Number(qtySpec) || 1;
      const maxQty = isRange ? qtySpec[1] : Number(qtySpec) || 1;
      const boostedMax = !isBoss && yieldMult > 1.05 ? Math.max(maxQty, Math.round(maxQty * yieldMult)) : maxQty;
      return {
        kind: isBoss ? 'boss_core' : 'material',
        itemId,
        qtyText: isRange
          ? `×${minQty}–${maxQty}`
          : boostedMax > minQty
          ? `×${minQty}–${boostedMax}`
          : `×${minQty}`,
        baseChancePct: 100,
        liveChancePct: 100,
        guaranteed: true,
        craftNote: meta.craftTierLabel || null,
      };
    });

    // 2. Signature Monster Skill Scroll drop (Pure % × Luck RNG)
    let scrollDrop = null;
    if (sk) {
      const baseRate = isBoss ? SKILL_DROP_RATES.BOSS_BASE : SKILL_DROP_RATES.MOB_BASE;
      const capRate = isBoss ? 0.50 : 0.15;
      const liveRate = Math.min(capRate, baseRate * rareFindMult);
      const alphaLiveRate = isBoss ? null : Math.min(0.35, baseRate * ALPHA_ELITE.SCROLL_MULT * rareFindMult);
      const curLv = Math.max(0, Number(unlockedSkills[sk.id]) || 0);
      scrollDrop = {
        kind: 'skill_scroll',
        skillId: sk.id,
        name: sk.name,
        icon: sk.icon,
        level: curLv,
        isMax: curLv >= SKILL_DROP_RATES.MAX_LEVEL,
        equippedSlot: equippedSkills.indexOf(sk.id),
        baseChancePct: +(baseRate * 100).toFixed(2),
        liveChancePct: +(liveRate * 100).toFixed(2),
        alphaChancePct: alphaLiveRate != null ? +(alphaLiveRate * 100).toFixed(1) : null,
      };
    }

    // 3. Boss Ultimate Charm drops (Pure % × Luck RNG)
    const charmDrops = [];
    if (isBoss && src?.charmTiers) {
      const tiers = Object.entries(src.charmTiers).sort((a, b) => Number(b[0]) - Number(a[0]));
      for (const [tier, rate] of tiers) {
        const baseRate = Number(rate) || 0;
        const liveRate = Math.min(0.60, baseRate * charmLuckMult);
        charmDrops.push({
          kind: 'charm',
          tier: Number(tier),
          label: Number(tier) >= 2 ? 'Tier II Mythic Charm' : 'Tier I Boss Charm',
          icon: Number(tier) >= 2 ? '🌟' : '🔮',
          baseChancePct: +(baseRate * 100).toFixed(1),
          liveChancePct: +(liveRate * 100).toFixed(1),
        });
      }
    }

    return {
      id,
      name: src?.name || id,
      region: src?.region || 'meadow',
      isBoss,
      icon: meta.icon,
      sprite: meta.sprite,
      role: meta.role,
      hp: src?.hp || 30,
      dmg: src?.dmg || 4,
      speed: isBoss ? 1.1 : (src?.speed || 1.5),
      ranged: Boolean(src?.ranged),
      xp: src?.xp || (isBoss ? 120 : Math.max(5, Math.round((src?.hp || 30) / 7))),
      phases: isBoss ? (src?.phases?.length || 3) : 1,
      aggroStyle: isBoss ? 'boss' : (src?.aggroStyle || 'pack'),
      packSize: isBoss ? 1 : (src?.packSize || 7),
      habitatName: String(meta.habitatName || '').trim(),
      poiKey: meta.poiKey,
      coords: meta.coords,
      lore: meta.lore,
      kills,
      materialDrops,
      scrollDrop,
      charmDrops,
      rareFindMult,
      yieldMult,
    };
  });
}
