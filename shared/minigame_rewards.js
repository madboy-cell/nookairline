// shared/minigame_rewards.js — Minigame material rewards (§13 Master Plan v2).
// Pure module, zero I/O.
import { addItems } from './production_rules.js';
import { isMaterial } from './materials_catalog.js';

export const CAMP_CRATE_EXPIRE_MS = 24 * 60 * 60 * 1000;

/**
 * Grant items into profile stores (warehouse/pantry), routing overflow into campCrate.
 * @param {object} stores { warehouse, pantry }
 * @param {object} campCrate { items: {}, expiresAt: number }
 * @param {object} items { [itemId]: count }
 * @param {number} [now]
 * @returns {{ added: object, overflow: object }}
 */
export function grantMinigameItems(stores, campCrate, items, now = Date.now()) {
  if (!stores || !items || Object.keys(items).length === 0) {
    return { added: {}, overflow: {} };
  }
  const { added, overflow } = addItems(stores, items);
  if (campCrate && overflow && Object.keys(overflow).length > 0) {
    campCrate.items ||= {};
    if (campCrate.expiresAt > 0 && now >= campCrate.expiresAt) {
      campCrate.items = {};
      campCrate.expiresAt = 0;
    }
    for (const [id, n] of Object.entries(overflow)) {
      const count = Number(n) || 0;
      if (count > 0) {
        campCrate.items[id] = (campCrate.items[id] || 0) + count;
      }
    }
    campCrate.expiresAt = now + CAMP_CRATE_EXPIRE_MS;
  }
  return { added, overflow };
}

/**
 * Ensure profile frontier stores exist and grant minigame materials.
 */
export function grantProfileMinigameMaterials(p, items, now = Date.now()) {
  if (!p || !items || Object.keys(items).length === 0) {
    return { added: {}, overflow: {} };
  }
  p.frontier ||= {};
  p.frontier.warehouse ||= { lv: 1, items: {} };
  p.frontier.warehouse.items ||= {};
  p.frontier.pantry ||= { lv: 1, items: {} };
  p.frontier.pantry.items ||= {};
  p.frontier.campCrate ||= { items: {}, expiresAt: 0 };
  p.frontier.campCrate.items ||= {};

  const stores = { warehouse: p.frontier.warehouse, pantry: p.frontier.pantry };
  return grantMinigameItems(stores, p.frontier.campCrate, items, now);
}

// -----------------------------------------------------------------------------
// 1. Fishing (§13): minnow (fish 1), crab (fish 2), koi (fish 3), chest (ingot 2 + 10% ancient_gear 1)
// -----------------------------------------------------------------------------
export const FISHING_MATERIAL_REWARDS = Object.freeze({
  minnow: Object.freeze({ fish: 1 }),
  crab: Object.freeze({ fish: 2 }),
  koi: Object.freeze({ fish: 3 }),
  chest: Object.freeze({ ingot: 2 }),
});

export const FISHING_CHEST_ANCIENT_GEAR_CHANCE = 0.10;

export function fishingCatchMaterials(catchKey, rng = Math.random) {
  if (catchKey === 'minnow') return { fish: 1 };
  if (catchKey === 'crab') return { fish: 2 };
  if (catchKey === 'koi') return { fish: 3 };
  if (catchKey === 'chest') {
    const mats = { ingot: 2 };
    if (typeof rng === 'function' && rng() < FISHING_CHEST_ANCIENT_GEAR_CHANCE) {
      mats.ancient_gear = 1;
    }
    return mats;
  }
  return {};
}

// -----------------------------------------------------------------------------
// 2. Cloud Dash (§13): feather = clamp(floor(distance or score/…), 1, 12), cloud_silk 1–4
// -----------------------------------------------------------------------------
export function cloudDashMaterials({ place = 1, distance = 0, style = 0 } = {}) {
  // distance (m, runner s ~0..1000+) scales by 100, or fallback to style (~0..12000+) by 1000
  const metric = distance > 0 ? (distance / 100) : (style > 0 ? style / 1000 : 1);
  const feather = Math.max(1, Math.min(12, Math.floor(metric) || 1));
  const p = Math.max(1, Number(place) || 1);
  const cloud_silk = Math.max(1, Math.min(4, 5 - p));
  return { feather, cloud_silk };
}

// -----------------------------------------------------------------------------
// 3. Monopoly (§13): Merchant Crate (winner {plank:6, ingot:3, flour:4}, 2nd {plank:4, ingot:2, flour:2}, others {plank:2, flour:2})
// -----------------------------------------------------------------------------
export const MONOPOLY_MERCHANT_CRATES = Object.freeze({
  winner: Object.freeze({ plank: 6, ingot: 3, flour: 4 }),
  second: Object.freeze({ plank: 4, ingot: 2, flour: 2 }),
  others: Object.freeze({ plank: 2, flour: 2 }),
});

export function monopolyMerchantCrate(rank) {
  const r = Number(rank) || 1;
  if (r === 1) return { ...MONOPOLY_MERCHANT_CRATES.winner };
  if (r === 2) return { ...MONOPOLY_MERCHANT_CRATES.second };
  return { ...MONOPOLY_MERCHANT_CRATES.others };
}

// -----------------------------------------------------------------------------
// 4. Casino (§13): weekly-capped material exchange (max 20/week)
//    Items: { herb_seed: 200 chips, honey: 150, sky_wheat: 50 (x5), berries_crop: 50 (x5) }
// -----------------------------------------------------------------------------
export const CASINO_MATERIAL_EXCHANGES = Object.freeze({
  herb_seed: Object.freeze({ item: 'herb_seed', cost: 200, count: 1 }),
  honey: Object.freeze({ item: 'honey', cost: 150, count: 1 }),
  sky_wheat: Object.freeze({ item: 'sky_wheat', cost: 50, count: 5 }),
  berries_crop: Object.freeze({ item: 'berries_crop', cost: 50, count: 5 }),
});

export const CASINO_MATERIAL_WEEKLY_CAP = 20;

export function getIsoWeek(dateOrMs = Date.now()) {
  const d = new Date(dateOrMs);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export function validateCasinoMaterialExchange(p, itemKey, now = Date.now()) {
  const offer = CASINO_MATERIAL_EXCHANGES[itemKey];
  if (!offer) return { ok: false, error: 'invalid_item' };

  const currentWeek = getIsoWeek(now);
  p.casino_mat ||= { week: currentWeek, n: 0 };
  if (p.casino_mat.week !== currentWeek) {
    p.casino_mat = { week: currentWeek, n: 0 };
  }

  if (p.casino_mat.n >= CASINO_MATERIAL_WEEKLY_CAP) {
    return { ok: false, error: 'weekly_cap_reached', week: currentWeek, n: p.casino_mat.n };
  }

  const useChips = typeof p.casino_chips === 'number';
  const currency = useChips ? 'chips' : 'gold';
  const balance = useChips ? p.casino_chips : (p.gold || 0);

  if (balance < offer.cost) {
    return { ok: false, error: useChips ? 'insufficient_chips' : 'insufficient_gold', cost: offer.cost, balance };
  }

  return { ok: true, offer, currency, useChips, currentWeek };
}

export function executeCasinoMaterialExchange(p, itemKey, now = Date.now()) {
  const check = validateCasinoMaterialExchange(p, itemKey, now);
  if (!check.ok) return check;

  const { offer, useChips, currency, currentWeek } = check;

  if (useChips) {
    p.casino_chips -= offer.cost;
  } else {
    p.gold = (p.gold || 0) - offer.cost;
  }

  p.casino_mat.n = (p.casino_mat.n || 0) + 1;

  const itemsToGrant = { [offer.item]: offer.count };
  const grantRes = grantProfileMinigameMaterials(p, itemsToGrant, now);

  return {
    ok: true,
    item: offer.item,
    count: offer.count,
    cost: offer.cost,
    currency,
    week: currentWeek,
    exchangesThisWeek: p.casino_mat.n,
    remainingExchanges: Math.max(0, CASINO_MATERIAL_WEEKLY_CAP - p.casino_mat.n),
    materials: itemsToGrant,
    granted: grantRes.added,
    overflow: grantRes.overflow,
  };
}
