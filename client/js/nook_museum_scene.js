// client/js/nook_museum_scene.js — NookAirline V1 Memory Museum & 2.5D Living Scenery Portals
// Group structure: 'nook_museum_root' -> 'museum_main_hall', 'museum_portal_realm'
import * as THREE from 'three';

// ---------------------------------------------------------------------------
// 1. Chronological Nook & Neen V1 Development & Memory Timeline (6 Chapters)
// ---------------------------------------------------------------------------
export const MUSEUM_TIMELINE_CHAPTERS = Object.freeze([
  Object.freeze({
    id: 'ch1_boarding',
    chapter: 'Chapter I',
    date: 'Early 2026 • Flight NA-001',
    title: 'The First Boarding Pass & First-Class Sky Cabin',
    subtitle: 'Where NookAirline took off for Nook & Neen',
    story:
      'NookAirline V1 began as a handcrafted love-letter web app built for Nook & Neen — starting with a golden First-Class boarding pass, Captain Nook & Cabin Crew greetings, and an intimate wood-paneled sky suite above the clouds.',
    snapshots: Object.freeze([
      '/assets/museum/v1/ref_boarding_pass.png',
      '/assets/museum/v1/plane_cabin_wide.png',
      '/assets/museum/v1/pilot_captain.png',
      '/assets/museum/v1/emirates_crew.png',
      '/assets/museum/v1/bkk_guy.png',
    ]),
  }),
  Object.freeze({
    id: 'ch2_warm_hug',
    chapter: 'Chapter II',
    date: 'Spring 2026 • 36,000 Feet',
    title: 'Warm Hugs Under the Blanket & Sky Galley Dining',
    subtitle: 'Cozy pajamas, Mango Sticky Rice, A5 Wagyu & the iconic Warm Hug',
    story:
      'As night fell in the cabin, Nook & Neen changed into matching sky pajamas, ordered Mango Sticky Rice, A5 Wagyu Steak, and Gold Leaf Mocktails from the Galley Kitchen, and shared the cherished Chibi Warm Hug under a single cabin blanket.',
    snapshots: Object.freeze([
      '/assets/museum/v1/chibi_warm_hug.png',
      '/assets/museum/v1/chibi_standing_hug.png',
      '/assets/museum/v1/galley_kitchen_wide.png',
      '/assets/museum/v1/dish_mango_rice.png',
      '/assets/museum/v1/dish_wagyu_steak.png',
      '/assets/museum/v1/dish_gold_mocktail.png',
      '/assets/museum/v1/pajama_guy.png',
      '/assets/museum/v1/pajama_girl.png',
    ]),
  }),
  Object.freeze({
    id: 'ch3_world_windows',
    chapter: 'Chapter III',
    date: 'Mid 2026 • 14 Global Horizons',
    title: '14 Dream Sceneries Outside the Cabin Window',
    subtitle: 'From Kyoto Mount Fuji & Paris Eiffel Tower to Swiss Alps & Maldives',
    story:
      'Every flight unlocked a new hand-illustrated window destination — watching cherry blossoms drift past Mount Fuji in Kyoto, moonlit cruises in Paris, starry Matterhorn chalets in Switzerland, Arabian terraces in Dubai, and overwater piers in the Maldives.',
    snapshots: Object.freeze([
      '/assets/museum/v1/scene_kyoto_wide.jpg',
      '/assets/museum/v1/scene_paris_wide.jpg',
      '/assets/museum/v1/scene_swiss_wide.jpg',
      '/assets/museum/v1/scene_dubai_wide.jpg',
      '/assets/museum/v1/scene_maldives_wide.jpg',
      '/assets/museum/v1/scene_santorini_wide.jpg',
      '/assets/museum/v1/scene_venice_wide.jpg',
      '/assets/museum/v1/scene_atlantis_wide.jpg',
      '/assets/museum/v1/scene_montecarlo_wide.jpg',
      '/assets/museum/v1/scene_starlight_wide.jpg',
      '/assets/museum/v1/scene_permafrost_wide.jpg',
      '/assets/museum/v1/scene_luxor_wide.jpg',
      '/assets/museum/v1/scene_fairytale_wide.jpg',
      '/assets/museum/v1/scene_olympus_wide.jpg',
    ]),
  }),
  Object.freeze({
    id: 'ch4_gacha_seasons',
    chapter: 'Chapter IV',
    date: 'Summer 2026 • Seasons 1–11',
    title: 'The 11 Mythic Gacha Seasons (Painting Floor)',
    subtitle: 'His & Hers Couture from Bangkok Naga to Olympus Gods',
    story:
      'Nook & Neen collected matching mythic ensembles across 11 unforgettable Gacha banners — now immortalized across the Museum Painting Floor so you can walk across every original banner canvas and inspect the life-size costumes.',
    snapshots: Object.freeze([
      '/assets/museum/v1/banner_main.jpg',
      '/assets/museum/v1/banner_s1.jpg',
      '/assets/museum/v1/banner_s2.jpg',
      '/assets/museum/v1/banner_s3.jpg',
      '/assets/museum/v1/banner_s4.jpg',
      '/assets/museum/v1/banner_s5.jpg',
      '/assets/museum/v1/banner_s6.jpg',
      '/assets/museum/v1/banner_s7.jpg',
      '/assets/museum/v1/banner_s10.jpg',
      '/assets/museum/v1/banner_s11.jpg',
    ]),
  }),
  Object.freeze({
    id: 'ch5_cat_lounge',
    chapter: 'Chapter V',
    date: 'Late Summer 2026 • Purr-fect Altitude',
    title: 'Sky Cat Lounge, Kitty Claw Machine & Monopoly Nights',
    subtitle: '27 Companion Cats, Mochi, Captain Whiskers & Board Game Dates',
    story:
      'Between flights, Nook & Neen relaxed in the First-Class Cat Lounge with Mochi, Ragdoll, Captain Whiskers, Sakura, Moon, and Maneki, won prizes at the Kitty Claw Machine, and played late-night matches on the NookAirline Monopoly mat.',
    snapshots: Object.freeze([
      '/assets/museum/v1/cat_lounge_bg.jpg',
      '/assets/museum/v1/kitty_machine.png',
      '/assets/museum/v1/monopoly_mat.png',
      '/assets/museum/v1/cat_mochi.png',
      '/assets/museum/v1/cat_ragdoll.png',
      '/assets/museum/v1/cat_captain.png',
      '/assets/museum/v1/cat_sakura.png',
      '/assets/museum/v1/cat_moon.png',
      '/assets/museum/v1/cat_maneki.png',
    ]),
  }),
  Object.freeze({
    id: 'ch6_living_world',
    chapter: 'Chapter VI',
    date: 'Today • Neora World V2',
    title: 'Stepping Through the Window Together into 2.5D',
    subtitle: 'Where 2D cabin memories become a living world to walk hand-in-hand',
    story:
      'In V1, you looked out at Mount Fuji, Paris, and the Swiss Alps through a cabin window. In Neora World V2, those cherished paintings become 6 Living Scenery Portals that you and your partner can step inside and explore together.',
    snapshots: Object.freeze([
      '/assets/museum/v1/couple_bunnies_premium.png',
      '/assets/museum/v1/social_couple_art_card.png',
      '/assets/museum/v1/chibi_warm_hug.png',
      '/assets/museum/v1/scene_kyoto_wide.jpg',
    ]),
  }),
]);

// ---------------------------------------------------------------------------
// 2. Zone 1 — The 12 Character Gacha Painting Floor Exhibits (Linked to 2.5D Season Worlds!)
// ---------------------------------------------------------------------------
export const MUSEUM_GACHA_EXHIBITS = Object.freeze([
  Object.freeze({
    id: 'exhibit_s1',
    season: 'Season 1',
    portalId: 'bangkok',
    title: 'S1 Bangkok After Dark',
    tagline: 'Mythic Naga Sovereign & Golden Kinnaree + Chao Phraya Cruise',
    icon: '🐉',
    x: -7.0,
    z: -2.4,
    r: 2.3,
    bannerUrl: '/assets/museum/v1/banner_s1.jpg',
    maleSprite: '/assets/museum/v1/s1_naga_m.png',
    femaleSprite: '/assets/museum/v1/s1_kinnaree_f.png',
    extraSprites: Object.freeze([
      '/assets/museum/v1/s1_cruise_m.png',
      '/assets/museum/v1/s1_cruise_f.png',
      '/assets/museum/v1/bkk_guy.png',
    ]),
    story:
      'The inaugural NookAirline Gacha celebrating Bangkok nights — featuring the emerald Naga Sovereign, radiant golden Kinnaree wings, and breezy Chao Phraya River Cruise date outfits.',
  }),
  Object.freeze({
    id: 'exhibit_s2',
    season: 'Season 2',
    portalId: 'fuji',
    title: 'S2 Kyoto Moonlight & Inari Shrine',
    tagline: 'Nine-Tail Fox Inari & Celestial Tsukuyomi Kimono',
    icon: '⛩️',
    x: -4.6,
    z: -2.4,
    r: 2.3,
    bannerUrl: '/assets/museum/v1/banner_s2.jpg',
    maleSprite: '/assets/museum/v1/s2_inari_m.png',
    femaleSprite: '/assets/museum/v1/s2_inari_f.png',
    extraSprites: Object.freeze([
      '/assets/museum/v1/s2_celestial_m.png',
      '/assets/museum/v1/s2_celestial_f.png',
      '/assets/museum/v1/scene_kyoto_wide.jpg',
    ]),
    story:
      'Inspired by twilight walks beneath Kyoto vermilion Torii gates and Mount Fuji — pairing spiritual fox-spirit Inari haori with starlight Celestial robes.',
  }),
  Object.freeze({
    id: 'exhibit_s3',
    season: 'Season 3',
    portalId: 'dubai',
    title: 'S3 Arabian Mirage & Golden Phoenix',
    tagline: 'Starlit Djinn Sultan & Solar Phoenix Empress',
    icon: '🧞',
    x: -7.0,
    z: 5.2,
    r: 2.3,
    bannerUrl: '/assets/museum/v1/banner_s3.jpg',
    maleSprite: '/assets/museum/v1/s3_djinn_m.png',
    femaleSprite: '/assets/museum/v1/s3_djinn_f.png',
    extraSprites: Object.freeze([
      '/assets/museum/v1/s3_phoenix_m.png',
      '/assets/museum/v1/s3_phoenix_f.png',
      '/assets/museum/v1/scene_dubai_wide.jpg',
    ]),
    story:
      'Born from the Dubai desert skyline and lantern-lit majlis terraces — shimmering sapphire Djinn silks alongside blazing Golden Phoenix wings.',
  }),
  Object.freeze({
    id: 'exhibit_s4',
    season: 'Season 4',
    portalId: 'montecarlo',
    title: 'S4 Casino Royale & Monte Carlo',
    tagline: 'High-Roller Velvet Tuxedo & Diamond Gala Gown',
    icon: '🎰',
    x: -4.6,
    z: 5.2,
    r: 2.3,
    bannerUrl: '/assets/museum/v1/banner_s4.jpg',
    maleSprite: '/assets/museum/v1/s4_royale_m.png',
    femaleSprite: '/assets/museum/v1/s4_royale_f.png',
    extraSprites: Object.freeze([
      '/assets/museum/v1/scene_montecarlo_wide.jpg',
      '/assets/museum/v1/monopoly_mat.png',
      '/assets/museum/v1/banner_main.jpg',
    ]),
    story:
      'Dressed to the nines for Monte Carlo harbor yachts and Sky Monopoly high-stakes evenings in crimson velvet and gold.',
  }),
  Object.freeze({
    id: 'exhibit_s5',
    season: 'Season 5',
    portalId: 'atlantis',
    title: 'S5 Abyssal Atlantis & Pearl Siren',
    tagline: 'Oceanic Triton King & Bioluminescent Pearl Siren',
    icon: '🔱',
    x: -7.0,
    z: 9.8,
    r: 2.3,
    bannerUrl: '/assets/museum/v1/banner_s5.jpg',
    maleSprite: '/assets/museum/v1/s5_triton_m.png',
    femaleSprite: '/assets/museum/v1/s5_siren_f.png',
    extraSprites: Object.freeze([
      '/assets/museum/v1/scene_atlantis_wide.jpg',
      '/assets/museum/v1/scene_maldives_wide.jpg',
    ]),
    story:
      'Diving beneath the Maldives lagoon into the crystal domes of Atlantis with iridescent coral crowns and golden tridents.',
  }),
  Object.freeze({
    id: 'exhibit_s6',
    season: 'Season 6',
    portalId: 'starlight',
    title: 'S6 Cosmic Supernova & Starlight',
    tagline: 'Astral Navigator & Nebula Starlight Valkyrie',
    icon: '🌌',
    x: -4.6,
    z: 9.8,
    r: 2.3,
    bannerUrl: '/assets/museum/v1/banner_s6.jpg',
    maleSprite: '/assets/museum/v1/s6_supernova_m.png',
    femaleSprite: '/assets/museum/v1/s6_supernova_f.png',
    extraSprites: Object.freeze(['/assets/museum/v1/scene_starlight_wide.jpg']),
    story:
      'Cruising past the stratosphere into the Starlight Odyssey — constellation capes and glowing zero-gravity halos.',
  }),
  Object.freeze({
    id: 'exhibit_s7',
    season: 'Season 7',
    portalId: 'fairytale',
    title: 'S7 Enchanted Fairytale Ballroom',
    tagline: 'Royal Beast & Golden Belle + Crystal Glass Slipper',
    icon: '🌹',
    x: -7.8,
    z: -7.8,
    r: 2.3,
    bannerUrl: '/assets/museum/v1/banner_s7.jpg',
    maleSprite: '/assets/museum/v1/s7_belle_m.png',
    femaleSprite: '/assets/museum/v1/s7_belle_f.png',
    extraSprites: Object.freeze([
      '/assets/museum/v1/s7_cinderella_m.png',
      '/assets/museum/v1/s7_cinderella_f.png',
      '/assets/museum/v1/scene_fairytale_wide.jpg',
    ]),
    story:
      'A double fairytale romance featuring both the enchanted rose ballroom attire and midnight crystal Cinderella regalia.',
  }),
  Object.freeze({
    id: 'exhibit_s8',
    season: 'Season 8',
    portalId: 'permafrost',
    title: 'S8 Sovereign of Permafrost',
    tagline: 'Glacial Frost Warden & Aurora Ice Empress',
    icon: '❄️',
    x: -14.8,
    z: -7.8,
    r: 2.3,
    bannerUrl: '/assets/museum/v1/scene_permafrost_wide.jpg',
    maleSprite: '/assets/museum/v1/s8_warden_m.png',
    femaleSprite: '/assets/museum/v1/s8_empress_f.png',
    extraSprites: Object.freeze(['/assets/museum/v1/scene_swiss_wide.jpg']),
    story:
      'Forged in the northern lights above the Swiss Alps and Permafrost Citadel — crystalline ice-crown armor and winter fur cloaks.',
  }),
  Object.freeze({
    id: 'exhibit_s9',
    season: 'Season 9',
    portalId: 'luxor',
    title: 'S9 Sands of Luxor & Golden Dynasty',
    tagline: 'Sun-God Pharaoh & Queen Cleopatra of the Nile',
    icon: '👑',
    x: -14.8,
    z: -1.8,
    r: 2.3,
    bannerUrl: '/assets/museum/v1/scene_luxor_wide.jpg',
    maleSprite: '/assets/museum/v1/s9_pharaoh_m.png',
    femaleSprite: '/assets/museum/v1/s9_cleopatra_f.png',
    extraSprites: Object.freeze(['/assets/museum/v1/dish_gold_mocktail.png']),
    story:
      'Gilded lapis-lazuli collars, winged solar pectorals, and royal regalia overlooking the moonlit temples of Luxor.',
  }),
  Object.freeze({
    id: 'exhibit_s10',
    season: 'Season 10',
    portalId: 'venice',
    title: 'S10 Venice Grand Masquerade',
    tagline: 'Phantom of the Gondola & Crimson Aria Diva',
    icon: '🎭',
    x: -14.8,
    z: 4.2,
    r: 2.3,
    bannerUrl: '/assets/museum/v1/banner_s10.jpg',
    maleSprite: '/assets/museum/v1/s10_phantom_m.png',
    femaleSprite: '/assets/museum/v1/s10_phantom_f.png',
    extraSprites: Object.freeze(['/assets/museum/v1/scene_venice_wide.jpg']),
    story:
      'Lantern-lit gondolas gliding down the Grand Canal — filigree masquerade masks, baroque lace, and midnight opera capes.',
  }),
  Object.freeze({
    id: 'exhibit_s11',
    season: 'Season 11',
    portalId: 'olympus',
    title: 'S11 Pantheon of Olympus',
    tagline: 'Thunderbolt Zeus & Golden Aegis Athena',
    icon: '⚡',
    x: -14.8,
    z: 9.8,
    r: 2.3,
    bannerUrl: '/assets/museum/v1/banner_s11.jpg',
    maleSprite: '/assets/museum/v1/s11_zeus_m.png',
    femaleSprite: '/assets/museum/v1/s11_athena_f.png',
    extraSprites: Object.freeze([
      '/assets/museum/v1/scene_olympus_wide.jpg',
      '/assets/museum/v1/scene_santorini_wide.jpg',
    ]),
    story:
      'The grand finale of NookAirline V1 Gacha — ascending above Santorini into Mount Olympus draped in divine white-and-gold chitons.',
  }),
  Object.freeze({
    id: 'exhibit_cats',
    season: 'Cat Lounge',
    portalId: 'cat_lounge',
    title: 'Cat Lounge & 27 Companion Cats',
    tagline: 'Captain Whiskers, Mochi, Sakura, Moon, Ragdoll & Maneki',
    icon: '🐾',
    x: 5.5,
    z: 12.2,
    r: 2.3,
    bannerUrl: '/assets/museum/v1/cat_lounge_bg.jpg',
    maleSprite: '/assets/museum/v1/cat_captain.png',
    femaleSprite: '/assets/museum/v1/cat_sakura.png',
    extraSprites: Object.freeze([
      '/assets/museum/v1/cat_mochi.png',
      '/assets/museum/v1/cat_ragdoll.png',
      '/assets/museum/v1/cat_moon.png',
      '/assets/museum/v1/cat_maneki.png',
      '/assets/museum/v1/kitty_machine.png',
      '/assets/museum/v1/couple_bunnies_premium.png',
    ]),
    story:
      'A tribute to the cozy Sky Cat Lounge where 27 adorable feline companions and the Kitty Claw Machine kept Nook & Neen company on every flight.',
  }),
]);

// ---------------------------------------------------------------------------
// 3. Zone 2 — All 16 Living 2.5D Scenery & Season Conceptual Portals (5-Row Village Grid Layout)
// ---------------------------------------------------------------------------
export const MUSEUM_SCENERY_PORTALS = Object.freeze([
  Object.freeze({
    id: 'fuji',
    season: 'Season 2',
    tier: 1,
    slotNum: 2,
    name: 'Kyoto Mount Fuji & Sakura Deck',
    shortLabel: '🗻 S2 Fuji & Kyoto',
    emoji: '🗻',
    title: '🗻 S2 Kyoto — Mount Fuji & Sakura Shrine Deck',
    subtitle: 'Walk the wooden temple engawa & stone terrace beneath cherry blossoms, Torii gates, and snow-capped Mount Fuji',
    memoryQuote:
      '“Remember watching cherry blossoms drift past our cabin window over Kyoto? Now we can walk the temple terrace hand-in-hand.”',
    icon: '🗻',
    v1Snap: '/assets/museum/v1/scene_kyoto_wide.jpg',
    x: 0,
    z: -13.4,
    yElev: 0,
    r: 2.2,
    skyTop: '#2e2452',
    skyMid: '#94628d',
    skyBot: '#f8b498',
  }),
  Object.freeze({
    id: 'paris',
    season: 'Season 3',
    tier: 1,
    slotNum: 3,
    name: 'Paris Eiffel Tower Promenade',
    shortLabel: '🗼 S3 Paris',
    emoji: '🗼',
    title: '🗼 Paris — Moonlit Eiffel Tower & Seine Promenade',
    subtitle: 'Stroll the cobblestone Seine quayside past the rose flower cart, bistro tables, and glowing Eiffel Tower',
    memoryQuote:
      '“Midnight by the River Seine — where every golden reflection on the water felt like a promise between BKK and DXB.”',
    icon: '🗼',
    v1Snap: '/assets/museum/v1/scene_paris_wide.jpg',
    x: -5.5,
    z: -13.4,
    yElev: 0,
    r: 2.2,
    skyTop: '#141a46',
    skyMid: '#2e387a',
    skyBot: '#7c629c',
  }),
  Object.freeze({
    id: 'swiss',
    season: 'Season 12',
    tier: 2,
    slotNum: 12,
    name: 'Swiss Alps Matterhorn Chalet',
    shortLabel: '🏔️ S12 Alps',
    emoji: '🏔️',
    title: '🏔️ Swiss Alps — Starry Matterhorn & Snow Chalet',
    subtitle: 'Crunch across fresh alpine snow between warm timber chalets under the Milky Way & Matterhorn',
    memoryQuote:
      '“Thousands of miles apart, yet warm inside the same snow-covered chalet beneath the Alpine stars.”',
    icon: '🏔️',
    v1Snap: '/assets/museum/v1/scene_swiss_wide.jpg',
    x: 12.5,
    z: -7.8,
    yElev: 0,
    r: 2.2,
    skyTop: '#0d1438',
    skyMid: '#312b74',
    skyBot: '#7a5c9e',
  }),
  Object.freeze({
    id: 'dubai',
    season: 'Valentine Special',
    tier: 3,
    slotNum: 13,
    name: 'Dubai Arabian Mirage Terrace',
    shortLabel: '🏜️ S3 Dubai',
    emoji: '🏜️',
    title: '🏜️ S3 Dubai — Starlit Arabian Terrace & Burj Khalifa',
    subtitle: 'Relax on Persian carpets beside the infinity pool overlooking golden dunes and the Burj Khalifa',
    memoryQuote:
      '“From Bangkok skies to Dubai nights — our home horizon where Nook & Neen’s flights always meet.”',
    icon: '🏜️',
    v1Snap: '/assets/museum/v1/scene_dubai_wide.jpg',
    x: 12.5,
    z: -1.8,
    yElev: 0,
    r: 2.2,
    skyTop: '#0b1636',
    skyMid: '#293258',
    skyBot: '#c67d47',
  }),
  Object.freeze({
    id: 'maldives',
    season: 'White Day Special',
    tier: 4,
    slotNum: 14,
    name: 'Maldives Overwater Lagoon',
    shortLabel: '🏝️ Maldives',
    emoji: '🏝️',
    title: '🏝️ Maldives — Sunset Overwater Bungalow Pier',
    subtitle: 'Walk the tiki-lit teak boardwalk over crystal turquoise lagoon water toward overwater villas',
    memoryQuote:
      '“Barefoot on a sunset boardwalk over turquoise water, where time slows down just for the two of us.”',
    icon: '🏝️',
    v1Snap: '/assets/museum/v1/scene_maldives_wide.jpg',
    x: 12.5,
    z: 4.2,
    yElev: 0,
    r: 2.2,
    skyTop: '#563882',
    skyMid: '#d66892',
    skyBot: '#ffcf7d',
  }),
  Object.freeze({
    id: 'cabin',
    season: 'Flight NA-001',
    tier: 5,
    slotNum: 16,
    name: 'First-Class Sky Cabin Suite',
    shortLabel: '✈️ Couple Penthouse',
    emoji: '✈️',
    title: '✈️ NookAirline — First-Class Sky Cabin & Warm Hug',
    subtitle: 'Step inside the original royal blue & gold First-Class cabin with leather suites and gourmet galley',
    memoryQuote:
      '“Flight NA-001 (BKK ⇄ DXB): Mango Sticky Rice, A5 Wagyu, and one warm cabin blanket at 36,000 feet.”',
    icon: '✈️',
    v1Snap: '/assets/museum/v1/plane_cabin_wide.png',
    x: 12.5,
    z: 9.8,
    yElev: 0,
    r: 2.2,
    skyTop: '#1c1428',
    skyMid: '#683c6c',
    skyBot: '#f0a67c',
  }),
  Object.freeze({
    id: 'bangkok',
    season: 'Season 1',
    tier: 1,
    slotNum: 1,
    name: 'S1 Bangkok Chao Phraya Naga Barge',
    shortLabel: '🐉 S1 Bangkok',
    emoji: '🐉',
    title: '🐉 S1 Bangkok — Chao Phraya Naga Barge & Temple Terrace',
    subtitle: 'Board the gilded Royal Naga River Barge past glowing riverside spires, floating lotus lanterns, and silk pavilions',
    memoryQuote:
      '“Where our story began under Bangkok’s golden riverside lights — cruising the Chao Phraya with floating lotus wishes.”',
    icon: '🐉',
    v1Snap: '/assets/museum/v1/banner_s1.jpg',
    x: -11.5,
    z: -13.4,
    yElev: 0,
    r: 2.2,
    skyTop: '#0d192b',
    skyMid: '#2a3459',
    skyBot: '#d9913b',
  }),
  Object.freeze({
    id: 'montecarlo',
    season: 'Season 4',
    tier: 1,
    slotNum: 4,
    name: 'S4 Monte Carlo Casino Royale Balcony',
    shortLabel: '🎰 S4 Monte Carlo',
    emoji: '🎰',
    title: '🎰 S4 Monte Carlo — Casino Royale & Harbor Balcony',
    subtitle: 'Sip vintage mocktails on a Carrara marble balcony with emerald velvet armchairs overlooking the Casino domes & yachts',
    memoryQuote:
      '“Dressed in crimson velvet and diamonds on the Monte Carlo terrace — every roll of the dice was already a jackpot with you.”',
    icon: '🎰',
    v1Snap: '/assets/museum/v1/scene_montecarlo_wide.jpg',
    x: 5.5,
    z: -13.4,
    yElev: 0,
    r: 2.2,
    skyTop: '#0c1633',
    skyMid: '#1f3566',
    skyBot: '#c99342',
  }),
  Object.freeze({
    id: 'atlantis',
    season: 'Season 5',
    tier: 1,
    slotNum: 5,
    name: 'S5 Abyssal Atlantis Coral Lounge',
    shortLabel: '🔱 S5 Atlantis',
    emoji: '🔱',
    title: '🔱 S5 Atlantis — Sunken Coral Lounge & Crystal Dome',
    subtitle: 'Relax in a curved turquoise velvet salon with pearl-lotus lamps beneath a panoramic underwater glass dome',
    memoryQuote:
      '“Deep beneath the ocean waves in our own silent crystal dome, watching glowing jellyfish drift past ancient marble temples.”',
    icon: '🔱',
    v1Snap: '/assets/museum/v1/scene_atlantis_wide.jpg',
    x: 11.5,
    z: -13.4,
    yElev: 0,
    r: 2.2,
    skyTop: '#041f38',
    skyMid: '#0b5c7a',
    skyBot: '#29d4c8',
  }),
  Object.freeze({
    id: 'starlight',
    season: 'Season 6',
    tier: 2,
    slotNum: 6,
    name: 'S6 Cosmic Starlight Observatory',
    shortLabel: '🌌 S6 Starlight',
    emoji: '🌌',
    title: '🌌 S6 Starlight — Astral Observatory & Nebula Dome',
    subtitle: 'Walk across an obsidian-and-gold zodiac astrolabe floor with midnight velvet sofas and brass telescopes under a spiral galaxy',
    memoryQuote:
      '“Even when we looked up at different night skies, every constellation was drawing a bridge between us.”',
    icon: '🌌',
    v1Snap: '/assets/museum/v1/scene_starlight_wide.jpg',
    x: 5.5,
    z: -7.8,
    yElev: 0,
    r: 2.2,
    skyTop: '#08071a',
    skyMid: '#261854',
    skyBot: '#7c4ab8',
  }),
  Object.freeze({
    id: 'fairytale',
    season: 'Season 7',
    tier: 2,
    slotNum: 7,
    name: 'S7 Enchanted Fairytale Lantern Balcony',
    shortLabel: '🌹 S7 Fairytale',
    emoji: '🌹',
    title: '🌹 S7 Fairytale — Floating Lantern Castle & Rose Balcony',
    subtitle: 'Stand beneath wisteria and climbing pink roses on a royal stone balcony watching hundreds of sky lanterns rise over the castle',
    memoryQuote:
      '“Like a page out of our own fairytale — watching a thousand warm sky lanterns float above the rose-garden castle.”',
    icon: '🌹',
    v1Snap: '/assets/museum/v1/scene_fairytale_wide.jpg',
    x: -6.2,
    z: -8.2,
    yElev: 0,
    r: 2.2,
    skyTop: '#1c1236',
    skyMid: '#59306b',
    skyBot: '#f5a65b',
  }),
  Object.freeze({
    id: 'permafrost',
    season: 'Season 8',
    tier: 2,
    slotNum: 8,
    name: 'S8 Sovereign of Permafrost Ice Palace',
    shortLabel: '❄️ S8 Permafrost',
    emoji: '❄️',
    title: '❄️ S8 Permafrost — Aurora Ice Palace & Glacial Throne',
    subtitle: 'Step onto an engraved snowflake crystal floor framed by gothic blue-ice arches, golden fire braziers, and the Aurora Borealis',
    memoryQuote:
      '“Inside a palace carved from glacier ice, yet warm beside golden fire braziers under the dancing northern lights.”',
    icon: '❄️',
    v1Snap: '/assets/museum/v1/scene_permafrost_wide.jpg',
    x: -12.5,
    z: -7.8,
    yElev: 0,
    r: 2.2,
    skyTop: '#061a2e',
    skyMid: '#135e6e',
    skyBot: '#5ce6b8',
  }),
  Object.freeze({
    id: 'luxor',
    season: 'Season 9',
    tier: 3,
    slotNum: 9,
    name: 'S9 Sands of Luxor Nile Sanctuary',
    shortLabel: '👑 S9 Luxor',
    emoji: '👑',
    title: '👑 S9 Luxor — Nile Sunset Sanctuary & Great Pyramids',
    subtitle: 'Lounge on a carved gold-silk Egyptian divan under brass filigree lanterns overlooking felucca sailboats and the Great Pyramids',
    memoryQuote:
      '“Golden sunset over the Nile and ancient sandstone arches — a timeless dynasty built for two.”',
    icon: '👑',
    v1Snap: '/assets/museum/v1/scene_luxor_wide.jpg',
    x: -12.5,
    z: -1.8,
    yElev: 0,
    r: 2.2,
    skyTop: '#381524',
    skyMid: '#9e3f2c',
    skyBot: '#f7ba52',
  }),
  Object.freeze({
    id: 'venice',
    season: 'Season 10',
    tier: 4,
    slotNum: 10,
    name: 'S10 Venice Grand Canal Masquerade',
    shortLabel: '🎭 S10 Venice',
    emoji: '🎭',
    title: '🎭 S10 Venice — Moonlit Grand Canal & Velvet Gondola',
    subtitle: 'Dine by candlelight in a tufted crimson velvet booth beside gothic marble arches and lantern-lit gondolas on the Grand Canal',
    memoryQuote:
      '“Drifting rose petals and candlelight along the Grand Canal — our midnight masquerade in Venice.”',
    icon: '🎭',
    v1Snap: '/assets/museum/v1/scene_venice_wide.jpg',
    x: -12.5,
    z: 4.2,
    yElev: 0,
    r: 2.2,
    skyTop: '#121838',
    skyMid: '#3a2b5c',
    skyBot: '#d97b6c',
  }),
  Object.freeze({
    id: 'olympus',
    season: 'Season 11',
    tier: 5,
    slotNum: 11,
    name: 'S11 Olympus Pantheon & Santorini',
    shortLabel: '⚡ S11 Olympus',
    emoji: '⚡',
    title: '⚡ S11 Olympus — Santorini & Golden Pantheon Terrace',
    subtitle: 'Ascend to a white-and-gold Corinthian temple terrace with Grecian chaise lounges, laurel braziers, and Santorini blue domes',
    memoryQuote:
      '“Above the golden clouds of Olympus and the blue domes of Santorini — where every flight becomes eternal.”',
    icon: '⚡',
    v1Snap: '/assets/museum/v1/scene_olympus_wide.jpg',
    x: -12.5,
    z: 9.8,
    yElev: 0,
    r: 2.2,
    skyTop: '#1e3c78',
    skyMid: '#688cd4',
    skyBot: '#ffe08c',
  }),
  Object.freeze({
    id: 'cat_lounge',
    season: 'Cat Lounge',
    tier: 5,
    slotNum: 15,
    name: 'Purrst-Class Sky Cat Lounge',
    shortLabel: '🐾 Cat Lounge',
    emoji: '🐾',
    title: '🐾 Purrst-Class — Sky Cat Lounge & Kitty Claw Suite',
    subtitle: 'Cuddle with Mochi, Ragdoll, Captain Whiskers & Sakura on the paw-print rug beside the cat tree and Kitty Claw Machine',
    memoryQuote:
      '“Our favorite cabin detour at 36,000 feet — surrounded by purring kittens, pink clouds, and the Kitty Claw Machine.”',
    icon: '🐾',
    v1Snap: '/assets/museum/v1/cat_lounge_bg.jpg',
    x: 5.5,
    z: 9.8,
    yElev: 0,
    r: 2.2,
    skyTop: '#543864',
    skyMid: '#c46c98',
    skyBot: '#ffd0b8',
  }),
]);

export const NOOK_MUSEUM = Object.freeze({
  ID: 'nook_museum',
  SIZE: 36,
  HALF: 18,
  TRIGGER_R: 2.4,
  TIMELINE: MUSEUM_TIMELINE_CHAPTERS,
  EXHIBITS: MUSEUM_GACHA_EXHIBITS,
  PORTALS: MUSEUM_SCENERY_PORTALS,
});

export function getNookMuseumConfig() {
  return NOOK_MUSEUM;
}

// ---------------------------------------------------------------------------
// Shared Texture & 2.5D Billboard Helpers (Safe in headless Node & Browser)
// ---------------------------------------------------------------------------
const texCache = new Map();
const sharedLoader = new THREE.TextureLoader();

function createProceduralPropFallbackTexture(url) {
  if (typeof document === 'undefined') return null;
  const key = `__fallback_${url}`;
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext?.('2d');
  if (!ctx) return null;

  if (url.includes('fuji_mountain_horizon')) {
    // Majestic snow-capped Mount Fuji cone
    const skyGrd = ctx.createLinearGradient(0, 40, 0, 250);
    skyGrd.addColorStop(0, '#725688');
    skyGrd.addColorStop(1, '#c693a8');
    ctx.beginPath();
    ctx.moveTo(8, 248);
    ctx.quadraticCurveTo(82, 195, 108, 72);
    ctx.lineTo(148, 72);
    ctx.quadraticCurveTo(174, 195, 248, 248);
    ctx.closePath();
    ctx.fillStyle = skyGrd;
    ctx.fill();
    ctx.strokeStyle = '#3b2439';
    ctx.lineWidth = 4;
    ctx.stroke();
    // Snow cap
    ctx.beginPath();
    ctx.moveTo(108, 72);
    ctx.lineTo(148, 72);
    ctx.lineTo(166, 132);
    ctx.lineTo(146, 118);
    ctx.lineTo(132, 140);
    ctx.lineTo(120, 118);
    ctx.lineTo(106, 134);
    ctx.lineTo(90, 128);
    ctx.closePath();
    ctx.fillStyle = '#fff9fc';
    ctx.fill();
  } else if (url.includes('fuji_torii_gate_red')) {
    ctx.fillStyle = '#342428';
    ctx.fillRect(36, 18, 184, 16);
    ctx.fillStyle = '#d8432e';
    ctx.fillRect(42, 32, 172, 16);
    ctx.fillRect(48, 66, 160, 14);
    ctx.fillRect(62, 32, 22, 210);
    ctx.fillRect(172, 32, 22, 210);
    ctx.fillStyle = '#3b2d2b';
    ctx.fillRect(58, 212, 30, 34);
    ctx.fillRect(168, 212, 30, 34);
  } else if (url.includes('fuji_stone_lantern_toro')) {
    ctx.fillStyle = '#9c8f88';
    ctx.fillRect(88, 190, 80, 48);
    ctx.fillRect(104, 130, 48, 62);
    ctx.fillStyle = '#ffebb3';
    ctx.fillRect(98, 86, 60, 44);
    ctx.fillStyle = '#7d706a';
    ctx.beginPath();
    ctx.moveTo(74, 88);
    ctx.lineTo(128, 46);
    ctx.lineTo(182, 88);
    ctx.closePath();
    ctx.fill();
  } else {
    const grd = ctx.createRadialGradient(128, 128, 16, 128, 128, 112);
    grd.addColorStop(0, 'rgba(255, 232, 164, 0.92)');
    grd.addColorStop(1, 'rgba(255, 214, 120, 0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 256, 256);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, tex);
  return tex;
}

const texReady = new Set();
const texWaiters = new Map();

function loadBillboardTexture(url, onUpdate, { repeat = false } = {}) {
  if (!url) return null;
  const key = repeat ? `${url}__rep` : url;
  if (texReady.has(key) && texCache.has(key)) {
    const cached = texCache.get(key);
    if (onUpdate) onUpdate(cached);
    return cached;
  }
  if (texWaiters.has(key)) {
    if (onUpdate) texWaiters.get(key).push(onUpdate);
    return texCache.get(key) || null;
  }
  if (typeof document === 'undefined') {
    const fb = createProceduralPropFallbackTexture(url);
    if (fb) {
      texReady.add(key);
      if (onUpdate) onUpdate(fb);
    }
    return fb;
  }
  const waiters = onUpdate ? [onUpdate] : [];
  texWaiters.set(key, waiters);
  try {
    const tex = sharedLoader.load(
      url,
      (loaded) => {
        loaded.colorSpace = THREE.SRGBColorSpace;
        if (repeat) {
          loaded.wrapS = THREE.RepeatWrapping;
          loaded.wrapT = THREE.RepeatWrapping;
        }
        loaded.needsUpdate = true;
        texCache.set(key, loaded);
        texReady.add(key);
        const list = texWaiters.get(key) || [];
        texWaiters.delete(key);
        for (const fn of list) fn(loaded);
      },
      undefined,
      () => {
        const fb = createProceduralPropFallbackTexture(url);
        if (fb) {
          texCache.set(key, fb);
          texReady.add(key);
        }
        const list = texWaiters.get(key) || [];
        texWaiters.delete(key);
        if (fb) {
          for (const fn of list) fn(fb);
        }
      }
    );
    tex.colorSpace = THREE.SRGBColorSpace;
    if (repeat) {
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
    }
    texCache.set(key, tex);
    return tex;
  } catch {
    texWaiters.delete(key);
    return createProceduralPropFallbackTexture(url);
  }
}

const VILLAGE_PITCH_RAD = -THREE.MathUtils.degToRad(36);

function makeBillboardPlane(
  url,
  w,
  h,
  {
    x = 0,
    y = 0,
    z = 0,
    worldZ = null,
    pitch = VILLAGE_PITCH_RAD,
    renderOrder = null,
    name = '',
    mirror = false,
    opacity = 1,
    tint = 0xffffff,
    anchorBottom = true,
    alphaTest = 0.42,
    depthWrite = null,
    lean = true,
  } = {}
) {
  const geo = new THREE.PlaneGeometry(w, h);
  if (anchorBottom) {
    geo.translate(0, h / 2, 0);
  }
  const isReady = Boolean(url && texReady.has(url));
  const useDepthWrite = depthWrite !== null ? depthWrite : opacity >= 0.95;
  const mat = new THREE.MeshBasicMaterial({
    map: isReady ? texCache.get(url) : null,
    color: tint,
    transparent: true,
    opacity: isReady || typeof document === 'undefined' ? opacity : 0,
    alphaTest,
    depthWrite: useDepthWrite,
    side: THREE.DoubleSide,
  });
  loadBillboardTexture(url, (tex) => {
    mat.map = tex;
    mat.opacity = opacity;
    mat.needsUpdate = true;
  });
  const mesh = new THREE.Mesh(geo, mat);
  if (name) mesh.name = name;
  if (mirror) mesh.scale.x = -1;
  mesh.position.set(x, y, z);
  mesh.rotation.x = pitch;
  mesh.renderOrder = renderOrder !== null ? renderOrder : 0;
  mesh.userData.lean = lean;
  mesh.userData.worldZ = worldZ !== null ? worldZ : z;
  mesh.userData.assetUrl = url;
  return mesh;
}

function makeFloorDecal(
  url,
  w,
  d,
  {
    x = 0,
    y = 0.02,
    z = 0,
    rotY = 0,
    opacity = 0.98,
    renderOrder = 3,
    factor = -2,
    name = '',
    color = 0xffffff,
    additive = false,
  } = {}
) {
  const geo = new THREE.PlaneGeometry(w, d);
  geo.rotateX(-Math.PI / 2);
  if (rotY) geo.rotateY(rotY);
  const isReady = Boolean(!url || texReady.has(url));
  const mat = new THREE.MeshBasicMaterial({
    map: isReady && url ? texCache.get(url) : null,
    color,
    transparent: true,
    opacity: isReady || typeof document === 'undefined' ? opacity : 0,
    alphaTest: additive ? 0.01 : 0.03,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    polygonOffset: true,
    polygonOffsetFactor: factor,
    polygonOffsetUnits: factor,
  });
  if (url) {
    loadBillboardTexture(url, (tex) => {
      mat.map = tex;
      mat.opacity = opacity;
      mat.needsUpdate = true;
    });
  }
  const mesh = new THREE.Mesh(geo, mat);
  if (name) mesh.name = name;
  mesh.position.set(x, y, z);
  mesh.renderOrder = renderOrder;
  mesh.userData.isFloorDecal = true;
  mesh.userData.assetUrl = url;
  return mesh;
}

function makeGlowSprite(size = 1.8, colorHex = '#ffe28a', opacity = 0.72, worldZ = 0) {
  let tex = texCache.get(`__museum_glow_${colorHex}`);
  if (!tex && typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const ctx = c.getContext?.('2d');
    if (ctx) {
      const grd = ctx.createRadialGradient(64, 64, 4, 64, 64, 60);
      grd.addColorStop(0, '#ffffff');
      grd.addColorStop(0.38, colorHex);
      grd.addColorStop(1, 'rgba(255, 210, 120, 0)');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, 128, 128);
      tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      texCache.set(`__museum_glow_${colorHex}`, tex);
    }
  }
  const mat = new THREE.SpriteMaterial({
    map: tex || null,
    color: 0xffe89e,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(size, size, 1);
  sprite.renderOrder = 12;
  sprite.userData.isGlow = true;
  sprite.userData.worldZ = worldZ;
  return sprite;
}

function makeTextSprite(
  text,
  {
    subText = '',
    color = '#fffdf7',
    subColor = '#ffe7a3',
    stroke = '#2b1911',
    scaleW = 3.1,
    scaleH = 0.72,
  } = {}
) {
  let tex = null;
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = 560;
    c.height = 132;
    const ctx = c.getContext?.('2d');
    if (ctx) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.miterLimit = 2;

      if (subText) {
        ctx.font = '800 19px "Fredoka", "Comfortaa", -apple-system, sans-serif';
        const subW = Math.min(520, Math.max(200, ctx.measureText(subText).width + 44));
        const pillX = 280 - subW / 2;
        ctx.fillStyle = 'rgba(34, 20, 14, 0.86)';
        ctx.strokeStyle = '#f0c465';
        ctx.lineWidth = 3;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(pillX, 72, subW, 40, 20);
        else ctx.rect(pillX, 72, subW, 40);
        ctx.fill();
        ctx.stroke();

        ctx.font = '900 28px "Fredoka", "Comfortaa", -apple-system, sans-serif';
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 8;
        ctx.strokeText(text, 280, 40);
        ctx.fillStyle = color;
        ctx.fillText(text, 280, 40);

        ctx.font = '800 19px "Fredoka", "Comfortaa", -apple-system, sans-serif';
        ctx.fillStyle = subColor;
        ctx.fillText(subText, 280, 92);
      } else {
        ctx.font = '900 29px "Fredoka", "Comfortaa", -apple-system, sans-serif';
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 8;
        ctx.strokeText(text, 280, 66);
        ctx.fillStyle = color;
        ctx.fillText(text, 280, 66);
      }
      tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
    }
  }
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthTest: true,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(scaleW, scaleH, 1);
  sprite.renderOrder = 25;
  return sprite;
}

// ---------------------------------------------------------------------------
// Village-Style Sky Gradient, Merged Grid Cells & Parchment Nameplate Pills
// ---------------------------------------------------------------------------
let cachedMuseumSkyTex = null;
function buildMuseumSkyTexture() {
  if (cachedMuseumSkyTex) return cachedMuseumSkyTex;
  if (typeof document === 'undefined') {
    return new THREE.Color(0xffc78f);
  }
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 256;
  const g = c.getContext?.('2d');
  if (!g) return new THREE.Color(0xffc78f);
  const grd = g.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, '#ff9a6b');
  grd.addColorStop(0.55, '#ffc78f');
  grd.addColorStop(1, '#ffe7c2');
  g.fillStyle = grd;
  g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  cachedMuseumSkyTex = t;
  return t;
}

/** Merged quad geometry for a list of 1m × 1m grid cells (`gx = 0..S-1, gy = 0..S-1`). */
function museumCellsGeometry(cells, y, uvScale = 0.5, S = 36) {
  const pos = [];
  const uv = [];
  const idx = [];
  const ox = -S / 2;
  const oz = -S / 2;
  cells.forEach(([gx, gy], i) => {
    const x0 = ox + gx;
    const z0 = oz + gy;
    pos.push(x0, y, z0, x0 + 1, y, z0, x0 + 1, y, z0 + 1, x0, y, z0 + 1);
    uv.push(
      x0 * uvScale,
      -z0 * uvScale,
      (x0 + 1) * uvScale,
      -z0 * uvScale,
      (x0 + 1) * uvScale,
      -(z0 + 1) * uvScale,
      x0 * uvScale,
      -(z0 + 1) * uvScale
    );
    const b = i * 4;
    idx.push(b, b + 2, b + 1, b, b + 3, b + 2);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uv), 2));
  g.setIndex(idx);
  return g;
}

function mergeStaticGeometries(geos) {
  const out = new THREE.BufferGeometry();
  const pos = [];
  const norm = [];
  const uv = [];
  const idx = [];
  let vOff = 0;
  for (const g of geos) {
    const p = g.attributes.position.array;
    const n = g.attributes.normal?.array;
    const u = g.attributes.uv?.array;
    const ix = g.index.array;
    for (let i = 0; i < p.length; i++) pos.push(p[i]);
    if (n) for (let i = 0; i < n.length; i++) norm.push(n[i]);
    if (u) for (let i = 0; i < u.length; i++) uv.push(u[i]);
    for (let i = 0; i < ix.length; i++) idx.push(ix[i] + vOff);
    vOff += g.attributes.position.count;
    g.dispose();
  }
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (norm.length) out.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
  if (uv.length) out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  out.setIndex(idx);
  return out;
}

function makePortalPlaqueSprite(label, { scaleW = 1.55, scaleH = 0.34 } = {}) {
  let tex = null;
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = 380;
    c.height = 80;
    const ctx = c.getContext?.('2d');
    if (ctx) {
      ctx.fillStyle = 'rgba(255, 249, 238, 0.96)';
      ctx.strokeStyle = '#3a2415';
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(10, 10, 360, 60, 30);
      else ctx.rect(10, 10, 360, 60);
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = '#e6b450';
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(15, 15, 350, 50, 25);
      else ctx.rect(15, 15, 350, 50);
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '900 26px "Fredoka", "Comfortaa", -apple-system, sans-serif';
      ctx.fillStyle = '#3a2415';
      ctx.fillText(label, 190, 41);
      tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
    }
  }
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthTest: true,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(scaleW, scaleH, 1);
  sprite.renderOrder = 15;
  return sprite;
}

/**
 * Bespoke Art-Director Floor Palette, Material Motif & Architectural Grid Archetype
 * for all 16 Living Scenery Portal Memory Worlds.
 */
export const PORTAL_FLOOR_ART_DIRECTION = Object.freeze({
  fuji: Object.freeze({
    id: 'fuji',
    pattern: 'shrine_courtyard',
    groundUrl: '/assets/terrain/ground_sakura.png',
    groundColor: 0xf2cad8,
    cobbleColor: 0x8c8694,
    creamColor: 0xc8925a,
    sakuraColor: 0xf6bfd4,
    waterColor: 0x3ba8b5,
    bridgeColor: 0xc93b2b,
    curbColor: 0x645862,
    bridgeCurbColor: 0xd93829,
    bankColor: 0x5b6068,
    cliffRimColor: 0xd888a8,
    cliffWallColor: 0x7c6e78,
    indoor: false,
    hasGrassTufts: true,
    hasCanalFlora: true,
  }),
  paris: Object.freeze({
    id: 'paris',
    pattern: 'rond_point_parterre',
    groundUrl: '/assets/terrain/ground_classic.png',
    groundColor: 0x829c68,
    cobbleColor: 0x949eb4,
    creamColor: 0xf2e4ce,
    sakuraColor: 0xe0a4c0,
    waterColor: 0x2e5c90,
    bridgeColor: 0xe6c268,
    curbColor: 0xd8ccb8,
    bridgeCurbColor: 0xf4d47c,
    bankColor: 0x788296,
    cliffRimColor: 0x76985e,
    cliffWallColor: 0xb8ae9e,
    indoor: false,
    hasGrassTufts: true,
    hasCanalFlora: false,
  }),
  swiss: Object.freeze({
    id: 'swiss',
    pattern: 'alpine_snow_chalet',
    groundUrl: '/assets/terrain/ground_aurora.png',
    groundColor: 0xe8f4ff,
    cobbleColor: 0x7a8ba0,
    creamColor: 0xb47844,
    sakuraColor: 0xcc4444,
    waterColor: 0x74daf8,
    bridgeColor: 0x9c6234,
    curbColor: 0xdcecf8,
    bridgeCurbColor: 0x7c4a24,
    bankColor: 0x9ab4cc,
    cliffRimColor: 0xeaf6ff,
    cliffWallColor: 0x8c9cb0,
    indoor: false,
    hasGrassTufts: false,
    hasCanalFlora: false,
  }),
  dubai: Object.freeze({
    id: 'dubai',
    pattern: 'arabian_zellige_star',
    groundUrl: '/assets/terrain/ground_vanilla.png',
    groundColor: 0xecc47e,
    cobbleColor: 0xe0a430,
    creamColor: 0xfbf0d6,
    sakuraColor: 0xb82e56,
    waterColor: 0x1cd2e0,
    bridgeColor: 0xf4d078,
    curbColor: 0xe8be68,
    bridgeCurbColor: 0xf2c85b,
    bankColor: 0xc89648,
    cliffRimColor: 0xe6be74,
    cliffWallColor: 0xc48c46,
    indoor: false,
    hasGrassTufts: false,
    hasCanalFlora: false,
  }),
  maldives: Object.freeze({
    id: 'maldives',
    pattern: 'overwater_boardwalk_atoll',
    groundUrl: '/assets/terrain/ground_vanilla.png',
    groundColor: 0x1ebec8,
    cobbleColor: 0xcca06c,
    creamColor: 0xfff6e4,
    sakuraColor: 0xf6987e,
    waterColor: 0x24d8de,
    bridgeColor: 0xdab07c,
    curbColor: 0xe4c290,
    bridgeCurbColor: 0xe8c896,
    bankColor: 0xf2e2c4,
    cliffRimColor: 0xfaf0d8,
    cliffWallColor: 0x2898a8,
    indoor: false,
    hasGrassTufts: false,
    hasCanalFlora: false,
  }),
  cabin: Object.freeze({
    id: 'cabin',
    pattern: 'first_class_fuselage_aisle',
    groundUrl: '/assets/terrain/ground_aurora.png',
    groundColor: 0x283252,
    cobbleColor: 0x2e3c66,
    creamColor: 0xe8d4b8,
    sakuraColor: 0xa63850,
    waterColor: 0x1e2844,
    bridgeColor: 0xc89e52,
    curbColor: 0xe4b858,
    bridgeCurbColor: 0xe4b858,
    bankColor: 0x3a4668,
    cliffRimColor: 0x344064,
    cliffWallColor: 0x1c243c,
    indoor: true,
    hasGrassTufts: false,
    hasCanalFlora: false,
  }),
  bangkok: Object.freeze({
    id: 'bangkok',
    pattern: 'thai_mandapa_star',
    groundUrl: '/assets/terrain/ground_vanilla.png',
    groundColor: 0x5e7844,
    cobbleColor: 0xb47642,
    creamColor: 0xf8e4b4,
    sakuraColor: 0xd44a3e,
    waterColor: 0x287688,
    bridgeColor: 0xe2a838,
    curbColor: 0xd8a648,
    bridgeCurbColor: 0xf0be4c,
    bankColor: 0x7c5838,
    cliffRimColor: 0x688848,
    cliffWallColor: 0x9c6442,
    indoor: false,
    hasGrassTufts: true,
    hasCanalFlora: true,
  }),
  montecarlo: Object.freeze({
    id: 'montecarlo',
    pattern: 'casino_royale_octagon',
    groundUrl: '/assets/terrain/ground_classic.png',
    groundColor: 0x3a6852,
    cobbleColor: 0x3c3848,
    creamColor: 0xfaf0d8,
    sakuraColor: 0xb82838,
    waterColor: 0x1e689e,
    bridgeColor: 0xe8c878,
    curbColor: 0xd8b458,
    bridgeCurbColor: 0xf2d278,
    bankColor: 0x6c7484,
    cliffRimColor: 0x48785e,
    cliffWallColor: 0x988e82,
    indoor: false,
    hasGrassTufts: false,
    hasCanalFlora: false,
  }),
  atlantis: Object.freeze({
    id: 'atlantis',
    pattern: 'sunken_concentric_citadel',
    groundUrl: '/assets/terrain/ground_aurora.png',
    groundColor: 0x1c5c78,
    cobbleColor: 0x3898b4,
    creamColor: 0xbef4fa,
    sakuraColor: 0xdc74b8,
    waterColor: 0x14c8ec,
    bridgeColor: 0x58dce8,
    curbColor: 0x46d2e4,
    bridgeCurbColor: 0x72f0fa,
    bankColor: 0x1c6882,
    cliffRimColor: 0x227894,
    cliffWallColor: 0x123e54,
    indoor: false,
    hasGrassTufts: false,
    hasCanalFlora: false,
  }),
  starlight: Object.freeze({
    id: 'starlight',
    pattern: 'cosmic_astrolabe_rings',
    groundUrl: '/assets/terrain/ground_aurora.png',
    groundColor: 0x28204c,
    cobbleColor: 0x3c3268,
    creamColor: 0xebe4ff,
    sakuraColor: 0xa664f0,
    waterColor: 0x5246d4,
    bridgeColor: 0xd8c4ff,
    curbColor: 0xc8a8ff,
    bridgeCurbColor: 0xe6c878,
    bankColor: 0x342864,
    cliffRimColor: 0x46387c,
    cliffWallColor: 0x1e163a,
    indoor: false,
    hasGrassTufts: false,
    hasCanalFlora: false,
  }),
  fairytale: Object.freeze({
    id: 'fairytale',
    pattern: 'enchanted_heart_ballroom',
    groundUrl: '/assets/terrain/ground_sakura.png',
    groundColor: 0xa8d898,
    cobbleColor: 0xcbb4e2,
    creamColor: 0xfff0f6,
    sakuraColor: 0xf8a4c8,
    waterColor: 0x58c2f0,
    bridgeColor: 0xf8d274,
    curbColor: 0xf4d6e8,
    bridgeCurbColor: 0xffe088,
    bankColor: 0xb89ec8,
    cliffRimColor: 0x98cc88,
    cliffWallColor: 0xd8b8c8,
    indoor: false,
    hasGrassTufts: true,
    hasCanalFlora: true,
  }),
  permafrost: Object.freeze({
    id: 'permafrost',
    pattern: 'glacial_snowflake_cathedral',
    groundUrl: '/assets/terrain/ground_aurora.png',
    groundColor: 0xa8e6ff,
    cobbleColor: 0x64c0e8,
    creamColor: 0xeefbff,
    sakuraColor: 0x68e8dc,
    waterColor: 0x2898d8,
    bridgeColor: 0xc4f2ff,
    curbColor: 0xa8eeff,
    bridgeCurbColor: 0xd8f8ff,
    bankColor: 0x72bce0,
    cliffRimColor: 0xb8f0ff,
    cliffWallColor: 0x82c4e4,
    indoor: false,
    hasGrassTufts: false,
    hasCanalFlora: false,
  }),
  luxor: Object.freeze({
    id: 'luxor',
    pattern: 'pharaonic_nile_temple',
    groundUrl: '/assets/terrain/ground_vanilla.png',
    groundColor: 0xe0a85c,
    cobbleColor: 0xcc9854,
    creamColor: 0xfae4b4,
    sakuraColor: 0x2aa8a8,
    waterColor: 0x26828c,
    bridgeColor: 0xe4b448,
    curbColor: 0xd49e48,
    bridgeCurbColor: 0xebb844,
    bankColor: 0xa8783c,
    cliffRimColor: 0xd89e52,
    cliffWallColor: 0xb47838,
    indoor: false,
    hasGrassTufts: false,
    hasCanalFlora: true,
  }),
  venice: Object.freeze({
    id: 'venice',
    pattern: 'grand_canal_piazza',
    groundUrl: '/assets/terrain/ground_classic.png',
    groundColor: 0x246e78,
    cobbleColor: 0xe6b8a2,
    creamColor: 0xfff6ec,
    sakuraColor: 0xa82e46,
    waterColor: 0x1e828c,
    bridgeColor: 0xf4ece0,
    curbColor: 0xefe4d4,
    bridgeCurbColor: 0xfaf2e6,
    bankColor: 0x9c8878,
    cliffRimColor: 0xdccab8,
    cliffWallColor: 0xa86858,
    indoor: false,
    hasGrassTufts: false,
    hasCanalFlora: false,
  }),
  olympus: Object.freeze({
    id: 'olympus',
    pattern: 'pantheon_rotunda_meander',
    groundUrl: '/assets/terrain/ground_classic.png',
    groundColor: 0xe8f0d0,
    cobbleColor: 0xeef4fc,
    creamColor: 0xfffdf4,
    sakuraColor: 0x2468c8,
    waterColor: 0x289ce0,
    bridgeColor: 0xfcf8ec,
    curbColor: 0xe8d088,
    bridgeCurbColor: 0xf4dc84,
    bankColor: 0xc8d8ec,
    cliffRimColor: 0xd8e4b8,
    cliffWallColor: 0xe2dcd0,
    indoor: false,
    hasGrassTufts: true,
    hasCanalFlora: false,
  }),
  cat_lounge: Object.freeze({
    id: 'cat_lounge',
    pattern: 'purrst_paw_parquet',
    groundUrl: '/assets/terrain/ground_sakura.png',
    groundColor: 0xfbe0ec,
    cobbleColor: 0xdba870,
    creamColor: 0xfff4e6,
    sakuraColor: 0xf8a8cc,
    waterColor: 0xf4c8dc,
    bridgeColor: 0xe8b882,
    curbColor: 0xf2bfd8,
    bridgeCurbColor: 0xf2bfd8,
    bankColor: 0xd89cb8,
    cliffRimColor: 0xf6cce0,
    cliffWallColor: 0xc88ea8,
    indoor: true,
    hasGrassTufts: false,
    hasCanalFlora: false,
  }),
});

export function getPortalFloorArtDirection(portalId) {
  return PORTAL_FLOOR_ART_DIRECTION[portalId] || PORTAL_FLOOR_ART_DIRECTION.fuji;
}

function getPortalGroundTheme(portalId) {
  const spec = getPortalFloorArtDirection(portalId);
  return {
    url: spec.groundUrl,
    color: spec.groundColor,
    indoor: spec.indoor,
  };
}

function hexIntToCss(hexInt) {
  return `#${Number(hexInt || 0).toString(16).padStart(6, '0')}`;
}

function shadeHexInt(hexInt, delta) {
  const r = Math.max(0, Math.min(255, ((hexInt >> 16) & 0xff) + delta));
  const g = Math.max(0, Math.min(255, ((hexInt >> 8) & 0xff) + delta));
  const b = Math.max(0, Math.min(255, (hexInt & 0xff) + delta));
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Paints the bespoke 256×256 repeatable architectural tile surface for `(portalId, tileType)`
 * and subtly blends the organic `/assets/terrain/` texture grain at ~26% without washing out
 * the world's custom color palette.
 */
function paintPortalTilePattern(ctx, W, H, portalId, tileType, artSpec, baseImg) {
  const colorMap = {
    ground: artSpec.groundColor,
    cobble: artSpec.cobbleColor,
    cream: artSpec.creamColor,
    sakura: artSpec.sakuraColor,
    bridge: artSpec.bridgeColor,
    water: artSpec.waterColor,
  };
  const baseHex = colorMap[tileType] ?? artSpec.cobbleColor;
  ctx.save();
  ctx.fillStyle = hexIntToCss(baseHex);
  ctx.fillRect(0, 0, W, H);

  if (baseImg) {
    ctx.save();
    ctx.globalAlpha = tileType === 'water' ? 0.32 : 0.26;
    ctx.globalCompositeOperation = 'luminosity';
    try {
      ctx.drawImage(baseImg, 0, 0, W, H);
    } catch {
      // Ignore incomplete image draw in non-DOM environments
    }
    ctx.restore();
  }

  const darkStroke = shadeHexInt(baseHex, -34);
  const midStroke = shadeHexInt(baseHex, -18);
  const lightStroke = shadeHexInt(baseHex, 28);

  if (tileType === 'water') {
    // Shimmering water caustics & ripples tailored to each world's water hue
    ctx.strokeStyle = lightStroke;
    ctx.lineWidth = 2.2;
    ctx.globalAlpha = 0.42;
    for (let ry = 24; ry < H; ry += 48) {
      ctx.beginPath();
      for (let rx = 0; rx <= W; rx += 16) {
        const wy = ry + Math.sin((rx / W) * Math.PI * 4 + ry * 0.1) * 6;
        if (rx === 0) ctx.moveTo(rx, wy);
        else ctx.lineTo(rx, wy);
      }
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  // Wood plank decks: Fuji cream (Hinoki), Swiss cream/bridge (Cedar), Bangkok cobble (Teak),
  // Maldives cobble/bridge (Sun-bleached Teak), Cabin cream (Burled Walnut)
  const isWoodPlank =
    (portalId === 'fuji' && (tileType === 'cream' || tileType === 'bridge')) ||
    (portalId === 'swiss' && (tileType === 'cream' || tileType === 'bridge')) ||
    (portalId === 'bangkok' && tileType === 'cobble') ||
    (portalId === 'maldives' && (tileType === 'cobble' || tileType === 'bridge')) ||
    (portalId === 'cabin' && tileType === 'cream');

  if (isWoodPlank) {
    const plankH = 32;
    for (let y = 0; y < H; y += plankH) {
      const row = Math.floor(y / plankH);
      ctx.fillStyle = shadeHexInt(baseHex, (row % 3 - 1) * 8);
      ctx.fillRect(0, y, W, plankH);
      ctx.strokeStyle = darkStroke;
      ctx.lineWidth = 2;
      ctx.strokeRect(0, y, W, plankH);
      ctx.strokeStyle = lightStroke;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y + 2);
      ctx.lineTo(W, y + 2);
      ctx.stroke();
      const jointX = ((row * 96) % W) + 32;
      ctx.strokeStyle = darkStroke;
      ctx.beginPath();
      ctx.moveTo(jointX, y);
      ctx.lineTo(jointX, y + plankH);
      ctx.stroke();
      // Dowel studs
      ctx.fillStyle = portalId === 'fuji' && tileType === 'bridge' ? '#f6d268' : darkStroke;
      ctx.beginPath();
      ctx.arc(jointX - 6, y + 8, 2.2, 0, Math.PI * 2);
      ctx.arc(jointX - 6, y + plankH - 8, 2.2, 0, Math.PI * 2);
      ctx.arc(jointX + 6, y + 8, 2.2, 0, Math.PI * 2);
      ctx.arc(jointX + 6, y + plankH - 8, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    return;
  }

  if (portalId === 'montecarlo' && tileType === 'cobble') {
    // Black-and-Ivory Casino Royale Checkerboard Marble with fine gold veining
    const step = 64;
    for (let gy = 0; gy < H; gy += step) {
      for (let gx = 0; gx < W; gx += step) {
        const isIvory = ((gx / step + gy / step) & 1) === 1;
        ctx.fillStyle = isIvory ? '#f4ecdc' : '#3c3848';
        ctx.fillRect(gx, gy, step, step);
        ctx.strokeStyle = '#d8b458';
        ctx.lineWidth = 2;
        ctx.strokeRect(gx + 1, gy + 1, step - 2, step - 2);
      }
    }
    ctx.restore();
    return;
  }

  if ((portalId === 'montecarlo' || portalId === 'cabin') && (tileType === 'sakura' || tileType === 'cobble')) {
    // Quilted Royal Carpet with Gold Bullion Piping & Diamond Tufting
    ctx.strokeStyle = '#e8c464';
    ctx.lineWidth = 2.5;
    for (let d = -W; d < W * 2; d += 48) {
      ctx.beginPath();
      ctx.moveTo(d, 0);
      ctx.lineTo(d + H, H);
      ctx.moveTo(d + H, 0);
      ctx.lineTo(d, H);
      ctx.stroke();
    }
    ctx.strokeStyle = '#f8dc84';
    ctx.lineWidth = 4;
    ctx.strokeRect(6, 6, W - 12, H - 12);
    ctx.restore();
    return;
  }

  if (portalId === 'venice' && tileType === 'cobble') {
    // Piazza San Marco Terracotta-Rose & White Istrian Diamond Pavers
    const step = 64;
    for (let gy = 0; gy < H; gy += step) {
      for (let gx = 0; gx < W; gx += step) {
        ctx.fillStyle = '#e6b8a2';
        ctx.fillRect(gx, gy, step, step);
        ctx.strokeStyle = '#fff6ec';
        ctx.lineWidth = 5;
        ctx.strokeRect(gx + 3, gy + 3, step - 6, step - 6);
        ctx.fillStyle = '#fff6ec';
        ctx.beginPath();
        ctx.moveTo(gx + step / 2, gy + 14);
        ctx.lineTo(gx + step - 14, gy + step / 2);
        ctx.lineTo(gx + step / 2, gy + step - 14);
        ctx.lineTo(gx + 14, gy + step / 2);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
    return;
  }

  if (portalId === 'olympus') {
    // Santorini Whitewashed Stone with Cobalt-Blue Joints or Golden Greek Meander
    const step = 64;
    for (let gy = 0; gy < H; gy += step) {
      for (let gx = 0; gx < W; gx += step) {
        ctx.strokeStyle = tileType === 'cobble' ? '#2468c8' : '#e4bc54';
        ctx.lineWidth = tileType === 'cobble' ? 4 : 3;
        ctx.strokeRect(gx + 2, gy + 2, step - 4, step - 4);
        if (tileType === 'sakura' || tileType === 'cream') {
          ctx.strokeStyle = tileType === 'sakura' ? '#ffe082' : '#2468c8';
          ctx.lineWidth = 2;
          ctx.strokeRect(gx + 10, gy + 10, step - 20, step - 20);
        }
      }
    }
    ctx.restore();
    return;
  }

  if (portalId === 'dubai' || portalId === 'luxor' || portalId === 'bangkok') {
    // 8-Pointed Zellige Star / Egyptian Scarab Faience / Thai Benjarong Ceramic Mosaic
    const step = 64;
    const accent =
      portalId === 'luxor'
        ? tileType === 'sakura'
          ? '#f2c44c'
          : '#2aa8a8'
        : portalId === 'dubai'
          ? tileType === 'sakura'
            ? '#f6d268'
            : '#1cd2e0'
          : '#f6c84c';
    for (let gy = 0; gy < H; gy += step) {
      for (let gx = 0; gx < W; gx += step) {
        const cx = gx + step / 2;
        const cy = gy + step / 2;
        ctx.strokeStyle = accent;
        ctx.lineWidth = 2.5;
        ctx.strokeRect(gx + 3, gy + 3, step - 6, step - 6);
        ctx.beginPath();
        ctx.moveTo(cx, gy + 8);
        ctx.lineTo(gx + step - 8, cy);
        ctx.lineTo(cx, gy + step - 8);
        ctx.lineTo(gx + 8, cy);
        ctx.closePath();
        ctx.stroke();
      }
    }
    ctx.restore();
    return;
  }

  if (portalId === 'atlantis' || portalId === 'permafrost' || portalId === 'starlight') {
    // Glowing Hexagonal Orichalcum / Faceted Glacier Frost / Astral Constellation Lattice
    const glowColor =
      portalId === 'atlantis'
        ? '#64f4ff'
        : portalId === 'permafrost'
          ? '#ffffff'
          : '#ffe694';
    ctx.strokeStyle = glowColor;
    ctx.lineWidth = 2.2;
    ctx.globalAlpha = 0.72;
    const step = 64;
    for (let gy = 0; gy < H; gy += step) {
      for (let gx = 0; gx < W; gx += step) {
        const cx = gx + step / 2;
        const cy = gy + step / 2;
        ctx.beginPath();
        for (let a = 0; a < 6; a++) {
          const ang = (a * Math.PI) / 3;
          const px = cx + Math.cos(ang) * 26;
          const py = cy + Math.sin(ang) * 26;
          if (a === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
      }
    }
    ctx.restore();
    return;
  }

  if (portalId === 'cat_lounge') {
    if (tileType === 'sakura') {
      // Pastel Pink & Lavender Cat-Paw Pad Mosaic
      const step = 64;
      for (let gy = 0; gy < H; gy += step) {
        for (let gx = 0; gx < W; gx += step) {
          const cx = gx + step / 2;
          const cy = gy + step / 2 + 5;
          ctx.fillStyle = '#fff0f8';
          ctx.beginPath();
          ctx.arc(cx, cy, 12, 0, Math.PI * 2);
          ctx.arc(cx - 12, cy - 14, 5, 0, Math.PI * 2);
          ctx.arc(cx - 4, cy - 18, 5, 0, Math.PI * 2);
          ctx.arc(cx + 4, cy - 18, 5, 0, Math.PI * 2);
          ctx.arc(cx + 12, cy - 14, 5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
      return;
    }
    // Herringbone Honey-Oak Parquet
    const step = 32;
    for (let gy = 0; gy < H; gy += step) {
      for (let gx = 0; gx < W; gx += step) {
        ctx.strokeStyle = darkStroke;
        ctx.lineWidth = 2;
        ctx.strokeRect(gx, gy, step, step);
      }
    }
    ctx.restore();
    return;
  }

  // Default Ashlar Flagstones / Parisian Pavés / Storybook Stepping Stones
  const step = 64;
  for (let gy = 0; gy < H; gy += step) {
    const shift = ((gy / step) & 1) * 32;
    for (let gx = -32; gx < W; gx += step) {
      ctx.fillStyle = shadeHexInt(baseHex, (((gx + gy) / 32) & 1) ? 7 : -7);
      ctx.fillRect(gx + shift + 2, gy + 2, step - 4, step - 4);
      ctx.strokeStyle = midStroke;
      ctx.lineWidth = 3;
      ctx.strokeRect(gx + shift + 1, gy + 1, step - 2, step - 2);
      ctx.strokeStyle = lightStroke;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(gx + shift + 4, gy + 4, step - 8, step - 8);
    }
  }
  ctx.restore();
}

export function createPortalTileCanvasTexture(portalId, tileType, artSpec = getPortalFloorArtDirection(portalId)) {
  if (typeof document === 'undefined') return null;
  const cacheKey = `__portal_tile_${portalId}_${tileType}`;
  if (texCache.has(cacheKey)) return texCache.get(cacheKey);

  const W = 256;
  const H = 256;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext?.('2d');
  if (!ctx) return null;

  const urlMap = {
    ground: artSpec.groundUrl || '/assets/terrain/ground_classic.png',
    cobble: '/assets/terrain/road_cobble.png',
    cream: '/assets/terrain/road_cream.png',
    sakura: '/assets/terrain/road_sakura.png',
    bridge: '/assets/terrain/road_cobble.png',
    water: '/assets/terrain/water_canal.png',
  };
  const baseTerrainUrl = urlMap[tileType] || '/assets/terrain/road_cobble.png';

  paintPortalTilePattern(ctx, W, H, portalId, tileType, artSpec, null);
  const canvasTex = new THREE.CanvasTexture(c);
  canvasTex.colorSpace = THREE.SRGBColorSpace;
  canvasTex.wrapS = THREE.RepeatWrapping;
  canvasTex.wrapT = THREE.RepeatWrapping;
  texCache.set(cacheKey, canvasTex);

  loadBillboardTexture(
    baseTerrainUrl,
    (loadedTex) => {
      if (loadedTex?.image) {
        paintPortalTilePattern(ctx, W, H, portalId, tileType, artSpec, loadedTex.image);
        canvasTex.needsUpdate = true;
      }
    },
    { repeat: true }
  );

  return canvasTex;
}

/**
 * Builds the bespoke 36×36 architectural tile grid (`cobble`, `cream`, `sakura`, `water`, `bridge`)
 * uniquely shaped for each of the 16 Portal Worlds while preserving all landmark walkways.
 */
export function buildPortalTileMap(portalId, S = 36) {
  const artSpec = getPortalFloorArtDirection(portalId);
  const isIndoor = artSpec.indoor;
  const tileMap = new Map();
  const setTile = (gx, gy, type) => {
    if (gx >= 0 && gx < S && gy >= 0 && gy < S) {
      tileMap.set(`${gx},${gy}`, type);
    }
  };
  const fillRect = (gx0, gy0, gx1, gy1, type) => {
    for (let gy = gy0; gy <= gy1; gy++) {
      for (let gx = gx0; gx <= gx1; gx++) {
        setTile(gx, gy, type);
      }
    }
  };
  const fillCircle = (cx, cy, rMin, rMax, type) => {
    for (let gy = 9; gy <= 27; gy++) {
      for (let gx = 4; gx <= 31; gx++) {
        const d = Math.hypot(gx - cx, gy - cy);
        if (d >= rMin && d <= rMax) setTile(gx, gy, type);
      }
    }
  };

  // Base functional spine so North Terrace, Overlook, Couple Spot (0, 1.5),
  // SW Couture Showcase (-7.6, 5.4), and SE Exit Arch (7.8, 6.2) are always connected
  fillRect(16, 9, 19, 27, 'cobble');
  fillRect(8, 18, 27, 20, 'cobble');
  fillRect(9, 20, 11, 24, 'cobble');
  fillRect(9, 22, 11, 24, 'sakura');
  fillRect(24, 20, 26, 25, 'cobble');
  fillRect(24, 23, 26, 25, 'cream');
  fillRect(12, 9, 23, 9, 'cream');
  fillRect(6, 13, 29, 14, 'cream');
  fillRect(12, 17, 14, 20, 'sakura');
  fillRect(21, 17, 23, 20, 'sakura');
  fillRect(14, 17, 21, 21, 'cream');
  fillRect(16, 18, 19, 20, 'sakura');

  // Now sculpt each world's unmistakable architectural floor archetype:
  if (portalId === 'fuji') {
    // Stepped Kyoto Shrine Courtyard: Hinoki wood verandas + 4 corner sakura tatami sanctuaries + Koi pond alcoves
    fillRect(10, 15, 25, 16, 'cream');
    fillRect(13, 16, 22, 22, 'cream');
    fillRect(16, 14, 19, 26, 'cobble');
    fillRect(15, 18, 20, 20, 'sakura');
    fillRect(11, 16, 12, 17, 'sakura');
    fillRect(23, 16, 24, 17, 'sakura');
    fillRect(11, 21, 12, 22, 'sakura');
    fillRect(23, 21, 24, 22, 'sakura');
  } else if (portalId === 'paris') {
    // Circular Parisian Rond-Point Plaza + diagonal Champ de Mars garden parterre walkways + Bistro Checkers
    fillCircle(17.5, 19.0, 4.6, 6.6, 'cobble');
    fillCircle(17.5, 19.0, 0, 4.6, 'cream');
    for (let d = -5; d <= 5; d++) {
      setTile(17 + d, 19 + d, 'cobble');
      setTile(18 + d, 19 + d, 'cobble');
      setTile(18 - d, 19 + d, 'cobble');
      setTile(17 - d, 19 + d, 'cobble');
    }
    for (let gy = 16; gy <= 22; gy++) {
      for (let gx = 14; gx <= 21; gx++) {
        if (Math.hypot(gx - 17.5, gy - 19.0) <= 3.6) {
          setTile(gx, gy, (gx + gy) % 2 === 0 ? 'sakura' : 'cream');
        }
      }
    }
  } else if (portalId === 'swiss') {
    // Expansive Roasted Swiss Chalet Cedar Timber Deck + Heated Zermatt Slate Walkways + Nordic Red Wool Hearth Rugs
    fillRect(10, 14, 25, 23, 'cream');
    fillRect(16, 13, 19, 27, 'cobble');
    fillRect(7, 18, 28, 20, 'cobble');
    fillRect(12, 16, 15, 21, 'sakura');
    fillRect(20, 16, 23, 21, 'sakura');
    fillRect(16, 18, 19, 20, 'sakura');
  } else if (portalId === 'dubai') {
    // 8-Pointed Islamic Star Zellige Courtyard + Flanking Cyan Infinity Pools + Persian Ruby Majlis Carpets
    for (let gy = 14; gy <= 24; gy++) {
      for (let gx = 11; gx <= 24; gx++) {
        const dx = Math.abs(gx - 17.5);
        const dy = Math.abs(gy - 19.0);
        if ((dx <= 4.5 && dy <= 4.5) || dx + dy <= 6.2) {
          setTile(gx, gy, 'cream');
        }
      }
    }
    fillRect(6, 15, 8, 22, 'water');
    fillRect(27, 15, 29, 22, 'water');
    fillRect(6, 18, 8, 20, 'bridge');
    fillRect(27, 18, 29, 20, 'bridge');
    fillRect(15, 17, 20, 21, 'sakura');
    fillRect(14, 18, 21, 20, 'sakura');
  } else if (portalId === 'maldives') {
    // Expansive Turquoise Coral Lagoon Atoll + Overwater Teak Boardwalk Jetties + Central White Coral Sandbar Island
    fillRect(5, 13, 30, 24, 'water');
    fillCircle(17.5, 19.0, 0, 4.5, 'cream');
    fillRect(16, 9, 19, 27, 'cobble');
    fillRect(6, 13, 29, 14, 'cobble');
    fillRect(7, 18, 28, 20, 'cobble');
    fillRect(9, 20, 11, 24, 'cobble');
    fillRect(24, 20, 26, 25, 'cobble');
    fillRect(12, 17, 14, 20, 'sakura');
    fillRect(21, 17, 23, 20, 'sakura');
    fillRect(16, 18, 19, 20, 'sakura');
  } else if (portalId === 'cabin') {
    // Indoor Widebody First-Class Fuselage Cabin Deck: Walnut Suite Floors + Quilted Navy Center Aisle + 6 VIP Suite Rugs
    fillRect(7, 9, 28, 26, 'cream');
    fillRect(16, 9, 19, 27, 'cobble');
    fillRect(8, 18, 27, 20, 'cobble');
    fillRect(9, 11, 14, 13, 'sakura');
    fillRect(21, 11, 26, 13, 'sakura');
    fillRect(9, 15, 14, 17, 'sakura');
    fillRect(21, 15, 26, 17, 'sakura');
    fillRect(9, 21, 14, 24, 'sakura');
    fillRect(21, 21, 26, 23, 'sakura');
    fillRect(16, 18, 19, 20, 'sakura');
  } else if (portalId === 'bangkok') {
    // Stepped Royal Thai Mandapa Indented-Corner Cross + Golden Teakwood Pier + Crimson Benjarong Lotus Mosaic
    for (let gy = 13; gy <= 25; gy++) {
      for (let gx = 10; gx <= 25; gx++) {
        const dx = Math.abs(gx - 17.5);
        const dy = Math.abs(gy - 19.0);
        if (dx + dy <= 6.8 || (dx <= 4.6 && dy <= 3.6) || (dx <= 3.6 && dy <= 4.6)) {
          setTile(gx, gy, 'cream');
        }
        if (dx + dy <= 3.6) {
          setTile(gx, gy, 'sakura');
        }
      }
    }
    fillRect(16, 13, 19, 15, 'cobble');
    fillRect(16, 23, 19, 27, 'cobble');
  } else if (portalId === 'montecarlo') {
    // Grand Octagonal Casino Royale Roulette Plaza + Black/Ivory Checkerboard + Crimson Red-Carpet Center Avenue
    for (let gy = 13; gy <= 25; gy++) {
      for (let gx = 10; gx <= 25; gx++) {
        const dx = Math.abs(gx - 17.5);
        const dy = Math.abs(gy - 19.0);
        if (dx <= 6.5 && dy <= 5.5 && dx + dy <= 9.2) {
          setTile(gx, gy, dx + dy <= 5.8 ? 'cream' : 'cobble');
        }
      }
    }
    // Red-carpeted center avenue all the way down the main aisle!
    fillRect(16, 13, 19, 26, 'sakura');
    fillRect(12, 18, 14, 20, 'sakura');
    fillRect(21, 18, 23, 20, 'sakura');
  } else if (portalId === 'atlantis') {
    // Poseidon's 3-Ring Concentric Sunken Citadel with Inner Trench Moat & 4 Cardinal Orichalcum Bridges
    fillCircle(17.5, 19.0, 5.4, 7.4, 'cobble');
    fillCircle(17.5, 19.0, 4.1, 5.4, 'water');
    fillCircle(17.5, 19.0, 2.3, 4.1, 'cream');
    fillCircle(17.5, 19.0, 0, 2.3, 'sakura');
    fillRect(16, 13, 19, 15, 'bridge');
    fillRect(16, 23, 19, 25, 'bridge');
    fillRect(11, 18, 13, 20, 'bridge');
    fillRect(22, 18, 24, 20, 'bridge');
  } else if (portalId === 'starlight') {
    // Circular Zodiac Astrolabe Ring & 8-Ray Starburst Layout
    fillCircle(17.5, 19.0, 4.4, 6.4, 'cream');
    fillCircle(17.5, 19.0, 2.4, 4.4, 'cobble');
    fillCircle(17.5, 19.0, 0, 2.4, 'sakura');
    for (const [nx, ny] of [
      [12, 14],
      [23, 14],
      [12, 24],
      [23, 24],
      [11, 19],
      [24, 19],
    ]) {
      fillRect(nx, ny, nx + 1, ny + 1, 'sakura');
    }
  } else if (portalId === 'fairytale') {
    // Enchanted Royal Heart-Shaped Ballroom Courtyard & Sunburst Marble Terrace
    fillCircle(17.5, 19.2, 0, 5.8, 'cream');
    for (let gy = 15; gy <= 23; gy++) {
      for (let gx = 13; gx <= 22; gx++) {
        const x = (gx - 17.5) / 3.4;
        const y = (18.6 - gy) / 3.0;
        const heartEq = Math.pow(x * x + y * y - 1, 3) - x * x * y * y * y;
        if (heartEq <= 0.05) {
          setTile(gx, gy, 'sakura');
        }
      }
    }
  } else if (portalId === 'permafrost') {
    // 6-Pointed Crystalline Snowflake-Star Cathedral Geometry
    fillCircle(17.5, 19.0, 0, 5.4, 'cream');
    fillRect(16, 13, 19, 25, 'cobble');
    fillRect(9, 18, 26, 20, 'cobble');
    for (let d = -5; d <= 5; d++) {
      setTile(17 + d, 19 + d, 'cobble');
      setTile(18 + d, 19 + d, 'cobble');
      setTile(18 - d, 19 + d, 'cobble');
      setTile(17 - d, 19 + d, 'cobble');
    }
    fillRect(16, 17, 19, 21, 'sakura');
    fillRect(11, 18, 12, 20, 'sakura');
    fillRect(23, 18, 24, 20, 'sakura');
  } else if (portalId === 'luxor') {
    // Processional Karnak Pylon Avenue & Turquoise-Faience Scarab Sun Court
    fillRect(10, 15, 25, 22, 'cream');
    fillRect(15, 9, 20, 27, 'cobble');
    fillRect(16, 16, 19, 21, 'sakura');
    fillRect(11, 17, 13, 20, 'sakura');
    fillRect(22, 17, 24, 20, 'sakura');
  } else if (portalId === 'venice') {
    // Expanded Venetian Lagoon & Side Canals flanking Piazza San Marco with East/West Rialto Side Bridges
    fillRect(8, 15, 27, 23, 'cream');
    fillRect(10, 16, 25, 22, 'cobble');
    fillRect(15, 17, 20, 21, 'sakura');
    fillRect(6, 13, 7, 24, 'water');
    fillRect(28, 13, 29, 24, 'water');
    fillRect(6, 18, 7, 20, 'bridge');
    fillRect(28, 18, 29, 20, 'bridge');
  } else if (portalId === 'olympus') {
    // Circular Greek Pantheon Rotunda & Cross-Colonnade with Aegean Cobalt Medallion
    fillCircle(17.5, 19.0, 4.5, 6.6, 'cream');
    fillCircle(17.5, 19.0, 2.3, 4.5, 'cobble');
    fillCircle(17.5, 19.0, 0, 2.3, 'sakura');
    fillRect(11, 18, 13, 20, 'sakura');
    fillRect(22, 18, 24, 20, 'sakura');
  } else if (portalId === 'cat_lounge') {
    // Indoor Cozy Playroom: Honey-Oak Parquet + Circular Vanilla Yarn Rug + Giant Pixel-Art Cat-Paw Pad & Toe-Beans
    fillRect(6, 9, 29, 26, 'cobble');
    fillCircle(17.5, 19.0, 0, 6.2, 'cream');
    // Main central cat-paw pad
    fillRect(15, 18, 20, 21, 'sakura');
    fillRect(16, 17, 19, 22, 'sakura');
    // 4 cute oval toe-bean pads above the main paw pad
    fillRect(12, 15, 13, 16, 'sakura');
    fillRect(15, 14, 16, 15, 'sakura');
    fillRect(19, 14, 20, 15, 'sakura');
    fillRect(22, 15, 23, 16, 'sakura');
  }

  // North Horizon Water Canal / Moat (`gy = 10..12`, `z = -8.0..-5.0`) + Central Footbridge (`gx = 16..19`)
  if (isIndoor) {
    fillRect(6, 10, 29, 12, 'cream');
    fillRect(16, 10, 19, 12, 'sakura');
  } else {
    fillRect(3, 10, 32, 12, 'water');
    const bridgeW0 = portalId === 'paris' ? 15 : 16;
    const bridgeW1 = portalId === 'paris' ? 20 : 19;
    fillRect(bridgeW0, 10, bridgeW1, 12, 'bridge');
  }

  // Ensure SW Couture Pad & SE Return Arch Pad stay intact
  fillRect(9, 22, 11, 24, 'sakura');
  fillRect(24, 23, 26, 25, 'cream');

  return tileMap;
}

/**
 * Rich painted 2.5D Sky Backdrop CanvasTexture (`w = 34, h = 15.5`) for each Portal World.
 */
function buildPortalSkyBackdropTexture(portal) {
  if (typeof document === 'undefined') return null;
  const W = 1024;
  const H = 512;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext?.('2d');
  if (!ctx) return null;

  const grd = ctx.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, portal.skyTop || '#2e2452');
  grd.addColorStop(0.52, portal.skyMid || '#94628d');
  grd.addColorStop(1, portal.skyBot || '#f8b498');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, W, H);

  // Twinkling stars in upper sky
  let seed = 4201;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < 95; i++) {
    const sx = rand() * W;
    const sy = rand() * (H * 0.62);
    const sr = 1.2 + rand() * 2.4;
    ctx.fillStyle = i % 4 === 0 ? 'rgba(255, 244, 196, 0.92)' : 'rgba(255, 255, 255, 0.8)';
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fill();
  }

  // Painted sunset/twilight clouds along the horizon
  if (portal.id === 'fuji') {
    // Warm golden glow behind Mount Fuji peak
    const sunGlow = ctx.createRadialGradient(W * 0.5, H * 0.58, 20, W * 0.5, H * 0.58, 320);
    sunGlow.addColorStop(0, 'rgba(255, 232, 180, 0.72)');
    sunGlow.addColorStop(0.55, 'rgba(255, 186, 156, 0.35)');
    sunGlow.addColorStop(1, 'rgba(255, 186, 156, 0)');
    ctx.fillStyle = sunGlow;
    ctx.fillRect(0, 0, W, H);
  } else if (portal.id === 'paris' || portal.id === 'swiss' || portal.id === 'dubai') {
    // Glowing crescent moon (drawn via offscreen moon canvas so we never punch a hole in the sky)
    const mc = document.createElement('canvas');
    mc.width = 120;
    mc.height = 120;
    const mctx = mc.getContext?.('2d');
    if (mctx) {
      mctx.fillStyle = '#fff8d6';
      mctx.beginPath();
      mctx.arc(54, 62, 38, 0, Math.PI * 2);
      mctx.fill();
      mctx.globalCompositeOperation = 'destination-out';
      mctx.beginPath();
      mctx.arc(70, 50, 32, 0, Math.PI * 2);
      mctx.fill();
      ctx.drawImage(mc, W * 0.34 - 54, H * 0.24 - 62);
    }
  } else if (portal.id === 'maldives') {
    // Golden setting sun on the ocean horizon
    const sun = ctx.createRadialGradient(W * 0.5, H * 0.75, 10, W * 0.5, H * 0.75, 120);
    sun.addColorStop(0, '#fffbe0');
    sun.addColorStop(0.5, '#ffd878');
    sun.addColorStop(1, 'rgba(255, 180, 110, 0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, W, H);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;

  // Blend the original NookAirline V1 panoramic horizon painting (`portal.v1Snap`) onto the sky backdrop
  // so every portal world carries the nostalgic hand-painted horizon of V1 behind the 2.5D foreground props!
  if (portal?.v1Snap && portal.id !== 'cabin') {
    loadBillboardTexture(portal.v1Snap, (loadedTex) => {
      const img = loadedTex?.image;
      if (!img || !img.width || !img.height) return;
      const off = document.createElement('canvas');
      off.width = W;
      off.height = H;
      const octx = off.getContext?.('2d');
      if (!octx) return;
      octx.drawImage(img, 0, H * 0.04, W, H * 0.96);
      octx.globalCompositeOperation = 'destination-in';
      const mask = octx.createLinearGradient(0, H * 0.04, 0, H);
      mask.addColorStop(0, 'rgba(0,0,0,0.18)');
      mask.addColorStop(0.22, portal.id === 'fuji' ? 'rgba(0,0,0,0.48)' : 'rgba(0,0,0,0.88)');
      mask.addColorStop(0.88, portal.id === 'fuji' ? 'rgba(0,0,0,0.52)' : 'rgba(0,0,0,0.92)');
      mask.addColorStop(1, 'rgba(0,0,0,0.25)');
      octx.fillStyle = mask;
      octx.fillRect(0, 0, W, H);
      ctx.drawImage(off, 0, 0);
      tex.needsUpdate = true;
    });
  }

  return tex;
}

// ---------------------------------------------------------------------------
// 4. Main Class: NookMuseumScene
// ---------------------------------------------------------------------------
export class NookMuseumScene {
  constructor({ world = null, onAction = null, getProfile = null, toast = null } = {}) {
    this.world = world;
    this.scene = world?.scene || null;
    this.onAction = onAction;
    this.getProfile = getProfile;
    this.toast = toast;

    this.active = false;
    this.activeLobbyView = 'entrance';
    this.currentPortalId = null; // null = inside Museum Main Hall; 'fuji' | 'paris' | 'swiss' | 'dubai' | 'maldives' | 'cabin'
    this.pipExpanded = false;
    this.pipVisible = true;
    this.musicPlaying = false;
    this._musicTimer = null;
    this._audioCtx = null;
    this.elapsed = 0;
    this.petalTimer = 0;
    this._savedSceneBg = undefined;

    this.currentPromptLandmarkId = null;
    this.currentPromptKey = null;
    this.currentPromptAction = null;
    this._pendingTrigger = null;

    this.floatingPlaques = [];
    this.portalRings = [];
    this.glowHalos = [];
    this.leanSprites = [];
    this.realmLeanSprites = [];
    this.petalParticles = [];
    this.petalSystem = null;

    // Root Group (`nook_museum_root`)
    this.root = new THREE.Group();
    this.root.name = 'nook_museum_root';
    this.root.visible = false;
    if (this.scene) {
      this.scene.add(this.root);
    }

    // Standard compatibility sub-groups (`groundGroup`, `landmarksGroup`, `decorGroup`)
    this.hallGroup = new THREE.Group();
    this.hallGroup.name = 'museum_main_hall';
    this.root.add(this.hallGroup);

    this.groundGroup = new THREE.Group();
    this.groundGroup.name = 'museum_ground';
    this.hallGroup.add(this.groundGroup);

    this.landmarksGroup = new THREE.Group();
    this.landmarksGroup.name = 'museum_landmarks';
    this.hallGroup.add(this.landmarksGroup);

    this.decorGroup = new THREE.Group();
    this.decorGroup.name = 'museum_decor';
    this.hallGroup.add(this.decorGroup);

    // Portal Realm Group (`museum_portal_realm`) — active when stepping inside any of the 16 2.5D Scenery Portals
    this.realmGroup = new THREE.Group();
    this.realmGroup.name = 'museum_portal_realm';
    this.realmGroup.visible = false;
    this.root.add(this.realmGroup);

    this.buildScene();
    this.bindEvents();
  }

  buildScene() {
    // Warm Royal Museum Gallery Lighting
    this.hemiLight = new THREE.HemisphereLight(0xfff4e4, 0x4b352a, 1.08);
    this.hemiLight.position.set(0, 28, 0);
    this.root.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xffdfad, 0.92);
    this.sunLight.position.set(14, 28, 20);
    this.root.add(this.sunLight);

    this.buildMainHall();
  }

  addHallSprite(group, url, w, h, opts = {}) {
    const mesh = makeBillboardPlane(url, w, h, opts);
    group.add(mesh);
    if (mesh.userData?.lean) {
      this.leanSprites.push(mesh);
    }
    return mesh;
  }

  addRealmSprite(group, url, w, h, opts = {}) {
    const mesh = makeBillboardPlane(url, w, h, opts);
    group.add(mesh);
    if (mesh.userData?.lean) {
      this.realmLeanSprites.push(mesh);
    }
    return mesh;
  }

  /**
   * Hand-painted 2.5D overhanging scalloped grass rim, faceted terracotta cliff wall, and golden-hour clouds
   * around the 36m × 36m floating Museum Sky-Island (matching `VillagePlaza.buildFloatingIslandCliff`).
   */
  buildMuseumIslandCliff(group, S = 36) {
    const half = S / 2;
    const wallMat = new THREE.MeshBasicMaterial({
      color: 0xd8a882,
      transparent: false,
      alphaTest: 0.35,
      side: THREE.FrontSide,
    });
    const rimMat = new THREE.MeshBasicMaterial({
      color: 0x7cb855,
      transparent: true,
      alphaTest: 0.02,
      depthWrite: false,
      side: THREE.FrontSide,
    });
    loadBillboardTexture('/assets/village/cliff_wall_strip.png', (tex) => {
      wallMat.map = tex;
      wallMat.color.setHex(0xffffff);
      wallMat.needsUpdate = true;
    });
    loadBillboardTexture('/assets/village/cliff_rim_turf_strip.png', (tex) => {
      rimMat.map = tex;
      rimMat.color.setHex(0xffffff);
      rimMat.needsUpdate = true;
    });

    // 1. Scalloped overhanging grass, wildflower & rock-tooth rim strips on all 4 sides -> 1 merged static draw call
    const rimCount = 6;
    const rimW = (S + 0.8) / rimCount + 0.55;
    const rimD = 1.55;
    const rimGeos = [];
    for (let i = 0; i < rimCount; i++) {
      const offset = ((i + 0.5) / rimCount - 0.5) * (S - 0.4);
      rimGeos.push(
        new THREE.PlaneGeometry(rimW, rimD).rotateX(-Math.PI / 2).translate(offset, 0.006, half + 0.05),
        new THREE.PlaneGeometry(rimW, rimD).rotateX(-Math.PI / 2).rotateY(Math.PI).translate(offset, 0.006, -half - 0.05),
        new THREE.PlaneGeometry(rimW, rimD).rotateX(-Math.PI / 2).rotateY(Math.PI / 2).translate(half + 0.08, 0.005, offset),
        new THREE.PlaneGeometry(rimW, rimD).rotateX(-Math.PI / 2).rotateY(-Math.PI / 2).translate(-half - 0.08, 0.005, offset)
      );
    }
    const rimMesh = new THREE.Mesh(mergeStaticGeometries(rimGeos), rimMat);
    rimMesh.name = 'museum_cliff_rim_turf';
    rimMesh.renderOrder = 2;
    rimMesh.matrixAutoUpdate = false;
    rimMesh.updateMatrix();
    group.add(rimMesh);

    // 2. Front (South) 2.5D faceted terracotta cliff wall -> 1 merged static opaque-pass draw call
    const wallCount = 6;
    const wallW = (S + 0.9) / wallCount + 0.65;
    const wallH = 3.15;
    const wallGeos = [];
    for (let i = 0; i < wallCount; i++) {
      const offset = ((i + 0.5) / wallCount - 0.5) * (S - 0.4);
      wallGeos.push(
        new THREE.PlaneGeometry(wallW, wallH).rotateX(-0.06).translate(offset, -1.12, half + 0.18 + i * 0.01)
      );
    }
    const wallMesh = new THREE.Mesh(mergeStaticGeometries(wallGeos), wallMat);
    wallMesh.name = 'museum_cliff_wall_south';
    wallMesh.matrixAutoUpdate = false;
    wallMesh.updateMatrix();
    group.add(wallMesh);

    // 3. Fluffy golden-hour clouds along the South cliff & North sky horizon
    for (const [cx, cy, cz, cw, ch, url, mir] of [
      [-12.5, -2.65, half + 0.65, 5.2, 2.8, '/assets/village/env_cloud_fluffy_b.png', true],
      [0, -2.75, half + 0.75, 5.6, 3.0, '/assets/village/env_cloud_fluffy_a.png', false],
      [12.5, -2.65, half + 0.65, 5.2, 2.8, '/assets/village/env_cloud_fluffy_b.png', false],
      [-11.0, -1.8, -half - 2.4, 6.2, 3.4, '/assets/village/env_cloud_fluffy_a.png', false],
      [0, -1.6, -half - 2.8, 6.8, 3.6, '/assets/village/env_cloud_fluffy_b.png', false],
      [11.0, -1.8, -half - 2.4, 6.2, 3.4, '/assets/village/env_cloud_fluffy_a.png', true],
    ]) {
      const cloud = makeBillboardPlane(url, cw, ch, {
        x: cx,
        y: cy,
        z: cz,
        pitch: -0.06,
        opacity: 0.92,
        depthWrite: false,
        lean: false,
        mirror: mir,
        name: 'museum_sky_cloud',
      });
      group.add(cloud);
    }
  }

  /**
   * Builds the true 36 × 36 (1m × 1m cell) Village Road, Plaza & Crystal Canal Grid:
   * - 3 North–South Cobblestone Avenues (`gx = 8..9`, `gx = 16..19`, `gx = 26..27`)
   * - 4 East–West Cross-Streets (`gy = 5..6`, `gy = 11..12`, `gy = 23..24`, `gy = 29..30`)
   * - Central Royal Cream-Stone Plaza (`gx = 13..22, gy = 15..20`) + Sakura Garden Aprons
   * - Sparkling East–West Crystal Water Canal (`gy = 21`) with 3 Stone Footbridges, Lilies, Boulders & Waterfalls
   * - Merged 3D Raised Cream-Stone Road Curbs & Wildflower Tufts along road-to-grass edges
   */
  buildMuseumVillageGrid(group, S = 36) {
    const Y_WATER = 0.006;
    const Y_ROAD = 0.012;
    const Y_BRIDGE = 0.02;
    const ox = -S / 2;
    const oz = -S / 2;
    const cellCenter = (gx, gy) => ({ x: ox + gx + 0.5, z: oz + gy + 0.5 });

    const tileMap = new Map();
    const setTile = (gx, gy, type) => {
      if (gx >= 0 && gx < S && gy >= 0 && gy < S) {
        tileMap.set(`${gx},${gy}`, type);
      }
    };
    const fillRect = (gx0, gy0, gx1, gy1, type) => {
      for (let gy = gy0; gy <= gy1; gy++) {
        for (let gx = gx0; gx <= gx1; gx++) {
          setTile(gx, gy, type);
        }
      }
    };

    // 1. 4 Horizontal East–West Cross-Streets (`road_cobble`)
    fillRect(3, 5, 32, 6, 'cobble'); // North Boulevard (z = -13..-11)
    fillRect(3, 11, 32, 12, 'cobble'); // Upper Cross-Street (z = -7..-5)
    fillRect(3, 23, 32, 24, 'cobble'); // Lower Cross-Street (z = +5..+7)
    fillRect(3, 29, 32, 30, 'cobble'); // South Promenade (z = +11..+13)

    // 2. 3 North–South Promenade Avenues (`road_cobble`)
    fillRect(8, 3, 9, 32, 'cobble'); // West Avenue (x = -10..-8)
    fillRect(26, 3, 27, 32, 'cobble'); // East Avenue (x = +8..+10)
    fillRect(16, 2, 19, 34, 'cobble'); // Central Grand Avenue (x = -2..+2)

    // 3. Sakura Garden Aprons (`road_sakura`) under Gacha Showcase Pairs & Couple Viewing Spot
    fillRect(10, 14, 14, 17, 'sakura');
    fillRect(10, 22, 14, 24, 'sakura');
    fillRect(10, 27, 14, 28, 'sakura');

    // 4. Central Royal Plaza Square (`road_cream`) + East Couple Spot Apron (`road_sakura`)
    fillRect(13, 15, 22, 20, 'cream');
    fillRect(21, 17, 25, 20, 'sakura');

    // 5. Sparkling East–West Crystal Water Canal (`gy = 21`) & 3 Stone Footbridges
    const bridgeCols = new Set([8, 9, 16, 17, 18, 19, 26, 27]);
    for (let gx = 0; gx < S; gx++) {
      setTile(gx, 21, bridgeCols.has(gx) ? 'bridge' : 'water');
    }

    // Group cells by tile type and create 1 merged mesh per type
    const byType = {};
    for (const [key, type] of tileMap.entries()) {
      const [gx, gy] = key.split(',').map(Number);
      (byType[type] ||= []).push([gx, gy]);
    }

    const tileDefs = {
      cobble: { url: '/assets/terrain/road_cobble.png', y: Y_ROAD, color: 0xd8c8b4 },
      cream: { url: '/assets/terrain/road_cream.png', y: Y_ROAD, color: 0xf4e8d4 },
      sakura: { url: '/assets/terrain/road_sakura.png', y: Y_ROAD, color: 0xf5d6de },
      bridge: { url: '/assets/terrain/road_cobble.png', y: Y_BRIDGE, color: 0xe2d2be },
      water: { url: '/assets/terrain/water_canal.png', y: Y_WATER, color: 0x48b8e8, water: true },
    };

    for (const [type, cells] of Object.entries(byType)) {
      const def = tileDefs[type];
      if (!def || !cells.length) continue;
      const mat = new THREE.MeshBasicMaterial({
        color: def.color,
        transparent: Boolean(def.water),
        opacity: def.water ? 0.96 : 1,
      });
      loadBillboardTexture(
        def.url,
        (tex) => {
          mat.map = tex;
          mat.color.setHex(0xffffff);
          mat.needsUpdate = true;
        },
        { repeat: true }
      );
      const mesh = new THREE.Mesh(museumCellsGeometry(cells, def.y, 0.5, S), mat);
      mesh.name = `museum_tiles_${type}`;
      group.add(mesh);
    }

    // 6. Merged 3D Raised Cream-Stone Road Curbs & Wildflower Tufts along road-to-grass edges
    const curbGeos = [];
    for (const [key, type] of tileMap.entries()) {
      if (type === 'water' || type === 'bridge') continue;
      const [gx, gy] = key.split(',').map(Number);
      const c = cellCenter(gx, gy);
      const westGrass = !tileMap.has(`${gx - 1},${gy}`);
      const eastGrass = !tileMap.has(`${gx + 1},${gy}`);
      const northGrass = !tileMap.has(`${gx},${gy - 1}`);
      const southGrass = !tileMap.has(`${gx},${gy + 1}`);
      if (westGrass) {
        curbGeos.push(new THREE.BoxGeometry(0.09, 0.035, 1.02).translate(c.x - 0.46, Y_ROAD + 0.015, c.z));
        if ((gx + gy) % 3 === 0) {
          const tuft = gy % 2 === 0 ? '/assets/village/decal_grass_daisies_b.png' : '/assets/village/decal_grass_clover_a.png';
          this.addHallSprite(group, tuft, 0.52, 0.42, { x: c.x - 0.48, y: 0, z: c.z + 0.12, name: 'museum_curb_tuft' });
        }
      }
      if (eastGrass) {
        curbGeos.push(new THREE.BoxGeometry(0.09, 0.035, 1.02).translate(c.x + 0.46, Y_ROAD + 0.015, c.z));
        if ((gx + gy) % 3 === 1) {
          const tuft = gy % 2 === 1 ? '/assets/village/decal_grass_daisies_b.png' : '/assets/village/decal_grass_clover_a.png';
          this.addHallSprite(group, tuft, 0.52, 0.42, { x: c.x + 0.48, y: 0, z: c.z + 0.12, name: 'museum_curb_tuft' });
        }
      }
      if (northGrass) {
        curbGeos.push(new THREE.BoxGeometry(1.02, 0.035, 0.09).translate(c.x, Y_ROAD + 0.015, c.z - 0.46));
      }
      if (southGrass) {
        curbGeos.push(new THREE.BoxGeometry(1.02, 0.035, 0.09).translate(c.x, Y_ROAD + 0.015, c.z + 0.46));
      }
    }
    if (curbGeos.length) {
      const curbMat = new THREE.MeshBasicMaterial({ color: 0xf3e5d0 });
      const curbMesh = new THREE.Mesh(mergeStaticGeometries(curbGeos), curbMat);
      curbMesh.name = 'museum_road_curbs';
      curbMesh.matrixAutoUpdate = false;
      curbMesh.updateMatrix();
      group.add(curbMesh);
    }

    // 7. 3 Stone Footbridges (Carved Cream-Stone Bridge Curbs & Corner Pillar Caps)
    const bridgeCells = byType.bridge || [];
    const railGeos = [];
    for (const [gx, gy] of bridgeCells) {
      const c = cellCenter(gx, gy);
      if (tileMap.get(`${gx - 1},${gy}`) === 'water') {
        railGeos.push(new THREE.BoxGeometry(0.14, 0.2, 1.02).translate(c.x - 0.44, 0.11, c.z));
        this.addHallSprite(group, '/assets/village/env_bridge_pillar_cap.png', 0.34, 0.44, {
          x: c.x - 0.46,
          y: 0,
          z: c.z - 0.38,
          name: 'museum_bridge_pillar_cap',
        });
        this.addHallSprite(group, '/assets/village/env_bridge_pillar_cap.png', 0.34, 0.44, {
          x: c.x - 0.46,
          y: 0,
          z: c.z + 0.42,
          name: 'museum_bridge_pillar_cap',
        });
      }
      if (tileMap.get(`${gx + 1},${gy}`) === 'water') {
        railGeos.push(new THREE.BoxGeometry(0.14, 0.2, 1.02).translate(c.x + 0.44, 0.11, c.z));
        this.addHallSprite(group, '/assets/village/env_bridge_pillar_cap.png', 0.34, 0.44, {
          x: c.x + 0.46,
          y: 0,
          z: c.z - 0.38,
          name: 'museum_bridge_pillar_cap',
        });
        this.addHallSprite(group, '/assets/village/env_bridge_pillar_cap.png', 0.34, 0.44, {
          x: c.x + 0.46,
          y: 0,
          z: c.z + 0.42,
          name: 'museum_bridge_pillar_cap',
        });
      }
    }
    if (railGeos.length) {
      const railMat = new THREE.MeshBasicMaterial({ color: 0xeee0c8 });
      const railMesh = new THREE.Mesh(mergeStaticGeometries(railGeos), railMat);
      railMesh.name = 'museum_bridge_curbs';
      railMesh.matrixAutoUpdate = false;
      railMesh.updateMatrix();
      group.add(railMesh);
    }

    // 8. Crystal Water Canal Banks, Water Lilies, Boulders, Cattails & Cliff Waterfalls
    const waterCells = byType.water || [];
    const bankGeos = [];
    waterCells.forEach(([gx, gy], idx) => {
      const c = cellCenter(gx, gy);
      if (idx % 2 === 1) {
        const lily =
          idx % 4 === 1 ? '/assets/village/decal_water_lily_white.png' : '/assets/village/decal_water_lotus_pink.png';
        this.addHallSprite(group, lily, 0.65, 0.52, {
          x: c.x + (idx % 3 ? 0.12 : -0.12),
          y: 0.01,
          z: c.z + 0.08,
          name: 'museum_canal_lily',
        });
      }
      const northEmpty = !tileMap.has(`${gx},${gy - 1}`);
      const southEmpty = !tileMap.has(`${gx},${gy + 1}`);
      if (northEmpty) {
        bankGeos.push(new THREE.BoxGeometry(1.02, 0.04, 0.11).translate(c.x, Y_WATER + 0.015, c.z - 0.46));
        if (gx === 4 || gx === 14 || gx === 29) {
          const prop = gx % 2 === 0 ? '/assets/village/env_river_boulders_a.png' : '/assets/village/env_river_cattails.png';
          this.addHallSprite(group, prop, 0.92, 0.78, { x: c.x, y: 0, z: c.z - 0.38, name: 'museum_canal_bank_prop' });
        }
      }
      if (southEmpty) {
        bankGeos.push(new THREE.BoxGeometry(1.02, 0.04, 0.11).translate(c.x, Y_WATER + 0.015, c.z + 0.46));
        if (gx === 6 || gx === 22 || gx === 31) {
          const prop = gx % 2 === 0 ? '/assets/village/env_river_boulders_b.png' : '/assets/village/env_river_cattails.png';
          this.addHallSprite(group, prop, 0.88, 0.74, { x: c.x, y: 0, z: c.z + 0.46, name: 'museum_canal_bank_prop' });
        }
      }
      if (gx === 0 || gx === S - 1) {
        const wx = gx === 0 ? c.x - 0.55 : c.x + 0.55;
        this.addHallSprite(group, '/assets/village/cliff_waterfall_strip.png', 1.35, 2.75, {
          x: wx,
          y: -1.35,
          z: c.z + 0.35,
          name: 'museum_canal_waterfall',
        });
        this.addHallSprite(group, '/assets/village/env_waterfall_mist.png', 1.45, 1.25, {
          x: wx,
          y: -1.45,
          z: c.z + 0.45,
          name: 'museum_canal_waterfall_mist',
        });
      }
    });
    if (bankGeos.length) {
      const bankMat = new THREE.MeshBasicMaterial({ color: 0x847b6e });
      const bankMesh = new THREE.Mesh(mergeStaticGeometries(bankGeos), bankMat);
      bankMesh.name = 'museum_canal_banks';
      bankMesh.matrixAutoUpdate = false;
      bankMesh.updateMatrix();
      group.add(bankMesh);
    }
  }

  // -------------------------------------------------------------------------
  // Main Hall Builder — Village-Style 2.5D Grid Museum Sanctuary (36m × 36m)
  // -------------------------------------------------------------------------
  buildMainHall() {
    const size = NOOK_MUSEUM.SIZE;
    this.leanSprites = [];

    // 1. Base Village Meadow Ground (`36m × 36m` at `y = 0`) tiled 9×9 with `/assets/terrain/ground_classic.png`
    const floorGeo = new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2);
    const guv = floorGeo.attributes.uv;
    for (let i = 0; i < guv.count; i++) {
      guv.setXY(i, guv.getX(i) * 9, guv.getY(i) * 9);
    }
    const floorMat = new THREE.MeshBasicMaterial({ color: 0xb9c54f });
    loadBillboardTexture(
      '/assets/terrain/ground_classic.png',
      (tex) => {
        floorMat.map = tex;
        floorMat.color.setHex(0xffffff);
        floorMat.needsUpdate = true;
      },
      { repeat: true }
    );
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.name = 'museum_painting_floor';
    floorMesh.position.set(0, 0, 0);
    this.groundGroup.add(floorMesh);

    // 2. Floating Sky-Island Cliff Rim & Terracotta Cliff Wall + True 36×36 Village Road & Canal Grid
    this.buildMuseumIslandCliff(this.groundGroup, size);
    this.buildMuseumVillageGrid(this.groundGroup, size);

    // =========================================================================
    // ZONE A (CENTRAL ROYAL PLAZA): Legacy Globe Monument (`(0, 0, -0.6)`)
    // =========================================================================
    const rotundaGroup = new THREE.Group();
    rotundaGroup.name = 'rotunda_centerpiece';
    rotundaGroup.position.set(0, 0, -0.6);
    rotundaGroup.userData = {
      landmarkId: 'rotunda_chronicle',
      action: 'open_timeline',
    };

    const legacyGlobeMonument = this.addHallSprite(
      rotundaGroup,
      '/assets/museum/museum_legacy_globe_monument.png',
      3.6,
      3.8,
      {
        x: 0,
        y: 0,
        z: 0,
        worldZ: -0.6,
        name: 'museum_legacy_globe_monument',
      }
    );
    void legacyGlobeMonument;

    // Keep alias reference for backward test compatibility
    const planeMonumentAlias = new THREE.Group();
    planeMonumentAlias.name = 'museum_golden_plane_monument';
    rotundaGroup.add(planeMonumentAlias);

    this.landmarksGroup.add(rotundaGroup);

    // =========================================================================
    // ZONE B (WEST PLAZA): World Directory Lectern (`(-3.2, 0, 0.8)`)
    // =========================================================================
    const directoryGroup = new THREE.Group();
    directoryGroup.name = 'zone_b_world_directory';
    directoryGroup.position.set(-3.2, 0, 0.8);
    directoryGroup.userData = {
      landmarkId: 'world_directory',
      action: 'open_directory',
    };

    this.addHallSprite(directoryGroup, '/assets/museum/museum_world_directory_lectern.png', 2.0, 2.2, {
      x: 0,
      y: 0,
      z: 0,
      worldZ: 0.8,
      name: 'museum_world_directory_lectern',
    });

    this.landmarksGroup.add(directoryGroup);

    // =========================================================================
    // ZONE C (PLAZA CORNERS): 4 Compact V1/V2 Memory Easels
    // =========================================================================
    const easelConfigs = [
      { id: 'easel_fg_left', x: -2.8, z: 2.2, w: 1.35, h: 1.68 },
      { id: 'easel_fg_right', x: 2.8, z: 2.2, w: 1.35, h: 1.68 },
      { id: 'easel_mid_left', x: -2.8, z: -2.6, w: 1.35, h: 1.68 },
      { id: 'easel_mid_right', x: 2.8, z: -2.6, w: 1.35, h: 1.68 },
    ];
    for (let eIdx = 0; eIdx < easelConfigs.length; eIdx++) {
      const ec = easelConfigs[eIdx];
      const easelGrp = new THREE.Group();
      easelGrp.name = `zone_c_${ec.id}`;
      easelGrp.position.set(ec.x, 0, ec.z);
      easelGrp.userData = {
        landmarkId: ec.id,
        action: 'compare_v1',
      };
      this.addHallSprite(easelGrp, '/assets/museum/museum_v1_v2_easel.png', ec.w, ec.h, {
        x: 0,
        y: 0,
        z: 0,
        worldZ: ec.z,
        name: `sprite_${ec.id}`,
      });
      this.landmarksGroup.add(easelGrp);
    }

    // =========================================================================
    // ZONE D (WEST PROMENADE GRID PLOTS): 6 Gacha Showcase Pedestals in 3 Side-by-Side Pairs + 12 Exhibit Groups
    // =========================================================================
    const gachaShowcaseModels = [
      {
        exhibitIdx: 0,
        sprite: '/assets/museum/museum_chibi_pedestal_pink_princess.png',
        x: -7.0,
        y: 0,
        z: -2.4,
        w: 1.65,
        h: 2.15,
      },
      {
        exhibitIdx: 1,
        sprite: '/assets/museum/museum_chibi_pedestal_blue_starlight.png',
        x: -4.6,
        y: 0,
        z: -2.4,
        w: 1.65,
        h: 2.15,
      },
      {
        exhibitIdx: 2,
        sprite: '/assets/museum/museum_chibi_pedestal_adventurer_boy.png',
        x: -7.0,
        y: 0,
        z: 5.2,
        w: 1.65,
        h: 2.15,
      },
      {
        exhibitIdx: 3,
        sprite: '/assets/museum/museum_chibi_pedestal_lavender_neko.png',
        x: -4.6,
        y: 0,
        z: 5.2,
        w: 1.65,
        h: 2.15,
      },
      {
        exhibitIdx: 4,
        sprite: '/assets/museum/museum_gacha_glass_vitrine.png',
        x: -7.0,
        y: 0,
        z: 9.8,
        w: 1.65,
        h: 2.15,
      },
      {
        exhibitIdx: 5,
        sprite: '/assets/museum/museum_gacha_glass_vitrine.png',
        x: -4.6,
        y: 0,
        z: 9.8,
        w: 1.65,
        h: 2.15,
      },
    ];

    for (let i = 0; i < MUSEUM_GACHA_EXHIBITS.length; i++) {
      const ex = MUSEUM_GACHA_EXHIBITS[i];
      const exGroup = new THREE.Group();
      exGroup.name = `gacha_exhibit_${ex.id}`;
      exGroup.position.set(ex.x, 0, ex.z);
      exGroup.userData = {
        landmarkId: ex.id,
        action: `exhibit:${ex.id}`,
        exhibit: ex,
      };

      const showcaseSpec = gachaShowcaseModels[i];
      if (showcaseSpec) {
        const relX = showcaseSpec.x - ex.x;
        const relZ = showcaseSpec.z - ex.z;
        exGroup.add(
          makeFloorDecal('/assets/terrain/road_sakura.png', 1.85, 1.65, {
            x: relX,
            y: 0.015,
            z: relZ,
            opacity: 0.96,
            renderOrder: 1,
            name: `gacha_pad_${ex.id}`,
          })
        );
        this.addHallSprite(exGroup, showcaseSpec.sprite, showcaseSpec.w, showcaseSpec.h, {
          x: relX,
          y: showcaseSpec.y,
          z: relZ,
          worldZ: showcaseSpec.z,
          name: `gacha_pedestal_hero_${ex.id}`,
        });
      }
      this.landmarksGroup.add(exGroup);
    }

    // =========================================================================
    // ZONE E (EAST SAKURA PLAZA PLOT): Couple Viewing Spot (`(+4.5, 0, 0.8)`)
    // =========================================================================
    const couplePavilionGroup = new THREE.Group();
    couplePavilionGroup.name = 'zone_e_couple_viewing_spot';
    couplePavilionGroup.position.set(4.5, 0, 0.8);
    couplePavilionGroup.userData = {
      landmarkId: 'lobby_couple_spot',
      action: 'couple_pose',
    };

    this.addHallSprite(couplePavilionGroup, '/assets/museum/museum_couple_heart_gazebo.png', 3.6, 3.0, {
      x: 0,
      y: 0,
      z: 0,
      worldZ: 0.8,
      name: 'museum_couple_heart_gazebo',
    });

    this.landmarksGroup.add(couplePavilionGroup);

    // =========================================================================
    // 16 LIVING SCENERY PORTALS ON SPACIOUS VILLAGE GRID PLOTS (`yElev = 0`)
    // =========================================================================
    const topCos = Math.cos(Math.abs(VILLAGE_PITCH_RAD));
    const topSin = Math.sin(Math.abs(VILLAGE_PITCH_RAD));
    for (let i = 0; i < MUSEUM_SCENERY_PORTALS.length; i++) {
      const portal = MUSEUM_SCENERY_PORTALS[i];
      const pGroup = new THREE.Group();
      pGroup.name = `scenery_portal_${portal.id}`;
      pGroup.position.set(portal.x, 0, portal.z);
      pGroup.userData = {
        landmarkId: `portal_${portal.id}`,
        action: `portal:${portal.id}`,
        portalId: portal.id,
      };

      // Cream-stone tile plot pad under each portal
      pGroup.add(
        makeFloorDecal('/assets/terrain/road_cream.png', 2.4, 2.0, {
          x: 0,
          y: 0.015,
          z: 0.08,
          opacity: 0.96,
          renderOrder: 1,
          name: `portal_pad_${portal.id}`,
        })
      );

      // Subtle Golden Floor Magic Circle beneath the portal step
      const magicRing = makeFloorDecal('/assets/ui/fx_magic_circle.png', 2.05, 2.05, {
        x: 0,
        y: 0.022,
        z: 0.12,
        opacity: 0.55,
        renderOrder: 4,
        factor: -3,
        color: 0xffdf88,
        additive: true,
        name: `portal_magic_ring_${portal.id}`,
      });
      pGroup.add(magicRing);
      this.portalRings.push(magicRing);

      // Village-scaled Portal Archway (`w = 2.25, h = 3.25`)
      const archW = 2.25;
      const archH = 3.25;
      this.addHallSprite(pGroup, `/assets/museum/portal_arch_${portal.id}.png`, archW, archH, {
        x: 0,
        y: 0,
        z: 0,
        worldZ: portal.z,
        name: `portal_frame_gold_${portal.id}`,
      });

      // Position nameplate pill at the true 3D top crown of the -36° tilted arch sprite
      const crownY = archH * topCos + 0.22;
      const crownZ = -archH * topSin;
      const plaque = makePortalPlaqueSprite(portal.shortLabel, {
        scaleW: 1.65,
        scaleH: 0.36,
      });
      plaque.position.set(0, crownY, crownZ);
      plaque.userData = { baseY: crownY, phase: i * 0.45 };
      pGroup.add(plaque);
      this.floatingPlaques.push(plaque);

      this.landmarksGroup.add(pGroup);
    }

    // 5. South Exit Gate (0, 14.8) — Boarding Gate Trigger back to Village / Town Hall
    const exitGroup = new THREE.Group();
    exitGroup.name = 'south_exit_gate';
    exitGroup.position.set(0, 0, 14.8);
    exitGroup.userData = {
      landmarkId: 'exit_museum',
      action: 'exit_museum',
    };

    this.landmarksGroup.add(exitGroup);

    // =========================================================================
    // LUSH VILLAGE SCENERY PROPS (`this.decorGroup`)
    // =========================================================================
    const villageTrees = [
      [-15.5, -15.2, '/assets/village/env_tree_oak_a.png', 2.1, 2.3, false],
      [-8.5, -15.4, '/assets/village/env_tree_fruit_apple.png', 2.1, 2.3, false],
      [-2.8, -15.4, '/assets/village/env_tree_sakura_a.png', 2.1, 2.3, false],
      [2.8, -15.4, '/assets/village/env_tree_golden_maple.png', 2.1, 2.3, true],
      [8.5, -15.4, '/assets/village/env_tree_sakura_a.png', 2.1, 2.3, true],
      [15.5, -15.2, '/assets/village/env_tree_oak_a.png', 2.1, 2.3, true],
      [-15.8, -4.5, '/assets/village/env_tree_fruit_apple.png', 2.1, 2.3, false],
      [15.8, -4.5, '/assets/village/env_tree_golden_maple.png', 2.1, 2.3, true],
      [-15.8, 1.5, '/assets/village/env_tree_sakura_a.png', 2.1, 2.3, false],
      [15.8, 1.5, '/assets/village/env_tree_oak_a.png', 2.1, 2.3, true],
      [-15.6, 13.8, '/assets/village/env_tree_oak_a.png', 2.1, 2.3, false],
      [15.6, 13.8, '/assets/village/env_tree_sakura_a.png', 2.1, 2.3, true],
      [-3.2, -9.2, '/assets/village/env_tree_fruit_apple.png', 2.0, 2.2, false],
      [3.2, -9.2, '/assets/village/env_tree_sakura_a.png', 2.0, 2.2, true],
    ];
    for (const [tx, tz, url, tw, th, mir] of villageTrees) {
      this.addHallSprite(this.decorGroup, url, tw, th, {
        x: tx,
        y: 0,
        z: tz,
        worldZ: tz,
        mirror: mir,
        name: 'museum_village_tree',
      });
    }

    // Curated Village Landmarks & Cozy Decor Props on Grass Plots
    this.addHallSprite(this.decorGroup, '/assets/village/wnd_onsen.png', 2.6, 2.4, {
      x: -4.8,
      y: 0,
      z: 13.8,
      worldZ: 13.8,
      name: 'museum_village_onsen',
    });
    this.addHallSprite(this.decorGroup, '/assets/village/dec_picnic.png', 2.1, 1.6, {
      x: 4.2,
      y: 0,
      z: -2.8,
      worldZ: -2.8,
      name: 'museum_village_picnic',
    });
    this.addHallSprite(this.decorGroup, '/assets/village/dec_gramophone.png', 1.2, 1.5, {
      x: 3.2,
      y: 0,
      z: -1.8,
      worldZ: -1.8,
      name: 'museum_village_gramophone',
    });
    this.addHallSprite(this.decorGroup, '/assets/village/dec_flower_cart.png', 1.8, 1.6, {
      x: -3.5,
      y: 0,
      z: 8.2,
      worldZ: 8.2,
      name: 'museum_village_flower_cart',
    });

    // Vintage Iron Streetlamps along the Central Cobblestone Avenue
    for (const lz of [-9.5, -3.5, 1.8, 8.2, 13.5]) {
      for (const lx of [-2.35, 2.35]) {
        this.addHallSprite(this.decorGroup, '/assets/village/env_streetlamp_iron.png', 0.48, 1.25, {
          x: lx,
          y: 0,
          z: lz,
          worldZ: lz,
          name: 'museum_avenue_streetlamp',
        });
      }
    }

    // Flower Bushes & Rose Clusters along Grass Plots
    const flowerBushes = [
      [-3.2, -4.2, '/assets/village/env_bush_daisies_white.png'],
      [3.2, -4.2, '/assets/village/env_bush_roses_pink.png'],
      [-3.2, 4.6, '/assets/village/env_bush_roses_pink.png'],
      [3.2, 4.6, '/assets/village/env_bush_daisies_white.png'],
      [-7.2, -9.8, '/assets/village/env_bush_daisies_white.png'],
      [7.2, -9.8, '/assets/village/env_bush_roses_pink.png'],
      [-7.2, 13.8, '/assets/village/env_bush_roses_pink.png'],
      [7.2, 13.8, '/assets/village/env_bush_daisies_white.png'],
    ];
    for (const [bx, bz, url] of flowerBushes) {
      this.addHallSprite(this.decorGroup, url, 0.95, 0.72, {
        x: bx,
        y: 0,
        z: bz,
        worldZ: bz,
        name: 'museum_village_bush',
      });
    }
  }

  // -------------------------------------------------------------------------
  // 2.5D Living Scenery Portal Worlds Builder (`fuji`, `paris`, `swiss`, `dubai`, `maldives`, `cabin`)
  // -------------------------------------------------------------------------
  enterPortal(portalId, { fromServer = false } = {}) {
    if (this._keepsakeModalTimer) {
      clearTimeout(this._keepsakeModalTimer);
      this._keepsakeModalTimer = null;
    }
    const portal = MUSEUM_SCENERY_PORTALS.find((p) => p.id === portalId) || MUSEUM_SCENERY_PORTALS[0];
    this.active = true;
    this.root.visible = true;
    this.currentPortalId = portal.id;
    this.hallGroup.visible = false;
    this.realmGroup.visible = true;
    if (this.world) {
      this.world._museumMode = true;
      this.world._museumLayout = { kind: 'museum', size: 36, portalId: portal.id };
      this.world.clearMoveState?.();
      if (this.world.plaza?.root) this.world.plaza.root.visible = false;
      if (this.world.villagePlaza?.root) this.world.villagePlaza.root.visible = false;
    }

    this.buildPortalRealm(portal);

    // Place local player & companion partner on the viewing deck / arrival promenade
    const sx = -0.55;
    const sz = 2.6;
    if (this.world?.local) {
      this.world.local.x = sx;
      this.world.local.z = sz;
      this.world.local.tx = sx;
      this.world.local.tz = sz;
      this.world.setLocalPosition?.(sx, sz);
      this.world.local.rig?.facing?.set?.(true, true);
      this.world.local.pet?.placeNear?.({ x: sx, z: sz, right: true });
    }
    if (this.world?.camTarget) {
      this.world.camTarget.set(0, 0.35, 1.2);
    }
    if (!fromServer) {
      this.onAction?.('switch_portal', portal.id, { x: sx, z: sz });
    }
    this.syncPartnerFollow(true);

    this.updateHud();
    if (this.toast && !fromServer) {
      this.toast(`🌀 Stepped into ${portal.title}! Compare with the V1 snapshot card.`);
    }
    if (this.world?.local) {
      this.checkTrigger(this.world.local.x, this.world.local.z);
    }
    return portal;
  }

  exitPortalToHall({ fromServer = false, spawn = null } = {}) {
    if (this._keepsakeModalTimer) {
      clearTimeout(this._keepsakeModalTimer);
      this._keepsakeModalTimer = null;
    }
    const prevPortal = MUSEUM_SCENERY_PORTALS.find((p) => p.id === this.currentPortalId);
    this.active = true;
    this.root.visible = true;
    this.currentPortalId = null;
    this.realmGroup.visible = false;
    this.hallGroup.visible = true;
    if (this.world) {
      this.world._museumMode = true;
      this.world._museumLayout = { kind: 'museum', size: 36, portalId: null };
      this.world.clearMoveState?.();
      if (this.world.plaza?.root) this.world.plaza.root.visible = false;
      if (this.world.villagePlaza?.root) this.world.villagePlaza.root.visible = false;
    }

    const nx = Number.isFinite(spawn?.x) ? spawn.x : (prevPortal ? prevPortal.x * 0.72 : 0);
    const nz = Number.isFinite(spawn?.z) ? spawn.z : (prevPortal ? prevPortal.z + 2.2 : 0);
    if (this.world?.local) {
      this.world.local.x = nx;
      this.world.local.z = nz;
      this.world.local.tx = nx;
      this.world.local.tz = nz;
      this.world.setLocalPosition?.(nx, nz);
      this.world.local.pet?.placeNear?.({ x: nx, z: nz, right: true });
    }
    if (this.world?.camTarget) {
      this.world.camTarget.set(nx, 0, nz);
    }
    if (!fromServer) {
      this.onAction?.('switch_portal', null, { x: +nx.toFixed(3), z: +nz.toFixed(3) });
    }
    this.syncPartnerFollow(true);

    this.updateHud();
    if (this.world?.local) {
      this.checkTrigger(this.world.local.x, this.world.local.z);
    }
  }

  buildPortalRealm(portal) {
    while (this.realmGroup.children.length > 0) {
      this.realmGroup.remove(this.realmGroup.children[0]);
    }
    this.petalParticles = [];
    this.petalSystem = null;
    this.realmLeanSprites = [];

    const size = NOOK_MUSEUM.SIZE;
    const artSpec = getPortalFloorArtDirection(portal.id);
    const groundTheme = getPortalGroundTheme(portal.id);

    // 1. Hand-Painted & Bespoke Art-Directed Ground Mesh (`36m × 19.2m` spanning `z = -8.6..+10.6`, tiled with `repeat: true`)
    const floorD = 19.2;
    const floorGeo = new THREE.PlaneGeometry(size, floorD).rotateX(-Math.PI / 2);
    const guv = floorGeo.attributes.uv;
    for (let i = 0; i < guv.count; i++) {
      guv.setXY(i, guv.getX(i) * 9, guv.getY(i) * 5);
    }
    const groundCanvasTex = createPortalTileCanvasTexture(portal.id, 'ground', artSpec);
    const floorMat = new THREE.MeshBasicMaterial({
      map: groundCanvasTex || null,
      color: groundCanvasTex ? 0xffffff : groundTheme.color,
    });
    if (!groundCanvasTex) {
      loadBillboardTexture(
        groundTheme.url,
        (tex) => {
          floorMat.map = tex;
          floorMat.color.setHex(groundTheme.color);
          floorMat.needsUpdate = true;
        },
        { repeat: true }
      );
    }
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.name = `portal_floor_${portal.id}`;
    floorMesh.position.set(0, 0, 1.0);
    floorMesh.renderOrder = 0;
    floorMesh.userData = {
      portalId: portal.id,
      pattern: artSpec.pattern,
      groundColor: groundTheme.color,
    };
    this.realmGroup.add(floorMesh);

    // 2. 3-Wall Wrap-Around Panoramic 2.5D Sky & Horizon Stage
    //    Tilted at `-0.593 rad` (`-34°`, parallel to all 2.5D leaned monuments and camera image plane)
    //    so `depthWrite: true` blocks outer-world clouds while NEVER intersecting any North Terrace spire!
    const skyH = 9.4;
    const skyGeo = new THREE.PlaneGeometry(26, skyH);
    skyGeo.translate(0, skyH / 2, 0);
    const skyTex = buildPortalSkyBackdropTexture(portal);
    const skyMat = new THREE.MeshBasicMaterial({
      map: skyTex || null,
      color: 0xffffff,
      side: THREE.DoubleSide,
      depthWrite: true,
    });
    const skyWall = new THREE.Mesh(skyGeo, skyMat);
    skyWall.name = `portal_sky_backdrop_${portal.id}`;
    skyWall.position.set(0, -0.35, -9.1);
    skyWall.rotation.x = -0.593;
    skyWall.renderOrder = 0;
    this.realmGroup.add(skyWall);

    // Left & Right Wrap-Around Panoramic Horizon Wings (eliminates dark void at screen edges)
    const wingGeo = new THREE.PlaneGeometry(18, skyH);
    wingGeo.translate(0, skyH / 2, 0);
    const leftSkyWing = new THREE.Mesh(wingGeo, skyMat);
    leftSkyWing.name = `portal_sky_wing_left_${portal.id}`;
    leftSkyWing.position.set(-13.2, -0.35, -2.2);
    leftSkyWing.rotation.y = 0.62;
    leftSkyWing.rotation.x = -0.42;
    leftSkyWing.renderOrder = 0;
    this.realmGroup.add(leftSkyWing);

    const rightSkyWing = new THREE.Mesh(wingGeo, skyMat);
    rightSkyWing.name = `portal_sky_wing_right_${portal.id}`;
    rightSkyWing.position.set(13.2, -0.35, -2.2);
    rightSkyWing.rotation.y = -0.62;
    rightSkyWing.rotation.x = -0.42;
    rightSkyWing.renderOrder = 0;
    this.realmGroup.add(rightSkyWing);

    // 2b. True 36×36 Village Tile Grid, Canal Footbridge, Overlook Balustrade & Season Couture Showcase
    this.buildTiledRoomArchitecture(portal);
    this.buildSeasonCoutureShowcase(portal.id);

    // 3. Couple Viewing Spot (`x = 0, z = +1.5`) — Ornate Plaza Medallion & Rose-Gold Magic Circle (zero floating text box!)
    const coupleGroup = new THREE.Group();
    coupleGroup.name = 'couple_viewing_spot';
    coupleGroup.position.set(0, 0, 1.5);
    coupleGroup.userData = {
      landmarkId: 'couple_viewing_spot',
      action: 'couple_pose',
    };

    coupleGroup.add(
      makeFloorDecal('/assets/village/decal_plaza_medallion_circle.png', 2.8, 2.8, {
        x: 0,
        y: 0.022,
        z: 0,
        opacity: 0.96,
        renderOrder: 4,
        factor: -3,
        name: 'couple_plaza_medallion',
      })
    );

    const heartCircle = makeFloorDecal('/assets/ui/fx_magic_circle.png', 2.6, 2.6, {
      x: 0,
      y: 0.026,
      z: 0,
      opacity: 0.72,
      renderOrder: 5,
      factor: -4,
      color: 0xffa6c9,
      additive: true,
      name: 'couple_heart_circle',
    });
    coupleGroup.add(heartCircle);
    this.realmGroup.add(coupleGroup);

    // 4. V1/V2 Memory Reference Easel on the North-West Plaza Corner (`x = -2.8, z = -2.2`)
    const easelGroup = new THREE.Group();
    easelGroup.name = 'portal_v1_reference_easel';
    easelGroup.position.set(-2.8, 0, -2.2);
    easelGroup.userData = {
      landmarkId: 'portal_v1_compare',
      action: 'compare_v1',
    };
    this.addRealmSprite(easelGroup, '/assets/museum/museum_v1_v2_easel.png', 1.45, 1.8, {
      x: 0,
      y: 0,
      z: 0,
      worldZ: -2.2,
      name: 'portal_v1_easel_frame',
    });
    this.realmGroup.add(easelGroup);

    // 5. Return to Museum Hall Archway (`x = 7.8, z = 6.2` on its own Cream-Stone Grid Plot)
    const returnGroup = new THREE.Group();
    returnGroup.name = 'portal_exit_arch';
    returnGroup.position.set(7.8, 0, 6.2);
    returnGroup.userData = {
      landmarkId: 'exit_portal',
      action: 'exit_portal',
    };
    returnGroup.add(
      makeFloorDecal('/assets/terrain/road_cream.png', 2.2, 1.8, {
        x: 0,
        y: 0.015,
        z: 0.08,
        opacity: 0.96,
        renderOrder: 1,
        color: artSpec.creamColor,
        name: 'portal_return_pad',
      })
    );
    const returnArchH = 2.85;
    this.addRealmSprite(returnGroup, '/assets/ui/museum_portal_frame_gold.png', 2.2, returnArchH, {
      x: 0,
      y: 0,
      z: 0,
      worldZ: 6.2,
      name: 'portal_return_arch_sprite',
    });
    const returnPlaque = makePortalPlaqueSprite('🌀 Back to Hall', {
      scaleW: 1.55,
      scaleH: 0.34,
    });
    returnPlaque.position.set(0, returnArchH * 0.82 + 0.2, -returnArchH * 0.57);
    returnGroup.add(returnPlaque);
    this.realmGroup.add(returnGroup);

    // 6. Build Portal-Specific 2.5D Props & Diorama for All 16 Conceptual Worlds
    if (portal.id === 'fuji') {
      this.buildFuji25DWorld();
    } else if (portal.id === 'paris') {
      this.buildParis25DWorld();
    } else if (portal.id === 'swiss') {
      this.buildSwiss25DWorld();
    } else if (portal.id === 'dubai') {
      this.buildDubai25DWorld();
    } else if (portal.id === 'maldives') {
      this.buildMaldives25DWorld();
    } else if (portal.id === 'cabin') {
      this.buildCabin25DWorld();
    } else if (portal.id === 'bangkok') {
      this.buildBangkok25DWorld();
    } else if (portal.id === 'montecarlo') {
      this.buildMonteCarlo25DWorld();
    } else if (portal.id === 'atlantis') {
      this.buildAtlantis25DWorld();
    } else if (portal.id === 'starlight') {
      this.buildStarlight25DWorld();
    } else if (portal.id === 'fairytale') {
      this.buildFairytale25DWorld();
    } else if (portal.id === 'permafrost') {
      this.buildPermafrost25DWorld();
    } else if (portal.id === 'luxor') {
      this.buildLuxor25DWorld();
    } else if (portal.id === 'venice') {
      this.buildVenice25DWorld();
    } else if (portal.id === 'olympus') {
      this.buildOlympus25DWorld();
    } else if (portal.id === 'cat_lounge') {
      this.buildCatLounge25DWorld();
    }
  }

  /**
   * True 36 × 36 (1m × 1m cell) Bespoke Art-Directed Village Tile Grid, North Horizon Water Canal & Footbridge,
   * Overlook Marble Balustrade, Raised Road Curbs, and Floating Sky-Island Cliff Rim for every Portal Room.
   */
  buildTiledRoomArchitecture(portal) {
    const artSpec = getPortalFloorArtDirection(portal.id);
    const archGroup = new THREE.Group();
    archGroup.name = `portal_tile_foundation_${portal.id}`;
    archGroup.userData = {
      portalId: portal.id,
      pattern: artSpec.pattern,
      artSpec,
    };

    const S = NOOK_MUSEUM.SIZE;
    const Y_WATER = 0.006;
    const Y_ROAD = 0.012;
    const Y_BRIDGE = 0.02;
    const ox = -S / 2;
    const oz = -S / 2;
    const cellCenter = (gx, gy) => ({ x: ox + gx + 0.5, z: oz + gy + 0.5 });
    const isIndoor = artSpec.indoor;

    const tileMap = buildPortalTileMap(portal.id, S);

    // Group cells by tile type and create 1 merged mesh per type
    const byType = {};
    for (const [key, type] of tileMap.entries()) {
      const [gx, gy] = key.split(',').map(Number);
      (byType[type] ||= []).push([gx, gy]);
    }

    const tileDefs = {
      cobble: { url: '/assets/terrain/road_cobble.png', y: Y_ROAD, color: artSpec.cobbleColor },
      cream: { url: '/assets/terrain/road_cream.png', y: Y_ROAD, color: artSpec.creamColor },
      sakura: { url: '/assets/terrain/road_sakura.png', y: Y_ROAD, color: artSpec.sakuraColor },
      bridge: { url: '/assets/terrain/road_cobble.png', y: Y_BRIDGE, color: artSpec.bridgeColor },
      water: { url: '/assets/terrain/water_canal.png', y: Y_WATER, color: artSpec.waterColor, water: true },
    };

    for (const [type, cells] of Object.entries(byType)) {
      const def = tileDefs[type];
      if (!def || !cells.length) continue;
      const canvasTex = createPortalTileCanvasTexture(portal.id, type, artSpec);
      const mat = new THREE.MeshBasicMaterial({
        map: canvasTex || null,
        color: canvasTex ? 0xffffff : def.color,
        transparent: Boolean(def.water),
        opacity: def.water ? 0.96 : 1,
      });
      if (!canvasTex) {
        loadBillboardTexture(
          def.url,
          (tex) => {
            mat.map = tex;
            mat.color.setHex(def.color);
            mat.needsUpdate = true;
          },
          { repeat: true }
        );
      }
      const mesh = new THREE.Mesh(museumCellsGeometry(cells, def.y, 0.5, S), mat);
      mesh.name = `portal_tiles_${type}`;
      mesh.userData = {
        portalId: portal.id,
        tileType: type,
        tileColor: def.color,
        cellCount: cells.length,
        pattern: artSpec.pattern,
      };
      archGroup.add(mesh);
    }

    // 7. Merged 3D Raised Road Curbs (`artSpec.curbColor`) & Wildflower/Clover Overhang Tufts (only in lush worlds)
    const curbGeos = [];
    const tuftUrls = [
      '/assets/village/decal_grass_daisies_b.png',
      '/assets/village/decal_grass_clover_a.png',
      '/assets/village/decal_grass_blossom_c.png',
    ];
    for (const [key, type] of tileMap.entries()) {
      if (type === 'water' || type === 'bridge') continue;
      const [gx, gy] = key.split(',').map(Number);
      const c = cellCenter(gx, gy);
      const westGrass = !tileMap.has(`${gx - 1},${gy}`);
      const eastGrass = !tileMap.has(`${gx + 1},${gy}`);
      const northGrass = !tileMap.has(`${gx},${gy - 1}`);
      const southGrass = !tileMap.has(`${gx},${gy + 1}`);
      if (westGrass) {
        curbGeos.push(new THREE.BoxGeometry(0.09, 0.035, 1.02).translate(c.x - 0.46, Y_ROAD + 0.015, c.z));
        if (artSpec.hasGrassTufts && (gx + gy) % 3 === 0) {
          const tuft = tuftUrls[(gx + gy) % tuftUrls.length];
          this.addRealmSprite(archGroup, tuft, 0.5, 0.4, {
            x: c.x - 0.48,
            y: 0,
            z: c.z + 0.1,
            name: 'portal_curb_tuft',
          });
        }
      }
      if (eastGrass) {
        curbGeos.push(new THREE.BoxGeometry(0.09, 0.035, 1.02).translate(c.x + 0.46, Y_ROAD + 0.015, c.z));
        if (artSpec.hasGrassTufts && (gx + gy) % 3 === 1) {
          const tuft = tuftUrls[(gx + gy) % tuftUrls.length];
          this.addRealmSprite(archGroup, tuft, 0.5, 0.4, {
            x: c.x + 0.48,
            y: 0,
            z: c.z + 0.1,
            name: 'portal_curb_tuft',
          });
        }
      }
      if (northGrass) {
        curbGeos.push(new THREE.BoxGeometry(1.02, 0.035, 0.09).translate(c.x, Y_ROAD + 0.015, c.z - 0.46));
      }
      if (southGrass) {
        curbGeos.push(new THREE.BoxGeometry(1.02, 0.035, 0.09).translate(c.x, Y_ROAD + 0.015, c.z + 0.46));
      }
    }
    if (curbGeos.length) {
      const curbMat = new THREE.MeshBasicMaterial({ color: artSpec.curbColor });
      const curbMesh = new THREE.Mesh(mergeStaticGeometries(curbGeos), curbMat);
      curbMesh.name = 'portal_road_curbs';
      curbMesh.userData = { curbColor: artSpec.curbColor };
      curbMesh.matrixAutoUpdate = false;
      curbMesh.updateMatrix();
      archGroup.add(curbMesh);
    }

    // 8. Central Canal Footbridge Curbs, Pillar Caps, Water Lilies & River Boulders (for outdoor portals)
    if (!isIndoor) {
      const bridgeCells = byType.bridge || [];
      const railGeos = [];
      for (const [gx, gy] of bridgeCells) {
        const c = cellCenter(gx, gy);
        if (tileMap.get(`${gx - 1},${gy}`) === 'water') {
          railGeos.push(new THREE.BoxGeometry(0.14, 0.2, 1.02).translate(c.x - 0.44, 0.11, c.z));
          if (gy === 10 || gy === 12) {
            this.addRealmSprite(archGroup, '/assets/village/env_bridge_pillar_cap.png', 0.34, 0.44, {
              x: c.x - 0.46,
              y: 0,
              z: c.z + (gy === 10 ? -0.36 : 0.38),
              name: 'portal_bridge_pillar_cap',
            });
          }
        }
        if (tileMap.get(`${gx + 1},${gy}`) === 'water') {
          railGeos.push(new THREE.BoxGeometry(0.14, 0.2, 1.02).translate(c.x + 0.44, 0.11, c.z));
          if (gy === 10 || gy === 12) {
            this.addRealmSprite(archGroup, '/assets/village/env_bridge_pillar_cap.png', 0.34, 0.44, {
              x: c.x + 0.46,
              y: 0,
              z: c.z + (gy === 10 ? -0.36 : 0.38),
              name: 'portal_bridge_pillar_cap',
            });
          }
        }
      }
      if (railGeos.length) {
        const railMat = new THREE.MeshBasicMaterial({ color: artSpec.bridgeCurbColor });
        const railMesh = new THREE.Mesh(mergeStaticGeometries(railGeos), railMat);
        railMesh.name = 'portal_bridge_curbs';
        railMesh.userData = { bridgeCurbColor: artSpec.bridgeCurbColor };
        railMesh.matrixAutoUpdate = false;
        railMesh.updateMatrix();
        archGroup.add(railMesh);
      }

      const waterCells = byType.water || [];
      const bankGeos = [];
      waterCells.forEach(([gx, gy], idx) => {
        const c = cellCenter(gx, gy);
        if (artSpec.hasCanalFlora && gy === 11 && idx % 3 === 1) {
          const lily =
            idx % 2 === 0
              ? '/assets/village/decal_water_lily_white.png'
              : '/assets/village/decal_water_lotus_pink.png';
          this.addRealmSprite(archGroup, lily, 0.62, 0.5, {
            x: c.x,
            y: 0.01,
            z: c.z + 0.06,
            name: 'portal_canal_lily',
          });
        }
        if (gy === 10) {
          bankGeos.push(new THREE.BoxGeometry(1.02, 0.04, 0.11).translate(c.x, Y_WATER + 0.015, c.z - 0.46));
          if (gx === 8 || gx === 27) {
            this.addRealmSprite(archGroup, '/assets/village/env_river_boulders_a.png', 0.88, 0.74, {
              x: c.x,
              y: 0,
              z: c.z - 0.35,
              name: 'portal_canal_bank_prop',
            });
          }
        }
        if (gy === 12) {
          bankGeos.push(new THREE.BoxGeometry(1.02, 0.04, 0.11).translate(c.x, Y_WATER + 0.015, c.z + 0.46));
          if (artSpec.hasCanalFlora && (gx === 12 || gx === 23)) {
            this.addRealmSprite(archGroup, '/assets/village/env_river_cattails.png', 0.82, 0.72, {
              x: c.x,
              y: 0,
              z: c.z + 0.42,
              name: 'portal_canal_bank_prop',
            });
          }
        }
      });
      if (bankGeos.length) {
        const bankMat = new THREE.MeshBasicMaterial({ color: artSpec.bankColor });
        const bankMesh = new THREE.Mesh(mergeStaticGeometries(bankGeos), bankMat);
        bankMesh.name = 'portal_canal_banks';
        bankMesh.userData = { bankColor: artSpec.bankColor };
        bankMesh.matrixAutoUpdate = false;
        bankMesh.updateMatrix();
        archGroup.add(bankMesh);
      }

      // Classical Marble Balustrade Railings along the North Overlook Promenade (`z = -4.6`)
      for (const bx of [-7.5, -4.6, 4.6, 7.5]) {
        this.addRealmSprite(archGroup, '/assets/ui/th_balustrade_marble.png', 2.6, 0.95, {
          x: bx,
          y: 0,
          z: -4.6,
          worldZ: -4.6,
          name: 'terrace_horizon_balustrade',
        });
      }
    }

    // 9. Floating Sky-Island Cliff Rim & South Cliff Wall (`z = +10.5`) tinted per world
    const southEdgeZ = 10.5;
    const wallMat = new THREE.MeshBasicMaterial({
      color: artSpec.cliffWallColor,
      transparent: false,
      alphaTest: 0.35,
      side: THREE.FrontSide,
    });
    const rimMat = new THREE.MeshBasicMaterial({
      color: artSpec.cliffRimColor,
      transparent: true,
      alphaTest: 0.02,
      depthWrite: false,
      side: THREE.FrontSide,
    });
    loadBillboardTexture('/assets/village/cliff_wall_strip.png', (tex) => {
      wallMat.map = tex;
      wallMat.color.setHex(artSpec.cliffWallColor);
      wallMat.needsUpdate = true;
    });
    loadBillboardTexture('/assets/village/cliff_rim_turf_strip.png', (tex) => {
      rimMat.map = tex;
      rimMat.color.setHex(artSpec.cliffRimColor);
      rimMat.needsUpdate = true;
    });

    const segCount = 6;
    const spanW = 28;
    const segW = spanW / segCount + 0.55;
    const rimGeos = [];
    const wallGeos = [];
    for (let i = 0; i < segCount; i++) {
      const offset = ((i + 0.5) / segCount - 0.5) * spanW;
      rimGeos.push(
        new THREE.PlaneGeometry(segW, 1.45).rotateX(-Math.PI / 2).translate(offset, 0.014, southEdgeZ)
      );
      wallGeos.push(
        new THREE.PlaneGeometry(segW, 2.95).rotateX(-0.06).translate(offset, -1.05, southEdgeZ + 0.14 + i * 0.01)
      );
    }
    const rimMesh = new THREE.Mesh(mergeStaticGeometries(rimGeos), rimMat);
    rimMesh.name = 'terrace_south_cliff_rim';
    rimMesh.renderOrder = 2;
    archGroup.add(rimMesh);

    const wallMesh = new THREE.Mesh(mergeStaticGeometries(wallGeos), wallMat);
    wallMesh.name = 'terrace_south_cliff_wall';
    archGroup.add(wallMesh);

    for (const [cx, cy, cz, cw, ch, url, mir] of [
      [-8.5, -2.35, southEdgeZ + 0.55, 4.8, 2.6, '/assets/village/env_cloud_fluffy_b.png', true],
      [0, -2.45, southEdgeZ + 0.65, 5.2, 2.8, '/assets/village/env_cloud_fluffy_a.png', false],
      [8.5, -2.35, southEdgeZ + 0.55, 4.8, 2.6, '/assets/village/env_cloud_fluffy_b.png', false],
    ]) {
      archGroup.add(
        makeBillboardPlane(url, cw, ch, {
          x: cx,
          y: cy,
          z: cz,
          pitch: -0.06,
          opacity: 0.9,
          depthWrite: false,
          lean: false,
          mirror: mir,
          name: 'portal_south_cliff_cloud',
        })
      );
    }

    this.realmGroup.add(archGroup);
  }

  /**
   * Places the Season's His & Hers V1 Mythic Costume Standees on marble-and-gold pedestals inside the room
   * so Nook & Neen can admire the Season's iconic outfits right inside that Season's 2.5D world!
   */
  buildSeasonCoutureShowcase(portalId) {
    const exhibit = MUSEUM_GACHA_EXHIBITS.find((ex) => ex.portalId === portalId);
    if (!exhibit) return;
    const artSpec = getPortalFloorArtDirection(portalId);

    const showcaseGroup = new THREE.Group();
    showcaseGroup.name = `season_couture_showcase_${portalId}`;
    showcaseGroup.position.set(-7.6, 0, 5.4);
    showcaseGroup.userData = {
      landmarkId: `exhibit_${portalId}`,
      action: `exhibit:${exhibit.id}`,
    };

    showcaseGroup.add(
      makeFloorDecal('/assets/terrain/road_sakura.png', 2.8, 1.8, {
        x: 0,
        y: 0.015,
        z: 0.05,
        opacity: 0.96,
        renderOrder: 1,
        color: artSpec.sakuraColor,
        name: `couture_pad_${portalId}`,
      })
    );

    const plinthMat = new THREE.MeshStandardMaterial({ color: 0xf6eee0, roughness: 0.32, metalness: 0.18 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xe6b44c, roughness: 0.25, metalness: 0.65 });

    for (const [dx, spriteUrl, roleName] of [
      [-0.78, exhibit.maleSprite, `couture_male_${portalId}`],
      [0.78, exhibit.femaleSprite, `couture_female_${portalId}`],
    ]) {
      const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.72, 0.2, 20), plinthMat);
      ped.position.set(dx, 0.1, 0);
      showcaseGroup.add(ped);

      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.66, 0.04, 20), goldMat);
      rim.position.set(dx, 0.21, 0);
      showcaseGroup.add(rim);

      this.addRealmSprite(showcaseGroup, spriteUrl, 1.32, 1.72, {
        x: dx,
        y: 0.22,
        z: 0,
        worldZ: 5.4,
        name: roleName,
      });
    }

    const coutureH = 1.96;
    const plaque = makePortalPlaqueSprite(`${exhibit.icon} ${exhibit.season} Couture`, {
      scaleW: 1.68,
      scaleH: 0.36,
    });
    plaque.position.set(0, coutureH * 0.82 + 0.2, -coutureH * 0.57);
    showcaseGroup.add(plaque);

    this.realmGroup.add(showcaseGroup);
  }

  /**
   * 1. `fuji` — S2 Kyoto Mount Fuji & Sakura Shrine Deck (Village-Grid Pixel-Perfect Layout)
   */
  buildFuji25DWorld() {
    // 1. Subtle North Terrace Coping Ledge at `z = -8.0` (kept for test contract, out of foreground walkway)
    const beamMat = new THREE.MeshStandardMaterial({ color: 0xeee0c8, roughness: 0.55, metalness: 0.08 });
    const engawaBeam = new THREE.Mesh(new THREE.BoxGeometry(12, 0.05, 0.14), beamMat);
    engawaBeam.name = 'fuji_engawa_step_ledge';
    engawaBeam.position.set(0, 0.02, -8.0);
    this.realmGroup.add(engawaBeam);

    // 2. Majestic Snow-Capped Mount Fuji (`fuji_mountain_horizon.png`) on the North Horizon (parallel `-34°` plane at `z = -8.85`)
    this.addRealmSprite(this.realmGroup, '/assets/ui/fuji_mountain_horizon.png', 13.8, 6.8, {
      x: 0,
      y: -0.2,
      z: -8.85,
      worldZ: -8.85,
      lean: true,
      name: 'fuji_mountain_horizon',
    });

    // 3. Midground 5-Story Kyoto Pagoda (`fuji_kyoto_pagoda_hill.png`) & Japanese Tea Pavilion (`wnd_tea_pavilion.png`)
    this.addRealmSprite(this.realmGroup, '/assets/ui/fuji_kyoto_pagoda_hill.png', 3.6, 4.0, {
      x: 4.4,
      y: 0,
      z: -8.2,
      worldZ: -8.2,
      name: 'fuji_kyoto_pagoda_hill',
    });
    this.addRealmSprite(this.realmGroup, '/assets/village/wnd_tea_pavilion.png', 3.2, 2.8, {
      x: -4.4,
      y: 0,
      z: -8.0,
      worldZ: -8.0,
      name: 'fuji_tea_pavilion_west',
    });

    // 4. Vermilion Torii Gates (`fuji_torii_gate_primary` & `fuji_torii_gate_secondary`) & Right Onsen Sanctuary (`wnd_onsen.png`)
    this.addRealmSprite(this.realmGroup, '/assets/ui/fuji_torii_gate_red.png', 2.7, 3.0, {
      x: -3.4,
      y: 0,
      z: 0.8,
      worldZ: 0.8,
      name: 'fuji_torii_gate_primary',
    });
    this.addRealmSprite(this.realmGroup, '/assets/ui/fuji_torii_gate_red.png', 2.4, 2.7, {
      x: -4.8,
      y: 0,
      z: -3.6,
      worldZ: -3.6,
      name: 'fuji_torii_gate_secondary',
    });
    this.addRealmSprite(this.realmGroup, '/assets/village/wnd_onsen.png', 2.6, 2.3, {
      x: 3.4,
      y: 0,
      z: 0.8,
      worldZ: 0.8,
      name: 'fuji_onsen_bath',
    });
    this.addRealmSprite(this.realmGroup, '/assets/village/dec_bamboo_shishi_odoshi.png', 1.15, 1.25, {
      x: 4.6,
      y: 0,
      z: -3.6,
      worldZ: -3.6,
      name: 'fuji_bamboo_fountain',
    });

    // 5. Paired Stone Toro Lanterns (`fuji_stone_lantern_front` & `fuji_stone_lantern_mid`) with warm amber halos
    const lanternSpecs = [
      [-2.35, 2.3, 1.15, 1.55, 'fuji_stone_lantern_front'],
      [2.35, 2.3, 1.15, 1.55, 'fuji_stone_lantern_mid'],
    ];
    for (const [lx, lz, lw, lh, lname] of lanternSpecs) {
      this.addRealmSprite(this.realmGroup, '/assets/ui/fuji_stone_lantern_toro.png', lw, lh, {
        x: lx,
        y: 0,
        z: lz,
        worldZ: lz + 0.05,
        name: lname,
      });

      const halo = makeGlowSprite(lw * 1.15, '#ffcf70', 0.8, lz + 0.1);
      halo.name = `${lname}_halo`;
      halo.position.set(lx, lh * 0.62, lz + 0.1);
      this.realmGroup.add(halo);
    }

    // 6. Village-Scaled Blooming Sakura Trees framing the Kyoto Courtyard
    const sakuraTrees = [
      [-6.8, -3.8, 2.4, 2.6, '/assets/village/env_tree_sakura_b.png', false],
      [6.8, -3.8, 2.4, 2.6, '/assets/village/env_tree_sakura_a.png', true],
      [-6.4, 2.0, 2.3, 2.5, '/assets/village/env_tree_sakura_a.png', false],
      [6.4, 2.0, 2.3, 2.5, '/assets/village/env_tree_sakura_b.png', true],
      [-8.8, -1.0, 2.5, 2.7, '/assets/village/env_tree_sakura_b.png', true],
      [8.8, -1.0, 2.5, 2.7, '/assets/village/env_tree_sakura_a.png', false],
    ];
    for (const [tx, tz, tw, th, url, mirror] of sakuraTrees) {
      this.addRealmSprite(this.realmGroup, url, tw, th, {
        x: tx,
        y: 0,
        z: tz,
        worldZ: tz,
        mirror,
        name: 'fuji_sakura_canopy_tree',
      });
    }

    // 7. 3D Drifting Sakura Petals (`this.petalSystem` — 70 gentle floating pink sakura petals)
    this.buildPortalWeatherParticles('fuji');
  }

  buildPortalWeatherParticles(portalId = 'fuji') {
    const weatherSpec = {
      fuji: { color: 0xffbfd6, w: 0.18, h: 0.12, vx: -0.38, vy: -0.3, upward: false },
      paris: { color: 0xffe29c, w: 0.14, h: 0.14, vx: 0.08, vy: 0.24, upward: true },
      swiss: { color: 0xf2f7ff, w: 0.15, h: 0.15, vx: -0.18, vy: -0.36, upward: false },
      dubai: { color: 0xffcb6b, w: 0.14, h: 0.14, vx: 0.14, vy: 0.28, upward: true },
      maldives: { color: 0x7ef9ea, w: 0.15, h: 0.15, vx: 0.1, vy: 0.2, upward: true },
      cabin: { color: 0xffe79e, w: 0.13, h: 0.13, vx: 0.06, vy: 0.18, upward: true },
      bangkok: { color: 0xffc864, w: 0.16, h: 0.16, vx: 0.12, vy: 0.28, upward: true },
      montecarlo: { color: 0xffe49e, w: 0.14, h: 0.14, vx: 0.08, vy: 0.22, upward: true },
      atlantis: { color: 0x6cf7ec, w: 0.17, h: 0.17, vx: 0.06, vy: 0.32, upward: true },
      starlight: { color: 0xd9b8ff, w: 0.15, h: 0.15, vx: 0.1, vy: 0.24, upward: true },
      fairytale: { color: 0xffba52, w: 0.22, h: 0.26, vx: 0.09, vy: 0.36, upward: true },
      permafrost: { color: 0xb8f2ff, w: 0.16, h: 0.16, vx: -0.22, vy: -0.34, upward: false },
      luxor: { color: 0xffd268, w: 0.14, h: 0.14, vx: 0.16, vy: 0.22, upward: true },
      venice: { color: 0xff6b8b, w: 0.18, h: 0.13, vx: -0.28, vy: -0.26, upward: false },
      olympus: { color: 0xfff0a8, w: 0.16, h: 0.16, vx: 0.1, vy: 0.26, upward: true },
      cat_lounge: { color: 0xffb8d8, w: 0.16, h: 0.16, vx: 0.07, vy: 0.2, upward: true },
    }[portalId] || { color: 0xffbfd6, w: 0.18, h: 0.12, vx: -0.35, vy: -0.28, upward: false };

    const petalGroup = new THREE.Group();
    petalGroup.name = portalId === 'fuji' ? 'fuji_sakura_petal_system' : `portal_weather_${portalId}`;
    const petalGeo = new THREE.PlaneGeometry(weatherSpec.w, weatherSpec.h);
    const petalMat = new THREE.MeshBasicMaterial({
      color: weatherSpec.color,
      transparent: true,
      opacity: 0.88,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    for (let i = 0; i < 70; i++) {
      const pMesh = new THREE.Mesh(petalGeo, petalMat);
      pMesh.position.set(
        (Math.random() - 0.5) * 24,
        0.6 + Math.random() * 6.5,
        -10 + Math.random() * 16
      );
      pMesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      pMesh.userData = {
        vx: weatherSpec.vx + (Math.random() - 0.5) * 0.25,
        vy: weatherSpec.vy + (weatherSpec.upward ? Math.random() * 0.18 : -Math.random() * 0.24),
        vz: (Math.random() - 0.5) * 0.22,
        upward: weatherSpec.upward,
        phase: Math.random() * Math.PI * 2,
      };
      petalGroup.add(pMesh);
      this.petalParticles.push(pMesh);
    }
    this.petalSystem = petalGroup;
    this.realmGroup.add(petalGroup);
  }

  /**
   * 2. `paris` — S3 Paris Moonlit Eiffel Tower & Seine Promenade
   */
  buildParis25DWorld() {
    // Horizon: Glowing Eiffel Tower Spire (`museum_paris_eiffel_spire.png`) on the North Terrace behind the Seine canal bridge
    this.addRealmSprite(this.realmGroup, '/assets/ui/museum_paris_eiffel_spire.png', 4.4, 5.4, {
      x: 0,
      y: 0,
      z: -8.4,
      worldZ: -8.4,
      name: 'paris_eiffel_tower_spire',
    });

    // Midground Overlook Left & Right: Parisian Patisserie (`bld_patisserie.png`) & Wisteria Pergola (`th_garden_wisteria_pergola.png`)
    this.addRealmSprite(this.realmGroup, '/assets/village/bld_patisserie.png', 3.0, 2.8, {
      x: -4.8,
      y: 0,
      z: -3.6,
      worldZ: -3.6,
      name: 'paris_patisserie_cafe',
    });
    this.addRealmSprite(this.realmGroup, '/assets/ui/th_garden_wisteria_pergola.png', 2.8, 2.7, {
      x: 4.8,
      y: 0,
      z: -3.6,
      worldZ: -3.6,
      name: 'paris_wisteria_pergola',
    });

    // Foreground Left & Right Lounge Plots (`x = ±3.4, z = 0.8`): Rose Flower Cart & Romantic Seine Picnic Set
    this.addRealmSprite(this.realmGroup, '/assets/village/dec_flower_cart.png', 2.2, 2.0, {
      x: -3.4,
      y: 0,
      z: 0.8,
      worldZ: 0.8,
      name: 'paris_rose_flower_cart',
    });
    this.addRealmSprite(this.realmGroup, '/assets/village/dec_picnic.png', 2.4, 1.85, {
      x: 3.4,
      y: 0,
      z: 0.8,
      worldZ: 0.8,
      name: 'paris_bistro_table',
    });
    this.addRealmSprite(this.realmGroup, '/assets/village/dec_gramophone.png', 1.1, 1.35, {
      x: 2.35,
      y: 0,
      z: -1.8,
      worldZ: -1.8,
      name: 'paris_gramophone',
    });

    // Parisian Double Streetlamps & Rose Bushes along the Cobblestone Avenue
    for (const [lx, lz] of [[-2.35, -2.8], [2.35, -2.8], [-2.35, 2.6], [2.35, 2.6]]) {
      this.addRealmSprite(this.realmGroup, '/assets/village/env_streetlamp_double.png', 0.72, 1.58, {
        x: lx,
        y: 0,
        z: lz,
        worldZ: lz,
        name: 'paris_quayside_streetlamp',
      });
    }
    for (const [bx, bz] of [[-3.4, 2.3], [3.4, 2.3]]) {
      this.addRealmSprite(this.realmGroup, '/assets/village/env_bush_roses_pink.png', 1.05, 0.78, {
        x: bx,
        y: 0,
        z: bz,
        worldZ: bz,
        name: 'paris_rose_planter',
      });
    }
    for (const [tx, tz, mir] of [[-6.8, -1.6, false], [6.8, -1.6, true], [-6.6, 2.2, true], [6.6, 2.2, false]]) {
      this.addRealmSprite(this.realmGroup, '/assets/village/env_tree_oak_a.png', 2.2, 2.4, {
        x: tx,
        y: 0,
        z: tz,
        worldZ: tz,
        mirror: mir,
        name: 'paris_seine_tree',
      });
    }
    this.buildPortalWeatherParticles('paris');
  }

  /**
   * 3. `swiss` — S12 Swiss Alps Starry Matterhorn & Snow Chalet
   */
  buildSwiss25DWorld() {
    // Horizon: Cozy Timber Chalet (`museum_swiss_matterhorn_chalet.png`) on the North Terrace with Starry Matterhorn sky behind
    this.addRealmSprite(this.realmGroup, '/assets/ui/museum_swiss_matterhorn_chalet.png', 4.8, 3.8, {
      x: 0,
      y: 0,
      z: -8.3,
      worldZ: -8.3,
      name: 'swiss_matterhorn_chalet_backdrop',
    });

    // Midground Overlook Left & Right: Alpine Windmill Bakery & Aurora Crystal Gazebo
    this.addRealmSprite(this.realmGroup, '/assets/village/bld_windmill_bakery.png', 2.8, 3.0, {
      x: -4.8,
      y: 0,
      z: -3.6,
      worldZ: -3.6,
      name: 'swiss_alpine_bakery',
    });
    this.addRealmSprite(this.realmGroup, '/assets/village/dec_aurora_crystal_gazebo.png', 2.7, 2.7, {
      x: 4.8,
      y: 0,
      z: -3.6,
      worldZ: -3.6,
      name: 'swiss_aurora_gazebo',
    });

    // Foreground Left & Right Lounge Plots (`x = ±3.4, z = 0.8`): Cozy Couple Swing & Warm Alpine Onsen Hearth
    this.addRealmSprite(this.realmGroup, '/assets/village/dec_swing.png', 2.3, 2.2, {
      x: -3.4,
      y: 0,
      z: 0.8,
      worldZ: 0.8,
      name: 'swiss_chalet_swing_bench',
    });
    this.addRealmSprite(this.realmGroup, '/assets/village/wnd_onsen.png', 2.6, 2.3, {
      x: 3.4,
      y: 0,
      z: 0.8,
      worldZ: 0.8,
      name: 'swiss_fireplace_hearth',
    });

    // Snow-Dusted Alpine Pine Trees (`/assets/village/env_tree_pine_snowy.png`)
    const pines = [
      [-6.8, -3.8, 2.1, 2.6, false],
      [6.8, -3.8, 2.1, 2.6, true],
      [-6.4, 2.0, 2.1, 2.6, true],
      [6.4, 2.0, 2.1, 2.6, false],
      [-8.6, -1.0, 2.2, 2.7, false],
      [8.6, -1.0, 2.2, 2.7, true],
    ];
    for (const [px, pz, pw, ph, mirror] of pines) {
      this.addRealmSprite(this.realmGroup, '/assets/village/env_tree_pine_snowy.png', pw, ph, {
        x: px,
        y: 0,
        z: pz,
        worldZ: pz,
        mirror,
        name: 'swiss_alpine_pine',
      });
    }
    for (const lx of [-2.35, 2.35]) {
      this.addRealmSprite(this.realmGroup, '/assets/village/env_streetlamp_double.png', 0.72, 1.58, {
        x: lx,
        y: 0,
        z: 2.6,
        worldZ: 2.6,
        name: 'swiss_lantern_post',
      });
    }
    this.buildPortalWeatherParticles('swiss');
  }

  /**
   * 4. `dubai` — S3 Dubai Starlit Arabian Terrace & Burj Khalifa
   */
  buildDubai25DWorld() {
    // Horizon: Burj Khalifa Skyline (`wnd_burj_khalifa.png`) & Golden Mirage Palace (`wnd_mirage_palace.png`) on the North Terrace
    this.addRealmSprite(this.realmGroup, '/assets/village/wnd_burj_khalifa.png', 3.8, 5.2, {
      x: 3.6,
      y: 0,
      z: -8.3,
      worldZ: -8.3,
      name: 'dubai_burj_khalifa_skyline',
    });
    this.addRealmSprite(this.realmGroup, '/assets/village/wnd_mirage_palace.png', 3.6, 3.3, {
      x: -3.6,
      y: 0,
      z: -8.2,
      worldZ: -8.2,
      name: 'dubai_mirage_palace',
    });

    // Midground Overlook Left & Right: Oasis Obelisk Fountain & Sultan Bazaar Canopy
    this.addRealmSprite(this.realmGroup, '/assets/village/dec_oasis_obelisk_fountain.png', 2.4, 2.7, {
      x: -4.8,
      y: 0,
      z: -3.6,
      worldZ: -3.6,
      name: 'dubai_infinity_fountain',
    });
    this.addRealmSprite(this.realmGroup, '/assets/village/dec_sultan_bazaar_canopy.png', 2.7, 2.4, {
      x: 4.8,
      y: 0,
      z: -3.6,
      worldZ: -3.6,
      name: 'dubai_bazaar_canopy',
    });

    // Foreground Left & Right Lounge Plots (`x = ±3.4, z = 0.8`): Dallah Majlis Table & Royal Divan Lounge
    this.addRealmSprite(this.realmGroup, '/assets/village/dec_dubai_dallah_majlis.png', 2.6, 2.1, {
      x: -3.4,
      y: 0,
      z: 0.8,
      worldZ: 0.8,
      name: 'dubai_dallah_majlis_table',
    });
    this.addRealmSprite(this.realmGroup, '/assets/ui/museum_s9_luxor_divan_lantern.png', 2.6, 2.2, {
      x: 3.4,
      y: 0,
      z: 0.8,
      worldZ: 0.8,
      mirror: true,
      name: 'dubai_royal_divan_lounge',
    });

    // Date Palms (`/assets/village/env_tree_palm_oasis.png`)
    for (const [px, pz, mir] of [[-6.8, -3.8, false], [6.8, -3.8, true], [-6.4, 2.0, true], [6.4, 2.0, false]]) {
      this.addRealmSprite(this.realmGroup, '/assets/village/env_tree_palm_oasis.png', 2.3, 2.8, {
        x: px,
        y: 0,
        z: pz,
        worldZ: pz,
        mirror: mir,
        name: 'dubai_terrace_palm',
      });
    }
    this.buildPortalWeatherParticles('dubai');
  }

  /**
   * 5. `maldives` — Maldives Sunset Overwater Bungalow Pier
   */
  buildMaldives25DWorld() {
    // Horizon: Overwater Bungalow Pier (`museum_maldives_bungalow_pier.png`) on the North Lagoon Terrace
    this.addRealmSprite(this.realmGroup, '/assets/ui/museum_maldives_bungalow_pier.png', 5.2, 3.8, {
      x: 0,
      y: 0,
      z: -8.3,
      worldZ: -8.3,
      name: 'maldives_overwater_bungalow_pier',
    });

    // Midground Overlook Left & Right: Turquoise Lagoon Oasis Pools (`th_garden_pond_oasis.png`)
    this.addRealmSprite(this.realmGroup, '/assets/ui/th_garden_pond_oasis.png', 2.8, 1.9, {
      x: -4.8,
      y: 0,
      z: -3.6,
      worldZ: -3.6,
      name: 'maldives_lagoon_pool_left',
    });
    this.addRealmSprite(this.realmGroup, '/assets/ui/th_garden_pond_oasis.png', 2.8, 1.9, {
      x: 4.8,
      y: 0,
      z: -3.6,
      worldZ: -3.6,
      mirror: true,
      name: 'maldives_lagoon_pool_right',
    });

    // Foreground Left & Right Lounge Plots (`x = ±3.4, z = 0.8`): Couple Hammock & Sunset Swing
    this.addRealmSprite(this.realmGroup, '/assets/village/dec_couple_hammock.png', 2.6, 2.0, {
      x: -3.4,
      y: 0,
      z: 0.8,
      worldZ: 0.8,
      name: 'maldives_couple_hammock',
    });
    this.addRealmSprite(this.realmGroup, '/assets/village/dec_swing.png', 2.3, 2.2, {
      x: 3.4,
      y: 0,
      z: 0.8,
      worldZ: 0.8,
      name: 'maldives_sunset_swing',
    });

    // Lagoon Palms (`/assets/village/env_tree_palm_oasis.png`)
    for (const [px, pz, mir] of [[-6.8, -3.8, false], [6.8, -3.8, true], [-6.4, 2.0, true], [6.4, 2.0, false]]) {
      this.addRealmSprite(this.realmGroup, '/assets/village/env_tree_palm_oasis.png', 2.4, 2.9, {
        x: px,
        y: 0,
        z: pz,
        worldZ: pz,
        mirror: mir,
        name: 'maldives_palm',
      });
    }
    this.buildPortalWeatherParticles('maldives');
  }

  /**
   * 6. `cabin` — NookAirline First-Class Sky Cabin Suite & Warm Hug
   */
  buildCabin25DWorld() {
    // Horizon: Original First-Class Sky Cabin Backdrop (`plane_cabin_wide.png`)
    this.addRealmSprite(this.realmGroup, '/assets/museum/v1/plane_cabin_wide.png', 17.5, 8.4, {
      x: 0,
      y: -0.2,
      z: -8.6,
      worldZ: -8.6,
      lean: true,
      name: 'cabin_wide_interior_wall',
    });

    // Midground Overlook: Royal Easel Frame holding the cherished Warm Hug portrait + Captain & Crew Greetings
    this.addRealmSprite(this.realmGroup, '/assets/ui/museum_easel_frame_royal.png', 1.85, 2.1, {
      x: 2.8,
      y: 0,
      z: -2.2,
      worldZ: -2.2,
      name: 'cabin_warm_hug_easel_frame',
    });
    this.addRealmSprite(this.realmGroup, '/assets/museum/v1/chibi_warm_hug.png', 1.12, 1.12, {
      x: 2.8,
      y: 0.46,
      z: -2.12,
      worldZ: -2.12,
      name: 'cabin_warm_hug_standee',
    });
    this.addRealmSprite(this.realmGroup, '/assets/museum/v1/pilot_captain.png', 1.35, 1.75, {
      x: -4.6,
      y: 0,
      z: -3.6,
      worldZ: -3.6,
      name: 'cabin_pilot_captain',
    });
    this.addRealmSprite(this.realmGroup, '/assets/museum/v1/emirates_crew.png', 1.35, 1.75, {
      x: 4.6,
      y: 0,
      z: -3.6,
      worldZ: -3.6,
      name: 'cabin_emirates_crew',
    });

    // Foreground Left & Right Lounge Plots (`x = ±3.4, z = 0.6`): First-Class Leather Suites & Sky Galley Dishes
    this.addRealmSprite(this.realmGroup, '/assets/ui/museum_firstclass_suite_seat.png', 2.4, 2.3, {
      x: -3.4,
      y: 0,
      z: 0.6,
      worldZ: 0.6,
      name: 'cabin_suite_seat_left',
    });
    this.addRealmSprite(this.realmGroup, '/assets/ui/museum_firstclass_suite_seat.png', 2.4, 2.3, {
      x: 3.4,
      y: 0,
      z: 0.6,
      worldZ: 0.6,
      mirror: true,
      name: 'cabin_suite_seat_right',
    });
    this.addRealmSprite(this.realmGroup, '/assets/museum/v1/dish_mango_rice.png', 0.82, 0.82, {
      x: -2.25,
      y: 0.15,
      z: 1.25,
      worldZ: 1.25,
      name: 'cabin_dish_mango_rice',
    });
    this.addRealmSprite(this.realmGroup, '/assets/museum/v1/dish_wagyu_steak.png', 0.82, 0.82, {
      x: 2.25,
      y: 0.15,
      z: 1.25,
      worldZ: 1.25,
      name: 'cabin_dish_wagyu_steak',
    });
    this.addRealmSprite(this.realmGroup, '/assets/museum/v1/dish_gold_mocktail.png', 0.74, 0.74, {
      x: 2.25,
      y: 0.15,
      z: 0.15,
      worldZ: 0.15,
      name: 'cabin_dish_gold_mocktail',
    });

    this.buildPortalWeatherParticles('cabin');
  }

  /**
   * 7. `bangkok` — S1 Bangkok Chao Phraya Naga Barge & Temple Terrace
   */
  buildBangkok25DWorld() {
    // Horizon: Royal Thai Golden Naga River Barge (`museum_bkk_naga_river_barge.png`) on the North River Terrace
    this.addRealmSprite(this.realmGroup, '/assets/ui/museum_bkk_naga_river_barge.png', 5.0, 4.2, {
      x: 0,
      y: 0,
      z: -8.3,
      worldZ: -8.3,
      name: 'bangkok_naga_river_barge',
    });

    // Midground Overlook Left & Right: Golden Thai Shrine & Pagoda Pavilion
    this.addRealmSprite(this.realmGroup, '/assets/village/bld_shrine.png', 3.0, 3.2, {
      x: -4.8,
      y: 0,
      z: -3.6,
      worldZ: -3.6,
      name: 'bangkok_riverside_shrine_left',
    });
    this.addRealmSprite(this.realmGroup, '/assets/village/wnd_sakura_pagoda.png', 3.0, 3.4, {
      x: 4.8,
      y: 0,
      z: -3.6,
      worldZ: -3.6,
      name: 'bangkok_riverside_pagoda_right',
    });

    // Foreground Left & Right Lounge Plots (`x = ±3.4, z = 0.8`): Floating Lotus Oasis Pond & Silk Sala Divan + Mango Sticky Rice
    this.addRealmSprite(this.realmGroup, '/assets/ui/th_garden_pond_oasis.png', 2.6, 1.8, {
      x: -3.4,
      y: 0,
      z: 0.8,
      worldZ: 0.8,
      name: 'bangkok_lotus_pond_left',
    });
    this.addRealmSprite(this.realmGroup, '/assets/ui/museum_s9_luxor_divan_lantern.png', 2.6, 2.2, {
      x: 3.4,
      y: 0,
      z: 0.8,
      worldZ: 0.8,
      name: 'bangkok_silk_sala_divan',
    });
    this.addRealmSprite(this.realmGroup, '/assets/museum/v1/dish_mango_rice.png', 0.85, 0.85, {
      x: 2.3,
      y: 0.12,
      z: 1.5,
      worldZ: 1.5,
      name: 'bangkok_mango_sticky_rice',
    });

    for (const [px, pz, mir] of [[-6.8, -3.6, false], [6.8, -3.6, true], [-6.4, 2.0, true], [6.4, 2.0, false]]) {
      this.addRealmSprite(this.realmGroup, '/assets/village/env_tree_palm_oasis.png', 2.3, 2.8, {
        x: px,
        y: 0,
        z: pz,
        worldZ: pz,
        mirror: mir,
        name: 'bangkok_river_palm',
      });
    }
    this.buildPortalWeatherParticles('bangkok');
  }

  /**
   * 8. `montecarlo` — S4 Casino Royale & Monte Carlo Harbor Balcony
   */
  buildMonteCarlo25DWorld() {
    // Horizon: Beaux-Arts Monte Carlo Casino Palace & Luxury Yachts (`museum_s4_casino_palace_horizon.png`)
    this.addRealmSprite(this.realmGroup, '/assets/ui/museum_s4_casino_palace_horizon.png', 5.4, 4.4, {
      x: 0,
      y: 0,
      z: -8.3,
      worldZ: -8.3,
      name: 'montecarlo_casino_palace_horizon',
    });

    // Midground Overlook Left & Right: West Casino Dome & VIP Roulette Wheel
    this.addRealmSprite(this.realmGroup, '/assets/village/wnd_casino_dome.png', 3.2, 3.0, {
      x: -4.8,
      y: 0,
      z: -3.6,
      worldZ: -3.6,
      name: 'montecarlo_west_casino_wing',
    });
    this.addRealmSprite(this.realmGroup, '/assets/ui/casino_roulette_wheel.png', 2.2, 1.9, {
      x: 4.8,
      y: 0,
      z: -3.6,
      worldZ: -3.6,
      name: 'montecarlo_roulette_wheel',
    });

    // Foreground Left & Right Lounge Plots (`x = ±3.4, z = 0.8`): Emerald Velvet Armchairs & Candelabrum (`museum_s4_montecarlo_balcony.png`)
    this.addRealmSprite(this.realmGroup, '/assets/ui/museum_s4_montecarlo_balcony.png', 2.6, 2.2, {
      x: -3.4,
      y: 0,
      z: 0.8,
      worldZ: 0.8,
      name: 'montecarlo_emerald_velvet_lounge_left',
    });
    this.addRealmSprite(this.realmGroup, '/assets/ui/museum_s4_montecarlo_balcony.png', 2.6, 2.2, {
      x: 3.4,
      y: 0,
      z: 0.8,
      worldZ: 0.8,
      mirror: true,
      name: 'montecarlo_emerald_velvet_lounge_right',
    });

    for (const lx of [-6.4, 6.4]) {
      this.addRealmSprite(this.realmGroup, '/assets/ui/th_garden_lantern_grove.png', 2.0, 2.4, {
        x: lx,
        y: 0,
        z: 2.0,
        worldZ: 2.0,
        name: 'montecarlo_balcony_lantern',
      });
    }
    this.buildPortalWeatherParticles('montecarlo');
  }

  /**
   * 9. `atlantis` — S5 Abyssal Atlantis Sunken Coral Lounge & Crystal Dome
   */
  buildAtlantis25DWorld() {
    // Horizon: Sunken Atlantis Marble Citadel with Glowing Glass Domes (`museum_s5_atlantis_citadel_dome.png`)
    this.addRealmSprite(this.realmGroup, '/assets/ui/museum_s5_atlantis_citadel_dome.png', 5.2, 4.4, {
      x: 0,
      y: 0,
      z: -8.3,
      worldZ: -8.3,
      name: 'atlantis_sunken_citadel_dome',
    });

    // Midground Overlook Left & Right: Coral Crystal Arch & Siren Shell Fountain
    this.addRealmSprite(this.realmGroup, '/assets/village/dec_coral_crystal_arch.png', 2.8, 2.8, {
      x: -4.8,
      y: 0,
      z: -3.6,
      worldZ: -3.6,
      name: 'atlantis_reef_pool_left',
    });
    this.addRealmSprite(this.realmGroup, '/assets/village/dec_siren_shell_fountain.png', 2.6, 2.6, {
      x: 4.8,
      y: 0,
      z: -3.6,
      worldZ: -3.6,
      name: 'atlantis_reef_pool_right',
    });

    // Foreground Left & Right Lounge Plots (`x = ±3.4, z = 0.8`): Curved Seashell Velvet Booth (`museum_s5_atlantis_coral_lounge.png`)
    this.addRealmSprite(this.realmGroup, '/assets/ui/museum_s5_atlantis_coral_lounge.png', 2.6, 2.1, {
      x: -3.4,
      y: 0,
      z: 0.8,
      worldZ: 0.8,
      name: 'atlantis_coral_velvet_lounge_left',
    });
    this.addRealmSprite(this.realmGroup, '/assets/ui/museum_s5_atlantis_coral_lounge.png', 2.6, 2.1, {
      x: 3.4,
      y: 0,
      z: 0.8,
      worldZ: 0.8,
      mirror: true,
      name: 'atlantis_coral_velvet_lounge_right',
    });

    for (const [sx, mir] of [[-6.6, false], [6.6, true]]) {
      this.addRealmSprite(this.realmGroup, '/assets/village/wnd_atlantis_sanctuary.png', 2.7, 2.7, {
        x: sx,
        y: 0,
        z: 1.8,
        worldZ: 1.8,
        mirror: mir,
        name: 'atlantis_sanctuary_wing',
      });
    }
    this.buildPortalWeatherParticles('atlantis');
  }

  /**
   * 10. `starlight` — S6 Cosmic Supernova & Starlight Observatory
   */
  buildStarlight25DWorld() {
    // Centerpiece Glowing Starlight Astrolabe Medallion on the Observatory Floor (`th_medallion_starlight.png`)
    this.realmGroup.add(
      makeFloorDecal('/assets/ui/th_medallion_starlight.png', 4.6, 4.6, {
        x: 0,
        y: 0.019,
        z: 1.5,
        opacity: 0.86,
        renderOrder: 3,
        factor: -2,
        name: 'starlight_zodiac_floor_medallion',
      })
    );

    // Horizon: Celestial Winged Goddess & Starlight Archway (`stage_goddess_vakarine_rainbow.png`)
    this.addRealmSprite(this.realmGroup, '/assets/ui/stage_goddess_vakarine_rainbow.png', 4.6, 4.6, {
      x: 0,
      y: 0,
      z: -8.3,
      worldZ: -8.3,
      name: 'starlight_celestial_observatory_statue',
    });

    // Midground Overlook Left & Right: Aurora Observatory & Brass Starlight Telescope
    this.addRealmSprite(this.realmGroup, '/assets/village/wnd_aurora_observatory.png', 3.0, 3.1, {
      x: -4.8,
      y: 0,
      z: -3.6,
      worldZ: -3.6,
      name: 'starlight_astral_arch',
    });
    this.addRealmSprite(this.realmGroup, '/assets/village/dec_starlight_telescope.png', 2.2, 2.4, {
      x: 4.8,
      y: 0,
      z: -3.6,
      worldZ: -3.6,
      name: 'starlight_brass_telescope',
    });

    // Foreground Left & Right Lounge Plots (`x = ±3.4, z = 0.8`): Curved Midnight-Blue Velvet Observatory Sofas (`museum_s6_starlight_sofa_set.png`)
    this.addRealmSprite(this.realmGroup, '/assets/ui/museum_s6_starlight_sofa_set.png', 2.6, 2.3, {
      x: -3.4,
      y: 0,
      z: 0.8,
      worldZ: 0.8,
      name: 'starlight_observatory_sofa_left',
    });
    this.addRealmSprite(this.realmGroup, '/assets/ui/museum_s6_starlight_sofa_set.png', 2.6, 2.3, {
      x: 3.4,
      y: 0,
      z: 0.8,
      worldZ: 0.8,
      mirror: true,
      name: 'starlight_observatory_sofa_right',
    });

    for (const [lx, mir] of [[-6.6, false], [6.6, true]]) {
      this.addRealmSprite(this.realmGroup, '/assets/village/bld_starlight_lighthouse.png', 2.3, 3.0, {
        x: lx,
        y: 0,
        z: 1.8,
        worldZ: 1.8,
        mirror: mir,
        name: 'starlight_beacon_tower',
      });
    }
    this.buildPortalWeatherParticles('starlight');
  }

  /**
   * 11. `fairytale` — S7 Enchanted Fairytale Floating Lantern Castle & Rose Balcony
   */
  buildFairytale25DWorld() {
    // Horizon: Multi-Spired Fairytale Castle Surrounded by Floating Sky Lanterns (`museum_s7_fairytale_castle_lanterns.png`)
    this.addRealmSprite(this.realmGroup, '/assets/ui/museum_s7_fairytale_castle_lanterns.png', 4.8, 5.2, {
      x: 0,
      y: 0,
      z: -8.3,
      worldZ: -8.3,
      name: 'fairytale_lantern_castle_horizon',
    });

    // Midground Overlook Left & Right: Royal Garden Topiary Arcs (`th_garden_topiary_arc.png`)
    this.addRealmSprite(this.realmGroup, '/assets/ui/th_garden_topiary_arc.png', 2.8, 2.2, {
      x: -4.8,
      y: 0,
      z: -3.6,
      worldZ: -3.6,
      name: 'fairytale_rose_topiary_left',
    });
    this.addRealmSprite(this.realmGroup, '/assets/ui/th_garden_topiary_arc.png', 2.8, 2.2, {
      x: 4.8,
      y: 0,
      z: -3.6,
      worldZ: -3.6,
      mirror: true,
      name: 'fairytale_rose_topiary_right',
    });

    // Foreground Left & Right Lounge Plots (`x = ±3.4, z = 0.8`): Wisteria & Climbing Rose Arches (`museum_s7_fairytale_rose_arch.png`)
    this.addRealmSprite(this.realmGroup, '/assets/ui/museum_s7_fairytale_rose_arch.png', 2.6, 2.8, {
      x: -3.4,
      y: 0,
      z: 0.8,
      worldZ: 0.8,
      name: 'fairytale_wisteria_rose_arch_left',
    });
    this.addRealmSprite(this.realmGroup, '/assets/ui/museum_s7_fairytale_rose_arch.png', 2.6, 2.8, {
      x: 3.4,
      y: 0,
      z: 0.8,
      worldZ: 0.8,
      mirror: true,
      name: 'fairytale_wisteria_rose_arch_right',
    });

    for (const [px, mir] of [[-6.6, false], [6.6, true]]) {
      this.addRealmSprite(this.realmGroup, '/assets/village/dec_love_pavilion.png', 2.6, 2.6, {
        x: px,
        y: 0,
        z: 1.8,
        worldZ: 1.8,
        mirror: mir,
        name: 'fairytale_love_pavilion',
      });
    }
    this.buildPortalWeatherParticles('fairytale');
  }

  /**
   * 12. `permafrost` — S8 Sovereign of Permafrost Aurora Ice Palace & Glacial Throne
   */
  buildPermafrost25DWorld() {
    // Horizon: Crystalline Gothic Ice Palace Colonnade & Winged Ice Goddess Fountain under the Aurora Borealis
    this.addRealmSprite(this.realmGroup, '/assets/ui/th_colonnade_arch.png', 5.6, 4.0, {
      x: 0,
      y: 0,
      z: -8.4,
      worldZ: -8.4,
      tint: 0xb8f2ff,
      name: 'permafrost_glacial_peaks_horizon',
    });
    this.addRealmSprite(this.realmGroup, '/assets/ui/th_fountain_vakarine.png', 2.8, 2.6, {
      x: 0,
      y: 0,
      z: -7.6,
      worldZ: -7.6,
      tint: 0xc8f6ff,
      name: 'permafrost_ice_sanctuary_fountain',
    });

    // Midground Overlook Left & Right: Aurora Crystal Gazebos (`dec_aurora_crystal_gazebo.png`)
    this.addRealmSprite(this.realmGroup, '/assets/village/dec_aurora_crystal_gazebo.png', 2.7, 2.7, {
      x: -4.8,
      y: 0,
      z: -3.6,
      worldZ: -3.6,
      name: 'permafrost_aurora_gazebo_left',
    });
    this.addRealmSprite(this.realmGroup, '/assets/village/dec_aurora_crystal_gazebo.png', 2.7, 2.7, {
      x: 4.8,
      y: 0,
      z: -3.6,
      worldZ: -3.6,
      mirror: true,
      name: 'permafrost_aurora_gazebo_right',
    });

    // Foreground Left & Right Lounge Plots (`x = ±3.4, z = 0.8`): Sculpted Blue-Ice Throne Sofas & Fire Braziers (`museum_s8_permafrost_ice_throne.png`)
    this.addRealmSprite(this.realmGroup, '/assets/ui/museum_s8_permafrost_ice_throne.png', 2.6, 2.7, {
      x: -3.4,
      y: 0,
      z: 0.8,
      worldZ: 0.8,
      name: 'permafrost_ice_throne_left',
    });
    this.addRealmSprite(this.realmGroup, '/assets/ui/museum_s8_permafrost_ice_throne.png', 2.6, 2.7, {
      x: 3.4,
      y: 0,
      z: 0.8,
      worldZ: 0.8,
      mirror: true,
      name: 'permafrost_ice_throne_right',
    });

    for (const [px, pz, mir] of [[-6.8, -3.6, false], [6.8, -3.6, true], [-6.4, 2.0, true], [6.4, 2.0, false]]) {
      this.addRealmSprite(this.realmGroup, '/assets/village/env_tree_pine_snowy.png', 2.2, 2.7, {
        x: px,
        y: 0,
        z: pz,
        worldZ: pz,
        mirror: mir,
        tint: 0xdaf6ff,
        name: 'permafrost_frost_pine',
      });
    }
    this.buildPortalWeatherParticles('permafrost');
  }

  /**
   * 13. `luxor` — S9 Sands of Luxor Nile Sunset Sanctuary & Great Pyramids
   */
  buildLuxor25DWorld() {
    // Horizon: Great Pyramids of Giza, Sphinx & Felucca Boats on the Golden Nile (`museum_s9_luxor_pyramids_nile.png`)
    this.addRealmSprite(this.realmGroup, '/assets/ui/museum_s9_luxor_pyramids_nile.png', 5.6, 4.2, {
      x: 0,
      y: 0,
      z: -8.3,
      worldZ: -8.3,
      name: 'luxor_pyramids_nile_horizon',
    });

    // Midground Overlook Left & Right: Oasis Obelisk Fountains (`dec_oasis_obelisk_fountain.png`)
    this.addRealmSprite(this.realmGroup, '/assets/village/dec_oasis_obelisk_fountain.png', 2.4, 2.7, {
      x: -4.8,
      y: 0,
      z: -3.6,
      worldZ: -3.6,
      name: 'luxor_obelisk_left',
    });
    this.addRealmSprite(this.realmGroup, '/assets/village/dec_oasis_obelisk_fountain.png', 2.4, 2.7, {
      x: 4.8,
      y: 0,
      z: -3.6,
      worldZ: -3.6,
      mirror: true,
      name: 'luxor_obelisk_right',
    });

    // Foreground Left & Right Lounge Plots (`x = ±3.4, z = 0.8`): Gold-Silk Egyptian Divan Sofas & Filigree Lanterns (`museum_s9_luxor_divan_lantern.png`)
    this.addRealmSprite(this.realmGroup, '/assets/ui/museum_s9_luxor_divan_lantern.png', 2.6, 2.2, {
      x: -3.4,
      y: 0,
      z: 0.8,
      worldZ: 0.8,
      name: 'luxor_divan_lantern_left',
    });
    this.addRealmSprite(this.realmGroup, '/assets/ui/museum_s9_luxor_divan_lantern.png', 2.6, 2.2, {
      x: 3.4,
      y: 0,
      z: 0.8,
      worldZ: 0.8,
      mirror: true,
      name: 'luxor_divan_lantern_right',
    });

    for (const [px, pz, mir] of [[-6.8, -3.6, false], [6.8, -3.6, true], [-6.4, 2.0, true], [6.4, 2.0, false]]) {
      this.addRealmSprite(this.realmGroup, '/assets/village/env_tree_palm_oasis.png', 2.3, 2.8, {
        x: px,
        y: 0,
        z: pz,
        worldZ: pz,
        mirror: mir,
        name: 'luxor_nile_date_palm',
      });
    }
    this.buildPortalWeatherParticles('luxor');
  }

  /**
   * 14. `venice` — S10 Venice Moonlit Grand Canal & Velvet Gondola
   */
  buildVenice25DWorld() {
    // Horizon / Canal Edge: Venetian Gothic Quatrefoil Marble Colonnade & Royal Gondola (`museum_s10_venice_gondola_arch.png`)
    this.addRealmSprite(this.realmGroup, '/assets/ui/museum_s10_venice_gondola_arch.png', 3.6, 3.8, {
      x: -3.8,
      y: 0,
      z: -8.0,
      worldZ: -8.0,
      name: 'venice_gondola_arch_left',
    });
    this.addRealmSprite(this.realmGroup, '/assets/ui/museum_s10_venice_gondola_arch.png', 3.6, 3.8, {
      x: 3.8,
      y: 0,
      z: -8.0,
      worldZ: -8.0,
      mirror: true,
      name: 'venice_gondola_arch_right',
    });

    // Foreground Left & Right Lounge Plots (`x = ±3.4, z = 0.8`): Tufted Crimson Velvet Booth & Candelabrum (`museum_s10_venice_velvet_booth.png`)
    this.addRealmSprite(this.realmGroup, '/assets/ui/museum_s10_venice_velvet_booth.png', 2.6, 2.2, {
      x: -3.4,
      y: 0,
      z: 0.8,
      worldZ: 0.8,
      name: 'venice_crimson_velvet_booth_left',
    });
    this.addRealmSprite(this.realmGroup, '/assets/ui/museum_s10_venice_velvet_booth.png', 2.6, 2.2, {
      x: 3.4,
      y: 0,
      z: 0.8,
      worldZ: 0.8,
      mirror: true,
      name: 'venice_crimson_velvet_booth_right',
    });

    for (const [lx, lz] of [[-2.35, -2.6], [2.35, -2.6], [-2.35, 2.6], [2.35, 2.6]]) {
      this.addRealmSprite(this.realmGroup, '/assets/village/env_streetlamp_double.png', 0.72, 1.58, {
        x: lx,
        y: 0,
        z: lz,
        worldZ: lz,
        name: 'venice_canal_streetlamp',
      });
    }
    for (const px of [-5.6, 5.6]) {
      this.addRealmSprite(this.realmGroup, '/assets/village/env_flowerbed_planter.png', 1.4, 0.95, {
        x: px,
        y: 0,
        z: 2.2,
        worldZ: 2.2,
        name: 'venice_canal_planter',
      });
    }
    this.buildPortalWeatherParticles('venice');
  }

  /**
   * 15. `olympus` — S11 Pantheon of Olympus & Santorini Terrace
   */
  buildOlympus25DWorld() {
    // Horizon Left & Right: Whitewashed Santorini Blue-Domed Church & Bougainvillea (`museum_s11_santorini_blue_dome.png`)
    this.addRealmSprite(this.realmGroup, '/assets/ui/museum_s11_santorini_blue_dome.png', 3.8, 4.2, {
      x: -4.2,
      y: 0,
      z: -8.2,
      worldZ: -8.2,
      name: 'olympus_santorini_dome_left',
    });
    this.addRealmSprite(this.realmGroup, '/assets/ui/museum_s11_santorini_blue_dome.png', 3.8, 4.2, {
      x: 4.2,
      y: 0,
      z: -8.2,
      worldZ: -8.2,
      mirror: true,
      name: 'olympus_santorini_dome_right',
    });

    // Midground Overlook Left & Right: Heaven Winged Pillar & Golden Seraph Harp
    this.addRealmSprite(this.realmGroup, '/assets/village/dec_heaven_winged_pillar.png', 1.8, 2.8, {
      x: -4.6,
      y: 0,
      z: -3.6,
      worldZ: -3.6,
      name: 'olympus_winged_pillar_left',
    });
    this.addRealmSprite(this.realmGroup, '/assets/village/dec_heaven_seraph_harp.png', 2.0, 2.4, {
      x: 4.6,
      y: 0,
      z: -3.6,
      worldZ: -3.6,
      name: 'olympus_seraph_harp_right',
    });

    // Foreground Left & Right Lounge Plots (`x = ±3.4, z = 0.8`): White-and-Gold Grecian Chaise Lounges (`museum_s11_olympus_golden_chaise.png`)
    this.addRealmSprite(this.realmGroup, '/assets/ui/museum_s11_olympus_golden_chaise.png', 2.6, 2.5, {
      x: -3.4,
      y: 0,
      z: 0.8,
      worldZ: 0.8,
      name: 'olympus_golden_chaise_left',
    });
    this.addRealmSprite(this.realmGroup, '/assets/ui/museum_s11_olympus_golden_chaise.png', 2.6, 2.5, {
      x: 3.4,
      y: 0,
      z: 0.8,
      worldZ: 0.8,
      mirror: true,
      name: 'olympus_golden_chaise_right',
    });

    for (const [tx, mir] of [[-6.6, false], [6.6, true]]) {
      this.addRealmSprite(this.realmGroup, '/assets/village/dec_heaven_divine_tree.png', 2.5, 2.8, {
        x: tx,
        y: 0,
        z: 1.8,
        worldZ: 1.8,
        mirror: mir,
        name: 'olympus_divine_tree',
      });
    }
    this.buildPortalWeatherParticles('olympus');
  }

  /**
   * 16. `cat_lounge` — Purrst-Class Sky Cat Lounge & Kitty Claw Suite
   */
  buildCatLounge25DWorld() {
    // Horizon: Original V1 Purrst-Class Cabin Cat Lounge Backdrop (`cat_lounge_bg.jpg`)
    this.addRealmSprite(this.realmGroup, '/assets/museum/v1/cat_lounge_bg.jpg', 17.5, 8.4, {
      x: 0,
      y: -0.2,
      z: -8.6,
      worldZ: -8.6,
      lean: true,
      name: 'cat_lounge_cabin_wall',
    });

    // Midground Overlook Left & Right: Cozy Cat Bakery Sign & Plush Cat Cushion
    this.addRealmSprite(this.realmGroup, '/assets/village/dec_cat_bakery_sign.png', 1.8, 2.0, {
      x: -4.4,
      y: 0,
      z: -3.6,
      worldZ: -3.6,
      name: 'cat_lounge_bakery_sign',
    });
    this.addRealmSprite(this.realmGroup, '/assets/village/dec_cat_cushion.png', 1.9, 1.5, {
      x: 4.4,
      y: 0,
      z: -3.6,
      worldZ: -3.6,
      name: 'cat_lounge_cushion',
    });

    // Foreground Left & Right Lounge Plots (`x = ±3.4, z = 0.6`): Multi-Tier Cat Tree Sofa & Kitty Claw Machine
    this.addRealmSprite(this.realmGroup, '/assets/ui/museum_cats_purrst_tree_sofa.png', 2.5, 2.8, {
      x: -3.4,
      y: 0,
      z: 0.6,
      worldZ: 0.6,
      name: 'cat_lounge_purrst_tree_left',
    });
    this.addRealmSprite(this.realmGroup, '/assets/museum/v1/kitty_machine.png', 2.2, 2.8, {
      x: 3.4,
      y: 0,
      z: 0.6,
      worldZ: 0.6,
      name: 'cat_lounge_kitty_claw_machine',
    });

    // Adorable V1 Companion Cats arranged cleanly on the Sanctuary Plaza & Feature Pads
    const cats = [
      ['/assets/museum/v1/cat_captain.png', -1.8, 2.3, 1.15, 1.15, 'cat_lounge_captain'],
      ['/assets/museum/v1/cat_sakura.png', 1.8, 2.3, 1.15, 1.15, 'cat_lounge_sakura'],
      ['/assets/museum/v1/cat_mochi.png', -2.2, -0.6, 1.08, 1.08, 'cat_lounge_mochi'],
      ['/assets/museum/v1/cat_ragdoll.png', 2.2, -0.6, 1.08, 1.08, 'cat_lounge_ragdoll'],
      ['/assets/museum/v1/cat_moon.png', -4.8, 2.2, 1.1, 1.1, 'cat_lounge_moon'],
      ['/assets/museum/v1/cat_maneki.png', 4.8, 2.2, 1.1, 1.1, 'cat_lounge_maneki'],
    ];
    for (const [url, cx, cz, cw, ch, cname] of cats) {
      this.addRealmSprite(this.realmGroup, url, cw, ch, {
        x: cx,
        y: 0,
        z: cz,
        worldZ: cz,
        name: cname,
      });
    }
    this.buildPortalWeatherParticles('cat_lounge');
  }

  // -------------------------------------------------------------------------
  // Couple Synced Follow & Pose inside the Museum & Portals
  // -------------------------------------------------------------------------
  findPartnerEntity() {
    if (typeof this.world?.getPartnerEntity === 'function') {
      const pEnt = this.world.getPartnerEntity();
      if (pEnt) return pEnt;
    }
    const remotes = this.world?.remotes;
    if (!remotes) return null;
    const list = remotes instanceof Map ? Array.from(remotes.values()) : Object.values(remotes);
    return (
      list.find(
        (r) =>
          r &&
          (r.isCompanion ||
            r.data?.isCompanion ||
            String(r.id || '').includes('companion') ||
            /neen|nook/i.test(String(r.name || r.displayName || r.data?.username || r.id || '')))
      ) || null
    );
  }

  syncPartnerFollow(snapImmediate = false) {
    try {
      const local = this.world?.local;
      const partner = this.findPartnerEntity();
      if (!local || !partner) return;
      const isComp = Boolean(partner.isCompanion || partner.data?.isCompanion || !partner.smooth);
      if (!isComp) return; // Real live online partner controls their own movement!
      const targetX = local.x + 1.15;
      const targetZ = local.z + 0.15;
      if (snapImmediate) {
        if (partner.smooth) {
          partner.smooth.x = targetX;
          partner.smooth.z = targetZ;
          partner.smooth.tx = targetX;
          partner.smooth.tz = targetZ;
          partner.smooth.vx = 0;
          partner.smooth.vz = 0;
          partner.smooth.age = 0;
        } else {
          partner.x = targetX;
          partner.z = targetZ;
          partner.tx = targetX;
          partner.tz = targetZ;
        }
        partner.rig?.setPosition?.(targetX, targetZ);
        if (this.currentPortalId) {
          partner.rig?.facing?.set?.(false, true);
        }
        partner.pet?.placeNear?.({ x: targetX, z: targetZ, right: false });
      } else if (isComp) {
        const px = partner.smooth ? partner.smooth.x : (partner.x || 0);
        const pz = partner.smooth ? partner.smooth.z : (partner.z || 0);
        const dist = Math.hypot(px - targetX, pz - targetZ);
        if (dist > 0.08) {
          partner.tx = targetX;
          partner.tz = targetZ;
          if (partner.smooth) {
            partner.smooth.tx = targetX;
            partner.smooth.tz = targetZ;
            partner.smooth.age = 0;
          }
        }
      }
    } catch {
      // Never allow partner sync to interrupt scene transitions
    }
  }

  triggerCoupleMoment(opts = {}) {
    const local = this.world?.local;
    const partner = this.findPartnerEntity();
    const cx = this.currentPortalId ? 0 : (local?.x || 0);
    const cz = this.currentPortalId ? 1.5 : (local?.z || 0);
    if (typeof this.world?.playCoupleStage === 'function') {
      this.world.playCoupleStage('hug', { x: cx, z: cz, dur: 6.0 });
    } else if (local) {
      const lx = cx - 0.55;
      local.x = lx;
      local.z = cz;
      local.tx = lx;
      local.tz = cz;
      if (typeof this.world?.teleportLocal === 'function') {
        this.world.teleportLocal(lx, cz, { right: true, back: false });
      }
      local.pose = 'happy';
      local.animState = 'happy';
      if (partner) {
        const px = cx + 0.55;
        if (partner.smooth) {
          partner.smooth.x = px;
          partner.smooth.z = cz;
          partner.smooth.tx = px;
          partner.smooth.tz = cz;
        } else {
          partner.x = px;
          partner.z = cz;
        }
        partner.tx = px;
        partner.tz = cz;
        partner.pose = 'cast';
        partner.animState = 'happy';
      }
    }
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      this.world?.fx?.emit?.('fx_heart', {
        x: cx + Math.cos(angle) * 0.9,
        y: 1.1 + (i % 3) * 0.35,
        z: cz + Math.sin(angle) * 0.9,
        scale: 0.65,
        vy: 0.6,
        life: 1.8,
      });
    }
    this.onAction?.({
      action: 'couple_moment',
      kind: 'pose',
      pose: 'hug',
      x: cx,
      z: cz,
      initiatorRole: 'left',
    });
    if (this._keepsakeModalTimer) {
      clearTimeout(this._keepsakeModalTimer);
      this._keepsakeModalTimer = null;
    }
    if (opts?.openKeepsakeModal) {
      this.showWarmHugKeepsakeBanner();
    } else if (typeof setTimeout === 'function') {
      this._keepsakeModalTimer = setTimeout(() => {
        this._keepsakeModalTimer = null;
        if (this.active) {
          this.showWarmHugKeepsakeBanner();
        }
      }, 2600);
      this._keepsakeModalTimer?.unref?.();
    }
    if (this.toast) {
      this.toast('💑 Nook & Neen Warm Hug Memory! Holding hands together.');
    }
    return { ok: true, portalId: this.currentPortalId };
  }

  // -------------------------------------------------------------------------
  // Interactive Top Bar (`#nook-museum-hud`), PiP (`#nook-museum-pip`) & Modals (`#nook-museum-modal`)
  // -------------------------------------------------------------------------
  ensureDomOverlays() {
    if (typeof document === 'undefined') return;

    if (!document.getElementById('nook-museum-style')) {
      const style = document.createElement('style');
      style.id = 'nook-museum-style';
      style.textContent = `
        #nook-museum-hud {
          position: fixed;
          top: calc(var(--safe-top, 0px) + 6px);
          left: 8px;
          right: 8px;
          z-index: 1200;
          display: flex;
          flex-direction: row;
          align-items: center;
          gap: 6px;
          background: rgba(58, 36, 21, 0.88);
          border: 2px solid #e6b450;
          border-radius: 999px;
          padding: 5px 10px;
          box-shadow: 0 6px 18px rgba(0,0,0,0.38);
          color: #fff8ec;
          font-family: "Fredoka", "Comfortaa", -apple-system, sans-serif;
          max-width: 94vw;
          margin: 0 auto;
        }
        #nook-museum-hud[hidden] { display: none !important; }
        .nm-hud-badge {
          font-size: 11px;
          font-weight: 900;
          color: #ffe49c;
          white-space: nowrap;
          padding: 2px 6px;
          flex: 0 0 auto;
        }
        .nm-hud-pills {
          display: flex;
          flex-wrap: nowrap;
          overflow-x: auto;
          justify-content: flex-start;
          align-items: center;
          gap: 5px;
          width: 100%;
          padding-right: 12px;
          border-radius: 999px;
          scrollbar-width: none;
          -webkit-overflow-scrolling: touch;
          -webkit-mask-image: linear-gradient(90deg, #000 0%, #000 92%, transparent 100%);
          mask-image: linear-gradient(90deg, #000 0%, #000 92%, transparent 100%);
        }
        .nm-hud-pills::-webkit-scrollbar { display: none; }
        .nm-pill {
          width: auto !important;
          flex: 0 0 auto;
          display: inline-flex;
          align-items: center;
          gap: 3px;
          white-space: nowrap;
          border: 1.5px solid rgba(236,188,96,0.65);
          background: rgba(62,36,24,0.88);
          color: #fff6e5;
          border-radius: 999px;
          padding: 3px 9px;
          font-size: 11px;
          font-weight: 800;
          cursor: pointer;
          transition: transform 0.12s ease, background 0.12s ease;
        }
        .nm-pill:hover, .nm-pill.active {
          background: linear-gradient(180deg, #e5b24c, #b87e22);
          color: #231208;
          transform: translateY(-1px);
        }
        #nook-museum-pip {
          position: fixed;
          right: 8px;
          top: calc(var(--safe-top, 0px) + 50px);
          z-index: 1205;
          width: 104px;
          background: rgba(58, 36, 21, 0.92);
          border: 2px solid #e8b856;
          border-radius: 10px;
          padding: 4px;
          box-shadow: 0 10px 26px rgba(0,0,0,0.45);
          color: #fff6e6;
          font-family: "Fredoka", -apple-system, sans-serif;
          cursor: pointer;
          transition: width 0.2s ease;
        }
        #nook-museum-pip.expanded {
          width: min(360px, 92vw);
        }
        #nook-museum-pip[hidden] { display: none !important; }
        #nook-museum-pip img {
          width: 100%;
          height: auto;
          border-radius: 8px;
          border: 1px solid rgba(255,222,148,0.5);
          display: block;
          margin-top: 3px;
        }
        #nook-museum-pip .nm-pip-sub {
          display: none;
          font-size: 10px;
          color: #e9dac5;
          margin-top: 4px;
          line-height: 1.25;
        }
        #nook-museum-pip.expanded .nm-pip-sub {
          display: block;
        }
        .nm-memory-quote-pill {
          position: fixed;
          top: calc(var(--safe-top, 0px) + 50px);
          left: 8px;
          max-width: calc(100vw - 126px);
          z-index: 1202;
          background: rgba(46, 26, 16, 0.82);
          border: 1.5px solid rgba(232, 184, 86, 0.72);
          border-radius: 12px;
          padding: 4px 10px;
          color: #ffe8b6;
          font-family: "Fredoka", "Comfortaa", -apple-system, sans-serif;
          font-size: 10.5px;
          font-style: italic;
          line-height: 1.28;
          box-shadow: 0 6px 16px rgba(0,0,0,0.34);
          pointer-events: none;
        }
        .nm-memory-quote-pill[hidden] { display: none !important; }
        #nook-museum-modal {
          position: fixed;
          inset: 0;
          z-index: 1350;
          background: rgba(14, 9, 18, 0.82);
          backdrop-filter: blur(6px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 14px;
          font-family: "Fredoka", "Comfortaa", -apple-system, sans-serif;
        }
        #nook-museum-modal[hidden] { display: none !important; }
        .nm-modal-card {
          width: min(920px, 95vw);
          max-height: 86vh;
          overflow-y: auto;
          background: linear-gradient(180deg, #281822, #191018);
          border: 2.5px solid #e6b554;
          border-radius: 22px;
          padding: 16px 18px;
          color: #fff7ea;
          box-shadow: 0 20px 55px rgba(0,0,0,0.68);
        }
        .nm-modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
          border-bottom: 1px solid rgba(230,181,84,0.35);
          padding-bottom: 10px;
          margin-bottom: 12px;
        }
        .nm-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          margin-top: 10px;
        }
        .nm-chapter-box {
          background: rgba(255,245,225,0.06);
          border: 1px solid rgba(235,190,104,0.4);
          border-radius: 16px;
          padding: 14px;
          margin-bottom: 14px;
        }
        .nm-snap-row {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding-top: 8px;
        }
        .nm-snap-row img {
          height: 110px;
          border-radius: 10px;
          border: 1.5px solid #e5b454;
          object-fit: cover;
        }
      `;
      document.head?.appendChild(style);
    }

    if (!this.hudEl) {
      this.hudEl = document.getElementById('nook-museum-hud');
      if (!this.hudEl) {
        this.hudEl = document.createElement('div');
        this.hudEl.id = 'nook-museum-hud';
        this.hudEl.hidden = true;
        document.body?.appendChild(this.hudEl);
      }
      this.hudEl.addEventListener('click', (e) => {
        const btn = e.target.closest?.('[data-nm-cmd]');
        if (!btn) return;
        const cmd = btn.getAttribute('data-nm-cmd');
        this.handleHudCommand(cmd);
      });
    }

    if (!this.pipEl) {
      this.pipEl = document.getElementById('nook-museum-pip');
      if (!this.pipEl) {
        this.pipEl = document.createElement('div');
        this.pipEl.id = 'nook-museum-pip';
        this.pipEl.hidden = true;
        document.body?.appendChild(this.pipEl);
      }
      this.pipEl.addEventListener('click', () => {
        this.pipExpanded = !this.pipExpanded;
        this.pipEl.classList.toggle('expanded', this.pipExpanded);
      });
    }

    if (!this.quoteEl) {
      this.quoteEl = document.getElementById('nook-museum-quote');
      if (!this.quoteEl) {
        this.quoteEl = document.createElement('div');
        this.quoteEl.id = 'nook-museum-quote';
        this.quoteEl.className = 'nm-memory-quote-pill';
        this.quoteEl.hidden = true;
        document.body?.appendChild(this.quoteEl);
      }
    }

    if (!this.modalEl) {
      this.modalEl = document.getElementById('nook-museum-modal');
      if (!this.modalEl) {
        this.modalEl = document.createElement('div');
        this.modalEl.id = 'nook-museum-modal';
        this.modalEl.hidden = true;
        document.body?.appendChild(this.modalEl);
      }
      this.modalEl.addEventListener('click', (e) => {
        const portalBtn = e.target.closest?.('[data-nm-enter-portal]');
        if (portalBtn) {
          const pid = portalBtn.getAttribute('data-nm-enter-portal');
          this.closeModal();
          if (pid) this.enterPortal(pid);
          return;
        }
        if (e.target.closest?.('[data-nm-invite]')) {
          this.onAction?.('invite_partner', this.currentPortalId);
          return;
        }
        if (e.target.closest?.('[data-nm-polaroid]')) {
          const activePortal = MUSEUM_SCENERY_PORTALS.find((p) => p.id === this.currentPortalId);
          const caption = activePortal
            ? `Nook & Neen — ${activePortal.title}`
            : 'Nook & Neen — NookAirline V1 Memory Museum';
          const snap = this.world?.capturePolaroid?.({ caption });
          if (snap && (snap.thumbDataUrl || snap.dataUrl)) {
            this.onAction?.({
              action: 'couple_moment',
              kind: 'polaroid',
              photo: {
                id: `mus_${Date.now()}`,
                caption,
                dataUrl: snap.thumbDataUrl || snap.dataUrl,
                takenAt: Date.now(),
                pose: 'hug',
              },
            });
          }
          this.toast?.(`📸 Captured "Then & Now" Keepsake Polaroid: ${caption}!`);
          return;
        }
        if (e.target === this.modalEl || e.target.closest?.('[data-nm-close]')) {
          this.closeModal();
        }
      });
    }
  }

  toggleMusicBox() {
    if (this.musicPlaying) {
      this.stopMusicBox();
      this.updateHud();
      return false;
    }
    if (typeof window === 'undefined') return false;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return false;
    try {
      if (!this._audioCtx) this._audioCtx = new AudioCtx();
      if (this._audioCtx.state === 'suspended') this._audioCtx.resume();
      this.musicPlaying = true;
      // Tender celesta music-box progression (Fmaj7 -> Em7 -> Dm7 -> Cmaj7)
      const notes = [349.23, 440.0, 523.25, 659.25, 329.63, 392.0, 493.88, 587.33, 293.66, 349.23, 440.0, 523.25, 261.63, 329.63, 392.0, 523.25];
      let step = 0;
      const playChime = () => {
        if (!this.musicPlaying || !this._audioCtx) return;
        const now = this._audioCtx.currentTime;
        const freq = notes[step % notes.length];
        step += 1;
        const osc = this._audioCtx.createOscillator();
        const gain = this._audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.exponentialRampToValueAtTime(0.045, now + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0008, now + 1.35);
        osc.connect(gain);
        gain.connect(this._audioCtx.destination);
        osc.start(now);
        osc.stop(now + 1.4);
      };
      playChime();
      this._musicTimer = setInterval(playChime, 520);
      this.toast?.('🎵 Playing Nook & Neen’s Sky Cabin Music-Box Lullaby...');
    } catch {
      this.musicPlaying = false;
    }
    this.updateHud();
    return this.musicPlaying;
  }

  stopMusicBox() {
    this.musicPlaying = false;
    if (this._musicTimer) {
      clearInterval(this._musicTimer);
      this._musicTimer = null;
    }
  }

  focusLobbyView(viewId = 'entrance') {
    const views = {
      entrance: { x: 0, z: 4.4, camX: 0, camZ: 1.4, right: true, back: true },
      gacha: { x: -6.2, z: 2.2, camX: -6.2, camZ: 0.2, right: false, back: true },
      portals: { x: 0, z: -9.5, camX: 0, camZ: -11.5, right: true, back: true },
      couple: { x: 4.5, z: 2.6, camX: 4.5, camZ: 1.2, right: true, back: false },
    };
    const v = views[viewId] || views.entrance;
    this.activeLobbyView = viewId in views ? viewId : 'entrance';
    if (this.currentPortalId) {
      this.exitPortalToHall({ spawn: { x: v.x, z: v.z } });
    } else if (this.world?.local) {
      this.world.local.x = v.x;
      this.world.local.z = v.z;
      this.world.local.tx = v.x;
      this.world.local.tz = v.z;
      if (typeof this.world.teleportLocal === 'function') {
        this.world.teleportLocal(v.x, v.z, { right: v.right, back: v.back });
      } else {
        this.world.setLocalPosition?.(v.x, v.z);
      }
      this.world.camTarget?.set?.(v.camX, 0, v.camZ);
    }
    this.syncPartnerFollow(true);
    this.updateHud();
    return v;
  }

  handleHudCommand(cmd) {
    if (!cmd) return;
    if (cmd === 'timeline') {
      this.openTimelineModal();
    } else if (cmd === 'view_entrance') {
      this.focusLobbyView('entrance');
    } else if (cmd === 'gacha_floor') {
      this.focusLobbyView('gacha');
    } else if (cmd === 'view_portal_tiers') {
      this.focusLobbyView('portals');
    } else if (cmd === 'view_couple_spot') {
      this.focusLobbyView('couple');
    } else if (cmd === 'portals_directory') {
      this.openPortalsDirectoryModal();
    } else if (cmd === 'invite_partner') {
      this.onAction?.('invite_partner', this.currentPortalId);
    } else if (cmd.startsWith('portal:')) {
      const pid = cmd.slice('portal:'.length);
      this.enterPortal(pid);
    } else if (cmd === 'toggle_pip') {
      this.pipVisible = !this.pipVisible;
      this.updateHud();
    } else if (cmd === 'toggle_music') {
      this.toggleMusicBox();
    } else if (cmd === 'couple_pose') {
      this.triggerCoupleMoment();
    } else if (cmd === 'exit_museum') {
      if (this.currentPortalId) {
        this.exitPortalToHall();
      } else {
        this.dispatch('exit_museum');
      }
    }
  }

  updateHud() {
    this.ensureDomOverlays();
    if (!this.hudEl) return;
    if (!this.active) {
      this.hudEl.hidden = true;
      if (this.pipEl) this.pipEl.hidden = true;
      if (this.quoteEl) this.quoteEl.hidden = true;
      return;
    }

    this.hudEl.hidden = false;
    const activePortal = MUSEUM_SCENERY_PORTALS.find((p) => p.id === this.currentPortalId);
    const curView = !activePortal ? (this.activeLobbyView || 'entrance') : null;
    const badgeText = activePortal
      ? activePortal.shortLabel || `${activePortal.icon} ${activePortal.title}`
      : '🏛️ Nook’s Museum';

    const portalPillsHtml = MUSEUM_SCENERY_PORTALS.map(
      (p) =>
        `<button type="button" class="nm-pill ${this.currentPortalId === p.id ? 'active' : ''}" data-nm-cmd="portal:${p.id}">${p.shortLabel}</button>`
    ).join('');

    this.hudEl.innerHTML = `
      <span class="nm-hud-badge">${badgeText}</span>
      <div class="nm-hud-pills">
        <button type="button" class="nm-pill ${curView === 'entrance' ? 'active' : ''}" data-nm-cmd="view_entrance">🏛️ Plaza</button>
        <button type="button" class="nm-pill ${curView === 'gacha' ? 'active' : ''}" data-nm-cmd="gacha_floor">🎨 Gacha</button>
        <button type="button" class="nm-pill ${curView === 'portals' ? 'active' : ''}" data-nm-cmd="view_portal_tiers">🌀 Portals</button>
        <button type="button" class="nm-pill ${curView === 'couple' ? 'active' : ''}" data-nm-cmd="view_couple_spot">🌸 Couple</button>
        <button type="button" class="nm-pill" data-nm-cmd="portals_directory">📖 16 Worlds</button>
        <button type="button" class="nm-pill" data-nm-cmd="timeline">📜 Story</button>
        <button type="button" class="nm-pill" data-nm-cmd="invite_partner">💌 Invite</button>
        ${portalPillsHtml}
        <button type="button" class="nm-pill" data-nm-cmd="toggle_pip">🖼️ V1 PiP</button>
        <button type="button" class="nm-pill ${this.musicPlaying ? 'active' : ''}" data-nm-cmd="toggle_music">🎵 ${this.musicPlaying ? 'Lullaby: ON' : 'Lullaby'}</button>
        <button type="button" class="nm-pill" data-nm-cmd="couple_pose">💑 Pose</button>
        <button type="button" class="nm-pill" data-nm-cmd="exit_museum">🚪 ${activePortal ? 'Back to Hall' : 'Exit'}</button>
      </div>
    `;

    if (this.pipEl) {
      if (activePortal && this.pipVisible) {
        this.pipEl.hidden = false;
        this.pipEl.innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:center;font-size:10px;font-weight:800;color:#ffe298;">
            <span>🖼️ V1</span>
            <span>${this.pipExpanded ? '−' : '+'}</span>
          </div>
          <img src="${activePortal.v1Snap}" alt="${activePortal.title}" />
          <div class="nm-pip-sub">${activePortal.subtitle}</div>
        `;
      } else {
        this.pipEl.hidden = true;
      }
    }

    if (this.quoteEl) {
      if (activePortal && activePortal.memoryQuote) {
        this.quoteEl.hidden = false;
        this.quoteEl.textContent = `💌 ${activePortal.memoryQuote}`;
      } else {
        this.quoteEl.hidden = true;
      }
    }
  }

  openPortalsDirectoryModal() {
    this.ensureDomOverlays();
    if (!this.modalEl) return null;
    const cardsHtml = MUSEUM_SCENERY_PORTALS.map(
      (p) => `
        <div class="nm-chapter-box" style="margin-bottom:0;display:flex;flex-direction:column;justify-content:space-between;gap:6px;">
          <div>
            <div style="display:flex;justify-content:space-between;align-items:center;gap:4px;">
              <span style="font-size:10.5px;font-weight:900;color:#ffd984;">${p.season || 'V1 Memory'}</span>
              ${this.currentPortalId === p.id ? '<span style="font-size:10px;font-weight:900;color:#86efac;">● Inside Now</span>' : ''}
            </div>
            <div style="font-size:13.5px;font-weight:900;color:#fff9ee;margin:2px 0 4px;">${p.title}</div>
            <img src="${p.v1Snap}" alt="${p.title}" style="width:100%;height:96px;object-fit:cover;border-radius:10px;border:1.5px solid #e6b450;" />
            <p style="font-size:11px;color:#ebd9c4;margin:5px 0 0;line-height:1.35;">${p.subtitle}</p>
          </div>
          <button type="button" class="nm-pill active" style="justify-content:center;width:100% !important;margin-top:4px;" data-nm-enter-portal="${p.id}">
            🌀 Step Into ${p.shortLabel}
          </button>
        </div>
      `
    ).join('');

    this.modalEl.hidden = false;
    this.modalEl.innerHTML = `
      <div class="nm-modal-card">
        <div class="nm-modal-header">
          <div>
            <div style="font-size:12px;color:#ffd984;font-weight:800;">✈️ All 11 Gacha Seasons + Iconic V1 Sceneries (16 Walkable 2.5D Worlds)</div>
            <h2 style="margin:2px 0 0;font-size:20px;">🌀 NookAirline 2.5D Conceptual World Portals</h2>
          </div>
          <div style="display:flex;gap:6px;align-items:center;">
            <button type="button" class="nm-pill active" data-nm-invite="1">💌 Invite Partner</button>
            <button type="button" class="nm-pill" data-nm-close="1">✕ Close</button>
          </div>
        </div>
        <div class="nm-grid">
          ${cardsHtml}
        </div>
      </div>
    `;
    return MUSEUM_SCENERY_PORTALS;
  }

  openExhibitModal(exhibitOrId) {
    this.ensureDomOverlays();
    const exhibit =
      typeof exhibitOrId === 'string'
        ? MUSEUM_GACHA_EXHIBITS.find((e) => e.id === exhibitOrId)
        : exhibitOrId || MUSEUM_GACHA_EXHIBITS[0];
    if (!exhibit || !this.modalEl) return null;

    const extrasHtml = (exhibit.extraSprites || [])
      .map((url) => `<img src="${url}" alt="${exhibit.title}" style="height:120px;border-radius:12px;border:1.5px solid #e5b454;" />`)
      .join('');
    const linkedPortal = exhibit.portalId
      ? MUSEUM_SCENERY_PORTALS.find((p) => p.id === exhibit.portalId)
      : null;

    this.modalEl.hidden = false;
    this.modalEl.innerHTML = `
      <div class="nm-modal-card">
        <div class="nm-modal-header">
          <div>
            <div style="font-size:12px;color:#ffd984;font-weight:800;">${exhibit.season} • NookAirline V1 Painting Floor Exhibit</div>
            <h2 style="margin:2px 0 0;font-size:21px;">${exhibit.icon} ${exhibit.title}</h2>
          </div>
          <div style="display:flex;gap:6px;align-items:center;">
            ${linkedPortal ? `<button type="button" class="nm-pill active" data-nm-enter-portal="${linkedPortal.id}">🌀 Step Inside 2.5D World</button>` : ''}
            <button type="button" class="nm-pill" data-nm-close="1">✕ Close</button>
          </div>
        </div>
        <p style="font-size:13.5px;line-height:1.5;color:#f7ead9;margin:0 0 10px;">${exhibit.story}</p>
        <div style="margin:8px 0;">
          <img src="${exhibit.bannerUrl}" alt="${exhibit.title}" style="width:100%;max-height:220px;object-fit:cover;border-radius:14px;border:2px solid #e6b450;" />
        </div>
        <div class="nm-grid">
          <div style="background:rgba(255,255,255,0.05);padding:10px;border-radius:14px;text-align:center;">
            <div style="font-size:12px;font-weight:800;color:#ffe298;margin-bottom:6px;">🕺 V1 Male Mythic</div>
            <img src="${exhibit.maleSprite}" alt="Male Costume" style="max-height:165px;width:100%;object-fit:contain;" />
          </div>
          <div style="background:rgba(255,255,255,0.05);padding:10px;border-radius:14px;text-align:center;">
            <div style="font-size:12px;font-weight:800;color:#ffe298;margin-bottom:6px;">💃 V1 Female Mythic</div>
            <img src="${exhibit.femaleSprite}" alt="Female Costume" style="max-height:165px;width:100%;object-fit:contain;" />
          </div>
        </div>
        ${extrasHtml ? `<div class="nm-snap-row" style="margin-top:10px;">${extrasHtml}</div>` : ''}
        ${linkedPortal ? `
          <div style="margin-top:14px;display:flex;justify-content:center;gap:8px;flex-wrap:wrap;">
            <button type="button" class="nm-pill active" data-nm-enter-portal="${linkedPortal.id}">
              🌀 Step Inside ${linkedPortal.title} Together!
            </button>
            <button type="button" class="nm-pill" data-nm-invite="1">💌 Invite Partner</button>
          </div>
        ` : ''}
      </div>
    `;
    return exhibit;
  }

  openTimelineModal() {
    this.ensureDomOverlays();
    if (!this.modalEl) return null;

    const chaptersHtml = MUSEUM_TIMELINE_CHAPTERS.map(
      (ch) => `
        <div class="nm-chapter-box">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:4px;">
            <span style="font-weight:900;color:#ffd984;font-size:13px;">${ch.chapter} • ${ch.date}</span>
            <span style="font-size:12px;color:#e6cfb2;">${ch.subtitle}</span>
          </div>
          <h3 style="margin:4px 0 6px;font-size:18px;color:#fff9ee;">${ch.title}</h3>
          <p style="margin:0;font-size:13px;line-height:1.5;color:#f3e5d0;">${ch.story}</p>
          <div class="nm-snap-row">
            ${ch.snapshots.map((src) => `<img src="${src}" alt="${ch.title}" />`).join('')}
          </div>
        </div>
      `
    ).join('');

    this.modalEl.hidden = false;
    this.modalEl.innerHTML = `
      <div class="nm-modal-card">
        <div class="nm-modal-header">
          <div>
            <div style="font-size:12px;color:#ffd984;font-weight:800;">✈️ Nook & Neen's Archival Chronicle • Flight NA-001 (BKK ⇄ DXB)</div>
            <h2 style="margin:2px 0 0;font-size:21px;">NookAirline V1 Memory Timeline (Chapters I–VI)</h2>
          </div>
          <button type="button" class="nm-pill" data-nm-close="1">✕ Close</button>
        </div>
        ${chaptersHtml}
      </div>
    `;
    return MUSEUM_TIMELINE_CHAPTERS;
  }

  showWarmHugKeepsakeBanner() {
    this.ensureDomOverlays();
    if (!this.modalEl) return;
    const activePortal = MUSEUM_SCENERY_PORTALS.find((p) => p.id === this.currentPortalId);
    const snapUrl = activePortal ? activePortal.v1Snap : '/assets/museum/v1/plane_cabin_wide.png';
    const quoteText = activePortal?.memoryQuote
      ? activePortal.memoryQuote
      : '“No matter how many miles lie between Bangkok and Dubai, every horizon brings us back into the same warm hug.”';
    this.modalEl.hidden = false;
    this.modalEl.innerHTML = `
      <div class="nm-modal-card" style="max-width:680px;text-align:center;">
        <div class="nm-modal-header">
          <h2 style="margin:0;font-size:20px;">💑 Nook & Neen Warm Hug Keepsake</h2>
          <button type="button" class="nm-pill" data-nm-close="1">✕ Close</button>
        </div>
        <p style="font-size:13.5px;color:#f7ead9;margin:0 0 6px;">
          From cuddling under a First-Class cabin blanket in V1 to standing hand-in-hand inside ${activePortal ? activePortal.title : 'the NookAirline Memory Museum'}!
        </p>
        <p style="font-size:12.5px;font-style:italic;color:#ffe298;margin:0 0 10px;">${quoteText}</p>
        <div class="nm-grid">
          <div style="background:rgba(255,255,255,0.05);padding:8px;border-radius:14px;">
            <div style="font-size:11.5px;color:#ffe298;font-weight:800;margin-bottom:6px;">💖 Original V1 Chibi Warm Hug</div>
            <img src="/assets/museum/v1/chibi_warm_hug.png" alt="Chibi Warm Hug" style="max-height:175px;width:100%;object-fit:contain;border-radius:12px;border:2px solid #e6b450;" />
          </div>
          <div style="background:rgba(255,255,255,0.05);padding:8px;border-radius:14px;">
            <div style="font-size:11.5px;color:#ffe298;font-weight:800;margin-bottom:6px;">🖼️ Original V1 Window Scenery</div>
            <img src="${snapUrl}" alt="V1 Scenery" style="max-height:175px;width:100%;object-fit:cover;border-radius:12px;border:2px solid #e6b450;" />
          </div>
        </div>
        <div style="margin-top:12px;display:flex;justify-content:center;gap:8px;flex-wrap:wrap;">
          <button type="button" class="nm-pill active" data-nm-polaroid="1">📸 Snap "Then & Now" Polaroid</button>
          <button type="button" class="nm-pill" data-nm-close="1">💞 Keep Exploring Together</button>
        </div>
      </div>
    `;
  }

  closeModal() {
    if (this.modalEl) {
      this.modalEl.hidden = true;
    }
  }

  isModalOpen() {
    return Boolean(this.modalEl && !this.modalEl.hidden);
  }

  // -------------------------------------------------------------------------
  // Trigger Detection, Prompts & Interaction Dispatch
  // -------------------------------------------------------------------------
  bindEvents() {
    if (typeof document === 'undefined') return;
    this.promptEl = document.getElementById('landmark-prompt');
    if (!this.promptEl) {
      this.promptEl = document.getElementById('landmark-prompt');
      if (!this.promptEl) {
        this.promptEl = document.createElement('div');
        this.promptEl.id = 'landmark-prompt';
        this.promptEl.className = 'landmark-prompt';
        this.promptEl.hidden = true;
        const hud = document.getElementById('hud') || document.body;
        hud?.appendChild(this.promptEl);
      }
    }
    if (!this._boundPromptClick) {
      this._boundPromptClick = () => {
        if (this.active && this.currentPromptAction) {
          this.dispatch(this.currentPromptAction, this.currentPromptLandmarkId);
        }
      };
      this.promptEl.addEventListener('click', this._boundPromptClick);
    }
  }

  dispatch(action, landmarkId = null) {
    if (!action) return null;
    if (action === 'open_timeline') {
      return this.openTimelineModal();
    }
    if (action === 'open_directory') {
      return this.openPortalsDirectoryModal();
    }
    if (action.startsWith('exhibit:')) {
      const exId = action.slice('exhibit:'.length);
      return this.openExhibitModal(exId);
    }
    if (action.startsWith('portal:')) {
      const portalId = action.slice('portal:'.length);
      return this.enterPortal(portalId);
    }
    if (action === 'couple_pose') {
      return this.triggerCoupleMoment();
    }
    if (action === 'compare_v1') {
      this.showWarmHugKeepsakeBanner();
      return { ok: true, action: 'compare_v1' };
    }
    if (action === 'exit_portal') {
      this.exitPortalToHall();
      return { ok: true, action: 'exit_portal' };
    }
    if (action === 'exit_museum') {
      if (this.onAction) this.onAction('exit_museum', landmarkId);
      return { ok: true, action: 'exit_museum' };
    }
    if (this.onAction) {
      this.onAction(action, landmarkId);
    }
    return { ok: true, action, landmarkId };
  }

  renderPrompt(hit) {
    if (!this.promptEl) this.bindEvents();
    if (!this.active || !hit || this.isModalOpen()) {
      this.currentPromptLandmarkId = null;
      this.currentPromptKey = null;
      this.currentPromptAction = null;
      if (this.promptEl) {
        this.promptEl.hidden = true;
        delete this.promptEl.dataset.landmark;
      }
      return null;
    }

    const promptKey = `${this.currentPortalId || 'hall'}:${hit.id}:${hit.prompt || ''}`;
    if (this.currentPromptKey !== promptKey || this.promptEl?.hidden) {
      this.currentPromptLandmarkId = hit.id;
      this.currentPromptKey = promptKey;
      this.currentPromptAction = hit.action;
      if (this.promptEl) {
        this.promptEl.hidden = false;
        this.promptEl.dataset.landmark = hit.id;
        const icon = hit.icon || '✨';
        let cleanText = String(hit.prompt || hit.label || hit.title || '').trim();
        if (icon && cleanText.startsWith(icon)) {
          cleanText = cleanText.slice(icon.length).trim();
        }
        this.promptEl.innerHTML = `<span class="prompt-icon">${icon}</span><span class="prompt-text">${cleanText}</span><button class="prompt-btn" type="button">Interact</button>`;
      }
    }
    return hit;
  }

  getActiveTriggers() {
    if (this.currentPortalId) {
      const portal = MUSEUM_SCENERY_PORTALS.find((p) => p.id === this.currentPortalId) || MUSEUM_SCENERY_PORTALS[0];
      const linkedExhibit = MUSEUM_GACHA_EXHIBITS.find((ex) => ex.portalId === portal.id);
      const portalTriggers = [
        {
          id: 'couple_viewing_spot',
          kind: 'couple_spot',
          portalId: portal.id,
          icon: '💑',
          x: 0,
          z: 1.5,
          r: 2.6,
          action: 'couple_pose',
          prompt: `💑 ${portal.id === 'fuji' ? 'Mount Fuji' : portal.shortLabel} Couple Viewing Spot — Tap to Hold Hands & Compare V1 Snapshot!`,
        },
        {
          id: 'portal_v1_compare',
          kind: 'v1_compare',
          portalId: portal.id,
          icon: '🖼️',
          x: -2.8,
          z: -2.2,
          r: 2.2,
          action: 'compare_v1',
          prompt: `🖼️ Original V1 Artwork: ${portal.title} • Tap to Compare`,
        },
        {
          id: 'exit_portal',
          kind: 'exit_portal',
          portalId: portal.id,
          icon: '🌀',
          x: 7.8,
          z: 6.2,
          r: 2.5,
          action: 'exit_portal',
          prompt: '🌀 Return to NookAirline V1 Museum Hall',
        },
      ];
      if (linkedExhibit) {
        portalTriggers.push({
          id: `couture_${portal.id}`,
          kind: 'exhibit',
          portalId: portal.id,
          icon: linkedExhibit.icon || '👗',
          x: -7.6,
          z: 5.4,
          r: 2.2,
          action: `exhibit:${linkedExhibit.id}`,
          prompt: `${linkedExhibit.icon || '👗'} ${linkedExhibit.season} Couture: ${linkedExhibit.title} • Tap to Inspect`,
        });
      }
      return portalTriggers;
    }

    // Main Museum Hall Triggers: Zone A (Rotunda) + Zone B (World Directory) + Zone E (Couple Spot) + 12 Gacha Exhibits + 16 Portals + South Exit Gate
    const triggers = [
      {
        id: 'rotunda_chronicle',
        kind: 'rotunda',
        icon: '🦉',
        x: 0,
        z: 0,
        r: 2.8,
        action: 'open_timeline',
        prompt: '🦉 Legacy Monument — V1 → V2 memories • Tap to open Chronicle',
      },
      {
        id: 'world_directory',
        kind: 'directory',
        icon: '📖',
        x: -3.2,
        z: 0.8,
        r: 2.2,
        action: 'open_directory',
        prompt: '📖 World Directory — View all 16 worlds',
      },
      {
        id: 'lobby_couple_spot',
        kind: 'couple_spot',
        icon: '🌸',
        x: 4.5,
        z: 0.8,
        r: 2.5,
        action: 'couple_pose',
        prompt: '🌸 Couple Viewing Spot — Hold hands, pose & take Polaroid',
      },
      {
        id: 'exit_museum',
        kind: 'exit',
        icon: '🛫',
        x: 0,
        z: 14.8,
        r: 2.6,
        action: 'exit_museum',
        prompt: '🛫 Return to Village / Town Hall',
      },
    ];

    for (const ex of MUSEUM_GACHA_EXHIBITS) {
      triggers.push({
        id: ex.id,
        kind: 'exhibit',
        icon: ex.icon || '🎨',
        x: ex.x,
        z: ex.z,
        r: ex.r || 2.3,
        action: `exhibit:${ex.id}`,
        prompt: `${ex.icon || '🎨'} ${ex.title} • Tap to View V1 Banner & Costumes`,
      });
    }

    for (const p of MUSEUM_SCENERY_PORTALS) {
      triggers.push({
        id: p.id,
        portalId: p.id,
        kind: 'portal',
        icon: '🌀',
        x: p.x,
        z: p.z,
        r: p.r || 2.4,
        action: `portal:${p.id}`,
        prompt: `🌀 Portal: ${p.title} • Step In Together!`,
      });
    }

    return triggers;
  }

  checkTrigger(px, pz) {
    if (!this.active) {
      return this.renderPrompt(null);
    }
    const triggers = this.getActiveTriggers();
    let best = null;
    let bestDist = Infinity;
    for (const t of triggers) {
      const d = Math.hypot(px - t.x, pz - t.z);
      if (d <= (t.r || 2.4) && d < bestDist) {
        best = t;
        bestDist = d;
      }
    }
    return this.renderPrompt(best);
  }

  pick(cx, cy) {
    if (!this.active || !this.world?.canvas || !this.world?.camera) return null;
    const r = this.world.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.world.camera);
    const targetGroup = this.currentPortalId ? this.realmGroup : this.landmarksGroup;
    const hits = ray.intersectObjects(targetGroup.children, true);
    if (!hits.length) return null;
    for (const h of hits) {
      let cur = h.object;
      while (cur && cur !== targetGroup) {
        if (cur.userData?.action) {
          this.dispatch(cur.userData.action, cur.userData.landmarkId);
          return {
            kind: 'museum_interactive',
            landmarkId: cur.userData.landmarkId,
            action: cur.userData.action,
          };
        }
        cur = cur.parent;
      }
    }
    return null;
  }

  isWalkable(x, z, pad = 0.25) {
    const limit = NOOK_MUSEUM.HALF - pad;
    return Math.abs(x) <= limit && Math.abs(z) <= limit;
  }

  clampWalkable(x, z) {
    const limit = NOOK_MUSEUM.HALF - 0.5;
    return {
      x: Math.max(-limit, Math.min(limit, x)),
      z: Math.max(-limit, Math.min(limit, z)),
    };
  }

  setActive(flag) {
    const next = Boolean(flag);
    this.active = next;
    this.root.visible = this.active;

    if (this.scene) {
      if (this.active) {
        if (this._savedSceneBg === undefined) {
          this._savedSceneBg = this.scene.background;
        }
        this.scene.background = buildMuseumSkyTexture();
      } else if (this._savedSceneBg !== undefined) {
        this.scene.background = this._savedSceneBg;
      }
    }

    if (this.world?.plaza?.root) {
      this.world.plaza.root.visible = !this.active;
    }
    if (this.world?.villagePlaza?.root) {
      this.world.villagePlaza.root.visible = !this.active;
    }

    if (this.active) {
      this.ensureDomOverlays();
      this.updateHud();
      this.syncPartnerFollow(true);
      this.world?.resize?.();
      if (typeof setTimeout === 'function') {
        setTimeout(() => this.world?.resize?.(), 30);
      }
      if (this.world?.local) {
        this.checkTrigger(this.world.local.x, this.world.local.z);
      }
    } else {
      if (this._keepsakeModalTimer) {
        clearTimeout(this._keepsakeModalTimer);
        this._keepsakeModalTimer = null;
      }
      this.stopMusicBox();
      this.closeModal();
      this.updateHud();
      this.renderPrompt(null);
      this.world?.resize?.();
      if (typeof setTimeout === 'function') {
        setTimeout(() => this.world?.resize?.(), 30);
      }
    }
  }

  update(dt = 0.016, _camera = null, pitch = null) {
    if (!this.active) return;
    if (this.world?.plaza?.root && this.world.plaza.root.visible) {
      this.world.plaza.root.visible = false;
    }
    this.elapsed += dt;

    // Align Main Hall & Portal Room 2.5D billboard sprites with the Village camera pitch
    if (!this.currentPortalId && this.leanSprites?.length) {
      const targetRotX = Number.isFinite(pitch) ? -pitch : VILLAGE_PITCH_RAD;
      for (let i = 0; i < this.leanSprites.length; i++) {
        const m = this.leanSprites[i];
        if (m.userData?.lean) {
          m.rotation.x = targetRotX;
        }
      }
    } else if (this.currentPortalId && this.realmLeanSprites?.length) {
      const targetRotX = Number.isFinite(pitch) ? -pitch : THREE.MathUtils.degToRad(-34);
      for (let i = 0; i < this.realmLeanSprites.length; i++) {
        const m = this.realmLeanSprites[i];
        if (m.userData?.lean) {
          m.rotation.x = targetRotX;
        }
      }
    }

    // Gentle floating plaques
    for (let i = 0; i < this.floatingPlaques.length; i++) {
      const sp = this.floatingPlaques[i];
      const base = sp.userData?.baseY ?? sp.position.y;
      const phase = sp.userData?.phase ?? 0;
      sp.position.y = base + Math.sin(this.elapsed * 2.1 + phase) * 0.045;
    }

    // Rotating portal magic circles on the floor
    for (let i = 0; i < this.portalRings.length; i++) {
      this.portalRings[i].rotation.y += dt * 0.45;
    }

    // Pulsing portal halos
    for (let i = 0; i < this.glowHalos.length; i++) {
      const h = this.glowHalos[i];
      const baseScale = h.userData?.baseScale ?? 3.0;
      const pulse = Math.sin(this.elapsed * 2.2 + (h.userData?.phase ?? 0));
      const s = baseScale * (1 + pulse * 0.06);
      h.scale.set(s, s, 1);
    }

    // 3D Atmospheric Romantic Particles inside any active 2.5D Portal (`this.petalParticles`)
    if (this.currentPortalId && this.petalParticles.length > 0) {
      for (let i = 0; i < this.petalParticles.length; i++) {
        const p = this.petalParticles[i];
        const ud = p.userData;
        p.position.x += ud.vx * dt + Math.sin(this.elapsed * 1.6 + ud.phase) * 0.008;
        p.position.y += ud.vy * dt;
        p.position.z += ud.vz * dt;
        p.rotation.x += dt * 1.1;
        p.rotation.z += dt * 0.85;
        if (ud.upward) {
          if (p.position.y > 7.2 || Math.abs(p.position.x) > 15) {
            p.position.x = (Math.random() - 0.5) * 22;
            p.position.y = 0.35 + Math.random() * 1.2;
            p.position.z = -9 + Math.random() * 14;
          }
        } else if (p.position.y < 0.15 || p.position.x < -14) {
          p.position.x = 12 + Math.random() * 4;
          p.position.y = 4.8 + Math.random() * 2.6;
          p.position.z = -9 + Math.random() * 14;
        }
      }
    }

    // Sync AI companion partner to walk beside you
    this.syncPartnerFollow(false);

    if (this.world?.local) {
      this.checkTrigger(this.world.local.x, this.world.local.z);
    }
  }

  dispose() {
    if (this._keepsakeModalTimer) {
      clearTimeout(this._keepsakeModalTimer);
      this._keepsakeModalTimer = null;
    }
    this.stopMusicBox();
    this.renderPrompt(null);
    this.closeModal();
    if (this.hudEl) this.hudEl.hidden = true;
    if (this.pipEl) this.pipEl.hidden = true;
    if (this.quoteEl) this.quoteEl.hidden = true;
    if (this.promptEl && this._boundPromptClick) {
      this.promptEl.removeEventListener('click', this._boundPromptClick);
      this._boundPromptClick = null;
    }
    this.scene?.remove(this.root);
  }
}
