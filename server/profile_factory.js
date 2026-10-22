// server/profile_factory.js — starter profiles (Section 21.M.2) and pre-seeded QA accounts (Section 21.F.3).
import crypto from 'node:crypto';
import { recalcPlayerCP } from '../shared/progression.js';
import { normalizeVillage, validateLayout, syncBuildingLevels, computeComfort } from '../shared/village_rules.js';
import { BASE_GRID, footprint, CORE, EXPANSION_TIERS } from '../shared/catalog_landmarks.js';
import { defaultStory, maxIslandSize, unlockedMonuments } from '../shared/story_rules.js';
import { OUTFITS } from '../shared/costumes_catalog.js';
import { ACCESSORIES, PET_IDS } from '../shared/catalog_gear_pets.js';
import { HAIRSTYLES, HAIR_COLORS } from '../shared/hair_catalog.js';

export const LINEAGES = ['bkk', 'dxb', 'boy', 'girl'];
export const STARTER_PET = { bkk: 'pet_nyx', dxb: 'pet_ragdoll', boy: 'pet_nyx', girl: 'pet_ragdoll' }; // Screen 24 starter eggs

export function defaultFrontier() {
  return {
    v: 1,
    energy: { cur: 200, max: 200, lastRegenAt: 0, dailyFreeDay: -1, diamondRefillsDay: -1, diamondRefillsCount: 0, partnerGiftDay: -1 },
    chapter: 0,
    chapterSteps: {},
    unlocks: { regions: ['meadow'], gates: [] },
    toolbelt: { pickaxe: 1, axe: 1, staff: 0, main: 'pickaxe', enchants: {} },
    ultimateCharmUid: null,
    mealBuff: null,
    foodPouch: [null, null, null, null],
    warehouse: { lv: 1, items: {} },
    pantry: { lv: 1, items: {} },
    campCrate: { items: {}, expiresAt: 0 },
    homeShardId: null,
    discoveries: [],
    claimedRewards: {},
    stats: { nodes: 0, perfects: 0, invasions: 0, bosses: 0, mentorAssists: 0 },
  };
}

function isPlainObject(val) {
  return val !== null && typeof val === 'object' && !Array.isArray(val) && Object.prototype.toString.call(val) === '[object Object]';
}

export function deepFill(target, defaults) {
  if (!isPlainObject(target) || !isPlainObject(defaults)) return target;
  for (const [key, defaultVal] of Object.entries(defaults)) {
    if (!(key in target) || target[key] === undefined) {
      target[key] = structuredClone(defaultVal);
    } else if (isPlainObject(defaultVal) && isPlainObject(target[key])) {
      deepFill(target[key], defaultVal);
    }
  }
  return target;
}

export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(password), salt, 32).toString('hex');
  return { salt, hash };
}

export function verifyPassword(password, salt, hash) {
  const test = crypto.scryptSync(String(password), salt, 32);
  const ref = Buffer.from(hash, 'hex');
  return ref.length === test.length && crypto.timingSafeEqual(ref, test);
}

// Starter 18x18 cozy pocket island (Section 21.M.2), adjusted to the locked Step 2 footprints:
//   • Central 2-wide N–S cobblestone avenue at x = 8..9 (y = 5..15) + Castle crossroad arms at y = 5.
//   • E–W crystal water canal at y = 9 (x = 0..17) with central stone footbridge at x = 8..9.
function starterTiles() {
  const tiles = [];
  for (let y = 5; y <= 15; y++) for (let x = 8; x <= 9; x++) if (y !== 9) tiles.push({ x, y, t: 'road_cobble' });
  for (const x of [6, 7, 10, 11]) tiles.push({ x, y: 5, t: 'road_cobble' });
  for (let x = 0; x <= 17; x++) tiles.push({ x, y: 9, t: x === 8 || x === 9 ? 'bridge' : 'water' });
  return tiles;
}

/** Stage 3 base-camp fields on a village (idempotent). */
export function ensureBasecampFields(v, story = null) {
  v.v2 = true;
  if (!v.production || typeof v.production !== 'object' || Array.isArray(v.production)) v.production = {};
  if (!v.plots || typeof v.plots !== 'object' || Array.isArray(v.plots)) v.plots = {};
  if (!Array.isArray(v.residents)) v.residents = [];
  if (!Array.isArray(v.monument_unlocks)) v.monument_unlocks = [];
  for (const m of unlockedMonuments(story)) if (!v.monument_unlocks.includes(m)) v.monument_unlocks.push(m);
  const storyMax = maxIslandSize(story);
  v.max_grid = Math.max(Number.isInteger(v.max_grid) ? v.max_grid : BASE_GRID, storyMax);
  v.copies = v.copies || {};
  return v;
}

/** "Keep everything, auto-credit": every placed core copy becomes an owned (constructed) copy. */
export function creditPlacedCopies(v) {
  v.copies = v.copies || {};
  const placed = {};
  for (const b of v.buildings || []) if (CORE[b.type] && b.type !== 'castle') placed[b.type] = (placed[b.type] || 0) + 1;
  for (const [type, n] of Object.entries(placed)) v.copies[type] = Math.max(v.copies[type] | 0, n);
  return v;
}

/** Stage 3 new-player island: only the Castle (as ruins) + 2 starter farm plots. */
function starterVillage(now = Date.now()) {
  const v = normalizeVillage({
    v2: true,
    grid_size: 18,
    castle_lv: 1,
    castle_ruins: true,
    mood: 'auto',
    ground: 'ground_classic',
    levels: {},
    copies: { farm_plot: 2 },
    buildings: [
      { uid: 'castle', type: 'castle', x: 7, y: 1, rot: 0 },
      { uid: 'farm_plot_1', type: 'farm_plot', x: 3, y: 11, rot: 0 },
      { uid: 'farm_plot_2', type: 'farm_plot', x: 5, y: 11, rot: 0 },
    ],
    tiles: starterTiles(),
    last_harvest_at: now,
  }, now);
  return ensureBasecampFields(v);
}

/** The pre-Stage-3 starter island (5 landmarks + castle) — QA seeds and the legacy migration fallback. */
export function legacyStarterVillage(now = Date.now()) {
  return normalizeVillage({
    grid_size: 18,
    castle_lv: 1,
    mood: 'auto',
    ground: 'ground_classic',
    levels: { mint: 1, shrine: 1, patisserie: 1, nest: 1, dock: 1 },
    buildings: [
      { uid: 'castle', type: 'castle', x: 7, y: 1, rot: 0 },
      { uid: 'mint', type: 'mint', x: 2, y: 3, rot: 0 },
      { uid: 'patisserie', type: 'patisserie', x: 13, y: 3, rot: 0 },
      { uid: 'shrine', type: 'shrine', x: 6, y: 7, rot: 0 },
      { uid: 'nest', type: 'nest', x: 2, y: 10, rot: 0 },
      { uid: 'dock', type: 'dock', x: 13, y: 10, rot: 0 },
    ],
    tiles: starterTiles(),
    last_harvest_at: now,
  }, now);
}

/** Pre-Step-2 saves: migrate fields, repair the two known starter conflicts, never lose progress. */
export function migrateProfile(p, now = Date.now()) {
  if (p.partner_id === 'beam') p.partner_id = 'neen';
  if (Array.isArray(p.friends)) {
    p.friends = Array.from(new Set(p.friends.map((f) => (f === 'beam' ? 'neen' : f))));
  }
  const wasV2 = !!p.village?.v2;
  const v = normalizeVillage(p.village || starterVillage(now), now);
  // Stage 3 ownership v2: credit every placed core building BEFORE validating ownership.
  if (!wasV2) creditPlacedCopies(v);
  if (!p.story || typeof p.story !== 'object' || typeof p.story.chapter !== 'number') p.story = defaultStory();
  ensureBasecampFields(v, p.story);
  for (const b of v.buildings) {
    if (b.type === 'shrine' && b.x === 10 && b.y === 10) b.x = 9;
    if (b.type === 'dock' && b.x === 18 && b.y === 19) b.y = 13;
  }
  // v2 base camps keep story-unlocked expansions; legacy saves are shrunk back to the base island.
  const keepGrid = wasV2 && EXPANSION_TIERS.some((t) => t.size === v.grid_size) && v.grid_size <= v.max_grid;
  if (!keepGrid) v.grid_size = BASE_GRID;
  const G = v.grid_size;
  if (Array.isArray(v.tiles)) {
    v.tiles = v.tiles.filter((t) => t && t.x >= 0 && t.y >= 0 && t.x < G && t.y < G);
  }
  let check = validateLayout(v, v);
  if (!check.ok) {
    // If any building is out-of-bounds for 18×18, remove non-core wonder/decor items back to the bag first
    const isCore = (type) => type === 'castle' || Boolean(CORE[type]);
    const prevCount = v.buildings.length;
    v.buildings = v.buildings.filter((b) => {
      const f = footprint(b.type, b.rot || 0);
      const oob = !f || b.x < 0 || b.y < 0 || b.x + f.w > G || b.y + f.h > G;
      if (oob && !isCore(b.type)) return false;
      return true;
    });
    if (v.buildings.length < prevCount) {
      check = validateLayout(v, v);
    }
  }
  if (!check.ok) {
    // last resort: keep levels / ownership, restore the starter positions
    const fresh = wasV2 ? starterVillage(now) : legacyStarterVillage(now);
    v.grid_size = fresh.grid_size;
    v.buildings = fresh.buildings; v.tiles = fresh.tiles;
    creditPlacedCopies(v);
    check = validateLayout(v, v);
  }
  if (check.ok) { v.buildings = check.buildings; v.tiles = check.tiles; }
  v.decor = v.decor || {};
  for (const k of ['dec_heaven_winged_pillar', 'dec_heaven_cloud_arch', 'dec_heaven_divine_tree', 'dec_heaven_lotus_fountain', 'dec_heaven_seraph_harp']) {
    if (!v.decor[k]) v.decor[k] = 2;
  }
  if ((p.username === 'nook' || p.username === 'neen') && !v.decor.dec_nookairline_museum) {
    v.decor.dec_nookairline_museum = 2;
  }
  syncBuildingLevels(v);
  v.comfort = computeComfort(v);
  p.village = v;
  p.fish_codex = p.fish_codex || {};
  if (!p.fish_basket || typeof p.fish_basket !== 'object') {
    p.fish_basket = {
      minnow: p.fish_codex.minnow | 0,
      crab: p.fish_codex.crab | 0,
      koi: p.fish_codex.koi | 0,
      chest: p.fish_codex.chest | 0,
    };
  }
  p.fish_records = p.fish_records || {};
  p.fish_bait_pity = p.fish_bait_pity | 0;
  p.fish_target_item = p.fish_target_item || null;
  p.buffs = p.buffs || {};
  p.bless_day = p.bless_day ?? null;
  p.fountain_day = p.fountain_day ?? null;
  p.star_essence = p.star_essence | 0;
  if (p.id === 'nook') {
    if (!p.email || p.email === 'nook@gmail.com') {
      p.email = 'sir.thanapat@gmail.com';
      p.email_bound_at = p.email_bound_at || Date.parse('2026-10-12T18:02:37.759Z');
      p.email_reward_claimed = true;
    }
    p.auth_uid = p.auth_uid || 'f1ce659f-b220-4d94-827e-e49d0d298089';
    if (!p._v1DiamondsMigrated) {
      p.diamonds = Math.max(p.diamonds || 0, 21710);
      p._v1DiamondsMigrated = true;
    }
  } else if (p.id === 'neen') {
    if (!p.email || p.email === 'neen@gmail.com') {
      p.email = 'neen.bunyanuch@gmail.com';
      p.email_bound_at = p.email_bound_at || Date.parse('2026-10-12T21:34:31.667Z');
      p.email_reward_claimed = true;
    }
    p.auth_uid = p.auth_uid || '50b5e047-5b18-42dd-b518-090692af73bf';
    if (!p._v1DiamondsMigrated) {
      p.diamonds = Math.max(p.diamonds || 0, 22304);
      p._v1DiamondsMigrated = true;
    }
  }
  p.email = p.email || null;
  p.email_bound_at = p.email_bound_at || null;
  p.email_reward_claimed = !!p.email_reward_claimed;
  if (!p.frontier || typeof p.frontier !== 'object' || Array.isArray(p.frontier)) {
    p.frontier = defaultFrontier();
  } else {
    deepFill(p.frontier, defaultFrontier());
  }
  p.frontier.pantry ||= { lv: 1, items: {} };
  if (p.orders === undefined) p.orders = null;   // order board is created lazily (basecamp_service.orderBoard)
  return p;
}

const eq = (id, refine = 0) => ({ id, refine });

function baseProfile(username, lineage, appearanceOpts = {}) {
  const now = Date.now();
  const isGirl = lineage === 'dxb' || lineage === 'girl' || appearanceOpts?.body === 'girl';
  const normLineage = isGirl ? 'dxb' : 'bkk';
  const body = isGirl ? 'girl' : 'boy';
  const defaultHair = isGirl ? 'hair_girl_waves' : 'hair_boy_fluffy';
  const defaultColor = isGirl
    ? (lineage === 'dxb' && !appearanceOpts?.hairColor ? 'coral' : 'chestnut')
    : (lineage === 'bkk' && !appearanceOpts?.hairColor ? 'silver' : 'chestnut');
  const hair = appearanceOpts?.hair || defaultHair;
  const hairColor = appearanceOpts?.hairColor || defaultColor;
  const petId = STARTER_PET[normLineage];
  const starterInventory = isGirl
    ? { newbie_outfit: { refine: 0, dupes: 0 }, hat_dragon_horns: { refine: 0, dupes: 0 }, back_dragon_tail: { refine: 0, dupes: 0 } }
    : { newbie_outfit: { refine: 0, dupes: 0 }, hat_wolf_ears: { refine: 0, dupes: 0 }, back_wolf_tail: { refine: 0, dupes: 0 } };
  const starterSlot = isGirl
    ? { stat: 'fortune', tier: 'rare', value: 0.07, locked: false }
    : { stat: 'power', tier: 'rare', value: 0.07, locked: false };
  return {
    id: username,
    username,
    lineage: normLineage,
    appearance: { body, hair, hairColor },
    owned_hairs: Array.from(new Set(['hair_boy_fluffy', 'hair_girl_waves', hair])),
    unlocked_hair_colors: Array.from(new Set(['chestnut', 'midnight', 'honey', 'silver', hairColor])),
    hair_pity: { royal: 0, celestial: 0 },
    title: null,
    level: 1,
    exp: 0,
    gold: 2500,
    berries: 300,
    diamonds: 600,
    shards: 50,
    star_essence: 0,
    bag_items: { ticket_standard: 5, ticket_gold: 2, ticket_royal_hair: 2, streak_freeze: 1, scroll_forge_boost: 2, random_dupe_box: 1 },
    inventory: starterInventory,
    equipped: { outfit: eq('newbie_outfit'), hat: null, face: null, gloves: null, boots: null, wings: null, pet: null },
    pets: [{
      id: petId,
      stars: 1,
      visual_tier: 1,
      essence: 0,
      spent_essence: 0,
      nickname: '',
      bond_lv: 1,
      bond_xp: 0,
      last_gift_day: '',
      last_harmony_day: '',
      last_interact_at: 0,
      slots: [starterSlot, null, null],
      level: 1,
      mood: 100,
      traits: [],
    }],
    village: starterVillage(now),
    fish_codex: {},
    fish_basket: {},
    fish_records: {},
    fish_bait_pity: 0,
    fish_target_item: null,
    buffs: {},
    bless_day: null,
    fountain_day: null,
    partner_id: null,
    couple_streak: 0,
    friends: [],
    ftue_step: 0,
    a2hs_claimed: false,
    founder: false,
    email: null,
    email_bound_at: null,
    email_reward_claimed: false,
    frontier: defaultFrontier(),
    story: defaultStory(),
    orders: null,
    created_at: now,
    last_active_ts: now,
  };
}

export function createStarterProfile(username, password, lineage, appearanceOpts = {}) {
  const p = baseProfile(username, LINEAGES.includes(lineage) ? lineage : 'bkk', appearanceOpts);
  const pet = p.pets[0];
  p.equipped.pet = { id: pet.id, stars: 1, visual_tier: 1, level: 1 };
  Object.assign(p, hashPassword(password));
  p.cp = recalcPlayerCP(p);
  return p;
}

export function defaultProfile({ id, username, passHash, lineage = 'bkk', ...appearanceOpts } = {}) {
  const uname = username || id || 'player';
  const p = baseProfile(uname, LINEAGES.includes(lineage) ? lineage : 'bkk', appearanceOpts);
  if (id) p.id = id;
  if (passHash) p.hash = passHash;
  const pet = p.pets[0];
  p.equipped.pet = { id: pet.id, stars: 1, visual_tier: 1, level: 1 };
  p.cp = recalcPlayerCP(p);
  return p;
}

// ---------------------------------------------------------------------------
// QA seed accounts — loadouts chosen so CP matches Screens 07 / 26 / 27 (15,420)
// ---------------------------------------------------------------------------
function seed(username, lineage, extra) {
  const p = baseProfile(username, lineage);
  Object.assign(p, extra);
  Object.assign(p, hashPassword('1234'));
  p.founder = true; // V1 veteran list (Section 16.C.4) — chest UI arrives in Step 5
  p.cp = recalcPlayerCP(p);
  return p;
}

export function seedProfiles() {
  const nook = seed('nook', 'bkk', {
    level: 28, exp: 0, gold: 24500, berries: 840, diamonds: 21710, shards: 420, star_essence: 45,
    email: 'sir.thanapat@gmail.com', email_bound_at: Date.parse('2026-10-12T18:02:37.759Z'), email_reward_claimed: true, auth_uid: 'f1ce659f-b220-4d94-827e-e49d0d298089',
    partner_id: 'neen', couple_since: '2026-10-05', couple_streak: 14, friends: ['neen', 'mochi', 'leo'], ftue_step: 3, a2hs_claimed: true,
    inventory: {
      newbie_outfit: { refine: 0, dupes: 0 }, s11_zeus_olympus: { refine: 10, dupes: 0 }, s8_glacial_elsa: { refine: 0, dupes: 0 },
      hat_glowing_bunny: { refine: 10, dupes: 0 }, face_rosegold_shades: { refine: 8, dupes: 0 }, gloves_vorax_cyan: { refine: 10, dupes: 0 },
      boots_hermes_greaves: { refine: 10, dupes: 0 }, wings_golden_seraphim: { refine: 9, dupes: 0 },
      hat_wolf_ears: { refine: 0, dupes: 0 }, back_wolf_tail: { refine: 0, dupes: 0 },
    },
    equipped: {
      outfit: eq('s11_zeus_olympus', 10), hat: eq('hat_glowing_bunny', 10), face: eq('face_rosegold_shades', 8),
      gloves: eq('gloves_vorax_cyan', 10), boots: eq('boots_hermes_greaves', 10), wings: eq('wings_golden_seraphim', 9),
      pet: { id: 'pet_nyx', stars: 3, visual_tier: 3, nickname: 'Nyx', bond_lv: 20, level: 20 },
    },
    pets: [
      {
        id: 'pet_nyx', stars: 3, visual_tier: 3, essence: 30, spent_essence: 160, nickname: 'Nyx',
        bond_lv: 20, bond_xp: 120, last_gift_day: '', last_harmony_day: '', last_interact_at: 0,
        slots: [
          { stat: 'power', tier: 'mythic', value: 0.16, locked: true },
          { stat: 'swiftness', tier: 'epic', value: 0.11, locked: false },
          null,
        ],
        level: 20, mood: 100, traits: ['double_jackpot', 'mach_wing', 'treasure_sniffer'],
      },
      {
        id: 'pet_skywhale', stars: 1, visual_tier: 1, essence: 15, spent_essence: 0, nickname: 'Bubbles',
        bond_lv: 3, bond_xp: 40, last_gift_day: '', last_harmony_day: '', last_interact_at: 0,
        slots: [{ stat: 'cozy_purr', tier: 'rare', value: 0.08, locked: false }, null, null],
        level: 10, mood: 100, traits: ['cozy_purr', null, null],
      },
    ],
  });
  // Comfort 4,850 = Castle Lv6 900 + landmarks 27 Lv 2,700 + Ferris ★1 300 + Onsen ★1 300
  //               + 3 unique decor 360 + 58 paved/water tiles 290 (Screen 02 "+24%")
  nook.village = seedVillage({
    castle_lv: 6, levels: { mint: 7, patisserie: 6, shrine: 5, nest: 4, dock: 5 },
    wonders: { wnd_ferris: { stars: 1 }, wnd_onsen: { stars: 1 } },
    decor: { dec_swing: 1, dec_picnic: 1, dec_gramophone: 1 },
    // wnd_ferris is Heart-Isle-only (Master Plan v2 §12): owned here, placed on the couple's Heart Isle.
    place: [['wnd_onsen', 2, 13], ['dec_swing', 11, 6], ['dec_picnic', 5, 13], ['dec_gramophone', 10, 6]],
    roads: [...range(5, 10).map((x) => [x, 16]), ...range(5, 10).map((x) => [x, 17]), [5, 5], [12, 5], [10, 7], [10, 8]],
  });

  const neen = seed('neen', 'dxb', {
    level: 28, exp: 0, gold: 22000, berries: 910, diamonds: 29128, shards: 400, star_essence: 60,
    email: 'neen.bunyanuch@gmail.com', email_bound_at: Date.parse('2026-10-12T21:34:31.667Z'), email_reward_claimed: true, auth_uid: '50b5e047-5b18-42dd-b518-090692af73bf',
    partner_id: 'nook', couple_since: '2026-10-05', couple_streak: 14, friends: ['nook', 'mochi', 'leo'], ftue_step: 3, a2hs_claimed: true,
    inventory: {
      newbie_outfit: { refine: 0, dupes: 0 }, s8_glacial_elsa: { refine: 10, dupes: 0 }, s2_kitsune_inari: { refine: 0, dupes: 0 },
      hat_glowing_bunny: { refine: 10, dupes: 0 }, hat_cat_headset: { refine: 0, dupes: 0 }, face_rosegold_shades: { refine: 8, dupes: 0 },
      gloves_cat_mittens: { refine: 10, dupes: 0 }, gloves_starlight_wand: { refine: 0, dupes: 0 },
      boots_hermes_greaves: { refine: 9, dupes: 0 }, wings_golden_seraphim: { refine: 10, dupes: 0 },
      hat_dragon_horns: { refine: 0, dupes: 0 }, back_dragon_tail: { refine: 0, dupes: 0 },
    },
    equipped: {
      outfit: eq('s8_glacial_elsa', 10), hat: eq('hat_glowing_bunny', 10), face: eq('face_rosegold_shades', 8),
      gloves: eq('gloves_cat_mittens', 10), boots: eq('boots_hermes_greaves', 9), wings: eq('wings_golden_seraphim', 10),
      pet: { id: 'pet_ragdoll', stars: 2, visual_tier: 2, nickname: 'Mochi Princess', bond_lv: 10, level: 20 },
    },
    pets: [
      {
        id: 'pet_ragdoll', stars: 2, visual_tier: 2, essence: 50, spent_essence: 40, nickname: 'Mochi Princess',
        bond_lv: 10, bond_xp: 90, last_gift_day: '', last_harmony_day: '', last_interact_at: 0,
        slots: [
          { stat: 'fortune', tier: 'mythic', value: 0.16, locked: true },
          { stat: 'cozy_purr', tier: 'epic', value: 0.12, locked: false },
          null,
        ],
        level: 20, mood: 100, traits: ['cozy_purr', 'magnet_paw', null],
      },
      {
        id: 'pet_kitsune', stars: 1, visual_tier: 1, essence: 20, spent_essence: 0, nickname: 'Sakura',
        bond_lv: 4, bond_xp: 30, last_gift_day: '', last_harmony_day: '', last_interact_at: 0,
        slots: [{ stat: 'luck', tier: 'rare', value: 0.07, locked: false }, null, null],
        level: 12, mood: 100, traits: ['treasure_sniffer', null, null],
      },
    ],
  });
  // Comfort 6,660 = Castle Lv8 1,200 + landmarks 34 Lv 3,400 + Ferris ★2 600 + Fountain ★1 300
  //               + World-Tree ★1 300 + 5 unique decor 600 + 52 paved/water tiles 260
  neen.village = seedVillage({
    castle_lv: 8, levels: { mint: 8, patisserie: 7, shrine: 6, nest: 6, dock: 7 },
    wonders: { wnd_ferris: { stars: 2 }, wnd_fountain: { stars: 1 }, wnd_world_tree: { stars: 1 } },
    decor: { dec_swing: 1, dec_picnic: 1, dec_tent: 1, dec_cat_cushion: 1, dec_birdbath_lamp: 1 },
    // wnd_ferris is Heart-Isle-only (Master Plan v2 §12): owned here, placed on the couple's Heart Isle.
    place: [['wnd_fountain', 5, 13], ['wnd_world_tree', 1, 13], ['dec_swing', 11, 6], ['dec_picnic', 5, 10],
      ['dec_tent', 15, 0], ['dec_cat_cushion', 10, 6], ['dec_birdbath_lamp', 5, 6]],
    roads: [[5, 5], [12, 5], [10, 7], [10, 8], ...range(6, 10).map((x) => [x, 16]), [10, 12]],
  });

  const mochi = seed('mochi', 'dxb', { level: 12, friends: ['nook', 'neen', 'leo'], ftue_step: 3 });
  mochi.equipped.pet = { id: 'pet_ragdoll', stars: 1, visual_tier: 1, level: 1 };
  const leo = seed('leo', 'bkk', { level: 15, friends: ['nook', 'neen', 'mochi'], ftue_step: 3 });
  leo.equipped.pet = { id: 'pet_nyx', stars: 1, visual_tier: 1, level: 1 };
  for (const p of [nook, neen, mochi, leo]) p.cp = recalcPlayerCP(p);

  return [nook, neen, mochi, leo];
}

const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

/** Starter island + extra levels / owned wonders & decor / extra placements / extra road tiles. */
function seedVillage({ castle_lv, levels, wonders, decor, place, roads }) {
  const now = Date.now();
  const v = legacyStarterVillage(now - 2 * 3600_000);
  const heavenDecor = {
    dec_heaven_winged_pillar: 2,
    dec_heaven_cloud_arch: 2,
    dec_heaven_divine_tree: 2,
    dec_heaven_lotus_fountain: 2,
    dec_heaven_seraph_harp: 2,
  };
  Object.assign(v, { castle_lv, levels: { ...v.levels, ...levels }, wonders, decor: { ...heavenDecor, ...decor } });
  for (const [type, x, y] of place) v.buildings.push({ uid: `${type}_seed`, type, x, y, rot: 0 });
  for (const [x, y] of roads) v.tiles.push({ x, y, t: 'road_cobble' });
  const check = validateLayout(v, v);
  if (!check.ok) throw new Error(`seed village invalid: ${check.error} ${check.at ?? ''}`);
  v.buildings = check.buildings; v.tiles = check.tiles;
  creditPlacedCopies(v);
  ensureBasecampFields(v);
  syncBuildingLevels(v);
  v.comfort = computeComfort(v);
  return v;
}

/** Seed accounts created before Step 2 have the bare starter island: give them their seeded village. */
export function upgradeSeedVillage(existing) {
  const fresh = seedProfiles().find((p) => p.id === existing.id);
  if (!fresh || existing.village?.levels) return false;
  existing.village = fresh.village;
  return true;
}

export const TOWNHALL_BOT_DEFS = Object.freeze([
  Object.freeze({
    id: 'aria',
    username: 'aria',
    lineage: 'dxb',
    body: 'girl',
    level: 22,
    title: 'Starlight Idol',
    partner_id: 'sora',
    couple_streak: 14,
    arcade_best: 1120,
    goldWon: 42000,
    castle_lv: 5,
    levels: { mint: 5, patisserie: 5, shrine: 4, nest: 4, dock: 4 },
  }),
  Object.freeze({
    id: 'sora',
    username: 'sora',
    lineage: 'bkk',
    body: 'boy',
    level: 24,
    title: 'Astral Knight',
    partner_id: 'aria',
    couple_streak: 14,
    arcade_best: 1280,
    goldWon: 58000,
    castle_lv: 5,
    levels: { mint: 6, patisserie: 5, shrine: 5, nest: 4, dock: 5 },
  }),
  Object.freeze({
    id: 'luna',
    username: 'luna',
    lineage: 'dxb',
    body: 'girl',
    level: 19,
    title: 'Sakura Weaver',
    partner_id: 'kai',
    couple_streak: 9,
    arcade_best: 940,
    goldWon: 31000,
    castle_lv: 4,
    levels: { mint: 4, patisserie: 4, shrine: 4, nest: 3, dock: 3 },
  }),
  Object.freeze({
    id: 'kai',
    username: 'kai',
    lineage: 'bkk',
    body: 'boy',
    level: 21,
    title: 'Sky Explorer',
    partner_id: 'luna',
    couple_streak: 9,
    arcade_best: 1050,
    goldWon: 36500,
    castle_lv: 4,
    levels: { mint: 5, patisserie: 4, shrine: 4, nest: 4, dock: 4 },
  }),
]);

const BOY_HAIRS = [
  'hair_boy_fluffy', 'hair_spiky_hero', 'hair_parted_curtains', 'hair_wolf_shag',
  'hair_half_up_bun', 'hair_royal_prince_feather', 'hair_royal_starlight_bob', 'hair_celestial_seraph',
];
const GIRL_HAIRS = [
  'hair_girl_waves', 'hair_bob_blunt', 'hair_high_ponytail', 'hair_twin_tails',
  'hair_double_buns', 'hair_hime_straight', 'hair_braided_crown', 'hair_half_up_bun',
  'hair_royal_drill_ribbons', 'hair_royal_sakura_braid', 'hair_royal_starlight_bob',
  'hair_royal_butterfly_updo', 'hair_royal_moon_ponytail', 'hair_celestial_empress', 'hair_celestial_seraph',
];
const PET_NICKNAMES = {
  pet_ragdoll: ['Mochi', 'Milky', 'Peach', 'Yuki', 'Puff'],
  pet_nyx: ['Nyx', 'Toothless', 'Astra', 'Eclipse', 'Volt'],
  pet_kitsune: ['Inari', 'Sakura', 'Kitsu', 'Kon', 'Miko'],
  pet_skywhale: ['Bubbles', 'Lumi', 'Zephyr', 'Cloudy', 'Sora'],
};

function pickRandom(arr, rng = Math.random) {
  if (!arr || !arr.length) return null;
  return arr[Math.floor(rng() * arr.length)];
}

/**
 * Equips a bot profile with a randomized, visually rich costume (outfit, hair, dye, 5 accessory slots, and companion pet).
 */
export function randomizeBotCostume(p, rng = Math.random, usedOutfits = new Set(), usedPets = new Set()) {
  if (!p) return p;
  const isGirl = p.lineage === 'dxb' || p.appearance?.body === 'girl';
  const body = isGirl ? 'girl' : 'boy';

  // 1. Random Outfit (exclude newbie_outfit and respect boy/girl lean)
  const allOutfitIds = Object.keys(OUTFITS).filter((id) => {
    if (id === 'newbie_outfit') return false;
    const def = OUTFITS[id];
    if (def?.lean && def.lean !== body) return false;
    return true;
  });
  const unusedOutfits = allOutfitIds.filter((id) => !usedOutfits.has(id));
  const outfitId = pickRandom(unusedOutfits.length ? unusedOutfits : allOutfitIds, rng) || 'rare_royal_scholar';
  usedOutfits.add(outfitId);
  const outfitRefine = 4 + Math.floor(rng() * 7); // +4..+10

  // 2. Random Hairstyle & Hair Dye
  const hairPool = (isGirl ? GIRL_HAIRS : BOY_HAIRS).filter((id) => HAIRSTYLES[id]);
  const hairId = pickRandom(hairPool, rng) || (isGirl ? 'hair_girl_waves' : 'hair_boy_fluffy');
  const hDef = HAIRSTYLES[hairId];
  const colorKeys = Object.keys(HAIR_COLORS);
  const hairColor = (hDef?.defaultColor && rng() < 0.5)
    ? hDef.defaultColor
    : (pickRandom(colorKeys, rng) || 'chestnut');

  p.appearance = { body, hair: hairId, hairColor };
  p.owned_hairs = Array.from(new Set([...(p.owned_hairs || []), hairId]));
  p.unlocked_hair_colors = Array.from(new Set([...(p.unlocked_hair_colors || []), hairColor]));

  // 3. Random Accessories across hat, face, gloves, boots, wings
  const bySlot = { hat: [], face: [], gloves: [], boots: [], wings: [] };
  for (const [accId, def] of Object.entries(ACCESSORIES)) {
    if (bySlot[def.slot]) bySlot[def.slot].push(accId);
  }

  p.inventory = p.inventory || { newbie_outfit: { refine: 0, dupes: 0 } };
  p.inventory[outfitId] = { refine: outfitRefine, dupes: 0 };

  const slotChance = { hat: 0.82, face: 0.65, gloves: 0.85, boots: 0.85, wings: 0.88 };
  const equipped = {
    outfit: eq(outfitId, outfitRefine),
    hat: null,
    face: null,
    gloves: null,
    boots: null,
    wings: null,
    pet: null,
  };

  for (const slot of ['hat', 'face', 'gloves', 'boots', 'wings']) {
    if (rng() <= slotChance[slot] && bySlot[slot].length) {
      const itemId = pickRandom(bySlot[slot], rng);
      const ref = 3 + Math.floor(rng() * 8); // +3..+10
      p.inventory[itemId] = { refine: ref, dupes: 0 };
      equipped[slot] = eq(itemId, ref);
    }
  }

  // 4. Random Companion Pet
  const unusedPetIds = PET_IDS.filter((id) => !usedPets.has(id));
  const petId = pickRandom(unusedPetIds.length ? unusedPetIds : PET_IDS, rng) || 'pet_ragdoll';
  usedPets.add(petId);
  const stars = 1 + Math.floor(rng() * 3); // ★1..★3
  const visualTier = stars;
  const petLevel = 10 + Math.floor(rng() * 11); // Lv 10..20
  const bondLv = 5 + Math.floor(rng() * 16);
  const nickname = pickRandom(PET_NICKNAMES[petId], rng) || 'Buddy';
  const petUid = `pet_${p.id}_${petId}`;

  const petObj = {
    uid: petUid,
    id: petId,
    stars,
    visual_tier: visualTier,
    essence: 20,
    spent_essence: stars === 3 ? 120 : stars === 2 ? 40 : 0,
    nickname,
    bond_lv: bondLv,
    bond_xp: 50,
    last_gift_day: '',
    last_harmony_day: '',
    last_interact_at: 0,
    slots: [
      { stat: isGirl ? 'fortune' : 'power', tier: stars >= 3 ? 'mythic' : 'epic', value: stars >= 3 ? 0.15 : 0.11, locked: false },
      { stat: 'swiftness', tier: 'rare', value: 0.08, locked: false },
      null,
    ],
    level: petLevel,
    mood: 100,
    traits: ['cozy_purr', 'mach_wing', null],
  };

  p.pets = [petObj];
  equipped.pet = {
    uid: petUid,
    id: petId,
    stars,
    visual_tier: visualTier,
    nickname,
    bond_lv: bondLv,
    level: petLevel,
  };
  p.equipped = equipped;
  p.cp = recalcPlayerCP(p);
  return p;
}

/**
 * Creates the 4 Town Hall citizen bot accounts with randomized costumes and villages.
 */
export function seedTownHallBots(rng = Math.random) {
  const usedOutfits = new Set();
  const usedPets = new Set();
  const allBotIds = TOWNHALL_BOT_DEFS.map((d) => d.id);

  return TOWNHALL_BOT_DEFS.map((def) => {
    const p = seed(def.username, def.lineage, {
      is_bot: true,
      level: def.level,
      title: def.title,
      titles: [def.title],
      partner_id: def.partner_id,
      couple_streak: def.couple_streak,
      friends: ['nook', 'neen', 'mochi', 'leo', ...allBotIds.filter((id) => id !== def.id)],
      arcade_best: def.arcade_best,
      mono_stats: { goldWon: def.goldWon },
      ftue_step: 3,
      a2hs_claimed: true,
      founder: false,
    });
    p.village = seedVillage({
      castle_lv: def.castle_lv,
      levels: def.levels,
      wonders: { wnd_fountain: { stars: 1 } },
      decor: { dec_swing: 1, dec_picnic: 1 },
      place: [['wnd_fountain', 5, 13], ['dec_swing', 11, 6], ['dec_picnic', 5, 10]],
      roads: [[5, 5], [12, 5], [10, 7], [10, 8]],
    });
    randomizeBotCostume(p, rng, usedOutfits, usedPets);
    return p;
  });
}

/** Strip secrets before sending a profile to any client. */
export function publicProfile(p, { self = false } = {}) {
  if (!p) return null;
  const { hash, salt, ...rest } = p;
  const yard_pets = (p.pets || [])
    .filter((pet) => pet && pet.uid !== p.equipped?.pet?.uid && pet.id !== p.equipped?.pet?.id)
    .slice(0, 3)
    .map((pet) => ({
      uid: pet.uid,
      id: pet.id,
      stars: pet.stars || 1,
      visual_tier: pet.visual_tier || pet.stars || 1,
      nickname: pet.nickname || '',
    }));
  if (self) return { ...rest, yard_pets, frontier: rest.frontier ?? defaultFrontier() };
  return {
    id: p.id, username: p.username, lineage: p.lineage, appearance: p.appearance, title: p.title, level: p.level, cp: p.cp,
    equipped: p.equipped, partner_id: p.partner_id, couple_streak: p.couple_streak, is_bot: !!p.is_bot, yard_pets,
    frontier: { chapter: p.frontier?.chapter ?? 0 },
  };
}

/** Layout-only view of a village for other players in the instance (no timers / bag secrets needed). */
export function publicVillage(v) {
  return {
    grid_size: v.grid_size, castle_lv: v.castle_lv, ground: v.ground, mood: v.mood, comfort: v.comfort,
    buildings: v.buildings, tiles: v.tiles, levels: v.levels, wonders: v.wonders,
    // Stage 3 base camp: visitors see crops (to water them), production timers and residents.
    v2: !!v.v2, castle_ruins: !!v.castle_ruins, max_grid: v.max_grid ?? BASE_GRID,
    production: v.production || {}, plots: v.plots || {}, residents: v.residents || [],
  };
}
