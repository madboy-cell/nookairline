#!/usr/bin/env node
// scripts/slice_living_ecology_v3.mjs — Slices the 21 new Sky Frontier Living Ecology sprites
// (10 field monsters, 2 bosses, 2 outposts, 2 props, 5 nodes) into client/assets/village/,
// 6 new Boss Weapons into client/assets/chibi/, and 4 seamless 2x2 biome tiles into
// client/assets/terrain/, updating client/assets/asset_manifest.json and rendering a
// dark-checkerboard review sheet for visual inspection.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import jpeg from 'jpeg-js';
import { matteCell } from './process_art_assets.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'client', 'assets');

const CUTOUT_SHEETS = [
  {
    src: 'art_src/sheet_tos_ecology_mobs_1.jpg',
    pack: 'village',
    cols: 3,
    rows: 3,
    cells: [
      { name: 'sf_mob_zephyr_hare',     anchorY: 0.08, smartInkMatte: true },
      { name: 'sf_mob_frost_shroom',    anchorY: 0.08, smartInkMatte: true, minIslandRatio: 0.0008 },
      { name: 'sf_mob_sakura_kitsune',  anchorY: 0.08, smartInkMatte: true, minIslandRatio: 0.0008 },
      { name: 'sf_mob_pearl_snapper',   anchorY: 0.08, smartInkMatte: true },
      { name: 'sf_mob_cloud_crane',     anchorY: 0.14, smartInkMatte: true },
      { name: 'sf_mob_bell_spirit',     anchorY: 0.15, smartInkMatte: true, minIslandRatio: 0.001 },
      { name: 'sf_boss_sakura_kitsune', anchorY: 0.08, smartInkMatte: true, minIslandRatio: 0.001 },
      { name: 'sf_outpost_reef',        anchorY: 0.10, smartInkMatte: true },
      { name: 'sf_prop_sakura_torii',   anchorY: 0.10, smartInkMatte: true },
    ],
  },
  {
    src: 'art_src/sheet_tos_ecology_mobs_2.jpg',
    pack: 'village',
    cols: 3,
    rows: 3,
    cells: [
      { name: 'sf_mob_cinder_salamander', anchorY: 0.08, smartInkMatte: true, minIslandRatio: 0.001 },
      { name: 'sf_mob_arc_automaton',     anchorY: 0.10, smartInkMatte: true, minIslandRatio: 0.001 },
      { name: 'sf_mob_star_gargoyle',     anchorY: 0.08, smartInkMatte: true },
      { name: 'sf_mob_chrono_sentinel',   anchorY: 0.14, smartInkMatte: true },
      { name: 'sf_boss_solar_bahamut',    anchorY: 0.08, smartInkMatte: true, minIslandRatio: 0.001 },
      { name: 'sf_outpost_caldera',       anchorY: 0.10, smartInkMatte: true },
      { name: 'sf_prop_astrolabe_pillar', anchorY: 0.10, smartInkMatte: true },
      { name: 'sf_node_sakura_tree',      anchorY: 0.08, smartInkMatte: true, minIslandRatio: 0.001 },
      { name: 'sf_node_pearl_clam',       anchorY: 0.10, smartInkMatte: true, minIslandRatio: 0.001 },
    ],
  },
  {
    src: 'art_src/sheet_tos_ecology_nodes_weapons.jpg',
    cols: 3,
    rows: 3,
    cells: [
      { name: 'sf_node_cloud_lotus',         pack: 'village', anchorY: 0.10, smartInkMatte: true },
      { name: 'sf_node_orichalcum',          pack: 'village', anchorY: 0.10, smartInkMatte: true },
      { name: 'sf_node_astral_prism',        pack: 'village', anchorY: 0.10, smartInkMatte: true },
      { name: 'gloves_boss_kitsune_blade',   pack: 'chibi',   anchorY: 0.50, smartInkMatte: true },
      { name: 'gloves_boss_kitsune_bow',     pack: 'chibi',   anchorY: 0.50, smartInkMatte: true },
      { name: 'gloves_boss_kitsune_staff',   pack: 'chibi',   anchorY: 0.50, smartInkMatte: true },
      { name: 'gloves_boss_bahamut_cleaver', pack: 'chibi',   anchorY: 0.50, smartInkMatte: true },
      { name: 'gloves_boss_bahamut_bow',     pack: 'chibi',   anchorY: 0.50, smartInkMatte: true, tolerance: 28, exteriorStripBand: 14, exteriorStripMinLum: 215, exteriorStripMaxChroma: 95 },
      { name: 'gloves_boss_bahamut_staff',   pack: 'chibi',   anchorY: 0.50, smartInkMatte: true },
    ],
  },
];

const TERRAIN_SHEET = {
  src: 'art_src/sheet_tos_ecology_terrain.jpg',
  pack: 'terrain',
  cols: 2,
  rows: 2,
  tileSize: 256,
  cells: [
    'terrain_reef_floor',
    'terrain_reef_water',
    'terrain_caldera_floor',
    'terrain_caldera_ember',
  ],
};

function readImage(file) {
  const buf = fs.readFileSync(file);
  if (/\.png$/i.test(file)) {
    const png = PNG.sync.read(buf);
    return { width: png.width, height: png.height, data: png.data };
  }
  const img = jpeg.decode(buf, { useTArray: true, formatAsRGBA: true, maxMemoryUsageInMB: 1024 });
  return { width: img.width, height: img.height, data: img.data };
}

function writePng(file, width, height, data) {
  const png = new PNG({ width, height });
  png.data = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, PNG.sync.write(png));
}

function cropCell(img, x0, y0, w, h) {
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    const src = ((y0 + y) * img.width + x0) * 4;
    out.set(img.data.subarray(src, src + w * 4), y * w * 4);
  }
  return out;
}

function downsampleBox(srcData, sw, sh, dw, dh) {
  const out = new Uint8ClampedArray(dw * dh * 4);
  const scaleX = sw / dw;
  const scaleY = sh / dh;
  for (let dy = 0; dy < dh; dy++) {
    const sy0 = Math.floor(dy * scaleY);
    const sy1 = Math.max(sy0 + 1, Math.min(sh, Math.ceil((dy + 1) * scaleY)));
    for (let dx = 0; dx < dw; dx++) {
      const sx0 = Math.floor(dx * scaleX);
      const sx1 = Math.max(sx0 + 1, Math.min(sw, Math.ceil((dx + 1) * scaleX)));
      let r = 0, g = 0, b = 0, n = 0;
      for (let sy = sy0; sy < sy1; sy++) {
        for (let sx = sx0; sx < sx1; sx++) {
          const i = (sy * sw + sx) * 4;
          r += srcData[i];
          g += srcData[i + 1];
          b += srcData[i + 2];
          n++;
        }
      }
      const oi = (dy * dw + dx) * 4;
      out[oi] = Math.round(r / n);
      out[oi + 1] = Math.round(g / n);
      out[oi + 2] = Math.round(b / n);
      out[oi + 3] = 255;
    }
  }
  return out;
}

function makeEdgeSeamless(px, size, blend = 18) {
  const copy = new Uint8ClampedArray(px);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < blend; x++) {
      const t = 0.5 + 0.5 * (x / blend);
      const iL = (y * size + x) * 4;
      const iR = (y * size + (size - 1 - x)) * 4;
      for (let k = 0; k < 3; k++) {
        const a = copy[iL + k], b = copy[iR + k];
        px[iL + k] = Math.round(a * t + b * (1 - t));
        px[iR + k] = Math.round(b * t + a * (1 - t));
      }
    }
  }
  copy.set(px);
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < blend; y++) {
      const t = 0.5 + 0.5 * (y / blend);
      const iT = (y * size + x) * 4;
      const iB = ((size - 1 - y) * size + x) * 4;
      for (let k = 0; k < 3; k++) {
        const a = copy[iT + k], b = copy[iB + k];
        px[iT + k] = Math.round(a * t + b * (1 - t));
        px[iB + k] = Math.round(b * t + a * (1 - t));
      }
    }
  }
  return px;
}

function sampleBackground(px, w, h) {
  const samples = [];
  const patch = 4;
  for (const [cx, cy] of [[0, 0], [w - patch, 0], [0, h - patch], [w - patch, h - patch]]) {
    for (let y = cy; y < cy + patch; y++) for (let x = cx; x < cx + patch; x++) {
      const i = (y * w + x) * 4;
      samples.push([px[i], px[i + 1], px[i + 2]]);
    }
  }
  const med = (k) => samples.map((s) => s[k]).sort((a, b) => a - b)[samples.length >> 1];
  return [med(0), med(1), med(2)];
}

function writeContactSheet(entries, file) {
  const cell = 240, cols = 6, rows = Math.ceil(entries.length / cols);
  const W = cols * cell, H = rows * cell;
  const out = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4, chk = ((x >> 4) + (y >> 4)) & 1;
    const v = chk ? 40 : 66;
    out[i] = v; out[i + 1] = v + 6; out[i + 2] = v + 16; out[i + 3] = 255;
  }
  entries.forEach((s, idx) => {
    const scale = Math.min((cell - 20) / s.width, (cell - 20) / s.height);
    const dw = Math.round(s.width * scale), dh = Math.round(s.height * scale);
    const ox = (idx % cols) * cell + ((cell - dw) >> 1), oy = Math.floor(idx / cols) * cell + ((cell - dh) >> 1);
    for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) {
      const si = (Math.min(s.height - 1, Math.floor(y / scale)) * s.width + Math.min(s.width - 1, Math.floor(x / scale))) * 4;
      const a = s.data[si + 3] / 255;
      if (!a) continue;
      const o = ((oy + y) * W + ox + x) * 4;
      for (let k = 0; k < 3; k++) out[o + k] = out[o + k] * (1 - a) + s.data[si + k] * a;
    }
  });
  writePng(file, W, H, out);
}

function main() {
  const manifestPath = path.join(OUT_DIR, 'asset_manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const contact = [];
  let warnings = 0;

  for (const sheet of CUTOUT_SHEETS) {
    const srcPath = path.join(ROOT, sheet.src);
    const img = readImage(srcPath);
    const bg = sampleBackground(img.data, img.width, img.height);
    const cw = Math.floor(img.width / sheet.cols);
    const ch = Math.floor(img.height / sheet.rows);
    console.log(`• ${sheet.src} (${img.width}x${img.height}) -> ${sheet.cols}x${sheet.rows} cells (${cw}x${ch})`);

    sheet.cells.forEach((cell, idx) => {
      const pack = cell.pack || sheet.pack;
      const r = Math.floor(idx / sheet.cols);
      const c = idx % sheet.cols;
      const mx = Math.floor(cw * 0.14);
      const my = Math.floor(ch * 0.14);
      const wx0 = Math.max(0, c * cw - mx);
      const wy0 = Math.max(0, r * ch - my);
      const wx1 = Math.min(img.width, (c + 1) * cw + mx);
      const wy1 = Math.min(img.height, (r + 1) * ch + my);
      const w = wx1 - wx0;
      const h = wy1 - wy0;
      const px = cropCell(img, wx0, wy0, w, h);
      const keepRect = [c * cw - wx0, r * ch - wy0, (c + 1) * cw - wx0, (r + 1) * ch - wy0];
      const res = matteCell(px, w, h, {
        bg,
        tolerance: cell.tolerance ?? 24,
        smartInkMatte: Boolean(cell.smartInkMatte),
        exteriorStripBand: cell.exteriorStripBand ?? (cell.smartInkMatte ? 4 : 0),
        exteriorStripMinLum: cell.exteriorStripMinLum,
        exteriorStripMaxChroma: cell.exteriorStripMaxChroma,
        minPurePaperCore: cell.minPurePaperCore,
        smartHoleMinArea: cell.smartHoleMinArea ?? 14,
        minIslandRatio: cell.minIslandRatio ?? 0.02,
        keepRect,
      });
      if (!res) throw new Error(`Empty cell: ${cell.name}`);
      const touches = res.bbox[0] <= 0 || res.bbox[1] <= 0 || res.bbox[0] + res.bbox[2] >= w || res.bbox[1] + res.bbox[3] >= h;
      if (touches) {
        console.warn(`  ! ${cell.name}: touches crop window border`);
        warnings++;
      }
      const rel = `${pack}/${cell.name}.png`;
      writePng(path.join(OUT_DIR, rel), res.width, res.height, res.data);
      manifest.sprites[cell.name] = {
        file: rel,
        w: res.width,
        h: res.height,
        anchorX: 0.5,
        anchorY: cell.anchorY ?? 0.1,
        coverage: +res.coverage.toFixed(3),
      };
      contact.push({ name: cell.name, ...res });
      console.log(`  ✓ ${rel.padEnd(40)} ${String(res.width).padStart(4)}x${String(res.height).padEnd(4)} cov=${(res.coverage * 100).toFixed(1)}%`);
    });
  }

  // Slice 2x2 Terrain Tiles (no alpha matting — full opaque repeating tiles)
  {
    const tImg = readImage(path.join(ROOT, TERRAIN_SHEET.src));
    const qW = Math.floor(tImg.width / TERRAIN_SHEET.cols);
    const qH = Math.floor(tImg.height / TERRAIN_SHEET.rows);
    const inset = 8;
    console.log(`• ${TERRAIN_SHEET.src} (${tImg.width}x${tImg.height}) -> 2x2 seamless tiles`);
    TERRAIN_SHEET.cells.forEach((name, idx) => {
      const r = Math.floor(idx / TERRAIN_SHEET.cols);
      const c = idx % TERRAIN_SHEET.cols;
      const crop = cropCell(tImg, c * qW + inset, r * qH + inset, qW - inset * 2, qH - inset * 2);
      const tile = makeEdgeSeamless(downsampleBox(crop, qW - inset * 2, qH - inset * 2, TERRAIN_SHEET.tileSize, TERRAIN_SHEET.tileSize), TERRAIN_SHEET.tileSize, 16);
      const rel = `${TERRAIN_SHEET.pack}/${name}.png`;
      writePng(path.join(OUT_DIR, rel), TERRAIN_SHEET.tileSize, TERRAIN_SHEET.tileSize, tile);
      manifest.sprites[name] = {
        file: rel,
        w: TERRAIN_SHEET.tileSize,
        h: TERRAIN_SHEET.tileSize,
        anchorX: 0.5,
        anchorY: 0.5,
        tile: true,
        coverage: 1,
      };
      contact.push({ name, width: TERRAIN_SHEET.tileSize, height: TERRAIN_SHEET.tileSize, data: tile });
      console.log(`  ✓ ${rel.padEnd(40)}  256x256  tile=true`);
    });
  }

  manifest.generatedAt = new Date().toISOString();
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  const reviewOut = process.argv[2] || '/Users/thanapat/.gemini/antigravity/brain/d838a442-5d16-4af4-a0dc-9a76cd85c51d/qa_vfx_v2/living_ecology_cutouts_check.png';
  writeContactSheet(contact, reviewOut);
  console.log(`\nDone: ${contact.length} assets sliced, ${warnings} warnings -> ${reviewOut}`);
}

main();
