// shared/cloud_dash_track.js — hand-authored course + seeded obstacle placement (Phase 6B-1)
// Server and client both call buildTrack(seed) and get identical items/pits.
// Spline control points are only used by the client renderer (server is 1D).
import { DASH_PATTERNS } from './cloud_dash_patterns.js';
import { DASH_TUNING, makeRng } from './cloud_dash_rules.js';

const T = DASH_TUNING;

/**
 * Hand-authored centerline control points [x, y, z] (meters, y up).
 * The client builds a CatmullRomCurve3 and rescales it so its arc length equals TRACK_LEN.
 * Zone 1: gentle right curve + climb · Zone 2: S-bends then cliff drop
 * Zone 3: downhill plunge into a hairpin · Zone 4: ascending spiral to the Sun Castle.
 */
export const TRACK_CONTROL_POINTS = [
  // Zone 1 — Klaipeda Cloud Promenade
  [0, 0, 0], [0, 0, 40], [4, 1, 90], [16, 3, 140], [34, 5, 185], [56, 7, 225],
  // Zone 2 — Kyoto Sakura Canyon (S-bends → cliff)
  [72, 8, 265], [64, 8, 305], [80, 8, 345], [70, 8, 385], [78, 8, 420], [80, 2, 450], [80, -2, 480],
  // Zone 3 — Glacial Aurora hairpin
  [82, -6, 530], [92, -9, 580], [118, -11, 615], [146, -12, 610], [158, -12, 575], [150, -12, 535],
  // Zone 4 — Olympus spiral up to the finish arch
  [140, -10, 495], [160, -6, 465], [195, -2, 470], [212, 3, 505], [200, 8, 540], [172, 12, 545], [160, 16, 515], [175, 20, 490], [205, 22, 495],
];

export const ZONE_THEMES = [
  { id: 'promenade', track: 'track_rainbow', sky: 'sky_promenade', fog: 0xffe6f2, landmarks: ['lm_castle', 'lm_ferris'] },
  { id: 'sakura', track: 'track_sakura', sky: 'sky_sakura', fog: 0xffd1e0, landmarks: ['lm_pagoda'] },
  { id: 'aurora', track: 'track_ice', sky: 'sky_aurora', fog: 0xbfe6ff, landmarks: ['lm_observatory'] },
  { id: 'olympus', track: 'track_olympus', sky: 'sky_olympus', fog: 0xfff1c4, landmarks: ['lm_castle'] },
];

const START_CLEAR = 35;     // empty run-up after the start line
const FINISH_CLEAR = 25;    // empty runway before the finish
const GAP_MIN = 6, GAP_MAX = 12;

/** Difficulty the zone prefers at a given point (ramps inside each zone). */
function wantDifficulty(zone, frac) {
  if (zone === 0) return frac < 0.5 ? 1 : 1 + (frac > 0.8 ? 1 : 0);
  if (zone === 1) return frac < 0.4 ? 1 : 2;
  if (zone === 2) return 2;
  return frac < 0.5 ? 2 : 3;
}

/**
 * Build the race track for a seed.
 * @returns {{ seed, len, items: Array<{t,s,lane,y?}>, pits: Array<{s0,s1}>, zones: number[] }}
 */
export function buildTrack(seed = 1, opts = {}) {
  const rng = makeRng(seed);
  const items = [];
  const pits = [];
  const b = T.ZONE_BOUNDS;
  let s = START_CLEAR;
  let lastId = '';
  const weather = opts.weather || null;
  const noPrisms = Boolean(opts.noPrisms);
  const doublePrisms = Boolean(opts.chaos || weather === 'prism');
  // 🎁 Mystery Prism rows (one item per row; placed in the clear gap after a pattern)
  const prismAt = noPrisms
    ? []
    : doublePrisms
      ? [180, 250, 320, 400, 470, 540, 610, 680, 750, 820, 890]
      : [280, 400, 520, 640, 770, 880];
  let prismIdx = 0;

  while (s < T.TRACK_LEN - FINISH_CLEAR - 20) {
    const zone = Math.min(3, b.findIndex((x, i) => s >= x && s < b[i + 1]));
    const zStart = b[zone], zEnd = b[zone + 1];
    const frac = (s - zStart) / (zEnd - zStart);
    const want = wantDifficulty(zone, frac);
    const room = T.TRACK_LEN - FINISH_CLEAR - s;
    let pool = DASH_PATTERNS.filter((p) => p.zones.includes(zone + 1) && p.length <= room && p.id !== lastId);
    let exact = pool.filter((p) => p.difficulty === want);
    if (!exact.length) exact = pool.filter((p) => Math.abs(p.difficulty - want) <= 1);
    if (!exact.length) break;
    const p = exact[Math.floor(rng() * exact.length)];
    lastId = p.id;
    const mirror = rng() < 0.5 ? -1 : 1;   // mirror lanes for variety
    let pads = 0;
    for (const it of p.items) {
      if (it.t === 'pit') { pits.push({ s0: s + it.d, s1: s + it.d + it.len }); continue; }
      if (it.t === 'pad' && (pads++ >= 1 || rng() < 0.4)) continue; // ≤1 speed pad per pattern, ~60% kept
      const o = { t: it.t, s: s + it.d, lane: it.lane * mirror };
      if (it.y) o.y = it.y;
      items.push(o);
    }
    const gap = GAP_MIN + rng() * (GAP_MAX - GAP_MIN);
    if (prismIdx < prismAt.length && s + p.length >= prismAt[prismIdx]) {
      const ps = s + p.length + gap / 2;
      for (const lane of [-1, 0, 1]) items.push({ t: 'prism', s: ps, lane, y: 0.2 });
      prismIdx++;
    }
    s += p.length + gap;
  }

  // Finish runway jelly ribbon (center lane) for a satisfying final stretch
  for (let d = T.TRACK_LEN - FINISH_CLEAR + 2; d < T.TRACK_LEN - 2; d += 2.5) items.push({ t: 'coin', s: d, lane: 0 });

  // ☁️ Upper Cloud Deck (Zone 2): golden updraft ring in the centre lane → elevated deck with rich jellies.
  const D = T.DECK;
  const deck = { s0: D.s0, s1: D.s1, ring: D.s0 - 3, y: D.y };
  // keep the drop-down landing zone safe: no pits / clouds right after the deck ends
  for (let i = pits.length - 1; i >= 0; i--) if (pits[i].s1 > deck.s1 - 2 && pits[i].s0 < deck.s1 + 12) pits.splice(i, 1);
  for (let i = items.length - 1; i >= 0; i--) if (items[i].t === 'cloud' && items[i].s > deck.s1 - 1 && items[i].s < deck.s1 + 9) items.splice(i, 1);
  let k = 0;
  for (let d = deck.s0 + 2; d < deck.s1 - 3; d += 2.5, k++) {
    const lane = Math.round(Math.sin(k * 0.45 + seed) * 1.2);
    items.push({ t: k % 6 === 5 ? 'berry' : 'coin', s: d, lane: Math.max(-1, Math.min(1, lane)), deck: 1 });
    if (k % 8 === 4) items.push({ t: 'star', s: d, lane: -Math.max(-1, Math.min(1, lane)) || 1, deck: 1 });
  }
  items.push({ t: 'orb', s: deck.s0 + 25, lane: 0, y: 1.4, deck: 1 });
  items.push({ t: 'orb', s: deck.s1 - 12, lane: (seed & 1) ? 1 : -1, y: 1.4, deck: 1 });

  // 🌦️ Weekly Sky Weather track modifiers (only when opts.weather is explicitly set)
  if (weather === 'jelly') {
    let coinIdx = 0;
    for (const it of items) {
      if (it.t === 'coin' && (++coinIdx % 3 === 0)) it.t = 'berry';
    }
  } else if (weather === 'tailwind') {
    for (const ps of [160, 430, 610, 810]) {
      const inPit = pits.some((pt) => ps >= pt.s0 - 4 && ps <= pt.s1 + 4);
      const occupied = items.some((it) => !it.deck && Math.abs(it.s - ps) < 2.5 && it.lane === 0);
      if (!inPit && !occupied) items.push({ t: 'pad', s: ps, lane: 0 });
    }
  } else if (weather === 'storm') {
    const stormSpots = [145, 240, 445, 595, 735, 845];
    stormSpots.forEach((cs, idx) => {
      const inPit = pits.some((pt) => cs >= pt.s0 - 7 && cs <= pt.s1 + 5);
      if (inPit) return;
      const lane = ((seed + idx) % 3) - 1;
      const nearClouds = items.filter((it) => !it.deck && it.t === 'cloud' && Math.abs(it.s - cs) < 3.5);
      const blockedLanes = new Set(nearClouds.map((it) => it.lane));
      if (blockedLanes.size < 2 && !items.some((it) => !it.deck && Math.abs(it.s - cs) < 1.8 && it.lane === lane)) {
        items.push({ t: 'cloud', s: cs, lane });
      }
    });
  }

  items.sort((a, b2) => a.s - b2.s || a.lane - b2.lane);
  pits.sort((a, b2) => a.s0 - b2.s0);
  return { seed, len: T.TRACK_LEN, items, pits, zones: b.slice(), deck, bends: computeBends(), weather, noPrisms };
}

let _bends = null;
/**
 * Bends for 🏎️ Corner Apex Carve, derived from the control-point polyline (XZ plane).
 * `dir` is the INSIDE lane (-1 / +1) using the renderer's convention right = tangent × up = (-tz, 0, tx),
 * where lane +1 is on the right. s-ranges are approximate (polyline length rescaled to TRACK_LEN).
 */
export function computeBends(minTurnDeg = 16, half = 12) {
  if (_bends) return _bends.map((b) => ({ ...b }));
  const P = TRACK_CONTROL_POINTS;
  const segLen = [];
  let total = 0;
  for (let i = 0; i < P.length - 1; i++) {
    const L = Math.hypot(P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1], P[i + 1][2] - P[i][2]);
    segLen.push(L); total += L;
  }
  const scale = T.TRACK_LEN / total;
  const out = [];
  let acc = segLen[0];
  for (let i = 1; i < P.length - 1; i++) {
    const ax = P[i][0] - P[i - 1][0], az = P[i][2] - P[i - 1][2];
    const bx = P[i + 1][0] - P[i][0], bz = P[i + 1][2] - P[i][2];
    const la = Math.hypot(ax, az) || 1, lb = Math.hypot(bx, bz) || 1;
    const t1x = ax / la, t1z = az / la, t2x = bx / lb, t2z = bz / lb;
    const turn = Math.acos(Math.max(-1, Math.min(1, t1x * t2x + t1z * t2z))) * 180 / Math.PI;
    if (turn >= minTurnDeg) {
      const rightX = -t1z, rightZ = t1x;
      const side = (t2x - t1x) * rightX + (t2z - t1z) * rightZ;
      const sMid = acc * scale;
      const s0 = Math.max(40, sMid - half), s1 = Math.min(T.TRACK_LEN - 30, sMid + half);
      if (s1 > s0) {
        const prev = out[out.length - 1];
        const dir = side >= 0 ? 1 : -1;
        if (prev && s0 <= prev.s1 + 2 && prev.dir === dir) prev.s1 = s1; // merge continuous same-way turns
        else if (prev && s0 <= prev.s1) { const mid = (prev.s1 + s0) / 2; prev.s1 = mid - 1; out.push({ s0: mid + 1, s1, dir }); }
        else out.push({ s0, s1, dir });
      }
    }
    acc += segLen[i];
  }
  _bends = out;
  return out.map((b) => ({ ...b }));
}
