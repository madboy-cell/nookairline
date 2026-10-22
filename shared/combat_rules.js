// shared/combat_rules.js — Authoritative combat, invasion, boss, and ultimate rules for Sky Frontier (V2).
// Pure functions, zero I/O. Deterministic with now/rng parameters.

import { softCap } from './universal_stats.js';

// ============================================================================
// 1. MONSTERS & BOSSES
// ============================================================================

export const MONSTERS = Object.freeze({
  moss_slime: Object.freeze({
    id: 'moss_slime',
    name: 'Moss Slime',
    region: 'meadow',
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
    hp: 60,
    dmg: 8,
    speed: 2.2,
    drop: Object.freeze({ monster_fang: 1, monster_gel: 1 }),
  }),
  pollen_wisp: Object.freeze({
    id: 'pollen_wisp',
    name: 'Pollen Wisp',
    region: 'meadow',
    hp: 20,
    dmg: 3,
    speed: 2.6,
    ranged: true,
    drop: Object.freeze({ herb_seed: 1 }),
  }),
  crystal_beetle: Object.freeze({
    id: 'crystal_beetle',
    name: 'Crystal Beetle',
    region: 'hollow',
    hp: 80,
    dmg: 9,
    speed: 1.6,
    drop: Object.freeze({ crystal_ore: 2, monster_gel: 1 }),
  }),
  lantern_bat: Object.freeze({
    id: 'lantern_bat',
    name: 'Lantern Bat',
    region: 'hollow',
    hp: 40,
    dmg: 6,
    speed: 3.0,
    drop: Object.freeze({ monster_fang: 1 }),
  }),
  quartz_golemling: Object.freeze({
    id: 'quartz_golemling',
    name: 'Quartz Golemling',
    region: 'hollow',
    hp: 140,
    dmg: 14,
    speed: 1.1,
    drop: Object.freeze({ crystal_ore: 3, monster_fang: 1 }),
  }),
});

export const BOSSES = Object.freeze({
  elder_moss_golem: Object.freeze({
    id: 'elder_moss_golem',
    name: 'Elder Moss Golem',
    region: 'meadow',
    hp: 2400,
    dmg: 22,
    phases: Object.freeze([1, 0.6, 0.3]),
    drop: Object.freeze({ boss_core_moss: Object.freeze([2, 4]) }),
    charmTiers: Object.freeze({ 1: 0.18 }),
    pity: 6,
  }),
  hollow_crystal_weaver: Object.freeze({
    id: 'hollow_crystal_weaver',
    name: 'Hollow Crystal Weaver',
    region: 'hollow',
    hp: 4200,
    dmg: 30,
    phases: Object.freeze([1, 0.6, 0.3]),
    drop: Object.freeze({ boss_core_weaver: Object.freeze([2, 4]) }),
    charmTiers: Object.freeze({ 1: 0.10, 2: 0.12 }),
    pity: 10,
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
// 6. BOSS LOOT & PITY
// ============================================================================

export function rollBossLoot({
  bossId,
  qualifying,
  rng = Math.random,
  luckByUser = {},
  pityByUser = {},
} = {}) {
  const boss = BOSSES[bossId];
  if (!boss) throw new Error(`Unknown bossId: ${bossId}`);

  const users = Array.isArray(qualifying)
    ? qualifying
    : (qualifying && typeof qualifying === 'object' ? Object.keys(qualifying) : []);

  const results = {};

  const listedTiers = Object.keys(boss.charmTiers).map(Number).sort((a, b) => a - b);
  const lowestTier = listedTiers[0] ?? 1;
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

    const currentPity = Number(pityByUser[u]) || 0;
    const pityTriggered = (currentPity + 1) >= boss.pity;

    const roll = rng();
    let droppedTier = null;
    let cumulative = 0;
    for (const tier of descendingTiers) {
      const baseRate = boss.charmTiers[tier] || 0;
      const chance = baseRate * luckMult;
      cumulative += chance;
      if (roll < cumulative) {
        droppedTier = tier;
        break;
      }
    }

    let charmTier = droppedTier;
    let pityReset = false;

    if (charmTier !== null) {
      pityReset = true;
    } else if (pityTriggered) {
      charmTier = lowestTier;
      pityReset = true;
    }

    results[u] = {
      items,
      charmTier,
      pityReset,
    };
  }

  return results;
}
