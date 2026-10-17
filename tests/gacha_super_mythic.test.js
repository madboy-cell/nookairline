// tests/gacha_super_mythic.test.js — Dopamine Patch 1A/1C: ✦ Super Mythic tier, pity, rates (1e6 sims), Gift a Pull.
// Run: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { seedProfiles, migrateProfile } from '../server/profile_factory.js';
import * as rpg from '../server/rpg_service.js';
import {
  BOX1, BOX1_POOL, BOX1_BANNERS, SEASON_OUTFITS, SUPER_MYTHIC, SUPER_MYTHIC_POOL, superMythicEnabled, superMythicRate,
  rollTierWithSuperMythic, rollBox1Rarities, box1DisplayRates, isSuperMythicId, GIFT_PULL,
} from '../shared/rpg_rules.js';
import { recalcPlayerCP } from '../shared/progression.js';

const NOW = 1_800_000_000_000;
const fixed = (v) => () => v;
/** Deterministic PRNG so the 1e6-sim tolerances never flake. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const fresh = (id = 'nook') => {
  const p = seedProfiles().find((x) => x.id === id);
  migrateProfile(p, NOW); rpg.migrateRpg(p); p.cp = recalcPlayerCP(p);
  return p;
};
const SM_ON = superMythicEnabled();

test('super mythic: displayed rates renormalise to exactly 100 %', () => {
  const r = box1DisplayRates(BOX1.RATES, true);
  assert.equal(r.super_mythic, 0.005);
  assert.ok(Math.abs(r.super_mythic + r[3] + r[2] + r[1] - 1) < 1e-12);
  assert.ok(Math.abs(r[3] - 0.03 * 0.995) < 1e-12);
  assert.ok(Math.abs(r[2] - 0.17 * 0.995) < 1e-12);
  assert.ok(Math.abs(r[1] - 0.80 * 0.995) < 1e-12);
  const off = box1DisplayRates(BOX1.RATES, false);
  assert.equal(off.super_mythic, 0); assert.ok(Math.abs(off[3] + off[2] + off[1] - 1) < 1e-12);
});

test('super mythic: soft pity curve 0.5 % → +6 %/pull from #75 → 100 % at #90', () => {
  for (let n = 1; n <= 74; n++) assert.equal(superMythicRate(n), 0.005);
  assert.ok(Math.abs(superMythicRate(75) - 0.065) < 1e-12);
  assert.ok(Math.abs(superMythicRate(80) - 0.365) < 1e-12);
  assert.ok(Math.abs(superMythicRate(89) - 0.905) < 1e-12);
  assert.equal(superMythicRate(90), 1);
  assert.equal(superMythicRate(120), 1);
});

test('super mythic: hard pity guarantees pull #90 even with the luckiest-low rng', () => {
  let smPity = 0, pity = 0, hitAt = 0;
  for (let i = 1; i <= 90 && !hitAt; i++) {
    const r = rollBox1Rarities({ count: 1, pity, smPity, superMythic: true }, fixed(0));
    pity = r.pity; smPity = r.smPity;
    if (r.rarities[0] === SUPER_MYTHIC.RARITY) { hitAt = i; assert.equal(r.smPityHit, true); }
  }
  assert.equal(hitAt, 90);
  assert.equal(smPity, 0);
});

test('super mythic: soft pity kicks in at #75 (u = 0.95 misses at #74, hits at #75)', () => {
  assert.equal(rollTierWithSuperMythic(0.95, BOX1.RATES, 74), 1);
  assert.equal(rollTierWithSuperMythic(0.95, BOX1.RATES, 75), SUPER_MYTHIC.RARITY);
  const r = rollBox1Rarities({ count: 1, smPity: 74, superMythic: true }, fixed(0.95));
  assert.deepEqual(r.rarities, [SUPER_MYTHIC.RARITY]); assert.equal(r.smPity, 0); assert.equal(r.smPityHit, false);
  // disabled tier = old behaviour bit-for-bit, pity counter untouched
  const off = rollBox1Rarities({ count: 1, smPity: 89, superMythic: false }, fixed(0.999));
  assert.deepEqual(off.rarities, [1]); assert.equal(off.smPity, 89);
});

test('super mythic: also resets the 40-pull Mythic pity; 10x keeps the Epic+ guarantee', () => {
  const r = rollBox1Rarities({ count: 1, pity: 39, smPity: 89, superMythic: true }, fixed(0.5));
  assert.deepEqual(r.rarities, [SUPER_MYTHIC.RARITY]); assert.equal(r.pity, 0); assert.equal(r.pityHit, false);
  const ten = rollBox1Rarities({ count: 10, superMythic: true }, fixed(0.9));
  assert.equal(ten.rarities[9], BOX1.TEN_PULL_MIN_RARITY);
});

test('super mythic: 1e6 base-rate sims match 0.5 % / 2.985 % / 16.915 % / 79.6 % within tolerance', () => {
  const rng = mulberry32(0xC0FFEE);
  const N = 1_000_000;
  const c = { 4: 0, 3: 0, 2: 0, 1: 0 };
  for (let i = 0; i < N; i++) c[rollTierWithSuperMythic(rng(), BOX1.RATES, 1)]++;
  const exp = box1DisplayRates(BOX1.RATES, true);
  const tol = (p) => 5 * Math.sqrt((p * (1 - p)) / N); // 5σ
  assert.ok(Math.abs(c[4] / N - exp.super_mythic) < tol(exp.super_mythic), `SM ${c[4] / N}`);
  for (const k of [3, 2, 1]) assert.ok(Math.abs(c[k] / N - exp[k]) < tol(exp[k]), `★${k} ${c[k] / N} vs ${exp[k]}`);
});

test('super mythic: 1e6 sims with full pity → never > 90 apart, consolidated rate = analytic', () => {
  // analytic expected pulls per Super Mythic
  let survive = 1, expPulls = 0;
  for (let n = 1; n <= SUPER_MYTHIC.HARD_PITY; n++) { const q = superMythicRate(n); expPulls += n * survive * q; survive *= 1 - q; }
  assert.ok(survive < 1e-12);
  const rng = mulberry32(42);
  const N = 1_000_000;
  let smPity = 0, pity = 0, hits = 0, gap = 0, maxGap = 0, mythicGap = 0, maxMythicGap = 0;
  for (let i = 0; i < N; i++) {
    const r = rollBox1Rarities({ count: 1, pity, smPity, superMythic: true }, rng);
    pity = r.pity; smPity = r.smPity; gap++; mythicGap++;
    const t = r.rarities[0];
    if (t >= 3) { maxMythicGap = Math.max(maxMythicGap, mythicGap); mythicGap = 0; }
    if (t === SUPER_MYTHIC.RARITY) { hits++; maxGap = Math.max(maxGap, gap); gap = 0; }
  }
  assert.ok(maxGap <= SUPER_MYTHIC.HARD_PITY, `max gap ${maxGap}`);
  assert.ok(maxMythicGap <= BOX1.PITY, `max Mythic gap ${maxMythicGap}`);
  const observed = hits / N, expected = 1 / expPulls;
  assert.ok(Math.abs(observed - expected) / expected < 0.03, `observed ${observed} vs analytic ${expected}`);
});

test('super mythic: never dilutes the ★1–★3 pools or the Season-outfit wish list', () => {
  for (const id of SUPER_MYTHIC.IDS) {
    assert.equal(isSuperMythicId(id), true);
    assert.equal(Object.values(BOX1_POOL).flat().includes(id), false);
    assert.equal(SEASON_OUTFITS.includes(id), false);
    for (const b of Object.values(BOX1_BANNERS)) assert.equal(Object.values(b.pool).flat().includes(id), false);
  }
  assert.equal(BOX1_BANNERS.season.superMythic, true);
  assert.ok(!BOX1_BANNERS.relics.superMythic && !BOX1_BANNERS.dice.superMythic && !BOX1_BANNERS.pets.superMythic);
});

test('gacha_pull season banner: sm_pity persists per player; pull #90 debuts a Super Mythic (or tier gated off)', () => {
  const p = fresh('nook');
  assert.equal(p.gacha.sm_pity, 0);
  const a = rpg.gachaPull(p, { box: 1, count: 1, currency: 'diamonds' }, fixed(0.5));
  assert.equal(a.ok, true); assert.equal(a.smPityMax, 90);
  if (!SM_ON) {
    assert.equal(a.superMythicOn, false); assert.equal(p.gacha.sm_pity, 0);
    return;
  }
  assert.equal(a.superMythicOn, true); assert.equal(p.gacha.sm_pity, 1); assert.equal(a.smPity, 1);
  // other banners never touch it
  rpg.gachaPull(p, { box: 1, count: 1, currency: 'diamonds', banner: 'relics' }, fixed(0.5));
  assert.equal(p.gacha.sm_pity, 1);
  p.gacha.sm_pity = 89;
  const b = rpg.gachaPull(p, { box: 1, count: 1, currency: 'diamonds' }, fixed(0.0));
  assert.equal(b.smHit, true); assert.equal(b.smPityHit, true); assert.equal(p.gacha.sm_pity, 0);
  assert.equal(b.items[0].rarity, SUPER_MYTHIC.RARITY); assert.equal(b.items[0].rarityKey, 'super_mythic');
  assert.ok(SUPER_MYTHIC_POOL.includes(b.items[0].id)); assert.ok(p.inventory[b.items[0].id]);
});

test('gift a pull: bound-partner only, sender pays, recipient rolls on open with their own pity', () => {
  const nook = fresh('nook'), neen = fresh('neen'), mochi = fresh('mochi');
  assert.equal(rpg.gachaGiftSend(nook, mochi, { count: 1, currency: 'diamonds' }, NOW).error, 'not_partner');
  assert.equal(rpg.gachaGiftSend(nook, nook, { count: 1, currency: 'diamonds' }, NOW).error, 'not_partner');
  assert.equal(rpg.gachaGiftSend(nook, neen, { count: 3, currency: 'diamonds' }, NOW).error, 'bad_count');
  assert.equal(rpg.gachaGiftSend(nook, neen, { count: 1, currency: 'gold' }, NOW).error, 'bad_currency');
  const d0 = nook.diamonds, n0 = neen.diamonds;
  const s = rpg.gachaGiftSend(nook, neen, { count: 10, currency: 'diamonds', message: ' <b>love you</b> ' + 'x'.repeat(99) }, NOW);
  assert.equal(s.ok, true);
  assert.equal(nook.diamonds, d0 - BOX1.COST_10); assert.equal(neen.diamonds, n0);
  assert.equal(neen.gacha.gifts_pending.length, 1);
  assert.ok(!s.gift.message.includes('<')); assert.ok(s.gift.message.length <= GIFT_PULL.MAX_MESSAGE);
  const t0 = nook.bag_items.ticket_standard;
  assert.equal(rpg.gachaGiftSend(nook, neen, { count: 1, currency: 'ticket' }, NOW + 1).ok, true);
  assert.equal(nook.bag_items.ticket_standard, t0 - 1);
  nook.diamonds = 0;
  assert.equal(rpg.gachaGiftSend(nook, neen, { count: 1, currency: 'diamonds' }, NOW + 2).error, 'not_enough_diamonds');

  const pity0 = neen.gacha.box1_pity;
  const o = rpg.gachaGiftOpen(neen, nook, { giftId: s.gift.id }, fixed(0.5));
  assert.equal(o.ok, true); assert.equal(o.items.length, 10); assert.equal(o.gift.from, 'nook');
  assert.equal(neen.gacha.gifts_pending.length, 1);
  assert.equal(neen.gacha.box1_pity, pity0 + 10); assert.equal(nook.gacha.box1_pity | 0, fresh('nook').gacha.box1_pity | 0);
  assert.equal(rpg.gachaGiftOpen(neen, nook, { giftId: s.gift.id }).error, 'no_gift');
});

test('gift a pull: a gifted Super Mythic awards the sender the 🍀 lucky_charm badge (once)', { skip: !SM_ON && 'Super Mythic outfits not in costumes_catalog yet' }, () => {
  const nook = fresh('nook'), neen = fresh('neen');
  const g1 = rpg.gachaGiftSend(nook, neen, { count: 1, currency: 'diamonds' }, NOW).gift;
  neen.gacha.sm_pity = 89;
  const o = rpg.gachaGiftOpen(neen, nook, { giftId: g1.id }, fixed(0.0));
  assert.equal(o.smHit, true); assert.equal(o.luckyCharm, true);
  assert.deepEqual(nook.badges, ['lucky_charm']);
  const g2 = rpg.gachaGiftSend(nook, neen, { count: 1, currency: 'diamonds' }, NOW + 5).gift;
  neen.gacha.sm_pity = 89;
  const o2 = rpg.gachaGiftOpen(neen, nook, { giftId: g2.id }, fixed(0.0));
  assert.equal(o2.luckyCharm, false); assert.deepEqual(nook.badges, ['lucky_charm']);
});

test('grand royal opera runway: 8 painted sprites sliced cleanly & zero second WebGL context', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const root = process.cwd();
  const expectedSprites = [
    'gacha_loom_pedestal',
    'gacha_chandelier_arch',
    'gacha_curtain_wing',
    'gacha_vip_crowd',
    'gacha_trunk_rare',
    'gacha_trunk_epic',
    'gacha_trunk_mythic',
    'gacha_trunk_super',
  ];
  const manifest4a = JSON.parse(fs.readFileSync(path.join(root, 'client/assets/monopoly/manifest_4a.json'), 'utf8'));
  for (const name of expectedSprites) {
    assert.ok(manifest4a.sprites[name], `manifest_4a missing ${name}`);
    assert.ok(fs.existsSync(path.join(root, 'client/assets/monopoly', `${name}.png`)), `missing PNG ${name}`);
  }
  const src = fs.readFileSync(path.join(root, 'client/js/runway_reveal.js'), 'utf8');
  assert.equal(src.includes('new THREE.WebGLRenderer'), false, 'must not allocate a second WebGLRenderer');
  for (const fn of ['SM_TIER', 'tierOf', 'rackOrder', 'fakeOutFor', 'flashCount', 'ensureRunwayCss', 'RunwayReveal', 'playRunwayForResult', 'openPartnerGift', 'sendPartnerGift', 'installRunwayNet']) {
    assert.ok(src.includes(fn), `missing export ${fn}`);
  }
});

