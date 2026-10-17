// tests/monopoly.test.js — Step 4 Sky Monopoly rules, skill engine, bots (node --test tests/)
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MONO, CHAOS, PVP_CAPS, TILES, ZONE_TILES, PROPERTY_IDX, tileCell, isCorner, rentFor, netWorth, upgradeCost, takeoverCost,
  matchMods, gearStats, podiumRewards, investedValue, ZONES, THEMES, affinityFor, petMatchStats,
} from '../shared/monopoly_rules.js';
import { createMatch, roll, decide, ultimate, petUltimate, petArm, setPetAuto, drainEvents, legalActions, ranking } from '../shared/monopoly_engine.js';
import { botAction } from '../shared/monopoly_bots.js';
import { SEASON_SKILLS } from '../shared/season_skills.js';

const P = (k, extra = {}) => ({ id: `p${k}`, name: `P${k}`, ...extra });
const newMatch = (n = 4, extra = {}, seed = 7) => createMatch({ players: Array.from({ length: n }, (_, k) => P(k, extra[k] || {})), seed });
/** Force the current player's next roll to exactly `steps` (uses the engine's own fixed-roll status). */
const rollExactly = (m, steps) => { const p = m.players[m.turn.seat]; p.status = { fixedRoll: steps, turnsLeft: 1 }; return roll(m, p.seat); };
const endTurnOf = (m) => { while (m.pending) decide(m, m.pending.seat, { choice: m.pending.canSkip ? 'skip' : m.pending.options.find((o) => !o.disabled).id }); };
const own = (m, seat, i, level = 0) => { m.tiles[i].owner = seat; m.tiles[i].level = level; };
const types = (evs) => evs.map((e) => e.t);

function playOut(m, { maxSteps = 4000 } = {}) {
  let steps = 0;
  while (!m.ended && steps++ < maxSteps) {
    const s = m.turn.seat;
    const a = botAction(m, s, m.players[s].botDiff || 'hard');
    assert.ok(a, `bot must always have an action (phase ${m.phase})`);
    const r = a.type === 'roll' ? roll(m, s, a) : a.type === 'ultimate' ? ultimate(m, s) : decide(m, s, { choice: a.choice });
    assert.ok(r.ok, `action failed: ${r.error} ${JSON.stringify(a)}`);
    for (const p of m.players) assert.ok(Number.isFinite(p.cash) && p.cash >= 0, 'cash never negative');
    drainEvents(m);
  }
  return m;
}

// ------------------------------------------------------------------------------- board & math
test('board: 24 tiles, 18 properties in 6 zones, corner events at 0 / 5 / 12 / 17', () => {
  assert.equal(TILES.length, 24);
  assert.equal(PROPERTY_IDX.length, 18);
  for (const tiles of Object.values(ZONE_TILES)) assert.equal(tiles.length, 3);
  assert.deepEqual([0, 5, 12, 17].map((i) => TILES[i].kind), ['start', 'casino', 'vault', 'arena']);
  for (const i of [0, 5, 12, 17]) assert.ok(isCorner(i));
  const cells = new Set(TILES.map((t) => { const c = tileCell(t.i); return `${c.col},${c.row}`; }));
  assert.equal(cells.size, 24, 'every tile has its own perimeter cell');
  for (const t of TILES) { const { col, row } = tileCell(t.i); assert.ok(col === 0 || row === 0 || col === MONO.GRID_COLS - 1 || row === MONO.GRID_ROWS - 1); }
});

test('rent tiers match the §5 table (Shibuya 220 → 77 base, Golden Gai Tier 3 → 780)', () => {
  const m = newMatch(2);
  own(m, 1, 1, 0); own(m, 1, 3, 3);
  assert.equal(rentFor(m, 1), 77);
  assert.equal(rentFor(m, 3), 780);
  own(m, 1, 2, 0);                                    // full Kitsune set → ×1.5
  assert.equal(rentFor(m, 1), Math.round(220 * 0.35 * 1.5));
});

test('home turf: zone theme == costume affinity → +15% rent and −15% upgrade cost; Fortune bonus capped', () => {
  const m = newMatch(2, { 1: { outfit: 's2_kitsune_inari', outfitRarity: 3 } });
  assert.equal(m.players[1].affinity, 'spirit');
  own(m, 1, 1, 1);
  assert.equal(rentFor(m, 1), Math.round(220 * 0.8 * 1.15));
  own(m, 1, 6, 1);                                     // Mirage Oasis is 'desert' → no bonus
  assert.equal(rentFor(m, 6), Math.round(280 * 0.8));
  assert.equal(upgradeCost(TILES[1], 1, { affinity: 'spirit' }), Math.round(220 * 0.8 * 0.85));
  assert.equal(upgradeCost(TILES[1], 3), null, 'Tier 4 is skills-only');
});

test('every Mythic declares exactly ONE valid affinity theme; every theme has a zone', () => {
  const zoneThemes = new Set(Object.values(ZONES).map((z) => z.theme));
  assert.deepEqual([...zoneThemes].sort(), Object.keys(THEMES).sort());
  for (const [id, s] of Object.entries(SEASON_SKILLS)) {
    assert.equal(typeof s.affinity, 'string', `${id} has an affinity`);
    assert.ok(THEMES[s.affinity], `${id} affinity '${s.affinity}' is a known theme`);
  }
  assert.equal(affinityFor('s9_pharaoh_ra'), 'desert');
  assert.equal(affinityFor('newbie_outfit'), null, 'non-Mythics have no home turf');
});

test('a brand-new Season 12 Mythic gets home turf from data alone (zero board/engine edits)', () => {
  SEASON_SKILLS.s12_test_chrono = { affinity: 'frost', name: 'Chrono Test', icon: '⏳', vfx: 'roulette', monopoly: { onUltimate: [{ action: 'GAIN_CASH', amount: 1 }] } };
  try {
    const m = newMatch(2, { 0: { outfit: 's12_test_chrono', outfitRarity: 3 } });
    own(m, 0, 18, 0);                                  // Elsa Palace — Glacial Kingdom ('frost')
    assert.equal(rentFor(m, 18), Math.round(480 * 0.35 * 1.15));
  } finally { delete SEASON_SKILLS.s12_test_chrono; }
});

test('PvP fair-play cap: whale stats never exceed the §14.B caps (≤ +20%)', () => {
  const whale = matchMods({ fortune: 5000, swiftness: 5000, power: 5000, luck: 5000 }, { petFamily: 'cats', petPct: 80 });
  for (const [k, cap] of Object.entries(PVP_CAPS)) { assert.ok(whale[k] <= cap + 1e-9, k); assert.ok(whale[k] <= 0.20); }
  const newbie = matchMods({ fortune: 2, swiftness: 2, power: 2, luck: 2 });
  assert.ok(newbie.startCashPct < 0.01);
  const m = createMatch({ players: [P(0, { mods: whale }), P(1)], seed: 1 });
  assert.equal(m.players[0].cash, Math.round(2000 * (1 + whale.startCashPct)));
  assert.ok(m.players[0].cash <= 2300, 'start cash max 2,300');
});

test('gearStats sums equipped items with injected catalogs (+5% per Star-Force level)', () => {
  const s = gearStats(
    { outfit: { id: 'o', refine: 0 }, hat: { id: 'h', refine: 10 }, pet: { id: 'x' } },
    { outfits: { o: { stats: { all: 2 } } }, accessories: { h: { stats: { power: 10, luck: 4 } } } },
  );
  assert.deepEqual(s, { fortune: 2, swiftness: 2, power: 17, luck: 8 });
});

test('net worth = cash + Σ(base cost + upgrade value)', () => {
  const m = newMatch(2);
  own(m, 0, 23, 2);
  assert.equal(netWorth(m, 0), m.players[0].cash + 650 + Math.round(650 * 0.5) + Math.round(650 * 0.8));
  assert.equal(takeoverCost(TILES[23], 2), 2 * investedValue(TILES[23], 2));
});

// ------------------------------------------------------------------------------- turn pipeline
test('pass START: +400 salary, +1 ⚡2d6 charge, +20% ult', () => {
  const m = newMatch(2);
  const p = m.players[0];
  p.pos = 22;
  const cash = p.cash, boost = p.boost;
  rollExactly(m, 3);                                   // 22 → 1 (passes START)
  assert.equal(p.pos, 1);
  assert.equal(p.cash, cash + 400);
  assert.equal(p.boost, boost + 1);
  assert.ok(p.ult >= MONO.ULT_START);
});

test('2d6 boost consumes a charge; 1d6 does not', () => {
  const m = newMatch(2);
  const p = m.players[0];
  roll(m, 0, { use2d6: true });
  assert.equal(p.boost, MONO.START_BOOST - 1);
  const evs = drainEvents(m);
  assert.equal(evs.find((e) => e.t === 'dice').dice.length, 2);
});

test('buy → rent → hostile takeover offer (Tier 0–2) pays the owner 2× invested value', () => {
  const m = newMatch(2);
  rollExactly(m, 1);
  assert.equal(m.pending.kind, 'buy');
  assert.ok(decide(m, 0, { choice: 'buy' }).ok);
  assert.equal(m.tiles[1].owner, 0);
  // seat 1 lands on it
  const b = m.players[1]; b.cash = 5000;
  const a0 = m.players[0].cash;
  rollExactly(m, 1);
  assert.equal(m.players[0].cash, a0 + rentFor(m, 1));
  assert.equal(m.pending.kind, 'takeover');
  const cost = m.pending.cost;
  decide(m, 1, { choice: 'takeover' });
  assert.equal(m.tiles[1].owner, 1);
  assert.equal(m.players[0].cash, a0 + Math.round(220 * 0.35) + cost);
});

test('Tier 3 landmarks are immune to hostile takeover', () => {
  const m = newMatch(2);
  own(m, 1, 2, 3);
  m.players[0].cash = 99999;
  rollExactly(m, 2);
  assert.equal(m.pending, null);
  assert.equal(m.tiles[2].owner, 1);
});

test('Engine Rule 1: max 1 secondary hop — a push onto a Torii gate never chains', () => {
  const m = newMatch(3);
  own(m, 2, 23, 3);
  m.tiles[3] = { owner: null, level: 0, modifier: { pushSteps: 2, owner: 1, turnsLeft: 3 } };
  m.tiles[5].modifier = { warpToOwnerBest: true, owner: 2, turnsLeft: 3, oneShot: true };
  rollExactly(m, 3);                                   // land 3 → pushed to 5 → gate must NOT fire
  assert.equal(m.players[0].pos, 5);
  assert.ok(m.tiles[5].modifier, 'gate untouched');
  const moves = drainEvents(m).filter((e) => e.t === 'move');
  assert.deepEqual(moves.map((e) => e.kind), ['walk', 'push']);
});

test('Engine Rule 2: one status slot — a new hex overwrites the old one', () => {
  const m = newMatch(2, { 0: { outfit: 's2_tsukuyomi_eclipse', outfitRarity: 3 } });
  m.players[1].status = { moveDir: -1, turnsLeft: 1 };
  m.players[0].ult = 100;
  ultimate(m, 0);
  assert.equal(m.players[1].status.fixedRoll, 3);
  assert.equal(m.players[1].status.moveDir, undefined);
});

test('Cinderella reverse: the hexed rival walks backwards and does not collect salary', () => {
  const m = newMatch(2, { 0: { outfit: 's7_cinderella_clock', outfitRarity: 3 } });
  m.players[0].ult = 100;
  ultimate(m, 0);
  rollExactly(m, 2); endTurnOf(m);                     // seat 0 ends turn
  const r = m.players[1];
  assert.equal(r.status.moveDir, -1);
  const cash = r.cash;
  r.status = { ...r.status, fixedRoll: 3 };
  roll(m, 1);
  assert.equal(r.pos, 21);
  assert.ok(r.cash <= cash, 'no START salary when moving backwards');
});

test('Elsa freeze skips the richest rival\'s next turn', () => {
  const m = newMatch(2, { 0: { outfit: 's8_glacial_elsa', outfitRarity: 3 } });
  m.players[0].ult = 100;
  ultimate(m, 0);
  assert.equal(m.players[1].status.skipTurn, true);
  rollExactly(m, 2); endTurnOf(m);
  const evs = drainEvents(m);
  assert.ok(evs.some((e) => e.t === 'skip' && e.seat === 1));
  assert.equal(m.turn.seat, 0, 'turn came straight back to seat 0');
});

test('Phantom mirror inverts rent: the tile owner pays the Phantom', () => {
  const m = newMatch(2, { 0: { outfit: 's10_phantom_masque', outfitRarity: 3 } });
  own(m, 1, 9, 2);
  m.players[0].ult = 100;
  ultimate(m, 0);
  assert.equal(m.tiles[9].modifier.reverseTrap, true);
  const a = m.players[0].cash, b = m.players[1].cash, rent = rentFor(m, 9);
  rollExactly(m, 9);
  assert.equal(m.players[0].cash, a + rent);
  assert.equal(m.players[1].cash, b - rent);
});

test('Pharaoh raises the best tile by one tier; Tier 3 → indestructible Tier 4', () => {
  const m = newMatch(2, { 0: { outfit: 's9_pharaoh_ra', outfitRarity: 3 } });
  own(m, 0, 23, 3);
  m.players[0].ult = 100;
  ultimate(m, 0);
  assert.equal(m.tiles[23].level, 4);
  assert.equal(rentFor(m, 23), Math.round(650 * 4.5));
});

test('Zeus smite: richest rival loses a level, caster gets the bounty; Tier 4 is immune', () => {
  const m = newMatch(2, { 0: { outfit: 's11_zeus_olympus', outfitRarity: 3 } });
  own(m, 1, 22, 2); own(m, 1, 23, 4);
  m.players[0].ult = 100;
  ultimate(m, 0);
  assert.equal(m.tiles[22].level, 1);
  assert.equal(m.tiles[23].level, 4);
});

test('Sultan wish is a CHOICE; Magic Carpet replaces the roll', () => {
  const m = newMatch(2, { 0: { outfit: 's3_sultan_djinn', outfitRarity: 3 } });
  m.players[0].ult = 100;
  ultimate(m, 0);
  assert.equal(m.pending.kind, 'choice');
  assert.equal(legalActions(m, 0).canRoll, false);
  decide(m, 0, { choice: 'carpet' });
  assert.equal(m.pending.kind, 'warp_any');
  decide(m, 0, { choice: 13 });
  assert.equal(m.players[0].pos, 13);
  assert.equal(m.pending.kind, 'buy');
  decide(m, 0, { choice: 'skip' });
  assert.equal(m.turn.seat, 1, 'carpet flight used the turn');
});

test('Couple synergy: +15% ultimate cash when the bound partner sits at the table', () => {
  const solo = newMatch(2);
  const duo = newMatch(2, { 0: { partnerId: 'p1' } });
  for (const m of [solo, duo]) { m.players[0].ult = 100; ultimate(m, 0); }
  const gain = (m) => m.players[0].cash - 2000;
  assert.equal(gain(solo), 150);
  assert.equal(gain(duo), Math.round(150 * 1.15));
  assert.ok(drainEvents(duo).find((e) => e.t === 'ult').couple);
});

test('cannot pay → liquidation at 50%, then bankruptcy releases every tile', () => {
  const m = newMatch(3);
  own(m, 1, 23, 3);
  own(m, 0, 1, 0);
  m.players[0].cash = 10;
  m.players[0].pos = 20;
  rollExactly(m, 3);
  assert.ok(m.players[0].bankrupt);
  assert.equal(m.tiles[1].owner, null);
  assert.ok(drainEvents(m).some((e) => e.t === 'liquidate'));
  assert.equal(m.turn.seat, 1);
});

test('Phoenix revive saves one bankruptcy', () => {
  const m = newMatch(2);
  own(m, 1, 23, 3);
  Object.assign(m.players[0], { cash: 10, pos: 20, revive: 1 });
  rollExactly(m, 3);
  assert.equal(m.players[0].bankrupt, false);
  assert.equal(m.players[0].cash, MONO.PHOENIX_REVIVE_CASH);
});

test('ultimate that bankrupts a rival = BANKRUPTCY STRIKE finisher, caster ranks 1st', () => {
  const m = newMatch(3, { 0: { outfit: 's6_astral_sovereign', outfitRarity: 3 } });
  own(m, 0, 2, 3);
  Object.assign(m.players[0], { pos: 2, ult: 100 });
  Object.assign(m.players[1], { pos: 4, cash: 5 });
  ultimate(m, 0);
  assert.ok(m.ended);
  assert.equal(m.result.reason, 'finisher');
  assert.equal(m.result.winner, 0);
});

test('15 rounds → ranked by 👑 net worth', () => {
  const m = newMatch(2);
  m.round = 15;
  own(m, 1, 23, 3);
  rollExactly(m, 1); decide(m, 0, { choice: 'skip' });
  rollExactly(m, 2); if (m.pending) decide(m, 1, { choice: 'skip' });
  assert.ok(m.ended);
  assert.equal(m.result.reason, 'rounds');
  assert.equal(m.result.winner, 1);
  assert.deepEqual(m.result.ranking.map((r) => r.rank), [1, 2]);
});

test('determinism: same seed + same decisions ⇒ identical match', () => {
  const run = () => playOut(createMatch({ players: [P(0, { botDiff: 'insane' }), P(1, { botDiff: 'hard' }), P(2, { botDiff: 'easy' })], seed: 4242 }));
  const a = run(), b = run();
  assert.deepEqual(a.result, b.result);
  assert.deepEqual(a.tiles, b.tiles);
});

// ------------------------------------------------------------------------------- QA gate (sim)
test('QA gate: 300 full bot matches (2–4 seats, all 13 Mythics) always reach the podium', () => {
  const outfits = [...Object.keys(SEASON_SKILLS), 'newbie_outfit', 'epic_starlight_idol'];
  const diffs = ['easy', 'hard', 'insane'];
  const seen = new Set();
  for (let g = 0; g < 300; g++) {
    const n = 2 + (g % 3);
    const m = createMatch({
      players: Array.from({ length: n }, (_, k) => {
        const o = outfits[(g * 3 + k) % outfits.length];
        return P(k, { isBot: true, botDiff: diffs[(g + k) % 3], outfit: o, outfitRarity: o.startsWith('s') ? 3 : o.startsWith('epic') ? 2 : 1, partnerId: k === 1 ? 'p0' : null, stats: { fortune: g % 60, luck: 20, power: 30, swiftness: 10 } });
      }),
      seed: 1000 + g,
    });
    const origUlt = m.players.map((p) => p.outfit);
    playOut(m);
    assert.ok(m.ended, `match ${g} ended`);
    assert.ok(['rounds', 'last_standing', 'finisher'].includes(m.result.reason));
    assert.equal(new Set(m.result.ranking.map((r) => r.rank)).size, n);
    origUlt.forEach((o) => seen.add(o));
  }
  for (const id of Object.keys(SEASON_SKILLS)) assert.ok(seen.has(id), `${id} exercised`);
});

test('balance: every Mythic ultimate stays in a fair win-rate band vs 3 generic players', () => {
  const N = 240;
  for (const id of Object.keys(SEASON_SKILLS)) {
    let wins = 0;
    for (let g = 0; g < N; g++) {
      const seat = g % 4;
      const m = createMatch({ players: [0, 1, 2, 3].map((k) => P(k, { isBot: true, botDiff: 'hard', outfit: k === seat ? id : 'newbie_outfit', outfitRarity: k === seat ? 3 : 1 })), seed: 9000 + g });
      playOut(m);
      if (m.result.winner === seat) wins++;
    }
    const rate = wins / N;
    assert.ok(rate > 0.14 && rate < 0.45, `${id} win rate ${(rate * 100).toFixed(1)}% out of band`);
  }
});

// ------------------------------------------------------------------------------- podium economy
test('podium rewards: 28-combination TableScale matrix, +150 💎 1st match bonus, live boardDiamonds, 6/day cap', () => {
  // Base 1.00x (e.g. 4 Hard bots or explicit tableScale: 1)
  const r1 = podiumRewards(1, { multiplier: 2.4, tableScale: 1, firstMatchToday: true, boardDiamonds: 35 });
  assert.deepEqual(r1, {
    rank: 1,
    tableScale: 1,
    coupleBonus: false,
    gold: 3600,
    berries: 432,
    podiumDiamonds: 100,
    dailyBonusDiamonds: 150,
    boardDiamonds: 35,
    diamonds: 285,
    ticketBonus: 1,
    chestChance: 0.50,
    exp: 180,
  });
  // Couple vs 2 Insane Bots → SeatFactor(4)=1.00 * avg(1.25,1.25,1.20,1.20)=1.225 * Couple(1.25) = 1.53125
  const coupleSeats = [
    { isBot: false },
    { isBot: false },
    { isBot: true, botDiff: 'insane' },
    { isBot: true, botDiff: 'insane' },
  ];
  const coupleR1 = podiumRewards(1, { seats: coupleSeats, coupleBonus: true });
  assert.equal(coupleR1.podiumDiamonds, Math.round(100 * 1.53125)); // 153 💎
  // 1P vs 1 Easy Bot → SeatFactor(2)=0.60 * avg(1.25, 0.70)=0.975 = 0.585
  const soloEasy = podiumRewards(1, { seats: [{ isBot: false }, { isBot: true, botDiff: 'easy' }] });
  assert.equal(soloEasy.podiumDiamonds, Math.round(100 * 0.60 * 0.975)); // 59 💎
  // Rank 4 still gets participation diamonds (30 base at 1.00x)
  assert.equal(podiumRewards(4, { tableScale: 1 }).podiumDiamonds, 30);
  assert.equal(podiumRewards(4, { tableScale: 1 }).chestChance, 0);
  // Daily cap at 6 diamond-rewarded matches
  assert.equal(podiumRewards(1, { firstMatchToday: true, payoutsToday: 6, boardDiamonds: 40 }).diamonds, 0, 'daily cap');
});

test('live in-board diamonds: pass START (+10 💎), Color Monopoly (+25 💎), Arena win (+15 💎)', () => {
  const m = newMatch(2);
  const p = m.players[0];
  own(m, 0, 2, 0); own(m, 0, 3, 0);
  p.pos = 22;
  rollExactly(m, 3); // passes START (+10 💎) and lands on tile 1
  assert.equal(p.boardDiamonds, 10);
  decide(m, 0, { choice: 'buy' }); // buys tile 1 → completes Kitsune color set (tiles 1, 2, 3) → +25 💎
  assert.equal(p.colorSetClaimed, true);
  assert.equal(p.boardDiamonds, 10 + 25);
});

test('ranking puts bankrupt players last, latest bankruptcy ranked higher', () => {
  const m = newMatch(4);
  m.players[1].bankrupt = true; m.players[1].bankruptOrder = 1;
  m.players[3].bankrupt = true; m.players[3].bankruptOrder = 2;
  assert.deepEqual(ranking(m).map((r) => r.seat).slice(2), [3, 1]);
  assert.ok(types(drainEvents(m)).includes('turn'));
});

test('Pet Costume Soul-Link: petUlt charges at bond-scaled speed and NEVER auto-casts at turn start (waits for its owner)', () => {
  const m = newMatch(2, {
    0: {
      outfit: 's11_zeus_olympus',
      outfitRarity: 3,
      pet: 'pet_nyx',
      petCostume: 's1_naga_sovereign',
      petCostumeRarity: 3,
    },
  });
  const p0 = m.players[0];
  assert.equal(p0.petCostume, 's1_naga_sovereign');
  assert.equal(p0.petUlt, MONO.PET_START_MIN, 'bond Lv1 starting gauge');
  p0.petUlt = 0;

  // Seat 0 rolls and ends turn (+10 owner ult -> +5.5 petUlt at bond Lv1 0.55x)
  rollExactly(m, 2);
  endTurnOf(m);
  assert.equal(p0.ult, MONO.ULT_PER_TURN);
  assert.equal(p0.petUlt, MONO.ULT_PER_TURN * MONO.PET_RATE_MIN);

  p0.petUlt = 100;
  drainEvents(m);
  rollExactly(m, 1);
  endTurnOf(m);
  const evs = drainEvents(m);
  assert.ok(!evs.some((e) => e.t === 'ult' && e.byPet), 'no pet cast at the start of the owner turn');
  assert.equal(p0.petUlt, 100, 'gauge is held for a Soul-Link Combo');
});

test('Soul-Link Combo: casting owner ultimate when pet gauge is full fires pet_combo immediately with +15% potency', () => {
  const m = newMatch(2, {
    0: {
      outfit: 's11_zeus_olympus',
      outfitRarity: 3,
      pet: 'pet_nyx',
      petBondLv: 1,
      petCostume: 's1_naga_sovereign',
      petCostumeRarity: 3,
    },
  });
  const p0 = m.players[0];
  p0.ult = 100;
  p0.petUlt = 100;
  drainEvents(m);
  const res = ultimate(m, 0);
  assert.equal(res.ok, true);
  assert.equal(res.combo, true, 'owner ultimate triggered a Soul-Link Combo');
  const evs = drainEvents(m);
  const ultEv = evs.find((e) => e.t === 'ult' && e.seat === 0 && !e.byPet);
  const comboEv = evs.find((e) => e.t === 'pet_combo' && e.seat === 0);
  assert.ok(ultEv?.combo, 'ult event marked combo=true');
  assert.ok(comboEv, 'pet_combo event emitted');
  assert.equal(comboEv.bonus, MONO.PET_COMBO_BONUS);
  assert.equal(comboEv.potency, Math.round(MONO.PET_POT_MIN * (1 + MONO.PET_COMBO_BONUS) * 10000) / 10000);
  assert.equal(p0.petCasts, 1);
});

test('Pet Auto vs Manual & Arm: Manual holds pet unless armed or solo-cast; Auto solo-casts after 2 held turns', () => {
  const m = newMatch(2, {
    0: { outfit: 'newbie_outfit', pet: 'pet_ragdoll', petBondLv: 10 },
  });
  const p0 = m.players[0];
  setPetAuto(m, 0, false);
  assert.equal(p0.petAuto, false);
  p0.ult = 100;
  p0.petUlt = 100;
  // In Manual mode without arming, owner ult does NOT combo
  const r1 = ultimate(m, 0);
  assert.equal(r1.combo, false);
  assert.equal(p0.petUlt, 100);
  // Arming in Manual mode causes the next owner ult to combo
  petArm(m, 0, true);
  assert.equal(p0.petArmed, true);
  // Or solo-casting on owner turn before rolling works
  const soloRes = petUltimate(m, 0);
  assert.equal(soloRes.ok, true);
  assert.equal(p0.petCasts, 1);
  assert.ok(drainEvents(m).some((e) => e.t === 'ult' && e.byPet && e.solo));
});

test('Pet Bond Lv.1 -> Max scaling & Public table potency compression', () => {
  const lv1 = petMatchStats({ bond: 1, publicTable: false });
  assert.equal(lv1.rate, MONO.PET_RATE_MIN);
  assert.equal(lv1.potency, MONO.PET_POT_MIN);
  assert.equal(lv1.start, MONO.PET_START_MIN);

  const maxLv = petMatchStats({ bond: MONO.PET_BOND_MAX, publicTable: false });
  assert.equal(maxLv.rate, MONO.PET_RATE_MAX);
  assert.equal(maxLv.potency, MONO.PET_POT_MAX);
  assert.equal(maxLv.start, MONO.PET_START_MAX);

  const pubLv1 = petMatchStats({ bond: 1, publicTable: true });
  const pubMax = petMatchStats({ bond: MONO.PET_BOND_MAX, publicTable: true });
  assert.equal(pubLv1.potency, 0.40);
  assert.equal(pubMax.potency, 0.60);
});

test('Chaos Party mode: 10 rounds, max pets (1.0x/1.0/50% start), +30% combo, and chaos_event each round', () => {
  const m = createMatch({
    mode: 'chaos',
    players: [
      P(0, { isBot: true, botDiff: 'hard', outfit: 'sm_eclipse_dragon', outfitRarity: 3, pet: 'pet_nyx', petBondLv: 1 }),
      P(1, { isBot: true, botDiff: 'hard', outfit: 'sm_aurora_empress', outfitRarity: 3, pet: 'pet_ragdoll', petBondLv: 1 }),
    ],
    seed: 777,
  });
  assert.equal(m.chaos, true);
  assert.equal(m.maxRounds, CHAOS.MAX_ROUNDS);
  assert.equal(m.players[0].petUlt, CHAOS.PET_START);
  assert.equal(m.players[0].petPotency, CHAOS.PET_POT);
  assert.equal(m.players[0].petCap, null, 'Chaos mode has no pet cast cap');
  const startEvs = drainEvents(m);
  assert.ok(startEvs.some((e) => e.t === 'chaos_event'), 'round 1 emits a chaos_event');
  playOut(m);
  assert.equal(m.ended, true);
});


