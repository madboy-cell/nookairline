/**
 * Nook Airline — Costume Catalog (shared by browser + server)
 *
 * Classic outfits live in avatar.js (MAPLE_CHARACTERS) and are free for everyone.
 * Season costumes are gacha-only, role-bound (BKK pulls the guy version, DXB the girl
 * version) and carry one mini-game perk that only applies while equipped.
 *
 * Perk effects are namespaced per mini-game (`effects.monopoly`) so future games can
 * define what each costume does for them without touching the wardrobe.
 */
(function (root) {
  const RARITY = {
    rare:   { id: 'rare',   label: 'RARE',   stars: '⭐',       color: '#60a5fa', rank: 1, dust: 10,  shop: 60 },
    epic:   { id: 'epic',   label: 'EPIC',   stars: '⭐⭐',     color: '#c084fc', rank: 2, dust: 40,  shop: 200 },
    mythic: { id: 'mythic', label: 'MYTHIC', stars: '⭐⭐⭐',   color: '#fbbf24', rank: 3, dust: 150, shop: 800 }
  };

  const ECONOMY = {
    WELCOME_GIFT: 15000,
    WIN: 500,
    LOSS: 200,
    PER_VIBE_MATCH: 35,   // Bumped from 10 to 35💎 for dopamine and couple chemistry
    DAILY_FIRST_GAME: 50,
    PULL_1: 100,
    PULL_10: 900,
    RATES: { rare: 0.80, epic: 0.17, mythic: 0.03 },
    EPIC_PITY: 10,        // every 10th pull without an Epic+ is guaranteed Epic+
    MYTHIC_SOFT_PITY: 45, // mythic chance ramps up from here...
    MYTHIC_SOFT_STEP: 0.06,
    MYTHIC_HARD_PITY: 60, // ...and is guaranteed here
    BOT: {
      EASY_WIN: 50,
      EASY_LOSS: 10,
      HARD_STAKE: 100,
      HARD_COMEBACK_STAKE: 50,
      HARD_WIN: 400,
      HARD_LOSS: 0,
      INSANE_STAKE: 150,
      INSANE_COMEBACK_STAKE: 75,
      INSANE_WIN: 950,
      INSANE_LOSS: 50,
      STREAK_BONUS_PER_WIN: 50,
      MAX_STREAK_BONUS: 200,
      MIN_ROUNDS_PLAUSIBLE: 6
    },
    BOT_DEMOLITION_BOUNTY: 100, // +100💎 when a human demolishes or seizes a bot property
    // 🏆 First-Class 3P/4P Party Economy (Option 1 High-Roller Prestige Scale)
    PARTY_REWARDS: {
      // 2 Humans + 2 Insane Bots (Apex Extreme Threat)
      apex_extreme: {
        id: 'apex_extreme',
        name: 'Apex Sovereign Clash (2 Insane Bots)',
        first:  { diamonds: 1350, tickets: 1, fish: 10, stardust: 60 },
        second: { diamonds: 750,  tickets: 0, fish: 6,  stardust: 35 },
        third:  { diamonds: 350,  tickets: 0, fish: 3,  stardust: 20 },
        fourth: { diamonds: 200,  tickets: 0, fish: 2,  stardust: 10 },
        syndicateDividend: 250,
        syndicateRescue3rd: 150,
        syndicateRescue4th: 100
      },
      // 2 Humans + 1 Insane + 1 Hard Bot (High Insane Threat)
      high_insane: {
        id: 'high_insane',
        name: 'Sovereign Threat (1 Insane + 1 Hard Bot)',
        first:  { diamonds: 1100, tickets: 1, fish: 8, stardust: 50 },
        second: { diamonds: 600,  tickets: 0, fish: 5, stardust: 30 },
        third:  { diamonds: 300,  tickets: 0, fish: 3, stardust: 15 },
        fourth: { diamonds: 180,  tickets: 0, fish: 2, stardust: 10 },
        syndicateDividend: 220,
        syndicateRescue3rd: 140,
        syndicateRescue4th: 90
      },
      // 2 Humans + 2 Hard Bots (Extreme Threat)
      extreme: {
        id: 'extreme',
        name: 'Extreme Threat (2 Hard Bots)',
        first:  { diamonds: 950, tickets: 1, fish: 8, stardust: 45 },
        second: { diamonds: 550, tickets: 0, fish: 5, stardust: 25 },
        third:  { diamonds: 250, tickets: 0, fish: 3, stardust: 15 },
        fourth: { diamonds: 150, tickets: 0, fish: 2, stardust: 10 },
        syndicateDividend: 200,
        syndicateRescue3rd: 120,
        syndicateRescue4th: 80
      },
      // 2 Humans + 1 Hard + 1 Easy Bot (High Threat)
      high: {
        id: 'high',
        name: 'High Threat (1 Hard + 1 Easy Bot)',
        first:  { diamonds: 700, tickets: 0, fish: 6, stardust: 35 },
        second: { diamonds: 400, tickets: 0, fish: 4, stardust: 20 },
        third:  { diamonds: 200, tickets: 0, fish: 2, stardust: 10 },
        fourth: { diamonds: 120, tickets: 0, fish: 1, stardust: 5 },
        syndicateDividend: 150,
        syndicateRescue3rd: 100,
        syndicateRescue4th: 70
      },
      // 2 Humans + 2 Easy Bots (Standard Party)
      standard: {
        id: 'standard',
        name: 'Standard Party (2 Easy Bots)',
        first:  { diamonds: 450, tickets: 0, fish: 5, stardust: 25 },
        second: { diamonds: 250, tickets: 0, fish: 3, stardust: 15 },
        third:  { diamonds: 150, tickets: 0, fish: 2, stardust: 10 },
        fourth: { diamonds: 80,  tickets: 0, fish: 1, stardust: 5 },
        syndicateDividend: 100,
        syndicateRescue3rd: 60,
        syndicateRescue4th: 40
      },
      // 2 Humans + 1 Insane Bot (3P Insane)
      insane_3p: {
        id: 'insane_3p',
        name: 'Apex Flight (1 Insane Bot)',
        first:  { diamonds: 950, tickets: 1, fish: 7, stardust: 45 },
        second: { diamonds: 520, tickets: 0, fish: 5, stardust: 25 },
        third:  { diamonds: 260, tickets: 0, fish: 3, stardust: 15 },
        syndicateDividend: 200,
        syndicateRescue3rd: 120
      },
      // 2 Humans + 1 Hard Bot (3P Hard)
      hard_3p: {
        id: 'hard_3p',
        name: 'High Threat (1 Hard Bot)',
        first:  { diamonds: 750, tickets: 1, fish: 6, stardust: 35 },
        second: { diamonds: 420, tickets: 0, fish: 4, stardust: 20 },
        third:  { diamonds: 220, tickets: 0, fish: 2, stardust: 12 },
        syndicateDividend: 160,
        syndicateRescue3rd: 100
      },
      // 2 Humans + 1 Easy Bot (3P Easy)
      easy_3p: {
        id: 'easy_3p',
        name: 'Relaxed Flight (1 Easy Bot)',
        first:  { diamonds: 450, tickets: 0, fish: 4, stardust: 20 },
        second: { diamonds: 260, tickets: 0, fish: 3, stardust: 12 },
        third:  { diamonds: 140, tickets: 0, fish: 2, stardust: 8 },
        syndicateDividend: 100,
        syndicateRescue3rd: 60
      },
      // 2P Couple Duel (Classic BKK vs DXB)
      couple: {
        id: 'couple',
        name: 'Couple Duel (First-Class)',
        first:  { diamonds: 500, tickets: 0, fish: 3, stardust: 20 },
        second: { diamonds: 200, tickets: 0, fish: 2, stardust: 10 }
      },
      // Solo Gauntlet: 1 Human vs 3 Insane Bots
      gauntlet_insane: {
        id: 'gauntlet_insane',
        name: 'Apex Gauntlet (vs 3 Insane Bots)',
        first:  { diamonds: 1800, tickets: 2, fish: 12, stardust: 80 },
        consolation: { diamonds: 150, tickets: 0, fish: 2, stardust: 10 }
      },
      // Solo Gauntlet: 1 Human vs 3 Hard Bots
      gauntlet_hard: {
        id: 'gauntlet_hard',
        name: 'Solo Gauntlet (vs 3 Hard Bots)',
        first:  { diamonds: 1200, tickets: 1, fish: 8, stardust: 50 },
        consolation: { diamonds: 80, tickets: 0, fish: 1, stardust: 5 }
      },
      // Solo Gauntlet: 1 Human vs 3 Easy Bots
      gauntlet_easy: {
        id: 'gauntlet_easy',
        name: 'Training Gauntlet (vs 3 Easy Bots)',
        first:  { diamonds: 400, tickets: 0, fish: 4, stardust: 20 },
        consolation: { diamonds: 30, tickets: 0, fish: 1, stardust: 5 }
      }
    }
  };

  const SEASONS = {
    main: {
      id: 'main',
      name: 'Sky Classic: Grand All-Stars',
      tagline: 'Permanent collection of all legendary realms & future destinies ✈️✨💎',
      icon: '⭐',
      banner: 'assets/ui/banner_main.jpg?v=20261013v1',
      isMain: true,
      endsAt: null
    },
    s1: {
      id: 's1',
      name: 'Bangkok After Dark',
      tagline: 'Her first nights landing in the City of Angels 🌃',
      icon: '🌃',
      banner: 'assets/ui/banner_s1.jpg',
      archived: true,
      endsAt: 1791000000000
    },
    s2: {
      id: 's2',
      name: 'Tokyo Sakura Reverie',
      tagline: 'Moonlit Shibuya & ethereal cherry blossom memories 🌸',
      icon: '🌸',
      banner: 'assets/ui/banner_s2.jpg'
    },
    s3: {
      id: 's3',
      name: 'Dubai Desert Mirage',
      tagline: 'Golden dunes, starlit Arabian nights & Burj luxury 🏜️',
      icon: '🏜️',
      banner: 'assets/ui/banner_s3.jpg'
    },
    s4: {
      id: 's4',
      name: 'Monte Carlo Casino Royale',
      tagline: 'High-stakes roulette, velvet penthouses & French Riviera glamour 🎰✨',
      icon: '🎰',
      banner: 'assets/ui/banner_s4.jpg'
    },
    s5: {
      id: 's5',
      name: 'Atlantis: Bioluminescent Abyss',
      tagline: 'Sunken crystal spires, luminous leviathans & abyssal siren song 🔱💎🪼',
      icon: '🔱',
      banner: 'assets/ui/banner_s5.jpg'
    },
    s6: {
      id: 's6',
      name: 'Starlight Odyssey: Celestial Gala',
      tagline: 'Dancing across moonlit nebulae, cosmic roulette & starlit eternity 🌌💫🪐',
      icon: '🌌',
      banner: 'assets/ui/banner_s6.jpg'
    },
    s7: {
      id: 's7',
      name: 'Enchanted Fairytales & Royal Crowns',
      tagline: 'Floating lanterns, midnight clockwork & timeless fairytale romance 👑🏮✨',
      icon: '👑',
      banner: 'assets/ui/banner_s7.jpg'
    },
    s8: {
      id: 's8',
      name: 'Nordic Aurora & Glacial Royalty',
      tagline: 'Glacial ice spires, dancing Nordic auroras & tyrannical absolute zero ❄️👑✨',
      icon: '❄️',
      banner: 'assets/ui/banner_s8.jpg'
    },
    s9: {
      id: 's9',
      name: 'Egyptian Mirage & Solar Dynasty',
      tagline: 'Molten gold pyramids, starlit Nile waters & the blazing Eye of Ra 🏺☀️👑',
      icon: '☀️',
      banner: 'assets/ui/banner_s9.jpg'
    },
    s10: {
      id: 's10',
      name: 'Phantom Masquerade: The Grand Carnival of Fate',
      tagline: 'Venetian Gothic romance, mysterious masquerade balls & reverse rent fate 🎭🥀✨',
      icon: '🎭',
      banner: 'assets/ui/banner_s10.jpg'
    },
    s11: {
      id: 's11',
      name: 'Pantheon of the Gods: Olympus Thunder & The Elysian Forge',
      tagline: 'Mount Olympus thunderbolts, divine Aegis protection & golden forge mastery ⚡🏛️👑',
      icon: '⚡',
      banner: 'assets/ui/banner_s11.jpg'
    }
  };

  // Each perk: shown text + effects consumed by mini-games.
  const PERKS = {
    // S1 Perks
    happy_hour:   { icon: '🍸', name: 'Happy Hour',      desc: 'Start every Monopoly game with +100 miles.',               effects: { monopoly: { startMiles: 100 } } },
    street_smart: { icon: '🍢', name: 'Street Smart',    desc: 'Passing START pays +40 more (240 instead of 200).',        effects: { monopoly: { lapBonus: 40 } } },
    pit_crew:     { icon: '🛺', name: 'Pit Crew',        desc: 'Casino 💀 curse only costs you 100 instead of 200.',       effects: { monopoly: { skullShield: 100 } } },
    splash_zone:  { icon: '💦', name: 'Splash Zone',     desc: 'Airdrop crates also drop +50 miles.',                     effects: { monopoly: { airdropBonus: 50 } } },
    clinch:       { icon: '🥊', name: 'Clinch',          desc: 'You win ties when YOU attack in a Takeover duel.',        effects: { monopoly: { duelTieWin: true } } },
    smooth_sail:  { icon: '🛳️', name: 'Smooth Sailing',  desc: '+1 Clash Token every game (3 instead of 2).',             effects: { monopoly: { extraVibePass: 1 } } },
    lucky_red:    { icon: '🏮', name: 'Lucky Red',       desc: 'Your first Black Market item each game is 25% off.',      effects: { monopoly: { marketDiscount: 0.25 } } },
    celestial:    { icon: '🐉', name: 'The Emerald Naga Fireballs & Sacred Mekong Rapids', desc: 'Rolling 6 launches 3 Naga Fireballs (บั้งไฟพญานาค) transmuting the 3 highest properties into Sacred Waterways (+30% rent; sweeping rivals downstream 2 tiles into your hotels). Kinnaree Glide soars over 2 hazard tiles dropping +35🪙 lotus petals. Start with 🎲 Golden Dice & +130 miles.', effects: { monopoly: { nagaFireballs: true, sacredWaterways: true, kinnareeGlide: true, startItem: 'golden_dice', startMiles: 130, lapBonus: 50, mekongHoard: 0.15 } } },

    // S2 Perks
    inari_blessing:    { icon: '🦊', name: 'Kitsune Mirage Torii & Nine-Tail Foxfire', desc: 'Passing Start/Airports places an illuminated Torii Gate: the next rival entering suffers Foxfire Confusion (dice direction inverted backward into your shrine!). 3 Spirit Tails negate fatal rent & hex land (+40🪙 spirit tribute). Rolling 6 restores +1 Tail. Start with 🎲 Golden Dice & +120 miles.', effects: { monopoly: { mirageTorii: true, foxfireConfusion: true, foxfireWard: 0.25, startItem: 'golden_dice', startMiles: 120, lapBonus: 50 } } },
    celestial_eclipse: { icon: '🌓', name: 'Total Lunar Blackout & Somnambulism Trance', desc: 'Living celestial cycle: Odd rolls trigger Solar Dawn (blinding flare halves rival rent). Even rolls trigger Lunar Twilight (-30% rent paid & silver moon shield). Rolling 6 plunges the board into Total Lunar Blackout (rivals sleepwalk 3 tiles forward into your properties paying 1.5× Nightmare Toll!). Start with Rent Shield & +130 miles.', effects: { monopoly: { eclipseBalance: true, totalEclipseBlackout: true, somnambulismSleepwalk: true, solarHeatstroke: true, startItem: 'shield', startMiles: 130, lapBonus: 55 } } },
    festival_fortune:  { icon: '🎆', name: 'Festival Fortune',  desc: 'Passing START pays +60 more (260 instead of 200).',               effects: { monopoly: { lapBonus: 60 } } },
    chill_beats:       { icon: '🎧', name: 'Chill Beats',       desc: '+1 Clash Token every game and start with +80 miles.',             effects: { monopoly: { extraVibePass: 1, startMiles: 80 } } },
    noble_presence:    { icon: '⚔️', name: 'Noble Presence',    desc: 'You win ties when YOU attack in a Takeover duel.',                effects: { monopoly: { duelTieWin: true } } },
    overclock:         { icon: '⚡', name: 'Overclock',         desc: 'Start every game holding a Swap Portal.',                         effects: { monopoly: { startItem: 'swap' } } },
    zen_mind:          { icon: '🍵', name: 'Zen Mind',          desc: 'Casino 💀 curse only costs you 100 instead of 200.',               effects: { monopoly: { skullShield: 100 } } },
    trendsetter:       { icon: '🍭', name: 'Trendsetter',       desc: 'Your first Black Market item each game is 25% off.',              effects: { monopoly: { marketDiscount: 0.25 } } },
    lucky_token:       { icon: '🕹️', name: 'Arcade Rush',       desc: 'Airdrop crates drop +60 miles.',                                  effects: { monopoly: { airdropBonus: 60 } } },
    hot_broth:         { icon: '🍜', name: 'Steaming Broth',    desc: 'Start every Monopoly game with +120 miles.',                       effects: { monopoly: { startMiles: 120 } } },
    sweet_start:       { icon: '♨️', name: 'Onsen Warmth',      desc: 'Passing START pays +45 more (245 instead of 200).',                effects: { monopoly: { lapBonus: 45 } } },
    express_line:      { icon: '🚄', name: 'Shinkansen Express', desc: 'Start every Monopoly game with +150 miles.',                      effects: { monopoly: { startMiles: 150 } } },

    // S3 Perks (Dubai Desert Mirage)
    mirage_siphon:     { icon: '🪔', name: 'Cosmic Djinn Lamp & 3 Legendary Wishes', desc: 'Traversing tiles charges the Magic Lamp with Wish Dust. Rolling 5 or 6 unseals the Cosmic Djinn: grants 1 of 3 Legendary Wishes (Oasis Tile Swap, Midas Gold Transmutation, or Carpet Flight). Magic carpet permanently ignores hazard/casino curses. Start with Swap Portal & +130 miles.', effects: { monopoly: { wishSelector: true, mirageOasisSwap: true, midasTouchTransmute: true, carpetDoublesImmunity: true, startItem: 'swap', startMiles: 130, lapBonus: 60 } } },
    demolition_sultan: { icon: '🔥', name: 'Sacred Phoenix Rebirth & Underdog Inferno', desc: 'When behind (3rd/4th place), enters Inferno Stance: steps leave Scorched Fire Footprints (40🪙 heat siphoned from rivals) & construction cost cut by 50%! Voluntary Sunfire Immolation can be cast when ahead to vaporize rival shields. 1-time fatal Supernova Rebirth revives to 300🪙. Start with C4 & +130 miles.', effects: { monopoly: { underdogHeatFootprints: true, sunfireImmolation: true, phoenixRebirth: true, startItem: 'c4', startMiles: 130, lapBonus: 60 } } },
    royal_falconry:    { icon: '🦅', name: 'Royal Falconry',     desc: 'Start every game holding a Golden Dice and pass START pays +70.', effects: { monopoly: { startItem: 'golden_dice', lapBonus: 70 } } },
    dune_drifter:      { icon: '🏎️', name: 'Dune Drifter',       desc: 'Passing START pays +80 more (280 instead of 200).',               effects: { monopoly: { lapBonus: 80 } } },
    oasis_sanctuary:   { icon: '🛡️', name: 'Oasis Sanctuary',    desc: 'Start every game holding a Rent Shield, and Casino curse costs 100 less.', effects: { monopoly: { startItem: 'shield', skullShield: 100 } } },
    cyber_mirage:      { icon: '🌀', name: 'Cyber Mirage',       desc: 'Start every game holding a Swap Portal and +90 miles.',           effects: { monopoly: { startItem: 'swap', startMiles: 90 } } },
    gahwa_hospitality: { icon: '🏺', name: 'Gahwa Hospitality',  desc: 'Start every Monopoly game with +180 miles.',                       effects: { monopoly: { startMiles: 180 } } },
    dune_explorer:     { icon: '🚙', name: 'Dune Explorer',      desc: 'Start every Monopoly game with +140 miles.',                       effects: { monopoly: { startMiles: 140 } } },
    cardamom_brew:     { icon: '☕', name: 'Cardamom Brew',      desc: 'Passing START pays +50 more (250 instead of 200).',                effects: { monopoly: { lapBonus: 50 } } },
    gold_caravan:      { icon: '🪙', name: 'Gold Caravan',       desc: 'Airdrop crates drop +70 miles.',                                  effects: { monopoly: { airdropBonus: 70 } } },
    gulf_admiral:      { icon: '🛥️', name: 'Gulf Admiral',       desc: 'You win ties when YOU attack in a Takeover duel.',                effects: { monopoly: { duelTieWin: true } } },
    pearl_diver:       { icon: '🦪', name: 'Pearl Diver',        desc: 'Casino curse costs 100 less, and start with +60 miles.',           effects: { monopoly: { skullShield: 100, startMiles: 60 } } },

    // S4 Perks (Monte Carlo Casino Royale)
    vip_express:       { icon: '🍸', name: 'VIP Dividend & High-Roller Express', desc: 'Turn 1 launches straight to Sky Casino with loaded jackpot odds (neutralizes skull curse). Landing on own Grand Hotel pays +60🪙 VIP dividend! High-Roller House Rake collects +15% rent on your domain. +80 on Start.', effects: { monopoly: { firstRollCasino: true, loadedSlots: true, skullShield: 200, casinoRake: 0.15, lapBonus: 80 } } },
    loaded_battle_dice:{ icon: '🎲', name: 'Loaded Battle Dice & Grand Rake', desc: 'Takeover Duels roll min 3 and win all ties. High-Roller House Rake collects +15% bonus miles on your domain! Landing on own Grand Hotel pays +60🪙 VIP dividend. 20% upgrade discount. Start with Rent Shield & +140 miles.', effects: { monopoly: { duelMinRoll: 3, duelTieWin: true, casinoRake: 0.15, upgradeDiscount: 0.2, startItem: 'shield', startMiles: 140 } } },
    royal_bluff:       { icon: '🌀', name: 'Royal Bluff',             desc: 'Start game holding a Swap Portal and +90 miles.',                   effects: { monopoly: { startItem: 'swap', startMiles: 90 } } },
    riviera_siphon:    { icon: '🧲', name: 'Riviera Siphon',          desc: 'Start game holding a Magnet to siphon miles from the richest rival, and +60 miles.', effects: { monopoly: { startItem: 'magnet', startMiles: 60 } } },
    triple_seven:      { icon: '⚡', name: 'Triple Seven',            desc: 'Airdrop crates drop +80 miles and passing START pays +50 more.',     effects: { monopoly: { airdropBonus: 80, lapBonus: 50 } } },
    vault_breaker:     { icon: '💣', name: 'Vault Breaker',           desc: 'Start game holding a C4 Remote Bomb to demolish rival hotels, and +80 miles.', effects: { monopoly: { startItem: 'c4', startMiles: 80 } } },
    dealers_cut:       { icon: '🃏', name: "Dealer's Cut",            desc: 'First Black Market item each game is 25% off.',                      effects: { monopoly: { marketDiscount: 0.25 } } },
    velvet_rope:       { icon: '🍾', name: 'Velvet Rope',             desc: 'Start every Monopoly game with +150 miles.',                       effects: { monopoly: { startMiles: 150 } } },
    hot_hand:          { icon: '🎲', name: 'Hot Hand',                desc: 'Passing START pays +45 more (245 instead of 200).',                effects: { monopoly: { lapBonus: 45 } } },
    eye_in_the_sky:    { icon: '🕶️', name: 'Eye in the Sky',           desc: 'Casino 💀 curse penalty costs 100 less.',                          effects: { monopoly: { skullShield: 100 } } },
    grand_prix_sprint: { icon: '🏎️', name: 'Grand Prix Sprint',        desc: 'Passing START pays +40 more (240 instead of 200).',                effects: { monopoly: { lapBonus: 40 } } },
    sleight_of_hand:   { icon: '🎩', name: 'Sleight of Hand',         desc: '+1 Clash Token every game (3 instead of 2).',                      effects: { monopoly: { extraVibePass: 1 } } },

    // S5 Perks (Atlantis: Bioluminescent Abyss)
    tidal_surge_ward:   { icon: '🔱', name: 'Abyssal Coral Palace & Claimed Property Flooding', desc: 'Floods ANY tile (even in late game!): rival hotels become Sunken Ruins (0 rent for 2 rounds unless 60🪙 drainage paid); own hotels become Coral Palaces (+30% rent & nitrogen sickness item lock). Flooded tiles form an Ocean Trench allowing instant cross-board warping. Start with Rent Shield & +140 miles.', effects: { monopoly: { claimedTileFlooding: true, coralPalace: true, trenchWarp: true, pearlWard: true, startItem: 'shield', startMiles: 140, lapBonus: 60, duelTieWin: true } } },
    bioluminescent_drift:{ icon: '🪼', name: 'Bioluminescent Abyss Drift', desc: 'Ocean currents drift you +1 extra tile on every dice roll! Unbought tiles dredge up sunken glowing pearls (+50 miles / discount). Start with Golden Dice, +100 miles, lap bonus +60, and Skull Shield 100.', effects: { monopoly: { oceanDrift: 1, startItem: 'golden_dice', startMiles: 100, lapBonus: 60, skullShield: 100 } } },
    deep_pressure:      { icon: '🤿', name: 'Deep Pressure',          desc: 'Start game holding a C4 Remote Bomb to demolish rival hotels, and +100 miles.', effects: { monopoly: { startItem: 'c4', startMiles: 100 } } },
    reef_agility:       { icon: '🤺', name: 'Reef Agility',           desc: 'You win ties when YOU attack in Takeover duels. Start with a Rent Shield.', effects: { monopoly: { duelTieWin: true, startItem: 'shield' } } },
    sunken_doubloons:   { icon: '🏴‍☠️', name: 'Sunken Doubloons',       desc: 'Airdrop crates drop +90 miles and start game with +80 miles.', effects: { monopoly: { airdropBonus: 90, startMiles: 80 } } },
    living_sanctuary:   { icon: '🪸', name: 'Living Sanctuary',       desc: 'Casino 💀 curse penalty costs 150 less. Start with a Swap Portal.', effects: { monopoly: { skullShield: 150, startItem: 'swap' } } },
    pearl_harvest:      { icon: '🦪', name: 'Pearl Harvest',          desc: 'Start every Monopoly game with +140 miles.', effects: { monopoly: { startMiles: 140 } } },
    sonar_scan:         { icon: '📡', name: 'Sonar Scan',             desc: 'First Black Market item each game is 25% off, and start with +60 miles.', effects: { monopoly: { marketDiscount: 0.25, startMiles: 60 } } },
    abyssal_cocktail:   { icon: '🍸', name: 'Abyssal Cocktail',       desc: 'Start every Monopoly game with +150 miles.', effects: { monopoly: { startMiles: 150 } } },
    equestrian_current: { icon: '🎠', name: 'Equestrian Current',     desc: 'Passing START pays +45 more (245 instead of 200).', effects: { monopoly: { lapBonus: 45 } } },
    tidal_anthem:       { icon: '🎺', name: 'Tidal Anthem',           desc: 'Passing START pays +40 more (240 instead of 200).', effects: { monopoly: { lapBonus: 40 } } },
    bubble_vibe:        { icon: '🫧', name: 'Bubble Vibe',            desc: '+1 Clash Token every game (3 instead of 2).', effects: { monopoly: { extraVibePass: 1 } } },

    // S6 Perks (Starlight Odyssey: Celestial Gala)
    supernova_overdrive: { icon: '☄️', name: 'Supernova Velocity Overdrive',   desc: 'Rolling a 6 ignites Supernova Velocity for an INSTANT bonus roll! Opponents stepping on your stardust trail trigger star chimes and pay +15 stardust toll. Start with 🎲 Golden Dice, +120 miles, and +65 lap bonus.', effects: { monopoly: { supernova6: true, startItem: 'golden_dice', startMiles: 120, lapBonus: 65 } } },
    astral_aegis_tithe:  { icon: '🌌', name: 'The Cosmic Stardust Sovereign & Star Tithe',  desc: '15% Star Tithe siphons cash from any rival entering your domain! Constellation Rebirth negates fatal bankruptcy once (+180 miles)! Leaves stardust trails (+15 toll). Start with Rent Shield & +140 miles.', effects: { monopoly: { starTithe: 0.15, constellationRebirth: true, startItem: 'shield', startMiles: 140, lapBonus: 60 } } },
    shooting_star:       { icon: '🌠', name: 'Shooting Star',         desc: 'Airdrop crates drop +100 miles and start game with +90 miles.', effects: { monopoly: { airdropBonus: 100, startMiles: 90 } } },
    hubble_sight:        { icon: '🔭', name: 'Hubble Sight',          desc: 'First Black Market item is 35% off. Start with a Swap Portal and +90 miles.', effects: { monopoly: { marketDiscount: 0.35, startItem: 'swap', startMiles: 90 } } },
    orbital_ring:        { icon: '🪐', name: 'Orbital Ring',          desc: 'Passing START pays +85 more (285 total). Casino 💀 curse penalty costs 150 less.', effects: { monopoly: { lapBonus: 85, skullShield: 150 } } },
    meteor_strike:       { icon: '☄️', name: 'Meteor Strike',         desc: 'Start game holding a C4 Bomb. You win ties when YOU attack in Takeover duels. +90 miles.', effects: { monopoly: { startItem: 'c4', duelTieWin: true, startMiles: 90 } } },
    stardust_glamour:    { icon: '✨', name: 'Stardust Glamour',      desc: 'Start every Monopoly game with +150 miles.', effects: { monopoly: { startMiles: 150 } } },
    nebula_waltz:        { icon: '🌌', name: 'Nebula Waltz',          desc: 'Passing START pays +50 more (250 instead of 200).', effects: { monopoly: { lapBonus: 50 } } },
    aurora_serenade:     { icon: '🎆', name: 'Aurora Serenade',       desc: '+1 Clash Token every game and start with +70 miles.', effects: { monopoly: { extraVibePass: 1, startMiles: 70 } } },
    comet_rider:         { icon: '💫', name: 'Comet Rider',           desc: 'Airdrop crates drop +80 miles and start with +60 miles.', effects: { monopoly: { airdropBonus: 80, startMiles: 60 } } },
    pulsar_cadence:      { icon: '📡', name: 'Pulsar Cadence',        desc: 'Passing START pays +45 more (245 instead of 200).', effects: { monopoly: { lapBonus: 45 } } },
    lunar_radiance:      { icon: '🌙', name: 'Lunar Radiance',        desc: 'Casino 💀 curse penalty costs 100 less and start with +80 miles.', effects: { monopoly: { skullShield: 100, startMiles: 80 } } },

    // S7 Perks (Enchanted Fairytales & Royal Crowns)
    sundrop_grapple_pan: { icon: '🏮', name: 'Sundrop Hair Zipline & Cast-Iron Parry', desc: 'Rapunzel 70ft Hair Zipline bridges over dangerous rival kill-zones up to 5 tiles ahead! Cast-Iron Frying Pan "CLANG!" parries 50% of incoming rival rent/attack damage. Start with 🎲 Golden Dice & +130 miles.', effects: { monopoly: { sundropZipline: true, fryingPanParry: 0.5, startItem: 'golden_dice', startMiles: 130, lapBonus: 60 } } },
    glass_clockwork_sovereign: { icon: '👠', name: 'Glass Slipper Trial & Pumpkin Carriage Warp', desc: 'Pumpkin Carriage transposes unowned tiles into golden warp stations! Dropped Glass Slipper fits Cinderella for free Diamond Palace, or sends rival trespassers to Prison! Start with Swap Portal & +140 miles.', effects: { monopoly: { pumpkinWarp: true, glassSlipperTrial: true, startItem: 'swap', startMiles: 140, lapBonus: 65, skullShield: 120 } } },
    beast_fury_intellect: {
      icon: '🦁🌹',
      name: 'Beast Unleashed & Living Staff Shield',
      desc: 'Roll 6 Beast Pounce claw strike steals 70🪙 & +10% Ult from leading rival! 30% Castle Architecture discount on buy & upgrade. Living Staff Torch Shield parries and blocks hostile Takeover Arena duels on your properties & grants +20% rent while active! Start with Rent Shield & +140 miles.',
      effects: {
        monopoly: {
          beastPounce: true,
          livingStaffShield: true,
          castleDiscount: 0.3,
          formShiftStance: true,
          startItem: 'shield',
          startMiles: 140,
          lapBonus: 70,
          duelTieWin: true
        }
      }
    },
    magic_carpet_ride:   { icon: '🧞', name: 'Magic Carpet Ride',     desc: 'Passing START pays +70 more (270 total). Airdrop crates drop +90 miles. Start with +90 miles.', effects: { monopoly: { lapBonus: 70, airdropBonus: 90, startMiles: 90 } } },
    part_of_your_world:  { icon: '🧜‍♀️', name: 'Part of Your World',    desc: 'First Black Market item is 30% off. Casino 💀 curse costs 150 less. Start with +100 miles.', effects: { monopoly: { marketDiscount: 0.3, skullShield: 150, startMiles: 100 } } },
    enchanted_apple:     { icon: '🍎', name: 'Enchanted Orchard',     desc: 'Start every Monopoly game with +150 miles.', effects: { monopoly: { startMiles: 150 } } },
    royal_sentinel_guard:{ icon: '🛡️', name: 'Royal Sentinel Guard',  desc: 'You win ties when YOU attack in Takeover duels. Passing START pays +45 more.', effects: { monopoly: { duelTieWin: true, lapBonus: 45 } } },

    // S8 Perks (Nordic Aurora & Glacial Royalty)
    glacial_absolute_zero: {
      icon: '❄️',
      name: 'Glacial Rent Shield & Absolute Zero Stasis',
      desc: '50% Permafrost Shield absorbs rent & inflicts Permafrost (-30% rival rent) for 2 rounds! Passing START drops Snowdrift Traps. Start with 🎲 Golden Dice & +140 miles.',
      effects: {
        monopoly: { frostShield: 0.5, snowdriftTraps: true, startItem: 'golden_dice', startMiles: 140, lapBonus: 70 }
      }
    },
    aurora_veil: {
      icon: '🌌',
      name: 'Aurora Borealis Veil',
      desc: 'Passing START pays +85 more (285 total). Casino 💀 curse penalty costs 150 less. Start with +90 miles.',
      effects: { monopoly: { lapBonus: 85, skullShield: 150, startMiles: 90 } }
    },
    frost_sentinel_guard: {
      icon: '🛡️',
      name: 'Permafrost Tower Shield',
      desc: 'Start every game holding a Rent Shield. You win ties when YOU attack in Takeover duels. +100 miles.',
      effects: { monopoly: { startItem: 'shield', duelTieWin: true, startMiles: 100 } }
    },
    polar_navigation: {
      icon: '✈️',
      name: 'Polar Navigation',
      desc: 'Start every Monopoly game with +150 miles.',
      effects: { monopoly: { startMiles: 150 } }
    },

    // S9 Perks (Egyptian Mirage & Solar Dynasty)
    gilded_nile_dynasty: {
      icon: '🏺',
      name: 'Great Golden Pyramid & Nile Inundation',
      desc: 'Ascends Grand Hotels into Tier 4 3D Golden Pyramids (+150🪙 passive treasury each lap, 2× rent). Passing rivals pays 10% Royal Extortion. Start with 🎲 Golden Dice & +150 miles.',
      effects: {
        monopoly: { goldenPyramid: true, royalExtortion: 0.1, startItem: 'golden_dice', startMiles: 150, lapBonus: 75 }
      }
    },
    solar_high_noon: {
      icon: '☀️',
      name: 'Desert Mirage & Daybreak Wrath of Ra',
      desc: 'Rival visits trigger Desert Mirage (50% item melt & +30% heat penalty). High-Noon Daybreak sweeps rivals forward in sandstorms! Start with Rent Shield & +150 miles.',
      effects: {
        monopoly: { desertMirage: true, startItem: 'shield', startMiles: 150, lapBonus: 80 }
      }
    },
    anubis_shadows: {
      icon: '⚖️',
      name: 'Scales of Ma\'at & Underworld Ward',
      desc: 'Passing START pays +90 more (290 total). Casino 💀 curse penalty costs 160 less. Start with +100 miles.',
      effects: { monopoly: { lapBonus: 90, skullShield: 160, startMiles: 100 } }
    },
    nile_explorer: {
      icon: '🧭',
      name: 'Desert Cartographer',
      desc: 'Start every Monopoly game with +160 miles and first Black Market item 30% off.',
      effects: { monopoly: { startMiles: 160, marketDiscount: 0.3 } }
    },

    // S10 Perks (Phantom Masquerade: The Grand Carnival of Fate)
    phantom_curtain_call: {
      icon: '🎭',
      name: 'Phantom Curtain Call & Marionette Hex',
      desc: 'Rolling a 6 summons an Opera Gala Tribute (-60🪙 siphoned from rival +10% Ult). Hexes tiles with Reverse Rent Hex (100% rent inverted via Gilded Mirror). Rivals caught in Marionette Stasis roll max 3. Start with 🎲 Golden Dice, +150 miles & +75 lap bonus.',
      effects: {
        monopoly: { reverseRentHex: true, marionetteStasis: true, startItem: 'golden_dice', startMiles: 150, lapBonus: 75 }
      }
    },
    tarot_card_draw: {
      icon: '🎴',
      name: 'Tarot Card of Fate',
      desc: 'Start game holding a Swap Portal, +120 miles, and 25% discount on Black Market cards.',
      effects: { monopoly: { startItem: 'swap', startMiles: 120, marketDiscount: 0.25 } }
    },
    crescendo_aria: {
      icon: '🎶',
      name: 'Crescendo Opera Aria',
      desc: 'Start game holding a Magnet to siphon miles from the richest rival, +80 miles, and +60 on laps.',
      effects: { monopoly: { startItem: 'magnet', startMiles: 80, lapBonus: 60 } }
    },
    gears_of_venice: {
      icon: '⚙️',
      name: 'Clockwork Gears of Venice',
      desc: 'Start game holding a Rent Shield, +100 miles, and you win ties when attacking in duels.',
      effects: { monopoly: { startItem: 'shield', startMiles: 100, duelTieWin: true } }
    },
    canal_glider: {
      icon: '🛶',
      name: 'Grand Canal Glider',
      desc: 'Start every Monopoly game with +80 miles and passing START pays +35 more.',
      effects: { monopoly: { startMiles: 80, lapBonus: 35 } }
    },
    masquerade_cloak: {
      icon: '🎭',
      name: 'Masquerade Cloak',
      desc: 'Start every game holding a Rent Shield and +60 miles.',
      effects: { monopoly: { startItem: 'shield', startMiles: 60 } }
    },
    harlequin_trick: {
      icon: '🃏',
      name: 'Harlequin Jester Trick',
      desc: 'Start every game holding a C4 Remote Bomb and +50 miles.',
      effects: { monopoly: { startItem: 'c4', startMiles: 50 } }
    },
    herbal_concoction: {
      icon: '🩺',
      name: 'Il Dottore Panacea',
      desc: 'Casino 💀 curse costs 100 less, and start with +70 miles.',
      effects: { monopoly: { skullShield: 100, startMiles: 70 } }
    },

    // S11 Perks (Pantheon of the Gods: Olympus Thunder & The Elysian Forge)
    olympus_wrath: {
      icon: '⚡',
      name: 'Wrath of Olympus & Pegasus Bypass',
      desc: 'Rolling 6 calls down Zeus Lightning: smites 1 hotel level (+120🪙 rubble cash) OR deals -80🪙 Storm Shock (+10% Ult). Pegasus Wings bypass fatal rent & soar over hazard traps! Mount Olympus Temple radiates a +50% rent aura with a crackling Lightning Rod. Start with 🎲 Golden Dice, +150 miles & +75 lap bonus.',
      effects: {
        monopoly: { zeusSmite: true, pegasusBypass: true, startItem: 'golden_dice', startMiles: 150, lapBonus: 75 }
      }
    },
    pegasus_tailwind: {
      icon: '🪽',
      name: 'Pegasus Tailwind',
      desc: 'Start game holding a Golden Dice, +90 miles, and passing START pays +65 more.',
      effects: { monopoly: { startItem: 'golden_dice', startMiles: 90, lapBonus: 65 } }
    },
    tartarus_vault: {
      icon: '💀',
      name: 'Vault of Tartarus',
      desc: 'Start game holding a Magnet, +130 miles, and Casino 💀 curse penalty reduced by 150.',
      effects: { monopoly: { startItem: 'magnet', startMiles: 130, skullShield: 150 } }
    },
    divine_tempering: {
      icon: '🔨',
      name: 'Elysian Divine Tempering',
      desc: 'Black Market items 35% off. Start with Rent Shield & +100 miles.',
      effects: { monopoly: { marketDiscount: 0.35, startItem: 'shield', startMiles: 100 } }
    },
    phalanx_guard: {
      icon: '🛡️',
      name: 'Spartan Phalanx Guard',
      desc: 'You win ties when YOU attack in Takeover duels. Start with +75 miles.',
      effects: { monopoly: { duelTieWin: true, startMiles: 75 } }
    },
    delphic_vision: {
      icon: '🔮',
      name: 'Delphic Prophecy',
      desc: 'Start every game holding a Golden Dice and +60 miles.',
      effects: { monopoly: { startItem: 'golden_dice', startMiles: 60 } }
    },
    nectar_revelry: {
      icon: '🍇',
      name: 'Bacchus Nectar Revelry',
      desc: 'Airdrop crates drop +50 miles, and start with +80 miles.',
      effects: { monopoly: { airdropBonus: 50, startMiles: 80 } }
    },
    arena_fury: {
      icon: '🏟️',
      name: 'Colosseum Arena Fury',
      desc: 'Start game holding a C4 Remote Bomb and +65 miles.',
      effects: { monopoly: { startItem: 'c4', startMiles: 65 } }
    }
  };

  // Couple Resonance: both wearing the same pair → tiny shared bonus.
  const RESONANCE = { desc: 'You both wear the same set: +25 miles each per lap 💞', effects: { monopoly: { lapBonus: 25 } } };

  const SPRITE_VER = '20261013v1';
  const C = (season, id, pair, role, rarity, name, subtitle, perk) => ({
    id, season, pair, role, rarity, name, subtitle, perk,
    sprite: `assets/${season}/${id}.png?v=${SPRITE_VER}`
  });

  const COSTUMES = [
    // =========================================================
    // SEASON 1: BANGKOK AFTER DARK
    // =========================================================
    // ⭐ RARE
    C('s1', 's1_rooftop_m',  'rooftop',  'bkk', 'rare',   'Rooftop Night Out',        'Black silk shirt & skyline cocktails',  'happy_hour'),
    C('s1', 's1_rooftop_f',  'rooftop',  'dxb', 'rare',   'Rooftop Night Out',        'Champagne satin slip dress',            'happy_hour'),
    C('s1', 's1_market_m',   'market',   'bkk', 'rare',   'Night Market Hustler',     'Bandana, apron & sizzling skewers',     'street_smart'),
    C('s1', 's1_market_f',   'market',   'dxb', 'rare',   'Night Market Hustler',     'Elephant pants & mango sticky rice',    'street_smart'),
    C('s1', 's1_tuktuk_m',   'tuktuk',   'bkk', 'rare',   'Tuk-Tuk Racer',            'Neon racing jacket & goggles',          'pit_crew'),
    C('s1', 's1_tuktuk_f',   'tuktuk',   'dxb', 'rare',   'Tuk-Tuk Racer',            'Hot pink racer & helmet',               'pit_crew'),
    C('s1', 's1_songkran_m', 'songkran', 'bkk', 'rare',   'Songkran Splash',          'Floral shirt & super soaker',           'splash_zone'),
    C('s1', 's1_songkran_f', 'songkran', 'dxb', 'rare',   'Songkran Splash',          'Plumeria pigtails & water gun',         'splash_zone'),
    // ⭐⭐ EPIC
    C('s1', 's1_muaythai_m', 'muaythai', 'bkk', 'epic',   'Muay Thai Champion',       'Mongkol, gold belt & red gloves',       'clinch'),
    C('s1', 's1_muaythai_f', 'muaythai', 'dxb', 'epic',   'Muay Thai Champion',       'Purple-gold fighter & pink gloves',     'clinch'),
    C('s1', 's1_cruise_m',   'cruise',   'bkk', 'epic',   'Chao Phraya Moonlight Cruise', 'White captain uniform & a red rose', 'smooth_sail'),
    C('s1', 's1_cruise_f',   'cruise',   'dxb', 'epic',   'Chao Phraya Moonlight Cruise', 'Starlit sequin gown & champagne',    'smooth_sail'),
    C('s1', 's1_dragon_m',   'dragon',   'bkk', 'epic',   'Yaowarat Red Dragon',      'Golden dragon bomber & lantern',        'lucky_red'),
    C('s1', 's1_dragon_f',   'dragon',   'dxb', 'epic',   'Yaowarat Red Dragon',      'Crimson qipao, fan & lantern',          'lucky_red'),
    // ⭐⭐⭐ MYTHIC
    C('s1', 's1_naga_m',     'mythic',   'bkk', 'mythic', 'Naga King 🐉',             'Jade-gold serpent armor & trident',     'celestial'),
    C('s1', 's1_kinnaree_f', 'mythic',   'dxb', 'mythic', 'Kinnaree 🪽',              'Celestial dancer with golden wings',    'celestial'),

    // =========================================================
    // SEASON 2: TOKYO SAKURA REVERIE
    // =========================================================
    // ⭐ RARE (6 pairs)
    C('s2', 's2_matcha_m',     'matcha',     'bkk', 'rare',   'Matcha Barista 🍵',           'Forest green apron & whisked matcha latte', 'zen_mind'),
    C('s2', 's2_matcha_f',     'matcha',     'dxb', 'rare',   'Matcha Tea Maiden 🍵',        'Pale green kimono & bamboo chasen whisk',   'zen_mind'),
    C('s2', 's2_harajuku_m',   'harajuku',   'bkk', 'rare',   'Harajuku Decora Boy 🍭',      'Layered hairclips, pins & neon sneakers',   'trendsetter'),
    C('s2', 's2_harajuku_f',   'harajuku',   'dxb', 'rare',   'Harajuku Kawaii Idol 💖',     'Pastel frilled lolita dress & star bag',    'trendsetter'),
    C('s2', 's2_arcade_m',     'arcade',     'bkk', 'rare',   'Akiba Claw Pro 🕹️',           'Pixel bomber jacket & giant plushie prize',  'lucky_token'),
    C('s2', 's2_arcade_f',     'arcade',     'dxb', 'rare',   'Rhythm Game Star 🎵',         'Gamer gloves & glowing cat-ear headset',    'lucky_token'),
    C('s2', 's2_ramen_m',      'ramen',      'bkk', 'rare',   'Ramen Chef Master 🍜',        'Hachimaki towel & steaming chashu ramen',   'hot_broth'),
    C('s2', 's2_ramen_f',      'ramen',      'dxb', 'rare',   'Gyoza Apprentice 🥟',         'Black apron & bamboo steamer of gyoza',     'hot_broth'),
    C('s2', 's2_onsen_m',      'onsen',      'bkk', 'rare',   'Onsen Bather ♨️',             'Indigo yukata, head towel & cedar bucket',  'sweet_start'),
    C('s2', 's2_onsen_f',      'onsen',      'dxb', 'rare',   'Onsen Maiden ♨️',             'Cherry blossom yukata & cedar tea tray',    'sweet_start'),
    C('s2', 's2_shinkansen_m', 'shinkansen', 'bkk', 'rare',   'Bullet Train Conductor 🚄',   'Navy uniform, pocket watch & signal baton', 'express_line'),
    C('s2', 's2_shinkansen_f', 'shinkansen', 'dxb', 'rare',   'Bullet Train Attendant 🚅',   'Sky-blue uniform & bullet train ekiben',    'express_line'),

    // ⭐⭐ EPIC (4 pairs)
    C('s2', 's2_matsuri_m',    'matsuri',    'bkk', 'epic',   'Matsuri Taiko Beat 🥁',       'Hanten coat, headband & thunder bachi sticks', 'festival_fortune'),
    C('s2', 's2_matsuri_f',    'matsuri',    'dxb', 'epic',   'Sparkler Festival Maiden 🎆', 'Yukata, flower hairpin & senko hanabi',        'festival_fortune'),
    C('s2', 's2_lofi_m',       'lofi',       'bkk', 'epic',   'Shibuya Beatmaker 🎧',        'Oversized neon hoodie & pocket sampler',       'chill_beats'),
    C('s2', 's2_lofi_f',       'lofi',       'dxb', 'epic',   'Shibuya Neon Rain ☔',        'Clear vinyl jacket & luminous umbrella',       'chill_beats'),
    C('s2', 's2_taisho_m',     'taisho',     'bkk', 'epic',   'Taisho Cadet ⚔️',             'Brass-buttoned navy officer coat & cap',       'noble_presence'),
    C('s2', 's2_taisho_f',     'taisho',     'dxb', 'epic',   'Taisho Ribbon Belle 🎀',      'Arrow kimono, maroon hakama & hair bow',       'noble_presence'),
    C('s2', 's2_cyber_m',      'cyber_jp',   'bkk', 'epic',   'Cyber Ronin ⚡',              'High-tech techwear & cyan neon katana',         'overclock'),
    C('s2', 's2_cyber_f',      'cyber_jp',   'dxb', 'epic',   'Cyber Idol Kitsune 💫',       'Holo idol suit & twin luminous tails',         'overclock'),

    // ⭐⭐⭐ MYTHIC (2 pairs)
    C('s2', 's2_inari_m',      'inari',      'bkk', 'mythic', 'Inari Fox Blade 🦊',          'Scarlet kitsune kimono & flaming foxfire blade', 'inari_blessing'),
    C('s2', 's2_inari_f',      'inari',      'dxb', 'mythic', 'Inari Shrine Empress ⛩️',     'Flowing nine-tailed shrine robes & sacred bells', 'inari_blessing'),
    C('s2', 's2_celestial_m',  'celestial_jp','bkk', 'mythic', 'Tsukuyomi Shadow Prince 🌙',  'Obsidian moon armor & lunar eclipse aura',      'celestial_eclipse'),
    C('s2', 's2_celestial_f',  'celestial_jp','dxb', 'mythic', 'Amaterasu Sun Sovereign ☀️',  'Radiant solar crown & golden imperial robes',   'celestial_eclipse'),

    // =========================================================
    // SEASON 3: DUBAI DESERT MIRAGE
    // =========================================================
    // ⭐ RARE (6 pairs)
    C('s3', 's3_souk_m',       'souk',       'bkk', 'rare',   'Souk Spice Merchant 🏺',       'Linen vest, turban & brass saffron censer',      'gahwa_hospitality'),
    C('s3', 's3_souk_f',       'souk',       'dxb', 'rare',   'Saffron Silk Dancer 💃',       'Crimson-gold veil, coin sash & ankle bells',     'gahwa_hospitality'),
    C('s3', 's3_safari_m',     'safari',     'bkk', 'rare',   'Dune Buggy Captain 🚙',        'Sandstorm goggles, safari khaki & utility belt', 'dune_explorer'),
    C('s3', 's3_safari_f',     'safari',     'dxb', 'rare',   'Desert Stargazer 🔭',          'Chic sand poncho, telescope & starlight scarf',  'dune_explorer'),
    C('s3', 's3_gahwa_m',      'gahwa',      'bkk', 'rare',   'Master Gahwa Brewer ☕',       'Golden dallah pitcher & embroidered vest',       'cardamom_brew'),
    C('s3', 's3_gahwa_f',      'gahwa',      'dxb', 'rare',   'Cardamom Hostess 🌸',          'Embroidered silk kaftan & brass dates tray',     'cardamom_brew'),
    C('s3', 's3_gold_m',       'gold',       'bkk', 'rare',   'Gold Bazaar Artisan 🪙',       'Velvet sash, loupe & handcrafted gold coins',    'gold_caravan'),
    C('s3', 's3_gold_f',       'gold',       'dxb', 'rare',   'Jewel Heiress 👑',             'Layered gold necklaces & topaz-encrusted cuffs', 'gold_caravan'),
    C('s3', 's3_marina_m',     'marina',     'bkk', 'rare',   'Marina Yacht Captain 🛥️',      'Crisp navy blazer, captain cap & sunglasses',    'gulf_admiral'),
    C('s3', 's3_marina_f',     'marina',     'dxb', 'rare',   'Yacht Lounge Diva 🥂',         'Resort sun hat, oversized shades & champagne',   'gulf_admiral'),
    C('s3', 's3_abra_m',       'abra',       'bkk', 'rare',   'Creek Abra Sailor ⛵',         'Striped cotton tunic, straw sun hat & wooden oar','pearl_diver'),
    C('s3', 's3_abra_f',       'abra',       'dxb', 'rare',   'Creek Pearl Diver 🦪',         'Aqua linen wrap & glowing natural oyster pearl', 'pearl_diver'),

    // ⭐⭐ EPIC (4 pairs)
    C('s3', 's3_falcon_m',     'falcon',     'bkk', 'epic',   'Royal Falconer 🦅',            'Embroidered royal bisht & golden falconer glove', 'royal_falconry'),
    C('s3', 's3_falcon_f',     'falcon',     'dxb', 'epic',   'Desert Huntress 🦅',           'Hooded desert silk cape & golden falcon talisman', 'royal_falconry'),
    C('s3', 's3_hypercar_m',   'hypercar',   'bkk', 'epic',   'Hypercar Pilot 🏎️',           'Carbon-fiber racing suit & gold-tinted visor',    'dune_drifter'),
    C('s3', 's3_hypercar_f',   'hypercar',   'dxb', 'epic',   'Neon Drift Queen 🏁',          'High-octane gold street racer & neon aviators',  'dune_drifter'),
    C('s3', 's3_burj_m',       'burj',       'bkk', 'epic',   'Burj Gala Tuxedo 🍸',          'Midnight velvet tuxedo & gold-trimmed lapels',   'oasis_sanctuary'),
    C('s3', 's3_burj_f',       'burj',       'dxb', 'epic',   'Palm Starlight Gown ✨',        'Crystal-draped couture gown & starlight tiara',  'oasis_sanctuary'),
    C('s3', 's3_cyber_m',      'cyber_dxb',  'bkk', 'epic',   'Cyber Bedouin Scout ⚡',       'Tech-sand cloak, cyber visor & energy staff',    'cyber_mirage'),
    C('s3', 's3_cyber_f',      'cyber_dxb',  'dxb', 'epic',   'Cyber Oasis Princess 💫',      'Holographic veil & neon circuitry abaya',        'cyber_mirage'),

    // ⭐⭐⭐ MYTHIC (2 pairs)
    C('s3', 's3_djinn_m',      'djinn',      'bkk', 'mythic', 'Solar Sultan ☀️',              'Golden thobe, solar djinn crown & sun scimitar', 'mirage_siphon'),
    C('s3', 's3_djinn_f',      'djinn',      'dxb', 'mythic', 'Starlight Djinn Queen 🌌',     'Celestial silk abaya, starry veil & magic lamp', 'mirage_siphon'),
    C('s3', 's3_phoenix_m',    'phoenix',    'bkk', 'mythic', 'Dune Phoenix Ascendant 🔥',    'Fiery amber armor & blazing phoenix wings',      'demolition_sultan'),
    C('s3', 's3_phoenix_f',    'phoenix',    'dxb', 'mythic', 'Oasis Blossom Seraph 🪷',      'Iridescent emerald silk & blooming oasis wings', 'demolition_sultan'),

    // =========================================================
    // SEASON 4: MONTE CARLO CASINO ROYALE
    // =========================================================
    // ⭐ RARE (6 pairs)
    C('s4', 's4_dealer_m',     'blackjack_dealer', 'bkk', 'rare',   'Blackjack Croupier 🃏',      'Emerald felt vest, bow tie & card shoe dispenser',  'dealers_cut'),
    C('s4', 's4_dealer_f',     'blackjack_dealer', 'dxb', 'rare',   'Baccarat Dealer 🎴',        'Tailored black satin waistcoat & baccarat paddle',   'dealers_cut'),
    C('s4', 's4_lounge_m',     'vip_lounge',       'bkk', 'rare',   'VIP Lounge Host 🍾',        'Plum velvet dinner jacket & vintage champagne',     'velvet_rope'),
    C('s4', 's4_lounge_f',     'vip_lounge',       'dxb', 'rare',   'Champagne Hostess 🥂',      'Gold sequin cocktail dress & crystal flutes',        'velvet_rope'),
    C('s4', 's4_dice_m',       'lucky_dice',       'bkk', 'rare',   'Craps High-Shooter 🎲',     'Classic suspenders, rolled shirt & lucky red dice', 'hot_hand'),
    C('s4', 's4_dice_f',       'lucky_dice',       'dxb', 'rare',   'Dice Queen 🎲',             'Crimson satin halter dress & spinning gold dice',   'hot_hand'),
    C('s4', 's4_security_m',   'security_chief',   'bkk', 'rare',   'Casino Security Chief 🕶️',   'Fitted black suit, ear-piece & tactical radio',     'eye_in_the_sky'),
    C('s4', 's4_security_f',   'security_chief',   'dxb', 'rare',   'Surveillance Specialist 🖥️', 'Tailored blazer, rimless glasses & holographic pad','eye_in_the_sky'),
    C('s4', 's4_gp_m',         'monaco_gp',        'bkk', 'rare',   'Monaco GP Driver 🏎️',       'Crimson Monaco GP racing suit & carbon helmet',     'grand_prix_sprint'),
    C('s4', 's4_gp_f',         'monaco_gp',        'dxb', 'rare',   'Paddock Belle 🏁',          'Cropped racing jacket, leather shorts & flag',      'grand_prix_sprint'),
    C('s4', 's4_magic_m',      'magic_illusion',   'bkk', 'rare',   'Grand Illusionist 🎩',      'Top hat, scarlet tailcoat & floating golden cards', 'sleight_of_hand'),
    C('s4', 's4_magic_f',      'magic_illusion',   'dxb', 'rare',   'Mystic Assistant ✨',        'Celestial starlight leotard & magic wand',          'sleight_of_hand'),

    // ⭐⭐ EPIC (4 pairs)
    C('s4', 's4_poker_m',      'poker_ace',        'bkk', 'epic',   'Ace of Spades ♠️',           'Charcoal waistcoat, dealer visor & spade chips',    'royal_bluff'),
    C('s4', 's4_poker_f',      'poker_ace',        'dxb', 'epic',   'Queen of Hearts ♥️',         'Crimson velvet gown, gold crown & card chip fan',   'royal_bluff'),
    C('s4', 's4_yacht_m',      'monaco_yacht',     'bkk', 'epic',   'Monaco Yacht Commodore ⚓',  'White double-breasted nautical blazer & gold cap',  'riviera_siphon'),
    C('s4', 's4_yacht_f',      'monaco_yacht',     'dxb', 'epic',   'Riviera Heiress 🥂',         'Ivory silk resort slip dress, sunhat & rosé flute', 'riviera_siphon'),
    C('s4', 's4_slot_m',       'slot_jackpot',     'bkk', 'epic',   'Jackpot Striker ⚡',         'Neon 777 emerald bomber jacket & golden token',     'triple_seven'),
    C('s4', 's4_slot_f',       'slot_jackpot',     'dxb', 'epic',   'Neon Cherries 🍒',          'Sequin romper, neon cherry earrings & red heels',   'triple_seven'),
    C('s4', 's4_heist_m',      'vault_heist',      'bkk', 'epic',   'Master Infiltrator 🕶️',      'Tactical turtleneck, night-vision monocle & laser', 'vault_breaker'),
    C('s4', 's4_heist_f',      'vault_heist',      'dxb', 'epic',   'Cat Burglar Diva 🐈‍⬛',       'Glossy black catsuit, sparkling diamond & grapple', 'vault_breaker'),

    // ⭐⭐⭐ MYTHIC (2 pairs)
    C('s4', 's4_royale_m',     'casino_royale',    'bkk', 'mythic', 'Casino Sovereign 007 🍸',   'Midnight tuxedo, satin lapels & golden chip',       'vip_express'),
    C('s4', 's4_royale_f',     'casino_royale',    'dxb', 'mythic', 'Lady Luck Supreme 💎',      'Emerald silk gown, diamond necklace & feather boa', 'vip_express'),
    C('s4', 's4_roulette_m',   'roulette_grand',   'bkk', 'mythic', 'High-Roller Pit Boss 🎲',   'Pinstripe double-breasted suit & roulette cufflinks','loaded_battle_dice'),
    C('s4', 's4_roulette_f',   'roulette_grand',   'dxb', 'mythic', 'Roulette Reine 🎡',         'Gilded corseted ballroom gown & roulette wheel hem','loaded_battle_dice'),

    // =========================================================
    // SEASON 5: ATLANTIS — THE BIOLUMINESCENT ABYSS
    // =========================================================
    // ⭐ RARE (6 pairs)
    C('s5', 's5_diver_m',      'pearl_diver',       'bkk', 'rare',   'Free-Diving Nomad 🤿',       'Black & turquoise freedive wetsuit, carbon longfins & dive light', 'pearl_harvest'),
    C('s5', 's5_diver_f',      'pearl_diver',       'dxb', 'rare',   'Pearl Harvester 🦪',        'Island sarong, plumeria hair & woven basket of glowing pearls',    'pearl_harvest'),
    C('s5', 's5_aquanaut_m',   'aquanaut_cadet',    'bkk', 'rare',   'Submarine Helmsman ⚓',      'Crisp navy uniform, gold dolphins badge & peaked officer cap',     'sonar_scan'),
    C('s5', 's5_aquanaut_f',   'aquanaut_cadet',    'dxb', 'rare',   'Sonar Specialist 📡',       'Submariner sailor sweater, pleated skirt & sonar radar tablet',    'sonar_scan'),
    C('s5', 's5_angler_m',     'angler_lounge',     'bkk', 'rare',   'Trench Mixologist 🍸',      'Midnight black tuxedo, glowing lure bowtie & glowing cocktail',    'abyssal_cocktail'),
    C('s5', 's5_angler_f',     'angler_lounge',     'dxb', 'rare',   'Bioluminescent Belle ✨',   'Midnight velvet ballgown woven with fiber-optic constellations',   'abyssal_cocktail'),
    C('s5', 's5_seahorse_m',   'seahorse_cavalier', 'bkk', 'rare',   'Seahorse Knight 🎠',        'Pearlescent scale cuirass, seahorse crest helm & conch lance',     'equestrian_current'),
    C('s5', 's5_seahorse_f',   'seahorse_cavalier', 'dxb', 'rare',   'Coral Maiden 🌺',           'Pastel seafoam dress with coral embroidery & pygmy seahorse pet',  'equestrian_current'),
    C('s5', 's5_triton_m',     'triton_herald',     'bkk', 'rare',   'Conch Horn Herald 🎺',      'Teal & gold herald uniform, conch trumpet & clam epaulets',        'tidal_anthem'),
    C('s5', 's5_triton_f',     'triton_herald',     'dxb', 'rare',   'Tidal Wave Dancer 🌊',      'Flowing aqua silk ribbons, silver wave tiara & seashell anklets',  'tidal_anthem'),
    C('s5', 's5_tide_m',       'tidepool_magic',    'bkk', 'rare',   'Sea Witch Apprentice 🧪',   'Deep indigo robes, tentacle embroidery & glowing potion flask',    'bubble_vibe'),
    C('s5', 's5_tide_f',       'tidepool_magic',    'dxb', 'rare',   'Bubble Mage 🫧',            'Pastel aqua layered dress, magical wand & iridescent bubbles',     'bubble_vibe'),

    // ⭐⭐ EPIC (4 pairs)
    C('s5', 's5_nautilus_m',   'nautilus_explorer', 'bkk', 'epic',   'Bathysphere Captain 🤿',    'Brass steampunk diving suit, copper breastplate & porthole helmet','deep_pressure'),
    C('s5', 's5_nautilus_f',   'nautilus_explorer', 'dxb', 'epic',   'Nautilus Cartographer 🧭',  'Teal explorer coat, brass compass buttons & glowing astrolabe',    'deep_pressure'),
    C('s5', 's5_manta_m',      'manta_waltz',       'bkk', 'epic',   'Manta Ray Duelist 🤺',      'Manta-wing midnight coat with bioluminescent blade rapier',        'reef_agility'),
    C('s5', 's5_manta_f',      'manta_waltz',       'dxb', 'epic',   'Sea Angel Ballerina 🩰',    'Translucent clione tutu, fluttering glowing wings & pointe shoes', 'reef_agility'),
    C('s5', 's5_corsair_m',    'sunken_corsair',    'bkk', 'epic',   'Sunken Galleon Prince 🏴‍☠️', 'Weathered admiral coat, glowing barnacles & phantom cutlass',      'sunken_doubloons'),
    C('s5', 's5_corsair_f',    'sunken_corsair',    'dxb', 'epic',   'Siren of the Shallows 🎶',  'Iridescent sea-silk sarong, coral corsetry & golden sea-harp',     'sunken_doubloons'),
    C('s5', 's5_coral_m',      'coral_sorcery',     'bkk', 'epic',   'Coral Reef Sorcerer 🪸',    'Branching staghorn coral pauldrons & glowing pearl coral staff',   'living_sanctuary'),
    C('s5', 's5_coral_f',      'coral_sorcery',     'dxb', 'epic',   'Anemone Priestess 🌸',      'Blooming pink sea-anemone ruffled gown & floating clownfish',      'living_sanctuary'),

    // ⭐⭐⭐ MYTHIC (2 pairs)
    C('s5', 's5_emperor_m',    'atlantis_royalty',  'bkk', 'mythic', 'Emperor of the Trench 🔱',  'Ornate sea-gold armor, glowing crystal trident & royal mantle',    'tidal_surge_ward'),
    C('s5', 's5_siren_f',      'atlantis_royalty',  'dxb', 'mythic', 'Pearl Siren Empress 🦪',   'Ethereal iridescent pearl gown, gossamer veil & glowing giant clam','tidal_surge_ward'),
    C('s5', 's5_leviathan_m',  'celestial_jellyfish','bkk', 'mythic', 'Abyssal Leviathan Lord 🐉', 'Midnight coat, glowing teal dragon scale pauldrons & abyssal orb','bioluminescent_drift'),
    C('s5', 's5_jellyfish_f',  'celestial_jellyfish','dxb', 'mythic', 'Starlight Jelly Princess 🪼','Gossamer glowing jellyfish-bell skirt, star jewels & angel wand', 'bioluminescent_drift'),

    // =========================================================
    // SEASON 6: STARLIGHT ODYSSEY (CELESTIAL GALA)
    // =========================================================
    // ⭐ RARE (6 pairs)
    C('s6', 's6_stardust_m',   'stardust_waltz',    'bkk', 'rare',   'Stardust Cavalier ✨',       'Midnight navy tailcoat with shimmering gold lapels & star boutonniere', 'stardust_glamour'),
    C('s6', 's6_stardust_f',   'stardust_waltz',    'dxb', 'rare',   'Stardust Debutante ✨',      'Golden champagne tulle gown sprinkled with real stardust sparkles',      'stardust_glamour'),
    C('s6', 's6_nebula_m',     'nebula_ballroom',   'bkk', 'rare',   'Nebula Maestro 🌌',          'Deep violet double-breasted suit with purple galaxy silk lining',        'nebula_waltz'),
    C('s6', 's6_nebula_f',     'nebula_ballroom',   'dxb', 'rare',   'Nebula Prima Donna 🌌',      'Luminous violet-magenta silk gown with swirling cosmic sleeves',         'nebula_waltz'),
    C('s6', 's6_aurora_m',     'aurora_duet',       'bkk', 'rare',   'Aurora Violinist 🎆',        'Emerald & teal velvet coat with glowing aurora hem embroidery',          'aurora_serenade'),
    C('s6', 's6_aurora_f',     'aurora_duet',       'dxb', 'rare',   'Aurora Ballerina 🎆',        'Shimmering iridescent cyan-green tutu with northern lights sparkles',     'aurora_serenade'),
    C('s6', 's6_comet_m',      'comet_drift',       'bkk', 'rare',   'Comet Aviator 💫',           'Starlight leather flight jacket with star chart silk scarf',             'comet_rider'),
    C('s6', 's6_comet_f',      'comet_drift',       'dxb', 'rare',   'Comet Stargazer 💫',         'Cozy star-embroidered knit cardigan & celestial beret',                  'comet_rider'),
    C('s6', 's6_pulsar_m',     'pulsar_cadence',    'bkk', 'rare',   'Radio Astronomer 📡',        'Crisp white observatory lab uniform with brass astrolabe pins',          'pulsar_cadence'),
    C('s6', 's6_pulsar_f',     'pulsar_cadence',    'dxb', 'rare',   'Observatory Archivist 📡',   'Pleated celestial navy skirt, star map satchel & brass glasses',         'pulsar_cadence'),
    C('s6', 's6_lunar_m',      'lunar_glow',        'bkk', 'rare',   'Moonlit Sommelier 🌙',       'Silver silk vest, moonstone cufflinks & vintage cosmic wine',            'lunar_radiance'),
    C('s6', 's6_lunar_f',      'lunar_glow',        'dxb', 'rare',   'Crescent Moon Muse 🌙',      'Silver satin slip dress with pearl crescent moon pendant',                'lunar_radiance'),

    // ⭐⭐ EPIC (4 pairs)
    C('s6', 's6_starhunter_m', 'star_hunter',       'bkk', 'epic',   'Constellation Hunter 🏹',    'Gold-trimmed starry hunter cloak, star bow & golden quiver',             'shooting_star'),
    C('s6', 's6_starhunter_f', 'star_hunter',       'dxb', 'epic',   'Starlight Huntress 🏹',      'Rose-gold archer armor with translucent celestial wing cape',             'shooting_star'),
    C('s6', 's6_hubble_m',     'hubble_astronomer', 'bkk', 'epic',   'Deep Space Astrogator 🔭',   'Midnight blue admiral greatcoat with brass stellar telescopes',          'hubble_sight'),
    C('s6', 's6_hubble_f',     'hubble_astronomer', 'dxb', 'epic',   'Astrolabe Sorceress 🧭',     'Ethereal celestial scholar gown with spinning brass armillary sphere',   'hubble_sight'),
    C('s6', 's6_orbital_m',    'orbital_monarch',   'bkk', 'epic',   'Saturn Ring Prince 🪐',      'Platinum embroidered suit with floating luminous planetary rings',       'orbital_ring'),
    C('s6', 's6_orbital_f',    'orbital_monarch',   'dxb', 'epic',   'Ring Nebula Princess 🪐',    'Cascading violet organza gown woven with concentric gold rings',         'orbital_ring'),
    C('s6', 's6_meteor_m',     'meteor_sentinel',   'bkk', 'epic',   'Meteor Vanguard ☄️',         'Charcoal & molten gold armor with flaming stardust broadsword',          'meteor_strike'),
    C('s6', 's6_meteor_f',     'meteor_sentinel',   'dxb', 'epic',   'Comet Valkyrie ☄️',          'Crimson-gold feather winged armor & meteor spear of dawn',               'meteor_strike'),

    // ⭐⭐⭐ MYTHIC (2 pairs)
    C('s6', 's6_supernova_m',  'supernova',         'bkk', 'mythic', 'Supernova Voyager 🐺✨',      'Midnight navy & gold cosmic tuxedo, constellation cape & star of luck',   'supernova_overdrive'),
    C('s6', 's6_supernova_f',  'supernova',         'dxb', 'mythic', 'Supernova Empress 🐉✨',      'Luminous star-constellation ballgown, crystal horns & astral scepter',    'supernova_overdrive'),
    C('s6', 's6_aegis_m',      'aegis',             'bkk', 'mythic', 'Astral Sovereign 🐺🌌',      'Cosmic paladin armor, galaxy vortex aegis shield & star scepter',        'astral_aegis_tithe'),
    C('s6', 's6_aegis_f',      'aegis',             'dxb', 'mythic', 'Celestial Goddess 🐉🌌',      'Ethereal nebula dragon wings, gold filigree gown & galaxy sphere orb',   'astral_aegis_tithe'),

    // =========================================================
    // SEASON 7: ENCHANTED FAIRYTALES & ROYAL CROWNS
    // =========================================================
    // ⭐ RARE (2 pairs)
    C('s7', 's7_forest_m',     'forest_apple',     'bkk', 'rare',   'Woodland Huntsman 🏹',       'Weathered leather jerkin, archery bracers & trusty forest bow',           'royal_sentinel_guard'),
    C('s7', 's7_forest_f',     'forest_apple',     'dxb', 'rare',   'Enchanted Orchard Maiden 🍎', 'Emerald & golden meadow dress with woodland flower braids',              'enchanted_apple'),
    C('s7', 's7_palace_m',     'palace_guard',     'bkk', 'rare',   'Royal Sentinel Guard 🛡️',     'Polished silver & gold plate armor with royal lion crest & crimson cloak', 'royal_sentinel_guard'),
    C('s7', 's7_palace_f',     'palace_guard',     'dxb', 'rare',   'Court Keykeeper Maiden 🗝️',   'Crimson velvet heraldic gala gown with golden palace key',                'enchanted_apple'),

    // ⭐⭐ EPIC (2 pairs)
    C('s7', 's7_carpet_m',     'carpet_ride',      'bkk', 'epic',   'Desert Prince Rogue 🧞',     'Gold-embroidered royal vest, purple sash belt & curved scimitar',         'magic_carpet_ride'),
    C('s7', 's7_carpet_f',     'carpet_ride',      'dxb', 'epic',   'Arabian Lotus Princess 🪷',  'Turquoise silk palace gala dress, turquoise tiara & gold bangles',        'magic_carpet_ride'),
    C('s7', 's7_siren_m',      'sea_siren',        'bkk', 'epic',   'Maritime Sailor Prince ⛵',   'White naval captain uniform, blue neckerchief & maritime saber',          'part_of_your_world'),
    C('s7', 's7_siren_f',      'sea_siren',        'dxb', 'epic',   'Emerald Sea Siren 🧜‍♀️',       'Seafoam emerald silk ballgown, pearl corsage & glowing seashell',         'part_of_your_world'),

    // ⭐⭐⭐ MYTHIC (3 pairs)
    C('s7', 's7_sundrop_m',    'sundrop_tower',    'bkk', 'mythic', 'Flynn the Charming Rogue 🗡️✨', 'Teal doublet vest, leather satchel, smirking wit & rapier',           'sundrop_grapple_pan'),
    C('s7', 's7_sundrop_f',    'sundrop_tower',    'dxb', 'mythic', 'Rapunzel Sun-Drop Maiden 🏮✨', '70ft glowing golden hair, royal lavender dress & sun blossom',       'sundrop_grapple_pan'),
    C('s7', 's7_cinderella_m', 'midnight_ball',    'bkk', 'mythic', 'Prince Charming 👑✨',         'Cream & gold royal palace gala uniform with gold aiguillette cords',      'glass_clockwork_sovereign'),
    C('s7', 's7_cinderella_f', 'midnight_ball',    'dxb', 'mythic', 'Cinderella Midnight Muse 👠✨', 'Crystalline blue starlight ballgown, diamond tiara & glass slippers',    'glass_clockwork_sovereign'),
    C('s7', 's7_belle_m',      'enchanted_castle', 'bkk', 'mythic', 'Prince Adam & The Beast 🦁✨',  'Regal lion mane, royal navy & gold embroidered tailcoat & sword',         'beast_fury_intellect'),
    C('s7', 's7_belle_f',      'enchanted_castle', 'dxb', 'mythic', 'Belle Enchanted Rose 🌹✨',    'Iconic golden ballroom gown, amber tiara & magical glowing rose',         'beast_fury_intellect'),

    // =========================================================
    // SEASON 8: NORDIC AURORA & GLACIAL ROYALTY
    // =========================================================
    // ⭐ RARE
    C('s8', 's8_aviator_m',    'polar_aviator',    'bkk', 'rare',   'Subzero Arctic Aviator ✈️🧤', 'Sheepskin flight jacket, pilot goggles & thermal scarf',           'polar_navigation'),
    C('s8', 's8_aviator_f',    'polar_aviator',    'dxb', 'rare',   'Subzero Arctic Aviator ✈️🧤', 'Fur-trimmed flight bomber, snow goggles & polar boots',            'polar_navigation'),

    // ⭐⭐ EPIC
    C('s8', 's8_aurora_m',     'aurora_lights',    'bkk', 'epic',   'Aurora Shaman 🌌✨',          'Glowing runic polar cloak & northern lights stave',                'aurora_veil'),
    C('s8', 's8_aurora_f',     'aurora_lights',    'dxb', 'epic',   'Aurora Weaver 🌌✨',          'Prismatic emerald-cyan silk veil & starlit aurora ribbon',        'aurora_veil'),
    C('s8', 's8_sentinel_m',   'frost_sentinel',   'bkk', 'epic',   'Frost Sentinel Knight 🛡️❄️',  'Heavy permafrost tower shield & glacial warhammer',                'frost_sentinel_guard'),
    C('s8', 's8_crystal_f',    'frost_sentinel',   'dxb', 'epic',   'Crystal Princess Elsa 💎❄️',  'Glowing frozen heart diamond & crystalline dragon horns',          'frost_sentinel_guard'),

    // ⭐⭐⭐ MYTHIC (Option 2 Glacial Empress with Starlight Scepter & Blizzard Warden)
    C('s8', 's8_warden_m',     'glacial_royalty',  'bkk', 'mythic', 'Blizzard Warden 🐺❄️✨',     'Frosted wolf mantle, permafrost broadsword & silver-navy armor',   'glacial_absolute_zero'),
    C('s8', 's8_empress_f',    'glacial_royalty',  'dxb', 'mythic', 'Glacial Empress Elsa ❄️👑✨', 'Ice-crystal dragon wings, starlight scepter & diamond-dusted frost gown', 'glacial_absolute_zero'),

    // =========================================================
    // SEASON 9: EGYPTIAN MIRAGE & SOLAR DYNASTY
    // =========================================================
    // ⭐ RARE (1 pair)
    C('s9', 's9_explorer_m',    'nile_explorer',    'bkk', 'rare',   'Desert Cartographer 🗺️🧭',   'Tan safari vest, brass compass & ancient papyrus map',            'nile_explorer'),
    C('s9', 's9_explorer_f',    'nile_explorer',    'dxb', 'rare',   'Nile Archaeologist 🏺🔍',   'Safari explorer shirt, cargo skirt & golden scarab amulet',       'nile_explorer'),

    // ⭐⭐ EPIC (1 pair)
    C('s9', 's9_anubis_m',      'anubis_shadows',   'bkk', 'epic',   'High Embalmer of Anubis ⚖️🖤', 'Black jackal mask, gold ceremonial tunic & balance staff of Ma\'at', 'anubis_shadows'),
    C('s9', 's9_anubis_f',      'anubis_shadows',   'dxb', 'epic',   'Priestess of Underworld ⚖️🖤', 'Black-gold silk robe, jackal tiara & glowing scales of Ma\'at', 'anubis_shadows'),

    // ⭐⭐⭐ MYTHIC PAIR 1: THE GILDED MONARCHS
    C('s9', 's9_pharaoh_m',     'gilded_monarchs',  'bkk', 'mythic', 'Pharaoh Sun-King Ramses 👑☀️✨', 'Ceremonial Nemes headdress, crook & flail, golden jackal tail', 'gilded_nile_dynasty'),
    C('s9', 's9_cleopatra_f',   'gilded_monarchs',  'dxb', 'mythic', 'Empress Cleopatra VII 🏺👑✨', 'Golden horns of Hathor, golden scarab wings, lotus ankh scepter', 'gilded_nile_dynasty'),

    // ⭐⭐⭐ MYTHIC PAIR 2: THE SOLAR DIVINITY
    C('s9', 's9_ra_m',          'solar_divinity',   'bkk', 'mythic', 'Sun God Ra: Primordial Sun 🦅☀️🔥', 'Winged solar falcon helm, floating sun disk, flaming solar khopesh', 'solar_high_noon'),
    C('s9', 's9_sekhmet_f',     'solar_divinity',   'dxb', 'mythic', 'Solar Goddess Sekhmet 🦁☀️🔥', 'Golden lioness tiara, floating sun disk, dual flaming solar khopeshes', 'solar_high_noon'),

    // =========================================================
    // SEASON 10: PHANTOM MASQUERADE: THE GRAND CARNIVAL OF FATE
    // =========================================================
    // ⭐ RARE (4 pairs)
    C('s10', 's10_gondolier_m',   'gondolier',        'bkk', 'rare',   'Grand Canal Gondolier 🛶🌊',       'Striped shirt, straw boater hat with red ribbon & oar',          'canal_glider'),
    C('s10', 's10_gondolier_f',   'gondolier',        'dxb', 'rare',   'Venetian Water Maiden 🛶🌊',       'Lace striped dress, straw hat & glowing lantern',                'canal_glider'),
    C('s10', 's10_bauta_m',       'bauta',            'bkk', 'rare',   'Bauta Aristocrat 🎭🎩',            'Black silk cape, tricorn hat & white bauta mask',                'masquerade_cloak'),
    C('s10', 's10_bauta_f',       'bauta',            'dxb', 'rare',   'Moretta Contessa 🎭👒',            'Black velvet gown & delicate round moretta veil',                'masquerade_cloak'),
    C('s10', 's10_harlequin_m',   'harlequin',        'bkk', 'rare',   'Carnival Arlecchino 🃏🎪',         'Diamond-checkered carnival suit & jester bells',                 'harlequin_trick'),
    C('s10', 's10_harlequin_f',   'harlequin',        'dxb', 'rare',   'Carnival Columbina 🃏🎪',          'Harlequin corset dress, lace wristlets & jester cap',            'harlequin_trick'),
    C('s10', 's10_doctor_m',      'plague_doctor',    'bkk', 'rare',   'Il Dottore Apothecary 🩺🪶',       'Leather plague doctor beaked mask, leather coat & herbs',        'herbal_concoction'),
    C('s10', 's10_doctor_f',      'plague_doctor',    'dxb', 'rare',   'Alchemist Sorceress 🧪🪶',         'Feathered raven cowl, glass vials & potion satchel',             'herbal_concoction'),

    // ⭐⭐ EPIC (3 pairs)
    C('s10', 's10_tarot_m',       'tarot_magician',   'bkk', 'epic',   'The Grand Magician of Fate 🎴✨',  'Arcane velvet vest, star cloak & floating tarot arc',            'tarot_card_draw'),
    C('s10', 's10_tarot_f',       'tarot_magician',   'dxb', 'epic',   'High Priestess of Fate 🎴✨',      'Starry silk robe, crescent veil & celestial fate cards',         'tarot_card_draw'),
    C('s10', 's10_opera_m',       'opera_duet',       'bkk', 'epic',   'Baritone of Venice 🎶🎭',          'Gold-trimmed gala coat, silk scarf & aria sheet',                'crescendo_aria'),
    C('s10', 's10_opera_f',       'opera_duet',       'dxb', 'epic',   'Prima Donna Soprano 🎶🎭',         'Crimson corset gown, diamond choker & crystal rose',             'crescendo_aria'),
    C('s10', 's10_clockwork_m',   'clockwork_jester', 'bkk', 'epic',   'St. Mark Automaton ⚙️🎭',          'Brass clockwork gears, harlequin vest & gold monocle',           'gears_of_venice'),
    C('s10', 's10_clockwork_f',   'clockwork_jester', 'dxb', 'epic',   'Clockwork Ballerina ⚙️🩰',         'Enchanted brass tutu, wind-up key & porcelain mask',             'gears_of_venice'),

    // ⭐⭐⭐ MYTHIC PAIR (1 pair)
    C('s10', 's10_phantom_m',     'phantom_royalty',  'bkk', 'mythic', 'Phantom Wolf Maestro 🐺🎭🥀',     'Midnight velvet tailcoat, silver half-mask & opera baton',       'phantom_curtain_call'),
    C('s10', 's10_phantom_f',     'phantom_royalty',  'dxb', 'mythic', 'Black Swan Dragon Empress 🐉🎭🥀', 'Black swan feathered gown, golden filigree mask & obsidian rose', 'phantom_curtain_call'),

    // =========================================================
    // SEASON 11: PANTHEON OF THE GODS: OLYMPUS THUNDER & THE ELYSIAN FORGE
    // =========================================================
    // ⭐ RARE (4 pairs)
    C('s11', 's11_hoplite_m',     'hoplite',          'bkk', 'rare',   'Spartan Vanguard 🛡️⚔️',           'Crimson cape, bronze muscle cuirass & Spartan spear',            'phalanx_guard'),
    C('s11', 's11_hoplite_f',     'hoplite',          'dxb', 'rare',   'Athenian Shieldmaiden 🛡️⚔️',      'Grecian armor, hoplite round shield & olive crest helmet',       'phalanx_guard'),
    C('s11', 's11_oracle_m',      'oracle',           'bkk', 'rare',   'Delphi Seer 🔮✨',                 'Chiton robe, laurel wreath & glowing prophetic brazier',         'delphic_vision'),
    C('s11', 's11_oracle_f',      'oracle',           'dxb', 'rare',   'Pythia Oracle 🔮✨',               'Ivory veil, sacred tripod incense & glowing crystal sphere',     'delphic_vision'),
    C('s11', 's11_bacchus_m',     'bacchus',          'bkk', 'rare',   'Dionysus Wanderer 🍇🍷',           'Toga draped with grapevine leaves & golden wine chalice',        'nectar_revelry'),
    C('s11', 's11_bacchus_f',     'bacchus',          'dxb', 'rare',   'Maenad Wine Muse 🍇🍷',            'Silk chiton with purple grape sash & thyrsus staff',             'nectar_revelry'),
    C('s11', 's11_gladiator_m',   'gladiator',        'bkk', 'rare',   'Colosseum Champion 🏟️🗡️',          'Gladiator subligaculum, leather manica & gladius sword',         'arena_fury'),
    C('s11', 's11_gladiator_f',   'gladiator',        'dxb', 'rare',   'Colosseum Victor 🏟️🗡️',            'Gold-plated arena armor, sica dagger & victory laurel',          'arena_fury'),

    // ⭐⭐ EPIC (3 pairs)
    C('s11', 's11_pegasus_m',     'pegasus_rider',    'bkk', 'epic',   'Celestial Pegasus Aviator 🪽⚡',  'Gold-trimmed aviator tunic, celestial wings & golden feather',   'pegasus_tailwind'),
    C('s11', 's11_pegasus_f',     'pegasus_rider',    'dxb', 'epic',   'Sky Valkyrie of Olympus 🪽⚡',    'Silver-gold winged armor, celestial halo & dawn spear',          'pegasus_tailwind'),
    C('s11', 's11_hades_m',       'underworld',       'bkk', 'epic',   'Sovereign of Hades 💀🖤',          'Obsidian underworld armor, spectral bident & cerberus cloak',    'tartarus_vault'),
    C('s11', 's11_persephone_f',  'underworld',       'dxb', 'epic',   'Queen of Underworld 🥀🖤',         'Black silk gown, pomegranate tiara & ghostly floral bouquet',    'tartarus_vault'),
    C('s11', 's11_forge_m',       'hephaestus_forge', 'bkk', 'epic',   'Elysian Master Blacksmith 🔨🔥',   'Golden forge apron, celestial hammer & solar sparks',            'divine_tempering'),
    C('s11', 's11_forge_f',       'hephaestus_forge', 'dxb', 'epic',   'Solar Forge Maiden 🔥✨',          'Gilded tunic, solar bronze armguards & eternal flame lantern',   'divine_tempering'),

    // ⭐⭐⭐ MYTHIC PAIR (1 pair)
    C('s11', 's11_zeus_m',        'olympus_divinity', 'bkk', 'mythic', 'Thunder Wolf Sovereign Zeus 🐺⚡🏛️', 'Chlamys draped over golden aegis, storm wolf ears & Master Lightning Bolt', 'olympus_wrath'),
    C('s11', 's11_athena_f',      'olympus_divinity', 'dxb', 'mythic', 'Goddess of Dawn Athena 🐉⚡🏛️',  'Ivory silk peplos, celestial dragon wings, owl crest crown & Aegis divine shield', 'olympus_wrath')
  ];

  const BY_ID = Object.fromEntries(COSTUMES.map((c) => [c.id, c]));

  function poolFor(role, season = 'main') {
    if (season === 'main' || season === 'standard' || season === 'all') {
      return COSTUMES.filter((c) => c.role === role);
    }
    return COSTUMES.filter((c) => c.role === role && c.season === season);
  }

  /** Monopoly effects for a role's equipped costume (+ resonance when pairs match). */
  function monopolyEffects(myCostumeId, partnerCostumeId) {
    const out = {};
    const mine = BY_ID[myCostumeId];
    if (mine && PERKS[mine.perk]) Object.assign(out, PERKS[mine.perk].effects.monopoly);
    const theirs = BY_ID[partnerCostumeId];
    if (mine && theirs && mine.pair === theirs.pair && mine.season === theirs.season) {
      out.lapBonus = (out.lapBonus || 0) + RESONANCE.effects.monopoly.lapBonus;
      out.resonance = true;
    }
    return out;
  }

  /** Determine threat classification tier from the match's bot composition. */
  function getPartyThreatTier(players) {
    const pList = Array.isArray(players) ? players : Object.values(players || {});
    const bots = pList.filter((p) => p && (p.isBot || String(p.role || p.id).startsWith('bot')));
    const humans = pList.filter((p) => p && !p.isBot && !String(p.role || p.id).startsWith('bot'));

    // Solo Gauntlet (1 Human vs 3 Bots)
    if (humans.length === 1 && bots.length >= 2) {
      const insaneCount = bots.filter((b) => b.botLevel === 'insane').length;
      const hardCount = bots.filter((b) => b.botLevel === 'hard').length;
      if (insaneCount >= 2) return 'gauntlet_insane';
      if (hardCount + insaneCount >= 2) return 'gauntlet_hard';
      return 'gauntlet_easy';
    }

    if (bots.length === 0) return 'couple';

    // 3P Flight (2 Humans + 1 Bot)
    if (bots.length === 1) {
      if (bots[0].botLevel === 'insane') return 'insane_3p';
      if (bots[0].botLevel === 'hard') return 'hard_3p';
      return 'easy_3p';
    }

    // 4P Flight (2 Humans + 2 Bots)
    const insaneCount = bots.filter((b) => b.botLevel === 'insane').length;
    const hardCount = bots.filter((b) => b.botLevel === 'hard').length;

    if (insaneCount >= 2) return 'apex_extreme';
    if (insaneCount >= 1 && hardCount >= 1) return 'high_insane';
    if (hardCount >= 2 || insaneCount === 1) return 'extreme';
    if (hardCount === 1) return 'high';
    return 'standard';
  }

  /** Compute payouts for all humans based on tier, placements, chemistry, and demolition bounties. */
  function computePartyPayouts(tierKey, placements, matches = 0, bounties = {}, dailyTracker = {}) {
    const table = ECONOMY.PARTY_REWARDS[tierKey] || ECONOMY.PARTY_REWARDS.couple;
    const humanWinner = placements[0] && !placements[0].startsWith('bot') ? placements[0] : null;
    const vibeDiamonds = Math.max(0, Math.min(50, Number(matches) || 0)) * ECONOMY.PER_VIBE_MATCH;
    const payouts = {};

    ['bkk', 'dxb'].forEach((role) => {
      const rankIndex = placements.indexOf(role);
      if (rankIndex === -1) return;

      let base = 0;
      let tickets = 0;
      let fish = 0;
      let stardust = 0;
      let syndicate = 0;
      const won = rankIndex === 0;

      if (tierKey === 'couple') {
        if (won) {
          base = table.first.diamonds;
          fish = table.first.fish;
          stardust = table.first.stardust;
        } else {
          base = table.second.diamonds;
          fish = table.second.fish;
          stardust = table.second.stardust;
        }
      } else if (tierKey.startsWith('gauntlet_')) {
        if (won) {
          base = table.first.diamonds;
          tickets = table.first.tickets || 0;
          fish = table.first.fish || 0;
          stardust = table.first.stardust || 0;
        } else {
          base = (table.consolation && table.consolation.diamonds) || 50;
          tickets = (table.consolation && table.consolation.tickets) || 0;
          fish = (table.consolation && table.consolation.fish) || 1;
          stardust = (table.consolation && table.consolation.stardust) || 5;
        }
      } else {
        // 3P or 4P Party modes
        if (rankIndex === 0) {
          base = table.first.diamonds;
          tickets = table.first.tickets || 0;
          fish = table.first.fish || 0;
          stardust = table.first.stardust || 0;
        } else if (rankIndex === 1) {
          base = table.second.diamonds;
          fish = table.second.fish || 0;
          stardust = table.second.stardust || 0;
          if (humanWinner) {
            syndicate = table.syndicateDividend || 0;
          }
        } else if (rankIndex === 2) {
          base = table.third.diamonds;
          fish = table.third.fish || 0;
          stardust = table.third.stardust || 0;
          if (humanWinner) {
            syndicate = table.syndicateRescue3rd || 0;
          }
        } else if (rankIndex >= 3) {
          base = (table.fourth && table.fourth.diamonds) || 100;
          fish = (table.fourth && table.fourth.fish) || 1;
          stardust = (table.fourth && table.fourth.stardust) || 5;
          if (humanWinner) {
            syndicate = table.syndicateRescue4th || 0;
          }
        }
      }

      const bountyAmt = Math.max(0, Number(bounties[role]) || 0);
      const dailyAmt = dailyTracker[role] ? ECONOMY.DAILY_FIRST_GAME : 0;
      const totalDiamonds = base + syndicate + vibeDiamonds + bountyAmt + dailyAmt;

      payouts[role] = {
        rank: rankIndex + 1,
        total: totalDiamonds,
        base,
        syndicate,
        vibe: vibeDiamonds,
        bounty: bountyAmt,
        daily: dailyAmt,
        tickets,
        fish,
        stardust,
        won,
        tierKey,
        tierName: table.name || table.label || tierKey
      };
    });

    return payouts;
  }

  const api = {
    RARITY,
    ECONOMY,
    SEASONS,
    PERKS,
    RESONANCE,
    COSTUMES,
    BY_ID,
    poolFor,
    monopolyEffects,
    getPartyThreatTier,
    computePartyPayouts
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NookCostumes = api;
})(typeof window !== 'undefined' ? window : globalThis);
