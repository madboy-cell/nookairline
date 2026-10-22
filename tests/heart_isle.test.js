// tests/heart_isle.test.js — Couples: Heart Isle service, mailbox, break/restore lifecycle, 3-island layout, WS.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { WebSocket } from 'ws';

import { createHeartIsleService } from '../server/heart_isle_service.js';
import { createDailyService } from '../server/daily_service.js';
import { createStarterProfile, seedProfiles } from '../server/profile_factory.js';
import { storesOf } from '../server/economy_service.js';
import { heartIsleId } from '../shared/couple_rules.js';
import {
  instanceLayout, buildCellIndex, groundAt, isWalkablePos, findWalkPath, isSegmentWalkable, onBridge, spawnPoint,
  heartReserved, HEART_FIXED, islandAt,
} from '../shared/village_rules.js';
import { startServer } from '../server/server.js';

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 9, 1, 12);

function mockDb(profiles) {
  const map = new Map(profiles.map((p) => [p.id, p]));
  const zones = new Map();
  return {
    profiles: map,
    getProfile: (id) => map.get(String(id).toLowerCase()),
    markProfile: () => {},
    getWorldZone: (id) => zones.get(id) || null,
    putWorldZone: (id, kind, state) => { zones.set(id, { zone_id: id, kind, state }); return zones.get(id); },
    zones,
  };
}

function couplePair(nowMs) {
  const a = createStarterProfile('alice', 'pw12', 'bkk');
  const b = createStarterProfile('bob', 'pw12', 'dxb');
  a.partner_id = 'bob'; b.partner_id = 'alice';
  a.couple_since = nowMs; b.couple_since = nowMs;
  a.friends = ['bob']; b.friends = ['alice'];
  storesOf(a).warehouse.items.wood = 40;
  storesOf(a).warehouse.items.stone = 20;
  storesOf(a).warehouse.items.boss_core_moss = 2;
  return [a, b];
}

function setup() {
  let t = T0;
  const clock = { now: () => t, advance: (ms) => { t += ms; } };
  const [a, b] = couplePair(t);
  const db = mockDb([a, b]);
  const changed = [];
  const hi = createHeartIsleService({ db, now: clock.now, onIsleChanged: (isle) => changed.push(isle.id) });
  const daily = createDailyService({ db, now: clock.now, coupleHooks: hi });
  return { a, b, db, hi, daily, clock, changed };
}

test('heart isle: get-or-create, place/remove with overlap + reserved rejection', () => {
  const { a, b, db, hi, changed } = setup();
  const st = hi.handle(a, { type: 'hi_state' });
  assert.equal(st.ok, true);
  assert.equal(st.coupled, true);
  assert.equal(st.isle.id, heartIsleId('alice', 'bob'));
  assert.deepEqual(st.isle.owners, ['alice', 'bob']);
  assert.ok(db.zones.get(heartIsleId('alice', 'bob')), 'persisted as a world zone');
  assert.equal(db.zones.get(heartIsleId('alice', 'bob')).kind, 'heart_isle');

  const p1 = hi.handle(a, { type: 'hi_place', decor: 'wisteria_pergola', x: 2, y: 2 });
  assert.equal(p1.ok, true, JSON.stringify(p1));
  assert.equal(hi.handle(b, { type: 'hi_place', decor: 'rose_hedge', x: 3, y: 3 }).error, 'overlap');
  assert.equal(hi.handle(b, { type: 'hi_place', decor: 'rose_hedge', x: 5, y: 12 }).error, 'reserved', 'deck path stays clear');
  const pav = HEART_FIXED[0];
  assert.equal(hi.handle(b, { type: 'hi_place', decor: 'rose_hedge', x: pav.x, y: pav.y }).error, 'reserved', 'pavilion cell');
  assert.equal(hi.handle(b, { type: 'hi_place', decor: 'not_a_decor', x: 1, y: 1 }).error, 'invalid_type');
  assert.equal(hi.handle(b, { type: 'hi_place', decor: 'rose_hedge', x: 19, y: 19 }).ok, true);
  assert.equal(hi.place(b, { type: 'couple_bench', x: 1, y: 17 }).ok, true, 'direct call may pass `type`');
  assert.equal(hi.handle(a, { type: 'hi_state' }).isle.decor.length, 3);

  const rm = hi.handle(b, { type: 'hi_remove', id: p1.decor.id });
  assert.equal(rm.ok, true);
  assert.equal(hi.handle(a, { type: 'hi_remove', id: 'nope' }).error, 'not_found');
  assert.ok(changed.length >= 4, 'layout rebuild hook fired');
});

test('heart isle: Couple Ferris Wheel (heart-isle-only monument) moves onto the isle; 4×4 overlap enforced', () => {
  let t = T0;
  const [a, b] = couplePair(t);
  a.village.wonders = { ...(a.village.wonders || {}), wnd_ferris: { stars: 1 } };
  a.village.buildings.push({ uid: 'wnd_ferris_seed', type: 'wnd_ferris', x: 11, y: 13, rot: 0 });
  const db = mockDb([a, b]);
  const hi = createHeartIsleService({ db, now: () => t });
  const st = hi.handle(b, { type: 'hi_state' });
  const ferris = st.isle.decor.find((d) => d.type === 'wnd_ferris');
  assert.ok(ferris, 'auto-placed on the new isle');
  assert.equal(a.village.buildings.some((x) => x.type === 'wnd_ferris'), false, 'removed from the personal island');
  assert.equal(hi.handle(b, { type: 'hi_place', decor: 'rose_hedge', x: ferris.x + 3, y: ferris.y + 3 }).error, 'overlap');
  assert.equal(hi.handle(b, { type: 'hi_place', decor: 'wnd_ferris', x: 1, y: 1 }).error, 'already_placed');
  assert.equal(hi.handle(a, { type: 'hi_remove', id: ferris.id }).ok, true);
  assert.equal(hi.handle(b, { type: 'hi_place', decor: 'wnd_ferris', x: 1, y: 1 }).ok, true, 'either partner may place an owned monument');
  const L = instanceLayout([{ owner: 'alice', village: a.village }, { owner: 'bob', village: b.village }], { heart: hi.load('alice', 'bob') });
  const H = L.islands.find((i) => i.kind === 'heart');
  buildCellIndex(H);
  assert.equal(groundAt(L, H.cx - 10 + 4.5, -10 + 4.5).walkable, false, 'ferris footprint is solid (4×4)');

  const [nook, neen] = seedProfiles();
  for (const p of [nook, neen]) assert.equal(p.village.buildings.some((x) => x.type === 'wnd_ferris'), false, `${p.id} seed keeps ferris off the personal island`);
});

test('heart isle: deposit / withdraw through the warehouse + ledger', () => {
  const { a, b, hi } = setup();
  assert.equal(hi.handle(a, { type: 'hi_deposit', items: { wood: 999 } }).error, 'missing_materials');
  assert.equal(hi.handle(a, { type: 'hi_deposit', items: { wood: -1 } }).error, 'bad_items');
  const d = hi.handle(a, { type: 'hi_deposit', items: { wood: 30, stone: 10 } });
  assert.equal(d.ok, true);
  assert.equal(storesOf(a).warehouse.items.wood, 10);
  assert.deepEqual(d.isle.storage, { wood: 30, stone: 10 });
  assert.equal(d.isle.ledger.alice.wood, 30);

  const w = hi.handle(b, { type: 'hi_withdraw', items: { wood: 12 } });
  assert.equal(w.ok, true);
  assert.equal(storesOf(b).warehouse.items.wood, 12);
  assert.equal(w.isle.storage.wood, 18);
  assert.equal(hi.handle(b, { type: 'hi_withdraw', items: { wood: 100 } }).error, 'insufficient_items');
});

test('couple mailbox: ramped daily cap, gold + rare rejected, per-day counter resets', () => {
  const { a, b, hi, clock } = setup();
  assert.equal(hi.handle(a, { type: 'couple_send', items: { boss_core_moss: 1 } }).error, 'not_sendable');
  assert.equal(hi.handle(a, { type: 'couple_send', items: { gold: 10 } }).error, 'not_sendable');
  const s1 = hi.handle(a, { type: 'couple_send', items: { wood: 30 } });
  assert.equal(s1.ok, true);
  assert.equal(storesOf(b).warehouse.items.wood, 30);
  assert.equal(storesOf(a).warehouse.items.wood, 10);
  assert.deepEqual([a.couple_mail.sent, s1.mail.cap, s1.mail.remaining], [30, 50, 20]);
  const s2 = hi.handle(a, { type: 'couple_send', items: { stone: 20, wood: 5 } });
  assert.equal(s2.error, 'cap', 'day-0 cap is 50 units');
  assert.equal(hi.handle(a, { type: 'couple_send', items: { stone: 20 } }).ok, true);

  clock.advance(DAY);            // day 1 → cap 100, counter resets
  storesOf(a).warehouse.items.stone = 90;
  assert.equal(hi.handle(a, { type: 'couple_send', items: { stone: 90 } }).ok, true);
  assert.equal(hi.mailInfo(a).cap, 100);
  clock.advance(7 * DAY);        // day ≥ 7 → unlimited
  assert.equal(hi.mailInfo(a).cap, null);

  const solo = createStarterProfile('solo', 'pw12', 'bkk');
  assert.equal(hi.handle(solo, { type: 'couple_send', items: { wood: 1 } }).error, 'not_coupled');
});

test('couple break: split shares into stores, Memory Isle frozen + visible, 72 h cooldown, same ex restores', () => {
  const { a, b, db, hi, daily, clock } = setup();
  hi.handle(a, { type: 'hi_place', decor: 'heart_arch', x: 4, y: 4 });
  hi.handle(a, { type: 'hi_deposit', items: { wood: 30 } });
  storesOf(b).warehouse.items.stone = 10;
  hi.handle(b, { type: 'hi_deposit', items: { stone: 10 } });

  const brk = daily.coupleBreak(a);
  assert.equal(brk.ok, true);
  assert.equal(brk.heartIsle.frozen, true);
  assert.equal(storesOf(a).warehouse.items.wood, 40, 'alice gets her wood back');
  assert.equal(storesOf(b).warehouse.items.stone, 10, 'bob gets his stone back');
  assert.equal(a.last_partner_id, 'bob');
  assert.equal(b.last_partner_id, 'alice');
  assert.equal(a.last_split_at, T0);

  const mem = hi.handle(b, { type: 'hi_state' });
  assert.equal(mem.coupled, false);
  assert.equal(mem.frozen, true);
  assert.equal(mem.isle.decor.length, 1, 'Memory Isle keeps its decor');
  assert.deepEqual(mem.isle.storage, {});
  assert.equal(hi.handle(b, { type: 'hi_place', decor: 'rose_hedge', x: 1, y: 1 }).error, 'frozen');
  assert.equal(hi.handle(b, { type: 'hi_deposit', items: { stone: 1 } }).error, 'frozen');

  // A new partner inside 72 h is blocked…
  const carol = createStarterProfile('carol', 'pw12', 'bkk');
  carol.friends = ['alice']; a.friends.push('carol');
  db.profiles.set('carol', carol);
  carol.couple_requests_out = 'alice';
  a.couple_requests_in = [{ from: 'carol', at: T0 }];
  clock.advance(3600e3);
  assert.equal(daily.coupleAccept(a, { from: 'carol' }).error, 'couple_cooldown');

  // …but the same ex may re-couple immediately, which restores the isle.
  assert.equal(daily.couplePropose(a, { to: 'bob' }).status, 'pending');
  const acc = daily.coupleAccept(b, { from: 'alice' });
  assert.equal(acc.ok, true, JSON.stringify(acc));
  const live = hi.handle(a, { type: 'hi_state' });
  assert.equal(live.coupled, true);
  assert.equal(live.frozen, false);
  assert.equal(live.isle.decor.length, 1, 'restored with its decor');
  assert.equal(db.zones.get(heartIsleId('alice', 'bob')).state.restoredAt, T0 + 3600e3);

  // After 72 h the cooldown is over for new partners too.
  daily.coupleBreak(a);
  clock.advance(73 * 3600e3);
  a.couple_requests_in = [{ from: 'carol', at: clock.now() }];
  carol.couple_requests_out = 'alice';
  assert.equal(daily.coupleAccept(a, { from: 'carol' }).ok, true);
  assert.ok(db.zones.get(heartIsleId('alice', 'carol')), 'fresh isle for the new couple');
});

test('instanceLayout: [A] — bridge — [Heart Isle] — bridge — [B] with walkability across both bridges', () => {
  const [nook, neen] = seedProfiles();
  const solo = instanceLayout([{ owner: 'nook', village: nook.village }]);
  assert.equal(solo.islands.length, 1);
  assert.equal(solo.bridge, null);
  assert.deepEqual(solo.bridges, []);

  const isle = { id: heartIsleId('neen', 'nook'), owners: ['neen', 'nook'], layout: { decor: [{ id: 'rose_hedge_3_3', type: 'rose_hedge', x: 3, y: 3 }] }, frozen: false };
  const L = instanceLayout([{ owner: 'nook', village: nook.village }, { owner: 'neen', village: neen.village }], { heart: isle });
  for (const i of L.islands) buildCellIndex(i);
  assert.equal(L.islands.length, 3);
  const [A, B, H] = L.islands;
  assert.equal(A.owner, 'neen');
  assert.equal(H.kind, 'heart');
  assert.equal(H.owner, 'heart:neen|nook');
  assert.equal(H.S, 20);
  assert.equal(L.bridges.length, 2);
  const [b1, b2] = L.bridges;
  assert.equal(L.bridge, b1);
  assert.equal(b1.x0, A.cx + A.S / 2);
  assert.equal(b1.x1, H.cx - H.S / 2);
  assert.equal(b2.x0, H.cx + H.S / 2);
  assert.equal(b2.x1, B.cx - B.S / 2);
  assert.ok(A.cx < H.cx && H.cx < B.cx, 'heart isle sits in the middle');

  assert.ok(onBridge(L, b2.cx, 3) && groundAt(L, b2.cx, 3).walkable, 'second bridge deck');
  assert.ok(isWalkablePos(L, H.cx, 3), 'heart isle deck path');
  assert.equal(groundAt(L, H.cx, -3).walkable, false, 'love pavilion is solid');
  const hedge = H.cx - 10 + 3.5;
  assert.equal(groundAt(L, hedge, -10 + 3.5).walkable, false, 'decor is solid');
  assert.equal(groundAt(L, H.cx, 3).island, H);
  assert.equal(islandAt(L, H.cx, 0), H);
  assert.ok(isSegmentWalkable(L, b1.x0 - 0.5, 3, b2.x1 + 0.5, 3), 'straight walk along both bridges and the heart deck');
  assert.equal(groundAt(L, (b1.cx + b2.cx) / 2, -8).walkable, true, 'heart isle ground');
  assert.equal(groundAt(L, b1.cx, -6).walkable, false, 'sky beside a bridge');

  // A → B path crosses both bridges.
  const spA = spawnPoint(L, 'neen', 'dxb');
  const spB = spawnPoint(L, 'nook', 'bkk');
  assert.ok(Math.abs(spA.x - A.cx) < 3 && Math.abs(spB.x - B.cx) < 3, 'partners spawn on their own islands');
  const pathAB = findWalkPath(L, spA.x, spA.z, spB.x, spB.z);
  const last = pathAB[pathAB.length - 1];
  assert.ok(Math.hypot(last.x - spB.x, last.z - spB.z) < 0.6, 'path reaches B');
  assert.ok(pathAB.some((pt) => Math.abs(pt.x - (b1.x1 + 0.5)) < 1), 'enters the heart isle');
  assert.ok(pathAB.some((pt) => Math.abs(pt.x - (b2.x1 + 0.5)) < 1), 'enters B over the second bridge');

  assert.equal(heartReserved(0, 12), true);
  assert.equal(heartReserved(0, 0), false);
});

test('WS: hi_state for the seeded nook & neen couple + 3-island snapshot', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'neora-heart-isle-'));
  const srv = await startServer({ port: 0, dataFile: path.join(tmpDir, 'db.json'), quiet: true });
  let ws = null;
  const inbox = [];
  const waiters = [];
  const onMessage = (raw) => {
    const m = JSON.parse(String(raw));
    const i = waiters.findIndex((w) => w.pred(m));
    if (i >= 0) waiters.splice(i, 1)[0].resolve(m); else inbox.push(m);
  };
  const waitFor = (pred, ms = 4000) => {
    const i = inbox.findIndex(pred);
    if (i >= 0) return Promise.resolve(inbox.splice(i, 1)[0]);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout')), ms);
      waiters.push({ pred, resolve: (m) => { clearTimeout(timer); resolve(m); } });
    });
  };
  try {
    const auth = await fetch(`http://127.0.0.1:${srv.port}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'nook', password: '1234', lineage: 'bkk' }),
    }).then((r) => r.json());
    assert.ok(auth.token);
    ws = new WebSocket(`ws://127.0.0.1:${srv.port}/ws`);
    ws.on('message', onMessage);
    await new Promise((r) => ws.once('open', r));
    ws.send(JSON.stringify({ type: 'auth', token: auth.token }));
    await waitFor((m) => m.type === 'auth_ok');
    const snap = await waitFor((m) => m.type === 'instance_snapshot');
    assert.ok(String(snap.instanceId).startsWith('couple:'), snap.instanceId);
    assert.equal(snap.layout.islands.length, 3);
    const heart = snap.layout.islands.find((i) => i.kind === 'heart');
    assert.ok(heart && heart.village.buildings.some((b) => b.type === 'hi_love_pavilion'));
    assert.equal(snap.layout.bridges.length, 2);

    ws.send(JSON.stringify({ type: 'hi_state', reqId: 7 }));
    const st = await waitFor((m) => m.type === 'action_result' && m.reqId === 7);
    assert.equal(st.ok, true);
    assert.equal(st.coupled, true);
    assert.deepEqual(st.isle.owners, ['neen', 'nook']);
    assert.equal(st.isle.frozen, false);

    ws.send(JSON.stringify({ type: 'hi_place', decor: 'twin_lanterns', x: 2, y: 16, reqId: 8 }));
    const pl = await waitFor((m) => m.type === 'action_result' && m.reqId === 8);
    assert.equal(pl.ok, true, JSON.stringify(pl));
    const upd = await waitFor((m) => m.type === 'village_updated' && String(m.owner).startsWith('heart:'));
    assert.ok(upd.village.buildings.some((b) => b.type === 'twin_lanterns'));
  } finally {
    ws?.close();
    await srv.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
