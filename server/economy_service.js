// server/economy_service.js — authoritative village economy (Implementation Plan Sections 2.B–2.F, 21.M.3).
// Every function takes the server clock (`now`) and an injectable RNG so tests are deterministic.
// Functions mutate the profile in place and return a small result object for the client.
import {
  CORE, CORE_LANDMARKS, WONDERS, FISH, FISHING, ANGLER_EXCHANGE, EXPANSION_TIERS, MOODS, BLUEPRINT_CARDS, BLUEPRINT_EXCESS_SHARDS,
  MAX_CASTLE_LV, MAX_CORE_LV, castleUpgradeCost, castlePrereq,
} from '../shared/catalog_landmarks.js';
import {
  harvestPreview, validateLayout, computeComfort, syncBuildingLevels, utcDay, OFFLINE_REPORT_MS, bagContents,
  landingCells, cellsOf,
} from '../shared/village_rules.js';
import { applyExp, recalcPlayerCP, LEVEL_UP_REWARD } from '../shared/progression.js';

export const EXP = { HARVEST: 15, UPGRADE: 100, CASTLE: 100, FISH: 25, CHEST: 50 };
export const DOUBLE_JACKPOT_CHANCE = 0.18;
export const BLESS = { VISITOR_GOLD: 50, DURATION_MS: 12 * 3600_000 };
export const FOUNTAIN = { COST: 100, TICKET_CHANCE: 0.2, MIN_DIAMONDS: 10, MAX_DIAMONDS: 50 };

const fail = (error, extra = {}) => ({ ok: false, error, ...extra });

/** Comfort + CP are derived values: recompute after anything that touches levels / layout / gear. */
export function refreshDerived(p) {
  syncBuildingLevels(p.village);
  p.village.comfort = computeComfort(p.village);
  p.cp = recalcPlayerCP(p);
}

/** EXP with multi-level-ups; each level grants +50 💎 and refills pet mood (Section 4.A). */
export function grantExp(p, amount) {
  const r = applyExp(p.level, p.exp, amount);
  p.level = r.level; p.exp = r.exp;
  if (r.levelsGained) {
    p.diamonds += LEVEL_UP_REWARD.diamonds * r.levelsGained;
    for (const pet of p.pets || []) pet.mood = 100;
  }
  return r.levelsGained;
}

const hasTrait = (p, trait) => {
  const uid = p.equipped?.pet?.uid;
  const id = p.equipped?.pet?.id;
  const pet = (p.pets || []).find((x) => (uid && x.uid === uid) || x.id === id);
  if (!pet) return false;
  if (Array.isArray(pet.slots) && pet.slots.some((s) => s && s.stat === trait)) return true;
  return Array.isArray(pet.traits) && pet.traits.includes(trait);
};

// ---------------------------------------------------------------------------------------------
// Harvest + offline catch-up (one formula: shared/village_rules.harvestPreview)
// ---------------------------------------------------------------------------------------------
export function harvestAll(p, now, { coupled = false, rng = Math.random } = {}) {
  const pv = harvestPreview(p, now, { coupled });
  if (!pv.ready) return fail('not_ready', { waitMs: 60_000 - pv.elapsedMs });
  if (pv.gold + pv.berries + pv.diamonds <= 0) return fail('nothing_to_harvest');
  let { gold, berries } = pv;
  const jackpot = (gold > 0 || berries > 0) && hasTrait(p, 'double_jackpot') && rng() < DOUBLE_JACKPOT_CHANCE;
  if (jackpot) { gold *= 2; berries *= 2; }
  const v = p.village;
  if (gold > 0 || berries > 0) v.last_harvest_at = now;
  if (pv.diamonds > 0) v.daily_claim_day = utcDay(now);
  p.gold += gold; p.berries += berries; p.diamonds += pv.diamonds;
  const levelsGained = grantExp(p, EXP.HARVEST);
  refreshDerived(p);
  return { ok: true, gold, berries, diamonds: pv.diamonds, jackpot, exp: EXP.HARVEST, levelsGained, hrs: pv.hrs, capHrs: pv.capHrs };
}

/** "Welcome back" report: only when away >= 5 min. Gains wait in the bubbles until Harvest All. */
export function computeOfflineGains(p, now, awaySince, { coupled = false } = {}) {
  const awayMs = now - (awaySince || now);
  if (awayMs < OFFLINE_REPORT_MS) return null;
  const pv = harvestPreview(p, now, { coupled });
  if (!pv.ready) return null;
  return { awayMs, gold: pv.gold, berries: pv.berries, diamonds: pv.diamonds, capHrs: pv.capHrs, full: pv.full };
}

// ---------------------------------------------------------------------------------------------
// Grid editor save
// ---------------------------------------------------------------------------------------------
export function saveLayout(p, layout) {
  const v = p.village;
  const r = validateLayout(v, layout);
  if (!r.ok) return r;
  v.buildings = r.buildings; v.tiles = r.tiles; v.ground = r.ground;
  refreshDerived(p);
  return { ok: true, comfort: v.comfort, bag: bagContents(v) };
}

export function setMood(p, mood) {
  if (!MOODS.includes(mood)) return fail('bad_mood');
  p.village.mood = mood;
  return { ok: true, mood };
}

// ---------------------------------------------------------------------------------------------
// Upgrades + Cloud Territory
// ---------------------------------------------------------------------------------------------
export function upgradeCastle(p) {
  const v = p.village;
  const target = v.castle_lv + 1;
  if (target > MAX_CASTLE_LV) return fail('max_level');
  const sum = CORE_LANDMARKS.reduce((s, k) => s + (v.levels[k] || 1), 0);
  const need = castlePrereq(target);
  if (sum < need) return fail('landmarks_too_low', { need, have: sum });
  const cost = castleUpgradeCost(target);
  if (p.gold < cost) return fail('not_enough_gold', { cost });
  p.gold -= cost;
  v.castle_lv = target;
  const levelsGained = grantExp(p, EXP.CASTLE);
  refreshDerived(p);
  return { ok: true, castle_lv: target, cost, exp: EXP.CASTLE, levelsGained };
}

/** Blueprint cards (from Box 2 in Step 3) evolve a landmark; zero Gold fee. Excess -> +5 🌟 each. */
export function upgradeBuilding(p, type) {
  if (!CORE_LANDMARKS.includes(type)) return fail('bad_type');
  const v = p.village;
  const lv = v.levels[type] || 1;
  const cards = v.blueprints[type] | 0;
  if (lv >= MAX_CORE_LV) {
    if (cards <= 0) return fail('max_level');
    v.blueprints[type] = 0;
    p.shards += cards * BLUEPRINT_EXCESS_SHARDS;
    return { ok: true, converted: cards, shards: cards * BLUEPRINT_EXCESS_SHARDS };
  }
  const need = BLUEPRINT_CARDS[lv];
  if (cards < need) return fail('not_enough_cards', { need, have: cards });
  v.blueprints[type] = cards - need;
  v.levels[type] = lv + 1;
  const levelsGained = grantExp(p, EXP.UPGRADE);
  refreshDerived(p);
  return { ok: true, type, lv: lv + 1, exp: EXP.UPGRADE, levelsGained };
}

export function expandTerritory(p) {
  const v = p.village;
  const tier = EXPANSION_TIERS.findIndex((t) => t.size === v.grid_size);
  const next = EXPANSION_TIERS[tier + 1];
  if (!next) return fail('max_size');
  if (v.castle_lv < next.castleLv) return fail('castle_too_low', { need: next.castleLv });
  if (p.gold < next.gold) return fail('not_enough_gold', { cost: next.gold });
  p.gold -= next.gold;
  // grow one tile on every side: shift everything by +1 so nothing moves visually
  const d = (next.size - v.grid_size) / 2;
  for (const b of v.buildings) { b.x += d; b.y += d; }
  for (const t of v.tiles) { t.x += d; t.y += d; }
  v.grid_size = next.size;
  // the bridge landing rows move with S/2: anything now sitting on them goes back to the bag
  const landing = new Set(landingCells(v.grid_size).map(([x, y]) => `${x},${y}`));
  v.buildings = v.buildings.filter((b) => !cellsOf(b).some(([x, y]) => landing.has(`${x},${y}`)));
  v.tiles = v.tiles.filter((t) => !(landing.has(`${t.x},${t.y}`) && t.t === 'water'));
  refreshDerived(p);
  return { ok: true, grid_size: next.size, cost: next.gold };
}

// ---------------------------------------------------------------------------------------------
// Couple + Wonder actions
// ---------------------------------------------------------------------------------------------
export function blessPartner(visitor, partner, now) {
  if (!partner || visitor.partner_id !== partner.id || partner.partner_id !== visitor.id) return fail('not_couple');
  const day = utcDay(now);
  if (visitor.bless_day === day) return fail('already_blessed_today');
  visitor.bless_day = day;
  visitor.gold += BLESS.VISITOR_GOLD;
  partner.village.blessed_until = now + BLESS.DURATION_MS;
  return { ok: true, gold: BLESS.VISITOR_GOLD, blessedUntil: partner.village.blessed_until };
}

export function blessFriend(visitor, target, now) {
  if (!target || target.id === visitor.id) return fail('not_friend');
  const isPartner = !!(visitor.partner_id && visitor.partner_id === target.id && target.partner_id === visitor.id);
  const isFriend = Array.isArray(visitor.friends) && visitor.friends.some((f) => f.toLowerCase() === target.id.toLowerCase());
  if (!isPartner && !isFriend) return fail('not_friend');
  const day = utcDay(now);
  if (visitor.bless_day === day) return fail('already_blessed_today');
  visitor.bless_day = day;
  visitor.gold += BLESS.VISITOR_GOLD;
  if (target.village) {
    target.village.blessed_until = now + BLESS.DURATION_MS;
  }
  return { ok: true, gold: BLESS.VISITOR_GOLD, blessedUntil: target.village?.blessed_until || (now + BLESS.DURATION_MS), targetId: target.id };
}

/** Daily 100 🪙 toss into your own (or partner's) placed Fountain of 1,000 Wishes. */
export function fountainToss(p, ownerVillage, now, rng = Math.random) {
  if (!ownerVillage?.buildings.some((b) => b.type === 'wnd_fountain')) return fail('no_fountain');
  const day = utcDay(now);
  if (p.fountain_day === day) return fail('already_tossed_today');
  if (p.gold < FOUNTAIN.COST) return fail('not_enough_gold', { cost: FOUNTAIN.COST });
  p.gold -= FOUNTAIN.COST;
  p.fountain_day = day;
  if (rng() < FOUNTAIN.TICKET_CHANCE) {
    p.bag_items.ticket_standard = (p.bag_items.ticket_standard | 0) + 1;
    return { ok: true, ticket: 1, diamonds: 0 };
  }
  const diamonds = FOUNTAIN.MIN_DIAMONDS + Math.floor(rng() * (FOUNTAIN.MAX_DIAMONDS - FOUNTAIN.MIN_DIAMONDS + 1));
  p.diamonds += diamonds;
  return { ok: true, ticket: 0, diamonds };
}

/** Finger Pick-Up & Drop onto a prop (Section 2.E.1): only the Onsen grants a server-side buff. */
export function applyDropOnProp(p, building, ownerVillage, now) {
  if (building?.type === 'wnd_onsen') {
    const stars = ownerVillage?.wonders?.wnd_onsen?.stars || 1;
    const pct = WONDERS.wnd_onsen.blacksmithPct(stars);
    p.buffs.blacksmith = { pct, until: now + WONDERS.wnd_onsen.buffMs, source: 'wnd_onsen' };
    return { buff: 'blacksmith', pct, until: p.buffs.blacksmith.until };
  }
  return { buff: null };
}

// ---------------------------------------------------------------------------------------------
// Dock fishing (Section 2.F): loot is rolled at cast time on the server, revealed on reel-in.
// ---------------------------------------------------------------------------------------------
/** Probability table. Free cast = Pond Fish only (Minnow / Crab, renormalised 45:30 -> 60:40).
 *  Golden Berry Bait unlocks Koi + Chest; co-op raises the chest share x1.35 (10% -> 13.5%). */
export function lootTable({ bait = false, coop = false } = {}) {
  const keys = Object.keys(FISH).filter((k) => bait || !FISH[k].baitOnly);
  const raw = Object.fromEntries(keys.map((k) => [k, FISH[k].rate]));
  const total = keys.reduce((s, k) => s + raw[k], 0);
  const table = Object.fromEntries(keys.map((k) => [k, raw[k] / total]));
  if (bait && coop) {
    const chest = table.chest * FISHING.COOP_CHEST_MULT;
    const rest = 1 - table.chest;
    for (const k of keys) table[k] = k === 'chest' ? chest : (table[k] * (1 - chest)) / rest;
  }
  return table;
}

export function rollCatch(opts, rng = Math.random) {
  const table = lootTable(opts);
  let r = rng(), last = null;
  for (const [k, pr] of Object.entries(table)) { last = k; if ((r -= pr) < 0) return k; }
  return last;
}

export function ensureFishBasket(p) {
  p.fish_codex = p.fish_codex || {};
  if (!p.fish_basket || typeof p.fish_basket !== 'object') {
    p.fish_basket = {
      minnow: p.fish_codex.minnow | 0,
      crab: p.fish_codex.crab | 0,
      koi: p.fish_codex.koi | 0,
      chest: p.fish_codex.chest | 0,
    };
  }
  p.fish_records = p.fish_records || {};
  return p.fish_basket;
}

export function awardCatch(p, key, rng = Math.random, opts = {}) {
  const f = FISH[key];
  ensureFishBasket(p);
  const out = { key, gold: 0, berries: 0, dupe: null, milestone: 0, targeted: false, perfectHook: !!opts.perfectHook };
  if (f.reward.gold) { p.gold += f.reward.gold; out.gold = f.reward.gold; }
  if (f.reward.berries) { p.berries += f.reward.berries; out.berries = f.reward.berries; }
  if (opts.perfectHook) {
    const bonusGold = Math.max(30, Math.round((f.reward.gold || 200) * 0.2));
    p.gold += bonusGold;
    out.gold += bonusGold;
    out.perfectBonusGold = bonusGold;
  }
  if (f.reward.dupe) {
    const owned = Object.keys(p.inventory || {});
    const randomPick = owned[Math.floor(rng() * owned.length)] || 'newbie_outfit';
    const targetedPick = p.fish_target_item && p.inventory?.[p.fish_target_item] ? p.fish_target_item : null;
    const pick = targetedPick || randomPick;
    p.inventory[pick] = p.inventory[pick] || { refine: 0, dupes: 0 };
    p.inventory[pick].dupes = (p.inventory[pick].dupes | 0) + 1;
    out.dupe = pick;
    out.targeted = !!targetedPick;
  }
  const n = (p.fish_codex[key] | 0) + 1;
  p.fish_codex[key] = n;
  p.fish_basket[key] = (p.fish_basket[key] | 0) + 1;
  if (FISHING.CODEX_MILESTONES.includes(n)) { p.diamonds += FISHING.CODEX_DIAMONDS; out.milestone = FISHING.CODEX_DIAMONDS; }
  // Deterministic-friendly weight calculation that doesn't consume caller's sequence RNG
  const minKg = f.minKg || 0.2;
  const maxKg = f.maxKg || 1.5;
  const wave = Math.abs(Math.sin(n * 12.9898 + key.length * 78.233)) % 1;
  const boost = opts.perfectHook ? Math.min(1, wave * 0.65 + 0.35) : wave;
  const weightKg = Number((minKg + (maxKg - minKg) * boost).toFixed(2));
  const prevBest = Number(p.fish_records[key] || 0);
  if (weightKg > prevBest) {
    p.fish_records[key] = weightKg;
    out.isNewRecord = true;
  }
  out.weightKg = weightKg;
  out.isCrown = weightKg >= Number((minKg + (maxKg - minKg) * 0.8).toFixed(2));
  out.basketCount = p.fish_basket[key];
  out.count = n;
  out.exp = f.exp;
  out.levelsGained = grantExp(p, f.exp);
  refreshDerived(p);
  return out;
}

export function setFishTarget(p, itemId) {
  if (!itemId) {
    p.fish_target_item = null;
    return { ok: true, targetItem: null };
  }
  if (!p.inventory || !p.inventory[itemId]) return fail('item_not_owned');
  p.fish_target_item = itemId;
  return { ok: true, targetItem: itemId };
}

export function redeemAnglerExchange(p, offerId, rng = Math.random, now = Date.now()) {
  const offer = ANGLER_EXCHANGE.find((o) => o.id === offerId);
  if (!offer) return fail('invalid_offer');
  const basket = ensureFishBasket(p);
  for (const [fKey, need] of Object.entries(offer.cost || {})) {
    if ((basket[fKey] | 0) < need) return fail('not_enough_fish', { missing: fKey, need, have: basket[fKey] | 0 });
  }
  for (const [fKey, need] of Object.entries(offer.cost || {})) {
    basket[fKey] = Math.max(0, (basket[fKey] | 0) - need);
  }
  const rw = offer.reward || {};
  const granted = {};
  if (rw.targetedDupe) {
    const owned = Object.keys(p.inventory || {});
    const targetedPick = p.fish_target_item && p.inventory?.[p.fish_target_item] ? p.fish_target_item : null;
    const eqOutfit = p.equipped?.outfit?.id;
    const fallback = (eqOutfit && p.inventory?.[eqOutfit] ? eqOutfit : null) || owned[Math.floor(rng() * owned.length)] || 'newbie_outfit';
    const pick = targetedPick || fallback;
    p.inventory[pick] = p.inventory[pick] || { refine: 0, dupes: 0 };
    p.inventory[pick].dupes = (p.inventory[pick].dupes | 0) + rw.targetedDupe;
    granted.dupe = pick;
    granted.dupeCount = rw.targetedDupe;
    granted.targeted = !!targetedPick;
  }
  if (rw.ticket) {
    p.bag_items = p.bag_items || {};
    p.bag_items.ticket_standard = (p.bag_items.ticket_standard | 0) + rw.ticket;
    granted.ticket = rw.ticket;
  }
  if (rw.scroll) {
    p.bag_items = p.bag_items || {};
    p.bag_items.scroll_forge_boost = (p.bag_items.scroll_forge_boost | 0) + rw.scroll;
    p.buffs = p.buffs || {};
    p.buffs.blacksmith = { pct: rw.forgeBuffPct || 15, until: now + 3600_000, source: 'angler_exchange' };
    granted.scroll = rw.scroll;
    granted.forgeBuffPct = rw.forgeBuffPct || 15;
  }
  if (rw.petExp || rw.petEssence) {
    p.star_essence = (p.star_essence | 0) + (rw.petEssence | 0);
    const activePet = (p.pets || [])[0];
    if (activePet) {
      activePet.essence = (activePet.essence | 0) + (rw.petEssence | 0);
      activePet.bond_xp = (activePet.bond_xp | 0) + (rw.petExp | 0);
      activePet.mood = Math.min(100, (activePet.mood | 0) + 25);
      granted.petId = activePet.id;
    }
    granted.petExp = rw.petExp | 0;
    granted.petEssence = rw.petEssence | 0;
  }
  if (rw.shards) {
    p.shards = (p.shards | 0) + rw.shards;
    granted.shards = rw.shards;
  }
  if (rw.diamonds) {
    p.diamonds = (p.diamonds | 0) + rw.diamonds;
    granted.diamonds = rw.diamonds;
  }
  if (rw.gold) {
    p.gold = (p.gold | 0) + rw.gold;
    granted.gold = rw.gold;
  }
  if (rw.berries) {
    p.berries = (p.berries | 0) + rw.berries;
    granted.berries = rw.berries;
  }
  const exp = rw.exp | 0;
  const levelsGained = exp > 0 ? grantExp(p, exp) : 0;
  refreshDerived(p);
  return { ok: true, offerId, offerName: offer.name, granted, exp, levelsGained, basket: { ...p.fish_basket } };
}

export { harvestPreview, bagContents, CORE };
