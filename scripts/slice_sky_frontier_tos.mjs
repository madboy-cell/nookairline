#!/usr/bin/env node
// scripts/slice_sky_frontier_tos.mjs — Slices the Tree of Savior ("Storybook Kingdom")
// Base Camp v2 & Sky Frontier sprite sheets + terrain swatches into client/assets/village/
// and client/assets/terrain/, and registers all sprites in client/assets/asset_manifest.json.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import jpeg from 'jpeg-js';
import { matteCell } from './process_art_assets.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'client', 'assets');

const SPRITE_SHEETS = [
  {
    src: 'art_src/sheet_tos_basecamp_v2.jpg',
    pack: 'village',
    cells: [
      { name: 'bld_castle_ruins',   anchorY: 0.12 },
      { name: 'bld_workshop',       anchorY: 0.12 },
      { name: 'bld_cottage',        anchorY: 0.12 },
      { name: 'bld_farm_plot',      anchorY: 0.18 },
      { name: 'hi_shared_chest',    anchorY: 0.15 },
      { name: 'sf_outpost_goddess', anchorY: 0.10, tolerance: 44 },
      { name: 'sf_mill_ruins',      anchorY: 0.10 },
      { name: 'sf_sky_mist_gate',   anchorY: 0.10 },
      { name: 'sf_hollow_outpost',  anchorY: 0.10 },
    ],
  },
  {
    src: 'art_src/sheet_tos_frontier_nodes_v2.jpg',
    pack: 'village',
    cells: [
      { name: 'sf_node_wood',        anchorY: 0.08 },
      { name: 'sf_node_stone',       anchorY: 0.12 },
      { name: 'sf_node_wheat',       anchorY: 0.10 },
      { name: 'sf_node_herb',        anchorY: 0.10 },
      { name: 'sf_node_crystal',     anchorY: 0.10 },
      { name: 'sf_node_mithril',     anchorY: 0.10 },
      { name: 'sf_prop_meadow_tree', anchorY: 0.08 },
      { name: 'sf_prop_hollow_wall', anchorY: 0.10 },
      { name: 'sf_prop_scarecrow',   anchorY: 0.08 },
    ],
  },
  {
    src: 'art_src/sheet_tos_monsters_props_v2.jpg',
    pack: 'village',
    cells: [
      { name: 'sf_mob_moss_slime',       anchorY: 0.08, tolerance: 42 },
      { name: 'sf_mob_thornback_boar',   anchorY: 0.08 },
      { name: 'sf_mob_pollen_wisp',      anchorY: 0.15, tolerance: 40 },
      { name: 'sf_mob_crystal_beetle',   anchorY: 0.08, cropBottomFrac: 0.10, minIslandRatio: 0.05 },
      { name: 'sf_mob_lantern_bat',      anchorY: 0.15, tolerance: 36 },
      { name: 'sf_mob_quartz_golemling', anchorY: 0.08 },
      { name: 'sf_boss_moss_golem',      anchorY: 0.08 },
      { name: 'sf_boss_crystal_weaver',  anchorY: 0.08, tolerance: 36 },
      { name: 'sf_prop_minecart',        anchorY: 0.10, tolerance: 36 },
    ],
  },
  {
    src: 'art_src/sheet_tos_tools_crops_v2.jpg',
    pack: 'village',
    cropTopFrac: 0.04,
    cropBottomFrac: 0.14,
    cells: [
      { name: 'tool_pickaxe_1',      anchorY: 0.22, minIslandRatio: 0.02 },
      { name: 'tool_pickaxe_2',      anchorY: 0.22, minIslandRatio: 0.02 },
      { name: 'tool_axe_1',          anchorY: 0.22, minIslandRatio: 0.02 },
      { name: 'tool_axe_2',          anchorY: 0.22, minIslandRatio: 0.02 },
      { name: 'tool_staff_1',        anchorY: 0.30, minIslandRatio: 0.02 },
      { name: 'tool_staff_2',        anchorY: 0.30, minIslandRatio: 0.02 },
      { name: 'sf_prop_timber_arch', anchorY: 0.08, tolerance: 36, minIslandRatio: 0.02 },
      { name: 'sf_prop_rope_bridge', anchorY: 0.15, minIslandRatio: 0.02 },
      { name: 'crop_berries_ready',  anchorY: 0.10, minIslandRatio: 0.02 },
    ],
  },
  {
    src: 'art_src/sheet_tos_story_buildings_v2.jpg',
    pack: 'village',
    cells: [
      { name: 'bld_castle',            anchorY: 0.12, minIslandRatio: 0.005 },
      { name: 'dec_tent',              anchorY: 0.14, minIslandRatio: 0.005 },
      { name: 'bld_windmill_bakery',   anchorY: 0.12, minIslandRatio: 0.005 },
      { name: 'bld_patisserie',        anchorY: 0.12, cropTopFrac: 0.04, minIslandRatio: 0.02 },
      { name: 'bld_owl_post_office',   anchorY: 0.12, minIslandRatio: 0.005 },
      { name: 'bld_mint',              anchorY: 0.12, minIslandRatio: 0.005 },
      { name: 'bld_flower_greenhouse', anchorY: 0.12, minIslandRatio: 0.005 },
      { name: 'bld_nest',              anchorY: 0.12, minIslandRatio: 0.005 },
      { name: 'wnd_onsen',             anchorY: 0.12, minIslandRatio: 0.005 },
    ],
  },
];

const TERRAIN_CELLS = [
  'road_farmland',
  'road_dirt',
  'road_flagstone',
  'road_boardwalk',
  'road_wildflower',
  'biome_autumn_orchard',
  'biome_mossy_woods',
  'biome_rose_garden',
  'terrain_hollow_floor',
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

/**
 * Resize an RGBA buffer to targetW x targetH with bilinear interpolation,
 * then apply a soft toroidal wrap blend around the borders so it tiles cleanly.
 */
function makeSeamlessTile(srcData, srcW, srcH, size = 256) {
  const raw = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) {
    const sy = (y / size) * (srcH - 1);
    const y0 = Math.floor(sy), y1 = Math.min(srcH - 1, y0 + 1);
    const fy = sy - y0;
    for (let x = 0; x < size; x++) {
      const sx = (x / size) * (srcW - 1);
      const x0 = Math.floor(sx), x1 = Math.min(srcW - 1, x0 + 1);
      const fx = sx - x0;
      const i00 = (y0 * srcW + x0) * 4;
      const i10 = (y0 * srcW + x1) * 4;
      const i01 = (y1 * srcW + x0) * 4;
      const i11 = (y1 * srcW + x1) * 4;
      const di = (y * size + x) * 4;
      for (let k = 0; k < 3; k++) {
        const v0 = srcData[i00 + k] * (1 - fx) + srcData[i10 + k] * fx;
        const v1 = srcData[i01 + k] * (1 - fx) + srcData[i11 + k] * fx;
        raw[di + k] = Math.round(v0 * (1 - fy) + v1 * fy);
      }
      raw[di + 3] = 255;
    }
  }

  // Soft edge cross-fade (24px margin) for seamless RepeatWrapping
  const out = new Uint8ClampedArray(raw);
  const margin = 24;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const di = (y * size + x) * 4;
      const wx = (x + (size >> 1)) % size;
      const wy = (y + (size >> 1)) % size;
      const wi = (wy * size + wx) * 4;

      const dx = Math.min(x, size - 1 - x);
      const dy = Math.min(y, size - 1 - y);
      const d = Math.min(dx, dy);
      if (d < margin) {
        const t = 0.5 * (1 - d / margin); // 0.5 at edge -> 0 at margin
        for (let k = 0; k < 3; k++) {
          out[di + k] = Math.round(raw[di + k] * (1 - t) + raw[wi + k] * t);
        }
      }
    }
  }
  return out;
}

function writeContactSheet(entries, file) {
  const cell = 200, cols = 6, rows = Math.ceil(entries.length / cols);
  const W = cols * cell, H = rows * cell;
  const out = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4, chk = ((x >> 4) + (y >> 4)) & 1;
    const v = chk ? 44 : 68;
    out[i] = v; out[i + 1] = v + 6; out[i + 2] = v + 16; out[i + 3] = 255;
  }
  entries.forEach((s, idx) => {
    const scale = Math.min((cell - 16) / s.width, (cell - 16) / s.height);
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
  const mainManifestPath = path.join(OUT_DIR, 'asset_manifest.json');
  const mMain = JSON.parse(fs.readFileSync(mainManifestPath, 'utf8'));
  const contact = [];

  for (const sheet of SPRITE_SHEETS) {
    const srcPath = path.join(ROOT, sheet.src);
    if (!fs.existsSync(srcPath)) {
      console.warn(`! Missing sheet: ${sheet.src}`);
      continue;
    }
    const img = readImage(srcPath);
    const sheetBg = sampleBackground(img.data, img.width, img.height);
    const cols = 3, rows = 3;
    const cw = Math.floor(img.width / cols), ch = Math.floor(img.height / rows);

    sheet.cells.forEach((cell, idx) => {
      const r = Math.floor(idx / cols), c = idx % cols;
      const inset = 6;
      const topTrim = Math.floor(ch * (cell.cropTopFrac ?? sheet.cropTopFrac ?? 0));
      const bottomTrim = Math.floor(ch * (cell.cropBottomFrac ?? sheet.cropBottomFrac ?? 0));
      const x0 = c * cw + inset;
      const y0 = r * ch + inset + topTrim;
      const w = cw - inset * 2;
      const h = ch - inset * 2 - topTrim - bottomTrim;
      const px = cropCell(img, x0, y0, w, h);
      const res = matteCell(px, w, h, {
        bg: sheetBg,
        tolerance: cell.tolerance || 28,
        holeMinArea: 280,
        minIslandRatio: cell.minIslandRatio || 0.002,
        keepRect: [0, 0, w, h],
      });
      if (!res) {
        console.warn(`! Empty cell for ${cell.name}`);
        return;
      }
      const rel = `${sheet.pack}/${cell.name}.png`;
      writePng(path.join(OUT_DIR, rel), res.width, res.height, res.data);
      mMain.sprites[cell.name] = {
        file: rel,
        w: res.width,
        h: res.height,
        anchorX: 0.5,
        anchorY: cell.anchorY ?? 0.1,
        coverage: +res.coverage.toFixed(3),
      };
      contact.push({ name: cell.name, ...res });
      console.log(`✓ ${rel.padEnd(36)} ${res.width}x${res.height}`);
    });
  }

  // Terrain 3x3 sheet
  const terrainSrc = path.join(ROOT, 'art_src/sheet_tos_terrain_v2.jpg');
  if (fs.existsSync(terrainSrc)) {
    const img = readImage(terrainSrc);
    const cols = 3, rows = 3;
    const cw = Math.floor(img.width / cols), ch = Math.floor(img.height / rows);
    TERRAIN_CELLS.forEach((name, idx) => {
      const r = Math.floor(idx / cols), c = idx % cols;
      // Crop interior 76% of each cell so any grid border / bevel is excluded
      const marginX = Math.floor(cw * 0.12);
      const marginY = Math.floor(ch * 0.12);
      const x0 = c * cw + marginX;
      const y0 = r * ch + marginY;
      const w = cw - marginX * 2;
      const h = ch - marginY * 2;
      const px = cropCell(img, x0, y0, w, h);
      const tileData = makeSeamlessTile(px, w, h, 256);
      const rel = `terrain/${name}.png`;
      writePng(path.join(OUT_DIR, rel), 256, 256, tileData);
      mMain.sprites[name] = {
        file: rel,
        w: 256,
        h: 256,
        anchorX: 0.5,
        anchorY: 0.5,
        tile: true,
        coverage: 1,
      };
      console.log(`✓ ${rel.padEnd(36)} 256x256 (tile)`);
    });

    // Also create biome_winter_highland from ground_aurora / mossy_woods if not present
    const auroraPath = path.join(OUT_DIR, 'terrain/ground_aurora.png');
    if (fs.existsSync(auroraPath)) {
      const winRel = 'terrain/biome_winter_highland.png';
      fs.copyFileSync(auroraPath, path.join(OUT_DIR, winRel));
      mMain.sprites.biome_winter_highland = {
        file: winRel,
        w: 256,
        h: 256,
        anchorX: 0.5,
        anchorY: 0.5,
        tile: true,
        coverage: 1,
      };
      console.log(`✓ ${winRel.padEnd(36)} 256x256 (tile)`);
    }
  }

  mMain.generatedAt = new Date().toISOString();
  fs.writeFileSync(mainManifestPath, JSON.stringify(mMain, null, 2));
  if (contact.length > 0) {
    const contactPath = path.join(OUT_DIR, 'village', '_contact_tos_frontier.png');
    writeContactSheet(contact, contactPath);
    console.log(`Saved ${contact.length}-sprite contact sheet -> ${contactPath}`);
  }
}

main();
