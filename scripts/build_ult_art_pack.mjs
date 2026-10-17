#!/usr/bin/env node
// scripts/build_ult_art_pack.mjs
// Composes the 13 Mythic Ultimate Spell Centerpiece sprites (mono_ult_*) + 3 missing Tile Modifier
// sprites (mono_trap_midas, mono_trap_chips, mono_trap_ruins) from our hand-painted Tree of Savior /
// MapleStory cutout layers into client/assets/monopoly/ and updates manifest_4a.json.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS = path.join(ROOT, 'client', 'assets');
const MONO_DIR = path.join(ASSETS, 'monopoly');
const MANIFEST_4A = path.join(MONO_DIR, 'manifest_4a.json');

const cache = new Map();
function loadPng(relPath) {
  if (cache.has(relPath)) return cache.get(relPath);
  const full = path.join(ASSETS, relPath);
  const png = PNG.sync.read(fs.readFileSync(full));
  cache.set(relPath, png);
  return png;
}

function createCanvas(w, h) {
  return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
}

/** Bilinear sample with optional tint [r,g,b], rotation, flipX, and alpha multiplier. */
function drawLayer(dst, srcRel, {
  cx = dst.width / 2,
  cy = dst.height / 2,
  scale = 1,
  rotDeg = 0,
  flipX = false,
  tint = [1, 1, 1],
  alpha = 1,
} = {}) {
  const src = typeof srcRel === 'string' ? loadPng(srcRel) : srcRel;
  const rad = (rotDeg * Math.PI) / 180;
  const cos = Math.cos(-rad), sin = Math.sin(-rad);
  const hw = (src.width * scale) / 2;
  const hh = (src.height * scale) / 2;
  const rMax = Math.ceil(Math.hypot(hw, hh)) + 2;
  const x0 = Math.max(0, Math.floor(cx - rMax));
  const x1 = Math.min(dst.width - 1, Math.ceil(cx + rMax));
  const y0 = Math.max(0, Math.floor(cy - rMax));
  const y1 = Math.min(dst.height - 1, Math.ceil(cy + rMax));

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx, dy = y - cy;
      let lx = (dx * cos - dy * sin) / scale;
      const ly = (dx * sin + dy * cos) / scale;
      if (flipX) lx = -lx;
      const sx = lx + src.width / 2;
      const sy = ly + src.height / 2;
      if (sx < 0 || sy < 0 || sx >= src.width - 1 || sy >= src.height - 1) continue;
      const ix = Math.floor(sx), iy = Math.floor(sy);
      const fx = sx - ix, fy = sy - iy;
      const i00 = (iy * src.width + ix) * 4;
      const i10 = i00 + 4;
      const i01 = i00 + src.width * 4;
      const i11 = i01 + 4;
      const b = (k) =>
        src.data[i00 + k] * (1 - fx) * (1 - fy) +
        src.data[i10 + k] * fx * (1 - fy) +
        src.data[i01 + k] * (1 - fx) * fy +
        src.data[i11 + k] * fx * fy;
      const sa = (b(3) / 255) * alpha;
      if (sa <= 0.005) continue;
      const sr = Math.min(255, b(0) * tint[0]);
      const sg = Math.min(255, b(1) * tint[1]);
      const sb = Math.min(255, b(2) * tint[2]);

      const di = (y * dst.width + x) * 4;
      const da = dst.data[di + 3] / 255;
      const outA = sa + da * (1 - sa);
      dst.data[di] = Math.round((sr * sa + dst.data[di] * da * (1 - sa)) / outA);
      dst.data[di + 1] = Math.round((sg * sa + dst.data[di + 1] * da * (1 - sa)) / outA);
      dst.data[di + 2] = Math.round((sb * sa + dst.data[di + 2] * da * (1 - sa)) / outA);
      dst.data[di + 3] = Math.round(outA * 255);
    }
  }
}

/** Trim transparent border with 8px padding and save to MONO_DIR. */
function trimAndSave(canvas, name, extraMeta = {}) {
  const { width, height, data } = canvas;
  let minX = width, minY = height, maxX = 0, maxY = 0, nonZero = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 12) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        nonZero++;
      }
    }
  }
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
  const file = path.join(MONO_DIR, `${name}.png`);
  fs.writeFileSync(file, PNG.sync.write(out));
  return {
    name,
    width: w,
    height: h,
    data: out.data,
    meta: {
      file: `monopoly/${name}.png`,
      w,
      h,
      anchorX: 0.5,
      anchorY: 0,
      coverage: +(nonZero / (w * h)).toFixed(3),
      ...extraMeta,
    },
  };
}

function buildSprites() {
  const W = 380, H = 400;
  const results = [];

  // 1. mono_ult_naga (S1 Naga Sovereign: Emerald-Turquoise Tidal Wave + Naga Sovereign Crest)
  {
    const c = createCanvas(W, H);
    drawLayer(c, 'ui/fx_magic_circle.png', { cx: 190, cy: 215, scale: 1.12, tint: [0.35, 1.08, 0.85], alpha: 0.92 });
    drawLayer(c, 'monopoly/mono_trap_waterway.png', { cx: 190, cy: 280, scale: 1.22, tint: [0.82, 1.10, 1.05] });
    drawLayer(c, 'ui/fx_shockwave.png', { cx: 190, cy: 195, scale: 1.10, rotDeg: 90, tint: [0.4, 1.12, 0.92] });
    drawLayer(c, 'ui/icon_skill_bubble_shield.png', { cx: 190, cy: 180, scale: 0.78, tint: [0.85, 1.12, 1.02] });
    drawLayer(c, 'ui/fx_bubble.png', { cx: 102, cy: 215, scale: 0.44 });
    drawLayer(c, 'ui/fx_bubble.png', { cx: 278, cy: 205, scale: 0.48 });
    drawLayer(c, 'ui/fx_star.png', { cx: 190, cy: 85, scale: 0.46 });
    results.push(trimAndSave(c, 'mono_ult_naga'));
  }

  // 2. mono_ult_kitsune (S2 Kitsune Inari: Vermilion Torii Shrine + Sakura Foxfire)
  {
    const c = createCanvas(W, H);
    drawLayer(c, 'ui/fx_magic_circle.png', { cx: 190, cy: 210, scale: 1.12, tint: [1.1, 0.78, 0.88], alpha: 0.92 });
    drawLayer(c, 'ui/fx_flame.png', { cx: 105, cy: 190, scale: 0.62, rotDeg: -22, tint: [1.1, 0.65, 0.85] });
    drawLayer(c, 'ui/fx_flame.png', { cx: 275, cy: 190, scale: 0.62, rotDeg: 22, flipX: true, tint: [1.1, 0.65, 0.85] });
    drawLayer(c, 'monopoly/mono_trap_torii.png', { cx: 190, cy: 215, scale: 1.02 });
    drawLayer(c, 'ui/icon_skill_foxfire.png', { cx: 190, cy: 105, scale: 0.48 });
    drawLayer(c, 'ui/fx_petal.png', { cx: 110, cy: 115, scale: 0.38, rotDeg: -30 });
    drawLayer(c, 'ui/fx_petal.png', { cx: 270, cy: 120, scale: 0.38, rotDeg: 35, flipX: true });
    results.push(trimAndSave(c, 'mono_ult_kitsune'));
  }

  // 3. mono_ult_eclipse (S2 Tsukuyomi Eclipse: Crimson-Violet Rune Halo + Golden Crescent Moon)
  {
    const c = createCanvas(W, H);
    drawLayer(c, 'ui/fx_rune.png', { cx: 190, cy: 210, scale: 1.18, tint: [0.95, 0.75, 1.15] });
    drawLayer(c, 'ui/fx_shockwave.png', { cx: 190, cy: 210, scale: 1.02, tint: [0.65, 0.5, 1.1] });
    drawLayer(c, 'ui/fx_moon.png', { cx: 190, cy: 190, scale: 0.98, tint: [1.08, 0.95, 1.05] });
    drawLayer(c, 'ui/fx_stardust.png', { cx: 120, cy: 120, scale: 0.52 });
    drawLayer(c, 'ui/fx_stardust.png', { cx: 265, cy: 265, scale: 0.52 });
    results.push(trimAndSave(c, 'mono_ult_eclipse'));
  }

  // 4. mono_ult_djinn (S3 Sultan Djinn: Winged Cosmic Portal + Golden Palace Crown & Crescent)
  {
    const c = createCanvas(W, H);
    drawLayer(c, 'ui/fx_magic_circle.png', { cx: 190, cy: 215, scale: 1.14, tint: [1.12, 0.92, 0.55] });
    drawLayer(c, 'village/mono_tile_portal.png', { cx: 190, cy: 255, scale: 0.96 });
    drawLayer(c, 'monopoly/mono_landmark_a.png', { cx: 190, cy: 175, scale: 0.72, tint: [1.12, 0.96, 0.78] });
    drawLayer(c, 'ui/fx_moon.png', { cx: 190, cy: 78, scale: 0.46, rotDeg: 15 });
    drawLayer(c, 'ui/fx_star.png', { cx: 105, cy: 155, scale: 0.44 });
    drawLayer(c, 'ui/fx_star.png', { cx: 275, cy: 155, scale: 0.44 });
    results.push(trimAndSave(c, 'mono_ult_djinn'));
  }

  // 5. mono_ult_phoenix (S3 Dune Phoenix: Outspread Golden Flame Wings + Blazing Solar Crest)
  {
    const c = createCanvas(W, H);
    drawLayer(c, 'ui/fx_magic_circle.png', { cx: 190, cy: 235, scale: 1.08, tint: [1.15, 0.72, 0.35] });
    drawLayer(c, 'monopoly/mono_trap_fire.png', { cx: 190, cy: 275, scale: 1.06 });
    drawLayer(c, 'ui/fx_feather.png', { cx: 112, cy: 185, scale: 0.88, rotDeg: -38, flipX: true, tint: [1.15, 0.82, 0.45] });
    drawLayer(c, 'ui/fx_feather.png', { cx: 268, cy: 185, scale: 0.88, rotDeg: 38, tint: [1.15, 0.82, 0.45] });
    drawLayer(c, 'ui/fx_flame.png', { cx: 190, cy: 175, scale: 0.96 });
    drawLayer(c, 'ui/fx_star.png', { cx: 190, cy: 95, scale: 0.48 });
    results.push(trimAndSave(c, 'mono_ult_phoenix'));
  }

  // 6. mono_ult_roulette (S4 Casino Royale: Golden Monte-Carlo Wheel Stage + Chips & Stars)
  {
    const c = createCanvas(W, H);
    drawLayer(c, 'ui/fx_magic_circle.png', { cx: 190, cy: 225, scale: 1.12, tint: [1.15, 0.95, 0.45] });
    drawLayer(c, 'village/mono_tile_festival.png', { cx: 190, cy: 225, scale: 0.96 });
    drawLayer(c, 'ui/fx_chip.png', { cx: 102, cy: 165, scale: 0.50, rotDeg: -18 });
    drawLayer(c, 'ui/fx_chip.png', { cx: 278, cy: 165, scale: 0.50, rotDeg: 18 });
    drawLayer(c, 'ui/fx_star.png', { cx: 190, cy: 95, scale: 0.50 });
    results.push(trimAndSave(c, 'mono_ult_roulette'));
  }

  // 7. mono_ult_siren (S5 Atlantis Siren: Abyssal Whirlpool + Coral Spire & Siren Notes)
  {
    const c = createCanvas(W, H);
    drawLayer(c, 'monopoly/mono_trap_waterway.png', { cx: 190, cy: 285, scale: 1.18, tint: [0.75, 1.05, 1.15] });
    drawLayer(c, 'ui/fx_shockwave.png', { cx: 190, cy: 215, scale: 1.06, tint: [0.45, 0.95, 1.1] });
    drawLayer(c, 'monopoly/mono_trap_coral.png', { cx: 190, cy: 205, scale: 0.96 });
    drawLayer(c, 'ui/fx_note.png', { cx: 108, cy: 135, scale: 0.46, rotDeg: -15 });
    drawLayer(c, 'ui/fx_note.png', { cx: 274, cy: 130, scale: 0.46, rotDeg: 15 });
    drawLayer(c, 'ui/fx_bubble.png', { cx: 190, cy: 95, scale: 0.42 });
    results.push(trimAndSave(c, 'mono_ult_siren'));
  }

  // 8. mono_ult_astral (S6 Astral Sovereign: Cosmic Black Hole Rune + Golden Armillary Tower)
  {
    const c = createCanvas(W, H);
    drawLayer(c, 'ui/fx_rune.png', { cx: 190, cy: 215, scale: 1.22, tint: [0.88, 0.68, 1.15] });
    drawLayer(c, 'ui/icon_skill_plasma_blast.png', { cx: 190, cy: 125, scale: 0.62, tint: [0.88, 0.68, 1.18] });
    drawLayer(c, 'monopoly/mono_landmark_b.png', { cx: 190, cy: 215, scale: 0.92 });
    drawLayer(c, 'ui/fx_stardust.png', { cx: 105, cy: 150, scale: 0.52 });
    drawLayer(c, 'ui/fx_stardust.png', { cx: 275, cy: 150, scale: 0.52 });
    results.push(trimAndSave(c, 'mono_ult_astral'));
  }

  // 9. mono_ult_clock (S7 Cinderella Midnight Clock: Astral Clock Dial + Glass Slipper Sanctuary)
  {
    const c = createCanvas(W, H);
    drawLayer(c, 'ui/fx_magic_circle.png', { cx: 190, cy: 195, scale: 1.16, tint: [0.78, 0.95, 1.15] });
    drawLayer(c, 'monopoly/mono_trap_slipper.png', { cx: 190, cy: 215, scale: 0.98 });
    drawLayer(c, 'ui/fx_snowflake.png', { cx: 105, cy: 130, scale: 0.42 });
    drawLayer(c, 'ui/fx_snowflake.png', { cx: 275, cy: 130, scale: 0.42 });
    drawLayer(c, 'ui/fx_star.png', { cx: 190, cy: 78, scale: 0.46 });
    results.push(trimAndSave(c, 'mono_ult_clock'));
  }

  // 10. mono_ult_glacial (S8 Glacial Empress: Winged Ice Palace Crystal + Giant Snowflake Nova)
  {
    const c = createCanvas(W, H);
    drawLayer(c, 'ui/fx_shockwave.png', { cx: 190, cy: 215, scale: 1.14, tint: [0.7, 0.95, 1.15] });
    drawLayer(c, 'ui/fx_snowflake.png', { cx: 190, cy: 145, scale: 0.92 });
    drawLayer(c, 'village/mono_landmark_lv4.png', { cx: 190, cy: 235, scale: 0.95 });
    drawLayer(c, 'ui/fx_snowflake.png', { cx: 102, cy: 185, scale: 0.42, rotDeg: -20 });
    drawLayer(c, 'ui/fx_snowflake.png', { cx: 278, cy: 185, scale: 0.42, rotDeg: 20 });
    results.push(trimAndSave(c, 'mono_ult_glacial'));
  }

  // 11. mono_ult_pharaoh (S9 Pharaoh & Sun God Ra: Winged Solar Halo + Golden Step Pyramid)
  {
    const c = createCanvas(W, H);
    drawLayer(c, 'ui/fx_magic_circle.png', { cx: 190, cy: 185, scale: 1.16, tint: [1.15, 0.95, 0.45] });
    drawLayer(c, 'ui/fx_feather.png', { cx: 102, cy: 165, scale: 0.82, rotDeg: -42, flipX: true, tint: [1.15, 0.92, 0.4] });
    drawLayer(c, 'ui/fx_feather.png', { cx: 278, cy: 165, scale: 0.82, rotDeg: 42, tint: [1.15, 0.92, 0.4] });
    drawLayer(c, 'monopoly/mono_pyramid_b.png', { cx: 190, cy: 235, scale: 0.98 });
    drawLayer(c, 'ui/fx_star.png', { cx: 190, cy: 82, scale: 0.52 });
    results.push(trimAndSave(c, 'mono_ult_pharaoh'));
  }

  // 12. mono_ult_phantom (S10 Phantom Masque: Crimson-Gold Opera Rune + Gilded Masquerade Mirror)
  {
    const c = createCanvas(W, H);
    drawLayer(c, 'ui/fx_rune.png', { cx: 190, cy: 215, scale: 1.14, tint: [1.15, 0.45, 0.62] });
    drawLayer(c, 'monopoly/mono_trap_mirror.png', { cx: 190, cy: 210, scale: 1.04 });
    drawLayer(c, 'ui/fx_note.png', { cx: 105, cy: 145, scale: 0.46, rotDeg: -16, tint: [1.15, 0.6, 0.75] });
    drawLayer(c, 'ui/fx_feather.png', { cx: 275, cy: 150, scale: 0.48, rotDeg: 24, tint: [1.15, 0.45, 0.55] });
    results.push(trimAndSave(c, 'mono_ult_phantom'));
  }

  // 13. mono_ult_zeus (S11 Zeus Olympus: Olympus Lightning Spire + Colossal Golden Thunderbolt)
  {
    const c = createCanvas(W, H);
    drawLayer(c, 'ui/fx_magic_circle.png', { cx: 190, cy: 225, scale: 1.12, tint: [1.15, 0.96, 0.45] });
    drawLayer(c, 'ui/fx_shockwave.png', { cx: 190, cy: 215, scale: 1.08, tint: [1.15, 0.95, 0.45] });
    drawLayer(c, 'monopoly/mono_trap_lightning_rod.png', { cx: 190, cy: 215, scale: 1.05 });
    drawLayer(c, 'ui/fx_lightning.png', { cx: 125, cy: 125, scale: 0.65, rotDeg: -15 });
    drawLayer(c, 'ui/fx_lightning.png', { cx: 255, cy: 125, scale: 0.65, rotDeg: 15, flipX: true });
    results.push(trimAndSave(c, 'mono_ult_zeus'));
  }

  // 14. mono_trap_midas (Midas 24k Gold Tile Modifier)
  {
    const c = createCanvas(W, H);
    drawLayer(c, 'ui/fx_magic_circle.png', { cx: 190, cy: 255, scale: 0.92, tint: [1.15, 0.95, 0.42] });
    drawLayer(c, 'ui/item_dupe_box.png', { cx: 190, cy: 225, scale: 0.78, tint: [1.12, 0.96, 0.68] });
    drawLayer(c, 'ui/icon_gold.png', { cx: 122, cy: 265, scale: 0.45 });
    drawLayer(c, 'ui/icon_gold.png', { cx: 258, cy: 265, scale: 0.45 });
    drawLayer(c, 'ui/fx_star.png', { cx: 190, cy: 118, scale: 0.46 });
    results.push(trimAndSave(c, 'mono_trap_midas'));
  }

  // 15. mono_trap_chips (Casino Royale 2x Rent Chip Stack Tile Modifier)
  {
    const c = createCanvas(W, H);
    drawLayer(c, 'ui/fx_chip.png', { cx: 145, cy: 255, scale: 0.62, rotDeg: -12 });
    drawLayer(c, 'ui/fx_chip.png', { cx: 235, cy: 255, scale: 0.62, rotDeg: 14, tint: [0.75, 0.95, 1.1] });
    drawLayer(c, 'ui/fx_chip.png', { cx: 190, cy: 210, scale: 0.72 });
    drawLayer(c, 'ui/fx_star.png', { cx: 190, cy: 125, scale: 0.45 });
    results.push(trimAndSave(c, 'mono_trap_chips'));
  }

  // 16. mono_trap_ruins (Atlantis Siren 0x Rent Flooded Ruins Tile Modifier)
  {
    const c = createCanvas(W, H);
    drawLayer(c, 'monopoly/mono_trap_waterway.png', { cx: 190, cy: 265, scale: 1.05, tint: [0.62, 0.85, 0.98] });
    drawLayer(c, 'monopoly/mono_trap_coral.png', { cx: 190, cy: 215, scale: 0.78, tint: [0.68, 0.82, 0.95] });
    drawLayer(c, 'ui/fx_bubble.png', { cx: 135, cy: 175, scale: 0.36 });
    drawLayer(c, 'ui/fx_bubble.png', { cx: 245, cy: 165, scale: 0.40 });
    results.push(trimAndSave(c, 'mono_trap_ruins'));
  }

  return results;
}

function writeContactSheet(entries, file) {
  const cell = 220, cols = 4, rows = Math.ceil(entries.length / cols);
  const W = cols * cell, H = rows * cell;
  const out = new PNG({ width: W, height: H });
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4, chk = ((x >> 4) + (y >> 4)) & 1;
      const v = chk ? 46 : 70;
      out.data[i] = v; out.data[i + 1] = v + 6; out.data[i + 2] = v + 14; out.data[i + 3] = 255;
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

const built = buildSprites();
const m4a = JSON.parse(fs.readFileSync(MANIFEST_4A, 'utf8'));
for (const item of built) {
  m4a.sprites[item.name] = item.meta;
}
m4a.generatedAt = new Date().toISOString();
fs.writeFileSync(MANIFEST_4A, JSON.stringify(m4a, null, 2) + '\n');
const contactPath = path.join(ROOT, 'qa_artifacts', 'ult_spells_contact.png');
writeContactSheet(built, contactPath);
console.log(`Built ${built.length} Ultimate & Trap sprites into client/assets/monopoly/ and updated manifest_4a.json`);
