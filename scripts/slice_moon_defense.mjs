#!/usr/bin/env node
// scripts/slice_moon_defense.mjs — Slices Sheet A (sheet_moon_defense_v2.jpg) & Sheet B (sheet_moon_defense_poses_b.jpg)
// into client/assets/monopoly/mb_*.png and registers all 18 sprites in manifest_4a.json + asset_manifest.json.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import jpeg from 'jpeg-js';
import { matteCell } from './process_art_assets.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'client', 'assets');
const PACK_DIR = path.join(OUT_DIR, 'monopoly');

const SHEETS = [
  {
    src: 'art_src/sheet_moon_defense_v2.jpg',
    cells: [
      { name: 'mb_moon_bunny_idle',  anchorY: 0.08 },
      { name: 'mb_moon_bunny_pound', anchorY: 0.08 },
      { name: 'mb_green_slime',      anchorY: 0.08 },
      { name: 'mb_ribbon_pig',       anchorY: 0.08 },
      { name: 'mb_berry_slime',      anchorY: 0.08, minIslandRatio: 0.05, cropBottomPad: 18 },
      { name: 'mb_gold_pinata_pig',  anchorY: 0.08 },
      { name: 'mb_armored_boar',     anchorY: 0.08 },
      { name: 'mb_king_mochi_boss',  anchorY: 0.08, padTop: 18 },
      { name: 'mb_primrose_seed',    anchorY: 0.08, tolerance: 52 },
    ],
  },
  {
    src: 'art_src/sheet_moon_defense_poses_b.jpg',
    cells: [
      { name: 'mb_green_slime_hop',      anchorY: 0.08 },
      { name: 'mb_ribbon_pig_run',       anchorY: 0.08 },
      { name: 'mb_berry_slime_hop',      anchorY: 0.08 },
      { name: 'mb_gold_pinata_pig_run',  anchorY: 0.08 },
      { name: 'mb_armored_boar_charge',  anchorY: 0.08 },
      { name: 'mb_king_mochi_boss_slam', anchorY: 0.08 },
      { name: 'mb_star_mochi_cake',      anchorY: 0.08, tolerance: 42 },
      { name: 'mb_bounty_bell',          anchorY: 0.08 },
      { name: 'mb_shrine_shield_orb',    anchorY: 0.5,  tolerance: 48 },
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

function writeContactSheet(entries, file) {
  const cell = 220, cols = 6, rows = Math.ceil(entries.length / cols);
  const W = cols * cell, H = rows * cell;
  const out = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4, chk = ((x >> 4) + (y >> 4)) & 1;
    const v = chk ? 44 : 68;
    out[i] = v; out[i + 1] = v + 6; out[i + 2] = v + 16; out[i + 3] = 255;
  }
  entries.forEach((s, idx) => {
    const scale = Math.min((cell - 18) / s.width, (cell - 18) / s.height);
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
  const manifest4aPath = path.join(PACK_DIR, 'manifest_4a.json');
  const mainManifestPath = path.join(OUT_DIR, 'asset_manifest.json');
  const m4a = JSON.parse(fs.readFileSync(manifest4aPath, 'utf8'));
  const mMain = JSON.parse(fs.readFileSync(mainManifestPath, 'utf8'));

  const contact = [];
  for (const sheet of SHEETS) {
    const srcPath = path.join(ROOT, sheet.src);
    if (!fs.existsSync(srcPath)) continue;
    const img = readImage(srcPath);
    const cols = 3, rows = 3;
    const cw = Math.floor(img.width / cols), ch = Math.floor(img.height / rows);

    sheet.cells.forEach((cell, idx) => {
      const r = Math.floor(idx / cols), c = idx % cols;
      const x0 = c * cw;
      const y0 = Math.max(0, r * ch - (cell.padTop || 0));
      const cellH = ch + (cell.padTop || 0) - (cell.cropBottomPad || 0);
      const px = cropCell(img, x0, y0, cw, cellH);
      const res = matteCell(px, cw, cellH, {
        bg: [255, 255, 255],
        tolerance: cell.tolerance || 24,
        holeMinArea: 300,
        minIslandRatio: cell.minIslandRatio || 0.002,
        keepRect: [0, 0, cw, cellH],
      });
      if (!res) throw new Error(`Empty cell for ${cell.name}`);
      const rel = `monopoly/${cell.name}.png`;
      writePng(path.join(OUT_DIR, rel), res.width, res.height, res.data);
      const entry = {
        file: rel,
        w: res.width,
        h: res.height,
        anchorX: 0.5,
        anchorY: cell.anchorY,
        coverage: +res.coverage.toFixed(3),
      };
      m4a.sprites[cell.name] = entry;
      mMain.sprites[cell.name] = entry;
      contact.push({ name: cell.name, ...res });
      console.log(`✓ ${rel.padEnd(36)} ${res.width}x${res.height}`);
    });
  }

  m4a.generatedAt = new Date().toISOString();
  fs.writeFileSync(manifest4aPath, JSON.stringify(m4a, null, 2));
  fs.writeFileSync(mainManifestPath, JSON.stringify(mMain, null, 2));
  const contactPath = path.join(PACK_DIR, '_contact_moon_defense.png');
  writeContactSheet(contact, contactPath);
  console.log(`Saved 18-sprite contact sheet -> ${contactPath}`);
}

main();
