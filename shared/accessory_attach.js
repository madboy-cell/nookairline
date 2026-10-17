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
  hat: { bone: 'HEAD', anchor: 'crown', contactY: 0.14, offset: [0, 0], scale: 1.08, offsets: { side: [-0.04, 0], back: [0, 0] }, scales: { side: 0.58, back: 1.08 } },
  face: { bone: 'HEAD', anchor: 'eyes', eyeCenter: [0.58, 0.50], eyeSpan: 0.39, offset: [0, 0], scale: 1.0, frontOnly: true },
  gloves: { bone: 'ARM', anchor: 'hand', offset: [0, 0], scale: 1.0 },
  boots: { bone: 'LEG', offset: [0.055, -0.390], scale: 0.49, offsets: { side: [0.070, -0.388], back: [0.055, -0.390] } },
};

// Canonical 9-bone 2.5D rig proportions shared by Three.js ChibiRig and DOM/UI Paper-Doll stages.
export const RIG_METRICS = {
  CHIBI_HEIGHT: 1.55,
  HEADS_TALL: 2.8,
  HEAD_H: 1.55 / 2.8,
  CROWN_Y: 1.00,
  SKULL_Y: 0.76,      // Forehead/brow & temple equator in HEAD_H for helms, circlets, and diadems (anchor: 'skull')
  EYE_X: 0.116,       // Midpoint X between Left Eye (-0.067) and Right Eye (+0.300) in HEAD_H (3/4 view)
  EYE_Y: 0.529,       // Eye-line Y above NECK_Y in HEAD_H
  EYE_SPAN: 0.367,    // Inter-pupillary distance (Right Eye X - Left Eye X) in HEAD_H
  LEFT_EYE_X: -0.067, // Near/left eye center X in 3/4 view (HEAD_H)
  RIGHT_EYE_X: 0.300, // Far/right eye center X in 3/4 view (HEAD_H)
  HAND_X_FRONT: 0.065,// Wrist/palm center X relative to ARM shoulder pivot in front/back 3/4 view (HEAD_H)
  HAND_X_SIDE: -0.105,// Wrist/palm center X relative to ARM shoulder pivot in 90° side profile (HEAD_H)
  HAND_TIP_Y: -0.71,  // Anatomical fingertip bottom Y relative to ARM shoulder pivot (HEAD_H)
  GLOVE_TARGET_H: 0.49,    // Standard chibi glove height in HEAD_H (anchor: 'hand')
  GAUNTLET_TARGET_H: 0.54, // Standard chibi gauntlet height in HEAD_H (~10% taller than normal glove, anchor: 'gauntlet')
  GLOVE_MAX_W: 0.36,       // Max width cap in HEAD_H so wide cuffs never balloon horizontally
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
    ...(d.anchor ? { anchor: d.anchor, contactY: d.contactY ?? 0.14 } : {}),
    ...(d.contactYs ? { contactYs: { ...d.contactYs } } : {}),
    ...(d.browY !== undefined ? { browY: d.browY } : {}),
    ...(d.browYs ? { browYs: { ...d.browYs } } : {}),
    ...(d.eyeCenter ? { eyeCenter: [...d.eyeCenter] } : {}),
    ...(d.leftEye ? { leftEye: [...d.leftEye] } : {}),
    ...(d.rightEye ? { rightEye: [...d.rightEye] } : {}),
    ...(d.eyeSpan ? { eyeSpan: d.eyeSpan } : {}),
    offset: [...d.offset],
    scale: d.scale,
    ...(d.offsets ? { offsets: JSON.parse(JSON.stringify(d.offsets)) } : {}),
    ...(d.scales ? { scales: { ...d.scales } } : {}),
    views: {
      front: id,
      side: d.frontOnly ? null : `${id}_side`,
      back: d.frontOnly ? null : `${id}_back`,
    },
  };
}

/**
 * Shared bone-relative layout solver for an accessory in `view` ('front' | 'side' | 'back').
 * Handles:
 * - Per-view overrides (`scales[view]`, `offsets[view]`)
 * - Gown hemline boot scaling (`isBoot && longHem`)
 * - Hairstyle crown adaptation (`hairHatFit`), with `hairCover === 'top' | 'helm'` or `anchor === 'skull'` items
 *   ignoring `fit.lift` so full-crown hats and skull helms stay locked to the skull rather than floating above buns.
 * - Bottom-contact crown auto-anchoring (`def.anchor === 'crown'`): automatically places the bottom contact arch
 *   (`contactY` or `contactYs[view]`, default 0.14 from bottom of trimmed PNG) onto `RIG_METRICS.CROWN_Y` (1.00 HEAD_H) + `oy`,
 *   so tall ears and flat tiaras land on the exact same skull crown line out-of-the-box regardless of PNG aspect ratio.
 * - Skull / brow helm auto-anchoring (`def.anchor === 'skull'`): locks the inner brow arch (`browY`, default 0.29 in
 *   front/side, 0.12 in back) directly onto the forehead/temple equator `RIG_METRICS.SKULL_Y` (0.76 HEAD_H) + `oy`.
 * - 2-Point Dual-Eye auto-anchoring (`def.anchor === 'eyes' | 'left_eye' | 'right_eye'`): when `leftEye: [uL, vL]` and
 *   `rightEye: [uR, vR]` (the centroids of the two enclosed lens openings) are provided, solves a full 2D similarity
 *   transform (X, Y, inter-pupil Scale, and horizon-leveling rotation `rotZ`) locking Left Lens -> `LEFT_EYE_X` (-0.067)
 *   and Right Lens -> `RIGHT_EYE_X` (+0.300) at `EYE_Y` (+0.529), completely invariant to temple-arm length or side charms.
 * - Hand & Gauntlet auto-anchoring (`def.anchor === 'hand' | 'gauntlet'`): normalizes total rendered height to
 *   `GLOVE_TARGET_H` (0.49 HEAD_H) for normal gloves or `GAUNTLET_TARGET_H` (0.54 HEAD_H, ~10% larger) for gauntlets,
 *   and locks the fingertips onto `HAND_TIP_Y` (-0.71 HEAD_H) so a gauntlet's extra cuff length always extends up
 *   the forearm toward the elbow rather than hanging below the hand.
 */
export function resolveAccessoryLayout({ def, slot, view = 'front', spriteAspect = 1, hairId = null, longHem = false, bodyMeta = null }) {
  const M = RIG_METRICS;
  const isBoot = def.bone === 'LEG';
  const isSkullHelm = def.anchor === 'skull' || def.hairCover === 'top' || def.hairCover === 'helm' || def.hairCover === 'hood';
  const fit = slot === 'hat' && def.bone === 'HEAD' && hairId ? hairHatFit(hairId, view) : null;
  const baseScale = def.scales?.[view] ?? def.scale;
  let effScale = (isBoot && longHem ? baseScale * M.LONG_HEM_BOOT_SCALE : baseScale) * (fit && !isSkullHelm ? fit.grow : 1);
  const [ox, oy] = def.offsets?.[view] || def.offset;
  let effOx = ox;
  let rotZ = 0;
  // Full-crown hats and skull-hugging helms/diadems sit directly on the skull without lifting for top-buns
  const hairLift = fit && !isSkullHelm ? fit.lift : 0;
  let baseOy = isBoot && longHem ? oy + M.LONG_HEM_BOOT_OY : oy;
  if (def.anchor === 'crown' && def.bone === 'HEAD') {
    const contactY = def.contactYs?.[view] ?? def.contactY ?? 0.14;
    const hInHeads = effScale * spriteAspect;
    baseOy = M.CROWN_Y + (0.5 - contactY) * hInHeads + oy;
  } else if (def.anchor === 'skull' && def.bone === 'HEAD') {
    const browY = def.browYs?.[view] ?? def.browY ?? (view === 'back' ? 0.12 : 0.29);
    const hInHeads = effScale * spriteAspect;
    baseOy = M.SKULL_Y + (0.5 - browY) * hInHeads + oy;
  } else if ((def.anchor === 'eyes' || def.anchor === 'left_eye' || def.anchor === 'right_eye') && def.bone === 'HEAD') {
    const eyeX = (view === 'front' && bodyMeta?.eyeX != null) ? bodyMeta.eyeX : M.EYE_X;
    const eyeY = (view === 'front' && bodyMeta?.eyeY != null) ? bodyMeta.eyeY : M.EYE_Y;
    const eyeSpan = (view === 'front' && bodyMeta?.eyeSpan != null) ? bodyMeta.eyeSpan : M.EYE_SPAN;
    const leftEyeX = (view === 'front' && bodyMeta?.eyeX != null && bodyMeta?.eyeSpan != null)
      ? (bodyMeta.eyeX - 0.5 * bodyMeta.eyeSpan)
      : M.LEFT_EYE_X;
    const rightEyeX = (view === 'front' && bodyMeta?.eyeX != null && bodyMeta?.eyeSpan != null)
      ? (bodyMeta.eyeX + 0.5 * bodyMeta.eyeSpan)
      : M.RIGHT_EYE_X;
    if (def.anchor === 'eyes' && Array.isArray(def.leftEye) && Array.isArray(def.rightEye)) {
      const [uL, vL] = def.leftEye;
      const [uR, vR] = def.rightEye;
      const uMid = 0.5 * (uL + uR);
      const vMid = 0.5 * (vL + vR);
      const du = Math.max(0.1, uR - uL);
      const dv = (vR - vL) * spriteAspect;
      const span = Math.hypot(du, dv);
      effScale = (eyeSpan / span) * baseScale;
      const hInHeads = effScale * spriteAspect;
      rotZ = Math.max(-0.24, Math.min(0.24, -Math.atan2(dv, du)));
      const mx = (uMid - 0.5) * effScale;
      const my = (vMid - 0.5) * hInHeads;
      const cosR = Math.cos(rotZ), sinR = Math.sin(rotZ);
      const mxRot = mx * cosR - my * sinR;
      const myRot = mx * sinR + my * cosR;
      effOx = eyeX - mxRot + ox;
      baseOy = eyeY - myRot + oy;
    } else {
      const [uEye, vEye] = def.eyeCenter || [0.58, 0.50];
      if (def.anchor === 'eyes' && def.eyeSpan) {
        effScale = (eyeSpan / def.eyeSpan) * baseScale;
      }
      const hInHeads = effScale * spriteAspect;
      const targetX = def.anchor === 'left_eye' ? leftEyeX : def.anchor === 'right_eye' ? rightEyeX : eyeX;
      effOx = targetX + (0.5 - uEye) * effScale + ox;
      baseOy = eyeY + (0.5 - vEye) * hInHeads + oy;
    }
  } else if ((def.anchor === 'hand' || def.anchor === 'gauntlet') && def.bone === 'ARM') {
    const mult = baseScale > 0.65 ? baseScale : baseScale / 0.35;
    const targetH = (def.anchor === 'gauntlet' ? M.GAUNTLET_TARGET_H : M.GLOVE_TARGET_H) * mult;
    effScale = Math.min(M.GLOVE_MAX_W * mult, targetH / Math.max(0.8, spriteAspect));
    const hInHeads = effScale * spriteAspect;
    const tipY = def.tipY ?? 0.02;
    effOx = (view === 'side' ? M.HAND_X_SIDE : M.HAND_X_FRONT) + ox;
    baseOy = M.HAND_TIP_Y + (0.5 - tipY) * hInHeads + oy;
  }
  const effOy = baseOy + hairLift;
  return { effScale, ox: effOx, effOy, rotZ };
}

export const ATTACH = {
  hat_straw_explorer: { bone: 'HEAD', hairCover: 'top', offset: [0.01, 0.84], scale: 1.46, offsets: { side: [0.10, 0.84], back: [0.02, 0.80] }, scales: { side: 1.47, back: 1.40 }, views: { front: 'hat_straw_explorer', side: 'hat_straw_explorer_side', back: 'hat_straw_explorer_back' } },
  hat_cat_headset: { bone: 'HEAD', offset: [-0.02, 0.91], scale: 1.22, offsets: { side: [-0.02, 0.92], back: [0, 0.91] }, scales: { side: 0.50, back: 1.22 }, views: { front: 'hat_cat_headset', side: 'hat_cat_headset_side', back: 'hat_cat_headset_back' } },
  hat_glowing_bunny: { bone: 'HEAD', offset: [0, 1.43], scale: 1.09, offsets: { side: [-0.04, 1.34], back: [0, 1.43] }, scales: { side: 0.56, back: 1.09 }, views: { front: 'hat_glowing_bunny', side: 'hat_glowing_bunny_side', back: 'hat_glowing_bunny_back' } },
  face_rosegold_shades: { bone: 'HEAD', anchor: 'eyes', leftEye: [0.405, 0.500], rightEye: [0.790, 0.525], eyeCenter: [0.598, 0.513], eyeSpan: 0.386, offset: [0, 0], scale: 1.0, views: { front: 'face_rosegold_shades', side: null, back: null } },
  face_cyber_visor: { bone: 'HEAD', anchor: 'eyes', leftEye: [0.390, 0.495], rightEye: [0.785, 0.495], eyeCenter: [0.588, 0.495], eyeSpan: 0.395, offset: [0, 0], scale: 1.0, views: { front: 'face_cyber_visor', side: null, back: null } },
  face_oracle_monocle: { bone: 'HEAD', anchor: 'left_eye', eyeCenter: [0.650, 0.440], offset: [0, 0], scale: 0.44, views: { front: 'face_oracle_monocle', side: null, back: null } },
  gloves_cat_mittens: { bone: 'ARM', anchor: 'hand', offset: [0, 0], scale: 1.0, views: { front: 'gloves_cat_mittens', side: 'gloves_cat_mittens', back: 'gloves_cat_mittens' } },
  gloves_vorax_cyan: { bone: 'ARM', anchor: 'gauntlet', offset: [0, 0], scale: 1.0, views: { front: 'gloves_vorax_cyan', side: 'gloves_vorax_cyan', back: 'gloves_vorax_cyan' } },
  gloves_starlight_wand: { bone: 'ARM', singleHand: true, offset: [0.15, -0.44], scale: 0.52, offsets: { side: [0.04, -0.44] }, views: { front: 'gloves_starlight_wand', side: 'gloves_starlight_wand', back: 'gloves_starlight_wand' } },
  boots_slime_rain: { bone: 'LEG', offset: [0.065, -0.390], scale: 0.49, offsets: { side: [0.080, -0.388], back: [0.065, -0.390] }, views: { front: 'boots_slime_rain', side: 'boots_slime_rain', back: 'boots_slime_rain' } },
  boots_hermes_greaves: { bone: 'LEG', offset: [0.045, -0.385], scale: 0.50, offsets: { side: [0.060, -0.378], back: [0.035, -0.385] }, views: { front: 'boots_hermes_greaves', side: 'boots_hermes_greaves', back: 'boots_hermes_greaves' } },
  boots_astral_striders: { bone: 'LEG', offset: [0.075, -0.390], scale: 0.49, offsets: { side: [0.085, -0.388], back: [0.065, -0.390] }, views: { front: 'boots_astral_striders', side: 'boots_astral_striders', back: 'boots_astral_striders' } },
  hat_wolf_ears: { bone: 'HEAD', offset: [0, 1.15], scale: 1.10, offsets: { side: [-0.05, 1.15], back: [0, 1.15] }, scales: { side: 0.60, back: 1.10 }, views: { front: 'hat_wolf_ears', side: 'hat_wolf_ears_side', back: 'hat_wolf_ears_back' } },
  hat_dragon_horns: { bone: 'HEAD', offset: [0, 1.22], scale: 1.18, offsets: { side: [-0.04, 1.18], back: [0, 1.22] }, scales: { side: 0.60, back: 1.18 }, views: { front: 'hat_dragon_horns', side: 'hat_dragon_horns_side', back: 'hat_dragon_horns_back' } },
  back_wolf_tail: { bone: 'HIP', socket: 'hip', offset: [-0.34, 0.88], scale: 0.85, offsets: { back: [0, 0.80] }, scales: { back: 0.60 }, views: { front: 'back_wolf_tail', side: 'back_wolf_tail', back: 'back_wolf_tail_back' } },
  back_dragon_tail: { bone: 'HIP', socket: 'hip', offset: [-0.40, 0.74], scale: 0.95, offsets: { back: [0, 0.74] }, scales: { back: 0.43 }, views: { front: 'back_dragon_tail', side: 'back_dragon_tail', back: 'back_dragon_tail_back' } },
  hat_valkyrie_diadem: { bone: 'HEAD', anchor: 'skull', browY: 0.29, browYs: { back: 0.12 }, offset: [0.01, 0], scale: 1.22, offsets: { side: [-0.02, 0], back: [0, 0] }, scales: { side: 0.76, back: 1.22 }, views: { front: 'hat_valkyrie_diadem', side: 'hat_valkyrie_diadem_side', back: 'hat_valkyrie_diadem_back' } },
  face_starlight_mask: { bone: 'HEAD', anchor: 'eyes', leftEye: [0.485, 0.355], rightEye: [0.840, 0.355], eyeCenter: [0.663, 0.355], eyeSpan: 0.355, offset: [0, 0], scale: 1.0, views: { front: 'face_starlight_mask', side: null, back: null } },
  gloves_valkyrie_gauntlets: { bone: 'ARM', anchor: 'gauntlet', offset: [0, 0], scale: 1.0, views: { front: 'gloves_valkyrie_gauntlets', side: 'gloves_valkyrie_gauntlets', back: 'gloves_valkyrie_gauntlets' } },
  boots_valkyrie_greaves: { bone: 'LEG', offset: [0.055, -0.385], scale: 0.50, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_valkyrie_greaves', side: 'boots_valkyrie_greaves', back: 'boots_valkyrie_greaves' } },
  back_kitsune_star_tail: { bone: 'HIP', socket: 'hip', offset: [-0.42, 0.86], scale: 0.92, offsets: { back: [0, 0.76] }, scales: { back: 0.52 }, views: { front: 'back_kitsune_star_tail', side: 'back_kitsune_star_tail', back: 'back_kitsune_star_tail_back' } },
  back_valkyrie_mantle: { bone: 'TORSO', socket: 'shoulders', offset: [-0.14, -0.10], scale: 1.25, offsets: { side: [-0.16, -0.08], back: [0, -0.20] }, scales: { side: 0.96, back: 1.28 }, views: { front: 'back_valkyrie_mantle', side: 'back_valkyrie_mantle', back: 'back_valkyrie_mantle_back' } },
  // ★3 Mythic Set — Celestial Seraphim Rose
  hat_seraphim_rose_crown: { bone: 'HEAD', anchor: 'skull', browY: 0.25, browYs: { back: 0.16 }, offset: [0.01, 0], scale: 1.28, offsets: { side: [0.06, -0.02], back: [0, 0] }, scales: { side: 0.86, back: 1.28 }, views: { front: 'hat_seraphim_rose_crown', side: 'hat_seraphim_rose_crown_side', back: 'hat_seraphim_rose_crown_back' } },
  face_seraphim_veil_glasses: { bone: 'HEAD', anchor: 'eyes', leftEye: [0.475, 0.430], rightEye: [0.845, 0.420], eyeCenter: [0.660, 0.425], eyeSpan: 0.370, offset: [0, 0], scale: 1.0, views: { front: 'face_seraphim_veil_glasses', side: null, back: null } },
  gloves_seraphim_silk_gauntlets: { bone: 'ARM', anchor: 'gauntlet', offset: [0, 0], scale: 1.0, views: { front: 'gloves_seraphim_silk_gauntlets', side: 'gloves_seraphim_silk_gauntlets', back: 'gloves_seraphim_silk_gauntlets' } },
  boots_seraphim_heels: { bone: 'LEG', offset: [0.055, -0.385], scale: 0.50, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_seraphim_heels', side: 'boots_seraphim_heels', back: 'boots_seraphim_heels' } },
  back_seraphim_nine_tails: { bone: 'HIP', socket: 'hip', offset: [-0.42, 0.86], scale: 0.96, offsets: { back: [0, 0.76] }, scales: { back: 0.54 }, views: { front: 'back_seraphim_nine_tails', side: 'back_seraphim_nine_tails', back: 'back_seraphim_nine_tails_back' } },
  back_seraphim_stardust_veil: { bone: 'TORSO', socket: 'shoulders', offset: [-0.14, -0.10], scale: 1.28, offsets: { side: [-0.16, -0.08], back: [0, -0.20] }, scales: { side: 0.98, back: 1.30 }, views: { front: 'back_seraphim_stardust_veil', side: 'back_seraphim_stardust_veil', back: 'back_seraphim_stardust_veil_back' } },
  // ★2 Epic Set 1 — Sakura Ribbon Princess
  hat_sakura_princess_beret: { bone: 'HEAD', anchor: 'crown', contactY: 0.54, offset: [0, 0], scale: 1.18, offsets: { side: [-0.04, 0], back: [0, 0] }, scales: { side: 0.62, back: 1.18 }, views: { front: 'hat_sakura_princess_beret', side: 'hat_sakura_princess_beret_side', back: 'hat_sakura_princess_beret_back' } },
  face_sakura_blossom_glasses: { bone: 'HEAD', anchor: 'eyes', leftEye: [0.490, 0.415], rightEye: [0.835, 0.525], eyeCenter: [0.663, 0.470], eyeSpan: 0.349, offset: [0, 0], scale: 1.0, views: { front: 'face_sakura_blossom_glasses', side: null, back: null } },
  gloves_sakura_lace_gloves: { bone: 'ARM', anchor: 'hand', offset: [0, 0], scale: 1.0, views: { front: 'gloves_sakura_lace_gloves', side: 'gloves_sakura_lace_gloves', back: 'gloves_sakura_lace_gloves' } },
  boots_sakura_maryjanes: { bone: 'LEG', offset: [0.055, -0.385], scale: 0.49, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_sakura_maryjanes', side: 'boots_sakura_maryjanes', back: 'boots_sakura_maryjanes' } },
  back_sakura_bunny_tail: { bone: 'HIP', socket: 'hip', offset: [-0.42, 0.86], scale: 0.92, offsets: { back: [0, 0.76] }, scales: { back: 0.52 }, views: { front: 'back_sakura_bunny_tail', side: 'back_sakura_bunny_tail', back: 'back_sakura_bunny_tail_back' } },
  back_sakura_capelet: { bone: 'TORSO', socket: 'shoulders', offset: [-0.14, -0.10], scale: 1.24, offsets: { side: [-0.16, -0.08], back: [0, -0.20] }, scales: { side: 0.96, back: 1.26 }, views: { front: 'back_sakura_capelet', side: 'back_sakura_capelet', back: 'back_sakura_capelet_back' } },
  // ★2 Epic Set 2 — Moonlight Crystal Swan
  hat_moonlight_swan_tiara: { bone: 'HEAD', anchor: 'skull', browY: 0.28, browYs: { back: 0.12 }, offset: [0.01, 0], scale: 1.22, offsets: { side: [0.05, -0.02], back: [0, 0] }, scales: { side: 0.84, back: 1.22 }, views: { front: 'hat_moonlight_swan_tiara', side: 'hat_moonlight_swan_tiara_side', back: 'hat_moonlight_swan_tiara_back' } },
  face_moonlight_butterfly_mask: { bone: 'HEAD', anchor: 'eyes', leftEye: [0.470, 0.425], rightEye: [0.840, 0.425], eyeCenter: [0.655, 0.425], eyeSpan: 0.370, offset: [0, 0], scale: 1.0, views: { front: 'face_moonlight_butterfly_mask', side: null, back: null } },
  gloves_moonlight_cuffs: { bone: 'ARM', anchor: 'hand', offset: [0, 0], scale: 1.0, views: { front: 'gloves_moonlight_cuffs', side: 'gloves_moonlight_cuffs', back: 'gloves_moonlight_cuffs' } },
  boots_moonlight_ballet_greaves: { bone: 'LEG', offset: [0.055, -0.385], scale: 0.50, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_moonlight_ballet_greaves', side: 'boots_moonlight_ballet_greaves', back: 'boots_moonlight_ballet_greaves' } },
  back_moonlight_snowleopard_tail: { bone: 'HIP', socket: 'hip', offset: [-0.42, 0.86], scale: 0.92, offsets: { back: [0, 0.76] }, scales: { back: 0.52 }, views: { front: 'back_moonlight_snowleopard_tail', side: 'back_moonlight_snowleopard_tail', back: 'back_moonlight_snowleopard_tail_back' } },
  back_moonlight_chiffon_cloak: { bone: 'TORSO', socket: 'shoulders', offset: [-0.14, -0.10], scale: 1.25, offsets: { side: [-0.16, -0.08], back: [0, -0.20] }, scales: { side: 0.96, back: 1.28 }, views: { front: 'back_moonlight_chiffon_cloak', side: 'back_moonlight_chiffon_cloak', back: 'back_moonlight_chiffon_cloak_back' } },
  // ★3 Mythic Set 2 — Astral Eclipse Archon
  hat_astral_eclipse_crown: { bone: 'HEAD', anchor: 'skull', browY: 0.27, browYs: { back: 0.16 }, offset: [0.01, 0], scale: 1.28, offsets: { side: [0.06, -0.02], back: [0, 0] }, scales: { side: 0.86, back: 1.28 }, views: { front: 'hat_astral_eclipse_crown', side: 'hat_astral_eclipse_crown_side', back: 'hat_astral_eclipse_crown_back' } },
  face_astral_eclipse_visor: { bone: 'HEAD', anchor: 'eyes', leftEye: [0.475, 0.365], rightEye: [0.852, 0.360], eyeCenter: [0.664, 0.363], eyeSpan: 0.377, offset: [0, 0], scale: 1.0, views: { front: 'face_astral_eclipse_visor', side: null, back: null } },
  gloves_astral_eclipse_bracers: { bone: 'ARM', anchor: 'gauntlet', offset: [0, 0], scale: 1.0, views: { front: 'gloves_astral_eclipse_bracers', side: 'gloves_astral_eclipse_bracers', back: 'gloves_astral_eclipse_bracers' } },
  boots_astral_eclipse_sabaton: { bone: 'LEG', offset: [0.055, -0.385], scale: 0.50, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_astral_eclipse_sabaton', side: 'boots_astral_eclipse_sabaton', back: 'boots_astral_eclipse_sabaton' } },
  back_astral_eclipse_comet_tail: { bone: 'HIP', socket: 'hip', offset: [-0.42, 0.86], scale: 0.96, offsets: { back: [0, 0.76] }, scales: { back: 0.54 }, views: { front: 'back_astral_eclipse_comet_tail', side: 'back_astral_eclipse_comet_tail', back: 'back_astral_eclipse_comet_tail_back' } },
  back_astral_eclipse_regalia_cape: { bone: 'TORSO', socket: 'shoulders', offset: [-0.14, -0.10], scale: 1.28, offsets: { side: [-0.16, -0.08], back: [0, -0.20] }, scales: { side: 0.98, back: 1.30 }, views: { front: 'back_astral_eclipse_regalia_cape', side: 'back_astral_eclipse_regalia_cape', back: 'back_astral_eclipse_regalia_cape_back' } },
  // ★2 Epic Set 3 — Emerald Sylvan Windrunner
  hat_sylvan_antler_circlet: { bone: 'HEAD', anchor: 'skull', browY: 0.28, browYs: { back: 0.14 }, offset: [0.01, 0], scale: 1.25, offsets: { side: [0.05, -0.02], back: [0, 0] }, scales: { side: 0.84, back: 1.25 }, views: { front: 'hat_sylvan_antler_circlet', side: 'hat_sylvan_antler_circlet_side', back: 'hat_sylvan_antler_circlet_back' } },
  face_sylvan_leaf_glasses: { bone: 'HEAD', anchor: 'eyes', leftEye: [0.449, 0.445], rightEye: [0.809, 0.445], eyeCenter: [0.629, 0.445], eyeSpan: 0.360, offset: [0, 0], scale: 1.0, views: { front: 'face_sylvan_leaf_glasses', side: null, back: null } },
  gloves_sylvan_wind_bracers: { bone: 'ARM', anchor: 'gauntlet', offset: [0, 0], scale: 1.0, views: { front: 'gloves_sylvan_wind_bracers', side: 'gloves_sylvan_wind_bracers', back: 'gloves_sylvan_wind_bracers' } },
  boots_sylvan_feather_boots: { bone: 'LEG', offset: [0.055, -0.385], scale: 0.50, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_sylvan_feather_boots', side: 'boots_sylvan_feather_boots', back: 'boots_sylvan_feather_boots' } },
  back_sylvan_spirit_deer_tail: { bone: 'HIP', socket: 'hip', offset: [-0.42, 0.86], scale: 0.92, offsets: { back: [0, 0.76] }, scales: { back: 0.52 }, views: { front: 'back_sylvan_spirit_deer_tail', side: 'back_sylvan_spirit_deer_tail', back: 'back_sylvan_spirit_deer_tail_back' } },
  back_sylvan_elven_cloak: { bone: 'TORSO', socket: 'shoulders', offset: [-0.14, -0.10], scale: 1.25, offsets: { side: [-0.16, -0.08], back: [0, -0.20] }, scales: { side: 0.96, back: 1.28 }, views: { front: 'back_sylvan_elven_cloak', side: 'back_sylvan_elven_cloak', back: 'back_sylvan_elven_cloak_back' } },
  // ★2 Epic Set 4 — Crimson Flame Kitsune
  hat_crimson_kitsune_ears: { bone: 'HEAD', anchor: 'crown', contactY: 0.52, contactYs: { side: 0.44, back: 0.52 }, offset: [0, 0], scale: 1.18, offsets: { side: [-0.04, 0], back: [0, 0] }, scales: { side: 0.48, back: 1.18 }, views: { front: 'hat_crimson_kitsune_ears', side: 'hat_crimson_kitsune_ears_side', back: 'hat_crimson_kitsune_ears_back' } },
  face_crimson_kitsune_shades: { bone: 'HEAD', anchor: 'eyes', leftEye: [0.505, 0.515], rightEye: [0.855, 0.560], eyeCenter: [0.680, 0.538], eyeSpan: 0.351, offset: [0, 0], scale: 1.0, views: { front: 'face_crimson_kitsune_shades', side: null, back: null } },
  gloves_crimson_shrine_gloves: { bone: 'ARM', anchor: 'hand', offset: [0, 0], scale: 1.0, views: { front: 'gloves_crimson_shrine_gloves', side: 'gloves_crimson_shrine_gloves', back: 'gloves_crimson_shrine_gloves' } },
  boots_crimson_shrine_greaves: { bone: 'LEG', offset: [0.055, -0.385], scale: 0.49, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_crimson_shrine_greaves', side: 'boots_crimson_shrine_greaves', back: 'boots_crimson_shrine_greaves' } },
  back_crimson_kitsune_tail: { bone: 'HIP', socket: 'hip', offset: [-0.42, 0.86], scale: 0.92, offsets: { back: [0, 0.76] }, scales: { back: 0.52 }, views: { front: 'back_crimson_kitsune_tail', side: 'back_crimson_kitsune_tail', back: 'back_crimson_kitsune_tail_back' } },
  back_crimson_shrine_haori: { bone: 'TORSO', socket: 'shoulders', offset: [-0.14, -0.10], scale: 1.25, offsets: { side: [-0.16, -0.08], back: [0, -0.20] }, scales: { side: 0.96, back: 1.28 }, views: { front: 'back_crimson_shrine_haori', side: 'back_crimson_shrine_haori', back: 'back_crimson_shrine_haori_back' } },
  // ★1 Rare Set 1 — Honey Bear Picnic
  hat_honey_bear_ears: { bone: 'HEAD', anchor: 'crown', contactY: 0.25, contactYs: { side: 0.20, back: 0.28 }, offset: [0, 0], scale: 1.14, offsets: { side: [-0.04, 0], back: [0, 0] }, scales: { side: 0.36, back: 1.14 }, views: { front: 'hat_honey_bear_ears', side: 'hat_honey_bear_ears_side', back: 'hat_honey_bear_ears_back' } },
  face_honey_round_glasses: { bone: 'HEAD', anchor: 'eyes', leftEye: [0.487, 0.445], rightEye: [0.840, 0.615], eyeCenter: [0.664, 0.530], eyeSpan: 0.359, offset: [0, 0], scale: 1.0, views: { front: 'face_honey_round_glasses', side: null, back: null } },
  gloves_honey_bear_mittens: { bone: 'ARM', anchor: 'hand', offset: [0, 0], scale: 1.0, views: { front: 'gloves_honey_bear_mittens', side: 'gloves_honey_bear_mittens', back: 'gloves_honey_bear_mittens' } },
  boots_honey_bear_booties: { bone: 'LEG', offset: [0.055, -0.385], scale: 0.48, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_honey_bear_booties', side: 'boots_honey_bear_booties', back: 'boots_honey_bear_booties' } },
  back_honey_bear_tail: { bone: 'HIP', socket: 'hip', offset: [-0.38, 0.84], scale: 0.86, offsets: { back: [0, 0.76] }, scales: { back: 0.50 }, views: { front: 'back_honey_bear_tail', side: 'back_honey_bear_tail', back: 'back_honey_bear_tail_back' } },
  back_honey_picnic_shawl: { bone: 'TORSO', socket: 'shoulders', offset: [-0.14, -0.10], scale: 1.20, offsets: { side: [-0.16, -0.08], back: [0, -0.20] }, scales: { side: 0.94, back: 1.22 }, views: { front: 'back_honey_picnic_shawl', side: 'back_honey_picnic_shawl', back: 'back_honey_picnic_shawl_back' } },
  // ★1 Rare Set 2 — Cloudy Sheep Slumber
  hat_cloudy_sheep_horns: { bone: 'HEAD', anchor: 'crown', contactY: 0.55, contactYs: { side: 0.50, back: 0.58 }, offset: [0, 0], scale: 1.24, offsets: { side: [-0.04, 0], back: [0, 0] }, scales: { side: 0.54, back: 1.24 }, views: { front: 'hat_cloudy_sheep_horns', side: 'hat_cloudy_sheep_horns_side', back: 'hat_cloudy_sheep_horns_back' } },
  face_cloudy_sleepy_glasses: { bone: 'HEAD', anchor: 'eyes', leftEye: [0.330, 0.470], rightEye: [0.780, 0.590], eyeCenter: [0.555, 0.530], eyeSpan: 0.453, offset: [0, 0], scale: 1.0, views: { front: 'face_cloudy_sleepy_glasses', side: null, back: null } },
  gloves_cloudy_wool_mittens: { bone: 'ARM', anchor: 'hand', offset: [0, 0], scale: 1.0, views: { front: 'gloves_cloudy_wool_mittens', side: 'gloves_cloudy_wool_mittens', back: 'gloves_cloudy_wool_mittens' } },
  boots_cloudy_lamb_slippers: { bone: 'LEG', offset: [0.055, -0.385], scale: 0.48, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_cloudy_lamb_slippers', side: 'boots_cloudy_lamb_slippers', back: 'boots_cloudy_lamb_slippers' } },
  back_cloudy_sheep_tail: { bone: 'HIP', socket: 'hip', offset: [-0.38, 0.84], scale: 0.86, offsets: { back: [0, 0.76] }, scales: { back: 0.50 }, views: { front: 'back_cloudy_sheep_tail', side: 'back_cloudy_sheep_tail', back: 'back_cloudy_sheep_tail_back' } },
  back_cloudy_fleece_capelet: { bone: 'TORSO', socket: 'shoulders', offset: [-0.14, -0.10], scale: 1.20, offsets: { side: [-0.16, -0.08], back: [0, -0.20] }, scales: { side: 0.94, back: 1.22 }, views: { front: 'back_cloudy_fleece_capelet', side: 'back_cloudy_fleece_capelet', back: 'back_cloudy_fleece_capelet_back' } },
  // ★1 Rare Set 3 — Mint Clover Sprout
  hat_clover_beret: { bone: 'HEAD', hairCover: 'top', offset: [0.02, 0.98], scale: 1.36, offsets: { side: [0.01, 0.96], back: [0.00, 0.92] }, scales: { side: 1.38, back: 1.34 }, views: { front: 'hat_clover_beret', side: 'hat_clover_beret_side', back: 'hat_clover_beret_back' } },
  face_clover_wood_glasses: { bone: 'HEAD', anchor: 'eyes', leftEye: [0.450, 0.465], rightEye: [0.827, 0.615], eyeCenter: [0.639, 0.540], eyeSpan: 0.381, offset: [0, 0], scale: 1.0, views: { front: 'face_clover_wood_glasses', side: null, back: null } },
  gloves_clover_garden_gloves: { bone: 'ARM', anchor: 'hand', offset: [0, 0], scale: 1.0, views: { front: 'gloves_clover_garden_gloves', side: 'gloves_clover_garden_gloves', back: 'gloves_clover_garden_gloves' } },
  boots_clover_leather_boots: { bone: 'LEG', offset: [0.055, -0.385], scale: 0.48, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_clover_leather_boots', side: 'boots_clover_leather_boots', back: 'boots_clover_leather_boots' } },
  back_clover_raccoon_tail: { bone: 'HIP', socket: 'hip', offset: [-0.38, 0.84], scale: 0.88, offsets: { back: [0, 0.76] }, scales: { back: 0.50 }, views: { front: 'back_clover_raccoon_tail', side: 'back_clover_raccoon_tail', back: 'back_clover_raccoon_tail_back' } },
  back_clover_traveler_cloak: { bone: 'TORSO', socket: 'shoulders', offset: [-0.14, -0.10], scale: 1.20, offsets: { side: [-0.16, -0.08], back: [0, -0.20] }, scales: { side: 0.94, back: 1.22 }, views: { front: 'back_clover_traveler_cloak', side: 'back_clover_traveler_cloak', back: 'back_clover_traveler_cloak_back' } },
  // ★1 Rare Set 4 — Berry Milk Maid
  hat_berry_maid_headband: { bone: 'HEAD', anchor: 'crown', contactY: 0.40, contactYs: { side: 0.35, back: 0.45 }, offset: [0, 0], scale: 1.16, offsets: { side: [-0.04, 0], back: [0, 0] }, scales: { side: 0.50, back: 1.16 }, views: { front: 'hat_berry_maid_headband', side: 'hat_berry_maid_headband_side', back: 'hat_berry_maid_headband_back' } },
  face_berry_pink_glasses: { bone: 'HEAD', anchor: 'eyes', leftEye: [0.481, 0.455], rightEye: [0.823, 0.615], eyeCenter: [0.652, 0.535], eyeSpan: 0.345, offset: [0, 0], scale: 1.0, views: { front: 'face_berry_pink_glasses', side: null, back: null } },
  gloves_berry_polka_gloves: { bone: 'ARM', anchor: 'hand', offset: [0, 0], scale: 1.0, views: { front: 'gloves_berry_polka_gloves', side: 'gloves_berry_polka_gloves', back: 'gloves_berry_polka_gloves' } },
  boots_berry_ankle_boots: { bone: 'LEG', offset: [0.055, -0.385], scale: 0.48, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_berry_ankle_boots', side: 'boots_berry_ankle_boots', back: 'boots_berry_ankle_boots' } },
  back_berry_cat_tail: { bone: 'HIP', socket: 'hip', offset: [-0.38, 0.84], scale: 0.88, offsets: { back: [0, 0.76] }, scales: { back: 0.46 }, views: { front: 'back_berry_cat_tail', side: 'back_berry_cat_tail', back: 'back_berry_cat_tail_back' } },
  back_berry_apron_cape: { bone: 'TORSO', socket: 'shoulders', offset: [-0.14, -0.10], scale: 1.20, offsets: { side: [-0.16, -0.08], back: [0, -0.20] }, scales: { side: 0.94, back: 1.22 }, views: { front: 'back_berry_apron_cape', side: 'back_berry_apron_cape', back: 'back_berry_apron_cape_back' } },
  // ★3 Mythic Set 3 — Aurora Frost-Spirit Slumber
  hat_aurora_spirit_hood: { bone: 'HEAD', hairCover: 'hood', offset: [-0.04, 0.76], scale: 1.98, offsets: { side: [-0.14, 0.78], back: [0, 0.76] }, scales: { side: 1.44, back: 1.96 }, views: { front: 'hat_aurora_spirit_hood', side: 'hat_aurora_spirit_hood_side', back: 'hat_aurora_spirit_hood_back' } },
  face_aurora_starlight_glasses: { bone: 'HEAD', anchor: 'eyes', leftEye: [0.476, 0.495], rightEye: [0.842, 0.485], eyeCenter: [0.659, 0.490], eyeSpan: 0.366, offset: [0, 0], scale: 1.0, views: { front: 'face_aurora_starlight_glasses', side: null, back: null } },
  gloves_aurora_orb_mitts: { bone: 'ARM', anchor: 'hand', offset: [0, 0], scale: 1.0, views: { front: 'gloves_aurora_orb_mitts', side: 'gloves_aurora_orb_mitts', back: 'gloves_aurora_orb_mitts' } },
  boots_aurora_spirit_slippers: { bone: 'LEG', offset: [0.055, -0.385], scale: 0.50, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_aurora_spirit_slippers', side: 'boots_aurora_spirit_slippers', back: 'boots_aurora_spirit_slippers' } },
  back_aurora_spirit_tail: { bone: 'HIP', socket: 'hip', offset: [-0.42, 0.86], scale: 0.96, offsets: { back: [0, 0.76] }, scales: { back: 0.54 }, views: { front: 'back_aurora_spirit_tail', side: 'back_aurora_spirit_tail', back: 'back_aurora_spirit_tail_back' } },
  back_aurora_starlit_mantle: { bone: 'TORSO', socket: 'shoulders', offset: [-0.14, -0.10], scale: 1.28, offsets: { side: [-0.16, -0.08], back: [0, -0.20] }, scales: { side: 0.98, back: 1.30 }, views: { front: 'back_aurora_starlit_mantle', side: 'back_aurora_starlit_mantle', back: 'back_aurora_starlit_mantle_back' } },
  // ★2 Epic Set 5 — Dreamy Pastel Unicorn Pajama
  hat_unicorn_sleep_hood: { bone: 'HEAD', anchor: 'crown', contactY: 0.44, contactYs: { side: 0.42, back: 0.44 }, offset: [-0.02, 0], scale: 1.22, offsets: { side: [-0.04, 0], back: [0.02, 0] }, scales: { side: 0.92, back: 1.22 }, views: { front: 'hat_unicorn_sleep_hood', side: 'hat_unicorn_sleep_hood_side', back: 'hat_unicorn_sleep_hood_back' } },
  face_unicorn_dream_glasses: { bone: 'HEAD', anchor: 'eyes', leftEye: [0.501, 0.480], rightEye: [0.842, 0.580], eyeCenter: [0.672, 0.530], eyeSpan: 0.344, offset: [0, 0], scale: 1.0, views: { front: 'face_unicorn_dream_glasses', side: null, back: null } },
  gloves_unicorn_paw_mitts: { bone: 'ARM', anchor: 'hand', offset: [0, 0], scale: 1.0, views: { front: 'gloves_unicorn_paw_mitts', side: 'gloves_unicorn_paw_mitts', back: 'gloves_unicorn_paw_mitts' } },
  boots_unicorn_plush_slippers: { bone: 'LEG', offset: [0.055, -0.385], scale: 0.50, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_unicorn_plush_slippers', side: 'boots_unicorn_plush_slippers', back: 'boots_unicorn_plush_slippers' } },
  back_unicorn_rainbow_tail: { bone: 'HIP', socket: 'hip', offset: [-0.42, 0.86], scale: 0.92, offsets: { back: [0, 0.76] }, scales: { back: 0.52 }, views: { front: 'back_unicorn_rainbow_tail', side: 'back_unicorn_rainbow_tail', back: 'back_unicorn_rainbow_tail_back' } },
  back_unicorn_blanket_cape: { bone: 'TORSO', socket: 'shoulders', offset: [-0.14, -0.10], scale: 1.25, offsets: { side: [-0.16, -0.08], back: [0, -0.20] }, scales: { side: 0.96, back: 1.28 }, views: { front: 'back_unicorn_blanket_cape', side: 'back_unicorn_blanket_cape', back: 'back_unicorn_blanket_cape_back' } },
  // ★2 Epic Set 6 — Starlight Bunny Pajama
  hat_starbunny_nightcap: { bone: 'HEAD', anchor: 'crown', contactY: 0.54, contactYs: { side: 0.48, back: 0.54 }, offset: [0, 0], scale: 1.22, offsets: { side: [-0.04, 0], back: [0, 0] }, scales: { side: 0.78, back: 1.22 }, views: { front: 'hat_starbunny_nightcap', side: 'hat_starbunny_nightcap_side', back: 'hat_starbunny_nightcap_back' } },
  face_starbunny_bubble_glasses: { bone: 'HEAD', anchor: 'eyes', leftEye: [0.492, 0.435], rightEye: [0.837, 0.595], eyeCenter: [0.665, 0.515], eyeSpan: 0.351, offset: [0, 0], scale: 1.0, views: { front: 'face_starbunny_bubble_glasses', side: null, back: null } },
  gloves_starbunny_cuffs: { bone: 'ARM', anchor: 'hand', offset: [0, 0], scale: 1.0, views: { front: 'gloves_starbunny_cuffs', side: 'gloves_starbunny_cuffs', back: 'gloves_starbunny_cuffs' } },
  boots_starbunny_slippers: { bone: 'LEG', offset: [0.055, -0.385], scale: 0.50, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_starbunny_slippers', side: 'boots_starbunny_slippers', back: 'boots_starbunny_slippers' } },
  back_starbunny_pom_tail: { bone: 'HIP', socket: 'hip', offset: [-0.40, 0.85], scale: 0.88, offsets: { back: [0, 0.76] }, scales: { back: 0.52 }, views: { front: 'back_starbunny_pom_tail', side: 'back_starbunny_pom_tail', back: 'back_starbunny_pom_tail_back' } },
  back_starbunny_duvet_cape: { bone: 'TORSO', socket: 'shoulders', offset: [-0.14, -0.10], scale: 1.25, offsets: { side: [-0.16, -0.08], back: [0, -0.20] }, scales: { side: 0.96, back: 1.28 }, views: { front: 'back_starbunny_duvet_cape', side: 'back_starbunny_duvet_cape', back: 'back_starbunny_duvet_cape_back' } },
  // ★1 Rare Set 5 — Sleepy Panda Flannel Pajama
  hat_panda_sleep_ears: { bone: 'HEAD', anchor: 'crown', contactY: 0.22, contactYs: { side: 0.26, back: 0.22 }, offset: [0, 0], scale: 1.16, offsets: { side: [-0.02, 0], back: [0, 0] }, scales: { side: 0.58, back: 1.16 }, views: { front: 'hat_panda_sleep_ears', side: 'hat_panda_sleep_ears_side', back: 'hat_panda_sleep_ears_back' } },
  face_panda_bamboo_glasses: { bone: 'HEAD', anchor: 'eyes', leftEye: [0.315, 0.530], rightEye: [0.745, 0.415], eyeCenter: [0.530, 0.473], eyeSpan: 0.435, offset: [0, 0], scale: 1.0, views: { front: 'face_panda_bamboo_glasses', side: null, back: null } },
  gloves_panda_paw_mittens: { bone: 'ARM', anchor: 'hand', offset: [0, 0], scale: 1.0, views: { front: 'gloves_panda_paw_mittens', side: 'gloves_panda_paw_mittens', back: 'gloves_panda_paw_mittens' } },
  boots_panda_slippers: { bone: 'LEG', offset: [0.055, -0.385], scale: 0.49, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_panda_slippers', side: 'boots_panda_slippers', back: 'boots_panda_slippers' } },
  back_panda_pom_tail: { bone: 'HIP', socket: 'hip', offset: [-0.38, 0.84], scale: 0.86, offsets: { back: [0, 0.76] }, scales: { back: 0.50 }, views: { front: 'back_panda_pom_tail', side: 'back_panda_pom_tail', back: 'back_panda_pom_tail_back' } },
  back_panda_flannel_shawl: { bone: 'TORSO', socket: 'shoulders', offset: [-0.14, -0.10], scale: 1.20, offsets: { side: [-0.16, -0.08], back: [0, -0.20] }, scales: { side: 0.94, back: 1.22 }, views: { front: 'back_panda_flannel_shawl', side: 'back_panda_flannel_shawl', back: 'back_panda_flannel_shawl_back' } },
  // ★1 Rare Set 6 — Lemon Duckling Bathrobe & Slippers
  hat_ducky_shower_cap: { bone: 'HEAD', anchor: 'crown', contactY: 0.28, contactYs: { side: 0.28, back: 0.28 }, offset: [0, 0], scale: 1.16, offsets: { side: [-0.02, 0], back: [0, 0] }, scales: { side: 0.62, back: 1.16 }, views: { front: 'hat_ducky_shower_cap', side: 'hat_ducky_shower_cap_side', back: 'hat_ducky_shower_cap_back' } },
  face_ducky_round_glasses: { bone: 'HEAD', anchor: 'eyes', leftEye: [0.489, 0.455], rightEye: [0.834, 0.630], eyeCenter: [0.662, 0.543], eyeSpan: 0.352, offset: [0, 0], scale: 1.0, views: { front: 'face_ducky_round_glasses', side: null, back: null } },
  gloves_ducky_terry_mitts: { bone: 'ARM', anchor: 'hand', offset: [0, 0], scale: 1.0, views: { front: 'gloves_ducky_terry_mitts', side: 'gloves_ducky_terry_mitts', back: 'gloves_ducky_terry_mitts' } },
  boots_ducky_slippers: { bone: 'LEG', offset: [0.055, -0.385], scale: 0.49, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_ducky_slippers', side: 'boots_ducky_slippers', back: 'boots_ducky_slippers' } },
  back_ducky_waddle_tail: { bone: 'HIP', socket: 'hip', offset: [-0.38, 0.84], scale: 0.86, offsets: { back: [0, 0.76] }, scales: { back: 0.50 }, views: { front: 'back_ducky_waddle_tail', side: 'back_ducky_waddle_tail', back: 'back_ducky_waddle_tail_back' } },
  back_ducky_towel_cape: { bone: 'TORSO', socket: 'shoulders', offset: [-0.14, -0.10], scale: 1.20, offsets: { side: [-0.16, -0.08], back: [0, -0.20] }, scales: { side: 0.94, back: 1.22 }, views: { front: 'back_ducky_towel_cape', side: 'back_ducky_towel_cape', back: 'back_ducky_towel_cape_back' } },
  // ★1 Rare Set 7 — Peach Kitty Striped Pajama
  hat_kitty_nightcap: { bone: 'HEAD', anchor: 'crown', contactY: 0.25, contactYs: { side: 0.22, back: 0.25 }, offset: [0, 0], scale: 1.16, offsets: { side: [-0.04, 0], back: [0, 0] }, scales: { side: 0.44, back: 1.16 }, views: { front: 'hat_kitty_nightcap', side: 'hat_kitty_nightcap_side', back: 'hat_kitty_nightcap_back' } },
  face_kitty_whisker_glasses: { bone: 'HEAD', anchor: 'eyes', leftEye: [0.471, 0.445], rightEye: [0.819, 0.575], eyeCenter: [0.645, 0.510], eyeSpan: 0.352, offset: [0, 0], scale: 1.0, views: { front: 'face_kitty_whisker_glasses', side: null, back: null } },
  gloves_kitty_pajama_mitts: { bone: 'ARM', anchor: 'hand', offset: [0, 0], scale: 1.0, views: { front: 'gloves_kitty_pajama_mitts', side: 'gloves_kitty_pajama_mitts', back: 'gloves_kitty_pajama_mitts' } },
  boots_kitty_slippers: { bone: 'LEG', offset: [0.055, -0.385], scale: 0.49, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_kitty_slippers', side: 'boots_kitty_slippers', back: 'boots_kitty_slippers' } },
  back_kitty_sleepy_tail: { bone: 'HIP', socket: 'hip', offset: [-0.38, 0.84], scale: 0.88, offsets: { back: [0, 0.76] }, scales: { back: 0.48 }, views: { front: 'back_kitty_sleepy_tail', side: 'back_kitty_sleepy_tail', back: 'back_kitty_sleepy_tail_back' } },
  back_kitty_pajama_capelet: { bone: 'TORSO', socket: 'shoulders', offset: [-0.14, -0.10], scale: 1.20, offsets: { side: [-0.16, -0.08], back: [0, -0.20] }, scales: { side: 0.94, back: 1.22 }, views: { front: 'back_kitty_pajama_capelet', side: 'back_kitty_pajama_capelet', back: 'back_kitty_pajama_capelet_back' } },
  // ★2 Epic & ★1 Rare Girly Couture Footwear Collection
  boots_sweetheart_patissier: { bone: 'LEG', offset: [0.055, -0.385], scale: 0.49, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_sweetheart_patissier', side: 'boots_sweetheart_patissier', back: 'boots_sweetheart_patissier' } },
  boots_magical_star_witch: { bone: 'LEG', offset: [0.055, -0.385], scale: 0.49, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_magical_star_witch', side: 'boots_magical_star_witch', back: 'boots_magical_star_witch' } },
  boots_swan_ballet_prima: { bone: 'LEG', offset: [0.055, -0.385], scale: 0.49, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_swan_ballet_prima', side: 'boots_swan_ballet_prima', back: 'boots_swan_ballet_prima' } },
  boots_alice_wonder_teaparty: { bone: 'LEG', offset: [0.055, -0.385], scale: 0.49, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_alice_wonder_teaparty', side: 'boots_alice_wonder_teaparty', back: 'boots_alice_wonder_teaparty' } },
  boots_fairy_blossom_nympha: { bone: 'LEG', offset: [0.055, -0.385], scale: 0.49, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_fairy_blossom_nympha', side: 'boots_fairy_blossom_nympha', back: 'boots_fairy_blossom_nympha' } },
  boots_lollipop_angel_nurse: { bone: 'LEG', offset: [0.055, -0.385], scale: 0.49, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_lollipop_angel_nurse', side: 'boots_lollipop_angel_nurse', back: 'boots_lollipop_angel_nurse' } },
  boots_pink_bean_slippers: { bone: 'LEG', offset: [0.055, -0.430], scale: 0.52, offsets: { side: [0.070, -0.422], back: [0.045, -0.430] }, views: { front: 'boots_pink_bean_slippers', side: 'boots_pink_bean_slippers', back: 'boots_pink_bean_slippers' } },
  boots_henesys_mushroom_sneakers: { bone: 'LEG', offset: [0.055, -0.385], scale: 0.49, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_henesys_mushroom_sneakers', side: 'boots_henesys_mushroom_sneakers', back: 'boots_henesys_mushroom_sneakers' } },
  boots_slime_pudding_wellies: { bone: 'LEG', offset: [0.055, -0.385], scale: 0.49, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_slime_pudding_wellies', side: 'boots_slime_pudding_wellies', back: 'boots_slime_pudding_wellies' } },
  boots_peach_milk_maryjanes: { bone: 'LEG', offset: [0.055, -0.385], scale: 0.49, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_peach_milk_maryjanes', side: 'boots_peach_milk_maryjanes', back: 'boots_peach_milk_maryjanes' } },
  boots_cinnamon_bunny_loafers: { bone: 'LEG', offset: [0.055, -0.385], scale: 0.51, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_cinnamon_bunny_loafers', side: 'boots_cinnamon_bunny_loafers', back: 'boots_cinnamon_bunny_loafers' } },
  boots_strawberry_picnic_shoes: { bone: 'LEG', offset: [0.055, -0.385], scale: 0.49, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_strawberry_picnic_shoes', side: 'boots_strawberry_picnic_shoes', back: 'boots_strawberry_picnic_shoes' } },
  boots_lavender_cloud_slippers: { bone: 'LEG', offset: [0.055, -0.430], scale: 0.52, offsets: { side: [0.070, -0.422], back: [0.045, -0.430] }, views: { front: 'boots_lavender_cloud_slippers', side: 'boots_lavender_cloud_slippers', back: 'boots_lavender_cloud_slippers' } },
  boots_honey_bee_maryjanes: { bone: 'LEG', offset: [0.055, -0.385], scale: 0.49, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_honey_bee_maryjanes', side: 'boots_honey_bee_maryjanes', back: 'boots_honey_bee_maryjanes' } },
  boots_sleepywood_sakura_geta: { bone: 'LEG', offset: [0.055, -0.385], scale: 0.49, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_sleepywood_sakura_geta', side: 'boots_sleepywood_sakura_geta', back: 'boots_sleepywood_sakura_geta' } },
  boots_aquaroad_sailor_shoes: { bone: 'LEG', offset: [0.055, -0.385], scale: 0.49, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_aquaroad_sailor_shoes', side: 'boots_aquaroad_sailor_shoes', back: 'boots_aquaroad_sailor_shoes' } },
  // ★2 Epic & ★1 Rare Dark-Fantasy, Steampunk, Abyssal, Cyber & Elemental Gloves & Boots
  gloves_nocturne_vampire_claws: { bone: 'ARM', anchor: 'gauntlet', offset: [0, 0], scale: 1.0, views: { front: 'gloves_nocturne_vampire_claws', side: 'gloves_nocturne_vampire_claws', back: 'gloves_nocturne_vampire_claws' } },
  gloves_chronos_aether_gauntlets: { bone: 'ARM', anchor: 'gauntlet', offset: [0, 0], scale: 1.0, views: { front: 'gloves_chronos_aether_gauntlets', side: 'gloves_chronos_aether_gauntlets', back: 'gloves_chronos_aether_gauntlets' } },
  gloves_abyssal_tide_bracers: { bone: 'ARM', anchor: 'gauntlet', offset: [0, 0], scale: 1.0, views: { front: 'gloves_abyssal_tide_bracers', side: 'gloves_abyssal_tide_bracers', back: 'gloves_abyssal_tide_bracers' } },
  gloves_monarch_maple_gloves: { bone: 'ARM', anchor: 'hand', offset: [0, 0], scale: 1.0, views: { front: 'gloves_monarch_maple_gloves', side: 'gloves_monarch_maple_gloves', back: 'gloves_monarch_maple_gloves' } },
  gloves_cyber_matrix_gloves: { bone: 'ARM', anchor: 'hand', offset: [0, 0], scale: 1.0, views: { front: 'gloves_cyber_matrix_gloves', side: 'gloves_cyber_matrix_gloves', back: 'gloves_cyber_matrix_gloves' } },
  gloves_magma_drake_gauntlets: { bone: 'ARM', anchor: 'gauntlet', offset: [0, 0], scale: 1.0, views: { front: 'gloves_magma_drake_gauntlets', side: 'gloves_magma_drake_gauntlets', back: 'gloves_magma_drake_gauntlets' } },
  gloves_shadow_shinobi_wraps: { bone: 'ARM', anchor: 'hand', offset: [0, 0], scale: 1.0, views: { front: 'gloves_shadow_shinobi_wraps', side: 'gloves_shadow_shinobi_wraps', back: 'gloves_shadow_shinobi_wraps' } },
  gloves_stained_glass_cuffs: { bone: 'ARM', anchor: 'hand', offset: [0, 0], scale: 1.0, views: { front: 'gloves_stained_glass_cuffs', side: 'gloves_stained_glass_cuffs', back: 'gloves_stained_glass_cuffs' } },
  gloves_venom_alchemist_gloves: { bone: 'ARM', anchor: 'hand', offset: [0, 0], scale: 1.0, views: { front: 'gloves_venom_alchemist_gloves', side: 'gloves_venom_alchemist_gloves', back: 'gloves_venom_alchemist_gloves' } },
  boots_nocturne_vampire_sabaton: { bone: 'LEG', offset: [0.055, -0.385], scale: 0.50, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_nocturne_vampire_sabaton', side: 'boots_nocturne_vampire_sabaton', back: 'boots_nocturne_vampire_sabaton' } },
  boots_chronos_steampunk_greaves: { bone: 'LEG', offset: [0.055, -0.385], scale: 0.50, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_chronos_steampunk_greaves', side: 'boots_chronos_steampunk_greaves', back: 'boots_chronos_steampunk_greaves' } },
  boots_abyssal_siren_greaves: { bone: 'LEG', offset: [0.055, -0.385], scale: 0.50, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_abyssal_siren_greaves', side: 'boots_abyssal_siren_greaves', back: 'boots_abyssal_siren_greaves' } },
  boots_monarch_maple_boots: { bone: 'LEG', offset: [0.055, -0.385], scale: 0.49, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_monarch_maple_boots', side: 'boots_monarch_maple_boots', back: 'boots_monarch_maple_boots' } },
  boots_cyber_matrix_kicks: { bone: 'LEG', offset: [0.055, -0.385], scale: 0.49, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_cyber_matrix_kicks', side: 'boots_cyber_matrix_kicks', back: 'boots_cyber_matrix_kicks' } },
  boots_magma_drake_stompers: { bone: 'LEG', offset: [0.055, -0.385], scale: 0.50, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_magma_drake_stompers', side: 'boots_magma_drake_stompers', back: 'boots_magma_drake_stompers' } },
  boots_shadow_shinobi_tabi: { bone: 'LEG', offset: [0.055, -0.385], scale: 0.49, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_shadow_shinobi_tabi', side: 'boots_shadow_shinobi_tabi', back: 'boots_shadow_shinobi_tabi' } },
  boots_stained_glass_sabaton: { bone: 'LEG', offset: [0.055, -0.385], scale: 0.49, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_stained_glass_sabaton', side: 'boots_stained_glass_sabaton', back: 'boots_stained_glass_sabaton' } },
  boots_venom_alchemist_boots: { bone: 'LEG', offset: [0.055, -0.385], scale: 0.49, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_venom_alchemist_boots', side: 'boots_venom_alchemist_boots', back: 'boots_venom_alchemist_boots' } },
};

export const OUTFIT_FALLBACK = {
  newbie_outfit:        { base: 'base',             tint: [1.0, 1.0, 1.0], filter: 'none' },
};

const HAIR_REF_HEAD = {
  front: { diam: 0.893, cx: 0.000, top: 1.104 },
  side:  { diam: 0.862, cx: -0.025, top: 1.112 },
  back:  { diam: 0.908, cx: 0.000, top: 1.105 },
};

/**
 * Shared bone-relative layout solver for a hairstyle in `view` ('front' | 'side' | 'back').
 * Adapts the calibrated 3/4-right / 90°-side / 3/4-back wig dimensions to the active body
 * sprite's skull dome (`headDiam`, `headCX`, `headTop` from `asset_manifest.json` or base-body
 * fallback) so both Men (`bkk`/`boy`) and Women (`dxb`/`girl`) across base bodies and Mythic
 * costumes share identical crown/temple/face alignment in 3D WebGL (`ChibiRig`) and 2D DOM.
 */
export function resolveHairLayout({ def, view = 'front', spriteAspect = 1, bodyMeta = null, isBase = false }) {
  const v = view === 'lifted' ? 'front' : view;
  const ref = HAIR_REF_HEAD[v] || HAIR_REF_HEAD.front;
  const baseScale = def.scales?.[v] ?? def.scale;
  const [baseOx, baseOy] = def.offsets?.[v] || def.offset;
  const headFit = bodyMeta?.headDiam
    ? Math.min(1.06, Math.max(0.75, bodyMeta.headDiam / ref.diam))
    : (isBase && v === 'front' ? 0.96 : 1.0);
  const headDx = bodyMeta?.headCX != null && v !== 'front' ? (bodyMeta.headCX - ref.cx) : 0;
  let wH, hH, ox, oy;
  if (v === 'front') {
    wH = baseScale * (isBase ? 0.96 : 1.0);
    hH = baseScale * spriteAspect;
    ox = baseOx;
    oy = baseOy;
  } else if (v === 'side') {
    wH = baseScale * headFit;
    hH = baseScale * spriteAspect * headFit;
    ox = baseOx * headFit + headDx;
    oy = baseOy * headFit + ref.top * (1 - headFit);
  } else {
    wH = baseScale * headFit;
    hH = baseScale * spriteAspect;
    ox = baseOx + headDx;
    oy = baseOy;
  }
  return { wH, hH, ox, oy };
}

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

  // Check if equipped hat covers the top of the hair (e.g. hat_straw_explorer)
  const hatId = visId('hat');
  const hatDef = hatId ? getAttachDef(hatId, 'hat') : null;
  const topCoverHat = Boolean(hatDef?.hairCover === 'top' && hatDef?.views?.[v]);

  // Hair layer (head-parented wig sprite)
  const HAIR_FRONT_DIMS = {
    hair_boy_fluffy: [290, 246], hair_girl_waves: [261, 322], hair_bob_blunt: [273, 263],
    hair_spiky_hero: [294, 275], hair_parted_curtains: [294, 237], hair_wolf_shag: [297, 291],
    hair_high_ponytail: [275, 298], hair_twin_tails: [322, 317], hair_double_buns: [314, 274],
    hair_hime_straight: [252, 308], hair_braided_crown: [254, 330], hair_half_up_bun: [272, 298],
    hair_royal_drill_ribbons: [307, 291], hair_royal_sakura_braid: [243, 331], hair_royal_starlight_bob: [302, 246],
    hair_royal_prince_feather: [295, 314], hair_royal_butterfly_updo: [288, 321], hair_royal_moon_ponytail: [251, 306],
    hair_celestial_seraph: [454, 367], hair_celestial_empress: [412, 338],
  };
  let hairLayer = null;
  if (hairId) {
    const hDef = hairAttach(hairId);
    const hSprite = hairSpriteName(hairId, v);
    const fbDims = HAIR_FRONT_DIMS[hairId] || [280, 280];
    const hMeta = getSpriteInfo(hSprite) || getSpriteInfo(hairSpriteName(hairId, 'front')) || { w: fbDims[0], h: fbDims[1], file: `chibi/${hSprite}.png`, faces: 'right' };
    const isBase = !outfitId || outfitId === 'newbie_outfit' || (!directMeta && (!fb?.base || fb.base === 'base'));
    const { wH, hH, ox, oy } = resolveHairLayout({
      def: hDef,
      view: v,
      spriteAspect: hMeta.h / hMeta.w,
      bodyMeta,
      isBase,
    });
    const wM = wH * HEAD_H;
    const hM = hH * HEAD_H;
    const hFlip = right === (hMeta.faces !== 'left') ? 1 : -1;
    const resolved = resolveHairColor(hairColor, hairId);
    const neckV = Math.min(1, Math.max(0, 0.5 + (-0.04 - oy) / hH));
    const chinUvY = Math.min(1, Math.max(neckV, 0.5 + (0.18 - oy) / hH));
    const chinCssY = Math.min(100, Math.max(0, (1 - chinUvY) * 100));
    const neckCssY = Math.min(100, Math.max(chinCssY, (1 - neckV) * 100));
    const xLeftPct = Math.min(100, Math.max(0, (0.5 + (-0.08 - ox) / wH) * 100));
    const xRightPct = Math.min(100, Math.max(xLeftPct, (0.5 + (0.31 - ox) / wH) * 100));
    const frontClipPolygon = v !== 'front'
      ? 'none'
      : `polygon(0% 0%, 100% 0%, 100% ${neckCssY.toFixed(1)}%, ${xRightPct.toFixed(1)}% ${neckCssY.toFixed(1)}%, ${xRightPct.toFixed(1)}% ${chinCssY.toFixed(1)}%, ${xLeftPct.toFixed(1)}% ${chinCssY.toFixed(1)}%, ${xLeftPct.toFixed(1)}% ${neckCssY.toFixed(1)}%, 0% ${neckCssY.toFixed(1)}%)`;
    hairLayer = {
      id: hairId,
      colorId: resolved.id,
      hex: resolved.hex,
      hex2: resolved.hex2,
      url: `/assets/${hMeta.file || `chibi/${hSprite}.png`}`,
      cxPct: ((bones.HEAD.x + ox * HEAD_H * (v === 'back' ? 1 : flip)) / H) * 100,
      cyPct: ((bones.HEAD.y + oy * HEAD_H) / H) * 100,
      wPct: (wM / H) * 100,
      hPct: (hM / H) * 100,
      scaleX: hFlip,
      clipTopHat: topCoverHat,
      neckClipPct: +(neckV * 100).toFixed(1),
      frontClipPolygon,
      zIndex: 15, // above body & boots/gloves, below facewear (16) and headwear (18)
    };
  }

  // Wings / Back slot layer (split into left/right halves around spine pivot, or hip/shoulders socket for tails & capes)
  let wings = null;
  const wingsId = visId('wings');
  if (wingsId) {
    const tailDef = getAttachDef(wingsId, 'wings');
    if (tailDef?.socket === 'hip' || tailDef?.socket === 'shoulders') {
      const tSprite = tailDef.views?.[v] || tailDef.views?.front || wingsId;
      const tMeta = getSpriteInfo(tSprite) || { w: 280, h: 280, file: `chibi/${tSprite}.png` };
      const wM = (tailDef.scales?.[v] ?? tailDef.scale) * HEAD_H;
      const hM = (wM * tMeta.h) / tMeta.w;
      const [ox, oy] = tailDef.offsets?.[v] || tailDef.offset;
      const baseBoneY = tailDef.socket === 'shoulders' ? M.SHOULDER_Y * H : 0;
      wings = {
        id: wingsId,
        socket: tailDef.socket,
        url: `/assets/${tMeta.file || `chibi/${tSprite}.png`}`,
        cxPct: ((ox * HEAD_H * flip) / H) * 100,
        cyPct: ((baseBoneY + oy * HEAD_H) / H) * 100,
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

  // Accessory layers in painter's order (boots -> gloves -> hat -> face, so glasses/masks sit over helm temple guards)
  const order = { boots: 1, gloves: 2, hat: 3, face: 4 };
  const items = [];
  let maskFeet = 0;

  for (const slot of ['boots', 'gloves', 'hat', 'face']) {
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
      const spriteAspect = (sMeta.h || 250) / (sMeta.w || 250);
      const { effScale, ox, effOy, rotZ = 0 } = resolveAccessoryLayout({
        def,
        slot,
        view: v,
        spriteAspect,
        hairId,
        longHem,
        bodyMeta,
      });
      const wM = effScale * HEAD_H;
      const hM = wM * spriteAspect;

      const isGlove = def.bone === 'ARM' && !def.singleHand;
      const scaleSign = isBoot || def.singleHand ? flip : isGlove && sideView ? -flip : sideView || side === 0 ? flip : side;
      const posSign = isBoot || def.singleHand || sideView || side === 0 ? flip : side;
      const stepY = isBoot ? (side === flip ? -0.008 : 0.008) : 0;
      const armTiltRad = isGlove && !sideView ? -side * 0.14 : rotZ * scaleSign;

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

