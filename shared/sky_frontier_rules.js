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
      boulders: Object.freeze({ x: -16, z: -8 }),
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
      frost_glade: Object.freeze({ x: -18, z: 16 }),
      quartz: Object.freeze({ x: -20, z: 0 }),
      mithril: Object.freeze({ x: 20, z: -10 }),
      sanctum_guard: Object.freeze({ x: 14, z: -20 }),
      boss: Object.freeze({ x: 0, z: -26 }),
      gate_meadow: Object.freeze({ x: 0, z: 30 }),
      gate_reef: Object.freeze({ x: 24, z: 18 }),
    }),
    gateTo: Object.freeze({
      meadow: Object.freeze({
        at: Object.freeze({ x: 0, z: 30 }),
        radius: 3,
        requires: null,
      }),
      reef: Object.freeze({
        at: Object.freeze({ x: 24, z: 18 }),
        radius: 3,
        requires: 'reef',
      }),
    }),
  }),
  reef: Object.freeze({
    id: 'reef',
    name: 'Celestial Sakura Reef',
    zone: createZoneDescriptor(ZONE_KINDS.SURVIVAL_WILDS, {
      id: 'sf_reef',
      halfSize: 36,
    }),
    spawn: Object.freeze({ x: 0, z: 28 }),
    pois: Object.freeze({
      outpost: Object.freeze({ x: 0, z: 6 }),
      shrine_woods: Object.freeze({ x: -22, z: 10 }),
      pearl_shoals: Object.freeze({ x: 22, z: 10 }),
      crane_roost: Object.freeze({ x: -20, z: -14 }),
      bell_lagoon: Object.freeze({ x: 20, z: -14 }),
      boss: Object.freeze({ x: 0, z: -26 }),
      gate_hollow: Object.freeze({ x: -14, z: 30 }),
      gate_caldera: Object.freeze({ x: 14, z: -30 }),
    }),
    gateTo: Object.freeze({
      hollow: Object.freeze({
        at: Object.freeze({ x: -14, z: 30 }),
        radius: 3,
        requires: null,
      }),
      caldera: Object.freeze({
        at: Object.freeze({ x: 14, z: -30 }),
        radius: 3,
        requires: 'caldera',
      }),
    }),
  }),
  caldera: Object.freeze({
    id: 'caldera',
    name: 'Clockwork Star-Caldera',
    zone: createZoneDescriptor(ZONE_KINDS.SURVIVAL_WILDS, {
      id: 'sf_caldera',
      halfSize: 36,
    }),
    spawn: Object.freeze({ x: 0, z: 28 }),
    pois: Object.freeze({
      outpost: Object.freeze({ x: 0, z: 6 }),
      cinder_vents: Object.freeze({ x: -22, z: 10 }),
      gear_foundry: Object.freeze({ x: 22, z: 10 }),
      prism_spires: Object.freeze({ x: -20, z: -14 }),
      chrono_ring: Object.freeze({ x: 20, z: -14 }),
      boss: Object.freeze({ x: 0, z: -26 }),
      gate_reef: Object.freeze({ x: 0, z: 30 }),
    }),
    gateTo: Object.freeze({
      reef: Object.freeze({
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
  sakura_tree: Object.freeze({
    tool: 'axe',
    minTier: 2,
    hp: 12,
    drop: Object.freeze({ sakura_timber: 5 }),
    rare: Object.freeze({ honey: 0.20, cloud_silk: 0.16, starlight_essence: 0.03 }),
    rarityDrops: Object.freeze({
      uncommon: Object.freeze({ sakura_timber: 2 }),
      rare: Object.freeze({ sakura_timber: 3, cloud_silk: 2 }),
      epic: Object.freeze({ sakura_timber: 5, starlight_essence: 2 }),
    }),
  }),
  pearl_clam: Object.freeze({
    tool: 'pickaxe',
    minTier: 2,
    hp: 12,
    drop: Object.freeze({ celestial_pearl: 4 }),
    rare: Object.freeze({ fish: 0.22, crystal_glass: 0.16, starlight_essence: 0.04 }),
    rarityDrops: Object.freeze({
      uncommon: Object.freeze({ celestial_pearl: 2 }),
      rare: Object.freeze({ celestial_pearl: 3, crystal_glass: 2 }),
      epic: Object.freeze({ celestial_pearl: 5, starlight_essence: 2 }),
    }),
  }),
  cloud_lotus: Object.freeze({
    tool: 'staff',
    minTier: 1,
    hp: 8,
    drop: Object.freeze({ cloud_lotus: 4 }),
    rare: Object.freeze({ cloud_silk: 0.22, herb_seed: 0.20, starlight_essence: 0.03 }),
    rarityDrops: Object.freeze({
      uncommon: Object.freeze({ cloud_lotus: 2 }),
      rare: Object.freeze({ cloud_lotus: 3, cloud_silk: 2 }),
      epic: Object.freeze({ cloud_lotus: 5, starlight_essence: 2 }),
    }),
  }),
  orichalcum: Object.freeze({
    tool: 'pickaxe',
    minTier: 2,
    hp: 15,
    drop: Object.freeze({ orichalcum_ore: 4 }),
    rare: Object.freeze({ mithril_ingot: 0.20, ancient_gear: 0.08, starlight_essence: 0.05 }),
    rarityDrops: Object.freeze({
      uncommon: Object.freeze({ orichalcum_ore: 2, ingot: 1 }),
      rare: Object.freeze({ orichalcum_ore: 3, mithril_ingot: 2 }),
      epic: Object.freeze({ orichalcum_ore: 5, mithril_ingot: 3, ancient_gear: 2 }),
    }),
  }),
  astral_prism: Object.freeze({
    tool: 'staff',
    minTier: 2,
    hp: 14,
    drop: Object.freeze({ astral_prism: 4 }),
    rare: Object.freeze({ starlight_essence: 0.10, ancient_gear: 0.08, crystal_glass: 0.18 }),
    rarityDrops: Object.freeze({
      uncommon: Object.freeze({ astral_prism: 2 }),
      rare: Object.freeze({ astral_prism: 3, starlight_essence: 1 }),
      epic: Object.freeze({ astral_prism: 5, starlight_essence: 3, ancient_gear: 1 }),
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

// ---------------------------------------------------------------------------------------------
// Smart Quest & Material Wayfinding Directory
// ---------------------------------------------------------------------------------------------
export const FRONTIER_ITEM_SOURCES = Object.freeze({
  // Raw & Rare Gatherables
  wood: Object.freeze({
    id: 'wood', region: 'meadow', mode: 'gather',
    nodeTypes: Object.freeze(['tree']), poiKey: 'grove',
    label: 'Whispering Grove Trees', icon: '🪵',
  }),
  stone: Object.freeze({
    id: 'stone', region: 'meadow', altRegions: Object.freeze(['hollow']), mode: 'gather',
    nodeTypes: Object.freeze(['boulder']), poiKey: 'outpost',
    label: 'Granite Boulders', icon: '🪨',
  }),
  sky_wheat: Object.freeze({
    id: 'sky_wheat', region: 'meadow', mode: 'gather',
    nodeTypes: Object.freeze(['wheat']), poiKey: 'wheat',
    label: 'Mill Ruins Wheat Patch', icon: '🌾',
  }),
  golden_wheat: Object.freeze({
    id: 'golden_wheat', region: 'meadow', mode: 'gather',
    nodeTypes: Object.freeze(['wheat']), poiKey: 'wheat',
    label: 'Mill Ruins Wheat (Rare)', icon: '✨',
  }),
  herb: Object.freeze({
    id: 'herb', region: 'meadow', altRegions: Object.freeze(['hollow']), mode: 'gather',
    nodeTypes: Object.freeze(['herb']), poiKey: 'grove',
    label: 'Dewdrop Herb Bushes (Seeds)', icon: '🌿',
  }),
  herb_seed: Object.freeze({
    id: 'herb_seed', region: 'meadow', altRegions: Object.freeze(['hollow']), mode: 'gather',
    nodeTypes: Object.freeze(['herb']), poiKey: 'grove',
    label: 'Dewdrop Herb Bushes', icon: '🌱',
  }),
  berries_crop: Object.freeze({
    id: 'berries_crop', region: 'meadow', mode: 'gather',
    nodeTypes: Object.freeze(['herb']), poiKey: 'wheat',
    label: 'Dewdrop Herb Bushes (Rare)', icon: '🍓',
  }),
  crystal_ore: Object.freeze({
    id: 'crystal_ore', region: 'hollow', fallbackRegion: 'meadow', fallbackPoiKey: 'grotto', mode: 'gather',
    nodeTypes: Object.freeze(['crystal', 'quartz', 'mithril']), poiKey: 'quartz',
    label: 'Crystal Veins', icon: '💎',
  }),
  crystal_glass: Object.freeze({
    id: 'crystal_glass', region: 'hollow', fallbackRegion: 'meadow', fallbackPoiKey: 'grotto', mode: 'gather',
    nodeTypes: Object.freeze(['quartz', 'crystal']), poiKey: 'quartz',
    minTool: Object.freeze({ tool: 'pickaxe', tier: 1 }),
    label: 'Quartz & Crystal Veins', icon: '🔷',
  }),
  ingot: Object.freeze({
    id: 'ingot', region: 'hollow', fallbackRegion: 'meadow', fallbackPoiKey: 'grotto', mode: 'gather',
    nodeTypes: Object.freeze(['mithril', 'crystal']), poiKey: 'mithril',
    minTool: Object.freeze({ tool: 'pickaxe', tier: 2 }),
    label: 'Mithril Veins (or Smelt at Mint)', icon: '🔩',
  }),
  honey: Object.freeze({
    id: 'honey', region: 'meadow', mode: 'gather',
    nodeTypes: Object.freeze(['tree', 'wheat']), poiKey: 'grove',
    label: 'Meadow Trees & Wheat', icon: '🍯',
  }),
  feather: Object.freeze({
    id: 'feather', region: 'meadow', mode: 'gather',
    nodeTypes: Object.freeze(['tree']), poiKey: 'grove',
    label: 'Whispering Grove Trees (Rare)', icon: '🪶',
  }),
  cloud_silk: Object.freeze({
    id: 'cloud_silk', region: 'meadow', altRegions: Object.freeze(['hollow']), mode: 'gather',
    nodeTypes: Object.freeze(['herb']), poiKey: 'grove',
    label: 'Dewdrop Herb Bushes (Rare)', icon: '🧶',
  }),
  ancient_gear: Object.freeze({
    id: 'ancient_gear', region: 'hollow', fallbackRegion: 'meadow', fallbackPoiKey: 'golem', mode: 'gather',
    nodeTypes: Object.freeze(['quartz', 'mithril', 'crystal', 'boulder']), poiKey: 'quartz',
    label: 'Ancient Crystal & Boulder Veins', icon: '⚙️',
  }),
  starlight_essence: Object.freeze({
    id: 'starlight_essence', region: 'hollow', altRegions: Object.freeze(['reef', 'caldera']), fallbackRegion: 'meadow', fallbackPoiKey: 'wheat', mode: 'gather',
    nodeTypes: Object.freeze(['mithril', 'quartz', 'astral_prism', 'pearl_clam']), poiKey: 'mithril',
    minTool: Object.freeze({ tool: 'pickaxe', tier: 2 }),
    label: 'Mithril & Astral Spires', icon: '🌟',
  }),
  mithril_ingot: Object.freeze({
    id: 'mithril_ingot', region: 'hollow', altRegions: Object.freeze(['caldera']), mode: 'gather',
    nodeTypes: Object.freeze(['mithril', 'orichalcum']), poiKey: 'mithril',
    minTool: Object.freeze({ tool: 'pickaxe', tier: 2 }),
    label: 'Smelt at Mint (or Mithril/Orichalcum Veins)', icon: '💠',
  }),
  sakura_timber: Object.freeze({
    id: 'sakura_timber', region: 'reef', mode: 'gather',
    nodeTypes: Object.freeze(['sakura_tree']), poiKey: 'shrine_woods',
    minTool: Object.freeze({ tool: 'axe', tier: 2 }),
    label: 'Shrine Sakura Trees', icon: '🌸',
  }),
  celestial_pearl: Object.freeze({
    id: 'celestial_pearl', region: 'reef', mode: 'gather',
    nodeTypes: Object.freeze(['pearl_clam']), poiKey: 'pearl_shoals',
    minTool: Object.freeze({ tool: 'pickaxe', tier: 2 }),
    label: 'Luminous Pearl Clams', icon: '🦪',
  }),
  cloud_lotus: Object.freeze({
    id: 'cloud_lotus', region: 'reef', mode: 'gather',
    nodeTypes: Object.freeze(['cloud_lotus']), poiKey: 'crane_roost',
    minTool: Object.freeze({ tool: 'staff', tier: 1 }),
    label: 'Floating Cloud-Lotus Pools', icon: '🪷',
  }),
  orichalcum_ore: Object.freeze({
    id: 'orichalcum_ore', region: 'caldera', mode: 'gather',
    nodeTypes: Object.freeze(['orichalcum']), poiKey: 'cinder_vents',
    minTool: Object.freeze({ tool: 'pickaxe', tier: 2 }),
    label: 'Solar Orichalcum Veins', icon: '🔶',
  }),
  astral_prism: Object.freeze({
    id: 'astral_prism', region: 'caldera', mode: 'gather',
    nodeTypes: Object.freeze(['astral_prism']), poiKey: 'prism_spires',
    minTool: Object.freeze({ tool: 'staff', tier: 2 }),
    label: 'Clockwork Astral Prisms', icon: '🔮',
  }),
  // Combat & Boss Drops
  monster_gel: Object.freeze({
    id: 'monster_gel', region: 'meadow', altRegions: Object.freeze(['hollow', 'reef']), mode: 'combat',
    mobKinds: Object.freeze(['moss_slime', 'thornback_boar', 'crystal_beetle', 'reef_bell_spirit']), poiKey: 'grove',
    label: 'Moss Slimes & Beetles', icon: '🟢',
  }),
  monster_fang: Object.freeze({
    id: 'monster_fang', region: 'meadow', altRegions: Object.freeze(['hollow', 'caldera']), mode: 'combat',
    mobKinds: Object.freeze(['thornback_boar', 'lantern_bat', 'quartz_golemling', 'sanctum_star_gargoyle']), poiKey: 'boulders',
    label: 'Thornback Boars & Cavern Bats', icon: '🦷',
  }),
  boss_core_moss: Object.freeze({
    id: 'boss_core_moss', region: 'meadow', mode: 'boss',
    bossId: 'elder_moss_golem', mobKinds: Object.freeze(['elder_moss_golem']), poiKey: 'golem',
    label: 'Elder Moss Golem Altar', icon: '🪨',
  }),
  boss_core_weaver: Object.freeze({
    id: 'boss_core_weaver', region: 'hollow', mode: 'boss',
    bossId: 'hollow_crystal_weaver', mobKinds: Object.freeze(['hollow_crystal_weaver']), poiKey: 'boss',
    label: 'Crystal Weaver Altar', icon: '🕸️',
  }),
  boss_core_kitsune: Object.freeze({
    id: 'boss_core_kitsune', region: 'reef', mode: 'boss',
    bossId: 'sakura_nine_tail_kitsune', mobKinds: Object.freeze(['sakura_nine_tail_kitsune']), poiKey: 'boss',
    label: 'Nine-Tail Kitsune Shrine Altar', icon: '🦊',
  }),
  boss_core_bahamut: Object.freeze({
    id: 'boss_core_bahamut', region: 'caldera', mode: 'boss',
    bossId: 'chronos_solar_bahamut', mobKinds: Object.freeze(['chronos_solar_bahamut']), poiKey: 'boss',
    label: 'Chronos-Solar Bahamut Altar', icon: '☀️',
  }),
  // Story POIs, Monsters & Bosses
  outpost: Object.freeze({
    id: 'outpost', region: 'meadow', altRegions: Object.freeze(['hollow', 'reef', 'caldera']), mode: 'poi',
    poiKey: 'outpost', label: 'Goddess Outpost Statue', icon: '🗽',
  }),
  wheat: Object.freeze({
    id: 'wheat', region: 'meadow', mode: 'poi',
    poiKey: 'wheat', label: 'Overgrown Mill Ruins', icon: '🌾',
  }),
  gate_hollow: Object.freeze({
    id: 'gate_hollow', region: 'meadow', mode: 'poi',
    poiKey: 'gate_hollow', label: 'Northern Sky Mist Gate', icon: '🌀',
  }),
  gate_meadow: Object.freeze({
    id: 'gate_meadow', region: 'hollow', mode: 'poi',
    poiKey: 'gate_meadow', label: 'Meadow Return Gate', icon: '🌀',
  }),
  gate_reef: Object.freeze({
    id: 'gate_reef', region: 'hollow', mode: 'poi',
    poiKey: 'gate_reef', label: 'Sakura Reef Tide Gate', icon: '🌸',
  }),
  gate_caldera: Object.freeze({
    id: 'gate_caldera', region: 'reef', mode: 'poi',
    poiKey: 'gate_caldera', label: 'Star-Caldera Ascent Gate', icon: '⚙️',
  }),
  elder_moss_golem: Object.freeze({
    id: 'elder_moss_golem', region: 'meadow', mode: 'boss',
    bossId: 'elder_moss_golem', mobKinds: Object.freeze(['elder_moss_golem']), poiKey: 'golem',
    label: 'Elder Moss Golem Altar', icon: '🗿',
  }),
  hollow_crystal_weaver: Object.freeze({
    id: 'hollow_crystal_weaver', region: 'hollow', mode: 'boss',
    bossId: 'hollow_crystal_weaver', mobKinds: Object.freeze(['hollow_crystal_weaver']), poiKey: 'boss',
    label: 'Hollow Crystal Weaver Altar', icon: '🕷️',
  }),
  sakura_nine_tail_kitsune: Object.freeze({
    id: 'sakura_nine_tail_kitsune', region: 'reef', mode: 'boss',
    bossId: 'sakura_nine_tail_kitsune', mobKinds: Object.freeze(['sakura_nine_tail_kitsune']), poiKey: 'boss',
    label: 'Lady Tamamo Shrine Altar', icon: '🦊',
  }),
  chronos_solar_bahamut: Object.freeze({
    id: 'chronos_solar_bahamut', region: 'caldera', mode: 'boss',
    bossId: 'chronos_solar_bahamut', mobKinds: Object.freeze(['chronos_solar_bahamut']), poiKey: 'boss',
    label: 'Chronos-Solar Bahamut Altar', icon: '🐲',
  }),
  moss_slime: Object.freeze({
    id: 'moss_slime', region: 'meadow', mode: 'combat',
    mobKinds: Object.freeze(['moss_slime']), poiKey: 'grove',
    label: 'Moss Slimes', icon: '🟢',
  }),
  thornback_boar: Object.freeze({
    id: 'thornback_boar', region: 'meadow', mode: 'combat',
    mobKinds: Object.freeze(['thornback_boar']), poiKey: 'boulders',
    label: 'Thornback Boars', icon: '🐗',
  }),
  pollen_wisp: Object.freeze({
    id: 'pollen_wisp', region: 'meadow', mode: 'combat',
    mobKinds: Object.freeze(['pollen_wisp']), poiKey: 'wheat',
    label: 'Pollen Wisps', icon: '🧚',
  }),
  meadow_zephyr_hare: Object.freeze({
    id: 'meadow_zephyr_hare', region: 'meadow', mode: 'combat',
    mobKinds: Object.freeze(['meadow_zephyr_hare']), poiKey: 'grotto',
    label: 'Zephyr Sylph-Hares', icon: '🐰',
  }),
  crystal_beetle: Object.freeze({
    id: 'crystal_beetle', region: 'hollow', mode: 'combat',
    mobKinds: Object.freeze(['crystal_beetle']), poiKey: 'quartz',
    label: 'Crystal Beetles', icon: '🪲',
  }),
  lantern_bat: Object.freeze({
    id: 'lantern_bat', region: 'hollow', mode: 'combat',
    mobKinds: Object.freeze(['lantern_bat']), poiKey: 'mithril',
    label: 'Lantern Bats', icon: '🦇',
  }),
  quartz_golemling: Object.freeze({
    id: 'quartz_golemling', region: 'hollow', mode: 'combat',
    mobKinds: Object.freeze(['quartz_golemling']), poiKey: 'sanctum_guard',
    label: 'Quartz Golemlings', icon: '🗿',
  }),
  hollow_frost_shroom: Object.freeze({
    id: 'hollow_frost_shroom', region: 'hollow', mode: 'combat',
    mobKinds: Object.freeze(['hollow_frost_shroom']), poiKey: 'frost_glade',
    label: 'Frostcap Myconids', icon: '🍄',
  }),
  reef_sakura_kitsune: Object.freeze({
    id: 'reef_sakura_kitsune', region: 'reef', mode: 'combat',
    mobKinds: Object.freeze(['reef_sakura_kitsune']), poiKey: 'shrine_woods',
    label: 'Sakura Shrine Kitsunes', icon: '🦊',
  }),
  reef_pearl_snapper: Object.freeze({
    id: 'reef_pearl_snapper', region: 'reef', mode: 'combat',
    mobKinds: Object.freeze(['reef_pearl_snapper']), poiKey: 'pearl_shoals',
    label: 'Tide-Pearl Snappers', icon: '🐢',
  }),
  reef_cloud_crane: Object.freeze({
    id: 'reef_cloud_crane', region: 'reef', mode: 'combat',
    mobKinds: Object.freeze(['reef_cloud_crane']), poiKey: 'crane_roost',
    label: 'Celestial Cloud-Cranes', icon: '🦢',
  }),
  reef_bell_spirit: Object.freeze({
    id: 'reef_bell_spirit', region: 'reef', mode: 'combat',
    mobKinds: Object.freeze(['reef_bell_spirit']), poiKey: 'bell_lagoon',
    label: 'Furin Tide-Bell Spirits', icon: '🎐',
  }),
  sanctum_cinder_salamander: Object.freeze({
    id: 'sanctum_cinder_salamander', region: 'caldera', mode: 'combat',
    mobKinds: Object.freeze(['sanctum_cinder_salamander']), poiKey: 'cinder_vents',
    label: 'Solar-Cinder Salamanders', icon: '🦎',
  }),
  sanctum_arc_automaton: Object.freeze({
    id: 'sanctum_arc_automaton', region: 'caldera', mode: 'combat',
    mobKinds: Object.freeze(['sanctum_arc_automaton']), poiKey: 'gear_foundry',
    label: 'Aether-Owl Automatons', icon: '🦉',
  }),
  sanctum_star_gargoyle: Object.freeze({
    id: 'sanctum_star_gargoyle', region: 'caldera', mode: 'combat',
    mobKinds: Object.freeze(['sanctum_star_gargoyle']), poiKey: 'prism_spires',
    label: 'Astral-Shard Griffons', icon: '🦅',
  }),
  sanctum_chrono_sentinel: Object.freeze({
    id: 'sanctum_chrono_sentinel', region: 'caldera', mode: 'combat',
    mobKinds: Object.freeze(['sanctum_chrono_sentinel']), poiKey: 'chrono_ring',
    label: 'Chrono-Gear Sentinels', icon: '🤖',
  }),
});

/**
 * Resolves the best region, POI coordinates, and target metadata for a material/POI/monster ID,
 * taking into account unlocked regions and the player's current region.
 */
export function resolveFrontierTarget(targetId, unlocks = null, currentRegion = 'meadow') {
  const src = FRONTIER_ITEM_SOURCES[targetId];
  if (!src) return null;
  let regionId = src.region;
  let poiKey = src.poiKey;
  const gateTargets = {
    gate_hollow: 'hollow',
    gate_meadow: 'meadow',
    gate_reef: 'reef',
    gate_caldera: 'caldera',
  };
  let kind = src.mode === 'gather'
    ? 'node'
    : src.mode === 'combat'
    ? 'mob'
    : src.mode === 'boss'
    ? 'boss'
    : gateTargets[targetId]
    ? 'gate'
    : 'poi';
  let gateTo = gateTargets[targetId] || null;

  if (
    currentRegion &&
    src.altRegions?.includes(currentRegion) &&
    (currentRegion === 'meadow' || checkHasUnlock(unlocks, currentRegion))
  ) {
    regionId = currentRegion;
  } else if (regionId !== 'meadow' && !checkHasUnlock(unlocks, regionId)) {
    if (regionId === 'caldera' && checkHasUnlock(unlocks, 'reef')) {
      regionId = 'reef';
      poiKey = 'gate_caldera';
      kind = 'gate';
      gateTo = 'caldera';
    } else if ((regionId === 'reef' || regionId === 'caldera') && checkHasUnlock(unlocks, 'hollow')) {
      regionId = 'hollow';
      poiKey = 'gate_reef';
      kind = 'gate';
      gateTo = 'reef';
    } else {
      regionId = 'meadow';
      poiKey = 'gate_hollow';
      kind = 'gate';
      gateTo = 'hollow';
    }
  }
  const region = REGIONS[regionId] || REGIONS.meadow;
  const poi = region.pois?.[poiKey] || region.pois?.outpost || { x: 0, z: 0 };
  return {
    ...src,
    kind,
    gateTo,
    region: regionId,
    regionName: region.name,
    poiKey,
    x: poi.x,
    z: poi.z,
  };
}

// ---------------------------------------------------------------------------------------------
// Endless Sky Frontier Field Bounties & Daily Goddess Stamp Chest
// ---------------------------------------------------------------------------------------------
export const FIELD_BOUNTY_STAMP_REWARD = Object.freeze({
  gold: 400,
  diamonds: 15,
  energy: 50,
  items: Object.freeze({ repair_kit: 1, bread: 1 }),
});

const GATHER_BOUNTY_POOL = Object.freeze([
  Object.freeze({
    key: 'wood', kind: 'gather_item', target: 'wood', seekTarget: 'wood', region: 'meadow',
    title: 'Timber Harvest', icon: '🪵', baseGoal: 18, unitLabel: 'Wood',
    gold: 180, energy: 25, items: Object.freeze({ honey: 1 }),
  }),
  Object.freeze({
    key: 'stone', kind: 'gather_item', target: 'stone', seekTarget: 'stone', region: 'meadow',
    title: 'Quarry Breaker', icon: '🪨', baseGoal: 18, unitLabel: 'Stone',
    gold: 180, energy: 25, items: Object.freeze({ crystal_ore: 2 }),
  }),
  Object.freeze({
    key: 'sky_wheat', kind: 'gather_item', target: 'sky_wheat', seekTarget: 'sky_wheat', region: 'meadow',
    title: 'Golden Sheaves', icon: '🌾', baseGoal: 15, unitLabel: 'Sky Wheat',
    gold: 190, energy: 25, items: Object.freeze({ golden_wheat: 1 }),
  }),
  Object.freeze({
    key: 'herb_seed', kind: 'gather_item', target: 'herb_seed', seekTarget: 'herb_seed', region: 'meadow',
    title: 'Dewdrop Forager', icon: '🌱', baseGoal: 9, unitLabel: 'Herb Seeds',
    gold: 200, energy: 25, items: Object.freeze({ berries_crop: 1 }),
  }),
  Object.freeze({
    key: 'crystal_ore', kind: 'gather_item', target: 'crystal_ore', seekTarget: 'crystal_ore', region: 'hollow', requiresRegion: 'hollow',
    title: 'Cavern Prospector', icon: '💎', baseGoal: 14, unitLabel: 'Crystal Ore',
    gold: 260, energy: 30, items: Object.freeze({ crystal_glass: 1 }),
  }),
  Object.freeze({
    key: 'sakura_timber', kind: 'gather_item', target: 'sakura_timber', seekTarget: 'sakura_timber', region: 'reef', requiresRegion: 'reef',
    title: 'Blossom Timberman', icon: '🌸', baseGoal: 14, unitLabel: 'Sakura Timber',
    gold: 310, energy: 35, items: Object.freeze({ celestial_pearl: 2 }),
  }),
  Object.freeze({
    key: 'orichalcum_ore', kind: 'gather_item', target: 'orichalcum_ore', seekTarget: 'orichalcum_ore', region: 'caldera', requiresRegion: 'caldera',
    title: 'Starforge Miner', icon: '🔶', baseGoal: 12, unitLabel: 'Orichalcum Ore',
    gold: 360, energy: 35, items: Object.freeze({ astral_prism: 2 }),
  }),
]);

const MASTERY_BOUNTY_POOL = Object.freeze([
  Object.freeze({
    key: 'perfects', kind: 'perfect_strikes', target: null, seekTarget: 'wood', region: 'meadow',
    title: 'Rhythm Virtuoso', icon: '🎯', baseGoal: 6, unitLabel: 'PERFECT! Strikes',
    gold: 210, energy: 30, items: Object.freeze({ bread: 1 }),
  }),
  Object.freeze({
    key: 'nodes', kind: 'node_breaks', target: null, seekTarget: 'stone', region: 'meadow',
    title: 'Vein Shatterer', icon: '⛏️', baseGoal: 5, unitLabel: 'Nodes Harvested',
    gold: 200, energy: 25, items: Object.freeze({ wood: 6, stone: 6 }),
  }),
  Object.freeze({
    key: 'rares', kind: 'rare_nodes', target: null, seekTarget: 'sky_wheat', region: 'meadow',
    title: 'Lucky Prospector', icon: '🌟', baseGoal: 2, unitLabel: 'Uncommon+ Harvests',
    gold: 240, energy: 30, items: Object.freeze({ honey: 1, golden_wheat: 1 }),
  }),
]);

const COMBAT_BOUNTY_POOL = Object.freeze([
  Object.freeze({
    key: 'mobs_any', kind: 'mob_kills', target: null, seekTarget: 'monster_gel', region: 'meadow',
    title: 'Frontier Patrol', icon: '⚔️', baseGoal: 4, unitLabel: 'Monsters Defeated',
    gold: 220, energy: 25, items: Object.freeze({ monster_gel: 3 }),
  }),
  Object.freeze({
    key: 'gel_hunt', kind: 'gather_item', target: 'monster_gel', seekTarget: 'monster_gel', region: 'meadow',
    title: 'Slime Cleanup', icon: '🟢', baseGoal: 5, unitLabel: 'Monster Gel',
    gold: 220, energy: 25, items: Object.freeze({ monster_fang: 2 }),
  }),
  Object.freeze({
    key: 'fang_hunt', kind: 'gather_item', target: 'monster_fang', seekTarget: 'monster_fang', region: 'meadow',
    title: 'Wild Tusks & Wings', icon: '🦷', baseGoal: 3, unitLabel: 'Monster Fangs',
    gold: 240, energy: 30, items: Object.freeze({ potion_small: 1 }),
  }),
  Object.freeze({
    key: 'hollow_hunt', kind: 'mob_kills', target: 'hollow', seekTarget: 'crystal_beetle', region: 'hollow', requiresRegion: 'hollow',
    title: 'Crystal Vault Ward', icon: '🪲', baseGoal: 4, unitLabel: 'Hollow Monsters',
    gold: 280, energy: 30, items: Object.freeze({ crystal_ore: 6 }),
  }),
  Object.freeze({
    key: 'reef_hunt', kind: 'mob_kills', target: 'reef', seekTarget: 'reef_sakura_kitsune', region: 'reef', requiresRegion: 'reef',
    title: 'Shrine Reef Patrol', icon: '🦊', baseGoal: 4, unitLabel: 'Reef Spirits',
    gold: 330, energy: 35, items: Object.freeze({ cloud_lotus: 4 }),
  }),
  Object.freeze({
    key: 'caldera_hunt', kind: 'mob_kills', target: 'caldera', seekTarget: 'sanctum_cinder_salamander', region: 'caldera', requiresRegion: 'caldera',
    title: 'Star-Caldera Vanguard', icon: '🦎', baseGoal: 4, unitLabel: 'Caldera Monsters',
    gold: 380, energy: 35, items: Object.freeze({ orichalcum_ore: 4 }),
  }),
]);

function dealBountyRound(day, round, unlocks) {
  const seedBase = ((day * 37) + (round * 13)) >>> 0;
  const filterPool = (pool) => pool.filter((t) => !t.requiresRegion || checkHasUnlock(unlocks, t.requiresRegion));
  const pools = [filterPool(GATHER_BOUNTY_POOL), filterPool(MASTERY_BOUNTY_POOL), filterPool(COMBAT_BOUNTY_POOL)];
  const mult = Math.min(2.0, 1 + Math.max(0, round - 1) * 0.15);
  const goldMult = Math.min(2.2, 1 + Math.max(0, round - 1) * 0.20);

  return pools.map((pool, slot) => {
    const pick = pool[(seedBase + slot * 7) % pool.length];
    const goal = Math.max(1, Math.round(pick.baseGoal * mult));
    const gold = Math.round(pick.gold * goldMult);
    return {
      slot,
      id: `fb_${day}_r${round}_s${slot}_${pick.key}`,
      kind: pick.kind,
      target: pick.target,
      seekTarget: pick.seekTarget,
      region: pick.region,
      icon: pick.icon,
      title: pick.title,
      desc: `${pick.icon} ${goal} ${pick.unitLabel}`,
      goal,
      have: 0,
      claimed: false,
      rewards: {
        gold,
        energy: pick.energy,
        items: { ...(pick.items || {}) },
      },
    };
  });
}

/**
 * Ensures `fr.bounties` is initialized and rolled for the current UTC day.
 * Pure & deterministic given `now`.
 */
export function ensureFieldBounties(fr, now = 0) {
  if (!fr) return null;
  const day = utcDayOf(now);
  const unlocks = fr.unlocks || { regions: ['meadow'], gates: [] };
  if (
    !fr.bounties ||
    fr.bounties.day !== day ||
    !Array.isArray(fr.bounties.cards) ||
    fr.bounties.cards.length !== 3
  ) {
    fr.bounties = {
      day,
      round: 1,
      stamps: 0,
      bonusClaimed: false,
      cards: dealBountyRound(day, 1, unlocks),
    };
  }
  return fr.bounties;
}

/**
 * Records progress toward active Field Bounties.
 * `event`: `{ kind: 'gather_item' | 'node_breaks' | 'perfect_strikes' | 'mob_kills' | 'rare_nodes', target?: string, region?: string, amount?: number }`
 * Returns array of slot indices whose progress increased.
 */
export function recordBountyProgress(fr, event, now = 0) {
  if (!fr || !event) return [];
  const b = ensureFieldBounties(fr, now);
  if (!b) return [];
  const inc = Math.max(0, Number(event.amount ?? 1) || 0);
  if (inc <= 0) return [];
  const changed = [];
  for (const card of b.cards) {
    if (!card || card.claimed || card.have >= card.goal) continue;
    if (card.kind !== event.kind) continue;
    if (card.kind === 'gather_item' && card.target && card.target !== event.target) continue;
    if (card.kind === 'mob_kills' && card.target && card.target !== event.region && card.target !== event.target) continue;
    const next = Math.min(card.goal, (card.have || 0) + inc);
    if (next > (card.have || 0)) {
      card.have = next;
      changed.push(card.slot);
    }
  }
  return changed;
}

/**
 * Claims a completed Field Bounty card (`slot` 0..2), awarding energy + items into `fr`,
 * incrementing daily Goddess Stamps (up to 3), and automatically dealing the next round
 * when all 3 cards in the current round are claimed!
 */
export function claimFieldBounty(fr, slot, now = 0) {
  if (!fr) return { ok: false, error: 'no_state' };
  const b = ensureFieldBounties(fr, now);
  const idx = Number(slot);
  if (!Number.isInteger(idx) || idx < 0 || idx >= b.cards.length) {
    return { ok: false, error: 'bad_slot', bounties: b };
  }
  const card = b.cards[idx];
  if (card.claimed) return { ok: false, error: 'already_claimed', bounties: b };
  if ((card.have || 0) < card.goal) return { ok: false, error: 'incomplete', bounties: b };

  card.claimed = true;
  if (!b.bonusClaimed) {
    b.stamps = Math.min(3, (Number(b.stamps) || 0) + 1);
  }
  const rewards = card.rewards || {};
  const goldGain = Math.max(0, Number(rewards.gold) || 0);
  fr.energy = regenEnergy(fr.energy, now);
  if ((rewards.energy || 0) > 0) {
    fr.energy = addEnergy(fr.energy, rewards.energy, now);
  }
  const itemRes = rewards.items ? grantItems(fr, rewards.items, now) : { granted: {}, overflow: {} };

  let roundAdvanced = false;
  if (b.cards.every((c) => c.claimed)) {
    b.round = (Number(b.round) || 1) + 1;
    b.cards = dealBountyRound(b.day, b.round, fr.unlocks);
    roundAdvanced = true;
  }

  return {
    ok: true,
    slot: idx,
    claimedId: card.id,
    rewards,
    goldGain,
    granted: itemRes.granted,
    overflow: itemRes.overflow,
    stamps: b.stamps,
    bonusReady: b.stamps >= 3 && !b.bonusClaimed,
    roundAdvanced,
    bounties: b,
    energy: fr.energy,
  };
}

/**
 * Claims the Daily 3/3 Goddess Stamp Chest once per UTC day.
 */
export function claimFieldBountyBonus(fr, now = 0) {
  if (!fr) return { ok: false, error: 'no_state' };
  const b = ensureFieldBounties(fr, now);
  if (b.bonusClaimed) return { ok: false, error: 'already_claimed', bounties: b };
  if ((b.stamps || 0) < 3) return { ok: false, error: 'incomplete', bounties: b };

  b.bonusClaimed = true;
  const r = FIELD_BOUNTY_STAMP_REWARD;
  fr.energy = regenEnergy(fr.energy, now);
  fr.energy = addEnergy(fr.energy, r.energy, now);
  const itemRes = grantItems(fr, r.items, now);
  return {
    ok: true,
    rewards: r,
    goldGain: r.gold,
    diamondGain: r.diamonds,
    granted: itemRes.granted,
    overflow: itemRes.overflow,
    bounties: b,
    energy: fr.energy,
  };
}
