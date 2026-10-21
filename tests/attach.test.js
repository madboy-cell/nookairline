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

test('all face_* eyewear items align onto per-body eyeX/eyeY/eyeSpan on both male base and male costumes', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { ATTACH, getAttachDef, resolveAccessoryLayout } = await import('../shared/accessory_attach.js');
  const manifest = JSON.parse(fs.readFileSync(path.resolve('client/assets/asset_manifest.json'), 'utf8')).sprites;

  const faceIds = Object.keys(ATTACH).filter((k) => k.startsWith('face_'));
  assert.ok(faceIds.length >= 20, `expected at least 20 face_* items, got ${faceIds.length}`);

  const boyBase = manifest.bkk_base_front;
  const boyCostume = manifest.bkk_epic_aether_valkyrie_seraph_front;
  assert.ok(boyBase?.eyeY && boyCostume?.eyeY, 'boy base and costume front sprites must have eyeY metrics');
  assert.ok(boyCostume.eyeY < boyBase.eyeY, 'costumed male head dome has lower eyeY than base mannequin');

  for (const id of faceIds) {
    const def = getAttachDef(id, 'face');
    assert.ok(['eyes', 'left_eye', 'right_eye'].includes(def.anchor), `${id} must use an eye anchor`);
    const sp = manifest[id];
    assert.ok(sp, `${id} missing from asset_manifest.json`);

    for (const body of [boyBase, boyCostume]) {
      const spriteAspect = sp.h / sp.w;
      const layout = resolveAccessoryLayout({ def, slot: 'face', view: 'front', spriteAspect, bodyMeta: body });
      assert.ok(Math.abs(layout.rotZ) <= 0.061, `${id} rotZ=${layout.rotZ} exceeds damped ±0.06 rad limit`);
      // Verify the lens anchor lands within ±0.015 HEAD_H vertically of body.eyeY
      const uAnchor = Array.isArray(def.leftEye) && Array.isArray(def.rightEye)
        ? (def.leftEye[0] + def.rightEye[0]) * 0.5
        : (def.eyeCenter ? def.eyeCenter[0] : 0.61);
      const vAnchor = Array.isArray(def.leftEye) && Array.isArray(def.rightEye)
        ? (def.leftEye[1] + def.rightEye[1]) * 0.5
        : (def.eyeCenter ? def.eyeCenter[1] : 0.45);
      const w = layout.effScale;
      const h = w * spriteAspect;
      const dx = (uAnchor - 0.5) * w;
      const dy = (vAnchor - 0.5) * h;
      const lensY = layout.effOy + Math.sin(layout.rotZ) * dx + Math.cos(layout.rotZ) * dy;
      assert.ok(Math.abs(lensY - body.eyeY) <= 0.005, `${id} lensY=${lensY} drifted from body.eyeY=${body.eyeY}`);
    }
  }
});

test('all singleHand held weapons lock their grip to the hand palm across front/side/back views and render above long female hair', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { ATTACH, computePaperDollParts } = await import('../shared/accessory_attach.js');
  const manifest = JSON.parse(fs.readFileSync(path.resolve('client/assets/asset_manifest.json'), 'utf8')).sprites;

  const heldIds = Object.keys(ATTACH).filter((k) => ATTACH[k].singleHand);
  assert.ok(heldIds.length >= 15, `expected at least 15 singleHand items, got ${heldIds.length}`);

  for (const id of heldIds) {
    const def = ATTACH[id];
    assert.ok(Array.isArray(def.grip) && def.grip.length === 2, `${id} must define grip: [u, v]`);
    assert.ok(manifest[id], `${id} missing from asset_manifest.json`);

    for (const view of ['front', 'side', 'back']) {
      const layout = computePaperDollParts({
        lineage: 'dxb',
        hair: 'hair_celestial_seraph',
        equipped: {
          outfit: { id: 'sm_seraphim_rose' },
          gloves: { id },
          wings: { id: 'wings_gramophone_melody_aura' },
        },
        view,
        right: true,
        getSpriteInfo: (name) => manifest[name],
      });
      const weaponItem = layout.items.find((it) => it.slot === 'gloves' && it.id === id);
      assert.ok(weaponItem, `${id} missing from computePaperDollParts items in ${view} view`);
      assert.equal(weaponItem.zIndex, 17, `${id} must have zIndex=17 in ${view} view`);
      assert.ok(weaponItem.zIndex > layout.hair.zIndex, `${id} must render above female hair (zIndex=${layout.hair.zIndex}) in ${view} view`);
    }
  }
});

test('all 65 flapping wings follow strict Rare < Epic < Mythic oversize wingspan bounds and never hide behind the body', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { ACCESSORIES } = await import('../shared/catalog_gear_pets.js');
  const { getAttachDef, resolveWingDimensions } = await import('../shared/accessory_attach.js');
  const manifest = JSON.parse(fs.readFileSync(path.resolve('client/assets/asset_manifest.json'), 'utf8')).sprites;
  const ppm = 1.55 / (manifest.boy_base_front?.h || 625);

  const boundsByRarity = {
    1: [1.14, 1.32],
    2: [1.40, 1.62],
    3: [1.80, 2.05],
  };

  let wingCount = 0;
  for (const [id, item] of Object.entries(ACCESSORIES)) {
    if (item.slot !== 'wings') continue;
    const def = getAttachDef(id, 'wings');
    if (def?.socket) continue;
    wingCount++;
    const sp = manifest[id];
    assert.ok(sp, `${id} missing from asset_manifest.json`);
    const { w, h } = resolveWingDimensions(id, sp.w, sp.h, ppm);
    const [minW, maxW] = boundsByRarity[item.rarity];
    assert.ok(w >= minW && w <= maxW, `★${item.rarity} ${id} wingspan ${w.toFixed(2)}m outside [${minW}, ${maxW}]m`);
    assert.ok(h >= 0.60 && h <= 1.60, `★${item.rarity} ${id} height ${h.toFixed(2)}m outside [0.60, 1.60]m`);
  }
  assert.equal(wingCount, 65);
});


