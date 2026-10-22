// shared/couple_rules.js — Twin Isles + Heart Isle pure couple rules.
// Master Plan v2 §12 "Couples: Twin Isles + Heart Isle"
// Pure module, zero I/O, no Date.now(): callers pass `now`.

import { isSendableToPartner, MATERIALS } from './materials_catalog.js';

export const HEART_ISLE = Object.freeze({
  size: 20,
  fixed: Object.freeze(['love_pavilion', 'shared_chest']),
  decor: Object.freeze([
    'heart_arch',
    'twin_lanterns',
    'photo_booth',
    'rose_hedge',
    'wisteria_pergola',
    'couple_bench',
  ]),
  biome: 'biome_rose_garden',
});

export const DECOR_FOOTPRINTS = Object.freeze({
  dec_nookairline_museum: Object.freeze({ w: 2, h: 2 }),
  wisteria_pergola: Object.freeze({ w: 2, h: 2 }),
  photo_booth: Object.freeze({ w: 2, h: 2 }),
});

export const FORMATION = Object.freeze({
  MIN_FRIEND_DAYS: 3,
  SPLIT_COOLDOWN_MS: 72 * 3600e3,
});

export const DAILY_SEND_RAMP = Object.freeze([50, 100, 200, 400, 800, 1600, 3200]);

const DAY_MS = 24 * 3600 * 1000;

/**
 * Footprint of allowed Heart Isle decor.
 * Museum, pergola, and photo_booth are 2x2; others are 1x1.
 */
export function decorFootprint(type) {
  return DECOR_FOOTPRINTS[type] || { w: 1, h: 1 };
}

/**
 * Returns true if the decor type is valid for Heart Isle placement.
 * Allowed: HEART_ISLE.decor items or 'dec_nookairline_museum' (protected Memory Landmark).
 */
export function isDecorAllowed(type) {
  return type === 'dec_nookairline_museum' || HEART_ISLE.decor.includes(type);
}

/**
 * Heart Isle ID deterministically derived from sorted user IDs.
 */
export function heartIsleId(a, b) {
  const sorted = [String(a), String(b)].sort();
  return `heart:${sorted[0]}:${sorted[1]}`;
}

/**
 * Returns a fresh Heart Isle data structure for two partners.
 */
export function defaultHeartIsle(a, b, now = 0) {
  const owners = [String(a), String(b)].sort();
  return {
    id: heartIsleId(a, b),
    owners,
    createdAt: now,
    layout: {
      decor: [],
    },
    storage: {
      items: {},
      ledger: {
        [owners[0]]: {},
        [owners[1]]: {},
      },
    },
    monuments: {},
    frozen: false,
    frozenAt: 0,
  };
}

/**
 * Validates couple formation eligibility.
 * Requires MIN_FRIEND_DAYS friendship.
 * Requires SPLIT_COOLDOWN_MS cooldown after a split unless re-coupling with the same ex.
 */
export function canFormCouple({ friendSince, now, lastSplitAt, sameAsEx = false } = {}) {
  const minFriendMs = FORMATION.MIN_FRIEND_DAYS * DAY_MS;
  if (friendSince == null || (now - friendSince) < minFriendMs) {
    return { ok: false, error: 'too_soon_friends' };
  }
  if (!sameAsEx && lastSplitAt != null && (now - lastSplitAt) < FORMATION.SPLIT_COOLDOWN_MS) {
    return { ok: false, error: 'cooldown' };
  }
  return { ok: true };
}

/**
 * Returns the daily mailbox send cap based on days elapsed since couple formation.
 * Day 0: 50, Day 1: 100, ..., Day 6: 3200, Day >= 7: Infinity.
 */
export function dailySendCap(coupleSince, now) {
  if (coupleSince == null || now == null) return DAILY_SEND_RAMP[0];
  const elapsedMs = Math.max(0, now - coupleSince);
  const day = Math.floor(elapsedMs / DAY_MS);
  if (day >= 7) return Infinity;
  return DAILY_SEND_RAMP[day];
}

/**
 * Internal helper to normalize item entries from object or array format.
 */
function getItemEntries(items) {
  if (!items) return [];
  if (Array.isArray(items)) {
    return items.map((it) => [it.id || it.item || it.type, it.count ?? it.n ?? it.amount ?? 1]);
  }
  return Object.entries(items);
}

/**
 * Validates whether an item payload can be sent to a couple partner.
 * Rejects gold and rare-tier items.
 * Validates against the daily send cap ramp.
 */
export function canSend({ items, coupleSince, now, sentToday = 0 } = {}) {
  const cap = dailySendCap(coupleSince, now);
  const sent = Math.max(0, Number(sentToday) || 0);
  const remainingAvailable = cap === Infinity ? Infinity : Math.max(0, cap - sent);

  const entries = getItemEntries(items);
  let totalUnits = 0;

  for (const [id, rawQty] of entries) {
    const qty = Math.max(0, Number(rawQty) || 0);
    if (qty <= 0) continue;

    // Gold is not a material, and rare-tier items cannot be sent
    if (id === 'gold' || !isSendableToPartner(id)) {
      return {
        ok: false,
        error: 'not_sendable',
        cap,
        remaining: remainingAvailable,
      };
    }
    totalUnits += qty;
  }

  if (totalUnits > remainingAvailable) {
    return {
      ok: false,
      error: 'cap',
      cap,
      remaining: remainingAvailable,
    };
  }

  const remainingAfter = cap === Infinity ? Infinity : Math.max(0, remainingAvailable - totalUnits);

  return {
    ok: true,
    cap,
    remaining: remainingAfter,
  };
}

/**
 * Checks if a user is an owner of the isle and the isle is not frozen.
 */
export function editAllowed(isle, userId) {
  if (!isle || !userId) return false;
  if (isle.frozen) return false;
  return Array.isArray(isle.owners) && isle.owners.includes(userId);
}

/**
 * Atomic deposit into shared storage.
 * Records deposit in the depositor's ledger.
 * Optional takeFn(items) to deduct from the player's personal inventory.
 */
export function deposit(isle, userId, items, takeFn = null) {
  if (isle?.frozen) {
    return { ok: false, error: 'frozen' };
  }
  if (!Array.isArray(isle?.owners) || !isle.owners.includes(userId)) {
    return { ok: false, error: 'not_owner' };
  }

  const entries = getItemEntries(items);
  const validEntries = [];
  for (const [id, rawQty] of entries) {
    const qty = Math.max(0, Number(rawQty) || 0);
    if (qty > 0) validEntries.push([id, qty]);
  }

  if (validEntries.length === 0) {
    return { ok: true, storage: isle.storage };
  }

  if (typeof takeFn === 'function') {
    try {
      const res = takeFn(items);
      if (res === false || (res && res.ok === false)) {
        return { ok: false, error: res?.error || 'take_failed' };
      }
    } catch (err) {
      return { ok: false, error: err.message || 'take_failed' };
    }
  }

  isle.storage ||= { items: {}, ledger: {} };
  isle.storage.items ||= {};
  isle.storage.ledger ||= {};
  isle.storage.ledger[userId] ||= {};

  for (const [id, qty] of validEntries) {
    isle.storage.items[id] = (isle.storage.items[id] || 0) + qty;
    isle.storage.ledger[userId][id] = (isle.storage.ledger[userId][id] || 0) + qty;
  }

  return { ok: true, storage: isle.storage };
}

/**
 * Atomic withdrawal from shared storage.
 * Anyone can withdraw; reduces the withdrawer's ledger first, then the partner's.
 * Optional addFn(items) to add items to the player's personal inventory.
 */
export function withdraw(isle, userId, items, addFn = null) {
  if (isle?.frozen) {
    return { ok: false, error: 'frozen' };
  }
  if (!Array.isArray(isle?.owners) || !isle.owners.includes(userId)) {
    return { ok: false, error: 'not_owner' };
  }

  const entries = getItemEntries(items);
  const validEntries = [];
  for (const [id, rawQty] of entries) {
    const qty = Math.max(0, Number(rawQty) || 0);
    if (qty > 0) validEntries.push([id, qty]);
  }

  if (validEntries.length === 0) {
    return { ok: true, storage: isle.storage };
  }

  isle.storage ||= { items: {}, ledger: {} };
  isle.storage.items ||= {};
  isle.storage.ledger ||= {};

  // 1. Verify availability of all items
  for (const [id, qty] of validEntries) {
    const available = isle.storage.items[id] || 0;
    if (available < qty) {
      return {
        ok: false,
        error: 'insufficient_items',
        item: id,
        requested: qty,
        available,
      };
    }
  }

  // 2. Add callback
  if (typeof addFn === 'function') {
    try {
      const res = addFn(items);
      if (res === false || (res && res.ok === false)) {
        return { ok: false, error: res?.error || 'add_failed' };
      }
    } catch (err) {
      return { ok: false, error: err.message || 'add_failed' };
    }
  }

  // 3. Deduct from storage and reduce ledger
  const partnerId = isle.owners.find((o) => o !== userId);
  isle.storage.ledger[userId] ||= {};
  if (partnerId) {
    isle.storage.ledger[partnerId] ||= {};
  }

  for (const [id, qty] of validEntries) {
    isle.storage.items[id] -= qty;
    if (isle.storage.items[id] <= 0) {
      delete isle.storage.items[id];
    }

    let rem = qty;
    const myDeposits = isle.storage.ledger[userId]?.[id] || 0;
    const myDeduct = Math.min(myDeposits, rem);
    if (myDeduct > 0) {
      isle.storage.ledger[userId][id] -= myDeduct;
      rem -= myDeduct;
    }

    if (rem > 0 && partnerId) {
      const partnerDeposits = isle.storage.ledger[partnerId]?.[id] || 0;
      const partnerDeduct = Math.min(partnerDeposits, rem);
      if (partnerDeduct > 0) {
        isle.storage.ledger[partnerId][id] -= partnerDeduct;
        rem -= partnerDeduct;
      }
    }
  }

  return { ok: true, storage: isle.storage };
}

/**
 * Splits a couple's shared storage and freezes Heart Isle as a Memory Isle.
 * Each item is split by the ledger proportion:
 * - A sole depositor gets theirs back.
 * - If the ledger is empty for an item, split 50/50.
 * - Odd units go to the larger depositor; ties broken by userId sort order.
 * - Shared storage is emptied.
 */
export function splitCouple(isle, now = 0) {
  const owners = [...(isle.owners || [])].sort();
  const [u0, u1] = owners;
  const shares = {
    [u0]: {},
    [u1]: {},
  };

  const items = isle.storage?.items || {};
  const ledger = isle.storage?.ledger || {};

  for (const [item, rawQty] of Object.entries(items)) {
    const qty = Math.max(0, Number(rawQty) || 0);
    if (qty <= 0) continue;

    const dep0 = Math.max(0, Number(ledger?.[u0]?.[item]) || 0);
    const dep1 = Math.max(0, Number(ledger?.[u1]?.[item]) || 0);
    const totalDep = dep0 + dep1;

    let s0 = 0;
    let s1 = 0;

    if (totalDep === 0) {
      s0 = Math.floor(qty / 2);
      s1 = Math.floor(qty / 2);
      const rem = qty - (s0 + s1);
      if (rem > 0) {
        s0 += rem;
      }
    } else {
      s0 = Math.floor((qty * dep0) / totalDep);
      s1 = Math.floor((qty * dep1) / totalDep);
      const rem = qty - (s0 + s1);
      if (rem > 0) {
        if (dep0 > dep1) {
          s0 += rem;
        } else if (dep1 > dep0) {
          s1 += rem;
        } else {
          s0 += rem;
        }
      }
    }

    if (s0 > 0) shares[u0][item] = s0;
    if (s1 > 0) shares[u1][item] = s1;
  }

  isle.storage = {
    items: {},
    ledger: {
      [u0]: {},
      [u1]: {},
    },
  };

  isle.frozen = true;
  isle.frozenAt = now;

  return {
    shares,
    isle,
  };
}

/**
 * Unfreezes a Heart Isle when the original owners re-couple.
 */
export function restoreHeartIsle(isle, now = 0) {
  if (!isle) return null;
  isle.frozen = false;
  isle.frozenAt = 0;
  isle.restoredAt = now;
  return isle;
}

/**
 * Places decor on Heart Isle.
 * Validates type against allowed decor and Memory Landmark 'dec_nookairline_museum'.
 * Checks grid bounds (size 20) and footprint (2x2 for museum, pergola, photo_booth; 1x1 others).
 * Rejects on overlap or when the isle is frozen.
 */
export function placeDecor(isle, userId, { type, x, y } = {}) {
  if (isle?.frozen) {
    return { ok: false, error: 'frozen' };
  }
  if (!editAllowed(isle, userId)) {
    return { ok: false, error: 'not_owner' };
  }
  if (!isDecorAllowed(type)) {
    return { ok: false, error: 'invalid_type' };
  }
  if (!Number.isInteger(x) || !Number.isInteger(y)) {
    return { ok: false, error: 'bad_coords' };
  }

  const fp = decorFootprint(type);
  if (x < 0 || y < 0 || x + fp.w > HEART_ISLE.size || y + fp.h > HEART_ISLE.size) {
    return { ok: false, error: 'out_of_bounds' };
  }

  isle.layout ||= { decor: [] };
  isle.layout.decor ||= [];

  for (const d of isle.layout.decor) {
    const dfp = decorFootprint(d.type);
    const overlap = x < d.x + dfp.w && x + fp.w > d.x && y < d.y + dfp.h && y + fp.h > d.y;
    if (overlap) {
      return { ok: false, error: 'overlap', conflicting: d };
    }
  }

  const decorItem = {
    id: `${type}_${x}_${y}`,
    type,
    x,
    y,
    placedBy: userId,
  };

  isle.layout.decor.push(decorItem);
  return { ok: true, decor: decorItem, layout: isle.layout };
}

/**
 * Removes decor from Heart Isle.
 * Accepts an id string, an object with id, or an object with { x, y } coordinates.
 */
export function removeDecor(isle, userId, identifier) {
  if (isle?.frozen) {
    return { ok: false, error: 'frozen' };
  }
  if (!editAllowed(isle, userId)) {
    return { ok: false, error: 'not_owner' };
  }

  isle.layout ||= { decor: [] };
  isle.layout.decor ||= [];

  let idx = -1;
  if (typeof identifier === 'string') {
    idx = isle.layout.decor.findIndex((d) => d.id === identifier || d.type === identifier);
  } else if (identifier && typeof identifier === 'object') {
    if (identifier.id) {
      idx = isle.layout.decor.findIndex((d) => d.id === identifier.id);
    } else if (Number.isInteger(identifier.x) && Number.isInteger(identifier.y)) {
      idx = isle.layout.decor.findIndex((d) => {
        const dfp = decorFootprint(d.type);
        return (
          identifier.x >= d.x &&
          identifier.x < d.x + dfp.w &&
          identifier.y >= d.y &&
          identifier.y < d.y + dfp.h
        );
      });
    }
  }

  if (idx === -1) {
    return { ok: false, error: 'not_found' };
  }

  const [removed] = isle.layout.decor.splice(idx, 1);
  return { ok: true, removed, layout: isle.layout };
}
