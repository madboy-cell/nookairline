// shared/walk_fx.js — data-driven walk FX helpers for Mythic costumes.
import { OUTFITS } from './costumes_catalog.js';

export const MAX_PARTICLES = 384;
export const CROWD_TRAIL_THRESHOLD = 0.75 * MAX_PARTICLES; // 288
export const CROWD_STEP_THRESHOLD = 0.9 * MAX_PARTICLES;   // 345.6
export const TRAIL_INTERVAL = 0.15; // throttled rate in seconds (~0.12-0.18s)

export const VALID_FX_CELLS = [
  'fx_snowflake',
  'fx_feather',
  'fx_petal',
  'fx_star',
  'fx_lightning',
  'fx_flame',
  'fx_bubble',
  'fx_note',
  'fx_chip',
  'fx_moon',
  'fx_heart',
  'fx_leaf',
  'fx_stardust',
  'fx_rune',
  'fx_shockwave',
  'fx_magic_circle',
];

/**
 * Returns the walkFx configuration for an outfit ID, or null.
 * Pure data lookup — zero if (outfitId === ...) branches.
 */
export function getWalkFx(outfitId) {
  if (!outfitId) return null;
  return OUTFITS[outfitId]?.walkFx || null;
}

/**
 * Returns walkFx for an equipped object (e.g. profile.equipped or data.equipped).
 */
export function getEquippedWalkFx(equipped) {
  const outfitId = equipped?.outfit?.id || (typeof equipped?.outfit === 'string' ? equipped.outfit : null);
  return getWalkFx(outfitId);
}

/**
 * Crowd budget checks for remote players.
 */
export function shouldEmitRemoteTrail(activeCount) {
  return activeCount <= CROWD_TRAIL_THRESHOLD;
}

export function shouldEmitRemoteStep(activeCount) {
  return activeCount <= CROWD_STEP_THRESHOLD;
}

/**
 * Computes trailing position behind a character moving with velocity (vx, vz).
 */
export function getTrailOffset(vx, vz, distance = 0.15) {
  const speed = Math.hypot(vx, vz);
  if (speed < 0.01) return { x: 0, z: 0 };
  return {
    x: -(vx / speed) * distance,
    z: -(vz / speed) * distance,
  };
}
