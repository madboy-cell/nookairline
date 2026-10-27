// shared/universal_stats.js — Authoritative 4-stat formula for NEORA WORLD V2.
// Shared by client and server: computes Level base, 6 gear slots (+ Star-Force refine & Attunement),
// and Pet Sanctuary passives (Family passive via PET_STAT + Companion trait slot passives).

import { ACCESSORIES } from './catalog_gear_pets.js';
import { OUTFITS } from './costumes_catalog.js';
import { PETS } from './pet_catalog.js';
import { normalizeItemStats, PET_STAT } from './monopoly_rules.js';
import { computePetPassives } from './pet_rules.js';
import { petPassivePct } from './rpg_rules.js';
import { computeCharmStats } from './charm_catalog.js';

export const STAT_KEYS = ['fortune', 'swiftness', 'power', 'luck'];

export const GEAR_SLOTS = ['outfit', 'hat', 'face', 'gloves', 'boots', 'wings'];

/**
 * Soft-cap exponential curve: asymptotes towards `cap` as `stat` increases.
 * `k` = stat points needed to reach ~63.2% of the cap.
 */
export function softCap(stat, cap, k = 60) {
  return stat > 0 ? cap * (1 - Math.exp(-stat / k)) : 0;
}

/**
 * Computes authoritative RPG stats: base, gear, pet, charm, bonus, total.
 * - base: Level base (fortune 20+lv*4, swiftness 15+lv*3, power 25+lv*5, luck 15+lv*3)
 * - gear: 6 gear slots ('outfit','hat','face','gloves','boots','wings'); dice slot is excluded.
 *         Refine mult = 1 + 0.15*refine.
 *         Rarity 3 / super_mythic default raw = { all: 24 }, otherwise { all: 8 }.
 *         Normalized with normalizeItemStats; `all` feeds all 4 stats.
 *         Attunement: if slot has `attune: { stat }`, moves secondary non-all line to attune.stat.
 * - pet:  Family passive (scaled by petPassivePct and mapped via PET_STAT) + Trait slot passives
 *         (weighted fortune*4, swiftness*6, power*5, luck*6).
 * - charm: Equipped Starlight Aura Charm rolled stats (scaled by awakening level 1..10).
 * - bonus: gear + pet + charm
 * - total: base + bonus
 *
 * @param {object} profile - Player profile containing level, equipped items, pets, and charms
 * @param {object} [opts] - Optional catalog overrides or settings
 */
export function computeUniversalStats(profile, opts = {}) {
  const outfits = opts.outfits || opts.catalogs?.outfits || OUTFITS;
  const accessories = opts.accessories || opts.catalogs?.accessories || ACCESSORIES;
  const pets = opts.pets || opts.catalogs?.pets || PETS;

  const lv = Math.max(1, profile?.level | 0);
  const base = {
    fortune: 20 + lv * 4,
    swiftness: 15 + lv * 3,
    power: 25 + lv * 5,
    luck: 15 + lv * 3,
  };

  const gear = { fortune: 0, swiftness: 0, power: 0, luck: 0 };
  const eq = profile?.equipped || {};

  for (const s of GEAR_SLOTS) {
    const eqItem = eq[s];
    const id = eqItem?.id;
    if (!id) continue;

    const def = (s === 'outfit' ? outfits[id] : accessories[id]) || outfits[id] || accessories[id];
    if (!def) continue;

    // Treat 'super_mythic' as rarity 3 (Fix bug 2: super_mythic outfits fell back to {all: 8})
    let rarity = def.rarity;
    if (rarity === 'super_mythic' || def.superMythic || def.powerRarity === 3) {
      rarity = 3;
    } else {
      rarity = Number(rarity) || 1;
    }

    const invEntry = profile?.inventory?.[id];
    const raw = eqItem?.rolledStats || invEntry?.rolledStats || def.stats || (rarity === 3 ? { all: 24 } : { all: 8 });
    const norm = normalizeItemStats(raw, rarity);

    const itemStats = {
      fortune: norm.fortune || 0,
      swiftness: norm.swiftness || 0,
      power: norm.power || 0,
      luck: norm.luck || 0,
      all: norm.all || 0,
    };

    // Support future Attunement: if an equipped slot entry has `attune: { stat }`,
    // move the item's SECONDARY stat line value (the smaller of its two non-all stat lines
    // after normalization) onto `attune.stat` (only if attune.stat differs from the main/biggest line).
    const attuneStat = eqItem?.attune?.stat;
    if (attuneStat && STAT_KEYS.includes(attuneStat)) {
      const nonAllStats = STAT_KEYS.filter((k) => itemStats[k] > 0);
      if (nonAllStats.length >= 2) {
        nonAllStats.sort((a, b) => itemStats[b] - itemStats[a]);
        const mainStat = nonAllStats[0];
        const secStat = nonAllStats[1];

        // Attunement only applies if attune.stat differs from the main/biggest line.
        // If both lines are tied, neither can be stacked into, so attune.stat must differ from both.
        const isMainLine = attuneStat === mainStat || (itemStats[mainStat] === itemStats[secStat] && attuneStat === secStat);
        if (!isMainLine && attuneStat !== secStat) {
          itemStats[attuneStat] = (itemStats[attuneStat] || 0) + itemStats[secStat];
          itemStats[secStat] = 0;
        }
      }
    }

    const mult = 1 + 0.15 * Math.max(0, eqItem?.refine | 0);
    // Fix bug 1: norm.all was previously ignored; now added to every stat
    for (const k of STAT_KEYS) {
      const statVal = (itemStats[k] || 0) + (itemStats.all || 0);
      gear[k] += Math.round(statVal * mult);
    }
  }

  // Pet passive contribution (V2 random stat slots + family passive)
  const pet = { fortune: 0, swiftness: 0, power: 0, luck: 0 };
  const eqPet = eq.pet;
  let petFamily = null;
  let petPct = 0;

  if (eqPet?.id && pets[eqPet.id]) {
    const petDef = pets[eqPet.id];
    petFamily = petDef.family;

    const petObj = (profile?.pets && !Array.isArray(profile.pets) ? profile.pets[eqPet.id] : null)
      || (Array.isArray(profile?.pets) ? profile.pets.find((p) => p.id === eqPet.id || (p.uid && p.uid === eqPet.uid)) : null)
      || eqPet;

    const stars = eqPet.stars ?? petObj?.stars ?? petDef.rarity ?? 1;
    const level = eqPet.level ?? petObj?.level ?? 1;
    const mood = eqPet.mood ?? petObj?.mood ?? 100;

    petPct = petPassivePct(eqPet.id, stars, level, mood);
    const familyBonus = Math.round(petPct * 2.5);

    let targetStat = PET_STAT[petFamily] || PET_STAT[eqPet.id] || 'luck';
    if (targetStat === 'guardian') targetStat = 'power';
    if (!STAT_KEYS.includes(targetStat)) targetStat = 'luck';

    pet[targetStat] += familyBonus;

    // Pet trait passives via computePetPassives weighted: fortune*4, swiftness*6, power*5, luck*6
    if (Array.isArray(petObj?.slots)) {
      const pPassives = computePetPassives(petObj);
      pet.fortune += Math.round((pPassives.fortune || 0) * 4);
      pet.swiftness += Math.round((pPassives.swiftness || 0) * 6);
      pet.power += Math.round((pPassives.power || 0) * 5);
      pet.luck += Math.round((pPassives.luck || 0) * 6);
    }
  }

  // Equipped Starlight Aura Charm contribution (rolled B/A/S/SS stats * level multiplier)
  const eqCharm = eq.charm;
  let charmSource = eqCharm;
  if (eqCharm?.id && !eqCharm?.stats && Array.isArray(profile?.charms)) {
    charmSource = profile.charms.find((c) => c.uid === eqCharm.uid || c.id === eqCharm.id) || eqCharm;
  }
  const charm = computeCharmStats(charmSource);

  const bonus = {
    fortune: gear.fortune + pet.fortune + charm.fortune,
    swiftness: gear.swiftness + pet.swiftness + charm.swiftness,
    power: gear.power + pet.power + charm.power,
    luck: gear.luck + pet.luck + charm.luck,
  };

  const total = {
    fortune: base.fortune + bonus.fortune,
    swiftness: base.swiftness + bonus.swiftness,
    power: base.power + bonus.power,
    luck: base.luck + bonus.luck,
  };

  return {
    base,
    gear,
    pet,
    charm,
    bonus,
    total,
    petFamily,
    petPct,
  };
}

/** Attunement cost ladder (GEAR_ATTUNEMENT_GLAMOUR.md §1.3): 1st is FREE, then soft-currency gold + berries. */
export const ATTUNE_MIN_REFINE = 5;
export const ATTUNE_COSTS = [
  { gold: 0, berries: 0, free: true },
  { gold: 2000, berries: 50, free: false },
  { gold: 4000, berries: 100, free: false },
  { gold: 6000, berries: 150, free: false },
];

export function attuneCostFor(count = 0) {
  const idx = Math.max(0, Math.min(ATTUNE_COSTS.length - 1, count | 0));
  return { ...ATTUNE_COSTS[idx] };
}

/**
 * Inspects an item's main and secondary stat lines for 🎯 Gear Attunement.
 * @param {string} itemId
 * @param {number} [refine=0]
 * @param {string|null} [attuneStat=null]
 * @param {object} [opts]
 */
export function inspectItemAttune(itemId, refine = 0, attuneStat = null, opts = {}) {
  const outfits = opts.outfits || OUTFITS;
  const accessories = opts.accessories || ACCESSORIES;
  const def = accessories[itemId] || outfits[itemId];
  if (!def) return { attunable: false, reason: 'unknown_item' };
  const slot = def.slot || (outfits[itemId] ? 'outfit' : null);
  if (!['hat', 'face', 'gloves', 'boots', 'wings'].includes(slot)) {
    return { attunable: false, reason: 'invalid_slot', slot };
  }
  let rarity = def.rarity;
  if (rarity === 'super_mythic' || def.superMythic || def.powerRarity === 3) rarity = 3;
  else rarity = Number(rarity) || 1;
  const raw = opts.rolledStats || def.stats || (rarity === 3 ? { all: 24 } : { all: 8 });
  const norm = normalizeItemStats(raw, rarity);
  if (norm.all > 0) return { attunable: false, reason: 'all_stat_item', slot };

  const nonAllStats = STAT_KEYS.filter((k) => (norm[k] || 0) > 0);
  if (nonAllStats.length < 2) return { attunable: false, reason: 'single_stat_item', slot };
  nonAllStats.sort((a, b) => (norm[b] || 0) - (norm[a] || 0));
  const mainStat = nonAllStats[0];
  const defaultSecStat = nonAllStats[1];
  const tied = (norm[mainStat] || 0) === (norm[defaultSecStat] || 0);
  const mult = 1 + 0.15 * Math.max(0, refine | 0);
  const mainVal = Math.round((norm[mainStat] || 0) * mult);
  const secVal = Math.round((norm[defaultSecStat] || 0) * mult);
  const allowedStats = STAT_KEYS.filter((k) => k !== mainStat && (!tied || k !== defaultSecStat));
  const activeSecStat = (attuneStat && allowedStats.includes(attuneStat)) ? attuneStat : defaultSecStat;
  return {
    attunable: true,
    unlocked: (refine | 0) >= ATTUNE_MIN_REFINE,
    slot,
    mainStat,
    mainVal,
    defaultSecStat,
    activeSecStat,
    secVal,
    allowedStats,
  };
}

function defenderModsFromStats(stats = {}, { petFamily = null, petPct = 0 } = {}) {
  const fortune = Number(stats.fortune) || 0;
  const swiftness = Number(stats.swiftness) || 0;
  const power = Number(stats.power) || 0;
  const luck = Number(stats.luck) || 0;

  return {
    startCoins: 100 + Math.min(200, Math.round(fortune * 1.0)),
    coinMult: +(1 + Math.min(1.5, fortune * 0.005)).toFixed(3),
    podiumMult: +(1 + Math.min(2.0, fortune * 0.006)).toFixed(3),
    atkSpeedMult: +(1 + Math.min(0.8, swiftness * 0.004)).toFixed(3),
    moveSpeedMult: +(1 + Math.min(0.35, swiftness * 0.002)).toFixed(3),
    dashCdMult: +(Math.max(0.45, 1 - swiftness * 0.0025)).toFixed(3),
    dmgMult: +(1 + Math.min(1.5, power * 0.006)).toFixed(3),
    ultChargeMult: +(1 + Math.min(1.0, power * 0.004)).toFixed(3),
    critChance: +(Math.min(0.55, 0.05 + luck * 0.002)).toFixed(3),
    critMult: 1.75,
    mercLuckPct: +(Math.min(0.5, luck * 0.0025)).toFixed(3),
    petFamily,
    petPct,
  };
}

export function defenderModsFromProfile(prof = {}, catalogs = {}) {
  const uni = computeUniversalStats(prof, { catalogs });
  const mods = defenderModsFromStats(uni.total, {
    petFamily: uni.petFamily,
    petPct: uni.petPct,
  });
  return {
    ...mods,
    stats: uni.total,
    bonus: uni.bonus,
    outfitId: prof?.equipped?.outfit?.id || 's1_naga_sovereign',
    petId: prof?.equipped?.pet?.id || prof?.pets?.[0]?.id || 'pet_ragdoll',
    petStars: prof?.equipped?.pet?.stars || prof?.pets?.[0]?.stars || 1,
  };
}

export const STAT_META = Object.freeze({
  power:     Object.freeze({ key: 'power',     label: 'Power',     short: 'PWR', icon: '🔥' }),
  swiftness: Object.freeze({ key: 'swiftness', label: 'Swiftness', short: 'SWF', icon: '⚡' }),
  fortune:   Object.freeze({ key: 'fortune',   label: 'Vitality',  short: 'VIT', icon: '💖' }),
  luck:      Object.freeze({ key: 'luck',      label: 'Luck',      short: 'LCK', icon: '🍀' }),
});

/**
 * Sky Frontier stat multipliers (Master Crafters Combat & Vitality V2):
 * - 🔥 Power     -> attackDamageMult (+75% softCap; scales Basic Combos, Monster Skills & Ultimates)
 * - ⚡ Swiftness -> moveSpeedMult (+25% softCap), skillHasteMult (+35% softCap cooldown haste)
 * - 💖 Vitality  -> maxHpBonus (+0..140 Max HP), hpRegenPerSec (+0.6..5.0 HP/s passive regen), healShieldMult (+65% softCap), gatherYieldMult (+50% softCap)
 * - 🍀 Luck      -> critChance (8%..45%), rareFindMult (+35% softCap rare & Skill Scroll drop rate)
 */
export function skyFrontierMods(stats = {}, { petFamily = null, petPct = 0 } = {}) {
  const fortune = Number(stats.fortune) || 0;
  const swiftness = Number(stats.swiftness) || 0;
  const power = Number(stats.power) || 0;
  const luck = Number(stats.luck) || 0;
  return {
    attackDamageMult: +(1 + softCap(power, 0.75, 150)).toFixed(3),
    gatherYieldMult: +(1 + softCap(fortune, 0.50, 140)).toFixed(3),
    maxHpBonus: Math.round(softCap(fortune, 140, 150)),
    hpRegenPerSec: +(0.6 + softCap(fortune, 4.4, 140)).toFixed(2),
    healShieldMult: +(1 + softCap(fortune, 0.65, 150)).toFixed(3),
    rareFindMult: +(1 + softCap(luck, 0.35, 140)).toFixed(3),
    moveSpeedMult: +(1 + softCap(swiftness, 0.25, 140)).toFixed(3),
    skillHasteMult: +(1 + softCap(swiftness, 0.35, 150)).toFixed(3),
    critChance: +(Math.min(0.45, 0.08 + softCap(luck, 0.27, 140))).toFixed(3),
    petFamily,
    petPct,
  };
}



