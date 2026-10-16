// tests/attach.test.js — costume signature parts (Section 22.C): headgear / faceCover / lowerBody visibility rules.
import test from 'node:test';
import assert from 'node:assert/strict';
import { visibleSlotId, outfitHiddenSlots, outfitHem, OUTFIT_FALLBACK } from '../shared/accessory_attach.js';
import { OUTFITS } from '../shared/costumes_catalog.js';

const eq = (outfit) => ({
  outfit: { id: outfit }, hat: { id: 'hat_cat_headset' }, face: { id: 'face_cyber_visor' },
  gloves: { id: 'gloves_vorax_cyan' }, boots: { id: 'boots_hermes_greaves' }, wings: { id: 'wings_pastel_angel' },
});

test('plain costume: every equipped slot is visible; 👁️ hide still hides', () => {
  const e = eq('s8_glacial_elsa');
  for (const s of ['outfit', 'hat', 'face', 'gloves', 'boots', 'wings']) assert.equal(visibleSlotId(e, s), e[s].id);
  e.hat.hide = true;
  assert.equal(visibleSlotId(e, 'hat'), null);
  assert.equal(visibleSlotId({}, 'hat'), null);
});

test('headgear hides the hat, tail hides boots; other slots untouched', () => {
  const naga = eq('s1_naga_sovereign');
  assert.deepEqual(outfitHiddenSlots('s1_naga_sovereign'), { hat: true, face: false, boots: true });
  assert.equal(visibleSlotId(naga, 'hat'), null);
  assert.equal(visibleSlotId(naga, 'boots'), null);
  assert.equal(visibleSlotId(naga, 'face'), 'face_cyber_visor');
  assert.equal(visibleSlotId(naga, 'gloves'), 'gloves_vorax_cyan');
  // hiding the costume itself (👁️) gives the accessories back
  naga.outfit.hide = true;
  assert.equal(visibleSlotId(naga, 'hat'), 'hat_cat_headset');
});

test('gown forces long-hem boot rules; otherwise the sprite hem wins', () => {
  const gown = Object.keys(OUTFITS).find((k) => OUTFITS[k].lowerBody === 'gown');
  if (gown) assert.equal(outfitHem(gown, 'short'), 'long');
  assert.equal(outfitHem('s8_glacial_elsa', 'long'), 'long');
  assert.equal(outfitHem('s8_glacial_elsa', undefined), 'short');
});

test('catalog schema: lowerBody values valid; costumes with signature flags have no tint fallback left', () => {
  for (const [id, o] of Object.entries(OUTFITS)) {
    if (o.lowerBody) assert.ok(['legs', 'tail', 'gown'].includes(o.lowerBody), id);
    if (o.headgear || o.faceCover || o.lowerBody) assert.equal(OUTFIT_FALLBACK[id], undefined, `${id} still uses a fallback`);
  }
});
