// tests/story_rules.test.js — Pure game rules verification for village story chapters (Master Plan §11.6).
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CHAPTERS,
  BASE_UNLOCKED_BUILDINGS,
  BASE_UNLOCKED_REGIONS,
  BASE_ISLAND_SIZE,
  STEP_KINDS,
  defaultStory,
  recordEvent,
  isChapterComplete,
  claimChapter,
  unlockedBuildings,
  unlockedRegions,
  maxIslandSize,
  currentSteps,
  unlockedResidents,
  unlockedMonuments,
} from '../shared/story_rules.js';

test('chapters are numbered sequentially (0 to 4) with valid schema', () => {
  assert.equal(CHAPTERS.length, 5);
  const ids = CHAPTERS.map((c) => c.id);
  assert.deepEqual(ids, [0, 1, 2, 3, 4]);

  const titles = CHAPTERS.map((c) => c.title);
  assert.deepEqual(titles, [
    'Landfall',
    'Smoke on the Wind',
    'Echoes Below',
    'Seeds of the Sky',
    'Feathered Things',
  ]);

  for (const ch of CHAPTERS) {
    assert.ok(typeof ch.id === 'number', `Chapter ${ch.id} id must be number`);
    assert.ok(typeof ch.title === 'string' && ch.title.length > 0, `Chapter ${ch.id} title non-empty`);
    assert.ok(Array.isArray(ch.steps) && ch.steps.length > 0, `Chapter ${ch.id} steps non-empty`);
    assert.ok(ch.rewards && typeof ch.rewards === 'object', `Chapter ${ch.id} rewards object`);
    assert.ok(Array.isArray(ch.rewards.unlockBuildings), `Chapter ${ch.id} rewards unlockBuildings array`);
    assert.ok(Array.isArray(ch.rewards.unlockRegions), `Chapter ${ch.id} rewards unlockRegions array`);
    assert.ok(ch.rewards.items && typeof ch.rewards.items === 'object', `Chapter ${ch.id} rewards items object`);
    assert.ok(Array.isArray(ch.rewards.residents), `Chapter ${ch.id} rewards residents array`);
    assert.ok(typeof ch.rewards.gold === 'number' && ch.rewards.gold > 0, `Chapter ${ch.id} rewards gold > 0`);
  }

  // Specific milestone rewards
  assert.equal(CHAPTERS[2].rewards.expandTo, 20);
  assert.equal(CHAPTERS[4].rewards.expandTo, 24);
  assert.equal(CHAPTERS[4].rewards.unlockMonument, 'wnd_onsen');
});

test('every step kind is valid and follows step schema', () => {
  const seenStepIds = new Set();
  const allowedKinds = new Set(STEP_KINDS);

  for (const ch of CHAPTERS) {
    for (const step of ch.steps) {
      assert.ok(!seenStepIds.has(step.id), `Step id ${step.id} must be unique`);
      seenStepIds.add(step.id);

      assert.ok(typeof step.id === 'string' && step.id.length > 0, 'step.id non-empty string');
      assert.ok(typeof step.text === 'string' && step.text.length > 0, 'step.text non-empty string');
      assert.ok(allowedKinds.has(step.kind), `step kind "${step.kind}" is valid`);
      assert.ok(Number.isInteger(step.count) && step.count > 0, `step count must be positive integer: ${step.count}`);

      if (step.kind === 'deliver_orders') {
        assert.equal(step.count, 3);
      } else {
        assert.ok(typeof step.target === 'string' && step.target.length > 0, `step target non-empty for ${step.kind}`);
      }
    }
  }

  // Verify all 7 step kinds are represented across chapters
  const kindsUsed = new Set();
  for (const ch of CHAPTERS) {
    for (const s of ch.steps) kindsUsed.add(s.kind);
  }
  for (const expectedKind of STEP_KINDS) {
    assert.ok(kindsUsed.has(expectedKind), `Kind "${expectedKind}" should be used in launch chapters`);
  }
});

test('defaultStory returns expected initial state', () => {
  const story = defaultStory();
  assert.equal(story.chapter, 0);
  assert.deepEqual(story.progress, {});
  assert.deepEqual(story.completed, []);
  assert.deepEqual(story.claimed, []);

  assert.equal(isChapterComplete(story), false);
  const steps = currentSteps(story);
  assert.equal(steps.length, 3);
  for (const s of steps) {
    assert.equal(s.have, 0);
    assert.equal(s.done, false);
  }

  assert.deepEqual(unlockedBuildings(story), BASE_UNLOCKED_BUILDINGS);
  assert.deepEqual(unlockedRegions(story), ['meadow']);
  assert.equal(maxIslandSize(story), 18);
});

test('event recording only affects the current chapter and caps at count', () => {
  const story = defaultStory();

  // Gathering sky_wheat belongs to chapter 1, so on chapter 0 it must have NO effect
  const irrelevant = recordEvent(story, { kind: 'gather', target: 'sky_wheat', amount: 5 });
  assert.deepEqual(irrelevant, []);
  assert.deepEqual(story.progress, {});

  // Crafting flour belongs to chapter 1
  const irrelevantCraft = recordEvent(story, { kind: 'craft', target: 'flour', amount: 1 });
  assert.deepEqual(irrelevantCraft, []);
  assert.deepEqual(story.progress, {});

  // Gathering wood belongs to chapter 0 (count: 12)
  const woodFirst = recordEvent(story, { kind: 'gather', target: 'wood', amount: 5 });
  assert.deepEqual(woodFirst, ['c0_gather_wood']);
  assert.equal(story.progress.c0_gather_wood, 5);

  // Partial increment
  const woodSecond = recordEvent(story, { kind: 'gather', target: 'wood', amount: 3 });
  assert.deepEqual(woodSecond, ['c0_gather_wood']);
  assert.equal(story.progress.c0_gather_wood, 8);

  // Overflow caps strictly at count 12
  const woodCap = recordEvent(story, { kind: 'gather', target: 'wood', amount: 10 });
  assert.deepEqual(woodCap, ['c0_gather_wood']);
  assert.equal(story.progress.c0_gather_wood, 12);

  // Subsequent events when capped return empty changed array and do not increment further
  const woodNoop = recordEvent(story, { kind: 'gather', target: 'wood', amount: 1 });
  assert.deepEqual(woodNoop, []);
  assert.equal(story.progress.c0_gather_wood, 12);

  // Invalid amounts (0 or negative) return empty
  const zeroAmt = recordEvent(story, { kind: 'gather', target: 'stone', amount: 0 });
  assert.deepEqual(zeroAmt, []);
  assert.equal(story.progress.c0_gather_stone, undefined);

  const negAmt = recordEvent(story, { kind: 'gather', target: 'stone', amount: -5 });
  assert.deepEqual(negAmt, []);
  assert.equal(story.progress.c0_gather_stone, undefined);

  // Default amount is 1
  const stoneOne = recordEvent(story, { kind: 'gather', target: 'stone' });
  assert.deepEqual(stoneOne, ['c0_gather_stone']);
  assert.equal(story.progress.c0_gather_stone, 1);
});

test('currentSteps reflects have and done for UI', () => {
  const story = defaultStory();
  recordEvent(story, { kind: 'gather', target: 'wood', amount: 12 });
  recordEvent(story, { kind: 'gather', target: 'stone', amount: 4 });

  const steps = currentSteps(story);
  assert.equal(steps.length, 3);

  const woodStep = steps.find((s) => s.id === 'c0_gather_wood');
  assert.equal(woodStep.have, 12);
  assert.equal(woodStep.done, true);

  const stoneStep = steps.find((s) => s.id === 'c0_gather_stone');
  assert.equal(stoneStep.have, 4);
  assert.equal(stoneStep.done, false);

  const outpostStep = steps.find((s) => s.id === 'c0_visit_outpost');
  assert.equal(outpostStep.have, 0);
  assert.equal(outpostStep.done, false);
});

test('claim flow including double-claim protection and advancement', () => {
  const story = defaultStory();

  // Incomplete claim rejection
  const premature = claimChapter(story);
  assert.equal(premature.ok, false);
  assert.equal(premature.error, 'incomplete');
  assert.equal(story.chapter, 0);
  assert.deepEqual(story.completed, []);
  assert.deepEqual(story.claimed, []);

  // Complete chapter 0 steps
  recordEvent(story, { kind: 'gather', target: 'wood', amount: 12 });
  recordEvent(story, { kind: 'gather', target: 'stone', amount: 8 });
  recordEvent(story, { kind: 'visit', target: 'outpost', amount: 1 });

  assert.equal(isChapterComplete(story), true);

  // Successful claim
  const claimResult = claimChapter(story);
  assert.equal(claimResult.ok, true);
  assert.equal(claimResult.rewards.gold, 300);
  assert.deepEqual(claimResult.rewards.unlockBuildings, ['castle', 'tent', 'farm_plot']);

  // Chapter advanced, completed & claimed recorded, progress reset
  assert.equal(story.chapter, 1);
  assert.deepEqual(story.completed, [0]);
  assert.deepEqual(story.claimed, [0]);
  assert.deepEqual(story.progress, {});

  // Immediate re-claim fails because new chapter 1 is incomplete
  const immediateReclaim = claimChapter(story);
  assert.equal(immediateReclaim.ok, false);
  assert.equal(immediateReclaim.error, 'incomplete');

  // Attempting to double-claim chapter 0 if chapter pointer is forced back to 0
  story.chapter = 0;
  const doubleClaim = claimChapter(story);
  assert.equal(doubleClaim.ok, false);
  assert.equal(doubleClaim.error, 'done');
});

test('unlocked lists and island size accumulate across chapters', () => {
  const story = defaultStory();

  // Baseline
  assert.deepEqual(unlockedBuildings(story), ['castle']);
  assert.deepEqual(unlockedRegions(story), ['meadow']);
  assert.equal(maxIslandSize(story), 18);
  assert.deepEqual(unlockedResidents(story), []);
  assert.deepEqual(unlockedMonuments(story), []);

  // Complete & claim Chapter 0 (Landfall)
  recordEvent(story, { kind: 'gather', target: 'wood', amount: 12 });
  recordEvent(story, { kind: 'gather', target: 'stone', amount: 8 });
  recordEvent(story, { kind: 'visit', target: 'outpost', amount: 1 });
  claimChapter(story);

  assert.deepEqual(unlockedBuildings(story), ['castle', 'tent', 'farm_plot']);
  assert.deepEqual(unlockedRegions(story), ['meadow']);
  assert.equal(maxIslandSize(story), 18);

  // Complete & claim Chapter 1 (Smoke on the Wind)
  recordEvent(story, { kind: 'visit', target: 'wheat' });
  recordEvent(story, { kind: 'gather', target: 'sky_wheat', amount: 15 });
  recordEvent(story, { kind: 'build', target: 'windmill_bakery' });
  recordEvent(story, { kind: 'craft', target: 'flour', amount: 3 });
  recordEvent(story, { kind: 'build', target: 'patisserie' });
  recordEvent(story, { kind: 'craft', target: 'bread', amount: 2 });
  const c1Res = claimChapter(story);
  assert.equal(c1Res.ok, true);
  assert.equal(c1Res.rewards.gold, 600);

  assert.deepEqual(unlockedBuildings(story), [
    'castle',
    'tent',
    'farm_plot',
    'windmill_bakery',
    'patisserie',
    'owl_post_office',
  ]);
  assert.deepEqual(unlockedResidents(story), ['baker']);
  assert.equal(maxIslandSize(story), 18);

  // Complete & claim Chapter 2 (Echoes Below) — expands to 20, unlocks hollow region
  recordEvent(story, { kind: 'deliver_orders', amount: 3 });
  recordEvent(story, { kind: 'visit', target: 'gate_hollow' });
  recordEvent(story, { kind: 'gather', target: 'crystal_ore', amount: 12 });
  recordEvent(story, { kind: 'build', target: 'mint' });
  recordEvent(story, { kind: 'craft', target: 'ingot', amount: 3 });
  recordEvent(story, { kind: 'build', target: 'workshop' });
  recordEvent(story, { kind: 'craft', target: 'plank', amount: 5 });
  const c2Res = claimChapter(story);
  assert.equal(c2Res.ok, true);
  assert.equal(c2Res.rewards.gold, 1000);

  assert.deepEqual(unlockedRegions(story), ['meadow', 'hollow']);
  assert.equal(maxIslandSize(story), 20);
  assert.ok(unlockedBuildings(story).includes('mint'));
  assert.ok(unlockedBuildings(story).includes('workshop'));
  assert.deepEqual(unlockedResidents(story), ['baker', 'miner', 'smith']);

  // Complete & claim Chapter 3 (Seeds of the Sky)
  recordEvent(story, { kind: 'harvest', target: 'herb', amount: 3 });
  recordEvent(story, { kind: 'build', target: 'flower_greenhouse' });
  recordEvent(story, { kind: 'craft', target: 'potion_small', amount: 2 });
  recordEvent(story, { kind: 'build', target: 'cottage' });
  const c3Res = claimChapter(story);
  assert.equal(c3Res.ok, true);
  assert.equal(c3Res.rewards.gold, 1400);

  assert.ok(unlockedBuildings(story).includes('flower_greenhouse'));
  assert.ok(unlockedBuildings(story).includes('cottage'));
  assert.deepEqual(unlockedResidents(story), ['baker', 'miner', 'smith', 'botanist']);
  assert.equal(maxIslandSize(story), 20);

  // Complete & claim Chapter 4 (Feathered Things) — expands to 24, unlocks wnd_onsen
  recordEvent(story, { kind: 'craft', target: 'repair_kit', amount: 1 });
  recordEvent(story, { kind: 'defeat', target: 'elder_moss_golem' });
  recordEvent(story, { kind: 'build', target: 'nest' });
  const c4Res = claimChapter(story);
  assert.equal(c4Res.ok, true);
  assert.equal(c4Res.rewards.gold, 2000);

  assert.ok(unlockedBuildings(story).includes('nest'));
  assert.deepEqual(unlockedResidents(story), ['baker', 'miner', 'smith', 'botanist', 'pet_keeper']);
  assert.equal(maxIslandSize(story), 24);
  assert.deepEqual(unlockedMonuments(story), ['wnd_onsen']);

  // Story is complete (chapter 5 does not exist)
  assert.equal(story.chapter, 5);
  assert.deepEqual(story.completed, [0, 1, 2, 3, 4]);
  assert.deepEqual(story.claimed, [0, 1, 2, 3, 4]);

  const endClaim = claimChapter(story);
  assert.equal(endClaim.ok, false);
  assert.equal(endClaim.error, 'done');

  assert.equal(isChapterComplete(story), false);
  assert.deepEqual(currentSteps(story), []);
  assert.deepEqual(recordEvent(story, { kind: 'gather', target: 'wood' }), []);
});

test('deliver_orders matching handles target specified or omitted', () => {
  const story = defaultStory();
  story.chapter = 2; // jump to chapter 2

  // deliver_orders without target
  const r1 = recordEvent(story, { kind: 'deliver_orders', amount: 1 });
  assert.deepEqual(r1, ['c2_deliver_orders']);
  assert.equal(story.progress.c2_deliver_orders, 1);

  // deliver_orders with target
  const r2 = recordEvent(story, { kind: 'deliver_orders', target: 'order', amount: 2 });
  assert.deepEqual(r2, ['c2_deliver_orders']);
  assert.equal(story.progress.c2_deliver_orders, 3);

  // Further events cap at 3
  const r3 = recordEvent(story, { kind: 'deliver_orders', amount: 1 });
  assert.deepEqual(r3, []);
  assert.equal(story.progress.c2_deliver_orders, 3);
});
