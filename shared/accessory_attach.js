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
/** Visible item id for `slot` (null when empty, hidden by the 👁️ toggle, or replaced by the costume's own art). Resolves Glamour override first (`glamour[slot] ?? equipped.glamour[slot] ?? equipped[slot].glamour ?? equipped[slot].id`). */
export function visibleSlotId(equipped, slot, glamour = null) {
  const e = equipped?.[slot];
  if (e?.hide) return null;
  const gId = glamour?.[slot] ?? equipped?.glamour?.[slot] ?? e?.glamour ?? null;
  const id = gId || e?.id || null;
  if (!id) return null;
  if (slot !== 'outfit' && outfitHiddenSlots(visibleSlotId(equipped, 'outfit', glamour))[slot]) return null;
  return id;
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
  WING_SCALE: 1.28,
  WING_SCALE_BY_RARITY: { 1: 1.12, 2: 1.34, 3: 1.48 },
  WING_SCALE_BY_ID: {
    // ★1 Rare Full-Wear Set wings (sliced from 247..267px 4-col cells -> normalized to ~1.22m..1.27m / 2.20x..2.29x HEAD_H)
    wings_pomeranian_bubble_tub: 2.02,
    wings_matcha_whisk_dango_aura: 1.98,
    wings_floating_spellbooks_owl: 1.96,
    wings_macaron_ribbon_wreath: 1.96,
    wings_firefly_lotus_lanterns: 1.96,
    wings_lavender_potion_shelf: 1.96,
    wings_peach_seashell_bubbles: 1.95,
    wings_strawberry_pie_lattice: 1.94,
    wings_sunflower_bloom_halo: 1.94,
    wings_toy_trumpet_drum_aura: 1.94,
    wings_neon_diner_jukebox: 1.92,
    wings_bamboo_red_panda_wreath: 1.92,
    wings_marimo_bubble_rings: 1.92,
    wings_yarn_spool_heart_aura: 1.92,
    wings_paper_cloud_rainbow_aura: 1.92,
    // ★1 Rare legacy wings normalized to ~1.18m..1.23m span
    wings_pastel_angel: 1.44,              // ★1 Rare: 1.20m wingspan (up from 0.87m)
    wings_stained_glass_prism: 1.18,       // ★1 Rare: 1.18m wingspan
    wings_honey_bee: 1.18,                 // ★1 Rare: 1.19m wingspan

    // ★2 Epic Full-Wear Set wings (sliced from 255..267px 4-col cells -> normalized to ~1.52m..1.55m / 2.75x..2.80x HEAD_H)
    wings_stained_glass_cathedral: 2.44,
    wings_chocolate_gold_foil_aura: 2.40,
    wings_porcelain_marionette_strings: 2.40,
    wings_perfume_elixir_bottles: 2.34,
    wings_sugar_blown_pegasus: 2.36,
    wings_floating_teapots_aura: 2.34,
    wings_actias_luna_moth: 2.36,
    wings_celestial_harp_strings: 2.34,
    wings_snowglobe_carillon_halo: 2.34,
    wings_magic_carpet_tassel_aura: 2.34,
    // ★2 Epic mid-width & butterfly wings normalized to ~1.47m..1.50m span
    wings_crystal_butterfly: 2.02,         // ★2 Epic: 1.50m wingspan (up from 1.08m)
    wings_chronos_clockwork_gears: 1.52,   // ★2 Epic: 1.47m wingspan
    wings_jellyfish_pastel_float: 1.48,    // ★2 Epic: 1.47m wingspan
    wings_lunar_valkyrie: 1.50,            // ★2 Epic: 1.49m wingspan
    wings_moonlight_swan: 1.50,            // ★2 Epic: 1.49m wingspan
    wings_sylvan_emerald_zephyr: 1.50,     // ★2 Epic: 1.50m wingspan

    // ★3 Mythic Oversize 6-wing sets (~1.86m..1.99m / 3.36x..3.60x HEAD_H)
    wings_golden_seraphim: 2.24,           // ★3 Mythic: 1.88m oversize 6-wing span (up from 1.12m)
    wings_seraphim_rose_six: 1.72,         // ★3 Mythic: 1.86m oversize 6-wing span (up from 1.45m)
    wings_aurora_crystal_wings: 1.72,      // ★3 Mythic: 1.87m oversize crystal span (up from 1.46m)
    wings_astral_eclipse_six: 1.56,        // ★3 Mythic: 1.91m oversize eclipse span (up from 1.64m)
    wings_mythic_prism_valkyrie: 1.46,     // ★3 Sovereign Mythic: 1.98m grand 6-wing archangel span
    wings_mythic_sakura_phoenix: 1.50,     // ★3 Sovereign Mythic: 1.93m eternal phoenix 6-wing span
    wings_mythic_abyssal_poseidon: 1.50,   // ★3 Sovereign Mythic: 1.95m Atlantis pearl 6-wing span
    wings_mythic_chrono_celestial: 1.52,   // ★3 Sovereign Mythic: 1.92m Chronos astrolabe 6-wing span
    wings_mythic_void_bahamut: 1.42,       // ★3 Sovereign Mythic: 1.99m Nebula Bahamut 6-wing span
    wings_mythic_eden_peacock: 1.46,       // ★3 Sovereign Mythic: 1.98m Eden peacock 6-wing span
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

/**
 * Compute normalized world-space wing dimensions `{ w, h, wingScale }` in metres for both
 * 3D `ChibiRig.setWings` and 2D DOM `computePaperDollParts`.
 * - Broadens narrow 4-column sheet wings (`rawAspect < 1.15`) horizontally while damping vertical
 *   height so they frame the shoulders cleanly without towering above the head.
 * - Adds 15% vertical fullness to ultra-flat wings (`rawAspect > 1.85`, e.g. valkyrie/swan/puff).
 */
export function resolveWingDimensions(id, wPx = 330, hPx = 260, ppm = 1.55 / 625) {
  const wingScale = getWingScale(id);
  const w = wPx * ppm * wingScale;
  const rawAspect = wPx / Math.max(1, hPx);
  let h;
  if (rawAspect < 1.15) {
    const effAspect = 1.16 + (rawAspect - 0.75) * 0.35;
    h = w / Math.max(1.14, effAspect);
  } else if (rawAspect > 1.85) {
    h = hPx * ppm * wingScale * 1.15;
  } else {
    h = hPx * ppm * wingScale;
  }
  return { w, h, wingScale };
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
      rotZ = Math.max(-0.06, Math.min(0.06, -Math.atan2(dv * 0.35, du)));
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
  } else if (def.singleHand && def.bone === 'ARM' && Array.isArray(def.grip)) {
    const [uGrip, vGrip] = def.grip;
    const hInHeads = effScale * spriteAspect;
    const [frontTilt = -0.32, sideTilt = -0.54] = def.tilt || [];
    rotZ = view === 'side' ? sideTilt : frontTilt;
    const gx = (uGrip - 0.5) * effScale;
    const gy = (vGrip - 0.5) * hInHeads;
    const cosR = Math.cos(rotZ), sinR = Math.sin(rotZ);
    const gxRot = gx * cosR - gy * sinR;
    const gyRot = gx * sinR + gy * cosR;
    const palmX = view === 'side' ? M.HAND_X_SIDE + 0.01 : view === 'back' ? M.HAND_X_FRONT + 0.10 : M.HAND_X_FRONT + 0.055;
    const palmY = view === 'side' ? -0.54 : -0.49;
    effOx = palmX - gxRot + ox;
    baseOy = palmY - gyRot + oy;
  }
  const effOy = baseOy + hairLift;
  return { effScale, ox: effOx, effOy, rotZ };
}

export const ATTACH = {
  hat_straw_explorer: { bone: 'HEAD', hairCover: 'top', offset: [0.01, 0.84], scale: 1.46, offsets: { side: [0.10, 0.84], back: [0.02, 0.80] }, scales: { side: 1.47, back: 1.40 }, views: { front: 'hat_straw_explorer', side: 'hat_straw_explorer_side', back: 'hat_straw_explorer_back' } },
  hat_cat_headset: { bone: 'HEAD', offset: [-0.02, 0.91], scale: 1.22, offsets: { side: [-0.02, 0.92], back: [0, 0.91] }, scales: { side: 0.50, back: 1.22 }, views: { front: 'hat_cat_headset', side: 'hat_cat_headset_side', back: 'hat_cat_headset_back' } },
  hat_glowing_bunny: { bone: 'HEAD', offset: [0, 1.35], scale: 1.09, offsets: { side: [-0.04, 1.26], back: [0, 1.35] }, scales: { side: 0.56, back: 1.09 }, views: { front: 'hat_glowing_bunny', side: 'hat_glowing_bunny_side', back: 'hat_glowing_bunny_back' } },
  face_rosegold_shades: { bone: 'HEAD', anchor: 'eyes', leftEye: [0.405, 0.500], rightEye: [0.790, 0.525], eyeCenter: [0.598, 0.513], eyeSpan: 0.386, offset: [0, 0], scale: 1.0, views: { front: 'face_rosegold_shades', side: null, back: null } },
  face_cyber_visor: { bone: 'HEAD', anchor: 'eyes', leftEye: [0.390, 0.495], rightEye: [0.785, 0.495], eyeCenter: [0.588, 0.495], eyeSpan: 0.395, offset: [0, 0], scale: 1.0, views: { front: 'face_cyber_visor', side: null, back: null } },
  face_oracle_monocle: { bone: 'HEAD', anchor: 'left_eye', eyeCenter: [0.650, 0.485], offset: [0, 0], scale: 0.44, views: { front: 'face_oracle_monocle', side: null, back: null } },
  gloves_cat_mittens: { bone: 'ARM', anchor: 'hand', offset: [0, 0], scale: 1.0, views: { front: 'gloves_cat_mittens', side: 'gloves_cat_mittens', back: 'gloves_cat_mittens' } },
  gloves_vorax_cyan: { bone: 'ARM', anchor: 'gauntlet', offset: [0, 0], scale: 1.0, views: { front: 'gloves_vorax_cyan', side: 'gloves_vorax_cyan', back: 'gloves_vorax_cyan' } },
  gloves_starlight_wand: { bone: 'ARM', singleHand: true, grip: [0.48, 0.22], tilt: [-0.26, -0.52], offset: [0, 0], scale: 0.68, views: { front: 'gloves_starlight_wand', side: 'gloves_starlight_wand', back: 'gloves_starlight_wand' } },
  boots_slime_rain: { bone: 'LEG', offset: [0.065, -0.390], scale: 0.49, offsets: { side: [0.080, -0.388], back: [0.065, -0.390] }, views: { front: 'boots_slime_rain', side: 'boots_slime_rain', back: 'boots_slime_rain' } },
  boots_hermes_greaves: { bone: 'LEG', offset: [0.045, -0.385], scale: 0.50, offsets: { side: [0.060, -0.378], back: [0.035, -0.385] }, views: { front: 'boots_hermes_greaves', side: 'boots_hermes_greaves', back: 'boots_hermes_greaves' } },
  boots_astral_striders: { bone: 'LEG', offset: [0.075, -0.390], scale: 0.49, offsets: { side: [0.085, -0.388], back: [0.065, -0.390] }, views: { front: 'boots_astral_striders', side: 'boots_astral_striders', back: 'boots_astral_striders' } },
  hat_wolf_ears: { bone: 'HEAD', offset: [0, 1.15], scale: 1.10, offsets: { side: [-0.05, 1.15], back: [0, 1.15] }, scales: { side: 0.60, back: 1.10 }, views: { front: 'hat_wolf_ears', side: 'hat_wolf_ears_side', back: 'hat_wolf_ears_back' } },
  hat_dragon_horns: { bone: 'HEAD', offset: [0, 1.22], scale: 1.18, offsets: { side: [-0.04, 1.18], back: [0, 1.22] }, scales: { side: 0.60, back: 1.18 }, views: { front: 'hat_dragon_horns', side: 'hat_dragon_horns_side', back: 'hat_dragon_horns_back' } },
  back_wolf_tail: { bone: 'HIP', socket: 'hip', offset: [-0.34, 0.88], scale: 0.85, offsets: { back: [0, 0.80] }, scales: { back: 0.60 }, views: { front: 'back_wolf_tail', side: 'back_wolf_tail', back: 'back_wolf_tail_back' } },
  back_dragon_tail: { bone: 'HIP', socket: 'hip', offset: [-0.40, 0.74], scale: 0.95, offsets: { back: [0, 0.74] }, scales: { back: 0.43 }, views: { front: 'back_dragon_tail', side: 'back_dragon_tail', back: 'back_dragon_tail_back' } },
  hat_valkyrie_diadem: { bone: 'HEAD', anchor: 'skull', browY: 0.29, browYs: { back: 0.12 }, offset: [0.01, 0], scale: 1.22, offsets: { side: [-0.02, 0], back: [0, 0] }, scales: { side: 0.76, back: 1.22 }, views: { front: 'hat_valkyrie_diadem', side: 'hat_valkyrie_diadem_side', back: 'hat_valkyrie_diadem_back' } },
  face_starlight_mask: { bone: 'HEAD', anchor: 'eyes', leftEye: [0.485, 0.380], rightEye: [0.840, 0.380], eyeCenter: [0.663, 0.380], eyeSpan: 0.355, offset: [0, 0], scale: 1.0, views: { front: 'face_starlight_mask', side: null, back: null } },
  gloves_valkyrie_gauntlets: { bone: 'ARM', anchor: 'gauntlet', offset: [0, 0], scale: 1.0, views: { front: 'gloves_valkyrie_gauntlets', side: 'gloves_valkyrie_gauntlets', back: 'gloves_valkyrie_gauntlets' } },
  boots_valkyrie_greaves: { bone: 'LEG', offset: [0.055, -0.385], scale: 0.50, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_valkyrie_greaves', side: 'boots_valkyrie_greaves', back: 'boots_valkyrie_greaves' } },
  back_kitsune_star_tail: { bone: 'HIP', socket: 'hip', offset: [-0.42, 0.86], scale: 0.92, offsets: { back: [0, 0.76] }, scales: { back: 0.52 }, views: { front: 'back_kitsune_star_tail', side: 'back_kitsune_star_tail', back: 'back_kitsune_star_tail_back' } },
  back_valkyrie_mantle: { bone: 'TORSO', socket: 'shoulders', offset: [-0.14, -0.10], scale: 1.25, offsets: { side: [-0.16, -0.08], back: [0, -0.20] }, scales: { side: 0.96, back: 1.28 }, views: { front: 'back_valkyrie_mantle', side: 'back_valkyrie_mantle', back: 'back_valkyrie_mantle_back' } },
  // ★3 Mythic Set — Celestial Seraphim Rose
  hat_seraphim_rose_crown: { bone: 'HEAD', anchor: 'skull', browY: 0.25, browYs: { back: 0.16 }, offset: [0.01, 0], scale: 1.28, offsets: { side: [0.06, -0.02], back: [0, 0] }, scales: { side: 0.86, back: 1.28 }, views: { front: 'hat_seraphim_rose_crown', side: 'hat_seraphim_rose_crown_side', back: 'hat_seraphim_rose_crown_back' } },
  face_seraphim_veil_glasses: { bone: 'HEAD', anchor: 'eyes', leftEye: [0.475, 0.445], rightEye: [0.845, 0.435], eyeCenter: [0.660, 0.440], eyeSpan: 0.370, offset: [0, 0], scale: 1.0, views: { front: 'face_seraphim_veil_glasses', side: null, back: null } },
  gloves_seraphim_silk_gauntlets: { bone: 'ARM', anchor: 'gauntlet', offset: [0, 0], scale: 1.0, views: { front: 'gloves_seraphim_silk_gauntlets', side: 'gloves_seraphim_silk_gauntlets', back: 'gloves_seraphim_silk_gauntlets' } },
  boots_seraphim_heels: { bone: 'LEG', offset: [0.055, -0.385], scale: 0.50, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_seraphim_heels', side: 'boots_seraphim_heels', back: 'boots_seraphim_heels' } },
  back_seraphim_nine_tails: { bone: 'HIP', socket: 'hip', offset: [-0.42, 0.86], scale: 0.96, offsets: { back: [0, 0.76] }, scales: { back: 0.54 }, views: { front: 'back_seraphim_nine_tails', side: 'back_seraphim_nine_tails', back: 'back_seraphim_nine_tails_back' } },
  back_seraphim_stardust_veil: { bone: 'TORSO', socket: 'shoulders', offset: [-0.14, -0.10], scale: 1.28, offsets: { side: [-0.16, -0.08], back: [0, -0.20] }, scales: { side: 0.98, back: 1.30 }, views: { front: 'back_seraphim_stardust_veil', side: 'back_seraphim_stardust_veil', back: 'back_seraphim_stardust_veil_back' } },
  // ★2 Epic Set 1 — Sakura Ribbon Princess
  hat_sakura_princess_beret: { bone: 'HEAD', anchor: 'crown', contactY: 0.44, contactYs: { side: 0.24, back: 0.56 }, offset: [0, 0], scale: 1.20, offsets: { side: [-0.04, 0], back: [0, 0] }, scales: { side: 0.62, back: 1.20 }, views: { front: 'hat_sakura_princess_beret', side: 'hat_sakura_princess_beret_side', back: 'hat_sakura_princess_beret_back' } },
  face_sakura_blossom_glasses: { bone: 'HEAD', anchor: 'eyes', leftEye: [0.490, 0.415], rightEye: [0.835, 0.525], eyeCenter: [0.663, 0.470], eyeSpan: 0.349, offset: [0, 0], scale: 1.0, views: { front: 'face_sakura_blossom_glasses', side: null, back: null } },
  gloves_sakura_lace_gloves: { bone: 'ARM', anchor: 'hand', offset: [0, 0], scale: 1.0, views: { front: 'gloves_sakura_lace_gloves', side: 'gloves_sakura_lace_gloves', back: 'gloves_sakura_lace_gloves' } },
  boots_sakura_maryjanes: { bone: 'LEG', offset: [0.055, -0.385], scale: 0.49, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_sakura_maryjanes', side: 'boots_sakura_maryjanes', back: 'boots_sakura_maryjanes' } },
  back_sakura_bunny_tail: { bone: 'HIP', socket: 'hip', offset: [-0.42, 0.86], scale: 0.92, offsets: { back: [0, 0.76] }, scales: { back: 0.52 }, views: { front: 'back_sakura_bunny_tail', side: 'back_sakura_bunny_tail', back: 'back_sakura_bunny_tail_back' } },
  back_sakura_capelet: { bone: 'TORSO', socket: 'shoulders', offset: [-0.14, -0.10], scale: 1.24, offsets: { side: [-0.16, -0.08], back: [0, -0.20] }, scales: { side: 0.96, back: 1.26 }, views: { front: 'back_sakura_capelet', side: 'back_sakura_capelet', back: 'back_sakura_capelet_back' } },
  // ★2 Epic Set 2 — Moonlight Crystal Swan
  hat_moonlight_swan_tiara: { bone: 'HEAD', anchor: 'skull', browY: 0.28, browYs: { back: 0.12 }, offset: [0.01, 0], scale: 1.22, offsets: { side: [0.05, -0.02], back: [0, 0] }, scales: { side: 0.84, back: 1.22 }, views: { front: 'hat_moonlight_swan_tiara', side: 'hat_moonlight_swan_tiara_side', back: 'hat_moonlight_swan_tiara_back' } },
  face_moonlight_butterfly_mask: { bone: 'HEAD', anchor: 'eyes', leftEye: [0.470, 0.455], rightEye: [0.840, 0.455], eyeCenter: [0.655, 0.455], eyeSpan: 0.370, offset: [0, 0], scale: 1.0, views: { front: 'face_moonlight_butterfly_mask', side: null, back: null } },
  gloves_moonlight_cuffs: { bone: 'ARM', anchor: 'hand', offset: [0, 0], scale: 1.0, views: { front: 'gloves_moonlight_cuffs', side: 'gloves_moonlight_cuffs', back: 'gloves_moonlight_cuffs' } },
  boots_moonlight_ballet_greaves: { bone: 'LEG', offset: [0.055, -0.385], scale: 0.50, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_moonlight_ballet_greaves', side: 'boots_moonlight_ballet_greaves', back: 'boots_moonlight_ballet_greaves' } },
  back_moonlight_snowleopard_tail: { bone: 'HIP', socket: 'hip', offset: [-0.42, 0.86], scale: 0.92, offsets: { back: [0, 0.76] }, scales: { back: 0.52 }, views: { front: 'back_moonlight_snowleopard_tail', side: 'back_moonlight_snowleopard_tail', back: 'back_moonlight_snowleopard_tail_back' } },
  back_moonlight_chiffon_cloak: { bone: 'TORSO', socket: 'shoulders', offset: [-0.14, -0.10], scale: 1.25, offsets: { side: [-0.16, -0.08], back: [0, -0.20] }, scales: { side: 0.96, back: 1.28 }, views: { front: 'back_moonlight_chiffon_cloak', side: 'back_moonlight_chiffon_cloak', back: 'back_moonlight_chiffon_cloak_back' } },
  // ★3 Mythic Set 2 — Astral Eclipse Archon
  hat_astral_eclipse_crown: { bone: 'HEAD', anchor: 'skull', browY: 0.27, browYs: { back: 0.16 }, offset: [0.01, 0], scale: 1.28, offsets: { side: [0.06, -0.02], back: [0, 0] }, scales: { side: 0.86, back: 1.28 }, views: { front: 'hat_astral_eclipse_crown', side: 'hat_astral_eclipse_crown_side', back: 'hat_astral_eclipse_crown_back' } },
  face_astral_eclipse_visor: { bone: 'HEAD', anchor: 'eyes', leftEye: [0.475, 0.340], rightEye: [0.852, 0.335], eyeCenter: [0.664, 0.338], eyeSpan: 0.377, offset: [0, 0], scale: 1.0, views: { front: 'face_astral_eclipse_visor', side: null, back: null } },
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
  hat_clover_beret: { bone: 'HEAD', hairCover: 'top', offset: [0.02, 1.09], scale: 1.30, offsets: { side: [0.01, 1.06], back: [0.00, 1.04] }, scales: { side: 1.26, back: 1.26 }, views: { front: 'hat_clover_beret', side: 'hat_clover_beret_side', back: 'hat_clover_beret_back' } },
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
  hat_starbunny_nightcap: { bone: 'HEAD', anchor: 'crown', contactY: 0.58, contactYs: { side: 0.32, back: 0.52 }, offset: [0, 0], scale: 1.22, offsets: { side: [-0.04, 0], back: [0, 0] }, scales: { side: 0.78, back: 1.22 }, views: { front: 'hat_starbunny_nightcap', side: 'hat_starbunny_nightcap_side', back: 'hat_starbunny_nightcap_back' } },
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
  hat_kitty_nightcap: { bone: 'HEAD', anchor: 'crown', contactY: 0.38, contactYs: { side: 0.24, back: 0.38 }, offset: [0, 0], scale: 1.16, offsets: { side: [-0.04, 0], back: [0, 0] }, scales: { side: 0.44, back: 1.16 }, views: { front: 'hat_kitty_nightcap', side: 'hat_kitty_nightcap_side', back: 'hat_kitty_nightcap_back' } },
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
  // ★2 Epic (6) & ★1 Rare (4) Creative Cute Collection
  hat_axolotl_crown: { bone: 'HEAD', hairCover: 'helm', anchor: 'crown', contactY: 0.36, contactYs: { side: 0.34, back: 0.36 }, offset: [0, 0], scale: 1.40, offsets: { side: [-0.04, 0], back: [0, 0] }, scales: { side: 0.78, back: 1.40 }, views: { front: 'hat_axolotl_crown', side: 'hat_axolotl_crown_side', back: 'hat_axolotl_crown_back' } },
  hat_shiba_melonpan_beret: { bone: 'HEAD', hairCover: 'top', offset: [0.00, 1.02], scale: 1.36, offsets: { side: [-0.02, 1.00], back: [0.00, 0.99] }, scales: { side: 1.28, back: 1.36 }, views: { front: 'hat_shiba_melonpan_beret', side: 'hat_shiba_melonpan_beret_side', back: 'hat_shiba_melonpan_beret_back' } },
  hat_froggy_lilypad_crown: { bone: 'HEAD', hairCover: 'helm', offset: [-0.03, 1.17], scale: 1.42, offsets: { side: [-0.02, 1.18], back: [0.02, 1.16] }, scales: { side: 1.30, back: 1.42 }, views: { front: 'hat_froggy_lilypad_crown', side: 'hat_froggy_lilypad_crown_side', back: 'hat_froggy_lilypad_crown_back' } },
  gloves_parfait_spoon_wand: { bone: 'ARM', singleHand: true, grip: [0.50, 0.20], tilt: [-0.26, -0.52], offset: [0, 0], scale: 0.76, views: { front: 'gloves_parfait_spoon_wand', side: 'gloves_parfait_spoon_wand', back: 'gloves_parfait_spoon_wand' } },
  gloves_boba_milk_tea: { bone: 'ARM', singleHand: true, grip: [0.46, 0.35], tilt: [-0.08, -0.18], offset: [0.02, 0], scale: 0.50, views: { front: 'gloves_boba_milk_tea', side: 'gloves_boba_milk_tea', back: 'gloves_boba_milk_tea' } },
  face_froggy_blush_glasses: { bone: 'HEAD', anchor: 'eyes', leftEye: [0.479, 0.495], rightEye: [0.838, 0.543], eyeCenter: [0.659, 0.519], eyeSpan: 0.359, offset: [0, 0], scale: 1.0, views: { front: 'face_froggy_blush_glasses', side: null, back: null } },
  back_shiba_curly_tail: { bone: 'HIP', socket: 'hip', offset: [-0.38, 0.84], scale: 0.86, offsets: { back: [0, 0.76] }, scales: { back: 0.50 }, views: { front: 'back_shiba_curly_tail', side: 'back_shiba_curly_tail', back: 'back_shiba_curly_tail_back' } },
  back_taiyaki_backpack: { bone: 'TORSO', socket: 'shoulders', offset: [-0.38, 0.02], scale: 1.34, offsets: { side: [-0.28, 0.03], back: [0, -0.02] }, scales: { side: 1.14, back: 1.36 }, views: { front: 'back_taiyaki_backpack', side: 'back_taiyaki_backpack', back: 'back_taiyaki_backpack_back' } },
  // ★2 Epic Set 7 — Symphony Vinyl Virtuoso
  hat_vinyl_gramophone_beret: { bone: 'HEAD', hairCover: 'top', offset: [0.00, 1.05], scale: 1.34, offsets: { side: [-0.02, 1.03], back: [0.00, 0.98] }, scales: { side: 1.26, back: 1.34 }, views: { front: 'hat_vinyl_gramophone_beret', side: 'hat_vinyl_gramophone_beret_side', back: 'hat_vinyl_gramophone_beret_back' } },
  face_treble_clef_glasses: { bone: 'HEAD', anchor: 'eyes', leftEye: [0.270, 0.480], rightEye: [0.770, 0.480], eyeCenter: [0.520, 0.480], eyeSpan: 0.500, offset: [0, 0], scale: 1.0, views: { front: 'face_treble_clef_glasses', side: null, back: null } },
  gloves_conductor_baton_wand: { bone: 'ARM', singleHand: true, grip: [0.46, 0.22], tilt: [-0.26, -0.52], offset: [0, 0], scale: 0.76, views: { front: 'gloves_conductor_baton_wand', side: 'gloves_conductor_baton_wand', back: 'gloves_conductor_baton_wand' } },
  boots_piano_key_loafers: { bone: 'LEG', offset: [0.055, -0.385], scale: 0.49, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_piano_key_loafers', side: 'boots_piano_key_loafers', back: 'boots_piano_key_loafers' } },
  // ★2 Epic Set 8 — Arcana Tarot Astrologer
  hat_tarot_sunmoon_crown: { bone: 'HEAD', hairCover: 'helm', anchor: 'crown', contactY: 0.36, contactYs: { side: 0.42, back: 0.36 }, offset: [0, 0], scale: 1.38, offsets: { side: [-0.03, 0], back: [0, 0] }, scales: { side: 1.24, back: 1.38 }, views: { front: 'hat_tarot_sunmoon_crown', side: 'hat_tarot_sunmoon_crown_side', back: 'hat_tarot_sunmoon_crown_back' } },
  face_astrolabe_monocle_glasses: { bone: 'HEAD', anchor: 'eyes', leftEye: [0.470, 0.570], rightEye: [0.830, 0.570], eyeCenter: [0.650, 0.570], eyeSpan: 0.360, offset: [0, 0], scale: 1.0, views: { front: 'face_astrolabe_monocle_glasses', side: null, back: null } },
  gloves_tarot_card_fan: { bone: 'ARM', singleHand: true, grip: [0.48, 0.22], tilt: [-0.26, -0.50], offset: [0, 0], scale: 0.74, views: { front: 'gloves_tarot_card_fan', side: 'gloves_tarot_card_fan', back: 'gloves_tarot_card_fan' } },
  boots_zodiac_sundial_boots: { bone: 'LEG', offset: [0.055, -0.385], scale: 0.49, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_zodiac_sundial_boots', side: 'boots_zodiac_sundial_boots', back: 'boots_zodiac_sundial_boots' } },
  // ★2 Epic Set 9 — Origami Wish-Crane Festival
  hat_origami_crane_crown: { bone: 'HEAD', hairCover: 'helm', anchor: 'crown', contactY: 0.28, contactYs: { side: 0.36, back: 0.34 }, offset: [0, 0], scale: 1.38, offsets: { side: [-0.02, 0], back: [0, 0] }, scales: { side: 1.24, back: 1.38 }, views: { front: 'hat_origami_crane_crown', side: 'hat_origami_crane_crown_side', back: 'hat_origami_crane_crown_back' } },
  face_origami_paper_glasses: { bone: 'HEAD', anchor: 'eyes', leftEye: [0.480, 0.480], rightEye: [0.820, 0.480], eyeCenter: [0.650, 0.480], eyeSpan: 0.340, offset: [0, 0], scale: 1.0, views: { front: 'face_origami_paper_glasses', side: null, back: null } },
  gloves_origami_fan_wand: { bone: 'ARM', singleHand: true, grip: [0.48, 0.22], tilt: [-0.26, -0.50], offset: [0, 0], scale: 0.76, views: { front: 'gloves_origami_fan_wand', side: 'gloves_origami_fan_wand', back: 'gloves_origami_fan_wand' } },
  boots_origami_mizuhiki_geta: { bone: 'LEG', offset: [0.055, -0.385], scale: 0.49, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_origami_mizuhiki_geta', side: 'boots_origami_mizuhiki_geta', back: 'boots_origami_mizuhiki_geta' } },
  // ★1 Rare Set 8 — Atelier Rainbow Painter
  hat_painter_palette_beret: { bone: 'HEAD', hairCover: 'top', offset: [0.00, 0.99], scale: 1.38, offsets: { side: [-0.02, 0.98], back: [0.00, 0.96] }, scales: { side: 1.30, back: 1.38 }, views: { front: 'hat_painter_palette_beret', side: 'hat_painter_palette_beret_side', back: 'hat_painter_palette_beret_back' } },
  face_paint_splatter_glasses: { bone: 'HEAD', anchor: 'eyes', leftEye: [0.480, 0.400], rightEye: [0.830, 0.400], eyeCenter: [0.655, 0.400], eyeSpan: 0.350, offset: [0, 0], scale: 1.0, views: { front: 'face_paint_splatter_glasses', side: null, back: null } },
  gloves_giant_paintbrush: { bone: 'ARM', singleHand: true, grip: [0.48, 0.22], tilt: [-0.26, -0.52], offset: [0, 0], scale: 0.74, views: { front: 'gloves_giant_paintbrush', side: 'gloves_giant_paintbrush', back: 'gloves_giant_paintbrush' } },
  boots_paint_tube_sneakers: { bone: 'LEG', offset: [0.055, -0.385], scale: 0.49, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_paint_tube_sneakers', side: 'boots_paint_tube_sneakers', back: 'boots_paint_tube_sneakers' } },
  back_atelier_paint_satchel: { bone: 'TORSO', socket: 'shoulders', offset: [-0.38, 0.02], scale: 1.34, offsets: { side: [-0.28, 0.03], back: [0, -0.02] }, scales: { side: 1.14, back: 1.36 }, views: { front: 'back_atelier_paint_satchel', side: 'back_atelier_paint_satchel', back: 'back_atelier_paint_satchel_back' } },
  // ★1 Rare Set 9 — Deep-Sea Bubble-Dome Terrarium
  hat_octopus_diver_helmet: { bone: 'HEAD', hairCover: 'top', offset: [0.00, 1.07], scale: 1.30, offsets: { side: [-0.02, 1.04], back: [0.00, 1.01] }, scales: { side: 1.18, back: 1.30 }, views: { front: 'hat_octopus_diver_helmet', side: 'hat_octopus_diver_helmet_side', back: 'hat_octopus_diver_helmet_back' } },
  face_diving_bubble_goggles: { bone: 'HEAD', anchor: 'eyes', leftEye: [0.380, 0.460], rightEye: [0.780, 0.460], eyeCenter: [0.580, 0.460], eyeSpan: 0.400, offset: [0, 0], scale: 1.0, views: { front: 'face_diving_bubble_goggles', side: null, back: null } },
  gloves_bubble_coral_mitts: { bone: 'ARM', anchor: 'hand', offset: [0, 0], scale: 1.0, views: { front: 'gloves_bubble_coral_mitts', side: 'gloves_bubble_coral_mitts', back: 'gloves_bubble_coral_mitts' } },
  boots_flipper_diver_boots: { bone: 'LEG', offset: [0.055, -0.385], scale: 0.49, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_flipper_diver_boots', side: 'boots_flipper_diver_boots', back: 'boots_flipper_diver_boots' } },
  back_astro_octopus_tank: { bone: 'TORSO', socket: 'shoulders', offset: [-0.38, 0.02], scale: 1.34, offsets: { side: [-0.28, 0.03], back: [0, -0.02] }, scales: { side: 1.14, back: 1.36 }, views: { front: 'back_astro_octopus_tank', side: 'back_astro_octopus_tank', back: 'back_astro_octopus_tank_back' } },
  // ★1 Rare Set 10 — Retro Polaroid Shutterbug
  hat_polaroid_shutter_cap: { bone: 'HEAD', hairCover: 'top', offset: [0.00, 0.99], scale: 1.36, offsets: { side: [0.00, 0.98], back: [0.00, 0.97] }, scales: { side: 1.28, back: 1.36 }, views: { front: 'hat_polaroid_shutter_cap', side: 'hat_polaroid_shutter_cap_side', back: 'hat_polaroid_shutter_cap_back' } },
  face_viewfinder_frame_glasses: { bone: 'HEAD', anchor: 'eyes', leftEye: [0.520, 0.350], rightEye: [0.830, 0.350], eyeCenter: [0.675, 0.350], eyeSpan: 0.310, offset: [0, 0], scale: 1.0, views: { front: 'face_viewfinder_frame_glasses', side: null, back: null } },
  gloves_polaroid_photo_hand: { bone: 'ARM', singleHand: true, grip: [0.46, 0.36], tilt: [-0.08, -0.18], offset: [0.02, 0], scale: 0.58, views: { front: 'gloves_polaroid_photo_hand', side: 'gloves_polaroid_photo_hand', back: 'gloves_polaroid_photo_hand' } },
  boots_filmstrip_sneakers: { bone: 'LEG', offset: [0.055, -0.385], scale: 0.49, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_filmstrip_sneakers', side: 'boots_filmstrip_sneakers', back: 'boots_filmstrip_sneakers' } },
  back_retro_polaroid_pack: { bone: 'TORSO', socket: 'shoulders', offset: [-0.38, 0.02], scale: 1.34, offsets: { side: [-0.28, 0.03], back: [0, -0.02] }, scales: { side: 1.14, back: 1.36 }, views: { front: 'back_retro_polaroid_pack', side: 'back_retro_polaroid_pack', back: 'back_retro_polaroid_pack_back' } },
  // ★1 Rare Set 11 — Midnight Ramen Yatai Stall
  hat_ramen_naruto_bowl: { bone: 'HEAD', hairCover: 'top', offset: [0.00, 1.01], scale: 1.36, offsets: { side: [-0.02, 1.00], back: [0.00, 0.98] }, scales: { side: 1.28, back: 1.36 }, views: { front: 'hat_ramen_naruto_bowl', side: 'hat_ramen_naruto_bowl_side', back: 'hat_ramen_naruto_bowl_back' } },
  face_narutomaki_swirl_glasses: { bone: 'HEAD', anchor: 'eyes', leftEye: [0.490, 0.340], rightEye: [0.820, 0.340], eyeCenter: [0.655, 0.340], eyeSpan: 0.330, offset: [0, 0], scale: 1.0, views: { front: 'face_narutomaki_swirl_glasses', side: null, back: null } },
  gloves_ramen_ladle_chopsticks: { bone: 'ARM', singleHand: true, grip: [0.46, 0.24], tilt: [-0.24, -0.48], offset: [0, 0], scale: 0.72, views: { front: 'gloves_ramen_ladle_chopsticks', side: 'gloves_ramen_ladle_chopsticks', back: 'gloves_ramen_ladle_chopsticks' } },
  boots_yatai_lantern_boots: { bone: 'LEG', offset: [0.055, -0.385], scale: 0.49, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_yatai_lantern_boots', side: 'boots_yatai_lantern_boots', back: 'boots_yatai_lantern_boots' } },
  back_ramen_naruto_box: { bone: 'TORSO', socket: 'shoulders', offset: [-0.38, 0.02], scale: 1.34, offsets: { side: [-0.28, 0.03], back: [0, -0.02] }, scales: { side: 1.14, back: 1.36 }, views: { front: 'back_ramen_naruto_box', side: 'back_ramen_naruto_box', back: 'back_ramen_naruto_box_back' } },
  // ★1 Rare Set 12 — Carousel Wind-Up Music Box
  hat_carousel_tent_crown: { bone: 'HEAD', hairCover: 'top', offset: [0.00, 1.03], scale: 1.36, offsets: { side: [-0.02, 1.02], back: [0.00, 0.99] }, scales: { side: 1.28, back: 1.36 }, views: { front: 'hat_carousel_tent_crown', side: 'hat_carousel_tent_crown_side', back: 'hat_carousel_tent_crown_back' } },
  face_windup_key_glasses: { bone: 'HEAD', anchor: 'eyes', leftEye: [0.470, 0.350], rightEye: [0.820, 0.350], eyeCenter: [0.645, 0.350], eyeSpan: 0.350, offset: [0, 0], scale: 1.0, views: { front: 'face_windup_key_glasses', side: null, back: null } },
  gloves_cotton_candy_wand: { bone: 'ARM', singleHand: true, grip: [0.48, 0.22], tilt: [-0.26, -0.50], offset: [0, 0], scale: 0.74, views: { front: 'gloves_cotton_candy_wand', side: 'gloves_cotton_candy_wand', back: 'gloves_cotton_candy_wand' } },
  boots_carousel_pony_booties: { bone: 'LEG', offset: [0.055, -0.385], scale: 0.49, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_carousel_pony_booties', side: 'boots_carousel_pony_booties', back: 'boots_carousel_pony_booties' } },
  back_carousel_musicbox_pack: { bone: 'TORSO', socket: 'shoulders', offset: [-0.38, 0.02], scale: 1.34, offsets: { side: [-0.28, 0.03], back: [0, -0.02] }, scales: { side: 1.14, back: 1.36 }, views: { front: 'back_carousel_musicbox_pack', side: 'back_carousel_musicbox_pack', back: 'back_carousel_musicbox_pack_back' } },
  // ★2 Epic (3) & ★1 Rare (3) Cute Fantasy Held Weapons (Glove Slot)
  gloves_plush_bunny_mallet: { bone: 'ARM', singleHand: true, grip: [0.50, 0.20], tilt: [-0.36, -0.58], offset: [0, 0], scale: 0.96, views: { front: 'gloves_plush_bunny_mallet', side: 'gloves_plush_bunny_mallet', back: 'gloves_plush_bunny_mallet' } },
  gloves_sakura_crescent_scythe: { bone: 'ARM', singleHand: true, grip: [0.42, 0.24], tilt: [-0.26, -0.48], offset: [0, 0], scale: 1.00, views: { front: 'gloves_sakura_crescent_scythe', side: 'gloves_sakura_crescent_scythe', back: 'gloves_sakura_crescent_scythe' } },
  gloves_cupid_strawberry_bow: { bone: 'ARM', singleHand: true, grip: [0.52, 0.48], tilt: [-0.14, -0.22], offset: [0.06, 0.02], offsets: { side: [0.10, 0.02], back: [0.06, 0.02] }, scale: 0.94, views: { front: 'gloves_cupid_strawberry_bow', side: 'gloves_cupid_strawberry_bow', back: 'gloves_cupid_strawberry_bow' } },
  gloves_macaron_knight_lance: { bone: 'ARM', singleHand: true, grip: [0.35, 0.20], tilt: [-0.24, -0.45], offset: [0, 0], scale: 0.76, views: { front: 'gloves_macaron_knight_lance', side: 'gloves_macaron_knight_lance', back: 'gloves_macaron_knight_lance' } },
  gloves_kitty_paw_katana: { bone: 'ARM', singleHand: true, grip: [0.38, 0.24], tilt: [-0.24, -0.45], offset: [0, 0], scale: 0.70, views: { front: 'gloves_kitty_paw_katana', side: 'gloves_kitty_paw_katana', back: 'gloves_kitty_paw_katana' } },
  gloves_gachapon_bubble_blaster: { bone: 'ARM', singleHand: true, grip: [0.34, 0.24], tilt: [-0.10, -0.18], offset: [0.04, 0], offsets: { side: [0.08, 0], back: [0.04, 0] }, scale: 0.80, views: { front: 'gloves_gachapon_bubble_blaster', side: 'gloves_gachapon_bubble_blaster', back: 'gloves_gachapon_bubble_blaster' } },
  // ── 25 FULL-WEAR PAIRED SETS: 10 EPIC (E1–E10) + 15 RARE (R1–R15) ──
  // ★2 Epic Full-Wear Set E1 — Cathedral Rose-Window Seraph
  hat_stained_glass_halo_tiara: { bone: 'HEAD', hairCover: 'helm', offset: [0.00, 1.12], scale: 1.24, offsets: { side: [-0.02, 1.09], back: [0.00, 1.07] }, scales: { side: 1.08, back: 1.24 }, views: { front: 'hat_stained_glass_halo_tiara', side: 'hat_stained_glass_halo_tiara_side', back: 'hat_stained_glass_halo_tiara_back' } },
  face_stained_glass_prism_glasses: { bone: 'HEAD', anchor: 'eyes', leftEye: [0.525, 0.341], rightEye: [0.85, 0.341], eyeCenter: [0.688, 0.341], eyeSpan: 0.325, offset: [0, 0], scale: 1.0, views: { front: 'face_stained_glass_prism_glasses', side: null, back: null } },
  gloves_stained_glass_chime_staff: { bone: 'ARM', singleHand: true, grip: [0.207, 0.24], tilt: [-0.28, -0.50], offset: [0, 0], scale: 0.84, views: { front: 'gloves_stained_glass_chime_staff', side: 'gloves_stained_glass_chime_staff', back: 'gloves_stained_glass_chime_staff' } },
  boots_stained_glass_arch_heels: { bone: 'LEG', offset: [0.055, -0.385], scale: 0.49, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_stained_glass_arch_heels', side: 'boots_stained_glass_arch_heels', back: 'boots_stained_glass_arch_heels' } },
  // ★2 Epic Full-Wear Set E2 — Haute-Parfumerie Alchemist
  hat_perfume_flacon_beret: { bone: 'HEAD', hairCover: 'top', offset: [0.00, 1.02], scale: 1.34, offsets: { side: [-0.02, 1.01], back: [0.00, 0.99] }, scales: { side: 1.24, back: 1.34 }, views: { front: 'hat_perfume_flacon_beret', side: 'hat_perfume_flacon_beret_side', back: 'hat_perfume_flacon_beret_back' } },
  face_perfume_mist_glasses: { bone: 'HEAD', anchor: 'eyes', leftEye: [0.523, 0.391], rightEye: [0.842, 0.391], eyeCenter: [0.682, 0.391], eyeSpan: 0.319, offset: [0, 0], scale: 1.0, views: { front: 'face_perfume_mist_glasses', side: null, back: null } },
  gloves_perfume_atomizer_wand: { bone: 'ARM', singleHand: true, grip: [0.214, 0.24], tilt: [-0.26, -0.48], offset: [0, 0], scale: 0.82, views: { front: 'gloves_perfume_atomizer_wand', side: 'gloves_perfume_atomizer_wand', back: 'gloves_perfume_atomizer_wand' } },
  boots_perfume_crystal_heels: { bone: 'LEG', offset: [0.055, -0.385], scale: 0.49, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_perfume_crystal_heels', side: 'boots_perfume_crystal_heels', back: 'boots_perfume_crystal_heels' } },
  // ★2 Epic Full-Wear Set E3 — Blue-Glaze Porcelain Marionette
  hat_porcelain_lace_bonnet: { bone: 'HEAD', hairCover: 'top', offset: [0.00, 1.04], scale: 1.32, offsets: { side: [-0.02, 1.02], back: [0.00, 1.00] }, scales: { side: 1.20, back: 1.32 }, views: { front: 'hat_porcelain_lace_bonnet', side: 'hat_porcelain_lace_bonnet_side', back: 'hat_porcelain_lace_bonnet_back' } },
  face_porcelain_crackle_glasses: { bone: 'HEAD', anchor: 'eyes', leftEye: [0.515, 0.405], rightEye: [0.840, 0.405], eyeCenter: [0.678, 0.405], eyeSpan: 0.325, offset: [0, 0], scale: 1.0, views: { front: 'face_porcelain_crackle_glasses', side: null, back: null } },
  gloves_marionette_cross_scepter: { bone: 'ARM', singleHand: true, grip: [0.254, 0.24], tilt: [-0.28, -0.50], offset: [0, 0], scale: 0.84, views: { front: 'gloves_marionette_cross_scepter', side: 'gloves_marionette_cross_scepter', back: 'gloves_marionette_cross_scepter' } },
  boots_porcelain_ribbon_maryjanes: { bone: 'LEG', offset: [0.055, -0.385], scale: 0.49, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_porcelain_ribbon_maryjanes', side: 'boots_porcelain_ribbon_maryjanes', back: 'boots_porcelain_ribbon_maryjanes' } },
  // ★2 Epic Full-Wear Set E4 — Amezaiku Spun-Sugar Sculptor
  hat_sugar_glass_bunny_crown: { bone: 'HEAD', hairCover: 'helm', offset: [0.00, 1.05], scale: 1.34, offsets: { side: [-0.02, 1.04], back: [0.00, 1.02] }, scales: { side: 1.24, back: 1.34 }, views: { front: 'hat_sugar_glass_bunny_crown', side: 'hat_sugar_glass_bunny_crown_side', back: 'hat_sugar_glass_bunny_crown_back' } },
  face_sugar_lollipop_glasses: { bone: 'HEAD', anchor: 'eyes', leftEye: [0.534, 0.382], rightEye: [0.843, 0.382], eyeCenter: [0.689, 0.382], eyeSpan: 0.309, offset: [0, 0], scale: 1.0, views: { front: 'face_sugar_lollipop_glasses', side: null, back: null } },
  gloves_sugar_candy_shears: { bone: 'ARM', singleHand: true, grip: [0.428, 0.24], tilt: [-0.26, -0.48], offset: [0, 0], scale: 0.84, views: { front: 'gloves_sugar_candy_shears', side: 'gloves_sugar_candy_shears', back: 'gloves_sugar_candy_shears' } },
  boots_sugar_glaze_booties: { bone: 'LEG', offset: [0.055, -0.385], scale: 0.49, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_sugar_glaze_booties', side: 'boots_sugar_glaze_booties', back: 'boots_sugar_glaze_booties' } },
  // ★2 Epic Full-Wear Set E5 — Gilded Bone-China Tea Duchess
  hat_teapot_dome_beret: { bone: 'HEAD', hairCover: 'top', offset: [0.00, 1.02], scale: 1.36, offsets: { side: [-0.02, 1.01], back: [0.00, 0.99] }, scales: { side: 1.26, back: 1.36 }, views: { front: 'hat_teapot_dome_beret', side: 'hat_teapot_dome_beret_side', back: 'hat_teapot_dome_beret_back' } },
  face_teacup_saucer_glasses: { bone: 'HEAD', anchor: 'eyes', leftEye: [0.515, 0.411], rightEye: [0.835, 0.411], eyeCenter: [0.675, 0.411], eyeSpan: 0.32, offset: [0, 0], scale: 1.0, views: { front: 'face_teacup_saucer_glasses', side: null, back: null } },
  gloves_enchanted_teapot_staff: { bone: 'ARM', singleHand: true, grip: [0.166, 0.24], tilt: [-0.28, -0.50], offset: [0, 0], scale: 0.84, views: { front: 'gloves_enchanted_teapot_staff', side: 'gloves_enchanted_teapot_staff', back: 'gloves_enchanted_teapot_staff' } },
  boots_teacup_ruffle_heels: { bone: 'LEG', offset: [0.055, -0.385], scale: 0.49, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_teacup_ruffle_heels', side: 'boots_teacup_ruffle_heels', back: 'boots_teacup_ruffle_heels' } },
  // ★2 Epic Full-Wear Set E6 — Actias Luna Silk-Weaver
  hat_luna_moth_feathered_tiara: { bone: 'HEAD', hairCover: 'helm', offset: [0.00, 1.00], scale: 1.36, offsets: { side: [-0.02, 0.99], back: [0.00, 0.97] }, scales: { side: 1.26, back: 1.36 }, views: { front: 'hat_luna_moth_feathered_tiara', side: 'hat_luna_moth_feathered_tiara_side', back: 'hat_luna_moth_feathered_tiara_back' } },
  face_luna_dreamcatcher_glasses: { bone: 'HEAD', anchor: 'eyes', leftEye: [0.515, 0.391], rightEye: [0.833, 0.391], eyeCenter: [0.674, 0.391], eyeSpan: 0.318, offset: [0, 0], scale: 1.0, views: { front: 'face_luna_dreamcatcher_glasses', side: null, back: null } },
  gloves_dreamcatcher_spindle_staff: { bone: 'ARM', singleHand: true, grip: [0.5, 0.24], tilt: [-0.28, -0.50], offset: [0, 0], scale: 0.84, views: { front: 'gloves_dreamcatcher_spindle_staff', side: 'gloves_dreamcatcher_spindle_staff', back: 'gloves_dreamcatcher_spindle_staff' } },
  boots_luna_moth_silk_boots: { bone: 'LEG', offset: [0.055, -0.385], scale: 0.49, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_luna_moth_silk_boots', side: 'boots_luna_moth_silk_boots', back: 'boots_luna_moth_silk_boots' } },
  // ★2 Epic Full-Wear Set E7 — Grand-Cru Praline Chocolatier
  hat_chocolate_truffle_crown: { bone: 'HEAD', hairCover: 'top', offset: [0.00, 1.06], scale: 1.30, offsets: { side: [-0.02, 1.04], back: [0.00, 1.02] }, scales: { side: 1.22, back: 1.30 }, views: { front: 'hat_chocolate_truffle_crown', side: 'hat_chocolate_truffle_crown_side', back: 'hat_chocolate_truffle_crown_back' } },
  face_chocolate_drip_glasses: { bone: 'HEAD', anchor: 'eyes', leftEye: [0.443, 0.397], rightEye: [0.829, 0.397], eyeCenter: [0.636, 0.397], eyeSpan: 0.386, offset: [0, 0], scale: 1.0, views: { front: 'face_chocolate_drip_glasses', side: null, back: null } },
  gloves_chocolate_fountain_lance: { bone: 'ARM', singleHand: true, grip: [0.502, 0.24], tilt: [-0.26, -0.48], offset: [0, 0], scale: 0.84, views: { front: 'gloves_chocolate_fountain_lance', side: 'gloves_chocolate_fountain_lance', back: 'gloves_chocolate_fountain_lance' } },
  boots_chocolate_foil_greaves: { bone: 'LEG', offset: [0.055, -0.385], scale: 0.49, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_chocolate_foil_greaves', side: 'boots_chocolate_foil_greaves', back: 'boots_chocolate_foil_greaves' } },
  // ★2 Epic Full-Wear Set E8 — Olympian Cloud-Lyre Muse
  hat_golden_lyre_laurel_crown: { bone: 'HEAD', hairCover: 'helm', offset: [0.00, 0.99], scale: 1.36, offsets: { side: [-0.02, 0.98], back: [0.00, 0.97] }, scales: { side: 1.26, back: 1.36 }, views: { front: 'hat_golden_lyre_laurel_crown', side: 'hat_golden_lyre_laurel_crown_side', back: 'hat_golden_lyre_laurel_crown_back' } },
  face_lyre_wing_glasses: { bone: 'HEAD', anchor: 'eyes', leftEye: [0.504, 0.345], rightEye: [0.824, 0.345], eyeCenter: [0.664, 0.345], eyeSpan: 0.320, offset: [0, 0], scale: 1.0, views: { front: 'face_lyre_wing_glasses', side: null, back: null } },
  gloves_swan_harp_bow_wand: { bone: 'ARM', singleHand: true, grip: [0.442, 0.24], tilt: [-0.20, -0.40], offset: [0, 0], scale: 0.82, views: { front: 'gloves_swan_harp_bow_wand', side: 'gloves_swan_harp_bow_wand', back: 'gloves_swan_harp_bow_wand' } },
  boots_olympian_laurel_sandals: { bone: 'LEG', offset: [0.055, -0.385], scale: 0.49, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_olympian_laurel_sandals', side: 'boots_olympian_laurel_sandals', back: 'boots_olympian_laurel_sandals' } },
  // ★2 Epic Full-Wear Set E9 — Snow-Globe Carillon Keeper
  hat_snowglobe_cottage_crown: { bone: 'HEAD', hairCover: 'top', offset: [0.00, 1.05], scale: 1.34, offsets: { side: [-0.02, 1.03], back: [0.00, 1.01] }, scales: { side: 1.24, back: 1.34 }, views: { front: 'hat_snowglobe_cottage_crown', side: 'hat_snowglobe_cottage_crown_side', back: 'hat_snowglobe_cottage_crown_back' } },
  face_holly_snowflake_glasses: { bone: 'HEAD', anchor: 'eyes', leftEye: [0.508, 0.365], rightEye: [0.828, 0.365], eyeCenter: [0.668, 0.365], eyeSpan: 0.320, offset: [0, 0], scale: 1.0, views: { front: 'face_holly_snowflake_glasses', side: null, back: null } },
  gloves_snowglobe_lantern_staff: { bone: 'ARM', singleHand: true, grip: [0.499, 0.24], tilt: [-0.28, -0.50], offset: [0, 0], scale: 0.84, views: { front: 'gloves_snowglobe_lantern_staff', side: 'gloves_snowglobe_lantern_staff', back: 'gloves_snowglobe_lantern_staff' } },
  boots_snowglobe_fur_booties: { bone: 'LEG', offset: [0.055, -0.385], scale: 0.49, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_snowglobe_fur_booties', side: 'boots_snowglobe_fur_booties', back: 'boots_snowglobe_fur_booties' } },
  // ★2 Epic Full-Wear Set E10 — Starlight Genie-Lamp Jeweler
  hat_genie_lamp_pillbox_crown: { bone: 'HEAD', hairCover: 'top', offset: [0.00, 1.08], scale: 1.30, offsets: { side: [-0.02, 1.05], back: [0.00, 1.03] }, scales: { side: 1.22, back: 1.30 }, views: { front: 'hat_genie_lamp_pillbox_crown', side: 'hat_genie_lamp_pillbox_crown_side', back: 'hat_genie_lamp_pillbox_crown_back' } },
  face_mirage_coin_veil_glasses: { bone: 'HEAD', anchor: 'eyes', leftEye: [0.494, 0.462], rightEye: [0.837, 0.462], eyeCenter: [0.665, 0.462], eyeSpan: 0.343, offset: [0, 0], scale: 1.0, views: { front: 'face_mirage_coin_veil_glasses', side: null, back: null } },
  gloves_genie_magic_lamp_wand: { bone: 'ARM', singleHand: true, grip: [0.554, 0.24], tilt: [-0.28, -0.50], offset: [0, 0], scale: 0.84, views: { front: 'gloves_genie_magic_lamp_wand', side: 'gloves_genie_magic_lamp_wand', back: 'gloves_genie_magic_lamp_wand' } },
  boots_mirage_curl_slippers: { bone: 'LEG', offset: [0.055, -0.385], scale: 0.49, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_mirage_curl_slippers', side: 'boots_mirage_curl_slippers', back: 'boots_mirage_curl_slippers' } },
  // ★1 Rare Full-Wear Set R1 — Uji-Matcha Hanami Dango Server
  hat_hanami_dango_beret: { bone: 'HEAD', hairCover: 'top', offset: [0.00, 1.00], scale: 1.36, offsets: { side: [-0.02, 0.99], back: [0.00, 0.97] }, scales: { side: 1.26, back: 1.36 }, views: { front: 'hat_hanami_dango_beret', side: 'hat_hanami_dango_beret_side', back: 'hat_hanami_dango_beret_back' } },
  face_dango_skewer_glasses: { bone: 'HEAD', anchor: 'eyes', leftEye: [0.477, 0.347], rightEye: [0.828, 0.347], eyeCenter: [0.652, 0.347], eyeSpan: 0.351, offset: [0, 0], scale: 1.0, views: { front: 'face_dango_skewer_glasses', side: null, back: null } },
  gloves_giant_dango_skewer: { bone: 'ARM', singleHand: true, grip: [0.347, 0.24], tilt: [-0.26, -0.48], offset: [0, 0], scale: 0.78, views: { front: 'gloves_giant_dango_skewer', side: 'gloves_giant_dango_skewer', back: 'gloves_giant_dango_skewer' } },
  boots_matcha_mochi_booties: { bone: 'LEG', offset: [0.055, -0.385], scale: 0.49, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_matcha_mochi_booties', side: 'boots_matcha_mochi_booties', back: 'boots_matcha_mochi_booties' } },
  // ★1 Rare Full-Wear Set R2 — Teacup Pomeranian Pet Stylist
  hat_pomeranian_puff_beret: { bone: 'HEAD', hairCover: 'top', offset: [-0.02, 1.02], scale: 1.34, offsets: { side: [-0.02, 1.01], back: [0.00, 1.00] }, scales: { side: 1.24, back: 1.34 }, views: { front: 'hat_pomeranian_puff_beret', side: 'hat_pomeranian_puff_beret_side', back: 'hat_pomeranian_puff_beret_back' } },
  face_puppy_bone_glasses: { bone: 'HEAD', anchor: 'eyes', leftEye: [0.515, 0.395], rightEye: [0.845, 0.395], eyeCenter: [0.680, 0.395], eyeSpan: 0.330, offset: [0, 0], scale: 1.0, views: { front: 'face_puppy_bone_glasses', side: null, back: null } },
  gloves_grooming_dryer_wand: { bone: 'ARM', singleHand: true, grip: [0.660, 0.22], tilt: [-0.16, -0.32], offset: [0, 0], scale: 0.76, views: { front: 'gloves_grooming_dryer_wand', side: 'gloves_grooming_dryer_wand', back: 'gloves_grooming_dryer_wand' } },
  boots_pomeranian_paw_sneakers: { bone: 'LEG', offset: [0.055, -0.385], scale: 0.49, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_pomeranian_paw_sneakers', side: 'boots_pomeranian_paw_sneakers', back: 'boots_pomeranian_paw_sneakers' } },
  // ★1 Rare Full-Wear Set R3 — Berry-Quill Hedgehog Baker
  hat_hedgehog_berry_beret: { bone: 'HEAD', hairCover: 'top', offset: [0.00, 1.04], scale: 1.34, offsets: { side: [-0.02, 1.03], back: [0.00, 1.01] }, scales: { side: 1.24, back: 1.34 }, views: { front: 'hat_hedgehog_berry_beret', side: 'hat_hedgehog_berry_beret_side', back: 'hat_hedgehog_berry_beret_back' } },
  face_strawberry_seed_glasses: { bone: 'HEAD', anchor: 'eyes', leftEye: [0.485, 0.393], rightEye: [0.829, 0.393], eyeCenter: [0.657, 0.393], eyeSpan: 0.344, offset: [0, 0], scale: 1.0, views: { front: 'face_strawberry_seed_glasses', side: null, back: null } },
  gloves_berry_rolling_pin_mallet: { bone: 'ARM', singleHand: true, grip: [0.365, 0.24], tilt: [-0.28, -0.50], offset: [0, 0], scale: 0.78, views: { front: 'gloves_berry_rolling_pin_mallet', side: 'gloves_berry_rolling_pin_mallet', back: 'gloves_berry_rolling_pin_mallet' } },
  boots_hedgehog_quill_booties: { bone: 'LEG', offset: [0.055, -0.385], scale: 0.49, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_hedgehog_quill_booties', side: 'boots_hedgehog_quill_booties', back: 'boots_hedgehog_quill_booties' } },
  // ★1 Rare Full-Wear Set R4 — Marimo & Axolotl Water Keeper
  hat_marimo_axolotl_cap: { bone: 'HEAD', hairCover: 'top', offset: [0.00, 1.03], scale: 1.34, offsets: { side: [-0.02, 1.02], back: [0.00, 1.00] }, scales: { side: 1.24, back: 1.34 }, views: { front: 'hat_marimo_axolotl_cap', side: 'hat_marimo_axolotl_cap_side', back: 'hat_marimo_axolotl_cap_back' } },
  face_marimo_waterdrop_glasses: { bone: 'HEAD', anchor: 'eyes', leftEye: [0.498, 0.335], rightEye: [0.824, 0.335], eyeCenter: [0.661, 0.335], eyeSpan: 0.326, offset: [0, 0], scale: 1.0, views: { front: 'face_marimo_waterdrop_glasses', side: null, back: null } },
  gloves_aquarium_scoop_net: { bone: 'ARM', singleHand: true, grip: [0.189, 0.24], tilt: [-0.26, -0.48], offset: [0, 0], scale: 0.78, views: { front: 'gloves_aquarium_scoop_net', side: 'gloves_aquarium_scoop_net', back: 'gloves_aquarium_scoop_net' } },
  boots_marimo_bubble_wellies: { bone: 'LEG', offset: [0.055, -0.385], scale: 0.49, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_marimo_bubble_wellies', side: 'boots_marimo_bubble_wellies', back: 'boots_marimo_bubble_wellies' } },
  // ★1 Rare Full-Wear Set R5 — Grand-Archive Barn-Owl Scholar
  hat_sleepy_owl_mortarboard: { bone: 'HEAD', hairCover: 'top', offset: [0.03, 1.00], scale: 1.34, offsets: { side: [-0.02, 1.01], back: [0.00, 1.00] }, scales: { side: 1.24, back: 1.32 }, views: { front: 'hat_sleepy_owl_mortarboard', side: 'hat_sleepy_owl_mortarboard_side', back: 'hat_sleepy_owl_mortarboard_back' } },
  face_owl_feather_spectacles: { bone: 'HEAD', anchor: 'eyes', leftEye: [0.462, 0.406], rightEye: [0.802, 0.406], eyeCenter: [0.632, 0.406], eyeSpan: 0.34, offset: [0, 0], scale: 1.0, views: { front: 'face_owl_feather_spectacles', side: null, back: null } },
  gloves_giant_quill_ink_lance: { bone: 'ARM', singleHand: true, grip: [0.301, 0.24], tilt: [-0.26, -0.48], offset: [0, 0], scale: 0.78, views: { front: 'gloves_giant_quill_ink_lance', side: 'gloves_giant_quill_ink_lance', back: 'gloves_giant_quill_ink_lance' } },
  boots_owl_buckle_oxfords: { bone: 'LEG', offset: [0.055, -0.385], scale: 0.49, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_owl_buckle_oxfords', side: 'boots_owl_buckle_oxfords', back: 'boots_owl_buckle_oxfords' } },
  // ★1 Rare Full-Wear Set R6 — Sunny Sunflower Bee Gardener
  hat_sunflower_bumble_beret: { bone: 'HEAD', hairCover: 'top', offset: [0.00, 1.02], scale: 1.36, offsets: { side: [-0.02, 1.01], back: [0.00, 0.99] }, scales: { side: 1.26, back: 1.36 }, views: { front: 'hat_sunflower_bumble_beret', side: 'hat_sunflower_bumble_beret_side', back: 'hat_sunflower_bumble_beret_back' } },
  face_sunflower_petal_glasses: { bone: 'HEAD', anchor: 'eyes', leftEye: [0.494, 0.392], rightEye: [0.833, 0.392], eyeCenter: [0.663, 0.392], eyeSpan: 0.339, offset: [0, 0], scale: 1.0, views: { front: 'face_sunflower_petal_glasses', side: null, back: null } },
  gloves_sunflower_watering_can: { bone: 'ARM', singleHand: true, grip: [0.279, 0.24], tilt: [-0.18, -0.36], offset: [0, 0], scale: 0.76, views: { front: 'gloves_sunflower_watering_can', side: 'gloves_sunflower_watering_can', back: 'gloves_sunflower_watering_can' } },
  boots_sunflower_garden_clogs: { bone: 'LEG', offset: [0.055, -0.385], scale: 0.49, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_sunflower_garden_clogs', side: 'boots_sunflower_garden_clogs', back: 'boots_sunflower_garden_clogs' } },
  // ★1 Rare Full-Wear Set R7 — Pastel Macaron-Tier Patissier
  hat_macaron_stack_beret: { bone: 'HEAD', hairCover: 'top', offset: [0.00, 1.03], scale: 1.36, offsets: { side: [-0.02, 1.02], back: [0.00, 1.00] }, scales: { side: 1.26, back: 1.36 }, views: { front: 'hat_macaron_stack_beret', side: 'hat_macaron_stack_beret_side', back: 'hat_macaron_stack_beret_back' } },
  face_macaron_cookie_glasses: { bone: 'HEAD', anchor: 'eyes', leftEye: [0.502, 0.403], rightEye: [0.841, 0.403], eyeCenter: [0.671, 0.403], eyeSpan: 0.339, offset: [0, 0], scale: 1.0, views: { front: 'face_macaron_cookie_glasses', side: null, back: null } },
  gloves_buttercream_piping_bag: { bone: 'ARM', singleHand: true, grip: [0.276, 0.24], tilt: [-0.24, -0.45], offset: [0, 0], scale: 0.78, views: { front: 'gloves_buttercream_piping_bag', side: 'gloves_buttercream_piping_bag', back: 'gloves_buttercream_piping_bag' } },
  boots_macaron_frill_shoes: { bone: 'LEG', offset: [0.055, -0.385], scale: 0.49, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_macaron_frill_shoes', side: 'boots_macaron_frill_shoes', back: 'boots_macaron_frill_shoes' } },
  // ★1 Rare Full-Wear Set R8 — Cable-Knit Yarn-Kitten Crafter
  hat_yarn_ball_kitten_beanie: { bone: 'HEAD', hairCover: 'top', offset: [0.00, 1.02], scale: 1.36, offsets: { side: [-0.02, 1.01], back: [0.00, 0.99] }, scales: { side: 1.26, back: 1.36 }, views: { front: 'hat_yarn_ball_kitten_beanie', side: 'hat_yarn_ball_kitten_beanie_side', back: 'hat_yarn_ball_kitten_beanie_back' } },
  face_yarn_stitch_glasses: { bone: 'HEAD', anchor: 'eyes', leftEye: [0.523, 0.45], rightEye: [0.841, 0.45], eyeCenter: [0.682, 0.45], eyeSpan: 0.318, offset: [0, 0], scale: 1.0, views: { front: 'face_yarn_stitch_glasses', side: null, back: null } },
  gloves_giant_knitting_needle_lance: { bone: 'ARM', singleHand: true, grip: [0.396, 0.24], tilt: [-0.26, -0.48], offset: [0, 0], scale: 0.78, views: { front: 'gloves_giant_knitting_needle_lance', side: 'gloves_giant_knitting_needle_lance', back: 'gloves_giant_knitting_needle_lance' } },
  boots_cable_knit_pom_boots: { bone: 'LEG', offset: [0.055, -0.385], scale: 0.49, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_cable_knit_pom_boots', side: 'boots_cable_knit_pom_boots', back: 'boots_cable_knit_pom_boots' } },
  // ★1 Rare Full-Wear Set R9 — Retro Cherry-Soda Roller Carhop
  hat_cherry_float_diner_cap: { bone: 'HEAD', hairCover: 'top', offset: [0.00, 1.03], scale: 1.34, offsets: { side: [-0.02, 1.01], back: [0.00, 0.99] }, scales: { side: 1.24, back: 1.34 }, views: { front: 'hat_cherry_float_diner_cap', side: 'hat_cherry_float_diner_cap_side', back: 'hat_cherry_float_diner_cap_back' } },
  face_cherry_cat_eye_glasses: { bone: 'HEAD', anchor: 'eyes', leftEye: [0.496, 0.4], rightEye: [0.817, 0.4], eyeCenter: [0.656, 0.4], eyeSpan: 0.321, offset: [0, 0], scale: 1.0, views: { front: 'face_cherry_cat_eye_glasses', side: null, back: null } },
  gloves_cherry_soda_float_wand: { bone: 'ARM', singleHand: true, grip: [0.311, 0.24], tilt: [-0.22, -0.44], offset: [0, 0], scale: 0.76, views: { front: 'gloves_cherry_soda_float_wand', side: 'gloves_cherry_soda_float_wand', back: 'gloves_cherry_soda_float_wand' } },
  boots_retro_roller_skates: { bone: 'LEG', offset: [0.055, -0.385], scale: 0.49, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_retro_roller_skates', side: 'boots_retro_roller_skates', back: 'boots_retro_roller_skates' } },
  // ★1 Rare Full-Wear Set R10 — Cinnamon Red-Panda Bamboo Scout
  hat_red_panda_scout_beret: { bone: 'HEAD', hairCover: 'top', offset: [0.00, 1.02], scale: 1.36, offsets: { side: [-0.02, 1.01], back: [0.00, 0.99] }, scales: { side: 1.26, back: 1.36 }, views: { front: 'hat_red_panda_scout_beret', side: 'hat_red_panda_scout_beret_side', back: 'hat_red_panda_scout_beret_back' } },
  face_bamboo_leaf_glasses: { bone: 'HEAD', anchor: 'eyes', leftEye: [0.489, 0.413], rightEye: [0.824, 0.413], eyeCenter: [0.656, 0.413], eyeSpan: 0.335, offset: [0, 0], scale: 1.0, views: { front: 'face_bamboo_leaf_glasses', side: null, back: null } },
  gloves_bamboo_acorn_staff: { bone: 'ARM', singleHand: true, grip: [0.26, 0.24], tilt: [-0.26, -0.48], offset: [0, 0], scale: 0.78, views: { front: 'gloves_bamboo_acorn_staff', side: 'gloves_bamboo_acorn_staff', back: 'gloves_bamboo_acorn_staff' } },
  boots_red_panda_trail_boots: { bone: 'LEG', offset: [0.055, -0.385], scale: 0.49, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_red_panda_trail_boots', side: 'boots_red_panda_trail_boots', back: 'boots_red_panda_trail_boots' } },
  // ★1 Rare Full-Wear Set R11 — Botanical Lavender Herbalist
  hat_lavender_herb_witch_beret: { bone: 'HEAD', hairCover: 'top', offset: [0.03, 1.01], scale: 1.36, offsets: { side: [-0.02, 1.00], back: [0.00, 0.98] }, scales: { side: 1.26, back: 1.36 }, views: { front: 'hat_lavender_herb_witch_beret', side: 'hat_lavender_herb_witch_beret_side', back: 'hat_lavender_herb_witch_beret_back' } },
  face_botanical_herb_glasses: { bone: 'HEAD', anchor: 'eyes', leftEye: [0.494, 0.327], rightEye: [0.838, 0.327], eyeCenter: [0.666, 0.327], eyeSpan: 0.344, offset: [0, 0], scale: 1.0, views: { front: 'face_botanical_herb_glasses', side: null, back: null } },
  gloves_amethyst_pestle_censer: { bone: 'ARM', singleHand: true, grip: [0.528, 0.24], tilt: [-0.26, -0.48], offset: [0, 0], scale: 0.78, views: { front: 'gloves_amethyst_pestle_censer', side: 'gloves_amethyst_pestle_censer', back: 'gloves_amethyst_pestle_censer' } },
  boots_lavender_linen_booties: { bone: 'LEG', offset: [0.055, -0.385], scale: 0.49, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_lavender_linen_booties', side: 'boots_lavender_linen_booties', back: 'boots_lavender_linen_booties' } },
  // ★1 Rare Full-Wear Set R12 — Starry Origami Paper-Boat Sailor
  hat_origami_paper_boat_hat: { bone: 'HEAD', hairCover: 'top', offset: [0.00, 1.01], scale: 1.36, offsets: { side: [-0.02, 1.00], back: [0.00, 0.98] }, scales: { side: 1.26, back: 1.36 }, views: { front: 'hat_origami_paper_boat_hat', side: 'hat_origami_paper_boat_hat_side', back: 'hat_origami_paper_boat_hat_back' } },
  face_paper_cloud_glasses: { bone: 'HEAD', anchor: 'eyes', leftEye: [0.483, 0.362], rightEye: [0.814, 0.362], eyeCenter: [0.648, 0.362], eyeSpan: 0.331, offset: [0, 0], scale: 1.0, views: { front: 'face_paper_cloud_glasses', side: null, back: null } },
  gloves_star_pinwheel_wand: { bone: 'ARM', singleHand: true, grip: [0.529, 0.24], tilt: [-0.26, -0.48], offset: [0, 0], scale: 0.78, views: { front: 'gloves_star_pinwheel_wand', side: 'gloves_star_pinwheel_wand', back: 'gloves_star_pinwheel_wand' } },
  boots_paper_boat_sailor_shoes: { bone: 'LEG', offset: [0.055, -0.385], scale: 0.49, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_paper_boat_sailor_shoes', side: 'boots_paper_boat_sailor_shoes', back: 'boots_paper_boat_sailor_shoes' } },
  // ★1 Rare Full-Wear Set R13 — Fluffy Harp-Seal Peach Romper
  hat_chubby_seal_peach_cap: { bone: 'HEAD', hairCover: 'top', offset: [0.00, 1.03], scale: 1.36, offsets: { side: [-0.02, 1.02], back: [0.00, 1.00] }, scales: { side: 1.26, back: 1.36 }, views: { front: 'hat_chubby_seal_peach_cap', side: 'hat_chubby_seal_peach_cap_side', back: 'hat_chubby_seal_peach_cap_back' } },
  face_seal_whisker_glasses: { bone: 'HEAD', anchor: 'eyes', leftEye: [0.511, 0.368], rightEye: [0.828, 0.368], eyeCenter: [0.669, 0.368], eyeSpan: 0.317, offset: [0, 0], scale: 1.0, views: { front: 'face_seal_whisker_glasses', side: null, back: null } },
  gloves_seal_beachball_scepter: { bone: 'ARM', singleHand: true, grip: [0.5, 0.24], tilt: [-0.26, -0.48], offset: [0, 0], scale: 0.78, views: { front: 'gloves_seal_beachball_scepter', side: 'gloves_seal_beachball_scepter', back: 'gloves_seal_beachball_scepter' } },
  boots_seal_flipper_slippers: { bone: 'LEG', offset: [0.055, -0.385], scale: 0.49, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_seal_flipper_slippers', side: 'boots_seal_flipper_slippers', back: 'boots_seal_flipper_slippers' } },
  // ★1 Rare Full-Wear Set R14 — Sugar-Plum Toy-Soldier Parade
  hat_toy_soldier_shako_crown: { bone: 'HEAD', hairCover: 'top', offset: [0.02, 1.00], scale: 1.32, offsets: { side: [-0.02, 1.00], back: [0.00, 0.99] }, scales: { side: 1.22, back: 1.30 }, views: { front: 'hat_toy_soldier_shako_crown', side: 'hat_toy_soldier_shako_crown_side', back: 'hat_toy_soldier_shako_crown_back' } },
  face_nutcracker_star_glasses: { bone: 'HEAD', anchor: 'eyes', leftEye: [0.48, 0.378], rightEye: [0.81, 0.378], eyeCenter: [0.645, 0.378], eyeSpan: 0.33, offset: [0, 0], scale: 1.0, views: { front: 'face_nutcracker_star_glasses', side: null, back: null } },
  gloves_peppermint_drum_mallet: { bone: 'ARM', singleHand: true, grip: [0.51, 0.24], tilt: [-0.28, -0.50], offset: [0, 0], scale: 0.78, views: { front: 'gloves_peppermint_drum_mallet', side: 'gloves_peppermint_drum_mallet', back: 'gloves_peppermint_drum_mallet' } },
  boots_toy_soldier_parade_boots: { bone: 'LEG', offset: [0.055, -0.385], scale: 0.49, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_toy_soldier_parade_boots', side: 'boots_toy_soldier_parade_boots', back: 'boots_toy_soldier_parade_boots' } },
  // ★1 Rare Full-Wear Set R15 — Firefly & Lotus-Lantern Haori
  hat_firefly_lotus_crown: { bone: 'HEAD', hairCover: 'helm', offset: [0.00, 1.03], scale: 1.32, offsets: { side: [-0.02, 1.02], back: [0.00, 0.94] }, scales: { side: 1.20, back: 1.20 }, views: { front: 'hat_firefly_lotus_crown', side: 'hat_firefly_lotus_crown_side', back: 'hat_firefly_lotus_crown_back' } },
  face_firefly_glow_glasses: { bone: 'HEAD', anchor: 'eyes', leftEye: [0.483, 0.359], rightEye: [0.826, 0.359], eyeCenter: [0.654, 0.359], eyeSpan: 0.343, offset: [0, 0], scale: 1.0, views: { front: 'face_firefly_glow_glasses', side: null, back: null } },
  gloves_firefly_lantern_staff: { bone: 'ARM', singleHand: true, grip: [0.495, 0.24], tilt: [-0.26, -0.48], offset: [0, 0], scale: 0.78, views: { front: 'gloves_firefly_lantern_staff', side: 'gloves_firefly_lantern_staff', back: 'gloves_firefly_lantern_staff' } },
  boots_firefly_lotus_sandals: { bone: 'LEG', offset: [0.055, -0.385], scale: 0.49, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_firefly_lotus_sandals', side: 'boots_firefly_lotus_sandals', back: 'boots_firefly_lotus_sandals' } },
  // ── 12 OUT-OF-THE-BOX CREATIVE BACK DIORAMAS & OVERSIZED BACKPACKS (socket: 'shoulders' 1-piece contraptions) ──
  // ★3 Mythic Grand Back-Dioramas (3) — wide panoramic casino, amusement & dragon-vault contraptions
  back_mythic_jackpot_roulette: { bone: 'TORSO', socket: 'shoulders', offset: [0.00, 0.08], scale: 2.68, offsets: { side: [-0.34, 0.06], back: [0.00, 0.04] }, scales: { side: 1.54, back: 2.56 }, views: { front: 'back_mythic_jackpot_roulette', side: 'back_mythic_jackpot_roulette', back: 'back_mythic_jackpot_roulette' } },
  back_mythic_ferris_carnival:  { bone: 'TORSO', socket: 'shoulders', offset: [0.00, 0.08], scale: 2.68, offsets: { side: [-0.34, 0.06], back: [0.00, 0.04] }, scales: { side: 1.54, back: 2.56 }, views: { front: 'back_mythic_ferris_carnival',  side: 'back_mythic_ferris_carnival',  back: 'back_mythic_ferris_carnival' } },
  back_mythic_dragon_hoard_vault: { bone: 'TORSO', socket: 'shoulders', offset: [0.00, 0.06], scale: 2.72, offsets: { side: [-0.34, 0.05], back: [0.00, 0.02] }, scales: { side: 1.56, back: 2.60 }, views: { front: 'back_mythic_dragon_hoard_vault', side: 'back_mythic_dragon_hoard_vault', back: 'back_mythic_dragon_hoard_vault' } },
  // ★2 Epic Oversized Machine & Diorama Backpacks (4) — wide horizontal arcade/train/sushi/gacha contraptions
  back_epic_claw_machine_cabinet: { bone: 'TORSO', socket: 'shoulders', offset: [-0.02, 0.07], scale: 2.22, offsets: { side: [-0.32, 0.06], back: [0.00, 0.03] }, scales: { side: 1.36, back: 2.12 }, views: { front: 'back_epic_claw_machine_cabinet', side: 'back_epic_claw_machine_cabinet', back: 'back_epic_claw_machine_cabinet' } },
  back_epic_clockwork_train_pack: { bone: 'TORSO', socket: 'shoulders', offset: [-0.02, 0.07], scale: 2.22, offsets: { side: [-0.32, 0.06], back: [0.00, 0.03] }, scales: { side: 1.36, back: 2.12 }, views: { front: 'back_epic_clockwork_train_pack', side: 'back_epic_clockwork_train_pack', back: 'back_epic_clockwork_train_pack' } },
  back_epic_sushi_conveyor_halo:  { bone: 'TORSO', socket: 'shoulders', offset: [0.00, 0.06], scale: 2.26, offsets: { side: [-0.32, 0.05], back: [0.00, 0.03] }, scales: { side: 1.38, back: 2.16 }, views: { front: 'back_epic_sushi_conveyor_halo',  side: 'back_epic_sushi_conveyor_halo',  back: 'back_epic_sushi_conveyor_halo' } },
  back_epic_gachapon_castle_tower:{ bone: 'TORSO', socket: 'shoulders', offset: [-0.02, 0.07], scale: 2.20, offsets: { side: [-0.32, 0.06], back: [0.00, 0.03] }, scales: { side: 1.36, back: 2.10 }, views: { front: 'back_epic_gachapon_castle_tower', side: 'back_epic_gachapon_castle_tower', back: 'back_epic_gachapon_castle_tower' } },
  // ★1 Rare Cute Oversized Everyday/Food/Critter Backpacks (5)
  back_rare_toaster_shiba_pack:   { bone: 'TORSO', socket: 'shoulders', offset: [-0.08, 0.10], scale: 1.72, offsets: { side: [-0.30, 0.06], back: [0.00, 0.04] }, scales: { side: 1.16, back: 1.66 }, views: { front: 'back_rare_toaster_shiba_pack',   side: 'back_rare_toaster_shiba_pack',   back: 'back_rare_toaster_shiba_pack' } },
  back_rare_washing_machine_duck: { bone: 'TORSO', socket: 'shoulders', offset: [-0.06, 0.06], scale: 1.88, offsets: { side: [-0.30, 0.05], back: [0.00, 0.02] }, scales: { side: 1.22, back: 1.82 }, views: { front: 'back_rare_washing_machine_duck', side: 'back_rare_washing_machine_duck', back: 'back_rare_washing_machine_duck' } },
  back_rare_cuckoo_clock_house:   { bone: 'TORSO', socket: 'shoulders', offset: [-0.06, 0.06], scale: 1.88, offsets: { side: [-0.30, 0.05], back: [0.00, 0.02] }, scales: { side: 1.22, back: 1.82 }, views: { front: 'back_rare_cuckoo_clock_house',   side: 'back_rare_cuckoo_clock_house',   back: 'back_rare_cuckoo_clock_house' } },
  back_rare_cup_noodle_onsen:     { bone: 'TORSO', socket: 'shoulders', offset: [-0.08, 0.09], scale: 1.72, offsets: { side: [-0.30, 0.06], back: [0.00, 0.04] }, scales: { side: 1.16, back: 1.66 }, views: { front: 'back_rare_cup_noodle_onsen',     side: 'back_rare_cup_noodle_onsen',     back: 'back_rare_cup_noodle_onsen' } },
  back_rare_vending_drink_fridge: { bone: 'TORSO', socket: 'shoulders', offset: [-0.06, 0.06], scale: 1.86, offsets: { side: [-0.30, 0.05], back: [0.00, 0.02] }, scales: { side: 1.20, back: 1.80 }, views: { front: 'back_rare_vending_drink_fridge', side: 'back_rare_vending_drink_fridge', back: 'back_rare_vending_drink_fridge' } },
  // ── 36 MATCHING HEADDRESSES, HELD-WEAPON GLOVES & BOOTS FOR THE 12 OUT-OF-THE-BOX BACK SETS ──
  // ★3 Mythic Set M1 — Monte-Carlo Jackpot Roulette
  hat_mythic_jackpot_crown:          { bone: 'HEAD', hairCover: 'helm', offset: [0.00, 1.08], scale: 1.30, offsets: { side: [-0.02, 1.07], back: [0.00, 1.05] }, scales: { side: 1.18, back: 1.28 }, views: { front: 'hat_mythic_jackpot_crown', side: 'hat_mythic_jackpot_crown_side', back: 'hat_mythic_jackpot_crown_back' } },
  gloves_mythic_croupier_rake:       { bone: 'ARM', singleHand: true, grip: [0.579, 0.24], tilt: [-0.26, -0.48], offset: [0, 0], scale: 0.88, views: { front: 'gloves_mythic_croupier_rake', side: 'gloves_mythic_croupier_rake', back: 'gloves_mythic_croupier_rake' } },
  boots_mythic_roulette_heels:       { bone: 'LEG', offset: [0.055, -0.385], scale: 0.50, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_mythic_roulette_heels', side: 'boots_mythic_roulette_heels', back: 'boots_mythic_roulette_heels' } },
  // ★3 Mythic Set M2 — Celestial Dreamland Ferris & Coaster
  hat_mythic_carnival_carousel_crown:{ bone: 'HEAD', hairCover: 'top', offset: [0.00, 1.12], scale: 1.26, offsets: { side: [-0.02, 1.10], back: [0.00, 1.08] }, scales: { side: 1.16, back: 1.24 }, views: { front: 'hat_mythic_carnival_carousel_crown', side: 'hat_mythic_carnival_carousel_crown_side', back: 'hat_mythic_carnival_carousel_crown_back' } },
  gloves_mythic_ferris_star_scepter: { bone: 'ARM', singleHand: true, grip: [0.543, 0.24], tilt: [-0.26, -0.48], offset: [0, 0], scale: 0.88, views: { front: 'gloves_mythic_ferris_star_scepter', side: 'gloves_mythic_ferris_star_scepter', back: 'gloves_mythic_ferris_star_scepter' } },
  boots_mythic_coaster_wing_boots:   { bone: 'LEG', offset: [0.055, -0.385], scale: 0.50, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_mythic_coaster_wing_boots', side: 'boots_mythic_coaster_wing_boots', back: 'boots_mythic_coaster_wing_boots' } },
  // ★3 Mythic Set M3 — Sovereign Bahamut Treasure-Vault
  hat_mythic_dragon_hoard_crown:     { bone: 'HEAD', hairCover: 'helm', offset: [-0.02, 1.04], scale: 1.32, offsets: { side: [-0.02, 1.04], back: [0.00, 1.03] }, scales: { side: 1.20, back: 1.30 }, views: { front: 'hat_mythic_dragon_hoard_crown', side: 'hat_mythic_dragon_hoard_crown_side', back: 'hat_mythic_dragon_hoard_crown_back' } },
  gloves_mythic_vault_key_scepter:   { bone: 'ARM', singleHand: true, grip: [0.551, 0.24], tilt: [-0.26, -0.48], offset: [0, 0], scale: 0.88, views: { front: 'gloves_mythic_vault_key_scepter', side: 'gloves_mythic_vault_key_scepter', back: 'gloves_mythic_vault_key_scepter' } },
  boots_mythic_dragon_bullion_greaves:{ bone: 'LEG', offset: [0.055, -0.385], scale: 0.50, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_mythic_dragon_bullion_greaves', side: 'boots_mythic_dragon_bullion_greaves', back: 'boots_mythic_dragon_bullion_greaves' } },
  // ★2 Epic Set E1 — Giant Neon Nekopon Claw-Machine
  hat_epic_claw_plush_cap:           { bone: 'HEAD', hairCover: 'top', offset: [0.00, 1.10], scale: 1.28, offsets: { side: [-0.02, 1.09], back: [0.00, 1.07] }, scales: { side: 1.18, back: 1.26 }, views: { front: 'hat_epic_claw_plush_cap', side: 'hat_epic_claw_plush_cap_side', back: 'hat_epic_claw_plush_cap_back' } },
  gloves_epic_arcade_claw_grabber:   { bone: 'ARM', singleHand: true, grip: [0.427, 0.24], tilt: [-0.26, -0.48], offset: [0, 0], scale: 0.82, views: { front: 'gloves_epic_arcade_claw_grabber', side: 'gloves_epic_arcade_claw_grabber', back: 'gloves_epic_arcade_claw_grabber' } },
  boots_epic_arcade_token_kicks:     { bone: 'LEG', offset: [0.055, -0.385], scale: 0.49, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_epic_arcade_token_kicks', side: 'boots_epic_arcade_token_kicks', back: 'boots_epic_arcade_token_kicks' } },
  // ★2 Epic Set E2 — Starlight Express Steam-Locomotive
  hat_epic_conductor_train_cap:      { bone: 'HEAD', hairCover: 'top', offset: [0.00, 1.09], scale: 1.28, offsets: { side: [-0.02, 1.08], back: [0.00, 1.06] }, scales: { side: 1.18, back: 1.26 }, views: { front: 'hat_epic_conductor_train_cap', side: 'hat_epic_conductor_train_cap_side', back: 'hat_epic_conductor_train_cap_back' } },
  gloves_epic_train_signal_lantern:  { bone: 'ARM', singleHand: true, grip: [0.395, 0.24], tilt: [-0.26, -0.48], offset: [0, 0], scale: 0.82, views: { front: 'gloves_epic_train_signal_lantern', side: 'gloves_epic_train_signal_lantern', back: 'gloves_epic_train_signal_lantern' } },
  boots_epic_locomotive_wheel_boots: { bone: 'LEG', offset: [0.055, -0.385], scale: 0.49, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_epic_locomotive_wheel_boots', side: 'boots_epic_locomotive_wheel_boots', back: 'boots_epic_locomotive_wheel_boots' } },
  // ★2 Epic Set E3 — Imperial Kaiten-Sushi Conveyor Neko
  hat_epic_neko_sushi_headband:      { bone: 'HEAD', hairCover: 'top', offset: [0.00, 1.01], scale: 1.34, offsets: { side: [-0.02, 1.01], back: [0.00, 1.01] }, scales: { side: 1.22, back: 1.32 }, views: { front: 'hat_epic_neko_sushi_headband', side: 'hat_epic_neko_sushi_headband_side', back: 'hat_epic_neko_sushi_headband_back' } },
  gloves_epic_sushi_paddle_fan:      { bone: 'ARM', singleHand: true, grip: [0.496, 0.24], tilt: [-0.26, -0.48], offset: [0, 0], scale: 0.82, views: { front: 'gloves_epic_sushi_paddle_fan', side: 'gloves_epic_sushi_paddle_fan', back: 'gloves_epic_sushi_paddle_fan' } },
  boots_epic_sushi_geta_booties:     { bone: 'LEG', offset: [0.055, -0.385], scale: 0.49, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_epic_sushi_geta_booties', side: 'boots_epic_sushi_geta_booties', back: 'boots_epic_sushi_geta_booties' } },
  // ★2 Epic Set E4 — Giant Crystal Gachapon Tower
  hat_epic_gachapon_dome_beret:      { bone: 'HEAD', hairCover: 'top', offset: [0.00, 1.08], scale: 1.30, offsets: { side: [-0.02, 1.07], back: [0.00, 1.05] }, scales: { side: 1.18, back: 1.28 }, views: { front: 'hat_epic_gachapon_dome_beret', side: 'hat_epic_gachapon_dome_beret_side', back: 'hat_epic_gachapon_dome_beret_back' } },
  gloves_epic_gachapon_crank_scepter:{ bone: 'ARM', singleHand: true, grip: [0.392, 0.24], tilt: [-0.26, -0.48], offset: [0, 0], scale: 0.82, views: { front: 'gloves_epic_gachapon_crank_scepter', side: 'gloves_epic_gachapon_crank_scepter', back: 'gloves_epic_gachapon_crank_scepter' } },
  boots_epic_gachapon_capsule_booties:{ bone: 'LEG', offset: [0.055, -0.385], scale: 0.49, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_epic_gachapon_capsule_booties', side: 'boots_epic_gachapon_capsule_booties', back: 'boots_epic_gachapon_capsule_booties' } },
  // ★1 Rare Set R1 — Pop-Up Retro Toaster & Shiba-Bread
  hat_rare_shiba_toast_beret:        { bone: 'HEAD', hairCover: 'top', offset: [0.00, 1.04], scale: 1.32, offsets: { side: [-0.02, 1.04], back: [0.00, 1.02] }, scales: { side: 1.20, back: 1.30 }, views: { front: 'hat_rare_shiba_toast_beret', side: 'hat_rare_shiba_toast_beret_side', back: 'hat_rare_shiba_toast_beret_back' } },
  gloves_rare_butter_jam_spreader:   { bone: 'ARM', singleHand: true, grip: [0.315, 0.24], tilt: [-0.26, -0.48], offset: [0, 0], scale: 0.78, views: { front: 'gloves_rare_butter_jam_spreader', side: 'gloves_rare_butter_jam_spreader', back: 'gloves_rare_butter_jam_spreader' } },
  boots_rare_toaster_crumb_loafers:  { bone: 'LEG', offset: [0.055, -0.385], scale: 0.49, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_rare_toaster_crumb_loafers', side: 'boots_rare_toaster_crumb_loafers', back: 'boots_rare_toaster_crumb_loafers' } },
  // ★1 Rare Set R2 — Sudsy Front-Load Washer & Rubber-Duckie
  hat_rare_sudsy_duck_cap:           { bone: 'HEAD', hairCover: 'top', offset: [0.00, 1.08], scale: 1.30, offsets: { side: [-0.02, 1.07], back: [0.00, 1.05] }, scales: { side: 1.18, back: 1.28 }, views: { front: 'hat_rare_sudsy_duck_cap', side: 'hat_rare_sudsy_duck_cap_side', back: 'hat_rare_sudsy_duck_cap_back' } },
  gloves_rare_bubble_wand_duck:      { bone: 'ARM', singleHand: true, grip: [0.546, 0.24], tilt: [-0.26, -0.48], offset: [0, 0], scale: 0.78, views: { front: 'gloves_rare_bubble_wand_duck', side: 'gloves_rare_bubble_wand_duck', back: 'gloves_rare_bubble_wand_duck' } },
  boots_rare_washer_bubble_wellies:  { bone: 'LEG', offset: [0.055, -0.385], scale: 0.49, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_rare_washer_bubble_wellies', side: 'boots_rare_washer_bubble_wellies', back: 'boots_rare_washer_bubble_wellies' } },
  // ★1 Rare Set R3 — Alpine Chalet Cuckoo-Clock & Birdie
  hat_rare_cuckoo_chalet_beret:      { bone: 'HEAD', hairCover: 'top', offset: [0.00, 1.09], scale: 1.28, offsets: { side: [-0.02, 1.08], back: [0.00, 1.06] }, scales: { side: 1.18, back: 1.26 }, views: { front: 'hat_rare_cuckoo_chalet_beret', side: 'hat_rare_cuckoo_chalet_beret_side', back: 'hat_rare_cuckoo_chalet_beret_back' } },
  gloves_rare_cuckoo_pendulum_staff: { bone: 'ARM', singleHand: true, grip: [0.54, 0.24], tilt: [-0.26, -0.48], offset: [0, 0], scale: 0.78, views: { front: 'gloves_rare_cuckoo_pendulum_staff', side: 'gloves_rare_cuckoo_pendulum_staff', back: 'gloves_rare_cuckoo_pendulum_staff' } },
  boots_rare_cuckoo_pinecone_boots:  { bone: 'LEG', offset: [0.055, -0.385], scale: 0.49, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_rare_cuckoo_pinecone_boots', side: 'boots_rare_cuckoo_pinecone_boots', back: 'boots_rare_cuckoo_pinecone_boots' } },
  // ★1 Rare Set R4 — Giant Steaming Cup-Noodle Capybara Onsen
  hat_rare_capybara_yuzu_beret:      { bone: 'HEAD', hairCover: 'top', offset: [0.00, 1.10], scale: 1.28, offsets: { side: [-0.02, 1.09], back: [0.00, 1.08] }, scales: { side: 1.16, back: 1.24 }, views: { front: 'hat_rare_capybara_yuzu_beret', side: 'hat_rare_capybara_yuzu_beret_side', back: 'hat_rare_capybara_yuzu_beret_back' } },
  gloves_rare_noodle_fork_chopsticks:{ bone: 'ARM', singleHand: true, grip: [0.445, 0.24], tilt: [-0.26, -0.48], offset: [0, 0], scale: 0.78, views: { front: 'gloves_rare_noodle_fork_chopsticks', side: 'gloves_rare_noodle_fork_chopsticks', back: 'gloves_rare_noodle_fork_chopsticks' } },
  boots_rare_cup_noodle_slippers:    { bone: 'LEG', offset: [0.055, -0.385], scale: 0.49, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_rare_cup_noodle_slippers', side: 'boots_rare_cup_noodle_slippers', back: 'boots_rare_cup_noodle_slippers' } },
  // ★1 Rare Set R5 — Kawaii Street-Corner Drink Vending-Machine
  hat_rare_vending_soda_beret:       { bone: 'HEAD', hairCover: 'top', offset: [0.00, 1.08], scale: 1.28, offsets: { side: [-0.02, 1.07], back: [0.00, 1.06] }, scales: { side: 1.18, back: 1.26 }, views: { front: 'hat_rare_vending_soda_beret', side: 'hat_rare_vending_soda_beret_side', back: 'hat_rare_vending_soda_beret_back' } },
  gloves_rare_fizzy_soda_can_wand:   { bone: 'ARM', singleHand: true, grip: [0.428, 0.24], tilt: [-0.26, -0.48], offset: [0, 0], scale: 0.78, views: { front: 'gloves_rare_fizzy_soda_can_wand', side: 'gloves_rare_fizzy_soda_can_wand', back: 'gloves_rare_fizzy_soda_can_wand' } },
  boots_rare_soda_can_sneakers:      { bone: 'LEG', offset: [0.055, -0.385], scale: 0.49, offsets: { side: [0.070, -0.378], back: [0.045, -0.385] }, views: { front: 'boots_rare_soda_can_sneakers', side: 'boots_rare_soda_can_sneakers', back: 'boots_rare_soda_can_sneakers' } },
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
  const headDx = bodyMeta?.headCX != null ? (bodyMeta.headCX - ref.cx) : 0;
  let wH, hH, ox, oy;
  if (v === 'front') {
    wH = baseScale * (isBase ? 0.96 : 1.0);
    hH = baseScale * spriteAspect;
    ox = baseOx + headDx;
    oy = baseOy;
  } else if (v === 'side') {
    wH = baseScale * headFit;
    hH = baseScale * spriteAspect * headFit;
    ox = baseOx * headFit + headDx;
    oy = baseOy * headFit + ref.top * (1 - headFit);
  } else {
    wH = baseScale * headFit;
    hH = baseScale * spriteAspect * headFit;
    ox = baseOx + headDx;
    oy = baseOy * headFit + ref.top * (1 - headFit);
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
  const baseFrontMeta = getSpriteInfo(`${lineage}_base_front`) || { w: 289, h: 625, hem: 'short', faces: 'right' };
  const customBodyKey = `${lineage}_${outfitId}_${v}`;
  const fb = OUTFIT_FALLBACK[outfitId];
  const fbBodyKey = fb?.base && fb.base !== 'base' ? `${lineage}_${fb.base}_${v}` : `${lineage}_base_${v}`;
  const baseBodyKey = `${lineage}_base_${v}`;
  const directMeta = outfitId !== 'newbie_outfit' ? getSpriteInfo(customBodyKey) : null;
  const bodyMeta = directMeta || getSpriteInfo(fbBodyKey) || getSpriteInfo(baseBodyKey) || baseFrontMeta;
  const bodyFilter = !directMeta && fb?.filter ? fb.filter : 'none';
  const bodyHem = outfitHem(outfitId, bodyMeta.hem);
  const longHem = bodyHem === 'long' && !sideView;
  const bodyAspect = (bodyMeta.w || 289) / (bodyMeta.h || 625);
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
  const activeHatCover = hatDef?.views?.[v] ? hatDef.hairCover : null;
  const topCoverHat = Boolean(activeHatCover === 'top');

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
    const chinUvY = Math.min(1, Math.max(neckV, 0.5 + (0.08 - oy) / hH));
    const chinCssY = Math.min(100, Math.max(0, (1 - chinUvY) * 100));
    const neckCssY = Math.min(100, Math.max(chinCssY, (1 - neckV) * 100));
    const xLeftPct = Math.min(100, Math.max(0, (0.5 + (-0.01 - ox) / wH) * 100));
    const xRightPct = Math.min(100, Math.max(xLeftPct, (0.5 + (0.22 - ox) / wH) * 100));
    const topClipYHead = activeHatCover === 'top' ? 1.08 : activeHatCover === 'hood' ? 0.78 : activeHatCover === 'helm' ? 1.15 : null;
    const topCssY = topClipYHead != null
      ? Math.min(100, Math.max(0, (1 - Math.min(1, Math.max(0, 0.5 + (topClipYHead - oy) / hH))) * 100))
      : 0;
    const hatXMin = activeHatCover === 'helm'
      ? (v === 'side' ? -0.24 : -0.34)
      : activeHatCover === 'top'
        ? (v === 'side' ? -0.34 : -0.36)
        : (v === 'side' ? -0.54 : -0.60);
    const hatXMax = activeHatCover === 'helm'
      ? (v === 'side' ? 0.20 : 0.36)
      : activeHatCover === 'top'
        ? (v === 'side' ? 0.22 : 0.38)
        : (v === 'side' ? 1.00 : 0.62);
    const hLeftPct = Math.min(100, Math.max(0, (0.5 + (hatXMin - ox) / wH) * 100));
    const hRightPct = Math.min(100, Math.max(hLeftPct, (0.5 + (hatXMax - ox) / wH) * 100));
    const topNotchPts = topCssY > 0.5
      ? `0% 0%, ${hLeftPct.toFixed(1)}% 0%, ${hLeftPct.toFixed(1)}% ${topCssY.toFixed(1)}%, ${hRightPct.toFixed(1)}% ${topCssY.toFixed(1)}%, ${hRightPct.toFixed(1)}% 0%, 100% 0%`
      : `0% 0%, 100% 0%`;
    const behindClipPolygon = topCssY > 0.5
      ? `polygon(${topNotchPts}, 100% 100%, 0% 100%)`
      : 'none';
    const frontClipPolygon = v !== 'front'
      ? behindClipPolygon
      : `polygon(${topNotchPts}, 100% ${neckCssY.toFixed(1)}%, ${xRightPct.toFixed(1)}% ${neckCssY.toFixed(1)}%, ${xRightPct.toFixed(1)}% ${chinCssY.toFixed(1)}%, ${xLeftPct.toFixed(1)}% ${chinCssY.toFixed(1)}%, ${xLeftPct.toFixed(1)}% ${neckCssY.toFixed(1)}%, 0% ${neckCssY.toFixed(1)}%)`;
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
      behindClipPolygon,
      zIndex: 14, // above body & boots (12), below gloves/weapons (16-17), headwear (18), and facewear (20)
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
      const ppm = H / (baseFrontMeta.h || 625);
      const { w: baseWM, h: hM } = resolveWingDimensions(wingsId, wMeta.w, wMeta.h, ppm);
      const wM = baseWM * (sideView ? 0.55 : 1);
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

  // Accessory layers in painter's order (boots -> hair -> gloves/weapons -> hat -> face, so gloves/weapons stay visible over long female hair)
  const order = { boots: 1, gloves: 3, hat: 4, face: 5 };
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
        singleHand: Boolean(def.singleHand),
        url: `/assets/${sMeta.file || `chibi/${spriteName}.png`}`,
        cxPct: (cxM / H) * 100,
        cyPct: (cyM / H) * 100,
        wPct: (wM / H) * 100,
        hPct: (hM / H) * 100,
        scaleX: scaleSign,
        // Three.js +Z rotation is counter-clockwise; CSS rotate() is clockwise
        rotDeg: +((-armTiltRad * 180) / Math.PI).toFixed(2),
        clipLongBoot: Boolean(isBoot && longHem),
        zIndex: 10 + order[slot] * 2 + (isBoot && side === flip ? 1 : 0) + (def.singleHand ? 1 : 0),
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

