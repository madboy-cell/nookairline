// client/js/basecamp_ui.js — Stage 3 "Village Base Camp" client UI (Master Plan v2 §5.8 / §11).
// Parchment panels for the Story board, Build menu, production buildings, farm plots, the Order
// Board and the Warehouse / Pantry, plus the Sky Frontier food pouch + energy sheet.
//
// Self-contained: injects its own stylesheet and DOM. Every server action goes through the
// `request(type, payload)` callback (resolves with the action_result); the authoritative profile
// arrives through `onProfile(profile)` (called by main.js on auth_ok / profile_update).
import { MATERIALS, FOOD, materialTier } from '/shared/materials_catalog.js';
import {
  RECIPES, PRODUCTION_BUILDINGS, CROPS, storeCap, warehouseCapOf, storeOf, storeUsed, storeUpgradeCost, queueSlots,
} from '/shared/production_rules.js';
import { CHAPTERS, currentSteps, isChapterComplete, unlockedBuildings, unlockedForVillage } from '/shared/story_rules.js';
import { CORE, MAX_CORE_LV, DECOR, WONDERS } from '/shared/catalog_landmarks.js';
import { maxCopies, plotCap, utcDay } from '/shared/village_rules.js';
import { RESIDENTS, MEAL_QUALITY, isFed, housingCap, cottageCap, buildingSpeedMult } from '/shared/resident_rules.js';
import { MONUMENTS, CAMP_PROPS, COSMETIC_DECOR, isUnlocked as monumentUnlocked } from '/shared/monument_rules.js';
import { ENERGY, utcDayOf } from '/shared/sky_frontier_rules.js';

// ------------------------------------------------------------------------------------------------
// Cost tables mirrored from server/basecamp_service.js (server-only module: it imports
// economy_service). Keep in sync with BUILD_COSTS / buildCost / upgradeCost / castleLevelCap there.
// The server stays authoritative: these values only drive labels and button states.
// ------------------------------------------------------------------------------------------------
const BUILD_COSTS = Object.freeze({
  windmill_bakery: { wood: 20, stone: 10 },
  patisserie: { wood: 25, stone: 15, gold: 300 },
  mint: { stone: 30, wood: 15 },
  workshop: { wood: 30, stone: 20 },
  flower_greenhouse: { wood: 20, crystal_glass: 4 },
  owl_post_office: { wood: 15, plank: 10 },
  cottage: { plank: 20, stone: 10 },
  farm_plot: { wood: 4 },
  tent: { wood: 8 },
  nest: { plank: 20, herb: 5 },
});
const DEFAULT_BUILD_COST = Object.freeze({ plank: 30, ingot: 10 });
const MAX_STORE_LV = 10;

export function buildCost(type, copyIndex = 0) {
  const base = BUILD_COSTS[type] || DEFAULT_BUILD_COST;
  const mult = (copyIndex | 0) >= 1 ? 2 : 1;
  const out = {};
  for (const [k, n] of Object.entries(base)) out[k] = n * mult;
  return out;
}
export function upgradeCost(type, lv) {
  const l = Math.max(1, lv | 0 || 1);
  const out = { plank: 8 * l, ingot: l >= 3 ? 4 * l : 0, gold: 200 * l };
  for (const k of Object.keys(out)) if (!out[k]) delete out[k];
  return out;
}
const castleLevelCap = (story) => Math.min(MAX_CORE_LV, (Array.isArray(story?.completed) ? story.completed.length : 0) * 2 + 2);
// Stage 5 mirrors of server/basecamp_service.js (EXTRA_RECIPES / ONSEN_COOLDOWN_MS / WISH_COST / CRAFTABLE_DECOR).
const EXTRA_RECIPES = Object.freeze({
  matcha_tea: { id: 'matcha_tea', building: 'wnd_tea_pavilion', monument: 'wnd_tea_pavilion', inputs: { herb: 3, honey: 1 }, outputs: { matcha_tea: 1 }, ms: 300_000, minLv: 1 },
});
const EXTRA_BUILDINGS = Object.freeze({ wnd_tea_pavilion: ['matcha_tea'] });
const ONSEN_COOLDOWN_MS = 4 * 3600_000;
const WISH_COST = 100;
const LAUNCH_MONUMENTS = Object.keys(MONUMENTS).filter((k) => MONUMENTS[k].launch);
const recipeOf = (id) => RECIPES[id] || EXTRA_RECIPES[id] || null;
const recipesFor = (type) => PRODUCTION_BUILDINGS[type] || EXTRA_BUILDINGS[type] || [];
const placeDef = (type) => CORE[type] || WONDERS[type] || DECOR[type] || { name: String(type).replace(/_/g, ' '), emoji: '🏠' };
const MON_EFFECT = {
  wnd_onsen: '♨️ Soak for Well-Rested: +15% gather yield for 30 min (every 4 h)',
  wnd_tea_pavilion: '🍵 Brew Matcha Tea (tap the Tea House on your island)',
  wnd_ferris: '🎡 Couple date buff — Heart Isle only',
  wnd_fountain: '⛲ Daily wish: 100 🪙 → a rare material',
};

// ------------------------------------------------------------------------------------------------
const BC_ERR = Object.freeze({
  missing_inputs: 'missing ingredients for this recipe',
  queue_full: 'the queue is full — collect finished goods or wait',
  level: 'upgrade this building to unlock the recipe',
  locked: 'locked — progress the 📜 Story to unlock it',
  story_locked: 'the Story caps this level — finish the next chapter first',
  not_built: 'construct this building first',
  missing_items: "you don't have all the items yet",
  not_ready: 'not ready yet',
  busy: 'this plot is already growing something',
  missing_seed: 'you need seeds for that crop',
  claimed: 'already claimed today',
  limit: 'daily limit reached',
  diamonds: 'not enough Diamonds 💎',
  missing_materials: 'missing materials',
  not_enough_gold: 'not enough Gold',
  max_copies: 'you own the maximum number of copies',
  plot_cap: 'farm plot cap reached — upgrade the Castle',
  nothing_to_collect: 'nothing to collect yet',
  storage_full: 'storage is full — upgrade the Warehouse / Pantry',
  incomplete: 'finish every step first',
  done: 'all chapters are complete',
  already_watered: 'already watered 💧',
  already_ready: 'already ready to harvest',
  owner: "you can't water your own plot",
  not_placed: 'place this building on your island first',
  not_plot: 'that is not a farm plot',
  already_gifted: 'already gifted energy today',
  no_couple: 'bind a Couple Soul-Link first',
  no_partner: 'partner not found',
  none: 'none left in your Pantry',
  not_food: 'that is not food',
  not_needed: 'the Big Order needs none of your items',
  already_complete: 'the Big Order is already complete',
  empty_slot: 'that order slot is empty',
  no_big_order: 'no Big Order today',
  max_level: 'already max level',
  unique: 'there can be only one',
  no_state: 'frontier data not loaded yet',
  timeout: 'the server took too long — try again',
  no_housing: 'every cottage bed is taken — build & place another Settler Cottage',
  wrong_building: 'this resident only works in their own building',
  not_resident: 'that resident has not moved in yet',
  unknown: 'unknown resident',
  cottage_cap: 'raise Comfort to build more cottages',
  monument_not_built: 'build this Monument first',
  not_craftable: "that decor can't be crafted",
  bad_decor: 'unknown decor',
  already_wished_today: 'you already made a wish today',
  already_claimed_today: 'already claimed today',
  no_tent: 'place a Tent & Campfire first',
  cooldown: 'still cooling down',
  heart_isle_only: 'the Ferris Wheel can only stand on Heart Isle',
  retired: 'this Wonder was retired',
  locked_monument: 'locked — progress the Story',
  monuments_are_built: 'Monuments are built in the Base Camp now',
  cannot_sell_rare: 'rare boss cores & relics cannot be sold',
  bad_item: 'unknown material',
});

const SELL_UNIT_GOLD = Object.freeze({ raw: 2, refined: 8, goods: 12 });

const BUILDING_UNLOCK_CHAPTER = Object.freeze({
  farm_plot: 1,
  tent: 1,
  windmill_bakery: 2,
  patisserie: 2,
  owl_post_office: 2,
  mint: 3,
  workshop: 3,
  flower_greenhouse: 4,
  cottage: 4,
  nest: 5,
});

const ITEM_GUIDE = Object.freeze({
  // Raw materials
  wood: {
    desc: 'Sturdy timber gathered from frontier trees. Essential for crafting Planks and constructing village buildings.',
    sources: [
      { icon: '🌲', title: 'Whispering Meadow — Whispering Grove', detail: 'Chop Meadow Trees with Woodcutter Axe T1+ (6× Wood per node).', region: 'meadow' },
    ],
    uses: 'Craft Planks at the Workshop, build Farm Plots, Tent, Windmill, Mint & Workshop.',
  },
  stone: {
    desc: 'Solid granite quarried from frontier boulders. Used for foundations and smelting Crystal Glass.',
    sources: [
      { icon: '🪨', title: 'Whispering Meadow — Outpost & Golem Arena', detail: 'Mine Stone Boulders with Iron Pickaxe T1+ (6× Stone per node).', region: 'meadow' },
    ],
    uses: 'Construct Mint, Workshop, Windmill & Cottages, or smelt Crystal Glass at the Mint.',
  },
  crystal_ore: {
    desc: 'Raw luminescent ore mined from crystal veins. Smelted into Ingots and Crystal Glass at the Mint.',
    sources: [
      { icon: '💎', title: 'Whispering Meadow — Crystal Grotto (East)', detail: 'Mine starter Crystal Veins with Pickaxe T1+ (4× Crystal Ore) or bonus drops from Stone Boulders.', region: 'meadow' },
      { icon: '🔮', title: 'Crystal Hollow — Cavern Veins', detail: 'Mine rich Crystal, Violet Quartz & Mithril veins (4×–8× Crystal Ore; unlocks after Story Ch. 2).', region: 'hollow' },
    ],
    uses: 'Smelt Ingots (3× Crystal Ore → 1× Ingot) and Crystal Glass at the Mint.',
  },
  sky_wheat: {
    desc: 'Sun-ripened golden grain. Milled into Flour at the Windmill Bakery and requested on the Order Board.',
    sources: [
      { icon: '🌾', title: 'Village Farm Plot', detail: 'Plant for FREE on any Farm Plot (2m → 4× Sky Wheat).', farm: true },
      { icon: '🏝️', title: 'Whispering Meadow — Windmill & Wheat', detail: 'Harvest wild Sky Wheat patches East of the Outpost (5× Sky Wheat).', region: 'meadow' },
    ],
    uses: 'Mill Flour at the Windmill Bakery and fill Villager Orders.',
  },
  herb_seed: {
    desc: 'Wild medicinal seeds gathered from Dewdrop Herb bushes.',
    sources: [
      { icon: '🌱', title: 'Whispering Meadow & Crystal Hollow', detail: 'Gather Dewdrop Herb bushes in the Grove or Boss Sanctum (3× Herb Seed).', region: 'meadow' },
    ],
    uses: 'Plant on Farm Plots (1× Seed → 3× Herb) or refine at the Flower Greenhouse.',
  },
  honey: {
    desc: 'Sweet wildflower nectar prized by bakers and tea brewers.',
    sources: [
      { icon: '🌲', title: 'Whispering Meadow — Trees & Wheat', detail: '18% bonus drop & Uncommon+ jackpot from Meadow Trees and Sky Wheat.', region: 'meadow' },
      { icon: '🐝', title: 'Honey Beehive (Camp Prop)', detail: 'Craft in Build → Craft and place on your island for passive Honey.' },
    ],
    uses: 'Bake Honey Buns & Golden Croissants at the Patisserie, or brew Matcha Tea.',
  },
  fish: {
    desc: 'Fresh sky-pond catch used in hearty savory pies.',
    sources: [
      { icon: '🎣', title: 'Village Dock & Heart Isle Fishing', detail: 'Cast your rod at any fishing dock (Minnow +1, Crab +2, Koi +3 Fish).' },
      { icon: '🐟', title: 'Koi Barrel Pond (Camp Prop)', detail: 'Craft in Build → Craft and place on your island for passive Fish.' },
    ],
    uses: 'Bake Fish Pie (+80 ⚡ Energy & +20% Yield buff) at the Patisserie.',
  },
  feather: {
    desc: 'Soft wind-plume dropped by forest canopies and wisps.',
    sources: [
      { icon: '🌲', title: 'Whispering Meadow — Trees & Wisps', detail: 'Bonus drop from Meadow Trees & Pollen Wisps.', region: 'meadow' },
      { icon: '🏃', title: 'Sky Parkour', detail: 'Rewarded from Sky Parkour finish crates.' },
    ],
    uses: 'Spin Thread at the Workshop and craft cozy Camp Decor.',
  },
  cloud_silk: {
    desc: 'Silvery gossamer strand woven into fine Thread.',
    sources: [
      { icon: '🌿', title: 'Sky Frontier — Herb Bushes & Cavern Mobs', detail: 'Bonus drop from Dewdrop Herb bushes & Crystal Hollow monsters.', region: 'meadow' },
      { icon: '🏃', title: 'Sky Parkour', detail: 'Rewarded from Sky Parkour finish crates.' },
    ],
    uses: 'Spin Thread at the Workshop and craft Decor.',
  },
  monster_gel: {
    desc: 'Bouncy alchemical jelly dropped by frontier slimes.',
    sources: [
      { icon: '⚔️', title: 'Whispering Meadow — Monsters', detail: 'Defeat Moss Slimes & roaming frontier creatures.', region: 'meadow' },
    ],
    uses: 'Alchemical crafting, camp props, or sell excess in Storage for Gold.',
  },
  monster_fang: {
    desc: 'Sharp ivory trophy dropped by fierce frontier beasts.',
    sources: [
      { icon: '⚔️', title: 'Sky Frontier — Boars & Cavern Beasts', detail: 'Defeat Thornback Boars, Lantern Bats & Crystal Beetles.', region: 'meadow' },
    ],
    uses: 'Crafting trophies, camp props, or sell excess in Storage for Gold.',
  },
  golden_wheat: {
    desc: 'Rare sun-blessed grain that bakes into royal pastries.',
    sources: [
      { icon: '🌾', title: 'Whispering Meadow — Sky Wheat Jackpot', detail: '18% bonus & Rare+ jackpot when harvesting wild Sky Wheat.', region: 'meadow' },
      { icon: '🌱', title: 'Village Farm Plot', detail: 'Plant 1× Golden Wheat to harvest 3× Golden Wheat (1h).', farm: true },
    ],
    uses: 'Bake Golden Croissants (+150 ⚡ Energy & +35% Yield) at Patisserie Lv.3+.',
  },
  berries_crop: {
    desc: 'Juicy ruby Star-Berries used in tarts, boba tea, potions, and pet treats.',
    sources: [
      { icon: '🍓', title: 'Village Farm Plot', detail: 'Plant for FREE on any Farm Plot (10m → 5× Berries Crop).', farm: true },
      { icon: '🌿', title: 'Whispering Meadow — Herb Bushes', detail: '18% bonus drop when gathering Dewdrop Herbs.', region: 'meadow' },
    ],
    uses: 'Craft Berry Tart, Boba Tea, Small Potions, Pet Treats & fill Villager Orders.',
  },

  // Refined materials
  plank: {
    desc: 'Refined carpentry board sawn from raw Wood. Essential for Warehouse & Pantry upgrades, Starlight Keep, and village buildings.',
    sources: [
      { icon: '🪚', title: 'Workshop (Village Base Camp)', detail: 'Crafted from 3× Wood → 1× Plank (1m). Unlocks in Story Ch. 3: Echoes Below.' },
      { icon: '🎲', title: 'Monopoly Mini-Game', detail: 'Merchant Crate reward (1st: +6, 2nd: +4, finish: +2 Planks).' },
    ],
    uses: 'Upgrade Warehouse & Pantry, upgrade buildings, build Owl Post Office, Cottages, Pet Nest & Tier-2 Tools.',
  },
  ingot: {
    desc: 'Refined metal bar smelted from Crystal Ore. Required to upgrade your Warehouse & Pantry, upgrade Lv.3+ buildings, and forge Tier-2 tools!',
    sources: [
      { icon: '🔥', title: 'Mint (Village Base Camp)', detail: 'Smelted from 3× Crystal Ore → 1× Ingot (3m). Construct the Mint in Story Ch. 3: Echoes Below!' },
      { icon: '💎', title: 'Crystal Hollow & Crystal Grotto', detail: 'Bonus jackpot drop from Mithril Deep Veins (+2–5), Violet Quartz (+1), and Meadow Crystal Grotto (Rare+ +1–2).', region: 'hollow' },
      { icon: '🎣', title: 'Fishing & Monopoly Mini-Games', detail: 'Fishing Sunken Chests (+2 Ingot) & Monopoly Merchant Crates (1st: +3, 2nd: +2).' },
    ],
    uses: 'Upgrade Warehouse & Pantry capacity, forge Pickaxe T2 & Axe T2 at Workshop Lv.2, Repair Kits & Monuments.',
  },
  crystal_glass: {
    desc: 'Clear enchanted glass fused from Stone and Crystal Ore.',
    sources: [
      { icon: '🔥', title: 'Mint (Village Base Camp)', detail: 'Smelted from 4× Stone + 1× Crystal Ore → 1× Crystal Glass (5m).' },
      { icon: '💎', title: 'Sky Frontier — Crystal & Quartz Veins', detail: '12%–15% bonus drop & Uncommon+ jackpots when mining Crystal or Quartz.', region: 'meadow' },
    ],
    uses: 'Construct Flower Greenhouse, forge Starlight Staff T2, and build Monuments.',
  },
  flour: {
    desc: 'Finely ground Sky Wheat flour ready for the Patisserie.',
    sources: [
      { icon: '🌾', title: 'Windmill Bakery (Village Base Camp)', detail: 'Milled from 3× Sky Wheat → 1× Flour (1m). Unlocks in Story Ch. 2.' },
      { icon: '🎲', title: 'Monopoly Mini-Game', detail: 'Merchant Crate reward (+2 to +4 Flour).' },
    ],
    uses: 'Bake Bread, Honey Buns, Fish Pies & Berry Tarts at the Patisserie.',
  },
  herb: {
    desc: 'Fragrant cured Dewdrop Herb used in teas, potions, staffs, and repair kits.',
    sources: [
      { icon: '🌾', title: 'Village Farm Plot', detail: 'Plant 1× Herb Seed → harvest 3× Herb (20m).', farm: true },
      { icon: '🌺', title: 'Flower Greenhouse (Village Base Camp)', detail: 'Refined from 2× Herb Seed → 1× Herb (5m). Unlocks in Story Ch. 4.' },
    ],
    uses: 'Craft Boba Tea, Matcha Tea, Small Potions, Repair Kits, Pet Treats & Staffs.',
  },
  thread: {
    desc: 'Strong sky-spun yarn woven from Feathers and Cloud Silk.',
    sources: [
      { icon: '🧵', title: 'Workshop (Village Base Camp)', detail: 'Spun from 2× Feather + 1× Cloud Silk → 1× Thread (4m).' },
    ],
    uses: 'Craft cozy Camp Props, Cosmetic Decor & fill Villager Orders.',
  },

  // Goods (Pantry)
  bread: {
    desc: 'Warm crusty loaf (+30 ⚡ Energy). Stored in the Pantry and eaten by Village Residents.',
    sources: [
      { icon: '🥐', title: 'Patisserie (Village Base Camp)', detail: 'Baked from 2× Flour → 1× Bread (2m).' },
      { icon: '⛺', title: 'Tent & Campfire', detail: 'Claim 1× Free Bread every day from your placed Tent.' },
    ],
    uses: 'Equip in your Sky Frontier Food Pouch (+30 ⚡) or keep in Pantry to feed Residents.',
  },
  honey_bun: {
    desc: 'Glazed sweet bun (+50 ⚡ Energy + Regen buff for 30m). Stored in the Pantry.',
    sources: [{ icon: '🥐', title: 'Patisserie', detail: 'Baked from 1× Flour + 1× Honey → 1× Honey Bun (4m).' }],
    uses: 'Restores +50 ⚡ Energy, buffs Energy regen, and feeds Village Residents.',
  },
  fish_pie: {
    desc: 'Hearty golden crust pie (+80 ⚡ Energy + 20% Gather Yield for 30m). Stored in the Pantry.',
    sources: [{ icon: '🥧', title: 'Patisserie', detail: 'Baked from 2× Flour + 1× Fish → 1× Fish Pie (8m).' }],
    uses: 'Big +80 ⚡ Frontier meal with +20% gather yield boost.',
  },
  berry_tart: {
    desc: 'Sparkling Star-Berry tart (+40 ⚡ Energy + Party Boost for 30m). Stored in the Pantry.',
    sources: [{ icon: '🧁', title: 'Patisserie', detail: 'Baked from 1× Flour + 3× Berries Crop → 1× Berry Tart (6m).' }],
    uses: 'Co-op Frontier party meal, Villager Orders & Resident food.',
  },
  boba_tea: {
    desc: 'Refreshing berry-herb milk tea (+20 ⚡ Energy + Swift Steps speed buff for 30m).',
    sources: [{ icon: '🧋', title: 'Patisserie', detail: 'Brewed from 2× Berries Crop + 1× Herb → 1× Boba Tea (3m).' }],
    uses: 'Boosts movement speed in Sky Frontier & fills Villager Orders.',
  },
  golden_croissant: {
    desc: 'Masterwork flaky pastry (+150 ⚡ Energy + 35% Gather Yield for 30m).',
    sources: [{ icon: '🥐', title: 'Patisserie Lv. 3+', detail: 'Baked from 2× Golden Wheat + 1× Honey → 1× Golden Croissant (20m).' }],
    uses: 'Top-tier Frontier feast (+150 ⚡) & high-reward Villager Orders.',
  },
  potion_small: {
    desc: 'Soothing herbal tonic brewed in the Flower Greenhouse. Stored in the Pantry.',
    sources: [{ icon: '🌺', title: 'Flower Greenhouse', detail: 'Brewed from 2× Herb + 1× Berries Crop → 1× Small Potion (6m).' }],
    uses: 'Story Chapter 4 quest, Villager Orders & frontier recovery.',
  },
  repair_kit: {
    desc: 'Sturdy toolkit of Planks, Ingots, and Herbs used to restore ancient frontier statues and shrines.',
    sources: [{ icon: '🌺', title: 'Flower Greenhouse', detail: 'Crafted from 1× Herb + 2× Plank + 1× Ingot → 1× Repair Kit (10m).' }],
    uses: 'Repair Sky Frontier Goddess Outposts & complete Story Chapter 5.',
  },
  pet_treat: {
    desc: 'Crunchy berry-herb biscuit adored by companion pets.',
    sources: [{ icon: '🌺', title: 'Flower Greenhouse', detail: 'Baked from 1× Herb + 2× Berries Crop → 1× Pet Treat (4m).' }],
    uses: 'Pamper pets & fill Villager Orders.',
  },
  matcha_tea: {
    desc: 'Serene whisked green tea (+20 ⚡ Energy + Tea Spirit buff).',
    sources: [{ icon: '🍵', title: 'Matcha Tea House Monument', detail: 'Brewed from 3× Herb + 1× Honey → 1× Matcha Tea (5m).' }],
    uses: 'Sky Frontier Food Pouch buff & high-quality Resident meal.',
  },

  // Rare materials & cores
  ancient_gear: {
    desc: 'Pre-calamity clockwork relic. Required for Warehouse & Pantry Lv. 3+ upgrades and grand Monuments.',
    sources: [
      { icon: '💎', title: 'Sky Frontier — Boulders, Crystal, Quartz & Mithril', detail: 'Rare drop (2%–4%) & Epic Jackpot bonus when hitting PERFECT! strikes on stone/crystal nodes.', region: 'hollow' },
      { icon: '🎣', title: 'Fishing Sunken Chest & Fountain of Wishes', detail: '10% bonus inside Sunken Chests and daily Fountain of Wishes.' },
    ],
    uses: 'Upgrade Warehouse & Pantry (Lv. 2 → 3+) and construct Monuments.',
  },
  starlight_essence: {
    desc: 'Condensed celestial shimmer crystallized in deep caverns.',
    sources: [
      { icon: '✨', title: 'Crystal Hollow & Epic Harvest Jackpots', detail: 'Drops from Mithril/Quartz jackpots, Frontier Bosses, and the Fountain of Wishes.', region: 'hollow' },
    ],
    uses: 'High-stage Monuments and enchanted crafting.',
  },
  boss_core_moss: {
    desc: 'Heartstone of the ancient forest guardian.',
    sources: [
      { icon: '👑', title: 'Whispering Meadow — Moss Golem Arena', detail: 'Summon & defeat the Elder Moss Golem boss in North-West Meadow (-20, -18).', region: 'meadow' },
    ],
    uses: 'Constructing Monuments & completing Story Chapter 5.',
  },
  boss_core_weaver: {
    desc: 'Prismatic core of the deep cavern guardian.',
    sources: [
      { icon: '👑', title: 'Crystal Hollow — Weaver Boss Sanctum', detail: 'Summon & defeat the Hollow Crystal Weaver boss in North Crystal Hollow (0, -26).', region: 'hollow' },
    ],
    uses: 'High-tier Monuments & endgame upgrades.',
  },
});

const TOOL_ICON = { pickaxe: '⛏️', axe: '🪓', staff: '🪄' };
const STEP_ICON = { gather: '🏝️', craft: '⚒️', build: '🔨', deliver_orders: '📋', visit: '🧭', defeat: '⚔️', harvest: '🌾' };
const BUFF_LABEL = { regen: 'Regen', yield: '+20% Yield', yield_plus: '+35% Yield', party: 'Party Boost', speed: 'Swift Steps' };
const RESIDENT_NAME = { baker: 'Baker', miner: 'Miner', smith: 'Smith', botanist: 'Botanist', pet_keeper: 'Pet Keeper' };

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtN = (n) => Number(n || 0).toLocaleString('en-US');
const matOf = (id) => MATERIALS[id] || { id, name: String(id).replace(/_/g, ' '), emoji: '📦' };
const coreOf = (type) => CORE[type] || { name: String(type).replace(/_/g, ' '), emoji: '🏠' };
function fmtDur(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  if (s >= 3600) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  if (s >= 60) return `${Math.floor(s / 60)}m${s % 60 ? ` ${s % 60}s` : ''}`;
  return `${s}s`;
}
const recipeIcon = (r) => (r.tool ? TOOL_ICON[r.tool.kind] || '🛠️' : matOf(Object.keys(r.outputs || {})[0]).emoji);
const recipeName = (r) => (r.tool ? `${r.tool.kind[0].toUpperCase()}${r.tool.kind.slice(1)} T${r.tool.tier}` : matOf(Object.keys(r.outputs || {})[0]).name);
const itemsLine = (items) => Object.entries(items || {}).filter(([, n]) => n > 0).map(([k, n]) => `${matOf(k).emoji}×${fmtN(n)}`).join(' ');

const STYLE = `
.bc-hud-row { display: flex; gap: 5px; justify-content: flex-end; pointer-events: auto; }
.bc-hud-btn {
  position: relative; width: 48px; height: 48px; border-radius: 14px; border: 2.5px solid #3B2A20;
  background: linear-gradient(180deg, #F4EAD6 0%, #E9DCC0 60%, #D9C59C 100%); color: #3B2A20;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; padding: 0;
  font: 900 9.5px Georgia, "Times New Roman", serif; letter-spacing: .2px; cursor: pointer;
  box-shadow: inset 0 2px 0 #fffaf0, inset 0 -2px 0 #C9A45C, 0 3px 0 #3B2A20, 0 5px 10px rgba(0,0,0,.3);
}
.bc-hud-btn .bc-ico { font-size: 19px; line-height: 1; }
.bc-hud-btn:active { transform: translateY(2px); box-shadow: inset 0 1px 0 #fffaf0, 0 1px 0 #3B2A20; }
.bc-hud-btn.bc-locked { filter: grayscale(.7); opacity: .78; }
.bc-hud-btn.bc-locked::after { content: '🔒'; position: absolute; right: -4px; top: -6px; font-size: 12px; }
.bc-hud-btn .bc-dot { position: absolute; right: -3px; top: -3px; width: 12px; height: 12px; border-radius: 50%; background: #e2462f; border: 2px solid #fff4dc; display: none; }
.bc-hud-btn.bc-has-dot .bc-dot { display: block; animation: bcPulse 1.1s ease-in-out infinite; }
@keyframes bcPulse { 50% { transform: scale(1.25); } }

.bc-overlay { position: absolute; inset: 0; z-index: 36; display: flex; align-items: flex-end; justify-content: center;
  background: rgba(24, 14, 8, .55); pointer-events: auto;
  /* stays under the persistent bottom dock (z 38) like the other panels, so leave room for it */
  padding: calc(env(safe-area-inset-top, 0px) + 64px) 8px calc(env(safe-area-inset-bottom, 0px) + 80px); }
.bc-overlay[hidden] { display: none !important; }
#sf-hud .bc-overlay { position: fixed; z-index: 60; padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 12px); }
.bc-sheet { width: 100%; max-width: 380px; max-height: 100%; display: flex; flex-direction: column;
  background: #E9DCC0; color: #3B2A20; border: 3px solid #3B2A20; border-radius: 18px; overflow: hidden;
  box-shadow: 0 0 0 2px #C9A45C inset, 0 10px 30px rgba(0,0,0,.5); font: 600 12.5px system-ui, -apple-system, "Segoe UI", sans-serif; }
.bc-sheet.bc-small { max-width: 340px; }
.bc-head { display: flex; align-items: center; gap: 8px; padding: 10px 12px 8px; background: linear-gradient(180deg, #4a3527, #3B2A20);
  color: #F4EAD6; border-bottom: 2px solid #C9A45C; }
.bc-head h3 { flex: 1; margin: 0; font: 700 16px Georgia, "Times New Roman", serif; letter-spacing: .3px; }
.bc-x { width: 30px; height: 30px; border-radius: 50%; border: 2px solid #C9A45C; background: #E9DCC0; color: #3B2A20; font: 900 14px system-ui; cursor: pointer; }
.bc-body { overflow-y: auto; padding: 10px 12px 12px; -webkit-overflow-scrolling: touch; }
.bc-foot { display: flex; gap: 6px; padding: 8px 12px 10px; border-top: 2px solid #cdb88f; background: #E2D2B0; flex-wrap: wrap; }
.bc-foot .bc-btn { flex: 1; }
.bc-sec { font: 700 13.5px Georgia, "Times New Roman", serif; margin: 10px 0 6px; color: #3B2A20; display: flex; align-items: center; gap: 6px; }
.bc-sec:first-child { margin-top: 0; }
.bc-sec small { font: 700 11px system-ui; color: #6E5339; margin-left: auto; }
.bc-card { background: #F4EAD6; border: 2px solid #b99f74; border-radius: 12px; padding: 8px 9px; margin-bottom: 7px; }
.bc-card.bc-done { border-color: #6c9a4b; background: #eef3dc; }
.bc-card.bc-dim { opacity: .62; }
.bc-row { display: flex; align-items: center; gap: 8px; }
.bc-row .bc-grow { flex: 1; min-width: 0; }
.bc-big-ico { font-size: 26px; width: 34px; text-align: center; flex-shrink: 0; }
.bc-title { font: 700 13px Georgia, "Times New Roman", serif; }
.bc-sub { font-size: 11px; color: #6E5339; margin-top: 1px; }
.bc-chips { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
.bc-chip { display: inline-flex; align-items: center; gap: 3px; padding: 2px 7px; border-radius: 999px; background: #fffaf0; border: 1.5px solid #cdb88f; font: 800 11px system-ui; color: #3B2A20; white-space: nowrap; }
.bc-chip.ok { border-color: #6c9a4b; color: #2f5a1a; }
.bc-chip.bad { border-color: #c4523d; color: #9a2a17; background: #fff1ec; }
.bc-chip.brass { border-color: #C9A45C; background: #fbf1d6; }
.bc-btn { border: 2px solid #3B2A20; border-radius: 11px; padding: 6px 11px; cursor: pointer; white-space: nowrap;
  background: linear-gradient(180deg, #f6dc9a, #C9A45C); color: #3B2A20; font: 900 12px system-ui; box-shadow: 0 2px 0 #3B2A20; }
.bc-btn.green { background: linear-gradient(180deg, #b8e49a, #5fa73f); color: #133a05; }
.bc-btn.red { background: linear-gradient(180deg, #f2b3a3, #c4523d); color: #fff; text-shadow: 0 1px 0 #6b1d10; }
.bc-btn.plain { background: #F4EAD6; }
.bc-btn:disabled { filter: grayscale(.8); opacity: .55; cursor: default; }
.bc-btn:active:not(:disabled) { transform: translateY(1.5px); box-shadow: 0 0.5px 0 #3B2A20; }
.bc-bar { position: relative; height: 12px; border-radius: 999px; background: #d8c6a2; border: 1.5px solid #8a6f4c; overflow: hidden; margin-top: 5px; }
.bc-bar > i { position: absolute; left: 0; top: 0; bottom: 0; background: linear-gradient(90deg, #C9A45C, #f0d58c); border-radius: 999px; transition: width .4s linear; }
.bc-bar.ok > i { background: linear-gradient(90deg, #5fa73f, #a8dc84); }
.bc-bar > b { position: absolute; inset: 0; text-align: center; font: 900 9px/10px system-ui; color: #3B2A20; }
.bc-note { font-size: 11px; color: #6E5339; background: #f7efdc; border: 1.5px dashed #b99f74; border-radius: 10px; padding: 6px 8px; margin: 6px 0; }
.bc-note.good { border-color: #6c9a4b; color: #2f5a1a; background: #eef3dc; }
.bc-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(62px, 1fr)); gap: 5px; }
.bc-cell { background: #fffaf0; border: 1.5px solid #cdb88f; border-radius: 10px; padding: 4px 2px; text-align: center; font: 800 10px system-ui; }
.bc-cell .e { font-size: 19px; display: block; line-height: 1.15; }
.bc-cell .n { color: #6E5339; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bc-steps .bc-card { padding: 6px 9px; }
.bc-check { font-size: 15px; width: 20px; text-align: center; }
.bc-tag { font: 900 10px system-ui; padding: 1px 6px; border-radius: 999px; background: #3B2A20; color: #F4EAD6; }
.bc-tabs { display: flex; gap: 4px; margin: 0 0 9px; }
.bc-tab { flex: 1; border: 2px solid #b99f74; border-radius: 10px; padding: 5px 2px; background: #F4EAD6; color: #6E5339; font: 800 11px system-ui; cursor: pointer; white-space: nowrap; }
.bc-tab.on { background: linear-gradient(180deg, #4a3527, #3B2A20); color: #F4EAD6; border-color: #3B2A20; box-shadow: inset 0 -2px 0 #C9A45C; }
.bc-sel { border: 2px solid #3B2A20; border-radius: 10px; padding: 5px 6px; background: #fffaf0; color: #3B2A20; font: 800 11.5px system-ui; max-width: 140px; }

/* --- Sky Frontier: food pouch / energy + / meal buff --- */
.bc-sf-plus { width: 30px; height: 30px; border-radius: 50%; border: 2px solid #C9A45C; background: #3B2A20; color: #FFE27A;
  font: 900 17px/1 system-ui; display: flex; align-items: center; justify-content: center; padding: 0; cursor: pointer; pointer-events: auto;
  box-shadow: 0 2px 6px rgba(0,0,0,.4); }
.bc-sf-buff { display: none; align-items: center; gap: 4px; height: 28px; padding: 2px 9px; border-radius: 14px; background: rgba(36,24,18,.78);
  border: 2px solid #C9A45C; color: #FFF3C4; font: 800 11.5px system-ui; pointer-events: auto; }
.bc-sf-buff.on { display: inline-flex; }
.bc-sf-pouch { position: absolute; left: 8px; top: 34%; display: flex; flex-direction: column; gap: 6px; pointer-events: auto; }
.bc-sf-slot { position: relative; width: 46px; height: 46px; border-radius: 13px; border: 2.5px solid #3B2A20; background: #E9DCC0;
  box-shadow: inset 0 0 0 1.5px #C9A45C, 0 3px 8px rgba(0,0,0,.4); font-size: 22px; display: flex; align-items: center; justify-content: center;
  padding: 0; cursor: pointer; touch-action: manipulation; -webkit-touch-callout: none; }
.bc-sf-slot.empty { color: #8a6f4c; font: 900 18px system-ui; background: rgba(233,220,192,.72); }
.bc-sf-slot[hidden], .bc-sf-edit[hidden] { display: none !important; }
.bc-sf-slot.zero { filter: grayscale(.85); opacity: .7; }
.bc-sf-slot b { position: absolute; right: -4px; bottom: -4px; min-width: 18px; height: 18px; border-radius: 9px; background: #3B2A20; color: #FFE27A;
  border: 1.5px solid #C9A45C; font: 900 10px/15px system-ui; padding: 0 3px; text-align: center; }
.bc-sf-edit { width: 46px; height: 24px; border-radius: 10px; border: 2px solid #3B2A20; background: #C9A45C; color: #3B2A20; font: 900 10px system-ui; cursor: pointer; padding: 0; }
.bc-crop-actions { display: flex; gap: 6px; margin-top: 7px; }
.bc-crop-actions .bc-btn { flex: 1; text-align: center; }
.bc-loot-pop {
  position: fixed; z-index: 420; pointer-events: none;
  display: inline-flex; align-items: center; gap: 4px;
  padding: 4px 10px; border-radius: 999px;
  background: linear-gradient(180deg, #FFFDF7, #F4EAD6);
  border: 2px solid #3B2A20; color: #2f5a1a;
  font: 900 13px system-ui, -apple-system, sans-serif;
  box-shadow: 0 4px 12px rgba(0,0,0,0.32), inset 0 0 0 1.5px #C9A45C;
  transform: translate(-50%, -50%) scale(0.5);
  opacity: 0;
  animation: bcLootArc 1.05s cubic-bezier(0.2, 0.85, 0.3, 1) forwards;
}
@keyframes bcLootArc {
  0% { opacity: 0; transform: translate(-50%, -50%) scale(0.45); }
  22% { opacity: 1; transform: translate(calc(-50% + var(--dx, 0px) * 0.45), calc(-50% + var(--dy, -60px) * 0.45)) scale(1.14); }
  75% { opacity: 1; transform: translate(calc(-50% + var(--dx, 0px)), calc(-50% + var(--dy, -110px))) scale(1.0); }
  100% { opacity: 0; transform: translate(calc(-50% + var(--dx, 0px) * 1.15), calc(-50% + var(--dy, -155px))) scale(0.75); }
}
.bc-sf-quest {
  display: none; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 14px;
  background: linear-gradient(180deg, rgba(59, 42, 32, 0.92), rgba(38, 25, 18, 0.95));
  border: 2px solid #C9A45C; color: #F4EAD6; font: 800 11px system-ui;
  box-shadow: 0 3px 8px rgba(0,0,0,.4); cursor: pointer; pointer-events: auto;
  max-width: min(92vw, 350px); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.bc-sf-quest.on { display: inline-flex; }
.bc-sf-quest.ready {
  background: linear-gradient(180deg, #4b7c2c, #2f5418); border-color: #b8e49a; color: #fff;
  animation: bcPulse 1.4s ease-in-out infinite;
}
.bc-chip-item {
  cursor: pointer;
  appearance: none;
  font-family: inherit;
  transition: transform 0.1s ease, box-shadow 0.12s ease;
}
.bc-chip-item:hover { filter: brightness(0.97); }
.bc-chip-item:active { transform: scale(0.95); }
.bc-chip-q { font-style: normal; font-size: 10px; opacity: 0.72; margin-left: 1px; }
.bc-cell[data-bc-item], .bc-big-ico[data-bc-item] {
  cursor: pointer;
  transition: transform 0.1s ease, border-color 0.14s ease, box-shadow 0.14s ease;
}
.bc-cell[data-bc-item]:hover { border-color: #8a6f4c; box-shadow: 0 2px 6px rgba(59,42,32,0.16); }
.bc-cell[data-bc-item]:active, .bc-big-ico[data-bc-item]:active { transform: scale(0.94); }
.bc-item-backdrop {
  position: absolute; inset: 0; z-index: 55;
  background: rgba(20, 12, 6, 0.62); backdrop-filter: blur(3px);
  display: flex; align-items: center; justify-content: center; padding: 12px;
}
.bc-item-backdrop[hidden] { display: none !important; }
.bc-item-card {
  width: 100%; max-width: 356px; max-height: 82vh; display: flex; flex-direction: column;
  background: #E9DCC0; color: #3B2A20; border: 3px solid #3B2A20; border-radius: 18px; overflow: hidden;
  box-shadow: 0 0 0 2px #C9A45C inset, 0 14px 36px rgba(0,0,0,0.58);
  font: 600 12.5px system-ui, -apple-system, "Segoe UI", sans-serif;
}
.bc-item-body { overflow-y: auto; padding: 10px 12px 12px; -webkit-overflow-scrolling: touch; }
.bc-item-hero {
  display: flex; align-items: center; gap: 10px; background: #F4EAD6;
  border: 2px solid #b99f74; border-radius: 13px; padding: 9px 10px; margin-bottom: 8px;
}
.bc-item-avatar {
  width: 50px; height: 50px; border-radius: 14px; background: #fffaf0; border: 2px solid #C9A45C;
  display: flex; align-items: center; justify-content: center; font-size: 30px; flex-shrink: 0;
  box-shadow: inset 0 2px 4px rgba(201,164,92,0.2);
}
.bc-item-src {
  display: flex; align-items: flex-start; gap: 8px; padding: 7px 9px;
  background: #F4EAD6; border: 1.5px solid #cdb88f; border-radius: 11px; margin-bottom: 6px;
}
.bc-item-src-ico { font-size: 20px; line-height: 1.15; flex-shrink: 0; margin-top: 1px; }
`;

export class BasecampUI {
  constructor({ request, toast, getProfile, humanError, now, onEnterEdit, onEnterFrontier, onEnergy, onOpenLegacy } = {}) {
    this.request = request;
    this.toast = toast || (() => {});
    this.getProfile = getProfile || (() => null);
    this.humanError = humanError || ((e) => e);
    this.now = typeof now === 'function' ? now : () => Date.now();
    this.onEnterEdit = onEnterEdit || null;
    this.onEnterFrontier = onEnterFrontier || null;
    this.onEnergy = onEnergy || null;
    this.onOpenLegacy = onOpenLegacy || null;
    this.profile = null;
    this.view = null;            // { kind, ...args }
    this.board = null;           // last bc_orders board
    this.justBuilt = null;
    this._acts = new Map();
    this._actSeq = 0;
    this._busy = false;
    this._hud = null;
    this._sf = null;
    this._edgeAt = Infinity;     // next timestamp at which the open view must re-render
    this._lastRecipeByUid = new Map();
    this._lastCropByUid = new Map();
    this.itemDetailId = null;
    this._itemHistory = [];
    this._itemActs = new Map();
    this._injectStyle();
    this._buildOverlay();
    this._timer = setInterval(() => this._tick(), 1000);
  }

  // ---------------------------------------------------------------------------------- plumbing
  _injectStyle() {
    if (typeof document === 'undefined' || document.getElementById('bc-ui-style')) return;
    const s = document.createElement('style');
    s.id = 'bc-ui-style';
    s.textContent = STYLE;
    document.head.appendChild(s);
  }

  _buildOverlay() {
    const ov = document.createElement('div');
    ov.className = 'bc-overlay';
    ov.hidden = true;
    ov.innerHTML = `<section class="bc-sheet" role="dialog" aria-modal="true">
      <header class="bc-head"><h3 class="bc-h">—</h3><button type="button" class="bc-x" aria-label="Close">✕</button></header>
      <div class="bc-body"></div><footer class="bc-foot"></footer></section>
      <div class="bc-item-backdrop" hidden></div>`;
    this.overlay = ov;
    this.sheetEl = ov.querySelector('.bc-sheet');
    this.titleEl = ov.querySelector('.bc-h');
    this.bodyEl = ov.querySelector('.bc-body');
    this.footEl = ov.querySelector('.bc-foot');
    this.itemBackdropEl = ov.querySelector('.bc-item-backdrop');
    ov.querySelector('.bc-x').onclick = () => this.close();
    ov.addEventListener('click', (e) => {
      if (e.target === ov) { this.close(); return; }
      if (e.target === this.itemBackdropEl || e.target.closest?.('[data-bc-item-close]')) {
        e.preventDefault();
        this.closeItemDetail();
        return;
      }
      const backBtn = e.target.closest?.('[data-bc-item-back]');
      if (backBtn && ov.contains(backBtn)) {
        e.preventDefault();
        const prev = this._itemHistory.pop();
        if (prev) {
          this.itemDetailId = prev;
          this._renderItemDetail();
        } else {
          this.closeItemDetail();
        }
        return;
      }
      const iActBtn = e.target.closest?.('[data-bc-item-act]');
      if (iActBtn && ov.contains(iActBtn)) {
        e.preventDefault();
        const fn = this._itemActs.get(iActBtn.dataset.bcItemAct);
        if (fn && !iActBtn.disabled && !this._busy) {
          this._busy = true;
          iActBtn.disabled = true;
          Promise.resolve(fn()).catch((err) => console.warn('[basecamp item]', err)).finally(() => {
            this._busy = false;
            if (iActBtn.isConnected) iActBtn.disabled = false;
          });
        }
        return;
      }
      const itemEl = e.target.closest?.('[data-bc-item]');
      if (itemEl && ov.contains(itemEl)) {
        e.preventDefault();
        e.stopPropagation();
        this.openItemDetail(itemEl.dataset.bcItem);
        return;
      }
      const btn = e.target.closest?.('[data-bc]');
      if (btn && ov.contains(btn)) this._run(btn);
    });
    // <select data-bc-sel> dropdowns (resident assignment)
    ov.addEventListener('change', (e) => {
      const sel = e.target.closest?.('select[data-bc-sel]');
      const fn = sel && this._acts.get(sel.dataset.bcSel);
      if (fn && !this._busy) { this._busy = true; Promise.resolve(fn(sel.value)).catch((err) => console.warn('[basecamp]', err)).finally(() => { this._busy = false; }); }
    });
    // swallow pointer input so the 3D world underneath never sees taps on the sheet
    for (const ev of ['pointerdown', 'pointerup', 'touchstart', 'wheel']) ov.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
    (document.getElementById('app') || document.body).appendChild(ov);
  }

  /** Register a click handler and return the data attribute to put on a button. */
  _act(fn) {
    const id = String(++this._actSeq);
    this._acts.set(id, fn);
    return `data-bc="${id}"`;
  }

  /** Like _act for a <select>: `fn(value)` runs on change. */
  _actSel(fn) {
    const id = String(++this._actSeq);
    this._acts.set(id, fn);
    return `data-bc-sel="${id}"`;
  }

  async _run(btn) {
    const fn = this._acts.get(btn.dataset.bc);
    if (!fn || btn.disabled || this._busy) return;
    this._busy = true;
    btn.disabled = true;
    try { await fn(); } catch (err) { console.warn('[basecamp]', err); } finally {
      this._busy = false;
      if (btn.isConnected) btn.disabled = false;
    }
  }

  err(code) { return BC_ERR[code] || this.humanError?.(code) || String(code || 'error'); }

  async _req(type, payload = {}, icon = '⚠️') {
    if (typeof this.request !== 'function') return { ok: false, error: 'no_socket' };
    const r = (await this.request(type, payload)) || { ok: false, error: 'server_error' };
    if (!r.ok) this.toast(`${icon} ${this.err(r.error)}`, 2600);
    return r;
  }

  _p() { return this.profile || this.getProfile?.() || null; }
  _stores(p = this._p()) {
    const fr = p?.frontier || {};
    return { warehouse: fr.warehouse || { lv: 1, items: {} }, pantry: fr.pantry || { lv: 1, items: {} } };
  }
  _have(id, p = this._p()) {
    if (!p) return 0;
    if (id === 'gold') return p.gold | 0;
    if (id === 'diamonds') return p.diamonds | 0;
    const st = this._stores(p)[storeOf(id)];
    return st?.items?.[id] | 0;
  }
  _canAfford(cost, p = this._p()) { return Object.entries(cost || {}).every(([k, n]) => this._have(k, p) >= n); }
  _costChips(cost, p = this._p()) {
    return Object.entries(cost || {}).map(([k, n]) => {
      const have = this._have(k, p);
      const ico = k === 'gold' ? '🪙' : k === 'diamonds' ? '💎' : matOf(k).emoji;
      if (k === 'gold' || k === 'diamonds' || !MATERIALS[k]) {
        const label = k === 'gold' || k === 'diamonds' ? `${fmtN(n)}` : `${fmtN(have)}/${fmtN(n)}`;
        return `<span class="bc-chip ${have >= n ? 'ok' : 'bad'}" title="${esc(k === 'gold' ? 'Gold' : matOf(k).name)}">${ico} ${label}</span>`;
      }
      const mName = matOf(k).name;
      return `<button type="button" class="bc-chip bc-chip-item ${have >= n ? 'ok' : 'bad'}" data-bc-item="${esc(k)}" title="Tap for ${esc(mName)} details &amp; where to find/craft">${ico} ${esc(mName)} ${fmtN(have)}/${fmtN(n)} <i class="bc-chip-q">ⓘ</i></button>`;
    }).join('');
  }
  _story(p = this._p()) {
    const s = p?.story;
    return s && typeof s.chapter === 'number' ? s : { chapter: 0, progress: {}, completed: [], claimed: [] };
  }
  _bar(start, end, label = '') {
    const now = this.now();
    const pct = end > start ? Math.max(0, Math.min(100, ((now - start) / (end - start)) * 100)) : 100;
    if (end > now) this._edgeAt = Math.min(this._edgeAt, end);
    return `<div class="bc-bar${pct >= 100 ? ' ok' : ''}" data-bar-start="${start}" data-bar-end="${end}"><i style="width:${pct.toFixed(1)}%"></i><b data-until="${end}" data-label="${esc(label)}">${esc(label)}${end > now ? ` ${fmtDur(end - now)}` : ' ✓'}</b></div>`;
  }

  // ---------------------------------------------------------------------------------- lifecycle
  onProfile(profile) {
    if (!profile) return;
    this.profile = profile;
    if (profile.orders) this.board = profile.orders;
    this._refreshHud();
    this._renderFrontier();
    if (this.view && !this.overlay.hidden) this.render({ keepScroll: true });
    if (this.itemDetailId && this.itemBackdropEl && !this.itemBackdropEl.hidden) this._renderItemDetail();
  }

  isOpen() { return !!this.view && !this.overlay.hidden; }

  open(kind, args = {}) {
    this.closeItemDetail();
    this.view = { kind, ...args };
    const sfHud = document.getElementById('sf-hud');
    const inFrontier = document.getElementById('hud')?.dataset.scene === 'SKY_FRONTIER' && sfHud;
    const host = inFrontier ? sfHud : (document.getElementById('app') || document.body);
    if (this.overlay.parentNode !== host) host.appendChild(this.overlay);
    this.overlay.hidden = false;
    this.render();
    if (kind === 'orders') this._loadOrders();
  }

  close() {
    this.closeItemDetail();
    this.view = null;
    this.overlay.hidden = true;
    this._acts.clear();
    this.justBuilt = null;
  }

  render({ keepScroll = false } = {}) {
    if (!this.view) return;
    const scroll = keepScroll ? this.bodyEl.scrollTop : 0;
    this._acts.clear();
    this._edgeAt = Infinity;
    const p = this._p();
    let out = { title: '—', body: '', foot: '', small: false };
    try {
      switch (this.view.kind) {
        case 'story': out = this._viewStory(p); break;
        case 'build': out = this._viewBuild(p); break;
        case 'production': out = this._viewProduction(p); break;
        case 'plot': out = this._viewPlot(p); break;
        case 'orders': out = this._viewOrders(p); break;
        case 'storage': out = this._viewStorage(p); break;
        case 'pouch': out = this._viewPouch(p); break;
        case 'energy': out = this._viewEnergy(p); break;
        default: break;
      }
    } catch (err) {
      console.warn('[basecamp] render failed', err);
      out = { title: '⚠️ Base Camp', body: '<div class="bc-note">Something went wrong drawing this panel.</div>', foot: '' };
    }
    this.titleEl.textContent = out.title;
    this.bodyEl.innerHTML = out.body;
    this.footEl.innerHTML = out.foot || '';
    this.footEl.hidden = !out.foot;
    this.sheetEl.classList.toggle('bc-small', !!out.small);
    this.bodyEl.scrollTop = scroll;
  }

  _tick() {
    const now = this.now();
    if (this.isOpen()) {
      if (now >= this._edgeAt) { this.render({ keepScroll: true }); return; }
      for (const el of this.bodyEl.querySelectorAll('[data-bar-end]')) {
        const s = Number(el.dataset.barStart), e = Number(el.dataset.barEnd);
        const pct = e > s ? Math.max(0, Math.min(100, ((now - s) / (e - s)) * 100)) : 100;
        const fill = el.firstElementChild;
        if (fill) fill.style.width = `${pct.toFixed(1)}%`;
      }
      for (const el of this.bodyEl.querySelectorAll('[data-until]')) {
        const u = Number(el.dataset.until);
        el.textContent = `${el.dataset.label || ''}${u > now ? ` ${fmtDur(u - now)}` : ' ✓'}`;
      }
    }
    this._renderBuff();
  }

  // ---------------------------------------------------------------------------------- HUD buttons
  /** Create the Story / Build / Orders / Storage buttons inside `containerEl` (e.g. #village-actions). */
  mountHud(containerEl) {
    if (!containerEl || this._hud) return;
    const row = document.createElement('div');
    row.className = 'bc-hud-row';
    row.id = 'bc-hud-row';
    const defs = [
      ['story', '📜', 'Story'], ['build', '🔨', 'Build'], ['orders', '📋', 'Orders'], ['storage', '📦', 'Storage'],
    ];
    const btns = {};
    for (const [kind, ico, label] of defs) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bc-hud-btn';
      b.id = `bc-btn-${kind}`;
      b.innerHTML = `<span class="bc-ico">${ico}</span><span>${label}</span><i class="bc-dot"></i>`;
      b.onclick = (e) => { e.stopPropagation(); this._onHudButton(kind); };
      row.appendChild(b);
      btns[kind] = b;
    }
    containerEl.insertBefore(row, containerEl.firstChild);
    this._hud = { row, btns };
    this._refreshHud();
  }

  _onHudButton(kind) {
    if (kind === 'orders' && !this._ordersUnlocked()) {
      const ch = CHAPTERS.find((c) => c.rewards?.unlockBuildings?.includes('owl_post_office'));
      this.toast(`🔒 The Order Board opens with the Owl Post Office — finish Chapter ${ch ? `${ch.id + 1}: ${ch.title}` : 'the Story'} 📜`, 3200);
      return;
    }
    this.open(kind);
  }

  _ordersUnlocked(p = this._p()) { return unlockedForVillage(this._story(p), p?.village).includes('owl_post_office'); }

  _refreshHud() {
    if (!this._hud) return;
    const p = this._p();
    if (!p) return;
    const { btns } = this._hud;
    btns.story.classList.toggle('bc-has-dot', isChapterComplete(this._story(p)));
    const unlocked = this._ordersUnlocked(p);
    btns.orders.classList.toggle('bc-locked', !unlocked);
    btns.orders.title = unlocked ? 'Order Board' : 'Locked — progress the Story';
    const crate = p.frontier?.campCrate?.items || {};
    btns.storage.classList.toggle('bc-has-dot', Object.values(crate).some((n) => n > 0));
    const hasReady = this._anyProductionReady(p) || this._anyCropReady(p);
    btns.build.classList.toggle('bc-has-dot', hasReady);
    btns.storage.classList.toggle('bc-has-dot', btns.storage.classList.contains('bc-has-dot') || hasReady);
  }

  _buildingProductionReady(st, now = this.now()) {
    if (!st) return false;
    if (Object.values(st.output || {}).some((n) => n > 0) || (st.tools || []).length) return true;
    return (st.queue || []).some((j) => Number(j?.doneAt || 0) <= now);
  }

  _anyProductionReady(p = this._p()) {
    const now = this.now();
    for (const st of Object.values(p?.village?.production || {})) {
      if (this._buildingProductionReady(st, now)) return true;
    }
    return false;
  }

  _anyCropReady(p = this._p()) {
    const now = this.now();
    for (const pl of Object.values(p?.village?.plots || {})) {
      if (pl?.crop && Number(pl.readyAt || 0) <= now) return true;
    }
    return false;
  }

  getReadySummary(p = this._p()) {
    const v = p?.village || {};
    const now = this.now();
    const readyPlotUids = [];
    const readyProdUids = [];
    for (const b of v.buildings || []) {
      if (b.type === 'farm_plot') {
        const pl = v.plots?.[b.uid];
        if (pl?.crop && Number(pl.readyAt || 0) <= now) readyPlotUids.push(b.uid);
      } else if (this._buildingProductionReady(v.production?.[b.uid], now)) {
        readyProdUids.push(b.uid);
      }
    }
    const anyReady = readyPlotUids.length > 0 || readyProdUids.length > 0;
    const labelBits = [];
    if (readyPlotUids.length) labelBits.push(`🌾 ×${readyPlotUids.length}`);
    if (readyProdUids.length) labelBits.push(`📦 ×${readyProdUids.length}`);
    return { anyReady, readyPlotUids, readyProdUids, labelHtml: labelBits.join(' · ') };
  }

  playPopSfx(kind = 'harvest') {
    if (typeof window === 'undefined') return;
    try {
      const world = window.__neora?.world;
      const local = world?.local;
      if (local?.rig) {
        local.rig.triggerAttack?.('staff_cast', { dur: 0.52 });
        if (world?.fx?.emit) {
          world.fx.emit('fx_star', local.x, 1.0, local.z, kind === 'harvest' ? 10 : 6, {
            speed: 0.9,
            up: 1.15,
            size: 0.22,
            life: 0.5,
          });
        }
      }
    } catch {
      // ignore
    }
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      if (!this._audioCtx) this._audioCtx = new AudioCtx();
      if (this._audioCtx.state === 'suspended') this._audioCtx.resume();
      const ctx = this._audioCtx;
      const now = ctx.currentTime;
      const notes =
        kind === 'plant'
          ? [392.0, 523.25]
          : kind === 'collect'
          ? [523.25, 659.25, 783.99]
          : [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.055);
        gain.gain.setValueAtTime(0.11, now + idx * 0.055);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.055 + 0.22);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.055);
        osc.stop(now + idx * 0.055 + 0.22);
      });
    } catch {
      // ignore WebAudio restrictions
    }
  }

  spawnLootBurst(items = {}, extraPills = [], buildingUid = null) {
    if (typeof document === 'undefined') return;
    if (buildingUid) {
      try {
        window.__neora?.world?.plaza?.celebrateBuildingHarvest?.(buildingUid);
      } catch {
        // ignore
      }
    }
    const pills = [];
    for (const [k, n] of Object.entries(items || {})) {
      if (n > 0) pills.push(`${matOf(k).emoji} +${fmtN(n)}`);
    }
    for (const ep of extraPills || []) {
      if (ep) pills.push(ep);
    }
    if (!pills.length) return;
    const cx = window.innerWidth * 0.5;
    const cy = window.innerHeight * (this.isOpen() ? 0.54 : 0.62);
    pills.slice(0, 6).forEach((text, i) => {
      const el = document.createElement('div');
      el.className = 'bc-loot-pop';
      el.textContent = text;
      const spread = (i - (Math.min(pills.length, 6) - 1) / 2) * 54;
      const jitterX = (Math.random() - 0.5) * 20;
      el.style.left = `${cx + spread * 0.35}px`;
      el.style.top = `${cy}px`;
      el.style.setProperty('--dx', `${Math.round(spread + jitterX)}px`);
      el.style.setProperty('--dy', `${Math.round(-95 - i * 14 - Math.random() * 20)}px`);
      el.style.animationDelay = `${i * 55}ms`;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 1200 + i * 60);
    });
  }

  async collectAllReady(p = this._p()) {
    const { readyPlotUids, readyProdUids } = this.getReadySummary(p);
    const totalItems = {};
    const tools = [];
    let replantedCount = 0;
    for (const uid of readyPlotUids) {
      const crop = p?.village?.plots?.[uid]?.crop || this._lastCropByUid.get(uid) || 'sky_wheat';
      if (crop) this._lastCropByUid.set(uid, crop);
      const r = await this._req('bc_harvest_plot', { uid }, '🌾');
      if (r.ok) {
        try { window.__neora?.world?.plaza?.celebrateBuildingHarvest?.(uid); } catch {}
        for (const [k, n] of Object.entries(r.items || {})) totalItems[k] = (totalItems[k] || 0) + n;
        if (crop && CROPS[crop]) {
          const pl = await this._req('bc_plant', { uid, crop }, '🌱');
          if (pl.ok) replantedCount += 1;
        }
      }
    }
    for (const uid of readyProdUids) {
      const r = await this._req('bc_collect', { uid }, '📦');
      if (r.ok) {
        try { window.__neora?.world?.plaza?.celebrateBuildingHarvest?.(uid); } catch {}
        for (const [k, n] of Object.entries(r.collected || {})) totalItems[k] = (totalItems[k] || 0) + n;
        for (const t of r.tools || []) tools.push(`${TOOL_ICON[t.kind] || '🛠️'} ${t.kind} T${t.tier}`);
      }
    }
    const bits = [itemsLine(totalItems), ...tools].filter(Boolean);
    if (bits.length) {
      this.playPopSfx('harvest');
      this.spawnLootBurst(totalItems, tools);
      const replantSuffix = replantedCount > 0 ? ` & auto-replanted ${replantedCount} plot${replantedCount > 1 ? 's' : ''} 🌱` : '';
      this.toast(`✨ Collected ${bits.join(' ')}${replantSuffix}!`, 2800);
    }
  }

  // ---------------------------------------------------------------------------------- 1. Story
  getQuestGuide(p = this._p()) {
    const story = this._story(p);
    const v = p?.village || {};
    const ch = CHAPTERS.find((c) => c.id === story.chapter) || null;
    if (!ch) return { active: false, complete: false, chapter: null };
    const steps = currentSteps(story);
    const complete = steps.length > 0 && steps.every((s) => s.done);
    if (complete) {
      return {
        active: true,
        complete: true,
        chapter: ch,
        text: `🎉 Ch.${ch.id + 1}: "${ch.title}" Ready! Claim Rewards`,
        cta: 'Claim 🎁',
        frontierText: `🎉 Ch.${ch.id + 1}: ${ch.title} Complete! Tap to Claim 🎁`,
        run: () => this.open('story'),
      };
    }
    const placedCounts = {};
    for (const b of v.buildings || []) placedCounts[b.type] = (placedCounts[b.type] || 0) + 1;
    const unplacedBuildStep = steps.find(
      (s) => !s.done && s.kind === 'build' && (v.copies?.[s.target] || 0) > (placedCounts[s.target] || 0)
    );
    if (unplacedBuildStep) {
      const bName = coreOf(unplacedBuildStep.target).name;
      return {
        active: true,
        complete: false,
        chapter: ch,
        text: `📦 Place ${bName} on your Island!`,
        cta: 'Place 🛠️',
        frontierText: `🏠 Return to Village to place ${bName}`,
        run: () => this._runStepAction(unplacedBuildStep, p),
      };
    }
    // Prioritize any incomplete step whose craft/harvest output is ready to collect right now!
    const readyStep = steps.find((s) => !s.done && this._stepActionMeta(s, p).ready);
    const nextStep = readyStep || steps.find((s) => !s.done) || steps[0];
    const shortBits = steps.map((s) => {
      const ico = s.done ? '✅' : (s.kind === 'gather' ? matOf(s.target).emoji : STEP_ICON[s.kind] || '•');
      const lbl = s.kind === 'gather' ? matOf(s.target).name : s.text.replace(/^Visit (the )?|^Build |^Craft |^Harvest |^Defeat /, '').replace(/\s*\(.*\)$/, '');
      return `${ico} ${lbl} ${s.have}/${s.count}`;
    });
    const frontierText = `📜 Ch.${ch.id + 1}: ${shortBits.join(' · ')}`;
    const actMeta = this._stepActionMeta(nextStep, p);
    return {
      active: true,
      complete: !!actMeta.ready,
      chapter: ch,
      text: `📜 Ch.${ch.id + 1}: ${actMeta.bannerText}`,
      cta: actMeta.ctaLabel,
      frontierText,
      run: () => this._runStepAction(nextStep, p),
    };
  }

  _stepActionMeta(s, p = this._p()) {
    const v = p?.village || {};
    const now = this.now();
    const placedCounts = {};
    for (const b of v.buildings || []) placedCounts[b.type] = (placedCounts[b.type] || 0) + 1;
    const inFrontier = typeof document !== 'undefined' && document.getElementById('hud')?.dataset.scene === 'SKY_FRONTIER';
    if (s.kind === 'build') {
      const unplaced = (v.copies?.[s.target] || 0) > (placedCounts[s.target] || 0);
      const bName = coreOf(s.target).name;
      if (unplaced) {
        return { btnLabel: '🛠️ Place', ctaLabel: 'Place 🛠️', bannerText: `Place ${bName} from Bag`, note: '📦 Constructed in Bag — tap Place to drop it on your island!' };
      }
      return { btnLabel: '🔨 Build', ctaLabel: 'Build 🔨', bannerText: `Build ${bName} (${s.have}/${s.count})`, note: null };
    }
    if (s.kind === 'craft') {
      const rc = Object.values(RECIPES).find((r) => r.outputs?.[s.target]);
      const bType = rc?.building;
      const placedBlds = bType ? (v.buildings || []).filter((b) => b.type === bType) : [];
      const placedBld = placedBlds[0] || null;
      const unplacedBld = bType && !placedBld && (v.copies?.[bType] || 0) > 0;
      const readyBld = placedBlds.find((b) => this._buildingProductionReady(v.production?.[b.uid], now));
      const workingBld = !readyBld && placedBlds.find((b) => (v.production?.[b.uid]?.queue || []).some((j) => Number(j?.doneAt || 0) > now));
      if (readyBld) {
        return {
          btnLabel: '📦 Collect',
          ctaLabel: 'Collect 📦',
          bannerText: `Collect ${matOf(s.target).name}! (${s.have}/${s.count})`,
          note: `✨ ${matOf(s.target).name} is ready at ${coreOf(bType).name} — tap to collect!`,
          ready: true,
        };
      }
      if (workingBld) {
        return {
          btnLabel: '⏳ View',
          ctaLabel: 'Check ⏳',
          bannerText: `Making ${matOf(s.target).name}… (${s.have}/${s.count})`,
          note: `⏳ Crafting at ${coreOf(bType).name} — tap to view progress or queue more!`,
        };
      }
      return {
        btnLabel: placedBld ? '⚒️ Craft' : unplacedBld ? '🛠️ Place' : '🔨 Build',
        ctaLabel: placedBld ? 'Craft ⚒️' : unplacedBld ? 'Place 🛠️' : 'Build 🔨',
        bannerText: `${s.text} (${s.have}/${s.count})`,
        note: null,
      };
    }
    if (s.kind === 'harvest') {
      const plots = (v.buildings || []).filter((b) => b.type === 'farm_plot');
      const readyPlot = plots.find((b) => {
        const pl = v.plots?.[b.uid];
        return pl?.crop && Number(pl.readyAt || 0) <= now;
      });
      const growingPlot = !readyPlot && plots.find((b) => {
        const pl = v.plots?.[b.uid];
        return pl?.crop && Number(pl.readyAt || 0) > now;
      });
      if (readyPlot) {
        return {
          btnLabel: '🌾 Harvest',
          ctaLabel: 'Harvest 🌾',
          bannerText: `Harvest ${matOf(s.target).name}! (${s.have}/${s.count})`,
          note: '✨ Crop is ripe on your Farm Plot — tap to harvest & replant!',
          ready: true,
        };
      }
      if (growingPlot) {
        return {
          btnLabel: '⏳ Farm',
          ctaLabel: 'Farm ⏳',
          bannerText: `Growing ${matOf(s.target).name}… (${s.have}/${s.count})`,
          note: '🌱 Growing on your Farm Plot — tap to check timer!',
        };
      }
      return { btnLabel: '🌾 Farm', ctaLabel: 'Farm 🌾', bannerText: `${s.text} (${s.have}/${s.count})`, note: null };
    }
    if (s.kind === 'deliver_orders') {
      return { btnLabel: '📋 Orders', ctaLabel: 'Orders 📋', bannerText: `${s.text} (${s.have}/${s.count})`, note: null };
    }
    if (s.kind === 'visit') {
      return { btnLabel: inFrontier ? '🧭 Hint' : '🏝️ Go', ctaLabel: 'Explore 🏝️', bannerText: s.text.replace(/\s*\(.*\)$/, ''), note: null };
    }
    if (s.kind === 'defeat') {
      return { btnLabel: inFrontier ? '⚔️ Hint' : '⚔️ Go', ctaLabel: 'Battle ⚔️', bannerText: s.text, note: null };
    }
    return { btnLabel: inFrontier ? '🏝️ Hint' : '🏝️ Go', ctaLabel: 'Gather 🏝️', bannerText: `${s.text} (${s.have}/${s.count})`, note: null };
  }

  _frontierStepCompass(s) {
    if (!s) return '🧭 Explore the Sky Frontier!';
    if (s.target === 'outpost') return '🗽 Walk to the Goddess Outpost statue at the center of camp (0, 4)!';
    if (s.target === 'wheat' || s.target === 'sky_wheat') return '🌾 Head South-East (20, 12) to the Overgrown Windmill Ruins & Wheat Field!';
    if (s.target === 'gate_hollow') return '🌀 Head North (0, -32) to the swirling Sky Mist Gate!';
    if (s.target === 'crystal_ore') return '💎 Step through the North Sky Mist Gate (0, -32) into Crystal Hollow to mine Crystal Ore!';
    if (s.target === 'elder_moss_golem') return '⚔️ Head North-West (-20, -18) in Whispering Meadow to summon & defeat the Elder Moss Golem!';
    return `🏝️ Strike ${matOf(s.target).name} nodes in the Sky Frontier — hit the golden rhythm ring for Rare+ bonus drops!`;
  }

  _runStepAction(s, p = this._p()) {
    if (!s) return;
    const v = p?.village || {};
    const now = this.now();
    const inFrontier = typeof document !== 'undefined' && document.getElementById('hud')?.dataset.scene === 'SKY_FRONTIER';
    if (s.kind === 'gather' || s.kind === 'visit' || s.kind === 'defeat') {
      this.close();
      const hollowUnlocked = Boolean(
        p?.frontier?.unlocks?.regions?.includes('hollow')
        || p?.frontier?.unlocks?.gates?.includes('hollow')
        || (p?.story?.chapter || 0) >= 2
        || p?.story?.completed?.includes?.(1)
      );
      if (!inFrontier && this.onEnterFrontier) {
        const wantHollow = s.target === 'crystal_ore' && hollowUnlocked;
        this.onEnterFrontier(wantHollow ? 'hollow' : null);
        setTimeout(() => {
          this.toast(
            wantHollow
              ? '💎 Warped to Crystal Hollow — strike glowing Crystal Ore veins!'
              : this._frontierStepCompass(s),
            3600
          );
        }, 450);
        return;
      }
      if (inFrontier && typeof window !== 'undefined') {
        const curRegion = window.__neora?.world?.frontierScene?.layout?.regionId || 'meadow';
        if (curRegion === 'meadow' && (s.target === 'gate_hollow' || s.target === 'crystal_ore')) {
          window.__neora?.world?.walkTo?.(0, -32);
        } else if (curRegion === 'meadow' && s.target === 'outpost') {
          window.__neora?.world?.walkTo?.(0, 4);
        } else if (curRegion === 'meadow' && (s.target === 'wheat' || s.target === 'sky_wheat')) {
          window.__neora?.world?.walkTo?.(20, 12);
        }
      }
      this.toast(this._frontierStepCompass(s), 3400);
      return;
    }
    if (s.kind === 'build') {
      const placed = (v.buildings || []).filter((b) => b.type === s.target).length;
      if ((v.copies?.[s.target] || 0) > placed && this.onEnterEdit) {
        this.close();
        this.onEnterEdit(s.target);
        return;
      }
      this.open('build');
      return;
    }
    if (s.kind === 'craft') {
      const rc = Object.values(RECIPES).find((r) => r.outputs?.[s.target]);
      const bType = rc?.building;
      const placedBlds = bType ? (v.buildings || []).filter((b) => b.type === bType) : [];
      const readyBld = placedBlds.find((b) => this._buildingProductionReady(v.production?.[b.uid], now));
      const targetBld = readyBld || placedBlds[0] || null;
      if (targetBld) {
        this.openBuilding({ owner: p.id, uid: targetBld.uid, type: targetBld.type, village: v });
        return;
      }
      if (bType && (v.copies?.[bType] || 0) > 0 && this.onEnterEdit) {
        this.close();
        this.onEnterEdit(bType);
        return;
      }
      this.open('build');
      return;
    }
    if (s.kind === 'harvest') {
      const plots = (v.buildings || []).filter((b) => b.type === 'farm_plot');
      const readyPlot = plots.find((b) => {
        const pl = v.plots?.[b.uid];
        return pl?.crop && Number(pl.readyAt || 0) <= now;
      });
      const emptyPlot = plots.find((b) => !v.plots?.[b.uid]?.crop);
      const plot = readyPlot || emptyPlot || plots[0] || null;
      if (plot) {
        this.openBuilding({ owner: p.id, uid: plot.uid, type: 'farm_plot', village: v });
        return;
      }
      if ((v.copies?.farm_plot || 0) > 0 && this.onEnterEdit) {
        this.close();
        this.onEnterEdit('farm_plot');
        return;
      }
      this.open('build');
      return;
    }
    if (s.kind === 'deliver_orders') {
      this._onHudButton('orders');
    }
  }

  _viewStory(p) {
    const story = this._story(p);
    const idx = CHAPTERS.findIndex((c) => c.id === story.chapter);
    const ch = idx >= 0 ? CHAPTERS[idx] : null;
    let body = '';
    let foot = '';
    if (!ch) {
      body = `<div class="bc-note good">🌟 Every chapter of the Base Camp story is complete. More chapters are on the way!</div>`;
      return { title: '📜 Story Board', body, foot: '' };
    }
    const steps = currentSteps(story);
    const complete = steps.length > 0 && steps.every((s) => s.done);
    const doneN = steps.filter((s) => s.done).length;
    body += `<div class="bc-sec">Chapter ${ch.id + 1} · ${esc(ch.title)}<small>${doneN}/${steps.length} steps</small></div>`;
    body += '<div class="bc-steps">';
    for (const s of steps) {
      const pct = Math.min(100, Math.round((s.have / Math.max(1, s.count)) * 100));
      const actMeta = !s.done ? this._stepActionMeta(s, p) : null;
      body += `<div class="bc-card${s.done ? ' bc-done' : ''}"><div class="bc-row">
        <span class="bc-check">${s.done ? '✅' : STEP_ICON[s.kind] || '•'}</span>
        <div class="bc-grow"><div class="bc-title">${esc(s.text)}</div>
        ${actMeta?.note ? `<div class="bc-sub" style="color:#2f5a1a;font-weight:800;">${esc(actMeta.note)}</div>` : ''}
        <div class="bc-bar${s.done ? ' ok' : ''}"><i style="width:${pct}%"></i><b>${fmtN(s.have)} / ${fmtN(s.count)}${s.done ? ' ✓' : ''}</b></div></div>
        ${actMeta ? `<button type="button" class="bc-btn" style="padding:5px 9px;font-size:11px;" ${this._act(() => this._runStepAction(s, p))}>${actMeta.btnLabel}</button>` : ''}
      </div></div>`;
    }
    body += '</div>';
    body += `<div class="bc-sec">🎁 Chapter Rewards</div><div class="bc-chips">${this._rewardChips(ch)}</div>`;
    const next = CHAPTERS[idx + 1];
    if (next) {
      body += `<div class="bc-sec">🔒 Next · Chapter ${next.id + 1}: ${esc(next.title)}</div>
        <div class="bc-card bc-dim"><div class="bc-sub">${next.steps.length} steps · unlocks ${esc((next.rewards.unlockBuildings || []).map((b) => coreOf(b).name).join(', ') || 'new adventures')}</div></div>`;
    }
    const hint = steps.find((s) => !s.done);
    if (hint) body += `<div class="bc-note">${this._stepHint(hint)}</div>`;
    foot = `<button type="button" class="bc-btn green" ${complete ? '' : 'disabled'} ${this._act(() => this._claimStory(ch))}>${complete ? '🎉 Claim Chapter Rewards' : `⏳ ${doneN}/${steps.length} steps done`}</button>`;
    return { title: '📜 Story Board', body, foot };
  }

  _rewardChips(ch) {
    const rw = ch.rewards || {};
    const chips = [];
    if (rw.gold) chips.push(`<span class="bc-chip brass">🪙 ${fmtN(rw.gold)}</span>`);
    for (const b of rw.unlockBuildings || []) if (b !== 'castle') chips.push(`<span class="bc-chip">${coreOf(b).emoji} ${esc(coreOf(b).name)}</span>`);
    for (const r of rw.unlockRegions || []) chips.push(`<span class="bc-chip">🗺️ ${esc(r)}</span>`);
    for (const r of rw.residents || []) chips.push(`<span class="bc-chip">🧑‍🌾 ${esc(RESIDENT_NAME[r] || r)}</span>`);
    if (rw.expandTo) chips.push(`<span class="bc-chip">🏝️ Island ${rw.expandTo}×${rw.expandTo}</span>`);
    for (const [k, n] of Object.entries(rw.items || {})) chips.push(`<span class="bc-chip">${matOf(k).emoji} ×${n}</span>`);
    return chips.join('') || '<span class="bc-chip">✨ Story progress</span>';
  }

  _stepHint(s) {
    switch (s.kind) {
      case 'gather': return `🏝️ Gather <b>${esc(matOf(s.target).name)}</b> out in the Sky Frontier.`;
      case 'visit': return '🧭 Explore the Sky Frontier to find this place.';
      case 'build': return `🔨 Construct a <b>${esc(coreOf(s.target).name)}</b> in the Build menu, then place it with 🛠️ Edit Grid.`;
      case 'craft': return `⚒️ Queue <b>${esc(matOf(s.target).name)}</b> in a production building and collect it.`;
      case 'deliver_orders': return '📋 Fill orders on the Order Board.';
      case 'harvest': return `🌾 Plant and harvest <b>${esc(matOf(s.target).name)}</b> on a Farm Plot.`;
      case 'defeat': return '⚔️ Defeat the guardian out in the Sky Frontier.';
      default: return '✨ Keep exploring!';
    }
  }

  async _claimStory(ch) {
    const r = await this._req('bc_story_claim', {}, '📜');
    if (!r.ok) return;
    this.playPopSfx('harvest');
    const bits = [];
    const extraPills = [];
    if (r.gold) {
      bits.push(`+${fmtN(r.gold)} 🪙`);
      extraPills.push(`🪙 +${fmtN(r.gold)}`);
    }
    const itemTxt = itemsLine(r.items);
    if (itemTxt) bits.push(itemTxt);
    const unlocked = (r.unlockBuildings || []).filter((b) => b !== 'castle').map((b) => `${coreOf(b).emoji} ${coreOf(b).name}`);
    if (unlocked.length) bits.push(`Unlocked ${unlocked.join(', ')}`);
    this.spawnLootBurst(r.items || {}, extraPills);
    this.toast(`🎉 Chapter "${ch.title}" complete! ${bits.join(' • ')}`, 4200);
  }

  // ---------------------------------------------------------------------------------- 2. Build
  /** Build panel = 4 tabs: Build · Craft (camp props + cosmetic decor) · Residents · Monuments. */
  _viewBuild(p) {
    const tab = this.view?.tab || 'build';
    const tabs = [['build', '🔨 Build'], ['craft', '🪵 Craft'], ['residents', '🧑‍🌾 Residents'], ['monuments', '🏛️ Monuments']];
    const bar = `<div class="bc-tabs">${tabs.map(([k, label]) => `<button type="button" class="bc-tab${k === tab ? ' on' : ''}" ${this._act(() => this._setBuildTab(k))}>${label}</button>`).join('')}</div>`;
    let out;
    if (tab === 'craft') out = this._viewCraft(p);
    else if (tab === 'residents') out = this._viewResidents(p);
    else if (tab === 'monuments') out = this._viewMonuments(p);
    else out = this._viewBuildCore(p);
    return { ...out, body: bar + out.body };
  }

  _setBuildTab(tab) {
    if (!this.view) return;
    this.view.tab = tab;
    this.render();
    // read-only loads run the server's lazy tick (residents eat, camp props accrue) → fresh profile push
    if (tab === 'residents') this.request?.('bc_residents', {});
    else if (tab === 'monuments' || tab === 'craft') this.request?.('bc_monuments', {});
  }

  _viewBuildCore(p) {
    const v = p?.village || {};
    const story = this._story(p);
    const unlocked = unlockedForVillage(story, v);
    const copies = v.copies || {};
    const placed = {};
    for (const b of v.buildings || []) placed[b.type] = (placed[b.type] || 0) + 1;
    let body = '';
    if (this.justBuilt) {
      const builtType = this.justBuilt;
      const d = coreOf(builtType);
      body += `<div class="bc-note good">✅ ${d.emoji} <b>${esc(d.name)}</b> is ready in your Bag. Open <b>🛠️ Edit Grid</b> and place it from the Bag tab.
        ${this.onEnterEdit ? `<div style="margin-top:6px"><button type="button" class="bc-btn green" ${this._act(() => { this.close(); this.onEnterEdit(builtType); })}>🛠️ Place it now</button></div>` : ''}</div>`;
    }
    // Castle (Starlight Keep)
    const cLv = v.castle_lv || 1;
    const cCap = castleLevelCap(story);
    const cCost = upgradeCost('castle', cLv);
    body += `<div class="bc-sec">🏰 Starlight Keep<small>Lv. ${cLv} · Story cap Lv. ${cCap}</small></div>
      <div class="bc-card"><div class="bc-row"><span class="bc-big-ico">🏰</span><div class="bc-grow">
        <div class="bc-title">${esc(coreOf('castle').name)}${v.castle_ruins ? ' <span class="bc-tag">Ruins</span>' : ''}</div>
        <div class="bc-sub">${v.castle_ruins ? 'Finish Chapter 1 (Landfall) to clear the rubble.' : cLv >= MAX_CORE_LV ? `👑 Max level · ${plotCap(cLv)} farm plots` : `Upgrade to Lv. ${cLv + 1} — more farm plots (${plotCap(cLv)} → ${plotCap(cLv + 1)})`}</div>
        ${cLv < MAX_CORE_LV ? `<div class="bc-chips">${this._costChips(cCost, p)}</div>` : ''}
      </div>
      ${cLv >= MAX_CORE_LV ? '<span class="bc-tag">MAX</span>'
        : `<button type="button" class="bc-btn" ${cLv + 1 > cCap || !this._canAfford(cCost, p) ? 'disabled' : ''} ${this._act(() => this._upgrade('castle'))}>${cLv + 1 > cCap ? '🔒 Story' : '⬆️ Upgrade'}</button>`}
      </div></div>`;

    body += '<div class="bc-sec">🔨 Buildings</div>';
    const types = unlocked.filter((t) => t !== 'castle' && CORE[t]);
    if (!types.length) body += '<div class="bc-note">Complete the first 📜 Story chapter to unlock your first buildings.</div>';
    for (const type of types) {
      const d = coreOf(type);
      const have = copies[type] | 0;
      const cap = type === 'farm_plot' ? plotCap(v.castle_lv) : maxCopies(v, type);
      const cost = buildCost(type, have);
      const full = have >= cap;
      const lv = v.levels?.[type] || 1;
      const prod = PRODUCTION_BUILDINGS[type];
      const sub = prod ? `Makes ${prod.map((id) => recipeIcon(RECIPES[id])).join(' ')}` : type === 'farm_plot' ? 'Grow crops for your kitchen' : type === 'tent' ? 'Rest spot for your camp' : '';
      body += `<div class="bc-card"><div class="bc-row"><span class="bc-big-ico">${d.emoji}</span><div class="bc-grow">
          <div class="bc-title">${esc(d.name)}</div>
          <div class="bc-sub">Owned ${have}/${cap} · placed ${placed[type] || 0}${have ? ` · Lv. ${lv}` : ''}${sub ? ` · ${sub}` : ''}</div>
          ${full ? '' : `<div class="bc-chips">${this._costChips(cost, p)}</div>`}
        </div>
        <button type="button" class="bc-btn green" ${full || !this._canAfford(cost, p) ? 'disabled' : ''} ${this._act(() => this._construct(type))}>${full ? 'Max' : have ? '+ Copy' : 'Construct'}</button>
      </div>`;
      if (have > (placed[type] || 0) && this.onEnterEdit) {
        const unplacedCnt = have - (placed[type] || 0);
        body += `<div class="bc-row" style="margin-top:6px"><div class="bc-grow"><div class="bc-sub" style="color:#2f5a1a;font-weight:800;">📦 ${unplacedCnt} unplaced in Bag — place on your island to activate!</div></div>
          <button type="button" class="bc-btn green" ${this._act(() => { this.close(); this.onEnterEdit(type); })}>🛠️ Place</button></div>`;
      }
      if ((placed[type] || 0) > 0 && this.handles(type)) {
        const now = this.now();
        const placedList = (v.buildings || []).filter((b) => b.type === type);
        if (type === 'farm_plot') {
          const readyPlot = placedList.find((b) => v.plots?.[b.uid]?.crop && Number(v.plots[b.uid].readyAt || 0) <= now);
          const emptyPlot = placedList.find((b) => !v.plots?.[b.uid]?.crop);
          const targetPlot = readyPlot || emptyPlot || placedList[0];
          const statusTxt = readyPlot ? '🌾 Crops ready to harvest!' : emptyPlot ? '🌱 Empty plot ready to plant' : '⏳ Crops growing on your island';
          body += `<div class="bc-row" style="margin-top:6px"><div class="bc-grow"><div class="bc-sub" style="font-weight:800;color:${readyPlot ? '#2f5a1a' : '#6e4c26'};">${statusTxt}</div></div>
            <button type="button" class="bc-btn ${readyPlot ? 'green' : ''}" ${this._act(() => this.openBuilding({ owner: p.id, uid: targetPlot.uid, type: 'farm_plot', village: v }))}>${readyPlot ? '🌾 Harvest / Replant' : '🌱 Open Farm'}</button></div>`;
        } else {
          const readyBld = placedList.find((b) => this._buildingProductionReady(v.production?.[b.uid], now));
          const workingBld = !readyBld && placedList.find((b) => (v.production?.[b.uid]?.queue || []).some((j) => Number(j?.doneAt || 0) > now));
          const targetBld = readyBld || workingBld || placedList[0];
          const statusTxt = readyBld ? '✨ Finished goods ready to collect!' : workingBld ? '⏳ Production in progress' : '⚒️ Ready to queue recipes';
          body += `<div class="bc-row" style="margin-top:6px"><div class="bc-grow"><div class="bc-sub" style="font-weight:800;color:${readyBld ? '#2f5a1a' : '#6e4c26'};">${statusTxt}</div></div>
            <button type="button" class="bc-btn ${readyBld ? 'green' : ''}" ${this._act(() => this.openBuilding({ owner: p.id, uid: targetBld.uid, type, village: v }))}>${readyBld ? '📦 Collect / Restart' : '⚒️ Open & Produce'}</button></div>`;
        }
      }
      if (have > 0 && type !== 'farm_plot' && type !== 'tent') {
        const uc = upgradeCost(type, lv);
        body += lv >= MAX_CORE_LV
          ? '<div class="bc-sub" style="margin-top:5px">👑 Max level</div>'
          : `<div class="bc-row" style="margin-top:6px"><div class="bc-grow"><div class="bc-sub">⬆️ Lv. ${lv} → ${lv + 1}${prod ? ` · queue ${queueSlots(lv)} → ${queueSlots(lv + 1)}` : ''}</div><div class="bc-chips">${this._costChips(uc, p)}</div></div>
             <button type="button" class="bc-btn" ${this._canAfford(uc, p) ? '' : 'disabled'} ${this._act(() => this._upgrade(type))}>Upgrade</button></div>`;
      }
      body += '</div>';
    }
    // Locked preview (next chapter)
    const next = CHAPTERS.find((c) => c.id === story.chapter);
    const lockedNext = (next?.rewards?.unlockBuildings || []).filter((t) => !unlocked.includes(t) && CORE[t]);
    if (lockedNext.length) {
      body += `<div class="bc-sec">🔒 Unlocks with Chapter ${next.id + 1}: ${esc(next.title)}</div>`;
      for (const t of lockedNext) {
        body += `<div class="bc-card bc-dim"><div class="bc-row"><span class="bc-big-ico">${coreOf(t).emoji}</span><div class="bc-grow"><div class="bc-title">${esc(coreOf(t).name)}</div><div class="bc-chips">${this._costChips(buildCost(t, 0), p)}</div></div><span class="bc-tag">🔒</span></div></div>`;
      }
    }
    body += '<div class="bc-note">New buildings go to your Bag — place them with <b>🛠️ Edit Grid</b>.</div>';
    const foot = this.onEnterEdit ? `<button type="button" class="bc-btn plain" ${this._act(() => { this.close(); this.onEnterEdit(); })}>🛠️ Open Grid Editor</button>` : '';
    return { title: '🔨 Build', body, foot };
  }

  async _construct(type) {
    const r = await this._req('bc_construct', { building: type }, '🔨');
    if (!r.ok) return r;
    this.justBuilt = type;
    this.toast(`🔨 ${coreOf(type).emoji} ${coreOf(type).name} built! Place it from your Bag with 🛠️ Edit Grid.`, 3400);
    this.render({ keepScroll: false });
    return r;
  }

  async _upgrade(type) {
    const r = await this._req('bc_upgrade', { building: type }, '⬆️');
    if (!r.ok) return r;
    this.toast(`⬆️ ${coreOf(type).emoji} ${coreOf(type).name} is now Lv. ${r.lv}!`, 2800);
    return r;
  }

  // ---------------------------------------------------------------------------------- 3/4. Placed buildings
  /** Should main.js route a tap on this placed building type to Base Camp? */
  handles(type) { return !!PRODUCTION_BUILDINGS[type] || !!EXTRA_BUILDINGS[type] || type === 'farm_plot'; }

  /**
   * Open the production / farm-plot sheet for a placed building.
   * @param {{owner:string, uid:string, type:string, village?:object}} pick  `village` = the owner's
   *        village when it isn't mine (from the instance layout; publicVillage carries production/plots).
   */
  openBuilding(pick) {
    if (!pick?.uid || !this.handles(pick.type)) return false;
    this.open(pick.type === 'farm_plot' ? 'plot' : 'production', { owner: pick.owner, uid: pick.uid, type: pick.type, village: pick.village || null });
    return true;
  }

  _villageFor(view, p) {
    if (view.owner && p && view.owner === p.id) return p.village || {};
    return view.village || {};
  }

  _viewProduction(p) {
    const view = this.view;
    const mine = !!p && view.owner === p.id;
    const v = this._villageFor(view, p);
    const d = placeDef(view.type);
    const lv = EXTRA_BUILDINGS[view.type] ? (v.wonders?.[view.type]?.stars || 1) : (v.levels?.[view.type] || 1);
    const slots = queueSlots(lv);
    const st = v.production?.[view.uid] || { queue: [], output: {}, tools: [] };
    const now = this.now();
    const ready = { ...(st.output || {}) };
    const readyTools = [...(st.tools || [])];
    const running = [];
    let finishedRecipeId = null;
    for (const job of st.queue || []) {
      const rc = recipeOf(job.recipe);
      if (job.doneAt <= now) {
        finishedRecipeId = job.recipe;
        if (rc?.tool) readyTools.push(rc.tool);
        else for (const [k, n] of Object.entries(rc?.outputs || {})) ready[k] = (ready[k] || 0) + n;
      } else running.push(job);
    }
    if (finishedRecipeId) this._lastRecipeByUid.set(view.uid, finishedRecipeId);
    else if (running.length) this._lastRecipeByUid.set(view.uid, running[running.length - 1].recipe);
    const allRecipes = recipesFor(view.type);
    const lastRecipeId = this._lastRecipeByUid.get(view.uid) || finishedRecipeId || (running[0]?.recipe) || allRecipes[0] || null;
    const lastRc = lastRecipeId ? recipeOf(lastRecipeId) : null;
    const canRestartLast = !!(mine && lastRc && lv >= (lastRc.minLv || 1) && this._canAfford(lastRc.inputs, p));

    const used = (st.queue || []).length;
    const anyReady = Object.values(ready).some((n) => n > 0) || readyTools.length > 0;
    const canFreeSlotByCollect = anyReady && running.length < slots;

    let body = '';
    if (mine) {
      const prodPlaced = (v.buildings || []).filter((b) => this.handles(b.type));
      if (prodPlaced.length > 1) {
        const shortNames = {
          farm_plot: 'Farm',
          windmill_bakery: 'Windmill',
          patisserie: 'Patisserie',
          mint: 'Mint',
          workshop: 'Workshop',
          flower_greenhouse: 'Greenhouse',
          onsen: 'Onsen',
          ferris_wheel: 'Ferris',
        };
        let plotIdx = 0;
        body += `<div class="bc-tabs" style="margin-bottom:8px;flex-wrap:wrap">${prodPlaced.map((b) => {
          const bd = placeDef(b.type);
          if (b.type === 'farm_plot') plotIdx++;
          const label = b.type === 'farm_plot' ? `Plot ${plotIdx}` : (shortNames[b.type] || bd.name);
          const isCur = b.uid === view.uid;
          const bReady = b.type === 'farm_plot'
            ? (v.plots?.[b.uid]?.crop && Number(v.plots[b.uid].readyAt || 0) <= now)
            : this._buildingProductionReady(v.production?.[b.uid], now);
          return `<button type="button" class="bc-tab${isCur ? ' on' : ''}" style="flex:0 1 auto;padding:5px 8px" ${this._act(() => this.openBuilding({ owner: p.id, uid: b.uid, type: b.type, village: v }))}>${bd.emoji} ${esc(label)}${bReady ? ' ✨' : ''}</button>`;
        }).join('')}</div>`;
      }
    }

    body += `<div class="bc-card"><div class="bc-row"><span class="bc-big-ico">${d.emoji}</span><div class="bc-grow">
      <div class="bc-title">${esc(d.name)} <span class="bc-tag">Lv. ${lv}</span></div>
      <div class="bc-sub">${mine ? 'Queue goods from your Warehouse & Pantry materials.' : `🏝️ ${esc(view.owner)}'s workshop`}</div></div></div></div>`;

    // Ready output with prominent inline Collect + Collect & Restart buttons
    body += `<div class="bc-sec">📦 Ready to collect</div>`;
    if (anyReady) {
      body += `<div class="bc-card bc-done">
        <div class="bc-title" style="color:#2f5a1a">✨ Production Complete!</div>
        <div class="bc-chips" style="margin-top:4px">${Object.entries(ready).filter(([, n]) => n > 0).map(([k, n]) => `<button type="button" class="bc-chip bc-chip-item ok" data-bc-item="${esc(k)}">${matOf(k).emoji} ${esc(matOf(k).name)} ×${n} <i class="bc-chip-q">ⓘ</i></button>`).join('')}${readyTools.map((t) => `<span class="bc-chip ok">${TOOL_ICON[t.kind] || '🛠️'} ${esc(t.kind)} T${t.tier}</span>`).join('')}</div>
        ${mine ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">
          <button type="button" class="bc-btn green" style="flex:1" ${this._act(() => this._collect(view.uid))}>📦 Collect Now</button>
          ${lastRc && lv >= (lastRc.minLv || 1) ? `<button type="button" class="bc-btn" style="flex:1" ${canRestartLast ? '' : 'disabled'} title="${canRestartLast ? `Collect and immediately queue ${recipeName(lastRc)}` : 'Need more ingredients to restart'}" ${this._act(() => this._collectAndRestart(view.uid, lastRecipeId))}>🔄 Collect &amp; Restart ${recipeIcon(lastRc)}</button>` : ''}
        </div>` : ''}
      </div>`;
    } else body += '<div class="bc-sub">Nothing waiting yet — tap <b>Queue</b> on a recipe below to start producing!</div>';

    // Queue
    body += `<div class="bc-sec">⏳ Queue<small>${used}/${slots} slots</small></div>`;
    if (running.length) {
      for (const job of running) {
        const rc = recipeOf(job.recipe) || { outputs: {} };
        const started = job.startAt <= now;
        body += `<div class="bc-card"><div class="bc-row"><span class="bc-big-ico" style="font-size:20px">${recipeIcon(rc)}</span><div class="bc-grow">
          <div class="bc-title">${esc(recipeName(rc))}</div>${started ? this._bar(job.startAt, job.doneAt, '') : `<div class="bc-sub" data-until="${job.startAt}" data-label="Starts in">Starts in ${fmtDur(job.startAt - now)}</div>`}
        </div></div></div>`;
        if (!started) this._edgeAt = Math.min(this._edgeAt, job.startAt);
        this._edgeAt = Math.min(this._edgeAt, job.doneAt);
      }
    } else if (mine && !anyReady && lastRc && lv >= (lastRc.minLv || 1)) {
      body += `<div class="bc-row"><div class="bc-grow"><div class="bc-sub">The queue is idle.</div></div>
        <button type="button" class="bc-btn" ${canRestartLast ? '' : 'disabled'} ${this._act(() => this._enqueue(view.uid, lastRecipeId))}>🔄 Produce ${recipeIcon(lastRc)} ${esc(recipeName(lastRc))} Again</button></div>`;
    } else {
      body += '<div class="bc-sub">The queue is idle.</div>';
    }
    if (used >= slots && anyReady) body += '<div class="bc-note">💡 Finished goods are holding queue slots — tap <b>📦 Collect Now</b> or <b>🔄 Collect &amp; Queue</b> below!</div>';

    // Recipes
    body += '<div class="bc-sec">📖 Recipes</div>';
    const staff = mine ? (p.village?.residents || []).find((r) => r && r.building === view.type) : null;
    if (staff) {
      const def = RESIDENTS[staff.id] || {};
      const mult = buildingSpeedMult(p.village.residents, view.type, now);
      body += `<div class="bc-note good">${def.emoji || '🧑'} <b>${esc(def.name || staff.id)}</b> staffs this building · +${Math.round((mult - 1) * 100)}% speed${isFed(staff, now) ? '' : ' (hungry — half bonus)'}</div>`;
    }
    for (const rid of allRecipes) {
      const rc = recipeOf(rid);
      if (!rc) continue;
      const lockedLv = lv < (rc.minLv || 1);
      const afford = this._canAfford(rc.inputs, p);
      const slotBlocked = used >= slots && !canFreeSlotByCollect;
      const disabled = !mine || lockedLv || slotBlocked || !afford;
      const useCollectAndQueue = mine && !lockedLv && used >= slots && canFreeSlotByCollect;
      const label = !mine ? '—' : lockedLv ? `🔒 Lv.${rc.minLv}` : slotBlocked ? 'Full' : useCollectAndQueue ? '🔄 Collect & Queue' : '➕ Queue';
      const outTxt = rc.tool ? `${TOOL_ICON[rc.tool.kind] || '🛠️'} Tool tier ${rc.tool.tier}` : itemsLine(rc.outputs);

      let helperHtml = '';
      if (mine && !lockedLv && !afford) {
        const missingKey = Object.keys(rc.inputs || {}).find((k) => this._have(k, p) < rc.inputs[k]);
        if (missingKey) {
          const prodRc = Object.values(RECIPES).find((r) => r.outputs?.[missingKey]);
          const prodBldType = prodRc?.building;
          const placedProducers = prodBldType ? (v.buildings || []).filter((b) => b.type === prodBldType) : [];
          const readyProducer = placedProducers.find((b) => this._buildingProductionReady(v.production?.[b.uid], now));
          const farmPlots = CROPS[missingKey] ? (v.buildings || []).filter((b) => b.type === 'farm_plot') : [];
          const readyPlot = farmPlots.find((b) => v.plots?.[b.uid]?.crop === missingKey && Number(v.plots[b.uid].readyAt || 0) <= now);
          if (readyProducer) {
            helperHtml = `<div class="bc-row" style="margin-top:6px"><div class="bc-grow"><div class="bc-sub" style="color:#2f5a1a;font-weight:800;">✨ ${matOf(missingKey).emoji} ${esc(matOf(missingKey).name)} is ready at ${esc(coreOf(prodBldType).name)}!</div></div>
              <button type="button" class="bc-btn green" ${this._act(() => this._collect(readyProducer.uid))}>📦 Collect ${esc(matOf(missingKey).name)}</button></div>`;
          } else if (placedProducers[0]) {
            helperHtml = `<div class="bc-row" style="margin-top:6px"><div class="bc-grow"><div class="bc-sub">Need ${matOf(missingKey).emoji} ${esc(matOf(missingKey).name)} — made at ${esc(coreOf(prodBldType).name)}</div></div>
              <button type="button" class="bc-btn plain" ${this._act(() => this.openBuilding({ owner: p.id, uid: placedProducers[0].uid, type: prodBldType, village: v }))}>${coreOf(prodBldType).emoji} Make ${esc(matOf(missingKey).name)}</button></div>`;
          } else if (readyPlot) {
            helperHtml = `<div class="bc-row" style="margin-top:6px"><div class="bc-grow"><div class="bc-sub" style="color:#2f5a1a;font-weight:800;">✨ ${matOf(missingKey).emoji} ${esc(matOf(missingKey).name)} is ripe on your Farm Plot!</div></div>
              <button type="button" class="bc-btn green" ${this._act(() => this._harvestPlot(readyPlot.uid))}>🌾 Harvest ${esc(matOf(missingKey).name)}</button></div>`;
          } else if (farmPlots[0]) {
            helperHtml = `<div class="bc-row" style="margin-top:6px"><div class="bc-grow"><div class="bc-sub">Need ${matOf(missingKey).emoji} ${esc(matOf(missingKey).name)} — grow on your Farm Plot or gather in Frontier</div></div>
              <button type="button" class="bc-btn plain" ${this._act(() => this.openBuilding({ owner: p.id, uid: farmPlots[0].uid, type: 'farm_plot', village: v }))}>🌾 Farm Plot</button></div>`;
          }
        }
      }

      const outMatId = !rc.tool ? Object.keys(rc.outputs || {})[0] : null;
      body += `<div class="bc-card${lockedLv ? ' bc-dim' : ''}"><div class="bc-row"><span class="bc-big-ico"${outMatId && MATERIALS[outMatId] ? ` data-bc-item="${esc(outMatId)}" title="Tap for ${esc(matOf(outMatId).name)} details"` : ''}>${recipeIcon(rc)}</span><div class="bc-grow">
          <div class="bc-title">${esc(recipeName(rc))}</div>
          <div class="bc-sub">→ ${outTxt} · ⏱ ${fmtDur(rc.ms)}</div>
          <div class="bc-chips">${mine ? this._costChips(rc.inputs, p) : `<span class="bc-chip">${itemsLine(rc.inputs)}</span>`}</div>
        </div>
        <button type="button" class="bc-btn ${useCollectAndQueue ? 'green' : ''}" ${disabled ? 'disabled' : ''} ${this._act(() => useCollectAndQueue ? this._collectAndEnqueue(view.uid, rid) : this._enqueue(view.uid, rid))}>${label}</button>
      </div>${helperHtml}</div>`;
    }
    let foot = '';
    if (mine) {
      const readyProdCount = (v.buildings || []).filter((b) => b.type !== 'farm_plot' && this._buildingProductionReady(v.production?.[b.uid], now)).length;
      if (readyProdCount > 1) {
        foot += `<button type="button" class="bc-btn green" ${this._act(() => this._collectAll())}>📦 Collect All (${readyProdCount})</button>`;
      }
      if (this.onOpenLegacy) foot += `<button type="button" class="bc-btn plain" ${this._act(() => { const pk = { owner: view.owner, uid: view.uid }; this.close(); this.onOpenLegacy(pk); })}>⚙️ Move / Bag</button>`;
    }
    return { title: `${d.emoji} ${d.name}`, body, foot };
  }

  async _enqueue(uid, recipe) {
    this._lastRecipeByUid.set(uid, recipe);
    const r = await this._req('bc_enqueue', { uid, recipe }, '⏳');
    if (!r.ok) return r;
    this.playPopSfx('plant');
    const rc = recipeOf(recipe);
    const ms = Math.round(rc.ms / (r.speedMult > 0 ? r.speedMult : 1));
    this.toast(`⏳ Queued ${recipeIcon(rc)} ${recipeName(rc)} — ready in ${fmtDur(ms)}`, 2200);
    return r;
  }

  async _collect(uid) {
    const r = await this._req('bc_collect', { uid }, '📦');
    if (!r.ok) return r;
    this.playPopSfx('collect');
    const toolPills = (r.tools || []).map((t) => `${TOOL_ICON[t.kind] || '🛠️'} ${t.kind} T${t.tier}!`);
    this.spawnLootBurst(r.collected || {}, toolPills, uid);
    const bits = [itemsLine(r.collected), ...toolPills];
    const bonus = itemsLine(r.bonus);
    if (bonus) bits.push(`(✨ staff bonus ${bonus})`);
    const left = itemsLine(r.leftover);
    this.toast(`📦 Collected ${bits.filter(Boolean).join(' ')}${left ? ` • storage full, left ${left}` : ''}`, 2800);
    return r;
  }

  async _collectAndEnqueue(uid, recipe) {
    this._lastRecipeByUid.set(uid, recipe);
    const c = await this._req('bc_collect', { uid }, '📦');
    if (!c.ok) return;
    this.playPopSfx('harvest');
    const toolPills = (c.tools || []).map((t) => `${TOOL_ICON[t.kind] || '🛠️'} ${t.kind} T${t.tier}!`);
    this.spawnLootBurst(c.collected || {}, toolPills, uid);
    const e = await this._req('bc_enqueue', { uid, recipe }, '⏳');
    const rc = recipeOf(recipe);
    const cTxt = itemsLine(c.collected);
    if (e.ok) {
      const ms = Math.round(rc.ms / (e.speedMult > 0 ? e.speedMult : 1));
      this.toast(`🔄 Collected ${cTxt || 'output'} & restarted ${recipeIcon(rc)} ${recipeName(rc)} (${fmtDur(ms)})!`, 2600);
    } else {
      this.toast(`📦 Collected ${cTxt || 'output'}`, 2400);
    }
  }

  async _collectAndRestart(uid, recipe) {
    if (!recipe) { await this._collect(uid); return; }
    await this._collectAndEnqueue(uid, recipe);
  }

  _viewPlot(p) {
    const view = this.view;
    const mine = !!p && view.owner === p.id;
    const v = this._villageFor(view, p);
    const plot = v.plots?.[view.uid] || { crop: null };
    const now = this.now();
    const allPlots = (v.buildings || []).filter((b) => b.type === 'farm_plot');
    const readyPlots = allPlots.filter((b) => {
      const pl = v.plots?.[b.uid];
      return pl?.crop && Number(pl.readyAt || 0) <= now;
    });
    const emptyPlots = allPlots.filter((b) => !v.plots?.[b.uid]?.crop);
    if (plot.crop) this._lastCropByUid.set(view.uid, plot.crop);
    const lastCropId = this._lastCropByUid.get(view.uid) || 'sky_wheat';

    let body = '';
    let foot = '';
    if (mine && allPlots.length > 1) {
      body += `<div class="bc-tabs" style="margin-bottom:8px;flex-wrap:wrap">${allPlots.map((b, idx) => {
        const pl = v.plots?.[b.uid] || { crop: null };
        const rdy = pl.crop && Number(pl.readyAt || 0) <= now;
        const ico = !pl.crop ? '🌱' : rdy ? '🌾✨' : '⏳';
        const sub = !pl.crop ? 'Empty' : rdy ? 'Ready!' : fmtDur(pl.readyAt - now);
        return `<button type="button" class="bc-tab${b.uid === view.uid ? ' on' : ''}" ${this._act(() => this.openBuilding({ owner: p.id, uid: b.uid, type: 'farm_plot', village: v }))}>${ico} Plot ${idx + 1} (${sub})</button>`;
      }).join('')}</div>`;
    }

    if (!plot.crop) {
      if (!mine) {
        body += `<div class="bc-note">🌱 This plot is resting — nothing to water right now.</div>`;
      } else {
        if (lastCropId && CROPS[lastCropId]) {
          const lc = CROPS[lastCropId];
          const canLast = this._canAfford(lc.plant || {}, p);
          body += `<div class="bc-card bc-done" style="margin-bottom:6px"><div class="bc-row"><span class="bc-big-ico">${matOf(lastCropId).emoji}</span><div class="bc-grow">
            <div class="bc-title">🔄 Quick Replant: ${esc(matOf(lastCropId).name)}</div>
            <div class="bc-sub">⏱ ${fmtDur(lc.ms)} · yields ${itemsLine(lc.yield)}</div>
          </div>
          <button type="button" class="bc-btn green" ${canLast ? '' : 'disabled'} ${this._act(() => this._plant(view.uid, lastCropId))}>🌱 Replant</button>
          </div></div>`;
        }
        body += '<div class="bc-sec">🌱 Choose a crop</div>';
        for (const [cid, c] of Object.entries(CROPS)) {
          const seed = c.plant || {};
          const free = !Object.keys(seed).length;
          const ok = this._canAfford(seed, p);
          body += `<div class="bc-card">
            <div class="bc-row">
              <span class="bc-big-ico">${matOf(cid).emoji}</span>
              <div class="bc-grow">
                <div class="bc-title">${esc(matOf(cid).name)}</div>
                <div class="bc-sub">⏱ ${fmtDur(c.ms)} · yields ${itemsLine(c.yield)}</div>
              </div>
              <div class="bc-chips" style="margin:0">${free ? '<span class="bc-chip ok">🌱 Free</span>' : this._costChips(seed, p)}</div>
            </div>
            <div class="bc-crop-actions">
              <button type="button" class="bc-btn green" ${ok ? '' : 'disabled'} ${this._act(() => this._plant(view.uid, cid))}>🌱 Plant</button>
              ${emptyPlots.length > 1 ? `<button type="button" class="bc-btn" ${ok ? '' : 'disabled'} ${this._act(() => this._plantAllEmpty(cid))}>🌱 Plant All (${emptyPlots.length})</button>` : ''}
            </div>
          </div>`;
        }
      }
    } else {
      const c = CROPS[plot.crop] || { ms: 1, yield: {} };
      const m = matOf(plot.crop);
      const isReady = plot.readyAt <= now;
      const canReplant = this._canAfford(c.plant || {}, p);
      body += `<div class="bc-card${isReady ? ' bc-done' : ''}">
        <div class="bc-row">
          <span class="bc-big-ico">${m.emoji}</span>
          <div class="bc-grow">
            <div class="bc-title">${esc(m.name)} ${isReady ? '<span class="bc-tag">Ready!</span>' : ''}</div>
            ${isReady ? `<div class="bc-sub">Yields ${itemsLine(c.yield)}</div>` : this._bar(plot.plantedAt || (plot.readyAt - c.ms), plot.readyAt, 'Growing')}
            <div class="bc-sub">${plot.wateredBy ? `💧 Watered by ${esc(plot.wateredBy === true ? 'a friend' : plot.wateredBy)} (−25% time)` : '💧 Not watered yet — friends can speed it up'}</div>
          </div>
        </div>
        ${mine && isReady ? `<div class="bc-crop-actions">
          <button type="button" class="bc-btn green" ${this._act(() => this._harvestPlot(view.uid))}>🌾 Harvest</button>
          <button type="button" class="bc-btn" ${canReplant ? '' : 'disabled'} ${this._act(() => this._harvestAndReplant(view.uid, plot.crop))}>🔄 Harvest &amp; Replant</button>
        </div>` : ''}
      </div>`;
      if (!isReady) this._edgeAt = Math.min(this._edgeAt, plot.readyAt);
      if (mine) {
        if (!isReady) {
          foot = `<button type="button" class="bc-btn green" disabled>⏳ Growing…</button>`;
        } else if (readyPlots.length > 1) {
          foot = `<button type="button" class="bc-btn green" ${this._act(() => this._harvestAndReplantAll())}>🌾🔄 All (${readyPlots.length})</button>`;
        }
      } else if (!isReady) {
        const unwateredPlots = allPlots.filter((b) => {
          const pl = v.plots?.[b.uid];
          return pl?.crop && Number(pl.readyAt || 0) > now && !pl.wateredBy;
        });
        foot = `<button type="button" class="bc-btn green" ${plot.wateredBy ? 'disabled' : ''} ${this._act(() => this._water(view.owner, view.uid))}>${plot.wateredBy ? '💧 Already watered' : '💧 Water (−25% time)'}</button>`;
        if (unwateredPlots.length > 1) {
          foot += `<button type="button" class="bc-btn" ${this._act(() => this._waterAll(view.owner, unwateredPlots))}>💧 Water All (${unwateredPlots.length})</button>`;
        }
      }
    }
    if (!mine && !plot.crop) foot = '';
    if (mine && this.onOpenLegacy) foot += `<button type="button" class="bc-btn plain" ${this._act(() => { const pk = { owner: view.owner, uid: view.uid }; this.close(); this.onOpenLegacy(pk); })}>⚙️ Move</button>`;
    return { title: `🌾 Farm Plot${mine ? '' : ` · ${view.owner}`}`, body, foot };
  }

  async _plant(uid, crop) {
    this._lastCropByUid.set(uid, crop);
    const r = await this._req('bc_plant', { uid, crop }, '🌱');
    if (r.ok) {
      this.playPopSfx('plant');
      this.toast(`🌱 Planted ${matOf(crop).emoji} ${matOf(crop).name} — ready in ${fmtDur(CROPS[crop].ms)}`, 2400);
    }
    return r;
  }

  async _plantAllEmpty(crop) {
    const p = this._p();
    const v = p?.village || {};
    const emptyPlots = (v.buildings || []).filter((b) => b.type === 'farm_plot' && !v.plots?.[b.uid]?.crop);
    let planted = 0;
    for (const b of emptyPlots) {
      this._lastCropByUid.set(b.uid, crop);
      const r = await this._req('bc_plant', { uid: b.uid, crop }, '🌱');
      if (r.ok) planted += 1;
      else break;
    }
    if (planted > 0) {
      this.playPopSfx('plant');
      this.toast(`🌱 Planted ${matOf(crop).emoji} ${matOf(crop).name} on ${planted} plot${planted > 1 ? 's' : ''} — ready in ${fmtDur(CROPS[crop].ms)}!`, 2600);
    }
  }

  async _harvestPlot(uid) {
    const curCrop = this._p()?.village?.plots?.[uid]?.crop;
    if (curCrop) this._lastCropByUid.set(uid, curCrop);
    const r = await this._req('bc_harvest_plot', { uid }, '🌾');
    if (r.ok) {
      this.playPopSfx('harvest');
      this.spawnLootBurst(r.items || {}, [], uid);
      this.toast(`🌾 Harvested ${itemsLine(r.items)}`, 2400);
    }
    return r;
  }

  async _harvestAndReplant(uid, crop) {
    const cropId = crop || this._p()?.village?.plots?.[uid]?.crop || this._lastCropByUid.get(uid) || 'sky_wheat';
    this._lastCropByUid.set(uid, cropId);
    const h = await this._req('bc_harvest_plot', { uid }, '🌾');
    if (!h.ok) return;
    this.playPopSfx('harvest');
    this.spawnLootBurst(h.items || {}, [], uid);
    const pl = await this._req('bc_plant', { uid, crop: cropId }, '🌱');
    if (pl.ok) {
      this.toast(`🌾 Harvested ${itemsLine(h.items)} & replanted ${matOf(cropId).emoji} ${matOf(cropId).name}!`, 2600);
    } else {
      this.toast(`🌾 Harvested ${itemsLine(h.items)}`, 2400);
    }
  }

  async _harvestAndReplantAll() {
    const p = this._p();
    const v = p?.village || {};
    const now = this.now();
    const readyPlots = (v.buildings || []).filter((b) => b.type === 'farm_plot' && v.plots?.[b.uid]?.crop && Number(v.plots[b.uid].readyAt || 0) <= now);
    const totals = {};
    let replanted = 0;
    for (const b of readyPlots) {
      const cropId = v.plots?.[b.uid]?.crop || 'sky_wheat';
      this._lastCropByUid.set(b.uid, cropId);
      const h = await this._req('bc_harvest_plot', { uid: b.uid }, '🌾');
      if (h.ok) {
        try { window.__neora?.world?.plaza?.celebrateBuildingHarvest?.(b.uid); } catch {}
        for (const [k, n] of Object.entries(h.items || {})) totals[k] = (totals[k] || 0) + n;
        const pl = await this._req('bc_plant', { uid: b.uid, crop: cropId }, '🌱');
        if (pl.ok) replanted += 1;
      }
    }
    this.playPopSfx('harvest');
    this.spawnLootBurst(totals);
    this.toast(`🌾🔄 Harvested ${itemsLine(totals)} & replanted ${replanted} plot${replanted !== 1 ? 's' : ''}!`, 2800);
  }

  async _water(owner, uid) {
    const r = await this._req('bc_water', { owner, uid }, '💧');
    if (!r.ok) return;
    this.playPopSfx('harvest');
    this.toast(`💧 You watered ${owner}'s crops — 25% faster!`, 2400);
    // reflect it locally until the next village_updated / layout arrives
    const plot = this.view?.village?.plots?.[uid];
    if (plot) { plot.wateredBy = this._p()?.id || true; if (Number.isFinite(r.readyAt)) plot.readyAt = r.readyAt; }
    this.render({ keepScroll: true });
  }

  async _waterAll(owner, plots) {
    let watered = 0;
    for (const b of plots || []) {
      const r = await this._req('bc_water', { owner, uid: b.uid }, '💧');
      if (r.ok) {
        watered += 1;
        const plot = this.view?.village?.plots?.[b.uid];
        if (plot) { plot.wateredBy = this._p()?.id || true; if (Number.isFinite(r.readyAt)) plot.readyAt = r.readyAt; }
      }
    }
    if (watered > 0) {
      this.playPopSfx('harvest');
      this.toast(`💧 Watered ${watered} of ${owner}'s plots — 25% faster!`, 2600);
      this.render({ keepScroll: true });
    }
  }

  // ---------------------------------------------------------------------------------- 2b. Craft (camp props + decor)
  _viewCraft(p) {
    const v = p?.village || {};
    const placed = {};
    for (const b of v.buildings || []) placed[b.type] = (placed[b.type] || 0) + 1;
    const today = utcDay(this.now());
    let body = '';
    // camp-prop actions
    const ready = {};
    for (const st of Object.values(v.prop_state || {})) for (const [k, n] of Object.entries(st?.ready || {})) ready[k] = (ready[k] || 0) + n;
    const hasTent = (placed.dec_tent | 0) > 0;
    const breadToday = v.tent_bread_day === today;
    const anyProducer = (placed.dec_honey_beehive | 0) + (placed.dec_koi_barrel_pond | 0) > 0;
    if (hasTent || anyProducer) {
      body += '<div class="bc-sec">🏕️ Camp Prop perks</div><div class="bc-card"><div class="bc-row" style="flex-wrap:wrap">';
      if (hasTent) body += `<button type="button" class="bc-btn green" ${breadToday ? 'disabled' : ''} ${this._act(() => this._tentBread())}>${breadToday ? '⛺ Bread claimed today' : '⛺ Free Bread'}</button>`;
      if (anyProducer) {
        const txt = itemsLine(ready);
        body += `<button type="button" class="bc-btn" ${txt ? '' : 'disabled'} ${this._act(() => this._collectProps())}>${txt ? `📦 Collect ${txt}` : '🐝 Props working…'}</button>`;
      }
      body += '</div></div>';
    }
    const card = (key, cost) => {
      const d = DECOR[key];
      if (!d) return '';
      const owned = v.decor?.[key] | 0;
      return `<div class="bc-card"><div class="bc-row"><span class="bc-big-ico">${d.emoji}</span><div class="bc-grow">
          <div class="bc-title">${esc(d.name)}</div>
          <div class="bc-sub">${esc(d.effect || '')} · owned ${owned} · placed ${placed[key] || 0}</div>
          <div class="bc-chips">${this._costChips(cost, p)}</div>
        </div><button type="button" class="bc-btn green" ${this._canAfford(cost, p) ? '' : 'disabled'} ${this._act(() => this._craftDecor(key))}>Craft</button></div></div>`;
    };
    body += '<div class="bc-sec">🏕️ Camp Props<small>functional</small></div>';
    for (const [k, def] of Object.entries(CAMP_PROPS)) body += card(k, def.cost);
    body += '<div class="bc-sec">🌸 Cosmetic Decor<small>+Comfort</small></div>';
    for (const [k, def] of Object.entries(COSMETIC_DECOR)) body += card(k, def.cost);
    body += '<div class="bc-note">Crafted decor goes to your Bag — place it with <b>🛠️ Edit Grid</b>. Retired decor you already own stays placeable.</div>';
    const foot = this.onEnterEdit ? `<button type="button" class="bc-btn plain" ${this._act(() => { this.close(); this.onEnterEdit(); })}>🛠️ Open Grid Editor</button>` : '';
    return { title: '🪵 Craft Decor', body, foot };
  }

  async _craftDecor(key) {
    const r = await this._req('bc_craft_decor', { decor: key }, '🪵');
    if (r.ok) this.toast(`🪵 Crafted ${DECOR[key]?.emoji || ''} ${DECOR[key]?.name || key}! Place it from your Bag.`, 2800);
  }

  async _tentBread() {
    const r = await this._req('bc_tent_bread', {}, '⛺');
    if (r.ok) this.toast('⛺ Fresh campfire Bread! 🍞 +1', 2200);
  }

  async _collectProps() {
    const r = await this._req('bc_props_collect', {}, '📦');
    if (r.ok) this.toast(`📦 Camp props gave ${itemsLine(r.collected)}`, 2400);
  }

  // ---------------------------------------------------------------------------------- 2c. Residents
  _viewResidents(p) {
    const v = p?.village || {};
    const now = this.now();
    const residents = Array.isArray(v.residents) ? v.residents : [];
    const placed = {};
    for (const b of v.buildings || []) placed[b.type] = (placed[b.type] || 0) + 1;
    const cottages = placed.cottage | 0;
    const used = residents.filter((r) => r?.building).length;
    const beds = housingCap(cottages);
    let body = `<div class="bc-sec">🏡 Settler Cottages<small>${used}/${beds} beds · cottage cap ${cottageCap(v.comfort)}</small></div>`;
    if (!residents.length) {
      body += '<div class="bc-note">No residents yet — finish 📜 Story chapters to welcome settlers to your camp.</div>';
      return { title: '🧑‍🌾 Residents', body, foot: '' };
    }
    const pantryItems = p?.frontier?.pantry?.items || {};
    const meals = Object.keys(MEAL_QUALITY).filter((k) => (pantryItems[k] | 0) > 0);
    body += `<div class="bc-note${meals.length ? '' : ''}">🍽️ Residents eat 1 meal every 4 h from the Pantry (best meal first)${meals.length ? `: ${meals.map((k) => `${matOf(k).emoji}×${pantryItems[k]}`).join(' ')}` : ' — <b>the Pantry has no meals!</b> Hungry residents give half their bonus.'}</div>`;
    for (const r of residents) {
      const def = RESIDENTS[r.id] || { name: r.id, emoji: '🧑', building: null, speed: 0, bonusChance: 0 };
      const fed = isFed(r, now);
      const home = def.building;
      const homePlaced = (placed[home] | 0) > 0;
      if (fed && r.fedUntil > now) this._edgeAt = Math.min(this._edgeAt, r.fedUntil);
      const mult = r.building ? buildingSpeedMult(residents, r.building, now) : 1 + (def.speed || 0);
      const opts = [`<option value="">💤 Off duty</option>`];
      if (home) opts.push(`<option value="${esc(home)}" ${r.building === home ? 'selected' : ''} ${homePlaced ? '' : 'disabled'}>${coreOf(home).emoji} ${esc(coreOf(home).name)}${homePlaced ? '' : ' (not placed)'}</option>`);
      body += `<div class="bc-card${r.building ? ' bc-done' : ''}"><div class="bc-row"><span class="bc-big-ico">${def.emoji}</span><div class="bc-grow">
          <div class="bc-title">${esc(def.name)}</div>
          <div class="bc-sub">Works at ${coreOf(home).emoji} ${esc(coreOf(home).name)} · +${Math.round((def.speed || 0) * 100)}% speed · ${Math.round((def.bonusChance || 0) * 100)}% bonus output</div>
          <div class="bc-chips">
            <span class="bc-chip ${fed ? 'ok' : 'bad'}">${fed ? `🍞 Fed · ${fmtDur(r.fedUntil - now)}` : '😣 Hungry'}</span>
            <span class="bc-chip brass">😊 Mood ${Math.round(r.mood ?? 50)}</span>
            ${r.building ? `<span class="bc-chip ok">⚡ ×${mult.toFixed(2)}</span>` : ''}
          </div>
        </div>
        <select class="bc-sel" aria-label="Assign ${esc(def.name)}" ${this._actSel((val) => this._assignResident(r.id, val || null))}>${opts.join('')}</select>
      </div></div>`;
    }
    if (used >= beds) body += '<div class="bc-note">All beds are taken — build and place another 🏡 Settler Cottage to staff more buildings.</div>';
    return { title: '🧑‍🌾 Residents', body, foot: '' };
  }

  async _assignResident(id, building) {
    const r = await this._req('bc_resident_assign', { residentId: id, building }, '🧑‍🌾');
    const def = RESIDENTS[id] || { name: id, emoji: '🧑' };
    if (r.ok) this.toast(building ? `${def.emoji} ${def.name} now staffs the ${coreOf(building).name}!` : `${def.emoji} ${def.name} is off duty.`, 2400);
    else this.render({ keepScroll: true });   // snap the dropdown back
  }

  // ---------------------------------------------------------------------------------- 2d. Monuments
  _viewMonuments(p) {
    const v = p?.village || {};
    const now = this.now();
    const mons = v.monuments || {};
    const st = { unlocked: [...(v.monument_unlocks || [])] };
    for (const id of Object.keys(MONUMENTS)) st[id] = mons[id] || { stage: 0, built: false };
    const placed = new Set((v.buildings || []).map((b) => b.type));
    let body = '<div class="bc-note">🏛️ Monuments are built stage by stage from materials + Gold. Stage 1 puts one in your Bag; place it with 🛠️ Edit Grid to use its power.</div>';
    for (const id of LAUNCH_MONUMENTS) {
      const def = MONUMENTS[id];
      const w = WONDERS[id] || { emoji: '🏛️' };
      const m = st[id];
      const stage = m.stage | 0;
      const total = def.stages.length;
      const unlocked = monumentUnlocked(id, st.unlocked, st);
      const next = def.stages[stage] || null;
      const built = stage >= 1;
      let actions = '';
      if (built && id === 'wnd_onsen') {
        const readyAt = (v.onsen_used_at || 0) + ONSEN_COOLDOWN_MS;
        const cd = readyAt > now;
        if (cd) this._edgeAt = Math.min(this._edgeAt, readyAt);
        actions = `<button type="button" class="bc-btn green" ${!placed.has(id) || cd ? 'disabled' : ''} ${this._act(() => this._useOnsen())}>${cd ? `♨️ ${fmtDur(readyAt - now)}` : '♨️ Soak'}</button>`;
      } else if (built && id === 'wnd_fountain') {
        const wished = v.wish_day === utcDay(now);
        actions = `<button type="button" class="bc-btn green" ${!placed.has(id) || wished || (p?.gold | 0) < WISH_COST ? 'disabled' : ''} ${this._act(() => this._wish())}>${wished ? '⛲ Wished today' : `⛲ Wish · ${WISH_COST} 🪙`}</button>`;
      }
      const rest = id === 'wnd_onsen' && p?.frontier?.restBuff?.until > now ? `<span class="bc-chip ok">😌 Well-Rested ${fmtDur(p.frontier.restBuff.until - now)}</span>` : '';
      body += `<div class="bc-card${unlocked ? '' : ' bc-dim'}${stage >= total ? ' bc-done' : ''}"><div class="bc-row"><span class="bc-big-ico">${w.emoji}</span><div class="bc-grow">
          <div class="bc-title">${esc(def.name)} <span class="bc-tag">${stage}/${total}</span>${def.heartIsleOnly ? ' <span class="bc-tag">💞 Heart Isle</span>' : ''}</div>
          <div class="bc-sub">${esc(MON_EFFECT[id] || '')}</div>
          ${built && !placed.has(id) && !def.heartIsleOnly ? '<div class="bc-sub">📦 In your Bag — place it with 🛠️ Edit Grid.</div>' : ''}
          ${rest ? `<div class="bc-chips">${rest}</div>` : ''}
          ${unlocked && next ? `<div class="bc-sub" style="margin-top:3px">Stage ${stage + 1} cost:</div><div class="bc-chips">${this._costChips(next, p)}</div>` : ''}
          ${unlocked ? '' : `<div class="bc-sub">🔒 ${id === 'wnd_onsen' ? 'Unlocks with Chapter 5: Feathered Things' : 'Unlocks when the Capybara Hot Spring is complete'}</div>`}
        </div>
        <div style="display:flex;flex-direction:column;gap:5px">
          ${next ? `<button type="button" class="bc-btn" ${unlocked && this._canAfford(next, p) ? '' : 'disabled'} ${this._act(() => this._contributeMonument(id))}>${stage ? '⬆️ Build' : '🏗️ Build'}</button>` : '<span class="bc-tag">✨ Complete</span>'}
          ${actions}
        </div></div></div>`;
    }
    const foot = this.onEnterEdit ? `<button type="button" class="bc-btn plain" ${this._act(() => { this.close(); this.onEnterEdit(); })}>🛠️ Open Grid Editor</button>` : '';
    return { title: '🏛️ Monuments', body, foot };
  }

  async _contributeMonument(id) {
    const r = await this._req('bc_monument_contribute', { monument: id }, '🏛️');
    if (!r.ok) return;
    const name = MONUMENTS[id]?.name || id;
    this.toast(r.built ? `🏛️ ${name} is complete! ✨` : `🏗️ ${name} stage ${r.stage} built — find it in your Bag!`, 3200);
  }

  async _useOnsen() {
    const r = await this._req('bc_monument_use', { monument: 'wnd_onsen' }, '♨️');
    if (r.ok) this.toast('♨️ Ahh~ Well-Rested! +15% gather yield for 30 min', 2800);
  }

  async _wish() {
    const r = await this._req('bc_wish', {}, '⛲');
    if (r.ok) this.toast(`⛲ Your wish came true: ${itemsLine(r.items)}`, 3000);
  }

  // ---------------------------------------------------------------------------------- 5. Orders
  async _loadOrders() {
    this._ordersLoading = true;
    const r = await this._req('bc_orders', {}, '📋');
    this._ordersLoading = false;
    if (r.ok && r.board) this.board = r.board;
    if (this.view?.kind === 'orders') this.render({ keepScroll: true });
  }

  _viewOrders(p) {
    const board = p?.orders || this.board;
    if (!board) {
      return { title: '📋 Order Board', body: `<div class="bc-note">${this._ordersLoading ? '🦉 The owls are fetching today\'s orders…' : 'No orders yet.'}</div>`, foot: '' };
    }
    const now = this.now();
    let body = `<div class="bc-sec">🦉 Orders<small>${(board.slots || []).filter(Boolean).length}/${(board.slots || []).length}</small></div>`;
    (board.slots || []).forEach((o, i) => {
      if (!o) {
        const at = board.nextRefreshAt?.[i] || 0;
        body += `<div class="bc-card bc-dim"><div class="bc-row"><span class="bc-big-ico">✉️</span><div class="bc-grow"><div class="bc-title">Waiting for a new order</div>
          ${at > now ? `<div class="bc-sub" data-until="${at}" data-label="Next owl in">Next owl in ${fmtDur(at - now)}</div>` : '<div class="bc-sub">Tap 🔄 Refresh to fetch it.</div>'}</div></div></div>`;
        return;
      }
      const can = this._canAfford(o.items, p);
      body += `<div class="bc-card${can ? ' bc-done' : ''}"><div class="bc-row"><span class="bc-big-ico">🧑‍🍳</span><div class="bc-grow">
          <div class="bc-title">${esc(o.npc || 'Villager')}</div>
          <div class="bc-chips">${this._costChips(o.items, p)}</div>
          <div class="bc-chips"><span class="bc-chip brass">🪙 ${fmtN(o.gold)}</span><span class="bc-chip brass">✨ ${fmtN(o.xp)} XP</span>${itemsLine(o.extra) ? `<span class="bc-chip brass">🎁 ${itemsLine(o.extra)}</span>` : ''}</div>
        </div></div>
        <div class="bc-row" style="margin-top:6px;justify-content:flex-end;gap:6px">
          <button type="button" class="bc-btn red" ${this._act(() => this._discardOrder(i))}>Discard</button>
          <button type="button" class="bc-btn green" ${can ? '' : 'disabled'} ${this._act(() => this._fillOrder(i, o))}>Deliver</button>
        </div></div>`;
    });
    const big = board.big;
    body += '<div class="bc-sec">🏆 Daily Big Order</div>';
    if (!big) {
      body += '<div class="bc-note">No Big Order today — build more production buildings to unlock one.</div>';
    } else {
      const items = big.items || {};
      const fulfilled = big.fulfilled || {};
      const total = Object.values(items).reduce((s, n) => s + n, 0);
      const doneU = Object.entries(items).reduce((s, [k, n]) => s + Math.min(n, fulfilled[k] || 0), 0);
      const contrib = this._bigContribution(big, p);
      body += `<div class="bc-card${big.complete ? ' bc-done' : ''}">
        <div class="bc-chips">${Object.entries(items).map(([k, n]) => {
          const f = Math.min(n, fulfilled[k] || 0);
          return `<button type="button" class="bc-chip bc-chip-item ${f >= n ? 'ok' : ''}" data-bc-item="${esc(k)}">${matOf(k).emoji} ${esc(matOf(k).name)} ${f}/${n}${f < n ? ` · have ${this._have(k, p)}` : ' ✓'} <i class="bc-chip-q">ⓘ</i></button>`;
        }).join('')}</div>
        <div class="bc-bar${big.complete ? ' ok' : ''}"><i style="width:${total ? Math.round((doneU / total) * 100) : 0}%"></i><b>${doneU}/${total}</b></div>
        <div class="bc-chips"><span class="bc-chip brass">🪙 ${fmtN(big.gold)}</span><span class="bc-chip brass">✨ ${fmtN(big.xp)} XP</span><span class="bc-chip">👥 ${Object.keys(big.contributors || {}).length} helpers</span></div>
        <div class="bc-sub" style="margin-top:4px">Rewards are shared by everyone who contributes, in proportion to what they gave.</div>
        ${big.complete ? '<div class="bc-note good">🎉 Completed! Rewards were paid out.</div>'
          : `<div class="bc-row" style="margin-top:6px;justify-content:flex-end"><button type="button" class="bc-btn green" ${Object.keys(contrib).length ? '' : 'disabled'} ${this._act(() => this._contributeBig(contrib))}>🤝 Contribute ${itemsLine(contrib) || '(nothing needed in stock)'}</button></div>`}
      </div>`;
    }
    const foot = `<button type="button" class="bc-btn plain" ${this._act(() => this._loadOrders())}>🔄 Refresh</button>`;
    return { title: '📋 Order Board', body, foot };
  }

  _bigContribution(big, p) {
    const out = {};
    for (const [k, n] of Object.entries(big.items || {})) {
      const need = Math.max(0, n - (big.fulfilled?.[k] || 0));
      const give = Math.min(need, this._have(k, p));
      if (give > 0) out[k] = give;
    }
    return out;
  }

  async _fillOrder(slot, o) {
    const r = await this._req('bc_order_fill', { slot }, '📋');
    if (!r.ok) return;
    if (r.board) this.board = r.board;
    this.playPopSfx('harvest');
    const extraPills = [];
    if (r.gold) extraPills.push(`🪙 +${fmtN(r.gold)}`);
    if (r.xp) extraPills.push(`✨ +${fmtN(r.xp)} XP`);
    if (r.levelsGained) extraPills.push('🎉 LEVEL UP!');
    this.spawnLootBurst(r.extra || {}, extraPills);
    this.toast(`📋 Delivered to ${o.npc || 'a villager'}! +${fmtN(r.gold)} 🪙 +${fmtN(r.xp)} XP${r.levelsGained ? ' 🎉 LEVEL UP!' : ''}`, 2800);
    this.render({ keepScroll: true });
  }

  async _discardOrder(slot) {
    const r = await this._req('bc_order_discard', { slot }, '📋');
    if (!r.ok) return;
    if (r.board) this.board = r.board;
    this.toast('🗑️ Order discarded — a new owl will arrive soon.', 2000);
    this.render({ keepScroll: true });
  }

  async _contributeBig(items) {
    const r = await this._req('bc_big_contribute', { items }, '🏆');
    if (!r.ok) return;
    if (r.big && this.board) this.board = { ...this.board, big: r.big };
    const me = r.rewards?.[this._p()?.id];
    this.toast(r.complete ? `🏆 Big Order complete!${me ? ` +${fmtN(me.gold)} 🪙 +${fmtN(me.xp)} XP` : ''}` : `🤝 Contributed ${itemsLine(r.contributed)}`, 3000);
    this.render({ keepScroll: true });
  }

  // ---------------------------------------------------------------------------------- 6. Storage & Item Encyclopedia
  _readyOutputsMap(p = this._p()) {
    const v = p?.village || {};
    const now = this.now();
    const placedSet = new Set((v.buildings || []).map((b) => b.uid));
    const out = {};
    for (const [uid, st] of Object.entries(v.production || {})) {
      if (!placedSet.has(uid) || !st) continue;
      for (const [k, n] of Object.entries(st.output || {})) if (n > 0) out[k] = (out[k] || 0) + n;
      for (const job of st.queue || []) {
        if (!(Number(job?.doneAt || 0) <= now)) continue;
        const rc = recipeOf(job.recipe);
        for (const [k, n] of Object.entries(rc?.outputs || {})) if (n > 0) out[k] = (out[k] || 0) + n;
      }
    }
    return out;
  }

  _viewStorage(p) {
    const stores = this._stores(p);
    const fr = p?.frontier || {};
    const readyMap = this._readyOutputsMap(p);
    const readyEntries = Object.entries(readyMap).filter(([, n]) => n > 0);
    let body = `<div class="bc-note" style="margin-top:0">👆 Tap any item or cost pill (like <b>🪙 Ingot</b> or <b>🪵 Plank</b>) to see where to craft/find it or sell excess for 🪙 Gold!</div>`;
    if (readyEntries.length) {
      body += `<div class="bc-card bc-done">
        <div class="bc-row">
          <div class="bc-grow">
            <div class="bc-title" style="color:#2f5a1a">✨ Finished in your buildings!</div>
            <div class="bc-chips">${readyEntries.map(([k, n]) => `<button type="button" class="bc-chip bc-chip-item ok" data-bc-item="${esc(k)}">${matOf(k).emoji} ${esc(matOf(k).name)} ×${n} <i class="bc-chip-q">ⓘ</i></button>`).join('')}</div>
          </div>
          <button type="button" class="bc-btn green" ${this._act(() => this._collectAll())}>📦 Collect</button>
        </div>
      </div>`;
    }
    for (const kind of ['warehouse', 'pantry']) {
      const st = stores[kind];
      const lv = st.lv || 1;
      const cap = kind === 'warehouse' ? warehouseCapOf(st) : storeCap(kind, lv);
      const nextCap = kind === 'warehouse' ? warehouseCapOf({ ...st, lv: lv + 1 }) : storeCap(kind, lv + 1);
      const used = storeUsed(st);
      const pct = Math.min(100, Math.round((used / Math.max(1, cap)) * 100));
      const entries = Object.entries(st.items || {}).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
      const cost = storeUpgradeCost(kind, lv);
      const canNow = this._canAfford(cost, p);
      const canWithReady = !canNow && Object.entries(cost).every(([k, need]) => (this._have(k, p) + (readyMap[k] || 0)) >= need);
      body += `<div class="bc-sec">${kind === 'warehouse' ? '🏚️ Warehouse' : '🧺 Pantry'}<small>Lv. ${lv}</small></div>
        <div class="bc-card"><div class="bc-bar${pct >= 100 ? '' : ' ok'}"><i style="width:${pct}%;${pct >= 90 ? 'background:linear-gradient(90deg,#c4523d,#f2b3a3)' : ''}"></i><b>${fmtN(used)} / ${fmtN(cap)}</b></div>
        ${used >= cap ? `<div class="bc-sub" style="margin-top:5px;color:#9a2a17;font-weight:700;">📦 Storage full for raw gathering — crafted items (Ingot, Plank, Food) can STILL be collected! Tap any item below to sell excess for 🪙 Gold.</div>` : ''}
        ${entries.length ? `<div class="bc-grid" style="margin-top:7px">${entries.map(([k, n]) => `<div class="bc-cell" role="button" tabindex="0" data-bc-item="${esc(k)}" title="Tap for ${esc(matOf(k).name)} details"><span class="e">${matOf(k).emoji}</span>${fmtN(n)}<span class="n">${esc(matOf(k).name)}</span></div>`).join('')}</div>`
          : `<div class="bc-sub" style="margin-top:6px">${kind === 'warehouse' ? 'Empty — gather materials in the Sky Frontier.' : 'Empty — cook food in the Patisserie.'}</div>`}
        ${lv >= MAX_STORE_LV ? '<div class="bc-sub" style="margin-top:6px">👑 Max level</div>'
          : `<div class="bc-row" style="margin-top:7px"><div class="bc-grow"><div class="bc-sub">⬆️ Lv. ${lv + 1}: ${fmtN(nextCap)} capacity</div><div class="bc-chips">${this._costChips(cost, p)}</div></div>
             <button type="button" class="bc-btn ${canNow || canWithReady ? 'green' : ''}" ${canNow || canWithReady ? '' : 'disabled'} ${this._act(() => this._storeUpgrade(kind))}>${canWithReady ? '📦 Collect & Upgrade' : 'Upgrade'}</button></div>`}
        </div>`;
    }
    const crate = fr.campCrate || { items: {}, expiresAt: 0 };
    const crateItems = Object.entries(crate.items || {}).filter(([, n]) => n > 0);
    if (crateItems.length) {
      const now = this.now();
      body += `<div class="bc-sec">📦 Camp Crate<small>${crate.expiresAt > now ? `<span data-until="${crate.expiresAt}" data-label="expires in">expires in ${fmtDur(crate.expiresAt - now)}</span>` : ''}</small></div>
        <div class="bc-card"><div class="bc-sub">Overflow from full storage waits here for 24h.</div>
        <div class="bc-grid" style="margin-top:6px">${crateItems.map(([k, n]) => `<div class="bc-cell" role="button" tabindex="0" data-bc-item="${esc(k)}"><span class="e">${matOf(k).emoji}</span>${fmtN(n)}<span class="n">${esc(matOf(k).name)}</span></div>`).join('')}</div>
        <div class="bc-row" style="margin-top:7px;justify-content:flex-end"><button type="button" class="bc-btn green" ${this._act(() => this._crateClaim())}>📥 Move into storage</button></div></div>`;
    }
    const tb = fr.toolbelt;
    if (tb) {
      body += `<div class="bc-sec">🧰 Toolbelt</div><div class="bc-chips">${['pickaxe', 'axe', 'staff'].map((k) => `<span class="bc-chip ${tb[k] ? 'brass' : ''}">${TOOL_ICON[k]} ${k} ${tb[k] ? `T${tb[k]}` : '—'}</span>`).join('')}</div>`;
    }
    const foot = `<button type="button" class="bc-btn green" ${this._anyProductionReady(p) ? '' : 'disabled'} ${this._act(() => this._collectAll())}>📦 Collect all production</button>`;
    return { title: '📦 Storage', body, foot };
  }

  async _storeUpgrade(kind) {
    const r = await this._req('bc_store_upgrade', { kind }, '⬆️');
    if (r.ok) {
      this.playPopSfx('harvest');
      const stores = this._stores();
      const cap = kind === 'warehouse' ? warehouseCapOf({ ...stores.warehouse, lv: r.lv }) : storeCap(kind, r.lv);
      const autoTxt = r.autoCollected && Object.keys(r.autoCollected).length ? ` (auto-collected ${itemsLine(r.autoCollected)})` : '';
      this.toast(`⬆️ ${kind === 'warehouse' ? 'Warehouse' : 'Pantry'} is now Lv. ${r.lv} (${fmtN(cap)} capacity)${autoTxt}!`, 2800);
    }
  }

  _itemAct(fn) {
    const id = String(++this._actSeq);
    this._itemActs.set(id, fn);
    return `data-bc-item-act="${id}"`;
  }

  openItemDetail(itemId) {
    const id = String(itemId || '').trim();
    if (!MATERIALS[id] || !this.itemBackdropEl) return;
    if (this.itemDetailId && this.itemDetailId !== id && !this.itemBackdropEl.hidden) {
      this._itemHistory.push(this.itemDetailId);
    } else if (this.itemBackdropEl.hidden) {
      this._itemHistory = [];
    }
    this.itemDetailId = id;
    this.playPopSfx('plant');
    this._renderItemDetail();
    this.itemBackdropEl.hidden = false;
  }

  closeItemDetail() {
    this.itemDetailId = null;
    this._itemHistory = [];
    this._itemActs.clear();
    if (this.itemBackdropEl) {
      this.itemBackdropEl.hidden = true;
      this.itemBackdropEl.innerHTML = '';
    }
  }

  async _sellItem(itemId, qty) {
    const r = await this._req('bc_store_upgrade', { kind: `sell:${itemId}:${qty}` }, '🪙');
    if (!r.ok) return;
    this.playPopSfx('collect');
    this.spawnLootBurst({}, [`🪙 +${fmtN(r.goldGained || 0)}`]);
    this.toast(`🪙 Sold ${matOf(itemId).emoji} ${matOf(itemId).name} ×${fmtN(r.qty || qty)} for +${fmtN(r.goldGained || 0)} Gold!`, 2400);
    if (this.view && !this.overlay.hidden) this.render({ keepScroll: true });
    if (this.itemDetailId) this._renderItemDetail();
  }

  _renderItemDetail() {
    if (!this.itemBackdropEl || !this.itemDetailId) return;
    this._itemActs.clear();
    const id = this.itemDetailId;
    const mat = matOf(id);
    const tier = materialTier(id) || 'raw';
    const tierLabel = tier === 'refined' ? 'Refined Material' : tier === 'goods' ? 'Crafted Goods' : tier === 'rare' ? 'Rare Relic' : 'Raw Material';
    const storeKind = storeOf(id);
    const storeName = storeKind === 'pantry' ? '🧺 Pantry' : '🏚️ Warehouse';
    const p = this._p();
    const v = p?.village || {};
    const now = this.now();
    const have = this._have(id, p);
    const readyMap = this._readyOutputsMap(p);
    const readyCnt = readyMap[id] || 0;
    const guide = ITEM_GUIDE[id] || {
      desc: `${mat.name} stored in your ${storeKind === 'pantry' ? 'Pantry' : 'Warehouse'}.`,
      sources: [],
      uses: 'Village crafting, upgrades & orders.',
    };
    const foodInfo = FOOD[id];

    // Find crafting recipe (if any)
    const craftRc = Object.values(RECIPES).find((r) => r.outputs?.[id])
      || Object.values(EXTRA_RECIPES).find((r) => r.outputs?.[id])
      || null;

    let craftHtml = '';
    if (craftRc) {
      const bType = craftRc.building;
      const bDef = placeDef(bType);
      const unlockCh = BUILDING_UNLOCK_CHAPTER[bType] || null;
      const story = this._story(p);
      const unlockedList = unlockedForVillage(story, v);
      const isBldUnlocked = EXTRA_BUILDINGS[bType]
        ? Boolean((v.monuments?.[bType]?.stage | 0) >= 1 || v.wonders?.[bType])
        : unlockedList.includes(bType);
      const ownedCopies = EXTRA_BUILDINGS[bType] ? (v.wonders?.[bType] ? 1 : 0) : (v.copies?.[bType] | 0);
      const placedBlds = (v.buildings || []).filter((b) => b.type === bType);
      const readyBld = placedBlds.find((b) => this._buildingProductionReady(v.production?.[b.uid], now));
      const outQty = craftRc.outputs?.[id] || 1;

      let actionBtn = '';
      if (readyBld && readyCnt > 0) {
        actionBtn = `<button type="button" class="bc-btn green" style="width:100%;margin-top:7px" ${this._itemAct(async () => { await this._collect(readyBld.uid); })}>📦 Collect Ready ${esc(mat.name)} (×${readyCnt}) Now!</button>`;
      } else if (placedBlds[0]) {
        actionBtn = `<button type="button" class="bc-btn green" style="width:100%;margin-top:7px" ${this._itemAct(() => { this.closeItemDetail(); this.openBuilding({ owner: p.id, uid: placedBlds[0].uid, type: bType, village: v }); })}>${bDef.emoji} Open ${esc(bDef.name)} to Craft</button>`;
      } else if (ownedCopies > 0 && this.onEnterEdit) {
        actionBtn = `<button type="button" class="bc-btn green" style="width:100%;margin-top:7px" ${this._itemAct(() => { this.close(); this.onEnterEdit(bType); })}>🛠️ Place ${esc(bDef.name)} from Bag</button>`;
      } else if (isBldUnlocked) {
        actionBtn = `<button type="button" class="bc-btn" style="width:100%;margin-top:7px" ${this._itemAct(() => { this.closeItemDetail(); this.open('build', { tab: 'build' }); })}>🔨 Construct ${esc(bDef.name)} in Build Menu</button>`;
      } else {
        actionBtn = `<button type="button" class="bc-btn plain" style="width:100%;margin-top:7px" ${this._itemAct(() => { this.closeItemDetail(); this.open('story'); })}>📜 Unlocks in Story${unlockCh ? ` Ch. ${unlockCh}` : ''} — View Story Board</button>`;
      }

      craftHtml = `
        <div class="bc-sec">⚒️ How to Craft</div>
        <div class="bc-card">
          <div class="bc-row">
            <span class="bc-big-ico">${bDef.emoji}</span>
            <div class="bc-grow">
              <div class="bc-title">Made at ${esc(bDef.name)}${unlockCh ? ` <span class="bc-sub">(Story Ch. ${unlockCh})</span>` : ''}</div>
              <div class="bc-sub">⏱ ${fmtDur(craftRc.ms)} → produces <b>${mat.emoji} ${esc(mat.name)} ×${outQty}</b></div>
              <div class="bc-chips">${this._costChips(craftRc.inputs, p)}</div>
            </div>
          </div>
          ${actionBtn}
        </div>
      `;
    }

    // Where to find / gather section
    const hollowUnlocked = Boolean(
      p?.frontier?.unlocks?.regions?.includes('hollow')
      || p?.frontier?.unlocks?.gates?.includes('hollow')
      || (p?.story?.chapter || 0) >= 2
      || p?.story?.completed?.includes?.(1)
    );
    const sources = guide.sources || [];
    const frontierSrc = sources.find((s) => s.region === 'hollow' && hollowUnlocked)
      || sources.find((s) => s.region === 'meadow')
      || sources.find((s) => s.region);
    const farmSrc = sources.find((s) => s.farm);
    const placedPlots = (v.buildings || []).filter((b) => b.type === 'farm_plot');

    let gatherBtns = '';
    if (farmSrc && placedPlots[0]) {
      gatherBtns += `<button type="button" class="bc-btn green" style="flex:1" ${this._itemAct(() => { this.closeItemDetail(); this.openBuilding({ owner: p.id, uid: placedPlots[0].uid, type: 'farm_plot', village: v }); })}>🌾 Open Farm Plot</button>`;
    }
    if (frontierSrc && this.onEnterFrontier) {
      const targetRegion = frontierSrc.region === 'hollow' && hollowUnlocked ? 'hollow' : 'meadow';
      const regName = targetRegion === 'hollow' ? 'Crystal Hollow' : 'Whispering Meadow';
      gatherBtns += `<button type="button" class="bc-btn" style="flex:1" ${this._itemAct(() => { this.close(); this.onEnterFrontier(targetRegion); })}>🗺️ Go to ${regName}</button>`;
    }

    const sourcesHtml = sources.length
      ? `
        <div class="bc-sec">🗺️ Where to Find</div>
        ${sources.map((s) => `
          <div class="bc-item-src">
            <span class="bc-item-src-ico">${s.icon}</span>
            <div class="bc-grow">
              <div class="bc-title" style="font-size:12px">${esc(s.title)}</div>
              <div class="bc-sub">${esc(s.detail)}</div>
            </div>
          </div>
        `).join('')}
        ${gatherBtns ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px">${gatherBtns}</div>` : ''}
      `
      : '';

    // Sell excess section (for non-rare owned items)
    let sellHtml = '';
    if (have > 0 && tier !== 'rare') {
      const unitGold = SELL_UNIT_GOLD[tier] || 2;
      const halfQty = Math.max(1, Math.floor(have / 2));
      sellHtml = `
        <div class="bc-sec">🪙 Free Storage Space<small>${unitGold} 🪙 each</small></div>
        <div class="bc-card">
          <div class="bc-sub" style="margin-bottom:6px">Need room in your ${storeKind === 'pantry' ? 'Pantry' : 'Warehouse'}? Sell excess ${esc(mat.name)} for Gold:</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <button type="button" class="bc-btn plain" style="flex:1" ${this._itemAct(() => this._sellItem(id, 1))}>Sell ×1 (+${unitGold} 🪙)</button>
            ${have >= 10 ? `<button type="button" class="bc-btn plain" style="flex:1" ${this._itemAct(() => this._sellItem(id, 10))}>Sell ×10 (+${unitGold * 10} 🪙)</button>` : ''}
            ${have >= 4 ? `<button type="button" class="bc-btn" style="flex:1" ${this._itemAct(() => this._sellItem(id, halfQty))}>Sell ×${halfQty} (+${fmtN(unitGold * halfQty)} 🪙)</button>` : ''}
          </div>
        </div>
      `;
    }

    const backBtnHtml = this._itemHistory.length > 0
      ? `<button type="button" class="bc-btn plain" style="padding:3px 8px;font-size:11px" data-bc-item-back="1">← Back</button>`
      : '';

    this.itemBackdropEl.innerHTML = `
      <div class="bc-item-card" role="dialog" aria-label="${esc(mat.name)} Item Guide">
        <header class="bc-head">
          ${backBtnHtml}
          <h3>${mat.emoji} ${esc(mat.name)}</h3>
          <button type="button" class="bc-x" data-bc-item-close="1" aria-label="Close">✕</button>
        </header>
        <div class="bc-item-body">
          <div class="bc-item-hero">
            <div class="bc-item-avatar">${mat.emoji}</div>
            <div class="bc-grow">
              <div class="bc-title" style="font-size:14.5px">${esc(mat.name)}</div>
              <div class="bc-sub">${esc(tierLabel)} • ${storeName}</div>
              <div class="bc-chips" style="margin-top:5px">
                <span class="bc-chip ${have > 0 ? 'ok' : ''}">📦 Owned: ${fmtN(have)}</span>
                ${readyCnt > 0 ? `<span class="bc-chip ok">✨ +${fmtN(readyCnt)} Ready!</span>` : ''}
                ${foodInfo ? `<span class="bc-chip brass">⚡ +${foodInfo.energy} Energy</span>` : ''}
              </div>
            </div>
          </div>
          <div class="bc-note" style="margin-top:0">${esc(guide.desc)}</div>
          ${craftHtml}
          ${sourcesHtml}
          <div class="bc-sec">🔨 Used For</div>
          <div class="bc-card"><div class="bc-sub" style="color:#3B2A20;font-weight:600">${esc(guide.uses)}</div></div>
          ${sellHtml}
        </div>
      </div>
    `;
  }

  async _crateClaim() {
    const r = await this._req('sf_crate_claim', {}, '📦');
    if (!r.ok) return;
    const moved = itemsLine(r.moved);
    this.toast(moved ? `📥 Moved ${moved} into storage` : '📦 No room yet — upgrade your storage', 2600);
  }

  async _collectAll() {
    const r = await this._req('bc_collect_all', {}, '📦');
    if (!r.ok) return;
    const bits = [itemsLine(r.collected)];
    for (const t of r.tools || []) bits.push(`${TOOL_ICON[t.kind] || '🛠️'} ${t.kind} T${t.tier}!`);
    this.toast(`📦 Collected ${bits.filter(Boolean).join(' ')}`, 2600);
  }

  // ---------------------------------------------------------------------------------- 7. Frontier HUD
  _renderFrontier() {
    const hud = typeof document !== 'undefined' ? document.getElementById('sf-hud') : null;
    if (!hud) return;
    if (!this._sf || !hud.contains(this._sf.pouch)) this._mountFrontier(hud);
    if (!this._sf) return;
    const p = this._p();
    const fr = p?.frontier || {};
    const pouch = Array.isArray(fr.foodPouch) ? fr.foodPouch : [null, null, null, null];
    let shownEmptySlot = false;
    let filledCount = 0;
    this._sf.slots.forEach((el, i) => {
      const id = pouch[i] || null;
      const n = id ? this._have(id, p) : 0;
      if (id) {
        filledCount += 1;
        el.hidden = false;
      } else if (!shownEmptySlot) {
        shownEmptySlot = true;
        el.hidden = false;
      } else {
        el.hidden = true;
      }
      el.classList.toggle('empty', !id);
      el.classList.toggle('zero', !!id && n <= 0);
      el.innerHTML = id ? `${matOf(id).emoji}<b>${n}</b>` : '🍞<b>+</b>';
      el.title = id ? `${matOf(id).name} (+${FOOD[id]?.energy || 0} ⚡) — tap to eat, hold to change` : 'Tap to equip food in your pouch';
    });
    if (this._sf.edit) {
      this._sf.edit.hidden = filledCount === 0;
    }
    this._renderBuff();
    if (this._sf.quest) {
      const q = this.getQuestGuide(p);
      this._sf.quest.classList.toggle('on', !!q.active);
      this._sf.quest.classList.toggle('ready', !!q.complete);
      if (q.active) {
        this._sf.quest.textContent = q.frontierText || q.text;
        this._sf.quest.title = 'Tap to open Story Board 📜';
      }
    }
  }

  _mountFrontier(hud) {
    const topLeft = hud.querySelector('.sf-top-left');
    const vial = hud.querySelector('#sf-vial');
    if (!topLeft) return;
    const plus = document.createElement('button');
    plus.type = 'button';
    plus.className = 'bc-sf-plus';
    plus.id = 'bc-sf-plus';
    plus.textContent = '+';
    plus.title = 'Energy refills';
    plus.onclick = (e) => { e.preventDefault(); e.stopPropagation(); this.open('energy'); };
    if (vial?.parentNode === topLeft) vial.after(plus); else topLeft.prepend(plus);
    const buff = document.createElement('div');
    buff.className = 'bc-sf-buff';
    buff.id = 'bc-sf-buff';
    topLeft.appendChild(buff);
    const quest = document.createElement('button');
    quest.type = 'button';
    quest.className = 'bc-sf-quest';
    quest.id = 'bc-sf-quest';
    quest.onclick = (e) => { e.preventDefault(); e.stopPropagation(); this.open('story'); };
    const topCenter = hud.querySelector('.sf-top-center');
    if (topCenter) topCenter.prepend(quest); else hud.appendChild(quest);
    const pouch = document.createElement('div');
    pouch.className = 'bc-sf-pouch';
    pouch.id = 'bc-sf-pouch';
    const slots = [];
    for (let i = 0; i < 4; i++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bc-sf-slot empty';
      b.dataset.slot = String(i);
      this._bindSlot(b, i);
      pouch.appendChild(b);
      slots.push(b);
    }
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'bc-sf-edit';
    edit.textContent = '✎ Edit';
    edit.onclick = (e) => { e.preventDefault(); e.stopPropagation(); this.open('pouch', { slot: 0 }); };
    pouch.appendChild(edit);
    hud.appendChild(pouch);
    this._sf = { plus, buff, quest, pouch, slots, edit };
  }

  _bindSlot(el, i) {
    let timer = 0;
    let long = false;
    el.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      long = false;
      clearTimeout(timer);
      timer = setTimeout(() => { long = true; this.open('pouch', { slot: i }); }, 520);
    });
    const cancel = () => clearTimeout(timer);
    el.addEventListener('pointerleave', cancel);
    el.addEventListener('pointercancel', cancel);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      clearTimeout(timer);
      if (long) { long = false; return; }
      const id = (this._p()?.frontier?.foodPouch || [])[i];
      if (!id) { this.open('pouch', { slot: i }); return; }
      this._eat(id);
    });
  }

  async _eat(foodId) {
    if (this._busy) return;
    if (this._have(foodId) <= 0) { this.toast(`🧺 No ${matOf(foodId).name} left — cook more at the Patisserie`, 2400); return; }
    this._busy = true;
    try {
      const r = await this._req('sf_eat', { foodId }, '🍞');
      if (!r.ok) return;
      if (r.energy) this.onEnergy?.(r.energy);
      const f = FOOD[foodId] || {};
      this.toast(`${matOf(foodId).emoji} Yum! +${f.energy || 0} ⚡${r.buff ? ` • ${BUFF_LABEL[r.buff.id] || r.buff.id} for 30 min` : ''}`, 2400);
    } finally { this._busy = false; }
  }

  _renderBuff() {
    if (!this._sf?.buff) return;
    const b = this._p()?.frontier?.mealBuff;
    const now = this.now();
    const on = !!b && b.until > now;
    this._sf.buff.classList.toggle('on', on);
    if (on) {
      const mins = Math.max(1, Math.ceil((b.until - now) / 60000));
      const txt = `${matOf(b.food).emoji} ${BUFF_LABEL[b.id] || b.id} · ${mins}m`;
      if (this._sf.buff.textContent !== txt) this._sf.buff.textContent = txt;
    }
  }

  _viewPouch(p) {
    const fr = p?.frontier || {};
    const pouch = Array.isArray(fr.foodPouch) ? fr.foodPouch : [null, null, null, null];
    const slot = Math.max(0, Math.min(3, this.view.slot | 0));
    let body = `<div class="bc-sec">🎒 Food Pouch</div><div class="bc-row" style="gap:6px">${[0, 1, 2, 3].map((i) => `<button type="button" class="bc-btn ${i === slot ? '' : 'plain'}" style="flex:1;font-size:16px" ${this._act(() => { this.view.slot = i; this.render({ keepScroll: true }); })}>${pouch[i] ? matOf(pouch[i]).emoji : '·'}</button>`).join('')}</div>`;
    body += `<div class="bc-sec">Choose food for slot ${slot + 1}</div>`;
    for (const [id, f] of Object.entries(FOOD)) {
      const n = this._have(id, p);
      const cur = pouch[slot] === id;
      body += `<div class="bc-card${cur ? ' bc-done' : ''}${n ? '' : ' bc-dim'}"><div class="bc-row"><span class="bc-big-ico">${matOf(id).emoji}</span><div class="bc-grow">
        <div class="bc-title">${esc(matOf(id).name)} <span class="bc-sub">×${n} in Pantry</span></div>
        <div class="bc-chips"><span class="bc-chip ok">⚡ +${f.energy}</span>${f.buff ? `<span class="bc-chip brass">✨ ${esc(BUFF_LABEL[f.buff] || f.buff)} 30m</span>` : ''}</div></div>
        <button type="button" class="bc-btn" ${cur ? 'disabled' : ''} ${this._act(() => this._pouchSet(slot, id))}>${cur ? 'Set ✓' : 'Set'}</button></div></div>`;
    }
    const foot = `<button type="button" class="bc-btn red" ${pouch[slot] ? '' : 'disabled'} ${this._act(() => this._pouchSet(slot, null))}>Clear slot ${slot + 1}</button>`;
    return { title: '🎒 Food Pouch', body, foot, small: true };
  }

  async _pouchSet(slot, foodId) {
    const r = await this._req('sf_pouch_set', { slot, foodId }, '🎒');
    if (!r.ok) return;
    const p = this._p();
    if (p?.frontier && Array.isArray(r.foodPouch)) p.frontier.foodPouch = r.foodPouch;
    this._renderFrontier();
    this.toast(foodId ? `🎒 Slot ${slot + 1}: ${matOf(foodId).emoji} ${matOf(foodId).name}` : `🎒 Slot ${slot + 1} cleared`, 1600);
    this.render({ keepScroll: true });
  }

  _viewEnergy(p) {
    const fr = p?.frontier || {};
    const e = fr.energy || {};
    const now = this.now();
    const day = utcDayOf(now);
    const dailyDone = e.dailyFreeDay === day;
    const refills = e.diamondRefillsDay === day ? (e.diamondRefillsCount | 0) : 0;
    const limit = refills >= ENERGY.DIAMOND_REFILLS_PER_DAY;
    const cost = ENERGY.DIAMOND_COSTS[Math.min(refills, ENERGY.DIAMOND_COSTS.length - 1)];
    const coupled = !!p?.partner_id;
    const giftDone = e.partnerGiftDay === day;
    let body = `<div class="bc-card"><div class="bc-row"><span class="bc-big-ico">⚡</span><div class="bc-grow"><div class="bc-title">${fmtN(Math.floor(e.cur ?? ENERGY.MAX))} / ${fmtN(e.max || ENERGY.MAX)} Energy</div>
      <div class="bc-sub">Regenerates +1 every ${Math.round(ENERGY.REGEN_MS / 60000)} min. Food and refills can overfill to ${fmtN((e.max || ENERGY.MAX) * 2)}.</div></div></div></div>`;
    body += `<div class="bc-card"><div class="bc-row"><span class="bc-big-ico">🌅</span><div class="bc-grow"><div class="bc-title">Daily free refill</div><div class="bc-sub">+${ENERGY.DAILY_FREE} ⚡ once per day</div></div>
      <button type="button" class="bc-btn green" ${dailyDone ? 'disabled' : ''} ${this._act(() => this._energy('sf_energy_daily', `🌅 +${ENERGY.DAILY_FREE} ⚡ daily energy!`))}>${dailyDone ? 'Claimed ✓' : 'Claim'}</button></div></div>`;
    body += `<div class="bc-card"><div class="bc-row"><span class="bc-big-ico">💎</span><div class="bc-grow"><div class="bc-title">Diamond refill</div><div class="bc-sub">+${ENERGY.DIAMOND_REFILL} ⚡ · ${refills}/${ENERGY.DIAMOND_REFILLS_PER_DAY} used today · you have ${fmtN(p?.diamonds)} 💎</div></div>
      <button type="button" class="bc-btn" ${limit || (p?.diamonds | 0) < cost ? 'disabled' : ''} ${this._act(() => this._energy('sf_energy_diamond', `💎 +${ENERGY.DIAMOND_REFILL} ⚡ refilled!`))}>${limit ? 'Limit' : `${cost} 💎`}</button></div></div>`;
    if (coupled) {
      body += `<div class="bc-card"><div class="bc-row"><span class="bc-big-ico">💞</span><div class="bc-grow"><div class="bc-title">Gift your partner</div><div class="bc-sub">Send ${esc(p.partner_id)} +${ENERGY.PARTNER_GIFT} ⚡ once per day</div></div>
        <button type="button" class="bc-btn green" ${giftDone ? 'disabled' : ''} ${this._act(() => this._energy('sf_energy_gift', `💞 Sent +${ENERGY.PARTNER_GIFT} ⚡ to ${p.partner_id}!`))}>${giftDone ? 'Sent ✓' : 'Gift'}</button></div></div>`;
    }
    const b = fr.mealBuff;
    if (b && b.until > now) {
      body += `<div class="bc-note good">${matOf(b.food).emoji} <b>${esc(BUFF_LABEL[b.id] || b.id)}</b> active · <span data-until="${b.until}" data-label="">${fmtDur(b.until - now)}</span> left</div>`;
    }
    return { title: '⚡ Energy', body, foot: '', small: true };
  }

  async _energy(type, okMsg) {
    const r = await this._req(type, {}, '⚡');
    if (!r.ok) return;
    if (r.energy) this.onEnergy?.(r.energy);
    this.toast(okMsg, 2400);
  }
}
