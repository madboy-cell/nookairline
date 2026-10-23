// server/basecamp_service.js — Stage 3 "Village Base Camp" (Master Plan v2 §4.2 / §11 / §14).
// The village no longer prints passive currency: it is a production base fed by Sky Frontier
// materials and rebuilt chapter by chapter through the story board.
//
// Every method takes the profile(s) it mutates and returns a small `{ ok, ... }` result object;
// the server persists (db.markProfile) and pushes the profile on ok. `now` / `rng` are injectable.
import { CORE, MAX_CORE_LV, DECOR } from '../shared/catalog_landmarks.js';
import { maxCopies, plotCap, utcDay, syncBuildingLevels, computeComfort } from '../shared/village_rules.js';
import {
  RECIPES, PRODUCTION_BUILDINGS, CROPS, addItems, hasItems, takeItems, canAdd, storeUpgradeCost, queueSlots,
  enqueue as prodEnqueue, collect as prodCollect, createProductionState, createPlot,
  plant as prodPlant, water as prodWater, harvest as prodHarvest,
} from '../shared/production_rules.js';
import {
  RESIDENTS, assignResident as ruleAssignResident, feedResidents, isFed, cottageCap, housingCap,
  buildingSpeedMult, buildingBonusChance, rollBonusOutput, MEAL_INTERVAL_MS,
} from '../shared/resident_rules.js';
import {
  MONUMENTS, CUT_WONDERS, CAMP_PROPS, COSMETIC_DECOR, PROTECTED_DECOR, CUT_DECOR,
  contributeStage, isUnlocked as monumentUnlocked, dailyWish, wellRestedBuff, propProduction,
} from '../shared/monument_rules.js';
import {
  ensureBoard, fillOrder as ruleFillOrder, discardOrder as ruleDiscardOrder, completeSlot,
  contributeBigOrder, bigOrderRewards, ORDER_CFG,
} from '../shared/order_rules.js';
import {
  CHAPTERS, defaultStory, recordEvent, claimChapter, unlockedBuildings, unlockedForVillage, unlockedRegions,
  currentSteps, isChapterComplete, BASE_ISLAND_SIZE,
} from '../shared/story_rules.js';
import { grantExp, storesOf, canPay, payCost } from './economy_service.js';
import { recalcPlayerCP } from '../shared/progression.js';

const fail = (error, extra = {}) => ({ ok: false, error, ...extra });

export const BUILD_COSTS = Object.freeze({
  windmill_bakery: Object.freeze({ wood: 20, stone: 10 }),
  patisserie: Object.freeze({ wood: 25, stone: 15, gold: 300 }),
  mint: Object.freeze({ stone: 30, wood: 15 }),
  workshop: Object.freeze({ wood: 30, stone: 20 }),
  flower_greenhouse: Object.freeze({ wood: 20, crystal_glass: 4 }),
  owl_post_office: Object.freeze({ wood: 15, plank: 10 }),
  cottage: Object.freeze({ plank: 20, stone: 10 }),
  farm_plot: Object.freeze({ wood: 4 }),
  tent: Object.freeze({ wood: 8 }),
  nest: Object.freeze({ plank: 20, herb: 5 }),
});
export const DEFAULT_BUILD_COST = Object.freeze({ plank: 30, ingot: 10 });
export const MAX_STORE_LV = 10;

/** Material + gold cost to construct copy #`copyIndex` (0-based) of `type`. Copies after the first cost ×2. */
export function buildCost(type, copyIndex = 0) {
  const base = BUILD_COSTS[type] || DEFAULT_BUILD_COST;
  const mult = (copyIndex | 0) >= 1 ? 2 : 1;
  const out = {};
  for (const [k, n] of Object.entries(base)) out[k] = n * mult;
  return out;
}

/** Cost to raise a building from `lv` to `lv + 1` (zeros omitted). */
export function upgradeCost(type, lv) {
  const l = Math.max(1, lv | 0 || 1);
  const out = { plank: 8 * l, ingot: l >= 3 ? 4 * l : 0, gold: 200 * l };
  for (const k of Object.keys(out)) if (!out[k]) delete out[k];
  return out;
}

/** Highest Castle level the story allows: completed chapters × 2 + 2 (and never above 10). */
export const castleLevelCap = (story) => Math.min(MAX_CORE_LV, (Array.isArray(story?.completed) ? story.completed.length : 0) * 2 + 2);

// ---------------------------------------------------------------------------------------------
// Stage 5 — Residents · Monuments · Camp Props (Master Plan v2 §11.3–§11.5, §14)
// ---------------------------------------------------------------------------------------------
/** Residents eat lazily: at most once per 10 min on bc_* actions (always on join). */
export const FEED_TICK_MS = 10 * 60_000;
/** Capybara Hot Spring soak cooldown. */
export const ONSEN_COOLDOWN_MS = 4 * 3600_000;
/** Fountain of Wishes daily wish price (gold). */
export const WISH_COST = MONUMENTS.wnd_fountain.effect.cost || 100;
/** Monument-only recipes (production_rules.RECIPES stays the canonical building list). */
export const EXTRA_RECIPES = Object.freeze({
  matcha_tea: Object.freeze({
    id: 'matcha_tea', building: 'wnd_tea_pavilion', monument: 'wnd_tea_pavilion',
    inputs: Object.freeze({ herb: 3, honey: 1 }), outputs: Object.freeze({ matcha_tea: 1 }), ms: 300_000, minLv: 1,
  }),
});
/** Monument building type → recipe ids brewed there. */
export const EXTRA_BUILDINGS = Object.freeze({ wnd_tea_pavilion: Object.freeze(['matcha_tea']) });
export const LAUNCH_MONUMENTS = Object.freeze(Object.keys(MONUMENTS).filter((k) => MONUMENTS[k].launch));
/** Everything the Craft tab may build: 8 Camp Props + 12 cosmetics (cut + protected decor excluded). */
export const CRAFTABLE_DECOR = Object.freeze([...Object.keys(CAMP_PROPS), ...Object.keys(COSMETIC_DECOR)]
  .filter((k) => DECOR[k] && !CUT_DECOR.includes(k) && !PROTECTED_DECOR.includes(k)));
export const decorCraftCost = (key) => (CAMP_PROPS[key] || COSMETIC_DECOR[key])?.cost || null;
/** Berry Wheelbarrow: +10% warehouse capacity (once, doesn't stack). */
export const WHEELBARROW_PCT = CAMP_PROPS.dec_berry_wheelbarrow.effect.storagePct || 10;
export const isCutWonder = (key) => CUT_WONDERS.includes(key);

const recipeDef = (id) => RECIPES[id] || EXTRA_RECIPES[id] || null;
const placedOf = (v, type) => (Array.isArray(v?.buildings) ? v.buildings.filter((b) => b.type === type).length : 0);
const placedTypeSet = (v) => new Set((v?.buildings || []).map((b) => b.type));
/** Residents currently staffing a building (they occupy a cottage bed). */
const assignedCount = (v, exceptId = null) => (v.residents || []).filter((r) => r && r.building && r.id !== exceptId).length;
const monumentStage = (v, id) => Math.max(v.monuments?.[id]?.stage | 0, 0);

function ensureStory(p) {
  if (!p.story || typeof p.story !== 'object' || typeof p.story.chapter !== 'number') p.story = defaultStory();
  return p.story;
}

function ensureVillage(p) {
  const v = p.village;
  v.copies = v.copies || {};
  v.levels = v.levels || {};
  if (!v.production || typeof v.production !== 'object') v.production = {};
  if (!v.plots || typeof v.plots !== 'object') v.plots = {};
  if (!Array.isArray(v.residents)) v.residents = [];
  if (!Array.isArray(v.monument_unlocks)) v.monument_unlocks = [];
  if (!Number.isInteger(v.max_grid)) v.max_grid = BASE_ISLAND_SIZE;
  if (!v.monuments || typeof v.monuments !== 'object') v.monuments = {};
  if (!v.prop_state || typeof v.prop_state !== 'object') v.prop_state = {};
  v.wonders = v.wonders || {};
  v.decor = v.decor || {};
  // residents: resident_rules uses `building`; older Stage-3 rows used `assignedTo`
  for (const r of v.residents) {
    if (!r || typeof r !== 'object') continue;
    if (r.building === undefined) r.building = r.assignedTo ?? null;
    r.assignedTo = r.building ?? null;
    if (!Number.isFinite(r.fedUntil)) r.fedUntil = 0;
    if (!Number.isFinite(r.mood)) r.mood = 50;
  }
  return v;
}

/** Story progress hook for other services (frontier gather / visit / defeat, crafting, building…). */
export function recordStory(p, event) {
  if (!p || !event) return [];
  return recordEvent(ensureStory(p), event);
}

function refresh(p) {
  syncBuildingLevels(p.village);
  p.village.comfort = computeComfort(p.village);
  p.cp = recalcPlayerCP(p);
}

const placedBuilding = (v, uid) => (Array.isArray(v.buildings) ? v.buildings.find((b) => b.uid === uid) : null) || null;

/** Placed counts per type (used by the village_save_grid → story 'build' hook). */
export function placedCounts(v) {
  const out = {};
  for (const b of v?.buildings || []) out[b.type] = (out[b.type] || 0) + 1;
  return out;
}

export function createBasecampService({ db = null, rng = Math.random, now = () => Date.now() } = {}) {
  const clock = () => (typeof now === 'function' ? now() : Number(now) || Date.now());

  // ------------------------------------------------------------------------------------------
  // Construction + upgrades
  // ------------------------------------------------------------------------------------------
  function construct(p, type) {
    type = String(type || '');
    if (!CORE[type]) return fail('bad_type');
    if (type === 'castle') return fail('unique');
    const story = ensureStory(p);
    const v = ensureVillage(p);
    if (!unlockedForVillage(story, v).includes(type)) return fail('locked', { building: type });
    const have = v.copies[type] | 0;
    const cap = type === 'farm_plot' ? plotCap(v.castle_lv) : maxCopies(v, type);
    if (have >= cap) return fail(type === 'farm_plot' ? 'plot_cap' : 'max_copies', { cap });
    // §11.3: Comfort sets how many Settler Cottages you may build (1 → 4)
    if (type === 'cottage' && have >= cottageCap(v.comfort)) return fail('cottage_cap', { cap: cottageCap(v.comfort), comfort: v.comfort | 0 });
    const cost = buildCost(type, have);
    const paid = payCost(p, cost);
    if (!paid.ok) return paid;
    v.copies[type] = have + 1;
    refresh(p);
    return { ok: true, building: type, copies: v.copies[type], cost };
  }

  function upgrade(p, type) {
    type = String(type || '');
    if (!CORE[type]) return fail('bad_type');
    const story = ensureStory(p);
    const v = ensureVillage(p);
    const isCastle = type === 'castle';
    if (!isCastle && (v.copies[type] | 0) < 1) return fail('not_built');
    const lv = isCastle ? (v.castle_lv || 1) : (v.levels[type] || 1);
    if (lv >= MAX_CORE_LV) return fail('max_level');
    if (isCastle && lv + 1 > castleLevelCap(story)) return fail('story_locked', { cap: castleLevelCap(story) });
    const cost = upgradeCost(type, lv);
    const paid = payCost(p, cost);
    if (!paid.ok) return paid;
    if (isCastle) { v.castle_lv = lv + 1; v.castle_ruins = false; } else v.levels[type] = lv + 1;
    refresh(p);
    return { ok: true, building: type, lv: lv + 1, cost };
  }

  // ------------------------------------------------------------------------------------------
  // Production queues
  // ------------------------------------------------------------------------------------------
  function enqueue(p, uid, recipeId) {
    const v = ensureVillage(p);
    const b = placedBuilding(v, String(uid || ''));
    if (!b) return fail('not_placed');
    recipeId = String(recipeId || '');
    const t = clock();
    if (EXTRA_BUILDINGS[b.type]) return enqueueExtra(p, v, b, recipeId, t);
    if (!PRODUCTION_BUILDINGS[b.type]) return fail('not_production');
    const lv = b.type === 'castle' ? v.castle_lv : (v.levels[b.type] || 1);
    const state = (v.production[b.uid] ||= createProductionState());
    // §11.3: a resident staffing this building type speeds the job up (half bonus when hungry)
    const speedMult = buildingSpeedMult(v.residents, b.type, t);
    const r = prodEnqueue(state, storesOf(p), recipeId, b.type, lv, t, { speedMult });
    if (!r.ok) return r;
    return { ok: true, uid: b.uid, recipe: recipeId, queue: state.queue, speedMult };
  }

  /** Monument-only recipes (Matcha Tea House → matcha_tea). Same queue shape as production_rules. */
  function enqueueExtra(p, v, b, recipeId, t) {
    const recipe = EXTRA_RECIPES[recipeId];
    if (!recipe) return fail('bad_recipe');
    if (recipe.building !== b.type) return fail('wrong_building');
    if (monumentStage(v, recipe.monument) < 1 && !v.wonders?.[recipe.monument]) return fail('monument_not_built');
    const state = (v.production[b.uid] ||= createProductionState());
    state.queue ||= []; state.output ||= {}; state.tools ||= [];
    const lv = v.wonders?.[b.type]?.stars || 1;
    if (state.queue.length >= queueSlots(lv)) return fail('queue_full');
    const stores = storesOf(p);
    if (!hasItems(stores, recipe.inputs)) return fail('missing_inputs');
    takeItems(stores, recipe.inputs);
    const last = state.queue[state.queue.length - 1];
    const startAt = last ? Math.max(t, last.doneAt) : t;
    state.queue.push({ recipe: recipeId, startAt, doneAt: startAt + recipe.ms });
    return { ok: true, uid: b.uid, recipe: recipeId, queue: state.queue, speedMult: 1 };
  }

  /**
   * Settle finished jobs ahead of production_rules.collect: monument recipes (unknown to RECIPES) move
   * into `state.output` here, and every finished job rolls the staff resident's bonus output.
   */
  function presettle(v, b, state, t) {
    if (!state || !Array.isArray(state.queue)) return {};
    state.output ||= {};
    const chance = b ? buildingBonusChance(v.residents, b.type, t) : 0;
    const bonus = {};
    const keep = [];
    for (const job of state.queue) {
      if (!(job.doneAt <= t)) { keep.push(job); continue; }
      const extra = EXTRA_RECIPES[job.recipe];
      const rec = recipeDef(job.recipe);
      if (extra) {
        for (const [k, n] of Object.entries(extra.outputs)) state.output[k] = (state.output[k] || 0) + n;
      } else keep.push(job);          // RECIPES jobs: production_rules.settle pays the base output
      if (rec?.outputs && !rec.tool && chance > 0) {
        for (const [k, n] of Object.entries(rollBonusOutput(rec.outputs, chance, rng))) bonus[k] = (bonus[k] || 0) + n;
      }
    }
    state.queue = keep;
    for (const [k, n] of Object.entries(bonus)) state.output[k] = (state.output[k] || 0) + n;
    return bonus;
  }

  function collect(p, uid) {
    const v = ensureVillage(p);
    const state = v.production[uid];
    if (!state) return fail('nothing_to_collect');
    const t = clock();
    const bonus = presettle(v, placedBuilding(v, uid), state, t);
    const r = prodCollect(state, storesOf(p), t);
    const tb = (p.frontier.toolbelt ||= { pickaxe: 1, axe: 1, staff: 0, main: 'pickaxe', enchants: {} });
    const tools = [];
    for (const t of r.tools || []) {
      tb[t.kind] = Math.max(tb[t.kind] | 0, t.tier | 0);
      tools.push(t);
      const recipe = Object.values(RECIPES).find((rc) => rc.tool && rc.tool.kind === t.kind && rc.tool.tier === t.tier);
      recordStory(p, { kind: 'craft', target: recipe ? recipe.id : `tool_${t.kind}_${t.tier}`, amount: 1 });
    }
    for (const [item, n] of Object.entries(r.collected || {})) if (n > 0) recordStory(p, { kind: 'craft', target: item, amount: n });
    const got = Object.keys(r.collected || {}).length + tools.length;
    if (!got) return fail(Object.keys(r.leftover || {}).length ? 'storage_full' : 'nothing_to_collect', { leftover: r.leftover });
    return { ok: true, uid, collected: r.collected, leftover: r.leftover, tools, toolbelt: tb, bonus };
  }

  function collectAll(p) {
    const v = ensureVillage(p);
    const collected = {};
    const tools = [];
    let leftover = {};
    for (const uid of Object.keys(v.production)) {
      if (!placedBuilding(v, uid)) continue;
      const r = collect(p, uid);
      if (!r.ok) { if (r.leftover) leftover = { ...leftover, ...r.leftover }; continue; }
      for (const [k, n] of Object.entries(r.collected)) collected[k] = (collected[k] || 0) + n;
      tools.push(...r.tools);
      for (const [k, n] of Object.entries(r.leftover || {})) leftover[k] = (leftover[k] || 0) + n;
    }
    if (!Object.keys(collected).length && !tools.length) return fail('nothing_to_collect', { leftover });
    return { ok: true, collected, tools, leftover };
  }

  // ------------------------------------------------------------------------------------------
  // Farm plots
  // ------------------------------------------------------------------------------------------
  function plotFor(owner, uid) {
    const v = ensureVillage(owner);
    const b = placedBuilding(v, String(uid || ''));
    if (!b || b.type !== 'farm_plot') return null;
    const plot = (v.plots[b.uid] ||= createPlot(owner.id));
    if (!plot.ownerId) plot.ownerId = owner.id;
    return plot;
  }

  function plant(p, uid, cropId) {
    const plot = plotFor(p, uid);
    if (!plot) return fail('not_plot');
    if (!CROPS[cropId]) return fail('bad_crop');
    const r = prodPlant(plot, storesOf(p), String(cropId), clock());
    if (!r.ok) return r;
    return { ok: true, uid, plot };
  }

  function water(visitor, owner, uid) {
    if (!visitor || !owner) return fail('no_owner');
    if (visitor.id === owner.id) return fail('owner');
    const plot = plotFor(owner, uid);
    if (!plot) return fail('not_plot');
    const r = prodWater(plot, visitor.id, clock(), owner.id);
    if (!r.ok) return r;
    return { ok: true, owner: owner.id, uid, readyAt: plot.readyAt };
  }

  function harvestPlot(p, uid) {
    const plot = plotFor(p, uid);
    if (!plot) return fail('not_plot');
    const crop = plot.crop;
    const r = prodHarvest(plot, storesOf(p), clock());
    if (!r.ok) return r;
    recordStory(p, { kind: 'harvest', target: crop, amount: 1 });
    for (const [k, n] of Object.entries(r.items || {})) {
      if (n > 0) recordStory(p, { kind: 'gather', target: k, amount: n });
    }
    return { ok: true, uid, crop, items: r.items };
  }

  // ------------------------------------------------------------------------------------------
  // Order board
  // ------------------------------------------------------------------------------------------
  function orderUnlockedItems(p) {
    const v = ensureVillage(p);
    const items = new Set(['sky_wheat', 'berries_crop']);
    for (const r of Object.values(RECIPES)) {
      if ((v.copies[r.building] | 0) < 1) continue;
      for (const id of Object.keys(r.outputs || {})) items.add(id);
    }
    return [...items];
  }

  function orderBoard(p, t = clock()) {
    const story = ensureStory(p);
    const v = ensureVillage(p);
    if (!unlockedForVillage(story, v).includes('owl_post_office')) return fail('locked');
    const slots = ((v.levels.owl_post_office || 1) >= 3 ? ORDER_CFG.SLOTS_COURIER : ORDER_CFG.SLOTS_BASE)
      + (placedOf(v, 'dec_owl_mailbox') > 0 ? (CAMP_PROPS.dec_owl_mailbox.effect.orderSlots || 1) : 0);   // Owl Mailbox camp prop
    p.orders = ensureBoard(p.orders || null, { slots, unlockedItems: orderUnlockedItems(p), rng, now: t, day: utcDay(t) });
    return { ok: true, board: p.orders };
  }

  function fillOrder(p, slotIdx) {
    const t = clock();
    const b = orderBoard(p, t);
    if (!b.ok) return b;
    const idx = slotIdx | 0;
    const order = p.orders.slots[idx];
    if (!order) return fail('empty_slot');
    const stores = storesOf(p);
    const r = ruleFillOrder(order, (it) => hasItems(stores, it), (it) => takeItems(stores, it));
    if (!r.ok) return r;
    p.gold = (p.gold || 0) + (order.gold || 0);
    const levelsGained = order.xp ? grantExp(p, order.xp) : 0;
    const extra = addItems(stores, order.extra || {});
    recordStory(p, { kind: 'deliver_orders', target: null, amount: 1 });
    completeSlot(p.orders, idx, t);
    return { ok: true, slot: idx, gold: order.gold || 0, xp: order.xp || 0, extra: extra.added, levelsGained, board: p.orders };
  }

  function discardOrder(p, slotIdx) {
    const t = clock();
    const b = orderBoard(p, t);
    if (!b.ok) return b;
    const idx = slotIdx | 0;
    if (idx < 0 || idx >= p.orders.slots.length || !p.orders.slots[idx]) return fail('empty_slot');
    ruleDiscardOrder(p.orders, idx, t);
    return { ok: true, slot: idx, board: p.orders };
  }

  /** Contribute to `owner`'s (default: own) Big Order; on completion pay every contributor. */
  function contributeBig(p, items, owner = p) {
    const t = clock();
    const b = orderBoard(owner, t);
    if (!b.ok) return b;
    const big = owner.orders.big;
    if (!big) return fail('no_big_order');
    const stores = storesOf(p);
    const clean = {};
    for (const [k, n] of Object.entries(items || {})) if (typeof k === 'string' && Number(n) > 0) clean[k] = Math.floor(Number(n));
    const r = contributeBigOrder(big, p.id, clean, (it) => hasItems(stores, it), (it) => takeItems(stores, it));
    if (!r.ok) return r;
    let rewards = null;
    if (r.complete && !big.rewarded) {
      big.rewarded = true;
      rewards = bigOrderRewards(big);
      for (const [uid, rw] of Object.entries(rewards)) {
        const prof = uid === p.id ? p : uid === owner.id ? owner : db?.getProfile?.(uid);
        if (!prof) continue;
        prof.gold = (prof.gold || 0) + (rw.gold || 0);
        if (rw.xp) grantExp(prof, rw.xp);
        if (prof !== p) db?.markProfile?.(prof.id);
      }
    }
    if (owner !== p) db?.markProfile?.(owner.id);
    return { ok: true, contributed: r.contributed, complete: r.complete, rewards, big };
  }

  // ------------------------------------------------------------------------------------------
  // Story board
  // ------------------------------------------------------------------------------------------
  function storyState(p) {
    const story = ensureStory(p);
    const ch = CHAPTERS.find((c) => c.id === story.chapter) || null;
    return {
      ok: true,
      chapter: story.chapter,
      title: ch?.title || null,
      steps: currentSteps(story),
      complete: isChapterComplete(story),
      done: !ch,
      rewards: ch?.rewards || null,
      unlockedBuildings: unlockedForVillage(story, ensureVillage(p)),
    };
  }

  function claimStory(p) {
    const story = ensureStory(p);
    const v = ensureVillage(p);
    const chapterId = story.chapter;
    const r = claimChapter(story);
    if (!r.ok) return r;
    const rw = r.rewards || {};
    if (rw.gold) p.gold = (p.gold || 0) + rw.gold;
    const items = rw.items && Object.keys(rw.items).length ? addItems(storesOf(p), rw.items).added : {};
    p.frontier.unlocks ||= { regions: ['meadow'], gates: [] };
    p.frontier.unlocks.gates ||= [];
    const regions = new Set([...(p.frontier.unlocks.regions || []), ...unlockedRegions(story)]);
    if (story.chapter >= 2 || story.completed?.includes?.(1)) {
      regions.add('hollow');
      if (!p.frontier.unlocks.gates.includes('hollow')) p.frontier.unlocks.gates.push('hollow');
    }
    p.frontier.unlocks.regions = [...regions];
    for (const id of rw.residents || []) {
      if (!v.residents.some((x) => x.id === id)) v.residents.push({ id, building: null, assignedTo: null, fedUntil: 0, mood: 50 });
    }
    if (Number.isInteger(rw.expandTo)) v.max_grid = Math.max(v.max_grid || BASE_ISLAND_SIZE, rw.expandTo);
    for (const m of [rw.unlockMonument, ...(rw.unlockMonuments || [])]) {
      if (m && !v.monument_unlocks.includes(m)) v.monument_unlocks.push(m);
    }
    if (chapterId === 0) v.castle_ruins = false;   // Landfall: the Keep is cleared of rubble
    return {
      ok: true,
      claimed: chapterId,
      chapter: story.chapter,
      gold: rw.gold || 0,
      items,
      unlockBuildings: rw.unlockBuildings || [],
      regions: p.frontier.unlocks.regions,
      residents: v.residents,
      max_grid: v.max_grid,
      monument_unlocks: v.monument_unlocks,
    };
  }

  // ------------------------------------------------------------------------------------------
  // Warehouse / pantry
  // ------------------------------------------------------------------------------------------
  function storeUpgrade(p, kind) {
    if (kind !== 'warehouse' && kind !== 'pantry') return fail('bad_store');
    const stores = storesOf(p);
    const lv = stores[kind].lv || 1;
    if (lv >= MAX_STORE_LV) return fail('max_level');
    const cost = storeUpgradeCost(kind, lv);
    const chk = canPay(p, cost);
    if (!chk.ok) return chk;
    payCost(p, cost);
    stores[kind].lv = lv + 1;
    return { ok: true, kind, lv: lv + 1, cost };
  }

  /** village_save_grid hook: story 'build' events for every type whose placed count increased. */
  function onLayoutSaved(p, before) {
    const after = placedCounts(p.village);
    const built = [];
    for (const [type, n] of Object.entries(after)) {
      if (n > (before?.[type] || 0)) { recordStory(p, { kind: 'build', target: type }); built.push(type); }
    }
    return built;
  }

  // ------------------------------------------------------------------------------------------
  // Stage 5: lazy tick (feeding + camp-prop production + passive prop effects)
  // ------------------------------------------------------------------------------------------
  /** Accrue Beehive / Koi Pond output into `v.prop_state[uid].ready` (6-cycle cap per prop). */
  function tickProps(v, t) {
    const live = new Set();
    for (const b of v.buildings || []) {
      const def = CAMP_PROPS[b.type];
      const produces = def?.effect?.produces;
      if (!produces) continue;
      live.add(b.uid);
      const st = (v.prop_state[b.uid] ||= { type: b.type, lastAt: t, ready: {} });
      st.type = b.type; st.ready ||= {};
      const r = propProduction(b.type, Number(st.lastAt) || t, t);
      for (const [k, n] of Object.entries(r.items)) {
        const cap = (produces[k] || 1) * 6;
        st.ready[k] = Math.min(cap, (st.ready[k] || 0) + n);
      }
      st.lastAt = r.nextLastAt;
    }
    for (const uid of Object.keys(v.prop_state)) if (!live.has(uid)) delete v.prop_state[uid];
  }

  /**
   * Called on join (force) and before every bc_* action. Residents eat from the pantry at most once per
   * FEED_TICK_MS; camp props accrue; wheelbarrow / telescope / picnic / hammock flags refresh.
   */
  function tick(p, { force = false } = {}) {
    if (!p?.village) return { ok: true, fed: null };
    const v = ensureVillage(p);
    const t = clock();
    const stores = storesOf(p);
    let fed = null;
    if (force || !(t - (v.bc_fed_at || 0) < FEED_TICK_MS)) {
      v.bc_fed_at = t;
      if (v.residents.length) fed = feedResidents(v.residents, stores.pantry.items, t);
    }
    tickProps(v, t);
    const types = placedTypeSet(v);
    // Berry Wheelbarrow: +10% warehouse cap (read by production_rules.warehouseCapOf)
    stores.warehouse.capPct = types.has('dec_berry_wheelbarrow') ? WHEELBARROW_PCT : 0;
    // Flag-only props (Stage 6/7 polish: event preview, visitor picnic buff, couple hammock buff)
    v.prop_flags = {
      telescope: types.has('dec_starlight_telescope'),
      picnic: types.has('dec_picnic'),
      hammock: types.has('dec_couple_hammock'),
    };
    return { ok: true, fed };
  }

  // ------------------------------------------------------------------------------------------
  // Stage 5: Residents (§11.3)
  // ------------------------------------------------------------------------------------------
  function residentsState(p) {
    const v = ensureVillage(p);
    const t = clock();
    const cottages = placedOf(v, 'cottage');
    return {
      ok: true,
      residents: v.residents.map((r) => {
        const def = RESIDENTS[r.id] || {};
        return {
          id: r.id, name: def.name || r.id, emoji: def.emoji || '🧑', home: def.building || null,
          building: r.building || null, fed: isFed(r, t), fedUntil: r.fedUntil || 0, mood: Math.round(r.mood ?? 50),
          speedMult: r.building ? buildingSpeedMult(v.residents, r.building, t) : 1,
          bonusChance: r.building ? buildingBonusChance(v.residents, r.building, t) : 0,
          homePlaced: !!def.building && placedOf(v, def.building) > 0,
        };
      }),
      housing: { used: assignedCount(v), cap: housingCap(cottages), cottages },
      cottageCap: cottageCap(v.comfort),
      mealEveryMs: MEAL_INTERVAL_MS,
    };
  }

  /** bc_resident_assign { residentId, building } — building null/'' unassigns. */
  function assignResident(p, residentId, building) {
    const v = ensureVillage(p);
    residentId = String(residentId || '');
    const res = v.residents.find((r) => r && r.id === residentId);
    if (!res) return fail(RESIDENTS[residentId] ? 'not_resident' : 'unknown');
    const target = building ? String(building) : null;
    if (target && !res.building) {
      const cap = housingCap(placedOf(v, 'cottage'));
      if (assignedCount(v, residentId) + 1 > cap) return fail('no_housing', { cap });
    }
    const r = ruleAssignResident(v.residents, residentId, target, placedTypeSet(v));
    if (!r.ok) return r;
    res.assignedTo = res.building ?? null;
    return { ok: true, residentId, building: res.building ?? null, ...residentsState(p) };
  }

  // ------------------------------------------------------------------------------------------
  // Stage 5: Monuments (§11.4) — built in stages from materials + gold; stage 1 = ownership
  // ------------------------------------------------------------------------------------------
  /** monument_rules state view over v.monuments (entries are shared references). */
  function monumentRuleState(v) {
    for (const id of Object.keys(MONUMENTS)) v.monuments[id] ||= { stage: 0, built: false };
    return { unlocked: [...v.monument_unlocks], ...v.monuments };
  }

  function monumentsState(p) {
    const v = ensureVillage(p);
    const st = monumentRuleState(v);
    const t = clock();
    const placed = placedTypeSet(v);
    return {
      ok: true,
      monuments: LAUNCH_MONUMENTS.map((id) => {
        const def = MONUMENTS[id];
        const m = v.monuments[id];
        return {
          id, name: def.name, stage: m.stage | 0, stages: def.stages.length, built: !!m.built,
          unlocked: monumentUnlocked(id, st.unlocked, st), nextCost: def.stages[m.stage | 0] || null,
          owned: !!v.wonders[id], placed: placed.has(id), heartIsleOnly: !!def.heartIsleOnly, effect: def.effect,
        };
      }),
      wishDay: v.wish_day ?? null, wishedToday: v.wish_day === utcDay(t),
      onsenReadyAt: (v.onsen_used_at || 0) + ONSEN_COOLDOWN_MS,
      restBuff: p.frontier?.restBuff || null,
    };
  }

  /** bc_monument_contribute { monument } — pays the current stage (atomic). */
  function contributeMonument(p, id) {
    id = String(id || '');
    const def = MONUMENTS[id];
    if (!def) return fail(isCutWonder(id) ? 'retired' : 'bad_monument');
    if (!def.launch) return fail('locked');
    const v = ensureVillage(p);
    const st = monumentRuleState(v);
    const m = v.monuments[id];
    if (!monumentUnlocked(id, st.unlocked, st)) return fail('locked');
    if (m.built || (m.stage | 0) >= def.stages.length) return fail('done');
    const cost = def.stages[m.stage | 0];
    const chk = canPay(p, cost);
    if (!chk.ok) return chk;
    const stores = storesOf(p);
    const purse = { gold: p.gold || 0 };
    const r = contributeStage(st, id, stores, (items) => takeItems(stores, items), purse);
    if (!r.ok) return r;
    p.gold = purse.gold;
    for (const u of st.unlocked) if (!v.monument_unlocks.includes(u)) v.monument_unlocks.push(u);
    // ownership → the grid editor can place it (ownedCount reads v.wonders); stars mirror the stage
    v.wonders[id] = { ...(v.wonders[id] || {}), stars: Math.max(v.wonders[id]?.stars | 0, r.stage) };
    refresh(p);
    return { ok: true, monument: id, stage: r.stage, built: r.built, cost, ...monumentsState(p) };
  }

  const monumentReady = (v, id) => monumentStage(v, id) >= 1 && placedOf(v, id) > 0;

  /** bc_monument_use { monument: 'wnd_onsen' } — Well-Rested soak (once per 4 h). */
  function useMonument(p, id) {
    id = String(id || '');
    if (id !== 'wnd_onsen') return fail('bad_monument');
    const v = ensureVillage(p);
    if (!monumentReady(v, id)) return fail(monumentStage(v, id) >= 1 ? 'not_placed' : 'not_built');
    const t = clock();
    if (t - (v.onsen_used_at || 0) < ONSEN_COOLDOWN_MS) return fail('cooldown', { readyAt: (v.onsen_used_at || 0) + ONSEN_COOLDOWN_MS });
    v.onsen_used_at = t;
    p.frontier ||= {};
    // TODO(sky_frontier_service owner): read p.frontier.restBuff ({ yieldPct: 15, until }) in the frontier
    // strike / gather yield calculation while `until > now` (stacks like mealBuff 'yield').
    p.frontier.restBuff = wellRestedBuff(t);
    return { ok: true, monument: id, buff: p.frontier.restBuff, readyAt: t + ONSEN_COOLDOWN_MS };
  }

  /** bc_wish — Fountain of Wishes: once per UTC day, 100 gold → dailyWish() rare-ish material. */
  function wish(p) {
    const v = ensureVillage(p);
    if (!monumentReady(v, 'wnd_fountain')) return fail(monumentStage(v, 'wnd_fountain') >= 1 ? 'not_placed' : 'not_built');
    const t = clock();
    const day = utcDay(t);
    if (v.wish_day === day) return fail('already_wished_today');
    if ((p.gold || 0) < WISH_COST) return fail('not_enough_gold', { cost: WISH_COST });
    const items = dailyWish(rng);
    const stores = storesOf(p);
    if (!canAdd(stores, items).ok) return fail('storage_full');
    p.gold -= WISH_COST;
    v.wish_day = day;
    const added = addItems(stores, items).added;
    return { ok: true, items: added, cost: WISH_COST, wishDay: day };
  }

  // ------------------------------------------------------------------------------------------
  // Stage 5: Camp Props + cosmetic decor (§11.5)
  // ------------------------------------------------------------------------------------------
  /** bc_craft_decor { decor } — crafts one owned copy (the grid editor places it). */
  function craftDecor(p, key) {
    key = String(key || '');
    if (!DECOR[key]) return fail('bad_decor');
    if (PROTECTED_DECOR.includes(key) || CUT_DECOR.includes(key) || !CRAFTABLE_DECOR.includes(key)) return fail('not_craftable');
    const cost = decorCraftCost(key);
    const paid = payCost(p, cost);
    if (!paid.ok) return paid;
    const v = ensureVillage(p);
    v.decor[key] = (v.decor[key] | 0) + 1;
    refresh(p);
    return { ok: true, decor: key, owned: v.decor[key], cost };
  }

  /** bc_tent_bread — Tent & Campfire camp prop: 1 free Bread per UTC day. */
  function tentBread(p) {
    const v = ensureVillage(p);
    if (!placedOf(v, 'dec_tent')) return fail('no_tent');
    const day = utcDay(clock());
    if (v.tent_bread_day === day) return fail('already_claimed_today');
    const stores = storesOf(p);
    if (!canAdd(stores, { bread: 1 }).ok) return fail('storage_full');
    addItems(stores, { bread: 1 });
    v.tent_bread_day = day;
    return { ok: true, items: { bread: 1 }, day };
  }

  /** bc_props_collect — move Beehive / Koi Pond output into the stores (overflow stays on the prop). */
  function collectProps(p) {
    const v = ensureVillage(p);
    tickProps(v, clock());
    const stores = storesOf(p);
    const collected = {};
    for (const st of Object.values(v.prop_state)) {
      if (!st.ready || !Object.keys(st.ready).length) continue;
      const r = addItems(stores, st.ready);
      for (const [k, n] of Object.entries(r.added)) collected[k] = (collected[k] || 0) + n;
      st.ready = r.overflow;
    }
    if (!Object.keys(collected).length) return fail('nothing_to_collect');
    return { ok: true, collected };
  }

  return {
    buildCost, upgradeCost, construct, upgrade,
    enqueue, collect, collectAll,
    plant, water, harvestPlot,
    orderBoard, fillOrder, discardOrder, contributeBig,
    storyState, claimStory, recordStory,
    storeUpgrade, onLayoutSaved, placedCounts,
    tick, residentsState, assignResident,
    monumentsState, contributeMonument, useMonument, wish,
    craftDecor, tentBread, collectProps,
  };
}
