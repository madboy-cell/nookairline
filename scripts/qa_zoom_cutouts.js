#!/usr/bin/env node
// scripts/qa_zoom_cutouts.js
// Renders chosen sprites LARGE on a dark checkerboard + a magenta "pale-pixel" overlay
// (opaque pixels that are nearly white) so leftover background pockets are obvious.
// Usage: node scripts/qa_zoom_cutouts.js village/wnd_ferris village/dec_swing ...
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const names = process.argv.slice(2);
const cell = 420, cols = Math.min(4, names.length), rows = Math.ceil(names.length / cols);
const W = cols * cell * 2, H = rows * cell;
const out = new PNG({ width: W, height: H });
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const i = (y * W + x) * 4, v = ((x >> 4) + (y >> 4)) & 1 ? 46 : 70;
  out.data[i] = v; out.data[i + 1] = v + 6; out.data[i + 2] = v + 14; out.data[i + 3] = 255;
}
names.forEach((n, idx) => {
  const s = PNG.sync.read(fs.readFileSync(path.join(ROOT, 'client/assets', `${n}.png`)));
  const scale = Math.min((cell - 10) / s.width, (cell - 10) / s.height);
  const dw = Math.round(s.width * scale), dh = Math.round(s.height * scale);
  let pale = 0, opaque = 0;
  for (let k = 0; k < s.width * s.height; k++) {
    const i = k * 4; if (s.data[i + 3] < 128) continue; opaque++;
    if (Math.min(s.data[i], s.data[i + 1], s.data[i + 2]) > 232) pale++;
  }
  for (let panel = 0; panel < 2; panel++) {
    const ox = (idx % cols) * cell * 2 + panel * cell + ((cell - dw) >> 1);
    const oy = Math.floor(idx / cols) * cell + ((cell - dh) >> 1);
    for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) {
      const si = (Math.floor(y / scale) * s.width + Math.floor(x / scale)) * 4;
      const a = s.data[si + 3] / 255; if (!a) continue;
      const o = ((oy + y) * W + ox + x) * 4;
      const isPale = panel === 1 && Math.min(s.data[si], s.data[si + 1], s.data[si + 2]) > 232;
      const c = isPale ? [255, 0, 255] : [s.data[si], s.data[si + 1], s.data[si + 2]];
      for (let k = 0; k < 3; k++) out.data[o + k] = out.data[o + k] * (1 - a) + c[k] * a;
    }
  }
  console.log(`${n.padEnd(30)} ${s.width}x${s.height} pale ${(100 * pale / opaque).toFixed(1)}%`);
});
const file = path.join(ROOT, 'qa_artifacts', 'zoom_cutouts.png');
fs.writeFileSync(file, PNG.sync.write(out));
console.log(file);
