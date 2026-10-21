// tests/table_service.test.js — Step 4 server table service (podium payouts, delivery, daily caps)
import test from 'node:test';
import assert from 'node:assert/strict';
import { createTableService, podiumMultiplier, isTableMessage } from '../server/table_service.js';

function fakeDb() {
  const profiles = new Map();
  for (const id of ['nook', 'beam']) profiles.set(id, { id, username: id, lineage: 'bkk', level: 5, exp: 0, gold: 1000, berries: 100, diamonds: 0, equipped: { outfit: { id: 'newbie_outfit', refine: 0 } }, village: { levels: { patisserie: 10 } } });
  return { profiles, getProfile: (id) => profiles.get(id), markProfile() {} };
}

function setup(rng = () => 0.99) {
  let t = 1_760_000_000_000;
  const inbox = new Map();
  const db = fakeDb();
  const svc = createTableService({
    db, rng, now: () => t, log: {}, tickMs: 1e9,
    sendTo: (id, msg) => { if (!inbox.has(id)) inbox.set(id, []); inbox.get(id).push(msg); },
    onlineIds: () => ['nook', 'beam'],
    catalogs: { outfits: { newbie_outfit: { rarity: 1, stats: { all: 2 } } }, patisseriePct: (lv) => lv * 2 },
  });
  return { svc, db, inbox, advance: (ms) => { t += ms; }, close: () => svc.close() };
}

test('message filter covers every table_* / mono_* type and nothing else', () => {
  for (const k of ['table_create', 'table_solo', 'mono_roll', 'mono_ult', 'mono_event_choice']) assert.ok(isTableMessage(k));
  for (const k of ['move_step', 'gacha_pull', 'village_harvest_all']) assert.ok(!isTableMessage(k));
});

test('podium multiplier = 1 + Patisserie % + Fortune %, capped at 3.0x', () => {
  assert.equal(podiumMultiplier({ village: { levels: { patisserie: 10 } } }, { stats: { fortune: 40 } }, { patisseriePct: () => 20 }), 1.6);
  assert.equal(podiumMultiplier({}, { stats: { fortune: 9999 } }), 3);
});

test('full solo match on the server pays the podium once and pushes it to the player', () => {
  const { svc, db, inbox, advance, close } = setup();
  svc.connect('nook');
  svc.handle('nook', { type: 'table_solo', diff: 'insane' });
  const t = [...svc.mgr.tables.values()][0];
  for (let k = 0; k < 20000 && t.status === 'playing'; k++) {
    advance(13_000);
    const m = t.match;
    if (m.players[m.turn.seat].id === 'nook') {
      const pd = m.pending;
      if (pd) svc.handle('nook', { type: 'mono_event_choice', choice: pd.canSkip ? 'skip' : pd.options.find((o) => !o.disabled).id });
      else svc.handle('nook', { type: 'mono_roll' });
    } else svc.tick();
  }
  assert.equal(t.status, 'ended');
  const pod = inbox.get('nook').find((m) => m.type === 'match_victory_podium');
  assert.ok(pod?.rewards, 'rewards delivered');
  const p = db.getProfile('nook');
  assert.equal(p.gold, 1000 + pod.rewards.gold);
  assert.ok(pod.rewards.multiplier >= 1.2);
  assert.equal(p.mono_stats.played, 1);
  assert.equal(pod.rewards.dailyBonusDiamonds, 150, 'first match of the day +150 💎');
  assert.equal(pod.rewards.ticketBonus, 1, 'first match of the day +1 ticket');
  assert.equal(p.bag_items?.ticket_standard, 1);
  close();
});

test('daily diamonds: 1st match +150 💎 + podium scaled by TableScale, capped at 6 payouts/day', () => {
  const { svc, db, close } = setup();
  // 1P vs 1 Insane Bot → SeatFactor(2)=0.60 * avg(1.25, 1.20)=1.225 => TableScale = 0.735 => Rank 1 podium = round(100 * 0.735) = 74 💎
  const table = { id: 't1', match: { players: [{ seat: 0, id: 'nook', isBot: false }, { seat: 1, id: 'b', isBot: true, botDiff: 'insane' }] } };
  const result = { reason: 'rounds', winner: 0, ranking: [{ seat: 0, rank: 1, boardDiamonds: 10 }, { seat: 1, rank: 2, boardDiamonds: 0 }] };
  const got = [];
  for (let k = 0; k < 8; k++) got.push(svc._payout(table, result).nook.diamonds);
  // Match 1: 74 (podium) + 150 (first match) + 10 (board) = 234 💎
  // Matches 2..6: 74 (podium) + 10 (board) = 84 💎
  // Matches 7..8: 0 💎 (capped at 6/day)
  assert.deepEqual(got, [234, 84, 84, 84, 84, 84, 0, 0]);
  assert.equal(db.getProfile('nook').mono_daily.payouts, 6);
  close();
});

test('lobby broadcasts reach every online player', () => {
  const { svc, inbox, close } = setup();
  svc.connect('nook'); svc.connect('beam');
  svc.handle('nook', { type: 'table_create' });
  assert.ok(inbox.get('beam').some((m) => m.type === 'table_list_update' && m.tables.length === 1));
  close();
});

test('podium payload contract: every field read by hud.showPodium is present with valid type', () => {
  const { svc, db, close } = setup(() => 0.01); // low rng so chest triggers
  db.getProfile('nook').exp = 99999; // trigger level up if applicable
  const table = { id: 't_contract', mode: 'public', matchMode: 'normal', match: { players: [{ seat: 0, id: 'nook', isBot: false }, { seat: 1, id: 'b', isBot: true, botDiff: 'hard' }] } };
  const result = { reason: 'rounds', winner: 0, ranking: [{ seat: 0, rank: 1, boardDiamonds: 25 }, { seat: 1, rank: 2, boardDiamonds: 0 }] };
  const rw = svc._payout(table, result).nook;
  const requiredNumberKeys = [
    'gold', 'berries', 'diamonds', 'podiumDiamonds', 'dailyBonusDiamonds',
    'boardDiamonds', 'ticketBonus', 'multiplier', 'tableScale',
    'exp', 'levelsGained', 'levelUpDiamonds',
  ];
  for (const k of requiredNumberKeys) {
    assert.equal(typeof rw[k], 'number', `rw.${k} must be a number`);
    assert.ok(Number.isFinite(rw[k]), `rw.${k} must be finite`);
  }
  assert.equal(typeof rw.coupleBonus, 'boolean');
  assert.equal(typeof rw.chaos, 'boolean');
  assert.equal(rw.chest, true, 'chest rolled true at rng=0.01');
  assert.ok(['ticket_standard', 'random_dupe_box'].includes(rw.chestReward), 'chestReward is a valid chest item id');
  close();
});

test('Chaos Party payout: 0.5x diamonds and does NOT count toward the 6/day diamond cap', () => {
  const { svc, db, close } = setup();
  const table = { id: 't_chaos', matchMode: 'chaos', match: { chaos: true, players: [{ seat: 0, id: 'nook', isBot: false }, { seat: 1, id: 'b', isBot: true, botDiff: 'insane' }] } };
  const result = { reason: 'rounds', winner: 0, ranking: [{ seat: 0, rank: 1, boardDiamonds: 20 }, { seat: 1, rank: 2, boardDiamonds: 0 }] };
  const rw1 = svc._payout(table, result).nook;
  assert.equal(rw1.chaos, true);
  assert.ok(rw1.diamonds > 0, 'Chaos awards 0.5x diamonds');
  assert.equal(db.getProfile('nook').mono_daily.payouts, 0, 'Chaos match did NOT consume daily cap');
  // Even after 6 capped normal matches, Chaos still awards its 0.5x diamonds
  db.getProfile('nook').mono_daily.payouts = 6;
  const rw2 = svc._payout(table, result).nook;
  assert.ok(rw2.diamonds > 0, 'Chaos still awards diamonds after daily cap');
  close();
});

test('mono_pet_toggle_auto persists mono_pet_auto on the player profile', () => {
  const { svc, db, close } = setup();
  for (const k of ['mono_pet_cast', 'mono_pet_arm', 'mono_pet_toggle_auto', 'table_set_option']) {
    assert.ok(isTableMessage(k), `${k} is routed to table_service`);
  }
  db.getProfile('nook').equipped.pet = { id: 'pet_nyx', bond_lv: 5, costume_id: 's1_naga_sovereign' };
  svc.connect('nook');
  svc.handle('nook', { type: 'table_solo', diff: 'hard', matchMode: 'chaos' });
  const t = [...svc.mgr.tables.values()][0];
  assert.equal(t.match.chaos, true, 'solo table launched in Chaos mode');
  svc.handle('nook', { type: 'mono_pet_toggle_auto', auto: false });
  assert.equal(db.getProfile('nook').mono_pet_auto, false);
  assert.equal(t.match.players[0].petAuto, false);
  close();
});

test('Cloud Dash: brief disconnect & reconnect preserves human control, rewards, and supports non-solo rematch', () => {
  let rStep = 0.12;
  const { svc, db, advance, close } = setup(() => { rStep = (rStep + 0.23) % 0.99; return rStep; });
  svc.connect('nook');
  svc.handle('nook', { type: 'table_create', mode: 'cloud_dash', dashMode: 'quick' });
  const t = [...svc.mgr.tables.values()][0];
  svc.handle('nook', { type: 'table_set_bot', seatIdx: 1, diff: 'hard' });
  svc.handle('nook', { type: 'table_start' });
  assert.equal(t.status, 'playing');

  // Advance past countdown into active race
  advance(4000);
  svc.tick();
  assert.equal(t.cloudDash.status, 'playing');

  // Simulate socket drop mid-race
  svc.disconnect('nook');
  const racer = t.cloudDash.racers.find((r) => r.id === 'nook');
  assert.equal(racer.isBot, false, 'temporary disconnect must NOT permanently convert human racer into a bot');
  assert.equal(racer.disconnected, true, 'racer is marked temporarily disconnected');

  // Tick while disconnected -> autopilot advances runner along track
  advance(1000);
  svc.tick();
  assert.ok(racer.r.s > 0, 'autopilot keeps disconnected racer moving');

  // Reconnect and send cd_report -> accepted!
  svc.connect('nook');
  assert.equal(racer.disconnected, false, 'reconnect clears disconnected flag');
  const rep = svc.handle('nook', {
    type: 'cd_report',
    tableId: t.id,
    t: 2.0,
    s: racer.r.s + 5,
    l: 0,
    y: 0,
    v: 18,
    style: 120,
    coins: 5,
  });
  assert.equal(rep.ok, true, 'reconnected human can report race progress');

  // Finish race and verify rewards are paid to reconnected human
  const goldBefore = db.getProfile('nook').gold;
  racer.r.s = 1000;
  racer.r.finished = true;
  racer.r.finishT = 28.5;
  svc.tick(); // registers firstFinishT and sets dnfAt
  advance(15_000);
  svc.tick(); // completes race after DNF countdown
  assert.equal(t.status, 'ended');
  assert.ok(t.cloudDash.rewards?.nook, 'reconnected human receives end-of-race rewards');
  assert.ok(db.getProfile('nook').gold > goldBefore, 'gold credited to profile');

  // Non-solo Cloud Dash rematch ("Run It Back") immediately restarts the race!
  const prevSeed = t.cloudDash.seed;
  assert.ok(svc.handle('nook', { type: 'table_rematch' }).ok);
  assert.equal(t.status, 'playing', 'rematch immediately starts next Cloud Dash race');
  assert.notEqual(t.cloudDash.seed, prevSeed);
  close();
});

test('Moon Defense: brief disconnect & reconnect preserves human defender, and rematch restarts siege', () => {
  const { svc, advance, close } = setup();
  svc.connect('nook');
  svc.handle('nook', { type: 'table_create', mode: 'moon_bunny' });
  const t = [...svc.mgr.tables.values()][0];
  svc.handle('nook', { type: 'table_start' });
  assert.equal(t.status, 'playing');

  // Disconnect mid-siege
  svc.disconnect('nook');
  const p = t.moonDefense.players.find((x) => x.id === 'nook');
  assert.equal(p.isBot, false, 'temporary disconnect must NOT convert defender to bot');
  assert.equal(p.disconnected, true);

  // Reconnect
  svc.connect('nook');
  assert.equal(p.disconnected, false);
  assert.equal(p.isBot, false);
  assert.ok(svc.handle('nook', { type: 'mb_move', tableId: t.id, x: 1.5, z: 2.0 }).ok);

  // End siege and trigger table_rematch -> immediately starts new siege
  t.moonDefense.bunnyHp = 0;
  advance(500);
  svc.tick();
  assert.equal(t.status, 'ended');
  assert.ok(svc.handle('nook', { type: 'table_rematch' }).ok);
  assert.equal(t.status, 'playing', 'Moon Defense rematch immediately restarts siege');
  assert.equal(t.moonDefense.bunnyHp, t.moonDefense.bunnyMaxHp);
  close();
});

test('Grand Casino: lobby join replaces bot, blocks new joins once started, and brief disconnect preserves seat for rejoin', () => {
  const { svc, close } = setup();
  svc.connect('nook');
  svc.connect('beam');
  svc.handle('nook', { type: 'table_create', mode: 'casino', casinoGame: 'pokdeng' });
  const t = [...svc.mgr.tables.values()][0];
  for (const k of [1, 2, 3]) svc.handle('nook', { type: 'table_set_bot', seatIdx: k, diff: 'hard' });

  // beam joins in lobby -> replaces bot in seat 1
  const sitLobby = svc.handle('beam', { type: 'table_sit', tableId: t.id });
  assert.equal(sitLobby.ok, true);
  assert.equal(sitLobby.seatIdx, 1);

  svc.handle('nook', { type: 'table_start' });
  assert.equal(t.status, 'playing');

  // Once started, a new outsider ('leo') cannot join the running match
  const sitRunning = svc.handle('leo', { type: 'table_sit', tableId: t.id });
  assert.equal(sitRunning.ok, false);
  assert.equal(sitRunning.error, 'match_running');

  // Brief disconnect of beam does NOT null out beam's seat in t.casino.seats, and beam can rejoin & bet
  svc.disconnect('beam');
  assert.equal(t.casino.seats[1].userId, 'beam', 'brief disconnect preserves Casino seat');
  svc.connect('beam');
  const betRes = svc.handle('beam', { type: 'casino_bet', tableId: t.id, amount: 100 });
  assert.equal(betRes.ok, true, 'rejoined player can immediately bet in current round');
  close();
});
