#!/usr/bin/env node
// scripts/slice_pack_4a.js
// Standalone slicer for the Sky Monopoly art pack (sheet_4a_*). Mirrors the crop logic of
// scripts/process_art_assets.js main() (25% overlap margin, keepRect, sheet-level bg,
// touches-border warning, flipX) and reuses its exported matteCell(), but writes ONLY to
// client/assets/monopoly/ + client/assets/monopoly/manifest_4a.json — it never touches the
// shared client/assets/asset_manifest.json.
//
// Usage: node scripts/slice_pack_4a.js [--config scripts/art_sheets_4a.json]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import jpeg from 'jpeg-js';
import { matteCell } from './process_art_assets.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'client', 'assets');
const PACK_DIR = path.join(OUT_DIR, 'monopoly');

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

// Median of the 4 corner patches -> background colour (robust to JPEG noise).
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

// Every sprite on a dark checkerboard: makes halos / white fringes / holes obvious.
function writeContactSheet(entries, file) {
  const cell = 220, cols = 8, rows = Math.ceil(entries.length / cols);
  const W = cols * cell, H = rows * cell;
  const out = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4, chk = ((x >> 4) + (y >> 4)) & 1;
    const v = chk ? 46 : 70;
    out[i] = v; out[i + 1] = v + 6; out[i + 2] = v + 14; out[i + 3] = 255;
  }
  entries.forEach((s, idx) => {
    const scale = Math.min((cell - 12) / s.width, (cell - 12) / s.height);
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
  const cfgArg = process.argv.indexOf('--config');
  const cfgPath = path.resolve(ROOT, cfgArg > 0 ? process.argv[cfgArg + 1] : 'scripts/art_sheets_4a.json');
  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  // MERGE with the existing manifest: other scripts (e.g. build_ult_art_pack.mjs) register sprites here too,
  // and overwriting it used to silently delete every Mythic ult monument.
  const manifestPath = path.join(PACK_DIR, 'manifest_4a.json');
  let prevSprites = {};
  try { prevSprites = JSON.parse(fs.readFileSync(manifestPath, 'utf8')).sprites || {}; } catch { /* first run */ }
  const manifest = { generatedAt: new Date().toISOString(), sprites: { ...prevSprites } };
  const contact = [];
  let ok = 0, warn = 0;

  for (const sheet of cfg.sheets) {
    const src = path.join(ROOT, sheet.src);
    if (!fs.existsSync(src)) {
      const msg = `missing sheet ${sheet.src}`;
      if (sheet.optional) { console.warn(`  ! ${msg} (optional)`); warn++; continue; }
      throw new Error(msg);
    }
    const img = readImage(src);
    const sheetBg = sheet.bg || sampleBackground(img.data, img.width, img.height);
    const cw = Math.floor(img.width / sheet.cols), ch = Math.floor(img.height / sheet.rows);
    console.log(`• ${sheet.src} ${img.width}x${img.height} -> ${sheet.rows}x${sheet.cols} cells of ${cw}x${ch}`);

    sheet.cells.forEach((cell, idx) => {
      const r = Math.floor(idx / sheet.cols), c = idx % sheet.cols;
      // crop with an overlap margin so art that spills past the nominal grid line survives
      const mx = Math.floor(cw * 0.25), my = Math.floor(ch * 0.25);
      const wx0 = Math.max(0, c * cw - mx), wy0 = Math.max(0, r * ch - my);
      const wx1 = Math.min(img.width, (c + 1) * cw + mx), wy1 = Math.min(img.height, (r + 1) * ch + my);
      const ww = wx1 - wx0, wh = wy1 - wy0;
      const px = cropCell(img, wx0, wy0, ww, wh);
      const keepRect = [c * cw - wx0, r * ch - wy0, (c + 1) * cw - wx0, (r + 1) * ch - wy0];
      const { cells, src: _s, pack: _p, ...sheetOpts } = sheet;
      const res = matteCell(px, ww, wh, { ...sheetOpts, ...(cell.opts || {}), bg: sheetBg, keepRect });
      if (!res) { console.warn(`  ! ${cell.name}: empty cell`); warn++; return; }
      if (cell.flipX) {
        for (let y = 0; y < res.height; y++) {
          for (let dx = 0; dx < Math.floor(res.width / 2); dx++) {
            const i1 = (y * res.width + dx) * 4, i2 = (y * res.width + (res.width - 1 - dx)) * 4;
            for (let k = 0; k < 4; k++) { const t = res.data[i1 + k]; res.data[i1 + k] = res.data[i2 + k]; res.data[i2 + k] = t; }
          }
        }
      }
      const touches = res.bbox[0] === 0 || res.bbox[1] === 0 || res.bbox[0] + res.bbox[2] >= ww || res.bbox[1] + res.bbox[3] >= wh;
      if (touches) { console.warn(`  ! ${cell.name}: sprite touches its cell border (may be clipped)`); warn++; }
      const rel = `${sheet.pack}/${cell.name}.png`;
      writePng(path.join(OUT_DIR, rel), res.width, res.height, res.data);
      manifest.sprites[cell.name] = {
        file: rel, w: res.width, h: res.height,
        anchorX: 0.5, anchorY: cell.anchorY ?? 0.5,
        ...(cell.faces ? { faces: cell.faces } : {}),
        ...(cell.meta || {}),
        coverage: +res.coverage.toFixed(3),
      };
      contact.push({ name: cell.name, ...res });
      console.log(`  ✓ ${rel.padEnd(36)} ${String(res.width).padStart(4)}x${String(res.height).padEnd(4)} coverage ${(res.coverage * 100).toFixed(1)}%`);
      ok++;
    });
  }

  fs.mkdirSync(PACK_DIR, { recursive: true });
  fs.writeFileSync(path.join(PACK_DIR, 'manifest_4a.json'), JSON.stringify(manifest, null, 2));
  const contactFile = path.join(PACK_DIR, '_contact_4a.png');
  writeContactSheet(contact, contactFile);
  console.log(`\nDone: ${ok} sprites, ${warn} warnings -> ${path.relative(ROOT, path.join(PACK_DIR, 'manifest_4a.json'))}`);
  console.log(`Contact sheet: ${path.relative(ROOT, contactFile)}`);
}

main();
