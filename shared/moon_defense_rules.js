// shared/moon_defense_rules.js — Authoritative rules, 18x18 Village Grid, 4 Corner Coves,
// Mythic Costume Tower Fusions, Vampire Survivors Hero Skills, Waves & Boss Charms for Moon Defense.

import { computeUniversalStats } from './universal_stats.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ============================================================================
// 1. EXTERNAL COMPATIBILITY EXPORTS (Universal Stat Bridge & Cloud Dash)
// ============================================================================

export function moonDefenseMods(stats = {}, { petFamily = null, petPct = 0 } = {}) {
  const fortune = Number(stats.fortune) || 0;
  const swiftness = Number(stats.swiftness) || 0;
  const power = Number(stats.power) || 0;
  const luck = Number(stats.luck) || 0;

  return {
    startCoins: 100 + Math.min(200, Math.round(fortune * 1.0)),
    coinMult: +(1 + Math.min(1.5, fortune * 0.005)).toFixed(3),
    podiumMult: +(1 + Math.min(2.0, fortune * 0.006)).toFixed(3),
    atkSpeedMult: +(1 + Math.min(0.8, swiftness * 0.004)).toFixed(3),
    moveSpeedMult: +(1 + Math.min(0.35, swiftness * 0.002)).toFixed(3),
    dashCdMult: +(Math.max(0.45, 1 - swiftness * 0.0025)).toFixed(3),
    dmgMult: +(1 + Math.min(1.5, power * 0.006)).toFixed(3),
    ultChargeMult: +(1 + Math.min(1.0, power * 0.004)).toFixed(3),
    critChance: +(Math.min(0.55, 0.05 + luck * 0.002)).toFixed(3),
    critMult: 1.75,
    mercLuckPct: +(Math.min(0.5, luck * 0.0025)).toFixed(3),
    petFamily,
    petPct,
  };
}

export function defenderModsFromProfile(prof = {}, catalogs = {}) {
  const uni = computeUniversalStats(prof, { catalogs });
  const mods = moonDefenseMods(uni.total, {
    petFamily: uni.petFamily,
    petPct: uni.petPct,
  });
  return {
    ...mods,
    stats: uni.total,
    bonus: uni.bonus,
    outfitId: prof?.equipped?.outfit?.id || 's1_naga_sovereign',
    petId: prof?.equipped?.pet?.id || prof?.pets?.[0]?.id || 'pet_ragdoll',
    petStars: prof?.equipped?.pet?.stars || prof?.pets?.[0]?.stars || 1,
  };
}

// ============================================================================
// 2. 28x28 ISLAND DEFENSE GRID, SECLUDED FOREST COVES & CENTER DIAMOND MOTHERLODE
// ============================================================================

export const MD_GRID = Object.freeze({
  SIZE: 28,
  CELL: 2.0,
  HALF: 28.0,
});

export function gridToWorld(gx, gz) {
  return {
    x: (gx - 13.5) * 2.0,
    z: (gz - 13.5) * 2.0,
  };
}

export function worldToGrid(x, z) {
  const gx = clamp(Math.floor((Number(x) + 28) / 2), 0, 27);
  const gz = clamp(Math.floor((Number(z) + 28) / 2), 0, 27);
  const cx = (gx - 13.5) * 2.0;
  const cz = (gz - 13.5) * 2.0;
  return {
    gx,
    gz,
    key: `${gx},${gz}`,
    cx,
    cz,
    x: cx,
    z: cz,
  };
}

export const MD_COVES = Object.freeze({
  nw: {
    id: 'nw',
    seat: 0,
    name: 'NW Moonshroud Grove',
    icon: '🌙',
    color: '#60a5fa',
    spawn: { x: -17, z: -17 },
    center: { x: -17, z: -17 },
    gxRange: [2, 7],
    gzRange: [2, 7],
    choke: [[8, 4], [8, 5]],
    veins: [[2, 2], [3, 2]],
  },
  ne: {
    id: 'ne',
    seat: 1,
    name: 'NE Ambercap Hollow',
    icon: '🍄',
    color: '#fbbf24',
    spawn: { x: 17, z: -17 },
    center: { x: 17, z: -17 },
    gxRange: [20, 25],
    gzRange: [2, 7],
    choke: [[19, 4], [19, 5]],
    veins: [[25, 2], [24, 2]],
  },
  sw: {
    id: 'sw',
    seat: 2,
    name: 'SW Elderwood Den',
    icon: '🌸',
    color: '#f472b6',
    spawn: { x: -17, z: 17 },
    center: { x: -17, z: 17 },
    gxRange: [2, 7],
    gzRange: [20, 25],
    choke: [[8, 22], [8, 23]],
    veins: [[2, 25], [3, 25]],
  },
  se: {
    id: 'se',
    seat: 3,
    name: 'SE Starlight Glade',
    icon: '💎',
    color: '#34d399',
    spawn: { x: 17, z: 17 },
    center: { x: 17, z: 17 },
    gxRange: [20, 25],
    gzRange: [20, 25],
    choke: [[19, 22], [19, 23]],
    veins: [[25, 25], [24, 25]],
  },
});

export const MD_COVE_ORDER = Object.freeze(['nw', 'ne', 'sw', 'se']);

// Spread-out wild gold/crystal vein tiles outside the coves for high-reward outdoor mining
export const MD_WILD_VEINS = Object.freeze([
  [13, 3],
  [14, 3],
  [13, 24],
  [14, 24],
  [3, 13],
  [3, 14],
  [24, 13],
  [24, 14],
  [10, 10],
  [17, 17],
]);

// Center Precious Diamond Motherlode + 12 Spread-Out Interactive Mining Ore & Treasure Nodes across the 56m x 56m Forest
export const MD_RESOURCE_SPOTS = Object.freeze([
  { id: 'node_center_diamond', x: 0,   z: 0,   kind: 'diamond_motherlode', name: '💎 Precious Diamond Motherlode',   hp: 500, swingGold: 32, swingDiamonds: 1, jackpotGold: 180, jackpotDiamonds: 3, xp: 45 },
  { id: 'node_n_clear',        x: 0,   z: -14, kind: 'crystal_vein',       name: 'Bioluminescent Crystal Cluster',   hp: 140, swingGold: 20, jackpotGold: 95,  xp: 55 },
  { id: 'node_s_clear',        x: 0,   z: 14,  kind: 'crystal_vein',       name: 'Bioluminescent Crystal Cluster',   hp: 140, swingGold: 20, jackpotGold: 95,  xp: 55 },
  { id: 'node_w_clear',        x: -14, z: 0,   kind: 'motherlode',         name: 'Ancient Motherlode Ore',           hp: 170, swingGold: 24, jackpotGold: 115, xp: 70 },
  { id: 'node_e_clear',        x: 14,  z: 0,   kind: 'motherlode',         name: 'Ancient Motherlode Ore',           hp: 170, swingGold: 24, jackpotGold: 115, xp: 70 },
  { id: 'node_nw_trail',       x: -8,  z: -8,  kind: 'gold_vein',          name: 'Starlight Gold Vein',              hp: 100, swingGold: 16, jackpotGold: 75,  xp: 45 },
  { id: 'node_ne_trail',       x: 8,   z: -8,  kind: 'gold_vein',          name: 'Starlight Gold Vein',              hp: 100, swingGold: 16, jackpotGold: 75,  xp: 45 },
  { id: 'node_sw_trail',       x: -8,  z: 8,   kind: 'gold_vein',          name: 'Starlight Gold Vein',              hp: 100, swingGold: 16, jackpotGold: 75,  xp: 45 },
  { id: 'node_se_trail',       x: 8,   z: 8,   kind: 'gold_vein',          name: 'Starlight Gold Vein',              hp: 100, swingGold: 16, jackpotGold: 75,  xp: 45 },
  { id: 'node_wn_grove',       x: -16, z: -6,  kind: 'chest',              name: 'Enchanted Reliquary Chest',        hp: 100, swingGold: 18, jackpotGold: 85,  xp: 50 },
  { id: 'node_en_grove',       x: 16,  z: -6,  kind: 'chest',              name: 'Enchanted Reliquary Chest',        hp: 100, swingGold: 18, jackpotGold: 85,  xp: 50 },
  { id: 'node_ws_grove',       x: -16, z: 6,   kind: 'gold_vein',          name: 'Moonlit Ore Geode',                hp: 120, swingGold: 20, jackpotGold: 90,  xp: 60 },
  { id: 'node_es_grove',       x: 16,  z: 6,   kind: 'gold_vein',          name: 'Moonlit Ore Geode',                hp: 120, swingGold: 20, jackpotGold: 90,  xp: 60 },
]);

export function getCoveBySeat(seatIdx) {
  const key = MD_COVE_ORDER[clamp(seatIdx | 0, 0, 3)];
  return MD_COVES[key];
}

export function getTileInfo(gx, gz) {
  if (!Number.isInteger(gx) || !Number.isInteger(gz) || gx < 0 || gx >= 28 || gz < 0 || gz >= 28) {
    return { kind: 'void', buildable: false, walkable: false, gx, gz };
  }

  // Outer rim (0 or 27)
  if (gx === 0 || gx === 27 || gz === 0 || gz === 27) {
    if (
      ((gx === 13 || gx === 14) && (gz === 0 || gz === 27)) ||
      ((gz === 13 || gz === 14) && (gx === 0 || gx === 27))
    ) {
      return { kind: 'rift', buildable: false, walkable: true, gx, gz };
    }
    return { kind: 'cliff', buildable: false, walkable: false, gx, gz };
  }

  // Center 2x2 Precious Diamond Quarry / Moon Shrine Clearing
  if ((gx === 13 || gx === 14) && (gz === 13 || gz === 14)) {
    return { kind: 'shrine', buildable: false, walkable: true, gx, gz };
  }

  // Check Secluded Forest Coves, Choke Gates, and Physical Forest Wall Rings
  for (const cove of Object.values(MD_COVES)) {
    for (const [vx, vz] of cove.veins) {
      if (gx === vx && gz === vz) {
        return { kind: 'vein', coveId: cove.id, buildable: true, walkable: true, gx, gz };
      }
    }
    for (const [cx, cz] of cove.choke) {
      if (gx === cx && gz === cz) {
        return { kind: 'choke', coveId: cove.id, buildable: true, walkable: true, gx, gz };
      }
    }
    if (
      gx >= cove.gxRange[0] &&
      gx <= cove.gxRange[1] &&
      gz >= cove.gzRange[0] &&
      gz <= cove.gzRange[1]
    ) {
      return { kind: 'cove', coveId: cove.id, buildable: true, walkable: true, gx, gz };
    }

    // Physical Forest Wall Ring framing each cove
    const minWallX = cove.gxRange[0] === 2 ? 1 : 19;
    const maxWallX = cove.gxRange[0] === 2 ? 8 : 26;
    const minWallZ = cove.gzRange[0] === 2 ? 1 : 19;
    const maxWallZ = cove.gzRange[0] === 2 ? 8 : 26;
    if (
      gx >= minWallX &&
      gx <= maxWallX &&
      gz >= minWallZ &&
      gz <= maxWallZ &&
      (gx === minWallX || gx === maxWallX || gz === minWallZ || gz === maxWallZ)
    ) {
      return { kind: 'forest_wall', coveId: cove.id, buildable: false, walkable: false, gx, gz };
    }
  }

  // Check Wild Outer Gold Veins spread across the forest clearings
  for (const [wvx, wvz] of MD_WILD_VEINS) {
    if (gx === wvx && gz === wvz) {
      return { kind: 'vein', coveId: 'wild', buildable: true, walkable: true, gx, gz };
    }
  }

  // Forest Trails & Wilds outside the Coves
  if (gx === 13 || gx === 14 || gz === 13 || gz === 14) {
    return { kind: 'road', buildable: false, walkable: true, gx, gz };
  }

  // Enchanted Forest Wilds outside coves
  return { kind: 'plaza', buildable: false, walkable: true, gx, gz };
}

export function isTileWalkable(gx, gz) {
  const tile = getTileInfo(gx, gz);
  return Boolean(
    tile &&
      tile.walkable !== false &&
      tile.kind !== 'forest_wall' &&
      tile.kind !== 'cliff' &&
      tile.kind !== 'void'
  );
}

export function isWorldPosWalkable(x, z) {
  const nx = Number(x);
  const nz = Number(z);
  if (!Number.isFinite(nx) || !Number.isFinite(nz)) return false;
  if (Math.abs(nx) > 27.2 || Math.abs(nz) > 27.2) return false;
  const g = worldToGrid(nx, nz);
  const tile = getTileInfo(g.gx, g.gz);
  if (
    tile.walkable === false ||
    tile.kind === 'forest_wall' ||
    tile.kind === 'cliff' ||
    tile.kind === 'void'
  ) {
    return false;
  }
  return true;
}

export function clampWorldPosWalkable(fromX, fromZ, toX, toZ) {
  const fx = clamp(Number(fromX) || 0, -27.2, 27.2);
  const fz = clamp(Number(fromZ) || 0, -27.2, 27.2);
  const tx = clamp(Number(toX) || 0, -27.2, 27.2);
  const tz = clamp(Number(toZ) || 0, -27.2, 27.2);

  if (isWorldPosWalkable(tx, tz)) {
    return { x: tx, z: tz };
  }

  // Slide along Z (vertical forest wall edge -> slides toward Choke Pass at z = ±18)
  if (isWorldPosWalkable(fx, tz)) {
    const chokeZ = tz < 0 ? -18.0 : 18.0;
    const nudgeZ = clamp(tz + Math.sign(chokeZ - tz) * 0.08, -27.2, 27.2);
    if (isWorldPosWalkable(fx, nudgeZ)) {
      return { x: fx, z: nudgeZ };
    }
    return { x: fx, z: tz };
  }

  // Slide along X (horizontal forest wall edge)
  if (isWorldPosWalkable(tx, fz)) {
    return { x: tx, z: fz };
  }

  // Binary search along segment from (fx, fz) to (tx, tz)
  let lo = 0;
  let hi = 1;
  let bestX = fx;
  let bestZ = fz;
  for (let i = 0; i < 6; i++) {
    const mid = (lo + hi) * 0.5;
    const mx = fx + (tx - fx) * mid;
    const mz = fz + (tz - fz) * mid;
    if (isWorldPosWalkable(mx, mz)) {
      bestX = mx;
      bestZ = mz;
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return { x: bestX, z: bestZ };
}

export function canPlaceBuilding(gx, gz, buildingKind, buildingsMap = {}) {
  const tile = getTileInfo(gx, gz);
  if (
    !tile ||
    tile.kind === 'void' ||
    tile.kind === 'cliff' ||
    tile.kind === 'forest_wall' ||
    tile.kind === 'rift'
  ) {
    return { ok: false, error: `Cannot build on ${tile?.kind || 'void'} tile`, tile };
  }

  const key = `${gx},${gz}`;
  const occupied =
    buildingsMap instanceof Map
      ? buildingsMap.has(key)
      : Array.isArray(buildingsMap)
      ? buildingsMap.some((b) => b && b.gx === gx && b.gz === gz)
      : Boolean(buildingsMap && buildingsMap[key]);
  if (occupied) {
    return { ok: false, error: 'Tile is already occupied', tile };
  }

  const def = MD_BUILDINGS[buildingKind];
  if (!def) {
    return { ok: false, error: 'Unknown building type', tile };
  }

  if (buildingKind === 'ward') {
    if (
      tile.kind === 'cove' ||
      tile.kind === 'choke' ||
      tile.kind === 'road' ||
      tile.kind === 'plaza'
    ) {
      return { ok: true, tile };
    }
    return {
      ok: false,
      error: 'Vision Wards can only be placed on walkable Cove, Choke, Trail, or Wilds tiles',
      tile,
    };
  }

  if (buildingKind === 'diamond_drill') {
    if (tile.kind === 'vein' || tile.kind === 'cove' || tile.kind === 'shrine') {
      return { ok: true, tile };
    }
    return {
      ok: false,
      error: 'Diamond Drills can only be placed on Center Diamond Quarry, Gold Veins, or inside Coves',
      tile,
    };
  }

  if (!tile.buildable) {
    return { ok: false, error: `Cannot build on ${tile.kind} tile`, tile };
  }

  if (buildingKind === 'mine') {
    if (tile.kind !== 'vein' && tile.kind !== 'cove') {
      return { ok: false, error: 'Mines can only be placed on Gold Veins or inside Coves', tile };
    }
    return { ok: true, tile };
  }

  if (buildingKind === 'wall') {
    if (tile.kind === 'choke' || tile.kind === 'cove') {
      return { ok: true, tile };
    }
    return { ok: false, error: 'Walls must be placed at a Cove Choke Gate or inside a Cove', tile };
  }

  if (buildingKind === 'totem') {
    if (tile.kind === 'cove' || tile.kind === 'choke') {
      return { ok: true, tile };
    }
    return { ok: false, error: 'Totems must be placed inside a Cove', tile };
  }

  if (buildingKind.startsWith('tower_') || buildingKind === 'tower') {
    if (tile.kind === 'cove' || tile.kind === 'choke') {
      return { ok: true, tile };
    }
    return { ok: false, error: 'Towers must be placed inside a Cove', tile };
  }

  return { ok: false, error: 'Invalid building placement', tile };
}

// ============================================================================
// 3. BUILDINGS, 6 ELEMENTS & MYTHIC COSTUME TOWER FUSIONS
// ============================================================================

export const MD_ELEMENTS = Object.freeze({
  storm:  { id: 'storm',  name: 'Storm',   icon: '⚡', color: '#38bdf8', towerId: 'tower_storm' },
  water:  { id: 'water',  name: 'Frost',   icon: '❄️', color: '#60a5fa', towerId: 'tower_water' },
  fire:   { id: 'fire',   name: 'Solar',   icon: '🔥', color: '#f97316', towerId: 'tower_fire' },
  nature: { id: 'nature', name: 'Bloom',   icon: '🌸', color: '#f472b6', towerId: 'tower_nature' },
  light:  { id: 'light',  name: 'Astral',  icon: '🌟', color: '#facc15', towerId: 'tower_light' },
  dark:   { id: 'dark',   name: 'Eclipse', icon: '🌑', color: '#a855f7', towerId: 'tower_dark' },
});

const BUILDINGS_MAP = {
  wall: {
    id: 'wall',
    kind: 'wall',
    name: 'Gate Wall',
    icon: '🧱',
    cost: 25,
    hp: 850,
    thorns: 24,
    maxLevel: 5,
    color: '#94a3b8',
    desc: 'Blocks Choke Gate & reflects 24 thorns DMG',
  },
  mine: {
    id: 'mine',
    kind: 'mine',
    name: 'Gold Mine',
    icon: '⛏️',
    cost: 35,
    hp: 350,
    goldPerSec: 5,
    veinMult: 1.6,
    maxLevel: 5,
    color: '#fbbf24',
    desc: '+5 Gold/s (+8/s on Gold Veins)',
  },
  diamond_drill: {
    id: 'diamond_drill',
    kind: 'mine',
    name: 'Diamond Drill',
    icon: '💎',
    cost: 90,
    hp: 420,
    goldPerSec: 9,
    veinMult: 1.5,
    diamondChancePerTick: 0.12,
    maxLevel: 5,
    color: '#38bdf8',
    desc: '+9 Gold/s & extracts 💎 Diamonds',
  },
  totem: {
    id: 'totem',
    kind: 'totem',
    name: 'Heal Totem',
    icon: '💖',
    cost: 45,
    hp: 450,
    healPerSec: 32,
    range: 7.0,
    maxLevel: 5,
    color: '#34d399',
    desc: 'Heals nearby Gate Walls (+32 HP/s) & Heroes in your Cove',
  },
  ward: {
    id: 'ward',
    kind: 'ward',
    name: 'Vision Ward',
    icon: '👁️',
    cost: 30,
    hp: 220,
    visionRadius: 16.0,
    range: 16.0,
    maxLevel: 3,
    color: '#fde047',
    desc: 'Reveals 16m of Fog of War to spot the Titan',
  },
  tower_storm: {
    id: 'tower_storm',
    kind: 'tower',
    element: 'storm',
    name: 'Storm Spire',
    icon: '⚡',
    cost: 40,
    hp: 360,
    dmg: 30,
    rate: 1.35,
    range: 6.8,
    chain: 3,
    color: '#38bdf8',
    outfit: 's11_zeus_olympus',
    maxLevel: 5,
    desc: 'Chain lightning bounces to 3 foes',
  },
  tower_water: {
    id: 'tower_water',
    kind: 'tower',
    element: 'water',
    name: 'Frost Spire',
    icon: '❄️',
    cost: 40,
    hp: 360,
    dmg: 24,
    rate: 1.2,
    range: 6.2,
    slow: 0.35,
    color: '#60a5fa',
    outfit: 's8_glacial_elsa',
    maxLevel: 5,
    desc: 'Chills & slows foes by 35%',
  },
  tower_fire: {
    id: 'tower_fire',
    kind: 'tower',
    element: 'fire',
    name: 'Solar Spire',
    icon: '🔥',
    cost: 40,
    hp: 360,
    dmg: 38,
    rate: 0.95,
    range: 6.2,
    splash: 2.4,
    color: '#f97316',
    outfit: 's3_dune_phoenix',
    maxLevel: 5,
    desc: 'Explosive 2.4m splash damage',
  },
  tower_nature: {
    id: 'tower_nature',
    kind: 'tower',
    element: 'nature',
    name: 'Bloom Spire',
    icon: '🌸',
    cost: 40,
    hp: 360,
    dmg: 26,
    rate: 1.3,
    range: 6.5,
    poison: 14,
    color: '#f472b6',
    outfit: 's2_kitsune_inari',
    maxLevel: 5,
    desc: 'Rapid petals + poison DoT',
  },
  tower_light: {
    id: 'tower_light',
    kind: 'tower',
    element: 'light',
    name: 'Astral Spire',
    icon: '🌟',
    cost: 45,
    hp: 380,
    dmg: 44,
    rate: 1.05,
    range: 7.6,
    critBonus: 0.25,
    color: '#facc15',
    outfit: 's9_pharaoh_ra',
    maxLevel: 5,
    desc: 'Long-range beam (+25% Crit)',
  },
  tower_dark: {
    id: 'tower_dark',
    kind: 'tower',
    element: 'dark',
    name: 'Eclipse Spire',
    icon: '🌑',
    cost: 45,
    hp: 380,
    dmg: 36,
    rate: 1.1,
    range: 6.6,
    amp: 0.22,
    color: '#a855f7',
    outfit: 's2_tsukuyomi_eclipse',
    maxLevel: 5,
    desc: 'Curses foes (+22% DMG taken)',
  },
};

Object.defineProperty(BUILDINGS_MAP, 'tower', {
  value: BUILDINGS_MAP.tower_storm,
  enumerable: false,
  configurable: false,
});

export const MD_BUILDINGS = Object.freeze(BUILDINGS_MAP);

// All 15 Dual Mythic Costume Fusion pairs (sorted element pair key "a+b")
export const MD_FUSIONS = Object.freeze({
  'fire+water': {
    key: 'fire+water',
    name: 'Naga Sovereign',
    icon: '🐍',
    outfit: 's1_naga_sovereign',
    color: '#2dd4bf',
    tier: 2,
    dmgMult: 2.15,
    rangeBonus: 1.2,
  },
  'fire+storm': {
    key: 'fire+storm',
    name: 'Cyber Archon',
    icon: '⚡',
    outfit: 'sm_cyber_archon',
    color: '#38bdf8',
    tier: 2,
    dmgMult: 2.15,
    rangeBonus: 1.2,
  },
  'fire+nature': {
    key: 'fire+nature',
    name: 'Kitsune Inari',
    icon: '🦊',
    outfit: 's2_kitsune_inari',
    color: '#fb7185',
    tier: 2,
    dmgMult: 2.15,
    rangeBonus: 1.2,
  },
  'fire+light': {
    key: 'fire+light',
    name: 'Dune Phoenix',
    icon: '🦅',
    outfit: 's3_dune_phoenix',
    color: '#fbbf24',
    tier: 2,
    dmgMult: 2.15,
    rangeBonus: 1.2,
  },
  'dark+fire': {
    key: 'dark+fire',
    name: 'Sultan Djinn',
    icon: '🧞',
    outfit: 's3_sultan_djinn',
    color: '#c084fc',
    tier: 2,
    dmgMult: 2.15,
    rangeBonus: 1.2,
  },
  'storm+water': {
    key: 'storm+water',
    name: 'Aurora Empress',
    icon: '❄️',
    outfit: 'sm_aurora_empress',
    color: '#67e8f9',
    tier: 2,
    dmgMult: 2.15,
    rangeBonus: 1.2,
  },
  'nature+water': {
    key: 'nature+water',
    name: 'Atlantis Siren',
    icon: '🧜‍♀️',
    outfit: 's5_atlantis_siren',
    color: '#34d399',
    tier: 2,
    dmgMult: 2.15,
    rangeBonus: 1.2,
  },
  'light+water': {
    key: 'light+water',
    name: 'Cinderella Chrono',
    icon: '🕰️',
    outfit: 's7_cinderella_clock',
    color: '#93c5fd',
    tier: 2,
    dmgMult: 2.15,
    rangeBonus: 1.2,
  },
  'dark+water': {
    key: 'dark+water',
    name: 'Phantom Masque',
    icon: '🎭',
    outfit: 's10_phantom_masque',
    color: '#818cf8',
    tier: 2,
    dmgMult: 2.15,
    rangeBonus: 1.2,
  },
  'nature+storm': {
    key: 'nature+storm',
    name: 'Zeus Olympus',
    icon: '🌩️',
    outfit: 's11_zeus_olympus',
    color: '#4ade80',
    tier: 2,
    dmgMult: 2.15,
    rangeBonus: 1.2,
  },
  'light+storm': {
    key: 'light+storm',
    name: 'Astral Sovereign',
    icon: '✨',
    outfit: 's6_astral_sovereign',
    color: '#fde047',
    tier: 2,
    dmgMult: 2.15,
    rangeBonus: 1.2,
  },
  'dark+storm': {
    key: 'dark+storm',
    name: 'Casino Royale',
    icon: '🎰',
    outfit: 's4_casino_royale',
    color: '#e879f9',
    tier: 2,
    dmgMult: 2.15,
    rangeBonus: 1.2,
  },
  'light+nature': {
    key: 'light+nature',
    name: 'Seraphim Rose',
    icon: '🌹',
    outfit: 'sm_seraphim_rose',
    color: '#f472b6',
    tier: 2,
    dmgMult: 2.15,
    rangeBonus: 1.2,
  },
  'dark+nature': {
    key: 'dark+nature',
    name: 'Pharaoh Ra',
    icon: '☀️',
    outfit: 's9_pharaoh_ra',
    color: '#a855f7',
    tier: 2,
    dmgMult: 2.15,
    rangeBonus: 1.2,
  },
  'dark+light': {
    key: 'dark+light',
    name: 'Eclipse Dragon',
    icon: '🐉',
    outfit: 'sm_eclipse_dragon',
    color: '#f59e0b',
    tier: 2,
    dmgMult: 2.15,
    rangeBonus: 1.2,
  },
});

function combineElementSpecials(els) {
  const special = {
    chain: 0,
    slow: 0,
    splash: 0,
    poison: 0,
    critBonus: 0,
    amp: 0,
  };
  for (const el of els) {
    const t = MD_BUILDINGS[`tower_${el}`];
    if (!t) continue;
    if (t.chain) special.chain = Math.max(special.chain, t.chain) + (special.chain ? 1 : 0);
    if (t.slow) special.slow = Math.min(0.65, Math.max(special.slow, t.slow) + (special.slow ? 0.1 : 0));
    if (t.splash) special.splash = Math.max(special.splash, t.splash) + (special.splash ? 0.6 : 0);
    if (t.poison) special.poison += t.poison;
    if (t.critBonus) special.critBonus = Math.min(0.6, special.critBonus + t.critBonus);
    if (t.amp) special.amp = Math.min(0.55, special.amp + t.amp);
  }
  return special;
}

export function resolveTowerFusion(elements = []) {
  const clean = (Array.isArray(elements) ? elements : [elements])
    .filter((e) => MD_ELEMENTS[e])
    .slice(0, 3);

  if (clean.length === 0) {
    clean.push('storm');
  }

  const firstTower = MD_BUILDINGS[`tower_${clean[0]}`] || MD_BUILDINGS.tower_storm;
  const special = combineElementSpecials(clean);

  // 1 Element: Base Elemental Spire
  if (clean.length === 1) {
    return {
      tier: 1,
      elements: clean,
      name: firstTower.name,
      icon: firstTower.icon,
      outfit: firstTower.outfit,
      color: firstTower.color,
      dmgMult: 1.0,
      rangeBonus: 0,
      dmg: firstTower.dmg,
      rate: firstTower.rate,
      range: firstTower.range,
      special,
      desc: firstTower.desc,
    };
  }

  // Average base stats across combined elements
  let avgDmg = 0;
  let avgRate = 0;
  let maxRange = 0;
  for (const el of clean) {
    const t = MD_BUILDINGS[`tower_${el}`] || firstTower;
    avgDmg += t.dmg;
    avgRate += t.rate;
    if (t.range > maxRange) maxRange = t.range;
  }
  avgDmg /= clean.length;
  avgRate /= clean.length;

  // 2 Elements: Dual Mythic Costume Fusion
  if (clean.length === 2) {
    const pairKey = [...clean].sort().join('+');
    const recipe = MD_FUSIONS[pairKey] || {
      key: pairKey,
      name: `Twin ${firstTower.name}`,
      icon: firstTower.icon,
      outfit: firstTower.outfit,
      color: firstTower.color,
      tier: 2,
      dmgMult: 2.15,
      rangeBonus: 1.2,
    };
    const dmgMult = recipe.dmgMult || 2.15;
    const rangeBonus = recipe.rangeBonus || 1.2;
    return {
      tier: 2,
      key: pairKey,
      elements: clean,
      name: recipe.name,
      icon: recipe.icon,
      outfit: recipe.outfit,
      color: recipe.color,
      dmgMult,
      rangeBonus,
      dmg: Math.round(avgDmg * dmgMult),
      rate: +(avgRate * 1.12).toFixed(2),
      range: +(maxRange + rangeBonus).toFixed(2),
      special,
      desc: `Dual Mythic Fusion (${clean.map((e) => MD_ELEMENTS[e].icon).join(' + ')})`,
    };
  }

  // 3 Elements: Triple Sovereign Fusion
  const dmgMult = 3.4;
  const rangeBonus = 2.2;
  return {
    tier: 3,
    key: [...clean].sort().join('+'),
    elements: clean,
    name: 'Trinity Sovereign Guardian',
    icon: '👑',
    outfit: 'sm_starlight_ribbon',
    color: '#f472b6',
    dmgMult,
    rangeBonus,
    dmg: Math.round(avgDmg * dmgMult),
    rate: +(avgRate * 1.25).toFixed(2),
    range: +(maxRange + rangeBonus).toFixed(2),
    special,
    desc: `Triple Sovereign Fusion (${clean.map((e) => MD_ELEMENTS[e].icon).join(' + ')})`,
  };
}

// ============================================================================
// 4. VAMPIRE SURVIVORS HERO AUTO-SKILLS
// ============================================================================

const HERO_SKILL_LIST = [
  {
    id: 'orbit_blades',
    name: 'Starlight Orbit Blades',
    icon: '🗡️',
    maxLv: 5,
    desc: 'Spinning starlight blades orbit your Hero and slice nearby monsters.',
  },
  {
    id: 'chain_bolt',
    name: 'Thunder Chain Bolt',
    icon: '⚡',
    maxLv: 5,
    desc: 'Auto-casts bouncing lightning bolts that arc across monster packs.',
  },
  {
    id: 'frost_nova',
    name: 'Glacial Frost Nova',
    icon: '❄️',
    maxLv: 5,
    desc: 'Periodically erupts an icy ring around your Hero that chills foes.',
  },
  {
    id: 'gold_magnet',
    name: 'Midas Magnet Aura',
    icon: '🧲',
    maxLv: 5,
    desc: 'Expands XP/Gold gem vacuum radius and boosts gem gold value.',
  },
  {
    id: 'guardian_haste',
    name: 'Sanctuary War Drum',
    icon: '🥁',
    maxLv: 5,
    desc: 'Boosts attack speed of your Hero, Pet, and all owned Towers.',
  },
  {
    id: 'meteor_rain',
    name: 'Solar Meteor Rain',
    icon: '☄️',
    maxLv: 5,
    desc: 'Calls down blazing meteors onto the highest-HP monster cluster.',
  },
];

// Attach non-enumerable ID keys so MD_HERO_SKILLS works as both an Array and an Object lookup map
for (const sk of HERO_SKILL_LIST) {
  Object.defineProperty(HERO_SKILL_LIST, sk.id, {
    value: sk,
    enumerable: false,
    configurable: false,
  });
}

export const MD_HERO_SKILLS = Object.freeze(HERO_SKILL_LIST);

// ============================================================================
// 5. WAVES & BOSSES (WAVES 1..20)
// ============================================================================

export const MD_MAX_WAVES = 20;

const BOSS_BY_WAVE = Object.freeze({
  5:  { name: 'King Mochi Titan',       kind: 'boss_mochi',   title: 'Wave 5 Boss: King Mochi Titan' },
  10: { name: 'Obsidian Golem Lord',    kind: 'boss_golem',   title: 'Wave 10 Boss: Obsidian Golem Lord' },
  15: { name: 'Void Kraken Monarch',    kind: 'boss_kraken',  title: 'Wave 15 Boss: Void Kraken Monarch' },
  20: { name: 'Eclipse Dragon Emperor', kind: 'boss_dragon',  title: 'Final Boss: Eclipse Dragon Emperor' },
});

const WAVE_MONSTERS = [
  { kind: 'slime',   title: 'Starlight Slimes',    speed: 2.1 },
  { kind: 'imp',     title: 'Shadow Imps',         speed: 2.5 },
  { kind: 'golem',   title: 'Crag Golems',         speed: 1.75 },
  { kind: 'specter', title: 'Lunar Specters',      speed: 2.35 },
];

export function getWaveConfig(wave = 1) {
  const w = clamp(wave | 0, 1, MD_MAX_WAVES);
  const boss = BOSS_BY_WAVE[w] || null;
  const isBoss = Boolean(boss);
  const mTpl = WAVE_MONSTERS[(w - 1) % WAVE_MONSTERS.length];

  const baseHp = Math.round(95 * Math.pow(1.22, w - 1));
  const count = isBoss ? 8 + Math.floor(w * 0.6) : 10 + w * 2;
  const hp = isBoss ? Math.round(baseHp * 1.15) : baseHp;
  const bossHp = isBoss ? Math.round(baseHp * 8.5) : 0;
  const speed = isBoss ? 1.85 : +(mTpl.speed + Math.min(0.6, w * 0.025)).toFixed(2);
  const dmg = Math.round(12 + w * 3.5);
  const goldReward = 45 + w * 8;
  const xpReward = 25 + w * 6;

  return {
    wave: w,
    isBoss,
    title: boss ? boss.title : `Wave ${w}: ${mTpl.title}`,
    count,
    hp,
    bossHp,
    speed,
    dmg,
    goldReward,
    xpReward,
    monsterKind: boss ? boss.kind : mTpl.kind,
    bossName: boss ? boss.name : null,
  };
}

export const MD_WAVES = Object.freeze(
  Array.from({ length: MD_MAX_WAVES }, (_, i) => getWaveConfig(i + 1))
);

// ============================================================================
// 6. CHARMS (16 DROP-ONLY BOSS CHARMS)
// ============================================================================

const CHARM_DEFS = [
  { id: 'charm_berry_perfume',        name: 'Berry Dew Perfume',            icon: '🍓', tier: 1, grade: 'S',  stat: 'fortune',   bonus: 28 },
  { id: 'charm_clover_bell',          name: 'Four-Leaf Clover Bell',        icon: '🍀', tier: 1, grade: 'S',  stat: 'luck',      bonus: 28 },
  { id: 'charm_ribbon_musicbox',      name: 'Ribbon Music Box',             icon: '🎀', tier: 1, grade: 'S',  stat: 'swiftness', bonus: 28 },
  { id: 'charm_honeybee_lantern',     name: 'Honeybee Lantern',             icon: '🌼', tier: 1, grade: 'S',  stat: 'power',     bonus: 28 },
  { id: 'charm_cinderella_watch',     name: 'Glass Slipper Pocketwatch',    icon: '🕰️', tier: 2, grade: 'S',  stat: 'swiftness', bonus: 46 },
  { id: 'charm_siren_pearl',          name: 'Siren Pearl Clam',             icon: '🧜‍♀️', tier: 2, grade: 'S',  stat: 'power',     bonus: 46 },
  { id: 'charm_roulette_watch',       name: 'High-Roller Roulette Compass', icon: '🎰', tier: 2, grade: 'S',  stat: 'fortune',   bonus: 46 },
  { id: 'charm_phantom_mirror',       name: 'Phantom Masque Mirror',        icon: '🎭', tier: 2, grade: 'S',  stat: 'luck',      bonus: 46 },
  { id: 'charm_kitsune_omamori',      name: 'Kitsune Fox-Fire Omamori',     icon: '🦊', tier: 3, grade: 'SS', stat: 'luck',      bonus: 78 },
  { id: 'charm_glacial_snowglobe',    name: 'Glacial Swan Snowglobe',       icon: '❄️', tier: 3, grade: 'SS', stat: 'power',     bonus: 78 },
  { id: 'charm_pharaoh_ankh',         name: 'Pharaoh Solar Ankh',           icon: '☀️', tier: 3, grade: 'SS', stat: 'fortune',   bonus: 78 },
  { id: 'charm_tsukuyomi_mirror',     name: 'Tsukuyomi Moon Mirror',        icon: '🌙', tier: 3, grade: 'SS', stat: 'swiftness', bonus: 78 },
  { id: 'charm_emperor_mochi_crown',  name: 'Emperor Mochi Crown Seal',     icon: '👑', tier: 4, grade: 'SS', stat: 'power',     bonus: 135 },
  { id: 'charm_golden_pinata_trophy', name: 'Golden Pinata MVP Trophy',     icon: '🐷', tier: 4, grade: 'SS', stat: 'fortune',   bonus: 135 },
  { id: 'charm_seraphim_rose_halo',   name: 'Seraphim Rose Sanctuary',      icon: '🌹', tier: 4, grade: 'SS', stat: 'swiftness', bonus: 135 },
  { id: 'charm_eclipse_dragon_core',  name: 'Eclipse Dragon Sovereign Core',icon: '🐉', tier: 4, grade: 'SS', stat: 'luck',      bonus: 135 },
];

for (const c of CHARM_DEFS) {
  Object.defineProperty(CHARM_DEFS, c.id, {
    value: c,
    enumerable: false,
    configurable: false,
  });
}

export const MD_CHARMS = Object.freeze(CHARM_DEFS);

export function rollCharmDrop(wave = 5, rng = Math.random) {
  const maxTier = wave >= 20 ? 4 : wave >= 15 ? 3 : wave >= 10 ? 2 : 1;
  const pool = CHARM_DEFS.filter((c) => c.tier <= maxTier);
  const chosen = pool[Math.floor(rng() * pool.length)] || CHARM_DEFS[0];
  const ssChance = wave >= 20 ? 0.45 : wave >= 15 ? 0.30 : 0.18;
  const grade = rng() < ssChance ? 'SS' : 'S';
  const bonus = Math.round(chosen.bonus * (grade === 'SS' ? 1.25 : 1.0));

  return {
    uid: `chm_${Date.now().toString(36)}_${Math.floor(rng() * 1e6).toString(36)}`,
    id: chosen.id,
    name: chosen.name,
    icon: chosen.icon,
    tier: chosen.tier,
    grade,
    stat: chosen.stat,
    bonus,
    plus: 0,
    level: 1,
    stats: { [chosen.stat]: bonus },
    auraKind: chosen.id,
  };
}

export function upsertCharmToProfile(prof, charm) {
  if (!prof || !charm || !charm.id) return null;
  if (!Array.isArray(prof.charms)) prof.charms = [];

  let entry = prof.charms.find((c) => c && c.id === charm.id);
  if (entry) {
    entry.plus = Math.min(5, (entry.plus || 0) + 1);
    entry.level = entry.plus + 1;
    if ((charm.bonus || 0) >= (entry.bonus || 0) || charm.grade === 'SS') {
      entry.grade = charm.grade;
      entry.stat = charm.stat;
      entry.bonus = charm.bonus;
      entry.stats = { ...(entry.stats || {}), [charm.stat]: charm.bonus };
    }
  } else {
    entry = {
      ...charm,
      plus: charm.plus || 0,
      level: (charm.plus || 0) + 1,
      stats: charm.stats || { [charm.stat]: charm.bonus },
    };
    prof.charms.push(entry);
  }

  const curBonus = prof.equipped_charm?.bonus || 0;
  if (!prof.equipped_charm || (entry.bonus || 0) >= curBonus) {
    prof.equipped_charm = { ...entry };
  }

  prof.equipped = prof.equipped || {};
  const curEqBonus =
    prof.equipped.charm?.bonus ||
    Object.values(prof.equipped.charm?.stats || {}).reduce((a, b) => a + (Number(b) || 0), 0);
  if (!prof.equipped.charm || (entry.bonus || 0) >= curEqBonus) {
    prof.equipped.charm = {
      uid: entry.uid,
      id: entry.id,
      name: entry.name,
      icon: entry.icon,
      tier: entry.tier || 1,
      grade: entry.grade || 'S',
      stat: entry.stat,
      bonus: entry.bonus,
      plus: entry.plus || 0,
      level: entry.level || 1,
      stats: { ...(entry.stats || { [entry.stat]: entry.bonus }) },
      auraKind: entry.auraKind || entry.id,
    };
  }

  return entry;
}
