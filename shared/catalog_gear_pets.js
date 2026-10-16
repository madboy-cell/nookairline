// shared/catalog_gear_pets.js — canonical accessories + pets (Implementation Plan Section 21.D).
// Shared by server (authoritative math) and client (rendering / tooltips).

export const RARITY = { RARE: 1, EPIC: 2, MYTHIC: 3 };

// 15 unisex accessories: 3 per slot (★1 Rare / ★2 Epic / ★3 Mythic)
export const ACCESSORIES = {
  hat_straw_explorer:      { slot: 'hat',    rarity: 1, name: 'Straw Explorer Hat',            stats: { power: 8, luck: 6 } },
  hat_cat_headset:         { slot: 'hat',    rarity: 2, name: 'Pink Cat-Ear Headset',          stats: { power: 15, luck: 12 } },
  hat_glowing_bunny:       { slot: 'hat',    rarity: 3, name: 'Glowing Starlight Bunny Ears',  stats: { power: 25, luck: 22 }, fx: 'star' },
  face_rosegold_shades:    { slot: 'face',   rarity: 1, name: 'Rose-Gold Heart Shades',        stats: { luck: 8, fortune: 6 } },
  face_cyber_visor:        { slot: 'face',   rarity: 2, name: 'Cyber Holo-Visor',              stats: { luck: 15, fortune: 12 } },
  face_oracle_monocle:     { slot: 'face',   rarity: 3, name: 'Oracle Starlight Monocle',      stats: { luck: 25, fortune: 22 }, fx: 'rune' },
  gloves_cat_mittens:      { slot: 'gloves', rarity: 1, name: 'Fluffy Cat-Paw Mittens',        stats: { power: 8, fortune: 6 } },
  gloves_vorax_cyan:       { slot: 'gloves', rarity: 2, name: 'Vorax Cyan Neon Gauntlets',     stats: { power: 16, fortune: 12 } },
  gloves_starlight_wand:   { slot: 'gloves', rarity: 3, name: 'Midas Starlight Scepter',       stats: { power: 26, fortune: 22 }, fx: 'lightning' },
  boots_slime_rain:        { slot: 'boots',  rarity: 1, name: 'Green Slime Rainboots',         stats: { swiftness: 9, luck: 5 } },
  boots_hermes_greaves:    { slot: 'boots',  rarity: 2, name: 'Hermes Winged Greaves',         stats: { swiftness: 18, luck: 10 }, fx: 'feather' },
  boots_astral_striders:   { slot: 'boots',  rarity: 3, name: 'Astral Warp Striders',          stats: { swiftness: 28, luck: 18 }, fx: 'sigil' },
  wings_pastel_angel:      { slot: 'wings',  rarity: 1, name: 'Pastel Angel Wings',            stats: { all: 5 } },
  wings_crystal_butterfly: { slot: 'wings',  rarity: 2, name: 'Crystal Butterfly Wings',       stats: { all: 10 } },
  wings_golden_seraphim:   { slot: 'wings',  rarity: 3, name: 'Golden Seraphim 6-Wings',       stats: { all: 18 }, fx: 'feather_gold' },
  hat_wolf_ears:           { slot: 'hat',    rarity: 1, name: 'Silver Wolf Ears',              stats: { power: 5, luck: 5 },    starterCosmetic: true },
  hat_dragon_horns:        { slot: 'hat',    rarity: 1, name: 'Coral Dragon Horns',            stats: { charm: 5, luck: 5 },    starterCosmetic: true },
  back_wolf_tail:          { slot: 'wings',  rarity: 1, name: 'Fluffy Wolf Tail',              stats: { swiftness: 5, luck: 5 }, starterCosmetic: true },
  back_dragon_tail:        { slot: 'wings',  rarity: 1, name: 'Scaled Dragon Tail',            stats: { charm: 5, fortune: 5 }, starterCosmetic: true },
};

// 9 Collectible 3D Dice Skins for 2.5D Sky Monopoly & Grand Casino (3 per rarity tier: ★1 Rare / ★2 Epic / ★3 Mythic)
export const DICE_SKINS = {
  dice_classic_ivory:   { slot: 'dice', rarity: 1, name: 'Royal Ivory Star Dice',         stats: { luck: 6, fortune: 6 },       boardBonus: { salaryPct: 0.03 },                      color: '#f5ebd6', pipColor: '#e0a42a' },
  dice_pastel_boba:     { slot: 'dice', rarity: 1, name: 'Pastel Boba Pearl Dice',        stats: { fortune: 8, swiftness: 4 },  boardBonus: { salaryPct: 0.04 },                      color: '#e6a58e', pipColor: '#3a2415' },
  dice_emerald_naga:    { slot: 'dice', rarity: 1, name: 'Sacred Naga Jade Dice',         stats: { swiftness: 8, luck: 4 },     boardBonus: { rentPct: 0.03 },                        color: '#2bb388', pipColor: '#98f5e1' },
  dice_kitsune_foxfire: { slot: 'dice', rarity: 2, name: 'Kitsune Shrine Foxfire Dice',   stats: { luck: 14, power: 12 },       boardBonus: { rentPct: 0.05, salaryPct: 0.04 },       color: '#d94136', pipColor: '#5bc0ff', fx: 'flame' },
  dice_mirage_sultan:   { slot: 'dice', rarity: 2, name: 'Mirage Sultan Ruby Dice',       stats: { fortune: 16, luck: 10 },     boardBonus: { startCashPct: 0.05, discountPct: 0.04 }, color: '#7b42b8', pipColor: '#e83a68', fx: 'star' },
  dice_atlantis_pearl:  { slot: 'dice', rarity: 2, name: 'Atlantis Siren Pearl Dice',     stats: { swiftness: 15, fortune: 11 },boardBonus: { salaryPct: 0.06, rentPct: 0.04 },       color: '#7ce0d3', pipColor: '#fff5fa', fx: 'bubble' },
  dice_glacial_crystal: { slot: 'dice', rarity: 3, name: 'Glacial Empress Frost Dice',    stats: { luck: 24, fortune: 20 },     boardBonus: { rentPct: 0.08, discountPct: 0.06 },     color: '#88d8ff', pipColor: '#ffffff', fx: 'snowflake' },
  dice_astral_galaxy:   { slot: 'dice', rarity: 3, name: 'Astral Supernova Galaxy Dice',  stats: { power: 24, swiftness: 20 },  boardBonus: { ultPct: 0.10, salaryPct: 0.08 },        color: '#2b2368', pipColor: '#5ef2ff', fx: 'sigil' },
  dice_zeus_thunder:    { slot: 'dice', rarity: 3, name: 'Zeus 24k Olympus Lightning Dice', stats: { all: 16 },                 boardBonus: { startCashPct: 0.08, rentPct: 0.08, salaryPct: 0.08 }, color: '#e8b938', pipColor: '#4be8ff', fx: 'lightning' },
};
export const DICE_IDS = Object.keys(DICE_SKINS);

export {
  PET_FAMILIES,
  PETS,
  PET_IDS,
  PET_POSES,
  PET_EMOTES,
  STARTER_PET,
  LEGACY_PET_MAP,
  LEGACY_PET_RARITY,
  normalizePetId,
  getPetDef,
  petLocomotion,
  resolvePetSpriteKey,
  resolvePetEmoteKey,
} from './pet_catalog.js';


