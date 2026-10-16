// tests/hair_studio.test.js — Step 3.5 Character Foundation v2 & Fluffé's Hair Studio test suite.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  HAIRSTYLES, HAIR_COLORS, HAIR_TIERS, HAIR_DYE_TIERS,
  STARTER_HAIR_COLORS, hairSpriteName,
} from '../shared/hair_catalog.js';
import { ACCESSORIES } from '../shared/catalog_gear_pets.js';
import { BOX1_POOL } from '../shared/rpg_rules.js';
import { computePaperDollParts } from '../shared/accessory_attach.js';
import { defaultProfile } from '../server/profile_factory.js';
import {
  migrateRpg, hairClassicBuy, hairGachaPull, hairDyeUnlock, hairEquip,
} from '../server/rpg_service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

test('Step 3.5 Catalog Integrity: 20 Hairstyles (12 Classic + 6 Royal + 2 Celestial) & 60 Sprites', () => {
  const allHairs = Object.entries(HAIRSTYLES);
  assert.equal(allHairs.length, 20, 'Should have exactly 20 hairstyles');

  const classic = allHairs.filter(([, h]) => h.tier === 'classic');
  const royal = allHairs.filter(([, h]) => h.tier === 'royal');
  const celestial = allHairs.filter(([, h]) => h.tier === 'celestial');

  assert.equal(classic.length, 12, 'Should have 12 Classic hairstyles');
  assert.equal(royal.length, 6, 'Should have 6 Royal hairstyles');
  assert.equal(celestial.length, 2, 'Should have 2 Celestial hairstyles');

  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'client/assets/asset_manifest.json'), 'utf8'));

  for (const [id, h] of allHairs) {
    assert.ok(h.attach && Array.isArray(h.attach.offset), `${id} has attach.offset`);
    for (const view of ['front', 'side', 'back']) {
      const spr = hairSpriteName(id, view);
      assert.ok(manifest.sprites[spr], `Sprite ${spr} is in asset_manifest.json`);
      const fileOnDisk = path.join(ROOT, 'client/assets/chibi', `${spr}.png`);
      assert.ok(fs.existsSync(fileOnDisk), `Sprite file ${spr}.png exists on disk`);
    }
  }
});

test('Step 3.5 Dye Closet Integrity: 20 Dyes (4 Starter + 8 Basic + 6 Ombre + 2 Celestial)', () => {
  const allColors = Object.values(HAIR_COLORS);
  assert.equal(allColors.length, 20, 'Should have 20 hair dye colours');

  const starter = allColors.filter((c) => c.tier === 'starter');
  const basic = allColors.filter((c) => c.tier === 'basic');
  const ombre = allColors.filter((c) => c.tier === 'ombre');
  const celestial = allColors.filter((c) => c.tier === 'celestial');

  assert.equal(starter.length, 4, '4 free starter colours');
  assert.equal(basic.length, 8, '8 Basic Salon colours (500 Gold)');
  assert.equal(ombre.length, 6, '6 Two-Tone Ombre colours (50 Diamonds)');
  assert.equal(celestial.length, 2, '2 Celestial Prismatic colours (bundled)');

  assert.equal(HAIRSTYLES.hair_celestial_seraph.defaultColor, 'celestial_astral');
  assert.equal(HAIRSTYLES.hair_celestial_empress.defaultColor, 'celestial_solarlunar');
});

test('Step 3.5 Starter Ears & Tails: in ACCESSORIES with starterCosmetic and excluded from Gacha pool', () => {
  const flatBox1 = Object.values(BOX1_POOL).flat();
  for (const id of ['hat_wolf_ears', 'hat_dragon_horns', 'back_wolf_tail', 'back_dragon_tail']) {
    assert.ok(ACCESSORIES[id], `${id} exists in ACCESSORIES`);
    assert.equal(ACCESSORIES[id].starterCosmetic, true, `${id} marked starterCosmetic`);
    const inPool = flatBox1.some((entry) => entry === id || entry?.id === id);
    assert.equal(inPool, false, `${id} must not dilute BOX1_POOL`);
  }
});

test('Step 3.5 Profile Factory & Legacy v1 Migration', () => {
  const boyProf = defaultProfile({ id: 'u1', username: 'taro', passHash: 'x', lineage: 'bkk' });
  assert.equal(boyProf.appearance.body, 'boy');
  assert.equal(boyProf.appearance.hair, 'hair_boy_fluffy');
  assert.ok(boyProf.owned_hairs.includes('hair_boy_fluffy'));
  assert.ok(boyProf.owned_hairs.includes('hair_girl_waves'));
  for (const c of Object.keys(STARTER_HAIR_COLORS)) {
    assert.ok(boyProf.unlocked_hair_colors.includes(c), `Starter colour ${c} unlocked`);
  }
  assert.ok(boyProf.inventory.hat_wolf_ears, 'Starter boy receives hat_wolf_ears in inventory');
  assert.ok(boyProf.inventory.back_wolf_tail, 'Starter boy receives back_wolf_tail in inventory');
  assert.deepEqual(boyProf.hair_pity, { royal: 0, celestial: 0 });

  // Legacy v1 profile migration test
  const legacyGirl = {
    id: 'u2',
    username: 'sakura',
    lineage: 'dxb',
    gold: 5000,
    diamonds: 200,
    inventory: { dxb_starter: { count: 1, refine: 0, dupes: 0 } },
    equipped: { outfit: { id: 'dxb_starter', refine: 0 } },
  };
  migrateRpg(legacyGirl);
  assert.equal(legacyGirl.appearance.body, 'girl');
  assert.equal(legacyGirl.appearance.hair, 'hair_girl_waves');
  assert.equal(legacyGirl.appearance.hairColor, 'coral');
  assert.ok(legacyGirl.unlocked_hair_colors.includes('coral'));
  assert.ok(legacyGirl.inventory.hat_dragon_horns, 'Legacy dxb receives hat_dragon_horns');
  assert.ok(legacyGirl.inventory.back_dragon_tail, 'Legacy dxb receives back_dragon_tail');
  assert.equal(legacyGirl.equipped.hat.id, 'hat_dragon_horns', 'Legacy dxb auto-equips hat_dragon_horns');
  assert.equal(legacyGirl.equipped.wings.id, 'back_dragon_tail', 'Legacy dxb auto-equips back_dragon_tail');
});

test('Step 3.5 Classic Hair Buy, Dye Unlock, and 0-Cost Free Switching', () => {
  const p = defaultProfile({ id: 'u3', username: 'mika', passHash: 'x', lineage: 'dxb' });
  p.gold = 10000;
  p.diamonds = 200;

  // 1. Buy Classic hairstyle (3,000 Gold)
  const buyRes = hairClassicBuy(p, { hairId: 'hair_hime_straight' });
  assert.equal(buyRes.ok, true);
  assert.equal(p.gold, 7000);
  assert.ok(p.owned_hairs.includes('hair_hime_straight'));
  assert.equal(p.appearance.hair, 'hair_hime_straight');

  // Duplicate buy rejected
  const dupRes = hairClassicBuy(p, { hairId: 'hair_hime_straight' });
  assert.equal(dupRes.ok, false);
  assert.equal(dupRes.error, 'already_owned');

  // Royal hair rejected from Classic buy
  const royalRes = hairClassicBuy(p, { hairId: 'hair_royal_drill_ribbons' });
  assert.equal(royalRes.ok, false);
  assert.equal(royalRes.error, 'bad_hair');

  // 2. Unlock Basic Dye (500 Gold) & Ombre Dye (50 Diamonds)
  const basicDyeRes = hairDyeUnlock(p, { colorId: 'lavender' });
  assert.equal(basicDyeRes.ok, true);
  assert.equal(p.gold, 6500);
  assert.ok(p.unlocked_hair_colors.includes('lavender'));
  assert.equal(p.appearance.hairColor, 'lavender');

  const ombreDyeRes = hairDyeUnlock(p, { colorId: 'ombre_aurora' });
  assert.equal(ombreDyeRes.ok, true);
  assert.equal(p.diamonds, 150);
  assert.ok(p.unlocked_hair_colors.includes('ombre_aurora'));
  assert.equal(p.appearance.hairColor, 'ombre_aurora');

  // Celestial dye cannot be bought directly
  const celDyeRes = hairDyeUnlock(p, { colorId: 'celestial_astral' });
  assert.equal(celDyeRes.ok, false);
  assert.equal(celDyeRes.error, 'celestial_bundled_only');

  // 3. Free 0-cost switching in Closet
  const goldBefore = p.gold;
  const diaBefore = p.diamonds;
  const eqRes = hairEquip(p, { hairId: 'hair_boy_fluffy', colorId: 'chestnut', body: 'boy' });
  assert.equal(eqRes.ok, true);
  assert.equal(p.gold, goldBefore, 'Switching owned hair/dye/body costs 0 Gold');
  assert.equal(p.diamonds, diaBefore, 'Switching owned hair/dye/body costs 0 Diamonds');
  assert.equal(p.appearance.hair, 'hair_boy_fluffy');
  assert.equal(p.appearance.hairColor, 'chestnut');
  assert.equal(p.appearance.body, 'boy');
});

test('Step 3.5 Royal & Celestial Hair Gacha: Coupons, 10-Pull Pity, 150-Pull Celestial Pity + Bundled Dye', () => {
  const p = defaultProfile({ id: 'u4', username: 'sora', passHash: 'x', lineage: 'bkk' });
  p.diamonds = 5000;
  p.bag_items.ticket_royal_hair = 1;

  // 1. Pull with Royal Hair Coupon
  const tRes = hairGachaPull(p, { count: 1, currency: 'ticket' });
  assert.equal(tRes.ok, true);
  assert.equal(p.bag_items.ticket_royal_hair, 0);
  assert.equal(p.diamonds, 5000, 'Ticket pull does not spend diamonds');

  // 2. 10x Pull guarantees Royal or Celestial hairstyles
  const tenRes = hairGachaPull(p, { count: 10, currency: 'diamonds' });
  assert.equal(tenRes.ok, true);
  assert.equal(p.diamonds, 5000 - HAIR_TIERS.royal.price.diamonds * 10);
  assert.equal(tenRes.items.length, 10);
  const hasHighTier = tenRes.items.some((r) => r.tier === 'royal' || r.tier === 'celestial');
  assert.equal(hasHighTier, true, '10x pull must guarantee Royal or Celestial hairstyle');

  // 3. 150-pull Celestial Hard Pity + automatic bundled Prismatic Dye unlock
  p.hair_pity.celestial = HAIR_TIERS.celestial.pity - 1; // 149
  const celRes = hairGachaPull(p, { count: 1, currency: 'diamonds' });
  assert.equal(celRes.ok, true);
  const pulled = celRes.items[0];
  assert.equal(pulled.tier, 'celestial', '150th pull must hit Celestial hard pity');
  assert.equal(p.hair_pity.celestial, 0, 'Celestial pity resets to 0');
  const expectedDye = HAIRSTYLES[pulled.id].defaultColor;
  assert.ok(p.unlocked_hair_colors.includes(expectedDye), `Bundled Celestial dye ${expectedDye} unlocked automatically`);
});

test('Step 3.5 Paper-Doll 2D Solver: computes hair layer and hip-socket tail', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'client/assets/asset_manifest.json'), 'utf8'));
  const getSpriteInfo = (name) => manifest.sprites[name] || null;

  const pd = computePaperDollParts({
    lineage: 'bkk',
    equipped: {
      outfit: { id: 'bkk_starter' },
      hat: { id: 'hat_wolf_ears' },
      wings: { id: 'back_wolf_tail' },
    },
    hair: 'hair_celestial_seraph',
    hairColor: 'celestial_astral',
    view: 'side',
    right: true,
    getSpriteInfo,
  });

  assert.ok(pd.hair, 'Paper-doll solver returns hair layer');
  assert.equal(pd.hair.url, '/assets/chibi/hair_celestial_seraph_side.png');
  assert.ok(pd.wings, 'Paper-doll solver returns tail/wings layer');
  assert.equal(pd.wings.socket, 'hip', 'Wolf tail uses hip socket');
});
