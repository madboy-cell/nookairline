// shared/story_rules.js — Pure game rules for village story chapters (Master Plan v2 §11.6).
// Pure module, zero I/O, no side effects.

export const STEP_KINDS = Object.freeze([
  'gather',
  'craft',
  'build',
  'deliver_orders',
  'visit',
  'defeat',
  'harvest',
]);

export const BASE_UNLOCKED_BUILDINGS = Object.freeze(['castle']);
export const BASE_UNLOCKED_REGIONS = Object.freeze(['meadow']);
export const BASE_ISLAND_SIZE = 18;

export const CHAPTERS = Object.freeze([
  {
    id: 0,
    title: 'Landfall',
    steps: Object.freeze([
      Object.freeze({ id: 'c0_gather_wood', text: 'Gather Wood', kind: 'gather', target: 'wood', count: 12 }),
      Object.freeze({ id: 'c0_gather_stone', text: 'Gather Stone', kind: 'gather', target: 'stone', count: 8 }),
      Object.freeze({ id: 'c0_visit_outpost', text: 'Visit the Outpost (light the Goddess statue)', kind: 'visit', target: 'outpost', count: 1 }),
    ]),
    rewards: Object.freeze({
      unlockBuildings: Object.freeze(['castle', 'tent', 'farm_plot']),
      unlockRegions: Object.freeze([]),
      items: Object.freeze({}),
      residents: Object.freeze([]),
      gold: 300,
    }),
  },
  {
    id: 1,
    title: 'Smoke on the Wind',
    steps: Object.freeze([
      Object.freeze({ id: 'c1_visit_wheat', text: 'Visit the Mill Ruins', kind: 'visit', target: 'wheat', count: 1 }),
      Object.freeze({ id: 'c1_gather_sky_wheat', text: 'Gather Sky Wheat', kind: 'gather', target: 'sky_wheat', count: 15 }),
      Object.freeze({ id: 'c1_build_windmill_bakery', text: 'Build Windmill Bakery', kind: 'build', target: 'windmill_bakery', count: 1 }),
      Object.freeze({ id: 'c1_craft_flour', text: 'Craft Flour', kind: 'craft', target: 'flour', count: 3 }),
      Object.freeze({ id: 'c1_build_patisserie', text: 'Build Patisserie', kind: 'build', target: 'patisserie', count: 1 }),
      Object.freeze({ id: 'c1_craft_bread', text: 'Craft Bread', kind: 'craft', target: 'bread', count: 2 }),
    ]),
    rewards: Object.freeze({
      unlockBuildings: Object.freeze(['windmill_bakery', 'patisserie', 'owl_post_office']),
      unlockRegions: Object.freeze([]),
      items: Object.freeze({}),
      residents: Object.freeze(['baker']),
      gold: 600,
    }),
  },
  {
    id: 2,
    title: 'Echoes Below',
    expandTo: 20,
    steps: Object.freeze([
      Object.freeze({ id: 'c2_deliver_orders', text: 'Deliver Orders', kind: 'deliver_orders', target: null, count: 3 }),
      Object.freeze({ id: 'c2_visit_gate_hollow', text: 'Visit Gate Hollow', kind: 'visit', target: 'gate_hollow', count: 1 }),
      Object.freeze({ id: 'c2_gather_crystal_ore', text: 'Gather Crystal Ore', kind: 'gather', target: 'crystal_ore', count: 12 }),
      Object.freeze({ id: 'c2_build_mint', text: 'Build Mint', kind: 'build', target: 'mint', count: 1 }),
      Object.freeze({ id: 'c2_craft_ingot', text: 'Craft Ingot', kind: 'craft', target: 'ingot', count: 3 }),
      Object.freeze({ id: 'c2_build_workshop', text: 'Build Workshop', kind: 'build', target: 'workshop', count: 1 }),
      Object.freeze({ id: 'c2_craft_plank', text: 'Craft Plank', kind: 'craft', target: 'plank', count: 5 }),
    ]),
    rewards: Object.freeze({
      unlockBuildings: Object.freeze(['mint', 'workshop']),
      unlockRegions: Object.freeze(['hollow']),
      items: Object.freeze({}),
      residents: Object.freeze(['miner', 'smith']),
      expandTo: 20,
      gold: 1000,
    }),
  },
  {
    id: 3,
    title: 'Seeds of the Sky',
    steps: Object.freeze([
      Object.freeze({ id: 'c3_harvest_herb', text: 'Harvest Herb', kind: 'harvest', target: 'herb', count: 3 }),
      Object.freeze({ id: 'c3_build_flower_greenhouse', text: 'Build Flower Greenhouse', kind: 'build', target: 'flower_greenhouse', count: 1 }),
      Object.freeze({ id: 'c3_craft_potion_small', text: 'Craft Small Potion', kind: 'craft', target: 'potion_small', count: 2 }),
      Object.freeze({ id: 'c3_build_cottage', text: 'Build Cottage', kind: 'build', target: 'cottage', count: 1 }),
    ]),
    rewards: Object.freeze({
      unlockBuildings: Object.freeze(['flower_greenhouse', 'cottage']),
      unlockRegions: Object.freeze([]),
      items: Object.freeze({}),
      residents: Object.freeze(['botanist']),
      gold: 1400,
    }),
  },
  {
    id: 4,
    title: 'Feathered Things',
    expandTo: 24,
    unlockMonument: 'wnd_onsen',
    steps: Object.freeze([
      Object.freeze({ id: 'c4_craft_repair_kit', text: 'Craft Repair Kit', kind: 'craft', target: 'repair_kit', count: 1 }),
      Object.freeze({ id: 'c4_defeat_elder_moss_golem', text: 'Defeat Elder Moss Golem', kind: 'defeat', target: 'elder_moss_golem', count: 1 }),
      Object.freeze({ id: 'c4_build_nest', text: 'Build Pet Nest', kind: 'build', target: 'nest', count: 1 }),
    ]),
    rewards: Object.freeze({
      unlockBuildings: Object.freeze(['nest']),
      unlockRegions: Object.freeze([]),
      items: Object.freeze({}),
      residents: Object.freeze(['pet_keeper']),
      expandTo: 24,
      unlockMonument: 'wnd_onsen',
      unlockMonuments: Object.freeze(['wnd_onsen']),
      gold: 2000,
    }),
  },
]);

/**
 * Returns a new default story progression state.
 */
export function defaultStory() {
  return {
    chapter: 0,
    progress: {},
    completed: [],
    claimed: [],
  };
}

/**
 * Checks if a step matches the incoming event kind & target.
 */
function stepMatchesEvent(step, event) {
  if (!step || !event) return false;
  if (step.kind !== event.kind) return false;
  if (step.kind === 'deliver_orders') {
    if (step.target == null || event.target == null) return true;
    return step.target === event.target;
  }
  return step.target === event.target;
}

/**
 * Increments every matching step of the CURRENT chapter only (capped at count).
 * Returns the array of stepIds that changed.
 */
export function recordEvent(story, { kind, target, amount = 1 } = {}) {
  if (!story || typeof story.chapter !== 'number') return [];
  const inc = Number.isFinite(amount) ? amount : 1;
  if (inc <= 0) return [];

  const chapter = CHAPTERS.find((c) => c.id === story.chapter);
  if (!chapter) return [];

  if (!story.progress || typeof story.progress !== 'object') {
    story.progress = {};
  }

  const changed = [];
  for (const step of chapter.steps) {
    if (stepMatchesEvent(step, { kind, target })) {
      const current = story.progress[step.id] || 0;
      if (current < step.count) {
        const next = Math.min(step.count, current + inc);
        if (next > current) {
          story.progress[step.id] = next;
          changed.push(step.id);
        }
      }
    }
  }

  return changed;
}

/**
 * Checks if all steps of the CURRENT chapter are complete.
 */
export function isChapterComplete(story) {
  if (!story || typeof story.chapter !== 'number') return false;
  const chapter = CHAPTERS.find((c) => c.id === story.chapter);
  if (!chapter) return false;
  const progress = story.progress || {};
  return chapter.steps.every((s) => (progress[s.id] || 0) >= s.count);
}

/**
 * Claims the current chapter rewards, advances chapter id, and resets progress.
 * Returns { ok: true, rewards } on success, or { ok: false, error: 'incomplete' | 'done' }.
 */
export function claimChapter(story) {
  if (!story || typeof story.chapter !== 'number') {
    return { ok: false, error: 'done' };
  }
  const chapter = CHAPTERS.find((c) => c.id === story.chapter);
  if (!chapter) {
    return { ok: false, error: 'done' };
  }

  if (!Array.isArray(story.claimed)) story.claimed = [];
  if (!Array.isArray(story.completed)) story.completed = [];

  if (story.claimed.includes(chapter.id)) {
    return { ok: false, error: 'done' };
  }
  if (!isChapterComplete(story)) {
    return { ok: false, error: 'incomplete' };
  }

  story.completed.push(chapter.id);
  story.claimed.push(chapter.id);
  story.chapter += 1;
  story.progress = {};

  return { ok: true, rewards: chapter.rewards };
}

/**
 * List of buildings unlocked by the player's completed chapters (includes base).
 */
export function unlockedBuildings(story) {
  const result = new Set(BASE_UNLOCKED_BUILDINGS);
  const completed = Array.isArray(story?.completed) ? story.completed : [];
  for (const chId of completed) {
    const ch = CHAPTERS.find((c) => c.id === chId);
    if (ch?.rewards?.unlockBuildings) {
      for (const b of ch.rewards.unlockBuildings) {
        result.add(b);
      }
    }
  }
  return Array.from(result);
}

/**
 * List of regions unlocked by the player's completed chapters (includes 'meadow').
 */
export function unlockedRegions(story) {
  const result = new Set(BASE_UNLOCKED_REGIONS);
  const completed = Array.isArray(story?.completed) ? story.completed : [];
  for (const chId of completed) {
    const ch = CHAPTERS.find((c) => c.id === chId);
    if (ch?.rewards?.unlockRegions) {
      for (const r of ch.rewards.unlockRegions) {
        result.add(r);
      }
    }
  }
  return Array.from(result);
}

/**
 * Maximum island size: 18 or the largest expandTo of completed chapters.
 */
export function maxIslandSize(story) {
  let max = BASE_ISLAND_SIZE;
  const completed = Array.isArray(story?.completed) ? story.completed : [];
  for (const chId of completed) {
    const ch = CHAPTERS.find((c) => c.id === chId);
    const expandTo = ch?.rewards?.expandTo ?? ch?.expandTo;
    if (typeof expandTo === 'number' && expandTo > max) {
      max = expandTo;
    }
  }
  return max;
}

/**
 * Returns current chapter's steps with UI progress [{ ...step, have, done }].
 */
export function currentSteps(story) {
  if (!story || typeof story.chapter !== 'number') return [];
  const ch = CHAPTERS.find((c) => c.id === story.chapter);
  if (!ch) return [];
  const progress = story.progress || {};
  return ch.steps.map((step) => {
    const have = progress[step.id] || 0;
    return {
      ...step,
      have,
      done: have >= step.count,
    };
  });
}

/**
 * List of residents unlocked by completed chapters.
 */
export function unlockedResidents(story) {
  const result = new Set();
  const completed = Array.isArray(story?.completed) ? story.completed : [];
  for (const chId of completed) {
    const ch = CHAPTERS.find((c) => c.id === chId);
    if (ch?.rewards?.residents) {
      for (const r of ch.rewards.residents) {
        result.add(r);
      }
    }
  }
  return Array.from(result);
}

/**
 * List of monuments unlocked by completed chapters.
 */
export function unlockedMonuments(story) {
  const result = new Set();
  const completed = Array.isArray(story?.completed) ? story.completed : [];
  for (const chId of completed) {
    const ch = CHAPTERS.find((c) => c.id === chId);
    if (ch?.rewards?.unlockMonument) {
      result.add(ch.rewards.unlockMonument);
    }
    if (ch?.rewards?.unlockMonuments) {
      for (const m of ch.rewards.unlockMonuments) {
        result.add(m);
      }
    }
  }
  return Array.from(result);
}

/**
 * Buildings a player may construct/use: the story unlocks PLUS every type they already own
 * (pre-v2 villages keep their buildings — "keep everything, auto-credit" — so veterans aren't locked out).
 */
export function unlockedForVillage(story, village) {
  const set = new Set(unlockedBuildings(story));
  const activeCh = CHAPTERS.find((c) => c.id === story?.chapter);
  for (const s of activeCh?.steps || []) {
    if (s.kind === 'build' && s.target) set.add(s.target);
  }
  for (const [type, n] of Object.entries(village?.copies || {})) if ((n | 0) > 0) set.add(type);
  for (const b of village?.buildings || []) if (b?.type) set.add(b.type);
  return [...set];
}
