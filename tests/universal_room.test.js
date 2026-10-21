// tests/universal_room.test.js — Step 4 Universal 4-Seat Table Hub (node --test tests/)
import test from 'node:test';
import assert from 'node:assert/strict';
import { TableManager, ROOM, MODES, cutsceneMs } from '../shared/universal_room.js';

function harness({ onMatchEnd } = {}) {
  let t = 1_000_000;
  const clock = { now: () => t, advance: (ms) => { t += ms; } };
  let seed = 11;
  const mgr = new TableManager({
    now: clock.now,
    seedFn: () => seed++,
    playerInfo: (id) => ({ name: id.toUpperCase(), lineage: id === 'beam' ? 'dxb' : 'bkk', outfit: id === 'nook' ? 's11_zeus_olympus' : 's8_glacial_elsa', outfitRarity: 3, partnerId: id === 'nook' ? 'beam' : id === 'beam' ? 'nook' : null, stats: { fortune: 40, luck: 30, power: 30, swiftness: 20 } }),
    onMatchEnd,
  });
  const inbox = (uid) => mgr.out.filter((o) => Array.isArray(o.to) && o.to.includes(uid)).map((o) => o.msg);
  return { mgr, clock, inbox };
}

/** Run the room like a server: tick every 200 ms; humans act via `policy` when it's their move. */
function drive(mgr, clock, policy = () => null, maxMs = 3_600_000) {
  for (let ms = 0; ms < maxMs; ms += 200) {
    clock.advance(200);
    for (const t of mgr.tables.values()) {
      if (t.status !== 'playing') continue;
      const p = t.match.players[t.match.turn.seat];
      if (!p.isBot && clock.now() >= t.nextBotAt) { const a = policy(t, p); if (a) mgr.act(p.id, a); }
    }
    mgr.tick();
    if ([...mgr.tables.values()].every((t) => t.status !== 'playing')) return true;
  }
  return false;
}

test('modes: Monopoly + Casino + Moon Defense + Cloud Dash playable', () => {
  assert.equal(MODES.monopoly.available, true);
  assert.equal(MODES.casino.available, true);
  assert.equal(MODES.moon_bunny.available, true);
  assert.equal(MODES.cloud_dash.available, true);
  const { mgr } = harness();
  assert.notEqual(mgr.create('nook', { mode: 'cloud_dash' }).error, 'mode_locked');
});

test('lobby: create → host seat 1; friend sits; bot seats; only the host can start; friend must be ready', () => {
  const { mgr, inbox } = harness();
  mgr.connect('nook'); mgr.connect('beam');
  const { tableId } = mgr.create('nook');
  const t = mgr.tables.get(tableId);
  assert.equal(t.num, ROOM.FIRST_TABLE_NUM);
  assert.equal(t.seats[0].userId, 'nook');
  assert.ok(mgr.sit('beam', tableId, 1).ok);
  assert.equal(mgr.setBot('beam', 2, 'insane').error, 'host_only');
  assert.ok(mgr.setBot('nook', 2, 'insane').ok);
  assert.equal(mgr.start('beam').error, 'host_only');
  assert.equal(mgr.start('nook').error, 'not_ready');
  mgr.setReady('beam', true);
  assert.ok(mgr.start('nook').ok);
  assert.equal(t.status, 'playing');
  assert.equal(t.match.players.length, 3);
  assert.deepEqual(t.seatOf, { nook: 0, beam: 1 });
  assert.ok(inbox('beam').some((m) => m.type === 'table_state' && m.match));
  assert.equal(mgr.sit('leo', tableId).error, 'match_running');
});

test('public table list shows open friend tables (not private solo tables)', () => {
  const { mgr } = harness();
  mgr.create('nook');
  mgr.solo('beam');
  const list = mgr.list('monopoly');
  assert.equal(list.length, 1);
  assert.equal(list[0].hostId, 'nook');
  assert.ok(mgr.out.some((o) => o.to === 'lobby' && o.msg.type === 'table_list_update'));
});

test('sit without seatIdx claims the next chair, replacing a bot when the table is full of bots', () => {
  const { mgr } = harness();
  const { tableId } = mgr.create('nook');
  for (const k of [1, 2, 3]) mgr.setBot('nook', k, 'easy');
  const r = mgr.sit('beam', tableId);
  assert.equal(r.seatIdx, 1);
  assert.equal(mgr.tables.get(tableId).seats[1].userId, 'beam');
});

test('Play Solo Now: instant private match vs 3 bots; no AFK autopilot for the solo human', () => {
  const { mgr, clock } = harness();
  mgr.connect('nook');
  const r = mgr.solo('nook', { diff: 'insane' });
  assert.ok(r.ok);
  const t = mgr.tables.get(r.tableId);
  assert.equal(t.status, 'playing');
  assert.equal(t.match.turn.seat, 0, 'human seat 0 moves first');
  clock.advance(ROOM.TURN_MS * 5);
  mgr.tick();
  assert.equal(t.match.turn.seat, 0, 'solo player can take their time');
  assert.ok(mgr.act('nook', { type: 'roll' }).ok);
});

test('watchdog: an AFK human is auto-played by Hard AI after 12 s (auto flag set)', () => {
  const { mgr, clock, inbox } = harness();
  mgr.connect('nook'); mgr.connect('beam');
  const { tableId } = mgr.create('nook');
  mgr.sit('beam', tableId, 1); mgr.setReady('beam');
  mgr.start('nook');
  const t = mgr.tables.get(tableId);
  clock.advance(ROOM.TURN_MS - 1); mgr.tick();
  assert.equal(t.match.turn.n, 1, 'not yet');
  clock.advance(2); mgr.tick();
  const resolved = inbox('beam').filter((m) => m.type === 'mono_turn_resolved');
  assert.ok(resolved.length >= 1);
  assert.equal(resolved[0].auto, true);
});

test('disconnect mid-match → Hard bot plays that seat at once; reconnect re-attaches with a live snapshot', () => {
  const { mgr, clock, inbox } = harness();
  mgr.connect('nook'); mgr.connect('beam');
  const { tableId } = mgr.create('nook');
  mgr.sit('beam', tableId, 1); mgr.setReady('beam');
  mgr.start('nook');
  const t = mgr.tables.get(tableId);
  mgr.disconnect('nook');
  clock.advance(5000); mgr.tick();
  assert.ok(t.match.turn.n > 1 || t.match.phase !== 'await_roll', 'nook\'s turn did not freeze the room');
  mgr.flush();
  mgr.connect('nook');
  const snap = inbox('nook').find((m) => m.type === 'table_state');
  assert.ok(snap?.resumed && snap.match && snap.yourSeat === 0);
});

test('leaving mid-match hands the seat to a Hard bot; the table keeps going', () => {
  const { mgr, clock } = harness();
  mgr.connect('nook'); mgr.connect('beam');
  const { tableId } = mgr.create('nook');
  mgr.sit('beam', tableId, 1); mgr.setReady('beam');
  mgr.start('nook');
  mgr.leave('nook');
  const t = mgr.tables.get(tableId);
  assert.equal(t.hostId, 'beam');
  assert.equal(t.seats[0].kind, 'bot');
  assert.equal(t.match.players[0].isBot, true);
  assert.ok(drive(mgr, clock, () => null), 'idle beam is carried by the 12 s watchdog to the end');
});

test('2-Agent QA gate: nook + beam + 2 bots play a full 24-tile match to the Victory Podium', () => {
  const ends = [];
  const { mgr, clock, inbox } = harness({ onMatchEnd: (t, result) => { ends.push(result); return { nook: { gold: 1500 }, beam: { gold: 1000 } }; } });
  mgr.connect('nook'); mgr.connect('beam');
  const { tableId } = mgr.create('nook');
  mgr.sit('beam', tableId, 1); mgr.setReady('beam');
  mgr.setBot('nook', 2, 'hard'); mgr.setBot('nook', 3, 'insane');
  mgr.start('nook');
  const policy = (t, p) => {
    const la = t.match.pending;
    if (la && la.seat === p.seat) return { type: 'decide', choice: la.canSkip ? la.options[0].id : la.options.find((o) => !o.disabled).id };
    if (p.ult >= 100 && !t.match.turn.ultUsed) return { type: 'ultimate' };
    return { type: 'roll', use2d6: p.boost > 0 && t.match.round % 2 === 0 };
  };
  assert.ok(drive(mgr, clock, policy), 'match finished');
  const t = mgr.tables.get(tableId);
  assert.equal(t.status, 'ended');
  assert.equal(ends.length, 1);
  for (const uid of ['nook', 'beam']) {
    const pod = inbox(uid).find((m) => m.type === 'match_victory_podium');
    assert.ok(pod, `${uid} saw the podium`);
    assert.equal(pod.result.ranking.length, 4);
    assert.ok(pod.rewards.gold > 0);
  }
  const resolved = inbox('nook').filter((m) => m.type === 'mono_turn_resolved');
  const evts = resolved.flatMap((m) => m.events);
  assert.ok(evts.some((e) => e.t === 'dice' && e.boosted), '⚡2d6 boost exercised');
  assert.ok(evts.some((e) => e.t === 'ult'), 'ultimates exercised');
  // seq numbers strictly increase → clients can detect gaps after reconnect
  const seqs = evts.map((e) => e.seq);
  assert.deepEqual(seqs, [...seqs].sort((a, b) => a - b));
  // Play Again keeps the 4-seat table
  assert.ok(mgr.rematch('nook').ok);
  assert.equal(t.status, 'lobby');
  assert.equal(t.seats.filter((s) => s.kind !== 'empty').length, 4);
});

test('handle(): message routing incl. mono_buy default choice and bad types', () => {
  const { mgr } = harness();
  mgr.connect('nook');
  assert.ok(mgr.handle('nook', { type: 'table_solo' }).ok);
  assert.equal(mgr.handle('nook', { type: 'nope' }).ok, false);
  const t = [...mgr.tables.values()][0];
  t.match.players[0].status = { fixedRoll: 1, turnsLeft: 1 };
  mgr.handle('nook', { type: 'mono_roll' });
  assert.equal(t.match.pending?.kind, 'buy');
  mgr.handle('nook', { type: 'mono_buy' });
  assert.equal(t.match.tiles[1].owner, 0);
});

test('cutsceneMs paces bots after animations and is bounded', () => {
  assert.equal(cutsceneMs([]), 0);
  assert.ok(cutsceneMs([{ t: 'dice' }, { t: 'move', path: [1, 2, 3] }]) >= 900 + 3 * 200);
  assert.ok(cutsceneMs(Array.from({ length: 500 }, () => ({ t: 'ult' }))) <= 12_000);
});

test('tables with no connected humans are closed after the reconnect grace period', () => {
  const { mgr, clock } = harness();
  mgr.connect('nook'); mgr.connect('beam');
  const { tableId } = mgr.create('nook');
  mgr.sit('beam', tableId, 1); mgr.setReady('beam'); mgr.start('nook');
  mgr.disconnect('nook'); mgr.disconnect('beam');
  mgr.tick();
  clock.advance(ROOM.RECONNECT_GRACE_MS + 1000); mgr.tick();
  assert.equal(mgr.tables.has(tableId), false);
  assert.equal(mgr.byUser.has('nook'), false);
});

test('solo match survives brief socket disconnect on final round and re-delivers podium on reconnect', () => {
  const { mgr, clock, inbox } = harness({ onMatchEnd: () => ({ nook: { gold: 1800, diamonds: 220 } }) });
  mgr.connect('nook');
  const { tableId } = mgr.solo('nook', { diff: 'hard' });
  const t = mgr.tables.get(tableId);
  // Fast-forward to final round, seat 3 (Bot Mina) awaiting buy decision on Akiba
  t.match.round = t.match.maxRounds;
  t.match.turn = { seat: 3, n: 60, rolled: true, ultUsed: false, petCastUsed: false };
  t.match.pending = { kind: 'buy', seat: 3, tile: 2, price: 240, canSkip: true, options: [{ id: 'buy', label: 'Buy' }, { id: 'skip', label: 'Skip' }] };
  // Brief socket drop right before Bot Mina's buy decision runs
  mgr.disconnect('nook');
  assert.equal(mgr.tables.has(tableId), true, 'solo table must NOT be deleted on brief disconnect');
  clock.advance(5000);
  mgr.tick();
  assert.equal(t.status, 'ended', 'Bot Mina completes final turn and match ends');
  mgr.flush();
  // Browser reconnects within grace period
  mgr.connect('nook');
  const msgs = inbox('nook');
  assert.ok(msgs.some((m) => m.type === 'table_state' && m.resumed && m.table.status === 'ended'));
  const pod = msgs.find((m) => m.type === 'match_victory_podium');
  assert.ok(pod, 'podium is re-sent upon reconnect');
  assert.equal(pod.rewards?.gold, 1800);
});

test('regression: Round 13 Bot Mina turn never stalls on reconnect or malformed pending', () => {
  const { mgr, clock, inbox } = harness();
  mgr.connect('nook');
  const { tableId } = mgr.solo('nook', { diff: 'hard' });
  const t = mgr.tables.get(tableId);
  t.match.round = 13;
  t.match.turn = { seat: 3, n: 52, rolled: false, ultUsed: false };
  t.match.players[3].ult = 100;
  t.match.players[3].petUlt = 100;
  t.nextBotAt = clock.now() + 9000;
  // Simulate reconnect during Bot Mina's turn on Round 13
  mgr.disconnect('nook');
  mgr.connect('nook');
  assert.ok(t.nextBotAt <= clock.now() + 500, 'connect() schedules Bot Mina promptly within 450ms');
  clock.advance(500);
  mgr.tick(); // Bot Mina casts Ultimate + Pet Soul-Link Combo
  clock.advance(4000);
  mgr.tick(); // Bot Mina rolls
  if (t.match.pending && t.match.turn.seat === 3) {
    clock.advance(2000);
    mgr.tick(); // Bot Mina decides
  }
  assert.equal(t.match.turn.seat, 0, 'turn cleanly advances from Bot Mina (seat 3) to Nook (seat 0) on Round 14');
  assert.equal(t.match.round, 14);
  const resolved = inbox('nook').filter((m) => m.type === 'mono_turn_resolved');
  assert.ok(resolved.length >= 2, 'client received Bot Mina ultimate and roll batches');
});

test('solo Play Again (table_rematch): starts a fresh 20-round match with a new seed and plays to a second podium', () => {
  const ends = [];
  const { mgr, clock, inbox } = harness({ onMatchEnd: (t, result) => { ends.push(result); return { nook: { gold: 2400 } }; } });
  mgr.connect('nook');
  const { tableId } = mgr.solo('nook', { diff: 'hard' });
  const t = mgr.tables.get(tableId);
  const firstSeed = t.match.seed;
  const policy = (tbl, p) => {
    const la = tbl.match.pending;
    if (la && la.seat === p.seat) return { type: 'decide', choice: la.canSkip ? la.options[0].id : la.options.find((o) => !o.disabled).id };
    if (p.ult >= 100 && !tbl.match.turn.ultUsed) return { type: 'ultimate' };
    return { type: 'roll', use2d6: p.boost > 0 };
  };
  assert.ok(drive(mgr, clock, policy), 'Match #1 finished');
  assert.equal(t.status, 'ended');
  assert.equal(ends.length, 1);
  mgr.flush();

  // Click Play Again (table_rematch) in solo mode
  assert.ok(mgr.handle('nook', { type: 'table_rematch' }).ok);
  assert.equal(t.status, 'playing', 'Solo rematch immediately starts Match #2');
  assert.equal(t.match.round, 1);
  assert.equal(t.match.ended, false);
  assert.notEqual(t.match.seed, firstSeed, 'Match #2 gets a fresh RNG seed');
  assert.ok(inbox('nook').some((m) => m.type === 'table_state' && m.match && m.match.seed === t.match.seed && !m.match.ended));

  assert.ok(drive(mgr, clock, policy), 'Match #2 finished');
  assert.equal(t.status, 'ended');
  assert.equal(ends.length, 2, 'Both Match #1 and Match #2 reached the Victory Podium');
});

test('table_set_option switches mode in-place across all 4 modes while preserving guests and bots', () => {
  const { mgr } = harness();
  mgr.connect('nook');
  mgr.connect('beam');
  const { tableId } = mgr.create('nook', { mode: 'monopoly' });
  mgr.sit('beam', tableId, 1);
  mgr.setBot('nook', 2, 'hard');
  const t = mgr.tables.get(tableId);
  assert.equal(t.mode, 'monopoly');
  assert.equal(t.seats[1].ready, false);

  // Switch to Moon Defense via handle('table_set_option')
  assert.ok(mgr.handle('nook', { type: 'table_set_option', mode: 'moon_bunny' }).ok);
  assert.equal(t.mode, 'moon_bunny');
  assert.equal(t.seats[1].ready, true, 'non-monopoly modes auto-ready human guests');
  assert.equal(t.seats[2].kind, 'bot', 'configured bot in seat 3 is preserved');

  // Switch to Grand Casino Roulette
  assert.ok(mgr.handle('nook', { type: 'table_set_option', mode: 'casino', casinoGame: 'roulette' }).ok);
  assert.equal(t.mode, 'casino');
  assert.equal(t.options.casinoGame, 'roulette');

  // Switch to Cloud Dash Chaos
  assert.ok(mgr.handle('nook', { type: 'table_set_option', mode: 'cloud_dash', dashMode: 'chaos' }).ok);
  assert.equal(t.mode, 'cloud_dash');
  assert.equal(t.options.dashMode, 'chaos');
});

test('lobby disconnect preserves seat with connected=false and reconnects cleanly within grace window', () => {
  const { mgr, clock } = harness();
  mgr.connect('nook');
  mgr.connect('beam');
  const { tableId } = mgr.create('nook', { mode: 'monopoly' });
  mgr.sit('beam', tableId, 1);
  const t = mgr.tables.get(tableId);

  // Brief disconnect of guest in lobby
  mgr.disconnect('beam');
  assert.equal(mgr.byUser.get('beam'), tableId, 'guest remains seated during brief disconnect');
  const pubOffline = mgr.publicTable(t);
  assert.equal(pubOffline.seats[1].connected, false, 'seat is marked offline for UI badge');

  // Reconnect 3s later
  clock.advance(3000);
  mgr.tick();
  mgr.connect('beam');
  const pubOnline = mgr.publicTable(t);
  assert.equal(pubOnline.seats[1].connected, true, 'seat is back online after reconnect');

  // If guest disconnects for >15s while host is waiting in lobby, stale lobby seat is cleaned up
  mgr.disconnect('beam');
  clock.advance(16_000);
  mgr.tick();
  assert.equal(mgr.byUser.has('beam'), false, 'stale disconnected guest is removed after 15s');
  assert.equal(t.seats[1].kind, 'empty');
});
