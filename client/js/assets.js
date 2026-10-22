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

export const PROCEDURAL_SPRITES = {
  bld_farm_plot: { w: 256, h: 256, anchorY: 0.25 },
  bld_workshop: { w: 256, h: 288, anchorY: 0.2 },
  bld_cottage: { w: 256, h: 288, anchorY: 0.2 },
  bld_castle_ruins: { w: 320, h: 320, anchorY: 0.15 },
  road_farmland: { w: 256, h: 256, tile: true },
  road_dirt: { w: 256, h: 256, tile: true },
  road_flagstone: { w: 256, h: 256, tile: true },
  road_boardwalk: { w: 256, h: 256, tile: true },
  road_wildflower: { w: 256, h: 256, tile: true },
  biome_autumn_orchard: { w: 256, h: 256, tile: true },
  biome_mossy_woods: { w: 256, h: 256, tile: true },
  biome_winter_highland: { w: 256, h: 256, tile: true },
  biome_rose_garden: { w: 256, h: 256, tile: true },
};

export const spriteInfo = (name) => manifest.sprites[name] || PROCEDURAL_SPRITES[name] || null;
export const atlasInfo = (name) => manifest.atlases[name] || null;

function makeCanvas(w, h, anchorY = 0) {
  if (typeof document !== 'undefined' && document.createElement) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.anchorY = anchorY;
    return c;
  }
  return { width: w, height: h, anchorY, getContext: () => null };
}

function roundRect(g, x, y, w, h, r = 4) {
  if (typeof g.roundRect === 'function') {
    g.roundRect(x, y, w, h, r);
    return;
  }
  const rad = Array.isArray(r) ? r : [r, r, r, r];
  const r0 = rad[0] || 0, r1 = rad[1] || r0, r2 = rad[2] || r0, r3 = rad[3] || r1;
  g.beginPath();
  g.moveTo(x + r0, y);
  g.lineTo(x + w - r1, y);
  g.quadraticCurveTo(x + w, y, x + w, y + r1);
  g.lineTo(x + w, y + h - r2);
  g.quadraticCurveTo(x + w, y + h, x + w - r2, y + h);
  g.lineTo(x + r3, y + h);
  g.quadraticCurveTo(x, y + h, x, y + h - r3);
  g.lineTo(x, y + r0);
  g.quadraticCurveTo(x, y, x + r0, y);
  g.closePath();
}

function drawFarmPlotCanvas() {
  const c = makeCanvas(256, 256, 0.25);
  const g = c.getContext('2d');
  if (!g) return c;

  g.fillStyle = 'rgba(42, 28, 16, 0.35)';
  g.beginPath(); g.ellipse(128, 205, 105, 26, 0, 0, Math.PI * 2); g.fill();

  g.fillStyle = '#543822';
  g.fillRect(32, 105, 192, 25);

  g.fillStyle = '#4A3525';
  g.fillRect(36, 118, 184, 52);

  for (const fy of [126, 138, 150, 162]) {
    g.fillStyle = '#382619';
    g.fillRect(38, fy + 2, 180, 5);
    g.fillStyle = '#5E4430';
    g.fillRect(38, fy, 180, 3);
  }
  g.fillStyle = '#6A4C34';
  for (let i = 0; i < 20; i++) {
    g.fillRect(45 + (i * 29) % 165, 122 + (i * 17) % 45, 3, 2);
  }

  // Golden wheat tufts (back row)
  g.strokeStyle = '#3A2415';
  g.lineWidth = 1.8;
  for (const wx of [95, 120, 145, 170, 195]) {
    g.beginPath();
    g.moveTo(wx, 140);
    g.quadraticCurveTo(wx + 4, 115, wx + 6, 85);
    g.strokeStyle = '#B8881A';
    g.stroke();
    for (let k = 0; k < 5; k++) {
      const ky = 90 + k * 8;
      const kx = wx + 5 + (k % 2 === 0 ? -4 : 4);
      g.fillStyle = '#E8B838';
      g.beginPath();
      g.ellipse(kx, ky, 3.5, 5.5, (k % 2 === 0 ? -0.4 : 0.4), 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#3A2415';
      g.stroke();
      g.fillStyle = '#F5D264';
      g.beginPath();
      g.ellipse(kx, ky - 1, 1.8, 3, (k % 2 === 0 ? -0.4 : 0.4), 0, Math.PI * 2);
      g.fill();
    }
  }

  // Lush green sprouts (front row)
  for (const sx of [75, 105, 135, 160]) {
    const sy = 158;
    g.strokeStyle = '#3B8032';
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(sx, sy);
    g.lineTo(sx, sy - 18);
    g.stroke();
    g.fillStyle = '#58B84B';
    g.strokeStyle = '#3A2415';
    g.lineWidth = 1.5;
    g.beginPath();
    g.ellipse(sx - 7, sy - 20, 7, 4, -0.4, 0, Math.PI * 2);
    g.fill(); g.stroke();
    g.fillStyle = '#7CD464';
    g.beginPath();
    g.ellipse(sx - 7, sy - 21, 4, 2, -0.4, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#58B84B';
    g.beginPath();
    g.ellipse(sx + 7, sy - 21, 7, 4, 0.4, 0, Math.PI * 2);
    g.fill(); g.stroke();
    g.fillStyle = '#7CD464';
    g.beginPath();
    g.ellipse(sx + 7, sy - 22, 4, 2, 0.4, 0, Math.PI * 2);
    g.fill();
  }

  // Front timber frame
  g.lineWidth = 3; g.strokeStyle = '#3A2415';
  g.fillStyle = '#6B4E35';
  roundRect(g, 28, 158, 200, 38, 4);
  g.fill(); g.stroke();

  g.fillStyle = '#8B6542';
  g.fillRect(29, 159, 198, 8);

  g.strokeStyle = '#543924'; g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(35, 175); g.lineTo(120, 175);
  g.moveTo(135, 173); g.lineTo(220, 173);
  g.stroke();

  // Upright corner posts
  g.lineWidth = 3; g.strokeStyle = '#3A2415';
  g.fillStyle = '#8B6542';
  roundRect(g, 24, 110, 18, 88, 3);
  g.fill(); g.stroke();
  g.fillStyle = '#6B4E35';
  roundRect(g, 214, 110, 18, 88, 3);
  g.fill(); g.stroke();

  // Iron brackets
  g.fillStyle = '#4A4540';
  g.fillRect(24, 155, 18, 8);
  g.fillRect(214, 155, 18, 8);
  g.fillStyle = '#D4AF37';
  g.beginPath();
  g.arc(33, 159, 2, 0, Math.PI * 2);
  g.arc(223, 159, 2, 0, Math.PI * 2);
  g.fill();

  // Crop signpost
  g.fillStyle = '#6B4E35';
  g.strokeStyle = '#3A2415';
  g.lineWidth = 2;
  g.fillRect(44, 138, 7, 60);
  g.strokeRect(44, 138, 7, 60);

  g.fillStyle = '#E8D4B5';
  roundRect(g, 26, 120, 42, 28, 4);
  g.fill(); g.stroke();
  g.strokeStyle = '#8B6542';
  g.strokeRect(29, 123, 36, 22);

  g.fillStyle = '#388E3C';
  g.beginPath();
  g.ellipse(44, 132, 4, 6, -0.4, 0, Math.PI * 2);
  g.ellipse(50, 132, 4, 6, 0.4, 0, Math.PI * 2);
  g.fill();
  g.fillRect(46, 134, 2.5, 6);

  return c;
}

function drawWorkshopCanvas() {
  const c = makeCanvas(256, 288, 0.2);
  const g = c.getContext('2d');
  if (!g) return c;

  g.fillStyle = 'rgba(35, 25, 20, 0.35)';
  g.beginPath(); g.ellipse(128, 260, 115, 24, 0, 0, Math.PI * 2); g.fill();

  // Stone foundation
  g.fillStyle = '#78736B';
  g.strokeStyle = '#3A2415';
  g.lineWidth = 2.5;
  roundRect(g, 36, 205, 144, 45, 4);
  g.fill(); g.stroke();
  g.fillStyle = '#5E5952';
  for (let i = 0; i < 6; i++) {
    g.fillRect(44 + i * 22, 212 + (i % 2) * 16, 18, 12);
  }

  // Cream plaster walls
  g.fillStyle = '#E9DCC0';
  g.fillRect(42, 110, 134, 98);
  g.fillStyle = 'rgba(180, 160, 130, 0.25)';
  g.fillRect(42, 170, 134, 38);

  // Timber framing
  g.fillStyle = '#5A3E28';
  g.strokeStyle = '#3A2415';
  g.lineWidth = 2.5;
  g.fillRect(42, 110, 12, 98); g.strokeRect(42, 110, 12, 98);
  g.fillRect(164, 110, 12, 98); g.strokeRect(164, 110, 12, 98);
  g.fillRect(100, 110, 10, 98); g.strokeRect(100, 110, 10, 98);
  g.fillRect(42, 110, 134, 10); g.strokeRect(42, 110, 134, 10);
  g.fillRect(42, 156, 134, 9); g.strokeRect(42, 156, 134, 9);
  g.fillRect(42, 202, 134, 10); g.strokeRect(42, 202, 134, 10);
  g.beginPath();
  g.moveTo(54, 120); g.lineTo(100, 156);
  g.moveTo(110, 156); g.lineTo(164, 120);
  g.strokeStyle = '#5A3E28'; g.lineWidth = 6; g.stroke();
  g.strokeStyle = '#3A2415'; g.lineWidth = 1.5; g.stroke();

  // Workshop door
  g.fillStyle = '#7D5535';
  g.strokeStyle = '#3A2415';
  g.lineWidth = 2.5;
  roundRect(g, 58, 150, 36, 56, [14, 14, 0, 0]);
  g.fill(); g.stroke();
  g.strokeStyle = '#5A3E28'; g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(70, 154); g.lineTo(70, 206); g.moveTo(82, 154); g.lineTo(82, 206); g.stroke();
  g.fillStyle = '#2B2520';
  g.fillRect(57, 164, 10, 4); g.fillRect(57, 192, 10, 4);
  g.beginPath(); g.arc(86, 180, 3.5, 0, Math.PI * 2); g.stroke();

  // Glowing workshop window
  g.fillStyle = '#5A3E28';
  g.fillRect(116, 124, 38, 30);
  g.strokeStyle = '#3A2415'; g.lineWidth = 2;
  g.strokeRect(116, 124, 38, 30);
  if (typeof g.createRadialGradient === 'function') {
    const wGrad = g.createRadialGradient(135, 139, 2, 135, 139, 18);
    wGrad.addColorStop(0, '#FFF9C4');
    wGrad.addColorStop(0.6, '#FFE29A');
    wGrad.addColorStop(1, '#FFB300');
    g.fillStyle = wGrad;
  } else {
    g.fillStyle = '#FFE29A';
  }
  g.fillRect(119, 127, 32, 24);
  g.strokeStyle = '#3A2415'; g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(135, 127); g.lineTo(135, 151);
  g.moveTo(119, 139); g.lineTo(151, 139);
  g.stroke();

  // Mossy slate roof
  g.fillStyle = '#4A5D6E';
  g.strokeStyle = '#3A2415';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(24, 115);
  g.lineTo(107, 44);
  g.lineTo(190, 115);
  g.closePath();
  g.fill(); g.stroke();

  for (let r = 0; r < 5; r++) {
    const ry = 58 + r * 11;
    const rx1 = 107 - r * 14;
    const rx2 = 107 + r * 14;
    g.strokeStyle = '#34424E'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(rx1, ry); g.lineTo(rx2, ry); g.stroke();
  }

  g.fillStyle = '#5B7B48';
  g.beginPath();
  g.ellipse(65, 102, 18, 8, -0.3, 0, Math.PI * 2);
  g.ellipse(145, 98, 22, 9, 0.3, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#749C5B';
  g.beginPath();
  g.ellipse(64, 100, 10, 4, -0.3, 0, Math.PI * 2);
  g.ellipse(146, 96, 12, 5, 0.3, 0, Math.PI * 2);
  g.fill();

  // Forge hearth on right
  g.fillStyle = '#6B6660';
  g.strokeStyle = '#3A2415';
  g.lineWidth = 2.5;
  roundRect(g, 174, 115, 62, 135, 4);
  g.fill(); g.stroke();
  g.fillStyle = '#4F4C47';
  g.fillRect(182, 100, 46, 16); g.strokeRect(182, 100, 46, 16);

  g.fillStyle = '#221810';
  roundRect(g, 184, 178, 42, 52, [21, 21, 0, 0]);
  g.fill(); g.stroke();

  if (typeof g.createRadialGradient === 'function') {
    const fGrad = g.createRadialGradient(205, 205, 4, 205, 205, 24);
    fGrad.addColorStop(0, '#FFF9C4');
    fGrad.addColorStop(0.35, '#FFE066');
    fGrad.addColorStop(0.7, '#F59E36');
    fGrad.addColorStop(1, '#D84315');
    g.fillStyle = fGrad;
  } else {
    g.fillStyle = '#F59E36';
  }
  roundRect(g, 188, 184, 34, 44, [17, 17, 0, 0]);
  g.fill();

  g.fillStyle = 'rgba(30, 20, 15, 0.5)';
  g.beginPath(); g.ellipse(205, 172, 16, 8, 0, 0, Math.PI * 2); g.fill();

  g.fillStyle = 'rgba(215, 215, 225, 0.45)';
  g.beginPath();
  g.arc(205, 85, 10, 0, Math.PI * 2);
  g.arc(215, 68, 14, 0, Math.PI * 2);
  g.arc(210, 48, 18, 0, Math.PI * 2);
  g.fill();

  // Iron anvil on stump
  g.fillStyle = '#6B4E35';
  g.strokeStyle = '#3A2415';
  g.lineWidth = 2;
  roundRect(g, 46, 224, 32, 28, 3);
  g.fill(); g.stroke();
  g.fillStyle = '#9C7752';
  g.beginPath(); g.ellipse(62, 224, 15, 5, 0, 0, Math.PI * 2); g.fill(); g.stroke();

  g.fillStyle = '#3D444E';
  g.beginPath();
  g.moveTo(42, 218); g.lineTo(52, 218); g.lineTo(54, 222); g.lineTo(70, 222);
  g.lineTo(72, 218); g.lineTo(82, 218); g.lineTo(84, 212); g.lineTo(44, 212);
  g.closePath();
  g.fill(); g.stroke();
  g.fillStyle = '#7A8594';
  g.fillRect(48, 212, 30, 3);

  // Tool rack
  g.fillStyle = '#6B4E35';
  g.fillRect(110, 180, 46, 6);
  g.strokeRect(110, 180, 46, 6);
  g.strokeStyle = '#8B6542'; g.lineWidth = 2.5;
  g.beginPath(); g.moveTo(122, 184); g.lineTo(122, 204); g.stroke();
  g.fillStyle = '#4A5568';
  g.fillRect(117, 185, 10, 6);
  g.strokeRect(117, 185, 10, 6);

  return c;
}

function drawCottageCanvas() {
  const c = makeCanvas(256, 288, 0.2);
  const g = c.getContext('2d');
  if (!g) return c;

  g.fillStyle = 'rgba(35, 25, 20, 0.35)';
  g.beginPath(); g.ellipse(128, 260, 110, 22, 0, 0, Math.PI * 2); g.fill();

  // Stone foundation
  g.fillStyle = '#8A857D';
  g.strokeStyle = '#3A2415';
  g.lineWidth = 2.5;
  roundRect(g, 38, 208, 150, 42, 4);
  g.fill(); g.stroke();
  g.fillStyle = '#6E6962';
  for (let i = 0; i < 6; i++) {
    g.fillRect(48 + i * 22, 214 + (i % 2) * 14, 18, 11);
  }

  // Cream plaster walls
  g.fillStyle = '#F4EBD9';
  g.fillRect(44, 112, 138, 98);
  g.fillStyle = 'rgba(215, 195, 165, 0.3)';
  g.fillRect(44, 175, 138, 35);

  // Timber framing
  g.fillStyle = '#5A3E28';
  g.strokeStyle = '#3A2415';
  g.lineWidth = 2.5;
  g.fillRect(44, 112, 12, 98); g.strokeRect(44, 112, 12, 98);
  g.fillRect(170, 112, 12, 98); g.strokeRect(170, 112, 12, 98);
  g.fillRect(44, 112, 138, 10); g.strokeRect(44, 112, 138, 10);
  g.fillRect(44, 202, 138, 10); g.strokeRect(44, 202, 138, 10);

  // Rounded door
  g.fillStyle = '#8B5A2B';
  g.strokeStyle = '#3A2415';
  g.lineWidth = 2.5;
  roundRect(g, 60, 148, 36, 60, [18, 18, 0, 0]);
  g.fill(); g.stroke();
  g.strokeStyle = '#5A3E28'; g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(72, 152); g.lineTo(72, 208);
  g.moveTo(84, 152); g.lineTo(84, 208);
  g.stroke();
  g.fillStyle = '#2B2520';
  g.fillRect(59, 162, 10, 4); g.fillRect(59, 192, 10, 4);
  g.beginPath(); g.arc(88, 180, 3, 0, Math.PI * 2); g.fill();

  // Stone stoop
  g.fillStyle = '#A09B92'; g.strokeStyle = '#3A2415'; g.lineWidth = 2;
  roundRect(g, 54, 246, 48, 8, 2);
  g.fill(); g.stroke();

  // Glowing paned window
  g.fillStyle = '#5A3E28';
  g.fillRect(116, 136, 50, 46);
  g.strokeStyle = '#3A2415'; g.lineWidth = 2.5;
  g.strokeRect(116, 136, 50, 46);

  if (typeof g.createRadialGradient === 'function') {
    const winGrad = g.createRadialGradient(141, 159, 2, 141, 159, 22);
    winGrad.addColorStop(0, '#FFFDF0');
    winGrad.addColorStop(0.5, '#FFE29A');
    winGrad.addColorStop(1, '#FFB300');
    g.fillStyle = winGrad;
  } else {
    g.fillStyle = '#FFE29A';
  }
  g.fillRect(120, 140, 42, 38);
  g.strokeStyle = '#3A2415'; g.lineWidth = 2;
  g.beginPath();
  g.moveTo(141, 140); g.lineTo(141, 178);
  g.moveTo(120, 159); g.lineTo(162, 159);
  g.stroke();

  // Flower box under window
  g.fillStyle = '#6B4E35';
  g.strokeStyle = '#3A2415';
  g.lineWidth = 2;
  roundRect(g, 112, 182, 58, 16, 2);
  g.fill(); g.stroke();

  // Flowers & foliage
  g.fillStyle = '#4A993B';
  g.beginPath();
  g.ellipse(120, 180, 8, 6, -0.2, 0, Math.PI * 2);
  g.ellipse(140, 180, 9, 6, 0.1, 0, Math.PI * 2);
  g.ellipse(160, 180, 8, 6, 0.3, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#E84A6A';
  g.beginPath();
  g.arc(122, 177, 4.5, 0, Math.PI * 2);
  g.arc(158, 177, 4.5, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#FF80AB';
  g.beginPath();
  g.arc(122, 176, 2, 0, Math.PI * 2);
  g.arc(158, 176, 2, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#F7C04A';
  g.beginPath(); g.arc(141, 176, 4.5, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#4A88E8';
  g.beginPath();
  g.arc(131, 181, 3.5, 0, Math.PI * 2);
  g.arc(150, 181, 3.5, 0, Math.PI * 2);
  g.fill();

  // Terracotta & mossy roof
  g.fillStyle = '#C85A3A';
  g.strokeStyle = '#3A2415';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(28, 116);
  g.lineTo(114, 44);
  g.lineTo(198, 116);
  g.closePath();
  g.fill(); g.stroke();

  for (let r = 0; r < 5; r++) {
    const ry = 58 + r * 11;
    const rx1 = 114 - r * 15;
    const rx2 = 114 + r * 15;
    g.strokeStyle = '#A84226'; g.lineWidth = 2.5;
    g.beginPath(); g.moveTo(rx1, ry); g.lineTo(rx2, ry); g.stroke();
    g.strokeStyle = '#DE7252'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(rx1, ry - 1); g.lineTo(rx2, ry - 1); g.stroke();
  }

  g.fillStyle = '#6B8E4E';
  g.beginPath();
  g.ellipse(75, 104, 20, 8, -0.2, 0, Math.PI * 2);
  g.ellipse(155, 102, 18, 7, 0.2, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#85A862';
  g.beginPath();
  g.ellipse(74, 102, 12, 4, -0.2, 0, Math.PI * 2);
  g.ellipse(156, 100, 10, 4, 0.2, 0, Math.PI * 2);
  g.fill();

  // Stone chimney
  g.fillStyle = '#8C8780';
  g.strokeStyle = '#3A2415';
  g.lineWidth = 2.5;
  g.fillRect(172, 42, 32, 70);
  g.strokeRect(172, 42, 32, 70);
  g.fillStyle = '#6C6760';
  for (let i = 0; i < 4; i++) {
    g.fillRect(176, 48 + i * 14, 10, 8);
    g.fillRect(190, 54 + i * 14, 10, 8);
  }
  g.fillStyle = '#B2452A';
  roundRect(g, 176, 30, 24, 14, 2);
  g.fill(); g.stroke();

  g.fillStyle = 'rgba(235, 235, 245, 0.45)';
  g.beginPath();
  g.arc(188, 20, 8, 0, Math.PI * 2);
  g.arc(195, 10, 11, 0, Math.PI * 2);
  g.arc(190, -4, 14, 0, Math.PI * 2);
  g.fill();

  return c;
}

function drawCastleRuinsCanvas() {
  const c = makeCanvas(320, 320, 0.15);
  const g = c.getContext('2d');
  if (!g) return c;

  g.fillStyle = 'rgba(30, 25, 20, 0.38)';
  g.beginPath(); g.ellipse(160, 288, 145, 26, 0, 0, Math.PI * 2); g.fill();

  // Tower walls
  g.fillStyle = '#78767A';
  g.strokeStyle = '#3A2415';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(76, 275);
  g.lineTo(76, 85);
  g.lineTo(92, 85); g.lineTo(92, 100);
  g.lineTo(108, 100); g.lineTo(108, 85);
  g.lineTo(124, 85); g.lineTo(124, 100);
  g.lineTo(142, 100); g.lineTo(142, 85);
  g.lineTo(158, 85);
  // Broken edge
  g.lineTo(168, 105);
  g.lineTo(182, 98);
  g.lineTo(194, 122);
  g.lineTo(210, 118);
  g.lineTo(228, 145);
  g.lineTo(240, 142);
  g.lineTo(244, 275);
  g.closePath();
  g.fill(); g.stroke();

  // Masonry joints
  g.strokeStyle = '#525055'; g.lineWidth = 1.5;
  for (let row = 0; row < 10; row++) {
    const y = 110 + row * 16;
    g.beginPath(); g.moveTo(78, y); g.lineTo(242, y); g.stroke();
    const offset = (row % 2) * 16;
    for (let x = 86 + offset; x < 235; x += 32) {
      g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 16); g.stroke();
    }
  }

  // Gothic archway
  g.fillStyle = '#221F28';
  g.strokeStyle = '#3A2415'; g.lineWidth = 3;
  g.beginPath();
  g.moveTo(122, 275);
  g.lineTo(122, 185);
  g.bezierCurveTo(122, 138, 160, 122, 160, 122);
  g.bezierCurveTo(160, 122, 198, 138, 198, 185);
  g.lineTo(198, 275);
  g.closePath();
  g.fill(); g.stroke();

  // Cracks
  g.strokeStyle = '#1D1A22'; g.lineWidth = 2.5;
  g.beginPath();
  g.moveTo(160, 122); g.lineTo(166, 145); g.lineTo(158, 162); g.lineTo(165, 180);
  g.moveTo(166, 145); g.lineTo(180, 150);
  g.moveTo(212, 140); g.lineTo(206, 168); g.lineTo(218, 192);
  g.stroke();

  // Ivy vines
  g.strokeStyle = '#355E2B'; g.lineWidth = 3.5;
  g.beginPath();
  g.moveTo(80, 270);
  g.quadraticCurveTo(90, 210, 84, 160);
  g.quadraticCurveTo(80, 120, 94, 90);
  g.moveTo(86, 190);
  g.quadraticCurveTo(110, 175, 124, 185);
  g.stroke();

  g.fillStyle = '#4E873E';
  for (const [lx, ly] of [[82, 240], [88, 210], [83, 175], [92, 145], [86, 115], [96, 95], [105, 182], [118, 180]]) {
    g.beginPath();
    g.ellipse(lx, ly, 6, 4, -0.3, 0, Math.PI * 2);
    g.ellipse(lx + 4, ly - 2, 5, 3.5, 0.4, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#72B05E';
    g.fillRect(lx, ly - 1, 2, 2);
    g.fillStyle = '#4E873E';
  }

  // Scaffolding timber
  g.strokeStyle = '#3A2415'; g.lineWidth = 3;
  g.fillStyle = '#7D5838';
  roundRect(g, 202, 130, 8, 145, 2); g.fill(); g.stroke();
  roundRect(g, 238, 145, 8, 130, 2); g.fill(); g.stroke();
  roundRect(g, 196, 175, 54, 7, 2); g.fill(); g.stroke();
  roundRect(g, 196, 225, 54, 7, 2); g.fill(); g.stroke();

  g.beginPath();
  g.moveTo(206, 180); g.lineTo(242, 228);
  g.moveTo(206, 228); g.lineTo(242, 180);
  g.strokeStyle = '#6B4E35'; g.lineWidth = 5; g.stroke();
  g.strokeStyle = '#3A2415'; g.lineWidth = 1.5; g.stroke();

  g.fillStyle = '#D2B48C';
  g.fillRect(202, 174, 8, 8);
  g.fillRect(238, 174, 8, 8);

  // Rubble stones
  g.fillStyle = '#78767A'; g.strokeStyle = '#3A2415'; g.lineWidth = 2;
  roundRect(g, 245, 262, 18, 14, 3); g.fill(); g.stroke();
  roundRect(g, 262, 268, 16, 10, 2); g.fill(); g.stroke();

  // Campfire
  if (typeof g.createRadialGradient === 'function') {
    const fireGrad = g.createRadialGradient(85, 275, 2, 85, 275, 32);
    fireGrad.addColorStop(0, 'rgba(255, 179, 0, 0.6)');
    fireGrad.addColorStop(0.5, 'rgba(245, 124, 0, 0.3)');
    fireGrad.addColorStop(1, 'rgba(245, 124, 0, 0)');
    g.fillStyle = fireGrad;
  } else {
    g.fillStyle = 'rgba(255, 179, 0, 0.4)';
  }
  g.beginPath(); g.arc(85, 275, 32, 0, Math.PI * 2); g.fill();

  g.fillStyle = '#686460'; g.strokeStyle = '#3A2415'; g.lineWidth = 1.5;
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    g.beginPath();
    g.ellipse(85 + Math.cos(a) * 14, 275 + Math.sin(a) * 7, 5, 3.5, 0, 0, Math.PI * 2);
    g.fill(); g.stroke();
  }
  g.strokeStyle = '#3D2817'; g.lineWidth = 3.5;
  g.beginPath();
  g.moveTo(76, 278); g.lineTo(94, 272);
  g.moveTo(76, 272); g.lineTo(94, 278);
  g.stroke();

  g.fillStyle = '#D84315';
  g.beginPath();
  g.moveTo(77, 275);
  g.quadraticCurveTo(80, 255, 85, 246);
  g.quadraticCurveTo(90, 255, 93, 275);
  g.closePath();
  g.fill();
  g.fillStyle = '#FF9800';
  g.beginPath();
  g.moveTo(80, 275);
  g.quadraticCurveTo(82, 258, 85, 250);
  g.quadraticCurveTo(88, 258, 90, 275);
  g.closePath();
  g.fill();
  g.fillStyle = '#FFEE58';
  g.beginPath();
  g.moveTo(82, 275);
  g.quadraticCurveTo(84, 264, 85, 257);
  g.quadraticCurveTo(86, 264, 88, 275);
  g.closePath();
  g.fill();

  // Notice board
  g.fillStyle = '#6B4E35'; g.strokeStyle = '#3A2415'; g.lineWidth = 2;
  g.fillRect(238, 240, 8, 45); g.strokeRect(238, 240, 8, 45);

  g.fillStyle = '#7D5838';
  roundRect(g, 218, 210, 48, 36, 3);
  g.fill(); g.stroke();
  g.strokeStyle = '#5A3E28'; g.lineWidth = 1.5;
  g.strokeRect(221, 213, 42, 30);

  g.fillStyle = '#F5E6C8'; g.strokeStyle = '#3A2415'; g.lineWidth = 1.2;
  roundRect(g, 224, 216, 18, 22, 1); g.fill(); g.stroke();
  roundRect(g, 242, 218, 16, 18, 1); g.fill(); g.stroke();
  g.strokeStyle = '#5C4A36'; g.lineWidth = 1;
  g.beginPath();
  g.moveTo(226, 222); g.lineTo(238, 222);
  g.moveTo(226, 226); g.lineTo(236, 226);
  g.moveTo(226, 230); g.lineTo(234, 230);
  g.stroke();
  g.fillStyle = '#C62828';
  g.beginPath(); g.arc(233, 234, 2.5, 0, Math.PI * 2); g.fill();

  return c;
}

function drawFarmlandTileCanvas() {
  const c = makeCanvas(256, 256);
  const g = c.getContext('2d');
  if (!g) return c;

  g.fillStyle = '#382518';
  g.fillRect(0, 0, 256, 256);

  for (let row = 0; row < 8; row++) {
    const y0 = row * 32;
    g.fillStyle = '#26180F';
    g.fillRect(0, y0, 256, 8);
    g.fillStyle = '#3E2A1C';
    g.fillRect(0, y0 + 8, 256, 10);
    g.fillStyle = '#4E3624';
    g.fillRect(0, y0 + 18, 256, 12);
    g.fillStyle = '#654932';
    g.fillRect(0, y0 + 22, 256, 4);
  }

  for (let i = 0; i < 48; i++) {
    const px = (i * 37) % 256;
    const py = (i * 53) % 256;
    g.fillStyle = i % 2 === 0 ? '#7A6652' : '#1E120A';
    g.fillRect(px, py, (i % 3) + 2, (i % 2) + 2);
  }

  return c;
}

function drawDirtTileCanvas() {
  const c = makeCanvas(256, 256);
  const g = c.getContext('2d');
  if (!g) return c;

  g.fillStyle = '#A67C52';
  g.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 64; i++) {
    const mx = (i * 41) % 256;
    const my = (i * 67) % 256;
    g.fillStyle = i % 2 === 0 ? '#BFA077' : '#946C42';
    g.beginPath();
    g.ellipse(mx, my, 14, 10, 0, 0, Math.PI * 2);
    g.fill();
  }

  for (const cx of [64, 192]) {
    g.fillStyle = 'rgba(110, 75, 42, 0.45)';
    g.fillRect(cx - 10, 0, 20, 256);
    g.fillStyle = 'rgba(80, 50, 28, 0.35)';
    g.fillRect(cx - 4, 0, 8, 256);
  }
  g.fillStyle = 'rgba(205, 175, 135, 0.3)';
  g.fillRect(112, 0, 32, 256);

  const pebbles = [
    [24, 35, 4, '#70665D'], [92, 48, 5, '#B8ADA1'], [148, 22, 3, '#544D46'],
    [220, 70, 4, '#8A7E72'], [45, 110, 5, '#AFA396'], [175, 125, 4, '#6B6258'],
    [30, 190, 4, '#B8ADA1'], [110, 185, 3, '#70665D'], [235, 200, 5, '#544D46'],
    [80, 240, 4, '#8A7E72'], [160, 235, 5, '#B8ADA1'], [210, 15, 3, '#70665D'],
  ];
  for (const [x, y, r, col] of pebbles) {
    g.fillStyle = 'rgba(50, 30, 15, 0.4)';
    g.beginPath(); g.ellipse(x + 1, y + 2, r + 1, r, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = col;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#E8E0D5';
    g.fillRect(x - 1, y - 1, 1.5, 1.5);
  }

  return c;
}

function drawFlagstoneTileCanvas() {
  const c = makeCanvas(256, 256);
  const g = c.getContext('2d');
  if (!g) return c;

  g.fillStyle = '#424838';
  g.fillRect(0, 0, 256, 256);

  for (let r = 0; r < 4; r++) {
    const y0 = r * 64;
    const offset = (r % 2) * 32;
    for (let cidx = -1; cidx < 5; cidx++) {
      const x0 = cidx * 64 + offset;
      const w = 60;
      const h = 60;
      g.fillStyle = (r + cidx) % 3 === 0 ? '#E2DDD4' : ((r + cidx) % 2 === 0 ? '#D6CEC2' : '#CDC4B6');
      roundRect(g, x0 + 2, y0 + 2, w, h, 3);
      g.fill();
      g.fillStyle = 'rgba(255, 255, 255, 0.4)';
      g.fillRect(x0 + 4, y0 + 4, w - 8, 3);
      g.fillRect(x0 + 4, y0 + 4, 3, h - 8);
    }
  }

  g.fillStyle = '#5C7844';
  const mossSpots = [[32, 64], [96, 64], [160, 64], [224, 64], [64, 128], [128, 128], [192, 128], [32, 192], [96, 192], [160, 192]];
  for (const [mx, my] of mossSpots) {
    g.beginPath();
    g.arc(mx, my, 4, 0, Math.PI * 2);
    g.arc(mx + 3, my - 1, 3, 0, Math.PI * 2);
    g.fill();
  }

  return c;
}

function drawBoardwalkTileCanvas() {
  const c = makeCanvas(256, 256);
  const g = c.getContext('2d');
  if (!g) return c;

  g.fillStyle = '#3D2A1A';
  g.fillRect(0, 0, 256, 256);

  for (let r = 0; r < 8; r++) {
    const y0 = r * 32;
    g.fillStyle = r % 2 === 0 ? '#A88258' : '#9C774E';
    roundRect(g, 0, y0 + 2, 256, 28, 2);
    g.fill();

    g.strokeStyle = '#88623A'; g.lineWidth = 1;
    g.beginPath();
    g.moveTo(0, y0 + 10); g.lineTo(256, y0 + 10);
    g.moveTo(0, y0 + 20); g.lineTo(256, y0 + 20);
    g.stroke();

    for (const nx of [16, 112, 144, 240]) {
      g.fillStyle = '#2A2018';
      g.beginPath(); g.arc(nx, y0 + 9, 2.5, 0, Math.PI * 2); g.arc(nx, y0 + 23, 2.5, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#8E877F';
      g.fillRect(nx - 1, y0 + 8, 1.5, 1.5);
      g.fillRect(nx - 1, y0 + 22, 1.5, 1.5);
    }
  }

  return c;
}

function drawWildflowerTileCanvas() {
  const c = makeCanvas(256, 256);
  const g = c.getContext('2d');
  if (!g) return c;

  g.fillStyle = '#559132';
  g.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 32; i++) {
    const gx = (i * 47) % 256;
    const gy = (i * 71) % 256;
    g.fillStyle = i % 2 === 0 ? '#62A03D' : '#488029';
    g.beginPath(); g.ellipse(gx, gy, 18, 12, 0.4, 0, Math.PI * 2); g.fill();
  }

  const flowers = [
    [32, 40, 'daisy'], [110, 25, 'buttercup'], [190, 50, 'clover'],
    [70, 110, 'daisy'], [150, 95, 'buttercup'], [230, 120, 'daisy'],
    [40, 180, 'clover'], [120, 195, 'daisy'], [200, 175, 'buttercup'],
    [85, 235, 'buttercup'], [170, 240, 'clover'], [245, 230, 'daisy'],
  ];

  for (const [x, y, kind] of flowers) {
    if (kind === 'daisy') {
      g.fillStyle = '#FFFFFF';
      for (let a = 0; a < 5; a++) {
        const ang = (a / 5) * Math.PI * 2;
        g.beginPath(); g.ellipse(x + Math.cos(ang) * 5, y + Math.sin(ang) * 5, 4, 2.5, ang, 0, Math.PI * 2); g.fill();
      }
      g.fillStyle = '#FFC107';
      g.beginPath(); g.arc(x, y, 3, 0, Math.PI * 2); g.fill();
    } else if (kind === 'buttercup') {
      g.fillStyle = '#FFD54F';
      for (let a = 0; a < 4; a++) {
        const ang = (a / 4) * Math.PI * 2;
        g.beginPath(); g.ellipse(x + Math.cos(ang) * 4, y + Math.sin(ang) * 4, 3.5, 3, ang, 0, Math.PI * 2); g.fill();
      }
      g.fillStyle = '#FFA000';
      g.beginPath(); g.arc(x, y, 2.5, 0, Math.PI * 2); g.fill();
    } else {
      g.fillStyle = '#33691E';
      for (let a = 0; a < 3; a++) {
        const ang = (a / 3) * Math.PI * 2 - Math.PI / 2;
        g.beginPath(); g.ellipse(x + Math.cos(ang) * 4, y + Math.sin(ang) * 4, 3.5, 3, ang, 0, Math.PI * 2); g.fill();
      }
      g.fillStyle = '#F06292';
      g.beginPath(); g.arc(x, y, 2, 0, Math.PI * 2); g.fill();
    }
  }

  return c;
}

function drawAutumnOrchardTileCanvas() {
  const c = makeCanvas(256, 256);
  const g = c.getContext('2d');
  if (!g) return c;

  g.fillStyle = '#8E6D30';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 32; i++) {
    const x = (i * 47) % 256, y = (i * 71) % 256;
    g.fillStyle = i % 2 === 0 ? '#9E7E3C' : '#785B24';
    g.beginPath(); g.ellipse(x, y, 20, 14, 0.3, 0, Math.PI * 2); g.fill();
  }
  const leaves = [
    [35, 45, '#C62828'], [115, 30, '#EF6C00'], [185, 60, '#F57F17'],
    [65, 125, '#C62828'], [145, 105, '#EF6C00'], [225, 135, '#8D5B28'],
    [45, 195, '#EF6C00'], [125, 210, '#C62828'], [205, 185, '#F57F17'],
    [90, 245, '#8D5B28'], [175, 240, '#C62828'],
  ];
  for (const [lx, ly, col] of leaves) {
    g.fillStyle = col;
    g.beginPath(); g.ellipse(lx, ly, 6, 3.5, 0.5, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(lx + 2, ly - 2, 5, 2.5, -0.4, 0, Math.PI * 2); g.fill();
  }
  return c;
}

function drawMossyWoodsTileCanvas() {
  const c = makeCanvas(256, 256);
  const g = c.getContext('2d');
  if (!g) return c;

  g.fillStyle = '#2E5022';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 32; i++) {
    const x = (i * 43) % 256, y = (i * 67) % 256;
    g.fillStyle = i % 2 === 0 ? '#3A632C' : '#24401B';
    g.beginPath(); g.ellipse(x, y, 22, 16, -0.2, 0, Math.PI * 2); g.fill();
  }
  for (let i = 0; i < 18; i++) {
    const x = (i * 59) % 256, y = (i * 83) % 256;
    g.strokeStyle = '#6D4A2B'; g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(x, y); g.lineTo(x + 7, y - 4);
    g.moveTo(x, y); g.lineTo(x + 5, y + 5);
    g.stroke();
    if (i % 3 === 0) {
      g.fillStyle = '#8D6847';
      g.beginPath(); g.ellipse(x + 12, y, 4, 3, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#FFF8E7';
      g.fillRect(x + 11, y, 2, 4);
    }
  }
  return c;
}

function drawWinterHighlandTileCanvas() {
  const c = makeCanvas(256, 256);
  const g = c.getContext('2d');
  if (!g) return c;

  g.fillStyle = '#E6F0FA';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 28; i++) {
    const x = (i * 47) % 256, y = (i * 73) % 256;
    g.fillStyle = i % 2 === 0 ? '#D6E5F2' : '#C2D7EA';
    g.beginPath(); g.ellipse(x, y, 20, 12, 0.4, 0, Math.PI * 2); g.fill();
  }
  for (let i = 0; i < 12; i++) {
    const x = (i * 79) % 256, y = (i * 61) % 256;
    g.fillStyle = '#8C9CA8';
    g.beginPath(); g.ellipse(x, y, 6, 4, 0.2, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#5D837F';
    g.beginPath(); g.arc(x + 5, y - 2, 3, 0, Math.PI * 2); g.fill();
  }
  return c;
}

function drawRoseGardenTileCanvas() {
  const c = makeCanvas(256, 256);
  const g = c.getContext('2d');
  if (!g) return c;

  g.fillStyle = '#3D7832';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 32; i++) {
    const x = (i * 51) % 256, y = (i * 73) % 256;
    g.fillStyle = i % 2 === 0 ? '#4A873E' : '#34662A';
    g.beginPath(); g.ellipse(x, y, 18, 12, 0, 0, Math.PI * 2); g.fill();
  }
  const petals = [
    [30, 40, '#F48FB1'], [95, 25, '#C2185B'], [180, 55, '#880E4F'],
    [60, 115, '#F48FB1'], [140, 90, '#C2185B'], [220, 125, '#F48FB1'],
    [40, 185, '#880E4F'], [125, 200, '#C2185B'], [195, 175, '#F48FB1'],
    [80, 240, '#C2185B'], [165, 235, '#880E4F'],
  ];
  for (const [px, py, col] of petals) {
    g.fillStyle = col;
    g.beginPath(); g.ellipse(px, py, 5, 3.2, 0.4, 0, Math.PI * 2); g.fill();
  }
  return c;
}

function fallbackCanvas(name) {
  if (name === 'bld_farm_plot') return drawFarmPlotCanvas();
  if (name === 'bld_workshop') return drawWorkshopCanvas();
  if (name === 'bld_cottage') return drawCottageCanvas();
  if (name === 'bld_castle_ruins') return drawCastleRuinsCanvas();
  if (name === 'road_farmland') return drawFarmlandTileCanvas();
  if (name === 'road_dirt') return drawDirtTileCanvas();
  if (name === 'road_flagstone') return drawFlagstoneTileCanvas();
  if (name === 'road_boardwalk') return drawBoardwalkTileCanvas();
  if (name === 'road_wildflower') return drawWildflowerTileCanvas();
  if (name === 'biome_autumn_orchard') return drawAutumnOrchardTileCanvas();
  if (name === 'biome_mossy_woods') return drawMossyWoodsTileCanvas();
  if (name === 'biome_winter_highland') return drawWinterHighlandTileCanvas();
  if (name === 'biome_rose_garden') return drawRoseGardenTileCanvas();

  const c = makeCanvas(256, 384);
  const g = c.getContext('2d');
  if (!g) return c;
  const hue = [...name].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 360, 7);
  g.lineWidth = 8; g.strokeStyle = '#3a2415';
  g.fillStyle = `hsl(${hue} 55% 70%)`;
  g.beginPath(); roundRect(g, 70, 170, 116, 150, 30); g.fill(); g.stroke();     // body
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
      const isTile = info?.tile || name.startsWith('road_') || name.startsWith('ground_') || name.startsWith('biome_') || name.startsWith('water_');
      if (isTile) {
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      }
      resolve({
        texture,
        w: canvas.width,
        h: canvas.height,
        anchorY: info?.anchorY ?? canvas.anchorY ?? 0,
        fallback: true,
      });
    };
    if (!info || !info.file) { useFallback(); return; }
    const ver = manifest.generatedAt ? `?v=${encodeURIComponent(manifest.generatedAt)}` : '';
    new THREE.TextureLoader().load(`/assets/${info.file}${ver}`, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = maxAniso;
      if (info.tile) { texture.wrapS = texture.wrapT = THREE.RepeatWrapping; }
      texture.generateMipmaps = true;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      resolve({ texture, w: info.w, h: info.h, anchorY: info.anchorY ?? 0.5, faces: info.faces || 'right', hem: info.hem || 'short', headDiam: info.headDiam, headCX: info.headCX, headTop: info.headTop, eyeX: info.eyeX, eyeY: info.eyeY, eyeSpan: info.eyeSpan, fallback: false });
    }, undefined, useFallback);
  });
  cache.set(name, p);
  return p;
}
