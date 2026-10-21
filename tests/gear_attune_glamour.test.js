// tests/gear_attune_glamour.test.js — Tests for 🎯 Gear Attunement & 👗 Wardrobe Glamour (GEAR_ATTUNEMENT_GLAMOUR.md).
// Covers inspectItemAttune, attuneCostFor ladder, server gearAttune validations, stat shifts with constant total sum,
// scroll consumption, wardrobeGlamour look overrides, and visibleSlotId paperdoll resolution.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ATTUNE_MIN_REFINE,
  ATTUNE_COSTS,
  attuneCostFor,
  inspectItemAttune,
  computeUniversalStats,
} from '../shared/universal_stats.js';
import { ACCESSORIES } from '../shared/catalog_gear_pets.js';
import { visibleSlotId } from '../shared/accessory_attach.js';
import { ultDefFor } from '../shared/cloud_dash_rules.js';
import { createStarterProfile } from '../server/profile_factory.js';
import * as rpg from '../server/rpg_service.js';

// Register test accessory definitions in the catalog if not already present
if (!ACCESSORIES.wings_heavenly_seraph) {
  ACCESSORIES.wings_heavenly_seraph = {
    slot: 'wings',
    rarity: 3,
    name: 'Heavenly Seraph Wings',
    stats: { all: 24 },
  };
}
if (!ACCESSORIES.hat_crown_aurora) {
  ACCESSORIES.hat_crown_aurora = {
    slot: 'hat',
    rarity: 2,
    name: 'Aurora Borealis Crown',
    stats: { fortune: 20, power: 16 },
  };
}

test('1. inspectItemAttune & attuneCostFor: cost ladder, unlock threshold, and stat line inspection', () => {
  // A. attuneCostFor ladder: 1st is free, 2nd is 2000 gold + 50 berries, scaling up to cap
  const cost0 = attuneCostFor(0);
  assert.deepEqual(cost0, { gold: 0, berries: 0, free: true }, '1st attunement is free');

  const cost1 = attuneCostFor(1);
  assert.deepEqual(cost1, { gold: 2000, berries: 50, free: false }, '2nd attunement costs 2000g + 50b');

  const cost2 = attuneCostFor(2);
  assert.deepEqual(cost2, { gold: 4000, berries: 100, free: false }, '3rd attunement costs 4000g + 100b');

  const cost3 = attuneCostFor(3);
  assert.deepEqual(cost3, { gold: 6000, berries: 150, free: false }, '4th attunement costs 6000g + 150b (cap)');

  // Costs beyond ladder length clamp to cap
  const cost99 = attuneCostFor(99);
  assert.deepEqual(cost99, { gold: 6000, berries: 150, free: false }, 'costs cap at max index');

  assert.equal(ATTUNE_MIN_REFINE, 5, 'ATTUNE_MIN_REFINE is 5');

  // B. inspectItemAttune on { all: 24 } item returns attunable: false
  const seraphInspect = inspectItemAttune('wings_heavenly_seraph', 5);
  assert.equal(seraphInspect.attunable, false);
  assert.equal(seraphInspect.reason, 'all_stat_item');

  // Catalog wings with { all: N } also return attunable: false
  const goldenSeraphInspect = inspectItemAttune('wings_golden_seraphim', 5);
  assert.equal(goldenSeraphInspect.attunable, false);
  assert.equal(goldenSeraphInspect.reason, 'all_stat_item');

  // C. inspectItemAttune on hat_crown_aurora at refine 4 returns attunable: true, unlocked: false (refine < 5)
  const hatRefine4 = inspectItemAttune('hat_crown_aurora', 4);
  assert.equal(hatRefine4.attunable, true);
  assert.equal(hatRefine4.unlocked, false);
  assert.equal(hatRefine4.slot, 'hat');
  assert.equal(hatRefine4.mainStat, 'fortune');
  assert.equal(hatRefine4.defaultSecStat, 'power');

  // D. inspectItemAttune on hat_crown_aurora at refine 5 with stat 'swiftness'
  const hatRefine5 = inspectItemAttune('hat_crown_aurora', 5, 'swiftness');
  assert.equal(hatRefine5.attunable, true);
  assert.equal(hatRefine5.unlocked, true);
  assert.equal(hatRefine5.mainStat, 'fortune');
  assert.equal(hatRefine5.defaultSecStat, 'power');
  assert.equal(hatRefine5.activeSecStat, 'swiftness');
  assert.equal(hatRefine5.allowedStats.length, 3);
  assert.ok(!hatRefine5.allowedStats.includes('fortune'), 'allowedStats must exclude locked mainStat (fortune)');
  assert.deepEqual(hatRefine5.allowedStats.sort(), ['luck', 'power', 'swiftness'].sort());

  // Also test with another catalog accessory (hat_mythic_jackpot_crown)
  const jackpotInspect = inspectItemAttune('hat_mythic_jackpot_crown', 5, 'power');
  assert.equal(jackpotInspect.attunable, true);
  assert.equal(jackpotInspect.unlocked, true);
  assert.equal(jackpotInspect.mainStat, 'fortune');
  assert.equal(jackpotInspect.defaultSecStat, 'luck');
  assert.equal(jackpotInspect.activeSecStat, 'power');
  assert.deepEqual(jackpotInspect.allowedStats.sort(), ['luck', 'power', 'swiftness'].sort());
});

test('2. gearAttune in server/rpg_service.js: validation, free 1st attune, stat point shift, and scroll support', () => {
  const p = createStarterProfile('attune_test_user', '1234', 'bkk');
  rpg.migrateRpg(p);
  p.gold = 50000;
  p.berries = 1000;

  // Add items to inventory
  p.inventory.hat_crown_aurora = { refine: 4, dupes: 0, pity: 0 };
  p.inventory.wings_heavenly_seraph = { refine: 5, dupes: 0, pity: 0 };
  p.inventory.newbie_outfit = { refine: 5, dupes: 0, pity: 0 };
  rpg.wardrobeEquip(p, { slot: 'hat', itemId: 'hat_crown_aurora' });

  // A. Rejects refine < 5
  const failRefine = rpg.gearAttune(p, { itemId: 'hat_crown_aurora', stat: 'swiftness' });
  assert.equal(failRefine.ok, false);
  assert.equal(failRefine.error, 'refine_too_low');
  assert.equal(failRefine.minRefine, 5);

  // B. Rejects all-stat wings / outfit
  const failWings = rpg.gearAttune(p, { itemId: 'wings_heavenly_seraph', stat: 'swiftness' });
  assert.equal(failWings.ok, false);
  assert.equal(failWings.error, 'all_stat_item');

  const failOutfit = rpg.gearAttune(p, { itemId: 'newbie_outfit', stat: 'swiftness' });
  assert.equal(failOutfit.ok, false);
  assert.equal(failOutfit.error, 'invalid_slot');

  // C. Rejects mainStat (cannot attune secondary line to match main stat)
  p.inventory.hat_crown_aurora.refine = 5;
  rpg.wardrobeEquip(p, { slot: 'hat', itemId: 'hat_crown_aurora' });

  const failMain = rpg.gearAttune(p, { itemId: 'hat_crown_aurora', stat: 'fortune' }); // fortune is mainStat
  assert.equal(failMain.ok, false);
  assert.equal(failMain.error, 'invalid_stat');

  // D. 1st attune is FREE (0 gold, 0 berries)
  const initialGold = p.gold;
  const initialBerries = p.berries;
  const beforeStats = computeUniversalStats(p);
  const beforeGearSum = Object.values(beforeStats.gear).reduce((a, b) => a + b, 0);

  const attune1 = rpg.gearAttune(p, { itemId: 'hat_crown_aurora', stat: 'swiftness' });
  assert.equal(attune1.ok, true);
  assert.deepEqual(attune1.spent, { gold: 0, berries: 0, scroll: 0 });
  assert.equal(p.gold, initialGold, 'gold unchanged on free 1st attune');
  assert.equal(p.berries, initialBerries, 'berries unchanged on free 1st attune');

  // Verify inventory and equipped mirror
  assert.equal(p.inventory.hat_crown_aurora.attune.stat, 'swiftness');
  assert.equal(p.inventory.hat_crown_aurora.attune.count, 1);
  assert.equal(p.equipped.hat.attune.stat, 'swiftness');
  assert.equal(p.equipped.hat.attune.count, 1);

  // Verify gear stats: secondary stat points shifted from power to swiftness, total gear sum identical!
  const afterStats1 = computeUniversalStats(p);
  const afterGearSum1 = Object.values(afterStats1.gear).reduce((a, b) => a + b, 0);

  assert.equal(afterGearSum1, beforeGearSum, 'total gear stat points sum must remain 100% identical');
  assert.ok(afterStats1.gear.swiftness > beforeStats.gear.swiftness, 'swiftness gained secondary stat points');
  assert.ok(afterStats1.gear.power < beforeStats.gear.power, 'power gave up its secondary stat points');
  assert.equal(afterStats1.gear.fortune, beforeStats.gear.fortune, 'main stat (fortune) remained identical');

  // E. 2nd attune deducts 2000 gold + 50 berries
  const attune2 = rpg.gearAttune(p, { itemId: 'hat_crown_aurora', stat: 'luck' });
  assert.equal(attune2.ok, true);
  assert.deepEqual(attune2.spent, { gold: 2000, berries: 50, scroll: 0 });
  assert.equal(p.gold, initialGold - 2000);
  assert.equal(p.berries, initialBerries - 50);
  assert.equal(p.inventory.hat_crown_aurora.attune.stat, 'luck');
  assert.equal(p.inventory.hat_crown_aurora.attune.count, 2);

  const afterStats2 = computeUniversalStats(p);
  const afterGearSum2 = Object.values(afterStats2.gear).reduce((a, b) => a + b, 0);
  assert.equal(afterGearSum2, beforeGearSum, 'total stat sum remains constant after 2nd attunement');
  assert.ok(afterStats2.gear.luck > beforeStats.gear.luck, 'luck gained secondary stat points');

  // F. 3rd attune using scroll: deducts 0 gold + 0 berries, consumes 1 scroll
  p.bag_items = p.bag_items || {};
  p.bag_items.attune_scroll = 1;
  p.bag_items.scroll_stat_attune = 1; // support both property aliases
  const goldBeforeScroll = p.gold;
  const berriesBeforeScroll = p.berries;

  const attuneScroll = rpg.gearAttune(p, { itemId: 'hat_crown_aurora', stat: 'swiftness', useScroll: true });
  assert.equal(attuneScroll.ok, true);
  assert.deepEqual(attuneScroll.spent, { gold: 0, berries: 0, scroll: 1 });
  assert.equal(p.gold, goldBeforeScroll, 'gold unchanged when using scroll');
  assert.equal(p.berries, berriesBeforeScroll, 'berries unchanged when using scroll');
  assert.equal(p.bag_items.attune_scroll, 0, 'attune scroll consumed from bag_items');
});

test('3. wardrobeGlamour & visibleSlotId: visual look override, stat/ult preservation, hide toggle, and clearing', () => {
  const p = createStarterProfile('glamour_test_user', '1234', 'dxb');
  rpg.migrateRpg(p);

  const statOutfit = 'newbie_outfit';
  const glamOutfit = 's1_naga_sovereign'; // owned outfit with different ultimate and look
  p.inventory[glamOutfit] = { refine: 0, dupes: 0, pity: 0 };
  p.equipped.outfit = { id: statOutfit, refine: 0 };
  rpg.syncGlamourAndAttune(p);

  const statsBefore = computeUniversalStats(p);
  const ultBefore = ultDefFor(p.equipped.outfit.id);

  // A. Setting wardrobeGlamour sets p.glamour.outfit and mirrors onto equipped
  const glamRes = rpg.wardrobeGlamour(p, { slot: 'outfit', itemId: glamOutfit });
  assert.equal(glamRes.ok, true);
  assert.equal(glamRes.slot, 'outfit');
  assert.equal(glamRes.itemId, glamOutfit);
  assert.equal(p.glamour.outfit, glamOutfit);
  assert.equal(p.equipped.glamour.outfit, glamOutfit);
  assert.equal(p.equipped.outfit.glamour, glamOutfit);

  // B. visibleSlotId returns the visual glamour look
  assert.equal(visibleSlotId(p.equipped, 'outfit'), glamOutfit, 'visibleSlotId returns the glamour outfit');

  // Stats and Ultimate remain 100% anchored to equipped.outfit.id
  assert.equal(p.equipped.outfit.id, statOutfit, 'stat-bearing outfit id is unchanged');
  const statsAfter = computeUniversalStats(p);
  const ultAfter = ultDefFor(p.equipped.outfit.id);

  assert.deepEqual(statsAfter.total, statsBefore.total, 'universal stats 100% unchanged with glamour');
  assert.deepEqual(statsAfter.gear, statsBefore.gear, 'gear stats 100% unchanged with glamour');
  assert.deepEqual(ultAfter, ultBefore, 'costume ultimate 100% unchanged with glamour');

  // C. p.equipped[slot].hide = true still returns null from visibleSlotId even when glamour is set
  p.equipped.outfit.hide = true;
  assert.equal(visibleSlotId(p.equipped, 'outfit'), null, 'visibleSlotId returns null when slot is hidden');

  // Unhide
  p.equipped.outfit.hide = false;
  assert.equal(visibleSlotId(p.equipped, 'outfit'), glamOutfit);

  // D. Clearing glamour restores visibleSlotId to equipped.outfit.id
  const clearRes = rpg.wardrobeGlamour(p, { slot: 'outfit', itemId: null });
  assert.equal(clearRes.ok, true);
  assert.equal(p.glamour.outfit, null);
  assert.equal(visibleSlotId(p.equipped, 'outfit'), statOutfit, 'visibleSlotId restores to original equipped outfit id');

  // E. Accessory slot glamour override (hat)
  const statHat = 'hat_mythic_jackpot_crown';
  const glamHat = 'hat_glowing_bunny';
  p.inventory[statHat] = { refine: 5, dupes: 0, pity: 0 };
  p.inventory[glamHat] = { refine: 0, dupes: 0, pity: 0 };
  rpg.wardrobeEquip(p, { slot: 'hat', itemId: statHat });

  const hatStatsBefore = computeUniversalStats(p);
  assert.equal(visibleSlotId(p.equipped, 'hat'), statHat);

  rpg.wardrobeGlamour(p, { slot: 'hat', itemId: glamHat });
  assert.equal(visibleSlotId(p.equipped, 'hat'), glamHat, 'visibleSlotId shows bunny ears look');
  assert.equal(p.equipped.hat.id, statHat, 'equipped hat still provides stats');

  const hatStatsAfter = computeUniversalStats(p);
  assert.deepEqual(hatStatsAfter.gear, hatStatsBefore.gear, 'gear stats unchanged by hat glamour');

  // Slot hide on hat
  p.equipped.hat.hide = true;
  assert.equal(visibleSlotId(p.equipped, 'hat'), null);
  p.equipped.hat.hide = false;

  // Clear hat glamour
  rpg.wardrobeGlamour(p, { slot: 'hat', itemId: null });
  assert.equal(visibleSlotId(p.equipped, 'hat'), statHat);
});
