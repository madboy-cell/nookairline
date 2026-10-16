// shared/rpg_rules.js — Step 3 rules: +10 Star-Force Forge, 2-Box Gacha + Shard Shop, Pet Sanctuary.
// Numbers come from the Implementation Plan (Sections 7.C, 9.A, 12, 14.A). Where the plan only gives a
// range ("500 – 1,000 🪙", "100% → 75%"), the per-level values are a straight line between the two ends.
// Those are marked "Locked Step 3 decision" so they are easy to find and change.
// Shared by the server (authoritative rolls) and the client (rates / costs shown in the UI).
import { ACCESSORIES, DICE_SKINS, DICE_IDS, PETS, PET_IDS } from './catalog_gear_pets.js';
import { OUTFITS } from './costumes_catalog.js';
import { WONDERS, DECOR, CORE_LANDMARKS, lerpLv } from './catalog_landmarks.js';
export {
  PET2,
  STAT_TIERS,
  TIER_RANK,
  STAT_LINES,
  PERK_LINES,
  ALL_SLOT_LINES,
  rollTierFromOdds,
  rollSlot,
  normalizeSlot,
  spentEssenceForStars,
  createPetRecord,
  evolveCost,
  rerollCost,
  releaseValue,
  bondXpToNext,
  addBondXp,
  unlockedEmotesForBond,
  giftRoll,
  sanitizeNickname,
  petStatBonus,
  migratePetsState,
  MAX_TRAIT_SLOTS,
  HUNGER,
  hungerZone,
  PET_MILESTONES,
  unlockedPosesForLevel,
  starsForLevel,
} from './pet_rules.js';

// ---------------------------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------------------------
export const MAX_REFINE = 10;
/** Excess duplicates (item already +10) → 🌟 Starlight Shards (Section 9.A / 12). */
export const DUPE_SHARDS = { 1: 5, 2: 25, 3: 100 };

export const itemDef = (id) => OUTFITS[id] || ACCESSORIES[id] || DICE_SKINS[id] || null;
export const itemSlot = (id) => (OUTFITS[id] ? 'outfit' : ACCESSORIES[id]?.slot || DICE_SKINS[id]?.slot || null);

// ---------------------------------------------------------------------------------------------
// +1 → +10 Star-Force Forge (Section 9.A table)
// ---------------------------------------------------------------------------------------------
// Locked Step 3 decision: +1..+4 gold 500 → 1,000 and rate 100% → 75% are spread evenly over 4 levels;
// +6/+7, +8/+9 take the two ends of their ranges.
export const FORGE = {
  // index = TARGET level (1..10)
  GOLD: [0, 500, 650, 850, 1000, 1200, 1500, 1800, 2000, 2200, 2500],
  DUPES: [0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1],
  RATE: [0, 100, 92, 83, 75, 60, 50, 40, 35, 30, 20],
  BERRY_COST: 50,
  BERRY_BONUS: 15,      // ☑️ Use 50 🍓 → +15%
  PITY_PER_FAIL: 12.5,  // Artisan Pity: +12.5% per fail → 8 fails = 100%
  PITY_FAILS_GUARANTEE: 8,
  SOVEREIGN_TITLE: '★10 Sovereign',
  // 🔨 +10 Artisan Protection Scroll (Section 21.L.8): +25% additive rate and double pity energy on a miss.
  // Locked Step 3 decision: "+5 → +10 upgrade" = any attempt whose TARGET is +5..+10 (the dupe-cost tiers).
  SCROLL_ITEM: 'scroll_forge_boost',
  SCROLL_BONUS: 25,
  SCROLL_PITY_FAILS: 2,  // a scrolled miss charges 2 pity steps (+25.0%) instead of 1 (+12.5%)
  SCROLL_MIN_TARGET: 5,
};

export const scrollAllowed = (fromRefine) => (fromRefine | 0) + 1 >= FORGE.SCROLL_MIN_TARGET && (fromRefine | 0) + 1 <= MAX_REFINE;

/** Success chance in percent (0..100) for forging `fromRefine` → `fromRefine + 1`. */
export function forgeChance(fromRefine, { useBerries = false, useScroll = false, onsenPct = 0, pityFails = 0 } = {}) {
  const target = (fromRefine | 0) + 1;
  if (target > MAX_REFINE) return 0;
  if ((pityFails | 0) >= FORGE.PITY_FAILS_GUARANTEE) return 100;
  const scroll = useScroll && scrollAllowed(fromRefine) ? FORGE.SCROLL_BONUS : 0;
  const pct = FORGE.RATE[target] + (useBerries ? FORGE.BERRY_BONUS : 0) + scroll + (onsenPct || 0) + FORGE.PITY_PER_FAIL * (pityFails | 0);
  return Math.min(100, pct);
}

/**
 * Blacksmith red dot (Section 21.L.7): true when any owned outfit/accessory below +10 has
 * `dupes >= 1` (and at least the dupes its next level needs) and the player can pay the next gold cost.
 */
export function forgeReady(profile) {
  const gold = profile?.gold | 0;
  for (const [id, it] of Object.entries(profile?.inventory || {})) {
    if (!itemDef(id)) continue;
    const from = it.refine | 0;
    if (from >= MAX_REFINE) continue;
    const target = from + 1;
    if ((it.dupes | 0) >= Math.max(1, FORGE.DUPES[target]) && gold >= FORGE.GOLD[target]) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------------------------
// Box 1 — Goddess Star-Weave Fashion & Gear (💎 / 🎟️) — Screen 21
// ---------------------------------------------------------------------------------------------
// Locked Step 3 decision: the player's chosen featured season Mythic (default s11_zeus_olympus) takes 50%
// of every Mythic drop on the season banner; the other 50% splits evenly over the remaining 12 Season
// Mythic outfits, 5 Mythic accessories, and 3 Mythic 3D Dice Skins.
export const FEATURED_OUTFIT = 's11_zeus_olympus';
export const FEATURED_SHARE = 0.5;
export const BOX1 = {
  COST_1: 150, COST_10: 1350,           // 💎
  TICKET: 'ticket_standard',            // 1 ticket = 1 pull
  RATES: { 3: 0.03, 2: 0.17, 1: 0.80 },
  PITY: 40,                             // 40th pull without a Mythic = Mythic
  TEN_PULL_MIN_RARITY: 2,               // 10x = guaranteed Epic+
};

const dicePool = (rarity) => DICE_IDS.filter((k) => DICE_SKINS[k].rarity === rarity);
const poolOf = (rarity) => [
  ...Object.keys(ACCESSORIES).filter((k) => !ACCESSORIES[k].starterCosmetic && ACCESSORIES[k].rarity === rarity),
  ...Object.keys(OUTFITS).filter((k) => OUTFITS[k].rarity === rarity && k !== 'newbie_outfit'),
  ...dicePool(rarity),
];
export const BOX1_POOL = { 1: poolOf(1), 2: poolOf(2), 3: poolOf(3) };

// Box 1 sub-banner pills (Section 21.L.1). All four share Box 1's price / 🎟️ ticket and the 10x Epic+ guarantee.
// Locked Step 3 decisions: each banner keeps its OWN 40-pull pity counter (`pityKey`) so pulling one banner never
// eats another's pity; "2× rate-up" = double weight for the listed items inside their rarity tier.
const accPool = (rarity) => Object.keys(ACCESSORIES).filter((k) => !ACCESSORIES[k].starterCosmetic && ACCESSORIES[k].rarity === rarity);
const petPool = () => [...PET_IDS];
export const BOX1_BANNERS = {
  season: {
    name: '🌟 Season 1–11: Starlight Kingdom', kind: 'item', pityKey: 'box1_pity',
    rates: BOX1.RATES, pool: BOX1_POOL, featured: FEATURED_OUTFIT, featuredShare: FEATURED_SHARE,
  },
  relics: {
    name: '🪽 Wings & Relics', kind: 'item', pityKey: 'box1_relics_pity',
    rates: BOX1.RATES, pool: { 1: accPool(1), 2: accPool(2), 3: accPool(3) },
    rateUp: ['wings_golden_seraphim', 'wings_crystal_butterfly', 'gloves_starlight_wand', 'hat_glowing_bunny'], rateUpWeight: 2,
  },
  dice: {
    name: '🎲 Lucky 3D Dice', kind: 'item', pityKey: 'box1_dice_pity',
    rates: BOX1.RATES, pool: { 1: dicePool(1), 2: dicePool(2), 3: dicePool(3) },
  },
  pets: {
    name: '🐾 Pet Eggs', kind: 'pet', pityKey: 'box1_pets_pity',
    rates: { 3: 0.03, 2: 0.15, 1: 0.82 }, pool: { 1: petPool(1), 2: petPool(2), 3: petPool(3) },
  },
};
export const DEFAULT_BANNER = 'season';

// ---------------------------------------------------------------------------------------------
// Box 2 — Royal Architect Buildings & Wonders (🪙 / 🍓) — Screen 22
// ---------------------------------------------------------------------------------------------
// Locked Step 3 decision: the 82% common tier is 70% one Blueprint Card (random core landmark) and 30%
// one decor prop; Epic 15% = the ★2 Wonder (Onsen); Mythic 3% = one of the four ★3 Wonders.
export const BOX2 = {
  COST_1: 1000, COST_10: 9000,          // 🪙
  COST_10_BERRIES: 300,                 // 🍓 (10x only)
  TICKET: 'ticket_gold',
  RATES: { 3: 0.03, 2: 0.15, 1: 0.82 },
  PITY: 40,
  COMMON_BLUEPRINT_SHARE: 0.7,
};
export const BOX2_POOL = {
  blueprints: [...CORE_LANDMARKS],
  decor: Object.keys(DECOR).filter((k) => !DECOR[k].series2),
  2: Object.keys(WONDERS).filter((k) => WONDERS[k].rarity === 2),
  3: Object.keys(WONDERS).filter((k) => WONDERS[k].rarity === 3),
};

// ---------------------------------------------------------------------------------------------
// Tab 3 — Starlight Shard 0%-RNG Exchange (Screen 23)
// ---------------------------------------------------------------------------------------------
export const SHARD_OFFERS = {
  mythic_outfit:      { cost: 400, name: 'Any Season 1–11 Mythic Outfit Set', pick: 'outfit' },
  vip_wonder:         { cost: 350, name: 'Any 4×4 VIP Wonder', pick: 'wonder' },
  seraphim_wings:     { cost: 300, name: 'Golden Seraphim 6-Wings', item: 'wings_golden_seraphim' },
  night_fury_egg:     { cost: 250, name: 'Nyx, the Midnight Drake Pet Egg', pet: 'pet_nyx' },
  nyx_egg:            { cost: 250, name: 'Nyx, the Midnight Drake Pet Egg', pet: 'pet_nyx' },
  ragdoll_egg:        { cost: 250, name: 'Princess Ragdoll Pet Egg', pet: 'pet_ragdoll' },
  kitsune_egg:        { cost: 250, name: 'Sakura Kitsune Pet Egg', pet: 'pet_kitsune' },
  skywhale_egg:       { cost: 250, name: 'Baby Sky Whale Pet Egg', pet: 'pet_skywhale' },
  vip_communicator:   { cost: 200, name: 'VIP Starlight Communicator', bag: 'vip_communicator' },
  mythic_dice:        { cost: 150, name: 'Any ★3 Mythic 3D Dice Skin', pick: 'dice' },
  accessory_dupe_box: { cost: 80, name: 'Any +10 Accessory Dupe Pick Box', pick: 'accessory' },
};
export const SEASON_OUTFITS = Object.keys(OUTFITS).filter((k) => OUTFITS[k].season);
export const MYTHIC_DICE = DICE_IDS.filter((k) => DICE_SKINS[k].rarity === 3);
export const VIP_WONDERS = Object.keys(WONDERS).filter((k) => WONDERS[k].w === 4 && WONDERS[k].h === 4);

// ---------------------------------------------------------------------------------------------
// Pet Sanctuary (Section 7.C)
// ---------------------------------------------------------------------------------------------
export const PET = {
  MAX_LEVEL: 20,
  MAX_STARS: 3,
  FEED_COST: 10, FEED_EXP: 50, FEED_MOOD: 25, MAX_MOOD: 100,
  REROLL_COST: 80,
  TRAIT_SLOTS: 3,
  BREED_GOLD: 2000, BREED_BERRIES: 100,
  HATCH_PLAYER_EXP: 30,
  LOYAL_MULT: 1.25,
  STAR_DUPES: { 2: 2, 3: 5 },
};
export const petExpToNext = (lv) => (lv >= PET.MAX_LEVEL ? Infinity : 100 * lv);
/** Star rank earned from cumulative star-dupes alone (1..3). */
export const starsFromDupes = (n) => ((n | 0) >= PET.STAR_DUPES[3] ? 3 : (n | 0) >= PET.STAR_DUPES[2] ? 2 : 1);
/** Star-dupes needed to reach the next star from `stars` (null at ★3). */
export const nextStarDupes = (stars) => (stars >= PET.MAX_STARS ? null : PET.STAR_DUPES[stars + 1]);

export const TRAITS = {
  double_jackpot:   { tier: 'mythic', name: '🌟 Double Jackpot' },
  mach_wing:        { tier: 'mythic', name: '⚡ Mach Wing' },
  treasure_sniffer: { tier: 'epic',   name: '💎 Treasure Sniffer' },
  berry_gourmand:   { tier: 'epic',   name: '🍓 Berry Gourmand' },
  magnet_paw:       { tier: 'rare',   name: '🧲 Magnet Paw' },
  cozy_purr:        { tier: 'common', name: '❤️ Cozy Purr' },
};
const TIER_ODDS = { mythic: [3, 6], epic: [17, 24], rare: [35, 35], common: [45, 35] }; // Nest Lv 1 → Lv 10 (%)

/** Trait tier odds (%) at a Cozy Pet Nest level; always sums to 100. Each tier splits evenly over its traits. */
export function traitOdds(nestLv = 1) {
  const out = {};
  for (const [tier, [a, b]] of Object.entries(TIER_ODDS)) out[tier] = lerpLv(a, b, nestLv);
  return out;
}

/** Weighted single-trait roll. `minTier: 'epic'` = Couple Egg guarantee (Epic or Mythic only). */
export function rollTrait(nestLv, rng = Math.random, { minTier = null } = {}) {
  const odds = traitOdds(nestLv);
  const tiers = minTier === 'epic' ? ['mythic', 'epic'] : ['mythic', 'epic', 'rare', 'common'];
  const total = tiers.reduce((s, t) => s + odds[t], 0);
  let r = rng() * total, tier = tiers[tiers.length - 1];
  for (const t of tiers) { if ((r -= odds[t]) < 0) { tier = t; break; } }
  const names = Object.keys(TRAITS).filter((k) => TRAITS[k].tier === tier);
  return names[Math.min(names.length - 1, Math.floor(rng() * names.length))];
}

/** Family passive % incl. level (+1%/lv) and the Lv 20 Loyal multiplier (Section 7.A / 7.C). */
export function petPassivePct(petId, stars, level, mood = 100) {
  const base = PET_PASSIVE[PETS[petId]?.family];
  if (!base) return 0;
  const s = Math.max(1, Math.min(PET.MAX_STARS, stars || PETS[petId].rarity));
  let pct = base[0] + ((base[1] - base[0]) * (s - 1)) / 2 + Math.max(0, (level | 0) - 1);
  if ((level | 0) >= PET.MAX_LEVEL && mood >= PET.MAX_MOOD) pct *= PET.LOYAL_MULT;
  return Math.round(pct * 10) / 10;
}
// ★1 → ★3 passive range per family (Section 7.A + V2 families)
export const PET_PASSIVE = {
  cats: [15, 35], dragons: [15, 35], pups: [15, 35], fae: [15, 35], chonkers: [25, 50], spirits: [20, 40],
  ragdoll: [15, 35], nyx: [15, 35], kitsune: [15, 35], skywhale: [25, 50],
};
