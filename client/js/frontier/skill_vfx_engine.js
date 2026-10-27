// client/js/frontier/skill_vfx_engine.js — Pure 3D Pre-Built Effekseer Skill & Combo VFX Engine.
// Coordinates ChibiRig attack/cast choreography, camera micro-shake, and EffekseerForWebGL 1.80.7 3D `.efkefc` playback.

import { ALPHA_ELITE_AURA_SPEC, SKILL_VFX_DEFS, resolveSkillVfxRecipe } from '/shared/skill_vfx_defs.js';
import { EffekseerVfxManager } from './effekseer_vfx.js?v=mc2';

const BASE_PRIORITY_IDS = Object.freeze([
  'combo_melee_1', 'combo_melee_2', 'combo_melee_3',
  'combo_ranged_1', 'combo_ranged_2', 'combo_ranged_3',
  'combo_magic_1', 'combo_magic_2', 'combo_magic_3',
]);

export class SkillVfxEngine {
  /**
   * @param {{ root?: any, camPitch?: number, onScreenShake?: (intensity:number, dur:number)=>void }} opts
   */
  constructor({ root = null, camPitch = 0.58, onScreenShake = null } = {}) {
    this.root = root;
    this.camPitch = camPitch;
    this.onScreenShake = onScreenShake;
    this.efk = null;
    this._seedCounter = 101;
  }

  /** Attach THREE.WebGLRenderer (reusing warm singleton context) and trickle-preload 3D Effekseer `.efkefc` assets. */
  attachRenderer(renderer, priorityVfxIds = []) {
    if (!renderer || typeof window === 'undefined') return Promise.resolve(false);
    if (!renderer.__neoraEfkManager) {
      renderer.__neoraEfkManager = new EffekseerVfxManager();
    }
    this.efk = renderer.__neoraEfkManager;
    return this.efk
      .init(renderer)
      .then((ok) => {
        if (ok && this.efk) {
          this.warmPriority(priorityVfxIds);
        }
        return ok;
      })
      .catch((err) => {
        console.warn('[SkillVfxEngine] Effekseer init error:', err);
        return false;
      });
  }

  /** Immediately warm priority VFX (combos, Alpha aura, equipped/region skills) and trickle remaining recipes. */
  warmPriority(priorityVfxIds = []) {
    if (!this.efk?.ready) return Promise.resolve();
    const prioritySet = new Set();
    for (const l of ALPHA_ELITE_AURA_SPEC?.effekseer?.layers || []) {
      if (l.url) prioritySet.add(l.url);
    }
    for (const id of BASE_PRIORITY_IDS) {
      for (const l of SKILL_VFX_DEFS[id]?.effekseer?.layers || []) {
        if (l.url) prioritySet.add(l.url);
      }
    }
    for (const id of priorityVfxIds || []) {
      if (!id) continue;
      const rec = id === 'alpha_elite_aura' ? ALPHA_ELITE_AURA_SPEC : SKILL_VFX_DEFS[id];
      for (const l of rec?.effekseer?.layers || []) {
        if (l.url) prioritySet.add(l.url);
      }
    }
    const backgroundUrls = [];
    for (const rec of Object.values(SKILL_VFX_DEFS)) {
      for (const l of rec?.effekseer?.layers || []) {
        if (l.url && !prioritySet.has(l.url)) backgroundUrls.push(l.url);
      }
    }
    return this.efk.preloadUrlsTrickle([...prioritySet], backgroundUrls, 3).catch(() => {});
  }

  /**
   * Spawn a 3D Effekseer skill or weapon-class combo effect with ChibiRig choreography & screen shake.
   */
  spawnEffect({
    vfxId,
    x = 0,
    y = 0,
    z = 0,
    targetX = null,
    targetZ = null,
    targetRef = null,
    facing = { x: 0, z: 1 },
    casterRig = null,
    seed = null,
    durationMs = null,
  } = {}) {
    const recipe = resolveSkillVfxRecipe(vfxId);
    const fx = Number.isFinite(facing?.x) ? facing.x : 0;
    const fz = Number.isFinite(facing?.z) ? facing.z : 1;
    const fl = Math.hypot(fx, fz) || 1;
    const dirX = fx / fl;
    const dirZ = fz / fl;
    const tx = Number.isFinite(targetX) ? targetX : x + dirX * 3.0;
    const tz = Number.isFinite(targetZ) ? targetZ : z + dirZ * 3.0;
    const useSeed = Number.isFinite(seed) ? seed : (this._seedCounter = (this._seedCounter + 97) & 0xfffffff);
    const groupId = ++this._seedCounter;
    const effDurMs = Math.max(350, Number(durationMs) || Number(recipe.durationMs) || 1600);

    if (casterRig && recipe.rigChoreo) {
      casterRig.facing?.set?.(dirX >= 0, dirZ < -0.35);
      casterRig.triggerAttack?.(recipe.rigChoreo.pose || 'slash', {
        dur: (recipe.rigChoreo.poseMs || 500) / 1000,
        weaponScaleBoost: recipe.rigChoreo.weaponScaleBoost || 1.18,
      });
    }

    if (this.onScreenShake && recipe.screenJuice?.shake > 0) {
      this.onScreenShake(recipe.screenJuice.shake, recipe.screenJuice.shakeDur || 0.16);
    }

    const efkParams = {
      groupId,
      durationMs: effDurMs,
      x,
      y,
      z,
      targetX: tx,
      targetZ: tz,
      targetRef: targetRef || null,
      fx: dirX,
      fz: dirZ,
      casterRef: casterRig?.ROOT?.position || null,
      seed: useSeed,
    };

    if (this.efk?.ready && recipe.effekseer) {
      this.efk.playRecipe(recipe.effekseer, efkParams).catch(() => {});
    }

    return {
      vfxId: recipe.id,
      groupId,
      recipe,
      efkParams,
      durationMs: effDurMs,
      elapsedMs: 0,
      disposed: false,
      stop: () => this.efk?.stopGroup?.(groupId),
    };
  }

  async seekEffect(fx, elapsedMs) {
    if (!fx || !this.efk?.ready || !fx.recipe?.effekseer) return;
    fx.elapsedMs = elapsedMs;
    await this.efk.seekRecipe(fx.recipe.effekseer, fx.efkParams, elapsedMs);
  }

  update(dt) {
    this.efk?.update?.(dt);
  }

  drawPostRender(renderer, camera) {
    this.efk?.draw?.(renderer, camera);
  }

  clearAll() {
    this.efk?.stopAll?.();
  }

  dispose() {
    this.efk?.stopAll?.();
    this.efk = null;
  }
}
