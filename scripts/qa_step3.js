#!/usr/bin/env node
// scripts/qa_step3.js — Step 3 automated 2-agent QA gate for NEORA WORLD V2
// (Roadmap: "Both agents pull Box 1 & 2, exchange Shards, mix & match 6 slots, forge +10 & hatch Couple Pet Egg!")
//   Part A: WebSocket agents nook + beam against an isolated server (temp DB, seeded RNG).
//   Part B: Real Chrome session: Wardrobe, Bag, Pets, Forge, Gacha Box 1/2, Shard Shop,
//           10x summon animations, and dev dress-up calibration. Screenshots -> qa_artifacts/step3/.
// Usage: npm run qa:step3   |   node scripts/qa_step3.js --no-browser
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';
import { startServer } from '../server/server.js';
import { recalcPlayerCP } from '../shared/progression.js';
import { FORGE, forgeReady } from '../shared/rpg_rules.js';
import { PETS } from '../shared/catalog_gear_pets.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = path.join(ROOT, 'qa_artifacts', 'step3');
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const results = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function check(name, cond, detail = '') {
  results.push({ name, ok: !!cond, detail });
  console.log(`${cond ? '  ✅' : '  ❌'} ${name}${detail ? `  — ${detail}` : ''}`);
}

function seeded(seed = 42) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function http(base, p, body) {
  const res = await fetch(base + p, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

function agent(port, token) {
  const ws = new WebSocket(`ws://localhost:${port}/ws`);
  const inbox = [], waiters = [], used = new Set();
  let req = 0;
  ws.on('message', (raw) => {
    const m = JSON.parse(raw);
    if (m.type === 'ping') ws.send(JSON.stringify({ type: 'pong', t: m.t }));
    inbox.push(m);
    for (const w of [...waiters]) if (!used.has(m) && w.pred(m)) { used.add(m); waiters.splice(waiters.indexOf(w), 1); w.resolve(m); }
  });
  ws.on('open', () => ws.send(JSON.stringify({ type: 'auth', token })));
  const a = {
    inbox, send: (m) => ws.send(JSON.stringify(m)),
    wait: (pred, ms = 4000) => new Promise((resolve, reject) => {
      const hit = inbox.find((m) => !used.has(m) && pred(m));
      if (hit) { used.add(hit); resolve(hit); return; }
      const w = { pred, resolve }; waiters.push(w);
      setTimeout(() => { const i = waiters.indexOf(w); if (i >= 0) { waiters.splice(i, 1); reject(new Error(`timeout waiting: ${pred.toString().slice(0, 90)}`)); } }, ms);
    }),
    async act(type, payload = {}) {
      await sleep(300);                                  // server action cooldown is 250 ms
      const reqId = ++req;
      const p = a.wait((m) => m.type === 'action_result' && m.reqId === reqId);
      a.send({ type, reqId, ...payload });
      return p;
    },
    profile: () => [...inbox].reverse().find((m) => m.type === 'profile_update' || m.type === 'auth_ok')?.profile,
    close: () => ws.close(),
  };
  return a;
}

async function partA() {
  console.log('\n— Part A: two WebSocket agents (nook 💞 beam) —');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'neora-qa3-'));
  const srv = await startServer({ port: 0, dataFile: path.join(tmp, 'db.json'), quiet: true, rng: seeded(42) });
  const base = `http://localhost:${srv.port}`;
  try {
    const tn = (await http(base, '/api/auth/login', { username: 'nook', password: '1234' })).data.token;
    const tb = (await http(base, '/api/auth/login', { username: 'beam', password: '1234' })).data.token;
    const N = agent(srv.port, tn), B = agent(srv.port, tb);
    const okN = await N.wait((m) => m.type === 'auth_ok');
    const okB = await B.wait((m) => m.type === 'auth_ok');

    // 1. Seed CP: both nook and beam cp === 15420 at login
    check('1. Seed CP: both nook and beam cp === 15420 at login',
      okN.profile.cp === 15420 && okB.profile.cp === 15420,
      `nook=${okN.profile.cp}, beam=${okB.profile.cp}`);

    // 2. Box 1: nook 1x diamonds pull (diamonds -150, pity +1 or reset on Mythic)
    const d0 = N.profile().diamonds;
    const p0 = N.profile().gacha?.box1_pity | 0;
    const pull1 = await N.act('gacha_pull', { box: 1, count: 1, currency: 'diamonds' });
    const pity1Expected = pull1.items?.[0]?.rarity === 3 ? 0 : p0 + 1;
    check('2. Box 1: nook 1x diamonds pull (diamonds -150, pity +1 or reset on Mythic)',
      pull1.ok && N.profile().diamonds === d0 - 150 && pull1.pity === pity1Expected,
      `diamonds ${d0} -> ${N.profile().diamonds}, pity ${p0} -> ${pull1.pity}, rarity ${pull1.items?.[0]?.rarity}`);

    // 2. Box 1: 10x pull (-1350, 10 items, at least one rarity >= 2)
    const d1 = N.profile().diamonds;
    const pull10 = await N.act('gacha_pull', { box: 1, count: 10, currency: 'diamonds' });
    const hasEpicOrBetter = pull10.items?.some((it) => it.rarity >= 2);
    check('2. Box 1: nook 10x diamonds pull (-1350, 10 items, at least one rarity >= 2)',
      pull10.ok && N.profile().diamonds === d1 - 1350 && pull10.items?.length === 10 && hasEpicOrBetter,
      `diamonds ${d1} -> ${N.profile().diamonds}, items=${pull10.items?.length}`);

    // 2. Box 1: ticket pull consumes ticket_standard
    const t0 = N.profile().bag_items?.ticket_standard | 0;
    const pullT = await N.act('gacha_pull', { box: 1, count: 1, currency: 'ticket' });
    check('2. Box 1: ticket pull consumes ticket_standard',
      pullT.ok && N.profile().bag_items?.ticket_standard === t0 - 1,
      `ticket_standard ${t0} -> ${N.profile().bag_items?.ticket_standard}`);

    // 2. Box 1: beam does a 10x too
    const bd0 = B.profile().diamonds;
    const bPull10 = await B.act('gacha_pull', { box: 1, count: 10, currency: 'diamonds' });
    const bHasEpic = bPull10.items?.some((it) => it.rarity >= 2);
    check('2. Box 1: beam does a 10x diamonds pull too (-1350, 10 items, at least one rarity >= 2)',
      bPull10.ok && B.profile().diamonds === bd0 - 1350 && bPull10.items?.length === 10 && bHasEpic,
      `diamonds ${bd0} -> ${B.profile().diamonds}, items=${bPull10.items?.length}`);

    // 2. Box 1: nook pulls 'relics' banner once (assert reply.banner === 'relics')
    const pullRelics = await N.act('gacha_pull', { box: 1, count: 1, currency: 'diamonds', banner: 'relics' });
    check("2. Box 1: nook pulls 'relics' banner (assert reply.banner === 'relics')",
      pullRelics.ok && pullRelics.banner === 'relics' && pullRelics.items?.length === 1,
      `banner=${pullRelics.banner}, item=${pullRelics.items?.[0]?.id}`);

    // 2. Box 1: nook pulls 'pets' banner once (assert reply.banner === 'pets', pet: true, valid PETS id)
    const pullPets = await N.act('gacha_pull', { box: 1, count: 1, currency: 'diamonds', banner: 'pets' });
    const pDrop = pullPets.items?.[0];
    const isPetDropValid = pDrop?.pet === true && Boolean(PETS[pDrop.id]);
    check("2. Box 1: nook pulls 'pets' banner (assert reply.banner === 'pets', pet: true, valid PETS id)",
      pullPets.ok && pullPets.banner === 'pets' && isPetDropValid,
      `banner=${pullPets.banner}, pet=${pDrop?.id}, kind=${pDrop?.kind}`);

    // 3. Box 2: berries with count 1 returns error 'berries_10x_only'
    const errBerries = await B.act('gacha_pull', { box: 2, count: 1, currency: 'berries' });
    check("3. Box 2: 'berries' with count 1 returns error 'berries_10x_only'",
      !errBerries.ok && errBerries.error === 'berries_10x_only');

    // 3. Box 2: beam 1x gold (-1000)
    const bg0 = B.profile().gold;
    const b2_1 = await B.act('gacha_pull', { box: 2, count: 1, currency: 'gold' });
    check('3. Box 2: beam 1x gold (-1000)',
      b2_1.ok && B.profile().gold === bg0 - 1000 && b2_1.items?.length === 1,
      `gold ${bg0} -> ${B.profile().gold}`);

    // 3. Box 2: 10x gold (-9000)
    const bg1 = B.profile().gold;
    const b2_10 = await B.act('gacha_pull', { box: 2, count: 10, currency: 'gold' });
    check('3. Box 2: beam 10x gold (-9000)',
      b2_10.ok && B.profile().gold === bg1 - 9000 && b2_10.items?.length === 10,
      `gold ${bg1} -> ${B.profile().gold}`);

    // 3. Box 2: 10x berries (-300 🍓)
    const bb0 = B.profile().berries;
    const b2_berries = await B.act('gacha_pull', { box: 2, count: 10, currency: 'berries' });
    check('3. Box 2: beam 10x berries (-300 🍓)',
      b2_berries.ok && B.profile().berries === bb0 - 300 && b2_berries.items?.length === 10,
      `berries ${bb0} -> ${B.profile().berries}`);

    // 3. Box 2: Items have kinds blueprint/decor/new/star_up/shards
    const allBox2Items = [...(b2_1.items || []), ...(b2_10.items || []), ...(b2_berries.items || [])];
    const allowedKinds = new Set(['blueprint', 'decor', 'new', 'star_up', 'shards']);
    const kindsFound = new Set(allBox2Items.map((it) => it.kind));
    const kindsValid = allBox2Items.length > 0 && allBox2Items.every((it) => allowedKinds.has(it.kind));
    check('3. Box 2: Items have kinds blueprint/decor/new/star_up/shards',
      kindsValid,
      `kinds observed: ${[...kindsFound].join(', ')}`);

    // 4. Shard shop: bad pick returns 'bad_pick'
    const badPick = await N.act('shard_exchange', { offerId: 'accessory_dupe_box', pickId: 'not_an_accessory' });
    check("4. Shard shop: bad pick returns 'bad_pick'",
      !badPick.ok && badPick.error === 'bad_pick');

    // 4. Shard shop: nook buys accessory_dupe_box with pickId 'hat_straw_explorer' (shards -80)
    const ns0 = N.profile().shards;
    const buyRes = await N.act('shard_exchange', { offerId: 'accessory_dupe_box', pickId: 'hat_straw_explorer' });
    check("4. Shard shop: nook buys accessory_dupe_box with pickId 'hat_straw_explorer' (shards -80)",
      buyRes.ok && N.profile().shards === ns0 - 80 && N.profile().inventory?.hat_straw_explorer !== undefined,
      `shards ${ns0} -> ${N.profile().shards}`);

    // 4. Shard shop: buying with too few shards returns 'not_enough_shards'
    while (N.profile().shards >= 400) {
      await N.act('shard_exchange', { offerId: 'accessory_dupe_box', pickId: 'hat_straw_explorer' });
    }
    const notEnough = await N.act('shard_exchange', { offerId: 'mythic_outfit', pickId: 's1_naga_sovereign' });
    check("4. Shard shop: buying with too few shards returns 'not_enough_shards'",
      !notEnough.ok && notEnough.error === 'not_enough_shards',
      `shards=${N.profile().shards}, needed=400`);

    // 5. Wardrobe: beam mixes all 6 slots — equip an owned outfit + 5 accessories she owns
    const mixSlots = [
      { slot: 'outfit', itemId: 's2_kitsune_inari' },
      { slot: 'hat', itemId: 'hat_cat_headset' },
      { slot: 'face', itemId: 'face_rosegold_shades' },
      { slot: 'gloves', itemId: 'gloves_starlight_wand' },
      { slot: 'boots', itemId: 'boots_hermes_greaves' },
      { slot: 'wings', itemId: 'wings_golden_seraphim' },
    ];
    let allEquipOk = true;
    for (const { slot, itemId } of mixSlots) {
      const res = await B.act('wardrobe_equip', { slot, itemId });
      if (!res.ok) allEquipOk = false;
    }
    const bProf = B.profile();
    const eqMatches = mixSlots.every(({ slot, itemId }) => bProf.equipped?.[slot]?.id === itemId);
    const cpMatches = bProf.cp === recalcPlayerCP(bProf);
    check('5. Wardrobe: beam mixes all 6 slots, profile.equipped matches and profile.cp equals server recalcPlayerCP',
      allEquipOk && eqMatches && cpMatches,
      `cp=${bProf.cp}, computed=${recalcPlayerCP(bProf)}`);

    // 5. Wardrobe: Toggle face hide true -> cp unchanged -> nook's socket receives player_equipped for beam
    const cpBeforeHide = B.profile().cp;
    const eqPromise = N.wait((m) => m.type === 'player_equipped' && m.id === 'beam' && m.equipped?.face?.hide === true);
    const hideRes = await B.act('wardrobe_equip', { slot: 'face', hide: true });
    const bcast = await eqPromise;
    check("5. Wardrobe: Toggle face hide true -> cp unchanged -> nook's socket receives player_equipped for beam",
      hideRes.ok && B.profile().equipped?.face?.hide === true && B.profile().cp === cpBeforeHide && bcast?.equipped?.face?.hide === true && bcast?.cp === cpBeforeHide,
      `cp=${B.profile().cp}, bcast.cp=${bcast?.cp}`);

    // 5. Wardrobe: wrong slot -> 'wrong_slot'
    const wrongSlot = await B.act('wardrobe_equip', { slot: 'hat', itemId: 'gloves_starlight_wand' });
    check("5. Wardrobe: wrong slot -> 'wrong_slot'", !wrongSlot.ok && wrongSlot.error === 'wrong_slot');

    // 5. Wardrobe: not owned -> 'not_owned' (s1_naga_sovereign is not in any gacha pool, so beam can't have pulled it)
    const notOwned = await B.act('wardrobe_equip', { slot: 'outfit', itemId: 's1_naga_sovereign' });
    check("5. Wardrobe: not owned -> 'not_owned'", !notOwned.ok && notOwned.error === 'not_owned');

    // 6. Forge: useScroll on refine < 4 returns 'scroll_not_allowed'
    const scrollLow = await N.act('blacksmith_forge', { itemId: 'newbie_outfit', useScroll: true });
    check("6. Forge: useScroll on refine < 4 returns 'scroll_not_allowed'",
      !scrollLow.ok && scrollLow.error === 'scroll_not_allowed');

    // 6. Forge: nook forges face_rosegold_shades (+8, dupes 0) -> expect 'not_enough_dupes'
    const errDupes = await N.act('blacksmith_forge', { itemId: 'face_rosegold_shades', useBerries: false });
    check("6. Forge: nook forges face_rosegold_shades (+8, dupes 0) -> expect 'not_enough_dupes'",
      !errDupes.ok && errDupes.error === 'not_enough_dupes');

    // 6. Forge: nook forges an item from +0 with useBerries true until +4 or several attempts
    let elsaRefine = N.profile().inventory?.s8_glacial_elsa?.refine | 0;
    let elsaPity = N.profile().inventory?.s8_glacial_elsa?.pity | 0;
    let elsaAttempts = 0;
    let refineNeverDecreased = true;
    let pityValidOnFail = true;
    let costsExact = true;

    while (elsaRefine < 4 && elsaAttempts < 8) {
      elsaAttempts++;
      const target = elsaRefine + 1;
      const gBefore = N.profile().gold;
      const bBefore = N.profile().berries;
      const pBefore = elsaPity;

      const fRes = await N.act('blacksmith_forge', { itemId: 's8_glacial_elsa', useBerries: true });
      if (!fRes.ok) { costsExact = false; break; }

      const expGold = FORGE.GOLD[target];
      const expBerries = FORGE.BERRY_COST; // 50
      if (N.profile().gold !== gBefore - expGold || N.profile().berries !== bBefore - expBerries) {
        costsExact = false;
      }

      if (fRes.success) {
        if (fRes.newStar < elsaRefine + 1) refineNeverDecreased = false;
        elsaRefine = fRes.newStar;
        elsaPity = fRes.pity;
      } else {
        if (fRes.newStar < elsaRefine) refineNeverDecreased = false;
        if (fRes.pity !== pBefore + 1) pityValidOnFail = false;
        elsaPity = fRes.pity;
      }
    }
    check('6. Forge: nook forges s8_glacial_elsa from +0 with useBerries true: refine never decreases, on fail pity increments, gold/berries exact',
      refineNeverDecreased && pityValidOnFail && costsExact && elsaAttempts > 0,
      `reached +${elsaRefine} after ${elsaAttempts} attempts, costs exact`);

    // 6. Forge Sovereign path: pick an item at +9 (wings_golden_seraphim +9), give dupe via shard shop, forge
    const buyDupe = await N.act('shard_exchange', { offerId: 'accessory_dupe_box', pickId: 'wings_golden_seraphim' });
    check("6. Forge: dupe granted for wings_golden_seraphim via shard_exchange accessory_dupe_box",
      buyDupe.ok && N.profile().inventory?.wings_golden_seraphim?.dupes >= 1);

    let cheerBanner = null;
    const cheerListener = B.wait((m) => m.type === 'global_cheer_banner', 3000).then((m) => { cheerBanner = m; }).catch(() => null);

    let sovSucceeded = false;
    let sovPityBefore = N.profile().inventory?.wings_golden_seraphim?.pity | 0;
    let lastSovRes = null;
    const scrollsBefore = N.profile().bag_items?.scroll_forge_boost | 0;

    while ((N.profile().inventory?.wings_golden_seraphim?.dupes | 0) > 0 && (N.profile().inventory?.wings_golden_seraphim?.refine | 0) < 10) {
      sovPityBefore = N.profile().inventory?.wings_golden_seraphim?.pity | 0;
      lastSovRes = await N.act('blacksmith_forge', { itemId: 'wings_golden_seraphim', useBerries: true, useScroll: true });
      if (!lastSovRes.ok) break;
      if (lastSovRes.success) {
        sovSucceeded = true;
        break;
      }
    }

    check("6. Forge: nook forges wings_golden_seraphim (+9) with useScroll: server consumed 1 scroll",
      lastSovRes?.spent?.scrolls === 1 && N.profile().bag_items?.scroll_forge_boost === scrollsBefore - 1,
      `spent.scrolls=${lastSovRes?.spent?.scrolls}, remaining=${N.profile().bag_items?.scroll_forge_boost}`);

    if (sovSucceeded) {
      await cheerListener;
      check("6. Forge Sovereign path (succeeded): newStar 10, title '★10 Sovereign' in profile and beam got global_cheer_banner",
        lastSovRes.newStar === 10 && N.profile().title === '★10 Sovereign' && cheerBanner !== null,
        `title=${N.profile().title}, cheer banner=${cheerBanner?.achievement}`);
    } else {
      check('6. Forge Sovereign path (failed): pity incremented and refine stayed 9',
        lastSovRes !== null && lastSovRes.pity === sovPityBefore + 2 && N.profile().inventory?.wings_golden_seraphim?.refine === 9,
        `pity=${lastSovRes?.pity}, refine=${N.profile().inventory?.wings_golden_seraphim?.refine}`);
    }

    // 7. Pets: beam feeds her capybara (Lv 20, mood 100 -> 'pet_maxed')
    const capy = B.profile().pets?.find((p) => p.id === 'pet_yuzu_capybara');
    const feedCapy = await B.act('pet_feed', { petUid: capy.uid });
    check("7. Pets: beam feeds her capybara (Lv 20, mood 100 -> 'pet_maxed')",
      !feedCapy.ok && feedCapy.error === 'pet_maxed');

    // 7. Pets: beam feeds her mochi cat (+50 exp, berries -10, mood capped 100)
    const cat = B.profile().pets?.find((p) => p.id === 'pet_mochi_cat');
    const catExpBefore = cat.exp | 0;
    const catBerryBefore = B.profile().berries;
    const feedCat = await B.act('pet_feed', { petUid: cat.uid });
    check('7. Pets: beam feeds her mochi cat (+50 exp, berries -10, mood capped 100)',
      feedCat.ok && feedCat.exp === catExpBefore + 50 && B.profile().berries === catBerryBefore - 10 && feedCat.mood <= 100,
      `exp=${feedCat.exp}, mood=${feedCat.mood}, berries=${B.profile().berries}`);

    // 7. Pets: reroll trait slot 1 on the cat (berries -80, only slot 1 changes)
    const catTraitsBefore = [...(B.profile().pets?.find((p) => p.id === 'pet_mochi_cat')?.traits || [])];
    const berryBeforeReroll = B.profile().berries;
    const rerollRes = await B.act('pet_reroll_trait', { petUid: cat.uid, slotIdx: 1 });
    const catAfter = B.profile().pets?.find((p) => p.id === 'pet_mochi_cat');
    const slot1ChangedOnly = rerollRes.ok &&
      catAfter.traits[0] === catTraitsBefore[0] &&
      catAfter.traits[2] === catTraitsBefore[2] &&
      catAfter.traits[1] !== catTraitsBefore[1];
    check('7. Pets: reroll trait slot 1 on the cat (berries -80, only slot 1 changes)',
      rerollRes.ok && B.profile().berries === berryBeforeReroll - 80 && slot1ChangedOnly,
      `slot1 trait: ${rerollRes.trait} (${rerollRes.tier}), traits: [${catAfter?.traits?.join(', ')}]`);

    // 7. Pets: beam breeds with nook: pet_breed_couple {myPetUid: capybara uid} -> gold -2000, berries -100, reply.tier is 'epic' or 'mythic', reply.exp 30, nook receives couple_egg_hatched
    const goldBeforeBreed = B.profile().gold;
    const berriesBeforeBreed = B.profile().berries;
    const eggPromise = N.wait((m) => m.type === 'couple_egg_hatched');
    const breedRes = await B.act('pet_breed_couple', { myPetUid: capy.uid });
    const eggMsg = await eggPromise;
    const breedOk = breedRes.ok &&
      B.profile().gold === goldBeforeBreed - 2000 &&
      B.profile().berries === berriesBeforeBreed - 100 &&
      (breedRes.tier === 'epic' || breedRes.tier === 'mythic') &&
      breedRes.exp === 30 &&
      eggMsg?.by === 'beam' && eggMsg?.hatched;
    check("7. Pets: beam breeds with nook: pet_breed_couple -> gold -2000, berries -100, reply.tier is 'epic'|'mythic', reply.exp 30, nook receives couple_egg_hatched",
      breedOk,
      `hatched=${breedRes.hatched?.id} (${breedRes.tier}), trait=${breedRes.trait}`);

    // 8. Persistence: close beam's socket, reconnect, verify inventory/equipped/pets survived
    const eqSnapshot = JSON.parse(JSON.stringify(B.profile().equipped));
    const petsCountSnapshot = B.profile().pets?.length;
    B.close();
    await sleep(250);
    const B2 = agent(srv.port, tb);
    const okB2 = await B2.wait((m) => m.type === 'auth_ok');
    const prof2 = okB2.profile;
    const survived = prof2 &&
      prof2.equipped?.outfit?.id === eqSnapshot.outfit?.id &&
      prof2.equipped?.face?.hide === true &&
      prof2.pets?.length === petsCountSnapshot &&
      prof2.inventory?.s2_kitsune_inari !== undefined;
    check("8. Persistence: close beam's socket, reconnect, verify inventory/equipped/pets survived",
      survived,
      `outfit=${prof2?.equipped?.outfit?.id}, pets=${prof2?.pets?.length}, faceHide=${prof2?.equipped?.face?.hide}`);

    N.close();
    B2.close();
    await sleep(100);
  } finally {
    await srv.close();
    const saved = JSON.parse(fs.readFileSync(path.join(tmp, 'db.json'), 'utf8'));
    const bSaved = saved.profiles.find((p) => p.id === 'beam');
    check('8. Persistence: saved JSON DB contains beam equipped and pets on shutdown',
      bSaved?.equipped?.outfit?.id === 's2_kitsune_inari' && bSaved?.pets?.length >= 2);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

async function partB() {
  console.log('\n— Part B: Puppeteer screenshots (nook session) —');
  if (!fs.existsSync(CHROME)) { check('Chrome found for browser QA', false, CHROME); return; }
  const { default: puppeteer } = await import('puppeteer-core');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'neora-qa3b-'));
  const srv = await startServer({ port: 0, dataFile: path.join(tmp, 'db.json'), quiet: true, rng: seeded(9) });
  fs.mkdirSync(SHOTS, { recursive: true });

  const launch = () => puppeteer.launch({
    executablePath: CHROME, headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
      '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'],
  });

  const browser = await launch();
  const errors = [];

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 430, height: 932, deviceScaleFactor: 1 });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });

    await page.goto(`http://localhost:${srv.port}/?dev=1&user=nook&pass=1234`, { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => !!window.__neora?.world, { timeout: 20000 });

    const hasRpg = await page.waitForFunction(() => !!window.__neora?.rpg, { timeout: 10000 }).then(() => true).catch(() => false);
    check('window.__neora.rpg exposed on client', hasRpg);

    if (hasRpg) {
      // 1. 'wardrobe' -> 07_wardrobe.png
      await page.evaluate(() => window.__neora.rpg.open('wardrobe'));
      const seenWardrobe = await page.waitForSelector('#rpg-ui', { timeout: 5000 }).then(() => true).catch(() => false);
      check('#rpg-ui appears for wardrobe', seenWardrobe);
      await sleep(400);

      // Red dot check: assert .rpg-red-dot element presence matches forgeReady(profile)
      const browserProf = await page.evaluate(() => window.__neora.rpg.profile);
      const expectedRedDot = forgeReady(browserProf);
      const actualRedDot = await page.evaluate(() => document.querySelector('.rpg-red-dot') !== null);
      check(`blacksmith red dot ${expectedRedDot ? 'exists' : 'is absent'} (forgeReady === ${expectedRedDot})`,
        actualRedDot === expectedRedDot,
        `actual=${actualRedDot}, expected=${expectedRedDot}`);

      await page.screenshot({ path: path.join(SHOTS, '07_wardrobe.png') });

      // 2. wardrobe sub-tab bag (click [data-wtab=bag]) -> 08_bag.png
      const bagClicked = await page.click('[data-wtab="bag"]').then(() => true).catch((e) => {
        errors.push(`click [data-wtab=bag] failed: ${e.message}`);
        return false;
      });
      check('wardrobe sub-tab bag [data-wtab=bag] clicked', bagClicked);
      await sleep(400);
      await page.screenshot({ path: path.join(SHOTS, '08_bag.png') });

      // 3. 'pets' -> 16_pets.png
      await page.evaluate(() => window.__neora.rpg.open('pets'));
      const seenPets = await page.waitForSelector('#rpg-ui', { timeout: 5000 }).then(() => true).catch(() => false);
      check('#rpg-ui appears for pets', seenPets);
      await sleep(400);
      await page.screenshot({ path: path.join(SHOTS, '16_pets.png') });

      // 4. 'forge' with { itemId: 's8_glacial_elsa' } -> 20_forge.png
      await page.evaluate(() => window.__neora.rpg.open('forge', { itemId: 's8_glacial_elsa' }));
      const seenForge = await page.waitForSelector('#rpg-ui', { timeout: 5000 }).then(() => true).catch(() => false);
      check('#rpg-ui appears for forge', seenForge);
      await sleep(400);
      await page.screenshot({ path: path.join(SHOTS, '20_forge.png') });

      // 4b. Forge Artisan Scroll checkbox exists -> 20b_forge_scroll.png
      const scrollCheckboxExists = await page.$('#forge-scroll') !== null;
      check('forge scroll checkbox #forge-scroll exists', scrollCheckboxExists);
      await page.screenshot({ path: path.join(SHOTS, '20b_forge_scroll.png') });

      // 5. 'gacha' { tab: 'box1' } -> 21_gacha_box1.png
      await page.evaluate(() => window.__neora.rpg.open('gacha', { tab: 'box1' }));
      const seenGacha1 = await page.waitForSelector('#rpg-ui', { timeout: 5000 }).then(() => true).catch(() => false);
      check('#rpg-ui appears for gacha box1', seenGacha1);
      await sleep(400);
      await page.screenshot({ path: path.join(SHOTS, '21_gacha_box1.png') });

      // 5b. Click 'relics' pill -> assert active and rates text changes -> 21c_gacha_relics.png
      const ratesBefore = await page.$eval('#rpg-rates', (el) => el.textContent.trim()).catch(() => '');
      await page.click('[data-banner="relics"]');
      await sleep(300);
      const relicsActive = await page.$eval('[data-banner="relics"]', (el) => el.classList.contains('active')).catch(() => false);
      const ratesRelics = await page.$eval('#rpg-rates', (el) => el.textContent.trim()).catch(() => '');
      check("gacha 'relics' pill becomes active and rates text changes",
        relicsActive && ratesBefore !== ratesRelics && ratesRelics.includes('2× rate-up'),
        `active=${relicsActive}, rates="${ratesRelics.slice(0, 45)}..."`);
      await page.screenshot({ path: path.join(SHOTS, '21c_gacha_relics.png') });

      // 5c. Click 'pets' pill -> assert active -> 21d_gacha_pets.png
      await page.click('[data-banner="pets"]');
      await sleep(300);
      const petsActive = await page.$eval('[data-banner="pets"]', (el) => el.classList.contains('active')).catch(() => false);
      const ratesPets = await page.$eval('#rpg-rates', (el) => el.textContent.trim()).catch(() => '');
      check("gacha 'pets' pill becomes active",
        petsActive && ratesPets.includes('Pets from all 6 families'),
        `active=${petsActive}, rates="${ratesPets.slice(0, 45)}..."`);
      await page.screenshot({ path: path.join(SHOTS, '21d_gacha_pets.png') });

      // 6. click #pull-10 then wait for #gacha-results children -> 21b_gacha_results.png
      let gotResults = false;
      try {
        await page.click('#pull-10');
        gotResults = await page.waitForFunction(
          () => (document.querySelector('#gacha-results')?.children?.length || 0) > 0,
          { timeout: 7000 }
        ).then(() => true).catch(() => false);
      } catch (e) {
        errors.push(`click #pull-10 failed: ${e.message}`);
      }
      check('click #pull-10 displays #gacha-results items', gotResults);
      await sleep(400);
      await page.screenshot({ path: path.join(SHOTS, '21b_gacha_results.png') });

      // 7. 'gacha' { tab: 'box2' } -> 22_gacha_box2.png
      await page.evaluate(() => window.__neora.rpg.open('gacha', { tab: 'box2' }));
      const seenGacha2 = await page.waitForSelector('#rpg-ui', { timeout: 5000 }).then(() => true).catch(() => false);
      check('#rpg-ui appears for gacha box2', seenGacha2);
      await sleep(400);
      await page.screenshot({ path: path.join(SHOTS, '22_gacha_box2.png') });

      // 8. 'gacha' { tab: 'shop' } -> 23_shard_shop.png
      await page.evaluate(() => window.__neora.rpg.open('gacha', { tab: 'shop' }));
      const seenShop = await page.waitForSelector('#rpg-ui', { timeout: 5000 }).then(() => true).catch(() => false);
      check('#rpg-ui appears for gacha shard shop', seenShop);
      await sleep(400);
      await page.screenshot({ path: path.join(SHOTS, '23_shard_shop.png') });
    } else {
      check('#rpg-ui appears for wardrobe', false, 'window.__neora.rpg unavailable');
      check('wardrobe sub-tab bag [data-wtab=bag] clicked', false, 'window.__neora.rpg unavailable');
      check('#rpg-ui appears for pets', false, 'window.__neora.rpg unavailable');
      check('#rpg-ui appears for forge', false, 'window.__neora.rpg unavailable');
      check('#rpg-ui appears for gacha box1', false, 'window.__neora.rpg unavailable');
      check('#pull-10 clicked and #gacha-results populated', false, 'window.__neora.rpg unavailable');
      check('#rpg-ui appears for gacha box2', false, 'window.__neora.rpg unavailable');
      check('#rpg-ui appears for gacha shard shop', false, 'window.__neora.rpg unavailable');
    }

    // Dev dress-up calibration page: ?dev=1&dressup=1 -> wait for #dressup -> dressup_calibration.png
    const pageCal = await browser.newPage();
    await pageCal.setViewport({ width: 430, height: 932, deviceScaleFactor: 1 });
    pageCal.on('pageerror', (e) => errors.push(`dressup pageerror: ${e.message}`));
    pageCal.on('console', (m) => { if (m.type() === 'error') errors.push(`dressup console: ${m.text()}`); });

    await pageCal.goto(`http://localhost:${srv.port}/?dev=1&dressup=1`, { waitUntil: 'networkidle0' });
    const seenDressup = await pageCal.waitForSelector('#dressup', { timeout: 8000 }).then(() => true).catch(() => false);
    check('#dressup element appears on calibration page', seenDressup);
    await sleep(400);
    await pageCal.screenshot({ path: path.join(SHOTS, 'dressup_calibration.png') });
    await pageCal.close();

    check('no page errors in browser sessions', errors.length === 0, errors.slice(0, 4).join(' | '));
  } finally {
    await browser.close();
    await srv.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

const noBrowser = process.argv.includes('--no-browser');
try {
  await partA();
  if (!noBrowser) await partB();
} catch (e) {
  check('QA run completed without crashing', false, e.stack);
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${failed.length ? '❌' : '✅'} Step 3 QA: ${results.length - failed.length}/${results.length} checks passed${noBrowser ? ' (browser part skipped)' : ''}`);
if (!noBrowser) console.log(`Screenshots: ${path.relative(process.cwd(), SHOTS)}/`);
process.exit(failed.length ? 1 : 0);
