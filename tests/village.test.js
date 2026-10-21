// tests/village.test.js — Step 2 pure rules + authoritative economy (node --test).
import test from 'node:test';
import assert from 'node:assert/strict';
import { CORE, WONDERS, DECOR, FISH, footprint, lerpLv, EXPANSION_TIERS, BLUEPRINT_CARDS } from '../shared/catalog_landmarks.js';
import {
  validateLayout, computeComfort, comfortBonusPct, storageCapHrs, harvestPreview, instanceLayout, buildCellIndex,
  groundAt, clampToArea, spawnPoint, dockNear, landingCells, bagContents, HOUR_MS, utcDay,
  isWalkablePos, nearestWalkablePos, cellToWorld,
} from '../shared/village_rules.js';
import * as eco from '../server/economy_service.js';
import { createStarterProfile, seedProfiles, migrateProfile } from '../server/profile_factory.js';

const seq = (...v) => { let i = 0; return () => v[i++ % v.length]; };
const starter = () => createStarterProfile('qa_v', 'pw12', 'bkk');
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

test('Lv 1 / Lv 10 yields are the documented endpoints, straight line between', () => {
  assert.equal(CORE.mint.perHour(1), 150); assert.equal(CORE.mint.perHour(10), 1200);
  assert.equal(CORE.patisserie.perHour(1), 20); assert.equal(CORE.patisserie.perHour(10), 120);
  assert.equal(CORE.shrine.perDay(1), 15); assert.equal(CORE.shrine.perDay(10), 60);
  assert.equal(CORE.mint.perHour(4), Math.floor(lerpLv(150, 1200, 4)));
});

test('starter island is valid and seeded villages compute comfort 4,850 / 6,660', () => {
  const p = starter();
  assert.ok(validateLayout(p.village, layoutOf(p.village)).ok);
  assert.equal(p.village.comfort, 860);                       // castle 150 + 5×100 + 42 tiles × 5
  const [nook, beam] = seedProfiles();
  assert.equal(nook.village.comfort, 4850); assert.equal(comfortBonusPct(4850), 24);
  assert.equal(beam.village.comfort, 6660);
  assert.equal(nook.cp, 15420); assert.equal(beam.cp, 15420);
});

test('layout validation: overlap, bounds, ownership, dock water rule, bridge landing', () => {
  const v = starter().village;
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

test('storage cap: 8h at Dock Lv1 → exactly 24h at Lv10, Casino ×2, Chonker +25–50%, Tent +5%', () => {
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
  const [, beam] = seedProfiles();   // Dock 7, Chonker ★2 (+37.5%), Tent (+5%)
  assert.ok(Math.abs(storageCapHrs(beam.village, beam) - (8 + 16 * 6 / 9) * 1.425) < 1e-9);
});

test('harvest: 60 s minimum, server clock, cap, multiplier, +15 EXP, daily diamonds once', () => {
  const p = starter();
  const t0 = Date.UTC(2026, 9, 15, 1, 0, 0);
  p.village.last_harvest_at = t0;
  assert.equal(eco.harvestAll(p, t0 + 10_000).ok, true, 'shrine daily diamonds are claimable at once');
  assert.equal(p.diamonds, 600 + 15);
  assert.equal(eco.harvestAll(p, t0 + 20_000).error, 'not_ready');
  const goldBefore = p.gold, expBefore = p.exp;
  const r = eco.harvestAll(p, t0 + 2 * HOUR_MS);
  const mult = 1 + 0.02 + comfortBonusPct(860) / 100;          // castle Lv1 + comfort +4%
  assert.equal(r.gold, Math.floor(150 * 2 * mult));
  assert.equal(r.berries, Math.floor(20 * 2 * mult));
  assert.equal(r.diamonds, 0);
  assert.equal(p.gold, goldBefore + r.gold);
  assert.equal(p.exp, expBefore + 15);
  // 3 days away: capped at 8 h
  const r2 = eco.harvestAll(p, t0 + 2 * HOUR_MS + 72 * HOUR_MS);
  assert.equal(r2.gold, Math.floor(150 * 8 * mult));
  assert.equal(r2.diamonds, 15, 'next UTC day → shrine pays again');
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

test('offline report only after >= 5 min away, same numbers as Harvest All', () => {
  const p = starter();
  const t0 = Date.UTC(2026, 9, 15, 1, 0, 0);
  p.village.last_harvest_at = t0;
  assert.equal(eco.computeOfflineGains(p, t0 + 4 * 60_000, t0), null);
  const rep = eco.computeOfflineGains(p, t0 + 6 * HOUR_MS + 20 * 60_000, t0);
  const pv = harvestPreview(p, t0 + 6 * HOUR_MS + 20 * 60_000);
  assert.equal(rep.gold, pv.gold); assert.equal(rep.berries, pv.berries); assert.equal(rep.diamonds, 15);
});

test('castle upgrade: 1,500 🪙 × L, landmark prerequisite, +100 EXP; blueprint upgrade uses cards', () => {
  const p = starter();
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

test('cloud expansion: tiers need castle level + gold, coordinates shift so nothing moves', () => {
  const p = starter();
  assert.equal(eco.expandTerritory(p).error, 'castle_too_low');
  p.village.castle_lv = 2; p.gold = 2500;
  const castleBefore = p.village.buildings.find((b) => b.type === 'castle');
  const r = eco.expandTerritory(p);
  assert.ok(r.ok); assert.equal(p.village.grid_size, 20); assert.equal(p.gold, 0);
  const castle = p.village.buildings.find((b) => b.type === 'castle');
  assert.deepEqual([castle.x, castle.y], [8, 2]);
  assert.ok(validateLayout(p.village, layoutOf(p.village)).ok);
  assert.ok(castleBefore);
});

test('twin sky-islands: partner island at S/2 + 8 + S/2, bridge walkable, water blocks walkers', () => {
  const [nook, neen] = seedProfiles();
  const L = instanceLayout([{ owner: 'nook', village: nook.village }, { owner: 'neen', village: neen.village }]);
  for (const i of L.islands) buildCellIndex(i);
  assert.equal(L.islands[0].owner, 'neen'); assert.equal(L.islands[0].cx, 0);
  assert.equal(L.islands[1].cx, 26); assert.equal(L.bridge.cx, 13);
  assert.ok(groundAt(L, 13, 3).walkable, 'bridge deck');
  assert.ok(groundAt(L, 9.4, 3).walkable && groundAt(L, 16.6, 3).walkable, 'both landings');
  assert.equal(groundAt(L, -5, 0.5).walkable, false, 'canal water');
  assert.equal(groundAt(L, -5, 0.5, { canFly: true }).walkable, true, 'wings glide over water');
  assert.equal(groundAt(L, -0.5, 0.5).walkable, true, 'footbridge');
  assert.equal(groundAt(L, 13, -6).walkable, false, 'sky between islands');
  assert.ok(groundAt(L, -0.5, 4).road, 'avenue is a road (+15%)');
  assert.ok(clampToArea(L, 13, -6).clamped);
  const sp = spawnPoint(L, 'nook', 'bkk');
  assert.equal(Math.abs(sp.x - 26) < 2, true);
  assert.ok(dockNear(L, 26 - 9 + 14.5, -9 + 11.0, 2.6), 'nook can fish from his dock');
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
  const p = starter();
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


