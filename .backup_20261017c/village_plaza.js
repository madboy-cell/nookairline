// client/js/village_plaza.js — Step 2 village: Twin Sky-Islands renderer (ground skins, roads / canal /
// footbridges, building & Wonder & decor sprites, harvest bubbles, Rainbow Heart Bridge + Love Pavilion)
// and the CRK-style 24×24 → 32×32 Grid Editor (Drag / Paint modes, rotate, bag, undo, store-all, save).
import * as THREE from 'three';
import { loadSprite, spriteInfo } from './assets.js';
import {
  placeable, footprint, TILES, CORE, WONDERS, DECOR, GROUND_SKINS, LOVE_PAVILION, EXPANSION_TIERS,
} from '/shared/catalog_landmarks.js';
import {
  buildCellIndex, cellToWorld, worldToCell, validateLayout, computeComfort, comfortBonusPct, bagContents, cellsOf,
  islandAt, islandOf,
} from '/shared/village_rules.js';

const Y = { GROUND: 0, WATER: 0.006, ROAD: 0.012, BRIDGE: 0.02, GRID: 0.03, GHOST: 0.035 };
const SPRITE_WIDTH_PER_TILE = 0.82;
const MOOD_TINT = {
  sunny: [1, 1, 1], sakura: [1, 0.94, 0.97], sunset: [1, 0.84, 0.72], night: [0.56, 0.62, 0.9],
};
const MOOD_SKY = {
  sunny: ['#7cc4ff', '#cdeaff', '#ffeccc'], sakura: ['#ffc6dc', '#ffe4ef', '#fff3e6'],
  sunset: ['#ff9a6b', '#ffc78f', '#ffe7c2'], night: ['#121a4a', '#2b3a7a', '#5b5fa0'],
};

export function resolveMood(mood, date = new Date()) {
  if (mood && mood !== 'auto') return mood;
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
    this.selfId = null;
    this.mood = 'sunny';
    this.t = 0;
    this.generation = 0;
  }

  // ------------------------------------------------------------------ layout
  setLayout(wire, selfId) {
    this.selfId = selfId;
    this.layout = { islands: wire.islands.map((i) => ({ ...i })), bridge: wire.bridge };
    for (const isl of this.layout.islands) buildCellIndex(isl);
    this.rebuildAll();
  }

  /** Replace one owner's village (server broadcast or editor draft) and rebuild just that island. */
  setVillage(owner, village, { draft = null } = {}) {
    const isl = islandOf(this.layout, owner);
    if (!isl) return;
    isl.village = village;
    buildCellIndex(isl);
    this.buildIsland(isl, draft);
  }

  get selfIsland() { return this.layout && islandOf(this.layout, this.selfId); }

  rebuildAll() {
    const gen = ++this.generation;
    for (const e of this.entries.values()) this.disposeGroup(e.group);
    this.entries.clear();
    if (this.bridgeGroup) { this.disposeGroup(this.bridgeGroup); this.bridgeGroup = null; }
    this.pickables = []; this.bubbles = []; this.water = [];
    for (const isl of this.layout.islands) this.buildIsland(isl);
    if (this.layout.bridge) this.buildBridge(this.layout.bridge, gen);
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
    }
    const group = new THREE.Group();
    this.root.add(group);
    const entry = { group, island: isl };
    this.entries.set(isl.owner, entry);
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
        swatch('road_cobble').then((tex) => { mat.map = tex; this.setBase(mat, 0xffffff); mat.needsUpdate = true; });
      } else {
        swatch(def.sprite).then((tex) => { mat.map = def.water ? tex.clone() : tex; if (def.water) mat.map.needsUpdate = true; this.setBase(mat, 0xffffff); mat.needsUpdate = true; });
      }
      const mesh = new THREE.Mesh(cellsGeometry(isl, cells, y, 0.5), mat);
      mesh.userData.owner = isl.owner;
      if (def.water) this.water.push(mesh);
      group.add(mesh);

      // 2.5D Raised Cream-Stone Road Curbs & Grass-on-Stone Overhang Tufts along road-to-grass edges
      if (!def.water && !def.bridge && !draft) {
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
            if (!isl.index?.byCell?.get(`${gx},${gy - 1}`) && (gx === 8 || gx === 15 || gx === 3 || gx === 20)) {
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
            if (!isl.index?.byCell?.get(`${gx},${gy + 1}`) && (gx === 9 || gx === 14 || gx === 2 || gx === 16)) {
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
          const cm = this.addSprite(group, cloudSprite, isl.cx + Math.cos(a) * (S / 2 + 4.8), Math.sin(a) * (S / 2 + 4.8) + 1.2, 5.2, { kind: 'cloud', owner: isl.owner }, { pick: false, y: -2.4, opacity: 0.92 });
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
      const cb = this.addSprite(group, 'env_cloud_fluffy_b', cx + sx * (half - 2.2), half + 0.65, 4.6, { kind: 'cloud', owner: isl.owner }, { pick: false, y: -2.65, opacity: 0.94, mirror: sx < 0 });
      cb.userData.lean = false;
      cb.rotation.x = -0.06;
    }
  }

  /** Curated 2.5D storybook trees, flower bushes, split-rail stone fences & glowing streetlamps around the island & plaza. */
  addIslandScenery(group, isl, tileMap) {
    const S = isl.S, ox = isl.cx - S / 2, oz = -S / 2;
    const isSakura = isl.village.ground === 'ground_sakura';
    const treeA = isSakura ? 'env_tree_sakura_a' : 'env_tree_oak_a';
    const treeB = isSakura ? 'env_tree_sakura_b' : 'env_tree_oak_b';

    // Perimeter trees + inner garden trees visible in the central camera view
    const rimTrees = [
      [ox + 1.2, oz - 0.15, treeA, 2.35, false],
      [ox + 5.2, oz - 0.2, 'env_tree_fruit_apple', 2.15, false],
      [ox + S - 5.2, oz - 0.2, 'env_tree_golden_maple', 2.2, true],
      [ox + S - 1.2, oz - 0.15, treeB, 2.35, true],
      [ox - 0.25, oz + 3.5, treeB, 2.1, false],
      [ox - 0.25, oz + S - 3.2, 'env_pine', 1.95, false],
      [ox + S + 0.25, oz + 3.5, treeA, 2.1, true],
      [ox + S + 0.25, oz + S - 3.2, 'env_tree_sakura_a', 2.05, true],
      // Framing trees around the Castle & Canal plaza (on open grass cells)
      [ox + 8.2, oz + 5.2, treeA, 1.95, false],
      [ox + 15.6, oz + 5.2, 'env_tree_sakura_a', 1.90, true],
    ];
    for (const [x, z, sprite, w, mirror] of rimTrees) {
      this.addSprite(group, sprite, x, z, w, { kind: 'env', owner: isl.owner }, { pick: false, mirror });
    }

    // Lush 2.5D flowering bushes, split-rail stone fences & wildflower tufts along the plaza & road edges
    const rimProps = [
      [ox + 2.8, oz + 0.1, 'env_bush_mixed_large', 1.25],
      [ox + S - 2.8, oz + 0.1, 'env_bush_roses_pink', 1.15],
      [ox + 3.6, oz + S - 0.15, 'env_fence_wood_stone_straight', 1.35],
      [ox + 5.0, oz + S - 0.15, 'env_bush_daisies_white', 1.05],
      [ox + S - 3.6, oz + S - 0.15, 'env_fence_wood_stone_straight', 1.35],
      [ox + S - 5.0, oz + S - 0.15, 'env_bush_hydrangea_blue', 1.1],
      // Central plaza flower bushes, fences & wildflower tufts bordering the cobble road
      [ox + 9.2, oz + 7.6, 'env_bush_roses_pink', 0.95],
      [ox + 14.8, oz + 7.6, 'env_bush_mixed_large', 1.05],
      [ox + 10.2, oz + 14.8, 'env_bush_daisies_white', 0.88],
      [ox + 13.8, oz + 14.8, 'env_bush_roses_pink', 0.92],
      [ox + 10.3, oz + 16.5, 'decal_grass_daisies_b', 0.78],
      [ox + 13.7, oz + 16.2, 'decal_grass_clover_a', 0.75],
      [ox + 8.5, oz + 14.2, 'decal_path_stepping_stones', 0.95],
      [ox + 9.2, oz + 19.6, 'env_fence_wood_stone_straight', 1.15],
      [ox + 14.8, oz + 19.6, 'env_fence_wood_stone_straight', 1.15],
    ];
    for (const [x, z, sprite, w] of rimProps) {
      this.addSprite(group, sprite, x, z, w, { kind: 'env', owner: isl.owner }, { pick: false });
    }

    // 4-Way Plaza Cobblestone Garden Medallion at the Castle Crossroad
    const mid = Math.floor(S / 2);
    if (tileMap.has(`${mid - 1},6`) && tileMap.has(`${mid},6`)) {
      const medMat = this.tint(new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.4, depthWrite: false }));
      loadSprite('tile_plaza_cobble_medallion_4way').then((s) => { medMat.map = s.texture; medMat.needsUpdate = true; });
      const med = new THREE.Mesh(new THREE.PlaneGeometry(1.55, 1.55).rotateX(-Math.PI / 2), medMat);
      med.position.set(ox + mid, Y.ROAD + 0.005, oz + 6.5);
      group.add(med);
    }

    // Properly scaled 2.5D vintage glowing iron streetlamps (width 0.44 -> ~1.32m tall) flanking Castle Plaza & South Promenade
    for (const [gx, gy] of [[mid - 2, 5], [mid + 1, 5], [mid - 2, 13], [mid + 1, 13]]) {
      if (!isl.index?.byCell?.get(`${gx},${gy}`) && tileMap.get(`${gx},${gy}`) !== 'water') {
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
    const scalePerTile = d.kind === 'decor' ? 0.92 : SPRITE_WIDTH_PER_TILE;
    const width = Math.max(1.15, Math.max(f.w, f.h) * scalePerTile);
    const mesh = this.addSprite(group, d.sprite, c.x, c.z + f.h / 2 - 0.2, width, { kind: 'building', owner: isl.owner, uid: b.uid, type: b.type }, {
      mirror: ((b.rot / 90) | 0) % 2 === 1, ghost: draft && draft.selected === b.uid ? (draft.valid ? 'ok' : 'bad') : null,
    });
    mesh.userData.footprint = { x: c.x, z: c.z, w: f.w, h: f.h };
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
    mesh.scale.set(width * (o.mirror ? -1 : 1), width * aspect, 1);
    mesh.position.set(x, o.y ?? 0, z);
    mesh.userData = { ...data, height: width * aspect, lean: true };
    group.add(mesh);
    if (o.pick !== false) this.pickables.push(mesh);
    return mesh;
  }

  buildBridge(br) {
    const g = new THREE.Group();
    this.root.add(g);
    this.bridgeGroup = g;
    const len = br.x1 - br.x0, wid = br.z1 - br.z0;
    const deck = new THREE.Mesh(new THREE.PlaneGeometry(len, wid).rotateX(-Math.PI / 2), this.tint(new THREE.MeshBasicMaterial({ map: rainbowDeckTexture() })));
    deck.material.map.repeat.set(len / 2, 1);
    deck.position.set(br.cx, Y.BRIDGE, (br.z0 + br.z1) / 2);
    g.add(deck);
    const railMat = this.tint(new THREE.MeshBasicMaterial({ color: 0xffe3a6 }));
    for (const z of [br.z0 + 0.05, br.z1 - 0.05]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.22, 0.08), railMat);
      rail.position.set(br.cx, 0.2, z); g.add(rail);
    }
    const under = new THREE.Mesh(new THREE.BoxGeometry(len, 0.5, wid), this.tint(new THREE.MeshBasicMaterial({ color: 0xc89a6a })));
    under.position.set(br.cx, -0.26, (br.z0 + br.z1) / 2); g.add(under);
    this.addSprite(g, LOVE_PAVILION.sprite, br.cx, br.z0 - 0.05, 2.8, { kind: 'pavilion' }, { pick: false });
    this.addSprite(g, 'bridge_rainbow_arch', br.cx, br.z1 + 0.15, 3.0, { kind: 'arch' }, { pick: false });
    this.addSprite(g, 'env_streetlamp_double', br.x0 + 0.4, br.z0 - 0.1, 1.15, { kind: 'env' }, { pick: false });
    this.addSprite(g, 'env_streetlamp_double', br.x1 - 0.4, br.z0 - 0.1, 1.15, { kind: 'env' }, { pick: false });
  }

  addEditOverlay(group, isl, draft) {
    const S = isl.S, pts = [];
    const ox = isl.cx - S / 2, oz = -S / 2;
    for (let i = 0; i <= S; i++) { pts.push(ox + i, Y.GRID, oz, ox + i, Y.GRID, oz + S, ox, Y.GRID, oz + i, ox + S, Y.GRID, oz + i); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    group.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 })));
    const sel = draft.selected && isl.village.buildings.find((b) => b.uid === draft.selected);
    if (sel) {
      const cells = cellsOf(sel);
      const m = new THREE.Mesh(cellsGeometry(isl, cells, Y.GHOST), new THREE.MeshBasicMaterial({ color: draft.valid ? 0x3ddc84 : 0xff4d4d, transparent: true, opacity: 0.45, depthWrite: false }));
      group.add(m);
    }
  }

  // ------------------------------------------------------------------ mood
  tint(mat) { mat.userData.base = mat.color.clone(); this.tintables.add(mat); this.applyTint(mat); return mat; }
  setBase(mat, hex) { (mat.userData.base ||= new THREE.Color()).set(hex); this.applyTint(mat); }
  applyTint(mat) {
    const t = MOOD_TINT[this.mood] || MOOD_TINT.sunny;
    mat.color.copy(mat.userData.base || new THREE.Color(0xffffff)).multiply(new THREE.Color(t[0], t[1], t[2]));
  }
  setMood(mood) {
    const m = resolveMood(mood);
    this.mood = m;
    this.scene.background = skyTexture(m);
    for (const mat of this.tintables) this.applyTint(mat);
    return m;
  }
  get moodTint() { return MOOD_TINT[this.mood] || MOOD_TINT.sunny; }

  // ------------------------------------------------------------------ per-frame
  update(dt, camera, pitch) {
    this.t += dt;
    for (const w of this.water) if (w.material.map) { w.material.map.offset.x = this.t * 0.03; w.material.map.offset.y = Math.sin(this.t * 0.4) * 0.05; }
    const lean = -pitch;
    this.root.traverse((o) => { if (o.userData?.lean) o.rotation.x = lean; });
    for (const b of this.bubbles) {
      if (!b.visible) continue;
      const h = b.userData.height || 3;
      b.position.set(b.userData.base.x, h * Math.cos(pitch) + 0.5 + Math.sin(this.t * 3 + b.userData.base.x) * 0.12, b.userData.base.z - h * Math.sin(pitch) * 0.5);
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
// Grid Editor (Screen 02)
// =================================================================================================
const TAB_ITEMS = {
  buildings: () => ['castle', 'mint', 'shrine', 'patisserie', 'nest', 'dock'],
  wonders: () => Object.keys(WONDERS),
  decor: () => Object.keys(DECOR),
  tiles: () => [...Object.keys(TILES), 'erase'],
  skins: () => Object.keys(GROUND_SKINS),
};

export class GridEditor {
  /**
   * @param plaza VillagePlaza
   * @param ui { onSave(layout) => Promise<{ok,error}>, onExit(), toast(msg) }
   */
  constructor(plaza, ui) {
    this.plaza = plaza;
    this.ui = ui;
    this.active = false;
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
    $('ed-store').onclick = () => { this.pushUndo(); this.draft.buildings = []; this.selected = null; this.refresh(); };
    $('ed-save').onclick = () => this.save();
    $('ed-exit').onclick = () => this.close(true);
    $('ed-mode').onclick = () => this.setMode(this.mode === 'drag' ? 'paint' : 'drag');
    $('ed-confirm').onclick = () => { this.selected = null; this.refresh(); };
    $('ed-rotate').onclick = () => this.rotateSelected();
    $('ed-bag').onclick = () => this.bagSelected();
    document.querySelectorAll('#ed-tabs [data-tab]').forEach((b) => { b.onclick = () => { this.tab = b.dataset.tab; this.renderDrawer(); }; });
  }

  get village() { return this.plaza.selfIsland.village; }

  /** Draft village = saved village with the draft's buildings / tiles / ground (for validation + comfort). */
  draftVillage() { return { ...this.base, buildings: this.draft.buildings, tiles: this.draft.tiles, ground: this.draft.ground }; }

  open() {
    const v = this.village;
    this.base = JSON.parse(JSON.stringify(v));
    this.draft = { buildings: v.buildings.map(({ uid, type, x, y, rot }) => ({ uid, type, x, y, rot })), tiles: v.tiles.map((t) => ({ ...t })), ground: v.ground };
    this.undo = [];
    this.selected = null;
    this.active = true;
    this.setMode('drag');
    this.refresh();
  }

  close(discard = false) {
    if (!this.active) return;
    this.active = false;
    this.selected = null;
    if (discard) this.plaza.setVillage(this.plaza.selfId, this.base);
    this.ui.onExit?.();
  }

  setMode(m) {
    this.mode = m;
    this.$('ed-mode').textContent = m === 'drag' ? '📍 Drag' : '🖌️ Paint';
    this.$('ed-mode').classList.toggle('paint', m === 'paint');
    if (m === 'paint') { this.selected = null; this.tab = 'tiles'; }
    this.refresh();
  }

  pushUndo() { this.undo.push(JSON.stringify(this.draft)); if (this.undo.length > 60) this.undo.shift(); }
  popUndo() { const s = this.undo.pop(); if (s) { this.draft = JSON.parse(s); this.selected = null; this.refresh(); } }

  validation() { return validateLayout(this.draftVillage(), this.draft); }

  refresh() {
    if (!this.active) return;
    const val = this.validation();
    this.valid = val.ok;
    const dv = { ...this.draftVillage(), buildings: this.draft.buildings.map((b) => ({ ...b })) };
    this.plaza.setVillage(this.plaza.selfId, dv, { draft: { overlay: true, selected: this.selected, valid: val.ok } });
    const comfort = computeComfort(dv);
    this.$('ed-comfort').textContent = `🌸 ${comfort.toLocaleString('en-US')} • +${comfortBonusPct(comfort)}% yield`;
    this.$('ed-save').disabled = !val.ok;
    this.$('ed-status').textContent = val.ok ? '' : `✕ Blocked: ${humanError(val.error)}`;
    this.$('ed-select').hidden = !this.selected;
    this.renderDrawer();
  }

  renderDrawer() {
    const $ = this.$;
    document.querySelectorAll('#ed-tabs [data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === this.tab));
    const bag = bagContents(this.draftVillage(), this.draft.buildings);
    const box = $('ed-items');
    box.innerHTML = '';
    for (const key of TAB_ITEMS[this.tab]()) {
      const el = document.createElement('button');
      el.className = 'ed-item';
      if (this.tab === 'tiles') {
        const d = TILES[key];
        el.innerHTML = `<span class="em">${d ? d.emoji : '🧽'}</span><span>${d ? d.name : 'Eraser'}</span>`;
        el.classList.toggle('active', this.mode === 'paint' && this.paintTile === key);
        el.onclick = () => { this.paintTile = key; this.setMode('paint'); };
      } else if (this.tab === 'skins') {
        const d = GROUND_SKINS[key];
        el.innerHTML = `<img src="/assets/terrain/${key}.png" alt=""><span>${d.emoji} ${d.name}</span>`;
        el.classList.toggle('active', this.draft.ground === key);
        el.onclick = () => { this.pushUndo(); this.draft.ground = key; this.refresh(); };
      } else {
        const d = placeable(key);
        const n = bag[key] || 0;
        const placed = this.draft.buildings.filter((b) => b.type === key).length;
        const owned = n + placed;
        el.innerHTML = `<img src="/assets/village/${d.sprite}.png" alt=""><span>${d.name}</span><b class="cnt">${owned ? (n ? `📦 ${n}` : '✅ Placed') : '🔒'}</b>`;
        el.disabled = !n;
        el.onclick = () => this.placeFromBag(key);
      }
      box.appendChild(el);
    }
  }

  // ------------------------------------------------------------------ placement helpers
  cellAt(hit) {
    const isl = this.plaza.selfIsland;
    if (!hit || islandAt(this.plaza.layout, hit.x, hit.z) !== isl) return null;
    return worldToCell(isl, hit.x, hit.z);
  }

  buildingAtCell(gx, gy) {
    for (let i = this.draft.buildings.length - 1; i >= 0; i--) {
      const b = this.draft.buildings[i];
      if (cellsOf(b).some(([x, y]) => x === gx && y === gy)) return b;
    }
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
    this.refresh();
  }

  rotateSelected() {
    const b = this.draft.buildings.find((q) => q.uid === this.selected);
    if (!b) return;
    this.pushUndo();
    b.rot = (b.rot + 90) % 360;
    const f = footprint(b.type, b.rot), S = this.plaza.selfIsland.S;
    b.x = Math.min(b.x, S - f.w); b.y = Math.min(b.y, S - f.h);
    this.refresh();
  }

  bagSelected() {
    const i = this.draft.buildings.findIndex((q) => q.uid === this.selected);
    if (i < 0) return;
    this.pushUndo();
    this.draft.buildings.splice(i, 1);
    this.selected = null;
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
  pointerDown(hit) {
    const cell = this.cellAt(hit);
    if (this.mode === 'paint') { this.strokeUndo = false; this.paintAt(cell); return !!cell; }
    if (!cell) return false;
    const b = this.buildingAtCell(cell.gx, cell.gy);
    if (!b) { if (this.selected) { this.selected = null; this.refresh(); } return false; }
    this.pushUndo();
    this.selected = b.uid;
    this.drag = { uid: b.uid, offX: cell.gx - b.x, offY: cell.gy - b.y, moved: false };
    this.refresh();
    return true;
  }

  pointerMove(hit) {
    if (this.mode === 'paint') { this.paintAt(this.cellAt(hit)); return; }
    if (!this.drag) return;
    const cell = this.cellAt(hit);
    if (!cell) return;
    const b = this.draft.buildings.find((q) => q.uid === this.drag.uid);
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
    if (!val.ok) { this.ui.toast?.(`✕ ${humanError(val.error)}`); return; }
    this.$('ed-save').disabled = true;
    const r = await this.ui.onSave({ buildings: this.draft.buildings, tiles: this.draft.tiles, ground: this.draft.ground });
    this.$('ed-save').disabled = false;
    if (r?.ok) { this.active = false; this.selected = null; this.ui.onExit?.(true); }
    else this.ui.toast?.(`✕ ${humanError(r?.error)}`);
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
  })[e] || e || 'something went wrong';
}
