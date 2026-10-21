// tests/cloud_dash_showcase.test.js — Showcase tests for 4 Cloud Dash mechanics:
// 👟 Hop-Over Vault, 💞 Couple Heart Slingshot, 🏎️ Corner Apex Carve, ☁️ Upper Cloud Deck,
// plus track structure/determinism and bot AI showcase.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DASH_TUNING as T, createRunner, stepRunner, speedMul, createBotBrain, botInput, computeRanking,
} from '../shared/cloud_dash_rules.js';
import { buildTrack } from '../shared/cloud_dash_track.js';

const NONE = { left: false, right: false, jump: false, glide: false, ult: false, item: false };

test('track: deck specs, deck items, landing safety, sorted bends, and determinism across seeds 1..30', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const t1 = buildTrack(seed);
    const t2 = buildTrack(seed);

    // Deterministic: same seed produces identical JSON
    assert.equal(JSON.stringify(t1), JSON.stringify(t2), `seed ${seed} deterministic`);

    // Deck dimensions: { s0: 330, s1: 400, ring: 327, y: 4 }
    assert.deepEqual(t1.deck, { s0: 330, s1: 400, ring: 327, y: 4 }, `seed ${seed} deck geometry`);

    // ≥20 deck items, all located within [deck.s0, deck.s1]
    const deckItems = t1.items.filter((it) => it.deck === 1);
    assert.ok(deckItems.length >= 20, `seed ${seed} has ≥20 deck items (found ${deckItems.length})`);
    for (const it of deckItems) {
      assert.ok(it.s >= t1.deck.s0 && it.s <= t1.deck.s1, `deck item s=${it.s} inside [${t1.deck.s0}, ${t1.deck.s1}]`);
    }

    // Drop-down landing zone safety: no pits overlapping [deck.s1 - 2, deck.s1 + 12]
    for (const p of t1.pits) {
      const overlaps = p.s1 > t1.deck.s1 - 2 && p.s0 < t1.deck.s1 + 12;
      assert.ok(!overlaps, `seed ${seed} pit ${JSON.stringify(p)} overlaps deck landing zone`);
    }

    // Bends: sorted, non-overlapping, with dir ∈ {-1, 1}
    assert.ok(t1.bends && t1.bends.length > 0, `seed ${seed} has bends`);
    for (let i = 0; i < t1.bends.length; i++) {
      const b = t1.bends[i];
      assert.ok(b.dir === -1 || b.dir === 1, `bend ${i} dir must be -1 or 1`);
      assert.ok(b.s0 < b.s1, `bend ${i} s0 < s1`);
      if (i > 0) {
        assert.ok(t1.bends[i - 1].s1 <= b.s0, `bends sorted and non-overlapping: bend ${i - 1} s1 <= bend ${i} s0`);
      }
    }
  }
});

test('vault: hop-over airborne pass over grounded rival triggers vault boost, style, and cooldowns', () => {
  // 1. Airborne runner sailing over a grounded rival in same lane
  const r = createRunner({ itemCount: 0 });
  const rival = { seat: 1, s: 0, lane: 0, y: 0 };
  const ctx = { track: { items: [], pits: [] }, rivals: [rival], place: 1 };

  // Step 1: runner jumping, rival slightly ahead (+0.3 gap)
  r.y = 1.0; r.grounded = false; r.vy = 2; rival.s = r.s + 0.3;
  const ev1 = stepRunner(r, ctx, NONE, T.DT);
  assert.ok(!ev1.some((e) => e.e === 'vault'), 'no vault on first step before pass');

  // Step 2: runner still airborne, rival now behind (-0.2 gap)
  r.y = 1.0; r.grounded = false; r.vy = 2; rival.s = r.s - 0.2;
  const styleBefore = r.style;
  const ev2 = stepRunner(r, ctx, NONE, T.DT);
  assert.ok(ev2.some((e) => e.e === 'vault'), 'emits vault event');
  assert.ok(r.vault > 0, 'vault boost active');
  assert.equal(r.style - styleBefore, 40, 'style increases by 40 at chain tier 0');

  // Style scaling with chain tier multiplier (~40 × chain mul)
  const rTier2 = createRunner({ itemCount: 0 });
  rTier2.chain = 25; // Tier 2 -> STYLE_MUL[2] = 3
  const rivalTier2 = { seat: 1, s: 0, lane: 0, y: 0 };
  const ctxTier2 = { track: { items: [], pits: [] }, rivals: [rivalTier2], place: 1 };
  rTier2.y = 1.0; rTier2.grounded = false; rTier2.vy = 2; rivalTier2.s = rTier2.s + 0.3;
  stepRunner(rTier2, ctxTier2, NONE, T.DT);
  rTier2.y = 1.0; rTier2.grounded = false; rTier2.vy = 2; rivalTier2.s = rTier2.s - 0.2;
  const s0Tier2 = rTier2.style;
  stepRunner(rTier2, ctxTier2, NONE, T.DT);
  assert.equal(rTier2.style - s0Tier2, 40 * 3, 'style increases by 40 × 3 at chain tier 2');

  // Negative checks:
  // a) Rival in different lane
  const rDiffLane = createRunner({ itemCount: 0 });
  const rivalDiff = { seat: 1, s: 0, lane: 1, y: 0 };
  const ctxDiff = { track: { items: [], pits: [] }, rivals: [rivalDiff], place: 1 };
  rDiffLane.y = 1.0; rDiffLane.grounded = false; rDiffLane.vy = 2; rivalDiff.s = rDiffLane.s + 0.3;
  stepRunner(rDiffLane, ctxDiff, NONE, T.DT);
  rDiffLane.y = 1.0; rDiffLane.grounded = false; rDiffLane.vy = 2; rivalDiff.s = rDiffLane.s - 0.2;
  const evDiff = stepRunner(rDiffLane, ctxDiff, NONE, T.DT);
  assert.ok(!evDiff.some((e) => e.e === 'vault'), 'no vault in different lane');
  assert.equal(rDiffLane.vault, 0);

  // b) Runner stays low (y < 0.6)
  const rLow = createRunner({ itemCount: 0 });
  const rivalLow = { seat: 1, s: 0, lane: 0, y: 0 };
  const ctxLow = { track: { items: [], pits: [] }, rivals: [rivalLow], place: 1 };
  rLow.y = 0.5; rLow.grounded = false; rLow.vy = 2; rivalLow.s = rLow.s + 0.3;
  stepRunner(rLow, ctxLow, NONE, T.DT);
  rLow.y = 0.5; rLow.grounded = false; rLow.vy = 2; rivalLow.s = rLow.s - 0.2;
  const evLow = stepRunner(rLow, ctxLow, NONE, T.DT);
  assert.ok(!evLow.some((e) => e.e === 'vault'), 'no vault when y < 0.6');
  assert.equal(rLow.vault, 0);

  // c) Runner never passes the rival (gap remains positive)
  const rNoPass = createRunner({ itemCount: 0 });
  const rivalNoPass = { seat: 1, s: 0, lane: 0, y: 0 };
  const ctxNoPass = { track: { items: [], pits: [] }, rivals: [rivalNoPass], place: 1 };
  rNoPass.y = 1.0; rNoPass.grounded = false; rNoPass.vy = 2; rivalNoPass.s = rNoPass.s + 0.3;
  stepRunner(rNoPass, ctxNoPass, NONE, T.DT);
  rNoPass.y = 1.0; rNoPass.grounded = false; rNoPass.vy = 2; rivalNoPass.s = rNoPass.s + 0.1;
  const evNoPass = stepRunner(rNoPass, ctxNoPass, NONE, T.DT);
  assert.ok(!evNoPass.some((e) => e.e === 'vault'), 'no vault without passing');
  assert.equal(rNoPass.vault, 0);

  // Cooldowns:
  // Global cooldown T.VAULT.cd (2 s) and per-rival cooldown 2 × T.VAULT.cd (4 s)
  const rCd = createRunner({ itemCount: 0 });
  const r1 = { seat: 1, s: 0, lane: 0, y: 0 };
  const r2 = { seat: 2, s: 0, lane: 0, y: 0 };
  const ctxCd = { track: { items: [], pits: [] }, rivals: [r1, r2], place: 1 };

  // Vault over rival 1
  rCd.y = 1.0; rCd.grounded = false; rCd.vy = 2; r1.s = rCd.s + 0.3;
  stepRunner(rCd, ctxCd, NONE, T.DT);
  rCd.y = 1.0; rCd.grounded = false; rCd.vy = 2; r1.s = rCd.s - 0.2;
  const evV1 = stepRunner(rCd, ctxCd, NONE, T.DT);
  assert.ok(evV1.some((e) => e.e === 'vault'));

  // Within 1.0 s (< T.VAULT.cd = 2.0 s), try vaulting over rival 2
  for (let i = 0; i < Math.round(1.0 / T.DT); i++) stepRunner(rCd, ctxCd, NONE, T.DT);
  assert.ok(rCd.vaultCd.all > 0, 'global vault cooldown active');
  rCd.y = 1.0; rCd.grounded = false; rCd.vy = 2; r2.s = rCd.s + 0.3;
  stepRunner(rCd, ctxCd, NONE, T.DT);
  rCd.y = 1.0; rCd.grounded = false; rCd.vy = 2; r2.s = rCd.s - 0.2;
  const evV2Blocked = stepRunner(rCd, ctxCd, NONE, T.DT);
  assert.ok(!evV2Blocked.some((e) => e.e === 'vault'), 'global cooldown blocks vault over rival 2');

  // Advance past global cooldown (2.5 s elapsed total, so global cd expired, but rival 1 cd < 4 s remains)
  for (let i = 0; i < Math.round(1.5 / T.DT); i++) stepRunner(rCd, ctxCd, NONE, T.DT);
  assert.equal(rCd.vaultCd.all, undefined, 'global cooldown expired');
  assert.ok(rCd.vaultCd[1] > 0, 'per-rival cooldown for rival 1 still active (< 4 s)');

  // Rival 2 can now be vaulted
  rCd.y = 1.0; rCd.grounded = false; rCd.vy = 2; r2.s = rCd.s + 0.3;
  stepRunner(rCd, ctxCd, NONE, T.DT);
  rCd.y = 1.0; rCd.grounded = false; rCd.vy = 2; r2.s = rCd.s - 0.2;
  const evV2Ok = stepRunner(rCd, ctxCd, NONE, T.DT);
  assert.ok(evV2Ok.some((e) => e.e === 'vault'), 'rival 2 vault successful once global cd clears');

  // Attempt second vault over rival 1 within 4 s — should fail due to per-rival cooldown
  rCd.vault = 0;
  rCd.vaultCd.all = 0; // clear global cd to isolate per-rival cd check
  rCd.y = 1.0; rCd.grounded = false; rCd.vy = 2; r1.s = rCd.s + 0.3;
  stepRunner(rCd, ctxCd, NONE, T.DT);
  rCd.y = 1.0; rCd.grounded = false; rCd.vy = 2; r1.s = rCd.s - 0.2;
  const evV1Blocked = stepRunner(rCd, ctxCd, NONE, T.DT);
  assert.ok(!evV1Blocked.some((e) => e.e === 'vault'), 'per-rival cooldown blocks second vault within 4 s');
});

test('heart: couple slingshot meter fills and boosts near partner, decays out of range', () => {
  // 1. With partner within range (r.s + 3), meter fills in ~2.6 s, fires exactly one heart, then cooldown
  const r = createRunner({ itemCount: 0 });
  const rival = { s: r.s + 3, lane: 0, seat: 1, heart: true };
  const ctx = { track: { items: [], pits: [] }, rivals: [rival], place: 1 };

  const events = [];
  const steps = Math.round(2.6 / T.DT);
  for (let i = 0; i < steps; i++) {
    rival.s = r.s + 3;
    events.push(...stepRunner(r, ctx, NONE, T.DT));
  }
  const heartEvents = events.filter((e) => e.e === 'heart');
  assert.equal(heartEvents.length, 1, 'emits exactly one heart event');
  assert.ok(r.heartBoost > 0, 'heartBoost active');
  assert.ok(r.heartCd > 0, 'heartCd set to T.HEART.cd');

  // No second heart during T.HEART.cd (12 s)
  const cdEvents = [];
  for (let i = 0; i < Math.round(4.0 / T.DT); i++) {
    rival.s = r.s + 3;
    cdEvents.push(...stepRunner(r, ctx, NONE, T.DT));
  }
  assert.ok(r.heartCd > 0, 'heart cooldown still active');
  assert.equal(cdEvents.filter((e) => e.e === 'heart').length, 0, 'no second heart during cd');

  // 2. With heart: false, heart slingshot never fires
  const rNoHeart = createRunner({ itemCount: 0 });
  const rivalNoHeart = { s: rNoHeart.s + 3, lane: 0, seat: 1, heart: false };
  const ctxNoHeart = { track: { items: [], pits: [] }, rivals: [rivalNoHeart], place: 1 };
  const evNoHeart = [];
  for (let i = 0; i < Math.round(3.0 / T.DT); i++) {
    rivalNoHeart.s = rNoHeart.s + 3;
    evNoHeart.push(...stepRunner(rNoHeart, ctxNoHeart, NONE, T.DT));
  }
  assert.equal(evNoHeart.filter((e) => e.e === 'heart').length, 0, 'never fires with heart: false');
  assert.equal(rNoHeart.heart, 0, 'heart meter remains 0');

  // 3. Meter decays when partner is out of range (>6 m)
  const rDecay = createRunner({ itemCount: 0 });
  const rivalDecay = { s: rDecay.s + 3, lane: 0, seat: 1, heart: true };
  const ctxDecay = { track: { items: [], pits: [] }, rivals: [rivalDecay], place: 1 };

  // Fill partially (1 s = ~40 points)
  for (let i = 0; i < Math.round(1.0 / T.DT); i++) {
    rivalDecay.s = rDecay.s + 3;
    stepRunner(rDecay, ctxDecay, NONE, T.DT);
  }
  const filledMeter = rDecay.heart;
  assert.ok(filledMeter > 30, 'meter filled partially');

  // Move partner out of range (> 6 m, e.g. 8 m)
  for (let i = 0; i < Math.round(0.5 / T.DT); i++) {
    rivalDecay.s = rDecay.s + 8;
    stepRunner(rDecay, ctxDecay, NONE, T.DT);
  }
  assert.ok(rDecay.heart < filledMeter, `meter decayed from ${filledMeter} to ${rDecay.heart}`);
});

test('apex: synthetic bend inside-lane carve triggers apex boost; wrong lane or airborne does not', () => {
  const track = { items: [], pits: [], bends: [{ s0: 50, s1: 80, dir: 1 }], deck: null };

  // 1. Runner grounded with laneT=laneF=1 running through bend -> exactly one {e: 'apex'}
  const r = createRunner({ itemCount: 0 });
  r.s = 40; r.v = 11;
  r.laneT = 1; r.laneF = 1; r.prevLane = 1;
  const ctx = { track, place: 1 };

  const events = [];
  let checkedSpeed = false;
  const baselineSpeed = speedMul(r);

  while (r.s < 90) {
    const ev = stepRunner(r, ctx, NONE, T.DT);
    events.push(...ev);
    if (r.apex > 0 && !checkedSpeed) {
      assert.ok(speedMul(r) > baselineSpeed, `speedMul increased during apex: ${speedMul(r)} > ${baselineSpeed}`);
      checkedSpeed = true;
    }
  }
  const apexEvents = events.filter((e) => e.e === 'apex');
  assert.equal(apexEvents.length, 1, 'emits exactly one apex event');
  assert.equal(apexEvents[0].dir, 1, 'apex event reports correct dir');
  assert.ok(checkedSpeed, 'verified speedMul > baseline while r.apex > 0');

  // 2. Same with laneF = -1 (outside lane) -> no apex
  const rOutside = createRunner({ itemCount: 0 });
  rOutside.s = 40; rOutside.v = 11;
  rOutside.laneT = -1; rOutside.laneF = -1; rOutside.prevLane = -1;
  const ctxOutside = { track, place: 1 };
  const evOutside = [];
  while (rOutside.s < 90) {
    evOutside.push(...stepRunner(rOutside, ctxOutside, NONE, T.DT));
  }
  assert.equal(evOutside.filter((e) => e.e === 'apex').length, 0, 'no apex on outside lane');
  assert.equal(rOutside.apex, 0);

  // 3. Airborne whole time -> no apex
  const rAir = createRunner({ itemCount: 0 });
  rAir.s = 40; rAir.v = 11;
  rAir.laneT = 1; rAir.laneF = 1; rAir.prevLane = 1;
  const ctxAir = { track, place: 1 };
  const evAir = [];
  while (rAir.s < 90) {
    rAir.grounded = false; rAir.y = 2.0; rAir.vy = 0; // force airborne
    evAir.push(...stepRunner(rAir, ctxAir, NONE, T.DT));
  }
  assert.equal(evAir.filter((e) => e.e === 'apex').length, 0, 'no apex while airborne');
  assert.equal(rAir.apex, 0);
});

test('deck: upper cloud deck entrance, height rise, pit/hazard immunity, deck item collection, and exit', () => {
  const deck = { s0: 330, s1: 400, ring: 327, y: 4.0 };
  const items = [
    { t: 'cloud', s: 350, lane: 0 },          // road hazard under deck
    { t: 'coin', s: 360, lane: 0, deck: 1 },  // deck item
  ];
  const pits = [
    { s0: 345, s1: 355 },                     // pit under deck
  ];
  const track = { items, pits, bends: [], deck };

  // 1. Airborne runner enters updraft ring, deckH rises, survives pit & cloud, collects deck coin, exits
  const r = createRunner({ itemCount: track.items.length });
  r.s = deck.ring - 1; // 326
  r.laneT = 0; r.laneF = 0;
  r.grounded = false; r.y = 1.0; r.vy = 0;
  const ctx = { track, place: 1 };

  // Initial step enters deck
  const evEnter = stepRunner(r, ctx, NONE, T.DT);
  assert.equal(r.deck, true, 'runner enters deck: r.deck === true');
  assert.ok(evEnter.some((e) => e.e === 'deck_enter'), 'emits deck_enter');

  // Deck height rises to T.DECK.y within ~T.DECK.rise + 0.1 s
  const riseSteps = Math.ceil((T.DECK.rise + 0.1) / T.DT);
  for (let i = 0; i < riseSteps; i++) stepRunner(r, ctx, NONE, T.DT);
  assert.equal(r.deckH, T.DECK.y, 'r.deckH reached T.DECK.y (4.0)');

  // Traverse the rest of the deck past hazards and deck items
  let hitCloud = false;
  let collectedDeckCoin = false;
  let triggeredRescue = false;
  const exitEvents = [];
  let yBeforeExit = 0;

  while (r.s < deck.s1 + 25) {
    if (r.deck) yBeforeExit = r.y;
    const ev = stepRunner(r, ctx, NONE, T.DT);
    if (ev.some((e) => e.e === 'hit')) hitCloud = true;
    if (ev.some((e) => e.e === 'coin')) collectedDeckCoin = true;
    if (ev.some((e) => e.e === 'rescue')) triggeredRescue = true;
    const dex = ev.filter((e) => e.e === 'deck_exit');
    if (dex.length) {
      exitEvents.push(...dex);
      assert.equal(r.deck, false, 'r.deck becomes false on exit');
      assert.equal(r.deckH, 0, 'r.deckH resets to 0 on exit');
      assert.ok(Math.abs(r.y - (yBeforeExit + 4.0)) < 0.2, `r.y ≈ previous y + 4 (${r.y} vs ${yBeforeExit + 4.0})`);
    }
  }

  assert.equal(triggeredRescue, false, 'pit under deck does not trigger rescue');
  assert.equal(hitCloud, false, 'road cloud under deck does not cause hit');
  assert.equal(collectedDeckCoin, true, 'deck:1 coin collected');
  assert.equal(exitEvents.length, 1, 'emits exactly one deck_exit');
  assert.ok(r.grounded, 'runner eventually lands on road');
  assert.equal(r.rescue, 0, 'lands without rescue');

  // 2. Grounded runner (y=0) at the ring does NOT enter the deck
  const rGrounded = createRunner({ itemCount: track.items.length });
  rGrounded.s = deck.ring - 1;
  rGrounded.laneT = 0; rGrounded.laneF = 0;
  rGrounded.grounded = true; rGrounded.y = 0; rGrounded.vy = 0;
  const evGrounded = stepRunner(rGrounded, ctx, NONE, T.DT);
  assert.equal(rGrounded.deck, false, 'grounded runner does not enter deck');
  assert.ok(!evGrounded.some((e) => e.e === 'deck_enter'));

  // 3. An off-deck runner never collects deck:1 items
  const rOffDeck = createRunner({ itemCount: track.items.length });
  rOffDeck.s = 355; // before deck coin at 360
  rOffDeck.laneT = 0; rOffDeck.laneF = 0;
  rOffDeck.grounded = true; rOffDeck.y = 0; rOffDeck.v = 11;
  const evOffDeck = [];
  while (rOffDeck.s < 370) {
    evOffDeck.push(...stepRunner(rOffDeck, ctx, NONE, T.DT));
  }
  assert.equal(rOffDeck.deck, false);
  assert.ok(!evOffDeck.some((e) => e.e === 'coin'), 'off-deck runner never collects deck:1 items');
  assert.equal(rOffDeck.coins, 0);

  // 4. A flying runner (Nyx Sky Flight) approaching the elevated deck in ANY lane automatically flies OVER the elevated deck
  const rFlying = createRunner({ petId: 'pet_nyx', petStars: 3, itemCount: track.items.length });
  rFlying.s = deck.ring;
  rFlying.laneT = 1; rFlying.laneF = 1; // outer lane (not center ring)
  rFlying.ride = 5.0;
  rFlying.y = T.FLIGHT.y;
  const evFly = stepRunner(rFlying, ctx, NONE, T.DT);
  assert.equal(rFlying.deck, true, 'flying runner automatically ascends over the elevated deck');
  assert.ok(evFly.some((e) => e.e === 'deck_enter'), 'flying runner emits deck_enter');
  for (let i = 0; i < riseSteps; i++) stepRunner(rFlying, ctx, NONE, T.DT);
  assert.equal(rFlying.deckH, T.DECK.y, 'flying runner deckH reaches 4.0m');
  assert.ok(rFlying.y + rFlying.deckH > T.DECK.y + 2.0, 'flying runner total altitude is > 6.0m (flying OVER the 4.0m elevated deck)');
});

test('bots: 4 insane bots complete seed 3 race and aggregate deck shortcut usage across seeds 1..5', () => {
  // 1. 4-bot 'insane' race on buildTrack(3) completes within 150 s sim
  const track3 = buildTrack(3);
  const bots3 = [0, 1, 2, 3].map((i) => ({
    r: createRunner({ seat: i, itemCount: track3.items.length }),
    b: createBotBrain(300 + i, 'insane'),
  }));

  for (let step = 0; step < 150 / T.DT && !bots3.every((x) => x.r.finished); step++) {
    const rank = computeRanking(bots3.map((x) => x.r));
    bots3.forEach((x, i) => {
      const ctx = { track: track3, place: rank.indexOf(i) + 1 };
      stepRunner(x.r, ctx, botInput(x.r, ctx, x.b, T.DT), T.DT);
    });
  }

  for (const b of bots3) {
    assert.ok(b.r.finished, `bot ${b.r.seat} finished`);
    assert.ok(b.r.finishT > 0 && b.r.finishT <= 150, `bot ${b.r.seat} finish time ${b.r.finishT} within 150 s`);
  }

  // 2. Aggregate across seeds 1..5: at least one bot enters the deck
  let totalDeckEnters = 0;
  for (let seed = 1; seed <= 5; seed++) {
    const track = buildTrack(seed);
    const bots = [0, 1, 2, 3].map((i) => ({
      r: createRunner({ seat: i, itemCount: track.items.length }),
      b: createBotBrain(seed * 100 + i, 'insane'),
      decks: 0,
    }));
    for (let step = 0; step < 150 / T.DT && !bots.every((x) => x.r.finished); step++) {
      const rank = computeRanking(bots.map((x) => x.r));
      bots.forEach((x, i) => {
        const ctx = { track, place: rank.indexOf(i) + 1 };
        const ev = stepRunner(x.r, ctx, botInput(x.r, ctx, x.b, T.DT), T.DT);
        for (const e of ev) if (e.e === 'deck_enter') x.decks++;
      });
    }
    totalDeckEnters += bots.reduce((sum, x) => sum + x.decks, 0);
  }
  assert.ok(totalDeckEnters >= 1, `at least one bot entered the deck across seeds 1..5 (found ${totalDeckEnters})`);
});
