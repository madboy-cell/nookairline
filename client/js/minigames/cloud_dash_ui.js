// client/js/minigames/cloud_dash_ui.js — ☁️ Sky Cloud Dash V2 client (Phase 6B-1)
// Dedicated sky scene rendered through world.activeScene (village paused while racing).
// Own runner is predicted locally with the shared deterministic stepRunner(); rivals are
// extrapolated along the track between 5 Hz server snapshots. Spec: CLOUD_DASH_V2.md.
import * as THREE from 'three';
import { ChibiRig } from '../chibi_rig.js?v=cd26';
import { PetController } from '../pet_controller.js';
import { FxEngine } from '../fx_engine.js';
import {
  DASH_TUNING as T, createRunner, stepRunner, chainTier, computeRanking, displayKmh, speedMul, zoneOf,
  ultDefFor, deliverEffect, ITEM_DEFS, PET_RIDES, petRideFor,
} from '/shared/cloud_dash_rules.js';
import {
  detectBuild, buildNextStep, BUILD_PERKS, BUILDS, HYBRIDS,
  getWeeklyWeather, leagueTierFor, DASH_DAILY_CHEST_MAX, DASH_CHEST_BAR_MAX, SKY_WEATHERS,
} from '/shared/dash_builds.js';
import { computeUniversalStats } from '/shared/universal_stats.js';
import { buildTrack, TRACK_CONTROL_POINTS, ZONE_THEMES } from '/shared/cloud_dash_track.js';
import { normalizePetId, PETS } from '/shared/pet_catalog.js';
import { visibleSlotId } from '/shared/accessory_attach.js';
import { DashCoach } from './cloud_dash_coach.js?v=cd27';
import { ultSkinFor } from './cloud_dash_ult_skins.js?v=cd27';
import { MountVisualizer } from './cloud_dash_mounts.js?v=cd27';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const chibiPortraitUrl = (p) => {
  const lin = p?.lineage || 'bkk';
  const eq = p?.equipped;
  const outfit = p?.outfit || (eq ? visibleSlotId(eq, 'outfit') : null) || eq?.outfit?.id || (typeof eq?.outfit === 'string' ? eq.outfit : null);
  if (outfit && outfit !== 'newbie_outfit') return `/assets/chibi/${lin}_${outfit}_front.png`;
  return `/assets/chibi/${lin}_base_front.png`;
};
const chibiHairUrl = (p) => {
  const isGirl = p?.appearance?.body === 'girl' || (!p?.appearance?.body && (p?.lineage === 'dxb' || p?.lineage === 'girl'));
  const hairId = p?.appearance?.hair || p?.hair || (isGirl ? 'hair_girl_waves' : 'hair_boy_fluffy');
  return `/assets/chibi/${hairId}_front.png`;
};

// Pre-allocated scratch vectors for 60fps hot loop (0 GC allocations per frame)
const _tmpV1 = new THREE.Vector3();
const _tmpV2 = new THREE.Vector3();
const _tmpV3 = new THREE.Vector3();
const _tmpUp = new THREE.Vector3();
const _tmpLook = new THREE.Vector3();
const _tmpColor = new THREE.Color();

const PET_MOUNT_META = Object.freeze({
  pet_ragdoll:  { style: 'pounce', seatOffsetY: 0.66, saddle: 'cd_mount_ragdoll_cushion',   badge: '🐱 Royal Pounce',  sprite: 'ragdoll' },
  pet_nyx:      { style: 'flight', seatOffsetY: 0.72, saddle: 'cd_mount_nyx_harness',       badge: '🐉 Sky Flight',    sprite: 'nyx' },
  pet_kitsune:  { style: 'blink',  seatOffsetY: 0.68, saddle: 'cd_mount_kitsune_palanquin', badge: '🦊 Foxfire Blink', sprite: 'kitsune' },
  pet_skywhale: { style: 'surf',   seatOffsetY: 0.64, saddle: 'cd_mount_skywhale_surfboard', badge: '🐋 Whale Surf',    sprite: 'skywhale' },
});

const ASSET = '/assets/cloud_dash/';
const SAMPLE_STEP = 1;                 // meters between precomputed track frames
const ROAD_W = T.LANE_W * 3 + 0.9;
const VIEW_AHEAD = 115, VIEW_BEHIND = 18;
const REPORT_EVERY = 0.12;
const PLACE_TXT = ['1st', '2nd', '3rd', '4th'];
const SEAT_COLORS = ['#ff7eb6', '#7ecbff', '#ffd36e', '#a8f08a'];
const ITEM_EMOJI = { coin: '🪙', berry: '🍓', star: '🌟', orb: '🔮', cloud: '⛈️', prism: '🎁' };
const ITEM_SCALE = { coin: 0.95, berry: 0.95, star: 1.25, orb: 1.15, cloud: 2.1, prism: 1.2 };
const SKY_TOP_COLORS = [0xc0d9f0, 0xc196c3, 0x1b2b5f, 0xbac8c5];

// ------------------------------------------------------------------ textures
const texCache = new Map();
const rivalNameplateCache = new Map();
const PET_FX_READY = true;
const PET_FX_NAMES = new Set(['fx_heart_wave', 'fx_plasma_beam', 'fx_foxfire', 'fx_bubble_wave']);
const ULT_FX_READY = true;
const ULT_FX_NAMES = new Set([
  'ult_naga', 'ult_phoenix', 'ult_ra', 'ult_zeus', 'ult_carpet', 'ult_ice',
  'ult_torii', 'ult_astral', 'ult_777', 'ult_dolphin', 'ult_masque', 'ult_moon',
  'ult_clock', 'ult_eclipse_dragon', 'ult_aurora', 'ult_seraph', 'ult_cyber', 'ult_ribbon',
]);
const TRAIL_CELL_MAP = {
  sparkle: 'fx_stardust',
  flame: 'fx_flame',
  bubble: 'fx_bubble',
  snow: 'fx_snowflake',
  petal: 'fx_petal',
  star: 'fx_star',
  bolt: 'fx_lightning',
  chip: 'fx_chip',
  feather: 'fx_feather',
  data: 'fx_rune',
  ribbon: 'fx_stardust',
};
/** Load a texture; sprites get downscaled to opts.size (default 256, 512 for landmarks). Falls back to an emoji/procedural canvas. */
function loadTex(name, opts = {}) {
  const { sprite = false, fallback = null, repeat = false, size = 256, altName = null } = opts;
  const S = size || 256;
  const key = `${name}|${sprite}|${S}`;
  if (texCache.has(key)) return texCache.get(key);
  const tex = new THREE.Texture();
  tex.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.anisotropy = 4; }
  // big VFX sprites: never flash an emoji placeholder while the PNG streams in — stay invisible instead
  const isFx = PET_FX_NAMES.has(name) || ULT_FX_NAMES.has(name);
  if (fallback && !(isFx && (PET_FX_READY || ULT_FX_READY))) { tex.image = fallback(); tex.needsUpdate = true; }
  else if (isFx) { const c = document.createElement('canvas'); c.width = c.height = 2; tex.image = c; tex.needsUpdate = true; }
  if (!PET_FX_READY && PET_FX_NAMES.has(name)) {
    texCache.set(key, tex);
    return tex;
  }
  if (!ULT_FX_READY && ULT_FX_NAMES.has(name)) {
    texCache.set(key, tex);
    return tex;
  }
  const img = new Image();
  img.onload = () => {
    if (sprite) {
      const c = document.createElement('canvas');
      c.width = c.height = S;
      c.getContext('2d').drawImage(img, 0, 0, S, S);
      tex.image = c;
    } else {
      tex.image = img;
    }
    tex.needsUpdate = true;
  };
  let triedAlt = false;
  img.onerror = () => {
    if (!triedAlt && altName) {
      triedAlt = true;
      img.src = altName.startsWith('/') ? altName : `${ASSET}${altName}.png`;
    }
  };
  img.src = name.startsWith('/') ? name : `${ASSET}${name}.png`;
  texCache.set(key, tex);
  return tex;
}

function emojiCanvas(emoji, bg = null) {
  return () => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    if (bg) { g.fillStyle = bg; beginPathArc(g); }
    g.font = '92px serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(emoji, 64, 70);
    return c;
  };
}
function beginPathArc(g) { g.beginPath(); g.arc(64, 64, 58, 0, Math.PI * 2); g.fill(); }

function gradientCanvas(top, bottom, stripes = false) {
  return () => {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 256;
    const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, top); gr.addColorStop(1, bottom);
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    if (stripes) {
      g.fillStyle = 'rgba(255,248,215,0.65)';
      g.fillRect(83, 0, 5, 256); g.fillRect(168, 0, 5, 256);
      g.fillStyle = 'rgba(255,220,115,0.9)';
      g.fillRect(0, 0, 8, 256); g.fillRect(248, 0, 8, 256);
    }
    return c;
  };
}

function checkeredRugCanvas() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  const cols = 16, rows = 4, cw = 256 / cols, rh = 64 / rows;
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      g.fillStyle = (r + col) % 2 === 0 ? '#fffdf5' : '#e6a82e';
      g.fillRect(col * cw, r * rh, cw, rh);
    }
  }
  g.strokeStyle = '#3a2415';
  g.lineWidth = 4;
  g.strokeRect(2, 2, 252, 60);
  return c;
}

function rainbowPadCanvas() {
  return () => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#4a2b7c';
    g.beginPath(); g.roundRect(8, 8, 112, 112, 18); g.fill();
    g.lineWidth = 5; g.strokeStyle = '#ffd36e'; g.stroke();
    const colors = ['#ff7eb6', '#ffd36e', '#7ef5b8', '#7ecbff'];
    colors.forEach((col, idx) => {
      const y = 96 - idx * 22;
      g.strokeStyle = col; g.lineWidth = 9; g.lineCap = 'round';
      g.beginPath(); g.moveTo(26, y); g.lineTo(64, y - 20); g.lineTo(102, y); g.stroke();
    });
    return c;
  };
}

function landingRingCanvas() {
  return () => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 18, 64, 64, 60);
    gr.addColorStop(0, 'rgba(255,244,180,0.18)');
    gr.addColorStop(0.68, 'rgba(255,210,80,0.45)');
    gr.addColorStop(0.88, 'rgba(255,235,140,0.95)');
    gr.addColorStop(1, 'rgba(255,210,80,0)');
    g.fillStyle = gr;
    g.beginPath(); g.arc(64, 64, 60, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#ffd55a'; g.lineWidth = 4;
    g.beginPath(); g.arc(64, 64, 48, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = '#3a2415'; g.lineWidth = 2;
    g.beginPath(); g.arc(64, 64, 51, 0, Math.PI * 2); g.stroke();
    return c;
  };
}

function getRivalNameplateTex(place, name) {
  const rankIdx = Math.max(0, Math.min(3, (place || 2) - 1));
  const rankTxt = PLACE_TXT[rankIdx] || '2nd';
  const cleanName = String(name || 'Racer').slice(0, 14);
  const key = `${rankIdx}|${cleanName}`;
  if (rivalNameplateCache.has(key)) return rivalNameplateCache.get(key);
  const c = document.createElement('canvas');
  c.width = 320; c.height = 68;
  const g = c.getContext('2d');
  const label = `${rankIdx === 0 ? '👑 ' : ''}${rankTxt} • ${cleanName}`;
  g.font = '900 24px "Nunito", "Quicksand", sans-serif';
  const tw = Math.min(292, Math.max(136, g.measureText(label).width + 38));
  const x0 = (320 - tw) / 2, y0 = 10, h = 46, r = 23;
  const bg = g.createLinearGradient(0, y0, 0, y0 + h);
  bg.addColorStop(0, '#fff9ea');
  bg.addColorStop(1, '#f4e0b8');
  g.fillStyle = bg;
  g.beginPath(); g.roundRect(x0, y0, tw, h, r); g.fill();
  g.lineWidth = 4; g.strokeStyle = '#3a2415'; g.stroke();
  g.lineWidth = 2; g.strokeStyle = '#d49a2a';
  g.beginPath(); g.roundRect(x0 + 3, y0 + 3, tw - 6, h - 6, r - 2); g.stroke();
  g.fillStyle = '#3a2415';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(label, 160, y0 + h / 2 + 1);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  rivalNameplateCache.set(key, tex);
  return tex;
}

function puffCanvas() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 6, 64, 64, 62);
  gr.addColorStop(0, 'rgba(255,255,255,0.95)');
  gr.addColorStop(0.6, 'rgba(255,255,255,0.55)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return c;
}

// ------------------------------------------------------------------ tiny synth (no assets needed)
class DashAudio {
  constructor() { this.ctx = null; this.ladder = 0; this.ladderT = 0; }
  _c() {
    if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { this.ctx = null; } }
    if (this.ctx?.state === 'suspended') this.ctx.resume().catch(() => {});
    return this.ctx;
  }
  tone(freq, dur = 0.08, type = 'sine', vol = 0.06, slide = 0) {
    const c = this._c(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, c.currentTime);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq * slide), c.currentTime + dur);
    g.gain.setValueAtTime(vol, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime + dur + 0.02);
  }
  jelly(now) {
    if (now - this.ladderT > 1.2) this.ladder = 0;
    this.ladderT = now;
    const steps = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
    const n = steps[Math.min(steps.length - 1, this.ladder++)];
    this.tone(660 * Math.pow(2, n / 12), 0.07, 'triangle', 0.05);
  }
  chord(base = 523) { [0, 4, 7, 12].forEach((n, i) => setTimeout(() => this.tone(base * Math.pow(2, n / 12), 0.18, 'triangle', 0.05), i * 45)); }
  whoosh() { this.tone(220, 0.25, 'sawtooth', 0.03, 3); }
  thud() { this.tone(140, 0.18, 'square', 0.05, 0.4); }
  thump() { this.tone(110, 0.14, 'triangle', 0.08, 0.4); }
  whoom() { this.tone(90, 0.35, 'sine', 0.08, 0.5); }
  shing(stacks = 1) { this.tone(1100 + Math.min(5, stacks) * 220, 0.12, 'sawtooth', 0.05, 1.4); }
  chime() { this.chord(880); }
}

// ================================================================== CloudDashUI
export class CloudDashUI {
  constructor({ net, world, getProfile, toast, onExit } = {}) {
    this.net = net; this.world = world; this.getProfile = getProfile; this.toast = toast; this.onExit = onExit;
    this.active = false;
    this.audio = new DashAudio();
    this.keys = new Set();
    this._buildDom();
    this._bindKeys();
  }

  // ---------------------------------------------------------------- lifecycle
  open(table) {
    if (this.active && (!table?.id || this.tableId === table.id)) return;
    const hasSceneForTable = Boolean(this.scene && this.seed && (!table?.id || this.tableId === table.id));
    this.tableId = table?.id || this.tableId;
    this.active = true;
    this.root.hidden = false;
    this.results.hidden = true;
    document.getElementById('hud')?.setAttribute('hidden', '');
    if (!hasSceneForTable) this._buildScene();
    if (this.world) this.world.activeScene = this;
    this._banner('☁️ Sky Cloud Dash!', 1600);
  }

  close() {
    if (!this.active) return;
    this.active = false;
    this.root.hidden = true;
    if (this.world && this.world.activeScene === this) this.world.activeScene = null;
    this._disposeScene();
    this.seed = null;
    document.getElementById('hud')?.removeAttribute('hidden');
    this.onExit?.();
  }

  /** Socket messages. Return true when consumed. */
  handle(msg) {
    if (!msg || typeof msg.type !== 'string') return false;
    if (msg.type !== 'cd_state') return false;
    if (!this.active) this.open({ id: msg.tableId });
    this.tableId = msg.tableId;
    this._onState(msg);
    return true;
  }

  // world.activeScene interface
  update(dt) { if (this.active) this._frame(Math.min(dt, 0.05)); }
  render() {
    if (!this.active || !this.scene) return;
    const r = this.world.renderer;
    const el = r.domElement;
    const w = el.clientWidth || window.innerWidth, h = el.clientHeight || window.innerHeight;
    if (this.camera.aspect !== w / h) { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
    r.render(this.scene, this.camera);
  }

  // ---------------------------------------------------------------- server state
  _onState(m) {
    const now = performance.now();
    if (m.dashMode) this.dashMode = m.dashMode;
    if (m.ghost) this.ghostData = m.ghost;
    if (m.roster) this.roster = m.roster;
    let didInitRace = false;
    if (m.seed && (m.seed !== this.seed || (m.status === 'countdown' && this.status === 'ended') || (this.mySeat < 0 && m.roster))) {
      this._newRace(m);
      didInitRace = true;
    }
    this.status = m.status;
    if (m.status === 'countdown' || !this.goAtSet) {
      const goAt = now + m.goInMs;
      if (!this.goAtSet || Math.abs(goAt - this.goAt) > 120) this.goAt = goAt;
      this.goAtSet = true;
    }
    this.dnfAt = m.dnfInMs != null ? now + m.dnfInMs : null;
    for (const s of m.runners || []) {
      if (s.seat === this.mySeat) {
        this.serverPlace = s.place;
        this.heartWith = Array.isArray(s.hw) ? s.hw : [];
        if (didInitRace && m.status === 'playing' && this.runner && Number(s.s) > 1) {
          this.runner.s = Number(s.s) || 0;
          this.runner.laneF = Number(s.l) || 0;
          this.runner.y = Number(s.y) || 0;
          this.runner.v = Number(s.v) || 0;
          this.runner.deckH = Number(s.dh) || 0;
          this.runner.style = Number(s.style) || 0;
          this.runner.t = Math.max(0, -(Number(m.goInMs) || 0) / 1000);
          this.reportT = this.runner.t;
        }
        continue;
      }
      const rr = this.rivals.get(s.seat);
      if (!rr) continue;
      rr.target = { s: s.s, l: s.l, y: s.y, v: s.v, dh: s.dh || 0, at: now };
      rr.ride = !!s.ride; rr.ult = !!s.ult; rr.stumble = !!s.st; rr.fin = !!s.fin; rr.place = s.place; rr.style = s.style; rr.shrunk = !!s.sh; rr.shield = !!s.sd;
      if (rr.disp == null) rr.disp = { s: s.s, l: s.l, y: s.y, dh: s.dh || 0 };
    }
    if (m.traps) this.traps = m.traps;
    for (const fx of m.effects || []) {
      if (fx.to !== this.mySeat || this.seenFx?.has(fx.id) || !this.runner) continue;
      this.seenFx.add(fx.id);
      deliverEffect(this.runner, fx.kind, fx.from);
      const who = (this.roster || []).find((p) => p.seat === fx.from)?.name || 'A rival';
      if (fx.kind === 'shrink') { this._banner('⚡ INCOMING BOLT — JUMP!', 1000, 'hit'); this.audio.tone(1500, 0.3, 'sawtooth', 0.04, 0.5); }
      else if (fx.kind === 'slow') this._banner(`🕛 ${who}: Midnight Slow-Mo!`, 1100, 'near');
    }
    if (m.status === 'ended' && m.rewards && !this.resultsShown) {
      this.resultsShown = true;
      setTimeout(() => this._showResults(m), this.runner?.finished ? 900 : 200);
    }
  }

  _newRace(m) {
    this.seed = m.seed;
    this.dashMode = m.dashMode || 'quick';
    const rawW = m.weather || (this.dashMode === 'ghost' ? null : getWeeklyWeather().id);
    this.weather = typeof rawW === 'string' ? (SKY_WEATHERS.find((w) => w.id === rawW) || getWeeklyWeather()) : (rawW || getWeeklyWeather());
    if (this.dashMode === 'ghost') this.weather = null;
    this.ghostData = m.ghost || null;
    this.track = buildTrack(m.seed, { weather: this.weather?.id, chaos: this.dashMode === 'chaos', noPrisms: this.dashMode === 'ghost' });
    const prof = this.getProfile?.() || {};
    this.myId = prof.id || this.world?.local?.id;
    const me = (this.roster || []).find((p) => p.id === this.myId);
    this.mySeat = me ? me.seat : -1;           // -1 = spectator
    const outfitId = prof.equipped?.outfit?.id || me?.equipped?.outfit?.id || null;
    this.myPetId = normalizePetId(prof.equipped?.pet?.id || me?.petId || 'pet_ragdoll');
    this.myPetSprite = PETS[this.myPetId]?.sprite || 'ragdoll';
    this.runner = createRunner({ seat: this.mySeat, petStars: me?.petStars || 2, petId: this.myPetId, itemCount: this.track.items.length, mods: me?.mods || null, ult: ultDefFor(outfitId), seed: (m.seed * 131 + Math.max(0, this.mySeat) * 7919) >>> 0 });
    this.myBuild = me?.build || null; this.myUltName = me?.ultName || 'Rainbow Surge';
    this.acc = 0; this.reportT = 0; this.queue = { left: 0, right: 0, jump: 0, ult: 0, item: 0 };
    this.traps = []; this.seenFx = new Set();
    this._renderBuildBadge();
    this._syncPetBondHud();
    this.goAtSet = false; this.resultsShown = false; this.results.hidden = true;
    this.lastPlace = 0; this.finishedShown = false; this.slowmo = 0; this.shake = 0; this.fovKick = 0;
    this.raceStats = { rides: 0, ults: 0, rescues: 0, maxStreak: 0, nearMisses: 0, showcases: 0 };
    if (!this.coach) this.coach = new DashCoach(this.root, this.myId, this.myPetSprite);
    else this.coach.setPetSprite?.(this.myPetSprite);
    this.coach.newRace(this.myPetSprite);
    if (this.mySeat >= 0 && m.status === 'countdown') {
      const w = this.coach.countdownWhisper();
      setTimeout(() => this.coach.whisper(w), 500);
      if (this.weather) {
        setTimeout(() => {
          if (this.active) {
            const modeLabel = this.dashMode === 'chaos' ? '🎉 Chaos' : this.dashMode === 'league' ? '🏆 League' : this.dashMode === 'ghost' ? '👻 Ghost PB Sprint' : '⚡ Quick';
            this._banner(`${modeLabel} · ${this.weather.icon} ${this.weather.name}: ${this.weather.desc}`, 2200, 'chain');
          }
        }, 700);
      }
    }
    this._buildRoad();
    // preload pet-ride + ULT skin VFX + mount saddle textures so the first ULT/ride shows real art immediately
    for (const n of [...PET_FX_NAMES, ...ULT_FX_NAMES]) loadTex(n, { sprite: true });
    for (const mKey of ['cd_mount_saddle_royal', 'cd_mount_reins_gold', 'cd_mount_ragdoll_cushion', 'cd_mount_nyx_harness', 'cd_mount_kitsune_palanquin', 'cd_mount_skywhale_surfboard', 'cd_fx_wind_ribbon']) {
      loadTex(mKey, { sprite: true });
    }
    this._buildRunners();
    this._resetItemPool();
    this._updateHud(true);
  }

  _syncPetBondHud() {
    const meta = PET_MOUNT_META[this.myPetId] || PET_MOUNT_META.pet_ragdoll;
    if (this.el?.bondIco) {
      this.el.bondIco.src = `/assets/pets/${meta.sprite}_emo_joy.png`;
    }
    if (this.el?.bondTag) {
      this.el.bondTag.textContent = meta.badge;
    }
  }

  // ---------------------------------------------------------------- scene
  _buildScene() {
    this._disposeScene();
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(SKY_TOP_COLORS[0]);
    scene.fog = new THREE.Fog(0xffe6f2, 60, 170);
    this.scene = scene;
    this.camera = new THREE.PerspectiveCamera(62, 9 / 16, 0.1, 600);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xffd6ec, 1.2));
    try { this.fx = new FxEngine(scene); } catch { this.fx = null; }

    // centerline curve rescaled so arc length == TRACK_LEN
    let pts = TRACK_CONTROL_POINTS.map(([x, y, z]) => new THREE.Vector3(x, y, z));
    let curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const k = T.TRACK_LEN / curve.getLength();
    pts = pts.map((p) => p.multiplyScalar(k));
    curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    this.curve = curve;
    this._sampleFrames();

    // sky domes (band geometry around horizon avoids pole stretch; cross-fade between zones)
    this.skyMeshes = ZONE_THEMES.map((z, i) => {
      const mat = new THREE.MeshBasicMaterial({
        map: loadTex(z.sky, { fallback: gradientCanvas(['#ffd6ea', '#ffc2d8', '#b8dcff', '#ffe7a8'][i], '#fff6fb') }),
        side: THREE.BackSide, transparent: true, opacity: i === 0 ? 1 : 0, depthWrite: false, fog: false,
      });
      const m = new THREE.Mesh(new THREE.SphereGeometry(400, 48, 24, 0, Math.PI * 2, Math.PI * 0.18, Math.PI * 0.64), mat);
      m.renderOrder = -10;
      scene.add(m);
      return m;
    });

    // Hand-painted storybook cloud banks below/around the skyway (with puffCanvas as fallback)
    this.cloudMats = [
      new THREE.SpriteMaterial({ map: loadTex('cd_cloud_bank_a', { sprite: true, size: 512, fallback: puffCanvas }), transparent: true, depthWrite: false, fog: true }),
      new THREE.SpriteMaterial({ map: loadTex('cd_cloud_bank_b', { sprite: true, size: 512, fallback: puffCanvas }), transparent: true, depthWrite: false, fog: true }),
      new THREE.SpriteMaterial({ map: loadTex('/assets/village/env_cloud_fluffy_a.png', { sprite: true, size: 512, fallback: puffCanvas }), transparent: true, depthWrite: false, fog: true }),
    ];
    this.decor = new THREE.Group();
    this.cloudSprites = [];
    this.deckCloudSprites = [];
    let cIdx = 0;
    for (let s = 0; s < T.TRACK_LEN; s += 9) {
      for (let j = 0; j < 2; j++) {
        const sp = new THREE.Sprite(this.cloudMats[(cIdx++) % this.cloudMats.length]);
        const side = (Math.random() < 0.5 ? -1 : 1) * (5 + Math.random() * 14);
        const sCloud = s + Math.random() * 9;
        this._pos(sCloud, side / T.LANE_W, -3 - Math.random() * 7, sp.position);
        const sc = 7 + Math.random() * 10;
        sp.scale.set(sc, sc * 0.62, 1);
        sp.renderOrder = -3;
        sp.s = sCloud;
        sp.userData.s = sCloud;
        this.decor.add(sp);
        this.cloudSprites.push(sp);
      }
    }
    // landmarks (hi-res 512px 2.5D billboards)
    const lms = [
      ['lm_castle', 60, -1], ['lm_ferris', 170, 1], ['lm_pagoda', 330, -1], ['lm_pagoda', 430, 1],
      ['lm_observatory', 580, 1], ['lm_observatory', 690, -1], ['lm_castle', 860, -1], ['lm_finish_arch', T.TRACK_LEN, 0],
    ];
    for (const [name, s, side] of lms) {
      const mat = new THREE.SpriteMaterial({ map: loadTex(name, { sprite: true, size: 512, fallback: emojiCanvas(name === 'lm_finish_arch' ? '🏁' : '🏰') }), transparent: true, depthWrite: false, fog: true });
      const sp = new THREE.Sprite(mat);
      const arch = name === 'lm_finish_arch';
      this._pos(s, arch ? 0 : side * 40, arch ? 4.2 : 2, sp.position);
      sp.scale.set(arch ? 11 : 20, arch ? 9 : 20, 1);
      sp.renderOrder = -2;
      this.decor.add(sp);
    }
    scene.add(this.decor);

    this.itemGroup = new THREE.Group();
    scene.add(this.itemGroup);
    this.runnerGroup = new THREE.Group();
    scene.add(this.runnerGroup);
    this.petFxGroup = new THREE.Group();
    scene.add(this.petFxGroup);
    this._initPetFxPools();

    // Ground/deck Golden Landing Target Ring projected directly beneath airborne/riding player
    const lrMat = new THREE.MeshBasicMaterial({
      map: loadTex('cd_fx_landing_ring', { sprite: true, fallback: landingRingCanvas }),
      transparent: true, side: THREE.DoubleSide, depthWrite: false, opacity: 0.92,
    });
    this.landingRing = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), lrMat);
    this.landingRing.visible = false;
    this.landingRing.renderOrder = 3;
    scene.add(this.landingRing);

    this.rivals = new Map();
    this.camPos = null;
  }

  _disposeScene() {
    if (!this.scene) return;
    this.scene.traverse((o) => {
      o.geometry?.dispose?.();
      const m = o.material;
      if (Array.isArray(m)) m.forEach((x) => x.dispose?.()); else m?.dispose?.();
    });
    this.scene = null; this.rivals = new Map(); this.localRig = null; this.localPet = null;
    this.ghostRig = null; this.landingRing = null; this.cloudSprites = []; this.deckCloudSprites = [];
    this.petFxGroup = null; this.heartWavePool = null; this.plasmaBeamPool = null; this.afterimagePool = null;
    this.warpPortalPool = null; this.ultSignaturePool = null;
  }

  /** Parallel-transport frames every SAMPLE_STEP meters (no flips on the spiral). */
  _sampleFrames() {
    const n = Math.floor(T.TRACK_LEN / SAMPLE_STEP) + 1 + 40;
    this.fPos = []; this.fTan = []; this.fRight = []; this.fUp = [];
    let up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < n; i++) {
      const s = i * SAMPLE_STEP;
      let p, t;
      if (s <= T.TRACK_LEN) {
        const u = s / T.TRACK_LEN;
        p = this.curve.getPointAt(u); t = this.curve.getTangentAt(u).normalize();
      } else { // straight coast past the finish
        t = this.fTan[this.fTan.length - 1].clone();
        p = this.fPos[this.fPos.length - 1].clone().addScaledVector(t, SAMPLE_STEP);
      }
      up = up.clone().addScaledVector(t, -up.dot(t));
      // keep "up" leaning toward world up so the road never rolls over
      up.lerp(new THREE.Vector3(0, 1, 0).addScaledVector(t, -t.y), 0.15).normalize();
      const right = new THREE.Vector3().crossVectors(t, up).normalize();
      this.fPos.push(p); this.fTan.push(t); this.fRight.push(right); this.fUp.push(up.clone());
    }
  }

  _frameAt(s) {
    const n = this.fPos.length - 1;
    const x = Math.max(0, Math.min(n - 0.001, s / SAMPLE_STEP));
    const i = Math.floor(x), f = x - i;
    return { i, f, n };
  }

  /** (s, lane, y) → world position. lane may be fractional; |lane|>1 = off-road (decor). */
  _pos(s, lane, y = 0, out = new THREE.Vector3()) {
    const { i, f } = this._frameAt(s);
    out.copy(this.fPos[i]).lerp(this.fPos[i + 1], f);
    const r = this.fRight[i], u = this.fUp[i];
    out.addScaledVector(r, lane * T.LANE_W).addScaledVector(u, y);
    return out;
  }

  _buildRoad() {
    if (this.roadGroup) { this.scene.remove(this.roadGroup); this.roadGroup.traverse((o) => { o.geometry?.dispose?.(); }); }
    this.deckCloudSprites = [];
    const g = new THREE.Group();
    const pits = this.track.pits;
    const inPit = (s) => pits.some((p) => s > p.s0 && s < p.s1);
    const fallbacks = [gradientCanvas('#ffd1ea', '#c9e8ff', true), gradientCanvas('#ffc6da', '#ffe3ec', true), gradientCanvas('#cdeeff', '#e9dcff', true), gradientCanvas('#fffaf0', '#ffe9b0', true)];
    const skirtColors = [0xffcbe6, 0xffb8d2, 0xbfe4ff, 0xffe6a3];
    const goldCurbMat = new THREE.MeshBasicMaterial({ color: 0xf4c24d, side: THREE.DoubleSide });
    const starGuideMat = new THREE.MeshBasicMaterial({ color: 0xfff5b8, transparent: true, opacity: 0.72, side: THREE.DoubleSide, depthWrite: false });
    const halfLane = ROAD_W / 2 / T.LANE_W;

    for (let z = 0; z < 4; z++) {
      const s0 = T.ZONE_BOUNDS[z], s1 = z === 3 ? T.TRACK_LEN + T.FINISH_COAST : T.ZONE_BOUNDS[z + 1];
      const mat = new THREE.MeshBasicMaterial({ map: loadTex(ZONE_THEMES[z].track, { repeat: true, fallback: fallbacks[z] }), side: THREE.DoubleSide });
      const skirtMat = new THREE.MeshBasicMaterial({ color: skirtColors[z], side: THREE.DoubleSide });
      const pos = [], uv = [], idx = [];
      const cpos = [], cidx = []; // 3D bevelled royal-gold top curb (+0.28m)
      const spos = [], sidx = []; // 3D cream-marble & pastel bridge underside skirt (-0.38m)
      const gpos = [], gidx = []; // 3-Lane Starlight Guide Ribbons (lane = ±0.5)
      let vi = 0, cvi = 0, svi = 0, gvi = 0, prevOk = false;

      for (let s = s0; s <= s1 + 0.01; s += SAMPLE_STEP) {
        const ok = !inPit(s);
        const L = this._pos(s, -halfLane, 0, _tmpV1);
        const lx = L.x, ly = L.y, lz = L.z;
        const R = this._pos(s, halfLane, 0, _tmpV2);
        const rx = R.x, ry = R.y, rz = R.z;
        pos.push(lx, ly, lz, rx, ry, rz);
        uv.push(0, s / 6, 1, s / 6);
        if (prevOk && ok) idx.push(vi - 2, vi - 1, vi, vi - 1, vi + 1, vi);

        const { i } = this._frameAt(s);
        const up = this.fUp[i], right = this.fRight[i];

        // Chunky 3D bevelled curb along both edges (±roadHalf): +0.28m top bevel cap & -0.38m bridge underside skirt
        // Left curb vertices: L0 (inner road edge), L1 (inner top +0.28m), L2 (outer top +0.28m), L3 (outer lip +0.04m), L4 (underside skirt -0.38m)
        const l0x = lx + right.x * 0.06 + up.x * 0.02, l0y = ly + right.y * 0.06 + up.y * 0.02, l0z = lz + right.z * 0.06 + up.z * 0.02;
        const l1x = lx + up.x * 0.28, l1y = ly + up.y * 0.28, l1z = lz + up.z * 0.28;
        const l2x = lx - right.x * 0.34 + up.x * 0.28, l2y = ly - right.y * 0.34 + up.y * 0.28, l2z = lz - right.z * 0.34 + up.z * 0.28;
        const l3x = lx - right.x * 0.42 + up.x * 0.04, l3y = ly - right.y * 0.42 + up.y * 0.04, l3z = lz - right.z * 0.42 + up.z * 0.04;
        const l4x = lx - right.x * 0.24 - up.x * 0.38, l4y = ly - right.y * 0.24 - up.y * 0.38, l4z = lz - right.z * 0.24 - up.z * 0.38;

        // Right curb vertices
        const r0x = rx - right.x * 0.06 + up.x * 0.02, r0y = ry - right.y * 0.06 + up.y * 0.02, r0z = rz - right.z * 0.06 + up.z * 0.02;
        const r1x = rx + up.x * 0.28, r1y = ry + up.y * 0.28, r1z = rz + up.z * 0.28;
        const r2x = rx + right.x * 0.34 + up.x * 0.28, r2y = ry + right.y * 0.34 + up.y * 0.28, r2z = rz + right.z * 0.34 + up.z * 0.28;
        const r3x = rx + right.x * 0.42 + up.x * 0.04, r3y = ry + right.y * 0.42 + up.y * 0.04, r3z = rz + right.z * 0.42 + up.z * 0.04;
        const r4x = rx + right.x * 0.24 - up.x * 0.38, r4y = ry + right.y * 0.24 - up.y * 0.38, r4z = rz + right.z * 0.24 - up.z * 0.38;

        cpos.push(
          l0x, l0y, l0z, l1x, l1y, l1z, l2x, l2y, l2z,
          r0x, r0y, r0z, r1x, r1y, r1z, r2x, r2y, r2z
        );
        spos.push(
          l2x, l2y, l2z, l3x, l3y, l3z, l4x, l4y, l4z,
          r2x, r2y, r2z, r3x, r3y, r3z, r4x, r4y, r4z
        );
        if (prevOk && ok) {
          // Gold bevel top cap (2 quads per side = 4 tris per side)
          for (const off of [0, 3]) {
            const p0 = cvi - 6 + off, p1 = p0 + 1, p2 = p0 + 2;
            const q0 = cvi + off, q1 = q0 + 1, q2 = q0 + 2;
            cidx.push(p0, p1, q0, p1, q1, q0, p1, p2, q1, p2, q2, q1);
          }
          // Cream-marble & pastel outer bevel + -0.38m underside skirt
          for (const off of [0, 3]) {
            const p0 = svi - 6 + off, p1 = p0 + 1, p2 = p0 + 2;
            const q0 = svi + off, q1 = q0 + 1, q2 = q0 + 2;
            sidx.push(p0, p1, q0, p1, q1, q0, p1, p2, q1, p2, q2, q1);
          }
          // Bridge underside cross-skirt connecting left & right bottom lips
          sidx.push(svi - 4, svi - 1, svi + 2, svi - 1, svi + 5, svi + 2);
        }

        // 3-Lane Starlight Guide Ribbons along lane = -0.5 and lane = +0.5
        for (const divLane of [-0.5, 0.5]) {
          const dC = this._pos(s, divLane, 0.024, _tmpV3);
          const hw = 0.055;
          gpos.push(
            dC.x - right.x * hw, dC.y - right.y * hw, dC.z - right.z * hw,
            dC.x + right.x * hw, dC.y + right.y * hw, dC.z + right.z * hw
          );
        }
        if (prevOk && ok) {
          for (const off of [0, 2]) {
            const a0 = gvi - 4 + off, a1 = a0 + 1, b0 = gvi + off, b1 = b0 + 1;
            gidx.push(a0, a1, b0, a1, b1, b0);
          }
        }

        vi += 2; cvi += 6; svi += 6; gvi += 4; prevOk = ok;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.setIndex(idx);
      g.add(new THREE.Mesh(geo, mat));

      const sgeo = new THREE.BufferGeometry();
      sgeo.setAttribute('position', new THREE.Float32BufferAttribute(spos, 3));
      sgeo.setIndex(sidx);
      g.add(new THREE.Mesh(sgeo, skirtMat));

      const cgeo = new THREE.BufferGeometry();
      cgeo.setAttribute('position', new THREE.Float32BufferAttribute(cpos, 3));
      cgeo.setIndex(cidx);
      g.add(new THREE.Mesh(cgeo, goldCurbMat));

      const ggeo = new THREE.BufferGeometry();
      ggeo.setAttribute('position', new THREE.Float32BufferAttribute(gpos, 3));
      ggeo.setIndex(gidx);
      const starGuideMesh = new THREE.Mesh(ggeo, starGuideMat);
      starGuideMesh.renderOrder = -2;
      g.add(starGuideMesh);
    }
    // golden updraft rings over every gap
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffd76a, transparent: true, opacity: 0.85 });
    for (const p of pits) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.12, 8, 32), ringMat);
      const mid = (p.s0 + p.s1) / 2;
      this._pos(mid, 0, 1.8, ring.position);
      const { i } = this._frameAt(mid);
      ring.lookAt(_tmpLook.copy(ring.position).add(this.fTan[i]));
      g.add(ring);
    }
    // Grand starting line checkered gold-and-white rug + cd_arch_start archway billboard at s = 0, and finish line at TRACK_LEN
    {
      const rugTex = new THREE.CanvasTexture(checkeredRugCanvas());
      rugTex.colorSpace = THREE.SRGBColorSpace;
      const a = this._pos(0, -halfLane, 0.03).clone(), b = this._pos(0, halfLane, 0.03).clone();
      const c = this._pos(1.8, halfLane, 0.03).clone(), d = this._pos(1.8, -halfLane, 0.03).clone();
      const sGeo = new THREE.BufferGeometry();
      sGeo.setAttribute('position', new THREE.Float32BufferAttribute([a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, d.x, d.y, d.z], 3));
      sGeo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
      sGeo.setIndex([0, 1, 2, 0, 2, 3]);
      g.add(new THREE.Mesh(sGeo, new THREE.MeshBasicMaterial({ map: rugTex, side: THREE.DoubleSide })));

      const startArchMat = new THREE.SpriteMaterial({
        map: loadTex('cd_arch_start', { sprite: true, size: 512, altName: 'lm_finish_arch', fallback: emojiCanvas('🏁') }),
        transparent: true, depthWrite: false, fog: true,
      });
      const startArch = new THREE.Sprite(startArchMat);
      this._pos(0, 0, 4.1, startArch.position);
      startArch.scale.set(10.5, 8.5, 1);
      startArch.renderOrder = -1;
      g.add(startArch);

      const fa = this._pos(T.TRACK_LEN, -halfLane, 0.03).clone(), fb = this._pos(T.TRACK_LEN, halfLane, 0.03).clone();
      const fc = this._pos(T.TRACK_LEN + 1.5, halfLane, 0.03).clone(), fd = this._pos(T.TRACK_LEN + 1.5, -halfLane, 0.03).clone();
      const fGeo = new THREE.BufferGeometry();
      fGeo.setAttribute('position', new THREE.Float32BufferAttribute([fa.x, fa.y, fa.z, fb.x, fb.y, fb.z, fc.x, fc.y, fc.z, fd.x, fd.y, fd.z], 3));
      fGeo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
      fGeo.setIndex([0, 1, 2, 0, 2, 3]);
      g.add(new THREE.Mesh(fGeo, new THREE.MeshBasicMaterial({ map: rugTex, side: THREE.DoubleSide })));
    }
    // ☁️ Upper Cloud Deck elevated ribbon, hand-painted cloud banks, and golden updraft ring
    const dk = this.track.deck;
    if (dk) {
      this.deckMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        map: loadTex('track_sakura', { repeat: true, fallback: gradientCanvas('#ffffff', '#ffeef8', true) }),
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.96,
      });
      this.deckRailMat = new THREE.MeshBasicMaterial({
        color: 0xf4c24d,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.96,
      });
      const deckPos = [], deckUv = [], deckIdx = [], deckRpos = [], deckRidx = [];
      let dvi = 0, drvi = 0;
      for (let s = dk.s0 - 3; s <= dk.s1 + 0.01; s += SAMPLE_STEP) {
        let y = dk.y;
        if (s < dk.s0) {
          const t = Math.max(0, Math.min(1, (s - (dk.s0 - 3)) / 3));
          // Floating sky-deck lip starts at y = 2.6m (well above grounded runners on the lower road) and arches smoothly to y = 4.0m
          y = 2.6 + (dk.y - 2.6) * t * t * (3 - 2 * t);
        }
        const L = this._pos(s, -halfLane, y, _tmpV1);
        const R = this._pos(s, halfLane, y, _tmpV2);
        deckPos.push(L.x, L.y, L.z, R.x, R.y, R.z);
        deckUv.push(0, s / 6, 1, s / 6);
        if (dvi > 0) deckIdx.push(dvi - 2, dvi - 1, dvi, dvi - 1, dvi + 1, dvi);

        const { i } = this._frameAt(s);
        const up = this.fUp[i];
        deckRpos.push(
          L.x - up.x * 0.38, L.y - up.y * 0.38, L.z - up.z * 0.38,
          L.x + up.x * 0.28, L.y + up.y * 0.28, L.z + up.z * 0.28,
          R.x - up.x * 0.38, R.y - up.y * 0.38, R.z - up.z * 0.38,
          R.x + up.x * 0.28, R.y + up.y * 0.28, R.z + up.z * 0.28
        );
        if (drvi > 0) {
          deckRidx.push(drvi - 4, drvi - 3, drvi, drvi - 3, drvi + 1, drvi);
          deckRidx.push(drvi - 2, drvi - 1, drvi + 2, drvi - 1, drvi + 3, drvi + 2);
        }
        dvi += 2; drvi += 4;
      }
      if (drvi >= 4) {
        deckRidx.push(drvi - 4, drvi - 3, drvi - 1, drvi - 4, drvi - 1, drvi - 2);
      }
      const dgeo = new THREE.BufferGeometry();
      dgeo.setAttribute('position', new THREE.Float32BufferAttribute(deckPos, 3));
      dgeo.setAttribute('uv', new THREE.Float32BufferAttribute(deckUv, 2));
      dgeo.setIndex(deckIdx);
      g.add(new THREE.Mesh(dgeo, this.deckMat));

      const drgeo = new THREE.BufferGeometry();
      drgeo.setAttribute('position', new THREE.Float32BufferAttribute(deckRpos, 3));
      drgeo.setIndex(deckRidx);
      g.add(new THREE.Mesh(drgeo, this.deckRailMat));

      // Hand-painted storybook cloud banks along/under Upper Cloud Deck edges
      const cMats = this.cloudMats || [new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(puffCanvas()), transparent: true, opacity: 0.88, depthWrite: false })];
      let dCloudIdx = 0;
      const addDeckCloud = (sPos, lanePos, yPos, w, h) => {
        const sp = new THREE.Sprite(cMats[(dCloudIdx++) % cMats.length]);
        this._pos(sPos, lanePos, yPos, sp.position);
        sp.scale.set(w, h, 1);
        sp.renderOrder = -3;
        sp.s = sPos;
        sp.userData.s = sPos;
        g.add(sp);
        this.deckCloudSprites.push(sp);
      };
      for (let s = dk.s0 - 5; s <= dk.s1 + 2; s += 3) {
        let y = dk.y;
        if (s < dk.s0) {
          const t = Math.max(0, Math.min(1, (s - (dk.s0 - 6)) / 6));
          y = dk.y * t * t * (3 - 2 * t);
        }
        addDeckCloud(s, -halfLane - 0.25, y - 0.35, 4.4, 2.9);
        addDeckCloud(s, halfLane + 0.25, y - 0.35, 4.4, 2.9);
        if ((Math.round(s) % 6) < 3) {
          addDeckCloud(s, 0, y - 0.65, 6.2, 3.6);
        }
      }
      for (const lane of [-1, -0.3, 0.3, 1]) {
        addDeckCloud(dk.s1 + 0.5, lane * 1.5, dk.y - 0.2, 3.8, 2.5);
      }

      // golden updraft ring at dk.ring, lane 0, y≈1.3
      const deckRingMat = new THREE.MeshBasicMaterial({ color: 0xffdf6d, transparent: true, opacity: 0.92 });
      const deckRingMesh = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.14, 10, 36), deckRingMat);
      const ringGroup = new THREE.Group();
      this._pos(dk.ring, 0, 1.3, ringGroup.position);
      const { i: ri } = this._frameAt(dk.ring);
      ringGroup.lookAt(_tmpLook.copy(ringGroup.position).add(this.fTan[ri]));
      ringGroup.add(deckRingMesh);

      const innerGlow = new THREE.Mesh(
        new THREE.CircleGeometry(1.48, 24),
        new THREE.MeshBasicMaterial({ color: 0xffe680, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false })
      );
      innerGlow.renderOrder = -2;
      ringGroup.add(innerGlow);
      g.add(ringGroup);
      this.deckRingGroup = ringGroup;
      this.deckRingMesh = deckRingMesh;
    }
    this.roadGroup = g;
    this.scene.add(g);
  }

  // ---------------------------------------------------------------- items (pooled sprites)
  _resetItemPool() {
    if (!this.itemPool) {
      this.itemPool = [];
      this.padPool = [];
      const mats = {};
      for (const t of ['coin', 'berry', 'star', 'orb', 'cloud', 'prism']) {
        mats[t] = new THREE.SpriteMaterial({ map: loadTex(`${t === 'cloud' ? 'hazard' : 'pickup'}_${t}`, { sprite: true, fallback: emojiCanvas(ITEM_EMOJI[t]) }), transparent: true, depthWrite: false });
      }
      mats.trap = new THREE.SpriteMaterial({ map: loadTex('hazard_mochi', { sprite: true, fallback: emojiCanvas('🍡') }), transparent: true, depthWrite: false });
      this.trapPool = [];
      for (let i = 0; i < 12; i++) { const sp = new THREE.Sprite(mats.trap); sp.visible = false; this.trapPool.push(sp); }
      this.itemMats = mats;
      for (let i = 0; i < 90; i++) { const sp = new THREE.Sprite(mats.coin); sp.visible = false; this.itemPool.push(sp); }
      const padMat = new THREE.MeshBasicMaterial({
        map: loadTex('cd_pad_rainbow', { altName: 'pad_speed', fallback: rainbowPadCanvas() }),
        transparent: true, side: THREE.DoubleSide,
      });
      for (let i = 0; i < 8; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1.75, 2.35), padMat); m.visible = false; this.padPool.push(m); }
    }
    this.itemGroup.clear();
    for (const sp of this.itemPool) { sp.visible = false; this.itemGroup.add(sp); }
    for (const m of this.padPool) { m.visible = false; this.itemGroup.add(m); }
    for (const m of this.trapPool) { m.visible = false; this.itemGroup.add(m); }
  }

  _updateItems(camS, t) {
    const items = this.track.items, taken = this.runner.taken;
    let k = 0, kp = 0;
    const lo = camS - 18, hi = camS + 115;
    // binary search start
    let a = 0, b = items.length;
    while (a < b) { const m = (a + b) >> 1; if (items[m].s < lo) a = m + 1; else b = m; }
    for (let i = a; i < items.length; i++) {
      const it = items[i];
      if (it.s < lo || it.s > hi) {
        if (it.mesh) it.mesh.visible = false;
        if (it.s > hi) break;
        continue;
      }
      if (taken[i] && it.t !== 'pad') continue;
      if (it.t === 'pad') {
        if (kp >= this.padPool.length) continue;
        const m = this.padPool[kp++];
        m.visible = true;
        const padDeckH = it.deck ? (this.track.deck?.y || 0) : 0;
        this._pos(it.s, it.lane, 0.03 + padDeckH, m.position);
        const { i: fi } = this._frameAt(it.s);
        m.up.copy(this.fTan[fi]);
        m.lookAt(_tmpLook.copy(m.position).add(this.fUp[fi]));
        continue;
      }
      if (k >= this.itemPool.length) continue;
      const sp = this.itemPool[k++];
      sp.material = this.itemMats[it.t];
      const sc = ITEM_SCALE[it.t];
      const bob = it.t === 'cloud' ? 0.7 : 0.55 + Math.sin(t * 3 + i) * 0.08;
      const deckH = it.deck ? (this.track.deck?.y || 0) : 0;
      this._pos(it.s, it.lane, (it.y || 0) + bob + deckH, sp.position);
      const spin = it.t === 'coin' ? Math.max(0.25, Math.abs(Math.cos(t * 4 + i * 0.7))) : 1;
      sp.scale.set(sc * spin, sc * (it.t === 'cloud' ? 0.75 : 1), 1);
      sp.visible = true;
    }
    let kt = 0;
    for (const tr of this.traps || []) {
      if (kt >= this.trapPool.length || tr.s < lo || tr.s > hi || this.runner.trapsHit.includes(tr.id)) continue;
      const sp = this.trapPool[kt++];
      sp.visible = true;
      this._pos(tr.s, tr.lane, 0.7 + Math.abs(Math.sin(t * 5 + tr.id)) * 0.15, sp.position);
      sp.scale.set(1.5, 1.4, 1);
    }
    for (; kt < this.trapPool.length; kt++) this.trapPool[kt].visible = false;
    for (; k < this.itemPool.length; k++) this.itemPool[k].visible = false;
    for (; kp < this.padPool.length; kp++) this.padPool[kp].visible = false;
  }

  // ---------------------------------------------------------------- runners
  _buildRunners() {
    this.mounts?.dispose?.();
    this.mounts = new MountVisualizer(this.runnerGroup, this.fx);
    this.runnerGroup.clear();
    for (const rr of this.rivals.values()) rr.pet?.root?.parent?.remove(rr.pet.root);
    this.localPet?.root?.parent?.remove(this.localPet.root);
    if (this.ghostRig?.ROOT?.parent) this.ghostRig.ROOT.parent.remove(this.ghostRig.ROOT);
    this.ghostRig = null;
    this.rivals = new Map();
    const prof = this.getProfile?.() || {};
    for (const p of this.roster || []) {
      const isMe = p.seat === this.mySeat;
      const appearance = isMe ? prof.appearance || p.appearance : p.appearance;
      const equipped = isMe ? prof.equipped || p.equipped : p.equipped;
      const rig = new ChibiRig({ lineage: p.lineage, appearance, name: p.name, sub: '', wings: equipped?.wings?.id || null });
      try { rig.setEquipment(equipped || {}); if (appearance) rig.setAppearance?.(appearance); } catch {}
      if (rig.nameTag) rig.nameTag.visible = false;
      this.runnerGroup.add(rig.ROOT);
      const petId = normalizePetId(isMe && prof.equipped?.pet?.id ? prof.equipped.pet.id : (p.petId || 'pet_ragdoll'));
      let pet = null;
      try {
        const petCfg = isMe && prof.equipped?.pet?.id ? prof.equipped.pet : { id: petId, stars: p.petStars || 2 };
        pet = new PetController(petCfg, this.runnerGroup, this.fx, { stars: p.petStars || 2 });
        if (pet) this.mounts?.ensureMountRig?.(pet, petId);
      } catch { pet = null; }
      if (isMe) {
        this.localRig = rig;
        this.localPet = pet;
      } else {
        const rideStyle = petRideFor(petId).style;
        const npMat = new THREE.SpriteMaterial({
          map: getRivalNameplateTex(p.place || 2, p.name),
          transparent: true, depthWrite: false,
        });
        const nameplate = new THREE.Sprite(npMat);
        nameplate.position.set(0, 1.92, 0);
        nameplate.scale.set(1.75, 0.37, 1);
        nameplate.renderOrder = 14;
        rig.ROOT.add(nameplate);
        this.rivals.set(p.seat, {
          seat: p.seat, name: p.name, rig, pet, petId, nameplate, lastPlatePlace: p.place || 2,
          target: null, disp: null, place: 0, rideStyle, outfitId: equipped?.outfit?.id || null,
        });
      }
    }
    if (this.ghostData && Array.isArray(this.ghostData.samples) && this.ghostData.samples.length > 1) {
      try {
        this.ghostRig = new ChibiRig({
          lineage: prof.lineage || 'bkk',
          appearance: prof.appearance,
          name: '',
          sub: '',
          wings: prof.equipped?.wings?.id || null,
        });
        this.ghostRig.setEquipment(prof.equipped || {});
        if (prof.appearance) this.ghostRig.setAppearance?.(prof.appearance);
        this.ghostRig.ROOT.traverse((o) => {
          if (o.material) {
            o.material = o.material.clone();
            o.material.transparent = true;
            o.material.opacity = (o.material.opacity != null ? o.material.opacity : 1) * 0.48;
            o.material.depthWrite = false;
            if (o.material.color) {
              o.material.color.lerp(new THREE.Color(0x80e5ff), 0.45);
            }
          }
        });
        this.runnerGroup.add(this.ghostRig.ROOT);
      } catch (err) {
        this.ghostRig = null;
      }
    }
  }

  _initPetFxPools() {
    this.heartWavePool = [];
    const hwMat = new THREE.MeshBasicMaterial({
      map: loadTex('fx_heart_wave', { sprite: true, fallback: emojiCanvas('💖') }),
      transparent: true, side: THREE.DoubleSide, depthWrite: false, opacity: 1,
    });
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), hwMat.clone());
      m.visible = false;
      this.heartWavePool.push(m);
      this.petFxGroup.add(m);
    }

    this.plasmaBeamPool = [];
    const beamMat = new THREE.MeshBasicMaterial({
      map: loadTex('fx_plasma_beam', { sprite: true, fallback: emojiCanvas('🟣') }),
      blending: THREE.NormalBlending,
      transparent: true, side: THREE.DoubleSide, depthWrite: false, opacity: 0.95,
    });
    const makeBeamGeo = (rotZ = 0) => {
      const geo = new THREE.PlaneGeometry(1.45, 1);
      // Rotate UVs 90° so the horizontal fx_plasma_beam.png runs lengthwise along the Z beam
      const uv = geo.attributes.uv;
      for (let k = 0; k < uv.count; k++) {
        const u = uv.getX(k), v = uv.getY(k);
        uv.setXY(k, v, u);
      }
      geo.translate(0, 0.5, 0);
      geo.rotateX(Math.PI / 2);
      if (rotZ) geo.rotateZ(rotZ);
      return geo;
    };
    for (let i = 0; i < 4; i++) {
      const g = new THREE.Group();
      const beamGroup = new THREE.Group();
      const p1 = new THREE.Mesh(makeBeamGeo(0), beamMat.clone());
      p1.renderOrder = 4;
      const p2 = new THREE.Mesh(makeBeamGeo(Math.PI / 2), beamMat.clone());
      p2.renderOrder = 4;
      beamGroup.add(p1); beamGroup.add(p2);
      g.add(beamGroup);

      const flashMat = new THREE.SpriteMaterial({
        map: loadTex('fx_foxfire', { sprite: true, fallback: emojiCanvas('💥') }),
        blending: THREE.NormalBlending,
        transparent: true, depthWrite: false, opacity: 0.95,
        color: new THREE.Color(0xdf88ff),
      });
      const flash = new THREE.Sprite(flashMat);
      flash.scale.set(2.2, 2.2, 1);
      flash.renderOrder = 5;
      g.add(flash);

      g.userData = { beamGroup, p1, p2, flash, age: 0, maxAge: 0.6, followRunner: true };
      g.visible = false;
      this.plasmaBeamPool.push(g);
      this.petFxGroup.add(g);
    }

    this.afterimagePool = [];
    for (let i = 0; i < 6; i++) {
      const g = new THREE.Group();
      const s1 = new THREE.Sprite(new THREE.SpriteMaterial({
        map: loadTex('fx_foxfire', { sprite: true, fallback: emojiCanvas('🔥') }),
        transparent: true, depthWrite: false, opacity: 0.45, color: new THREE.Color(0xff88dd),
      }));
      s1.scale.set(1.4, 1.4, 1);
      const s2 = new THREE.Sprite(new THREE.SpriteMaterial({
        map: loadTex('fx_foxfire', { sprite: true, fallback: emojiCanvas('🔥') }),
        transparent: true, depthWrite: false, opacity: 0.45, color: new THREE.Color(0x44eeff),
      }));
      s2.scale.set(1.2, 1.2, 1);
      s2.position.set(0.2, 0.2, 0);
      g.add(s1); g.add(s2);
      g.visible = false;
      this.afterimagePool.push(g);
      this.petFxGroup.add(g);
    }

    this.warpPortalPool = [];
    for (let i = 0; i < 4; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        transparent: true, depthWrite: false, opacity: 0.9,
      }));
      sp.visible = false;
      this.warpPortalPool.push(sp);
      this.petFxGroup.add(sp);
    }

    this.ultSignaturePool = [];
    for (let i = 0; i < 3; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        transparent: true, depthWrite: false, opacity: 1,
      }));
      sp.visible = false;
      this.ultSignaturePool.push(sp);
      this.petFxGroup.add(sp);
    }
  }

  _spawnHeartWave(s, lane) {
    if (!this.heartWavePool) return;
    const m = this.heartWavePool.find((x) => !x.visible) || this.heartWavePool[0];
    const { i: fi } = this._frameAt(s);
    m.position.copy(this._pos(s, lane, 0.06));
    m.up.copy(this.fTan[fi]);
    m.lookAt(m.position.clone().add(this.fUp[fi]));
    m.scale.set(0.5, 0.5, 1);
    m.material.opacity = 1;
    m.userData = { age: 0, maxAge: 0.5 };
    m.visible = true;
  }

  _spawnPlasmaBeam(s, lane) {
    if (!this.plasmaBeamPool) return;
    const b = this.plasmaBeamPool.find((x) => !x.visible) || this.plasmaBeamPool[0];
    const beamY = Math.max(0.75, (this.runner?.y || 0) + 0.55);
    const pStart = this._pos(s + 1.2, lane, beamY);
    const pEnd = this._pos(s + 18, lane, beamY);
    b.position.copy(pStart);
    b.lookAt(pEnd);
    const dist = pStart.distanceTo(pEnd);
    b.userData.beamGroup.scale.set(1, 1, dist);
    b.userData.age = 0;
    b.userData.maxAge = 0.6;
    b.userData.lane = lane;
    b.userData.p1.material.opacity = 0.95;
    b.userData.p2.material.opacity = 0.95;
    if (b.userData.flash) {
      b.userData.flash.material.opacity = 0.95;
      b.userData.flash.scale.set(2.2, 2.2, 1);
    }
    b.visible = true;
  }

  _spawnAfterimage(s, lane, y) {
    if (!this.afterimagePool) return;
    const a = this.afterimagePool.find((x) => !x.visible) || this.afterimagePool[0];
    a.position.copy(this._pos(s, lane, (y || 0) + 0.6));
    a.userData = { age: 0, maxAge: 0.35 };
    a.children.forEach((c) => { c.material.opacity = 0.45; });
    a.visible = true;
  }

  _spawnBubbleRing(s, lane, y) {
    const center = this._pos(s - 0.6, lane, (y || 0) + 0.3);
    const { i: fi } = this._frameAt(s);
    const right = this.fRight[fi], up = this.fUp[fi];
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      const rX = Math.cos(ang), rY = Math.sin(ang);
      const bx = center.x + (right.x * rX + up.x * rY) * 0.4;
      const by = center.y + (right.y * rX + up.y * rY) * 0.4;
      const bz = center.z + (right.z * rX + up.z * rY) * 0.4;
      try { this.fx?.emit('fx_bubble', bx, by, bz, 1, { tint: [0.7, 1.0, 1.4], speed: 1.2, up: rY * 0.5, life: 0.55, size: 0.35 }); } catch {}
    }
  }

  _spawnWarpPortals(skin, fromS, toS, lane, y) {
    if (!this.warpPortalPool) return;
    const p1 = this.warpPortalPool.find((x) => !x.visible) || this.warpPortalPool[0];
    const p2 = this.warpPortalPool.find((x) => !x.visible && x !== p1) || this.warpPortalPool[1];
    const tex = loadTex(skin.sprite, { sprite: true, fallback: emojiCanvas(skin.emoji || '🌀') });
    const bSc = skin.sovereign ? 3.8 : 2.8;

    p1.material.map = tex;
    p1.material.needsUpdate = true;
    p1.material.opacity = 0.9;
    p1.position.copy(this._pos(fromS, lane, (y || 0) + 0.8));
    p1.scale.set(bSc, bSc, 1);
    p1.userData = { age: 0, maxAge: 0.9, baseScale: bSc };
    p1.visible = true;

    p2.material.map = tex;
    p2.material.needsUpdate = true;
    p2.material.opacity = 0.9;
    p2.position.copy(this._pos(toS, lane, (y || 0) + 0.8));
    p2.scale.set(bSc, bSc, 1);
    p2.userData = { age: 0, maxAge: 0.9, baseScale: bSc };
    p2.visible = true;
  }

  _spawnUltSignature(skin, s, lane, y) {
    if (!this.ultSignaturePool) return;
    const sp = this.ultSignaturePool.find((x) => !x.visible) || this.ultSignaturePool[0];
    const bSc = skin.sovereign ? 3.6 : 2.6;
    sp.material.map = loadTex(skin.sprite, { sprite: true, fallback: emojiCanvas(skin.emoji || '✨') });
    sp.material.needsUpdate = true;
    sp.material.opacity = 1;
    sp.position.copy(this._pos(s, lane, (y || 0) + 1.0));
    sp.scale.set(bSc * 0.7, bSc * 0.7, 1);
    sp.userData = { age: 0, maxAge: 0.24, baseScale: bSc, followRunner: true };
    sp.visible = true;

    const p = this._pos(s, lane, (y || 0) + 1.0);
    const hex = skin.palette?.[0] || 0xffffff;
    const tr = (((hex >> 16) & 255) / 255) * 1.5;
    const tg = (((hex >> 8) & 255) / 255) * 1.5;
    const tb = ((hex & 255) / 255) * 1.5;
    const { i: fi } = this._frameAt(s);
    const tan = this.fTan[fi];
    const cell = TRAIL_CELL_MAP[skin.trail] || 'fx_star';
    try {
      const made = this.fx?.emit(cell, p.x, p.y, p.z, skin.sovereign ? 10 : 6, {
        tint: [tr, tg, tb],
        speed: 1.0,
        up: 0.6,
        life: 0.20,
        size: skin.sovereign ? 0.35 : 0.25,
      });
      if (made && this.fx?.pool && tan) {
        for (let i = this.fx._active - made; i < this.fx._active; i++) {
          const pt = this.fx.pool[i];
          if (pt) {
            pt.vx -= tan.x * 2.0;
            pt.vy -= tan.y * 2.0;
            pt.vz -= tan.z * 2.0;
          }
        }
      }
    } catch {}
  }

  _updatePetFx(dt) {
    if (this.heartWavePool) {
      for (const m of this.heartWavePool) {
        if (!m.visible) continue;
        m.userData.age += dt;
        const k = m.userData.age / m.userData.maxAge;
        if (k >= 1) { m.visible = false; }
        else {
          const sc = 0.5 + k * 2.5;
          m.scale.set(sc, sc, 1);
          m.material.opacity = 1 - k;
        }
      }
    }
    if (this.plasmaBeamPool) {
      for (const b of this.plasmaBeamPool) {
        if (!b.visible) continue;
        b.userData.age += dt;
        const k = b.userData.age / b.userData.maxAge;
        if (k >= 1) { b.visible = false; }
        else {
          if (this.runner) {
            const curS = this.runner.s;
            const curLane = this.runner.laneF ?? b.userData.lane ?? 0;
            const beamY = Math.max(0.75, (this.runner.y || 0) + 0.55);
            const pStart = this._pos(curS + 1.2, curLane, beamY, _tmpV1);
            const pEnd = this._pos(curS + 18, curLane, beamY, _tmpV2);
            b.position.copy(pStart);
            b.lookAt(pEnd);
          }
          const easeOut = 1 - k * k;
          const op = 0.95 * easeOut;
          if (b.userData.p1) b.userData.p1.material.opacity = op;
          if (b.userData.p2) b.userData.p2.material.opacity = op;
          if (b.userData.flash) {
            b.userData.flash.material.opacity = op;
            const fSc = 2.2 * (1 - k * 0.3);
            b.userData.flash.scale.set(fSc, fSc, 1);
          }
        }
      }
    }
    if (this.warpPortalPool) {
      for (const p of this.warpPortalPool) {
        if (!p.visible) continue;
        p.userData.age += dt;
        const k = p.userData.age / p.userData.maxAge;
        if (k >= 1) {
          p.visible = false;
        } else {
          p.material.opacity = (1 - k) * 0.9;
          const sc = p.userData.baseScale * (0.8 + k * 0.5);
          p.scale.set(sc, sc, 1);
          p.material.rotation = (p.material.rotation || 0) + dt * 3.5;
        }
      }
    }
    if (this.ultSignaturePool) {
      for (const sp of this.ultSignaturePool) {
        if (!sp.visible) continue;
        sp.userData.age += dt;
        const k = sp.userData.age / sp.userData.maxAge;
        if (k >= 1) {
          sp.visible = false;
        } else {
          sp.material.opacity = 1 - k;
          const sc = sp.userData.baseScale * (0.7 + k * 0.5);
          sp.scale.set(sc, sc, 1);
          if (sp.userData.followRunner && this.runner) {
            this._pos(this.runner.s, this.runner.laneF, (this.runner.y || 0) + 1.0, sp.position);
          }
        }
      }
    }
    if (this.afterimagePool) {
      for (const a of this.afterimagePool) {
        if (!a.visible) continue;
        a.userData.age += dt;
        const k = a.userData.age / a.userData.maxAge;
        if (k >= 1) { a.visible = false; }
        else {
          const op = (1 - k) * 0.45;
          a.children.forEach((c) => { c.material.opacity = op; });
        }
      }
    }
  }

  _updateWisps(rig, pet, s, lane, y, blinkStacks, dt) {
    if (!rig._wisps) {
      rig._wisps = [];
      for (let i = 0; i < 6; i++) {
        const isPink = (i % 2) === 0;
        const w = new THREE.Sprite(new THREE.SpriteMaterial({
          map: loadTex('fx_foxfire', { sprite: true, fallback: emojiCanvas('🔥') }),
          transparent: true, depthWrite: false, opacity: 0.85,
          color: new THREE.Color(isPink ? 0xff7eb6 : 0x4deeea),
        }));
        w.scale.set(0.65, 0.65, 1);
        w.visible = false;
        rig._wisps.push(w);
        this.runnerGroup.add(w);
      }
    }
    rig._wispT = (rig._wispT || 0) + dt;
    const count = Math.min(6, 1 + (blinkStacks || 0));
    const { i: fi } = this._frameAt(s);
    const r = this.fRight[fi], u = this.fUp[fi], t = this.fTan[fi];
    const petPos = pet ? pet.root.position : this._pos(s, lane, y, _tmpV3);
    for (let k = 0; k < 6; k++) {
      const sp = rig._wisps[k];
      if (k < count) {
        sp.visible = true;
        const th = rig._wispT * 4.2 + (k * Math.PI * 2) / count;
        sp.position.copy(petPos)
          .addScaledVector(r, Math.cos(th) * 1.15)
          .addScaledVector(t, Math.sin(th) * 0.85)
          .addScaledVector(u, 0.55 + Math.sin(th * 2) * 0.2);
      } else {
        sp.visible = false;
      }
    }
  }

  _updateSurfWave(rig, pet, s, lane, y, dt) {
    if (!rig._surfWave) {
      rig._surfWave = new THREE.Sprite(new THREE.SpriteMaterial({
        map: loadTex('fx_bubble_wave', { sprite: true, fallback: emojiCanvas('🌊') }),
        transparent: true, depthWrite: false, opacity: 0.88,
      }));
      rig._surfWave.center.set(0.5, 0.15);
      rig._surfWave.scale.set(2.35, 1.25, 1);
      rig._surfWave.renderOrder = 0.5;
      rig._surfWave.visible = false;
      this.runnerGroup.add(rig._surfWave);
    }
    rig._surfRollT = (rig._surfRollT || 0) + dt;
    this._pos(s - 0.15, lane, Math.max(0.02, y - 0.18), rig._surfWave.position);
    const pulse = Math.sin(rig._surfRollT * 4) * 0.1;
    rig._surfWave.scale.set(2.35 + pulse * 0.22, 1.25 + pulse * 0.12, 1);
    rig._surfWave.material.opacity = 0.88;
    rig._surfWave.visible = true;

    rig._bubbleTimer = (rig._bubbleTimer || 0) - dt;
    if (rig._bubbleTimer <= 0) {
      rig._bubbleTimer = 0.12;
      const pb = this._pos(s - 0.8, lane, y + 0.3, _tmpV3);
      try { this.fx?.emit('fx_bubble', pb.x, pb.y, pb.z, 2, { tint: [0.7, 1.0, 1.4], speed: 0.7, up: 0.4, life: 0.45, size: 0.3 }); } catch {}
    }
  }

  _updateUltAura(rig, isRival, s, lane, y, outfitId, arch, dt) {
    const skin = ultSkinFor(outfitId, arch);
    const isSm = !!skin.sovereign;
    if (!rig._ultAura) {
      rig._ultAura = new THREE.Sprite(new THREE.SpriteMaterial({
        map: loadTex(skin.sprite, { sprite: true, fallback: emojiCanvas(skin.emoji || '✨') }),
        transparent: true, depthWrite: false, opacity: 0.9,
      }));
      this.runnerGroup.add(rig._ultAura);
    }
    if (rig._currentUltSkin !== skin.sprite) {
      rig._currentUltSkin = skin.sprite;
      rig._ultAura.material.map = loadTex(skin.sprite, { sprite: true, fallback: emojiCanvas(skin.emoji || '✨') });
      rig._ultAura.material.needsUpdate = true;
    }
    rig._ultAura.visible = true;
    rig._ultT = (rig._ultT || 0) + dt;

    const aType = arch || 'surge';
    let sOff = 0, yOff = 0;
    let baseW = isSm ? 3.6 : 2.6;
    let baseH = isSm ? 3.6 : 2.6;

    if (aType === 'flight') {
      if (outfitId === 'sm_seraphim_rose') {
        sOff = -0.15; yOff = 0.5; baseW = 2.2; baseH = 2.0;
      } else if (outfitId === 's3_sultan_djinn') {
        sOff = 0.15; yOff = -0.2; baseW = 2.4; baseH = 1.6;   // carpet right under the feet (rig origin = feet)
      } else {
        sOff = 0.1; yOff = -0.35; baseW = isSm ? 3.8 : 2.8; baseH = isSm ? 2.4 : 1.8;
      }
    } else if (aType === 'surge') {
      sOff = -0.9; yOff = 0.1;
    } else if (aType === 'warp') {
      sOff = 0; yOff = 0.1; baseW = isSm ? 3.4 : 2.5; baseH = isSm ? 3.4 : 2.5;
    } else if (aType === 'clear') {
      sOff = 2.4; yOff = 0.1; baseW = isSm ? 4.0 : 3.0; baseH = isSm ? 4.0 : 3.0;
    } else if (aType === 'control') {
      sOff = 0; yOff = 0.1; baseW = isSm ? 3.4 : 2.6; baseH = isSm ? 3.4 : 2.6;
    }

    if (aType === 'control') {
      rig._ultAura.material.rotation = (rig._ultAura.material.rotation || 0) + dt * 2.5;
    } else {
      rig._ultAura.material.rotation = 0;
    }

    this._pos(s + sOff, lane, Math.max(0.1, y + yOff), rig._ultAura.position);
    const bob = Math.sin(rig._ultT * 5) * 0.1;
    rig._ultAura.scale.set(baseW + bob, baseH + bob, 1);

    const interval = isRival ? 0.22 : (isSm ? 0.045 : 0.08);
    rig._ultTrailTimer = (rig._ultTrailTimer || 0) - dt;
    if (rig._ultTrailTimer <= 0) {
      rig._ultTrailTimer = interval;
      const palette = skin.palette || [0xffffff];
      const colIdx = Math.floor(Math.random() * palette.length);
      const hex = palette[colIdx];
      const tr = (((hex >> 16) & 255) / 255) * 1.4;
      const tg = (((hex >> 8) & 255) / 255) * 1.4;
      const tb = ((hex & 255) / 255) * 1.4;
      const cell = TRAIL_CELL_MAP[skin.trail] || 'fx_star';
      const trailPos = this._pos(s - 0.4, lane, y + 0.3, _tmpV3);
      const { i: fi } = this._frameAt(s);
      const tan = this.fTan[fi];
      try {
        const count = isRival ? 1 : (isSm ? 3 : 2);
        const made = this.fx?.emit(cell, trailPos.x, trailPos.y, trailPos.z, count, {
          tint: [tr, tg, tb],
          speed: 0.5,
          up: 0.3,
          life: isRival ? 0.18 : (isSm ? 0.20 : 0.24),
          size: isSm ? 0.32 : 0.26,
        });
        if (made && this.fx?.pool && tan) {
          for (let i = this.fx._active - made; i < this.fx._active; i++) {
            const pt = this.fx.pool[i];
            if (pt) {
              pt.vx -= tan.x * 2.0;
              pt.vy -= tan.y * 2.0;
              pt.vz -= tan.z * 2.0;
            }
          }
        }
      } catch {}
    }
  }

  _placeRunnerVisual(rig, pet, s, lane, y, opts, dt, cam) {
    const riding = !!opts.ride;
    const style = opts.style || 'pounce';
    const meta = PET_MOUNT_META[opts.petId] || Object.values(PET_MOUNT_META).find((x) => x.style === style) || PET_MOUNT_META.pet_ragdoll;
    const seatOffsetY = meta.seatOffsetY; // ~0.64–0.72m seated in saddle
    const petY = riding && style === 'surf' ? y * 0.65 : y;
    const riderY = petY + (riding ? seatOffsetY : 0);

    const p = this._pos(s, lane, riderY, _tmpV1);
    rig.ROOT.position.copy(p);
    if (opts.ult) {
      const arch = opts.arch || opts.ultDef?.arch || opts.ultDef?.type;
      this._updateUltAura(rig, !!opts.rival, s, lane, riderY, opts.outfitId, arch, dt);
    } else if (rig._ultAura && rig._ultAura.visible) {
      rig._ultAura.visible = false;
    }

    const inAir = y > 0.1;
    const vy = opts.vy || 0;
    const pitch = riding
      ? (style === 'pounce' && inAir ? Math.min(0.32, Math.max(-0.05, vy > 0 ? 0.20 : 0.30)) : THREE.MathUtils.clamp(-vy * 0.02, -0.14, 0.14))
      : 0;
    const bank = riding ? THREE.MathUtils.clamp(-opts.laneVel * 0.025, -0.22, 0.22) : 0;

    const ridingState = riding ? {
      style,
      petId: opts.petId || meta.sprite,
      phase: (this.t || 0) * 10,
      pitch,
      bank,
      reinPull: Math.abs(opts.laneVel) * 0.1,
      cheer: opts.cheer || 0,
      squash: pet?._squash || 0,
    } : null;

    rig.update(dt, {
      vx: opts.laneVel * 1.2,
      vz: -3.5,
      walkWeight: riding ? 0 : (opts.grounded ? (opts.stumble ? 0.55 : 1) : 0.2),
      riding: ridingState,
    }, cam);

    const targetSc = (opts.stumble ? 0.93 : 1) * (opts.shrunk ? 0.65 : 1);
    rig._stumbleScale = (rig._stumbleScale ?? targetSc) + (targetSc - (rig._stumbleScale ?? targetSc)) * Math.min(1, (dt || 0.016) * 12);
    rig.ROOT.scale.setScalar(rig._stumbleScale);
    if (rig._squash > 0) {
      rig._squash = Math.max(0, rig._squash - dt);
      const k = rig._squash / 0.25;
      rig.ROOT.scale.y *= (1 - 0.45 * k);
      rig.ROOT.scale.x *= (1 + 0.25 * k);
      rig.ROOT.scale.z *= (1 + 0.25 * k);
    }
    if (opts.shield || rig._bubble) {
      if (!rig._bubble) {
        rig._bubble = new THREE.Sprite(new THREE.SpriteMaterial({
          map: loadTex('fx_shield_bubble', { sprite: true, fallback: emojiCanvas('🫧') }),
          transparent: true, depthWrite: false, opacity: 0.85,
        }));
        rig._bubble.scale.set(2.4, 2.4, 1);
        rig._bubble.position.y = 1.1;
        rig.ROOT.add(rig._bubble);
      }
      rig._bubble.visible = !!opts.shield;
      const targetScale = (riding ? 1.8 : 1) * 2.4;
      const k = 1 - Math.exp(-10 * Math.max(0.001, dt || 0.016));
      const curS = rig._bubble.scale.x;
      const nextS = curS + (targetScale - curS) * k;
      rig._bubble.scale.set(nextS, nextS, 1);
    }
    if (opts.bubbled || rig._bubbledOverlay) {
      if (!rig._bubbledOverlay) {
        rig._bubbledOverlay = new THREE.Sprite(new THREE.SpriteMaterial({
          map: loadTex('fx_shield_bubble', { sprite: true, fallback: emojiCanvas('🫧') }),
          color: new THREE.Color(0x5cb8ff),
          transparent: true, depthWrite: false, opacity: 0.85,
        }));
        rig._bubbledOverlay.scale.set(1.9, 1.9, 1);
        rig._bubbledOverlay.position.y = 1.0;
        rig.ROOT.add(rig._bubbledOverlay);
      }
      rig._bubbledOverlay.visible = !!opts.bubbled;
      if (opts.bubbled) {
        rig._bubbledOverlay.scale.setScalar(1.9 + Math.sin(performance.now() * 0.01) * 0.1);
      }
    }
    if (pet) {
      try {
        pet.update(dt, {
          x: p.x,
          z: p.z,
          vx: opts.laneVel * 1.5,
          vz: -3.5,
          speed: 3.5,
          moving: true,
          right: opts.laneVel > 0,
          idleFor: 0,
          directTrackSpace: true,
          mounted: !!riding,
          rideStyle: style,
        }, cam);
      } catch {}

      if (this.mounts) {
        this.mounts.updateRacer(rig, pet, s, lane, y, { ...opts, skipPetUpdate: true }, dt, cam, this);
      }

      if (riding) {
        if (!this.mounts) {
          this._pos(s, lane, petY, pet.root.position);
          pet.root.scale.setScalar(2.2);
          this._pos(s, lane, petY + seatOffsetY, rig.ROOT.position);
          pet.mesh.rotation.x = -pitch;
          pet.mesh.rotation.z = bank;
          rig.ROOT.rotation.x = -pitch * 0.6;
          rig.ROOT.rotation.z = bank * 0.6;
        }
        if (style === 'flight') {
          rig._glowTimer = (rig._glowTimer || 0) - dt;
          if (rig._glowTimer <= 0) {
            rig._glowTimer = 0.09;
            const pBack = this._pos(s - 0.7, lane, petY + 0.3, _tmpV2);
            try { this.fx?.emit('fx_star', pBack.x, pBack.y, pBack.z, 1, { tint: [1.3, 0.4, 1.8], speed: 0.3, up: 0.2, life: 0.4, size: 0.35 }); } catch {}
          }
        } else if (style === 'blink') {
          this._updateWisps(rig, pet, s, lane, petY, opts.blink, dt);
        } else if (style === 'surf') {
          this._updateSurfWave(rig, pet, s, lane, petY, dt);
        }
        if (style !== 'blink' && rig._wisps) for (const w of rig._wisps) w.visible = false;
        if (style !== 'surf' && rig._surfWave) rig._surfWave.visible = false;
      } else {
        if (opts.countdown) {
          // Pre-Race Countdown (raceT < 0): pet stands right beside the player doing an excited warmup hop
          const side = lane >= 0.5 ? -0.48 : 0.48;
          const warmHop = Math.abs(Math.sin((this.t || 0) * 6.5)) * 0.16;
          this._pos(s + 0.15, lane + side, y + 0.12 + warmHop, pet.root.position);
          pet.root.scale.setScalar(1.16);
          try { if (!pet.actions?.activeAction) pet.actions?.act?.('happy', 1.4); } catch {}
        } else if (!this.mounts) {
          const side = lane >= 0.5 ? -0.55 : 0.55;
          this._pos(s - 0.9, lane + side, y * 0.6 + 0.15, pet.root.position);
          pet.root.scale.setScalar(1);
        }
        if (rig._wisps) for (const w of rig._wisps) w.visible = false;
        if (rig._surfWave) rig._surfWave.visible = false;
      }
    }
  }

  // ---------------------------------------------------------------- frame
  _frame(dt) {
    if (!this.track || !this.scene) return;
    const now = performance.now();
    const raceT = (now - this.goAt) / 1000;
    const r = this.runner;
    const visDt = this.slowmo > 0 ? dt * 0.3 : dt;
    if (this.slowmo > 0) this.slowmo -= dt;
    this.t = (this.t || 0) + visDt;

    // ---- countdown
    const cdEl = this.countdown;
    if (raceT < 0) {
      const n = Math.ceil(-raceT);
      if (cdEl.dataset.n !== String(n)) { cdEl.dataset.n = String(n); cdEl.textContent = n <= 3 ? String(n) : ''; cdEl.classList.remove('pop'); void cdEl.offsetWidth; cdEl.classList.add('pop'); if (n <= 3) this.audio.tone(440, 0.12, 'triangle', 0.06); }
    } else if (raceT < 0.9) {
      if (cdEl.dataset.n !== 'go') { cdEl.dataset.n = 'go'; cdEl.textContent = 'GO!'; cdEl.classList.remove('pop'); void cdEl.offsetWidth; cdEl.classList.add('pop'); this.audio.tone(880, 0.25, 'triangle', 0.07); }
    } else if (cdEl.textContent) { cdEl.textContent = ''; }

    // ---- local fixed-step simulation
    if (this.mySeat >= 0 && raceT > 0 && this.status !== 'ended') {
      const place = this._localPlace();
      const rivals = [];
      for (const rr of this.rivals.values()) if (rr.disp) rivals.push({ s: rr.disp.s, lane: rr.disp.l, y: rr.disp.y, seat: rr.seat, dk: (rr.disp.dh || 0) > 0.5 ? 1 : 0, heart: !!this.heartWith?.includes(rr.seat) });
      const ctx = { track: this.track, place, rivals, traps: this.traps };
      let steps = 0;
      while (r.t + T.DT <= raceT && steps++ < 12) {
        const inp = {
          left: this.queue.left > 0, right: this.queue.right > 0, jump: this.queue.jump > 0, ult: this.queue.ult > 0, item: this.queue.item > 0,
          glide: this._glideHeld(),
        };
        if (inp.left) this.queue.left--; if (inp.right) this.queue.right--;
        if (inp.jump) this.queue.jump--; if (inp.ult) this.queue.ult--; if (inp.item) this.queue.item--;
        const evs = stepRunner(r, ctx, inp, T.DT);
        for (const e of evs) this._juice(e);
      }
      if (r.t + T.DT * 12 < raceT) r.t = raceT - T.DT; // tab was hidden: don't fast-forward wildly
      this.reportT += dt;
      if (this.reportT >= REPORT_EVERY) { this.reportT = 0; this._report(); }
      if (place < this.lastPlace && this.lastPlace && raceT > 3) this._banner(`OVERTAKE! ${PLACE_TXT[this.lastPlace - 1]} → ${PLACE_TXT[place - 1]}`, 1100, 'overtake');
      this.lastPlace = place;
    }

    // ---- visuals
    const cam = this.camera;
    const lv = (r.laneT - r.laneF);
    if (this.localRig) this._placeRunnerVisual(this.localRig, this.localPet, r.s, r.laneF, r.y + (r.deckH || 0), {
      ride: r.ride > 0, style: r.rideStyle, petId: this.myPetId, blink: r.blink || 0, vy: r.vy,
      laneVel: lv * 8, grounded: r.grounded, stumble: r.stumble > 0 || r.trapped > 0, shrunk: r.shrink > 0, shield: r.shield > 0, bubbled: r.bubbled > 0,
      ult: r.ult > 0, ultDef: r.ultDef, outfitId: r.ultDef?.outfit, arch: r.ultDef?.arch || r.ultDef?.type,
      countdown: raceT < 0, cheer: r.ult > 0 ? 1 : 0,
    }, visDt, cam);
    for (const rr of this.rivals.values()) {
      if (!rr.target) { rr.rig.ROOT.visible = false; continue; }
      rr.rig.ROOT.visible = true;
      const age = Math.min(0.5, (now - rr.target.at) / 1000);
      const pred = rr.fin ? rr.target.s : rr.target.s + rr.target.v * age;
      const d = rr.disp;
      if (Math.abs(pred - d.s) > 15) d.s = pred; else d.s += (pred - d.s) * Math.min(1, dt * 8);
      const lPrev = d.l;
      d.l += (rr.target.l - d.l) * Math.min(1, dt * 10);
      const prevY = d.y;
      d.y += (rr.target.y - d.y) * Math.min(1, dt * 12);
      d.dh = (d.dh || 0) + ((rr.target.dh || 0) - (d.dh || 0)) * Math.min(1, dt * 6);
      const vy = (d.y - prevY) / Math.max(dt, 1e-3);
      const rrOutfit = rr.outfitId || (this.roster || []).find((p) => p.seat === rr.seat)?.equipped?.outfit?.id || null;
      if (rr.nameplate && rr.place && rr.place !== rr.lastPlatePlace) {
        rr.lastPlatePlace = rr.place;
        rr.nameplate.material.map = getRivalNameplateTex(rr.place, rr.name);
        rr.nameplate.material.needsUpdate = true;
      }
      this._placeRunnerVisual(rr.rig, rr.pet, d.s, d.l, Math.max(0, d.y) + d.dh, {
        ride: rr.ride, style: rr.rideStyle, petId: rr.petId, blink: 0, vy,
        laneVel: (d.l - lPrev) / Math.max(dt, 1e-3), grounded: d.y < 0.05, stumble: rr.stumble, shrunk: rr.shrunk, shield: rr.shield, bubbled: false,
        ult: !!rr.ult, rival: true, outfitId: rrOutfit, arch: rr.style,
        countdown: raceT < 0, cheer: rr.ult ? 1 : 0,
      }, visDt, cam);
    }
    if (this.ghostRig && this.ghostData?.samples?.length) {
      const samples = this.ghostData.samples;
      const lastSampleT = samples[samples.length - 1][0];
      if (r.t > lastSampleT + 1.5) {
        this.ghostRig.ROOT.visible = false;
      } else {
        this.ghostRig.ROOT.visible = true;
        let gs = samples[0][1], gl = samples[0][2], gy = samples[0][3];
        if (r.t <= samples[0][0]) {
          gs = samples[0][1]; gl = samples[0][2]; gy = samples[0][3];
        } else if (r.t >= lastSampleT) {
          const last = samples[samples.length - 1];
          gs = last[1]; gl = last[2]; gy = last[3];
        } else {
          let low = 0, high = samples.length - 1;
          while (low <= high) {
            const mid = (low + high) >> 1;
            if (samples[mid][0] <= r.t) low = mid + 1;
            else high = mid - 1;
          }
          const s0 = samples[high] || samples[0];
          const s1 = samples[low] || samples[samples.length - 1];
          const span = Math.max(1e-4, s1[0] - s0[0]);
          const frac = Math.max(0, Math.min(1, (r.t - s0[0]) / span));
          gs = s0[1] + (s1[1] - s0[1]) * frac;
          gl = s0[2] + (s1[2] - s0[2]) * frac;
          gy = s0[3] + (s1[3] - s0[3]) * frac;
        }
        if (r.t < 0.25 && gs < 2.8) {
          gs = 2.8;
        }
        this._placeRunnerVisual(this.ghostRig, null, gs, gl, gy, { ride: false, vy: 0, laneVel: 0, grounded: gy <= 0.05 }, visDt, cam);
      }
    }
    this._updatePetFx(visDt);

    // ---- Golden Landing Target Ring projected beneath player when airborne on foot
    if (this.landingRing) {
      if (this.mySeat >= 0 && !r.grounded && r.ride <= 0 && r.y > 0.18) {
        const surfY = (r.deck ? T.DECK.y : 0) + 0.05;
        this.landingRing.visible = true;
        this._pos(r.s, r.laneF, surfY, this.landingRing.position);
        const { i: lfi } = this._frameAt(r.s);
        this.landingRing.up.copy(this.fTan[lfi]);
        this.landingRing.lookAt(_tmpLook.copy(this.landingRing.position).add(this.fUp[lfi]));
        const hAbove = Math.max(0, (r.y + (r.deckH || 0)) - surfY);
        const ringSc = Math.max(0.65, 1.35 - hAbove * 0.18) * (1 + Math.sin(now * 0.008) * 0.05);
        this.landingRing.scale.set(ringSc, ringSc, 1);
      } else {
        this.landingRing.visible = false;
      }
    }

    // ---- camera: spring-damped chase with look-ahead, roll into turns, FOV kick on boosts
    const focusS = this.mySeat >= 0 ? r.s : this._leaderS();
    const focusL = this.mySeat >= 0 ? r.laneF : 0;
    const dk = this.track?.deck;
    const runningUnderDeck = !!(dk && !r.deck && focusS >= dk.s0 - 6 && focusS <= dk.s1 + 2);
    if (this.deckMat && this.deckRailMat) {
      const wantOp = runningUnderDeck ? 0.55 : 0.98;
      this.deckMat.opacity += (wantOp - this.deckMat.opacity) * Math.min(1, dt * 10);
      this.deckRailMat.opacity = this.deckMat.opacity;
      this.deckMat.depthWrite = !runningUnderDeck;
      this.deckRailMat.depthWrite = !runningUnderDeck;
    }
    const back = r.ride > 0 ? 8.2 : 6.8;
    const height = runningUnderDeck ? 2.1 : (r.ride > 0 ? 3.7 : 2.9);
    const dkH = this.mySeat >= 0 ? (r.deckH || 0) : 0;
    const want = this._pos(focusS - back, focusL * 0.55, height + dkH, _tmpV1);
    const look = this._pos(focusS + 16, focusL * 0.3, (runningUnderDeck ? 1.05 : 1.4) + Math.max(0, r.y) * 0.3 + dkH, _tmpV2);
    if (!this.camPos) { this.camPos = want.clone(); this.camLook = look.clone(); }
    const ka = 1 - Math.exp(-7 * dt);
    this.camPos.lerp(want, ka); this.camLook.lerp(look, 1 - Math.exp(-10 * dt));
    cam.position.copy(this.camPos);
    if (this.shake > 0) { this.shake = Math.max(0, this.shake - dt); const a = this.shake * 0.36; cam.position.x += Math.sin(this.t * 28) * a; cam.position.y += Math.cos(this.t * 22) * a * 0.7; }
    const { i: fi } = this._frameAt(focusS);
    const { i: fj } = this._frameAt(focusS + 12);
    const turn = _tmpV3.copy(this.fTan[fi]).cross(this.fTan[fj]).y; // + = left turn
    const roll = THREE.MathUtils.clamp(-turn * 0.5, -0.07, 0.07);
    this.camRoll = (this.camRoll || 0) + (roll - (this.camRoll || 0)) * Math.min(1, dt * 3);
    cam.up.copy(this.fUp[fi]).applyAxisAngle(this.fTan[fi], this.camRoll);
    cam.lookAt(this.camLook);
    const boostFov = (speedMul(r) - 1) * 22 + (r.mach > 0 ? 4 : 0);
    this.fovKick = Math.max(0, this.fovKick - dt * 14);
    const fov = 62 + boostFov + this.fovKick;
    if (Math.abs(cam.fov - fov) > 0.05) { cam.fov += (fov - cam.fov) * Math.min(1, dt * 5); cam.updateProjectionMatrix(); }

    // ---- distance-cull trackside & deck cloud sprites (0 GPU fillrate beyond 155m)
    if (this.cloudSprites) {
      for (let i = 0; i < this.cloudSprites.length; i++) {
        const cloud = this.cloudSprites[i];
        cloud.visible = Math.abs(cloud.s - focusS) < 155;
      }
    }
    if (this.deckCloudSprites) {
      for (let i = 0; i < this.deckCloudSprites.length; i++) {
        const cloud = this.deckCloudSprites[i];
        cloud.visible = Math.abs(cloud.s - focusS) < 155;
      }
    }

    // ---- sky cross-fade + fog per zone
    const z = zoneOf(focusS);
    this.skyMeshes.forEach((m, i) => {
      m.position.copy(cam.position);
      const target = i === z ? 1 : 0;
      m.material.opacity += (target - m.material.opacity) * Math.min(1, dt * 1.5);
      m.visible = m.material.opacity > 0.01;
    });
    this.scene.fog.color.lerp(_tmpColor.setHex(ZONE_THEMES[z].fog), Math.min(1, dt));
    if (this.scene.background?.isColor) this.scene.background.lerp(_tmpColor.setHex(SKY_TOP_COLORS[z]), Math.min(1, dt * 1.5));

    this._updateItems(focusS, now / 1000);
    if (this.deckRingMesh && this.deckRingGroup) {
      const rt = now / 1000;
      this.deckRingMesh.rotation.z = rt * 1.6;
      const sc = 1 + Math.sin(rt * 4) * 0.06;
      this.deckRingMesh.scale.set(sc, sc, sc);
      if (Math.abs(focusS - (this.track?.deck?.ring || 0)) < 70 && Math.random() < 0.25) {
        try {
          const p = this.deckRingGroup.position;
          this.fx?.emit('fx_star', p.x + (Math.random() - 0.5) * 2, p.y + (Math.random() - 0.5) * 2, p.z + (Math.random() - 0.5) * 2, 1, { tint: [1.4, 1.2, 0.5], speed: 0.6, up: 1.8, life: 0.5 });
        } catch {}
      }
    }
    if (r.heartBoost > 0) {
      this._heartTrailT = (this._heartTrailT || 0) + dt;
      if (this._heartTrailT >= 0.06) {
        this._heartTrailT = 0;
        const p = this._pos(r.s - 0.4, r.laneF, r.y + (r.deckH || 0) + 0.5, _tmpV3);
        try { this.fx?.emit('fx_heart', p.x, p.y, p.z, 1, { tint: [1.6, 0.7, 1.3], speed: 0.5, up: 0.4, life: 0.45 }); } catch {}
      }
    }
    if (this.coach && this.mySeat >= 0 && raceT > 0) {
      let ps = null;
      const anchor = this.localPet?.root || this.localRig?.ROOT;
      if (anchor) {
        const v = anchor.getWorldPosition(_tmpV3);
        v.y += r.ride > 0 ? 3.4 : 1.6;
        v.project(cam);
        const el = this.world.renderer.domElement;
        if (v.z < 1) ps = { x: (v.x + 1) / 2 * (el.clientWidth || window.innerWidth), y: (1 - v.y) / 2 * (el.clientHeight || window.innerHeight) };
      }
      this.coach.update(dt, r, this.track, ps);
    }
    try { this.fx?.update(visDt); } catch {}
    this._updateHud(false);
  }

  _localPlace() {
    const list = [this.runner];
    for (const rr of this.rivals.values()) {
      if (!rr.disp) continue;
      list.push({ s: rr.disp.s, finished: rr.fin, finishT: rr.fin ? 0 : 0 });
    }
    // finished rivals ahead of an unfinished me; otherwise by distance
    let place = 1;
    for (let i = 1; i < list.length; i++) {
      const o = list[i];
      if (this.runner.finished) { if (o.finished && this.serverPlace && this.serverPlace > 0) { /* trust server */ } }
      else if (o.finished || o.s > this.runner.s) place++;
    }
    if (this.runner.finished && this.serverPlace) return this.serverPlace;
    return place;
  }

  _leaderS() { let m = 0; for (const rr of this.rivals.values()) if (rr.disp) m = Math.max(m, rr.disp.s); return m; }

  _report() {
    const r = this.runner;
    this.net?.send({
      type: 'cd_report', tableId: this.tableId,
      t: +r.t.toFixed(3), s: +r.s.toFixed(2), l: +r.laneF.toFixed(2), y: +r.y.toFixed(2), v: +r.v.toFixed(2),
      ride: r.ride > 0 ? 1 : 0, ult: r.ult > 0 ? 1 : 0, st: r.stumble > 0 ? 1 : 0, dh: +(r.deckH || 0).toFixed(2),
      style: r.style, coins: r.coins, fin: r.finished ? 1 : 0, ft: r.finished ? +r.finishT.toFixed(3) : null,
      stats: {
        rides: this.raceStats?.rides || 0,
        perfects: r.perfects || 0,
        nearMisses: this.raceStats?.nearMisses || 0,
        ults: this.raceStats?.ults || 0,
        showcases: this.raceStats?.showcases || 0,
      },
    });
  }

  // ---------------------------------------------------------------- juice
  _juice(e) {
    const r = this.runner;
    this.coach?.onEvent(e, r);
    this.mounts?.onEvent?.(e, this.localPet);
    const st = this.raceStats;
    if (st) {
      if (e.e === 'ride_start') st.rides++;
      else if (e.e === 'ult') st.ults++;
      else if (e.e === 'rescue') st.rescues++;
      else if (e.e === 'perfect') st.maxStreak = Math.max(st.maxStreak, e.streak || 1);
      else if (e.e === 'near') st.nearMisses++;
      else if (e.e === 'vault' || e.e === 'apex' || e.e === 'heart' || e.e === 'deck_enter') st.showcases++;
    }
    const nowS = performance.now() / 1000;
    const here = () => this._pos(r.s + 0.6, r.laneF, r.y + 0.8, _tmpV3);
    const burst = (cell, n, tint) => { try { const p = here(); this.fx?.emit(cell, p.x, p.y, p.z, n, { tint, speed: 1.4, up: 1.2, life: 0.6 }); } catch {} };
    switch (e.e) {
      case 'coin': this.audio.jelly(nowS); burst('fx_star', 2, [1.3, 1.1, 0.4]); break;
      case 'berry': this.audio.jelly(nowS); burst('fx_heart', 3); this._pop('+30', '#ff6f9a'); break;
      case 'star': this.audio.chord(784); burst('fx_star', 10); this._pop('+150 ⭐', '#ffcf3a'); break;
      case 'orb': this.audio.chord(659); burst('fx_star', 8, [0.7, 0.9, 1.4]); this._banner('🔮 +25% ULT', 900); break;
      case 'perfect':
        this.audio.tone(988, 0.1, 'triangle', 0.07); this.fovKick = 6; this._haptic(12);
        this._banner(e.streak >= 2 ? `NICE DASH! ×${e.streak}` : 'NICE DASH!', 700, 'perfect'); break;
      case 'mach': this._banner('🔥 MACH WING OVERDRIVE!', 1300, 'big'); this.audio.chord(880); break;
      case 'near': this._banner('CLOSE CALL!', 700, 'near'); this.audio.tone(1320, 0.06, 'square', 0.04); break;
      case 'hit': this._banner('Ouch!', 600, 'hit'); this.shake = 0.25; this.audio.thud(); this._haptic(40); this._flash('#ff6b8b'); break;
      case 'phase': break;
      case 'rescue': this._banner('🐾 PET RESCUE!', 1200, 'big'); this.audio.chord(440); break;
      case 'pad': this._banner('BOOST!', 500, 'perfect'); this.audio.whoosh(); this.fovKick = 5; break;
      case 'rocket': this._banner('🚀 ROCKET START!', 1100, 'big'); this.audio.whoosh(); this.fovKick = 8; break;
      case 'tier': this._banner(['', 'CHAIN ×2!', 'CHAIN ×3!', 'CHAIN MAX!'][e.tier], 900, 'chain'); this.audio.chord(523 * (1 + e.tier * 0.25)); break;
      case 'ride_start': {
        const pr = Object.values(PET_RIDES).find((x) => x.style === e.style) || PET_RIDES[r.petId] || PET_RIDES.pet_ragdoll;
        this._banner(`${pr.icon} ${pr.name.toUpperCase()}!`, 1400, 'mega');
        this._flash('#ffd6f5');
        this.audio.chord(392);
        setTimeout(() => this.audio.chord(523), 140);
        this._haptic(30);
        break;
      }
      case 'ride_end': this._banner('Tap JUMP — Dismount Dash!', 700, 'near'); break;
      case 'pounce': {
        this._spawnHeartWave(r.s, r.laneF);
        const hp = this._pos(r.s, r.laneF, 0.2);
        try { this.fx?.emit('fx_heart', hp.x, hp.y, hp.z, 8, { tint: [1.6, 0.6, 1.2], speed: 1.8, up: 0.6, life: 0.5 }); } catch {}
        this.audio.thump();
        if (e.n > 0) this._pop(`+${e.n} 💖`, '#ff6fa8');
        if (this.localPet) this.localPet._squash = 0.22;
        break;
      }
      case 'breath': {
        this._spawnPlasmaBeam(r.s, e.lane);
        const items = this.track?.items || [];
        for (let i = r.cursor; i < items.length && items[i].s < r.s + 30; i++) {
          const it = items[i];
          if (it.t === 'cloud' && it.lane === e.lane && it.s > r.s) {
            const cp = this._pos(it.s, it.lane, 2.2);
            try { this.fx?.emit('fx_star', cp.x, cp.y, cp.z, 6, { tint: [1.3, 0.4, 1.8], speed: 2.0, up: 0.8, life: 0.45 }); } catch {}
          }
        }
        this.audio.whoom();
        if (e.n > 0) this._banner(`PLASMA BREATH ×${e.n}`, 900, 'mega');
        break;
      }
      case 'blink': {
        this._spawnAfterimage(r.s, e.from, r.y);
        this.audio.shing(e.stacks || 1);
        break;
      }
      case 'ult': {
        const outfitId = r.ultDef?.outfit;
        const arch = r.ultDef?.arch || r.ultDef?.type;
        const skin = ultSkinFor(outfitId, arch);
        const bannerTxt = skin.banner || `${e.super ? '💫 SUPER ' : '🌈 '}${(e.name || 'ULT').toUpperCase()}!`;
        this._banner(bannerTxt, skin.sovereign ? 1600 : 1400, skin.sovereign ? 'sovereign' : 'mega');
        this._flash(skin.tint || '#fff2a8', true);
        this.fovKick = skin.sovereign ? 15 : 9;
        if (skin.sfx) {
          this.audio.tone(skin.sfx.base || 659, 0.25, skin.sfx.wave || 'triangle', 0.08, 1.25);
          if (skin.sovereign) {
            setTimeout(() => this.audio.tone(Math.round(skin.sfx.base * 1.5), 0.22, skin.sfx.wave, 0.06), 75);
          }
        } else {
          this.audio.chord(659);
        }
        this._spawnUltSignature(skin, r.s, r.laneF, r.y);
        if (e.rivalSlow) this.net?.send({ type: 'cd_item', tableId: this.tableId, kind: 'slow_all', s: +r.s.toFixed(2), lane: 0 });
        break;
      }
      case 'synergy': this._banner('✨ SYNERGY BURST!', 1500, 'mega'); this.audio.chord(784); break;
      case 'smash': burst('fx_star', 8, [1.4, 0.9, 1.2]); this.shake = Math.max(this.shake, 0.08); this.audio.tone(200, 0.08, 'square', 0.05, 0.5); break;
      case 'slingshot': this._banner('💨 SLINGSHOT!', 800, 'perfect'); this.audio.whoosh(); this.fovKick = 7; this._haptic(15); break;
      case 'vault': {
        this._banner('👟 VAULT!', 700, 'near');
        burst('fx_star', 8, [1.4, 1.2, 0.4]);
        this.audio.tone(480, 0.12, 'sine', 0.06, 1.8);
        const rr = e.seat != null ? this.rivals.get(e.seat) : null;
        if (rr?.rig) rr.rig._squash = 0.25;
        this._haptic(12);
        break;
      }
      case 'apex': {
        this._banner('🏎️ APEX!', 600, 'near');
        this.audio.tone(880, 0.08, 'sawtooth', 0.04, 1.4);
        const pSide = (e.dir || 0) * 0.4;
        const pf = this._pos(r.s + 0.2, r.laneF + pSide, (r.deckH || 0) + 0.1);
        try { this.fx?.emit('fx_star', pf.x, pf.y, pf.z, 6, { tint: [1.5, 1.3, 0.4], speed: 1.6, up: 0.4, life: 0.35 }); } catch {}
        this._haptic(10);
        break;
      }
      case 'heart': {
        this._banner('💞 HEART SLINGSHOT!', 1000, 'mega');
        this.audio.chord(659);
        this.fovKick = 8;
        this._haptic(20);
        this._flash('#ffb6e0');
        burst('fx_heart', 12, [1.6, 0.7, 1.3]);
        break;
      }
      case 'deck_enter': {
        this._banner('☁️ SKY DECK!', 900, 'mega');
        this.audio.chord(659);
        setTimeout(() => this.audio.chord(880), 90);
        this.fovKick = 6;
        break;
      }
      case 'deck_exit': {
        this.audio.whoosh();
        break;
      }
      case 'item_get': this._banner(`🎁 ${ITEM_DEFS[e.item].icon} ${ITEM_DEFS[e.item].name}!`, 900, 'chain'); this.audio.chord(698); this._renderItemBubble(); break;
      case 'item_use':
        this._renderItemBubble();
        if (e.item === 'shrink' || e.item === 'mochi') this.net?.send({ type: 'cd_item', tableId: this.tableId, kind: e.item, s: +e.s.toFixed(2), lane: e.lane });
        this._banner({ mega_mount: '🐾 MEGA MOUNT!', shrink: '⚡ SHRINK BOLT → LEADER!', grapple: '🪝 RIBBON GRAPPLE!', mochi: '🍮 MOCHI DROPPED!', jelly_rain: '🍬 JELLY RAIN!', shield: '🫧 SHIELD UP!' }[e.item] || 'ITEM!', 900, 'big');
        this.audio.whoosh(); break;
      case 'surf_wave':
        this.net?.send({ type: 'cd_item', tableId: this.tableId, kind: 'wave', s: +e.s.toFixed(2), lane: e.lane });
        this._spawnBubbleRing(e.s, e.lane, r.y);
        break;
      case 'bubbled': {
        this._banner('🫧 Bubbled!', 1000, 'hit');
        this.audio.tone(420, 0.2, 'sine', 0.05, 1.4);
        const bp = this._pos(r.s, r.laneF, r.y + 0.8);
        try { this.fx?.emit('fx_bubble', bp.x, bp.y, bp.z, 8, { tint: [0.6, 0.9, 1.4], speed: 1.2, up: 0.8, life: 0.6 }); } catch {}
        break;
      }
      case 'pet_shield':
        this._banner('🐋 Whale Shield!', 1100, 'mega');
        this.audio.chime();
        break;
      case 'shrunk': this._banner('⚡ Shrunk!', 900, 'hit'); this.shake = 0.3; this.audio.thud(); this._haptic(40); break;
      case 'slowed': this._flash('#b9a4ff'); break;
      case 'dodge': this._banner('✨ DODGED!', 900, 'perfect'); this.audio.chord(880); break;
      case 'shield_pop': this._banner('🫧 Blocked!', 800, 'near'); this.audio.tone(1200, 0.12, 'triangle', 0.05, 0.6); break;
      case 'trapped': this._banner('🍮 Boing!', 800, 'hit'); this.shake = 0.2; this.audio.tone(300, 0.25, 'sine', 0.06, 2); this._haptic(30); break;
      case 'lucky': this._banner('🍀 LUCKY PHASE!', 800, 'perfect'); break;
      case 'perk': this._banner({ sugar: '🍬 SUGAR RUSH!', juggernaut: '🔥 JUGGERNAUT!', phantom: '👻 PHANTOM DASH!', shockwave: '💥 SHOCKWAVE!', launch: '⚡ SOVEREIGN LAUNCH!', counter: '🎭 COUNTER-DASH!' }[e.why] || 'BOOST!', 700, 'perfect'); this.fovKick = 5; break;
      case 'warp': {
        this._flash('#d9c7ff', true);
        this.fovKick = 12;
        this.audio.chord(988);
        const outfitId = r.ultDef?.outfit;
        const skin = ultSkinFor(outfitId, 'warp');
        this._spawnWarpPortals(skin, e.from, e.to, r.laneF, r.y);
        break;
      }
      case 'clear': if (e.n) this._pop(`+${e.n} 💎`, '#7fe0ff'); break;
      case 'finish':
        this.slowmo = 0.9; this._banner('🏁 FINISH!', 1600, 'mega'); this.audio.chord(523); setTimeout(() => this.audio.chord(659), 180); this._report(); break;
      default: break;
    }
  }

  _haptic(ms) { try { navigator.vibrate?.(ms); } catch {} }

  // ---------------------------------------------------------------- input
  _press(kind) {
    if (!this.active || this.mySeat < 0) return;
    this.audio._c();
    if (this.queue[kind] < 2) this.queue[kind]++;
  }
  _glideHeld() { return this.keys.has('jump') || this._padHeld || this._areaHeld; }

  _bindKeys() {
    const map = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'jump', KeyW: 'jump', Space: 'jump', KeyE: 'ult', ShiftLeft: 'ult', Enter: 'ult', KeyQ: 'item', KeyF: 'item' };
    window.addEventListener('keydown', (e) => {
      if (!this.active) return;
      const k = map[e.code]; if (!k) return;
      e.preventDefault();
      if (e.repeat) return;
      this.keys.add(k); this._press(k);
    });
    window.addEventListener('keyup', (e) => { const k = map[e.code]; if (k) this.keys.delete(k); });
  }

  _buildDom() {
    const style = document.createElement('style');
    style.id = 'cloud-dash-styles';
    style.textContent = `
#cloud-dash-root{position:fixed;inset:0;z-index:45;touch-action:none;overscroll-behavior:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;font-family:inherit;color:#fff}
#cloud-dash-root [hidden]{display:none!important}
#cloud-dash-root .cd-area{position:absolute;inset:0}
.cd-top{position:absolute;left:0;right:0;top:calc(env(safe-area-inset-top,0px) + 8px);display:flex;flex-direction:column;align-items:center;gap:6px;pointer-events:none}
.cd-finish-pill{background:linear-gradient(180deg,#fff8e3,#f2d28b);border:1.8px solid #b57b1e;border-radius:999px;padding:2px 12px;font:900 11px/1.3 sans-serif;color:#3a2008;box-shadow:0 2px 6px rgba(0,0,0,.3),inset 0 1px 0 #fff;letter-spacing:.3px}
.cd-bar{position:relative;width:min(92vw,420px);height:18px;border-radius:999px;border:2px solid #d49a2a;background:rgba(34,18,6,.72);box-shadow:0 4px 12px rgba(0,0,0,.35),inset 0 2px 4px rgba(0,0,0,.45)}
.cd-bar-fill{position:absolute;left:2px;top:2px;bottom:2px;border-radius:999px;background:linear-gradient(90deg,#f59e0b,#ffd36e,#8fe3a7,#7ecbff,#ff8bd0);width:0;box-shadow:0 0 8px rgba(255,211,110,.6)}
.cd-dot{position:absolute;top:50%;width:28px;height:28px;margin:-14px 0 0 -14px;border-radius:50%;border:2px solid #f5c344;background-color:#fff8e7;background-size:94% auto,cover;background-position:center -4px,center top;background-repeat:no-repeat;font:900 10px/24px sans-serif;text-align:center;color:#3a2008;box-shadow:0 3px 8px rgba(0,0,0,.4);transition:left .12s linear;display:grid;place-items:center}
.cd-dot.me{width:34px;height:34px;margin:-17px 0 0 -17px;border:2.5px solid #fff275;box-shadow:0 0 0 2px #d49a2a,0 4px 10px rgba(0,0,0,.5);z-index:3}
.cd-dot-crown{position:absolute;top:-11px;left:50%;transform:translateX(-50%);font-size:12px;line-height:1;filter:drop-shadow(0 1px 2px rgba(0,0,0,.6));pointer-events:none}
.cd-dot-rank{position:absolute;bottom:-9px;left:50%;transform:translateX(-50%);background:linear-gradient(180deg,#3a2008,#221104);color:#ffd36e;border:1px solid #d49a2a;border-radius:6px;padding:0 4px;font:900 8.5px/11px sans-serif;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,.4)}
.cd-row{width:min(92vw,420px);display:flex;justify-content:space-between;align-items:flex-start;margin-top:4px}
.cd-place-wrap{display:flex;flex-direction:column;align-items:flex-start;gap:4px}
.cd-place{display:inline-flex;align-items:baseline;gap:2px;padding:4px 12px;border-radius:14px;background:linear-gradient(180deg,rgba(58,32,8,.88),rgba(34,18,6,.94));border:2px solid #d49a2a;box-shadow:0 4px 10px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,245,214,.4);font:900 30px/1 sans-serif;color:#ffe699;text-shadow:0 2px 0 #3a2008,0 0 10px rgba(245,195,68,.55)}
.cd-place small{font-size:14px;color:#ffd36e}
.cd-speed{display:flex;align-items:center;gap:5px;background:linear-gradient(180deg,rgba(46,24,10,.85),rgba(28,14,5,.92));border:1.5px solid #d49a2a;padding:5px 12px;border-radius:999px;color:#fff8e7;font:900 19px/1 sans-serif;box-shadow:0 4px 10px rgba(0,0,0,.3),inset 0 1px 0 rgba(255,255,255,.2)}
.cd-speed img{width:20px;height:20px}
.cd-speed em{font-style:normal;font-size:11px;color:#ffd36e;opacity:.95}
.cd-bond-wrap{display:flex;flex-direction:column;align-items:flex-end;gap:3px;margin-top:5px}
.cd-bond{position:relative;width:56px;height:56px;border-radius:50%;border:2px solid #f5c344;background:conic-gradient(#ff9ad5 var(--p,0%),#ffd36e var(--p,0%),rgba(255,255,255,.18) 0);display:grid;place-items:center;box-shadow:0 4px 12px rgba(0,0,0,.35)}
.cd-bond::after{content:'';position:absolute;inset:4px;border-radius:50%;background:radial-gradient(circle,#4a2c14 0%,#261406 100%);border:1px solid rgba(245,195,68,.45)}
.cd-bond img.ico,.cd-bond span{position:relative;z-index:1;width:40px;height:40px;border-radius:50%;object-fit:cover;font-size:24px;line-height:40px;text-align:center}
.cd-bond.full{animation:cdPulse .5s infinite alternate;box-shadow:0 0 14px #ffd36e,0 4px 12px rgba(0,0,0,.35)}
.cd-bond-tag{background:linear-gradient(180deg,#fff7df,#f2cf7e);border:1.5px solid #b57b1e;border-radius:999px;padding:1.5px 8px;font:900 10px/1.25 sans-serif;color:#3a2008;box-shadow:0 2px 5px rgba(0,0,0,.3);white-space:nowrap}
.cd-bond-tag.riding{background:linear-gradient(90deg,#ffd36e,#ff8bd0);color:#2d1204;border-color:#fff;animation:cdPulse .45s infinite alternate}
.cd-heart{position:relative;width:42px;height:42px;border-radius:50%;margin-top:5px;border:1.5px solid #ff9ad5;background:conic-gradient(#ff5c9e var(--p,0%),rgba(255,255,255,.25) 0);display:grid;place-items:center;box-shadow:0 2px 8px rgba(0,0,0,.25);transition:opacity .2s}
.cd-heart::after{content:'';position:absolute;inset:4px;border-radius:50%;background:rgba(46,24,10,.85)}
.cd-heart span{position:relative;z-index:1;font-size:18px;line-height:22px;text-align:center}
.cd-heart.full{animation:cdPulse .4s infinite alternate}
.cd-chain{position:absolute;left:12px;top:42%;font:900 22px/1 sans-serif;text-shadow:0 2px 0 rgba(0,0,0,.45);pointer-events:none;opacity:.95}
.cd-chain b{display:block;font-size:13px;opacity:.9}
.cd-chain.t1{color:#ffe38a}.cd-chain.t2{color:#ffb35c}.cd-chain.t3{background:linear-gradient(90deg,#ff7eb6,#ffd36e,#7ecbff);-webkit-background-clip:text;color:transparent}
.cd-banner{position:absolute;left:0;right:0;top:29%;text-align:center;font:900 30px/1.1 sans-serif;pointer-events:none;text-shadow:0 3px 0 #5a2d0c,0 0 16px rgba(255,210,110,.85);opacity:0;transform:scale(.6)}
.cd-banner.show{animation:cdBanner var(--d,900ms) ease-out forwards}
.cd-banner.perfect{color:#fff59a}.cd-banner.near{color:#9ff3ff;font-size:24px}.cd-banner.hit{color:#ff9aa8}
.cd-banner.big{font-size:34px}.cd-banner.mega{font-size:40px;color:#fff8e7}.cd-banner.sovereign{font-size:44px;color:#fff275;-webkit-text-stroke:1.5px #2d0047;text-shadow:0 0 10px #3a0055,0 4px 0 #28003d,0 0 24px rgba(255,215,0,.95)}.cd-banner.chain{color:#ffd36e}.cd-banner.overtake{color:#b6ff9a;font-size:26px}
.cd-pop{position:absolute;left:50%;top:52%;font:900 20px/1 sans-serif;pointer-events:none;animation:cdPop .7s ease-out forwards;text-shadow:0 2px 0 rgba(0,0,0,.35)}
.cd-count{position:absolute;left:0;right:0;top:36%;text-align:center;font:900 96px/1 sans-serif;pointer-events:none;color:#fff8e7;text-shadow:0 6px 0 #6b3710,0 0 30px rgba(255,205,90,.9)}
.cd-count.pop{animation:cdCount .8s ease-out}
.cd-flash{position:absolute;inset:0;pointer-events:none;opacity:0}
.cd-flash.show{animation:cdFlash .35s ease-out}
.cd-ctrl{position:absolute;left:0;right:0;bottom:calc(env(safe-area-inset-bottom,0px) + 34px);display:flex;justify-content:space-between;align-items:flex-end;padding:0 24px;pointer-events:none}
.cd-btn{pointer-events:auto;border:0;background:none;padding:0;touch-action:none;-webkit-tap-highlight-color:transparent; -webkit-touch-callout:none;transition:transform .08s ease,filter .1s ease}
.cd-btn img{width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 5px 8px rgba(0,0,0,.38));pointer-events:none}
.cd-btn:active,.cd-btn.down{transform:translateY(2px) scale(.93)}
.cd-lr-wrap{display:flex;flex-direction:column;align-items:center;gap:5px;pointer-events:auto;touch-action:none}
.cd-lane-pips{display:inline-flex;align-items:center;gap:7px;background:rgba(34,18,6,.84);border:1.5px solid #d49a2a;border-radius:999px;padding:3px 11px;box-shadow:0 2px 6px rgba(0,0,0,.35);pointer-events:none}
.cd-lane-pip{width:9px;height:9px;border-radius:50%;background:rgba(255,248,231,.28);border:1.5px solid rgba(255,216,117,.55);transition:transform .12s ease,background .12s ease,box-shadow .12s ease}
.cd-lane-pip.active{background:#ffe57f;border-color:#fff;transform:scale(1.32);box-shadow:0 0 8px #ffd36e}
.cd-lr{position:relative;display:flex;align-items:center;gap:0;padding:4px;border-radius:999px;background:linear-gradient(180deg,rgba(68,38,12,.92),rgba(36,18,6,.96));border:2.5px solid #ffd875;box-shadow:0 6px 0 #522d0c,0 10px 20px rgba(0,0,0,.48),inset 0 1px 0 rgba(255,255,255,.45);touch-action:none;pointer-events:auto}
.cd-lr::before{content:'';position:absolute;inset:-12px;border-radius:999px;pointer-events:auto}
.cd-lr-divider{width:2px;height:46px;background:linear-gradient(180deg,transparent,rgba(255,216,117,.65),transparent);pointer-events:none;flex-shrink:0}
.cd-btn.dir{position:relative;z-index:1;width:72px;height:68px;background:radial-gradient(circle,#fff9ea 0%,#f0d290 72%,#c58b28 100%);border:2px solid #ffd875;box-shadow:0 3px 0 #6b3f14,inset 0 2px 0 #fff;padding:7px}
.cd-btn.dir.l{border-radius:999px 14px 14px 999px;margin-right:2px}
.cd-btn.dir.r{border-radius:14px 999px 999px 14px;margin-left:2px}
.cd-btn.dir.down{background:radial-gradient(circle,#fffef7 0%,#ffe58f 68%,#e09b22 100%);border-color:#fff;box-shadow:0 1px 0 #6b3f14,0 0 14px rgba(255,224,115,.75),inset 0 2px 0 #fff}
.cd-btn.dir.at-edge{opacity:.68}
.cd-btn.dir.r img.gold-dir{transform:scaleX(-1)}
.cd-right{display:flex;gap:12px;align-items:flex-end}
.cd-jump-wrap{display:flex;flex-direction:column;align-items:center;gap:4px}
.cd-btn.jump{width:88px;height:88px;border-radius:50%;background:radial-gradient(circle,#fff9ea 0%,#ffd875 70%,#d49a2a 100%);border:3px solid #fff3c4;box-shadow:0 5px 0 #7a4612,0 8px 18px rgba(0,0,0,.45),inset 0 2px 0 #fff;padding:6px}
.cd-ultwrap{position:relative;display:flex;flex-direction:column;align-items:center;gap:6px}
.cd-ult{width:78px;height:78px;border-radius:50%;background:url('/assets/cloud_dash/cd_ult_cradle_gold.png') center/contain no-repeat,conic-gradient(#ffd36e var(--p,0%),rgba(255,255,255,.22) 0);border:2.5px solid #f5c344;box-shadow:0 4px 12px rgba(0,0,0,.4);padding:6px}
.cd-ult img{border-radius:50%;opacity:.6}
.cd-ult.ready{box-shadow:0 0 18px #ffd36e,0 4px 12px rgba(0,0,0,.45);border-color:#fff}
.cd-ult.ready img{opacity:1;animation:cdPulse .45s infinite alternate}
.cd-label{background:rgba(38,20,6,.82);border:1px solid #d49a2a;border-radius:999px;padding:2px 8px;color:#fff8e7;font:900 10px/1.2 sans-serif;text-align:center;text-shadow:0 1px 2px rgba(0,0,0,.7);pointer-events:none;white-space:nowrap}
.cd-ult-label.ready{background:linear-gradient(90deg,#f59e0b,#ec4899);color:#fff;border-color:#fff275}
.cd-lines{position:absolute;inset:0;pointer-events:none;opacity:0;background:repeating-conic-gradient(from 0deg at 50% 45%,rgba(255,255,255,.5) 0deg 0.6deg,transparent 0.6deg 7deg);-webkit-mask:radial-gradient(circle at 50% 45%,transparent 32%,#000 70%);mask:radial-gradient(circle at 50% 45%,transparent 32%,#000 70%)}
.cd-exit,.cd-leave{position:static;align-self:flex-start;margin-top:2px;pointer-events:auto;background:linear-gradient(180deg,#5c3416,#3a1e0a);color:#fff8e7;border:1.8px solid #d49a2a;border-radius:999px;padding:4px 11px;font:800 11.5px/1.2 sans-serif;box-shadow:0 3px 0 #241104,0 4px 10px rgba(0,0,0,.35);cursor:pointer}
.cd-results{position:absolute;inset:0;z-index:30;background:rgba(24,12,4,.62);backdrop-filter:blur(4px);display:grid;place-items:center;pointer-events:auto}
.cd-card{width:min(94vw,410px);max-height:90vh;overflow-y:auto;box-sizing:border-box;background:linear-gradient(180deg,#fff9ea,#f4e0b8);color:#3a2415;border-radius:24px;border:3.5px solid #d49a2a;padding:16px 16px 20px;box-shadow:0 20px 50px rgba(0,0,0,.6),inset 0 2px 0 #fff;text-align:center}
.cd-card h2{margin:0 0 8px;font:900 24px/1.15 sans-serif;color:#7a2e0e;text-shadow:0 1px 0 #fff}
.cd-inline-ico{width:15px;height:15px;object-fit:contain;vertical-align:-2px}
.cd-podium-stage{display:grid;grid-template-columns:repeat(4,1fr);align-items:end;gap:6px;margin:10px 0 12px;padding:10px 8px 6px;border-radius:16px;background:linear-gradient(180deg,rgba(255,255,255,.65),rgba(232,199,138,.45));border:1.5px solid #d4a656;box-shadow:inset 0 1px 0 #fff}
.cd-podium-col{display:flex;flex-direction:column;align-items:center;gap:3px}
.cd-podium-av-wrap{position:relative;width:48px;height:48px;border-radius:50%;background:radial-gradient(circle,#fffdf7,#f3dcb0);border:2.5px solid #d49a2a;box-shadow:0 3px 8px rgba(0,0,0,.2)}
.cd-podium-col.me .cd-podium-av-wrap{border-color:#e0459a;box-shadow:0 0 0 2px rgba(224,69,154,.3),0 4px 10px rgba(0,0,0,.25)}
.cd-podium-av{width:100%;height:100%;border-radius:50%;object-fit:cover;object-position:center top}
.cd-podium-hair{position:absolute;top:-6px;left:50%;transform:translateX(-50%);width:96%;height:92%;object-fit:contain;pointer-events:none;filter:drop-shadow(0 1px 1px rgba(0,0,0,.25))}
.cd-podium-pet{position:absolute;right:-5px;bottom:-3px;width:22px;height:22px;border-radius:50%;background:#fff8e7;border:1.5px solid #b57b1e;object-fit:cover;box-shadow:0 1px 4px rgba(0,0,0,.3)}
.cd-podium-name{font:800 10.5px/1.15 sans-serif;color:#3a2415;max-width:76px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cd-podium-pillar{width:100%;border-radius:8px 8px 4px 4px;padding:5px 2px 4px;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;border:1.5px solid #b57b1e;font:900 10px/1.15 sans-serif;color:#3a2008;box-shadow:inset 0 1px 0 rgba(255,255,255,.75)}
.cd-podium-col.p1 .cd-podium-pillar{min-height:54px;background:linear-gradient(180deg,#fff3b0,#f5c344);border-color:#b57b1e}
.cd-podium-col.p2 .cd-podium-pillar{min-height:44px;background:linear-gradient(180deg,#f5f7fa,#cbd5e1);border-color:#94a3b8}
.cd-podium-col.p3 .cd-podium-pillar{min-height:36px;background:linear-gradient(180deg,#fde6c4,#d99b66);border-color:#a1622f}
.cd-podium-col.p4 .cd-podium-pillar{min-height:30px;background:linear-gradient(180deg,#fff9ea,#e5cfa3);border-color:#c4a46d}
.cd-podium-pillar small{font:700 9px/1.1 sans-serif;opacity:.85}
.cd-pod{display:flex;flex-direction:column;gap:5px;margin:6px 0}
.cd-pod div{display:flex;justify-content:space-between;padding:6px 10px;border-radius:12px;background:#fffdf9;border:1.5px solid #d8b888;color:#3a2415;font:800 13px sans-serif}
.cd-pod div.me{background:linear-gradient(90deg,#fff5d6,#ffe8b3);border-color:#d49a2a;box-shadow:0 0 0 1.5px rgba(212,154,42,.35)}
.cd-rew{display:flex;justify-content:center;gap:12px;font:900 16px sans-serif;margin:8px 0;color:#3a2415}
.cd-rew img{width:20px;height:20px;vertical-align:-4px}
.cd-best{color:#b8326a;font:900 13.5px sans-serif;margin:4px 0}
.cd-league-card{margin:6px 0}
.cd-promo-badge{background:linear-gradient(90deg,#ffd36e,#ff8bd0);color:#3b1e54;font:900 13px sans-serif;padding:6px;border-radius:10px;margin:4px 0}
.cd-chest-bar{display:inline-flex;align-items:center;gap:4px}
.cd-chest-pip{width:20px;height:20px;object-fit:contain;vertical-align:-4px;filter:drop-shadow(0 1px 2px rgba(0,0,0,.25))}
.cd-chest-pip.locked{opacity:.45;filter:grayscale(.5)}
.cd-acts{display:flex;gap:10px;justify-content:center;margin:12px 0 4px}
.cd-acts button,.cd-again{border:2px solid #fff3c4;border-radius:16px;padding:11px 18px;font:900 15px sans-serif;color:#3a2008;text-shadow:0 1px 0 rgba(255,255,255,.65);background:linear-gradient(180deg,#ffe58f,#f5b82e);box-shadow:0 4px 0 #9e680c,0 6px 14px rgba(0,0,0,.25);cursor:pointer}
.cd-acts button.alt,.cd-hub{background:linear-gradient(180deg,#6b3f1f,#46260f);border-color:#d49a2a;color:#fff8e7;text-shadow:0 1px 2px rgba(0,0,0,.5);box-shadow:0 4px 0 #261205,0 6px 14px rgba(0,0,0,.25)}
.cd-tips-toggle{margin-top:6px;background:transparent;border:1px solid #c89d54;border-radius:999px;padding:4px 12px;font:800 11.5px sans-serif;color:#5c3416;cursor:pointer}
.cd-item{width:64px;height:64px;border-radius:50%;background:radial-gradient(circle,#fffdf7 0%,#ffe8b8 72%);border:2.5px solid #f5c344;box-shadow:0 0 0 2px #7a4612,0 5px 12px rgba(0,0,0,.35);display:grid;place-items:center;animation:cdPulse .6s infinite alternate;position:relative;margin-bottom:4px}
.cd-item img{width:46px;height:46px}.cd-item b{position:absolute;right:-4px;top:-4px;background:#b8326a;color:#fff;border:1.5px solid #ffd36e;border-radius:10px;font:900 11px/16px sans-serif;padding:0 5px}
.cd-build{margin-top:2px;display:inline-block;background:rgba(42,22,8,.82);border:1.5px solid #d49a2a;color:#fff8e7;border-radius:999px;padding:2.5px 9px;font:900 10.5px/1.35 sans-serif;letter-spacing:.3px;pointer-events:none;box-shadow:0 2px 6px rgba(0,0,0,.3)}
.cd-blink-chip{background:rgba(42,22,8,.85);border:1.5px solid #f5c344;border-radius:12px;padding:2px 8px;font:900 13px/1.2 sans-serif;color:#ffe699;box-shadow:0 0 8px rgba(245,195,68,.4);pointer-events:none}
.cd-warn{position:absolute;left:50%;top:22%;transform:translateX(-50%);font:900 30px/1 sans-serif;color:#fff36a;text-shadow:0 0 14px #b07cff,0 3px 0 #6a3aa8;animation:cdPulse .18s infinite alternate;pointer-events:none}
.cd-draft{position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity .25s;mix-blend-mode:screen;background:radial-gradient(ellipse 62% 58% at 50% 48%,transparent 58%,rgba(255,206,96,.32) 100%)}
.cd-draft::before,.cd-draft::after{content:'';position:absolute;top:20%;width:30%;height:42%;background:url('/assets/cloud_dash/fx_draft_wind.png') center/contain no-repeat;opacity:.55;animation:cdDraftFlow .45s linear infinite alternate;animation-play-state:paused}
.cd-draft.on::before,.cd-draft.on::after{animation-play-state:running}
.cd-draft::before{left:-9%;transform:rotate(-18deg)}
.cd-draft::after{right:-9%;transform:scaleX(-1) rotate(-18deg)}
@keyframes cdDraftFlow{from{translate:0 -4%}to{translate:0 4%}}
.cd-bc{text-align:left;margin:8px 0;padding:8px 10px;border-radius:14px;background:#fffdf8;border:2px solid #cfa04e;color:#3a2415;box-shadow:inset 0 1px 0 #fff}
.cd-bc h3{margin:0 0 4px;font:900 14.5px sans-serif;color:#6b2d0c}.cd-bc p{margin:2px 0;font:700 11.5px/1.3 sans-serif;color:#4b2a12}
.cd-bc .bar{height:8px;border-radius:5px;background:#ebd9b9;overflow:hidden;margin:5px 0 4px}.cd-bc .bar i{display:block;height:100%;background:linear-gradient(90deg,#f59e0b,#ec4899)}
.cd-bc-btn{display:block;width:100%;margin-top:6px;padding:6px 10px;border-radius:10px;border:1.5px solid #b57b1e;background:linear-gradient(180deg,#fff6d6,#f5cb6c);color:#3a1d04;font:900 11.5px/1.25 sans-serif;cursor:pointer;text-align:center;box-shadow:inset 0 1px 0 rgba(255,255,255,.8),0 2px 0 #7a4b0c}
@keyframes cdBanner{0%{opacity:0;transform:scale(.6)}15%{opacity:1;transform:scale(1.12)}30%{transform:scale(1)}80%{opacity:1}100%{opacity:0;transform:scale(1) translateY(-16px)}}
@keyframes cdPop{0%{opacity:1;transform:translate(-50%,0)}100%{opacity:0;transform:translate(-50%,-50px)}}
@keyframes cdCount{0%{transform:scale(1.8);opacity:0}30%{transform:scale(1);opacity:1}100%{transform:scale(.9);opacity:.9}}
@keyframes cdFlash{0%{opacity:.55}100%{opacity:0}}
@keyframes cdPulse{from{transform:scale(1)}to{transform:scale(1.08)}}
`;
    document.head.appendChild(style);
    const root = document.createElement('div');
    root.id = 'cloud-dash-root';
    root.hidden = true;
    root.innerHTML = `
      <div class="cd-area"></div>
      <div class="cd-lines"></div>
      <div class="cd-flash"></div>
      <div class="cd-top">
        <div class="cd-finish-pill">🏁 Finish Line: 0%</div>
        <div class="cd-bar"><div class="cd-bar-fill"></div></div>
        <div class="cd-row">
          <div class="cd-place-wrap">
            <div class="cd-place">1<small>st</small></div>
            <div class="cd-build"></div>
            <button class="cd-exit cd-leave" data-cd="exit">🚪 Leave</button>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end">
            <div class="cd-speed"><img src="${ASSET}icon_bolt.png" alt="" onerror="this.replaceWith('⚡')"><span>0</span>&nbsp;<em>km/h</em></div>
            <div style="display:flex;gap:8px;align-items:center">
              <div class="cd-blink-chip" hidden>🦊 ×0</div>
              <div class="cd-heart" hidden><span>💞</span></div>
              <div class="cd-bond-wrap">
                <div class="cd-bond"><img class="ico" src="/assets/pets/ragdoll_emo_joy.png" alt="" onerror="this.onerror=null;this.src='${ASSET}icon_paw.png'"></div>
                <div class="cd-bond-tag">🐱 Royal Pounce</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="cd-chain"></div>
      <div class="cd-warn" hidden>⚡ JUMP!</div>
      <div class="cd-draft"></div>
      <div class="cd-banner"></div>
      <div class="cd-count"></div>
      <div class="cd-ctrl">
        <div class="cd-lr-wrap">
          <div class="cd-lane-pips" aria-hidden="true">
            <span class="cd-lane-pip" data-lane-pip="-1"></span>
            <span class="cd-lane-pip active" data-lane-pip="0"></span>
            <span class="cd-lane-pip" data-lane-pip="1"></span>
          </div>
          <div class="cd-lr">
            <button class="cd-btn dir l" data-cd="left"><img class="gold-dir" src="${ASSET}cd_btn_dir_gold.png" alt="◀" onerror="this.onerror=null;this.classList.remove('gold-dir');this.src='${ASSET}btn_left.png'"></button>
            <div class="cd-lr-divider"></div>
            <button class="cd-btn dir r" data-cd="right"><img class="gold-dir" src="${ASSET}cd_btn_dir_gold.png" alt="▶" onerror="this.onerror=null;this.classList.remove('gold-dir');this.src='${ASSET}btn_right.png'"></button>
          </div>
          <div class="cd-label">STEER / SLIDE</div>
        </div>
        <div class="cd-right">
          <div class="cd-ultwrap"><button class="cd-btn cd-item" data-cd="item" hidden></button><button class="cd-btn cd-ult" data-cd="ult"><img src="${ASSET}btn_ult.png" alt="ULT" onerror="this.outerHTML='<span style=font-size:40px>🌈</span>'"></button><div class="cd-label cd-ult-label">ULT</div></div>
          <div class="cd-jump-wrap"><button class="cd-btn cd-jump jump" data-cd="jump"><img src="${ASSET}btn_jump.png" alt="JUMP" onerror="this.onerror=null;this.outerHTML='<span style=font-size:52px>🪽</span>'"></button><div class="cd-label">JUMP / GLIDE</div></div>
        </div>
      </div>
      <div class="cd-results" hidden></div>`;
    document.body.appendChild(root);
    this.root = root;
    const $ = (sel) => root.querySelector(sel);
    this.el = {
      fill: $('.cd-bar-fill'), bar: $('.cd-bar'), finishPill: $('.cd-finish-pill'),
      place: $('.cd-place'), speed: $('.cd-speed span'), speedTag: $('.cd-speed em'),
      bond: $('.cd-bond'), bondIco: $('.cd-bond img.ico'), bondTag: $('.cd-bond-tag'),
      chain: $('.cd-chain'), banner: $('.cd-banner'), flash: $('.cd-flash'), lines: $('.cd-lines'), ult: $('.cd-ult'),
      item: $('.cd-item'), build: $('.cd-build'), warn: $('.cd-warn'), draft: $('.cd-draft'), ultLabel: $('.cd-ult-label'), heart: $('.cd-heart'),
      blinkChip: $('.cd-blink-chip'),
      lrPad: $('.cd-lr'), btnLeft: $('.cd-btn.dir.l'), btnRight: $('.cd-btn.dir.r'),
      lanePips: Array.from(root.querySelectorAll('[data-lane-pip]')),
    };
    this.countdown = $('.cd-count');
    this.results = $('.cd-results');
    this.dots = [];

    // iOS Safari / iPhone gesture lock: non-passive touchstart & touchmove prevent edge-swipe back & bottom home-bar app-switch
    const shouldAllowDefaultTouch = (target) => {
      if (!target || !target.closest) return false;
      if (!this.results?.hidden && target.closest('.cd-results')) return true;
      if (target.closest('[data-cd="exit"]')) return true;
      return false;
    };
    root.addEventListener('touchstart', (e) => {
      if (!this.active || shouldAllowDefaultTouch(e.target)) return;
      if (e.cancelable) e.preventDefault();
    }, { passive: false });
    root.addEventListener('touchmove', (e) => {
      if (!this.active || shouldAllowDefaultTouch(e.target)) return;
      if (e.cancelable) e.preventDefault();
    }, { passive: false });

    // Unified < > Rocker Pill: supports 0ms tap, thumb-roll slide (◀ ↔ ▶ without lifting), and hold-to-cross-lanes
    const lrPad = this.el.lrPad;
    const btnL = this.el.btnLeft;
    const btnR = this.el.btnRight;
    let lrState = null; // { pointerId, activeDir, lastX, repeatTimer }

    const clearLrHold = () => {
      if (lrState?.repeatTimer) clearInterval(lrState.repeatTimer);
      lrState = null;
      btnL?.classList.remove('down');
      btnR?.classList.remove('down');
    };

    const triggerLrDir = (dir, clientX, pointerId) => {
      if (!dir) return;
      if (lrState?.repeatTimer) clearInterval(lrState.repeatTimer);
      btnL?.classList.toggle('down', dir === 'left');
      btnR?.classList.toggle('down', dir === 'right');
      this._press(dir);
      this._haptic(8);
      const repeatTimer = setInterval(() => {
        if (!this.active || !lrState || lrState.activeDir !== dir) {
          clearLrHold();
          return;
        }
        const curLane = this.runner?.laneT ?? 0;
        if ((dir === 'left' && curLane <= -1) || (dir === 'right' && curLane >= 1)) return;
        this._press(dir);
        this._haptic(6);
      }, 170);
      lrState = { pointerId, activeDir: dir, lastX: clientX, repeatTimer };
    };

    const resolveRockerDir = (clientX) => {
      const rect = lrPad.getBoundingClientRect();
      const midX = rect.left + rect.width * 0.5;
      return clientX < midX ? 'left' : 'right';
    };

    lrPad.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      try { lrPad.setPointerCapture?.(e.pointerId); } catch {}
      const dir = resolveRockerDir(e.clientX);
      triggerLrDir(dir, e.clientX, e.pointerId);
    });

    lrPad.addEventListener('pointermove', (e) => {
      if (!lrState || lrState.pointerId !== e.pointerId) return;
      e.preventDefault();
      e.stopPropagation();
      const sideDir = resolveRockerDir(e.clientX);
      const dx = e.clientX - lrState.lastX;
      // Switch direction immediately if thumb crosses center divider or slides >= 24px in opposite direction
      if (sideDir !== lrState.activeDir || (lrState.activeDir === 'left' && dx > 24) || (lrState.activeDir === 'right' && dx < -24)) {
        const nextDir = sideDir !== lrState.activeDir ? sideDir : (dx > 0 ? 'right' : 'left');
        triggerLrDir(nextDir, e.clientX, e.pointerId);
      }
    });

    lrPad.addEventListener('pointerup', (e) => {
      if (lrState && lrState.pointerId === e.pointerId) clearLrHold();
    });
    lrPad.addEventListener('pointercancel', clearLrHold);
    lrPad.addEventListener('lostpointercapture', clearLrHold);

    // Non-directional buttons (jump, ult, item, exit): fire on pointerdown for lowest latency
    root.querySelectorAll('[data-cd]').forEach((b) => {
      const kind = b.dataset.cd;
      if (kind === 'left' || kind === 'right') return; // Handled by unified lrPad rocker above
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault(); e.stopPropagation();
        if (kind === 'exit') { this._leave(); return; }
        b.classList.add('down');
        if (kind === 'jump') this._padHeld = true;
        this._press(kind);
      });
      const upFn = () => { b.classList.remove('down'); if (kind === 'jump') this._padHeld = false; };
      b.addEventListener('pointerup', upFn); b.addEventListener('pointercancel', upFn); b.addEventListener('pointerleave', upFn);
    });
    // swipe area: ←/→ lanes, ↑ jump, tap = jump, hold = glide (ignores iOS screen-edge 22px zone)
    const area = $('.cd-area');
    let g = null;
    area.addEventListener('pointerdown', (e) => {
      const vw = window.innerWidth || 390;
      const vh = window.innerHeight || 844;
      if (e.clientX < 22 || e.clientX > vw - 22 || e.clientY > vh - 34) return;
      g = { x: e.clientX, y: e.clientY, t: performance.now(), fired: false, id: e.pointerId };
      this._areaHeld = true;
    });
    area.addEventListener('pointermove', (e) => {
      if (!g || g.id !== e.pointerId) return;
      const dx = e.clientX - g.x, dy = e.clientY - g.y;
      if (Math.abs(dx) > 26 && Math.abs(dx) > Math.abs(dy)) { this._press(dx < 0 ? 'left' : 'right'); g.x = e.clientX; g.y = e.clientY; g.fired = true; }
      else if (dy < -26 && Math.abs(dy) > Math.abs(dx)) { if (!g.fired) this._press('jump'); g.y = e.clientY; g.x = e.clientX; g.fired = true; }
    });
    const end = (e) => {
      if (g && g.id === e.pointerId && !g.fired && performance.now() - g.t < 240) this._press('jump');
      g = null; this._areaHeld = false;
    };
    area.addEventListener('pointerup', end); area.addEventListener('pointercancel', end);
  }

  _ensureDots() {
    if (this.dots.length === (this.roster || []).length) return;
    this.el.bar.querySelectorAll('.cd-dot').forEach((d) => d.remove());
    this.dots = (this.roster || []).map((p) => {
      const d = document.createElement('div');
      d.className = `cd-dot ${p.seat === this.mySeat ? 'me' : ''}`;
      const portrait = chibiPortraitUrl(p);
      const hair = chibiHairUrl(p);
      d.style.backgroundImage = `url('${hair}'), url('${portrait}')`;
      const crownEl = document.createElement('span');
      crownEl.className = 'cd-dot-crown';
      crownEl.textContent = '👑';
      crownEl.hidden = true;
      const rankEl = document.createElement('span');
      rankEl.className = 'cd-dot-rank';
      rankEl.textContent = PLACE_TXT[p.seat % 4] || '1st';
      d.appendChild(crownEl);
      d.appendChild(rankEl);
      this.el.bar.appendChild(d);
      return { seat: p.seat, el: d, crownEl, rankEl };
    });
  }

  _updateHud(force) {
    if (!this.runner) return;
    const r = this.runner;
    this._hudT = (this._hudT || 0) + 1;
    if (!force && this._hudT % 2) return; // ~30 Hz is plenty for DOM
    this._ensureDots();
    const frac = (s) => Math.max(0, Math.min(1, s / T.TRACK_LEN));
    const myPct = Math.round(frac(r.s) * 100);
    this.el.fill.style.width = `calc(${frac(r.s) * 100}% - 4px)`;
    if (this.el.finishPill) {
      this.el.finishPill.textContent = `🏁 Finish Line: ${myPct}%`;
    }
    const dotS = this.dots.map((d) => ({
      d,
      s: d.seat === this.mySeat ? r.s : (this.rivals.get(d.seat)?.disp?.s || 0),
    }));
    dotS.sort((a, b) => b.s - a.s);
    dotS.forEach((entry, idx) => {
      const { d, s } = entry;
      d.el.style.left = `${frac(s) * 100}%`;
      if (d.rankEl) d.rankEl.textContent = PLACE_TXT[idx] || `${idx + 1}th`;
      if (d.crownEl) d.crownEl.hidden = idx !== 0;
    });
    const place = this.mySeat >= 0 ? this._localPlace() : 0;
    if (place) this.el.place.innerHTML = `${place}<small>${PLACE_TXT[place - 1].slice(1)}</small>`;
    this.el.speed.textContent = displayKmh(r.v);
    this.el.speedTag.textContent = r.ult > 0 ? 'ULT!' : r.ride > 0 ? 'Pet Ride!' : r.mach > 0 ? 'Mach Wing!' : 'km/h';
    this.el.bond.style.setProperty('--p', `${r.ride > 0 ? 100 : r.bond}%`);
    this.el.bond.classList.toggle('full', r.ride > 0 || r.bond >= 90);
    if (this.el.bondTag) {
      const meta = PET_MOUNT_META[this.myPetId] || PET_MOUNT_META.pet_ragdoll;
      const riding = r.ride > 0;
      this.el.bondTag.classList.toggle('riding', riding);
      this.el.bondTag.textContent = riding ? `✨ RIDING! · ${meta.badge}` : meta.badge;
      const wantIco = `/assets/pets/${meta.sprite}_emo_joy.png`;
      if (this.el.bondIco && !this.el.bondIco.src.endsWith(wantIco)) {
        this.el.bondIco.src = wantIco;
      }
    }
    const tier = chainTier(r.chain);
    this.el.chain.className = `cd-chain t${tier}`;
    this.el.chain.innerHTML = r.chain > 0 ? `<b>CHAIN ×${[1, 2, 3, 4][tier]}</b>${r.chain}` : '';
    this.el.ult.style.setProperty('--p', `${r.ult > 0 ? 100 : r.ultCharge}%`);
    const ready = r.ultCharge >= 100 && r.ult <= 0;
    this.el.ult.classList.toggle('ready', ready);
    this.el.ultLabel.classList.toggle('ready', ready);
    this.el.lines.style.opacity = String(Math.max(0, Math.min(0.75, (speedMul(r) - 1.1) * 1.4)));
    this.el.warn.hidden = !r.incoming?.some((f) => f.kind === 'shrink');
    // Only fade in once the draft meter is meaningfully charging, so brief passes behind a rival don't flash.
    const df = r.drafting ? Math.min(1, r.draft / T.SLIP.fill) : 0;
    const draftOp = r.slip > 0 ? 0.85 : df > 0.25 ? ((df - 0.25) / 0.75) * 0.6 : 0;
    this.el.draft.style.opacity = String(draftOp);
    this.el.draft.classList.toggle('on', draftOp > 0);
    const showHeart = !!(this.heartWith?.length && (r.hearting || r.heart > 0));
    this.el.heart.hidden = !showHeart;
    if (showHeart) {
      this.el.heart.style.setProperty('--p', `${Math.min(100, Math.max(0, r.heart))}%`);
      this.el.heart.classList.toggle('full', r.heart >= 95 || r.heartBoost > 0);
    }
    const ul = r.ult > 0 ? (r.ultDef?.name || 'ULT') : ready ? '⚡ ULT READY!' : 'ULT';
    if (this.el.ultLabel.textContent !== ul) this.el.ultLabel.textContent = ul;
    const showBlink = r.ride > 0 && r.rideStyle === 'blink';
    if (this.el.blinkChip) {
      this.el.blinkChip.hidden = !showBlink;
      if (showBlink) this.el.blinkChip.textContent = `🦊 ×${r.blink || 0}`;
    }
    const curLane = Math.max(-1, Math.min(1, Math.round(r.laneT ?? 0)));
    if (this.el.lanePips?.length) {
      for (const pip of this.el.lanePips) {
        pip.classList.toggle('active', Number(pip.dataset.lanePip) === curLane);
      }
    }
    this.el.btnLeft?.classList.toggle('at-edge', curLane <= -1);
    this.el.btnRight?.classList.toggle('at-edge', curLane >= 1);
  }

  _banner(text, ms = 900, cls = '') {
    const el = this.el.banner;
    el.className = 'cd-banner';
    void el.offsetWidth;
    el.textContent = text;
    el.style.setProperty('--d', `${ms}ms`);
    el.className = `cd-banner show ${cls}`;
  }
  _pop(text, color) {
    const d = document.createElement('div');
    d.className = 'cd-pop'; d.textContent = text; d.style.color = color;
    this.root.appendChild(d);
    setTimeout(() => d.remove(), 720);
  }
  _flash(color, vignette = false) {
    const el = this.el.flash;
    el.style.background = vignette && color ? `radial-gradient(ellipse at center, rgba(255,255,255,0.12) 30%, ${color}cc 100%)` : color;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  }

  _renderItemBubble() {
    const r = this.runner, el = this.el.item;
    if (!el) return;
    const id = r?.items?.[0];
    el.hidden = !id;
    if (!id) { el.innerHTML = ''; return; }
    const def = ITEM_DEFS[id];
    el.innerHTML = `<img src="${ASSET}item_${id}.png" alt="${def.icon}" onerror="this.outerHTML='<span style=font-size:34px>${def.icon}</span>'">${r.items.length > 1 ? `<b>×${r.items.length}</b>` : ''}`;
  }

  _buildLabel(b) {
    if (!b) return '';
    const tiers = ['', 'I', 'II', 'III', '✦ IV'];
    if (b.kind === 'hybrid') return `${b.icon} ${b.name.toUpperCase()}`;
    if (b.kind === 'balanced') return '🌈 BALANCED';
    return `${b.icon.repeat(Math.min(3, b.tier))} ${b.name.toUpperCase()} ${tiers[b.tier] || ''}`;
  }

  _renderBuildBadge() {
    if (this.el?.build) {
      const base = this._buildLabel(this.myBuild);
      let prefix = '';
      if (this.dashMode === 'league') prefix = '🏆 LEAGUE · ';
      else if (this.dashMode === 'ghost') prefix = '👻 GHOST · ';
      else if (this.dashMode === 'chaos') prefix = '🎉 CHAOS · ';
      const weatherPart = this.weather?.icon ? ` · ${this.weather.icon} ${this.weather.name || ''}` : '';
      const text = `${prefix}${base}${weatherPart}`.trim();
      this.el.build.innerHTML = esc(text).replace(/🪙/g, '<img class="cd-inline-ico" src="/assets/ui/icon_gold.png" alt="">');
      this.el.build.hidden = !text;
    }
  }

  /** 🃏 Build Card: identity, perks (✅ unlocked / 🔒 next), one progress bar, one next step. */
  _buildCardHtml() {
    let build;
    try { build = detectBuild(computeUniversalStats(this.getProfile?.() || {}).bonus); } catch { return ''; }
    const fmtC = (s) => String(s ?? '').replace(/🪙/g, '<img class="cd-inline-ico" src="/assets/ui/icon_gold.png" alt="">');
    const next = buildNextStep(build);
    let perks = '';
    if (build.kind === 'main') perks = (BUILD_PERKS[build.id] || []).map((p, i) => `<p>${i < build.tier ? '✅' : '🔒'} ${fmtC(esc(p))}</p>`).join('');
    else if (build.kind === 'hybrid') perks = `<p>✅ ${fmtC(esc(build.perk || ''))}</p>`;
    else perks = `<p>✅ ${fmtC(esc(BUILD_PERKS.balanced[0]))}</p>`;
    const tip = build.kind === 'main' ? BUILDS[build.id].tip : build.kind === 'hybrid' ? 'A rare combo build — you discovered it!' : BUILDS.balanced.tip;
    const pct = next ? Math.max(4, Math.min(100, Math.round(next.have / next.need * 100))) : 100;
    return `<div class="cd-bc"><h3>🧬 ${fmtC(esc(this._buildLabel(build)))}</h3><p style="opacity:.85">${fmtC(esc(tip))}</p>${perks}
      ${next ? `<div class="bar"><i style="width:${pct}%"></i></div><button type="button" class="cd-bc-btn" data-res="goto-forge">👉 ${fmtC(esc(next.text))} — Forge Gear / Pet ▸</button>` : build.kind === 'balanced' ? '<p>💡 Focus gear &amp; pet rolls on one stat to unlock a build (or two for a secret Hybrid!)</p><button type="button" class="cd-bc-btn" data-res="goto-forge">👉 Visit Blacksmith Forge to focus gear &amp; pet ▸</button>' : build.kind === 'hybrid' ? '<button type="button" class="cd-bc-btn" data-res="goto-forge">👉 Visit Blacksmith Forge to upgrade your Hybrid ▸</button>' : '<p>👑 Max tier reached!</p>'}</div>`;
  }

  // ---------------------------------------------------------------- results
  _showResults(m) {
    this.coach?._hide();
    const me = m.rewards?.[this.myId] || m.rewards?.[this.getProfile?.()?.username] || Object.values(m.rewards || {})[0];
    if (me?.league) {
      if (!me.league.tier) {
        me.league.tier = me.league.afterTier || leagueTierFor(me.league.afterLp || me.league.lp || 0);
      }
      if (me.league.lp == null) me.league.lp = me.league.afterLp || 0;
      if (me.league.delta == null) me.league.delta = 0;
    }
    if (me?.daily) {
      if (!me.daily.chestGranted && me.dailyChestReward) me.daily.chestGranted = me.dailyChestReward;
      if (!me.daily.chestPopped && me.chestPopped) me.daily.chestPopped = me.chestPopped;
      if (!me.daily.missionsCompleted && me.completedMissions) me.daily.missionsCompleted = me.completedMissions;
    }
    const rawRunners = m.runners || m.ranking || m.podium || [];
    const order = [...rawRunners].sort((a, b) => (a.place || 9) - (b.place || 9));
    const rosterOf = (seat) => (this.roster || []).find((p) => p.seat === seat) || { seat, name: `Racer ${seat + 1}` };
    const nameOf = (seat) => rosterOf(seat).name || `Racer ${seat + 1}`;
    const finishSec = (o) => o?.ft ?? (o?.finishMs != null ? o.finishMs / 1000 : null);
    const fmt = (sec) => (sec == null ? 'DNF' : `${Number(sec).toFixed(2)}s`);
    const ico = (n) => `<img src="/assets/ui/icon_${n}.png" alt="">`;
    const smIco = (n) => `<img class="cd-inline-ico" src="/assets/ui/icon_${n}.png" alt="">`;
    const r = this.runner || {};
    const goal = me && this.coach ? this.coach.nextGoal({ ...this.raceStats, perfects: r.perfects, hits: r.hits, place: me.place, finishMs: me.finishMs, bestMs: me.newBestTime ? null : (this.getProfile?.()?.dash_stats?.bestMs || null) }) : null;

    const podiumStageHtml = `
      <div class="cd-podium-stage">
        ${order.slice(0, 4).map((o, idx) => {
          const p = rosterOf(o.seat);
          const placeNum = o.place || (idx + 1);
          const petId = normalizePetId(p.petId || p.equipped?.pet?.id || (o.seat === this.mySeat ? this.myPetId : 'pet_ragdoll'));
          const petSp = PETS[petId]?.sprite || 'ragdoll';
          const portrait = chibiPortraitUrl(p);
          const hairUrl = chibiHairUrl(p);
          return `
            <div class="cd-podium-col p${placeNum} ${o.seat === this.mySeat ? 'me' : ''}">
              <div class="cd-podium-av-wrap">
                <img class="cd-podium-av" src="${portrait}" alt="${esc(nameOf(o.seat))}" onerror="this.src='/assets/chibi/bkk_base_front.png'">
                <img class="cd-podium-hair" src="${hairUrl}" alt="" onerror="this.style.display='none'">
                <img class="cd-podium-pet" src="/assets/pets/${petSp}_emo_joy.png" alt="" onerror="this.style.display='none'">
              </div>
              <div class="cd-podium-name">${esc(nameOf(o.seat))}</div>
              <div class="cd-podium-pillar">
                <span>${placeNum === 1 ? '👑 1st' : PLACE_TXT[placeNum - 1] || `${placeNum}th`}</span>
                <small>${fmt(finishSec(o))}</small>
                <small>✨${(o.style || 0).toLocaleString()}</small>
              </div>
            </div>`;
        }).join('')}
      </div>`;

    let leagueHtml = '';
    if (me?.league) {
      const lt = me.league.tier;
      leagueHtml = `
        <div class="cd-league-card">
          <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px;background:#fffdf8;border:1.5px solid #d4a656;border-radius:12px;margin:5px 0;font:800 13.5px sans-serif;color:#3a2008">
            <span>${lt.icon} <b>${esc(lt.name)} League</b></span>
            <span>${me.league.lp} LP <b style="color:${me.league.delta >= 0 ? '#15803d' : '#c0392b'}">(${me.league.delta >= 0 ? '+' : ''}${me.league.delta} LP)</b></span>
          </div>
          ${me.league.promoted ? `<div class="cd-promo-badge">🎉 PROMOTED TO ${esc(lt.name.toUpperCase())}! (+25 ${smIco('diamond')})</div>` : ''}
        </div>`;
    }

    let dailyHtml = '';
    if (me?.daily) {
      const chestsCount = Math.max(0, Math.min(DASH_DAILY_CHEST_MAX, me.daily.chests || 0));
      const chestPips = Array.from({ length: DASH_DAILY_CHEST_MAX }, (_, i) =>
        i < chestsCount
          ? '<img class="cd-chest-pip" src="/assets/monopoly/gacha_trunk_mythic.png" alt="Chest">'
          : '<img class="cd-chest-pip locked" src="/assets/ui/item_dupe_box.png" alt="Locked">'
      ).join('');
      const chestPts = me.daily.chestPts || 0;
      const barPct = Math.max(0, Math.min(100, Math.round((chestPts / DASH_CHEST_BAR_MAX) * 100)));
      dailyHtml = `
        <div class="cd-daily-box" style="margin:8px 0;padding:8px 10px;background:#fffdf8;border:2px solid #cfa04e;border-radius:14px;text-align:left;color:#3a2008">
          <div style="display:flex;justify-content:space-between;align-items:center;font:900 13px sans-serif;color:#6b2d0c">
            <span class="cd-chest-bar">${chestPips} <b>${chestsCount}/${DASH_DAILY_CHEST_MAX} Daily Sky Chests</b></span>
          </div>
          ${me.daily.chestGranted ? `<div class="cd-best" style="font-size:12.5px;margin:4px 0">🎉 Daily Chest #${me.daily.chestGranted.pip} Opened! (+${me.daily.chestGranted.gold} ${smIco('gold')} +${me.daily.chestGranted.berries} ${smIco('berry')} +${me.daily.chestGranted.diamonds} ${smIco('diamond')})</div>` : ''}
          <div style="margin:6px 0 4px">
            <div style="display:flex;justify-content:space-between;font:800 11px sans-serif;color:#5c3416">
              <span>Sky Chest Progress</span><span>${chestPts}/${DASH_CHEST_BAR_MAX}</span>
            </div>
            <div class="bar" style="height:8px;border-radius:4px;background:#ebd9b9;overflow:hidden;margin:3px 0">
              <i style="display:block;height:100%;background:linear-gradient(90deg,#f59e0b,#ec4899);width:${barPct}%"></i>
            </div>
            ${me.daily.chestPopped ? `<div class="cd-best" style="font-size:12.5px">🎊 Bonus Sky Chest Unboxed!</div>` : ''}
          </div>
          ${Array.isArray(me.daily.missions) && me.daily.missions.length ? `
            <div style="margin-top:6px;border-top:1px dashed #d4a656;padding-top:5px">
              <div style="font:900 12px sans-serif;color:#6b2d0c;margin-bottom:3px">Daily Dash Missions</div>
              ${me.daily.missions.map((ms) => {
                const prog = ms.prog ?? ms.progress ?? 0;
                const need = ms.need ?? ms.target ?? 1;
                const claimed = ms.claimed ?? ms.done ?? false;
                const completedThisRace = (me.daily.missionsCompleted || []).some((c) => c.id === ms.id);
                const goldRew = ms.gold || ms.reward?.gold || 0;
                return `
                  <div style="display:flex;justify-content:space-between;align-items:center;font:700 11px sans-serif;padding:2px 0;color:#4b2a12">
                    <span>${ms.icon || '🎯'} ${esc(ms.title || ms.text || ms.label || '')}</span>
                    <span style="display:inline-flex;gap:4px;align-items:center;font-weight:800">
                      <span>${prog}/${need}</span>
                      <span>${completedThisRace ? `<b style="color:#b8326a">🎉 +${goldRew} ${smIco('gold')}</b>` : (claimed ? '✅' : '⏳')}</span>
                    </span>
                  </div>`;
              }).join('')}
            </div>
          ` : ''}
        </div>`;
    }

    this.results.innerHTML = `
      <div class="cd-card">
        <h2>${me ? (me.place === 1 ? '🏆 ROYAL VICTORY!' : `🏁 ${PLACE_TXT[me.place - 1]} Place!`) : '🏁 Race Over'}</h2>
        ${podiumStageHtml}
        <div class="cd-pod">${order.map((o) => `<div class="${o.seat === this.mySeat ? 'me' : ''}"><span>${PLACE_TXT[(o.place || 1) - 1]} · ${esc(nameOf(o.seat))}</span><span>${fmt(finishSec(o))} · ✨${(o.style || 0).toLocaleString()}</span></div>`).join('')}</div>
        ${me ? `
          ${me.newBestTime ? '<div class="cd-best">⏱️ NEW BEST TIME!</div>' : ''}
          ${me.newBestStyle ? '<div class="cd-best">✨ NEW BEST STYLE!</div>' : ''}
          ${me.newGhostPb ? '<div class="cd-best">👻 NEW GHOST PB RECORD!</div>' : ''}
          ${(me.streak || 0) >= 2 ? `<div class="cd-best">🔥 Top-2 Streak ×${me.streak}!</div>` : ''}
          <div class="cd-rew"><span>${ico('gold')} ${me.gold}</span><span>${ico('berry')} ${me.berries}</span><span>${ico('diamond')} ${me.diamonds}</span></div>
          <div style="font:800 11.5px sans-serif;color:#5c3416">Style ✨${(me.style || 0).toLocaleString()} · ${me.multiplier > 1 ? `💖 Vitality ×${me.multiplier.toFixed(2)} · ` : ''}+${me.exp} EXP${me.levelsGained ? ' · 🎉 LEVEL UP!' : ''}</div>` : ''}
        ${leagueHtml}
        ${dailyHtml}
        ${this._buildCardHtml()}
        ${goal ? `<div class="cd-goal"><i>${goal.icon}</i><span><b>Next goal:</b> ${goal.text}</span></div>` : ''}
        <div class="cd-acts"><button class="cd-again" data-res="again">🔁 Run It Back</button><button class="alt cd-hub" data-res="exit">🏠 Exit</button></div>
        <button class="cd-tips-toggle" data-res="tips">🐾 Pet tips: ${this.coach?.enabled === false ? 'OFF' : 'ON'}</button>
      </div>`;
    this.results.hidden = false;
    this.results.querySelector('[data-res="again"]').onclick = () => {
      this.results.hidden = true;
      this.seed = null;
      this.net?.send({ type: 'table_rematch', tableId: this.tableId });
    };
    this.results.querySelector('[data-res="exit"]').onclick = () => this._leave();
    const forgeBtn = this.results.querySelector('[data-res="goto-forge"]');
    if (forgeBtn) {
      forgeBtn.onclick = () => {
        this._leave();
        window.__neora?.rpg?.open?.('forge');
      };
    }
    const tb = this.results.querySelector('[data-res="tips"]');
    if (tb) tb.onclick = () => { this.coach?.setEnabled(!this.coach.enabled); tb.textContent = `🐾 Pet tips: ${this.coach?.enabled ? 'ON' : 'OFF'}`; };
    if (me?.place === 1) this.audio.chord(659);
  }

  _leave() {
    this.net?.send({ type: 'cd_leave', tableId: this.tableId });
    this.close();
  }
}
