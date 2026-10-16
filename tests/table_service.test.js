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

