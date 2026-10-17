// tests/casino.test.js — Grand Starlight Casino tests: Monte-Carlo RTP, Pok-Deng, Roulette, and Table Hub flow.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createTableService } from '../server/table_service.js';
import {
  CASINO,
  dengMult,
  comparePokDeng,
  validateRouletteBets,
  playPokDengHand,
  spinRoulette,
  settleRoulette,
} from '../shared/casino_rules.js';

function fakeDb() {
  const profiles = new Map();
  for (const id of ['nook', 'beam']) {
    profiles.set(id, {
      id,
      username: id,
      lineage: 'bkk',
      level: 5,
      exp: 0,
      gold: 50000,
      berries: 100,
      diamonds: 0,
      equipped: { outfit: { id: 'newbie_outfit', refine: 0 } },
      village: { levels: { patisserie: 10 } },
    });
  }
  return {
    profiles,
    getProfile: (id) => profiles.get(id),
    markProfile() {},
  };
}

function setup(opts = {}) {
  let t = 1_760_000_000_000;
  const inbox = new Map();
  const db = opts.db || fakeDb();
  const onBigHitCalls = [];
  const onHandSettledCalls = [];
  const onMatchFinishedCalls = [];

  const svc = createTableService({
    db,
    rng: opts.rng || (() => 0.5),
    now: () => t,
    log: {},
    tickMs: 1e9,
    sendTo: (id, msg) => {
      if (!inbox.has(id)) inbox.set(id, []);
      inbox.get(id).push(msg);
    },
    onlineIds: () => ['nook', 'beam'],
    pushProfile: (p) => {
      if (opts.onPushProfile) opts.onPushProfile(p);
    },
    onBigHit: (hit) => onBigHitCalls.push(hit),
    onHandSettled: (p) => onHandSettledCalls.push(p),
    onMatchFinished: (p) => onMatchFinishedCalls.push(p),
    catalogs: { outfits: { newbie_outfit: { rarity: 1, stats: { all: 2 } } }, patisseriePct: (lv) => lv * 2 },
  });

  return {
    svc,
    db,
    inbox,
    onBigHitCalls,
    onHandSettledCalls,
    onMatchFinishedCalls,
    advance: (ms) => { t += ms; },
    now: () => t,
    close: () => svc.close(),
  };
}

test('Monte-Carlo RTP bounds (pokdeng 0.90-0.99, roulette red 0.95-0.99, straight 0.85-0.97)', () => {
  // Pok-Deng RTP: 10,000 hands
  let pokBet = 0, pokReturned = 0;
  for (let k = 1; k <= 10000; k++) {
    const res = playPokDengHand(k, [{ seat: 0, bet: 100, cheer: false }]);
    const s = res.seats[0].settle;
    pokBet += 100;
    pokReturned += s.returned - s.extraLoss;
  }
  const pokRtp = pokReturned / pokBet;
  assert.ok(pokRtp >= 0.90 && pokRtp <= 0.99, `Pokdeng RTP ${pokRtp} not in [0.90, 0.99]`);

  // Roulette Red RTP: 10,000 spins
  let redBet = 0, redReturned = 0;
  for (let k = 1; k <= 10000; k++) {
    const spin = spinRoulette(k);
    const res = settleRoulette([{ type: 'red', amount: 100 }], spin);
    redBet += 100;
    redReturned += res.returned;
  }
  const redRtp = redReturned / redBet;
  assert.ok(redRtp >= 0.95 && redRtp <= 0.99, `Roulette Red RTP ${redRtp} not in [0.95, 0.99]`);

  // Roulette Straight RTP: 10,000 spins
  let strBet = 0, strReturned = 0;
  for (let k = 1; k <= 10000; k++) {
    const spin = spinRoulette(k);
    const res = settleRoulette([{ type: 'straight', n: 7, amount: 100 }], spin);
    strBet += 100;
    strReturned += res.returned;
  }
  const strRtp = strReturned / strBet;
  assert.ok(strRtp >= 0.85 && strRtp <= 0.97, `Roulette Straight RTP ${strRtp} not in [0.85, 0.97]`);
});

test('dengMult cases (pair/flush 2x, 3-kind 5x, straight incl Q-K-A 3x, 3 face 3x)', () => {
  // Pair 2x
  assert.equal(dengMult([{ r: 5, s: 0 }, { r: 5, s: 1 }]), 2);
  // Flush 2x
  assert.equal(dengMult([{ r: 3, s: 2 }, { r: 8, s: 2 }]), 2);
  // Normal 2-card 1x
  assert.equal(dengMult([{ r: 3, s: 0 }, { r: 8, s: 1 }]), 1);

  // 3-of-a-kind 5x
  assert.equal(dengMult([{ r: 7, s: 0 }, { r: 7, s: 1 }, { r: 7, s: 2 }]), 5);

  // 3-card straight 3x
  assert.equal(dengMult([{ r: 4, s: 0 }, { r: 5, s: 1 }, { r: 6, s: 2 }]), 3);
  // 3-card straight Q-K-A (12, 13, 1) 3x
  assert.equal(dengMult([{ r: 12, s: 0 }, { r: 13, s: 1 }, { r: 1, s: 2 }]), 3);

  // 3 face cards 3x (J, Q, K are ranks >= 11)
  assert.equal(dengMult([{ r: 11, s: 0 }, { r: 12, s: 1 }, { r: 13, s: 2 }]), 3);
  assert.equal(dengMult([{ r: 11, s: 0 }, { r: 11, s: 1 }, { r: 12, s: 2 }]), 3);
});

test('comparePokDeng: Pok 9 > Pok 8 > non-pok 9', () => {
  const pok9 = [{ r: 4, s: 0 }, { r: 5, s: 1 }];                     // 2 cards, 9 pts = Pok 9
  const pok8 = [{ r: 3, s: 0 }, { r: 5, s: 1 }];                     // 2 cards, 8 pts = Pok 8
  const nonPok9 = [{ r: 3, s: 0 }, { r: 3, s: 1 }, { r: 3, s: 2 }]; // 3 cards, 9 pts = non-pok 9

  assert.equal(comparePokDeng(pok9, pok8), 1, 'Pok 9 beats Pok 8');
  assert.equal(comparePokDeng(pok8, pok9), -1, 'Pok 8 loses to Pok 9');
  assert.equal(comparePokDeng(pok8, nonPok9), 1, 'Pok 8 beats non-pok 9');
  assert.equal(comparePokDeng(nonPok9, pok8), -1, 'non-pok 9 loses to Pok 8');
  assert.equal(comparePokDeng(pok9, nonPok9), 1, 'Pok 9 beats non-pok 9');
});

test('validateRouletteBets limits/merge', () => {
  // Merging duplicate spots
  const merged = validateRouletteBets([
    { type: 'straight', n: 7, amount: 100 },
    { type: 'straight', n: 7, amount: 200 },
    { type: 'red', amount: 500 },
  ]);
  assert.equal(merged.ok, true);
  assert.equal(merged.bets.length, 2);
  const straight7 = merged.bets.find((b) => b.type === 'straight' && b.n === 7);
  assert.equal(straight7.amount, 300);
  assert.equal(merged.total, 800);

  // Validation rejections
  assert.equal(validateRouletteBets([]).error, 'no_bets');
  assert.equal(validateRouletteBets([{ type: 'bad_type', amount: 100 }]).error, 'bad_type');
  assert.equal(validateRouletteBets([{ type: 'straight', n: 37, amount: 100 }]).error, 'bad_number');
  assert.equal(validateRouletteBets([{ type: 'dozen', n: 4, amount: 100 }]).error, 'bad_number');
  assert.equal(validateRouletteBets([{ type: 'red', amount: 0 }]).error, 'bad_amount');

  // Spot limit (5,000)
  assert.equal(validateRouletteBets([{ type: 'red', amount: 5001 }]).error, 'spot_limit');

  // Total limit (25,000)
  const tooMuch = Array.from({ length: 6 }, (_, i) => ({ type: 'straight', n: i, amount: 5000 }));
  assert.equal(validateRouletteBets(tooMuch).error, 'total_limit');

  // Spots limit (20 spots max)
  const tooMany = Array.from({ length: 21 }, (_, i) => ({ type: 'straight', n: i, amount: 100 }));
  assert.equal(validateRouletteBets(tooMany).error, 'too_many_spots');
});

test('service flow: create casino table solo -> bet during betting -> advance clock through phases -> gold escrowed then settled correctly', () => {
  const { svc, db, inbox, advance, close, onHandSettledCalls } = setup();
  svc.connect('nook');
  const soloRes = svc.handle('nook', { type: 'table_solo', mode: 'casino', casinoGame: 'pokdeng' });
  assert.equal(soloRes.ok, true);
  const t = [...svc.mgr.tables.values()][0];
  assert.ok(t);
  assert.equal(t.mode, 'casino');
  assert.equal(t.status, 'playing');
  assert.equal(t.casino.phase, 'betting');

  const initialGold = db.getProfile('nook').gold; // 50000

  // Place bet 500
  const betRes = svc.handle('nook', { type: 'casino_bet', tableId: t.id, amount: 500 });
  assert.equal(betRes.ok, true);
  assert.equal(db.getProfile('nook').gold, initialGold - 500, '500 gold escrowed at bet time');

  // Replace bet with 1000 (refund 500, escrow 1000)
  const replaceRes = svc.handle('nook', { type: 'casino_bet', tableId: t.id, amount: 1000 });
  assert.equal(replaceRes.ok, true);
  assert.equal(db.getProfile('nook').gold, initialGold - 1000, 'replaced bet escrows difference');

  // Advance to deal phase (4000 ms)
  advance(4000);
  svc.tick();
  assert.equal(t.casino.phase, 'deal');
  assert.ok(t.casino.seats[0].cards);
  assert.equal(t.casino.seats[0].cards.length, 2);

  // Verify dealer hole card is hidden in state
  const stateMsg = inbox.get('nook').filter((m) => m.type === 'casino_state').pop();
  assert.ok(stateMsg.dealer);
  assert.equal(stateMsg.dealer.cards[1].hidden, true, "dealer's 2nd card is hidden");

  // Advance to action phase (2000 ms)
  advance(2000);
  svc.tick();
  assert.equal(t.casino.phase, 'action');

  // If not Pok, player can hit or stay
  if (t.casino.seats[0].action == null) {
    const stayRes = svc.handle('nook', { type: 'casino_stay', tableId: t.id });
    assert.equal(stayRes.ok, true);
  }

  // Advance to dealer phase (4000 ms)
  advance(4000);
  svc.tick();
  assert.equal(t.casino.phase, 'dealer');

  // Check settlement
  const settle = t.casino.seats[0].settle;
  assert.ok(settle);
  const expectedGold = (initialGold - 1000) + settle.returned - Math.min(settle.extraLoss, initialGold - 1000);
  assert.equal(db.getProfile('nook').gold, expectedGold, 'wallet settled correctly');
  assert.equal(onHandSettledCalls.length, 1, 'onHandSettled called once');

  // Verify casino_result delivered
  const resMsg = inbox.get('nook').find((m) => m.type === 'casino_result');
  assert.ok(resMsg);
  assert.equal(resMsg.game, 'pokdeng');
  assert.ok(resMsg.dealer.cards.length >= 2);
  assert.equal(resMsg.dealer.cards[1].hidden, undefined, "dealer hole card revealed in result");
  close();
});

test('refund on leave during betting', () => {
  const { svc, db, close } = setup();
  svc.connect('nook');
  svc.handle('nook', { type: 'table_solo', mode: 'casino', casinoGame: 'pokdeng' });
  const t = [...svc.mgr.tables.values()][0];
  const startGold = db.getProfile('nook').gold;

  svc.handle('nook', { type: 'casino_bet', tableId: t.id, amount: 1000 });
  assert.equal(db.getProfile('nook').gold, startGold - 1000);

  // Leave during betting phase refunds escrowed gold
  svc.handle('nook', { type: 'casino_leave', tableId: t.id });
  assert.equal(db.getProfile('nook').gold, startGold, 'escrow refunded on leave during betting');
  close();
});

test('insufficient gold rejected', () => {
  const { svc, db, close } = setup();
  svc.connect('nook');
  db.getProfile('nook').gold = 200;
  svc.handle('nook', { type: 'table_solo', mode: 'casino', casinoGame: 'pokdeng' });
  const t = [...svc.mgr.tables.values()][0];

  const r = svc.handle('nook', { type: 'casino_bet', tableId: t.id, amount: 500 });
  assert.equal(r.ok, false);
  assert.equal(r.error, 'insufficient_gold');
  close();
});

test('wrong phase rejected', () => {
  const { svc, advance, close } = setup();
  svc.connect('nook');
  svc.handle('nook', { type: 'table_solo', mode: 'casino', casinoGame: 'pokdeng' });
  const t = [...svc.mgr.tables.values()][0];

  // Advance to deal phase
  advance(4000);
  svc.tick();
  assert.equal(t.casino.phase, 'deal');

  const r = svc.handle('nook', { type: 'casino_bet', tableId: t.id, amount: 500 });
  assert.equal(r.ok, false);
  assert.equal(r.error, 'wrong_phase');
  close();
});

test('chest daily cap respected (force rng)', () => {
  // Inject rng that returns 0.001 (always under chest chance)
  const { svc, db, advance, close } = setup({ rng: () => 0.001 });
  svc.connect('nook');
  svc.handle('nook', { type: 'table_solo', mode: 'casino', casinoGame: 'pokdeng' });
  const t = [...svc.mgr.tables.values()][0];
  const p = db.getProfile('nook');

  // Play 7 rounds (daily cap is 5)
  for (let round = 1; round <= 7; round++) {
    assert.equal(t.casino.phase, 'betting');
    svc.handle('nook', { type: 'casino_bet', tableId: t.id, amount: 500 });
    advance(4000); svc.tick(); // deal
    advance(2000); svc.tick(); // action
    advance(4000); svc.tick(); // dealer (settlement)
    advance(2000); svc.tick(); // loops to next betting
  }

  assert.equal(p.casino_daily.chests, CASINO.POKDENG.CHEST_DAILY_CAP, 'capped at CHEST_DAILY_CAP');
  assert.equal(p.bag_items?.random_dupe_box, 5);
  close();
});

test('roulette bigHit calls onBigHit', () => {
  // Seed 45 gives spinRoulette number: 1, with a strike on 1 at 100x
  const seedTarget = 45;
  const { svc, advance, close, onBigHitCalls } = setup({ rng: () => seedTarget / 2147483648 });
  svc.connect('nook');
  svc.handle('nook', { type: 'table_solo', mode: 'casino', casinoGame: 'roulette' });
  const t = [...svc.mgr.tables.values()][0];
  assert.equal(t.casino.game, 'roulette');
  assert.equal(t.casino.phase, 'betting');

  // Place straight bet on number 1
  const betRes = svc.handle('nook', {
    type: 'casino_roulette_bets',
    tableId: t.id,
    bets: [{ type: 'straight', n: 1, amount: 100 }],
  });
  assert.equal(betRes.ok, true);

  advance(8000); svc.tick(); // spin phase
  assert.equal(t.casino.phase, 'spin');

  advance(5000); svc.tick(); // result phase
  assert.equal(t.casino.phase, 'result');

  assert.equal(onBigHitCalls.length, 1, 'onBigHit called once');
  assert.equal(onBigHitCalls[0].winnerId, 'nook');
  assert.equal(onBigHitCalls[0].number, 1);
  assert.equal(onBigHitCalls[0].mult, 100);
  close();
});
