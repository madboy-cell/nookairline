// shared/accessory_attach.js — paper-doll attach data (Implementation Plan Section 22.F).
// attach: { bone, offset: [x, y] in head-heights from the bone pivot, scale (sprite WIDTH in head-heights),
//           views: { front, side, back } sprite name or null (null = hidden in that view) }
// Optional per-view offset overrides: offsets: { side: [x, y], back: [x, y] }.
// GENERATED/UPDATED by the dev dress-up calibration page (?dev=1&dressup=1 → POST /api/dev/attach).
// Hand edits are fine; keep the format: one JSON object per line inside ATTACH.
// Default Socket Box per slot (MapleStory modular fallback): any future accessory added to
// catalog_gear_pets.js without an explicit ATTACH entry automatically snaps into its slot socket.
import { OUTFITS } from './costumes_catalog.js';
import { ACCESSORIES } from './catalog_gear_pets.js';
import { hairSpriteName, hairAttach, hairHatFit, resolveHairColor } from './hair_catalog.js';

/**
 * Costume signature parts (Section 22.C catalog schema): a costume whose own art includes a headdress
 * (`headgear`), a face mask (`faceCover`) or a non-leg lower body (`lowerBody: 'tail'`) visually replaces
 * that accessory slot. The accessory stays equipped and keeps its stats; it is only not drawn.
 * Shared by the 3D ChibiRig and the 2D wardrobe paper doll so both always agree.
 */
export function outfitHiddenSlots(outfitId) {
  const o = OUTFITS[outfitId] || {};
  return { hat: !!o.headgear, face: !!o.faceCover, boots: o.lowerBody === 'tail' };
}
/** Visible item id for `slot` (null when empty, hidden by the 👁️ toggle, or replaced by the costume's own art). */
export function visibleSlotId(equipped, slot) {
  const e = equipped?.[slot];
  if (!e?.id || e.hide) return null;
  if (slot !== 'outfit' && outfitHiddenSlots(visibleSlotId(equipped, 'outfit'))[slot]) return null;
  return e.id;
}
/** Hem for boot fitting: `lowerBody: 'gown'` forces the long-hem rules regardless of the sliced sprite's auto hem. */
export const outfitHem = (outfitId, spriteHem) => (OUTFITS[outfitId]?.lowerBody === 'gown' ? 'long' : spriteHem || 'short');
export const DEFAULT_SLOT_ATTACH = {
  hat: { bone: 'HEAD', offset: [0, 0.60], scale: 1.05 },
  face: { bone: 'HEAD', offset: [0.058, 0.470], scale: 0.98, frontOnly: true },
  gloves: { bone: 'ARM', offset: [0.01, -0.58], scale: 0.31 },
  boots: { bone: 'LEG', offset: [0.055, -0.435], scale: 0.43 },
};

// Canonical 9-bone 2.5D rig proportions shared by Three.js ChibiRig and DOM/UI Paper-Doll stages.
export const RIG_METRICS = {
  CHIBI_HEIGHT: 1.55,
  HEADS_TALL: 2.8,
  HEAD_H: 1.55 / 2.8,
  HIP_Y: 0.25,
  WAIST_Y: 0.36,
  SHOULDER_Y: 0.55,
  NECK_Y: 0.60,
  ARM_X_FRONT: 0.38,
  ARM_X_SIDE: 0.02,
  LEG_X_FRONT: 0.175,
  LEG_X_SIDE: 0.13,
  WING_Y_FRONT: 0.55,
  WING_Y_BACK: 0.52,
  WING_SCALE: 1.22,
  WING_SCALE_BY_RARITY: { 1: 1.05, 2: 1.25, 3: 1.34 },
  WING_SCALE_BY_ID: {
    wings_pastel_angel: 1.05,      // ★1 Rare: 0.87m wingspan (1.57x HEAD_H)
    wings_crystal_butterfly: 1.45, // ★2 Epic: 1.08m wingspan (compensates for X-shaped butterfly waist pinch)
    wings_golden_seraphim: 1.34,   // ★3 Mythic: 1.12m wingspan (2.03x HEAD_H)
  },
  LONG_HEM_BOOT_SCALE: 0.84,
  LONG_HEM_BOOT_OY: -0.02,
  LONG_HEM_CLIP_TOP_UV: 0.56,
};

/** Rarity-based wing scale (★1 Rare -> ★2 Epic -> ★3 Mythic). */
export function getWingScale(id) {
  if (RIG_METRICS.WING_SCALE_BY_ID[id]) return RIG_METRICS.WING_SCALE_BY_ID[id];
  const r = ACCESSORIES[id]?.rarity || 2;
  return RIG_METRICS.WING_SCALE_BY_RARITY[r] ?? RIG_METRICS.WING_SCALE;
}

export function getAttachDef(id, slot) {
  if (!id) return null;
  if (ATTACH[id]) return ATTACH[id];
  const d = DEFAULT_SLOT_ATTACH[slot];
  if (!d) return null;
  return {
    bone: d.bone,
    offset: [...d.offset],
    scale: d.scale,
    views: { front: id, side: d.frontOnly ? null : id, back: d.frontOnly ? null : id },
  };
}

export const ATTACH = {
  hat_straw_explorer: { bone: 'HEAD', hairCover: 'top', offset: [0.01, 0.84], scale: 1.46, offsets: { side: [0.10, 0.84], back: [0.02, 0.80] }, scales: { side: 1.47, back: 1.40 }, views: { front: 'hat_straw_explorer', side: 'hat_straw_explorer_side', back: 'hat_straw_explorer_back' } },
  hat_cat_headset: { bone: 'HEAD', offset: [0, 0.76], scale: 1.14, offsets: { side: [-0.02, 0.76], back: [0, 0.76] }, scales: { side: 0.47, back: 1.08 }, views: { front: 'hat_cat_headset', side: 'hat_cat_headset_side', back: 'hat_cat_headset_back' } },
  hat_glowing_bunny: { bone: 'HEAD', offset: [0, 1.04], scale: 0.96, offsets: { side: [-0.14, 1.04], back: [0, 1.04] }, scales: { side: 0.50, back: 0.95 }, views: { front: 'hat_glowing_bunny', side: 'hat_glowing_bunny_side', back: 'hat_glowing_bunny_back' } },
  face_rosegold_shades: { bone: 'HEAD', offset: [0.058, 0.470], scale: 0.98, views: { front: 'face_rosegold_shades', side: null, back: null } },
  face_cyber_visor: { bone: 'HEAD', offset: [0.083, 0.492], scale: 0.98, views: { front: 'face_cyber_visor', side: null, back: null } },
  face_oracle_monocle: { bone: 'HEAD', offset: [-0.116, 0.478], scale: 0.44, views: { front: 'face_oracle_monocle', side: null, back: null } },
  gloves_cat_mittens: { bone: 'ARM', offset: [0.065, -0.50], scale: 0.40, offsets: { side: [-0.11, -0.50], back: [0.065, -0.50] }, views: { front: 'gloves_cat_mittens', side: 'gloves_cat_mittens', back: 'gloves_cat_mittens' } },
  gloves_vorax_cyan: { bone: 'ARM', offset: [0.065, -0.50], scale: 0.40, offsets: { side: [-0.11, -0.50], back: [0.065, -0.50] }, views: { front: 'gloves_vorax_cyan', side: 'gloves_vorax_cyan', back: 'gloves_vorax_cyan' } },
  gloves_starlight_wand: { bone: 'ARM', singleHand: true, offset: [0.15, -0.44], scale: 0.52, offsets: { side: [0.04, -0.44] }, views: { front: 'gloves_starlight_wand', side: 'gloves_starlight_wand', back: 'gloves_starlight_wand' } },
  boots_slime_rain: { bone: 'LEG', offset: [0.065, -0.390], scale: 0.49, offsets: { side: [0.080, -0.388], back: [0.065, -0.390] }, views: { front: 'boots_slime_rain', side: 'boots_slime_rain', back: 'boots_slime_rain' } },
  boots_hermes_greaves: { bone: 'LEG', offset: [0.045, -0.385], scale: 0.50, offsets: { side: [0.060, -0.378], back: [0.035, -0.385] }, views: { front: 'boots_hermes_greaves', side: 'boots_hermes_greaves', back: 'boots_hermes_greaves' } },
  boots_astral_striders: { bone: 'LEG', offset: [0.075, -0.390], scale: 0.49, offsets: { side: [0.085, -0.388], back: [0.065, -0.390] }, views: { front: 'boots_astral_striders', side: 'boots_astral_striders', back: 'boots_astral_striders' } },
  hat_wolf_ears: { bone: 'HEAD', offset: [0, 0.98], scale: 1.06, offsets: { side: [-0.08, 0.98], back: [0, 0.98] }, scales: { side: 0.62, back: 1.06 }, views: { front: 'hat_wolf_ears', side: 'hat_wolf_ears_side', back: 'hat_wolf_ears_back' } },
  hat_dragon_horns: { bone: 'HEAD', offset: [0, 0.98], scale: 1.05, offsets: { side: [-0.08, 1.06], back: [0, 0.98] }, scales: { side: 0.56, back: 1.07 }, views: { front: 'hat_dragon_horns', side: 'hat_dragon_horns_side', back: 'hat_dragon_horns_back' } },
  back_wolf_tail: { bone: 'HIP', socket: 'hip', offset: [-0.34, 0.88], scale: 0.85, offsets: { back: [0, 0.80] }, scales: { back: 0.60 }, views: { front: 'back_wolf_tail', side: 'back_wolf_tail', back: 'back_wolf_tail_back' } },
  back_dragon_tail: { bone: 'HIP', socket: 'hip', offset: [-0.40, 0.74], scale: 0.95, offsets: { back: [0, 0.74] }, scales: { back: 0.43 }, views: { front: 'back_dragon_tail', side: 'back_dragon_tail', back: 'back_dragon_tail_back' } },
};

export const OUTFIT_FALLBACK = {
  newbie_outfit:        { base: 'base',             tint: [1.0, 1.0, 1.0], filter: 'none' },
};

/**
 * Pure mathematical bone-layout solver shared between 3D ChibiRig and 2D DOM Paper-Doll previews.
 * Returns normalized percentages (where 100% height = CHIBI_HEIGHT standing figure height) so any
 * UI stage can position hats, glasses, gloves, weapons, boots, and flapping wings identically to WebGL.
 */
export function computePaperDollParts({
  lineage = 'bkk',
  equipped = {},
  hair = undefined,
  hairColor = 'chestnut',
  view = 'front',
  right = true,
  getSpriteInfo = () => null,
} = {}) {
  const M = RIG_METRICS;
  const H = M.CHIBI_HEIGHT;
  const HEAD_H = M.HEAD_H;
  const v = view === 'lifted' ? 'front' : view;
  const flip = right ? 1 : -1;
  const sideView = v === 'side';
  const isGirl = lineage === 'dxb' || lineage === 'girl';
  const hairId = hair === undefined ? (isGirl ? 'hair_girl_waves' : 'hair_boy_fluffy') : hair;

  const visId = (slot) => visibleSlotId(equipped, slot);   // 👁️ hide + costume signature parts (headgear / tail)
  const outfitId = visId('outfit') || 'newbie_outfit';

  // Resolve body sprite & hemline from asset_manifest.json (falls back to mapped silhouette or lineage base sprite)
  const baseFrontMeta = getSpriteInfo(`${lineage}_base_front`) || { w: 240, h: 420, hem: 'short', faces: 'right' };
  const customBodyKey = `${lineage}_${outfitId}_${v}`;
  const fb = OUTFIT_FALLBACK[outfitId];
  const fbBodyKey = fb?.base && fb.base !== 'base' ? `${lineage}_${fb.base}_${v}` : `${lineage}_base_${v}`;
  const baseBodyKey = `${lineage}_base_${v}`;
  const directMeta = outfitId !== 'newbie_outfit' ? getSpriteInfo(customBodyKey) : null;
  const bodyMeta = directMeta || getSpriteInfo(fbBodyKey) || getSpriteInfo(baseBodyKey) || baseFrontMeta;
  const bodyFilter = !directMeta && fb?.filter ? fb.filter : 'none';
  const bodyHem = outfitHem(outfitId, bodyMeta.hem);
  const longHem = bodyHem === 'long' && !sideView;
  const bodyAspect = (bodyMeta.w || 240) / (bodyMeta.h || 420);
  const bodyNativeRight = bodyMeta.faces !== 'left';
  const bodyMirror = right === bodyNativeRight ? 1 : -1;

  // Bone pivots in world metres (origin = bottom-center between feet)
  const armX = (sideView ? M.ARM_X_SIDE : M.ARM_X_FRONT) * HEAD_H;
  const legX = (sideView ? M.LEG_X_SIDE : M.LEG_X_FRONT) * HEAD_H;
  const bones = {
    HEAD: { x: 0, y: M.NECK_Y * H },
    ARM_L: { x: -armX, y: M.SHOULDER_Y * H },
    ARM_R: { x: armX, y: M.SHOULDER_Y * H },
    LEG_L: { x: -legX, y: M.HIP_Y * H },
    LEG_R: { x: legX, y: M.HIP_Y * H },
  };

  // Hair layer (head-parented wig sprite)
  let hairLayer = null;
  if (hairId) {
    const hDef = hairAttach(hairId);
    const hSprite = hairSpriteName(hairId, v);
    const hMeta = getSpriteInfo(hSprite) || getSpriteInfo(hairSpriteName(hairId, 'front')) || { w: 320, h: 320, file: `chibi/${hSprite}.png`, faces: 'right' };
    const wM = (hDef.scales?.[v] ?? hDef.scale) * HEAD_H;
    const hM = (wM * hMeta.h) / hMeta.w;
    const [ox, oy] = hDef.offsets?.[v] || hDef.offset;
    const hFlip = right === (hMeta.faces !== 'left') ? 1 : -1;
    const resolved = resolveHairColor(hairColor, hairId);
    hairLayer = {
      id: hairId,
      colorId: resolved.id,
      hex: resolved.hex,
      hex2: resolved.hex2,
      url: `/assets/${hMeta.file || `chibi/${hSprite}.png`}`,
      cxPct: ((bones.HEAD.x + ox * HEAD_H * hFlip) / H) * 100,
      cyPct: ((bones.HEAD.y + oy * HEAD_H) / H) * 100,
      wPct: (wM / H) * 100,
      hPct: (hM / H) * 100,
      scaleX: hFlip,
      zIndex: 15, // above body & boots/gloves, below facewear (16) and headwear (18)
    };
  }

  // Wings / Back slot layer (split into left/right halves around spine pivot, or hip socket for tails)
  let wings = null;
  const wingsId = visId('wings');
  if (wingsId) {
    const tailDef = getAttachDef(wingsId, 'wings');
    if (tailDef?.socket === 'hip') {
      const tSprite = tailDef.views?.[v] || tailDef.views?.front || wingsId;
      const tMeta = getSpriteInfo(tSprite) || { w: 280, h: 280, file: `chibi/${tSprite}.png` };
      const wM = (tailDef.scales?.[v] ?? tailDef.scale) * HEAD_H;
      const hM = (wM * tMeta.h) / tMeta.w;
      const [ox, oy] = tailDef.offsets?.[v] || tailDef.offset;
      wings = {
        id: wingsId,
        socket: 'hip',
        url: `/assets/${tMeta.file || `chibi/${tSprite}.png`}`,
        cxPct: ((ox * HEAD_H * flip) / H) * 100,
        cyPct: ((oy * HEAD_H) / H) * 100,
        wPct: (wM / H) * 100,
        hPct: (hM / H) * 100,
        scaleX: flip,
        inFrontOfBody: v === 'back',
      };
    } else {
      const wMeta = getSpriteInfo(wingsId) || { w: 330, h: 260, file: `chibi/${wingsId}.png` };
      const ppm = H / (baseFrontMeta.h || 420);
      const wingScale = getWingScale(wingsId);
      const wM = wMeta.w * ppm * wingScale * (sideView ? 0.55 : 1);
      const hM = wMeta.h * ppm * wingScale;
      const wyM = H * (v === 'back' ? M.WING_Y_BACK : M.WING_Y_FRONT);
      const wxM = sideView ? (right ? -0.12 : 0.12) : 0;
      wings = {
        id: wingsId,
        url: `/assets/${wMeta.file || `chibi/${wingsId}.png`}`,
        cxPct: (wxM / H) * 100,
        cyPct: (wyM / H) * 100,
        wPct: (wM / H) * 100,
        hPct: (hM / H) * 100,
        inFrontOfBody: v === 'back',
      };
    }
  }

  // Accessory layers in painter's order (boots -> gloves -> face -> hat)
  const order = { boots: 1, gloves: 2, face: 3, hat: 4 };
  const items = [];
  let maskFeet = 0;

  for (const slot of ['boots', 'gloves', 'face', 'hat']) {
    const id = visId(slot);
    if (!id) continue;
    const def = getAttachDef(id, slot);
    if (!def) continue;
    const spriteName = def.views?.[v];
    if (!spriteName) continue;
    const sMeta = getSpriteInfo(spriteName) || {
      w: slot === 'face' ? 300 : slot === 'hat' ? 330 : 210,
      h: slot === 'face' ? 105 : slot === 'hat' ? 290 : 250,
      file: `chibi/${spriteName}.png`,
    };
    const isBoot = def.bone === 'LEG';
    const sides = def.bone === 'ARM' || def.bone === 'LEG' ? [-1, 1] : [0];

    for (const side of sides) {
      const hiddenSide = ((sideView && !isBoot) || def.singleHand) && side !== 0 && side !== flip;
      if (hiddenSide) continue;

      if (isBoot) maskFeet = longHem ? 2 : 1;
      const fit = slot === 'hat' && def.bone === 'HEAD' && hairId ? hairHatFit(hairId, v) : null;
      const baseScale = def.scales?.[v] ?? def.scale;
      const effScale = (isBoot && longHem ? baseScale * M.LONG_HEM_BOOT_SCALE : baseScale) * (fit ? fit.grow : 1);
      const wM = effScale * HEAD_H;
      const hM = (wM * sMeta.h) / sMeta.w;
      const [ox, oy] = def.offsets?.[v] || def.offset;
      const effOy = (isBoot && longHem ? oy + M.LONG_HEM_BOOT_OY : oy) + (fit ? fit.lift : 0);

      const isGlove = def.bone === 'ARM' && !def.singleHand;
      const scaleSign = isBoot || def.singleHand ? flip : isGlove && sideView ? -flip : sideView || side === 0 ? flip : side;
      const posSign = isBoot || def.singleHand || sideView || side === 0 ? flip : side;
      const stepY = isBoot ? (side === flip ? -0.008 : 0.008) : 0;
      const armTiltRad = isGlove && !sideView ? -side * 0.14 : 0;

      const bone =
        def.bone === 'HEAD'
          ? bones.HEAD
          : def.bone === 'ARM'
          ? side < 0
            ? bones.ARM_L
            : bones.ARM_R
          : side < 0
          ? bones.LEG_L
          : bones.LEG_R;

      const cxM = bone.x + ox * HEAD_H * posSign;
      const cyM = bone.y + (effOy + stepY) * HEAD_H;

      items.push({
        slot,
        id,
        side,
        url: `/assets/${sMeta.file || `chibi/${spriteName}.png`}`,
        cxPct: (cxM / H) * 100,
        cyPct: (cyM / H) * 100,
        wPct: (wM / H) * 100,
        hPct: (hM / H) * 100,
        scaleX: scaleSign,
        // Three.js +Z rotation is counter-clockwise; CSS rotate() is clockwise
        rotDeg: +((-armTiltRad * 180) / Math.PI).toFixed(2),
        clipLongBoot: Boolean(isBoot && longHem),
        zIndex: 10 + order[slot] * 2 + (isBoot && side === flip ? 1 : 0),
      });
    }
  }

  return {
    body: {
      outfitId,
      url: `/assets/${bodyMeta.file || `chibi/${lineage}_base_front.png`}`,
      wPct: bodyAspect * 100,
      hPct: 100,
      hem: bodyHem,
      longHem,
      maskFeet,
      scaleX: bodyMirror,
      filter: bodyFilter,
    },
    hair: hairLayer,
    wings,
    items,
  };
}

