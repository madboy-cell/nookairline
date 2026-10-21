// client/js/runway_reveal.js — 🏛️ Grand Royal Opera Runway (High-DPI Retina 2D Sprites + GPU CSS + Pooled 2D FX).
//
// Architecture:
//   • Zero second WebGLRenderer (no dual-WebGL context contention on mobile).
//   • Crisp hand-painted Tree of Savior × Cookie Run: Kingdom Opera Stage sprites:
//       - /assets/monopoly/gacha_chandelier_arch.png  (top crystal chandelier & crimson valance)
//       - /assets/monopoly/gacha_curtain_wing.png     (left/right velvet stage curtains that sweep open)
//       - /assets/monopoly/gacha_vip_crowd.png        (front-row plushie & chibi VIP audience waving lightsticks)
//       - /assets/monopoly/gacha_loom_pedestal.png    (Act I: Celestial Astrolabe Loom Pedestal)
//       - /assets/monopoly/gacha_trunk_rare|epic|mythic|super.png (Act II: Curved 2.5D Stage of Couture Trunks)
//   • Act III: Native Retina HD 2D Paper-Doll Chibi + Companion Pet walking down a mirror-reflective royal
//     marble catwalk with real-time inverted floor reflection, volumetric spotlights, and Hero Camera Zoom.
//   • Strictly pooled 2D FX canvas (max 45 particles, 0 per-frame allocations, auto-pauses when tab hidden).

import { itemSlot, DUPE_SHARDS } from '/shared/rpg_rules.js';
import { HAIRSTYLES } from '/shared/hair_catalog.js';
import { resolveItemVisual, renderPaperDollDomLayers, escapeHtml } from './ui_components.js';

// ---------------------------------------------------------------------------------------------
// Rarity presentation & deterministic helpers
// ---------------------------------------------------------------------------------------------
export const SM_TIER = 4;
const THREAD_STEPS = ['#fff5e4', '#5fb4ff', '#b07cff', '#ffc94a', 'rainbow'];
const TIERS = {
  1: {
    label: '★ Rare',
    short: '★1',
    color: '#5fb4ff',
    flashes: 1,
    cls: 'rw-t1',
    trunk: '/assets/monopoly/gacha_trunk_rare.png',
  },
  2: {
    label: '★★ Epic',
    short: '★★',
    color: '#b07cff',
    flashes: 3,
    cls: 'rw-t2',
    trunk: '/assets/monopoly/gacha_trunk_epic.png',
  },
  3: {
    label: '★★★ Mythic',
    short: '★★★',
    color: '#ffc94a',
    flashes: 26,
    cls: 'rw-t3',
    trunk: '/assets/monopoly/gacha_trunk_mythic.png',
  },
  4: {
    label: '✦ SUPER MYTHIC ✦',
    short: '✦ 0.5%',
    color: '#ffffff',
    flashes: 48,
    cls: 'rw-t4',
    trunk: '/assets/monopoly/gacha_trunk_super.png',
  },
};

const MAX_PARTICLES = 45;
const MAX_FLASHES = 20;

/** Normalises a server result item to 1..4 (4 = ✦ Super Mythic). */
export function tierOf(item) {
  if (!item) return 1;
  if (item.superMythic || item.rarityKey === 'super_mythic' || item.rarity === SM_TIER || item.rarity === 'super_mythic') {
    return SM_TIER;
  }
  return Math.max(1, Math.min(3, Number(item.rarity) || 1));
}

/** Ascending by tier (stable) — the curved trunk stage places the climax trunk LAST. */
export function rackOrder(items) {
  return (items || [])
    .map((it, i) => ({ it, i, t: tierOf(it) }))
    .sort((a, b) => a.t - b.t || a.i - b.i)
    .map((x) => x.it);
}

/** 25% of Super Mythic reveals start gold and fracture into Prismatic Rainbow — deterministic per pullId. */
export function fakeOutFor(pullId) {
  if (!pullId) return Math.random() < 0.25;
  let h = 2166136261;
  for (const ch of String(pullId)) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h % 4 === 0;
}

/** Camera flashes by rarity (1 for Rare … flash storm for Mythic & Super Mythic). */
export const flashCount = (tier) => TIERS[tier]?.flashes ?? 1;

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const rainbow = (t, off = 0, l = 66) => `hsl(${((t * 220 + off) % 360 + 360) % 360} 100% ${l}%)`;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const easeOutCubic = (t) => 1 - Math.pow(1 - clamp01(t), 3);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** runway.css is loaded on demand so index.html needs no edit. */
export function ensureRunwayCss() {
  if (typeof document === 'undefined' || document.getElementById('rw-css')) return;
  const l = document.createElement('link');
  l.id = 'rw-css';
  l.rel = 'stylesheet';
  l.href = '/css/runway.css';
  document.head.appendChild(l);
}

function formatItemBadge(item, tier) {
  if (!item) return 'NEW!';
  if (item.kind === 'new') return '✨ NEW!';
  if (item.kind === 'dupe') return 'DUPE +1';
  if (item.kind === 'blueprint') return `📘 BLUEPRINT (x${item.count || 1})`;
  if (item.kind === 'decor') return `🌳 DECOR (x${item.count || 1})`;
  if (item.kind === 'shards') return `+${item.shards || DUPE_SHARDS?.[tier] || 25} 🌟`;
  if (item.kind === 'essence') return `+${item.essence || 25} ✨`;
  if (item.kind === 'star_up') return `★${item.stars || ''} UP!`;
  if (item.kind === 'star_dupe') return `+1 ★ (${item.starDupes || 1}/${item.nextAt || 2})`;
  return String(item.kind || 'NEW!').toUpperCase();
}

// ---------------------------------------------------------------------------------------------
// Inline WebAudio SFX (zero external audio asset wait)
// ---------------------------------------------------------------------------------------------
class RunwaySfx {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.humOsc = null;
    this.humGain = null;
  }
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return this.ctx;
    }
    const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return null;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
    return this.ctx;
  }
  tone(freq, dur = 0.2, { type = 'sine', gain = 0.22, when = 0, slide = null } = {}) {
    const c = this.ensure();
    if (!c) return;
    const t0 = c.currentTime + when;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(this.master);
    o.start(t0);
    o.stop(t0 + dur + 0.04);
  }
  noise(dur = 0.15, { gain = 0.18, freq = 3000, q = 0.8, when = 0, type = 'bandpass', attack = 0.005 } = {}) {
    const c = this.ensure();
    if (!c) return;
    const t0 = c.currentTime + when;
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t0);
    src.stop(t0 + dur + 0.04);
  }
  humStart() {
    const c = this.ensure();
    if (!c || this.humOsc) return;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'triangle';
    o.frequency.value = 210;
    g.gain.value = 0.0001;
    g.gain.exponentialRampToValueAtTime(0.08, c.currentTime + 0.12);
    o.connect(g).connect(this.master);
    o.start();
    this.humOsc = o;
    this.humGain = g;
  }
  humLevel(k) {
    if (this.humOsc && this.ctx) {
      this.humOsc.frequency.setTargetAtTime(210 + 540 * k, this.ctx.currentTime, 0.06);
    }
  }
  humStop() {
    if (!this.humOsc) return;
    try {
      const c = this.ctx;
      const o = this.humOsc;
      const g = this.humGain;
      g.gain.cancelScheduledValues(c.currentTime);
      g.gain.setTargetAtTime(0.0001, c.currentTime, 0.04);
      o.stop(c.currentTime + 0.22);
    } catch {}
    this.humOsc = null;
    this.humGain = null;
  }
  curtainSweep() {
    this.noise(0.42, { gain: 0.15, freq: 820, q: 0.6, attack: 0.1 });
    this.tone(330, 0.35, { type: 'sine', gain: 0.08, slide: 660 });
  }
  snap() {
    this.noise(0.11, { gain: 0.45, freq: 4800, q: 1.8 });
    this.tone(880, 0.26, { type: 'sawtooth', gain: 0.11, slide: 110 });
  }
  trunkPop(tier = 1) {
    this.noise(0.14, { gain: 0.16, freq: 4200, q: 2.2, attack: 0.01 });
    const base = tier >= 3 ? 587 : tier === 2 ? 493 : 440;
    this.tone(base, 0.18, { type: 'triangle', gain: 0.14, slide: base * 1.35 });
  }
  click() {
    this.noise(0.045, { gain: 0.24, freq: 6800, q: 1.2 });
    this.tone(2400, 0.035, { type: 'square', gain: 0.025 });
  }
  chime(tier) {
    const chords = [
      [587, 880],
      [587, 740, 1175],
      [523, 659, 784, 1047],
      [523, 659, 784, 1047, 1319, 1568],
    ];
    const notes = chords[Math.max(0, Math.min(3, (tier | 0) - 1))];
    notes.forEach((f, i) => this.tone(f, 0.48, { type: 'sine', gain: 0.15, when: i * 0.075 }));
  }
  crowd(dur = 1.6) {
    this.noise(dur, { gain: 0.18, freq: 1150, q: 0.45, attack: 0.22 });
    this.noise(dur * 0.75, { gain: 0.09, freq: 2500, q: 0.7, attack: 0.25, when: 0.08 });
  }
  stamp() {
    this.tone(72, 0.48, { type: 'sine', gain: 0.55, slide: 38 });
    this.noise(0.18, { gain: 0.32, freq: 420, q: 0.7 });
  }
}

// ---------------------------------------------------------------------------------------------
// Grand Royal Opera Runway Controller
// ---------------------------------------------------------------------------------------------
export class RunwayReveal {
  constructor() {
    this.sfx = new RunwaySfx();
    this.el = null;
    this.active = null;
    this.social = { cheer: null, frontRow: null };

    // Pre-allocated fixed pools: zero GC churn during 60fps animations
    this.particlePool = Array.from({ length: MAX_PARTICLES }, () => ({
      active: false,
      kind: 'spark',
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
      max: 1,
      r: 3,
      rot: 0,
      vr: 0,
      g: 0,
      color: '#ffc94a',
      off: 0,
    }));
    this.flashPool = Array.from({ length: MAX_FLASHES }, () => ({
      active: false,
      x: 0,
      y: 0,
      delay: 0,
      life: 0,
      max: 0.18,
      fired: false,
    }));
  }

  get playing() {
    return !!this.active;
  }
  get pullId() {
    return this.active?.pullId || null;
  }

  /**
   * @param {object} o
   *   items: server result items · pullId · look: { username, lineage, appearance, equipped }
   *   pity: { sm, smMax } for the header meter
   * @returns {Promise<void>} resolves when the player closes the show
   */
  play(o = {}) {
    if (this.active) this.close(true);
    const items = Array.isArray(o.items) ? o.items.slice() : [];
    if (!items.length) return Promise.resolve();
    const rm = reducedMotion();
    const ordered = rackOrder(items);
    const best = ordered[ordered.length - 1];
    const bestTier = tierOf(best);

    this.resetPools();

    const S = (this.active = {
      o,
      items,
      ordered,
      best,
      bestTier,
      rm,
      hasSM: ordered.some((x) => tierOf(x) === SM_TIER),
      pullId: o.pullId || null,
      fakeOut: bestTier === SM_TIER && fakeOutFor(o.pullId),
      phase: 'intro',
      t0: performance.now(),
      last: performance.now(),
      raf: 0,
      threads: { k: 0, color: THREAD_STEPS[0], active: false, snapped: false, rainbow: false },
      crackAlpha: 0,
      walkActive: false,
      walkT: 0,
      walkDur: 1.8,
      walkProgress: 0,
      onWalkArrive: null,
      auraOn: false,
      skipLocked: false,
      skipped: false,
      closed: false,
      blackout: 0,
      blackoutTarget: 0,
      spot: 0,
      spotTarget: 0,
      shake: 0,
      whiteFlash: 0,
      resolve: null,
    });

    const done = new Promise((res) => {
      S.resolve = res;
    });
    this.mount(S);
    this.loop(S);
    this.run(S).catch((e) => {
      console.warn('[runway]', e);
      this.showSummary(S);
    });
    return done;
  }

  resetPools() {
    for (let i = 0; i < MAX_PARTICLES; i++) this.particlePool[i].active = false;
    for (let i = 0; i < MAX_FLASHES; i++) this.flashPool[i].active = false;
  }

  // ------------------------------------------------------------------ DOM Mount
  mount(S) {
    ensureRunwayCss();
    const root = document.createElement('div');
    root.className = `rw-root rw-tier-${S.bestTier}${S.rm ? ' rw-reduced' : ''}`;
    root.dataset.cam = 'wide';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', 'Grand Royal Opera Runway');

    const smPity = S.o.pity && S.o.pity.smMax
      ? `<div class="rw-pity" aria-label="Super Mythic pity">✦ ${S.o.pity.sm | 0} / ${S.o.pity.smMax} <small>0.5%</small></div>`
      : `<div class="rw-pity">✦ 0.5% Super Mythic</div>`;

    root.innerHTML = `
      <div class="rw-opera-bg">
        <div class="rw-opera-arch"></div>
        <div class="rw-opera-balconies"></div>
      </div>

      <div class="rw-stage-world">
        <div class="rw-catwalk-wrap">
          <div class="rw-catwalk-surface">
            <div class="rw-catwalk-veins"></div>
            <div class="rw-catwalk-seam"></div>
            <div class="rw-footlights is-left"></div>
            <div class="rw-footlights is-right"></div>
          </div>
          <div class="rw-catwalk-apron"></div>
        </div>

        <div class="rw-spotlights">
          <div class="rw-cone rw-cone-l"></div>
          <div class="rw-cone rw-cone-c"></div>
          <div class="rw-cone rw-cone-r"></div>
        </div>

        <div class="rw-catwalk-stage"></div>
      </div>

      <div class="rw-proscenium" aria-hidden="true">
        <img class="rw-curtain rw-curtain-l" src="/assets/monopoly/gacha_curtain_wing.png" alt="" decoding="async" />
        <img class="rw-curtain rw-curtain-r" src="/assets/monopoly/gacha_curtain_wing.png" alt="" decoding="async" />
        <img class="rw-chandelier" src="/assets/monopoly/gacha_chandelier_arch.png" alt="" decoding="async" />
        <img class="rw-vip rw-vip-l" src="/assets/monopoly/gacha_vip_crowd.png" alt="" decoding="async" />
        <img class="rw-vip rw-vip-r" src="/assets/monopoly/gacha_vip_crowd.png" alt="" decoding="async" />
      </div>

      <div class="rw-black"></div>
      <div class="rw-spot"></div>
      <canvas class="rw-fx"></canvas>
      <div class="rw-white"></div>

      <header class="rw-head">
        <div class="rw-title">🏛️ Grand Royal Opera Runway</div>
        ${smPity}
      </header>

      <div class="rw-center"></div>
      <div class="rw-stamp" hidden>✦ SUPER MYTHIC — 0.5% ✦</div>
      <div class="rw-card-host"></div>
      <div class="rw-toastline" aria-live="polite"></div>

      <footer class="rw-foot">
        <button type="button" class="rw-btn rw-skip">Skip ⏭</button>
      </footer>
    `;

    document.body.appendChild(root);
    this.el = root;
    S.root = root;
    S.fx = root.querySelector('.rw-fx');
    S.ctx = S.fx.getContext('2d');
    S.center = root.querySelector('.rw-center');
    S.catwalkStage = root.querySelector('.rw-catwalk-stage');
    S.cardHost = root.querySelector('.rw-card-host');
    S.skipBtn = root.querySelector('.rw-skip');
    S.blackEl = root.querySelector('.rw-black');
    S.whiteEl = root.querySelector('.rw-white');
    S.spotEl = root.querySelector('.rw-spot');

    S.onResize = () => this.resize(S);
    window.addEventListener('resize', S.onResize, { passive: true });
    S.onVis = () => {
      if (document.hidden) {
        if (S.raf) {
          cancelAnimationFrame(S.raf);
          S.raf = 0;
        }
        this.sfx.humStop();
      } else if (!S.closed && !S.raf) {
        S.last = performance.now();
        this.loop(S);
      }
    };
    document.addEventListener('visibilitychange', S.onVis);
    S.skipBtn.addEventListener('click', () => this.skip(S));

    this.resize(S);
    requestAnimationFrame(() => root.classList.add('rw-in'));
  }

  resize(S) {
    if (!S?.fx) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const dpr = Math.min(1.75, window.devicePixelRatio || 1);
    S.w = w;
    S.h = h;
    S.dpr = dpr;
    S.fx.width = Math.round(w * dpr);
    S.fx.height = Math.round(h * dpr);
    S.fx.style.width = `${w}px`;
    S.fx.style.height = `${h}px`;
    S.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  setLine(S, html, ms = 2000) {
    const el = S.root?.querySelector('.rw-toastline');
    if (!el) return;
    el.innerHTML = html;
    el.classList.add('show');
    clearTimeout(S.lineTimer);
    S.lineTimer = setTimeout(() => el.classList.remove('show'), ms);
  }

  // ------------------------------------------------------------------ Sequence
  async run(S) {
    await this.phaseStitch(S);
    if (S.closed || S.skipped) return;
    if (S.items.length > 1) {
      await this.phaseRack(S);
      if (S.closed || S.skipped) return;
      // Fast Showcase: Rare (★1) & Epic (★2) popped on stage; walk the catwalk for Mythic (★3), Super Mythic (✦), or climax look
      await this.phaseRunway(S, S.best);
    } else {
      // 1x pull: always walk the Opera Catwalk so every single pull feels special
      await this.phaseRunway(S, S.best);
    }
    if (S.closed) return;
    this.showSummary(S);
  }

  skip(S) {
    if (S.skipLocked) return;
    if (S.phase === 'summary') {
      this.close();
      return;
    }
    S.skipped = true;
    S.wake?.();
    this.sfx.humStop();
    if (S.hasSM && !S.runwayPlayed) {
      // Super Mythic (✦ 0.5%) always plays its dramatic catwalk entrance
      const sm = S.ordered.find((x) => tierOf(x) === SM_TIER) || S.best;
      S.center.innerHTML = '';
      this.phaseRunway(S, sm).then(() => {
        if (!S.closed) this.showSummary(S);
      });
    } else {
      this.showSummary(S);
    }
  }

  sleep(S, ms) {
    return new Promise((res) => {
      const id = setTimeout(() => {
        S.wake = null;
        res();
      }, ms);
      S.wake = () => {
        clearTimeout(id);
        S.wake = null;
        res();
      };
    });
  }

  // ------------------------------------------------------------------ Act I: Celestial Astrolabe Loom + Couture Chest Materialization
  async phaseStitch(S) {
    S.phase = 'stitch';
    S.root.dataset.cam = 'wide';
    const target = S.fakeOut ? 3 : S.bestTier;
    S.center.innerHTML = `
      <div class="rw-loom-stage">
        <img class="rw-loom-circle" src="/assets/ui/fx_magic_circle.png" alt="" decoding="async" />
        <div class="rw-loom-orb" id="rw-loom-orb"></div>
        <button type="button" class="rw-loom-btn" aria-label="Weave on the Celestial Loom">
          <span class="rw-loom-ring"></span>
          <img class="rw-loom-img" src="/assets/monopoly/gacha_loom_pedestal.png" alt="Celestial Loom Pedestal" decoding="async" />
          <div class="rw-loom-chest-wrap" id="rw-loom-chest-wrap">
            <img class="rw-loom-chest" id="rw-loom-chest" src="${TIERS[1].trunk}" alt="Couture Chest" decoding="async" />
            <span class="rw-loom-chest-tag" id="rw-loom-chest-tag">${TIERS[1].short}</span>
          </div>
        </button>
        <div class="rw-hint-pill">✨ Hold or Tap the <b>Celestial Loom &amp; Couture Chest</b> to Open</div>
      </div>
    `;

    const loomBtn = S.center.querySelector('.rw-loom-btn');
    const orb = S.center.querySelector('#rw-loom-orb');
    const chestWrap = S.center.querySelector('#rw-loom-chest-wrap');
    const chestImg = S.center.querySelector('#rw-loom-chest');
    const chestTag = S.center.querySelector('#rw-loom-chest-tag');
    const HOLD_MS = S.rm ? 480 : 1150;
    let holding = false;
    let autoWind = false;
    let held = 0;
    let lastT = performance.now();
    let released = false;
    let curChestTier = 1;

    const setChestTier = (tier) => {
      const t = Math.max(1, Math.min(4, tier | 0));
      if (t === curChestTier) return;
      curChestTier = t;
      if (chestImg) chestImg.src = TIERS[t].trunk;
      if (chestTag) chestTag.textContent = TIERS[t].short;
      if (chestWrap) chestWrap.dataset.tier = String(t);
    };

    const th = S.threads;
    th.k = 0;
    th.color = THREAD_STEPS[0];
    th.active = true;
    th.snapped = false;
    th.rainbow = false;

    await new Promise((resolve) => {
      const finish = () => {
        if (released) return;
        released = true;
        th.active = false;
        this.sfx.humStop();
        resolve();
      };
      S.wake = finish;

      const down = (e) => {
        e.preventDefault();
        holding = true;
        autoWind = true; // Tapping once or holding both wind the loom smoothly to 100%
        loomBtn.classList.add('holding');
        this.sfx.humStart();
        try {
          loomBtn.setPointerCapture(e.pointerId);
        } catch {}
      };
      const up = () => {
        if (!holding) return;
        holding = false;
        if (held >= HOLD_MS * 0.85) {
          loomBtn.classList.remove('holding');
          finish();
        }
      };

      loomBtn.addEventListener('pointerdown', down);
      loomBtn.addEventListener('pointerup', up);
      loomBtn.addEventListener('pointercancel', up);

      const tick = () => {
        if (released || S.closed) return;
        const now = performance.now();
        const dt = now - lastT;
        lastT = now;

        if (holding || autoWind) {
          held += dt * (holding ? 1.0 : 2.1);
        }
        const k = clamp01(held / HOLD_MS);
        th.k = k;
        const step = Math.min(target, Math.floor(k * (target + 0.999)));
        th.color = THREAD_STEPS[step];
        setChestTier(Math.max(1, step));
        if (orb) {
          orb.style.setProperty('--orb-c', th.color === 'rainbow' ? '#ff73d0' : th.color);
          orb.style.transform = `translateX(-50%) scale(${(0.75 + k * 0.65).toFixed(3)})`;
        }
        if (chestWrap) {
          chestWrap.style.transform = `translate(-50%, -50%) scale(${(0.88 + k * 0.28).toFixed(3)})`;
        }
        this.sfx.humLevel(k);
        if ((holding || autoWind) && Math.random() < 0.42) this.spawnThreadSpark(S);
        if (k >= 1) {
          loomBtn.classList.remove('holding');
          finish();
          return;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });

    if (S.closed || S.skipped) return;

    th.k = 1;
    if (S.fakeOut) {
      // 25% Super Mythic Fake-Out: Gold Mythic Chest freezes, fractures with lightning, and transforms into the Black-Gold Super Mythic Chest!
      th.color = THREAD_STEPS[3];
      setChestTier(3);
      chestWrap?.classList.add('is-climax');
      await this.sleep(S, S.rm ? 80 : 160);
      th.snapped = true;
      S.crackAlpha = 1;
      this.sfx.snap();
      S.shake = S.rm ? 0 : 1.1;
      this.burstSnap(S);
      await this.sleep(S, S.rm ? 120 : 320);
      th.rainbow = true;
      th.color = 'rainbow';
      setChestTier(4);
      chestWrap?.classList.add('is-bursting');
      this.burstFabric(S, true);
      this.sfx.chime(4);
      await this.sleep(S, S.rm ? 240 : 650);
    } else {
      th.color = THREAD_STEPS[S.bestTier];
      th.rainbow = S.bestTier === SM_TIER;
      setChestTier(S.bestTier);
      chestWrap?.classList.add('is-bursting');
      this.burstFabric(S, th.rainbow);
      this.sfx.chime(S.bestTier);
      await this.sleep(S, S.rm ? 200 : 540);
    }
    th.active = false;
    S.center.innerHTML = '';
  }

  // ------------------------------------------------------------------ Act II: 3D Curved Stage of Painted Couture Trunks (10x)
  async phaseRack(S) {
    S.phase = 'rack';
    S.root.dataset.cam = 'wide';
    const lineage = S.o.look?.lineage || 'bkk';

    // Curved 2.5D amphitheater arc coordinates per column (0..4)
    const ARC_Y = [14, 5, 0, 5, 14];
    const ARC_ROT = [-7, -3.5, 0, 3.5, 7];

    const trunksHtml = S.ordered
      .map((it, i) => {
        const t = tierOf(it);
        const col = i % 5;
        const isClimax = i === S.ordered.length - 1;
        return `
          <button type="button"
                  class="rw-bag rw-trunk ${TIERS[t].cls}${isClimax ? ' is-climax' : ''}"
                  data-i="${i}"
                  ${isClimax ? 'data-best="1"' : ''}
                  style="--arc-y:${ARC_Y[col]}px;--arc-rot:${ARC_ROT[col]}deg;"
                  aria-label="Couture trunk ${i + 1}">
            <span class="rw-trunk-halo"></span>
            <img class="rw-trunk-img" src="${TIERS[t].trunk}" alt="${TIERS[t].label}" decoding="async" />
            <span class="rw-trunk-badge">${TIERS[t].short}</span>
            <span class="rw-bag-item"></span>
          </button>
        `;
      })
      .join('');

    S.center.innerHTML = `
      <div class="rw-rack">
        <div class="rw-rack-banner">✨ Royal Couture Trunk Showcase ✨</div>
        <div class="rw-bags">${trunksHtml}</div>
      </div>
      <div class="rw-hint-pill">Tap trunks to pop open — Mythic &amp; Climax walk the Opera Catwalk!</div>
      <button type="button" class="rw-btn-gold rw-unzip-all">✨ Open All</button>
    `;

    const opened = new Set();
    const last = S.ordered.length - 1;
    let cascading = false;

    await new Promise((resolve) => {
      S.wake = resolve;

      const popTrunk = (i) => {
        if (opened.has(i) || S.closed) return;
        opened.add(i);
        const it = S.ordered[i];
        const t = tierOf(it);
        const btn = S.center.querySelector(`.rw-trunk[data-i="${i}"]`);
        if (!btn) return;
        const vis = resolveItemVisual(it.id, lineage);
        const badge = formatItemBadge(it, t);
        const filterStyle = vis.filter && vis.filter !== 'none' ? `filter:${vis.filter};` : '';
        btn.querySelector('.rw-bag-item').innerHTML = `
          <div class="rw-mini-card ${TIERS[t].cls}">
            <img src="${vis.url || ''}" alt="" style="${filterStyle}" decoding="async" />
            <b>${escapeHtml(vis.name || it.id)}</b>
            <small>${escapeHtml(badge)}</small>
          </div>
        `;
        btn.classList.add('open');
        this.sfx.trunkPop(t);
        const r = btn.getBoundingClientRect();
        this.addFlashes(S, Math.min(3, flashCount(t)), {
          x: r.left + r.width / 2,
          y: r.top + r.height / 2,
          spread: 32,
        });
        if (opened.size === S.ordered.length) {
          setTimeout(resolve, S.rm ? 160 : 420);
        }
      };

      const cascadeAll = async () => {
        if (cascading || S.closed) return;
        cascading = true;
        const openAllBtn = S.center.querySelector('.rw-unzip-all');
        if (openAllBtn) openAllBtn.disabled = true;
        for (let i = 0; i <= last && !S.closed && !S.skipped; i++) {
          if (!opened.has(i)) {
            popTrunk(i);
            await wait(S.rm ? 25 : 85);
          }
        }
      };

      S.center.querySelector('.rw-bags').addEventListener('click', (e) => {
        const b = e.target.closest('.rw-trunk');
        if (!b) return;
        const idx = Number(b.dataset.i);
        if (idx === last && opened.size < last) {
          // If the player taps the climax trunk early, fast-cascade all remaining trunks so they never feel blocked
          cascadeAll();
          return;
        }
        popTrunk(idx);
      });

      S.center.querySelector('.rw-unzip-all').addEventListener('click', () => {
        cascadeAll();
      });
    });

    S.center.innerHTML = '';
  }

  // ------------------------------------------------------------------ Act III: Grand Opera Catwalk & Hero Camera Zoom
  async phaseRunway(S, item) {
    if (S.runwayPlayed || !item) return;
    S.runwayPlayed = true;
    S.phase = 'runway';

    const tier = tierOf(item);
    const isSM = tier === SM_TIER;
    S.skipLocked = isSM;
    if (isSM) S.skipBtn.hidden = true;

    S.center.innerHTML = '';
    S.cardHost.innerHTML = '';

    // Part the crimson-velvet stage curtains & start tracking camera
    S.root.classList.add('rw-curtains-open');
    S.root.dataset.cam = 'track';
    this.sfx.curtainSweep();

    const walkerEl = this.mountRetinaWalker(S, S.o.look, item, tier);

    if (isSM) {
      // Super Mythic (✦ 0.5%): Full blackout → twin gold & aurora volumetric spotlights slam down
      S.blackoutTarget = 0.86;
      this.sfx.noise(0.9, { gain: 0.05, freq: 320, q: 0.35, attack: 0.3 });
      await this.sleep(S, S.rm ? 180 : 520);
      if (S.closed) return;
      S.spotTarget = 1;
      S.root.classList.add('rw-spotlights-on', 'rw-super-cones');
      this.sfx.tone(110, 0.55, { type: 'sawtooth', gain: 0.09, slide: 55 });
      await this.sleep(S, S.rm ? 140 : 380);
    } else {
      S.spotTarget = tier >= 3 ? 0.95 : 0.7;
      S.root.classList.add('rw-spotlights-on');
    }

    // Walk down the mirror-reflective marble catwalk
    await this.walkCatwalk(S, isSM ? 2.1 : tier >= 3 ? 1.75 : 1.35);
    const live = () => !S.closed && S.phase === 'runway';
    if (!live()) return;

    // Front mark reached: Hero Camera Zoom + Suit-Up / Cast Pose!
    S.root.dataset.cam = isSM ? 'hero-sm' : 'hero';
    walkerEl?.classList.add('is-posing');
    S.root.classList.add('rw-crowd-hype');
    this.sfx.chime(tier);

    if (isSM) {
      S.auraOn = true;
      this.sfx.tone(220, 1.2, { type: 'triangle', gain: 0.13, slide: 880 });
      await this.sleep(S, S.rm ? 260 : 680);
      if (!live()) return;
      S.blackoutTarget = 0.22;
      this.sfx.crowd(2.0);
      this.addFlashes(S, S.rm ? 5 : flashCount(SM_TIER));
      this.burstConfetti(S, S.rm ? 14 : 36);
      await this.sleep(S, S.rm ? 220 : 620);
      if (!live()) return;

      const stamp = S.root.querySelector('.rw-stamp');
      if (stamp) {
        stamp.hidden = false;
        stamp.classList.add('slam');
      }
      this.sfx.stamp();
      S.shake = S.rm ? 0 : 1.1;
      S.whiteFlash = S.rm ? 0.18 : 0.62;
      await this.sleep(S, S.rm ? 360 : 950);
    } else {
      this.addFlashes(S, S.rm ? Math.min(3, flashCount(tier)) : flashCount(tier));
      if (tier >= 3) {
        this.sfx.crowd(1.3);
        this.burstConfetti(S, S.rm ? 12 : 28);
      }
      await this.sleep(S, S.rm ? 220 : 520);
    }

    if (!live()) return;
    this.showItemCard(S, item);
    S.skipLocked = false;
    S.skipBtn.hidden = false;
    await this.sleep(S, S.rm ? 300 : 850);
  }

  /**
   * Builds a pure High-DPI Retina 2D layered Chibi + Companion Pet walker with real-time
   * inverted marble catwalk reflection (zero WebGL overhead).
   */
  mountRetinaWalker(S, look, item, tier) {
    const L = look || {};
    const lineage = L.lineage === 'dxb' ? 'dxb' : 'bkk';
    const eq = { ...(L.equipped || {}) };
    const app = { ...(L.appearance || {}) };

    const slot = item && itemSlot(item.id);
    const isWearableSlot = slot && ['outfit', 'hat', 'face', 'gloves', 'boots', 'wings'].includes(slot);
    const isHair = Boolean(item && HAIRSTYLES[item.id]);
    const isPetItem = Boolean(item && (item.pet || String(item.id || '').startsWith('pet_')));

    if (isWearableSlot) {
      eq[slot] = { id: item.id, refine: 0, hide: false };
    } else if (isHair) {
      app.hair = item.id;
    }

    // Companion Pet walking beside the Chibi on the catwalk
    const petId = isPetItem ? item.id : eq.pet?.id || null;
    const petVis = petId ? resolveItemVisual(petId, lineage) : null;
    const itemVis = item ? resolveItemVisual(item.id, lineage) : null;

    // Render crisp bone-aligned 2D paper-doll layers (shared with Wardrobe hero stage)
    const chibiLayersHtml = renderPaperDollDomLayers(lineage, eq, 'front', app);
    const petHtml = petVis
      ? `<div class="rw-walker-pet"><img src="${petVis.url}" alt="${escapeHtml(petVis.name || '')}" decoding="async" /></div>`
      : '';

    // If the pulled item is a Wonder, Blueprint, Decor, or 3D Die, float a radiant relic emblem beside the Chibi
    const floatingRelicHtml =
      !isWearableSlot && !isHair && !isPetItem && itemVis
        ? `<div class="rw-walker-relic ${TIERS[tier].cls}"><img src="${itemVis.url}" alt="" decoding="async" /></div>`
        : '';

    const smRelicMap = (id) => {
      const s = String(id || '');
      if (s.includes('aurora')) return 'mono_ult_sm_aurora';
      if (s.includes('seraphim')) return 'mono_ult_sm_seraphim';
      if (s.includes('cyber')) return 'mono_ult_sm_cyber';
      if (s.includes('ribbon')) return 'mono_ult_sm_ribbon';
      return 'mono_ult_sm_eclipse';
    };
    const smReliquaryImg =
      tier === SM_TIER
        ? `<img class="rw-walker-sm-relic" src="/assets/monopoly/${smRelicMap(item?.id)}.png" alt="" decoding="async" />`
        : '';

    S.catwalkStage.innerHTML = `
      <div class="rw-walker-rig ${TIERS[tier].cls}" id="rw-walker-rig">
        <div class="rw-walker-shadow"></div>
        <img class="rw-walker-magic" src="/assets/ui/fx_magic_circle.png" alt="" decoding="async" />
        ${smReliquaryImg}

        <!-- Mirror-reflective marble catwalk inverted clone -->
        <div class="rw-walker-reflect" aria-hidden="true">
          <div class="rw-walker-chibi">${chibiLayersHtml}</div>
          ${petHtml}
        </div>

        <!-- Primary Retina HD Chibi + Companion Pet -->
        <div class="rw-walker-body">
          <div class="rw-walker-chibi">${chibiLayersHtml}</div>
          ${petHtml}
          ${floatingRelicHtml}
        </div>

        ${L.username ? `<div class="rw-walker-nameplate">${escapeHtml(L.username)}</div>` : ''}
      </div>
    `;

    const rigEl = S.catwalkStage.querySelector('#rw-walker-rig');
    S.walkerEl = rigEl;
    return rigEl;
  }

  walkCatwalk(S, seconds) {
    return new Promise((res) => {
      const dur = S.rm ? 0.05 : seconds;
      S.walkT = 0;
      S.walkDur = dur;
      S.walkProgress = 0;
      S.walkActive = true;
      S.onWalkArrive = res;
    });
  }

  // ------------------------------------------------------------------ Cards & Summary
  showItemCard(S, item) {
    const t = tierOf(item);
    const lineage = S.o.look?.lineage || 'bkk';
    const vis = resolveItemVisual(item.id, lineage);
    const kind = formatItemBadge(item, t);
    const filterStyle = vis.filter && vis.filter !== 'none' ? `filter:${vis.filter};` : '';
    S.cardHost.innerHTML = `
      <div class="rw-card ${TIERS[t].cls}">
        <div class="rw-card-ribbon">${TIERS[t].label}</div>
        <div class="rw-card-frame">
          <img src="${vis.url || ''}" alt="${escapeHtml(vis.name || item.id)}" style="${filterStyle}" decoding="async" />
        </div>
        <div class="rw-card-name">${escapeHtml(vis.name || item.id)}</div>
        <div class="rw-card-kind">${escapeHtml(kind)}</div>
      </div>
    `;
  }

  showSummary(S) {
    if (S.closed || S.phase === 'summary') return;
    S.phase = 'summary';
    S.skipLocked = false;
    S.skipBtn.hidden = false;
    S.skipBtn.textContent = 'Done ✨';
    S.blackoutTarget = 0.12;
    S.spotTarget = 0.85;
    this.sfx.humStop();
    S.center.innerHTML = '';

    // For a 1x pull, keep the Hero Card & Catwalk Chibi front-and-center so the user can admire & tap Done
    if (S.items.length === 1) {
      if (!S.cardHost.innerHTML) this.showItemCard(S, S.best);
      return;
    }

    const lineage = S.o.look?.lineage || 'bkk';
    const tilesHtml = S.ordered
      .slice()
      .reverse()
      .map((it) => {
        const t = tierOf(it);
        const vis = resolveItemVisual(it.id, lineage);
        const badge = formatItemBadge(it, t);
        const filterStyle = vis.filter && vis.filter !== 'none' ? `filter:${vis.filter};` : '';
        return `
          <div class="rw-sum-item ${TIERS[t].cls}">
            <span class="rw-sum-tier">${TIERS[t].short}</span>
            <div class="rw-sum-thumb">
              <img src="${vis.url || ''}" alt="" style="${filterStyle}" decoding="async" />
            </div>
            <b>${escapeHtml(vis.name || it.id)}</b>
            <small>${escapeHtml(badge)}</small>
          </div>
        `;
      })
      .join('');

    S.cardHost.innerHTML = `
      <div class="rw-summary-modal">
        <div class="rw-summary-head">🏛️ Royal Opera Debut Summary (${S.items.length}×)</div>
        <div class="rw-summary">
          ${tilesHtml}
        </div>
      </div>
    `;
  }

  close(silent = false) {
    const S = this.active;
    if (!S) return;
    S.closed = true;
    S.wake?.();
    if (S.raf) cancelAnimationFrame(S.raf);
    clearTimeout(S.lineTimer);
    this.sfx.humStop();
    window.removeEventListener('resize', S.onResize);
    document.removeEventListener('visibilitychange', S.onVis);
    this.resetPools();
    S.root?.remove();
    this.el = null;
    this.active = null;
    S.resolve?.();
    if (!silent) this.onClosed?.();
  }

  // Compatibility no-ops for removed couple/spectator layer
  addAudience() {}
  addDuoPartner() {}
  addCheer() {}

  // ------------------------------------------------------------------ Strictly Pooled Particles (Max 45)
  allocParticle() {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (!this.particlePool[i].active) {
        this.particlePool[i].active = true;
        return this.particlePool[i];
      }
    }
    return null;
  }

  spawnThreadSpark(S) {
    const p = this.allocParticle();
    if (!p) return;
    const cx = S.w * 0.5;
    const cy = S.h * 0.45;
    const a = Math.random() * Math.PI * 2;
    p.kind = 'spark';
    p.x = cx + Math.cos(a) * 68;
    p.y = cy + Math.sin(a) * 95;
    p.vx = Math.cos(a) * 28;
    p.vy = Math.sin(a) * 28 - 24;
    p.life = 0.55;
    p.max = 0.55;
    p.r = 2.2 + Math.random() * 2;
    p.g = 0;
    p.color = S.threads.color;
  }

  burstSnap(S) {
    const cx = S.w * 0.5;
    const cy = S.h * 0.44;
    const count = S.rm ? 8 : 22;
    for (let i = 0; i < count; i++) {
      const p = this.allocParticle();
      if (!p) break;
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.25;
      const v = 130 + Math.random() * 220;
      p.kind = 'spark';
      p.x = cx;
      p.y = cy;
      p.vx = Math.cos(a) * v;
      p.vy = Math.sin(a) * v;
      p.life = 0.65;
      p.max = 0.65;
      p.r = 2.8;
      p.g = 320;
      p.color = '#ffc94a';
    }
  }

  burstFabric(S, rb) {
    const cx = S.w * 0.5;
    const cy = S.h * 0.44;
    const color = rb ? 'rainbow' : S.threads.color;
    const count = S.rm ? 10 : 28;
    for (let i = 0; i < count; i++) {
      const p = this.allocParticle();
      if (!p) break;
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.2;
      const v = 75 + Math.random() * 240;
      p.kind = 'ribbon';
      p.x = cx;
      p.y = cy;
      p.vx = Math.cos(a) * v;
      p.vy = Math.sin(a) * v;
      p.life = 1.05;
      p.max = 1.05;
      p.r = 5 + Math.random() * 6;
      p.rot = a;
      p.vr = (Math.random() - 0.5) * 7;
      p.g = 130;
      p.color = color;
      p.off = i * 24;
    }
    S.whiteFlash = Math.max(S.whiteFlash, S.rm ? 0.14 : 0.4);
  }

  burstConfetti(S, n) {
    const count = Math.min(MAX_PARTICLES, n | 0);
    for (let i = 0; i < count; i++) {
      const p = this.allocParticle();
      if (!p) break;
      p.kind = 'ribbon';
      p.x = Math.random() * S.w;
      p.y = -16 - Math.random() * S.h * 0.22;
      p.vx = (Math.random() - 0.5) * 55;
      p.vy = 85 + Math.random() * 140;
      p.life = 2.4;
      p.max = 2.4;
      p.r = 4 + Math.random() * 4.5;
      p.rot = Math.random() * 6.28;
      p.vr = (Math.random() - 0.5) * 8;
      p.g = 38;
      p.color = 'rainbow';
      p.off = i * 31;
    }
  }

  addFlashes(S, n, at = null) {
    const total = Math.min(MAX_FLASHES, Math.max(0, n | 0));
    let spawned = 0;
    for (let i = 0; i < MAX_FLASHES && spawned < total; i++) {
      const f = this.flashPool[i];
      if (f.active) continue;
      f.active = true;
      f.delay = S.rm ? spawned * 0.22 : total > 6 ? Math.random() * 1.35 : spawned * 0.18;
      const side = Math.random() < 0.5 ? -1 : 1;
      f.x = at
        ? at.x + (Math.random() - 0.5) * at.spread * 2
        : side < 0
          ? S.w * (0.06 + Math.random() * 0.18)
          : S.w * (0.76 + Math.random() * 0.18);
      f.y = at ? at.y + (Math.random() - 0.5) * at.spread : S.h * (0.58 + Math.random() * 0.26);
      f.life = 0.16;
      f.max = 0.16;
      f.fired = false;
      spawned++;
    }
  }

  // ------------------------------------------------------------------ Single rAF Loop
  loop(S) {
    const frame = (now) => {
      if (S.closed || document.hidden) {
        S.raf = 0;
        return;
      }
      const dt = Math.min(0.05, Math.max(0.001, (now - S.last) / 1000));
      S.last = now;
      this.step(S, dt, now);
      S.raf = requestAnimationFrame(frame);
    };
    S.raf = requestAnimationFrame(frame);
  }

  step(S, dt, now) {
    const t = (now - S.t0) / 1000;

    // 1. Overlays & camera shake
    S.blackout += ((S.blackoutTarget || 0) - S.blackout) * Math.min(1, dt * 4.5);
    S.spot += ((S.spotTarget || 0) - S.spot) * Math.min(1, dt * 3.5);
    S.whiteFlash = Math.max(0, S.whiteFlash - dt * 2.4);
    S.shake = Math.max(0, S.shake - dt * 2.8);
    S.crackAlpha = Math.max(0, S.crackAlpha - dt * 2.2);

    if (S.blackEl) S.blackEl.style.opacity = S.blackout.toFixed(3);
    if (S.whiteEl) S.whiteEl.style.opacity = S.whiteFlash.toFixed(3);
    if (S.spotEl) S.spotEl.style.opacity = S.spot.toFixed(3);

    if (S.shake > 0) {
      S.root.style.transform = `translate3d(${((Math.random() - 0.5) * 9 * S.shake).toFixed(1)}px, ${((Math.random() - 0.5) * 9 * S.shake).toFixed(1)}px, 0)`;
    } else if (S.root.style.transform) {
      S.root.style.transform = '';
    }

    // 2. Native Retina 2D Catwalk Walker Kinematics
    if (S.walkActive && S.walkerEl) {
      S.walkT += dt;
      const k = S.walkDur > 0 ? clamp01(S.walkT / S.walkDur) : 1;
      const eased = easeOutCubic(k);
      S.walkProgress = eased;
      const yOffset = (1 - eased) * -142;
      const scale = 0.52 + eased * 0.54;
      const stride = Math.sin(k * Math.PI * 8);
      const bounceY = S.rm ? 0 : -Math.abs(stride) * 9 * (1 - k * 0.35);
      const swayDeg = S.rm ? 0 : stride * 2.4 * (1 - k * 0.5);

      S.walkerEl.style.transform = `translate3d(-50%, ${(yOffset + bounceY).toFixed(1)}px, 0) scale(${scale.toFixed(3)}) rotate(${swayDeg.toFixed(2)}deg)`;

      if (!S.rm && Math.random() < 0.28) {
        const p = this.allocParticle();
        if (p) {
          p.kind = 'spark';
          p.x = S.w * 0.5 + (Math.random() - 0.5) * 56;
          p.y = S.h * 0.56 + yOffset * 0.45;
          p.vx = (Math.random() - 0.5) * 28;
          p.vy = -18 - Math.random() * 24;
          p.life = 0.45;
          p.max = 0.45;
          p.r = 2.2;
          p.g = 0;
          p.color = S.bestTier >= 3 ? '#ffc94a' : '#b07cff';
        }
      }

      if (k >= 1) {
        S.walkActive = false;
        S.walkerEl.style.transform = 'translate3d(-50%, 0px, 0) scale(1.06)';
        const cb = S.onWalkArrive;
        S.onWalkArrive = null;
        cb?.();
      }
    }

    // 3. Pooled 2D FX Canvas
    const g = S.ctx;
    g.clearRect(0, 0, S.w, S.h);
    g.globalCompositeOperation = 'lighter';

    if (S.threads.active || S.phase === 'stitch') this.drawThreads(S, g, t);
    if (S.crackAlpha > 0.01) this.drawLightningCrack(S, g);
    if (S.auraOn) this.drawSuperMythicAura(S, g, t);

    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.particlePool[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const a = clamp01(p.life / p.max);
      g.globalAlpha = a;
      if (p.kind === 'ribbon') {
        p.rot += p.vr * dt;
        g.fillStyle = p.color === 'rainbow' ? rainbow(t, p.off) : p.color;
        g.save();
        g.translate(p.x, p.y);
        g.rotate(p.rot);
        g.fillRect(-p.r, -p.r * 0.32, p.r * 2, p.r * 0.64);
        g.restore();
      } else {
        g.fillStyle = p.color === 'rainbow' ? rainbow(t, p.x) : p.color;
        g.beginPath();
        g.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        g.fill();
      }
    }

    for (let i = 0; i < MAX_FLASHES; i++) {
      const f = this.flashPool[i];
      if (!f.active) continue;
      if (f.delay > 0) {
        f.delay -= dt;
        continue;
      }
      if (!f.fired) {
        f.fired = true;
        this.sfx.click();
        if (!S.rm) S.whiteFlash = Math.max(S.whiteFlash, 0.06);
      }
      f.life -= dt;
      if (f.life <= 0) {
        f.active = false;
        continue;
      }
      const a = clamp01(f.life / f.max);
      const R = S.rm ? 24 : 52;
      g.globalAlpha = a * 0.85;
      g.fillStyle = '#fff9e6';
      g.beginPath();
      g.arc(f.x, f.y, R * 0.38, 0, Math.PI * 2);
      g.fill();
      if (!S.rm) {
        g.fillStyle = '#ffffff';
        g.fillRect(f.x - R, f.y - 1.2, R * 2, 2.4);
        g.fillRect(f.x - 1.2, f.y - R, 2.4, R * 2);
      }
    }

    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  }

  drawThreads(S, g, t) {
    const th = S.threads;
    if (!th.active && th.k <= 0) return;
    const cx = S.w * 0.5;
    const cy = S.h * 0.44;
    const n = S.rm ? 3 : 6;
    const k = th.k;
    g.lineWidth = 2 + k * 2.4;
    for (let i = 0; i < n; i++) {
      if (th.snapped && !th.rainbow) continue;
      const ph = t * (3.2 + k * 8.5) + (i * Math.PI * 2) / n;
      const rx = 58 + 28 * Math.sin(ph * 0.7 + i);
      const ry = 115 + 18 * Math.cos(ph * 0.5);
      g.strokeStyle = th.color === 'rainbow' ? rainbow(t, i * 55) : th.color;
      g.globalAlpha = 0.35 + 0.55 * k;
      g.beginPath();
      g.moveTo(cx + Math.cos(ph) * rx, cy + Math.sin(ph) * ry * 0.38 - 36);
      g.bezierCurveTo(
        cx + Math.cos(ph + 1.2) * rx * 1.35,
        cy - 110,
        cx + Math.cos(ph + 2.2) * rx * 1.25,
        cy + 110,
        cx + Math.cos(ph + 3.1) * rx,
        cy + Math.sin(ph + 3.1) * ry * 0.45 + 36,
      );
      g.stroke();
    }
    g.globalAlpha = 1;
  }

  drawLightningCrack(S, g) {
    const cx = S.w * 0.5;
    const cy = S.h * 0.44;
    g.save();
    g.globalAlpha = S.crackAlpha;
    g.strokeStyle = '#ffffff';
    g.lineWidth = 3.5;
    g.beginPath();
    g.moveTo(cx - 170, cy - 120);
    g.lineTo(cx - 48, cy - 28);
    g.lineTo(cx + 22, cy - 52);
    g.lineTo(cx + 4, cy + 18);
    g.lineTo(cx + 155, cy + 115);
    g.stroke();
    g.restore();
  }

  drawSuperMythicAura(S, g, t) {
    const cx = S.w * 0.5;
    const cy = S.h * 0.5;
    const n = S.rm ? 6 : 16;
    for (let i = 0; i < n; i++) {
      const a = t * 2.1 + (i / n) * Math.PI * 2;
      const yk = (i / n + t * 0.32) % 1;
      const x = cx + Math.cos(a) * 96;
      const y = cy + 60 - yk * 180;
      g.globalAlpha = 0.72 * (1 - yk);
      g.fillStyle = rainbow(t, i * 22);
      g.beginPath();
      g.arc(x, y, 2.8 + 2.5 * (1 - yk), 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
  }
}

// ---------------------------------------------------------------------------------------------
// Singleton + Compatibility Exports (Couple/Gift WS chatter removed for clean solo performance)
// ---------------------------------------------------------------------------------------------
let RUNWAY = null;
export const getRunway = () => (RUNWAY ||= new RunwayReveal());

export function playRunwayForResult(r, opts = {}) {
  if (!r || !Array.isArray(r.items) || !r.items.length) return Promise.resolve();
  return getRunway().play({
    items: r.items,
    pullId: r.pullId || null,
    look: opts.look || r.look || {},
    pity: opts.pity || (r.smPityMax ? { sm: r.smPity | 0, smMax: r.smPityMax } : null),
  });
}

export function openPartnerGift(_giftId, _opts = {}) {
  return Promise.resolve({ ok: false, error: 'disabled' });
}

export function sendPartnerGift(_count = 1, _currency = 'diamonds', _message = '', _opts = {}) {
  return Promise.resolve({ ok: false, error: 'disabled' });
}

export function installRunwayNet(_net, _rpg = null, _opts = {}) {
  ensureRunwayCss();
  return getRunway();
}
