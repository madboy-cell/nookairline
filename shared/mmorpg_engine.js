// shared/mmorpg_engine.js — Pure, zero-dependency ES module for Neora World MMORPG zones,
// smooth client/server reconciliation, O(1) spatial hashing, skills/statuses, and Boss AI.
import { isWalkablePos, nearestWalkablePos } from './village_rules.js';

// ---------------------------------------------------------------------------------------------
// 1. Zone Registry & Unified Walkability
// ---------------------------------------------------------------------------------------------
export const ZONE_KINDS = Object.freeze({
  VILLAGE: 'village',
  TOWNHALL: 'townhall',
  MOON_DEFENSE: 'moon_defense',
  SURVIVAL_WILDS: 'survival_wilds',
  CLOUD_DASH: 'cloud_dash',
  ARENA: 'arena',
});

export function createZoneDescriptor(kind, opts = {}) {
  const resolvedKind = kind || ZONE_KINDS.VILLAGE;
  const defaultHalfSize = resolvedKind === ZONE_KINDS.SURVIVAL_WILDS ? 80 : 17.5;
  const defaultSkills =
    resolvedKind === ZONE_KINDS.MOON_DEFENSE ||
    resolvedKind === ZONE_KINDS.SURVIVAL_WILDS ||
    resolvedKind === ZONE_KINDS.ARENA;

  return {
    kind: resolvedKind,
    id: opts.id || resolvedKind,
    halfSize: opts.halfSize || defaultHalfSize,
    colliders: Array.isArray(opts.colliders) ? opts.colliders : [],
    layout: opts.layout || null,
    pvp: Boolean(opts.pvp),
    allowMounts: opts.allowMounts ?? true,
    allowSkills: opts.allowSkills ?? defaultSkills,
  };
}

export function isZoneWalkable(zone, x, z, { canFly = false, radius = 0.2 } = {}) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
  const r = Number.isFinite(radius) && radius >= 0 ? radius : 0.2;

  if (zone?.kind === ZONE_KINDS.VILLAGE && zone.layout) {
    return isWalkablePos(zone.layout, x, z, { canFly, radius: r });
  }

  const halfSize = Number.isFinite(zone?.halfSize) && zone.halfSize > 0 ? zone.halfSize : 17.5;
  const limit = Math.max(0, halfSize - r);
  if (Math.abs(x) > limit || Math.abs(z) > limit) return false;

  const colliders = zone?.colliders;
  if (Array.isArray(colliders)) {
    for (const c of colliders) {
      if (!c) continue;
      if (canFly && c.flyable !== false) continue;
      if (c.shape === 'circle' || (c.r != null && c.x != null && c.z != null)) {
        if (Math.hypot(x - c.x, z - c.z) < c.r + r) return false;
      } else if (c.shape === 'box' || (c.x0 != null && c.z0 != null && c.x1 != null && c.z1 != null)) {
        const minX = Math.min(c.x0, c.x1) - r;
        const maxX = Math.max(c.x0, c.x1) + r;
        const minZ = Math.min(c.z0, c.z1) - r;
        const maxZ = Math.max(c.z0, c.z1) + r;
        if (x > minX && x < maxX && z > minZ && z < maxZ) return false;
      }
    }
  }
  return true;
}

export function clampZoneWalkable(zone, x, z, { canFly = false, radius = 0.2 } = {}) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return { x: 0, z: 0 };
  const r = Number.isFinite(radius) && radius >= 0 ? radius : 0.2;

  if (zone?.kind === ZONE_KINDS.VILLAGE && zone.layout) {
    return nearestWalkablePos(zone.layout, x, z, { canFly, radius: r });
  }

  const halfSize = Number.isFinite(zone?.halfSize) && zone.halfSize > 0 ? zone.halfSize : 17.5;
  const limit = Math.max(0, halfSize - r);
  let px = Math.max(-limit, Math.min(limit, x));
  let pz = Math.max(-limit, Math.min(limit, z));

  const colliders = zone?.colliders;
  if (Array.isArray(colliders)) {
    for (let pass = 0; pass < 2; pass++) {
      for (const c of colliders) {
        if (!c) continue;
        if (canFly && c.flyable !== false) continue;
        if (c.shape === 'circle' || (c.r != null && c.x != null && c.z != null)) {
          const dx = px - c.x;
          const dz = pz - c.z;
          const dist = Math.hypot(dx, dz);
          const minDist = c.r + r;
          if (dist < minDist) {
            if (dist < 1e-6) {
              px = c.x;
              pz = c.z + minDist + 0.01;
            } else {
              const push = (minDist + 0.01) / dist;
              px = c.x + dx * push;
              pz = c.z + dz * push;
            }
          }
        } else if (c.shape === 'box' || (c.x0 != null && c.z0 != null && c.x1 != null && c.z1 != null)) {
          const minX = Math.min(c.x0, c.x1) - r;
          const maxX = Math.max(c.x0, c.x1) + r;
          const minZ = Math.min(c.z0, c.z1) - r;
          const maxZ = Math.max(c.z0, c.z1) + r;
          if (px > minX && px < maxX && pz > minZ && pz < maxZ) {
            const dLeft = px - minX;
            const dRight = maxX - px;
            const dTop = pz - minZ;
            const dBottom = maxZ - pz;
            const m = Math.min(dLeft, dRight, dTop, dBottom);
            if (m === dLeft) px = minX - 0.01;
            else if (m === dRight) px = maxX + 0.01;
            else if (m === dTop) pz = minZ - 0.01;
            else pz = maxZ + 0.01;
          }
        }
      }
      px = Math.max(-limit, Math.min(limit, px));
      pz = Math.max(-limit, Math.min(limit, pz));
    }
  }
  return { x: px, z: pz };
}

// ---------------------------------------------------------------------------------------------
// 2. Zone Epoch & Smooth Reconciliation
// ---------------------------------------------------------------------------------------------
export function shouldAcceptZonePacket(packetZoneSeq, activeZoneSeq) {
  if (packetZoneSeq == null || activeZoneSeq == null) return true;
  return Number(packetZoneSeq) === Number(activeZoneSeq);
}

export function computeReconcileStep(
  clientX,
  clientZ,
  serverX,
  serverZ,
  dt,
  { snapThreshold = 1.8, blendRate = 10, deadzone = 0.08 } = {},
) {
  const err = Math.hypot(serverX - clientX, serverZ - clientZ);
  if (!Number.isFinite(err)) {
    return { mode: 'ignore', x: clientX || 0, z: clientZ || 0, err: 0 };
  }
  if (err <= deadzone) {
    return { mode: 'ignore', x: clientX, z: clientZ, err };
  }
  if (err >= snapThreshold) {
    return { mode: 'snap', x: serverX, z: serverZ, err };
  }
  const t = Math.min(1, Math.max(0, Number(dt) || 0) * blendRate);
  return {
    mode: 'smooth',
    x: clientX + (serverX - clientX) * t,
    z: clientZ + (serverZ - clientZ) * t,
    err,
  };
}

// ---------------------------------------------------------------------------------------------
// 3. O(1) Spatial Hash Grid
// ---------------------------------------------------------------------------------------------
export class SpatialHashGrid {
  constructor(cellSize = 4.0) {
    this.cellSize = Number.isFinite(cellSize) && cellSize > 0 ? cellSize : 4.0;
    this.cells = new Map();
  }

  _key(cx, cz) {
    return `${cx},${cz}`;
  }

  clear() {
    this.cells.clear();
  }

  insert(entity) {
    if (!entity || !Number.isFinite(entity.x) || !Number.isFinite(entity.z)) return;
    const cx = Math.floor(entity.x / this.cellSize);
    const cz = Math.floor(entity.z / this.cellSize);
    const key = this._key(cx, cz);
    let bucket = this.cells.get(key);
    if (!bucket) {
      bucket = [];
      this.cells.set(key, bucket);
    }
    bucket.push(entity);
  }

  insertAll(entities) {
    if (!entities) return;
    for (const e of entities) this.insert(e);
  }

  queryRadius(x, z, radius, filterFn = null) {
    if (!Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(radius) || radius < 0) {
      return [];
    }
    const minCx = Math.floor((x - radius) / this.cellSize);
    const maxCx = Math.floor((x + radius) / this.cellSize);
    const minCz = Math.floor((z - radius) / this.cellSize);
    const maxCz = Math.floor((z + radius) / this.cellSize);
    const rSq = radius * radius;
    const matches = [];

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cz = minCz; cz <= maxCz; cz++) {
        const bucket = this.cells.get(this._key(cx, cz));
        if (!bucket) continue;
        for (let i = 0; i < bucket.length; i++) {
          const e = bucket[i];
          const dx = e.x - x;
          const dz = e.z - z;
          const dSq = dx * dx + dz * dz;
          if (dSq <= rSq && (!filterFn || filterFn(e))) {
            matches.push({ e, dSq });
          }
        }
      }
    }
    matches.sort((a, b) => a.dSq - b.dSq);
    return matches.map((m) => m.e);
  }

  queryNearest(x, z, maxRadius, filterFn = null) {
    const hits = this.queryRadius(x, z, maxRadius, filterFn);
    return hits.length > 0 ? hits[0] : null;
  }
}

// ---------------------------------------------------------------------------------------------
// 4. Combat Animations, Skill Archetypes & Status Effects
// ---------------------------------------------------------------------------------------------
const COMBAT_ANIMS_BASE = {
  SLASH: 'slash',
  SPIN_SLASH: 'spin_slash',
  GROUND_SLAM: 'ground_slam',
  DASH_STRIKE: 'dash_strike',
  SPELL_CAST: 'spell_cast',
  BOW_SHOT: 'bow_shot',
  HIT_RECOIL: 'hit_recoil',
};
for (const val of Object.values(COMBAT_ANIMS_BASE)) {
  Object.defineProperty(COMBAT_ANIMS_BASE, val, { value: val, enumerable: false });
}
Object.defineProperty(COMBAT_ANIMS_BASE, 'includes', {
  value: (v) => Object.values(COMBAT_ANIMS_BASE).includes(v),
  enumerable: false,
});
export const COMBAT_ANIMS = Object.freeze(COMBAT_ANIMS_BASE);

export const SKILL_ARCHETYPES = Object.freeze({
  melee_cleave: Object.freeze({
    id: 'melee_cleave',
    name: 'Melee Cleave',
    anim: COMBAT_ANIMS.SLASH,
    shape: 'cone',
    range: 2.8,
    radius: 2.8,
    angleDeg: 110,
    cooldownMs: 900,
    dmgMult: 1.25,
    status: null,
  }),
  whirlwind_spin: Object.freeze({
    id: 'whirlwind_spin',
    name: 'Whirlwind Spin',
    anim: COMBAT_ANIMS.SPIN_SLASH,
    shape: 'circle',
    range: 0,
    radius: 3.0,
    angleDeg: 360,
    cooldownMs: 4500,
    dmgMult: 1.65,
    status: Object.freeze({ type: 'chill', durationMs: 2500, power: 0.35 }),
  }),
  starlight_dash: Object.freeze({
    id: 'starlight_dash',
    name: 'Starlight Dash',
    anim: COMBAT_ANIMS.DASH_STRIKE,
    shape: 'line',
    range: 5.5,
    radius: 1.1,
    angleDeg: 0,
    cooldownMs: 5000,
    dmgMult: 1.5,
    status: Object.freeze({ type: 'haste', durationMs: 3000, power: 0.3 }),
  }),
  meteor_slam: Object.freeze({
    id: 'meteor_slam',
    name: 'Meteor Slam',
    anim: COMBAT_ANIMS.GROUND_SLAM,
    shape: 'circle',
    range: 3.5,
    radius: 3.2,
    angleDeg: 360,
    cooldownMs: 7000,
    dmgMult: 2.2,
    status: Object.freeze({ type: 'burn', durationMs: 4000, power: 8 }),
  }),
  arcane_nova: Object.freeze({
    id: 'arcane_nova',
    name: 'Arcane Nova',
    anim: COMBAT_ANIMS.SPELL_CAST,
    shape: 'circle',
    range: 0,
    radius: 3.6,
    angleDeg: 360,
    cooldownMs: 6000,
    dmgMult: 1.8,
    status: Object.freeze({ type: 'curse', durationMs: 4500, power: 0.22 }),
  }),
  chain_lightning: Object.freeze({
    id: 'chain_lightning',
    name: 'Chain Lightning',
    anim: COMBAT_ANIMS.SPELL_CAST,
    shape: 'chain',
    range: 6.0,
    radius: 3.5,
    angleDeg: 100,
    maxTargets: 4,
    cooldownMs: 5500,
    dmgMult: 1.45,
    status: Object.freeze({ type: 'shock', durationMs: 1500, power: 1 }),
  }),
});

export function resolveSkillTargets(caster, skillDef, aimAngle = 0, spatialGrid, filterFn = null) {
  const def = typeof skillDef === 'string' ? SKILL_ARCHETYPES[skillDef] : skillDef;
  if (!caster || !def || !spatialGrid) return [];

  const isEligible = (e) => {
    if (!e || e === caster) return false;
    if (caster.id != null && e.id === caster.id) return false;
    if (e.hp != null && e.hp <= 0) return false;
    if (filterFn && !filterFn(e)) return false;
    return true;
  };

  const queryNear = (qx, qz, qr) => {
    if (typeof spatialGrid.queryRadius === 'function') {
      return spatialGrid.queryRadius(qx, qz, qr, isEligible);
    }
    if (Array.isArray(spatialGrid)) {
      return spatialGrid
        .filter((e) => isEligible(e) && Math.hypot(e.x - qx, e.z - qz) <= qr)
        .sort((a, b) => Math.hypot(a.x - qx, a.z - qz) - Math.hypot(b.x - qx, b.z - qz));
    }
    return [];
  };

  const shape = def.shape || 'circle';
  const dirX = Math.cos(aimAngle);
  const dirZ = Math.sin(aimAngle);

  if (shape === 'circle') {
    const r = Math.max(def.radius || 0, 0.5);
    const cx = def.targetX != null ? def.targetX : caster.x;
    const cz = def.targetZ != null ? def.targetZ : caster.z;
    return queryNear(cx, cz, r);
  }

  if (shape === 'cone') {
    const maxR = Math.max(def.range || 0, def.radius || 0, 1.0);
    const halfRad = ((def.angleDeg || 90) * 0.5 * Math.PI) / 180;
    const minDot = Math.cos(halfRad);
    const candidates = queryNear(caster.x, caster.z, maxR);
    return candidates.filter((e) => {
      const dx = e.x - caster.x;
      const dz = e.z - caster.z;
      const dist = Math.hypot(dx, dz);
      if (dist <= 1e-4) return true;
      const dot = (dx * dirX + dz * dirZ) / dist;
      return dot >= minDot - 1e-6;
    });
  }

  if (shape === 'line') {
    const length = Math.max(def.range || 4.0, 0.5);
    const halfWidth = Math.max(def.radius || 1.0, 0.25);
    const candidates = queryNear(caster.x, caster.z, length + halfWidth);
    return candidates.filter((e) => {
      const dx = e.x - caster.x;
      const dz = e.z - caster.z;
      const proj = dx * dirX + dz * dirZ;
      const perp = Math.abs(-dx * dirZ + dz * dirX);
      const pad = e.radius || 0;
      return proj >= -pad && proj <= length + pad && perp <= halfWidth + pad;
    });
  }

  if (shape === 'chain') {
    const maxTargets = def.maxTargets || 4;
    const firstRange = Math.max(def.range || 6.0, 1.0);
    const bounceRadius = Math.max(def.radius || 3.5, 1.0);
    const hit = [];
    const visited = new Set();

    let current = queryNear(caster.x, caster.z, firstRange)[0] || null;
    while (current && hit.length < maxTargets) {
      hit.push(current);
      visited.add(current);
      const nextCandidates = queryNear(current.x, current.z, bounceRadius).filter(
        (e) => !visited.has(e),
      );
      current = nextCandidates[0] || null;
    }
    return hit;
  }

  return [];
}

export const STATUS_EFFECTS = Object.freeze({
  burn: Object.freeze({
    id: 'burn',
    kind: 'dot',
    defaultDurationMs: 4000,
    defaultPower: 6,
    maxStacks: 1,
  }),
  poison: Object.freeze({
    id: 'poison',
    kind: 'dot',
    defaultDurationMs: 5000,
    defaultPower: 4,
    maxStacks: 5,
  }),
  chill: Object.freeze({
    id: 'chill',
    kind: 'debuff',
    moveSpeedMult: 0.65,
    defaultDurationMs: 3000,
  }),
  shock: Object.freeze({
    id: 'shock',
    kind: 'cc',
    stunned: true,
    dmgTakenMult: 1.15,
    defaultDurationMs: 1200,
  }),
  curse: Object.freeze({
    id: 'curse',
    kind: 'debuff',
    dmgTakenMult: 1.22,
    defaultDurationMs: 5000,
  }),
  haste: Object.freeze({
    id: 'haste',
    kind: 'buff',
    moveSpeedMult: 1.3,
    defaultDurationMs: 3500,
  }),
  shield: Object.freeze({
    id: 'shield',
    kind: 'buff',
    defaultPower: 40,
    defaultDurationMs: 6000,
  }),
});

export function applyStatusEffect(
  entity,
  type,
  { durationMs, power, nowMs = Date.now(), stacks = 1 } = {},
) {
  if (!entity || !STATUS_EFFECTS[type]) return null;
  const spec = STATUS_EFFECTS[type];
  if (!entity.statuses || typeof entity.statuses !== 'object') {
    entity.statuses = {};
  }
  const dur = Number.isFinite(durationMs) && durationMs > 0 ? durationMs : spec.defaultDurationMs;
  const pow = Number.isFinite(power) ? power : (spec.defaultPower ?? 1);
  const existing = entity.statuses[type];
  const maxStacks = spec.maxStacks || 1;
  const nextStacks = existing
    ? Math.min(maxStacks, (existing.stacks || 1) + stacks)
    : Math.min(maxStacks, Math.max(1, stacks));

  const entry = {
    type,
    power: pow,
    stacks: nextStacks,
    durationMs: dur,
    remainingMs: dur,
    appliedAt: nowMs,
    lastNowMs: nowMs,
    expiresAt: nowMs + dur,
  };

  if (type === 'shield') {
    const shieldAmount = pow > 0 ? pow : spec.defaultPower;
    entry.absorb = shieldAmount;
    entity.shieldHp = (entity.shieldHp || 0) + shieldAmount;
  }

  entity.statuses[type] = entry;
  return entry;
}

export function stepEntityStatuses(entity, dt = 0, nowMs = null) {
  if (!entity) {
    return {
      dotDamage: 0,
      moveSpeedMult: 1,
      damageTakenMult: 1,
      dmgTakenMult: 1,
      stunned: false,
      shieldHp: 0,
      activeStatuses: [],
    };
  }
  if (!entity.statuses || typeof entity.statuses !== 'object') {
    entity.statuses = {};
  }

  const dtSec = Number.isFinite(dt) && dt > 0 ? (dt > 50 ? dt / 1000 : dt) : 0;
  let dotDamage = 0;
  let moveSpeedMult = 1.0;
  let damageTakenMult = 1.0;
  let stunned = false;

  for (const [type, st] of Object.entries(entity.statuses)) {
    if (!st) {
      delete entity.statuses[type];
      continue;
    }

    let elapsedMs = dtSec * 1000;
    if (elapsedMs === 0 && Number.isFinite(nowMs) && Number.isFinite(st.lastNowMs)) {
      elapsedMs = Math.max(0, nowMs - st.lastNowMs);
    }
    if (Number.isFinite(nowMs)) {
      st.lastNowMs = nowMs;
    }

    const activeElapsedMs = Math.min(st.remainingMs ?? st.durationMs ?? 0, elapsedMs);
    const activeSec = activeElapsedMs / 1000;

    if (activeSec > 0) {
      if (type === 'burn') {
        dotDamage += (st.power || STATUS_EFFECTS.burn.defaultPower) * activeSec;
      } else if (type === 'poison') {
        dotDamage += (st.power || STATUS_EFFECTS.poison.defaultPower) * (st.stacks || 1) * activeSec;
      }
    }

    st.remainingMs = (st.remainingMs ?? st.durationMs ?? 0) - elapsedMs;
    const expiredByClock = Number.isFinite(nowMs) && Number.isFinite(st.expiresAt) && nowMs >= st.expiresAt;
    if (st.remainingMs <= 0 || expiredByClock) {
      if (type === 'shield') {
        entity.shieldHp = 0;
      }
      delete entity.statuses[type];
      continue;
    }

    if (type === 'chill') moveSpeedMult *= STATUS_EFFECTS.chill.moveSpeedMult;
    if (type === 'haste') moveSpeedMult *= STATUS_EFFECTS.haste.moveSpeedMult;
    if (type === 'curse') damageTakenMult *= STATUS_EFFECTS.curse.dmgTakenMult;
    if (type === 'shock') {
      stunned = true;
      if (!entity.statuses.curse) {
        damageTakenMult *= STATUS_EFFECTS.shock.dmgTakenMult;
      }
    }
  }

  if (dotDamage > 0) {
    let rem = dotDamage;
    if ((entity.shieldHp || 0) > 0) {
      const absorbed = Math.min(entity.shieldHp, rem);
      entity.shieldHp -= absorbed;
      rem -= absorbed;
      if (entity.shieldHp <= 0 && entity.statuses.shield) {
        entity.shieldHp = 0;
        delete entity.statuses.shield;
      }
    }
    if (rem > 0 && typeof entity.hp === 'number') {
      entity.hp = Math.max(0, entity.hp - rem);
    }
  }

  entity.moveSpeedMult = moveSpeedMult;
  entity.damageTakenMult = damageTakenMult;
  entity.stunned = stunned;
  entity.shieldHp = entity.shieldHp || 0;

  return {
    dotDamage,
    moveSpeedMult,
    damageTakenMult,
    dmgTakenMult: damageTakenMult,
    stunned,
    shieldHp: entity.shieldHp,
    activeStatuses: Object.keys(entity.statuses),
  };
}

// ---------------------------------------------------------------------------------------------
// 5. Monster & Boss AI State Machine
// ---------------------------------------------------------------------------------------------
export const MONSTER_ARCHETYPES = Object.freeze({
  star_slime: Object.freeze({
    id: 'star_slime',
    name: 'Star Slime',
    rank: 'normal',
    hp: 80,
    atk: 10,
    moveSpeed: 2.4,
    aggroRadius: 6.5,
    attackRange: 1.4,
    leashRadius: 14,
    attackCooldownMs: 1400,
    skill: null,
  }),
  void_wolf: Object.freeze({
    id: 'void_wolf',
    name: 'Void Wolf',
    rank: 'normal',
    hp: 130,
    atk: 16,
    moveSpeed: 3.6,
    aggroRadius: 8.0,
    attackRange: 1.6,
    leashRadius: 18,
    attackCooldownMs: 1100,
    skill: null,
  }),
  eclipse_knight: Object.freeze({
    id: 'eclipse_knight',
    name: 'Eclipse Knight',
    rank: 'elite',
    hp: 420,
    atk: 28,
    moveSpeed: 2.8,
    aggroRadius: 9.5,
    attackRange: 2.0,
    leashRadius: 20,
    attackCooldownMs: 1500,
    skill: Object.freeze({
      id: 'melee_cleave',
      shape: 'cone',
      radius: 3.5,
      angleDeg: 110,
      windupMs: 900,
      cooldownMs: 6000,
      dmgMult: 1.8,
    }),
  }),
  astral_colossus: Object.freeze({
    id: 'astral_colossus',
    name: 'Astral Colossus',
    rank: 'boss',
    isBoss: true,
    hp: 2500,
    atk: 55,
    moveSpeed: 2.2,
    aggroRadius: 12.0,
    attackRange: 2.6,
    leashRadius: 26,
    attackCooldownMs: 1800,
    skill: Object.freeze({
      id: 'meteor_slam',
      shape: 'circle',
      radius: 4.2,
      windupMs: 1300,
      cooldownMs: 7500,
      dmgMult: 2.4,
    }),
  }),
});

let _monsterSeq = 1;

export function createMonsterEntity(archetypeOrId = 'star_slime', opts = {}) {
  const base =
    typeof archetypeOrId === 'string'
      ? MONSTER_ARCHETYPES[archetypeOrId] || MONSTER_ARCHETYPES.star_slime
      : { ...MONSTER_ARCHETYPES.star_slime, ...archetypeOrId };

  const x = Number.isFinite(opts.x) ? opts.x : 0;
  const z = Number.isFinite(opts.z) ? opts.z : 0;
  const homeX = Number.isFinite(opts.homeX) ? opts.homeX : x;
  const homeZ = Number.isFinite(opts.homeZ) ? opts.homeZ : z;
  const maxHp = opts.maxHp ?? opts.hp ?? base.hp ?? 100;

  return {
    id: opts.id || `${base.id}_${_monsterSeq++}`,
    archetype: base.id,
    name: opts.name || base.name,
    rank: opts.rank || base.rank || 'normal',
    isBoss: Boolean(opts.isBoss ?? base.isBoss ?? base.rank === 'boss'),
    x,
    z,
    homeX,
    homeZ,
    facing: opts.facing || 0,
    hp: opts.hp ?? maxHp,
    maxHp,
    atk: opts.atk ?? base.atk ?? 10,
    moveSpeed: opts.moveSpeed ?? base.moveSpeed ?? 2.5,
    aggroRadius: opts.aggroRadius ?? base.aggroRadius ?? 7.0,
    attackRange: opts.attackRange ?? base.attackRange ?? 1.5,
    leashRadius: opts.leashRadius ?? base.leashRadius ?? 16.0,
    attackCooldownMs: opts.attackCooldownMs ?? base.attackCooldownMs ?? 1400,
    skill: opts.skill !== undefined ? opts.skill : base.skill ? { ...base.skill } : null,
    state: opts.state || 'idle',
    targetId: null,
    telegraph: null,
    nextAttackAt: opts.nextAttackAt ?? 0,
    nextSkillAt: opts.nextSkillAt ?? 0,
    patrolAngle: opts.patrolAngle ?? 0,
    statuses: {},
  };
}

export function stepMonsterAI(monster, players = [], dt = 0.05, nowMs = Date.now(), zone = null) {
  if (!monster) return { state: 'idle', event: null };
  if (monster.hp <= 0) {
    monster.state = 'dead';
    monster.telegraph = null;
    return { state: 'dead', event: 'dead' };
  }

  const stResult = stepEntityStatuses(monster, dt, nowMs);
  if (stResult.stunned) {
    return { state: monster.state, event: 'stunned' };
  }

  const moveSpeed = (monster.moveSpeed || 2.5) * (stResult.moveSpeedMult || 1);
  const distFromHome = Math.hypot(monster.x - monster.homeX, monster.z - monster.homeZ);

  // Leash check: if chased beyond leashRadius from (homeX, homeZ), enter 'leash' and return home
  if (
    monster.state !== 'leash' &&
    Number.isFinite(monster.leashRadius) &&
    monster.leashRadius > 0 &&
    distFromHome > monster.leashRadius
  ) {
    monster.state = 'leash';
    monster.targetId = null;
    monster.telegraph = null;
  }

  if (monster.state === 'leash') {
    if (distFromHome <= 0.45) {
      monster.x = monster.homeX;
      monster.z = monster.homeZ;
      monster.hp = monster.maxHp;
      monster.state = 'idle';
      return { state: 'idle', event: 'leash_complete' };
    }
    const step = Math.min(distFromHome, moveSpeed * 1.45 * dt);
    const dx = (monster.homeX - monster.x) / distFromHome;
    const dz = (monster.homeZ - monster.z) / distFromHome;
    monster.x += dx * step;
    monster.z += dz * step;
    monster.facing = Math.atan2(dz, dx);
    if (zone) {
      const clamped = clampZoneWalkable(zone, monster.x, monster.z);
      monster.x = clamped.x;
      monster.z = clamped.z;
    }
    return { state: 'leash', event: 'returning_home' };
  }

  // Telegraph resolution: when windup completes, transition to 'attack' and fire the boss/elite skill
  if (monster.state === 'telegraph' && monster.telegraph) {
    if (nowMs >= monster.telegraph.endsAt) {
      const firedTelegraph = monster.telegraph;
      monster.telegraph = null;
      monster.state = 'attack';
      monster.nextAttackAt = nowMs + (monster.attackCooldownMs || 1400);
      return {
        state: 'attack',
        event: 'skill_attack',
        telegraph: firedTelegraph,
        damage: Math.round((monster.atk || 10) * (monster.skill?.dmgMult || 2.0)),
      };
    }
    return { state: 'telegraph', event: 'telegraph_windup', telegraph: monster.telegraph };
  }

  // Locate nearest living player
  const playerList = Array.isArray(players)
    ? players
    : players instanceof Map
      ? [...players.values()]
      : Object.values(players || {});

  let nearest = null;
  let nearestDist = Infinity;
  for (const p of playerList) {
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.z)) continue;
    if (p.hp != null && p.hp <= 0) continue;
    const d = Math.hypot(p.x - monster.x, p.z - monster.z);
    if (d < nearestDist) {
      nearestDist = d;
      nearest = p;
    }
  }

  // No player in aggro range -> idle or patrol around home
  if (!nearest || nearestDist > (monster.aggroRadius || 7.0)) {
    monster.targetId = null;
    monster.telegraph = null;
    if (monster.patrol && dt > 0) {
      monster.state = 'patrol';
      monster.patrolAngle = (monster.patrolAngle || 0) + dt * 0.6;
      const pr = monster.patrolRadius || 2.5;
      const tx = monster.homeX + Math.cos(monster.patrolAngle) * pr;
      const tz = monster.homeZ + Math.sin(monster.patrolAngle) * pr;
      const d = Math.hypot(tx - monster.x, tz - monster.z);
      if (d > 0.05) {
        const step = Math.min(d, moveSpeed * 0.6 * dt);
        monster.x += ((tx - monster.x) / d) * step;
        monster.z += ((tz - monster.z) / d) * step;
      }
      return { state: 'patrol', event: null };
    }
    monster.state = 'idle';
    return { state: 'idle', event: null };
  }

  monster.targetId = nearest.id || nearest.userId || 'player';
  monster.facing = Math.atan2(nearest.z - monster.z, nearest.x - monster.x);

  // Check if Boss / Elite special skill is ready to begin telegraphing
  const skill = monster.skill;
  const skillTriggerRange = skill ? Math.max(skill.range || 0, skill.radius || 3.5, monster.attackRange) : 0;
  if (skill && nowMs >= (monster.nextSkillAt || 0) && nearestDist <= skillTriggerRange) {
    const windupMs = skill.windupMs || 1000;
    const cooldownMs = skill.cooldownMs || 6000;
    const shape = skill.shape || 'circle';
    monster.state = 'telegraph';
    monster.telegraph = {
      shape,
      x: shape === 'circle' ? nearest.x : monster.x,
      z: shape === 'circle' ? nearest.z : monster.z,
      radius: skill.radius || 3.5,
      angleDeg: skill.angleDeg || 110,
      facing: monster.facing,
      endsAt: nowMs + windupMs,
    };
    monster.nextSkillAt = nowMs + windupMs + cooldownMs;
    return { state: 'telegraph', event: 'telegraph_start', telegraph: monster.telegraph };
  }

  // Within basic attack range
  if (nearestDist <= (monster.attackRange || 1.5)) {
    monster.state = 'attack';
    if (nowMs >= (monster.nextAttackAt || 0)) {
      monster.nextAttackAt = nowMs + (monster.attackCooldownMs || 1400);
      return {
        state: 'attack',
        event: 'basic_attack',
        targetId: monster.targetId,
        damage: monster.atk || 10,
      };
    }
    return { state: 'attack', event: 'attack_cooldown', targetId: monster.targetId };
  }

  // Chase target
  monster.state = 'chase';
  if (nearestDist > 1e-4 && dt > 0) {
    const step = Math.min(nearestDist - (monster.attackRange || 1.5) * 0.75, moveSpeed * dt);
    if (step > 0) {
      const dx = (nearest.x - monster.x) / nearestDist;
      const dz = (nearest.z - monster.z) / nearestDist;
      monster.x += dx * step;
      monster.z += dz * step;
      if (zone) {
        const clamped = clampZoneWalkable(zone, monster.x, monster.z);
        monster.x = clamped.x;
        monster.z = clamped.z;
      }
    }
  }
  return { state: 'chase', event: 'chasing', targetId: monster.targetId };
}
