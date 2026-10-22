// tests/unit.test.js — pure-logic tests (node --test tests/)
import test from 'node:test';
import assert from 'node:assert/strict';
import { FacingState, CHIBI_FACING, PET_FACING, PetFollower, PET_FOLLOW, Mover } from '../shared/locomotion.js';
import { expToNext, applyExp, recalcPlayerCP } from '../shared/progression.js';
import { seedProfiles, createStarterProfile, verifyPassword } from '../server/profile_factory.js';

const run = (fs, secs, vx, vz, dt = 1 / 60) => { for (let t = 0; t < secs; t += dt) fs.update(dt, vx, vz); return fs; };

test('4-diagonal facing: down-right / down-left are Front-3/4', () => {
  const f = run(new FacingState(), 0.3, 3, 2);
  assert.equal(f.back, false); assert.equal(f.right, true);
  run(f, 0.3, -3, 2);
  assert.equal(f.back, false); assert.equal(f.right, false);
});

test('4-diagonal facing: moving up (dz < -0.15) switches to Back-3/4, left/right mirrored', () => {
  const f = run(new FacingState(), 0.3, 3, -3);
  assert.equal(f.back, true); assert.equal(f.right, true);   // NE
  run(f, 0.3, -3, -3);
  assert.equal(f.back, true); assert.equal(f.right, false);  // NW
});

test('mostly-sideways movement stays Front-3/4 (threshold -0.15)', () => {
  const f = run(new FacingState(), 0.3, 4, -0.4);           // dz/|v| ≈ -0.0995
  assert.equal(f.back, false);
});

test('idle turn-to-camera after 0.6s (chibi) / 0.5s (pet)', () => {
  const f = run(new FacingState(CHIBI_FACING), 0.3, 0, -4);
  assert.equal(f.back, true);
  run(f, 0.55, 0, 0);
  assert.equal(f.back, true, 'still back before 0.6s');
  run(f, 0.1, 0, 0);
  assert.equal(f.back, false, 'turned to camera after 0.6s');
  const p = run(new FacingState(PET_FACING), 0.3, 0, -4);
  run(p, 0.52, 0, 0);
  assert.equal(p.back, false);
});

test('pop turn: width never collapses (no paper flip), art swaps at the crouch', () => {
  const f = new FacingState();
  f.update(1 / 60, 3, 1);
  f.update(1 / 60, -3, 1);                                    // turn left (same view, mirror only)
  assert.ok(f.turning);
  let minSx = 2, sawOld = false, sawNew = false;
  for (let i = 0; i < 30; i++) {
    f.update(1 / 120, -3, 1);
    minSx = Math.min(minSx, f.turnSquash.sx);
    const s = f.shown(true);
    if (s.right) sawOld = true; else sawNew = true;
    assert.notEqual(s.view, 'side', 'left/right turns never need the side frame');
  }
  assert.ok(minSx > 0.9, `min width ${minSx}`);
  assert.ok(sawOld && sawNew);
  assert.equal(f.turning, false);
  assert.deepEqual(f.turnSquash, { sx: 1, sy: 1 });
});

test('front -> back turn plays front, then side profile, then back', () => {
  const f = new FacingState();
  f.update(1 / 60, 3, 1);
  const seq = [];
  for (let i = 0; i < 40; i++) {
    f.update(1 / 240, 3, -3);
    const v = f.shown(true).view;
    if (seq[seq.length - 1] !== v) seq.push(v);
  }
  assert.deepEqual(seq, ['front', 'side', 'back']);
  const g = new FacingState();
  g.update(1 / 60, 3, 1);
  const seq2 = [];
  for (let i = 0; i < 40; i++) { g.update(1 / 240, 3, -3); const v = g.shown(false).view; if (seq2[seq2.length - 1] !== v) seq2.push(v); }
  assert.deepEqual(seq2, ['front', 'back'], 'without side art it swaps straight at the crouch');
});

test('mover accelerates within ~90ms and walkWeight ramps over 140ms', () => {
  const m = new Mover();
  for (let t = 0; t < 0.09; t += 1 / 120) m.update(1 / 120, 1, 0);
  assert.ok(m.vx > 4.5 * 0.9, `vx after 90ms = ${m.vx}`);
  for (let t = 0; t < 0.15; t += 1 / 120) m.update(1 / 120, 1, 0);
  assert.equal(m.walkWeight, 1);
  for (let t = 0; t < 0.3; t += 1 / 120) m.update(1 / 120, 0, 0);
  assert.equal(m.vx, 0); assert.equal(m.walkWeight, 0);
});

test('pet never overlaps the owner when the owner stops (spatial ring buffer)', () => {
  const pet = new PetFollower(0, 0);
  let ox = 0, oz = 0, minDist = Infinity;
  const dt = 1 / 60;
  for (let t = 0; t < 3; t += dt) {                           // owner walks right then up
    if (t < 1.5) ox += 4.5 * dt; else oz -= 4.5 * dt;
    pet.update(dt, { x: ox, z: oz, speed: 4.5, moving: true, right: true });
    if (t > 0.5) minDist = Math.min(minDist, Math.hypot(pet.x - ox, pet.z - oz));
  }
  assert.ok(minDist >= PET_FOLLOW.MIN_FOLLOW_DIST - 0.05, `pet came within ${minDist.toFixed(2)}m while trailing`);
  for (let t = 0; t < 3; t += dt) pet.update(dt, { x: ox, z: oz, speed: 0, moving: false, right: true });
  const d = Math.hypot(pet.x - ox, pet.z - oz);
  assert.ok(d > 0.6 && d < 1.2, `rest distance ${d.toFixed(2)}`);
  assert.ok(pet.x < ox, 'rests behind the owner (owner faces right)');
  assert.ok(pet.z > oz, 'rests slightly toward the camera');
});

test('pet teleports to the owner beyond 8m', () => {
  const pet = new PetFollower(0, 0);
  pet.update(1 / 60, { x: 20, z: 0, speed: 0, moving: false, right: false });
  assert.ok(pet.events.includes('teleport'));
  assert.ok(Math.hypot(pet.x - 20, pet.z) < 1.2);
});

test('regression: owner reverses and walks back through the pet -> pet sidesteps', () => {
  const pet = new PetFollower(0, 0);
  let ox = 0, oz = 0, minDist = Infinity;
  const dt = 1 / 60;
  for (let t = 0; t < 1.2; t += dt) { ox += 3.2 * dt; oz += 3.2 * dt; pet.update(dt, { x: ox, z: oz, vx: 3.2, vz: 3.2, speed: 4.5, moving: true, right: true }); }
  for (let t = 0; t < 1.5; t += dt) {
    ox -= 3.2 * dt; oz -= 3.2 * dt;
    pet.update(dt, { x: ox, z: oz, vx: -3.2, vz: -3.2, speed: 4.5, moving: true, right: false });
    minDist = Math.min(minDist, Math.hypot(pet.x - ox, pet.z - oz));
  }
  assert.ok(minDist > 0.6, `pet came within ${minDist.toFixed(2)}m`);
});

test('regression: stale crumbs inside the ring never strand the pet far away', () => {
  const pet = new PetFollower(0, 0);
  const dt = 1 / 60;
  let ox = 0;
  for (let t = 0; t < 1; t += dt) { ox += 4.5 * dt; pet.update(dt, { x: ox, z: 0, vx: 4.5, vz: 0, speed: 4.5, moving: true, right: true }); }
  for (let t = 0; t < 0.8; t += dt) { ox -= 4.5 * dt; pet.update(dt, { x: ox, z: 0, vx: -4.5, vz: 0, speed: 4.5, moving: true, right: false }); }
  for (let t = 0; t < 3; t += dt) pet.update(dt, { x: ox, z: 0, vx: 0, vz: 0, speed: 0, moving: false, right: false });
  const d = Math.hypot(pet.x - ox, pet.z);
  assert.ok(d >= 0.6 && d <= 1.2, `pet rests ${d.toFixed(2)}m away`);
});

test('EXP curve matches the patched Section 4.A examples', () => {
  assert.equal(expToNext(1), 200);
  assert.equal(expToNext(9), 3883);
  assert.equal(expToNext(28), 17976);
  const r = applyExp(1, 0, expToNext(1) + expToNext(2) + 5);
  assert.equal(r.level, 3); assert.equal(r.levelsGained, 2); assert.equal(r.exp, 5);
});

test('seeded nook and neen both compute to CP 15,420 (Screens 07/26/27)', () => {
  const [nook, neen] = seedProfiles();
  assert.equal(recalcPlayerCP(nook), 15420);
  assert.equal(recalcPlayerCP(neen), 15420);
  assert.equal(nook.partner_id, 'neen');
  assert.equal(neen.partner_id, 'nook');
  assert.ok(verifyPassword('1234', nook.salt, nook.hash));
});

test('starter profile matches Section 21.M.2 & Pet System V2 starters', () => {
  const p = createStarterProfile('newbie', 'pw12', 'dxb');
  assert.equal(p.gold, 2500); assert.equal(p.berries, 300); assert.equal(p.diamonds, 600); assert.equal(p.shards, 50);
  assert.deepEqual(p.bag_items, { ticket_standard: 5, ticket_gold: 2, ticket_royal_hair: 2, streak_freeze: 1, scroll_forge_boost: 2, random_dupe_box: 1 });
  // Stage 3 base camp: the Castle (ruins) + 2 starter farm plots
  assert.deepEqual(p.village.buildings.map((b) => b.type), ['castle', 'farm_plot', 'farm_plot']);
  assert.equal(p.village.copies.farm_plot, 2);
  assert.equal(p.equipped.pet.id, 'pet_ragdoll');
  const pBkk = createStarterProfile('newbie2', 'pw12', 'bkk');
  assert.equal(pBkk.equipped.pet.id, 'pet_nyx');
  assert.ok(!verifyPassword('wrong', p.salt, p.hash));
});
