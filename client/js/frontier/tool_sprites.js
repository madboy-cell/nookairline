// client/js/frontier/tool_sprites.js — Procedural 2D canvas sprites for gathering tools.
// Supports 'pickaxe', 'axe', 'staff' across tiers (tier 1 = standard, tier 2 = enchanted cyan/crystal).
// Caches THREE.CanvasTexture instances per (kind + tier) key.

import * as THREE from 'three';

/** Cache of procedurally generated THREE.CanvasTexture instances keyed by `${kind}:${tier}` */
export const TOOL_TEXTURE_CACHE = new Map();

/**
 * 2D canvas dimensions for tool textures (crisp square sprite).
 */
export const TOOL_SPRITE_SIZE = 128;

/**
 * Standard chibi bone-attachment definitions for held tools (singleHand hand weapons).
 * Uses canonical HEAD_H metrics compatible with resolveAccessoryLayout.
 */
export const TOOL_ATTACH_DEFS = {
  pickaxe: {
    bone: 'ARM',
    singleHand: true,
    grip: [0.50, 0.22],
    tilt: [-0.28, -0.50],
    offset: [0, 0],
    scale: 0.72,
    views: { front: 'tool_pickaxe', side: 'tool_pickaxe', back: 'tool_pickaxe' },
  },
  axe: {
    bone: 'ARM',
    singleHand: true,
    grip: [0.50, 0.22],
    tilt: [-0.28, -0.50],
    offset: [0, 0],
    scale: 0.72,
    views: { front: 'tool_axe', side: 'tool_axe', back: 'tool_axe' },
  },
  staff: {
    bone: 'ARM',
    singleHand: true,
    grip: [0.50, 0.30],
    tilt: [-0.20, -0.40],
    offset: [0, 0],
    scale: 0.85,
    views: { front: 'tool_staff', side: 'tool_staff', back: 'tool_staff' },
  },
};

/**
 * Procedurally render a gathering tool onto a 2D canvas context.
 * @param {CanvasRenderingContext2D} ctx
 * @param {'pickaxe'|'axe'|'staff'} kind
 * @param {number} tier
 * @param {number} w
 * @param {number} h
 */
export function drawTool(ctx, kind, tier = 1, w = TOOL_SPRITE_SIZE, h = TOOL_SPRITE_SIZE) {
  ctx.clearRect(0, 0, w, h);
  ctx.save();

  if (kind === 'pickaxe') {
    drawPickaxe(ctx, tier, w, h);
  } else if (kind === 'axe') {
    drawAxe(ctx, tier, w, h);
  } else if (kind === 'staff') {
    drawStaff(ctx, tier, w, h);
  }

  ctx.restore();
}

function drawPickaxe(ctx, tier, w, h) {
  const isTier2 = tier >= 2;

  // Handle shaft: (64, 118) to (64, 32)
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Shaft dark wood outline
  ctx.beginPath();
  ctx.moveTo(w * 0.50, h * 0.92);
  ctx.lineTo(w * 0.50, h * 0.25);
  ctx.lineWidth = w * (8 / 128);
  ctx.strokeStyle = '#3E2723';
  ctx.stroke();

  // Shaft warm wood core
  ctx.beginPath();
  ctx.moveTo(w * 0.50, h * 0.91);
  ctx.lineTo(w * 0.50, h * 0.26);
  ctx.lineWidth = w * (5 / 128);
  ctx.strokeStyle = '#795548';
  ctx.stroke();

  // Wood highlight
  ctx.beginPath();
  ctx.moveTo(w * 0.49, h * 0.90);
  ctx.lineTo(w * 0.49, h * 0.27);
  ctx.lineWidth = w * (1.8 / 128);
  ctx.strokeStyle = '#A1887F';
  ctx.stroke();

  // Handle pommel
  ctx.fillStyle = '#3E2723';
  ctx.beginPath();
  ctx.arc(w * 0.50, h * 0.92, w * (4.5 / 128), 0, Math.PI * 2);
  ctx.fill();

  // Leather grip wraps around palm region (h * 0.68 to h * 0.82)
  ctx.strokeStyle = '#4E342E';
  ctx.lineWidth = w * (2.2 / 128);
  for (let i = 0; i < 4; i++) {
    const yWrap = h * (0.68 + i * 0.04);
    ctx.beginPath();
    ctx.moveTo(w * 0.46, yWrap - 2);
    ctx.lineTo(w * 0.54, yWrap + 2);
    ctx.stroke();
  }

  // Metal collar / head bracket
  ctx.fillStyle = isTier2 ? '#263238' : '#455A64';
  ctx.fillRect(w * 0.44, h * 0.22, w * 0.12, h * 0.09);
  ctx.strokeStyle = isTier2 ? '#00E5FF' : '#263238';
  ctx.lineWidth = w * (1.5 / 128);
  ctx.strokeRect(w * 0.44, h * 0.22, w * 0.12, h * 0.09);

  // Pickaxe Head Path
  // Left spike tip at (22, 44), collar top at (64, 20), right pick tip at (110, 48)
  ctx.beginPath();
  ctx.moveTo(w * (64 / 128), h * (20 / 128));
  // Arch left to back spike
  ctx.bezierCurveTo(w * (48 / 128), h * (21 / 128), w * (32 / 128), h * (32 / 128), w * (22 / 128), h * (44 / 128));
  // Under curve back to collar bottom
  ctx.bezierCurveTo(w * (36 / 128), h * (40 / 128), w * (48 / 128), h * (36 / 128), w * (64 / 128), h * (34 / 128));
  // Under curve to right sharp beak
  ctx.bezierCurveTo(w * (80 / 128), h * (36 / 128), w * (96 / 128), h * (42 / 128), w * (110 / 128), h * (48 / 128));
  // Top curve back to collar top
  ctx.bezierCurveTo(w * (96 / 128), h * (32 / 128), w * (80 / 128), h * (20 / 128), w * (64 / 128), h * (20 / 128));
  ctx.closePath();

  if (isTier2) {
    // Tier 2: Dark obsidian steel with cyan crystal infusion
    ctx.fillStyle = '#37474F';
    ctx.fill();
    ctx.lineWidth = w * (2.2 / 128);
    ctx.strokeStyle = '#00B4D8';
    ctx.stroke();

    // Glowing cyan spine and pick tips
    ctx.beginPath();
    ctx.moveTo(w * (26 / 128), h * (43 / 128));
    ctx.quadraticCurveTo(w * (64 / 128), h * (24 / 128), w * (106 / 128), h * (47 / 128));
    ctx.lineWidth = w * (3.5 / 128);
    ctx.strokeStyle = '#00E5FF';
    ctx.stroke();

    // Core bright highlight
    ctx.lineWidth = w * (1.2 / 128);
    ctx.strokeStyle = '#E0F7FA';
    ctx.stroke();
  } else {
    // Tier 1: Sturdy forged iron/steel
    ctx.fillStyle = '#78909C';
    ctx.fill();
    ctx.lineWidth = w * (2.0 / 128);
    ctx.strokeStyle = '#263238';
    ctx.stroke();

    // Upper ridge light bevel
    ctx.beginPath();
    ctx.moveTo(w * (26 / 128), h * (42 / 128));
    ctx.quadraticCurveTo(w * (64 / 128), h * (22 / 128), w * (106 / 128), h * (46 / 128));
    ctx.lineWidth = w * (2.0 / 128);
    ctx.strokeStyle = '#CFD8DC';
    ctx.stroke();
  }
}

function drawAxe(ctx, tier, w, h) {
  const isTier2 = tier >= 2;

  // Handle shaft: (64, 118) to (64, 24)
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Shaft dark wood outline
  ctx.beginPath();
  ctx.moveTo(w * 0.50, h * 0.92);
  ctx.lineTo(w * 0.50, h * 0.19);
  ctx.lineWidth = w * (8.5 / 128);
  ctx.strokeStyle = '#3E2723';
  ctx.stroke();

  // Shaft core
  ctx.beginPath();
  ctx.moveTo(w * 0.50, h * 0.91);
  ctx.lineTo(w * 0.50, h * 0.20);
  ctx.lineWidth = w * (5.5 / 128);
  ctx.strokeStyle = '#6D4C41';
  ctx.stroke();

  // Wood highlight
  ctx.beginPath();
  ctx.moveTo(w * 0.49, h * 0.90);
  ctx.lineTo(w * 0.49, h * 0.21);
  ctx.lineWidth = w * (1.8 / 128);
  ctx.strokeStyle = '#8D6E63';
  ctx.stroke();

  // Handle pommel
  ctx.fillStyle = '#3E2723';
  ctx.beginPath();
  ctx.arc(w * 0.50, h * 0.92, w * (4.5 / 128), 0, Math.PI * 2);
  ctx.fill();

  // Leather grip wraps (h * 0.68 to h * 0.82)
  ctx.strokeStyle = '#4E342E';
  ctx.lineWidth = w * (2.2 / 128);
  for (let i = 0; i < 4; i++) {
    const yWrap = h * (0.68 + i * 0.04);
    ctx.beginPath();
    ctx.moveTo(w * 0.46, yWrap - 2);
    ctx.lineTo(w * 0.54, yWrap + 2);
    ctx.stroke();
  }

  // Hammer poll on back (left side of head): (40, 22) to (64, 34)
  ctx.fillStyle = isTier2 ? '#37474F' : '#546E7A';
  ctx.fillRect(w * (40 / 128), h * (22 / 128), w * (24 / 128), h * (12 / 128));
  ctx.strokeStyle = isTier2 ? '#00E5FF' : '#263238';
  ctx.lineWidth = w * (1.8 / 128);
  ctx.strokeRect(w * (40 / 128), h * (22 / 128), w * (24 / 128), h * (12 / 128));

  // Wide axe blade (facing right)
  ctx.beginPath();
  ctx.moveTo(w * (64 / 128), h * (20 / 128));
  // Throat up to upper horn (106, 12)
  ctx.bezierCurveTo(w * (78 / 128), h * (18 / 128), w * (92 / 128), h * (14 / 128), w * (106 / 128), h * (12 / 128));
  // Wide curved cutting edge from (106, 12) through (112, 30) to lower horn (98, 54)
  ctx.bezierCurveTo(w * (114 / 128), h * (26 / 128), w * (112 / 128), h * (42 / 128), w * (98 / 128), h * (54 / 128));
  // Bottom throat back into collar at (64, 36)
  ctx.bezierCurveTo(w * (88 / 128), h * (46 / 128), w * (76 / 128), h * (38 / 128), w * (64 / 128), h * (36 / 128));
  ctx.closePath();

  if (isTier2) {
    ctx.fillStyle = '#37474F';
    ctx.fill();
    ctx.lineWidth = w * (2.2 / 128);
    ctx.strokeStyle = '#263238';
    ctx.stroke();

    // Cyan glowing cutting edge
    ctx.beginPath();
    ctx.moveTo(w * (106 / 128), h * (12 / 128));
    ctx.bezierCurveTo(w * (114 / 128), h * (26 / 128), w * (112 / 128), h * (42 / 128), w * (98 / 128), h * (54 / 128));
    ctx.lineWidth = w * (3.8 / 128);
    ctx.strokeStyle = '#00E5FF';
    ctx.stroke();

    ctx.lineWidth = w * (1.5 / 128);
    ctx.strokeStyle = '#E0F7FA';
    ctx.stroke();
  } else {
    // Wide grey blade
    ctx.fillStyle = '#78909C';
    ctx.fill();
    ctx.lineWidth = w * (2.0 / 128);
    ctx.strokeStyle = '#263238';
    ctx.stroke();

    // Sharp steel cutting edge bevel
    ctx.beginPath();
    ctx.moveTo(w * (106 / 128), h * (12 / 128));
    ctx.bezierCurveTo(w * (114 / 128), h * (26 / 128), w * (112 / 128), h * (42 / 128), w * (98 / 128), h * (54 / 128));
    ctx.lineWidth = w * (2.8 / 128);
    ctx.strokeStyle = '#ECEFF1';
    ctx.stroke();
  }
}

function drawStaff(ctx, tier, w, h) {
  const isTier2 = tier >= 2;
  const gemColor = isTier2 ? '#00E5FF' : '#00E676';
  const gemLight = isTier2 ? '#80D8FF' : '#69F0AE';
  const gemDark = isTier2 ? '#0091EA' : '#00C853';
  const glowRgba = isTier2 ? 'rgba(0, 229, 255, 0.45)' : 'rgba(0, 230, 118, 0.45)';

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Long wooden stick shaft: (64, 122) to (64, 36)
  ctx.beginPath();
  ctx.moveTo(w * 0.50, h * 0.95);
  ctx.lineTo(w * 0.50, h * 0.28);
  ctx.lineWidth = w * (6.5 / 128);
  ctx.strokeStyle = '#3E2723';
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(w * 0.50, h * 0.94);
  ctx.lineTo(w * 0.50, h * 0.29);
  ctx.lineWidth = w * (4.2 / 128);
  ctx.strokeStyle = '#5D4037';
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(w * 0.49, h * 0.93);
  ctx.lineTo(w * 0.49, h * 0.30);
  ctx.lineWidth = w * (1.5 / 128);
  ctx.strokeStyle = '#8D6E63';
  ctx.stroke();

  // Bottom staff ferrule
  ctx.fillStyle = '#D4AF37';
  ctx.fillRect(w * 0.46, h * 0.92, w * 0.08, h * 0.04);

  // Mystic grip ring at hand position
  ctx.fillStyle = '#D4AF37';
  ctx.fillRect(w * 0.46, h * 0.68, w * 0.08, h * 0.035);

  // Ornate headpiece cradle / prongs
  ctx.strokeStyle = '#D4AF37';
  ctx.lineWidth = w * (3.0 / 128);
  // Left prong
  ctx.beginPath();
  ctx.moveTo(w * 0.50, h * (36 / 128));
  ctx.bezierCurveTo(w * (38 / 128), h * (28 / 128), w * (44 / 128), h * (18 / 128), w * (52 / 128), h * (14 / 128));
  ctx.stroke();
  // Right prong
  ctx.beginPath();
  ctx.moveTo(w * 0.50, h * (36 / 128));
  ctx.bezierCurveTo(w * (76 / 128), h * (28 / 128), w * (70 / 128), h * (18 / 128), w * (62 / 128), h * (14 / 128));
  ctx.stroke();

  // Cradle collar ring
  ctx.fillStyle = '#FFD54F';
  ctx.fillRect(w * 0.44, h * (34 / 128), w * 0.12, h * (6 / 128));

  // Glowing Gem Tip at (64, 22)
  const gemCX = w * (64 / 128);
  const gemCY = h * (22 / 128);

  // Radial aura glow
  const grad = ctx.createRadialGradient(gemCX, gemCY, 2, gemCX, gemCY, w * (24 / 128));
  grad.addColorStop(0, glowRgba);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(gemCX, gemCY, w * (24 / 128), 0, Math.PI * 2);
  ctx.fill();

  // Faceted crystal diamond: Top (64, 8), Right (76, 22), Bottom (64, 34), Left (52, 22)
  const pTop = [gemCX, h * (8 / 128)];
  const pRight = [w * (76 / 128), gemCY];
  const pBottom = [gemCX, h * (34 / 128)];
  const pLeft = [w * (52 / 128), gemCY];
  const pCenter = [gemCX, gemCY];

  // Top facet (lighter)
  ctx.fillStyle = gemLight;
  ctx.beginPath();
  ctx.moveTo(pTop[0], pTop[1]);
  ctx.lineTo(pRight[0], pRight[1]);
  ctx.lineTo(pCenter[0], pCenter[1]);
  ctx.closePath();
  ctx.fill();

  // Left facet (bright)
  ctx.fillStyle = gemColor;
  ctx.beginPath();
  ctx.moveTo(pTop[0], pTop[1]);
  ctx.lineTo(pCenter[0], pCenter[1]);
  ctx.lineTo(pLeft[0], pLeft[1]);
  ctx.closePath();
  ctx.fill();

  // Bottom-right facet (darker)
  ctx.fillStyle = gemDark;
  ctx.beginPath();
  ctx.moveTo(pCenter[0], pCenter[1]);
  ctx.lineTo(pRight[0], pRight[1]);
  ctx.lineTo(pBottom[0], pBottom[1]);
  ctx.closePath();
  ctx.fill();

  // Bottom-left facet
  ctx.fillStyle = gemColor;
  ctx.beginPath();
  ctx.moveTo(pLeft[0], pLeft[1]);
  ctx.lineTo(pCenter[0], pCenter[1]);
  ctx.lineTo(pBottom[0], pBottom[1]);
  ctx.closePath();
  ctx.fill();

  // Facet borders
  ctx.strokeStyle = isTier2 ? '#01579B' : '#1B5E20';
  ctx.lineWidth = w * (1.2 / 128);
  ctx.beginPath();
  ctx.moveTo(pTop[0], pTop[1]);
  ctx.lineTo(pRight[0], pRight[1]);
  ctx.lineTo(pBottom[0], pBottom[1]);
  ctx.lineTo(pLeft[0], pLeft[1]);
  ctx.closePath();
  ctx.stroke();

  // Gleam spark
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(gemCX - 2, gemCY - 4, w * (1.8 / 128), 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Create a standalone HTML canvas element rendering the specified tool.
 * @param {'pickaxe'|'axe'|'staff'} kind
 * @param {number} tier
 * @returns {HTMLCanvasElement|null}
 */
export function createToolCanvas(kind, tier = 1) {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = TOOL_SPRITE_SIZE;
  canvas.height = TOOL_SPRITE_SIZE;
  const ctx = canvas.getContext('2d');
  if (ctx) drawTool(ctx, kind, tier, TOOL_SPRITE_SIZE, TOOL_SPRITE_SIZE);
  return canvas;
}

/**
 * Retrieve or generate a cached THREE.CanvasTexture for the specified tool kind and tier.
 * @param {'pickaxe'|'axe'|'staff'} kind
 * @param {number} tier
 * @returns {THREE.CanvasTexture|THREE.Texture}
 */
export function getToolTexture(kind, tier = 1) {
  const t = Math.max(1, Math.floor(tier || 1));
  const key = `${kind}:${t}`;
  if (TOOL_TEXTURE_CACHE.has(key)) {
    return TOOL_TEXTURE_CACHE.get(key);
  }

  const canvas = createToolCanvas(kind, t);
  let texture;
  if (canvas) {
    texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    if (typeof Image !== 'undefined') {
      const spriteTier = t >= 2 ? 2 : 1;
      const validKind = (kind === 'axe' || kind === 'staff') ? kind : 'pickaxe';
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const scale = Math.min((canvas.width - 8) / img.width, (canvas.height - 8) / img.height);
        const dw = Math.round(img.width * scale);
        const dh = Math.round(img.height * scale);
        const dx = Math.round((canvas.width - dw) / 2);
        const dy = Math.round((canvas.height - dh) / 2);
        ctx.drawImage(img, dx, dy, dw, dh);
        texture.needsUpdate = true;
      };
      img.src = `/assets/village/tool_${validKind}_${spriteTier}.png`;
    }
  } else {
    // Headless/test environment fallback
    texture = new THREE.Texture();
  }
  texture.userData = { shared: true, kind, tier: t };
  texture.needsUpdate = true;
  TOOL_TEXTURE_CACHE.set(key, texture);
  return texture;
}

/**
 * Dispose and clear all cached tool canvas textures.
 */
export function clearToolTextureCache() {
  for (const tex of TOOL_TEXTURE_CACHE.values()) {
    tex.dispose?.();
  }
  TOOL_TEXTURE_CACHE.clear();
}
