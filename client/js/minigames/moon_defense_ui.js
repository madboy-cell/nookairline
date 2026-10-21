// client/js/minigames/moon_defense_ui.js — Moon Defense 3D Map & Clean Village-Style Build Toggle UI
// True Warcraft 3 Island Defense / Titan Hunt Co-Op Survival on a Big 56m × 56m (28×28 Grid)
// Dark Enchanted Forest Map with Real 3D Fog of War, Vision Wards, Diamond Drills & Mobile-Vertical Ergonomics.

import * as THREE from 'three';
import { ChibiRig } from '../chibi_rig.js?v=cd47';
import { CHARMS } from '/shared/charm_catalog.js';
import {
  MD_GRID,
  MD_COVES,
  MD_BUILDINGS,
  MD_ELEMENTS,
  MD_HERO_SKILLS,
  gridToWorld,
  worldToGrid,
  getTileInfo,
  canPlaceBuilding,
  resolveTowerFusion,
} from '/shared/moon_defense_rules.js';

const GRID_N = MD_GRID?.SIZE || 28;
const CELL_M = MD_GRID?.CELL || 2.0;
const HALF_M = MD_GRID?.HALF || 28.0;
const HALF_IDX = (GRID_N - 1) * 0.5;
const WALK_LIMIT = HALF_M - 0.8;

const FALLBACK_COVES_28 = {
  nw: {
    id: 'nw',
    seat: 0,
    name: 'NW Moonshroud Grove',
    icon: '🌙',
    color: '#60a5fa',
    spawn: { x: -18, z: -18 },
    center: { x: -18, z: -18 },
    gxRange: [2, 7],
    gzRange: [2, 7],
    choke: [[8, 4], [8, 5]],
    veins: [[2, 2], [3, 2], [2, 3]],
  },
  ne: {
    id: 'ne',
    seat: 1,
    name: 'NE Ambercap Hollow',
    icon: '🍄',
    color: '#fbbf24',
    spawn: { x: 18, z: -18 },
    center: { x: 18, z: -18 },
    gxRange: [20, 25],
    gzRange: [2, 7],
    choke: [[19, 4], [19, 5]],
    veins: [[25, 2], [24, 2], [25, 3]],
  },
  sw: {
    id: 'sw',
    seat: 2,
    name: 'SW Elderwood Den',
    icon: '🌸',
    color: '#f472b6',
    spawn: { x: -18, z: 18 },
    center: { x: -18, z: 18 },
    gxRange: [2, 7],
    gzRange: [20, 25],
    choke: [[8, 22], [8, 23]],
    veins: [[2, 25], [3, 25], [2, 24]],
  },
  se: {
    id: 'se',
    seat: 3,
    name: 'SE Starlight Glade',
    icon: '💎',
    color: '#34d399',
    spawn: { x: 18, z: 18 },
    center: { x: 18, z: 18 },
    gxRange: [20, 25],
    gzRange: [20, 25],
    choke: [[19, 22], [19, 23]],
    veins: [[25, 25], [24, 25], [25, 24]],
  },
};

function getActiveCovesMap() {
  if (MD_COVES && MD_COVES.nw?.gxRange?.[1] >= 7) {
    return MD_COVES;
  }
  return FALLBACK_COVES_28;
}

const COVE_LIST = Object.values(getActiveCovesMap());

const ELEMENT_BOLT_HEX = {
  storm: 0x38bdf8,
  water: 0x60a5fa,
  frost: 0x60a5fa,
  fire: 0xf97316,
  nature: 0xf472b6,
  bloom: 0xf472b6,
  light: 0xfacc15,
  dark: 0xa855f7,
};

const BUILD_TOOLS = [
  { kind: 'wall',          icon: '🧱', label: 'Gate Wall',     defaultCost: 25 },
  { kind: 'mine',          icon: '⛏️', label: 'Gold Mine',     defaultCost: 35 },
  { kind: 'diamond_drill', icon: '💎', label: 'Diamond Drill', defaultCost: 90 },
  { kind: 'totem',         icon: '💖', label: 'Heal Totem',    defaultCost: 45 },
  { kind: 'ward',          icon: '👁️', label: 'Vision Ward',   defaultCost: 30 },
  { kind: 'tower_storm',   icon: '⚡', label: 'Storm',         defaultCost: 40, element: 'storm' },
  { kind: 'tower_water',   icon: '❄️', label: 'Frost',         defaultCost: 40, element: 'water' },
  { kind: 'tower_fire',    icon: '🔥', label: 'Fire',          defaultCost: 40, element: 'fire' },
  { kind: 'tower_nature',  icon: '🌸', label: 'Bloom',         defaultCost: 40, element: 'nature' },
  { kind: 'tower_light',   icon: '🌟', label: 'Light',         defaultCost: 45, element: 'light' },
  { kind: 'tower_dark',    icon: '🌑', label: 'Dark',          defaultCost: 45, element: 'dark' },
];

// Default spread-out Wilds Resource Nodes, Diamond Motherlodes & Chests across the 56m × 56m Dark Enchanted Forest
const DEFAULT_WILDS_NODES = [
  { id: 'center_diamond_lode', kind: 'motherlode', label: '💎 Diamond Motherlode (+75🪙 • +💎)', x:   0.0, z:  -2.4, hp: 240, maxHp: 240, gold: 75 },
  { id: 'wild_ore_nw',         kind: 'ore',        label: '⛏️ Starlight Ore (+35🪙)',            x: -10.5, z:  -5.5, hp: 120, maxHp: 120, gold: 35 },
  { id: 'wild_ore_ne',         kind: 'ore',        label: '⛏️ Starlight Ore (+35🪙)',            x:  10.5, z:  -5.5, hp: 120, maxHp: 120, gold: 35 },
  { id: 'wild_ore_sw',         kind: 'ore',        label: '⛏️ Starlight Ore (+35🪙)',            x: -10.5, z:   5.5, hp: 120, maxHp: 120, gold: 35 },
  { id: 'wild_ore_se',         kind: 'ore',        label: '⛏️ Starlight Ore (+35🪙)',            x:  10.5, z:   5.5, hp: 120, maxHp: 120, gold: 35 },
  { id: 'wild_lode_n',         kind: 'motherlode', label: '💎 Motherlode Quarry (+60🪙)',        x:   0.0, z: -15.5, hp: 190, maxHp: 190, gold: 60 },
  { id: 'wild_lode_s',         kind: 'motherlode', label: '💎 Motherlode Quarry (+60🪙)',        x:   0.0, z:  15.5, hp: 190, maxHp: 190, gold: 60 },
  { id: 'wild_chest_w',        kind: 'chest',      label: '🎁 Reliquary Chest (+50🪙)',          x: -16.5, z:   0.0, hp: 100, maxHp: 100, gold: 50 },
  { id: 'wild_chest_e',        kind: 'chest',      label: '🎁 Reliquary Chest (+50🪙)',          x:  16.5, z:   0.0, hp: 100, maxHp: 100, gold: 50 },
];

const ENEMY_SPRITES = {
  slime: '/assets/monopoly/mb_green_slime.png',
  green_slime: '/assets/monopoly/mb_green_slime.png',
  imp: '/assets/monopoly/mb_berry_slime.png',
  berry_slime: '/assets/monopoly/mb_berry_slime.png',
  golem: '/assets/monopoly/mb_armored_boar.png',
  armored_boar: '/assets/monopoly/mb_armored_boar.png',
  specter: '/assets/monopoly/mb_moon_bunny_idle.png',
  moon_bunny: '/assets/monopoly/mb_moon_bunny_idle.png',
  ribbon_pig: '/assets/monopoly/mb_ribbon_pig.png',
  gold_pig: '/assets/monopoly/mb_gold_pinata_pig.png',
  boss_mochi: '/assets/monopoly/mb_king_mochi_boss.png',
  king_mochi: '/assets/monopoly/mb_king_mochi_boss.png',
  boss_golem: '/assets/monopoly/id_titan_mochi_idle.png',
  boss_kraken: '/assets/monopoly/id_titan_wolf_stalk.png',
  boss_dragon: '/assets/monopoly/id_titan_dragon_siege.png',
  titan: '/assets/monopoly/id_titan_dragon_siege.png',
  titan_wolf: '/assets/monopoly/id_titan_wolf_stalk.png',
  titan_mochi: '/assets/monopoly/id_titan_mochi_idle.png',
  titan_dragon: '/assets/monopoly/id_titan_dragon_siege.png',
};

const texLoader = new THREE.TextureLoader();
const texCache = new Map();
function loadTex(url) {
  if (!url) return null;
  if (texCache.has(url)) return texCache.get(url);
  const t = texLoader.load(url, (loaded) => {
    loaded.colorSpace = THREE.SRGBColorSpace;
    loaded.needsUpdate = true;
  });
  t.colorSpace = THREE.SRGBColorSpace;
  texCache.set(url, t);
  return t;
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function safeGridToWorld(gx, gz) {
  if (typeof gridToWorld === 'function' && MD_GRID?.SIZE === 28) {
    return gridToWorld(gx, gz);
  }
  return { x: (gx - HALF_IDX) * CELL_M, z: (gz - HALF_IDX) * CELL_M };
}

function safeWorldToGrid(x, z) {
  if (typeof worldToGrid === 'function' && MD_GRID?.SIZE === 28) {
    return worldToGrid(x, z);
  }
  const gx = Math.max(0, Math.min(GRID_N - 1, Math.floor((x + HALF_M) / CELL_M)));
  const gz = Math.max(0, Math.min(GRID_N - 1, Math.floor((z + HALF_M) / CELL_M)));
  const cx = (gx - HALF_IDX) * CELL_M;
  const cz = (gz - HALF_IDX) * CELL_M;
  return { gx, gz, key: `${gx},${gz}`, cx, cz, x: cx, z: cz };
}

// Determines whether (gx, gz) lies on the physical 2.5D Forest / Cliff Wall ridge
// framing each of the 4 Secluded Forest Coves on the 28x28 grid (leaving the 2-tile Choke Pass open).
function isCoveForestWallBorder(gx, gz) {
  // NW Cove (2..7, 2..7) with choke [8,4],[8,5]; border wall at gx = 8 (gz 1..8) and gz = 8 (gx 1..8)
  if (gx >= 1 && gx <= 8 && gz >= 1 && gz <= 8 && (gx === 8 || gz === 8 || gx === 1 || gz === 1)) {
    if (gx === 8 && (gz === 4 || gz === 5)) return false;
    if (gx >= 2 && gx <= 7 && gz >= 2 && gz <= 7) return false;
    return true;
  }
  // NE Cove (20..25, 2..7) with choke [19,4],[19,5]; border wall at gx = 19 (gz 1..8) and gz = 8 (gx 19..26)
  if (gx >= 19 && gx <= 26 && gz >= 1 && gz <= 8 && (gx === 19 || gz === 8 || gx === 26 || gz === 1)) {
    if (gx === 19 && (gz === 4 || gz === 5)) return false;
    if (gx >= 20 && gx <= 25 && gz >= 2 && gz <= 7) return false;
    return true;
  }
  // SW Cove (2..7, 20..25) with choke [8,22],[8,23]; border wall at gx = 8 (gz 19..26) and gz = 19 (gx 1..8)
  if (gx >= 1 && gx <= 8 && gz >= 19 && gz <= 26 && (gx === 8 || gz === 19 || gx === 1 || gz === 26)) {
    if (gx === 8 && (gz === 22 || gz === 23)) return false;
    if (gx >= 2 && gx <= 7 && gz >= 20 && gz <= 25) return false;
    return true;
  }
  // SE Cove (20..25, 20..25) with choke [19,22],[19,23]; border wall at gx = 19 (gz 19..26) and gz = 19 (gx 19..26)
  if (gx >= 19 && gx <= 26 && gz >= 19 && gz <= 26 && (gx === 19 || gz === 19 || gx === 26 || gz === 26)) {
    if (gx === 19 && (gz === 22 || gz === 23)) return false;
    if (gx >= 20 && gx <= 25 && gz >= 20 && gz <= 25) return false;
    return true;
  }
  return false;
}

function safeGetTileInfo(gx, gz) {
  if (typeof getTileInfo === 'function' && MD_GRID?.SIZE === 28) {
    const info = getTileInfo(gx, gz);
    if (info) return info;
  }
  if (gx < 0 || gx >= GRID_N || gz < 0 || gz >= GRID_N) {
    return { kind: 'void', buildable: false, walkable: false, gx, gz };
  }
  if (gx === 0 || gx === GRID_N - 1 || gz === 0 || gz === GRID_N - 1) {
    const mid0 = (GRID_N >> 1) - 1;
    const mid1 = GRID_N >> 1;
    if (((gx === mid0 || gx === mid1) && (gz === 0 || gz === GRID_N - 1)) ||
        ((gz === mid0 || gz === mid1) && (gx === 0 || gx === GRID_N - 1))) {
      return { kind: 'rift', buildable: false, walkable: true, gx, gz };
    }
    return { kind: 'cliff', buildable: false, walkable: false, gx, gz };
  }
  if (gx >= 12 && gx <= 15 && gz >= 12 && gz <= 15) {
    return { kind: 'shrine', buildable: true, walkable: true, gx, gz };
  }
  const coves = getActiveCovesMap();
  for (const cv of Object.values(coves)) {
    for (const [vx, vz] of cv.veins || []) {
      if (gx === vx && gz === vz) return { kind: 'vein', coveId: cv.id, buildable: true, walkable: true, gx, gz };
    }
    for (const [cx, cz] of cv.choke || []) {
      if (gx === cx && gz === cz) return { kind: 'choke', coveId: cv.id, buildable: true, walkable: true, gx, gz };
    }
    if (gx >= cv.gxRange[0] && gx <= cv.gxRange[1] && gz >= cv.gzRange[0] && gz <= cv.gzRange[1]) {
      return { kind: 'cove', coveId: cv.id, buildable: true, walkable: true, gx, gz };
    }
  }
  if (isCoveForestWallBorder(gx, gz)) {
    return { kind: 'forest_wall', buildable: false, walkable: false, gx, gz };
  }
  return { kind: 'plaza', buildable: false, walkable: true, gx, gz };
}

function safeResolveFusion(elements = []) {
  if (typeof resolveTowerFusion === 'function') return resolveTowerFusion(elements);
  return { name: 'Guardian Spire', icon: '⚡', outfit: 's11_zeus_olympus', tier: 1 };
}

function makeBadgeSprite(text, bgColor = 'rgba(15, 23, 42, 0.88)', borderColor = '#fde047') {
  const c = document.createElement('canvas');
  c.width = 288;
  c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = bgColor;
  g.strokeStyle = borderColor;
  g.lineWidth = 4;
  g.beginPath();
  g.roundRect(8, 8, 272, 48, 22);
  g.fill();
  g.stroke();
  g.font = '800 22px "Trebuchet MS", system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#ffffff';
  g.fillText(text, 144, 33);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  spr.scale.set(1.85, 0.42, 1);
  spr.renderOrder = 15;
  return spr;
}

// ---------------------------------------------------------------------------
// Procedural 256x256 Bioluminescent Giant Mushroom & Ancient Twisted Tree Sprite
// ---------------------------------------------------------------------------
const forestWallTexCache = new Map();
function createForestWallTexture(variant = 0) {
  if (forestWallTexCache.has(variant)) return forestWallTexCache.get(variant);
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d');

  const palettes = [
    { capMain: '#2dd4bf', capDark: '#0f766e', capGlow: '#99f6e4', secMain: '#c084fc', secDark: '#6b21a8', spore: '#5eead4' },
    { capMain: '#38bdf8', capDark: '#0369a1', capGlow: '#bae6fd', secMain: '#f472b6', secDark: '#9d174d', spore: '#f9a8d4' },
    { capMain: '#a855f7', capDark: '#581c87', capGlow: '#e9d5ff', secMain: '#34d399', secDark: '#065f46', spore: '#fde047' },
  ];
  const pal = palettes[variant % palettes.length];

  // 1. Deep mossy ground mound shadow
  const moundGrad = g.createRadialGradient(128, 226, 10, 128, 226, 102);
  moundGrad.addColorStop(0, 'rgba(6, 32, 28, 0.95)');
  moundGrad.addColorStop(0.65, 'rgba(13, 48, 42, 0.85)');
  moundGrad.addColorStop(1, 'rgba(6, 20, 24, 0)');
  g.fillStyle = moundGrad;
  g.beginPath();
  g.ellipse(128, 226, 102, 26, 0, 0, Math.PI * 2);
  g.fill();

  // 2. Ancient twisted dark-bark tree trunk & gnarled roots
  g.fillStyle = '#1e162b';
  g.strokeStyle = '#0f0a17';
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(74, 232);
  g.quadraticCurveTo(96, 175, 92, 92);
  g.quadraticCurveTo(88, 56, 62, 36);
  g.lineTo(94, 32);
  g.quadraticCurveTo(116, 62, 124, 92);
  g.quadraticCurveTo(138, 60, 168, 38);
  g.lineTo(184, 52);
  g.quadraticCurveTo(146, 86, 142, 152);
  g.quadraticCurveTo(144, 198, 172, 232);
  g.closePath();
  g.fill();
  g.stroke();

  // Glowing bark runes / moss veins on trunk
  g.strokeStyle = pal.capGlow;
  g.globalAlpha = 0.45;
  g.lineWidth = 2.5;
  g.beginPath();
  g.moveTo(106, 215);
  g.quadraticCurveTo(114, 160, 108, 104);
  g.moveTo(128, 210);
  g.quadraticCurveTo(126, 165, 136, 118);
  g.stroke();
  g.globalAlpha = 1;

  // 3. Dense dark enchanted canopy foliage clusters behind mushrooms
  const drawCanopy = (cx, cy, rx, ry, col) => {
    const cg = g.createRadialGradient(cx, cy - ry * 0.25, 6, cx, cy, rx);
    cg.addColorStop(0, col);
    cg.addColorStop(0.75, '#0b2228');
    cg.addColorStop(1, 'rgba(7, 18, 24, 0)');
    g.fillStyle = cg;
    g.beginPath();
    g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    g.fill();
  };
  drawCanopy(88, 56, 62, 42, '#134e4a');
  drawCanopy(158, 62, 58, 40, '#1e3a5f');
  drawCanopy(124, 38, 66, 38, '#115e59');

  // 4. Primary Giant Bioluminescent Mushroom
  const stalkGrad = g.createLinearGradient(96, 120, 134, 228);
  stalkGrad.addColorStop(0, '#e2e8f0');
  stalkGrad.addColorStop(0.6, '#94a3b8');
  stalkGrad.addColorStop(1, '#334155');
  g.fillStyle = stalkGrad;
  g.beginPath();
  g.moveTo(102, 124);
  g.quadraticCurveTo(96, 182, 86, 226);
  g.lineTo(132, 228);
  g.quadraticCurveTo(126, 180, 124, 124);
  g.closePath();
  g.fill();

  const auraGrad = g.createRadialGradient(112, 112, 12, 112, 112, 74);
  auraGrad.addColorStop(0, pal.capGlow);
  auraGrad.addColorStop(0.55, pal.capMain);
  auraGrad.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalAlpha = 0.42;
  g.fillStyle = auraGrad;
  g.beginPath();
  g.arc(112, 112, 74, 0, Math.PI * 2);
  g.fill();
  g.globalAlpha = 1;

  const capGrad = g.createRadialGradient(104, 86, 8, 112, 112, 64);
  capGrad.addColorStop(0, pal.capGlow);
  capGrad.addColorStop(0.5, pal.capMain);
  capGrad.addColorStop(1, pal.capDark);
  g.fillStyle = capGrad;
  g.strokeStyle = '#0f172a';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(48, 126);
  g.quadraticCurveTo(54, 62, 112, 60);
  g.quadraticCurveTo(170, 62, 176, 126);
  g.quadraticCurveTo(112, 140, 48, 126);
  g.closePath();
  g.fill();
  g.stroke();

  g.fillStyle = '#ffffff';
  g.globalAlpha = 0.82;
  for (const [sx, sy, sr] of [[86, 94, 8], [114, 80, 10], [140, 98, 7], [72, 112, 5.5], [126, 108, 6.5], [154, 114, 5]]) {
    g.beginPath();
    g.arc(sx, sy, sr, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;

  // 5. Secondary Companion Glowing Mushroom
  g.fillStyle = '#cbd5e1';
  g.beginPath();
  g.moveTo(164, 162);
  g.quadraticCurveTo(162, 198, 152, 228);
  g.lineTo(182, 228);
  g.quadraticCurveTo(182, 196, 180, 162);
  g.closePath();
  g.fill();

  const secGrad = g.createRadialGradient(168, 140, 5, 172, 156, 44);
  secGrad.addColorStop(0, '#ffffff');
  secGrad.addColorStop(0.35, pal.secMain);
  secGrad.addColorStop(1, pal.secDark);
  g.fillStyle = secGrad;
  g.beginPath();
  g.moveTo(132, 168);
  g.quadraticCurveTo(138, 124, 172, 124);
  g.quadraticCurveTo(206, 124, 212, 168);
  g.quadraticCurveTo(172, 178, 132, 168);
  g.closePath();
  g.fill();
  g.stroke();

  g.fillStyle = '#fef08a';
  g.globalAlpha = 0.85;
  for (const [sx, sy, sr] of [[156, 146, 5], [174, 138, 6], [190, 152, 4.5]]) {
    g.beginPath();
    g.arc(sx, sy, sr, 0, Math.PI * 2);
    g.fill();
  }

  // 6. Floating fairy spores
  g.fillStyle = pal.spore;
  for (const [fx, fy, fr] of [[42, 76, 3.5], [64, 42, 3], [148, 44, 4], [198, 92, 3.5], [214, 136, 3], [46, 164, 3.5]]) {
    g.beginPath();
    g.arc(fx, fy, fr, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  forestWallTexCache.set(variant, tex);
  return tex;
}

// ---------------------------------------------------------------------------
// Bespoke Enchanted Forest Building & Environment Textures
// ---------------------------------------------------------------------------
let cachedCampfireTex = null;
function createCampfireTexture() {
  if (cachedCampfireTex) return cachedCampfireTex;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d');

  const aura = g.createRadialGradient(128, 160, 12, 128, 160, 110);
  aura.addColorStop(0, 'rgba(253, 224, 71, 0.85)');
  aura.addColorStop(0.45, 'rgba(249, 115, 22, 0.45)');
  aura.addColorStop(0.8, 'rgba(45, 212, 191, 0.18)');
  aura.addColorStop(1, 'rgba(0, 0, 0, 0)');
  g.fillStyle = aura;
  g.beginPath();
  g.arc(128, 160, 110, 0, Math.PI * 2);
  g.fill();

  for (let i = 0; i < 10; i++) {
    const ang = (i / 10) * Math.PI * 2;
    const sx = 128 + Math.cos(ang) * 58;
    const sy = 196 + Math.sin(ang) * 24;
    g.fillStyle = i % 2 === 0 ? '#334155' : '#475569';
    g.strokeStyle = '#0f172a';
    g.lineWidth = 3;
    g.beginPath();
    g.ellipse(sx, sy, 16, 11, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }

  g.fillStyle = '#451a03';
  g.strokeStyle = '#1c0a00';
  g.lineWidth = 3.5;
  for (const rot of [-0.35, 0.35]) {
    g.save();
    g.translate(128, 194);
    g.rotate(rot);
    g.beginPath();
    g.roundRect(-48, -9, 96, 18, 8);
    g.fill();
    g.stroke();
    g.restore();
  }

  const flameGrad = g.createLinearGradient(128, 72, 128, 196);
  flameGrad.addColorStop(0, '#5eead4');
  flameGrad.addColorStop(0.35, '#fef08a');
  flameGrad.addColorStop(0.75, '#f97316');
  flameGrad.addColorStop(1, '#ea580c');
  g.fillStyle = flameGrad;
  g.beginPath();
  g.moveTo(92, 192);
  g.quadraticCurveTo(84, 138, 114, 96);
  g.quadraticCurveTo(122, 124, 128, 74);
  g.quadraticCurveTo(142, 118, 148, 102);
  g.quadraticCurveTo(172, 142, 164, 192);
  g.closePath();
  g.fill();

  g.fillStyle = '#ffffff';
  g.globalAlpha = 0.88;
  g.beginPath();
  g.moveTo(110, 190);
  g.quadraticCurveTo(112, 148, 128, 118);
  g.quadraticCurveTo(144, 148, 146, 190);
  g.closePath();
  g.fill();
  g.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  cachedCampfireTex = tex;
  return tex;
}

let cachedLanternTex = null;
function createForestLanternTexture() {
  if (cachedLanternTex) return cachedLanternTex;
  const c = document.createElement('canvas');
  c.width = 192;
  c.height = 256;
  const g = c.getContext('2d');

  g.strokeStyle = '#1e162b';
  g.lineWidth = 14;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(96, 236);
  g.quadraticCurveTo(88, 140, 96, 68);
  g.quadraticCurveTo(104, 42, 128, 52);
  g.stroke();

  const glow = g.createRadialGradient(128, 76, 4, 128, 76, 52);
  glow.addColorStop(0, '#ffffff');
  glow.addColorStop(0.35, '#5eead4');
  glow.addColorStop(0.7, 'rgba(45, 212, 191, 0.35)');
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  g.fillStyle = glow;
  g.beginPath();
  g.arc(128, 76, 52, 0, Math.PI * 2);
  g.fill();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  cachedLanternTex = tex;
  return tex;
}

const gateTexCache = new Map();
function createForestGateTexture(level = 1) {
  const tier = Math.min(3, Math.max(1, level));
  if (gateTexCache.has(tier)) return gateTexCache.get(tier);
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d');

  g.fillStyle = 'rgba(6, 24, 24, 0.75)';
  g.beginPath();
  g.ellipse(128, 224, 96, 22, 0, 0, Math.PI * 2);
  g.fill();

  const logPositions = [52, 82, 112, 144, 174, 204];
  for (let i = 0; i < logPositions.length; i++) {
    const lx = logPositions[i];
    const h = i === 0 || i === 5 ? 148 : 132;
    const topY = 224 - h;
    g.fillStyle = i % 2 === 0 ? '#3f271e' : '#2e1c15';
    g.strokeStyle = '#140c08';
    g.lineWidth = 3.5;
    g.beginPath();
    g.moveTo(lx - 13, 224);
    g.lineTo(lx - 13, topY + 22);
    g.lineTo(lx, topY);
    g.lineTo(lx + 13, topY + 22);
    g.lineTo(lx + 13, 224);
    g.closePath();
    g.fill();
    g.stroke();
  }

  const beamColor = tier >= 2 ? '#0f766e' : '#573626';
  g.fillStyle = beamColor;
  g.strokeStyle = '#0f172a';
  g.lineWidth = 3;
  for (const by of [138, 186]) {
    g.beginPath();
    g.roundRect(38, by, 180, 18, 6);
    g.fill();
    g.stroke();
  }

  const crysCol = tier >= 3 ? '#facc15' : tier >= 2 ? '#38bdf8' : '#2dd4bf';
  g.fillStyle = crysCol;
  for (const cx of [78, 128, 178]) {
    g.beginPath();
    g.moveTo(cx, 116);
    g.lineTo(cx + 12, 146);
    g.lineTo(cx, 176);
    g.lineTo(cx - 12, 146);
    g.closePath();
    g.fill();
    g.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  gateTexCache.set(tier, tex);
  return tex;
}

let cachedTotemTex = null;
function createMoonwellTotemTexture() {
  if (cachedTotemTex) return cachedTotemTex;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d');

  g.fillStyle = '#334155';
  g.strokeStyle = '#0f172a';
  g.lineWidth = 4;
  g.beginPath();
  g.ellipse(128, 206, 78, 28, 0, 0, Math.PI * 2);
  g.fill();
  g.stroke();

  const waterGrad = g.createRadialGradient(128, 204, 8, 128, 204, 62);
  waterGrad.addColorStop(0, '#a7f3d0');
  waterGrad.addColorStop(0.55, '#10b981');
  waterGrad.addColorStop(1, '#065f46');
  g.fillStyle = waterGrad;
  g.beginPath();
  g.ellipse(128, 204, 62, 20, 0, 0, Math.PI * 2);
  g.fill();

  g.fillStyle = '#1e293b';
  g.beginPath();
  g.roundRect(108, 108, 40, 96, 12);
  g.fill();
  g.stroke();

  const orbGrad = g.createRadialGradient(128, 78, 4, 128, 78, 42);
  orbGrad.addColorStop(0, '#ffffff');
  orbGrad.addColorStop(0.4, '#34d399');
  orbGrad.addColorStop(0.8, 'rgba(52, 211, 153, 0.25)');
  orbGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  g.fillStyle = orbGrad;
  g.beginPath();
  g.arc(128, 78, 42, 0, Math.PI * 2);
  g.fill();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  cachedTotemTex = tex;
  return tex;
}

let cachedPlinthTex = null;
function createForestPlinthTexture() {
  if (cachedPlinthTex) return cachedPlinthTex;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d');

  g.fillStyle = 'rgba(6, 22, 22, 0.7)';
  g.beginPath();
  g.ellipse(128, 226, 86, 22, 0, 0, Math.PI * 2);
  g.fill();

  g.fillStyle = '#27272a';
  g.strokeStyle = '#09090b';
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(64, 224);
  g.lineTo(78, 148);
  g.lineTo(178, 148);
  g.lineTo(192, 224);
  g.closePath();
  g.fill();
  g.stroke();

  const topGrad = g.createRadialGradient(128, 148, 8, 128, 148, 56);
  topGrad.addColorStop(0, '#14b8a6');
  topGrad.addColorStop(0.55, '#1e293b');
  topGrad.addColorStop(1, '#334155');
  g.fillStyle = topGrad;
  g.beginPath();
  g.ellipse(128, 148, 54, 18, 0, 0, Math.PI * 2);
  g.fill();
  g.stroke();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  cachedPlinthTex = tex;
  return tex;
}

// ---------------------------------------------------------------------------
// 2.5D Monster Rig for Enemy Waves, Wild Forest Creeps & The Hunting Titan
// ---------------------------------------------------------------------------
class MonsterRig {
  constructor(enemy) {
    this.id = enemy.id;
    this.data = enemy;
    this.kind = enemy.kind || enemy.type || 'slime';
    this.isBoss = Boolean(
      enemy.isBoss ||
      enemy.boss ||
      enemy.isTitan ||
      String(this.kind).startsWith('boss') ||
      String(this.kind).startsWith('titan')
    );
    this.baseScale = this.isBoss ? 1.95 : (enemy.scale || 1.0);
    this.x = Number(enemy.x) || 0;
    this.z = Number(enemy.z) || 0;
    this.tx = this.x;
    this.tz = this.z;
    this.phase = Math.random() * Math.PI * 2;

    this.root = new THREE.Group();
    this.root.position.set(this.x, 0, this.z);

    const shGeo = new THREE.PlaneGeometry(1.1 * this.baseScale, 0.65 * this.baseScale).rotateX(-Math.PI / 2);
    const shMat = new THREE.MeshBasicMaterial({ color: 0x090d16, transparent: true, opacity: 0.42, depthWrite: false });
    this.shadow = new THREE.Mesh(shGeo, shMat);
    this.shadow.position.y = 0.025;
    this.root.add(this.shadow);

    if (this.isBoss) {
      const ringGeo = new THREE.RingGeometry(0.95, 1.32, 32).rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0xf43f5e, transparent: true, opacity: 0.72, side: THREE.DoubleSide, depthWrite: false });
      this.bossRing = new THREE.Mesh(ringGeo, ringMat);
      this.bossRing.position.y = 0.035;
      this.root.add(this.bossRing);
    }

    const sprUrl = enemy.sprite || ENEMY_SPRITES[this.kind] || (this.isBoss ? ENEMY_SPRITES.boss_dragon : ENEMY_SPRITES.slime);
    this.mat = new THREE.SpriteMaterial({ map: loadTex(sprUrl), transparent: true, depthWrite: false });
    this.sprite = new THREE.Sprite(this.mat);
    this.sprite.center.set(0.5, 0.06);
    const w = 1.45 * this.baseScale;
    this.sprite.scale.set(w, w, 1);
    this.sprite.renderOrder = 8;
    this.root.add(this.sprite);

    this.hpGroup = new THREE.Group();
    this.hpGroup.position.set(0, 1.45 * this.baseScale + 0.28, 0);
    const bgW = this.isBoss ? 2.15 : 1.05;
    const bgH = this.isBoss ? 0.2 : 0.12;
    this.hpBgWidth = bgW;
    const hpBg = new THREE.Mesh(
      new THREE.PlaneGeometry(bgW, bgH),
      new THREE.MeshBasicMaterial({ color: 0x0f172a, transparent: true, opacity: 0.85, depthWrite: false })
    );
    this.hpFillMat = new THREE.MeshBasicMaterial({ color: this.isBoss ? 0xf43f5e : 0x22c55e, depthWrite: false });
    this.hpFill = new THREE.Mesh(new THREE.PlaneGeometry(bgW - 0.04, bgH - 0.04), this.hpFillMat);
    this.hpFill.position.z = 0.01;
    this.hpGroup.add(hpBg, this.hpFill);
    this.root.add(this.hpGroup);
  }

  sync(e) {
    this.data = e;
    this.tx = Number(e.x) ?? this.tx;
    this.tz = Number(e.z) ?? this.tz;
    const maxHp = Math.max(1, Number(e.maxHp) || 100);
    const hp = Math.max(0, Number(e.hp) ?? maxHp);
    const ratio = Math.max(0.001, Math.min(1, hp / maxHp));
    this.hpFill.scale.x = ratio;
    this.hpFill.position.x = -(1 - ratio) * (this.hpBgWidth - 0.04) * 0.5;
    if (!this.isBoss) {
      this.hpFillMat.color.setHex(ratio > 0.5 ? 0x22c55e : ratio > 0.25 ? 0xfacc15 : 0xef4444);
    }

    this.mat.opacity = e.stealthed ? 0.52 : 1.0;
    if (e.slow > 0 || e.slowed || e.frozen) {
      this.mat.color.setRGB(0.55, 0.88, 1.0);
    } else if (e.poison > 0 || e.poisoned) {
      this.mat.color.setRGB(0.58, 1.0, 0.65);
    } else if (e.curse > 0 || e.cursed || e.burn > 0) {
      this.mat.color.setRGB(1.0, 0.62, 0.95);
    } else {
      this.mat.color.setRGB(1, 1, 1);
    }
  }

  update(dt, camera) {
    this.phase += dt * (this.isBoss ? 4.5 : 7.5);
    const dx = this.tx - this.x;
    const dz = this.tz - this.z;
    const k = Math.min(1, dt * 12);
    this.x += dx * k;
    this.z += dz * k;
    this.root.position.set(this.x, 0, this.z);

    const hop = Math.abs(Math.sin(this.phase)) * (this.isBoss ? 0.12 : 0.16);
    const squash = 1 + Math.sin(this.phase * 2) * 0.05;
    const w = 1.45 * this.baseScale;
    const flip = dx < -0.01 ? -1 : dx > 0.01 ? 1 : (Math.sign(this.sprite.scale.x) || 1);
    this.sprite.position.y = hop;
    this.sprite.scale.set(w * squash * flip, w * (2 - squash), 1);

    if (this.bossRing) this.bossRing.rotation.z += dt * 1.4;
    if (camera) this.hpGroup.quaternion.copy(camera.quaternion);
  }

  dispose() {
    this.shadow.geometry?.dispose?.();
    this.shadow.material?.dispose?.();
    this.mat?.dispose?.();
  }
}

// ---------------------------------------------------------------------------
// Hand-Painted 1024x1024 Dark Enchanted Bioluminescent Forest Floor Texture
// across the Big 56m × 56m (28×28 Grid) Island with 4 Secluded Coves & Center Diamond Quarry!
// ---------------------------------------------------------------------------
let cachedFloorTex = null;
function createArenaFloorTexture() {
  if (cachedFloorTex) return cachedFloorTex;
  const W = 1024;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = W;
  const g = c.getContext('2d');
  const cellPx = W / GRID_N;

  // 1. Deep mossy twilight forest floor radial gradient (#0c1f1e -> #112a28 -> #0a1622)
  const bgGrad = g.createRadialGradient(W / 2, W / 2, 48, W / 2, W / 2, W * 0.72);
  bgGrad.addColorStop(0, '#112a28');
  bgGrad.addColorStop(0.52, '#0c1f1e');
  bgGrad.addColorStop(1, '#0a1622');
  g.fillStyle = bgGrad;
  g.fillRect(0, 0, W, W);

  // 2. Soft organic moss glades, fern shadows & twilight undergrowth patches
  let seed = 1337;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < 180; i++) {
    const mx = rand() * W;
    const my = rand() * W;
    const rx = 22 + rand() * 56;
    const ry = 16 + rand() * 42;
    const rot = rand() * Math.PI;
    const mGrad = g.createRadialGradient(mx, my, 4, mx, my, Math.max(rx, ry));
    const tone = i % 3 === 0
      ? 'rgba(20, 83, 45, 0.25)'
      : i % 3 === 1
        ? 'rgba(17, 94, 89, 0.21)'
        : 'rgba(49, 46, 129, 0.16)';
    mGrad.addColorStop(0, tone);
    mGrad.addColorStop(1, 'rgba(10, 22, 34, 0)');
    g.fillStyle = mGrad;
    g.beginPath();
    g.ellipse(mx, my, rx, ry, rot, 0, Math.PI * 2);
    g.fill();
  }

  // 3. Organic Winding Moss & Dirt Forest Trails across the 28×28 Island
  const drawCurvedTrail = (x0, y0, cx, cy, x1, y1, widthPx) => {
    g.save();
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.strokeStyle = 'rgba(22, 34, 34, 0.82)';
    g.lineWidth = widthPx + 14;
    g.beginPath();
    g.moveTo(x0, y0);
    g.quadraticCurveTo(cx, cy, x1, y1);
    g.stroke();

    g.strokeStyle = 'rgba(38, 49, 52, 0.88)';
    g.lineWidth = widthPx;
    g.beginPath();
    g.moveTo(x0, y0);
    g.quadraticCurveTo(cx, cy, x1, y1);
    g.stroke();

    for (let s = 1; s <= 11; s++) {
      const t = s / 12;
      const omt = 1 - t;
      const sx = omt * omt * x0 + 2 * omt * t * cx + t * t * x1 + (rand() - 0.5) * 9;
      const sy = omt * omt * y0 + 2 * omt * t * cy + t * t * y1 + (rand() - 0.5) * 9;
      g.fillStyle = s % 2 === 0 ? 'rgba(62, 82, 82, 0.44)' : 'rgba(45, 65, 68, 0.38)';
      g.beginPath();
      g.ellipse(sx, sy, 9 + rand() * 5, 6 + rand() * 4, rand() * Math.PI, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  };

  // Winding paths from Center Diamond Quarry (14, 14) to the 4 Cove Choke Passes ([8,4.5], [19,4.5], [8,22.5], [19,22.5])
  drawCurvedTrail(W / 2, W / 2, 11.2 * cellPx, 8.2 * cellPx, 8.5 * cellPx, 5.0 * cellPx, cellPx * 1.25);
  drawCurvedTrail(W / 2, W / 2, 16.8 * cellPx, 8.2 * cellPx, 19.5 * cellPx, 5.0 * cellPx, cellPx * 1.25);
  drawCurvedTrail(W / 2, W / 2, 11.2 * cellPx, 19.8 * cellPx, 8.5 * cellPx, 23.0 * cellPx, cellPx * 1.25);
  drawCurvedTrail(W / 2, W / 2, 16.8 * cellPx, 19.8 * cellPx, 19.5 * cellPx, 23.0 * cellPx, cellPx * 1.25);

  // Winding wilds trails to the 4 outer Forest Rifts / Mining Groves
  drawCurvedTrail(W / 2, W / 2, 13.0 * cellPx, 7.0 * cellPx, W / 2, 24, cellPx * 1.15);
  drawCurvedTrail(W / 2, W / 2, 15.0 * cellPx, 21.0 * cellPx, W / 2, W - 24, cellPx * 1.15);
  drawCurvedTrail(W / 2, W / 2, 7.0 * cellPx, 13.0 * cellPx, 24, W / 2, cellPx * 1.15);
  drawCurvedTrail(W / 2, W / 2, 21.0 * cellPx, 15.0 * cellPx, W - 24, W / 2, cellPx * 1.15);

  // 4. 4 Secluded 28×28 Forest Cove Clearings + Thick Forest Wall Ridges + Choke Thresholds
  const covesMap = getActiveCovesMap();
  const coveThemes = [
    {
      name: 'NW Moonshroud Grove',
      gx0: covesMap.nw?.gxRange?.[0] ?? 2,
      gz0: covesMap.nw?.gzRange?.[0] ?? 2,
      gx1: covesMap.nw?.gxRange?.[1] ?? 7,
      gz1: covesMap.nw?.gzRange?.[1] ?? 7,
      gladeInner: 'rgba(13, 148, 136, 0.32)',
      gladeOuter: 'rgba(56, 189, 248, 0.14)',
      sporeHex: '#5eead4',
      chokeRect: { x: 7.8, z: 4.0, w: 1.5, h: 2.0 },
      veins: covesMap.nw?.veins || [[2, 2], [3, 2], [2, 3]],
    },
    {
      name: 'NE Ambercap Hollow',
      gx0: covesMap.ne?.gxRange?.[0] ?? 20,
      gz0: covesMap.ne?.gzRange?.[0] ?? 2,
      gx1: covesMap.ne?.gxRange?.[1] ?? 25,
      gz1: covesMap.ne?.gzRange?.[1] ?? 7,
      gladeInner: 'rgba(217, 119, 6, 0.30)',
      gladeOuter: 'rgba(251, 191, 36, 0.14)',
      sporeHex: '#fde047',
      chokeRect: { x: 18.7, z: 4.0, w: 1.5, h: 2.0 },
      veins: covesMap.ne?.veins || [[25, 2], [24, 2], [25, 3]],
    },
    {
      name: 'SW Elderwood Den',
      gx0: covesMap.sw?.gxRange?.[0] ?? 2,
      gz0: covesMap.sw?.gzRange?.[0] ?? 20,
      gx1: covesMap.sw?.gxRange?.[1] ?? 7,
      gz1: covesMap.sw?.gzRange?.[1] ?? 25,
      gladeInner: 'rgba(190, 24, 93, 0.28)',
      gladeOuter: 'rgba(244, 114, 182, 0.14)',
      sporeHex: '#f9a8d4',
      chokeRect: { x: 7.8, z: 22.0, w: 1.5, h: 2.0 },
      veins: covesMap.sw?.veins || [[2, 25], [3, 25], [2, 24]],
    },
    {
      name: 'SE Starlight Glade',
      gx0: covesMap.se?.gxRange?.[0] ?? 20,
      gz0: covesMap.se?.gzRange?.[0] ?? 20,
      gx1: covesMap.se?.gxRange?.[1] ?? 25,
      gz1: covesMap.se?.gzRange?.[1] ?? 25,
      gladeInner: 'rgba(5, 150, 105, 0.32)',
      gladeOuter: 'rgba(52, 211, 153, 0.14)',
      sporeHex: '#6ee7b7',
      chokeRect: { x: 18.7, z: 22.0, w: 1.5, h: 2.0 },
      veins: covesMap.se?.veins || [[25, 25], [24, 25], [25, 24]],
    },
  ];

  for (const cv of coveThemes) {
    const x0 = cv.gx0 * cellPx;
    const y0 = cv.gz0 * cellPx;
    const w = (cv.gx1 - cv.gx0 + 1) * cellPx;
    const h = (cv.gz1 - cv.gz0 + 1) * cellPx;
    const cx = x0 + w * 0.5;
    const cy = y0 + h * 0.5;

    const cGrad = g.createRadialGradient(cx, cy, 14, cx, cy, w * 0.68);
    cGrad.addColorStop(0, cv.gladeInner);
    cGrad.addColorStop(0.7, cv.gladeOuter);
    cGrad.addColorStop(1, 'rgba(12, 31, 30, 0)');
    g.fillStyle = cGrad;
    g.beginPath();
    g.roundRect(x0 - 6, y0 - 6, w + 12, h + 12, 28);
    g.fill();

    g.strokeStyle = cv.sporeHex;
    g.globalAlpha = 0.22;
    g.lineWidth = 2.5;
    g.beginPath();
    g.arc(cx, cy, w * 0.36, 0, Math.PI * 2);
    g.stroke();
    g.globalAlpha = 1;

    for (const [vgx, vgz] of cv.veins) {
      const vx = (vgx + 0.5) * cellPx;
      const vy = (vgz + 0.5) * cellPx;
      const vGrad = g.createRadialGradient(vx, vy, 3, vx, vy, cellPx * 0.52);
      vGrad.addColorStop(0, 'rgba(254, 240, 138, 0.78)');
      vGrad.addColorStop(0.55, 'rgba(245, 158, 11, 0.38)');
      vGrad.addColorStop(1, 'rgba(245, 158, 11, 0)');
      g.fillStyle = vGrad;
      g.beginPath();
      g.arc(vx, vy, cellPx * 0.52, 0, Math.PI * 2);
      g.fill();
    }
  }

  // Paint Dark-Green / Indigo Thick Forest Wall Ridge along all forest_wall tiles
  for (let gz = 0; gz < GRID_N; gz++) {
    for (let gx = 0; gx < GRID_N; gx++) {
      const info = safeGetTileInfo(gx, gz);
      if (info.kind !== 'forest_wall' && !isCoveForestWallBorder(gx, gz)) continue;
      const tx = (gx + 0.5) * cellPx;
      const ty = (gz + 0.5) * cellPx;
      const rGrad = g.createRadialGradient(tx, ty, 5, tx, ty, cellPx * 0.8);
      rGrad.addColorStop(0, 'rgba(7, 22, 27, 0.92)');
      rGrad.addColorStop(0.65, 'rgba(13, 42, 40, 0.78)');
      rGrad.addColorStop(1, 'rgba(10, 22, 34, 0)');
      g.fillStyle = rGrad;
      g.beginPath();
      g.arc(tx, ty, cellPx * 0.8, 0, Math.PI * 2);
      g.fill();
    }
  }

  // Paint Wooden/Stone Choke Pass Thresholds at each Cove's 2-tile Entrance
  for (const cv of coveThemes) {
    const ch = cv.chokeRect;
    const rx = ch.x * cellPx;
    const ry = ch.z * cellPx;
    const rw = ch.w * cellPx;
    const rh = ch.h * cellPx;
    g.fillStyle = 'rgba(56, 72, 84, 0.65)';
    g.beginPath();
    g.roundRect(rx + 4, ry + 4, rw - 8, rh - 8, 10);
    g.fill();
    g.fillStyle = 'rgba(120, 83, 48, 0.55)';
    for (let p = 0; p < 4; p++) {
      const py = ry + 10 + p * ((rh - 20) / 3.5);
      g.fillRect(rx + 8, py, rw - 16, 5);
    }
  }

  // 5. Center Precious Diamond Motherlode Quarry & Whispering Campfire Clearing at (0, 0)
  const sGrad = g.createRadialGradient(W / 2, W / 2, 8, W / 2, W / 2, cellPx * 3.1);
  sGrad.addColorStop(0, 'rgba(56, 189, 248, 0.52)');
  sGrad.addColorStop(0.38, 'rgba(45, 212, 191, 0.30)');
  sGrad.addColorStop(0.7, 'rgba(251, 191, 36, 0.18)');
  sGrad.addColorStop(1, 'rgba(12, 31, 30, 0)');
  g.fillStyle = sGrad;
  g.beginPath();
  g.arc(W / 2, W / 2, cellPx * 3.1, 0, Math.PI * 2);
  g.fill();

  // Diamond Quarry crystal rune ring at (0, 0)
  g.strokeStyle = 'rgba(125, 211, 252, 0.45)';
  g.lineWidth = 3;
  g.beginPath();
  g.arc(W / 2, W / 2, cellPx * 1.85, 0, Math.PI * 2);
  g.stroke();

  for (let i = 0; i < 12; i++) {
    const ang = (i / 12) * Math.PI * 2;
    const sx = W / 2 + Math.cos(ang) * cellPx * 1.85;
    const sy = W / 2 + Math.sin(ang) * cellPx * 1.85;
    g.fillStyle = i % 2 === 0 ? 'rgba(56, 189, 248, 0.65)' : 'rgba(148, 163, 184, 0.48)';
    g.beginPath();
    g.arc(sx, sy, 6, 0, Math.PI * 2);
    g.fill();
  }

  // 6. Bioluminescent cyan, violet & emerald spore speckles across the forest floor
  const sporeColors = ['#5eead4', '#38bdf8', '#c084fc', '#f472b6', '#fde047', '#34d399'];
  for (let i = 0; i < 280; i++) {
    const sx = rand() * W;
    const sy = rand() * W;
    const sr = 1.2 + rand() * 2.4;
    g.fillStyle = sporeColors[i % sporeColors.length];
    g.globalAlpha = 0.28 + rand() * 0.45;
    g.beginPath();
    g.arc(sx, sy, sr, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  cachedFloorTex = tex;
  return tex;
}

// ---------------------------------------------------------------------------
// Scoped Mobile-Vertical (Portrait-First) & Desktop HUD Styles
// ---------------------------------------------------------------------------
let stylesInjected = false;
function injectStyles() {
  if (stylesInjected) return;
  stylesInjected = true;
  const st = document.createElement('style');
  st.id = 'moon-defense-clean-styles';
  st.textContent = `
    .phone-shell.md-wide-shell { left: 0 !important; width: 100% !important; transform: none !important; box-shadow: none !important; }
    .md-root { position: fixed; inset: 0; pointer-events: none; z-index: 45; font-family: "Trebuchet MS", system-ui, sans-serif; color: #f8fafc; user-select: none; }
    .md-root[hidden] { display: none !important; }
    .md-top-bar { position: absolute; top: max(6px, env(safe-area-inset-top)); left: 6px; right: 6px; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 5px 6px; padding: 6px 9px; background: rgba(8, 18, 28, 0.90); border: 1.5px solid rgba(94, 234, 212, 0.34); border-radius: 14px; backdrop-filter: blur(8px); pointer-events: auto; box-shadow: 0 6px 20px rgba(0, 0, 0, 0.55); }
    .md-top-group { display: flex; align-items: center; flex-wrap: wrap; gap: 5px; }
    .md-pill { display: inline-flex; align-items: center; gap: 4px; padding: 3.5px 8px; border-radius: 999px; background: rgba(15, 35, 46, 0.94); border: 1px solid rgba(148, 163, 184, 0.28); font-size: 11.5px; font-weight: 800; white-space: nowrap; }
    .md-pill.gold { color: #fde047; border-color: rgba(250, 204, 21, 0.45); }
    .md-pill.diamond { color: #7dd3fc; border-color: rgba(56, 189, 248, 0.48); background: rgba(12, 34, 54, 0.94); }
    .md-pill.wave { color: #5eead4; border-color: rgba(45, 212, 191, 0.45); }
    .md-pill.titan { color: #fecdd3; border-color: rgba(244, 63, 94, 0.55); background: rgba(68, 14, 28, 0.9); }
    .md-bar-wrap { display: inline-flex; align-items: center; gap: 5px; padding: 3px 7px; border-radius: 999px; background: rgba(15, 23, 42, 0.92); border: 1px solid rgba(148, 163, 184, 0.3); font-size: 11px; font-weight: 800; }
    .md-bar-track { width: 52px; height: 7px; background: rgba(51, 65, 85, 0.85); border-radius: 99px; overflow: hidden; }
    .md-bar-fill { height: 100%; border-radius: 99px; transition: width 0.2s ease; }
    .md-bar-fill.shrine { background: linear-gradient(90deg, #2dd4bf, #38bdf8); }
    .md-bar-fill.xp { background: linear-gradient(90deg, #34d399, #10b981); }
    .md-btn { display: inline-flex; align-items: center; justify-content: center; gap: 3px; padding: 4.5px 8px; border-radius: 10px; border: 1px solid rgba(255, 255, 255, 0.22); background: rgba(30, 41, 59, 0.92); color: #f8fafc; font-size: 11px; font-weight: 800; cursor: pointer; transition: transform 0.1s, background 0.15s; white-space: nowrap; }
    .md-btn:active { transform: scale(0.95); }
    .md-btn.start-wave { background: linear-gradient(135deg, #059669, #10b981); border-color: #6ee7b7; color: #fff; box-shadow: 0 0 12px rgba(16, 185, 129, 0.45); }
    .md-btn.cove-jump { padding: 4.5px 8px; font-size: 10.5px; border-radius: 999px; background: rgba(15, 35, 46, 0.92); border-color: rgba(94, 234, 212, 0.35); }
    .md-btn.cashout { background: linear-gradient(135deg, #d97706, #f59e0b); border-color: #fde68a; }
    .md-btn.exit { background: rgba(185, 28, 28, 0.85); border-color: #fca5a5; }
    .md-minimap-wrap { position: absolute; right: 8px; top: calc(88px + env(safe-area-inset-top)); display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 4px; background: rgba(8, 18, 28, 0.92); border: 1.5px solid rgba(56, 189, 248, 0.45); border-radius: 12px; pointer-events: auto; box-shadow: 0 6px 18px rgba(0, 0, 0, 0.55); z-index: 48; }
    .md-minimap { width: 84px; height: 84px; border-radius: 8px; cursor: pointer; display: block; background: #071318; }
    .md-minimap-lbl { font-size: 9px; font-weight: 800; color: #94a3b8; letter-spacing: 0.03em; }
    .md-prowl-banner { position: absolute; left: 50%; top: calc(88px + env(safe-area-inset-top)); transform: translateX(-50%); padding: 5px 14px; border-radius: 999px; background: rgba(127, 29, 29, 0.92); border: 1.5px solid #fda4af; color: #ffe4e6; font-size: 11.5px; font-weight: 900; letter-spacing: 0.03em; white-space: nowrap; pointer-events: none; box-shadow: 0 0 18px rgba(244, 63, 94, 0.65); animation: mdProwlPulse 1.1s ease-in-out infinite alternate; z-index: 49; }
    .md-prowl-banner[hidden] { display: none !important; }
    @keyframes mdProwlPulse { from { transform: translateX(-50%) scale(0.97); opacity: 0.86; } to { transform: translateX(-50%) scale(1.03); opacity: 1; } }
    .md-inspector { position: absolute; left: 50%; bottom: calc(86px + env(safe-area-inset-bottom)); transform: translateX(-50%); width: min(430px, 94vw); background: rgba(10, 22, 34, 0.95); border: 2px solid #fbbf24; border-radius: 16px; padding: 10px 12px; pointer-events: auto; box-shadow: 0 10px 28px rgba(0, 0, 0, 0.65); backdrop-filter: blur(10px); z-index: 52; }
    .md-inspector[hidden] { display: none !important; }
    .md-insp-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px; }
    .md-insp-title { font-size: 14px; font-weight: 900; color: #fef08a; display: flex; align-items: center; gap: 6px; }
    .md-insp-stats { font-size: 11px; color: #cbd5e1; margin-bottom: 8px; display: flex; flex-wrap: wrap; gap: 10px; }
    .md-insp-actions { display: flex; flex-wrap: wrap; gap: 6px; }
    .md-fuse-row { margin-top: 8px; padding-top: 7px; border-top: 1px solid rgba(148, 163, 184, 0.25); }
    .md-fuse-label { font-size: 11px; font-weight: 800; color: #bae6fd; margin-bottom: 5px; }
    .md-fuse-btns { display: flex; flex-wrap: wrap; gap: 5px; }
    .md-fuse-btn { flex: 1 1 auto; min-width: 60px; padding: 5px 6px; border-radius: 9px; border: 1px solid rgba(125, 211, 252, 0.4); background: rgba(30, 41, 59, 0.95); color: #f8fafc; font-size: 10.5px; font-weight: 800; cursor: pointer; text-align: center; }
    .md-fuse-btn small { display: block; font-size: 9px; color: #fde047; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 96px; margin: 1px auto 0; }
    .md-mode-bar { position: absolute; left: 50%; bottom: max(8px, env(safe-area-inset-bottom)); transform: translateX(-50%); display: flex; align-items: center; flex-wrap: nowrap; overflow-x: auto; justify-content: flex-start; gap: 5px; padding: 6px 9px; max-width: 96vw; background: rgba(10, 22, 34, 0.90); border: 1.5px solid rgba(52, 211, 153, 0.42); border-radius: 999px; backdrop-filter: blur(8px); pointer-events: auto; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.55); scrollbar-width: none; }
    .md-mode-bar::-webkit-scrollbar { display: none; }
    .md-mode-bar[hidden] { display: none !important; }
    .md-toggle-build-btn { flex: 0 0 auto; display: inline-flex; align-items: center; gap: 5px; padding: 7px 12px; border-radius: 999px; border: 2px solid #fde047; background: linear-gradient(135deg, #059669, #10b981, #0d9488); color: #ffffff; font-size: 11.5px; font-weight: 900; cursor: pointer; box-shadow: 0 0 14px rgba(16, 185, 129, 0.55); white-space: nowrap; }
    .md-toggle-build-btn:active { transform: scale(0.96); }
    .md-build-banner { position: absolute; left: 50%; bottom: calc(76px + env(safe-area-inset-bottom)); transform: translateX(-50%); padding: 4.5px 12px; border-radius: 999px; background: rgba(6, 78, 59, 0.92); border: 1.5px solid #6ee7b7; color: #ecfdf5; font-size: 11px; font-weight: 800; white-space: nowrap; max-width: 94vw; overflow: hidden; text-overflow: ellipsis; pointer-events: none; box-shadow: 0 4px 14px rgba(0, 0, 0, 0.45); }
    .md-build-banner[hidden] { display: none !important; }
    .md-build-dock { position: absolute; left: 50%; bottom: max(8px, env(safe-area-inset-bottom)); transform: translateX(-50%); display: flex; align-items: center; gap: 5px; padding: 6px 8px; max-width: 96vw; overflow-x: auto; background: rgba(10, 22, 34, 0.94); border: 2px solid #34d399; border-radius: 16px; backdrop-filter: blur(8px); pointer-events: auto; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6); scrollbar-width: none; }
    .md-build-dock[hidden] { display: none !important; }
    .md-build-dock::-webkit-scrollbar { display: none; }
    .md-dock-btn { flex: 0 0 auto; display: flex; flex-direction: column; align-items: center; justify-content: center; min-width: 56px; padding: 5px 6px; border-radius: 12px; border: 1.5px solid rgba(148, 163, 184, 0.25); background: rgba(30, 41, 59, 0.92); color: #f8fafc; cursor: pointer; transition: transform 0.1s, border-color 0.15s, background 0.15s; }
    .md-dock-btn.active { border-color: #fde047; background: rgba(6, 78, 59, 0.92); box-shadow: 0 0 12px rgba(52, 211, 153, 0.55); transform: translateY(-2px); }
    .md-dock-btn.done-build { border-color: #6ee7b7; background: linear-gradient(135deg, #059669, #10b981); color: #ffffff; min-width: 68px; }
    .md-dock-btn .ico { font-size: 16px; line-height: 1.1; }
    .md-dock-btn .lbl { font-size: 9.5px; font-weight: 800; margin-top: 2px; white-space: nowrap; }
    .md-dock-btn .cst { font-size: 9px; font-weight: 800; color: #fde047; }
    .md-joystick { position: absolute; left: 12px; bottom: calc(74px + env(safe-area-inset-bottom)); width: 88px; height: 88px; border-radius: 50%; background: rgba(15, 23, 42, 0.52); border: 2px solid rgba(148, 163, 184, 0.35); pointer-events: auto; touch-action: none; display: flex; align-items: center; justify-content: center; }
    .md-joy-stick { width: 38px; height: 38px; border-radius: 50%; background: radial-gradient(circle at 35% 35%, #f8fafc, #94a3b8); box-shadow: 0 4px 10px rgba(0, 0, 0, 0.45); pointer-events: none; }
    .md-action-cluster { position: absolute; right: 12px; bottom: calc(74px + env(safe-area-inset-bottom)); display: flex; flex-direction: column; align-items: flex-end; gap: 7px; pointer-events: auto; }
    .md-act-btn { padding: 9px 13px; border-radius: 999px; font-size: 11.5px; font-weight: 900; color: #fff; cursor: pointer; border: 2px solid rgba(255, 255, 255, 0.45); box-shadow: 0 6px 16px rgba(0, 0, 0, 0.5); transition: transform 0.1s; white-space: nowrap; }
    .md-act-btn:active { transform: scale(0.94); }
    .md-act-btn.attack { padding: 11px 15px; font-size: 12.5px; border-color: #fde047; background: linear-gradient(135deg, #e11d48, #f97316, #eab308); box-shadow: 0 0 18px rgba(249, 115, 22, 0.55); }
    .md-act-btn.dash { background: linear-gradient(135deg, #0284c7, #38bdf8); }
    .md-act-btn.ult { background: linear-gradient(135deg, #7c3aed, #ec4899, #f59e0b); }
    .md-act-btn.ult:disabled { opacity: 0.55; filter: grayscale(0.4); cursor: default; }
    .md-result-modal { position: absolute; inset: 0; background: rgba(9, 13, 22, 0.76); backdrop-filter: blur(6px); display: flex; align-items: center; justify-content: center; padding: 16px; pointer-events: auto; z-index: 60; }
    .md-skill-modal { position: absolute; left: 8px; right: 102px; top: calc(126px + env(safe-area-inset-top)); pointer-events: auto; z-index: 55; }
    .md-skill-modal[hidden], .md-result-modal[hidden] { display: none !important; }
    .md-modal-card { width: min(520px, 95vw); background: linear-gradient(180deg, #1e293b, #0f172a); border: 2px solid #fbbf24; border-radius: 20px; padding: 18px; box-shadow: 0 18px 48px rgba(0, 0, 0, 0.75); text-align: center; }
    .md-modal-title { font-size: 18px; font-weight: 900; color: #fef08a; margin-bottom: 12px; }
    .md-skill-strip { background: rgba(15, 23, 42, 0.88); border: 1.5px solid #fbbf24; border-radius: 12px; padding: 6px 8px; box-shadow: 0 8px 20px rgba(0, 0, 0, 0.55); max-width: 360px; }
    .md-skill-strip-hdr { font-size: 10.5px; font-weight: 900; color: #fde047; margin-bottom: 5px; display: flex; align-items: center; justify-content: space-between; }
    .md-skill-grid { display: flex; gap: 5px; }
    .md-skill-choice { flex: 1; padding: 5px 6px; border-radius: 9px; background: rgba(30, 41, 59, 0.95); border: 1.2px solid rgba(125, 211, 252, 0.45); color: #f8fafc; cursor: pointer; display: flex; align-items: center; gap: 5px; text-align: left; transition: transform 0.12s, border-color 0.15s; }
    .md-skill-choice:hover { transform: translateY(-2px); border-color: #fde047; }
    @media (max-width: 520px) {
      .md-top-bar { padding: 5px 7px; gap: 4px; }
      .md-pill { font-size: 10.5px; padding: 3px 6px; }
      .md-btn { font-size: 10px; padding: 4px 6.5px; }
      .md-minimap-wrap { top: calc(96px + env(safe-area-inset-top)); right: 6px; padding: 3px; }
      .md-prowl-banner { top: calc(98px + env(safe-area-inset-top)); left: 8px; transform: none; font-size: 10px; padding: 4px 9px; max-width: calc(100vw - 112px); overflow: hidden; text-overflow: ellipsis; }
    }
  `;
  document.head.appendChild(st);
}

// ===========================================================================
// MoonDefenseUI Main Controller
// ===========================================================================
export class MoonDefenseUI {
  constructor({ net, world, getProfile, toast, onExit } = {}) {
    this.net = net;
    this.world = world;
    this.getProfile = getProfile || (() => null);
    this.toast = toast || (() => {});
    this.onExit = onExit || (() => {});

    this.halfSize = 28.0; // Allows tapping anywhere on the 56m × 56m island in world.raycastGround!
    this.active = false;
    this.tableId = null;
    this.table = null;
    this.state = null;

    this.buildModeOpen = false;
    this.selectedTool = null;
    this.selectedBuildingKey = null;
    this.hoverTile = null;
    this.cameraMode = 'follow';
    this.speedMult = 1;
    this.elapsed = 0;
    this._moveSendTimer = 0;
    this._autoMineTimer = 0;
    this._fogUpdateTimer = 0;
    this._spawnedLocalInCove = false;

    // Real 3D Fog of War state (256×256 persistent explored buffer + canvas texture)
    this.fogExplored = new Uint8Array(256 * 256);
    this.fogCanvas = null;
    this.fogCtx = null;
    this.fogImageData = null;
    this.fogTex = null;
    this.fogMesh = null;

    this.buildingMeshes = new Map();
    this.allyRigs = new Map();
    this.enemyRigs = new Map();
    this.chestMeshes = new Map();
    this.gemMeshes = new Map();
    this.projectiles = [];

    injectStyles();
    this.buildDom();
  }

  resetFogOfWar() {
    if (this.fogExplored) this.fogExplored.fill(0);
    this.updateFogOfWar(true);
  }

  open(table) {
    const wasActive = this.active;
    const prevTableId = this.tableId;
    this.active = true;
    this.table = table || this.table;
    this.tableId = table?.id || this.tableId;
    if (this.tableId && this._closedTableId === this.tableId) {
      this._closedTableId = null;
    }
    this.buildModeOpen = false;
    this.selectedTool = null;
    this.selectedBuildingKey = null;
    if (!wasActive || (this.tableId && this.tableId !== prevTableId)) {
      this._spawnedLocalInCove = false;
      if (this.fogExplored) this.fogExplored.fill(0);
    }

    const hud = document.getElementById('hud');
    if (hud) hud.hidden = true;
    document.getElementById('app')?.classList.add('md-wide-shell');
    this.root.hidden = false;

    if (this.world) {
      if (!wasActive) {
        this._prevTownhallMode = Boolean(this.world._townhallMode);
        this._savedCamDist = this.world.camDist;
        if (this.world.local) {
          this._savedLocalPos = { x: this.world.local.x, z: this.world.local.z };
        }
      }
      this.world.resize?.();
      this.world._townhallMode = true;
      if (this.world.plaza?.root) this.world.plaza.root.visible = false;
      if (this.world.townHallScene) {
        this.world.townHallScene.setSiegeMode(false);
        this.world.townHallScene.setActive(false);
      }
      if (this.world.env?.clouds) {
        for (const c of this.world.env.clouds) c.visible = false;
      }
      this.ensureStageGroup();
      this.stageGroup.visible = true;
      if (!this.stageGroup.parent) {
        this.world.scene.add(this.stageGroup);
      }
      this.cameraMode = 'follow';
      this.world.camDist = 24;
      this.world.followDetached = false;
    }

    if (!wasActive && this.tableId) {
      this.send({ type: 'mb_join', tableId: this.tableId });
    }
    this.syncGridHighlight();
    this.syncChestsAndNodes3D();
    this.updateFogOfWar(true);
    this.renderBuildDock();
    this.renderHud();
  }

  close() {
    if (!this.active && this.root?.hidden) return;
    if (this.tableId) this._closedTableId = this.tableId;
    this.active = false;
    this.tableId = null;
    this.state = null;
    this.buildModeOpen = false;
    this.selectedTool = null;
    this.selectedBuildingKey = null;
    this.root.hidden = true;

    if (this.world) {
      this.world.input.joy = null;
      this.world.input.tapTarget = null;
      this.world.input.path = null;
      this.world.followDetached = false;
      if (this.stageGroup?.parent) {
        this.world.scene.remove(this.stageGroup);
      }
      this.clearDynamic3D();
      this.world._townhallMode = Boolean(this._prevTownhallMode);
      if (this._savedCamDist) {
        this.world.camDist = this._savedCamDist;
      }
      if (this.world.townHallScene) {
        this.world.townHallScene.setSiegeMode(false);
        this.world.townHallScene.setActive(Boolean(this._prevTownhallMode));
      }
      if (this.world.plaza?.root) {
        this.world.plaza.root.visible = !this._prevTownhallMode;
      }
      if (this.world.env?.clouds) {
        for (const c of this.world.env.clouds) c.visible = !this._prevTownhallMode;
      }
      if (this._savedLocalPos && this.world.local) {
        this.world.setLocalPosition(this._savedLocalPos.x, this._savedLocalPos.z);
        this.world.camTarget.set(this._savedLocalPos.x, 0, this._savedLocalPos.z);
      }
      this._savedLocalPos = null;
    }

    const hud = document.getElementById('hud');
    if (hud) hud.hidden = false;
    document.getElementById('app')?.classList.remove('md-wide-shell');
    this.world?.resize?.();
    this.onExit?.();
  }

  handle(msg) {
    if (!msg || typeof msg.type !== 'string') return false;
    if (msg.type === 'mb_state') {
      if (msg.tableId && this._closedTableId && msg.tableId === this._closedTableId) return true;
      if (this.tableId && msg.tableId && msg.tableId !== this.tableId) return false;
      this.tableId = msg.tableId || this.tableId;
      this.state = msg.state || msg.moonDefense || msg;
      if (!this.active) {
        this.open({ id: this.tableId });
      }
      this.syncFromState();
      return true;
    }
    if (msg.type === 'mb_toast' && (!this.tableId || msg.tableId === this.tableId)) {
      if (msg.text) this.toast(msg.text);
      return true;
    }
    return false;
  }

  send(payload) {
    if (!this.net?.send) return;
    this.net.send({ tableId: this.tableId, ...payload });
  }

  // Physical Forest Wall & Cliff Walkability on the 56m × 56m (28×28 Grid) Island
  isWalkable(x, z) {
    if (Math.abs(x) > WALK_LIMIT || Math.abs(z) > WALK_LIMIT) return false;
    const { gx, gz } = safeWorldToGrid(x, z);
    const info = safeGetTileInfo(gx, gz);
    if (info.kind === 'forest_wall' || info.kind === 'cliff' || info.kind === 'void') return false;
    return true;
  }

  clampWalkable(x, z) {
    const cx = Math.max(-WALK_LIMIT, Math.min(WALK_LIMIT, x));
    const cz = Math.max(-WALK_LIMIT, Math.min(WALK_LIMIT, z));
    if (this.isWalkable(cx, cz)) {
      return { x: cx, z: cz };
    }
    const { gx, gz } = safeWorldToGrid(cx, cz);
    let best = { x: 0, z: 0 };
    let bestDist = Infinity;
    for (let r = 1; r <= 5; r++) {
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          const ngx = gx + dx;
          const ngz = gz + dz;
          if (ngx < 1 || ngx >= GRID_N - 1 || ngz < 1 || ngz >= GRID_N - 1) continue;
          const nInfo = safeGetTileInfo(ngx, ngz);
          if (nInfo.kind === 'forest_wall' || nInfo.kind === 'cliff' || nInfo.kind === 'void') continue;
          const wp = safeGridToWorld(ngx, ngz);
          const d = Math.hypot(wp.x - cx, wp.z - cz);
          if (d < bestDist) {
            bestDist = d;
            best = wp;
          }
        }
      }
      if (bestDist < Infinity) break;
    }
    return best;
  }

  // -------------------------------------------------------------------------
  // Real 3D Fog of War & Allied Vision System
  // -------------------------------------------------------------------------
  getVisionSources() {
    const sources = [];
    const L = this.world?.local;
    const me = this.getMyPlayer();
    if (L && Number.isFinite(L.x) && Number.isFinite(L.z)) {
      sources.push({ x: L.x, z: L.z, radius: 11.5, kind: 'hero', isWard: false });
    } else if (me && Number.isFinite(me.x) && Number.isFinite(me.z)) {
      sources.push({ x: Number(me.x), z: Number(me.z), radius: 11.5, kind: 'hero', isWard: false });
    }

    // Co-Op Ally Heroes
    const myId = this.getProfile()?.id;
    for (const ally of this.allyRigs.values()) {
      if (Number.isFinite(ally.x) && Number.isFinite(ally.z)) {
        sources.push({ x: ally.x, z: ally.z, radius: 11.0, kind: 'ally', isWard: false });
      }
    }
    if (Array.isArray(this.state?.players)) {
      for (const p of this.state.players) {
        if (!p || !p.active || p.id === myId || p.userId === myId) continue;
        if (Number.isFinite(p.x) && Number.isFinite(p.z)) {
          sources.push({ x: Number(p.x), z: Number(p.z), radius: 11.0, kind: 'ally', isWard: false });
        }
      }
    }

    // Placed Buildings & Vision Wards
    const bMap = this.getBuildingsMap();
    for (const [key, b] of bMap.entries()) {
      if (!b || (Number.isFinite(b.hp) && b.hp <= 0)) continue;
      let bx = Number(b.x);
      let bz = Number(b.z);
      if (!Number.isFinite(bx) || !Number.isFinite(bz)) {
        const [gx, gz] = key.split(',').map(Number);
        const wp = safeGridToWorld(gx, gz);
        bx = wp.x;
        bz = wp.z;
      }
      const rawKind = String(b.kind || b.buildingId || b.type || 'wall');
      const isWard = rawKind === 'ward' || b.buildingId === 'ward';
      sources.push({
        x: bx,
        z: bz,
        radius: isWard ? 16.5 : 8.5,
        kind: isWard ? 'ward' : rawKind,
        isWard,
      });
    }

    return sources;
  }

  isPointVisible(x, z, opts = {}) {
    const stealthed = Boolean(opts?.stealthed);
    const sources = opts?.sources || this.getVisionSources();
    for (let i = 0; i < sources.length; i++) {
      const s = sources[i];
      const d = Math.hypot(x - s.x, z - s.z);
      if (stealthed) {
        const detectR = s.isWard ? s.radius : 5.5;
        if (d <= detectR) return true;
      } else if (d <= s.radius) {
        return true;
      }
    }
    return false;
  }

  updateFogOfWar(force = false) {
    if (!this.fogCanvas || !this.fogCtx || !this.fogImageData) return;
    const N = 256;
    const span = HALF_M * 2; // 56m
    const sources = this.getVisionSources();

    // 1. Mark newly explored cells in persistent this.fogExplored (Uint8Array 256x256)
    for (let i = 0; i < sources.length; i++) {
      const s = sources[i];
      const fx = ((s.x + HALF_M) / span) * N;
      const fz = ((s.z + HALF_M) / span) * N;
      const fr = (s.radius / span) * N;
      const frSq = fr * fr;
      const minX = Math.max(0, Math.floor(fx - fr));
      const maxX = Math.min(N - 1, Math.ceil(fx + fr));
      const minZ = Math.max(0, Math.floor(fz - fr));
      const maxZ = Math.min(N - 1, Math.ceil(fz + fr));
      for (let pz = minZ; pz <= maxZ; pz++) {
        const dz = pz - fz;
        const rowOffset = pz * N;
        for (let px = minX; px <= maxX; px++) {
          const dx = px - fx;
          if (dx * dx + dz * dz <= frSq) {
            this.fogExplored[rowOffset + px] = 1;
          }
        }
      }
    }

    // 2. Write base Unexplored (alpha ~ 0.90) vs Explored (alpha ~ 0.52) into ImageData
    const data = this.fogImageData.data;
    const exp = this.fogExplored;
    for (let i = 0; i < N * N; i++) {
      const idx = i << 2;
      if (exp[i]) {
        data[idx] = 7;
        data[idx + 1] = 16;
        data[idx + 2] = 24;
        data[idx + 3] = 133; // ~0.52 alpha
      } else {
        data[idx] = 4;
        data[idx + 1] = 10;
        data[idx + 2] = 16;
        data[idx + 3] = 230; // ~0.90 alpha
      }
    }
    this.fogCtx.putImageData(this.fogImageData, 0, 0);

    // 3. Carve 100% clear (alpha = 0.0) Allied Vision Circles with soft radial gradient edges
    this.fogCtx.save();
    this.fogCtx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < sources.length; i++) {
      const s = sources[i];
      const fx = ((s.x + HALF_M) / span) * N;
      const fz = ((s.z + HALF_M) / span) * N;
      const fr = (s.radius / span) * N;
      const grad = this.fogCtx.createRadialGradient(fx, fz, fr * 0.52, fx, fz, fr);
      grad.addColorStop(0, 'rgba(0, 0, 0, 1)');
      grad.addColorStop(0.75, 'rgba(0, 0, 0, 0.88)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      this.fogCtx.fillStyle = grad;
      this.fogCtx.beginPath();
      this.fogCtx.arc(fx, fz, fr, 0, Math.PI * 2);
      this.fogCtx.fill();
    }
    this.fogCtx.restore();

    if (this.fogTex) {
      this.fogTex.needsUpdate = true;
    }

    // 4. Update Live Fog-of-War Mini-Map Radar
    this.renderMinimap(sources);
    void force;
  }

  renderMinimap(sourcesInput) {
    const canvas = this.minimapCanvas;
    if (!canvas) return;
    const g = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    const span = HALF_M * 2; // 56m
    const toPx = (wx, wz) => ({
      x: ((wx + HALF_M) / span) * W,
      y: ((wz + HALF_M) / span) * H,
    });

    // 1. Base Island Forest Background
    g.fillStyle = '#0c2220';
    g.fillRect(0, 0, W, H);

    // 2. 4 Corner Coves
    const coves = getActiveCovesMap();
    for (const cv of Object.values(coves)) {
      const x0 = (cv.gxRange[0] / GRID_N) * W;
      const y0 = (cv.gzRange[0] / GRID_N) * H;
      const cw = ((cv.gxRange[1] - cv.gxRange[0] + 1) / GRID_N) * W;
      const ch = ((cv.gzRange[1] - cv.gzRange[0] + 1) / GRID_N) * H;
      g.fillStyle = 'rgba(45, 212, 191, 0.25)';
      g.strokeStyle = cv.color || '#5eead4';
      g.lineWidth = 1;
      g.fillRect(x0, y0, cw, ch);
      g.strokeRect(x0, y0, cw, ch);
    }

    // 3. Center Precious Diamond Quarry at (0, 0)
    const centerPt = toPx(0, 0);
    g.fillStyle = '#38bdf8';
    g.beginPath();
    g.moveTo(centerPt.x, centerPt.y - 4.5);
    g.lineTo(centerPt.x + 4.5, centerPt.y);
    g.lineTo(centerPt.x, centerPt.y + 4.5);
    g.lineTo(centerPt.x - 4.5, centerPt.y);
    g.closePath();
    g.fill();

    // 4. Overlay Live Fog-of-War Canvas
    if (this.fogCanvas) {
      g.drawImage(this.fogCanvas, 0, 0, W, H);
    }

    // 5. Placed Buildings & Vision Wards (teal/cyan dots)
    const bMap = this.getBuildingsMap();
    for (const [key, b] of bMap.entries()) {
      if (!b || (Number.isFinite(b.hp) && b.hp <= 0)) continue;
      const [gx, gz] = key.split(',').map(Number);
      const wp = safeGridToWorld(gx, gz);
      const pt = toPx(wp.x, wp.z);
      const isWard = b.kind === 'ward' || b.buildingId === 'ward';
      g.fillStyle = isWard ? '#38bdf8' : '#2dd4bf';
      g.beginPath();
      g.arc(pt.x, pt.y, isWard ? 2.4 : 1.8, 0, Math.PI * 2);
      g.fill();
    }

    // 6. Co-Op Allies (green dots) & Local Hero (gold/white dot)
    for (const ally of this.allyRigs.values()) {
      const pt = toPx(ally.x, ally.z);
      g.fillStyle = '#4ade80';
      g.beginPath();
      g.arc(pt.x, pt.y, 2.6, 0, Math.PI * 2);
      g.fill();
    }
    const L = this.world?.local;
    if (L) {
      const pt = toPx(L.x, L.z);
      g.fillStyle = '#fde047';
      g.strokeStyle = '#ffffff';
      g.lineWidth = 1;
      g.beginPath();
      g.arc(pt.x, pt.y, 3.0, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }

    // 7. Hunting Titan (pulsing red dot ONLY when inside allied vision!)
    const sources = sourcesInput || this.getVisionSources();
    const titan = this.getActiveTitan();
    if (titan && this.isPointVisible(titan.x, titan.z, { stealthed: Boolean(titan.stealthed), sources })) {
      const pt = toPx(titan.x, titan.z);
      const pulseR = 3.6 + Math.sin(this.elapsed * 7) * 0.9;
      g.fillStyle = '#f43f5e';
      g.strokeStyle = '#ffe4e6';
      g.lineWidth = 1.2;
      g.beginPath();
      g.arc(pt.x, pt.y, pulseR, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }
  }

  getActiveTitan() {
    const stTitan = this.state?.titan;
    if (stTitan && (stTitan.hp === undefined || stTitan.hp > 0)) {
      const rig = stTitan.id ? this.enemyRigs.get(String(stTitan.id)) : null;
      return {
        ...stTitan,
        x: Number(rig?.x ?? stTitan.x ?? 0),
        z: Number(rig?.z ?? stTitan.z ?? 0),
        hp: Number(stTitan.hp ?? 1000),
        maxHp: Number(stTitan.maxHp ?? 1000),
        level: Number(stTitan.level || this.state?.titanLevel || this.state?.wave || 1),
        stealthed: Boolean(stTitan.stealthed),
      };
    }
    for (const m of this.enemyRigs.values()) {
      if (m.isBoss) {
        const d = m.data || {};
        return {
          ...d,
          id: m.id,
          x: m.x,
          z: m.z,
          hp: Number(d.hp ?? 1000),
          maxHp: Number(d.maxHp ?? 1000),
          level: Number(d.level || this.state?.titanLevel || this.state?.wave || 1),
          stealthed: Boolean(d.stealthed),
        };
      }
    }
    return null;
  }

  toggleBuildMode(forceState) {
    const next = typeof forceState === 'boolean' ? forceState : !this.buildModeOpen;
    this.buildModeOpen = next;
    if (this.buildModeOpen) {
      if (!this.selectedTool) {
        this.selectedTool = 'wall';
      }
      this.selectedBuildingKey = null;
      this.toast('🔨 Tap any glowing Cove tile to place! (👁️ Wards can be planted along forest trails!)');
    } else {
      this.selectedTool = null;
    }
    this.syncGridHighlight();
    this.updateCursorAndRange();
    this.renderBuildDock();
    this.renderInspector();
    this.renderModals();
  }

  triggerHeroSlashAndMine(preferredTarget = null) {
    const L = this.world?.local;
    L?.rig?.triggerAttack?.('slash', { dur: 0.36 });
    const f = L?.rig?.facing;
    const dirX = f ? (f.right ? 1 : -1) : 1;
    const dirZ = f ? (f.back ? -1 : 1) : 1;

    if (L && this.world) {
      const fxX = L.x + dirX * 0.95;
      const fxZ = L.z + dirZ * 0.95;
      this.world.fx?.emit?.('fx_shockwave', fxX, 0.32, fxZ, 6, {
        ring: true, speed: 1.4, up: 0.4, size: 0.28, life: 0.38,
      });
      this.world.fx?.emit?.('fx_star', fxX, 0.45, fxZ, 8, {
        speed: 1.5, up: 1.1, size: 0.24, life: 0.48,
      });
    }

    let targetNode = preferredTarget?.isNode ? preferredTarget : null;
    let targetEnemy = preferredTarget?.isEnemy ? preferredTarget : null;

    if (L && !targetNode) {
      let bestNodeD = 3.6;
      for (const entry of this.chestMeshes.values()) {
        const d = Math.hypot(entry.group.position.x - L.x, entry.group.position.z - L.z);
        if (d <= bestNodeD) {
          bestNodeD = d;
          targetNode = entry.data;
        }
      }
    }
    if (L && !targetEnemy) {
      let bestEnemyD = 4.2;
      for (const m of this.enemyRigs.values()) {
        if (!m.root.visible) continue;
        const d = Math.hypot(m.x - L.x, m.z - L.z);
        if (d <= bestEnemyD) {
          bestEnemyD = d;
          targetEnemy = m;
        }
      }
    }

    const targetId = targetNode?.id || targetEnemy?.id || undefined;
    this.send({ type: 'mb_attack', targetId });
    if (targetNode) {
      this.send({ type: 'mb_mine', nodeId: targetNode.id, targetId: targetNode.id });
      this.world?.fx?.emit?.('fx_star', targetNode.x || L?.x || 0, 0.55, targetNode.z || L?.z || 0, 10, {
        speed: 1.3, up: 1.4, size: 0.26, life: 0.55, tint: [1.0, 0.88, 0.32],
      });
    }
  }

  onPointerHover(hit) {
    if (!this.active || !hit || !this.hoverCursorMesh) {
      if (this.hoverCursorMesh) this.hoverCursorMesh.visible = false;
      return;
    }
    const { gx, gz } = safeWorldToGrid(hit.x, hit.z);
    this.hoverTile = { gx, gz };
    this.updateCursorAndRange();
  }

  onArenaTap(hit) {
    if (!this.active || !hit) return;
    const { gx, gz } = safeWorldToGrid(hit.x, hit.z);
    const key = `${gx},${gz}`;
    this.hoverTile = { gx, gz };

    // 1. Village-Style Build Mode active: place building on tapped tile
    if (this.buildModeOpen && this.selectedTool) {
      const check = this.checkCanPlace(gx, gz, this.selectedTool);
      if (!check.ok && (check.error || check.reason)) {
        this.toast(`✕ ${check.error || check.reason}`);
      }
      this.send({ type: 'mb_build', gx, gz, kind: this.selectedTool });
      const wp = safeGridToWorld(gx, gz);
      this.world?.fx?.emit?.('fx_star', wp.x, 0.25, wp.z, 6, { speed: 0.9, up: 1.1, size: 0.24, life: 0.55 });
      this.updateCursorAndRange();
      return;
    }

    // 2. Existing building tapped: open Upgrade / Element Fuse / Repair / Sell inspector
    const existing = this.getBuildingAt(gx, gz);
    if (existing) {
      this.selectedBuildingKey = key;
      this.updateCursorAndRange();
      this.renderInspector();
      return;
    }

    if (this.selectedBuildingKey) {
      this.selectedBuildingKey = null;
      this.updateCursorAndRange();
      this.renderInspector();
    }

    // 3. Check if player tapped a Spread-Out Resource Node / Treasure Chest or Visible Monster
    const L = this.world?.local;
    let tappedNode = null;
    let bestNodeTapDist = 1.95;
    for (const entry of this.chestMeshes.values()) {
      const d = Math.hypot(entry.group.position.x - hit.x, entry.group.position.z - hit.z);
      if (d <= bestNodeTapDist) {
        bestNodeTapDist = d;
        tappedNode = entry.data;
      }
    }

    if (tappedNode) {
      const dest = this.clampWalkable(Number(tappedNode.x) || hit.x, Number(tappedNode.z) || hit.z);
      this.cameraMode = 'follow';
      this.world?.walkTo?.(dest.x, dest.z);
      const heroDist = L ? Math.hypot(dest.x - L.x, dest.z - L.z) : 99;
      if (heroDist <= 4.0) {
        this.triggerHeroSlashAndMine({ ...tappedNode, isNode: true });
      } else {
        this.send({ type: 'mb_attack', targetId: tappedNode.id });
        this.send({ type: 'mb_mine', nodeId: tappedNode.id, targetId: tappedNode.id });
      }
      return;
    }

    let tappedEnemy = null;
    let bestEnemyTapDist = 1.95;
    for (const m of this.enemyRigs.values()) {
      if (!m.root.visible) continue;
      const d = Math.hypot(m.x - hit.x, m.z - hit.z);
      if (d <= bestEnemyTapDist) {
        bestEnemyTapDist = d;
        tappedEnemy = m;
      }
    }

    if (tappedEnemy) {
      const dest = this.clampWalkable(tappedEnemy.x, tappedEnemy.z);
      this.cameraMode = 'follow';
      this.world?.walkTo?.(dest.x, dest.z);
      const heroDist = L ? Math.hypot(tappedEnemy.x - L.x, tappedEnemy.z - L.z) : 99;
      if (heroDist <= 4.0) {
        this.triggerHeroSlashAndMine({ id: tappedEnemy.id, x: tappedEnemy.x, z: tappedEnemy.z, isEnemy: true });
      } else {
        this.send({ type: 'mb_attack', targetId: tappedEnemy.id });
      }
      return;
    }

    // 4. Empty forest/cove ground tapped: clamp out of forest walls and walk Hero smoothly there
    const dest = this.clampWalkable(hit.x, hit.z);
    this.cameraMode = 'follow';
    this.world?.walkTo?.(dest.x, dest.z);
  }

  // -------------------------------------------------------------------------
  // 3D Stage Construction (56m × 56m Dark Enchanted Forest Floor, 2.5D Cove Walls,
  // Center Campfire + Giant Precious Diamond Motherlode Quarry, Real 3D Fog of War)
  // -------------------------------------------------------------------------
  ensureStageGroup() {
    if (this.stageGroup) return;
    this.stageGroup = new THREE.Group();
    this.stageGroup.name = 'moon_defense_stage';

    // 1. Hand-painted 56x56m Dark Enchanted Bioluminescent Forest floor plane
    const floorMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(56, 56).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: createArenaFloorTexture(), depthWrite: true })
    );
    floorMesh.position.y = 0.02;
    floorMesh.renderOrder = -2;
    this.stageGroup.add(floorMesh);

    // 2. Center Whispering Campfire + Giant Precious Diamond Motherlode Crystal at (0, 0)
    this.shrineGroup = new THREE.Group();
    this.shrineMagicCircle = new THREE.Mesh(
      new THREE.RingGeometry(1.45, 1.95, 40).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false })
    );
    this.shrineMagicCircle.position.y = 0.035;
    this.shrineGroup.add(this.shrineMagicCircle);

    // Giant Precious Diamond Motherlode Crystal at (0, 0)
    const motherlodeSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: loadTex('/assets/monopoly/id_vein_motherlode.png'), transparent: true, depthWrite: false })
    );
    motherlodeSprite.center.set(0.5, 0.06);
    motherlodeSprite.position.set(0, 0.05, -0.45);
    motherlodeSprite.scale.set(2.75, 2.75, 1);
    motherlodeSprite.renderOrder = 6;
    this.motherlodeSprite = motherlodeSprite;
    this.shrineGroup.add(motherlodeSprite);

    const quarryBadge = makeBadgeSprite('💎 Center Diamond Quarry', 'rgba(8, 24, 38, 0.90)', '#38bdf8');
    quarryBadge.position.set(0, 2.85, -0.45);
    this.shrineGroup.add(quarryBadge);

    // Whispering Campfire beside the Diamond Motherlode
    const campfireSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: createCampfireTexture(), transparent: true, depthWrite: false })
    );
    campfireSprite.center.set(0.5, 0.08);
    campfireSprite.position.set(0, 0.04, 1.15);
    campfireSprite.scale.set(2.2, 2.2, 1);
    campfireSprite.renderOrder = 6;
    this.campfireSprite = campfireSprite;
    this.shrineGroup.add(campfireSprite);

    // 4 Bioluminescent Spore Lanterns flanking the Center Diamond Quarry & Campfire Clearing
    for (const [bx, bz] of [[-2.8, -2.8], [2.8, -2.8], [-2.8, 2.8], [2.8, 2.8]]) {
      const lantern = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: createForestLanternTexture(), transparent: true, depthWrite: false })
      );
      lantern.center.set(0.5, 0.06);
      lantern.position.set(bx, 0.04, bz);
      lantern.scale.set(1.3, 1.6, 1);
      lantern.renderOrder = 6;
      this.shrineGroup.add(lantern);
    }
    this.stageGroup.add(this.shrineGroup);

    // 3. 4 Edge Boss Eclipse Rift Arches (N, S, W, E) at the outer rim of the 56m × 56m Island
    const edgeR = HALF_M - 1.2;
    for (const [rx, rz, sc] of [[0, -edgeR, 4.0], [0, edgeR, 3.6], [-edgeR, 0, 3.6], [edgeR, 0, 3.6]]) {
      const spr = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: loadTex('/assets/monopoly/id_titan_eclipse_rift.png'), transparent: true, depthWrite: false })
      );
      spr.center.set(0.5, 0.06);
      spr.position.set(rx, 0.04, rz);
      spr.scale.set(sc, sc, 1);
      spr.renderOrder = 5;
      this.stageGroup.add(spr);
    }

    // 4. Outer Rim Crystal Cliffs & Bioluminescent Trees around ±27.2m
    const rim = HALF_M - 0.7;
    const cliffSpots = [
      [-21, -rim], [-13, -rim], [-6, -rim], [6, -rim], [13, -rim], [21, -rim],
      [-21, rim], [-13, rim], [-6, rim], [6, rim], [13, rim], [21, rim],
      [-rim, -20], [-rim, -10], [-rim, 10], [-rim, 20],
      [rim, -20], [rim, -10], [rim, 10], [rim, 20],
    ];
    for (let i = 0; i < cliffSpots.length; i++) {
      const [cx, cz] = cliffSpots[i];
      const cl = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: loadTex('/assets/monopoly/id_canyon_crystal_cliff.png'), transparent: true, depthWrite: false })
      );
      cl.center.set(0.5, 0.05);
      cl.position.set(cx, 0.02, cz);
      cl.scale.set(3.4, 2.5, 1);
      cl.renderOrder = 3;
      this.stageGroup.add(cl);
    }

    // 5. Physical 2.5D Forest / Bioluminescent Mushroom / Cliff Walls Framing Every Cove on 28×28 Grid
    this.forestWallsGroup = new THREE.Group();
    const cliffTex = loadTex('/assets/monopoly/id_canyon_crystal_cliff.png');
    for (let gz = 1; gz < GRID_N - 1; gz++) {
      for (let gx = 1; gx < GRID_N - 1; gx++) {
        const info = safeGetTileInfo(gx, gz);
        if (info.kind !== 'forest_wall' && !isCoveForestWallBorder(gx, gz)) continue;
        const wp = safeGridToWorld(gx, gz);
        const variant = (gx * 3 + gz * 5) % 3;

        const rockSpr = new THREE.Sprite(
          new THREE.SpriteMaterial({ map: cliffTex, transparent: true, depthWrite: false })
        );
        rockSpr.center.set(0.5, 0.05);
        rockSpr.position.set(wp.x, 0.02, wp.z + 0.12);
        rockSpr.scale.set(2.35, 1.95, 1);
        rockSpr.renderOrder = 4;
        this.forestWallsGroup.add(rockSpr);

        const treeSpr = new THREE.Sprite(
          new THREE.SpriteMaterial({ map: createForestWallTexture(variant), transparent: true, depthWrite: false })
        );
        treeSpr.center.set(0.5, 0.06);
        treeSpr.position.set(wp.x + ((gx % 2 === 0) ? 0.14 : -0.14), 0.04, wp.z - 0.08);
        treeSpr.scale.set(2.45, 2.55, 1);
        treeSpr.renderOrder = 5;
        this.forestWallsGroup.add(treeSpr);
      }
    }
    this.stageGroup.add(this.forestWallsGroup);

    // 6. 2 Glowing Sanctuary Brazier Lanterns Flanking Each of the 4 Cove Choke Entrances + Gold Vein Crystals
    const covesMap = getActiveCovesMap();
    for (const cv of Object.values(covesMap)) {
      const chokeTiles = cv.choke || [[8, 4], [8, 5]];
      const c0 = safeGridToWorld(chokeTiles[0][0], chokeTiles[0][1]);
      const c1 = safeGridToWorld(chokeTiles[chokeTiles.length - 1][0], chokeTiles[chokeTiles.length - 1][1]);
      const midX = (c0.x + c1.x) * 0.5;
      const minZ = Math.min(c0.z, c1.z) - 1.35;
      const maxZ = Math.max(c0.z, c1.z) + 1.35;

      for (const bz of [minZ, maxZ]) {
        const lantern = new THREE.Sprite(
          new THREE.SpriteMaterial({ map: createForestLanternTexture(), transparent: true, depthWrite: false })
        );
        lantern.center.set(0.5, 0.05);
        lantern.position.set(midX, 0.04, bz);
        lantern.scale.set(1.3, 1.6, 1);
        lantern.renderOrder = 6;
        this.stageGroup.add(lantern);
      }

      for (const [vgx, vgz] of cv.veins || []) {
        const vp = safeGridToWorld(vgx, vgz);
        const veinSpr = new THREE.Sprite(
          new THREE.SpriteMaterial({ map: loadTex('/assets/monopoly/id_vein_crystal.png'), transparent: true, depthWrite: false })
        );
        veinSpr.center.set(0.5, 0.08);
        veinSpr.position.set(vp.x, 0.03, vp.z);
        veinSpr.scale.set(1.5, 1.5, 1);
        veinSpr.renderOrder = 4;
        this.stageGroup.add(veinSpr);
      }
    }

    // 7. Interactive 3D Grid Overlay (HIDDEN unless this.buildModeOpen === true!)
    this.gridOverlayGroup = new THREE.Group();
    const veinPts = [], chokePts = [], buildPts = [];
    const yG = 0.045;
    const pad = 0.06;
    const pushBox = (arr, x0, z0, x1, z1) => {
      arr.push(x0, yG, z0, x1, yG, z0, x1, yG, z0, x1, yG, z1, x1, yG, z1, x0, yG, z1, x0, yG, z1, x0, yG, z0);
    };
    for (let gz = 0; gz < GRID_N; gz++) {
      for (let gx = 0; gx < GRID_N; gx++) {
        const info = safeGetTileInfo(gx, gz);
        if (!info.buildable || info.kind === 'forest_wall' || info.kind === 'cliff') continue;
        const x0 = -HALF_M + gx * CELL_M + pad;
        const z0 = -HALF_M + gz * CELL_M + pad;
        const x1 = x0 + CELL_M - pad * 2;
        const z1 = z0 + CELL_M - pad * 2;
        if (info.kind === 'vein' || info.kind === 'gold_vein') {
          pushBox(veinPts, x0, z0, x1, z1);
        } else if (info.kind === 'choke') {
          pushBox(chokePts, x0, z0, x1, z1);
        } else {
          pushBox(buildPts, x0, z0, x1, z1);
        }
      }
    }
    const mkLines = (pts, hex, op) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      return new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: hex, transparent: true, opacity: op, depthWrite: false }));
    };
    this.veinGridLines = mkLines(veinPts, 0xfbbf24, 0.92);
    this.chokeGridLines = mkLines(chokePts, 0x38bdf8, 0.88);
    this.buildGridLines = mkLines(buildPts, 0x34d399, 0.62);
    this.gridOverlayGroup.add(this.veinGridLines, this.chokeGridLines, this.buildGridLines);
    this.gridOverlayGroup.visible = false;
    this.stageGroup.add(this.gridOverlayGroup);

    // 8. 3D Hover / Selected Tile Cursor (2.0m x 2.0m) + Tower/Ward Range Ring
    this.hoverCursorMesh = new THREE.Group();
    const padMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(CELL_M - 0.1, CELL_M - 0.1).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.34, depthWrite: false })
    );
    const cHalf = (CELL_M - 0.06) / 2;
    const bGeo = new THREE.BufferGeometry();
    bGeo.setAttribute('position', new THREE.Float32BufferAttribute([
      -cHalf, 0.02, -cHalf, cHalf, 0.02, -cHalf,
      cHalf, 0.02, -cHalf, cHalf, 0.02, cHalf,
      cHalf, 0.02, cHalf, -cHalf, 0.02, cHalf,
      -cHalf, 0.02, cHalf, -cHalf, 0.02, -cHalf,
    ], 3));
    const borderLines = new THREE.LineSegments(bGeo, new THREE.LineBasicMaterial({ color: 0x6ee7b7, transparent: true, opacity: 0.95 }));
    this.hoverCursorPadMat = padMesh.material;
    this.hoverCursorLineMat = borderLines.material;
    this.hoverCursorMesh.add(padMesh, borderLines);
    this.hoverCursorMesh.position.y = 0.05;
    this.hoverCursorMesh.visible = false;
    this.stageGroup.add(this.hoverCursorMesh);

    this.rangeRingMesh = new THREE.Mesh(
      new THREE.RingGeometry(0.96, 1.0, 48).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false })
    );
    this.rangeRingMesh.position.y = 0.048;
    this.rangeRingMesh.visible = false;
    this.stageGroup.add(this.rangeRingMesh);

    this.buildingsGroup = new THREE.Group();
    this.chestsGroup = new THREE.Group();
    this.unitsGroup = new THREE.Group();
    this.fxGroup = new THREE.Group();
    this.stageGroup.add(this.buildingsGroup, this.chestsGroup, this.unitsGroup, this.fxGroup);

    // 9. REAL 3D FOG OF WAR Horizontal Plane (56m × 56m at y = 2.1, renderOrder = 22)
    this.fogCanvas = document.createElement('canvas');
    this.fogCanvas.width = 256;
    this.fogCanvas.height = 256;
    this.fogCtx = this.fogCanvas.getContext('2d');
    this.fogImageData = this.fogCtx.createImageData(256, 256);
    this.fogTex = new THREE.CanvasTexture(this.fogCanvas);
    this.fogTex.colorSpace = THREE.SRGBColorSpace;
    this.fogTex.minFilter = THREE.LinearFilter;
    this.fogTex.magFilter = THREE.LinearFilter;

    this.fogMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(56, 56).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({
        map: this.fogTex,
        transparent: true,
        depthWrite: false,
        depthTest: false,
      })
    );
    this.fogMesh.position.y = 2.1;
    this.fogMesh.renderOrder = 22;
    this.fogMesh.raycast = () => {};
    this.stageGroup.add(this.fogMesh);
  }

  syncGridHighlight() {
    if (!this.gridOverlayGroup) return;
    this.gridOverlayGroup.visible = Boolean(this.buildModeOpen);
    if (this.buildGridLines) {
      this.buildGridLines.material.opacity = this.buildModeOpen ? 0.65 : 0;
      this.chokeGridLines.material.opacity = this.buildModeOpen ? 0.88 : 0;
      this.veinGridLines.material.opacity = this.buildModeOpen ? 0.95 : 0;
    }
  }

  checkCanPlace(gx, gz, kind) {
    const info = safeGetTileInfo(gx, gz);
    if (info.kind === 'forest_wall' || info.kind === 'cliff' || info.kind === 'void') {
      return { ok: false, error: `Cannot build on ${info.kind} tile` };
    }
    if (this.getBuildingAt(gx, gz)) {
      return { ok: false, error: 'Tile is already occupied' };
    }
    // 👁️ Vision Ward can be planted on any walkable tile (cove, choke, road, plaza, vein, shrine)
    if (kind === 'ward') {
      if (['cove', 'choke', 'road', 'plaza', 'vein', 'shrine'].includes(info.kind)) {
        return { ok: true, tile: info };
      }
      return { ok: false, error: 'Vision Wards must be placed on walkable forest or cove ground' };
    }
    // 💎 Diamond Drill can be placed on vein, cove, or shrine (near Center Diamond Quarry!)
    if (kind === 'diamond_drill') {
      if (['vein', 'cove', 'shrine'].includes(info.kind)) {
        return { ok: true, tile: info };
      }
      return { ok: false, error: 'Diamond Drills must be placed on a Vein, Cove, or Center Diamond Quarry' };
    }
    if (!info.buildable) {
      return { ok: false, error: `Cannot build ${kind} on ${info.kind} tile` };
    }
    if (kind === 'totem') {
      if (info.kind === 'cove' || info.kind === 'choke' || info.kind === 'plaza') {
        return { ok: true, tile: info };
      }
      return { ok: false, error: 'Heal Totems must be placed inside a Cove or behind your Gate' };
    }
    if (typeof canPlaceBuilding === 'function') {
      try {
        const res = canPlaceBuilding(gx, gz, kind, this.state?.buildings || {});
        if (res && typeof res === 'object') return res;
      } catch (_) {}
    }
    return { ok: true, tile: info };
  }

  updateCursorAndRange() {
    if (!this.hoverCursorMesh) return;
    const inBuild = this.buildModeOpen && Boolean(this.selectedTool);
    const targetTile = inBuild && this.hoverTile
      ? this.hoverTile
      : this.selectedBuildingKey
        ? (() => {
            const [gx, gz] = this.selectedBuildingKey.split(',').map(Number);
            return { gx, gz };
          })()
        : null;

    if (!targetTile || (!inBuild && !this.selectedBuildingKey)) {
      this.hoverCursorMesh.visible = false;
      this.rangeRingMesh.visible = false;
      return;
    }

    const wp = safeGridToWorld(targetTile.gx, targetTile.gz);
    this.hoverCursorMesh.position.set(wp.x, 0.05, wp.z);
    this.hoverCursorMesh.visible = true;

    const isOk = inBuild ? this.checkCanPlace(targetTile.gx, targetTile.gz, this.selectedTool).ok : true;
    this.hoverCursorPadMat.color.setHex(isOk ? 0x34d399 : 0xf87171);
    this.hoverCursorLineMat.color.setHex(isOk ? 0x6ee7b7 : 0xfca5a5);

    const selB = this.selectedBuildingKey ? this.getBuildingByKey(this.selectedBuildingKey) : null;
    const isRangeTool = inBuild && (
      String(this.selectedTool).startsWith('tower') ||
      this.selectedTool === 'totem' ||
      this.selectedTool === 'ward'
    );
    const selKind = String(selB?.buildingId || selB?.kind || '');
    const isRangeSel = selB && (
      selB.kind === 'tower' ||
      selB.kind === 'totem' ||
      selB.kind === 'ward' ||
      selKind.startsWith('tower') ||
      selKind === 'ward'
    );
    if (isRangeSel || isRangeTool) {
      const range = (this.selectedTool === 'ward' || selKind === 'ward' || selB?.kind === 'ward')
        ? 16.5
        : Number(selB?.range) || Number(MD_BUILDINGS?.[this.selectedTool]?.range) || (this.selectedTool === 'totem' ? 4.5 : 6.5);
      this.rangeRingMesh.position.set(wp.x, 0.048, wp.z);
      this.rangeRingMesh.scale.set(range, 1, range);
      this.rangeRingMesh.visible = true;
    } else {
      this.rangeRingMesh.visible = false;
    }
  }

  // -------------------------------------------------------------------------
  // State Helpers & 3D Synchronization
  // -------------------------------------------------------------------------
  getMyPlayer() {
    const profId = this.getProfile()?.id;
    const players = this.state?.players || [];
    if (Array.isArray(players)) {
      return players.find((p) => p && (p.id === profId || p.userId === profId)) || players[0] || null;
    }
    return null;
  }

  getBuildingsMap() {
    const raw = this.state?.buildings;
    const out = new Map();
    if (!raw) return out;
    if (Array.isArray(raw)) {
      for (const b of raw) {
        if (b && Number.isFinite(b.gx) && Number.isFinite(b.gz)) out.set(`${b.gx},${b.gz}`, b);
      }
    } else if (typeof raw === 'object') {
      for (const [k, b] of Object.entries(raw)) {
        if (!b) continue;
        if (k.includes(',')) out.set(k, b);
        else if (Number.isFinite(b.gx) && Number.isFinite(b.gz)) out.set(`${b.gx},${b.gz}`, b);
      }
    }
    return out;
  }

  getBuildingByKey(key) {
    return this.getBuildingsMap().get(key) || null;
  }

  getBuildingAt(gx, gz) {
    return this.getBuildingsMap().get(`${gx},${gz}`) || null;
  }

  syncFromState() {
    if (!this.state || !this.stageGroup) return;

    const me = this.getMyPlayer();
    if (me && !this._spawnedLocalInCove && this.world?.local) {
      this._spawnedLocalInCove = true;
      const sx = Number.isFinite(me.x) ? me.x : -18;
      const sz = Number.isFinite(me.z) ? me.z : -18;
      const clamped = this.clampWalkable(sx, sz);
      this.world.setLocalPosition(clamped.x, clamped.z);
      this.world.camTarget.set(clamped.x, 0, clamped.z);
    }

    this.syncBuildings3D();
    this.syncChestsAndNodes3D();
    this.syncAllies3D();
    this.syncEnemies3D();
    this.syncGems3D();
    this.syncEventsVfx();
    this.updateFogOfWar();
    this.updateCursorAndRange();
    this.renderHud();
    this.renderInspector();
    this.renderModals();
  }

  syncEventsVfx() {
    const events = this.state?.events;
    if (!Array.isArray(events)) return;
    const myId = this.getProfile()?.id;
    const L = this.world?.local;
    for (const ev of events) {
      if (!ev) continue;
      const isMe = !ev.userId || ev.userId === myId;
      if (ev.kind === 'tower_shot' || ev.kind === 'hero_shot') {
        const hex = ev.kind === 'hero_shot' ? 0xfef08a : 0x38bdf8;
        this.spawnProjectile(ev.fromX, ev.fromZ, ev.toX, ev.toZ, hex);
        if (ev.kind === 'hero_shot') {
          if (isMe) L?.rig?.triggerAttack?.('slash', { dur: 0.35 });
          else if (ev.userId) this.allyRigs.get(String(ev.userId))?.rig?.triggerAttack?.('slash', { dur: 0.35 });
        }
      } else if (
        ev.kind === 'mine_swing' ||
        ev.kind === 'mine_hit' ||
        ev.kind === 'resource_mined' ||
        ev.kind === 'diamond_mined' ||
        ev.kind === 'chest_open' ||
        ev.kind === 'hero_slash' ||
        ev.kind === 'hero_attack'
      ) {
        if (isMe) L?.rig?.triggerAttack?.('slash', { dur: 0.35 });
        else if (ev.userId) this.allyRigs.get(String(ev.userId))?.rig?.triggerAttack?.('slash', { dur: 0.35 });
        const fxX = Number.isFinite(ev.x) ? ev.x : (L?.x || 0);
        const fxZ = Number.isFinite(ev.z) ? ev.z : (L?.z || 0);
        this.world?.fx?.emit?.('fx_star', fxX, 0.55, fxZ, ev.kind === 'chest_open' ? 16 : 9, {
          speed: 1.4, up: 1.4, size: 0.28, life: 0.6, tint: [1.0, 0.88, 0.3],
        });
        if ((ev.kind === 'chest_open' || ev.kind === 'resource_mined' || ev.kind === 'diamond_mined') && (ev.gold || ev.diamonds)) {
          const dTxt = ev.diamonds ? ` +${ev.diamonds}💎` : '';
          const gTxt = ev.gold ? ` +${ev.gold}🪙` : '';
          this.toast(`${ev.kind === 'chest_open' ? '🎁 Forest Chest Opened' : '⛏️ Crystal Quarry Mined'}:${gTxt}${dTxt}!`);
        }
      } else if (ev.kind === 'orbit_hit' || ev.kind === 'orbit_blades') {
        if (isMe) L?.rig?.triggerAttack?.('spin_slash', { dur: 0.42 });
        else if (ev.userId) this.allyRigs.get(String(ev.userId))?.rig?.triggerAttack?.('spin_slash', { dur: 0.42 });
      } else if (ev.kind === 'chain_bolt') {
        if (Number.isFinite(ev.fromX) && Number.isFinite(ev.toX)) {
          this.spawnProjectile(ev.fromX, ev.fromZ, ev.toX, ev.toZ, 0x38bdf8);
        }
        if (isMe) L?.rig?.triggerAttack?.('slash', { dur: 0.35 });
        else if (ev.userId) this.allyRigs.get(String(ev.userId))?.rig?.triggerAttack?.('slash', { dur: 0.35 });
      } else if (ev.kind === 'frost_nova') {
        this.world?.fx?.emit?.('fx_snowflake', ev.x, 0.3, ev.z, 12, { ring: true, speed: 1.8, up: 0.5, size: 0.3, life: 0.65 });
        if (isMe) L?.rig?.triggerAttack?.('spin_slash', { dur: 0.45 });
        else if (ev.userId) this.allyRigs.get(String(ev.userId))?.rig?.triggerAttack?.('spin_slash', { dur: 0.45 });
      } else if (ev.kind === 'meteor' || ev.kind === 'titan_slam') {
        this.world?.fx?.emit?.('fx_flame', ev.x, 0.4, ev.z, 14, { speed: 1.6, up: 1.2, size: 0.34, life: 0.7 });
        if (ev.kind === 'meteor') {
          if (isMe) L?.rig?.triggerAttack?.('ground_slam', { dur: 0.52 });
          else if (ev.userId) this.allyRigs.get(String(ev.userId))?.rig?.triggerAttack?.('ground_slam', { dur: 0.52 });
        }
      } else if (ev.kind === 'charm_drop' && ev.charm) {
        this.toast(`🎁 Boss Charm Drop: ${ev.charm.icon || '✨'} ${ev.charm.name}!`);
      }
    }
  }

  // Sync Spread-Out Mineable Crystal / Ore Nodes & Wilds Treasure Chests
  syncChestsAndNodes3D() {
    if (!this.chestsGroup) return;
    const rawChests = Array.isArray(this.state?.chests) ? this.state.chests : null;
    const rawNodes = Array.isArray(this.state?.resourceNodes) ? this.state.resourceNodes : null;

    const combined = [];
    const seenIds = new Set();
    const pushItem = (item, idx, fallbackKind) => {
      if (!item || item.opened || item.depleted || (Number.isFinite(item.hp) && item.hp <= 0)) return;
      const id = String(item.id || `${fallbackKind}_${idx}`);
      if (seenIds.has(id)) return;
      seenIds.add(id);
      combined.push({ ...item, id, _idx: idx, _fallbackKind: fallbackKind });
    };

    if (rawNodes) rawNodes.forEach((n, i) => pushItem(n, i, 'ore'));
    if (rawChests) rawChests.forEach((c, i) => pushItem(c, i, 'chest'));

    if (!rawNodes && !rawChests) {
      DEFAULT_WILDS_NODES.forEach((n, i) => pushItem(n, i, n.kind));
    } else if (!rawNodes && rawChests) {
      DEFAULT_WILDS_NODES.filter((n) => n.kind !== 'chest').forEach((n, i) => pushItem(n, i, n.kind));
    }

    const activeSet = new Set();
    for (const node of combined) {
      const id = node.id;
      activeSet.add(id);
      const nx = Number(node.x) || 0;
      const nz = Number(node.z) || 0;

      let entry = this.chestMeshes.get(id);
      if (!entry) {
        entry = this.createChestOrNode3D(node);
        this.chestMeshes.set(id, entry);
        this.chestsGroup.add(entry.group);
      }
      entry.group.position.set(nx, 0, nz);
      entry.data = node;

      const maxHp = Math.max(1, Number(node.maxHp) || 100);
      const hp = Math.max(0, Number(node.hp) ?? maxHp);
      const ratio = Math.max(0.02, Math.min(1, hp / maxHp));
      if (entry.hpFill) {
        entry.hpFill.scale.x = ratio;
        entry.hpFill.position.x = -(1 - ratio) * (entry.hpBgWidth - 0.04) * 0.5;
      }
    }

    for (const [id, entry] of this.chestMeshes.entries()) {
      if (!activeSet.has(id)) {
        const px = entry.group.position.x;
        const pz = entry.group.position.z;
        this.world?.fx?.emit?.('fx_star', px, 0.55, pz, 16, {
          speed: 1.6, up: 1.5, size: 0.3, life: 0.7, tint: [1.0, 0.88, 0.3],
        });
        this.world?.fx?.emit?.('fx_stardust', px, 0.45, pz, 12, {
          speed: 1.3, up: 1.2, size: 0.26, life: 0.65,
        });
        this.chestsGroup.remove(entry.group);
        entry.ring?.geometry?.dispose?.();
        entry.ring?.material?.dispose?.();
        entry.sprite?.material?.dispose?.();
        this.chestMeshes.delete(id);
      }
    }
  }

  createChestOrNode3D(node) {
    const group = new THREE.Group();
    const nx = Number(node.x) || 0;
    const nz = Number(node.z) || 0;
    group.position.set(nx, 0, nz);

    const rawKind = String(node.kind || node.type || node._fallbackKind || 'chest').toLowerCase();
    const isMotherlode = rawKind.includes('motherlode') || rawKind.includes('diamond');
    const isOre = isMotherlode || rawKind.includes('ore') || rawKind.includes('vein') || rawKind.includes('crystal') || rawKind.includes('mine');

    const sprUrl = node.sprite || (
      isMotherlode
        ? '/assets/monopoly/id_vein_motherlode.png'
        : isOre
          ? '/assets/monopoly/id_vein_crystal.png'
          : (node.tier === 'epic' ? '/assets/monopoly/gacha_trunk_epic.png' : '/assets/monopoly/gacha_trunk_mythic.png')
    );

    const ringHex = isMotherlode ? 0x38bdf8 : isOre ? 0x2dd4bf : 0xfacc15;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.68, 0.96, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: ringHex, transparent: true, opacity: 0.68, side: THREE.DoubleSide, depthWrite: false })
    );
    ring.position.y = 0.036;
    group.add(ring);

    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: loadTex(sprUrl), transparent: true, depthWrite: false })
    );
    sprite.center.set(0.5, 0.06);
    const sc = isMotherlode ? 1.85 : 1.65;
    sprite.scale.set(sc, sc, 1);
    sprite.renderOrder = 7;
    group.add(sprite);

    const goldAmt = Number(node.gold || node.rewardGold || (isMotherlode ? 60 : isOre ? 35 : 45));
    const badgeText = node.label || (
      isMotherlode
        ? `💎 Motherlode (+${goldAmt}🪙)`
        : isOre
          ? `⛏️ Starlight Ore (+${goldAmt}🪙)`
          : `🎁 Attack / Touch Chest (+${goldAmt}🪙)`
    );
    const badgeBorder = isMotherlode ? '#38bdf8' : isOre ? '#5eead4' : '#fde047';
    const badge = makeBadgeSprite(badgeText, 'rgba(10, 22, 34, 0.90)', badgeBorder);
    badge.position.set(0, 1.95, 0);
    group.add(badge);

    const hpGroup = new THREE.Group();
    hpGroup.position.set(0, 1.48, 0);
    const bgW = 1.25;
    const bgH = 0.13;
    const hpBg = new THREE.Mesh(
      new THREE.PlaneGeometry(bgW, bgH),
      new THREE.MeshBasicMaterial({ color: 0x0f172a, transparent: true, opacity: 0.85, depthWrite: false })
    );
    const hpFill = new THREE.Mesh(
      new THREE.PlaneGeometry(bgW - 0.04, bgH - 0.04),
      new THREE.MeshBasicMaterial({ color: isOre ? 0x2dd4bf : 0xfacc15, depthWrite: false })
    );
    hpFill.position.z = 0.01;
    hpGroup.add(hpBg, hpFill);
    group.add(hpGroup);

    return { group, ring, sprite, hpGroup, hpFill, hpBgWidth: bgW, isOre, data: node };
  }

  syncBuildings3D() {
    const map = this.getBuildingsMap();
    for (const [key, entry] of this.buildingMeshes.entries()) {
      if (!map.has(key)) {
        this.buildingsGroup.remove(entry.group);
        entry.rig?.dispose?.();
        this.buildingMeshes.delete(key);
        if (this.selectedBuildingKey === key) this.selectedBuildingKey = null;
      }
    }

    for (const [key, b] of map.entries()) {
      const [gx, gz] = key.split(',').map(Number);
      const wp = safeGridToWorld(gx, gz);
      const rawKind = b.buildingId || b.kind || b.type || 'wall';
      const isTower = b.kind === 'tower' || String(rawKind).startsWith('tower');
      const isTotem = b.kind === 'totem' || rawKind === 'totem';
      const isWard = b.kind === 'ward' || rawKind === 'ward';
      const isDrill = b.kind === 'diamond_drill' || rawKind === 'diamond_drill';
      const elements = Array.isArray(b.elements) && b.elements.length
        ? b.elements
        : (b.element ? [b.element] : (isTower ? [String(rawKind).replace('tower_', '')] : []));
      const fusion = isTower ? safeResolveFusion(elements) : null;
      const outfit = b.outfit || fusion?.outfit || 's11_zeus_olympus';
      const level = Number(b.level || 1);
      const sig = `${rawKind}:${level}:${outfit}:${elements.join('+')}`;

      let entry = this.buildingMeshes.get(key);
      if (entry && entry.sig !== sig) {
        this.buildingsGroup.remove(entry.group);
        entry.rig?.dispose?.();
        entry = null;
      }
      if (!entry) {
        const normKind = isTower ? 'tower' : isTotem ? 'totem' : isWard ? 'ward' : isDrill ? 'diamond_drill' : rawKind;
        entry = this.createBuilding3D(wp, normKind, level, outfit, elements);
        entry.sig = sig;
        this.buildingMeshes.set(key, entry);
        this.buildingsGroup.add(entry.group);
      }

      const maxHp = Math.max(1, Number(b.maxHp) || 200);
      const hp = Math.max(0, Number(b.hp) ?? maxHp);
      const ratio = Math.max(0.01, Math.min(1, hp / maxHp));
      if (entry.hpFill) {
        entry.hpFill.scale.x = ratio;
        entry.hpFill.position.x = -(1 - ratio) * 0.55;
        entry.hpGroup.visible = hp < maxHp;
      }
      entry.data = b;
    }
  }

  createBuilding3D(wp, kind, level, outfit, elements) {
    const group = new THREE.Group();
    group.position.set(wp.x, 0, wp.z);

    let rig = null;
    let healRing = null;
    let wardRing = null;
    const isTower = kind === 'tower' || String(kind).startsWith('tower');
    const isMine = kind === 'mine';
    const isDrill = kind === 'diamond_drill';
    const isTotem = kind === 'totem';
    const isWard = kind === 'ward';

    if (isTower) {
      const plinth = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: createForestPlinthTexture(), transparent: true, depthWrite: false })
      );
      plinth.center.set(0.5, 0.08);
      plinth.scale.set(1.75, 1.45, 1);
      plinth.renderOrder = 4;
      group.add(plinth);

      rig = new ChibiRig({ lineage: 'girl', name: '', sub: '', wings: null });
      rig.ROOT.position.set(0, 0.42, 0);
      rig.ROOT.scale.setScalar(0.84);
      if (rig.nameTag) rig.nameTag.visible = false;
      rig.ready.then(() => rig.setOutfit(outfit));
      group.add(rig.ROOT);
    } else if (isWard) {
      // 👁️ Vision Ward: wide cyan-teal radar ring + bioluminescent forest lantern
      wardRing = new THREE.Mesh(
        new THREE.RingGeometry(0.6, 0.9, 32).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: 0x2dd4bf, transparent: true, opacity: 0.72, side: THREE.DoubleSide, depthWrite: false })
      );
      wardRing.position.y = 0.038;
      group.add(wardRing);

      const outerPulse = new THREE.Mesh(
        new THREE.RingGeometry(1.05, 1.22, 32).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false })
      );
      outerPulse.position.y = 0.036;
      group.add(outerPulse);

      const spr = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: createForestLanternTexture(), transparent: true, depthWrite: false })
      );
      spr.center.set(0.5, 0.06);
      spr.scale.set(1.5, 1.85, 1);
      spr.renderOrder = 6;
      group.add(spr);
    } else if (isDrill) {
      // 💎 Diamond Drill: Motherlode crystal + Gold Mine drill rig
      const baseRing = new THREE.Mesh(
        new THREE.RingGeometry(0.65, 0.95, 32).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false })
      );
      baseRing.position.y = 0.038;
      group.add(baseRing);

      const lodeSpr = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: loadTex('/assets/monopoly/id_vein_motherlode.png'), transparent: true, depthWrite: false })
      );
      lodeSpr.center.set(0.5, 0.06);
      lodeSpr.position.set(-0.22, 0.02, -0.12);
      lodeSpr.scale.set(1.65, 1.65, 1);
      lodeSpr.renderOrder = 5;
      group.add(lodeSpr);

      const drillSpr = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: loadTex('/assets/monopoly/id_gold_mine.png'), transparent: true, depthWrite: false })
      );
      drillSpr.center.set(0.5, 0.06);
      drillSpr.position.set(0.18, 0.04, 0.12);
      drillSpr.scale.set(1.65, 1.65, 1);
      drillSpr.renderOrder = 6;
      group.add(drillSpr);
    } else if (isTotem) {
      healRing = new THREE.Mesh(
        new THREE.RingGeometry(0.68, 0.98, 32).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.65, side: THREE.DoubleSide, depthWrite: false })
      );
      healRing.position.y = 0.038;
      group.add(healRing);

      const innerRing = new THREE.Mesh(
        new THREE.RingGeometry(0.42, 0.58, 24).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: 0x2dd4bf, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false })
      );
      innerRing.position.y = 0.04;
      group.add(innerRing);

      const spr = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: createMoonwellTotemTexture(), transparent: true, depthWrite: false })
      );
      spr.center.set(0.5, 0.06);
      spr.scale.set(1.75, 1.75, 1);
      spr.renderOrder = 6;
      group.add(spr);
    } else {
      const baseMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.75, 0.85, 0.14, 16),
        new THREE.MeshBasicMaterial({ color: isMine ? 0xf59e0b : 0x14b8a6, transparent: true, opacity: 0.35 })
      );
      baseMesh.position.y = 0.07;
      group.add(baseMesh);

      const tex = isMine
        ? loadTex('/assets/monopoly/id_gold_mine.png')
        : createForestGateTexture(level);
      const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
      spr.center.set(0.5, 0.06);
      spr.scale.set(1.85, 1.85, 1);
      spr.renderOrder = 6;
      group.add(spr);
    }

    const elIcons = elements.map((e) => MD_ELEMENTS?.[e]?.icon || '').join('');
    const badgeLabel = isDrill
      ? `💎 +🪙 Lv.${level}`
      : isMine
        ? `⛏️ +🪙 Lv.${level}`
        : isWard
          ? `👁️ Ward Lv.${level}`
          : isTotem
            ? `💖 Heal Lv.${level}`
            : `${elIcons || '🧱'} Lv.${level}`;
    const badgeBorder = isDrill || isWard ? '#38bdf8' : '#fde047';
    const badge = makeBadgeSprite(badgeLabel, 'rgba(15, 23, 42, 0.88)', badgeBorder);
    badge.position.set(0, isTower ? 2.45 : 1.95, 0);
    group.add(badge);

    const hpGroup = new THREE.Group();
    hpGroup.position.set(0, 0.25, 0.75);
    const hpBg = new THREE.Mesh(new THREE.PlaneGeometry(1.16, 0.12), new THREE.MeshBasicMaterial({ color: 0x0f172a, depthWrite: false }));
    const hpFill = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.08), new THREE.MeshBasicMaterial({ color: 0x34d399, depthWrite: false }));
    hpFill.position.z = 0.01;
    hpGroup.add(hpBg, hpFill);
    hpGroup.visible = false;
    group.add(hpGroup);

    return { group, kind, level, outfit, elements, rig, healRing, wardRing, hpGroup, hpFill, fireTimer: Math.random() * 0.6 };
  }

  syncAllies3D() {
    const myId = this.getProfile()?.id;
    const list = Array.isArray(this.state?.players) ? this.state.players : [];
    const seen = new Set();

    for (const p of list) {
      if (!p || !p.active || p.id === myId || p.userId === myId) continue;
      const key = String(p.id || p.seat);
      seen.add(key);
      let ally = this.allyRigs.get(key);
      const px = Number(p.x) || 0;
      const pz = Number(p.z) || 0;
      if (!ally) {
        const rig = new ChibiRig({
          lineage: p.lineage || 'girl',
          name: p.name || `Ally #${(p.seat ?? 0) + 1}`,
          sub: `Lv.${p.level || 1}`,
        });
        rig.setPosition(px, pz);
        if (p.outfitId) rig.ready.then(() => rig.setOutfit(p.outfitId));
        this.unitsGroup.add(rig.ROOT);
        ally = { rig, x: px, z: pz, tx: px, tz: pz };
        this.allyRigs.set(key, ally);
      }
      ally.tx = px;
      ally.tz = pz;
      ally.rig.updateNameTag({ name: p.name || 'Ally', sub: `Lv.${p.level || 1}` });
    }

    for (const [key, ally] of this.allyRigs.entries()) {
      if (!seen.has(key)) {
        this.unitsGroup.remove(ally.rig.ROOT);
        ally.rig.dispose?.();
        this.allyRigs.delete(key);
      }
    }
  }

  syncEnemies3D() {
    const rawList = Array.isArray(this.state?.enemies) ? [...this.state.enemies] : [];
    if (this.state?.titan && this.state.titan.hp > 0) {
      const tid = String(this.state.titan.id || 'titan_boss');
      if (!rawList.some((e) => e && String(e.id) === tid)) {
        rawList.push({ ...this.state.titan, id: tid, isBoss: true });
      }
    }

    const seen = new Set();
    const sources = this.getVisionSources();

    for (const e of rawList) {
      if (!e || e.hp <= 0) continue;
      const id = String(e.id);
      seen.add(id);
      let rig = this.enemyRigs.get(id);
      if (!rig) {
        rig = new MonsterRig(e);
        this.enemyRigs.set(id, rig);
        this.unitsGroup.add(rig.root);
      }
      rig.sync(e);
      rig.root.visible = this.isPointVisible(rig.x, rig.z, { stealthed: Boolean(e.stealthed), sources });
    }

    for (const [id, rig] of this.enemyRigs.entries()) {
      if (!seen.has(id)) {
        this.world?.fx?.emit?.('fx_stardust', rig.x, 0.45, rig.z, rig.isBoss ? 18 : 7, {
          speed: 1.4, up: 1.3, size: rig.isBoss ? 0.36 : 0.24, life: 0.65,
        });
        this.unitsGroup.remove(rig.root);
        rig.dispose();
        this.enemyRigs.delete(id);
      }
    }
  }

  syncGems3D() {
    const list = Array.isArray(this.state?.gems) ? this.state.gems : [];
    const seen = new Set();

    for (const g of list) {
      if (!g) continue;
      const id = String(g.id);
      seen.add(id);
      let mesh = this.gemMeshes.get(id);
      if (!mesh) {
        const isGold = (g.gold || 0) >= (g.xp || 0);
        mesh = new THREE.Mesh(
          new THREE.OctahedronGeometry(isGold ? 0.25 : 0.21, 0),
          new THREE.MeshBasicMaterial({ color: isGold ? 0xfacc15 : 0x38bdf8 })
        );
        mesh.position.set(Number(g.x) || 0, 0.32, Number(g.z) || 0);
        this.gemMeshes.set(id, mesh);
        this.unitsGroup.add(mesh);
      } else {
        mesh.position.x = Number(g.x) || mesh.position.x;
        mesh.position.z = Number(g.z) || mesh.position.z;
      }
    }

    const L = this.world?.local;
    for (const [id, mesh] of this.gemMeshes.entries()) {
      if (!seen.has(id)) {
        if (L) this.world?.fx?.emit?.('fx_star', L.x, 0.5, L.z, 3, { speed: 0.6, up: 0.9, size: 0.18, life: 0.4 });
        this.unitsGroup.remove(mesh);
        mesh.geometry?.dispose?.();
        mesh.material?.dispose?.();
        this.gemMeshes.delete(id);
      }
    }
  }

  spawnProjectile(fromX, fromZ, toX, toZ, hex = 0x38bdf8) {
    if (this.projectiles.length > 48 || !this.fxGroup) return;
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), new THREE.MeshBasicMaterial({ color: hex }));
    mesh.position.set(fromX, 1.15, fromZ);
    this.fxGroup.add(mesh);
    this.projectiles.push({ mesh, x0: fromX, z0: fromZ, x1: toX, z1: toZ, t: 0, dur: 0.24 });
  }

  clearDynamic3D() {
    for (const entry of this.buildingMeshes.values()) {
      this.buildingsGroup?.remove(entry.group);
      entry.rig?.dispose?.();
    }
    this.buildingMeshes.clear();
    for (const entry of this.chestMeshes.values()) {
      this.chestsGroup?.remove(entry.group);
      entry.ring?.geometry?.dispose?.();
      entry.ring?.material?.dispose?.();
      entry.sprite?.material?.dispose?.();
    }
    this.chestMeshes.clear();
    for (const ally of this.allyRigs.values()) {
      this.unitsGroup?.remove(ally.rig.ROOT);
      ally.rig?.dispose?.();
    }
    this.allyRigs.clear();
    for (const m of this.enemyRigs.values()) {
      this.unitsGroup?.remove(m.root);
      m.dispose();
    }
    this.enemyRigs.clear();
    for (const g of this.gemMeshes.values()) {
      this.unitsGroup?.remove(g);
      g.geometry?.dispose?.();
      g.material?.dispose?.();
    }
    this.gemMeshes.clear();
    for (const p of this.projectiles) {
      this.fxGroup?.remove(p.mesh);
      p.mesh.geometry?.dispose?.();
      p.mesh.material?.dispose?.();
    }
    this.projectiles = [];
  }

  // -------------------------------------------------------------------------
  // Per-Frame Update Loop (called by WorldEngine.update)
  // -------------------------------------------------------------------------
  update(dt, camera) {
    if (!this.active || !this.stageGroup) return;
    this.elapsed += dt;

    if (this.shrineMagicCircle) this.shrineMagicCircle.rotation.z += dt * 0.45;
    if (this.campfireSprite) {
      const f = 2.2 + Math.sin(this.elapsed * 6.5) * 0.08;
      this.campfireSprite.scale.set(2.2, f, 1);
    }
    if (this.motherlodeSprite) {
      this.motherlodeSprite.position.y = 0.05 + Math.sin(this.elapsed * 2.6) * 0.05;
    }

    const L = this.world?.local;
    if (L) {
      if (!this.isWalkable(L.x, L.z)) {
        const safePos = this.clampWalkable(L.x, L.z);
        this.world.setLocalPosition(safePos.x, safePos.z);
      }

      this._moveSendTimer += dt;
      const moving = Math.hypot(L.animVx || 0, L.animVz || 0) > 0.15;
      if ((moving && this._moveSendTimer >= 0.16) || (!moving && this._wasMoving)) {
        this._moveSendTimer = 0;
        this._wasMoving = moving;
        this.send({
          type: 'mb_move',
          x: +L.x.toFixed(2),
          z: +L.z.toFixed(2),
          vx: +(L.animVx || 0).toFixed(2),
          vz: +(L.animVz || 0).toFixed(2),
          right: Boolean(L.rig?.facing?.right),
          back: Boolean(L.rig?.facing?.back),
        });
      }

      // Auto-swing pickaxe/sword when standing within 2.4m of a Resource Node or Chest
      this._autoMineTimer += dt;
      if (this._autoMineTimer >= 0.85) {
        for (const entry of this.chestMeshes.values()) {
          const d = Math.hypot(entry.group.position.x - L.x, entry.group.position.z - L.z);
          if (d <= 2.4) {
            this._autoMineTimer = 0;
            L.rig?.triggerAttack?.('slash', { dur: 0.35 });
            this.world?.fx?.emit?.('fx_star', entry.group.position.x, 0.55, entry.group.position.z, 6, {
              speed: 1.2, up: 1.2, size: 0.24, life: 0.5, tint: [1.0, 0.88, 0.3],
            });
            this.send({ type: 'mb_attack', targetId: entry.data.id });
            this.send({ type: 'mb_mine', nodeId: entry.data.id, targetId: entry.data.id });
            break;
          }
        }
      }
    }

    for (const entry of this.chestMeshes.values()) {
      if (entry.ring) entry.ring.rotation.z += dt * 1.1;
      if (entry.sprite) {
        entry.sprite.position.y = Math.abs(Math.sin(this.elapsed * 2.4 + entry.group.position.x)) * 0.06;
      }
      if (camera && entry.hpGroup) {
        entry.hpGroup.quaternion.copy(camera.quaternion);
      }
    }

    // Update Enemies / Titan & Enforce Real Fog-of-War Vision Culling
    const sources = this.getVisionSources();
    let titanProwlingNearby = false;

    for (const m of this.enemyRigs.values()) {
      m.update(dt, camera);
      const stealthed = Boolean(m.data?.stealthed || m.stealthed);
      const visible = this.isPointVisible(m.x, m.z, { stealthed, sources });
      m.root.visible = visible;
      if (m.isBoss && !visible && L) {
        const distToHero = Math.hypot(m.x - L.x, m.z - L.z);
        if (distToHero <= 22.0) {
          titanProwlingNearby = true;
        }
      }
    }

    if (!titanProwlingNearby && L && this.state?.titan && this.state.titan.hp > 0) {
      const tx = Number(this.state.titan.x) || 0;
      const tz = Number(this.state.titan.z) || 0;
      const vis = this.isPointVisible(tx, tz, { stealthed: Boolean(this.state.titan.stealthed), sources });
      if (!vis && Math.hypot(tx - L.x, tz - L.z) <= 22.0) {
        titanProwlingNearby = true;
      }
    }

    if (this.prowlBannerEl) {
      this.prowlBannerEl.hidden = !titanProwlingNearby;
    }

    // Throttle 256x256 Fog-of-War canvas + Mini-Map redraw to ~15 FPS for silky 60 FPS performance
    this._fogUpdateTimer += dt;
    if (this._fogUpdateTimer >= 0.065) {
      this._fogUpdateTimer = 0;
      this.updateFogOfWar();
    }

    for (const ally of this.allyRigs.values()) {
      const dx = ally.tx - ally.x;
      const dz = ally.tz - ally.z;
      const step = Math.min(1, dt * 10);
      const vx = (dx * step) / Math.max(dt, 1e-4);
      const vz = (dz * step) / Math.max(dt, 1e-4);
      ally.x += dx * step;
      ally.z += dz * step;
      ally.rig.setPosition(ally.x, ally.z);
      ally.rig.update(dt, { vx, vz }, camera);
    }

    for (const entry of this.buildingMeshes.values()) {
      if (entry.kind === 'mine' || entry.kind === 'diamond_drill') {
        if (Math.random() < dt * 1.6) {
          const isDrill = entry.kind === 'diamond_drill';
          this.world?.fx?.emit?.('fx_star', entry.group.position.x, 1.25, entry.group.position.z, 1, {
            speed: 0.28, up: 0.7, size: 0.22, life: 0.6, tint: isDrill ? [0.35, 0.85, 1.0] : [1.0, 0.88, 0.3],
          });
        }
        continue;
      }
      if (entry.kind === 'ward') {
        if (entry.wardRing) entry.wardRing.rotation.z += dt * 1.4;
        continue;
      }
      if (entry.kind === 'totem') {
        if (entry.healRing) entry.healRing.rotation.z -= dt * 1.2;
        if (Math.random() < dt * 1.6) {
          this.world?.fx?.emit?.('fx_stardust', entry.group.position.x, 0.9, entry.group.position.z, 1, {
            speed: 0.35, up: 0.75, size: 0.22, life: 0.65, tint: [0.35, 0.95, 0.68],
          });
        }
        continue;
      }
      if (!entry.rig) continue;

      let nearest = null;
      let bestD = Number(entry.data?.range) || 7.0;
      for (const m of this.enemyRigs.values()) {
        if (!m.root.visible) continue;
        const d = Math.hypot(m.x - entry.group.position.x, m.z - entry.group.position.z);
        if (d <= bestD) {
          bestD = d;
          nearest = m;
        }
      }
      if (nearest) {
        entry.rig.facing.set(nearest.x >= entry.group.position.x, nearest.z < entry.group.position.z);
        entry.fireTimer -= dt;
        if (entry.fireTimer <= 0) {
          entry.fireTimer = 0.85;
          entry.rig.triggerAttack?.('slash', { dur: 0.38 });
          const elKey = entry.elements?.[0] || 'storm';
          this.spawnProjectile(entry.group.position.x, entry.group.position.z, nearest.x, nearest.z, ELEMENT_BOLT_HEX[elKey] || 0x38bdf8);
        }
      }
      entry.rig.update(dt, { vx: 0, vz: 0, walkWeight: 0 }, camera);
    }

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.t += dt;
      const k = Math.min(1, p.t / p.dur);
      p.mesh.position.set(
        p.x0 + (p.x1 - p.x0) * k,
        1.15 * (1 - k) + 0.55 * k + Math.sin(k * Math.PI) * 0.45,
        p.z0 + (p.z1 - p.z0) * k
      );
      if (k >= 1) {
        this.fxGroup.remove(p.mesh);
        p.mesh.geometry?.dispose?.();
        p.mesh.material?.dispose?.();
        this.projectiles.splice(i, 1);
      }
    }

    for (const g of this.gemMeshes.values()) {
      g.rotation.y += dt * 3.2;
      g.position.y = 0.28 + Math.sin(this.elapsed * 4 + g.position.x) * 0.08;
    }
  }

  // -------------------------------------------------------------------------
  // Mobile-Vertical & Desktop Island Defense HUD + Live Fog Mini-Map Radar
  // -------------------------------------------------------------------------
  buildDom() {
    this.root = document.createElement('div');
    this.root.className = 'md-root';
    this.root.hidden = true;

    this.root.innerHTML = `
      <div class="md-top-bar">
        <div class="md-top-group">
          <span class="md-pill wave" id="md-wave-pill">🌊 Wave 1/20</span>
          <span class="md-pill titan" id="md-phase-pill">⏳ Titan Awakens: 20s</span>
          <button type="button" class="md-btn start-wave" id="md-start-wave-btn">⚡ Awaken Titan (+40🪙)</button>
          <div class="md-bar-wrap" title="Center Campfire &amp; Sanctuary HP">
            <span>🔥</span>
            <div class="md-bar-track"><div class="md-bar-fill shrine" id="md-shrine-fill" style="width:100%"></div></div>
            <span id="md-shrine-txt">1000</span>
          </div>
        </div>
        <div class="md-top-group">
          <span class="md-pill gold" id="md-gold-pill">🪙 180 (+7/s)</span>
          <span class="md-pill diamond" id="md-diamond-pill">💎 0</span>
          <div class="md-bar-wrap" title="Hero Level &amp; EXP">
            <span id="md-lv-txt">Lv.1</span>
            <div class="md-bar-track"><div class="md-bar-fill xp" id="md-xp-fill" style="width:0%"></div></div>
          </div>
          <button type="button" class="md-btn" id="md-zoom-btn">🔭 Zoom</button>
          <button type="button" class="md-btn" id="md-speed-btn">⏩ 1×</button>
          <button type="button" class="md-btn cashout" id="md-cashout-btn">💰 Cash Out</button>
          <button type="button" class="md-btn exit" id="md-exit-btn">✕</button>
        </div>
      </div>

      <div class="md-prowl-banner" id="md-prowl-banner" hidden>👣 TITAN PROWLING NEARBY...</div>

      <div class="md-minimap-wrap" title="Tap Mini-Map to Walk / Scout">
        <canvas id="md-minimap" class="md-minimap" width="84" height="84"></canvas>
        <span class="md-minimap-lbl">🌫️ FOG RADAR</span>
      </div>

      <div class="md-inspector" id="md-inspector" hidden></div>

      <div class="md-joystick" id="md-joystick">
        <div class="md-joy-stick" id="md-joy-stick"></div>
      </div>

      <div class="md-action-cluster">
        <button type="button" class="md-act-btn attack" id="md-attack-btn">⚔️ Slash / ⛏️ Mine</button>
        <button type="button" class="md-act-btn dash" id="md-dash-btn">⚡ Dash</button>
        <button type="button" class="md-act-btn ult" id="md-ult-btn" disabled>🌈 Ult (0%)</button>
      </div>

      <div class="md-mode-bar" id="md-mode-bar">
        <button type="button" class="md-toggle-build-btn" id="md-toggle-build-btn">🔨 Build Base (Walls • Drills • Wards)</button>
        <button type="button" class="md-btn cove-jump" data-cove="nw" data-jump="-18,-18">🌙 NW</button>
        <button type="button" class="md-btn cove-jump" data-cove="ne" data-jump="18,-18">🍄 NE</button>
        <button type="button" class="md-btn cove-jump" data-cove="sw" data-jump="-18,18">🌸 SW</button>
        <button type="button" class="md-btn cove-jump" data-cove="se" data-jump="18,18">💎 SE</button>
        <button type="button" class="md-btn cove-jump" data-jump="0,0">💎 Quarry</button>
      </div>

      <div class="md-build-banner" id="md-build-banner" hidden>
        🔨 Tap Cove tile to build! (👁️ Vision Wards work on forest trails • 💎 Drills on Veins/Quarry)
      </div>
      <div class="md-build-dock" id="md-build-dock" hidden></div>
      <div class="md-skill-modal" id="md-skill-modal" hidden></div>
      <div class="md-result-modal" id="md-result-modal" hidden></div>
    `;

    document.body.appendChild(this.root);
    this.minimapCanvas = this.root.querySelector('#md-minimap');
    this.prowlBannerEl = this.root.querySelector('#md-prowl-banner');
    this.bindDomEvents();
    this.renderBuildDock();
  }

  bindDomEvents() {
    window.addEventListener('pointermove', (e) => {
      if (!this.active || e.buttons !== 0 || !this.world?.canvas) return;
      if (e.target !== this.world.canvas) return;
      this.onPointerHover(this.world.raycastGround(e.clientX, e.clientY, true));
    });

    window.addEventListener('keydown', (e) => {
      if (!this.active) return;
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (e.code === 'Space' || e.code === 'KeyJ') {
        e.preventDefault();
        this.triggerHeroSlashAndMine();
      } else if (e.code === 'KeyB') {
        e.preventDefault();
        this.toggleBuildMode();
      } else if (e.code === 'Escape' && this.buildModeOpen) {
        e.preventDefault();
        this.toggleBuildMode(false);
      }
    });

    this.root.querySelector('#md-start-wave-btn').onclick = () => this.send({ type: 'mb_start_wave' });

    this.root.querySelector('#md-toggle-build-btn').onclick = () => {
      this.toggleBuildMode(true);
    };

    // Mini-Map Tap to Pan/Walk
    if (this.minimapCanvas) {
      this.minimapCanvas.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        const rect = this.minimapCanvas.getBoundingClientRect();
        const nx = Math.max(0, Math.min(1, (e.clientX - rect.left) / Math.max(1, rect.width)));
        const nz = Math.max(0, Math.min(1, (e.clientY - rect.top) / Math.max(1, rect.height)));
        const wx = (nx - 0.5) * (HALF_M * 2);
        const wz = (nz - 0.5) * (HALF_M * 2);
        const dest = this.clampWalkable(wx, wz);
        if (this.world) {
          this.cameraMode = 'follow';
          this.world.walkTo(dest.x, dest.z);
        }
      });
    }

    this.root.querySelectorAll('[data-jump]').forEach((btn) => {
      btn.onclick = () => {
        const coveKey = btn.dataset.cove;
        const coves = getActiveCovesMap();
        let tx = 0, tz = 0;
        if (coveKey && coves[coveKey]?.spawn) {
          tx = coves[coveKey].spawn.x;
          tz = coves[coveKey].spawn.z;
        } else {
          const [x, z] = btn.dataset.jump.split(',').map(Number);
          tx = x;
          tz = z;
        }
        const dest = this.clampWalkable(tx, tz);
        if (this.world) {
          this.cameraMode = 'follow';
          this.world.walkTo(dest.x, dest.z);
        }
      };
    });

    this.root.querySelector('#md-zoom-btn').onclick = () => {
      this.cameraMode = this.cameraMode === 'wide' ? 'follow' : 'wide';
      if (this.world) {
        this.world.camDist = this.cameraMode === 'wide' ? 38 : 24;
        this.world.followDetached = this.cameraMode === 'wide';
      }
      this.renderHud();
    };

    this.root.querySelector('#md-speed-btn').onclick = () => {
      this.send({ type: 'mb_toggle_speed' });
    };

    this.root.querySelector('#md-cashout-btn').onclick = () => this.send({ type: 'mb_cash_out' });

    this.root.querySelector('#md-exit-btn').onclick = () => {
      this.send({ type: 'table_leave' });
      this.close();
    };

    this.root.querySelector('#md-attack-btn').onclick = () => {
      this.triggerHeroSlashAndMine();
    };

    this.root.querySelector('#md-dash-btn').onclick = () => {
      const L = this.world?.local;
      L?.rig?.triggerAttack?.('dash_strike', { dur: 0.38 });
      const f = L?.rig?.facing;
      const dx = f ? (f.right ? 1 : -1) : 0;
      const dz = f ? (f.back ? -1 : 1) : 1;
      if (L && this.world) {
        const cl = this.clampWalkable(L.x + dx * 3.4, L.z + dz * 3.4);
        this.world.setLocalPosition(cl.x, cl.z);
        this.world.fx?.emit?.('fx_lightning', cl.x, 0.3, cl.z, 8, { speed: 1.4, up: 0.9, size: 0.25, life: 0.45 });
        this.send({ type: 'mb_dash', x: +cl.x.toFixed(2), z: +cl.z.toFixed(2), dx, dz });
      } else {
        this.send({ type: 'mb_dash' });
      }
    };

    this.root.querySelector('#md-ult-btn').onclick = () => {
      const L = this.world?.local;
      L?.rig?.triggerAttack?.('ground_slam', { dur: 0.65 });
      if (L) this.world?.fx?.emit?.('fx_shockwave', L.x, 0.25, L.z, 16, { ring: true, speed: 2.2, up: 0.6, size: 0.35, life: 0.75 });
      this.send({ type: 'mb_ult' });
    };

    const joyEl = this.root.querySelector('#md-joystick');
    const stickEl = this.root.querySelector('#md-joy-stick');
    const R = 34;
    const updateJoy = (e) => {
      const rect = joyEl.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = e.clientX - cx;
      let dy = e.clientY - cy;
      const len = Math.hypot(dx, dy);
      if (len > R) { dx *= R / len; dy *= R / len; }
      stickEl.style.transform = `translate(${dx}px, ${dy}px)`;
      if (this.world) {
        this.world.input.tapTarget = null;
        this.world.input.path = null;
        this.world.followDetached = false;
        this.cameraMode = 'follow';
        this.world.input.joy = { id: e.pointerId, cx, cy, x: dx / R, y: dy / R };
      }
    };
    joyEl.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      joyEl.setPointerCapture(e.pointerId);
      updateJoy(e);
    });
    joyEl.addEventListener('pointermove', (e) => {
      if (this.world?.input?.joy?.id === e.pointerId) updateJoy(e);
    });
    const endJoy = (e) => {
      if (this.world?.input?.joy?.id === e.pointerId) {
        this.world.input.joy = null;
        stickEl.style.transform = '';
      }
    };
    joyEl.addEventListener('pointerup', endJoy);
    joyEl.addEventListener('pointercancel', endJoy);
  }

  renderBuildDock() {
    const modeBar = this.root.querySelector('#md-mode-bar');
    const banner = this.root.querySelector('#md-build-banner');
    const dock = this.root.querySelector('#md-build-dock');
    if (!dock) return;

    if (!this.buildModeOpen) {
      dock.hidden = true;
      if (banner) banner.hidden = true;
      if (modeBar) modeBar.hidden = false;
      return;
    }

    if (modeBar) modeBar.hidden = true;
    if (banner) banner.hidden = false;
    dock.hidden = false;

    let html = '';
    for (const t of BUILD_TOOLS) {
      const def = MD_BUILDINGS?.[t.kind];
      const cost = def?.cost ?? t.defaultCost;
      const isAct = this.selectedTool === t.kind;
      html += `
        <button type="button" class="md-dock-btn ${isAct ? 'active' : ''}" data-tool="${t.kind}">
          <span class="ico">${t.icon}</span>
          <span class="lbl">${esc(t.label)}</span>
          <span class="cst">${cost}🪙</span>
        </button>
      `;
    }
    html += `
      <button type="button" class="md-dock-btn done-build" id="md-done-build-btn">
        <span class="ico">✅</span>
        <span class="lbl">Done Building</span>
        <span class="cst">Hide Grid</span>
      </button>
    `;
    dock.innerHTML = html;

    dock.querySelectorAll('[data-tool]').forEach((btn) => {
      btn.onclick = () => {
        const tool = btn.dataset.tool || 'wall';
        this.selectedTool = tool;
        this.selectedBuildingKey = null;
        this.syncGridHighlight();
        this.updateCursorAndRange();
        this.renderBuildDock();
        this.renderInspector();
      };
    });

    const doneBtn = dock.querySelector('#md-done-build-btn');
    if (doneBtn) {
      doneBtn.onclick = () => {
        this.toggleBuildMode(false);
      };
    }
  }

  renderHud() {
    const s = this.state || {};
    const me = this.getMyPlayer() || {};
    const wave = s.wave || 1;
    const maxWaves = s.maxWaves || 20;
    const phase = s.phase || 'prep';
    const isPrep = phase === 'prep' || phase === 'build' || phase === 'hide';
    const remSec = s.prepEndsAt
      ? Math.max(0, Math.ceil((s.prepEndsAt - Date.now()) / 1000))
      : Math.max(0, Math.ceil(Number(s.phaseTimer ?? 20)));

    this.root.querySelector('#md-wave-pill').textContent = `🌊 Wave ${wave}/${maxWaves}`;

    const phasePill = this.root.querySelector('#md-phase-pill');
    const startWaveBtn = this.root.querySelector('#md-start-wave-btn');
    if (isPrep) {
      phasePill.textContent = `⏳ Titan Awakens: ${remSec}s`;
      startWaveBtn.textContent = '⚡ Awaken Titan (+40🪙)';
      startWaveBtn.hidden = false;
    } else {
      startWaveBtn.hidden = true;
      const titan = this.getActiveTitan();
      const tLv = titan?.level || s.titanLevel || wave || 1;
      if (titan && this.isPointVisible(titan.x, titan.z, { stealthed: Boolean(titan.stealthed) })) {
        phasePill.textContent = `👹 TITAN LV.${tLv} (${Math.round(titan.hp)}/${Math.round(titan.maxHp)} HP)`;
      } else {
        phasePill.textContent = `🌫️ TITAN LV.${tLv} HUNTING IN FOG`;
      }
    }

    const shrineHp = Math.max(0, Math.round(Number(s.shrineHp ?? 1000)));
    const shrineMax = Math.max(1, Math.round(Number(s.maxShrineHp ?? s.shrineMaxHp ?? 1000)));
    this.root.querySelector('#md-shrine-fill').style.width = `${Math.min(100, (shrineHp / shrineMax) * 100)}%`;
    this.root.querySelector('#md-shrine-txt').textContent = `${shrineHp}`;

    const gold = Math.floor(Number(me.gold ?? 180));
    const income = Number(me.incomePerSec ?? me.goldPerSec ?? 3);
    const diamondsMined = Math.floor(Number(me.diamondsMined ?? me.diamonds ?? 0));
    this.root.querySelector('#md-gold-pill').textContent = `🪙 ${gold} (+${income}/s)`;
    const diaPill = this.root.querySelector('#md-diamond-pill');
    if (diaPill) diaPill.textContent = `💎 ${diamondsMined}`;

    const lv = me.level || 1;
    const xpPct = Math.min(100, Math.round(((me.xp || 0) / Math.max(1, me.xpNext || 60)) * 100));
    this.root.querySelector('#md-lv-txt').textContent = `Lv.${lv}`;
    this.root.querySelector('#md-xp-fill').style.width = `${xpPct}%`;

    const spd = s.speedMult || s.speed || 1;
    this.root.querySelector('#md-speed-btn').textContent = `⏩ ${spd}×`;
    this.root.querySelector('#md-zoom-btn').textContent = this.cameraMode === 'wide' ? '🔭 Follow' : '🔭 Zoom';

    const ultPct = Math.min(100, Math.floor(Number(me.ultCharge ?? 0)));
    const ultBtn = this.root.querySelector('#md-ult-btn');
    ultBtn.textContent = `🌈 Ult (${ultPct}%)`;
    ultBtn.disabled = ultPct < 100;
  }

  renderInspector() {
    const box = this.root.querySelector('#md-inspector');
    if (!box) return;
    if (!this.selectedBuildingKey) {
      box.hidden = true;
      return;
    }
    const b = this.getBuildingByKey(this.selectedBuildingKey);
    if (!b) {
      this.selectedBuildingKey = null;
      box.hidden = true;
      return;
    }
    const [gx, gz] = this.selectedBuildingKey.split(',').map(Number);
    const rawKind = b.buildingId || b.kind || 'wall';
    const isTower = b.kind === 'tower' || String(rawKind).startsWith('tower');
    const isMine = b.kind === 'mine' || rawKind === 'mine';
    const isDrill = b.kind === 'diamond_drill' || rawKind === 'diamond_drill';
    const isTotem = b.kind === 'totem' || rawKind === 'totem';
    const isWard = b.kind === 'ward' || rawKind === 'ward';
    const lv = Number(b.level || 1);
    const hp = Math.round(Number(b.hp ?? 200));
    const maxHp = Math.round(Number(b.maxHp ?? 200));
    const elements = Array.isArray(b.elements) && b.elements.length
      ? b.elements
      : (isTower ? [String(rawKind).replace('tower_', '')] : []);
    const fusion = isTower ? safeResolveFusion(elements) : null;
    const defaultName = isDrill
      ? 'Precious Diamond Drill'
      : isWard
        ? 'Bioluminescent Vision Ward'
        : isTotem
          ? 'Moonwell Heal Totem'
          : isMine
            ? 'Gold Mine'
            : 'Gate Wall';
    const name = b.name || fusion?.name || MD_BUILDINGS?.[rawKind]?.name || defaultName;
    const elBadges = elements.map((e) => MD_ELEMENTS?.[e]?.icon || e).join(' + ');
    const baseCost = MD_BUILDINGS?.[rawKind]?.cost || (isDrill ? 90 : isTotem ? 45 : isWard ? 30 : 40);
    const upgCost = Math.round(baseCost * 0.85 * lv);
    const sellGold = Math.round((b.investedGold || baseCost) * 0.75);

    let fuseHtml = '';
    if (isTower && elements.length < 3) {
      const elKeys = ['storm', 'water', 'fire', 'nature', 'light', 'dark'];
      fuseHtml = `
        <div class="md-fuse-row">
          <div class="md-fuse-label">✨ Element Fusion (${elements.length}/3 Elements — Evolve Guardian Costume):</div>
          <div class="md-fuse-btns">
            ${elKeys.map((el) => {
              const ed = MD_ELEMENTS?.[el] || { icon: '✨', name: el };
              const preview = safeResolveFusion([...elements, el]);
              return `
                <button type="button" class="md-fuse-btn" data-fuse="${el}">
                  +${ed.icon} 55🪙
                  <small>${esc(preview.name || ed.name)}</small>
                </button>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }

    const titleIco = isTower
      ? (elBadges || '🗼')
      : isDrill
        ? '💎'
        : isMine
          ? '⛏️'
          : isWard
            ? '👁️'
            : isTotem
              ? '💖'
              : '🧱';

    box.hidden = false;
    box.innerHTML = `
      <div class="md-insp-head">
        <div class="md-insp-title">
          <span>${titleIco}</span>
          <span>${esc(name)} • Lv.${lv}</span>
        </div>
        <button type="button" class="md-btn" data-insp="close">✕</button>
      </div>
      <div class="md-insp-stats">
        <span>❤️ HP: <b>${hp}/${maxHp}</b></span>
        ${isTower ? `<span>⚔️ DMG: <b>${Math.round(Number(b.dmg || 30))}</b></span>` : ''}
        ${isMine ? `<span>🪙 Yield: <b>+${Math.round(Number(b.goldPerSec || 4))}/s</b></span>` : ''}
        ${isDrill ? `<span>💎 Yield: <b>+${Math.round(Number(b.goldPerSec || 8))}🪙/s &amp; 💎 Diamonds</b></span>` : ''}
        ${isWard ? `<span>👁️ True Sight: <b>16.5m Fog Reveal</b></span>` : ''}
        ${isTotem ? `<span>💖 Heal Aura: <b>+${Math.round(Number(b.healPerSec || 22))}/s</b></span>` : ''}
        ${elBadges ? `<span>🔮 Elements: <b>${elBadges}</b></span>` : ''}
      </div>
      <div class="md-insp-actions">
        ${lv < 5 ? `<button type="button" class="md-btn start-wave" data-insp="upgrade">⬆️ Upgrade (${upgCost}🪙)</button>` : `<span class="md-pill">★ Max Lv.5</span>`}
        ${hp < maxHp ? `<button type="button" class="md-btn" data-insp="repair">🔧 Repair (15🪙)</button>` : ''}
        <button type="button" class="md-btn cashout" data-insp="sell">♻️ Sell (+${sellGold}🪙)</button>
      </div>
      ${fuseHtml}
    `;

    box.querySelector('[data-insp="close"]').onclick = () => {
      this.selectedBuildingKey = null;
      this.updateCursorAndRange();
      this.renderInspector();
    };
    const upgBtn = box.querySelector('[data-insp="upgrade"]');
    if (upgBtn) {
      upgBtn.onclick = () => this.send({ type: 'mb_upgrade_building', gx, gz, buildingId: b.id });
    }
    const repBtn = box.querySelector('[data-insp="repair"]');
    if (repBtn) {
      repBtn.onclick = () => this.send({ type: 'mb_repair_building', gx, gz, buildingId: b.id });
    }
    box.querySelector('[data-insp="sell"]').onclick = () => {
      this.send({ type: 'mb_sell_building', gx, gz, buildingId: b.id });
      this.selectedBuildingKey = null;
      this.updateCursorAndRange();
      this.renderInspector();
    };
    box.querySelectorAll('[data-fuse]').forEach((btn) => {
      btn.onclick = () => this.send({ type: 'mb_fuse_building', gx, gz, buildingId: b.id, element: btn.dataset.fuse });
    });
  }

  renderModals() {
    const me = this.getMyPlayer();
    const choices = me?.pendingChoices || [];
    const skillModal = this.root.querySelector('#md-skill-modal');
    if (Array.isArray(choices) && choices.length > 0 && !this.buildModeOpen && !this.selectedBuildingKey) {
      skillModal.hidden = false;
      skillModal.innerHTML = `
        <div class="md-skill-strip">
          <div class="md-skill-strip-hdr"><span>🌟 Level Up! Pick Blessing:</span></div>
          <div class="md-skill-grid">
            ${choices.map((c) => {
              const id = typeof c === 'string' ? c : c.id;
              const def = (typeof c === 'object' ? c : null) || MD_HERO_SKILLS?.[id] || { id, name: id, icon: '⚡', desc: '' };
              return `
                <button type="button" class="md-skill-choice" data-skill="${esc(id)}" title="${esc(def.desc || '')}">
                  <span style="font-size:16px">${def.icon || '✨'}</span>
                  <span style="font-weight:900;font-size:10px;color:#fde047;line-height:1.1">${esc(def.name || id)}</span>
                </button>
              `;
            }).join('')}
          </div>
        </div>
      `;
      skillModal.querySelectorAll('[data-skill]').forEach((btn) => {
        btn.onclick = () => {
          this.send({ type: 'mb_pick_skill', skillId: btn.dataset.skill });
          skillModal.hidden = true;
        };
      });
    } else {
      skillModal.hidden = true;
    }

    const resModal = this.root.querySelector('#md-result-modal');
    if (this.state?.status === 'ended') {
      const res = this.state.result || {};
      const myId = this.getProfile()?.id;
      const r = res.rewards?.[myId] || Object.values(res.rewards || {})[0] || {};
      const wavesCleared = res.clearedWaves ?? this.state.wave ?? 0;
      const droppedCharms = r.droppedCharms || me?.droppedCharms || [];
      const firstCharm = droppedCharms[0] || null;
      const charmDef = firstCharm ? (CHARMS[firstCharm.id] || firstCharm) : null;
      const reason = res.reason || this.state.outcome || 'ended';
      const outcomeTitle = reason === 'victory' || reason === 'titan_slain'
        ? '🏆 Titan Slain — Enchanted Forest Victory!'
        : reason === 'cash_out'
          ? '💰 Safe Cash-Out Complete!'
          : '🌙 Forest Sanctuary Siege Ended';

      resModal.hidden = false;
      resModal.innerHTML = `
        <div class="md-modal-card">
          <div class="md-modal-title">${outcomeTitle}</div>
          <div style="font-size:13px;color:#bae6fd;margin-bottom:12px">Waves / Hunt Stages Cleared: <b>${wavesCleared}</b></div>
          <div style="display:flex;justify-content:center;gap:10px;flex-wrap:wrap;margin-bottom:14px">
            <span class="md-pill gold">🪙 +${Number(r.gold || 0).toLocaleString()}</span>
            <span class="md-pill">🍓 +${Number(r.berries || 0).toLocaleString()}</span>
            <span class="md-pill diamond">💎 +${Number(r.diamonds || me?.diamondsMined || 0).toLocaleString()}</span>
            <span class="md-pill">✨ +${Number(r.exp || 0).toLocaleString()} EXP</span>
          </div>
          ${charmDef ? `
            <div style="padding:10px;border-radius:12px;background:rgba(250,204,21,0.15);border:1px solid #fde047;margin-bottom:14px">
              <div style="font-weight:900;color:#fde047">🎁 Boss Charm Dropped: ${charmDef.icon || '✨'} ${esc(charmDef.name)}!</div>
            </div>
          ` : ''}
          <div style="display:flex;justify-content:center;gap:10px">
            <button type="button" class="md-btn start-wave" id="md-res-again">🔄 Play Again</button>
            <button type="button" class="md-btn exit" id="md-res-exit">🏠 Exit</button>
          </div>
        </div>
      `;
      resModal.querySelector('#md-res-again').onclick = () => {
        this.send({ type: 'table_leave' });
        this.close();
      };
      resModal.querySelector('#md-res-exit').onclick = () => {
        this.send({ type: 'table_leave' });
        this.close();
      };
    } else {
      resModal.hidden = true;
    }
  }
}
