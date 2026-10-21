#!/usr/bin/env node
// scripts/build_ult_art_pack.mjs
// Slices the 3 Tree of Savior Sacred Magic Circle + Additive Glow VFX sheets:
//   - client/assets/monopoly/raw/sheet_ult_monuments_a.png (3x3: 9 Mythic Ultimate monuments)
//   - client/assets/monopoly/raw/sheet_ult_monuments_b.png (3x3: 4 Mythic + 2 Super Mythic + 3 Tile Traps)
//   - client/assets/monopoly/raw/sheet_particle_atlas.png  (4x4: 16 Additive Glow particles -> particle_atlas.png & fx_*.png)
// Extracts soft-feathered alpha from the #000000 background with RGB un-premultiplication so
// luminous glows have zero dark cartoon outlines or black fringes, updates manifest_4a.json and
// asset_manifest.json, and writes QA contact sheets.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS = path.join(ROOT, 'client', 'assets');
const MONO_DIR = path.join(ASSETS, 'monopoly');
const UI_DIR = path.join(ASSETS, 'ui');
const RAW_DIR = path.join(MONO_DIR, 'raw');
const MANIFEST_4A = path.join(MONO_DIR, 'manifest_4a.json');
const ASSET_MANIFEST = path.join(ASSETS, 'asset_manifest.json');

const SHEET_A_NAMES = [
  'mono_ult_naga',
  'mono_ult_kitsune',
  'mono_ult_eclipse',
  'mono_ult_djinn',
  'mono_ult_phoenix',
  'mono_ult_roulette',
  'mono_ult_siren',
  'mono_ult_astral',
  'mono_ult_clock',
];

const SHEET_B_NAMES = [
  'mono_ult_glacial',
  'mono_ult_pharaoh',
  'mono_ult_phantom',
  'mono_ult_zeus',
  'mono_ult_sm_eclipse',
  'mono_ult_sm_aurora',
  'mono_ult_sm_seraphim',
  'mono_ult_sm_cyber',
  'mono_ult_sm_ribbon',
];

const SHEET_C_NAMES = [
  'mono_trap_eclipse_sun',
  'mono_trap_aurora_veil',
  'mono_trap_rose_thorns',
  'mono_trap_cyber_glitch',
  'mono_trap_starlight_gift',
  'mono_trap_lunar_lantern',
  'mono_trap_supernova',
  'mono_trap_foxfire',
  'mono_trap_glacial_crest',
];

const PARTICLE_CELL_NAMES = [
  'fx_snowflake',
  'fx_feather',
  'fx_petal',
  'fx_star',
  'fx_lightning',
  'fx_flame',
  'fx_bubble',
  'fx_note',
  'fx_chip',
  'fx_moon',
  'fx_heart',
  'fx_leaf',
  'fx_stardust',
  'fx_rune',
  'fx_shockwave',
  'fx_magic_circle',
];

// Spells that intentionally contain a dark cosmic void core (Black Sun / Black Hole / Celestial Silhouette)
const VOID_CORE_SPELLS = {
  mono_ult_sm_eclipse:   { cx: 0.50, cy: 0.50, rx: 0.15, ry: 0.15 },
  mono_ult_sm_aurora:    { cx: 0.50, cy: 0.58, rx: 0.09, ry: 0.25 },
  mono_ult_astral:       { cx: 0.50, cy: 0.50, rx: 0.17, ry: 0.17 },
  mono_trap_eclipse_sun: { cx: 0.48, cy: 0.46, rx: 0.21, ry: 0.18 },
};

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Extracts a cell (col, row) from a 3x3 monument sheet and converts the #000000 background
 * into a soft-feathered alpha channel with color un-premultiplication.
 */
function extractMonumentCell(sheetPng, col, row, name) {
  const cols = 3, rows = 3;
  const x0 = Math.round((col * sheetPng.width) / cols);
  const x1 = Math.round(((col + 1) * sheetPng.width) / cols);
  const y0 = Math.round((row * sheetPng.height) / rows);
  const y1 = Math.round(((row + 1) * sheetPng.height) / rows);
  const cw = x1 - x0;
  const ch = y1 - y0;

  const rgba = new Uint8ClampedArray(cw * ch * 4);
  const lum = new Float32Array(cw * ch);

  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const si = ((y0 + y) * sheetPng.width + (x0 + x)) * 4;
      const di = (y * cw + x) * 4;
      const r = sheetPng.data[si];
      const g = sheetPng.data[si + 1];
      const b = sheetPng.data[si + 2];
      rgba[di] = r;
      rgba[di + 1] = g;
      rgba[di + 2] = b;
      rgba[di + 3] = 255;
      const maxC = Math.max(r, g, b);
      const minC = Math.min(r, g, b);
      const satBoost = (maxC - minC) * 0.25;
      lum[y * cw + x] = maxC + satBoost;
    }
  }

  // Pass 1: Flood-fill exterior dark background & soft outer halo from cell borders
  const EXT_THRESH = 155;
  const isExt = new Uint8Array(cw * ch);
  const queue = new Int32Array(cw * ch);
  let qHead = 0, qTail = 0;

  const pushBorder = (x, y) => {
    const idx = y * cw + x;
    if (!isExt[idx] && lum[idx] < EXT_THRESH) {
      isExt[idx] = 1;
      queue[qTail++] = idx;
    }
  };
  for (let x = 0; x < cw; x++) { pushBorder(x, 0); pushBorder(x, ch - 1); }
  for (let y = 0; y < ch; y++) { pushBorder(0, y); pushBorder(cw - 1, y); }

  while (qHead < qTail) {
    const idx = queue[qHead++];
    const x = idx % cw;
    const y = (idx - x) / cw;
    if (x > 0) { const n = idx - 1; if (!isExt[n] && lum[n] < EXT_THRESH) { isExt[n] = 1; queue[qTail++] = n; } }
    if (x < cw - 1) { const n = idx + 1; if (!isExt[n] && lum[n] < EXT_THRESH) { isExt[n] = 1; queue[qTail++] = n; } }
    if (y > 0) { const n = idx - cw; if (!isExt[n] && lum[n] < EXT_THRESH) { isExt[n] = 1; queue[qTail++] = n; } }
    if (y < ch - 1) { const n = idx + cw; if (!isExt[n] && lum[n] < EXT_THRESH) { isExt[n] = 1; queue[qTail++] = n; } }
  }

  const voidCore = VOID_CORE_SPELLS[name] || null;

  // Pass 2: Compute feathered alpha and fully un-premultiply RGB so outer glows have ZERO dark smoky fringe on bright grass
  for (let y = 0; y < ch; y++) {
    const edgeY = Math.min(y, ch - 1 - y);
    for (let x = 0; x < cw; x++) {
      const edgeX = Math.min(x, cw - 1 - x);
      const borderFade = Math.min(1, Math.min(edgeX, edgeY) / 6);
      const idx = y * cw + x;
      const di = idx * 4;
      const r = rgba[di], g = rgba[di + 1], b = rgba[di + 2];
      const maxC = Math.max(r, g, b);
      const v = lum[idx];

      let inVoidCore = false;
      if (voidCore) {
        const dx = (x / cw - voidCore.cx) / voidCore.rx;
        const dy = (y / ch - voidCore.cy) / voidCore.ry;
        if (dx * dx + dy * dy <= 1.0) inVoidCore = true;
      }

      let a = 1.0;
      if (inVoidCore) {
        a = 0.95;
      } else if (isExt[idx]) {
        // Exterior background & outer glow halo: cut dark smoky tail below 26, smooth ramp up to 155
        if (v <= 26) {
          a = 0;
        } else {
          const t = smoothstep(26, EXT_THRESH, v);
          a = Math.pow(t, 1.25);
        }
      } else {
        // Interior enclosed region: make pitch-black gaps between magic circle rings cleanly transparent
        if (v <= 22) {
          a = 0;
        } else if (v < 115) {
          a = smoothstep(22, 115, v);
        } else {
          a = 1.0;
        }
      }

      a *= borderFade;
      if (a <= 0.015) {
        rgba[di] = 0; rgba[di + 1] = 0; rgba[di + 2] = 0; rgba[di + 3] = 0;
      } else {
        // Full color un-premultiplication against #000000 black background so semi-transparent glow is 100% luminous
        if (!inVoidCore && maxC > 0 && maxC < 230 && a < 0.96) {
          const norm = 255 / maxC;
          const blend = 1 - a * 0.65; // smoothly blend from full 255 normalization at low alpha to painted shading at high alpha
          const mult = 1 + (norm - 1) * blend;
          rgba[di] = Math.min(255, Math.round(r * mult));
          rgba[di + 1] = Math.min(255, Math.round(g * mult));
          rgba[di + 2] = Math.min(255, Math.round(b * mult));
        }
        rgba[di + 3] = Math.round(a * 255);
      }
    }
  }

  return trimAndSave({ width: cw, height: ch, data: rgba }, name, MONO_DIR, 'monopoly');
}

/** Trim transparent border with 6px padding and save PNG. */
function trimAndSave(canvas, name, outDir, relPrefix, extraMeta = {}) {
  const { width, height, data } = canvas;
  let minX = width, minY = height, maxX = 0, maxY = 0, nonZero = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 16) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        nonZero++;
      }
    }
  }
  if (maxX < minX) { minX = 0; minY = 0; maxX = width - 1; maxY = height - 1; }
  const pad = 6;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad);
  maxY = Math.min(height - 1, maxY + pad);
  const w = maxX - minX + 1, h = maxY - minY + 1;
  const out = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const si = ((minY + y) * width + (minX + x)) * 4;
      const di = (y * w + x) * 4;
      out.data[di] = data[si];
      out.data[di + 1] = data[si + 1];
      out.data[di + 2] = data[si + 2];
      out.data[di + 3] = data[si + 3];
    }
  }
  const file = path.join(outDir, `${name}.png`);
  fs.writeFileSync(file, PNG.sync.write(out));
  return {
    name,
    width: w,
    height: h,
    data: out.data,
    meta: {
      file: `${relPrefix}/${name}.png`,
      w,
      h,
      anchorX: 0.5,
      anchorY: 0,
      coverage: +(nonZero / (w * h)).toFixed(3),
      ...extraMeta,
    },
  };
}

/**
 * Processes Sheet C (4x4 particle_atlas.png) and also slices individual client/assets/ui/fx_*.png sprites.
 */
function buildParticleAtlas() {
  const rawPath = path.join(RAW_DIR, 'sheet_particle_atlas.png');
  const src = PNG.sync.read(fs.readFileSync(rawPath));
  const W = src.width, H = src.height;
  const cols = 4, rows = 4;
  const cellW = Math.floor(W / cols), cellH = Math.floor(H / rows);

  const atlasOut = new PNG({ width: W, height: H });
  const fxEntries = [];

  for (let idx = 0; idx < 16; idx++) {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const name = PARTICLE_CELL_NAMES[idx];
    const x0 = col * cellW;
    const y0 = row * cellH;
    const cellData = new Uint8ClampedArray(cellW * cellH * 4);

    for (let y = 0; y < cellH; y++) {
      const edgeY = Math.min(y, cellH - 1 - y);
      for (let x = 0; x < cellW; x++) {
        const edgeX = Math.min(x, cellW - 1 - x);
        const borderFade = Math.min(1, Math.min(edgeX, edgeY) / 8);

        const si = ((y0 + y) * W + (x0 + x)) * 4;
        const r = src.data[si];
        const g = src.data[si + 1];
        const b = src.data[si + 2];
        const maxC = Math.max(r, g, b);
        const minC = Math.min(r, g, b);
        const v = maxC + (maxC - minC) * 0.25;

        let a = 0;
        if (v > 10) {
          const t = Math.min(1, (v - 10) / (108 - 10));
          a = t * (2 - t) * borderFade;
        }

        const ci = (y * cellW + x) * 4;
        if (a <= 0.01) {
          cellData[ci] = 0; cellData[ci + 1] = 0; cellData[ci + 2] = 0; cellData[ci + 3] = 0;
          atlasOut.data[si] = 0; atlasOut.data[si + 1] = 0; atlasOut.data[si + 2] = 0; atlasOut.data[si + 3] = 0;
        } else {
          const boost = 1 / Math.max(0.28, a);
          const ro = Math.min(255, Math.round(r * boost));
          const go = Math.min(255, Math.round(g * boost));
          const bo = Math.min(255, Math.round(b * boost));
          const ao = Math.round(a * 255);
          cellData[ci] = ro; cellData[ci + 1] = go; cellData[ci + 2] = bo; cellData[ci + 3] = ao;
          atlasOut.data[si] = ro; atlasOut.data[si + 1] = go; atlasOut.data[si + 2] = bo; atlasOut.data[si + 3] = ao;
        }
      }
    }

    const trimmed = trimAndSave(
      { width: cellW, height: cellH, data: cellData },
      name,
      UI_DIR,
      'ui',
      { anchorX: 0.5, anchorY: 0.5 }
    );
    fxEntries.push(trimmed);
  }

  fs.writeFileSync(path.join(UI_DIR, 'particle_atlas.png'), PNG.sync.write(atlasOut));
  return fxEntries;
}

function writeContactSheet(entries, file, cols = 4) {
  const cell = 240, rows = Math.ceil(entries.length / cols);
  const W = cols * cell, H = rows * cell;
  const out = new PNG({ width: W, height: H });
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4, chk = ((x >> 4) + (y >> 4)) & 1;
      const v = chk ? 34 : 54;
      out.data[i] = v; out.data[i + 1] = v + 4; out.data[i + 2] = v + 12; out.data[i + 3] = 255;
    }
  }
  entries.forEach((s, idx) => {
    const scale = Math.min((cell - 16) / s.width, (cell - 16) / s.height);
    const dw = Math.round(s.width * scale), dh = Math.round(s.height * scale);
    const ox = (idx % cols) * cell + ((cell - dw) >> 1), oy = Math.floor(idx / cols) * cell + ((cell - dh) >> 1);
    for (let y = 0; y < dh; y++) {
      for (let x = 0; x < dw; x++) {
        const si = (Math.min(s.height - 1, Math.floor(y / scale)) * s.width + Math.min(s.width - 1, Math.floor(x / scale))) * 4;
        const a = s.data[si + 3] / 255;
        if (!a) continue;
        const o = ((oy + y) * W + ox + x) * 4;
        for (let k = 0; k < 3; k++) out.data[o + k] = Math.round(out.data[o + k] * (1 - a) + s.data[si + k] * a);
      }
    }
  });
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, PNG.sync.write(out));
}

function main() {
  const sheetA = PNG.sync.read(fs.readFileSync(path.join(RAW_DIR, 'sheet_ult_entities_a.png')));
  const sheetB = PNG.sync.read(fs.readFileSync(path.join(RAW_DIR, 'sheet_ult_entities_b.png')));
  const sheetC = PNG.sync.read(fs.readFileSync(path.join(RAW_DIR, 'sheet_ult_traps_c.png')));

  const builtMonuments = [];
  SHEET_A_NAMES.forEach((name, idx) => {
    builtMonuments.push(extractMonumentCell(sheetA, idx % 3, Math.floor(idx / 3), name));
  });
  SHEET_B_NAMES.forEach((name, idx) => {
    builtMonuments.push(extractMonumentCell(sheetB, idx % 3, Math.floor(idx / 3), name));
  });
  SHEET_C_NAMES.forEach((name, idx) => {
    builtMonuments.push(extractMonumentCell(sheetC, idx % 3, Math.floor(idx / 3), name));
  });

  const m4a = JSON.parse(fs.readFileSync(MANIFEST_4A, 'utf8'));
  for (const item of builtMonuments) {
    m4a.sprites[item.name] = item.meta;
  }
  m4a.generatedAt = new Date().toISOString();
  fs.writeFileSync(MANIFEST_4A, JSON.stringify(m4a, null, 2) + '\n');

  const fxEntries = buildParticleAtlas();
  const assetManifest = JSON.parse(fs.readFileSync(ASSET_MANIFEST, 'utf8'));
  for (const fx of fxEntries) {
    assetManifest.sprites[fx.name] = fx.meta;
  }
  assetManifest.generatedAt = new Date().toISOString();
  fs.writeFileSync(ASSET_MANIFEST, JSON.stringify(assetManifest, null, 2) + '\n');

  writeContactSheet(builtMonuments, path.join(ROOT, 'qa_artifacts', 'ult_spells_contact.png'), 6);
  writeContactSheet(fxEntries, path.join(ROOT, 'qa_artifacts', 'particle_atlas_contact.png'), 4);

  console.log(`Sliced ${builtMonuments.length} Pure Spell Entities & Traps + ${fxEntries.length} Additive Particles!`);
}

main();
