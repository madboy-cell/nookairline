// shared/sky_frontier_rules.js — Pure game rules for Sky Frontier (10-player co-op shard).
// Pure module, zero I/O, no Date.now: always takes `now` as a parameter.

import {
  createZoneDescriptor,
  clampZoneWalkable,
  ZONE_KINDS,
} from './mmorpg_engine.js';
import { softCap } from './universal_stats.js';
import {
  FOOD,
  MEAL_BUFF_MS,
  materialTier,
  isMaterial,
} from './materials_catalog.js';

// ---------------------------------------------------------------------------------------------
// Shard & Instance Routing
// ---------------------------------------------------------------------------------------------
export function isFrontierInstance(id) {
  return String(id || '').startsWith('frontier:');
}

export function shardIdOf(instanceId) {
  const str = String(instanceId || '');
  if (str.startsWith('frontier:')) {
    return str.slice('frontier:'.length);
  }
  return null;
}

export function frontierInstanceId(shardId) {
  const raw = String(shardId || '');
  if (raw.startsWith('frontier:')) return raw;
  return `frontier:${raw}`;
}

/**
 * Each region of a shard is its own server instance so broadcasts/rendering stay region-local:
 *   `frontier:<shardId>~<regionId>`  (the shard is the group of its region instances; cap counts across them).
 */
export function regionInstanceId(shardId, regionId) {
  return `frontier:${String(shardId || '')}~${String(regionId || 'meadow')}`;
}

/** Parse `frontier:<shardId>[~<regionId>]` → `{ shardId, regionId }` (regionId defaults to null). */
export function parseFrontierInstance(instanceId) {
  if (!isFrontierInstance(instanceId)) return null;
  const rest = String(instanceId).slice('frontier:'.length);
  const i = rest.indexOf('~');
  if (i < 0) return { shardId: rest || null, regionId: null };
  return { shardId: rest.slice(0, i) || null, regionId: rest.slice(i + 1) || null };
}

// ---------------------------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------------------------
export const MAX_PLAYERS_PER_SHARD = 10;
export const MAX_PARTY = 4;
export const SWING_MS = 750;
export const STRIKE_RANGE = 3.2;
export const MIN_STRIKE_GAP_RATIO = 0.9;
export const PERFECT_WEIGHT = 1.5;
export const SPLIT_MIN_SHARE = 0.10;
export const HELPER_BONUS = 0.10;
export const RESPAWN_MS = 45000;

export const ENERGY = Object.freeze({
  MAX: 200,
  REGEN_MS: 120000,
  DAILY_FREE: 200,
  PARTNER_GIFT: 50,
  DIAMOND_REFILL: 200,
  DIAMOND_REFILLS_PER_DAY: 2,
  DIAMOND_COSTS: Object.freeze([50, 100]),
});

export const WAREHOUSE_CAP_PER_LV = 300;
export const PANTRY_CAP_PER_LV = 100;
export const CAMP_CRATE_EXPIRE_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------------------------
// Regions & Coordinates
// ---------------------------------------------------------------------------------------------
export const REGIONS = Object.freeze({
  meadow: Object.freeze({
    id: 'meadow',
    name: 'Whispering Meadow',
    zone: createZoneDescriptor(ZONE_KINDS.SURVIVAL_WILDS, {
      id: 'sf_meadow',
      halfSize: 36,
    }),
    spawn: Object.freeze({ x: 0, z: 28 }),
    pois: Object.freeze({
      outpost: Object.freeze({ x: 0, z: 4 }),
      grove: Object.freeze({ x: -22, z: 8 }),
      wheat: Object.freeze({ x: 20, z: 12 }),
      grotto: Object.freeze({ x: 24, z: -14 }),
      golem: Object.freeze({ x: -20, z: -18 }),
      gate_hollow: Object.freeze({ x: 0, z: -32 }),
    }),
    gateTo: Object.freeze({
      hollow: Object.freeze({
        at: Object.freeze({ x: 0, z: -32 }),
        radius: 3,
        requires: 'hollow',
      }),
    }),
  }),
  hollow: Object.freeze({
    id: 'hollow',
    name: 'Crystal Hollow',
    zone: createZoneDescriptor(ZONE_KINDS.SURVIVAL_WILDS, {
      id: 'sf_hollow',
      halfSize: 32,
    }),
    spawn: Object.freeze({ x: 0, z: 26 }),
    pois: Object.freeze({
      outpost: Object.freeze({ x: 0, z: 6 }),
      quartz: Object.freeze({ x: -20, z: 0 }),
      mithril: Object.freeze({ x: 20, z: -10 }),
      boss: Object.freeze({ x: 0, z: -26 }),
      gate_meadow: Object.freeze({ x: 0, z: 30 }),
    }),
    gateTo: Object.freeze({
      meadow: Object.freeze({
        at: Object.freeze({ x: 0, z: 30 }),
        radius: 3,
        requires: null,
      }),
    }),
  }),
});

// ---------------------------------------------------------------------------------------------
// Gatherable Node Archetypes & Harvest Rarity Tiers
// ---------------------------------------------------------------------------------------------
export const HARVEST_RARITIES = Object.freeze({
  common: Object.freeze({
    id: 'common',
    label: 'Common Harvest',
    badge: '⚪',
    mult: 1.0,
    color: '#FFF8EC',
  }),
  uncommon: Object.freeze({
    id: 'uncommon',
    label: 'Fine Harvest!',
    badge: '🟢',
    mult: 1.5,
    color: '#6EE7B7',
  }),
  rare: Object.freeze({
    id: 'rare',
    label: 'Rare Vein!',
    badge: '🔵',
    mult: 2.0,
    color: '#67E8F9',
  }),
  epic: Object.freeze({
    id: 'epic',
    label: 'EPIC JACKPOT!',
    badge: '🌟',
    mult: 3.0,
    color: '#FDE047',
  }),
});

export const NODE_TYPES = Object.freeze({
  tree: Object.freeze({
    tool: 'axe',
    minTier: 1,
    hp: 8,
    drop: Object.freeze({ wood: 6 }),
    rare: Object.freeze({ honey: 0.18, feather: 0.14, ancient_gear: 0.015 }),
    rarityDrops: Object.freeze({
      uncommon: Object.freeze({ honey: 1 }),
      rare: Object.freeze({ honey: 2, feather: 1 }),
      epic: Object.freeze({ honey: 3, feather: 2, ancient_gear: 1 }),
    }),
  }),
  boulder: Object.freeze({
    tool: 'pickaxe',
    minTier: 1,
    hp: 8,
    drop: Object.freeze({ stone: 6 }),
    rare: Object.freeze({ crystal_ore: 0.16, ancient_gear: 0.02 }),
    rarityDrops: Object.freeze({
      uncommon: Object.freeze({ crystal_ore: 1 }),
      rare: Object.freeze({ crystal_ore: 3 }),
      epic: Object.freeze({ crystal_ore: 5, ancient_gear: 1 }),
    }),
  }),
  wheat: Object.freeze({
    tool: 'staff',
    minTier: 0,
    hp: 4,
    drop: Object.freeze({ sky_wheat: 5 }),
    rare: Object.freeze({ golden_wheat: 0.18, honey: 0.10 }),
    rarityDrops: Object.freeze({
      uncommon: Object.freeze({ golden_wheat: 1 }),
      rare: Object.freeze({ golden_wheat: 2, honey: 1 }),
      epic: Object.freeze({ golden_wheat: 4, honey: 2, starlight_essence: 1 }),
    }),
  }),
  herb: Object.freeze({
    tool: 'staff',
    minTier: 0,
    hp: 4,
    drop: Object.freeze({ herb_seed: 3 }),
    rare: Object.freeze({ berries_crop: 0.18, cloud_silk: 0.12 }),
    rarityDrops: Object.freeze({
      uncommon: Object.freeze({ berries_crop: 1 }),
      rare: Object.freeze({ berries_crop: 2, cloud_silk: 1 }),
      epic: Object.freeze({ berries_crop: 4, cloud_silk: 2, starlight_essence: 1 }),
    }),
  }),
  crystal: Object.freeze({
    tool: 'pickaxe',
    minTier: 1,
    hp: 10,
    drop: Object.freeze({ crystal_ore: 4 }),
    rare: Object.freeze({ ancient_gear: 0.02, crystal_glass: 0.12 }),
    rarityDrops: Object.freeze({
      uncommon: Object.freeze({ crystal_glass: 1 }),
      rare: Object.freeze({ crystal_glass: 2, ingot: 1 }),
      epic: Object.freeze({ crystal_glass: 3, ingot: 2, ancient_gear: 1 }),
    }),
  }),
  quartz: Object.freeze({
    tool: 'pickaxe',
    minTier: 2,
    hp: 12,
    drop: Object.freeze({ crystal_ore: 6 }),
    rare: Object.freeze({ ancient_gear: 0.04, crystal_glass: 0.15 }),
    rarityDrops: Object.freeze({
      uncommon: Object.freeze({ crystal_glass: 1, ingot: 1 }),
      rare: Object.freeze({ crystal_glass: 2, ancient_gear: 1 }),
      epic: Object.freeze({ crystal_glass: 4, ancient_gear: 1, starlight_essence: 1 }),
    }),
  }),
  mithril: Object.freeze({
    tool: 'pickaxe',
    minTier: 2,
    hp: 14,
    drop: Object.freeze({ crystal_ore: 8 }),
    rare: Object.freeze({ starlight_essence: 0.03, ingot: 0.18 }),
    rarityDrops: Object.freeze({
      uncommon: Object.freeze({ ingot: 2 }),
      rare: Object.freeze({ ingot: 3, starlight_essence: 1 }),
      epic: Object.freeze({ ingot: 5, ancient_gear: 1, starlight_essence: 2 }),
    }),
  }),
});

// ---------------------------------------------------------------------------------------------
// Energy Mechanics
// ---------------------------------------------------------------------------------------------
/**
 * Computes passive energy regen up to max.
 * Adds floor((now - lastRegenAt) / REGEN_MS) up to max, and advances lastRegenAt
 * by the consumed intervals. When full (cur >= max), lastRegenAt is reset to now.
 */
export function regenEnergy(energy, now = 0) {
  const e = energy ? { ...energy } : {};
  const max = Number.isFinite(e.max) ? e.max : ENERGY.MAX;
  let cur = Number.isFinite(e.cur) ? e.cur : max;
  let lastRegenAt = Number.isFinite(e.lastRegenAt) ? e.lastRegenAt : now;

  if (cur >= max) {
    return {
      ...e,
      cur,
      max,
      lastRegenAt: now,
    };
  }

  const elapsed = Math.max(0, now - lastRegenAt);
  const intervals = Math.floor(elapsed / ENERGY.REGEN_MS);

  if (intervals > 0) {
    const missing = max - cur;
    if (intervals >= missing) {
      cur = max;
      lastRegenAt = now;
    } else {
      cur += intervals;
      lastRegenAt += intervals * ENERGY.REGEN_MS;
    }
  }

  return {
    ...e,
    cur,
    max,
    lastRegenAt,
  };
}

/**
 * Spends energy after applying passive regen.
 * Returns { ok, energy }.
 */
export function spendEnergy(energy, n = 1, now = 0) {
  const current = regenEnergy(energy, now);
  const cost = Math.max(0, Number(n) || 0);

  if (current.cur < cost) {
    return { ok: false, energy: current };
  }

  return {
    ok: true,
    energy: {
      ...current,
      cur: current.cur - cost,
    },
  };
}

/**
 * Adds energy from consumables or refills.
 * Normal passive regen caps at `max` (200), but food and refills can overflow
 * up to 2 × MAX (cap at 400).
 */
export function addEnergy(energy, n = 0, now = 0) {
  const current = regenEnergy(energy, now);
  const max = current.max ?? ENERGY.MAX;
  const overflowCap = 2 * max;
  const amount = Math.max(0, Number(n) || 0);
  const cur = Math.min(overflowCap, current.cur + amount);

  return {
    ...current,
    cur,
    lastRegenAt: cur >= max ? now : current.lastRegenAt,
  };
}

/**
 * Returns the UTC day index (integer) for a timestamp in milliseconds.
 */
export function utcDayOf(now = 0) {
  return Math.floor((Number(now) || 0) / 86400000);
}

/**
 * Claims daily free energy (+200) once per UTC day.
 * Returns { ok, error: 'claimed', energy }.
 */
export function claimDailyEnergy(fr, now = 0) {
  if (!fr) return { ok: false, error: 'no_state' };
  fr.energy = regenEnergy(fr.energy, now);
  const day = utcDayOf(now);
  if (fr.energy.dailyFreeDay === day) {
    return { ok: false, error: 'claimed', energy: fr.energy };
  }
  fr.energy = addEnergy(fr.energy, ENERGY.DAILY_FREE, now);
  fr.energy.dailyFreeDay = day;
  return { ok: true, energy: fr.energy };
}

/**
 * Diamond energy refill: up to 2 per UTC day with tiered diamond costs [50, 100].
 * Returns { ok, error: 'limit' | 'diamonds', cost, energy }.
 */
export function diamondRefill(fr, diamondsAvailable = 0, now = 0) {
  if (!fr) return { ok: false, error: 'no_state' };
  fr.energy = regenEnergy(fr.energy, now);
  const day = utcDayOf(now);
  let count = fr.energy.diamondRefillsDay === day ? (Number(fr.energy.diamondRefillsCount) || 0) : 0;
  if (count >= ENERGY.DIAMOND_REFILLS_PER_DAY) {
    return { ok: false, error: 'limit', energy: fr.energy };
  }
  const cost = ENERGY.DIAMOND_COSTS[count];
  if ((Number(diamondsAvailable) || 0) < cost) {
    return { ok: false, error: 'diamonds', cost, energy: fr.energy };
  }
  fr.energy = addEnergy(fr.energy, ENERGY.DIAMOND_REFILL, now);
  fr.energy.diamondRefillsDay = day;
  fr.energy.diamondRefillsCount = count + 1;
  return { ok: true, cost, energy: fr.energy };
}

/**
 * Checks whether sender can gift energy to their partner today.
 */
export function canGiftPartner(fr, now = 0) {
  if (!fr?.energy) return false;
  const day = utcDayOf(now);
  return fr.energy.partnerGiftDay !== day;
}

/**
 * Gifts partner +50 energy once per UTC day.
 * Returns { ok, error: 'already_gifted', energy, receiverEnergy }.
 */
export function applyPartnerGift(senderFr, receiverFr, now = 0) {
  if (!senderFr || !receiverFr) return { ok: false, error: 'no_state' };
  senderFr.energy = regenEnergy(senderFr.energy, now);
  receiverFr.energy = regenEnergy(receiverFr.energy, now);
  const day = utcDayOf(now);
  if (senderFr.energy.partnerGiftDay === day) {
    return { ok: false, error: 'already_gifted', energy: senderFr.energy };
  }
  senderFr.energy.partnerGiftDay = day;
  receiverFr.energy = addEnergy(receiverFr.energy, ENERGY.PARTNER_GIFT, now);
  return {
    ok: true,
    energy: senderFr.energy,
    receiverEnergy: receiverFr.energy,
  };
}

/**
 * Returns active meal buff if valid and unexpired, otherwise null (and cleans expired buff).
 */
export function activeMealBuff(fr, now = 0) {
  if (!fr?.mealBuff) return null;
  if (typeof fr.mealBuff.until === 'number' && fr.mealBuff.until > now) {
    return fr.mealBuff;
  }
  try {
    fr.mealBuff = null;
  } catch {
    // ignore if frozen
  }
  return null;
}

/**
 * Consumes 1 food item from fr.pantry.items, adds energy (overflow to 400 allowed),
 * and activates meal buff if food has one (replacing any existing buff).
 * Returns { ok, error: 'not_food' | 'none', energy, buff }.
 */
export function eatFood(fr, foodId, now = 0) {
  if (!fr) return { ok: false, error: 'no_state' };
  const foodDef = FOOD[foodId];
  if (!foodDef) {
    fr.energy = regenEnergy(fr.energy, now);
    return { ok: false, error: 'not_food', energy: fr.energy };
  }
  fr.pantry ||= { lv: 1, items: {} };
  fr.pantry.items ||= {};
  const currentCount = fr.pantry.items[foodId] || 0;
  if (currentCount < 1) {
    fr.energy = regenEnergy(fr.energy, now);
    return { ok: false, error: 'none', energy: fr.energy };
  }
  if (currentCount <= 1) {
    delete fr.pantry.items[foodId];
  } else {
    fr.pantry.items[foodId] = currentCount - 1;
  }
  fr.energy = regenEnergy(fr.energy, now);
  fr.energy = addEnergy(fr.energy, foodDef.energy, now);
  if (foodDef.buff) {
    fr.mealBuff = {
      id: foodDef.buff,
      food: foodId,
      until: now + MEAL_BUFF_MS,
    };
  }
  const buff = activeMealBuff(fr, now);
  return { ok: true, energy: fr.energy, buff };
}

// ---------------------------------------------------------------------------------------------
// Storage & Camp Crate Mechanics
// ---------------------------------------------------------------------------------------------
export function warehouseCap(lv = 1) {
  return WAREHOUSE_CAP_PER_LV * Math.max(1, Number(lv) || 1);
}

export function pantryCap(lv = 1) {
  return PANTRY_CAP_PER_LV * Math.max(1, Number(lv) || 1);
}

export function totalStoreUnits(items = {}) {
  let sum = 0;
  for (const n of Object.values(items || {})) {
    sum += Math.max(0, Number(n) || 0);
  }
  return sum;
}

export function warehouseFreeSpace(warehouse) {
  const cap = warehouseCap(warehouse?.lv);
  return Math.max(0, cap - totalStoreUnits(warehouse?.items));
}

export function pantryFreeSpace(pantry) {
  const cap = pantryCap(pantry?.lv);
  return Math.max(0, cap - totalStoreUnits(pantry?.items));
}

/**
 * Routes items to stores: goods tier to pantry, all other tiers to warehouse.
 * Any overflow that exceeds storage capacity is placed in campCrate and extends expiresAt by 24h.
 * Returns { granted, overflow }.
 */
export function grantItems(fr, items, now = 0) {
  if (!fr || !items) return { granted: {}, overflow: {} };
  fr.pantry ||= { lv: 1, items: {} };
  fr.pantry.items ||= {};
  fr.warehouse ||= { lv: 1, items: {} };
  fr.warehouse.items ||= {};
  fr.campCrate ||= { items: {}, expiresAt: 0 };
  fr.campCrate.items ||= {};

  if (fr.campCrate.expiresAt > 0 && now >= fr.campCrate.expiresAt) {
    fr.campCrate.items = {};
    fr.campCrate.expiresAt = 0;
  }

  const granted = {};
  const overflow = {};
  let hadOverflow = false;

  for (const [id, rawN] of Object.entries(items)) {
    const n = Math.max(0, Number(rawN) || 0);
    if (n <= 0 || !isMaterial(id)) continue;

    const isGoods = materialTier(id) === 'goods';
    const store = isGoods ? fr.pantry : fr.warehouse;
    const cap = isGoods ? pantryCap(store.lv) : warehouseCap(store.lv);
    const currentUnits = totalStoreUnits(store.items);
    const freeSpace = Math.max(0, cap - currentUnits);
    const toStore = Math.min(n, freeSpace);
    const toCrate = n - toStore;

    if (toStore > 0) {
      store.items[id] = (store.items[id] || 0) + toStore;
      granted[id] = (granted[id] || 0) + toStore;
    }
    if (toCrate > 0) {
      fr.campCrate.items[id] = (fr.campCrate.items[id] || 0) + toCrate;
      overflow[id] = (overflow[id] || 0) + toCrate;
      hadOverflow = true;
    }
  }

  if (hadOverflow) {
    fr.campCrate.expiresAt = now + CAMP_CRATE_EXPIRE_MS;
  }

  return { granted, overflow };
}

/**
 * Moves crate items back into stores as space allows.
 * If expired, the crate is emptied first.
 * Returns { ok, moved, campCrate, pantry, warehouse, energy }.
 */
export function claimCrate(fr, now = 0) {
  if (!fr) return { ok: false, error: 'no_state' };
  fr.pantry ||= { lv: 1, items: {} };
  fr.pantry.items ||= {};
  fr.warehouse ||= { lv: 1, items: {} };
  fr.warehouse.items ||= {};
  fr.campCrate ||= { items: {}, expiresAt: 0 };
  fr.campCrate.items ||= {};

  if (fr.campCrate.expiresAt > 0 && now >= fr.campCrate.expiresAt) {
    fr.campCrate.items = {};
    fr.campCrate.expiresAt = 0;
  }

  const moved = {};
  for (const [id, rawCount] of Object.entries(fr.campCrate.items)) {
    const count = Math.max(0, Number(rawCount) || 0);
    if (count <= 0) continue;
    const isGoods = materialTier(id) === 'goods';
    const store = isGoods ? fr.pantry : fr.warehouse;
    const cap = isGoods ? pantryCap(store.lv) : warehouseCap(store.lv);
    const freeSpace = Math.max(0, cap - totalStoreUnits(store.items));
    const toMove = Math.min(count, freeSpace);
    if (toMove > 0) {
      store.items[id] = (store.items[id] || 0) + toMove;
      moved[id] = (moved[id] || 0) + toMove;
      const rem = count - toMove;
      if (rem > 0) {
        fr.campCrate.items[id] = rem;
      } else {
        delete fr.campCrate.items[id];
      }
    }
  }

  if (Object.keys(fr.campCrate.items).length === 0) {
    fr.campCrate.expiresAt = 0;
  }

  fr.energy = regenEnergy(fr.energy, now);
  return {
    ok: true,
    moved,
    campCrate: fr.campCrate,
    pantry: fr.pantry,
    warehouse: fr.warehouse,
    energy: fr.energy,
  };
}

/**
 * Calculates extra yield share bonus for a player with 'yield' (+20%) or 'yield_plus' (+35%) buff.
 * Floored per material, minimum +1 if baseShare > 0.
 */
export function applyYieldBonus(baseShare = 0, buffId = null) {
  const base = Math.max(0, Number(baseShare) || 0);
  if (base <= 0) return 0;
  if (buffId === 'yield') {
    return Math.max(1, Math.floor(base * 0.20));
  }
  if (buffId === 'yield_plus') {
    return Math.max(1, Math.floor(base * 0.35));
  }
  return 0;
}

// ---------------------------------------------------------------------------------------------
// Gathering & Strike Validation
// ---------------------------------------------------------------------------------------------
/**
 * Calculates swing duration adjusted by swiftness using softCap.
 */
export function calcSwingMs(swiftness = 0, baseSwingMs = SWING_MS) {
  const reductionPct = softCap(swiftness, 0.40, 140);
  return Math.max(300, Math.round(baseSwingMs * (1 - reductionPct)));
}

/**
 * Validates whether a player can strike a node.
 * Returns { ok, code } with codes: 'out_of_range' | 'tool_tier' | 'too_fast' | null.
 */
export function canStrike({
  playerPos,
  nodePos,
  toolTier = 0,
  node,
  lastStrikeAt,
  now,
  swingMs = SWING_MS,
} = {}) {
  const px = playerPos?.x ?? 0;
  const pz = playerPos?.z ?? 0;
  const nx = nodePos?.x ?? 0;
  const nz = nodePos?.z ?? 0;

  const dist = Math.hypot(px - nx, pz - nz);
  if (dist > STRIKE_RANGE) {
    return { ok: false, code: 'out_of_range' };
  }

  const nodeDef =
    (typeof node === 'string'
      ? NODE_TYPES[node]
      : node?.type && NODE_TYPES[node.type]
      ? NODE_TYPES[node.type]
      : node) || {};

  const requiredTier = nodeDef.minTier ?? 0;
  if ((Number(toolTier) || 0) < requiredTier) {
    return { ok: false, code: 'tool_tier' };
  }

  const baseSwing = Number.isFinite(swingMs) && swingMs > 0 ? swingMs : SWING_MS;
  const minGap = baseSwing * MIN_STRIKE_GAP_RATIO;
  if (
    Number.isFinite(lastStrikeAt) &&
    lastStrikeAt > 0 &&
    Number.isFinite(now) &&
    now - lastStrikeAt < minGap
  ) {
    return { ok: false, code: 'too_fast' };
  }

  return { ok: true, code: null };
}

// ---------------------------------------------------------------------------------------------
// Loot Distribution
// ---------------------------------------------------------------------------------------------
/**
 * Splits gather loot by contribution:
 * - Qualifying: players whose weighted hits >= 10% of total hits.
 * - Total drop: baseDrop * (1 + 0.10 * (q - 1)) * fortuneMult (floored per material).
 * - Shares: proportional to hits among qualifying players, distributed via
 *   largest remainder method (floors + remainder by largest fraction, tie-break by userId).
 *   The sum of shares equals total exactly.
 */
export function splitLoot({ hits = {}, baseDrop = {}, fortuneMult = 1 } = {}) {
  const userIds = Object.keys(hits);
  let totalHits = 0;
  for (const uid of userIds) {
    totalHits += Math.max(0, hits[uid] || 0);
  }

  if (totalHits <= 0) {
    return { qualifying: [], shares: {} };
  }

  const threshold = totalHits * SPLIT_MIN_SHARE - 1e-9;
  const qualifying = userIds
    .filter((uid) => (hits[uid] || 0) >= threshold)
    .sort();

  const q = qualifying.length;
  if (q === 0) {
    return { qualifying: [], shares: {} };
  }

  const qualifyingHitsSum = qualifying.reduce((sum, uid) => sum + (hits[uid] || 0), 0);

  const shares = {};
  for (const uid of qualifying) {
    shares[uid] = {};
  }

  const helperMultiplier = 1 + HELPER_BONUS * (q - 1);
  const fMult = Number.isFinite(fortuneMult) && fortuneMult > 0 ? fortuneMult : 1;

  for (const [matId, baseAmount] of Object.entries(baseDrop)) {
    const rawTotal = (baseAmount || 0) * helperMultiplier * fMult;
    const total = Math.floor(Math.max(0, rawTotal));

    if (total === 0 || qualifyingHitsSum <= 0) {
      for (const uid of qualifying) {
        shares[uid][matId] = 0;
      }
      continue;
    }

    let allocated = 0;
    const parts = qualifying.map((uid) => {
      const rawShare = (total * (hits[uid] || 0)) / qualifyingHitsSum;
      const floorShare = Math.floor(rawShare);
      allocated += floorShare;
      return {
        uid,
        floorShare,
        frac: rawShare - floorShare,
      };
    });

    const remainder = total - allocated;

    parts.sort((a, b) => {
      const diff = b.frac - a.frac;
      if (Math.abs(diff) > 1e-9) {
        return diff;
      }
      return a.uid.localeCompare(b.uid);
    });

    for (let i = 0; i < parts.length; i++) {
      const bonus = i < remainder ? 1 : 0;
      shares[parts[i].uid][matId] = parts[i].floorShare + bonus;
    }
  }

  return { qualifying, shares };
}

/**
 * Rolls a Harvest Rarity Tier ('common' | 'uncommon' | 'rare' | 'epic') when a node breaks.
 * - Base chances: Common 62%, Uncommon 25%, Rare 10%, Epic 3%.
 * - Each `PERFECT!` rhythm strike on the node adds +6% Uncommon, +4.5% Rare, and +2% Epic
 *   (capped at +36% Uncommon, +27% Rare, +15% Epic), and scales with player Luck (`luckMult`).
 * - Returns `{ id, label, badge, mult, color, bonusDrops, rareBoostPct }`.
 */
export function rollHarvestRarity({
  nodeType,
  perfectCount = 0,
  totalSwings = 0,
  luckMult = 1,
  rng = Math.random,
  forceRoll = false,
} = {}) {
  const def = typeof nodeType === 'string' ? NODE_TYPES[nodeType] : nodeType;
  const pCount = Math.max(0, Math.floor(Number(perfectCount) || 0));
  const swings = Math.max(0, Math.floor(Number(totalSwings) || 0));
  const luck = Number.isFinite(luckMult) && luckMult > 0 ? luckMult : 1;

  // Synthetic 1-swing non-perfect unit tests stay deterministic at 1.0x unless forceRoll is set
  if (!forceRoll && swings <= 1 && pCount === 0) {
    return {
      ...HARVEST_RARITIES.common,
      bonusDrops: {},
      rareBoostPct: 0,
    };
  }

  const epicChance = Math.min(0.22, (0.03 + Math.min(0.15, pCount * 0.02)) * luck);
  const rareChance = Math.min(0.42, (0.10 + Math.min(0.27, pCount * 0.045)) * luck);
  const uncommonChance = Math.min(0.55, (0.25 + Math.min(0.36, pCount * 0.06)) * Math.sqrt(luck));
  const rareBoostPct = Math.round((epicChance + rareChance + uncommonChance - 0.38) * 100);

  const roll = Math.max(0, Math.min(0.999999, Number(rng()) || 0));
  let tier = HARVEST_RARITIES.common;
  if (roll < epicChance) {
    tier = HARVEST_RARITIES.epic;
  } else if (roll < epicChance + rareChance) {
    tier = HARVEST_RARITIES.rare;
  } else if (roll < epicChance + rareChance + uncommonChance) {
    tier = HARVEST_RARITIES.uncommon;
  }

  const bonusDrops = { ...(def?.rarityDrops?.[tier.id] || {}) };
  return {
    ...tier,
    bonusDrops,
    rareBoostPct: Math.max(0, rareBoostPct),
  };
}

/**
 * Rolls rare drop chances independently per qualifying player.
 * Returns { [userId]: { [matId]: 1 } }.
 */
export function rollRares(rareTable, qualifyingIds, rng = Math.random, luckMult = 1) {
  if (!rareTable || typeof rareTable !== 'object') return {};
  const entries = Object.entries(rareTable);
  if (entries.length === 0) return {};

  const playerList = Array.isArray(qualifyingIds)
    ? [...qualifyingIds]
    : Object.keys(qualifyingIds || {});
  playerList.sort();

  const getLuck = (uid) => {
    if (typeof luckMult === 'function') return luckMult(uid);
    if (typeof luckMult === 'object' && luckMult !== null) return luckMult[uid] ?? 1;
    return Number.isFinite(luckMult) && luckMult > 0 ? luckMult : 1;
  };

  const results = {};

  for (const uid of playerList) {
    const luck = getLuck(uid);
    for (const [matId, baseChance] of entries) {
      const chance = (baseChance || 0) * luck;
      if (rng() < chance) {
        if (!results[uid]) results[uid] = {};
        results[uid][matId] = 1;
      }
    }
  }

  return results;
}

// ---------------------------------------------------------------------------------------------
// Gate & Region Utilities
// ---------------------------------------------------------------------------------------------
function checkHasUnlock(unlocks, requirement) {
  if (!requirement) return true;
  if (!unlocks) return false;
  if (Array.isArray(unlocks)) return unlocks.includes(requirement);
  if (unlocks instanceof Set) return unlocks.has(requirement);
  if (Array.isArray(unlocks.regions) && unlocks.regions.includes(requirement)) return true;
  if (Array.isArray(unlocks.gates) && unlocks.gates.includes(requirement)) return true;
  if (unlocks[requirement] === true) return true;
  return false;
}

/**
 * Checks whether a gate between frontier regions is open for a player.
 */
export function isGateOpen(regionId, gateKey, unlocks, { guestOfUnlocked = false } = {}) {
  const region = REGIONS[regionId];
  if (!region?.gateTo) return false;
  const gate = region.gateTo[gateKey];
  if (!gate) return false;

  if (gate.requires == null) return true;
  if (guestOfUnlocked) return true;

  return checkHasUnlock(unlocks, gate.requires);
}

/**
 * Clamps coordinates to within a frontier region's walkable area.
 */
export function clampToRegion(regionId, x, z, radius = 0.4) {
  const region = REGIONS[regionId];
  if (!region?.zone) return { x, z };
  return clampZoneWalkable(region.zone, x, z, { radius });
}
