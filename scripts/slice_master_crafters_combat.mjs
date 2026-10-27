#!/usr/bin/env node
// scripts/slice_master_crafters_combat.mjs — Slices the 15 Master Crafter / Boss / Sovereign held weapons
// into client/assets/chibi/ and the 9 Tree of Savior × Frieren multi-variant VFX sub-sprites into
// client/assets/vfx/, updating client/assets/asset_manifest.json and producing a dark-checkerboard review sheet.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import jpeg from 'jpeg-js';
import { matteCell } from './process_art_assets.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'client', 'assets');

const SHEETS = [
  {
    src: 'art_src/sheet_weapons_mastercrafter_v1.jpg',
    pack: 'chibi',
    cols: 3,
    rows: 3,
    cells: [
      { name: 'gloves_starter_sword',     anchorY: 0.5 },
      { name: 'gloves_starter_shortbow',  anchorY: 0.5, smartInkMatte: true },
      { name: 'gloves_starter_wand',      anchorY: 0.5 },
      { name: 'gloves_boss_moss_cleaver', anchorY: 0.5 },
      { name: 'gloves_boss_moss_longbow', anchorY: 0.5, smartInkMatte: true },
      { name: 'gloves_boss_moss_staff',   anchorY: 0.5, smartInkMatte: true },
      { name: 'gloves_boss_weaver_scythe',anchorY: 0.5 },
      { name: 'gloves_boss_weaver_bow',   anchorY: 0.5, smartInkMatte: true, tolerance: 24 },
      { name: 'gloves_boss_weaver_cane',  anchorY: 0.5, smartInkMatte: true },
    ],
  },
  {
    src: 'art_src/sheet_weapons_sovereign_v1.jpg',
    pack: 'chibi',
    cols: 3,
    rows: 2,
    cells: [
      { name: 'gloves_mythic_prism_blade',    anchorY: 0.5, tolerance: 20 },
      { name: 'gloves_mythic_bahamut_scythe', anchorY: 0.5, smartInkMatte: true },
      { name: 'gloves_mythic_phoenix_bow',    anchorY: 0.5, smartInkMatte: true },
      { name: 'gloves_mythic_chrono_bow',     anchorY: 0.5, smartInkMatte: true },
      { name: 'gloves_mythic_eden_harpbow',   anchorY: 0.5, smartInkMatte: true },
      { name: 'gloves_mythic_poseidon_staff', anchorY: 0.5, smartInkMatte: true, tolerance: 22 },
    ],
  },
  {
    src: 'art_src/sheet_tos_skill_vfx.jpg',
    pack: 'vfx',
    cols: 3,
    rows: 3,
    cells: [
      { name: 'vfx_flower_periwinkle', anchorY: 0.08, tolerance: 22 },
      { name: 'vfx_flower_lavender',   anchorY: 0.08, tolerance: 22 },
      { name: 'vfx_flower_buttercup',  anchorY: 0.08, tolerance: 22 },
      { name: 'vfx_crystal_cyan',      anchorY: 0.08, tolerance: 22 },
      { name: 'vfx_crystal_violet',    anchorY: 0.08, tolerance: 22 },
      { name: 'vfx_moss_megalith',     anchorY: 0.08, tolerance: 22 },
      { name: 'vfx_dewdrop_pearl',     anchorY: 0.12, tolerance: 20 },
      { name: 'vfx_lantern_wisp',      anchorY: 0.50, tolerance: 22 },
      { name: 'vfx_starlight_arrow',   anchorY: 0.50, tolerance: 22 },
    ],
  },
  {
    src: 'art_src/sheet_tos_skill_vfx_2.jpg',
    pack: 'vfx',
    cols: 3,
    rows: 3,
    cells: [
      { name: 'vfx_slime_jelly_puff',     anchorY: 0.08, tolerance: 24 },
      { name: 'vfx_lilypad_lotus',        anchorY: 0.08, tolerance: 24 },
      { name: 'vfx_boar_bramble_thorn',   anchorY: 0.08, tolerance: 24, smartInkMatte: true, minPurePaperCore: 28 },
      { name: 'vfx_gale_leaf_swirl',      anchorY: 0.16, tolerance: 24, smartInkMatte: true, minPurePaperCore: 24, minIslandRatio: 0.002 },
      { name: 'vfx_tusk_dust_plume',      anchorY: 0.08, tolerance: 24, minIslandRatio: 0.002 },
      { name: 'vfx_beetle_horn_spire',    anchorY: 0.08, tolerance: 24 },
      { name: 'vfx_ice_prism_rosette',    anchorY: 0.12, tolerance: 24 },
      { name: 'vfx_bat_echo_wing',        anchorY: 0.35, tolerance: 24 },
      { name: 'vfx_crimson_soul_lantern', anchorY: 0.35, tolerance: 24, smartInkMatte: true, minPurePaperCore: 24, minIslandRatio: 0.002 },
    ],
  },
  {
    src: 'art_src/sheet_tos_skill_vfx_3.jpg',
    pack: 'vfx',
    cols: 3,
    rows: 3,
    cells: [
      { name: 'vfx_quartz_rune_obelisk',  anchorY: 0.08, tolerance: 24 },
      { name: 'vfx_gravity_orbit_slab',   anchorY: 0.20, tolerance: 24, smartInkMatte: true, minPurePaperCore: 20, minIslandRatio: 0.002 },
      { name: 'vfx_worldroot_arch',       anchorY: 0.08, tolerance: 24, smartInkMatte: true },
      { name: 'vfx_shrine_pillar_ruin',   anchorY: 0.08, tolerance: 24 },
      { name: 'vfx_weaver_prism_spindle', anchorY: 0.12, tolerance: 24, smartInkMatte: true, protectCenterFacet: true },
      { name: 'vfx_arachne_silk_crystal', anchorY: 0.08, tolerance: 24, smartInkMatte: true },
      { name: 'vfx_rainbow_star_shard',   anchorY: 0.35, tolerance: 24 },
      { name: 'vfx_arcane_comet_orb',     anchorY: 0.50, tolerance: 28, smartInkMatte: true, exteriorStripBand: 18, exteriorStripMinLum: 175, exteriorStripMaxChroma: 110 },
      { name: 'vfx_celestial_gold_lily',  anchorY: 0.08, tolerance: 24 },
    ],
  },
];

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
    const v = chk ? 42 : 68;
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

  for (const sheet of SHEETS) {
    const srcPath = path.join(ROOT, sheet.src);
    const img = readImage(srcPath);
    const bg = sampleBackground(img.data, img.width, img.height);
    const cw = Math.floor(img.width / sheet.cols);
    const ch = Math.floor(img.height / sheet.rows);
    console.log(`• ${sheet.src} (${img.width}x${img.height}) -> ${sheet.cols}x${sheet.rows} cells (${cw}x${ch})`);

    sheet.cells.forEach((cell, idx) => {
      const r = Math.floor(idx / sheet.cols);
      const c = idx % sheet.cols;
      const mx = Math.floor(cw * 0.18);
      const my = Math.floor(ch * 0.18);
      const wx0 = Math.max(0, c * cw - mx);
      const wy0 = Math.max(0, r * ch - my);
      const wx1 = Math.min(img.width, (c + 1) * cw + mx);
      const wy1 = Math.min(img.height, (r + 1) * ch + my);
      const w = wx1 - wx0;
      const h = wy1 - wy0;
      const px = cropCell(img, wx0, wy0, w, h);
      if (cell.protectCenterFacet) {
        const cx0 = Math.floor(w * 0.40), cx1 = Math.ceil(w * 0.60);
        const cy0 = Math.floor(h * 0.36), cy1 = Math.ceil(h * 0.64);
        for (let yy = cy0; yy < cy1; yy++) {
          for (let xx = cx0; xx < cx1; xx++) {
            const ii = (yy * w + xx) * 4;
            if (px[ii] >= 246 && px[ii + 1] >= 246 && px[ii + 2] >= 246) {
              px[ii] = 236; px[ii + 1] = 250; px[ii + 2] = 255;
            }
          }
        }
      }
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
        minIslandRatio: cell.minIslandRatio ?? 0.025,
        keepRect,
      });
      if (!res) throw new Error(`Empty cell: ${cell.name}`);
      const touches = res.bbox[0] <= 0 || res.bbox[1] <= 0 || res.bbox[0] + res.bbox[2] >= w || res.bbox[1] + res.bbox[3] >= h;
      if (touches) {
        console.warn(`  ! ${cell.name}: touches cell border`);
        warnings++;
      }
      const rel = `${sheet.pack}/${cell.name}.png`;
      writePng(path.join(OUT_DIR, rel), res.width, res.height, res.data);
      manifest.sprites[cell.name] = {
        file: rel,
        w: res.width,
        h: res.height,
        anchorX: 0.5,
        anchorY: cell.anchorY ?? 0.5,
        coverage: +res.coverage.toFixed(3),
      };
      contact.push({ name: cell.name, ...res });
      console.log(`  ✓ ${rel.padEnd(38)} ${String(res.width).padStart(4)}x${String(res.height).padEnd(4)} cov=${(res.coverage * 100).toFixed(1)}%`);
    });
  }

  manifest.generatedAt = new Date().toISOString();
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  const reviewOut = process.argv[2] || '/Users/thanapat/.gemini/antigravity/brain/d838a442-5d16-4af4-a0dc-9a76cd85c51d/scratch/master_crafters_cutouts.png';
  writeContactSheet(contact, reviewOut);
  console.log(`\nDone: ${contact.length} sprites sliced, ${warnings} warnings -> ${reviewOut}`);
}

main();
