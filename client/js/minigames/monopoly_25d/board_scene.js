// client/js/minigames/monopoly_25d/board_scene.js — 2.5D Sky Monopoly diorama (Screen 10 / Plan §5 Mode 1).
//
// Owns its own THREE.Scene + camera so it can run standalone (dev page) today and plug into the shared
// WorldEngine renderer via SceneManager later (render board.scene with board.camera). Everything here is
// presentation only: the authoritative state arrives as engine events and is replayed as cutscenes
// ("State First, Cutscene Second"); syncFromMatch() reconciles to the final state after each batch.
//
// Art Pack 4A (villas / hotels / landmarks / pyramids / trap props) is not generated yet, so every building
// and trap here is a procedural low-poly placeholder with the same anchors the sprites will use.
import * as THREE from 'three';
import { FxEngine } from '../../fx_engine.js';

// Chibi rig + pet controller are loaded dynamically: other teams actively refactor them, and a broken
// import there must never take the whole board down (tokens fall back to colored pawns / no pet).
let ChibiRig = null, PetController = null;
// Art Pack 4A sprites (sliced by scripts/slice_pack_4a.js into its own manifest so the shared
// asset_manifest.json is never touched). Missing manifest/sprite → procedural low-poly fallback.
const PACK = { info: {}, tex: new Map() };
export const spritePack = Promise.all([
  fetch('/assets/monopoly/manifest_4a.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
  fetch('/assets/asset_manifest.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
]).then(([m4a, main]) => {
  PACK.info = { ...(main?.sprites || {}), ...(m4a?.sprites || {}) };
}).catch(() => {});

/** Upright billboard (anchored at its feet) or flat ground decal for a pack sprite; null if unavailable. */
function packSprite(name, height, { flat = false } = {}) {
  const info = PACK.info[name];
  if (!info) return null;
  let tex = PACK.tex.get(name);
  if (!tex) {
    tex = new THREE.TextureLoader().load(`/assets/${info.file}`);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    PACK.tex.set(name, tex);
  }
  const w = height * (info.w / info.h);
  if (flat || info.flat) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, height).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    m.position.y = 0.035;
    m.renderOrder = 2;
    return m;
  }
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, alphaTest: 0.04 }));
  sp.center.set(0.5, 0);
  sp.scale.set(w, height, 1);
  return sp;
}

const BUILDING_SPRITE = { 1: ['mono_villa', 1.0], 2: ['mono_hotel', 1.35], 3: ['mono_landmark', 1.75], 4: ['mono_pyramid', 1.45] };
const TRAP_SPRITE = {
  ice_cube: ['mono_trap_ice_cube', 1.55], torii: ['mono_trap_torii', 1.55], mirror: ['mono_trap_mirror', 1.35],
  slipper: ['mono_trap_slipper', 1.3], prison: ['mono_trap_slipper', 1.3], coral: ['mono_trap_coral', 1.15],
  lightning_rod: ['mono_trap_lightning_rod', 1.8], waterway: ['mono_trap_waterway', 1.4, true], naga_wave: ['mono_trap_waterway', 1.4, true],
  fire: ['mono_trap_fire', 1.5, true],
};

export const tokenModules = Promise.all([
  spritePack,
  import('../../chibi_rig.js').then((m) => { ChibiRig = m.ChibiRig; }).catch((e) => console.warn('[monopoly] chibi_rig unavailable:', e.message)),
  import('../../pet_controller.js').then((m) => { PetController = m.PetController; }).catch((e) => console.warn('[monopoly] pet_controller unavailable:', e.message)),
]);
import { MONO, TILES, ZONES, tileCell } from '/shared/monopoly_rules.js';
import { sfx } from './sfx.js';

export const SEAT_COLORS = ['#3d8bfd', '#ff5a7a', '#ffb020', '#2fbf71'];
export const BOARD = { TILE: 2.2, GAP: 0.1, H: 0.32, BASE_H: 1.6 };
// Camera tuned for vertical phones (iPhone SE → 18 Pro / Pro Max) and motion comfort:
//  • horizontal-FOV lock + framing by WIDTH, so every phone sees the same ~2.6 tiles in follow mode
//  • the action is centred in the free band between the top player cards and the bottom thumb zone
//  • critically-damped springs (no overshoot / bounce), capped pan speed, no roll, no FOV zoom,
//    no random shake; ground-level target so hop bobbing never moves the camera
const CAM = {
  BASE_FOV: 40, OVERVIEW_PITCH: 45, FOLLOW_PITCH: 40,
  FOLLOW_HALF_W: 3.25,         // metres visible either side of the chibi (≈90 px chibi on a 402 pt phone — 3-tile window)
  WALK_HALF_W: 3.60,           // gently widens +10% while hopping so upcoming tiles stay in view
  INWARD_X: 0.80,              // gentle pull toward board centre (replaces hard edge clamp so corner tiles stay centred)
  INWARD_Z: 0.82,
  POS_SMOOTH: 0.45,            // s — follow pan smooth time
  ZOOM_SMOOTH: 1.1,            // s — overview ↔ follow distance / pitch smooth time (slow = comfortable)
  MAX_PAN: 14,                 // m/s — caps whip-pans on warps
  LOOK_AHEAD: 0.9,             // m along the walking direction
  PET_BIAS: 0.30,              // pull the frame toward the pet so chibi + pet are both comfortably in shot
};
const REDUCED_MOTION = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Critically-damped spring (Unity SmoothDamp): frame-rate independent, never overshoots. */
function smoothDamp(cur, target, st, key, smoothTime, maxSpeed, dt) {
  const omega = 2 / Math.max(1e-4, smoothTime);
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  let change = cur - target;
  const maxChange = maxSpeed * smoothTime;
  change = Math.max(-maxChange, Math.min(maxChange, change));
  const t = cur - change;
  const v = st[key] || 0;
  const temp = (v + omega * change) * dt;
  st[key] = (v - omega * temp) * exp;
  let out = t + (change + temp) * exp;
  if ((target - cur > 0) === (out > target)) { out = target; st[key] = (out - target) / Math.max(dt, 1e-4); }
  return out;
}
const C = MONO.GRID_COLS, R = MONO.GRID_ROWS;
const W = C * BOARD.TILE, D = R * BOARD.TILE;
const SEAT_OFFSET = [[-0.50, -0.38], [0.50, -0.38], [-0.46, 0.46], [0.46, 0.46]];

export function tileWorld(i) {
  const { col, row } = tileCell(i);
  return { x: (col - (C - 1) / 2) * BOARD.TILE, z: (row - (R - 1) / 2) * BOARD.TILE };
}
/** Which texture edge faces the board centre (colour strip + building side). */
function innerSide(i) {
  const { col, row } = tileCell(i);
  if ((col === 0 || col === C - 1) && (row === 0 || row === R - 1)) return null;
  if (row === R - 1) return 'top';
  if (row === 0) return 'bottom';
  if (col === 0) return 'right';
  return 'left';
}
const INNER_DIR = { top: [0, -1], bottom: [0, 1], right: [1, 0], left: [-1, 0] };

const ease = {
  outBack: (k) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * (k - 1) ** 3 + c1 * (k - 1) ** 2; },
  inOut: (k) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2),
  out: (k) => 1 - (1 - k) ** 3,
};

// ------------------------------------------------------------------------------- textures
const EVENT_BG = { start: '#dff1ff', airdrop: '#e6f9e3', casino: '#ffe6f1', vault: '#efe6ff', warp: '#e3f2ff', arena: '#fff0dc' };
function tileTexture(i) {
  const t = TILES[i];
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = t.kind === 'property' ? '#f4f6ea' : EVENT_BG[t.kind] || '#f4f6ea';
  g.beginPath(); g.roundRect(6, 6, 244, 244, 26); g.fill();
  g.lineWidth = 5; g.strokeStyle = 'rgba(58,36,21,0.18)'; g.stroke();
  const side = innerSide(i);
  if (t.kind === 'property' && side) {
    g.fillStyle = ZONES[t.zone].color;
    const s = 44;
    g.save(); g.beginPath(); g.roundRect(6, 6, 244, 244, 26); g.clip();
    if (side === 'top') g.fillRect(0, 0, 256, s);
    if (side === 'bottom') g.fillRect(0, 256 - s, 256, s);
    if (side === 'left') g.fillRect(0, 0, s, 256);
    if (side === 'right') g.fillRect(256 - s, 0, s, 256);
    g.restore();
  }
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#3a2415';
  if (t.kind === 'property') {
    g.font = '800 34px "Nunito", system-ui, sans-serif';
    const words = t.name.split(' ');
    if (words.length > 1 && g.measureText(t.name).width > 200) { g.fillText(words[0], 128, 108); g.fillText(words.slice(1).join(' '), 128, 144); }
    else g.fillText(t.name, 128, 122);
    g.font = '800 30px "Nunito", system-ui, sans-serif'; g.fillStyle = '#7a5a10';
    g.fillText(`🪙 ${t.price}`, 128, 190);
  } else {
    g.font = '96px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
    g.fillText(t.icon, 128, 108);
    g.font = '900 30px "Nunito", system-ui, sans-serif'; g.fillStyle = '#3a2415';
    g.fillText(t.name.toUpperCase(), 128, 200);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function frameTexture(color) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  g.lineWidth = 10; g.strokeStyle = color;
  g.beginPath(); g.roundRect(6, 6, 116, 116, 14); g.stroke();
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function diceTextures() {
  const pips = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] };
  const tex = {};
  for (let v = 1; v <= 6; v++) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#fffaf0'; g.beginPath(); g.roundRect(0, 0, 128, 128, 26); g.fill();
    g.fillStyle = v === 1 ? '#e0494f' : '#3a2415';
    for (const [x, y] of pips[v]) { g.beginPath(); g.arc(64 + x * 32, 64 + y * 32, v === 1 ? 17 : 12, 0, 7); g.fill(); }
    tex[v] = new THREE.CanvasTexture(c); tex[v].colorSpace = THREE.SRGBColorSpace;
  }
  return tex;
}
// BoxGeometry material order: +x, -x, +y, -y, +z, -z → face values; rotation that brings value v to +y
const DIE_FACES = [1, 6, 2, 5, 3, 4];
const DIE_UP = { 1: [0, 0, Math.PI / 2], 6: [0, 0, -Math.PI / 2], 2: [0, 0, 0], 5: [Math.PI, 0, 0], 3: [-Math.PI / 2, 0, 0], 4: [Math.PI / 2, 0, 0] };

function cloudTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(255,248,226,0.95)';
  for (const [x, y, r] of [[70, 80, 40], [120, 60, 52], [175, 78, 40], [100, 90, 34], [150, 92, 36]]) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ------------------------------------------------------------------------------- procedural props
const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0, ...o });

function buildingMesh(level, color, variant = 'a') {
  const g = new THREE.Group();
  const def = BUILDING_SPRITE[Math.min(4, level)];
  const sp = def && packSprite(`${def[0]}_${variant}`, def[1]);
  if (sp) {
    // owner colour lives on a small base plate (roofs stay neutral until per-owner roof tinting lands)
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.06, 20), M(color));
    plate.position.y = 0.03;
    g.add(plate, sp);
    if (level >= 4) { const glow = new THREE.PointLight('#ffd34d', 0.8, 3); glow.position.y = 1.2; g.add(glow); }
    return g;
  }
  const own = M(color);
  if (level === 1) {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.45, 0.55), M('#fff8ec'));
    body.position.y = 0.225;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.52, 0.42, 4), own);
    roof.position.y = 0.66; roof.rotation.y = Math.PI / 4;
    g.add(body, roof);
  } else if (level === 2) {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.66, 1.05, 0.62), M('#fff3d6'));
    body.position.y = 0.525;
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 0.66), M('#e8b13a', { metalness: 0.4, roughness: 0.4 }));
    band.position.y = 1.0;
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.46), own);
    top.position.y = 1.13;
    for (let k = 0; k < 3; k++) { const w = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.64), M('#7ec8ff')); w.position.y = 0.3 + k * 0.25; g.add(w); }
    g.add(body, band, top);
  } else if (level === 3) {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 0.5, 10), M('#fff3d6'));
    base.position.y = 0.25;
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.9, 10), M('#fffaf0'));
    tower.position.y = 0.95;
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), M('#e8b13a', { metalness: 0.5, roughness: 0.35 }));
    dome.position.y = 1.4;
    const flag = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 0.02), own);
    flag.position.set(0.15, 1.85, 0);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.5), M('#5a3b20'));
    pole.position.y = 1.72;
    g.add(base, tower, dome, flag, pole);
  } else if (level >= 4) {
    const pyr = new THREE.Mesh(new THREE.ConeGeometry(0.78, 1.15, 4), M('#ffd34d', { metalness: 0.6, roughness: 0.25, emissive: '#7a5200', emissiveIntensity: 0.6 }));
    pyr.position.y = 0.575; pyr.rotation.y = Math.PI / 4;
    const cap = new THREE.Mesh(new THREE.OctahedronGeometry(0.14), M('#ffffff', { emissive: '#fff2a8', emissiveIntensity: 1.2 }));
    cap.position.y = 1.25;
    g.add(pyr, cap);
    g.userData.spin = cap;
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; } });
  return g;
}

function modifierProp(mod) {
  const g = new THREE.Group();
  const theme = mod.fxTheme || '';
  const def = TRAP_SPRITE[theme];
  const sp = def && packSprite(def[0], def[1], { flat: !!def[2] });
  if (sp) {
    if (def[2]) g.userData.pulse = sp;
    else sp.position.z = 0.1;
    g.add(sp);
    return g;
  }
  const add = (mesh, y = 0) => { mesh.position.y += y; g.add(mesh); return mesh; };
  if (theme === 'ice_cube') {
    add(new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.3, 1.6), M('#bfefff', { transparent: true, opacity: 0.5, roughness: 0.1, emissive: '#2a6f8f', emissiveIntensity: 0.25 })), 0.65);
  } else if (theme === 'torii') {
    const red = M('#e0352b');
    for (const x of [-0.55, 0.55]) add(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 1.3, 8), red), 0.65).position.x = x;
    add(new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 0.16), red), 1.32);
    add(new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.08, 0.12), red), 1.1);
  } else if (theme === 'mirror') {
    add(new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.2, 0.08), M('#e8b13a', { metalness: 0.7, roughness: 0.3 })), 0.75);
    add(new THREE.Mesh(new THREE.PlaneGeometry(0.72, 1.0), M('#dfe9ff', { metalness: 1, roughness: 0.05 })), 0.75).position.z = 0.05;
  } else if (theme === 'waterway' || theme === 'naga_wave') {
    const m = add(new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.9), M('#47b6ff', { transparent: true, opacity: 0.65, emissive: '#0a4f80', emissiveIntensity: 0.4 })), 0.04);
    m.rotation.x = -Math.PI / 2; g.userData.pulse = m;
  } else if (theme === 'fire') {
    for (const [x, z] of [[-0.4, -0.3], [0.35, 0.1], [-0.1, 0.45]]) { const f = add(new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.45, 7), M('#ff7a1a', { emissive: '#ff4d00', emissiveIntensity: 0.9 })), 0.22); f.position.x = x; f.position.z = z; }
    g.userData.flicker = true;
  } else if (theme === 'slipper' || theme === 'prison') {
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 1.3, 16, 1, true), M('#cfe9ff', { transparent: true, opacity: 0.4, side: THREE.DoubleSide, roughness: 0.05 })), 0.65);
  } else if (theme === 'coral') {
    for (let k = 0; k < 5; k++) { const s = add(new THREE.Mesh(new THREE.SphereGeometry(0.16 + (k % 2) * 0.06, 10, 8), M('#ff8fb1')), 0.15); s.position.x = Math.cos(k * 1.3) * 0.55; s.position.z = Math.sin(k * 1.3) * 0.55; }
  } else if (theme === 'ruins') {
    for (const x of [-0.5, 0.45]) add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.5 + Math.abs(x) * 0.4, 8), M('#9aa3ad')), 0.3).position.x = x;
    const p = add(new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.9), M('#2a4a6a', { transparent: true, opacity: 0.45 })), 0.035); p.rotation.x = -Math.PI / 2;
  } else if (theme === 'midas') {
    const p = add(new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.9), M('#ffd34d', { transparent: true, opacity: 0.55, emissive: '#b88a00', emissiveIntensity: 0.8 })), 0.04); p.rotation.x = -Math.PI / 2; g.userData.pulse = p;
  } else if (theme === 'lightning_rod') {
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 1.8, 6), M('#c9c9c9', { metalness: 0.8 })), 0.9).position.x = -0.6;
    add(new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), M('#ffe35a', { emissive: '#ffcc00', emissiveIntensity: 1 })), 1.85).position.x = -0.6;
  } else if (theme === 'chips') {
    const cols = ['#e0494f', '#2b2b2b', '#2fbf71'];
    for (let k = 0; k < 6; k++) { const ch = add(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.05, 16), M(cols[k % 3])), 0.03 + k * 0.055); ch.position.x = -0.55; }
  } else {
    const ring = add(new THREE.Mesh(new THREE.RingGeometry(0.75, 0.92, 32), M('#c78bff', { emissive: '#7a3cff', emissiveIntensity: 0.8, transparent: true, opacity: 0.8 })), 0.05);
    ring.rotation.x = -Math.PI / 2; g.userData.pulse = ring;
  }
  return g;
}

function centerDecorSprites() {
  if (!PACK.info.mono_dec_fountain && !PACK.info.wnd_fountain) return null;
  const g = new THREE.Group();
  const put = (name, h, x, z) => { const sp = packSprite(name, h); if (sp) { sp.position.set(x, 0, z); g.add(sp); } };
  put(PACK.info.bld_shrine ? 'bld_shrine' : 'mono_dec_shrine', 2.5, 1.3, -3.5);
  put(PACK.info.wnd_fountain ? 'wnd_fountain' : 'mono_dec_fountain', 2.35, -1.5, -0.6);
  put(PACK.info.dec_boba_stand ? 'dec_boba_stand' : 'mono_dec_boba', 2.05, 1.9, 1.8);
  put('env_tree_oak_a', 2.2, -3.1, -3.2);
  put('env_tree_sakura_a', 2.1, 2.9, -0.7);
  put('env_tree_sakura_b', 2.0, -2.7, 3.3);
  put('env_tree_oak_b', 2.05, 0.2, 4.5);
  put('env_bush_mixed_large', 1.15, -0.2, -2.2);
  put('env_bush_roses_pink', 1.05, -2.2, 1.1);
  put('env_streetlamp_iron', 1.35, -0.2, 1.2);
  put('env_streetlamp_iron', 1.35, 0.1, -1.8);
  for (const [x, z] of [[-2.8, 5.6], [2.8, 5.6], [-2.8, -5.6], [2.8, -5.6]]) {
    put(PACK.info.env_fence_wood_stone_straight ? 'env_fence_wood_stone_straight' : 'mono_dec_hedge', 0.95, x, z);
  }
  const gate = packSprite('mono_dec_start_gate', 2.2);
  if (gate) { const { x, z } = tileWorld(0); gate.position.set(x + 1.0, 0, z + 0.9); g.add(gate); }
  return g;
}

function centerDecor() {
  const g = new THREE.Group();
  // winged fountain
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.2, 0.35, 24), M('#f1e3c8'));
  basin.position.set(-1.6, 0.18, -1.2);
  const water = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.05, 24), M('#7fd3ff', { emissive: '#1d6f9f', emissiveIntensity: 0.3 }));
  water.position.set(-1.6, 0.36, -1.2);
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.9, 12), M('#f1e3c8'));
  col.position.set(-1.6, 0.8, -1.2);
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 10), M('#ffd34d', { metalness: 0.5, roughness: 0.3 }));
  orb.position.set(-1.6, 1.35, -1.2);
  for (const s of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.9, 4), M('#ffd34d', { metalness: 0.5, roughness: 0.3 }));
    wing.position.set(-1.6 + s * 0.42, 1.45, -1.2); wing.rotation.z = -s * 1.0;
    g.add(wing);
  }
  // shrine
  const shrine = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.9, 1.0), M('#fff3e0'));
  shrine.position.set(1.4, 0.45, -3.2);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.15, 0.6, 4), M('#6b3a2a'));
  roof.position.set(1.4, 1.2, -3.2); roof.rotation.y = Math.PI / 4;
  // cat boba stand
  const stand = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 0.9), M('#ffc2d6'));
  stand.position.set(2.0, 0.45, 1.4);
  const awning = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.12, 1.05), M('#ff7aa8'));
  awning.position.set(2.0, 1.0, 1.4);
  g.add(basin, water, col, orb, shrine, roof, stand, awning);
  // hedges + trees
  const hedge = M('#4fae4a');
  for (const [x, z, w] of [[-3.3, 3.6, 2.2], [3.3, 3.6, 2.2], [-3.3, -5.0, 2.2], [3.3, -5.4, 2.2]]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(w, 0.45, 0.55), hedge); h.position.set(x, 0.22, z); g.add(h);
  }
  for (const [x, z] of [[-2.8, 0.8], [0.4, -5.0], [-0.6, 4.2], [2.9, -1.2]]) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.5, 6), M('#7a4b2a')); trunk.position.set(x, 0.25, z);
    const crown = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), M('#ffb3cf')); crown.position.set(x, 0.85, z);
    g.add(trunk, crown);
  }
  g.userData.spin = orb;
  return g;
}

// ------------------------------------------------------------------------------- scene
export class MonopolyBoard {
  /**
   * @param {object} o
   * @param {THREE.WebGLRenderer} o.renderer  only used for sizing / anisotropy
   * @param {(text, x, y, z, opts) => void} [o.onFloat]  DOM floating text hook (HUD)
   */
  constructor({ renderer, onFloat = null } = {}) {
    this.renderer = renderer;
    this.onFloat = onFloat;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#8fd6ff');
    this.camera = new THREE.PerspectiveCamera(CAM.BASE_FOV, 1, 0.5, 300);
    this.camMode = 'overview';          // 'overview' | 'follow'
    this.camForced = null;              // user toggle overrides auto
    this.camTarget = new THREE.Vector3();
    this.camPitch = THREE.MathUtils.degToRad(CAM.OVERVIEW_PITCH);
    this.camDist = 40;
    this.followSeat = null;
    this.tweens = [];
    this.tokens = [];
    this.tileGroups = [];
    this.buildings = new Map();
    this.props = new Map();
    this.frames = new Map();
    this.state = null;
    this.clock = new THREE.Clock();
    this.t = 0;

    this.scene.add(new THREE.HemisphereLight('#ffffff', '#88a', 1.6));
    const sun = new THREE.DirectionalLight('#fff4e0', 1.5);
    sun.position.set(-8, 20, 12);
    this.scene.add(sun);

    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.fx = new FxEngine(this.scene);
    this.buildBoard();
    this.buildClouds();
    this.buildDice();
    this.frameTex = SEAT_COLORS.map(frameTexture);
    this.resize();
    this.camDist = this.overviewDist;
    this.camPitch = THREE.MathUtils.degToRad(CAM.OVERVIEW_PITCH);
  }

  buildBoard() {
    const S = BOARD.TILE;
    const mergePlanes = (geos) => {
      const out = new THREE.BufferGeometry();
      const pos = [], norm = [], uv = [], idx = [];
      let vOff = 0;
      for (const g of geos) {
        const p = g.attributes.position.array, n = g.attributes.normal.array, u = g.attributes.uv.array, ix = g.index.array;
        for (let i = 0; i < p.length; i++) pos.push(p[i]);
        for (let i = 0; i < n.length; i++) norm.push(n[i]);
        for (let i = 0; i < u.length; i++) uv.push(u[i]);
        for (let i = 0; i < ix.length; i++) idx.push(ix[i] + vOff);
        vOff += g.attributes.position.count;
        g.dispose();
      }
      out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      out.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
      out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      out.setIndex(idx);
      return out;
    };

    // floating slab: 2.5D sunlit meadow grass top + merged static 2.5D cliff & overhanging grass rim (2 draw calls total, zero Z-fighting)
    const topMat = M('#b9c54f');
    const loader = new THREE.TextureLoader();
    loader.load('/assets/terrain/ground_classic.png', (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(3, 4);
      topMat.map = tex;
      topMat.color.set('#ffffff');
      topMat.needsUpdate = true;
    });
    const topFloor = new THREE.Mesh(new THREE.PlaneGeometry(W + 0.5, D + 0.5).rotateX(-Math.PI / 2), topMat);
    topFloor.position.y = -BOARD.H;
    topFloor.matrixAutoUpdate = false;
    topFloor.updateMatrix();
    this.root.add(topFloor);

    const cliffLoader = new THREE.TextureLoader();
    cliffLoader.load('/assets/village/cliff_wall_strip.png', (wallTex) => {
      wallTex.colorSpace = THREE.SRGBColorSpace;
      // 1 single non-overlapping quad (2 triangles total) in opaque cutout pass = zero Z-fighting, zero CPU sort
      const wallMat = new THREE.MeshBasicMaterial({ map: wallTex, transparent: false, alphaTest: 0.35, side: THREE.FrontSide });
      const wallGeo = new THREE.PlaneGeometry(W + 1.1, 2.75).rotateX(-0.06);
      const wallMesh = new THREE.Mesh(wallGeo, wallMat);
      wallMesh.position.set(0, -BOARD.H - 1.22, D / 2 + 0.52);
      wallMesh.matrixAutoUpdate = false;
      wallMesh.updateMatrix();
      this.root.add(wallMesh);
    });
    cliffLoader.load('/assets/village/cliff_rim_turf_strip.png', (rimTex) => {
      rimTex.colorSpace = THREE.SRGBColorSpace;
      // 1 single merged geometry (8 triangles total) with depthWrite: false below the 3D tile bases = zero flashing
      const rimMat = new THREE.MeshBasicMaterial({ map: rimTex, transparent: true, alphaTest: 0.02, depthWrite: false, side: THREE.FrontSide });
      const rimGeos = [
        new THREE.PlaneGeometry(W + 1.1, 1.35).rotateX(-Math.PI / 2).translate(0, -BOARD.H + 0.010, D / 2 + 0.35),
        new THREE.PlaneGeometry(W + 1.1, 1.35).rotateX(-Math.PI / 2).rotateY(Math.PI).translate(0, -BOARD.H + 0.010, -(D / 2 + 0.35)),
        new THREE.PlaneGeometry(D + 1.1, 1.35).rotateX(-Math.PI / 2).rotateY(Math.PI / 2).translate(W / 2 + 0.35, -BOARD.H + 0.004, 0),
        new THREE.PlaneGeometry(D + 1.1, 1.35).rotateX(-Math.PI / 2).rotateY(-Math.PI / 2).translate(-(W / 2 + 0.35), -BOARD.H + 0.004, 0),
      ];
      const rimMesh = new THREE.Mesh(mergePlanes(rimGeos), rimMat);
      rimMesh.renderOrder = 1;
      rimMesh.matrixAutoUpdate = false;
      rimMesh.updateMatrix();
      this.root.add(rimMesh);
    });
    this.decor = centerDecor();
    this.root.add(this.decor);
    spritePack.then(() => {                     // swap procedural placeholders for Art Pack 4A + 2.5D Village Kit
      const art = centerDecorSprites();
      if (!art) return;
      this.root.remove(this.decor);
      this.decor = art;
      this.root.add(art);
    });

    const shape = new THREE.Shape();
    const h = (S - BOARD.GAP) / 2, r = 0.22;
    shape.moveTo(-h + r, -h); shape.lineTo(h - r, -h); shape.quadraticCurveTo(h, -h, h, -h + r);
    shape.lineTo(h, h - r); shape.quadraticCurveTo(h, h, h - r, h); shape.lineTo(-h + r, h);
    shape.quadraticCurveTo(-h, h, -h, h - r); shape.lineTo(-h, -h + r); shape.quadraticCurveTo(-h, -h, -h + r, -h);
    // Keep tile top at y=0.000 (below face at y=0.012) and bottom at y=-0.260 (strictly above rimMesh -0.310 & topFloor -0.320)
    const body = new THREE.ExtrudeGeometry(shape, { depth: BOARD.H - 0.14, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2, curveSegments: 4 });
    body.rotateX(-Math.PI / 2);
    body.translate(0, -BOARD.H + 0.10, 0);
    const top = new THREE.PlaneGeometry(S - BOARD.GAP, S - BOARD.GAP).rotateX(-Math.PI / 2);

    for (const t of TILES) {
      const g = new THREE.Group();
      const { x, z } = tileWorld(t.i);
      g.position.set(x, 0, z);
      const sideColor = t.kind === 'property' ? '#d9e4cf' : '#cfe0ee';
      const bodyMesh = new THREE.Mesh(body, M(sideColor));
      bodyMesh.matrixAutoUpdate = false;
      bodyMesh.updateMatrix();
      g.add(bodyMesh);
      const face = new THREE.Mesh(top, new THREE.MeshBasicMaterial({ map: tileTexture(t.i), transparent: true, depthWrite: false }));
      face.position.y = 0.012;
      face.renderOrder = 1;
      face.matrixAutoUpdate = false;
      face.updateMatrix();
      g.add(face);
      g.userData = { i: t.i, press: 0 };
      this.root.add(g);
      this.tileGroups.push(g);
    }
  }

  buildClouds() {
    const tex = cloudTexture();
    for (let k = 0; k < 14; k++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.95 }));
      const a = (k / 14) * Math.PI * 2;
      s.position.set(Math.cos(a) * (W * 0.9 + (k % 3) * 2), -3 - (k % 4), Math.sin(a) * (D * 0.75 + (k % 2) * 3));
      s.scale.set(9 + (k % 3) * 3, 4.5 + (k % 2) * 1.5, 1);
      s.userData.speed = 0.15 + (k % 5) * 0.05;
      this.scene.add(s);
    }
  }

  buildDice() {
    const tex = diceTextures();
    const mats = DIE_FACES.map((v) => new THREE.MeshStandardMaterial({ map: tex[v], roughness: 0.5 }));
    this.dice = [0, 1].map(() => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.85, 0.85), mats);
      m.visible = false;
      this.scene.add(m);
      return m;
    });
  }

  // ----------------------------------------------------------------------------- tokens
  /** (Re)creates player tokens from a match snapshot. */
  setPlayers(players) {
    for (const tk of this.tokens) this.disposeToken(tk);
    this.tokens = players.map((p) => this.makeToken(p));
    this.layoutTokens(true);
  }

  makeToken(p) {
    const color = SEAT_COLORS[p.seat % 4];
    const tk = { seat: p.seat, x: 0, z: 0, vx: 0, vz: 0, moving: false, idleFor: 1, rig: null, pet: null, pawn: null, bankrupt: false };
    try {
      if (!ChibiRig) throw new Error('rig module not loaded');
      tk.rig = new ChibiRig({ lineage: p.lineage || 'bkk', name: p.name, sub: `P${p.seat + 1}`, wings: p.equipped?.wings?.id || null });
      tk.rig.setEquipment(p.equipped || { outfit: { id: p.outfit || 'newbie_outfit', refine: 0 } });
      this.scene.add(tk.rig.ROOT);
    } catch (e) {
      if (ChibiRig) console.warn('[monopoly] chibi rig failed, using pawn', e);
      tk.rig = null;
    }
    if (!tk.rig) {
      tk.pawn = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.5, 4, 10), M(color));
      body.position.y = 0.55;
      tk.pawn.add(body);
      this.scene.add(tk.pawn);
    }
    if (p.petId && PetController) {
      try { tk.pet = new PetController(p.petId, this.scene, this.fx); } catch { tk.pet = null; }
    }
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.46, 28), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    this.scene.add(ring);
    tk.ring = ring;
    return tk;
  }

  disposeToken(tk) {
    if (tk.rig) { this.scene.remove(tk.rig.ROOT); tk.rig.dispose?.(); }
    if (tk.pawn) this.scene.remove(tk.pawn);
    tk.pet?.dispose?.(this.scene);
    this.scene.remove(tk.ring);
  }

  seatSpot(seat, pos) {
    const { x, z } = tileWorld(pos);
    const crowd = this.state ? this.state.players.filter((p) => !p.bankrupt && p.pos === pos).length : 1;
    if (crowd <= 1) return { x, z: z + 0.15 };
    const [ox, oz] = SEAT_OFFSET[seat % 4];
    return { x: x + ox, z: z + oz };
  }

  placeToken(tk, x, z) {
    tk.x = x; tk.z = z;
    if (tk.rig) tk.rig.setPosition(x, z);
    if (tk.pawn) tk.pawn.position.set(x, 0, z);
    tk.ring.position.set(x, 0.03, z);
  }

  layoutTokens(snap = false) {
    if (!this.state) return;
    for (const tk of this.tokens) {
      const p = this.state.players[tk.seat];
      if (!p) continue;
      const s = this.seatSpot(tk.seat, p.pos);
      if (snap) { this.placeToken(tk, s.x, s.z); tk.pet?.placeNear({ x: s.x, z: s.z, right: true }); }
      else this.slideToken(tk, s.x, s.z, 0.25);
    }
  }

  slideToken(tk, x, z, dur) {
    const x0 = tk.x, z0 = tk.z;
    if (Math.hypot(x - x0, z - z0) < 0.01) return Promise.resolve();
    return this.tween(dur, (k) => { const e = ease.inOut(k); this.placeToken(tk, x0 + (x - x0) * e, z0 + (z - z0) * e); tk.vx = (x - x0) / dur; tk.vz = (z - z0) / dur; tk.moving = k < 1; });
  }

  // ----------------------------------------------------------------------------- state sync
  /** Reconcile every visual to the authoritative match (owners, levels, traps, positions). */
  syncFromMatch(m, { snap = false } = {}) {
    const first = !this.state || this.tokens.length !== m.players.length;
    this.state = m;
    if (first) this.setPlayers(m.players);
    m.tiles.forEach((t, i) => {
      this.setOwner(i, t.owner, { animate: false });
      this.setLevel(i, t.owner, t.level, { animate: false });
      this.setModifier(i, t.modifier, { animate: false });
    });
    for (const tk of this.tokens) {
      const p = m.players[tk.seat];
      if (p?.bankrupt && !tk.bankrupt) this.markBankrupt(tk);
    }
    this.layoutTokens(snap || first);
  }

  setOwner(i, owner, { animate = true } = {}) {
    const cur = this.frames.get(i);
    if (cur?.userData.owner === owner) return;
    if (cur) { this.tileGroups[i].remove(cur); this.frames.delete(i); }
    if (owner == null) return;
    const f = new THREE.Mesh(new THREE.PlaneGeometry(BOARD.TILE - BOARD.GAP, BOARD.TILE - BOARD.GAP).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: this.frameTex[owner % 4], transparent: true, depthWrite: false }));
    f.position.y = 0.02;
    f.userData.owner = owner;
    this.tileGroups[i].add(f);
    this.frames.set(i, f);
    if (animate) this.tween(0.35, (k) => f.scale.setScalar(0.6 + 0.4 * ease.outBack(k)));
  }

  setLevel(i, owner, level, { animate = true } = {}) {
    const key = `${owner}:${level}`;
    const cur = this.buildings.get(i);
    if (cur?.userData.key === key) return;
    if (cur) { this.tileGroups[i].remove(cur); this.buildings.delete(i); }
    if (owner == null || level <= 0) return;
    const b = buildingMesh(level, SEAT_COLORS[owner % 4], owner % 2 ? 'b' : 'a');
    const side = innerSide(i);
    const [dx, dz] = side ? INNER_DIR[side] : [0, 0];
    b.position.set(dx * 0.55, 0.02, dz * 0.55);
    b.userData.key = key;
    this.tileGroups[i].add(b);
    this.buildings.set(i, b);
    if (animate) {
      b.scale.setScalar(0.01);
      this.tween(0.5, (k) => b.scale.setScalar(Math.max(0.01, ease.outBack(k))));
      const { x, z } = tileWorld(i);
      this.fx.emit('fx_stardust', x, 0.6, z, 14, { speed: 1.6, up: 2, size: 0.32, life: 0.8, gravity: 2 });
    }
  }

  setModifier(i, mod, { animate = true } = {}) {
    const key = mod ? `${mod.id}:${mod.fxTheme}:${mod.owner}` : null;
    const cur = this.props.get(i);
    if ((cur?.userData.key ?? null) === key) return;
    if (cur) { this.tileGroups[i].remove(cur); this.props.delete(i); }
    if (!mod) return;
    const p = modifierProp(mod);
    p.userData.key = key;
    this.tileGroups[i].add(p);
    this.props.set(i, p);
    if (animate) {
      p.scale.setScalar(0.01);
      this.tween(0.45, (k) => p.scale.setScalar(Math.max(0.01, ease.outBack(k))));
    }
  }

  markBankrupt(tk) {
    tk.bankrupt = true;
    const fade = (o) => o.traverse?.((q) => { if (q.material) { q.material = q.material.clone(); q.material.transparent = true; q.material.opacity = 0.35; } });
    if (tk.rig) fade(tk.rig.ROOT);
    if (tk.pawn) fade(tk.pawn);
    tk.ring.visible = false;
  }

  // ----------------------------------------------------------------------------- tweens
  tween(dur, fn) {
    return new Promise((resolve) => { this.tweens.push({ t: 0, dur: Math.max(0.001, dur), fn, resolve }); });
  }
  wait(sec) { return this.tween(sec, () => {}); }

  pressTile(i) {
    const g = this.tileGroups[i];
    if (!g) return;
    this.tween(0.22, (k) => { g.position.y = -0.05 * Math.sin(k * Math.PI); });
  }

  float(text, i, opts = {}) {
    if (!this.onFloat) return;
    const { x, z } = typeof i === 'number' ? tileWorld(i) : i;
    this.onFloat(text, this.toScreen(x, opts.y ?? 1.9, z), opts);
  }

  toScreen(x, y, z) {
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    const el = this.renderer.domElement;
    const r = el.getBoundingClientRect();
    return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height };
  }

  tokenScreen(seat, y = 2.1) {
    const tk = this.tokens[seat];
    return tk ? this.toScreen(tk.x, y, tk.z) : null;
  }

  // ----------------------------------------------------------------------------- cutscenes
  async rollDice(seat, dice) {
    sfx.dice();
    const tk = this.tokens[seat];
    const cx = tk ? tk.x : 0, cz = tk ? tk.z : 0;
    const shown = this.dice.slice(0, dice.length);
    shown.forEach((d, k) => { d.visible = true; d.scale.setScalar(1); d.position.set(cx + (k - (dice.length - 1) / 2) * 1.1, 4.5, cz - 1.2); });
    const spin = shown.map(() => [Math.random() * 10 + 6, Math.random() * 10 + 6, Math.random() * 10 + 6]);
    await this.tween(0.7, (k) => {
      shown.forEach((d, j) => {
        const e = ease.out(k);
        d.position.y = 4.5 - 3.6 * e + Math.abs(Math.sin(k * Math.PI * 2.5)) * 0.6 * (1 - k);
        const [ax, ay, az] = DIE_UP[dice[j]];
        d.rotation.set(ax + spin[j][0] * (1 - e), ay + spin[j][1] * (1 - e), az + spin[j][2] * (1 - e));
      });
    });
    await this.wait(0.35);
    await this.tween(0.15, (k) => shown.forEach((d) => d.scale.setScalar(1 - k)));
    shown.forEach((d) => { d.visible = false; });
  }

  async moveToken(seat, path, kind) {
    const tk = this.tokens[seat];
    if (!tk || !path?.length) return;
    this.followSeat = seat;
    if (kind === 'warp') {
      this.fx.emit('fx_magic_circle', tk.x, 0.3, tk.z, 6, { speed: 1.2, up: 1.4, size: 0.5, life: 0.6 });
      await this.tween(0.25, (k) => { const s = 1 - k; tk.rig?.ROOT.scale.setScalar(Math.max(0.01, s)); tk.pawn?.scale.setScalar(Math.max(0.01, s)); });
      const dest = tileWorld(path[path.length - 1]);
      this.placeToken(tk, dest.x, dest.z + 0.15);
      tk.pet?.placeNear({ x: dest.x, z: dest.z, right: true });
      this.fx.emit('fx_stardust', dest.x, 0.3, dest.z, 14, { speed: 1.5, up: 1.8, size: 0.4, life: 0.7 });
      await this.tween(0.3, (k) => { const s = ease.outBack(k); tk.rig?.ROOT.scale.setScalar(Math.max(0.01, s)); tk.pawn?.scale.setScalar(Math.max(0.01, s)); });
      sfx.step(7);
      this.pressTile(path[path.length - 1]);
      return;
    }
    const hopDur = kind === 'walk' ? 0.26 : 0.2;
    for (let n = 0; n < path.length; n++) {
      const to = tileWorld(path[n]);
      const x0 = tk.x, z0 = tk.z, x1 = to.x, z1 = to.z + 0.15;
      const vx = (x1 - x0) / hopDur, vz = (z1 - z0) / hopDur;
      await this.tween(hopDur, (k) => {
        const e = ease.inOut(k);
        this.placeToken(tk, x0 + (x1 - x0) * e, z0 + (z1 - z0) * e);
        const hop = Math.sin(k * Math.PI) * (kind === 'walk' ? 0.42 : 0.25);
        if (tk.rig) tk.rig.ROOT.position.y = hop;
        if (tk.pawn) tk.pawn.position.y = hop;
        tk.vx = vx; tk.vz = vz; tk.moving = true;
      });
      if (tk.rig) tk.rig.ROOT.position.y = 0;
      sfx.step(n);
      this.pressTile(path[n]);
      if (kind === 'push') this.fx.emit('fx_bubble', tk.x, 0.2, tk.z, 4, { speed: 0.8, up: 1, size: 0.3, life: 0.6, tint: [0.5, 0.85, 1] });
      else if (kind === 'pull') this.fx.emit('fx_stardust', tk.x, 0.2, tk.z, 3, { speed: 0.6, up: 0.8, size: 0.3, life: 0.6, tint: [0.75, 0.5, 1] });
      else this.fx.emit('fx_stardust', tk.x, 0.05, tk.z, 2, { speed: 0.4, up: 0.5, size: 0.22, life: 0.45, gravity: 0.6 });
    }
    tk.moving = false; tk.vx = 0; tk.vz = 0;
  }

  coins(fromSeat, toSeat, amount) {
    const a = fromSeat == null ? null : this.tokens[fromSeat];
    const b = toSeat == null ? null : this.tokens[toSeat];
    if (a) this.fx.emit('fx_chip', a.x, 1.0, a.z, Math.min(14, 3 + Math.floor(amount / 120)), { speed: 1.4, up: 2.4, size: 0.3, life: 0.8, gravity: 3, tint: [1, 0.85, 0.3] });
    if (b) this.fx.emit('fx_star', b.x, 1.2, b.z, Math.min(14, 3 + Math.floor(amount / 120)), { speed: 1.2, up: 2.2, size: 0.3, life: 0.8, gravity: 2, tint: [1, 0.9, 0.4] });
  }

  /** 6 procedural ultimate archetypes (Plan §5 "3-Ingredient Mythic Ultimate VFX") — mobile-optimized. */
  async ultVfx(seat, vfx) {
    const tk = this.tokens[seat];
    const x = tk?.x ?? 0, z = tk?.z ?? 0;
    sfx.ult();
    this._activeUlts = (this._activeUlts || 0) + 1;
    const pScale = this._activeUlts > 1 ? 0.55 : 1;
    const g = new THREE.Group();
    this.scene.add(g);
    const glow = (color, o = {}) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.FrontSide, ...o });
    try {
      if (vfx === 'pillar') {
        const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.9, 30, 16, 1, true), glow('#fff2a8'));
        beam.position.set(x, 15, z); g.add(beam);
        await this.tween(0.9, (k) => { beam.scale.set(1 + k, 1, 1 + k); beam.material.opacity = 0.85 * (1 - k); this.shake = 0.25 * (1 - k); });
        this.fx.emit('fx_lightning', x, 1, z, Math.round(20 * pScale), { speed: 3, up: 3, size: 0.5, life: 0.7, gravity: 1 });
      } else if (vfx === 'crystal') {
        const cube = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 0), glow('#bff3ff', { opacity: 0.6 }));
        cube.position.set(x, 0.8, z); g.add(cube);
        await this.tween(0.8, (k) => { cube.scale.setScalar(ease.outBack(Math.min(1, k * 1.4))); cube.rotation.y = k * 3; cube.material.opacity = 0.6 * (1 - k * 0.8); });
        this.fx.emit('fx_snowflake', x, 1, z, Math.round(24 * pScale), { speed: 2.5, up: 2.5, size: 0.4, life: 0.9, gravity: 1.5 });
      } else if (vfx === 'wave') {
        const wave = new THREE.Mesh(new THREE.BoxGeometry(W + 2, 1.2, 1.2), glow('#47b6ff', { opacity: 0.55 }));
        g.add(wave);
        await this.tween(1.0, (k) => { wave.position.set(0, 0.6, D / 2 + 1 - (D + 2) * ease.inOut(k)); });
        this.fx.emit('fx_bubble', x, 0.5, z, Math.round(20 * pScale), { speed: 2, up: 2, size: 0.4, life: 0.8 });
      } else if (vfx === 'vortex') {
        const disc = new THREE.Mesh(new THREE.RingGeometry(0.3, 4.5, 36, 1), glow('#8a5bff', { opacity: 0.55 }));
        disc.rotation.x = -Math.PI / 2; disc.position.set(0, 0.15, 0); g.add(disc);
        await this.tween(1.0, (k) => { disc.rotation.z = k * 8; disc.scale.setScalar(1 - 0.5 * k); disc.material.opacity = 0.6 * (1 - k * 0.7); });
        this.fx.emit('fx_stardust', 0, 0.5, 0, Math.round(26 * pScale), { speed: 3, up: 1.5, size: 0.4, life: 0.8, tint: [0.75, 0.5, 1] });
      } else if (vfx === 'projectile') {
        const ballGeo = new THREE.SphereGeometry(0.3, 10, 8);
        const ballMat = glow('#ff8a2a', { opacity: 1 });
        const balls = [0, 1, 2].map(() => { const b = new THREE.Mesh(ballGeo, ballMat); g.add(b); return b; });
        await this.tween(0.9, (k) => balls.forEach((b, j) => { const tx = x - 2 + j * 2, tz = z - 3; b.position.set(x + (tx - x) * k, 1.5 + Math.sin(k * Math.PI) * 3, z + (tz - z) * k); }));
        this.fx.emit('fx_flame', x, 0.5, z - 3, Math.round(22 * pScale), { speed: 2.5, up: 2, size: 0.45, life: 0.7 });
      } else {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.12, 28), M('#e8b13a', { metalness: 0.6, roughness: 0.3 }));
        wheel.position.set(0, 0.2, 0); g.add(wheel);
        await this.tween(1.0, (k) => { wheel.rotation.y = k * 12; wheel.position.y = 0.2 + Math.sin(k * Math.PI) * 1.2; });
        this.fx.emit('fx_chip', 0, 1, 0, Math.round(30 * pScale), { speed: 3, up: 3, size: 0.4, life: 0.9, gravity: 3 });
      }
    } finally {
      this._activeUlts = Math.max(0, (this._activeUlts || 1) - 1);
      this.shake = 0;
      this.scene.remove(g);
      g.traverse((o) => {
        o.geometry?.dispose?.();
        if (o.material) [].concat(o.material).forEach((m) => m.dispose?.());
      });
    }
  }

  // ----------------------------------------------------------------------------- camera
  setCamMode(mode) { this.camForced = mode; }
  get effectiveCam() { return this.camForced || this.camMode; }

  /** Free screen band (CSS px from the top / bottom of the canvas) between HUD layers; the action is centred in it. */
  setSafeBand(topPx = 0, bottomPx = 0) {
    this.safe = { top: Math.max(0, topPx), bottom: Math.max(0, bottomPx) };
    this.resize();
  }

  resize() {
    const el = this.renderer.domElement;
    const w = el.clientWidth || window.innerWidth, h = el.clientHeight || window.innerHeight;
    const aspect = w / h;
    this.camera.aspect = aspect;
    const base = THREE.MathUtils.degToRad(CAM.BASE_FOV);
    this.camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(base / 2) / Math.min(aspect / 0.5625, 1)));
    this.camera.updateProjectionMatrix();
    // off-axis lens shift: the look-at point lands in the middle of the free band, not under the HUD
    const { top = 0, bottom = 0 } = this.safe || {};
    const bandCenterY = top + (h - top - bottom) / 2;
    const ndcY = 1 - (2 * bandCenterY) / h;
    this.camera.projectionMatrix.elements[9] = -ndcY;
    this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();
    const bandFrac = Math.max(0.35, (h - top - bottom) / h);
    const tanH = Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2) * aspect;
    const tanV = Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2);
    this.tanH = tanH; this.tanV = tanV; this.bandFrac = bandFrac;
    // overview: fit the whole board inside the band (width and depth), near edge sits closer to the lens
    const p = THREE.MathUtils.degToRad(CAM.OVERVIEW_PITCH);
    const fitW = (W / 2 + 0.7) / tanH + (D / 2) * Math.cos(p);
    const fitD = ((D / 2) * Math.sin(p) + 0.8) / (tanV * bandFrac) + (D / 2) * Math.cos(p);
    this.overviewDist = Math.max(fitW, fitD);
    // follow: frame by width so every phone shows the same slice of board
    this.followDist = CAM.FOLLOW_HALF_W / tanH;
  }

  /** Where the follow camera should look: the chibi, nudged toward its pet and the walking direction. */
  followPoint(tk, dt) {
    const st = this.camVel;
    let ax = 0, az = 0;
    const sp = Math.hypot(tk.vx, tk.vz);
    if (tk.moving && sp > 0.1) { ax = (tk.vx / sp) * CAM.LOOK_AHEAD; az = (tk.vz / sp) * CAM.LOOK_AHEAD; }
    this.lookAhead.x = smoothDamp(this.lookAhead.x, ax, st, 'lax', 0.6, 4, dt);
    this.lookAhead.z = smoothDamp(this.lookAhead.z, az, st, 'laz', 0.6, 4, dt);
    let x = tk.x + this.lookAhead.x, z = tk.z + this.lookAhead.z;
    if (tk.pet && Number.isFinite(tk.pet.x)) { x += (tk.pet.x - tk.x) * CAM.PET_BIAS; z += (tk.pet.z - tk.z) * CAM.PET_BIAS; }
    // Gentle inward bias (80% X / 82% Z) keeps corner & perimeter tiles centred in the safe band
    // without clipping Chibis at the screen edge or burying START under the Roll button.
    const maxX = W / 2, maxZ = D / 2;
    return { x: Math.max(-maxX, Math.min(maxX, x * CAM.INWARD_X)), z: Math.max(-maxZ, Math.min(maxZ, z * CAM.INWARD_Z)) };
  }

  updateCamera(dt) {
    if (!this.camVel) { this.camVel = {}; this.lookAhead = { x: 0, z: 0 }; }
    const st = this.camVel;
    const mode = this.effectiveCam;
    const tk = this.followSeat != null ? this.tokens[this.followSeat] : null;
    let tx = 0, tz = 0, pitch = CAM.OVERVIEW_PITCH, dist = this.overviewDist;
    if (mode === 'follow' && tk && !tk.bankrupt) {
      ({ x: tx, z: tz } = this.followPoint(tk, dt));
      pitch = CAM.FOLLOW_PITCH;
      const halfW = tk.moving ? CAM.WALK_HALF_W : CAM.FOLLOW_HALF_W;
      dist = halfW / (this.tanH || 0.2);
    }
    // two cascaded critically-damped springs = S-curve: motion eases IN as well as out (no jolt at the start)
    const g = this.camGoal || (this.camGoal = { x: this.camTarget.x, z: this.camTarget.z, p: this.camPitch, d: this.camDist });
    const p = THREE.MathUtils.degToRad(pitch);
    g.x = smoothDamp(g.x, tx, st, 'gx', CAM.POS_SMOOTH / 2, CAM.MAX_PAN, dt);
    g.z = smoothDamp(g.z, tz, st, 'gz', CAM.POS_SMOOTH / 2, CAM.MAX_PAN, dt);
    g.p = smoothDamp(g.p, p, st, 'gp', CAM.ZOOM_SMOOTH / 2, Infinity, dt);
    g.d = smoothDamp(g.d, dist, st, 'gd', CAM.ZOOM_SMOOTH / 2, Infinity, dt);
    // second stage is never clamped, so the first stage's soft pan cap can't create a kink (jerk)
    this.camTarget.x = smoothDamp(this.camTarget.x, g.x, st, 'x', CAM.POS_SMOOTH / 2, Infinity, dt);
    this.camTarget.z = smoothDamp(this.camTarget.z, g.z, st, 'z', CAM.POS_SMOOTH / 2, Infinity, dt);
    this.camPitch = smoothDamp(this.camPitch, g.p, st, 'p', CAM.ZOOM_SMOOTH / 2, Infinity, dt);
    this.camDist = smoothDamp(this.camDist, g.d, st, 'd', CAM.ZOOM_SMOOTH / 2, Infinity, dt);
    // impact feedback: one gentle low-frequency vertical sway (never random jitter); off for reduced-motion users
    const sway = !REDUCED_MOTION && this.shake ? Math.sin(this.t * 14) * this.shake * 0.25 : 0;
    this.camera.position.set(this.camTarget.x, Math.sin(this.camPitch) * this.camDist + sway, this.camTarget.z + Math.cos(this.camPitch) * this.camDist);
    this.camera.lookAt(this.camTarget.x, 0.4, this.camTarget.z);
  }

  // ----------------------------------------------------------------------------- loop
  update(dt) {
    this.t += dt;
    for (let k = this.tweens.length - 1; k >= 0; k--) {
      const tw = this.tweens[k];
      tw.t += dt;
      const p = Math.min(1, tw.t / tw.dur);
      tw.fn(p);
      if (p >= 1) { this.tweens.splice(k, 1); tw.resolve(); }
    }
    for (const tk of this.tokens) {
      const moving = tk.moving;
      tk.idleFor = moving ? 0 : tk.idleFor + dt;
      if (tk.rig) {
        tk.rig.update(dt, moving ? { vx: tk.vx, vz: tk.vz } : { vx: 0, vz: 0, walkWeight: 0 }, this.camera);
        if (tk.rig.nameTag?.material) {
          const pos = this.state?.players?.[tk.seat]?.pos;
          const crowd = this.state && pos != null ? this.state.players.filter((pl) => !pl.bankrupt && pl.pos === pos).length : 1;
          const showTag = crowd <= 1 || moving || tk.seat === this.followSeat;
          const curOp = tk.rig.nameTag.material.opacity ?? 1;
          const nextOp = curOp + ((showTag ? 1 : 0) - curOp) * Math.min(1, dt * 10);
          tk.rig.nameTag.material.opacity = nextOp;
          tk.rig.nameTag.visible = nextOp > 0.03;
        }
      }
      if (tk.pet) tk.pet.update(dt, { x: tk.x, z: tk.z, vx: moving ? tk.vx : 0, vz: moving ? tk.vz : 0, speed: moving ? Math.hypot(tk.vx, tk.vz) : 0, moving, right: tk.rig?.facing?.right ?? true, idleFor: tk.idleFor }, this.camera);
      if (!moving) { tk.vx *= 0.8; tk.vz *= 0.8; }
    }
    for (const b of this.buildings.values()) if (b.userData.spin) b.userData.spin.rotation.y += dt * 2;
    for (const p of this.props.values()) {
      if (p.userData.pulse) p.userData.pulse.material.opacity = 0.45 + 0.25 * Math.sin(this.t * 4);
      if (p.userData.flicker) p.children.forEach((c, j) => c.scale.setScalar(0.85 + 0.25 * Math.sin(this.t * 12 + j)));
    }
    for (const s of this.scene.children) if (s.isSprite && s.userData.speed) { s.position.x += s.userData.speed * dt; if (s.position.x > W * 1.4) s.position.x = -W * 1.4; }
    this.updateCamera(dt);
    this.fx.update(dt);
  }

  dispose() {
    for (const tk of this.tokens) this.disposeToken(tk);
    this.scene.traverse((o) => { o.geometry?.dispose?.(); if (o.material) [].concat(o.material).forEach((m) => { m.map?.dispose?.(); m.dispose?.(); }); });
  }
}
