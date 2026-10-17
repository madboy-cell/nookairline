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
      label: 'Statue: Arcade Defender',
      icon: '🌙',
      x: 0,
      z: -14.5,
      r: 2.4,
      action: 'statue_3',
      category: 'arcade',
      prompt: '🐾 #1 Breeder & Defender • Hall of Fame',
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
      x: 10,
      z: 4.5,
      r: 2.4,
      action: 'forge',
      prompt: '🔨 Star-Force Blacksmith +10',
    }),
    Object.freeze({
      id: 'owl_postbox',
      label: 'Royal Owl Postbox',
      icon: '🦉',
      x: -5,
      z: 2.5,
      r: 2.4,
      action: 'owl_postbox',
      prompt: '🦉 Royal Owl Postbox • Gift & Mail',
    }),
    Object.freeze({
      id: 'vip_table_1',
      label: 'VIP Table #1',
      icon: '🪑',
      x: -6,
      z: 8,
      r: 2.4,
      action: 'vip_table_1',
      prompt: '🪑 VIP Table #1 • Tap to Sit (0/4)',
    }),
    Object.freeze({
      id: 'vip_table_2',
      label: 'VIP Table #2',
      icon: '🪑',
      x: 6,
      z: 8,
      r: 2.4,
      action: 'vip_table_2',
      prompt: '🪑 VIP Table #2 • Tap to Sit (0/4)',
    }),
    Object.freeze({
      id: 'vip_table_3',
      label: 'VIP Table #3',
      icon: '🪑',
      x: -11,
      z: 2,
      r: 2.4,
      action: 'vip_table_3',
      prompt: '🪑 VIP Table #3 • Tap to Sit (0/4)',
    }),
    Object.freeze({
      id: 'vip_table_4',
      label: 'VIP Table #4',
      icon: '🪑',
      x: 11,
      z: 10,
      r: 2.4,
      action: 'vip_table_4',
      prompt: '🪑 VIP Table #4 • Tap to Sit (0/4)',
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
  { y = 0, z = 0, x = 0, worldZ = null, pitch = -0.56, renderOrder = null, name = '', mirror = false, opacity = 1 } = {}
) {
  const geo = new THREE.PlaneGeometry(w, h);
  geo.translate(0, h / 2, 0);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
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
  return mesh;
}

function makeFloorDecal(
  url,
  w,
  d,
  { x = 0, y = 0.015, z = 0, rotY = 0, opacity = 0.98, renderOrder = 2, factor = -2, name = '' } = {}
) {
  const geo = new THREE.PlaneGeometry(w, d);
  geo.rotateX(-Math.PI / 2);
  if (rotY) geo.rotateY(rotY);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity,
    alphaTest: 0.05,
    depthWrite: false,
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
  return mesh;
}

function makeGlowSprite(size = 1.6, colorHex = '#ffe28a', opacity = 0.62, worldZ = 0) {
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
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(size, size, 1);
  sprite.renderOrder = Math.round(252 + worldZ * 10);
  return sprite;
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

/**
 * Builds a high-resolution 2048x2048 composite CanvasTexture for the 36x36m Floating Heaven Sanctuary:
 * - ZERO earthly green grass! Every space between the sculpted marble courts and causeways is a
 *   breathtaking Celestial Sea of Golden-Hour Cumulus Clouds, Starlight Nebulae, and Shimmering Crystal Sky-Water!
 * - True 2.5D Sculpted Alabaster-Ivory & Burnished-Gold Marble Temple Platforms with extruded 3D south cliff bevels
 *   so every circular rotunda and bridge visibly floats above the clouds.
 * - Recessed Celestial Sky-Water Reflection Pools (`x = ±5.2, z = -1.3`) rimmed in white marble and burnished gold.
 * - Inlaid Golden Astrolabe Rings, 8-Point Sun-Compass Stars, and Constellation Lines across the marble courts.
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

  // Lower Pearl-Marble Sanctuary Islands (supporting the Divine Blossom Trees, Lotus Basins & Seraph Harps)
  const lowerSanctuaryIslands = [
    // West & East Lotus Reflection Pool Terraces flanking Goddess Vakarine
    [-5.2, -1.35, 3.05],
    [5.2, -1.35, 3.05],
    // Upper-left & upper-right Divine Tree Sanctuary Islands
    [-6.2, -8.2, 3.1],
    [6.2, -8.2, 3.1],
    // Lower-left & lower-right Divine Tree Sanctuary Islands
    [-7.6, 11.6, 3.1],
    [7.6, 11.6, 3.1],
    // Outer West & East Floating Cloud-Tree Sanctuary Islands
    [-14.2, -8.6, 2.9],
    [14.2, -8.6, 2.9],
    [-14.4, -1.2, 2.8],
    [14.4, -1.2, 2.8],
    [-14.2, 6.8, 2.8],
    [14.2, 6.8, 2.8],
    // Upper NW & NE Reflecting Pool Terraces
    [-12.8, -11.4, 2.9],
    [12.8, -11.4, 2.9],
  ];

  const lowerSanctuaryBridges = [
    [-5.2, -1.35, 5.2, -1.35, 2.2],
    [-6.2, -8.2, 6.2, -8.2, 1.9],
  ];

  // Main Elevated White-Alabaster & Gold Processional Courts & Walkways
  const marbleCourts = [
    // Central Goddess Vakarine Rotunda
    [0, 0.15, 4.15],
    // South Spawn Arrival Starlight Rotunda
    [0, 6.0, 3.45],
    // South Arrival Stairway Landing
    [0, 15.2, 2.95],
    // North 5 Hall of Fame Statue Plinth Courts
    [-8.0, -13.0, 1.95],
    [-4.0, -14.0, 1.95],
    [0.0, -14.5, 2.1],
    [4.0, -14.0, 1.95],
    [8.0, -13.0, 1.95],
    // Grand Starlight Casino & Sky Monopoly Portal Forecourts
    [-10.5, -5.5, 3.35],
    [10.5, -5.5, 3.05],
    // Royal Owl Postbox & Star-Force Blacksmith Forge Patios
    [-5.0, 2.5, 2.0],
    [10.0, 4.5, 2.95],
    // 4 VIP Table Patios
    [-6.0, 8.0, 2.35],
    [6.0, 8.0, 2.35],
    [-11.0, 2.0, 2.35],
    [11.0, 10.0, 2.35],
  ];

  const marbleCorridors = [
    // Central North-South Sacred Processional Spine
    [0, -14.5, 0, 17.6, 3.25],
    // North Hall of Fame Pantheon Crescent
    [-8.0, -13.0, -4.0, -14.0, 2.65],
    [-4.0, -14.0, 0.0, -14.5, 2.65],
    [0.0, -14.5, 4.0, -14.0, 2.65],
    [4.0, -14.0, 8.0, -13.0, 2.65],
    // Upper West Casino & Upper East Monopoly Cloud Bridges
    [-10.5, -5.5, -2.2, -3.2, 2.4],
    [2.2, -3.2, 10.5, -5.5, 2.4],
    // Mid-West Owl Postbox & VIP Table #3 Walk
    [-2.2, 1.8, -5.0, 2.5, 2.1],
    [-5.0, 2.5, -11.0, 2.0, 2.1],
    // Mid-East Star-Force Forge Walk
    [2.2, 2.4, 10.0, 4.5, 2.2],
    // Lower VIP Table #1, #2, #4 Walks
    [-1.8, 6.4, -6.0, 8.0, 2.15],
    [1.8, 6.4, 6.0, 8.0, 2.15],
    [6.0, 8.0, 11.0, 10.0, 2.05],
  ];

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

  // Hand-painted multi-lobed storybook golden-hour cloud cluster on the sky canvas
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
    // Soft lavender-rose underside cloud shadow
    ctx.fillStyle = 'rgba(214, 192, 222, 0.58)';
    for (const [ox, oz, sc] of lobes) {
      ctx.beginPath();
      ctx.arc(cx + ox * r, cz + (oz + 0.1) * r, r * sc * 1.02, 0, Math.PI * 2);
      ctx.fill();
    }

    // Warm golden-peach midtone cloud body
    ctx.fillStyle = 'rgba(254, 232, 214, 0.86)';
    for (const [ox, oz, sc] of lobes) {
      ctx.beginPath();
      ctx.arc(cx + ox * r, cz + oz * r, r * sc * 0.96, 0, Math.PI * 2);
      ctx.fill();
    }

    // Creamy sunlit ivory cloud tops
    ctx.fillStyle = 'rgba(255, 253, 248, 0.95)';
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

    // Soft golden radial aura
    const aura = ctx.createRadialGradient(0, 0, r * 0.15, 0, 0, r * 1.08);
    aura.addColorStop(0, 'rgba(255, 242, 192, 0.58)');
    aura.addColorStop(0.65, 'rgba(245, 204, 108, 0.24)');
    aura.addColorStop(1, 'rgba(245, 204, 108, 0)');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.08, 0, Math.PI * 2);
    ctx.fill();

    // Outer & inner burnished-gold astrolabe rings
    for (const [ringScale, lineW, strokeCol] of [
      [0.96, 6.5, '#d89e38'],
      [0.88, 3.5, '#f4ca68'],
      [0.64, 4.5, '#dca33e'],
      [0.38, 3.5, '#e8b852'],
    ]) {
      ctx.beginPath();
      ctx.arc(0, 0, r * ringScale, 0, Math.PI * 2);
      ctx.lineWidth = lineW;
      ctx.strokeStyle = strokeCol;
      ctx.stroke();
    }

    // 16 degree tick marks between outer rings
    ctx.strokeStyle = '#d49a35';
    ctx.lineWidth = 3;
    for (let i = 0; i < 16; i++) {
      const ang = (i * Math.PI) / 8;
      ctx.beginPath();
      ctx.moveTo(Math.cos(ang) * r * 0.88, Math.sin(ang) * r * 0.88);
      ctx.lineTo(Math.cos(ang) * r * 0.96, Math.sin(ang) * r * 0.96);
      ctx.stroke();
    }

    // Multi-point celestial compass star rays
    for (let i = 0; i < points; i++) {
      const ang = (i * Math.PI * 2) / points;
      const isMajor = i % 2 === 0;
      const tipR = isMajor ? r * 0.92 : r * 0.72;
      const sideR = r * 0.16;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(ang - 0.18) * sideR, Math.sin(ang - 0.18) * sideR);
      ctx.lineTo(Math.cos(ang) * tipR, Math.sin(ang) * tipR);
      ctx.lineTo(Math.cos(ang + 0.18) * sideR, Math.sin(ang + 0.18) * sideR);
      ctx.closePath();
      ctx.fillStyle = isMajor ? 'rgba(244, 194, 84, 0.52)' : 'rgba(255, 228, 148, 0.42)';
      ctx.fill();
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = '#c98e2c';
      ctx.stroke();
    }

    ctx.restore();
  };

  const renderCompositeFloor = () => {
    ctx.save();

    // 1. Base Layer: Luminous Celestial Sky-Water & Golden-Hour Cloud Sea across the entire 36x36m heaven!
    const skyGrd = ctx.createRadialGradient(W / 2, W / 2, W * 0.08, W / 2, W / 2, W * 0.72);
    skyGrd.addColorStop(0, '#d8f7ff');
    skyGrd.addColorStop(0.45, '#92e4fc');
    skyGrd.addColorStop(0.8, '#67cef2');
    skyGrd.addColorStop(1, '#4dbbe6');
    ctx.fillStyle = skyGrd;
    ctx.fillRect(0, 0, W, W);

    const waterPat = makeScaledPattern(loadedImgs.waterCanal, 220);
    if (waterPat) {
      ctx.save();
      ctx.globalAlpha = 0.42;
      ctx.fillStyle = waterPat;
      ctx.fillRect(0, 0, W, W);
      ctx.restore();
    }

    // Soft golden-peach celestial light ribbons across the sky-sea
    for (const [lx, lz, lr] of [
      [0, -7.5, 8.5],
      [0, 3.0, 9.0],
      [-8.5, -1.5, 7.5],
      [8.5, -1.5, 7.5],
      [0, 11.5, 8.5],
    ]) {
      const aura = ctx.createRadialGradient(px(lx), pz(lz), pr(1.0), px(lx), pz(lz), pr(lr));
      aura.addColorStop(0, 'rgba(255, 248, 225, 0.52)');
      aura.addColorStop(0.6, 'rgba(255, 234, 196, 0.24)');
      aura.addColorStop(1, 'rgba(255, 234, 196, 0)');
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(px(lx), pz(lz), pr(lr), 0, Math.PI * 2);
      ctx.fill();
    }

    // Billowing painted golden-hour cloud banks directly visible in the channels between the marble bridges!
    const cloudBanks = [
      // Inner sky-channels visible right inside the mobile follow-cam!
      [-4.2, -5.8, 2.3],
      [4.2, -5.8, 2.3],
      [-3.8, -9.8, 2.2],
      [3.8, -9.8, 2.2],
      [-3.8, 4.2, 2.1],
      [3.8, 4.2, 2.1],
      [-3.8, 10.2, 2.4],
      [3.8, 10.2, 2.4],
      [-3.8, 13.4, 2.3],
      [3.8, 13.4, 2.3],
      // Mid-wing cloud cushions
      [-8.2, -1.2, 2.6],
      [8.2, -1.2, 2.6],
      [-8.4, 5.2, 2.5],
      [6.8, 1.8, 2.4],
      [-9.5, -9.6, 2.6],
      [9.5, -9.6, 2.6],
      // Outer horizon cloud sea
      [-15.2, -14.8, 4.2],
      [-11.0, -16.4, 3.6],
      [11.0, -16.4, 3.6],
      [15.2, -14.8, 4.2],
      [-16.2, -9.2, 3.8],
      [16.2, -9.2, 3.8],
      [-16.4, -0.8, 3.8],
      [16.4, -0.8, 3.8],
      [-16.0, 7.6, 3.8],
      [16.0, 7.6, 3.8],
      [-14.6, 14.8, 4.2],
      [-8.8, 16.2, 3.6],
      [8.8, 16.2, 3.6],
      [14.6, 14.8, 4.2],
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

    // 2. Lower Pearl-Marble Sanctuary Islands (supporting the Lotus Reflection Pools & Divine Blossom Trees)
    //    Includes 2.5D south-facing marble slab thickness (+0.38m Z offset) so every island looks like a 3D floating marble plinth!
    fillUnionLayer(lowerSanctuaryIslands, lowerSanctuaryBridges, 0.32, 'rgba(54, 98, 138, 0.28)', 1, 0.42);
    fillUnionLayer(lowerSanctuaryIslands, lowerSanctuaryBridges, 0.16, '#3a2415', 1, 0.34);
    fillUnionLayer(lowerSanctuaryIslands, lowerSanctuaryBridges, 0.11, '#d8c3a5', 1, 0.32);
    fillUnionLayer(lowerSanctuaryIslands, lowerSanctuaryBridges, 0.16, '#3a2415');
    fillUnionLayer(lowerSanctuaryIslands, lowerSanctuaryBridges, 0.12, '#fffdf9');
    fillUnionLayer(lowerSanctuaryIslands, lowerSanctuaryBridges, 0.04, '#ebb954');
    fillUnionLayer(lowerSanctuaryIslands, lowerSanctuaryBridges, 0.0, roadPat || '#fcf5e8');
    fillUnionLayer(lowerSanctuaryIslands, lowerSanctuaryBridges, 0.0, 'rgba(255, 253, 248, 0.58)');

    // 3. Main Elevated Sunlit Alabaster-Ivory & Gold Marble Courts & Causeways
    //    First render 2.5D south-facing chiseled marble thickness (+0.38m Z offset) so the bridges visibly float above the clouds!
    fillUnionLayer(marbleCourts, marbleCorridors, 0.34, 'rgba(48, 88, 128, 0.30)', 1, 0.45);
    fillUnionLayer(marbleCourts, marbleCorridors, 0.17, '#3a2415', 1, 0.36);
    fillUnionLayer(marbleCourts, marbleCorridors, 0.12, '#d6c09e', 1, 0.34);
    fillUnionLayer(marbleCourts, marbleCorridors, 0.12, '#ead8bc', 1, 0.18);

    // Top surface of the Main Marble Courts & Causeways
    fillUnionLayer(marbleCourts, marbleCorridors, 0.16, '#3a2415');
    fillUnionLayer(marbleCourts, marbleCorridors, 0.12, '#fffdf9');
    fillUnionLayer(marbleCourts, marbleCorridors, 0.04, '#ecc05c');
    fillUnionLayer(marbleCourts, marbleCorridors, 0.0, roadPat || '#fbf3e4');
    // Luminous pearl-alabaster glaze so the pavement gleams like divine white-and-gold marble!
    fillUnionLayer(marbleCourts, marbleCorridors, 0.0, 'rgba(255, 253, 248, 0.54)');

    // 4. Golden Astrolabe & Sun-Compass Mosaic Inlays on the Marble Courts
    drawAstrolabeCompass(0, 0.15, 3.85, 8);
    drawAstrolabeCompass(0, 6.0, 3.15, 8);
    drawAstrolabeCompass(0, 15.2, 2.55, 8);
    drawAstrolabeCompass(-10.5, -5.5, 2.95, 8);
    drawAstrolabeCompass(10.5, -5.5, 2.7, 8);
    drawAstrolabeCompass(-5.2, -1.35, 2.55, 8);
    drawAstrolabeCompass(5.2, -1.35, 2.55, 8);
    drawAstrolabeCompass(-6.2, -8.2, 2.4, 8);
    drawAstrolabeCompass(6.2, -8.2, 2.4, 8);
    drawAstrolabeCompass(-7.6, 11.6, 2.4, 8);
    drawAstrolabeCompass(7.6, 11.6, 2.4, 8);

    // Golden Constellation Lines linking the 5 North Hall of Fame Sovereign Statues
    const statueNodes = [
      [-8.0, -13.0],
      [-4.0, -14.0],
      [0.0, -14.5],
      [4.0, -14.0],
      [8.0, -13.0],
    ];
    ctx.save();
    ctx.strokeStyle = 'rgba(232, 178, 68, 0.75)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let i = 0; i < statueNodes.length; i++) {
      const [sx, sz] = statueNodes[i];
      if (i === 0) ctx.moveTo(px(sx), pz(sz));
      else ctx.lineTo(px(sx), pz(sz));
    }
    ctx.stroke();
    for (const [sx, sz] of statueNodes) {
      drawAstrolabeCompass(sx, sz, 1.65, 8);
    }
    ctx.restore();

    // Golden Processional Runway Lines down the North-South Spine
    ctx.save();
    ctx.strokeStyle = 'rgba(232, 180, 74, 0.68)';
    ctx.lineWidth = 3.5;
    for (const xOff of [-1.25, 1.25]) {
      ctx.beginPath();
      ctx.moveTo(px(xOff), pz(-12.5));
      ctx.lineTo(px(xOff), pz(-3.8));
      ctx.moveTo(px(xOff), pz(3.9));
      ctx.lineTo(px(xOff), pz(13.2));
      ctx.stroke();
    }
    ctx.restore();

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
    this.currentPromptLandmarkId = null;
    this.currentPromptAction = null;
    this.elapsed = 0;
    this.stardustTimer = 0;
    this.floatingPlaques = [];
    this.spinningWheels = [];
    this.celestialHalos = [];
    this.fountainWater = null;
    this.fountainMagicCircle = null;
    this.landmarks = getTownHallConfig().LANDMARKS;

    // Root group (supports both 'townhall_root' and 'town_hall_root' lookups)
    this.root = new THREE.Group();
    this.root.name = 'townhall_root';
    this.root.visible = false;
    this.scene.add(this.root);

    this.rootAlias = new THREE.Group();
    this.rootAlias.name = 'town_hall_root';
    this.root.add(this.rootAlias);

    // Child groups (alias both thGround/groundGroup, thLandmarks/landmarksGroup, thDecor/decorGroup)
    this.groundGroup = this.thGround = new THREE.Group();
    this.groundGroup.name = 'th_ground';
    this.root.add(this.groundGroup);

    this.landmarksGroup = this.thLandmarks = new THREE.Group();
    this.landmarksGroup.name = 'th_landmarks';
    this.root.add(this.landmarksGroup);

    this.decorGroup = this.thDecor = new THREE.Group();
    this.decorGroup.name = 'th_decor';
    this.root.add(this.decorGroup);

    this.buildScene();
    this.bindEvents();
  }

  buildScene() {
    const hemiLight = new THREE.HemisphereLight(0xfffdf5, 0xe8d2b0, 1.28);
    hemiLight.position.set(0, 28, 0);
    this.root.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfff6e0, 1.0);
    sunLight.position.set(16, 30, 22);
    this.root.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0xdff4ff, 0.48);
    rimLight.position.set(-18, 18, -14);
    this.root.add(rimLight);

    this.buildGround();
    this.buildLandmarks();
    this.buildDecor();
  }

  buildGround() {
    const size = getTownHallConfig().SIZE || 36;
    const half = size / 2;

    // 1. Unified 2048x2048 Celestial Sanctuary Floor (Alabaster-Gold Marble Platforms + Crystal Sky-Water + Cloud Sea)
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

    // 2. South Arrival 6-Star Starlight Medallion at Spawn (0, 6)
    this.groundGroup.add(
      makeFloorDecal('/assets/ui/th_medallion_starlight.png', 5.8, 4.65, {
        x: 0,
        y: 0.014,
        z: 6.0,
        renderOrder: 2,
        factor: -2,
        name: 'spawn_starlight_medallion',
      })
    );

    // 3. Floating Heaven White-Marble Temple Balustrade, Cloud Bank & Starlight Waterfall Cliff Wall!
    const wallMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
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

    // Grand White-and-Gold Marble Celestial Stairway at South Arrival (0, 18.2)
    const stepMarbleMat = new THREE.MeshStandardMaterial({ color: 0xfffaf0, roughness: 0.35, metalness: 0.08 });
    for (let s = 0; s < 3; s++) {
      const stepW = 5.6 + s * 0.6;
      const stepMesh = new THREE.Mesh(new THREE.BoxGeometry(stepW, 0.22, 0.68), stepMarbleMat);
      stepMesh.position.set(0, -0.12 - s * 0.18, half + 0.25 + s * 0.45);
      this.groundGroup.add(stepMesh);
    }

    // 4. Drifting 2.5D Golden-Hour Cumulus Clouds cradling the inner sky-channels & outer perimeter
    const cloudBelt = [
      // Inner sky-channel clouds visible right beside the marble bridges!
      [-4.2, -5.6, -0.15, 3.4, 1.85, '/assets/village/env_cloud_fluffy_b.png', false, 0.92],
      [4.2, -5.6, -0.15, 3.4, 1.85, '/assets/village/env_cloud_fluffy_b.png', true, 0.92],
      [-3.8, 10.2, -0.15, 3.5, 1.9, '/assets/village/env_cloud_fluffy_b.png', true, 0.92],
      [3.8, 10.2, -0.15, 3.5, 1.9, '/assets/village/env_cloud_fluffy_b.png', false, 0.92],
      // South foreground cloud bank
      [-14.5, half + 0.8, -1.8, 6.2, 3.3, '/assets/village/env_cloud_fluffy_a.png', true, 0.95],
      [-7.2, half + 1.1, -2.1, 5.4, 2.9, '/assets/village/env_cloud_fluffy_b.png', false, 0.92],
      [7.2, half + 1.1, -2.1, 5.4, 2.9, '/assets/village/env_cloud_fluffy_b.png', true, 0.92],
      [14.5, half + 0.8, -1.8, 6.2, 3.3, '/assets/village/env_cloud_fluffy_a.png', false, 0.95],
      // West & East floating cloud banks
      [-16.4, 11.2, -0.6, 5.6, 3.0, '/assets/village/env_cloud_fluffy_a.png', true, 0.9],
      [16.4, 11.2, -0.6, 5.6, 3.0, '/assets/village/env_cloud_fluffy_a.png', false, 0.9],
      [-16.8, 2.5, -0.8, 5.2, 2.8, '/assets/village/env_cloud_fluffy_b.png', false, 0.88],
      [16.8, 2.5, -0.8, 5.2, 2.8, '/assets/village/env_cloud_fluffy_b.png', true, 0.88],
      [-16.5, -6.5, -0.7, 5.8, 3.1, '/assets/village/env_cloud_fluffy_a.png', true, 0.9],
      [16.5, -6.5, -0.7, 5.8, 3.1, '/assets/village/env_cloud_fluffy_a.png', false, 0.9],
      // North Pantheon horizon cloud sea behind the Hall of Fame
      [-13.5, -17.2, -0.4, 6.4, 3.4, '/assets/village/env_cloud_fluffy_a.png', false, 0.92],
      [-5.2, -17.6, -0.5, 6.0, 3.2, '/assets/village/env_cloud_fluffy_b.png', true, 0.9],
      [5.2, -17.6, -0.5, 6.0, 3.2, '/assets/village/env_cloud_fluffy_b.png', false, 0.9],
      [13.5, -17.2, -0.4, 6.4, 3.4, '/assets/village/env_cloud_fluffy_a.png', true, 0.92],
    ];
    for (const [cx, cz, cy, cw, ch, sprite, mirror, opacity] of cloudBelt) {
      const cloud = makeBillboardPlane(sprite, cw, ch, {
        x: cx,
        y: cy,
        z: cz,
        pitch: -0.26,
        opacity,
        mirror,
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
      statue_3: { badge: '🐾 #1 Breeder', sub: 'Companion & Arcade' },
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
      let plaqueScaleW = 2.9;

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
          name: 'fountain_water',
        });
        g.add(magicDecal);
        this.fountainWater = magicDecal;

        // 3. Hand-painted Winged Goddess Vakarine Marble Fountain positioned at z = +0.92
        const fountainSprite = makeBillboardPlane('/assets/ui/th_fountain_vakarine.png', 4.85, 4.18, {
          y: 0.02,
          z: 0.92,
          worldZ: lm.z + 0.92,
          name: 'fountain_goddess_sprite',
        });
        g.add(fountainSprite);

        // 4. Radiant Divine Halo behind Goddess Vakarine's crown & wings
        const goddessHalo = makeGlowSprite(3.6, '#ffe898', 0.68, lm.z + 0.85);
        goddessHalo.name = 'goddess_divine_halo';
        goddessHalo.position.set(0, 2.75, 0.75);
        goddessHalo.userData = { baseScale: 3.6, baseOpacity: 0.68, phase: 0 };
        g.add(goddessHalo);
        this.celestialHalos.push(goddessHalo);

        plaqueText = 'Winged Goddess Vakarine';
        plaqueSub = '🗽 Daily Wish & Gacha';
        plaqueY = 4.35;
        plaqueScaleW = 3.1;
      } else if (lm.id.startsWith('statue_')) {
        g.add(
          makeFloorDecal('/assets/village/decal_plaza_medallion_circle.png', 2.5, 2.0, {
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
        plaqueScaleW = 2.6;
      } else if (lm.id === 'casino_palace') {
        g.add(
          makeFloorDecal('/assets/ui/th_medallion_starlight.png', 5.6, 4.5, {
            x: 0,
            y: 0.014,
            z: 0.2,
            renderOrder: 2,
            factor: -2,
          })
        );

        const casinoBillboard = makeBillboardPlane('/assets/village/wnd_casino_dome.png', 5.4, 5.0, {
          y: 0.02,
          z: 0.45,
          worldZ: lm.z + 0.45,
          name: 'casino_dome_sprite',
        });
        g.add(casinoBillboard);

        const wheelGeo = new THREE.PlaneGeometry(1.45, 1.45);
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
        wheelMesh.position.set(1.45, 2.75, 0.85);
        wheelMesh.renderOrder = Math.round(255 + (lm.z + 0.85) * 10);
        g.add(wheelMesh);
        this.spinningWheels.push(wheelMesh);

        plaqueText = 'Grand Starlight Casino';
        plaqueSub = '🎰 [2/4] Pok-Deng & Roulette';
        plaqueY = 4.65;
        plaqueScaleW = 3.2;
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
          name: 'monopoly_arch_sprite',
        });
        g.add(archBillboard);

        plaqueText = 'Sky Monopoly Portal';
        plaqueSub = '🎲 4-Seat Party Match';
        plaqueY = 4.55;
        plaqueScaleW = 3.0;
      } else if (lm.id === 'forge') {
        g.add(
          makeFloorDecal('/assets/village/decal_plaza_medallion_circle.png', 4.4, 3.5, {
            x: 0.1,
            y: 0.014,
            z: 0.25,
            renderOrder: 2,
            factor: -2,
          })
        );

        const forgeBillboard = makeBillboardPlane('/assets/ui/stage_waterwheel_forge.png', 4.4, 3.5, {
          y: 0.02,
          z: 0.1,
          worldZ: lm.z + 0.1,
          name: 'forge_waterwheel_sprite',
        });
        g.add(forgeBillboard);

        const anvilBillboard = makeBillboardPlane('/assets/ui/stage_blacksmith_anvil.png', 2.1, 1.8, {
          x: 0.45,
          y: 0.04,
          z: 0.95,
          worldZ: lm.z + 0.95,
          name: 'forge_anvil_sprite',
        });
        g.add(anvilBillboard);

        plaqueText = 'Star-Force +10 Forge';
        plaqueSub = '🔨 Refine & Awaken Gear';
        plaqueY = 3.65;
        plaqueScaleW = 3.0;
      } else if (lm.id === 'owl_postbox') {
        g.add(
          makeFloorDecal('/assets/village/decal_plaza_medallion_circle.png', 2.3, 1.85, {
            x: 0,
            y: 0.014,
            z: 0.15,
            renderOrder: 2,
            factor: -2,
          })
        );

        const postboxBillboard = makeBillboardPlane('/assets/ui/th_owl_postbox.png', 1.85, 2.7, {
          y: 0.02,
          z: 0.35,
          worldZ: lm.z + 0.35,
          name: 'owl_postbox_sprite',
        });
        g.add(postboxBillboard);

        const owlBillboard = makeBillboardPlane('/assets/ui/npc_royal_owl.png', 1.05, 1.05, {
          x: 0.65,
          y: 0.82,
          z: 0.5,
          worldZ: lm.z + 0.5,
          name: 'npc_royal_owl_sprite',
        });
        g.add(owlBillboard);

        plaqueText = 'Royal Owl Postbox';
        plaqueSub = '🦉 Gift & Mail';
        plaqueY = 2.95;
        plaqueScaleW = 2.7;
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
        plaqueScaleW = 2.6;
      }

      const labelSprite = makeTextSprite(plaqueText, {
        subText: plaqueSub,
        scaleW: plaqueScaleW,
        scaleH: 0.68,
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
          name: 'colonnade_heaven_cloud_arch',
        })
      );
    }
    this.decorGroup.add(colonnadeGroup);

    // 2. Celestial Winged Marble Pillars with Levitating Sun-Orbs (`th_heaven_winged_pillar.png`)
    //    Curated with wide, breathable spacing so pillars never stack in the portrait viewport!
    const wingedPillars = [
      // Twin Sacred Pillars flanking the Central Goddess Vakarine Rotunda
      [-4.1, -2.8, false],
      [4.1, -2.8, true],
      // Twin Pantheon Pillars framing the approach to the 5 Hall of Fame Champions
      [-4.8, -10.4, false],
      [4.8, -10.4, true],
      // Twin South Arrival Pillars welcoming players at the Grand Celestial Stairway
      [-3.8, 13.8, false],
      [3.8, 13.8, true],
      // Outer Pantheon Wing Pillars
      [-11.8, -12.6, false],
      [11.8, -12.6, true],
    ];
    for (let i = 0; i < wingedPillars.length; i++) {
      const [px, pz, mirror] = wingedPillars[i];
      const pillarGroup = new THREE.Group();
      pillarGroup.name = 'heaven_winged_pillar';
      pillarGroup.position.set(px, 0, pz);

      const pillarSprite = makeBillboardPlane('/assets/ui/th_heaven_winged_pillar.png', 2.45, 3.35, {
        x: 0,
        y: 0,
        z: 0,
        worldZ: pz,
        mirror,
        name: 'winged_pillar_sprite',
      });
      pillarGroup.add(pillarSprite);

      const orbHalo = makeGlowSprite(1.85, '#ffe484', 0.62, pz);
      orbHalo.name = 'pillar_astrolabe_glow';
      orbHalo.position.set(0, 2.95, 0.12);
      orbHalo.userData = { baseScale: 1.85, baseOpacity: 0.62, phase: i * 0.65 };
      pillarGroup.add(orbHalo);
      this.celestialHalos.push(orbHalo);

      this.decorGroup.add(pillarGroup);
    }

    // 3. Heavenly Winged Marble & Cloud-Ribbon Archway Gates (`th_heaven_cloud_arch.png`)
    //    Framing the West Casino & East Monopoly Wing Promenades (leaving the South centerline 100% open!)
    const cloudArches = [
      [-6.8, -4.5, 3.8, 3.4, false],
      [6.8, -4.5, 3.8, 3.4, true],
      [-8.5, 8.2, 3.7, 3.3, false],
      [8.5, 8.8, 3.7, 3.3, true],
    ];
    for (const [ax, az, aw, ah, mirror] of cloudArches) {
      this.decorGroup.add(
        makeBillboardPlane('/assets/ui/th_heaven_cloud_arch.png', aw, ah, {
          x: ax,
          y: 0,
          z: az,
          mirror,
          name: 'heaven_cloud_arch',
        })
      );
    }

    // 4. Celestial Starlight Lotus & Cloud Reflection Basins (`th_heaven_lotus_fountain.png`)
    const lotusBasins = [
      // Centered on the West & East Sanctuary Islands flanking Goddess Vakarine
      [-5.2, -0.75, 3.65, 1.82, false],
      [5.2, -0.75, 3.65, 1.82, true],
      // Upper NW & NE Sanctuary Islands
      [-12.8, -10.8, 3.7, 1.85, false],
      [12.8, -10.8, 3.7, 1.85, true],
    ];
    for (const [bx, bz, bw, bh, mirror] of lotusBasins) {
      this.decorGroup.add(
        makeBillboardPlane('/assets/ui/th_heaven_lotus_fountain.png', bw, bh, {
          x: bx,
          y: 0,
          z: bz,
          mirror,
          name: 'heaven_lotus_fountain',
        })
      );
    }

    // 5. Golden Seraphim Lyre & Angel-Wing Pedestals (`th_heaven_seraph_harp.png`)
    const seraphHarps = [
      // Flanking the South Starlight Arrival Rotunda
      [-3.5, 5.8, 1.65, 2.4, false],
      [3.5, 5.8, 1.65, 2.4, true],
      // Flanking the Upper Sanctuary Causeway (spaced cleanly away from the Winged Pillars)
      [-2.8, -7.4, 1.55, 2.25, false],
      [2.8, -7.4, 1.55, 2.25, true],
      // Flanking the Grand South Celestial Stairway
      [-6.2, 15.2, 1.75, 2.5, false],
      [6.2, 15.2, 1.75, 2.5, true],
    ];
    for (let i = 0; i < seraphHarps.length; i++) {
      const [hx, hz, hw, hh, mirror] = seraphHarps[i];
      const harpGroup = new THREE.Group();
      harpGroup.name = 'streetlamp';
      harpGroup.position.set(hx, 0, hz);

      harpGroup.add(
        makeBillboardPlane('/assets/ui/th_heaven_seraph_harp.png', hw, hh, {
          x: 0,
          y: 0,
          z: 0,
          worldZ: hz,
          mirror,
          name: 'heaven_seraph_harp',
        })
      );

      const glow = makeGlowSprite(1.55, '#ffe694', 0.54, hz);
      glow.name = 'streetlamp_glow';
      glow.position.set(0, 1.65, 0.1);
      harpGroup.add(glow);

      this.decorGroup.add(harpGroup);
    }

    // 6. Sacred Golden-Starlight & Pearl-Blossom Heaven Trees (`th_heaven_divine_tree.png`)
    //    Resting on the floating marble-and-cloud sanctuary islands!
    const divineTrees = [
      // Upper-left & upper-right Floating Sanctuary Islands behind the Lotus Pools
      [-6.2, -8.2, 4.1, 4.4, false],
      [6.2, -8.2, 4.1, 4.4, true],
      // Lower-left & lower-right South Floating Sanctuary Islands
      [-7.6, 11.6, 4.1, 4.4, true],
      [7.6, 11.6, 4.1, 4.4, false],
      // Outer West & East Floating Cloud Sanctuaries
      [-14.2, -8.6, 4.4, 4.7, false],
      [14.2, -8.6, 4.4, 4.7, true],
      [-14.4, -1.2, 4.3, 4.6, true],
      [14.4, -1.2, 4.3, 4.6, false],
      [-14.2, 6.8, 4.3, 4.6, false],
      [14.2, 6.8, 4.3, 4.6, true],
      // North Pantheon Horizon Groves
      [-15.0, -14.2, 4.4, 4.7, true],
      [15.0, -14.2, 4.4, 4.7, false],
    ];
    for (const [tx, tz, tw, th, mirror] of divineTrees) {
      this.decorGroup.add(
        makeBillboardPlane('/assets/ui/th_heaven_divine_tree.png', tw, th, {
          x: tx,
          y: 0,
          z: tz,
          mirror,
          name: 'sakura_tree',
        })
      );
    }

    // 7. Classical Hand-Painted White-Marble Balustrades (`th_balustrade_marble.png`) along the floating cliff rims
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
    if (!this.onAction) return;
    let normalized = action;
    if (action === 'gacha_shard_shop') normalized = 'fountain';
    else if (action === 'hall_of_fame') normalized = landmarkId || 'statue_1';
    else if (action === 'table_hub_casino') normalized = 'casino_palace';
    else if (action === 'table_hub_monopoly') normalized = 'monopoly_arch';
    else if (action === 'table_hub_sit') normalized = landmarkId || 'vip_table_1';
    this.onAction(normalized);
  }

  pick(cx, cy) {
    if (!this.active || !this.world?.canvas || !this.world?.camera) return null;
    const r = this.world.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.world.camera);
    const hits = ray.intersectObjects(this.landmarksGroup.children, true);
    if (!hits.length) return null;
    let cur = hits[0].object;
    while (cur && cur !== this.landmarksGroup) {
      if (cur.userData?.landmarkId) {
        const action = cur.userData.action;
        this.dispatch(action, cur.userData.landmarkId);
        return { kind: 'landmark', landmarkId: cur.userData.landmarkId, action };
      }
      cur = cur.parent;
    }
    return null;
  }

  renderPrompt(hit) {
    if (!this.promptEl) this.bindEvents();
    if (!this.active || !hit || this.isModalOpen()) {
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
    if (!this.active) {
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
    return this.renderPrompt(best);
  }

  setActive(flag) {
    this.active = Boolean(flag);
    this.root.visible = this.active;
    if (this.world?.villagePlaza?.root) {
      this.world.villagePlaza.root.visible = !this.active;
    }
    if (!this.active) {
      this.renderPrompt(null);
    } else if (this.world?.local) {
      this.checkTrigger(this.world.local.x, this.world.local.z);
    }
  }

  update(dt = 0.016) {
    if (!this.active) return;
    this.elapsed += dt;

    for (let i = 0; i < this.floatingPlaques.length; i++) {
      const sprite = this.floatingPlaques[i];
      const base = sprite.userData?.baseY ?? sprite.position.y;
      const phase = sprite.userData?.phase ?? 0;
      sprite.position.y = base + Math.sin(this.elapsed * 2.1 + phase) * 0.04;
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
      this.fountainWater.material.opacity = 0.52 + Math.sin(this.elapsed * 2.8) * 0.14;
    }

    // Gentle rising golden stardust particles around the Goddess Vakarine Rotunda & Lotus Pools
    this.stardustTimer += dt;
    if (this.stardustTimer >= 0.45) {
      this.stardustTimer = 0;
      const angle = Math.random() * Math.PI * 2;
      const radius = 1.2 + Math.random() * 4.8;
      this.world?.fx?.emit?.('fx_stardust', {
        x: Math.cos(angle) * radius,
        y: 0.35 + Math.random() * 1.4,
        z: Math.sin(angle) * radius,
        scale: 0.52,
        vy: 0.48,
        life: 1.5,
      });
    }

    if (this.world?.local) {
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
