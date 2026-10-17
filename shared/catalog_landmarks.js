// shared/catalog_landmarks.js — 6 Core Landmarks, 5 VIP Wonders, 8 Cute Decor Props + Love Pavilion,
// paintable tiles, 4 Ground Skins and Cloud Territory tiers (Implementation Plan Sections 2.A–2.F, 21.L).
// Shared by the server (authoritative validation + economy math) and the client (editor + rendering).
//
// Locked Step 2 decisions (patched into the plan + Bible):
//   • Footprints: Castle 4×4 · Mint / Patisserie 3×3 · Shrine / Nest 2×2 · Dock 3×2.
//   • Offline storage cap = (8 + 16·(DockLv−1)/9) h × (Casino Dome ? 2 : 1) × (1 + Chill Chonker 0.25→0.50 + Glamping Tent 0.05).
//   • Lv 2–9 yields: straight line between the documented Lv 1 and Lv 10 values.

export const TILE_SIZE = 1.0;               // metres per grid tile
export const BASE_GRID = 18;
export const MAX_GRID = 32;
export const BRIDGE_GAP = 8.0;              // Rainbow Heart Bridge span (8m), fixed for every tier (Section 21.B)
export const MAX_CORE_LV = 10;
export const MAX_CASTLE_LV = 30;
export const MAX_WONDER_STARS = 5;

/** Linear Lv 1 → Lv 10 interpolation (docs only give the two endpoints). */
export const lerpLv = (lv1, lv10, lv) => lv1 + ((lv10 - lv1) * (Math.max(1, Math.min(MAX_CORE_LV, lv)) - 1)) / 9;
/** Linear ★1 → ★5 interpolation for Wonder buffs given as "a%–b%". */
export const lerpStar = (s1, s5, stars) => s1 + ((s5 - s1) * (Math.max(1, Math.min(MAX_WONDER_STARS, stars)) - 1)) / 4;

// ---------------------------------------------------------------------------------------------
// Core structures. `type` keys match profile.village.buildings[].type (Step 1 starter data).
// ---------------------------------------------------------------------------------------------
export const CORE = {
  castle: {
    kind: 'core', sprite: 'bld_castle', name: 'Grand Starlight Castle', emoji: '🏰', w: 4, h: 4, unique: true,
    effect: '+2% All-Building Yield per Lv • unlocks Cloud Territory',
  },
  mint: {
    kind: 'core', sprite: 'bld_mint', name: 'Royal Gold Waterwheel Mint', emoji: '🪙', w: 3, h: 3,
    produces: 'gold', perHour: (lv) => Math.floor(lerpLv(150, 1200, lv)), effect: 'Passive Gold 150 → 1,200 🪙/hr',
  },
  shrine: {
    kind: 'core', sprite: 'bld_shrine', name: 'Goddess Vakarine Shrine', emoji: '🗽', w: 2, h: 2,
    daily: 'diamonds', perDay: (lv) => Math.floor(lerpLv(15, 60, lv)), effect: 'Free Daily Diamonds 15 → 60 💎/day',
  },
  patisserie: {
    kind: 'core', sprite: 'bld_patisserie', name: 'Cat Boba Patisserie', emoji: '🧋', w: 3, h: 3,
    produces: 'berries', perHour: (lv) => Math.floor(lerpLv(20, 120, lv)),
    matchGoldPct: (lv) => Math.round(lerpLv(2, 20, lv)), effect: 'Star-Berries 20 → 120 🍓/hr',
  },
  nest: {
    kind: 'core', sprite: 'bld_nest', name: 'Cozy Pet Nest & Sanctuary', emoji: '🥚', w: 2, h: 2,
    traitOdds: (lv) => +lerpLv(1, 2, lv).toFixed(3), effect: 'Mythic/Epic Pet Trait Odds 1.0x → 2.0x',
  },
  dock: {
    kind: 'core', sprite: 'bld_dock', name: 'Starlight Fishing Dock', emoji: '🎣', w: 3, h: 2, needsWater: true,
    effect: 'Offline Storage Cap 8h → 24h • Co-Op Fishing',
  },
  windmill_bakery: {
    kind: 'core', sprite: 'bld_windmill_bakery', name: 'Warm Croissant Windmill Bakery', emoji: '🥐', w: 3, h: 3, series2: true,
    produces: 'berries', perHour: (lv) => Math.floor(lerpLv(25, 140, lv)), effect: 'Artisan Croissants & Star-Berries 25 → 140 🍓/hr',
  },
  flower_greenhouse: {
    kind: 'core', sprite: 'bld_flower_greenhouse', name: 'Botanical Glasshouse Conservatory', emoji: '🌺', w: 2, h: 2, series2: true,
    produces: 'berries', perHour: (lv) => Math.floor(lerpLv(18, 100, lv)), effect: 'Glasshouse Blossoms & Star-Berries 18 → 100 🍓/hr',
  },
  owl_post_office: {
    kind: 'core', sprite: 'bld_owl_post_office', name: 'Messenger Owl Post Office', emoji: '🦉', w: 2, h: 2, series2: true,
    produces: 'gold', perHour: (lv) => Math.floor(lerpLv(120, 960, lv)), effect: 'Couple Letter Delivery & Gold 120 → 960 🪙/hr',
  },
  starlight_lighthouse: {
    kind: 'core', sprite: 'bld_starlight_lighthouse', name: 'Starlight Harbor Lighthouse', emoji: '🏮', w: 2, h: 2, needsWater: true, series2: true,
    effect: '+10% Co-Op Fishing Chest Luck • Guiding Beacon',
  },
};
export const CORE_LANDMARKS = ['mint', 'shrine', 'patisserie', 'nest', 'dock']; // the 5 blueprint landmarks

/** Blueprint cards needed to go from Lv L to L+1 (index = L). Section 2.B. */
export const BLUEPRINT_CARDS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 50];
export const BLUEPRINT_EXCESS_SHARDS = 5;

export const castleUpgradeCost = (targetLv) => 1500 * targetLv;
export const castlePrereq = (targetLv) => Math.min(50, Math.floor(targetLv * 1.5));

/** Building caps by Castle level (Section 21.L.2): core landmarks excl. castle / wonders. */
export function buildingCaps(castleLv) {
  if (castleLv >= 10) return { core: 10, wonders: 5 };
  if (castleLv >= 5) return { core: 8, wonders: 4 };
  return { core: 5, wonders: 3 };
}
export const MAX_COPIES_PER_CORE = 2;

// ---------------------------------------------------------------------------------------------
// VIP Wonders (Box 2 Royal Architect Gacha / 350 🌟 Shard Shop). Buff ranges scale ★1 → ★5.
// ---------------------------------------------------------------------------------------------
export const WONDERS = {
  wnd_onsen: {
    kind: 'wonder', sprite: 'wnd_onsen', name: 'Capybara Yuzu Hot Spring', emoji: '♨️', w: 3, h: 3, rarity: 2,
    blacksmithPct: (s) => lerpStar(15, 25, s), buffMs: 3600_000, effect: '+15–25% Blacksmith Success for 1h (drop your Chibi in!)',
  },
  wnd_ferris: {
    kind: 'wonder', sprite: 'wnd_ferris', name: 'Couple Heart Ferris Wheel', emoji: '🎡', w: 4, h: 4, rarity: 3,
    matchYieldPct: (s) => lerpStar(25, 50, s), effect: '+25–50% Post-Match Gold & Star-Berries',
  },
  wnd_fountain: {
    kind: 'wonder', sprite: 'wnd_fountain', name: 'Fountain of 1,000 Wishes', emoji: '⛲', w: 3, h: 3, rarity: 3,
    tossCost: 100, effect: 'Daily 100 🪙 toss → +10–50 💎 or 1 Summon Ticket',
  },
  wnd_casino_dome: {
    kind: 'wonder', sprite: 'wnd_casino_dome', name: 'Grand Golden Casino Dome', emoji: '🎰', w: 4, h: 4, rarity: 3,
    effect: '2× Offline Storage Cap • +10% Monopoly Start Cash • −8% Land Cost',
  },
  wnd_world_tree: {
    kind: 'wonder', sprite: 'wnd_world_tree', name: 'Golden Starlight World-Tree', emoji: '🌳', w: 4, h: 4, rarity: 3,
    perDay: (s) => Math.floor(lerpStar(5, 15, s)), effect: '+5–15 💎 daily • +15–30% stats in Moon Bunny & Cloud Dash',
  },
  wnd_sakura_pagoda: {
    kind: 'wonder', sprite: 'wnd_sakura_pagoda', name: 'Kyoto Five-Tier Sakura Pagoda', emoji: '⛩️', w: 4, h: 4, rarity: 3, series3: true,
    matchYieldPct: (s) => lerpStar(20, 45, s), effect: '+20–45% Post-Match Gold & Sakura Blessing',
  },
  wnd_mirage_palace: {
    kind: 'wonder', sprite: 'wnd_mirage_palace', name: "Sultan's Golden Mirage Palace", emoji: '🕌', w: 4, h: 4, rarity: 3, series3: true,
    matchYieldPct: (s) => lerpStar(25, 50, s), effect: '+25–50% Oasis Gold Yield • +10% Monopoly Start Cash',
  },
  wnd_atlantis_sanctuary: {
    kind: 'wonder', sprite: 'wnd_atlantis_sanctuary', name: 'Atlantis Pearl-Shell Palace', emoji: '🐚', w: 4, h: 4, rarity: 3, series3: true,
    perDay: (s) => Math.floor(lerpStar(8, 20, s)), effect: '+8–20 💎 Daily Pearl Tribute • +20% Fishing Chest Luck',
  },
  wnd_aurora_observatory: {
    kind: 'wonder', sprite: 'wnd_aurora_observatory', name: 'Starlight Aurora Observatory', emoji: '🔭', w: 4, h: 4, rarity: 3, series3: true,
    perDay: (s) => Math.floor(lerpStar(8, 20, s)), effect: '+8–20 💎 Daily Astral Reading • +15% Star-Force Focus',
  },
  wnd_tea_pavilion: {
    kind: 'wonder', sprite: 'wnd_tea_pavilion', name: 'Floating Matcha & Koi Tea House', emoji: '🍵', w: 3, h: 3, rarity: 2, series3: true,
    blacksmithPct: (s) => lerpStar(15, 25, s), buffMs: 3600_000, effect: '+15–25% Cozy Tea Harmony & Blacksmith Focus for 1h',
  },
  wnd_sky_airship_dock: {
    kind: 'wonder', sprite: 'wnd_sky_airship_dock', name: 'Royal Starlight Airship Harbor', emoji: '🛳️', w: 3, h: 3, rarity: 2, series3: true,
    matchYieldPct: (s) => lerpStar(15, 35, s), effect: '+15–35% Sky-Harbor Trade Gold & Offline Storage',
  },
};
export const WONDER_DUPE_SHARDS = { 2: 25, 3: 100 };

// ---------------------------------------------------------------------------------------------
// Cute Decor (Section 2.E). Comfort: +120 first copy, +30 each extra copy, decor total capped 2,400.
// ---------------------------------------------------------------------------------------------
export const DECOR = {
  dec_swing:               { kind: 'decor', sprite: 'dec_swing', name: 'Sakura Couple Swing-Bench', emoji: '🪑', w: 2, h: 2, buff: { goldPct: 2 }, seats: 2, effect: '+2% Village Gold/hr' },
  dec_picnic:              { kind: 'decor', sprite: 'dec_picnic', name: 'Strawberry Tart Picnic Mat', emoji: '🧺', w: 2, h: 2, buff: { berriesPct: 2 }, seats: 3, effect: '+2% Star-Berries/hr' },
  dec_gramophone:          { kind: 'decor', sprite: 'dec_gramophone', name: 'Golden Gramophone Jukebox', emoji: '🎶', w: 1, h: 1, buff: { petMoodPct: 2 }, effect: '+2% Pet Mood • tap to switch BGM' },
  dec_tent:                { kind: 'decor', sprite: 'dec_tent', name: 'Starlight Glamping Tent & Campfire', emoji: '⛺', w: 2, h: 2, buff: { storagePct: 5 }, effect: '+5% Offline Storage Cap' },
  dec_cat_cushion:         { kind: 'decor', sprite: 'dec_cat_cushion', name: 'Giant Cat-Paw Cushion & Tree', emoji: '🐱', w: 1, h: 1, buff: { traitLuckPct: 3 }, effect: '+3% Pet Trait Roll Luck' },
  dec_balloon_cart:        { kind: 'decor', sprite: 'dec_balloon_cart', name: 'Cotton-Candy Balloon Cart', emoji: '🎈', w: 1, h: 1, buff: { swiftnessPct: 2 }, effect: '+2% Swiftness' },
  dec_mushroom_ring:       { kind: 'decor', sprite: 'dec_mushroom_ring', name: 'Glowing Fairy Mushroom Ring', emoji: '🌷', w: 1, h: 1, buff: { fortunePct: 2 }, effect: '+2% Fortune' },
  dec_birdbath_lamp:       { kind: 'decor', sprite: 'dec_birdbath_lamp', name: 'Rose-Gold Birdbath & Streetlamp', emoji: '⛲', w: 1, h: 1, buff: { luckPct: 2 }, effect: '+2% Luck' },
  dec_wooden_bench:        { kind: 'decor', sprite: 'dec_wooden_bench', name: 'Cozy Carved Park Bench', emoji: '🪵', w: 2, h: 1, series2: true, seats: 2, buff: { comfortBonus: 30 }, effect: '+30 Comfort • 2-Chibi Seat' },
  dec_flower_cart:         { kind: 'decor', sprite: 'dec_flower_cart', name: 'Pastel Blossom Wheel-Cart', emoji: '💐', w: 2, h: 2, series2: true, buff: { berriesPct: 2 }, effect: '+2% Star-Berries/hr' },
  dec_boba_stand:          { kind: 'decor', sprite: 'dec_boba_stand', name: 'Strawberry-Cat Boba Tea Cart', emoji: '🧋', w: 2, h: 2, series2: true, buff: { goldPct: 2 }, effect: '+2% Village Gold/hr' },
  dec_wishing_well:        { kind: 'decor', sprite: 'dec_wishing_well', name: 'Fairytale Stone Wishing Well', emoji: '🪣', w: 2, h: 2, series2: true, buff: { luckPct: 3 }, effect: '+3% Luck' },
  dec_honey_beehive:       { kind: 'decor', sprite: 'dec_honey_beehive', name: 'Golden Meadow Honey Beehive', emoji: '🐝', w: 1, h: 1, series2: true, buff: { berriesPct: 2 }, effect: '+2% Star-Berries/hr' },
  dec_cat_bakery_sign:     { kind: 'decor', sprite: 'dec_cat_bakery_sign', name: 'Croissant-Cat Bakery Board', emoji: '🥐', w: 1, h: 1, series2: true, buff: { goldPct: 1 }, effect: '+1% Patisserie & Mint Yield' },
  dec_couple_hammock:      { kind: 'decor', sprite: 'dec_couple_hammock', name: 'Blossom-Draped Couple Hammock', emoji: '🌸', w: 2, h: 1, series2: true, seats: 2, buff: { petMoodPct: 3 }, effect: '+3% Couple Harmony & Pet Mood' },
  dec_koi_barrel_pond:     { kind: 'decor', sprite: 'dec_koi_barrel_pond', name: 'Mini Oak-Barrel Lotus & Koi Pond', emoji: '🪷', w: 2, h: 2, series2: true, buff: { fortunePct: 3 }, effect: '+3% Fishing & Fortune Luck' },
  dec_painter_easel:       { kind: 'decor', sprite: 'dec_painter_easel', name: "Sunlit Storybook Painter's Easel", emoji: '🎨', w: 1, h: 1, series2: true, buff: { comfortBonus: 25 }, effect: '+25 Comfort' },
  dec_berry_wheelbarrow:   { kind: 'decor', sprite: 'dec_berry_wheelbarrow', name: 'Star-Berry Harvest Wheelbarrow', emoji: '🍓', w: 1, h: 1, series2: true, buff: { storagePct: 2 }, effect: '+2% Offline Storage Cap' },
  dec_starlight_telescope: { kind: 'decor', sprite: 'dec_starlight_telescope', name: 'Brass Starlight Stargazer Telescope', emoji: '🔭', w: 1, h: 1, series2: true, buff: { fortunePct: 2 }, effect: '+2% Starlight Fortune' },
  dec_owl_mailbox:         { kind: 'decor', sprite: 'dec_owl_mailbox', name: 'Sleepy Owl Postbox & Parcel Stack', emoji: '📮', w: 1, h: 1, series2: true, buff: { swiftnessPct: 2 }, effect: '+2% Swiftness' },
  dec_sakura_drum_bridge:   { kind: 'decor', sprite: 'dec_sakura_drum_bridge', name: 'Kyoto Red-Lacquer Drum Bridge', emoji: '🌉', w: 2, h: 1, series3: true, buff: { goldPct: 3 }, effect: '+3% Village Gold/hr' },
  dec_bamboo_shishi_odoshi: { kind: 'decor', sprite: 'dec_bamboo_shishi_odoshi', name: 'Kyoto Bamboo Water-Spout Rockery', emoji: '🎍', w: 2, h: 2, series3: true, buff: { petMoodPct: 3 }, effect: '+3% Pet Mood & Zen Serenity' },
  dec_sultan_bazaar_canopy: { kind: 'decor', sprite: 'dec_sultan_bazaar_canopy', name: "Silk-Draped Sultan's Oasis Tent", emoji: '🎪', w: 2, h: 2, series3: true, seats: 2, buff: { goldPct: 3 }, effect: '+3% Village Gold/hr • 2-Chibi Lounge' },
  dec_oasis_obelisk_fountain: { kind: 'decor', sprite: 'dec_oasis_obelisk_fountain', name: 'Golden Sun-Disc Obelisk Fountain', emoji: '☀️', w: 2, h: 2, series3: true, buff: { fortunePct: 3 }, effect: '+3% Fortune' },
  dec_siren_shell_fountain: { kind: 'decor', sprite: 'dec_siren_shell_fountain', name: 'Atlantis Giant Clam & Harp Fountain', emoji: '🐚', w: 2, h: 2, series3: true, buff: { luckPct: 3 }, effect: '+3% Luck & Pearl Sparkle' },
  dec_coral_crystal_arch:   { kind: 'decor', sprite: 'dec_coral_crystal_arch', name: 'Glowing Coral & Sea-Glass Archway', emoji: '🪸', w: 2, h: 1, series3: true, buff: { berriesPct: 3 }, effect: '+3% Star-Berries/hr' },
  dec_aurora_crystal_gazebo: { kind: 'decor', sprite: 'dec_aurora_crystal_gazebo', name: 'Glacial Crystal Swan Gazebo', emoji: '🦢', w: 2, h: 2, series3: true, seats: 2, buff: { traitLuckPct: 3 }, effect: '+3% Pet Trait Roll Luck' },
  dec_stone_arch_footbridge: { kind: 'decor', sprite: 'dec_stone_arch_footbridge', name: 'Royal Carved Stone Arch Footbridge', emoji: '🌉', w: 2, h: 2, series3: true, buff: { comfortBonus: 40 }, effect: '+40 Comfort • Brook Crossing' },
  dec_heaven_winged_pillar:  { kind: 'decor', sprite: 'dec_heaven_winged_pillar', name: 'Celestial Winged Sun-Orb Pillar', emoji: '🏛️', w: 1, h: 1, series3: true, buff: { fortunePct: 3 }, effect: '+3% Celestial Fortune' },
  dec_heaven_cloud_arch:     { kind: 'decor', sprite: 'dec_heaven_cloud_arch', name: 'Heavenly Winged Cloud Archway', emoji: '🪽', w: 2, h: 1, series3: true, buff: { goldPct: 3 }, effect: '+3% Village Gold/hr' },
  dec_heaven_divine_tree:    { kind: 'decor', sprite: 'dec_heaven_divine_tree', name: 'Sacred Pearl-Blossom Heaven Tree', emoji: '🌳', w: 2, h: 2, series3: true, buff: { berriesPct: 3 }, effect: '+3% Star-Berries/hr' },
  dec_heaven_lotus_fountain: { kind: 'decor', sprite: 'dec_heaven_lotus_fountain', name: 'Celestial Lotus & Cloud Basin', emoji: '🪷', w: 2, h: 2, series3: true, buff: { luckPct: 3 }, effect: '+3% Divine Wish Luck' },
  dec_heaven_seraph_harp:    { kind: 'decor', sprite: 'dec_heaven_seraph_harp', name: 'Golden Seraphim Angel-Wing Lyre', emoji: '🪉', w: 1, h: 1, series3: true, buff: { petMoodPct: 3 }, effect: '+3% Seraphim Harmony & Pet Mood' },
};
// Couple Love Pavilion: not placeable — rendered at BridgeCenterX when a couple bridge is visible.
export const LOVE_PAVILION = { sprite: 'dec_love_pavilion', name: 'Couple Love Pavilion', harmonyPct: 25 };

export const ENV_PROPS_25D = {
  trees: ['env_tree_oak_a', 'env_tree_oak_b', 'env_tree_sakura_a', 'env_tree_sakura_b', 'env_tree_fruit_apple', 'env_tree_golden_maple', 'env_pine', 'env_tree_palm_oasis', 'env_tree_pine_snowy', 'dec_heaven_divine_tree'],
  bushes: ['env_bush_mixed_large', 'env_bush_roses_pink', 'env_bush_daisies_white', 'env_bush_hydrangea_blue', 'env_hedge_boxwood_straight', 'env_hedge_boxwood_corner', 'env_hedge_ortho_horizontal', 'env_flowerbed_planter', 'env_planter_ortho_horizontal', 'env_sunflower_clump'],
  fences: ['env_fence_wood_stone_straight', 'env_fence_wood_stone_corner', 'env_fence_wood_stone_gate', 'env_fence_ortho_horizontal', 'env_arch_floral_ortho', 'env_wall_stone_low', 'dec_bench_ortho_front', 'decal_plaza_medallion_circle', 'dec_heaven_winged_pillar', 'dec_heaven_cloud_arch'],
  lamps: ['env_streetlamp_iron', 'env_streetlamp_double', 'env_string_lights_post', 'env_signpost', 'dec_heaven_seraph_harp'],
  water: ['env_river_boulders_a', 'env_river_boulders_b', 'env_river_cattails', 'decal_water_lily_white', 'decal_water_lotus_pink', 'dec_heaven_lotus_fountain'],
  bridges: ['bridge_stone_deck', 'env_bridge_parapet_side', 'env_bridge_pillar_cap', 'bridge_wood_deck', 'bridge_rainbow_arch', 'bridge_rainbow_front_arch', 'bridge_rainbow_back_rail', 'bridge_rainbow_deck_strip', 'dec_stone_arch_footbridge', 'dec_sakura_drum_bridge'],
  cliffs: ['cliff_grass_lip_strip', 'cliff_side_strata_strip', 'cliff_waterfall_strip', 'cliff_wall_strip', 'cliff_rim_turf_strip', 'cliff_heaven_cloud_wall', 'env_waterfall_mist', 'env_cloud_fluffy_a', 'env_cloud_fluffy_b'],
  monopolyEmblems: ['mono_icon_start', 'mono_icon_casino', 'mono_icon_airdrop', 'mono_icon_vault', 'mono_icon_warp', 'mono_icon_arena'],
  monopolyGrounds: ['mono_ground_brook_classic', 'mono_ground_pond_sakura', 'mono_ground_oasis_mirage', 'mono_ground_lagoon_atlantis', 'mono_ground_rink_aurora'],
};

export const COMFORT = { CASTLE_PER_LV: 150, CORE_PER_LV: 100, WONDER_PER_STAR: 300, DECOR_FIRST: 120, DECOR_DUPE: 30, DECOR_CAP: 2400, TILE: 5, TILE_CAP: 500, YIELD_DIV: 200, YIELD_CAP_PCT: 50 };

// ---------------------------------------------------------------------------------------------
// Paint-mode tiles + ground skins + cloud tiers
// ---------------------------------------------------------------------------------------------
export const TILES = {
  road_cobble: { name: 'Cobblestone Road', emoji: '🧱', sprite: 'road_cobble', road: true },
  road_sakura: { name: 'Sakura Petal Path', emoji: '🌸', sprite: 'road_sakura', road: true },
  road_cream:  { name: 'Cream Plaza Tiles', emoji: '🍦', sprite: 'road_cream', road: true },
  water:       { name: 'Crystal Water Canal', emoji: '💧', sprite: 'water_canal', water: true },
  bridge:      { name: 'Stone Footbridge', emoji: '🌉', bridge: true },
};
export const ROAD_SPEED_BOOST = 1.15;      // +15% walk speed on road tiles
export const ROAD_PATH_COST = 0.85;

export const GROUND_SKINS = {
  ground_classic: { name: 'Classic Klaipeda Fairytale', emoji: '🌿' },
  ground_sakura:  { name: 'Kyoto Sakura Blossom', emoji: '🌸' },
  ground_vanilla: { name: 'Sweet Vanilla Patisserie', emoji: '🍬' },
  ground_aurora:  { name: 'Starlight Aurora Sanctuary', emoji: '🌌' },
};

export const MOODS = ['auto', 'sunny', 'sakura', 'sunset', 'night'];

/** Cloud Territory expansion tiers (Section 2.A.2). Index 0 = base island. */
export const EXPANSION_TIERS = [
  { size: 18, castleLv: 1, gold: 0 },
  { size: 20, castleLv: 2, gold: 2500 },
  { size: 24, castleLv: 4, gold: 8000 },
  { size: 28, castleLv: 7, gold: 25000 },
  { size: 32, castleLv: 10, gold: 60000 },
];

// ---------------------------------------------------------------------------------------------
// Fishing (Section 2.F)
// ---------------------------------------------------------------------------------------------
export const FISH = {
  minnow: { name: 'Silver Stream Minnow', emoji: '🐟', sprite: 'fish_minnow', rate: 45, reward: { gold: 150 }, exp: 25 },
  crab:   { name: 'Starlight Coral Crab', emoji: '🦀', sprite: 'fish_crab', rate: 30, reward: { gold: 300, berries: 10 }, exp: 25 },
  koi:    { name: 'Golden Starlight Koi', emoji: '🐠', sprite: 'fish_koi', rate: 15, reward: { gold: 500, berries: 25 }, exp: 25, baitOnly: true },
  chest:  { name: 'Sunken Duplicate Gear Chest', emoji: '🎁', sprite: 'fish_chest', rate: 10, reward: { dupe: 1 }, exp: 50, baitOnly: true },
};
export const FISHING = {
  BAIT_COST_BERRIES: 5, COOP_CHEST_MULT: 1.35, COOP_RADIUS: 4.0, DOCK_REACH: 2.6,
  BITE_MIN_MS: 2500, BITE_MAX_MS: 5000, REEL_MS: 3500, CAST_TIMEOUT_MS: 60000,
  SWEET_SPOT_WIDTH: 0.28, HOLD_SPEED: 0.45, DRIFT_SPEED: 0.35,
  CODEX_MILESTONES: [1, 10, 50], CODEX_DIAMONDS: 50,
};

// ---------------------------------------------------------------------------------------------
export const ALL_PLACEABLES = { ...CORE, ...WONDERS, ...DECOR };
export const placeable = (type) => ALL_PLACEABLES[type] || null;

/** Footprint in tiles after rotation (rot ∈ {0, 90, 180, 270}). */
export function footprint(type, rot = 0) {
  const d = placeable(type);
  if (!d) return null;
  const odd = ((rot / 90) | 0) % 2 === 1;
  return odd ? { w: d.h, h: d.w } : { w: d.w, h: d.h };
}
