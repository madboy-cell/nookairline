#!/usr/bin/env node
// scripts/process_art_assets.js
// Cuts AI-generated grid sheets (art_src/*.jpg|png on a flat white background) into
// transparent, trimmed PNG sprites + client/assets/asset_manifest.json.
//
// Pipeline per cell (Implementation Plan Section 20.B):
//   1. Exterior flood-fill from every border pixel that matches the background
//      (so white eyes / white lace INSIDE the ink outline stay opaque).
//   2. Optional removal of large enclosed background-coloured holes (gaps between
//      arm and torso, the inside of ring-shaped particles).
//   3. Drop tiny disconnected specks (JPEG noise, stray dots).
//   4. 1px anti-aliased edge: alpha from distance-to-background + un-mix the white.
//   5. Trim to the opaque bounding box (+2px pad) and record pivot anchors.
//
// Usage: node scripts/process_art_assets.js [--config scripts/art_sheets.json]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import jpeg from 'jpeg-js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'client', 'assets');
const TOLERANCE = 18;      // max per-channel distance from bg to count as background
const EDGE_RAMP = 48;      // distance over which edge pixels fade from 0 -> 1 alpha
const PAD = 2;

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

const dist = (px, i, bg) => Math.max(Math.abs(px[i] - bg[0]), Math.abs(px[i + 1] - bg[1]), Math.abs(px[i + 2] - bg[2]));

export function matteCell(px, w, h, opts = {}) {
  const bg = opts.bg || sampleBackground(px, w, h);
  const N = w * h;
  const isBg = new Uint8Array(N);          // 1 = transparent background
  const queue = new Int32Array(N);
  let head = 0, tail = 0;

  // 1. exterior flood fill seeded from all border pixels
  const seed = (x, y) => {
    const p = y * w + x;
    if (!isBg[p] && dist(px, p * 4, bg) <= TOLERANCE) { isBg[p] = 1; queue[tail++] = p; }
  };
  for (let x = 0; x < w; x++) { seed(x, 0); seed(x, h - 1); }
  for (let y = 0; y < h; y++) { seed(0, y); seed(w - 1, y); }
  while (head < tail) {
    const p = queue[head++];
    const x = p % w, y = (p / w) | 0;
    if (x > 0) seed(x - 1, y);
    if (x < w - 1) seed(x + 1, y);
    if (y > 0) seed(x, y - 1);
    if (y < h - 1) seed(x, y + 1);
  }

  // 2. enclosed background-coloured holes become transparent too — but ONLY if they are as
  //    flat/pure as the real background (true gaps between spokes, inside a swing frame).
  //    Painted whites (clouds, marble, a white dome) have gouache shading -> higher mean/
  //    spread of distance-from-bg -> kept opaque.
  //    JPEG ringing hugs the ink lines and inflates the stats of real pockets, so a region
  //    also passes if its ERODED CORE (pixels >= CORE_INSET px from the region edge) is
  //    near-perfect background.
  //    opts.glowHoles: enclosed pale regions that are NOT flat (a painted glow pool, e.g. the
  //    centre of the fairy mushroom ring) are colour-to-alpha'd into a soft translucent glow
  //    instead of staying an opaque white blob.
  const softAlpha = new Float32Array(N).fill(1);   // < 1 = translucent glow pixel
  const glowSeed = new Uint8Array(N);              // enclosed glow pools (opts.glow)
  const holeMin = opts.keepHoles ? Infinity : (opts.holeMinArea ?? Infinity);
  if (Number.isFinite(holeMin)) {
    const holeTol = opts.holeTolerance ?? TOLERANCE;
    const CORE_INSET = opts.coreInset ?? 2;
    const seen = new Uint8Array(N);
    const inRegion = new Uint8Array(N);
    const depth = new Uint8Array(N);
    const hist = new Uint32Array(holeTol + 1);
    const coreHist = new Uint32Array(holeTol + 1);
    for (let s = 0; s < N; s++) {
      if (isBg[s] || seen[s] || dist(px, s * 4, bg) > holeTol) continue;
      head = 0; tail = 0; queue[tail++] = s; seen[s] = 1;
      hist.fill(0);
      let sum = 0;
      while (head < tail) {
        const p = queue[head++];
        const d = Math.min(holeTol, dist(px, p * 4, bg));
        sum += d; hist[d]++;
        const x = p % w, y = (p / w) | 0;
        for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]) {
          if (q >= 0 && !seen[q] && !isBg[q] && dist(px, q * 4, bg) <= holeTol) { seen[q] = 1; queue[tail++] = q; }
        }
      }
      if (tail < holeMin) continue;
      let acc = 0, p95 = 0;
      for (let d = 0; d <= holeTol; d++) { acc += hist[d]; if (acc >= tail * 0.95) { p95 = d; break; } }
      let flat = sum / tail <= (opts.holeMaxMean ?? 4) && p95 <= (opts.holeMaxP95 ?? 10);

      // eroded-core statistics (iterative 4-neighbour erosion, CORE_INSET passes)
      const region = queue.slice(0, tail);
      for (const p of region) { inRegion[p] = 1; depth[p] = 0; }
      for (let pass = 1; pass <= CORE_INSET; pass++) {
        for (const p of region) {
          if (depth[p] !== pass - 1) continue;
          const x = p % w, y = (p / w) | 0;
          const ok = x > 0 && x < w - 1 && y > 0 && y < h - 1 &&
            inRegion[p - 1] && inRegion[p + 1] && inRegion[p - w] && inRegion[p + w] &&
            depth[p - 1] >= pass - 1 && depth[p + 1] >= pass - 1 && depth[p - w] >= pass - 1 && depth[p + w] >= pass - 1;
          if (ok) depth[p] = pass;
        }
      }
      coreHist.fill(0);
      let coreN = 0, coreSum = 0;
      for (const p of region) if (depth[p] >= CORE_INSET) { const d = Math.min(holeTol, dist(px, p * 4, bg)); coreHist[d]++; coreSum += d; coreN++; }
      let coreP95 = 0;
      if (coreN) { acc = 0; for (let d = 0; d <= holeTol; d++) { acc += coreHist[d]; if (acc >= coreN * 0.95) { coreP95 = d; break; } } }
      const coreMean = coreN ? coreSum / coreN : 99;
      const coreFlat = coreN >= tail * 0.20 && coreMean <= (opts.coreMaxMean ?? 2.5) && coreP95 <= (opts.coreMaxP95 ?? 6);

      // ink-wall check: a real pocket is walled in by the dark ink outline; a painted
      // specular highlight (egg shine, glass glint) fades into light paint instead.
      let wallN = 0, wallInk = 0;
      for (const p of region) {
        const x = p % w, y = (p / w) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h || inRegion[ny * w + nx]) continue;
          let mx = 0;
          for (let k = 1; k <= 4; k++) {
            const sx = x + dx * k, sy = y + dy * k;
            if (sx < 0 || sy < 0 || sx >= w || sy >= h) break;
            mx = Math.max(mx, dist(px, (sy * w + sx) * 4, bg));
          }
          wallN++; if (mx >= 110) wallInk++;
        }
      }
      const inkWalled = wallN > 0 && wallInk / wallN >= (opts.holeMinInkWall ?? 0.6);
      for (const p of region) inRegion[p] = 0;

      if ((flat || coreFlat) && inkWalled) {
        for (const p of region) isBg[p] = 1;
        if (opts.debugHoles) console.log(`    removed pocket: ${tail}px mean ${(sum / tail).toFixed(1)} p95 ${p95} core ${coreMean.toFixed(1)}/${coreP95}`);
      } else if (opts.glow && opts.glow.pools) {
        for (const p of region) glowSeed[p] = 1;
        if (opts.debugHoles) console.log(`    glow pool -> soft alpha: ${tail}px mean ${(sum / tail).toFixed(1)}`);
      } else if (opts.debugHoles) console.log(`    kept painted white region: ${tail}px mean ${(sum / tail).toFixed(1)} p95 ${p95} core ${coreMean.toFixed(1)}/${coreP95}`);
    }
  }

  // 2b. opts.glow = { t, band }: painted glows (lamp halo, pet-egg aura, mushroom-ring pool)
  //     fade from the object colour into the white paper with no ink line, so the hard matte
  //     leaves an opaque cream halo. Flood from the background (and enclosed glow pools) into
  //     pale pixels (dist <= t) up to `band` px deep and colour-to-alpha them: alpha = dist/t,
  //     colour un-mixed from white. Ink lines (dist >> t) stop the flood, so the object body
  //     stays fully opaque.
  if (opts.glow) {
    const T = opts.glow.t ?? 72, BAND = opts.glow.band ?? 40;
    const gd = new Int16Array(N).fill(-1);
    head = 0; tail = 0;
    for (let p = 0; p < N; p++) if (isBg[p] || glowSeed[p]) { gd[p] = 0; queue[tail++] = p; }
    while (head < tail) {
      const p = queue[head++];
      if (gd[p] >= BAND) continue;
      const x = p % w, y = (p / w) | 0;
      for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]) {
        if (q < 0 || gd[q] !== -1 || isBg[q]) continue;
        const d = dist(px, q * 4, bg);
        if (d > T) continue;
        gd[q] = gd[p] + 1; queue[tail++] = q;
        softAlpha[q] = Math.min(softAlpha[q], d / T);
      }
    }
    for (let p = 0; p < N; p++) if (glowSeed[p]) softAlpha[p] = Math.min(softAlpha[p], dist(px, p * 4, bg) / T);
  }

  // 3. label islands (8-connected). Keep only islands whose centroid lies inside keepRect
  //    (the true cell when we crop with an overlap margin), then drop tiny specks
  //    relative to the largest kept island.
  const label = new Int32Array(N).fill(-1);
  const sizes = [], cx = [], cy = [];
  for (let s = 0; s < N; s++) {
    if (isBg[s] || label[s] !== -1) continue;
    const id = sizes.length;
    let sx = 0, sy = 0;
    head = 0; tail = 0; queue[tail++] = s; label[s] = id;
    while (head < tail) {
      const p = queue[head++];
      const x = p % w, y = (p / w) | 0;
      sx += x; sy += y;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const q = ny * w + nx;
        if (!isBg[q] && label[q] === -1) { label[q] = id; queue[tail++] = q; }
      }
    }
    sizes.push(tail); cx.push(sx / tail); cy.push(sy / tail);
  }
  const kr = opts.keepRect || [0, 0, w, h];
  const inCell = sizes.map((_, id) => cx[id] >= kr[0] && cx[id] < kr[2] && cy[id] >= kr[1] && cy[id] < kr[3]);
  const largest = sizes.reduce((m, s, id) => (inCell[id] && s > m ? s : m), 0);
  const minIsland = Math.max(6, largest * (opts.minIslandRatio ?? 0.01));
  for (let p = 0; p < N; p++) if (!isBg[p] && (!inCell[label[p]] || sizes[label[p]] < minIsland)) isBg[p] = 1;

  // 4. build RGBA with soft, white-unmixed edges (2px band: JPEG ringing beside the ink
  //    is often 2px wide) + translucent glow pixels from step 2b.
  const out = new Uint8ClampedArray(N * 4);
  let minX = w, minY = h, maxX = -1, maxY = -1;
  const bgAt = (x, y) => x >= 0 && y >= 0 && x < w && y < h && isBg[y * w + x];
  for (let p = 0; p < N; p++) {
    if (isBg[p]) continue;
    const x = p % w, y = (p / w) | 0;
    const i = p * 4;
    const near1 = bgAt(x - 1, y) || bgAt(x + 1, y) || bgAt(x, y - 1) || bgAt(x, y + 1);
    const near2 = !near1 && (bgAt(x - 2, y) || bgAt(x + 2, y) || bgAt(x, y - 2) || bgAt(x, y + 2) ||
      bgAt(x - 1, y - 1) || bgAt(x + 1, y - 1) || bgAt(x - 1, y + 1) || bgAt(x + 1, y + 1));
    let a = softAlpha[p];
    if (near1) a = Math.min(a, Math.max(0.08, dist(px, i, bg) / EDGE_RAMP));
    else if (near2) a = Math.min(a, Math.max(0.3, dist(px, i, bg) / EDGE_RAMP));
    a = Math.min(1, a);
    if (a < 0.02) continue;
    for (let c = 0; c < 3; c++) out[i + c] = a < 1 ? (px[i + c] - bg[c] * (1 - a)) / a : px[i + c];
    out[i + 3] = Math.round(a * 255);
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  if (maxX < 0) return null;

  minX = Math.max(0, minX - PAD); minY = Math.max(0, minY - PAD);
  maxX = Math.min(w - 1, maxX + PAD); maxY = Math.min(h - 1, maxY + PAD);
  let tw = maxX - minX + 1, th = maxY - minY + 1;
  let trimmed = new Uint8ClampedArray(tw * th * 4);
  for (let y = 0; y < th; y++) {
    const src = ((minY + y) * w + minX) * 4;
    trimmed.set(out.subarray(src, src + tw * 4), y * tw * 4);
  }

  // Optional horizontal flip (e.g. boots drawn facing left normalized to face right)
  if (opts.flipX) {
    const flipped = new Uint8ClampedArray(tw * th * 4);
    for (let y = 0; y < th; y++) {
      for (let x = 0; x < tw; x++) {
        const si = (y * tw + (tw - 1 - x)) * 4;
        const di = (y * tw + x) * 4;
        flipped[di] = trimmed[si];
        flipped[di + 1] = trimmed[si + 1];
        flipped[di + 2] = trimmed[si + 2];
        flipped[di + 3] = trimmed[si + 3];
      }
    }
    trimmed = flipped;
  }

  // Optional boot-cuff opening trim: removes the hollow interior oval and back rim of 3/4 boot icons
  // so the front cuff collar sits cleanly over the character's shin as a worn boot.
  if (opts.closeBootCuff) {
    const { seedX = 0.4, seedY = 22, tol = 28, ink = [64, 38, 22] } = opts.closeBootCuff;
    const sx = Math.round(tw * seedX), sy = Math.min(th - 1, seedY);
    const si = (sy * tw + sx) * 4;
    const sr = trimmed[si], sg = trimmed[si + 1], sb = trimmed[si + 2];
    const vis = new Uint8Array(tw * th);
    const q = [sy * tw + sx];
    vis[sy * tw + sx] = 1;
    let cMinX = sx, cMaxX = sx, cMaxY = sy;
    const yLimit = Math.round(th * 0.165);
    while (q.length) {
      const p = q.pop();
      const x = p % tw, y = (p / tw) | 0;
      if (x < cMinX) cMinX = x; if (x > cMaxX) cMaxX = x;
      if (y > cMaxY) cMaxY = y;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= tw || ny >= yLimit) continue;
        const np = ny * tw + nx;
        if (vis[np]) continue;
        const ni = np * 4;
        if (trimmed[ni + 3] < 80) continue;
        const d = Math.max(Math.abs(trimmed[ni] - sr), Math.abs(trimmed[ni + 1] - sg), Math.abs(trimmed[ni + 2] - sb));
        if (d <= tol) { vis[np] = 1; q.push(np); }
      }
    }
    const rawCut = new Float32Array(tw).fill(-1);
    for (let x = cMinX; x <= cMaxX; x++) {
      let yb = -1;
      for (let y = 0; y <= cMaxY + 2; y++) if (vis[y * tw + x]) yb = y;
      rawCut[x] = yb;
    }
    const yLeft = rawCut[cMinX], yRight = rawCut[cMaxX];
    for (let x = 0; x < cMinX; x++) rawCut[x] = Math.max(0, yLeft - (cMinX - x) * 0.35);
    for (let x = cMaxX + 1; x < tw; x++) rawCut[x] = Math.max(0, yRight - (x - cMaxX) * 0.35);
    // Smooth the cut line with a 5-tap moving average for a silky anti-aliased cuff curve
    const smoothCut = new Float32Array(tw);
    for (let x = 0; x < tw; x++) {
      let sum = 0, cnt = 0;
      for (let dx = -2; dx <= 2; dx++) {
        const nx = Math.max(0, Math.min(tw - 1, x + dx));
        sum += rawCut[nx]; cnt++;
      }
      smoothCut[x] = sum / cnt;
    }
    for (let x = 0; x < tw; x++) {
      const yc = smoothCut[x];
      if (yc < 0) continue;
      const yFloor = Math.floor(yc);
      for (let y = 0; y <= yFloor; y++) trimmed[(y * tw + x) * 4 + 3] = 0;
      // Anti-alias the fractional cut pixel
      if (yFloor + 1 < th) {
        const frac = yc - yFloor;
        const ai = ((yFloor + 1) * tw + x) * 4;
        trimmed[ai + 3] = Math.round(trimmed[ai + 3] * (1 - frac * 0.85));
      }
      for (let dy = 1; dy <= 3; dy++) {
        const y = yFloor + dy;
        if (y >= th) continue;
        const i = (y * tw + x) * 4;
        if (trimmed[i + 3] > 60) {
          const t = dy === 1 ? 0.92 : dy === 2 ? 0.78 : 0.40;
          trimmed[i]     = Math.round(ink[0] * t + trimmed[i]     * (1 - t));
          trimmed[i + 1] = Math.round(ink[1] * t + trimmed[i + 1] * (1 - t));
          trimmed[i + 2] = Math.round(ink[2] * t + trimmed[i + 2] * (1 - t));
        }
      }
    }
  }

  // Optional rotation in degrees (e.g. diagonal glove sprites straightened to match arm angle)
  if (opts.rotateDeg) {
    const rad = (opts.rotateDeg * Math.PI) / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);
    const rw = Math.ceil(Math.abs(tw * cos) + Math.abs(th * sin)) + 4;
    const rh = Math.ceil(Math.abs(tw * sin) + Math.abs(th * cos)) + 4;
    const rotBuf = new Uint8ClampedArray(rw * rh * 4);
    const cx0 = (tw - 1) / 2, cy0 = (th - 1) / 2;
    const cx1 = (rw - 1) / 2, cy1 = (rh - 1) / 2;
    let rMinX = rw, rMinY = rh, rMaxX = -1, rMaxY = -1;
    for (let y = 0; y < rh; y++) {
      for (let x = 0; x < rw; x++) {
        const dx = x - cx1, dy = y - cy1;
        const sx = cos * dx + sin * dy + cx0;
        const sy = -sin * dx + cos * dy + cy0;
        if (sx < 0 || sy < 0 || sx >= tw - 1 || sy >= th - 1) continue;
        const x0 = Math.floor(sx), y0 = Math.floor(sy);
        const tx = sx - x0, ty = sy - y0;
        const i00 = (y0 * tw + x0) * 4, i10 = i00 + 4, i01 = i00 + tw * 4, i11 = i01 + 4;
        const a00 = trimmed[i00 + 3], a10 = trimmed[i10 + 3], a01 = trimmed[i01 + 3], a11 = trimmed[i11 + 3];
        const a = (a00 * (1 - tx) + a10 * tx) * (1 - ty) + (a01 * (1 - tx) + a11 * tx) * ty;
        if (a < 5) continue;
        const di = (y * rw + x) * 4;
        for (let c = 0; c < 3; c++) {
          const v00 = trimmed[i00 + c] * a00, v10 = trimmed[i10 + c] * a10;
          const v01 = trimmed[i01 + c] * a01, v11 = trimmed[i11 + c] * a11;
          const v = (v00 * (1 - tx) + v10 * tx) * (1 - ty) + (v01 * (1 - tx) + v11 * tx) * ty;
          rotBuf[di + c] = Math.round(v / a);
        }
        rotBuf[di + 3] = Math.round(a);
        if (x < rMinX) rMinX = x; if (x > rMaxX) rMaxX = x;
        if (y < rMinY) rMinY = y; if (y > rMaxY) rMaxY = y;
      }
    }
    if (rMaxX >= 0) {
      rMinX = Math.max(0, rMinX - PAD); rMinY = Math.max(0, rMinY - PAD);
      rMaxX = Math.min(rw - 1, rMaxX + PAD); rMaxY = Math.min(rh - 1, rMaxY + PAD);
      tw = rMaxX - rMinX + 1; th = rMaxY - rMinY + 1;
      trimmed = new Uint8ClampedArray(tw * th * 4);
      for (let y = 0; y < th; y++) {
        const src = ((rMinY + y) * rw + rMinX) * 4;
        trimmed.set(rotBuf.subarray(src, src + tw * 4), y * tw * 4);
      }
    }
  }

  // Optional horizontal spine-centering for full-body chibi sprites so asymmetric tails/capes
  // never shift the character's head/body centerline off x = width / 2.
  if (opts.centerSpine) {
    let sumMid = 0, nMid = 0;
    for (let uvY = 0.70; uvY <= 0.82; uvY += 0.01) {
      const y = Math.round((1 - uvY) * (th - 1));
      let rowMin = tw, rowMax = -1;
      for (let x = 0; x < tw; x++) {
        if (trimmed[(y * tw + x) * 4 + 3] > 80) {
          if (x < rowMin) rowMin = x;
          if (x > rowMax) rowMax = x;
        }
      }
      if (rowMax > rowMin) { sumMid += (rowMin + rowMax) / 2; nMid++; }
    }
    if (nMid > 0) {
      const skullX = Math.round(sumMid / nMid);
      const half = Math.max(skullX, tw - 1 - skullX);
      const nw = half * 2 + 1;
      if (nw > tw) {
        const padLeft = half - skullX;
        const centered = new Uint8ClampedArray(nw * th * 4);
        for (let y = 0; y < th; y++) {
          centered.set(trimmed.subarray(y * tw * 4, (y + 1) * tw * 4), (y * nw + padLeft) * 4);
        }
        trimmed = centered;
        tw = nw;
      }
    }
  }

  const opaque = trimmed.reduce((n, v, k) => (k % 4 === 3 && v > 0 ? n + 1 : n), 0);
  return { data: trimmed, width: tw, height: th, bbox: [minX, minY, maxX - minX + 1, maxY - minY + 1], coverage: opaque / (tw * th) };
}

// Packs equally sized cells into one square atlas (cellSize per tile, centered, aspect kept).
function buildAtlas(sprites, cols, cellSize) {
  const rows = Math.ceil(sprites.length / cols);
  const W = cols * cellSize, H = rows * cellSize;
  const out = new Uint8ClampedArray(W * H * 4);
  sprites.forEach((s, idx) => {
    const scale = Math.min((cellSize - 8) / s.width, (cellSize - 8) / s.height);
    const dw = Math.max(1, Math.round(s.width * scale)), dh = Math.max(1, Math.round(s.height * scale));
    const ox = (idx % cols) * cellSize + ((cellSize - dw) >> 1);
    const oy = Math.floor(idx / cols) * cellSize + ((cellSize - dh) >> 1);
    for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) {
      // box-filter downsample keeps edges smooth
      const sx0 = Math.floor(x / scale), sx1 = Math.max(sx0 + 1, Math.floor((x + 1) / scale));
      const sy0 = Math.floor(y / scale), sy1 = Math.max(sy0 + 1, Math.floor((y + 1) / scale));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let yy = sy0; yy < Math.min(sy1, s.height); yy++) for (let xx = sx0; xx < Math.min(sx1, s.width); xx++) {
        const i = (yy * s.width + xx) * 4, al = s.data[i + 3];
        r += s.data[i] * al; g += s.data[i + 1] * al; b += s.data[i + 2] * al; a += al; n++;
      }
      const o = ((oy + y) * W + ox + x) * 4;
      if (a > 0) { out[o] = r / a; out[o + 1] = g / a; out[o + 2] = b / a; out[o + 3] = a / n; }
    }
  });
  return { data: out, width: W, height: H, cols, rows };
}

// Bilinear resample (RGBA, opaque) for swatches.
function resample(src, sw, sh, dw, dh) {
  const out = new Uint8ClampedArray(dw * dh * 4);
  for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) {
    const fx = ((x + 0.5) * sw) / dw - 0.5, fy = ((y + 0.5) * sh) / dh - 0.5;
    const x0 = Math.max(0, Math.floor(fx)), y0 = Math.max(0, Math.floor(fy));
    const x1 = Math.min(sw - 1, x0 + 1), y1 = Math.min(sh - 1, y0 + 1);
    const tx = Math.min(1, Math.max(0, fx - x0)), ty = Math.min(1, Math.max(0, fy - y0));
    for (let k = 0; k < 4; k++) {
      const a = src[(y0 * sw + x0) * 4 + k], b = src[(y0 * sw + x1) * 4 + k];
      const c = src[(y1 * sw + x0) * 4 + k], d = src[(y1 * sw + x1) * 4 + k];
      out[(y * dw + x) * 4 + k] = (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
    }
  }
  return out;
}

// Ground swatch -> seamless tile: crop the painted square inside the cell (inset to avoid
// edge artefacts), then blend with its half-offset copy near the borders. The offset copy is
// continuous across the wrap, the original covers the offset copy's seam in the middle.
function makeSeamlessSwatch(img, cx0, cy0, cw, ch, bg, size) {
  let minX = cw, minY = ch, maxX = -1, maxY = -1;
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const i = ((cy0 + y) * img.width + cx0 + x) * 4;
    if (dist(img.data, i, bg) > TOLERANCE * 2) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  }
  if (maxX < 0) return null;
  const side = Math.min(maxX - minX, maxY - minY);
  const inset = Math.round(side * 0.04);
  const n = side - inset * 2;
  const sx0 = cx0 + minX + inset + Math.floor((maxX - minX - side) / 2), sy0 = cy0 + minY + inset + Math.floor((maxY - minY - side) / 2);
  const T = new Uint8ClampedArray(n * n * 4);
  for (let y = 0; y < n; y++) T.set(img.data.subarray(((sy0 + y) * img.width + sx0) * 4, ((sy0 + y) * img.width + sx0 + n) * 4), y * n * 4);
  const R = new Uint8ClampedArray(n * n * 4);
  const band = 0.22;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const e = Math.min(x, y, n - 1 - x, n - 1 - y) / n;            // 0 at the border
    const m = Math.max(0, Math.min(1, 1 - e / band));             // 1 = use shifted copy
    const k = m * m * (3 - 2 * m);
    const i = (y * n + x) * 4, j = (((y + (n >> 1)) % n) * n + ((x + (n >> 1)) % n)) * 4;
    for (let c = 0; c < 3; c++) R[i + c] = T[i + c] * (1 - k) + T[j + c] * k;
    R[i + 3] = 255;
  }
  return { data: resample(R, n, n, size, size), width: size, height: size };
}

// Every sprite on a dark checkerboard: makes halos / white fringes / holes obvious.
function writeContactSheet(entries) {
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
  const file = path.join(ROOT, 'qa_artifacts', 'cutouts_contact_sheet.png');
  writePng(file, W, H, out);
  return file;
}

function main() {
  const cfgArg = process.argv.indexOf('--config');
  const cfgPath = path.resolve(ROOT, cfgArg > 0 ? process.argv[cfgArg + 1] : 'scripts/art_sheets.json');
  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  const manifest = { generatedAt: new Date().toISOString(), sprites: {}, atlases: {} };
  const contact = [];
  let ok = 0, warn = 0;
  // Every matted sprite so far, across ALL sheets: lets `headFrom` / `autoHead` borrow a donor head from an
  // earlier sheet (e.g. the lineage's base mannequin in sheet_1a / sheet_1c).
  const allSprites = new Map();

  for (const sheet of cfg.sheets) {
    const src = path.join(ROOT, sheet.src);
    if (!fs.existsSync(src)) {
      const msg = `missing sheet ${sheet.src}`;
      if (sheet.optional) { console.warn(`  ! ${msg} (optional, runtime fallback will be used)`); warn++; continue; }
      throw new Error(msg);
    }
    const img = readImage(src);
    const sheetBg = sheet.bg || sampleBackground(img.data, img.width, img.height);
    const cw = Math.floor(img.width / sheet.cols), ch = Math.floor(img.height / sheet.rows);
    console.log(`• ${sheet.src} ${img.width}x${img.height} -> ${sheet.rows}x${sheet.cols} cells of ${cw}x${ch}`);

    if (sheet.type === 'swatch') {
      sheet.cells.forEach((cell, idx) => {
        const r = Math.floor(idx / sheet.cols), c = idx % sheet.cols;
        const res = makeSeamlessSwatch(img, c * cw, r * ch, cw, ch, sheetBg, sheet.size || 512);
        if (!res) { console.warn(`  ! ${cell.name}: empty swatch`); warn++; return; }
        const rel = `${sheet.pack}/${cell.name}.png`;
        writePng(path.join(OUT_DIR, rel), res.width, res.height, res.data);
        manifest.sprites[cell.name] = { file: rel, w: res.width, h: res.height, type: 'swatch', tile: true };
        contact.push({ name: cell.name, ...res });
        console.log(`  ✓ ${rel.padEnd(34)} ${res.width}x${res.height} seamless`);
        ok++;
      });
      continue;
    }

    const atlasSprites = [];
    sheet.cells.forEach((cell, idx) => {
      const r = Math.floor(idx / sheet.cols), c = idx % sheet.cols;
      // crop with an overlap margin so art that spills past the nominal grid line survives
      const mx = Math.floor(cw * 0.25), my = Math.floor(ch * 0.25);
      const wx0 = Math.max(0, c * cw - mx), wy0 = Math.max(0, r * ch - my);
      const wx1 = Math.min(img.width, (c + 1) * cw + mx), wy1 = Math.min(img.height, (r + 1) * ch + my);
      const ww = wx1 - wx0, wh = wy1 - wy0;
      const px = cropCell(img, wx0, wy0, ww, wh);
      const keepRect = [c * cw - wx0, r * ch - wy0, (c + 1) * cw - wx0, (r + 1) * ch - wy0];
      const centerSpine = cell.anchorY === 0 && sheet.pack === 'chibi' && !cell.name.endsWith('_lifted');
      const res = matteCell(px, ww, wh, { centerSpine, ...sheet, ...(cell.opts || {}), bg: sheetBg, keepRect });
      if (!res) { console.warn(`  ! ${cell.name}: empty cell`); warn++; return; }
      if (cell.flipX) {
        for (let y = 0; y < res.height; y++) {
          for (let dx = 0; dx < Math.floor(res.width / 2); dx++) {
            const i1 = (y * res.width + dx) * 4, i2 = (y * res.width + (res.width - 1 - dx)) * 4;
            for (let chIdx = 0; chIdx < 4; chIdx++) { const t = res.data[i1 + chIdx]; res.data[i1 + chIdx] = res.data[i2 + chIdx]; res.data[i2 + chIdx] = t; }
          }
        }
      }
      const touches = res.bbox[0] === 0 || res.bbox[1] === 0 || res.bbox[0] + res.bbox[2] >= ww || res.bbox[1] + res.bbox[3] >= wh;
      if (touches) { console.warn(`  ! ${cell.name}: sprite touches its cell border (may be clipped)`); warn++; }
      // `autoHead: "<donorOutfitId>"` on a chibi sheet: every costume cell `<lineage>_<outfitId>_<view>` gets the
      // donor costume's head (`<lineage>_<donorOutfitId>_<view>`, from this or an EARLIER sheet) unless the cell sets
      // its own `headFrom` or declares `headgear: true` (built-in headdress / mask is kept as drawn).
      // NOTE: do not use the base mannequin as donor — its blue hood capelet sits on the neck cut line.
      const viewMatch = /^(\w+?)_.+_(front|back|side)$/.exec(cell.name);
      const headFrom = cell.headFrom
        || (typeof sheet.autoHead === 'string' && centerSpine && !cell.headgear && viewMatch
          ? `${viewMatch[1]}_${sheet.autoHead}_${viewMatch[2]}` : null);
      if (headFrom) {
        const donor = atlasSprites.find((s) => s.name === headFrom) || allSprites.get(headFrom);
        if (!donor) { console.warn(`  ! ${cell.name}: head donor ${headFrom} not found (sheet order?)`); warn++; }
        if (donor) {
          const cutY0 = Math.round((cell.headCutY0 ?? 0.28) * res.height);
          const cutY1 = Math.round((cell.headCutY1 ?? 0.32) * res.height);
          const cxDst = Math.floor(res.width / 2), cxSrc = Math.floor(donor.width / 2);
          for (let y = 0; y < cutY1; y++) {
            const sy = Math.min(donor.height - 1, Math.round((y * donor.height) / res.height));
            const t = y <= cutY0 ? 1 : 1 - (y - cutY0) / Math.max(1, cutY1 - cutY0);
            for (let x = 0; x < res.width; x++) {
              const sx = x - cxDst + cxSrc;
              const di = (y * res.width + x) * 4;
              const si = sx >= 0 && sx < donor.width ? (sy * donor.width + sx) * 4 : -1;
              for (let chIdx = 0; chIdx < 4; chIdx++) {
                const sv = si >= 0 ? donor.data[si + chIdx] : 0;
                res.data[di + chIdx] = Math.round(sv * t + res.data[di + chIdx] * (1 - t));
              }
            }
          }
        }
      }
      let hem = cell.hem;
      if (!hem && centerSpine) {
        const midX = Math.floor(res.width / 2);
        let opq = 0, tot = 0;
        for (let uvY = 0.08; uvY <= 0.14; uvY += 0.01) {
          const y = Math.round((1 - uvY) * (res.height - 1));
          for (let dx = -4; dx <= 4; dx++) {
            const x = Math.max(0, Math.min(res.width - 1, midX + dx));
            tot++;
            if (res.data[(y * res.width + x) * 4 + 3] > 120) opq++;
          }
        }
        hem = opq > tot * 0.5 ? 'long' : 'short';
      }
      const rel = `${sheet.pack}/${cell.name}.png`;
      writePng(path.join(OUT_DIR, rel), res.width, res.height, res.data);
      const spriteMeta = {
        file: rel, w: res.width, h: res.height,
        anchorX: 0.5, anchorY: cell.anchorY ?? 0.5,
        ...(cell.faces ? { faces: cell.faces } : {}),
        ...(hem ? { hem } : {}),
        ...(cell.meta || {}),
        coverage: +res.coverage.toFixed(3),
      };
      manifest.sprites[cell.name] = spriteMeta;
      if (sheet.pack === 'chibi') {
        let aliasName = null;
        if (cell.name.startsWith('boy_')) aliasName = `bkk_${cell.name.slice(4)}`;
        else if (cell.name.startsWith('girl_')) aliasName = `dxb_${cell.name.slice(5)}`;
        else if (cell.name.startsWith('bkk_') && !/^bkk_base_(front|back|side)$/.test(cell.name)) aliasName = `boy_${cell.name.slice(4)}`;
        else if (cell.name.startsWith('dxb_') && !/^dxb_base_(front|back|side)$/.test(cell.name)) aliasName = `girl_${cell.name.slice(4)}`;
        if (aliasName) {
          const aliasRel = `${sheet.pack}/${aliasName}.png`;
          writePng(path.join(OUT_DIR, aliasRel), res.width, res.height, res.data);
          manifest.sprites[aliasName] = { ...spriteMeta, file: aliasRel };
          allSprites.set(aliasName, { name: aliasName, ...res });
        }
      }
      atlasSprites.push({ name: cell.name, ...res });
      allSprites.set(cell.name, { name: cell.name, ...res });
      contact.push({ name: cell.name, ...res });
      console.log(`  ✓ ${rel.padEnd(34)} ${String(res.width).padStart(4)}x${String(res.height).padEnd(4)} coverage ${(res.coverage * 100).toFixed(1)}%${hem ? ` [${hem}]` : ''}`);
      ok++;
    });
    if (sheet.atlas && atlasSprites.length) {
      const atlas = buildAtlas(atlasSprites, sheet.cols, sheet.atlas.cellSize);
      const rel = `${sheet.pack}/${sheet.atlas.name}.png`;
      writePng(path.join(OUT_DIR, rel), atlas.width, atlas.height, atlas.data);
      manifest.atlases[sheet.atlas.name] = { file: rel, cols: atlas.cols, rows: atlas.rows, cells: atlasSprites.map((s) => s.name) };
      console.log(`  ✓ atlas ${rel} ${atlas.width}x${atlas.height}`);
    }
  }
  const terrainAliases = {
    tile_grass_meadow_a: 'ground_classic',
    tile_grass_meadow_b: 'ground_vanilla',
    tile_grass_sunlit_c: 'ground_sakura',
    decal_grass_blossom_c: 'decal_grass_daisies_b',
    decal_water_ripples: 'decal_water_lily_white',
  };
  for (const [alias, srcId] of Object.entries(terrainAliases)) {
    const srcMeta = manifest.sprites[srcId];
    if (srcMeta && !manifest.sprites[alias]) {
      const folder = srcMeta.file.split('/')[0];
      const dstRel = `${folder}/${alias}.png`;
      fs.copyFileSync(path.join(OUT_DIR, srcMeta.file), path.join(OUT_DIR, dstRel));
      manifest.sprites[alias] = { ...srcMeta, file: dstRel };
    }
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'asset_manifest.json'), JSON.stringify(manifest, null, 2));
  makeAppIcons();
  const sheetFile = writeContactSheet(contact);
  console.log(`\nDone: ${ok} sprites, ${warn} warnings -> client/assets/asset_manifest.json`);
  console.log(`Cutout review sheet: ${path.relative(ROOT, sheetFile)}`);
}

// PWA / apple-touch icons: cream tile, gold ring, chibi head-and-shoulders crop.
function makeAppIcons() {
  const src = path.join(OUT_DIR, 'chibi', 'bkk_base_front.png');
  if (!fs.existsSync(src)) return;
  const s = PNG.sync.read(fs.readFileSync(src));
  for (const size of [192, 512]) {
    const out = new Uint8ClampedArray(size * size * 4);
    const c = size / 2;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4, d = Math.hypot(x - c, y - c) / c;
      const ring = d > 0.86 && d < 0.94;
      const t = y / size;
      out[i] = ring ? 224 : 255 - t * 20; out[i + 1] = ring ? 167 : 240 - t * 40; out[i + 2] = ring ? 42 : 210 - t * 70; out[i + 3] = 255;
    }
    const crop = Math.round(s.width * 1.05);            // square crop from the top (head + shoulders)
    const scale = (size * 0.84) / crop;
    const ox = (size - s.width * scale) / 2, oy = size * 0.1;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const sx = Math.floor((x - ox) / scale), sy = Math.floor((y - oy) / scale);
      if (sx < 0 || sy < 0 || sx >= s.width || sy >= Math.min(s.height, crop)) continue;
      const si = (sy * s.width + sx) * 4, a = s.data[si + 3] / 255;
      if (!a || Math.hypot(x - c, y - c) / c > 0.86) continue;
      const i = (y * size + x) * 4;
      for (let k = 0; k < 3; k++) out[i + k] = out[i + k] * (1 - a) + s.data[si + k] * a;
    }
    writePng(path.join(OUT_DIR, 'ui', `app_icon_${size}.png`), size, size, out);
  }
  console.log('  ✓ ui/app_icon_192.png, ui/app_icon_512.png');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main();
