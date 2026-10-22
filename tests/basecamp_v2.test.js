// tests/basecamp_v2.test.js — Stage 5 Base Camp: residents, monuments, camp props + decor cleanup
// (Master Plan v2 §11.3–§11.5, §14).
import test from 'node:test';
import assert from 'node:assert/strict';

import { createBasecampService, CRAFTABLE_DECOR, EXTRA_RECIPES, FEED_TICK_MS, ONSEN_COOLDOWN_MS } from '../server/basecamp_service.js';
import * as eco from '../server/economy_service.js';
import * as rpg from '../server/rpg_service.js';
import { createStarterProfile, seedProfiles, migrateProfile } from '../server/profile_factory.js';
import { DECOR, WONDERS } from '../shared/catalog_landmarks.js';
import { CUT_WONDERS, CUT_DECOR, CAMP_PROPS, COSMETIC_DECOR, MONUMENTS } from '../shared/monument_rules.js';
import { cottageCap, MEAL_INTERVAL_MS } from '../shared/resident_rules.js';
import { RECIPES, warehouseCapOf } from '../shared/production_rules.js';
import { MATERIALS, FOOD } from '../shared/materials_catalog.js';
import { ownedCount, bagContents, validateLayout, storageCapHrs, yieldMultipliers } from '../shared/village_rules.js';
import { recalcPlayerCP } from '../shared/progression.js';

const T0 = Date.UTC(2026, 9, 22, 10, 0, 0);
const DAY = 86_400_000;

function setup({ rng = () => 0.42 } = {}) {
  const clock = { t: T0 };
  const profiles = new Map();
  const db = { getProfile: (id) => profiles.get(id) || null, markProfile: () => {} };
  const bc = createBasecampService({ db, rng, now: () => clock.t });
  const mk = (id) => { const p = createStarterProfile(id, 'pw12', 'bkk'); profiles.set(id, p); return p; };
  return { clock, bc, mk };
}
const wh = (p) => p.frontier.warehouse.items;
const pantry = (p) => p.frontier.pantry.items;
function atChapter(p, n) {
  p.story = { chapter: n, progress: {}, completed: [...Array(n).keys()], claimed: [...Array(n).keys()] };
}
function place(p, type, uid, x = 0, y = 0) {
  p.village.buildings.push({ uid, type, x, y, rot: 0 });
}
const layoutOf = (v) => ({ buildings: v.buildings.map((b) => ({ ...b })), tiles: v.tiles.map((t) => ({ ...t })) });
/** First grid spot where `type` validates (heart-isle rules off) — for placement checks. */
function findSpot(v, type) {
  for (let y = 0; y < v.grid_size; y++) for (let x = 0; x < v.grid_size; x++) {
    const L = layoutOf(v);
    L.buildings.push({ uid: `${type}_t`, type, x, y, rot: 0 });
    if (validateLayout(v, L, { heartIsle: true }).ok) return L;
  }
  return null;
}
const setMon = (p, id, stage) => { (p.village.monuments ||= {})[id] = { stage, built: stage >= MONUMENTS[id].stages.length }; };
const resident = (id, extra = {}) => ({ id, building: null, assignedTo: null, fedUntil: 0, mood: 50, ...extra });

// ---------------------------------------------------------------------------------------------
test('residents: housing + placement checks, assign, unassign', () => {
  const { bc, mk } = setup();
  const p = mk('res1');
  p.village.residents.push(resident('baker'));
  assert.equal(bc.assignResident(p, 'miner', 'mint').error, 'not_resident');
  assert.equal(bc.assignResident(p, 'baker', 'patisserie').error, 'no_housing', 'no cottage placed yet');
  place(p, 'cottage', 'cot1'); p.village.copies.cottage = 1;
  assert.equal(bc.assignResident(p, 'baker', 'patisserie').error, 'not_placed');
  place(p, 'patisserie', 'pat1'); p.village.copies.patisserie = 1;
  assert.equal(bc.assignResident(p, 'baker', 'mint').error, 'wrong_building');
  const r = bc.assignResident(p, 'baker', 'patisserie');
  assert.ok(r.ok, JSON.stringify(r));
  assert.equal(p.village.residents[0].building, 'patisserie');
  assert.equal(p.village.residents[0].assignedTo, 'patisserie');
  assert.equal(r.housing.used, 1); assert.equal(r.housing.cap, 2);
  assert.ok(bc.assignResident(p, 'baker', null).ok);
  assert.equal(p.village.residents[0].building, null);
});

test('residents: feeding from the pantry (lazy, ≤ 1× per 10 min), speed + bonus output', () => {
  const { clock, bc, mk } = setup({ rng: () => 0 });   // rng 0 → every bonus roll hits
  const p = mk('res2');
  p.village.residents.push(resident('baker', { fedUntil: T0 }));   // just got hungry → 1 meal due
  place(p, 'cottage', 'cot1'); place(p, 'patisserie', 'pat1');
  assert.ok(bc.assignResident(p, 'baker', 'patisserie').ok);
  pantry(p).bread = 2;
  const t = bc.tick(p, { force: true });
  assert.deepEqual(t.fed.eaten, { bread: 1 });
  assert.equal(pantry(p).bread, 1);
  assert.equal(p.village.residents[0].fedUntil, T0 + MEAL_INTERVAL_MS);
  assert.equal(p.village.residents[0].mood, 50);   // 50·0.5 + 1·25
  // throttle: a hungry resident won't eat again until FEED_TICK_MS has passed
  p.village.residents[0].fedUntil = 0;
  clock.t = T0 + FEED_TICK_MS / 2; bc.tick(p);
  assert.equal(pantry(p).bread, 1);
  clock.t = T0 + FEED_TICK_MS + 1; bc.tick(p);
  assert.equal(pantry(p).bread, undefined, 'ate the last bread');
  // speed: fed baker = +25% (120 s → 96 s)
  wh(p).flour = 4;
  const e = bc.enqueue(p, 'pat1', 'bread');
  assert.ok(e.ok, JSON.stringify(e));
  assert.equal(e.speedMult, 1.25);
  const job = e.queue[0];
  assert.equal(job.doneAt - job.startAt, Math.round(RECIPES.bread.ms / 1.25));
  // bonus: rng 0 < bonusChance → +1 bread per finished job
  clock.t = job.doneAt;
  const c = bc.collect(p, 'pat1');
  assert.ok(c.ok, JSON.stringify(c));
  assert.deepEqual(c.bonus, { bread: 1 });
  assert.equal(pantry(p).bread, 2);
  // hungry → half bonus speed
  p.village.residents[0].fedUntil = 0;
  const e2 = bc.enqueue(p, 'pat1', 'bread');
  assert.equal(e2.speedMult, 1.125);
});

test('residents: no staff → base speed, no bonus roll', () => {
  const { clock, bc, mk } = setup({ rng: () => 0 });
  const p = mk('res3');
  place(p, 'patisserie', 'pat1');
  wh(p).flour = 2;
  const e = bc.enqueue(p, 'pat1', 'bread');
  assert.equal(e.speedMult, 1);
  clock.t += RECIPES.bread.ms;
  const c = bc.collect(p, 'pat1');
  assert.deepEqual(c.bonus, {});
  assert.equal(pantry(p).bread, 1);
});

test('cottages: Comfort caps construction; placed cottages cap assigned residents', () => {
  const { bc, mk } = setup();
  const p = mk('cot');
  atChapter(p, 4);
  wh(p).plank = 500; wh(p).stone = 500;
  const cap = cottageCap(p.village.comfort);
  for (let i = 0; i < cap; i++) assert.ok(bc.construct(p, 'cottage').ok, `cottage #${i + 1}`);
  const over = bc.construct(p, 'cottage');
  assert.equal(over.error, cap >= 4 ? 'max_copies' : 'cottage_cap');
  // housing: one placed cottage = 2 beds
  const q = mk('housing');
  q.village.residents.push(resident('baker'), resident('miner'), resident('smith'));
  place(q, 'cottage', 'cot1', 0, 0);
  place(q, 'patisserie', 'pat1'); place(q, 'mint', 'mint1'); place(q, 'workshop', 'ws1');
  assert.ok(bc.assignResident(q, 'baker', 'patisserie').ok);
  assert.ok(bc.assignResident(q, 'miner', 'mint').ok);
  const r = bc.assignResident(q, 'smith', 'workshop');
  assert.equal(r.error, 'no_housing'); assert.equal(r.cap, 2);
  place(q, 'cottage', 'cot2', 4, 0);
  assert.ok(bc.assignResident(q, 'smith', 'workshop').ok);
});

// ---------------------------------------------------------------------------------------------
test('monuments: contribute stage → wonders ownership → placeable; unlock gating', () => {
  const { bc, mk } = setup();
  const p = mk('mon');
  const v = p.village;
  p.gold = 0;
  assert.equal(bc.contributeMonument(p, 'wnd_fountain').error, 'not_enough_gold');
  p.gold = 10_000;
  assert.equal(bc.contributeMonument(p, 'wnd_fountain').error, 'missing_materials');
  Object.assign(wh(p), { stone: 80, crystal_ore: 20 });
  const r = bc.contributeMonument(p, 'wnd_fountain');
  assert.ok(r.ok, JSON.stringify(r));
  assert.equal(r.stage, 1); assert.equal(r.built, false);
  assert.equal(p.gold, 8000); assert.equal(wh(p).stone, undefined);
  assert.deepEqual(v.wonders.wnd_fountain, { stars: 1 });
  assert.equal(ownedCount(v, 'wnd_fountain'), 1);
  assert.equal(bagContents(v).wnd_fountain, 1);
  const L = findSpot(v, 'wnd_fountain');
  assert.ok(L, 'fountain fits somewhere');
  assert.ok(eco.saveLayout(p, L).ok);
  // stage 2 completes it
  Object.assign(wh(p), { crystal_glass: 15, ancient_gear: 2 });
  const r2 = bc.contributeMonument(p, 'wnd_fountain');
  assert.ok(r2.built); assert.equal(v.wonders.wnd_fountain.stars, 2);
  assert.equal(bc.contributeMonument(p, 'wnd_fountain').error, 'done');
  // Onsen needs the Chapter 4 unlock; tea / ferris need the Onsen built
  assert.equal(bc.contributeMonument(p, 'wnd_onsen').error, 'locked');
  assert.equal(bc.contributeMonument(p, 'wnd_tea_pavilion').error, 'locked');
  v.monument_unlocks.push('wnd_onsen');
  p.gold = 10_000;
  Object.assign(wh(p), { wood: 40, stone: 40, plank: 30, crystal_glass: 10, boss_core_moss: 2 });
  assert.ok(bc.contributeMonument(p, 'wnd_onsen').ok);
  const done = bc.contributeMonument(p, 'wnd_onsen');
  assert.ok(done.built);
  assert.ok(v.monument_unlocks.includes('wnd_tea_pavilion') && v.monument_unlocks.includes('wnd_ferris'));
  // update-1 / cut wonders can't be built
  assert.equal(bc.contributeMonument(p, 'wnd_world_tree').error, 'locked');
  assert.equal(bc.contributeMonument(p, 'wnd_casino_dome').error, 'retired');
  const st = bc.monumentsState(p);
  assert.deepEqual(st.monuments.map((m) => m.id).sort(), ['wnd_ferris', 'wnd_fountain', 'wnd_onsen', 'wnd_tea_pavilion']);
});

test('monuments: Heart-Isle-only Ferris Wheel is rejected on a personal island', () => {
  const { bc, mk } = setup();
  const p = mk('ferris');
  const v = p.village;
  setMon(p, 'wnd_onsen', 2);
  p.gold = 10_000;
  Object.assign(wh(p), { plank: 60, ingot: 20 });
  const r = bc.contributeMonument(p, 'wnd_ferris');
  assert.ok(r.ok, JSON.stringify(r));
  assert.equal(ownedCount(v, 'wnd_ferris'), 1);
  const L = findSpot(v, 'wnd_ferris');
  assert.ok(L, 'fits geometrically (heart isle validation)');
  assert.ok(validateLayout(v, L, { heartIsle: true }).ok);
  const save = eco.saveLayout(p, L);
  assert.equal(save.error, 'heart_isle_only'); assert.equal(save.at, 'wnd_ferris');
  assert.equal(validateLayout(v, L, { heartIsle: false }).error, 'heart_isle_only');
});

test('Fountain of Wishes: once per UTC day for 100 gold', () => {
  const { clock, bc, mk } = setup({ rng: () => 0.1 });   // 0.1 → { crystal_glass: 2 }
  const p = mk('wish');
  assert.equal(bc.wish(p).error, 'not_built');
  setMon(p, 'wnd_fountain', 1);
  p.village.wonders.wnd_fountain = { stars: 1 };
  assert.equal(bc.wish(p).error, 'not_placed');
  place(p, 'wnd_fountain', 'fnt1');
  p.gold = 150;
  const r = bc.wish(p);
  assert.ok(r.ok, JSON.stringify(r));
  assert.deepEqual(r.items, { crystal_glass: 2 });
  assert.equal(p.gold, 50); assert.equal(wh(p).crystal_glass, 2);
  assert.equal(bc.wish(p).error, 'already_wished_today');
  clock.t += DAY;
  assert.equal(bc.wish(p).error, 'not_enough_gold');
  p.gold = 100;
  assert.ok(bc.wish(p).ok);
});

test('Capybara Hot Spring: Well-Rested buff into p.frontier.restBuff, 4 h cooldown', () => {
  const { clock, bc, mk } = setup();
  const p = mk('onsen');
  assert.equal(bc.useMonument(p, 'wnd_onsen').error, 'not_built');
  setMon(p, 'wnd_onsen', 1);
  place(p, 'wnd_onsen', 'ons1');
  const r = bc.useMonument(p, 'wnd_onsen');
  assert.ok(r.ok);
  assert.equal(p.frontier.restBuff.yieldPct, 15);
  assert.equal(p.frontier.restBuff.until, T0 + 30 * 60e3);
  assert.equal(bc.useMonument(p, 'wnd_onsen').error, 'cooldown');
  clock.t += ONSEN_COOLDOWN_MS;
  assert.ok(bc.useMonument(p, 'wnd_onsen').ok);
});

test('Matcha Tea House: brews matcha_tea (monument recipe) into the pantry', () => {
  const { clock, bc, mk } = setup();
  const p = mk('tea');
  assert.ok(MATERIALS.matcha_tea && MATERIALS.matcha_tea.tier === 'goods');
  assert.deepEqual(FOOD.matcha_tea, { energy: 20, buff: 'tea' });
  place(p, 'wnd_tea_pavilion', 'tea1');
  Object.assign(wh(p), { herb: 3, honey: 1 });
  assert.equal(bc.enqueue(p, 'tea1', 'matcha_tea').error, 'monument_not_built');
  setMon(p, 'wnd_tea_pavilion', 1);
  assert.equal(bc.enqueue(p, 'tea1', 'bread').error, 'bad_recipe');
  const e = bc.enqueue(p, 'tea1', 'matcha_tea');
  assert.ok(e.ok, JSON.stringify(e));
  assert.equal(wh(p).herb, undefined);
  assert.equal(bc.collect(p, 'tea1').error, 'nothing_to_collect');
  clock.t += EXTRA_RECIPES.matcha_tea.ms;
  const c = bc.collect(p, 'tea1');
  assert.ok(c.ok, JSON.stringify(c));
  assert.equal(pantry(p).matcha_tea, 1);
});

// ---------------------------------------------------------------------------------------------
test('camp props: tent bread daily, beehive production, wheelbarrow cap, owl mailbox slot', () => {
  const { clock, bc, mk } = setup();
  const p = mk('props');
  assert.equal(bc.tentBread(p).error, 'no_tent');
  place(p, 'dec_tent', 'tent1');
  const t1 = bc.tentBread(p);
  assert.ok(t1.ok); assert.equal(pantry(p).bread, 1);
  assert.equal(bc.tentBread(p).error, 'already_claimed_today');
  clock.t += DAY;
  assert.ok(bc.tentBread(p).ok); assert.equal(pantry(p).bread, 2);

  // beehive: +1 honey / 2 h (accrues on tick, 6-cycle cap)
  place(p, 'dec_honey_beehive', 'bee1');
  bc.tick(p);
  assert.equal(bc.collectProps(p).error, 'nothing_to_collect');
  clock.t += 5 * 3600e3;
  const c = bc.collectProps(p);
  assert.ok(c.ok); assert.deepEqual(c.collected, { honey: 2 });
  clock.t += 48 * 3600e3;
  assert.deepEqual(bc.collectProps(p).collected, { honey: 6 }, 'offline catch-up capped at 6 cycles');

  // wheelbarrow: +10% warehouse cap
  const base = warehouseCapOf(p.frontier.warehouse);
  place(p, 'dec_berry_wheelbarrow', 'wb1');
  bc.tick(p);
  assert.equal(p.frontier.warehouse.capPct, 10);
  assert.equal(warehouseCapOf(p.frontier.warehouse), Math.floor(base * 1.1));

  // owl mailbox: +1 order slot
  atChapter(p, 2);
  const before = bc.orderBoard(p).board.slots.length;
  place(p, 'dec_owl_mailbox', 'owl1');
  assert.equal(bc.orderBoard(p).board.slots.length, before + 1);

  // flag-only props
  place(p, 'dec_starlight_telescope', 'tel1');
  bc.tick(p);
  assert.equal(p.village.prop_flags.telescope, true);
  assert.equal(p.village.prop_flags.hammock, false);
});

test('decor craft: camp props + cosmetics craftable; cut decor + museum are not (owned copies stay placeable)', () => {
  const { bc, mk } = setup();
  const p = mk('craft');
  assert.equal(CRAFTABLE_DECOR.length, 20);
  assert.equal(bc.craftDecor(p, 'dec_tent').error, 'missing_materials');
  wh(p).wood = 10;
  const r = bc.craftDecor(p, 'dec_tent');
  assert.ok(r.ok); assert.equal(p.village.decor.dec_tent, 1); assert.equal(wh(p).wood, 2);
  assert.equal(bagContents(p.village).dec_tent, 1);
  Object.assign(wh(p), { plank: 10, stone: 10 });
  assert.ok(bc.craftDecor(p, 'dec_swing').ok);
  assert.equal(bc.craftDecor(p, 'dec_boba_stand').error, 'not_craftable');
  assert.ok(CUT_DECOR.includes('dec_boba_stand'));
  assert.equal(bc.craftDecor(p, 'dec_nookairline_museum').error, 'not_craftable');
  assert.equal(bc.craftDecor(p, 'nope').error, 'bad_decor');
  // previously-owned museum + cut decor stay placeable
  p.village.decor.dec_nookairline_museum = 1;
  p.village.decor.dec_boba_stand = 1;
  const L = findSpot(p.village, 'dec_nookairline_museum');
  assert.ok(L && eco.saveLayout(p, L).ok);
  const L2 = findSpot(p.village, 'dec_boba_stand');
  assert.ok(L2 && eco.saveLayout(p, L2).ok);
});

test('catalog: decor stat buffs removed (comfortBonus kept), museum keeps its portal, wonders flagged', () => {
  for (const [k, d] of Object.entries(DECOR)) {
    assert.ok(Object.keys(d.buff || {}).every((b) => b === 'comfortBonus'), `${k} still has a stat buff`);
  }
  assert.equal(DECOR.dec_wooden_bench.buff.comfortBonus, 30);
  assert.equal(DECOR.dec_stone_arch_footbridge.buff.comfortBonus, 40);
  assert.deepEqual(DECOR.dec_nookairline_museum.buff, {});
  assert.match(DECOR.dec_nookairline_museum.effect, /Enter the NookAirline V1 Museum/);
  assert.equal(DECOR.dec_nookairline_museum.seats, 2);
  for (const k of Object.keys(CAMP_PROPS)) assert.match(DECOR[k].effect, /^Camp Prop/);
  for (const k of Object.keys(COSMETIC_DECOR)) assert.equal(DECOR[k].effect, 'Cosmetic • +Comfort');
  for (const k of CUT_WONDERS) assert.equal(WONDERS[k].cut, true, k);
  for (const k of Object.keys(MONUMENTS)) assert.equal(WONDERS[k].monument, true, k);
  assert.equal(WONDERS.wnd_ferris.heartIsleOnly, true);
  // old buff readers keep returning finite numbers
  const v = createStarterProfile('cat', 'pw12', 'bkk').village;
  v.buildings.push({ uid: 't', type: 'dec_tent', x: 0, y: 0, rot: 0 }, { uid: 's', type: 'dec_swing', x: 3, y: 0, rot: 0 });
  assert.ok(Number.isFinite(storageCapHrs(v, {})));
  const m = yieldMultipliers(v, { now: T0 });
  assert.ok(Number.isFinite(m.gold) && Number.isFinite(m.berries));
});

test('gacha: Royal Architect never grants wonders; shard shop wonder pick retired', () => {
  const p = seedProfiles().find((x) => x.id === 'neen');
  migrateProfile(p, T0); rpg.migrateRpg(p); p.cp = recalcPlayerCP(p);
  p.gold = 1_000_000;
  const before = JSON.stringify(p.village.wonders);
  const shards = p.shards;
  const r = rpg.gachaPull(p, { box: 2, count: 10, currency: 'gold' }, () => 0.001);   // every pull = mythic tier
  assert.ok(r.ok, JSON.stringify(r));
  assert.ok(r.items.every((it) => it.kind === 'shards' && !WONDERS[it.id]));
  assert.equal(JSON.stringify(p.village.wonders), before);
  assert.ok(p.shards > shards);
  p.shards = 1000;
  assert.equal(rpg.shardExchange(p, { offerId: 'vip_wonder', pickId: 'wnd_world_tree' }).error, 'monuments_are_built');
  assert.equal(p.shards, 1000);
});
