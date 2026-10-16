// shared/locomotion.js — pure movement / facing / pet-follow logic (no Three.js),
// so it is unit-testable in Node and identical on every client.
//
// World axes: +X = screen right, -Z = "up" the screen / away from the camera.

export const MOVE = {
  BASE_SPEED: 4.5,        // m/s
  ACCEL_TIME: 0.09,       // 0 -> full speed (easeOutQuad-ish via exponential approach)
  DECEL_TIME: 0.12,
  WALK_BLEND: 0.14,       // walkWeight 0 <-> 1 ramp
  BACK_DZ: -0.15,         // normalized dz below this => Back-3/4
  SIDE_DX: 0.15,          // |dx| above this updates left/right
};

export const CHIBI_FACING = { turnTime: 0.12, sideTurnTime: 0.18, idleTurnTime: 0.6 };
export const PET_FACING = { turnTime: 0.10, sideTurnTime: 0.15, idleTurnTime: 0.5 };

// Pop-turn timeline (fractions of the turn):  [0 .. CROUCH) old art, crouching
//                                              [CROUCH .. SIDE_END) side-profile art (front<->back only)
//                                              [.. 1] new art, popping up
const CROUCH = 0.35, SIDE_END = 0.68;

/**
 * Tree of Savior 4-diagonal facing: right/left (mirror) x front/back (art swap).
 * Turns are a "pop turn" — never a paper/card flip: the character crouches, the art
 * swaps at the bottom of the crouch (via a side-profile frame for front<->back turns),
 * then pops up with a squash-and-stretch hop.
 */
export class FacingState {
  constructor(cfg = CHIBI_FACING) {
    this.cfg = cfg;
    this.right = true;      // target facing
    this.back = false;
    this.idleFor = 0;
    this.turn = null;       // { t, dur, fromRight, fromBack }
  }

  update(dt, vx, vz) {
    const speed = Math.hypot(vx, vz);
    let right = this.right, back = this.back;
    if (speed > 0.05) {
      this.idleFor = 0;
      const nx = vx / speed, nz = vz / speed;
      if (Math.abs(nx) > MOVE.SIDE_DX) right = nx > 0;
      back = nz < MOVE.BACK_DZ;
    } else {
      this.idleFor += dt;
      if (this.back && this.idleFor >= this.cfg.idleTurnTime) back = false; // turn to camera
    }
    this.set(right, back);
    if (this.turn) { this.turn.t += dt; if (this.turn.t >= this.turn.dur) this.turn = null; }
    return this;
  }

  /** Change target facing; starts a pop turn from whatever is currently displayed. */
  set(right, back) {
    if (right === this.right && back === this.back) return;
    const shown = this.shown(false);
    this.right = right; this.back = back;
    this.turn = { t: 0, dur: shown.back !== back ? this.cfg.sideTurnTime : this.cfg.turnTime, fromRight: shown.right, fromBack: shown.back };
  }

  get turning() { return !!this.turn; }
  get progress() { return this.turn ? Math.min(1, this.turn.t / this.turn.dur) : 1; }

  /**
   * What the renderer should show right now.
   * @param {boolean} hasSide side-profile art available
   * @returns {{ view: 'front'|'side'|'back', right: boolean, back: boolean }}
   */
  shown(hasSide = true) {
    const T = this.turn;
    if (!T) return { view: this.back ? 'back' : 'front', right: this.right, back: this.back };
    const p = this.progress;
    if (p < CROUCH) return { view: T.fromBack ? 'back' : 'front', right: T.fromRight, back: T.fromBack };
    if (hasSide && T.fromBack !== this.back && p < SIDE_END) return { view: 'side', right: this.right, back: this.back };
    return { view: this.back ? 'back' : 'front', right: this.right, back: this.back };
  }

  /** Squash-and-stretch scale for the pop turn. sx stays >= ~0.93 (no paper flip). */
  get turnSquash() {
    if (!this.turn) return { sx: 1, sy: 1 };
    const p = this.progress;
    if (p < CROUCH) { const c = Math.sin((p / CROUCH) * Math.PI / 2); return { sx: 1 + 0.07 * c, sy: 1 - 0.10 * c }; }
    const k = (p - CROUCH) / (1 - CROUCH);
    const sy = 0.90 + 0.10 * k + 0.09 * Math.sin(k * Math.PI);
    return { sx: 2 - sy, sy };
  }

  /** 0..1 hop height during the pop phase. */
  get turnHop() {
    if (!this.turn) return 0;
    const p = this.progress;
    return p < CROUCH ? 0 : Math.sin(((p - CROUCH) / (1 - CROUCH)) * Math.PI);
  }

  /** -1..1 head/hair lag impulse toward the old side (secondary motion). */
  get turnLag() {
    if (!this.turn) return 0;
    return (this.turn.fromRight ? 1 : -1) * Math.sin(this.progress * Math.PI) * (this.turn.fromRight !== this.right ? 1 : 0.4);
  }
}

/** Frame-rate independent approach: moves `cur` toward `target` with time constant tau. */
export const damp = (cur, target, tau, dt) => target + (cur - target) * Math.exp(-dt / Math.max(1e-4, tau));

/**
 * Local player kinematics: input direction (-1..1 each axis) -> smoothed velocity,
 * plus walkWeight for pose blending.
 */
export class Mover {
  constructor() { this.vx = 0; this.vz = 0; this.walkWeight = 0; }
  update(dt, ix, iz, speed = MOVE.BASE_SPEED) {
    const len = Math.hypot(ix, iz);
    if (len > 1) { ix /= len; iz /= len; }
    const tvx = ix * speed, tvz = iz * speed;
    const tau = len > 0.05 ? MOVE.ACCEL_TIME / 3 : MOVE.DECEL_TIME / 3;
    this.vx = damp(this.vx, tvx, tau, dt);
    this.vz = damp(this.vz, tvz, tau, dt);
    if (Math.hypot(this.vx, this.vz) < 0.02 && len < 0.05) { this.vx = 0; this.vz = 0; }
    const moving = Math.hypot(this.vx, this.vz) > 0.2;
    const step = dt / MOVE.WALK_BLEND;
    this.walkWeight = Math.max(0, Math.min(1, this.walkWeight + (moving ? step : -step)));
    return this;
  }
}

// ---------------------------------------------------------------------------
// Pet follow: spatial-distance breadcrumb ring buffer (Section 7.B.2)
// ---------------------------------------------------------------------------
export const PET_FOLLOW = {
  MIN_FOLLOW_DIST: 1.10,  // pet stops trailing inside this radius
  CRUMB_SPACING: 0.15,    // record a crumb every 0.15m of owner travel
  SPEED_MULT: 1.05,
  REST_BACK: 0.85,        // rest offset: behind the owner along their facing
  REST_Z: 0.25,           // ...and slightly toward the camera so both stay visible
  TELEPORT_DIST: 8.0,
  CAPACITY: 96,
};

export class PetFollower {
  constructor(x = 0, z = 0) {
    this.x = x; this.z = z; this.vx = 0; this.vz = 0;
    this.crumbs = [];          // ring buffer (array capped at CAPACITY)
    this.lastCrumb = null;
    this.events = [];          // e.g. 'teleport'
  }

  record(ox, oz) {
    if (!this.lastCrumb || Math.hypot(ox - this.lastCrumb.x, oz - this.lastCrumb.z) >= PET_FOLLOW.CRUMB_SPACING) {
      this.lastCrumb = { x: ox, z: oz };
      this.crumbs.push(this.lastCrumb);
      if (this.crumbs.length > PET_FOLLOW.CAPACITY) this.crumbs.shift();
    }
  }

  restSpot(owner) {
    const dirX = owner.right ? 1 : -1;
    return { x: owner.x - dirX * PET_FOLLOW.REST_BACK, z: owner.z + PET_FOLLOW.REST_Z };
  }

  /**
   * owner = { x, z, speed, moving, right }. Returns this (x, z, vx, vz updated).
   */
  update(dt, owner) {
    this.events.length = 0;
    this.record(owner.x, owner.z);
    const px = this.x, pz = this.z;
    const dOwner = Math.hypot(owner.x - this.x, owner.z - this.z);

    if (dOwner > PET_FOLLOW.TELEPORT_DIST) {
      const r = this.restSpot(owner);
      this.x = r.x; this.z = r.z;
      this.crumbs.length = 0; this.lastCrumb = null;
      this.events.push('teleport');
    } else if (!owner.moving && dOwner <= PET_FOLLOW.MIN_FOLLOW_DIST + 0.6) {
      // owner idle and pet close: settle side-by-side (never on top of the owner)
      this.crumbs.length = 0; this.lastCrumb = null;
      const r = this.restSpot(owner);
      const nx = damp(this.x, r.x, 0.18, dt), nz = damp(this.z, r.z, 0.18, dt);
      const maxStep = 2.5 * dt, sx = nx - this.x, sz = nz - this.z, sl = Math.hypot(sx, sz);
      const k = sl > maxStep ? maxStep / sl : 1;
      this.x += sx * k; this.z += sz * k;
    } else if (dOwner > PET_FOLLOW.MIN_FOLLOW_DIST) {
      // trail along the owner's path: walk crumbs in order, never cut inside MIN_FOLLOW_DIST
      const speed = Math.max(owner.speed, 2.0) * PET_FOLLOW.SPEED_MULT;
      let budget = speed * dt;
      while (budget > 0 && this.crumbs.length) {
        const c = this.crumbs[0];
        // crumbs inside the ring are never valid targets (owner doubled back over them)
        if (Math.hypot(owner.x - c.x, owner.z - c.z) < PET_FOLLOW.MIN_FOLLOW_DIST) { this.crumbs.shift(); continue; }
        const d = Math.hypot(c.x - this.x, c.z - this.z);
        if (d <= budget) { this.x = c.x; this.z = c.z; budget -= d; this.crumbs.shift(); }
        else { this.x += ((c.x - this.x) / d) * budget; this.z += ((c.z - this.z) / d) * budget; budget = 0; }
      }
      if (!this.crumbs.length && budget > 0) {
        // no crumbs left (e.g. just spawned): head straight for the owner, stop at the ring
        const d = Math.hypot(owner.x - this.x, owner.z - this.z);
        const move = Math.min(budget, d - PET_FOLLOW.MIN_FOLLOW_DIST);
        if (move > 0) { this.x += ((owner.x - this.x) / d) * move; this.z += ((owner.z - this.z) / d) * move; }
      }
    } else if (owner.moving && owner.vx !== undefined) {
      // owner is walking into the pet (e.g. reversed direction): hop aside off their path
      this.crumbs.length = 0; this.lastCrumb = null;
      const sp = Math.hypot(owner.vx, owner.vz) || 1;
      const ux = owner.vx / sp, uz = owner.vz / sp;                 // owner heading
      let ax = this.x - owner.x, az = this.z - owner.z;
      const ad = Math.hypot(ax, az) || 1e-3; ax /= ad; az /= ad;    // away from owner
      const side = (ux * az - uz * ax) >= 0 ? 1 : -1;               // which side of the path the pet is on
      let mx = ax + -uz * side * 1.5, mz = az + ux * side * 1.5;    // away + perpendicular
      const ml = Math.hypot(mx, mz) || 1; mx /= ml; mz /= ml;
      const step = Math.min((PET_FOLLOW.MIN_FOLLOW_DIST - ad) + 0.05, Math.max(owner.speed, 2) * 1.2 * dt);
      if (step > 0) { this.x += mx * step; this.z += mz * step; }
    }
    this.vx = dt > 0 ? (this.x - px) / dt : 0;
    this.vz = dt > 0 ? (this.z - pz) / dt : 0;
    return this;
  }
}

/** Remote-player smoothing: dead reckoning + exponential damping (Section 21.K.3). */
export class RemoteSmoother {
  constructor(x = 0, z = 0) { this.x = x; this.z = z; this.tx = x; this.tz = z; this.vx = 0; this.vz = 0; this.age = 0; }
  onPacket(p) { this.tx = p.x; this.tz = p.z; this.vx = p.vx || 0; this.vz = p.vz || 0; this.age = 0; }
  update(dt) {
    this.age += dt;
    if (this.age < 0.35) { this.tx += this.vx * dt; this.tz += this.vz * dt; } // extrapolate briefly only
    const a = 1 - Math.exp(-14 * dt);
    this.x += (this.tx - this.x) * a;
    this.z += (this.tz - this.z) * a;
    if (Math.hypot(this.tx - this.x, this.tz - this.z) > 6) { this.x = this.tx; this.z = this.tz; } // snap on teleport
    return this;
  }
}
