// tests/frontier_profile.test.js — Sky Frontier player profile state tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultFrontier,
  deepFill,
  createStarterProfile,
  defaultProfile,
  seedProfiles,
  migrateProfile,
  publicProfile,
} from '../server/profile_factory.js';

test('defaultFrontier returns the complete Sky Frontier default schema', () => {
  const f = defaultFrontier();
  assert.equal(f.v, 1);
  assert.deepEqual(f.energy, {
    cur: 200,
    max: 200,
    lastRegenAt: 0,
    dailyFreeDay: -1,
    diamondRefillsDay: -1,
    diamondRefillsCount: 0,
    partnerGiftDay: -1,
  });
  assert.equal(f.chapter, 0);
  assert.deepEqual(f.chapterSteps, {});
  assert.deepEqual(f.unlocks, { regions: ['meadow'], gates: [] });
  assert.deepEqual(f.toolbelt, { pickaxe: 1, axe: 1, staff: 0, main: 'pickaxe', enchants: {} });
  assert.equal(f.ultimateCharmUid, null);
  assert.equal(f.mealBuff, null);
  assert.deepEqual(f.foodPouch, [null, null, null, null]);
  assert.deepEqual(f.warehouse, { lv: 1, items: {} });
  assert.deepEqual(f.campCrate, { items: {}, expiresAt: 0 });
  assert.equal(f.homeShardId, null);
  assert.deepEqual(f.discoveries, []);
  assert.deepEqual(f.claimedRewards, {});
  assert.deepEqual(f.stats, { nodes: 0, perfects: 0, invasions: 0, bosses: 0, mentorAssists: 0 });

  // Invocations produce isolated copies
  const f2 = defaultFrontier();
  f2.energy.cur = 50;
  f2.unlocks.regions.push('volcano');
  assert.equal(f.energy.cur, 200);
  assert.deepEqual(f.unlocks.regions, ['meadow']);
});

test('a new profile has the Sky Frontier defaults', () => {
  const p = createStarterProfile('new_hero', 'pass123', 'bkk');
  assert.ok(p.frontier, 'profile must have frontier');
  assert.deepEqual(p.frontier, defaultFrontier());

  const def = defaultProfile({ id: 'player_def', username: 'player_def' });
  assert.ok(def.frontier, 'defaultProfile must have frontier');
  assert.deepEqual(def.frontier, defaultFrontier());

  const [nook, neen] = seedProfiles();
  assert.ok(nook.frontier, 'seed nook must have frontier');
  assert.deepEqual(nook.frontier, defaultFrontier());
  assert.ok(neen.frontier, 'seed neen must have frontier');
  assert.deepEqual(neen.frontier, defaultFrontier());
});

test('migrating a profile without frontier adds it', () => {
  const legacyProfile = {
    id: 'legacy_user',
    username: 'legacy_user',
  };
  migrateProfile(legacyProfile);
  assert.ok(legacyProfile.frontier);
  assert.deepEqual(legacyProfile.frontier, defaultFrontier());

  const profileWithNull = {
    id: 'null_user',
    username: 'null_user',
    frontier: null,
  };
  migrateProfile(profileWithNull);
  assert.ok(profileWithNull.frontier);
  assert.deepEqual(profileWithNull.frontier, defaultFrontier());
});

test('partial frontier objects get filled without overwriting existing values', () => {
  const p = {
    id: 'partial_user',
    username: 'partial_user',
    frontier: {
      energy: { cur: 37 },
      toolbelt: { pickaxe: 2 },
      chapter: 2,
      unlocks: { regions: ['meadow', 'crystal_caves'] },
      foodPouch: ['berry_tart', null, null, null],
      stats: { nodes: 15 },
    },
  };

  migrateProfile(p);

  // Existing values preserved
  assert.equal(p.frontier.energy.cur, 37, 'energy.cur should stay 37');
  assert.equal(p.frontier.toolbelt.pickaxe, 2, 'toolbelt.pickaxe should stay 2');
  assert.equal(p.frontier.chapter, 2, 'chapter should stay 2');
  assert.deepEqual(p.frontier.unlocks.regions, ['meadow', 'crystal_caves'], 'regions array treated as leaf and preserved');
  assert.deepEqual(p.frontier.foodPouch, ['berry_tart', null, null, null], 'foodPouch array treated as leaf and preserved');
  assert.equal(p.frontier.stats.nodes, 15, 'stats.nodes should stay 15');

  // Missing nested values filled in from defaults
  assert.equal(p.frontier.v, 1);
  assert.equal(p.frontier.energy.max, 200);
  assert.equal(p.frontier.energy.lastRegenAt, 0);
  assert.equal(p.frontier.energy.dailyFreeDay, -1);
  assert.equal(p.frontier.energy.diamondRefillsDay, -1);
  assert.equal(p.frontier.energy.diamondRefillsCount, 0);
  assert.equal(p.frontier.energy.partnerGiftDay, -1);
  assert.deepEqual(p.frontier.chapterSteps, {});
  assert.deepEqual(p.frontier.unlocks.gates, []);
  assert.equal(p.frontier.toolbelt.axe, 1);
  assert.equal(p.frontier.toolbelt.staff, 0);
  assert.equal(p.frontier.toolbelt.main, 'pickaxe');
  assert.deepEqual(p.frontier.toolbelt.enchants, {});
  assert.equal(p.frontier.ultimateCharmUid, null);
  assert.equal(p.frontier.mealBuff, null);
  assert.deepEqual(p.frontier.warehouse, { lv: 1, items: {} });
  assert.deepEqual(p.frontier.campCrate, { items: {}, expiresAt: 0 });
  assert.equal(p.frontier.homeShardId, null);
  assert.deepEqual(p.frontier.discoveries, []);
  assert.deepEqual(p.frontier.claimedRewards, {});
  assert.equal(p.frontier.stats.perfects, 0);
  assert.equal(p.frontier.stats.invasions, 0);
  assert.equal(p.frontier.stats.bosses, 0);
  assert.equal(p.frontier.stats.mentorAssists, 0);
});

test('the self publicProfile includes frontier in full, and public view includes only { chapter }', () => {
  const p = createStarterProfile('view_tester', 'pass123', 'bkk');
  p.frontier.chapter = 3;
  p.frontier.energy.cur = 142;

  // Self view includes the full frontier object
  const selfView = publicProfile(p, { self: true });
  assert.ok(selfView.frontier);
  assert.equal(selfView.frontier.chapter, 3);
  assert.equal(selfView.frontier.energy.cur, 142);
  assert.deepEqual(selfView.frontier, p.frontier);

  // Other players' view includes only frontier: { chapter }
  const otherView = publicProfile(p);
  assert.ok(otherView.frontier);
  assert.deepEqual(otherView.frontier, { chapter: 3 });
  assert.equal(otherView.frontier.energy, undefined);
  assert.equal(otherView.frontier.toolbelt, undefined);
  assert.equal(otherView.frontier.warehouse, undefined);

  // Self view defaults frontier if profile lacked it
  const bareProfile = { id: 'bare', username: 'bare' };
  const bareSelf = publicProfile(bareProfile, { self: true });
  assert.deepEqual(bareSelf.frontier, defaultFrontier());

  // Other view defaults chapter to 0 if profile lacked frontier
  const bareOther = publicProfile(bareProfile);
  assert.deepEqual(bareOther.frontier, { chapter: 0 });
});
