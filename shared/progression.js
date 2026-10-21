// shared/progression.js — EXP curve + Character Power (Implementation Plan Sections 4.A / 4.B).
import { ACCESSORIES, DICE_SKINS, PETS } from './catalog_gear_pets.js';
import { OUTFITS } from './costumes_catalog.js';

export const MAX_LEVEL = 50;
export const SLOTS = ['outfit', 'hat', 'face', 'gloves', 'boots', 'wings'];
export const RARITY_BASE_CP = { 1: 200, 2: 400, 3: 700 };

/** EXP needed to go from level L to L+1. */
export const expToNext = (L) => (L >= MAX_LEVEL ? Infinity : Math.floor(200 * Math.pow(L, 1.35)));

export const LEVEL_UP_REWARD = { diamonds: 50, petMoodRefill: true };

/** Adds EXP, handling multi-level-ups. Returns { level, exp, levelsGained }. Pure. */
export function applyExp(level, exp, gained) {
  let L = level, e = exp + Math.max(0, gained | 0), up = 0;
  while (L < MAX_LEVEL && e >= expToNext(L)) { e -= expToNext(L); L++; up++; }
  if (L >= MAX_LEVEL) e = 0;
  return { level: L, exp: e, levelsGained: up };
}

export function itemRarity(slot, itemId) {
  if (!itemId) return 0;
  if (slot === 'outfit') { const o = OUTFITS[itemId]; return o?.powerRarity || (typeof o?.rarity === 'number' ? o.rarity : 0); }
  if (slot === 'dice') return DICE_SKINS[itemId]?.rarity || 0;
  return ACCESSORIES[itemId]?.rarity || 0;
}

/** Integer-math slot CP: Base x (100 + 15*refine) / 100. */
export function slotCP(slot, itemId, refine = 0) {
  const base = RARITY_BASE_CP[itemRarity(slot, itemId)] || 0;
  const r = Math.max(0, Math.min(10, refine | 0));
  return (base * (100 + 15 * r)) / 100;
}

/**
 * profile.equipped = { outfit: {id, refine}, hat: {...}, ..., dice?: {id, refine}, pet: {id, stars, level} }
 * profile.village.comfort = number
 */
export function recalcPlayerCP(profile) {
  const eq = profile.equipped || {};
  let cp = (profile.level | 0) * 120;
  for (const s of SLOTS) if (eq[s]?.id) cp += slotCP(s, eq[s].id, eq[s].refine);
  if (eq.dice?.id) cp += slotCP('dice', eq.dice.id, eq.dice.refine);
  if (eq.charm?.id) {
    const tier = Math.max(1, Math.min(4, Number(eq.charm.tier) || 1));
    const lv = Math.max(1, Math.min(10, Number(eq.charm.level) || 1));
    cp += tier * 250 + (lv - 1) * 45;
  }
  const pet = eq.pet;
  if (pet?.id && PETS[pet.id]) cp += (pet.stars ?? PETS[pet.id].rarity) * 450 + (pet.level | 0) * 35;
  cp += Math.floor((profile.village?.comfort || 0) * 0.5);
  return Math.floor(cp);
}
