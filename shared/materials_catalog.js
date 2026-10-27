// shared/materials_catalog.js — Sky Frontier materials & food catalog.
// Pure module, zero I/O.

export const MATERIALS = Object.freeze({
  // Raw materials (stack: 999)
  wood: Object.freeze({ id: 'wood', name: 'Wood', emoji: '🪵', tier: 'raw', stack: 999 }),
  stone: Object.freeze({ id: 'stone', name: 'Stone', emoji: '🪨', tier: 'raw', stack: 999 }),
  crystal_ore: Object.freeze({ id: 'crystal_ore', name: 'Crystal Ore', emoji: '💎', tier: 'raw', stack: 999 }),
  sky_wheat: Object.freeze({ id: 'sky_wheat', name: 'Sky Wheat', emoji: '🌾', tier: 'raw', stack: 999 }),
  herb_seed: Object.freeze({ id: 'herb_seed', name: 'Herb Seed', emoji: '🌱', tier: 'raw', stack: 999 }),
  honey: Object.freeze({ id: 'honey', name: 'Honey', emoji: '🍯', tier: 'raw', stack: 999 }),
  fish: Object.freeze({ id: 'fish', name: 'Fish', emoji: '🐟', tier: 'raw', stack: 999 }),
  feather: Object.freeze({ id: 'feather', name: 'Feather', emoji: '🪶', tier: 'raw', stack: 999 }),
  cloud_silk: Object.freeze({ id: 'cloud_silk', name: 'Cloud Silk', emoji: '🕸️', tier: 'raw', stack: 999 }),
  monster_gel: Object.freeze({ id: 'monster_gel', name: 'Monster Gel', emoji: '🧪', tier: 'raw', stack: 999 }),
  monster_fang: Object.freeze({ id: 'monster_fang', name: 'Monster Fang', emoji: '🦷', tier: 'raw', stack: 999 }),
  golden_wheat: Object.freeze({ id: 'golden_wheat', name: 'Golden Wheat', emoji: '🌾', tier: 'raw', stack: 999 }),
  berries_crop: Object.freeze({ id: 'berries_crop', name: 'Berries Crop', emoji: '🍓', tier: 'raw', stack: 999 }),
  sakura_timber: Object.freeze({ id: 'sakura_timber', name: 'Sakura Timber', emoji: '🌸', tier: 'raw', stack: 999 }),
  celestial_pearl: Object.freeze({ id: 'celestial_pearl', name: 'Celestial Pearl', emoji: '🦪', tier: 'raw', stack: 999 }),
  cloud_lotus: Object.freeze({ id: 'cloud_lotus', name: 'Cloud Lotus', emoji: '🪷', tier: 'raw', stack: 999 }),
  orichalcum_ore: Object.freeze({ id: 'orichalcum_ore', name: 'Orichalcum Ore', emoji: '🔶', tier: 'raw', stack: 999 }),
  astral_prism: Object.freeze({ id: 'astral_prism', name: 'Astral Prism', emoji: '🔮', tier: 'raw', stack: 999 }),

  // Refined materials (stack: 999)
  plank: Object.freeze({ id: 'plank', name: 'Plank', emoji: '🪵', tier: 'refined', stack: 999 }),
  ingot: Object.freeze({ id: 'ingot', name: 'Ingot', emoji: '🪙', tier: 'refined', stack: 999 }),
  mithril_ingot: Object.freeze({ id: 'mithril_ingot', name: 'Mithril Ingot', emoji: '💠', tier: 'refined', stack: 999 }),
  crystal_glass: Object.freeze({ id: 'crystal_glass', name: 'Crystal Glass', emoji: '🔮', tier: 'refined', stack: 999 }),
  flour: Object.freeze({ id: 'flour', name: 'Flour', emoji: '🥡', tier: 'refined', stack: 999 }),
  herb: Object.freeze({ id: 'herb', name: 'Herb', emoji: '🌿', tier: 'refined', stack: 999 }),
  thread: Object.freeze({ id: 'thread', name: 'Thread', emoji: '🧵', tier: 'refined', stack: 999 }),

  // Goods / crafted consumables & parts (stack: 999)
  bread: Object.freeze({ id: 'bread', name: 'Bread', emoji: '🍞', tier: 'goods', stack: 999 }),
  honey_bun: Object.freeze({ id: 'honey_bun', name: 'Honey Bun', emoji: '🥐', tier: 'goods', stack: 999 }),
  fish_pie: Object.freeze({ id: 'fish_pie', name: 'Fish Pie', emoji: '🥧', tier: 'goods', stack: 999 }),
  berry_tart: Object.freeze({ id: 'berry_tart', name: 'Berry Tart', emoji: '🧁', tier: 'goods', stack: 999 }),
  boba_tea: Object.freeze({ id: 'boba_tea', name: 'Boba Tea', emoji: '🧋', tier: 'goods', stack: 999 }),
  golden_croissant: Object.freeze({ id: 'golden_croissant', name: 'Golden Croissant', emoji: '🥐', tier: 'goods', stack: 999 }),
  potion_small: Object.freeze({ id: 'potion_small', name: 'Small Potion', emoji: '🧪', tier: 'goods', stack: 999 }),
  repair_kit: Object.freeze({ id: 'repair_kit', name: 'Repair Kit', emoji: '🔧', tier: 'goods', stack: 999 }),
  pet_treat: Object.freeze({ id: 'pet_treat', name: 'Pet Treat', emoji: '🦴', tier: 'goods', stack: 999 }),
  matcha_tea: Object.freeze({ id: 'matcha_tea', name: 'Matcha Tea', emoji: '🍵', tier: 'goods', stack: 999 }),   // Matcha Tea House Monument

  // Rare materials & boss cores (stack: 99)
  boss_core_moss: Object.freeze({ id: 'boss_core_moss', name: 'Elder Moss Core', emoji: '🟢', tier: 'rare', stack: 99 }),
  boss_core_weaver: Object.freeze({ id: 'boss_core_weaver', name: 'Crystal Weaver Core', emoji: '🟣', tier: 'rare', stack: 99 }),
  boss_core_kitsune: Object.freeze({ id: 'boss_core_kitsune', name: 'Nine-Tail Kitsune Core', emoji: '🦊', tier: 'rare', stack: 99 }),
  boss_core_bahamut: Object.freeze({ id: 'boss_core_bahamut', name: 'Chronos-Solar Core', emoji: '☀️', tier: 'rare', stack: 99 }),
  ancient_gear: Object.freeze({ id: 'ancient_gear', name: 'Ancient Gear', emoji: '⚙️', tier: 'rare', stack: 99 }),
  starlight_essence: Object.freeze({ id: 'starlight_essence', name: 'Starlight Essence', emoji: '✨', tier: 'rare', stack: 99 }),
});

export const FOOD = Object.freeze({
  bread: Object.freeze({ energy: 30 }),
  honey_bun: Object.freeze({ energy: 50, buff: 'regen' }),
  fish_pie: Object.freeze({ energy: 80, buff: 'yield' }),
  berry_tart: Object.freeze({ energy: 40, buff: 'party', party: true }),
  boba_tea: Object.freeze({ energy: 20, buff: 'speed' }),
  golden_croissant: Object.freeze({ energy: 150, buff: 'yield_plus' }),
  matcha_tea: Object.freeze({ energy: 20, buff: 'tea' }),   // 'tea' buff (shorter ultimate cooldown) is wired by the frontier later
});

export const MEAL_BUFF_MS = 30 * 60 * 1000;

export function isMaterial(id) {
  return typeof id === 'string' && Object.prototype.hasOwnProperty.call(MATERIALS, id);
}

export function materialTier(id) {
  return MATERIALS[id]?.tier ?? null;
}

export function isSendableToPartner(id) {
  const item = MATERIALS[id];
  if (!item) return false;
  return item.tier !== 'rare';
}
