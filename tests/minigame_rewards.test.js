// tests/minigame_rewards.test.js — Tests for minigame material rewards (§13 Master Plan v2).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CAMP_CRATE_EXPIRE_MS,
  FISHING_MATERIAL_REWARDS,
  FISHING_CHEST_ANCIENT_GEAR_CHANCE,
  fishingCatchMaterials,
  cloudDashMaterials,
  MONOPOLY_MERCHANT_CRATES,
  monopolyMerchantCrate,
  CASINO_MATERIAL_EXCHANGES,
  CASINO_MATERIAL_WEEKLY_CAP,
  getIsoWeek,
  validateCasinoMaterialExchange,
  executeCasinoMaterialExchange,
  grantMinigameItems,
  grantProfileMinigameMaterials,
} from '../shared/minigame_rewards.js';
import { awardCatch } from '../server/economy_service.js';
import { createCloudDashAdapter } from '../server/cloud_dash_service.js';
import { createTableService } from '../server/table_service.js';
import { createCasinoAdapter, executeCasinoMaterialExchange as casinoExchange } from '../server/casino_service.js';

// -----------------------------------------------------------------------------
// Pure Helpers: grantMinigameItems & grantProfileMinigameMaterials
// -----------------------------------------------------------------------------
test('minigame_rewards pure: grantMinigameItems routes raw/refined to warehouse and goods to pantry', () => {
  const stores = {
    warehouse: { lv: 1, items: {} },
    pantry: { lv: 1, items: {} },
  };
  const campCrate = { items: {}, expiresAt: 0 };
  const now = 1_700_000_000_000;

  const res = grantMinigameItems(stores, campCrate, {
    fish: 5,
    plank: 10,
    bread: 2,
  }, now);

  assert.deepEqual(res.added, { fish: 5, plank: 10, bread: 2 });
  assert.deepEqual(res.overflow, {});
  assert.equal(stores.warehouse.items.fish, 5);
  assert.equal(stores.warehouse.items.plank, 10);
  assert.equal(stores.pantry.items.bread, 2);
  assert.equal(Object.keys(campCrate.items).length, 0);
});

test('minigame_rewards pure: overflow routes into campCrate with 24h expiration', () => {
  // Warehouse lv 1 capacity = 300
  const stores = {
    warehouse: { lv: 1, items: { stone: 298 } },
    pantry: { lv: 1, items: {} },
  };
  const campCrate = { items: {}, expiresAt: 0 };
  const now = 1_700_000_000_000;

  // Add 5 wood: 2 should fit in warehouse (total 300), 3 overflow to campCrate
  const res = grantMinigameItems(stores, campCrate, { wood: 5 }, now);

  assert.equal(res.added.wood, 2);
  assert.equal(res.overflow.wood, 3);
  assert.equal(stores.warehouse.items.stone, 298);
  assert.equal(stores.warehouse.items.wood, 2);
  assert.equal(campCrate.items.wood, 3);
  assert.equal(campCrate.expiresAt, now + CAMP_CRATE_EXPIRE_MS);
});

test('minigame_rewards pure: expired campCrate is cleared before receiving new overflow', () => {
  const stores = {
    warehouse: { lv: 1, items: { stone: 300 } },
    pantry: { lv: 1, items: {} },
  };
  const campCrate = {
    items: { old_wood: 10 },
    expiresAt: 1_000,
  };
  const now = 20_000; // Past expiresAt

  const res = grantMinigameItems(stores, campCrate, { wood: 4 }, now);

  assert.equal(res.overflow.wood, 4);
  assert.equal(campCrate.items.old_wood, undefined, 'expired item purged');
  assert.equal(campCrate.items.wood, 4);
  assert.equal(campCrate.expiresAt, now + CAMP_CRATE_EXPIRE_MS);
});

test('minigame_rewards pure: grantProfileMinigameMaterials auto-vivifies profile frontier stores', () => {
  const profile = { id: 'u1' };
  const res = grantProfileMinigameMaterials(profile, { fish: 3 });

  assert.equal(res.added.fish, 3);
  assert.ok(profile.frontier.warehouse);
  assert.ok(profile.frontier.pantry);
  assert.ok(profile.frontier.campCrate);
  assert.equal(profile.frontier.warehouse.items.fish, 3);
});

// -----------------------------------------------------------------------------
// Pure Helpers: Fishing
// -----------------------------------------------------------------------------
test('minigame_rewards pure: fishingCatchMaterials grants correct materials per catch type', () => {
  assert.deepEqual(fishingCatchMaterials('minnow'), { fish: 1 });
  assert.deepEqual(fishingCatchMaterials('crab'), { fish: 2 });
  assert.deepEqual(fishingCatchMaterials('koi'), { fish: 3 });

  // Chest without ancient_gear (rng >= 0.10)
  assert.deepEqual(fishingCatchMaterials('chest', () => 0.50), { ingot: 2 });

  // Chest with ancient_gear (rng < 0.10)
  assert.deepEqual(fishingCatchMaterials('chest', () => 0.05), { ingot: 2, ancient_gear: 1 });

  // Unknown catch
  assert.deepEqual(fishingCatchMaterials('unknown'), {});
});

// -----------------------------------------------------------------------------
// Pure Helpers: Cloud Dash
// -----------------------------------------------------------------------------
test('minigame_rewards pure: cloudDashMaterials scales feather by distance/score and cloud_silk by place', () => {
  // 1st place finished 1000m -> feather = 10, silk = 4
  const m1 = cloudDashMaterials({ place: 1, distance: 1000 });
  assert.equal(m1.feather, 10);
  assert.equal(m1.cloud_silk, 4);

  // 2nd place finished 800m -> feather = 8, silk = 3
  const m2 = cloudDashMaterials({ place: 2, distance: 800 });
  assert.equal(m2.feather, 8);
  assert.equal(m2.cloud_silk, 3);

  // 3rd place finished 500m -> feather = 5, silk = 2
  const m3 = cloudDashMaterials({ place: 3, distance: 500 });
  assert.equal(m3.feather, 5);
  assert.equal(m3.cloud_silk, 2);

  // 4th place finished 300m -> feather = 3, silk = 1
  const m4 = cloudDashMaterials({ place: 4, distance: 300 });
  assert.equal(m4.feather, 3);
  assert.equal(m4.cloud_silk, 1);

  // Clamping: minimum feather = 1, maximum feather = 12
  const mZero = cloudDashMaterials({ place: 4, distance: 0 });
  assert.equal(mZero.feather, 1);
  assert.equal(mZero.cloud_silk, 1);

  const mHuge = cloudDashMaterials({ place: 1, distance: 2000 });
  assert.equal(mHuge.feather, 12);
  assert.equal(mHuge.cloud_silk, 4);

  // Fallback to style if distance not provided
  const mStyle = cloudDashMaterials({ place: 1, style: 9500 });
  assert.equal(mStyle.feather, 9);
  assert.equal(mStyle.cloud_silk, 4);
});

// -----------------------------------------------------------------------------
// Pure Helpers: Monopoly Merchant Crate
// -----------------------------------------------------------------------------
test('minigame_rewards pure: monopolyMerchantCrate gives crates scaled by rank', () => {
  assert.deepEqual(monopolyMerchantCrate(1), { plank: 6, ingot: 3, flour: 4 });
  assert.deepEqual(monopolyMerchantCrate(2), { plank: 4, ingot: 2, flour: 2 });
  assert.deepEqual(monopolyMerchantCrate(3), { plank: 2, flour: 2 });
  assert.deepEqual(monopolyMerchantCrate(4), { plank: 2, flour: 2 });
});

// -----------------------------------------------------------------------------
// Pure Helpers: Casino Material Exchange
// -----------------------------------------------------------------------------
test('minigame_rewards pure: getIsoWeek returns consistent ISO 8601 week', () => {
  assert.equal(getIsoWeek('2026-10-22T15:33:32Z'), '2026-W43');
});

test('minigame_rewards pure: executeCasinoMaterialExchange validates and trades properly', () => {
  const p = {
    id: 'u1',
    gold: 1000,
  };
  const now = Date.parse('2026-10-22T15:33:32Z');

  // Trade herb_seed: cost 200, grants 1
  const r1 = executeCasinoMaterialExchange(p, 'herb_seed', now);
  assert.equal(r1.ok, true);
  assert.equal(r1.cost, 200);
  assert.equal(p.gold, 800);
  assert.equal(p.casino_mat.n, 1);
  assert.equal(r1.remainingExchanges, 19);
  assert.equal(p.frontier.warehouse.items.herb_seed, 1);

  // Trade sky_wheat: cost 50, grants 5
  const r2 = executeCasinoMaterialExchange(p, 'sky_wheat', now);
  assert.equal(r2.ok, true);
  assert.equal(r2.cost, 50);
  assert.equal(r2.count, 5);
  assert.equal(p.gold, 750);
  assert.equal(p.casino_mat.n, 2);
  assert.equal(p.frontier.warehouse.items.sky_wheat, 5);

  // Trade berries_crop: cost 50, grants 5
  const r3 = executeCasinoMaterialExchange(p, 'berries_crop', now);
  assert.equal(r3.ok, true);
  assert.equal(p.gold, 700);
  assert.equal(p.frontier.warehouse.items.berries_crop, 5);

  // Trade honey: cost 150, grants 1
  const r4 = executeCasinoMaterialExchange(p, 'honey', now);
  assert.equal(r4.ok, true);
  assert.equal(p.gold, 550);
  assert.equal(p.frontier.warehouse.items.honey, 1);

  // Insufficient currency rejection
  p.gold = 30;
  const rFail = executeCasinoMaterialExchange(p, 'sky_wheat', now);
  assert.equal(rFail.ok, false);
  assert.equal(rFail.error, 'insufficient_gold');
});

test('minigame_rewards pure: casino material exchange respects weekly 20 cap', () => {
  const p = { id: 'u1', gold: 50_000 };
  const now = Date.parse('2026-10-22T15:33:32Z');

  for (let i = 0; i < 20; i++) {
    const res = executeCasinoMaterialExchange(p, 'sky_wheat', now);
    assert.equal(res.ok, true);
    assert.equal(res.exchangesThisWeek, i + 1);
  }

  // 21st attempt in same week fails
  const capped = executeCasinoMaterialExchange(p, 'sky_wheat', now);
  assert.equal(capped.ok, false);
  assert.equal(capped.error, 'weekly_cap_reached');

  // Next week resets limit
  const nextWeekNow = now + 8 * 86_400_000;
  const reset = executeCasinoMaterialExchange(p, 'sky_wheat', nextWeekNow);
  assert.equal(reset.ok, true);
  assert.equal(reset.exchangesThisWeek, 1);
});

test('minigame_rewards pure: casino exchange uses casino_chips if present on profile', () => {
  const p = { id: 'u1', gold: 1000, casino_chips: 300 };
  const now = Date.parse('2026-10-22T15:33:32Z');

  const res = executeCasinoMaterialExchange(p, 'herb_seed', now);
  assert.equal(res.ok, true);
  assert.equal(res.currency, 'chips');
  assert.equal(p.casino_chips, 100);
  assert.equal(p.gold, 1000, 'gold untouched when chips are used');

  // Try again when chips insufficient (100 < 200)
  const failRes = executeCasinoMaterialExchange(p, 'herb_seed', now);
  assert.equal(failRes.ok, false);
  assert.equal(failRes.error, 'insufficient_chips');
});

// -----------------------------------------------------------------------------
// Integration Hooks
// -----------------------------------------------------------------------------
test('hook integration: fishing awardCatch grants fish and sunken chest materials', () => {
  const p = {
    id: 'fisherman',
    gold: 0,
    diamonds: 0,
    berries: 0,
    exp: 0,
    level: 1,
    inventory: {},
    fish_codex: {},
    fish_basket: {},
    fish_records: {},
    village: { levels: {}, buildings: [], plots: [], tiles: {}, decor: [] },
  };

  // 1. Minnow -> fish: 1
  const rMinnow = awardCatch(p, 'minnow');
  assert.deepEqual(rMinnow.materials, { fish: 1 });
  assert.equal(p.frontier.warehouse.items.fish, 1);

  // 2. Crab -> fish: 2 (total 3)
  const rCrab = awardCatch(p, 'crab');
  assert.deepEqual(rCrab.materials, { fish: 2 });
  assert.equal(p.frontier.warehouse.items.fish, 3);

  // 3. Koi -> fish: 3 (total 6)
  const rKoi = awardCatch(p, 'koi');
  assert.deepEqual(rKoi.materials, { fish: 3 });
  assert.equal(p.frontier.warehouse.items.fish, 6);

  // 4. Sunken Chest -> ingot: 2 + 10% ancient_gear
  const rChest = awardCatch(p, 'chest', () => 0.05); // forces ancient_gear
  assert.deepEqual(rChest.materials, { ingot: 2, ancient_gear: 1 });
  assert.equal(p.frontier.warehouse.items.ingot, 2);
  assert.equal(p.frontier.warehouse.items.ancient_gear, 1);
});

test('hook integration: Cloud Dash finishRace awards feather & cloud_silk and adds to profile', () => {
  let now = 1_000_000;
  const prof = {
    id: 'runner',
    username: 'Runner',
    gold: 0,
    berries: 0,
    diamonds: 0,
    level: 1,
    exp: 0,
    pets: [],
    frontier: { warehouse: { lv: 1, items: {} }, pantry: { lv: 1, items: {} } },
  };
  const sent = [];
  const adapter = createCloudDashAdapter({
    db: { getProfile: (id) => (id === 'runner' ? prof : null), markProfile() {} },
    send: (ids, m) => sent.push(m),
    humans: () => ['runner'],
    now: () => now,
  });
  const table = {
    id: 'cd_t1',
    mode: 'cloud_dash',
    seats: [{ kind: 'human', userId: 'runner' }, { kind: 'empty' }, { kind: 'empty' }, { kind: 'empty' }],
  };

  adapter.start(table, {});
  now += 3700;
  adapter.tick(table, now);

  // Simulate runner progress to finish (1000m)
  for (let i = 0; i < 800 && table.cloudDash.status !== 'ended'; i++) {
    now += 200;
    adapter.tick(table, now);
    const rt = (now - table.cloudDash.goAt) / 1000;
    const s = Math.min(1001, rt * 20);
    adapter.handle(table, 'runner', {
      type: 'cd_report',
      t: rt,
      s,
      l: 0,
      y: 0,
      v: 20,
      style: 10000,
      coins: 50,
      fin: s >= 1000 ? 1 : 0,
      ft: s >= 1000 ? rt : null,
    });
  }

  assert.equal(table.cloudDash.status, 'ended');
  const rw = table.cloudDash.rewards.runner;
  assert.ok(rw);
  assert.ok(rw.materials, 'materials included in Cloud Dash reward payload');
  assert.ok(rw.materials.feather >= 1 && rw.materials.feather <= 12);
  assert.ok(rw.materials.cloud_silk >= 1 && rw.materials.cloud_silk <= 4);

  // Stored in profile frontier warehouse
  assert.equal(prof.frontier.warehouse.items.feather, rw.materials.feather);
  assert.equal(prof.frontier.warehouse.items.cloud_silk, rw.materials.cloud_silk);
});

test('hook integration: Monopoly payout grants Merchant Crate to human players', () => {
  const prof1 = {
    id: 'p_winner',
    gold: 0,
    diamonds: 0,
    berries: 0,
    level: 1,
    exp: 0,
    frontier: { warehouse: { lv: 1, items: {} }, pantry: { lv: 1, items: {} } },
  };
  const prof2 = {
    id: 'p_second',
    gold: 0,
    diamonds: 0,
    berries: 0,
    level: 1,
    exp: 0,
    frontier: { warehouse: { lv: 1, items: {} }, pantry: { lv: 1, items: {} } },
  };
  const db = {
    getProfile: (id) => (id === 'p_winner' ? prof1 : id === 'p_second' ? prof2 : null),
    markProfile() {},
  };
  const svc = createTableService({
    db,
    sendTo: () => {},
    onlineIds: () => [],
    now: () => 1_700_000_000_000,
  });

  const table = {
    id: 'mono_t1',
    match: {
      players: [
        { seat: 0, id: 'p_winner', isBot: false },
        { seat: 1, id: 'p_second', isBot: false },
        { seat: 2, id: 'bot3', isBot: true },
      ],
    },
  };
  const result = {
    reason: 'bankruptcy',
    winner: 0,
    ranking: [
      { seat: 0, rank: 1 },
      { seat: 1, rank: 2 },
      { seat: 2, rank: 3 },
    ],
  };

  const payoutRes = svc._payout(table, result);
  svc.close();

  // Winner received winner crate: { plank: 6, ingot: 3, flour: 4 }
  assert.deepEqual(payoutRes.p_winner.merchantCrate, { plank: 6, ingot: 3, flour: 4 });
  assert.deepEqual(payoutRes.p_winner.materials, { plank: 6, ingot: 3, flour: 4 });
  assert.equal(prof1.frontier.warehouse.items.plank, 6);
  assert.equal(prof1.frontier.warehouse.items.ingot, 3);
  assert.equal(prof1.frontier.warehouse.items.flour, 4);

  // 2nd place received 2nd crate: { plank: 4, ingot: 2, flour: 2 }
  assert.deepEqual(payoutRes.p_second.merchantCrate, { plank: 4, ingot: 2, flour: 2 });
  assert.equal(prof2.frontier.warehouse.items.plank, 4);
  assert.equal(prof2.frontier.warehouse.items.ingot, 2);
  assert.equal(prof2.frontier.warehouse.items.flour, 2);
});

test('hook integration: Casino material exchange via table service message dispatch', () => {
  const prof = {
    id: 'bettor',
    gold: 5000,
    frontier: { warehouse: { lv: 1, items: {} }, pantry: { lv: 1, items: {} } },
  };
  const sent = [];
  const db = {
    getProfile: (id) => (id === 'bettor' ? prof : null),
    markProfile() {},
  };
  const svc = createTableService({
    db,
    sendTo: (userId, msg) => sent.push({ userId, msg }),
    onlineIds: () => ['bettor'],
    now: () => Date.parse('2026-10-22T15:33:32Z'),
  });

  const res = svc.handle('bettor', {
    type: 'casino_material_exchange',
    item: 'honey',
  });
  svc.close();

  assert.equal(res.ok, true);
  assert.equal(res.item, 'honey');
  assert.equal(res.cost, 150);
  assert.equal(prof.gold, 4850);
  assert.equal(prof.frontier.warehouse.items.honey, 1);
  assert.equal(prof.casino_mat.n, 1);

  // Response broadcast
  assert.ok(sent.some((s) => s.msg.type === 'casino_material_exchange_result' && s.msg.item === 'honey'));
});
