// shared/skill_combos.js — Master Crafters Build-Craft Layer (pure, deterministic, zero I/O).
//
// Turns the 20 class-agnostic Monster Skills into a combo system:
//   • STATUS_TAGS     — short statuses applied by Setup skills (Soaked, Burning, Shocked, Chilled, Gathered, Staggered, Marked)
//   • REACTIONS       — Payoff rules that consume tags for bonus effects (Conduction, Shatter, Wildfire, …)
//   • SKILL_COMBO     — per-skill role + traits + applied tags (data-driven effect pipeline input)
//   • WEAPON_ECHO     — same skill, different flavour per active weapon class (no class locks)
//   • HIT3_PRIMES     — basic combo finishers feed the reaction system
//   • MONSTER_PASSIVES— a 2nd, rarer drop type slotted into a Passive slot
//   • MONSTER_ARCHETYPES / POISE — monsters that ask questions (Armored, Swarm, Kiter, Support, Elemental) + Boss/Elite Guard break
//   • Slot unlocks (4 active + 1 passive), 3 loadout presets, Skill Essence crafting & bad-luck scroll floor
//
// Server (server/sky_frontier_service.js) is authoritative; the client imports the same tables for UI/hints/auto-cast.

import { MONSTER_SKILLS, MONSTERS, BOSSES } from './combat_rules.js';

// ============================================================================
// 1. STATUS TAGS
// ============================================================================
// `bit` is used in the compact monster wire tag mask (sf_monsters entry [7]).
// `derived` tags are computed from existing monster fields (frozenUntil / stunUntil / breakUntil / wardUntil).
export const STATUS_TAGS = Object.freeze({
  soaked:    Object.freeze({ id: 'soaked',    icon: '💧', label: 'Soaked',       bit: 1,    ms: 5000, color: '#38BDF8' }),
  burning:   Object.freeze({ id: 'burning',   icon: '🔥', label: 'Burning',      bit: 2,    ms: 4000, color: '#F97316', dpsPct: 0.12 }),
  shocked:   Object.freeze({ id: 'shocked',   icon: '⚡', label: 'Shocked',      bit: 4,    ms: 3000, color: '#FACC15' }),
  chilled:   Object.freeze({ id: 'chilled',   icon: '❄️', label: 'Chilled',      bit: 8,    ms: 4000, color: '#A5F3FC', slowPct: 0.25 }),
  frozen:    Object.freeze({ id: 'frozen',    icon: '🧊', label: 'Frozen',       bit: 16,   derived: true, color: '#67E8F9' }),
  gathered:  Object.freeze({ id: 'gathered',  icon: '🌀', label: 'Gathered',     bit: 32,   ms: 2500, color: '#C084FC' }),
  staggered: Object.freeze({ id: 'staggered', icon: '💫', label: 'Staggered',    bit: 64,   ms: 2000, color: '#FDE68A' }),
  marked:    Object.freeze({ id: 'marked',    icon: '🌠', label: 'Marked',       bit: 128,  ms: 5000, color: '#F0ABFC', dmgTakenPct: 0.15 }),
  stunned:   Object.freeze({ id: 'stunned',   icon: '😵', label: 'Stunned',      bit: 256,  derived: true, color: '#FBBF24' }),
  broken:    Object.freeze({ id: 'broken',    icon: '💥', label: 'Guard Broken', bit: 512,  derived: true, color: '#F43F5E' }),
  warded:    Object.freeze({ id: 'warded',    icon: '🔔', label: 'Warded',       bit: 1024, derived: true, color: '#5EEAD4' }),
});
export const STATUS_TAG_IDS = Object.freeze(Object.keys(STATUS_TAGS));
export const TIMED_TAG_IDS = Object.freeze(STATUS_TAG_IDS.filter((k) => !STATUS_TAGS[k].derived));

export function tagActive(mon, tag, now) {
  if (!mon) return false;
  switch (tag) {
    case 'frozen': return (mon.frozenUntil || 0) > now;
    case 'stunned': return (mon.stunUntil || 0) > now;
    case 'broken': return (mon.breakUntil || 0) > now;
    case 'warded': return (mon.wardUntil || 0) > now && (mon.wardHp || 0) > 0;
    default: return (mon.tags?.[tag] || 0) > now;
  }
}

/** Compact bitmask of every active tag (sf_monsters wire entry [7]). */
export function tagMask(mon, now) {
  let mask = 0;
  for (const id of STATUS_TAG_IDS) if (tagActive(mon, id, now)) mask |= STATUS_TAGS[id].bit;
  return mask;
}

/** Decode a wire tag mask into an array of tag ids (client helper). */
export function decodeTagMask(mask) {
  const out = [];
  const m = Number(mask) || 0;
  if (!m) return out;
  for (const id of STATUS_TAG_IDS) if (m & STATUS_TAGS[id].bit) out.push(id);
  return out;
}

/** Applies (or refreshes) a timed tag. Returns the new expiry timestamp. */
export function applyTag(mon, tag, now, ms = null, durMult = 1) {
  const def = STATUS_TAGS[tag];
  if (!mon || !def || def.derived) return 0;
  mon.tags ||= {};
  const dur = Math.max(200, Math.round((ms ?? def.ms) * (durMult || 1)));
  mon.tags[tag] = Math.max(mon.tags[tag] || 0, now + dur);
  return mon.tags[tag];
}

export function clearTag(mon, tag, now) {
  if (!mon) return;
  if (tag === 'frozen') { if ((mon.frozenUntil || 0) > now) mon.frozenUntil = now; return; }
  if (tag === 'stunned') return; // stuns are never "consumed"
  if (mon.tags) delete mon.tags[tag];
  if (tag === 'burning') { mon.burnDps = 0; mon.burnBy = null; }
}

/** Extends every active timed tag (and freeze/slow) by `pct` of its remaining duration (Time Lock). */
export function extendTags(mon, now, pct = 0.5) {
  if (!mon) return;
  if (mon.tags) {
    for (const [k, until] of Object.entries(mon.tags)) {
      if (until > now) mon.tags[k] = until + Math.round((until - now) * pct);
    }
  }
  if ((mon.frozenUntil || 0) > now) mon.frozenUntil += Math.round((mon.frozenUntil - now) * pct);
  if ((mon.slowUntil || 0) > now) mon.slowUntil += Math.round((mon.slowUntil - now) * pct);
}

// ============================================================================
// 2. SKILL ROLES, TRAITS & APPLIED TAGS (data-driven effect pipeline input)
// ============================================================================
export const SKILL_ROLES = Object.freeze({
  engage:  Object.freeze({ id: 'engage',  icon: '🗡️', label: 'Engage',  desc: 'Close the gap and start the fight' }),
  control: Object.freeze({ id: 'control', icon: '🧲', label: 'Control', desc: 'Stun, slow, pull and set up combos' }),
  burst:   Object.freeze({ id: 'burst',   icon: '💥', label: 'Burst',   desc: 'Big damage payoffs' }),
  sustain: Object.freeze({ id: 'sustain', icon: '💚', label: 'Sustain', desc: 'Heal yourself and stay in the fight' }),
  support: Object.freeze({ id: 'support', icon: '🛡️', label: 'Support', desc: 'Shields, buffs and debuffs for the party' }),
  escape:  Object.freeze({ id: 'escape',  icon: '🍃', label: 'Escape',  desc: 'Reposition and dodge telegraphs' }),
});

// Traits: water, fire, shock, chill, wind, heavy, ground, light, drain
export const SKILL_TRAITS = Object.freeze({
  water:  Object.freeze({ icon: '💧', label: 'Water' }),
  fire:   Object.freeze({ icon: '🔥', label: 'Fire' }),
  shock:  Object.freeze({ icon: '⚡', label: 'Shock' }),
  chill:  Object.freeze({ icon: '❄️', label: 'Frost' }),
  wind:   Object.freeze({ icon: '🍃', label: 'Wind' }),
  heavy:  Object.freeze({ icon: '🔨', label: 'Heavy' }),
  ground: Object.freeze({ icon: '🪨', label: 'Ground AoE' }),
  light:  Object.freeze({ icon: '✨', label: 'Light' }),
  drain:  Object.freeze({ icon: '🩸', label: 'Drain' }),
});

const combo = (role, traits = [], applies = [], extra = {}) => Object.freeze({
  role, traits: Object.freeze(traits), applies: Object.freeze(applies), ...extra,
});

export const SKILL_COMBO = Object.freeze({
  // Meadow
  sk_pollen_ring:      combo('sustain'),
  sk_jelly_shield:     combo('support', ['water'], ['soaked']),
  sk_tusk_rush:        combo('engage',  ['heavy'], ['staggered']),
  sk_zephyr_vault:     combo('escape',  ['wind']),
  sk_earthshatter:     combo('control', ['heavy', 'ground'], ['staggered']),
  // Hollow
  sk_crystal_fan:      combo('burst',   ['heavy']),
  sk_echo_drain:       combo('sustain', ['drain']),
  sk_gravity_spin:     combo('control', [], ['gathered']),
  sk_frost_nova:       combo('control', ['chill'], ['chilled']),
  sk_prism_beam:       combo('burst',   ['light']),
  // Reef
  sk_foxfire_wisps:    combo('burst',   ['fire'], ['burning']),
  sk_mirror_shell:     combo('support', ['water'], ['soaked']),
  sk_tailwind_gale:    combo('support'),
  sk_koi_whirlpool:    combo('control', ['water', 'ground'], ['soaked', 'gathered']),
  sk_sakura_tempest:   combo('sustain', ['wind']),
  // Caldera
  sk_solar_meteor:     combo('burst',   ['fire', 'ground', 'heavy'], ['burning']),
  sk_chain_lightning:  combo('control', ['shock'], ['shocked']),
  sk_star_brand:       combo('support', ['ground', 'light'], ['marked']),
  sk_time_dilation:    combo('control', [], [], { extendTagsPct: 0.5 }),
  sk_supernova_cleave: combo('burst',   ['fire', 'heavy'], ['burning', 'staggered']),
});

/** Zone ticks re-apply a subset of their parent skill's identity. */
export const ZONE_COMBO = Object.freeze({
  koi_whirlpool:  combo('control', ['water'], ['soaked']),
  solar_burn:     combo('burst', ['fire'], ['burning']),
  sakura_tempest: combo('sustain', ['wind']),
  pollen_ring:    combo('sustain'),
});

// ============================================================================
// 3. REACTIONS (Setup → Payoff)
// ============================================================================
// `needs`: list of { trait?, source?, tag | tags } alternatives — any match triggers.
export const REACTIONS = Object.freeze({
  conduction: Object.freeze({
    id: 'conduction', icon: '⚡💧', label: 'Conduction', color: '#FDE047',
    desc: 'Shock meets Water (either order): ×1.5 DMG, 1.2s stun, Chain Arc +3 bounces',
    needs: Object.freeze([{ trait: 'shock', tag: 'soaked' }, { trait: 'water', tag: 'shocked' }]),
    dmgMult: 1.5, stunMs: 1200, extraBounces: 3, poise: 20, consume: Object.freeze(['soaked', 'shocked']),
  }),
  deep_freeze: Object.freeze({
    id: 'deep_freeze', icon: '❄️💧', label: 'Deep Freeze', color: '#67E8F9',
    desc: 'Frost on a Soaked foe: Freeze lasts twice as long',
    needs: Object.freeze([{ trait: 'chill', tag: 'soaked' }]),
    dmgMult: 1.1, freezeMult: 2, poise: 15, consume: Object.freeze(['soaked']),
  }),
  shatter: Object.freeze({
    id: 'shatter', icon: '🧊🔨', label: 'Shatter', color: '#A5F3FC',
    desc: 'Heavy hit on a Frozen foe: +60% DMG, breaks the ice',
    needs: Object.freeze([{ trait: 'heavy', tag: 'frozen' }]),
    dmgMult: 1.6, poise: 35, consume: Object.freeze(['frozen']),
  }),
  wildfire: Object.freeze({
    id: 'wildfire', icon: '🔥🍃', label: 'Wildfire', color: '#FB923C',
    desc: 'Wind on a Burning foe: +20% DMG and the fire spreads to foes within 3m',
    needs: Object.freeze([{ trait: 'wind', tag: 'burning' }]),
    dmgMult: 1.2, spreadRadius: 3.0, poise: 5, consume: Object.freeze([]),
  }),
  scald: Object.freeze({
    id: 'scald', icon: '♨️', label: 'Scald', color: '#FDA4AF',
    desc: 'Fire meets Water: +25% DMG and steam makes foes miss 30% of attacks for 3s',
    needs: Object.freeze([{ trait: 'fire', tag: 'soaked' }, { trait: 'water', tag: 'burning' }]),
    dmgMult: 1.25, missPct: 0.30, missMs: 3000, poise: 10, consume: Object.freeze(['soaked', 'burning']),
  }),
  crush: Object.freeze({
    id: 'crush', icon: '🌀🪨', label: 'Crush', color: '#C4B5FD',
    desc: 'Ground AoE on Gathered foes: +40% DMG',
    needs: Object.freeze([{ trait: 'ground', tag: 'gathered' }]),
    dmgMult: 1.4, poise: 15, consume: Object.freeze(['gathered']),
  }),
  exposed: Object.freeze({
    id: 'exposed', icon: '💫🎯', label: 'Exposed', color: '#FBBF24',
    desc: 'Any skill on a Stunned or Staggered foe lands a guaranteed critical (×1.5)',
    needs: Object.freeze([{ source: 'skill', tags: Object.freeze(['stunned', 'staggered']) }]),
    dmgMult: 1.5, crit: true, poise: 10, consume: Object.freeze(['staggered']),
  }),
  frostwind: Object.freeze({
    id: 'frostwind', icon: '❄️🍃', label: 'Frostwind', color: '#BAE6FD',
    desc: 'Wind on a Chilled foe: +20% DMG and the gust freezes it solid for 1.2s (sets up Shatter!)',
    needs: Object.freeze([{ trait: 'wind', tag: 'chilled' }]),
    dmgMult: 1.2, freezeMs: 1200, poise: 12, consume: Object.freeze(['chilled']),
  }),
  judgement: Object.freeze({
    id: 'judgement', icon: '✨🌠', label: 'Judgement', color: '#FEF08A',
    desc: 'Light skill on a Marked foe: ×1.6 DMG and heavy Guard damage',
    needs: Object.freeze([{ trait: 'light', tag: 'marked' }]),
    dmgMult: 1.6, poise: 25, consume: Object.freeze(['marked']),
  }),
  siphon: Object.freeze({
    id: 'siphon', icon: '🩸', label: 'Siphon', color: '#F472B6',
    desc: 'Drain skill on a Soaked, Burning, Shocked or Chilled foe: +30% DMG and double life-leech',
    needs: Object.freeze([{ trait: 'drain', tags: Object.freeze(['soaked', 'burning', 'shocked', 'chilled']) }]),
    dmgMult: 1.3, healMult: 2, poise: 6, consume: Object.freeze([]),
  }),
});
export const REACTION_IDS = Object.freeze(Object.keys(REACTIONS));
export const REACTION_DMG_CAP = 2.5;
export const REACTION_DISCOVERY_DIAMONDS = 30;

/** 🎶 Resonance: casting a Sustain/Support skill primes your NEXT damaging skill (within 5s). */
export const RESONANCE = Object.freeze({
  id: 'resonance', icon: '🎶', label: 'Resonance', color: '#86EFAC',
  desc: 'Casting a Sustain or Support skill primes your next damaging skill: +25% DMG and its statuses last +50%.',
  primeRoles: Object.freeze(['sustain', 'support']),
  windowMs: 5000, dmgMult: 1.25, tagDurMult: 1.5,
});

/**
 * Pure: which reactions does this hit trigger against `mon`'s CURRENT tags?
 * Must be evaluated BEFORE the hit applies its own tags (a skill never combos with itself).
 * @returns {Array<object>} matched REACTIONS defs
 */
export function resolveReactions(mon, { traits = [], source = 'skill' } = {}, now = 0) {
  if (!mon) return [];
  const out = [];
  for (const def of Object.values(REACTIONS)) {
    const hit = def.needs.some((n) => {
      if (n.source && n.source !== source) return false;
      if (n.trait && !traits.includes(n.trait)) return false;
      const tags = n.tags || [n.tag];
      return tags.some((tg) => tagActive(mon, tg, now));
    });
    if (hit) out.push(def);
  }
  return out;
}

export function reactionDamageMult(reactions = []) {
  let mult = 1;
  for (const r of reactions) mult *= r.dmgMult || 1;
  return Math.min(REACTION_DMG_CAP, mult);
}

/** Static combo hints: which other skills set up / pay off this skill (for Skill Book UI). */
export function comboPartners(skillId) {
  const me = SKILL_COMBO[skillId];
  if (!me) return [];
  const out = new Map();
  for (const [otherId, other] of Object.entries(SKILL_COMBO)) {
    if (otherId === skillId) continue;
    for (const r of Object.values(REACTIONS)) {
      for (const n of r.needs) {
        const tags = n.tags || [n.tag];
        const meSets = tags.some((tg) => me.applies.includes(tg) || (tg === 'frozen' && me.traits.includes('chill')) || (tg === 'stunned' && STUN_SKILLS.has(skillId)));
        const otherPays = (!n.trait || other.traits.includes(n.trait)) && (!n.source || n.source === 'skill');
        const otherSets = tags.some((tg) => other.applies.includes(tg) || (tg === 'frozen' && other.traits.includes('chill')) || (tg === 'stunned' && STUN_SKILLS.has(otherId)));
        const mePays = (!n.trait || me.traits.includes(n.trait)) && (!n.source || n.source === 'skill');
        if (n.trait && meSets && otherPays) out.set(`${otherId}:${r.id}:setup`, { skillId: otherId, reactionId: r.id, direction: 'setup' });
        if (n.trait && otherSets && mePays) out.set(`${otherId}:${r.id}:payoff`, { skillId: otherId, reactionId: r.id, direction: 'payoff' });
      }
    }
  }
  return [...out.values()];
}

/** Skills that inflict a hard stun (count as Setup for Exposed). */
export const STUN_SKILLS = new Set(['sk_tusk_rush', 'sk_earthshatter', 'sk_chain_lightning', 'sk_supernova_cleave', 'sk_frost_nova']);

/** Smart auto-cast helper: is this skill a payoff against the target's current tag mask? */
export function isPayoffAgainst(skillId, mask) {
  const me = SKILL_COMBO[skillId];
  if (!me || !mask) return false;
  const active = decodeTagMask(mask);
  return Object.values(REACTIONS).some((r) => r.needs.some((n) => {
    if (n.trait && !me.traits.includes(n.trait)) return false;
    const tags = n.tags || [n.tag];
    return tags.some((tg) => active.includes(tg));
  }));
}

// ============================================================================
// 4. WEAPON ECHO & HIT-3 PRIMES (class flavour without class locks)
// ============================================================================
export const WEAPON_ECHO = Object.freeze({
  melee: Object.freeze({
    id: 'melee', icon: '⚔️', label: 'Melee Echo',
    desc: 'Dash & self-AoE skills +20% radius · every skill hit Staggers',
    radiusMult: 1.2, appliesOnHit: Object.freeze(['staggered']),
  }),
  ranged: Object.freeze({
    id: 'ranged', icon: '🏹', label: 'Ranged Echo',
    desc: 'Cone, line, homing & chain skills +25% range · +1 orb / +1 bounce',
    rangeMult: 1.25, extraProjectiles: 1,
  }),
  magic: Object.freeze({
    id: 'magic', icon: '🪄', label: 'Magic Echo',
    desc: 'Zone skills +1 pulse · statuses you apply last +30%',
    extraZoneTicks: 1, tagDurMult: 1.3,
  }),
});

const MELEE_ECHO_AIMS = new Set(['self_aoe']);
const RANGED_ECHO_AIMS = new Set(['cone', 'line', 'homing', 'chain']);

/** Resolved per-cast echo modifiers for (skillId, weaponClass). */
export function weaponEchoFor(skillId, weaponClass) {
  const sk = MONSTER_SKILLS[skillId];
  const out = { weaponClass, radiusMult: 1, rangeMult: 1, extraProjectiles: 0, extraZoneTicks: 0, tagDurMult: 1, appliesOnHit: [] };
  if (!sk) return out;
  const echo = WEAPON_ECHO[weaponClass];
  if (!echo) return out;
  if (weaponClass === 'melee') {
    if (MELEE_ECHO_AIMS.has(sk.aimType) || skillId === 'sk_tusk_rush') out.radiusMult = echo.radiusMult;
    out.appliesOnHit = [...echo.appliesOnHit];
  } else if (weaponClass === 'ranged') {
    if (RANGED_ECHO_AIMS.has(sk.aimType) && skillId !== 'sk_tusk_rush') {
      out.rangeMult = echo.rangeMult;
      out.extraProjectiles = echo.extraProjectiles;
    }
  } else if (weaponClass === 'magic') {
    out.extraZoneTicks = echo.extraZoneTicks;
    out.tagDurMult = echo.tagDurMult;
  }
  return out;
}

export const HIT3_PRIMES = Object.freeze({
  melee:  Object.freeze({ label: 'Stagger', traits: Object.freeze(['heavy']), applies: Object.freeze(['staggered']) }),
  ranged: Object.freeze({ label: 'Mark (3s)', traits: Object.freeze([]), applies: Object.freeze(['marked']), tagMs: 3000 }),
  magic:  Object.freeze({ label: 'Extend statuses +1s', traits: Object.freeze([]), applies: Object.freeze([]), extendMs: 1000 }),
});

// ============================================================================
// 5. MONSTER PASSIVES (2nd drop type, 1 Passive slot, Lv.1 → Lv.3)
// ============================================================================
const passive = (id, name, icon, sourceId, kind, values, desc, extra = {}) => Object.freeze({
  id, name, icon, sourceId,
  sourceName: MONSTERS[sourceId]?.name || sourceId,
  region: MONSTERS[sourceId]?.region || 'meadow',
  kind, values: Object.freeze(values), desc, ...extra,
});

export const MONSTER_PASSIVES = Object.freeze({
  ps_thick_hide:    passive('ps_thick_hide', 'Thornhide Bulwark', '🐗', 'thornback_boar', 'dmg_taken', [0.06, 0.09, 0.12], 'Take {v}% less damage from monsters.'),
  ps_gel_regen:     passive('ps_gel_regen', 'Mossgel Regeneration', '🫧', 'moss_slime', 'regen', [0.6, 1.0, 1.4], '+{v} HP/s passive regeneration.'),
  ps_bloodthirst:   passive('ps_bloodthirst', 'Lantern Bloodthirst', '🦇', 'lantern_bat', 'leech', [0.03, 0.045, 0.06], 'Basic attacks leech {v}% of damage dealt.'),
  ps_frost_touch:   passive('ps_frost_touch', 'Frostcap Touch', '❄️', 'hollow_frost_shroom', 'hit3_tag', [1500, 2000, 2500], 'Basic Hit-3 Chills the target for {v}s.', { tag: 'chilled' }),
  ps_foxfire_trail: passive('ps_foxfire_trail', 'Foxfire Trail', '🦊', 'reef_sakura_kitsune', 'hit3_tag', [2000, 2500, 3000], 'Basic Hit-3 sets the target Burning for {v}s.', { tag: 'burning' }),
  ps_tide_blessing: passive('ps_tide_blessing', 'Tide-Pearl Blessing', '🦪', 'reef_pearl_snapper', 'shield', [0.10, 0.15, 0.20], 'Shields you grant are {v}% stronger.'),
  ps_static_core:   passive('ps_static_core', 'Aether Static Core', '⚡', 'sanctum_arc_automaton', 'shock_chance', [0.12, 0.16, 0.20], 'Basic attacks have a {v}% chance to Shock (counts as a Shock hit).'),
  ps_star_sight:    passive('ps_star_sight', 'Griffon Star-Sight', '🌠', 'sanctum_star_gargoyle', 'crit', [0.04, 0.06, 0.08], '+{v}% critical chance.'),
});
export const MONSTER_PASSIVE_IDS = Object.freeze(Object.keys(MONSTER_PASSIVES));

export const PASSIVE_DROP_RATES = Object.freeze({
  MOB_BASE: 0.012,   // 1.2% × rareFindMult
  ELITE_BASE: 0.05,  // 5.0% × rareFindMult on Alpha Elites
  MAX_LEVEL: 3,
});

const PASSIVE_BY_SOURCE = Object.freeze(Object.fromEntries(Object.values(MONSTER_PASSIVES).map((ps) => [ps.sourceId, ps])));
export function passiveBySource(sourceId) { return PASSIVE_BY_SOURCE[sourceId] || null; }

export function passiveValue(passiveId, level = 1) {
  const def = MONSTER_PASSIVES[passiveId];
  if (!def) return 0;
  const idx = Math.max(0, Math.min(def.values.length - 1, (Number(level) || 1) - 1));
  return def.values[idx];
}

export function passiveDescFor(passiveId, level = 1) {
  const def = MONSTER_PASSIVES[passiveId];
  if (!def) return '';
  const v = passiveValue(passiveId, level);
  const shown = def.kind === 'hit3_tag' ? (v / 1000).toFixed(1)
    : (def.kind === 'regen' ? v.toFixed(1) : String(Math.round(v * 1000) / 10));
  return def.desc.replace('{v}', shown);
}

export function rollMonsterPassiveDrop({ sourceId, isElite = false, rareFindMult = 1, rng = Math.random } = {}) {
  const ps = passiveBySource(sourceId);
  if (!ps) return { dropped: false, passiveId: null };
  const base = isElite ? PASSIVE_DROP_RATES.ELITE_BASE : PASSIVE_DROP_RATES.MOB_BASE;
  const chance = Math.min(0.25, base * Math.max(1, Number(rareFindMult) || 1));
  return rng() < chance ? { dropped: true, passiveId: ps.id } : { dropped: false, passiveId: null };
}

/** Active passive { id, level, value, def } for a profile, or null. */
export function activePassive(profile) {
  const sk = profile?.frontier?.skills;
  const id = sk?.passive;
  if (!id || !MONSTER_PASSIVES[id]) return null;
  const level = Math.max(0, Number(sk.passives?.[id]) || 0);
  if (level < 1) return null;
  return { id, level, value: passiveValue(id, level), def: MONSTER_PASSIVES[id] };
}

// ============================================================================
// 6. SLOTS, PRESETS, ESSENCE & BAD-LUCK FLOOR
// ============================================================================
export const SKILL_SLOT_COUNT = 4;
export const PRESET_COUNT = 3;
export const PRESET_COMBAT_LOCK_MS = 4000;

export function defaultFrontierSkills() {
  return {
    unlocked: {},
    equipped: [null, null, null, null],
    passive: null,
    passives: {},
    presets: [null, null, null],
    essence: 0,
    reactionsFound: {},
  };
}

/** Normalizes (in place) any legacy `frontier.skills` object to the 4-slot + passive + presets shape. */
export function normalizeFrontierSkills(sk) {
  if (!sk || typeof sk !== 'object' || Array.isArray(sk)) return defaultFrontierSkills();
  const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
  if (!isObj(sk.unlocked)) sk.unlocked = {};
  const eq = Array.isArray(sk.equipped) ? sk.equipped : [];
  if (eq.length !== SKILL_SLOT_COUNT) {
    sk.equipped = Array.from({ length: SKILL_SLOT_COUNT }, (_, i) => eq[i] ?? null);
  }
  if (!isObj(sk.passives)) sk.passives = {};
  if (sk.passive === undefined || (sk.passive !== null && !MONSTER_PASSIVES[sk.passive])) sk.passive = null;
  if (!Array.isArray(sk.presets) || sk.presets.length !== PRESET_COUNT) {
    const pr = Array.isArray(sk.presets) ? sk.presets : [];
    sk.presets = Array.from({ length: PRESET_COUNT }, (_, i) => (isObj(pr[i]) ? pr[i] : null));
  }
  sk.essence = Math.max(0, Number(sk.essence) || 0);
  if (!isObj(sk.reactionsFound)) sk.reactionsFound = {};
  delete sk.bossPity;
  return sk;
}

export const SLOT_UNLOCK_RULES = Object.freeze([
  Object.freeze({ slot: 0, hint: 'Unlocked' }),
  Object.freeze({ slot: 1, hint: 'Unlocked' }),
  Object.freeze({ slot: 2, level: 12, storyChapter: 3, hint: 'Reach Lv.12 or Story Chapter 3' }),
  Object.freeze({ slot: 3, level: 25, masteredSpecies: 6, masteryKills: 30, hint: 'Reach Lv.25 or master 6 species (30 kills each)' }),
]);

export function masteredSpeciesCount(profile, kills = 30) {
  const byMob = profile?.frontier?.stats?.killsByMob || {};
  let n = 0;
  for (const [id, c] of Object.entries(byMob)) if (MONSTERS[id] && (Number(c) || 0) >= kills) n += 1;
  return n;
}

/** Boolean[4] — which active skill slots this profile has unlocked. */
export function skillSlotUnlocks(profile) {
  const lv = Number(profile?.level) || 1;
  const ch = Number(profile?.story?.chapter) || 0;
  const done = Array.isArray(profile?.story?.completed) ? profile.story.completed : [];
  return SLOT_UNLOCK_RULES.map((r) => {
    if (r.slot < 2) return true;
    if (r.slot === 2) return lv >= r.level || ch >= r.storyChapter || done.includes(r.storyChapter - 1);
    return lv >= r.level || masteredSpeciesCount(profile, r.masteryKills) >= r.masteredSpecies;
  });
}

export const ESSENCE = Object.freeze({
  PER_EXCESS_MOB: 1,
  PER_EXCESS_BOSS: 3,
  PER_EXCESS_PASSIVE: 1,
  CRAFT_COST_MOB: 6,
  CRAFT_COST_BOSS: 15,
  CRAFT_COST_PASSIVE: 8,
  REQ_KILLS_MOB: 10,
  REQ_KILLS_BOSS: 1,
});

/** First scroll is guaranteed once you have killed this many of the source (RNG stays exciting, no dead-ends). */
export const SCROLL_FLOOR_KILLS = Object.freeze({ mob: 30, boss: 5 });

export function essenceCraftCost(skillOrPassiveId) {
  if (MONSTER_PASSIVES[skillOrPassiveId]) return ESSENCE.CRAFT_COST_PASSIVE;
  const sk = MONSTER_SKILLS[skillOrPassiveId];
  if (!sk) return null;
  return sk.isBossSkill ? ESSENCE.CRAFT_COST_BOSS : ESSENCE.CRAFT_COST_MOB;
}

/** Can this profile craft the given skill/passive with Essence? */
export function canEssenceCraft(profile, id) {
  const sk = MONSTER_SKILLS[id];
  const ps = MONSTER_PASSIVES[id];
  if (!sk && !ps) return { ok: false, error: 'unknown_skill' };
  const sourceId = sk ? sk.sourceId : ps.sourceId;
  const isBoss = Boolean(sk?.isBossSkill);
  const kills = Number(profile?.frontier?.stats?.killsByMob?.[sourceId]) || 0;
  const req = isBoss ? ESSENCE.REQ_KILLS_BOSS : ESSENCE.REQ_KILLS_MOB;
  if (kills < req) return { ok: false, error: 'codex_locked', need: req, have: kills };
  const skills = profile?.frontier?.skills || {};
  const cur = sk ? (Number(skills.unlocked?.[id]) || 0) : (Number(skills.passives?.[id]) || 0);
  const max = sk ? 5 : PASSIVE_DROP_RATES.MAX_LEVEL;
  if (cur >= max) return { ok: false, error: 'maxed' };
  const cost = essenceCraftCost(id);
  const have = Number(skills.essence) || 0;
  if (have < cost) return { ok: false, error: 'not_enough_essence', need: cost, have };
  return { ok: true, cost, kind: sk ? 'skill' : 'passive' };
}

// ============================================================================
// 7. MONSTER ARCHETYPES, ELEMENTS & POISE (Guard)
// ============================================================================
export const MONSTER_ARCHETYPES = Object.freeze({
  armored: Object.freeze({
    id: 'armored', icon: '🛡️', label: 'Armored',
    desc: 'Takes −45% damage until its Guard is broken by stuns, staggers & heavy hits.',
    answer: 'Control · Heavy · Shatter', maxPoise: 40, guardReduce: 0.45,
  }),
  swarm: Object.freeze({
    id: 'swarm', icon: '🐝', label: 'Swarm',
    desc: 'Hits +10% harder for each nearby packmate (max +40%).',
    answer: 'AoE · Gather + Crush', perAlly: 0.10, maxBonus: 0.40, radius: 4.0,
  }),
  kiter: Object.freeze({
    id: 'kiter', icon: '🪽', label: 'Kiter',
    desc: 'Backs away to keep its distance once provoked.',
    answer: 'Gap-closers · Pulls · Ranged', keepAway: 4.2,
  }),
  support: Object.freeze({
    id: 'support', icon: '🔔', label: 'Support',
    desc: 'Wards nearby allies with a 20% Max-HP shield every 6.5s while provoked.',
    answer: 'Burst it first · Interrupt with stuns', wardEveryMs: 6500, wardPct: 0.20, wardRadius: 6.0, wardMs: 5000,
  }),
  elemental: Object.freeze({
    id: 'elemental', icon: '🌋', label: 'Elemental',
    desc: 'Immune to its own element and resists it; weak to the opposite element.',
    answer: 'Counter-element skills',
  }),
});

export const MONSTER_ARCHETYPE_BY_TYPE = Object.freeze({
  pollen_wisp:               Object.freeze({ archetype: 'swarm' }),
  lantern_bat:               Object.freeze({ archetype: 'swarm' }),
  quartz_golemling:          Object.freeze({ archetype: 'armored' }),
  reef_pearl_snapper:        Object.freeze({ archetype: 'armored' }),
  sanctum_chrono_sentinel:   Object.freeze({ archetype: 'armored' }),
  meadow_zephyr_hare:        Object.freeze({ archetype: 'kiter' }),
  reef_cloud_crane:          Object.freeze({ archetype: 'kiter' }),
  sanctum_arc_automaton:     Object.freeze({ archetype: 'kiter' }),
  reef_bell_spirit:          Object.freeze({ archetype: 'support' }),
  hollow_frost_shroom:       Object.freeze({ archetype: 'support' }),
  crystal_beetle:            Object.freeze({ archetype: 'elemental', element: 'chill', immune: Object.freeze(['chilled']), resist: 'chill', weak: 'fire' }),
  sanctum_cinder_salamander: Object.freeze({ archetype: 'elemental', element: 'fire', immune: Object.freeze(['burning']), resist: 'fire', weak: 'water' }),
});
export const ELEMENT_RESIST_MULT = 0.6;
export const ELEMENT_WEAK_MULT = 1.35;

export function archetypeOf(type) {
  const a = MONSTER_ARCHETYPE_BY_TYPE[type];
  return a ? { ...a, def: MONSTER_ARCHETYPES[a.archetype] } : null;
}

/** Elemental damage multiplier for a hit with `traits` against monster `type`. */
export function elementMult(type, traits = []) {
  const a = MONSTER_ARCHETYPE_BY_TYPE[type];
  if (!a || a.archetype !== 'elemental') return 1;
  if (a.resist && traits.includes(a.resist)) return ELEMENT_RESIST_MULT;
  if (a.weak && traits.includes(a.weak)) return ELEMENT_WEAK_MULT;
  return 1;
}

export function isTagImmune(type, tag) {
  const a = MONSTER_ARCHETYPE_BY_TYPE[type];
  return Boolean(a?.immune?.includes(tag));
}

export const POISE = Object.freeze({
  BOSS_MAX: 100,
  ELITE_MAX: 60,
  BREAK_MS: 4000,
  BREAK_DMG_MULT: 1.5,
  BREAK_STUN_MS: 2000,
  REGEN_DELAY_MS: 6000,
  DAMAGE: Object.freeze({ skillHit: 4, stunApply: 25, staggerApply: 10, heavyHit: 12, hit3: 8 }),
});

/** Max poise for a spawned monster (0 = no Guard bar). */
export function maxPoiseFor(type, { isBoss = false, isElite = false } = {}) {
  if (isBoss || BOSSES[type]) return POISE.BOSS_MAX;
  if (isElite) return POISE.ELITE_MAX;
  const a = MONSTER_ARCHETYPE_BY_TYPE[type];
  if (a?.archetype === 'armored') return MONSTER_ARCHETYPES.armored.maxPoise;
  return 0;
}

/** Wire value for sf_monsters entry [8]: null (no guard) · -1 (broken) · 0..100 (% remaining). */
export function poiseWire(mon, now) {
  if (!mon || !(mon.maxPoise > 0)) return null;
  if ((mon.breakUntil || 0) > now) return -1;
  return Math.max(0, Math.min(100, Math.round(((mon.poise || 0) / mon.maxPoise) * 100)));
}
