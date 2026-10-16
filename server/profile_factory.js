// server/profile_factory.js — starter profiles (Section 21.M.2) and pre-seeded QA accounts (Section 21.F.3).
import crypto from 'node:crypto';
import { recalcPlayerCP } from '../shared/progression.js';
import { normalizeVillage, validateLayout, syncBuildingLevels, computeComfort } from '../shared/village_rules.js';

export const LINEAGES = ['bkk', 'dxb', 'boy', 'girl'];
export const STARTER_PET = { bkk: 'pet_nyx', dxb: 'pet_ragdoll', boy: 'pet_nyx', girl: 'pet_ragdoll' }; // Screen 24 starter eggs

export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(password), salt, 32).toString('hex');
  return { salt, hash };
}

export function verifyPassword(password, salt, hash) {
  const test = crypto.scryptSync(String(password), salt, 32);
  const ref = Buffer.from(hash, 'hex');
  return ref.length === test.length && crypto.timingSafeEqual(ref, test);
}

// Starter 24x24 island (Section 21.M.2), adjusted to the locked Step 2 footprints:
//   • Shrine is 2×2 → moved from (10,10) to (9,10) so it no longer covers the avenue (x = 11..12).
//   • Dock is 3×2 and must touch water → moved from (18,19) to (18,13), the canal's south bank.
function starterTiles() {
  const tiles = [];
  for (let y = 9; y <= 18; y++) for (let x = 11; x <= 12; x++) if (y !== 12) tiles.push({ x, y, t: 'road_cobble' });
  for (let x = 0; x <= 23; x++) tiles.push({ x, y: 12, t: x === 11 || x === 12 ? 'bridge' : 'water' });
  return tiles;
}

function starterVillage(now = Date.now()) {
  return normalizeVillage({
    grid_size: 24,
    castle_lv: 1,
    mood: 'auto',
    ground: 'ground_classic',
    levels: { mint: 1, shrine: 1, patisserie: 1, nest: 1, dock: 1 },
    buildings: [
      { uid: 'castle', type: 'castle', x: 10, y: 4, rot: 0 },
      { uid: 'mint', type: 'mint', x: 4, y: 6, rot: 0 },
      { uid: 'patisserie', type: 'patisserie', x: 16, y: 6, rot: 0 },
      { uid: 'shrine', type: 'shrine', x: 9, y: 10, rot: 0 },
      { uid: 'nest', type: 'nest', x: 5, y: 13, rot: 0 },
      { uid: 'dock', type: 'dock', x: 18, y: 13, rot: 0 },
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
  const v = normalizeVillage(p.village || starterVillage(now), now);
  for (const b of v.buildings) {
    if (b.type === 'shrine' && b.x === 10 && b.y === 10) b.x = 9;
    if (b.type === 'dock' && b.x === 18 && b.y === 19) b.y = 13;
  }
  let check = validateLayout(v, v);
  if (!check.ok) {
    // last resort: keep levels / ownership, restore the starter positions
    const fresh = starterVillage(now);
    v.buildings = fresh.buildings; v.tiles = fresh.tiles;
    check = validateLayout(v, v);
  }
  if (check.ok) { v.buildings = check.buildings; v.tiles = check.tiles; }
  syncBuildingLevels(v);
  v.comfort = computeComfort(v);
  p.village = v;
  p.fish_codex = p.fish_codex || {};
  p.buffs = p.buffs || {};
  p.bless_day = p.bless_day ?? null;
  p.fountain_day = p.fountain_day ?? null;
  p.star_essence = p.star_essence | 0;
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
    buffs: {},
    bless_day: null,
    fountain_day: null,
    partner_id: null,
    couple_streak: 0,
    friends: [],
    ftue_step: 0,
    a2hs_claimed: false,
    founder: false,
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
    level: 28, exp: 0, gold: 24500, berries: 840, diamonds: 3250, shards: 420, star_essence: 45,
    partner_id: 'neen', couple_streak: 42, friends: ['neen', 'mochi', 'leo'], ftue_step: 3, a2hs_claimed: true,
    inventory: {
      newbie_outfit: { refine: 0, dupes: 0 }, s11_zeus_olympus: { refine: 10, dupes: 0 }, s8_glacial_elsa: { refine: 0, dupes: 0 },
      hat_glowing_bunny: { refine: 10, dupes: 0 }, face_rosegold_shades: { refine: 8, dupes: 0 }, gloves_vorax_cyan: { refine: 10, dupes: 0 },
      boots_hermes_greaves: { refine: 10, dupes: 0 }, wings_golden_seraphim: { refine: 9, dupes: 0 },
      hat_wolf_ears: { refine: 0, dupes: 0 }, back_wolf_tail: { refine: 0, dupes: 0 },
    },
    equipped: {
      outfit: eq('s11_zeus_olympus', 10), hat: eq('hat_glowing_bunny', 10), face: eq('face_rosegold_shades', 8),
      gloves: eq('gloves_vorax_cyan', 10), boots: eq('boots_hermes_greaves', 10), wings: eq('wings_golden_seraphim', 9),
      pet: { id: 'pet_nyx', stars: 3, visual_tier: 3, nickname: 'Nyx', bond_lv: 7, level: 20 },
    },
    pets: [
      {
        id: 'pet_nyx', stars: 3, visual_tier: 3, essence: 30, spent_essence: 160, nickname: 'Nyx',
        bond_lv: 7, bond_xp: 120, last_gift_day: '', last_harmony_day: '', last_interact_at: 0,
        slots: [
          { stat: 'power', tier: 'mythic', value: 0.16, locked: true },
          { stat: 'swiftness', tier: 'epic', value: 0.11, locked: false },
          { stat: 'double_jackpot', tier: 'epic', value: 0.10, locked: false },
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
    place: [['wnd_ferris', 14, 16], ['wnd_onsen', 4, 17], ['dec_swing', 14, 9], ['dec_picnic', 7, 17], ['dec_gramophone', 13, 9]],
    roads: [...range(7, 15).map((x) => [x, 8]), ...range(8, 14).map((x) => [x, 20])],
  });

  const neen = seed('neen', 'dxb', {
    level: 28, exp: 0, gold: 22000, berries: 910, diamonds: 3500, shards: 400, star_essence: 60,
    partner_id: 'nook', couple_streak: 42, friends: ['nook', 'mochi', 'leo'], ftue_step: 3, a2hs_claimed: true,
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
      pet: { id: 'pet_ragdoll', stars: 2, visual_tier: 2, nickname: 'Mochi Princess', bond_lv: 8, level: 20 },
    },
    pets: [
      {
        id: 'pet_ragdoll', stars: 2, visual_tier: 2, essence: 50, spent_essence: 40, nickname: 'Mochi Princess',
        bond_lv: 8, bond_xp: 90, last_gift_day: '', last_harmony_day: '', last_interact_at: 0,
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
    place: [['wnd_ferris', 14, 16], ['wnd_fountain', 4, 17], ['wnd_world_tree', 1, 0], ['dec_swing', 14, 9], ['dec_picnic', 7, 17],
      ['dec_tent', 19, 1], ['dec_cat_cushion', 13, 9], ['dec_birdbath_lamp', 8, 9]],
    roads: [...range(7, 15).map((x) => [x, 8]), [13, 10]],
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
  const v = starterVillage(now - 2 * 3600_000);   // 2 h of production waiting so QA can harvest at once
  Object.assign(v, { castle_lv, levels: { ...v.levels, ...levels }, wonders, decor });
  for (const [type, x, y] of place) v.buildings.push({ uid: `${type}_seed`, type, x, y, rot: 0 });
  for (const [x, y] of roads) v.tiles.push({ x, y, t: 'road_cobble' });
  const check = validateLayout(v, v);
  if (!check.ok) throw new Error(`seed village invalid: ${check.error} ${check.at ?? ''}`);
  v.buildings = check.buildings; v.tiles = check.tiles;
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
  if (self) return { ...rest, yard_pets };
  return {
    id: p.id, username: p.username, lineage: p.lineage, appearance: p.appearance, title: p.title, level: p.level, cp: p.cp,
    equipped: p.equipped, partner_id: p.partner_id, couple_streak: p.couple_streak, yard_pets,
  };
}

/** Layout-only view of a village for other players in the instance (no timers / bag secrets needed). */
export function publicVillage(v) {
  return {
    grid_size: v.grid_size, castle_lv: v.castle_lv, ground: v.ground, mood: v.mood, comfort: v.comfort,
    buildings: v.buildings, tiles: v.tiles, levels: v.levels, wonders: v.wonders,
  };
}
