// client/js/assets.js — asset_manifest.json lookup + texture cache with a procedural
// Canvas2D fallback so a missing/404 sprite never breaks the scene (Section 20.B.4).
import * as THREE from 'three';

let manifest = { sprites: {}, atlases: {} };
const cache = new Map();
let maxAniso = 1;

export async function loadManifest(renderer) {
  maxAniso = renderer?.capabilities.getMaxAnisotropy?.() || 1;
  try {
    const res = await fetch('/assets/asset_manifest.json', { cache: 'no-cache' });
    if (res.ok) manifest = await res.json();
  } catch { /* offline: fallbacks will be used */ }
  return manifest;
}

export const spriteInfo = (name) => manifest.sprites[name] || null;
export const atlasInfo = (name) => manifest.atlases[name] || null;

function fallbackCanvas(name) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 384;
  const g = c.getContext('2d');
  const hue = [...name].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 360, 7);
  g.lineWidth = 8; g.strokeStyle = '#3a2415';
  g.fillStyle = `hsl(${hue} 55% 70%)`;
  g.beginPath(); g.roundRect(70, 170, 116, 150, 30); g.fill(); g.stroke();     // body
  g.fillStyle = '#ffe2c6';
  g.beginPath(); g.arc(128, 110, 80, 0, Math.PI * 2); g.fill(); g.stroke();     // head
  if (!/back/.test(name)) { g.fillStyle = '#3a2415'; g.beginPath(); g.arc(100, 115, 9, 0, 7); g.arc(156, 115, 9, 0, 7); g.fill(); }
  g.fillStyle = '#6b3f1f'; g.fillRect(84, 320, 30, 50); g.fillRect(142, 320, 30, 50);
  return c;
}

/** Resolves to { texture, w, h, anchorY, fallback } — never rejects. */
export function loadSprite(name) {
  if (cache.has(name)) return cache.get(name);
  const info = spriteInfo(name);
  const p = new Promise((resolve) => {
    const useFallback = () => {
      const canvas = fallbackCanvas(name);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      resolve({ texture, w: canvas.width, h: canvas.height, anchorY: 0, fallback: true });
    };
    if (!info) { useFallback(); return; }
    const ver = manifest.generatedAt ? `?v=${encodeURIComponent(manifest.generatedAt)}` : '';
    new THREE.TextureLoader().load(`/assets/${info.file}${ver}`, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = maxAniso;
      if (info.tile) { texture.wrapS = texture.wrapT = THREE.RepeatWrapping; }
      texture.generateMipmaps = true;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      resolve({ texture, w: info.w, h: info.h, anchorY: info.anchorY ?? 0.5, faces: info.faces || 'right', hem: info.hem || 'short', fallback: false });
    }, undefined, useFallback);
  });
  cache.set(name, p);
  return p;
}
