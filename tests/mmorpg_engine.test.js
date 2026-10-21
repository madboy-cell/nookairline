import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ZONE_KINDS,
  createZoneDescriptor,
  isZoneWalkable,
  clampZoneWalkable,
  shouldAcceptZonePacket,
  computeReconcileStep,
  SpatialHashGrid,
  COMBAT_ANIMS,
  SKILL_ARCHETYPES,
  resolveSkillTargets,
  STATUS_EFFECTS,
  applyStatusEffect,
  stepEntityStatuses,
  MONSTER_ARCHETYPES,
  createMonsterEntity,
  stepMonsterAI,
} from '../shared/mmorpg_engine.js';
import { Database } from '../server/db.js';

// ---------------------------------------------------------------------------------------------
// 1. Zone Descriptor & Walkability
// ---------------------------------------------------------------------------------------------
test('Zone Descriptor & Walkability: survival_wilds bounds, colliders, flyable, and clampZoneWalkable', () => {
  const colliders = [
    { shape: 'circle', x: 10, z: 10, r: 3.0, flyable: true },
    { shape: 'circle', x: -15, z: -15, r: 2.5, flyable: false },
    { shape: 'box', x0: 20, z0: -5, x1: 26, z1: 5, flyable: true },
  ];

  const zone = createZoneDescriptor(ZONE_KINDS.SURVIVAL_WILDS, { colliders });
  assert.equal(zone.kind, 'survival_wilds');
  assert.equal(zone.halfSize, 80);
  assert.equal(zone.allowSkills, true);
  assert.equal(zone.allowMounts, true);

  // Walking within bounds in open space
  assert.equal(isZoneWalkable(zone, 0, 0), true);
  assert.equal(isZoneWalkable(zone, 79.5, -79.5), true);

  // Blocked outside bounds (accounting for default radius = 0.2 -> limit = 79.8)
  assert.equal(isZoneWalkable(zone, 80.5, 0), false);
  assert.equal(isZoneWalkable(zone, 0, -80.0), false);
  assert.equal(isZoneWalkable(zone, NaN, 0), false);

  // Blocked inside circular collider unless canFly is true on flyable obstacle
  assert.equal(isZoneWalkable(zone, 10, 10, { canFly: false }), false);
  assert.equal(isZoneWalkable(zone, 10, 10, { canFly: true }), true);

  // Non-flyable obstacle blocks even when canFly is true
  assert.equal(isZoneWalkable(zone, -15, -15, { canFly: false }), false);
  assert.equal(isZoneWalkable(zone, -15, -15, { canFly: true }), false);

  // Blocked inside box collider unless canFly is true
  assert.equal(isZoneWalkable(zone, 23, 0, { canFly: false }), false);
  assert.equal(isZoneWalkable(zone, 23, 0, { canFly: true }), true);

  // clampZoneWalkable pushes out-of-bounds coordinates back inside limit
  const clampedBounds = clampZoneWalkable(zone, 120, -95, { radius: 0.2 });
  assert.ok(Math.abs(clampedBounds.x) <= 79.8);
  assert.ok(Math.abs(clampedBounds.z) <= 79.8);
  assert.equal(isZoneWalkable(zone, clampedBounds.x, clampedBounds.z, { radius: 0.2 }), true);

  // clampZoneWalkable pushes coordinates inside circular collider out to nearest safe perimeter
  const clampedCircle = clampZoneWalkable(zone, 11, 10, { radius: 0.2, canFly: false });
  const distFromCircleCenter = Math.hypot(clampedCircle.x - 10, clampedCircle.z - 10);
  assert.ok(distFromCircleCenter >= 3.0 + 0.2);
  assert.equal(isZoneWalkable(zone, clampedCircle.x, clampedCircle.z, { radius: 0.2 }), true);

  // clampZoneWalkable handles exact center of circular collider
  const clampedCircleCenter = clampZoneWalkable(zone, 10, 10, { radius: 0.2, canFly: false });
  assert.equal(isZoneWalkable(zone, clampedCircleCenter.x, clampedCircleCenter.z, { radius: 0.2 }), true);

  // clampZoneWalkable pushes coordinates inside box collider out to nearest safe perimeter
  const clampedBox = clampZoneWalkable(zone, 21, 0, { radius: 0.2, canFly: false });
  assert.ok(clampedBox.x <= 20 - 0.2);
  assert.equal(isZoneWalkable(zone, clampedBox.x, clampedBox.z, { radius: 0.2 }), true);
});

// ---------------------------------------------------------------------------------------------
// 2. Zone Epoch & Smooth Reconciliation
// ---------------------------------------------------------------------------------------------
test('Zone Epoch & Smooth Reconciliation: shouldAcceptZonePacket and computeReconcileStep', () => {
  // Packet zone sequence checks
  assert.equal(shouldAcceptZonePacket(3, 3), true);
  assert.equal(shouldAcceptZonePacket(2, 3), false);
  assert.equal(shouldAcceptZonePacket(null, 3), true);
  assert.equal(shouldAcceptZonePacket(3, null), true);

  // Drift <= 0.08m -> mode === 'ignore'
  const stepIgnore = computeReconcileStep(10.0, 20.0, 10.05, 20.0, 0.05);
  assert.equal(stepIgnore.mode, 'ignore');
  assert.equal(stepIgnore.x, 10.0);
  assert.equal(stepIgnore.z, 20.0);
  assert.ok(stepIgnore.err <= 0.08);

  // Drift 0.5m -> mode === 'smooth' (blends smoothly toward server pos)
  const stepSmooth = computeReconcileStep(10.0, 20.0, 10.5, 20.0, 0.05);
  assert.equal(stepSmooth.mode, 'smooth');
  assert.ok(Math.abs(stepSmooth.err - 0.5) < 1e-6);
  assert.ok(stepSmooth.x > 10.0 && stepSmooth.x < 10.5);
  assert.equal(stepSmooth.z, 20.0);

  // Drift >= 1.8m -> mode === 'snap' (snaps directly to server pos)
  const stepSnap = computeReconcileStep(10.0, 20.0, 12.0, 20.0, 0.05);
  assert.equal(stepSnap.mode, 'snap');
  assert.equal(stepSnap.x, 12.0);
  assert.equal(stepSnap.z, 20.0);
  assert.ok(stepSnap.err >= 1.8);
});

// ---------------------------------------------------------------------------------------------
// 3. O(1) Spatial Hash Grid
// ---------------------------------------------------------------------------------------------
test('SpatialHashGrid: 50 entities across 160x160m map, queryRadius, queryNearest, and filterFn', () => {
  const grid = new SpatialHashGrid(4.0);
  const entities = [];

  // Deterministically distribute 50 entities across [-80, 80] x [-80, 80]
  for (let i = 0; i < 50; i++) {
    const row = Math.floor(i / 10); // 0..4
    const col = i % 10; // 0..9
    const x = -72 + col * 15.5 + row * 0.7;
    const z = -64 + row * 31.0 + col * 0.3;
    entities.push({
      id: `ent_${i}`,
      x,
      z,
      faction: i % 2 === 0 ? 'hostile' : 'friendly',
    });
  }

  grid.insertAll(entities);

  const qx = 5.3;
  const qz = -2.7;
  const radius = 35;

  // Brute-force reference
  const expectedAll = entities
    .filter((e) => Math.hypot(e.x - qx, e.z - qz) <= radius)
    .sort((a, b) => Math.hypot(a.x - qx, a.z - qz) - Math.hypot(b.x - qx, b.z - qz));

  const actualAll = grid.queryRadius(qx, qz, radius);
  assert.ok(actualAll.length > 0);
  assert.deepEqual(
    actualAll.map((e) => e.id),
    expectedAll.map((e) => e.id),
  );

  // Verify distance sorting is non-decreasing
  for (let i = 1; i < actualAll.length; i++) {
    const prevD = Math.hypot(actualAll[i - 1].x - qx, actualAll[i - 1].z - qz);
    const currD = Math.hypot(actualAll[i].x - qx, actualAll[i].z - qz);
    assert.ok(currD >= prevD - 1e-9);
  }

  // Verify filterFn
  const filterHostile = (e) => e.faction === 'hostile';
  const expectedHostile = expectedAll.filter(filterHostile);
  const actualHostile = grid.queryRadius(qx, qz, radius, filterHostile);
  assert.deepEqual(
    actualHostile.map((e) => e.id),
    expectedHostile.map((e) => e.id),
  );

  // Verify queryNearest
  const nearestAll = grid.queryNearest(qx, qz, radius);
  assert.equal(nearestAll?.id, expectedAll[0].id);

  const nearestHostile = grid.queryNearest(qx, qz, radius, filterHostile);
  assert.equal(nearestHostile?.id, expectedHostile[0].id);

  const nearestNone = grid.queryNearest(qx, qz, 0.1);
  assert.equal(nearestNone, null);
});

// ---------------------------------------------------------------------------------------------
// 4. Skills & Status Effects
// ---------------------------------------------------------------------------------------------
test('Skills: resolveSkillTargets accurately filters circle, cone, line, and chain', () => {
  assert.equal(COMBAT_ANIMS.includes('slash'), true);
  assert.equal(COMBAT_ANIMS.includes('non_existent_anim'), false);

  const caster = { id: 'caster', x: 0, z: 0, hp: 100 };
  const targets = [
    { id: 'front_close', x: 1.8, z: 0.0, hp: 100 }, // Nearest in front (angle 0), dist 1.8
    { id: 'front_slight_off', x: 2.0, z: 0.8, hp: 100 }, // In cone & circle & line
    { id: 'front_far_line', x: 4.8, z: 0.3, hp: 100 }, // Along line (range 5.5, radius 1.1)
    { id: 'behind_close', x: -2.5, z: 0.0, hp: 100 }, // Behind caster, dist 2.5 (in circle, not in cone/line)
    { id: 'chain_bounce_3', x: 7.2, z: 0.2, hp: 100 }, // Out of initial range (6.0), reachable via bounce from front_far_line
    { id: 'dead_target', x: 1.5, z: 0.0, hp: 0 }, // Dead, should be ignored
    { id: 'far_away', x: 25.0, z: 25.0, hp: 100 }, // Out of range of everything
  ];

  const grid = new SpatialHashGrid(4.0);
  grid.insert(caster);
  grid.insertAll(targets);

  // 1. Circle (whirlwind_spin: radius 3.0 around caster)
  const circleHits = resolveSkillTargets(caster, SKILL_ARCHETYPES.whirlwind_spin, 0, grid);
  const circleIds = circleHits.map((e) => e.id);
  assert.equal(circleIds.includes('front_close'), true);
  assert.equal(circleIds.includes('front_slight_off'), true);
  assert.equal(circleIds.includes('behind_close'), true);
  assert.equal(circleIds.includes('front_far_line'), false);
  assert.equal(circleIds.includes('dead_target'), false);
  assert.equal(circleIds.includes('caster'), false);

  // 2. Cone (melee_cleave: range 2.8, angleDeg 110, aiming +X / angle 0)
  const coneHits = resolveSkillTargets(caster, SKILL_ARCHETYPES.melee_cleave, 0, grid);
  const coneIds = coneHits.map((e) => e.id);
  assert.equal(coneIds.includes('front_close'), true);
  assert.equal(coneIds.includes('front_slight_off'), true);
  assert.equal(coneIds.includes('behind_close'), false);
  assert.equal(coneIds.includes('front_far_line'), false);

  // 3. Line (starlight_dash: range 5.5, radius 1.1, aiming +X / angle 0)
  const lineHits = resolveSkillTargets(caster, SKILL_ARCHETYPES.starlight_dash, 0, grid);
  const lineIds = lineHits.map((e) => e.id);
  assert.equal(lineIds.includes('front_close'), true);
  assert.equal(lineIds.includes('front_slight_off'), true); // perp = 0.8 <= 1.1
  assert.equal(lineIds.includes('front_far_line'), true); // proj = 4.8 <= 5.5, perp = 0.3 <= 1.1
  assert.equal(lineIds.includes('behind_close'), false);
  assert.equal(lineIds.includes('chain_bounce_3'), false);

  // 4. Chain (chain_lightning: range 6.0, bounce radius 3.5, maxTargets 4)
  const chainHits = resolveSkillTargets(caster, SKILL_ARCHETYPES.chain_lightning, 0, grid);
  const chainIds = chainHits.map((e) => e.id);
  assert.equal(chainIds.length, 4);
  // First hit is nearest within 6.0m (dist 2.0), and chain bounces reach chain_bounce_3 at x=7.2
  assert.equal(chainIds.includes('chain_bounce_3'), true);
  assert.equal(new Set(chainIds).size, chainIds.length); // No duplicate targets in chain
});

test('Status Effects: burn/poison DoT, chill slow, curse damage amp, and shield absorption', () => {
  assert.ok(STATUS_EFFECTS.burn);
  assert.ok(STATUS_EFFECTS.poison);
  assert.ok(STATUS_EFFECTS.chill);
  assert.ok(STATUS_EFFECTS.curse);
  assert.ok(STATUS_EFFECTS.shield);

  const entity = { id: 'hero', hp: 100, statuses: {} };
  const t0 = 1000;

  // Apply shield (30 absorb), burn (power 10/s for 4s), poison (power 5/s, 2 stacks = 10/s for 5s), chill, and curse
  applyStatusEffect(entity, 'shield', { power: 30, durationMs: 6000, nowMs: t0 });
  applyStatusEffect(entity, 'burn', { power: 10, durationMs: 4000, nowMs: t0 });
  applyStatusEffect(entity, 'poison', { power: 5, stacks: 1, durationMs: 5000, nowMs: t0 });
  applyStatusEffect(entity, 'poison', { power: 5, stacks: 1, durationMs: 5000, nowMs: t0 }); // Stacks to 2
  applyStatusEffect(entity, 'chill', { durationMs: 3000, nowMs: t0 });
  applyStatusEffect(entity, 'curse', { durationMs: 5000, nowMs: t0 });

  assert.equal(entity.shieldHp, 30);
  assert.equal(entity.statuses.poison.stacks, 2);

  // Step 1 second: total DoT = 10 (burn) + 5*2 (poison) = 20 damage
  // Shield should absorb all 20 damage -> shieldHp = 10, hp remains 100
  const step1 = stepEntityStatuses(entity, 1.0, t0 + 1000);
  assert.ok(Math.abs(step1.dotDamage - 20) < 1e-6);
  assert.ok(Math.abs(entity.shieldHp - 10) < 1e-6);
  assert.equal(entity.hp, 100);
  assert.ok(Math.abs(step1.moveSpeedMult - STATUS_EFFECTS.chill.moveSpeedMult) < 1e-6);
  assert.ok(Math.abs(step1.damageTakenMult - STATUS_EFFECTS.curse.dmgTakenMult) < 1e-6);

  // Step another 1 second: total DoT = 20 damage
  // Remaining 10 shield absorbs 10, breaks shield, remaining 10 DoT reduces hp from 100 -> 90
  const step2 = stepEntityStatuses(entity, 1.0, t0 + 2000);
  assert.ok(Math.abs(step2.dotDamage - 20) < 1e-6);
  assert.equal(entity.shieldHp, 0);
  assert.equal(entity.statuses.shield, undefined);
  assert.ok(Math.abs(entity.hp - 90) < 1e-6);

  // Step 2 more seconds (now at t0 + 4000): chill (3s) and burn (4s) expire
  const step3 = stepEntityStatuses(entity, 2.0, t0 + 4000);
  assert.equal(step3.activeStatuses.includes('chill'), false);
  assert.equal(step3.activeStatuses.includes('burn'), false);
  assert.equal(step3.activeStatuses.includes('poison'), true);
  assert.equal(step3.moveSpeedMult, 1.0);
});

// ---------------------------------------------------------------------------------------------
// 5. Monster & Boss AI
// ---------------------------------------------------------------------------------------------
test('Monster & Boss AI: idle/patrol -> chase -> telegraph -> attack -> leash', () => {
  const boss = createMonsterEntity(MONSTER_ARCHETYPES.astral_colossus, {
    x: 0,
    z: 0,
    homeX: 0,
    homeZ: 0,
  });
  boss.patrol = true;

  let now = 10_000;

  // 1. No players in aggroRadius (12.0m) -> 'patrol' (or 'idle' when patrol is false)
  const farPlayer = { id: 'p1', x: 30, z: 0, hp: 200 };
  const resPatrol = stepMonsterAI(boss, [farPlayer], 0.1, now);
  assert.equal(resPatrol.state, 'patrol');

  boss.patrol = false;
  const resIdle = stepMonsterAI(boss, [farPlayer], 0.1, now);
  assert.equal(resIdle.state, 'idle');

  // 2. Player enters aggroRadius (dist ~9m <= 12m, but outside skill radius 4.2m and attackRange 2.6m) -> 'chase'
  const chasePlayer = { id: 'p1', x: 9.0, z: 0, hp: 200 };
  const prevX = boss.x;
  const resChase = stepMonsterAI(boss, [chasePlayer], 0.2, now);
  assert.equal(resChase.state, 'chase');
  assert.equal(resChase.event, 'chasing');
  assert.ok(boss.x > prevX);

  // 3. Player is within boss skill trigger range (<= 4.2m) -> 'telegraph'
  const skillPlayer = { id: 'p1', x: boss.x + 3.5, z: boss.z, hp: 200 };
  const resTelegraphStart = stepMonsterAI(boss, [skillPlayer], 0.1, now);
  assert.equal(resTelegraphStart.state, 'telegraph');
  assert.equal(resTelegraphStart.event, 'telegraph_start');
  assert.ok(boss.telegraph);

  // During windup before endsAt -> remains in 'telegraph'
  now += 500;
  const resWindup = stepMonsterAI(boss, [skillPlayer], 0.1, now);
  assert.equal(resWindup.state, 'telegraph');
  assert.equal(resWindup.event, 'telegraph_windup');

  // 4. Windup completes (windupMs = 1300) -> executes 'attack' (skill_attack)
  now += 900;
  const resSkillAttack = stepMonsterAI(boss, [skillPlayer], 0.1, now);
  assert.equal(resSkillAttack.state, 'attack');
  assert.equal(resSkillAttack.event, 'skill_attack');
  assert.ok(resSkillAttack.damage > boss.atk);

  // Basic attack when player is within attackRange (2.6m) and skill is on cooldown
  now += 2000;
  const closePlayer = { id: 'p1', x: boss.x + 1.5, z: boss.z, hp: 200 };
  const resBasicAttack = stepMonsterAI(boss, [closePlayer], 0.1, now);
  assert.equal(resBasicAttack.state, 'attack');
  assert.equal(resBasicAttack.event, 'basic_attack');

  // 5. Pulled beyond leashRadius (26m) from (homeX=0, homeZ=0) -> 'leash'
  boss.x = 30;
  boss.z = 0;
  boss.hp = 1000;
  const resLeash = stepMonsterAI(boss, [closePlayer], 0.2, now);
  assert.equal(resLeash.state, 'leash');
  assert.equal(resLeash.event, 'returning_home');
  assert.ok(boss.x < 30); // Moving back toward homeX = 0

  // Near home -> completes leash, resets hp to maxHp, returns to 'idle'
  boss.x = 0.2;
  boss.z = 0;
  const resLeashDone = stepMonsterAI(boss, [farPlayer], 0.1, now);
  assert.equal(resLeashDone.state, 'idle');
  assert.equal(resLeashDone.event, 'leash_complete');
  assert.equal(boss.hp, boss.maxHp);
});

// ---------------------------------------------------------------------------------------------
// 6. Database Cloud Readiness
// ---------------------------------------------------------------------------------------------
test('Database Cloud Readiness: new Database(":memory:") initializes, tracks dirty sets, and reports getStats()', async () => {
  const db = new Database(':memory:');
  await db.init();

  try {
    const initialStats = db.getStats();
    assert.equal(initialStats.mode, 'local');
    assert.equal(initialStats.profiles, 0);
    assert.equal(initialStats.sessions, 0);
    assert.equal(initialStats.dirtyProfiles, 0);

    // Insert profiles and sessions
    db.putProfile({ id: 'alice', coins: 100 });
    db.putProfile({ id: 'bob', coins: 250 });
    db.createSession('tok_1', 'alice');
    db.createSession('tok_2', 'bob');

    assert.equal(db.dirtyProfiles.has('alice'), true);
    assert.equal(db.dirtyProfiles.has('bob'), true);
    assert.equal(db.dirtySessions.has('tok_1'), true);
    assert.equal(db.dirtySessions.has('tok_2'), true);

    const dirtyStats = db.getStats();
    assert.equal(dirtyStats.profiles, 2);
    assert.equal(dirtyStats.sessions, 2);
    assert.equal(dirtyStats.dirtyProfiles, 2);

    // Deleting a session moves it from dirtySessions to deletedSessions
    db.deleteSession('tok_2');
    assert.equal(db.dirtySessions.has('tok_2'), false);
    assert.equal(db.deletedSessions.has('tok_2'), true);
    assert.equal(db.getStats().sessions, 1);

    // Flush clears dirty tracking while retaining in-memory state
    await db.flush();
    assert.equal(db.dirtyProfiles.size, 0);
    assert.equal(db.dirtySessions.size, 0);
    assert.equal(db.deletedSessions.size, 0);

    const postFlushStats = db.getStats();
    assert.equal(postFlushStats.profiles, 2);
    assert.equal(postFlushStats.sessions, 1);
    assert.equal(postFlushStats.dirtyProfiles, 0);
  } finally {
    await db.close();
  }
});
