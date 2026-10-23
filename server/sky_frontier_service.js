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
  REGIONS, NODE_TYPES, MAX_PLAYERS_PER_SHARD, RESPAWN_MS, SWING_MS, PERFECT_WEIGHT,
  regionInstanceId, parseFrontierInstance, isFrontierInstance,
  canStrike, spendEnergy, regenEnergy, splitLoot, rollRares, rollHarvestRarity, isGateOpen, clampToRegion,
  claimDailyEnergy, diamondRefill, canGiftPartner, applyPartnerGift, activeMealBuff, eatFood,
  grantItems, claimCrate, applyYieldBonus,
} from '../shared/sky_frontier_rules.js';
import { isMaterial, FOOD } from '../shared/materials_catalog.js';
import { defaultStory, recordEvent, CHAPTERS } from '../shared/story_rules.js';
import {
  MONSTERS, BOSSES, WEAPONS, weaponDamage, attackCooldownMs, hitsInArc, toolTierMult,
  ULTIMATES, ultimateCooldownMs, INVASION, nextInvasionAt, waveComposition,
  OUTPOST, applyOutpostDamage, repairOutpost, addContribution, qualifiers, rollBossLoot,
} from '../shared/combat_rules.js';
import { computeUniversalStats, skyFrontierMods } from '../shared/universal_stats.js';
import { findBestCharmForId, grantCharmOfTier } from '../shared/charm_catalog.js';

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
  AMBIENT_MIN: 4, AMBIENT_MAX: 8, AMBIENT_RESPAWN_MS: 30e3, AMBIENT_KEEP_OUT: 8,
  MONSTER_CAP: 40,              // per region instance
  AGGRO_RANGE: 9, MELEE_RANGE: 1.2, RANGED_RANGE: 6, BOSS_RANGE: 2.5, MONSTER_ATK_CD_MS: 1200,
  OUTPOST_HIT_RANGE: 1.5, WAVE_PLAYER_AGGRO: 4,
  DOWN_MS: 5000, REGEN_DELAY_MS: 6000, REGEN_MS: 1000, REGEN_PCT: 0.03,
  DELTA_MS: 200,                // sf_monsters at most 5 Hz per region
  OUTPOST_BCAST_MS: 500,        // sf_outpost at most 2 Hz per region
  INVASION_TIMEOUT_MS: 4 * 60e3,
  CHEST: Object.freeze({ monster_gel: 6, monster_fang: 3 }), CHEST_CORE_CHANCE: 0.12,
  BOSS_POI: Object.freeze({ meadow: 'golem', hollow: 'boss' }),
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
  ],
  hollow: [
    ['quartz', 'crystal', 12, 6], ['outpost', 'crystal', 6, 10], ['mithril', 'crystal', 7, 6],
    ['quartz', 'quartz', 6, 5], ['mithril', 'mithril', 8, 5],
    ['outpost', 'boulder', 12, 11], ['boss', 'herb', 4, 7],
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
  /** shardId -> { id, durable, live: { hits: Map<nodeId, Map<userId, weight>>, lastStrike: Map, perfectLog: Map } } */
  const shards = new Map();
  let shardSeq = 0;

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
        hits: new Map(), lastStrike: new Map(), perfectLog: new Map(),
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
    }
    return p.frontier || null;
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

  /**
   * Resolve an `instance_switch` target. `to` = 'frontier' | 'frontier:<shardId>' | full region instance id.
   * Region instance ids are only honoured when `internal` (gate transfer) or when the player already
   * holds the unlock — so clients can't skip Sky Mist gates by asking for `~hollow` directly.
   */
  function resolveEntry(p, to, { internal = false } = {}) {
    const parsed = parseFrontierInstance(to);
    let regionId = parsed?.regionId && REGIONS[parsed.regionId] ? parsed.regionId : 'meadow';
    if (regionId !== 'meadow' && !internal) {
      const fr = ensureFrontier(p);
      if (!fr?.unlocks?.regions?.includes(regionId)) regionId = 'meadow';
    }
    const shardId = pickShard(p, parsed?.shardId || null);
    loadShard(shardId);
    const fr = ensureFrontier(p);
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
      // step 3m inward from the gate toward the region centre
      const len = Math.hypot(g.x, g.z) || 1;
      return clampToRegion(region.id, g.x - (g.x / len) * 3, g.z - (g.z / len) * 3);
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
    if (!s || Math.hypot(s.x - gate.at.x, s.z - gate.at.z) > (gate.radius || 3) + 1.5) return { ok: false, error: 'too_far' };
    onPlayerMoved(p, ws.instanceId, s.x, s.z);
    const fr = ensureFrontier(p);
    const partnerUnlocked = isCouple(p) && shardOfUser(p.partner_id) === parsed.shardId
      && !!db.getProfile(p.partner_id)?.frontier?.unlocks?.regions?.includes(gate.requires);
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
    if (perfect) fr.stats.perfects = (fr.stats.perfects || 0) + 1;

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
      broadcast(ws.instanceId, {
        type: 'sf_node_hit',
        nodeId: node.id,
        hp,
        maxHp: type.hp,
        by: p.id,
        perfect,
        perfectCount,
        rareBoostPct: previewRarity.rareBoostPct,
      });
      return {
        ok: true,
        perfect,
        perfectCount,
        rareBoostPct: previewRarity.rareBoostPct,
        nodeHp: hp,
        maxHp: type.hp,
        energy: fr.energy,
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
    for (const uid of qualifying) {
      const prof = db.getProfile(uid);
      if (!prof) continue;
      grant(prof, shares[uid]);
      grant(prof, rares[uid]);
      const pf = ensureFrontier(prof);
      if (pf) {
        pf.stats ||= {};
        pf.stats.nodes = (pf.stats.nodes || 0) + 1;
        if (harvestRarity.id === 'epic') pf.stats.epicNodes = (pf.stats.epicNodes || 0) + 1;
      }
      // Story chapters count gathered materials (Master Plan v2 §11.6)
      prof.story ||= defaultStory();
      for (const [matId, n] of Object.entries(shares[uid] || {})) if (n > 0) recordEvent(prof.story, { kind: 'gather', target: matId, amount: n });
      for (const [matId, n] of Object.entries(rares[uid] || {})) if (n > 0) recordEvent(prof.story, { kind: 'gather', target: matId, amount: n });
      onProfileChanged(prof);
    }
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
      rarity: rarityPayload,
    });
    return {
      ok: true,
      perfect,
      perfectCount,
      nodeHp: 0,
      broke: true,
      energy: fr.energy,
      share: shares[p.id] || {},
      rare: rares[p.id] || null,
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
  const dist = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);

  function liveRegion(sh, regionId) {
    let R = sh.live.regions.get(regionId);
    if (!R) {
      R = { count: 0, ambientAlive: 0, ambientDue: [], dirty: new Set(), lastDeltaAt: 0, outpostDirty: false, lastOutpostAt: 0 };
      sh.live.regions.set(regionId, R);
    }
    return R;
  }

  function userRegion(sh, uid) {
    const s = presence.get(uid);
    const parsed = s && parseFrontierInstance(s.instanceId);
    return parsed?.shardId === sh.id && REGIONS[parsed.regionId] ? parsed.regionId : null;
  }

  function playerState(sh, uid, prof = null) {
    let ps = sh.live.players.get(uid);
    if (!ps) {
      const pr = prof || db.getProfile?.(uid);
      const lv = Number(pr?.level);
      const maxHp = 100 + 2 * (Number.isFinite(lv) && lv > 0 ? Math.floor(lv) : 0);
      ps = { hp: maxHp, maxHp, downUntil: 0, lastAttackAt: 0, ultReadyAt: 0, buffs: {}, shield: 0, shieldUntil: 0, lastHitAt: 0, lastRegenAt: 0 };
      sh.live.players.set(uid, ps);
    }
    return ps;
  }

  function statsOf(prof) {
    try { return computeUniversalStats(prof)?.total || {}; } catch { return {}; }
  }

  const outpostOf = (sh, regionId) => (sh.durable.outposts[regionId] ||= { hp: OUTPOST.maxHp, maxHp: OUTPOST.maxHp, offline: false });
  const outpostWire = (sh, regionId) => {
    const op = outpostOf(sh, regionId);
    const poi = REGIONS[regionId]?.pois?.outpost || { x: 0, z: 0 };
    return { regionId, hp: op.hp, maxHp: op.maxHp || OUTPOST.maxHp, offline: !!op.offline, x: poi.x, z: poi.z };
  };
  const compactMonster = (m) => [m.id, m.type, r1(m.x), r1(m.z), Math.max(0, Math.round(m.hp)), m.maxHp];
  const buffActive = (ps, key, t) => {
    const b = ps?.buffs?.[key];
    if (!b) return null;
    if (b.until && t >= b.until) { delete ps.buffs[key]; return null; }
    return b;
  };

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
    return { id: b.id, bossId: b.type, name: BOSSES[b.type]?.name, hp: Math.max(0, Math.round(b.hp)), maxHp: b.maxHp, x: r1(b.x), z: r1(b.z), stage: b.stage, encounterUid: b.encounterUid, startedAt: b.startedAt, expiresAt: b.startedAt + COMBAT.BOSS_TIMEOUT_MS };
  }

  function combatSnapshot(sh, regionId) {
    if (membersOf(sh.id).size > 0) ensureActive(sh);
    const monsters = [];
    for (const m of sh.live.monsters.values()) if (m.regionId === regionId) monsters.push(compactMonster(m));
    return {
      monsters,
      outpost: outpostWire(sh, regionId),
      invasion: invasionWire(sh),
      boss: bossWire(sh, regionId),
      bossCooldownUntil: sh.durable.bossCd?.[regionId] || 0,
      combatTickMs: COMBAT.TICK_MS,
    };
  }

  // ---- monsters ---------------------------------------------------------------------------------
  function spawnMonster(sh, regionId, type, kind, x, z, { hpMult = 1, boss = null } = {}) {
    const R = liveRegion(sh, regionId);
    if (R.count >= COMBAT.MONSTER_CAP) return null;
    const def = boss || MONSTERS[type];
    if (!def) return null;
    const maxHp = Math.max(1, Math.round(def.hp * hpMult));
    const id = `mob_${++sh.live.monsterSeq}`;
    const m = {
      id, type, kind, regionId, x, z, hp: maxHp, maxHp,
      dmg: def.dmg, speed: def.speed ?? (boss ? 1.1 : 1.5), ranged: !!def.ranged,
      targetId: null, atkCdUntil: 0, stunUntil: 0, slowUntil: 0, frozenUntil: 0,
      homeX: x, homeZ: z, hits: {}, dmgMult: 1,
    };
    sh.live.monsters.set(id, m);
    R.count += 1;
    if (kind === 'ambient') R.ambientAlive += 1;
    if (kind === 'wave') sh.live.invWaveAlive += 1;
    R.dirty.add(id);
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
    const dealt = Math.min(m.hp, dmg);
    m.hp -= dmg;
    if (uid) {
      m.hits[uid] = (m.hits[uid] || 0) + dealt;
      credit(sh, m.regionId, uid, { dmg: dealt }, m);
    }
    liveRegion(sh, m.regionId).dirty.add(m.id);
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

  function lootMult(sh, uid, t) {
    const ps = sh.live.players.get(uid);
    let mult = 1;
    const lb = buffActive(ps, 'loot_boost', t);
    if (lb) mult *= 1 + (lb.pct || 0);
    if (buffActive(ps, 'loot_shower', t)) mult *= 2;
    return mult;
  }

  function killMonster(sh, m, killerId, t) {
    if (!removeMonster(sh, m)) return;
    const inst = regionInstanceId(sh.id, m.regionId);
    if (m.kind === 'ambient') liveRegion(sh, m.regionId).ambientDue.push(t + COMBAT.AMBIENT_RESPAWN_MS);
    if (m.kind === 'boss') {
      broadcast(inst, { type: 'sf_monster_dead', id: m.id, regionId: m.regionId, monsterType: m.type, by: killerId || null, drops: {} });
      bossDefeated(sh, m, t);
      return;
    }
    const drop = MONSTERS[m.type]?.drop || {};
    const hitters = Object.keys(m.hits);
    let shares = {};
    if (hitters.length === 1) shares = { [hitters[0]]: { ...drop } };
    else if (hitters.length > 1) shares = splitLoot({ hits: m.hits, baseDrop: drop, fortuneMult: 1 }).shares;
    const coupleResonanceUsers = [];
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
            const dist = Math.hypot((partPres.x || 0) - m.x, (partPres.z || 0) - m.z);
            if (dist <= 12.0) hasCoupleResonance = true;
          }
        }
      }
      const mult = lootMult(sh, uid, t) * (hasCoupleResonance ? 1.25 : 1.0);
      if (hasCoupleResonance) coupleResonanceUsers.push(uid);
      if (mult !== 1) for (const k of Object.keys(items)) items[k] = Math.max(items[k] + (hasCoupleResonance ? 1 : 0), Math.round(items[k] * mult));
      grant(prof, items);
      const pf = ensureFrontier(prof);
      if (pf) { pf.stats ||= {}; pf.stats.kills = (pf.stats.kills || 0) + 1; }
      prof.story ||= defaultStory();
      recordEvent(prof.story, { kind: 'defeat', target: m.type });
      onProfileChanged(prof);
    }
    broadcast(inst, { type: 'sf_monster_dead', id: m.id, regionId: m.regionId, monsterType: m.type, by: killerId || null, drops: shares, coupleResonanceUsers });
  }

  // ---- players ----------------------------------------------------------------------------------
  function emitHp(sh, regionId, uid, ps, t) {
    broadcast(regionInstanceId(sh.id, regionId), {
      type: 'sf_player_hp', id: uid, hp: Math.max(0, Math.round(ps.hp)), maxHp: ps.maxHp,
      shield: Math.round(ps.shield || 0), downUntil: ps.downUntil > t ? ps.downUntil : 0,
    });
  }

  function damagePlayer(sh, regionId, uid, amount, t) {
    const ps = playerState(sh, uid);
    if (ps.downUntil > t) return 0;
    let dmg = Math.max(0, Math.round(amount));
    if (ps.shield > 0 && ps.shieldUntil > t) {
      const absorbed = Math.min(ps.shield, dmg);
      ps.shield -= absorbed;
      dmg -= absorbed;
    }
    ps.hp -= dmg;
    ps.lastHitAt = t;
    if (ps.hp <= 0) knockOut(sh, regionId, uid, ps, t);
    emitHp(sh, regionId, uid, ps, t);
    return dmg;
  }

  /** Knockout (§8.6): no item loss, lose the meal buff, respawn at the nearest online outpost after DOWN_MS. */
  function knockOut(sh, regionId, uid, ps, t) {
    ps.hp = 0;
    ps.downUntil = t + COMBAT.DOWN_MS;
    ps.shield = 0;
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
      if (!members.size) continue; // skip AI for regions without players
      const R = liveRegion(sh, regionId);
      tickPlayers(sh, regionId, members, t);
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
    }
  }

  function tickPlayers(sh, regionId, members, t) {
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
      if (ps.shieldUntil && t >= ps.shieldUntil) { ps.shield = 0; ps.shieldUntil = 0; }
      if (ps.hp < ps.maxHp && t - ps.lastHitAt >= COMBAT.REGEN_DELAY_MS && t - ps.lastRegenAt >= COMBAT.REGEN_MS) {
        ps.lastRegenAt = t;
        ps.hp = Math.min(ps.maxHp, ps.hp + Math.ceil(ps.maxHp * COMBAT.REGEN_PCT));
        emitHp(sh, regionId, uid, ps, t);
      }
    }
  }

  function tickAmbient(sh, regionId, members, R, t) {
    const due = R.ambientDue;
    for (let i = due.length - 1; i >= 0; i--) if (due[i] <= t) due.splice(i, 1);
    const target = Math.min(COMBAT.AMBIENT_MAX, COMBAT.AMBIENT_MIN - 1 + members.size);
    const types = AMBIENT_TYPES[regionId];
    if (!types?.length) return;
    while (R.ambientAlive + due.length < target && R.count < COMBAT.MONSTER_CAP) {
      const pos = randomAmbientPos(regionId);
      if (!spawnMonster(sh, regionId, types[Math.floor(rng() * types.length)], 'ambient', pos.x, pos.z)) break;
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
      if (m.stunUntil > t || m.frozenUntil > t) continue;
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
      } else if (best && bestD <= aggro) { tx = bx; tz = bz; targetId = best; }
      m.targetId = targetId;
      const range = targetId === 'outpost' ? COMBAT.OUTPOST_HIT_RANGE
        : m.kind === 'boss' ? COMBAT.BOSS_RANGE : m.ranged ? COMBAT.RANGED_RANGE : COMBAT.MELEE_RANGE;
      const d = dist(m.x, m.z, tx, tz);
      const stopAt = targetId ? range * 0.85 : 0.5;
      if (d > stopAt) {
        const speed = (m.speed || 1.5) * (m.slowUntil > t ? (m.slowPct ? 1 - m.slowPct : 0.5) : 1);
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
      const dmg = Math.round(m.dmg * (m.dmgMult || 1));
      if (targetId === 'outpost') damageOutpost(sh, regionId, dmg, t);
      else damagePlayer(sh, regionId, targetId, dmg, t);
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
        for (const m of [...sh.live.monsters.values()]) {
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

  /** Individual loot per qualifier (≥5% contribution) with pity + idempotent claim per encounter. */
  function grantBossRewards({ bossId, encounterUid, ledger }) {
    const t = now();
    const q = qualifiers(ledger, COMBAT.BOSS_MIN_SHARE);
    const luckByUser = {}, pityByUser = {}, profs = {};
    for (const uid of q) {
      const prof = db.getProfile?.(uid);
      const fr = prof && ensureFrontier(prof);
      if (!fr) continue;
      fr.claimedRewards ||= {};
      if (fr.claimedRewards[encounterUid]) continue;
      profs[uid] = prof;
      luckByUser[uid] = Number(statsOf(prof).luck) || 0;
      pityByUser[uid] = Number(fr.bossPity?.[bossId]) || 0;
    }
    const eligible = Object.keys(profs);
    const loot = eligible.length ? rollBossLoot({ bossId, qualifying: eligible, rng, luckByUser, pityByUser }) : {};
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
      fr.bossPity ||= {};
      fr.bossPity[bossId] = res.pityReset ? 0 : (Number(fr.bossPity[bossId]) || 0) + 1;
      let charm = null;
      if (res.charmTier != null) {
        const c = grantCharmOfTier(prof, res.charmTier, rng, luckByUser[uid]);
        if (c) charm = { uid: c.uid, id: c.id, name: c.name, tier: c.tier, grade: c.grade };
      }
      prof.story ||= defaultStory();
      recordEvent(prof.story, { kind: 'defeat', target: bossId });
      fr.stats ||= {};
      fr.stats.bosses = (fr.stats.bosses || 0) + 1;
      db.markProfile?.(uid);
      onProfileChanged(prof);
      out[uid] = { items, charm, pity: fr.bossPity[bossId] };
    }
    return out;
  }

  function bossDefeated(sh, b, t) {
    sh.live.bosses.delete(b.regionId);
    sh.durable.bossCd[b.regionId] = t + COMBAT.BOSS_COOLDOWN_MS;
    const loot = grantBossRewards({ bossId: b.type, encounterUid: b.encounterUid, ledger: b.ledger });
    saveShard(sh);
    broadcast(regionInstanceId(sh.id, b.regionId), {
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

  const normFacing = (f, fallback) => {
    const x = Number(f?.x), z = Number(f?.z);
    if (Number.isFinite(x) && Number.isFinite(z) && Math.hypot(x, z) > 1e-6) return { x, z };
    return fallback || { x: 0, z: -1 };
  };

  function attack(ws, p, m) {
    const c = combatContext(ws, p);
    if (c.error) return { ok: false, error: c.error };
    const { sh, regionId, s, fr, ps, t } = c;
    if (ps.downUntil > t) return { ok: false, error: 'down', downUntil: ps.downUntil };
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
    ps.lastAttackAt = t;

    const target = sh.live.monsters.get(String(m.targetId || ''));
    const validTarget = target && target.regionId === regionId ? target : null;
    const toTarget = validTarget ? { x: validTarget.x - s.x, z: validTarget.z - s.z } : null;
    const facing = normFacing(m.facing, toTarget);
    const range = w.range;
    const hitIds = new Set();
    if (validTarget && dist(s.x, s.z, validTarget.x, validTarget.z) <= range + COMBAT.ATTACK_RANGE_SLACK) hitIds.add(validTarget.id);
    if (w.style !== 'ranged' || !hitIds.size) {
      const cands = [];
      for (const mon of sh.live.monsters.values()) if (mon.regionId === regionId) cands.push(mon);
      const arc = hitsInArc({ origin: s, facing, range, arcDeg: w.arc, targets: cands });
      if (w.style === 'ranged') { if (arc.length) hitIds.add(arc[0]); } // staff: single bolt
      else for (const id of arc) hitIds.add(id);
    }
    let mult = 1;
    if (buffActive(ps, 'clone', t)) mult *= 2;
    const dmgUp = buffActive(ps, 'dmg_up', t);
    if (dmgUp) mult *= 1 + (dmgUp.pct || 0);
    const hits = [];
    for (const id of hitIds) {
      const mon = sh.live.monsters.get(id);
      if (!mon) continue;
      const crit = rng() < COMBAT.CRIT_CHANCE;
      const dmg = Math.round(weaponDamage({ tool, tier, stats, crit }) * mult);
      if (w.knockback && mon.kind !== 'boss' && mon.hp > dmg) {
        const d = dist(s.x, s.z, mon.x, mon.z) || 1;
        const p2 = clampToRegion(regionId, mon.x + ((mon.x - s.x) / d) * w.knockback, mon.z + ((mon.z - s.z) / d) * w.knockback, 1);
        mon.x = p2.x; mon.z = p2.z;
        mon.stunUntil = Math.max(mon.stunUntil, t + 300); // stagger
      }
      const dealt = damageMonster(sh, mon, p.id, dmg, t);
      hits.push([id, dealt, crit, Math.max(0, Math.round(mon.hp))]);
    }
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
    broadcast(ws.instanceId, { type: 'sf_hit', by: p.id, tool, facing, hits, heals });
    return { ok: true, tool, hits, heals, cooldownMs: cd };
  }

  function resolveUltimateCharm(p, fr) {
    const ref = fr.ultimateCharmUid || p.equipped?.charm?.uid || p.equipped?.charm?.id || null;
    if (!ref) return null;
    const owned = findBestCharmForId(p.charms, ref);
    const id = owned?.id || (ULTIMATES[ref] ? ref : (p.equipped?.charm?.id || null));
    return ULTIMATES[id] ? id : null;
  }

  function ultimate(ws, p, m) {
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
          mon.x = s.x + ((mon.x - s.x) / d) * keep; mon.z = s.z + ((mon.z - s.z) / d) * keep;
          liveRegion(sh, regionId).dirty.add(mon.id);
          hits.push([mon.id, 0]);
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
          aps.shield = Math.round(aps.maxHp * (eff.pct || 0.25)); aps.shieldUntil = until;
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
    for (const step of ch.steps) {
      if (step.kind !== 'visit' || (p.story.progress?.[step.id] || 0) >= step.count) continue;
      const poi = region.pois[step.target];
      if (poi && Math.hypot(poi.x - x, poi.z - z) <= 5.5) {
        if (recordEvent(p.story, { kind: 'visit', target: step.target }).length) changed = true;
        if (step.target === 'gate_hollow') {
          const fr = ensureFrontier(p);
          if (fr) {
            fr.unlocks ||= { regions: ['meadow'], gates: [] };
            fr.unlocks.gates ||= [];
            if (!fr.unlocks.gates.includes('hollow')) { fr.unlocks.gates.push('hollow'); changed = true; }
            fr.unlocks.regions ||= ['meadow'];
            if (!fr.unlocks.regions.includes('hollow')) { fr.unlocks.regions.push('hollow'); changed = true; }
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
      case 'sf_attack': return attack(ws, p, m);
      case 'sf_ultimate': return ultimate(ws, p, m);
      case 'sf_repair': return repair(ws, p, m);
      case 'sf_boss_start': return bossStart(ws, p, m);
      case 'sf_state': {
        const fr = ensureFrontier(p);
        if (fr) {
          fr.energy = regenEnergy(fr.energy, now());
          activeMealBuff(fr, now());
        }
        return {
          ok: true,
          layout: isFrontierInstance(ws.instanceId) ? layoutPayload(ws.instanceId) : null,
          frontier: fr,
          energy: fr?.energy,
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
        const res = eatFood(fr, m.foodId, now());
        if (!res.ok) return { ok: false, error: res.error, energy: fr.energy };
        db.markProfile?.(p.id);
        return { ok: true, foodId: m.foodId, energy: fr.energy, buff: res.buff };
      }
      case 'sf_pouch_set': {
        const fr = ensureFrontier(p);
        if (!fr) return { ok: false, error: 'no_state' };
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
    _shards: shards, _grantBossRewards: grantBossRewards,
  };
}
