// client/js/minigames/cloud_dash_ult_skins.js — Custom ULT skins for Cloud Dash outfits (§8)

/**
 * Custom ULT skins for 18 costumes.
 * Each skin: { sprite, palette, trail, banner, tint, sfx, signature, [sovereign], [emoji] }
 * - sprite: asset key (to be placed at client/assets/cloud_dash/<sprite>.png)
 * - palette: [hex, hex, hex] primary, accent, highlight colors
 * - trail: 'sparkle'|'flame'|'bubble'|'snow'|'petal'|'star'|'bolt'|'chip'|'feather'|'data'|'ribbon'
 * - banner: '<emoji> NAME!' text
 * - tint: screen-edge vignette color hex / rgba
 * - sfx: { base: Hz, wave: 'sine'|'triangle'|'sawtooth'|'square' }
 * - signature: short id for one-shot start effect
 */
export const ULT_SKINS = {
  // --- Season 1 ---
  s1_naga_sovereign: {
    sprite: 'ult_naga',
    palette: [0x2ecc71, 0x1abc9c, 0xa3e4d7],
    trail: 'sparkle',
    banner: '🐍 EMERALD WAVE SURF!',
    tint: '#1abc9c',
    sfx: { base: 520, wave: 'sine' },
    signature: 'naga_wave',
    emoji: '🐍',
  },

  // --- Season 2 ---
  s2_kitsune_inari: {
    sprite: 'ult_torii',
    palette: [0xff4757, 0xffa502, 0xffffff],
    trail: 'flame',
    banner: '⛩️ TORII GATE WARP DASH!',
    tint: '#ff4757',
    sfx: { base: 830, wave: 'triangle' },
    signature: 'inari_torii',
    emoji: '⛩️',
  },
  s2_tsukuyomi_eclipse: {
    sprite: 'ult_moon',
    palette: [0x5758bb, 0x833471, 0xed4c67],
    trail: 'sparkle',
    banner: '🌙 LUNAR GRAVITY WELL!',
    tint: '#5758bb',
    sfx: { base: 370, wave: 'sine' },
    signature: 'tsukuyomi_moon',
    emoji: '🌙',
  },

  // --- Season 3 ---
  s3_dune_phoenix: {
    sprite: 'ult_phoenix',
    palette: [0xff4500, 0xff8c00, 0xffd700],
    trail: 'flame',
    banner: '🔥 SOLAR COMET DIVE!',
    tint: '#ff4500',
    sfx: { base: 660, wave: 'sawtooth' },
    signature: 'phoenix_dive',
    emoji: '🔥',
  },
  s3_sultan_djinn: {
    sprite: 'ult_carpet',
    palette: [0x9b59b6, 0xf1c40f, 0x3498db],
    trail: 'sparkle',
    banner: '🧞 MAGIC CARPET ROYAL FLIGHT!',
    tint: '#9b59b6',
    sfx: { base: 494, wave: 'sine' },
    signature: 'djinn_carpet',
    emoji: '🧞',
  },

  // --- Season 4 ---
  s4_casino_royale: {
    sprite: 'ult_777',
    palette: [0xffd700, 0xff3838, 0x2ed573],
    trail: 'chip',
    banner: '🎰 777 HIGH-ROLLER FEVER!',
    tint: '#ffd700',
    sfx: { base: 784, wave: 'square' },
    signature: 'casino_fever',
    emoji: '🎰',
  },

  // --- Season 5 ---
  s5_atlantis_siren: {
    sprite: 'ult_dolphin',
    palette: [0x00cec9, 0x0984e3, 0x81ecec],
    trail: 'bubble',
    banner: '🐬 SIREN DOLPHIN LEAP!',
    tint: '#00cec9',
    sfx: { base: 659, wave: 'sine' },
    signature: 'siren_leap',
    emoji: '🐬',
  },

  // --- Season 6 ---
  s6_astral_sovereign: {
    sprite: 'ult_astral',
    palette: [0x70a1ff, 0x5352ed, 0xff6bcb],
    trail: 'star',
    banner: '🌌 HYPERSPACE STARLIGHT WARP!',
    tint: '#5352ed',
    sfx: { base: 920, wave: 'sawtooth' },
    signature: 'astral_portal',
    emoji: '🌌',
  },

  // --- Season 7 ---
  s7_cinderella_clock: {
    sprite: 'ult_clock',
    palette: [0x74b9ff, 0x0984e3, 0xdfe6e9],
    trail: 'ribbon',
    banner: '⏰ MIDNIGHT CLOCKWORK SLOW-MO!',
    tint: '#74b9ff',
    sfx: { base: 523, wave: 'triangle' },
    signature: 'clock_slow',
    emoji: '⏰',
  },

  // --- Season 8 ---
  s8_glacial_elsa: {
    sprite: 'ult_ice',
    palette: [0xa0e7e5, 0x74b9ff, 0xffffff],
    trail: 'snow',
    banner: '❄️ ABSOLUTE ZERO ICE BRIDGE!',
    tint: '#a0e7e5',
    sfx: { base: 880, wave: 'sine' },
    signature: 'glacial_ice',
    emoji: '❄️',
  },

  // --- Season 9 ---
  s9_pharaoh_ra: {
    sprite: 'ult_ra',
    palette: [0xffd700, 0xffae19, 0xfffacd],
    trail: 'star',
    banner: '☀️ SUN-GOD SOLAR HIGHWAY!',
    tint: '#ffd700',
    sfx: { base: 587, wave: 'triangle' },
    signature: 'ra_sun',
    emoji: '☀️',
  },

  // --- Season 10 ---
  s10_phantom_masque: {
    sprite: 'ult_masque',
    palette: [0x6c5ce7, 0xa29bfe, 0xd63031],
    trail: 'feather',
    banner: '🎭 MASQUERADE ILLUSION!',
    tint: '#6c5ce7',
    sfx: { base: 440, wave: 'triangle' },
    signature: 'masque_illusion',
    emoji: '🎭',
  },

  // --- Season 11 ---
  s11_zeus_olympus: {
    sprite: 'ult_zeus',
    palette: [0x00d2ff, 0x99e5ff, 0xffea00],
    trail: 'bolt',
    banner: '⚡ OLYMPUS THUNDER CHARIOT!',
    tint: '#00d2ff',
    sfx: { base: 740, wave: 'square' },
    signature: 'zeus_bolt',
    emoji: '⚡',
  },

  // --- Super Mythics (sm_*) ---
  sm_eclipse_dragon: {
    sprite: 'ult_eclipse_dragon',
    palette: [0x9b59b6, 0x2c3e50, 0xf1c40f],
    trail: 'flame',
    banner: '👑 ECLIPSE DRAGON SOVEREIGN!',
    tint: '#9b59b6',
    sfx: { base: 554, wave: 'sawtooth' },
    signature: 'sm_dragon',
    sovereign: true,
    emoji: '🐉',
  },
  sm_aurora_empress: {
    sprite: 'ult_aurora',
    palette: [0x00f2fe, 0x4facfe, 0x43e97b],
    trail: 'ribbon',
    banner: '👑 AURORA EMPRESS SOVEREIGN!',
    tint: '#00f2fe',
    sfx: { base: 784, wave: 'sine' },
    signature: 'sm_aurora',
    sovereign: true,
    emoji: '✨',
  },
  sm_seraphim_rose: {
    sprite: 'ult_seraph',
    palette: [0xff758c, 0xff7eb3, 0xffe600],
    trail: 'petal',
    banner: '👑 SERAPHIM ROSE SOVEREIGN!',
    tint: '#ff758c',
    sfx: { base: 880, wave: 'triangle' },
    signature: 'sm_seraph',
    sovereign: true,
    emoji: '🪽',
  },
  sm_cyber_archon: {
    sprite: 'ult_cyber',
    palette: [0x00ffcc, 0xff0055, 0x00a8ff],
    trail: 'data',
    banner: '👑 CYBER ARCHON SOVEREIGN!',
    tint: '#00ffcc',
    sfx: { base: 1046, wave: 'square' },
    signature: 'sm_cyber',
    sovereign: true,
    emoji: '⚡',
  },
  sm_starlight_ribbon: {
    sprite: 'ult_ribbon',
    palette: [0xff9ff3, 0xfeca57, 0x54a0ff],
    trail: 'ribbon',
    banner: '👑 STARLIGHT RIBBON SOVEREIGN!',
    tint: '#ff9ff3',
    sfx: { base: 830, wave: 'sine' },
    signature: 'sm_ribbon',
    sovereign: true,
    emoji: '🎀',
  },
};

/** Default fallback skins per archetype for non-mythic outfits. */
export const DEFAULT_SKIN = {
  surge: {
    sprite: 'pickup_star',
    palette: [0xffaa00, 0xff4400, 0xffee55],
    trail: 'flame',
    banner: '🌈 RAINBOW SURGE!',
    tint: '#ffaa00',
    sfx: { base: 659, wave: 'sawtooth' },
    signature: 'default_surge',
    emoji: '🌈',
  },
  flight: {
    sprite: 'ult_ribbon',
    palette: [0x88ccff, 0xffffff, 0x4488ff],
    trail: 'sparkle',
    banner: '🕊️ SKY FLIGHT!',
    tint: '#88ccff',
    sfx: { base: 587, wave: 'sine' },
    signature: 'default_flight',
    emoji: '🕊️',
  },
  warp: {
    sprite: 'ult_astral',
    palette: [0xcc88ff, 0x8844ff, 0xff88ff],
    trail: 'star',
    banner: '✨ QUANTUM WARP!',
    tint: '#cc88ff',
    sfx: { base: 880, wave: 'triangle' },
    signature: 'default_warp',
    emoji: '🌀',
  },
  clear: {
    sprite: 'pickup_prism',
    palette: [0xffdd44, 0x44ffaa, 0x44ddff],
    trail: 'sparkle',
    banner: '🌟 LANE SWEEP!',
    tint: '#ffdd44',
    sfx: { base: 740, wave: 'square' },
    signature: 'default_clear',
    emoji: '🌟',
  },
  control: {
    sprite: 'ult_moon',
    palette: [0xaa88ff, 0x6644ee, 0x44ccff],
    trail: 'ribbon',
    banner: '🌀 TIME CONTROL!',
    tint: '#aa88ff',
    sfx: { base: 494, wave: 'sine' },
    signature: 'default_control',
    emoji: '⏳',
  },
};

/** Resolve the ULT skin for a given outfit id and archetype. */
export function ultSkinFor(outfitId, arch) {
  if (outfitId && ULT_SKINS[outfitId]) {
    return ULT_SKINS[outfitId];
  }
  const a = arch || 'surge';
  return DEFAULT_SKIN[a] || DEFAULT_SKIN.surge;
}
