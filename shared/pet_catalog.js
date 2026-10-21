// shared/pet_catalog.js — Soul-Bond Companions V2 canonical 4-pet catalog.
// Shared by server (authoritative rules & migration) and client (3D PetController & Sanctuary UI).

export const PET_POSES = ['front', 'side', 'back', 'move', 'cast', 'happy', 'sleep', 'lifted'];
export const POSE_KEYS = PET_POSES;

export const PET_EMOTES = ['joy', 'wink', 'surprised', 'teary', 'sleepy', 'love', 'proud', 'shy'];
export const EMOTE_KEYS = PET_EMOTES;

export const STARTER_PET = {
  bkk: 'pet_nyx',
  dxb: 'pet_ragdoll',
};

export const PET_FAMILIES = {
  cats:     { id: 'cats',     name: 'Royal Ragdolls',    locomotion: 'HOP_WADDLE',   skill: 'royal_charm' },
  dragons:  { id: 'dragons',  name: 'Midnight Drakes',   locomotion: 'FLY_FLUTTER',  skill: 'plasma_blast' },
  kitsune:  { id: 'kitsune',  name: 'Shrine Kitsune',    locomotion: 'FLOAT_SPIRIT', skill: 'foxfire' },
  skywhale: { id: 'skywhale', name: 'Celestial Whales',  locomotion: 'SKY_SWIM',     skill: 'bubble_shield' },
};

export const PET_TIER_SCALE = Object.freeze({
  1: 1.00,
  2: 1.24,
  3: 1.42,
});

/**
 * Per-sprite perceptual mass (`perc` = 75% core torso/head mass + 25% total silhouette mass)
 * measured from the 64 sliced PNGs so thin horns, tiaras, wings, and tails never shrink the pet's body.
 */
export const PET_SPRITE_METRICS = Object.freeze({
  ragdoll_t1_front: { w: 270, h: 310, perc: 201.1 }, ragdoll_t1_side: { w: 310, h: 304, perc: 199.6 }, ragdoll_t1_back: { w: 258, h: 316, perc: 197.0 }, ragdoll_t1_move: { w: 321, h: 302, perc: 210.0 },
  ragdoll_t1_cast: { w: 356, h: 313, perc: 210.2 }, ragdoll_t1_happy: { w: 268, h: 341, perc: 199.0 }, ragdoll_t1_sleep: { w: 309, h: 239, perc: 206.6 }, ragdoll_t1_lifted: { w: 323, h: 314, perc: 186.2 },
  ragdoll_t2_front: { w: 302, h: 347, perc: 220.3 }, ragdoll_t2_side: { w: 313, h: 347, perc: 207.6 }, ragdoll_t2_back: { w: 236, h: 363, perc: 204.6 }, ragdoll_t2_move: { w: 338, h: 340, perc: 216.1 },
  ragdoll_t2_cast: { w: 347, h: 320, perc: 221.6 }, ragdoll_t2_happy: { w: 271, h: 342, perc: 211.6 }, ragdoll_t2_sleep: { w: 357, h: 213, perc: 192.9 }, ragdoll_t2_lifted: { w: 311, h: 349, perc: 221.6 },
  nyx_t1_front: { w: 280, h: 291, perc: 201.7 }, nyx_t1_side: { w: 280, h: 254, perc: 186.6 }, nyx_t1_back: { w: 280, h: 291, perc: 204.4 }, nyx_t1_move: { w: 280, h: 222, perc: 136.7 },
  nyx_t1_cast: { w: 280, h: 237, perc: 190.6 }, nyx_t1_happy: { w: 244, h: 300, perc: 206.3 }, nyx_t1_sleep: { w: 280, h: 173, perc: 187.1 }, nyx_t1_lifted: { w: 280, h: 222, perc: 136.3 },
  nyx_t2_front: { w: 294, h: 305, perc: 210.9 }, nyx_t2_side: { w: 294, h: 266, perc: 195.7 }, nyx_t2_back: { w: 294, h: 305, perc: 213.6 }, nyx_t2_move: { w: 294, h: 233, perc: 143.1 },
  nyx_t2_cast: { w: 294, h: 249, perc: 199.8 }, nyx_t2_happy: { w: 255, h: 314, perc: 215.2 }, nyx_t2_sleep: { w: 294, h: 182, perc: 196.6 }, nyx_t2_lifted: { w: 294, h: 233, perc: 141.9 },
  nyx_t3_front: { w: 308, h: 320, perc: 221.1 }, nyx_t3_side: { w: 308, h: 279, perc: 204.8 }, nyx_t3_back: { w: 308, h: 320, perc: 223.5 }, nyx_t3_move: { w: 308, h: 245, perc: 150.9 },
  nyx_t3_cast: { w: 308, h: 261, perc: 210.2 }, nyx_t3_happy: { w: 267, h: 328, perc: 224.8 }, nyx_t3_sleep: { w: 308, h: 191, perc: 206.2 }, nyx_t3_lifted: { w: 308, h: 244, perc: 149.8 },
  kitsune_t1_front: { w: 274, h: 322, perc: 212.4 }, kitsune_t1_side: { w: 307, h: 319, perc: 197.8 }, kitsune_t1_back: { w: 274, h: 314, perc: 188.5 }, kitsune_t1_move: { w: 359, h: 288, perc: 199.9 },
  kitsune_t1_cast: { w: 332, h: 335, perc: 214.4 }, kitsune_t1_happy: { w: 269, h: 349, perc: 203.5 }, kitsune_t1_sleep: { w: 293, h: 303, perc: 210.5 }, kitsune_t1_lifted: { w: 300, h: 347, perc: 189.3 },
  kitsune_t2_front: { w: 307, h: 292, perc: 215.3 }, kitsune_t2_side: { w: 313, h: 311, perc: 187.5 }, kitsune_t2_back: { w: 258, h: 300, perc: 183.4 }, kitsune_t2_move: { w: 337, h: 255, perc: 181.9 },
  kitsune_t2_cast: { w: 337, h: 308, perc: 207.3 }, kitsune_t2_happy: { w: 274, h: 319, perc: 195.0 }, kitsune_t2_sleep: { w: 287, h: 232, perc: 181.6 }, kitsune_t2_lifted: { w: 317, h: 285, perc: 209.5 },
  skywhale_t1_front: { w: 254, h: 308, perc: 172.8 }, skywhale_t1_side: { w: 320, h: 274, perc: 176.0 }, skywhale_t1_back: { w: 259, h: 275, perc: 172.1 }, skywhale_t1_move: { w: 345, h: 268, perc: 178.2 },
  skywhale_t1_cast: { w: 375, h: 270, perc: 187.5 }, skywhale_t1_happy: { w: 247, h: 368, perc: 179.1 }, skywhale_t1_sleep: { w: 293, h: 258, perc: 172.1 }, skywhale_t1_lifted: { w: 251, h: 355, perc: 184.5 },
  skywhale_t2_front: { w: 304, h: 293, perc: 186.1 }, skywhale_t2_side: { w: 368, h: 298, perc: 186.2 }, skywhale_t2_back: { w: 257, h: 359, perc: 180.5 }, skywhale_t2_move: { w: 323, h: 290, perc: 188.1 },
  skywhale_t2_cast: { w: 369, h: 305, perc: 192.7 }, skywhale_t2_happy: { w: 247, h: 391, perc: 192.9 }, skywhale_t2_sleep: { w: 304, h: 296, perc: 208.8 }, skywhale_t2_lifted: { w: 314, h: 345, perc: 198.5 },
});

export const PETS = {
  pet_ragdoll: {
    id: 'pet_ragdoll',
    family: 'cats',
    rarity: 1,
    name: 'Princess Ragdoll',
    tierNames: {
      1: 'Mochi Ragdoll Kitten',
      2: 'Princess Ragdoll',
      3: 'Celestial Empress Ragdoll',
    },
    sprite: 'ragdoll',
    eggSprite: 'egg_ragdoll',
    height: 0.66,
    bodyMass: 0.43,
    tierScale: { 1: 1.00, 2: 1.24, 3: 1.42 },
    locomotion: 'HOP_WADDLE',
    skill: 'royal_charm',
    starter: 'dxb',
    fx: {
      trail: 'fx_petal',
      aura: ['fx_heart', 'fx_star'],
      cast: 'fx_heart',
      tint: [1.0, 0.62, 0.82],
      tint2: [1.0, 0.85, 0.45],
    },
    auraRing: {
      color1: [1.0, 0.62, 0.78],
      color2: [1.0, 0.88, 0.60],
      cycleSec: 6.0,
      pulseSec: 2.0,
      accentCell: 'fx_heart',
      accentCell2: 'fx_star',
      accentTint: [1.0, 0.68, 0.85],
    },
    muzzle: { x: 0.18, y: 0.30 },
    shimmer: [1.0, 0.80, 0.90],
  },
  pet_nyx: {
    id: 'pet_nyx',
    family: 'dragons',
    rarity: 1,
    name: 'Nyx, the Midnight Drake',
    hasT3Sprite: true,
    tierNames: {
      1: 'Fledgling Nyx Drake',
      2: 'Plasma-Charged Nyx',
      3: 'Astral Sovereign Nyx',
    },
    sprite: 'nyx',
    eggSprite: 'egg_nyx',
    height: 0.84,
    bodyMass: 0.45,
    tierScale: { 1: 1.00, 2: 1.26, 3: 1.46 },
    locomotion: 'FLY_FLUTTER',
    skill: 'plasma_blast',
    starter: 'bkk',
    fx: {
      trail: 'fx_stardust',
      aura: ['fx_lightning', 'fx_stardust'],
      cast: 'fx_lightning',
      tint: [0.35, 0.85, 1.0],
      tint2: [0.55, 0.70, 1.0],
    },
    auraRing: {
      color1: [0.22, 0.85, 1.0],
      color2: [0.42, 0.48, 1.0],
      cycleSec: 5.5,
      pulseSec: 1.8,
      accentCell: 'fx_lightning',
      accentCell2: 'fx_stardust',
      accentTint: [0.35, 0.88, 1.0],
    },
    muzzle: { x: 0.22, y: 0.34 },
    shimmer: [0.45, 0.90, 1.0],
  },
  pet_kitsune: {
    id: 'pet_kitsune',
    family: 'kitsune',
    rarity: 1,
    name: 'Sakura Kitsune',
    tierNames: {
      1: 'Sakura Fox Kit',
      2: 'Three-Tail Shrine Kitsune',
      3: 'Nine-Tail Inari Spirit',
    },
    sprite: 'kitsune',
    eggSprite: 'egg_kitsune',
    height: 0.64,
    bodyMass: 0.42,
    tierScale: { 1: 1.00, 2: 1.20, 3: 1.35 },
    locomotion: 'FLOAT_SPIRIT',
    skill: 'foxfire',
    starter: null,
    fx: {
      trail: 'fx_petal',
      aura: ['fx_flame', 'fx_petal'],
      cast: 'fx_flame',
      tint: [1.0, 0.70, 0.80],
      tint2: [1.0, 0.55, 0.40],
    },
    auraRing: {
      color1: [1.0, 0.52, 0.64],
      color2: [1.0, 0.82, 0.40],
      cycleSec: 5.8,
      pulseSec: 2.0,
      accentCell: 'fx_petal',
      accentCell2: 'fx_flame',
      accentTint: [1.0, 0.72, 0.82],
    },
    muzzle: { x: 0.20, y: 0.32 },
    shimmer: [1.0, 0.75, 0.85],
  },
  pet_skywhale: {
    id: 'pet_skywhale',
    family: 'skywhale',
    rarity: 1,
    name: 'Baby Sky Whale',
    tierNames: {
      1: 'Cloud Whale Calf',
      2: 'Crown Constellation Whale',
      3: 'Aurora Sovereign Sky Whale',
    },
    sprite: 'skywhale',
    eggSprite: 'egg_skywhale',
    height: 0.74,
    bodyMass: 0.42,
    tierScale: { 1: 1.00, 2: 1.20, 3: 1.35 },
    locomotion: 'SKY_SWIM',
    skill: 'bubble_shield',
    starter: null,
    fx: {
      trail: 'fx_bubble',
      aura: ['fx_bubble', 'fx_star'],
      cast: 'fx_bubble',
      tint: [0.60, 0.85, 1.0],
      tint2: [1.0, 0.90, 0.50],
    },
    auraRing: {
      color1: [0.43, 0.95, 1.0],
      color2: [0.72, 0.57, 1.0],
      cycleSec: 6.5,
      pulseSec: 2.3,
      accentCell: 'fx_bubble',
      accentCell2: 'fx_moon',
      accentTint: [0.55, 0.95, 1.0],
    },
    muzzle: { x: 0.22, y: 0.38 },
    shimmer: [0.68, 0.92, 1.0],
  },
};

export const PET_IDS = Object.freeze(['pet_ragdoll', 'pet_nyx', 'pet_kitsune', 'pet_skywhale']);

/** Mapping from V1 18-species catalog IDs to V2 4-species canonical IDs. */
export const LEGACY_PET_MAP = Object.freeze({
  pet_mochi_cat:      'pet_ragdoll',
  pet_boba_calico:    'pet_ragdoll',
  pet_nebula_neko:    'pet_ragdoll',
  pet_ember_wyrm:     'pet_nyx',
  pet_light_fury:     'pet_nyx',
  pet_night_fury:     'pet_nyx',
  pet_starlight_wisp: 'pet_nyx',
  pet_cyber_valkyrie: 'pet_nyx',
  pet_shadow_knight:  'pet_nyx',
  pet_moon_bunny:     'pet_kitsune',
  pet_sakura_kitsune: 'pet_kitsune',
  pet_lunar_rabbit:   'pet_kitsune',
  pet_boba_shiba:     'pet_skywhale',
  pet_cloud_samoyed:  'pet_skywhale',
  pet_fenrir_wolf:    'pet_skywhale',
  pet_cloud_bear:     'pet_skywhale',
  pet_yuzu_capybara:  'pet_skywhale',
  pet_world_turtle:   'pet_skywhale',
});

/** Legacy base rarity lookup for V1 save migration credit. */
export const LEGACY_PET_RARITY = Object.freeze({
  pet_mochi_cat: 1,      pet_boba_calico: 2,    pet_nebula_neko: 3,
  pet_ember_wyrm: 1,     pet_light_fury: 2,     pet_night_fury: 3,
  pet_boba_shiba: 1,     pet_cloud_samoyed: 2,  pet_fenrir_wolf: 3,
  pet_moon_bunny: 1,     pet_sakura_kitsune: 2, pet_lunar_rabbit: 3,
  pet_cloud_bear: 1,     pet_yuzu_capybara: 2,  pet_world_turtle: 3,
  pet_starlight_wisp: 1, pet_cyber_valkyrie: 2, pet_shadow_knight: 3,
});

// Non-enumerable legacy aliases on PETS so `Object.keys(PETS)` stays strictly the 4 V2 pets
// while `PETS[oldId]` still resolves safely during transition or unmigrated lookups.
for (const [oldId, newId] of Object.entries(LEGACY_PET_MAP)) {
  if (!(oldId in PETS)) {
    Object.defineProperty(PETS, oldId, {
      value: PETS[newId],
      enumerable: false,
      configurable: true,
    });
  }
}

export function normalizePetId(petId) {
  if (PETS[petId] && PET_IDS.includes(petId)) return petId;
  return LEGACY_PET_MAP[petId] || 'pet_ragdoll';
}

export function getPetDef(petId) {
  return PETS[normalizePetId(petId)] || PETS.pet_ragdoll;
}

export const petLocomotion = (petId) => getPetDef(petId).locomotion || 'HOP_WADDLE';

/**
 * Resolves the sprite manifest key for a pet at a given visual tier (1..3) and pose.
 * Tier 1 uses `t1` (base); Tier 2 and Tier 3 use `t2` (awakened art, with Tier 3 adding shader shimmer & aura).
 */
export function resolvePetSpriteKey(petId, visualTier = 1, pose = 'front') {
  const def = getPetDef(petId);
  const tier = (visualTier | 0);
  let form = 't1';
  if ((def.hasT3Sprite || def.id === 'pet_nyx') && tier >= 3) {
    form = 't3';
  } else if (tier >= 2) {
    form = 't2';
  }
  const safePose = PET_POSES.includes(pose) ? pose : 'front';
  return `${def.sprite}_${form}_${safePose}`;
}

export function resolvePetEmoteKey(petId, emote = 'joy') {
  const def = getPetDef(petId);
  const safeEmote = PET_EMOTES.includes(emote) ? emote : 'joy';
  return `${def.sprite}_emo_${safeEmote}`;
}

/**
 * Resolves the exact world-space `{ w, h, bodyH }` (in metres) for any specific pet sprite (`petId`, `stars`, `visualTier`, `pose`).
 * Normalizes each of the 64 sprites by its own perceptual body mass (`PET_SPRITE_METRICS[key].perc`)
 * so tall horns (Nyx), crowns (Ragdoll), wide wings, or curled sleep poses never shrink or balloon the pet's body.
 */
export function resolvePetPoseSize(petId, stars = 1, visualTier = stars, pose = 'front', fallbackW = null, fallbackH = null) {
  const def = getPetDef(petId);
  const tier = Math.max(1, Math.min(3, Number(visualTier || stars) || 1));
  const scaleMap = def.tierScale || PET_TIER_SCALE;
  const tierMult = scaleMap[tier] || PET_TIER_SCALE[tier] || 1.0;
  const targetBodyM = (def.bodyMass || 0.43) * tierMult;

  const key = resolvePetSpriteKey(petId, tier, pose);
  const m = PET_SPRITE_METRICS[key];
  const spW = fallbackW || m?.w || 280;
  const spH = fallbackH || m?.h || 310;
  const percPx = m?.perc || Math.sqrt(spW * spH) * 0.66;
  const ppm = targetBodyM / Math.max(1, percPx);

  return {
    w: +(spW * ppm).toFixed(3),
    h: +(spH * ppm).toFixed(3),
    bodyH: +(targetBodyM * 1.55).toFixed(3),
  };
}

/**
 * Resolves the world-space height (in metres) for a pet's front pose at a given evolution/visual tier (1..3).
 */
export function resolvePetHeight(petId, stars = 1, visualTier = stars) {
  return resolvePetPoseSize(petId, stars, visualTier, 'front').h;
}

/**
 * Resolves a CSS scale multiplier for 2D UI stages (`object-fit: contain` boxes in Pet Sanctuary & Wardrobe)
 * that compensates for each sprite's `max(w, h) / perc` extremity ratio AND scales up with `★1 → ★2 → ★3`.
 */
export function resolvePetUiScale(petId, stars = 1, visualTier = stars, pose = 'front') {
  const def = getPetDef(petId);
  const tier = Math.max(1, Math.min(3, Number(visualTier || stars) || 1));
  const key = resolvePetSpriteKey(petId, tier, pose);
  const m = PET_SPRITE_METRICS[key];
  // Compensate for tall horns / wide wings inside CSS `object-fit: contain` (reference max/perc = 1.50)
  const spriteComp = m ? Math.max(m.w, m.h) / m.perc / 1.50 : 1.0;
  const tierUiMult = tier === 3 ? 1.24 : tier === 2 ? 1.12 : 0.96;
  const speciesBoost = def.id === 'pet_nyx' ? 1.06 : def.id === 'pet_ragdoll' ? 1.04 : 1.0;
  return +(spriteComp * tierUiMult * speciesBoost).toFixed(3);
}

export const PET_CATALOG_V2 = PETS;


