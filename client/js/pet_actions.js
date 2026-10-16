// client/js/pet_actions.js — Action & Emote State Driver for Pet System V2 ("Soul-Bond Companions").
// Coordinates 8-pose overrides (front, side, back, move, cast, happy, sleep, lifted) and bust emote bubbles.

import { EMOTE_KEYS, PETS, normalizePetId, resolvePetEmoteKey } from '/shared/pet_catalog.js';
import { unlockedEmotesForBond } from '/shared/pet_rules.js';
import { OUTFITS } from '/shared/costumes_catalog.js';

export const ACTION_DURATIONS = {
  cast: 1.05,
  happy: 1.45,
  wake: 0.25,
  flip: 0.85,
};

export class PetActionDriver {
  constructor(controller) {
    this.pet = controller;
    this.mode = 'idle'; // 'idle' | 'move' | 'sleep' | 'lifted'
    this.activeAction = null; // { kind: 'cast'|'happy'|'flip', t: 0, dur: 1.05 }
    this.sleepBubbleTimer = 0;
  }

  /**
   * Trigger a one-shot or persistent action pose on the pet.
   * @param {'cast'|'happy'|'sleep'|'wake'|'lifted'|'flip'|'front'} kind
   * @param {number} [customDur]
   */
  act(kind, customDur) {
    if (!kind) return;
    if (kind === 'wake' || kind === 'front') {
      if (this.mode === 'sleep') this.mode = 'idle';
      this.activeAction = null;
      return;
    }
    if (kind === 'lifted') {
      this.mode = 'lifted';
      this.activeAction = null;
      return;
    }
    if (kind === 'sleep') {
      this.mode = 'sleep';
      this.activeAction = null;
      this.sleepBubbleTimer = 0.4;
      return;
    }
    if (kind === 'cast' || kind === 'happy' || kind === 'flip') {
      if (this.mode === 'sleep') this.mode = 'idle';
      const dur = customDur || ACTION_DURATIONS[kind] || 0.85;
      this.activeAction = { kind, t: 0, dur };
      this._emitActionFx(kind);
    }
  }

  setLifted(lifted) {
    if (lifted) {
      this.mode = 'lifted';
      this.activeAction = null;
    } else if (this.mode === 'lifted') {
      this.mode = 'idle';
    }
  }

  _emitActionFx(kind) {
    const p = this.pet;
    if (!p?.fx) return;
    const x = p.root?.position?.x ?? p.x ?? 0;
    const z = p.root?.position?.z ?? p.z ?? 0;
    const y = (p.height || 0.6) + 0.25;
    const def = PETS[normalizePetId(p.petId)];

    if (kind === 'cast') {
      if (p.costumeId && OUTFITS[p.costumeId]?.walkFx) {
        const wfx = OUTFITS[p.costumeId].walkFx;
        p.fx.emit(wfx.stepCell, x, y, z, 5, { tint: wfx.tint });
        p.fx.emit(wfx.trailCell, x, y + 0.1, z, 3, { tint: wfx.tint });
      } else {
        const fxKey = def?.family === 'dragons' ? 'fx_star'
          : def?.family === 'spirits' ? 'fx_petal'
          : def?.family === 'chonkers' ? 'fx_sparkle'
          : 'fx_heart';
        p.fx.emit(fxKey, x, y, z, 6);
      }
    } else if (kind === 'flip') {
      p.fx.emit('fx_star', x, y + 0.1, z, 5);
      p.fx.emit('fx_heart', x, y, z, 4);
    } else if (kind === 'happy') {
      p.fx.emit('fx_heart', x, y + 0.1, z, 4);
      p.fx.emit('fx_star', x, y, z, 4);
    }
  }

  /**
   * Triggers a head-and-shoulders expression bust bubble above the pet.
   * Falls back to 'joy' if the requested emote is not unlocked yet.
   */
  showEmote(emoteName = 'joy') {
    const p = this.pet;
    if (!p) return;
    const unlocked = unlockedEmotesForBond(p.bondLv || 1);
    const chosen = EMOTE_KEYS.includes(emoteName) && unlocked.includes(emoteName)
      ? emoteName
      : (unlocked[unlocked.length - 1] || 'joy');
    const spriteKey = resolvePetEmoteKey(p.petId, chosen);
    p.spawnEmoteBustBubble?.(spriteKey, chosen);
  }

  /**
   * Advance timers and determine which of the 8 poses should be shown right now.
   * @param {number} dt
   * @param {number} speed
   * @param {'front'|'side'|'back'} directionalView
   * @returns {{ pose: 'front'|'side'|'back'|'move'|'cast'|'happy'|'sleep'|'lifted', bounceY: number, rollZ: number, scalePulse: number }}
   */
  update(dt, speed, directionalView = 'front') {
    let bounceY = 0;
    let rollZ = 0;
    let scalePulse = 1;

    if (this.mode === 'lifted') {
      rollZ = Math.sin((this.pet?.t || 0) * 14) * 0.14;
      bounceY = 0.42 + Math.sin((this.pet?.t || 0) * 8) * 0.04;
      return { pose: 'lifted', bounceY, rollZ, scalePulse: 1.04 };
    }

    // Wake up automatically if owner moves fast enough to pull the pet
    if (this.mode === 'sleep' && speed > 0.35) {
      this.mode = 'idle';
    }

    if (this.activeAction) {
      this.activeAction.t += dt;
      const { kind, t, dur } = this.activeAction;
      const prog = Math.min(1, t / dur);
      let pose = kind;
      if (kind === 'cast') {
        bounceY = Math.sin(prog * Math.PI) * 0.18;
        scalePulse = 1 + Math.sin(prog * Math.PI * 2) * 0.08;
      } else if (kind === 'happy') {
        bounceY = Math.abs(Math.sin(prog * Math.PI * 3)) * 0.22;
        rollZ = Math.sin(prog * Math.PI * 4) * 0.08;
      } else if (kind === 'flip') {
        bounceY = Math.sin(prog * Math.PI) * 0.36;
        rollZ = prog * Math.PI * 2;
        pose = this.pet?.views?.happy ? 'happy' : (this.pet?.views?.move ? 'move' : 'front');
      }
      if (t >= dur) {
        this.activeAction = null;
      } else {
        return { pose, bounceY, rollZ, scalePulse };
      }
    }

    if (this.mode === 'sleep') {
      this.sleepBubbleTimer -= dt;
      if (this.sleepBubbleTimer <= 0) {
        this.sleepBubbleTimer = 2.6;
        this.pet?.bubble?.('💤');
      }
      scalePulse = 1 + Math.sin((this.pet?.t || 0) * 2.2) * 0.03;
      return { pose: 'sleep', bounceY: -0.04, rollZ: 0, scalePulse };
    }

    // When moving briskly, use the dedicated `_move` action frame if loaded
    if (speed > 0.45 && this.pet?.views?.move) {
      return { pose: 'move', bounceY: 0, rollZ: 0, scalePulse: 1 };
    }

    return { pose: directionalView, bounceY: 0, rollZ: 0, scalePulse: 1 };
  }
}
