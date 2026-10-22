// shared/monument_rules.js — VIP Wonders become endgame Monuments & Camp Props rules (Master Plan v2 §11.4–§11.5).
// Pure module, zero I/O, no Date.now(): takes `now` and `rng` as parameters.

import { DECOR } from './catalog_landmarks.js';

// ---------------------------------------------------------------------------------------------
// 1. Monuments (Master Plan v2 §11.4)
// Built in stages from materials (no gacha). Keys reuse existing wonder keys so art keeps working.
// ---------------------------------------------------------------------------------------------
export const MONUMENTS = Object.freeze({
  // --- Launch Monuments (4) ---
  wnd_onsen: Object.freeze({
    id: 'wnd_onsen',
    name: 'Capybara Hot Spring',
    stages: Object.freeze([
      Object.freeze({ wood: 40, stone: 40, gold: 2000 }),
      Object.freeze({ plank: 30, crystal_glass: 10, boss_core_moss: 2, gold: 4000 }),
    ]),
    effect: Object.freeze({ type: 'well_rested', ms: 30 * 60e3, yieldPct: 15 }),
    launch: true,
  }),
  wnd_tea_pavilion: Object.freeze({
    id: 'wnd_tea_pavilion',
    name: 'Matcha Tea House',
    stages: Object.freeze([
      Object.freeze({ plank: 40, herb: 20, gold: 2500 }),
      Object.freeze({ crystal_glass: 12, herb: 40, boss_core_moss: 2, gold: 5000 }),
    ]),
    effect: Object.freeze({ type: 'tea_line', recipes: Object.freeze(['matcha_tea']), ultCdPct: 20 }),
    launch: true,
  }),
  wnd_ferris: Object.freeze({
    id: 'wnd_ferris',
    name: 'Couple Ferris Wheel',
    stages: Object.freeze([
      Object.freeze({ plank: 60, ingot: 20, gold: 3000 }),
      Object.freeze({ ingot: 40, crystal_glass: 20, boss_core_moss: 3, gold: 6000 }),
    ]),
    effect: Object.freeze({ type: 'date_buff', pct: 10, ms: 30 * 60e3 }),
    heartIsleOnly: true,
    launch: true,
  }),
  wnd_fountain: Object.freeze({
    id: 'wnd_fountain',
    name: 'Fountain of Wishes',
    stages: Object.freeze([
      Object.freeze({ stone: 80, crystal_ore: 20, gold: 2000 }),
      Object.freeze({ crystal_glass: 15, ancient_gear: 2, gold: 4000 }),
    ]),
    effect: Object.freeze({ type: 'daily_wish', cost: 100 }),
    launch: true,
    free: true,
  }),

  // --- Update 1 Monuments (launch: false) ---
  wnd_world_tree: Object.freeze({
    id: 'wnd_world_tree',
    name: 'Golden Starlight World-Tree',
    stages: Object.freeze([
      Object.freeze({ plank: 80, wood: 80, gold: 4000 }),
      Object.freeze({ crystal_glass: 20, starlight_essence: 2, gold: 8000 }),
    ]),
    effect: Object.freeze({ type: 'revive_once' }),
    launch: false,
  }),
  wnd_aurora_observatory: Object.freeze({
    id: 'wnd_aurora_observatory',
    name: 'Starlight Aurora Observatory',
    stages: Object.freeze([
      Object.freeze({ stone: 80, crystal_glass: 15, gold: 4000 }),
      Object.freeze({ ingot: 30, starlight_essence: 2, gold: 8000 }),
    ]),
    effect: Object.freeze({ type: 'charm_upgrade' }),
    launch: false,
  }),
  wnd_mirage_palace: Object.freeze({
    id: 'wnd_mirage_palace',
    name: "Sultan's Golden Mirage Palace",
    stages: Object.freeze([
      Object.freeze({ stone: 100, plank: 50, gold: 5000 }),
      Object.freeze({ ingot: 40, ancient_gear: 3, gold: 9000 }),
    ]),
    effect: Object.freeze({ type: 'fixed_stall' }),
    launch: false,
  }),
  wnd_atlantis_sanctuary: Object.freeze({
    id: 'wnd_atlantis_sanctuary',
    name: 'Atlantis Pearl-Shell Palace',
    stages: Object.freeze([
      Object.freeze({ stone: 100, crystal_glass: 20, gold: 5000 }),
      Object.freeze({ crystal_glass: 30, boss_core_weaver: 2, gold: 10000 }),
    ]),
    effect: Object.freeze({ type: 'lagoon_region' }),
    launch: false,
  }),
});

/** Cut wonders retired from the game (§14). */
export const CUT_WONDERS = Object.freeze([
  'wnd_casino_dome',
  'wnd_sakura_pagoda',
  'wnd_burj_khalifa',
  'wnd_sky_airship_dock',
]);

// ---------------------------------------------------------------------------------------------
// 2. Camp Props (8 functional decor crafted from materials, §11.5)
// ---------------------------------------------------------------------------------------------
export const CAMP_PROPS = Object.freeze({
  dec_tent: Object.freeze({
    id: 'dec_tent',
    cost: Object.freeze({ wood: 8 }),
    effect: 'free_bread_daily',
  }),
  dec_honey_beehive: Object.freeze({
    id: 'dec_honey_beehive',
    cost: Object.freeze({ plank: 6, herb: 4 }),
    effect: Object.freeze({ produces: Object.freeze({ honey: 1 }), everyMs: 2 * 3600e3 }),
  }),
  dec_koi_barrel_pond: Object.freeze({
    id: 'dec_koi_barrel_pond',
    cost: Object.freeze({ plank: 8, stone: 6 }),
    effect: Object.freeze({ produces: Object.freeze({ fish: 1 }), everyMs: 3 * 3600e3 }),
  }),
  dec_berry_wheelbarrow: Object.freeze({
    id: 'dec_berry_wheelbarrow',
    cost: Object.freeze({ plank: 6 }),
    effect: Object.freeze({ storagePct: 10 }),
  }),
  dec_starlight_telescope: Object.freeze({
    id: 'dec_starlight_telescope',
    cost: Object.freeze({ ingot: 4, crystal_glass: 2 }),
    effect: 'event_preview',
  }),
  dec_owl_mailbox: Object.freeze({
    id: 'dec_owl_mailbox',
    cost: Object.freeze({ plank: 6, ingot: 2 }),
    effect: Object.freeze({ orderSlots: 1 }),
  }),
  dec_picnic: Object.freeze({
    id: 'dec_picnic',
    cost: Object.freeze({ plank: 4, berries_crop: 10 }),
    effect: Object.freeze({ visitorBuff: 'picnic', ms: 20 * 60e3 }),
  }),
  dec_couple_hammock: Object.freeze({
    id: 'dec_couple_hammock',
    cost: Object.freeze({ plank: 8, thread: 2 }),
    effect: Object.freeze({ coupleBuff: 'harmony', ms: 30 * 60e3 }),
  }),
});

// ---------------------------------------------------------------------------------------------
// 3. Cosmetic Decor (12 decor, comfort only, craft cost in planks/stone/herb, §11.5)
// ---------------------------------------------------------------------------------------------
export const COSMETIC_DECOR = Object.freeze({
  dec_swing: Object.freeze({ cost: Object.freeze({ plank: 6, stone: 2 }) }),
  dec_gramophone: Object.freeze({ cost: Object.freeze({ plank: 4, stone: 2, herb: 2 }) }),
  dec_wooden_bench: Object.freeze({ cost: Object.freeze({ plank: 6, stone: 2 }) }),
  dec_flower_cart: Object.freeze({ cost: Object.freeze({ plank: 4, herb: 6 }) }),
  dec_mushroom_ring: Object.freeze({ cost: Object.freeze({ stone: 4, herb: 4 }) }),
  dec_birdbath_lamp: Object.freeze({ cost: Object.freeze({ stone: 6, plank: 2 }) }),
  dec_wishing_well: Object.freeze({ cost: Object.freeze({ stone: 8, plank: 4 }) }),
  dec_sakura_drum_bridge: Object.freeze({ cost: Object.freeze({ plank: 8, stone: 4 }) }),
  dec_bamboo_shishi_odoshi: Object.freeze({ cost: Object.freeze({ plank: 4, stone: 4, herb: 2 }) }),
  dec_stone_arch_footbridge: Object.freeze({ cost: Object.freeze({ stone: 10, plank: 4 }) }),
  dec_aurora_crystal_gazebo: Object.freeze({ cost: Object.freeze({ stone: 8, plank: 6, herb: 4 }) }),
  dec_heaven_divine_tree: Object.freeze({ cost: Object.freeze({ plank: 8, stone: 4, herb: 8 }) }),
});

/** Kept, no buff, still placeable, not craftable (§11.5, §18.7). */
export const PROTECTED_DECOR = Object.freeze(['dec_nookairline_museum']);

/** Every other decor key cut from the game (computed from catalog_landmarks.js DECOR). */
const keptDecorSet = new Set([
  ...Object.keys(CAMP_PROPS),
  ...Object.keys(COSMETIC_DECOR),
  ...PROTECTED_DECOR,
]);
export const CUT_DECOR = Object.freeze(
  Object.keys(DECOR).filter((k) => !keptDecorSet.has(k))
);

// ---------------------------------------------------------------------------------------------
// 4. State & Unlock Helpers
// ---------------------------------------------------------------------------------------------

/**
 * Creates or resets a monument state tracker.
 */
export function monumentState(initial = {}) {
  const st = {
    unlocked: [],
    monuments: {},
  };

  for (const [id, def] of Object.entries(MONUMENTS)) {
    const entry = { stage: 0, built: false };
    st.monuments[id] = entry;
    st[id] = entry; // Direct property alias
    if (def.free) {
      st.unlocked.push(id);
    }
  }

  if (initial) {
    if (Array.isArray(initial.unlocked)) {
      for (const u of initial.unlocked) {
        if (!st.unlocked.includes(u)) st.unlocked.push(u);
      }
    } else if (initial.unlocked instanceof Set) {
      for (const u of initial.unlocked) {
        if (!st.unlocked.includes(u)) st.unlocked.push(u);
      }
    }

    const monMap = initial.monuments || initial;
    for (const [id, val] of Object.entries(monMap)) {
      if (id === 'unlocked' || id === 'monuments') continue;
      if (st.monuments[id]) {
        if (typeof val === 'number') {
          st.monuments[id].stage = val;
          st.monuments[id].built = val >= (MONUMENTS[id]?.stages.length || 0);
        } else if (typeof val === 'object' && val !== null) {
          Object.assign(st.monuments[id], val);
        }
      }
    }
  }

  return st;
}

/**
 * Checks if a monument is unlocked.
 * - Launch monuments:
 *   - wnd_fountain: free from the start (has `free: true`)
 *   - wnd_onsen: unlocked by chapter 4 (must be in unlockedList or state.unlocked)
 *   - tea/ferris: unlocked when wnd_onsen is built
 * - Update 1 monuments: unlocked if explicitly in unlockedList
 */
export function isUnlocked(monumentId, unlockedList, state) {
  const def = MONUMENTS[monumentId];
  if (!def) return false;
  if (def.free) return true;

  let st = state;
  let list = unlockedList;

  // If unlockedList itself is a state object
  if (unlockedList && typeof unlockedList === 'object' && !Array.isArray(unlockedList) && !(unlockedList instanceof Set)) {
    if (unlockedList.monuments || unlockedList.wnd_onsen) {
      st = unlockedList;
      list = unlockedList.unlocked || [];
    }
  }

  const hasInList = (id) => {
    if (!list) return false;
    if (Array.isArray(list)) return list.includes(id);
    if (list instanceof Set) return list.has(id);
    if (typeof list === 'object') return Boolean(list[id]);
    return false;
  };

  if (hasInList(monumentId)) return true;

  // tea/ferris unlocked when wnd_onsen is built
  if (monumentId === 'wnd_tea_pavilion' || monumentId === 'wnd_ferris') {
    if (hasInList('wnd_onsen_built') || hasInList('built:wnd_onsen') || hasInList('wnd_onsen:built')) {
      return true;
    }
    const onsenBuilt = st?.wnd_onsen?.built ?? st?.monuments?.wnd_onsen?.built;
    if (onsenBuilt) return true;
  }

  return false;
}

// ---------------------------------------------------------------------------------------------
// 5. Item Stores & Material Helpers
// ---------------------------------------------------------------------------------------------

function getItemCount(stores, itemId) {
  if (!stores) return 0;
  if (typeof stores.get === 'function') return stores.get(itemId) || 0;
  if (stores.warehouse?.items && typeof stores.warehouse.items[itemId] === 'number') {
    return stores.warehouse.items[itemId];
  }
  if (stores.pantry?.items && typeof stores.pantry.items[itemId] === 'number') {
    return stores.pantry.items[itemId];
  }
  if (stores.items && typeof stores.items[itemId] === 'number') {
    return stores.items[itemId];
  }
  if (typeof stores[itemId] === 'number') {
    return stores[itemId];
  }
  return 0;
}

function deductFromStores(stores, items) {
  if (!stores || !items) return;
  for (const [id, count] of Object.entries(items)) {
    const take = Number(count) || 0;
    if (take <= 0) continue;
    if (stores.warehouse?.items && typeof stores.warehouse.items[id] === 'number') {
      stores.warehouse.items[id] -= take;
      if (stores.warehouse.items[id] <= 0) delete stores.warehouse.items[id];
    } else if (stores.pantry?.items && typeof stores.pantry.items[id] === 'number') {
      stores.pantry.items[id] -= take;
      if (stores.pantry.items[id] <= 0) delete stores.pantry.items[id];
    } else if (stores.items && typeof stores.items[id] === 'number') {
      stores.items[id] -= take;
      if (stores.items[id] <= 0) delete stores.items[id];
    } else if (typeof stores[id] === 'number') {
      stores[id] -= take;
      if (stores[id] <= 0) delete stores[id];
    }
  }
}

// ---------------------------------------------------------------------------------------------
// 6. Contribute Stage (Atomic payment)
// ---------------------------------------------------------------------------------------------

/**
 * Pays the CURRENT stage cost atomically (all or nothing), advancing stage.
 * built when all stages are done.
 * Returns { ok, error: 'locked' | 'done' | 'missing', stage }
 */
export function contributeStage(state, monumentId, stores, takeFn, gold) {
  const def = MONUMENTS[monumentId];
  if (!def) {
    return { ok: false, error: 'locked', stage: 0 };
  }

  // Ensure state structure exists
  if (!state[monumentId]) {
    state[monumentId] = { stage: 0, built: false };
    if (state.monuments) state.monuments[monumentId] = state[monumentId];
  }
  const mState = state.monuments?.[monumentId] || state[monumentId];

  // 1. Check unlock status
  const unlocked = isUnlocked(monumentId, state.unlocked || state, state);
  if (!unlocked && !mState.unlocked) {
    return { ok: false, error: 'locked', stage: mState.stage };
  }

  // 2. Check if already finished
  if (mState.built || mState.stage >= def.stages.length) {
    return { ok: false, error: 'done', stage: mState.stage };
  }

  // 3. Current stage cost
  const currentCost = def.stages[mState.stage];
  if (!currentCost) {
    return { ok: false, error: 'done', stage: mState.stage };
  }

  const { gold: reqGold = 0, ...reqItems } = currentCost;

  // 4. Check gold
  let availGold = 0;
  if (typeof gold === 'number') {
    availGold = gold;
  } else if (gold && typeof gold.gold === 'number') {
    availGold = gold.gold;
  } else if (stores && typeof stores.gold === 'number') {
    availGold = stores.gold;
  }

  if (availGold < reqGold) {
    return { ok: false, error: 'missing', stage: mState.stage };
  }

  // 5. Check materials
  for (const [itemId, reqQty] of Object.entries(reqItems)) {
    const qty = Number(reqQty) || 0;
    if (qty <= 0) continue;
    const have = getItemCount(stores, itemId);
    if (have < qty) {
      return { ok: false, error: 'missing', stage: mState.stage };
    }
  }

  // 6. Pay atomically: deduct gold and materials
  if (gold && typeof gold === 'object' && typeof gold.gold === 'number') {
    gold.gold -= reqGold;
  } else if (stores && typeof stores === 'object' && typeof stores.gold === 'number') {
    stores.gold -= reqGold;
  }

  if (typeof takeFn === 'function') {
    let taken = false;
    if (takeFn.length === 1) {
      takeFn(reqItems);
      taken = true;
    } else if (takeFn.length === 2) {
      const str = takeFn.toString();
      const firstArg = str.slice(str.indexOf('(') + 1, str.indexOf(',')).trim();
      if (firstArg === 'item' || firstArg === 'itemId' || firstArg === 'id') {
        for (const [id, count] of Object.entries(reqItems)) {
          takeFn(id, count);
        }
        taken = true;
      } else {
        takeFn(stores, reqItems);
        taken = true;
      }
    } else {
      takeFn(stores, reqItems);
      taken = true;
    }
  } else if (stores) {
    deductFromStores(stores, reqItems);
  }

  // 7. Advance stage
  mState.stage += 1;
  const isDone = mState.stage >= def.stages.length;
  mState.built = isDone;

  // If wnd_onsen was just built, auto-unlock tea & ferris in state
  if (monumentId === 'wnd_onsen' && isDone) {
    if (Array.isArray(state.unlocked)) {
      if (!state.unlocked.includes('wnd_tea_pavilion')) state.unlocked.push('wnd_tea_pavilion');
      if (!state.unlocked.includes('wnd_ferris')) state.unlocked.push('wnd_ferris');
    } else if (state.unlocked instanceof Set) {
      state.unlocked.add('wnd_tea_pavilion');
      state.unlocked.add('wnd_ferris');
    }
    if (state.wnd_tea_pavilion) state.wnd_tea_pavilion.unlocked = true;
    if (state.wnd_ferris) state.wnd_ferris.unlocked = true;
    if (state.monuments?.wnd_tea_pavilion) state.monuments.wnd_tea_pavilion.unlocked = true;
    if (state.monuments?.wnd_ferris) state.monuments.wnd_ferris.unlocked = true;
  }

  return { ok: true, stage: mState.stage, built: isDone };
}

// ---------------------------------------------------------------------------------------------
// 7. Daily Wish Table & RNG
// ---------------------------------------------------------------------------------------------

export const WISH_TABLE = Object.freeze([
  Object.freeze({ item: 'crystal_glass', count: 2, weight: 40 }),
  Object.freeze({ item: 'ancient_gear', count: 1, weight: 15 }),
  Object.freeze({ item: 'boss_core_moss', count: 1, weight: 10 }),
  Object.freeze({ item: 'starlight_essence', count: 1, weight: 5 }),
  Object.freeze({ item: 'honey', count: 5, weight: 30 }),
]);

/**
 * Rolls a random rare-ish material from the Fountain of Wishes.
 * Weights:
 *   { crystal_glass: 2 } 40%
 *   { ancient_gear: 1 }  15%
 *   { boss_core_moss: 1 } 10%
 *   { starlight_essence: 1 } 5%
 *   { honey: 5 } 30%
 */
export function dailyWish(rng = Math.random) {
  const roll = rng();
  if (roll < 0.40) return { crystal_glass: 2 };
  if (roll < 0.55) return { ancient_gear: 1 };
  if (roll < 0.65) return { boss_core_moss: 1 };
  if (roll < 0.70) return { starlight_essence: 1 };
  return { honey: 5 };
}

// ---------------------------------------------------------------------------------------------
// 8. Buff Generators
// ---------------------------------------------------------------------------------------------

/**
 * Well-Rested buff from Capybara Hot Spring: +15% yield for 30 minutes.
 */
export function wellRestedBuff(now = 0) {
  const t = typeof now === 'number' ? now : 0;
  const ms = 30 * 60e3;
  return {
    type: 'well_rested',
    yieldPct: 15,
    startedAt: t,
    until: t + ms,
    durationMs: ms,
    ms,
  };
}

/**
 * Date buff from Couple Ferris Wheel: +10% for 30 minutes on Heart Isle.
 */
export function dateBuff(now = 0) {
  const t = typeof now === 'number' ? now : 0;
  const ms = 30 * 60e3;
  return {
    type: 'date_buff',
    pct: 10,
    startedAt: t,
    until: t + ms,
    durationMs: ms,
    ms,
  };
}

// ---------------------------------------------------------------------------------------------
// 9. Prop Production (with offline catch-up, capped at 6 cycles)
// ---------------------------------------------------------------------------------------------

/**
 * Calculates item production for functional camp props (e.g. beehive, koi barrel pond).
 * Offline catch-up is capped at 6 cycles.
 * Returns { items: { [item]: count }, nextLastAt }
 */
export function propProduction(prop, lastAt = 0, now = 0) {
  let def = prop;
  if (typeof prop === 'string') {
    def = CAMP_PROPS[prop];
  } else if (prop && typeof prop === 'object' && prop.id && !prop.effect) {
    def = CAMP_PROPS[prop.id];
  }

  const effect = def?.effect;
  const produces = effect?.produces;
  const everyMs = effect?.everyMs;

  const tLast = typeof lastAt === 'number' ? lastAt : 0;
  const tNow = typeof now === 'number' ? now : 0;

  if (!produces || !everyMs || everyMs <= 0) {
    return { items: {}, nextLastAt: tLast || tNow };
  }

  const elapsed = Math.max(0, tNow - tLast);
  const cycles = Math.floor(elapsed / everyMs);

  if (cycles <= 0) {
    return { items: {}, nextLastAt: tLast };
  }

  const cappedCycles = Math.min(6, cycles);
  const items = {};
  for (const [item, qty] of Object.entries(produces)) {
    items[item] = qty * cappedCycles;
  }

  // Next lastAt:
  // If capped, overflow cycles are lost, so next cycle starts relative to current time preserving remainder.
  // When cycles < 6, tNow - (elapsed % everyMs) is mathematically equal to tLast + cycles * everyMs.
  const nextLastAt = tNow - (elapsed % everyMs);

  return { items, nextLastAt };
}
