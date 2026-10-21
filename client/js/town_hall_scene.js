// client/js/town_hall_scene.js — Town Hall 36x36m 2.5D Celestial Sanctuary of Goddess Vakarine (Floating Heaven)
// Group structure: 'townhall_root' -> 'th_ground', 'th_landmarks', 'th_decor'
import * as THREE from 'three';

export const DEFAULT_TOWNHALL = Object.freeze({
  ID: 'townhall:main',
  SIZE: 36,
  HALF: 18,
  TRIGGER_R: 2.4,
  LANDMARKS: Object.freeze([
    Object.freeze({
      id: 'fountain',
      label: 'Winged Goddess Fountain',
      icon: '⛲',
      x: 0,
      z: 0,
      r: 2.4,
      action: 'fountain',
      prompt: '🗽 Goddess Vakarine Fountain • Daily Wish & Gacha',
    }),
    Object.freeze({
      id: 'statue_1',
      label: 'Statue: Empire Architect',
      icon: '🏰',
      x: -8,
      z: -13,
      r: 2.4,
      action: 'statue_1',
      category: 'architect',
      prompt: '🏰 #1 Architect • Hall of Fame',
    }),
    Object.freeze({
      id: 'statue_2',
      label: 'Statue: Gear Sovereign',
      icon: '⚔️',
      x: -4,
      z: -14,
      r: 2.4,
      action: 'statue_2',
      category: 'gear',
      prompt: '👑 #1 Sovereign • Hall of Fame',
    }),
    Object.freeze({
      id: 'statue_3',
      label: 'Statue: Sky Sprinter',
      icon: '🏆',
      x: 0,
      z: -14.5,
      r: 2.4,
      action: 'statue_3',
      category: 'arcade',
      prompt: '🏆 #1 Sky Sprinter • Cloud Dash Hall of Fame',
    }),
    Object.freeze({
      id: 'statue_4',
      label: 'Statue: Monopoly Tycoon',
      icon: '🎲',
      x: 4,
      z: -14,
      r: 2.4,
      action: 'statue_4',
      category: 'tycoon',
      prompt: '🎲 #1 Tycoon • Hall of Fame',
    }),
    Object.freeze({
      id: 'statue_5',
      label: 'Statue: Couple Harmony',
      icon: '💕',
      x: 8,
      z: -13,
      r: 2.4,
      action: 'statue_5',
      category: 'couple',
      prompt: '💖 #1 Couple • Hall of Fame',
    }),
    Object.freeze({
      id: 'casino_palace',
      label: 'Grand Starlight Casino',
      icon: '🎰',
      x: -10.5,
      z: -5.5,
      r: 2.4,
      action: 'casino_palace',
      prompt: '🎰 Grand Starlight Casino • Pok-Deng & Roulette',
    }),
    Object.freeze({
      id: 'monopoly_arch',
      label: 'Sky Monopoly Portal Arch',
      icon: '🌀',
      x: 10.5,
      z: -5.5,
      r: 2.4,
      action: 'monopoly_arch',
      prompt: '🎲 Sky Monopoly Portal • 4-Seat Party',
    }),
    Object.freeze({
      id: 'forge',
      label: 'Star-Force +10 Forge',
      icon: '🔨',
      x: 9.5,
      z: 3.5,
      r: 2.4,
      action: 'forge',
      prompt: '🔨 Star-Force Blacksmith +10',
    }),
    Object.freeze({
      id: 'owl_postbox',
      label: 'Royal Owl Postbox',
      icon: '🦉',
      x: -9.5,
      z: 3.5,
      r: 2.4,
      action: 'owl_postbox',
      prompt: '🦉 Royal Owl Postbox • Gift & Mail',
    }),
    Object.freeze({
      id: 'vip_table_1',
      label: 'VIP Table #1',
      icon: '🪑',
      x: -6,
      z: 8.5,
      r: 2.4,
      action: 'vip_table_1',
      prompt: '🪑 VIP Table #1 • Tap to Sit (0/4)',
    }),
    Object.freeze({
      id: 'vip_table_2',
      label: 'VIP Table #2',
      icon: '🪑',
      x: 6,
      z: 8.5,
      r: 2.4,
      action: 'vip_table_2',
      prompt: '🪑 VIP Table #2 • Tap to Sit (0/4)',
    }),
  ]),
});

export const TOWNHALL = DEFAULT_TOWNHALL;

let runtimeTownhall = DEFAULT_TOWNHALL;
import('/shared/phase5_rules.js')
  .then((mod) => {
    if (mod?.TOWNHALL) {
      const byId = new Map(DEFAULT_TOWNHALL.LANDMARKS.map((d) => [d.id, d]));
      const mergedLandmarks = (mod.TOWNHALL.LANDMARKS || []).map((lm) => {
        const def = byId.get(lm.id) || {};
        return Object.freeze({
          ...def,
          ...lm,
          r: lm.r ?? def.r ?? mod.TOWNHALL.TRIGGER_R ?? 2.4,
          prompt: lm.prompt ?? def.prompt ?? lm.label,
        });
      });
      runtimeTownhall = Object.freeze({
        ...DEFAULT_TOWNHALL,
        ...mod.TOWNHALL,
        LANDMARKS: Object.freeze(mergedLandmarks),
      });
    }
  })
  .catch(() => {});

export function getTownHallConfig() {
  return runtimeTownhall;
}

const texCache = new Map();
const sharedLoader = new THREE.TextureLoader();

function loadBillboardTexture(url, onUpdate, { repeat = false } = {}) {
  if (!url) return null;
  const key = repeat ? `${url}__rep` : url;
  if (texCache.has(key)) {
    const cached = texCache.get(key);
    if (onUpdate) onUpdate(cached);
    return cached;
  }
  try {
    const tex = sharedLoader.load(
      url,
      (loaded) => {
        loaded.colorSpace = THREE.SRGBColorSpace;
        if (repeat) {
          loaded.wrapS = THREE.RepeatWrapping;
          loaded.wrapT = THREE.RepeatWrapping;
        }
        loaded.needsUpdate = true;
        if (onUpdate) onUpdate(loaded);
      },
      undefined,
      () => {}
    );
    tex.colorSpace = THREE.SRGBColorSpace;
    if (repeat) {
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
    }
    texCache.set(key, tex);
    return tex;
  } catch {
    return null;
  }
}

function makeBillboardPlane(
  url,
  w,
  h,
  { y = 0, z = 0, x = 0, worldZ = null, pitch = -0.56, renderOrder = null, name = '', mirror = false, opacity = 1, tint = 0xeee8fc } = {}
) {
  const geo = new THREE.PlaneGeometry(w, h);
  geo.translate(0, h / 2, 0);
  const mat = new THREE.MeshBasicMaterial({
    color: tint,
    transparent: true,
    opacity,
    alphaTest: 0.1,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  loadBillboardTexture(url, (tex) => {
    mat.map = tex;
    mat.needsUpdate = true;
  });
  const mesh = new THREE.Mesh(geo, mat);
  if (name) mesh.name = name;
  if (mirror) mesh.scale.x = -1;
  mesh.position.set(x, y, z);
  mesh.rotation.x = pitch;
  const sortZ = worldZ !== null ? worldZ : z;
  mesh.renderOrder = renderOrder !== null ? renderOrder : Math.round(250 + sortZ * 10);
  mesh.userData.lean = true;
  mesh.userData.baseTint = tint;
  return mesh;
}

function makeFloorDecal(
  url,
  w,
  d,
  { x = 0, y = 0.015, z = 0, rotY = 0, opacity = 0.98, renderOrder = 2, factor = -2, name = '', color = 0xffffff, additive = false } = {}
) {
  const geo = new THREE.PlaneGeometry(w, d);
  geo.rotateX(-Math.PI / 2);
  if (rotY) geo.rotateY(rotY);
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    alphaTest: additive ? 0.01 : 0.05,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    polygonOffset: true,
    polygonOffsetFactor: factor,
    polygonOffsetUnits: factor,
  });
  loadBillboardTexture(url, (tex) => {
    mat.map = tex;
    mat.needsUpdate = true;
  });
  const mesh = new THREE.Mesh(geo, mat);
  if (name) mesh.name = name;
  mesh.position.set(x, y, z);
  mesh.renderOrder = renderOrder;
  mesh.userData.isFloorDecal = true;
  return mesh;
}

function makeGlowSprite(size = 1.6, colorHex = '#ffe28a', opacity = 0.68, worldZ = 0) {
  let tex = texCache.get(`__glow_${colorHex}`);
  if (!tex && typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const ctx = c.getContext?.('2d');
    if (ctx) {
      const grd = ctx.createRadialGradient(64, 64, 4, 64, 64, 60);
      grd.addColorStop(0, '#ffffff');
      grd.addColorStop(0.35, colorHex);
      grd.addColorStop(1, 'rgba(255, 210, 120, 0)');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, 128, 128);
      tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      texCache.set(`__glow_${colorHex}`, tex);
    }
  }
  const mat = new THREE.SpriteMaterial({
    map: tex || null,
    color: 0xffe89e,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(size, size, 1);
  sprite.renderOrder = Math.round(252 + worldZ * 10);
  sprite.userData.isGlow = true;
  return sprite;
}

let _thTwilightSkyTex = null;
function getTownHallTwilightSkyTexture() {
  if (_thTwilightSkyTex || typeof document === 'undefined') return _thTwilightSkyTex;
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 256;
  const g = c.getContext?.('2d');
  if (g) {
    const grd = g.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0, '#161d4a');
    grd.addColorStop(0.48, '#283574');
    grd.addColorStop(0.82, '#45438e');
    grd.addColorStop(1, '#6858a6');
    g.fillStyle = grd;
    g.fillRect(0, 0, 4, 256);
  }
  _thTwilightSkyTex = new THREE.CanvasTexture(c);
  _thTwilightSkyTex.colorSpace = THREE.SRGBColorSpace;
  return _thTwilightSkyTex;
}

/**
 * Storybook outlined text nameplate with celestial pearl-and-gold trim.
 */
function makeTextSprite(
  text,
  {
    subText = '',
    color = '#fffdf7',
    subColor = '#ffe7a3',
    stroke = '#3a2212',
    scaleW = 2.85,
    scaleH = 0.68,
  } = {}
) {
  let tex = null;
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 124;
    const ctx = c.getContext?.('2d');
    if (ctx) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.miterLimit = 2;

      if (subText) {
        ctx.font = '800 20px "Fredoka", "Comfortaa", -apple-system, sans-serif';
        const subW = Math.min(460, Math.max(180, ctx.measureText(subText).width + 44));
        const pillX = 256 - subW / 2;
        ctx.fillStyle = 'rgba(42, 24, 15, 0.84)';
        ctx.strokeStyle = '#f0c465';
        ctx.lineWidth = 3;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(pillX, 68, subW, 38, 19);
        else ctx.rect(pillX, 68, subW, 38);
        ctx.fill();
        ctx.stroke();

        ctx.font = '900 30px "Fredoka", "Comfortaa", -apple-system, sans-serif';
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 9;
        ctx.strokeText(text, 256, 38);
        ctx.fillStyle = color;
        ctx.fillText(text, 256, 38);

        ctx.font = '800 20px "Fredoka", "Comfortaa", -apple-system, sans-serif';
        ctx.fillStyle = subColor;
        ctx.fillText(subText, 256, 87);
      } else {
        ctx.font = '900 31px "Fredoka", "Comfortaa", -apple-system, sans-serif';
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 9;
        ctx.strokeText(text, 256, 62);
        ctx.fillStyle = color;
        ctx.fillText(text, 256, 62);
      }

      tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
    }
  }
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: true, depthWrite: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(scaleW, scaleH, 1);
  sprite.renderOrder = 850;
  return sprite;
}

/** Merge an array of BufferGeometries into one static draw call. */
function mergeBufferGeometries(geos) {
  const out = new THREE.BufferGeometry();
  const pos = [];
  const norm = [];
  const uv = [];
  const idx = [];
  let vOff = 0;
  for (const g of geos) {
    const p = g.attributes.position.array;
    const n = g.attributes.normal?.array;
    const u = g.attributes.uv?.array;
    const ix = g.index.array;
    for (let i = 0; i < p.length; i++) pos.push(p[i]);
    if (n) for (let i = 0; i < n.length; i++) norm.push(n[i]);
    if (u) for (let i = 0; i < u.length; i++) uv.push(u[i]);
    for (let i = 0; i < ix.length; i++) idx.push(ix[i] + vOff);
    vOff += g.attributes.position.count;
    g.dispose();
  }
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (norm.length) out.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
  if (uv.length) out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  out.setIndex(idx);
  return out;
}

// ---------------------------------------------------------------------------
// Exported Town Hall & Moon Defense V2 Architecture / Walkability Geometry
// ---------------------------------------------------------------------------
export const TOWNHALL_LOWER_ISLANDS = Object.freeze([
  // 4 Symmetrical Outer Perimeter Floating Sanctuary Islands for Divine Blossom Trees
  [-14.2, -8.6, 2.8],
  [14.2, -8.6, 2.8],
  [-14.2, 6.8, 2.8],
  [14.2, 6.8, 2.8],
]);

export const TOWNHALL_LOWER_BRIDGES = Object.freeze([]);

export const TOWNHALL_COURTS = Object.freeze([
  // Central Goddess Vakarine Rotunda & South Arrival Rotunda
  [0, 0.15, 5.2],
  [0, 6.0, 4.8],
  // 3 Moon Defense V2 North-to-South Siege Gate Plazas (NW Gate, Center Boss Gate, NE Gate)
  [-5.4, -7.2, 2.6],
  [0.0, -8.2, 2.8],
  [5.4, -7.2, 2.6],
  // South Arrival Stairway Landing
  [0, 15.2, 3.1],
  // North 5 Hall of Fame Statue Plinth Courts
  [-8.0, -13.0, 2.0],
  [-4.0, -14.0, 2.0],
  [0.0, -14.5, 2.15],
  [4.0, -14.0, 2.0],
  [8.0, -13.0, 2.0],
  // Symmetrical Upper Wings: Grand Starlight Casino (-10.5, -5.5) & Sky Monopoly Portal (+10.5, -5.5)
  [-10.5, -5.5, 3.35],
  [10.5, -5.5, 3.35],
  // Symmetrical Mid Wings: Royal Owl Postbox (-9.5, 3.5) & Star-Force Blacksmith Forge (+9.5, 3.5)
  [-9.5, 3.5, 2.85],
  [9.5, 3.5, 2.95],
  // Symmetrical South Lounges: 2 VIP Tables (-6.0, 8.5) & (+6.0, 8.5)
  [-6.0, 8.5, 2.65],
  [6.0, 8.5, 2.65],
]);

export const TOWNHALL_CORRIDORS = Object.freeze([
  // Central North-South Sacred Processional & Boss Spine
  [0, -14.5, 0, 17.6, 4.2],
  // Wide Central Sanctuary Plaza Envelope (unifies the main promenade so there are no jagged cutouts)
  [-6.0, -7.2, 6.0, -7.2, 3.6],
  [-5.8, 0.15, 5.8, 0.15, 5.4],
  [-6.0, 8.5, 6.0, 8.5, 3.6],
  [-5.4, -7.2, -6.0, 8.5, 3.4],
  [5.4, -7.2, 6.0, 8.5, 3.4],
  // North Hall of Fame Pantheon Crescent
  [-8.0, -13.0, -4.0, -14.0, 2.8],
  [-4.0, -14.0, 0.0, -14.5, 2.8],
  [0.0, -14.5, 4.0, -14.0, 2.8],
  [4.0, -14.0, 8.0, -13.0, 2.8],
  // Symmetrical Upper West Casino & Upper East Monopoly Causeways
  [-10.5, -5.5, -4.8, -5.5, 3.2],
  [4.8, -5.5, 10.5, -5.5, 3.2],
  // Symmetrical Mid-West Owl Postbox & Mid-East Star-Force Forge Causeways
  [-9.5, 3.5, -4.8, 3.5, 3.0],
  [4.8, 3.5, 9.5, 3.5, 3.0],
]);

export const TOWNHALL_SIEGE_GATES = Object.freeze({
  NW: Object.freeze({ id: 'nw_gate', label: 'NW Gate', x: -5.4, z: -7.2, waypoints: [[-5.4, -7.2], [-1.8, 0.0], [0, 5.8]] }),
  CENTER: Object.freeze({ id: 'n_boss_gate', label: 'Center Boss Road', x: 0.0, z: -8.2, waypoints: [[0, -8.2], [0, 0.15], [0, 5.8]] }),
  NE: Object.freeze({ id: 'ne_gate', label: 'NE Gate', x: 5.4, z: -7.2, waypoints: [[5.4, -7.2], [1.8, 0.0], [0, 5.8]] }),
  FOUNTAIN_BASIN: Object.freeze({ x: 0, z: 0.15, r: 4.65 }),
  STARLIGHT_MEDALLION: Object.freeze({ x: 0, z: 6.0, r: 4.35 }),
});

function distToSegmentSq(px, pz, x1, z1, x2, z2) {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const lenSq = dx * dx + dz * dz;
  if (lenSq <= 1e-6) return (px - x1) * (px - x1) + (pz - z1) * (pz - z1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (pz - z1) * dz) / lenSq));
  const cx = x1 + t * dx;
  const cz = z1 + t * dz;
  return (px - cx) * (px - cx) + (pz - cz) * (pz - cz);
}

/** Fast O(1) walkability check against Town Hall marble courts & bridges. */
export function isTownHallWalkable(x, z, pad = 0) {
  // Seamless central Moon Defense & Sanctuary plaza envelope so diagonal lanes have zero invisible gaps
  if (Math.abs(x) <= 9.2 - pad && z >= -8.8 + pad && z <= 8.8 - pad) return true;
  for (const [cx, cz, r] of TOWNHALL_COURTS) {
    const rad = Math.max(0.1, r - pad);
    if ((x - cx) * (x - cx) + (z - cz) * (z - cz) <= rad * rad) return true;
  }
  for (const [x1, z1, x2, z2, w] of TOWNHALL_CORRIDORS) {
    const halfW = Math.max(0.1, w * 0.5 - pad);
    if (distToSegmentSq(x, z, x1, z1, x2, z2) <= halfW * halfW) return true;
  }
  for (const [x1, z1, x2, z2, w] of TOWNHALL_LOWER_BRIDGES) {
    const halfW = Math.max(0.1, w * 0.5 - pad);
    if (distToSegmentSq(x, z, x1, z1, x2, z2) <= halfW * halfW) return true;
  }
  return false;
}

/** Clamps an arbitrary world coordinate onto the nearest walkable Town Hall marble surface. */
export function clampToTownHall(x, z, pad = 0.28) {
  if (isTownHallWalkable(x, z, pad)) return { x, z };
  const margin = Math.max(0.34, pad + 0.06);
  let bestX = 0;
  let bestZ = 5.8;
  let bestD = Infinity;
  // Also consider central plaza box
  const bx = Math.max(-9.2 + margin, Math.min(9.2 - margin, x));
  const bz = Math.max(-8.8 + margin, Math.min(8.8 - margin, z));
  const bd = Math.hypot(x - bx, z - bz);
  if (bd < bestD) {
    bestD = bd;
    bestX = bx;
    bestZ = bz;
  }
  for (const [cx, cz, r] of TOWNHALL_COURTS) {
    if (r <= margin) continue;
    const d = Math.hypot(x - cx, z - cz);
    if (d - r < bestD) {
      bestD = d - r;
      const ang = Math.atan2(z - cz, x - cx);
      bestX = cx + Math.cos(ang) * Math.max(0, r - margin);
      bestZ = cz + Math.sin(ang) * Math.max(0, r - margin);
    }
  }
  for (const [x1, z1, x2, z2, w] of TOWNHALL_CORRIDORS) {
    const hw = w * 0.5;
    if (hw <= margin) continue;
    const dx = x2 - x1;
    const dz = z2 - z1;
    const lenSq = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - x1) * dx + (z - z1) * dz) / lenSq));
    const sx = x1 + t * dx;
    const sz = z1 + t * dz;
    const d = Math.hypot(x - sx, z - sz);
    if (d - hw < bestD) {
      bestD = d - hw;
      const ang = Math.atan2(z - sz, x - sx);
      bestX = sx + Math.cos(ang) * Math.max(0, hw - margin);
      bestZ = sz + Math.sin(ang) * Math.max(0, hw - margin);
    }
  }
  return { x: bestX, z: bestZ };
}

/**
 * Builds a high-resolution 2048x2048 composite CanvasTexture for the 36x36m Floating Heaven Sanctuary
 * with a clean, symmetrical Royal Alabaster-Lavender & Gold Marble Plaza.
 */
function buildHeavenFloorTexture(worldSize = 36) {
  if (typeof document === 'undefined') return null;
  const W = 2048;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = W;
  const ctx = canvas.getContext?.('2d');
  if (!ctx) return null;

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;

  const px = (wx) => ((wx + worldSize / 2) / worldSize) * W;
  const pz = (wz) => ((wz + worldSize / 2) / worldSize) * W;
  const pr = (wr) => (wr / worldSize) * W;

  const loadedImgs = {
    waterCanal: null,
    roadCream: null,
  };

  const makeScaledPattern = (img, tilePixels = 192) => {
    if (!img || !img.complete || !img.naturalWidth) return null;
    const tileCanvas = document.createElement('canvas');
    tileCanvas.width = tilePixels;
    tileCanvas.height = tilePixels;
    const tctx = tileCanvas.getContext('2d');
    tctx.drawImage(img, 0, 0, tilePixels, tilePixels);
    return ctx.createPattern(tileCanvas, 'repeat');
  };

  const lowerSanctuaryIslands = TOWNHALL_LOWER_ISLANDS;
  const lowerSanctuaryBridges = TOWNHALL_LOWER_BRIDGES;
  const marbleCourts = TOWNHALL_COURTS;
  const marbleCorridors = TOWNHALL_CORRIDORS;

  const drawShapeUnion = (targetCtx, circles, corridors, extraRadiusM = 0, offsetZM = 0) => {
    targetCtx.fillStyle = '#ffffff';
    targetCtx.strokeStyle = '#ffffff';
    targetCtx.lineCap = 'round';
    targetCtx.lineJoin = 'round';

    for (const [cx, cz, r] of circles) {
      targetCtx.beginPath();
      targetCtx.arc(px(cx), pz(cz + offsetZM), Math.max(1, pr(r + extraRadiusM)), 0, Math.PI * 2);
      targetCtx.fill();
    }
    for (const [x1, z1, x2, z2, w] of corridors) {
      targetCtx.lineWidth = Math.max(1, pr(w + extraRadiusM * 2));
      targetCtx.beginPath();
      targetCtx.moveTo(px(x1), pz(z1 + offsetZM));
      targetCtx.lineTo(px(x2), pz(z2 + offsetZM));
      targetCtx.stroke();
    }
  };

  // Hand-painted multi-lobed storybook twilight lavender-moonlight cloud cluster
  const drawPaintedCloudCluster = (cxWorld, czWorld, radiusM) => {
    const cx = px(cxWorld);
    const cz = pz(czWorld);
    const r = pr(radiusM);

    const lobes = [
      [0, 0, 1.0],
      [-0.55, 0.12, 0.72],
      [0.55, 0.12, 0.72],
      [-0.28, -0.22, 0.68],
      [0.28, -0.22, 0.68],
    ];

    ctx.save();
    ctx.fillStyle = 'rgba(66, 52, 122, 0.74)';
    for (const [ox, oz, sc] of lobes) {
      ctx.beginPath();
      ctx.arc(cx + ox * r, cz + (oz + 0.1) * r, r * sc * 1.02, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = 'rgba(146, 132, 208, 0.86)';
    for (const [ox, oz, sc] of lobes) {
      ctx.beginPath();
      ctx.arc(cx + ox * r, cz + oz * r, r * sc * 0.96, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = 'rgba(214, 204, 246, 0.93)';
    for (const [ox, oz, sc] of lobes) {
      ctx.beginPath();
      ctx.arc(cx + ox * r, cz + (oz - 0.06) * r, r * sc * 0.86, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

  const drawAstrolabeCompass = (cxWorld, czWorld, radiusM, points = 8) => {
    const cx = px(cxWorld);
    const cz = pz(czWorld);
    const r = pr(radiusM);

    ctx.save();
    ctx.translate(cx, cz);

    const aura = ctx.createRadialGradient(0, 0, r * 0.12, 0, 0, r * 1.05);
    aura.addColorStop(0, 'rgba(255, 238, 168, 0.52)');
    aura.addColorStop(0.62, 'rgba(245, 198, 92, 0.22)');
    aura.addColorStop(1, 'rgba(245, 198, 92, 0)');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.05, 0, Math.PI * 2);
    ctx.fill();

    for (const [ringScale, lineW, strokeCol] of [
      [0.95, 5.5, '#c68a28'],
      [0.86, 3.2, '#f8d272'],
      [0.62, 3.8, '#d89b32'],
    ]) {
      ctx.beginPath();
      ctx.arc(0, 0, r * ringScale, 0, Math.PI * 2);
      ctx.lineWidth = lineW;
      ctx.strokeStyle = strokeCol;
      ctx.stroke();
    }

    for (let i = 0; i < points; i++) {
      const ang = (i * Math.PI * 2) / points;
      const isMajor = i % 2 === 0;
      const tipR = isMajor ? r * 0.88 : r * 0.68;
      const sideR = r * 0.14;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(ang - 0.18) * sideR, Math.sin(ang - 0.18) * sideR);
      ctx.lineTo(Math.cos(ang) * tipR, Math.sin(ang) * tipR);
      ctx.lineTo(Math.cos(ang + 0.18) * sideR, Math.sin(ang + 0.18) * sideR);
      ctx.closePath();
      ctx.fillStyle = isMajor ? 'rgba(246, 198, 86, 0.48)' : 'rgba(255, 232, 152, 0.36)';
      ctx.fill();
      ctx.lineWidth = 2.0;
      ctx.strokeStyle = '#c48826';
      ctx.stroke();
    }

    ctx.restore();
  };

  const renderCompositeFloor = () => {
    ctx.save();

    // 1. Base Layer: Celestial Starlight-Twilight Sapphire & Indigo Nebula Sky-Sea
    const skyGrd = ctx.createRadialGradient(W / 2, W / 2, W * 0.06, W / 2, W / 2, W * 0.74);
    skyGrd.addColorStop(0, '#445ca4');
    skyGrd.addColorStop(0.42, '#314484');
    skyGrd.addColorStop(0.78, '#233168');
    skyGrd.addColorStop(1, '#18224c');
    ctx.fillStyle = skyGrd;
    ctx.fillRect(0, 0, W, W);

    const waterPat = makeScaledPattern(loadedImgs.waterCanal, 220);
    if (waterPat) {
      ctx.save();
      ctx.globalAlpha = 0.22;
      ctx.globalCompositeOperation = 'soft-light';
      ctx.fillStyle = waterPat;
      ctx.fillRect(0, 0, W, W);
      ctx.restore();
    }

    // Soft twilight violet & golden-starlight nebula ribbons across the sky-sea
    for (const [lx, lz, lr, colInner] of [
      [0, -7.5, 9.0, 'rgba(162, 142, 235, 0.30)'],
      [0, 3.0, 9.5, 'rgba(255, 224, 156, 0.22)'],
      [-9.5, -1.0, 8.0, 'rgba(146, 168, 245, 0.25)'],
      [9.5, -1.0, 8.0, 'rgba(146, 168, 245, 0.25)'],
    ]) {
      const aura = ctx.createRadialGradient(px(lx), pz(lz), pr(0.8), px(lx), pz(lz), pr(lr));
      aura.addColorStop(0, colInner);
      aura.addColorStop(0.6, 'rgba(118, 108, 188, 0.12)');
      aura.addColorStop(1, 'rgba(60, 52, 114, 0)');
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(px(lx), pz(lz), pr(lr), 0, Math.PI * 2);
      ctx.fill();
    }

    // Twinkling golden & pearl stars across the dark sapphire sky-sea
    let starSeed = 9001;
    const nextRand = () => {
      starSeed = (starSeed * 16807) % 2147483647;
      return (starSeed - 1) / 2147483646;
    };
    for (let s = 0; s < 140; s++) {
      const sx = nextRand() * W;
      const sz = nextRand() * W;
      const sr = 1.2 + nextRand() * 2.4;
      ctx.fillStyle = s % 3 === 0 ? 'rgba(255, 234, 158, 0.85)' : 'rgba(235, 232, 255, 0.78)';
      ctx.beginPath();
      ctx.arc(sx, sz, sr, 0, Math.PI * 2);
      ctx.fill();
    }

    // Outer horizon cloud banks framing the edges of the floating sanctuary (no inner clutter!)
    const cloudBanks = [
      [-15.2, -14.8, 4.0],
      [-11.0, -16.4, 3.4],
      [11.0, -16.4, 3.4],
      [15.2, -14.8, 4.0],
      [-16.2, -9.2, 3.6],
      [16.2, -9.2, 3.6],
      [-16.4, -0.8, 3.6],
      [16.4, -0.8, 3.6],
      [-16.0, 7.6, 3.6],
      [16.0, 7.6, 3.6],
      [-14.6, 14.8, 4.0],
      [-8.8, 16.2, 3.4],
      [8.8, 16.2, 3.4],
      [14.6, 14.8, 4.0],
    ];
    for (const [cx, cz, cr] of cloudBanks) {
      drawPaintedCloudCluster(cx, cz, cr);
    }

    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = W;
    maskCanvas.height = W;
    const mctx = maskCanvas.getContext('2d');

    const fillUnionLayer = (circles, corridors, extraRadiusM, fillStyle, alpha = 1, offsetZM = 0) => {
      mctx.clearRect(0, 0, W, W);
      mctx.globalCompositeOperation = 'source-over';
      drawShapeUnion(mctx, circles, corridors, extraRadiusM, offsetZM);
      mctx.globalCompositeOperation = 'source-in';
      mctx.fillStyle = fillStyle;
      mctx.fillRect(0, 0, W, W);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.drawImage(maskCanvas, 0, 0);
      ctx.restore();
    };

    const roadPat = makeScaledPattern(loadedImgs.roadCream, 176);

    // 2. Outer Perimeter Floating Tree Islands
    fillUnionLayer(lowerSanctuaryIslands, lowerSanctuaryBridges, 0.30, 'rgba(20, 26, 68, 0.44)', 1, 0.40);
    fillUnionLayer(lowerSanctuaryIslands, lowerSanctuaryBridges, 0.15, '#281a3d', 1, 0.32);
    fillUnionLayer(lowerSanctuaryIslands, lowerSanctuaryBridges, 0.10, '#9888bc', 1, 0.30);
    fillUnionLayer(lowerSanctuaryIslands, lowerSanctuaryBridges, 0.15, '#281a3d');
    fillUnionLayer(lowerSanctuaryIslands, lowerSanctuaryBridges, 0.11, '#e6def6');
    fillUnionLayer(lowerSanctuaryIslands, lowerSanctuaryBridges, 0.04, '#e5b24c');
    fillUnionLayer(lowerSanctuaryIslands, lowerSanctuaryBridges, 0.0, roadPat || '#dfd7f0');
    fillUnionLayer(lowerSanctuaryIslands, lowerSanctuaryBridges, 0.0, 'rgba(186, 174, 228, 0.42)');

    // 3. Main Unified Royal Alabaster-Lavender & Gold Marble Sanctuary Plaza
    fillUnionLayer(marbleCourts, marbleCorridors, 0.34, 'rgba(18, 24, 64, 0.48)', 1, 0.45);
    fillUnionLayer(marbleCourts, marbleCorridors, 0.17, '#281a3d', 1, 0.36);
    fillUnionLayer(marbleCourts, marbleCorridors, 0.12, '#9484b8', 1, 0.34);
    fillUnionLayer(marbleCourts, marbleCorridors, 0.12, '#b2a2d2', 1, 0.18);

    fillUnionLayer(marbleCourts, marbleCorridors, 0.16, '#281a3d');
    fillUnionLayer(marbleCourts, marbleCorridors, 0.12, '#ece4fa');
    fillUnionLayer(marbleCourts, marbleCorridors, 0.04, '#ebb852');
    fillUnionLayer(marbleCourts, marbleCorridors, 0.0, roadPat || '#e4dcf4');
    fillUnionLayer(marbleCourts, marbleCorridors, 0.0, 'rgba(190, 178, 232, 0.40)');

    // 4. Clean, Curated Golden Astrolabe Mosaic Inlays (only at major focal courts!)
    drawAstrolabeCompass(0, 0.15, 4.15, 8);
    drawAstrolabeCompass(0, 6.0, 3.65, 8);
    drawAstrolabeCompass(-10.5, -5.5, 2.75, 8);
    drawAstrolabeCompass(10.5, -5.5, 2.75, 8);

    ctx.restore();
    tex.needsUpdate = true;
  };

  renderCompositeFloor();

  if (typeof Image !== 'undefined') {
    const entries = [
      ['waterCanal', '/assets/terrain/water_canal.png'],
      ['roadCream', '/assets/terrain/road_cream.png'],
    ];
    for (const [key, url] of entries) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        loadedImgs[key] = img;
        renderCompositeFloor();
      };
      img.src = url;
    }
  }

  return tex;
}

export class TownHallScene {
  constructor({ world, onAction = null }) {
    this.world = world;
    this.scene = world.scene;
    this.onAction = onAction;
    this.active = false;
    this.siegeMode = false;
    this.lightingMood = 'twilight';
    this.moodTint = [0.96, 0.94, 1.03];
    this._savedSceneBg = null;
    this.currentPromptLandmarkId = null;
    this.currentPromptAction = null;
    this.elapsed = 0;
    this.stardustTimer = 0;
    this.floatingPlaques = [];
    this.spinningWheels = [];
    this.celestialHalos = [];
    this.fountainWater = null;
    this.fountainMagicCircle = null;
    this.spawnMagicCircle = null;
    this.hemiLight = null;
    this.sunLight = null;
    this.rimLight = null;
    this.landmarks = getTownHallConfig().LANDMARKS;

    // Root group (supports both 'townhall_root' and 'town_hall_root' lookups)
    this.root = new THREE.Group();
    this.root.name = 'townhall_root';
    this.root.visible = false;
    this.scene.add(this.root);

    this.rootAlias = new THREE.Group();
    this.rootAlias.name = 'town_hall_root';
    this.root.add(this.rootAlias);

    // Child groups (alias both thGround/groundGroup, thLandmarks/landmarksGroup, thDecor/decorGroup, thSiege/siegeGroup)
    this.groundGroup = this.thGround = new THREE.Group();
    this.groundGroup.name = 'th_ground';
    this.root.add(this.groundGroup);

    this.landmarksGroup = this.thLandmarks = new THREE.Group();
    this.landmarksGroup.name = 'th_landmarks';
    this.root.add(this.landmarksGroup);

    this.decorGroup = this.thDecor = new THREE.Group();
    this.decorGroup.name = 'th_decor';
    this.root.add(this.decorGroup);

    this.siegeGroup = this.thSiege = new THREE.Group();
    this.siegeGroup.name = 'th_siege';
    this.siegeGroup.visible = false;
    this.root.add(this.siegeGroup);

    this.buildScene();
    this.bindEvents();
  }

  buildScene() {
    // Dreamy Celestial Starlight-Twilight lighting (matching Moon Defense V2 mockup)
    this.hemiLight = new THREE.HemisphereLight(0xdcd4ff, 0x3b2d64, 1.05);
    this.hemiLight.position.set(0, 28, 0);
    this.root.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xffe6b8, 0.88);
    this.sunLight.position.set(16, 30, 22);
    this.root.add(this.sunLight);

    this.rimLight = new THREE.DirectionalLight(0x9fb8ff, 0.58);
    this.rimLight.position.set(-18, 18, -14);
    this.root.add(this.rimLight);

    this.buildGround();
    this.buildLandmarks();
    this.buildDecor();
  }

  buildGround() {
    const size = getTownHallConfig().SIZE || 36;
    const half = size / 2;

    // 1. Unified 2048x2048 Celestial Sanctuary Floor (Twilight Moonlit Marble + `\ | /` 3-Lane Trident + Starlight Sky-Sea)
    const floorGeo = new THREE.PlaneGeometry(size, size);
    floorGeo.rotateX(-Math.PI / 2);
    const floorTex = buildHeavenFloorTexture(size);
    const floorMat = new THREE.MeshBasicMaterial({
      map: floorTex || null,
      color: 0xffffff,
      polygonOffset: true,
      polygonOffsetFactor: 2,
      polygonOffsetUnits: 2,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.name = 'plaza_floor';
    floorMesh.renderOrder = 0;
    this.groundGroup.add(floorMesh);

    // 2. South Arrival & Moon Defense Battle 6-Star Starlight Medallion at (0, 6.0)
    this.groundGroup.add(
      makeFloorDecal('/assets/ui/th_medallion_starlight.png', 6.8, 5.45, {
        x: 0,
        y: 0.014,
        z: 6.0,
        renderOrder: 2,
        factor: -2,
        name: 'spawn_starlight_medallion',
      })
    );

    // 2b. Glowing Golden Magic Circle inlaid inside the South Battle Medallion (matching `moon_defense_live_townhall_mockup.jpg`!)
    this.spawnMagicCircle = makeFloorDecal('/assets/ui/fx_magic_circle.png', 4.35, 4.35, {
      x: 0,
      y: 0.018,
      z: 6.0,
      opacity: 0.58,
      renderOrder: 3,
      factor: -3,
      color: 0xffe484,
      additive: true,
      name: 'spawn_magic_circle',
    });
    this.groundGroup.add(this.spawnMagicCircle);

    // 3. Floating Heaven White-Marble Temple Balustrade, Cloud Bank & Starlight Waterfall Cliff Wall!
    const wallMat = new THREE.MeshBasicMaterial({
      color: 0xdcd4f5,
      transparent: true,
      alphaTest: 0.15,
      side: THREE.FrontSide,
    });
    loadBillboardTexture('/assets/ui/th_heaven_cliff_cloud_wall.png', (tex) => {
      wallMat.map = tex;
      wallMat.needsUpdate = true;
    });
    const wallCount = 4;
    const wallW = (size + 1.2) / wallCount + 0.8;
    const wallH = 4.6;
    const wallGeos = [];
    for (let i = 0; i < wallCount; i++) {
      const offset = ((i + 0.5) / wallCount - 0.5) * (size - 0.8);
      wallGeos.push(
        new THREE.PlaneGeometry(wallW, wallH).rotateX(-0.22).translate(offset, -1.65, half + 0.15 + i * 0.01)
      );
    }
    const wallMesh = new THREE.Mesh(mergeBufferGeometries(wallGeos), wallMat);
    wallMesh.name = 'cliff_wall_south';
    wallMesh.renderOrder = 240;
    this.groundGroup.add(wallMesh);

    // Grand Moonlit-Marble Celestial Stairway at South Arrival (0, 18.2)
    const stepMarbleMat = new THREE.MeshStandardMaterial({ color: 0xddd6f2, roughness: 0.35, metalness: 0.1 });
    for (let s = 0; s < 3; s++) {
      const stepW = 5.6 + s * 0.6;
      const stepMesh = new THREE.Mesh(new THREE.BoxGeometry(stepW, 0.22, 0.68), stepMarbleMat);
      stepMesh.position.set(0, -0.12 - s * 0.18, half + 0.25 + s * 0.45);
      this.groundGroup.add(stepMesh);
    }

    // 4. Drifting 2.5D Twilight-Tinted Cumulus Clouds along the outer perimeter horizon only
    const cloudBelt = [
      // South foreground cloud bank
      [-14.5, half + 0.8, -1.8, 6.2, 3.3, '/assets/village/env_cloud_fluffy_a.png', true, 0.9],
      [-7.2, half + 1.1, -2.1, 5.4, 2.9, '/assets/village/env_cloud_fluffy_b.png', false, 0.88],
      [7.2, half + 1.1, -2.1, 5.4, 2.9, '/assets/village/env_cloud_fluffy_b.png', true, 0.88],
      [14.5, half + 0.8, -1.8, 6.2, 3.3, '/assets/village/env_cloud_fluffy_a.png', false, 0.9],
      // West & East floating cloud banks
      [-16.4, 11.2, -0.6, 5.6, 3.0, '/assets/village/env_cloud_fluffy_a.png', true, 0.86],
      [16.4, 11.2, -0.6, 5.6, 3.0, '/assets/village/env_cloud_fluffy_a.png', false, 0.86],
      [-16.8, 2.5, -0.8, 5.2, 2.8, '/assets/village/env_cloud_fluffy_b.png', false, 0.85],
      [16.8, 2.5, -0.8, 5.2, 2.8, '/assets/village/env_cloud_fluffy_b.png', true, 0.85],
      [-16.5, -6.5, -0.7, 5.8, 3.1, '/assets/village/env_cloud_fluffy_a.png', true, 0.86],
      [16.5, -6.5, -0.7, 5.8, 3.1, '/assets/village/env_cloud_fluffy_a.png', false, 0.86],
      // North Pantheon horizon cloud sea behind the Hall of Fame
      [-13.5, -17.2, -0.4, 6.4, 3.4, '/assets/village/env_cloud_fluffy_a.png', false, 0.88],
      [-5.2, -17.6, -0.5, 6.0, 3.2, '/assets/village/env_cloud_fluffy_b.png', true, 0.86],
      [5.2, -17.6, -0.5, 6.0, 3.2, '/assets/village/env_cloud_fluffy_b.png', false, 0.86],
      [13.5, -17.2, -0.4, 6.4, 3.4, '/assets/village/env_cloud_fluffy_a.png', true, 0.88],
    ];
    for (const [cx, cz, cy, cw, ch, sprite, mirror, opacity] of cloudBelt) {
      const cloud = makeBillboardPlane(sprite, cw, ch, {
        x: cx,
        y: cy,
        z: cz,
        pitch: -0.26,
        opacity,
        mirror,
        tint: 0xd0c6f0,
        name: 'heaven_cloud_bank',
      });
      this.groundGroup.add(cloud);
    }
  }

  buildLandmarks() {
    const config = getTownHallConfig();
    this.landmarks = config.LANDMARKS;
    this.floatingPlaques = [];
    this.spinningWheels = [];

    const statueTitles = {
      statue_1: { badge: '🏰 #1 Architect', sub: 'Empire Architect' },
      statue_2: { badge: '👑 #1 Sovereign', sub: 'Star-Force Gear' },
      statue_3: { badge: '🏆 #1 Sky Sprinter', sub: 'Cloud Dash' },
      statue_4: { badge: '🎲 #1 Tycoon', sub: 'Sky Monopoly' },
      statue_5: { badge: '💖 #1 Couple', sub: 'Starlight Couple' },
    };

    for (let idx = 0; idx < config.LANDMARKS.length; idx++) {
      const lm = config.LANDMARKS[idx];
      const g = new THREE.Group();
      g.name = lm.id;
      g.position.set(lm.x, 0, lm.z);
      g.userData = {
        landmarkId: lm.id,
        action: lm.action,
        label: lm.label,
        prompt: lm.prompt || lm.label,
        r: lm.r || config.TRIGGER_R || 2.4,
        icon: lm.icon,
      };

      let plaqueText = lm.label;
      let plaqueSub = '';
      let plaqueY = 3.2;
      let plaqueScaleW = 2.6;

      if (lm.id === 'fountain') {
        // 1. Hand-painted 6-Star Starlight Stone Medallion centered at (0, 0.0)
        const med = makeFloorDecal('/assets/ui/th_medallion_starlight.png', 6.8, 5.5, {
          x: 0,
          y: 0.014,
          z: 0.0,
          renderOrder: 2,
          factor: -2,
          name: 'fountain_medallion',
        });
        g.add(med);

        // 2. Shimmering golden magic circle decal
        const magicDecal = makeFloorDecal('/assets/ui/fx_magic_circle.png', 4.8, 4.8, {
          x: 0,
          y: 0.018,
          z: 0.0,
          opacity: 0.65,
          renderOrder: 3,
          factor: -3,
          color: 0xffe484,
          additive: true,
          name: 'fountain_water',
        });
        g.add(magicDecal);
        this.fountainWater = magicDecal;

        // 3. Hand-painted Winged Goddess Vakarine Marble Fountain positioned at z = +0.92
        const fountainSprite = makeBillboardPlane('/assets/ui/th_fountain_vakarine.png', 4.85, 4.18, {
          y: 0.02,
          z: 0.92,
          worldZ: lm.z + 0.92,
          tint: 0xffffff,
          name: 'fountain_goddess_sprite',
        });
        g.add(fountainSprite);

        // 4. Radiant Divine Halo behind Goddess Vakarine's crown & wings
        const goddessHalo = makeGlowSprite(4.2, '#ffe898', 0.78, lm.z + 0.85);
        goddessHalo.name = 'goddess_divine_halo';
        goddessHalo.position.set(0, 2.75, 0.75);
        goddessHalo.userData = { baseScale: 4.2, baseOpacity: 0.78, phase: 0 };
        g.add(goddessHalo);
        this.celestialHalos.push(goddessHalo);

        plaqueText = 'Goddess Vakarine';
        plaqueSub = '🗽 Wish & Gacha';
        plaqueY = 4.35;
        plaqueScaleW = 2.75;
      } else if (lm.id.startsWith('statue_')) {
        g.add(
          makeFloorDecal('/assets/village/decal_plaza_medallion_circle.png', 2.4, 1.9, {
            x: 0,
            y: 0.014,
            z: 0.15,
            renderOrder: 2,
            factor: -2,
          })
        );

        const statueBillboard = makeBillboardPlane('/assets/ui/th_statue_pedestal.png', 2.15, 3.55, {
          y: 0.02,
          z: 0.35,
          worldZ: lm.z + 0.35,
          name: `${lm.id}_sprite`,
        });
        g.add(statueBillboard);

        const stInfo = statueTitles[lm.id] || { badge: '👑 #1 Sovereign', sub: lm.label };
        plaqueText = stInfo.badge;
        plaqueSub = stInfo.sub;
        plaqueY = 3.65;
        plaqueScaleW = 2.25;
      } else if (lm.id === 'casino_palace') {
        g.add(
          makeFloorDecal('/assets/ui/th_medallion_starlight.png', 5.4, 4.3, {
            x: 0,
            y: 0.014,
            z: 0.2,
            renderOrder: 2,
            factor: -2,
          })
        );

        const casinoBillboard = makeBillboardPlane('/assets/village/wnd_casino_dome.png', 5.2, 4.8, {
          y: 0.02,
          z: 0.45,
          worldZ: lm.z + 0.45,
          tint: 0xf6f0ff,
          name: 'casino_dome_sprite',
        });
        g.add(casinoBillboard);

        const wheelGeo = new THREE.PlaneGeometry(1.4, 1.4);
        const wheelMat = new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          alphaTest: 0.15,
          depthWrite: false,
          side: THREE.DoubleSide,
        });
        loadBillboardTexture('/assets/ui/casino_roulette_wheel.png', (tex) => {
          wheelMat.map = tex;
          wheelMat.needsUpdate = true;
        });
        const wheelMesh = new THREE.Mesh(wheelGeo, wheelMat);
        wheelMesh.name = 'casino_roulette_emblem';
        wheelMesh.position.set(1.4, 2.7, 0.85);
        wheelMesh.renderOrder = Math.round(255 + (lm.z + 0.85) * 10);
        g.add(wheelMesh);
        this.spinningWheels.push(wheelMesh);

        plaqueText = 'Starlight Casino';
        plaqueSub = '🎰 Pok-Deng & Roulette';
        plaqueY = 4.6;
        plaqueScaleW = 2.85;
      } else if (lm.id === 'monopoly_arch') {
        g.add(
          makeFloorDecal('/assets/village/decal_plaza_medallion_circle.png', 4.2, 3.4, {
            x: 0,
            y: 0.014,
            z: 0.2,
            renderOrder: 2,
            factor: -2,
          })
        );

        const archBillboard = makeBillboardPlane('/assets/ui/th_arch_monopoly.png', 4.0, 4.8, {
          y: 0.02,
          z: 0.45,
          worldZ: lm.z + 0.45,
          tint: 0xf6f0ff,
          name: 'monopoly_arch_sprite',
        });
        g.add(archBillboard);

        plaqueText = 'Sky Monopoly';
        plaqueSub = '🎲 4-Seat Party Match';
        plaqueY = 4.55;
        plaqueScaleW = 2.75;
      } else if (lm.id === 'forge') {
        g.add(
          makeFloorDecal('/assets/village/decal_plaza_medallion_circle.png', 4.2, 3.4, {
            x: 0.1,
            y: 0.014,
            z: 0.25,
            renderOrder: 2,
            factor: -2,
          })
        );

        const forgeBillboard = makeBillboardPlane('/assets/ui/stage_waterwheel_forge.png', 4.2, 3.4, {
          y: 0.02,
          z: 0.1,
          worldZ: lm.z + 0.1,
          name: 'forge_waterwheel_sprite',
        });
        g.add(forgeBillboard);

        const anvilBillboard = makeBillboardPlane('/assets/ui/stage_blacksmith_anvil.png', 2.0, 1.75, {
          x: 0.45,
          y: 0.04,
          z: 0.95,
          worldZ: lm.z + 0.95,
          name: 'forge_anvil_sprite',
        });
        g.add(anvilBillboard);

        plaqueText = 'Star-Force Forge';
        plaqueSub = '🔨 Refine & Awaken';
        plaqueY = 3.6;
        plaqueScaleW = 2.65;
      } else if (lm.id === 'owl_postbox') {
        g.add(
          makeFloorDecal('/assets/village/decal_plaza_medallion_circle.png', 3.4, 2.7, {
            x: 0,
            y: 0.014,
            z: 0.15,
            renderOrder: 2,
            factor: -2,
          })
        );

        const postboxBillboard = makeBillboardPlane('/assets/ui/th_owl_postbox.png', 1.95, 2.85, {
          y: 0.02,
          z: 0.35,
          worldZ: lm.z + 0.35,
          tint: 0xffffff,
          name: 'owl_postbox_sprite',
        });
        g.add(postboxBillboard);

        const owlBillboard = makeBillboardPlane('/assets/ui/npc_royal_owl.png', 1.1, 1.1, {
          x: 0.65,
          y: 0.85,
          z: 0.5,
          worldZ: lm.z + 0.5,
          tint: 0xffffff,
          name: 'npc_royal_owl_sprite',
        });
        g.add(owlBillboard);

        plaqueText = 'Royal Owl Postbox';
        plaqueSub = '🦉 Gift & Mail';
        plaqueY = 3.05;
        plaqueScaleW = 2.55;
      } else if (lm.id.startsWith('vip_table_')) {
        const tableNum = lm.id.replace('vip_table_', '');
        g.add(
          makeFloorDecal('/assets/village/decal_plaza_medallion_circle.png', 3.6, 2.85, {
            x: 0,
            y: 0.014,
            z: 0.15,
            renderOrder: 2,
            factor: -2,
          })
        );

        const tableBillboard = makeBillboardPlane('/assets/ui/stage_vip_table_4seat.png', 3.0, 2.15, {
          y: 0.02,
          z: 0.4,
          worldZ: lm.z + 0.4,
          name: `${lm.id}_sprite`,
        });
        g.add(tableBillboard);

        plaqueText = `VIP Table #${tableNum}`;
        plaqueSub = '🪑 Tap to Sit (0/4)';
        plaqueY = 2.35;
        plaqueScaleW = 2.4;
      }

      const labelSprite = makeTextSprite(plaqueText, {
        subText: plaqueSub,
        scaleW: plaqueScaleW,
        scaleH: 0.64,
      });
      labelSprite.name = `${lm.id}_plaque`;
      labelSprite.position.set(0, plaqueY, 0);
      labelSprite.userData = { baseY: plaqueY, phase: idx * 0.75 };
      g.add(labelSprite);
      this.floatingPlaques.push(labelSprite);

      this.landmarksGroup.add(g);
    }
  }

  buildDecor() {
    // 1. Grand North Pantheon Corinthian Marble Colonnade & Winged Cloud Gates (z = -16.8)
    const colonnadeGroup = new THREE.Group();
    colonnadeGroup.name = 'north_marble_colonnade';
    colonnadeGroup.position.set(0, 0, -16.8);

    for (const cx of [-7.2, 0, 7.2]) {
      colonnadeGroup.add(
        makeBillboardPlane('/assets/ui/th_colonnade_arch.png', 6.2, 4.6, {
          x: cx,
          y: 0,
          z: 0,
          worldZ: -16.8,
          tint: 0xdcd4f5,
          name: 'colonnade_corinthian_arch',
        })
      );
    }
    for (const [fx, mirror] of [
      [-12.2, false],
      [12.2, true],
    ]) {
      colonnadeGroup.add(
        makeBillboardPlane('/assets/ui/th_heaven_cloud_arch.png', 4.4, 3.95, {
          x: fx,
          y: 0,
          z: 0.3,
          worldZ: -16.5,
          mirror,
          tint: 0xdcd4f5,
          name: 'colonnade_heaven_cloud_arch',
        })
      );
    }
    this.decorGroup.add(colonnadeGroup);

    // 2. 4 Symmetrical Gateway Winged Marble Pillars (`th_heaven_winged_pillar.png`)
    //    Framing only the North Pantheon Gateway and South Celestial Stairway so the central plaza is wide open!
    const wingedPillars = [
      [-4.8, -10.4, false],
      [4.8, -10.4, true],
      [-4.2, 13.5, false],
      [4.2, 13.5, true],
    ];
    for (let i = 0; i < wingedPillars.length; i++) {
      const [px, pz, mirror] = wingedPillars[i];
      const pillarGroup = new THREE.Group();
      pillarGroup.name = 'heaven_winged_pillar';
      pillarGroup.position.set(px, 0, pz);

      const pillarSprite = makeBillboardPlane('/assets/ui/th_heaven_winged_pillar.png', 2.35, 3.25, {
        x: 0,
        y: 0,
        z: 0,
        worldZ: pz,
        mirror,
        tint: 0xf4efff,
        name: 'winged_pillar_sprite',
      });
      pillarGroup.add(pillarSprite);

      const orbHalo = makeGlowSprite(2.1, '#ffe484', 0.68, pz);
      orbHalo.name = 'pillar_astrolabe_glow';
      orbHalo.position.set(0, 2.85, 0.12);
      orbHalo.userData = { baseScale: 2.1, baseOpacity: 0.68, phase: i * 0.65 };
      pillarGroup.add(orbHalo);
      this.celestialHalos.push(orbHalo);

      this.decorGroup.add(pillarGroup);
    }

    // 3. Symmetrical Twin Double-Arm Glowing Boulevard Streetlamps & Hydrangea Planters
    //    Flanking the South Starlight Medallion at (-4.2, 4.35) and (+4.2, 4.35)
    const battleLanternPosts = [
      [-4.2, 4.35, false],
      [4.2, 4.35, true],
    ];
    for (let i = 0; i < battleLanternPosts.length; i++) {
      const [lx, lz, mirror] = battleLanternPosts[i];
      const postGroup = new THREE.Group();
      postGroup.name = 'streetlamp';
      postGroup.position.set(lx, 0, lz);

      postGroup.add(
        makeBillboardPlane('/assets/village/env_bush_hydrangea_blue.png', 1.6, 1.2, {
          x: mirror ? 0.25 : -0.25,
          y: 0,
          z: 0.12,
          worldZ: lz + 0.12,
          mirror,
          tint: 0xe6dffc,
          name: 'battle_lantern_hydrangea',
        })
      );

      postGroup.add(
        makeBillboardPlane('/assets/village/env_streetlamp_double.png', 1.9, 3.05, {
          x: 0,
          y: 0,
          z: 0,
          worldZ: lz,
          mirror,
          tint: 0xffffff,
          name: 'battle_streetlamp_double',
        })
      );

      const lampHalo = makeGlowSprite(2.4, '#ffdf78', 0.78, lz + 0.1);
      lampHalo.name = 'streetlamp_glow';
      lampHalo.position.set(0, 2.4, 0.12);
      lampHalo.userData = { baseScale: 2.4, baseOpacity: 0.78, phase: i * 1.1 + 0.4 };
      postGroup.add(lampHalo);
      this.celestialHalos.push(lampHalo);

      this.decorGroup.add(postGroup);
    }

    // 4. 6 Outer Perimeter Sacred Golden-Starlight Heaven Trees (`th_heaven_divine_tree.png`)
    //    Kept strictly on the outer floating islands so the inner sanctuary is clean and unobstructed!
    const divineTrees = [
      [-14.2, -8.6, 4.3, 4.6, false],
      [14.2, -8.6, 4.3, 4.6, true],
      [-14.2, 6.8, 4.2, 4.5, false],
      [14.2, 6.8, 4.2, 4.5, true],
      [-15.0, -14.2, 4.3, 4.6, true],
      [15.0, -14.2, 4.3, 4.6, false],
    ];
    for (const [tx, tz, tw, th, mirror] of divineTrees) {
      this.decorGroup.add(
        makeBillboardPlane('/assets/ui/th_heaven_divine_tree.png', tw, th, {
          x: tx,
          y: 0,
          z: tz,
          mirror,
          tint: 0xdcd4f5,
          name: 'sakura_tree',
        })
      );
    }

    // 5. Classical Hand-Painted White-Marble Balustrades (`th_balustrade_marble.png`) along the South cliff rim
    const balustrades = [
      [-9.2, 16.5, 4.0, 2.35, false],
      [9.2, 16.5, 4.0, 2.35, true],
      [-14.0, 16.5, 4.0, 2.35, false],
      [14.0, 16.5, 4.0, 2.35, true],
    ];
    for (const [bx, bz, bw, bh, mirror] of balustrades) {
      this.decorGroup.add(
        makeBillboardPlane('/assets/ui/th_balustrade_marble.png', bw, bh, {
          x: bx,
          y: 0,
          z: bz,
          mirror,
          tint: 0xdcd4f5,
          name: 'marble_balustrade',
        })
      );
    }
  }

  bindEvents() {
    if (typeof document === 'undefined') return;
    this.promptEl = document.getElementById('landmark-prompt');
    if (!this.promptEl) {
      this.promptEl = document.createElement('div');
      this.promptEl.id = 'landmark-prompt';
      this.promptEl.className = 'landmark-prompt';
      this.promptEl.hidden = true;
      const hud = document.getElementById('hud') || document.body;
      hud?.appendChild(this.promptEl);
    }
    if (!this._boundPromptClick) {
      this._boundPromptClick = () => {
        if (this.currentPromptAction) {
          this.dispatch(this.currentPromptAction, this.currentPromptLandmarkId);
        }
      };
      this.promptEl.addEventListener('click', this._boundPromptClick);
    }
  }

  initPromptEl() {
    this.bindEvents();
  }

  isModalOpen() {
    return false;
  }

  dispatch(action, landmarkId = null) {
    if (!this.onAction || this.siegeMode) return;
    let normalized = action;
    if (action === 'gacha_shard_shop') normalized = 'fountain';
    else if (action === 'hall_of_fame') normalized = landmarkId || 'statue_1';
    else if (action === 'table_hub_casino') normalized = 'casino_palace';
    else if (action === 'table_hub_monopoly') normalized = 'monopoly_arch';
    else if (action === 'table_hub_sit') normalized = landmarkId || 'vip_table_1';
    this.onAction(normalized);
  }

  pick(cx, cy) {
    if (!this.active || this.siegeMode || !this.world?.canvas || !this.world?.camera) return null;
    const r = this.world.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.world.camera);
    const hits = ray.intersectObjects(this.landmarksGroup.children, true);
    if (!hits.length) return null;
    const validHit = hits.find(
      (h) =>
        h.object &&
        h.object.visible &&
        !h.object.userData?.isFloorDecal &&
        !h.object.userData?.isGlow &&
        h.point.y >= 0.18
    );
    if (!validHit) return null;
    let cur = validHit.object;
    while (cur && cur !== this.landmarksGroup) {
      if (cur.userData?.landmarkId) {
        const landmarkId = cur.userData.landmarkId;
        const action = cur.userData.action;
        const config = getTownHallConfig();
        const lm = config.LANDMARKS.find((l) => l.id === landmarkId);
        const L = this.world?.local;
        if (lm && L) {
          const dist = Math.hypot(L.x - lm.x, L.z - lm.z);
          const triggerR = (lm.r || config.TRIGGER_R || 2.4) + 1.2;
          if (dist > triggerR) {
            this._pendingLandmarkAction = { id: landmarkId, action };
            this.world.walkTo(lm.x, Math.min(16, lm.z + 1.35));
            return { kind: 'landmark_walk', landmarkId, action };
          }
        }
        this._pendingLandmarkAction = null;
        this.dispatch(action, landmarkId);
        return { kind: 'landmark', landmarkId, action };
      }
      cur = cur.parent;
    }
    return null;
  }

  renderPrompt(hit) {
    if (!this.promptEl) this.bindEvents();
    if (!this.active || this.siegeMode || !hit || this.isModalOpen()) {
      this.currentPromptLandmarkId = null;
      this.currentPromptAction = null;
      if (this.promptEl) {
        this.promptEl.hidden = true;
        delete this.promptEl.dataset.landmark;
      }
      return null;
    }

    if (this.currentPromptLandmarkId !== hit.id || this.promptEl?.hidden) {
      this.currentPromptLandmarkId = hit.id;
      this.currentPromptAction = hit.action;
      if (this.promptEl) {
        this.promptEl.hidden = false;
        this.promptEl.dataset.landmark = hit.id;
        const text = hit.prompt || hit.label;
        this.promptEl.innerHTML = `<span class="prompt-icon">${hit.icon || '✨'}</span><span class="prompt-text">${text}</span><button class="prompt-btn" type="button">Interact</button>`;
      }
    }
    return hit;
  }

  checkTrigger(px, pz) {
    if (!this.active || this.siegeMode) {
      return this.renderPrompt(null);
    }
    const config = getTownHallConfig();
    let best = null;
    let bestDist = Infinity;
    for (const lm of config.LANDMARKS) {
      const triggerR = lm.r || config.TRIGGER_R || 2.4;
      const d = Math.hypot(px - lm.x, pz - lm.z);
      if (d <= triggerR && d < bestDist) {
        best = lm;
        bestDist = d;
      }
    }
    if (best && this._pendingLandmarkAction && best.id === this._pendingLandmarkAction.id) {
      const act = this._pendingLandmarkAction;
      this._pendingLandmarkAction = null;
      this.dispatch(act.action, act.id);
    }
    return this.renderPrompt(best);
  }

  /**
   * Toggle Moon Defense V2 Siege Mode on the live Town Hall stage.
   * When active:
   * - Shows `this.siegeGroup` (custom portals, barricades, turret pads, wave entities)
   * - Hides social-only VIP tables & floating landmark plaques for a clean combat arena
   * - Suppresses social landmark interaction prompts
   */
  setSiegeMode(active) {
    this.siegeMode = Boolean(active);
    if (this.siegeGroup) {
      this.siegeGroup.visible = this.siegeMode;
    }
    if (this.groundGroup) {
      this.groundGroup.visible = !this.siegeMode;
    }
    if (this.landmarksGroup) {
      this.landmarksGroup.visible = !this.siegeMode;
    }
    for (const child of this.landmarksGroup.children) {
      if (child.name?.startsWith('vip_table_') || child.name === 'fountain') {
        child.visible = !this.siegeMode;
      }
    }
    if (this.decorGroup) {
      this.decorGroup.visible = !this.siegeMode;
    }
    for (const plaque of this.floatingPlaques) {
      plaque.visible = !this.siegeMode;
    }
    if (this.siegeMode) {
      this.renderPrompt(null);
    } else if (this.active && this.world?.local) {
      this.checkTrigger(this.world.local.x, this.world.local.z);
    }
  }

  isWalkable(x, z, pad = 0.25) {
    if (this.siegeMode) {
      return Math.abs(x) <= 17.5 - pad && Math.abs(z) <= 17.5 - pad;
    }
    return isTownHallWalkable(x, z, pad);
  }

  clampWalkable(x, z) {
    if (this.siegeMode) {
      return {
        x: Math.max(-17.2, Math.min(17.2, x)),
        z: Math.max(-17.2, Math.min(17.2, z)),
      };
    }
    return clampToTownHall(x, z);
  }

  setActive(flag) {
    const next = Boolean(flag);
    const changed = this.active !== next;
    this.active = next;
    this.root.visible = this.active;
    if (this.world?.villagePlaza?.root) {
      this.world.villagePlaza.root.visible = !this.active;
    }
    // Swap scene sky backdrop to Starlight-Twilight when inside Town Hall
    if (this.scene && changed) {
      if (this.active) {
        this._savedSceneBg = this.scene.background;
        const twSky = getTownHallTwilightSkyTexture();
        if (twSky) this.scene.background = twSky;
      } else if (this._savedSceneBg !== undefined) {
        this.scene.background = this._savedSceneBg;
      }
    }
    // Hide daytime village sky clouds while inside the twilight Town Hall
    if (this.world?.env?.clouds) {
      for (const c of this.world.env.clouds) {
        c.visible = !this.active;
      }
    }
    if (!this.active) {
      if (this.siegeMode) this.setSiegeMode(false);
      this.renderPrompt(null);
    } else if (this.world?.local) {
      this.checkTrigger(this.world.local.x, this.world.local.z);
    }
  }

  update(dt = 0.016) {
    if (!this.active) return;
    this.elapsed += dt;

    if (!this.siegeMode) {
      for (let i = 0; i < this.floatingPlaques.length; i++) {
        const sprite = this.floatingPlaques[i];
        const base = sprite.userData?.baseY ?? sprite.position.y;
        const phase = sprite.userData?.phase ?? 0;
        sprite.position.y = base + Math.sin(this.elapsed * 2.1 + phase) * 0.04;
      }
    }

    for (let i = 0; i < this.spinningWheels.length; i++) {
      this.spinningWheels[i].rotation.z -= dt * 0.9;
    }

    for (let i = 0; i < this.celestialHalos.length; i++) {
      const halo = this.celestialHalos[i];
      const baseScale = halo.userData?.baseScale ?? 2.0;
      const baseOpacity = halo.userData?.baseOpacity ?? 0.6;
      const phase = halo.userData?.phase ?? 0;
      const pulse = Math.sin(this.elapsed * 2.4 + phase);
      const s = baseScale * (1 + pulse * 0.06);
      halo.scale.set(s, s, 1);
      if (halo.material) {
        halo.material.opacity = baseOpacity + pulse * 0.1;
      }
    }

    if (this.fountainWater?.material) {
      this.fountainWater.material.opacity = 0.56 + Math.sin(this.elapsed * 2.8) * 0.14;
    }
    if (this.spawnMagicCircle?.material) {
      this.spawnMagicCircle.material.opacity = 0.48 + Math.sin(this.elapsed * 2.4 + 1.2) * 0.14;
    }

    // Gentle rising golden stardust particles around the Goddess Vakarine Rotunda & South Battle Medallion
    if (!this.siegeMode) {
      this.stardustTimer += dt;
      if (this.stardustTimer >= 0.45) {
        this.stardustTimer = 0;
        const angle = Math.random() * Math.PI * 2;
        const radius = 1.2 + Math.random() * 4.8;
        const centerZ = Math.random() < 0.45 ? 6.0 : 0.0;
        this.world?.fx?.emit?.('fx_stardust', {
          x: Math.cos(angle) * radius,
          y: 0.35 + Math.random() * 1.4,
          z: centerZ + Math.sin(angle) * radius,
          scale: 0.52,
          vy: 0.48,
          life: 1.5,
        });
      }
    }

    if (this.world?.local && !this.siegeMode) {
      this.checkTrigger(this.world.local.x, this.world.local.z);
    }
  }

  dispose() {
    this.renderPrompt(null);
    if (this.promptEl && this._boundPromptClick) {
      this.promptEl.removeEventListener('click', this._boundPromptClick);
      this._boundPromptClick = null;
    }
    this.scene?.remove(this.root);
  }
}
