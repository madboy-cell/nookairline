// tests/cloud_dash_party.test.js — Sky Cloud Dash 6B-2 party layer: slipstream, Mystery Prism items,
// cross-player effects, traps, 5 ULT archetypes + Synergy, Dash Builds detection & perks.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DASH_TUNING as T, createRunner, stepRunner, ultDefFor, rollItem, deliverEffect, makeRng, COSTUME_DASH_ULTS,
} from '../shared/cloud_dash_rules.js';
import { detectBuild, dashModsFromStats, BUILD_THRESHOLDS } from '../shared/dash_builds.js';
import { buildTrack } from '../shared/cloud_dash_track.js';

const NONE = { left: false, right: false, jump: false, glide: false, ult: false, item: false };
const run = (r, ctx, steps, inp = NONE) => { const ev = []; for (let i = 0; i < steps; i++) ev.push(...stepRunner(r, ctx, inp, T.DT)); return ev; };
const empty = (extra = {}) => ({ track: { items: [], pits: [], ...extra }, place: 1 });

test('slipstream: tucking behind a rival fills the draft and fires a slingshot', () => {
  const r = createRunner({ itemCount: 0 });
  const rival = { s: 0, lane: 0 };
  let ev = [];
  for (let i = 0; i < 200; i++) { rival.s = r.s + 6; ev.push(...stepRunner(r, { ...empty(), rivals: [rival] }, NONE, T.DT)); }
  assert.ok(ev.some((e) => e.e === 'slingshot'));
  // different lane → no draft
  const r2 = createRunner({ itemCount: 0 });
  ev = [];
  for (let i = 0; i < 200; i++) ev.push(...stepRunner(r2, { ...empty(), rivals: [{ s: r2.s + 6, lane: 1 }] }, NONE, T.DT));
  assert.ok(!ev.some((e) => e.e === 'slingshot'));
});

test('track: Mystery Prism rows exist (3 lanes each) and grabbing one gives an item', () => {
  const track = buildTrack(5);
  const prisms = track.items.filter((i) => i.t === 'prism');
  assert.ok(prisms.length >= 12 && prisms.length % 3 === 0);
  const r = createRunner({ itemCount: 3, seed: 9 });
  const ev = run(r, { track: { items: [{ t: 'prism', s: 10, lane: 0, y: 0.2 }, { t: 'prism', s: 10, lane: 1, y: 0.2 }, { t: 'prism', s: 10, lane: -1, y: 0.2 }], pits: [] }, place: 4 }, 120);
  assert.ok(ev.some((e) => e.e === 'item_get'));
  assert.equal(ev.filter((e) => e.e === 'item_get').length, 1, 'one item per row');
});

test('items: place-weighted rolls — leaders never get comeback items, 4th never gets traps', () => {
  const rng = makeRng(3);
  for (let i = 0; i < 300; i++) {
    assert.ok(!['shrink', 'mega_mount'].includes(rollItem(rng, 1, 0)));
    assert.ok(!['mochi', 'shield'].includes(rollItem(rng, 4, 0)));
  }
});

test('items: mega mount → pet ride; grapple zips; shield blocks a hit', () => {
  const r = createRunner({ itemCount: 1 });
  r.items = ['mega_mount'];
  let ev = stepRunner(r, empty(), { ...NONE, item: true }, T.DT);
  ev = ev.concat(run(r, empty(), 2));
  assert.ok(ev.some((e) => e.e === 'ride_start'));
  const g = createRunner({ itemCount: 0 });
  run(g, empty(), 120);
  g.items = ['grapple'];
  const v0 = g.v;
  run(g, empty(), 1, { ...NONE, item: true });
  run(g, empty(), 30);
  assert.ok(g.v > v0 * 1.5, 'zip speed');
  const sh = createRunner({ itemCount: 1 });
  sh.shield = 10;
  const ev2 = run(sh, { track: { items: [{ t: 'cloud', s: 15, lane: 0 }], pits: [] }, place: 1 }, 200);
  assert.ok(ev2.some((e) => e.e === 'shield_pop'));
  assert.ok(!ev2.some((e) => e.e === 'hit'));
});

test('cross-player: shrink is telegraphed and dodged by jumping; slow applies', () => {
  const a = createRunner({ itemCount: 0 });
  run(a, empty(), 60);
  deliverEffect(a, 'shrink');
  const ev = run(a, empty(), 70);
  assert.ok(ev.some((e) => e.e === 'shrunk'));
  const b = createRunner({ itemCount: 0 });
  run(b, empty(), 60);
  deliverEffect(b, 'shrink');
  run(b, empty(), Math.round((T.SHRINK.warn - 0.15) / T.DT));
  const evb = [...stepRunner(b, empty(), { ...NONE, jump: true }, T.DT), ...run(b, empty(), 30)];
  assert.ok(evb.some((e) => e.e === 'dodge'));
  const c = createRunner({ itemCount: 0 });
  deliverEffect(c, 'slow');
  assert.ok(run(c, empty(), 2).some((e) => e.e === 'slowed'));
});

test('traps: a rival mochi bounces you, your own does not', () => {
  const r = createRunner({ seat: 0, itemCount: 0 });
  const ev = run(r, { ...empty(), traps: [{ id: 1, s: 12, lane: 0, owner: 2 }] }, 150);
  assert.ok(ev.some((e) => e.e === 'trapped'));
  const own = createRunner({ seat: 2, itemCount: 0 });
  assert.ok(!run(own, { ...empty(), traps: [{ id: 1, s: 12, lane: 0, owner: 2 }] }, 150).some((e) => e.e === 'trapped'));
});

test('ULT archetypes: every costume maps; warp jumps ahead; flight clears clouds; synergy with ride', () => {
  for (const id of Object.keys(COSTUME_DASH_ULTS)) assert.ok(['surge', 'flight', 'warp', 'clear', 'control'].includes(ultDefFor(id).type), id);
  assert.ok(ultDefFor('sm_aurora_empress').mul > ultDefFor('s8_glacial_elsa').mul, 'Super Mythic +15%');
  const w = createRunner({ itemCount: 0, ult: ultDefFor('s2_kitsune_inari') });
  run(w, empty(), 30); w.ultCharge = 100;
  const s0 = w.s;
  stepRunner(w, empty(), { ...NONE, ult: true }, T.DT);
  assert.ok(w.s - s0 > 30, 'warp');
  const f = createRunner({ itemCount: 1, ult: ultDefFor('s3_sultan_djinn') });
  f.ultCharge = 100;
  const evf = [...stepRunner(f, { track: { items: [{ t: 'cloud', s: 20, lane: 0 }], pits: [] }, place: 1 }, { ...NONE, ult: true }, T.DT),
    ...run(f, { track: { items: [{ t: 'cloud', s: 20, lane: 0 }], pits: [] }, place: 1 }, 200)];
  assert.ok(!evf.some((e) => e.e === 'hit'), 'flying over clouds');
  const sy = createRunner({ itemCount: 0 });
  sy.bond = 100; run(sy, empty(), 2); sy.ultCharge = 100;
  assert.ok(stepRunner(sy, empty(), { ...NONE, ult: true }, T.DT).some((e) => e.e === 'synergy'));
});

test('builds: main / hybrid / balanced detection and tiers', () => {
  assert.equal(detectBuild({ swiftness: 120, power: 20, fortune: 20, luck: 20 }).id, 'speedster');
  assert.equal(detectBuild({ swiftness: 120, power: 20, fortune: 20, luck: 20 }).tier, 1);
  assert.equal(detectBuild({ swiftness: 700, power: 150, fortune: 180, luck: 60 }).tier, 4);
  assert.equal(detectBuild({ swiftness: 400, power: 380, fortune: 50, luck: 50 }).id, 'juggernaut');
  assert.equal(detectBuild({ swiftness: 150, power: 140, fortune: 130, luck: 130 }).id, 'balanced');
  for (const [k, th] of Object.entries(BUILD_THRESHOLDS)) assert.equal(th.length, 4, k);
});

test('builds: perks change the run (Smasher II smashes while boosted; Trickster II holds 2 items)', () => {
  const sm = dashModsFromStats({ power: 400, swiftness: 50, fortune: 50, luck: 50 });
  assert.ok(sm.perks.boostSmash);
  const r = createRunner({ itemCount: 1, mods: sm });
  r.pad = 5;
  const ev = run(r, { track: { items: [{ t: 'cloud', s: 8, lane: 0 }], pits: [] }, place: 1 }, 80);
  assert.ok(ev.some((e) => e.e === 'smash'));
  const tr = dashModsFromStats({ luck: 420, swiftness: 50, fortune: 50, power: 50 });
  assert.equal(tr.itemCap, 2);
  const whale = dashModsFromStats({ swiftness: 704, power: 173, fortune: 180, luck: 60 });
  assert.ok(whale.perks.launch && whale.perks.afterburner, 'Sovereign perks');
  assert.ok(whale.statSpeed <= 0.09);
});
