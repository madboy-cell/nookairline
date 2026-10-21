// tests/cloud_dash_pet_rides.test.js — Tests for per-family Pet Ride styles
// and in-race pet passives in shared/cloud_dash_rules.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DASH_TUNING as T, PET_RIDES, petRideFor, createRunner, stepRunner,
  speedMul, deliverEffect, createBotBrain, botInput, computeRanking,
} from '../shared/cloud_dash_rules.js';
import { buildTrack } from '../shared/cloud_dash_track.js';

const NONE = { left: false, right: false, jump: false, glide: false, ult: false, item: false };

test('createRunner: fallback, ride styles, and star scaling per pet', () => {
  // 1. Unknown petId falls back to pet_ragdoll
  const rUnknown = createRunner({ petId: 'unknown_pet_mythic' });
  assert.equal(rUnknown.petId, 'pet_ragdoll', 'unknown petId falls back to pet_ragdoll');
  assert.equal(rUnknown.rideStyle, 'pounce', 'fallback pet gets pounce ride style');
  assert.deepEqual(petRideFor('unknown_pet_mythic'), PET_RIDES.pet_ragdoll, 'petRideFor falls back to pet_ragdoll');

  // 2. Each pet maps to the right rideStyle
  assert.equal(createRunner({ petId: 'pet_ragdoll' }).rideStyle, 'pounce', 'ragdoll maps to pounce');
  assert.equal(createRunner({ petId: 'pet_nyx' }).rideStyle, 'flight', 'nyx maps to flight');
  assert.equal(createRunner({ petId: 'pet_kitsune' }).rideStyle, 'blink', 'kitsune maps to blink');
  assert.equal(createRunner({ petId: 'pet_skywhale' }).rideStyle, 'surf', 'skywhale maps to surf');

  // 3. Star scaling:
  // Ragdoll ★3 magnetM 1.3 → petMagnet = 1.3 / T.LANE_W
  const rRag3 = createRunner({ petId: 'pet_ragdoll', petStars: 3 });
  assert.equal(rRag3.petMagnet, 1.3 / T.LANE_W, 'ragdoll ★3 petMagnet = 1.3 / LANE_W');
  const rRag1 = createRunner({ petId: 'pet_ragdoll', petStars: 1 });
  assert.equal(rRag1.petMagnet, 0.8 / T.LANE_W, 'ragdoll ★1 petMagnet = 0.8 / LANE_W');

  // Nyx ★3 ride duration = T.RIDE.dur[2] + 1.0 when bond hits 100
  const rNyx3 = createRunner({ petId: 'pet_nyx', petStars: 3 });
  assert.equal(rNyx3.petRideBonus, 1.0, 'nyx ★3 petRideBonus = 1.0');
  rNyx3.bond = 100;
  stepRunner(rNyx3, { track: { items: [], pits: [] }, place: 1 }, NONE, T.DT);
  assert.equal(rNyx3.ride, T.RIDE.dur[2] + 1.0, 'nyx ★3 ride duration = T.RIDE.dur[2] + 1.0');

  // Kitsune airHops = 2 and ★3 hop velocity = T.HOP_V * 1.15
  const rKit3 = createRunner({ petId: 'pet_kitsune', petStars: 3 });
  assert.equal(rKit3.petAirHops, 2, 'kitsune petAirHops = 2 (1 base + 1 extra)');
  assert.equal(rKit3.airHops, 2, 'kitsune starts with 2 airHops');
  assert.equal(rKit3.petHopMul, 1.15, 'kitsune ★3 petHopMul = 1.15 (+15%)');
  // Make airborne and hop to verify hop velocity multiplier
  rKit3.grounded = false; rKit3.vy = 0; rKit3.y = 1.0;
  const evHop = stepRunner(rKit3, { track: { items: [], pits: [] }, place: 1 }, { ...NONE, jump: true }, T.DT);
  assert.ok(evHop.some((e) => e.e === 'hop'), 'emits hop event');
  assert.equal(rKit3.airHops, 1, 'consumed 1 airHop');
  // At the moment of hop: vy was set to T.HOP_V * 1.15, then vertical step subtracted T.GRAVITY * dt
  const expectedVy = T.HOP_V * 1.15 - T.GRAVITY * T.DT;
  assert.ok(Math.abs(rKit3.vy - expectedVy) < 1e-6, 'hop launch velocity equals T.HOP_V * 1.15');

  // Sky Whale shieldEverySec [30, 25, 20]
  assert.equal(createRunner({ petId: 'pet_skywhale', petStars: 1 }).petShieldEvery, 30, 'whale ★1 shieldEverySec = 30');
  assert.equal(createRunner({ petId: 'pet_skywhale', petStars: 2 }).petShieldEvery, 25, 'whale ★2 shieldEverySec = 25');
  const rWhale3 = createRunner({ petId: 'pet_skywhale', petStars: 3 });
  assert.equal(rWhale3.petShieldEvery, 20, 'whale ★3 shieldEverySec = 20');
  assert.equal(rWhale3.petShieldLeft, 3, 'whale starts with 3 shield charges');
});

test('pounce: ragdoll ride launch, landing heart wave scoop across all lanes, and post-ride termination', () => {
  // Track with coins in all 3 lanes placed within 0-8 m of expected first landing (~3.8 m)
  const track = {
    items: [
      { t: 'coin', s: 5.0, lane: -1 }, // lane -1 within wave
      { t: 'coin', s: 7.0, lane: 0 },  // lane 0 within wave
      { t: 'coin', s: 9.0, lane: 1 },  // lane 1 within wave
      { t: 'coin', s: 15.0, lane: 0 }, // beyond 8m ahead of landing
    ],
    pits: [],
    bends: [],
    deck: null,
  };

  const r = createRunner({ petId: 'pet_ragdoll', itemCount: track.items.length });
  r.s = 0;
  r.bond = 100;
  const ctx = { track, place: 1 };

  // Step 1: bond=100 triggers ride start and launches runner into the air
  const ev1 = stepRunner(r, ctx, NONE, T.DT);
  assert.ok(ev1.some((e) => e.e === 'ride_start' && e.style === 'pounce'), 'emits ride_start with style pounce');
  assert.equal(r.grounded, false, 'runner leaves the ground on ride start');
  assert.ok(r.y > 0, 'runner y > 0 after launch');

  // Advance until runner lands during ride
  let pounceEv = null;
  while (r.ride > 0) {
    const ev = stepRunner(r, ctx, NONE, T.DT);
    const p = ev.find((e) => e.e === 'pounce');
    if (p) {
      pounceEv = p;
      break;
    }
  }

  assert.ok(pounceEv, 'emits {e: pounce} on landing during ride');
  assert.equal(pounceEv.n, 3, 'wave collected all 3 coins across lanes -1, 0, 1');
  assert.equal(r.taken[0], 1, 'coin in lane -1 taken');
  assert.equal(r.taken[1], 1, 'coin in lane 0 taken');
  assert.equal(r.taken[2], 1, 'coin in lane 1 taken');
  assert.equal(r.taken[3], 0, 'coin > 8m ahead remains untouched');
  assert.equal(r.grounded, false, 'immediately re-launches (not grounded)');
  assert.equal(r.vy, T.POUNCE.hopV, 'immediately re-launches with vy = T.POUNCE.hopV');

  // Let ride finish
  while (r.ride > 0) {
    stepRunner(r, ctx, NONE, T.DT);
  }
  assert.equal(r.ride, 0, 'ride ended');

  // After ride ends: runner lands normally without further pounces
  let postPounces = 0;
  for (let i = 0; i < 200; i++) {
    const ev = stepRunner(r, ctx, NONE, T.DT);
    if (ev.some((e) => e.e === 'pounce')) postPounces++;
  }
  assert.equal(postPounces, 0, 'no more pounces after ride ends');
  assert.equal(r.grounded, true, 'runner is grounded normally after landing post-ride');
});

test('flight: nyx convergence to T.FLIGHT.y, breath attack, pit ride extension, and speedMul', () => {
  const ctxEmpty = { track: { items: [], pits: [], bends: [], deck: null }, place: 1 };

  // 1. Nyx riding → y converges to ≈T.FLIGHT.y within ~0.6 s and stays
  const rFly = createRunner({ petId: 'pet_nyx' });
  rFly.bond = 100;
  stepRunner(rFly, ctxEmpty, NONE, T.DT);

  const steps06 = Math.round(0.6 / T.DT);
  for (let i = 0; i < steps06; i++) stepRunner(rFly, ctxEmpty, NONE, T.DT);
  assert.ok(Math.abs(rFly.y - T.FLIGHT.y) < 0.05, `y converges to ≈T.FLIGHT.y within ~0.6s (y=${rFly.y.toFixed(3)})`);

  for (let i = 0; i < 60; i++) stepRunner(rFly, ctxEmpty, NONE, T.DT);
  assert.ok(Math.abs(rFly.y - T.FLIGHT.y) < 0.05, `y stays at ≈T.FLIGHT.y (y=${rFly.y.toFixed(3)})`);

  // 2. 'breath' fires at start and every T.FLIGHT.breathEvery
  const rBreath = createRunner({ petId: 'pet_nyx' });
  rBreath.bond = 100;
  const evStart = stepRunner(rBreath, ctxEmpty, NONE, T.DT);
  assert.ok(evStart.some((e) => e.e === 'breath'), 'breath fires at ride start');

  let stepsToNext = 0;
  for (let i = 1; i <= Math.round(T.FLIGHT.breathEvery / T.DT) + 10; i++) {
    const ev = stepRunner(rBreath, ctxEmpty, NONE, T.DT);
    if (ev.some((e) => e.e === 'breath')) {
      stepsToNext = i;
      break;
    }
  }
  const expectedSteps = Math.round(T.FLIGHT.breathEvery / T.DT);
  assert.equal(stepsToNext, expectedSteps, `second breath fires after exactly T.FLIGHT.breathEvery (${stepsToNext} steps)`);

  // 3. Clouds in own lane within 30 m ahead get taken (r.taken) + coins, clouds in other lanes untouched
  const trackClouds = {
    items: [
      { t: 'cloud', s: 10, lane: 0 },
      { t: 'cloud', s: 25, lane: 0 },
      { t: 'cloud', s: 20, lane: 1 }, // different lane
      { t: 'cloud', s: 45, lane: 0 }, // > 30 m ahead
    ],
    pits: [],
    bends: [],
    deck: null,
  };
  const rCloud = createRunner({ petId: 'pet_nyx', itemCount: trackClouds.items.length });
  rCloud.s = 0; rCloud.laneF = 0; rCloud.laneT = 0;
  rCloud.bond = 100;
  const coinsBefore = rCloud.coins;
  const evCloud = stepRunner(rCloud, { track: trackClouds, place: 1 }, NONE, T.DT);
  const breathEv = evCloud.find((e) => e.e === 'breath');
  assert.ok(breathEv, 'emits breath on step 1');
  assert.equal(breathEv.n, 2, 'cleared 2 clouds in own lane within 30m');
  assert.equal(rCloud.taken[0], 1, 'cloud at 10m lane 0 taken');
  assert.equal(rCloud.taken[1], 1, 'cloud at 25m lane 0 taken');
  assert.equal(rCloud.taken[2], 0, 'cloud at 20m lane 1 untouched');
  assert.equal(rCloud.taken[3], 0, 'cloud at 45m lane 0 untouched');
  assert.equal(rCloud.coins - coinsBefore, 4, 'each destroyed cloud yielded 2 coins');

  // 4. Ride end over a pit extends the ride until past the pit (no rescue)
  const trackPit = { items: [], pits: [{ s0: 50, s1: 70 }], bends: [], deck: null };
  const rPit = createRunner({ petId: 'pet_nyx' });
  rPit.s = 55; rPit.v = 11;
  rPit.ride = 0.05; // almost expired (< 0.1s remaining)
  rPit.rideStyle = 'flight';
  const ctxPit = { track: trackPit, place: 1 };

  while (rPit.s <= 70) {
    stepRunner(rPit, ctxPit, NONE, T.DT);
    assert.ok(rPit.ride > 0, `ride extended while traversing pit (s=${rPit.s.toFixed(1)}, ride=${rPit.ride.toFixed(3)})`);
    assert.equal(rPit.rescue, 0, 'no rescue triggered while above pit');
  }

  // Once past the pit, ride safely dismounts
  while (rPit.ride > 0) {
    stepRunner(rPit, ctxPit, NONE, T.DT);
  }
  assert.equal(rPit.ride, 0, 'ride ended after clearing the pit');
  assert.equal(rPit.rescue, 0, 'landed safely on road without rescue');

  // 5. speedMul includes FLIGHT.mul
  const rFlySpeed = createRunner({ petId: 'pet_nyx' });
  rFlySpeed.ride = 5.0;
  const rBaseSpeed = createRunner({ petId: 'pet_ragdoll' });
  rBaseSpeed.ride = 5.0;
  assert.ok(
    Math.abs(speedMul(rFlySpeed) - speedMul(rBaseSpeed) * T.FLIGHT.mul) < 1e-6,
    'speedMul includes T.FLIGHT.mul factor',
  );
});

test('blink: kitsune instant lane shift, stack accumulation/cap, speedMul scaling, reset at dismount', () => {
  const track = { items: [], pits: [], bends: [], deck: null };
  const ctx = { track, place: 1 };
  const RIGHT = { ...NONE, right: true };
  const LEFT = { ...NONE, left: true };

  // 1. Kitsune riding → lane input sets laneF === laneT in the same step, emits {e: blink}, r.blink increments up to 5 max
  const r = createRunner({ petId: 'pet_kitsune' });
  r.ride = 5.0;
  r.laneT = 0; r.laneF = 0;

  const baseRideSpeed = speedMul(r);
  assert.equal(r.blink, 0, 'initial blink stacks = 0');

  // First blink: 0 -> 1
  const evBlink1 = stepRunner(r, ctx, RIGHT, T.DT);
  assert.equal(r.laneT, 1, 'laneT shifted to 1');
  assert.equal(r.laneF, 1, 'laneF instantly equals laneT in the same step');
  const b1 = evBlink1.find((e) => e.e === 'blink');
  assert.ok(b1, 'emits blink event');
  assert.equal(b1.from, 0);
  assert.equal(b1.to, 1);
  assert.equal(b1.stacks, 1);
  assert.equal(r.blink, 1);

  // speedMul increases by 3%/stack
  const speedStack1 = speedMul(r);
  assert.ok(
    Math.abs(speedStack1 - baseRideSpeed * (1 + 1 * T.BLINK.perStack)) < 1e-6,
    'speedMul increased by 3% at stack 1',
  );

  // Blinks 2, 3, 4, 5 by shifting lanes
  stepRunner(r, ctx, LEFT, T.DT);  // lane 0, stack 2
  assert.equal(r.blink, 2);
  stepRunner(r, ctx, RIGHT, T.DT); // lane 1, stack 3
  assert.equal(r.blink, 3);
  stepRunner(r, ctx, LEFT, T.DT);  // lane 0, stack 4
  assert.equal(r.blink, 4);
  stepRunner(r, ctx, RIGHT, T.DT); // lane 1, stack 5
  assert.equal(r.blink, 5);

  const speedStack5 = speedMul(r);
  assert.ok(
    Math.abs(speedStack5 - baseRideSpeed * (1 + 5 * T.BLINK.perStack)) < 1e-6,
    'speedMul increased by 15% (5 stacks × 3%) at max stack',
  );

  // Attempt 6th blink: stacks capped at 5
  stepRunner(r, ctx, LEFT, T.DT);  // lane 0, capped at 5
  assert.equal(r.blink, 5, 'blink stacks capped at max 5');

  // 2. Stacks reset at ride end
  while (r.ride > 0) stepRunner(r, ctx, NONE, T.DT);
  assert.equal(r.ride, 0, 'ride ended');
  assert.equal(r.blink, 0, 'blink stacks reset to 0 at ride end');

  // 3. Without riding lanes swap gradually as before
  const rNormal = createRunner({ petId: 'pet_kitsune' });
  rNormal.laneT = 0; rNormal.laneF = 0;
  const evNorm = stepRunner(rNormal, ctx, RIGHT, T.DT);
  assert.equal(rNormal.laneT, 1, 'laneT moves toward target');
  assert.notEqual(rNormal.laneF, 1, 'laneF does not immediately equal laneT without riding');
  assert.ok(rNormal.laneF > 0 && rNormal.laneF < 1, 'laneF moves gradually by dt / LANE_SWAP_TIME');
  assert.ok(!evNorm.some((e) => e.e === 'blink'), 'no blink event without active ride');
});

test('surf: whale ride surf_wave emission, bubble effect delivery, speed reduction, and dodge immunity', () => {
  const track = { items: [], pits: [], bends: [], deck: null };
  const ctx = { track, place: 1 };

  // 1. Whale riding emits {e:'surf_wave'} roughly every T.SURF.every s
  const rWhale = createRunner({ petId: 'pet_skywhale' });
  rWhale.bond = 100;
  const ev1 = stepRunner(rWhale, ctx, NONE, T.DT);
  assert.ok(ev1.some((e) => e.e === 'surf_wave'), 'emits surf_wave at ride start');

  let waveSteps = 0;
  for (let i = 1; i < 100; i++) {
    const ev = stepRunner(rWhale, ctx, NONE, T.DT);
    if (ev.some((e) => e.e === 'surf_wave')) {
      waveSteps = i;
      break;
    }
  }
  const expectedSteps = Math.round(T.SURF.every / T.DT);
  assert.equal(waveSteps, expectedSteps, `second surf_wave roughly every T.SURF.every s (${waveSteps} steps)`);

  // 2. deliverEffect(r,'bubble') on a normal runner → next step r.bubbled>0 and speedMul is ×0.8 vs baseline
  const rNorm = createRunner();
  const baselineSpeed = speedMul(rNorm);
  deliverEffect(rNorm, 'bubble');
  assert.equal(rNorm.incoming.length, 1, 'bubble effect placed in incoming queue');

  const evNorm = stepRunner(rNorm, ctx, NONE, T.DT);
  assert.ok(evNorm.some((e) => e.e === 'bubbled'), 'emits bubbled event');
  assert.ok(rNorm.bubbled > 0, 'r.bubbled timer is active (> 0)');
  assert.ok(
    Math.abs(speedMul(rNorm) - baselineSpeed * 0.8) < 1e-6,
    `speedMul is ×0.8 vs baseline (${speedMul(rNorm)} vs ${baselineSpeed * 0.8})`,
  );

  // 3. Runner with shield>0 → {e:'dodge', what:'bubble'} and shield NOT consumed
  const rShield = createRunner();
  rShield.shield = 10.0;
  deliverEffect(rShield, 'bubble');
  const evShield = stepRunner(rShield, ctx, NONE, T.DT);
  assert.ok(evShield.some((e) => e.e === 'dodge' && e.what === 'bubble'), 'emits dodge event for bubble');
  assert.equal(rShield.bubbled, 0, 'runner was not bubbled');
  assert.ok(rShield.shield > 9.9, 'shield was not consumed by bubble (only normal dt decremented)');

  // 4. Runner riding → {e:'dodge', what:'bubble'}
  const rRiding = createRunner();
  rRiding.ride = 5.0;
  deliverEffect(rRiding, 'bubble');
  const evRiding = stepRunner(rRiding, ctx, NONE, T.DT);
  assert.ok(evRiding.some((e) => e.e === 'dodge' && e.what === 'bubble'), 'riding runner dodges bubble');
  assert.equal(rRiding.bubbled, 0, 'riding runner was not bubbled');
});

test('whale passive: periodic bubble shield, timer reset when shielded, and 3-shield maximum', () => {
  const track = { items: [], pits: [], bends: [], deck: null };
  const ctx = { track, place: 1 };

  const r = createRunner({ petId: 'pet_skywhale', petStars: 3 });
  assert.equal(r.petShieldEvery, 20, '★3 whale shields every 20s');
  assert.equal(r.petShieldLeft, 3, 'initial charges = 3');

  // 1. Advance 19.9s (< 20s) → no shield granted yet
  const steps19_9 = Math.floor(19.9 / T.DT);
  for (let i = 0; i < steps19_9; i++) {
    const ev = stepRunner(r, ctx, NONE, T.DT);
    assert.ok(!ev.some((e) => e.e === 'pet_shield'), 'no shield before 20s');
  }
  assert.equal(r.shield, 0, 'shield is still 0 at 19.9s');

  // Advance remaining steps to reach 20s
  let gotShield1 = false;
  for (let i = 0; i < 15; i++) {
    const ev = stepRunner(r, ctx, NONE, T.DT);
    if (ev.some((e) => e.e === 'pet_shield')) {
      gotShield1 = true;
      break;
    }
  }
  assert.ok(gotShield1, 'emits {e: pet_shield} at 20s');
  assert.equal(r.shield, T.SHIELD_DUR, 'shield set to T.SHIELD_DUR (15s)');
  assert.equal(r.petShieldLeft, 2, 'charges decremented to 2');

  // 2. Timer resets while a shield is up
  assert.equal(r.petShieldT, 0, 'timer reset to 0 on shield trigger');
  stepRunner(r, ctx, NONE, T.DT);
  assert.equal(r.petShieldT, 0, 'timer stays 0 while shield is active');

  // Partial accumulation reset: accumulate 10s then get a shield
  r.shield = 0;
  for (let i = 0; i < Math.round(10 / T.DT); i++) stepRunner(r, ctx, NONE, T.DT);
  assert.ok(Math.abs(r.petShieldT - 10) < 0.1, 'accumulated ~10s toward next shield');
  r.shield = 5.0; // shield acquired from item or perk
  stepRunner(r, ctx, NONE, T.DT);
  assert.equal(r.petShieldT, 0, 'petShieldT reset to 0 because shield is up');

  // 3. At most 3 times per race
  // 2nd shield: clear shield, wait 20s
  r.shield = 0;
  r.petShieldT = 0;
  let gotShield2 = false;
  for (let i = 0; i < Math.round(20.5 / T.DT); i++) {
    const ev = stepRunner(r, ctx, NONE, T.DT);
    if (ev.some((e) => e.e === 'pet_shield')) {
      gotShield2 = true;
      break;
    }
  }
  assert.ok(gotShield2, 'got 2nd shield');
  assert.equal(r.petShieldLeft, 1, 'charges decremented to 1');

  // 3rd shield: clear shield, wait 20s
  r.shield = 0;
  r.petShieldT = 0;
  let gotShield3 = false;
  for (let i = 0; i < Math.round(20.5 / T.DT); i++) {
    const ev = stepRunner(r, ctx, NONE, T.DT);
    if (ev.some((e) => e.e === 'pet_shield')) {
      gotShield3 = true;
      break;
    }
  }
  assert.ok(gotShield3, 'got 3rd shield');
  assert.equal(r.petShieldLeft, 0, 'charges decremented to 0');

  // Attempt 4th shield: clear shield, wait 30s (> 20s)
  r.shield = 0;
  r.petShieldT = 0;
  let gotShield4 = false;
  for (let i = 0; i < Math.round(30 / T.DT); i++) {
    const ev = stepRunner(r, ctx, NONE, T.DT);
    if (ev.some((e) => e.e === 'pet_shield')) gotShield4 = true;
  }
  assert.equal(gotShield4, false, 'never gets a 4th shield (capped at 3 per race)');
});

test('balance smoke: 40 seeds with 4 hard bots on different ★3 pets finish within 3% average time', () => {
  const PETS = ['pet_ragdoll', 'pet_nyx', 'pet_kitsune', 'pet_skywhale'];
  const times = {
    pet_ragdoll: [],
    pet_nyx: [],
    pet_kitsune: [],
    pet_skywhale: [],
  };

  for (let seed = 1; seed <= 40; seed++) {
    const track = buildTrack(seed);
    const bots = PETS.map((petId, i) => ({
      r: createRunner({ seat: i, petId, petStars: 3, itemCount: track.items.length }),
      b: createBotBrain(seed * 100 + i, 'hard'),
    }));

    for (let step = 0; step < 150 / T.DT && !bots.every((x) => x.r.finished); step++) {
      const rank = computeRanking(bots.map((x) => x.r));
      bots.forEach((x, i) => {
        const ctx = {
          track,
          place: rank.indexOf(i) + 1,
          rivals: bots.filter((_, idx) => idx !== i).map((y) => y.r),
        };
        stepRunner(x.r, ctx, botInput(x.r, ctx, x.b, T.DT), T.DT);
      });
    }

    for (const x of bots) {
      assert.ok(x.r.finished, `seed ${seed} bot ${x.r.petId} finished`);
      assert.ok(x.r.finishT > 0 && x.r.finishT <= 150, `finish time ${x.r.finishT} within 150s`);
      times[x.r.petId].push(x.r.finishT);
    }
  }

  const table = PETS.map((petId) => {
    const arr = times[petId];
    const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
    return {
      pet: petId,
      style: PET_RIDES[petId].style,
      races: arr.length,
      avgFinishTime: avg,
      formattedTime: `${avg.toFixed(2)}s`,
    };
  });

  console.log('\n--- Cloud Dash Pet Balance (40 seeds, ★3, Hard Bots) ---');
  console.table(table.map((row) => ({
    Pet: row.pet,
    Style: row.style,
    'Avg Time': row.formattedTime,
  })));

  const avgs = table.map((x) => x.avgFinishTime);
  const minAvg = Math.min(...avgs);
  const maxAvg = Math.max(...avgs);
  const diffPct = ((maxAvg - minAvg) / minAvg) * 100;
  console.log(`Spread between best and worst pet average: ${diffPct.toFixed(2)}%\n`);

  assert.ok(diffPct <= 3.0, `average finish time per pet within 3% of each other (actual: ${diffPct.toFixed(2)}%)`);
});
