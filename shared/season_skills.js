// shared/season_skills.js — 100% data-driven Mythic & Super Mythic Ultimates (Sky Monopoly 2.5D + Moon Defense V2 + Future 6-Biome MMORPG).
// The engine NEVER checks costume names: adding a new Season = adding one entry here.
//
// `affinity` = the ONE home-turf theme of this costume (spirit · desert · ocean · fortune · frost · celestial,
// see THEMES in shared/monopoly_rules.js): +15% rent & −15% upgrade cost on that zone in Monopoly, and +20%
// Elemental DMG in matching Moon Defense / MMORPG biomes.
//
// Action primitives (executed by shared/skill_engine.js):
//   APPLY_PLAYER_STATUS  { target, status }                  → player.status slot (fixedRoll, maxRoll, moveDir, skipTurn, discountPct, lapTax)
//   PLACE_TILE_MODIFIER  { target, count, offset, radius, modifier } → tile.modifier slot (rentMult, burnSiphon, stealCoupon, grantOwnerCoupon, pushSteps, pullTowardOwnerBest, warpToOwnerBest, prison, reverseTrap)
//   SHATTER_SHIELD       { target, count }                   → strips rival Barrier Shields
//   STEAL_SHIELD         { target, count, fallbackGrant }    → steals rival Barrier Shield & grants to caster
//   MOVE_PLAYERS         { target, pullTowardCaster | pullTowardMyBest | steps } → forced move, resolves rent only (max 1 hop)
//   MODIFY_PROPERTY      { target, level, bounty }           → ±level on richest rival's best tile (Tier 4 immune)
//   MODIFY_OWN_PROPERTY  { target, level }                   → upgrades caster's own property (+1 Tier, up to Tier 3)
//   TRANSFER_CASH        { from, amount | pct }              → rivals pay the caster
//   GAIN_CASH            { amount }                          → bank pays the caster
//   SET_TILE_TIER        { target, tier, step }              → e.g. Tier-4 Golden Pyramid
//   CLEAR_MODIFIERS      { target: 'caster_side' }           → wipes rival traps on caster's side & owned properties
//   STEAL_PROPERTY       { target, maxTier }                 → richest rival's cheapest Tier ≤ maxTier tile
//   SWAP_PROPERTY        { target, maxTier }                 → my cheapest ↔ rival's best Tier ≤ maxTier
//   GRANT                { shields, revive, coupons }        → caster inventory
// Control blocks: CHOICE { options:[{id,label,actions}] }, ROLL_TABLE { outcomes:[{w,id,actions}] },
//   WARP_PICK (player picks any tile to fly to), IF_UNDERDOG { actions }.

const T = (n) => n; // readability: turnsLeft counts the affected player's turns (status) or full rounds (tiles)

export const SEASON_SKILLS = {
  s1_naga_sovereign: {
    affinity: 'ocean', combatClass: 'mystic', choreography: 'surf_wave',
    name: 'Downstream Current Push', icon: '🌊', fxTheme: 'naga_wave', vfx: 'wave',
    desc: '+270 🪙, places 2 Waterway currents before your best property (pushes rivals +2 tiles onto it) & surfs the richest rival 2 steps toward your best property.',
    monopoly: {
      onUltimate: [
        { action: 'PLACE_TILE_MODIFIER', target: 'before_my_best', count: 2, offset: 2, modifier: { pushSteps: 2, turnsLeft: T(4), fxTheme: 'waterway' } },
        { action: 'MOVE_PLAYERS', target: 'richest_rival', pullTowardMyBest: 2 },
      ],
      fallback: [{ action: 'GAIN_CASH', amount: 300 }],
    },
    combat: {
      classRole: 'Mystic (Tidal Pusher & Healer)',
      basicProjectile: 'fx_bubble',
      ultName: 'Emerald Naga Tsunami Surge',
      ultDesc: 'Summons the Emerald Naga Sea-Serpent to surf up the monster lane, knocking all enemies back 5m & leaving a speeding water current (+25% ally ATK SPD).',
    },
  },
  s2_kitsune_inari: {
    affinity: 'spirit', combatClass: 'mystic', choreography: 'portal_ambush',
    name: 'Torii Shrine Kidnap', icon: '⛩️', fxTheme: 'foxfire', vfx: 'crystal',
    desc: '+240 🪙, blesses your best property (1.65× Inari Foxfire Rent) & places 2 Torii Shrine gates ahead of rivals that warp them straight onto it.',
    monopoly: {
      onUltimate: [
        { action: 'PLACE_TILE_MODIFIER', target: 'my_best', count: 1, modifier: { rentMult: 1.65, turnsLeft: T(3), fxTheme: 'foxfire' } },
        { action: 'PLACE_TILE_MODIFIER', target: 'ahead_of_rivals', count: 2, offset: 4, modifier: { warpToOwnerBest: true, oneShot: true, turnsLeft: T(4), fxTheme: 'torii' } },
      ],
      requiresOwnedTile: true,
      fallback: [{ action: 'GAIN_CASH', amount: 300 }],
    },
    combat: {
      classRole: 'Mystic (Shrine Portal & Bunny Healer)',
      basicProjectile: 'fx_flame',
      ultName: 'Inari Torii Gate Kidnap',
      ultDesc: 'Opens a Vermilion Torii Portal in front of the Moon Bunny that warps touching monsters back to the North Spawn Gate & heals the Moon Bunny +120 HP.',
    },
  },
  s2_tsukuyomi_eclipse: {
    affinity: 'spirit', combatClass: 'controller', choreography: 'lunar_domain',
    name: 'Eclipse Sleepwalk & Dream Lanterns', icon: '🌙', fxTheme: 'lunar_lantern', vfx: 'vortex',
    desc: '+285 🪙, locks all rivals to a fixed 3-step dice roll next turn & plants Lunar Dream Lanterns 3 steps ahead of rivals (75 🪙 siphon + steals 1 Upgrade Coupon).',
    monopoly: {
      onUltimate: [
        { action: 'APPLY_PLAYER_STATUS', target: 'all_rivals', status: { fixedRoll: 3, turnsLeft: T(1), fxTheme: 'sleepwalk' } },
        { action: 'PLACE_TILE_MODIFIER', target: 'ahead_of_rivals', count: 2, offset: 3, modifier: { burnSiphon: 75, stealCoupon: true, turnsLeft: T(3), fxTheme: 'lunar_lantern' } },
      ],
    },
    combat: {
      classRole: 'Controller (Lunar Sleep & True-DMG Mines)',
      basicProjectile: 'fx_moon',
      ultName: 'Tsukuyomi Lunar Sleepwalk',
      ultDesc: 'Puts all monsters in the lane to Sleep (3.5s) and suspends 3 Lunar Dream Lanterns that detonate for 3× True Damage when they wake.',
    },
  },
  s3_sultan_djinn: {
    affinity: 'desert', combatClass: 'alchemist', choreography: 'lamp_summon',
    name: '3 Cosmic Wishes', icon: '🪔', fxTheme: 'djinn', vfx: 'vortex',
    desc: '+240 🪙 & grants 1 of 3 Wishes: 2.4× Midas Gold Rent (3 rounds), Oasis Property Swap (up to Tier 1), or Magic Carpet Flight.',
    monopoly: {
      onUltimate: [{
        action: 'CHOICE',
        options: [
          { id: 'midas', label: '🪙 Midas 24k Gold Tile (2.4× rent)', actions: [{ action: 'PLACE_TILE_MODIFIER', target: 'my_best', count: 1, modifier: { rentMult: 2.4, turnsLeft: T(3), fxTheme: 'midas' } }], fallback: [{ action: 'GAIN_CASH', amount: 300 }] },
          { id: 'swap', label: '🏝️ Oasis Property Swap', actions: [{ action: 'SWAP_PROPERTY', target: 'richest_rival', maxTier: 1 }], fallback: [{ action: 'GAIN_CASH', amount: 300 }] },
          { id: 'carpet', label: '🧞 Magic Carpet Flight', actions: [{ action: 'WARP_PICK' }] },
        ],
      }],
    },
    combat: {
      classRole: 'Alchemist (Tactical Wish Maker)',
      basicProjectile: 'fx_stardust',
      ultName: 'Sultan’s 3 Cosmic Battle Wishes',
      ultDesc: 'Summons the Cosmic Genie from its Golden Lamp to grant +180 🪙 Mochi Coins, a Free ★2 Mercenary Bot, or a 3-Lane Magic Carpet Bombing.',
    },
  },
  s3_dune_phoenix: {
    affinity: 'desert', combatClass: 'striker', choreography: 'sky_dive',
    name: 'Phoenix Divebomb & Rebirth', icon: '🔥', fxTheme: 'phoenix', vfx: 'projectile',
    desc: '+180 🪙, dives forward +2 tiles across the board, ignites 3 tiles behind you (85 🪙 burn siphon), scorches all rivals for 60 🪙, grants Phoenix Revive & 50% Underdog discount.',
    monopoly: {
      onUltimate: [
        { action: 'MOVE_PLAYERS', target: 'self', steps: 2 },
        { action: 'PLACE_TILE_MODIFIER', target: 'behind_caster', count: 3, modifier: { burnSiphon: 85, turnsLeft: T(4), fxTheme: 'fire' } },
        { action: 'TRANSFER_CASH', from: 'all_rivals', amount: 60 },
        { action: 'IF_UNDERDOG', actions: [{ action: 'APPLY_PLAYER_STATUS', target: 'self', status: { discountPct: 0.5, turnsLeft: T(2), fxTheme: 'underdog' } }] },
        { action: 'GRANT', revive: 1, maxRevive: 1 },
      ],
    },
    combat: {
      classRole: 'Striker (Aerial Divebomb & Immortal)',
      basicProjectile: 'fx_flame',
      ultName: 'Solar Phoenix Divebomb',
      ultDesc: 'Swoops diagonally down the monster lane leaving a Blazing Fire Carpet (400 DMG/s for 5s) & grants the Moon Bunny a Phoenix Revive (+300 HP on fatal hit).',
    },
  },
  s4_casino_royale: {
    affinity: 'fortune', combatClass: 'alchemist', choreography: 'spin_wheel',
    name: 'Roulette Spin & Pass-GO Heist', icon: '🎡', fxTheme: 'roulette', vfx: 'roulette',
    desc: 'Rakes 50 🪙 from the richest rival, spins the Golden Roulette (Steal Property / 1.75× Chip Rent on 2 tiles / 140 🪙 from all) + 15% Salary Heist.',
    monopoly: {
      onUltimate: [
        { action: 'TRANSFER_CASH', from: 'richest_rival', amount: 50 },
        {
          action: 'ROLL_TABLE',
          outcomes: [
            { w: 18, id: 'red', label: '🔴 RED — Steal 1 Property', actions: [{ action: 'STEAL_PROPERTY', target: 'richest_rival', maxTier: 1 }], fallback: [{ action: 'GAIN_CASH', amount: 240 }] },
            { w: 18, id: 'black', label: '⚫ BLACK — 1.75× Rent', actions: [{ action: 'PLACE_TILE_MODIFIER', target: 'my_tiles', count: 2, modifier: { rentMult: 1.75, turnsLeft: T(2), fxTheme: 'chips' } }], fallback: [{ action: 'GAIN_CASH', amount: 240 }] },
            { w: 3, id: 'green', label: '🟢 00 — 140 🪙 from everyone', actions: [{ action: 'TRANSFER_CASH', from: 'all_rivals', amount: 140 }] },
          ],
        },
        { action: 'APPLY_PLAYER_STATUS', target: 'self', status: { lapTax: 0.15, turnsLeft: T(2), fxTheme: 'heist' } },
      ],
    },
    combat: {
      classRole: 'Alchemist (High-Roller Jackpot DPS)',
      basicProjectile: 'fx_chip',
      ultName: 'Royal 007 Roulette Jackpot',
      ultDesc: 'Spins the 3D Golden Roulette Wheel in the plaza—dealing 777–2,100 AoE Ace-Card Slash DMG and exploding into +150 🪙 Mochi Coins.',
    },
  },
  s5_atlantis_siren: {
    affinity: 'ocean', combatClass: 'mystic', choreography: 'trident_plunge',
    name: 'Poseidon Trident Flood', icon: '🌀', fxTheme: 'abyss', vfx: 'wave',
    desc: '+390 🪙, plunges Poseidon’s Trident to flood a 3-tile radius (2.0× Coral Rent on your tiles, 0× Submerged Rent on rival tiles) & Waterlogs nearby rivals (caps dice roll at 1–3).',
    monopoly: {
      onUltimate: [
        { action: 'PLACE_TILE_MODIFIER', target: 'around_caster', radius: 3, ownedBy: 'self', modifier: { rentMult: 2.0, turnsLeft: T(3), fxTheme: 'coral' } },
        { action: 'PLACE_TILE_MODIFIER', target: 'around_caster', radius: 3, ownedBy: 'rivals', modifier: { rentMult: 0, turnsLeft: T(2), fxTheme: 'ruins' } },
        { action: 'APPLY_PLAYER_STATUS', target: 'around_caster_rivals', status: { maxRoll: 3, turnsLeft: T(1), fxTheme: 'waterlogged' } },
      ],
      fallback: [{ action: 'GAIN_CASH', amount: 300 }],
    },
    combat: {
      classRole: 'Mystic (Whirlpool Maelstrom Control)',
      basicProjectile: 'fx_bubble',
      ultName: 'Leviathan Trident Maelstrom',
      ultDesc: 'Plunges the Golden Trident into the plaza, erupting a Whirlpool Vortex that pulls monsters from all 3 lanes inward and slows them by -50%.',
    },
  },
  s6_astral_sovereign: {
    affinity: 'celestial', combatClass: 'controller', choreography: 'gravity_singularity',
    name: 'Event Horizon Gravity Pull', icon: '🌌', fxTheme: 'supernova', vfx: 'vortex',
    desc: '+380 🪙, crowns your best property with 1.6× Supernova Core & opens a Black Hole that drags all rivals 2 steps toward you.',
    monopoly: {
      onUltimate: [
        { action: 'PLACE_TILE_MODIFIER', target: 'my_best', count: 1, modifier: { rentMult: 1.6, turnsLeft: T(2), fxTheme: 'supernova' } },
        { action: 'MOVE_PLAYERS', target: 'all_rivals', pullTowardCaster: 2 },
      ],
    },
    combat: {
      classRole: 'Controller (Black Hole Singularity)',
      basicProjectile: 'fx_star',
      ultName: 'Event Horizon Supernova',
      ultDesc: 'Opens a pitch-black Event Horizon Singularity that drags all monsters within 8m into a single point before detonating a Supernova Comet Shower (1,400 DMG).',
    },
  },
  s7_cinderella_clock: {
    affinity: 'frost', combatClass: 'controller', choreography: 'clock_rewind',
    name: 'Midnight Clock Rewind', icon: '🕰️', fxTheme: 'midnight', vfx: 'roulette',
    desc: '+395 🪙, spins the Midnight Clock backwards so all rivals walk in reverse next turn, places 2 Glass Slipper prison traps (100 🪙 Midnight Toll) & crowns your top 2 tiles with 1.75× Midnight Carriage.',
    monopoly: {
      onUltimate: [
        { action: 'APPLY_PLAYER_STATUS', target: 'all_rivals', status: { moveDir: -1, turnsLeft: T(1), fxTheme: 'rewind' } },
        { action: 'PLACE_TILE_MODIFIER', target: 'ahead_of_rivals', count: 2, offset: -3, modifier: { prison: true, burnSiphon: 100, oneShot: true, turnsLeft: T(3), fxTheme: 'slipper' } },
        { action: 'PLACE_TILE_MODIFIER', target: 'my_tiles', count: 2, modifier: { rentMult: 1.75, turnsLeft: T(2), fxTheme: 'midnight' } },
      ],
    },
    combat: {
      classRole: 'Controller (Chrono Time Rewinder)',
      basicProjectile: 'fx_snowflake',
      ultName: 'Twelfth Stroke Time Rewind',
      ultDesc: 'Spins the Celestial Clock Hands counter-clockwise, physically rewinding all monsters backwards up their lanes for 4s and caging Elites in Glass Slippers.',
    },
  },
  s8_glacial_elsa: {
    affinity: 'frost', combatClass: 'controller', choreography: 'domino_glacier',
    name: 'Absolute Zero Domino Glacier', icon: '❄️', fxTheme: 'glacial_crest', vfx: 'crystal',
    desc: '+340 🪙, erupts a domino glacier wave freezing the richest rival (skips turn), encasing 2 rival hotels in 0× Ice Cubes & crowning your best tile with 1.5× Permafrost.',
    monopoly: {
      onUltimate: [
        { action: 'APPLY_PLAYER_STATUS', target: 'richest_rival', status: { skipTurn: true, turnsLeft: T(1), fxTheme: 'ice_cube' } },
        { action: 'PLACE_TILE_MODIFIER', target: 'rival_best', count: 2, modifier: { rentMult: 0, turnsLeft: T(2), fxTheme: 'ice_cube' } },
        { action: 'PLACE_TILE_MODIFIER', target: 'my_best', count: 1, modifier: { rentMult: 1.5, turnsLeft: T(2), fxTheme: 'glacial_crest' } },
      ],
    },
    combat: {
      classRole: 'Controller (Absolute Zero Deep-Freeze)',
      basicProjectile: 'fx_snowflake',
      ultName: 'Absolute Zero Glacier Eruption',
      ultDesc: 'Erupts a sequential Domino Glacier Wave down the lane—encasing all monsters & the Boss inside translucent 3D Ice Cubes for 6s (+25% shatter DMG).',
    },
  },
  s9_pharaoh_ra: {
    affinity: 'desert', combatClass: 'striker', choreography: 'orbital_laser',
    name: 'Eye of Ra Pyramid & Solar Laser', icon: '📐', fxTheme: 'solar', vfx: 'pillar',
    desc: '+140 🪙, ascends your best property toward an indestructible Tier-4 Golden Pyramid (4.5× rent) & sweeps an Eye-of-Ra Solar Laser purging rival traps on your row and properties.',
    monopoly: {
      onUltimate: [
        { action: 'SET_TILE_TIER', target: 'my_best', tier: 4, step: 1 },
        { action: 'CLEAR_MODIFIERS', target: 'caster_side' },
      ],
      fallback: [{ action: 'GAIN_CASH', amount: 300 }],
    },
    combat: {
      classRole: 'Striker (Sweeping Solar Laser & Armor Melt)',
      basicProjectile: 'fx_flame',
      ultName: 'Eye of Ra Sweeping Solar Beam',
      ultDesc: 'Summons a levitating Golden Pyramid that sweeps a continuous 360° Solar Laser across all 3 lanes (1,600 Burn DMG + melts -30% Boss Armor).',
    },
  },
  s10_phantom_masque: {
    affinity: 'fortune', combatClass: 'alchemist', choreography: 'twin_mirrors',
    name: 'Twin Venetian Mirror Trap', icon: '🎭', fxTheme: 'masque', vfx: 'crystal',
    desc: '+285 🪙 & opens a Crimson Venetian Mirror portal on the richest rival’s best hotel (echoed onto their 2nd hotel on Pet Combo! Even Tier-4 Pyramids — reverses rent so the owner pays you!).',
    monopoly: {
      onUltimate: [{ action: 'PLACE_TILE_MODIFIER', target: 'rival_best', count: 1, modifier: { reverseTrap: true, turnsLeft: T(3), fxTheme: 'mirror' } }],
      fallback: [{ action: 'GAIN_CASH', amount: 300 }],
    },
    combat: {
      classRole: 'Alchemist (Mirror Reflection & Clone Shots)',
      basicProjectile: 'fx_feather',
      ultName: 'Phantom Opera Mirror Reflection',
      ultDesc: 'Summons Twin Venetian Mirror Portals that reflect 200% of Boss slam damage back at the Boss and double your Hero’s basic attack shots for 6s.',
    },
  },
  s11_zeus_olympus: {
    affinity: 'celestial', combatClass: 'striker', choreography: 'sky_artillery',
    name: 'Olympus Thunderbolt Artillery', icon: '⚡', fxTheme: 'zeus', vfx: 'pillar',
    desc: '+120 🪙, forms Olympus storm clouds to shatter 1 rival Shield, smite the richest rival’s best hotel (−1 Tier + 150 🪙 bounty) & charge your best tile to 1.5× rent.',
    monopoly: {
      onUltimate: [
        { action: 'SHATTER_SHIELD', target: 'richest_rival', count: 1 },
        { action: 'MODIFY_PROPERTY', target: 'richest_rival_best', level: -1, bounty: 150 },
        { action: 'PLACE_TILE_MODIFIER', target: 'my_best', count: 1, modifier: { rentMult: 1.5, turnsLeft: T(3), fxTheme: 'lightning_rod' } },
      ],
    },
    combat: {
      classRole: 'Striker (High-Altitude Lightning Execution)',
      basicProjectile: 'fx_lightning',
      ultName: 'Olympus 24k Thunderbolt Barrage',
      ultDesc: 'Gathers Olympus Storm Clouds at the top of the arena and hurls 5 Jagged Golden Lightning Spears into the Boss & Elites (2,200 True DMG + Stun).',
    },
  },

  // ============================================================================
  // ✦ SUPER MYTHIC SOVEREIGNS (5 Unique Cross-Game Domain Ultimates)
  // ============================================================================
  sm_eclipse_dragon: {
    affinity: 'celestial', combatClass: 'striker', choreography: 'dragon_eclipse',
    name: 'Total Solar Eclipse: Dragon Gravity', icon: '☀️', fxTheme: 'eclipse_sun', vfx: 'pillar',
    superMythic: true, superVfx: 'eclipse_domain', monument: 'mono_ult_sm_eclipse',
    desc: '+40 🪙, purges row traps, shatters 1 Shield, blasts the richest rival’s best hotel (−1 Tier + 50 🪙), crowns your best tile with 1.5× Eclipse Sun & plants 2 Solar Gravity Wells around it that pull rivals in!',
    monopoly: {
      baseCash: 40,
      onUltimate: [
        { action: 'CLEAR_MODIFIERS', target: 'caster_side' },
        { action: 'SHATTER_SHIELD', target: 'richest_rival', count: 1 },
        { action: 'MODIFY_PROPERTY', target: 'richest_rival_best', level: -1, bounty: 50, ownerOnly: true },
        { action: 'PLACE_TILE_MODIFIER', target: 'my_best', count: 1, modifier: { rentMult: 1.5, turnsLeft: T(3), fxTheme: 'eclipse_sun' } },
        { action: 'PLACE_TILE_MODIFIER', target: 'around_my_best', count: 2, modifier: { burnSiphon: 35, pullTowardOwnerBest: 1, turnsLeft: T(3), fxTheme: 'eclipse_sun' } },
      ],
    },
    combat: {
      classRole: 'Striker Sovereign (Colossal Solar Dragon Boss Summon)',
      basicProjectile: 'fx_flame',
      ultName: 'Total Solar Eclipse: Dragon Cataclysm',
      ultDesc: 'Dims the arena to a Black-Sun Eclipse as the Colossal Golden Dragon swoops down, dealing 1,800 AoE Solar DMG and leaving a Black-Sun Gravity Well.',
    },
  },
  sm_aurora_empress: {
    affinity: 'celestial', combatClass: 'mystic', choreography: 'aurora_seraph',
    name: 'Borealis Empire & Slow-Motion Veil', icon: '🌙', fxTheme: 'aurora_veil', vfx: 'wave',
    superMythic: true, superVfx: 'aurora_veil', monument: 'mono_ult_sm_aurora',
    desc: '+240 🪙, washes Northern Lights across your top 3 properties (1.55× Aurora Rent), hexes ALL rivals with Aurora Slow-Mo (dice capped at 1–2 next turn) & grants +1 Barrier Shield.',
    monopoly: {
      baseCash: 240,
      onUltimate: [
        { action: 'PLACE_TILE_MODIFIER', target: 'my_tiles', count: 3, modifier: { rentMult: 1.55, turnsLeft: T(3), fxTheme: 'aurora_veil' } },
        { action: 'APPLY_PLAYER_STATUS', target: 'all_rivals', status: { maxRoll: 2, turnsLeft: T(1), fxTheme: 'aurora_slow' } },
        { action: 'GRANT', shields: 1 },
      ],
      fallback: [{ action: 'GAIN_CASH', amount: 180 }],
    },
    combat: {
      classRole: 'Mystic Sovereign (6-Winged Aurora Seraph Sanctuary)',
      basicProjectile: 'fx_stardust',
      ultName: 'Borealis 6-Winged Sanctuary Veil',
      ultDesc: 'Unfurls 6 Iridescent Aurora Wings across the arena—healing the Moon Bunny +180 HP, granting party +1 Shield, and slowing all monsters by -60% (5s).',
    },
  },
  sm_seraphim_rose: {
    affinity: 'spirit', combatClass: 'mystic', choreography: 'rose_cathedral',
    name: 'Cathedral of Thorns: Rose Ascension', icon: '🌹', fxTheme: 'rose_thorns', vfx: 'crystal',
    superMythic: true, superVfx: 'seraphim_sanctuary', monument: 'mono_ult_sm_seraphim',
    desc: '+105 🪙, upgrades 1 of your properties +1 Tier for free, blesses your best tile (1.45× Rose Sanctuary) & wraps the richest rival’s best hotel in Briar Thorns (0.6× rent + 45 🪙 siphon).',
    monopoly: {
      baseCash: 105,
      onUltimate: [
        { action: 'MODIFY_OWN_PROPERTY', target: 'my_cheapest', level: 1, ownerOnly: true },
        { action: 'PLACE_TILE_MODIFIER', target: 'my_best', count: 1, modifier: { rentMult: 1.45, turnsLeft: T(2), fxTheme: 'rose_thorns' } },
        { action: 'PLACE_TILE_MODIFIER', target: 'rival_best', count: 1, modifier: { rentMult: 0.6, burnSiphon: 45, turnsLeft: T(2), fxTheme: 'rose_thorns' } },
      ],
      fallback: [{ action: 'GAIN_CASH', amount: 220 }],
    },
    combat: {
      classRole: 'Mystic Sovereign (Cathedral Builder & Briar Thorn Root)',
      basicProjectile: 'fx_petal',
      ultName: 'Stained-Glass Rose Cathedral & Briar Bind',
      ultDesc: 'Opens a Stained-Glass Rose Cathedral healing Moon Bunny +200 HP & buffing Mercenaries +25% DMG, while Briar Thorn Vines root all monsters (4s) & siphon HP.',
    },
  },
  sm_cyber_archon: {
    affinity: 'celestial', combatClass: 'striker', choreography: 'cyber_hack',
    name: 'System Hack: Shield & Tier Hijack', icon: '💠', fxTheme: 'cyber_glitch', vfx: 'pillar',
    superMythic: true, superVfx: 'quantum_overdrive', monument: 'mono_ult_sm_cyber',
    desc: 'STEALS 1 Barrier Shield from the richest rival, upgrades 1 of your properties +1 Tier for free & drops a Quantum Glitch trap (65 🪙 siphon) ahead of them.',
    monopoly: {
      baseCash: 0,
      onUltimate: [
        { action: 'STEAL_SHIELD', target: 'richest_rival', count: 1, fallbackGrant: false },
        { action: 'MODIFY_OWN_PROPERTY', target: 'my_cheapest', level: 1, ownerOnly: true },
        { action: 'PLACE_TILE_MODIFIER', target: 'ahead_of_rivals', rival: 'richest_rival', count: 1, offset: 3, modifier: { burnSiphon: 65, oneShot: true, turnsLeft: T(2), fxTheme: 'cyber_glitch' } },
      ],
      fallback: [{ action: 'GAIN_CASH', amount: 240 }],
    },
    combat: {
      classRole: 'Striker Sovereign (Quantum Tesseract Shield-Breaker)',
      basicProjectile: 'fx_lightning',
      ultName: 'Quantum Tesseract Firewall Breach',
      ultDesc: 'Locks a holographic reticle onto the Boss & Elites, stripping all monster shields (-40% DEF), firing a 2,000 Crit DMG Orbital Laser & deploying Decoy Drones.',
    },
  },
  sm_starlight_ribbon: {
    affinity: 'fortune', combatClass: 'alchemist', choreography: 'ribbon_parade',
    name: 'Grand Wish Parade: Puppet Strings & Gift Boxes', icon: '🎀', fxTheme: 'starlight_gift', vfx: 'vortex',
    superMythic: true, superVfx: 'starlight_parade', monument: 'mono_ult_sm_ribbon',
    desc: '+200 🪙, collects a 30 🪙 Parade Ticket from all rivals, marches every rival +2 steps forward on silk ribbons & places 2 Starlight Gift Boxes on your tiles (1.5× Rent + +1 Upgrade Coupon).',
    monopoly: {
      baseCash: 200,
      onUltimate: [
        { action: 'TRANSFER_CASH', from: 'all_rivals', amount: 30 },
        { action: 'PLACE_TILE_MODIFIER', target: 'my_tiles', count: 2, modifier: { rentMult: 1.5, grantOwnerCoupon: true, turnsLeft: T(3), fxTheme: 'starlight_gift' } },
        { action: 'MOVE_PLAYERS', target: 'all_rivals', steps: 2 },
      ],
      fallback: [{ action: 'GAIN_CASH', amount: 240 }],
    },
    combat: {
      classRole: 'Alchemist Sovereign (Silk Ribbon Puppeteer & Gift Box Bomber)',
      basicProjectile: 'fx_star',
      ultName: 'Dreamweaver Starlight Ribbon Parade',
      ultDesc: 'Loops figure-8 silk ribbons around monsters to charm & pull them backward 4m into a cluster, then drops 3 Giant Starlight Gift Boxes (+120 🪙 Mochi Coins).',
    },
  },
};

// Non-Mythic outfits still get an ULTIMATE so every seat can play the same game (by outfit rarity).
export const GENERIC_SKILLS = {
  1: { name: 'Lucky Star Wish', icon: '🌟', fxTheme: 'star', vfx: 'coins', desc: 'Grants +150 🪙 Gold & +1 Barrier Shield in Sky Monopoly.', monopoly: { onUltimate: [{ action: 'GAIN_CASH', amount: 150 }, { action: 'GRANT', shields: 1 }] } },
  2: { name: 'Starlight Fortune', icon: '💫', fxTheme: 'star', vfx: 'coins', desc: 'Grants +200 🪙 Gold & +1 Barrier Shield in Sky Monopoly.', monopoly: { onUltimate: [{ action: 'GAIN_CASH', amount: 200 }, { action: 'GRANT', shields: 1 }] } },
};

// Balance knob: cash every Mythic ultimate grants before its tactical effect (scaled by Couple Synergy).
// Tuned with the bot simulation in tests/monopoly.test.js so every Mythic lands in a fair win-rate band
// against 3 generic-ult players.
export const BASE_CASH = {
  default: 240,
  s1_naga_sovereign: 290, s2_kitsune_inari: 240, s2_tsukuyomi_eclipse: 285, s3_sultan_djinn: 240,
  s3_dune_phoenix: 180, s5_atlantis_siren: 390,
  s6_astral_sovereign: 380, s7_cinderella_clock: 395, s8_glacial_elsa: 340,
  s4_casino_royale: 0, s9_pharaoh_ra: 140, s10_phantom_masque: 285, s11_zeus_olympus: 120,
  sm_eclipse_dragon: 40, sm_aurora_empress: 240,
  sm_seraphim_rose: 105, sm_cyber_archon: 0, sm_starlight_ribbon: 200,
};
for (const [id, s] of Object.entries(SEASON_SKILLS)) s.monopoly.baseCash ??= BASE_CASH[id] ?? BASE_CASH.default;

/** Skill for an outfit id (+ its catalog rarity). Never returns null. */
export function skillFor(outfitId, rarity = 1) {
  return SEASON_SKILLS[outfitId] || GENERIC_SKILLS[rarity >= 2 ? 2 : 1];
}
