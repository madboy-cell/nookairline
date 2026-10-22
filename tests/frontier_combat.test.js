// tests/frontier_combat.test.js — Sky Frontier authoritative combat test suite.
import test from 'node:test';
import assert from 'node:assert/strict';

import { createSkyFrontierService, COMBAT } from '../server/sky_frontier_service.js';
import { defaultFrontier } from '../server/profile_factory.js';
import { applyOutpostDamage, OUTPOST, INVASION } from '../shared/combat_rules.js';

// =================================================================================================
// Test Environment Builder
// =================================================================================================
function createFakeEnv(initialNow = 1_000_000) {
  let currentTime = initialNow;
  const profiles = new Map();
  const marked = new Set();
  const instances = new Map();
  const presence = new Map();
  const broadcasts = [];
  const changedProfiles = [];
  const worldZones = new Map();

  const db = {
    getProfile: (id) => profiles.get(id) || null,
    markProfile: (id) => marked.add(id),
    getWorldZone: (id) => worldZones.get(id) || null,
    putWorldZone: (id, kind, state) => {
      worldZones.set(id, { zone_id: id, kind, state: JSON.parse(JSON.stringify(state)) });
    },
    listWorldZones: (kind) => [...worldZones.values()].filter((z) => !kind || z.kind === kind),
  };

  const service = createSkyFrontierService({
    db,
    instances,
    presence,
    send: () => {},
    broadcast: (instId, msg) => broadcasts.push({ instId, msg }),
    isCouple: (p) => Boolean(p?.partner_id && profiles.has(p.partner_id) && profiles.get(p.partner_id).partner_id === p.id),
    onProfileChanged: (p) => changedProfiles.push(p.id),
    now: () => currentTime,
    defaultFrontier,
    setIntervalFn: () => ({ unref() {} }),
    clearIntervalFn: () => {},
  });

  return {
    service,
    profiles,
    marked,
    instances,
    presence,
    broadcasts,
    changedProfiles,
    worldZones,
    setTime: (t) => { currentTime = t; },
    advanceTime: (dt) => { currentTime += dt; return currentTime; },
    getTime: () => currentTime,
  };
}

// =================================================================================================
// 1. Monster Damage, Kill, Attack Cooldown, and Warehouse Drops
// =================================================================================================
test('1. Monster combat: damaged and killed by repeated sf_attack, cooldown enforced, drops to warehouse', () => {
  const env = createFakeEnv(1_000_000);
  const p1 = {
    id: 'p1',
    level: 10,
    frontier: defaultFrontier(),
  };
  env.profiles.set('p1', p1);

  const instId = 'frontier:sf_1~meadow';
  env.instances.set(instId, new Set(['p1']));
  env.presence.set('p1', { instanceId: instId, x: 0, z: 0, t: env.getTime() });

  const sh = env.service.loadShard('sf_1');
  const ws = { instanceId: instId };

  // Step tick: ambient monsters spawn
  env.service._tick('sf_1', env.getTime());
  assert.ok(sh.live.monsters.size > 0, 'ambient monsters spawned via _tick');

  // Spawn a target monster right next to player (within pickaxe range)
  const targetMob = {
    id: 'mob_target_1',
    type: 'moss_slime',
    kind: 'ambient',
    regionId: 'meadow',
    x: 0.5,
    z: 0.5,
    hp: 30,
    maxHp: 30,
    dmg: 4,
    speed: 1.4,
    hits: {},
    homeX: 0.5,
    homeZ: 0.5,
  };
  sh.live.monsters.set(targetMob.id, targetMob);

  // First attack
  const atk1 = env.service.handle(ws, p1, { type: 'sf_attack', targetId: targetMob.id });
  assert.equal(atk1.ok, true);
  assert.ok(atk1.hits.length > 0);
  const [hitId, dmgDealt, , hpLeft] = atk1.hits[0];
  assert.equal(hitId, targetMob.id);
  assert.ok(dmgDealt > 0);
  assert.equal(targetMob.hp, hpLeft);
  assert.ok(targetMob.hp > 0, 'monster still alive after first hit');

  // Immediate second attack must be rejected due to cooldown
  const atkFast = env.service.handle(ws, p1, { type: 'sf_attack', targetId: targetMob.id });
  assert.equal(atkFast.ok, false);
  assert.equal(atkFast.error, 'cooldown');

  // Advance time past cooldown and attack until monster is killed
  while (sh.live.monsters.has(targetMob.id)) {
    env.advanceTime(atk1.cooldownMs || 700);
    const res = env.service.handle(ws, p1, { type: 'sf_attack', targetId: targetMob.id });
    assert.equal(res.ok, true);
  }

  // Monster is dead and removed
  assert.equal(sh.live.monsters.has(targetMob.id), false);

  // Warehouse items received the monster drop (moss_slime drops monster_gel)
  assert.ok(p1.frontier.warehouse.items.monster_gel >= 2, 'drops granted to warehouse');
  assert.equal(p1.frontier.stats.kills, 1, 'kill stat incremented');

  env.service.stopAll();
});

// =================================================================================================
// 2. Invasion Lifecycle: Warning → Active Waves → Kill Wave Monsters → Chest Rewards
// =================================================================================================
test('2. Invasion: warning -> active waves -> all wave monsters killed -> success with chest items', () => {
  const env = createFakeEnv(2_000_000);
  const p1 = {
    id: 'p1',
    level: 5,
    frontier: defaultFrontier(),
  };
  env.profiles.set('p1', p1);

  const instId = 'frontier:sf_1~meadow';
  env.instances.set(instId, new Set(['p1']));
  env.presence.set('p1', { instanceId: instId, x: 0, z: 4, t: env.getTime() });

  const sh = env.service.loadShard('sf_1');
  const ws = { instanceId: instId };

  // Set nextAt to just before now to trigger invasion
  sh.durable.invasion.nextAt = env.getTime() - 100;

  // Step tick: phase changes to warning
  env.service._tick('sf_1', env.getTime());
  assert.equal(sh.durable.invasion.phase, 'warning');
  assert.ok(sh.durable.invasion.at > env.getTime());

  // Advance time to warning expiry and step tick: phase changes to active, wave 1 spawns
  env.setTime(sh.durable.invasion.at);
  env.service._tick('sf_1', env.getTime());
  assert.equal(sh.durable.invasion.phase, 'active');
  assert.equal(sh.durable.invasion.wave, 1);
  assert.ok(sh.live.invWaveAlive > 0, 'wave 1 monsters spawned');

  // Player attacks one wave monster to register contribution in invLedger
  const firstWaveMon = [...sh.live.monsters.values()].find((m) => m.kind === 'wave');
  assert.ok(firstWaveMon);
  firstWaveMon.x = 0;
  firstWaveMon.z = 4.5; // place next to player
  const atk = env.service.handle(ws, p1, { type: 'sf_attack', targetId: firstWaveMon.id });
  assert.equal(atk.ok, true);
  assert.ok((sh.live.invLedger[p1.id]?.score || 0) > 0, 'player contributed to invasion');

  // Helper to clear current wave monsters by setting hp to 0 and stepping tick
  const clearCurrentWave = () => {
    for (const m of sh.live.monsters.values()) {
      if (m.kind === 'wave') m.hp = 0;
    }
    env.service._tick('sf_1', env.getTime());
    assert.equal(sh.live.invWaveAlive, 0, 'wave monsters eliminated');
  };

  // Clear wave 1
  clearCurrentWave();

  // Advance time to wave 2 and step tick
  env.setTime(sh.durable.invasion.nextWaveAt);
  env.service._tick('sf_1', env.getTime());
  assert.equal(sh.durable.invasion.wave, 2);
  assert.ok(sh.live.invWaveAlive > 0, 'wave 2 monsters spawned');
  clearCurrentWave();

  // Advance time to wave 3 and step tick
  env.setTime(sh.durable.invasion.nextWaveAt);
  env.service._tick('sf_1', env.getTime());
  assert.equal(sh.durable.invasion.wave, 3);
  assert.ok(sh.live.invWaveAlive > 0, 'wave 3 monsters spawned');
  clearCurrentWave();

  // With all 3 waves cleared, invasion succeeds
  assert.equal(sh.durable.invasion.phase, 'idle');
  assert.equal(sh.durable.invasion.last.result, 'success');

  // Chest items granted to p1 in warehouse
  assert.ok((p1.frontier.warehouse.items.monster_gel || 0) > 0, 'chest monster_gel granted');
  assert.ok((p1.frontier.warehouse.items.monster_fang || 0) > 0, 'chest monster_fang granted');
  assert.equal(p1.frontier.stats.invasions, 1, 'invasion stat recorded');

  env.service.stopAll();
});

// =================================================================================================
// 3. Outpost Damage to 0 (Offline) and sf_repair Consuming Only Needed Kits
// =================================================================================================
test('3. Outpost: damaged to 0 -> offline; sf_repair brings it online and consumes only needed kits', () => {
  const env = createFakeEnv(3_000_000);
  const p1 = {
    id: 'p1',
    frontier: defaultFrontier(),
  };
  env.profiles.set('p1', p1);

  const instId = 'frontier:sf_1~meadow';
  env.instances.set(instId, new Set(['p1']));
  // Meadow outpost POI is at (0, 4)
  env.presence.set('p1', { instanceId: instId, x: 0, z: 4, t: env.getTime() });

  const sh = env.service.loadShard('sf_1');
  const ws = { instanceId: instId };

  // Outpost starts at full HP and online
  const op = sh.durable.outposts.meadow;
  assert.equal(op.hp, OUTPOST.maxHp);
  assert.equal(op.offline, false);

  // Damage outpost to 0 HP
  applyOutpostDamage(op, OUTPOST.maxHp);
  assert.equal(op.hp, 0);
  assert.equal(op.offline, true);

  // Give player 8 repair kits in pantry (missing 1000 HP / 250 = 4 needed)
  p1.frontier.pantry.items.repair_kit = 8;

  // sf_repair requesting 10 kits (more than available and more than needed)
  const rep = env.service.handle(ws, p1, { type: 'sf_repair', kits: 10 });
  assert.equal(rep.ok, true);
  assert.equal(rep.used, 4, 'only 4 kits needed to heal 1000 hp');
  assert.equal(op.hp, 1000);
  assert.equal(op.offline, false, 'outpost back online');

  // Pantry only had the needed 4 kits consumed (8 - 4 = 4 remaining)
  assert.equal(p1.frontier.pantry.items.repair_kit, 4);
  assert.equal(p1.frontier.stats.repairs, 4);

  // Calling sf_repair when already full is rejected
  const repFull = env.service.handle(ws, p1, { type: 'sf_repair', kits: 2 });
  assert.equal(repFull.ok, false);
  assert.equal(repFull.error, 'full');
  assert.equal(p1.frontier.pantry.items.repair_kit, 4);

  env.service.stopAll();
});

// =================================================================================================
// 4. Player Knockout: Meal Buff Cleared, Warehouse Intact, Respawn at Outpost
// =================================================================================================
test('4. Player knockout: meal buff cleared, warehouse intact, respawns at outpost with presence updated', () => {
  const env = createFakeEnv(4_000_000);
  const p1 = {
    id: 'p1',
    level: 1,
    frontier: defaultFrontier(),
  };
  p1.frontier.mealBuff = {
    id: 'yield',
    food: 'fish_pie',
    until: env.getTime() + 3600_000,
  };
  p1.frontier.warehouse.items = {
    wood: 85,
    iron_ore: 14,
    monster_gel: 5,
  };
  env.profiles.set('p1', p1);

  const instId = 'frontier:sf_1~meadow';
  env.instances.set(instId, new Set(['p1']));
  // Player standing far from outpost (outpost is at 0, 4)
  env.presence.set('p1', { instanceId: instId, x: 25, z: 25, t: env.getTime() });

  const sh = env.service.loadShard('sf_1');
  const ps = env.service.loadShard('sf_1').live.players.get('p1') || {
    hp: 102,
    maxHp: 102,
    downUntil: 0,
  };
  sh.live.players.set('p1', ps);

  // Force player HP to 0 via internals
  ps.hp = 0;

  // Step tick: knockout triggers
  env.service._tick('sf_1', env.getTime());
  assert.ok(ps.downUntil > env.getTime(), 'player is knocked down');
  assert.equal(p1.frontier.mealBuff, null, 'meal buff cleared upon knockout');
  assert.deepEqual(p1.frontier.warehouse.items, { wood: 85, iron_ore: 14, monster_gel: 5 }, 'warehouse items intact');
  assert.equal(p1.frontier.stats.knockouts, 1);

  // Advance time past DOWN_MS (5000ms) and step tick: respawn occurs
  env.advanceTime(COMBAT.DOWN_MS + 200);
  env.service._tick('sf_1', env.getTime());

  assert.equal(ps.downUntil, 0, 'player no longer down');
  assert.equal(ps.hp, ps.maxHp, 'player HP restored to max');

  // Player respawned at outpost POI (0, 4+2) = (0, 6)
  const pres = env.presence.get('p1');
  assert.equal(pres.x, 0);
  assert.equal(pres.z, 6);

  // Warehouse items still intact
  assert.deepEqual(p1.frontier.warehouse.items, { wood: 85, iron_ore: 14, monster_gel: 5 });

  env.service.stopAll();
});

// =================================================================================================
// 5. Boss Fight: Distance Check, Boss Kill, boss_core_moss, Story Event, and Idempotency
// =================================================================================================
test('5. Boss: sf_boss_start distance check, kill grants boss_core_moss + story progress, idempotent claim', () => {
  const env = createFakeEnv(5_000_000);
  const p1 = {
    id: 'p1',
    level: 15,
    frontier: defaultFrontier(),
    story: {
      chapter: 4,
      progress: {},
      completed: [0, 1, 2, 3],
      claimed: [0, 1, 2, 3],
    },
  };
  env.profiles.set('p1', p1);

  const instId = 'frontier:sf_1~meadow';
  env.instances.set(instId, new Set(['p1']));

  // Meadow golem POI is at (-20, -18). Player starts at spawn (0, 28) -> distance > 50
  env.presence.set('p1', { instanceId: instId, x: 0, z: 28, t: env.getTime() });

  const ws = { instanceId: instId };

  // 1. sf_boss_start fails when far
  const farRes = env.service.handle(ws, p1, { type: 'sf_boss_start', bossId: 'elder_moss_golem' });
  assert.equal(farRes.ok, false);
  assert.equal(farRes.error, 'too_far');

  // 2. Move player near golem POI (-20, -18) and succeed
  env.presence.set('p1', { instanceId: instId, x: -20, z: -18, t: env.getTime() });
  const startRes = env.service.handle(ws, p1, { type: 'sf_boss_start', bossId: 'elder_moss_golem' });
  assert.equal(startRes.ok, true);
  assert.equal(startRes.boss.bossId, 'elder_moss_golem');

  const sh = env.service.loadShard('sf_1');
  const boss = sh.live.monsters.get(startRes.boss.id);
  assert.ok(boss);
  assert.equal(boss.type, 'elder_moss_golem');

  // Set boss HP low so pickaxe strike finishes it
  boss.hp = 1;

  // Attack boss
  const atk = env.service.handle(ws, p1, { type: 'sf_attack', targetId: boss.id });
  assert.equal(atk.ok, true);

  // Boss is defeated and removed
  assert.equal(sh.live.monsters.has(boss.id), false);
  assert.equal(sh.live.bosses.has('meadow'), false);

  // Qualifiers get boss_core_moss in warehouse
  const cores = p1.frontier.warehouse.items.boss_core_moss || 0;
  assert.ok(cores >= 2, `expected at least 2 boss_core_moss, got ${cores}`);

  // Story 'defeat' event recorded for Chapter 4 (step c4_defeat_elder_moss_golem)
  assert.equal(p1.story.progress.c4_defeat_elder_moss_golem, 1);
  assert.equal(p1.frontier.stats.bosses, 1);

  // Re-delivery is idempotent
  const encounterUid = boss.encounterUid;
  assert.ok(p1.frontier.claimedRewards[encounterUid], 'encounter recorded in claimedRewards');
  const duplicateLoot = env.service._grantBossRewards({
    bossId: 'elder_moss_golem',
    encounterUid,
    ledger: boss.ledger,
  });
  assert.deepEqual(duplicateLoot, {}, 'duplicate claim returns empty object');
  assert.equal(p1.frontier.warehouse.items.boss_core_moss, cores, 'item count unchanged on re-delivery');
  assert.equal(p1.story.progress.c4_defeat_elder_moss_golem, 1, 'story progress unchanged on re-delivery');

  env.service.stopAll();
});

// =================================================================================================
// 6. Hibernation: Player Leaves -> Shard Timer Cleared
// =================================================================================================
test('6. Hibernation: player leaves -> shard timer is cleared from _timers and state persisted', () => {
  const env = createFakeEnv(6_000_000);
  const p1 = {
    id: 'p1',
    frontier: defaultFrontier(),
  };
  env.profiles.set('p1', p1);

  const instId = 'frontier:sf_1~meadow';
  env.instances.set(instId, new Set(['p1']));
  env.presence.set('p1', { instanceId: instId, x: 0, z: 0, t: env.getTime() });

  // Entry and action wake up shard and start the combat tick timer
  env.service.resolveEntry(p1, instId);
  env.service.handle({ instanceId: instId }, p1, { type: 'sf_state' });

  assert.ok(env.service._timers.has('sf_1'), 'shard timer running while player present');
  assert.ok(env.service._shards.has('sf_1'), 'shard in live memory');

  // Player leaves: remove from instances map and call onLeave
  env.instances.get(instId).delete('p1');
  env.service.onLeave(instId);

  // Timer is cleared and shard hibernates
  assert.equal(env.service._timers.has('sf_1'), false, '_timers has no entry for hibernated shard');
  assert.equal(env.service._shards.has('sf_1'), false, 'shard dropped from live memory');

  // Shard durable state persisted to db worldZones
  const zone = env.worldZones.get('frontier_shard:sf_1');
  assert.ok(zone);
  assert.equal(zone.state.shardId, 'sf_1');

  env.service.stopAll();
});
