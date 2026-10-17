// shared/season_skills.js — 100% data-driven Mythic ultimates (Implementation Plan §5 "11 Seasons" table +
// "Lego-Block SkillEngine"). The engine NEVER checks costume names: adding Season 12 = adding one entry here.
//
// `affinity` = the ONE home-turf theme of this costume (spirit · desert · ocean · fortune · frost · celestial,
// see THEMES in shared/monopoly_rules.js): +15% rent & −15% upgrade cost on that zone. New seasons pick one.
// Only the `monopoly` block is consumed in Step 4; Moon Bunny / Cloud Dash blocks arrive in Phase 6.
//
// Action primitives (executed by shared/skill_engine.js):
//   APPLY_PLAYER_STATUS { target, status }                 → player.status slot (overwrites older hex)
//   PLACE_TILE_MODIFIER { target, count, offset, radius, modifier } → tile.modifier slot (overwrites)
//   MOVE_PLAYERS        { target, pullTowardCaster | steps }  → forced move, resolves rent only (max 1 hop)
//   MODIFY_PROPERTY     { target, level, bounty }          → ±level on a tile (Tier 4 immune)
//   TRANSFER_CASH       { from, amount | pct }             → rivals pay the caster
//   GAIN_CASH           { amount }                         → bank pays the caster
//   SET_TILE_TIER       { target, tier }                   → e.g. Tier-4 Golden Pyramid
//   CLEAR_MODIFIERS     { target: 'caster_side' }          → wipes rival traps / shields on one board side
//   STEAL_PROPERTY      { target, maxTier }                → richest rival's cheapest Tier ≤ maxTier tile
//   SWAP_PROPERTY       { target, maxTier }                → my cheapest ↔ rival's best Tier ≤ maxTier
//   GRANT               { shields, revive, coupons }       → caster inventory
// Control blocks: CHOICE { options:[{id,label,actions}] } (player picks), ROLL_TABLE { outcomes:[{w,id,actions}] },
//   WARP_PICK (player picks any tile to fly to), IF_UNDERDOG { actions }.
// Player targets: self · all_rivals · richest_rival
// Tile targets: my_tiles · my_best · rival_best · around_caster · behind_caster · ahead_of_rivals · before_my_best

const T = (n) => n; // readability: turnsLeft counts the affected player's turns (status) or full rounds (tiles)

export const SEASON_SKILLS = {
  s1_naga_sovereign: {
    affinity: 'ocean', name: 'Downstream Current Push', icon: '🌊', fxTheme: 'naga_wave', vfx: 'wave',
    desc: '+310 🪙 & places 2 Waterway currents before your best property (pushes rivals +2 tiles onto it for 4 rounds).',
    monopoly: {
      onUltimate: [{ action: 'PLACE_TILE_MODIFIER', target: 'before_my_best', count: 2, offset: 2, modifier: { pushSteps: 2, turnsLeft: T(4), fxTheme: 'waterway' } }],
      fallback: [{ action: 'GAIN_CASH', amount: 300 }],
    },
  },
  s2_kitsune_inari: {
    affinity: 'spirit', name: 'Torii Shrine Kidnap', icon: '⛩️', fxTheme: 'foxfire', vfx: 'crystal',
    desc: '+250 🪙 & places 2 Torii Shrine gates ahead of rivals that warp them straight onto your best property.',
    monopoly: {
      onUltimate: [{ action: 'PLACE_TILE_MODIFIER', target: 'ahead_of_rivals', count: 2, offset: 4, modifier: { warpToOwnerBest: true, oneShot: true, turnsLeft: T(4), fxTheme: 'torii' } }],
      requiresOwnedTile: true,
      fallback: [{ action: 'GAIN_CASH', amount: 300 }],
    },
  },
  s2_tsukuyomi_eclipse: {
    affinity: 'spirit', name: 'Eclipse Sleepwalk', icon: '🌙', fxTheme: 'eclipse', vfx: 'vortex',
    desc: '+300 🪙 & curses all rivals with Eclipse Sleepwalk (forces a fixed 3-step dice roll on their next turn).',
    monopoly: { onUltimate: [{ action: 'APPLY_PLAYER_STATUS', target: 'all_rivals', status: { fixedRoll: 3, turnsLeft: T(1), fxTheme: 'sleepwalk' } }] },
  },
  s3_sultan_djinn: {
    affinity: 'desert', name: '3 Cosmic Wishes', icon: '🪔', fxTheme: 'djinn', vfx: 'vortex',
    desc: '+300 🪙 & grants 1 of 3 Wishes: 2× Midas Gold Rent (3 rounds), Oasis Property Swap, or Magic Carpet Flight.',
    monopoly: {
      onUltimate: [{
        action: 'CHOICE',
        options: [
          { id: 'midas', label: '🪙 Midas 24k Gold Tile (2× rent)', actions: [{ action: 'PLACE_TILE_MODIFIER', target: 'my_best', count: 1, modifier: { rentMult: 2, turnsLeft: T(3), fxTheme: 'midas' } }], fallback: [{ action: 'GAIN_CASH', amount: 300 }] },
          { id: 'swap', label: '🏝️ Oasis Property Swap', actions: [{ action: 'SWAP_PROPERTY', target: 'richest_rival', maxTier: 2 }], fallback: [{ action: 'GAIN_CASH', amount: 300 }] },
          { id: 'carpet', label: '🧞 Magic Carpet Flight', actions: [{ action: 'WARP_PICK' }] },
        ],
      }],
    },
  },
  s3_dune_phoenix: {
    affinity: 'desert', name: 'Scorched Footprints & Rebirth', icon: '🔥', fxTheme: 'phoenix', vfx: 'projectile',
    desc: '+250 🪙, scorches 3 tiles behind you (40 🪙 burn siphon for 4 rounds), +1 Phoenix Revive & 50% Underdog discount.',
    monopoly: {
      onUltimate: [
        { action: 'PLACE_TILE_MODIFIER', target: 'behind_caster', count: 3, modifier: { burnSiphon: 40, turnsLeft: T(4), fxTheme: 'fire' } },
        { action: 'IF_UNDERDOG', actions: [{ action: 'APPLY_PLAYER_STATUS', target: 'self', status: { discountPct: 0.5, turnsLeft: T(2), fxTheme: 'underdog' } }] },
        { action: 'GRANT', revive: 1, maxRevive: 1 },
      ],
    },
  },
  s4_casino_royale: {
    affinity: 'fortune', name: 'Roulette Spin & Pass-GO Heist', icon: '🎡', fxTheme: 'roulette', vfx: 'roulette',
    desc: 'Spins the Golden Roulette (Steal Property / 2× Chip Rent on 3 tiles / 150 🪙 from all rivals) + 30% Salary Heist.',
    monopoly: {
      onUltimate: [
        {
          action: 'ROLL_TABLE',
          outcomes: [
            { w: 18, id: 'red', label: '🔴 RED — Steal 1 Property', actions: [{ action: 'STEAL_PROPERTY', target: 'richest_rival', maxTier: 0 }], fallback: [{ action: 'GAIN_CASH', amount: 300 }] },
            { w: 18, id: 'black', label: '⚫ BLACK — 2× Rent', actions: [{ action: 'PLACE_TILE_MODIFIER', target: 'my_tiles', count: 3, modifier: { rentMult: 2, turnsLeft: T(2), fxTheme: 'chips' } }], fallback: [{ action: 'GAIN_CASH', amount: 300 }] },
            { w: 2, id: 'green', label: '🟢 00 — 150 🪙 from everyone', actions: [{ action: 'TRANSFER_CASH', from: 'all_rivals', amount: 150 }] },
          ],
        },
        { action: 'APPLY_PLAYER_STATUS', target: 'self', status: { lapTax: 0.3, turnsLeft: T(1), fxTheme: 'heist' } },
      ],
    },
  },
  s5_atlantis_siren: {
    affinity: 'ocean', name: 'Abyssal Flood', icon: '🌀', fxTheme: 'abyss', vfx: 'wave',
    desc: '+300 🪙, blesses your nearby tiles with 1.6× Coral Rent (3 rounds) & floods rival tiles to 0× Rent (2 rounds).',
    monopoly: {
      onUltimate: [
        { action: 'PLACE_TILE_MODIFIER', target: 'around_caster', radius: 3, ownedBy: 'self', modifier: { rentMult: 1.6, turnsLeft: T(3), fxTheme: 'coral' } },
        { action: 'PLACE_TILE_MODIFIER', target: 'around_caster', radius: 3, ownedBy: 'rivals', modifier: { rentMult: 0, turnsLeft: T(2), fxTheme: 'ruins' } },
      ],
      fallback: [{ action: 'GAIN_CASH', amount: 300 }],
    },
  },
  s6_astral_sovereign: {
    affinity: 'celestial', name: 'Black Hole Gravity Pull', icon: '🌌', fxTheme: 'supernova', vfx: 'vortex',
    desc: '+280 🪙, buffs your best property to 1.5× Supernova Rent (2 rounds) & pulls all rivals 2 steps toward you.',
    monopoly: {
      onUltimate: [
        { action: 'PLACE_TILE_MODIFIER', target: 'my_best', count: 1, modifier: { rentMult: 1.5, turnsLeft: T(2), fxTheme: 'supernova' } },
        { action: 'MOVE_PLAYERS', target: 'all_rivals', pullTowardCaster: 2 },
      ],
    },
  },
  s7_cinderella_clock: {
    affinity: 'frost', name: 'Reverse Moving', icon: '🕰️', fxTheme: 'midnight', vfx: 'roulette',
    desc: '+280 🪙, rewinds all rivals to walk backwards next turn & places a Glass Slipper prison trap ahead of the richest rival.',
    monopoly: {
      onUltimate: [
        { action: 'APPLY_PLAYER_STATUS', target: 'all_rivals', status: { moveDir: -1, turnsLeft: T(1), fxTheme: 'rewind' } },
        { action: 'PLACE_TILE_MODIFIER', target: 'ahead_of_rivals', count: 1, offset: -3, rival: 'richest_rival', modifier: { prison: true, oneShot: true, turnsLeft: T(3), fxTheme: 'slipper' } },
      ],
    },
  },
  s8_glacial_elsa: {
    affinity: 'frost', name: 'Ice Freeze & Permafrost', icon: '❄️', fxTheme: 'glacial', vfx: 'crystal',
    desc: '+280 🪙, freezes the richest rival (skips turn), freezes 2 rival properties to 0× rent & buffs your best tile to 1.4× rent.',
    monopoly: {
      onUltimate: [
        { action: 'APPLY_PLAYER_STATUS', target: 'richest_rival', status: { skipTurn: true, turnsLeft: T(1), fxTheme: 'ice_cube' } },
        { action: 'PLACE_TILE_MODIFIER', target: 'rival_best', count: 2, modifier: { rentMult: 0, turnsLeft: T(2), fxTheme: 'ice_cube' } },
        { action: 'PLACE_TILE_MODIFIER', target: 'my_best', count: 1, modifier: { rentMult: 1.4, turnsLeft: T(2), fxTheme: 'glacial' } },
      ],
    },
  },
  s9_pharaoh_ra: {
    affinity: 'desert', name: 'Golden Pyramid & Row Laser', icon: '📐', fxTheme: 'solar', vfx: 'pillar',
    desc: 'Ascends your best property toward a Tier-4 Golden Pyramid (4.5× rent) & fires a Solar Laser wiping rival traps on your row.',
    monopoly: {
      onUltimate: [
        { action: 'SET_TILE_TIER', target: 'my_best', tier: 4, step: 1 },
        { action: 'CLEAR_MODIFIERS', target: 'caster_side' },
      ],
      fallback: [{ action: 'GAIN_CASH', amount: 300 }],
    },
  },
  s10_phantom_masque: {
    affinity: 'fortune', name: 'Reverse Trap (Gilded Mirror)', icon: '🎭', fxTheme: 'masque', vfx: 'crystal',
    desc: '+210 🪙 & places 2 Gilded Mirror traps on the richest rival’s best tiles (reverses rent so the owner pays you!).',
    monopoly: {
      onUltimate: [{ action: 'PLACE_TILE_MODIFIER', target: 'rival_best', count: 2, modifier: { reverseTrap: true, turnsLeft: T(3), fxTheme: 'mirror' } }],
      fallback: [{ action: 'GAIN_CASH', amount: 300 }],
    },
  },
  s11_zeus_olympus: {
    affinity: 'celestial', name: 'Olympus Thunderbolt Demolition', icon: '⚡', fxTheme: 'zeus', vfx: 'pillar',
    desc: '+120 🪙, strikes the richest rival’s best property (−1 Tier + 150 🪙 bounty) & charges your best tile to 1.5× rent (3 rounds).',
    monopoly: {
      onUltimate: [
        { action: 'MODIFY_PROPERTY', target: 'richest_rival_best', level: -1, bounty: 150 },
        { action: 'PLACE_TILE_MODIFIER', target: 'my_best', count: 1, modifier: { rentMult: 1.5, turnsLeft: T(3), fxTheme: 'lightning_rod' } },
      ],
    },
  },
  // ✦ Super Mythic "Twin Eclipse" set (Dopamine Patch §1A). Power-equal to a ★3 Mythic (same baseCash band,
  // existing primitives only, same balance gate in tests/monopoly.test.js); `vfx` keys are the existing board
  // cut-ins, `superVfx` names the extra spectacle layer (board dim + sun-ring / aurora wash) and `monument`
  // the centerpiece sprite (client/assets/monopoly/mono_ult_sm_*.png, manifest_4a.json).
  sm_eclipse_dragon: {
    affinity: 'celestial', name: 'Eclipse Domain', icon: '☀️', fxTheme: 'eclipse_domain', vfx: 'pillar',
    superMythic: true, superVfx: 'eclipse_domain', monument: 'mono_ult_sm_eclipse',
    desc: '+280 🪙, the board dims as a sun-ring sweeps your side (wipes rival traps there) & crowns your best tile with 1.5× Eclipse Rent (2 rounds).',
    monopoly: {
      baseCash: 280,
      onUltimate: [
        { action: 'CLEAR_MODIFIERS', target: 'caster_side' },
        { action: 'PLACE_TILE_MODIFIER', target: 'my_best', count: 1, modifier: { rentMult: 1.5, turnsLeft: T(2), fxTheme: 'supernova' } },
      ],
    },
  },
  sm_aurora_empress: {
    affinity: 'celestial', name: 'Aurora Veil', icon: '🌙', fxTheme: 'aurora_veil', vfx: 'wave',
    superMythic: true, superVfx: 'aurora_veil', monument: 'mono_ult_sm_aurora',
    desc: '+280 🪙, an aurora wave washes over your nearby tiles (1.4× Aurora Rent, 2 rounds) & veils you with +1 Barrier Shield.',
    monopoly: {
      baseCash: 280,
      onUltimate: [
        { action: 'PLACE_TILE_MODIFIER', target: 'around_caster', radius: 3, ownedBy: 'self', modifier: { rentMult: 1.4, turnsLeft: T(2), fxTheme: 'coral' } },
        { action: 'GRANT', shields: 1 },
      ],
      fallback: [{ action: 'GAIN_CASH', amount: 150 }],
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
// against 3 generic-ult players (a pure hex on 1 of 3 rivals is a weak edge in a 4-player free-for-all).
export const BASE_CASH = {
  default: 250,
  s1_naga_sovereign: 310, s2_tsukuyomi_eclipse: 300, s3_sultan_djinn: 300, s5_atlantis_siren: 300,
  s6_astral_sovereign: 280, s7_cinderella_clock: 280, s8_glacial_elsa: 280,
  s4_casino_royale: 0, s9_pharaoh_ra: 0, s10_phantom_masque: 210, s11_zeus_olympus: 120,
};
for (const [id, s] of Object.entries(SEASON_SKILLS)) s.monopoly.baseCash ??= BASE_CASH[id] ?? BASE_CASH.default;

/** Skill for an outfit id (+ its catalog rarity). Never returns null. */
export function skillFor(outfitId, rarity = 1) {
  return SEASON_SKILLS[outfitId] || GENERIC_SKILLS[rarity >= 2 ? 2 : 1];
}
