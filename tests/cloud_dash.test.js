// tests/cloud_dash.test.js — Sky Cloud Dash V2 (Phase 6B-1): track determinism, runner physics,
// forgiveness rules, Pet Ride / Rescue, bots finishing, and the server adapter lifecycle.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DASH_TUNING as T, createRunner, stepRunner, createBotBrain, botInput, computeRanking, maxPlausibleSpeed } from '../shared/cloud_dash_rules.js';
import { buildTrack } from '../shared/cloud_dash_track.js';
import { DASH_PATTERNS, validatePattern } from '../shared/cloud_dash_patterns.js';
import { createCloudDashAdapter } from '../server/cloud_dash_service.js';

const NONE = { left: false, right: false, jump: false, glide: false, ult: false };
const emptyTrack = (extra = {}) => ({ items: [], pits: [], ...extra });
const run = (r, ctx, steps, inp = NONE) => { const ev = []; for (let i = 0; i < steps; i++) ev.push(...stepRunner(r, ctx, inp, T.DT)); return ev; };

test('patterns: every authored pattern passes the fairness validator', () => {
  for (const p of DASH_PATTERNS) assert.deepEqual(validatePattern(p), [], p.id);
});

test('track: same seed → identical track; items sorted; pits only after zone 1', () => {
  const a = buildTrack(1234), b = buildTrack(1234), c = buildTrack(99);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a.items, c.items);
  for (let i = 1; i < a.items.length; i++) assert.ok(a.items[i].s >= a.items[i - 1].s);
  for (const p of a.pits) assert.ok(p.s0 >= T.ZONE_BOUNDS[1]);
});

test('runner: accelerates, changes lanes, jumps and lands', () => {
  const r = createRunner({ itemCount: 0 });
  const ctx = { track: emptyTrack(), place: 1 };
  run(r, ctx, 120);
  assert.ok(r.v > T.BASE * 0.9, 'reaches cruise speed');
  stepRunner(r, ctx, { ...NONE, right: true }, T.DT);
  run(r, ctx, 20);
  assert.equal(r.laneF, 1);
  stepRunner(r, ctx, { ...NONE, right: true }, T.DT); // already at edge
  assert.equal(r.laneT, 1);
  const ev = [...stepRunner(r, ctx, { ...NONE, jump: true }, T.DT), ...run(r, ctx, 60)];
  assert.ok(ev.some((e) => e.e === 'jump'));
  assert.ok(ev.some((e) => e.e === 'land'));
  assert.equal(r.grounded, true);
});

test('perfect landing: pressing right after touchdown triggers a Dash-Jump boost', () => {
  const r = createRunner({ itemCount: 0 });
  const ctx = { track: emptyTrack(), place: 1 };
  run(r, ctx, 30);
  stepRunner(r, ctx, { ...NONE, jump: true }, T.DT);
  let landed = false;
  for (let i = 0; i < 80 && !landed; i++) landed = stepRunner(r, ctx, NONE, T.DT).some((e) => e.e === 'land');
  assert.ok(landed);
  const ev = stepRunner(r, ctx, { ...NONE, jump: true }, T.DT);
  assert.ok(ev.some((e) => e.e === 'perfect'), 'Dash-Jump');
  assert.ok(r.dash > 0);
});

test('hazards: hitting a cloud stumbles (never eliminates); jumping clears it', () => {
  const track = buildTrack(1);
  const cloud = { t: 'cloud', s: 20, lane: 0 };
  const hitR = createRunner({ itemCount: 1 });
  const ev = run(hitR, { track: { items: [cloud], pits: [] }, place: 1 }, 200);
  assert.ok(ev.some((e) => e.e === 'hit'));
  assert.ok(hitR.s > 25, 'keeps running');
  assert.ok(track.items.length > 50);
});

test('pit: falling triggers Pet Rescue and lands past the gap', () => {
  const r = createRunner({ itemCount: 0 });
  const ctx = { track: emptyTrack({ pits: [{ s0: 15, s1: 22 }] }), place: 1 };
  const ev = run(r, ctx, 300);
  assert.ok(ev.some((e) => e.e === 'rescue'));
  assert.ok(ev.some((e) => e.e === 'rescue_end'));
  assert.ok(r.s > 22 && r.grounded);
});

test('pet ride: full bond auto-transforms, invulnerable and smashes clouds', () => {
  const r = createRunner({ itemCount: 1 });
  r.bond = 100;
  const ctx = { track: { items: [{ t: 'cloud', s: 15, lane: 0 }], pits: [] }, place: 1 };
  const ev = run(r, ctx, 150);
  assert.ok(ev.some((e) => e.e === 'ride_start'));
  assert.ok(ev.some((e) => e.e === 'smash'));
  assert.ok(!ev.some((e) => e.e === 'hit'));
});

test('bots: 4 bots finish a full race in a sensible time with Pet Rides', () => {
  const track = buildTrack(7);
  const bots = ['easy', 'hard', 'hard', 'insane'].map((l, i) => ({ r: createRunner({ seat: i, itemCount: track.items.length }), b: createBotBrain(70 + i, l), rides: 0 }));
  for (let step = 0; step < 150 / T.DT && !bots.every((x) => x.r.finished); step++) {
    const rank = computeRanking(bots.map((x) => x.r));
    bots.forEach((x, i) => {
      const ctx = { track, place: rank.indexOf(i) + 1 };
      for (const e of stepRunner(x.r, ctx, botInput(x.r, ctx, x.b, T.DT), T.DT)) if (e.e === 'ride_start') x.rides++;
    });
  }
  for (const x of bots) {
    assert.ok(x.r.finished);
    assert.ok(x.r.finishT > 50 && x.r.finishT < 90, `finish ${x.r.finishT}`);
    assert.ok(x.rides >= 1);
  }
});

test('adapter: countdown → race → validated reports → rewards', () => {
  let now = 1_000_000;
  const prof = { id: 'nook', username: 'Nook', gold: 0, berries: 0, diamonds: 0, level: 2, exp: 0, pets: [] };
  const sent = [];
  const a = createCloudDashAdapter({ db: { getProfile: (id) => (id === 'nook' ? prof : null), markProfile() {} }, send: (ids, m) => sent.push(m), humans: () => ['nook'], now: () => now });
  const t = { id: 't1', mode: 'cloud_dash', seats: [{ kind: 'human', userId: 'nook' }, { kind: 'empty' }, { kind: 'empty' }, { kind: 'empty' }] };
  a.start(t, {});
  assert.equal(sent[0].status, 'countdown');
  assert.equal(sent[0].roster.length, 4, 'empty lanes filled with bots');
  // teleport attempt is clamped
  now += 3700; a.tick(t, now);
  a.handle(t, 'nook', { type: 'cd_report', t: 0.2, s: 500, l: 0, y: 0, v: 12 });
  assert.ok(t.cloudDash.racers[0].r.s < 30, 'speed-hack clamped');
  for (let i = 0; i < 800 && t.cloudDash.status !== 'ended'; i++) {
    now += 200; a.tick(t, now);
    const rt = (now - t.cloudDash.goAt) / 1000;
    const s = Math.min(1001, rt * 14);
    a.handle(t, 'nook', { type: 'cd_report', t: rt, s, l: 0, y: 0, v: 14, style: 15000, coins: 100, fin: s >= 1000 ? 1 : 0, ft: s >= 1000 ? rt : null });
  }
  assert.equal(t.cloudDash.status, 'ended');
  const rw = t.cloudDash.rewards.nook;
  assert.ok(rw && rw.gold > 0 && rw.place >= 1 && rw.place <= 4);
  assert.equal(prof.dash_stats.played, 1);
  assert.ok(maxPlausibleSpeed() > T.BASE);
});
