// shared/order_rules.js — NPC Order Board & Big Order pure rules.
// Master Plan v2 §11.2 "Order Board"
// Pure module, zero I/O, no Date.now(): takes `now` and `rng` as parameters.

export const ITEM_VALUE = Object.freeze({
  flour: 12,
  bread: 30,
  honey_bun: 55,
  fish_pie: 90,
  berry_tart: 60,
  boba_tea: 40,
  golden_croissant: 220,
  ingot: 45,
  crystal_glass: 60,
  plank: 15,
  thread: 50,
  herb: 20,
  potion_small: 70,
  repair_kit: 140,
  pet_treat: 45,
  sky_wheat: 4,
  berries_crop: 5,
});

export const ORDER_CFG = Object.freeze({
  SLOTS_BASE: 3,
  SLOTS_COURIER: 6,
  REFRESH_MS: 5 * 60 * 1000,
  BIG_ORDER_ITEMS: Object.freeze([3, 5]),
  BIG_ORDER_MULT: 2.5,
  XP_PER_GOLD: 0.1,
});

export const NPC_NAMES = Object.freeze([
  'Baker Mira',
  'Old Tomas',
  'Courier Pip',
  'Sister Lene',
  'Smith Bram',
]);

/**
 * Utility clamp.
 */
export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

/**
 * Calculate quantity (1–6) weighted by item value:
 * Cheaper items roll larger quantities (up to 6), expensive items roll smaller quantities (down to 1).
 */
export function calculateItemQty(value, rng = Math.random) {
  const v = Math.max(1, Number(value) || 1);
  // Normalize value on log2 scale between 4 (cheapest) and 220 (most expensive)
  const normalized = clamp(Math.log2(v / 4) / Math.log2(220 / 4), 0, 1);
  // Expected base ranges from 5.5 (cheap) down to 1.0 (expensive)
  const expected = 5.5 - normalized * 4.5;
  const jitter = (rng() - 0.5) * 1.8;
  return clamp(Math.round(expected + jitter), 1, 6);
}

/**
 * Extract list of candidate item ids that are unlocked AND present in ITEM_VALUE.
 */
function getEligibleItems(unlockedItems) {
  if (!unlockedItems) return [];
  const list = Array.isArray(unlockedItems)
    ? unlockedItems
    : (unlockedItems instanceof Set ? Array.from(unlockedItems) : Object.keys(unlockedItems));

  return list.filter((it) => {
    if (typeof it !== 'string') return false;
    if (typeof ITEM_VALUE[it] !== 'number') return false;
    if (unlockedItems && typeof unlockedItems === 'object' && !Array.isArray(unlockedItems) && !(unlockedItems instanceof Set)) {
      return Boolean(unlockedItems[it]);
    }
    return true;
  });
}

/**
 * Generate a regular NPC order.
 * Picks 1–3 distinct items from unlockedItems that have an ITEM_VALUE.
 * Returns { id, npc, items: {}, gold, xp, extra: {}, createdAt: now }, or null if nothing is unlocked.
 */
export function generateOrder({
  unlockedItems,
  rng = Math.random,
  now = 0,
  id,
  npc,
} = {}) {
  const roll = rng;
  const time = typeof now === 'number' ? now : 0;
  const eligible = getEligibleItems(unlockedItems);
  if (eligible.length === 0) return null;

  const targetCount = clamp(1 + Math.floor(roll() * 3), 1, eligible.length);
  const pool = [...eligible];
  const chosen = [];
  for (let i = 0; i < targetCount && pool.length > 0; i++) {
    const idx = Math.floor(roll() * pool.length);
    chosen.push(pool.splice(idx, 1)[0]);
  }

  const items = {};
  let baseValue = 0;
  for (const item of chosen) {
    const qty = calculateItemQty(ITEM_VALUE[item], roll);
    items[item] = qty;
    baseValue += ITEM_VALUE[item] * qty;
  }

  const gold = Math.round(baseValue * 1.25);
  const xp = Math.round(gold * ORDER_CFG.XP_PER_GOLD);

  // 15% chance of bonus extra from ['herb_seed', 'ancient_gear']
  // ancient_gear only 3% of the time, qty 1; herb_seed qty 2 (12% of the time).
  const extra = {};
  const extraRoll = roll();
  if (extraRoll < 0.03) {
    extra.ancient_gear = 1;
  } else if (extraRoll < 0.15) {
    extra.herb_seed = 2;
  }

  const chosenNpc = npc || NPC_NAMES[Math.floor(roll() * NPC_NAMES.length)] || NPC_NAMES[0];
  const orderId = id || `ord_${time}_${Math.floor(roll() * 1e6).toString(36)}`;

  return {
    id: orderId,
    npc: chosenNpc,
    items,
    gold,
    xp,
    extra,
    createdAt: time,
  };
}

/**
 * Generate today's Big Order.
 * 3–5 distinct items, gold × BIG_ORDER_MULT, contributors: {}, day.
 */
export function generateBigOrder({
  unlockedItems,
  rng = Math.random,
  now = 0,
  day = 0,
  id,
} = {}) {
  const roll = rng;
  const time = typeof now === 'number' ? now : 0;
  const eligible = getEligibleItems(unlockedItems);
  if (eligible.length === 0) return null;

  const minCount = Math.min(ORDER_CFG.BIG_ORDER_ITEMS[0], eligible.length);
  const maxCount = Math.min(ORDER_CFG.BIG_ORDER_ITEMS[1], eligible.length);
  const targetCount = minCount === maxCount
    ? minCount
    : minCount + Math.floor(roll() * (maxCount - minCount + 1));

  const pool = [...eligible];
  const chosen = [];
  for (let i = 0; i < targetCount && pool.length > 0; i++) {
    const idx = Math.floor(roll() * pool.length);
    chosen.push(pool.splice(idx, 1)[0]);
  }

  const items = {};
  let baseValue = 0;
  for (const item of chosen) {
    const qty = calculateItemQty(ITEM_VALUE[item], roll);
    items[item] = qty;
    baseValue += ITEM_VALUE[item] * qty;
  }

  const baseGold = Math.round(baseValue * 1.25);
  const gold = Math.round(baseGold * ORDER_CFG.BIG_ORDER_MULT);
  const xp = Math.round(gold * ORDER_CFG.XP_PER_GOLD);

  return {
    id: id || `big_${day}`,
    day,
    items,
    fulfilled: {},
    remaining: { ...items },
    contributors: {},
    gold,
    xp,
    complete: false,
    createdAt: time,
  };
}

/**
 * Fill a regular order atomically.
 * Checks hasItemsFn(order.items), if true calls takeItemsFn(order.items).
 */
export function fillOrder(order, hasItemsFn, takeItemsFn) {
  if (!order || !order.items) {
    return { ok: false, error: 'missing_items' };
  }
  if (typeof hasItemsFn === 'function' && !hasItemsFn(order.items)) {
    return { ok: false, error: 'missing_items' };
  }
  if (typeof takeItemsFn === 'function') {
    takeItemsFn(order.items);
  }
  return { ok: true };
}

/**
 * Check whether a Big Order is completely fulfilled.
 */
export function isBigOrderComplete(big) {
  if (!big || !big.items) return false;
  if (big.complete) return true;
  const fulfilled = big.fulfilled || {};
  for (const [itemId, required] of Object.entries(big.items)) {
    if ((fulfilled[itemId] || 0) < required) return false;
  }
  return true;
}

/**
 * Contribute items to a Big Order.
 * Caps items at what's still needed. Takes atomically.
 * Returns { ok, contributed, complete }.
 */
export function contributeBigOrder(big, userId, items, hasItemsFn, takeItemsFn) {
  if (!big || !big.items || !userId) {
    return { ok: false, error: 'invalid_order', contributed: {}, complete: false };
  }

  big.fulfilled = big.fulfilled || {};
  big.contributors = big.contributors || {};

  if (isBigOrderComplete(big)) {
    return { ok: false, error: 'already_complete', contributed: {}, complete: true };
  }

  const toContribute = {};
  let totalUnits = 0;

  for (const [itemId, requested] of Object.entries(items || {})) {
    const qty = Math.max(0, Math.floor(Number(requested) || 0));
    if (qty <= 0) continue;
    const required = big.items[itemId] || 0;
    const fulfilled = big.fulfilled[itemId] || 0;
    const needed = Math.max(0, required - fulfilled);
    if (needed <= 0) continue;

    const capped = Math.min(qty, needed);
    if (capped > 0) {
      toContribute[itemId] = capped;
      totalUnits += capped;
    }
  }

  if (totalUnits <= 0) {
    return { ok: false, error: 'not_needed', contributed: {}, complete: isBigOrderComplete(big) };
  }

  if (typeof hasItemsFn === 'function' && !hasItemsFn(toContribute)) {
    return { ok: false, error: 'missing_items', contributed: {}, complete: isBigOrderComplete(big) };
  }

  if (typeof takeItemsFn === 'function') {
    takeItemsFn(toContribute);
  }

  for (const [itemId, qty] of Object.entries(toContribute)) {
    big.fulfilled[itemId] = (big.fulfilled[itemId] || 0) + qty;
  }

  big.remaining = big.remaining || {};
  for (const itemId of Object.keys(big.items)) {
    big.remaining[itemId] = Math.max(0, (big.items[itemId] || 0) - (big.fulfilled[itemId] || 0));
  }

  big.contributors[userId] = (big.contributors[userId] || 0) + totalUnits;

  const complete = isBigOrderComplete(big);
  if (complete) {
    big.complete = true;
  }

  return {
    ok: true,
    contributed: toContribute,
    complete,
  };
}

/**
 * Largest Remainder (Hare-Niemeyer) distribution algorithm.
 * Guarantees the distributed integer values sum EXACTLY to totalAmount.
 */
export function distributeProportional(totalAmount, entries) {
  const totalUnits = entries.reduce((s, e) => s + (e.units || 0), 0);
  const result = {};
  if (totalUnits <= 0 || totalAmount <= 0) {
    for (const e of entries) {
      result[e.key] = 0;
    }
    return result;
  }

  let allocated = 0;
  const items = entries.map((e) => {
    const exact = (e.units / totalUnits) * totalAmount;
    const floorVal = Math.floor(exact);
    allocated += floorVal;
    return {
      key: e.key,
      units: e.units,
      floorVal,
      rem: exact - floorVal,
    };
  });

  const remainder = totalAmount - allocated;

  // Sort by remainder descending, tie-break by key ascending for determinism
  items.sort((a, b) => {
    if (Math.abs(b.rem - a.rem) > 1e-9) {
      return b.rem - a.rem;
    }
    return String(a.key).localeCompare(String(b.key));
  });

  for (let i = 0; i < items.length; i++) {
    const bonus = i < remainder ? 1 : 0;
    result[items[i].key] = items[i].floorVal + bonus;
  }

  return result;
}

/**
 * Distribute gold and xp to contributors proportional to units contributed.
 * Uses largest-remainder rounding so sums equal total gold and total xp exactly.
 * Returns { [userId]: { gold, xp, units } }.
 */
export function bigOrderRewards(big) {
  if (!big || !big.contributors) return {};
  const contributors = big.contributors;
  const keys = Object.keys(contributors).sort();
  if (keys.length === 0) return {};

  const entries = keys.map((k) => ({ key: k, units: contributors[k] || 0 }));
  const goldMap = distributeProportional(big.gold || 0, entries);
  const xpMap = distributeProportional(big.xp || 0, entries);

  const rewards = {};
  for (const k of keys) {
    rewards[k] = {
      gold: goldMap[k] || 0,
      xp: xpMap[k] || 0,
      units: contributors[k] || 0,
    };
  }
  return rewards;
}

/**
 * Create an empty board state.
 */
export function createBoard({ slots = ORDER_CFG.SLOTS_BASE } = {}) {
  const count = Math.max(0, Number(slots) || ORDER_CFG.SLOTS_BASE);
  return {
    slots: new Array(count).fill(null),
    nextRefreshAt: {},
    big: null,
    seq: 0,
  };
}

/**
 * Ensure board slots and big order:
 * - Fills empty slots whose refresh time has passed.
 * - Creates or replaces today's big order when big.day !== day.
 */
export function ensureBoard(board, {
  slots = ORDER_CFG.SLOTS_BASE,
  unlockedItems,
  rng = Math.random,
  now = 0,
  day = 0,
} = {}) {
  const b = board || createBoard({ slots });

  if (!Array.isArray(b.slots)) {
    b.slots = [];
  }
  if (!b.nextRefreshAt || typeof b.nextRefreshAt !== 'object') {
    b.nextRefreshAt = {};
  }
  if (typeof b.seq !== 'number') {
    b.seq = 0;
  }

  const slotCount = Math.max(0, Number(slots) || ORDER_CFG.SLOTS_BASE);
  while (b.slots.length < slotCount) {
    b.slots.push(null);
  }
  if (b.slots.length > slotCount) {
    b.slots.length = slotCount;
  }

  // Fill empty slots whose refresh time has passed
  for (let i = 0; i < slotCount; i++) {
    if (b.slots[i] === null) {
      const refreshAt = b.nextRefreshAt[i] ?? 0;
      if (now >= refreshAt) {
        b.seq += 1;
        const newOrder = generateOrder({
          unlockedItems,
          rng,
          now,
          id: `ord_${b.seq}`,
        });
        if (newOrder) {
          b.slots[i] = newOrder;
          delete b.nextRefreshAt[i];
        } else {
          b.seq -= 1;
        }
      }
    }
  }

  // Create or replace today's big order when big.day !== day
  if (!b.big || b.big.day !== day) {
    b.big = generateBigOrder({
      unlockedItems,
      rng,
      now,
      day,
    });
  }

  return b;
}

/**
 * Discard an order in slotIdx: empties the slot and sets nextRefreshAt = now + REFRESH_MS.
 */
export function discardOrder(board, slotIdx, now = 0) {
  if (!board || !board.slots) return board;
  board.nextRefreshAt = board.nextRefreshAt || {};
  const idx = Number(slotIdx);
  board.slots[idx] = null;
  board.nextRefreshAt[idx] = now + ORDER_CFG.REFRESH_MS;
  return board;
}

/**
 * Complete a slot after successful fill: empties the slot and sets nextRefreshAt = now + REFRESH_MS.
 */
export function completeSlot(board, slotIdx, now = 0) {
  if (!board || !board.slots) return board;
  board.nextRefreshAt = board.nextRefreshAt || {};
  const idx = Number(slotIdx);
  board.slots[idx] = null;
  board.nextRefreshAt[idx] = now + ORDER_CFG.REFRESH_MS;
  return board;
}
