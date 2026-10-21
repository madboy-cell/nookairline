// shared/charm_catalog.js — Authoritative Catalog & Drop/Stat Resolver for the 16 Drop-Only
// "Ragnarok-Style" Starlight Aura Charms (Tiers 1 -> 4 MVP Secret Rare).
// Zero Gacha: Dropped exclusively from Moon Sanctuary Bosses (Waves 5 -> 50).

export const CHARM_STAT_KEYS = Object.freeze(['fortune', 'swiftness', 'power', 'luck']);

export const CHARM_TIERS = Object.freeze({
  1: Object.freeze({
    tier: 1,
    key: 'meadow',
    name: 'Meadow Keepsake',
    badge: '🎀 Tier 1',
    minWave: 5,
    baseDropRate: 0.12,
    statMin: 18,
    statMax: 25,
    color: '#ff8cb8',
    pillarHeight: 1.5,
  }),
  2: Object.freeze({
    tier: 2,
    key: 'relic',
    name: 'Sanctuary Relic',
    badge: '💎 Tier 2',
    minWave: 15,
    baseDropRate: 0.07,
    statMin: 38,
    statMax: 52,
    color: '#54c8ff',
    pillarHeight: 3.2,
  }),
  3: Object.freeze({
    tier: 3,
    key: 'sovereign',
    name: 'Sovereign Treasure',
    badge: '🌸 Tier 3',
    minWave: 25,
    baseDropRate: 0.035,
    statMin: 75,
    statMax: 100,
    color: '#ff66d9',
    pillarHeight: 5.5,
  }),
  4: Object.freeze({
    tier: 4,
    key: 'mvp',
    name: 'MVP Secret Rare',
    badge: '👑 Tier 4 MVP',
    minWave: 35,
    baseDropRate: 0.015,
    wave50DropRate: 0.05,
    statMin: 140,
    statMax: 185,
    color: '#ffd859',
    pillarHeight: 7.5,
  }),
});

export const CHARM_GRADES = Object.freeze({
  B: Object.freeze({ id: 'B', label: 'B-Grade', mult: 1.0, weight: 50, color: '#9ec5e8', auraScale: 1.0 }),
  A: Object.freeze({ id: 'A', label: 'A-Grade', mult: 1.3, weight: 32, color: '#b488ff', auraScale: 1.05 }),
  S: Object.freeze({ id: 'S', label: 'S-Grade', mult: 1.7, weight: 14, color: '#ffd24c', auraScale: 1.12 }),
  SS: Object.freeze({ id: 'SS', label: 'SS-Grade', mult: 2.25, weight: 4, color: '#ff6be6', auraScale: 1.25 }),
});

export const CHARMS = Object.freeze({
  // =========================================================================
  // 🎀 TIER 1: MEADOW KEEPSAKES (Waves 5+ • Petite Knee Wisp + Footstep Blooms)
  // =========================================================================
  charm_berry_perfume: Object.freeze({
    id: 'charm_berry_perfume',
    name: 'Berry Dew Perfume',
    tier: 1,
    icon: '🍓',
    art: '/assets/ui/charms/charm_berry_perfume.png',
    auraKind: 'charm_berry_perfume',
    visualDesc: 'Petite Berry Dew Wisp hovering by your knee + glossy pink strawberry soap-bubbles & footstep blooms.',
    cheatTitle: 'Sweet Greed',
    cheatDesc: 'Monsters drop +20% extra Moon Coins inside waves.',
    cheat: Object.freeze({ coinDropBonusPct: 0.20 }),
  }),
  charm_clover_bell: Object.freeze({
    id: 'charm_clover_bell',
    name: 'Four-Leaf Clover Bell',
    tier: 1,
    icon: '🍀',
    art: '/assets/ui/charms/charm_clover_bell.png',
    auraKind: 'charm_clover_bell',
    visualDesc: 'Petite Clover Bell Wisp hovering by your knee + blooming emerald 4-leaf clovers behind every footstep.',
    cheatTitle: 'Lucky Sprout',
    cheatDesc: '+12% chance for ★1 Shop Cards to spawn already upgraded to ★★2!',
    cheat: Object.freeze({ luckyStar2BonusPct: 0.12 }),
  }),
  charm_ribbon_musicbox: Object.freeze({
    id: 'charm_ribbon_musicbox',
    name: 'Ribbon Music Box',
    tier: 1,
    icon: '🎀',
    art: '/assets/ui/charms/charm_ribbon_musicbox.png',
    auraKind: 'charm_ribbon_musicbox',
    visualDesc: 'Petite Music Box Wisp hovering by your waist + pastel musical notes (🎵) & footstep blooms.',
    cheatTitle: 'Allegro Tempo',
    cheatDesc: 'Increases Hero, Pet & Guardian Attack Speed by +18%.',
    cheat: Object.freeze({ atkSpeedBonusPct: 0.18 }),
  }),
  charm_honeybee_lantern: Object.freeze({
    id: 'charm_honeybee_lantern',
    name: 'Honeybee Lantern',
    tier: 1,
    icon: '🌼',
    art: '/assets/ui/charms/charm_honeybee_lantern.png',
    auraKind: 'charm_honeybee_lantern',
    visualDesc: 'Petite Honeybee Lantern Wisp hovering by your waist + golden nectar sparkles & daisy footsteps.',
    cheatTitle: 'Royal Nectar',
    cheatDesc: 'Raises Max Wave Interest Cap by +3 🪙/wave & heals Shrine +40 HP each wave.',
    cheat: Object.freeze({ interestCapBonus: 3, waveHealHp: 40 }),
  }),

  // =========================================================================
  // 💎 TIER 2: SANCTUARY RELICS (Waves 15+ • Compact Ground Seal + Whisper Wisp)
  // =========================================================================
  charm_cinderella_watch: Object.freeze({
    id: 'charm_cinderella_watch',
    name: 'Glass Slipper Pocketwatch',
    tier: 2,
    icon: '🕰️',
    art: '/assets/ui/charms/charm_cinderella_watch.png',
    auraKind: 'charm_cinderella_watch',
    visualDesc: 'Compact Roman-numeral clockface seal under feet + Whisper Pocketwatch Wisp & stardust wake.',
    cheatTitle: 'Midnight Rewind',
    cheatDesc: 'Every 7th Guardian attack rewinds the target 4.5m backward & slows by 35%.',
    cheat: Object.freeze({ rewindEveryShots: 7, rewindDistM: 4.5, rewindSlowPct: 0.35 }),
  }),
  charm_siren_pearl: Object.freeze({
    id: 'charm_siren_pearl',
    name: 'Siren Pearl Clam',
    tier: 2,
    icon: '🧜‍♀️',
    art: '/assets/ui/charms/charm_siren_pearl.png',
    auraKind: 'charm_siren_pearl',
    visualDesc: 'Compact aqua ocean-wave seal under feet + Whisper Siren Pearl Wisp & floating iridescent bubbles.',
    cheatTitle: 'Tidal Undertow',
    cheatDesc: 'Guardian attacks pull monsters toward the center S-bend & apply a 40% Slow.',
    cheat: Object.freeze({ vortexPullOnHit: true, slowOnHitPct: 0.40 }),
  }),
  charm_roulette_watch: Object.freeze({
    id: 'charm_roulette_watch',
    name: 'High-Roller Roulette Compass',
    tier: 2,
    icon: '🎰',
    art: '/assets/ui/charms/charm_roulette_watch.png',
    auraKind: 'charm_roulette_watch',
    visualDesc: 'Compact Golden Casino Roulette Wheel under feet + Whisper Roulette Wisp & flying poker sparks.',
    cheatTitle: 'House Edge',
    cheatDesc: '35% chance Shop Rerolls cost 0 🪙 (FREE) + Critical Hits mint +5 🪙 Coins.',
    cheat: Object.freeze({ freeRerollChance: 0.35, critBonusCoins: 5 }),
  }),
  charm_phantom_mirror: Object.freeze({
    id: 'charm_phantom_mirror',
    name: 'Phantom Masque Mirror',
    tier: 2,
    icon: '🎭',
    art: '/assets/ui/charms/charm_phantom_mirror.png',
    auraKind: 'charm_phantom_mirror',
    visualDesc: 'Compact Violet Mirror-Lace Pentagram seal + Whisper Phantom Mirror Wisp & silver-violet sparks.',
    cheatTitle: 'Mirror Twin-Cast',
    cheatDesc: 'All 6 Pedestal Guardians gain a 25% chance on every shot to fire a 2nd Clone Shot!',
    cheat: Object.freeze({ doubleShotChance: 0.25 }),
  }),

  // =========================================================================
  // 🌸 TIER 3: SOVEREIGN TREASURES (Waves 25+ • Large Seal + Radiant Wisp + 1 Silk Comet Tail)
  // =========================================================================
  charm_kitsune_omamori: Object.freeze({
    id: 'charm_kitsune_omamori',
    name: 'Kitsune Fox-Fire Omamori',
    tier: 3,
    icon: '🦊',
    art: '/assets/ui/charms/charm_kitsune_omamori.png',
    auraKind: 'charm_kitsune_omamori',
    visualDesc: 'Large Vermilion Torii ground seal + Radiant Fox-Fire Spirit Wisp with single Sakura silk comet tail.',
    cheatTitle: 'Miracle Skip-Merge & Fox-Fire Warp',
    cheatDesc: '28% chance ★1 + ★1 merges jump straight to ★★★3! Auto-casts Fox-Fire Gate Warp every 12s.',
    cheat: Object.freeze({
      miracleSkipMergeChance: 0.28,
      autoSpell: 'foxfire_warp',
      autoSpellCdSec: 12,
      warpCount: 3,
    }),
  }),
  charm_glacial_snowglobe: Object.freeze({
    id: 'charm_glacial_snowglobe',
    name: 'Glacial Swan Snowglobe',
    tier: 3,
    icon: '❄️',
    art: '/assets/ui/charms/charm_glacial_snowglobe.png',
    auraKind: 'charm_glacial_snowglobe',
    visualDesc: 'Large 12-point Crystalline Snowflake seal + Radiant Ice-Swan Spirit Wisp with single Aurora silk comet tail.',
    cheatTitle: 'Absolute Zero Chain-Shatter',
    cheatDesc: '30% chance on hit to Freeze in 3D Ice Cubes. Frozen enemies explode in a 350% DMG Ice Nova!',
    cheat: Object.freeze({
      freezeOnHitChance: 0.30,
      shatterNovaMult: 3.5,
      autoSpell: 'glacial_nova',
    }),
  }),
  charm_pharaoh_ankh: Object.freeze({
    id: 'charm_pharaoh_ankh',
    name: 'Pharaoh Solar Ankh',
    tier: 3,
    icon: '☀️',
    art: '/assets/ui/charms/charm_pharaoh_ankh.png',
    auraKind: 'charm_pharaoh_ankh',
    visualDesc: 'Large Golden Hieroglyph Sun-Dial seal + Radiant Solar Ankh Spirit Wisp with single liquid-gold comet tail.',
    cheatTitle: 'Solar Pillar & Total Armor Melt',
    cheatDesc: 'Shreds 50% Boss Armor & stops 💚 Regen. Every 6th Guardian shot calls down a 400% DMG Sun Pillar!',
    cheat: Object.freeze({
      armorShredPct: 0.50,
      stopRegen: true,
      sunPillarEveryShots: 6,
      sunPillarDmgMult: 4.0,
      autoSpell: 'solar_pillar',
    }),
  }),
  charm_tsukuyomi_mirror: Object.freeze({
    id: 'charm_tsukuyomi_mirror',
    name: 'Tsukuyomi Moon Mirror',
    tier: 3,
    icon: '🌙',
    art: '/assets/ui/charms/charm_tsukuyomi_mirror.png',
    auraKind: 'charm_tsukuyomi_mirror',
    visualDesc: 'Large Starry Night Reflection Pool seal + Radiant Lunar Mirror Spirit Wisp with single Nebula comet tail.',
    cheatTitle: 'Lunar Time-Stop & Guaranteed Crits',
    cheatDesc: '+65% Crit Damage. Every 10s casts Moonlight Eclipse (3.5s Time-Stop + 100% Guaranteed Crits)!',
    cheat: Object.freeze({
      critDmgBonus: 0.65,
      autoSpell: 'lunar_timestop',
      autoSpellCdSec: 10,
      sleepSec: 3.5,
    }),
  }),

  // =========================================================================
  // 👑 TIER 4: MVP SECRET RARES (Waves 35–50 Only • Double Seals + Grand Spirit + 2★ Moons + Dual Braided Comet Tail!)
  // =========================================================================
  charm_emperor_mochi_crown: Object.freeze({
    id: 'charm_emperor_mochi_crown',
    name: 'Emperor Mochi Crown Seal',
    tier: 4,
    icon: '👑',
    art: '/assets/ui/charms/charm_emperor_mochi_crown.png',
    auraKind: 'charm_emperor_mochi_crown',
    visualDesc: 'Double Counter-Rotating Royal Crest Seals + Grand Emperor Mochi Spirit Wisp with 2★ Moons & dual braided gold comet tail.',
    cheatTitle: "Sovereign's Decree",
    cheatDesc: 'Start Wave 1 with a FREE ★★★3 Guardian on Pedestal #0! +65% Boss DMG & drops a 900% Royal Mochi Meteor every 14s!',
    cheat: Object.freeze({
      freeStartStar3: true,
      bossDmgBonusPct: 0.65,
      autoSpell: 'mochi_meteor',
      autoSpellCdSec: 14,
      meteorDmgMult: 9.0,
    }),
  }),
  charm_golden_pinata_trophy: Object.freeze({
    id: 'charm_golden_pinata_trophy',
    name: 'Golden Pinata MVP Trophy',
    tier: 4,
    icon: '🐷',
    art: '/assets/ui/charms/charm_golden_pinata_trophy.png',
    auraKind: 'charm_golden_pinata_trophy',
    visualDesc: 'Double Rainbow Jackpot Seals + Grand Golden Pinata Spirit Wisp with 2★ Moons & dual braided prismatic comet tail.',
    cheatTitle: 'Infinite Midas Fever',
    cheatDesc: 'Interest Cap +15 🪙/wave, 50% FREE Rerolls, +80% End Gold/Berries, & 25% Pinata Coin-Missile Explosion on kill!',
    cheat: Object.freeze({
      interestCapBonus: 15,
      freeRerollChance: 0.50,
      podiumRewardBonusPct: 0.80,
      pinataKillBurstChance: 0.25,
      pinataKillCoins: 20,
      autoSpell: 'pinata_shower',
    }),
  }),
  charm_seraphim_rose_halo: Object.freeze({
    id: 'charm_seraphim_rose_halo',
    name: 'Seraphim Rose Sanctuary',
    tier: 4,
    icon: '🌹',
    art: '/assets/ui/charms/charm_seraphim_rose_halo.png',
    auraKind: 'charm_seraphim_rose_halo',
    visualDesc: 'Double Rose-Gold Cathedral Seals + Grand Seraphim Rose Spirit Wisp with 2★ Moons & dual braided rose-gold comet tail.',
    cheatTitle: 'Seraphim 6-Pedestal Ascension Link',
    cheatDesc: 'Links all 6 Pedestals (+50% ATK Speed & +50% DMG to all Guardians) & 50% chance ★★★3 merges ascend to ✦4 Super Mythic!',
    cheat: Object.freeze({
      allPedestalDmgBonusPct: 0.50,
      allPedestalSpdBonusPct: 0.50,
      superMythicAscendChance: 0.50,
      autoSpell: 'seraphim_blessing',
    }),
  }),
  charm_eclipse_dragon_core: Object.freeze({
    id: 'charm_eclipse_dragon_core',
    name: 'Eclipse Dragon Sovereign Core',
    tier: 4,
    icon: '🐉',
    art: '/assets/ui/charms/charm_eclipse_dragon_core.png',
    auraKind: 'charm_eclipse_dragon_core',
    visualDesc: 'Double Cosmic Eclipse Seals + Grand Eclipse Dragon Spirit Wisp with 2★ Moons & dual braided astral comet tail.',
    cheatTitle: 'Twin Dragon Cataclysm',
    cheatDesc: '100% of Guardian attacks splash 100% AoE Dragon-Fire & strip Shields! Summons a 1,000% DMG Supernova Black Hole every 12s!',
    cheat: Object.freeze({
      splashAllAttacks: true,
      stripShieldAllAttacks: true,
      autoSpell: 'eclipse_supernova',
      autoSpellCdSec: 12,
      supernovaDmgMult: 10.0,
    }),
  }),
});

export const CHARM_LIST = Object.freeze(Object.values(CHARMS));

export const CHARMS_BY_TIER = Object.freeze({
  1: Object.freeze(CHARM_LIST.filter((c) => c.tier === 1)),
  2: Object.freeze(CHARM_LIST.filter((c) => c.tier === 2)),
  3: Object.freeze(CHARM_LIST.filter((c) => c.tier === 3)),
  4: Object.freeze(CHARM_LIST.filter((c) => c.tier === 4)),
});

export const CHARM_MAX_PLUS = 5;
export const CHARM_PLUS_STEP_MULT = 0.15; // +15% stats per +1 step (+5 = +75% max awakening!)

export function getCharmDef(charmId) {
  return (charmId && CHARMS[charmId]) || null;
}

/**
 * Resolves a Charm instance's enhancement `+` level (`0..5`, where `+0` is Lv.1 and `+5` is Lv.6 MAX).
 */
export function getCharmPlus(charmObjOrLevel) {
  if (typeof charmObjOrLevel === 'number') {
    return Math.max(0, Math.min(CHARM_MAX_PLUS, (charmObjOrLevel | 0) - 1));
  }
  if (!charmObjOrLevel || typeof charmObjOrLevel !== 'object') return 0;
  if (charmObjOrLevel.plus != null && Number.isFinite(Number(charmObjOrLevel.plus))) {
    return Math.max(0, Math.min(CHARM_MAX_PLUS, Number(charmObjOrLevel.plus) | 0));
  }
  const lv = Math.max(1, Number(charmObjOrLevel.level) || 1);
  return Math.max(0, Math.min(CHARM_MAX_PLUS, lv - 1));
}

/**
 * Computes effective 4 Universal Stats (`fortune`, `swiftness`, `power`, `luck`)
 * granted by an owned or equipped Charm instance (including its `+0..+5` enhancement multiplier).
 */
export function computeCharmStats(charmObjOrId, gradeArg = 'B', levelArg = 1) {
  const out = { fortune: 0, swiftness: 0, power: 0, luck: 0 };
  if (!charmObjOrId) return out;
  if (typeof charmObjOrId === 'string') {
    const def = CHARMS[charmObjOrId];
    if (!def) return out;
    const tierSpec = CHARM_TIERS[def.tier] || CHARM_TIERS[1];
    const gradeDef = CHARM_GRADES[gradeArg] || CHARM_GRADES.B;
    const plus = getCharmPlus(levelArg);
    const lvMult = 1 + CHARM_PLUS_STEP_MULT * plus;
    const mid = (tierSpec.statMin + tierSpec.statMax) * 0.5;
    const val = Math.round(mid * gradeDef.mult * lvMult);
    return { fortune: val, swiftness: val, power: val, luck: val };
  }
  const charmObj = charmObjOrId;
  if (!charmObj.id || !CHARMS[charmObj.id]) return out;
  const plus = getCharmPlus(charmObj);
  const lvMult = 1 + CHARM_PLUS_STEP_MULT * plus;
  const raw = charmObj.stats || {};
  for (const k of CHARM_STAT_KEYS) {
    if (raw[k] > 0) {
      out[k] = Math.round(raw[k] * lvMult);
    }
  }
  return out;
}

/**
 * Returns total stat points of a Charm (either effective with `+` bonus, or raw base stats).
 */
export function getCharmStatSum(charmObj, { effective = true } = {}) {
  if (!charmObj) return 0;
  const st = effective ? computeCharmStats(charmObj) : (charmObj.stats || {});
  return CHARM_STAT_KEYS.reduce((acc, k) => acc + (Number(st[k]) || 0), 0);
}

/**
 * Rolls a Quality Grade (`B`, `A`, `S`, `SS`) with a gentle Luck nudge.
 */
export function rollCharmGrade(luckStat = 0, rng = Math.random) {
  const luckBonus = Math.min(12, Math.max(0, Number(luckStat) || 0) / 40);
  const wSS = CHARM_GRADES.SS.weight + luckBonus * 0.45;
  const wS = CHARM_GRADES.S.weight + luckBonus * 1.1;
  const wA = CHARM_GRADES.A.weight + luckBonus * 1.2;
  const wB = Math.max(15, CHARM_GRADES.B.weight - luckBonus * 2.0);
  const total = wSS + wS + wA + wB;
  let r = rng() * total;
  if (r < wSS) return CHARM_GRADES.SS;
  r -= wSS;
  if (r < wS) return CHARM_GRADES.S;
  r -= wS;
  if (r < wA) return CHARM_GRADES.A;
  return CHARM_GRADES.B;
}

/**
 * Creates a rolled Charm instance for a specific `charmId` (picking 2 distinct stats or all 4 on Tier 3/4 and a Grade).
 */
export function createRolledCharm(
  charmId,
  { luckStat = 0, forcedGrade = null, grade: gradeOpt = null, level = 1, plus = null, rng = Math.random } = {}
) {
  const def = getCharmDef(charmId);
  if (!def) return null;
  const tierSpec = CHARM_TIERS[def.tier] || CHARM_TIERS[1];
  const wantedGrade = forcedGrade || gradeOpt;
  const grade = (wantedGrade && CHARM_GRADES[wantedGrade]) || rollCharmGrade(luckStat, rng);
  const resolvedPlus = plus != null
    ? Math.max(0, Math.min(CHARM_MAX_PLUS, Number(plus) | 0))
    : Math.max(0, Math.min(CHARM_MAX_PLUS, (Number(level) || 1) - 1));
  const lv = resolvedPlus + 1;

  // Pick 2 distinct Universal Stats
  const pool = [...CHARM_STAT_KEYS];
  const idx1 = Math.floor(rng() * pool.length);
  const stat1 = pool.splice(idx1, 1)[0];
  const idx2 = Math.floor(rng() * pool.length);
  const stat2 = pool.splice(idx2, 1)[0];

  const span = Math.max(1, tierSpec.statMax - tierSpec.statMin);
  const rollVal = () => Math.round((tierSpec.statMin + rng() * span) * grade.mult);

  const stats = {
    [stat1]: rollVal(),
    [stat2]: rollVal(),
  };
  if (def.tier >= 3) {
    for (const k of CHARM_STAT_KEYS) {
      if (!stats[k]) stats[k] = rollVal();
    }
  }

  return {
    uid: `chm_${Date.now().toString(36)}_${Math.floor(rng() * 1e6).toString(36)}`,
    id: def.id,
    name: def.name,
    tier: def.tier,
    icon: def.icon,
    art: def.art,
    auraKind: def.auraKind,
    grade: grade.id,
    plus: resolvedPlus,
    level: lv,
    locked: false,
    stats,
    cheatTitle: def.cheatTitle,
    cheatDesc: def.cheatDesc,
  };
}

/**
 * Evaluates the strict Wave-Gated Boss Drop Table (`Waves 5 -> 50`, No Pity, No Gacha).
 * Checks from the highest unlocked tier at `wave` down to Tier 1.
 */
export function rollCharmDrop({
  wave = 5,
  luckStat = 0,
  forceDrop = false,
  forcedTier = null,
  rng = Math.random,
} = {}) {
  const w = Math.max(1, wave | 0);
  if ((w < 5 || w % 5 !== 0) && !forceDrop && !forcedTier) return null;

  const luckMult = 1 + Math.max(0, Number(luckStat) || 0) / 250;

  if (forcedTier && CHARMS_BY_TIER[forcedTier]) {
    const list = CHARMS_BY_TIER[forcedTier];
    const pick = list[Math.floor(rng() * list.length)] || list[0];
    return createRolledCharm(pick.id, { luckStat, rng });
  }

  // Evaluate highest unlocked tiers first (strictly wave-gated!)
  const candidateTiers = [4, 3, 2, 1].filter((t) => w >= CHARM_TIERS[t].minWave);
  for (const t of candidateTiers) {
    const spec = CHARM_TIERS[t];
    let baseRate = spec.baseDropRate;
    if (t === 4 && w >= 50) {
      baseRate = spec.wave50DropRate || 0.05;
    } else if (t === 4 && w >= 40) {
      baseRate = 0.025;
    }
    const chance = Math.min(0.65, baseRate * luckMult);
    if (rng() < chance) {
      const list = CHARMS_BY_TIER[t];
      const pick = list[Math.floor(rng() * list.length)] || list[0];
      return createRolledCharm(pick.id, { luckStat, rng });
    }
  }

  if (forceDrop) {
    const topTier = candidateTiers[0] || 1;
    const list = CHARMS_BY_TIER[topTier];
    const pick = list[Math.floor(rng() * list.length)] || list[0];
    return createRolledCharm(pick.id, { luckStat, rng });
  }

  return null;
}

export const GRADE_RANK = Object.freeze({ B: 1, A: 2, S: 3, SS: 4 });

/**
 * Finds the best owned Charm copy matching `charmIdOrUid` (exact `uid` match first,
 * otherwise highest `+` enhancement, then highest Grade, then highest effective stat sum).
 */
export function findBestCharmForId(charms, charmIdOrUid) {
  if (!Array.isArray(charms) || !charmIdOrUid) return null;
  const byUid = charms.find((c) => c && c.uid === charmIdOrUid);
  if (byUid) return byUid;
  const matches = charms.filter((c) => c && c.id === charmIdOrUid);
  if (!matches.length) return null;
  matches.sort((a, b) => {
    const pDiff = getCharmPlus(b) - getCharmPlus(a);
    if (pDiff !== 0) return pDiff;
    const gDiff = (GRADE_RANK[b.grade] || 0) - (GRADE_RANK[a.grade] || 0);
    if (gDiff !== 0) return gDiff;
    return getCharmStatSum(b) - getCharmStatSum(a);
  });
  return matches[0];
}

/**
 * Adds a newly dropped Charm as an independent inspectable roll in `profile.charms` (Charm Bag).
 * Players can inspect multiple rolls (`A`, `B`, `S`, `SS`) and consume duplicates (`+0` -> `+5`).
 */
export function addCharmToBag(profile, droppedCharm) {
  if (!profile || !droppedCharm || !droppedCharm.id) return null;
  if (!Array.isArray(profile.charms)) profile.charms = [];
  const def = CHARMS[droppedCharm.id];
  if (!def) return null;

  const existingCopies = profile.charms.filter((c) => c && c.id === droppedCharm.id);
  const isDuplicate = existingCopies.length > 0;
  const plus = getCharmPlus(droppedCharm);
  const entry = {
    ...droppedCharm,
    uid: droppedCharm.uid || `chm_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`,
    id: def.id,
    name: def.name,
    tier: def.tier,
    icon: def.icon,
    art: def.art,
    auraKind: def.auraKind,
    grade: droppedCharm.grade || 'B',
    plus,
    level: plus + 1,
    locked: Boolean(droppedCharm.locked),
    stats: { ...(droppedCharm.stats || {}) },
    cheatTitle: def.cheatTitle,
    cheatDesc: def.cheatDesc,
  };
  profile.charms.push(entry);

  Object.defineProperty(entry, 'charm', { value: entry, enumerable: false, configurable: true });
  Object.defineProperty(entry, 'isDuplicate', { value: isDuplicate, enumerable: false, configurable: true });
  Object.defineProperty(entry, 'copyCount', { value: existingCopies.length + 1, enumerable: false, configurable: true });
  return entry;
}

/**
 * Consumes a duplicate Charm (`materialUid`) into a Base Charm (`baseUid`) of the same `id`:
 * - **Full `+` Transfer (`+0` -> `+5` MAX):** `newPlus = Math.min(5, basePlus + 1 + materialPlus)`
 *   so consuming a `+2` Charm into a newly dropped `+0` Charm jumps straight to `+3`!
 * - **Stat Infusion (`mode: 'infuse'` or when Base is already `+5`):**
 *   Infuses any higher stat line (`fortune`, `swiftness`, `power`, `luck`) and promotes Grade if Material is higher.
 */
export function consumeCharmInBag(profile, { baseUid, materialUid, mode = 'upgrade' } = {}) {
  if (!profile || !Array.isArray(profile.charms)) return { ok: false, error: 'no_charms' };
  if (!baseUid || !materialUid || baseUid === materialUid) return { ok: false, error: 'invalid_pair' };

  const baseIdx = profile.charms.findIndex((c) => c && c.uid === baseUid);
  const matIdx = profile.charms.findIndex((c) => c && c.uid === materialUid);
  if (baseIdx < 0 || matIdx < 0) return { ok: false, error: 'charm_not_found' };

  const base = profile.charms[baseIdx];
  const material = profile.charms[matIdx];
  if (base.id !== material.id) return { ok: false, error: 'charm_mismatch' };
  if (material.locked) return { ok: false, error: 'material_locked' };

  const basePlus = getCharmPlus(base);
  const matPlus = getCharmPlus(material);
  const gainPlus = 1 + matPlus;

  const canImproveGrade = (GRADE_RANK[material.grade] || 0) > (GRADE_RANK[base.grade] || 0);
  const canImproveAnyStat = CHARM_STAT_KEYS.some((k) => (Number(material.stats?.[k]) || 0) > (Number(base.stats?.[k]) || 0));

  if (basePlus >= CHARM_MAX_PLUS && mode !== 'infuse' && !canImproveGrade && !canImproveAnyStat) {
    return { ok: false, error: 'already_max_plus' };
  }

  const beforeEffective = computeCharmStats(base);
  const nextPlus = Math.min(CHARM_MAX_PLUS, basePlus + gainPlus);
  base.plus = nextPlus;
  base.level = nextPlus + 1;

  let infusedStats = false;
  if (mode === 'infuse' || basePlus >= CHARM_MAX_PLUS) {
    base.stats = { ...(base.stats || {}) };
    for (const k of CHARM_STAT_KEYS) {
      const mVal = Number(material.stats?.[k]) || 0;
      const bVal = Number(base.stats?.[k]) || 0;
      if (mVal > bVal) {
        base.stats[k] = mVal;
        infusedStats = true;
      }
    }
    if (canImproveGrade) {
      base.grade = material.grade;
      infusedStats = true;
    }
  }

  // Remove consumed material from Charm Bag
  profile.charms.splice(matIdx, 1);

  // Sync equipped charm if either base or material was worn
  profile.equipped = profile.equipped || {};
  const eqCharm = profile.equipped.charm;
  if (eqCharm && (eqCharm.uid === base.uid || eqCharm.uid === material.uid || (!eqCharm.uid && eqCharm.id === base.id))) {
    profile.equipped.charm = {
      uid: base.uid,
      id: base.id,
      tier: base.tier,
      grade: base.grade,
      plus: base.plus,
      level: base.level,
      stats: { ...(base.stats || {}) },
      auraKind: base.auraKind,
    };
  }

  const afterEffective = computeCharmStats(base);
  return {
    ok: true,
    base,
    consumedUid: material.uid,
    charmId: base.id,
    prevPlus: basePlus,
    newPlus: nextPlus,
    gainPlus,
    infusedStats,
    beforeEffective,
    afterEffective,
  };
}

/**
 * Calculates Starlight Shards (`🌟`) & Gold (`🪙`) awarded when salvaging a spare Charm.
 */
export function computeCharmSalvageValue(charmObj) {
  if (!charmObj) return { shards: 0, gold: 0 };
  const tier = Number(charmObj.tier) || CHARMS[charmObj.id]?.tier || 1;
  const plus = getCharmPlus(charmObj);
  const gradeMult = CHARM_GRADES[charmObj.grade]?.mult || 1.0;
  const baseShardsByTier = { 1: 6, 2: 14, 3: 30, 4: 65 };
  const baseGoldByTier = { 1: 450, 2: 1100, 3: 2600, 4: 6500 };
  const plusMult = 1 + plus * 0.85;
  const shards = Math.max(1, Math.round((baseShardsByTier[tier] || 6) * gradeMult * plusMult));
  const gold = Math.max(50, Math.round((baseGoldByTier[tier] || 450) * gradeMult * plusMult));
  return { shards, gold };
}

/**
 * Dismantles an unequipped, unlocked spare Charm into Starlight Shards (`🌟`) & Gold (`🪙`).
 */
export function salvageCharmInBag(profile, { charmUid } = {}) {
  if (!profile || !Array.isArray(profile.charms) || !charmUid) return { ok: false, error: 'charm_not_found' };
  const idx = profile.charms.findIndex((c) => c && c.uid === charmUid);
  if (idx < 0) return { ok: false, error: 'charm_not_found' };
  const target = profile.charms[idx];
  if (target.locked) return { ok: false, error: 'charm_locked' };
  if (profile.equipped?.charm?.uid && profile.equipped.charm.uid === target.uid) {
    return { ok: false, error: 'charm_equipped' };
  }

  const { shards, gold } = computeCharmSalvageValue(target);
  profile.charms.splice(idx, 1);

  profile.shards = (Number(profile.shards) || 0) + shards;
  profile.gacha_shards = profile.shards;
  profile.gold = (Number(profile.gold) || 0) + gold;
  if (profile.currencies && typeof profile.currencies === 'object') {
    profile.currencies.gold = (Number(profile.currencies.gold) || 0) + gold;
  }

  return {
    ok: true,
    charmUid,
    charmId: target.id,
    charmName: target.name,
    shardsGain: shards,
    goldGain: gold,
    shards: profile.shards,
    gacha_shards: profile.gacha_shards,
    gold: profile.gold,
  };
}

/**
 * Toggles lock state (`🔒`) on a Charm instance in `profile.charms`.
 */
export function toggleCharmLockInBag(profile, { charmUid } = {}) {
  if (!profile || !Array.isArray(profile.charms) || !charmUid) return { ok: false, error: 'charm_not_found' };
  const target = profile.charms.find((c) => c && c.uid === charmUid);
  if (!target) return { ok: false, error: 'charm_not_found' };
  target.locked = !target.locked;
  return { ok: true, charmUid: target.uid, charmId: target.id, locked: target.locked };
}

/**
 * Inserts a newly dropped Charm into `profile.charms`.
 * When `opts.keepInBag === true`, adds as an independent roll in the Charm Bag (`addCharmToBag`).
 * Otherwise preserves legacy auto-awaken behavior (`+1` up to `+5` / `Lv.6`).
 */
export function upsertCharmToProfile(profile, droppedCharm, opts = {}) {
  if (!profile || !droppedCharm || !droppedCharm.id) return null;
  if (opts && opts.keepInBag) {
    return addCharmToBag(profile, droppedCharm);
  }
  if (!Array.isArray(profile.charms)) profile.charms = [];

  const existing = profile.charms.find((c) => c && c.id === droppedCharm.id);
  let target = null;
  let isDuplicate = false;

  if (existing) {
    isDuplicate = true;
    const nextPlus = Math.min(CHARM_MAX_PLUS, getCharmPlus(existing) + 1 + getCharmPlus(droppedCharm));
    existing.plus = nextPlus;
    existing.level = nextPlus + 1;
    const oldSum = Object.values(existing.stats || {}).reduce((a, b) => a + (Number(b) || 0), 0);
    const newSum = Object.values(droppedCharm.stats || {}).reduce((a, b) => a + (Number(b) || 0), 0);
    if (
      (GRADE_RANK[droppedCharm.grade] || 0) > (GRADE_RANK[existing.grade] || 0) ||
      newSum > oldSum
    ) {
      existing.grade = droppedCharm.grade;
      existing.stats = { ...droppedCharm.stats };
    }
    target = existing;
  } else {
    const plus = getCharmPlus(droppedCharm);
    target = { ...droppedCharm, plus, level: plus + 1, locked: Boolean(droppedCharm.locked) };
    profile.charms.push(target);
  }

  // Refresh equipped charm if it is currently worn and just leveled up
  profile.equipped = profile.equipped || {};
  if (profile.equipped.charm?.id === target.id) {
    profile.equipped.charm = {
      uid: target.uid,
      id: target.id,
      tier: target.tier,
      grade: target.grade,
      plus: target.plus,
      level: target.level,
      stats: { ...target.stats },
      auraKind: target.auraKind,
    };
  }

  Object.defineProperty(target, 'charm', { value: target, enumerable: false, configurable: true });
  Object.defineProperty(target, 'isDuplicate', { value: isDuplicate, enumerable: false, configurable: true });
  return target;
}
