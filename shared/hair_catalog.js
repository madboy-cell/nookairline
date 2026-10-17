// shared/hair_catalog.js — Character Foundation v2 hair module (Implementation Plan Section 23).
// Hair is NOT an equipment slot: it lives in profile.appearance = { body, hair, hairColor } (no stats, never forged).
// Each hairstyle is ONE light-grey wig sprite per view (`hair_<id>_front|side|back`), tinted at runtime.
// The rig draws it twice in front/side views (full copy behind the body + copy in front clipped above the neck)
// and once in front of the body in the back view, so no separately aligned front/back layers are needed.
// attach: same contract as accessory_attach.js (offset [x, y] in head-heights from the HEAD pivot, scale = sprite
// WIDTH in head-heights, optional per-view `offsets`) and is calibrated with the dress-up page.

export const HAIR_TIERS = {
  classic:   { name: 'Classic Cut',    price: { gold: 3000 } },
  royal:     { name: 'Royal Hair',     price: { diamonds: 120, ticket: 'ticket_royal_hair' }, pity: 10,  dupeShards: 25 },
  celestial: { name: 'Celestial Hair', price: { diamonds: 120, ticket: 'ticket_royal_hair' }, rate: 0.005, pity: 150, dupeShards: 150 },
};

export const HAIR_DYE_TIERS = {
  starter:   { name: 'Starter Dye',         price: null,              permanent: true },
  basic:     { name: 'Salon Dye',           price: { gold: 500 },     permanent: true },
  ombre:     { name: 'Ombre Glow Dye',      price: { diamonds: 50 },  permanent: true },
  celestial: { name: 'Celestial Prismatic', price: null,              permanent: true, celestialOnly: true },
};

export const DEFAULT_HAIR_ATTACH = { offset: [0, 0.52], scale: 1.40 };

/**
 * 20 Launch Hairstyles: 12 Classic + 6 Royal (Season 1) + 2 Celestial.
 * Hat fit (`hatFit: { lift, grow }`) lifts/scales hat-slot items relative to the reference wig `hair_girl_waves`.
 */
export const HAIRSTYLES = {
  // --- 12 Classic Cuts (3,000 Gold direct pick) ---
  hair_boy_fluffy:      { tier: 'classic', name: 'Fluffy Boy Cut',      starter: 'boy',  attach: { offset: [0.01, 0.69], scale: 1.48, offsets: { side: [-0.05, 0.64], back: [0.00, 0.65] }, scales: { side: 1.50, back: 1.48 } }, hatFit: { lift: 0.04, grow: 1.06 } },
  hair_girl_waves:      { tier: 'classic', name: 'Long Soft Waves',     starter: 'girl', attach: { offset: [0.00, 0.40], scale: 1.44, offsets: { side: [-0.10, 0.50], back: [0.00, 0.50] }, scales: { side: 1.48, back: 1.46 } } },
  hair_bob_blunt:       { tier: 'classic', name: 'Blunt Bob',                            attach: { offset: [0.00, 0.63], scale: 1.48, offsets: { side: [-0.06, 0.60], back: [0.00, 0.60] }, scales: { side: 1.44, back: 1.46 } }, hatFit: { lift: 0.02, grow: 1.04 } },
  hair_spiky_hero:      { tier: 'classic', name: 'Spiky Hero Crop',                      attach: { offset: [0.01, 0.71], scale: 1.48, offsets: { side: [-0.06, 0.66], back: [0.00, 0.66] }, scales: { side: 1.62, back: 1.60 } }, hatFit: { lift: 0.05, grow: 1.06 } },
  hair_parted_curtains: { tier: 'classic', name: 'Parted Prince Cut',                    attach: { offset: [0.01, 0.66], scale: 1.53, offsets: { side: [-0.07, 0.61], back: [0.00, 0.62] }, scales: { side: 1.50, back: 1.50 } }, hatFit: { lift: 0.03, grow: 1.04 } },
  hair_wolf_shag:       { tier: 'classic', name: 'Layered Wolf Cut',                     attach: { offset: [0.01, 0.66], scale: 1.50, offsets: { side: [-0.07, 0.58], back: [0.00, 0.58] }, scales: { side: 1.54, back: 1.54 } }, hatFit: { lift: 0.04, grow: 1.06 } },
  hair_high_ponytail:   { tier: 'classic', name: 'Bouncy High Ponytail',                 attach: { offset: [0.02, 0.64], scale: 1.52, offsets: { side: [-0.13, 0.62], back: [0.04, 0.59] }, scales: { side: 1.74, back: 1.58 } }, hatFit: { lift: 0.04, grow: 1.05 } },
  hair_twin_tails:      { tier: 'classic', name: 'Classic Twin Tails',                   attach: { offset: [0.01, 0.56], scale: 1.56, offsets: { side: [-0.09, 0.54], back: [0.00, 0.53] }, scales: { side: 1.54, back: 1.78 } }, hatFit: { lift: 0.02, grow: 1.05 } },
  hair_double_buns:     { tier: 'classic', name: 'Space Odango Buns',                    attach: { offset: [0.01, 0.66], scale: 1.52, offsets: { side: [-0.10, 0.63], back: [0.00, 0.63] }, scales: { side: 1.56, back: 1.66 } }, hatFit: { lift: 0.04, grow: 1.06 } },
  hair_hime_straight:   { tier: 'classic', name: 'Silky Hime Straight',                  attach: { offset: [0.01, 0.46], scale: 1.50, offsets: { side: [-0.08, 0.48], back: [0.00, 0.49] }, scales: { side: 1.44, back: 1.46 } }, hatFit: { lift: 0.02, grow: 1.03 } },
  hair_braided_crown:   { tier: 'classic', name: 'Cottage Twin Braids',                  attach: { offset: [0.01, 0.48], scale: 1.50, offsets: { side: [-0.05, 0.48], back: [0.00, 0.49] }, scales: { side: 1.46, back: 1.52 } }, hatFit: { lift: 0.02, grow: 1.03 } },
  hair_half_up_bun:     { tier: 'classic', name: 'Half-Up Topknot',                      attach: { offset: [0.01, 0.56], scale: 1.50, offsets: { side: [-0.10, 0.56], back: [0.00, 0.56] }, scales: { side: 1.52, back: 1.48 } }, hatFit: { lift: 0.04, grow: 1.04 } },

  // --- 6 Royal Hairs (120 Diamonds / 1 Coupon Gacha, featured guaranteed by pull 10) ---
  hair_royal_drill_ribbons: { tier: 'royal', name: 'Velvet Ribbon Drills',     shimmer: 0.25, attach: { offset: [0.01, 0.48], scale: 1.60, offsets: { side: [-0.10, 0.60], back: [0.00, 0.57] }, scales: { side: 1.60, back: 1.76 } }, hatFit: { lift: 0.03, grow: 1.06 } },
  hair_royal_sakura_braid:  { tier: 'royal', name: 'Sakura Blossom Braid',     shimmer: 0.25, attach: { offset: [0.01, 0.46], scale: 1.52, offsets: { side: [-0.07, 0.47], back: [-0.01, 0.47] }, scales: { side: 1.42, back: 1.46 } }, hatFit: { lift: 0.02, grow: 1.05 } },
  hair_royal_starlight_bob: { tier: 'royal', name: 'Starlight Idol Bob',       shimmer: 0.30, attach: { offset: [0.01, 0.62], scale: 1.52, offsets: { side: [-0.06, 0.61], back: [0.00, 0.62] }, scales: { side: 1.44, back: 1.52 } }, hatFit: { lift: 0.03, grow: 1.05 } },
  hair_royal_prince_feather:{ tier: 'royal', name: 'Sovereign Feather Swept',  shimmer: 0.25, attach: { offset: [0.00, 0.63], scale: 1.50, offsets: { side: [-0.08, 0.60], back: [0.01, 0.62] }, scales: { side: 1.52, back: 1.54 } }, hatFit: { lift: 0.04, grow: 1.05 } },
  hair_royal_butterfly_updo:{ tier: 'royal', name: 'Crystal Butterfly Updo',   shimmer: 0.30, attach: { offset: [0.01, 0.49], scale: 1.54, offsets: { side: [-0.10, 0.48], back: [0.00, 0.48] }, scales: { side: 1.50, back: 1.48 } }, hatFit: { lift: 0.04, grow: 1.05 } },
  hair_royal_moon_ponytail: { tier: 'royal', name: 'Crescent Silk Ponytail',   shimmer: 0.30, attach: { offset: [0.02, 0.62], scale: 1.54, offsets: { side: [-0.12, 0.62], back: [0.04, 0.60] }, scales: { side: 1.68, back: 1.60 } }, hatFit: { lift: 0.04, grow: 1.06 } },

  // --- 2 Celestial Hairs (0.5% ultra-rare slot, 150-pull separate hard pity, animated prismatic aura) ---
  hair_celestial_seraph:  { tier: 'celestial', name: 'Astral Sovereign Cut',      defaultColor: 'celestial_astral',     shimmer: 1.0, attach: { offset: [0.01, 0.72], scale: 1.54, offsets: { side: [-0.06, 0.65], back: [0.00, 0.65] }, scales: { side: 1.56, back: 1.56 } }, hatFit: { lift: 0.05, grow: 1.06 } },
  hair_celestial_empress: { tier: 'celestial', name: 'Solar-Lunar Sovereign',     defaultColor: 'celestial_solarlunar', shimmer: 1.0, attach: { offset: [0.01, 0.58], scale: 2.08, offsets: { side: [-0.12, 0.52], back: [0.00, 0.53] }, scales: { side: 1.54, back: 1.82 } }, hatFit: { lift: 0.03, grow: 1.05 } },
};

/** 4 free colours offered at sign-up (everyone visits Fluffé's Hair Studio for more). */
export const STARTER_HAIR_COLORS = {
  chestnut: '#8a5a3c',
  midnight: '#3a3550',
  honey:    '#e8b86a',
  silver:   '#d9dbe6',
};

/**
 * Full Hair Dye Closet: 4 Starter (free) + 8 Basic (500 Gold, permanent) + 6 Ombre (50 Diamonds, permanent)
 * + 2 Celestial Prismatic (bundled & permanently unlocked with Celestial Hairs).
 */
export const HAIR_COLORS = {
  // 4 Free Starter Dyes
  chestnut: { name: 'Chestnut Brown', tier: 'starter', hex: '#8a5a3c' },
  midnight: { name: 'Midnight Ink',   tier: 'starter', hex: '#3a3550' },
  honey:    { name: 'Honey Blonde',   tier: 'starter', hex: '#e8b86a' },
  silver:   { name: 'Moonlit Silver', tier: 'starter', hex: '#d9dbe6' },

  // 8 Basic Salon Dyes (500 Gold — permanent unlock)
  sakura:   { name: 'Sakura Pink',    tier: 'basic', hex: '#f4a6b8' },
  coral:    { name: 'Peach Coral',    tier: 'basic', hex: '#f29b7e' },
  lavender: { name: 'Lavender Mist',  tier: 'basic', hex: '#b8a4e8' },
  mint:     { name: 'Mint Cream',     tier: 'basic', hex: '#9ddbc5' },
  azure:    { name: 'Sky Azure',      tier: 'basic', hex: '#8ec5f2' },
  crimson:  { name: 'Crimson Berry',  tier: 'basic', hex: '#b83b52' },
  ginger:   { name: 'Copper Ginger',  tier: 'basic', hex: '#d46a3e' },
  snow:     { name: 'Pure Snow',      tier: 'basic', hex: '#f5f7ff' },

  // 6 Ombre / Glow Dyes (50 Diamonds — permanent unlock, two-tone gradient + shimmer)
  ombre_sunset:    { name: 'Sakura Sunset',   tier: 'ombre', hex: '#f69eb4', hex2: '#ffd478', shimmer: 0.35 },
  ombre_mermaid:   { name: 'Mermaid Lagoon',  tier: 'ombre', hex: '#6ad9d2', hex2: '#9b7ef2', shimmer: 0.35 },
  ombre_nebula:    { name: 'Twilight Nebula', tier: 'ombre', hex: '#483d82', hex2: '#f082b4', shimmer: 0.35 },
  ombre_matcha:    { name: 'Matcha Cream',    tier: 'ombre', hex: '#82c49b', hex2: '#fff4d8', shimmer: 0.30 },
  ombre_bloodmoon: { name: 'Blood Moon',      tier: 'ombre', hex: '#2e2438', hex2: '#d63854', shimmer: 0.40 },
  ombre_aurora:    { name: 'Aurora Borealis', tier: 'ombre', hex: '#8ce6c8', hex2: '#c99ef5', shimmer: 0.40 },

  // 2 Celestial Prismatic Dyes (included with Celestial Hairs — multi-stop animated aurora + starlight glints)
  celestial_astral:     { name: 'Astral Nebula Prismatic',    tier: 'celestial', hex: '#b8d0ff', hex2: '#f0b0ff', hex3: '#84f5e8', celestialMode: 1, shimmer: 1.0 },
  celestial_solarlunar: { name: 'Solar-Lunar Sovereign Glow', tier: 'celestial', hex: '#ffe89e', hex2: '#ffb8e6', hex3: '#a8dcff', celestialMode: 2, shimmer: 1.0 },
};

/**
 * Resolve a dye key (`'ombre_sunset'`, `'celestial_astral'`, `'chestnut'`) or raw hex (`'#8a5a3c'`) into shader uniforms.
 * If a Celestial hair is equipped with no explicit override (or `'default'`), uses its signature Celestial Prismatic dye.
 */
export const resolveHairColor = (colorOrId, hairId = null) => {
  const hDef = hairId ? HAIRSTYLES[hairId] : null;
  const key = (!colorOrId || colorOrId === 'default') && hDef?.defaultColor ? hDef.defaultColor : colorOrId;
  const entry = HAIR_COLORS[key] || Object.values(HAIR_COLORS).find((c) => c.hex.toLowerCase() === String(key || '').toLowerCase());
  const baseShimmer = hDef?.shimmer || 0;
  if (entry) {
    return {
      id: key,
      hex: entry.hex,
      hex2: entry.hex2 || entry.hex,
      hex3: entry.hex3 || entry.hex2 || entry.hex,
      shimmer: Math.max(baseShimmer, entry.shimmer || 0),
      celestialMode: entry.celestialMode || (hDef?.tier === 'celestial' ? 1 : 0),
    };
  }
  const hex = typeof key === 'string' && key.startsWith('#') ? key : ( typeof key === 'string' && /^[0-9a-fA-F]{6}$/.test(key) ? `#${key}` : '#8a5a3c' );
  return {
    id: hex,
    hex,
    hex2: hex,
    hex3: hex,
    shimmer: baseShimmer,
    celestialMode: hDef?.tier === 'celestial' ? 1 : 0,
  };
};

/**
 * Headwear fit: every hat-slot item (hats, ears, horns) is calibrated on the reference wig `hair_girl_waves`.
 * Bulkier wigs declare `hatFit: { lift, grow }` (lift in head-heights, grow = width multiplier, optional per-view
 * `views: { side: {...} }`) so all headwear sits on top of the hair volume without per-hair recalibration.
 */
export const hairHatFit = (id, view) => {
  const f = HAIRSTYLES[id]?.hatFit;
  const fv = { lift: 0, grow: 1, ...(f || {}), ...(f?.views?.[view] || {}) };
  return { lift: fv.lift, grow: fv.grow };
};

export const hairSpriteName = (id, view) => `${id}_${view === 'lifted' ? 'front' : view}`;
export const hairAttach = (id) => ({ ...DEFAULT_HAIR_ATTACH, ...(HAIRSTYLES[id]?.attach || {}) });
export const starterHairFor = (body) => Object.keys(HAIRSTYLES).find((k) => HAIRSTYLES[k].starter === body) || 'hair_bob_blunt';
