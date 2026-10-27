// ============================================================================
// NEORA WORLD v2 — Pet System V2 ("Soul-Bond Companions") Rules & Math
// Shared between server and client. Pure deterministic functions.
// ============================================================================

import { PETS, STARTER_PET, LEGACY_PET_MAP, normalizePetId } from './pet_catalog.js';
import { lerpLv } from './catalog_landmarks.js';

const TIER_ODDS = { mythic: [3, 6], epic: [17, 24], rare: [35, 35], common: [45, 35] };

export function traitOdds(nestLv = 1) {
  const out = {};
  for (const [tier, [a, b]] of Object.entries(TIER_ODDS)) out[tier] = lerpLv(a, b, nestLv);
  return out;
}

export const PET2 = Object.freeze({
  MAX_STARS: 3,
  EVOLVE_ESSENCE: Object.freeze({ 1: 40, 2: 120 }),
  DUPE_ESSENCE: Object.freeze({ common: 10, rare: 25, epic: 60, mythic: 60 }),
  MAX_STAR_SHARD_REFUND: 100,
  RELEASE_BASE_ESSENCE: 10,
  REROLL_COSTS: Object.freeze({
    0: Object.freeze({ gold: 1500, berries: 60 }),
    1: Object.freeze({ gold: 3500, berries: 150 }),
    2: Object.freeze({ gold: 7500, berries: 350 }),
  }),
  COUPLE_HARMONY_ESSENCE: 20,
  COUPLE_HARMONY_BOND_XP: 20,
  BOND_MAX_LV: 30,
  INTERACT_COOLDOWN_MS: 30_000,
  INTERACT_BOND_XP: 10,
  REROLL_BOND_XP: 5,
  MINIGAME_BOND_XP: 8,
  BOARD_BOND_XP: 8,
  NICKNAME_MAX_LEN: 14,
  MAX_YARD_PETS: 3,
});

export const MAX_TRAIT_SLOTS = 2;

export const HUNGER = Object.freeze({
  MAX: 100,
  DEFAULT: 80,
  FEED_GAIN: 35,
  ONLINE_DRAIN_PER_MIN: 2,
  GREEN_MIN: 70,
  ORANGE_MIN: 30,
  MULT_GREEN: 2.0,
  MULT_ORANGE: 1.0,
  MULT_RED: 0.25,
  BASE_ONLINE_EXP_PER_MIN: 12,
});

export function hungerZone(hunger = 80) {
  const h = Number.isFinite(Number(hunger)) ? Number(hunger) : HUNGER.DEFAULT;
  if (h >= HUNGER.GREEN_MIN) {
    return { zone: 'green', mult: HUNGER.MULT_GREEN, label: 'Full & Happy (2.0× EXP)' };
  }
  if (h >= HUNGER.ORANGE_MIN) {
    return { zone: 'orange', mult: HUNGER.MULT_ORANGE, label: 'Peckish (1.0× EXP)' };
  }
  return { zone: 'red', mult: HUNGER.MULT_RED, label: 'Hungry (0.25× EXP)' };
}

export const PET_MILESTONES = Object.freeze([
  { lv: 1, label: '★1 Cute Starter & Slot 1' },
  { lv: 5, label: '💤 Nap Pose' },
  { lv: 10, label: '★2 Awakened Form, Slot 2 & 😊 Happy Pose' },
  { lv: 15, label: '🪄 Cast Pose & 👗 Pet Costume Slot' },
  { lv: 20, label: '★3 Radiant Form & Shimmer' },
  { lv: 25, label: '🎪 360° Spin-Flip Trick' },
  { lv: 30, label: '🌈 Sovereign Ground Ring Aura' },
]);

export function unlockedPosesForLevel(lv = 1) {
  const l = Number(lv) || 1;
  const poses = ['front', 'side', 'back', 'move', 'lifted'];
  if (l >= 5) poses.push('sleep');
  if (l >= 10) poses.push('happy');
  if (l >= 15) poses.push('cast');
  if (l >= 25) poses.push('flip');
  return poses;
}

export const SELECTABLE_PET_POSES = Object.freeze(['front', 'sleep', 'happy', 'cast', 'flip']);

export function unlockedSelectablePosesForLevel(lv = 1) {
  const l = Number(lv) || 1;
  const out = ['front'];
  if (l >= 5) out.push('sleep');
  if (l >= 10) out.push('happy');
  if (l >= 15) out.push('cast');
  if (l >= 25) out.push('flip');
  return out;
}

export function normalizeActivePoses(activePoses, lv = 1) {
  const unlocked = unlockedSelectablePosesForLevel(lv);
  if (Array.isArray(activePoses) && activePoses.length > 0) {
    const valid = unlocked.filter((p) => activePoses.includes(p));
    if (valid.length > 0) return valid;
  }
  return unlocked;
}

export function starsForLevel(lv = 1) {
  const l = Number(lv) || 1;
  return l >= 20 ? 3 : l >= 10 ? 2 : 1;
}

export function minLevelForStars(stars = 1) {
  const s = Number(stars) || 1;
  return s >= 3 ? 20 : s >= 2 ? 10 : 1;
}

export function openSlotCountForPet(pet) {
  if (!pet) return 1;
  const stars = Number(pet.stars) || starsForLevel(pet.bond_lv || pet.level || 1);
  const bondLv = Number(pet.bond_lv || pet.level) || 1;
  return (stars >= 2 || bondLv >= 10) ? MAX_TRAIT_SLOTS : 1;
}

export const STAT_TIERS = Object.freeze(['common', 'rare', 'epic', 'mythic']);
export const TIER_RANK = Object.freeze({ common: 0, rare: 1, epic: 2, mythic: 3 });

export const STAT_LINES = Object.freeze({
  fortune: {
    id: 'fortune',
    kind: 'stat',
    name: 'Vitality',
    icon: '💖',
    desc: 'Max HP, healing & gather yield',
    values: Object.freeze({ common: 0.04, rare: 0.07, epic: 0.11, mythic: 0.16 }),
  },
  swiftness: {
    id: 'swiftness',
    kind: 'stat',
    name: 'Swiftness',
    icon: '🍃',
    desc: 'Walk speed & dodge window',
    values: Object.freeze({ common: 0.04, rare: 0.07, epic: 0.11, mythic: 0.16 }),
  },
  power: {
    id: 'power',
    kind: 'stat',
    name: 'Power',
    icon: '⚔️',
    desc: 'Crit chance & boss score',
    values: Object.freeze({ common: 0.04, rare: 0.07, epic: 0.11, mythic: 0.16 }),
  },
  luck: {
    id: 'luck',
    kind: 'stat',
    name: 'Luck',
    icon: '🍀',
    desc: 'Rare drop & fish quality',
    values: Object.freeze({ common: 0.04, rare: 0.07, epic: 0.11, mythic: 0.16 }),
  },
});

export const PERK_LINES = Object.freeze({
  cozy_purr: {
    id: 'cozy_purr',
    kind: 'perk',
    name: 'Cozy Purr',
    icon: '🐾',
    desc: 'Idle Village heart & coin tick rate',
    values: Object.freeze({ common: 0.05, rare: 0.08, epic: 0.12, mythic: 0.18 }),
  },
  magnet_paw: {
    id: 'magnet_paw',
    kind: 'perk',
    name: 'Magnet Paw',
    icon: '🧲',
    desc: 'Coin & berry pickup radius',
    values: Object.freeze({ common: 0.15, rare: 0.25, epic: 0.40, mythic: 0.60 }),
  },
  treasure_sniffer: {
    id: 'treasure_sniffer',
    kind: 'perk',
    name: 'Treasure Sniffer',
    icon: '💎',
    desc: 'Bonus Stardust chance on chests',
    values: Object.freeze({ common: 0.03, rare: 0.05, epic: 0.08, mythic: 0.12 }),
  },
  berry_gourmand: {
    id: 'berry_gourmand',
    kind: 'perk',
    name: 'Berry Gourmand',
    icon: '🍓',
    desc: 'Extra Berries from bushes & harvests',
    values: Object.freeze({ common: 1, rare: 1, epic: 2, mythic: 3 }),
    isFlat: true,
  },
  double_jackpot: {
    id: 'double_jackpot',
    kind: 'perk',
    name: 'Double Jackpot',
    icon: '🎲',
    desc: 'Board tile gold on Doubles',
    values: Object.freeze({ common: 0.04, rare: 0.07, epic: 0.10, mythic: 0.15 }),
  },
  mach_wing: {
    id: 'mach_wing',
    kind: 'perk',
    name: 'Mach Wing',
    icon: '🪽',
    desc: 'Starting shield & boost duration',
    values: Object.freeze({ common: 0.05, rare: 0.08, epic: 0.12, mythic: 0.18 }),
  },
  ult_charge: {
    id: 'ult_charge',
    kind: 'perk',
    name: 'Overcharge',
    icon: '⚡',
    desc: 'Ultimate charge on Monopoly doubles',
    values: Object.freeze({ common: 0.08, rare: 0.12, epic: 0.16, mythic: 0.22 }),
  },
  rent_charm: {
    id: 'rent_charm',
    kind: 'perk',
    name: 'Royal Charm',
    icon: '🎀',
    desc: 'Chance for -25% Monopoly rent discount',
    values: Object.freeze({ common: 0.08, rare: 0.12, epic: 0.16, mythic: 0.20 }),
  },
  go_salary: {
    id: 'go_salary',
    kind: 'perk',
    name: 'Pass-GO Blessing',
    icon: '🌸',
    desc: 'Bonus Pass-GO salary in Monopoly',
    values: Object.freeze({ common: 0.04, rare: 0.07, epic: 0.10, mythic: 0.14 }),
  },
  build_rebate: {
    id: 'build_rebate',
    kind: 'perk',
    name: 'Architect Rebate',
    icon: '🫧',
    desc: 'Monopoly landmark build rebate',
    values: Object.freeze({ common: 0.03, rare: 0.05, epic: 0.07, mythic: 0.10 }),
  },
});

export const ALL_SLOT_LINES = Object.freeze({
  ...STAT_LINES,
  ...PERK_LINES,
});

const STAT_KEYS = Object.keys(STAT_LINES);
const PERK_KEYS = Object.keys(PERK_LINES);

export function rollTierFromOdds(nestLv = 1, rng = Math.random, minTier = null) {
  const odds = traitOdds(nestLv);
  const minRank = minTier && TIER_RANK[minTier] !== undefined ? TIER_RANK[minTier] : 0;
  const tiers = ['mythic', 'epic', 'rare', 'common'].filter((t) => TIER_RANK[t] >= minRank);
  const total = tiers.reduce((s, t) => s + (odds[t] || 0), 0);
  let r = rng() * total;
  for (const t of tiers) {
    r -= odds[t] || 0;
    if (r < 0) return t;
  }
  return tiers[tiers.length - 1] || 'common';
}

export function rollSlot(nestLv = 1, rng = Math.random, { minTier = null, excludePerks = [] } = {}) {
  const tier = rollTierFromOdds(nestLv, rng, minTier);
  const excluded = new Set(excludePerks || []);
  const availablePerks = PERK_KEYS.filter((k) => !excluded.has(k));
  const usePerk = availablePerks.length > 0 && rng() < 0.35;
  const pool = usePerk ? availablePerks : STAT_KEYS;
  const pickIdx = Math.min(pool.length - 1, Math.floor(rng() * pool.length));
  const statId = pool[pickIdx];
  const def = ALL_SLOT_LINES[statId] || STAT_LINES.fortune;
  return {
    stat: def.id,
    tier,
    value: def.values[tier] ?? def.values.common,
    locked: false,
  };
}

export function normalizeSlot(slot, fallbackTier = 'common') {
  if (!slot || typeof slot !== 'object') return null;
  const statId = ALL_SLOT_LINES[slot.stat] ? slot.stat : 'fortune';
  const def = ALL_SLOT_LINES[statId];
  const tier = STAT_TIERS.includes(slot.tier) ? slot.tier : (STAT_TIERS.includes(fallbackTier) ? fallbackTier : 'common');
  return {
    stat: statId,
    tier,
    value: def.values[tier],
    locked: Boolean(slot.locked),
  };
}

export function spentEssenceForStars(stars = 1) {
  if (stars >= 3) return PET2.EVOLVE_ESSENCE[1] + PET2.EVOLVE_ESSENCE[2];
  if (stars === 2) return PET2.EVOLVE_ESSENCE[1];
  return 0;
}

export function createPetRecord(petId, {
  stars = 1,
  nestLv = 1,
  rng = Math.random,
  minTierSlot0 = null,
  initialSlot0 = null,
} = {}) {
  const clampedStars = Math.max(1, Math.min(PET2.MAX_STARS, Math.floor(Number(stars) || 1)));
  const minLv = minLevelForStars(clampedStars);
  const openSlots = Math.min(clampedStars, MAX_TRAIT_SLOTS);
  const slots = [null, null, null];
  const usedPerks = [];

  for (let i = 0; i < openSlots; i++) {
    if (i === 0 && initialSlot0) {
      slots[0] = normalizeSlot(initialSlot0);
    } else {
      slots[i] = rollSlot(nestLv, rng, {
        minTier: i === 0 ? minTierSlot0 : null,
        excludePerks: usedPerks,
      });
    }
    if (slots[i] && PERK_LINES[slots[i].stat]) {
      usedPerks.push(slots[i].stat);
    }
  }

  return {
    stars: clampedStars,
    essence: 0,
    spent_essence: spentEssenceForStars(clampedStars),
    visual_tier: clampedStars,
    nickname: '',
    bond_lv: minLv,
    bond_xp: 0,
    level: minLv,
    mood: 100,
    hunger: HUNGER.DEFAULT,
    costume_id: null,
    last_gift_day: '',
    last_harmony_day: '',
    last_interact_at: 0,
    slots,
  };
}

export function evolveCost(currentStars = 1) {
  return PET2.EVOLVE_ESSENCE[currentStars] || null;
}

export function rerollCost(lockCount = 0) {
  const k = Math.max(0, Math.min(2, Math.floor(Number(lockCount) || 0)));
  return PET2.REROLL_COSTS[k];
}

export function releaseValue(pet) {
  if (!pet) return PET2.RELEASE_BASE_ESSENCE;
  const spent = Number(pet.spent_essence ?? spentEssenceForStars(pet.stars || 1)) || 0;
  const unspent = Number(pet.essence || 0) || 0;
  return PET2.RELEASE_BASE_ESSENCE + Math.floor((spent + unspent) * 0.5);
}

export function bondXpToNext(bondLv = 1) {
  const lv = Math.max(1, Math.min(PET2.BOND_MAX_LV, Math.floor(Number(bondLv) || 1)));
  return 50 * lv;
}

export function addBondXp(pet, amount = 0) {
  if (!pet || amount <= 0) return { leveledUp: false, bond_lv: pet?.bond_lv || 1 };
  const prevLv = Math.max(1, Math.min(PET2.BOND_MAX_LV, Number(pet.bond_lv) || 1));
  pet.bond_lv = prevLv;
  pet.bond_xp = Math.max(0, (Number(pet.bond_xp) || 0) + amount);
  let leveledUp = false;
  while (pet.bond_lv < PET2.BOND_MAX_LV) {
    const req = bondXpToNext(pet.bond_lv);
    if (pet.bond_xp < req) break;
    pet.bond_xp -= req;
    pet.bond_lv += 1;
    leveledUp = true;
  }
  if (pet.bond_lv >= PET2.BOND_MAX_LV) {
    pet.bond_xp = 0;
  }
  if (leveledUp) {
    pet.level = pet.bond_lv;
    if (Array.isArray(pet.active_poses)) {
      const prevUnlocked = new Set(unlockedSelectablePosesForLevel(prevLv));
      const nextUnlocked = unlockedSelectablePosesForLevel(pet.bond_lv);
      const newlyUnlocked = nextUnlocked.filter((p) => !prevUnlocked.has(p));
      pet.active_poses = normalizeActivePoses([...pet.active_poses, ...newlyUnlocked], pet.bond_lv);
    }
    const targetStars = starsForLevel(pet.bond_lv);
    const curStars = pet.stars || 1;
    if (targetStars > curStars) {
      pet.stars = targetStars;
      pet.visual_tier = targetStars;
    }
    const openSlots = openSlotCountForPet(pet);
    if (!Array.isArray(pet.slots)) pet.slots = [null, null, null];
    for (let i = 0; i < openSlots; i++) {
      if (!pet.slots[i]) {
        const usedPerks = pet.slots.filter((s) => s && PERK_LINES[s.stat]).map((s) => s.stat);
        pet.slots[i] = rollSlot(1, Math.random, { excludePerks: usedPerks });
      }
    }
  }
  return { leveledUp, bond_lv: pet.bond_lv, bond_xp: pet.bond_xp };
}

export function unlockedEmotesForBond(bondLv = 1) {
  const lv = Number(bondLv) || 1;
  if (lv >= 6) return ['joy', 'wink', 'surprised', 'teary', 'sleepy', 'love', 'proud', 'shy'];
  if (lv >= 4) return ['joy', 'sleepy', 'wink', 'surprised', 'teary', 'shy'];
  if (lv >= 2) return ['joy', 'sleepy', 'wink', 'surprised'];
  return ['joy', 'sleepy'];
}

export function giftRoll(rng = Math.random, bondLv = 1) {
  const lv = Math.max(1, Math.min(PET2.BOND_MAX_LV, Number(bondLv) || 1));
  const gold = 300 + lv * 80 + Math.floor(rng() * 120);
  const berries = 15 + lv * 3 + Math.floor(rng() * 6);
  const stardust = lv >= 8 && rng() < 0.35 ? 2 : (lv >= 4 && rng() < 0.2 ? 1 : 0);
  return { gold, berries, stardust };
}

export function sanitizeNickname(raw) {
  if (typeof raw !== 'string') return '';
  return raw
    .replace(/[<>[\]{}\\/]/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim()
    .slice(0, PET2.NICKNAME_MAX_LEN);
}

/**
 * Aggregates all open stat & perk lines on a pet into a single bonus dictionary.
 * Also supports legacy V1 `{ stars, trait }` objects for backward compatibility.
 */
export function petStatBonus(pet) {
  const out = {
    goldPct: 0,
    speedPct: 0,
    critPct: 0,
    luckPct: 0,
    cozyPurrPct: 0,
    magnetPawPct: 0,
    treasureSnifferPct: 0,
    berryBonusFlat: 0,
    doubleJackpotPct: 0,
    machWingPct: 0,
    ultChargePct: 0,
    rentCharmPct: 0,
    goSalaryPct: 0,
    buildRebatePct: 0,
  };
  if (!pet) return out;

  if (Array.isArray(pet.slots)) {
    const openCount = openSlotCountForPet(pet);
    for (let i = 0; i < openCount; i++) {
      const s = pet.slots[i];
      if (!s || !s.stat) continue;
      const def = ALL_SLOT_LINES[s.stat];
      if (!def) continue;
      const val = Number(s.value ?? def.values[s.tier] ?? def.values.common) || 0;
      switch (s.stat) {
        case 'fortune': out.goldPct += val; break;
        case 'swiftness': out.speedPct += val; break;
        case 'power': out.critPct += val; break;
        case 'luck': out.luckPct += val; break;
        case 'cozy_purr': out.cozyPurrPct += val; break;
        case 'magnet_paw': out.magnetPawPct += val; break;
        case 'treasure_sniffer': out.treasureSnifferPct += val; break;
        case 'berry_gourmand': out.berryBonusFlat += val; break;
        case 'double_jackpot': out.doubleJackpotPct += val; break;
        case 'mach_wing': out.machWingPct += val; break;
        case 'ult_charge': out.ultChargePct += val; break;
        case 'rent_charm': out.rentCharmPct += val; break;
        case 'go_salary': out.goSalaryPct += val; break;
        case 'build_rebate': out.buildRebatePct += val; break;
      }
    }
    return out;
  }

  // Fallback for legacy V1 `{ stars, trait }` record if encountered before migration
  const legacyMult = { common: 1.0, rare: 1.15, epic: 1.35, mythic: 1.6 }[pet.trait] || 1.0;
  const base = 0.04 * (Number(pet.stars) || 1) * legacyMult;
  out.goldPct = +base.toFixed(4);
  return out;
}

export function computePetPassives(pet) {
  const b = petStatBonus(pet);
  return {
    fortune: Math.round(((b.goldPct || 0) + (b.doubleJackpotPct || 0)) * 100),
    swiftness: Math.round(((b.speedPct || 0) + (b.goSalaryPct || 0) + (b.machWingPct || 0)) * 100),
    power: Math.round(((b.critPct || 0) + (b.ultChargePct || 0)) * 100),
    luck: Math.round(((b.luckPct || 0) + (b.rentCharmPct || 0) + (b.buildRebatePct || 0)) * 100),
    ...b,
  };
}

/**
 * Returns the Soul-Link Ultimate bonus provided by a single Companion Trait Slot:
 * - kind: 'charge' (⚡ Charge %) | 'echo' (💥 Echo %) | 'start' (🔋 Start %)
 * - pct: integer percentage bonus (e.g. 16 for +16%)
 * - label: human-readable badge (e.g. "+16% ⚡ Charge")
 */
export function slotSoulLinkBonus(slot) {
  if (!slot || !slot.stat) return null;
  const def = ALL_SLOT_LINES[slot.stat];
  if (!def) return null;
  const tier = STAT_TIERS.includes(slot.tier) ? slot.tier : 'common';
  const v = Number(slot.value ?? def.values[tier] ?? def.values.common) || 0;
  switch (slot.stat) {
    case 'swiftness':
    case 'ult_charge': {
      const pct = Math.round(v * 100);
      return { kind: 'charge', rateBonus: v, pct, label: `+${pct}% ⚡ Charge` };
    }
    case 'cozy_purr': {
      const rateBonus = Math.round(v * 50) / 100;
      const pct = Math.round(rateBonus * 100);
      return { kind: 'charge', rateBonus, pct, label: `+${pct}% ⚡ Charge` };
    }
    case 'power':
    case 'fortune':
    case 'double_jackpot':
    case 'rent_charm': {
      const pct = Math.round(v * 100);
      return { kind: 'echo', potencyBonus: v, pct, label: `+${pct}% 💥 Echo` };
    }
    case 'berry_gourmand': {
      const potencyBonus = tier === 'mythic' ? 0.12 : tier === 'epic' ? 0.09 : tier === 'rare' ? 0.06 : 0.04;
      const pct = Math.round(potencyBonus * 100);
      return { kind: 'echo', potencyBonus, pct, label: `+${pct}% 💥 Echo` };
    }
    case 'mach_wing':
    case 'luck':
    case 'treasure_sniffer': {
      const pct = Math.round(v * 100);
      return { kind: 'start', startBonus: pct, pct, label: `+${pct}% 🔋 Start` };
    }
    case 'magnet_paw': {
      const pct = Math.round(v * 25);
      return { kind: 'start', startBonus: pct, pct, label: `+${pct}% 🔋 Start` };
    }
    default:
      return null;
  }
}

export function computePetSoulLinkBonuses(pet) {
  const out = { rateBonus: 0, potencyBonus: 0, startBonus: 0, ratePct: 0, potencyPct: 0, startPct: 0 };
  if (!pet || !Array.isArray(pet.slots)) return out;
  const openSlots = openSlotCountForPet(pet);
  for (let i = 0; i < openSlots; i++) {
    const b = slotSoulLinkBonus(pet.slots[i]);
    if (!b) continue;
    if (b.rateBonus) out.rateBonus += b.rateBonus;
    if (b.potencyBonus) out.potencyBonus += b.potencyBonus;
    if (b.startBonus) out.startBonus += b.startBonus;
  }
  out.rateBonus = +out.rateBonus.toFixed(4);
  out.potencyBonus = +out.potencyBonus.toFixed(4);
  out.startBonus = Math.round(out.startBonus);
  out.ratePct = Math.round(out.rateBonus * 100);
  out.potencyPct = Math.round(out.potencyBonus * 100);
  out.startPct = out.startBonus;
  return out;
}

const LEGACY_STAT_BY_OLD_ID = {
  pet_mochi_cat: 'fortune',
  pet_boba_calico: 'fortune',
  pet_nebula_neko: 'fortune',
  pet_ember_wyrm: 'swiftness',
  pet_light_fury: 'swiftness',
  pet_night_fury: 'swiftness',
  pet_boba_shiba: 'power',
  pet_cloud_samoyed: 'power',
  pet_fenrir_wolf: 'power',
  pet_moon_bunny: 'luck',
  pet_sakura_kitsune: 'luck',
  pet_lunar_rabbit: 'luck',
  pet_cloud_bear: 'fortune',
  pet_yuzu_capybara: 'fortune',
  pet_world_turtle: 'fortune',
  pet_starlight_wisp: 'power',
  pet_cyber_valkyrie: 'power',
  pet_shadow_knight: 'power',
  pet_fenrir_pup: 'swiftness',
  pet_storm_wolf: 'swiftness',
  pet_eclipse_okami: 'swiftness',
  pet_ember_whelp: 'power',
  pet_azure_drake: 'power',
  pet_celestial_wyrm: 'power',
  pet_sakura_fox: 'fortune',
  pet_moon_kitsune: 'fortune',
  pet_nine_tail_inari: 'fortune',
  pet_cloud_calf: 'luck',
  pet_aurora_whale: 'luck',
  pet_leviathan_star: 'luck',
};

/**
 * Deterministically normalizes/migrates `rpg.pets` and `rpg.equipped.pet` to Pet System V2.
 */
export function migratePetsState(oldPets = {}, equippedPet = null, lineage = 'bkk', nestLv = 1) {
  const newPets = {};
  const src = oldPets && typeof oldPets === 'object' ? oldPets : {};

  for (const [rawId, rec] of Object.entries(src)) {
    if (!rec || typeof rec !== 'object') continue;
    const canonicalId = normalizePetId(rawId);
    if (!canonicalId || !PETS[canonicalId]) continue;

    // Already V2 record?
    if (Array.isArray(rec.slots)) {
      const rawStars = Math.max(1, Math.min(PET2.MAX_STARS, Number(rec.stars) || 1));
      const bondLv = Math.max(1, Math.min(PET2.BOND_MAX_LV, Math.max(Number(rec.bond_lv) || 1, minLevelForStars(rawStars))));
      const stars = Math.max(rawStars, starsForLevel(bondLv));
      const openSlots = Math.min(stars, MAX_TRAIT_SLOTS);
      const slots = [null, null, null];
      const usedPerks = [];
      for (let i = 0; i < openSlots; i++) {
        const norm = normalizeSlot(rec.slots[i]);
        if (norm) {
          slots[i] = norm;
          if (PERK_LINES[norm.stat]) usedPerks.push(norm.stat);
        } else {
          slots[i] = rollSlot(nestLv, Math.random, { excludePerks: usedPerks });
          if (PERK_LINES[slots[i].stat]) usedPerks.push(slots[i].stat);
        }
      }
      const maxLocks = Math.max(0, openSlots - 1);
      let seenLocks = 0;
      for (let i = 0; i < openSlots; i++) {
        if (slots[i]?.locked) {
          if (seenLocks < maxLocks) seenLocks++;
          else slots[i].locked = false;
        }
      }
      newPets[canonicalId] = {
        stars,
        essence: Math.max(0, Number(rec.essence) || 0),
        spent_essence: Math.max(0, Number(rec.spent_essence ?? spentEssenceForStars(stars)) || 0),
        visual_tier: Math.max(1, Math.min(stars, Number(rec.visual_tier) || stars)),
        nickname: sanitizeNickname(rec.nickname || ''),
        bond_lv: bondLv,
        bond_xp: Math.max(0, Number(rec.bond_xp) || 0),
        hunger: rec.hunger != null ? Math.max(0, Math.min(HUNGER.MAX, Number(rec.hunger))) : HUNGER.DEFAULT,
        costume_id: rec.costume_id || null,
        last_gift_day: String(rec.last_gift_day || ''),
        last_harmony_day: String(rec.last_harmony_day || ''),
        last_interact_at: Number(rec.last_interact_at) || 0,
        slots,
      };
      continue;
    }

    // Legacy V1 record -> merge into canonical V2 pet
    const oldStars = Math.max(1, Math.min(PET2.MAX_STARS, Number(rec.stars) || 1));
    const oldTrait = STAT_TIERS.includes(rec.trait) ? rec.trait : 'common';
    const statKey = LEGACY_STAT_BY_OLD_ID[rawId] || 'fortune';
    const existing = newPets[canonicalId];

    if (!existing) {
      newPets[canonicalId] = createPetRecord(canonicalId, {
        stars: oldStars,
        nestLv,
        initialSlot0: {
          stat: statKey,
          tier: oldTrait,
          value: STAT_LINES[statKey].values[oldTrait],
          locked: false,
        },
      });
      if (rec.costume_id) newPets[canonicalId].costume_id = rec.costume_id;
      if (rec.hunger != null) newPets[canonicalId].hunger = Math.max(0, Math.min(HUNGER.MAX, Number(rec.hunger)));
    } else {
      // Merge duplicate legacy family clone into existing canonical pet
      if (oldStars > existing.stars) {
        const openSlots = Math.min(oldStars, MAX_TRAIT_SLOTS);
        for (let s = Math.min(existing.stars, MAX_TRAIT_SLOTS); s < openSlots; s++) {
          const usedPerks = existing.slots.filter((x) => x && PERK_LINES[x.stat]).map((x) => x.stat);
          existing.slots[s] = rollSlot(nestLv, Math.random, { excludePerks: usedPerks });
        }
        existing.stars = oldStars;
        existing.bond_lv = Math.max(existing.bond_lv || 1, minLevelForStars(oldStars));
        existing.spent_essence = spentEssenceForStars(oldStars);
        existing.visual_tier = oldStars;
      }
      if (TIER_RANK[oldTrait] > TIER_RANK[existing.slots[0]?.tier || 'common']) {
        existing.slots[0] = normalizeSlot({ stat: statKey, tier: oldTrait, locked: false });
      }
      existing.essence = (existing.essence || 0) + 15 * oldStars;
      if (rec.costume_id) existing.costume_id = rec.costume_id;
      if (rec.hunger != null) existing.hunger = Math.max(0, Math.min(HUNGER.MAX, Number(rec.hunger)));
    }
  }

  // Ensure lineage starter pet exists
  const starterId = STARTER_PET[lineage] || (lineage === 'dxb' ? 'pet_ragdoll' : 'pet_nyx');
  if (!newPets[starterId]) {
    newPets[starterId] = createPetRecord(starterId, {
      stars: 1,
      nestLv,
      initialSlot0: {
        stat: lineage === 'dxb' ? 'fortune' : 'power',
        tier: 'rare',
        value: STAT_LINES.fortune.values.rare,
        locked: false,
      },
    });
  }

  let nextEquipped = normalizePetId(equippedPet);
  if (!nextEquipped || !newPets[nextEquipped]) {
    nextEquipped = starterId;
  }

  return { pets: newPets, equippedPet: nextEquipped };
}
