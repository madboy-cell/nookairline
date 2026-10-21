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
function packSprite(name, height, { flat = false, additive = false, color = '#ffffff' } = {}) {
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
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, height).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({
        map: tex,
        color,
        transparent: true,
        depthWrite: false,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      })
    );
    m.position.y = 0.035;
    m.renderOrder = additive ? 4 : 2;
    return m;
  }
  const sp = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: tex,
      color,
      transparent: true,
      alphaTest: additive ? 0.01 : 0.03,
      depthWrite: !additive,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    })
  );
  sp.center.set(0.5, 0);
  sp.scale.set(w, height, 1);
  return sp;
}

/** Tree of Savior flat ground Sacred Magic Circle / Rune Seal with Additive Blending. */
function groundRuneCircle(name, size, color = '#ffffff', { opacity = 0.9, y = 0.045 } = {}) {
  const info = PACK.info[name];
  let tex = null;
  if (info) {
    tex = PACK.tex.get(name);
    if (!tex) {
      tex = new THREE.TextureLoader().load(`/assets/${info.file}`);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      PACK.tex.set(name, tex);
    }
  }
  const geo = tex ? new THREE.PlaneGeometry(size, size) : new THREE.RingGeometry(size * 0.28, size * 0.5, 32);
  const mat = new THREE.MeshBasicMaterial({
    map: tex || null,
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = y;
  mesh.renderOrder = 4;
  return mesh;
}

const BUILDING_SPRITE = { 1: ['mono_villa', 1.0], 2: ['mono_hotel', 1.35], 3: ['mono_landmark', 1.75], 4: ['mono_pyramid', 1.45] };
const TRAP_SPRITE = {
  ice_cube:       ['mono_trap_ice_cube', 1.55],
  glacial:        ['mono_trap_glacial_crest', 1.45],
  glacial_crest:  ['mono_trap_glacial_crest', 1.45],
  torii:          ['mono_trap_torii', 1.55],
  foxfire:        ['mono_trap_foxfire', 1.45],
  mirror:         ['mono_trap_mirror', 1.40],
  slipper:        ['mono_trap_slipper', 1.35],
  prison:         ['mono_trap_slipper', 1.35],
  coral:          ['mono_trap_coral', 1.25],
  lightning_rod:  ['mono_trap_lightning_rod', 1.75],
  waterway:       ['mono_trap_waterway', 1.4, true],
  naga_wave:      ['mono_trap_waterway', 1.4, true],
  fire:           ['mono_trap_fire', 1.5, true],
  midas:          ['mono_trap_midas', 1.30],
  chips:          ['mono_trap_chips', 1.30],
  ruins:          ['mono_trap_ruins', 1.35],
  supernova:      ['mono_trap_supernova', 1.45],
  eclipse:        ['mono_trap_lunar_lantern', 1.45],
  lunar_lantern:  ['mono_trap_lunar_lantern', 1.45],
  eclipse_sun:     ['mono_trap_eclipse_sun', 1.45],
  aurora_veil:     ['mono_trap_aurora_veil', 1.50],
  rose_thorns:     ['mono_trap_rose_thorns', 1.40],
  cyber_glitch:    ['mono_trap_cyber_glitch', 1.45],
  starlight_gift:  ['mono_trap_starlight_gift', 1.40],
  phoenix_feather: ['mono_trap_fire', 1.5, true],
  whirlpool:       ['mono_trap_ruins', 1.35],
  glass_slipper:   ['mono_trap_slipper', 1.35],
};

const ULT_SPECS = {
  s1_naga_sovereign:    { sprite: 'mono_ult_naga',     tileProp: 'mono_trap_waterway',      choreo: 'surf_wave',           p1: 'fx_bubble',       p2: 'fx_shockwave',    tint: [0.35, 0.95, 0.82], color: '#2ee6b8', center: false },
  s2_kitsune_inari:     { sprite: 'mono_ult_kitsune',  tileProp: 'mono_trap_foxfire',       choreo: 'portal_ambush',       p1: 'fx_petal',        p2: 'fx_flame',        tint: [1.0, 0.68, 0.82],  color: '#ff7aa8', center: false },
  s2_tsukuyomi_eclipse: { sprite: 'mono_ult_eclipse',  tileProp: 'mono_trap_lunar_lantern', choreo: 'lunar_domain',        p1: 'fx_moon',         p2: 'fx_rune',         tint: [0.78, 0.68, 1.0],  color: '#9b7bff', center: true  },
  s3_sultan_djinn:      { sprite: 'mono_ult_djinn',    tileProp: 'mono_trap_midas',         choreo: 'lamp_summon',         p1: 'fx_stardust',     p2: 'fx_magic_circle', tint: [1.0, 0.86, 0.42],  color: '#ffd24d', center: true  },
  s3_dune_phoenix:      { sprite: 'mono_ult_phoenix',  tileProp: 'mono_trap_fire',          choreo: 'sky_dive',            p1: 'fx_flame',        p2: 'fx_feather',      tint: [1.0, 0.58, 0.22],  color: '#ff7a22', center: false },
  s4_casino_royale:     { sprite: 'mono_ult_roulette', tileProp: 'mono_trap_chips',         choreo: 'spin_wheel',          p1: 'fx_chip',         p2: 'fx_star',         tint: [1.0, 0.88, 0.35],  color: '#ffd34d', center: true  },
  s5_atlantis_siren:    { sprite: 'mono_ult_siren',    tileProp: 'mono_trap_coral',         choreo: 'trident_plunge',      p1: 'fx_bubble',       p2: 'fx_note',         tint: [0.35, 0.92, 0.98], color: '#47e5ff', center: false },
  s6_astral_sovereign:  { sprite: 'mono_ult_astral',   tileProp: 'mono_trap_supernova',     choreo: 'gravity_singularity', p1: 'fx_rune',         p2: 'fx_stardust',     tint: [0.78, 0.48, 1.0],  color: '#a35cff', center: true  },
  s7_cinderella_clock:  { sprite: 'mono_ult_clock',    tileProp: 'mono_trap_slipper',       choreo: 'clock_rewind',        p1: 'fx_magic_circle', p2: 'fx_snowflake',    tint: [0.75, 0.90, 1.0],  color: '#9fd8ff', center: true  },
  s8_glacial_elsa:      { sprite: 'mono_ult_glacial',  tileProp: 'mono_trap_glacial_crest', choreo: 'domino_glacier',      p1: 'fx_snowflake',    p2: 'fx_shockwave',    tint: [0.65, 0.92, 1.0],  color: '#7fe3ff', center: false },
  s9_pharaoh_ra:        { sprite: 'mono_ult_pharaoh',  tileProp: 'mono_pyramid_a',          choreo: 'orbital_laser',       p1: 'fx_magic_circle', p2: 'fx_moon',         tint: [1.0, 0.85, 0.25],  color: '#ffd34d', center: false, rowLaser: true },
  s10_phantom_masque:   { sprite: 'mono_ult_phantom',  tileProp: 'mono_trap_mirror',        choreo: 'twin_mirrors',        p1: 'fx_feather',      p2: 'fx_note',         tint: [0.95, 0.28, 0.42], color: '#ff4769', center: false },
  s11_zeus_olympus:     { sprite: 'mono_ult_zeus',     tileProp: 'mono_trap_lightning_rod', choreo: 'sky_artillery',       p1: 'fx_lightning',    p2: 'fx_shockwave',    tint: [1.0, 0.90, 0.35],  color: '#ffe35a', center: false, skyStrike: true },
  // ✦ Super Mythic Sovereigns (5 Distinct Colossal Boss Cinematics)
  sm_eclipse_dragon:    { sprite: 'mono_ult_sm_eclipse',  tileProp: 'mono_trap_eclipse_sun',    choreo: 'dragon_eclipse',   p1: 'fx_flame',     p2: 'fx_stardust',  tint: [1.0, 0.78, 0.25],  color: '#ffb800', center: true,  superVfx: 'eclipse_domain',     size: 3.45 },
  sm_aurora_empress:    { sprite: 'mono_ult_sm_aurora',   tileProp: 'mono_trap_aurora_veil',    choreo: 'aurora_seraph',    p1: 'fx_stardust',  p2: 'fx_star',      tint: [0.62, 0.95, 1.0],  color: '#8ff0ff', center: true,  superVfx: 'aurora_veil',        size: 3.45 },
  sm_seraphim_rose:     { sprite: 'mono_ult_sm_seraphim', tileProp: 'mono_trap_rose_thorns',    choreo: 'rose_cathedral',   p1: 'fx_petal',     p2: 'fx_heart',     tint: [1.0, 0.62, 0.82],  color: '#ff94c8', center: true,  superVfx: 'seraphim_sanctuary', size: 3.40 },
  sm_cyber_archon:      { sprite: 'mono_ult_sm_cyber',    tileProp: 'mono_trap_cyber_glitch',   choreo: 'cyber_hack',       p1: 'fx_lightning', p2: 'fx_shockwave', tint: [0.22, 0.98, 1.0],  color: '#2ef7ff', center: true,  superVfx: 'quantum_overdrive',  size: 3.40 },
  sm_starlight_ribbon:  { sprite: 'mono_ult_sm_ribbon',   tileProp: 'mono_trap_starlight_gift', choreo: 'ribbon_parade',    p1: 'fx_star',      p2: 'fx_heart',     tint: [1.0, 0.72, 0.92],  color: '#ffaee0', center: true,  superVfx: 'starlight_parade',   size: 3.40 },
};
const SUPER_BY_THEME = {
  eclipse_domain: 'sm_eclipse_dragon',
  aurora_veil: 'sm_aurora_empress',
  seraphim_sanctuary: 'sm_seraphim_rose',
  quantum_overdrive: 'sm_cyber_archon',
  starlight_parade: 'sm_starlight_ribbon',
};

export const tokenModules = Promise.all([
  spritePack,
  import('../../chibi_rig.js').then((m) => { ChibiRig = m.ChibiRig; }).catch((e) => console.warn('[monopoly] chibi_rig unavailable:', e.message)),
  import('../../pet_controller.js').then((m) => { PetController = m.PetController; }).catch((e) => console.warn('[monopoly] pet_controller unavailable:', e.message)),
]);
import { MONO, TILES, ZONES, tileCell, tileSide } from '/shared/monopoly_rules.js';
import { getWalkFx } from '/shared/walk_fx.js';
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

// ------------------------------------------------------------------------------- dopamine patch shared bits
/** HUD and board find each other here (hud.js already imports this module) so juicy cross-layer FX
 *  (coins flying from a chibi into its player card, diamond trails…) need no extra bridge wiring. */
export const juiceBus = { hud: null, board: null };
const PERF = {
  SLOW_MS: 20, SLOW_FOR: 2,          // avg frame > 20 ms for 2 s → low tier
  FAST_MS: 15, FAST_FOR: 4,          // avg < 15 ms for 4 s → restore
  IDLE_FPS: 30,                      // render cap while nothing animates on someone else's turn
};
const PET_TINTS = [
  [/fire|flame|phoenix|dragon|ember|sun/i, '#ff7a22'], [/ice|frost|snow|glacial|penguin/i, '#7fe3ff'],
  [/night|fury|shadow|moon|bat|eclipse/i, '#9b7bff'], [/sea|ocean|whale|fish|koi|water|otter/i, '#47e5ff'],
  [/bunny|rabbit|sakura|pink|ragdoll|cat|kitsune|fox/i, '#ff7aa8'], [/leaf|forest|frog|turtle|panda/i, '#5fd36a'],
  [/gold|lion|tiger|corgi|shiba|dog/i, '#ffc53d'],
];
const COMBO_FALLBACK = ['#ff7aa8', '#47e5ff', '#9b7bff', '#ffc53d', '#5fd36a', '#ff7a22'];
export function petTint(petId = '') {
  const id = typeof petId === 'object' ? petId?.id || '' : String(petId || '');
  for (const [re, c] of PET_TINTS) if (re.test(id)) return c;
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return COMBO_FALLBACK[Math.abs(h) % COMBO_FALLBACK.length];
}
const _col = new THREE.Color();
const rgb = (hex) => { _col.set(hex); return [_col.r, _col.g, _col.b]; };
const mixRgb = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const GOLD = [1, 0.85, 0.3], DIAMOND = [0.55, 0.95, 1];
const CONFETTI = [[1, 0.45, 0.6], [1, 0.85, 0.3], [0.45, 0.85, 1], [0.6, 1, 0.55], [0.8, 0.55, 1]];
const _v3 = new THREE.Vector3();

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
  outQuint: (k) => 1 - (1 - k) ** 5,
  in: (k) => k * k * k,
  /** damped squash & stretch wobble (0 at k=0 and k=1) */
  wobble: (k, n = 3, a = 1) => Math.sin(k * Math.PI * n) * (1 - k) ** 2 * a,
};

// ------------------------------------------------------------------------------- textures
const EVENT_BG = { start: '#dff1ff', airdrop: '#e6f9e3', casino: '#ffe6f1', vault: '#efe6ff', warp: '#e3f2ff', arena: '#fff0dc' };
const EVENT_ICON_SPRITE = {
  start: 'mono_icon_start',
  casino: 'mono_icon_casino',
  airdrop: 'mono_icon_airdrop',
  vault: 'mono_icon_vault',
  warp: 'mono_icon_warp',
  arena: 'mono_icon_arena',
};
const EVENT_ICON_IMG = new Map();

function drawTileCanvas(g, t, side, iconImg = null) {
  g.clearRect(0, 0, 256, 256);
  g.fillStyle = t.kind === 'property' ? '#f4f6ea' : EVENT_BG[t.kind] || '#f4f6ea';
  g.beginPath(); g.roundRect(6, 6, 244, 244, 26); g.fill();
  g.lineWidth = 5; g.strokeStyle = 'rgba(58,36,21,0.18)'; g.stroke();
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
    if (iconImg && iconImg.naturalWidth > 0) {
      const maxDim = 148;
      const ar = iconImg.naturalWidth / iconImg.naturalHeight;
      const dw = ar >= 1 ? maxDim : Math.round(maxDim * ar);
      const dh = ar >= 1 ? Math.round(maxDim / ar) : maxDim;
      g.drawImage(iconImg, Math.round(128 - dw / 2), Math.round(98 - dh / 2), dw, dh);
    } else {
      g.font = '96px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
      g.fillText(t.icon, 128, 108);
    }
    g.font = '900 28px "Nunito", system-ui, sans-serif'; g.fillStyle = '#3a2415';
    g.fillText(t.name.toUpperCase(), 128, 206);
  }
}

function tileTexture(i) {
  const t = TILES[i];
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  const side = innerSide(i);
  const spName = EVENT_ICON_SPRITE[t.kind];
  const cached = spName ? EVENT_ICON_IMG.get(spName) : null;
  drawTileCanvas(g, t, side, cached?.complete ? cached : null);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  if (spName && (!cached || !cached.complete)) {
    let img = cached;
    if (!img && typeof Image !== 'undefined') {
      img = new Image();
      img.src = `/assets/village/${spName}.png`;
      EVENT_ICON_IMG.set(spName, img);
    }
    img?.addEventListener('load', () => {
      drawTileCanvas(g, t, side, img);
      tex.needsUpdate = true;
    }, { once: true });
  }
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

let _auroraTex = null;
function auroraTexture() {
  if (_auroraTex) return _auroraTex;
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  const hGrad = g.createLinearGradient(0, 0, 256, 0);
  hGrad.addColorStop(0.0, '#4dffa6');
  hGrad.addColorStop(0.35, '#47e5ff');
  hGrad.addColorStop(0.7, '#a57fff');
  hGrad.addColorStop(1.0, '#ff7ad9');
  g.fillStyle = hGrad;
  g.fillRect(0, 0, 256, 64);

  g.globalCompositeOperation = 'destination-in';
  const vGrad = g.createLinearGradient(0, 0, 0, 64);
  vGrad.addColorStop(0.0, 'rgba(0,0,0,0)');
  vGrad.addColorStop(0.25, 'rgba(0,0,0,0.9)');
  vGrad.addColorStop(0.5, 'rgba(0,0,0,1)');
  vGrad.addColorStop(0.75, 'rgba(0,0,0,0.9)');
  vGrad.addColorStop(1.0, 'rgba(0,0,0,0)');
  g.fillStyle = vGrad;
  g.fillRect(0, 0, 256, 64);

  _auroraTex = new THREE.CanvasTexture(c);
  _auroraTex.colorSpace = THREE.SRGBColorSpace;
  return _auroraTex;
}

// ------------------------------------------------------------------------------- procedural props
const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0, ...o });

/** Free per-instance GPU resources of a removed prop (geometries + materials). Textures are shared
 *  (pack sprites, seat frames) and intentionally kept. */
function disposeObj(o) {
  o.traverse?.((q) => {
    if (!q.isSprite) q.geometry?.dispose?.();
    if (q.material) [].concat(q.material).forEach((m) => m.dispose?.());
  });
}

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

const _badgeTexCache = new Map();
function statusPillSprite(text, { bg = 'rgba(20,30,48,0.92)', border = '#7fe3ff', color = '#ffffff', height = 0.4 } = {}) {
  const key = `${text}|${bg}|${border}|${color}`;
  let entry = _badgeTexCache.get(key);
  if (!entry) {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 72;
    const g = c.getContext('2d');
    g.fillStyle = bg;
    g.strokeStyle = border;
    g.lineWidth = 5;
    g.beginPath();
    g.roundRect(8, 8, 240, 56, 28);
    g.fill();
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.14)';
    g.beginPath();
    g.roundRect(14, 12, 228, 22, 12);
    g.fill();
    g.font = '800 26px "Fredoka", "Nunito", system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 5;
    g.strokeStyle = 'rgba(18, 10, 6, 0.85)';
    g.strokeText(text, 128, 37);
    g.fillStyle = color;
    g.fillText(text, 128, 37);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    entry = { tex, aspect: c.width / c.height };
    _badgeTexCache.set(key, entry);
  }
  const sp = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: entry.tex,
      transparent: true,
      depthWrite: false,
      depthTest: false,
    })
  );
  sp.scale.set(height * entry.aspect, height, 1);
  sp.renderOrder = 14;
  return sp;
}

function modifierBadgeSpec(mod) {
  if (!mod) return null;
  if (mod.rentZero) return { text: '❄️ 0× RENT', bg: 'rgba(14,52,86,0.92)', border: '#7fe3ff', color: '#e8fbff' };
  if (mod.invertRent) return { text: '🎭 INVERT', bg: 'rgba(72,18,46,0.92)', border: '#ff5a8a', color: '#ffe6f0' };
  if (mod.stepForward) return { text: `⛩️ +${mod.stepForward} TILE`, bg: 'rgba(92,24,20,0.92)', border: '#ff8a5c', color: '#fff0e6' };
  if (mod.jailOnLand) return { text: '👠 PRISON', bg: 'rgba(28,54,92,0.92)', border: '#9fd8ff', color: '#eef8ff' };
  if (mod.teleportToCheapest) return { text: '💠 WARP', bg: 'rgba(20,66,82,0.92)', border: '#47e5ff', color: '#e6fcff' };
  if (mod.rentMul && mod.rentMul < 1) return { text: `🔥 ×${mod.rentMul}`, bg: 'rgba(88,28,12,0.92)', border: '#ff7a22', color: '#ffe8d6' };
  if (mod.rentMul && mod.rentMul > 1) {
    if (mod.ticketBonus) return { text: `🎁 ×${mod.rentMul} +🎟️`, bg: 'rgba(82,26,68,0.92)', border: '#ffaee0', color: '#fff0fa' };
    if (mod.fxTheme === 'eclipse_sun') return { text: `☀️ ×${mod.rentMul}`, bg: 'rgba(76,46,8,0.92)', border: '#ffb800', color: '#fff5d6' };
    if (mod.fxTheme === 'rose_thorns') return { text: `🌹 ×${mod.rentMul}`, bg: 'rgba(84,22,52,0.92)', border: '#ff94c8', color: '#fff0f7' };
    if (mod.fxTheme === 'aurora_veil') return { text: `🌌 ×${mod.rentMul}`, bg: 'rgba(18,58,78,0.92)', border: '#8ff0ff', color: '#ebfcff' };
    return { text: `⚡ ×${mod.rentMul}`, bg: 'rgba(68,48,12,0.92)', border: '#ffd34d', color: '#fff8dc' };
  }
  return null;
}

function attachModifierTag(g, mod) {
  const spec = modifierBadgeSpec(mod);
  if (!spec) return g;
  const tag = statusPillSprite(spec.text, { ...spec, height: 0.36 });
  tag.position.set(0, 1.48, 0);
  g.add(tag);
  g.userData.tag = tag;
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
    return attachModifierTag(g, mod);
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
  } else if (theme === 'chaos') {
    const ring = add(new THREE.Mesh(new THREE.RingGeometry(0.7, 0.95, 32), M('#ff4d6d', { emissive: '#ff9a1f', emissiveIntensity: 0.9, transparent: true, opacity: 0.85 })), 0.05);
    ring.rotation.x = -Math.PI / 2; g.userData.pulse = ring;
  } else if (theme === 'chips') {
    const cols = ['#e0494f', '#2b2b2b', '#2fbf71'];
    for (let k = 0; k < 6; k++) { const ch = add(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.05, 16), M(cols[k % 3])), 0.03 + k * 0.055); ch.position.x = -0.55; }
  } else {
    const ring = add(new THREE.Mesh(new THREE.RingGeometry(0.75, 0.92, 32), M('#c78bff', { emissive: '#7a3cff', emissiveIntensity: 0.8, transparent: true, opacity: 0.8 })), 0.05);
    ring.rotation.x = -Math.PI / 2; g.userData.pulse = ring;
  }
  return attachModifierTag(g, mod);
}

/** Builds merged non-overlapping ground planes with world-space UVs (1 draw call per layer, zero Z-fighting). */
function buildCourtyardPlaneMesh(rects, y, mat, uvScale = 0.52) {
  const out = new THREE.BufferGeometry();
  const pos = [], norm = [], uv = [], idx = [];
  let vOff = 0;
  for (const [w, d, cx, cz] of rects) {
    const hw = w / 2, hd = d / 2;
    const x0 = cx - hw, x1 = cx + hw, z0 = cz - hd, z1 = cz + hd;
    pos.push(x0, y, z0, x1, y, z0, x0, y, z1, x1, y, z1);
    norm.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);
    uv.push(x0 * uvScale, z0 * uvScale, x1 * uvScale, z0 * uvScale, x0 * uvScale, z1 * uvScale, x1 * uvScale, z1 * uvScale);
    idx.push(vOff, vOff + 2, vOff + 1, vOff + 2, vOff + 3, vOff + 1);
    vOff += 4;
  }
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  out.setIndex(idx);
  const mesh = new THREE.Mesh(out, mat);
  mesh.matrixAutoUpdate = false;
  mesh.updateMatrix();
  return mesh;
}

export const MONO_LANDSCAPE_THEMES = [
  {
    id: 'classic',
    key: 'classic',
    name: 'Royal Starlight Garden',
    label: '🌿 Royal Starlight Garden',
    emoji: '🌿',
    subtitle: 'Vakarine Shrine • Wishing Fountain • Crystal Brook',
    accent: '#48b8e8',
    sky: '#8fd6ff',
    groundSwatch: 'ground_classic',
    groundTint: '#b9c54f',
    groundMedal: 'mono_ground_brook_classic',
    curbColor: '#f3e5d0',
    cobbleSwatch: 'road_cobble',
    northHero: ['bld_shrine', 3.04],
    northTrees: ['env_tree_sakura_a', 'env_tree_sakura_b', 2.32],
    centerHero: ['wnd_fountain', 2.42],
    wingTrees: ['env_tree_oak_a', 'env_tree_fruit_apple', 2.16],
    westWing: ['dec_love_pavilion', 2.34],
    eastWing: ['dec_boba_stand', 2.22],
    southBridge: ['dec_stone_arch_footbridge', 1.84],
  },
  {
    id: 'sakura',
    key: 'sakura',
    name: 'Kyoto Sakura Sanctuary',
    label: '🌸 Kyoto Sakura Sanctuary',
    emoji: '🌸',
    subtitle: 'Five-Tier Pagoda • Capybara Onsen • Red Drum Bridge',
    accent: '#ff7aa8',
    sky: '#96d6ff',
    groundSwatch: 'ground_sakura',
    groundTint: '#b8d46b',
    groundMedal: 'mono_ground_pond_sakura',
    curbColor: '#fce4e8',
    cobbleSwatch: 'road_sakura',
    northHero: ['wnd_sakura_pagoda', 3.36],
    northTrees: ['env_tree_sakura_a', 'env_tree_sakura_b', 2.38],
    centerHero: ['dec_bamboo_shishi_odoshi', 2.18],
    wingTrees: ['env_tree_sakura_b', 'env_tree_golden_maple', 2.18],
    westWing: ['wnd_onsen', 2.46],
    eastWing: ['wnd_tea_pavilion', 2.46],
    southBridge: ['dec_sakura_drum_bridge', 1.84],
  },
  {
    id: 'mirage',
    key: 'mirage',
    name: "Sultan's Mirage Oasis",
    label: "🕌 Sultan's Mirage Oasis",
    emoji: '🕌',
    subtitle: 'Golden Mirage Palace • Sun-Disc Fountain • Oasis Lagoon',
    accent: '#f59e0b',
    sky: '#7ecbff',
    groundSwatch: 'ground_vanilla',
    groundTint: '#c2d168',
    groundMedal: 'mono_ground_oasis_mirage',
    curbColor: '#f9dfb5',
    cobbleSwatch: 'road_cobble',
    northHero: ['wnd_mirage_palace', 3.32],
    northTrees: ['env_tree_palm_oasis', 'env_tree_palm_oasis', 2.36],
    centerHero: ['dec_oasis_obelisk_fountain', 2.44],
    wingTrees: ['env_tree_palm_oasis', 'env_tree_golden_maple', 2.18],
    westWing: ['dec_sultan_bazaar_canopy', 2.36],
    eastWing: ['wnd_sky_airship_dock', 2.46],
    southBridge: ['dec_stone_arch_footbridge', 1.84],
  },
  {
    id: 'atlantis',
    key: 'atlantis',
    name: 'Atlantis Pearl Lagoon',
    label: '🐚 Atlantis Pearl Lagoon',
    emoji: '🐚',
    subtitle: 'Pearl-Shell Sanctuary • Siren Fountain • Coral Archway',
    accent: '#06b6d4',
    sky: '#75d2ff',
    groundSwatch: 'ground_aurora',
    groundTint: '#56b3a8',
    groundMedal: 'mono_ground_lagoon_atlantis',
    curbColor: '#fff6e5',
    cobbleSwatch: 'road_cream',
    northHero: ['wnd_atlantis_sanctuary', 3.28],
    northTrees: ['env_tree_palm_oasis', 'env_tree_palm_oasis', 2.34],
    centerHero: ['dec_siren_shell_fountain', 2.42],
    wingTrees: ['env_tree_palm_oasis', 'env_tree_oak_a', 2.16],
    westWing: ['bld_starlight_lighthouse', 2.68],
    eastWing: ['dec_coral_crystal_arch', 2.38],
    southBridge: ['bridge_rainbow_arch', 1.84],
  },
  {
    id: 'aurora',
    key: 'aurora',
    name: 'Starlight Aurora Sanctuary',
    label: '🌌 Starlight Aurora Sanctuary',
    emoji: '🌌',
    subtitle: 'Celestial Observatory • Crystal Swan Gazebo • Mirror Pond',
    accent: '#8b5cf6',
    sky: '#7ac5ff',
    groundSwatch: 'ground_aurora',
    groundTint: '#56b3a8',
    groundMedal: 'mono_ground_rink_aurora',
    curbColor: '#eef5fc',
    cobbleSwatch: 'road_cream',
    northHero: ['wnd_aurora_observatory', 3.32],
    northTrees: ['env_tree_pine_snowy', 'env_tree_pine_snowy', 2.38],
    centerHero: ['dec_aurora_crystal_gazebo', 2.44],
    wingTrees: ['env_tree_pine_snowy', 'env_tree_pine_snowy', 2.20],
    westWing: ['wnd_ferris', 2.68],
    eastWing: ['wnd_sky_airship_dock', 2.46],
    southBridge: ['dec_stone_arch_footbridge', 1.84],
  },
  {
    id: 'dubai',
    key: 'dubai',
    name: 'Dubai Royal Palm & Burj',
    label: '🏙️ Dubai Royal Palm & Burj',
    emoji: '🏙️',
    subtitle: 'Burj Khalifa • Palm Jumeirah • Burj Al Arab & Future Museum',
    accent: '#f59e0b',
    sky: '#7ecbff',
    groundSwatch: 'ground_vanilla',
    groundTint: '#c2d168',
    groundMedal: 'mono_ground_palm_jumeirah',
    curbColor: '#f9dfb5',
    cobbleSwatch: 'road_cobble',
    northHero: ['wnd_burj_khalifa', 3.88],
    northTrees: ['env_tree_palm_oasis', 'env_tree_palm_oasis', 2.36],
    centerHero: ['dec_palm_jumeirah_island', 2.66],
    wingTrees: ['env_tree_palm_oasis', 'env_tree_palm_oasis', 2.18],
    westWing: ['dec_burj_al_arab_sail', 2.98],
    eastWing: ['dec_museum_of_the_future', 2.58],
    southBridge: ['dec_stone_arch_footbridge', 1.84],
  },
];

let _lastRandomThemeIdx = -1;
function pickRandomLandscapeThemeIdx(excludeIdx = _lastRandomThemeIdx) {
  const n = MONO_LANDSCAPE_THEMES.length;
  if (n <= 1) return 0;
  const idx = (excludeIdx >= 0 && excludeIdx < n)
    ? (excludeIdx + 1 + Math.floor(Math.random() * (n - 1))) % n
    : Math.floor(Math.random() * n);
  _lastRandomThemeIdx = idx;
  return idx;
}
const _terrainTexCache = new Map();
function loadTerrainTex(swatchName, onReady) {
  const cached = _terrainTexCache.get(swatchName);
  if (cached) { onReady(cached); return; }
  new THREE.TextureLoader().load(`/assets/terrain/${swatchName}.png`, (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 4;
    _terrainTexCache.set(swatchName, tex);
    onReady(tex);
  });
}

function buildCourtyardHardscape(g, theme = MONO_LANDSCAPE_THEMES[0]) {
  const hasGroundMedal = Boolean(theme?.groundMedal && PACK.info[theme.groundMedal]);
  // Hand-painted 2.5D Courtyard Ground & Brook/Stream/Lagoon Map Medal (1 static quad = 2 triangles, 1 draw call)
  if (hasGroundMedal) {
    const info = PACK.info[theme.groundMedal];
    let tex = PACK.tex.get(theme.groundMedal);
    if (!tex) {
      tex = new THREE.TextureLoader().load(`/assets/${info.file}`);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      PACK.tex.set(theme.groundMedal, tex);
    }
    const medalMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(10.55, 9.75).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.02, depthWrite: false }),
    );
    medalMesh.position.set(0, -BOARD.H + 0.018, 0.84);
    medalMesh.renderOrder = 2;
    medalMesh.matrixAutoUpdate = false;
    medalMesh.updateMatrix();
    g.add(medalMesh);
    return;
  }

  const curbRects = [
    [3.85, 3.85,  0.00,  0.10],
    [1.95, 0.65,  0.00, -2.05],
    [3.85, 2.20,  0.00, -3.35],
    [1.95, 1.65,  0.00,  2.75],
    [2.05, 2.35, -2.95,  0.10],
    [2.05, 2.35,  2.95,  0.10],
  ];
  const curbMat = M(theme?.curbColor || '#f3e5d0', { roughness: 0.85 });
  const curbMesh = buildCourtyardPlaneMesh(curbRects, -BOARD.H + 0.012, curbMat);
  curbMesh.renderOrder = 1;
  g.add(curbMesh);

  const cobbleRects = [
    [3.56, 3.56,  0.00,  0.10],
    [1.68, 0.90,  0.00, -2.05],
    [3.56, 1.92,  0.00, -3.35],
    [1.68, 1.65,  0.00,  2.62],
    [2.05, 2.08, -2.80,  0.10],
    [2.05, 2.08,  2.80,  0.10],
  ];
  const cobbleMat = M('#e8d5b5', { roughness: 0.8 });
  loadTerrainTex(theme?.cobbleSwatch || 'road_cobble', (tex) => {
    cobbleMat.map = tex;
    cobbleMat.color.set('#fff6e5');
    cobbleMat.needsUpdate = true;
  });
  const cobbleMesh = buildCourtyardPlaneMesh(cobbleRects, -BOARD.H + 0.015, cobbleMat, 0.52);
  cobbleMesh.renderOrder = 2;
  g.add(cobbleMesh);
}

function centerDecorSprites(theme = MONO_LANDSCAPE_THEMES[0]) {
  if (!PACK.info.mono_dec_fountain && !PACK.info.wnd_fountain) return null;
  const g = new THREE.Group();
  buildCourtyardHardscape(g, theme);
  const hasGroundMedal = Boolean(theme?.groundMedal && PACK.info[theme.groundMedal]);

  const Y_PROP = -BOARD.H + 0.025;
  const putFlat = (name, h, x, z, yOff = 0.021) => {
    const m = packSprite(name, h, { flat: true });
    if (!m) return;
    m.position.set(x, -BOARD.H + yOff, z);
    m.renderOrder = 3;
    m.matrixAutoUpdate = false;
    m.updateMatrix();
    g.add(m);
  };
  const put = (name, h, x, z, y = Y_PROP) => {
    const sp = packSprite(name, h);
    if (!sp) return;
    sp.position.set(x, y, z);
    sp.matrixAutoUpdate = false;
    sp.updateMatrix();
    g.add(sp);
  };

  if (!hasGroundMedal) {
    putFlat('decal_plaza_medallion_circle', 2.35, 0.00, -0.05, 0.022);
    putFlat('decal_plaza_medallion_circle', 1.65, 0.00, -3.12, 0.021);
  }

  // 1. North Skyline Anchor — Towering Hero Landmark & Wide Flanking Canopy
  const [nHero, nHeroH] = theme.northHero;
  put(PACK.info[nHero] ? nHero : (PACK.info.bld_shrine ? 'bld_shrine' : 'mono_dec_shrine'), nHeroH, 0.00, -2.78);
  const [nTreeL, nTreeR, nTreeH] = theme.northTrees;
  put(nTreeL, nTreeH, -3.38, -2.96);
  put(nTreeR, nTreeH,  3.38, -2.96);

  // 2. Center Medallion & West/East Feature Wings (uncluttered, wide heroic spacing)
  const [cHero, cHeroH] = theme.centerHero;
  put(PACK.info[cHero] ? cHero : (PACK.info.wnd_fountain ? 'wnd_fountain' : 'mono_dec_fountain'), cHeroH, 0.00, 0.36);
  const [wTreeL, wTreeR, wTreeH] = theme.wingTrees;
  put(wTreeL, wTreeH, -3.86, 1.65);
  put(wTreeR, wTreeH,  3.86, 1.65);
  put(theme.westWing[0], theme.westWing[1], -3.02, 0.28);
  put(PACK.info[theme.eastWing[0]] ? theme.eastWing[0] : 'mono_dec_boba', theme.eastWing[1], 3.02, 0.28);

  // 3. South Waterfront Footbridge (strictly on solid lagoon bridge crossing)
  if (theme.southBridge) {
    put(theme.southBridge[0], theme.southBridge[1], 0.00, 4.02);
  }

  // Outer START corner departure gate (Tile 0)
  const gate = packSprite('mono_dec_start_gate', 2.2);
  if (gate) { const { x, z } = tileWorld(0); gate.position.set(x + 1.0, 0, z + 0.9); gate.matrixAutoUpdate = false; gate.updateMatrix(); g.add(gate); }
  return g;
}

function centerDecor(theme = MONO_LANDSCAPE_THEMES[0]) {
  const g = new THREE.Group();
  buildCourtyardHardscape(g, theme);
  const Y0 = -BOARD.H + 0.025;
  // Central winged fountain at (0, 0)
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.2, 0.35, 24), M('#f1e3c8'));
  basin.position.set(0, Y0 + 0.18, 0);
  const water = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.05, 24), M('#7fd3ff', { emissive: '#1d6f9f', emissiveIntensity: 0.3 }));
  water.position.set(0, Y0 + 0.36, 0);
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.9, 12), M('#f1e3c8'));
  col.position.set(0, Y0 + 0.8, 0);
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 10), M('#ffd34d', { metalness: 0.5, roughness: 0.3 }));
  orb.position.set(0, Y0 + 1.35, 0);
  for (const s of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.9, 4), M('#ffd34d', { metalness: 0.5, roughness: 0.3 }));
    wing.position.set(s * 0.42, Y0 + 1.45, 0); wing.rotation.z = -s * 1.0;
    g.add(wing);
  }
  // North shrine at (0, -3.4)
  const shrine = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.9, 1.0), M('#fff3e0'));
  shrine.position.set(0, Y0 + 0.45, -3.4);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.15, 0.6, 4), M('#6b3a2a'));
  roof.position.set(0, Y0 + 1.2, -3.4); roof.rotation.y = Math.PI / 4;
  // East boba stand at (+2.35, -0.05)
  const stand = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.9, 0.85), M('#ffc2d6'));
  stand.position.set(2.35, Y0 + 0.45, -0.05);
  const awning = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.12, 1.0), M('#ff7aa8'));
  awning.position.set(2.35, Y0 + 1.0, -0.05);
  g.add(basin, water, col, orb, shrine, roof, stand, awning);
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
  constructor({ renderer, onFloat = null, themeIdx = null } = {}) {
    this.renderer = renderer;
    this.onFloat = onFloat;
    this.themeIdx = themeIdx != null
      ? ((themeIdx % MONO_LANDSCAPE_THEMES.length) + MONO_LANDSCAPE_THEMES.length) % MONO_LANDSCAPE_THEMES.length
      : pickRandomLandscapeThemeIdx();
    const initTheme = MONO_LANDSCAPE_THEMES[this.themeIdx];
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(initTheme.sky || '#8fd6ff');
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

    this.hemi = new THREE.HemisphereLight('#ffffff', '#88a', 1.6);
    this.scene.add(this.hemi);
    const sun = new THREE.DirectionalLight('#fff4e0', 1.5);
    sun.position.set(-8, 20, 12);
    this.scene.add(sun);
    this.sun = sun;
    this._bg0 = this.scene.background.clone();

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

    // --- dopamine patch: timing, pools, perf ---
    this.playbackRate = 1;              // bridge may set 1.5 on bot turns (spec §2)
    this.localSeat = null;              // optional: your seat (falls back to hud.yourSeat via juiceBus)
    this._hitStop = 0;
    this._crowd = [0, 0, 0, 0];
    this.pools = { ring: [], pillar: [], meteor: [], zone: [] };
    this.chaosZone = [];
    this.lowFx = false;
    this.perf = { win: 0, sum: 0, n: 0, slowFor: 0, fastFor: 0, prev: 0, acc: 0, skip: false, throttled: false, lastInput: 0 };
    this._wake = () => { this.perf.lastInput = performance.now(); };
    if (typeof window !== 'undefined') window.addEventListener('pointerdown', this._wake, { passive: true });
    // idle frame-skip: the host loop keeps calling render(); skip every other frame when nothing animates
    if (renderer && !renderer.__monoWrapped) {
      const orig = renderer.render;
      renderer.render = function (scene, cam) {
        const b = juiceBus.board;
        if (b && scene === b.scene && b.perf.skip) return undefined;
        return orig.call(this, scene, cam);
      };
      renderer.__monoWrapped = orig;
    }
    juiceBus.board = this;
    juiceBus.hud?.setThemeLabel?.(this.currentTheme);
  }

  get currentTheme() {
    return MONO_LANDSCAPE_THEMES[this.themeIdx] || MONO_LANDSCAPE_THEMES[0];
  }

  /** Switches the inner Grand Landscape courtyard to one of the 5 preset themes (by index or id). */
  setLandscapeTheme(keyOrIdx) {
    let idx = this.themeIdx;
    if (typeof keyOrIdx === 'number') {
      idx = ((keyOrIdx % MONO_LANDSCAPE_THEMES.length) + MONO_LANDSCAPE_THEMES.length) % MONO_LANDSCAPE_THEMES.length;
    } else if (typeof keyOrIdx === 'string') {
      const found = MONO_LANDSCAPE_THEMES.findIndex((t) => t.id === keyOrIdx);
      if (found >= 0) idx = found;
    }
    this.themeIdx = idx;
    const theme = this.currentTheme;
    if (this._bg0) this._bg0.set(theme.sky || '#8fd6ff');
    if (!this._activeUlts) this.scene.background.set(theme.sky || '#8fd6ff');
    if (this.topFloorMat) {
      this.topFloorMat.color.set(theme.groundTint || '#b9c54f');
      loadTerrainTex(theme.groundSwatch || 'ground_classic', (tex) => {
        tex.repeat.set(3, 4);
        this.topFloorMat.map = tex;
        this.topFloorMat.color.set('#ffffff');
        this.topFloorMat.needsUpdate = true;
      });
    }
    if (this.decor) {
      this.root.remove(this.decor);
      disposeObj(this.decor);
      this.decor = null;
    }
    const art = centerDecorSprites(theme) || centerDecor(theme);
    this.decor = art;
    this.root.add(art);
    if (this.perf && typeof performance !== 'undefined') this.perf.lastInput = performance.now();
    juiceBus.hud?.setThemeLabel?.(theme);
    return theme;
  }

  /** Rotates to the next Grand Landscape theme in the 5-theme cycle. */
  cycleLandscapeTheme() {
    return this.setLandscapeTheme(this.themeIdx + 1);
  }

  /** Returns [0..1] readiness ratio of the active courtyard theme's textures. */
  getThemeLoadProgress(theme = this.currentTheme) {
    if (!theme) return 1;
    const keys = [
      theme.groundMedal,
      theme.northHero?.[0], theme.northTrees?.[0], theme.northTrees?.[1],
      theme.centerHero?.[0], theme.wingTrees?.[0], theme.wingTrees?.[1],
      theme.westWing?.[0], theme.eastWing?.[0], theme.southBridge?.[0],
    ].filter(Boolean);
    if (!keys.length) return 1;
    let ready = 0;
    for (const k of keys) {
      const tex = PACK.tex.get(k);
      if (tex?.image && (tex.image.complete || tex.image.width > 0)) ready++;
    }
    if (_terrainTexCache.has(theme.groundSwatch || 'ground_classic')) ready += 1;
    return Math.min(1, ready / (keys.length + 1));
  }

  /** Smooth sky-overview camera swoop + HUD Match Intro banner at Round 1 match start. */
  startIntroSwoop(m) {
    this._introHoldT = 0.72;
    const startDist = (this.overviewDist || 36) * 1.12;
    const startPitch = THREE.MathUtils.degToRad(CAM.OVERVIEW_PITCH + 4);
    this.camDist = startDist;
    this.camPitch = startPitch;
    this.camTarget.set(0, 0, -0.35);
    this.camGoal = { x: 0, z: -0.35, p: startPitch, d: startDist };
    if (this.camVel) { this.camVel.x = this.camVel.z = this.camVel.p = this.camVel.d = this.camVel.gx = this.camVel.gz = this.camVel.gp = this.camVel.gd = 0; }
    juiceBus.hud?.showMatchIntro?.({
      theme: this.currentTheme,
      players: m?.players || [],
      yourSeat: this.localSeat ?? juiceBus.hud?.yourSeat ?? 0,
      chaos: !!m?.chaos,
      maxRounds: m?.maxRounds || MONO.MAX_ROUNDS,
    });
  }

  buildBoard() {
    const S = BOARD.TILE;
    const theme = this.currentTheme;
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
    const topMat = M(theme.groundTint || '#b9c54f');
    this.topFloorMat = topMat;
    loadTerrainTex(theme.groundSwatch || 'ground_classic', (tex) => {
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
    this.decor = centerDecor(theme);
    this.root.add(this.decor);
    spritePack.then(() => {                     // swap procedural placeholders for Art Pack 4A + 2.5D Village Kit
      const art = centerDecorSprites(this.currentTheme);
      if (!art) return;
      if (this.decor) { this.root.remove(this.decor); disposeObj(this.decor); }
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
    // Share the 2 tile side materials across all 24 tiles (eliminates 22 redundant shader/material instances)
    const propSideMat = M('#d9e4cf');
    const eventSideMat = M('#cfe0ee');

    for (const t of TILES) {
      const g = new THREE.Group();
      const { x, z } = tileWorld(t.i);
      g.position.set(x, 0, z);
      const bodyMesh = new THREE.Mesh(body, t.kind === 'property' ? propSideMat : eventSideMat);
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
    const fallback = cloudTexture();
    const matA = new THREE.SpriteMaterial({ map: fallback, transparent: true, depthWrite: false, opacity: 0.94 });
    const matB = new THREE.SpriteMaterial({ map: fallback, transparent: true, depthWrite: false, opacity: 0.92 });
    const loader = new THREE.TextureLoader();
    loader.load('/assets/village/env_cloud_fluffy_a.png', (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      matA.map = tex;
      matA.needsUpdate = true;
    });
    loader.load('/assets/village/env_cloud_fluffy_b.png', (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      matB.map = tex;
      matB.needsUpdate = true;
    });
    this.clouds = [];
    for (let k = 0; k < 14; k++) {
      const s = new THREE.Sprite(k % 2 === 0 ? matA : matB);
      const a = (k / 14) * Math.PI * 2;
      s.position.set(Math.cos(a) * (W * 1.05 + (k % 3) * 2.2), -4.2 - (k % 4) * 1.1, Math.sin(a) * (D * 0.86 + (k % 2) * 2.5));
      s.scale.set(6.2 + (k % 3) * 1.8, 3.1 + (k % 2) * 0.9, 1);
      s.userData.speed = 0.15 + (k % 5) * 0.05;
      this.scene.add(s);
      this.clouds.push(s);
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
    this.syncTokenStatuses(players, { animate: false });
  }

  makeToken(p) {
    const color = SEAT_COLORS[p.seat % 4];
    const outfitId = p.outfit || p.equipped?.outfit?.id || 'newbie_outfit';
    const tk = { seat: p.seat, x: 0, z: 0, vx: 0, vz: 0, moving: false, idleFor: 1, rig: null, pet: null, pawn: null, bankrupt: false, frozen: false, statusKey: '', statusGroup: null, outfit: outfitId, walkFx: getWalkFx(outfitId) };
    try {
      if (!ChibiRig) throw new Error('rig module not loaded');
      tk.rig = new ChibiRig({ lineage: p.lineage || 'bkk', appearance: p.appearance, name: p.name, sub: `P${p.seat + 1}`, wings: p.equipped?.wings?.id || null });
      tk.rig.setEquipment(p.equipped || { outfit: { id: outfitId, refine: 0 } });
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
    const petObj = p.equipped?.pet?.id ? { ...p.equipped.pet } : (p.petId ? { id: p.petId } : null);
    if (petObj && p.petCostume && !petObj.costume_id && !petObj.costumeId) petObj.costume_id = p.petCostume;
    if (petObj && PetController) {
      try { tk.pet = new PetController(petObj, this.scene, this.fx); } catch { tk.pet = null; }
    }
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.46, 28), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    this.scene.add(ring);
    tk.ring = ring;
    const statusGroup = new THREE.Group();
    this.scene.add(statusGroup);
    tk.statusGroup = statusGroup;
    return tk;
  }

  disposeToken(tk) {
    if (tk.rig) { this.scene.remove(tk.rig.ROOT); tk.rig.dispose?.(); }
    if (tk.pawn) this.scene.remove(tk.pawn);
    tk.pet?.dispose?.(this.scene);
    this.scene.remove(tk.ring);
    if (tk.statusGroup) {
      this.scene.remove(tk.statusGroup);
      disposeObj(tk.statusGroup);
      tk.statusGroup = null;
    }
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
    if (tk.statusGroup) tk.statusGroup.position.set(x, 0, z);
  }

  syncTokenStatuses(players = this.state?.players, { animate = true } = {}) {
    if (!players) return;
    for (const tk of this.tokens) {
      this.syncTokenStatus(tk, players[tk.seat], { animate });
    }
  }

  syncTokenStatus(tk, p, { animate = true } = {}) {
    if (!tk?.statusGroup) return;
    const st = p?.status || {};
    const bankrupt = Boolean(p?.bankrupt || tk.bankrupt);
    const frozen = !bankrupt && Boolean(st.skipTurn);
    const reversed = !bankrupt && st.moveDir === -1;
    const maxRoll = !bankrupt && Number(st.maxRoll) > 0 ? Number(st.maxRoll) : 0;
    const fixedRoll = !bankrupt && Number(st.fixedRoll) > 0 ? Number(st.fixedRoll) : 0;
    const shields = !bankrupt && Number(p?.shields) > 0 ? Number(p.shields) : 0;
    const key = `${bankrupt ? 1 : 0}:${frozen ? 1 : 0}:${reversed ? 1 : 0}:${maxRoll}:${fixedRoll}:${shields}`;
    const wasFrozen = tk.frozen;
    tk.frozen = frozen;
    if (tk.statusKey === key) return;
    tk.statusKey = key;

    const g = tk.statusGroup;
    while (g.children.length) {
      const c = g.children[0];
      g.remove(c);
      disposeObj(c);
    }
    g.userData = {};
    if (bankrupt) return;

    if (shields > 0) {
      const sRing = groundRuneCircle('fx_magic_circle', 1.38, '#ffd859', { opacity: 0.88, y: 0.042 });
      g.add(sRing);
      g.userData.shieldRing = sRing;
    }

    if (frozen) {
      const fRing = groundRuneCircle('fx_magic_circle', 1.48, '#7fe3ff', { opacity: 0.92, y: 0.048 });
      g.add(fRing);
      g.userData.hexRing = fRing;
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(0.92, 1.36, 0.92),
        M('#bfefff', { transparent: true, opacity: 0.38, roughness: 0.08, emissive: '#3898c8', emissiveIntensity: 0.35, depthWrite: false })
      );
      box.position.y = 0.68;
      box.renderOrder = 11;
      g.add(box);
      const iceSp = packSprite('mono_trap_ice_cube', 1.46);
      if (iceSp) {
        iceSp.material = iceSp.material.clone();
        iceSp.material.opacity = 0.64;
        iceSp.material.depthTest = false;
        iceSp.material.depthWrite = false;
        iceSp.position.set(0, 0.02, 0.22);
        iceSp.renderOrder = 12;
        g.add(iceSp);
      }
      const pill = statusPillSprite('❄️ FROZEN', { bg: 'rgba(12,56,92,0.95)', border: '#7fe3ff', color: '#ebfcff', height: 0.29 });
      pill.position.set(0, 1.78, 0);
      g.add(pill);
      g.userData.pill = pill;
      if (animate && !wasFrozen) {
        this.fx.emit('fx_snowflake', tk.x, 0.8, tk.z, 14, { speed: 1.8, up: 1.6, size: 0.34, life: 0.75, gravity: 1.2, tint: [0.7, 0.95, 1.0] });
        this.ripple(tk.x, tk.z, { color: '#7fe3ff', r0: 0.3, r1: 1.65, dur: 0.5 });
      }
    } else if (reversed) {
      const hRing = groundRuneCircle('fx_magic_circle', 1.38, '#c875ff', { opacity: 0.86, y: 0.046 });
      g.add(hRing);
      g.userData.hexRing = hRing;
      const pill = statusPillSprite('⏪ REVERSE', { bg: 'rgba(66,18,92,0.95)', border: '#d58cff', color: '#f8eaff', height: 0.28 });
      pill.position.set(0, 1.76, 0);
      g.add(pill);
      g.userData.pill = pill;
    } else if (maxRoll > 0) {
      const hRing = groundRuneCircle('fx_magic_circle', 1.36, '#5ce6ff', { opacity: 0.84, y: 0.046 });
      g.add(hRing);
      g.userData.hexRing = hRing;
      const pill = statusPillSprite(`🎲 MAX ${maxRoll}`, { bg: 'rgba(16,58,78,0.95)', border: '#66f0ff', color: '#e8fcff', height: 0.28 });
      pill.position.set(0, 1.76, 0);
      g.add(pill);
      g.userData.pill = pill;
    } else if (fixedRoll > 0) {
      const hRing = groundRuneCircle('fx_magic_circle', 1.36, '#b48cff', { opacity: 0.84, y: 0.046 });
      g.add(hRing);
      g.userData.hexRing = hRing;
      const pill = statusPillSprite(`🌙 ROLL ${fixedRoll}`, { bg: 'rgba(48,26,86,0.95)', border: '#c9a2ff', color: '#f3e8ff', height: 0.28 });
      pill.position.set(0, 1.76, 0);
      g.add(pill);
      g.userData.pill = pill;
    }

    if (animate && g.children.length > 0) {
      g.scale.setScalar(0.01);
      this.tween(0.36, (k) => g.scale.setScalar(Math.max(0.01, ease.outBack(k))));
    }
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
    const isNewMatchAfterFirst = Boolean(this._hasSyncedMatch) && (
      (m.tableId && this._lastMatchTableId && m.tableId !== this._lastMatchTableId) ||
      ((m.round ?? 1) === 1 && !m.ended && (this._lastMatchEnded || (this._lastMatchRound ?? 1) > 1))
    );
    const seedKey = m.seed != null ? `${m.tableId ?? ''}:${m.seed}` : null;
    if (seedKey) {
      // Shared theme: all clients at the table derive it from the same match seed.
      if (seedKey !== this._themeSeedKey) {
        this._themeSeedKey = seedKey;
        const n = MONO_LANDSCAPE_THEMES.length;
        const idx = ((m.seed >>> 0) % n);
        if (idx !== this.themeIdx || !this._hasSyncedMatch) this.setLandscapeTheme(idx);
      }
    } else if (isNewMatchAfterFirst) {
      this.setLandscapeTheme(pickRandomLandscapeThemeIdx(this.themeIdx));
    }
    this._hasSyncedMatch = true;
    if (m.tableId) this._lastMatchTableId = m.tableId;
    this._lastMatchRound = m.round ?? 1;
    this._lastMatchEnded = Boolean(m.ended);
    this.state = m;
    if (first) this.setPlayers(m.players);
    m.tiles.forEach((t, i) => {
      this.setOwner(i, t.owner, { animate: false });
      this.setLevel(i, t.owner, t.level, { animate: false });
      this.setModifier(i, t.modifier, { animate: false });
    });
    for (const tk of this.tokens) {
      const p = m.players[tk.seat];
      if (p?.bankrupt && !tk.bankrupt) this.markBankrupt(tk, { animate: false });
    }
    this.syncTokenStatuses(m.players, { animate: false });
    this.layoutTokens(snap || first);
    if ((first || isNewMatchAfterFirst) && !m.ended && (m.round ?? 1) <= 1) {
      this.startIntroSwoop(m);
    }
    // near-win tension (final round heartbeat) and podium confetti
    const max = m.maxRounds || MONO.MAX_ROUNDS;
    this.setTension(!m.ended && m.round >= max);
    if (m.ended && !this._endFx) { this._endFx = true; this.confetti(); }
    if (!m.ended) this._endFx = false;
  }

  setOwner(i, owner, { animate = true } = {}) {
    const cur = this.frames.get(i);
    if (cur?.userData.owner === owner) return;
    if (cur) { this.tileGroups[i].remove(cur); this.frames.delete(i); disposeObj(cur); }
    if (owner == null) return;
    const f = new THREE.Mesh(new THREE.PlaneGeometry(BOARD.TILE - BOARD.GAP, BOARD.TILE - BOARD.GAP).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: this.frameTex[owner % 4], transparent: true, depthWrite: false }));
    f.position.y = 0.02;
    f.userData.owner = owner;
    this.tileGroups[i].add(f);
    this.frames.set(i, f);
    if (animate) {
      this.tween(0.42, (k) => f.scale.setScalar(0.6 + 0.4 * ease.outBack(k)));
      const { x, z } = tileWorld(i);
      const tint = rgb(SEAT_COLORS[owner % 4]);
      this.ripple(x, z, { color: SEAT_COLORS[owner % 4], r0: 0.4, r1: 1.5, dur: 0.5 });
      this.fx.emit('fx_star', x, 0.3, z, 10, { speed: 2.2, up: 1.2, size: 0.3, life: 0.6, gravity: 2.5, ring: true, tint });
      this.fx.emit('fx_stardust', x, 0.4, z, 8, { speed: 0.8, up: 2.2, size: 0.26, life: 0.8, gravity: 0.6, tint: mixRgb(tint, [1, 1, 1], 0.5) });
      this.pressTile(i, 0.07);
      sfx.sparkle();
    }
  }

  setLevel(i, owner, level, { animate = true } = {}) {
    const key = `${owner}:${level}`;
    const cur = this.buildings.get(i);
    if (cur?.userData.key === key) return;
    const prevLevel = cur?.userData.level ?? 0;
    if (cur) { this.tileGroups[i].remove(cur); this.buildings.delete(i); disposeObj(cur); }
    if (owner == null || level <= 0) return;
    const b = buildingMesh(level, SEAT_COLORS[owner % 4], owner % 2 ? 'b' : 'a');
    const side = innerSide(i);
    const [dx, dz] = side ? INNER_DIR[side] : [0, 0];
    b.position.set(dx * 0.55, 0.02, dz * 0.55);
    b.userData.key = key;
    b.userData.level = level;
    b.userData.owner = owner;
    this.tileGroups[i].add(b);
    this.buildings.set(i, b);
    if (animate) this.buildPop(i, b, level, level < prevLevel);
  }

  /** Squash & stretch build-pop: shoots up tall-and-thin, lands wide, wobbles to rest; sparkles + pillar. */
  buildPop(i, b, level, downgrade = false) {
    const { x, z } = tileWorld(i);
    b.scale.setScalar(0.01);
    this.tween(0.62, (k) => {
      const g = ease.outQuint(Math.min(1, k * 2.2));
      const w = ease.wobble(k, 3.2, 0.42);
      b.scale.set(Math.max(0.01, g * (1 - w * 0.55)), Math.max(0.01, g * (1 + w)), Math.max(0.01, g * (1 - w * 0.55)));
    });
    if (downgrade) {
      this.fx.emit('fx_stardust', x, 0.4, z, 12, { speed: 1.4, up: 1.2, size: 0.4, life: 0.8, gravity: 1.5, tint: [0.62, 0.6, 0.58] });
      sfx.bad();
      return;
    }
    this.pressTile(i, 0.06);
    this.ripple(x, z, { color: '#ffe27a', r0: 0.3, r1: 1.4 + level * 0.15, dur: 0.55 });
    this.fx.emit('fx_star', x, 0.5, z, 10 + level * 3, { speed: 2.4, up: 2.6, size: 0.32, life: 0.8, gravity: 3.2, tint: GOLD });
    this.fx.emit('fx_stardust', x, 1.0, z, 8 + level * 2, { speed: 0.6, up: 1.6, size: 0.28, life: 1.0, gravity: 0.3, stagger: 0.03, delay: 0.15 });
    sfx.pop(level);
    if (level >= 3) this.pillar(x, z, { color: level >= 4 ? '#ffd34d' : '#fff2b0', dur: 0.8, h: 5 + level });
    if (level >= 4) { this.hitStop(50); this.sway(0.12); sfx.fanfare(); }
  }

  setModifier(i, mod, { animate = true } = {}) {
    const key = mod ? `${mod.id}:${mod.fxTheme}:${mod.owner}` : null;
    const cur = this.props.get(i);
    if ((cur?.userData.key ?? null) === key) return;
    if (cur) { this.tileGroups[i].remove(cur); this.props.delete(i); disposeObj(cur); }
    if (!mod) return;
    const p = modifierProp(mod);
    p.userData.key = key;
    this.tileGroups[i].add(p);
    this.props.set(i, p);
    if (animate) {
      p.scale.setScalar(0.01);
      this.tween(0.45, (k) => p.scale.setScalar(Math.max(0.01, ease.outBack(k))));
      const { x, z } = tileWorld(i);
      this.fx.emit('fx_magic_circle', x, 0.2, z, 4, { speed: 0.6, up: 0.8, size: 0.5, life: 0.6, gravity: 0 });
      sfx.whoosh(0.25);
    }
  }

  /** Bankrupt: hit-stop, chibi trembles & sinks grey, their buildings crumble into rubble dust. */
  markBankrupt(tk, { animate = true } = {}) {
    if (tk.bankrupt) return;
    tk.bankrupt = true;
    const mats = [];
    const fade = (o) => o.traverse?.((q) => {
      if (!q.material || q.isLight) return;
      q.material = [].concat(q.material).map((m) => { const c = m.clone(); c.transparent = true; mats.push(c); return c; });
      if (q.material.length === 1) q.material = q.material[0];
    });
    if (tk.rig) fade(tk.rig.ROOT);
    if (tk.pawn) fade(tk.pawn);
    tk.ring.visible = false;
    if (!animate) { for (const m of mats) m.opacity = 0.35; return; }
    const root = tk.rig?.ROOT || tk.pawn;
    const x0 = tk.x;
    this.hitStop(60);
    this.sway(0.16);
    sfx.crumble();
    this.fx.emit('fx_stardust', tk.x, 0.3, tk.z, 18, { speed: 1.6, up: 1.4, size: 0.42, life: 1.0, gravity: 1.2, tint: [0.55, 0.52, 0.5] });
    this.tween(0.9, (k) => {
      const tremble = Math.sin(k * 60) * 0.05 * (1 - k);
      const s = Math.sin(k * Math.PI);
      if (root) { root.position.x = x0 + tremble; root.scale.set(1 + 0.08 * s, 1 - 0.22 * s, 1); }
      for (const m of mats) m.opacity = 1 - 0.65 * ease.out(k);
    }).then(() => { if (root) { root.position.x = tk.x; root.scale.setScalar(1); } });
    for (const [ti, b] of this.buildings) {
      if (b.userData.owner !== tk.seat) continue;
      const { x, z } = tileWorld(ti);
      const delay = 0.1 + Math.random() * 0.3;
      this.fx.emit('fx_stardust', x, 0.4, z, 10, { speed: 1.2, up: 1.0, size: 0.38, life: 0.8, gravity: 2, tint: [0.6, 0.55, 0.5], delay });
      this.tween(0.75, (k) => {
        const e = Math.max(0, (k - delay) / (1 - delay));
        b.scale.set(1 + 0.15 * e, Math.max(0.05, 1 - ease.in(e)), 1 + 0.15 * e);
        b.rotation.z = Math.sin(e * 30) * 0.06 * (1 - e);
      });
    }
  }

  // ----------------------------------------------------------------------------- tweens
  tween(dur, fn) {
    return new Promise((resolve) => { this.tweens.push({ t: 0, dur: Math.max(0.001, dur), fn, resolve }); });
  }
  wait(sec) { return this.tween(sec, () => {}); }

  pressTile(i, amp = 0.05, delay = 0) {
    const g = this.tileGroups[i];
    if (!g) return;
    const d = 0.22, tot = d + delay;
    this.tween(tot, (k) => {
      const u = Math.max(0, (k * tot - delay) / d);
      g.position.y = -amp * Math.sin(Math.min(1, u) * Math.PI);
    });
  }

  // ----------------------------------------------------------------------------- juice primitives
  /** Freeze gameplay time for a beat (30–60 ms) on impacts; the camera keeps easing so nothing jolts. */
  hitStop(ms = 45) { this._hitStop = Math.max(this._hitStop, Math.min(0.08, ms / 1000)); }

  /** One gentle low-frequency vertical sway (uses the existing camera sway channel; off for reduced motion). */
  sway(amount = 0.1) { if (!REDUCED_MOTION) this.shake = Math.max(this.shake || 0, Math.min(0.25, amount)); }

  _acquire(kind, max, make) {
    const pool = this.pools[kind];
    for (let k = 0; k < pool.length; k++) if (!pool[k].userData.busy) { pool[k].userData.busy = true; pool[k].visible = true; return pool[k]; }
    if (pool.length >= max) return null;
    const m = make();
    m.userData.busy = true;
    m.frustumCulled = false;
    this.scene.add(m);
    pool.push(m);
    return m;
  }
  _release(m) { m.userData.busy = false; m.visible = false; }

  /** Expanding flat ring (pooled, max 10 live). */
  ripple(x, z, { color = '#ffffff', r0 = 0.3, r1 = 1.6, dur = 0.5, y = 0.06, opacity = 0.85, delay = 0 } = {}) {
    const m = this._acquire('ring', 10, () => {
      this._ringGeo ||= new THREE.RingGeometry(0.82, 1, 48).rotateX(-Math.PI / 2);
      return new THREE.Mesh(this._ringGeo, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    });
    if (!m) return Promise.resolve();
    const op = opacity * (REDUCED_MOTION ? 0.6 : 1);
    m.material.color.set(color);
    m.material.opacity = 0;
    m.position.set(x, y, z);
    m.renderOrder = 4;
    const tot = dur + delay;
    return this.tween(tot, (k) => {
      const u = Math.max(0, (k * tot - delay) / dur);
      m.scale.setScalar(r0 + (r1 - r0) * ease.out(u));
      m.material.opacity = u <= 0 ? 0 : op * (1 - u) * (1 - u);
    }).then(() => this._release(m));
  }

  /** Vertical light pillar (pooled, max 6; skipped on the low quality tier = "extra glow"). */
  pillar(x, z, { color = '#ffe27a', dur = 0.8, h = 6, r = 0.55, delay = 0 } = {}) {
    if (this.lowFx) return Promise.resolve();
    const m = this._acquire('pillar', 6, () => {
      this._pillarGeo ||= new THREE.CylinderGeometry(1, 1, 1, 20, 1, true).translate(0, 0.5, 0);
      return new THREE.Mesh(this._pillarGeo, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    });
    if (!m) return Promise.resolve();
    m.material.color.set(color);
    m.material.opacity = 0;
    m.position.set(x, 0, z);
    m.renderOrder = 6;
    const tot = dur + delay, peak = REDUCED_MOTION ? 0.35 : 0.6;
    return this.tween(tot, (k) => {
      const u = Math.max(0, (k * tot - delay) / dur);
      const w = r * (0.4 + 0.8 * ease.out(Math.min(1, u * 2))) * (1 - 0.5 * u);
      m.scale.set(w, h * ease.outQuint(Math.min(1, u * 3)), w);
      m.material.opacity = u <= 0 ? 0 : peak * Math.sin(u * Math.PI);
    }).then(() => this._release(m));
  }

  /** Landing: ring ripple under the chibi + a bounce wave through the neighbouring tiles + squash. */
  landRipple(i, tk = null) {
    const { x, z } = tileWorld(i);
    this.ripple(x, z, { color: '#ffffff', r0: 0.35, r1: 1.5, dur: 0.45, opacity: 0.7 });
    const N = TILES.length;
    this.pressTile(i, 0.09);
    for (let d = 1; d <= 2; d++) {
      this.pressTile((i + d) % N, 0.05 / d, d * 0.07);
      this.pressTile((i - d + N) % N, 0.05 / d, d * 0.07);
    }
    if (tk) this.squash(tk, 0.22, 0.3);
    sfx.land();
  }

  /** Squash & stretch a token (lands wide, springs back tall, settles). */
  squash(tk, amt = 0.15, dur = 0.24) {
    const root = tk.rig?.ROOT || tk.pawn;
    if (!root) return;
    this.tween(dur, (k) => {
      const w = ease.wobble(k, 2, amt) * -1;            // first half squashes (negative = shorter)
      root.scale.set(1 - w * 0.6, 1 + w, 1 - w * 0.6);
    }).then(() => root.scale.setScalar(1));
  }

  /** Passing / landing on START: gold gate burst, coin fountain, triumphant sting. */
  celebrateStart(seat) {
    const { x, z } = tileWorld(0);
    this.hitStop(35);
    this.ripple(x, z, { color: '#ffd34d', r0: 0.4, r1: 2.6, dur: 0.7 });
    this.ripple(x, z, { color: '#ffffff', r0: 0.3, r1: 1.8, dur: 0.6, delay: 0.1, opacity: 0.6 });
    this.pillar(x, z, { color: '#ffd34d', dur: 0.9, h: 7, r: 0.8 });
    this.fx.emit('fx_chip', x, 0.6, z, 14, { speed: 1.6, up: 4.2, size: 0.34, life: 1.0, gravity: 7, tint: GOLD });
    this.fx.emit('fx_star', x, 0.5, z, 12, { speed: 2.8, up: 0.8, size: 0.3, life: 0.6, gravity: 1, ring: true, tint: GOLD });
    sfx.startPass();
    const tk = this.tokens[seat];
    tk?.pet?.act?.('happy', 1.0);
    const hud = juiceBus.hud;
    if (hud?.flyIcons && tk) hud.flyIcons(seat, '🪙', 5, this.tokenScreen(seat, 1.4));
  }

  /** Colour-set completion fanfare: light pillars march across the set, sparkle storm, big sting. */
  celebrateSet(seat, { zone = null, tiles = null } = {}) {
    const z0 = zone ?? TILES[this.state?.players?.[seat]?.pos ?? -1]?.zone;
    const list = tiles || (z0 ? TILES.filter((t) => t.zone === z0).map((t) => t.i) : []);
    const color = (z0 && ZONES[z0]?.color) || SEAT_COLORS[seat % 4];
    const tint = mixRgb(rgb(color), [1, 1, 1], 0.25);
    this.hitStop(50);
    this.sway(0.1);
    sfx.fanfareBig();
    list.forEach((ti, k) => {
      const { x, z } = tileWorld(ti);
      const delay = 0.15 + k * 0.16;
      this.pillar(x, z, { color, dur: 0.9, h: 6, delay });
      this.ripple(x, z, { color, r0: 0.3, r1: 1.7, dur: 0.55, delay });
      this.pressTile(ti, 0.08, delay);
      this.fx.emit('fx_star', x, 0.6, z, 10, { speed: 2, up: 3, size: 0.34, life: 0.9, gravity: 3, tint, delay });
    });
    const tk = this.tokens[seat];
    if (tk) {
      this.fx.emit('fx_stardust', tk.x, 1.2, tk.z, 16, { speed: 1.4, up: 2.4, size: 0.3, life: 1.2, gravity: 0.8, stagger: 0.02, tint });
      tk.rig?.triggerCast?.(0.9);
    }
  }

  /** Diamond pickup: crystalline spiral off the chibi, then 💎 fly into the player card. */
  diamondTrail(seat, n = 1) {
    const tk = this.tokens[seat];
    if (!tk) return;
    for (let k = 0; k < 3; k++) this.fx.emit('fx_star', tk.x, 1.0 + k * 0.3, tk.z, 4, { speed: 0.9, up: 2.2, size: 0.32, life: 0.8, gravity: 0.4, tint: DIAMOND, delay: k * 0.08 });
    this.fx.emit('fx_stardust', tk.x, 1.6, tk.z, 8, { speed: 0.5, up: 1.4, size: 0.24, life: 1.0, gravity: 0.2, tint: [0.8, 1, 1], stagger: 0.03 });
    sfx.diamond();
    juiceBus.hud?.flyIcons?.(seat, '💎', Math.min(5, Math.max(1, n)), this.tokenScreen(seat, 1.6), { delay: 120 });
  }

  /** Final-round tension: HUD vignette + a few heartbeats at the start of each turn. */
  setTension(on) {
    on = !!on;
    if (on === !!this.tension) return;
    this.tension = on;
    this._hbLeft = on ? 3 : 0;
    this._hbT = 0.4;
    juiceBus.hud?.tension?.(on);
  }

  /** Podium confetti over the board (3D) + DOM confetti in the HUD. */
  confetti() {
    sfx.confetti();
    for (let k = 0; k < 6; k++) {
      const x = (Math.random() - 0.5) * W * 0.7, z = (Math.random() - 0.5) * D * 0.7;
      const tint = CONFETTI[k % CONFETTI.length];
      this.fx.emit(k % 2 ? 'fx_petal' : 'fx_feather', x, 5 + Math.random() * 2, z, 10, { speed: 2.2, up: 1.5, size: 0.4, life: 2.4, gravity: 1.1, drag: 0.8, tint, delay: k * 0.12 });
    }
    juiceBus.hud?.confetti?.();
  }

  float(text, i, opts = {}) {
    if (!this.onFloat) return;
    const { x, z } = typeof i === 'number' ? tileWorld(i) : i;
    this.onFloat(text, this.toScreen(x, opts.y ?? 1.9, z), opts);
  }

  toScreen(x, y, z) {
    const v = _v3.set(x, y, z).project(this.camera);
    const el = this.renderer.domElement;
    const r = el.getBoundingClientRect();
    return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height };
  }

  tokenScreen(seat, y = 2.1) {
    const tk = this.tokens[seat];
    return tk ? this.toScreen(tk.x, y, tk.z) : null;
  }

  // ----------------------------------------------------------------------------- cutscenes
  async rollDice(seat, dice, opts = {}) {
    sfx.dice();
    const tk = this.tokens[seat];
    const cx = tk ? tk.x : 0, cz = tk ? tk.z : 0;
    const shown = this.dice.slice(0, dice.length);
    const n = shown.length;
    const lx = (k) => cx + (k - (n - 1) / 2) * 1.1;
    shown.forEach((d, k) => { d.visible = true; d.scale.setScalar(1); d.position.set(lx(k), 4.5, cz - 2.0); });
    // whole turns + a random remainder per axis; cubic ease-out = fast tumble, then a slow creep onto the face
    const spin = shown.map(() => [0, 1, 2].map(() => (Math.PI * 2) * (2 + Math.floor(Math.random() * 2)) + Math.random() * 1.2));
    const mag = spin[0][0] + spin[0][1] + spin[0][2];
    let lastQ = 0, bounced = false;
    const DUR = 0.85, FALL = 0.4;
    await this.tween(DUR, (u) => {
      const e = ease.out(u);
      const fallK = Math.min(1, u / FALL);
      const b = Math.max(0, (u - FALL) / (1 - FALL));
      const y = u < FALL ? 4.5 - (4.5 - 0.43) * fallK * fallK : 0.43 + Math.abs(Math.sin(b * Math.PI * 2)) * 0.7 * (1 - b) ** 2;
      if (u >= FALL && !bounced) { bounced = true; sfx.diceTick(0); }
      shown.forEach((d, j) => {
        d.position.set(lx(j), y, cz - 2.0 + 0.8 * e);
        const [ax, ay, az] = DIE_UP[dice[j]];
        d.rotation.set(ax + spin[j][0] * (1 - e), ay + spin[j][1] * (1 - e), az + spin[j][2] * (1 - e));
      });
      // rattle ticks every quarter-turn of travelled rotation → naturally slow down with the dice
      const q = Math.floor((mag * e) / (Math.PI / 2));
      if (q !== lastQ && u > 0.25) { lastQ = q; sfx.diceTick(Math.min(8, Math.floor(u * 8))); }
    });
    // impact on the final face
    shown.forEach((d, j) => { const [ax, ay, az] = DIE_UP[dice[j]]; d.rotation.set(ax, ay, az); d.position.y = 0.43; });
    sfx.diceLand();
    this.hitStop(45);
    this.sway(0.05);
    const doubles = n > 1 && dice.every((v) => v === dice[0]);
    const rippleCol = opts.reversed ? '#c875ff' : opts.maxRoll ? '#5ce6ff' : (doubles || opts.fixedRoll) ? '#ffd34d' : '#ffffff';
    const dustTint = opts.reversed ? [0.82, 0.48, 1.0] : opts.maxRoll ? [0.42, 0.92, 1.0] : undefined;
    shown.forEach((d) => {
      this.ripple(d.position.x, d.position.z, { color: rippleCol, r0: 0.3, r1: 1.15, dur: 0.38, y: 0.05, opacity: 0.72 });
      this.fx.emit('fx_stardust', d.position.x, 0.1, d.position.z, 6, { speed: 1.2, up: 0.55, size: 0.24, life: 0.48, gravity: 1, ring: true, tint: dustTint });
    });
    if (doubles) {
      sfx.sparkle();
      shown.forEach((d) => this.fx.emit('fx_star', d.position.x, 0.8, d.position.z, 8, { speed: 1.4, up: 2, size: 0.3, life: 0.7, gravity: 2, tint: GOLD }));
    }
    await this.tween(0.25, (k) => shown.forEach((d) => {
      const w = ease.wobble(k, 2, 0.28);
      d.scale.set(1 + w * 0.6, 1 - w, 1 + w * 0.6);
    }));
    await this.wait(0.08);
    await this.tween(0.15, (k) => shown.forEach((d) => d.scale.setScalar(Math.max(0.01, 1 - ease.in(k)))));
    shown.forEach((d) => { d.visible = false; d.scale.setScalar(1); });
  }

  /** Frozen player skips their turn: camera focuses on them, ice shivers & shatters with frost shards. */
  async playSkipTurn(seat) {
    const tk = this.tokens[seat];
    if (!tk) return;
    this.followSeat = seat;
    this.hitStop(45);
    this.sway(0.11);
    sfx.bad();
    sfx.sparkle();
    const x0 = tk.x;
    const root = tk.rig?.ROOT || tk.pawn;
    this.ripple(tk.x, tk.z, { color: '#7fe3ff', r0: 0.35, r1: 1.9, dur: 0.55 });
    this.fx.emit('fx_snowflake', tk.x, 0.9, tk.z, 18, { speed: 2.4, up: 2.2, size: 0.38, life: 0.85, gravity: 2.4, tint: [0.72, 0.96, 1.0] });
    this.fx.emit('fx_shockwave', tk.x, 0.6, tk.z, 5, { speed: 1.6, up: 0.6, size: 0.5, life: 0.5, tint: [0.65, 0.94, 1.0] });
    await this.tween(0.45, (k) => {
      const shiver = Math.sin(k * 48) * 0.07 * (1 - k);
      if (root) root.position.x = x0 + shiver;
      if (tk.statusGroup) {
        tk.statusGroup.position.x = x0 + shiver;
        tk.statusGroup.scale.setScalar(1 + 0.18 * Math.sin(k * Math.PI));
      }
    });
    if (root) root.position.x = x0;
    if (tk.statusGroup) { tk.statusGroup.position.x = x0; tk.statusGroup.scale.setScalar(1); }
    const p = this.state?.players?.[seat];
    if (p?.status) p.status.skipTurn = false;
    this.syncTokenStatus(tk, p, { animate: false });
  }

  /** Shield blocks an incoming ult/rent or shatters: golden-cyan dome flash + shockwave ring. */
  async playShieldEffect(seat, { broken = true } = {}) {
    const tk = this.tokens[seat];
    if (!tk) return;
    this.followSeat = seat;
    this.hitStop(40);
    const col = broken ? '#66f0ff' : '#ffd859';
    const tint = broken ? [0.6, 0.95, 1.0] : GOLD;
    this.ripple(tk.x, tk.z, { color: col, r0: 0.4, r1: 2.0, dur: 0.55 });
    this.pillar(tk.x, tk.z, { color: col, dur: 0.65, h: 4.4, r: 0.68 });
    this.fx.emit('fx_shockwave', tk.x, 0.65, tk.z, 6, { speed: 1.8, up: 0.8, size: 0.55, life: 0.55, tint });
    this.fx.emit('fx_star', tk.x, 0.9, tk.z, 12, { speed: 2.2, up: 2.0, size: 0.3, life: 0.65, gravity: 2.2, ring: true, tint });
    sfx.sparkle();
    await this.wait(0.32);
  }

  /** Phoenix Rebirth prevents bankruptcy: golden-crimson fire pillar + feather burst + triumphant hop. */
  async playPhoenixRevive(seat) {
    const tk = this.tokens[seat];
    if (!tk) return;
    this.followSeat = seat;
    this.hitStop(55);
    this.sway(0.14);
    sfx.fanfare();
    this.pillar(tk.x, tk.z, { color: '#ff7a22', dur: 0.95, h: 7.5, r: 0.85 });
    this.ripple(tk.x, tk.z, { color: '#ffb800', r0: 0.35, r1: 2.5, dur: 0.7 });
    this.fx.emit('fx_flame', tk.x, 0.4, tk.z, 18, { speed: 2.2, up: 3.4, size: 0.42, life: 0.85, gravity: 1.2, tint: [1.0, 0.62, 0.2] });
    this.fx.emit('fx_feather', tk.x, 1.1, tk.z, 14, { speed: 2.0, up: 2.8, size: 0.38, life: 1.1, gravity: 0.8, tint: GOLD });
    this.squash(tk, 0.24, 0.45);
    tk.rig?.triggerCast?.(0.8);
    await this.wait(0.55);
  }

  /** Tile trap triggers when a player lands on it: snappy tile press + themed particle burst. */
  playTrapTrigger(seat, tileIdx, kind) {
    const ti = tileIdx ?? (this.state?.players?.[seat]?.pos || 0);
    const { x, z } = tileWorld(ti);
    this.pressTile(ti, 0.09);
    if (kind === 'prison') {
      this.ripple(x, z, { color: '#9fd8ff', r0: 0.35, r1: 1.8, dur: 0.55 });
      this.fx.emit('fx_snowflake', x, 0.6, z, 14, { speed: 1.8, up: 1.8, size: 0.34, life: 0.75, gravity: 1.4, tint: [0.75, 0.92, 1.0] });
      sfx.bad();
    } else if (kind === 'invert_rent') {
      this.ripple(x, z, { color: '#ff5a8a', r0: 0.35, r1: 1.8, dur: 0.55 });
      this.fx.emit('fx_petal', x, 0.6, z, 14, { speed: 2.0, up: 2.0, size: 0.34, life: 0.8, gravity: 1.2, tint: [1.0, 0.45, 0.68] });
      sfx.sparkle();
    } else if (kind === 'push_forward') {
      this.ripple(x, z, { color: '#ff8a5c', r0: 0.35, r1: 1.75, dur: 0.5 });
      this.fx.emit('fx_flame', x, 0.5, z, 12, { speed: 2.0, up: 2.2, size: 0.34, life: 0.7, gravity: 1.5, tint: [1.0, 0.65, 0.4] });
      sfx.whoosh(0.35);
    } else {
      this.ripple(x, z, { color: '#47e5ff', r0: 0.35, r1: 1.8, dur: 0.55 });
      this.fx.emit('fx_bubble', x, 0.5, z, 14, { speed: 1.8, up: 2.2, size: 0.34, life: 0.8, gravity: 0.8, tint: [0.4, 0.92, 1.0] });
      sfx.whoosh(0.35);
    }
  }

  /** Round phase escalation (mid-game 1.25× / overdrive 1.65×): board-center shockwave pulse. */
  playPhaseShift(phase) {
    const overdrive = phase === 'overdrive';
    this.ripple(0, 0, { color: overdrive ? '#ff5a36' : '#ffd34d', r0: 0.8, r1: 7.4, dur: 0.85, opacity: 0.85 });
    if (overdrive) {
      this.ripple(0, 0, { color: '#ffd34d', r0: 0.5, r1: 5.6, dur: 0.75, delay: 0.12, opacity: 0.7 });
      this.sway(0.12);
    }
    sfx.whoosh(0.38);
  }

  async moveToken(seat, path, kind) {
    const tk = this.tokens[seat];
    if (!tk || !path?.length) return;
    this.followSeat = seat;
    if (kind === 'warp') {
      this.fx.emit('fx_magic_circle', tk.x, 0.3, tk.z, 6, { speed: 1.2, up: 1.4, size: 0.5, life: 0.6 });
      this.ripple(tk.x, tk.z, { color: '#c9a2ff', r0: 1.2, r1: 0.2, dur: 0.3 });
      sfx.whoosh(0.3);
      await this.tween(0.25, (k) => { const s = 1 - k; tk.rig?.ROOT.scale.setScalar(Math.max(0.01, s)); tk.pawn?.scale.setScalar(Math.max(0.01, s)); });
      const dest = tileWorld(path[path.length - 1]);
      this.placeToken(tk, dest.x, dest.z + 0.15);
      tk.pet?.placeNear({ x: dest.x, z: dest.z, right: true });
      this.fx.emit('fx_stardust', dest.x, 0.3, dest.z, 14, { speed: 1.5, up: 1.8, size: 0.4, life: 0.7 });
      this.ripple(dest.x, dest.z, { color: '#c9a2ff', r0: 0.2, r1: 1.6, dur: 0.45 });
      await this.tween(0.3, (k) => { const s = ease.outBack(k); tk.rig?.ROOT.scale.setScalar(Math.max(0.01, s)); tk.pawn?.scale.setScalar(Math.max(0.01, s)); });
      sfx.step(7);
      this.landRipple(path[path.length - 1]);
      return;
    }
    const N = TILES.length;
    const startPos = this.state?.players?.[seat]?.pos;
    const forward = path.length > 1 ? (path[1] - path[0] + N) % N === 1 : startPos == null || (path[0] - startPos + N) % N === 1;
    let startDone = false;
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
      if (tk.pawn) tk.pawn.position.y = 0;
      sfx.step(n);
      const last = n === path.length - 1;
      if (!last) { this.pressTile(path[n]); this.squash(tk, 0.07, 0.14); }
      if (path[n] === 0 && forward && !startDone && kind !== 'push' && kind !== 'pull') { startDone = true; this.celebrateStart(seat); }
      if (kind === 'push') this.fx.emit('fx_bubble', tk.x, 0.2, tk.z, 4, { speed: 0.8, up: 1, size: 0.3, life: 0.6, tint: [0.5, 0.85, 1] });
      else if (kind === 'pull') this.fx.emit('fx_stardust', tk.x, 0.2, tk.z, 3, { speed: 0.6, up: 0.8, size: 0.3, life: 0.6, tint: [0.75, 0.5, 1] });
      else if (tk.walkFx) {
        const wf = tk.walkFx;
        this.fx.emit(wf.stepCell, tk.x, 0.08, tk.z, 3, { speed: wf.speed, up: wf.up, size: wf.size * 1.15, life: wf.life, gravity: wf.gravity, tint: wf.tint });
        this.fx.emit(wf.trailCell, tk.x, 0.14, tk.z, 2, { speed: wf.speed * 0.6, up: wf.up * 0.7, size: wf.size, life: wf.life, gravity: wf.gravity, tint: wf.tint });
      } else this.fx.emit('fx_stardust', tk.x, 0.05, tk.z, 2, { speed: 0.4, up: 0.5, size: 0.22, life: 0.45, gravity: 0.6 });
    }
    tk.moving = false; tk.vx = 0; tk.vz = 0;
    this.landRipple(path[path.length - 1], tk);
  }

  /** Rent / transfers: a ballistic coin stream from payer to owner, arrival burst + tinkles. */
  coins(fromSeat, toSeat, amount = 100) {
    const a = fromSeat == null ? null : this.tokens[fromSeat];
    const b = toSeat == null ? null : this.tokens[toSeat];
    const n = Math.min(14, 4 + Math.floor((amount || 0) / 100));
    if (a && b) {
      const T = 0.55, stagger = 0.035;
      this.fx.emitTo('fx_chip', a.x, 1.0, a.z, b.x, 1.1, b.z, n, { time: T, arc: 1.3, size: 0.32, tint: GOLD, stagger });
      this.fx.emit('fx_star', b.x, 1.1, b.z, 8, { delay: T, speed: 1.8, up: 1.6, size: 0.3, life: 0.55, gravity: 2, ring: true, tint: GOLD });
      this.squash(a, 0.1, 0.2);
      sfx.coinStream(n, T + n * stagger, { at: 0.08 });
      this.wait(T).then(() => { this.ripple(b.x, b.z, { color: '#ffd34d', r0: 0.3, r1: 1.2, dur: 0.4 }); this.squash(b, 0.12, 0.24); b.pet?.act?.('happy', 0.8); });
      if (amount >= 600) this.hitStop(40);
      return;
    }
    if (a) this.fx.emit('fx_chip', a.x, 1.0, a.z, n, { speed: 1.4, up: 2.4, size: 0.3, life: 0.8, gravity: 3, tint: GOLD });
    if (b) this.fx.emitTo('fx_chip', b.x, 4.5, b.z, b.x, 1.0, b.z, n, { time: 0.5, arc: 0.2, size: 0.3, tint: GOLD, stagger: 0.03, jitter: 1.2 });
  }

  createRowLaser(seat, x, z, glow) {
    const casterTile = this.state?.players?.[seat]?.pos ?? 0;
    const tw = tileWorld(casterTile);
    const side = tileSide(casterTile);
    const horiz = side === 0 || side === 2;
    const group = new THREE.Group();
    const outer = new THREE.Mesh(
      new THREE.BoxGeometry(horiz ? W + 2.5 : 1.45, 0.95, horiz ? 1.45 : D + 2.5),
      new THREE.MeshBasicMaterial({ color: '#ffd34d', transparent: true, opacity: 0.48, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })
    );
    const core = new THREE.Mesh(
      new THREE.BoxGeometry(horiz ? W + 2.5 : 0.65, 0.45, horiz ? 0.65 : D + 2.5),
      new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.52, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })
    );
    outer.renderOrder = 5;
    core.renderOrder = 6;
    group.add(outer, core);
    group.position.set(horiz ? 0 : tw.x, 0.60, horiz ? tw.z : 0);
    group.material = {
      set opacity(val) {
        outer.material.opacity = 0.48 * val;
        core.material.opacity = 0.52 * val;
      },
    };
    return group;
  }

  createSkyBeam(color, x, z, glow) {
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.85, 24, 16, 1, true),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.50, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })
    );
    beam.position.set(x, 12, z);
    beam.renderOrder = 5;
    return beam;
  }

  /**
   * 3-Beat Mythic Ultimate Cast Animation (Zero-Lag, 1-Draw-Call FX + Cached 2.5D Spell Monuments):
   *  Beat 1: Caster Chibi & Pet perform their cast pose over a glowing arcane ring (+ Couple Synergy partner).
   *  Beat 2: Signature painted 2.5D Spell Monument (`mono_ult_*`) rises with themed particle bursts.
   *  Beat 3: Direct impact strikes on affected target tiles & rivals on the board.
   */
  async ultVfx(seat, vfx, ultEv = {}, batchEvents = []) {
    const tk = this.tokens[seat];
    const x = tk?.x ?? 0, z = tk?.z ?? 0;
    const skillId = ultEv?.skillId || tk?.outfit || '';
    const spec = ULT_SPECS[skillId] || ULT_SPECS[SUPER_BY_THEME[ultEv?.superVfx || ultEv?.fxTheme]] || {
      sprite: vfx === 'pillar' ? 'mono_ult_zeus' : vfx === 'crystal' ? 'mono_ult_glacial' : vfx === 'wave' ? 'mono_ult_naga' : vfx === 'vortex' ? 'mono_ult_astral' : vfx === 'projectile' ? 'mono_ult_phoenix' : 'mono_ult_roulette',
      p1: 'fx_magic_circle', p2: 'fx_stardust', tint: [1.0, 0.88, 0.42], color: '#ffd34d', center: false, choreo: 'glacier_erupt',
    };
    const choreo = spec.choreo || 'glacier_erupt';
    // speed rules (spec §2): bots = one ~1.2 s beat (cut-in + this), repeats of the same cinematic ≈ 60%
    const fast = !!ultEv?.fast, rep = !fast && !!ultEv?.repeat;
    const S = fast ? 0.7 : rep ? 0.6 : 1;
    if (fast || rep) sfx.ultShort(); else sfx.ult();
    this._activeUlts = (this._activeUlts || 0) + 1;
    this._activeUltCenter = !!spec.center;
    const pScale = (this._activeUlts > 1 ? 0.55 : 1) * (fast ? 0.6 : 1);
    const g = new THREE.Group();
    this.scene.add(g);
    const glow = (color, o = {}) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide, ...o });

    // Discover target tiles & target rivals BEFORE Beat 2 so choreography can aim/travel toward them!
    const hitTiles = new Set();
    const hitSeats = new Set();
    for (const ev of batchEvents) {
      if ((ev.t === 'tier' || ev.t === 'modifier' || ev.t === 'steal') && ev.tile != null) hitTiles.add(ev.tile);
      if (ev.t === 'swap') { if (ev.a != null) hitTiles.add(ev.a); if (ev.b != null) hitTiles.add(ev.b); }
      if ((ev.t === 'status' || ev.t === 'move' || ev.t === 'shield_break') && ev.seat != null && ev.seat !== seat) hitSeats.add(ev.seat);
      if (ev.t === 'cash' && ev.from != null && ev.from !== seat) hitSeats.add(ev.from);
    }
    const primarySeat = [...hitSeats][0];
    const primaryRivalTk = primarySeat != null ? this.tokens[primarySeat] : null;
    const primaryTileIdx = [...hitTiles][0];
    const primaryTilePos = primaryTileIdx != null ? tileWorld(primaryTileIdx) : null;
    const tx = primaryRivalTk?.x ?? primaryTilePos?.x ?? (spec.center ? 0 : x * 0.45);
    const tz = primaryRivalTk?.z ?? primaryTilePos?.z ?? (spec.center ? 0 : z * 0.45);

    try {
      // --- BEAT 1: Caster & Pet Wind-Up + Separate Dynamic Floor Magic Circles ---
      this.followSeat = seat;
      tk?.rig?.triggerCast?.(1.2);
      tk?.pet?.act?.('cast', 1.25);
      if (ultEv?.partnerSeat != null && this.tokens[ultEv.partnerSeat]) {
        const ptk = this.tokens[ultEv.partnerSeat];
        ptk.rig?.triggerCast?.(1.1);
        ptk.pet?.act?.('happy', 1.2);
        this.fx.emit('fx_heart', ptk.x, 1.1, ptk.z, 8, { speed: 1.4, up: 2.0, size: 0.36, life: 0.85 });
      }
      const casterRing = groundRuneCircle('fx_magic_circle', 2.45, spec.color, { opacity: 0.92, y: 0.045 });
      casterRing.position.set(x, 0.045, z);
      g.add(casterRing);
      const casterInner = groundRuneCircle('fx_rune', 1.75, '#ffffff', { opacity: 0.78, y: 0.052 });
      casterInner.position.set(x, 0.052, z);
      g.add(casterInner);
      this.fx.emit(spec.p2, x, 0.25, z, Math.round(14 * pScale), { speed: 1.6, up: 1.9, size: 0.44, life: 0.80, tint: spec.tint });

      // --- BEAT 2: Unique 3D Kinetic Choreography per Skill Entity ---
      const baseY = 0.42;
      const sx = x * (spec.center ? 0.64 : 0.80);
      const sz = z * (spec.center ? 0.64 : 0.80);
      const mx = sx;
      const mz = sz;
      const superPromise = (spec.superVfx && !fast) ? this.superVfx(spec, seat, S, batchEvents) : null;

      const spellSize = spec.size || (spec.center ? 3.05 : 2.65);
      const spellHalo = packSprite('fx_shockwave', spellSize * 1.05, { additive: true, color: spec.color });
      if (spellHalo) {
        spellHalo.center.set(0.5, 0.5);
        spellHalo.position.set(mx, baseY + spellSize * 0.45, mz - 0.05);
        spellHalo.renderOrder = 9;
        spellHalo.userData.baseW = spellHalo.scale.x;
        spellHalo.userData.baseH = spellHalo.scale.y;
        spellHalo.scale.setScalar(0.01);
        g.add(spellHalo);
      }
      const spellSp = packSprite(spec.sprite, spellSize);
      if (spellSp) {
        if (choreo === 'spin_wheel' || choreo === 'clock_rewind' || choreo === 'gravity_singularity' || choreo === 'cyber_hack') {
          spellSp.center.set(0.5, 0.5);
        }
        spellSp.position.set(mx, baseY, mz);
        spellSp.renderOrder = 10;
        spellSp.userData.baseW = spellSp.scale.x;
        spellSp.userData.baseH = spellSp.scale.y;
        spellSp.scale.setScalar(0.01);
        g.add(spellSp);
      }
      // Twin portal sprite for Sultan Djinn lamp_summon or Phantom twin_mirrors
      let twinSp = null;
      if (!fast && (choreo === 'lamp_summon' || choreo === 'twin_mirrors')) {
        twinSp = packSprite(spec.sprite, spellSize * 0.82);
        if (twinSp) {
          twinSp.position.set(tx, baseY, tz);
          twinSp.renderOrder = 10;
          twinSp.userData.baseW = twinSp.scale.x;
          twinSp.userData.baseH = twinSp.scale.y;
          twinSp.scale.setScalar(0.01);
          g.add(twinSp);
        }
      }

      const beams = [];
      if (spec.rowLaser) {
        const laser = this.createRowLaser(seat, x, z, glow);
        g.add(laser);
        beams.push(laser);
      }
      if (spec.skyStrike || choreo === 'sky_artillery' || choreo === 'orbital_laser') {
        const bx = (choreo === 'sky_artillery' && primaryRivalTk) ? tx : sx;
        const bz = (choreo === 'sky_artillery' && primaryRivalTk) ? tz : sz;
        const sky = this.createSkyBeam(spec.color, bx, bz, glow);
        g.add(sky);
        beams.push(sky);
      }

      const beat2Dur = (spec.superVfx ? 1.25 : 0.78) * S;
      const choreoTween = this.tween(beat2Dur, (k) => {
        const pop = ease.outBack(Math.min(1, k * 1.45));
        casterRing.scale.setScalar(0.75 + k * 0.85);
        casterRing.material.opacity = 0.92 * (1 - k * 0.55);
        casterRing.rotation.z = k * 3.8;
        casterInner.scale.setScalar(0.85 + k * 0.65);
        casterInner.material.opacity = 0.78 * (1 - k * 0.60);
        casterInner.rotation.z = -k * 5.2;

        if (spellSp) {
          const bw = spellSp.userData.baseW, bh = spellSp.userData.baseH;
          if (choreo === 'surf_wave') {
            // Naga Sea-Serpent surfs along the caster's row with a cresting wave bob
            const side = tileSide(this.state?.players?.[seat]?.pos ?? 0);
            const rowTiles = TILES.filter((t) => tileSide(t.i) === side);
            const p0 = rowTiles.length ? tileWorld(rowTiles[0].i) : { x: mx, z: mz };
            const p1 = rowTiles.length ? tileWorld(rowTiles[Math.min(rowTiles.length - 1, 2)].i) : { x: tx, z: tz };
            const u = ease.inOut(k);
            spellSp.position.set(p0.x + (p1.x - p0.x) * u, baseY + Math.sin(k * Math.PI * 3) * 0.28, p0.z + (p1.z - p0.z) * u);
            spellSp.scale.set(bw * pop, bh * pop, 1);
            spellSp.material.rotation = Math.sin(k * Math.PI * 3) * 0.14;
          } else if (choreo === 'sky_dive' || choreo === 'dragon_eclipse') {
            // Phoenix / Eclipse Dragon swoops down from high sky arc into the camera frame
            const u = ease.outQuint(Math.min(1, k * 1.35));
            spellSp.position.set(
              mx + (tx - mx) * 0.25 * u,
              baseY + (1 - u) * 2.4 + Math.sin(k * Math.PI * 2) * 0.28,
              mz + (tz - mz) * 0.25 * u
            );
            spellSp.scale.set(bw * pop, bh * pop, 1);
            spellSp.material.rotation = (1 - u) * -0.22;
          } else if (choreo === 'sky_artillery' || choreo === 'trident_plunge') {
            // Zeus Thunderbolt / Poseidon Trident plunges straight down from the heavens
            const drop = ease.outQuint(Math.min(1, k * 1.6));
            const px = (choreo === 'sky_artillery' && primaryRivalTk) ? tx : mx;
            const pz = (choreo === 'sky_artillery' && primaryRivalTk) ? tz : mz;
            spellSp.position.set(px, baseY + (1 - drop) * 3.6, pz);
            spellSp.scale.set(bw * (0.75 + 0.25 * drop), bh * (1.35 - 0.35 * drop), 1);
          } else if (choreo === 'spin_wheel') {
            // Royal Roulette wheel spins rapidly and bounces like a casino wheel
            spellSp.position.set(mx, baseY + spellSize * 0.45 + Math.sin(k * Math.PI) * 0.35, mz);
            spellSp.scale.set(bw * pop, bh * pop, 1);
            spellSp.material.rotation = k * Math.PI * 4.5;
          } else if (choreo === 'clock_rewind') {
            // Cinderella Clock ticks forward then rewinds counter-clockwise rapidly
            spellSp.position.set(mx, baseY + spellSize * 0.48, mz);
            spellSp.scale.set(bw * pop, bh * pop, 1);
            const angle = k < 0.35 ? (k / 0.35) * 0.6 : 0.6 - ((k - 0.35) / 0.65) * Math.PI * 3.2;
            spellSp.material.rotation = angle;
          } else if (choreo === 'lunar_domain') {
            // Tsukuyomi Crescent Moon Scythe sweeps a wide horizontal arc toward target rival
            const u = ease.outQuint(k);
            spellSp.position.set(mx + (tx - mx) * 0.35 * u, baseY + 0.35 + Math.sin(k * Math.PI) * 0.35, mz + (tz - mz) * 0.35 * u);
            spellSp.scale.set(bw * pop, bh * pop, 1);
            spellSp.material.rotation = -0.45 + u * 0.9;
          } else if (choreo === 'portal_ambush') {
            // Kitsune Fox Spirit leaps forward in a high graceful Torii parabola
            const u = ease.inOut(k);
            spellSp.position.set(mx + (tx - mx) * 0.35 * u, baseY + Math.abs(Math.sin(k * Math.PI * 2)) * 0.65, mz + (tz - mz) * 0.35 * u);
            spellSp.scale.set(bw * pop, bh * pop, 1);
          } else if (choreo === 'gravity_singularity') {
            // Astral Black Hole implodes inward then bursts outward
            const pulse = k < 0.7 ? pop * (1 - 0.18 * Math.sin(k * 18)) : pop * (1 + (k - 0.7) * 1.2);
            spellSp.position.set(mx, baseY + spellSize * 0.48, mz);
            spellSp.scale.set(bw * pulse, bh * pulse, 1);
            spellSp.material.rotation = -k * Math.PI * 2.4;
          } else if (choreo === 'cyber_hack') {
            // Cyber Archon Quantum Tesseract locks onto target with digital glitch jitter
            const jitter = (k > 0.2 && k < 0.8) ? (Math.sin(k * 90) * 0.10) : 0;
            spellSp.position.set(mx + jitter, baseY + spellSize * 0.48, mz);
            spellSp.scale.set(bw * pop, bh * pop, 1);
            spellSp.material.rotation = Math.sin(k * Math.PI * 4) * 0.22;
          } else if (choreo === 'rose_cathedral' || choreo === 'aurora_seraph') {
            // Seraphim Rose Cathedral / Aurora Seraph descends serenely from celestial light
            const u = ease.outQuint(Math.min(1, k * 1.4));
            spellSp.position.set(mx, baseY + (1 - u) * 1.6 + Math.sin(k * Math.PI * 2) * 0.15, mz);
            spellSp.scale.set(bw * pop, bh * pop, 1);
          } else if (choreo === 'ribbon_parade') {
            // Starlight Ribbon Wand dances in a figure-8 arc across the board
            spellSp.position.set(mx + Math.sin(k * Math.PI * 2) * 0.55, baseY + 0.35 + Math.sin(k * Math.PI * 4) * 0.22, mz + Math.cos(k * Math.PI * 2) * 0.35);
            spellSp.scale.set(bw * pop, bh * pop, 1);
            spellSp.material.rotation = Math.sin(k * Math.PI * 2) * 0.22;
          } else {
            // domino_glacier / orbital_laser / lamp_summon / twin_mirrors
            spellSp.scale.set(bw * pop, bh * pop, 1);
            spellSp.position.y = baseY + Math.sin(k * Math.PI) * 0.28;
          }
          if (spellHalo) {
            spellHalo.position.set(spellSp.position.x, spellSp.position.y + (spellSp.center.y < 0.2 ? spellSize * 0.45 : 0), spellSp.position.z - 0.05);
            spellHalo.scale.set(spellHalo.userData.baseW * pop, spellHalo.userData.baseH * pop, 1);
            spellHalo.material.rotation = k * 3.2;
            spellHalo.material.opacity = 0.52 * Math.sin(k * Math.PI);
          }
        }
        if (twinSp) {
          twinSp.scale.set(twinSp.userData.baseW * pop, twinSp.userData.baseH * pop, 1);
          twinSp.position.y = baseY + Math.sin(k * Math.PI) * 0.28;
        }
        for (const b of beams) {
          const pulse = Math.pow(Math.sin(k * Math.PI), 2);
          b.material.opacity = 0.48 * pulse;
          this.shake = 0.18 * (1 - k);
        }
      });
      await Promise.all([choreoTween, superPromise].filter(Boolean));

      const impX = spellSp ? spellSp.position.x : sx;
      const impZ = spellSp ? spellSp.position.z : sz;
      if (!fast) { this.hitStop(40); this.sway(0.08); sfx.impact(); }
      this.ripple(impX, impZ, { color: spec.color, r0: 0.5, r1: spec.center ? 4.5 : 3, dur: 0.5 * S });
      this.fx.emit(spec.p1, impX, 0.9, impZ, Math.round(24 * pScale), { speed: 2.7, up: 2.6, size: 0.46, life: 0.85, gravity: 1.1, tint: spec.tint });
      this.fx.emit(spec.p2, impX, 0.6, impZ, Math.round(16 * pScale), { speed: 2.1, up: 2.0, size: 0.40, life: 0.80, gravity: 0.8, tint: spec.tint });

      // --- BEAT 3: Target Tile & Rival Impact Strikes (Using Dedicated Tile Props!) ---
      const strikeSprites = [];
      const strikeSeals = [];
      const tileSpriteKey = spec.tileProp || spec.sprite;
      for (const ti of [...hitTiles].slice(0, 5)) {
        const tw = tileWorld(ti);
        this.pressTile(ti);
        this.fx.emit(spec.p1, tw.x, 0.55, tw.z, Math.round(12 * pScale), { speed: 2.1, up: 2.2, size: 0.42, life: 0.75, tint: spec.tint });
        this.fx.emit(spec.p2, tw.x, 0.35, tw.z, Math.round(8 * pScale), { speed: 1.6, up: 1.6, size: 0.38, life: 0.70, tint: spec.tint });
        if (!fast) {
          const seal = groundRuneCircle('fx_rune', 1.85, spec.color, { opacity: 0.85, y: 0.048 });
          seal.position.set(tw.x, 0.048, tw.z);
          g.add(seal);
          strikeSeals.push(seal);
        }
        const st = fast ? null : packSprite(tileSpriteKey, spec.tileProp ? 1.38 : 1.55);
        if (st) {
          st.position.set(tw.x, 0.36, tw.z + 0.1);
          st.renderOrder = 6;
          st.userData.baseW = st.scale.x;
          st.userData.baseH = st.scale.y;
          g.add(st);
          strikeSprites.push(st);
        }
      }
      for (const rs of hitSeats) {
        const rtk = this.tokens[rs];
        if (!rtk) continue;
        this.fx.emit(spec.p1, rtk.x, 0.85, rtk.z, Math.round(12 * pScale), { speed: 1.9, up: 2.0, size: 0.40, life: 0.75, tint: spec.tint });
      }

      if (strikeSprites.length || spellSp || twinSp) {
        await this.tween(0.38 * S, (k) => {
          const fade = 1 - k;
          if (spellSp?.material) spellSp.material.opacity = fade;
          if (twinSp?.material) twinSp.material.opacity = fade;
          if (spellHalo?.material) spellHalo.material.opacity = 0.45 * fade;
          for (const seal of strikeSeals) {
            seal.rotation.z = k * 3.0;
            seal.scale.setScalar(0.75 + k * 0.45);
            seal.material.opacity = 0.85 * fade;
          }
          for (const st of strikeSprites) {
            const s = ease.outBack(Math.min(1, k * 1.8));
            st.scale.set(st.userData.baseW * s, st.userData.baseH * s, 1);
            if (st.material) st.material.opacity = k < 0.65 ? 1 : (1 - k) / 0.35;
          }
        });
      }
    } finally {
      this._activeUlts = Math.max(0, (this._activeUlts || 1) - 1);
      if (this._activeUlts === 0) this._activeUltCenter = false;
      this.shake = 0;
      this.scene.remove(g);
      disposeObj(g);
    }
  }

  // ----------------------------------------------------------------------------- dopamine cinematics
  /** Smoothly dim (k=1) / restore (k=0) the board: lights, sky and a ground shade plane. */
  dimBoard(k = 0.6, dur = 0.35) {
    if (!this._dimPlane) {
      this._dimPlane = new THREE.Mesh(new THREE.PlaneGeometry(W + 1.2, D + 1.2).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#0b0820', transparent: true, opacity: 0, depthWrite: false }));
      this._dimPlane.position.y = 0.03;
      this._dimPlane.renderOrder = 3;
      this._dimPlane.visible = false;
      this.scene.add(this._dimPlane);
    }
    if (k > 0) {
      this._dimRefCount = (this._dimRefCount || 0) + 1;
    } else {
      this._dimRefCount = Math.max(0, (this._dimRefCount || 0) - 1);
      if (this._dimRefCount > 0) return Promise.resolve();
    }
    const from = this._dimK || 0, to = Math.max(0, Math.min(1, k)) * (REDUCED_MOTION ? 0.7 : 1);
    const dark = _col.set('#140c2a');
    const darkR = dark.r, darkG = dark.g, darkB = dark.b;
    const plane = this._dimPlane;
    plane.visible = true;
    return this.tween(dur, (u) => {
      const d = from + (to - from) * ease.inOut(u);
      this._dimK = d;
      this.hemi.intensity = 1.6 * (1 - 0.65 * d);
      this.sun.intensity = 1.5 * (1 - 0.7 * d);
      const b = this._bg0;
      this.scene.background.setRGB(b.r + (darkR - b.r) * d, b.g + (darkG - b.g) * d, b.b + (darkB - b.b) * d);
      plane.material.opacity = 0.5 * d;
    }).then(() => { if ((this._dimK || 0) < 0.001) plane.visible = false; });
  }

  /** ✦ Super Mythic spectacle layer — each of the 5 Super Mythics has a 100% distinct domain choreography! */
  async superVfx(spec, seat, S = 1, batchEvents = []) {
    const tk = this.tokens[seat];
    const x = tk?.x ?? 0, z = tk?.z ?? 0;
    const pos = this.state?.players?.[seat]?.pos ?? 0;
    const N = TILES.length;
    const pScale = (this._activeUlts > 1 ? 0.55 : 1) * (S < 1 ? 0.6 : 1) * (this.lowFx ? 0.5 : 1);
    const g = new THREE.Group();
    this.scene.add(g);
    try {
      if (spec.superVfx === 'eclipse_domain') {
        // ☀️ ECLIPSE DRAGON: Total Solar Eclipse dims the board and a blazing black-sun corona sweeps the caster's row
        sfx.whoosh(0.6);
        await this.dimBoard(0.85, 0.35 * S);
        const side = tileSide(pos);
        const tiles = TILES.filter((t) => tileSide(t.i) === side).map((t) => t.i);
        const pts = tiles.map((i) => tileWorld(i));
        const core = new THREE.Mesh(new THREE.CircleGeometry(0.75, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#05030a', transparent: true, opacity: 0.92, depthWrite: false }));
        const corona = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.35, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffb800', transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
        const halo = new THREE.Mesh(new THREE.RingGeometry(1.35, 2.1, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ff7a00', transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
        core.position.y = 0.09; corona.position.y = 0.1; halo.position.y = 0.08;
        core.renderOrder = corona.renderOrder = halo.renderOrder = 7;
        const ringG = new THREE.Group();
        ringG.add(core, corona, halo);
        g.add(ringG);
        this.pillar(x, z, { color: '#ffb800', dur: 0.65 * S, h: 7, r: 0.38 });
        let lastIdx = -1;
        await this.tween(0.95 * S, (k) => {
          const f = ease.inOut(k) * (pts.length - 1);
          const i0 = Math.floor(f), i1 = Math.min(pts.length - 1, i0 + 1), fr = f - i0;
          const px = pts[i0].x + (pts[i1].x - pts[i0].x) * fr, pz = pts[i0].z + (pts[i1].z - pts[i0].z) * fr;
          ringG.position.set(px, 0, pz);
          ringG.rotation.y = k * 9;
          const pulse = 1 + 0.08 * Math.sin(k * 40);
          ringG.scale.setScalar(Math.min(1, k * 6) * pulse);
          if (Math.round(f) !== lastIdx) {
            lastIdx = Math.round(f);
            const ti = tiles[lastIdx];
            this.pressTile(ti, 0.1);
            this.fx.emit('fx_flame', px, 0.3, pz, Math.max(1, Math.round(6 * pScale)), { speed: 1.6, up: 2.2, size: 0.4, life: 0.7, gravity: 0.5, tint: [1, 0.72, 0.2] });
            sfx.diceTick(lastIdx);
          }
        });
        this.hitStop(55); this.sway(0.14); sfx.shockwave();
        this.ripple(ringG.position.x, ringG.position.z, { color: '#ffb800', r0: 0.5, r1: 4, dur: 0.5 * S });
        this.dimBoard(0, 0.55 * S);
      } else if (spec.superVfx === 'quantum_overdrive') {
        // 💠 CYBER ARCHON: 4 Orbital Fin-Funnel Laser Beams lock onto target tiles & hack them with cyan/magenta reticles
        sfx.whoosh(0.6);
        await this.dimBoard(0.78, 0.3 * S);
        const targets = [];
        for (const ev of batchEvents) {
          if ((ev.t === 'tier' || ev.t === 'modifier') && ev.tile != null) targets.push(tileWorld(ev.tile));
          if (ev.t === 'shield_break' && ev.seat != null && this.tokens[ev.seat]) targets.push({ x: this.tokens[ev.seat].x, z: this.tokens[ev.seat].z });
        }
        if (!targets.length) targets.push({ x: 0, z: 0 });
        const reticles = targets.slice(0, 4).map((pt, idx) => {
          const r = groundRuneCircle('fx_shockwave', 1.9, idx % 2 ? '#ff38e0' : '#2ef7ff', { opacity: 0.9, y: 0.06 });
          r.position.set(pt.x, 0.06, pt.z);
          g.add(r);
          this.pillar(pt.x, pt.z, { color: idx % 2 ? '#ff38e0' : '#2ef7ff', dur: 0.7 * S, h: 6.5, r: 0.28 });
          return { r, pt };
        });
        await this.tween(0.85 * S, (k) => {
          for (const { r, pt } of reticles) {
            r.rotation.z = k * 8.0;
            r.scale.setScalar(1.35 - 0.45 * k);
            if (Math.random() < 0.35) {
              this.fx.emit('fx_lightning', pt.x, 0.4, pt.z, 2, { speed: 1.8, up: 2.2, size: 0.38, life: 0.55, tint: [0.22, 0.96, 1.0] });
            }
          }
        });
        this.hitStop(50); this.sway(0.12); sfx.shockwave();
        this.dimBoard(0, 0.5 * S);
      } else if (spec.superVfx === 'seraphim_sanctuary') {
        // 🌹 SERAPHIM ROSE: Golden Stained-Glass Cathedral Sanctuary Ring & Blooming Rose Vines around caster's flagship
        await this.dimBoard(0.55, 0.28 * S);
        const sanctRing = groundRuneCircle('fx_magic_circle', 3.6, '#ff6ea8', { opacity: 0.9, y: 0.05 });
        sanctRing.position.set(x, 0.05, z);
        g.add(sanctRing);
        this.pillar(x, z, { color: '#ffd166', dur: 0.85 * S, h: 6.8, r: 0.52 });
        await this.tween(0.95 * S, (k) => {
          sanctRing.rotation.z = k * 3.2;
          sanctRing.scale.setScalar(0.6 + 0.65 * ease.outBack(k));
          sanctRing.material.opacity = 0.9 * Math.sin(k * Math.PI);
          if (Math.random() < 0.45) {
            const ang = Math.random() * Math.PI * 2;
            this.fx.emit('fx_petal', x + Math.cos(ang) * 1.4, 1.6, z + Math.sin(ang) * 1.4, 2, { speed: 0.9, up: 1.2, size: 0.36, life: 0.9, tint: [1.0, 0.55, 0.78] });
          }
        });
        this.hitStop(45); sfx.sparkle();
        this.dimBoard(0, 0.5 * S);
      } else if (spec.superVfx === 'starlight_parade') {
        // 🎀 STARLIGHT RIBBON: Joyful Starlight Gift Parade hopping across tiles & dropping ribbon gift boxes
        await this.dimBoard(0.48, 0.25 * S);
        const hopTiles = [pos, (pos + 1) % N, (pos + 2) % N, (pos + 3) % N];
        sfx.chaos('swap');
        for (let idx = 0; idx < hopTiles.length; idx++) {
          const ti = hopTiles[idx];
          const tw = tileWorld(ti);
          this.pressTile(ti, 0.09);
          this.ripple(tw.x, tw.z, { color: idx % 2 ? '#ff85d8' : '#7ae7ff', r0: 0.3, r1: 1.6, dur: 0.45 });
          this.fx.emit('fx_heart', tw.x, 0.9, tw.z, Math.max(2, Math.round(5 * pScale)), { speed: 1.3, up: 1.8, size: 0.36, life: 0.85, tint: [1.0, 0.62, 0.9] });
          this.fx.emit('fx_star', tw.x, 1.1, tw.z, Math.max(2, Math.round(5 * pScale)), { speed: 1.5, up: 2.0, size: 0.38, life: 0.85, tint: [0.55, 0.92, 1.0] });
          sfx.sparkle();
          await this.tween(0.18 * S, () => {});
        }
        this.hitStop(40);
        this.dimBoard(0, 0.45 * S);
      } else if (spec.superVfx === 'aurora_veil') {
        // 🌌 AURORA EMPRESS: Luminous Northern Lights Curtain Veil washing across own properties & freezing rivals in slow-mo
        await this.dimBoard(0.55, 0.3 * S);
        const owned = [];
        for (let d = -3; d <= 3; d++) {
          const i = (pos + d + N) % N;
          if (this.state?.tiles?.[i]?.owner === seat || d === 0) owned.push({ i, d: Math.abs(d) });
        }
        const tex = auroraTexture();
        const curtains = owned.map(({ i, d }, n) => {
          const { x: tx, z: tz } = tileWorld(i);
          const m = new THREE.Mesh(new THREE.PlaneGeometry(BOARD.TILE * 0.95, 2.6).translate(0, 1.3, 0), new THREE.MeshBasicMaterial({ map: tex, color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
          m.position.set(tx, 0.02, tz);
          m.renderOrder = 7;
          g.add(m);
          return { m, i, delay: d * 0.14, n };
        });
        sfx.chaos('swap');
        const dur = 1.15 * S;
        const hit = new Set();
        await this.tween(dur, (k) => {
          const t = k * dur;
          for (const c of curtains) {
            const u = Math.max(0, Math.min(1, (t - c.delay * S) / (0.75 * S)));
            c.m.material.opacity = 0.85 * Math.sin(u * Math.PI);
            c.m.scale.set(1, 0.2 + 0.8 * ease.outQuint(u), 1);
            c.m.lookAt(this.camera.position.x, c.m.position.y, this.camera.position.z);
            if (u > 0 && !hit.has(c.i)) {
              hit.add(c.i);
              const { x: tx, z: tz } = tileWorld(c.i);
              this.pressTile(c.i, 0.07);
              this.ripple(tx, tz, { color: c.n % 2 ? '#c49bff' : '#7fffe0', r0: 0.3, r1: 1.4, dur: 0.5 });
              this.fx.emit('fx_snowflake', tx, 1.2, tz, Math.max(1, Math.round(6 * pScale)), { speed: 0.8, up: 1.4, size: 0.32, life: 1.0, gravity: 0.2, tint: c.n % 2 ? [0.8, 0.6, 1] : [0.5, 1, 0.9] });
              sfx.sparkle();
            }
          }
        });
        this.hitStop(45);
        this.dimBoard(0, 0.55 * S);
      }
    } finally {
      this.scene.remove(g);
      disposeObj(g);
    }
  }

  /**
   * 🔗 Soul-Link Combo cinematic (~3.2 s full; ev.fast ≈ 1.3 s; ev.repeat ≈ 60 %).
   * opts = the engine's `pet_combo` event: { petId, outfitId, ownerSkillId, bonus, fast, repeat, petColor? }
   *  1. pet leaps beside the chibi → back-to-back pose (twin rings, owner + pet colours)
   *  2. owner's spell monument rises infused with the pet's colour, fused particle spiral
   *  3. merged double shockwave + special combo float
   */
  async playCombo(seat, opts = {}) {
    const tk = this.tokens[seat];
    if (!tk) return;
    const fast = !!opts.fast, rep = !fast && !!opts.repeat;
    const S = fast ? 0.42 : rep ? 0.6 : 1;
    const ownKey = opts.ownerSkillId || opts.outfitId || tk.outfit;
    const spec = ULT_SPECS[ownKey] || ULT_SPECS[opts.outfitId] || { sprite: 'mono_ult_astral', p1: 'fx_magic_circle', p2: 'fx_stardust', tint: [1, 0.88, 0.42], color: '#ffd34d' };
    const petKey = opts.skillId || opts.petCostume || '';
    const petSpec = (petKey && petKey !== ownKey) ? ULT_SPECS[petKey] : null;
    const petHex = opts.petColor || (petSpec ? petSpec.color : petTint(opts.petId || tk.pet?.petId || tk.pet?.id || ''));
    const ownRgb = spec.tint, petRgb = petSpec ? petSpec.tint : rgb(petHex), fuse = mixRgb(ownRgb, petRgb, 0.5);
    this.followSeat = seat;
    this._activeUlts = (this._activeUlts || 0) + 1;
    const pScale = (this._activeUlts > 1 ? 0.55 : 1) * (fast ? 0.6 : 1) * (this.lowFx ? 0.5 : 1);
    if (fast) sfx.ultShort(); else sfx.combo();
    const g = new THREE.Group();
    this.scene.add(g);
    const glow = (color, o = {}) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, ...o });
    try {
      // --- BEAT 1: leap + back-to-back
      const x = tk.x, z = tk.z;
      const pet = tk.pet;
      const px0 = Number.isFinite(pet?.x) ? pet.x : x + 0.9, pz0 = Number.isFinite(pet?.z) ? pet.z : z;
      const px1 = x + 0.62, pz1 = z + 0.04;
      tk.rig?.facing?.set?.(false, false);
      pet?.act?.('happy', 1.2 * S);
      this.fx.emit('fx_stardust', px0, 0.1, pz0, Math.max(1, Math.round(6 * pScale)), { speed: 0.9, up: 0.6, size: 0.3, life: 0.5, gravity: 1 });
      sfx.whoosh(0.3);
      await this.tween(0.55 * S, (k) => {
        const e = ease.inOut(k);
        if (pet?.follower) { pet.follower.x = px0 + (px1 - px0) * e; pet.follower.z = pz0 + (pz1 - pz0) * e; }
        tk.petLift = Math.sin(k * Math.PI) * 1.1;
      });
      tk.petLift = 0;
      pet?.facing?.set?.(true, false);
      tk.rig?.triggerCast?.(1.6 * S);
      pet?.act?.('cast', 1.6 * S);
      this.squash(tk, 0.14, 0.26);
      this.hitStop(35);
      const cx = (x + px1) / 2, cz = (z + pz1) / 2;
      this.ripple(cx, cz, { color: '#ffffff', r0: 0.3, r1: 1.8, dur: 0.4 });
      const ringA = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.8, 36).rotateX(-Math.PI / 2), glow(spec.color));
      const ringB = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.7, 36).rotateX(-Math.PI / 2), glow(petHex));
      ringA.position.set(x, 0.05, z); ringB.position.set(px1, 0.05, pz1);
      ringA.renderOrder = ringB.renderOrder = 4;
      g.add(ringA, ringB);

      // --- BEAT 2: fusion monument(s)
      const baseY = 0.42;
      const sp = packSprite(spec.sprite, (spec.size || 2.6) * 1.05);
      if (sp) {
        sp.position.set((petSpec ? cx - 0.52 : cx) * 0.84, baseY, (cz - 0.35) * 0.84);
        sp.renderOrder = 6;
        sp.userData.bw = sp.scale.x; sp.userData.bh = sp.scale.y;
        sp.scale.setScalar(0.01);
        g.add(sp);
      }
      let petSp = null;
      if (petSpec) {
        petSp = packSprite(petSpec.sprite, (petSpec.size || 2.6) * 1.05 * 0.85);
        if (petSp) {
          petSp.position.set((cx + 0.52) * 0.84, baseY, (cz - 0.35) * 0.84);
          petSp.renderOrder = 6;
          petSp.userData.bw = petSp.scale.x; petSp.userData.bh = petSp.scale.y;
          petSp.scale.setScalar(0.01);
          g.add(petSp);
        }
      }
      const beams = [];
      if (petSpec?.rowLaser || spec.rowLaser) {
        const laser = this.createRowLaser(seat, x, z, glow);
        g.add(laser);
        beams.push(laser);
      }
      if (petSpec?.skyStrike) {
        const sky = this.createSkyBeam(petSpec.color, px1, pz1, glow);
        g.add(sky);
        beams.push(sky);
      }
      if (spec.skyStrike) {
        const sky = this.createSkyBeam(spec.color, x, z, glow);
        g.add(sky);
        beams.push(sky);
      }
      this.pillar(cx, cz, { color: petHex, dur: 1.4 * S, h: 8, r: 0.7 });
      let lastStep = -1;
      const B2 = 1.5 * S;
      await this.tween(B2, (k) => {
        const inK = Math.min(1, k * 4);
        ringA.material.opacity = 0.85 * inK; ringB.material.opacity = 0.85 * inK;
        ringA.rotation.y = k * 6; ringB.rotation.y = -k * 6;
        // rings drift together → fusion
        const pull = ease.inOut(k);
        ringA.position.x = x + (cx - x) * pull; ringB.position.x = px1 + (cx - px1) * pull;
        ringA.position.z = z + (cz - z) * pull; ringB.position.z = pz1 + (cz - pz1) * pull;
        ringA.scale.setScalar(1 + pull * 0.6); ringB.scale.setScalar(1 + pull * 0.8);
        if (sp) {
          const pop = ease.outBack(Math.min(1, k * 2.2));
          sp.scale.set(sp.userData.bw * pop, sp.userData.bh * pop, 1);
          sp.position.y = baseY + Math.sin(k * Math.PI) * 0.25;
          const infuse = 0.35 + 0.25 * Math.sin(k * Math.PI * 6);
          sp.material.color.setRGB(1 + (petRgb[0] - 1) * infuse, 1 + (petRgb[1] - 1) * infuse, 1 + (petRgb[2] - 1) * infuse);
        }
        if (petSp) {
          const popPet = ease.outBack(Math.min(1, Math.max(0, k - 0.08) * 2.4));
          petSp.scale.set(petSp.userData.bw * popPet, petSp.userData.bh * popPet, 1);
          petSp.position.y = baseY + Math.sin(k * Math.PI) * 0.25;
          const infusePet = 0.35 + 0.25 * Math.sin(k * Math.PI * 6 + Math.PI);
          petSp.material.color.setRGB(1 + (ownRgb[0] - 1) * infusePet, 1 + (ownRgb[1] - 1) * infusePet, 1 + (ownRgb[2] - 1) * infusePet);
        }
        for (const b of beams) {
          const pulse = Math.pow(Math.sin(k * Math.PI), 2);
          b.material.opacity = 0.50 * pulse;
          this.shake = 0.18 * (1 - k);
        }
        const step = Math.floor(k * 12);
        if (step !== lastStep) {
          lastStep = step;
          const a = step * 0.9;
          const r = 1.3 * (1 - k * 0.6);
          this.fx.emit(spec.p1, cx + Math.cos(a) * r, 0.5 + k, cz + Math.sin(a) * r * 0.6, Math.max(1, Math.round(3 * pScale)), { speed: 0.6, up: 1.2, size: 0.36, life: 0.7, gravity: 0.2, tint: ownRgb });
          this.fx.emit(petSpec?.p1 || spec.p2, cx - Math.cos(a) * r, 0.5 + k, cz - Math.sin(a) * r * 0.6, Math.max(1, Math.round(3 * pScale)), { speed: 0.6, up: 1.2, size: 0.34, life: 0.7, gravity: 0.2, tint: petRgb });
        }
      });

      // --- BEAT 3: merged double shockwave
      this.hitStop(fast ? 30 : 55);
      this.sway(0.14);
      sfx.shockwave();
      this.ripple(cx, cz, { color: spec.color, r0: 0.4, r1: 5, dur: 0.7 * S });
      this.ripple(cx, cz, { color: petSpec ? petSpec.color : petHex, r0: 0.4, r1: 5, dur: 0.7 * S, delay: 0.09 * S });
      this.ripple(cx, cz, { color: '#ffffff', r0: 0.3, r1: 3.4, dur: 0.5 * S, delay: 0.2 * S, opacity: 0.7 });
      this.fx.emit('fx_star', cx, 0.6, cz, Math.max(1, Math.round(18 * pScale)), { speed: 3.4, up: 0.9, size: 0.36, life: 0.7, gravity: 0.8, ring: true, tint: fuse });
      this.fx.emit(spec.p1, cx, 1.0, cz, Math.max(1, Math.round(14 * pScale)), { speed: 2.4, up: 2.6, size: 0.4, life: 0.8, gravity: 1.2, tint: mixRgb(fuse, [1, 1, 1], 0.3) });
      if (petSpec?.p2) {
        this.fx.emit(petSpec.p2, cx + 0.4, 1.0, cz, Math.max(1, Math.round(10 * pScale)), { speed: 2.0, up: 2.2, size: 0.38, life: 0.75, gravity: 1.0, tint: petRgb });
      }
      const label = opts.bonus ? `🔗 SOUL-LINK +${Math.round(opts.bonus * 100)}%` : '🔗 SOUL-LINK COMBO!';
      this.float(label, { x: cx, z: cz }, { y: 3.0, big: true, color: '#fff0ff', cls: 'combo' });
      await this.tween(0.85 * S, (k) => {
        const f = 1 - k;
        ringA.material.opacity = 0.85 * f; ringB.material.opacity = 0.85 * f;
        ringA.scale.setScalar(1.6 + k * 1.5); ringB.scale.setScalar(1.8 + k * 1.5);
        if (sp) sp.material.opacity = f;
        if (petSp) petSp.material.opacity = f;
      });
    } finally {
      tk.petLift = 0;
      this._activeUlts = Math.max(0, (this._activeUlts || 1) - 1);
      this.scene.remove(g);
      disposeObj(g);
    }
  }

  /**
   * 🎉 Chaos Party events. kind: 'meteor' | 'meteor_rain' | 'rent_x2' | 'rent_x2_zone' | 'swap' | 'gold_rain'.
   * opts = the engine's `chaos_event` payload ({ tiles, zone, a, b, seats, fast, repeat } — all optional).
   */
  async playChaosEvent(kind, opts = {}) {
    const k = { meteor: 'meteor_rain', rent_x2: 'rent_x2_zone' }[kind] || kind;
    const S = opts.fast ? 0.6 : opts.repeat ? 0.75 : 1;
    sfx.chaos(k);
    const wide = (k === 'meteor_rain' || k === 'gold_rain') && opts.overview !== false && !this.camForced;
    const prevMode = this.camMode;
    if (wide) this.camMode = 'overview';
    try {
      if (k === 'meteor_rain') await this._chaosMeteors(opts.tiles, S);
      else if (k === 'rent_x2_zone') await this._chaosZone(opts.tiles, opts.zone, S);
      else if (k === 'swap') await this._chaosSwap(opts.a, opts.b, S);
      else if (k === 'gold_rain') await this._chaosGold(opts.seats, S);
    } finally {
      if (wide && !this.camForced) this.camMode = prevMode;
    }
  }

  async _chaosMeteors(tiles, S) {
    let list = tiles?.length ? tiles : TILES.filter((t) => t.kind === 'property').map((t) => t.i).sort(() => Math.random() - 0.5).slice(0, 4);
    list = list.slice(0, 6);
    await this.dimBoard(0.35, 0.3 * S);
    const fly = 0.55 * S, gap = 0.22 * S;
    const jobs = list.map((ti, n) => {
      const m = this._acquire('meteor', 6, () => {
        this._meteorGeo ||= new THREE.IcosahedronGeometry(0.38, 0);
        return new THREE.Mesh(this._meteorGeo, new THREE.MeshBasicMaterial({ color: '#ffb347' }));
      });
      const { x, z } = tileWorld(ti);
      const sx = x + 5, sy = 13, sz = z - 6;
      let landed = false;
      if (m) { m.visible = false; m.position.set(sx, sy, sz); }
      const delay = n * gap, tot = delay + fly;
      return this.tween(tot, (k) => {
        const u = (k * tot - delay) / fly;
        if (u < 0) return;
        if (m) {
          m.visible = u < 1;
          const e = ease.in(Math.min(1, u));
          m.position.set(sx + (x - sx) * e, sy + (0.3 - sy) * e, sz + (z - sz) * e);
          m.rotation.x += 0.2; m.rotation.y += 0.13;
          this.fx.emit('fx_flame', m.position.x, m.position.y, m.position.z, 1, { speed: 0.2, up: 0.3, size: 0.55, life: 0.35, gravity: 0, tint: [1, 0.6, 0.2] });
        }
        if (u >= 1 && !landed) {
          landed = true;
          this.pressTile(ti, 0.14);
          this.ripple(x, z, { color: '#ff7a22', r0: 0.3, r1: 2.0, dur: 0.45 });
          this.fx.emit('fx_flame', x, 0.3, z, 10, { speed: 2.2, up: 2.2, size: 0.45, life: 0.6, gravity: 2, ring: true, tint: [1, 0.55, 0.15] });
          this.fx.emit('fx_stardust', x, 0.4, z, 8, { speed: 1.2, up: 1.6, size: 0.45, life: 0.9, gravity: 0.6, tint: [0.4, 0.35, 0.32] });
          sfx.impact();
          if (n === 0) this.hitStop(40);
          this.sway(0.08);
        }
      }).then(() => { if (m) this._release(m); });
    });
    await Promise.all(jobs);
    await this.dimBoard(0, 0.35 * S);
  }

  async _chaosZone(tiles, zone, S) {
    const list = tiles?.length ? tiles : zone ? TILES.filter((t) => t.zone === zone).map((t) => t.i) : [];
    for (const t of this.chaosZone) this._release(t);
    this.chaosZone.length = 0;
    const planes = list.map((ti) => {
      const m = this._acquire('zone', 8, () => {
        this._zoneGeo ||= new THREE.PlaneGeometry(BOARD.TILE - BOARD.GAP, BOARD.TILE - BOARD.GAP).rotateX(-Math.PI / 2);
        return new THREE.Mesh(this._zoneGeo, new THREE.MeshBasicMaterial({ color: '#ff4d6d', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
      });
      if (!m) return null;
      const { x, z } = tileWorld(ti);
      m.position.set(x, 0.04, z);
      m.renderOrder = 3;
      return { m, ti, x, z };
    }).filter(Boolean);
    planes.forEach((p, n) => {
      this.pillar(p.x, p.z, { color: '#ff4d6d', dur: 0.8 * S, h: 5, delay: n * 0.12 * S });
      this.pressTile(p.ti, 0.08, n * 0.12 * S);
      this.wait(n * 0.12 * S).then(() => this.float('×2 🪙', { x: p.x, z: p.z }, { y: 1.6, big: true, color: '#ffd34d', cls: 'chaos' }));
    });
    await this.tween(1.3 * S, (k) => {
      for (const p of planes) p.m.material.opacity = 0.55 * Math.abs(Math.sin(k * Math.PI * 3)) * (1 - k * 0.5);
    });
    for (const p of planes) this._release(p.m);
  }

  async _chaosSwap(a, b, S) {
    const ta = a != null ? this.tokens[a] : null, tb = b != null ? this.tokens[b] : null;
    if (!ta || !tb) { sfx.whoosh(0.4); await this.wait(0.4 * S); return; }
    const T = 0.7 * S;
    this.ripple(ta.x, ta.z, { color: '#c49bff', r0: 1.4, r1: 0.3, dur: T });
    this.ripple(tb.x, tb.z, { color: '#7fe3ff', r0: 1.4, r1: 0.3, dur: T });
    this.fx.emitTo('fx_stardust', ta.x, 1.0, ta.z, tb.x, 1.0, tb.z, 10, { time: T, arc: 1.8, size: 0.34, tint: [0.8, 0.6, 1], stagger: 0.03 });
    this.fx.emitTo('fx_stardust', tb.x, 1.0, tb.z, ta.x, 1.0, ta.z, 10, { time: T, arc: 1.8, size: 0.34, tint: [0.5, 0.9, 1], stagger: 0.03 });
    ta.rig?.triggerCast?.(0.8); tb.rig?.triggerCast?.(0.8);
    await this.wait(T);
    this.hitStop(35);
  }

  async _chaosGold(seats, S) {
    const list = (seats?.length ? seats : this.tokens.filter((t) => !t.bankrupt).map((t) => t.seat)).map((s) => this.tokens[s]).filter(Boolean);
    const T = 0.7 * S;
    for (let k = 0; k < 6; k++) {
      const x = (Math.random() - 0.5) * W * 0.8, z = (Math.random() - 0.5) * D * 0.8;
      this.fx.emitTo('fx_chip', x, 9, z, x, 0.2, z, 5, { time: T, arc: 0.1, size: 0.34, tint: GOLD, stagger: 0.06, jitter: 2.2 });
    }
    for (const tk of list) {
      this.fx.emitTo('fx_chip', tk.x, 8, tk.z, tk.x, 1.0, tk.z, 8, { time: T, arc: 0.1, size: 0.34, tint: GOLD, stagger: 0.05, jitter: 1 });
      this.wait(T).then(() => { this.ripple(tk.x, tk.z, { color: '#ffd34d', r0: 0.3, r1: 1.3, dur: 0.4 }); this.squash(tk, 0.12, 0.24); });
    }
    await this.wait(T + 0.4 * S);
  }

  /**
   * One-line bridge hook: `await board.juice?.(e, { final, hud })` at the top of the replay loop.
   * Handles the NEW events end-to-end (pet_combo, chaos_event) and layers extra juice on existing ones
   * (colour set fanfare, diamond trails, jackpot pop). Returns quickly for events it doesn't know.
   */
  async juice(e, { final = null, hud = juiceBus.hud } = {}) {
    if (!e) return;
    const t = e.t || e.type;
    switch (t) {
      case 'pet_combo': {
        const caster = final?.players?.[e.seat] || this.state?.players?.[e.seat] || null;
        await Promise.all([hud?.comboCutin?.({ ...e, caster }), this.playCombo(e.seat, e)]);
        return;
      }
      case 'chaos_event':
        hud?.chaosBanner?.(e.kind, e);
        await this.playChaosEvent(e.kind, e);
        return;
      case 'color_monopoly':
        this.celebrateSet(e.seat, { zone: e.zone, tiles: e.tiles });
        if (e.diamonds) this.diamondTrail(e.seat, e.diamonds);
        return;
      case 'salary':
        if (e.diamonds) this.diamondTrail(e.seat, e.diamonds);
        return;
      case 'event_tile':
        if (e.diamonds && e.seat != null) this.diamondTrail(e.seat, e.diamonds);
        if (e.jackpot && e.tile != null) {
          const { x, z } = tileWorld(e.tile);
          this.hitStop(50); this.pillar(x, z, { color: '#ffd34d', dur: 1, h: 8, r: 0.8 });
          this.fx.emit('fx_chip', x, 0.6, z, 18, { speed: 2, up: 4.5, size: 0.36, life: 1.1, gravity: 7, tint: GOLD });
          sfx.fanfare();
        }
        return;
      case 'duel':
        if (e.diamonds && e.winner != null) this.diamondTrail(e.winner, e.diamonds);
        return;
      default:
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
    if (!this._followPt) this._followPt = { x: 0, z: 0 };
    this._followPt.x = Math.max(-maxX, Math.min(maxX, x * CAM.INWARD_X));
    this._followPt.z = Math.max(-maxZ, Math.min(maxZ, z * CAM.INWARD_Z));
    return this._followPt;
  }

  updateCamera(dt) {
    if (!this.camVel) { this.camVel = {}; this.lookAhead = { x: 0, z: 0 }; }
    if (this._introHoldT > 0) this._introHoldT = Math.max(0, this._introHoldT - dt);
    const st = this.camVel;
    const mode = (this._introHoldT > 0 && !this.camForced) ? 'overview' : this.effectiveCam;
    const tk = this.followSeat != null ? this.tokens[this.followSeat] : null;
    let tx = 0, tz = 0, pitch = CAM.OVERVIEW_PITCH, dist = this.overviewDist;
    const isUlt = (this._activeUlts || 0) > 0;
    this._ultCamBlend = smoothDamp(this._ultCamBlend || 0, isUlt ? 1 : 0, st, 'uCamBlend', 0.28, Infinity, dt);
    const blend = this._ultCamBlend;
    if (mode === 'follow' && tk && !tk.bankrupt) {
      ({ x: tx, z: tz } = this.followPoint(tk, dt));
      const baseHalfW = tk.moving ? CAM.WALK_HALF_W : CAM.FOLLOW_HALF_W;
      const halfW = baseHalfW * (1 - blend) + 5.2 * blend;
      dist = halfW / (this.tanH || 0.2);
      pitch = CAM.FOLLOW_PITCH * (1 - blend) + CAM.OVERVIEW_PITCH * blend;
      if (blend > 0.001) {
        const pull = (this._activeUltCenter ? 0.85 : 0.38) * blend;
        tx = tx * (1 - pull);
        tz = tz * (1 - pull);
      }
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
  /** Something on screen is actively animating (tweens, particles, walking, camera still easing). */
  isAnimating() {
    if (this.tweens.length || this.fx.activeCount || this._hitStop > 0 || (this._introHoldT || 0) > 0 || (this.shake || 0) > 0.002) return true;
    for (const tk of this.tokens) if (tk.moving) return true;
    const st = this.camVel;
    if (st && (Math.abs(st.x || 0) + Math.abs(st.z || 0) + Math.abs(st.d || 0) + Math.abs(st.gx || 0) + Math.abs(st.gz || 0) + Math.abs(st.gd || 0) > 0.02 || Math.abs(st.p || 0) + Math.abs(st.gp || 0) > 0.002)) return true;
    return false;
  }

  /** Auto quality tier: avg frame > 20 ms for 2 s → halve particles & drop extra glow; restore after 4 s smooth. */
  _perfTick(now) {
    const pf = this.perf;
    const ms = pf.prev ? now - pf.prev : 16.7;
    pf.prev = now;
    if (pf.throttled || ms > 250) return;            // throttled frames / tab switches don't count
    pf.sum += ms; pf.n++; pf.win += ms / 1000;
    if (pf.win < 0.5) return;
    const avg = pf.sum / pf.n;
    pf.sum = 0; pf.n = 0;
    const span = pf.win; pf.win = 0;
    if (!this.lowFx) {
      pf.slowFor = avg > PERF.SLOW_MS ? pf.slowFor + span : 0;
      if (pf.slowFor >= PERF.SLOW_FOR) this.setQualityTier('low');
    } else {
      pf.fastFor = avg < PERF.FAST_MS ? pf.fastFor + span : 0;
      if (pf.fastFor >= PERF.FAST_FOR) this.setQualityTier('high');
    }
  }

  setQualityTier(tier) {
    const low = tier === 'low';
    this.lowFx = low;
    this.perf.slowFor = 0; this.perf.fastFor = 0;
    this.fx.setQuality?.(low ? 0.5 : 1);
    for (const b of this.buildings.values()) b.traverse((o) => { if (o.isPointLight) o.intensity = low ? 0 : 0.8; });
  }

  update(dt) {
    const now = typeof performance !== 'undefined' ? performance.now() : this.t * 1000;
    this._perfTick(now);
    // idle throttle: nothing animating on someone else's turn → simulate + render at 30 fps
    const pf = this.perf;
    const mySeat = this.localSeat ?? juiceBus.hud?.yourSeat ?? null;
    const othersTurn = mySeat == null || this.state?.turn?.seat !== mySeat;
    pf.throttled = othersTurn && !this.isAnimating() && now - pf.lastInput > 1500;
    if (pf.throttled) {
      pf.acc += dt;
      if (pf.acc < 1 / PERF.IDLE_FPS - 0.004) { pf.skip = true; return; }
      dt = pf.acc;
    }
    pf.acc = 0;
    pf.skip = false;

    this.t += dt;
    // gameplay time: playback rate (bot turns) and hit-stop freeze; the camera always uses real time
    let gdt = dt * (this.playbackRate || 1);
    if (this._hitStop > 0) { this._hitStop -= dt; gdt *= 0.03; }
    for (let k = this.tweens.length - 1; k >= 0; k--) {
      const tw = this.tweens[k];
      tw.t += gdt;
      const p = Math.min(1, tw.t / tw.dur);
      try { tw.fn(p); } catch (e) { console.warn('[MonopolyBoard] tween error:', e); }
      if (p >= 1) { this.tweens.splice(k, 1); tw.resolve(); }
    }
    // crowd counts once per frame (was a filter() per token per frame)
    const crowd = this._crowd;
    crowd.fill(0);
    const players = this.state?.players;
    if (players) for (let k = 0; k < players.length; k++) { const pl = players[k]; if (!pl.bankrupt && pl.pos != null) crowd[k] = pl.pos; else crowd[k] = -1; }
    for (const tk of this.tokens) {
      const moving = tk.moving;
      tk.idleFor = moving ? 0 : tk.idleFor + gdt;
      const pos = players?.[tk.seat]?.pos;
      let n = 1;
      if (players && pos != null) { n = 0; for (let k = 0; k < players.length; k++) if (crowd[k] === pos) n++; }
      const ud = tk.statusGroup?.userData;
      const hasPill = Boolean(ud?.pill);
      if (tk.rig) {
        let arg;
        if (moving) { arg = tk._moveArg || (tk._moveArg = { vx: 0, vz: 0 }); arg.vx = tk.vx; arg.vz = tk.vz; }
        else arg = tk._idleArg || (tk._idleArg = { vx: 0, vz: 0, walkWeight: 0 });
        tk.rig.update(tk.frozen && !moving ? 0 : gdt, arg, this.camera);
        if (tk.rig.nameTag?.material) {
          const showTag = !hasPill && (n <= 1 || moving || tk.seat === this.followSeat);
          const curOp = tk.rig.nameTag.material.opacity ?? 1;
          const nextOp = curOp + ((showTag ? 1 : 0) - curOp) * Math.min(1, dt * 10);
          tk.rig.nameTag.material.opacity = nextOp;
          tk.rig.nameTag.visible = nextOp > 0.03;
        }
      }
      if (ud) {
        if (ud.shieldRing) ud.shieldRing.rotation.z += gdt * 1.1;
        if (ud.hexRing) ud.hexRing.rotation.z -= gdt * 1.5;
        if (ud.pill) {
          const showPill = n <= 1 || moving || tk.seat === this.followSeat || tk.frozen;
          ud.pill.visible = showPill;
          ud.pill.position.y = (tk.frozen ? 1.78 : 1.76) + 0.05 * Math.sin(this.t * 3.4 + tk.seat);
        }
      }
      if (tk.pet) {
        const o = tk._petArg || (tk._petArg = { x: 0, z: 0, vx: 0, vz: 0, speed: 0, moving: false, right: true, idleFor: 0 });
        o.x = tk.x; o.z = tk.z; o.vx = moving ? tk.vx : 0; o.vz = moving ? tk.vz : 0;
        o.speed = moving ? Math.hypot(tk.vx, tk.vz) : 0; o.moving = moving;
        o.right = tk.rig?.facing?.right ?? true; o.idleFor = tk.idleFor;
        tk.pet.update(gdt, o, this.camera);
        if (tk.petLift && tk.pet.root) tk.pet.root.position.y = tk.petLift;
      }
      if (!moving) { tk.vx *= 0.8; tk.vz *= 0.8; }
    }
    for (const b of this.buildings.values()) if (b.userData.spin) b.userData.spin.rotation.y += gdt * 2;
    for (const p of this.props.values()) {
      if (p.userData.pulse) p.userData.pulse.material.opacity = 0.45 + 0.25 * Math.sin(this.t * 4);
      if (p.userData.flicker) { const ch = p.children; for (let j = 0; j < ch.length; j++) if (ch[j] !== p.userData.tag) ch[j].scale.setScalar(0.85 + 0.25 * Math.sin(this.t * 12 + j)); }
      if (p.userData.tag) p.userData.tag.position.y = 1.48 + 0.06 * Math.sin(this.t * 3.2);
    }
    if (this.clouds) for (const s of this.clouds) { s.position.x += s.userData.speed * dt; if (s.position.x > W * 1.4) s.position.x = -W * 1.4; }
    // last-round heartbeat: 3 beats whenever the acting seat changes
    if (this.tension) {
      if (this.followSeat !== this._hbSeat) { this._hbSeat = this.followSeat; this._hbLeft = 3; this._hbT = 0.3; }
      if (this._hbLeft > 0 && (this._hbT -= dt) <= 0) { sfx.heartbeat(); juiceBus.hud?.heartbeat?.(); this._hbLeft--; this._hbT = 0.95; }
    }
    if (this.shake > 0 && !this._activeUlts) { this.shake *= Math.exp(-5 * dt); if (this.shake < 0.002) this.shake = 0; }
    this.updateCamera(dt);
    this.fx.update(gdt);
  }

  dispose() {
    for (const tk of this.tokens) this.disposeToken(tk);
    if (typeof window !== 'undefined') window.removeEventListener('pointerdown', this._wake);
    for (const t of this.chaosZone) this._release(t);
    this.chaosZone.length = 0;
    this.tweens.length = 0;
    if (juiceBus.board === this) {
      juiceBus.board = null;
      if (this.renderer?.__monoWrapped) { this.renderer.render = this.renderer.__monoWrapped; delete this.renderer.__monoWrapped; }
    }
    this.fx.dispose?.();
    this.scene.traverse((o) => { if (!o.isSprite) o.geometry?.dispose?.(); if (o.material) [].concat(o.material).forEach((m) => { m.map?.dispose?.(); m.dispose?.(); }); });
    for (const t of PACK.tex.values()) t.dispose?.();
    PACK.tex.clear();
    for (const t of _terrainTexCache.values()) t.dispose?.();
    _terrainTexCache.clear();
    for (const e of _badgeTexCache.values()) e.tex?.dispose?.();
    _badgeTexCache.clear();
  }
}
