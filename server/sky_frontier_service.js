// server/sky_frontier_service.js — Sky Frontier shard manager (Master Plan v2 §6–§8).
//
// Instance model: each region of a shard is its own server instance (`frontier:<shardId>~<regionId>`),
// so server.js broadcast / player rendering stay region-local. A shard is the group of its region
// instances; MAX_PLAYERS_PER_SHARD counts across all of them (read live from the server `instances` map).
//
// Persistence: short-lived shard state (node hp / depletion) lives in db.worldZones under
// `frontier_shard:<shardId>` (kind 'sky_frontier'). Personal progress lives in profile.frontier.
// Empty shards hibernate: no timers exist at all (node respawn is computed lazily from timestamps).

import {
  REGIONS, NODE_TYPES, HARVEST_RARITIES, MAX_PLAYERS_PER_SHARD, RESPAWN_MS, SWING_MS, PERFECT_WEIGHT,
  regionInstanceId, parseFrontierInstance, isFrontierInstance,
  canStrike, spendEnergy, regenEnergy, addEnergy, splitLoot, rollRares, rollHarvestRarity, isGateOpen, clampToRegion,
  claimDailyEnergy, diamondRefill, canGiftPartner, applyPartnerGift, activeMealBuff, eatFood,
  grantItems, claimCrate, applyYieldBonus, warehouseFreeSpace,
  ensureFieldBounties, recordBountyProgress, claimFieldBounty, claimFieldBountyBonus,
} from '../shared/sky_frontier_rules.js';
import { isMaterial, FOOD } from '../shared/materials_catalog.js';
import { defaultStory, recordEvent, CHAPTERS } from '../shared/story_rules.js';
import {
  ALPHA_ELITE, MONSTERS, BOSSES, WEAPONS, weaponDamage, attackCooldownMs, hitsInArc, toolTierMult,
  ULTIMATES, ultimateCooldownMs, INVASION, nextInvasionAt, waveComposition,
  OUTPOST, applyOutpostDamage, repairOutpost, addContribution, qualifiers, rollBossLoot,
  WEAPON_CLASSES, playerMaxHp, classComboDamage, classAttackCooldownMs,
  MONSTER_SKILLS, SKILL_DROP_RATES, skillBySource, skillCooldownMs, computeSkillNumbers, rollMonsterSkillDrop,
} from '../shared/combat_rules.js';
import { computeUniversalStats, skyFrontierMods } from '../shared/universal_stats.js';
import { findBestCharmForId, grantCharmOfTier } from '../shared/charm_catalog.js';
import { visibleSlotId, activeWeaponClass } from '../shared/accessory_attach.js';
import {
  SKILL_COMBO, ZONE_COMBO, REACTIONS, STATUS_TAGS, HIT3_PRIMES, POISE, MONSTER_ARCHETYPES, MONSTER_PASSIVES,
  PASSIVE_DROP_RATES, ESSENCE, SCROLL_FLOOR_KILLS, PRESET_COUNT, PRESET_COMBAT_LOCK_MS, SKILL_SLOT_COUNT,
  REACTION_DISCOVERY_DIAMONDS, RESONANCE,
  tagActive, tagMask, applyTag, clearTag, extendTags, resolveReactions, reactionDamageMult,
  weaponEchoFor, activePassive, passiveValue, rollMonsterPassiveDrop, skillSlotUnlocks, canEssenceCraft,
  archetypeOf, elementMult, isTagImmune, maxPoiseFor, poiseWire, normalizeFrontierSkills, defaultFrontierSkills,
} from '../shared/skill_combos.js';

export const SHARD_ZONE_KIND = 'sky_frontier';
const zoneKey = (shardId) => `frontier_shard:${shardId}`;
const PERFECT_FLAG_WINDOW = 200;
const PERFECT_FLAG_RATIO = 0.92;
const REGION_IDS = Object.freeze(Object.keys(REGIONS));
const EMPTY_SET = Object.freeze(new Set());
const AMBIENT_TYPES = Object.freeze(
  Object.fromEntries(
    REGION_IDS.map((rid) => [
      rid,
      Object.freeze(Object.values(MONSTERS).filter((m) => m.region === rid).map((m) => m.id)),
    ])
  )
);

// ---- live combat tuning (Master Plan v2 §8–§9) ------------------------------------------------
export const COMBAT = Object.freeze({
  TICK_MS: 100,                 // 10 Hz per ACTIVE shard (hibernated shards have no timer at all)
  AMBIENT_MIN: 8, AMBIENT_MAX: 28, AMBIENT_RESPAWN_MS: 6500, AMBIENT_KEEP_OUT: 8,
  AMBIENT_AGGRO_RANGE: 5.8,
  // Crowd scaling: each extra player in a region adds +2 mobs per habitat herd (max +6) and speeds respawns 12%.
  AMBIENT_PER_EXTRA_PLAYER: 2, AMBIENT_CROWD_MAX: 6, AMBIENT_RESPAWN_MIN_MS: 3500, AMBIENT_RESPAWN_CROWD_PCT: 0.12,
  MONSTER_CAP: 96,              // per region instance
  AGGRO_RANGE: 9, MELEE_RANGE: 1.2, RANGED_RANGE: 6, BOSS_RANGE: 2.5, MONSTER_ATK_CD_MS: 1200,
  OUTPOST_HIT_RANGE: 1.5, WAVE_PLAYER_AGGRO: 4,
  DOWN_MS: 5000, REGEN_DELAY_MS: 6000, REGEN_MS: 1000, REGEN_PCT: 0.03,
  SANCTUARY_RADIUS: 5.5, SANCTUARY_DELAY_MS: 4000, SANCTUARY_REGEN_PCT: 0.12,
  POTION_COOLDOWN_MS: 8000, POTION_HEAL_PCT: 0.50,
  DELTA_MS: 200,                // sf_monsters at most 5 Hz per region
  OUTPOST_BCAST_MS: 500,        // sf_outpost at most 2 Hz per region
  INVASION_TIMEOUT_MS: 4 * 60e3,
  CHEST: Object.freeze({ monster_gel: 6, monster_fang: 3 }), CHEST_CORE_CHANCE: 0.12,
  BOSS_POI: Object.freeze({ meadow: 'golem', hollow: 'boss', reef: 'boss', caldera: 'boss' }),
  BOSS_START_RANGE: 6, BOSS_COOLDOWN_MS: 10 * 60e3, BOSS_LEASH: 14, BOSS_TIMEOUT_MS: 15 * 60e3,
  BOSS_MIN_SHARE: 0.05, ENRAGE_MULT: 1.25,
  CRIT_CHANCE: 0.10, STAFF_HEAL_RADIUS: 3, ATTACK_RANGE_SLACK: 0.5, ATTACK_CD_SLACK_MS: 30,
  EMPTY_GRACE_MS: 10e3,
});

// ---------------------------------------------------------------------------------------------
// Deterministic node layout per region (same in every shard, so clients can cache it).
// ---------------------------------------------------------------------------------------------
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** [poiKey, nodeType, count, spreadRadius] per region. */
const NODE_PLAN = {
  meadow: [
    ['grove', 'tree', 14, 7], ['outpost', 'tree', 6, 12],
    ['outpost', 'boulder', 8, 10], ['golem', 'boulder', 10, 6],
    ['wheat', 'wheat', 12, 6], ['grove', 'herb', 3, 9], ['wheat', 'herb', 3, 9],
    ['grotto', 'crystal', 4, 4],
    ['boulders', 'boulder', 6, 5],
  ],
  hollow: [
    ['quartz', 'crystal', 12, 6], ['outpost', 'crystal', 6, 10], ['mithril', 'crystal', 7, 6],
    ['quartz', 'quartz', 6, 5], ['mithril', 'mithril', 8, 5],
    ['outpost', 'boulder', 12, 11], ['boss', 'herb', 4, 7],
    ['frost_glade', 'crystal', 5, 5], ['frost_glade', 'herb', 3, 5],
  ],
  reef: [
    ['shrine_woods', 'sakura_tree', 14, 7], ['outpost', 'sakura_tree', 6, 10],
    ['pearl_shoals', 'pearl_clam', 12, 6], ['bell_lagoon', 'pearl_clam', 5, 5],
    ['crane_roost', 'cloud_lotus', 10, 6], ['bell_lagoon', 'cloud_lotus', 6, 5],
    ['outpost', 'boulder', 8, 10], ['boss', 'sakura_tree', 5, 7],
  ],
  caldera: [
    ['cinder_vents', 'orichalcum', 12, 6], ['outpost', 'orichalcum', 6, 10],
    ['gear_foundry', 'mithril', 8, 6], ['chrono_ring', 'orichalcum', 6, 5],
    ['prism_spires', 'astral_prism', 12, 6], ['chrono_ring', 'astral_prism', 6, 5],
    ['gear_foundry', 'crystal', 8, 6], ['boss', 'astral_prism', 5, 7],
  ],
};

const regionNodeCache = new Map();
export function regionNodes(regionId) {
  if (regionNodeCache.has(regionId)) return regionNodeCache.get(regionId);
  const region = REGIONS[regionId];
  const plan = NODE_PLAN[regionId] || [];
  const out = [];
  if (region) {
    const rng = mulberry32([...regionId].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7));
    const lim = region.zone.halfSize - 3;
    const keepOut = [region.spawn, ...Object.entries(region.pois).filter(([k]) => k.startsWith('gate_') || k === 'outpost').map(([, v]) => v)];
    let i = 0;
    for (const [poiKey, type, count, spread] of plan) {
      const c = region.pois[poiKey] || { x: 0, z: 0 };
      for (let n = 0; n < count; n++) {
        let x = 0, z = 0;
        for (let tries = 0; tries < 12; tries++) {
          const a = rng() * Math.PI * 2, r = 1.5 + rng() * spread;
          x = Math.max(-lim, Math.min(lim, c.x + Math.cos(a) * r));
          z = Math.max(-lim, Math.min(lim, c.z + Math.sin(a) * r));
          if (keepOut.every((k) => Math.hypot(k.x - x, k.z - z) > 3) && out.every((o) => Math.hypot(o.x - x, o.z - z) > 1.6)) break;
        }
        out.push(Object.freeze({ id: `${regionId}_${type}_${i++}`, type, x: +x.toFixed(2), z: +z.toFixed(2) }));
      }
    }
  }
  const frozen = Object.freeze(out);
  regionNodeCache.set(regionId, frozen);
  return frozen;
}

// ---------------------------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------------------------
export function createSkyFrontierService({
  db, instances, presence, send, broadcast, sockets,
  isCouple = () => false, onProfileChanged = () => {},
  now = () => Date.now(), rng = Math.random, log = console, defaultFrontier = null,
  setIntervalFn = setInterval, clearIntervalFn = clearInterval,
} = {}) {
  /** shardId -> { id, durable, live: { hits: Map<nodeId, Map<userId, weight>>, lastStrike: Map, perfectLog: Map, streak: Map } } */
  const shards = new Map();
  let shardSeq = 0;
  let batchedChangedProfiles = null;

  function notifyProfileChanged(prof) {
    if (!prof) return;
    if (batchedChangedProfiles) {
      batchedChangedProfiles.set(prof.id, prof);
    } else {
      onProfileChanged(prof);
    }
  }

  function withBatchedProfileSync(fn) {
    if (batchedChangedProfiles) return fn();
    const pending = new Map();
    batchedChangedProfiles = pending;
    try {
      return fn();
    } finally {
      batchedChangedProfiles = null;
      for (const prof of pending.values()) onProfileChanged(prof);
    }
  }

  // ---- shard bookkeeping -------------------------------------------------------------------
  function membersOf(shardId) {
    const ids = new Set();
    for (const regionId of Object.keys(REGIONS)) {
      const set = instances.get(regionInstanceId(shardId, regionId));
      if (set) for (const id of set) ids.add(id);
    }
    return ids;
  }

  function loadShard(shardId) {
    let sh = shards.get(shardId);
    if (sh) return sh;
    const rec = db.getWorldZone?.(zoneKey(shardId));
    const durable = rec?.state && typeof rec.state === 'object'
      ? rec.state
      : { schemaVersion: 1, shardId, nodes: {}, outposts: {}, createdAt: now(), lastActiveAt: now() };
    durable.nodes ||= {};
    durable.outposts ||= {};
    durable.bossCd ||= {};
    // Invasions only advance while the shard is awake: a persisted warning/active phase is dropped
    // on wake (its wave monsters were never persisted) and ensureActive() reschedules from "now".
    const inv = (durable.invasion ||= { nextAt: 0, phase: 'idle', wave: 0, endsAt: 0 });
    if (inv.phase !== 'idle') Object.assign(inv, { phase: 'idle', wave: 0, endsAt: 0, at: 0, nextWaveAt: 0, nextAt: 0 });
    for (const regionId of REGION_IDS) {
      const op = (durable.outposts[regionId] ||= { hp: OUTPOST.maxHp, maxHp: OUTPOST.maxHp, offline: false });
      op.maxHp ||= OUTPOST.maxHp;
    }
    sh = {
      id: shardId,
      durable,
      live: {
        hits: new Map(), lastStrike: new Map(), perfectLog: new Map(), streak: new Map(),
        // live combat (never persisted)
        monsters: new Map(), players: new Map(), regions: new Map(), bosses: new Map(), effects: [],
        monsterSeq: 0, invLedger: {}, invWaveAlive: 0, lastTickAt: 0, emptySince: 0, lastSweepAt: 0,
      },
    };
    shards.set(shardId, sh);
    const m = /^sf_(\d+)$/.exec(shardId);
    if (m) shardSeq = Math.max(shardSeq, Number(m[1]));
    return sh;
  }

  function saveShard(sh) {
    sh.durable.lastActiveAt = now();
    db.putWorldZone?.(zoneKey(sh.id), SHARD_ZONE_KIND, sh.durable);
  }

  function knownShardIds() {
    const ids = new Set(shards.keys());
    for (const z of db.listWorldZones?.(SHARD_ZONE_KIND) || []) ids.add(String(z.zone_id).replace(/^frontier_shard:/, ''));
    return [...ids];
  }

  function shardOfUser(userId) {
    const s = presence.get(userId);
    const parsed = s && parseFrontierInstance(s.instanceId);
    return parsed?.shardId || null;
  }

  function ensureFrontier(p) {
    if (!p) return null;
    if (!p.frontier && typeof defaultFrontier === 'function') p.frontier = defaultFrontier();
    if (p.frontier) {
      p.frontier.pantry ||= { lv: 1, items: {} };
      p.frontier.pantry.items ||= {};
      p.frontier.warehouse ||= { lv: 1, items: {} };
      p.frontier.warehouse.items ||= {};
      p.frontier.campCrate ||= { items: {}, expiresAt: 0 };
      p.frontier.campCrate.items ||= {};
      p.frontier.foodPouch ||= [null, null, null, null];
      if (!p.frontier.skills || typeof p.frontier.skills !== 'object' || Array.isArray(p.frontier.skills)) {
        p.frontier.skills = defaultFrontierSkills();
      } else {
        normalizeFrontierSkills(p.frontier.skills);
      }
      ensureFieldBounties(p.frontier, now());
    }
    return p.frontier || null;
  }

  function ensureFrontierSkills(p) {
    const fr = ensureFrontier(p);
    if (!fr) return defaultFrontierSkills();
    return fr.skills;
  }

  // ---- matchmaking (§6): partner → friend → fullest with space → new ------------------------
  function pickShard(p, requestedShardId = null) {
    const hasRoom = (id) => id && membersOf(id).size < MAX_PLAYERS_PER_SHARD;
    if (requestedShardId && hasRoom(requestedShardId)) return requestedShardId;
    if (isCouple(p)) {
      const sid = shardOfUser(p.partner_id);
      if (hasRoom(sid)) return sid;
    }
    for (const fid of Array.isArray(p.friends) ? p.friends : []) {
      const sid = shardOfUser(fid);
      if (hasRoom(sid)) return sid;
    }
    const home = p.frontier?.homeShardId;
    let best = null, bestCount = -1;
    for (const id of knownShardIds()) {
      const n = membersOf(id).size;
      if (n >= MAX_PLAYERS_PER_SHARD) continue;
      if (n > bestCount || (n === bestCount && id === home)) { best = id; bestCount = n; }
    }
    if (best && bestCount > 0) return best;
    if (hasRoom(home)) return home;
    if (best) return best;
    shardSeq += 1;
    return `sf_${shardSeq}`;
  }

  function isRegionStoryUnlocked(prof, regionId) {
    if (!regionId || regionId === 'meadow') return true;
    if (!prof) return false;
    if (prof.frontier?.unlocks?.regions?.includes?.(regionId) || prof.frontier?.unlocks?.gates?.includes?.(regionId)) {
      return true;
    }
    const ch = prof.story?.chapter || 0;
    const comp = prof.story?.completed;
    const prog = prof.story?.progress;
    if (regionId === 'hollow') {
      return Boolean(ch >= 2 || comp?.includes?.(1) || (prog?.c2_visit_gate_hollow || 0) >= 1);
    }
    if (regionId === 'reef') {
      return Boolean(ch >= 6 || comp?.includes?.(5) || (ch === 5 && (prog?.c5_visit_gate_reef || 0) >= 1));
    }
    if (regionId === 'caldera') {
      return Boolean(ch >= 7 || comp?.includes?.(6));
    }
    return false;
  }

  function syncStoryUnlocks(p, fr) {
    if (!p || !fr) return false;
    fr.unlocks ||= { regions: ['meadow'], gates: [] };
    fr.unlocks.regions ||= ['meadow'];
    fr.unlocks.gates ||= [];
    let changed = false;
    for (const reg of ['hollow', 'reef', 'caldera']) {
      if (isRegionStoryUnlocked(p, reg)) {
        if (!fr.unlocks.regions.includes(reg)) { fr.unlocks.regions.push(reg); changed = true; }
        if (!fr.unlocks.gates.includes(reg)) { fr.unlocks.gates.push(reg); changed = true; }
      }
    }
    if (changed) {
      db.markProfile?.(p.id);
      onProfileChanged(p);
    }
    return changed;
  }

  /**
   * Resolve an `instance_switch` target. `to` = 'frontier' | 'frontier:<shardId>' | full region instance id.
   * Region instance ids are only honoured when `internal` (gate transfer) or when the player already
   * holds the unlock — so clients can't skip Sky Mist gates by asking for `~hollow` directly.
   */
  function resolveEntry(p, to, { internal = false } = {}) {
    const parsed = parseFrontierInstance(to);
    let regionId = parsed?.regionId && REGIONS[parsed.regionId] ? parsed.regionId : 'meadow';
    const fr = ensureFrontier(p);
    syncStoryUnlocks(p, fr);
    if (regionId !== 'meadow' && !internal) {
      const partnerProf = isCouple(p) && p.partner_id ? db.getProfile(p.partner_id) : null;
      const partnerUnlocked = Boolean(partnerProf && isRegionStoryUnlocked(partnerProf, regionId));
      if (!isRegionStoryUnlocked(p, regionId) && !partnerUnlocked) regionId = 'meadow';
    }
    const shardId = pickShard(p, parsed?.shardId || null);
    loadShard(shardId);
    if (fr) { fr.homeShardId = shardId; db.markProfile?.(p.id); }
    return { targetId: regionInstanceId(shardId, regionId), shardId, regionId };
  }

  function canRejoin(p, instanceId) {
    const parsed = parseFrontierInstance(instanceId);
    if (!parsed?.shardId || !REGIONS[parsed.regionId]) return false;
    const members = membersOf(parsed.shardId);
    return members.has(p.id) || members.size < MAX_PLAYERS_PER_SHARD;
  }

  // ---- nodes -------------------------------------------------------------------------------
  function nodeState(sh, node, t = now()) {
    const type = NODE_TYPES[node.type];
    let st = sh.durable.nodes[node.id];
    if (st && st.depletedUntil && t >= st.depletedUntil) { delete sh.durable.nodes[node.id]; st = null; }
    return st || { hp: type?.hp ?? 1, depletedUntil: 0 };
  }

  function nodesWire(sh, regionId) {
    const t = now();
    return regionNodes(regionId).map((n) => {
      const st = nodeState(sh, n, t);
      return { id: n.id, type: n.type, x: n.x, z: n.z, hp: st.hp, maxHp: NODE_TYPES[n.type]?.hp ?? 1, depletedUntil: st.depletedUntil || 0 };
    });
  }

  // ---- wire payloads -----------------------------------------------------------------------
  function layoutPayload(instanceId) {
    const parsed = parseFrontierInstance(instanceId);
    const regionId = REGIONS[parsed?.regionId] ? parsed.regionId : 'meadow';
    const sh = loadShard(parsed?.shardId || 'sf_1');
    const region = REGIONS[regionId];
    return {
      kind: 'sky_frontier',
      shardId: sh.id,
      regionId,
      regionName: region.name || regionId,
      halfSize: region.zone.halfSize,
      spawn: region.spawn,
      pois: region.pois,
      gates: Object.entries(region.gateTo || {}).map(([to, g]) => ({ to, at: g.at, radius: g.radius, requires: g.requires ?? null })),
      nodes: nodesWire(sh, regionId),
      players: membersOf(sh.id).size,
      maxPlayers: MAX_PLAYERS_PER_SHARD,
      ...combatSnapshot(sh, regionId),
    };
  }

  function spawnFor(instanceId, { arrivingFrom = null } = {}) {
    const parsed = parseFrontierInstance(instanceId);
    const region = REGIONS[parsed?.regionId] || REGIONS.meadow;
    if (arrivingFrom && region.gateTo?.[arrivingFrom]) {
      const g = region.gateTo[arrivingFrom].at;
      // step 4.4m inward from the gate toward the region centre so arrival clears the gate warp ring
      const len = Math.hypot(g.x, g.z) || 1;
      return clampToRegion(region.id, g.x - (g.x / len) * 4.4, g.z - (g.z / len) * 4.4);
    }
    return { x: region.spawn.x, z: region.spawn.z };
  }

  function clampMove(instanceId, x, z) {
    const parsed = parseFrontierInstance(instanceId);
    return clampToRegion(REGIONS[parsed?.regionId] ? parsed.regionId : 'meadow', x, z, 0.4);
  }

  /** Called by server.js after a player left a frontier instance (disconnect or switch). */
  function onLeave(instanceId) {
    const parsed = parseFrontierInstance(instanceId);
    if (!parsed?.shardId) return;
    const sh = shards.get(parsed.shardId);
    if (!sh) return;
    if (membersOf(sh.id).size === 0) hibernate(sh);
  }

  /** Stop the shard's combat tick, persist and drop it from memory (zero timers while empty). */
  function hibernate(sh) {
    stopTimer(sh.id);
    saveShard(sh);
    const L = sh.live;
    L.hits.clear(); L.lastStrike.clear(); L.perfectLog.clear();
    L.streak?.clear(); L.nodePerfects?.clear(); L.nodeSwings?.clear();
    L.monsters.clear(); L.players.clear(); L.regions.clear(); L.bosses.clear(); L.effects.length = 0;
    shards.delete(sh.id); // hibernate: nothing ticks, state lives in worldZones
    log.info?.(`[frontier] shard ${sh.id} hibernated`);
  }

  // ---- gate transfer -----------------------------------------------------------------------
  /** Returns `{ ok, targetId, spawn }` or `{ ok:false, error }`. Server performs the actual switch. */
  function regionTransfer(ws, p, to) {
    const parsed = parseFrontierInstance(ws.instanceId);
    if (!parsed) return { ok: false, error: 'not_in_frontier' };
    const fromRegion = REGIONS[parsed.regionId] ? parsed.regionId : 'meadow';
    const toRegion = String(to || '');
    const gate = REGIONS[fromRegion]?.gateTo?.[toRegion];
    if (!gate || !REGIONS[toRegion]) return { ok: false, error: 'no_gate' };
    const s = presence.get(p.id);
    if (!s || Math.hypot(s.x - gate.at.x, s.z - gate.at.z) > (gate.radius || 3) + 2.2) return { ok: false, error: 'too_far' };
    onPlayerMoved(p, ws.instanceId, s.x, s.z);
    const fr = ensureFrontier(p);
    syncStoryUnlocks(p, fr);
    const partnerProf = isCouple(p) && p.partner_id ? db.getProfile(p.partner_id) : null;
    const partnerUnlocked = Boolean(
      partnerProf && shardOfUser(p.partner_id) === parsed.shardId
      && isRegionStoryUnlocked(partnerProf, gate.requires)
    );
    const unlocks = { regions: fr?.unlocks?.regions || [], gates: fr?.unlocks?.gates || [] };
    if (!isGateOpen(fromRegion, toRegion, unlocks, { guestOfUnlocked: partnerUnlocked })) return { ok: false, error: 'gate_locked' };
    const targetId = regionInstanceId(parsed.shardId, toRegion);
    return { ok: true, targetId, spawn: spawnFor(targetId, { arrivingFrom: fromRegion }), guest: partnerUnlocked && !checkUnlocked(unlocks, gate.requires) };
  }
  const checkUnlocked = (unlocks, req) => req == null || unlocks.regions.includes(req) || unlocks.gates.includes(req);

  // ---- strikes (§8.2) ----------------------------------------------------------------------
  function grant(p, items) {
    const fr = ensureFrontier(p);
    if (!fr) return;
    const res = grantItems(fr, items, now());
    db.markProfile?.(p.id);
    return res;
  }

  function perfectAllowed(sh, userId, claimed) {
    const log = sh.live.perfectLog.get(userId) || { swings: 0, perfects: 0 };
    log.swings += 1;
    if (claimed) log.perfects += 1;
    if (log.swings > PERFECT_FLAG_WINDOW) { log.swings = Math.round(log.swings / 2); log.perfects = Math.round(log.perfects / 2); }
    sh.live.perfectLog.set(userId, log);
    if (!claimed) return false;
    return !(log.swings >= PERFECT_FLAG_WINDOW / 2 && log.perfects / log.swings > PERFECT_FLAG_RATIO);
  }

  function strike(ws, p, m) {
    const parsed = parseFrontierInstance(ws.instanceId);
    if (!parsed) return { ok: false, error: 'not_in_frontier' };
    const regionId = REGIONS[parsed.regionId] ? parsed.regionId : 'meadow';
    const sh = loadShard(parsed.shardId);
    const node = regionNodes(regionId).find((n) => n.id === String(m.nodeId || ''));
    if (!node) return { ok: false, error: 'no_node' };
    const type = NODE_TYPES[node.type];
    const t = now();
    const st = nodeState(sh, node, t);
    if (st.depletedUntil && t < st.depletedUntil) return { ok: false, error: 'depleted' };
    const s = presence.get(p.id);
    const fr = ensureFrontier(p);
    if (!s || !fr) return { ok: false, error: 'no_state' };
    const toolTier = Number(fr.toolbelt?.[type.tool] ?? 0);
    const chk = canStrike({
      playerPos: { x: s.x, z: s.z }, nodePos: { x: node.x, z: node.z }, toolTier, node: type,
      lastStrikeAt: sh.live.lastStrike.get(p.id) ?? null, now: t, swingMs: SWING_MS,
    });
    if (!chk.ok) return { ok: false, error: chk.code };
    const ps = sh.live.players.get(p.id);
    if (ps && ps.downUntil > t) return { ok: false, error: 'down' };
    const freeSwing = ps?.buffs?.free_swings?.n > 0;
    if (freeSwing) {
      ps.buffs.free_swings.n -= 1;
      if (ps.buffs.free_swings.n <= 0) delete ps.buffs.free_swings;
      fr.energy = regenEnergy(fr.energy, t);
    } else {
      const spent = spendEnergy(fr.energy, 1, t);
      if (!spent.ok) { fr.energy = regenEnergy(fr.energy, t); return { ok: false, error: 'no_energy', energy: fr.energy }; }
      fr.energy = spent.energy;
    }
    // Lucky Ring: the next N swings each carry a rare re-roll if the node breaks on them.
    let reroll = false;
    if (ps?.buffs?.rare_reroll?.n > 0) {
      reroll = true;
      ps.buffs.rare_reroll.n -= 1;
      if (ps.buffs.rare_reroll.n <= 0) delete ps.buffs.rare_reroll;
    }
    sh.live.lastStrike.set(p.id, t);

    const perfect = perfectAllowed(sh, p.id, !!m.perfect);
    sh.live.streak ||= new Map();
    const prevStreak = sh.live.streak.get(p.id);
    const streak = perfect
      ? ((prevStreak && t - prevStreak.at <= 8500 ? prevStreak.count : 0) + 1)
      : 0;
    sh.live.streak.set(p.id, { count: streak, at: t });
    let streakEnergyBonus = 0;
    if (streak > 0 && streak % 5 === 0) {
      fr.energy = addEnergy(fr.energy, 1, t);
      streakEnergyBonus = 1;
    }

    const w = perfect ? PERFECT_WEIGHT : 1;
    let hits = sh.live.hits.get(node.id);
    if (!hits) { hits = new Map(); sh.live.hits.set(node.id, hits); }
    hits.set(p.id, (hits.get(p.id) || 0) + w);

    sh.live.nodePerfects ||= new Map();
    sh.live.nodeSwings ||= new Map();
    const prevPerfects = sh.live.nodePerfects.get(node.id) || 0;
    const perfectCount = perfect ? prevPerfects + 1 : prevPerfects;
    const totalSwings = (sh.live.nodeSwings.get(node.id) || 0) + 1;
    sh.live.nodePerfects.set(node.id, perfectCount);
    sh.live.nodeSwings.set(node.id, totalSwings);

    fr.stats ||= {};
    let bountyProgressed = false;
    if (perfect) {
      fr.stats.perfects = (fr.stats.perfects || 0) + 1;
      if (recordBountyProgress(fr, { kind: 'perfect_strikes', amount: 1 }, t).length) bountyProgressed = true;
    }

    const pLuckMult = skyFrontierMods(statsOf(p))?.rareFindMult || 1;
    const previewRarity = rollHarvestRarity({
      nodeType: type,
      perfectCount,
      totalSwings: Math.max(2, totalSwings),
      luckMult: pLuckMult,
      rng: () => 0.99,
      forceRoll: true,
    });

    const hp = Math.max(0, st.hp - 1);
    db.markProfile?.(p.id);
    if (hp > 0) {
      sh.durable.nodes[node.id] = { hp, depletedUntil: 0 };
      if (bountyProgressed && fr.bounties?.cards?.some((c) => !c.claimed && c.have >= c.goal)) {
        notifyProfileChanged(p);
      }
      broadcast(ws.instanceId, {
        type: 'sf_node_hit',
        nodeId: node.id,
        hp,
        maxHp: type.hp,
        by: p.id,
        perfect,
        perfectCount,
        streak,
        rareBoostPct: previewRarity.rareBoostPct,
      });
      return {
        ok: true,
        perfect,
        perfectCount,
        streak,
        streakEnergyBonus,
        rareBoostPct: previewRarity.rareBoostPct,
        nodeHp: hp,
        maxHp: type.hp,
        energy: fr.energy,
        bounties: fr.bounties,
        contribution: hits.get(p.id),
      };
    }

    // ---- node broke: roll Harvest Rarity Tier, split loot by contribution, individual rare rolls ----
    const hitObj = Object.fromEntries(hits);
    let harvestRarity = rollHarvestRarity({
      nodeType: type,
      perfectCount,
      totalSwings,
      luckMult: pLuckMult,
      rng,
    });
    if (reroll && harvestRarity.id === 'common') {
      harvestRarity = rollHarvestRarity({
        nodeType: type,
        perfectCount,
        totalSwings: Math.max(2, totalSwings),
        luckMult: pLuckMult,
        rng,
        forceRoll: true,
      });
    }
    if (streak >= 8 && harvestRarity.id === 'common') {
      harvestRarity = {
        ...HARVEST_RARITIES.uncommon,
        bonusDrops: { ...(type.rarityDrops?.uncommon || {}) },
        rareBoostPct: Math.max(harvestRarity.rareBoostPct || 0, 25),
      };
    }

    const { qualifying, shares } = splitLoot({
      hits: hitObj,
      baseDrop: type.drop || {},
      fortuneMult: harvestRarity.mult || 1,
    });
    const coupleResonanceUsers = [];
    for (const uid of qualifying) {
      const prof = db.getProfile(uid);
      const pf = prof && ensureFrontier(prof);
      // Co-Op Personal Loot Floor: when 2+ players break a node together, each qualifying player
      // receives at least the full solo base drop * rarity mult (so co-op is never a split penalty!).
      if (qualifying.length > 1 && shares[uid]) {
        for (const [matId, baseAmt] of Object.entries(type.drop || {})) {
          const soloFloor = Math.floor((baseAmt || 0) * (harvestRarity.mult || 1));
          if ((shares[uid][matId] || 0) < soloFloor) {
            shares[uid][matId] = soloFloor;
          }
        }
      }
      // 💞 Couple Resonance: if your bound partner also hit the node OR is within 10m in the same region,
      // grant +25% bonus yield (min +1 per material) and +25% Rare drop luck!
      let hasCoupleResonance = false;
      if (prof && isCouple(prof) && prof.partner_id) {
        if (qualifying.includes(prof.partner_id)) {
          hasCoupleResonance = true;
        } else {
          const instMembers = instances.get(ws.instanceId);
          const partPres = presence.get(prof.partner_id);
          if (instMembers?.has(prof.partner_id) && partPres) {
            const dist = Math.hypot((partPres.x || 0) - node.x, (partPres.z || 0) - node.z);
            if (dist <= 10.5) hasCoupleResonance = true;
          }
        }
      }
      if (hasCoupleResonance && shares[uid]) {
        coupleResonanceUsers.push(uid);
        for (const [matId, n] of Object.entries(shares[uid])) {
          if (n > 0) shares[uid][matId] = n + Math.max(1, Math.floor(n * 0.25));
        }
      }
      const buff = pf && activeMealBuff(pf, t);
      if (buff && (buff.id === 'yield' || buff.id === 'yield_plus')) {
        const playerShares = shares[uid];
        if (playerShares) {
          for (const [matId, baseCount] of Object.entries(playerShares)) {
            const bonus = applyYieldBonus(baseCount, buff.id);
            if (bonus > 0) {
              playerShares[matId] = baseCount + bonus;
            }
          }
        }
      }
      // Capybara Hot Spring "Well-Rested" buff (Master Plan v2 §11.4): +yieldPct% gathering yield, min +1.
      const rest = pf?.restBuff;
      if (rest && Number(rest.until) > t && shares[uid]) {
        const pct = Number(rest.yieldPct) || 15;
        for (const [matId, n] of Object.entries(shares[uid])) {
          if (n > 0) shares[uid][matId] = n + Math.max(1, Math.floor((n * pct) / 100));
        }
      }
    }
    const luckByUser = {};
    for (const uid of qualifying) {
      const prof = db.getProfile(uid);
      const coupleLuckMult = coupleResonanceUsers.includes(uid) ? 1.25 : 1.0;
      luckByUser[uid] = (skyFrontierMods(statsOf(prof))?.rareFindMult || 1) * (1 + perfectCount * 0.12) * coupleLuckMult;
    }
    const rares = type.rare ? rollRares(type.rare, qualifying, rng, luckByUser) : {};
    if (reroll && type.rare && qualifying.includes(p.id) && !(rares[p.id] && Object.keys(rares[p.id]).length)) {
      const again = rollRares(type.rare, [p.id], rng, luckByUser);
      if (again[p.id] && Object.keys(again[p.id]).length) rares[p.id] = again[p.id];
    }
    // Merge guaranteed Harvest Rarity Tier bonus drops into each qualifier's rare/bonus loot
    if (harvestRarity.bonusDrops && Object.keys(harvestRarity.bonusDrops).length > 0) {
      for (const uid of qualifying) {
        rares[uid] ||= {};
        for (const [bMat, bCnt] of Object.entries(harvestRarity.bonusDrops)) {
          if (bCnt > 0) {
            rares[uid][bMat] = (rares[uid][bMat] || 0) + bCnt;
          }
        }
      }
    }
    const overflowByUser = {};
    const whFullUsers = [];
    withBatchedProfileSync(() => {
      for (const uid of qualifying) {
        const prof = db.getProfile(uid);
        if (!prof) continue;
        const g1 = grant(prof, shares[uid]);
        const g2 = grant(prof, rares[uid]);
        const userOverflow = { ...(g1?.overflow || {}) };
        for (const [mk, mv] of Object.entries(g2?.overflow || {})) {
          if (mv > 0) userOverflow[mk] = (userOverflow[mk] || 0) + mv;
        }
        if (Object.keys(userOverflow).length > 0) overflowByUser[uid] = userOverflow;
        const pf = ensureFrontier(prof);
        if (pf) {
          pf.stats ||= {};
          pf.stats.nodes = (pf.stats.nodes || 0) + 1;
          if (harvestRarity.id === 'epic') pf.stats.epicNodes = (pf.stats.epicNodes || 0) + 1;
          recordBountyProgress(pf, { kind: 'node_breaks', amount: 1 }, t);
          if (harvestRarity.id !== 'common') {
            recordBountyProgress(pf, { kind: 'rare_nodes', amount: 1 }, t);
          }
          for (const [matId, n] of Object.entries(shares[uid] || {})) {
            if (n > 0) recordBountyProgress(pf, { kind: 'gather_item', target: matId, amount: n }, t);
          }
          for (const [matId, n] of Object.entries(rares[uid] || {})) {
            if (n > 0) recordBountyProgress(pf, { kind: 'gather_item', target: matId, amount: n }, t);
          }
          if (warehouseFreeSpace(pf.warehouse) <= 0) whFullUsers.push(uid);
        }
        // Story chapters count gathered materials (Master Plan v2 §11.6)
        prof.story ||= defaultStory();
        for (const [matId, n] of Object.entries(shares[uid] || {})) if (n > 0) recordEvent(prof.story, { kind: 'gather', target: matId, amount: n });
        for (const [matId, n] of Object.entries(rares[uid] || {})) if (n > 0) recordEvent(prof.story, { kind: 'gather', target: matId, amount: n });
        notifyProfileChanged(prof);
      }
    });
    sh.live.hits.delete(node.id);
    sh.live.nodePerfects.delete(node.id);
    sh.live.nodeSwings.delete(node.id);
    sh.durable.nodes[node.id] = { hp: 0, depletedUntil: t + RESPAWN_MS };
    saveShard(sh);
    const rarityPayload = {
      id: harvestRarity.id,
      label: harvestRarity.label,
      badge: harvestRarity.badge,
      mult: harvestRarity.mult,
      color: harvestRarity.color,
      perfectCount,
      rareBoostPct: harvestRarity.rareBoostPct,
    };
    broadcast(ws.instanceId, {
      type: 'sf_node_break',
      nodeId: node.id,
      depletedUntil: t + RESPAWN_MS,
      shares,
      rares,
      qualifying,
      coupleResonanceUsers,
      overflowByUser,
      whFullUsers,
      streak,
      rarity: rarityPayload,
    });
    return {
      ok: true,
      perfect,
      perfectCount,
      streak,
      streakEnergyBonus,
      nodeHp: 0,
      broke: true,
      energy: fr.energy,
      bounties: fr.bounties,
      share: shares[p.id] || {},
      rare: rares[p.id] || null,
      overflow: overflowByUser[p.id] || null,
      whFull: whFullUsers.includes(p.id),
      whFree: warehouseFreeSpace(fr.warehouse),
      coupleResonance: coupleResonanceUsers.includes(p.id),
      rarity: rarityPayload,
    };
  }

  // =============================================================================================
  // Live combat (Master Plan v2 §8–§9): monsters, invasions, outposts, bosses, ultimates.
  // One 10 Hz interval per ACTIVE shard; AI only runs for regions that currently hold players.
  // =============================================================================================
  const timers = new Map(); // shardId -> interval handle

  function ensureActive(sh) {
    if (!sh || timers.has(sh.id)) return;
    const t = now();
    const inv = sh.durable.invasion;
    if (inv.phase === 'idle' && (!inv.nextAt || inv.nextAt <= t)) inv.nextAt = nextInvasionAt(t, rng); // never instantly invade
    sh.live.lastTickAt = t;
    sh.live.emptySince = 0;
    const handle = setIntervalFn(() => {
      try { tick(sh.id, now()); } catch (e) { log.error?.('[frontier] tick error', e); }
    }, COMBAT.TICK_MS);
    handle?.unref?.();
    timers.set(sh.id, handle);
  }

  function stopTimer(shardId) {
    const h = timers.get(shardId);
    if (h !== undefined) { clearIntervalFn(h); timers.delete(shardId); }
  }

  function stopAll() { for (const id of [...timers.keys()]) stopTimer(id); }

  // ---- small helpers --------------------------------------------------------------------------
  const regionMembers = (shardId, regionId) => instances.get(regionInstanceId(shardId, regionId)) || EMPTY_SET;
  const r1 = (v) => Math.round(v * 10) / 10;
  const round2 = (v) => Math.round(v * 100) / 100;
  const dist = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);

  const normFacing = (f, fallback) => {
    const x = Number(f?.x), z = Number(f?.z);
    if (Number.isFinite(x) && Number.isFinite(z) && Math.hypot(x, z) > 1e-6) return { x, z };
    return fallback || { x: 0, z: -1 };
  };

  const unitFacing = (f, fallback) => {
    const raw = normFacing(f, fallback);
    const len = Math.hypot(raw.x, raw.z);
    if (len > 1e-6) return { x: raw.x / len, z: raw.z / len };
    return { x: 0, z: -1 };
  };

  const distToSegment = (px, pz, ax, az, bx, bz) => {
    const vx = bx - ax, vz = bz - az;
    const lenSq = vx * vx + vz * vz;
    if (lenSq <= 1e-8) return Math.hypot(px - ax, pz - az);
    const u = Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / lenSq));
    return Math.hypot(px - (ax + u * vx), pz - (az + u * vz));
  };

  function liveRegion(sh, regionId) {
    let R = sh.live.regions.get(regionId);
    if (!R) {
      R = {
        count: 0,
        ambientAlive: 0,
        ambientDue: [],
        dirty: new Set(),
        lastDeltaAt: 0,
        outpostDirty: false,
        bossDirty: false,
        lastOutpostAt: 0,
        lastActiveAt: now(),
        hibernated: false,
        skillZones: [],
      };
      sh.live.regions.set(regionId, R);
    }
    R.skillZones ||= [];
    return R;
  }

  function userRegion(sh, uid) {
    const s = presence.get(uid);
    const parsed = s && parseFrontierInstance(s.instanceId);
    return parsed?.shardId === sh.id && REGIONS[parsed.regionId] ? parsed.regionId : null;
  }

  function statsOf(prof) {
    try { return computeUniversalStats(prof)?.total || {}; } catch { return {}; }
  }

  function activeShieldOf(ps, t) {
    if (!ps || !(ps.shieldUntil > t)) return 0;
    const val = Math.max(Number(ps.shieldHp) || 0, Number(ps.shield) || 0);
    return val > 0 ? Math.round(val) : 0;
  }

  function syncPlayerMaxHp(ps, prof) {
    if (!ps || !prof) return ps;
    const nextMax = playerMaxHp(prof?.level, statsOf(prof));
    if (nextMax !== ps.maxHp) {
      const prevMax = ps.maxHp || nextMax;
      ps.maxHp = nextMax;
      if (ps.hp > 0) {
        if (ps.hp >= prevMax) ps.hp = nextMax;
        else ps.hp = Math.min(nextMax, ps.hp);
      }
    }
    return ps;
  }

  function playerState(sh, uid, prof = null) {
    let ps = sh.live.players.get(uid);
    const pr = prof || db.getProfile?.(uid);
    if (!ps) {
      const maxHp = playerMaxHp(pr?.level, statsOf(pr));
      ps = {
        hp: maxHp, maxHp, downUntil: 0, lastAttackAt: 0, attackReadyAt: 0, comboStep: 0,
        ultReadyAt: 0, skillCds: [0, 0, 0, 0], buffs: {}, shield: 0, shieldHp: 0, shieldUntil: 0,
        lastHitAt: 0, lastRegenAt: 0, vitalityFrac: 0, vitalityTickerGain: 0, lastVitalityTickerAt: 0,
      };
      sh.live.players.set(uid, ps);
    } else if (pr) {
      syncPlayerMaxHp(ps, pr);
      ps.skillCds ||= [0, 0, 0, 0];
      while (ps.skillCds.length < SKILL_SLOT_COUNT) ps.skillCds.push(0);
    }
    return ps;
  }

  const outpostOf = (sh, regionId) => (sh.durable.outposts[regionId] ||= { hp: OUTPOST.maxHp, maxHp: OUTPOST.maxHp, offline: false });
  const outpostWire = (sh, regionId) => {
    const op = outpostOf(sh, regionId);
    const poi = REGIONS[regionId]?.pois?.outpost || { x: 0, z: 0 };
    return { regionId, hp: op.hp, maxHp: op.maxHp || OUTPOST.maxHp, offline: !!op.offline, x: poi.x, z: poi.z };
  };
  const compactMonster = (m) => {
    const t = now();
    return [m.id, m.type, r1(m.x), r1(m.z), Math.max(0, Math.round(m.hp)), m.maxHp, m.isElite ? 1 : 0, tagMask(m, t), poiseWire(m, t)];
  };
  const buffActive = (ps, key, t) => {
    const b = ps?.buffs?.[key];
    if (!b) return null;
    if (b.until && t >= b.until) { delete ps.buffs[key]; return null; }
    return b;
  };

  function collectActiveBuffs(ps, t) {
    const haste = buffActive(ps, 'haste', t);
    const dr = buffActive(ps, 'dmg_reduce', t);
    const crit = buffActive(ps, 'crit_up', t);
    return {
      hasteUntil: haste?.until > t ? haste.until : 0,
      hastePct: haste?.until > t ? (Number(haste.pct) || 0) : 0,
      dmgReduceUntil: dr?.until > t ? dr.until : 0,
      critUpUntil: crit?.until > t ? crit.until : 0,
      resonanceUntil: ps?.buffs?.resonance?.until > t ? ps.buffs.resonance.until : 0,
    };
  }

  function ensureRegionPopulated(sh, regionId, t) {
    const members = regionMembers(sh.id, regionId);
    if (!members.size) return;
    const R = liveRegion(sh, regionId);
    R.lastActiveAt = t;
    if (R.hibernated || R.count === 0) {
      R.hibernated = false;
      tickAmbient(sh, regionId, members, R, t);
    }
  }

  function broadcastShard(sh, msg) {
    for (const regionId of REGION_IDS) broadcast(regionInstanceId(sh.id, regionId), msg);
  }

  function invasionWire(sh) {
    const inv = sh.durable.invasion;
    return { phase: inv.phase, nextAt: inv.nextAt || 0, at: inv.at || 0, wave: inv.wave || 0, waves: INVASION.WAVES, endsAt: inv.endsAt || 0, remaining: sh.live.invWaveAlive || 0 };
  }

  function bossWire(sh, regionId) {
    const id = sh.live.bosses.get(regionId);
    const b = id && sh.live.monsters.get(id);
    if (!b) return null;
    return { id: b.id, bossId: b.type, name: BOSSES[b.type]?.name, hp: Math.max(0, Math.round(b.hp)), maxHp: b.maxHp, x: r1(b.x), z: r1(b.z), stage: b.stage, encounterUid: b.encounterUid, startedAt: b.startedAt, expiresAt: b.startedAt + COMBAT.BOSS_TIMEOUT_MS, poise: Math.max(0, Math.round(b.poise || 0)), maxPoise: b.maxPoise || 0, breakUntil: b.breakUntil || 0 };
  }

  function combatSnapshot(sh, regionId) {
    if (membersOf(sh.id).size > 0) ensureActive(sh);
    const t = now();
    ensureRegionPopulated(sh, regionId, t);
    const monsters = [];
    for (const m of sh.live.monsters.values()) if (m.regionId === regionId) monsters.push(compactMonster(m));
    const playerHp = {};
    for (const uid of regionMembers(sh.id, regionId)) {
      const ps = playerState(sh, uid);
      if (!ps) continue;
      const shHp = activeShieldOf(ps, t);
      playerHp[uid] = {
        hp: Math.max(0, Math.round(ps.hp)),
        maxHp: ps.maxHp,
        shield: shHp,
        shieldHp: shHp,
        downUntil: ps.downUntil > t ? ps.downUntil : 0,
        buffs: collectActiveBuffs(ps, t),
      };
    }
    return {
      monsters,
      playerHp,
      outpost: outpostWire(sh, regionId),
      invasion: invasionWire(sh),
      boss: bossWire(sh, regionId),
      bossCooldownUntil: sh.durable.bossCd?.[regionId] || 0,
      combatTickMs: COMBAT.TICK_MS,
    };
  }

  // ---- monsters ---------------------------------------------------------------------------------
  function spawnMonster(sh, regionId, type, kind, x, z, { hpMult = 1, boss = null, forceElite = null } = {}) {
    const R = liveRegion(sh, regionId);
    R.lastActiveAt = now();
    R.hibernated = false;
    if (R.count >= COMBAT.MONSTER_CAP) return null;
    const def = boss || MONSTERS[type];
    if (!def) return null;
    let isElite = false;
    if (kind === 'ambient' && !boss) {
      let activeElites = 0;
      for (const o of sh.live.monsters.values()) {
        if (o.regionId === regionId && o.isElite) activeElites += 1;
      }
      isElite = forceElite === true
        ? true
        : forceElite === false
          ? false
          : (activeElites < ALPHA_ELITE.MAX_PER_REGION && rng() < ALPHA_ELITE.SPAWN_CHANCE);
    }
    const maxHp = Math.max(1, Math.round(def.hp * hpMult * (isElite ? ALPHA_ELITE.HP_MULT : 1)));
    const dmg = isElite ? Math.max(1, Math.round(def.dmg * ALPHA_ELITE.DMG_MULT)) : def.dmg;
    const id = `mob_${++sh.live.monsterSeq}`;
    const m = {
      id, type, kind, regionId, x, z, hp: maxHp, maxHp,
      dmg, speed: def.speed ?? (boss ? 1.1 : 1.5), ranged: !!def.ranged,
      isElite: !!isElite,
      provokedUntil: 0,
      skillCdUntil: isElite ? now() + 3500 : 0,
      telegraph: null,
      vulnUntil: 0,
      vulnPct: 0,
      targetId: null, atkCdUntil: 0, stunUntil: 0, slowUntil: 0, frozenUntil: 0,
      homeX: x, homeZ: z, hits: {}, dmgMult: 1,
      tags: {}, burnDps: 0, burnBy: null, burnNextAt: 0, missUntil: 0, missPct: 0,
      wardHp: 0, wardUntil: 0, wardNextAt: 0,
    };
    const mp = maxPoiseFor(type, { isBoss: kind === 'boss' || !!boss, isElite });
    m.maxPoise = mp;
    m.poise = mp;
    m.breakUntil = 0;
    m.poiseHitAt = 0;
    sh.live.monsters.set(id, m);
    R.count += 1;
    if (kind === 'ambient') R.ambientAlive += 1;
    if (kind === 'wave') sh.live.invWaveAlive += 1;
    R.dirty.add(id);
    if (isElite) {
      broadcast(regionInstanceId(sh.id, regionId), {
        type: 'sf_fx',
        kind: 'alpha_spawn',
        id: m.id,
        monsterType: m.type,
        x: r1(m.x),
        z: r1(m.z),
      });
    }
    return m;
  }

  function randomAmbientPos(regionId) {
    const region = REGIONS[regionId];
    const lim = region.zone.halfSize - 4;
    const avoid = [region.spawn, region.pois.outpost, ...Object.entries(region.pois).filter(([k]) => k.startsWith('gate_')).map(([, v]) => v)].filter(Boolean);
    let x = 0, z = 0;
    for (let tries = 0; tries < 24; tries++) {
      x = (rng() * 2 - 1) * lim;
      z = (rng() * 2 - 1) * lim;
      if (avoid.every((a) => dist(a.x, a.z, x, z) > COMBAT.AMBIENT_KEEP_OUT)) break;
    }
    return { x: r1(x), z: r1(z) };
  }

  function habitatPos(sh, regionId, type) {
    const region = REGIONS[regionId];
    const def = MONSTERS[type];
    const poi = def?.habitatPoi && region?.pois?.[def.habitatPoi];
    if (!poi) return randomAmbientPos(regionId);
    const avoid = [
      region.spawn,
      region.pois.outpost,
      ...Object.entries(region.pois).filter(([k]) => k.startsWith('gate_')).map(([, v]) => v),
    ].filter(Boolean);
    const nodes = regionNodes(regionId);
    let x = poi.x, z = poi.z;
    for (let tries = 0; tries < 28; tries++) {
      const a = rng() * Math.PI * 2 + (tries > 0 ? tries * 2.399963 : 0);
      const rFrac = tries > 0 ? ((rng() + tries * 0.37) % 1) : rng();
      const r = 1.6 + rFrac * 4.4;
      const clamped = clampToRegion(regionId, poi.x + Math.cos(a) * r, poi.z + Math.sin(a) * r, 2.0);
      const cx = r1(clamped.x);
      const cz = r1(clamped.z);
      if (!avoid.every((av) => dist(av.x, av.z, cx, cz) > 5.5)) continue;
      x = cx;
      z = cz;
      const minMobSep = tries < 18 ? 1.55 : 0.95;
      let crowded = false;
      if (sh?.live?.monsters) {
        for (const other of sh.live.monsters.values()) {
          if (other.regionId !== regionId) continue;
          if (dist(other.x, other.z, cx, cz) < minMobSep || dist(other.homeX, other.homeZ, cx, cz) < minMobSep) {
            crowded = true;
            break;
          }
        }
      }
      if (!crowded && tries < 18 && nodes?.length) {
        for (const nd of nodes) {
          if (dist(nd.x, nd.z, cx, cz) < 1.15) {
            crowded = true;
            break;
          }
        }
      }
      if (!crowded) break;
    }
    return { x: r1(x), z: r1(z) };
  }

  function wavePos(regionId) {
    const region = REGIONS[regionId];
    const c = region.pois.outpost || { x: 0, z: 0 };
    const a = rng() * Math.PI * 2;
    const r = Math.min(region.zone.halfSize - 4, 16 + rng() * 4);
    const p = clampToRegion(regionId, c.x + Math.cos(a) * r, c.z + Math.sin(a) * r, 1);
    return { x: r1(p.x), z: r1(p.z) };
  }

  function removeMonster(sh, m) {
    if (!sh.live.monsters.delete(m.id)) return false;
    const R = liveRegion(sh, m.regionId);
    R.count = Math.max(0, R.count - 1);
    R.dirty.delete(m.id);
    if (m.kind === 'ambient') { R.ambientAlive = Math.max(0, R.ambientAlive - 1); }
    if (m.kind === 'wave') sh.live.invWaveAlive = Math.max(0, sh.live.invWaveAlive - 1);
    if (m.kind === 'boss' && sh.live.bosses.get(m.regionId) === m.id) sh.live.bosses.delete(m.regionId);
    return true;
  }

  /** Contribution ledgers: wave kills / heals / repairs feed the invasion; boss hits + heals near a boss feed the boss. */
  function credit(sh, regionId, uid, amounts, mon = null) {
    const inv = sh.durable.invasion;
    if (inv.phase === 'active' && (mon ? mon.kind === 'wave' : true)) addContribution(sh.live.invLedger, uid, amounts);
    if (mon?.kind === 'boss') addContribution(mon.ledger, uid, amounts);
    else if (!mon && (amounts.heal || amounts.repair)) {
      const bid = sh.live.bosses.get(regionId);
      const b = bid && sh.live.monsters.get(bid);
      if (b) addContribution(b.ledger, uid, amounts);
    }
  }

  function damageMonster(sh, m, uid, amount, t) {
    if (!m || m.hp <= 0 || !sh.live.monsters.has(m.id)) return 0;
    let dmg = Math.max(0, Math.round(amount));
    if (m.frozenUntil > t && m.vuln) dmg = Math.round(dmg * (1 + m.vuln));
    if (m.vulnUntil > t && m.vulnPct) dmg = Math.round(dmg * (1 + m.vulnPct));
    else if ((m.tags?.marked || 0) > t) dmg = Math.round(dmg * (1 + (STATUS_TAGS.marked.dmgTakenPct || 0.15)));
    // Guard (poise): Armored mobs take reduced damage until broken; any broken Guard takes bonus damage.
    if ((m.breakUntil || 0) > t) {
      dmg = Math.round(dmg * POISE.BREAK_DMG_MULT);
    } else if (m.maxPoise > 0 && (m.poise || 0) > 0 && archetypeOf(m.type)?.archetype === 'armored') {
      dmg = Math.round(dmg * (1 - MONSTER_ARCHETYPES.armored.guardReduce));
    }
    // Support ward absorbs first.
    if (dmg > 0 && (m.wardUntil || 0) > t && (m.wardHp || 0) > 0) {
      const absorbed = Math.min(m.wardHp, dmg);
      m.wardHp -= absorbed;
      dmg -= absorbed;
      if (m.wardHp <= 0) { m.wardHp = 0; m.wardUntil = 0; }
    }
    const dealt = Math.min(m.hp, dmg);
    m.hp -= dmg;
    if (m.hp > 0) m.provokedUntil = t + 12000;
    if (m.kind === 'ambient' && (m.isElite || MONSTERS[m.type]?.aggroStyle === 'pack')) {
      for (const other of sh.live.monsters.values()) {
        if (
          other.id !== m.id
          && other.regionId === m.regionId
          && other.kind === 'ambient'
          && other.type === m.type
          && dist(m.x, m.z, other.x, other.z) <= ALPHA_ELITE.PACK_ASSIST_RADIUS
        ) {
          other.provokedUntil = Math.max(other.provokedUntil || 0, t + 10000);
        }
      }
    }
    if (uid) {
      m.hits[uid] = (m.hits[uid] || 0) + dealt;
      credit(sh, m.regionId, uid, { dmg: dealt }, m);
    }
    liveRegion(sh, m.regionId).dirty.add(m.id);
    if (m.kind === 'boss') liveRegion(sh, m.regionId).bossDirty = true;
    if (m.kind === 'boss' && m.hp > 0) {
      const frac = m.hp / m.maxHp;
      const phases = BOSSES[m.type]?.phases || [1, 0.6, 0.3];
      let stage = 0;
      for (let i = 1; i < phases.length; i++) if (frac <= phases[i]) stage = i;
      if (stage > m.stage) {
        m.stage = stage;
        m.dmgMult = COMBAT.ENRAGE_MULT ** stage;
        broadcast(regionInstanceId(sh.id, m.regionId), { type: 'sf_boss', event: 'enrage', regionId: m.regionId, ...bossWire(sh, m.regionId) });
      }
    }
    if (m.hp <= 0) killMonster(sh, m, uid, t);
    return dealt;
  }

  // ---- Master Crafters combo layer: status tags, reactions, Guard (poise) --------------------------
  /** Chips a monster's Guard. Breaking it stuns, cancels telegraphs and opens a bonus-damage window. */
  function chipPoise(sh, m, amount, uid, t) {
    if (!m || !(m.maxPoise > 0) || !(amount > 0) || m.hp <= 0) return false;
    if ((m.breakUntil || 0) > t) return false;
    m.poise = Math.max(0, (m.poise || 0) - amount);
    m.poiseHitAt = t;
    liveRegion(sh, m.regionId).dirty.add(m.id);
    if (m.kind === 'boss') liveRegion(sh, m.regionId).bossDirty = true;
    if (m.poise > 0) return false;
    m.breakUntil = t + POISE.BREAK_MS;
    m.stunUntil = Math.max(m.stunUntil || 0, t + POISE.BREAK_STUN_MS);
    if (m.telegraph) m.telegraph = null;
    const isBoss = m.kind === 'boss';
    if (isBoss) liveRegion(sh, m.regionId).bossDirty = true;
    broadcast(regionInstanceId(sh.id, m.regionId), {
      type: 'sf_fx', kind: 'guard_break', id: m.id, monsterType: m.type,
      x: r1(m.x), z: r1(m.z), isBoss, by: uid || null, breakUntil: m.breakUntil,
    });
    return true;
  }

  /**
   * Unified hit pipeline for skills, basic attacks and zone ticks (data-driven effect pipeline):
   *  1. resolve reactions against the target's CURRENT tags (a hit never combos with its own tags)
   *  2. reaction × elemental multipliers → damageMonster (which adds Marked / Guard / Ward modifiers)
   *  3. reaction side-effects (stun, scald steam, wildfire spread), tag consumption, Guard chip
   *  4. apply this hit's own tags (immunities + Magic Echo duration)
   * ctx: { traits, applies, source: 'skill'|'basic'|'zone', tagDurMult, tagMs: {tag: ms}, extraPoise, reactionsOut }
   */
  function comboHit(sh, mon, uid, baseDmg, t, ctx = {}) {
    if (!mon || mon.hp <= 0 || !sh.live.monsters.has(mon.id)) return { dealt: 0, reactions: [] };
    const traits = ctx.traits || [];
    const source = ctx.source || 'skill';
    const reactions = resolveReactions(mon, { traits, source }, t);
    const mult = reactionDamageMult(reactions) * elementMult(mon.type, traits) * (ctx.dmgMult || 1);
    const dmg = Math.max(0, Math.round((Number(baseDmg) || 0) * mult));
    const hx = mon.x, hz = mon.z;
    let poiseDmg = (source === 'skill' ? POISE.DAMAGE.skillHit : 0) + (ctx.extraPoise || 0);
    if (traits.includes('heavy')) poiseDmg += POISE.DAMAGE.heavyHit;
    for (const r of reactions) {
      poiseDmg += r.poise || 0;
      for (const tg of r.consume || []) clearTag(mon, tg, t);
      if (r.stunMs) mon.stunUntil = Math.max(mon.stunUntil || 0, t + (mon.kind === 'boss' ? Math.round(r.stunMs * 0.4) : r.stunMs));
      if (r.missPct) { mon.missUntil = t + (r.missMs || 3000); mon.missPct = r.missPct; }
      if (r.freezeMs && !isTagImmune(mon.type, 'chilled')) {
        mon.frozenUntil = Math.max(mon.frozenUntil || 0, t + (mon.kind === 'boss' ? Math.round(r.freezeMs * 0.4) : r.freezeMs));
      }
      if (r.spreadRadius) {
        for (const other of sh.live.monsters.values()) {
          if (other === mon || other.regionId !== mon.regionId || other.hp <= 0) continue;
          if (isTagImmune(other.type, 'burning')) continue;
          if (dist(hx, hz, other.x, other.z) > r.spreadRadius) continue;
          applyTag(other, 'burning', t);
          other.burnDps = Math.max(other.burnDps || 0, mon.burnDps || Math.max(1, Math.round(dmg * STATUS_TAGS.burning.dpsPct)));
          other.burnBy = uid;
          if (!(other.burnNextAt > t)) other.burnNextAt = t + 1000;
          liveRegion(sh, other.regionId).dirty.add(other.id);
        }
      }
      if (ctx.reactionsOut) ctx.reactionsOut.push([mon.id, r.id, round2(hx), round2(hz), uid || null]);
    }
    const dealt = dmg > 0 ? damageMonster(sh, mon, uid, dmg, t) : 0;
    if (dmg <= 0) liveRegion(sh, mon.regionId).dirty.add(mon.id);
    const alive = mon.hp > 0 && sh.live.monsters.has(mon.id);
    if (alive) {
      const durMult = ctx.tagDurMult || 1;
      for (const tg of ctx.applies || []) {
        if (isTagImmune(mon.type, tg)) continue;
        applyTag(mon, tg, t, ctx.tagMs?.[tg] ?? null, durMult);
        if (tg === 'burning') {
          mon.burnDps = Math.max(mon.burnDps || 0, Math.max(1, Math.round((Number(baseDmg) || 0) * STATUS_TAGS.burning.dpsPct)));
          mon.burnBy = uid;
          if (!(mon.burnNextAt > t)) mon.burnNextAt = t + 1000;
        } else if (tg === 'staggered') {
          poiseDmg += POISE.DAMAGE.staggerApply;
        }
      }
      chipPoise(sh, mon, poiseDmg, uid, t);
    }
    return { dealt, reactions };
  }

  /** Records reaction triggers on the player's profile; first discovery of each reaction grants 💎. */
  function noteReactions(uid, reactionsOut, instanceId) {
    if (!uid || !reactionsOut?.length) return;
    const prof = db.getProfile?.(uid);
    if (!prof) return;
    const skills = ensureFrontierSkills(prof);
    let discovered = false;
    for (const entry of reactionsOut) {
      if (entry[4] && entry[4] !== uid) continue;
      const rid = entry[1];
      if (!REACTIONS[rid]) continue;
      const prev = Number(skills.reactionsFound[rid]) || 0;
      skills.reactionsFound[rid] = prev + 1;
      if (prev === 0) {
        discovered = true;
        prof.diamonds = Math.max(0, (Number(prof.diamonds) || 0) + REACTION_DISCOVERY_DIAMONDS);
        broadcast(instanceId, {
          type: 'sf_fx', kind: 'reaction_discovered', userId: uid, reactionId: rid,
          diamonds: REACTION_DISCOVERY_DIAMONDS, total: Object.keys(skills.reactionsFound).length,
        });
      }
    }
    db.markProfile?.(uid);
    if (discovered) notifyProfileChanged(prof);
  }

  function lootMult(sh, uid, t) {
    const ps = sh.live.players.get(uid);
    let mult = 1;
    const lb = buffActive(ps, 'loot_boost', t);
    if (lb) mult *= 1 + (lb.pct || 0);
    if (buffActive(ps, 'loot_shower', t)) mult *= 2;
    return mult;
  }

  function grantMonsterSkillScroll(prof, skillId, isBoss, instanceId = null, { skipNotify = false, floor = false } = {}) {
    if (!prof || !MONSTER_SKILLS[skillId]) return null;
    const skills = ensureFrontierSkills(prof);
    const curLv = skills.unlocked[skillId] | 0;
    let maxedGold = 0;
    let essenceGain = 0;
    let autoEquippedSlot = null;
    if (curLv < SKILL_DROP_RATES.MAX_LEVEL) {
      skills.unlocked[skillId] = curLv + 1;
      if (curLv === 0 && !skills.equipped.includes(skillId)) {
        const open = skillSlotUnlocks(prof);
        const emptyIdx = skills.equipped.findIndex((x, i) => open[i] && (x === null || x === undefined));
        if (emptyIdx >= 0) {
          skills.equipped[emptyIdx] = skillId;
          autoEquippedSlot = emptyIdx;
        }
      }
    } else {
      maxedGold = isBoss ? SKILL_DROP_RATES.EXCESS_GOLD_BOSS : SKILL_DROP_RATES.EXCESS_GOLD_MOB;
      prof.gold = Math.max(0, (prof.gold | 0) + maxedGold);
      essenceGain = isBoss ? ESSENCE.PER_EXCESS_BOSS : ESSENCE.PER_EXCESS_MOB;
      skills.essence = (Number(skills.essence) || 0) + essenceGain;
    }
    db.markProfile?.(prof.id);
    if (!skipNotify) notifyProfileChanged(prof);
    const fxPayload = {
      type: 'sf_fx',
      kind: 'skill_scroll_drop',
      userId: prof.id,
      username: prof.username || prof.id,
      skillId,
      prevLevel: curLv,
      newLevel: skills.unlocked[skillId] | 0,
      maxedGold,
      essenceGain,
      autoEquippedSlot,
      isBoss: !!isBoss,
      floor: !!floor,
    };
    if (instanceId) broadcast(instanceId, fxPayload);
    return fxPayload;
  }

  function grantMonsterPassive(prof, passiveId, instanceId = null, { skipNotify = false } = {}) {
    if (!prof || !MONSTER_PASSIVES[passiveId]) return null;
    const skills = ensureFrontierSkills(prof);
    const curLv = Number(skills.passives[passiveId]) || 0;
    let essenceGain = 0;
    let autoEquipped = false;
    if (curLv < PASSIVE_DROP_RATES.MAX_LEVEL) {
      skills.passives[passiveId] = curLv + 1;
      if (curLv === 0 && !skills.passive) {
        skills.passive = passiveId;
        autoEquipped = true;
      }
    } else {
      essenceGain = ESSENCE.PER_EXCESS_PASSIVE;
      skills.essence = (Number(skills.essence) || 0) + essenceGain;
    }
    db.markProfile?.(prof.id);
    if (!skipNotify) notifyProfileChanged(prof);
    const fxPayload = {
      type: 'sf_fx', kind: 'passive_drop', userId: prof.id, username: prof.username || prof.id,
      passiveId, prevLevel: curLv, newLevel: Number(skills.passives[passiveId]) || 0, essenceGain, autoEquipped,
    };
    if (instanceId) broadcast(instanceId, fxPayload);
    return fxPayload;
  }

  function killMonster(sh, m, killerId, t) {
    if (!removeMonster(sh, m)) return;
    const inst = regionInstanceId(sh.id, m.regionId);
    if (m.kind === 'ambient') {
      const crowdN = Math.max(0, regionMembers(sh.id, m.regionId).size - 1);
      const respawnMs = Math.max(COMBAT.AMBIENT_RESPAWN_MIN_MS, Math.round(COMBAT.AMBIENT_RESPAWN_MS / (1 + COMBAT.AMBIENT_RESPAWN_CROWD_PCT * crowdN)));
      liveRegion(sh, m.regionId).ambientDue.push({ at: t + respawnMs, type: m.type });
    }
    if (m.kind === 'boss') {
      broadcast(inst, { type: 'sf_monster_dead', id: m.id, regionId: m.regionId, monsterType: m.type, isElite: false, by: killerId || null, drops: {} });
      bossDefeated(sh, m, t);
      return;
    }
    const rawDrop = MONSTERS[m.type]?.drop || {};
    const drop = {};
    for (const [k, v] of Object.entries(rawDrop)) {
      drop[k] = m.isElite ? Math.round((v || 0) * ALPHA_ELITE.MAT_MULT) : v;
    }
    const hitters = Object.keys(m.hits);
    let shares = {};
    if (hitters.length === 1) shares = { [hitters[0]]: { ...drop } };
    else if (hitters.length > 1) shares = splitLoot({ hits: m.hits, baseDrop: drop, fortuneMult: 1 }).shares;
    const coupleResonanceUsers = [];
    const overflowByUser = {};
    const whFullUsers = [];
    for (const [uid, items] of Object.entries(shares)) {
      const prof = db.getProfile?.(uid);
      if (!prof) continue;
      if (hitters.length > 1) {
        for (const [k, baseAmt] of Object.entries(drop)) {
          if ((items[k] || 0) < (baseAmt || 0)) items[k] = baseAmt || 0;
        }
      }
      let hasCoupleResonance = false;
      if (isCouple(prof) && prof.partner_id) {
        if (hitters.includes(prof.partner_id)) {
          hasCoupleResonance = true;
        } else {
          const instMembers = instances.get(inst);
          const partPres = presence.get(prof.partner_id);
          if (instMembers?.has(prof.partner_id) && partPres) {
            const dPart = Math.hypot((partPres.x || 0) - m.x, (partPres.z || 0) - m.z);
            if (dPart <= 12.0) hasCoupleResonance = true;
          }
        }
      }
      const mult = lootMult(sh, uid, t) * (hasCoupleResonance ? 1.25 : 1.0);
      if (hasCoupleResonance) coupleResonanceUsers.push(uid);
      if (mult !== 1) for (const k of Object.keys(items)) items[k] = Math.max(items[k] + (hasCoupleResonance ? 1 : 0), Math.round(items[k] * mult));
      const gRes = grant(prof, items);
      if (gRes?.overflow && Object.keys(gRes.overflow).length > 0) overflowByUser[uid] = gRes.overflow;
      if (m.isElite) {
        prof.gold = Math.max(0, (prof.gold | 0) + ALPHA_ELITE.GOLD_BONUS);
      }
      const pf = ensureFrontier(prof);
      if (pf) {
        pf.stats ||= {};
        pf.stats.kills = (pf.stats.kills || 0) + 1;
        if (m.isElite) pf.stats.elites = (pf.stats.elites || 0) + 1;
        pf.stats.killsByMob ||= {};
        pf.stats.killsByMob[m.type] = (pf.stats.killsByMob[m.type] || 0) + 1;
        recordBountyProgress(pf, { kind: 'mob_kills', region: m.regionId, target: m.type, amount: 1 }, t);
        for (const [matId, n] of Object.entries(items)) {
          if (n > 0) recordBountyProgress(pf, { kind: 'gather_item', target: matId, amount: n }, t);
        }
        if (warehouseFreeSpace(pf.warehouse) <= 0) whFullUsers.push(uid);
      }
      prof.story ||= defaultStory();
      recordEvent(prof.story, { kind: 'defeat', target: m.type });
      notifyProfileChanged(prof);
    }
    // Roll Monster Skill Scroll drop for killer & co-op contributors within 14m
    const scrollEligible = new Set();
    if (killerId) scrollEligible.add(killerId);
    for (const uid of hitters) {
      if (uid === killerId) continue;
      const pPres = presence.get(uid);
      if (!pPres || dist(pPres.x, pPres.z, m.x, m.z) <= 14.0) scrollEligible.add(uid);
    }
    for (const uid of scrollEligible) {
      const prof = db.getProfile?.(uid);
      if (!prof) continue;
      const uMods = skyFrontierMods(statsOf(prof));
      const skDrop = rollMonsterSkillDrop({
        sourceId: m.type,
        isBoss: false,
        isElite: !!m.isElite,
        rareFindMult: uMods.rareFindMult,
        rng,
      });
      const skDef = skillBySource(m.type);
      let floor = false;
      if (!(skDrop.dropped && skDrop.skillId) && skDef) {
        const uSkills = ensureFrontierSkills(prof);
        const kills = Number(prof.frontier?.stats?.killsByMob?.[m.type]) || 0;
        if ((uSkills.unlocked[skDef.id] | 0) === 0 && kills >= SCROLL_FLOOR_KILLS.mob) {
          skDrop.dropped = true;
          skDrop.skillId = skDef.id;
          floor = true;
        }
      }
      if (skDrop.dropped && skDrop.skillId) {
        grantMonsterSkillScroll(prof, skDrop.skillId, false, inst, { floor });
      }
      const psDrop = rollMonsterPassiveDrop({ sourceId: m.type, isElite: !!m.isElite, rareFindMult: uMods.rareFindMult, rng });
      if (psDrop.dropped && psDrop.passiveId) {
        grantMonsterPassive(prof, psDrop.passiveId, inst);
      }
    }
    broadcast(inst, {
      type: 'sf_monster_dead',
      id: m.id,
      regionId: m.regionId,
      monsterType: m.type,
      isElite: !!m.isElite,
      by: killerId || null,
      drops: shares,
      coupleResonanceUsers,
      overflowByUser,
      whFullUsers,
    });
  }

  // ---- players ----------------------------------------------------------------------------------
  function emitHp(sh, regionId, uid, ps, t, extra = null) {
    const shHp = activeShieldOf(ps, t);
    broadcast(regionInstanceId(sh.id, regionId), {
      type: 'sf_player_hp', id: uid, hp: Math.max(0, Math.round(ps.hp)), maxHp: ps.maxHp,
      shield: shHp, shieldHp: shHp, downUntil: ps.downUntil > t ? ps.downUntil : 0,
      ...(extra || {}),
    });
  }

  function damagePlayer(sh, regionId, uid, amount, t, attackerMon = null) {
    const ps = playerState(sh, uid);
    if (ps.downUntil > t) return 0;
    const rawDmg = Math.max(0, Math.round(amount));
    let dmg = rawDmg;
    const dr = buffActive(ps, 'dmg_reduce', t);
    if (dr?.pct && dmg > 0) dmg = Math.max(1, Math.round(dmg * (1 - dr.pct)));
    if (dmg > 0) {
      const pas = activePassive(db.getProfile?.(uid));
      if (pas?.def.kind === 'dmg_taken') dmg = Math.max(1, Math.round(dmg * (1 - pas.value)));
    }
    if (dr?.reflectPct > 0 && rawDmg > 0 && attackerMon && attackerMon.hp > 1 && sh.live.monsters.has(attackerMon.id)) {
      const thornDmg = Math.max(1, Math.round(rawDmg * 0.35));
      const newHp = Math.max(1, attackerMon.hp - thornDmg);
      const reflected = attackerMon.hp - newHp;
      if (reflected > 0) {
        attackerMon.hp = newHp;
        attackerMon.hits[uid] = (attackerMon.hits[uid] || 0) + reflected;
        credit(sh, regionId, uid, { dmg: reflected }, attackerMon);
        liveRegion(sh, regionId).dirty.add(attackerMon.id);
      }
    }
    const curShield = activeShieldOf(ps, t);
    if (curShield > 0) {
      const absorbed = Math.min(curShield, dmg);
      const remShield = curShield - absorbed;
      ps.shieldHp = remShield;
      ps.shield = remShield;
      if (remShield <= 0) ps.shieldUntil = 0;
      dmg -= absorbed;
    }
    const wasFull = ps.hp >= ps.maxHp;
    ps.hp -= dmg;
    ps.lastHitAt = t;
    if (ps.hp < ps.maxHp && ((ps.vitalityTickerGain || 0) === 0 || !ps.lastVitalityTickerAt)) {
      ps.lastVitalityTickerAt = t;
      if (!ps.lastRegenAt || wasFull) ps.lastRegenAt = t;
    }
    if (ps.hp <= 0) knockOut(sh, regionId, uid, ps, t);
    emitHp(sh, regionId, uid, ps, t);
    return dmg;
  }

  /** Knockout (§8.6): no item loss, lose the meal buff, respawn at the nearest online outpost after DOWN_MS. */
  function knockOut(sh, regionId, uid, ps, t) {
    ps.hp = 0;
    ps.downUntil = t + COMBAT.DOWN_MS;
    ps.shield = 0;
    ps.shieldHp = 0;
    ps.shieldUntil = 0;
    const prof = db.getProfile?.(uid);
    const fr = prof && ensureFrontier(prof);
    if (fr) {
      const hadBuff = !!fr.mealBuff;
      fr.mealBuff = null;
      fr.stats ||= {};
      fr.stats.knockouts = (fr.stats.knockouts || 0) + 1;
      db.markProfile?.(uid);
      if (hadBuff) onProfileChanged(prof);
    }
    for (const m of sh.live.monsters.values()) if (m.targetId === uid) m.targetId = null;
    broadcast(regionInstanceId(sh.id, regionId), { type: 'sf_player_down', id: uid, regionId, until: ps.downUntil, lostMealBuff: true });
  }

  function respawnPoint(sh, regionId) {
    const region = REGIONS[regionId];
    const op = outpostOf(sh, regionId);
    const poi = region.pois.outpost;
    if (poi && !op.offline) return clampToRegion(regionId, poi.x, poi.z + 2, 0.4);
    return { x: region.spawn.x, z: region.spawn.z };
  }

  function respawnPlayer(sh, regionId, uid, ps, t) {
    ps.downUntil = 0;
    ps.hp = ps.maxHp;
    ps.lastHitAt = 0;
    const pos = respawnPoint(sh, regionId);
    const s = presence.get(uid);
    const inst = regionInstanceId(sh.id, regionId);
    if (s) {
      s.x = pos.x; s.z = pos.z; s.vx = 0; s.vz = 0; s.t = t;
      const ws = sockets?.get?.(uid);
      send(ws, { type: 'position_correct', x: pos.x, z: pos.z, zoneSeq: ws?.zoneSeq });
      broadcast(inst, { type: 'player_moved', id: uid, x: pos.x, z: pos.z, vx: 0, vz: 0, right: s.right, back: s.back }, uid);
    }
    broadcast(inst, { type: 'sf_player_respawn', id: uid, regionId, x: pos.x, z: pos.z, hp: ps.hp, maxHp: ps.maxHp });
    emitHp(sh, regionId, uid, ps, t);
  }

  // ---- tick ---------------------------------------------------------------------------------------
  function tick(shardId, t = now()) {
    const sh = shards.get(shardId);
    if (!sh) { stopTimer(shardId); return; }
    const L = sh.live;
    const dt = Math.min(0.5, Math.max(0, (t - (L.lastTickAt || t - COMBAT.TICK_MS)) / 1000));
    L.lastTickAt = t;
    let memberCount = 0;
    for (const regionId of REGION_IDS) memberCount += regionMembers(shardId, regionId).size;
    if (memberCount === 0) {
      // Safety net (onLeave normally hibernates first): never tick an empty shard for long.
      if (!L.emptySince) L.emptySince = t;
      else if (t - L.emptySince >= COMBAT.EMPTY_GRACE_MS) hibernate(sh);
      return;
    }
    L.emptySince = 0;
    for (const regionId of REGION_IDS) {
      const members = regionMembers(shardId, regionId);
      const existingR = L.regions.get(regionId);
      if (!members.size) {
        if (existingR) {
          if (existingR.skillZones?.length) {
            for (let i = existingR.skillZones.length - 1; i >= 0; i--) {
              if (t >= existingR.skillZones[i].endsAt) existingR.skillZones.splice(i, 1);
            }
          }
          const bid = L.bosses.get(regionId);
          const bm = bid && L.monsters.get(bid);
          if (bm && t - bm.startedAt >= COMBAT.BOSS_TIMEOUT_MS) {
            removeMonster(sh, bm);
          }
          if (!existingR.hibernated && !L.bosses.has(regionId) && t - (existingR.lastActiveAt || 0) > 60000) {
            for (const m of L.monsters.values()) {
              if (m.regionId === regionId && m.kind === 'ambient') {
                removeMonster(sh, m);
              }
            }
            existingR.ambientDue.length = 0;
            existingR.dirty.clear();
            existingR.hibernated = true;
          }
        }
        continue; // skip AI for regions without players
      }
      const R = existingR || liveRegion(sh, regionId);
      R.lastActiveAt = t;
      R.hibernated = false;
      tickPlayers(sh, regionId, members, t);
      if (R.skillZones?.length) tickSkillZones(sh, regionId, R, t);
      tickAmbient(sh, regionId, members, R, t);
      tickMonsters(sh, regionId, members, t, dt);
    }
    if (L.effects.length) tickEffects(sh, t);
    tickInvasion(sh, t);
    for (const regionId of REGION_IDS) {
      const R = L.regions.get(regionId);
      if (R) flushRegion(sh, regionId, R, t);
    }
    if (t - L.lastSweepAt >= 5000) {
      L.lastSweepAt = t;
      for (const uid of L.players.keys()) if (!userRegion(sh, uid)) L.players.delete(uid);
      for (const uid of L.lastStrike.keys()) if (!userRegion(sh, uid)) L.lastStrike.delete(uid);
      for (const uid of L.perfectLog.keys()) if (!userRegion(sh, uid)) L.perfectLog.delete(uid);
      if (L.streak) for (const uid of L.streak.keys()) if (!userRegion(sh, uid)) L.streak.delete(uid);
    }
  }

  function tickPlayers(sh, regionId, members, t) {
    const opPoi = REGIONS[regionId]?.pois?.outpost;
    const op = outpostOf(sh, regionId);
    const sanctuaryOnline = Boolean(opPoi && !op.offline);
    for (const uid of members) {
      const ps = sh.live.players.get(uid);
      if (!ps) continue;
      if (ps.hp <= 0 && !ps.downUntil) {
        knockOut(sh, regionId, uid, ps, t);
        continue;
      }
      if (ps.downUntil) {
        if (t >= ps.downUntil) respawnPlayer(sh, regionId, uid, ps, t);
        continue;
      }
      if (ps.shieldUntil && t >= ps.shieldUntil) { ps.shield = 0; ps.shieldHp = 0; ps.shieldUntil = 0; }
      if (ps.hp >= ps.maxHp) {
        ps.vitalityFrac = 0;
        ps.vitalityTickerGain = 0;
        ps.lastVitalityTickerAt = 0;
        ps.lastRegenAt = t;
        continue;
      }
      if (t - (ps.lastRegenAt || 0) >= COMBAT.REGEN_MS) {
        ps.lastRegenAt = t;
        const s = sanctuaryOnline ? presence.get(uid) : null;
        const inSanctuary = Boolean(s && dist(s.x, s.z, opPoi.x, opPoi.z) <= COMBAT.SANCTUARY_RADIUS);
        if (inSanctuary && t - (ps.lastHitAt || 0) >= COMBAT.SANCTUARY_DELAY_MS) {
          ps.hp = Math.min(ps.maxHp, ps.hp + Math.ceil(ps.maxHp * COMBAT.SANCTUARY_REGEN_PCT));
          ps.vitalityFrac = 0;
          ps.vitalityTickerGain = 0;
          ps.lastVitalityTickerAt = t;
          emitHp(sh, regionId, uid, ps, t, { source: 'sanctuary' });
        } else {
          const prof = db.getProfile?.(uid);
          if (prof) syncPlayerMaxHp(ps, prof);
          const mods = skyFrontierMods(statsOf(prof));
          const regenPas = activePassive(prof);
          const baseRegen = (Number(mods.hpRegenPerSec) || 0.6) + (regenPas?.def.kind === 'regen' ? regenPas.value : 0);
          const effRegen = (t - (ps.lastHitAt || 0) < 2500) ? (0.5 * baseRegen) : baseRegen;
          if (!ps.lastVitalityTickerAt) ps.lastVitalityTickerAt = Math.max(1, t - COMBAT.REGEN_MS);
          ps.vitalityFrac = +((ps.vitalityFrac || 0) + effRegen).toFixed(4);
          const whole = Math.floor(ps.vitalityFrac + 1e-6);
          if (whole >= 1) {
            ps.vitalityFrac = Math.max(0, +(ps.vitalityFrac - whole).toFixed(4));
            const prevHp = ps.hp;
            ps.hp = Math.min(ps.maxHp, ps.hp + whole);
            const actual = ps.hp - prevHp;
            ps.vitalityTickerGain = (ps.vitalityTickerGain || 0) + actual;
          }
          const due10s = (t - ps.lastVitalityTickerAt >= 10000) && ((ps.vitalityTickerGain || 0) >= 1);
          const toppedOff = (ps.hp >= ps.maxHp) && ((ps.vitalityTickerGain || 0) >= 3) && (t - ps.lastVitalityTickerAt >= 3000);
          if (due10s || toppedOff) {
            const tickHeal = Math.round(ps.vitalityTickerGain);
            ps.vitalityTickerGain = 0;
            ps.lastVitalityTickerAt = t;
            emitHp(sh, regionId, uid, ps, t, { source: 'vitality', regenPerSec: +baseRegen.toFixed(2), vitalityTickHeal: tickHeal });
          } else if (whole >= 1) {
            emitHp(sh, regionId, uid, ps, t, { source: 'vitality', regenPerSec: +baseRegen.toFixed(2) });
          }
        }
      }
    }
  }

  function tickSkillZones(sh, regionId, R, t) {
    if (!R.skillZones?.length) return;
    const members = regionMembers(sh.id, regionId);
    const inst = regionInstanceId(sh.id, regionId);
    withBatchedProfileSync(() => {
      for (let i = R.skillZones.length - 1; i >= 0; i--) {
        const z = R.skillZones[i];
        while (z.nextTickAt <= t && z.nextTickAt < z.endsAt) {
          const hits = [];
          const heals = [];
          const reactionsOut = [];
          const zc = ZONE_COMBO[z.kind];
          const zoneHit = (mon) => comboHit(sh, mon, z.by, z.dmgPerTick, z.nextTickAt, {
            traits: zc?.traits || [], applies: zc?.applies || [], source: 'zone', tagDurMult: z.tagDurMult || 1, reactionsOut,
          }).dealt;
          if (z.kind === 'pollen_ring') {
            for (const uid of members) {
              const os = presence.get(uid);
              const ops = playerState(sh, uid);
              if (!os || !ops || ops.downUntil > t) continue;
              if (dist(os.x, os.z, z.x, z.z) > z.radius) continue;
              const gain = Math.min(Math.max(0, ops.maxHp - ops.hp), z.healPerTick);
              if (gain > 0) {
                ops.hp += gain;
                credit(sh, regionId, z.by, { heal: gain });
                emitHp(sh, regionId, uid, ops, z.nextTickAt);
                heals.push([uid, gain]);
              }
            }
          } else if (z.kind === 'koi_whirlpool') {
            for (const mon of sh.live.monsters.values()) {
              if (mon.regionId !== regionId || mon.hp <= 0) continue;
              const d = dist(z.x, z.z, mon.x, mon.z);
              if (d <= z.radius) {
                if (mon.kind !== 'boss' && d > 0.9) {
                  const p2 = clampToRegion(regionId, z.x + ((mon.x - z.x) / d) * 0.9, z.z + ((mon.z - z.z) / d) * 0.9, 0.8);
                  mon.x = p2.x; mon.z = p2.z;
                  R.dirty.add(mon.id);
                }
                const dealt = zoneHit(mon);
                hits.push([mon.id, dealt, false, Math.max(0, Math.round(mon.hp)), round2(mon.x), round2(mon.z)]);
              }
            }
          } else if (z.kind === 'sakura_tempest') {
            if (z.follow) {
              const fs = presence.get(z.follow);
              if (fs) { z.x = fs.x; z.z = fs.z; }
            }
            for (const mon of sh.live.monsters.values()) {
              if (mon.regionId !== regionId || mon.hp <= 0) continue;
              if (dist(z.x, z.z, mon.x, mon.z) <= z.radius) {
                const dealt = zoneHit(mon);
                hits.push([mon.id, dealt, false, Math.max(0, Math.round(mon.hp)), round2(mon.x), round2(mon.z)]);
              }
            }
            for (const uid of members) {
              const os = presence.get(uid);
              const ops = playerState(sh, uid);
              if (!os || !ops || ops.downUntil > t) continue;
              if (dist(os.x, os.z, z.x, z.z) > z.radius) continue;
              const gain = Math.min(Math.max(0, ops.maxHp - ops.hp), z.healPerTick);
              if (gain > 0) {
                ops.hp += gain;
                credit(sh, regionId, z.by, { heal: gain });
                emitHp(sh, regionId, uid, ops, z.nextTickAt);
                heals.push([uid, gain]);
              }
            }
          } else if (z.kind === 'solar_burn') {
            for (const mon of sh.live.monsters.values()) {
              if (mon.regionId !== regionId || mon.hp <= 0) continue;
              if (dist(z.x, z.z, mon.x, mon.z) <= z.radius) {
                const dealt = zoneHit(mon);
                hits.push([mon.id, dealt, false, Math.max(0, Math.round(mon.hp)), round2(mon.x), round2(mon.z)]);
              }
            }
          }
          if (hits.length > 0 || heals.length > 0) {
            const tickNow = z.nextTickAt;
            const hitStates = hits.map(([id]) => {
              const mon = sh.live.monsters.get(id);
              return mon ? [mon.id, mon.hp > 0 ? tagMask(mon, tickNow) : 0, mon.hp > 0 ? poiseWire(mon, tickNow) : 0] : null;
            }).filter(Boolean);
            broadcast(inst, {
              type: 'sf_fx',
              kind: 'zone_tick',
              zoneKind: z.kind,
              by: z.by,
              x: round2(z.x),
              z: round2(z.z),
              radius: z.radius,
              hits,
              hitStates,
              heals,
              reactions: reactionsOut,
            });
          }
          if (reactionsOut.length) noteReactions(z.by, reactionsOut, inst);
          z.nextTickAt += 1000;
        }
        if (t >= z.endsAt) R.skillZones.splice(i, 1);
      }
    });
  }

  function tickAmbient(sh, regionId, members, R, t) {
    const due = R.ambientDue;
    for (let i = due.length - 1; i >= 0; i--) {
      const d = due[i];
      const dueAt = typeof d === 'number' ? d : d?.at;
      if (!(dueAt > t)) due.splice(i, 1);
    }
    const types = AMBIENT_TYPES[regionId];
    if (!types?.length) return;
    let actualTotal = 0;
    let actualAmbient = 0;
    const aliveByType = {};
    for (const m of sh.live.monsters.values()) {
      if (m.regionId !== regionId) continue;
      actualTotal += 1;
      if (m.kind === 'ambient') {
        actualAmbient += 1;
        aliveByType[m.type] = (aliveByType[m.type] || 0) + 1;
      }
    }
    R.count = actualTotal;
    R.ambientAlive = actualAmbient;
    const crowd = Math.min(COMBAT.AMBIENT_CROWD_MAX, Math.max(0, (members?.size || 1) - 1) * COMBAT.AMBIENT_PER_EXTRA_PLAYER);
    for (const type of types) {
      const packSize = (MONSTERS[type]?.packSize || 7) + crowd;
      let aliveOfType = aliveByType[type] || 0;
      let dueOfType = 0;
      for (const d of due) {
        if (typeof d === 'object' && d !== null && d.type === type) dueOfType += 1;
      }
      while (aliveOfType + dueOfType < packSize && R.count < COMBAT.MONSTER_CAP) {
        const pos = habitatPos(sh, regionId, type);
        if (!spawnMonster(sh, regionId, type, 'ambient', pos.x, pos.z)) break;
        aliveOfType += 1;
      }
    }
  }

  function tickMonsters(sh, regionId, members, t, dt) {
    const L = sh.live;
    const region = REGIONS[regionId];
    const opPoi = region.pois.outpost;
    const op = outpostOf(sh, regionId);
    const R = liveRegion(sh, regionId);
    for (const m of L.monsters.values()) {
      if (m.regionId !== regionId) continue;
      if (m.hp <= 0) {
        killMonster(sh, m, Object.keys(m.hits)[0] || null, t);
        continue;
      }
      if (m.kind === 'boss' && t - m.startedAt >= COMBAT.BOSS_TIMEOUT_MS) {
        removeMonster(sh, m);
        broadcast(regionInstanceId(sh.id, regionId), { type: 'sf_monster_dead', id: m.id, regionId, monsterType: m.type, despawn: true, drops: {} });
        broadcast(regionInstanceId(sh.id, regionId), { type: 'sf_boss', event: 'expired', regionId, id: m.id, bossId: m.type });
        continue;
      }
      // ---- combo status upkeep: Burning DoT, Guard regen / recovery, wire tag-mask dirtiness ----
      if (m.burnDps > 0) {
        if ((m.tags?.burning || 0) > t) {
          if (t >= (m.burnNextAt || 0)) {
            m.burnNextAt = t + 1000;
            damageMonster(sh, m, m.burnBy, m.burnDps, t);
            if (m.hp <= 0 || !L.monsters.has(m.id)) continue;
          }
        } else {
          m.burnDps = 0; m.burnBy = null; m.burnNextAt = 0;
        }
      }
      if (m.maxPoise > 0) {
        if (m.breakUntil && t >= m.breakUntil) {
          m.breakUntil = 0; m.poise = m.maxPoise; m.poiseHitAt = t;
          if (m.kind === 'boss') R.bossDirty = true;
        } else if (!m.breakUntil && m.poise < m.maxPoise && t - (m.poiseHitAt || 0) >= POISE.REGEN_DELAY_MS) {
          m.poise = Math.min(m.maxPoise, m.poise + m.maxPoise * 0.15 * dt);
          if (m.kind === 'boss') R.bossDirty = true;
        }
      }
      if (m.tags) for (const k in m.tags) if (m.tags[k] <= t) delete m.tags[k];
      const wireKey = tagMask(m, t) * 1000 + (poiseWire(m, t) ?? 999);
      if (m._wireKey !== wireKey) { m._wireKey = wireKey; R.dirty.add(m.id); }
      if (m.stunUntil > t || m.frozenUntil > t) {
        if (m.telegraph) m.telegraph = null;
        continue;
      }
      // Habitat leash for ambient mobs (> 13.0m from home resets provocation and walks back)
      const leashedOut = m.kind === 'ambient' && dist(m.x, m.z, m.homeX, m.homeZ) > 13.0;
      if (leashedOut) m.provokedUntil = 0;

      // nearest standing player
      let best = null, bestD = Infinity, bx = 0, bz = 0;
      for (const uid of members) {
        const s = presence.get(uid);
        if (!s) continue;
        const ps = L.players.get(uid);
        if (ps && ps.downUntil > t) continue;
        const d = dist(m.x, m.z, s.x, s.z);
        if (d < bestD) { bestD = d; best = uid; bx = s.x; bz = s.z; }
      }
      let tx = m.homeX, tz = m.homeZ, targetId = null;
      const aggro = m.kind === 'boss' ? COMBAT.BOSS_LEASH : COMBAT.AGGRO_RANGE;
      if (m.kind === 'wave') {
        if (best && bestD <= COMBAT.WAVE_PLAYER_AGGRO) { tx = bx; tz = bz; targetId = best; }
        else if (opPoi && !op.offline) { tx = opPoi.x; tz = opPoi.z; targetId = 'outpost'; }
        else if (best && bestD <= aggro) { tx = bx; tz = bz; targetId = best; }
      } else if (m.kind === 'ambient') {
        const isPassive = MONSTERS[m.type]?.aggroStyle === 'passive' && !m.isElite;
        const isProvoked = (m.provokedUntil || 0) > t;
        const baseAmbAggro = m.isElite ? COMBAT.AGGRO_RANGE : COMBAT.AMBIENT_AGGRO_RANGE;
        const effAggro = isProvoked ? COMBAT.AGGRO_RANGE + 4 : baseAmbAggro;
        if (!leashedOut && (!isPassive || isProvoked) && best && bestD <= effAggro) {
          tx = bx; tz = bz; targetId = best;
        }
      } else if (best && bestD <= aggro) {
        tx = bx; tz = bz; targetId = best;
      }
      m.targetId = targetId;

      // Alpha Elite Telegraphed Signature Skill
      if (m.isElite && m.telegraph) {
        if (t < m.telegraph.fireAt) continue;
        const tele = m.telegraph;
        m.telegraph = null;
        const skDmg = Math.max(1, Math.round(m.dmg * 1.65));
        const playerHits = [];
        for (const uid of members) {
          const s = presence.get(uid);
          if (!s) continue;
          const ps = L.players.get(uid);
          if (ps && ps.downUntil > t) continue;
          if (dist(s.x, s.z, tele.targetX, tele.targetZ) <= tele.radius) {
            const dealt = damagePlayer(sh, regionId, uid, skDmg, t, m);
            const afterPs = L.players.get(uid);
            playerHits.push([uid, dealt, false, Math.max(0, Math.round(afterPs?.hp || 0))]);
          }
        }
        broadcast(regionInstanceId(sh.id, regionId), {
          type: 'sf_fx',
          kind: 'alpha_skill_cast',
          id: m.id,
          monsterType: m.type,
          skillId: tele.skillId,
          vfxId: tele.skillId,
          x: r1(m.x),
          z: r1(m.z),
          targetX: r1(tele.targetX),
          targetZ: r1(tele.targetZ),
          facing: tele.facing,
          hits: playerHits,
        });
        m.atkCdUntil = t + COMBAT.MONSTER_ATK_CD_MS;
        continue;
      } else if (m.isElite && targetId && targetId !== 'outpost' && t >= (m.skillCdUntil || 0) && dist(m.x, m.z, tx, tz) <= 6.5) {
        const sigSkill = skillBySource(m.type)?.id || 'sk_earthshatter';
        const facing = unitFacing({ x: tx - m.x, z: tz - m.z });
        m.telegraph = { skillId: sigSkill, targetX: tx, targetZ: tz, facing, radius: 3.4, fireAt: t + ALPHA_ELITE.TELEGRAPH_MS };
        m.skillCdUntil = t + ALPHA_ELITE.SKILL_CD_MS;
        broadcast(regionInstanceId(sh.id, regionId), {
          type: 'sf_fx',
          kind: 'alpha_telegraph',
          id: m.id,
          monsterType: m.type,
          skillId: sigSkill,
          x: r1(m.x),
          z: r1(m.z),
          targetX: r1(tx),
          targetZ: r1(tz),
          facing,
          radius: 3.4,
          durationMs: ALPHA_ELITE.TELEGRAPH_MS,
        });
        continue;
      }

      const range = targetId === 'outpost' ? COMBAT.OUTPOST_HIT_RANGE
        : m.kind === 'boss' ? COMBAT.BOSS_RANGE : m.ranged ? COMBAT.RANGED_RANGE : COMBAT.MELEE_RANGE;
      const arch = m.kind === 'ambient' ? archetypeOf(m.type) : null;
      // Support archetype: ward nearby allies while engaged (stun / freeze above interrupts it).
      if (arch?.archetype === 'support' && targetId && targetId !== 'outpost' && t >= (m.wardNextAt || 0)) {
        const def = MONSTER_ARCHETYPES.support;
        m.wardNextAt = t + def.wardEveryMs;
        const warded = [];
        for (const o of L.monsters.values()) {
          if (o.regionId !== regionId || o.hp <= 0 || o.kind === 'boss') continue;
          if (dist(m.x, m.z, o.x, o.z) > def.wardRadius) continue;
          o.wardHp = Math.max(o.wardHp || 0, Math.round(o.maxHp * def.wardPct));
          o.wardUntil = t + def.wardMs;
          R.dirty.add(o.id);
          warded.push(o.id);
        }
        if (warded.length) {
          broadcast(regionInstanceId(sh.id, regionId), {
            type: 'sf_fx', kind: 'mob_ward', id: m.id, monsterType: m.type, x: r1(m.x), z: r1(m.z), radius: def.wardRadius, warded,
          });
        }
      }
      const d = dist(m.x, m.z, tx, tz);
      const stopAt = targetId ? range * 0.85 : 0.5;
      const chillSlow = (m.tags?.chilled || 0) > t ? (STATUS_TAGS.chilled.slowPct || 0.25) : 0;
      const slowFrac = Math.max(m.slowUntil > t ? (m.slowPct || 0.5) : 0, chillSlow);
      const speed = (m.speed || 1.5) * (1 - slowFrac);
      if (arch?.archetype === 'kiter' && targetId && targetId !== 'outpost' && d < MONSTER_ARCHETYPES.kiter.keepAway && d > 0.01
        && dist(m.x, m.z, m.homeX, m.homeZ) < 11.5) {
        // Kiter archetype: back away to keep its distance once engaged.
        const p2 = clampToRegion(regionId, m.x - ((tx - m.x) / d) * speed * dt, m.z - ((tz - m.z) / d) * speed * dt, 1);
        m.x = p2.x; m.z = p2.z;
        R.dirty.add(m.id);
      } else if (d > stopAt) {
        const step = Math.min(speed * dt, d - stopAt);
        if (step > 0.001) {
          m.x += ((tx - m.x) / d) * step;
          m.z += ((tz - m.z) / d) * step;
          R.dirty.add(m.id);
        }
      }
      if (!targetId || t < m.atkCdUntil) continue;
      const dNow = targetId === 'outpost' ? dist(m.x, m.z, opPoi.x, opPoi.z) : dist(m.x, m.z, tx, tz);
      if (dNow > range) continue;
      m.atkCdUntil = t + COMBAT.MONSTER_ATK_CD_MS;
      if ((m.missUntil || 0) > t && rng() < (m.missPct || 0)) continue; // Scald steam: attack whiffs
      let dmg = Math.round(m.dmg * (m.dmgMult || 1));
      if (arch?.archetype === 'swarm') {
        const def = MONSTER_ARCHETYPES.swarm;
        let allies = 0;
        for (const o of L.monsters.values()) {
          if (o !== m && o.regionId === regionId && o.type === m.type && o.hp > 0 && dist(m.x, m.z, o.x, o.z) <= def.radius) allies += 1;
        }
        dmg = Math.round(dmg * (1 + Math.min(def.maxBonus, allies * def.perAlly)));
      }
      if (targetId === 'outpost') damageOutpost(sh, regionId, dmg, t);
      else damagePlayer(sh, regionId, targetId, dmg, t, m);
    }
  }

  function damageOutpost(sh, regionId, dmg, t) {
    const op = outpostOf(sh, regionId);
    if (op.offline) return;
    applyOutpostDamage(op, dmg);
    const R = liveRegion(sh, regionId);
    R.outpostDirty = true;
    if (op.offline) {
      op.hp = 0;
      op.fellAt = t;
      R.outpostDirty = false;
      R.lastOutpostAt = t;
      broadcast(regionInstanceId(sh.id, regionId), { type: 'sf_outpost', ...outpostWire(sh, regionId), fell: true });
      saveShard(sh); // offline state is durable until repaired
    }
  }

  function flushRegion(sh, regionId, R, t) {
    if (!R.dirty.size && !R.outpostDirty && !R.bossDirty) return;
    const members = regionMembers(sh.id, regionId);
    if (!members.size) {
      R.dirty.clear();
      R.outpostDirty = false;
      R.bossDirty = false;
      return;
    }
    const inst = regionInstanceId(sh.id, regionId);
    if (R.dirty.size && t - R.lastDeltaAt >= COMBAT.DELTA_MS) {
      R.lastDeltaAt = t;
      const arr = [];
      for (const id of R.dirty) { const m = sh.live.monsters.get(id); if (m) arr.push(compactMonster(m)); }
      R.dirty.clear();
      if (arr.length) broadcast(inst, { type: 'sf_monsters', regionId, m: arr });
    }
    if (R.outpostDirty && t - R.lastOutpostAt >= COMBAT.OUTPOST_BCAST_MS) {
      R.outpostDirty = false;
      R.lastOutpostAt = t;
      broadcast(inst, { type: 'sf_outpost', ...outpostWire(sh, regionId) });
    }
    if (R.bossDirty && t - (R.lastBossAt || 0) >= 250) {
      R.lastBossAt = t;
      R.bossDirty = false;
      const wire = bossWire(sh, regionId);
      if (wire) broadcast(inst, { type: 'sf_boss', event: 'update', regionId, ...wire });
    }
  }

  function tickEffects(sh, t) {
    const E = sh.live.effects;
    for (let i = E.length - 1; i >= 0; i--) {
      const e = E[i];
      if (t >= e.until) { E.splice(i, 1); continue; }
      if (t - e.lastAt < 1000) continue;
      e.lastAt = t;
      const members = regionMembers(sh.id, e.regionId);
      if (!members.size) continue;
      let cx = e.x, cz = e.z;
      if (e.follow) { const s = presence.get(e.follow); if (s) { cx = s.x; cz = s.z; } }
      if (e.kind === 'heal') {
        for (const uid of members) {
          const s = presence.get(uid);
          const ps = sh.live.players.get(uid);
          if (!s || !ps || ps.downUntil > t || ps.hp >= ps.maxHp || dist(s.x, s.z, cx, cz) > e.radius) continue;
          const amt = Math.min(ps.maxHp - ps.hp, Math.ceil(ps.maxHp * e.pctPerSec));
          ps.hp += amt;
          if (uid !== e.by) credit(sh, e.regionId, e.by, { heal: amt });
          emitHp(sh, e.regionId, uid, ps, t);
        }
      } else if (e.kind === 'dot') {
        for (const m of sh.live.monsters.values()) {
          if (m.regionId !== e.regionId || dist(m.x, m.z, cx, cz) > e.radius) continue;
          damageMonster(sh, m, e.by, e.dps, t);
        }
      }
    }
  }

  // ---- invasions (§8.5) -------------------------------------------------------------------------
  function tickInvasion(sh, t) {
    const inv = sh.durable.invasion;
    const L = sh.live;
    if (inv.phase === 'idle') {
      if (!inv.nextAt) inv.nextAt = nextInvasionAt(t, rng);
      if (t >= inv.nextAt && membersOf(sh.id).size > 0) {
        inv.phase = 'warning';
        inv.at = t + INVASION.WARNING_MS;
        inv.endsAt = inv.at;
        inv.wave = 0;
        broadcastShard(sh, { type: 'sf_invasion', ...invasionWire(sh) });
      }
      return;
    }
    if (inv.phase === 'warning') {
      if (t < inv.at) return;
      inv.phase = 'active';
      inv.wave = 0;
      inv.nextWaveAt = t;
      inv.endsAt = t + COMBAT.INVASION_TIMEOUT_MS;
      L.invLedger = {};
      L.invWaveAlive = 0;
      broadcastShard(sh, { type: 'sf_invasion', ...invasionWire(sh) });
    }
    if (inv.phase !== 'active') return;
    if (inv.wave < INVASION.WAVES && t >= inv.nextWaveAt) {
      inv.wave += 1;
      inv.nextWaveAt = t + INVASION.WAVE_GAP_MS;
      for (const regionId of REGION_IDS) {
        const members = regionMembers(sh.id, regionId);
        if (!members.size) continue;
        const comp = waveComposition({ region: regionId, wave: inv.wave, activePlayers: members.size, rng });
        for (const { type, count, hpMultiplier } of comp) {
          for (let i = 0; i < count; i++) {
            const pos = wavePos(regionId);
            if (!spawnMonster(sh, regionId, type, 'wave', pos.x, pos.z, { hpMult: hpMultiplier })) break;
          }
        }
      }
      broadcastShard(sh, { type: 'sf_invasion', ...invasionWire(sh) });
    }
    if (inv.wave < INVASION.WAVES && L.invWaveAlive === 0) inv.nextWaveAt = Math.min(inv.nextWaveAt, t + 5000); // cleared early → next wave sooner
    if (inv.wave >= INVASION.WAVES && L.invWaveAlive === 0) endInvasion(sh, true, t);
    else if (t >= inv.endsAt) endInvasion(sh, false, t);
  }

  function endInvasion(sh, success, t) {
    const inv = sh.durable.invasion;
    const L = sh.live;
    for (const m of [...L.monsters.values()]) {
      if (m.kind !== 'wave') continue;
      removeMonster(sh, m);
      broadcast(regionInstanceId(sh.id, m.regionId), { type: 'sf_monster_dead', id: m.id, regionId: m.regionId, monsterType: m.type, despawn: true, drops: {} });
    }
    const chest = {};
    if (success) {
      const q = qualifiers(L.invLedger, COMBAT.BOSS_MIN_SHARE);
      const totalQ = q.reduce((s, u) => s + (L.invLedger[u]?.score || 0), 0);
      for (const uid of q) {
        const prof = db.getProfile?.(uid);
        if (!prof) continue;
        const share = totalQ > 0 ? (L.invLedger[uid].score || 0) / totalQ : 1 / q.length;
        const items = {};
        for (const [mat, n] of Object.entries(COMBAT.CHEST)) items[mat] = Math.max(1, Math.round(n * share));
        if (rng() < COMBAT.CHEST_CORE_CHANCE) items.boss_core_moss = 1;
        grant(prof, items);
        const pf = ensureFrontier(prof);
        if (pf) { pf.stats ||= {}; pf.stats.invasions = (pf.stats.invasions || 0) + 1; }
        db.markProfile?.(uid);
        onProfileChanged(prof);
        chest[uid] = items;
      }
    }
    inv.phase = 'idle';
    inv.wave = 0;
    inv.at = 0;
    inv.endsAt = 0;
    inv.nextWaveAt = 0;
    inv.nextAt = nextInvasionAt(t, rng);
    inv.last = { at: t, result: success ? 'success' : 'fail' };
    L.invLedger = {};
    L.invWaveAlive = 0;
    saveShard(sh);
    broadcastShard(sh, { type: 'sf_invasion', ...invasionWire(sh), phase: 'ended', result: success ? 'success' : 'fail', chest });
  }

  // ---- bosses (§9) ------------------------------------------------------------------------------
  function bossStart(ws, p, m) {
    const parsed = parseFrontierInstance(ws.instanceId);
    if (!parsed) return { ok: false, error: 'not_in_frontier' };
    const regionId = REGIONS[parsed.regionId] ? parsed.regionId : 'meadow';
    const sh = loadShard(parsed.shardId);
    ensureActive(sh);
    const bossId = String(m.bossId || '');
    const def = BOSSES[bossId];
    if (!def || def.region !== regionId) return { ok: false, error: 'bad_boss' };
    const poi = REGIONS[regionId].pois[COMBAT.BOSS_POI[regionId]];
    const s = presence.get(p.id);
    if (!poi || !s) return { ok: false, error: 'no_state' };
    if (dist(s.x, s.z, poi.x, poi.z) > COMBAT.BOSS_START_RANGE) return { ok: false, error: 'too_far' };
    if (sh.live.bosses.has(regionId)) return { ok: false, error: 'boss_active' };
    const t = now();
    const cd = sh.durable.bossCd[regionId] || 0;
    if (t < cd) return { ok: false, error: 'cooldown', readyAt: cd };
    const ps = playerState(sh, p.id, p);
    if (ps.downUntil > t) return { ok: false, error: 'down' };
    const n = Math.max(1, regionMembers(sh.id, regionId).size);
    const b = spawnMonster(sh, regionId, bossId, 'boss', poi.x, poi.z, { hpMult: 1 + 0.5 * (n - 1), boss: { ...def, speed: 1.1 } });
    if (!b) return { ok: false, error: 'region_full' };
    Object.assign(b, { stage: 0, ledger: {}, startedAt: t, encounterUid: `${sh.id}:${bossId}:${t}`, startedBy: p.id });
    sh.live.bosses.set(regionId, b.id);
    sh.durable.bossCd[regionId] = t + COMBAT.BOSS_COOLDOWN_MS;
    saveShard(sh);
    const wire = bossWire(sh, regionId);
    broadcast(ws.instanceId, { type: 'sf_boss', event: 'start', regionId, ...wire });
    return { ok: true, boss: wire };
  }

  /** Individual loot per qualifier (≥5% contribution) via pure % × Luck RNG + guaranteed Boss Cores + idempotent claim. */
  function grantBossRewards({ bossId, encounterUid, ledger, instanceId = null }) {
    const t = now();
    const q = qualifiers(ledger, COMBAT.BOSS_MIN_SHARE);
    const luckByUser = {}, profs = {};
    for (const uid of q) {
      const prof = db.getProfile?.(uid);
      const fr = prof && ensureFrontier(prof);
      if (!fr) continue;
      fr.claimedRewards ||= {};
      if (fr.claimedRewards[encounterUid]) continue;
      profs[uid] = prof;
      luckByUser[uid] = Number(statsOf(prof).luck) || 0;
    }
    const eligible = Object.keys(profs);
    const loot = eligible.length ? rollBossLoot({ bossId, qualifying: eligible, rng, luckByUser }) : {};
    const out = {};
    for (const uid of eligible) {
      const prof = profs[uid];
      const fr = ensureFrontier(prof);
      const res = loot[uid];
      if (!res) continue;
      fr.claimedRewards[encounterUid] = t;
      const keys = Object.keys(fr.claimedRewards);
      if (keys.length > 60) for (const k of keys.slice(0, keys.length - 60)) delete fr.claimedRewards[k];
      const items = { ...res.items };
      delete items.core;
      grant(prof, items);
      let charm = null;
      if (res.charmTier != null) {
        const c = grantCharmOfTier(prof, res.charmTier, rng, luckByUser[uid]);
        if (c) charm = { uid: c.uid, id: c.id, name: c.name, tier: c.tier, grade: c.grade };
      }
      ensureFrontierSkills(prof);
      const uMods = skyFrontierMods(statsOf(prof));
      const skDrop = rollMonsterSkillDrop({
        sourceId: bossId,
        isBoss: true,
        rareFindMult: uMods.rareFindMult,
        rng,
      });
      let skillScroll = null;
      let bossFloor = false;
      if (!(skDrop.dropped && skDrop.skillId)) {
        const bSk = skillBySource(bossId);
        const bKills = (Number(fr.stats?.killsByMob?.[bossId]) || 0) + 1;
        if (bSk && (ensureFrontierSkills(prof).unlocked[bSk.id] | 0) === 0 && bKills >= SCROLL_FLOOR_KILLS.boss) {
          skDrop.dropped = true;
          skDrop.skillId = bSk.id;
          bossFloor = true;
        }
      }
      if (skDrop.dropped && skDrop.skillId) {
        skillScroll = grantMonsterSkillScroll(prof, skDrop.skillId, true, instanceId, { skipNotify: true, floor: bossFloor });
      }
      prof.story ||= defaultStory();
      recordEvent(prof.story, { kind: 'defeat', target: bossId });
      fr.stats ||= {};
      fr.stats.bosses = (fr.stats.bosses || 0) + 1;
      fr.stats.killsByMob ||= {};
      fr.stats.killsByMob[bossId] = (fr.stats.killsByMob[bossId] || 0) + 1;
      db.markProfile?.(uid);
      onProfileChanged(prof);
      out[uid] = { items, charm, ...(skillScroll ? { skillScroll } : {}) };
    }
    return out;
  }

  function bossDefeated(sh, b, t) {
    sh.live.bosses.delete(b.regionId);
    sh.durable.bossCd[b.regionId] = t + COMBAT.BOSS_COOLDOWN_MS;
    const inst = regionInstanceId(sh.id, b.regionId);
    const loot = grantBossRewards({ bossId: b.type, encounterUid: b.encounterUid, ledger: b.ledger, instanceId: inst });
    saveShard(sh);
    broadcast(inst, {
      type: 'sf_boss_defeated', regionId: b.regionId, id: b.id, bossId: b.type, encounterUid: b.encounterUid,
      loot, qualifying: Object.keys(loot), cooldownUntil: sh.durable.bossCd[b.regionId],
    });
  }

  // ---- player actions ---------------------------------------------------------------------------
  function combatContext(ws, p) {
    const parsed = parseFrontierInstance(ws.instanceId);
    if (!parsed) return { error: 'not_in_frontier' };
    const regionId = REGIONS[parsed.regionId] ? parsed.regionId : 'meadow';
    const sh = loadShard(parsed.shardId);
    ensureActive(sh);
    const s = presence.get(p.id);
    const fr = ensureFrontier(p);
    if (!s || !fr) return { error: 'no_state' };
    return { sh, regionId, s, fr, ps: playerState(sh, p.id, p), t: now() };
  }

  function attack(ws, p, m) {
    const c = combatContext(ws, p);
    if (c.error) return { ok: false, error: c.error };
    const { sh, regionId, s, fr, ps, t } = c;
    if (ps.downUntil > t) return { ok: false, error: 'down', downUntil: ps.downUntil };

    const visGloveId = visibleSlotId(p.equipped, 'gloves', p.glamour);
    const useClassCombo = Boolean(visGloveId) || m.comboStep != null;

    if (useClassCombo) {
      const weaponClass = activeWeaponClass(p.equipped, p.glamour);
      const cls = WEAPON_CLASSES[weaponClass] || WEAPON_CLASSES.melee;
      const stats = statsOf(p);
      const mods = skyFrontierMods(stats);

      const prevCd = ps.attackReadyAt
        ? Math.max(0, ps.attackReadyAt - (ps.lastAttackAt || 0))
        : classAttackCooldownMs(weaponClass, stats, ps.comboStep || 1);
      if (ps.lastAttackAt && t - ps.lastAttackAt < prevCd - COMBAT.ATTACK_CD_SLACK_MS) {
        return { ok: false, error: 'cooldown', readyAt: ps.lastAttackAt + prevCd };
      }

      const timedOut = !ps.lastAttackAt || (t - ps.lastAttackAt > 2200);
      const nextSeq = timedOut ? 1 : (((ps.comboStep || 0) % 3) + 1);
      let comboStep = nextSeq;
      if (m.comboStep != null) {
        const reqStep = Number(m.comboStep);
        if ((reqStep === 1 || reqStep === 2 || reqStep === 3) && (reqStep === 1 || (!timedOut && reqStep === nextSeq))) {
          comboStep = reqStep;
        }
      }

      const target = sh.live.monsters.get(String(m.targetId || ''));
      const validTarget = target && target.regionId === regionId && target.hp > 0 ? target : null;
      const targetDist = validTarget ? dist(s.x, s.z, validTarget.x, validTarget.z) : Infinity;
      const toTarget = validTarget ? { x: validTarget.x - s.x, z: validTarget.z - s.z } : null;
      const facing = unitFacing(m.facing, toTarget);
      const range = cls.range;

      const hitIds = new Set();
      if (validTarget && targetDist <= range + 0.85) {
        hitIds.add(validTarget.id);
      }
      const cands = [];
      for (const mon of sh.live.monsters.values()) {
        if (mon.regionId === regionId && mon.hp > 0) cands.push(mon);
      }
      const arcHits = hitsInArc({ origin: s, facing, range: range + 0.35, arcDeg: cls.arc, targets: cands });
      if (weaponClass === 'magic') {
        if (!hitIds.size && arcHits.length) hitIds.add(arcHits[0]);
        if (comboStep === 3 && hitIds.size > 0) {
          const primaryId = [...hitIds][0];
          const primaryMon = sh.live.monsters.get(primaryId);
          if (primaryMon) {
            const splashR = cls.finisherSplashRadius || 2.2;
            for (const mon of cands) {
              if (dist(primaryMon.x, primaryMon.z, mon.x, mon.z) <= splashR) hitIds.add(mon.id);
            }
          }
        }
      } else {
        for (const id of arcHits) hitIds.add(id);
      }

      if (m.targetId && validTarget && hitIds.size === 0 && targetDist > range + 0.85) {
        return {
          ok: false,
          error: 'out_of_range',
          dist: r1(targetDist),
          monsterX: r1(validTarget.x),
          monsterZ: r1(validTarget.z),
        };
      }
      if (m.targetId && !validTarget && hitIds.size === 0) {
        return { ok: false, error: 'no_target', targetId: String(m.targetId) };
      }

      ps.comboStep = comboStep;
      ps.lastAttackAt = t;

      let cd = classAttackCooldownMs(weaponClass, stats, comboStep);
      const haste = buffActive(ps, 'haste', t);
      if (haste) cd = Math.round(cd / (1 + (haste.pct || 0)));
      ps.attackReadyAt = t + cd;

      let mult = 1;
      if (buffActive(ps, 'clone', t)) mult *= 2;
      const dmgUp = buffActive(ps, 'dmg_up', t);
      if (dmgUp) mult *= 1 + (dmgUp.pct || 0);

      const critUp = buffActive(ps, 'crit_up', t);
      const pas = activePassive(p);
      const critChance = Math.min(0.85, (mods.critChance || COMBAT.CRIT_CHANCE) + (critUp?.pct || 0) + (pas?.def.kind === 'crit' ? pas.value : 0));
      const prime = comboStep === 3 ? HIT3_PRIMES[weaponClass] : null;
      const reactionsOut = [];
      const basicCtx = () => {
        const traits = [...(prime?.traits || [])];
        const applies = [...(prime?.applies || [])];
        const tagMs = {};
        if (prime?.tagMs) for (const tg of prime.applies) tagMs[tg] = prime.tagMs;
        if (pas?.def.kind === 'hit3_tag' && comboStep === 3) { applies.push(pas.def.tag); tagMs[pas.def.tag] = pas.value; }
        if (pas?.def.kind === 'shock_chance' && rng() < pas.value) { traits.push('shock'); applies.push('shocked'); }
        return { traits, applies, tagMs, source: 'basic', extraPoise: comboStep === 3 ? POISE.DAMAGE.hit3 : 0, reactionsOut };
      };
      let totalDealtBasic = 0;

      const hitResults = [];
      let anyCrit = false;
      withBatchedProfileSync(() => {
        for (const id of hitIds) {
          const mon = sh.live.monsters.get(id);
          if (!mon || mon.hp <= 0) continue;
          const crit = rng() < critChance;
          if (crit) anyCrit = true;
          const baseComboDmg = Math.max(1, Math.round(classComboDamage({ weaponClass, comboStep, stats, crit }) * mult));

          if (weaponClass === 'ranged' && comboStep === 3) {
            // Hit-3 Twin Volley: 2 rapid shots of 0.56x each (= 1.12x on top of 1.44 comboMult)
            const shotDmg = Math.max(1, Math.round(baseComboDmg * 0.56));
            const mx = round2(mon.x), mz = round2(mon.z);
            const dealt1 = damageMonster(sh, mon, p.id, shotDmg, t);
            totalDealtBasic += dealt1;
            hitResults.push([id, dealt1, crit, Math.max(0, Math.round(mon.hp)), mx, mz]);
            if (sh.live.monsters.has(id) && mon.hp > 0) {
              // 2nd arrow carries the Hit-3 prime (Mark) so the volley itself stays at 2 × 0.56×.
              const dealt2 = comboHit(sh, mon, p.id, shotDmg, t, basicCtx()).dealt;
              totalDealtBasic += dealt2;
              hitResults.push([id, dealt2, crit, Math.max(0, Math.round(mon.hp)), round2(mon.x), round2(mon.z)]);
            } else {
              hitResults.push([id, 0, crit, 0, mx, mz]);
            }
          } else {
            if (weaponClass === 'melee' && comboStep === 3) {
              if (mon.kind !== 'boss' && mon.hp > baseComboDmg) {
                const d = dist(s.x, s.z, mon.x, mon.z) || 1;
                const kb = cls.knockback || 0.95;
                const p2 = clampToRegion(regionId, mon.x + ((mon.x - s.x) / d) * kb, mon.z + ((mon.z - s.z) / d) * kb, 1);
                mon.x = p2.x; mon.z = p2.z;
                liveRegion(sh, regionId).dirty.add(mon.id);
              }
            }
            const mx = round2(mon.x), mz = round2(mon.z);
            const dealt = comboHit(sh, mon, p.id, baseComboDmg, t, basicCtx()).dealt;
            totalDealtBasic += dealt;
            if (weaponClass === 'melee' && comboStep === 3 && mon.hp > 0) {
              mon.stunUntil = Math.max(mon.stunUntil || 0, t + (cls.finisherStaggerMs || 420));
              liveRegion(sh, regionId).dirty.add(mon.id);
            }
            if (weaponClass === 'magic' && comboStep === 3 && mon.hp > 0 && mon.tags) {
              for (const [k, until] of Object.entries(mon.tags)) if (until > t) mon.tags[k] = until + (HIT3_PRIMES.magic.extendMs || 1000);
              liveRegion(sh, regionId).dirty.add(mon.id);
            }
            hitResults.push([id, dealt, crit, Math.max(0, Math.round(mon.hp)), mx, mz]);
          }
        }
      });
      if (pas?.def.kind === 'leech' && totalDealtBasic > 0 && ps.hp < ps.maxHp) {
        const gain = Math.min(ps.maxHp - ps.hp, Math.max(1, Math.round(totalDealtBasic * pas.value)));
        ps.hp += gain;
        emitHp(sh, regionId, p.id, ps, t);
      }
      if (reactionsOut.length) noteReactions(p.id, reactionsOut, ws.instanceId);

      const partyHeals = [];
      if (weaponClass === 'magic' && comboStep === 3) {
        const healAmt = Math.max(3, Math.round((cls.finisherPartyHealBase || 5) * mods.healShieldMult));
        const recipients = new Set([p.id, ...regionMembers(sh.id, regionId)]);
        for (const uid of recipients) {
          const os = uid === p.id ? s : presence.get(uid);
          const ops = playerState(sh, uid);
          if (!os || !ops || ops.downUntil > t) continue;
          if (uid !== p.id && dist(s.x, s.z, os.x, os.z) > 7.5) continue;
          const actualGain = Math.min(Math.max(0, ops.maxHp - ops.hp), healAmt);
          if (actualGain > 0) {
            ops.hp += actualGain;
            credit(sh, regionId, p.id, { heal: actualGain });
            emitHp(sh, regionId, uid, ops, t);
          }
          partyHeals.push([uid, actualGain > 0 ? actualGain : healAmt]);
        }
      }

      const hitStates = hitResults.map(([id]) => {
        const mon = sh.live.monsters.get(id);
        return mon ? [mon.id, mon.hp > 0 ? tagMask(mon, t) : 0, mon.hp > 0 ? poiseWire(mon, t) : 0] : null;
      }).filter(Boolean);
      const vfxId = `combo_${weaponClass}_${comboStep}`;
      broadcast(ws.instanceId, {
        type: 'sf_fx',
        kind: 'attack',
        by: p.id,
        x: r1(s.x),
        z: r1(s.z),
        weaponClass,
        comboStep,
        vfxId,
        crit: anyCrit,
        facing,
        hits: hitResults,
        hitStates,
        partyHeals,
        reactions: reactionsOut,
        readyAt: ps.attackReadyAt,
      });
      return {
        ok: true,
        weaponClass,
        comboStep,
        vfxId,
        crit: anyCrit,
        hits: hitResults,
        hitStates,
        reactions: reactionsOut,
        heals: partyHeals,
        partyHeals,
        cooldownMs: cd,
        readyAt: ps.attackReadyAt,
        serverNow: t,
      };
    }

    // Legacy unarmed / toolbelt fallback (no Hands & Weapon item equipped and m.comboStep == null)
    const tb = fr.toolbelt || {};
    const tool = WEAPONS[tb.main] ? tb.main : 'pickaxe';
    const tier = Number(tb[tool] ?? 1);
    if (!(tier > 0)) return { ok: false, error: 'no_weapon' };
    const w = WEAPONS[tool];
    const stats = statsOf(p);
    let cd = attackCooldownMs(stats);
    const haste = buffActive(ps, 'haste', t);
    if (haste) cd = Math.round(cd / (1 + (haste.pct || 0)));
    if (ps.lastAttackAt && t - ps.lastAttackAt < cd - COMBAT.ATTACK_CD_SLACK_MS) {
      return { ok: false, error: 'cooldown', readyAt: ps.lastAttackAt + cd };
    }
    const target = sh.live.monsters.get(String(m.targetId || ''));
    const validTarget = target && target.regionId === regionId && target.hp > 0 ? target : null;
    const targetDist = validTarget ? dist(s.x, s.z, validTarget.x, validTarget.z) : Infinity;
    const toTarget = validTarget ? { x: validTarget.x - s.x, z: validTarget.z - s.z } : null;
    const facing = normFacing(m.facing, toTarget);
    const range = w.range;
    const hitIds = new Set();
    if (validTarget && targetDist <= range + COMBAT.ATTACK_RANGE_SLACK) hitIds.add(validTarget.id);
    if (w.style !== 'ranged' || !hitIds.size) {
      const cands = [];
      for (const mon of sh.live.monsters.values()) if (mon.regionId === regionId && mon.hp > 0) cands.push(mon);
      const arc = hitsInArc({ origin: s, facing, range, arcDeg: w.arc, targets: cands });
      if (w.style === 'ranged') { if (arc.length) hitIds.add(arc[0]); } // staff: single bolt
      else for (const id of arc) hitIds.add(id);
    }
    if (m.targetId && validTarget && hitIds.size === 0 && targetDist > range + COMBAT.ATTACK_RANGE_SLACK) {
      return {
        ok: false,
        error: 'out_of_range',
        dist: r1(targetDist),
        monsterX: r1(validTarget.x),
        monsterZ: r1(validTarget.z),
      };
    }
    if (m.targetId && !validTarget && hitIds.size === 0) {
      return { ok: false, error: 'no_target', targetId: String(m.targetId) };
    }
    ps.lastAttackAt = t;
    ps.attackReadyAt = t + cd;
    ps.comboStep = 1;
    let mult = 1;
    if (buffActive(ps, 'clone', t)) mult *= 2;
    const dmgUp = buffActive(ps, 'dmg_up', t);
    if (dmgUp) mult *= 1 + (dmgUp.pct || 0);
    const critUp = buffActive(ps, 'crit_up', t);
    const critChance = Math.min(0.85, COMBAT.CRIT_CHANCE + (critUp?.pct || 0));
    const hits = [];
    let anyCrit = false;
    withBatchedProfileSync(() => {
      for (const id of hitIds) {
        const mon = sh.live.monsters.get(id);
        if (!mon) continue;
        const crit = rng() < critChance;
        if (crit) anyCrit = true;
        const dmg = Math.round(weaponDamage({ tool, tier, stats, crit }) * mult);
        if (w.knockback && mon.kind !== 'boss' && mon.hp > dmg) {
          const d = dist(s.x, s.z, mon.x, mon.z) || 1;
          const p2 = clampToRegion(regionId, mon.x + ((mon.x - s.x) / d) * w.knockback, mon.z + ((mon.z - s.z) / d) * w.knockback, 1);
          mon.x = p2.x; mon.z = p2.z;
          mon.stunUntil = Math.max(mon.stunUntil, t + 300); // stagger
        }
        const mx = round2(mon.x), mz = round2(mon.z);
        const dealt = damageMonster(sh, mon, p.id, dmg, t);
        hits.push([id, dealt, crit, Math.max(0, Math.round(mon.hp)), mx, mz]);
      }
    });
    // Staff: heal allies around the bolt's landing point.
    const heals = [];
    if (w.style === 'ranged' && w.heal) {
      const center = validTarget || (hits[0] && { x: s.x + facing.x, z: s.z + facing.z }) || s;
      const amount = Math.round(w.heal * toolTierMult(tier));
      for (const uid of regionMembers(sh.id, regionId)) {
        if (uid === p.id) continue;
        const os = presence.get(uid);
        const ops = sh.live.players.get(uid);
        if (!os || !ops || ops.downUntil > t || ops.hp >= ops.maxHp) continue;
        if (dist(os.x, os.z, center.x, center.z) > COMBAT.STAFF_HEAL_RADIUS) continue;
        const amt = Math.min(ops.maxHp - ops.hp, amount);
        ops.hp += amt;
        credit(sh, regionId, p.id, { heal: amt });
        heals.push([uid, amt]);
        emitHp(sh, regionId, uid, ops, t);
      }
    }
    const weaponClass = activeWeaponClass(p.equipped, p.glamour);
    const hitStates = hits.map(([id]) => {
      const mon = sh.live.monsters.get(id);
      return mon ? [mon.id, mon.hp > 0 ? tagMask(mon, t) : 0, mon.hp > 0 ? poiseWire(mon, t) : 0] : null;
    }).filter(Boolean);
    broadcast(ws.instanceId, { type: 'sf_hit', by: p.id, tool, facing, hits, heals });
    broadcast(ws.instanceId, {
      type: 'sf_fx',
      kind: 'attack',
      by: p.id,
      x: r1(s.x),
      z: r1(s.z),
      weaponClass,
      comboStep: 1,
      vfxId: `combo_${weaponClass}_1`,
      crit: anyCrit,
      facing,
      hits,
      hitStates,
      partyHeals: heals,
      readyAt: ps.attackReadyAt,
    });
    return { ok: true, tool, weaponClass, comboStep: 1, hits, hitStates, heals, cooldownMs: cd, readyAt: ps.attackReadyAt, serverNow: t };
  }

  function resolveUltimateCharm(p, fr) {
    const ref = fr.ultimateCharmUid || p.equipped?.charm?.uid || p.equipped?.charm?.id || null;
    if (!ref) return null;
    const owned = findBestCharmForId(p.charms, ref);
    const id = owned?.id || (ULTIMATES[ref] ? ref : (p.equipped?.charm?.id || null));
    return ULTIMATES[id] ? id : null;
  }

  function castMonsterSkill(ws, p, m) {
    const c = combatContext(ws, p);
    if (c.error) return { ok: false, error: c.error };
    const { sh, regionId, s, ps, t } = c;
    if (ps.downUntil > t) return { ok: false, error: 'down', downUntil: ps.downUntil };

    const skills = ensureFrontierSkills(p);
    const isSlot = (i) => Number.isInteger(i) && i >= 0 && i < SKILL_SLOT_COUNT;
    let slotIdx = m.skillSlot !== undefined && m.skillSlot !== null ? Number(m.skillSlot) : -1;
    if (!isSlot(slotIdx)) {
      if (m.skillId) slotIdx = skills.equipped.indexOf(String(m.skillId));
    }
    if (!isSlot(slotIdx)) return { ok: false, error: 'no_skill_equipped' };
    if (!skillSlotUnlocks(p)[slotIdx]) return { ok: false, error: 'slot_locked', slot: slotIdx };
    const skillId = skills.equipped[slotIdx] || (m.skillId && skills.equipped.includes(String(m.skillId)) ? String(m.skillId) : null);
    const level = skillId ? (skills.unlocked[skillId] | 0) : 0;
    if (!skillId || !MONSTER_SKILLS[skillId] || level < 1 || skills.equipped[slotIdx] !== skillId) {
      return { ok: false, error: 'no_skill_equipped' };
    }

    ps.skillCds ||= [0, 0, 0, 0];
    while (ps.skillCds.length < SKILL_SLOT_COUNT) ps.skillCds.push(0);
    if (t < (ps.skillCds[slotIdx] || 0)) {
      return { ok: false, error: 'skill_cooldown', remainingMs: ps.skillCds[slotIdx] - t };
    }

    const stats = statsOf(p);
    const cdMs = skillCooldownMs(skillId, stats);
    ps.skillCds[slotIdx] = t + cdMs;

    const nums = computeSkillNumbers(skillId, level, stats, ps.maxHp);
    // Monster Passive: Tide-Pearl Blessing strengthens every shield you grant.
    const pas = activePassive(p);
    if (pas?.def.kind === 'shield' && nums.shieldHp > 0) nums.shieldHp = Math.round(nums.shieldHp * (1 + pas.value));

    // Weapon Echo: same skill, different flavour per active weapon class (Glamour || Equipped).
    const weaponClass = activeWeaponClass(p.equipped, p.glamour);
    const echo = weaponEchoFor(skillId, weaponClass);
    const RAD = (r) => r * echo.radiusMult;
    const RNG = (r) => r * echo.rangeMult;
    const zoneEnd = (ms) => t + ms + (echo.extraZoneTicks || 0) * 1000;

    // Data-driven combo identity (traits → reactions, applies → status tags).
    const combo = SKILL_COMBO[skillId] || { traits: [], applies: [] };
    const reactionsOut = [];
    const baseCtx = {
      traits: combo.traits,
      applies: [...new Set([...combo.applies, ...(echo.appliesOnHit || [])])],
      source: 'skill',
      tagDurMult: echo.tagDurMult || 1,
      reactionsOut,
    };
    // 🎶 Resonance: a Sustain/Support cast primes the next damaging skill (+25% DMG, statuses +50%).
    const isPrimeRole = RESONANCE.primeRoles.includes(combo.role);
    let resonanceUsed = false;
    if (!isPrimeRole && buffActive(ps, 'resonance', t)) {
      baseCtx.dmgMult = RESONANCE.dmgMult;
      baseCtx.tagDurMult = (baseCtx.tagDurMult || 1) * RESONANCE.tagDurMult;
      delete ps.buffs.resonance;
      resonanceUsed = true;
    }

    const target = m.targetId ? sh.live.monsters.get(String(m.targetId)) : null;
    const validTarget = target && target.regionId === regionId && target.hp > 0 ? target : null;
    const fallbackAim = validTarget
      ? { x: validTarget.x - s.x, z: validTarget.z - s.z }
      : (Number.isFinite(Number(m.targetX)) && Number.isFinite(Number(m.targetZ))
        ? { x: Number(m.targetX) - s.x, z: Number(m.targetZ) - s.z }
        : null);
    const facing = unitFacing(m.facing, fallbackAim);

    const startX = s.x, startZ = s.z;
    let effectX = s.x, effectZ = s.z;
    const hits = [];
    const partyBuffedIds = [];
    let shieldGranted = 0;
    let healAmount = 0;

    /** Unified skill hit: reactions + tags + Guard via comboHit, recorded as a 6-tuple hit. */
    const hitMon = (mon, dmg, extra = null) => {
      const mx = round2(mon.x), mz = round2(mon.z);
      const res = comboHit(sh, mon, p.id, dmg, t, extra ? { ...baseCtx, ...extra } : baseCtx);
      hits.push([mon.id, res.dealt, res.reactions.some((r) => r.crit), Math.max(0, Math.round(mon.hp)), mx, mz]);
      return res;
    };
    /** Hard stun after the hit resolves (so a skill never triggers Exposed on its own stun) + Guard chip. */
    const stunMon = (mon, ms) => {
      if (!mon || mon.hp <= 0 || !sh.live.monsters.has(mon.id)) return;
      mon.stunUntil = Math.max(mon.stunUntil || 0, t + ms);
      chipPoise(sh, mon, POISE.DAMAGE.stunApply, p.id, t);
    };
    const monstersInRegion = () => {
      const out = [];
      for (const mon of sh.live.monsters.values()) if (mon.regionId === regionId && mon.hp > 0) out.push(mon);
      return out;
    };
    const resolveGroundTarget = (maxReach, fallbackDist) => {
      const tx = Number(m.targetX), tz = Number(m.targetZ);
      let cl;
      if (validTarget && dist(startX, startZ, validTarget.x, validTarget.z) <= maxReach) {
        cl = clampToRegion(regionId, validTarget.x, validTarget.z, 0.5);
      } else if (Number.isFinite(tx) && Number.isFinite(tz) && dist(startX, startZ, tx, tz) <= maxReach) {
        cl = clampToRegion(regionId, tx, tz, 0.5);
      } else {
        cl = clampToRegion(regionId, startX + facing.x * fallbackDist, startZ + facing.z * fallbackDist, 0.5);
      }
      effectX = cl.x; effectZ = cl.z;
    };
    const healParty = (radius, amount, { buffs = null, emitAlways = false } = {}) => {
      const recipients = new Set([p.id, ...regionMembers(sh.id, regionId)]);
      for (const uid of recipients) {
        const os = uid === p.id ? s : presence.get(uid);
        const ops = playerState(sh, uid);
        if (!os || !ops || ops.downUntil > t) continue;
        if (uid !== p.id && dist(os.x, os.z, startX, startZ) > radius) continue;
        const gain = Math.min(Math.max(0, ops.maxHp - ops.hp), amount);
        if (gain > 0) {
          ops.hp += gain;
          credit(sh, regionId, p.id, { heal: gain });
        }
        if (buffs) {
          for (const [k, v] of Object.entries(buffs)) ops.buffs[k] = { ...v };
          partyBuffedIds.push(uid);
        }
        if (gain > 0 || emitAlways) emitHp(sh, regionId, uid, ops, t);
        if (uid === p.id) healAmount = gain > 0 ? gain : amount;
      }
    };
    const shieldParty = (radius, until, extraBuffs = null) => {
      shieldGranted = nums.shieldHp;
      const recipients = new Set([p.id, ...regionMembers(sh.id, regionId)]);
      for (const uid of recipients) {
        const os = uid === p.id ? s : presence.get(uid);
        const ops = playerState(sh, uid);
        if (!os || !ops || ops.downUntil > t) continue;
        if (uid !== p.id && dist(os.x, os.z, startX, startZ) > radius) continue;
        ops.shieldHp = nums.shieldHp;
        ops.shield = nums.shieldHp;
        ops.shieldUntil = until;
        if (extraBuffs) for (const [k, v] of Object.entries(extraBuffs)) ops.buffs[k] = { ...v };
        partyBuffedIds.push(uid);
        emitHp(sh, regionId, uid, ops, t);
      }
    };
    const dashTo = (dest) => {
      if (s) { s.x = dest.x; s.z = dest.z; s.t = t - 950; }
      ps.x = dest.x; ps.z = dest.z;
      onPlayerMoved(p, ws.instanceId, dest.x, dest.z);
      broadcast(ws.instanceId, { type: 'player_moved', id: p.id, x: dest.x, z: dest.z, vx: 0, vz: 0, right: facing.x >= 0, back: facing.z < -0.35 }, p.id);
    };

    withBatchedProfileSync(() => {
      switch (skillId) {
        case 'sk_pollen_ring': {
          const radius = RAD(4.4);
          liveRegion(sh, regionId).skillZones.push({
            kind: 'pollen_ring', by: p.id, x: startX, z: startZ, radius,
            healPerTick: nums.healPerTick, nextTickAt: t + 1000, endsAt: zoneEnd(5000),
          });
          healParty(radius, nums.healPerTick);
          break;
        }
        case 'sk_jelly_shield': {
          shieldParty(4.8, t + 6000);
          const radius = RAD(4.2);
          for (const mon of monstersInRegion()) {
            if (dist(startX, startZ, mon.x, mon.z) > radius) continue;
            mon.slowUntil = Math.max(mon.slowUntil || 0, t + 3000);
            mon.slowPct = 0.40;
            hitMon(mon, 0);
          }
          break;
        }
        case 'sk_tusk_rush': {
          const dest = clampMove(ws.instanceId, startX + facing.x * 5.2, startZ + facing.z * 5.2);
          dashTo(dest);
          effectX = dest.x; effectZ = dest.z;
          const halfW = ((MONSTER_SKILLS.sk_tusk_rush.lineWidth || 2.0) / 2 + 0.7) * echo.radiusMult;
          const rushStunMs = (Number(stats?.swiftness) || 0) >= 135 ? (nums.stunMs || 850) : 850;
          for (const mon of monstersInRegion()) {
            if (distToSegment(mon.x, mon.z, startX, startZ, dest.x, dest.z) > halfW) continue;
            hitMon(mon, nums.damage);
            stunMon(mon, rushStunMs);
          }
          break;
        }
        case 'sk_crystal_fan': {
          const arcDeg = level >= 5 ? 76 : 62;
          const fanRange = RNG(MONSTER_SKILLS.sk_crystal_fan.range || 7.2);
          const hitIds = hitsInArc({ origin: { x: startX, z: startZ }, facing, range: fanRange, arcDeg, targets: monstersInRegion() });
          for (const id of hitIds) {
            const mon = sh.live.monsters.get(id);
            if (mon && mon.hp > 0) hitMon(mon, nums.damage);
          }
          break;
        }
        case 'sk_echo_drain': {
          let totalDealt = 0;
          let hitCount = 0;
          let leechMult = 1;
          const radius = RAD(3.8);
          for (const mon of monstersInRegion()) {
            if (dist(startX, startZ, mon.x, mon.z) > radius) continue;
            const res = hitMon(mon, nums.damage);
            totalDealt += res.dealt;
            if (res.reactions.some((r) => r.healMult)) leechMult = Math.max(leechMult, REACTIONS.siphon.healMult || 2);
            hitCount += 1;
          }
          if (hitCount > 0) {
            const rawHeal = Math.round(Math.max(4, Math.round(ps.maxHp * 0.08), Math.round(totalDealt * 0.25)) * leechMult);
            const actualGain = Math.min(Math.max(0, ps.maxHp - opsOrPs(ps)), rawHeal);
            ps.hp += actualGain;
            healAmount = actualGain > 0 ? actualGain : rawHeal;
            if (actualGain > 0) credit(sh, regionId, p.id, { heal: actualGain });
            emitHp(sh, regionId, p.id, ps, t);
          }
          break;
        }
        case 'sk_gravity_spin': {
          const radius = RAD(4.6);
          const R = liveRegion(sh, regionId);
          for (const mon of monstersInRegion()) {
            const d = dist(startX, startZ, mon.x, mon.z);
            if (d > radius) continue;
            if (mon.kind !== 'boss' && d > 1.1) {
              const p2 = clampToRegion(regionId, startX + ((mon.x - startX) / d) * 1.1, startZ + ((mon.z - startZ) / d) * 1.1, 0.8);
              mon.x = p2.x; mon.z = p2.z;
              R.dirty.add(mon.id);
            }
            hitMon(mon, nums.damage);
          }
          break;
        }
        case 'sk_earthshatter': {
          resolveGroundTarget(MONSTER_SKILLS.sk_earthshatter.castRange || 7.5, 2.2);
          const radius = 4.8;
          const hiSwf = (Number(stats?.swiftness) || 0) >= 135;
          for (const mon of monstersInRegion()) {
            if (dist(effectX, effectZ, mon.x, mon.z) > radius) continue;
            hitMon(mon, nums.damage);
            stunMon(mon, mon.kind === 'boss' ? (hiSwf ? (nums.bossStunMs || 700) : 700) : (hiSwf ? (nums.stunMs || 1500) : 1500));
          }
          break;
        }
        case 'sk_prism_beam': {
          const beamLen = RNG(MONSTER_SKILLS.sk_prism_beam.range || 10.0);
          const endX = startX + facing.x * beamLen;
          const endZ = startZ + facing.z * beamLen;
          effectX = endX; effectZ = endZ;
          const halfW = (level >= 5 ? 1.2 : 0.95) + 0.45;
          for (const mon of monstersInRegion()) {
            if (distToSegment(mon.x, mon.z, startX, startZ, endX, endZ) <= halfW) hitMon(mon, nums.damage);
          }
          break;
        }
        case 'sk_zephyr_vault': {
          const vaultRange = RNG(MONSTER_SKILLS.sk_zephyr_vault.range || 7.6);
          const hitIds = hitsInArc({ origin: { x: startX, z: startZ }, facing, range: vaultRange, arcDeg: 70, targets: monstersInRegion() });
          for (const id of hitIds) {
            const mon = sh.live.monsters.get(id);
            if (!mon || mon.hp <= 0) continue;
            mon.slowUntil = Math.max(mon.slowUntil || 0, t + 2500);
            mon.slowPct = 0.35;
            hitMon(mon, nums.damage);
          }
          const dest = clampMove(ws.instanceId, startX - facing.x * 3.4, startZ - facing.z * 3.4);
          dashTo(dest);
          effectX = startX + facing.x * 3.4;
          effectZ = startZ + facing.z * 3.4;
          ps.buffs.haste = { pct: 0.30, until: t + 3500 };
          partyBuffedIds.push(p.id);
          break;
        }
        case 'sk_frost_nova': {
          const radius = RAD(4.5);
          const R = liveRegion(sh, regionId);
          const hiSwf = (Number(stats?.swiftness) || 0) >= 135;
          for (const mon of monstersInRegion()) {
            if (dist(startX, startZ, mon.x, mon.z) > radius) continue;
            const res = hitMon(mon, nums.damage);
            if (mon.hp <= 0) continue;
            const deep = res.reactions.some((r) => r.freezeMult);
            const baseFreeze = mon.kind === 'boss'
              ? (hiSwf ? (nums.bossFreezeMs || 750) : 750)
              : (hiSwf ? (nums.freezeMs || 1600) : 1600);
            const freezeDur = Math.round(baseFreeze * (deep ? 2 : 1) * (echo.tagDurMult || 1));
            mon.frozenUntil = Math.max(mon.frozenUntil || 0, t + freezeDur);
            mon.slowUntil = Math.max(mon.slowUntil || 0, t + 4000);
            mon.slowPct = 0.50;
            mon.vuln = 0.15;
            if (!mon.tags?.chilled || mon.tags.chilled <= t) {
              applyTag(mon, 'chilled', t, null, echo.tagDurMult || 1);
            }
            R.dirty.add(mon.id);
          }
          break;
        }
        case 'sk_foxfire_wisps': {
          const wispRange = RNG(MONSTER_SKILLS.sk_foxfire_wisps.range || 8.6);
          const cands = monstersInRegion().filter((mon) => dist(startX, startZ, mon.x, mon.z) <= wispRange);
          cands.sort((a, b) => dist(startX, startZ, a.x, a.z) - dist(startX, startZ, b.x, b.z));
          const orbs = 3 + (echo.extraProjectiles || 0);
          const top = cands.slice(0, orbs);
          const orbDmg = Math.max(1, Math.round(nums.damage * 0.55));
          effectX = top[0] ? top[0].x : startX + facing.x * 3.5;
          effectZ = top[0] ? top[0].z : startZ + facing.z * 3.5;
          for (let i = 0; i < orbs && top.length > 0; i++) {
            let mon = top[i % top.length];
            if (!mon || mon.hp <= 0 || !sh.live.monsters.has(mon.id)) {
              mon = cands.find((cc) => cc.hp > 0 && sh.live.monsters.has(cc.id)) || null;
            }
            if (!mon) break;
            hitMon(mon, orbDmg);
          }
          break;
        }
        case 'sk_mirror_shell': {
          const until = t + 5000;
          shieldParty(4.6, until, { dmg_reduce: { pct: 0.45, reflectPct: 0.35, until } });
          const radius = RAD(4.6);
          for (const mon of monstersInRegion()) {
            if (dist(startX, startZ, mon.x, mon.z) <= radius) hitMon(mon, nums.damage);
          }
          break;
        }
        case 'sk_tailwind_gale': {
          const until = t + 6000;
          healParty(RAD(5.5), nums.healPerTick, {
            buffs: { haste: { pct: 0.35, until }, crit_up: { pct: 0.20, until } },
            emitAlways: true,
          });
          break;
        }
        case 'sk_koi_whirlpool': {
          resolveGroundTarget(MONSTER_SKILLS.sk_koi_whirlpool.castRange || 7.8, 3.6);
          const R = liveRegion(sh, regionId);
          const radius = 4.6;
          for (const mon of monstersInRegion()) {
            const d = dist(effectX, effectZ, mon.x, mon.z);
            if (d > radius) continue;
            if (mon.kind !== 'boss' && d > 0.9) {
              const p2 = clampToRegion(regionId, effectX + ((mon.x - effectX) / d) * 0.9, effectZ + ((mon.z - effectZ) / d) * 0.9, 0.8);
              mon.x = p2.x; mon.z = p2.z;
              R.dirty.add(mon.id);
            }
            hitMon(mon, nums.damage);
          }
          R.skillZones.push({
            kind: 'koi_whirlpool', by: p.id, x: effectX, z: effectZ, radius,
            dmgPerTick: nums.damage, nextTickAt: t + 1000, endsAt: zoneEnd(4000), tagDurMult: echo.tagDurMult || 1,
          });
          break;
        }
        case 'sk_sakura_tempest': {
          const radius = RAD(5.6);
          for (const mon of monstersInRegion()) {
            if (dist(startX, startZ, mon.x, mon.z) <= radius) hitMon(mon, nums.damage);
          }
          healParty(radius, nums.healPerTick);
          liveRegion(sh, regionId).skillZones.push({
            kind: 'sakura_tempest', by: p.id, follow: p.id, x: startX, z: startZ, radius,
            dmgPerTick: nums.damage, healPerTick: nums.healPerTick, nextTickAt: t + 1000, endsAt: zoneEnd(3000),
            tagDurMult: echo.tagDurMult || 1,
          });
          break;
        }
        case 'sk_solar_meteor': {
          resolveGroundTarget(MONSTER_SKILLS.sk_solar_meteor.castRange || 8.2, 3.8);
          const radius = 4.4;
          for (const mon of monstersInRegion()) {
            if (dist(effectX, effectZ, mon.x, mon.z) <= radius) hitMon(mon, nums.damage);
          }
          liveRegion(sh, regionId).skillZones.push({
            kind: 'solar_burn', by: p.id, x: effectX, z: effectZ, radius,
            dmgPerTick: Math.max(1, Math.round(nums.damage * 0.25)), nextTickAt: t + 1000, endsAt: zoneEnd(3000),
            tagDurMult: echo.tagDurMult || 1,
          });
          break;
        }
        case 'sk_chain_lightning': {
          const chainRange = RNG(MONSTER_SKILLS.sk_chain_lightning.range || 8.5);
          const bounceRange = MONSTER_SKILLS.sk_chain_lightning.bounceRange || 6.0;
          let cur = validTarget && dist(startX, startZ, validTarget.x, validTarget.z) <= chainRange ? validTarget : null;
          if (!cur) {
            let bestD = Infinity;
            for (const mon of monstersInRegion()) {
              const d = dist(startX, startZ, mon.x, mon.z);
              if (d <= chainRange && d < bestD) { bestD = d; cur = mon; }
            }
          }
          if (cur) { effectX = cur.x; effectZ = cur.z; } else { effectX = startX + facing.x * 4.0; effectZ = startZ + facing.z * 4.0; }
          const visited = new Set();
          let maxBounces = 4 + (echo.extraProjectiles || 0);
          let conducted = false;
          for (let b = 0; b < maxBounces && cur; b++) {
            visited.add(cur.id);
            const curX = cur.x, curZ = cur.z;
            const res = hitMon(cur, nums.damage);
            if (!conducted && res.reactions.some((r) => r.extraBounces)) {
              conducted = true;
              maxBounces += REACTIONS.conduction.extraBounces;
            }
            stunMon(cur, (Number(stats?.swiftness) || 0) >= 135 ? (nums.stunMs || 550) : 550);
            let nextMon = null, nextD = Infinity;
            for (const mon of monstersInRegion()) {
              if (visited.has(mon.id)) continue;
              const d = dist(curX, curZ, mon.x, mon.z);
              if (d <= bounceRange && d < nextD) { nextD = d; nextMon = mon; }
            }
            cur = nextMon;
          }
          break;
        }
        case 'sk_star_brand': {
          resolveGroundTarget(MONSTER_SKILLS.sk_star_brand.castRange || 8.0, 3.6);
          const radius = 4.2;
          for (const mon of monstersInRegion()) {
            if (dist(effectX, effectZ, mon.x, mon.z) > radius) continue;
            hitMon(mon, nums.damage);
            mon.vulnUntil = Math.max(mon.vulnUntil || 0, t + 5000);
            mon.vulnPct = 0.25;
          }
          break;
        }
        case 'sk_time_dilation': {
          const radius = RAD(5.0);
          const extendPct = SKILL_COMBO.sk_time_dilation.extendTagsPct || 0.5;
          for (const mon of monstersInRegion()) {
            if (dist(startX, startZ, mon.x, mon.z) > radius) continue;
            hitMon(mon, nums.damage);
            if (mon.hp <= 0) continue;
            extendTags(mon, t, extendPct); // ⏳ Time Lock: every status on slowed foes lasts +50%
            mon.slowUntil = Math.max(mon.slowUntil || 0, t + 4500);
            mon.slowPct = 0.65;
          }
          for (let i = 0; i < ps.skillCds.length; i++) {
            if (i !== slotIdx && ps.skillCds[i] > t) ps.skillCds[i] = Math.max(t, ps.skillCds[i] - 2500);
          }
          break;
        }
        case 'sk_supernova_cleave': {
          const novaRange = RNG(MONSTER_SKILLS.sk_supernova_cleave.range || 8.5);
          const hitIds = hitsInArc({ origin: { x: startX, z: startZ }, facing, range: novaRange, arcDeg: 95, targets: monstersInRegion() });
          const hiSwf = (Number(stats?.swiftness) || 0) >= 135;
          for (const id of hitIds) {
            const mon = sh.live.monsters.get(id);
            if (!mon || mon.hp <= 0) continue;
            hitMon(mon, nums.damage);
            stunMon(mon, mon.kind === 'boss' ? (hiSwf ? (nums.bossStunMs || 700) : 700) : (hiSwf ? (nums.stunMs || 1400) : 1400));
          }
          effectX = startX + facing.x * 4.2;
          effectZ = startZ + facing.z * 4.2;
          break;
        }
        default: break;
      }
    });
    if (reactionsOut.length) noteReactions(p.id, reactionsOut, ws.instanceId);
    const resonancePrimed = isPrimeRole;
    if (isPrimeRole) ps.buffs.resonance = { pct: RESONANCE.dmgMult - 1, until: t + RESONANCE.windowMs };

    const R = liveRegion(sh, regionId);
    const hitStates = [];
    const frozenSet = new Set();
    for (const [monId] of hits) {
      const mon = sh.live.monsters.get(monId);
      if (!mon) continue;
      if (mon.hp > 0) {
        R.dirty.add(mon.id);
        if (mon.frozenUntil > t) frozenSet.add(mon.id);
      }
      hitStates.push([mon.id, mon.hp > 0 ? tagMask(mon, t) : 0, mon.hp > 0 ? poiseWire(mon, t) : 0]);
    }
    const frozenIds = [...frozenSet];

    ps.x = s.x; ps.z = s.z;
    const skillCds = [...ps.skillCds];
    const buffs = collectActiveBuffs(ps, t);
    broadcast(ws.instanceId, {
      type: 'sf_fx',
      kind: 'monster_skill',
      by: p.id,
      skillSlot: slotIdx,
      skillId,
      level,
      vfxId: skillId,
      x: r1(s.x),
      z: r1(s.z),
      startX: r1(startX),
      startZ: r1(startZ),
      targetX: r1(effectX),
      targetZ: r1(effectZ),
      facing,
      cooldownMs: cdMs,
      skillCds,
      hits,
      hitStates,
      frozenIds,
      reactions: reactionsOut,
      echo: weaponClass,
      resonanceUsed,
      resonancePrimed,
      shieldHp: shieldGranted,
      healAmount,
      buffs,
      partyBuffedIds,
    });
    return {
      ok: true,
      skillSlot: slotIdx,
      skillId,
      level,
      cooldownUntil: ps.skillCds[slotIdx],
      cooldownMs: cdMs,
      skillCds,
      pos: { x: s.x, z: s.z },
      hits,
      hitStates,
      frozenIds,
      reactions: reactionsOut,
      echo: weaponClass,
      resonanceUsed,
      resonancePrimed,
      shieldHp: shieldGranted,
      healAmount,
      buffs,
      partyBuffedIds,
    };
  }

  function opsOrPs(ps) {
    return Number(ps?.hp) || 0;
  }

  function ultimate(ws, p, m) {
    if (m.skillSlot !== undefined || m.skillId) {
      return castMonsterSkill(ws, p, m);
    }
    const c = combatContext(ws, p);
    if (c.error) return { ok: false, error: c.error };
    const { sh, regionId, s, fr, ps, t } = c;
    if (ps.downUntil > t) return { ok: false, error: 'down', downUntil: ps.downUntil };
    const charmId = resolveUltimateCharm(p, fr);
    if (!charmId) return { ok: false, error: 'no_ultimate' };
    if (t < ps.ultReadyAt) return { ok: false, error: 'cooldown', readyAt: ps.ultReadyAt };
    const def = ULTIMATES[charmId];
    const eff = def.effect;
    const meal = activeMealBuff(fr, t);
    const teaBuff = !!meal && (meal.id === 'tea' || meal.food === 'boba_tea');
    ps.ultReadyAt = t + ultimateCooldownMs(charmId, { teaBuff });
    const facing = normFacing(m.facing);
    const radius = eff.radius || def.radius || 6;
    const stats = statsOf(p);
    const tb = fr.toolbelt || {};
    const tool = WEAPONS[tb.main] ? tb.main : 'pickaxe';
    const baseDmg = weaponDamage({ tool, tier: Math.max(1, Number(tb[tool]) || 1), stats });
    const L = sh.live;
    const near = [];
    for (const mon of L.monsters.values()) if (mon.regionId === regionId && dist(s.x, s.z, mon.x, mon.z) <= radius) near.push(mon);
    const allies = [];
    for (const uid of regionMembers(sh.id, regionId)) {
      const os = presence.get(uid);
      if (os && dist(s.x, s.z, os.x, os.z) <= Math.max(radius, 0.01)) allies.push(uid);
    }
    if (!allies.includes(p.id)) allies.push(p.id);
    const hits = [];
    const hitMon = (mon, dmg) => { const d = damageMonster(sh, mon, p.id, dmg, t); hits.push([mon.id, d]); };
    let until = 0;
    withBatchedProfileSync(() => {
      switch (eff.type) {
        case 'nuke': for (const mon of near) hitMon(mon, baseDmg * (eff.mult || 4)); break;
        case 'cone': {
          const cands = []; for (const mon of L.monsters.values()) if (mon.regionId === regionId) cands.push(mon);
          for (const id of hitsInArc({ origin: s, facing, range: radius, arcDeg: 90, targets: cands })) hitMon(L.monsters.get(id), baseDmg * (eff.mult || 2.5));
          break;
        }
        case 'homing': {
          near.sort((a, b) => dist(s.x, s.z, a.x, a.z) - dist(s.x, s.z, b.x, b.z));
          const n = eff.n || 6;
          for (let i = 0; i < n && near.length; i++) hitMon(near[i % near.length], baseDmg * (eff.dmgMult || 1.2));
          break;
        }
        case 'stun': for (const mon of near) { mon.stunUntil = t + eff.ms; hits.push([mon.id, 0]); } until = t + eff.ms; break;
        case 'freeze': for (const mon of near) { mon.frozenUntil = t + eff.ms; mon.vuln = eff.vuln || 0; hits.push([mon.id, 0]); } until = t + eff.ms; break;
        case 'slow': for (const mon of near) { mon.slowUntil = t + eff.ms; mon.slowPct = eff.pct || 0.5; hits.push([mon.id, 0]); } until = t + eff.ms; break;
        case 'pull':
          for (const mon of near) {
            if (mon.kind === 'boss') continue;
            const d = dist(s.x, s.z, mon.x, mon.z) || 1;
            const keep = Math.min(d, 1.2);
            const p2 = clampToRegion(regionId, s.x + ((mon.x - s.x) / d) * keep, s.z + ((mon.z - s.z) / d) * keep, 0.8);
            mon.x = p2.x; mon.z = p2.z;
            liveRegion(sh, regionId).dirty.add(mon.id);
            hits.push([mon.id, 0, false, Math.max(0, Math.round(mon.hp)), round2(mon.x), round2(mon.z)]);
          }
          break;
        case 'heal_field':
          until = t + eff.ms;
          L.effects.push({ kind: 'heal', regionId, by: p.id, x: s.x, z: s.z, follow: null, radius, pctPerSec: eff.pctPerSec || 0.06, until, lastAt: 0 });
          break;
        case 'shield':
          until = t + eff.ms;
          for (const uid of allies) {
            const aps = playerState(sh, uid);
            const shVal = Math.round(aps.maxHp * (eff.pct || 0.25));
            aps.shield = shVal; aps.shieldHp = shVal; aps.shieldUntil = until;
            aps.buffs.dmg_up = { pct: eff.dmgPct || 0, until };
            emitHp(sh, regionId, uid, aps, t);
          }
          break;
        case 'haste':
          until = t + eff.ms;
          for (const uid of eff.party ? allies : [p.id]) playerState(sh, uid).buffs.haste = { pct: eff.pct || 0.35, until };
          break;
        case 'loot_boost': until = t + eff.ms; ps.buffs.loot_boost = { pct: eff.pct || 0.3, until }; break;
        case 'free_swings': ps.buffs.free_swings = { n: (ps.buffs.free_swings?.n || 0) + (eff.n || 8) }; break;
        case 'rare_reroll': ps.buffs.rare_reroll = { n: (ps.buffs.rare_reroll?.n || 0) + (eff.swings || 5) }; break;
        case 'clone': until = t + eff.ms; ps.buffs.clone = { until }; break; // Twin Cast: double weapon damage
        case 'summon': // Royal Guard: simplified to a damage aura following the caster
          until = t + eff.ms;
          L.effects.push({ kind: 'dot', regionId, by: p.id, x: s.x, z: s.z, follow: p.id, radius: 3.5, dps: Math.round(baseDmg * 0.6), until, lastAt: 0 });
          break;
        case 'loot_shower': // Jackpot: double drops for allies in radius
          until = t + eff.ms;
          for (const uid of allies) playerState(sh, uid).buffs.loot_shower = { until };
          break;
        default: break;
      }
    });
    broadcast(ws.instanceId, { type: 'sf_ult', by: p.id, charmId, name: def.name, effect: eff.type, x: r1(s.x), z: r1(s.z), facing, radius, hits, allies, until });
    return { ok: true, charmId, effect: eff.type, readyAt: ps.ultReadyAt, hits, until, buffs: ps.buffs };
  }

  function repair(ws, p, m) {
    const c = combatContext(ws, p);
    if (c.error) return { ok: false, error: c.error };
    const { sh, regionId, s, fr, ps, t } = c;
    if (ps.downUntil > t) return { ok: false, error: 'down' };
    const opRegion = m.outpostId && REGIONS[m.outpostId] ? m.outpostId : regionId;
    if (opRegion !== regionId) return { ok: false, error: 'wrong_region' };
    const poi = REGIONS[regionId].pois.outpost;
    if (poi && dist(s.x, s.z, poi.x, poi.z) > 6) return { ok: false, error: 'too_far' };
    const have = Math.max(0, Math.floor(Number(fr.pantry.items.repair_kit) || 0));
    const want = Math.max(1, Math.floor(Number(m.kits) || 1));
    if (have <= 0) return { ok: false, error: 'no_kits' };
    const op = outpostOf(sh, regionId);
    const used = repairOutpost(op, Math.min(have, want));
    if (used <= 0) return { ok: false, error: 'full', outpost: outpostWire(sh, regionId) };
    if (have - used <= 0) delete fr.pantry.items.repair_kit;
    else fr.pantry.items.repair_kit = have - used;
    credit(sh, regionId, p.id, { repair: used * OUTPOST.repairKitHeal });
    fr.stats ||= {};
    fr.stats.repairs = (fr.stats.repairs || 0) + used;
    db.markProfile?.(p.id);
    saveShard(sh);
    const wire = outpostWire(sh, regionId);
    const R = liveRegion(sh, regionId);
    R.outpostDirty = false; R.lastOutpostAt = t;
    broadcast(ws.instanceId, { type: 'sf_outpost', ...wire, repairedBy: p.id, kits: used });
    return { ok: true, used, outpost: wire, pantry: fr.pantry };
  }

  /**
   * Story 'visit' steps (Master Plan v2 §11.6): called by server.js after an accepted frontier move.
   * Cheap: only checks the current chapter's unfinished visit steps against this region's POIs.
   */
  function onPlayerMoved(p, instanceId, x, z) {
    const parsed = parseFrontierInstance(instanceId);
    const region = REGIONS[parsed?.regionId];
    if (!region || !p) return false;
    p.story ||= defaultStory();
    const ch = CHAPTERS[p.story.chapter];
    if (!ch) return false;
    let changed = false;
    const gateTargetMap = { gate_hollow: 'hollow', gate_reef: 'reef', gate_caldera: 'caldera' };
    for (const step of ch.steps) {
      if (step.kind !== 'visit' || (p.story.progress?.[step.id] || 0) >= step.count) continue;
      const poi = region.pois[step.target];
      const gateReg = gateTargetMap[step.target] || null;
      const visitedDirectly = Boolean(gateReg && parsed?.regionId === gateReg);
      if (visitedDirectly || (poi && Math.hypot(poi.x - x, poi.z - z) <= 5.5)) {
        if (recordEvent(p.story, { kind: 'visit', target: step.target }).length) changed = true;
        if (gateReg) {
          const fr = ensureFrontier(p);
          if (fr) {
            fr.unlocks ||= { regions: ['meadow'], gates: [] };
            fr.unlocks.gates ||= [];
            if (!fr.unlocks.gates.includes(gateReg)) { fr.unlocks.gates.push(gateReg); changed = true; }
            fr.unlocks.regions ||= ['meadow'];
            if (!fr.unlocks.regions.includes(gateReg)) { fr.unlocks.regions.push(gateReg); changed = true; }
          }
        }
      }
    }
    if (changed) { db.markProfile?.(p.id); onProfileChanged(p); }
    return changed;
  }

  /** Message router for `sf_*` messages that don't need an instance switch. */
  function handle(ws, p, m) {
    switch (m.type) {
      case 'sf_strike': return strike(ws, p, m);
      case 'sf_attack':
        if (m.skillSlot !== undefined || m.skillId) return ultimate(ws, p, m);
        return attack(ws, p, m);
      case 'sf_ultimate': return ultimate(ws, p, m);
      case 'sf_repair': return repair(ws, p, m);
      case 'sf_boss_start': return bossStart(ws, p, m);
      case 'sf_state': {
        const t = now();
        const fr = ensureFrontier(p);
        if (fr && m.op === 'bounty_claim') {
          const res = claimFieldBounty(fr, m.slot, t);
          if (!res.ok) return { ok: false, op: 'bounty_claim', error: res.error, bounties: fr.bounties };
          if (res.goldGain > 0) p.gold = Math.max(0, (Number(p.gold) || 0) + res.goldGain);
          db.markProfile?.(p.id);
          onProfileChanged(p);
          return {
            ok: true,
            op: 'bounty_claim',
            ...res,
            gold: p.gold,
            frontier: fr,
          };
        }
        if (fr && m.op === 'bounty_bonus') {
          const res = claimFieldBountyBonus(fr, t);
          if (!res.ok) return { ok: false, op: 'bounty_bonus', error: res.error, bounties: fr.bounties };
          if (res.goldGain > 0) p.gold = Math.max(0, (Number(p.gold) || 0) + res.goldGain);
          if (res.diamondGain > 0) p.diamonds = Math.max(0, (Number(p.diamonds) || 0) + res.diamondGain);
          db.markProfile?.(p.id);
          onProfileChanged(p);
          return {
            ok: true,
            op: 'bounty_bonus',
            ...res,
            gold: p.gold,
            diamonds: p.diamonds,
            frontier: fr,
          };
        }
        if (fr) {
          fr.energy = regenEnergy(fr.energy, t);
          activeMealBuff(fr, t);
          ensureFieldBounties(fr, t);
        }
        return {
          ok: true,
          layout: isFrontierInstance(ws.instanceId) ? layoutPayload(ws.instanceId) : null,
          frontier: fr,
          energy: fr?.energy,
          bounties: fr?.bounties,
        };
      }
      case 'sf_energy_daily': {
        const fr = ensureFrontier(p);
        if (!fr) return { ok: false, error: 'no_state' };
        const res = claimDailyEnergy(fr, now());
        if (!res.ok) return { ok: false, error: res.error, energy: fr.energy };
        db.markProfile?.(p.id);
        return { ok: true, energy: fr.energy };
      }
      case 'sf_energy_diamond': {
        const fr = ensureFrontier(p);
        if (!fr) return { ok: false, error: 'no_state' };
        const res = diamondRefill(fr, p.diamonds || 0, now());
        if (!res.ok) return { ok: false, error: res.error, cost: res.cost, energy: fr.energy };
        p.diamonds = Math.max(0, (p.diamonds || 0) - res.cost);
        db.markProfile?.(p.id);
        return { ok: true, cost: res.cost, diamonds: p.diamonds, energy: fr.energy };
      }
      case 'sf_energy_gift': {
        const fr = ensureFrontier(p);
        if (!fr) return { ok: false, error: 'no_state' };
        if (!isCouple(p) || !p.partner_id) {
          return { ok: false, error: 'no_couple', energy: regenEnergy(fr.energy, now()) };
        }
        const partnerProfile = db.getProfile?.(p.partner_id);
        if (!partnerProfile) {
          return { ok: false, error: 'no_partner', energy: regenEnergy(fr.energy, now()) };
        }
        const receiverFr = ensureFrontier(partnerProfile);
        if (!receiverFr) {
          return { ok: false, error: 'no_partner_state', energy: regenEnergy(fr.energy, now()) };
        }
        const res = applyPartnerGift(fr, receiverFr, now());
        if (!res.ok) {
          return { ok: false, error: res.error, energy: fr.energy };
        }
        db.markProfile?.(p.id);
        db.markProfile?.(partnerProfile.id);
        onProfileChanged(partnerProfile);
        return { ok: true, energy: fr.energy };
      }
      case 'sf_eat': {
        const fr = ensureFrontier(p);
        if (!fr) return { ok: false, error: 'no_state' };
        const t = now();
        if (m.foodId === 'potion_small') {
          const have = Math.max(0, Math.floor(Number(fr.pantry?.items?.potion_small) || 0));
          if (have < 1) return { ok: false, error: 'none', energy: regenEnergy(fr.energy, t) };
          const parsed = parseFrontierInstance(ws.instanceId);
          if (!parsed?.shardId) return { ok: false, error: 'not_in_frontier', energy: regenEnergy(fr.energy, t) };
          const regionId = REGIONS[parsed.regionId] ? parsed.regionId : 'meadow';
          const sh = loadShard(parsed.shardId);
          const ps = playerState(sh, p.id, p);
          if (ps.downUntil > t) return { ok: false, error: 'down', energy: regenEnergy(fr.energy, t) };
          if (ps.hp >= ps.maxHp) return { ok: false, error: 'hp_full', hp: ps.hp, maxHp: ps.maxHp, energy: regenEnergy(fr.energy, t) };
          if (ps.potionCdUntil && t < ps.potionCdUntil) {
            return { ok: false, error: 'cooldown', readyAt: ps.potionCdUntil, energy: regenEnergy(fr.energy, t) };
          }
          if (have <= 1) delete fr.pantry.items.potion_small;
          else fr.pantry.items.potion_small = have - 1;
          const healed = Math.min(ps.maxHp - ps.hp, Math.ceil(ps.maxHp * COMBAT.POTION_HEAL_PCT));
          ps.hp += healed;
          ps.potionCdUntil = t + COMBAT.POTION_COOLDOWN_MS;
          fr.energy = regenEnergy(fr.energy, t);
          db.markProfile?.(p.id);
          onProfileChanged(p);
          emitHp(sh, regionId, p.id, ps, t);
          return {
            ok: true,
            foodId: 'potion_small',
            healed,
            hp: ps.hp,
            maxHp: ps.maxHp,
            pantry: fr.pantry,
            energy: fr.energy,
          };
        }
        const res = eatFood(fr, m.foodId, t);
        if (!res.ok) return { ok: false, error: res.error, energy: fr.energy };
        db.markProfile?.(p.id);
        return { ok: true, foodId: m.foodId, energy: fr.energy, buff: res.buff };
      }
      case 'sf_pouch_set': {
        const fr = ensureFrontier(p);
        if (!fr) return { ok: false, error: 'no_state' };
        if (m.skillAction === 'equip') {
          const skills = ensureFrontierSkills(p);
          const slotIdx = Number(m.slot);
          if (!Number.isInteger(slotIdx) || slotIdx < 0 || slotIdx >= SKILL_SLOT_COUNT) {
            return { ok: false, error: 'bad_skill_slot' };
          }
          const skillId = m.skillId ? String(m.skillId) : null;
          if (skillId !== null) {
            if (!skillSlotUnlocks(p)[slotIdx]) return { ok: false, error: 'slot_locked', slot: slotIdx };
            if (!MONSTER_SKILLS[skillId] || (skills.unlocked[skillId] | 0) < 1) {
              return { ok: false, error: 'skill_locked' };
            }
            const otherIdx = skills.equipped.findIndex((x, i) => i !== slotIdx && x === skillId);
            if (otherIdx >= 0) {
              skills.equipped[otherIdx] = skills.equipped[slotIdx] || null;
            }
          }
          skills.equipped[slotIdx] = skillId;
          db.markProfile?.(p.id);
          onProfileChanged(p);
          return { ok: true, skills };
        }
        if (m.skillAction === 'passive_equip') {
          const skills = ensureFrontierSkills(p);
          const passiveId = m.passiveId ? String(m.passiveId) : null;
          if (passiveId !== null && (!MONSTER_PASSIVES[passiveId] || (Number(skills.passives[passiveId]) || 0) < 1)) {
            return { ok: false, error: 'passive_locked' };
          }
          skills.passive = passiveId;
          db.markProfile?.(p.id);
          onProfileChanged(p);
          return { ok: true, skills };
        }
        if (m.skillAction === 'preset_save' || m.skillAction === 'preset_load') {
          const skills = ensureFrontierSkills(p);
          const idx = Number(m.preset);
          if (!Number.isInteger(idx) || idx < 0 || idx >= PRESET_COUNT) return { ok: false, error: 'bad_preset' };
          if (m.skillAction === 'preset_save') {
            const name = String(m.name || ['Farm', 'Boss', 'Co-Op'][idx] || `Preset ${idx + 1}`).replace(/[<>"]/g, '').slice(0, 16);
            skills.presets[idx] = {
              name,
              equipped: [...skills.equipped],
              passive: skills.passive || null,
              glamourGloves: visibleSlotId(p.equipped, 'gloves', p.glamour) || null,
            };
            db.markProfile?.(p.id);
            onProfileChanged(p);
            return { ok: true, skills };
          }
          const pre = skills.presets[idx];
          if (!pre) return { ok: false, error: 'empty_preset' };
          // Loadout swaps are an out-of-combat decision (same 4s rule as the Outpost Sanctuary).
          const parsed = parseFrontierInstance(ws.instanceId);
          const shLive = parsed?.shardId ? shards.get(parsed.shardId) : null;
          const psLive = shLive?.live.players.get(p.id);
          const tNow = now();
          if (psLive && (tNow - (psLive.lastHitAt || 0) < PRESET_COMBAT_LOCK_MS || tNow - (psLive.lastAttackAt || 0) < PRESET_COMBAT_LOCK_MS)) {
            return { ok: false, error: 'in_combat', retryInMs: PRESET_COMBAT_LOCK_MS };
          }
          const open = skillSlotUnlocks(p);
          const seen = new Set();
          skills.equipped = Array.from({ length: SKILL_SLOT_COUNT }, (_, i) => {
            const id = pre.equipped?.[i] || null;
            if (!id || !open[i] || !MONSTER_SKILLS[id] || (skills.unlocked[id] | 0) < 1 || seen.has(id)) return null;
            seen.add(id);
            return id;
          });
          skills.passive = pre.passive && (Number(skills.passives[pre.passive]) || 0) >= 1 ? pre.passive : null;
          db.markProfile?.(p.id);
          onProfileChanged(p);
          const glamourGloves = pre.glamourGloves && p.inventory?.[pre.glamourGloves] ? pre.glamourGloves : null;
          return { ok: true, skills, glamourGloves };
        }
        if (m.skillAction === 'essence_craft') {
          const skills = ensureFrontierSkills(p);
          const id = String(m.skillId || m.passiveId || '');
          const chk = canEssenceCraft(p, id);
          if (!chk.ok) return { ok: false, ...chk };
          skills.essence = Math.max(0, (Number(skills.essence) || 0) - chk.cost);
          let newLevel = 0;
          if (chk.kind === 'skill') {
            grantMonsterSkillScroll(p, id, Boolean(MONSTER_SKILLS[id]?.isBossSkill), ws.instanceId, { skipNotify: true });
            newLevel = skills.unlocked[id] | 0;
          } else {
            grantMonsterPassive(p, id, ws.instanceId, { skipNotify: true });
            newLevel = Number(skills.passives[id]) || 0;
          }
          db.markProfile?.(p.id);
          onProfileChanged(p);
          return { ok: true, skills, kind: chk.kind, newLevel, cost: chk.cost };
        }
        const slot = m.slot;
        if (typeof slot !== 'number' || !Number.isInteger(slot) || slot < 0 || slot > 3) {
          return { ok: false, error: 'bad_slot', energy: regenEnergy(fr.energy, now()) };
        }
        const foodId = m.foodId;
        if (foodId !== null && foodId !== undefined && foodId !== '') {
          if (!FOOD[foodId]) {
            return { ok: false, error: 'not_food', energy: regenEnergy(fr.energy, now()) };
          }
          fr.foodPouch[slot] = foodId;
        } else {
          fr.foodPouch[slot] = null;
        }
        fr.energy = regenEnergy(fr.energy, now());
        db.markProfile?.(p.id);
        return { ok: true, slot, foodPouch: fr.foodPouch, energy: fr.energy };
      }
      case 'sf_crate_claim': {
        const fr = ensureFrontier(p);
        if (!fr) return { ok: false, error: 'no_state' };
        const res = claimCrate(fr, now());
        db.markProfile?.(p.id);
        return {
          ok: true,
          moved: res.moved,
          campCrate: fr.campCrate,
          warehouse: fr.warehouse,
          pantry: fr.pantry,
          energy: fr.energy,
        };
      }
      default: return { ok: false, error: 'bad_type' };
    }
  }

  function flushAll() { for (const sh of shards.values()) saveShard(sh); }

  return {
    pickShard, resolveEntry, canRejoin, layoutPayload, spawnFor, clampMove, onLeave,
    regionTransfer, handle, strike, flushAll, membersOf, loadShard, onPlayerMoved,
    stopAll, _tick: tick, _timers: timers,
    _shards: shards, _grantBossRewards: grantBossRewards, _spawnMonster: spawnMonster,
  };
}
