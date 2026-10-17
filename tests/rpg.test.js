// tests/rpg.test.js — Step 3 authoritative math (Sections 7.C, 9.A, 12). Run: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { seedProfiles, createStarterProfile, migrateProfile } from '../server/profile_factory.js';
import * as rpg from '../server/rpg_service.js';
import {
  FORGE, forgeChance, forgeReady, traitOdds, BOX1, BOX2, BOX1_POOL, BOX1_BANNERS, DUPE_SHARDS, PET, petExpToNext, rollTrait, TRAITS,
  starsFromDupes, petPassivePct,
} from '../shared/rpg_rules.js';
import { ACCESSORIES } from '../shared/catalog_gear_pets.js';
import { recalcPlayerCP } from '../shared/progression.js';

const NOW = 1_800_000_000_000;
const fixed = (v) => () => v;                              // constant RNG
const seq = (...vals) => { let i = 0; return () => vals[i++ % vals.length]; };
const fresh = (who = 'nook') => {
  const id = who === 'beam' ? 'neen' : who;
  const p = seedProfiles().find((x) => x.id === id);
  migrateProfile(p, NOW); rpg.migrateRpg(p); p.cp = recalcPlayerCP(p);
  return p;
};

test('migration: pet uids, 3 trait slots, equipped pet mirror, CP unchanged (15,420)', () => {
  const nook = fresh('nook'), neen = fresh('neen');
  assert.equal(nook.cp, 15420); assert.equal(neen.cp, 15420);
  for (const pet of [...nook.pets, ...neen.pets]) { assert.ok(pet.uid); assert.equal(pet.traits.length, 3); }
  assert.equal(nook.equipped.pet.uid, nook.pets[0].uid);
  const s = rpg.migrateRpg(createStarterProfile('newbie', '1234', 'dxb'));
  assert.equal(s.pets[0].uid, 'pet1'); assert.equal(s.equipped.pet.uid, 'pet1');
});

test('forge table matches Section 9.A end points + berry / onsen / pity math', () => {
  assert.deepEqual([FORGE.RATE[1], FORGE.RATE[4], FORGE.RATE[5], FORGE.RATE[6], FORGE.RATE[7], FORGE.RATE[8], FORGE.RATE[9], FORGE.RATE[10]], [100, 75, 60, 50, 40, 35, 30, 20]);
  assert.deepEqual([FORGE.GOLD[1], FORGE.GOLD[4], FORGE.GOLD[5], FORGE.GOLD[6], FORGE.GOLD[7], FORGE.GOLD[8], FORGE.GOLD[9], FORGE.GOLD[10]], [500, 1000, 1200, 1500, 1800, 2000, 2200, 2500]);
  assert.equal(forgeChance(3, { useBerries: true }), 90);                 // +4: 75 → 90
  assert.equal(forgeChance(9), 20);
  assert.equal(forgeChance(9, { onsenPct: 15 }), 35);                    // "35% w/ Onsen"
  assert.equal(forgeChance(9, { useBerries: true, onsenPct: 15 }), 50);  // "35% → 50%"
  assert.equal(forgeChance(9, { pityFails: 8 }), 100);                   // 8 fails = guaranteed
  assert.equal(forgeChance(9, { pityFails: 4 }), 70);                    // 20 + 4 × 12.5
  assert.equal(forgeChance(10), 0);
});

test('forge: fail never downgrades, adds pity; +10 (20% base) is guaranteed on the 8th attempt; +10 = Sovereign title', () => {
  const p = fresh('neen');
  p.inventory.hat_cat_headset = { refine: 9, dupes: 20, pity: 0 };
  p.gold = 1e6; p.berries = 1e4;
  for (let i = 0; i < 7; i++) {
    const r = rpg.blacksmithForge(p, { itemId: 'hat_cat_headset' }, NOW, fixed(0.999));
    assert.equal(r.ok, true); assert.equal(r.success, false); assert.equal(r.newStar, 9); assert.equal(r.pity, i + 1);
  }
  const win = rpg.blacksmithForge(p, { itemId: 'hat_cat_headset' }, NOW, fixed(0.999));
  assert.equal(win.success, true); assert.equal(win.chance, 100); assert.equal(win.newStar, 10); assert.equal(win.pity, 0);
  assert.equal(win.sovereign, true); assert.equal(p.title, FORGE.SOVEREIGN_TITLE);
  assert.equal(p.inventory.hat_cat_headset.dupes, 20 - 8);               // 1 dupe per attempt at +10
  assert.equal(rpg.blacksmithForge(p, { itemId: 'hat_cat_headset' }, NOW).error, 'max_refine');
});

test('forge: gold / dupe / berry costs, onsen buff only while active, equipped refine + CP follow', () => {
  const p = fresh('nook');
  const before = p.cp;
  p.gold = 10000; p.berries = 100;
  p.inventory.face_rosegold_shades.dupes = 1;
  p.buffs.blacksmith = { pct: 15, until: NOW + 1000 };
  const r = rpg.blacksmithForge(p, { itemId: 'face_rosegold_shades', useBerries: true }, NOW, fixed(0)); // +8 → +9
  assert.equal(r.ok, true); assert.equal(r.success, true);
  assert.deepEqual(r.spent, { gold: 2200, berries: 50, dupes: 1, scrolls: 0 }); assert.equal(r.onsenPct, 15); assert.equal(r.chance, 60);
  assert.equal(p.equipped.face.refine, 9);
  assert.equal(p.cp, before + 30);                                         // ★1 200 × 15% per refine
  assert.equal(rpg.blacksmithForge(p, { itemId: 'face_rosegold_shades' }, NOW + 5000).error, 'not_enough_dupes');
  assert.equal(rpg.blacksmithForge(p, { itemId: 'nope' }, NOW).error, 'not_owned');
});

test('gacha box 1: costs, 10x Epic+ guarantee, 40-pull Mythic pity, dupes and +10 → shards', () => {
  const p = fresh('nook');
  p.diamonds = 100000;
  const ten = rpg.gachaPull(p, { box: 1, count: 10, currency: 'diamonds' }, fixed(0.99)); // all Rare without the guarantee
  assert.equal(ten.ok, true); assert.equal(ten.paid.diamonds, BOX1.COST_10);
  assert.equal(ten.items.filter((i) => i.rarity >= 2).length, 1);
  p.gacha.box1_pity = 38;
  const a = rpg.gachaPull(p, { box: 1, count: 1, currency: 'diamonds' }, fixed(0.99));
  assert.equal(a.pity, 39); assert.equal(a.items[0].rarity, 1);
  const b = rpg.gachaPull(p, { box: 1, count: 1, currency: 'diamonds' }, fixed(0.99));
  assert.equal(b.pityHit, true); assert.equal(b.items[0].rarity, 3); assert.equal(b.pity, 0);
  // owned at +10 → Mythic dupe converts to 100 🌟 (hat_glowing_bunny is +10 for nook)
  const shards = p.shards;
  const c = rpg.gachaPull(p, { box: 1, count: 1, currency: 'diamonds' }, seq(0.001, 0.9, 0.0));  // Mythic, not featured, first accessory
  assert.equal(c.items[0].id, BOX1_POOL[3].filter((k) => k !== 's11_zeus_olympus')[0]);
  assert.equal(c.items[0].kind, 'shards'); assert.equal(p.shards, shards + DUPE_SHARDS[3]);
  assert.equal(rpg.gachaPull(p, { box: 1, count: 1, currency: 'gold' }).error, 'bad_currency');
  p.bag_items.ticket_standard = 1;
  assert.equal(rpg.gachaPull(p, { box: 1, count: 1, currency: 'ticket' }, fixed(0.99)).ok, true);
  assert.equal(p.bag_items.ticket_standard, 0);
});

test('gacha box 2: gold / berries costs, blueprints, decor, wonder star-up', () => {
  const p = fresh('neen');
  p.gold = 100000; p.berries = 1000;
  assert.equal(rpg.gachaPull(p, { box: 2, count: 1, currency: 'berries' }).error, 'berries_10x_only');
  const g = rpg.gachaPull(p, { box: 2, count: 1, currency: 'gold' }, seq(0.5, 0.1, 0.0)); // common, blueprint, mint
  assert.equal(g.paid.gold, BOX2.COST_1); assert.equal(g.items[0].kind, 'blueprint'); assert.equal(g.items[0].target, 'mint');
  const d = rpg.gachaPull(p, { box: 2, count: 1, currency: 'gold' }, seq(0.5, 0.9, 0.0));  // common, decor
  assert.equal(d.items[0].kind, 'decor');
  const w = rpg.gachaPull(p, { box: 2, count: 1, currency: 'gold' }, seq(0.001, 0.0));     // mythic wonder (first ★3 = ferris, neen has ★2)
  assert.equal(w.items[0].kind, 'star_up'); assert.equal(p.village.wonders[w.items[0].id].stars, 3);
  const b = rpg.gachaPull(p, { box: 2, count: 10, currency: 'berries' }, fixed(0.5));
  assert.equal(b.paid.berries, BOX2.COST_10_BERRIES); assert.equal(b.items.length, 10);
});

test('shard shop: fixed prices, picks validated, pet egg', () => {
  const p = fresh('neen');
  p.shards = 1000;
  assert.equal(rpg.shardExchange(p, { offerId: 'mythic_outfit', pickId: 'hat_cat_headset' }).error, 'bad_pick');
  const o = rpg.shardExchange(p, { offerId: 'mythic_outfit', pickId: 's3_sultan_djinn' });
  assert.equal(o.ok, true); assert.equal(p.shards, 600); assert.equal(o.result.kind, 'new');
  const e = rpg.shardExchange(p, { offerId: 'night_fury_egg' });
  assert.equal(e.result.kind, 'new'); assert.ok(p.pets.find((x) => x.id === 'pet_nyx'));
  assert.equal(rpg.shardExchange(p, { offerId: 'mythic_outfit', pickId: 's1_naga_sovereign' }).error, 'not_enough_shards');
});

test('wardrobe: ownership, slot check, hide toggle keeps CP, pet equip by uid', () => {
  const p = fresh('neen');
  const cp = p.cp;
  assert.equal(rpg.wardrobeEquip(p, { slot: 'hat', itemId: 'face_cyber_visor' }).error, 'not_owned');
  assert.equal(rpg.wardrobeEquip(p, { slot: 'hat', itemId: 'gloves_starlight_wand' }).error, 'wrong_slot');
  assert.equal(rpg.wardrobeEquip(p, { slot: 'face', hide: true }).ok, true);
  assert.equal(p.equipped.face.hide, true); assert.equal(p.cp, cp);
  assert.equal(rpg.wardrobeEquip(p, { slot: 'hat', itemId: 'hat_cat_headset' }).ok, true);
  assert.equal(p.cp, cp - 1750 + 400);
  assert.equal(rpg.wardrobeEquip(p, { slot: 'outfit', itemId: null }).error, 'outfit_required');
  const kitsune = p.pets.find((x) => x.id === 'pet_kitsune');
  rpg.wardrobeEquip(p, { slot: 'pet', itemId: kitsune.uid });
  assert.equal(p.equipped.pet.id, 'pet_kitsune'); assert.equal(p.equipped.pet.level, 12);
});

test('pets: feed 10 🍓 = +50 EXP +25 mood, EXP curve 100 × Lv, cap Lv 20', () => {
  const p = fresh('neen');
  const kitsune = p.pets.find((x) => x.id === 'pet_kitsune');
  kitsune.mood = 50; kitsune.exp = 1150; // Lv 12 needs 1,200
  const r = rpg.petFeed(p, { petUid: kitsune.uid });
  assert.equal(r.ok, true); assert.equal(r.level, 13); assert.equal(r.exp, 0); assert.equal(r.mood, 75); assert.equal(r.levelsGained, 1);
  assert.equal(petExpToNext(19), 1900); assert.equal(petExpToNext(20), Infinity);
  const ragdoll = p.pets.find((x) => x.id === 'pet_ragdoll');
  assert.equal(rpg.petFeed(p, { petUid: ragdoll.uid }).error, 'pet_maxed');
});

test('traits: odds sum to 100 at Nest Lv 1 and 10; reroll touches one slot; couple egg is Epic/Mythic', () => {
  for (const lv of [1, 5, 10]) assert.equal(Math.round(Object.values(traitOdds(lv)).reduce((a, b) => a + b, 0)), 100);
  assert.deepEqual(traitOdds(10), { mythic: 6, epic: 24, rare: 35, common: 35 });
  for (let i = 0; i < 200; i++) assert.ok(['epic', 'mythic'].includes(TRAITS[rollTrait(1, Math.random, { minTier: 'epic' })].tier));
  const p = fresh('neen');
  const ragdoll = p.pets[0];
  ragdoll.traits = ['magnet_paw', 'cozy_purr', null];
  const r = rpg.petRerollTrait(p, { petUid: ragdoll.uid, slotIdx: 2 }, fixed(0.0));
  assert.equal(r.ok, true); assert.equal(r.cost, PET.REROLL_COST); assert.equal(r.tier, 'mythic');
  assert.deepEqual(r.traits.slice(0, 2), ['magnet_paw', 'cozy_purr']);
});

test('couple breeding: 2,000 🪙 + 100 🍓, partner pet, dupe adds Pet Essence, +30 player EXP', () => {
  const nook = fresh('nook'), neen = fresh('neen');
  neen.gold = 100000; neen.berries = 10000;
  const gold = neen.gold, berries = neen.berries;
  const r = rpg.petBreedCouple(neen, nook, { myPetUid: neen.pets[0].uid }, seq(0.9, 0.0, 0.0)); // species = partner's (pet_nyx)
  assert.equal(r.ok, true);
  assert.equal(neen.gold, gold - PET.BREED_GOLD); assert.equal(neen.berries, berries - PET.BREED_BERRIES);
  assert.equal(r.hatched.id, 'pet_nyx'); assert.equal(r.hatched.kind, 'new'); assert.equal(r.tier, 'mythic');
  assert.equal(neen.pets.find((x) => x.id === 'pet_nyx').traits[0], r.trait);
  // own species → ragdoll (★2, starts with 50 essence): duplicate egg converts into +25 Pet Essence (total 75)!
  const again = rpg.petBreedCouple(neen, nook, { myPetUid: neen.pets[0].uid }, seq(0.1, 0.5, 0.0));
  assert.equal(again.hatched.kind, 'essence'); assert.equal(again.hatched.essenceGained, 25);
  assert.equal(neen.pets[0].essence, 75);
  const stranger = rpg.migrateRpg(createStarterProfile('zed', '1234', 'bkk'));
  assert.equal(rpg.petBreedCouple(neen, stranger, { myPetUid: neen.pets[0].uid }).error, 'not_partner_or_friend');
});

// ---------------------------------------------------------------------------------------------
// Step 3 completion: Artisan Scroll, red dot, Box 1 sub-banners, pet star-dupes (D2), tickets, passives
// ---------------------------------------------------------------------------------------------
test('artisan scroll: targets +5..+10 only, +25% rate, double pity on a miss, consumes 1 scroll', () => {
  const p = fresh('neen');
  p.gold = 1e6; p.berries = 1e4; p.bag_items.scroll_forge_boost = 2;
  p.inventory.hat_cat_headset = { refine: 3, dupes: 10, pity: 0 };
  assert.equal(rpg.blacksmithForge(p, { itemId: 'hat_cat_headset', useScroll: true }, NOW).error, 'scroll_not_allowed'); // target +4
  assert.equal(p.bag_items.scroll_forge_boost, 2);
  assert.equal(forgeChance(9, { useScroll: true, useBerries: true }), 60);           // 20 + 25 + 15
  assert.equal(forgeChance(3, { useScroll: true }), forgeChance(3));                 // ignored below +5
  p.inventory.hat_cat_headset.refine = 4;                                            // target +5: 60%
  const miss = rpg.blacksmithForge(p, { itemId: 'hat_cat_headset', useScroll: true }, NOW, fixed(0.999));
  assert.equal(miss.chance, 85); assert.equal(miss.success, false); assert.equal(miss.pity, 2); assert.equal(miss.pityPct, 25);
  assert.equal(miss.spent.scrolls, 1); assert.equal(p.bag_items.scroll_forge_boost, 1);
  const plain = rpg.blacksmithForge(p, { itemId: 'hat_cat_headset' }, NOW, fixed(0.999));   // 60 + 2 × 12.5
  assert.equal(plain.chance, 85); assert.equal(plain.pity, 3); assert.equal(plain.spent.scrolls, 0);
  const win = rpg.blacksmithForge(p, { itemId: 'hat_cat_headset', useScroll: true }, NOW, fixed(0.999)); // 60 + 25 + 37.5
  assert.equal(win.chance, 100); assert.equal(win.success, true); assert.equal(win.newStar, 5); assert.equal(win.pity, 0);
  assert.equal(p.bag_items.scroll_forge_boost, 0);
  assert.equal(rpg.blacksmithForge(p, { itemId: 'hat_cat_headset', useScroll: true }, NOW).error, 'not_enough_scrolls');
});

test('forge red dot: needs dupes >= 1 (and the level\'s dupe cost) + next gold cost, ignores +10 and unknown ids', () => {
  const p = { gold: 10000, inventory: { hat_cat_headset: { refine: 0, dupes: 0 }, not_an_item: { refine: 0, dupes: 9 } } };
  assert.equal(forgeReady(p), false);
  p.inventory.hat_cat_headset.dupes = 1; assert.equal(forgeReady(p), true);
  p.inventory.hat_cat_headset.refine = 10; assert.equal(forgeReady(p), false);
  p.inventory.hat_cat_headset.refine = 4; p.gold = FORGE.GOLD[5] - 1; assert.equal(forgeReady(p), false);
  p.gold = FORGE.GOLD[5]; assert.equal(forgeReady(p), true);
  assert.equal(forgeReady(null), false);
});

test('box 1 banners: bad banner refunds nothing taken, relics = accessories with 2× rate-up, own pity per banner', () => {
  const p = fresh('nook');
  p.diamonds = 100000;
  assert.equal(rpg.gachaPull(p, { box: 1, count: 1, currency: 'diamonds', banner: 'nope' }).error, 'bad_banner');
  assert.equal(p.diamonds, 100000);
  for (const r of [1, 2, 3]) assert.ok(BOX1_BANNERS.relics.pool[r].every((k) => ACCESSORIES[k]));
  // Mythic accessories in catalog order (weights: 2,1,2,1,2 + fourteen 1s = total 22): r < 2/22 → bunny ears, next 1/22 → monocle
  const pool3 = BOX1_BANNERS.relics.pool[3];
  assert.deepEqual(pool3, [
    'hat_glowing_bunny', 'face_oracle_monocle', 'gloves_starlight_wand', 'boots_astral_striders', 'wings_golden_seraphim',
    'hat_seraphim_rose_crown', 'face_seraphim_veil_glasses', 'gloves_seraphim_silk_gauntlets', 'boots_seraphim_heels',
    'wings_seraphim_rose_six', 'back_seraphim_nine_tails', 'back_seraphim_stardust_veil',
    'hat_astral_eclipse_crown', 'face_astral_eclipse_visor', 'gloves_astral_eclipse_bracers', 'boots_astral_eclipse_sabaton',
    'wings_astral_eclipse_six', 'back_astral_eclipse_comet_tail', 'back_astral_eclipse_regalia_cape',
    'hat_aurora_spirit_hood', 'face_aurora_starlight_glasses', 'gloves_aurora_orb_mitts', 'boots_aurora_spirit_slippers',
    'wings_aurora_crystal_wings', 'back_aurora_spirit_tail', 'back_aurora_starlit_mantle',
  ]);
  assert.equal(rpg.gachaPull(p, { box: 1, count: 1, currency: 'diamonds', banner: 'relics' }, seq(0.001, 0.05)).items[0].id, 'hat_glowing_bunny');
  assert.equal(rpg.gachaPull(p, { box: 1, count: 1, currency: 'diamonds', banner: 'relics' }, seq(0.001, 0.10)).items[0].id, 'face_oracle_monocle');
  p.gacha.box1_pity = 30; p.gacha.box1_relics_pity = 0;
  const r = rpg.gachaPull(p, { box: 1, count: 1, currency: 'diamonds', banner: 'relics' }, fixed(0.99));
  assert.equal(r.banner, 'relics'); assert.equal(r.pity, 1); assert.equal(p.gacha.box1_pity, 30);
  assert.equal(rpg.gachaPull(p, { box: 1, count: 1, currency: 'diamonds' }, fixed(0.99)).banner, 'season'); // default
  assert.equal(p.gacha.box1_pity, 31);
});

test('box 1 pet egg banner: grants pets, 10x Epic+ guarantee, dupes grant Pet Essence', () => {
  const p = fresh('neen');
  p.diamonds = 100000;
  assert.deepEqual(BOX1_BANNERS.pets.rates, { 3: 0.03, 2: 0.15, 1: 0.82 });
  const ten = rpg.gachaPull(p, { box: 1, count: 10, currency: 'diamonds', banner: 'pets' }, fixed(0.99));
  assert.equal(ten.ok, true); assert.ok(ten.items.every((i) => i.pet && i.rarity >= 1));
  assert.equal(ten.items.filter((i) => i.rarity >= 2).length, 1);
  const p2 = fresh('neen');
  p2.diamonds = 100000;
  p2.pets = p2.pets.filter((x) => x.id !== 'pet_ragdoll');
  const first = BOX1_BANNERS.pets.pool[1][0];
  const a = rpg.gachaPull(p2, { box: 1, count: 1, currency: 'diamonds', banner: 'pets' }, seq(0.99, 0.0));
  assert.equal(a.items[0].id, first); assert.equal(a.items[0].kind, 'new'); assert.equal(a.items[0].stars, 1);
  const b = rpg.gachaPull(p2, { box: 1, count: 1, currency: 'diamonds', banner: 'pets' }, seq(0.99, 0.0));
  assert.equal(b.items[0].kind, 'essence'); assert.equal(b.items[0].essenceGained, 10); assert.equal(b.items[0].essence, 10);
  assert.equal(p2.gacha.box1_pets_pity, 2);
});

test('pet star-dupes: thresholds 2 / 5, migration credits pets already above their tier, ★3 dupe → 100 🌟', () => {
  assert.deepEqual([0, 1, 2, 4, 5, 9].map(starsFromDupes), [1, 1, 2, 2, 3, 3]);
  const p = rpg.migrateRpg({
    equipped: {}, pets: [
      { id: 'pet_yuzu_capybara', stars: 3, level: 1 },   // tier 2 at ★3 → 5 (pet_skywhale)
      { id: 'pet_mochi_cat', stars: 2, level: 1 },       // tier 1 at ★2 → 2 (pet_ragdoll)
      { id: 'pet_moon_bunny', stars: null, level: 1 },   // at tier → 0 (pet_kitsune)
    ],
  });
  assert.deepEqual(p.pets.map((x) => x.star_dupes), [5, 2, 0]);
  const q = fresh('neen');
  q.shards = 0; q.diamonds = 100000;
  q.pets.find((x) => x.id === 'pet_ragdoll').stars = 3;
  const r = rpg.gachaPull(q, { box: 1, count: 1, currency: 'diamonds', banner: 'pets' }, seq(0.001, 0.0)); // ★3, first = pet_ragdoll
  assert.equal(r.items[0].id, 'pet_ragdoll'); assert.equal(r.items[0].kind, 'shards'); assert.equal(q.shards, DUPE_SHARDS[3]);
});

test('box 2 gold ticket (🎫) pays 1 per pull; box 1 never accepts gold tickets', () => {
  const p = fresh('neen');
  p.bag_items.ticket_gold = 1; p.bag_items.ticket_standard = 0;
  const r = rpg.gachaPull(p, { box: 2, count: 1, currency: 'ticket' }, fixed(0.5));
  assert.equal(r.ok, true); assert.deepEqual(r.paid, { ticket_gold: 1 }); assert.equal(p.bag_items.ticket_gold, 0);
  assert.equal(rpg.gachaPull(p, { box: 2, count: 1, currency: 'ticket' }).error, 'not_enough_tickets');
  p.bag_items.ticket_gold = 5;
  assert.equal(rpg.gachaPull(p, { box: 1, count: 1, currency: 'ticket' }).error, 'not_enough_tickets');
});

test('pet passive %: ★1 → ★3 family range (★2 midpoint), +1%/Lv, ×1.25 only at Lv 20 + full mood', () => {
  assert.equal(petPassivePct('pet_ragdoll', 1, 1), 15);
  assert.equal(petPassivePct('pet_ragdoll', 2, 1), 25);
  assert.equal(petPassivePct('pet_ragdoll', 3, 1), 35);
  assert.equal(petPassivePct('pet_skywhale', 3, 20, 100), 86.3);   // (50 + 19) × 1.25 = 86.25
  assert.equal(petPassivePct('pet_skywhale', 3, 20, 99), 69);
  assert.equal(petPassivePct('nope', 3, 20), 0);
});

test('13 Season Mythic Outfits in Box 1 + Rate-Up Wish Selector + 9 Collectible 3D Dice Skins', async () => {
  const { DICE_SKINS } = await import('../shared/catalog_gear_pets.js');
  const { SEASON_OUTFITS } = await import('../shared/rpg_rules.js');
  assert.equal(SEASON_OUTFITS.length, 13);
  for (const id of SEASON_OUTFITS) assert.ok(BOX1_POOL[3].includes(id), `${id} in BOX1_POOL[3]`);
  assert.equal(Object.keys(DICE_SKINS).length, 9);

  const p = fresh('neen');
  p.diamonds = 100000;
  p.shards = 500;
  // Set featured wish to s5_atlantis_siren
  assert.equal(rpg.setFeaturedOutfit(p, { outfitId: 'hat_cat_headset' }).error, 'bad_outfit');
  const setWish = rpg.setFeaturedOutfit(p, { outfitId: 's5_atlantis_siren' });
  assert.equal(setWish.ok, true);
  assert.equal(p.gacha.featured_outfit, 's5_atlantis_siren');
  const wishPull = rpg.gachaPull(p, { box: 1, count: 1, currency: 'diamonds', banner: 'season' }, seq(0.001, 0.1));
  assert.equal(wishPull.items[0].id, 's5_atlantis_siren');

  // Lucky 3D Dice sub-banner pull
  const dicePull = rpg.gachaPull(p, { box: 1, count: 1, currency: 'diamonds', banner: 'dice' }, seq(0.001, 0.0));
  assert.equal(dicePull.ok, true);
  assert.equal(dicePull.banner, 'dice');
  assert.equal(dicePull.items[0].id, 'dice_glacial_crystal');

  // Shard Shop: mythic_dice (150 🌟) & accessory_dupe_box with dice skin (80 🌟)
  const exDice = rpg.shardExchange(p, { offerId: 'mythic_dice', pickId: 'dice_astral_galaxy' });
  assert.equal(exDice.ok, true);
  assert.equal(p.shards, 350);
  const exDupe = rpg.shardExchange(p, { offerId: 'accessory_dupe_box', pickId: 'dice_astral_galaxy' });
  assert.equal(exDupe.ok, true);
  assert.equal(p.shards, 270);
  assert.equal(p.inventory.dice_astral_galaxy.dupes, 1);

  // Equip 3D Dice Skin in Wardrobe & Forge it
  const cpBefore = p.cp;
  const eqRes = rpg.wardrobeEquip(p, { slot: 'dice', itemId: 'dice_astral_galaxy' });
  assert.equal(eqRes.ok, true);
  assert.equal(p.equipped.dice.id, 'dice_astral_galaxy');
  assert.equal(p.cp, cpBefore + 700); // ★3 Mythic gear/dice base CP = 700

  p.gold = 50000;
  const fgRes = rpg.blacksmithForge(p, { itemId: 'dice_astral_galaxy' }, NOW, fixed(0));
  assert.equal(fgRes.ok, true);
  assert.equal(fgRes.newStar, 1);
  assert.equal(p.equipped.dice.refine, 1);
  assert.equal(p.cp, cpBefore + 805); // 700 * 1.15 = 805
});

test('pet multi-select idle pose rotation: unlocks by bond_lv, filters locked poses, and syncs equipped mirror', async () => {
  const { unlockedSelectablePosesForLevel, normalizeActivePoses, addBondXp } = await import('../shared/rpg_rules.js');
  assert.deepEqual(unlockedSelectablePosesForLevel(1), ['front']);
  assert.deepEqual(unlockedSelectablePosesForLevel(5), ['front', 'sleep']);
  assert.deepEqual(unlockedSelectablePosesForLevel(10), ['front', 'sleep', 'happy']);
  assert.deepEqual(unlockedSelectablePosesForLevel(15), ['front', 'sleep', 'happy', 'cast']);
  assert.deepEqual(unlockedSelectablePosesForLevel(25), ['front', 'sleep', 'happy', 'cast', 'flip']);

  // Default when unset = all unlocked poses for that level
  assert.deepEqual(normalizeActivePoses(undefined, 10), ['front', 'sleep', 'happy']);
  // Filters out locked poses and preserves canonical order
  assert.deepEqual(normalizeActivePoses(['sleep', 'flip'], 5), ['sleep']);
  // Guarantees at least 1 unlocked pose if selection becomes empty
  assert.deepEqual(normalizeActivePoses([], 5), ['front', 'sleep']);

  const p = fresh('nook');
  const pet = p.pets[0];
  pet.bond_lv = 10;
  const res1 = rpg.petSetPoses(p, { petUid: pet.uid, poses: ['sleep', 'happy'] });
  assert.equal(res1.ok, true);
  assert.deepEqual(res1.active_poses, ['sleep', 'happy']);
  assert.deepEqual(p.equipped.pet.active_poses, ['sleep', 'happy']);

  // Leveling up across a pose milestone (Lv.10 -> Lv.15) auto-adds newly unlocked 'cast' pose
  addBondXp(pet, 5000);
  assert.ok(pet.bond_lv >= 15);
  assert.ok(pet.active_poses.includes('sleep') && pet.active_poses.includes('happy') && pet.active_poses.includes('cast'));
});


