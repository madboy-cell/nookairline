// shared/resident_rules.js — Pure game rules for village residents (Master Plan §11.3).
// Pure module, zero I/O, no Date.now().

export const MEAL_INTERVAL_MS = 4 * 3600 * 1000;

export const MEAL_QUALITY = Object.freeze({
  bread: 1,
  boba_tea: 1,
  honey_bun: 2,
  berry_tart: 2,
  fish_pie: 3,
  golden_croissant: 4,
});

export const RESIDENTS_PER_COTTAGE = 2;
export const residentsPerCottage = 2;

export const RESIDENTS = Object.freeze({
  baker: Object.freeze({
    id: 'baker',
    name: 'Mira the Baker',
    emoji: '👩‍🍳',
    building: 'patisserie',
    speed: 0.25,
    bonusChance: 0.10,
  }),
  miner: Object.freeze({
    id: 'miner',
    name: 'Bram the Miner',
    emoji: '⛏️',
    building: 'mint',
    speed: 0.20,
    bonusChance: 0.10,
    frontierPassive: Object.freeze({ ore: 0.1 }),
  }),
  smith: Object.freeze({
    id: 'smith',
    name: 'Old Tomas',
    emoji: '🔨',
    building: 'workshop',
    speed: 0.25,
    bonusChance: 0.08,
  }),
  botanist: Object.freeze({
    id: 'botanist',
    name: 'Sister Lene',
    emoji: '🌿',
    building: 'flower_greenhouse',
    speed: 0.25,
    bonusChance: 0.12,
  }),
  pet_keeper: Object.freeze({
    id: 'pet_keeper',
    name: 'Pip the Keeper',
    emoji: '🐾',
    building: 'nest',
    speed: 0.2,
    bonusChance: 0.1,
  }),
  captain: Object.freeze({
    id: 'captain',
    name: 'Captain Barnaby',
    emoji: '⚓',
    building: 'dock',
    speed: 0.20,
    bonusChance: 0.10,
    update1: true,
  }),
  cartographer: Object.freeze({
    id: 'cartographer',
    name: 'Caelen the Cartographer',
    emoji: '🗺️',
    building: 'starlight_lighthouse',
    speed: 0.20,
    bonusChance: 0.10,
    update1: true,
  }),
});

/**
 * Utility clamp.
 */
export function clamp(v, min, max) {
  const num = Number(v) || 0;
  return Math.max(min, Math.min(max, num));
}

/**
 * Maximum number of cottages allowed based on village comfort.
 * comfort decides how many cottages you can have: clamp(1 + floor(comfort/1500), 1, 4).
 */
export function cottageCap(comfort) {
  const c = Number(comfort) || 0;
  return clamp(1 + Math.floor(c / 1500), 1, 4);
}

/**
 * Maximum residents housed by placed cottages (2 per cottage).
 */
export function housingCap(cottagesPlaced) {
  if (cottagesPlaced && typeof cottagesPlaced === 'object') {
    if (typeof cottagesPlaced.copies?.cottage === 'number') {
      return Math.max(0, cottagesPlaced.copies.cottage) * RESIDENTS_PER_COTTAGE;
    }
    if (Array.isArray(cottagesPlaced.buildings)) {
      const count = cottagesPlaced.buildings.filter((b) => b?.type === 'cottage').length;
      return count * RESIDENTS_PER_COTTAGE;
    }
  }
  const count = Number(cottagesPlaced) || 0;
  return Math.max(0, count) * RESIDENTS_PER_COTTAGE;
}

/**
 * Checks whether a resident is currently fed at timestamp `now`.
 */
export function isFed(res, now = 0) {
  if (!res) return false;
  const fedUntil = Number(res.fedUntil) || 0;
  return fedUntil > (Number(now) || 0);
}

/**
 * Calculate staff bonuses given resident state and definition.
 * A hungry resident gives HALF their bonus and never leaves.
 * Better meals raise mood -> more bonus-output chance.
 */
export function staffBonus(res, def, now = 0) {
  if (typeof def === 'number' && now === 0) {
    now = def;
    def = null;
  }
  const resolvedDef = def || (res?.id && RESIDENTS[res.id]) || (res?.type && RESIDENTS[res.type]) || null;
  if (!res || !resolvedDef) {
    return { speedMult: 1, bonusChance: 0 };
  }

  const fed = isFed(res, now);
  const fedMult = fed ? 1 : 0.5;
  const speed = Number(resolvedDef.speed) || 0;
  const bonusChance = Number(resolvedDef.bonusChance) || 0;
  const mood = Number.isFinite(res.mood) ? clamp(res.mood, 0, 100) : 0;

  const speedMult = Math.round((1 + speed * fedMult) * 1e6) / 1e6;
  const finalBonusChance = Math.round(bonusChance * fedMult * (1 + mood / 200) * 1e6) / 1e6;

  return {
    speedMult,
    bonusChance: finalBonusChance,
  };
}

/**
 * Helper to test if a building type is placed.
 */
function isBuildingPlaced(placedTypes, buildingType) {
  if (!placedTypes || !buildingType) return false;
  if (placedTypes instanceof Set || typeof placedTypes.has === 'function') {
    return placedTypes.has(buildingType);
  }
  if (Array.isArray(placedTypes)) {
    return placedTypes.includes(buildingType);
  }
  if (Array.isArray(placedTypes.buildings)) {
    return placedTypes.buildings.some((b) => b?.type === buildingType);
  }
  if (typeof placedTypes === 'object') {
    return Boolean(placedTypes[buildingType]);
  }
  return false;
}

/**
 * Assign a resident to staff a building.
 * - a resident may only staff their own building type, and only if it's placed
 * - unassigning (buildingType null) is always ok
 * Returns { ok: true } or { ok: false, error: 'unknown' | 'wrong_building' | 'not_placed' }
 */
export function assignResident(residents, residentId, buildingType, placedTypes) {
  const def = RESIDENTS[residentId];
  if (!def) {
    return { ok: false, error: 'unknown' };
  }

  // Unassigning is always ok
  if (buildingType === null || buildingType === undefined) {
    if (residents) {
      if (Array.isArray(residents)) {
        const r = residents.find((x) => x && (x.id === residentId || x.key === residentId));
        if (r) r.building = null;
      } else if (typeof residents === 'object') {
        if (residents[residentId]) {
          residents[residentId].building = null;
        }
      }
    }
    return { ok: true };
  }

  if (buildingType !== def.building) {
    return { ok: false, error: 'wrong_building' };
  }

  if (!isBuildingPlaced(placedTypes, buildingType)) {
    return { ok: false, error: 'not_placed' };
  }

  if (residents) {
    if (Array.isArray(residents)) {
      let r = residents.find((x) => x && (x.id === residentId || x.key === residentId));
      if (!r) {
        r = { id: residentId };
        residents.push(r);
      }
      r.building = buildingType;
    } else if (typeof residents === 'object') {
      if (!residents[residentId]) {
        residents[residentId] = { id: residentId };
      }
      residents[residentId].building = buildingType;
    }
  }

  return { ok: true };
}

/**
 * Find the resident assigned to a building type.
 */
export function residentForBuilding(residents, buildingType) {
  if (!residents || !buildingType) return null;
  if (Array.isArray(residents)) {
    return residents.find((r) => r && r.building === buildingType) || null;
  }
  if (residents.residents && typeof residents.residents === 'object') {
    return residentForBuilding(residents.residents, buildingType);
  }
  for (const [id, res] of Object.entries(residents)) {
    if (res && res.building === buildingType) {
      return { id: res.id || id, ...res };
    }
  }
  return null;
}

/**
 * Building speed multiplier from the assigned resident (1 if none).
 */
export function buildingSpeedMult(residents, buildingType, now = 0) {
  const res = residentForBuilding(residents, buildingType);
  if (!res) return 1;
  const def = RESIDENTS[res.id];
  return staffBonus(res, def, now).speedMult;
}

/**
 * Building extra bonus chance from the assigned resident (0 if none).
 */
export function buildingBonusChance(residents, buildingType, now = 0) {
  const res = residentForBuilding(residents, buildingType);
  if (!res) return 0;
  const def = RESIDENTS[res.id];
  return staffBonus(res, def, now).bonusChance;
}

/**
 * Roll extra outputs from bonusChance (+1 of each output item when it hits).
 */
export function rollBonusOutput(outputs, chance, rng = Math.random) {
  if (!outputs || typeof outputs !== 'object' || !(chance > 0)) {
    return {};
  }
  const roll = typeof rng === 'function' ? rng() : Math.random();
  if (roll >= chance) {
    return {};
  }
  const extra = {};
  if (Array.isArray(outputs)) {
    for (const item of outputs) {
      if (item) extra[item] = 1;
    }
  } else {
    for (const [item, qty] of Object.entries(outputs)) {
      if (Number(qty) > 0) {
        extra[item] = 1;
      }
    }
  }
  return extra;
}

/**
 * Helper to unwrap stores or plain item dictionary.
 */
function getPantryItemsMap(pantryItems) {
  if (!pantryItems) return {};
  if (pantryItems.pantry?.items && typeof pantryItems.pantry.items === 'object') {
    return pantryItems.pantry.items;
  }
  if (pantryItems.items && typeof pantryItems.items === 'object') {
    return pantryItems.items;
  }
  return pantryItems;
}

/**
 * Find the best meal currently available in the pantry items map.
 */
function pickBestMeal(items) {
  let bestItem = null;
  let bestQuality = -1;
  for (const [item, count] of Object.entries(items)) {
    if (Number(count) > 0 && MEAL_QUALITY[item] !== undefined) {
      const q = MEAL_QUALITY[item];
      if (q > bestQuality) {
        bestQuality = q;
        bestItem = item;
      }
    }
  }
  return bestItem;
}

/**
 * Normalize residents list from Array or Object representation.
 */
function normalizeResidentsList(residents) {
  if (!residents) return [];
  if (Array.isArray(residents)) {
    return residents.map((r, i) => ({
      ref: r,
      id: r?.id || r?.key || String(i),
    }));
  }
  if (residents.residents && typeof residents.residents === 'object') {
    return normalizeResidentsList(residents.residents);
  }
  const list = [];
  for (const [id, res] of Object.entries(residents)) {
    if (res && typeof res === 'object') {
      list.push({ ref: res, id: res.id || id });
    }
  }
  return list;
}

/**
 * Feed residents automatically from the pantry.
 * For each resident whose fedUntil <= now:
 * - eat the BEST available meal from pantryItems (mutate counts)
 * - set fedUntil = now + MEAL_INTERVAL_MS
 * - mood = clamp(mood * 0.5 + quality * 25, 0, 100)
 * - catch up for at most 3 missed meals (a resident offline for 12 h eats up to 3 meals)
 * Returns { eaten: { item: n }, hungry: [ ids ] }
 */
export function feedResidents(residents, pantryItems, now = 0) {
  const items = getPantryItemsMap(pantryItems);
  const residentEntries = normalizeResidentsList(residents);

  const eaten = {};
  const hungry = [];

  for (const { ref: res, id: resId } of residentEntries) {
    const fedUntil = Number(res.fedUntil) || 0;
    if (fedUntil > now) {
      // Resident is already fed
      continue;
    }

    // Number of meals missed: at least 1, up to at most 3
    const elapsedPast = Math.max(0, now - fedUntil);
    const missed = Math.min(3, 1 + Math.floor(elapsedPast / MEAL_INTERVAL_MS));

    let mealsAte = 0;
    let currentMood = Number.isFinite(res.mood) ? res.mood : 50;

    for (let m = 0; m < missed; m++) {
      const bestMeal = pickBestMeal(items);
      if (!bestMeal) {
        break; // No meals left in pantry
      }
      items[bestMeal] -= 1;
      if (items[bestMeal] <= 0) {
        delete items[bestMeal];
      }
      eaten[bestMeal] = (eaten[bestMeal] || 0) + 1;
      mealsAte++;
      const quality = MEAL_QUALITY[bestMeal];
      currentMood = clamp(currentMood * 0.5 + quality * 25, 0, 100);
    }

    if (mealsAte > 0) {
      res.fedUntil = now + MEAL_INTERVAL_MS;
      res.mood = currentMood;
    } else {
      hungry.push(resId);
    }
  }

  return { eaten, hungry };
}
