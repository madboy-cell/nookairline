// tests/pet.test.js — Pet System V2 ("Soul-Bond Companions") comprehensive unit & integration tests
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  PETS, PET_IDS, PET_POSES, PET_EMOTES, LEGACY_PET_MAP,
  normalizePetId, resolvePetSpriteKey, resolvePetEmoteKey,
} from '../shared/pet_catalog.js';
import { PET_SKILLS, getPetSkill, skillValue } from '../shared/pet_skills.js';
import {
  PET2, STAT_LINES, PERK_LINES, ALL_SLOT_LINES, evolveCost, rerollCost,
  releaseValue, unlockedEmotesForBond, sanitizeNickname, computePetPassives, migratePetsState,
} from '../shared/pet_rules.js';
import { seedProfiles, createStarterProfile, migrateProfile } from '../server/profile_factory.js';
import * as rpg from '../server/rpg_service.js';
import { recalcPlayerCP } from '../shared/progression.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const NOW = 1_800_000_000_000;
const fixed = (v) => () => v;
const seq = (...vals) => { let i = 0; return () => vals[i++ % vals.length]; };

const fresh = (who = 'nook') => {
  const p = seedProfiles().find((x) => x.id === who);
  migrateProfile(p, NOW);
  rpg.migrateRpg(p);
  p.cp = recalcPlayerCP(p);
  return p;
};

test('Pet V2 Catalog: strictly 4 launch pets, IP-safe naming, and all 110 sliced PNG assets exist', () => {
  assert.deepEqual(Object.keys(PETS), ['pet_ragdoll', 'pet_nyx', 'pet_kitsune', 'pet_skywhale']);
  assert.deepEqual(PET_IDS, ['pet_ragdoll', 'pet_nyx', 'pet_kitsune', 'pet_skywhale']);

  for (const id of PET_IDS) {
    const def = PETS[id];
    assert.ok(!/toothless|night\s*fury/i.test(def.name), `IP-safe name check failed for ${def.name}`);
    const skill = getPetSkill(id);
    assert.ok(skill && PET_SKILLS[def.skill]);
    assert.ok(skillValue(id, 'monopoly', Object.keys(skill.modes.monopoly)[1], 3) != null);
  }

  const manifestPath = path.join(ROOT, 'client/assets/asset_manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  // Verify all 96 pet pose + emote sprites (4 pets × (8 t1 + 8 t2 + 8 emotes))
  for (const id of PET_IDS) {
    for (const vTier of [1, 2]) {
      for (const pose of PET_POSES) {
        const key = resolvePetSpriteKey(id, vTier, pose);
        assert.ok(manifest.sprites[key], `Missing manifest entry for ${key}`);
        assert.ok(fs.existsSync(path.join(ROOT, 'client/assets/pets', `${key}.png`)), `Missing PNG for ${key}`);
      }
    }
    for (const emo of PET_EMOTES) {
      const emoKey = resolvePetEmoteKey(id, emo);
      assert.ok(manifest.sprites[emoKey], `Missing manifest entry for ${emoKey}`);
      assert.ok(fs.existsSync(path.join(ROOT, 'client/assets/pets', `${emoKey}.png`)), `Missing PNG for ${emoKey}`);
    }
  }

  // Verify 6 eggs + 8 UI icons
  for (const egg of ['egg_ragdoll', 'egg_nyx', 'egg_kitsune', 'egg_skywhale', 'egg_couple_v2', 'egg_mystery']) {
    assert.ok(manifest.sprites[egg], `Missing egg in manifest: ${egg}`);
    assert.ok(fs.existsSync(path.join(ROOT, 'client/assets/pets', `${egg}.png`)));
  }
  for (const ico of [
    'icon_skill_royal_charm', 'icon_skill_plasma_blast', 'icon_skill_foxfire', 'icon_skill_bubble_shield',
    'icon_pet_essence', 'icon_pet_lock', 'icon_pet_release', 'icon_pet_bond',
  ]) {
    assert.ok(manifest.sprites[ico], `Missing icon in manifest: ${ico}`);
    assert.ok(fs.existsSync(path.join(ROOT, 'client/assets/ui', `${ico}.png`)));
  }
});

test('Pet V2.5 Evolution & Visual Tiers: ★1 -> ★2 (40 Essence, Lv.10 + Slot 2) -> ★3 (120 Essence, Lv.20 Radiant), toggles appearance', () => {
  const p = rpg.migrateRpg(createStarterProfile('evo_qa', '1234', 'dxb'));
  const pet = p.pets[0];
  assert.equal(pet.id, 'pet_ragdoll');
  assert.equal(pet.stars, 1);
  assert.equal(pet.slots.filter(Boolean).length, 1);

  assert.equal(rpg.petEvolve(p, { petUid: pet.uid }).error, 'not_enough_essence');
  pet.essence = 40;
  const r2 = rpg.petEvolve(p, { petUid: pet.uid }, fixed(0.1));
  assert.equal(r2.ok, true);
  assert.equal(r2.stars, 2);
  assert.equal(r2.visual_tier, 2);
  assert.ok(pet.bond_lv >= 10, '★2 Awakened guarantees at least Companion Lv. 10');
  assert.equal(pet.essence, 0);
  assert.equal(pet.spent_essence, 40);
  assert.ok(pet.slots[1] && pet.slots[1].stat, 'Slot 2 unlocked on ★2 evolution');
  assert.equal(pet.slots.filter(Boolean).length, 2, 'Strictly 2 trait slots open at ★2');
  assert.equal(p.equipped.pet.stars, 2);

  pet.essence = 120;
  const r3 = rpg.petEvolve(p, { petUid: pet.uid }, fixed(0.8));
  assert.equal(r3.ok, true);
  assert.equal(r3.stars, 3);
  assert.equal(r3.visual_tier, 3);
  assert.ok(pet.bond_lv >= 20, '★3 Radiant guarantees at least Companion Lv. 20 (unlocking Lv.15 Costume Soul-Link & Cast pose)');
  assert.equal(pet.spent_essence, 160);
  assert.equal(pet.slots.filter(Boolean).length, 2, 'MAX_TRAIT_SLOTS = 2 preserved at ★3');
  assert.equal(rpg.petEvolve(p, { petUid: pet.uid }).error, 'max_stars');

  // Toggle visual tier between ★1 Cute, ★2 Awakened, and ★3 Radiant without losing CP
  const cpAt3 = p.cp;
  const vt1 = rpg.petSetVisualTier(p, { petUid: pet.uid, tier: 1 });
  assert.equal(vt1.ok, true);
  assert.equal(pet.visual_tier, 1);
  assert.equal(p.equipped.pet.visual_tier, 1);
  assert.equal(p.cp, cpAt3);
  assert.equal(rpg.petSetVisualTier(p, { petUid: pet.uid, tier: 4 }).error, 'invalid_visual_tier');
});

test('Pet V2.5 2-Slot Lock Reroll, Mythic Overwrite Guard & Couple Harmony Daily Bonus', () => {
  const p = fresh('nook'); // Nyx is ★3 (Lv.20, 2 open trait slots)
  p.gold = 100_000;
  p.berries = 5_000;
  const nyx = p.pets.find((x) => x.id === 'pet_nyx');
  assert.equal(nyx.stars, 3);
  assert.ok(nyx.bond_lv >= 20);
  assert.equal(nyx.slots.filter(Boolean).length, 2);

  // Cannot lock all 2 open slots (maxLocks = 1) and Slot 2 (idx 2) is not open
  nyx.slots[0].locked = true;
  nyx.slots[1].locked = false;
  assert.equal(rpg.petLockSlot(p, { petUid: nyx.uid, slotIdx: 1, locked: true }).error, 'cannot_lock_all_slots');
  assert.equal(rpg.petLockSlot(p, { petUid: nyx.uid, slotIdx: 2, locked: true }).error, 'slot_not_open');

  // Mythic overwrite protection when an unlocked slot holds a Mythic line
  nyx.slots[0] = { stat: 'power', tier: 'mythic', value: 0.16, locked: false };
  nyx.slots[1] = { stat: 'swiftness', tier: 'epic', value: 0.11, locked: false };
  assert.equal(rpg.petReroll(p, { petUid: nyx.uid }, NOW).error, 'mythic_unlocked');

  // Lock Slot 0 (1 lock = 3,500 Gold + 150 Berries) and reroll Slot 1
  assert.equal(rpg.petLockSlot(p, { petUid: nyx.uid, slotIdx: 0, locked: true }).ok, true);

  const goldBefore = p.gold;
  const berriesBefore = p.berries;
  const essBefore = nyx.essence;
  const rr = rpg.petReroll(p, { petUid: nyx.uid }, NOW, fixed(0.05), { partnerOnline: true });
  assert.equal(rr.ok, true);
  assert.equal(rr.lockCount, 1);
  assert.deepEqual(rr.cost, { gold: 3500, berries: 150 });
  assert.equal(p.gold, goldBefore - 3500);
  assert.equal(p.berries, berriesBefore - 150);
  assert.equal(rr.harmonyTriggered, true);
  assert.equal(nyx.essence, essBefore + PET2.COUPLE_HARMONY_ESSENCE);
  assert.equal(nyx.slots[0].stat, 'power');
  assert.ok(['epic', 'mythic'].includes(nyx.slots[1].tier), 'Couple Harmony guarantees Epic+ on unlocked slot');

  // Second reroll on the same UTC day does not re-trigger Couple Harmony bonus
  const rr2 = rpg.petReroll(p, { petUid: nyx.uid, confirmMythicWipe: true }, NOW + 1000, fixed(0.5), { partnerOnline: true });
  assert.equal(rr2.ok, true);
  assert.equal(rr2.harmonyTriggered, false);
});

test('Pet V2 Universal Starlight Essence Infuse & Release to the Stars', () => {
  const p = fresh('neen'); // owns pet_ragdoll (equipped, ★2) and pet_kitsune (unequipped, ★1, 20 essence)
  const ragdoll = p.pets.find((x) => x.id === 'pet_ragdoll');
  const kitsune = p.pets.find((x) => x.id === 'pet_kitsune');

  // Cannot release equipped pet
  assert.equal(rpg.petRelease(p, { petUid: ragdoll.uid }).error, 'cannot_release_equipped');

  // Release unequipped kitsune -> refunds 10 + floor((0 + 20) * 0.5) = 20 Starlight Essence
  const poolBefore = p.star_essence | 0;
  const rel = rpg.petRelease(p, { petUid: kitsune.uid });
  assert.equal(rel.ok, true);
  assert.equal(rel.gainedEssence, 20);
  assert.equal(p.star_essence, poolBefore + 20);
  assert.equal(p.pets.length, 1);

  // Cannot release last remaining pet
  assert.equal(rpg.petRelease(p, { petUid: ragdoll.uid }).error, 'cannot_release_last_pet');

  // Infuse Universal Starlight Essence into ragdoll (starts at 50 essence, needs 120 for ★3 -> needs 70)
  const inf = rpg.petInfuse(p, { petUid: ragdoll.uid, amount: 70 });
  assert.equal(inf.ok, true);
  assert.equal(inf.amount, 70);
  assert.equal(ragdoll.essence, 120);
  assert.equal(p.star_essence, poolBefore + 20 - 70);

  // Now ragdoll can evolve straight to ★3!
  const evo = rpg.petEvolve(p, { petUid: ragdoll.uid }, fixed(0.2));
  assert.equal(evo.ok, true);
  assert.equal(ragdoll.stars, 3);
});

test('Pet V2 Cozy Features: Nickname Rename, Pat Interaction Cooldown, Daily Gift & Emote Unlocks', () => {
  const p = fresh('nook');
  const nyx = p.pets[0];

  // Rename
  const rn = rpg.petRename(p, { petUid: nyx.uid, nickname: '  <Sir Nyx!>  ' });
  assert.equal(rn.ok, true);
  assert.equal(rn.nickname, 'Sir Nyx!');
  assert.equal(p.equipped.pet.nickname, 'Sir Nyx!');

  // Interact (Pat) + 30s cooldown
  const pat1 = rpg.petInteract(p, { petUid: nyx.uid }, NOW);
  assert.equal(pat1.ok, true);
  assert.equal(rpg.petInteract(p, { petUid: nyx.uid }, NOW + 5_000).error, 'interact_cooldown');
  assert.equal(rpg.petInteract(p, { petUid: nyx.uid }, NOW + 31_000).ok, true);

  // Daily Gift once per UTC day
  const g0 = p.gold, b0 = p.berries;
  const gift1 = rpg.petClaimGift(p, { petUid: nyx.uid }, NOW, fixed(0.1));
  assert.equal(gift1.ok, true);
  assert.ok(p.gold > g0 && p.berries > b0);
  assert.equal(rpg.petClaimGift(p, { petUid: nyx.uid }, NOW + 1000).error, 'already_claimed_today');
  assert.equal(rpg.petClaimGift(p, { petUid: nyx.uid }, NOW + 86_400_000, fixed(0.1)).ok, true);

  // Emote unlock milestones (Bond Lv 1, 2, 4, 6)
  assert.equal(unlockedEmotesForBond(1).length, 2);
  assert.equal(unlockedEmotesForBond(2).length, 4);
  assert.equal(unlockedEmotesForBond(4).length, 6);
  assert.equal(unlockedEmotesForBond(6).length, 8);
});

test('Pet V2 Legacy Migration: 18 V1 species map cleanly into the 4 canonical V2 companions', () => {
  for (const [legacyId, canonicalId] of Object.entries(LEGACY_PET_MAP)) {
    assert.ok(PET_IDS.includes(canonicalId), `${legacyId} -> ${canonicalId}`);
    assert.equal(normalizePetId(legacyId), canonicalId);
  }
  const migrated = migratePetsState({
    pet_night_fury: { stars: 3, trait: 'mythic' },
    pet_mochi_cat: { stars: 2, trait: 'epic' },
  }, 'pet_night_fury', 'bkk', 5);
  assert.equal(migrated.equippedPet, 'pet_nyx');
  assert.equal(migrated.pets.pet_nyx.stars, 3);
  assert.equal(migrated.pets.pet_ragdoll.stars, 2);
  const passives = computePetPassives(migrated.pets.pet_nyx);
  assert.ok(passives.swiftness > 0 || passives.fortune >= 0);
});

test('Pet V2.5 Reconciliation: ★3Lv9 + 2/1 Locked save repairs to Lv20, 1/1 Locked, unlocks Lv15 Costume & merges Monopoly passives', async () => {
  const { playerInfoFromProfile } = await import('../shared/monopoly_rules.js');
  const { OUTFITS } = await import('../shared/costumes_catalog.js');
  const { ACCESSORIES } = await import('../shared/catalog_gear_pets.js');

  const p = createStarterProfile('nook_legacy', '1234', 'bkk');
  p.inventory.s11_zeus_olympus = { refine: 10, dupes: 0 };
  p.pets = [{
    uid: 'pet1',
    id: 'pet_nyx',
    stars: 3,
    visual_tier: 3,
    bond_lv: 9,
    bond_xp: 235,
    active_poses: ['front', 'sleep'],
    slots: [
      { stat: 'power', tier: 'mythic', value: 0.16, locked: true },
      { stat: 'swiftness', tier: 'epic', value: 0.11, locked: true },
      { stat: 'double_jackpot', tier: 'epic', value: 0.10, locked: false },
    ],
  }];
  p.equipped.pet = { uid: 'pet1', id: 'pet_nyx', stars: 3, visual_tier: 3, bond_lv: 9 };

  rpg.migrateRpg(p);
  const nyx = p.pets[0];
  assert.equal(nyx.bond_lv, 20, '★3 Radiant pet reconciled from Lv.9 to Lv.20');
  assert.deepEqual(nyx.active_poses, ['front', 'sleep', 'happy', 'cast'], 'Happy (Lv.10) & Cast (Lv.15) poses auto-added on level reconciliation');
  assert.equal(nyx.slots.filter(Boolean).length, 2, 'Strictly 2 open trait slots');
  assert.equal(nyx.slots.slice(0, 2).filter((s) => s?.locked).length, 1, 'Clamped 2/1 Locked down to 1/1 Locked');

  // Lv.15 Costume Soul-Link is now unlocked and can link s11_zeus_olympus
  const linkRes = rpg.petEquipCostume(p, { petUid: nyx.uid, costumeId: 's11_zeus_olympus' });
  assert.equal(linkRes.ok, true);
  assert.equal(p.equipped.pet.costume_id, 's11_zeus_olympus');

  // Sky Monopoly playerInfoFromProfile merges 2-slot pet passives + Lv.20 Soul-Link scaling + Trait Soul-Link Bonuses
  const { petMatchStats } = await import('../shared/monopoly_rules.js');
  const { computePetSoulLinkBonuses } = await import('../shared/pet_rules.js');
  const info = playerInfoFromProfile(p, { outfits: OUTFITS, accessories: ACCESSORIES });
  assert.equal(info.petBond, 20);
  assert.equal(info.petCostume, 's11_zeus_olympus');
  assert.ok(info.stats.power >= 16, 'Mythic Power (+16%) from Pet Slot 1 merged into Monopoly stats');
  assert.ok(info.stats.swiftness >= 11, 'Epic Swiftness (+11%) from Pet Slot 2 merged into Monopoly stats');

  const slBonuses = computePetSoulLinkBonuses(nyx);
  assert.equal(slBonuses.potencyPct, 16, 'Mythic Power gives +16% Echo');
  assert.equal(slBonuses.ratePct, 11, 'Epic Swiftness gives +11% Charge');
  const baseMs = petMatchStats({ bond: 20 });
  const boostedMs = petMatchStats({ bond: 20, pet: nyx });
  assert.ok(boostedMs.potency > baseMs.potency);
  assert.ok(boostedMs.rate > baseMs.rate);
});

test('Pet Rig V3: Directional back/side/move locomotion & 7-bone skeletal kinematics', async () => {
  const { resolveDirectionalPetPose, computePetBoneState, PET_RIG_VERTEX_SHADER } = await import('../client/js/pet_rig.js');
  const { PetActionDriver } = await import('../client/js/pet_actions.js');

  // 1. Walking or flying UP (vz < 0, away from camera) MUST always show 'back' (never overwritten by 'move')
  for (const loco of ['HOP_WADDLE', 'FLY_FLUTTER', 'FLOAT_SPIRIT', 'SKY_SWIM']) {
    const upPose = resolveDirectionalPetPose({
      vx: 0.3,
      vz: -3.2,
      speed: Math.hypot(0.3, -3.2),
      directionalView: 'back',
      loco,
      walkPhase: 1.2,
    });
    assert.equal(upPose, 'back', `${loco} moving up (-Z) must show 'back' view`);
  }

  // 2. Horizontal movement holds 'move' steadily (zero side <-> move texture strobing across walkPhase)
  for (const phase of [0, Math.PI * 0.25, Math.PI * 0.5, Math.PI, Math.PI * 1.5]) {
    const horizPose = resolveDirectionalPetPose({
      vx: 3.0,
      vz: 0,
      speed: 3.0,
      directionalView: 'front',
      loco: 'FLY_FLUTTER',
      walkPhase: phase,
      currentPose: 'move',
    });
    assert.equal(horizPose, 'move', 'Active horizontal movement holds move pose steadily without strobing');
  }

  // 3. PetActionDriver respects 'back' view when moving up at high speed
  const mockPet = {
    petId: 'pet_nyx',
    loco: 'FLY_FLUTTER',
    t: 1.5,
    walkPhase: 1.5,
    shownView: 'back',
    follower: { vx: 0, vz: -4.0 },
    facing: { turning: false },
    views: {
      front: { fallback: false },
      side: { fallback: false },
      back: { fallback: false },
      move: { fallback: false },
      happy: { fallback: false },
      cast: { fallback: false },
      sleep: { fallback: false },
    },
  };
  const driver = new PetActionDriver(mockPet);
  const upState = driver.update(0.016, 4.0, 'back', { vx: 0, vz: -4.0, walkPhase: 1.5, currentPose: 'back' });
  assert.equal(upState.pose, 'back', 'PetActionDriver must keep back pose when flying up');

  // 4. 7-Bone skeletal solver produces active wing-beats for Nyx and scissor-steps for Ragdoll
  const nyxFlight = computePetBoneState({
    petId: 'pet_nyx',
    loco: 'FLY_FLUTTER',
    pose: 'back',
    t: 0.12,
    speed: 3.8,
    vx: 0,
    vz: -3.8,
    walkWeight: 1,
    walkPhase: 1.2,
  });
  assert.equal(nyxFlight.viewMode, 2, 'back viewMode = 2');
  assert.equal(nyxFlight.locoMode, 1, 'FLY_FLUTTER locoMode = 1');
  assert.ok(Math.abs(nyxFlight.wingFlap) > 0.01, 'Nyx wings actively flap in flight');
  assert.ok(nyxFlight.tailAmp > 0.04, 'Nyx tail S-wave amplitude increases in flight');

  const ragdollWalk = computePetBoneState({
    petId: 'pet_ragdoll',
    loco: 'HOP_WADDLE',
    pose: 'move',
    t: 0.25,
    speed: 3.2,
    vx: 3.2,
    vz: 0,
    walkWeight: 1,
    walkPhase: 0.9,
  });
  assert.ok(Math.abs(ragdollWalk.legL) > 0.1 && Math.abs(ragdollWalk.legR) > 0.1, 'Ragdoll paws scissor-step');
  assert.equal(Math.sign(ragdollWalk.legL), -Math.sign(ragdollWalk.legR), 'Left and right paws step in opposition');
  assert.ok(ragdollWalk.footLiftL > 0 || ragdollWalk.footLiftR > 0, 'Advancing paw lifts off ground');
  assert.ok(PET_RIG_VERTEX_SHADER.includes('uWingFlap') && PET_RIG_VERTEX_SHADER.includes('uFootLiftL'));

  // 5. Frame-to-frame C^1 smoothness check at large elapsed time (t = 180s) while walkWeight ramps 0 -> 1
  const dt = 1 / 60;
  for (const [petId, loco] of [
    ['pet_nyx', 'FLY_FLUTTER'],
    ['pet_ragdoll', 'HOP_WADDLE'],
    ['pet_kitsune', 'FLOAT_SPIRIT'],
    ['pet_skywhale', 'SKY_SWIM'],
  ]) {
    let t = 180.0;
    let w = 0;
    let phase = 1.0;
    let prev = null;
    for (let f = 0; f < 60; f++) {
      t += dt;
      w = Math.min(1, w + dt * 3.5); // rapid acceleration ramp
      phase += dt * (4.8 + w * 4.5);
      const cur = computePetBoneState({
        petId,
        loco,
        pose: 'move',
        t,
        speed: w * 3.5,
        vx: w * 3.5,
        vz: 0,
        walkWeight: w,
        walkPhase: phase,
      });
      if (prev) {
        assert.ok(Math.abs(cur.bobY - prev.bobY) < 0.015, `${petId} bobY smooth delta`);
        assert.ok(Math.abs(cur.wingFlap - prev.wingFlap) < 0.035, `${petId} wingFlap smooth delta (no t*dw/dt vibration)`);
        assert.ok(Math.abs(cur.torso - prev.torso) < 0.025, `${petId} torso smooth delta`);
        assert.ok(Math.abs(cur.legL - prev.legL) < 0.08, `${petId} legL smooth delta`);
      }
      prev = cur;
    }
  }
});


