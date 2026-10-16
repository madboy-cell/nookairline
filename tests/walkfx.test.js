// tests/walkfx.test.js — node:test suite for Signature Walk FX (W6)
import test from 'node:test';
import assert from 'node:assert/strict';
import { OUTFITS } from '../shared/costumes_catalog.js';
import {
  VALID_FX_CELLS,
  getWalkFx,
  getEquippedWalkFx,
  shouldEmitRemoteStep,
  shouldEmitRemoteTrail,
  getTrailOffset,
  CROWD_TRAIL_THRESHOLD,
  CROWD_STEP_THRESHOLD,
} from '../shared/walk_fx.js';

const EXPECTED_MYTHIC_IDS = [
  's1_naga_sovereign',
  's2_kitsune_inari',
  's2_tsukuyomi_eclipse',
  's3_sultan_djinn',
  's3_dune_phoenix',
  's4_casino_royale',
  's5_atlantis_siren',
  's6_astral_sovereign',
  's7_cinderella_clock',
  's8_glacial_elsa',
  's9_pharaoh_ra',
  's10_phantom_masque',
  's11_zeus_olympus',
];

test('every ★3 outfit has walkFx and exactly 13 Mythic outfits exist', () => {
  const mythics = Object.entries(OUTFITS).filter(([_, o]) => o.rarity === 3);
  assert.equal(mythics.length, 13, `expected 13 mythic outfits, found ${mythics.length}`);

  for (const id of EXPECTED_MYTHIC_IDS) {
    const o = OUTFITS[id];
    assert.ok(o, `outfit ${id} not found in OUTFITS`);
    assert.equal(o.rarity, 3, `outfit ${id} should be rarity 3`);
    assert.ok(o.walkFx, `outfit ${id} is missing walkFx`);
  }
});

test('every stepCell and trailCell belongs to the 16 atlas cells', () => {
  assert.equal(VALID_FX_CELLS.length, 16);
  for (const [id, o] of Object.entries(OUTFITS)) {
    if (o.rarity === 3) {
      const { stepCell, trailCell } = o.walkFx;
      assert.ok(
        VALID_FX_CELLS.includes(stepCell),
        `outfit ${id} stepCell '${stepCell}' not in VALID_FX_CELLS`
      );
      assert.ok(
        VALID_FX_CELLS.includes(trailCell),
        `outfit ${id} trailCell '${trailCell}' not in VALID_FX_CELLS`
      );
    }
  }
});

test('tints are 3 numbers in [0, 1.5] and motion parameters are valid finite numbers', () => {
  for (const [id, o] of Object.entries(OUTFITS)) {
    if (o.rarity === 3) {
      const fx = o.walkFx;
      assert.ok(Array.isArray(fx.tint) && fx.tint.length === 3, `outfit ${id} tint must be [r,g,b]`);
      for (const c of fx.tint) {
        assert.equal(typeof c, 'number', `outfit ${id} tint component must be number`);
        assert.ok(c >= 0 && c <= 1.5, `outfit ${id} tint component ${c} out of range [0, 1.5]`);
      }
      for (const field of ['up', 'speed', 'gravity', 'size', 'life']) {
        assert.equal(typeof fx[field], 'number', `outfit ${id} ${field} must be a number`);
        assert.ok(Number.isFinite(fx[field]), `outfit ${id} ${field} must be finite`);
      }
    }
  }
});

test('no non-mythic outfit has walkFx', () => {
  for (const [id, o] of Object.entries(OUTFITS)) {
    if (o.rarity !== 3) {
      assert.equal(o.walkFx, undefined, `non-mythic outfit ${id} should not have walkFx`);
    }
  }
});

test('pure helpers: getWalkFx and getEquippedWalkFx', () => {
  assert.equal(getWalkFx(null), null);
  assert.equal(getWalkFx('non_existent'), null);
  assert.equal(getWalkFx('newbie_outfit'), null);

  const elsa = getWalkFx('s8_glacial_elsa');
  assert.ok(elsa);
  assert.equal(elsa.stepCell, 'fx_snowflake');
  assert.equal(elsa.trailCell, 'fx_stardust');
  assert.deepEqual(elsa.tint, [0.6, 0.9, 1.0]);

  const zeus = getEquippedWalkFx({ outfit: { id: 's11_zeus_olympus' } });
  assert.ok(zeus);
  assert.equal(zeus.stepCell, 'fx_lightning');
  assert.equal(zeus.trailCell, 'fx_shockwave');

  assert.equal(getEquippedWalkFx({ outfit: { id: 'newbie_outfit' } }), null);
  assert.equal(getEquippedWalkFx(null), null);
  assert.equal(getEquippedWalkFx({}), null);
});

test('pure helpers: crowd budget functions', () => {
  assert.equal(shouldEmitRemoteTrail(CROWD_TRAIL_THRESHOLD), true);
  assert.equal(shouldEmitRemoteTrail(CROWD_TRAIL_THRESHOLD + 1), false);
  assert.equal(shouldEmitRemoteTrail(100), true);
  assert.equal(shouldEmitRemoteTrail(300), false);

  assert.equal(shouldEmitRemoteStep(CROWD_STEP_THRESHOLD), true);
  assert.equal(shouldEmitRemoteStep(CROWD_STEP_THRESHOLD + 1), false);
  assert.equal(shouldEmitRemoteStep(200), true);
  assert.equal(shouldEmitRemoteStep(350), false);
});

test('pure helpers: getTrailOffset vector calculation', () => {
  const zero = getTrailOffset(0, 0, 0.2);
  assert.deepEqual(zero, { x: 0, z: 0 });

  // Moving east (+x): trail should be behind to the west (-x)
  const east = getTrailOffset(4, 0, 0.2);
  assert.ok(Math.abs(east.x - (-0.2)) < 1e-6);
  assert.ok(Math.abs(east.z) < 1e-6);

  // Moving south (+z): trail should be behind to the north (-z)
  const south = getTrailOffset(0, 3, 0.15);
  assert.ok(Math.abs(south.x) < 1e-6);
  assert.ok(Math.abs(south.z - (-0.15)) < 1e-6);
});
