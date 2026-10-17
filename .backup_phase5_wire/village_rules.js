// shared/village_rules.js — pure, deterministic village math shared by server (authoritative) and
// client (editor preview, bubbles, collision). No I/O, no Date.now(): callers pass `now`.
import {
  BASE_GRID, BRIDGE_GAP, COMFORT, CORE, CORE_LANDMARKS, DECOR, MAX_COPIES_PER_CORE, TILES, WONDERS,
  GROUND_SKINS, buildingCaps, footprint, placeable,
} from './catalog_landmarks.js';
import { PETS, PET_FAMILIES } from './catalog_gear_pets.js';

export const HOUR_MS = 3600_000;
export const MIN_HARVEST_MS = 60_000;
export const OFFLINE_REPORT_MS = 5 * 60_000;
export const ROT_VALUES = [0, 90, 180, 270];
export const BRIDGE_Z = { z0: 2, z1: 4 };      // deck strip (world z) — south of the canal row

export const utcDay = (now) => Math.floor(now / 86_400_000);
const isInt = (v) => Number.isInteger(v);

// ---------------------------------------------------------------------------------------------
// Normalisation / migration (older saves: Step 1 starter data used t:'road' and per-building lv)
// ---------------------------------------------------------------------------------------------
export function normalizeVillage(v, now = 0) {
  v = v || {};
  v.grid_size = isInt(v.grid_size) ? v.grid_size : BASE_GRID;
  v.castle_lv = Math.max(1, v.castle_lv | 0 || 1);
  v.mood = v.mood || 'auto';
  v.ground = GROUND_SKINS[v.ground] ? v.ground : 'ground_classic';
  v.buildings = Array.isArray(v.buildings) ? v.buildings : [];
  v.tiles = (Array.isArray(v.tiles) ? v.tiles : []).map((t) => ({ x: t.x, y: t.y, t: t.t === 'road' ? 'road_cobble' : t.t }));
  v.levels = v.levels || {};
  for (const k of CORE_LANDMARKS) {
    if (!isInt(v.levels[k])) v.levels[k] = Math.max(1, ...v.buildings.filter((b) => b.type === k).map((b) => b.lv | 0), 1);
  }
  v.copies = v.copies || {};
  for (const k of CORE_LANDMARKS) if (!isInt(v.copies[k])) v.copies[k] = 1;
  v.wonders = v.wonders || {};
  v.decor = v.decor || {};
  v.blueprints = v.blueprints || {};
  v.last_harvest_at = Number.isFinite(v.last_harvest_at) ? v.last_harvest_at : now;
  v.blessed_until = v.blessed_until || 0;
  v.daily_claim_day = v.daily_claim_day ?? null;
  let n = 0;
  for (const b of v.buildings) {
    b.rot = ROT_VALUES.includes(b.rot) ? b.rot : 0;
    b.uid = b.uid || b.id || `${b.type}_${n}`;
    delete b.id;
    n++;
  }
  syncBuildingLevels(v);
  v.comfort = computeComfort(v);
  return v;
}

/** Per-building `lv` is a display copy of the authoritative levels map / castle_lv / wonder stars. */
export function syncBuildingLevels(v) {
  for (const b of v.buildings) {
    if (b.type === 'castle') b.lv = v.castle_lv;
    else if (CORE[b.type]) b.lv = v.levels[b.type] || 1;
    else if (WONDERS[b.type]) b.lv = v.wonders[b.type]?.stars || 1;
    else delete b.lv;
  }
}

// ---------------------------------------------------------------------------------------------
// Cells + validation
// ---------------------------------------------------------------------------------------------
export function cellsOf(b) {
  const f = footprint(b.type, b.rot);
  const out = [];
  if (!f) return out;
  for (let y = b.y; y < b.y + f.h; y++) for (let x = b.x; x < b.x + f.w; x++) out.push([x, y]);
  return out;
}

/** Tiles where the Rainbow Heart Bridge lands on either side (no buildings / water allowed). */
export function landingCells(S) {
  const out = [];
  for (const gy of [S / 2 + BRIDGE_Z.z0, S / 2 + BRIDGE_Z.z0 + 1]) for (const gx of [0, S - 1]) out.push([gx, gy]);
  return out;
}

/** How many of each placeable the player owns (core copies / wonders / decor). */
export function ownedCount(v, type) {
  if (type === 'castle') return 1;
  if (CORE[type]) return Math.min(MAX_COPIES_PER_CORE, v.copies?.[type] ?? 1);
  if (WONDERS[type]) return v.wonders?.[type] ? 1 : 0;
  if (DECOR[type]) return v.decor?.[type] | 0;
  return 0;
}

/** Unplaced copies (the editor's bag). */
export function bagContents(v, buildings = v.buildings) {
  const placed = {};
  for (const b of buildings) placed[b.type] = (placed[b.type] || 0) + 1;
  const bag = {};
  for (const t of ['castle', ...CORE_LANDMARKS, ...Object.keys(WONDERS), ...Object.keys(DECOR)]) {
    const left = ownedCount(v, t) - (placed[t] || 0);
    if (left > 0) bag[t] = left;
  }
  return bag;
}

/**
 * Validate a proposed layout against the saved village (ownership, caps, footprints).
 * layout = { buildings: [{ uid?, type, x, y, rot }], tiles: [{ x, y, t }], ground? }
 * Returns { ok: true, buildings, tiles, ground } or { ok: false, error, at? }.
 */
export function validateLayout(v, layout, { maxTiles = 4096 } = {}) {
  const S = v.grid_size;
  const L = layout || {};
  if (!Array.isArray(L.buildings) || !Array.isArray(L.tiles)) return { ok: false, error: 'bad_layout' };
  if (L.buildings.length > 200 || L.tiles.length > Math.min(maxTiles, S * S)) return { ok: false, error: 'too_many_items' };
  const occ = new Map();
  const key = (x, y) => y * 64 + x;
  const counts = {};
  const out = [];
  const uids = new Set();
  const landing = new Set(landingCells(S).map(([x, y]) => key(x, y)));
  for (const raw of L.buildings) {
    const type = String(raw?.type || '');
    const d = placeable(type);
    if (!d) return { ok: false, error: 'unknown_type', at: type };
    const rot = ROT_VALUES.includes(raw.rot) ? raw.rot : 0;
    const x = raw.x, y = raw.y;
    if (!isInt(x) || !isInt(y)) return { ok: false, error: 'bad_coords', at: type };
    const f = footprint(type, rot);
    if (x < 0 || y < 0 || x + f.w > S || y + f.h > S) return { ok: false, error: 'out_of_bounds', at: type };
    let uid = typeof raw.uid === 'string' && raw.uid.length <= 40 ? raw.uid : '';
    if (!uid || uids.has(uid)) uid = `${type}_${out.length}_${x}_${y}`;
    uids.add(uid);
    const b = { uid, type, x, y, rot };
    for (const [cx, cy] of cellsOf(b)) {
      const k = key(cx, cy);
      if (occ.has(k)) return { ok: false, error: 'overlap', at: type };
      if (landing.has(k)) return { ok: false, error: 'bridge_landing', at: type };
      occ.set(k, uid);
    }
    counts[type] = (counts[type] || 0) + 1;
    out.push(b);
  }
  // ownership + caps
  const caps = buildingCaps(v.castle_lv);
  let coreTotal = 0, wonderTotal = 0;
  for (const [type, n] of Object.entries(counts)) {
    if (n > ownedCount(v, type)) return { ok: false, error: 'not_owned', at: type };
    if (CORE[type] && type !== 'castle') coreTotal += n;
    if (WONDERS[type]) wonderTotal += n;
  }
  if (coreTotal > caps.core) return { ok: false, error: 'core_cap', at: caps.core };
  if (wonderTotal > caps.wonders) return { ok: false, error: 'wonder_cap', at: caps.wonders };

  // tiles
  const tiles = [];
  const tileAt = new Map();
  for (const raw of L.tiles) {
    const t = String(raw?.t || '');
    if (!TILES[t]) return { ok: false, error: 'unknown_tile', at: t };
    const { x, y } = raw;
    if (!isInt(x) || !isInt(y) || x < 0 || y < 0 || x >= S || y >= S) return { ok: false, error: 'tile_out_of_bounds' };
    const k = key(x, y);
    if (tileAt.has(k)) return { ok: false, error: 'duplicate_tile' };
    if (occ.has(k)) return { ok: false, error: 'tile_under_building' };
    if (TILES[t].water && landing.has(k)) return { ok: false, error: 'bridge_landing' };
    tileAt.set(k, t);
    tiles.push({ x, y, t });
  }
  // the dock must touch water or the coastline (Section 21.L.2)
  for (const b of out) {
    if (!placeable(b.type).needsWater) continue;
    const f = footprint(b.type, b.rot);
    let ok = b.x === 0 || b.y === 0 || b.x + f.w === S || b.y + f.h === S;
    const edge = [];
    for (let i = 0; i < f.w; i++) edge.push([b.x + i, b.y - 1], [b.x + i, b.y + f.h]);
    for (let j = 0; j < f.h; j++) edge.push([b.x - 1, b.y + j], [b.x + f.w, b.y + j]);
    if (!ok) ok = edge.some(([cx, cy]) => TILES[tileAt.get(key(cx, cy))]?.water);
    if (!ok) return { ok: false, error: 'dock_needs_water', at: b.uid };
  }
  const ground = L.ground && GROUND_SKINS[L.ground] ? L.ground : v.ground;
  return { ok: true, buildings: out, tiles, ground };
}

// ---------------------------------------------------------------------------------------------
// Comfort, caps, multipliers, production
// ---------------------------------------------------------------------------------------------
export function computeComfort(v) {
  let c = 0;
  const decorSeen = {};
  let decor = 0;
  for (const b of v.buildings) {
    if (b.type === 'castle') c += COMFORT.CASTLE_PER_LV * v.castle_lv;
    else if (CORE[b.type]) c += COMFORT.CORE_PER_LV * (v.levels?.[b.type] || 1);
    else if (WONDERS[b.type]) c += COMFORT.WONDER_PER_STAR * (v.wonders?.[b.type]?.stars || 1);
    else if (DECOR[b.type]) { decor += decorSeen[b.type] ? COMFORT.DECOR_DUPE : COMFORT.DECOR_FIRST; decorSeen[b.type] = 1; }
  }
  c += Math.min(COMFORT.DECOR_CAP, decor);
  c += Math.min(COMFORT.TILE_CAP, v.tiles.length * COMFORT.TILE);
  return c;
}

export const comfortBonusPct = (comfort) => Math.min(COMFORT.YIELD_CAP_PCT, Math.floor(comfort / COMFORT.YIELD_DIV));

const placedTypes = (v) => new Set(v.buildings.map((b) => b.type));

const LEGACY_CHONKERS = new Set(['pet_cloud_bear', 'pet_yuzu_capybara', 'pet_world_turtle']);

/** Chill Chonker / Sky Whale / Royal Ragdoll "Idle Tycoon": +25% (★1) → +50% (★3) offline storage. */
export function chonkerStorageBonus(profile) {
  const pet = profile?.equipped?.pet;
  if (!pet?.id) return 0;
  const def = PETS[pet.id];
  const isChonkerOrWhale = LEGACY_CHONKERS.has(pet.id)
    || pet.id === 'pet_skywhale'
    || PET_FAMILIES[def?.family]?.passive === 'idle_tycoon'
    || (pet.id === 'pet_ragdoll' && (pet.stars || 0) >= 2);
  if (!isChonkerOrWhale) return 0;
  const fallbackRarity = pet.id === 'pet_yuzu_capybara' ? 2 : pet.id === 'pet_world_turtle' ? 3 : (def?.rarity || 1);
  const stars = Math.max(1, Math.min(3, pet.stars ?? fallbackRarity));
  return 0.25 + (stars - 1) * 0.125;
}

/** Locked Step 2 rule — one cap for calculateHarvest and computeOfflineGains. */
export function storageCapHrs(v, profile) {
  const dockLv = Math.max(1, Math.min(10, v.levels?.dock || 1));
  const base = 8 + (16 * (dockLv - 1)) / 9;
  const types = placedTypes(v);
  const casino = types.has('wnd_casino_dome') ? 2 : 1;
  const tent = types.has('dec_tent') ? DECOR.dec_tent.buff.storagePct / 100 : 0;
  return base * casino * (1 + chonkerStorageBonus(profile) + tent);
}

export function yieldMultipliers(v, { now = 0, coupled = false } = {}) {
  const types = placedTypes(v);
  const base = 1 + v.castle_lv * 0.02 + comfortBonusPct(computeComfort(v)) / 100
    + (coupled ? 0.25 : 0) + (now < (v.blessed_until || 0) ? 0.15 : 0);
  return {
    gold: base + (types.has('dec_swing') ? DECOR.dec_swing.buff.goldPct / 100 : 0),
    berries: base + (types.has('dec_picnic') ? DECOR.dec_picnic.buff.berriesPct / 100 : 0),
    base,
  };
}

export function productionPerHour(v) {
  const r = { gold: 0, berries: 0 };
  for (const b of v.buildings) {
    const d = CORE[b.type];
    if (d?.produces) r[d.produces] += d.perHour(v.levels?.[b.type] || 1);
  }
  return r;
}

/** Daily diamonds (Shrine + World-Tree), claimable once per UTC day. */
export function dailyDiamonds(v, now) {
  if (v.daily_claim_day === utcDay(now)) return 0;
  let d = 0;
  for (const b of v.buildings) {
    if (CORE[b.type]?.daily === 'diamonds') d += CORE[b.type].perDay(v.levels?.[b.type] || 1);
    if (b.type === 'wnd_world_tree') d += WONDERS.wnd_world_tree.perDay(v.wonders?.wnd_world_tree?.stars || 1);
  }
  return d;
}

/**
 * What Harvest All would pay right now (no RNG: Double Jackpot is rolled by the server on claim).
 * Server-authoritative clock: `now` must be the server's Date.now().
 */
export function harvestPreview(profile, now, { coupled = false } = {}) {
  const v = profile.village;
  const elapsedMs = Math.max(0, now - (v.last_harvest_at || now));
  const capHrs = storageCapHrs(v, profile);
  const hrs = Math.min(capHrs, elapsedMs / HOUR_MS);
  const rate = productionPerHour(v);
  const mult = yieldMultipliers(v, { now, coupled });
  const diamonds = dailyDiamonds(v, now);
  const ready = elapsedMs >= MIN_HARVEST_MS;
  return {
    elapsedMs, capHrs, hrs, full: elapsedMs / HOUR_MS >= capHrs,
    gold: ready ? Math.floor(rate.gold * hrs * mult.gold) : 0,
    berries: ready ? Math.floor(rate.berries * hrs * mult.berries) : 0,
    diamonds, ready: ready || diamonds > 0, rate, mult,
  };
}

// ---------------------------------------------------------------------------------------------
// Twin Sky-Islands layout (Section 21.B). Both clients share ONE world frame per instance: the
// alphabetically-first owner's island sits at X = 0, the partner's across the 16 m bridge.
// ---------------------------------------------------------------------------------------------
export function instanceLayout(entries) {
  // entries: [{ owner, village }] (1 = solo, 2 = couple)
  const list = [...entries].sort((a, b) => (a.owner < b.owner ? -1 : 1));
  const islands = [];
  const S0 = list[0].village.grid_size;
  islands.push({ owner: list[0].owner, S: S0, cx: 0, village: list[0].village });
  let bridge = null;
  if (list[1]) {
    const S1 = list[1].village.grid_size;
    const cx = S0 / 2 + BRIDGE_GAP + S1 / 2;             // PartnerCenterX = S/2 + 16 + S_partner/2
    islands.push({ owner: list[1].owner, S: S1, cx, village: list[1].village });
    bridge = { x0: S0 / 2, x1: S0 / 2 + BRIDGE_GAP, cx: S0 / 2 + BRIDGE_GAP / 2, ...BRIDGE_Z };
  }
  return { islands, bridge };
}

export const islandOf = (layout, owner) => layout.islands.find((i) => i.owner === owner) || null;

export function islandAt(layout, x, z) {
  for (const i of layout.islands) if (Math.abs(x - i.cx) < i.S / 2 && Math.abs(z) < i.S / 2) return i;
  return null;
}

export const cellToWorld = (island, gx, gy, w = 1, h = 1) => ({ x: island.cx - island.S / 2 + gx + w / 2, z: -island.S / 2 + gy + h / 2 });
export const worldToCell = (island, x, z) => ({ gx: Math.floor(x - island.cx + island.S / 2), gy: Math.floor(z + island.S / 2) });

/** Per-island lookup grids (rebuild whenever a village changes). */
export function buildCellIndex(island) {
  const S = island.S, v = island.village;
  const solid = new Uint8Array(S * S);           // 1 = building footprint
  const tile = new Array(S * S).fill(null);
  for (const t of v.tiles) if (t.x >= 0 && t.y >= 0 && t.x < S && t.y < S) tile[t.y * S + t.x] = t.t;
  const owner = new Array(S * S).fill(null);
  for (const b of v.buildings) for (const [x, y] of cellsOf(b)) if (x >= 0 && y >= 0 && x < S && y < S) { solid[y * S + x] = 1; owner[y * S + x] = b; }
  island.index = { solid, tile, owner };
  return island.index;
}

export function onBridge(layout, x, z) {
  const b = layout.bridge;
  return !!b && x >= b.x0 - 0.01 && x <= b.x1 + 0.01 && z >= b.z0 && z <= b.z1;
}

/** Ground query for movement: { walkable, road, water, building } */
export function groundAt(layout, x, z, { canFly = false } = {}) {
  if (onBridge(layout, x, z)) return { walkable: true, road: true, water: false, building: null };
  const isl = islandAt(layout, x, z);
  if (!isl) return { walkable: false };
  const idx = isl.index || buildCellIndex(isl);
  const { gx, gy } = worldToCell(isl, x, z);
  const i = gy * isl.S + gx;
  const t = idx.tile[i];
  const water = !!TILES[t]?.water;
  const building = idx.owner[i];
  return { walkable: !building && (!water || canFly), road: !!(TILES[t]?.road || TILES[t]?.bridge), water, building, island: isl };
}

/** Server sanity clamp: keep a position inside the islands ∪ bridge (no building collision). */
export function clampToArea(layout, x, z) {
  if (onBridge(layout, x, z) || islandAt(layout, x, z)) return { x, z, clamped: false };
  let best = null;
  const consider = (px, pz) => { const d = Math.hypot(px - x, pz - z); if (!best || d < best.d) best = { x: px, z: pz, d }; };
  for (const i of layout.islands) {
    const h = i.S / 2 - 0.05;
    consider(Math.max(i.cx - h, Math.min(i.cx + h, x)), Math.max(-h, Math.min(h, z)));
  }
  const b = layout.bridge;
  if (b) consider(Math.max(b.x0, Math.min(b.x1, x)), Math.max(b.z0 + 0.05, Math.min(b.z1 - 0.05, z)));
  return { x: best.x, z: best.z, clamped: true };
}

export function spawnPoint(layout, owner, lineage) {
  const isl = islandOf(layout, owner) || layout.islands[0];
  const lane = lineage === 'dxb' ? 1.6 : -1.6;
  return { x: isl.cx + lane, z: 2.5 };
}

/** Nearest dock within `reach` metres of (x, z) on any island of the instance. */
export function dockNear(layout, x, z, reach) {
  let best = null;
  for (const isl of layout.islands) {
    for (const b of isl.village.buildings) {
      if (b.type !== 'dock') continue;
      const f = footprint(b.type, b.rot);
      const c = cellToWorld(isl, b.x, b.y, f.w, f.h);
      const dx = Math.max(0, Math.abs(x - c.x) - f.w / 2), dz = Math.max(0, Math.abs(z - c.z) - f.h / 2);
      const d = Math.hypot(dx, dz);
      if (d <= reach && (!best || d < best.d)) best = { d, island: isl, building: b, center: c };
    }
  }
  return best;
}

/** Placed building by uid anywhere in the instance + distance from (x, z) to its footprint. */
export function findPlaced(layout, uid, x = 0, z = 0) {
  for (const isl of layout.islands) {
    const b = isl.village.buildings.find((q) => q.uid === uid);
    if (!b) continue;
    const f = footprint(b.type, b.rot);
    const c = cellToWorld(isl, b.x, b.y, f.w, f.h);
    const d = Math.hypot(Math.max(0, Math.abs(x - c.x) - f.w / 2), Math.max(0, Math.abs(z - c.z) - f.h / 2));
    return { island: isl, building: b, center: c, d };
  }
  return null;
}
