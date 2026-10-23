// client/js/village_plaza.js — Step 2 village: Twin Sky-Islands renderer (ground skins, roads / canal /
// footbridges, building & Wonder & decor sprites, harvest bubbles, Rainbow Heart Bridge + Love Pavilion)
// and the CRK-style 18×18 → 32×32 Grid Editor (Drag / Paint modes, rotate, bag, undo, store-all, save).
import * as THREE from 'three';
import { loadSprite, spriteInfo } from './assets.js';
import {
  placeable, footprint, buildingCaps, TILES, CORE, WONDERS, DECOR, GROUND_SKINS, LOVE_PAVILION, EXPANSION_TIERS,
} from '/shared/catalog_landmarks.js';
import {
  buildCellIndex, cellToWorld, worldToCell, validateLayout, computeComfort, comfortBonusPct, bagContents, cellsOf,
  islandAt, islandOf, landingCells, bridgesOf, heartIslandOf, isHeartIsland,
} from '/shared/village_rules.js';

// Heart Isle decor → closest existing sprite (Master Plan v2 §12); keys that already have art map to themselves.
const HEART_DECOR_SPRITES = {
  heart_arch: 'env_arch_floral_ortho', twin_lanterns: 'env_string_lights_post', photo_booth: 'dec_heaven_cloud_arch',
  rose_hedge: 'env_bush_roses_pink', wisteria_pergola: 'dec_couple_hammock', couple_bench: 'dec_wooden_bench',
  dec_nookairline_museum: 'dec_nookairline_museum', wnd_ferris: 'wnd_ferris',
};
const HEART_GROUND = 0x8fa082;     // rose-garden ground tint
const HEART_PATH = 0xd9a3a8;       // dusty rose path tiles

/** Memory Isle look: blend every fragment toward grey (frozen Heart Isle after a split). */
function desaturate(mat) {
  mat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>',
      '#include <map_fragment>\n{ float g = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114)); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(g), 0.8); }');
  };
  mat.customProgramCacheKey = () => 'heart_desat';
  mat.needsUpdate = true;
}

const Y = { GROUND: 0, WATER: 0.006, ROAD: 0.012, BRIDGE: 0.02, GRID: 0.03, GHOST: 0.035 };
const SPRITE_WIDTH_PER_TILE = 1.02;
const DECOR_WIDTH_PER_TILE = 1.05;
const MIN_BUILDING_SPRITE_WIDTH = 1.30;
export const MOOD_TINT = {
  sunny:  [1, 1, 1],
  sakura: [1, 0.94, 0.97],
  sunset: [1, 0.84, 0.72],
  night:  [0.56, 0.62, 0.9],
  dawn:   [1.0, 0.92, 0.86],
  dusk:   [0.92, 0.80, 0.88],
  day:    [1, 1, 1],
};
export const MOOD_SKY = {
  sunny:  ['#7cc4ff', '#cdeaff', '#ffeccc'],
  sakura: ['#ffc6dc', '#ffe4ef', '#fff3e6'],
  sunset: ['#ff9a6b', '#ffc78f', '#ffe7c2'],
  night:  ['#121a4a', '#2b3a7a', '#5b5fa0'],
  dawn:   ['#ff9ea5', '#ffd5af', '#fff1d6'],
  dusk:   ['#5b4b7a', '#a4688b', '#e89b7b'],
  day:    ['#7cc4ff', '#cdeaff', '#ffeccc'],
};

export function resolveMood(mood, date = new Date()) {
  const m = (typeof mood === 'object' && mood !== null) ? (mood.time || mood.mood) : mood;
  if (m && m !== 'auto') {
    if (m === 'day') return 'sunny';
    return m;
  }
  const h = date.getHours();
  if (h >= 19 || h < 5) return 'night';
  if (h >= 17) return 'sunset';
  return 'sunny';
}

const skyTexCache = new Map();
function skyTexture(mood) {
  const m = MOOD_SKY[mood] ? mood : 'sunny';
  if (skyTexCache.has(m)) return skyTexCache.get(m);
  const c = document.createElement('canvas'); c.width = 4; c.height = 256;
  const g = c.getContext('2d');
  const [a, b, d] = MOOD_SKY[m];
  const grd = g.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, a); grd.addColorStop(0.55, b); grd.addColorStop(1, d);
  g.fillStyle = grd; g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  skyTexCache.set(m, t);
  return t;
}

let plankTex = null;
function plankTexture() {
  if (plankTex) return plankTex;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#e8cfa6'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 4; i++) {
    g.fillStyle = i % 2 ? '#f3dec0' : '#dfbe92'; g.fillRect(0, i * 32 + 2, 128, 28);
    g.strokeStyle = '#8b6542'; g.lineWidth = 2; g.strokeRect(1, i * 32 + 2, 126, 28);
  }
  plankTex = new THREE.CanvasTexture(c); plankTex.colorSpace = THREE.SRGBColorSpace;
  plankTex.wrapS = plankTex.wrapT = THREE.RepeatWrapping;
  return plankTex;
}

let rainbowTex = null;
function rainbowDeckTexture() {
  if (rainbowTex) return rainbowTex;
  const c = document.createElement('canvas'); c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  ['#ff9aa8', '#ffc78a', '#fff09a', '#b6f0a0', '#9ad8ff', '#c7a8ff'].forEach((col, i) => { g.fillStyle = col; g.fillRect(0, i * 21, 64, 22); });
  g.fillStyle = '#ffffff55'; for (let x = 0; x < 64; x += 16) g.fillRect(x, 0, 2, 128);
  rainbowTex = new THREE.CanvasTexture(c); rainbowTex.colorSpace = THREE.SRGBColorSpace;
  rainbowTex.wrapS = THREE.RepeatWrapping;
  return rainbowTex;
}

function makeCropBadgeSprite(emoji, isReady) {
  if (typeof document === 'undefined' || !document.createElement) return new THREE.Sprite();
  const c = document.createElement('canvas');
  c.width = 96; c.height = 96;
  const g = c.getContext('2d');
  g.shadowColor = 'rgba(0, 0, 0, 0.25)';
  g.shadowBlur = 6;
  g.shadowOffsetY = 2;
  g.beginPath();
  g.arc(48, 48, 38, 0, Math.PI * 2);
  g.fillStyle = isReady ? '#FFF8E1' : '#E8F5E9';
  g.fill();
  g.shadowColor = 'transparent';
  g.lineWidth = 4;
  g.strokeStyle = isReady ? '#FFB300' : '#4CAF50';
  g.stroke();

  if (isReady) {
    g.lineWidth = 2;
    g.strokeStyle = '#FFE082';
    g.stroke();
  }

  g.font = '36px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(emoji, 48, 50);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(0.72, 0.72, 1);
  sprite.renderOrder = 22;
  return sprite;
}

function makeReadyBadgeSprite() {
  if (typeof document === 'undefined' || !document.createElement) return new THREE.Sprite();
  const c = document.createElement('canvas');
  c.width = 96; c.height = 96;
  const g = c.getContext('2d');
  g.shadowColor = 'rgba(255, 179, 0, 0.6)';
  g.shadowBlur = 8;
  g.beginPath();
  g.arc(48, 48, 38, 0, Math.PI * 2);
  if (typeof g.createRadialGradient === 'function') {
    const grad = g.createRadialGradient(48, 48, 4, 48, 48, 38);
    grad.addColorStop(0, '#FFF9C4');
    grad.addColorStop(0.7, '#FFD54F');
    grad.addColorStop(1, '#FFA000');
    g.fillStyle = grad;
  } else {
    g.fillStyle = '#FFD54F';
  }
  g.fill();
  g.shadowColor = 'transparent';
  g.lineWidth = 3;
  g.strokeStyle = '#FF8F00';
  g.stroke();

  g.beginPath();
  g.arc(48, 48, 32, 0, Math.PI * 2);
  g.lineWidth = 1.5;
  g.strokeStyle = 'rgba(255, 255, 255, 0.7)';
  g.stroke();

  g.font = '38px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('✨', 48, 50);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(0.75, 0.75, 1);
  sprite.renderOrder = 23;
  return sprite;
}

const weatherTexCache = {};
function getWeatherTexture(type) {
  if (typeof document === 'undefined' || !document.createElement) return null;
  if (weatherTexCache[type]) return weatherTexCache[type];
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  if (type === 'firefly') {
    if (typeof g.createRadialGradient === 'function') {
      const grd = g.createRadialGradient(16, 16, 2, 16, 16, 15);
      grd.addColorStop(0, '#ffffff');
      grd.addColorStop(0.3, '#ffff8d');
      grd.addColorStop(0.65, 'rgba(205, 220, 57, 0.7)');
      grd.addColorStop(1, 'rgba(205, 220, 57, 0)');
      g.fillStyle = grd;
    } else {
      g.fillStyle = '#eeff41';
    }
    g.fillRect(0, 0, 32, 32);
  } else if (type === 'leaf') {
    g.fillStyle = '#ff9800';
    g.beginPath();
    g.ellipse(16, 16, 11, 6, Math.PI / 4, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#d84315';
    g.beginPath();
    g.ellipse(16, 16, 7, 3, Math.PI / 4, 0, Math.PI * 2);
    g.fill();
  } else if (type === 'drizzle') {
    g.strokeStyle = '#81d4fa';
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(22, 4);
    g.lineTo(10, 28);
    g.stroke();
  } else { // petal
    g.fillStyle = '#ff80ab';
    g.beginPath();
    g.ellipse(16, 16, 11, 7, -Math.PI / 6, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#ffb2dd';
    g.beginPath();
    g.ellipse(15, 15, 7, 4, -Math.PI / 6, 0, Math.PI * 2);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  weatherTexCache[type] = tex;
  return tex;
}

/** Merged quad geometry for a list of cells (one draw call per tile type). */
function cellsGeometry(island, cells, y, uvScale = 0.5) {
  const pos = [], uv = [], idx = [];
  const ox = island.cx - island.S / 2, oz = -island.S / 2;
  cells.forEach(([gx, gy], i) => {
    const x0 = ox + gx, z0 = oz + gy;
    pos.push(x0, y, z0, x0 + 1, y, z0, x0 + 1, y, z0 + 1, x0, y, z0 + 1);
    uv.push(x0 * uvScale, -z0 * uvScale, (x0 + 1) * uvScale, -z0 * uvScale, (x0 + 1) * uvScale, -(z0 + 1) * uvScale, x0 * uvScale, -(z0 + 1) * uvScale);
    const b = i * 4; idx.push(b, b + 2, b + 1, b, b + 3, b + 2);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uv), 2));
  g.setIndex(idx);
  return g;
}

async function swatch(name) {
  const s = await loadSprite(name);
  s.texture.wrapS = s.texture.wrapT = THREE.RepeatWrapping;
  s.texture.needsUpdate = true;
  return s.texture;
}

// =================================================================================================
export class VillagePlaza {
  constructor(world) {
    this.world = world;
    this.scene = world.scene;
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.layout = null;            // { islands: [{ owner, S, cx, village, index }], bridge }
    this.entries = new Map();      // owner -> { group, tiles, blds, overlay }
    this.pickables = [];
    this.bubbles = [];
    this.tintables = new Set();    // materials tinted by the mood
    this.water = [];
    this.leanList = [];
    this.selfId = null;
    this.mood = 'sunny';
    this.weather = 'clear';
    this.weatherPoints = null;
    this.weatherGeo = null;
    this.weatherMat = null;
    this.weatherMode = null;
    this.floatingBadges = [];
    this.t = 0;
    this.generation = 0;
  }

  // ------------------------------------------------------------------ layout
  setLayout(wire, selfId) {
    this.selfId = selfId;
    this.layout = { islands: wire.islands.map((i) => ({ ...i })), bridge: wire.bridge, bridges: wire.bridges || (wire.bridge ? [wire.bridge] : []) };
    for (const isl of this.layout.islands) buildCellIndex(isl);
    this.rebuildAll();
  }

  /** Replace one owner's village (server broadcast or editor draft) and rebuild just that island. */
  setVillage(owner, village, { draft = null } = {}) {
    const isl = islandOf(this.layout, owner);
    if (!isl) return;
    isl.village = village;
    buildCellIndex(isl);
    if (this.floatingBadges) {
      this.floatingBadges = this.floatingBadges.filter((b) => b.userData?.owner !== owner);
    }
    this.buildIsland(isl, draft);
  }

  get selfIsland() { return this.layout && islandOf(this.layout, this.selfId); }

  rebuildAll() {
    const gen = ++this.generation;
    for (const e of this.entries.values()) this.disposeGroup(e.group);
    this.entries.clear();
    for (const g of this.bridgeGroups || []) this.disposeGroup(g);
    this.bridgeGroups = [];
    this.pickables = []; this.bubbles = []; this.water = []; this.leanList = []; this.floatingBadges = [];
    if (this.weatherPoints && !this.root.children.includes(this.weatherPoints)) this.root.add(this.weatherPoints);
    for (const isl of this.layout.islands) this.buildIsland(isl);
    // Couples: two bridges A ↔ Heart Isle ↔ B; the Love Pavilion lives on the Heart Isle (bridge-only on old 2-island layouts).
    const hasHeart = !!heartIslandOf(this.layout);
    for (const br of bridgesOf(this.layout)) this.buildBridge(br, { pavilion: !hasHeart });
  }

  disposeGroup(g) {
    this.root.remove(g);
    g.traverse((o) => {
      o.geometry?.dispose?.();
      for (const m of [].concat(o.material || [])) { this.tintables.delete(m); m.dispose?.(); }
    });
  }

  buildIsland(isl, draft = null) {
    const old = this.entries.get(isl.owner);
    if (old) {
      this.disposeGroup(old.group);
      this.pickables = this.pickables.filter((p) => p.userData.owner !== isl.owner);
      this.bubbles = this.bubbles.filter((b) => b.userData.owner !== isl.owner);
      this.water = this.water.filter((w) => w.userData.owner !== isl.owner);
      if (this.leanList) this.leanList = this.leanList.filter((m) => m.userData?.owner !== isl.owner);
    }
    const group = new THREE.Group();
    this.root.add(group);
    const entry = { group, island: isl };
    this.entries.set(isl.owner, entry);
    if (isHeartIsland(isl)) { this.buildHeartIsle(group, isl); return entry; }
    const S = isl.S, v = isl.village;

    // ground skin + 2.5D hand-painted overhanging grass rim & faceted terracotta cliff walls
    const groundMat = this.tint(new THREE.MeshBasicMaterial({ color: 0xb9c54f }));
    swatch(v.ground || 'ground_classic').then((tex) => { groundMat.map = tex; this.setBase(groundMat, 0xffffff); groundMat.needsUpdate = true; });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(S, S).rotateX(-Math.PI / 2), groundMat);
    const guv = ground.geometry.attributes.uv;
    for (let i = 0; i < guv.count; i++) guv.setXY(i, guv.getX(i) * S / 4, guv.getY(i) * S / 4);   // one swatch per 4×4 tiles
    ground.position.set(isl.cx, Y.GROUND, 0);
    group.add(ground);
    this.buildFloatingIslandCliff(group, isl);

    // paint tiles: one merged mesh per type
    const byType = {};
    const tileMap = new Map();
    for (const t of v.tiles) {
      (byType[t.t] ||= []).push([t.x, t.y]);
      tileMap.set(`${t.x},${t.y}`, t.t);
    }
    for (const [type, cells] of Object.entries(byType)) {
      const def = TILES[type];
      if (!def) continue;
      const y = def.water ? Y.WATER : def.bridge ? Y.BRIDGE : Y.ROAD;
      const mat = this.tint(new THREE.MeshBasicMaterial({ color: def.water ? 0x48b8e8 : 0xf4c78e, transparent: !!def.water, opacity: def.water ? 0.96 : 1 }));
      if (def.bridge) {
        swatch(def.sprite || 'road_cobble').then((tex) => { mat.map = tex; this.setBase(mat, 0xffffff); mat.needsUpdate = true; });
      } else {
        swatch(def.sprite).then((tex) => { mat.map = def.water ? tex.clone() : tex; if (def.water) mat.map.needsUpdate = true; this.setBase(mat, 0xffffff); mat.needsUpdate = true; });
      }
      const mesh = new THREE.Mesh(cellsGeometry(isl, cells, y, 0.5), mat);
      mesh.userData.owner = isl.owner;
      if (def.water) this.water.push(mesh);
      group.add(mesh);

      // 2.5D Raised Cream-Stone Road Curbs & Grass-on-Stone Overhang Tufts along road-to-grass edges
      if (!def.water && !def.bridge && !def.farmland && def.road && !draft) {
        const curbMat = this.tint(new THREE.MeshBasicMaterial({ color: 0xf3e5d0 }));
        for (const [gx, gy] of cells) {
          const c = cellToWorld(isl, gx, gy);
          const westGrass = !tileMap.has(`${gx - 1},${gy}`);
          const eastGrass = !tileMap.has(`${gx + 1},${gy}`);
          const northGrass = !tileMap.has(`${gx},${gy - 1}`);
          const southGrass = !tileMap.has(`${gx},${gy + 1}`);
          if (westGrass) {
            const curbW = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.035, 1.02), curbMat);
            curbW.position.set(c.x - 0.46, Y.ROAD + 0.015, c.z);
            group.add(curbW);
            if ((gx + gy) % 2 === 0 && !isl.index?.byCell?.get(`${gx - 1},${gy}`)) {
              const tuft = (gy % 3 === 0) ? 'decal_grass_daisies_b' : 'decal_grass_clover_a';
              this.addSprite(group, tuft, c.x - 0.48, c.z + 0.12, 0.52, { kind: 'env', owner: isl.owner }, { pick: false });
            }
          }
          if (eastGrass) {
            const curbE = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.035, 1.02), curbMat);
            curbE.position.set(c.x + 0.46, Y.ROAD + 0.015, c.z);
            group.add(curbE);
            if ((gx + gy) % 2 === 1 && !isl.index?.byCell?.get(`${gx + 1},${gy}`)) {
              const tuft = (gy % 3 === 1) ? 'decal_grass_daisies_b' : 'decal_grass_clover_a';
              this.addSprite(group, tuft, c.x + 0.48, c.z + 0.12, 0.52, { kind: 'env', owner: isl.owner }, { pick: false });
            }
          }
          if (northGrass) {
            const curbN = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.035, 0.09), curbMat);
            curbN.position.set(c.x, Y.ROAD + 0.015, c.z - 0.46);
            group.add(curbN);
          }
          if (southGrass) {
            const curbS = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.035, 0.09), curbMat);
            curbS.position.set(c.x, Y.ROAD + 0.015, c.z + 0.46);
            group.add(curbS);
          }
        }
      }

      // 2.5D Carved Cream-Stone Bridge Curbs & Corner Pillars on water-facing sides (keeps walk path open!)
      if (def.bridge && !draft) {
        const railMat = this.tint(new THREE.MeshBasicMaterial({ color: 0xeee0c8 }));
        for (const [gx, gy] of cells) {
          const c = cellToWorld(isl, gx, gy);
          if (tileMap.get(`${gx - 1},${gy}`) === 'water') {
            const railW = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.20, 1.02), railMat);
            railW.position.set(c.x - 0.44, 0.11, c.z);
            group.add(railW);
            this.addSprite(group, 'env_bridge_pillar_cap', c.x - 0.46, c.z - 0.38, 0.34, { kind: 'env', owner: isl.owner }, { pick: false });
            this.addSprite(group, 'env_bridge_pillar_cap', c.x - 0.46, c.z + 0.42, 0.34, { kind: 'env', owner: isl.owner }, { pick: false });
          }
          if (tileMap.get(`${gx + 1},${gy}`) === 'water') {
            const railE = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.20, 1.02), railMat);
            railE.position.set(c.x + 0.44, 0.11, c.z);
            group.add(railE);
            this.addSprite(group, 'env_bridge_pillar_cap', c.x + 0.46, c.z - 0.38, 0.34, { kind: 'env', owner: isl.owner }, { pick: false });
            this.addSprite(group, 'env_bridge_pillar_cap', c.x + 0.46, c.z + 0.42, 0.34, { kind: 'env', owner: isl.owner }, { pick: false });
          }
        }
      }

      // 2.5D River Bank Boulders, Cattails, Water Lilies & Cliff Waterfall along North/South canal banks
      if (def.water && !draft) {
        const bankMat = this.tint(new THREE.MeshBasicMaterial({ color: 0x847b6e }));
        cells.forEach(([gx, gy], idx) => {
          const c = cellToWorld(isl, gx, gy);
          if (idx % 3 === 1) {
            const lily = (idx % 2 === 0) ? 'decal_water_lily_white' : 'decal_water_lotus_pink';
            this.addSprite(group, lily, c.x + (idx % 2 ? 0.12 : -0.12), c.z + 0.08, 0.65, { kind: 'env', owner: isl.owner }, { pick: false, y: 0.01 });
          }
          const northEmpty = !tileMap.has(`${gx},${gy - 1}`);
          const southEmpty = !tileMap.has(`${gx},${gy + 1}`);
          if (northEmpty) {
            const ledgeN = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.04, 0.11), bankMat);
            ledgeN.position.set(c.x, Y.WATER + 0.015, c.z - 0.46);
            group.add(ledgeN);
            const mid = Math.floor(S / 2);
            if (!isl.index?.byCell?.get(`${gx},${gy - 1}`) && (gx === mid - 3 || gx === mid + 2 || gx === 2 || gx === S - 3)) {
              const prop = (gx % 2 === 0) ? 'env_river_boulders_a' : 'env_river_cattails';
              this.addSprite(group, prop, c.x, c.z - 0.38, 0.92, { kind: 'env', owner: isl.owner }, { pick: false });
            } else if (!isl.index?.byCell?.get(`${gx},${gy - 1}`) && gx % 3 === 1) {
              this.addSprite(group, 'decal_grass_clover_a', c.x, c.z - 0.44, 0.50, { kind: 'env', owner: isl.owner }, { pick: false });
            }
          }
          if (southEmpty) {
            const ledgeS = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.04, 0.11), bankMat);
            ledgeS.position.set(c.x, Y.WATER + 0.015, c.z + 0.46);
            group.add(ledgeS);
            const mid = Math.floor(S / 2);
            if (!isl.index?.byCell?.get(`${gx},${gy + 1}`) && (gx === mid - 2 || gx === mid + 2 || gx === 1 || gx === S - 2)) {
              const prop = (gx % 2 === 0) ? 'env_river_boulders_b' : 'env_bush_daisies_white';
              this.addSprite(group, prop, c.x, c.z + 0.46, 0.85, { kind: 'env', owner: isl.owner }, { pick: false });
            } else if (!isl.index?.byCell?.get(`${gx},${gy + 1}`) && gx % 3 === 2) {
              this.addSprite(group, 'decal_grass_daisies_b', c.x, c.z + 0.46, 0.50, { kind: 'env', owner: isl.owner }, { pick: false });
            }
          }
          // Canal waterfall at outer island cliff edges
          if (gx === 0 || gx === S - 1) {
            const wx = gx === 0 ? c.x - 0.55 : c.x + 0.55;
            this.addSprite(group, 'cliff_waterfall_strip', wx, c.z + 0.35, 1.35, { kind: 'env', owner: isl.owner }, { pick: false, y: -1.35 });
            this.addSprite(group, 'env_waterfall_mist', wx, c.z + 0.45, 1.45, { kind: 'env', owner: isl.owner }, { pick: false, y: -1.45 });
          }
        });
      }
    }

    // buildings / wonders / decor sprites, back-to-front
    const list = [...v.buildings].sort((a, b) => a.y - b.y);
    for (const b of list) this.addBuildingSprite(group, isl, b, draft);

    // 2.5D Perimeter & Plaza Foliage, Fences, Streetlamps & Sky Clouds
    if (!draft) this.addIslandScenery(group, isl, tileMap);

    // Cloud Territory signpost (own island, while expandable)
    if (isl.owner === this.selfId && !draft) {
      const tier = EXPANSION_TIERS.findIndex((t) => t.size === S);
      if (EXPANSION_TIERS[tier + 1]) {
        this.addSprite(group, 'env_signpost', isl.cx + S / 2 + 1.1, -S / 2 + 2.2, 1.4, { kind: 'signpost', owner: isl.owner });
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          const cloudSprite = i % 2 === 0 ? 'env_cloud_fluffy_a' : 'env_cloud_fluffy_b';
          const cm = this.addSprite(group, cloudSprite, isl.cx + Math.cos(a) * (S / 2 + 4.2), Math.sin(a) * (S / 2 + 4.2) + 1.2, 4.8, { kind: 'cloud', owner: isl.owner }, { pick: false, y: -2.4, opacity: 0.92 });
          cm.userData.lean = false;
          cm.rotation.x = -0.06;
        }
      }
    }
    if (draft?.overlay) this.addEditOverlay(group, isl, draft);
    return entry;
  }

  /** Hand-painted 2.5D overhanging scalloped grass rim & faceted terracotta cliff walls around the floating island (2 merged static draw calls). */
  buildFloatingIslandCliff(group, isl) {
    const S = isl.S, cx = isl.cx, half = S / 2;
    const mergePlanes = (geos) => {
      const out = new THREE.BufferGeometry();
      const pos = [], norm = [], uv = [], idx = [];
      let vOff = 0;
      for (const g of geos) {
        const p = g.attributes.position.array, n = g.attributes.normal.array, u = g.attributes.uv.array, ix = g.index.array;
        for (let i = 0; i < p.length; i++) pos.push(p[i]);
        for (let i = 0; i < n.length; i++) norm.push(n[i]);
        for (let i = 0; i < u.length; i++) uv.push(u[i]);
        for (let i = 0; i < ix.length; i++) idx.push(ix[i] + vOff);
        vOff += g.attributes.position.count;
        g.dispose();
      }
      out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      out.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
      out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      out.setIndex(idx);
      return out;
    };

    const wallMat = this.tint(new THREE.MeshBasicMaterial({ transparent: false, alphaTest: 0.35, side: THREE.FrontSide }));
    const rimMat = this.tint(new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.02, depthWrite: false, side: THREE.FrontSide }));
    loadSprite('cliff_wall_strip').then((s) => { wallMat.map = s.texture; wallMat.needsUpdate = true; });
    loadSprite('cliff_rim_turf_strip').then((s) => { rimMat.map = s.texture; rimMat.needsUpdate = true; });

    // 1. Scalloped overhanging grass, wildflower & rock-tooth rim strips on all 4 sides -> 1 merged static draw call
    const rimCount = 3;
    const rimW = (S + 0.8) / rimCount + 0.55;
    const rimD = 1.55;
    const rimGeos = [];
    for (let i = 0; i < rimCount; i++) {
      const offset = ((i + 0.5) / rimCount - 0.5) * (S - 0.4);
      rimGeos.push(
        new THREE.PlaneGeometry(rimW, rimD).rotateX(-Math.PI / 2).translate(cx + offset, Y.GROUND + 0.006, half + 0.05),
        new THREE.PlaneGeometry(rimW, rimD).rotateX(-Math.PI / 2).rotateY(Math.PI).translate(cx + offset, Y.GROUND + 0.006, -half - 0.05),
        new THREE.PlaneGeometry(rimW, rimD).rotateX(-Math.PI / 2).rotateY(Math.PI / 2).translate(cx + half + 0.08, Y.GROUND + 0.005, offset),
        new THREE.PlaneGeometry(rimW, rimD).rotateX(-Math.PI / 2).rotateY(-Math.PI / 2).translate(cx - half - 0.08, Y.GROUND + 0.005, offset),
      );
    }
    const rimMesh = new THREE.Mesh(mergePlanes(rimGeos), rimMat);
    rimMesh.renderOrder = 2;
    rimMesh.matrixAutoUpdate = false;
    rimMesh.updateMatrix();
    group.add(rimMesh);

    // 2. Front (South) 2.5D faceted terracotta cliff wall -> 1 merged static opaque-pass draw call
    const wallCount = 3;
    const wallW = (S + 0.9) / wallCount + 0.65;
    const wallH = 3.15;
    const wallGeos = [];
    for (let i = 0; i < wallCount; i++) {
      const offset = ((i + 0.5) / wallCount - 0.5) * (S - 0.4);
      wallGeos.push(new THREE.PlaneGeometry(wallW, wallH).rotateX(-0.06).translate(cx + offset, -1.12, half + 0.18 + i * 0.01));
    }
    const wallMesh = new THREE.Mesh(mergePlanes(wallGeos), wallMat);
    wallMesh.matrixAutoUpdate = false;
    wallMesh.updateMatrix();
    group.add(wallMesh);

    // 3. Bottom golden-hour clouds parallel to the cliff face (no plane intersection)
    for (const sx of [-1, 1]) {
      const cb = this.addSprite(group, 'env_cloud_fluffy_b', cx + sx * (half - 2.2), half + 0.65, 4.4, { kind: 'cloud', owner: isl.owner }, { pick: false, y: -2.65, opacity: 0.94, mirror: sx < 0 });
      cb.userData.lean = false;
      cb.rotation.x = -0.06;
    }
  }

  /** Curated 2.5D storybook trees, flower bushes, split-rail stone fences & glowing streetlamps around the island & plaza. */
  addIslandScenery(group, isl, tileMap) {
    const S = isl.S, ox = isl.cx - S / 2, oz = -S / 2, mid = Math.floor(S / 2);
    const isSakura = isl.village.ground === 'ground_sakura';
    const treeA = isSakura ? 'env_tree_sakura_a' : 'env_tree_oak_a';
    const treeB = isSakura ? 'env_tree_sakura_b' : 'env_tree_oak_b';
    const cellFree = (gx, gy) => gx >= 0 && gy >= 0 && gx < S && gy < S && !isl.index?.solid?.[gy * S + gx] && !tileMap.has(`${gx},${gy}`);

    // Perimeter trees along the outer island rim
    const rimTrees = [
      [ox + 1.0, oz - 0.15, treeA, 2.2, false],
      [ox + 4.5, oz - 0.2, 'env_tree_fruit_apple', 2.0, false],
      [ox + S - 4.5, oz - 0.2, 'env_tree_golden_maple', 2.05, true],
      [ox + S - 1.0, oz - 0.15, treeB, 2.2, true],
      [ox - 0.25, oz + 2.8, treeB, 1.95, false],
      [ox - 0.25, oz + S - 2.6, 'env_pine', 1.85, false],
      [ox + S + 0.25, oz + 2.8, treeA, 1.95, true],
      [ox + S + 0.25, oz + S - 2.6, 'env_tree_sakura_a', 1.95, true],
    ];
    for (const [x, z, sprite, w, mirror] of rimTrees) {
      this.addSprite(group, sprite, x, z, w, { kind: 'env', owner: isl.owner }, { pick: false, mirror });
    }
    // Inner framing trees beside the Castle if those cells are open
    if (cellFree(mid - 4, mid - 7)) this.addSprite(group, treeA, ox + mid - 3.5, oz + mid - 6.5, 1.85, { kind: 'env', owner: isl.owner }, { pick: false });
    if (cellFree(mid + 3, mid - 7)) this.addSprite(group, 'env_tree_sakura_a', ox + mid + 3.5, oz + mid - 6.5, 1.85, { kind: 'env', owner: isl.owner }, { pick: false, mirror: true });

    // Outer rim bushes & fences
    const rimProps = [
      [ox + 2.5, oz + 0.1, 'env_bush_mixed_large', 1.15],
      [ox + S - 2.5, oz + 0.1, 'env_bush_roses_pink', 1.1],
      [ox + 3.2, oz + S - 0.15, 'env_fence_wood_stone_straight', 1.25],
      [ox + 4.5, oz + S - 0.15, 'env_bush_daisies_white', 1.0],
      [ox + S - 3.2, oz + S - 0.15, 'env_fence_wood_stone_straight', 1.25],
      [ox + S - 4.5, oz + S - 0.15, 'env_bush_hydrangea_blue', 1.05],
    ];
    for (const [x, z, sprite, w] of rimProps) {
      this.addSprite(group, sprite, x, z, w, { kind: 'env', owner: isl.owner }, { pick: false });
    }

    // Dynamic central plaza flower bushes & wildflower tufts (only on unblocked grass cells)
    const innerCandidates = [
      [mid - 2, mid + 2, 'env_bush_daisies_white', 0.85],
      [mid + 1, mid + 2, 'env_bush_roses_pink', 0.88],
      [mid - 2, mid + 4, 'decal_grass_daisies_b', 0.75],
      [mid + 1, mid + 4, 'decal_grass_clover_a', 0.72],
    ];
    for (const [gx, gy, sprite, w] of innerCandidates) {
      if (cellFree(gx, gy)) {
        const c = cellToWorld(isl, gx, gy);
        this.addSprite(group, sprite, c.x, c.z + 0.2, w, { kind: 'env', owner: isl.owner }, { pick: false });
      }
    }

    // 4-Way Plaza Cobblestone Garden Medallion at the Castle Crossroad
    const crossY = mid - 4;
    if (tileMap.has(`${mid - 1},${crossY}`) && tileMap.has(`${mid},${crossY}`)) {
      const medMat = this.tint(new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.4, depthWrite: false }));
      loadSprite('tile_plaza_cobble_medallion_4way').then((s) => { medMat.map = s.texture; medMat.needsUpdate = true; });
      const med = new THREE.Mesh(new THREE.PlaneGeometry(1.55, 1.55).rotateX(-Math.PI / 2), medMat);
      med.position.set(ox + mid, Y.ROAD + 0.005, oz + crossY + 0.5);
      group.add(med);
    }

    // Properly scaled 2.5D vintage glowing iron streetlamps flanking Castle Plaza & South Promenade
    for (const [gx, gy] of [[mid - 2, mid - 5], [mid + 1, mid - 5], [mid - 2, mid + 1], [mid + 1, mid + 1]]) {
      if (cellFree(gx, gy)) {
        const c = cellToWorld(isl, gx, gy);
        this.addSprite(group, 'env_streetlamp_iron', c.x, c.z + 0.15, 0.44, { kind: 'env', owner: isl.owner }, { pick: false });
      }
    }
  }

  addBuildingSprite(group, isl, b, draft) {
    const d = placeable(b.type);
    if (!d) return;
    const f = footprint(b.type, b.rot);
    const c = cellToWorld(isl, b.x, b.y, f.w, f.h);
    const scalePerTile = d.kind === 'decor' ? DECOR_WIDTH_PER_TILE : SPRITE_WIDTH_PER_TILE;
    const width = Math.max(MIN_BUILDING_SPRITE_WIDTH, Math.max(f.w, f.h) * scalePerTile) * (d.spriteScale || 1);
    const isInvalid = draft?.invalidUids?.has?.(b.uid);
    const ghostState = draft
      ? (isInvalid ? 'bad' : (draft.selected === b.uid ? (draft.valid ? 'ok' : 'bad') : null))
      : null;
    const spriteKey = (b.type === 'castle' && isl.village?.castle_ruins) ? 'bld_castle_ruins' : d.sprite;
    const mesh = this.addSprite(group, spriteKey, c.x, c.z + f.h / 2 - 0.2, width, { kind: 'building', owner: isl.owner, uid: b.uid, type: b.type }, {
      mirror: ((b.rot / 90) | 0) % 2 === 1, ghost: ghostState,
    });
    mesh.userData.footprint = { x: c.x, z: c.z, w: f.w, h: f.h };

    // farm plot crop indicator
    if (b.type === 'farm_plot' && !draft) {
      const plot = isl.village?.plots?.[b.uid];
      if (plot?.crop) {
        const isReady = Number(plot.readyAt || 0) <= Date.now();
        mesh.userData.animMode = isReady ? 'ready' : 'growing';
        const badge = makeCropBadgeSprite(isReady ? '🌾✨' : '⏳', isReady);
        badge.position.set(c.x, 0.75, c.z);
        badge.userData = { kind: 'building', owner: isl.owner, uid: b.uid, type: b.type, x: c.x, z: c.z, height: 0.65, isReady, baseScale: badge.scale.x };
        group.add(badge);
        this.floatingBadges.push(badge);
        this.pickables.push(badge);
      } else if (isl.owner === this.selfId) {
        const badge = makeCropBadgeSprite('🌱', false);
        badge.position.set(c.x, 0.75, c.z);
        badge.userData = { kind: 'building', owner: isl.owner, uid: b.uid, type: b.type, x: c.x, z: c.z, height: 0.65, isReady: false, baseScale: badge.scale.x };
        group.add(badge);
        this.floatingBadges.push(badge);
        this.pickables.push(badge);
      }
    }

    // production ready/working sparkle/badge
    if (!draft && isl.village?.production?.[b.uid]) {
      const st = isl.village.production[b.uid];
      const now = Date.now();
      const hasOutput = Object.values(st?.output || {}).some((n) => n > 0)
        || (st?.tools || []).length > 0
        || (st?.queue || []).some((j) => Number(j?.doneAt || 0) <= now);
      const isWorking = !hasOutput && (st?.queue || []).some((j) => Number(j?.doneAt || 0) > now);
      if (hasOutput || isWorking) {
        mesh.userData.animMode = isWorking ? 'working' : 'ready';
        const info = spriteInfo(spriteKey);
        const bHeight = mesh.userData.height || (width * (info ? info.h / info.w : 1.1));
        const badge = hasOutput ? makeReadyBadgeSprite() : makeCropBadgeSprite('⏳', false);
        badge.position.set(c.x, bHeight * 0.8 + 0.3, c.z);
        badge.userData = { kind: 'building', owner: isl.owner, uid: b.uid, type: b.type, x: c.x, z: c.z, height: bHeight * 0.85, isReady: hasOutput, baseScale: badge.scale.x };
        group.add(badge);
        this.floatingBadges.push(badge);
        this.pickables.push(badge);
      }
    }

    // harvest bubble slot (own island producers + shrine)
    if (isl.owner === this.selfId && !draft && (CORE[b.type]?.produces || CORE[b.type]?.daily)) {
      const kind = CORE[b.type].produces || CORE[b.type].daily;
      const icon = { gold: 'icon_gold', berries: 'icon_berry', diamonds: 'icon_diamond' }[kind];
      const bubble = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, depthTest: false }));
      loadSprite(icon).then((s) => { bubble.material.map = s.texture; bubble.material.needsUpdate = true; });
      bubble.scale.set(0.95, 0.95, 1);
      bubble.renderOrder = 20;
      bubble.visible = false;
      bubble.userData = { kind: 'bubble', owner: isl.owner, uid: b.uid, res: kind, base: new THREE.Vector3(c.x, 0, c.z), height: mesh.userData.height };
      group.add(bubble);
      this.bubbles.push(bubble);
      this.pickables.push(bubble);
    }
  }

  /** Upright sprite plane anchored at its bottom-centre, leaning back to face the camera pitch. */
  addSprite(group, name, x, z, width, data, o = {}) {
    const info = spriteInfo(name);
    const aspect = info ? info.h / info.w : 1;
    const mat = new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.5, depthWrite: true, side: THREE.DoubleSide, opacity: o.opacity ?? 1 });
    if (o.ghost) { mat.color.set(o.ghost === 'ok' ? 0xc8ffc8 : 0xff9a9a); mat.opacity = 0.85; mat.alphaTest = 0.3; }
    else this.tint(mat);
    loadSprite(name).then((s) => { mat.map = s.texture; mat.needsUpdate = true; });
    const geo = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
    const mesh = new THREE.Mesh(geo, mat);
    const baseScaleX = width * (o.mirror ? -1 : 1);
    const baseScaleY = width * aspect;
    mesh.scale.set(baseScaleX, baseScaleY, 1);
    mesh.position.set(x, o.y ?? 0, z);
    mesh.userData = { ...data, height: baseScaleY, baseScaleX, baseScaleY, lean: true };
    group.add(mesh);
    if (o.pick !== false) this.pickables.push(mesh);
    if (this.leanList) this.leanList.push(mesh);
    return mesh;
  }

  /**
   * 8-grid 2.5D Horizontal Rainbow Heart Bridge with the Couple Love Dome in the middle:
   * - Walkable hand-painted pastel rainbow flagstone deck (`bridge_rainbow_deck_strip`) + central balcony medallion
   * - Back heart-cutout stone parapet (`bridge_rainbow_back_rail`) + Couple Love Dome (`dec_love_pavilion`)
   * - Front twin stone arches & heart-cutout parapet with pink-heart lamp pillars (`bridge_rainbow_front_arch`)
   */
  buildBridge(br, { pavilion = true } = {}) {
    const g = new THREE.Group();
    this.root.add(g);
    (this.bridgeGroups ||= []).push(g);
    const len = br.x1 - br.x0, wid = br.z1 - br.z0, midZ = (br.z0 + br.z1) / 2;

    // 1. Central circular stone terrace alcove under the Love Dome
    const terraceMat = this.tint(new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.35, depthWrite: false }));
    loadSprite('decal_plaza_medallion_circle').then((s) => { terraceMat.map = s.texture; terraceMat.needsUpdate = true; });
    const terrace = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.4).rotateX(-Math.PI / 2), terraceMat);
    terrace.position.set(br.cx, Y.BRIDGE - 0.003, br.z0 - 0.15);
    terrace.matrixAutoUpdate = false;
    terrace.updateMatrix();
    g.add(terrace);

    // 2. Hand-painted 2.5D Pastel Rainbow Flagstone Bridge Deck (walkable floor at Y.BRIDGE)
    const deckMat = this.tint(new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.35 }));
    loadSprite('bridge_rainbow_deck_strip').then((s) => { deckMat.map = s.texture; deckMat.needsUpdate = true; });
    const deck = new THREE.Mesh(new THREE.PlaneGeometry(len + 0.65, wid + 0.35).rotateX(-Math.PI / 2), deckMat);
    deck.position.set(br.cx, Y.BRIDGE, midZ);
    deck.matrixAutoUpdate = false;
    deck.updateMatrix();
    g.add(deck);

    // 2b. Sandstone stepping-stone landing aprons where the bridge meets each island
    const stepMat = this.tint(new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.35, depthWrite: false }));
    loadSprite('decal_path_stepping_stones').then((s) => { stepMat.map = s.texture; stepMat.needsUpdate = true; });
    for (const lx of [br.x0 - 0.65, br.x1 + 0.65]) {
      const pad = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.5).rotateX(-Math.PI / 2), stepMat);
      pad.position.set(lx, Y.BRIDGE - 0.002, midZ);
      pad.matrixAutoUpdate = false;
      pad.updateMatrix();
      g.add(pad);
    }

    // 3. Soft golden-hour sky clouds cradling the bridge arches from below
    for (const dx of [-2.2, 2.2]) {
      const cb = this.addSprite(g, 'env_cloud_fluffy_b', br.cx + dx, br.z1 + 0.25, 3.8, { kind: 'cloud' }, { pick: false, y: -1.75, opacity: 0.92, mirror: dx < 0 });
      cb.userData.lean = false;
      cb.rotation.x = -0.06;
    }

    // 4. Couple Love Dome centered in the middle of the bridge + Back heart-cutout stone parapet
    if (pavilion) this.addSprite(g, LOVE_PAVILION.sprite, br.cx, br.z0 - 0.18, 2.75, { kind: 'pavilion' }, { pick: false, y: -0.05 });
    this.addSprite(g, 'bridge_rainbow_back_rail', br.cx, br.z0 + 0.02, len + 0.65, { kind: 'arch_back' }, { pick: false, y: -0.06 });

    // 5. Front twin stone under-arches, heart-cutout parapet & pink-heart lamp pillars
    this.addSprite(g, 'bridge_rainbow_front_arch', br.cx, br.z1 + 0.12, len + 0.65, { kind: 'arch' }, { pick: false, y: -0.78 });
  }

  /**
   * Heart Isle (Master Plan v2 §12): rose-garden ground, dusty-rose deck path joining both bridges, the fixed
   * Love Pavilion + Shared Chest, and the couple's decor. A frozen (Memory) isle renders desaturated.
   */
  buildHeartIsle(group, isl) {
    const S = isl.S, v = isl.village;
    const frozen = !!v.frozen;
    const owner = isl.owner;
    const groundMat = this.tint(new THREE.MeshBasicMaterial({ color: HEART_GROUND }));
    swatch(v.ground || 'biome_rose_garden').then((tex) => { groundMat.map = tex; this.setBase(groundMat, 0xffffff); groundMat.needsUpdate = true; });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(S, S).rotateX(-Math.PI / 2), groundMat);
    const guv = ground.geometry.attributes.uv;
    for (let i = 0; i < guv.count; i++) guv.setXY(i, guv.getX(i) * S / 4, guv.getY(i) * S / 4);
    ground.position.set(isl.cx, Y.GROUND, 0);
    ground.userData = { kind: 'heart_ground', owner };
    group.add(ground);
    this.pickables.push(ground);
    this.buildFloatingIslandCliff(group, isl);

    const pathMat = this.tint(new THREE.MeshBasicMaterial({ color: HEART_PATH }));
    swatch('road_cobble').then((tex) => { pathMat.map = tex; this.setBase(pathMat, 0xf2b9bf); pathMat.needsUpdate = true; });
    group.add(new THREE.Mesh(cellsGeometry(isl, v.tiles.map((t) => [t.x, t.y]), Y.ROAD, 0.5), pathMat));

    // Rim roses + string lights where the deck meets each bridge
    const ox = isl.cx - S / 2, oz = -S / 2;
    for (const [x, z, sprite, w] of [
      [ox + 1.2, oz + 0.2, 'env_bush_roses_pink', 1.1], [ox + S - 1.2, oz + 0.2, 'env_bush_roses_pink', 1.1],
      [ox + 4, oz + S - 0.2, 'env_bush_roses_pink', 1.0], [ox + S - 4, oz + S - 0.2, 'env_bush_roses_pink', 1.0],
      [ox + 0.6, oz + S / 2 + 1.6, 'env_string_lights_post', 0.8], [ox + S - 0.6, oz + S / 2 + 1.6, 'env_string_lights_post', 0.8],
    ]) this.addSprite(group, sprite, x, z, w, { kind: 'env', owner }, { pick: false });

    const list = [...v.buildings].sort((a, b) => a.y - b.y);
    for (const b of list) {
      const w = b.w || 1, h = b.h || 1;
      const c = cellToWorld(isl, b.x, b.y, w, h);
      if (b.type === 'hi_love_pavilion') {
        this.addSprite(group, LOVE_PAVILION.sprite, c.x, c.z + h / 2 - 0.2, 4.2, { kind: 'pavilion', owner }, { pick: false });
      } else if (b.type === 'hi_shared_chest') {
        const chestSprite = spriteInfo('hi_shared_chest') ? 'hi_shared_chest' : 'fish_chest';
        const m = this.addSprite(group, chestSprite, c.x, c.z + 0.3, 1.1, { kind: 'heart_chest', owner, uid: b.uid });
        m.userData.footprint = { x: c.x, z: c.z, w, h };
      } else {
        const sprite = HEART_DECOR_SPRITES[b.type] || 'env_bush_roses_pink';
        const width = Math.max(1.0, Math.max(w, h) * DECOR_WIDTH_PER_TILE);
        const m = this.addSprite(group, sprite, c.x, c.z + h / 2 - 0.2, width, { kind: 'heart_decor', owner, uid: b.uid, type: b.type });
        m.userData.footprint = { x: c.x, z: c.z, w, h };
      }
    }
    if (frozen) group.traverse((o) => { for (const m of [].concat(o.material || [])) desaturate(m); });
  }

  addEditOverlay(group, isl, draft) {
    const S = isl.S, pts = [];
    const ox = isl.cx - S / 2, oz = -S / 2;
    const gridOpacity = draft.quickMove ? 0.22 : 0.35;
    for (let i = 0; i <= S; i++) { pts.push(ox + i, Y.GRID, oz, ox + i, Y.GRID, oz + S, ox, Y.GRID, oz + i, ox + S, Y.GRID, oz + i); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    group.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: gridOpacity })));

    const drawFootprintPad = (b, isOk) => {
      const cells = cellsOf(b);
      const col = isOk ? 0x3ddc84 : 0xff4d4d;
      const m = new THREE.Mesh(cellsGeometry(isl, cells, Y.GHOST), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.52, depthWrite: false }));
      group.add(m);
      const f = footprint(b.type, b.rot);
      const x0 = ox + b.x, z0 = oz + b.y, x1 = x0 + f.w, z1 = z0 + f.h, by = Y.GHOST + 0.008;
      const bPts = [
        x0, by, z0, x1, by, z0,
        x1, by, z0, x1, by, z1,
        x1, by, z1, x0, by, z1,
        x0, by, z1, x0, by, z0,
      ];
      const bGeo = new THREE.BufferGeometry();
      bGeo.setAttribute('position', new THREE.Float32BufferAttribute(bPts, 3));
      group.add(new THREE.LineSegments(bGeo, new THREE.LineBasicMaterial({ color: isOk ? 0xb8ff9e : 0xffb3a8, transparent: true, opacity: 0.95 })));
    };

    const drawn = new Set();
    if (draft.invalidUids?.size) {
      for (const b of isl.village.buildings) {
        if (draft.invalidUids.has(b.uid)) {
          drawFootprintPad(b, false);
          drawn.add(b.uid);
        }
      }
    }
    const sel = draft.selected && isl.village.buildings.find((b) => b.uid === draft.selected);
    if (sel && !drawn.has(sel.uid)) {
      drawFootprintPad(sel, draft.valid);
    }
  }

  // ------------------------------------------------------------------ mood
  tint(mat) { mat.userData.base = mat.color.clone(); this.tintables.add(mat); this.applyTint(mat); return mat; }
  setBase(mat, hex) { (mat.userData.base ||= new THREE.Color()).set(hex); this.applyTint(mat); }
  applyTint(mat) {
    const t = MOOD_TINT[this.mood] || MOOD_TINT.sunny;
    mat.color.copy(mat.userData.base || new THREE.Color(0xffffff)).multiply(new THREE.Color(t[0], t[1], t[2]));
  }
  initWeatherSystem() {
    if (this.weatherPoints) return;
    const count = 60;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 30;
      positions[i * 3 + 1] = 0.5 + Math.random() * 4.5;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 30;
    }
    this.weatherGeo = new THREE.BufferGeometry();
    this.weatherGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.weatherMat = new THREE.PointsMaterial({
      size: 0.36,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
    this.weatherPoints = new THREE.Points(this.weatherGeo, this.weatherMat);
    this.weatherPoints.visible = false;
    this.root.add(this.weatherPoints);
  }

  updateWeatherType(weather) {
    if (!this.weatherPoints) this.initWeatherSystem();
    if (!weather || weather === 'clear') {
      if (this.weatherPoints) this.weatherPoints.visible = false;
      return;
    }
    if (this.weatherPoints) this.weatherPoints.visible = true;
    let mode = 'petal';
    let texture = null;
    let size = 0.36;
    let opacity = 0.85;

    if (weather === 'fireflies' || weather === 'night') {
      mode = 'firefly';
      texture = getWeatherTexture('firefly');
      size = 0.36;
      opacity = 0.95;
      if (this.weatherMat) this.weatherMat.blending = THREE.AdditiveBlending;
    } else if (weather === 'leaf_fall' || weather === 'sunset') {
      mode = 'leaf';
      texture = getWeatherTexture('leaf');
      size = 0.40;
      opacity = 0.9;
      if (this.weatherMat) this.weatherMat.blending = THREE.NormalBlending;
    } else if (weather === 'drizzle' || weather === 'overcast') {
      mode = 'drizzle';
      texture = getWeatherTexture('drizzle');
      size = 0.30;
      opacity = 0.7;
      if (this.weatherMat) this.weatherMat.blending = THREE.NormalBlending;
    } else { // petal_fall, sakura
      mode = 'petal';
      texture = getWeatherTexture('petal');
      size = 0.36;
      opacity = 0.85;
      if (this.weatherMat) this.weatherMat.blending = THREE.NormalBlending;
    }
    this.weatherMode = mode;
    if (this.weatherMat) {
      this.weatherMat.map = texture;
      this.weatherMat.size = size;
      this.weatherMat.opacity = opacity;
      this.weatherMat.needsUpdate = true;
    }
  }

  updateWeather(dt) {
    if (!this.weatherPoints || !this.weatherPoints.visible || !this.weatherGeo) return;
    const pos = this.weatherGeo.attributes.position.array;
    const isl = this.layout?.islands?.[0];
    const cx = isl ? isl.cx : 0;
    const S = isl ? isl.S : 24;
    const minX = cx - S / 2 - 2, maxX = cx + S / 2 + 2;
    const minZ = -S / 2 - 2, maxZ = S / 2 + 2;
    const dtf = Math.min(dt || 0.016, 0.1) * 60;

    const mode = this.weatherMode;
    for (let i = 0; i < 60; i++) {
      const idx = i * 3;
      if (mode === 'firefly') {
        pos[idx] += Math.sin(this.t * 1.5 + i * 1.7) * 0.015 * dtf;
        pos[idx + 1] += Math.cos(this.t * 2.0 + i * 2.3) * 0.01 * dtf;
        pos[idx + 2] += Math.sin(this.t * 1.2 + i * 3.1) * 0.015 * dtf;
        if (pos[idx + 1] < 0.4) pos[idx + 1] = 0.4 + Math.random() * 2.2;
        if (pos[idx + 1] > 3.2) pos[idx + 1] = 1.0 + Math.random();
      } else if (mode === 'leaf') {
        pos[idx] += (0.018 + Math.sin(this.t * 2.5 + i) * 0.02) * dtf;
        pos[idx + 1] -= 0.028 * dtf;
        pos[idx + 2] += Math.cos(this.t * 2.0 + i) * 0.015 * dtf;
        if (pos[idx + 1] < 0.05) {
          pos[idx + 1] = 4.5 + Math.random() * 2.0;
          pos[idx] = minX + Math.random() * (maxX - minX);
          pos[idx + 2] = minZ + Math.random() * (maxZ - minZ);
        }
      } else if (mode === 'drizzle') {
        pos[idx] -= 0.02 * dtf;
        pos[idx + 1] -= 0.14 * dtf;
        pos[idx + 2] += 0.01 * dtf;
        if (pos[idx + 1] < 0.05) {
          pos[idx + 1] = 5.0 + Math.random() * 2.0;
          pos[idx] = minX + Math.random() * (maxX - minX);
          pos[idx + 2] = minZ + Math.random() * (maxZ - minZ);
        }
      } else { // petal
        pos[idx] += (0.02 + Math.sin(this.t * 2.0 + i) * 0.016) * dtf;
        pos[idx + 1] -= 0.022 * dtf;
        pos[idx + 2] += Math.cos(this.t * 1.8 + i) * 0.018 * dtf;
        if (pos[idx + 1] < 0.05) {
          pos[idx + 1] = 4.5 + Math.random() * 2.0;
          pos[idx] = minX + Math.random() * (maxX - minX);
          pos[idx + 2] = minZ + Math.random() * (maxZ - minZ);
        }
      }
      if (pos[idx] > maxX) pos[idx] = minX;
      if (pos[idx] < minX) pos[idx] = maxX;
      if (pos[idx + 2] > maxZ) pos[idx + 2] = minZ;
      if (pos[idx + 2] < minZ) pos[idx + 2] = maxZ;
    }
    this.weatherGeo.attributes.position.needsUpdate = true;
  }

  setMood(mood) {
    let timeKey = 'sunny';
    let weatherKey = null;
    if (typeof mood === 'object' && mood !== null) {
      timeKey = mood.time || mood.mood || 'auto';
      weatherKey = mood.weather || null;
    } else if (typeof mood === 'string') {
      timeKey = mood;
    }
    const m = resolveMood(timeKey);
    this.mood = m;
    this.weather = weatherKey || (
      m === 'sakura' ? 'petal_fall' :
      m === 'sunset' ? 'leaf_fall' :
      m === 'night' ? 'fireflies' : 'clear'
    );
    this.scene.background = skyTexture(m);
    for (const mat of this.tintables) this.applyTint(mat);
    this.updateWeatherType(this.weather);
    return m;
  }
  get moodTint() { return MOOD_TINT[this.mood] || MOOD_TINT.sunny; }

  // ------------------------------------------------------------------ per-frame
  update(dt, camera, pitch) {
    this.t += dt;
    this.updateWeather(dt);
    for (const w of this.water) if (w.material.map) { w.material.map.offset.x = this.t * 0.03; w.material.map.offset.y = Math.sin(this.t * 0.4) * 0.05; }
    const lean = -pitch;
    if (!this.leanList) {
      this.leanList = [];
      this.root.traverse((o) => { if (o.userData?.lean) this.leanList.push(o); });
    }
    for (let i = 0; i < this.leanList.length; i++) {
      const o = this.leanList[i];
      if (!o.userData?.lean) continue;
      o.rotation.x = lean;
      const mode = o.userData.animMode;
      if (mode === 'working' && o.userData.baseScaleX && o.userData.baseScaleY) {
        const chug = Math.sin(this.t * 6.5 + o.position.x * 1.3) * 0.026;
        o.scale.set(o.userData.baseScaleX * (1 + chug), o.userData.baseScaleY * (1 - chug), 1);
        o.rotation.z = Math.sin(this.t * 3.25 + o.position.z) * 0.014;
      } else if (mode === 'ready' && o.userData.baseScaleX && o.userData.baseScaleY) {
        const pulse = Math.sin(this.t * 3.8 + o.position.x) * 0.02;
        o.scale.set(o.userData.baseScaleX * (1 + pulse), o.userData.baseScaleY * (1 + pulse), 1);
        o.rotation.z = 0;
      } else if (mode === 'growing') {
        o.rotation.z = Math.sin(this.t * 2.4 + o.position.x) * 0.018;
      }
    }
    for (const b of this.bubbles) {
      if (!b.visible) continue;
      const h = b.userData.height || 3;
      b.position.set(b.userData.base.x, h * Math.cos(pitch) + 0.5 + Math.sin(this.t * 3 + b.userData.base.x) * 0.12, b.userData.base.z - h * Math.sin(pitch) * 0.5);
    }
    for (const b of this.floatingBadges || []) {
      const h = b.userData.height || 0.6;
      const bx = b.userData.x ?? b.position.x;
      const bz = b.userData.z ?? b.position.z;
      const isReady = !!b.userData.isReady;
      const bob = isReady
        ? Math.abs(Math.sin(this.t * 4.8 + bx * 2)) * 0.15
        : Math.sin(this.t * 3.2 + bx * 2) * 0.07;
      b.position.set(bx, h * Math.cos(pitch) + 0.35 + bob, bz - h * Math.sin(pitch) * 0.4);
      if (b.userData.baseScale) {
        const s = b.userData.baseScale * (isReady ? (1 + Math.sin(this.t * 5.2 + bx) * 0.09) : 1);
        b.scale.set(s, s, 1);
      }
    }
    if (this.world?.editor?.active) {
      this.world.editor.updateFloatingUi();
    }
  }

  /** Show / hide floating harvest bubbles from the shared harvest preview. */
  setBubbles(pv) {
    for (const b of this.bubbles) {
      const r = b.userData.res;
      b.visible = !!pv && pv.ready && ((r === 'gold' && pv.gold > 0) || (r === 'berries' && pv.berries > 0) || (r === 'diamonds' && pv.diamonds > 0));
    }
  }

  /** Screen-space pick of bubbles / buildings / signpost. */
  pick(clientX, clientY) {
    const r = this.world.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.world.camera);
    const vis = this.pickables.filter((p) => p.visible !== false);
    const hits = ray.intersectObjects(vis, false);
    // bubbles always win, then the nearest opaque-ish hit
    const bubble = hits.find((h) => h.object.userData.kind === 'bubble');
    if (bubble) return bubble.object.userData;
    for (const h of hits) {
      const tex = h.object.material.map;
      if (!tex?.image || !h.uv) return h.object.userData;
      if (alphaAt(tex.image, h.uv.x, h.uv.y, h.object.scale.x < 0) > 0.3) return h.object.userData;
    }
    return null;
  }
}

const alphaCanvas = new WeakMap();
function alphaAt(img, u, v, mirrored) {
  let c = alphaCanvas.get(img);
  if (!c) {
    try {
      const cv = document.createElement('canvas'); cv.width = Math.min(256, img.width); cv.height = Math.round(cv.width * img.height / img.width);
      const g = cv.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, cv.width, cv.height);
      c = { g, w: cv.width, h: cv.height };
    } catch { return 1; }
    alphaCanvas.set(img, c);
  }
  const x = Math.min(c.w - 1, Math.max(0, Math.floor((mirrored ? 1 - u : u) * c.w)));
  const y = Math.min(c.h - 1, Math.max(0, Math.floor((1 - v) * c.h)));
  return c.g.getImageData(x, y, 1, 1).data[3] / 255;
}

// =================================================================================================
// Grid Editor (Screen 01 Inline Quick-Move & Screen 02 Kingdom Grid Editor)
// =================================================================================================
const TAB_ITEMS = {
  buildings: () => Object.keys(CORE),
  wonders: () => Object.keys(WONDERS),
  decor: () => Object.keys(DECOR),
  tiles: () => [...Object.keys(TILES), 'erase'],
  skins: () => Object.keys(GROUND_SKINS),
};

function shortBuffLabel(key, d) {
  if (!d) return '';
  if (key === 'castle') return '👑 +2% Yield/Lv';
  if (d.produces === 'gold') return `🪙 +${d.perHour(1)}/hr • +100🌸`;
  if (d.produces === 'berries') return `🍓 +${d.perHour(1)}/hr • +100🌸`;
  if (d.daily === 'diamonds') return `💎 +${d.perDay(1)}/day • +100🌸`;
  if (key === 'nest') return '🥚 Pet Odds • +100🌸';
  if (key === 'dock') return '🎣 Storage+Fish • +100🌸';
  if (d.kind === 'wonder') {
    if (d.matchYieldPct) return `🪙 +${d.matchYieldPct(1)}% Yield • +300🌸`;
    if (d.blacksmithPct) return `🔨 +${d.blacksmithPct(1)}% Forge • +300🌸`;
    if (d.perDay) return `💎 +${d.perDay(1)}/day • +300🌸`;
    if (key === 'wnd_fountain') return '⛲ Daily Wish • +300🌸';
    return '✨ VIP Buff • +300🌸';
  }
  if (d.kind === 'decor') {
    const b = d.buff || {};
    if (b.goldPct) return `🪙 +${b.goldPct}% Gold • +120🌸`;
    if (b.berriesPct) return `🍓 +${b.berriesPct}% Berry • +120🌸`;
    if (b.luckPct) return `🍀 +${b.luckPct}% Luck • +120🌸`;
    if (b.fortunePct) return `✨ +${b.fortunePct}% Fortune • +120🌸`;
    if (b.swiftnessPct) return `⚡ +${b.swiftnessPct}% Speed • +120🌸`;
    if (b.traitLuckPct) return `🐾 +${b.traitLuckPct}% Pet Luck • +120🌸`;
    if (b.storagePct) return `📦 +${b.storagePct}% Cap • +120🌸`;
    return `👍 +${120 + (b.comfortBonus || 0)} Comfort`;
  }
  return '';
}

export class GridEditor {
  /**
   * @param plaza VillagePlaza
   * @param ui { onSave(layout) => Promise<{ok,error}>, onExit(saved), onPromoteToFull(), toast(msg) }
   */
  constructor(plaza, ui) {
    this.plaza = plaza;
    this.ui = ui;
    this.active = false;
    this.quickMode = false;
    this.unplacedOnly = false;
    this.drawerCollapsed = false;
    this.mode = 'drag';
    this.tab = 'buildings';
    this.paintTile = 'road_cobble';
    this.selected = null;
    this.drag = null;
    this.undo = [];
    this.$ = (id) => document.getElementById(id);
    this.bindDom();
  }

  bindDom() {
    const $ = this.$;
    $('ed-undo').onclick = () => this.popUndo();
    $('ed-store').onclick = () => {
      // Keep Castle on the island since Castle is unique & required, store everything else in bag
      this.pushUndo();
      const castle = this.draft.buildings.find((b) => b.type === 'castle');
      this.draft.buildings = castle ? [castle] : [];
      this.selected = null;
      this.ui.toast?.('🧹 Stored landmarks, Wonders & decor into your Bag!');
      this.refresh();
    };
    $('ed-save').onclick = () => this.save();
    $('ed-exit').onclick = () => this.close(true);
    $('ed-mode').onclick = () => this.setMode(this.mode === 'drag' ? 'paint' : 'drag');
    $('ed-confirm').onclick = () => {
      const val = this.validation();
      const inv = this.findInvalidBuildingUids();
      if (!val.ok) {
        const badUid = (this.selected && inv.has(this.selected)) ? this.selected : [...inv][0];
        if (badUid) {
          this.selected = badUid;
          this.focusOnBuilding(badUid);
          this.refresh();
        }
        this.ui.toast?.(`✕ Move or Put in Bag first: ${humanError(val.error)}`);
        return;
      }
      this.selected = null;
      this.refresh();
    };
    $('ed-rotate').onclick = () => this.rotateSelected();
    $('ed-bag').onclick = () => this.bagSelected();
    if ($('ed-status')) {
      $('ed-status').style.pointerEvents = 'auto';
      $('ed-status').style.cursor = 'pointer';
      $('ed-status').onclick = () => {
        const inv = [...this.findInvalidBuildingUids()];
        if (inv.length) {
          const idx = inv.indexOf(this.selected);
          const nextUid = inv[(idx + 1) % inv.length];
          this.selected = nextUid;
          this.focusOnBuilding(nextUid);
          this.refresh();
        }
      };
    }

    // Filter bar & drawer collapse (Mockup 02)
    if ($('ed-filter-all')) {
      $('ed-filter-all').onclick = () => {
        this.unplacedOnly = false;
        this.syncFilterBar();
        this.renderDrawer();
      };
    }
    if ($('ed-filter-unplaced')) {
      $('ed-filter-unplaced').onclick = () => {
        this.unplacedOnly = !this.unplacedOnly;
        this.syncFilterBar();
        this.renderDrawer();
      };
    }
    if ($('ed-drawer-collapse')) {
      $('ed-drawer-collapse').onclick = () => {
        this.drawerCollapsed = !this.drawerCollapsed;
        $('ed-drawer')?.classList.toggle('collapsed', this.drawerCollapsed);
        $('ed-drawer-collapse').textContent = this.drawerCollapsed ? '▴' : '▾';
      };
    }

    // Inline Quick-Move bar (Mockup 01)
    if ($('qm-place')) $('qm-place').onclick = () => this.save();
    if ($('qm-rotate')) $('qm-rotate').onclick = () => this.rotateSelected();
    if ($('qm-bag')) {
      $('qm-bag').onclick = async () => {
        const b = this.draft?.buildings?.find((q) => q.uid === this.selected);
        if (b?.type === 'castle') {
          this.ui.toast?.('🏰 Your Grand Starlight Castle stays anchored on the island!');
          return;
        }
        this.bagSelected();
        await this.save();
      };
    }
    if ($('qm-full')) {
      $('qm-full').onclick = () => {
        this.quickMode = false;
        if ($('quick-move-ui')) $('quick-move-ui').hidden = true;
        this.ui.onPromoteToFull?.();
        this.refresh();
      };
    }
    if ($('qm-cancel')) $('qm-cancel').onclick = () => this.close(true);

    document.querySelectorAll('#ed-tabs [data-tab]').forEach((b) => {
      b.onclick = () => {
        this.tab = b.dataset.tab;
        if (this.drawerCollapsed) {
          this.drawerCollapsed = false;
          $('ed-drawer')?.classList.remove('collapsed');
          if ($('ed-drawer-collapse')) $('ed-drawer-collapse').textContent = '▾';
        }
        if (this.tab === 'tiles' && this.mode !== 'paint') this.setMode('paint');
        else if (this.tab !== 'tiles' && this.mode === 'paint') this.setMode('drag');
        else this.renderDrawer();
      };
    });
  }

  syncFilterBar() {
    const $ = this.$;
    $('ed-filter-all')?.classList.toggle('active', !this.unplacedOnly);
    $('ed-filter-unplaced')?.classList.toggle('active', this.unplacedOnly);
    $('ed-filter-unplaced')?.setAttribute('aria-pressed', String(this.unplacedOnly));
  }

  get village() { return this.plaza.selfIsland.village; }

  /** Automatically strip non-water/non-bridge road tiles underneath placed buildings so roads never block moving buildings. */
  effectiveTiles() {
    if (!this.draft) return [];
    const bCells = new Set();
    for (const b of this.draft.buildings) {
      for (const [cx, cy] of cellsOf(b)) bCells.add(`${cx},${cy}`);
    }
    return this.draft.tiles.filter((t) => {
      const td = TILES[t.t];
      if (td && !td.water && !td.bridge && bCells.has(`${t.x},${t.y}`)) return false;
      return true;
    });
  }

  /** Identify all buildings currently in an invalid position (overlapping, out-of-bounds, on water, or Dock away from water). */
  findInvalidBuildingUids() {
    const bad = new Set();
    if (!this.draft || !this.base) return bad;
    const S = this.base.grid_size || 18;
    const cellOwner = new Map();
    const effTiles = this.effectiveTiles();
    const waterOrBridgeCells = new Set(effTiles.map((t) => `${t.x},${t.y}`));
    const waterCells = new Set(effTiles.filter((t) => TILES[t.t]?.water || TILES[t.t]?.bridge).map((t) => `${t.x},${t.y}`));
    const landing = this.plaza?.layout?.bridge
      ? new Set(landingCells(S, this.plaza.selfIsland?.side || 'left').map(([x, y]) => `${x},${y}`))
      : null;

    for (const b of this.draft.buildings) {
      const d = placeable(b.type);
      if (!d) { bad.add(b.uid); continue; }
      const f = footprint(b.type, b.rot);
      if (b.x < 0 || b.y < 0 || b.x + f.w > S || b.y + f.h > S) bad.add(b.uid);
      for (const [cx, cy] of cellsOf(b)) {
        const k = `${cx},${cy}`;
        if (cellOwner.has(k)) {
          bad.add(b.uid);
          bad.add(cellOwner.get(k));
        } else {
          cellOwner.set(k, b.uid);
        }
        if (waterOrBridgeCells.has(k)) bad.add(b.uid);
        if (landing && landing.has(k)) bad.add(b.uid);
      }
      if (d.needsWater) {
        const touchesEdge = b.x === 0 || b.y === 0 || b.x + f.w === S || b.y + f.h === S;
        let touchesWater = touchesEdge;
        if (!touchesWater) {
          for (const [cx, cy] of cellsOf(b)) {
            if (waterCells.has(`${cx + 1},${cy}`) || waterCells.has(`${cx - 1},${cy}`)
              || waterCells.has(`${cx},${cy + 1}`) || waterCells.has(`${cx},${cy - 1}`)) {
              touchesWater = true; break;
            }
          }
        }
        if (!touchesWater) bad.add(b.uid);
      }
    }
    return bad;
  }

  /** Draft village = saved village with the draft's buildings / tiles / ground (for validation + comfort). */
  draftVillage() {
    const tiles = this.effectiveTiles();
    return { ...this.base, buildings: this.draft.buildings, tiles, ground: this.draft.ground };
  }

  open({ quickUid = null, selectUid = null, placeType = null } = {}) {
    const v = this.village;
    this.base = JSON.parse(JSON.stringify(v));
    this.draft = { buildings: v.buildings.map(({ uid, type, x, y, rot }) => ({ uid, type, x, y, rot })), tiles: v.tiles.map((t) => ({ ...t })), ground: v.ground };
    this.undo = [];
    this.quickMode = !!quickUid;
    this.selected = quickUid || selectUid || null;
    this.active = true;
    this.drawerCollapsed = false;
    this.$('ed-drawer')?.classList.remove('collapsed');
    if (this.$('ed-drawer-collapse')) this.$('ed-drawer-collapse').textContent = '▾';
    this.setMode('drag');
    if (placeType && bagContents(this.draftVillage(), this.draft.buildings)[placeType] > 0) {
      if (CORE[placeType]) this.tab = 'buildings';
      else if (WONDERS[placeType]) this.tab = 'wonders';
      else if (DECOR[placeType]) this.tab = 'decor';
      this.placeFromBag(placeType);
      return;
    }
    if (this.selected) this.focusOnBuilding(this.selected);
    this.refresh();
  }

  focusOnBuilding(uid) {
    const isl = this.plaza.selfIsland;
    const b = this.draft?.buildings?.find((q) => q.uid === uid);
    if (!isl || !b) return;
    const f = footprint(b.type, b.rot);
    const c = cellToWorld(isl, b.x, b.y, f.w, f.h);
    this.plaza.world.camTarget.set(c.x, 0, c.z + 1.2);
    this.plaza.world.followDetached = true;
  }

  close(discard = false) {
    if (!this.active) return;
    this.active = false;
    this.quickMode = false;
    this.selected = null;
    if (this.$('quick-move-ui')) this.$('quick-move-ui').hidden = true;
    if (this.$('ed-select')) this.$('ed-select').hidden = true;
    if (this.$('ed-footprint-tag')) this.$('ed-footprint-tag').hidden = true;
    if (discard) this.plaza.setVillage(this.plaza.selfId, this.base);
    this.ui.onExit?.(false);
  }

  setMode(m) {
    this.mode = m;
    if (this.$('ed-mode')) {
      this.$('ed-mode').textContent = m === 'drag' ? '📍 Drag' : '🖌️ Paint';
      this.$('ed-mode').classList.toggle('paint', m === 'paint');
    }
    if (m === 'paint') { this.selected = null; this.tab = 'tiles'; }
    this.refresh();
  }

  pushUndo() { this.undo.push(JSON.stringify(this.draft)); if (this.undo.length > 60) this.undo.shift(); }
  popUndo() { const s = this.undo.pop(); if (s) { this.draft = JSON.parse(s); this.selected = null; this.refresh(); } }

  validation() {
    const dv = this.draftVillage();
    return validateLayout(dv, { ...this.draft, tiles: dv.tiles }, {
      coupled: !!this.plaza?.layout?.bridge,
      side: this.plaza?.selfIsland?.side || 'left',
    });
  }

  refresh() {
    if (!this.active) return;
    const $ = this.$;
    const isl = this.plaza.selfIsland;
    const val = this.validation();
    const invalidUids = this.findInvalidBuildingUids();
    this.valid = val.ok;
    if (!val.ok && !this.selected && invalidUids.size > 0) {
      this.selected = [...invalidUids][0];
    }
    const dv = { ...this.draftVillage(), buildings: this.draft.buildings.map((b) => ({ ...b })) };
    this.plaza.setVillage(this.plaza.selfId, dv, {
      draft: { overlay: true, quickMove: this.quickMode, selected: this.selected, valid: val.ok, invalidUids },
    });

    if (this.quickMode) {
      if ($('quick-move-ui')) $('quick-move-ui').hidden = !this.selected;
      if ($('qm-place')) $('qm-place').disabled = !val.ok;
      this.updateFloatingUi();
      return;
    }

    if ($('quick-move-ui')) $('quick-move-ui').hidden = true;
    const comfort = computeComfort(dv);
    if ($('ed-grid-title') && isl) {
      $('ed-grid-title').textContent = `🏰 Kingdom Grid Editor (${isl.S}×${isl.S} Tiles)`;
    }
    if ($('ed-comfort')) {
      $('ed-comfort').textContent = `🌸 Comfort Score: ${comfort.toLocaleString('en-US')} (+${comfortBonusPct(comfort)}% Yield)`;
    }
    if ($('ed-save')) $('ed-save').disabled = !val.ok;
    if ($('ed-status')) $('ed-status').textContent = val.ok ? '' : `✕ Blocked: ${humanError(val.error)}`;
    if ($('ed-select')) $('ed-select').hidden = !this.selected;
    if ($('ed-footprint-tag')) $('ed-footprint-tag').hidden = !this.selected;

    this.updateFloatingUi();
    this.renderDrawer();
  }

  /** Dynamically anchor the speech bubble (#ed-select or #qm-bar) & footprint pill in 3D screen space above the selected building. */
  updateFloatingUi() {
    const $ = this.$;
    const isl = this.plaza.selfIsland;
    const world = this.plaza.world;
    if (!this.active || !this.selected || !isl || !world) {
      if ($('ed-select')) $('ed-select').hidden = true;
      if ($('ed-footprint-tag')) $('ed-footprint-tag').hidden = true;
      if ($('quick-move-ui')) $('quick-move-ui').hidden = true;
      return;
    }
    const b = this.draft.buildings.find((q) => q.uid === this.selected);
    if (!b) {
      if ($('ed-select')) $('ed-select').hidden = true;
      if ($('ed-footprint-tag')) $('ed-footprint-tag').hidden = true;
      if ($('quick-move-ui')) $('quick-move-ui').hidden = true;
      return;
    }
    const d = placeable(b.type);
    const f = footprint(b.type, b.rot);
    const c = cellToWorld(isl, b.x, b.y, f.w, f.h);
    const scalePerTile = d?.kind === 'decor' ? DECOR_WIDTH_PER_TILE : SPRITE_WIDTH_PER_TILE;
    const width = Math.max(MIN_BUILDING_SPRITE_WIDTH, Math.max(f.w, f.h) * scalePerTile);
    const info = spriteInfo(d?.sprite);
    const aspect = info ? info.h / info.w : 1;
    const sprH = width * aspect;

    const appRect = document.getElementById('app').getBoundingClientRect();
    const topScreen = world.worldToScreen(c.x, sprH * 0.85 + 0.55, c.z);
    const footScreen = world.worldToScreen(c.x, 0.06, c.z + f.h / 2 + 0.22);

    const clampX = (px, margin = 110) => Math.max(margin, Math.min(appRect.width - margin, px - appRect.left));
    const drawerH = this.quickMode ? 84 : (this.drawerCollapsed ? 96 : 256);
    const topMinY = this.quickMode ? 88 : (this.valid ? 156 : 184);
    const clampY = (py) => Math.max(topMinY, Math.min(appRect.height - drawerH - 12, py - appRect.top));

    const invUids = this.findInvalidBuildingUids();
    const thisValid = this.valid && !invUids.has(b.uid);
    const labelTxt = thisValid ? `${f.w}×${f.h} Tiles` : `✕ Blocked (${f.w}×${f.h})`;

    if (this.quickMode) {
      const qmBar = $('qm-bar');
      const qmFoot = $('qm-footprint');
      if (qmBar) {
        qmBar.style.left = `${clampX(topScreen.x, 128)}px`;
        qmBar.style.top = `${clampY(topScreen.y)}px`;
      }
      if (qmFoot) {
        qmFoot.textContent = labelTxt;
        qmFoot.classList.toggle('bad', !thisValid);
        qmFoot.style.left = `${clampX(footScreen.x, 54)}px`;
        qmFoot.style.top = `${Math.max(96, Math.min(appRect.height - 80, footScreen.y - appRect.top))}px`;
      }
      return;
    }

    const selEl = $('ed-select');
    const footEl = $('ed-footprint-tag');
    if (selEl && !selEl.hidden) {
      selEl.style.left = `${clampX(topScreen.x, 118)}px`;
      selEl.style.top = `${clampY(topScreen.y)}px`;
    }
    if (footEl && !footEl.hidden) {
      footEl.textContent = labelTxt;
      footEl.classList.toggle('bad', !thisValid);
      footEl.style.left = `${clampX(footScreen.x, 54)}px`;
      footEl.style.top = `${Math.max(106, Math.min(appRect.height - drawerH + 14, footScreen.y - appRect.top))}px`;
    }
  }

  renderDrawer() {
    const $ = this.$;
    document.querySelectorAll('#ed-tabs [data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === this.tab));
    const dv = this.draftVillage();
    const bag = bagContents(dv, this.draft.buildings);
    const caps = buildingCaps(dv.castle_lv || 1);

    // Update live tab badges (Mockup 02: Buildings 5/5, Wonders 2/3, Cute Decor 📦4)
    const placedCore = this.draft.buildings.filter((b) => CORE[b.type] && b.type !== 'castle').length;
    const placedWonders = this.draft.buildings.filter((b) => WONDERS[b.type]).length;
    const bagDecorCount = Object.keys(DECOR).reduce((sum, k) => sum + (bag[k] || 0), 0);
    const totalUnplaced = Object.values(bag).reduce((sum, n) => sum + (n || 0), 0);

    if ($('ed-cnt-buildings')) $('ed-cnt-buildings').textContent = `${placedCore}/${caps.core}`;
    if ($('ed-cnt-wonders')) $('ed-cnt-wonders').textContent = `${placedWonders}/${caps.wonders}`;
    if ($('ed-cnt-decor')) $('ed-cnt-decor').textContent = bagDecorCount > 0 ? `📦${bagDecorCount}` : `${this.draft.buildings.filter((b) => DECOR[b.type]).length}`;
    if ($('ed-unplaced-cnt')) $('ed-unplaced-cnt').textContent = `(${totalUnplaced})`;
    this.syncFilterBar();

    const box = $('ed-items');
    if (!box) return;
    box.innerHTML = '';

    const selectedBuilding = this.selected ? this.draft.buildings.find((b) => b.uid === this.selected) : null;

    for (const key of TAB_ITEMS[this.tab]()) {
      if (this.tab === 'tiles') {
        const d = TILES[key];
        const isAct = this.mode === 'paint' && this.paintTile === key;
        const el = document.createElement('button');
        el.type = 'button';
        el.className = `ed-item${isAct ? ' active' : ''}`;
        const buffTxt = d?.road ? '⚡ +15% Walk Speed' : d?.water ? '💧 Canal Brook' : d?.bridge ? '🌉 Water Crossing' : '🧽 Clear Tile';
        el.innerHTML = `
          <div class="ed-card-title">${d ? d.name : 'Tile Eraser'}</div>
          <div class="ed-card-thumb">${d?.sprite ? `<img src="/assets/terrain/${d.sprite}.png" alt="">` : `<span class="em">🧽</span>`}</div>
          <span class="ed-card-grid">1×1 Tile</span>
          <span class="ed-card-status ${isAct ? 'placing' : ''}">${isAct ? '🟡 Painting...' : '∞ Unlimited'}</span>
          <span class="ed-card-buff">${buffTxt}</span>
          <span class="ed-card-cta paint">🖌️ Paint</span>
        `;
        el.onclick = () => { this.paintTile = key; this.setMode('paint'); };
        box.appendChild(el);
        continue;
      }

      if (this.tab === 'skins') {
        const d = GROUND_SKINS[key];
        const isAct = this.draft.ground === key;
        const el = document.createElement('button');
        el.type = 'button';
        el.className = `ed-item${isAct ? ' active' : ''}`;
        el.innerHTML = `
          <div class="ed-card-title">${d.name}</div>
          <div class="ed-card-thumb"><img src="/assets/terrain/${key}.png" alt=""></div>
          <span class="ed-card-grid">Island Skin</span>
          <span class="ed-card-status ${isAct ? 'placed' : ''}">${isAct ? '✓ Active Skin' : '📦 Unlocked'}</span>
          <span class="ed-card-buff">${d.emoji} Full Island Turf</span>
          <span class="ed-card-cta ${isAct ? 'locate' : ''}">${isAct ? '✓ Applied' : '🎨 Apply'}</span>
        `;
        el.onclick = () => { this.pushUndo(); this.draft.ground = key; this.refresh(); };
        box.appendChild(el);
        continue;
      }

      const d = placeable(key);
      if (!d) continue;
      const n = bag[key] || 0;
      const placedList = this.draft.buildings.filter((b) => b.type === key);
      const placed = placedList.length;
      const owned = n + placed;

      if (this.unplacedOnly && n <= 0) continue;

      const isPlacingThis = selectedBuilding?.type === key;
      const el = document.createElement('button');
      el.type = 'button';
      el.className = `ed-item${isPlacingThis ? ' active' : ''}${!owned ? ' locked' : ''}`;

      let statusHtml = '';
      let ctaHtml = '';
      if (isPlacingThis) {
        statusHtml = `<span class="ed-card-status placing">🟡 Selected${placed > 1 ? ` (${placedList.findIndex((b) => b.uid === this.selected) + 1}/${placed})` : ''}</span>`;
        ctaHtml = `<span class="ed-card-cta">${placed > 1 ? '🔍 Next Copy' : (n > 0 ? `📦 +1 (${n})` : '📍 Moving')}</span>`;
      } else if (n > 0) {
        statusHtml = `<span class="ed-card-status">📦 In Bag: x${n}${placed > 0 ? ` • ✓${placed}` : ''}</span>`;
        ctaHtml = `<span class="ed-card-cta">📍 Place</span>`;
      } else if (placed > 0) {
        statusHtml = `<span class="ed-card-status placed">✓ Placed (${placed})</span>`;
        ctaHtml = `<span class="ed-card-cta locate">🔍 Select</span>`;
      } else {
        statusHtml = `<span class="ed-card-status">🔒 Unowned</span>`;
        ctaHtml = `<span class="ed-card-cta">🧭 Box 2</span>`;
      }

      el.innerHTML = `
        <div class="ed-card-title">${d.name}</div>
        <div class="ed-card-thumb"><img src="/assets/village/${d.sprite}.png" alt=""></div>
        <span class="ed-card-grid">${d.w}×${d.h} Grid</span>
        ${statusHtml}
        <span class="ed-card-buff">${shortBuffLabel(key, d)}</span>
        ${ctaHtml}
      `;

      el.onclick = () => {
        if (isPlacingThis && placed > 1) {
          if (this.mode !== 'drag') this.setMode('drag');
          const idx = placedList.findIndex((b) => b.uid === this.selected);
          const target = placedList[(idx + 1) % placedList.length];
          this.selected = target.uid;
          this.focusOnBuilding(target.uid);
          this.refresh();
        } else if (n > 0) {
          this.placeFromBag(key);
        } else if (placed > 0) {
          // Select & pan camera to the placed building on the island (cycling through copies if multiple)!
          if (this.mode !== 'drag') this.setMode('drag');
          const idx = placedList.findIndex((b) => b.uid === this.selected);
          const target = placedList[(idx + 1) % placedList.length];
          this.selected = target.uid;
          this.focusOnBuilding(target.uid);
          this.refresh();
        } else {
          this.ui.toast?.(`🧭 Pull ${d.name} in Box 2: Royal Architect Gacha or Shard Shop!`);
        }
      };
      box.appendChild(el);
    }

    if (!box.children.length) {
      const empty = document.createElement('div');
      empty.style.cssText = 'margin:auto; font:800 12px var(--font); color:#6e4119; text-align:center; padding:12px;';
      empty.textContent = '📦 All owned items in this category are already placed on your island!';
      box.appendChild(empty);
    }
  }

  // ------------------------------------------------------------------ placement helpers
  cellAt(hit) {
    const isl = this.plaza.selfIsland;
    if (!hit || islandAt(this.plaza.layout, hit.x, hit.z) !== isl) return null;
    return worldToCell(isl, hit.x, hit.z);
  }

  buildingsAtCell(gx, gy) {
    const list = [];
    for (let i = this.draft.buildings.length - 1; i >= 0; i--) {
      const b = this.draft.buildings[i];
      if (cellsOf(b).some(([x, y]) => x === gx && y === gy)) list.push(b);
    }
    return list;
  }

  buildingAtCell(gx, gy) {
    const list = this.buildingsAtCell(gx, gy);
    if (!list.length) return null;
    if (list.length > 1 && this.selected) {
      const idx = list.findIndex((b) => b.uid === this.selected);
      if (idx >= 0) return list[(idx + 1) % list.length];
    }
    return list[0];
  }

  /** Mobile thumb halo: if a building is already selected, allow grabbing within 1 tile of its footprint on empty cells. */
  selectedNearCell(gx, gy) {
    if (!this.selected) return null;
    const b = this.draft.buildings.find((q) => q.uid === this.selected);
    if (!b) return null;
    const f = footprint(b.type, b.rot);
    if (gx >= b.x - 1 && gx <= b.x + f.w && gy >= b.y - 1 && gy <= b.y + f.h) return b;
    return null;
  }

  placeFromBag(type) {
    if (this.mode !== 'drag') this.setMode('drag');
    const isl = this.plaza.selfIsland;
    const t = this.plaza.world.camTarget;
    const start = worldToCell(isl, t.x, t.z);
    const f = footprint(type, 0);
    this.pushUndo();
    const b = { uid: `${type}_${Date.now().toString(36)}`, type, x: 0, y: 0, rot: 0 };
    this.draft.buildings.push(b);
    // spiral search for the nearest valid spot around the camera centre
    let best = null;
    for (let r = 0; r < isl.S && !best; r++) {
      for (let dy = -r; dy <= r && !best; dy++) for (let dx = -r; dx <= r && !best; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        b.x = Math.max(0, Math.min(isl.S - f.w, start.gx + dx - (f.w >> 1)));
        b.y = Math.max(0, Math.min(isl.S - f.h, start.gy + dy - (f.h >> 1)));
        if (this.validation().ok) best = { x: b.x, y: b.y };
      }
    }
    if (!best) { b.x = Math.max(0, Math.min(isl.S - f.w, start.gx)); b.y = Math.max(0, Math.min(isl.S - f.h, start.gy)); }
    this.selected = b.uid;
    this.focusOnBuilding(b.uid);
    this.refresh();
  }

  rotateSelected() {
    const b = this.draft.buildings.find((q) => q.uid === this.selected);
    if (!b) return;
    this.pushUndo();
    b.rot = (b.rot + 90) % 360;
    const f = footprint(b.type, b.rot), S = this.plaza.selfIsland.S;
    b.x = Math.max(0, Math.min(b.x, S - f.w));
    b.y = Math.max(0, Math.min(b.y, S - f.h));
    this.refresh();
  }

  bagSelected() {
    const i = this.draft.buildings.findIndex((q) => q.uid === this.selected);
    if (i < 0) return;
    if (this.draft.buildings[i].type === 'castle') {
      this.ui.toast?.('🏰 Your Grand Starlight Castle stays anchored on the island!');
      return;
    }
    this.pushUndo();
    this.draft.buildings.splice(i, 1);
    const inv = this.findInvalidBuildingUids();
    this.selected = inv.size > 0 ? [...inv][0] : null;
    this.refresh();
  }

  paintAt(cell) {
    if (!cell) return;
    const { gx, gy } = cell;
    if (this.buildingAtCell(gx, gy)) return;
    const i = this.draft.tiles.findIndex((t) => t.x === gx && t.y === gy);
    const cur = i >= 0 ? this.draft.tiles[i].t : null;
    let next = this.paintTile === 'erase' ? null : this.paintTile;
    if (next === 'bridge' && cur !== 'water' && cur !== 'bridge') { this.ui.toast?.('🌉 Footbridges go on water tiles'); return; }
    if (cur === next) return;
    if (!this.strokeUndo) { this.pushUndo(); this.strokeUndo = true; }
    if (i >= 0) this.draft.tiles.splice(i, 1);
    if (next) this.draft.tiles.push({ x: gx, y: gy, t: next });
    this.refresh();
  }

  // ------------------------------------------------------------------ pointer (called by WorldEngine)
  /** @returns true if the editor consumed the gesture (otherwise the world pans the camera). */
  pointerDown(hit, picked = null) {
    const cell = this.cellAt(hit);
    if (this.mode === 'paint') { this.strokeUndo = false; this.paintAt(cell); return !!cell; }
    const pickedBuilding = (picked?.kind === 'building' && picked.owner === this.plaza.selfId)
      ? this.draft.buildings.find((q) => q.uid === picked.uid)
      : null;
    if (!cell && !pickedBuilding) return false;
    // Priority: 1. Exact footprint cell hit -> 2. 2.5D upright sprite hit -> 3. 1-tile thumb halo on empty grass
    const b = (cell && this.buildingAtCell(cell.gx, cell.gy))
      || pickedBuilding
      || (cell && this.selectedNearCell(cell.gx, cell.gy));
    if (!b) {
      if (!this.quickMode && this.selected) {
        const inv = this.findInvalidBuildingUids();
        if (!inv.has(this.selected)) {
          this.selected = inv.size > 0 ? [...inv][0] : null;
          this.refresh();
        }
      }
      return false;
    }
    this.pushUndo();
    this.selected = b.uid;
    const f = footprint(b.type, b.rot);
    const gx = cell ? cell.gx : b.x + (f.w >> 1);
    const gy = cell ? cell.gy : b.y + (f.h >> 1);
    const offX = Math.max(0, Math.min(f.w - 1, gx - b.x));
    const offY = Math.max(0, Math.min(f.h - 1, gy - b.y));
    this.drag = { uid: b.uid, offX, offY, moved: false };
    this.refresh();
    return true;
  }

  pointerMove(hit) {
    if (this.mode === 'paint') { this.paintAt(this.cellAt(hit)); return; }
    if (!this.drag) return;
    const cell = this.cellAt(hit);
    if (!cell) return;
    const b = this.draft.buildings.find((q) => q.uid === this.drag.uid);
    if (!b) return;
    const f = footprint(b.type, b.rot), S = this.plaza.selfIsland.S;
    const nx = Math.max(0, Math.min(S - f.w, cell.gx - this.drag.offX));
    const ny = Math.max(0, Math.min(S - f.h, cell.gy - this.drag.offY));
    if (nx !== b.x || ny !== b.y) { b.x = nx; b.y = ny; this.drag.moved = true; this.refresh(); }
  }

  pointerUp() {
    if (this.drag && !this.drag.moved) this.undo.pop();      // a tap-select isn't an undo step
    this.drag = null;
    this.strokeUndo = false;
  }

  async save() {
    const val = this.validation();
    if (!val.ok) {
      const inv = [...this.findInvalidBuildingUids()];
      if (inv.length) {
        this.selected = inv[0];
        this.focusOnBuilding(inv[0]);
        this.refresh();
      }
      this.ui.toast?.(`✕ ${humanError(val.error)}`);
      return;
    }
    this.draft.tiles = this.effectiveTiles();
    if (this.$('ed-save')) this.$('ed-save').disabled = true;
    if (this.$('qm-place')) this.$('qm-place').disabled = true;
    const r = await this.ui.onSave({ buildings: this.draft.buildings, tiles: this.draft.tiles, ground: this.draft.ground });
    if (this.$('ed-save')) this.$('ed-save').disabled = false;
    if (this.$('qm-place')) this.$('qm-place').disabled = false;
    if (r?.ok) {
      this.active = false;
      this.quickMode = false;
      this.selected = null;
      if (this.$('quick-move-ui')) this.$('quick-move-ui').hidden = true;
      this.ui.onExit?.(true);
    } else {
      this.ui.toast?.(`✕ ${humanError(r?.error)}`);
    }
  }
}

export function humanError(e) {
  return ({
    overlap: 'overlaps another building', out_of_bounds: 'outside your island', not_owned: 'not in your bag',
    core_cap: 'building cap reached — upgrade your Castle', wonder_cap: 'Wonder cap reached — upgrade your Castle',
    tile_under_building: 'a tile is under a building', dock_needs_water: 'the Dock must touch water or the coastline',
    bridge_landing: 'keep the Rainbow Bridge landing clear', duplicate_tile: 'duplicate tile', unknown_tile: 'unknown tile',
    not_ready: 'nothing to harvest yet', nothing_to_harvest: 'nothing to harvest yet', not_enough_gold: 'not enough Gold',
    not_enough_cards: 'not enough Blueprint cards', landmarks_too_low: 'upgrade your landmarks first', max_level: 'already max level',
    castle_too_low: 'upgrade your Castle first', max_size: 'island is already 32×32', not_couple: 'bind a Couple Soul-Link first',
    already_blessed_today: 'already blessed today 💧', already_tossed_today: 'already tossed a coin today', no_fountain: 'no Fountain here',
    slow_down: 'slow down a little', server_error: 'server hiccup, try again', not_at_dock: 'walk onto your Dock first',
    not_enough_berries: 'not enough Star-Berries', bad_layout: 'invalid layout',
    level_too_low: 'reach Level 10 to dispatch Royal Owl gifts',
    not_friend: 'recipient must be your bound partner or friend',
    no_such_user: 'recipient player not found',
    daily_limit: 'Royal Owl daily limit reached (3/3 parcels sent today)',
    empty_parcel: 'attach at least one item in Slot 1 or Slot 2',
    insufficient_berries: 'not enough Star-Berries for postage + gift',
    insufficient_item: 'you do not have that item in your Bag',
    insufficient_diamonds: 'not enough Diamonds 💎',
    insufficient_shards: 'not enough Starlight Shards 🌟',
    not_enough_diamonds: 'not enough Diamonds 💎',
    not_enough_shards: 'not enough Starlight Shards 🌟',
    not_enough_tickets: 'not enough Summon Tickets 🎟️',
    item_equipped: 'unequip this item first before gifting it',
    has_dupes: 'use Dupe Copy mode when gifting an item with duplicates',
    no_dupes: 'no duplicate copies left to gift',
    target_required: 'select a partner or friend first',
    already_claimed: 'already claimed ✅',
    not_eligible: 'enter valid Founder code (SKYPARTY-V1) to claim',
    quests_incomplete: 'claim all 3 daily quests first to unlock the bonus stamp',
    goal_not_reached: 'complete the quest objective first',
    cannot_friend_self: 'you cannot send a friend request to yourself',
    already_friends: 'you are already friends with this player',
    request_already_sent: 'friend request already sent',
    take_break_first: 'take a break in the Couple tab before removing your bound partner',
    already_coupled: 'you are already bound in a Couple Sanctuary',
    must_be_friends: 'add this player as a friend first before proposing a Couple bond',
    target_already_coupled: 'that player is already bound with another partner',
    not_coupled: 'you are not currently in a Couple bond',
    no_such_request: 'that friend request is no longer active',
    no_such_proposal: 'that couple proposal is no longer active',
  })[e] || e || 'something went wrong';
}

