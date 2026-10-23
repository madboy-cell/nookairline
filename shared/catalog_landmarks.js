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
    effect: 'Starlight Keep: story board & caps',
  },
  // Stage 3 "Village Base Camp": no core building prints passive currency any more —
  // each one is a production / service building fed by Sky Frontier materials.
  mint: {
    kind: 'core', sprite: 'bld_mint', name: 'Royal Gold Waterwheel Mint', emoji: '🪙', w: 3, h: 3,
    effect: 'Refinery: Ore → Ingots',
  },
  shrine: {
    kind: 'core', sprite: 'bld_shrine', name: 'Goddess Vakarine Shrine', emoji: '🗽', w: 2, h: 2,
    effect: 'Goddess Waystone (Update 1)',
  },
  patisserie: {
    kind: 'core', sprite: 'bld_patisserie', name: 'Cat Boba Patisserie', emoji: '🧋', w: 3, h: 3,
    effect: 'Cat Boba Patisserie: bread, meals & boba',
  },
  nest: {
    kind: 'core', sprite: 'bld_nest', name: 'Cozy Pet Nest & Sanctuary', emoji: '🥚', w: 2, h: 2,
    traitOdds: (lv) => +lerpLv(1, 2, lv).toFixed(3), effect: 'Pet Sanctuary Barn',
  },
  dock: {
    kind: 'core', sprite: 'bld_dock', name: 'Starlight Fishing Dock', emoji: '🎣', w: 3, h: 2, needsWater: true,
    effect: 'Sky Harbor & fishing',
  },
  windmill_bakery: {
    kind: 'core', sprite: 'bld_windmill_bakery', name: 'Warm Croissant Windmill Bakery', emoji: '🥐', w: 3, h: 3, series2: true,
    effect: 'Mill: Wheat → Flour',
  },
  flower_greenhouse: {
    kind: 'core', sprite: 'bld_flower_greenhouse', name: 'Botanical Glasshouse Conservatory', emoji: '🌺', w: 2, h: 2, series2: true,
    effect: 'Herbalist: herbs, potions, repair kits',
  },
  owl_post_office: {
    kind: 'core', sprite: 'bld_owl_post_office', name: 'Messenger Owl Post Office', emoji: '🦉', w: 2, h: 2, series2: true,
    effect: 'Order Board',
  },
  starlight_lighthouse: {
    kind: 'core', sprite: 'bld_starlight_lighthouse', name: 'Starlight Harbor Lighthouse', emoji: '🏮', w: 2, h: 2, needsWater: true, series2: true,
    effect: 'Sky Beacon (Update 1)',
  },
  workshop: {
    kind: 'core', sprite: 'bld_workshop', name: "Tinker's Workshop", emoji: '🔨', w: 3, h: 3, basecamp: true,
    effect: 'Planks, thread & frontier tools',
  },
  cottage: {
    kind: 'core', sprite: 'bld_cottage', name: 'Settler Cottage', emoji: '🏡', w: 2, h: 2, basecamp: true,
    effect: 'Home for one village resident',
  },
  farm_plot: {
    kind: 'core', sprite: 'bld_farm_plot', name: 'Farm Plot', emoji: '🌾', w: 2, h: 2, basecamp: true,
    effect: 'Plant Sky Wheat, Berries & Herbs',
  },
  tent: {
    kind: 'core', sprite: 'dec_tent', name: 'Camp Tent & Campfire', emoji: '⛺', w: 2, h: 2, basecamp: true,
    effect: 'Base camp shelter & campfire',
  },
};
/** Base-camp utility & story buildings: excluded from the Castle `core` 5-landmark cap. */
export const UNCAPPED_CORE = ['farm_plot', 'tent', 'cottage', 'workshop', 'windmill_bakery', 'owl_post_office', 'flower_greenhouse'];
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
// VIP Wonders → Monuments (Master Plan v2 §11.4 / §14). No longer granted by the Royal Architect gacha:
// `monument: true` entries are BUILT in stages from materials (shared/monument_rules.js + basecamp_service);
// `cut: true` entries are retired (art kept, existing copies stay placeable, no new ownership).
// ---------------------------------------------------------------------------------------------
export const WONDERS = {
  wnd_onsen: {
    kind: 'wonder', sprite: 'wnd_onsen', name: 'Capybara Yuzu Hot Spring', emoji: '♨️', w: 3, h: 3, rarity: 2,
    blacksmithPct: (s) => lerpStar(15, 25, s), buffMs: 3600_000, monument: true,
    effect: 'Monument • Soak for Well-Rested: +15% gather yield for 30 min (every 4h)',
  },
  wnd_ferris: {
    kind: 'wonder', sprite: 'wnd_ferris', name: 'Couple Heart Ferris Wheel', emoji: '🎡', w: 4, h: 4, rarity: 3,
    matchYieldPct: (s) => lerpStar(25, 50, s), monument: true, heartIsleOnly: true,
    effect: 'Monument • Heart Isle only • +10% Date buff for 30 min',
  },
  wnd_fountain: {
    kind: 'wonder', sprite: 'wnd_fountain', name: 'Fountain of 1,000 Wishes', emoji: '⛲', w: 3, h: 3, rarity: 3,
    tossCost: 100, monument: true, effect: 'Monument • Daily 100 🪙 wish → a rare material',
  },
  wnd_casino_dome: {
    kind: 'wonder', sprite: 'wnd_casino_dome', name: 'Grand Golden Casino Dome', emoji: '🎰', w: 4, h: 4, rarity: 3, cut: true,
    effect: '2× Offline Storage Cap • +10% Monopoly Start Cash • −8% Land Cost',
  },
  wnd_world_tree: {
    kind: 'wonder', sprite: 'wnd_world_tree', name: 'Golden Starlight World-Tree', emoji: '🌳', w: 4, h: 4, rarity: 3, monument: true, update1: true,
    perDay: (s) => Math.floor(lerpStar(5, 15, s)), effect: '+5–15 💎 daily • +15–30% stats in Moon Bunny & Cloud Dash',
  },
  wnd_sakura_pagoda: {
    kind: 'wonder', sprite: 'wnd_sakura_pagoda', name: 'Kyoto Five-Tier Sakura Pagoda', emoji: '⛩️', w: 4, h: 4, rarity: 3, series3: true, cut: true,
    matchYieldPct: (s) => lerpStar(20, 45, s), effect: '+20–45% Post-Match Gold & Sakura Blessing',
  },
  wnd_mirage_palace: {
    kind: 'wonder', sprite: 'wnd_mirage_palace', name: "Sultan's Golden Mirage Palace", emoji: '🕌', w: 4, h: 4, rarity: 3, monument: true, update1: true, series3: true,
    matchYieldPct: (s) => lerpStar(25, 50, s), effect: '+25–50% Oasis Gold Yield • +10% Monopoly Start Cash',
  },
  wnd_atlantis_sanctuary: {
    kind: 'wonder', sprite: 'wnd_atlantis_sanctuary', name: 'Atlantis Pearl-Shell Palace', emoji: '🐚', w: 4, h: 4, rarity: 3, monument: true, update1: true, series3: true,
    perDay: (s) => Math.floor(lerpStar(8, 20, s)), effect: '+8–20 💎 Daily Pearl Tribute • +20% Fishing Chest Luck',
  },
  wnd_aurora_observatory: {
    kind: 'wonder', sprite: 'wnd_aurora_observatory', name: 'Starlight Aurora Observatory', emoji: '🔭', w: 4, h: 4, rarity: 3, monument: true, update1: true, series3: true,
    perDay: (s) => Math.floor(lerpStar(8, 20, s)), effect: '+8–20 💎 Daily Astral Reading • +15% Star-Force Focus',
  },
  wnd_tea_pavilion: {
    kind: 'wonder', sprite: 'wnd_tea_pavilion', name: 'Floating Matcha & Koi Tea House', emoji: '🍵', w: 3, h: 3, rarity: 2, series3: true,
    blacksmithPct: (s) => lerpStar(15, 25, s), buffMs: 3600_000, monument: true,
    effect: 'Monument • Unlocks the Matcha Tea recipe (brewed here)',
  },
  wnd_sky_airship_dock: {
    kind: 'wonder', sprite: 'wnd_sky_airship_dock', name: 'Royal Starlight Airship Harbor', emoji: '🛳️', w: 3, h: 3, rarity: 2, series3: true, cut: true,
    matchYieldPct: (s) => lerpStar(15, 35, s), effect: '+15–35% Sky-Harbor Trade Gold & Offline Storage',
  },
  wnd_burj_khalifa: {
    kind: 'wonder', sprite: 'wnd_burj_khalifa', name: 'Burj Khalifa & Dancing Fountain', emoji: '🏙️', w: 4, h: 4, rarity: 3, series3: true, spriteScale: 0.90, cut: true,
    matchYieldPct: (s) => lerpStar(30, 55, s), perDay: (s) => Math.floor(lerpStar(10, 25, s)),
    effect: '+30–55% Post-Match Gold • +10–25 💎 Daily Dubai Royal Tribute',
  },
};
export const WONDER_DUPE_SHARDS = { 2: 25, 3: 100 };

// ---------------------------------------------------------------------------------------------
// Cute Decor (Section 2.E). Comfort: +120 first copy, +30 each extra copy, decor total capped 2,400.
// Stage 5 (§11.5): flat stat buffs removed — `campProp` = functional prop, `cosmetic` = comfort only,
// `cut` = retired (owned copies stay placeable, not craftable), `protected` = NookAirline Museum.
// ---------------------------------------------------------------------------------------------
export const DECOR = {
  dec_swing:               { kind: 'decor', sprite: 'dec_swing', name: 'Sakura Couple Swing-Bench', emoji: '🪑', w: 2, h: 2, buff: {}, seats: 2, cosmetic: true, effect: 'Cosmetic • +Comfort' },
  dec_picnic:              { kind: 'decor', sprite: 'dec_picnic', name: 'Strawberry Tart Picnic Mat', emoji: '🧺', w: 2, h: 2, buff: {}, seats: 3, campProp: true, effect: 'Camp Prop • Visitor Picnic buff (20 min)' },
  dec_gramophone:          { kind: 'decor', sprite: 'dec_gramophone', name: 'Golden Gramophone Jukebox', emoji: '🎶', w: 1, h: 1, buff: {}, cosmetic: true, effect: 'Cosmetic • +Comfort' },
  dec_tent:                { kind: 'decor', sprite: 'dec_tent', name: 'Starlight Glamping Tent & Campfire', emoji: '⛺', w: 2, h: 2, buff: {}, campProp: true, effect: 'Camp Prop • Free Bread once a day' },
  dec_cat_cushion:         { kind: 'decor', sprite: 'dec_cat_cushion', name: 'Giant Cat-Paw Cushion & Tree', emoji: '🐱', w: 1, h: 1, buff: {}, cut: true, effect: 'Retired • Cosmetic • +Comfort' },
  dec_balloon_cart:        { kind: 'decor', sprite: 'dec_balloon_cart', name: 'Cotton-Candy Balloon Cart', emoji: '🎈', w: 1, h: 1, buff: {}, cut: true, effect: 'Retired • Cosmetic • +Comfort' },
  dec_mushroom_ring:       { kind: 'decor', sprite: 'dec_mushroom_ring', name: 'Glowing Fairy Mushroom Ring', emoji: '🌷', w: 1, h: 1, buff: {}, cosmetic: true, effect: 'Cosmetic • +Comfort' },
  dec_birdbath_lamp:       { kind: 'decor', sprite: 'dec_birdbath_lamp', name: 'Rose-Gold Birdbath & Streetlamp', emoji: '⛲', w: 1, h: 1, buff: {}, cosmetic: true, effect: 'Cosmetic • +Comfort' },
  dec_wooden_bench:        { kind: 'decor', sprite: 'dec_wooden_bench', name: 'Cozy Carved Park Bench', emoji: '🪵', w: 2, h: 1, series2: true, seats: 2, buff: { comfortBonus: 30 }, cosmetic: true, effect: 'Cosmetic • +Comfort' },
  dec_flower_cart:         { kind: 'decor', sprite: 'dec_flower_cart', name: 'Pastel Blossom Wheel-Cart', emoji: '💐', w: 2, h: 2, series2: true, buff: {}, cosmetic: true, effect: 'Cosmetic • +Comfort' },
  dec_boba_stand:          { kind: 'decor', sprite: 'dec_boba_stand', name: 'Strawberry-Cat Boba Tea Cart', emoji: '🧋', w: 2, h: 2, series2: true, buff: {}, cut: true, effect: 'Retired • Cosmetic • +Comfort' },
  dec_wishing_well:        { kind: 'decor', sprite: 'dec_wishing_well', name: 'Fairytale Stone Wishing Well', emoji: '🪣', w: 2, h: 2, series2: true, buff: {}, cosmetic: true, effect: 'Cosmetic • +Comfort' },
  dec_honey_beehive:       { kind: 'decor', sprite: 'dec_honey_beehive', name: 'Golden Meadow Honey Beehive', emoji: '🐝', w: 1, h: 1, series2: true, buff: {}, campProp: true, effect: 'Camp Prop • +1 Honey every 2h' },
  dec_cat_bakery_sign:     { kind: 'decor', sprite: 'dec_cat_bakery_sign', name: 'Croissant-Cat Bakery Board', emoji: '🥐', w: 1, h: 1, series2: true, buff: {}, cut: true, effect: 'Retired • Cosmetic • +Comfort' },
  dec_couple_hammock:      { kind: 'decor', sprite: 'dec_couple_hammock', name: 'Blossom-Draped Couple Hammock', emoji: '🌸', w: 2, h: 1, series2: true, seats: 2, buff: {}, campProp: true, effect: 'Camp Prop • Couple Harmony buff (30 min)' },
  dec_koi_barrel_pond:     { kind: 'decor', sprite: 'dec_koi_barrel_pond', name: 'Mini Oak-Barrel Lotus & Koi Pond', emoji: '🪷', w: 2, h: 2, series2: true, buff: {}, campProp: true, effect: 'Camp Prop • +1 Fish every 3h' },
  dec_painter_easel:       { kind: 'decor', sprite: 'dec_painter_easel', name: "Sunlit Storybook Painter's Easel", emoji: '🎨', w: 1, h: 1, series2: true, buff: { comfortBonus: 25 }, cut: true, effect: 'Retired • Cosmetic • +Comfort' },
  dec_berry_wheelbarrow:   { kind: 'decor', sprite: 'dec_berry_wheelbarrow', name: 'Star-Berry Harvest Wheelbarrow', emoji: '🍓', w: 1, h: 1, series2: true, buff: {}, campProp: true, effect: 'Camp Prop • +10% Warehouse Capacity' },
  dec_starlight_telescope: { kind: 'decor', sprite: 'dec_starlight_telescope', name: 'Brass Starlight Stargazer Telescope', emoji: '🔭', w: 1, h: 1, series2: true, buff: {}, campProp: true, effect: 'Camp Prop • Preview upcoming events' },
  dec_owl_mailbox:         { kind: 'decor', sprite: 'dec_owl_mailbox', name: 'Sleepy Owl Postbox & Parcel Stack', emoji: '📮', w: 1, h: 1, series2: true, buff: {}, campProp: true, effect: 'Camp Prop • +1 Order Board slot' },
  dec_sakura_drum_bridge:   { kind: 'decor', sprite: 'dec_sakura_drum_bridge', name: 'Kyoto Red-Lacquer Drum Bridge', emoji: '🌉', w: 2, h: 1, series3: true, buff: {}, cosmetic: true, effect: 'Cosmetic • +Comfort' },
  dec_bamboo_shishi_odoshi: { kind: 'decor', sprite: 'dec_bamboo_shishi_odoshi', name: 'Kyoto Bamboo Water-Spout Rockery', emoji: '🎍', w: 2, h: 2, series3: true, buff: {}, cosmetic: true, effect: 'Cosmetic • +Comfort' },
  dec_sultan_bazaar_canopy: { kind: 'decor', sprite: 'dec_sultan_bazaar_canopy', name: "Silk-Draped Sultan's Oasis Tent", emoji: '🎪', w: 2, h: 2, series3: true, seats: 2, buff: {}, cut: true, effect: 'Retired • Cosmetic • +Comfort' },
  dec_oasis_obelisk_fountain: { kind: 'decor', sprite: 'dec_oasis_obelisk_fountain', name: 'Golden Sun-Disc Obelisk Fountain', emoji: '☀️', w: 2, h: 2, series3: true, buff: {}, cut: true, effect: 'Retired • Cosmetic • +Comfort' },
  dec_siren_shell_fountain: { kind: 'decor', sprite: 'dec_siren_shell_fountain', name: 'Atlantis Giant Clam & Harp Fountain', emoji: '🐚', w: 2, h: 2, series3: true, buff: {}, cut: true, effect: 'Retired • Cosmetic • +Comfort' },
  dec_coral_crystal_arch:   { kind: 'decor', sprite: 'dec_coral_crystal_arch', name: 'Glowing Coral & Sea-Glass Archway', emoji: '🪸', w: 2, h: 1, series3: true, buff: {}, cut: true, effect: 'Retired • Cosmetic • +Comfort' },
  dec_aurora_crystal_gazebo: { kind: 'decor', sprite: 'dec_aurora_crystal_gazebo', name: 'Glacial Crystal Swan Gazebo', emoji: '🦢', w: 2, h: 2, series3: true, seats: 2, buff: {}, cosmetic: true, effect: 'Cosmetic • +Comfort' },
  dec_stone_arch_footbridge: { kind: 'decor', sprite: 'dec_stone_arch_footbridge', name: 'Royal Carved Stone Arch Footbridge', emoji: '🌉', w: 2, h: 2, series3: true, buff: { comfortBonus: 40 }, cosmetic: true, effect: 'Cosmetic • +Comfort' },
  dec_heaven_winged_pillar:  { kind: 'decor', sprite: 'dec_heaven_winged_pillar', name: 'Celestial Winged Sun-Orb Pillar', emoji: '🏛️', w: 1, h: 1, series3: true, buff: {}, cut: true, effect: 'Retired • Cosmetic • +Comfort' },
  dec_heaven_cloud_arch:     { kind: 'decor', sprite: 'dec_heaven_cloud_arch', name: 'Heavenly Winged Cloud Archway', emoji: '🪽', w: 2, h: 1, series3: true, buff: {}, cut: true, effect: 'Retired • Cosmetic • +Comfort' },
  dec_heaven_divine_tree:    { kind: 'decor', sprite: 'dec_heaven_divine_tree', name: 'Sacred Pearl-Blossom Heaven Tree', emoji: '🌳', w: 2, h: 2, series3: true, buff: {}, cosmetic: true, effect: 'Cosmetic • +Comfort' },
  dec_heaven_lotus_fountain: { kind: 'decor', sprite: 'dec_heaven_lotus_fountain', name: 'Celestial Lotus & Cloud Basin', emoji: '🪷', w: 2, h: 2, series3: true, buff: {}, cut: true, effect: 'Retired • Cosmetic • +Comfort' },
  dec_heaven_seraph_harp:    { kind: 'decor', sprite: 'dec_heaven_seraph_harp', name: 'Golden Seraphim Angel-Wing Lyre', emoji: '🪉', w: 1, h: 1, series3: true, buff: {}, cut: true, effect: 'Retired • Cosmetic • +Comfort' },
  dec_palm_jumeirah_island:  { kind: 'decor', sprite: 'dec_palm_jumeirah_island', name: 'Palm Jumeirah & Royal Atlantis Lagoon', emoji: '🏝️', w: 2, h: 2, series3: true, spriteScale: 1.05, buff: {}, cut: true, effect: 'Retired • Cosmetic • +Comfort' },
  dec_burj_al_arab_sail:     { kind: 'decor', sprite: 'dec_burj_al_arab_sail', name: 'Burj Al Arab Golden Sail Hotel', emoji: '⛵', w: 2, h: 2, series3: true, spriteScale: 0.82, buff: {}, cut: true, effect: 'Retired • Cosmetic • +Comfort' },
  dec_museum_of_the_future:  { kind: 'decor', sprite: 'dec_museum_of_the_future', name: 'Dubai Museum of the Future Torus', emoji: '🪐', w: 2, h: 2, series3: true, buff: {}, cut: true, effect: 'Retired • Cosmetic • +Comfort' },
  dec_dubai_dallah_majlis:   { kind: 'decor', sprite: 'dec_dubai_dallah_majlis', name: 'Emirati Dallah Coffee & Falcon Majlis', emoji: '🦅', w: 2, h: 2, series3: true, seats: 2, buff: {}, cut: true, effect: 'Retired • Cosmetic • +Comfort' },
  dec_nookairline_museum:    { kind: 'decor', sprite: 'dec_nookairline_museum', name: 'NookAirline V1 Memory Museum & 2.5D Portals', emoji: '✈️', w: 2, h: 2, series3: true, spriteScale: 1.35, seats: 2, buff: {}, protected: true, effect: 'Memory Landmark • Enter the NookAirline V1 Museum' },
};
// Couple Love Pavilion: not placeable — rendered at BridgeCenterX when a couple bridge is visible.
export const LOVE_PAVILION = { sprite: 'dec_love_pavilion', name: 'Couple Love Pavilion', harmonyPct: 25 };

export const ENV_PROPS_25D = {
  trees: ['env_tree_oak_a', 'env_tree_oak_b', 'env_tree_sakura_a', 'env_tree_sakura_b', 'env_tree_fruit_apple', 'env_tree_golden_maple', 'env_pine', 'env_tree_palm_oasis', 'env_tree_pine_snowy', 'dec_heaven_divine_tree'],
  bushes: ['env_bush_mixed_large', 'env_bush_roses_pink', 'env_bush_daisies_white', 'env_bush_hydrangea_blue', 'env_hedge_boxwood_straight', 'env_hedge_boxwood_corner', 'env_hedge_ortho_horizontal', 'env_flowerbed_planter', 'env_planter_ortho_horizontal', 'env_sunflower_clump'],
  fences: ['env_fence_wood_stone_straight', 'env_fence_wood_stone_corner', 'env_fence_wood_stone_gate', 'env_fence_ortho_horizontal', 'env_arch_floral_ortho', 'env_wall_stone_low', 'dec_bench_ortho_front', 'decal_plaza_medallion_circle', 'dec_heaven_winged_pillar', 'dec_heaven_cloud_arch'],
  lamps: ['env_streetlamp_iron', 'env_streetlamp_double', 'env_string_lights_post', 'env_signpost', 'dec_heaven_seraph_harp'],
  water: ['env_river_boulders_a', 'env_river_boulders_b', 'env_river_cattails', 'decal_water_lily_white', 'decal_water_lotus_pink', 'dec_heaven_lotus_fountain', 'dec_palm_jumeirah_island'],
  bridges: ['bridge_stone_deck', 'env_bridge_parapet_side', 'env_bridge_pillar_cap', 'bridge_wood_deck', 'bridge_rainbow_arch', 'bridge_rainbow_front_arch', 'bridge_rainbow_back_rail', 'bridge_rainbow_deck_strip', 'dec_stone_arch_footbridge', 'dec_sakura_drum_bridge'],
  cliffs: ['cliff_grass_lip_strip', 'cliff_side_strata_strip', 'cliff_waterfall_strip', 'cliff_wall_strip', 'cliff_rim_turf_strip', 'cliff_heaven_cloud_wall', 'env_waterfall_mist', 'env_cloud_fluffy_a', 'env_cloud_fluffy_b'],
  monopolyEmblems: ['mono_icon_start', 'mono_icon_casino', 'mono_icon_airdrop', 'mono_icon_vault', 'mono_icon_warp', 'mono_icon_arena'],
  monopolyGrounds: ['mono_ground_brook_classic', 'mono_ground_pond_sakura', 'mono_ground_oasis_mirage', 'mono_ground_lagoon_atlantis', 'mono_ground_rink_aurora', 'mono_ground_palm_jumeirah'],
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
  farmland:       { name: 'Farmland Soil', emoji: '🌱', sprite: 'road_farmland', farmland: true },
  road_dirt:      { name: 'Dirt Path', emoji: '🥾', sprite: 'road_dirt', road: true },
  road_flagstone: { name: 'Flagstone Plaza', emoji: '🏛️', sprite: 'road_flagstone', road: true },
  boardwalk:      { name: 'Wooden Boardwalk', emoji: '🪵', sprite: 'road_boardwalk', bridge: true, road: true },
  wildflower:     { name: 'Flower Meadow', emoji: '🌼', sprite: 'road_wildflower' },
};
export const ROAD_SPEED_BOOST = 1.15;      // +15% walk speed on road tiles
export const ROAD_PATH_COST = 0.85;

export const GROUND_SKINS = {
  ground_classic: { name: 'Classic Klaipeda Fairytale', emoji: '🌿' },
  ground_sakura:  { name: 'Kyoto Sakura Blossom', emoji: '🌸' },
  ground_vanilla: { name: 'Sweet Vanilla Patisserie', emoji: '🍬' },
  ground_aurora:  { name: 'Starlight Aurora Sanctuary', emoji: '🌌' },
  biome_autumn_orchard:  { name: 'Autumn Orchard', emoji: '🍂' },
  biome_mossy_woods:     { name: 'Mossy Woods', emoji: '🌲' },
  biome_winter_highland: { name: 'Winter Highland', emoji: '❄️' },
  biome_rose_garden:     { name: 'Rose Garden', emoji: '🌹' },
};

export const BIOME_THEMES = {
  biome_meadow:          { name: 'Emerald Meadow', emoji: '🌿', sprite: 'ground_classic' },
  biome_autumn_orchard:  { name: 'Autumn Orchard', emoji: '🍂', sprite: 'biome_autumn_orchard' },
  biome_mossy_woods:     { name: 'Mossy Woods', emoji: '🌲', sprite: 'biome_mossy_woods' },
  biome_winter_highland: { name: 'Winter Highland', emoji: '❄️', sprite: 'biome_winter_highland' },
  biome_rose_garden:     { name: 'Rose Garden', emoji: '🌹', sprite: 'biome_rose_garden' },
};

export const MOODS = ['auto', 'sunny', 'sakura', 'sunset', 'night'];
export const TIME_OF_DAY = ['auto', 'dawn', 'day', 'dusk', 'night'];
export const WEATHERS = ['clear', 'overcast', 'drizzle', 'leaf_fall', 'petal_fall', 'fireflies'];

/** Cloud Territory expansion tiers (Section 2.A.2). Index 0 = base island. */
// Stage 3: tiers are unlocked by story chapters (village.max_grid) and paid with materials + gold.
// `castleLv` is kept (always 1) only so older client builds keep rendering the expansion card.
export const EXPANSION_TIERS = [
  { size: 18, castleLv: 1, gold: 0, cost: {} },
  { size: 20, castleLv: 1, gold: 1500, cost: { plank: 30, stone: 30, gold: 1500 } },
  { size: 24, castleLv: 1, gold: 4000, cost: { plank: 60, stone: 60, gold: 4000 } },
  { size: 28, castleLv: 1, gold: 9000, cost: { plank: 120, stone: 120, ingot: 30, gold: 9000 } },
  { size: 32, castleLv: 1, gold: 20000, cost: { plank: 200, stone: 200, ingot: 60, gold: 20000 } },
];

// ---------------------------------------------------------------------------------------------
// Fishing (Section 2.F)
// ---------------------------------------------------------------------------------------------
export const FISH = {
  minnow: {
    name: 'Silver Stream Minnow', emoji: '🐟', sprite: 'fish_minnow', rate: 45,
    reward: { gold: 150 }, exp: 25,
    rarity: 'common', stars: 1, minKg: 0.18, maxKg: 0.78, behavior: 'calm',
    desc: 'Shimmering pond minnow that schools beneath the wooden dock.',
  },
  crab: {
    name: 'Starlight Coral Crab', emoji: '🦀', sprite: 'fish_crab', rate: 30,
    reward: { gold: 300, berries: 10 }, exp: 25,
    rarity: 'rare', stars: 2, minKg: 0.48, maxKg: 1.96, behavior: 'heavy',
    desc: 'Rosy star-shelled crab that pinches sweet Star-Berries along the riverbed.',
  },
  koi: {
    name: 'Golden Starlight Koi', emoji: '🐠', sprite: 'fish_koi', rate: 15,
    reward: { gold: 500, berries: 25 }, exp: 25, baitOnly: true,
    rarity: 'epic', stars: 3, minKg: 1.85, maxKg: 6.80, behavior: 'darter',
    desc: 'Radiant golden koi drawn only to fragrant Starlight Berry Bait.',
  },
  chest: {
    name: 'Sunken Duplicate Gear Chest', emoji: '🎁', sprite: 'fish_chest', rate: 10,
    reward: { dupe: 1 }, exp: 50, baitOnly: true,
    rarity: 'mythic', stars: 4, minKg: 8.50, maxKg: 24.50, behavior: 'treasure',
    desc: 'Gilded royal reliquary containing +1 Duplicate Gear for +10 Star-Force Blacksmith upgrades!',
  },
};
export const FISHING = {
  BAIT_COST_BERRIES: 5, COOP_CHEST_MULT: 1.35, COOP_RADIUS: 4.0, DOCK_REACH: 2.6,
  BITE_MIN_MS: 2500, BITE_MAX_MS: 5000, REEL_MS: 3500, CAST_TIMEOUT_MS: 60000,
  SWEET_SPOT_WIDTH: 0.28, HOLD_SPEED: 0.45, DRIFT_SPEED: 0.35,
  CODEX_MILESTONES: [1, 10, 50], CODEX_DIAMONDS: 50,
  BAIT_CHEST_PITY: 10, PERFECT_HOOK_WINDOW_MS: 650,
};

export const ANGLER_EXCHANGE = [
  {
    id: 'chest_targeted',
    name: 'Targeted Sunken Gear Chest',
    sub: '+1 Duplicate for your Pinned Target Gear (+10 Blacksmith!)',
    icon: '/assets/village/fish_chest.png',
    badge: '🔨 +10 FORGE DUPE',
    rarity: 'mythic',
    cost: { minnow: 6, crab: 4 },
    reward: { targetedDupe: 1, exp: 50 },
  },
  {
    id: 'chest_koi_express',
    name: 'Sovereign Koi Reliquary Chest',
    sub: 'Instant +1 Pinned Gear Duplicate + 500 🪙 Gold',
    icon: '/assets/ui/item_dupe_box.png',
    badge: '👑 KOI SPECIAL',
    rarity: 'mythic',
    cost: { koi: 2 },
    reward: { targetedDupe: 1, gold: 500, exp: 60 },
  },
  {
    id: 'gacha_ticket',
    name: 'Goddess Summon Ticket',
    sub: '1x Free Pull in Goddess Fashion or Architect Gacha',
    icon: '/assets/ui/item_ticket_standard.png',
    badge: '🎟️ SUMMON PULL',
    rarity: 'epic',
    cost: { minnow: 5, crab: 3 },
    reward: { ticket: 1, exp: 35 },
  },
  {
    id: 'blessed_scroll',
    name: 'Blessed Star-Force Scroll',
    sub: '+1 Protection Scroll & +15% Blacksmith Forge Buff (1h)',
    icon: '/assets/ui/item_protection_scroll.png',
    badge: '🔨 FORGE +15%',
    rarity: 'epic',
    cost: { crab: 4, koi: 1 },
    reward: { scroll: 1, forgeBuffPct: 15, exp: 40 },
  },
  {
    id: 'pet_sashimi',
    name: 'Royal Sashimi Pet Platter',
    sub: '+60 Pet Bond EXP, +30 Pet Essence & +40 🍓 Star-Berries',
    icon: '/assets/ui/icon_pet_bond.png',
    badge: '🐾 PET FEAST',
    rarity: 'rare',
    cost: { minnow: 4, crab: 2 },
    reward: { petExp: 60, petEssence: 30, berries: 40, exp: 30 },
  },
  {
    id: 'starlight_shards',
    name: '25x Starlight Pity Shards',
    sub: 'Redeem directly for 0% RNG Mythic Outfits in Shard Shop',
    icon: '/assets/ui/icon_shard.png',
    badge: '⭐ 0% RNG SHARDS',
    rarity: 'mythic',
    cost: { koi: 2, crab: 3 },
    reward: { shards: 25, exp: 45 },
  },
  {
    id: 'angler_diamonds',
    name: 'Sunken Pearl Pouch (+100 💎)',
    sub: '+100 Diamonds & +1,000 Gold from deep-sea starlight pearls',
    icon: '/assets/ui/icon_diamond.png',
    badge: '💎 +100 DIAMONDS',
    rarity: 'mythic',
    cost: { minnow: 8, crab: 5, koi: 1 },
    reward: { diamonds: 100, gold: 1000, exp: 50 },
  },
];

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
