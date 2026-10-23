// tests/basecamp_service.test.js — Stage 3 "Village Base Camp" server service + WS wiring.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { WebSocket } from 'ws';

import { createBasecampService, buildCost, upgradeCost, castleLevelCap } from '../server/basecamp_service.js';
import * as eco from '../server/economy_service.js';
import { createStarterProfile } from '../server/profile_factory.js';
import { CHAPTERS } from '../shared/story_rules.js';
import { plotCap, ownedCount, bagContents, validateLayout } from '../shared/village_rules.js';
import { startServer } from '../server/server.js';

const T0 = Date.UTC(2026, 9, 22, 10, 0, 0);

function setup() {
  const clock = { t: T0 };
  const profiles = new Map();
  const marked = [];
  const db = { getProfile: (id) => profiles.get(id) || null, markProfile: (id) => marked.push(id) };
  const bc = createBasecampService({ db, rng: () => 0.42, now: () => clock.t });
  const mk = (id) => { const p = createStarterProfile(id, 'pw12', 'bkk'); profiles.set(id, p); return p; };
  return { clock, db, bc, mk, marked };
}

const items = (p) => p.frontier.warehouse.items;
const pantry = (p) => p.frontier.pantry.items;
/** Jump the story to chapter `n` with chapters 0..n-1 claimed. */
function atChapter(p, n) {
  p.story = { chapter: n, progress: {}, completed: [...Array(n).keys()], claimed: [...Array(n).keys()] };
}
function completeCurrent(p) {
  const ch = CHAPTERS.find((c) => c.id === p.story.chapter);
  for (const s of ch.steps) p.story.progress[s.id] = s.count;
}
function place(p, type, uid, x, y) {
  p.village.buildings.push({ uid, type, x, y, rot: 0 });
}

test('catalog + ownership v2: plot cap, uncapped base-camp types, bag lists new cores', () => {
  assert.equal(plotCap(1), 6); assert.equal(plotCap(4), 12); assert.equal(plotCap(30), 24);
  const p = createStarterProfile('own', 'pw12', 'bkk');
  const v = p.village;
  assert.equal(ownedCount(v, 'castle'), 1);
  assert.equal(ownedCount(v, 'mint'), 0, 'not constructed yet');
  assert.equal(ownedCount(v, 'farm_plot'), 2);
  v.copies.cottage = 9;
  assert.equal(ownedCount(v, 'cottage'), 4);
  v.copies.tent = 1; v.copies.workshop = 1;
  const bag = bagContents(v);
  assert.equal(bag.tent, 1); assert.equal(bag.workshop, 1); assert.equal(bag.cottage, 4);
  // farm plots / tents / cottages don't count toward the castle `core` cap (5 at Castle Lv1)
  v.copies.farm_plot = 6;
  const L = { buildings: [...v.buildings], tiles: v.tiles };
  for (const [i, [x, y]] of [[0, 0], [2, 0], [0, 13], [2, 15], [14, 13], [14, 15], [14, 0], [12, 15]].entries()) {
    const type = i < 4 ? 'farm_plot' : i < 5 ? 'tent' : 'cottage';
    L.buildings.push({ type, x, y, rot: 0 });
  }
  assert.ok(validateLayout(v, L).ok, JSON.stringify(validateLayout(v, L)));
});

test('construct: story-locked, pays materials + gold, 2nd copy ×2, plot cap', () => {
  const { bc, mk } = setup();
  const p = mk('builder');
  assert.equal(bc.construct(p, 'tent').error, 'locked');
  assert.equal(bc.construct(p, 'castle').error, 'unique');
  assert.equal(bc.construct(p, 'nope').error, 'bad_type');
  // Chapter 0 "Landfall" unlocks tent + farm_plot
  completeCurrent(p);
  const g0 = p.gold;
  const claim = bc.claimStory(p);
  assert.ok(claim.ok); assert.equal(p.gold, g0 + 300); assert.equal(p.village.castle_ruins, false);
  assert.equal(bc.construct(p, 'tent').error, 'missing_materials');
  items(p).wood = 30;
  const r = bc.construct(p, 'tent');
  assert.ok(r.ok); assert.equal(r.copies, 1); assert.equal(items(p).wood, 22);
  assert.deepEqual(buildCost('tent', 1), { wood: 16 });
  assert.ok(bc.construct(p, 'tent').ok); assert.equal(items(p).wood, 6);
  assert.equal(bc.construct(p, 'tent').error, 'max_copies');
  // farm plots: 2 starter copies, cap 6 at Castle Lv1
  items(p).wood = 100;
  for (let i = 0; i < 4; i++) assert.ok(bc.construct(p, 'farm_plot').ok);
  assert.equal(p.village.copies.farm_plot, 6);
  assert.equal(bc.construct(p, 'farm_plot').error, 'plot_cap');
  // gold is part of the patisserie cost
  atChapter(p, 2);
  Object.assign(items(p), { wood: 25, stone: 15 });
  p.gold = 299;
  assert.equal(bc.construct(p, 'patisserie').error, 'not_enough_gold');
  p.gold = 300;
  assert.ok(bc.construct(p, 'patisserie').ok);
  assert.equal(p.gold, 0);
  assert.deepEqual(buildCost('lighthouse_unknown'), { plank: 30, ingot: 10 });
});

test('upgrade: material cost, castle capped by completed chapters × 2 + 2', () => {
  const { bc, mk } = setup();
  const p = mk('upg');
  assert.deepEqual(upgradeCost('mint', 1), { plank: 8, gold: 200 });
  assert.deepEqual(upgradeCost('mint', 3), { plank: 24, ingot: 12, gold: 600 });
  assert.equal(castleLevelCap(p.story), 2);
  Object.assign(items(p), { plank: 500, ingot: 500 });
  p.gold = 1e6;
  assert.ok(bc.upgrade(p, 'castle').ok);
  assert.equal(p.village.castle_lv, 2);
  assert.equal(bc.upgrade(p, 'castle').error, 'story_locked');
  assert.equal(bc.upgrade(p, 'mint').error, 'not_built');
  p.village.copies.mint = 1;
  const r = bc.upgrade(p, 'mint');
  assert.ok(r.ok); assert.equal(p.village.levels.mint, 2);
});

test('production: enqueue → collect, tool unlock raises toolbelt, craft story events', () => {
  const { bc, mk, clock } = setup();
  const p = mk('crafter');
  atChapter(p, 2);
  p.village.copies.workshop = 1;
  p.village.levels.workshop = 2;
  place(p, 'workshop', 'ws1', 12, 11);
  assert.equal(bc.enqueue(p, 'nope', 'plank').error, 'not_placed');
  assert.equal(bc.enqueue(p, 'farm_plot_1', 'plank').error, 'not_production');
  assert.equal(bc.enqueue(p, 'ws1', 'plank').error, 'missing_inputs');
  Object.assign(items(p), { wood: 6, ingot: 6, plank: 4 });
  assert.equal(bc.enqueue(p, 'ws1', 'flour').error, 'wrong_building');
  assert.ok(bc.enqueue(p, 'ws1', 'tool_pickaxe_2').ok);
  assert.ok(bc.enqueue(p, 'ws1', 'plank').ok);
  assert.ok(bc.enqueue(p, 'ws1', 'plank').ok);
  assert.equal(bc.collect(p, 'ws1').error, 'nothing_to_collect');
  clock.t += 600_000 + 120_000;
  const r = bc.collect(p, 'ws1');
  assert.ok(r.ok, JSON.stringify(r));
  assert.deepEqual(r.collected, { plank: 2 });
  assert.equal(p.frontier.toolbelt.pickaxe, 2);
  assert.equal(items(p).plank, 2);
  assert.equal(p.story.progress.c2_craft_plank, 2);
  assert.equal(bc.collectAll(p).error, 'nothing_to_collect');
});

test('farm plots: plant, visitor water (not owner), harvest + story harvest events', () => {
  const { bc, mk, clock } = setup();
  const owner = mk('farmer');
  const friend = mk('friend');
  assert.equal(bc.plant(owner, 'castle', 'sky_wheat').error, 'not_plot');
  assert.ok(bc.plant(owner, 'farm_plot_1', 'sky_wheat').ok);
  assert.equal(bc.plant(owner, 'farm_plot_1', 'sky_wheat').error, 'busy');
  assert.equal(bc.water(owner, owner, 'farm_plot_1').error, 'owner');
  const w = bc.water(friend, owner, 'farm_plot_1');
  assert.ok(w.ok); assert.equal(w.readyAt, T0 + 90_000);
  assert.equal(bc.water(friend, owner, 'farm_plot_1').error, 'already_watered');
  assert.equal(bc.harvestPlot(owner, 'farm_plot_1').error, 'not_ready');
  clock.t += 90_000;
  const h = bc.harvestPlot(owner, 'farm_plot_1');
  assert.ok(h.ok); assert.deepEqual(h.items, { sky_wheat: 4 }); assert.equal(items(owner).sky_wheat, 4);
  // Chapter 3 "Seeds of the Sky": harvest herb ×3
  atChapter(owner, 3);
  assert.equal(bc.plant(owner, 'farm_plot_2', 'herb').error, 'missing_seed');
  items(owner).herb_seed = 1;
  assert.ok(bc.plant(owner, 'farm_plot_2', 'herb').ok);
  clock.t += 1_200_000;
  assert.ok(bc.harvestPlot(owner, 'farm_plot_2').ok);
  assert.equal(owner.story.progress.c3_harvest_herb, 1);
  assert.equal(items(owner).herb, 3);
});

test('orders: locked until the Owl Post Office is unlocked; fill pays gold + XP; discard refreshes later', () => {
  const { bc, mk, clock } = setup();
  const p = mk('courier');
  assert.equal(bc.orderBoard(p).error, 'locked');
  assert.equal(bc.fillOrder(p, 0).error, 'locked');
  atChapter(p, 2);                       // chapter 1 claimed → owl_post_office unlocked
  const b = bc.orderBoard(p);
  assert.ok(b.ok);
  assert.equal(p.orders.slots.length, 3);
  assert.ok(p.orders.slots.every(Boolean));
  for (const o of p.orders.slots) for (const k of Object.keys(o.items)) assert.ok(['sky_wheat', 'berries_crop'].includes(k), k);
  const order = p.orders.slots[0];
  assert.equal(bc.fillOrder(p, 0).error, 'missing_items');
  Object.assign(items(p), order.items);
  const g = p.gold, xpBefore = p.exp;
  const r = bc.fillOrder(p, 0);
  assert.ok(r.ok);
  assert.equal(p.gold, g + order.gold);
  assert.ok(p.exp > xpBefore || p.level > 1);
  assert.equal(p.orders.slots[0], null);
  assert.equal(p.story.progress.c2_deliver_orders, 1);
  assert.ok(bc.discardOrder(p, 1).ok);
  assert.equal(p.orders.slots[1], null);
  assert.equal(bc.discardOrder(p, 1).error, 'empty_slot');
  clock.t += 5 * 60_000;
  bc.orderBoard(p);
  assert.ok(p.orders.slots[0] && p.orders.slots[1], 'slots refill after REFRESH_MS');
  // courier slots at Owl Post Office Lv3
  p.village.levels.owl_post_office = 3;
  bc.orderBoard(p);
  assert.equal(p.orders.slots.length, 6);
});

test('big order: contribution completes and pays contributors once; kept until next day', () => {
  const { bc, mk, clock } = setup();
  const p = mk('bigboss');
  atChapter(p, 2);
  bc.orderBoard(p);
  const big = p.orders.big;
  assert.ok(big && !big.complete);
  Object.assign(items(p), big.items);
  const g = p.gold;
  const r = bc.contributeBig(p, { ...big.items, nonsense: 5 });
  assert.ok(r.ok); assert.equal(r.complete, true);
  assert.equal(p.gold, g + big.gold);
  assert.equal(bc.contributeBig(p, big.items).error, 'already_complete');
  clock.t += 3600_000;
  bc.orderBoard(p);
  assert.equal(p.orders.big.complete, true, 'same day: completed big order stays');
  clock.t += 86_400_000;
  bc.orderBoard(p);
  assert.equal(p.orders.big.complete, false, 'next day: a fresh big order');
});

test('story: claim applies gold, regions, residents, max_grid, monument unlocks; recordStory helper', () => {
  const { bc, mk } = setup();
  const p = mk('hero');
  const s0 = bc.storyState(p);
  assert.equal(s0.chapter, 0); assert.equal(s0.complete, false); assert.equal(s0.steps.length, 3);
  assert.equal(bc.claimStory(p).error, 'incomplete');
  bc.recordStory(p, { kind: 'gather', target: 'wood', amount: 12 });
  assert.equal(bc.storyState(p).steps[0].done, true);
  atChapter(p, 2);
  completeCurrent(p);
  assert.equal(bc.storyState(p).complete, true);
  const g = p.gold;
  const r = bc.claimStory(p);
  assert.ok(r.ok, JSON.stringify(r));
  assert.equal(p.gold, g + 1000);
  assert.ok(p.frontier.unlocks.regions.includes('hollow'));
  assert.ok(p.frontier.unlocks.regions.includes('meadow'));
  assert.deepEqual(p.village.residents.map((x) => x.id), ['miner', 'smith']);
  assert.deepEqual(p.village.residents[0], { id: 'miner', building: null, assignedTo: null, fedUntil: 0, mood: 50 });
  assert.equal(p.village.max_grid, 20);
  assert.equal(p.story.chapter, 3);
  atChapter(p, 4);
  completeCurrent(p);
  assert.ok(bc.claimStory(p).ok);
  assert.equal(p.village.max_grid, 24);
  assert.deepEqual(p.village.monument_unlocks, ['wnd_onsen']);
  assert.equal(bc.claimStory(p).error, 'done');
});

test('village_save_grid hook: placing a newly constructed building records a story build event', () => {
  const { bc, mk } = setup();
  const p = mk('placer');
  atChapter(p, 1);
  p.village.copies.windmill_bakery = 1;
  const before = bc.placedCounts(p.village);
  const layout = {
    buildings: [...p.village.buildings.map(({ uid, type, x, y, rot }) => ({ uid, type, x, y, rot })), { type: 'windmill_bakery', x: 12, y: 11, rot: 0 }],
    tiles: p.village.tiles, ground: p.village.ground,
  };
  assert.ok(eco.saveLayout(p, layout).ok);
  assert.deepEqual(bc.onLayoutSaved(p, before), ['windmill_bakery']);
  assert.equal(p.story.progress.c1_build_windmill_bakery, 1);
});

test('storage upgrade + expansion paid with materials', () => {
  const { bc, mk } = setup();
  const p = mk('hoarder');
  assert.equal(bc.storeUpgrade(p, 'attic').error, 'bad_store');
  assert.equal(bc.storeUpgrade(p, 'warehouse').error, 'missing_materials');
  Object.assign(items(p), { plank: 10, ingot: 5 });
  const r = bc.storeUpgrade(p, 'warehouse');
  assert.ok(r.ok); assert.equal(p.frontier.warehouse.lv, 2);
  assert.deepEqual(items(p), {});
  pantry(p).bread = 1;
  assert.equal(eco.expandTerritory(p).error, 'story_locked');
  p.village.max_grid = 20;
  Object.assign(items(p), { plank: 30, stone: 30 });
  p.gold = 1500;
  assert.ok(eco.expandTerritory(p).ok);
  assert.equal(p.village.grid_size, 20);
});

test('WS: bc_story / bc_construct round-trip through the action path', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'neora-bc-test-'));
  const dataFile = path.join(tmpDir, 'db.json');
  const srv = await startServer({ port: 0, dataFile, quiet: true });
  const baseUrl = `http://127.0.0.1:${srv.port}`;
  const ws = new WebSocket(`ws://127.0.0.1:${srv.port}/ws`);
  const inbox = [];
  const waiters = [];
  ws.on('message', (raw) => {
    const m = JSON.parse(String(raw));
    const i = waiters.findIndex((w) => w.pred(m));
    if (i >= 0) waiters.splice(i, 1)[0].resolve(m); else inbox.push(m);
  });
  const waitFor = (pred, ms = 4000) => {
    const i = inbox.findIndex(pred);
    if (i >= 0) return Promise.resolve(inbox.splice(i, 1)[0]);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout ' + pred + ' inbox=' + JSON.stringify(inbox.map((x) => [x.type, x.action, x.error, x.reqId])))), ms);
      waiters.push({ pred, resolve: (m) => { clearTimeout(timer); resolve(m); } });
    });
  };
  const send = (m) => ws.send(JSON.stringify(m));
  try {
    const auth = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'bcqa', password: '1234', lineage: 'bkk' }),
    }).then((r) => r.json());
    assert.ok(auth.token);
    if (ws.readyState !== WebSocket.OPEN) await new Promise((resolve) => ws.once('open', resolve));
    send({ type: 'auth', token: auth.token });
    const ok = await waitFor((m) => m.type === 'auth_ok');
    assert.equal(ok.profile.story.chapter, 0);
    assert.deepEqual(ok.village.islands[0].village.plots, {});
    assert.equal(ok.offline, null);

    send({ type: 'bc_story', reqId: 1 });
    const st = await waitFor((m) => m.type === 'action_result' && m.reqId === 1);
    assert.equal(st.action, 'bc_story'); assert.equal(st.ok, true); assert.equal(st.chapter, 0);

    send({ type: 'bc_construct', building: 'tent', reqId: 2 });
    const locked = await waitFor((m) => m.type === 'action_result' && m.reqId === 2);
    assert.equal(locked.action, 'bc_construct'); assert.equal(locked.ok, false); assert.equal(locked.error, 'locked');

    // unlock chapter 0 server-side and fund the tent
    const p = srv.db.getProfile('bcqa');
    p.story = { chapter: 1, progress: {}, completed: [0], claimed: [0] };
    p.frontier.warehouse.items.wood = 8;
    await new Promise((r) => setTimeout(r, 300));     // economy action cooldown
    send({ type: 'bc_construct', building: 'tent', reqId: 3 });
    const built = await waitFor((m) => m.type === 'action_result' && m.reqId === 3);
    assert.equal(built.ok, true, JSON.stringify(built)); assert.equal(built.copies, 1);
    const upd = await waitFor((m) => m.type === 'profile_update' && m.profile?.village?.copies?.tent === 1);
    assert.equal(upd.profile.frontier.warehouse.items.wood ?? 0, 0);

    await new Promise((r) => setTimeout(r, 300));
    send({ type: 'bc_orders', reqId: 4 });
    const ord = await waitFor((m) => m.type === 'action_result' && m.reqId === 4);
    assert.equal(ord.ok, false); assert.equal(ord.error, 'locked');
  } finally {
    if (ws.readyState === WebSocket.OPEN) ws.close();
    await srv.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('active chapter build steps unlock construction during the chapter + harvestPlot records gather events', () => {
  const { clock, bc, mk } = setup();
  const p = mk('pioneer_prog');
  // At chapter 1 (Smoke on the Wind), windmill_bakery and patisserie are build steps so they must be constructable
  atChapter(p, 1);
  items(p).wood = 100;
  items(p).stone = 100;
  p.gold = 10000;
  assert.ok(bc.construct(p, 'windmill_bakery').ok, 'windmill_bakery constructable during chapter 1');
  assert.ok(bc.construct(p, 'patisserie').ok, 'patisserie constructable during chapter 1');
  // Harvesting sky_wheat on a farm plot also counts toward c1_gather_sky_wheat (gather: sky_wheat)
  assert.ok(bc.plant(p, 'farm_plot_1', 'sky_wheat').ok);
  clock.t += 121_000;
  const h = bc.harvestPlot(p, 'farm_plot_1');
  assert.ok(h.ok);
  assert.equal(p.story.progress.c1_gather_sky_wheat, 4);
});

test('full 300/300 warehouse never deadlocks collecting produced Ingots/Planks, auto-collects on upgrade, and supports quick-sell', () => {
  const { clock, bc, mk } = setup();
  const p = mk('full_bag_crafter');
  atChapter(p, 2);
  p.village.copies.mint = 1;
  p.village.copies.workshop = 1;
  place(p, 'mint', 'mint_1', 12, 11);
  place(p, 'workshop', 'ws_1', 10, 11);

  // Stock exact inputs for 5 ingots (15 crystal_ore) + 10 planks (30 wood), queue 3 ingots + 3 planks first
  Object.assign(items(p), { crystal_ore: 9, wood: 9, plank: 7, ingot: 2 });
  for (let i = 0; i < 3; i++) {
    assert.ok(bc.enqueue(p, 'mint_1', 'ingot').ok);
    assert.ok(bc.enqueue(p, 'ws_1', 'plank').ok);
  }
  // Now simulate player filling Warehouse to 300/300 while Mint & Workshop are producing!
  items(p).stone = 291; // 7 plank + 2 ingot + 291 stone = 300/300 FULL!
  clock.t += 600_000;

  // 1. Direct collect on Mint when Warehouse is 300/300 MUST succeed (soft-overflow for crafted items!)
  const cMint = bc.collect(p, 'mint_1');
  assert.equal(cMint.ok, true, 'Collecting produced Ingots must succeed even when Warehouse is 300/300');
  assert.deepEqual(cMint.collected, { ingot: 3 });
  assert.equal(items(p).ingot, 5);

  // 2. storeUpgrade('warehouse') when Workshop STILL has 3 ready Planks uncollected auto-collects & upgrades!
  const upg = bc.storeUpgrade(p, 'warehouse');
  assert.equal(upg.ok, true, 'Warehouse upgrade should auto-collect ready Planks and succeed');
  assert.equal(upg.lv, 2);
  assert.deepEqual(upg.autoCollected, { plank: 3 });
  assert.equal(items(p).plank ?? 0, 0);
  assert.equal(items(p).ingot ?? 0, 0);

  // 3. Quick-sell excess raw items frees storage and grants Gold; rare items are protected
  items(p).boss_core_moss = 1;
  assert.equal(bc.storeUpgrade(p, 'sell:boss_core_moss:1').error, 'cannot_sell_rare');
  const goldBefore = p.gold;
  const sellRes = bc.storeUpgrade(p, 'sell:stone:10');
  assert.equal(sellRes.ok, true);
  assert.equal(sellRes.qty, 10);
  assert.equal(sellRes.goldGained, 20);
  assert.equal(p.gold, goldBefore + 20);
  assert.equal(items(p).stone, 281);
});
