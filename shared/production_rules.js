// shared/production_rules.js — Sky Frontier village production pure rules.
// Pure module, zero I/O, no Date.now().

import { MATERIALS, materialTier, isMaterial } from './materials_catalog.js';

export const PRODUCTION_BUILDINGS = Object.freeze({
  windmill_bakery: Object.freeze(['flour']),
  patisserie: Object.freeze([
    'bread',
    'honey_bun',
    'fish_pie',
    'berry_tart',
    'boba_tea',
    'golden_croissant',
  ]),
  mint: Object.freeze(['ingot', 'crystal_glass', 'mithril_ingot']),
  workshop: Object.freeze([
    'plank',
    'thread',
    'tool_pickaxe_2',
    'tool_axe_2',
    'tool_staff_1',
    'tool_staff_2',
  ]),
  flower_greenhouse: Object.freeze([
    'herb',
    'potion_small',
    'repair_kit',
    'pet_treat',
  ]),
});

export const RECIPES = Object.freeze({
  flour: Object.freeze({
    id: 'flour',
    building: 'windmill_bakery',
    inputs: Object.freeze({ sky_wheat: 3 }),
    outputs: Object.freeze({ flour: 1 }),
    ms: 60 * 1000,
    minLv: 1,
  }),
  bread: Object.freeze({
    id: 'bread',
    building: 'patisserie',
    inputs: Object.freeze({ flour: 2 }),
    outputs: Object.freeze({ bread: 1 }),
    ms: 120 * 1000,
    minLv: 1,
  }),
  honey_bun: Object.freeze({
    id: 'honey_bun',
    building: 'patisserie',
    inputs: Object.freeze({ flour: 1, honey: 1 }),
    outputs: Object.freeze({ honey_bun: 1 }),
    ms: 240 * 1000,
    minLv: 1,
  }),
  fish_pie: Object.freeze({
    id: 'fish_pie',
    building: 'patisserie',
    inputs: Object.freeze({ flour: 2, fish: 1 }),
    outputs: Object.freeze({ fish_pie: 1 }),
    ms: 480 * 1000,
    minLv: 1,
  }),
  berry_tart: Object.freeze({
    id: 'berry_tart',
    building: 'patisserie',
    inputs: Object.freeze({ flour: 1, berries_crop: 3 }),
    outputs: Object.freeze({ berry_tart: 1 }),
    ms: 360 * 1000,
    minLv: 1,
  }),
  boba_tea: Object.freeze({
    id: 'boba_tea',
    building: 'patisserie',
    inputs: Object.freeze({ berries_crop: 2, herb: 1 }),
    outputs: Object.freeze({ boba_tea: 1 }),
    ms: 180 * 1000,
    minLv: 1,
  }),
  golden_croissant: Object.freeze({
    id: 'golden_croissant',
    building: 'patisserie',
    inputs: Object.freeze({ golden_wheat: 2, honey: 1 }),
    outputs: Object.freeze({ golden_croissant: 1 }),
    ms: 1200 * 1000,
    minLv: 3,
  }),
  ingot: Object.freeze({
    id: 'ingot',
    building: 'mint',
    inputs: Object.freeze({ crystal_ore: 3 }),
    outputs: Object.freeze({ ingot: 1 }),
    ms: 180 * 1000,
    minLv: 1,
  }),
  crystal_glass: Object.freeze({
    id: 'crystal_glass',
    building: 'mint',
    inputs: Object.freeze({ stone: 4, crystal_ore: 1 }),
    outputs: Object.freeze({ crystal_glass: 1 }),
    ms: 300 * 1000,
    minLv: 1,
  }),
  mithril_ingot: Object.freeze({
    id: 'mithril_ingot',
    building: 'mint',
    inputs: Object.freeze({ crystal_ore: 5, stone: 2 }),
    outputs: Object.freeze({ mithril_ingot: 1 }),
    ms: 360 * 1000,
    minLv: 2,
  }),
  plank: Object.freeze({
    id: 'plank',
    building: 'workshop',
    inputs: Object.freeze({ wood: 3 }),
    outputs: Object.freeze({ plank: 1 }),
    ms: 60 * 1000,
    minLv: 1,
  }),
  thread: Object.freeze({
    id: 'thread',
    building: 'workshop',
    inputs: Object.freeze({ feather: 2, cloud_silk: 1 }),
    outputs: Object.freeze({ thread: 1 }),
    ms: 240 * 1000,
    minLv: 1,
  }),
  tool_pickaxe_2: Object.freeze({
    id: 'tool_pickaxe_2',
    building: 'workshop',
    inputs: Object.freeze({ ingot: 6, plank: 4 }),
    outputs: Object.freeze({}),
    tool: Object.freeze({ kind: 'pickaxe', tier: 2 }),
    ms: 600 * 1000,
    minLv: 2,
  }),
  tool_axe_2: Object.freeze({
    id: 'tool_axe_2',
    building: 'workshop',
    inputs: Object.freeze({ ingot: 5, plank: 6 }),
    outputs: Object.freeze({}),
    tool: Object.freeze({ kind: 'axe', tier: 2 }),
    ms: 600 * 1000,
    minLv: 2,
  }),
  tool_staff_1: Object.freeze({
    id: 'tool_staff_1',
    building: 'workshop',
    inputs: Object.freeze({ plank: 3, herb: 2 }),
    outputs: Object.freeze({}),
    tool: Object.freeze({ kind: 'staff', tier: 1 }),
    ms: 600 * 1000,
    minLv: 2,
  }),
  tool_staff_2: Object.freeze({
    id: 'tool_staff_2',
    building: 'workshop',
    inputs: Object.freeze({ crystal_glass: 3, plank: 4, herb: 4 }),
    outputs: Object.freeze({}),
    tool: Object.freeze({ kind: 'staff', tier: 2 }),
    ms: 600 * 1000,
    minLv: 2,
  }),
  herb: Object.freeze({
    id: 'herb',
    building: 'flower_greenhouse',
    inputs: Object.freeze({ herb_seed: 2 }),
    outputs: Object.freeze({ herb: 1 }),
    ms: 300 * 1000,
    minLv: 1,
  }),
  potion_small: Object.freeze({
    id: 'potion_small',
    building: 'flower_greenhouse',
    inputs: Object.freeze({ herb: 2, berries_crop: 1 }),
    outputs: Object.freeze({ potion_small: 1 }),
    ms: 360 * 1000,
    minLv: 1,
  }),
  repair_kit: Object.freeze({
    id: 'repair_kit',
    building: 'flower_greenhouse',
    inputs: Object.freeze({ herb: 1, plank: 2, ingot: 1 }),
    outputs: Object.freeze({ repair_kit: 1 }),
    ms: 600 * 1000,
    minLv: 1,
  }),
  pet_treat: Object.freeze({
    id: 'pet_treat',
    building: 'flower_greenhouse',
    inputs: Object.freeze({ herb: 1, berries_crop: 2 }),
    outputs: Object.freeze({ pet_treat: 1 }),
    ms: 240 * 1000,
    minLv: 1,
  }),
});

export const CROPS = Object.freeze({
  sky_wheat: Object.freeze({
    plant: Object.freeze({}),
    yield: Object.freeze({ sky_wheat: 4 }),
    ms: 120000,
  }),
  berries_crop: Object.freeze({
    plant: Object.freeze({}),
    yield: Object.freeze({ berries_crop: 5 }),
    ms: 600000,
  }),
  herb: Object.freeze({
    plant: Object.freeze({ herb_seed: 1 }),
    yield: Object.freeze({ herb: 3 }),
    ms: 1200000,
  }),
  golden_wheat: Object.freeze({
    plant: Object.freeze({ golden_wheat: 1 }),
    yield: Object.freeze({ golden_wheat: 3 }),
    ms: 3600000,
  }),
});

export const WATER_SPEEDUP = 0.25;

export function storeOf(itemId) {
  return materialTier(itemId) === 'goods' ? 'pantry' : 'warehouse';
}

export function storeCap(kind, lv) {
  const l = Math.max(1, Number(lv) || 1);
  if (kind === 'warehouse') return 300 * l;
  if (kind === 'pantry') return 100 * l;
  return 0;
}

/** Warehouse capacity incl. the Berry Wheelbarrow camp-prop bonus (`warehouse.capPct`, set by basecamp_service). */
export function warehouseCapOf(warehouse) {
  const pct = Math.max(0, Number(warehouse?.capPct) || 0);
  return Math.floor(storeCap('warehouse', warehouse?.lv ?? 1) * (1 + pct / 100));
}

export function storeUsed(store) {
  if (!store) return 0;
  if (store.items) {
    return Object.values(store.items).reduce((sum, n) => sum + (Number(n) || 0), 0);
  }
  let sum = 0;
  if (store.warehouse?.items) sum += storeUsed(store.warehouse);
  if (store.pantry?.items) sum += storeUsed(store.pantry);
  return sum;
}

export function canAdd(stores, items) {
  const overflow = {};
  if (!items || Object.keys(items).length === 0) {
    return { ok: true, overflow };
  }

  const warehouseCap = warehouseCapOf(stores?.warehouse);
  const warehouseUsed = storeUsed(stores?.warehouse);
  let warehouseFree = Math.max(0, warehouseCap - warehouseUsed);

  const pantryCap = storeCap('pantry', stores?.pantry?.lv ?? 1);
  const pantryUsed = storeUsed(stores?.pantry);
  let pantryFree = Math.max(0, pantryCap - pantryUsed);

  for (const [id, rawCount] of Object.entries(items)) {
    const count = Number(rawCount) || 0;
    if (count <= 0) continue;
    const kind = storeOf(id);
    if (kind === 'pantry') {
      const canFit = Math.min(count, pantryFree);
      pantryFree -= canFit;
      const over = count - canFit;
      if (over > 0) overflow[id] = (overflow[id] || 0) + over;
    } else {
      const canFit = Math.min(count, warehouseFree);
      warehouseFree -= canFit;
      const over = count - canFit;
      if (over > 0) overflow[id] = (overflow[id] || 0) + over;
    }
  }

  return {
    ok: Object.keys(overflow).length === 0,
    overflow,
  };
}

export function addItems(stores, items, { allowOverflow = false } = {}) {
  const added = {};
  const overflow = {};
  if (!items || Object.keys(items).length === 0) {
    return { added, overflow };
  }

  if (!stores.warehouse) stores.warehouse = { lv: 1, items: {} };
  if (!stores.warehouse.items) stores.warehouse.items = {};
  if (!stores.pantry) stores.pantry = { lv: 1, items: {} };
  if (!stores.pantry.items) stores.pantry.items = {};

  const warehouseCap = warehouseCapOf(stores.warehouse);
  const warehouseUsed = storeUsed(stores.warehouse);
  let warehouseFree = Math.max(0, warehouseCap - warehouseUsed);

  const pantryCap = storeCap('pantry', stores.pantry.lv);
  const pantryUsed = storeUsed(stores.pantry);
  let pantryFree = Math.max(0, pantryCap - pantryUsed);

  for (const [id, rawCount] of Object.entries(items)) {
    const count = Number(rawCount) || 0;
    if (count <= 0) continue;
    const kind = storeOf(id);
    const targetStore = stores[kind];

    let canFit = 0;
    if (allowOverflow) {
      const stackMax = Number(MATERIALS[id]?.stack) || 999;
      const curStack = Number(targetStore.items[id]) || 0;
      canFit = Math.max(0, Math.min(count, stackMax - curStack));
    } else if (kind === 'pantry') {
      canFit = Math.min(count, pantryFree);
      pantryFree -= canFit;
    } else {
      canFit = Math.min(count, warehouseFree);
      warehouseFree -= canFit;
    }

    const over = count - canFit;
    if (canFit > 0) {
      targetStore.items[id] = (targetStore.items[id] || 0) + canFit;
      added[id] = (added[id] || 0) + canFit;
    }
    if (over > 0) {
      overflow[id] = (overflow[id] || 0) + over;
    }
  }

  return { added, overflow };
}

export function hasItems(stores, items) {
  if (!items) return true;
  for (const [id, rawCount] of Object.entries(items)) {
    const need = Number(rawCount) || 0;
    if (need <= 0) continue;
    const kind = storeOf(id);
    const have = stores?.[kind]?.items?.[id] || 0;
    if (have < need) return false;
  }
  return true;
}

export function takeItems(stores, items) {
  if (!hasItems(stores, items)) return false;
  if (!items) return true;
  for (const [id, rawCount] of Object.entries(items)) {
    const take = Number(rawCount) || 0;
    if (take <= 0) continue;
    const kind = storeOf(id);
    stores[kind].items[id] -= take;
    if (stores[kind].items[id] <= 0) {
      delete stores[kind].items[id];
    }
  }
  return true;
}

export function storeUpgradeCost(kind, lv) {
  const l = Math.max(1, Number(lv) || 1);
  const cost = {
    plank: 10 * l,
    ingot: 5 * l,
  };
  if (l >= 2) {
    cost.ancient_gear = l - 1;
  }
  return cost;
}

export function queueSlots(buildingLv) {
  const lv = Number(buildingLv) || 1;
  let slots = 3;
  if (lv >= 4) slots += 1;
  if (lv >= 7) slots += 1;
  if (lv >= 10) slots += 1;
  return slots;
}

export function enqueue(state, stores, recipeId, buildingType, buildingLv, now, { speedMult = 1 } = {}) {
  const recipe = RECIPES[recipeId];
  if (!recipe) return { ok: false, error: 'bad_recipe' };

  if (recipe.building !== buildingType) {
    return { ok: false, error: 'wrong_building' };
  }

  const lv = Number(buildingLv) || 1;
  if (lv < (recipe.minLv || 1)) {
    return { ok: false, error: 'level' };
  }

  if (!state.queue) state.queue = [];
  if (!state.output) state.output = {};
  if (!state.tools) state.tools = [];

  const maxSlots = queueSlots(lv);
  if (state.queue.length >= maxSlots) {
    return { ok: false, error: 'queue_full' };
  }

  if (!hasItems(stores, recipe.inputs)) {
    return { ok: false, error: 'missing_inputs' };
  }

  takeItems(stores, recipe.inputs);

  const lastJob = state.queue.length > 0 ? state.queue[state.queue.length - 1] : null;
  const startAt = lastJob ? Math.max(now, lastJob.doneAt) : now;
  const speed = speedMult > 0 ? speedMult : 1;
  const duration = Math.round(recipe.ms / speed);
  const doneAt = startAt + duration;

  const job = {
    recipe: recipeId,
    startAt,
    doneAt,
  };
  state.queue.push(job);

  return { ok: true };
}

export function settle(state, now) {
  if (!state) return 0;
  if (!state.queue) state.queue = [];
  if (!state.output) state.output = {};
  if (!state.tools) state.tools = [];

  let settledCount = 0;
  const remainingQueue = [];

  for (const job of state.queue) {
    if (job.doneAt <= now) {
      settledCount++;
      const rec = typeof job.recipe === 'string' ? RECIPES[job.recipe] : (job.recipe || RECIPES[job.recipeId]);
      if (rec?.tool) {
        state.tools.push({ kind: rec.tool.kind, tier: rec.tool.tier });
      } else if (rec?.outputs) {
        for (const [itemId, qty] of Object.entries(rec.outputs)) {
          state.output[itemId] = (state.output[itemId] || 0) + (Number(qty) || 0);
        }
      }
    } else {
      remainingQueue.push(job);
    }
  }

  state.queue = remainingQueue;
  return settledCount;
}

export function collect(state, stores, now, opts = {}) {
  settle(state, now);
  const toAdd = { ...(state.output || {}) };
  const { added, overflow } = addItems(stores, toAdd, opts);
  state.output = { ...overflow };

  const tools = state.tools ? [...state.tools] : [];
  state.tools = [];

  const ok = Object.keys(overflow).length === 0;
  return {
    ok,
    collected: added,
    leftover: overflow,
    tools,
  };
}

export function skipCostDiamonds(msLeft) {
  if (msLeft <= 0) return 0;
  return Math.ceil(msLeft / 60000) * 2;
}

export function plant(plot, stores, cropId, now) {
  if (!plot) return { ok: false, error: 'empty' };
  if (plot.crop) return { ok: false, error: 'busy' };

  const cropDef = CROPS[cropId];
  if (!cropDef) return { ok: false, error: 'bad_crop' };

  const seedReq = cropDef.plant;
  if (seedReq && Object.keys(seedReq).length > 0) {
    if (!stores || !hasItems(stores, seedReq)) {
      return { ok: false, error: 'missing_seed' };
    }
    takeItems(stores, seedReq);
  }

  plot.crop = cropId;
  plot.plantedAt = now;
  plot.readyAt = now + cropDef.ms;
  plot.wateredBy = null;

  return { ok: true };
}

export function water(plot, byUserId, now, ownerId = plot?.ownerId) {
  if (!plot || !plot.crop) return { ok: false, error: 'empty' };
  if (plot.readyAt <= now) return { ok: false, error: 'already_ready' };
  if (plot.wateredBy) return { ok: false, error: 'already_watered' };

  const effectiveOwner = ownerId || plot.ownerId;
  if (effectiveOwner && byUserId && byUserId === effectiveOwner) {
    return { ok: false, error: 'owner' };
  }

  const remaining = plot.readyAt - now;
  if (remaining > 0) {
    const reduction = Math.round(remaining * WATER_SPEEDUP);
    plot.readyAt -= reduction;
  }
  plot.wateredBy = byUserId || true;

  return { ok: true };
}

export function harvest(plot, stores, now, opts = {}) {
  if (!plot || !plot.crop) return { ok: false, error: 'empty' };
  if (plot.readyAt > now) return { ok: false, error: 'not_ready' };

  const cropId = plot.crop;
  const cropDef = CROPS[cropId];
  const yieldItems = cropDef ? { ...cropDef.yield } : {};

  if (stores) {
    addItems(stores, yieldItems, opts);
  }

  plot.crop = null;
  plot.plantedAt = 0;
  plot.readyAt = 0;
  plot.wateredBy = null;

  return { ok: true, items: yieldItems };
}

export function createProductionState() {
  return { queue: [], output: {}, tools: [] };
}

export function createStores(warehouseLv = 1, pantryLv = 1) {
  return {
    warehouse: { lv: warehouseLv, items: {} },
    pantry: { lv: pantryLv, items: {} },
  };
}

export function createPlot(ownerId = null) {
  return { crop: null, plantedAt: 0, readyAt: 0, wateredBy: null, ownerId };
}
