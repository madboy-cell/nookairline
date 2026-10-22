// server/rpg_service.js — Step 3 + Pet System V2 authoritative RPG economy:
// 2-Box Gacha + Shard Shop, +10 Star-Force Forge, 6-slot Wardrobe, and Soul-Bond Pet Sanctuary V2.
import { ACCESSORIES, DICE_SKINS, PETS, LEGACY_PET_RARITY, normalizePetId } from '../shared/catalog_gear_pets.js';
import { OUTFITS } from '../shared/costumes_catalog.js';
import { HAIRSTYLES, HAIR_COLORS, HAIR_TIERS, HAIR_DYE_TIERS } from '../shared/hair_catalog.js';
import { SLOTS, recalcPlayerCP } from '../shared/progression.js';
import { WONDERS, DECOR, MAX_WONDER_STARS, WONDER_DUPE_SHARDS } from '../shared/catalog_landmarks.js';
import { utcDay } from '../shared/village_rules.js';
import {
  MAX_REFINE, DUPE_SHARDS, itemDef, itemSlot, FORGE, forgeChance, scrollAllowed, BOX1, BOX1_BANNERS, DEFAULT_BANNER,
  FEATURED_OUTFIT, BOX2, BOX2_POOL, SHARD_OFFERS, SEASON_OUTFITS, MYTHIC_DICE, VIP_WONDERS, PET, petExpToNext, starsFromDupes, rollTrait, TRAITS,
  PET2, PERK_LINES, rollSlot, normalizeSlot, spentEssenceForStars, evolveCost, rerollCost,
  releaseValue, addBondXp, unlockedEmotesForBond, giftRoll, sanitizeNickname,
  HUNGER, hungerZone, PET_MILESTONES, unlockedPosesForLevel, unlockedSelectablePosesForLevel, normalizeActivePoses,
  starsForLevel, minLevelForStars, openSlotCountForPet, MAX_TRAIT_SLOTS,
  SUPER_MYTHIC, SUPER_MYTHIC_POOL, superMythicEnabled, rollBox1Rarities, GIFT_PULL,
} from '../shared/rpg_rules.js';
import { grantExp, refreshDerived } from './economy_service.js';
import { computeUniversalStats, inspectItemAttune, attuneCostFor, STAT_KEYS } from '../shared/universal_stats.js';
import { detectBuild, diffBuilds } from '../shared/dash_builds.js';
import {
  CHARMS,
  computeCharmStats,
  upsertCharmToProfile,
  getCharmPlus,
  findBestCharmForId,
  consumeCharmInBag,
  salvageCharmInBag,
  toggleCharmLockInBag,
} from '../shared/charm_catalog.js';

const fail = (error, extra = {}) => ({ ok: false, error, ...extra });
const pick = (arr, rng) => arr[Math.min(arr.length - 1, Math.floor(rng() * arr.length))];
/** Weighted pick: `weightOf(item)` ≥ 0; falls back to the last item on float edge cases. */
function pickWeighted(arr, weightOf, rng) {
  const total = arr.reduce((s, k) => s + weightOf(k), 0);
  let r = rng() * total;
  for (const k of arr) { if ((r -= weightOf(k)) < 0) return k; }
  return arr[arr.length - 1];
}

const nestLevel = (p) => p.village?.levels?.nest || 1;

function syncTraitsMirror(pet) {
  if (!Array.isArray(pet.slots)) return;
  pet.traits = [0, 1, 2].map((i) => {
    const s = pet.slots[i];
    if (!s) return pet.traits?.[i] || null;
    if (TRAITS[s.stat]) return s.stat;
    return pet.traits?.[i] || 'cozy_purr';
  });
}

// ---------------------------------------------------------------------------------------------
// Profile migration (pre-Step-3, pre-Step-3.5 & pre-Pet-V2 saves) — never loses progress
// ---------------------------------------------------------------------------------------------
export function migrateRpg(p) {
  p.inventory = p.inventory || {};
  p.equipped = p.equipped || { outfit: { id: 'newbie_outfit', refine: 0 }, hat: null, face: null, gloves: null, boots: null, wings: null, pet: null };
  // Step 3.5 Character Foundation v2 migration: legacy bkk/dxb → appearance + starter ears/tails
  const wasPreV2 = !p.appearance || !p.appearance.body;
  const isGirl = p.appearance?.body === 'girl' || (!p.appearance?.body && (p.lineage === 'dxb' || p.lineage === 'girl'));
  const body = isGirl ? 'girl' : 'boy';
  const defaultHair = isGirl ? 'hair_girl_waves' : 'hair_boy_fluffy';
  const defaultColor = isGirl
    ? (p.lineage === 'dxb' ? 'coral' : 'chestnut')
    : (p.lineage === 'bkk' ? 'silver' : 'chestnut');
  const hair = (p.appearance?.hair && HAIRSTYLES[p.appearance.hair]) ? p.appearance.hair : defaultHair;
  const hairColor = (p.appearance?.hairColor && HAIR_COLORS[p.appearance.hairColor]) ? p.appearance.hairColor : defaultColor;
  p.appearance = { body, hair, hairColor };
  p.lineage = isGirl ? 'dxb' : 'bkk';

  const earId = isGirl ? 'hat_dragon_horns' : 'hat_wolf_ears';
  const tailId = isGirl ? 'back_dragon_tail' : 'back_wolf_tail';
  if (!p.inventory[earId]) p.inventory[earId] = { refine: 0, dupes: 0, pity: 0 };
  if (!p.inventory[tailId]) p.inventory[tailId] = { refine: 0, dupes: 0, pity: 0 };
  if (wasPreV2) {
    if (!p.equipped.hat?.id) p.equipped.hat = { id: earId, refine: 0 };
    if (!p.equipped.wings?.id) p.equipped.wings = { id: tailId, refine: 0 };
  }

  const ownedHairs = new Set(Array.isArray(p.owned_hairs) ? p.owned_hairs.filter((k) => HAIRSTYLES[k]) : []);
  ownedHairs.add('hair_boy_fluffy');
  ownedHairs.add('hair_girl_waves');
  ownedHairs.add(hair);
  p.owned_hairs = Array.from(ownedHairs);

  const unlockedColors = new Set(Array.isArray(p.unlocked_hair_colors) ? p.unlocked_hair_colors.filter((k) => HAIR_COLORS[k]) : []);
  for (const sc of ['chestnut', 'midnight', 'honey', 'silver', hairColor]) if (HAIR_COLORS[sc]) unlockedColors.add(sc);
  for (const hId of p.owned_hairs) {
    const dc = HAIRSTYLES[hId]?.defaultColor;
    if (dc && HAIR_COLORS[dc]) unlockedColors.add(dc);
  }
  p.unlocked_hair_colors = Array.from(unlockedColors);
  p.hair_pity = { royal: p.hair_pity?.royal | 0, celestial: p.hair_pity?.celestial | 0 };

  for (const it of Object.values(p.inventory)) { it.refine = it.refine | 0; it.dupes = it.dupes | 0; it.pity = it.pity | 0; }
  p.gacha = { box1_pity: 0, box2_pity: 0, featured_outfit: FEATURED_OUTFIT, ...(p.gacha || {}) };
  if (!SEASON_OUTFITS.includes(p.gacha.featured_outfit)) p.gacha.featured_outfit = FEATURED_OUTFIT;
  for (const b of Object.values(BOX1_BANNERS)) p.gacha[b.pityKey] = p.gacha[b.pityKey] | 0;
  p.gacha[SUPER_MYTHIC.PITY_KEY] = Math.max(0, Math.min(SUPER_MYTHIC.HARD_PITY - 1, p.gacha[SUPER_MYTHIC.PITY_KEY] | 0));
  p.gacha.gifts_pending = Array.isArray(p.gacha.gifts_pending) ? p.gacha.gifts_pending.slice(0, GIFT_PULL.MAX_PENDING) : [];
  p.badges = Array.isArray(p.badges) ? p.badges : [];
  p.bag_items = p.bag_items || {};
  if (!Array.isArray(p.charms)) {
    p.charms = (p.charms && typeof p.charms === 'object') ? Object.values(p.charms).filter((c) => c && c.id) : [];
  }
  p.charms.forEach((c, idx) => {
    if (!c || typeof c !== 'object') return;
    if (!c.uid) c.uid = `chm_mig_${idx}_${c.id || 'charm'}`;
    const plus = getCharmPlus(c);
    c.plus = plus;
    c.level = plus + 1;
    c.locked = Boolean(c.locked);
  });
  if (p.equipped?.charm?.id) {
    const cDef = CHARMS[p.equipped.charm.id];
    const ownedC = findBestCharmForId(p.charms, p.equipped.charm.uid || p.equipped.charm.id);
    if (!cDef || !ownedC) {
      p.equipped.charm = null;
    } else {
      const plus = getCharmPlus(ownedC);
      p.equipped.charm = {
        uid: ownedC.uid,
        id: cDef.id,
        tier: cDef.tier,
        auraKind: cDef.auraKind,
        grade: ownedC.grade || 'B',
        plus,
        level: plus + 1,
        stats: { ...(ownedC.stats || {}) },
      };
    }
  }
  p.star_essence = Math.max(0, p.star_essence | 0);
  p.pets = Array.isArray(p.pets) ? p.pets : [];

  const nLv = nestLevel(p);
  const byCanonical = new Map();
  const migratedPets = [];

  p.pets.forEach((pet, i) => {
    if (!pet || typeof pet !== 'object') return;
    const rawId = pet.id || 'pet_ragdoll';
    const catRarity = LEGACY_PET_RARITY[rawId] ?? PETS[rawId]?.rarity ?? 1;
    const canonicalId = normalizePetId(rawId);
    pet.id = canonicalId;
    pet.uid = pet.uid || `pet${i + 1}`;
    pet.exp = pet.exp | 0;
    pet.mood = pet.mood ?? PET.MAX_MOOD;
    pet.level = Math.max(1, pet.level | 0);
    const rawStars = Math.max(1, Math.min(PET2.MAX_STARS, pet.stars ?? catRarity ?? 1));
    pet.star_dupes = Math.max(pet.star_dupes | 0, rawStars > catRarity ? PET.STAR_DUPES[rawStars] || 0 : 0);
    const prevBondLv = Math.max(1, Math.min(PET2.BOND_MAX_LV, Number(pet.bond_lv) || 1));
    pet.bond_lv = Math.max(1, Math.min(PET2.BOND_MAX_LV, Math.max(prevBondLv, minLevelForStars(rawStars))));
    const stars = Math.max(rawStars, starsForLevel(pet.bond_lv));
    pet.stars = stars;
    pet.essence = Math.max(0, Number(pet.essence) || 0);
    pet.spent_essence = Math.max(0, Number(pet.spent_essence ?? spentEssenceForStars(rawStars)) || 0);
    pet.visual_tier = Math.max(1, Math.min(stars, Number(pet.visual_tier) || stars));
    pet.nickname = sanitizeNickname(pet.nickname || '');
    pet.bond_xp = Math.max(0, Number(pet.bond_xp) || 0);
    if (pet.hunger != null) pet.hunger = Math.max(0, Math.min(HUNGER.MAX, Number(pet.hunger)));
    pet.costume_id = pet.costume_id || null;
    if (Array.isArray(pet.active_poses)) {
      if (pet.bond_lv > prevBondLv) {
        const prevUnlocked = unlockedSelectablePosesForLevel(prevBondLv);
        const nowUnlocked = unlockedSelectablePosesForLevel(pet.bond_lv);
        const cur = new Set(pet.active_poses);
        for (const pPose of nowUnlocked) {
          if (!prevUnlocked.includes(pPose)) cur.add(pPose);
        }
        pet.active_poses = Array.from(cur);
      }
      pet.active_poses = normalizeActivePoses(pet.active_poses, pet.bond_lv);
    }
    pet.last_gift_day = String(pet.last_gift_day || '');
    pet.last_harmony_day = String(pet.last_harmony_day || '');
    pet.last_interact_at = Number(pet.last_interact_at) || 0;

    const t = Array.isArray(pet.traits) ? pet.traits.filter((x) => TRAITS[x]) : [];
    pet.traits = [0, 1, 2].map((k) => t[k] || null);

    // Ensure V2.5 slots[0..1] (with slots[2] = null for backward-compatible 3-length array)
    const rawSlots = Array.isArray(pet.slots) ? pet.slots : [];
    const openCount = openSlotCountForPet(pet);
    const slots = [null, null, null];
    const usedPerks = [];
    for (let sIdx = 0; sIdx < openCount; sIdx++) {
      const norm = normalizeSlot(rawSlots[sIdx]);
      if (norm && (!PERK_LINES[norm.stat] || !usedPerks.includes(norm.stat))) {
        slots[sIdx] = norm;
      } else if (pet.traits[sIdx] && TRAITS[pet.traits[sIdx]] && !usedPerks.includes(pet.traits[sIdx])) {
        const tr = pet.traits[sIdx];
        slots[sIdx] = normalizeSlot({ stat: tr, tier: TRAITS[tr].tier, locked: false });
      } else {
        slots[sIdx] = rollSlot(nLv, Math.random, { excludePerks: usedPerks });
      }
      if (slots[sIdx] && PERK_LINES[slots[sIdx].stat]) {
        usedPerks.push(slots[sIdx].stat);
      }
    }
    const maxLocks = Math.max(0, openCount - 1);
    let lockCount = 0;
    for (let sIdx = 0; sIdx < openCount; sIdx++) {
      if (slots[sIdx]?.locked) {
        if (lockCount < maxLocks) lockCount++;
        else slots[sIdx].locked = false;
      }
    }
    pet.slots = slots;

    // Deduplicate if multiple legacy species mapped to the same canonical V2 species
    const existing = byCanonical.get(canonicalId);
    if (!existing) {
      byCanonical.set(canonicalId, pet);
      migratedPets.push(pet);
    } else {
      if (pet.stars > existing.stars) {
        const prevOpen = openSlotCountForPet(existing);
        existing.stars = pet.stars;
        existing.bond_lv = Math.max(existing.bond_lv || 1, pet.bond_lv || 1, minLevelForStars(existing.stars));
        const nextOpen = openSlotCountForPet(existing);
        for (let sIdx = prevOpen; sIdx < nextOpen; sIdx++) {
          existing.slots[sIdx] = pet.slots[sIdx] || rollSlot(nLv, Math.random);
        }
        existing.visual_tier = pet.stars;
        existing.spent_essence = spentEssenceForStars(pet.stars);
      }
      existing.star_dupes = Math.max(existing.star_dupes, pet.star_dupes);
      existing.essence += 15 * pet.stars + (pet.essence || 0);
    }
  });

  p.pets = migratedPets;
  p.pet_seq = Math.max(p.pet_seq | 0, p.pets.length);
  const eq = p.equipped?.pet;
  if (eq?.id) {
    const normEqId = normalizePetId(eq.id);
    const own = p.pets.find((x) => x.uid === eq.uid) || p.pets.find((x) => x.id === normEqId) || p.pets[0];
    if (own) syncEquippedPet(p, own);
  }
  p.glamour = { outfit: null, hat: null, face: null, gloves: null, boots: null, wings: null, ...(p.glamour || {}) };
  for (const s of SLOTS) {
    if (p.glamour[s] && !p.inventory?.[p.glamour[s]]) p.glamour[s] = null;
  }
  syncGlamourAndAttune(p);
  p.dash_builds_found = Array.isArray(p.dash_builds_found) && p.dash_builds_found.length
    ? Array.from(new Set(['balanced', ...p.dash_builds_found]))
    : ['balanced'];
  p.dash_build_tiers = (p.dash_build_tiers && typeof p.dash_build_tiers === 'object') ? p.dash_build_tiers : {};
  const defaultPresets = [
    { name: '⚡ Speed', equipped: null, glamour: null, build: null },
    { name: '🪙 Farm', equipped: null, glamour: null, build: null },
    { name: '🍀 Chaos', equipped: null, glamour: null, build: null },
  ];
  if (!Array.isArray(p.dash_presets) || p.dash_presets.length !== 3) {
    p.dash_presets = defaultPresets;
  } else {
    p.dash_presets = p.dash_presets.map((pr, idx) => ({
      name: String(pr?.name || defaultPresets[idx].name).slice(0, 18),
      equipped: pr?.equipped || null,
      glamour: pr?.glamour || null,
      build: pr?.build || null,
    }));
  }
  return p;
}

export function syncGlamourAndAttune(p) {
  if (!p?.equipped) return;
  p.glamour = { outfit: null, hat: null, face: null, gloves: null, boots: null, wings: null, ...(p.glamour || {}) };
  p.equipped.glamour = { ...p.glamour };
  for (const s of SLOTS) {
    const eqSlot = p.equipped[s];
    if (!eqSlot?.id) continue;
    const own = p.inventory?.[eqSlot.id];
    if (own?.attune?.stat) eqSlot.attune = { stat: own.attune.stat, count: own.attune.count | 0 };
    else delete eqSlot.attune;
    if (p.glamour[s]) eqSlot.glamour = p.glamour[s];
    else delete eqSlot.glamour;
  }
}

export function checkBuildDiscovery(p, beforeBonus = null) {
  if (!p) return null;
  p.dash_builds_found = Array.isArray(p.dash_builds_found) ? p.dash_builds_found : ['balanced'];
  p.dash_build_tiers = (p.dash_build_tiers && typeof p.dash_build_tiers === 'object') ? p.dash_build_tiers : {};
  const afterBonus = computeUniversalStats(p).bonus;
  const b = detectBuild(afterBonus);
  let newlyFound = false;
  let hybridBonusDiamonds = 0;
  if (!p.dash_builds_found.includes(b.id)) {
    p.dash_builds_found.push(b.id);
    newlyFound = true;
    if (b.kind === 'hybrid') {
      hybridBonusDiamonds = 50;
      p.diamonds = (p.diamonds || 0) + hybridBonusDiamonds;
    }
  }
  let tierUp = false;
  if (b.kind === 'main') {
    const prevTier = p.dash_build_tiers[b.id] | 0;
    if (b.tier > prevTier) {
      if (prevTier > 0 || beforeBonus) tierUp = true;
      p.dash_build_tiers[b.id] = b.tier;
    }
  }
  const diff = beforeBonus ? diffBuilds(beforeBonus, afterBonus) : null;
  return {
    build: b,
    newlyFound,
    hybridBonusDiamonds,
    tierUp: Boolean(tierUp || diff?.tierUp),
    toast: diff?.toast || '',
    diff,
  };
}

const newPetUid = (p) => `pet${(p.pet_seq = (p.pet_seq | 0) + 1)}`;

/** equipped.pet is the CP / renderer mirror of one owned pet. */
function syncEquippedPet(p, pet) {
  p.equipped.pet = pet ? {
    uid: pet.uid,
    id: pet.id,
    stars: pet.stars ?? PETS[pet.id]?.rarity ?? 1,
    visual_tier: pet.visual_tier || pet.stars || 1,
    nickname: pet.nickname || '',
    bond_lv: pet.bond_lv || 1,
    level: pet.level || 1,
    hunger: pet.hunger ?? HUNGER.DEFAULT,
    costume_id: pet.costume_id || null,
    active_poses: normalizeActivePoses(pet.active_poses, pet.bond_lv || 1),
    slots: Array.isArray(pet.slots) ? pet.slots.slice(0, MAX_TRAIT_SLOTS) : [],
  } : null;
}

function resyncIfEquipped(p, pet) {
  if (p.equipped?.pet && (p.equipped.pet.uid === pet.uid || p.equipped.pet.id === pet.id)) {
    syncEquippedPet(p, pet);
  }
}

export function findOwnedPet(p, { petUid, petId } = {}) {
  if (!Array.isArray(p?.pets)) return null;
  if (petUid) {
    const byUid = p.pets.find((x) => x.uid === petUid);
    if (byUid) return byUid;
  }
  if (petId) {
    const norm = normalizePetId(petId);
    const byId = p.pets.find((x) => x.id === norm || x.uid === petId);
    if (byId) return byId;
  }
  if (!petUid && !petId && p.equipped?.pet) {
    return p.pets.find((x) => x.uid === p.equipped.pet.uid || x.id === p.equipped.pet.id) || p.pets[0] || null;
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// Granting items (Gacha / Shard Shop / gifts): new → inventory, dupe → +1 dupe, dupe of a +10 → 🌟
// ---------------------------------------------------------------------------------------------
export function grantItem(p, id, { dupeShards = null } = {}) {
  const def = itemDef(id);
  if (!def) return { id, kind: 'none' };
  const owned = p.inventory[id];
  if (!owned) { p.inventory[id] = { refine: 0, dupes: 0, pity: 0 }; return { id, kind: 'new', rarity: def.rarity }; }
  if ((owned.refine | 0) >= MAX_REFINE) {
    const shards = dupeShards ?? (DUPE_SHARDS[def.rarity] || 0);
    p.shards += shards;
    return { id, kind: 'shards', rarity: def.rarity, shards };
  }
  owned.dupes = (owned.dupes | 0) + 1;
  return { id, kind: 'dupe', rarity: def.rarity, dupes: owned.dupes };
}

function grantWonder(p, id) {
  const v = p.village;
  const w = v.wonders[id];
  if (!w) { v.wonders[id] = { stars: 1 }; return { id, kind: 'new', rarity: WONDERS[id].rarity }; }
  if ((w.stars | 0) < MAX_WONDER_STARS) { w.stars = (w.stars | 0) + 1; return { id, kind: 'star_up', rarity: WONDERS[id].rarity, stars: w.stars }; }
  const shards = WONDER_DUPE_SHARDS[WONDERS[id].rarity] || 0;
  p.shards += shards;
  return { id, kind: 'shards', rarity: WONDERS[id].rarity, shards };
}

/**
 * Pet System V2 grantPet:
 * - New species → hatches at ★1 with Slot 1 rolled (minTier based on egg rarityRoll or guaranteedTrait).
 *   If rarityRoll === 3 (Mythic egg roll), also starts with +25 bonus Essence.
 * - Duplicate species (< ★3) → grants Pet Essence (+10 / +25 / +60 by egg rarityRoll) and increments star_dupes.
 * - Duplicate of a ★3 pet → +100 🌟 Starlight Shards.
 */
export function grantPet(p, rawId, rng = Math.random, { rarityRoll = 1, guaranteedTrait = null, minTierSlot0 = null } = {}) {
  const id = normalizePetId(rawId);
  const rarity = Math.max(1, Math.min(3, Number(rarityRoll) || PETS[id]?.rarity || 1));
  const have = p.pets.find((x) => x.id === id);

  if (have) {
    const stars = have.stars ?? 1;
    if (guaranteedTrait) applyGuaranteedTrait(have, guaranteedTrait);
    if (stars >= PET2.MAX_STARS) {
      p.shards += DUPE_SHARDS[3];
      resyncIfEquipped(p, have);
      return { id, uid: have.uid, rarity, kind: 'shards', shards: DUPE_SHARDS[3], stars, trait: guaranteedTrait };
    }
    const essenceTier = rarity === 3 ? 'epic' : rarity === 2 ? 'rare' : 'common';
    const essenceGained = PET2.DUPE_ESSENCE[essenceTier] || 10;
    have.essence = (have.essence || 0) + essenceGained;
    have.star_dupes = (have.star_dupes | 0) + 1;
    resyncIfEquipped(p, have);
    return {
      id,
      uid: have.uid,
      rarity,
      kind: 'essence',
      essenceGained,
      essence: have.essence,
      evolveNeed: evolveCost(stars),
      stars,
      starDupes: have.star_dupes,
      nextAt: stars >= PET.MAX_STARS ? null : PET.STAR_DUPES[stars + 1],
      trait: guaranteedTrait,
    };
  }

  const minTier = minTierSlot0 || (rarity === 3 ? 'epic' : rarity === 2 ? 'rare' : 'common');
  const slot0 = guaranteedTrait && TRAITS[guaranteedTrait]
    ? normalizeSlot({ stat: guaranteedTrait, tier: TRAITS[guaranteedTrait].tier, locked: false })
    : rollSlot(nestLevel(p), rng, { minTier });

  const pet = {
    uid: newPetUid(p),
    id,
    stars: 1,
    visual_tier: 1,
    essence: rarity === 3 ? 25 : 0,
    spent_essence: 0,
    nickname: '',
    bond_lv: 1,
    bond_xp: 0,
    hunger: HUNGER.DEFAULT,
    costume_id: null,
    last_gift_day: '',
    last_harmony_day: '',
    last_interact_at: 0,
    slots: [slot0, null, null],
    star_dupes: 0,
    level: 1,
    exp: 0,
    mood: PET.MAX_MOOD,
    traits: [guaranteedTrait || (TRAITS[slot0.stat] ? slot0.stat : 'cozy_purr'), null, null],
  };
  p.pets.push(pet);
  return {
    id,
    uid: pet.uid,
    rarity,
    kind: 'new',
    stars: pet.stars,
    slots: pet.slots,
    essence: pet.essence,
    trait: guaranteedTrait || pet.traits[0],
  };
}

/** Couple Egg guarantee lands in Slot 1 unless Slot 1 already holds a Mythic line. */
function applyGuaranteedTrait(pet, trait) {
  if (Array.isArray(pet.traits) && TRAITS[pet.traits[0]]?.tier !== 'mythic') {
    pet.traits[0] = trait;
  }
  if (Array.isArray(pet.slots) && pet.slots[0]?.tier !== 'mythic' && TRAITS[trait]) {
    pet.slots[0] = normalizeSlot({ stat: trait, tier: TRAITS[trait].tier, locked: Boolean(pet.slots[0]?.locked) });
  }
}

// ---------------------------------------------------------------------------------------------
// Gacha
// ---------------------------------------------------------------------------------------------
// Rarity rolling lives in shared/rpg_rules.js → rollBox1Rarities() (Mythic pity + ✦ Super Mythic soft/hard pity).

/** One Box 1 drop for `banner` at `rarity` → catalog id (outfit/accessory/dice or pet). */
function box1Item(banner, rarity, rng, featuredOverride = null) {
  const feat = featuredOverride || banner.featured;
  if (feat && rarity === 3 && rng() < banner.featuredShare) return feat;
  const pool = feat && rarity === 3 ? banner.pool[3].filter((k) => k !== feat) : banner.pool[rarity];
  if (!banner.rateUp) return pick(pool, rng);
  return pickWeighted(pool, (k) => (banner.rateUp.includes(k) ? banner.rateUpWeight : 1), rng);
}

/** gacha_set_featured { outfitId } — chooses any of the 13 Season Mythic Outfits as the player's 50% Rate-Up Wish. */
export function setFeaturedOutfit(p, { outfitId } = {}) {
  if (!SEASON_OUTFITS.includes(outfitId)) return fail('bad_outfit');
  p.gacha = p.gacha || {};
  p.gacha.featured_outfit = outfitId;
  return { ok: true, featuredOutfit: outfitId };
}

function payGacha(p, box, count, currency) {
  const B = box === 1 ? BOX1 : BOX2;
  if (currency === 'ticket') {
    if ((p.bag_items[B.TICKET] | 0) < count) return fail('not_enough_tickets', { need: count });
    p.bag_items[B.TICKET] -= count;
    return { ok: true, paid: { [B.TICKET]: count } };
  }
  if (box === 1) {
    if (currency !== 'diamonds') return fail('bad_currency');
    const cost = count === 10 ? BOX1.COST_10 : BOX1.COST_1;
    if (p.diamonds < cost) return fail('not_enough_diamonds', { cost });
    p.diamonds -= cost;
    return { ok: true, paid: { diamonds: cost } };
  }
  if (currency === 'berries') {
    if (count !== 10) return fail('berries_10x_only');
    if (p.berries < BOX2.COST_10_BERRIES) return fail('not_enough_berries', { cost: BOX2.COST_10_BERRIES });
    p.berries -= BOX2.COST_10_BERRIES;
    return { ok: true, paid: { berries: BOX2.COST_10_BERRIES } };
  }
  if (currency !== 'gold') return fail('bad_currency');
  const cost = count === 10 ? BOX2.COST_10 : BOX2.COST_1;
  if (p.gold < cost) return fail('not_enough_gold', { cost });
  p.gold -= cost;
  return { ok: true, paid: { gold: cost } };
}

/** gacha_pull { box: 1|2, count: 1|10, currency: 'diamonds'|'gold'|'berries'|'ticket', banner?: 'season'|'relics'|'dice'|'pets' (Box 1), featuredOutfit?: string } */
export function gachaPull(p, { box, count, currency, banner, featuredOutfit }, rng = Math.random) {
  box = Number(box); count = Number(count);
  if (box !== 1 && box !== 2) return fail('bad_box');
  if (count !== 1 && count !== 10) return fail('bad_count');
  const bannerId = box === 1 ? String(banner || DEFAULT_BANNER) : null;
  const BN = box === 1 ? BOX1_BANNERS[bannerId] : null;
  if (box === 1 && !BN) return fail('bad_banner');
  if (box === 1 && featuredOutfit !== undefined && !SEASON_OUTFITS.includes(featuredOutfit)) return fail('bad_outfit');
  if (box === 1 && featuredOutfit && SEASON_OUTFITS.includes(featuredOutfit)) {
    p.gacha = p.gacha || {};
    p.gacha.featured_outfit = featuredOutfit;
  }
  const activeFeatured = box === 1 && BN.featured
    ? (SEASON_OUTFITS.includes(featuredOutfit) ? featuredOutfit : SEASON_OUTFITS.includes(p.gacha?.featured_outfit) ? p.gacha.featured_outfit : BN.featured)
    : null;
  const paid = payGacha(p, box, count, String(currency || ''));
  if (!paid.ok) return paid;
  const res = rollAndGrant(p, { box, BN, bannerId, count, activeFeatured }, rng);
  return { ...res, paid: paid.paid };
}

/** Rolls + grants `count` pulls into `p` (no payment). Shared by gacha_pull and gacha_gift_open. */
function rollAndGrant(p, { box, BN, bannerId, count, activeFeatured }, rng) {
  p.gacha = p.gacha || {};
  const B = box === 1 ? BOX1 : BOX2;
  const pityKey = box === 1 ? BN.pityKey : 'box2_pity';
  const rates = box === 1 ? BN.rates : B.RATES;
  const smOn = box === 1 && !!BN.superMythic && superMythicEnabled();
  const smKey = SUPER_MYTHIC.PITY_KEY;

  // roll rarities first so the 10x Epic+ guarantee, the 40-pull pity and the ✦ Super Mythic pity can adjust them
  const roll = rollBox1Rarities({
    count, rates, pity: p.gacha[pityKey] | 0, smPity: p.gacha[smKey] | 0, superMythic: smOn,
    pityMax: B.PITY, tenPullMin: box === 1 ? BOX1.TEN_PULL_MIN_RARITY : null,
  }, rng);
  const { rarities, pityHit } = roll;
  p.gacha[pityKey] = roll.pity;
  if (smOn) p.gacha[smKey] = roll.smPity;

  const items = [];
  let shardsGained = 0;
  for (const r of rarities) {
    let out;
    if (box === 1 && r === SUPER_MYTHIC.RARITY) {
      const id = pick(SUPER_MYTHIC_POOL, rng);
      out = { ...grantItem(p, id, { dupeShards: SUPER_MYTHIC.DUPE_SHARDS }), rarity: SUPER_MYTHIC.RARITY, rarityKey: SUPER_MYTHIC.KEY, superMythic: true };
    } else if (box === 1) {
      const id = box1Item(BN, r, rng, activeFeatured);
      out = BN.kind === 'pet' ? { ...grantPet(p, id, rng, { rarityRoll: r }), pet: true } : grantItem(p, id);
    }
    else if (r === 1) {
      if (rng() < BOX2.COMMON_BLUEPRINT_SHARE) {
        const type = pick(BOX2_POOL.blueprints, rng);
        p.village.blueprints[type] = (p.village.blueprints[type] | 0) + 1;
        out = { id: `bp_${type}`, kind: 'blueprint', target: type, rarity: 1, count: p.village.blueprints[type] };
      } else {
        const id = pick(BOX2_POOL.decor, rng);
        p.village.decor[id] = (p.village.decor[id] | 0) + 1;
        out = { id, kind: 'decor', rarity: 1, count: p.village.decor[id] };
      }
    } else {
      // Stage 5 (§14): Wonders are Monuments now — built from materials in the Base Camp, never rolled.
      // The Epic / Mythic Royal Architect tiers pay Starlight Shards instead (Stage 7 removes Box 2).
      const shards = WONDER_DUPE_SHARDS[r] || 0;
      p.shards += shards;
      out = { id: `shards_${r}`, kind: 'shards', rarity: r, shards };
    }
    shardsGained += out.shards || 0;
    items.push(out);
  }
  refreshDerived(p);
  const smHit = items.some((x) => x.superMythic);
  return {
    ok: true, box, banner: bannerId, featuredOutfit: activeFeatured, count, items, shardsGained,
    pity: p.gacha[pityKey], pityMax: B.PITY, pityHit, changed: box === 2,
    superMythicOn: smOn, smPity: p.gacha[smKey] | 0, smPityMax: SUPER_MYTHIC.HARD_PITY, smHit, smPityHit: roll.smPityHit,
  };
}

// ---------------------------------------------------------------------------------------------
// 🎁 Gift a Pull (Dopamine Patch 1C) — sender pays from THEIR diamonds / 🎟️; only to the bound partner.
// The pull is rolled when the recipient OPENS it (their pity, their featured wish), never at send time.
// ---------------------------------------------------------------------------------------------
export const isBoundPair = (a, b) => !!(a && b && a.id !== b.id && a.partner_id === b.id && b.partner_id === a.id);
const cleanGiftMessage = (s) => String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, GIFT_PULL.MAX_MESSAGE);

/** gacha_gift_send { count: 1|10, currency: 'diamonds'|'ticket', message? } */
export function gachaGiftSend(sender, recipient, { count, currency, message } = {}, now = Date.now()) {
  if (!isBoundPair(sender, recipient)) return fail('not_partner');
  count = Number(count);
  if (!GIFT_PULL.COUNTS.includes(count)) return fail('bad_count');
  currency = String(currency || '');
  if (!GIFT_PULL.CURRENCIES.includes(currency)) return fail('bad_currency');
  recipient.gacha = recipient.gacha || {};
  const pending = Array.isArray(recipient.gacha.gifts_pending) ? recipient.gacha.gifts_pending : (recipient.gacha.gifts_pending = []);
  if (pending.length >= GIFT_PULL.MAX_PENDING) return fail('gift_box_full');
  sender.bag_items = sender.bag_items || {};
  const paid = payGacha(sender, 1, count, currency);
  if (!paid.ok) return paid;
  const gift = {
    id: `g${now.toString(36)}${(pending.length + 1).toString(36)}${Math.floor((now % 997) * 7).toString(36)}`,
    from: sender.id, fromName: sender.username || sender.id, count, message: cleanGiftMessage(message), at: now,
  };
  pending.push(gift);
  return { ok: true, gift, paid: paid.paid, to: recipient.id };
}

/** gacha_gift_open { giftId } — `sender` may be null (offline / unbound later); the badge then waits for nobody. */
export function gachaGiftOpen(p, sender, { giftId } = {}, rng = Math.random) {
  const pending = p.gacha?.gifts_pending || [];
  const idx = pending.findIndex((g) => g.id === String(giftId || ''));
  if (idx < 0) return fail('no_gift');
  const [gift] = pending.splice(idx, 1);
  const BN = BOX1_BANNERS[GIFT_PULL.BANNER];
  const activeFeatured = SEASON_OUTFITS.includes(p.gacha?.featured_outfit) ? p.gacha.featured_outfit : BN.featured;
  const res = rollAndGrant(p, { box: 1, BN, bannerId: GIFT_PULL.BANNER, count: gift.count, activeFeatured }, rng);
  let luckyCharm = false;
  if (res.smHit && sender && sender.id === gift.from) {
    sender.badges = Array.isArray(sender.badges) ? sender.badges : [];
    if (!sender.badges.includes(GIFT_PULL.BADGE)) { sender.badges.push(GIFT_PULL.BADGE); luckyCharm = true; }
  }
  return { ...res, gift: { id: gift.id, from: gift.from, fromName: gift.fromName, message: gift.message, count: gift.count }, luckyCharm, paid: null };
}

// ---------------------------------------------------------------------------------------------
// Shard Exchange (0% RNG)
// ---------------------------------------------------------------------------------------------
/** shard_exchange { offerId, pickId? } */
export function shardExchange(p, { offerId, pickId }, rng = Math.random) {
  const offer = SHARD_OFFERS[offerId];
  if (!offer) return fail('bad_offer');
  if (offer.pick === 'wonder') return fail('monuments_are_built');   // Stage 5: Wonders → Monuments (Base Camp)
  if (offer.pick === 'outfit' && !SEASON_OUTFITS.includes(pickId)) return fail('bad_pick');
  if (offer.pick === 'wonder' && !VIP_WONDERS.includes(pickId)) return fail('bad_pick');
  if (offer.pick === 'dice' && !MYTHIC_DICE.includes(pickId)) return fail('bad_pick');
  if (offer.pick === 'accessory' && !ACCESSORIES[pickId] && !DICE_SKINS[pickId]) return fail('bad_pick');
  if (p.shards < offer.cost) return fail('not_enough_shards', { cost: offer.cost });
  p.shards -= offer.cost;
  let out;
  if (offer.item) out = grantItem(p, offer.item);
  else if (offer.pet) out = grantPet(p, offer.pet, rng, { rarityRoll: 3 });
  else if (offer.bag) { p.bag_items[offer.bag] = (p.bag_items[offer.bag] | 0) + 1; out = { id: offer.bag, kind: 'bag' }; }
  else if (offer.pick === 'wonder') out = grantWonder(p, pickId);
  else out = grantItem(p, pickId);
  refreshDerived(p);
  return { ok: true, offerId, cost: offer.cost, result: out, changed: offer.pick === 'wonder' };
}

// ---------------------------------------------------------------------------------------------
// +10 Star-Force Forge
// ---------------------------------------------------------------------------------------------
export function blacksmithForge(p, { itemId, useBerries, useScroll, useIngots }, now, rng = Math.random) {
  const it = p.inventory[itemId];
  if (!it || !itemDef(itemId)) return fail('not_owned');
  const from = it.refine | 0;
  if (from >= MAX_REFINE) return fail('max_refine');
  const target = from + 1;
  const gold = FORGE.GOLD[target], dupes = FORGE.DUPES[target];
  const berries = useBerries ? FORGE.BERRY_COST : 0;
  const scrolls = useScroll ? 1 : 0;
  const ingots = useIngots ? Math.max(1, Math.ceil(target / 2)) : 0;
  if (scrolls && !scrollAllowed(from)) return fail('scroll_not_allowed', { minTarget: FORGE.SCROLL_MIN_TARGET });
  if (p.gold < gold) return fail('not_enough_gold', { cost: gold });
  if ((it.dupes | 0) < dupes) return fail('not_enough_dupes', { need: dupes, have: it.dupes | 0 });
  if (p.berries < berries) return fail('not_enough_berries', { cost: berries });
  if ((p.bag_items?.[FORGE.SCROLL_ITEM] | 0) < scrolls) return fail('not_enough_scrolls');
  const whItems = p.frontier?.warehouse?.items;
  if (ingots && ((whItems?.ingot | 0) < ingots)) return fail('not_enough_ingots', { need: ingots, have: whItems?.ingot | 0 });
  const beforeBonus = computeUniversalStats(p).bonus;
  const onsenPct = p.buffs?.blacksmith && p.buffs.blacksmith.until > now ? p.buffs.blacksmith.pct | 0 : 0;
  const ingotPct = ingots ? 12 : 0;
  const chance = Math.min(100, forgeChance(from, { useBerries: !!useBerries, useScroll: !!scrolls, onsenPct: onsenPct + ingotPct, pityFails: it.pity }));
  p.gold -= gold; p.berries -= berries; it.dupes = (it.dupes | 0) - dupes;
  if (scrolls) p.bag_items[FORGE.SCROLL_ITEM] -= scrolls;
  if (ingots && whItems) { whItems.ingot -= ingots; if (whItems.ingot <= 0) delete whItems.ingot; }
  const success = rng() * 100 < chance;
  let sovereign = false;
  if (success) {
    it.refine = target; it.pity = 0;
    for (const s of [...SLOTS, 'dice']) if (p.equipped[s]?.id === itemId) p.equipped[s].refine = target;
    if (target === MAX_REFINE) { p.title = FORGE.SOVEREIGN_TITLE; sovereign = true; }
  } else {
    it.pity = Math.min(FORGE.PITY_FAILS_GUARANTEE, (it.pity | 0) + (scrolls ? FORGE.SCROLL_PITY_FAILS : 1));
  }
  syncGlamourAndAttune(p);
  refreshDerived(p);
  const buildUpdate = success ? checkBuildDiscovery(p, beforeBonus) : null;
  return {
    ok: true, itemId, success, newStar: it.refine, chance, pity: it.pity, pityPct: it.pity * FORGE.PITY_PER_FAIL,
    spent: { gold, berries, dupes, scrolls, ...(ingots ? { ingots } : {}) }, onsenPct, ...(ingots ? { ingotPct } : {}), sovereign, buildUpdate,
  };
}

/**
 * gear_attune { itemId, stat, useScroll? } — 🎯 Gear Attunement (GEAR_ATTUNEMENT_GLAMOUR.md §1).
 * Unlocks at +5; redirects the item's secondary stat line to `stat` (1st attune is FREE).
 */
export function gearAttune(p, { itemId, stat, useScroll = false } = {}) {
  migrateRpg(p);
  const own = p.inventory?.[itemId];
  if (!own || !itemDef(itemId)) return fail('not_owned');
  const curAttune = own.attune?.stat || null;
  const info = inspectItemAttune(itemId, own.refine | 0, curAttune);
  if (!info.attunable) return fail(info.reason || 'not_attunable');
  if (!info.unlocked) return fail('refine_too_low', { minRefine: 5, have: own.refine | 0 });
  if (!stat || !STAT_KEYS.includes(stat) || !info.allowedStats.includes(stat)) return fail('invalid_stat');
  if (stat === info.activeSecStat) return fail('same_stat');

  const count = own.attune?.count | 0;
  const cost = attuneCostFor(count);
  const hasScroll = useScroll && (p.bag_items?.attune_scroll | 0) > 0;
  const spent = { gold: 0, berries: 0, scroll: 0 };
  if (hasScroll) {
    p.bag_items.attune_scroll -= 1;
    spent.scroll = 1;
  } else if (!cost.free) {
    if ((p.gold || 0) < cost.gold) return fail('not_enough_gold', { cost: cost.gold });
    if ((p.berries || 0) < cost.berries) return fail('not_enough_berries', { cost: cost.berries });
    p.gold -= cost.gold;
    p.berries -= cost.berries;
    spent.gold = cost.gold;
    spent.berries = cost.berries;
  }

  const beforeBonus = computeUniversalStats(p).bonus;
  own.attune = {
    stat: stat === info.defaultSecStat ? null : stat,
    count: count + 1,
  };
  syncGlamourAndAttune(p);
  refreshDerived(p);
  const buildUpdate = checkBuildDiscovery(p, beforeBonus);
  return {
    ok: true,
    itemId,
    slot: info.slot,
    stat,
    attune: own.attune,
    spent,
    cp: p.cp,
    buildUpdate,
  };
}

// ---------------------------------------------------------------------------------------------
// Wardrobe (6 slots + dice + pet) & 👗 Glamour + 🎒 Loadout Presets
// ---------------------------------------------------------------------------------------------
export function charmEquip(p, { charmId, charmUid } = {}) {
  migrateRpg(p);
  const beforeBonus = computeUniversalStats(p).bonus;
  const targetKey = charmUid || charmId;
  if (!targetKey) {
    p.equipped.charm = null;
    if (p.village) refreshDerived(p);
    else p.cp = recalcPlayerCP(p);
    const buildUpdate = checkBuildDiscovery(p, beforeBonus);
    return { ok: true, slot: 'charm', itemId: null, charm: null, equipped: p.equipped, cp: p.cp, buildUpdate };
  }
  const owned = findBestCharmForId(p.charms || [], targetKey);
  const cDef = owned ? CHARMS[owned.id] : CHARMS[targetKey];
  if (!cDef || !owned) return fail('not_owned');
  const plus = getCharmPlus(owned);
  p.equipped.charm = {
    uid: owned.uid,
    id: cDef.id,
    tier: cDef.tier,
    auraKind: cDef.auraKind,
    grade: owned.grade || 'B',
    plus,
    level: plus + 1,
    stats: { ...(owned.stats || {}) },
  };
  if (p.village) refreshDerived(p);
  else p.cp = recalcPlayerCP(p);
  const buildUpdate = checkBuildDiscovery(p, beforeBonus);
  return { ok: true, slot: 'charm', itemId: cDef.id, charmUid: owned.uid, charm: p.equipped.charm, equipped: p.equipped, cp: p.cp, buildUpdate };
}

/**
 * charm_consume { baseUid, materialUid, mode?: 'upgrade' | 'infuse' }
 * Consumes a duplicate Charm (`materialUid`) into `baseUid` (`+0` -> `+5` MAX with full `+` level transfer & optional stat infusion).
 */
export function charmConsume(p, { baseUid, materialUid, mode = 'upgrade' } = {}) {
  migrateRpg(p);
  const beforeBonus = computeUniversalStats(p).bonus;
  const res = consumeCharmInBag(p, { baseUid, materialUid, mode });
  if (!res.ok) return fail(res.error || 'consume_failed');
  if (p.village) refreshDerived(p);
  else p.cp = recalcPlayerCP(p);
  const buildUpdate = checkBuildDiscovery(p, beforeBonus);
  return {
    ...res,
    charms: p.charms,
    equipped: p.equipped,
    cp: p.cp,
    buildUpdate,
  };
}

/**
 * charm_salvage { charmUid }
 * Dismantles an unequipped, unlocked spare Charm into Starlight Shards (`🌟`) & Gold (`🪙`).
 */
export function charmSalvage(p, { charmUid } = {}) {
  migrateRpg(p);
  const res = salvageCharmInBag(p, { charmUid });
  if (!res.ok) return fail(res.error || 'salvage_failed');
  return {
    ...res,
    charms: p.charms,
    currencies: p.currencies,
    gold: p.currencies?.gold ?? p.gold,
    shards: p.gacha_shards,
  };
}

/**
 * charm_lock { charmUid }
 * Toggles lock protection (`🔒`) on a Charm roll in `p.charms`.
 */
export function charmLock(p, { charmUid } = {}) {
  migrateRpg(p);
  const res = toggleCharmLockInBag(p, { charmUid });
  if (!res.ok) return fail(res.error || 'lock_failed');
  return {
    ...res,
    charms: p.charms,
  };
}

/** wardrobe_equip { slot, itemId|null, hide? } — slot 'pet' takes a pet uid or canonical petId; 'dice' equips a 3D Dice Skin; 'charm' equips a Starlight Aura Charm. */
export function wardrobeEquip(p, { slot, itemId, hide }) {
  migrateRpg(p);
  if (slot === 'charm') {
    return charmEquip(p, { charmId: itemId });
  }
  const beforeBonus = computeUniversalStats(p).bonus;
  if (slot === 'pet') {
    if (itemId == null) {
      p.equipped.pet = null;
      refreshDerived(p);
      const buildUpdate = checkBuildDiscovery(p, beforeBonus);
      return { ok: true, slot, itemId: null, cp: p.cp, buildUpdate };
    }
    const pet = findOwnedPet(p, { petUid: itemId, petId: itemId });
    if (!pet) return fail('not_owned');
    syncEquippedPet(p, pet);
    refreshDerived(p);
    const buildUpdate = checkBuildDiscovery(p, beforeBonus);
    return { ok: true, slot, itemId: pet.uid, petId: pet.id, cp: p.cp, buildUpdate };
  }
  if (!SLOTS.includes(slot) && slot !== 'dice') return fail('bad_slot');
  const cur = p.equipped[slot];
  if (itemId === undefined && typeof hide === 'boolean') {
    if (!cur) return fail('slot_empty');
    cur.hide = hide;
    return { ok: true, slot, itemId: cur.id, hide, cp: p.cp };
  }
  if (itemId == null) {
    if (slot === 'outfit') return fail('outfit_required');
    p.equipped[slot] = null;
    syncGlamourAndAttune(p);
    refreshDerived(p);
    const buildUpdate = checkBuildDiscovery(p, beforeBonus);
    return { ok: true, slot, itemId: null, cp: p.cp, buildUpdate };
  }
  const own = p.inventory[itemId];
  if (!own) return fail('not_owned');
  if (itemSlot(itemId) !== slot) return fail('wrong_slot');
  p.equipped[slot] = {
    id: itemId,
    refine: own.refine | 0,
    ...(own.attune?.stat ? { attune: { stat: own.attune.stat, count: own.attune.count | 0 } } : {}),
    ...(p.glamour?.[slot] ? { glamour: p.glamour[slot] } : {}),
    ...(hide ? { hide: true } : {}),
  };
  syncGlamourAndAttune(p);
  refreshDerived(p);
  const buildUpdate = checkBuildDiscovery(p, beforeBonus);
  return { ok: true, slot, itemId, hide: !!hide, cp: p.cp, buildUpdate };
}

/**
 * wardrobe_glamour { slot, itemId|null } — 👗 Glamour look override (GEAR_ATTUNEMENT_GLAMOUR.md §2).
 * Free, unlimited swaps among any owned item for that slot. Zero stat effect.
 */
export function wardrobeGlamour(p, { slot, itemId } = {}) {
  migrateRpg(p);
  if (!SLOTS.includes(slot)) return fail('bad_slot');
  if (!itemId) {
    p.glamour[slot] = null;
    syncGlamourAndAttune(p);
    return { ok: true, slot, itemId: null, glamour: { ...p.glamour } };
  }
  if (!p.inventory?.[itemId]) return fail('not_owned');
  if (itemSlot(itemId) !== slot) return fail('wrong_slot');
  p.glamour[slot] = itemId;
  syncGlamourAndAttune(p);
  return { ok: true, slot, itemId, glamour: { ...p.glamour } };
}

/**
 * dash_preset_save { slotIdx, name? } — saves current equipped gear + pet + glamour into one of 3 Loadout Presets.
 */
export function dashPresetSave(p, { slotIdx, name } = {}) {
  migrateRpg(p);
  const idx = Number(slotIdx);
  if (!Number.isInteger(idx) || idx < 0 || idx > 2) return fail('bad_preset_slot');
  const eqSnap = {};
  for (const s of [...SLOTS, 'dice']) {
    if (p.equipped?.[s]?.id) eqSnap[s] = { id: p.equipped[s].id, hide: !!p.equipped[s].hide };
  }
  if (p.equipped?.pet?.id) {
    eqSnap.pet = { uid: p.equipped.pet.uid || null, id: p.equipped.pet.id };
  }
  if (p.equipped?.charm?.id) {
    eqSnap.charm = { id: p.equipped.charm.id, uid: p.equipped.charm.uid || null };
  }
  const b = detectBuild(computeUniversalStats(p).bonus);
  const curName = name != null ? String(name).trim().slice(0, 18) : p.dash_presets[idx]?.name;
  p.dash_presets[idx] = {
    name: curName || ['⚡ Speed', '🪙 Farm', '🍀 Chaos'][idx],
    equipped: eqSnap,
    glamour: { ...(p.glamour || {}) },
    build: { kind: b.kind, id: b.id, name: b.name, icon: b.icon, tier: b.tier },
  };
  return { ok: true, slotIdx: idx, preset: p.dash_presets[idx], presets: p.dash_presets };
}

/**
 * dash_preset_equip { slotIdx } — one-tap swap to a saved Loadout Preset (stats + glamour together).
 */
export function dashPresetEquip(p, { slotIdx } = {}) {
  migrateRpg(p);
  const idx = Number(slotIdx);
  if (!Number.isInteger(idx) || idx < 0 || idx > 2) return fail('bad_preset_slot');
  const preset = p.dash_presets?.[idx];
  if (!preset || !preset.equipped) return fail('preset_empty');
  const beforeBonus = computeUniversalStats(p).bonus;
  for (const s of [...SLOTS, 'dice']) {
    const saved = preset.equipped[s];
    if (!saved?.id) {
      if (s !== 'outfit') p.equipped[s] = null;
      continue;
    }
    const own = p.inventory?.[saved.id];
    if (!own || itemSlot(saved.id) !== s) continue;
    p.equipped[s] = {
      id: saved.id,
      refine: own.refine | 0,
      ...(own.attune?.stat ? { attune: { stat: own.attune.stat, count: own.attune.count | 0 } } : {}),
      ...(saved.hide ? { hide: true } : {}),
    };
  }
  if (preset.equipped.pet) {
    const pet = findOwnedPet(p, { petUid: preset.equipped.pet.uid, petId: preset.equipped.pet.id });
    if (pet) syncEquippedPet(p, pet);
  } else {
    p.equipped.pet = null;
  }
  if (preset.equipped.charm?.id) {
    const cDef = CHARMS[preset.equipped.charm.id];
    const ownedC = findBestCharmForId(p.charms, preset.equipped.charm.uid || preset.equipped.charm.id);
    if (cDef && ownedC) {
      const plus = getCharmPlus(ownedC);
      const gr = ownedC.grade || 'B';
      p.equipped.charm = {
        uid: ownedC.uid,
        id: cDef.id,
        tier: cDef.tier,
        auraKind: cDef.auraKind,
        grade: gr,
        plus,
        level: plus + 1,
        stats: { ...(ownedC.stats || {}) },
      };
    }
  }
  if (preset.glamour && typeof preset.glamour === 'object') {
    for (const s of SLOTS) {
      const gId = preset.glamour[s];
      p.glamour[s] = (gId && p.inventory?.[gId] && itemSlot(gId) === s) ? gId : null;
    }
  }
  syncGlamourAndAttune(p);
  refreshDerived(p);
  const buildUpdate = checkBuildDiscovery(p, beforeBonus);
  preset.build = buildUpdate?.build
    ? { kind: buildUpdate.build.kind, id: buildUpdate.build.id, name: buildUpdate.build.name, icon: buildUpdate.build.icon, tier: buildUpdate.build.tier }
    : preset.build;
  return { ok: true, slotIdx: idx, preset, presets: p.dash_presets, cp: p.cp, buildUpdate };
}

// ---------------------------------------------------------------------------------------------
// Pet Sanctuary V2 ("Soul-Bond Companions")
// ---------------------------------------------------------------------------------------------

/**
 * pet_evolve { petUid?, petId? }
 * Evolves ★1 → ★2 (40 Essence, Lv.10 + Slot 2) or ★2 → ★3 (120 Essence, Lv.20 Radiant Form).
 */
export function petEvolve(p, { petUid, petId } = {}, rng = Math.random) {
  const pet = findOwnedPet(p, { petUid, petId });
  if (!pet) return fail('not_owned');
  const stars = pet.stars || 1;
  if (stars >= PET2.MAX_STARS) return fail('max_stars');
  const cost = evolveCost(stars);
  if ((pet.essence || 0) < cost) {
    return fail('not_enough_essence', { need: cost, have: pet.essence || 0 });
  }
  const beforeBonus = computeUniversalStats(p).bonus;
  pet.essence -= cost;
  pet.spent_essence = (pet.spent_essence || 0) + cost;
  pet.stars = stars + 1;
  pet.visual_tier = pet.stars;
  const prevLv = pet.bond_lv || 1;
  pet.bond_lv = Math.max(prevLv, minLevelForStars(pet.stars));
  if (Array.isArray(pet.active_poses) && pet.bond_lv > prevLv) {
    const prevUnlocked = unlockedSelectablePosesForLevel(prevLv);
    const nowUnlocked = unlockedSelectablePosesForLevel(pet.bond_lv);
    const cur = new Set(pet.active_poses);
    for (const pPose of nowUnlocked) {
      if (!prevUnlocked.includes(pPose)) cur.add(pPose);
    }
    pet.active_poses = normalizeActivePoses(Array.from(cur), pet.bond_lv);
  }

  if (!Array.isArray(pet.slots)) pet.slots = [null, null, null];
  let newSlotIdx = null;
  if (pet.stars === 2 || !pet.slots[1]) {
    const usedPerks = pet.slots.slice(0, MAX_TRAIT_SLOTS).filter((s) => s && PERK_LINES[s.stat]).map((s) => s.stat);
    newSlotIdx = 1;
    pet.slots[1] = pet.slots[1] || rollSlot(nestLevel(p), rng, { excludePerks: usedPerks });
  }
  pet.slots[2] = null;

  addBondXp(pet, 15, rng, nestLevel(p));
  syncTraitsMirror(pet);
  resyncIfEquipped(p, pet);
  refreshDerived(p);
  const buildUpdate = checkBuildDiscovery(p, beforeBonus);
  return {
    ok: true,
    petUid: pet.uid,
    petId: pet.id,
    stars: pet.stars,
    visual_tier: pet.visual_tier,
    essence: pet.essence,
    spent_essence: pet.spent_essence,
    newSlotIdx,
    newSlot: newSlotIdx != null ? pet.slots[newSlotIdx] : null,
    slots: pet.slots,
    bond_lv: pet.bond_lv,
    bond_xp: pet.bond_xp,
    active_poses: pet.active_poses,
    cp: p.cp,
    buildUpdate,
  };
}

/**
 * pet_lock_slot { petUid?, petId?, slotIdx, locked? }
 * Toggles lock on an open slot (cannot lock all open slots; maxLocks = openCount - 1).
 */
export function petLockSlot(p, { petUid, petId, slotIdx, locked } = {}) {
  const pet = findOwnedPet(p, { petUid, petId });
  if (!pet) return fail('not_owned');
  const idx = Number(slotIdx);
  const openCount = openSlotCountForPet(pet);
  if (!Number.isInteger(idx) || idx < 0 || idx >= openCount) return fail('slot_not_open');
  if (!Array.isArray(pet.slots) || !pet.slots[idx]) return fail('slot_empty');

  const maxLocks = Math.max(0, openCount - 1);
  // Clamp any legacy excess locks on other slots first
  let otherLocks = 0;
  for (let i = 0; i < openCount; i++) {
    if (i === idx) continue;
    if (pet.slots[i]?.locked) {
      if (otherLocks < maxLocks) otherLocks++;
      else pet.slots[i].locked = false;
    }
  }

  const nextLocked = typeof locked === 'boolean' ? locked : !pet.slots[idx].locked;
  if (nextLocked) {
    if (otherLocks + 1 >= openCount) return fail('cannot_lock_all_slots', { maxLocks });
  }
  pet.slots[idx].locked = nextLocked;
  resyncIfEquipped(p, pet);
  return { ok: true, petUid: pet.uid, petId: pet.id, slotIdx: idx, locked: nextLocked, slots: pet.slots };
}

/**
 * pet_reroll { petUid?, petId?, locks?, confirmMythicWipe? }
 * Rerolls all open, unlocked stat slots on the pet (up to MAX_TRAIT_SLOTS = 2).
 * Pricing: 0 locks = 1,500 🪙 + 60 🍓, 1 lock = 3,500 🪙 + 150 🍓.
 * Couple Harmony: if partner/friend is online in the same instance today, guarantees Epic+ on first unlocked slot + +20 Essence + +20 Bond XP.
 */
export function petReroll(p, { petUid, petId, locks, confirmMythicWipe } = {}, now = Date.now(), rng = Math.random, { partnerOnline = false } = {}) {
  const pet = findOwnedPet(p, { petUid, petId });
  if (!pet) return fail('not_owned');
  const openCount = openSlotCountForPet(pet);
  if (!Array.isArray(pet.slots)) pet.slots = [rollSlot(nestLevel(p), rng), null, null];
  pet.slots[2] = null;

  if (Array.isArray(locks)) {
    for (let i = 0; i < openCount; i++) {
      if (pet.slots[i]) pet.slots[i].locked = Boolean(locks[i]);
    }
  }

  let lockCount = 0;
  for (let i = 0; i < openCount; i++) {
    if (pet.slots[i]?.locked) lockCount++;
  }
  if (lockCount >= openCount) {
    return fail('cannot_lock_all_slots', { maxLocks: openCount - 1 });
  }

  // Mythic overwrite protection
  if (!confirmMythicWipe) {
    for (let i = 0; i < openCount; i++) {
      if (pet.slots[i] && !pet.slots[i].locked && pet.slots[i].tier === 'mythic') {
        return fail('mythic_unlocked', { slotIdx: i, stat: pet.slots[i].stat });
      }
    }
  }

  const cost = rerollCost(lockCount);
  if (p.gold < cost.gold) return fail('not_enough_gold', { cost: cost.gold });
  if (p.berries < cost.berries) return fail('not_enough_berries', { cost: cost.berries });
  const beforeBonus = computeUniversalStats(p).bonus;
  p.gold -= cost.gold;
  p.berries -= cost.berries;

  // Couple Harmony daily bonus when partner/friend is online together
  const day = String(utcDay(now));
  let harmonyTriggered = false;
  if (partnerOnline && pet.last_harmony_day !== day) {
    harmonyTriggered = true;
    pet.last_harmony_day = day;
    pet.essence = (pet.essence || 0) + PET2.COUPLE_HARMONY_ESSENCE;
    addBondXp(pet, PET2.COUPLE_HARMONY_BOND_XP, rng, nestLevel(p));
  }

  const usedPerks = [];
  for (let i = 0; i < openCount; i++) {
    if (pet.slots[i]?.locked && PERK_LINES[pet.slots[i].stat]) {
      usedPerks.push(pet.slots[i].stat);
    }
  }

  let guaranteedApplied = false;
  for (let i = 0; i < openCount; i++) {
    if (pet.slots[i]?.locked) continue;
    const minTier = harmonyTriggered && !guaranteedApplied ? 'epic' : null;
    pet.slots[i] = rollSlot(nestLevel(p), rng, { minTier, excludePerks: usedPerks });
    guaranteedApplied = true;
    if (PERK_LINES[pet.slots[i].stat]) usedPerks.push(pet.slots[i].stat);
  }

  addBondXp(pet, PET2.REROLL_BOND_XP, rng, nestLevel(p));
  syncTraitsMirror(pet);
  resyncIfEquipped(p, pet);
  refreshDerived(p);
  const buildUpdate = checkBuildDiscovery(p, beforeBonus);

  return {
    ok: true,
    petUid: pet.uid,
    petId: pet.id,
    slots: pet.slots,
    lockCount,
    cost,
    harmonyTriggered,
    essence: pet.essence,
    stars: pet.stars,
    visual_tier: pet.visual_tier,
    bond_lv: pet.bond_lv,
    bond_xp: pet.bond_xp,
    active_poses: pet.active_poses,
    buildUpdate,
  };
}

/**
 * pet_infuse { petUid?, petId?, amount? }
 * Infuses universal `p.star_essence` into the target pet's `essence`.
 */
export function petInfuse(p, { petUid, petId, amount } = {}) {
  const pet = findOwnedPet(p, { petUid, petId });
  if (!pet) return fail('not_owned');
  const pool = p.star_essence | 0;
  if (pool <= 0) return fail('no_star_essence');
  const need = evolveCost(pet.stars || 1) ? Math.max(1, evolveCost(pet.stars || 1) - (pet.essence || 0)) : pool;
  const req = amount ? Math.max(1, Math.floor(Number(amount))) : need;
  const transfer = Math.min(pool, req);
  p.star_essence -= transfer;
  pet.essence = (pet.essence || 0) + transfer;
  return {
    ok: true,
    petUid: pet.uid,
    petId: pet.id,
    amount: transfer,
    essence: pet.essence,
    star_essence: p.star_essence,
  };
}

/**
 * pet_release { petUid?, petId? }
 * Releases an unwanted non-equipped pet to the Starlight Sanctuary in exchange for universal `star_essence`.
 */
export function petRelease(p, { petUid, petId } = {}) {
  const pet = findOwnedPet(p, { petUid, petId });
  if (!pet) return fail('not_owned');
  if (p.pets.length <= 1) return fail('cannot_release_last_pet');
  if (p.equipped?.pet && (p.equipped.pet.uid === pet.uid || p.equipped.pet.id === pet.id)) {
    return fail('cannot_release_equipped');
  }
  const gained = releaseValue(pet);
  p.pets = p.pets.filter((x) => x.uid !== pet.uid);
  p.star_essence = (p.star_essence | 0) + gained;
  refreshDerived(p);
  return {
    ok: true,
    petUid: pet.uid,
    petId: pet.id,
    gainedEssence: gained,
    star_essence: p.star_essence,
    cp: p.cp,
  };
}

/**
 * pet_set_visual_tier { petUid?, petId?, tier }
 * Switches cosmetic visual form between 1..pet.stars without losing stats.
 */
export function petSetVisualTier(p, { petUid, petId, tier } = {}) {
  const pet = findOwnedPet(p, { petUid, petId });
  if (!pet) return fail('not_owned');
  const t = Number(tier);
  if (!Number.isInteger(t) || t < 1 || t > (pet.stars || 1)) {
    return fail('invalid_visual_tier', { maxTier: pet.stars || 1 });
  }
  pet.visual_tier = t;
  resyncIfEquipped(p, pet);
  return { ok: true, petUid: pet.uid, petId: pet.id, visual_tier: pet.visual_tier };
}

/**
 * pet_set_poses { petUid?, petId?, poses }
 * Updates the companion's active idle pose rotation playlist (e.g. ['front', 'sleep', 'happy']).
 */
export function petSetPoses(p, { petUid, petId, poses } = {}) {
  const pet = findOwnedPet(p, { petUid, petId });
  if (!pet) return fail('not_owned');
  const effLv = pet.bond_lv || pet.level || 1;
  pet.active_poses = normalizeActivePoses(poses, effLv);
  resyncIfEquipped(p, pet);
  return { ok: true, petUid: pet.uid, petId: pet.id, active_poses: pet.active_poses };
}

/**
 * pet_rename { petUid?, petId?, nickname }
 * Renames a pet (1–14 chars, or empty string to clear).
 */
export function petRename(p, { petUid, petId, nickname } = {}) {
  const pet = findOwnedPet(p, { petUid, petId });
  if (!pet) return fail('not_owned');
  pet.nickname = sanitizeNickname(nickname);
  resyncIfEquipped(p, pet);
  return { ok: true, petUid: pet.uid, petId: pet.id, nickname: pet.nickname };
}

/**
 * pet_interact { petUid?, petId? }
 * Pat / cuddle interaction: +10 Bond XP (30s cooldown), refills mood.
 */
export function petInteract(p, { petUid, petId } = {}, now = Date.now()) {
  const pet = findOwnedPet(p, { petUid, petId });
  if (!pet) return fail('not_owned');
  const elapsed = now - (pet.last_interact_at || 0);
  if (elapsed < PET2.INTERACT_COOLDOWN_MS) {
    return fail('interact_cooldown', { waitMs: PET2.INTERACT_COOLDOWN_MS - elapsed });
  }
  pet.last_interact_at = now;
  pet.mood = PET.MAX_MOOD;
  const bondRes = addBondXp(pet, PET2.INTERACT_BOND_XP, Math.random, nestLevel(p));
  syncTraitsMirror(pet);
  resyncIfEquipped(p, pet);
  refreshDerived(p);
  return {
    ok: true,
    petUid: pet.uid,
    petId: pet.id,
    bond_lv: pet.bond_lv,
    bond_xp: pet.bond_xp,
    stars: pet.stars,
    visual_tier: pet.visual_tier,
    slots: pet.slots,
    active_poses: pet.active_poses,
    leveledUp: bondRes.leveledUp,
    unlockedEmotes: unlockedEmotesForBond(pet.bond_lv),
  };
}

/**
 * pet_claim_gift { petUid?, petId? }
 * Claims the once-per-UTC-day gift bubble from the pet.
 */
export function petClaimGift(p, { petUid, petId } = {}, now = Date.now(), rng = Math.random) {
  const pet = findOwnedPet(p, { petUid, petId });
  if (!pet) return fail('not_owned');
  const day = String(utcDay(now));
  if (pet.last_gift_day === day) return fail('already_claimed_today');
  pet.last_gift_day = day;
  const gift = giftRoll(rng, pet.bond_lv || 1);
  p.gold += gift.gold;
  p.berries += gift.berries;
  if (gift.stardust > 0) {
    p.shards += gift.stardust;
    p.star_essence = (p.star_essence | 0) + gift.stardust * 5;
  }
  const bondRes = addBondXp(pet, 15, rng, nestLevel(p));
  syncTraitsMirror(pet);
  resyncIfEquipped(p, pet);
  refreshDerived(p);
  return {
    ok: true,
    petUid: pet.uid,
    petId: pet.id,
    gift,
    bond_lv: pet.bond_lv,
    bond_xp: pet.bond_xp,
    stars: pet.stars,
    visual_tier: pet.visual_tier,
    slots: pet.slots,
    active_poses: pet.active_poses,
    leveledUp: bondRes.leveledUp,
  };
}

// ---------------------------------------------------------------------------------------------
// Legacy Pet Sanctuary helpers kept for backward compatibility
// ---------------------------------------------------------------------------------------------
export function petFeed(p, { petUid, petId, feedBond } = {}) {
  const pet = findOwnedPet(p, { petUid, petId });
  if (!pet) return fail('not_owned');
  if (feedBond && pet.hunger == null) pet.hunger = HUNGER.DEFAULT;
  const isMaxed = pet.hunger != null
    ? (pet.hunger >= HUNGER.MAX && (pet.bond_lv || 1) >= PET2.BOND_MAX_LV && (pet.level || 1) >= PET.MAX_LEVEL && (pet.mood || 0) >= PET.MAX_MOOD)
    : (pet.level >= PET.MAX_LEVEL && pet.mood >= PET.MAX_MOOD);
  if (isMaxed) return fail('pet_maxed');
  if (p.berries < PET.FEED_COST) return fail('not_enough_berries', { cost: PET.FEED_COST });
  p.berries -= PET.FEED_COST;

  pet.mood = Math.min(PET.MAX_MOOD, (pet.mood ?? 75) + PET.FEED_MOOD);
  pet.hunger = Math.min(HUNGER.MAX, (pet.hunger ?? HUNGER.DEFAULT) + HUNGER.FEED_GAIN);
  const { mult } = hungerZone(pet.hunger);
  const gainedBondXp = Math.round(45 * mult);
  const bondRes = addBondXp(pet, gainedBondXp, Math.random, nestLevel(p));

  let levels = 0;
  if (pet.level < PET.MAX_LEVEL) {
    pet.exp = (pet.exp | 0) + PET.FEED_EXP;
    while (pet.level < PET.MAX_LEVEL && pet.exp >= petExpToNext(pet.level)) {
      pet.exp -= petExpToNext(pet.level);
      pet.level++;
      levels++;
    }
    if (pet.level >= PET.MAX_LEVEL) pet.exp = 0;
  }
  syncTraitsMirror(pet);
  resyncIfEquipped(p, pet);
  refreshDerived(p);
  return {
    ok: true,
    petUid: pet.uid,
    level: pet.level,
    exp: pet.exp,
    mood: pet.mood,
    hunger: pet.hunger,
    bond_lv: pet.bond_lv,
    bond_xp: pet.bond_xp,
    stars: pet.stars,
    visual_tier: pet.visual_tier,
    slots: pet.slots,
    active_poses: pet.active_poses,
    expGained: gainedBondXp,
    leveledUp: bondRes.leveledUp,
    levelsGained: levels,
    cost: PET.FEED_COST,
  };
}

/**
 * pet_online_tick { petUid?, petId? }
 * Called every ~60s while client is actively playing (rate-limited: ignores if < 45s since last tick).
 * Grants online bond EXP scaled by hunger zone, then drains hunger by 2.
 */
export function petOnlineTick(p, { petUid, petId } = {}, now = Date.now()) {
  const pet = findOwnedPet(p, { petUid, petId });
  if (!pet) return fail('not_owned');
  const elapsed = now - (pet.last_online_tick || 0);
  if (elapsed < 45_000) {
    return fail('rate_limited', { waitMs: 45_000 - elapsed });
  }
  pet.last_online_tick = now;
  const currentHunger = pet.hunger ?? HUNGER.DEFAULT;
  const { mult } = hungerZone(currentHunger);
  const expGained = Math.round(HUNGER.BASE_ONLINE_EXP_PER_MIN * mult);
  const bondRes = addBondXp(pet, expGained, Math.random, nestLevel(p));
  pet.hunger = Math.max(0, currentHunger - HUNGER.ONLINE_DRAIN_PER_MIN);
  syncTraitsMirror(pet);
  resyncIfEquipped(p, pet);
  refreshDerived(p);
  return {
    ok: true,
    petUid: pet.uid,
    bond_lv: pet.bond_lv,
    bond_xp: pet.bond_xp,
    stars: pet.stars,
    visual_tier: pet.visual_tier,
    slots: pet.slots,
    active_poses: pet.active_poses,
    hunger: pet.hunger,
    expGained,
    leveledUp: bondRes.leveledUp,
  };
}

/**
 * grantPetActivityExp(p, baseExp = 50, reason = 'activity')
 * Multiplies baseExp by current hunger multiplier and grants bond EXP to equipped pet.
 */
export function grantPetActivityExp(p, baseExp = 50, reason = 'activity') {
  const pet = findOwnedPet(p);
  if (!pet) return fail('no_equipped_pet');
  const currentHunger = pet.hunger ?? HUNGER.DEFAULT;
  const { mult, zone } = hungerZone(currentHunger);
  const expGained = Math.round(baseExp * mult);
  const bondRes = addBondXp(pet, expGained, Math.random, nestLevel(p));
  syncTraitsMirror(pet);
  resyncIfEquipped(p, pet);
  refreshDerived(p);
  return {
    ok: true,
    petUid: pet.uid,
    petId: pet.id,
    baseExp,
    mult,
    zone,
    expGained,
    gainedExp: expGained,
    bond_lv: pet.bond_lv,
    bond_xp: pet.bond_xp,
    stars: pet.stars,
    visual_tier: pet.visual_tier,
    slots: pet.slots,
    active_poses: pet.active_poses,
    leveledUp: bondRes.leveledUp,
    reason,
  };
}

/**
 * pet_equip_costume { petUid?, petId?, costumeId }
 * Equips a pet costume slot (strictly unlocked at Companion Lv. 15).
 */
export function petEquipCostume(p, { petUid, petId, costumeId } = {}) {
  const pet = findOwnedPet(p, { petUid, petId });
  if (!pet) return fail('not_owned');
  const lv = Math.max(pet.bond_lv || 1, minLevelForStars(pet.stars || 1));
  pet.bond_lv = lv;
  if (lv < 15) {
    return fail('costume_slot_locked', { reqLv: 15 });
  }
  if (costumeId == null || costumeId === '') {
    pet.costume_id = null;
    resyncIfEquipped(p, pet);
    return { ok: true, petUid: pet.uid, costume_id: null };
  }
  const cid = String(costumeId);
  if (!p.inventory?.[cid] || !OUTFITS[cid]) {
    return fail('costume_not_owned', { costumeId: cid });
  }
  pet.costume_id = cid;
  resyncIfEquipped(p, pet);
  return { ok: true, petUid: pet.uid, costume_id: pet.costume_id };
}

/**
 * pet_adopt { petId }
 * Adopts a pet from the catalog (2500 gold, or 0 if first pet).
 */
export function petAdopt(p, { petId } = {}, rng = Math.random) {
  if (!petId || !PETS[petId]) return fail('invalid_pet', { petId });
  const canonicalId = normalizePetId(petId);
  p.pets = Array.isArray(p.pets) ? p.pets : [];
  if (p.pets.some((x) => x.id === canonicalId)) {
    return fail('already_owned', { petId: canonicalId });
  }
  const cost = p.pets.length === 0 ? 0 : 2500;
  if (p.gold < cost) {
    return fail('not_enough_gold', { cost });
  }
  p.gold -= cost;
  const granted = grantPet(p, canonicalId, rng);
  const pet = p.pets.find((x) => x.id === canonicalId);
  if (pet) {
    syncEquippedPet(p, pet);
  }
  refreshDerived(p);
  return {
    ok: true,
    petUid: pet?.uid,
    petId: canonicalId,
    pet,
    granted,
    cost,
    gold: p.gold,
    cp: p.cp,
  };
}

export function petRerollTrait(p, { petUid, petId, slotIdx }, rng = Math.random) {
  const pet = findOwnedPet(p, { petUid, petId });
  if (!pet) return fail('not_owned');
  const i = Number(slotIdx);
  if (!Number.isInteger(i) || i < 0 || i >= PET.TRAIT_SLOTS) return fail('bad_slot');
  if (p.berries < PET.REROLL_COST) return fail('not_enough_berries', { cost: PET.REROLL_COST });
  p.berries -= PET.REROLL_COST;
  const before = pet.traits[i];
  pet.traits[i] = rollTrait(nestLevel(p), rng);
  if (Array.isArray(pet.slots) && i < (pet.stars || 1)) {
    pet.slots[i] = normalizeSlot({ stat: pet.traits[i], tier: TRAITS[pet.traits[i]].tier, locked: false });
  }
  return { ok: true, petUid: pet.uid, slotIdx: i, before, trait: pet.traits[i], tier: TRAITS[pet.traits[i]].tier, traits: [...pet.traits], slots: pet.slots, cost: PET.REROLL_COST };
}

export function petBreedCouple(p, partner, { myPetUid, partnerPetUid }, rng = Math.random) {
  if (!partner || partner.id === p.id) return fail('no_partner');
  const linked = (p.partner_id === partner.id && partner.partner_id === p.id) || (p.friends || []).includes(partner.id);
  if (!linked) return fail('not_partner_or_friend');
  const mine = findOwnedPet(p, { petUid: myPetUid });
  if (!mine) return fail('not_owned');
  const theirs = partnerPetUid
    ? partner.pets?.find((x) => x.uid === partnerPetUid)
    : partner.pets?.find((x) => x.uid === partner.equipped?.pet?.uid) || partner.pets?.find((x) => x.id === partner.equipped?.pet?.id);
  if (!theirs) return fail('partner_pet_missing');
  if (p.gold < PET.BREED_GOLD) return fail('not_enough_gold', { cost: PET.BREED_GOLD });
  if (p.berries < PET.BREED_BERRIES) return fail('not_enough_berries', { cost: PET.BREED_BERRIES });
  p.gold -= PET.BREED_GOLD; p.berries -= PET.BREED_BERRIES;
  const species = rng() < 0.5 ? mine.id : theirs.id;
  const trait = rollTrait(nestLevel(p), rng, { minTier: 'epic' });
  const hatched = grantPet(p, species, rng, { rarityRoll: 2, guaranteedTrait: trait, minTierSlot0: 'epic' });
  const levelsGained = grantExp(p, PET.HATCH_PLAYER_EXP);
  refreshDerived(p);
  return {
    ok: true, parents: [mine.id, theirs.id], hatched, trait, tier: TRAITS[trait].tier,
    exp: PET.HATCH_PLAYER_EXP, levelsGained, cost: { gold: PET.BREED_GOLD, berries: PET.BREED_BERRIES },
  };
}

// ---------------------------------------------------------------------------------------------
// Fluffé's Hair Studio (Step 3.5 — Character Foundation v2, Section 23.3 / 23.8)
// ---------------------------------------------------------------------------------------------
const ROYAL_HAIR_POOL = Object.keys(HAIRSTYLES).filter((k) => HAIRSTYLES[k].tier === 'royal');
const CELESTIAL_HAIR_POOL = Object.keys(HAIRSTYLES).filter((k) => HAIRSTYLES[k].tier === 'celestial');

/** hair_classic_buy { hairId } — 3,000 🪙 direct purchase of any Classic cut; unlocks permanently and equips. */
export function hairClassicBuy(p, { hairId } = {}) {
  migrateRpg(p);
  const def = HAIRSTYLES[hairId];
  if (!def || def.tier !== 'classic') return fail('bad_hair');
  if (p.owned_hairs.includes(hairId)) return fail('already_owned');
  const cost = HAIR_TIERS.classic.price.gold;
  if (p.gold < cost) return fail('not_enough_gold', { cost });
  p.gold -= cost;
  p.owned_hairs.push(hairId);
  p.appearance.hair = hairId;
  return { ok: true, hairId, spent: { gold: cost }, appearance: p.appearance, owned_hairs: p.owned_hairs };
}

/**
 * hair_gacha_pull { count: 1 | 10, currency: 'diamonds' | 'ticket' }
 * - 120 💎 or 1 🎟️ `ticket_royal_hair` per pull (1,200 💎 for 10x).
 * - Separate `hair_pity.celestial` (0.5% base rate, hard pity at pull 150; dupe → +150 🌟; auto-unlocks bundled Celestial dye)
 *   and `hair_pity.royal` (guaranteed Royal by pull 10; dupe → +25 🌟).
 */
export function hairGachaPull(p, { count = 1, currency = 'diamonds' } = {}, rng = Math.random) {
  migrateRpg(p);
  const n = Number(count);
  if (n !== 1 && n !== 10) return fail('bad_count');
  let paid;
  if (currency === 'ticket') {
    const have = p.bag_items.ticket_royal_hair | 0;
    if (have < n) return fail('not_enough_tickets', { need: n, have });
    p.bag_items.ticket_royal_hair = have - n;
    paid = { ticket_royal_hair: n };
  } else if (currency === 'diamonds') {
    const cost = n * HAIR_TIERS.royal.price.diamonds;
    if (p.diamonds < cost) return fail('not_enough_diamonds', { cost });
    p.diamonds -= cost;
    paid = { diamonds: cost };
  } else {
    return fail('bad_currency');
  }

  const items = [];
  for (let i = 0; i < n; i++) {
    p.hair_pity.celestial = (p.hair_pity.celestial | 0) + 1;
    p.hair_pity.royal = (p.hair_pity.royal | 0) + 1;

    const celestialPityHit = p.hair_pity.celestial >= HAIR_TIERS.celestial.pity;
    const isCelestial = celestialPityHit || rng() < HAIR_TIERS.celestial.rate;

    if (isCelestial) {
      p.hair_pity.celestial = 0;
      const unowned = CELESTIAL_HAIR_POOL.filter((k) => !p.owned_hairs.includes(k));
      const pool = (celestialPityHit && unowned.length) ? unowned : CELESTIAL_HAIR_POOL;
      const id = pick(pool, rng);
      const def = HAIRSTYLES[id];
      if (p.owned_hairs.includes(id)) {
        const shards = HAIR_TIERS.celestial.dupeShards;
        p.shards += shards;
        items.push({ id, tier: 'celestial', name: def.name, kind: 'shards', shards, pityHit: celestialPityHit });
      } else {
        p.owned_hairs.push(id);
        let unlockedColor = null;
        if (def.defaultColor && HAIR_COLORS[def.defaultColor]) {
          unlockedColor = def.defaultColor;
          if (!p.unlocked_hair_colors.includes(unlockedColor)) p.unlocked_hair_colors.push(unlockedColor);
        }
        p.appearance.hair = id;
        if (unlockedColor) p.appearance.hairColor = unlockedColor;
        items.push({ id, tier: 'celestial', name: def.name, kind: 'new', unlockedColor, pityHit: celestialPityHit });
      }
    } else {
      const royalPityHit = p.hair_pity.royal >= HAIR_TIERS.royal.pity;
      if (royalPityHit) p.hair_pity.royal = 0;
      const unowned = ROYAL_HAIR_POOL.filter((k) => !p.owned_hairs.includes(k));
      const pool = (royalPityHit && unowned.length) ? unowned : ROYAL_HAIR_POOL;
      const id = pick(pool, rng);
      const def = HAIRSTYLES[id];
      if (p.owned_hairs.includes(id)) {
        const shards = HAIR_TIERS.royal.dupeShards;
        p.shards += shards;
        items.push({ id, tier: 'royal', name: def.name, kind: 'shards', shards, pityHit: royalPityHit });
      } else {
        p.owned_hairs.push(id);
        p.hair_pity.royal = 0;
        p.appearance.hair = id;
        items.push({ id, tier: 'royal', name: def.name, kind: 'new', pityHit: royalPityHit });
      }
    }
  }

  return {
    ok: true, count: n, paid, items,
    hair_pity: { ...p.hair_pity },
    appearance: { ...p.appearance },
    owned_hairs: [...p.owned_hairs],
    unlocked_hair_colors: [...p.unlocked_hair_colors],
  };
}

/**
 * hair_dye_unlock { colorId } — permanent unlock of a Basic Salon dye (500 🪙) or Ombre Glow dye (50 💎).
 * Celestial dyes cannot be bought directly (they unlock automatically when pulling their Celestial hairstyle).
 */
export function hairDyeUnlock(p, { colorId } = {}) {
  migrateRpg(p);
  const c = HAIR_COLORS[colorId];
  if (!c) return fail('bad_color');
  if (c.tier === 'celestial') return fail('celestial_bundled_only');
  if (p.unlocked_hair_colors.includes(colorId)) return fail('already_unlocked');
  const tierDef = HAIR_DYE_TIERS[c.tier];
  const spent = {};
  if (tierDef?.price?.gold) {
    if (p.gold < tierDef.price.gold) return fail('not_enough_gold', { cost: tierDef.price.gold });
    p.gold -= tierDef.price.gold;
    spent.gold = tierDef.price.gold;
  } else if (tierDef?.price?.diamonds) {
    if (p.diamonds < tierDef.price.diamonds) return fail('not_enough_diamonds', { cost: tierDef.price.diamonds });
    p.diamonds -= tierDef.price.diamonds;
    spent.diamonds = tierDef.price.diamonds;
  }
  p.unlocked_hair_colors.push(colorId);
  p.appearance.hairColor = colorId;
  return { ok: true, colorId, spent, appearance: { ...p.appearance }, unlocked_hair_colors: [...p.unlocked_hair_colors] };
}

/**
 * hair_equip { hairId?, colorId?, body? } — 100% free switching among owned hairstyles & unlocked dyes in the Hair Closet.
 */
export function hairEquip(p, { hairId, colorId, body } = {}) {
  migrateRpg(p);
  if (body !== undefined) {
    if (body !== 'boy' && body !== 'girl') return fail('bad_body');
    p.appearance.body = body;
    p.lineage = body === 'girl' ? 'dxb' : 'bkk';
  }
  if (hairId !== undefined) {
    if (!HAIRSTYLES[hairId]) return fail('bad_hair');
    if (!p.owned_hairs.includes(hairId)) return fail('hair_not_owned');
    p.appearance.hair = hairId;
  }
  if (colorId !== undefined) {
    if (!HAIR_COLORS[colorId]) return fail('bad_color');
    if (!p.unlocked_hair_colors.includes(colorId)) return fail('color_not_unlocked');
    p.appearance.hairColor = colorId;
  }
  return { ok: true, appearance: { ...p.appearance } };
}

export { OUTFITS, ACCESSORIES, DICE_SKINS, DECOR, HAIRSTYLES, HAIR_COLORS, HAIR_TIERS, HAIR_DYE_TIERS };

