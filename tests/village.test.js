// tests/village.test.js — Step 2 pure rules + authoritative economy (node --test).
import test from 'node:test';
import assert from 'node:assert/strict';
import { CORE, WONDERS, DECOR, FISH, footprint, EXPANSION_TIERS, BLUEPRINT_CARDS } from '../shared/catalog_landmarks.js';
import {
  validateLayout, comfortBonusPct, storageCapHrs, harvestPreview, instanceLayout, buildCellIndex, productionPerHour,
  groundAt, clampToArea, spawnPoint, dockNear, landingCells, bagContents, HOUR_MS, utcDay,
  isWalkablePos, nearestWalkablePos, cellToWorld,
} from '../shared/village_rules.js';
import * as eco from '../server/economy_service.js';
import { createStarterProfile, seedProfiles, migrateProfile, legacyStarterVillage } from '../server/profile_factory.js';

const seq = (...v) => { let i = 0; return () => v[i++ % v.length]; };
const starter = () => createStarterProfile('qa_v', 'pw12', 'bkk');
/** A pre-Stage-3 player (5 landmarks + castle) run through the v2 migration ("keep everything, auto-credit"). */
const legacy = () => {
  const p = starter();
  p.village = legacyStarterVillage(Date.now());
  delete p.village.v2;
  return migrateProfile(p, Date.now());
};
const layoutOf = (v) => ({ buildings: v.buildings.map(({ uid, type, x, y, rot }) => ({ uid, type, x, y, rot })), tiles: v.tiles.map((t) => ({ ...t })), ground: v.ground });

test('catalog footprints match the locked Step 2 decision', () => {
  assert.deepEqual([CORE.castle.w, CORE.castle.h], [4, 4]);
  assert.deepEqual([CORE.mint.w, CORE.patisserie.w], [3, 3]);
  assert.deepEqual([CORE.shrine.w, CORE.shrine.h, CORE.nest.w, CORE.nest.h], [2, 2, 2, 2]);
  assert.deepEqual([CORE.dock.w, CORE.dock.h], [3, 2]);
  assert.deepEqual(footprint('dock', 90), { w: 2, h: 3 });
  assert.equal(Object.keys(WONDERS).length, 12);
  assert.equal(Object.keys(DECOR).length, 38);
  assert.equal(Object.values(FISH).reduce((s, f) => s + f.rate, 0), 100);
  assert.deepEqual(EXPANSION_TIERS.map((t) => t.size), [18, 20, 24, 28, 32]);
  assert.deepEqual(BLUEPRINT_CARDS.slice(1), [5, 10, 15, 20, 25, 30, 35, 40, 50]);
});

test('Stage 3: core buildings no longer print passive currency (base-camp roles instead)', () => {
  for (const [k, d] of Object.entries(CORE)) {
    for (const f of ['produces', 'perHour', 'daily', 'perDay', 'matchGoldPct']) assert.equal(d[f], undefined, `${k}.${f}`);
  }
  assert.equal(CORE.patisserie.name, 'Cat Boba Patisserie');
  assert.equal(CORE.mint.effect, 'Refinery: Ore → Ingots');
  assert.equal(CORE.windmill_bakery.effect, 'Mill: Wheat → Flour');
  for (const k of ['workshop', 'cottage', 'farm_plot', 'tent']) assert.ok(CORE[k], k);
  assert.deepEqual([CORE.workshop.w, CORE.cottage.w, CORE.farm_plot.w, CORE.tent.w], [3, 2, 2, 2]);
  assert.ok(DECOR.dec_nookairline_museum, 'protected museum decor stays');
  assert.deepEqual(productionPerHour(legacy().village), { gold: 0, berries: 0 });
});

test('new players start with the Castle ruins + 2 farm plots; legacy villages keep every building', () => {
  const fresh = starter();
  assert.ok(fresh.village.v2 && fresh.village.castle_ruins);
  assert.deepEqual(fresh.village.buildings.map((b) => b.type), ['castle', 'farm_plot', 'farm_plot']);
  assert.ok(validateLayout(fresh.village, layoutOf(fresh.village)).ok);
  assert.equal(fresh.story.chapter, 0);
  assert.equal(fresh.village.max_grid, 18);
  assert.deepEqual(bagContents(fresh.village).mint, undefined, 'nothing constructed yet');
  const p = legacy();
  assert.ok(validateLayout(p.village, layoutOf(p.village)).ok);
  assert.equal(p.village.buildings.length, 6);
  for (const k of ['mint', 'patisserie', 'shrine', 'nest', 'dock']) assert.equal(p.village.copies[k], 1, k);
  assert.equal(p.story.chapter, 0, 'legacy players still play the story');
  assert.equal(p.village.comfort, 860);                       // castle 150 + 5×100 + 42 tiles × 5
  const [nook, beam] = seedProfiles();
  assert.equal(nook.village.comfort, 4850); assert.equal(comfortBonusPct(4850), 24);
  assert.equal(beam.village.comfort, 6660);
  assert.equal(nook.cp, 15420); assert.equal(beam.cp, 15420);
});

test('layout validation: overlap, bounds, ownership, dock water rule, bridge landing', () => {
  const v = legacy().village;
  const L = layoutOf(v);
  const castle = L.buildings.find((b) => b.type === 'castle');
  assert.equal(validateLayout(v, { ...L, buildings: L.buildings.map((b) => (b === castle ? { ...b, x: 2, y: 3 } : b)) }).error, 'overlap');
  assert.equal(validateLayout(v, { ...L, buildings: L.buildings.map((b) => (b === castle ? { ...b, x: 16 } : b)) }).error, 'out_of_bounds');
  assert.equal(validateLayout(v, { ...L, buildings: [...L.buildings, { type: 'wnd_ferris', x: 0, y: 13, rot: 0 }] }).error, 'not_owned');
  assert.equal(validateLayout(v, { ...L, buildings: [...L.buildings, { type: 'mint', x: 0, y: 13, rot: 0 }] }).error, 'not_owned');
  // dock away from water / coast
  assert.equal(validateLayout(v, { ...L, buildings: L.buildings.map((b) => (b.type === 'dock' ? { ...b, x: 11, y: 13 } : b)) }).error, 'dock_needs_water');
  // dock on the coastline is fine
  assert.ok(validateLayout(v, { ...L, buildings: L.buildings.map((b) => (b.type === 'dock' ? { ...b, x: 11, y: 16 } : b)) }).ok);
  // bridge landing cells stay clear
  const [lx, ly] = landingCells(18)[1];
  assert.equal(validateLayout(v, { ...L, tiles: [...L.tiles, { x: lx, y: ly, t: 'water' }] }).error, 'bridge_landing');
  assert.equal(validateLayout(v, { ...L, tiles: [...L.tiles, { x: 8, y: 6, t: 'road_cream' }] }).error, 'duplicate_tile');
  assert.equal(validateLayout(v, { ...L, tiles: [...L.tiles, { x: 7, y: 1, t: 'road_cream' }] }).error, 'tile_under_building');
});

test('storage cap: 8h at Dock Lv1 → exactly 24h at Lv10, Casino ×2, Chonker +25–50% (Tent buff retired)', () => {
  const p = starter();
  assert.equal(storageCapHrs(p.village, p), 8);
  p.village.levels.dock = 10;
  assert.equal(storageCapHrs(p.village, p), 24);
  p.village.levels.dock = 2;
  assert.ok(Math.abs(storageCapHrs(p.village, p) - (8 + 16 / 9)) < 1e-9);  // +1h 46m 40s per level
  p.village.levels.dock = 1;
  p.equipped.pet = { id: 'pet_yuzu_capybara', stars: 3, level: 1 };
  assert.equal(storageCapHrs(p.village, p), 12);
  p.equipped.pet = { id: 'pet_cloud_bear', stars: 1, level: 1 };
  assert.equal(storageCapHrs(p.village, p), 10);
  const [, beam] = seedProfiles();   // Dock 7, Chonker ★2 (+37.5%); Stage 5: Tent decor has no stat buff any more
  assert.ok(Math.abs(storageCapHrs(beam.village, beam) - (8 + 16 * 6 / 9) * 1.375) < 1e-9);
});

test('Stage 3: passive Harvest All is retired — nothing accrues, profile untouched', () => {
  const p = legacy();
  const t0 = Date.UTC(2026, 9, 15, 1, 0, 0);
  p.village.last_harvest_at = t0;
  const before = { gold: p.gold, berries: p.berries, diamonds: p.diamonds, exp: p.exp };
  for (const t of [t0 + 10_000, t0 + 2 * HOUR_MS, t0 + 72 * HOUR_MS]) {
    assert.equal(eco.harvestAll(p, t).error, 'nothing_to_harvest');
    const pv = harvestPreview(p, t);
    assert.equal(pv.gold + pv.berries + pv.diamonds, 0);
  }
  assert.deepEqual({ gold: p.gold, berries: p.berries, diamonds: p.diamonds, exp: p.exp }, before);
});

test('couple +25% and partner blessing +15% for 12 h; bless once per day; +50 🪙 to visitor', () => {
  const [nook, neen] = seedProfiles();
  const now = neen.village.last_harvest_at + HOUR_MS;
  const solo = harvestPreview(neen, now).mult.base;
  assert.ok(Math.abs(harvestPreview(neen, now, { coupled: true }).mult.base - solo - 0.25) < 1e-9);
  const g = nook.gold;
  assert.ok(eco.blessPartner(nook, neen, now).ok);
  assert.equal(nook.gold, g + 50);
  assert.equal(eco.blessPartner(nook, neen, now + 1000).error, 'already_blessed_today');
  assert.ok(Math.abs(harvestPreview(neen, now + 1000).mult.base - solo - 0.15) < 1e-9);
  assert.ok(Math.abs(harvestPreview(neen, now + 13 * HOUR_MS).mult.base - solo) < 1e-9);
  const mochi = seedProfiles()[2];
  assert.equal(eco.blessPartner(mochi, neen, now).error, 'not_couple');
});

test('Stage 3: no offline "welcome back" gains any more', () => {
  const p = legacy();
  const t0 = Date.UTC(2026, 9, 15, 1, 0, 0);
  p.village.last_harvest_at = t0;
  assert.equal(eco.computeOfflineGains(p, t0 + 4 * 60_000, t0), null);
  assert.equal(eco.computeOfflineGains(p, t0 + 6 * HOUR_MS + 20 * 60_000, t0), null);
});

test('castle upgrade: 1,500 🪙 × L, landmark prerequisite, +100 EXP; blueprint upgrade uses cards', () => {
  const p = legacy();
  assert.equal(eco.upgradeCastle(p).error, 'not_enough_gold');        // Lv2 costs 3,000
  p.gold = 10_000;
  const r = eco.upgradeCastle(p);
  assert.ok(r.ok); assert.equal(p.gold, 7000); assert.equal(p.village.castle_lv, 2); assert.equal(p.exp, 100);
  p.village.castle_lv = 4; p.gold = 1e6;
  assert.equal(eco.upgradeCastle(p).error, 'landmarks_too_low');      // Lv5 needs sum >= 7, starter has 5
  assert.equal(eco.upgradeBuilding(p, 'mint').error, 'not_enough_cards');
  p.village.blueprints.mint = 7;
  assert.ok(eco.upgradeBuilding(p, 'mint').ok);
  assert.equal(p.village.levels.mint, 2); assert.equal(p.village.blueprints.mint, 2);
  assert.ok(eco.upgradeCastle(p).ok === false);                        // still 6 < 7
});

test('cloud expansion: story-gated (max_grid) + planks/stone/gold, coordinates shift so nothing moves', () => {
  const p = legacy();
  assert.equal(eco.expandTerritory(p).error, 'story_locked');
  p.village.max_grid = 20;                                    // Chapter 2 "Echoes Below" reward
  p.gold = 1500;
  assert.equal(eco.expandTerritory(p).error, 'missing_materials');
  p.frontier.warehouse.items = { plank: 30, stone: 31 };
  p.gold = 1499;
  assert.equal(eco.expandTerritory(p).error, 'not_enough_gold');
  p.gold = 1500;
  const castleBefore = p.village.buildings.find((b) => b.type === 'castle');
  const r = eco.expandTerritory(p);
  assert.ok(r.ok); assert.equal(p.village.grid_size, 20); assert.equal(p.gold, 0);
  assert.deepEqual(p.frontier.warehouse.items, { stone: 1 });
  assert.equal(eco.expandTerritory(p).error, 'story_locked', '24 needs Chapter 4');
  const castle = p.village.buildings.find((b) => b.type === 'castle');
  assert.deepEqual([castle.x, castle.y], [8, 2]);
  assert.ok(validateLayout(p.village, layoutOf(p.village)).ok);
  assert.ok(castleBefore);
});

test('twin sky-islands: [A] — bridge — [Heart Isle 20] — bridge — [B], bridges walkable, water blocks walkers', () => {
  const [nook, neen] = seedProfiles();
  const L = instanceLayout([{ owner: 'nook', village: nook.village }, { owner: 'neen', village: neen.village }]);
  for (const i of L.islands) buildCellIndex(i);
  assert.equal(L.islands[0].owner, 'neen'); assert.equal(L.islands[0].cx, 0);
  // Master Plan v2 §12: partner island at S/2 + 8 + 20 + 8 + S/2 (Heart Isle in the middle, appended last).
  assert.equal(L.islands[1].cx, 54); assert.equal(L.bridge.cx, 13);
  assert.equal(L.islands[2].kind, 'heart'); assert.equal(L.islands[2].cx, 27); assert.equal(L.islands[2].S, 20);
  assert.deepEqual(L.bridges.map((b) => b.cx), [13, 41]);
  assert.ok(groundAt(L, 13, 3).walkable, 'bridge deck');
  assert.ok(groundAt(L, 9.4, 3).walkable && groundAt(L, 16.6, 3).walkable, 'both landings');
  assert.ok(groundAt(L, 27, 3).walkable && groundAt(L, 41, 3).walkable, 'heart isle path + second bridge');
  assert.equal(groundAt(L, -5, 0.5).walkable, false, 'canal water');
  assert.equal(groundAt(L, -5, 0.5, { canFly: true }).walkable, true, 'wings glide over water');
  assert.equal(groundAt(L, -0.5, 0.5).walkable, true, 'footbridge');
  assert.equal(groundAt(L, 13, -6).walkable, false, 'sky between islands');
  assert.ok(groundAt(L, -0.5, 4).road, 'avenue is a road (+15%)');
  assert.ok(clampToArea(L, 13, -6).clamped);
  const sp = spawnPoint(L, 'nook', 'bkk');
  assert.equal(Math.abs(sp.x - 54) < 2, true);
  assert.ok(dockNear(L, 54 - 9 + 14.5, -9 + 11.0, 2.6), 'nook can fish from his dock');
});

test('fishing loot: free cast = pond fish only, bait unlocks koi/chest, co-op chest 13.5%', () => {
  const free = eco.lootTable({});
  assert.deepEqual(Object.keys(free), ['minnow', 'crab']);
  assert.ok(Math.abs(free.minnow - 0.6) < 1e-9);
  const bait = eco.lootTable({ bait: true });
  assert.ok(Math.abs(bait.chest - 0.10) < 1e-9 && Math.abs(bait.koi - 0.15) < 1e-9);
  const coop = eco.lootTable({ bait: true, coop: true });
  assert.ok(Math.abs(coop.chest - 0.135) < 1e-9);
  assert.ok(Math.abs(Object.values(coop).reduce((s, v) => s + v, 0) - 1) < 1e-9);
  assert.equal(eco.rollCatch({ bait: true }, seq(0.999)), 'chest');
  assert.equal(eco.rollCatch({}, seq(0.0)), 'minnow');
});

test('fishing rewards + codex milestones (1st/10th/50th = +50 💎) + chest dupe', () => {
  const p = starter();
  const d0 = p.diamonds, g0 = p.gold;
  const r = eco.awardCatch(p, 'crab');
  assert.equal(r.gold, 300); assert.equal(r.berries, 10); assert.equal(r.milestone, 50);
  assert.equal(p.gold, g0 + 300); assert.equal(p.diamonds, d0 + 50); assert.equal(p.exp, 25);
  for (let i = 0; i < 8; i++) eco.awardCatch(p, 'crab');
  assert.equal(eco.awardCatch(p, 'crab').milestone, 50, '10th crab');
  const c = eco.awardCatch(p, 'chest', seq(0));
  assert.equal(c.dupe, 'newbie_outfit'); assert.equal(p.inventory.newbie_outfit.dupes, 1); assert.equal(c.exp, 50);
});

test('fountain toss once per UTC day; onsen drop buff 15% for 1 h', () => {
  const [, beam] = seedProfiles();
  const now = Date.UTC(2026, 9, 15, 3);
  const g = beam.gold;
  const r = eco.fountainToss(beam, beam.village, now, seq(0.9, 0.5));
  assert.ok(r.ok); assert.equal(beam.gold, g - 100); assert.equal(r.diamonds, 10 + Math.floor(0.5 * 41));
  assert.equal(eco.fountainToss(beam, beam.village, now + 1000).error, 'already_tossed_today');
  assert.ok(eco.fountainToss(beam, beam.village, now + 86_400_000, seq(0.1)).ticket === 1);
  const nook = seedProfiles()[0];
  assert.equal(eco.fountainToss(nook, nook.village, now).error, 'no_fountain');
  const onsen = nook.village.buildings.find((b) => b.type === 'wnd_onsen');
  const b = eco.applyDropOnProp(nook, onsen, nook.village, now);
  assert.equal(b.pct, 15); assert.equal(nook.buffs.blacksmith.until, now + 3600_000);
  assert.equal(utcDay(now), utcDay(now + 1000));
});

test('migration repairs pre-Step-2 starter saves without losing progress', () => {
  const old = {
    id: 'old', village: {
      grid_size: 24, castle_lv: 3, comfort: 0, mood: 'sunny',
      buildings: [
        { id: 'castle', type: 'castle', lv: 3, x: 10, y: 4, rot: 0 }, { id: 'mint', type: 'mint', lv: 4, x: 4, y: 6, rot: 0 },
        { id: 'patisserie', type: 'patisserie', lv: 1, x: 16, y: 6, rot: 0 }, { id: 'shrine', type: 'shrine', lv: 2, x: 10, y: 10, rot: 0 },
        { id: 'nest', type: 'nest', lv: 1, x: 5, y: 13, rot: 0 }, { id: 'dock', type: 'dock', lv: 1, x: 18, y: 19, rot: 0 },
      ],
      tiles: [{ x: 11, y: 10, t: 'road' }, { x: 3, y: 12, t: 'water' }],
    },
  };
  migrateProfile(old, 1000);
  const v = old.village;
  assert.equal(v.grid_size, 18);
  assert.equal(v.levels.mint, 4); assert.equal(v.levels.shrine, 2); assert.equal(v.castle_lv, 3);
  assert.equal(v.tiles[0].t, 'road_cobble');
  assert.deepEqual(v.buildings.find((b) => b.type === 'shrine') && [v.buildings.find((b) => b.type === 'shrine').x], [6]);
  assert.ok(validateLayout(v, layoutOf(v)).ok);
  assert.equal(Object.keys(bagContents(v)).length, 5);
});

test('migrateProfile shrinks grid_size 24 to 18 and returns out-of-bounds non-core items to bag', () => {
  const custom = {
    id: 'custom24', village: {
      grid_size: 24, castle_lv: 1, comfort: 0, mood: 'sunny',
      wonders: { wnd_ferris: { stars: 1 } },
      decor: { dec_swing: 1 },
      levels: { mint: 1, shrine: 1, patisserie: 1, nest: 1, dock: 1 },
      buildings: [
        { uid: 'castle', type: 'castle', x: 7, y: 1, rot: 0 },
        { uid: 'mint', type: 'mint', x: 2, y: 3, rot: 0 },
        { uid: 'patisserie', type: 'patisserie', x: 13, y: 3, rot: 0 },
        { uid: 'shrine', type: 'shrine', x: 6, y: 7, rot: 0 },
        { uid: 'nest', type: 'nest', x: 2, y: 10, rot: 0 },
        { uid: 'dock', type: 'dock', x: 13, y: 10, rot: 0 },
        { uid: 'dec_swing_1', type: 'dec_swing', x: 20, y: 20, rot: 0 },
      ],
      tiles: [{ x: 8, y: 5, t: 'road_cobble' }, { x: 22, y: 22, t: 'road_cobble' }],
    },
  };
  migrateProfile(custom, 1000);
  const v = custom.village;
  assert.equal(v.grid_size, 18);
  assert.equal(v.buildings.find((b) => b.type === 'castle').x, 7);
  assert.equal(v.buildings.find((b) => b.type === 'mint').x, 2);
  assert.equal(v.buildings.find((b) => b.type === 'dec_swing'), undefined);
  const bag = bagContents(v);
  assert.equal(bag.dec_swing, 1);
  assert.equal(v.tiles.find((t) => t.x === 22), undefined);
  assert.ok(validateLayout(v, layoutOf(v)).ok);
});

test('saveLayout applies a valid move and rejects an invalid one', () => {
  const p = legacy();
  const L = layoutOf(p.village);
  L.buildings.find((b) => b.type === 'nest').x = 1;
  L.tiles.push({ x: 0, y: 0, t: 'road_sakura' });
  const r = eco.saveLayout(p, L);
  assert.ok(r.ok); assert.equal(r.comfort, 865);
  assert.equal(p.village.buildings.find((b) => b.type === 'nest').x, 1);
  Object.assign(L.buildings.find((b) => b.type === 'nest'), { x: 10, y: 4 });   // onto the castle
  assert.equal(eco.saveLayout(p, L).error, 'overlap');
  assert.equal(p.village.buildings.find((b) => b.type === 'nest').x, 1, 'rejected save leaves the village untouched');
});

test('fishing Sunken Chest target compass + Angler Exchange trades', () => {
  const p = starter();
  p.inventory.s1_naga_sovereign = { refine: 7, dupes: 0 };
  assert.equal(eco.setFishTarget(p, 'not_owned').error, 'item_not_owned');
  assert.equal(eco.setFishTarget(p, 's1_naga_sovereign').ok, true);

  // Catching a Sunken Chest gives the duplicate to the pinned target item
  const cRes = eco.awardCatch(p, 'chest', seq(0));
  assert.equal(cRes.dupe, 's1_naga_sovereign');
  assert.equal(cRes.targeted, true);
  assert.equal(p.inventory.s1_naga_sovereign.dupes, 1);
  assert.ok(cRes.weightKg >= 8.5);
  assert.equal(p.fish_basket.chest, 1);

  // Stock basket and trade in Angler's Exchange
  for (let i = 0; i < 6; i++) eco.awardCatch(p, 'minnow');
  for (let i = 0; i < 4; i++) eco.awardCatch(p, 'crab');
  assert.equal(p.fish_basket.minnow, 6);
  assert.equal(p.fish_basket.crab, 4);

  const ex1 = eco.redeemAnglerExchange(p, 'chest_targeted');
  assert.equal(ex1.ok, true);
  assert.equal(ex1.granted.dupe, 's1_naga_sovereign');
  assert.equal(p.inventory.s1_naga_sovereign.dupes, 2);
  assert.equal(p.fish_basket.minnow, 0);
  assert.equal(p.fish_basket.crab, 0);
  assert.equal(eco.redeemAnglerExchange(p, 'chest_targeted').error, 'not_enough_fish');
});

test('walkability & unstuck: ejects player from building footprints and enclosed pockets (<6 tiles)', () => {
  const p = starter();
  // Give player 4 1x1 birdbath lamps to form a 1x1 enclosed pocket around cell (10, 10)
  p.village.decor.dec_birdbath_lamp = 4;
  p.village.buildings.push(
    { uid: 'l_n', type: 'dec_birdbath_lamp', x: 10, y: 9, rot: 0 },
    { uid: 'l_s', type: 'dec_birdbath_lamp', x: 10, y: 11, rot: 0 },
    { uid: 'l_w', type: 'dec_birdbath_lamp', x: 9, y: 10, rot: 0 },
    { uid: 'l_e', type: 'dec_birdbath_lamp', x: 11, y: 10, rot: 0 },
  );
  const L = instanceLayout([{ owner: p.id, village: p.village }]);
  const isl = L.islands[0];
  buildCellIndex(isl);

  // 1. Inside the Castle footprint (7..10, 1..4) is unwalkable and snaps outside the Castle
  const inCastle = cellToWorld(isl, 8, 2, 1, 1);
  assert.equal(isWalkablePos(L, inCastle.x, inCastle.z), false);
  const outCastle = nearestWalkablePos(L, inCastle.x, inCastle.z);
  assert.equal(isWalkablePos(L, outCastle.x, outCastle.z), true);

  // 2. Inside the 1x1 enclosed pocket at (10, 10) has compSize === 1 (<6), so isWalkablePos is false
  // and nearestWalkablePos ejects the player outside the lantern ring into the open plaza
  const pocket = cellToWorld(isl, 10, 10, 1, 1);
  assert.equal(isl.index.compSize[10 * isl.S + 10], 1);
  assert.equal(isWalkablePos(L, pocket.x, pocket.z), false);
  const outPocket = nearestWalkablePos(L, pocket.x, pocket.z);
  assert.equal(isWalkablePos(L, outPocket.x, outPocket.z), true);
  assert.ok(Math.hypot(outPocket.x - pocket.x, outPocket.z - pocket.z) >= 1.2);
});


