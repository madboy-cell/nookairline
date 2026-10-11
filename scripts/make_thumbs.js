#!/usr/bin/env node
/**
 * Builds small costume thumbnails for the Vault card grids.
 *
 *   public/assets/<path>.png  ->  public/assets/thumbs/<path>.png  (300px tall, alpha kept)
 *
 * Full sprites are 300–800 KB each; the grid shows ~50 of them at ~100px wide,
 * so thumbnails cut the Wardrobe/Gacha payload by ~85%.
 * Only rebuilds thumbs whose source is newer. Uses macOS `sips` (no npm deps).
 *
 *   node scripts/make_thumbs.js
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const PUBLIC = path.join(__dirname, '..', 'public');
const ASSETS = path.join(PUBLIC, 'assets');
const OUT = path.join(ASSETS, 'thumbs');
const HEIGHT = 300;

// Every sprite referenced by avatar.js (classic outfits) + every season costume folder (s1, s2, ...).
const sources = new Set();
const avatarJs = fs.readFileSync(path.join(PUBLIC, 'avatar.js'), 'utf8');
for (const m of avatarJs.matchAll(/sprite:\s*'(assets\/[^']+\.png)'/g)) sources.add(m[1]);
for (const dir of fs.readdirSync(ASSETS)) {
  if (!/^s\d+$/.test(dir)) continue;
  for (const f of fs.readdirSync(path.join(ASSETS, dir))) {
    if (f.endsWith('.png')) sources.add(`assets/${dir}/${f}`);
  }
}

let built = 0;
let skipped = 0;
for (const rel of sources) {
  const src = path.join(PUBLIC, rel);
  if (!fs.existsSync(src)) { console.warn('missing', rel); continue; }
  const dst = path.join(OUT, path.relative(ASSETS, src));
  if (fs.existsSync(dst) && fs.statSync(dst).mtimeMs >= fs.statSync(src).mtimeMs) { skipped++; continue; }
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  execFileSync('sips', ['--resampleHeight', String(HEIGHT), src, '--out', dst], { stdio: 'ignore' });
  built++;
}
console.log(`thumbs: ${built} built, ${skipped} up to date -> ${path.relative(process.cwd(), OUT)}`);
