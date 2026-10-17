// shared/skill_engine.js — composable "Lego-Block" SkillEngine (Implementation Plan §5).
//
// Engine rules enforced here and in shared/monopoly_engine.js:
//   1. Max 1 secondary hop: forced moves (MOVE_PLAYERS) resolve rent only and never trigger tile moves.
//   2. 1 status slot per player (`player.status`) and 1 modifier slot per tile (`tile.modifier`):
//      applying a new one cleanly overwrites the old one — two hexes can never fight.
//   3. State first, cutscene second: every action mutates state synchronously and only *appends events*;
//      the client animates the event queue afterwards, so a slow phone can never freeze the room.
//
// The engine passes `ops` so money / movement / bankruptcy rules live in exactly one place:
//   ops.pay(from, to, amount, reason)   seat|null → seat|null (null = bank); handles liquidation/bankruptcy
//   ops.forcedLand(seat, idx, path, kind) move + rent-only resolution (no hops, no buy offers)
//   ops.setPending(pending)             ask the caster for a choice (CHOICE / WARP_PICK)
//   ops.ev(event)                       append to the cutscene queue
//   ops.rand()                          deterministic match RNG
import { MONO, TILES, PROPERTY_IDX, rentFor, netWorth, ownedTiles, bestTile, investedValue, tileSide, stepsBetween, wrap } from './monopoly_rules.js';
import { SEASON_SKILLS, GENERIC_SKILLS } from './season_skills.js';

export const alive = (m) => m.players.filter((p) => !p.bankrupt);
export const rivalsOf = (m, seat) => m.players.filter((p) => !p.bankrupt && p.seat !== seat);

export function richestRival(m, seat) {
  let best = null, bw = -1;
  for (const p of rivalsOf(m, seat)) {
    const w = netWorth(m, p.seat);
    if (w > bw) { bw = w; best = p; }
  }
  return best;
}

export function isUnderdog(m, seat) {
  const mine = netWorth(m, seat);
  return rivalsOf(m, seat).every((p) => netWorth(m, p.seat) >= mine);
}

const byRentDesc = (m) => (a, b) => rentFor(m, b) - rentFor(m, a) || investedValue(TILES[b], m.tiles[b].level) - investedValue(TILES[a], m.tiles[a].level) || a - b;

/** A rival's skill can't weaken an indestructible Tier-4 monument. */
const hostileTo = (mod) => mod.reverseTrap || (typeof mod.rentMult === 'number' && mod.rentMult < 1);

function resolveTiles(m, seat, a) {
  const me = m.players[seat];
  const count = a.count ?? 1;
  switch (a.target) {
    case 'my_tiles': return ownedTiles(m, seat).sort(byRentDesc(m)).slice(0, count);
    case 'my_best': { const b = bestTile(m, seat); return b == null ? [] : [b]; }
    case 'rival_best': {
      const all = rivalsOf(m, seat).flatMap((p) => ownedTiles(m, p.seat));
      return all.filter((i) => !(m.tiles[i].level >= 4 && hostileTo(a.modifier || {}))).sort(byRentDesc(m)).slice(0, count);
    }
    case 'around_caster': {
      const r = a.radius ?? 2;
      const out = [];
      for (let d = -r; d <= r; d++) {
        const i = wrap(me.pos + d), t = m.tiles[i];
        if (TILES[i].kind !== 'property' || t.owner == null) continue;
        if (a.ownedBy === 'self' && t.owner !== seat) continue;
        if (a.ownedBy === 'rivals' && (t.owner === seat || (t.level >= 4 && hostileTo(a.modifier || {})))) continue;
        out.push(i);
      }
      return out;
    }
    case 'behind_caster': {
      const out = [];
      for (let d = 1; out.length < count && d < MONO.BOARD_N; d++) {
        const i = wrap(me.pos - d);
        if (i !== 0) out.push(i);
      }
      return out;
    }
    case 'ahead_of_rivals': {
      const targets = a.rival === 'richest_rival' ? [richestRival(m, seat)].filter(Boolean) : rivalsOf(m, seat).sort((x, y) => netWorth(m, y.seat) - netWorth(m, x.seat));
      const out = [];
      for (const p of targets) {
        const i = wrap(p.pos + (a.offset ?? 4));
        if (i !== 0 && !out.includes(i)) out.push(i);
        if (out.length >= count) break;
      }
      return out;
    }
    case 'before_my_best': {
      const out = [];
      for (const b of ownedTiles(m, seat).sort(byRentDesc(m))) {
        const i = wrap(b - (a.offset ?? 2));
        if (i !== 0 && m.tiles[i].owner !== seat && !out.includes(i)) out.push(i);
        if (out.length >= count) break;
      }
      return out;
    }
    default: return [];
  }
}

function resolvePlayers(m, seat, target) {
  if (target === 'self') return [m.players[seat]];
  if (target === 'all_rivals') return rivalsOf(m, seat);
  if (target === 'richest_rival') { const r = richestRival(m, seat); return r ? [r] : []; }
  return [];
}

/** Runs a list of action blocks. Returns the number of effects that actually changed the game. */
export function runActions(ctx, actions = []) {
  let n = 0;
  for (const a of actions) {
    if (ctx.m.ended) break;
    n += runAction(ctx, a);
  }
  return n;
}

/**
 * 🛡️ A Barrier Shield blocks a hostile Pet ult (Dopamine Patch §3). One shield makes the target immune to the
 * rest of that cast. Owner ults keep their existing behaviour (shields only block rent).
 */
function shieldBlocks(ctx, p) {
  if (!ctx.isPetUlt || !p || p.seat === ctx.seat) return false;
  ctx.blocked ||= new Set();
  if (ctx.blocked.has(p.seat)) return true;
  if (!(p.shields > 0)) return false;
  p.shields--;
  ctx.blocked.add(p.seat);
  ctx.ops.ev({ t: 'shield_break', seat: p.seat, by: ctx.seat, byPet: true, skillId: ctx.skillId });
  return true;
}

function runAction(ctx, a) {
  const { m, seat, ops, scale } = ctx;
  const me = m.players[seat];
  const cash = (v) => Math.round(v * scale);
  switch (a.action) {
    case 'APPLY_PLAYER_STATUS': {
      let n = 0;
      for (const p of resolvePlayers(m, seat, a.target)) {
        if (shieldBlocks(ctx, p)) { n++; continue; }
        p.status = { ...a.status, id: ctx.skillId, owner: seat, fresh: p.seat === seat };
        ops.ev({ t: 'status', seat: p.seat, by: seat, status: p.status });
        n++;
      }
      return n;
    }
    case 'PLACE_TILE_MODIFIER': {
      let n = 0;
      const turnsLeft = ctx.isPetUlt && a.modifier?.turnsLeft
        ? Math.max(1, Math.round(a.modifier.turnsLeft * 0.67))
        : a.modifier?.turnsLeft;
      for (const i of resolveTiles(m, seat, a)) {
        m.tiles[i].modifier = { ...a.modifier, ...(turnsLeft != null ? { turnsLeft } : {}), id: ctx.skillId, owner: seat };
        ops.ev({ t: 'modifier', tile: i, by: seat, modifier: m.tiles[i].modifier });
        n++;
      }
      return n;
    }
    case 'MOVE_PLAYERS': {
      let n = 0;
      for (const p of resolvePlayers(m, seat, a.target)) {
        if (p.bankrupt) continue;
        if (shieldBlocks(ctx, p)) { n++; continue; }
        let steps = a.steps ?? 0;
        if (a.pullTowardCaster) {
          const d = stepsBetween(p.pos, me.pos);
          if (d === 0) continue;
          steps = Math.sign(d) * Math.min(a.pullTowardCaster, Math.abs(d));
        }
        if (!steps) continue;
        const path = [];
        for (let s = 1; s <= Math.abs(steps); s++) path.push(wrap(p.pos + Math.sign(steps) * s));
        ops.forcedLand(p.seat, path[path.length - 1], path, 'pull');
        n++;
      }
      return n;
    }
    case 'MODIFY_PROPERTY': {
      const r = richestRival(m, seat);
      if (!r) return 0;
      const i = bestTile(m, r.seat, (k) => m.tiles[k].level < 4 && m.tiles[k].level > 0) ?? bestTile(m, r.seat, (k) => m.tiles[k].level < 4);
      if (i == null) return 0;
      const t = m.tiles[i];
      const before = t.level;
      t.level = Math.max(0, Math.min(MONO.MAX_BUILD_TIER, t.level + (a.level ?? -1)));
      ops.ev({ t: 'tier', tile: i, level: t.level, from: before, by: seat, smite: true });
      if (a.bounty) ops.pay(null, seat, cash(a.bounty), 'bounty');
      return 1;
    }
    case 'TRANSFER_CASH': {
      let n = 0;
      for (const p of resolvePlayers(m, seat, a.from)) {
        if (shieldBlocks(ctx, p)) { n++; continue; }
        const amt = a.pct ? Math.round(p.cash * a.pct * scale) : cash(a.amount);
        if (amt > 0) { ops.pay(p.seat, seat, amt, 'skill'); n++; }
      }
      return n;
    }
    case 'GAIN_CASH':
      ops.pay(null, seat, cash(a.amount), 'skill');
      return 1;
    case 'SET_TILE_TIER': {
      const [i] = resolveTiles(m, seat, a);
      if (i == null) return 0;
      const before = m.tiles[i].level;
      const next = a.step ? Math.min(a.tier, before + a.step) : a.tier;
      if (next === before) return 0;
      m.tiles[i].level = next;
      ops.ev({ t: 'tier', tile: i, level: next, from: before, by: seat });
      return 1;
    }
    case 'CLEAR_MODIFIERS': {
      const side = tileSide(me.pos);
      let n = 0;
      for (let i = 0; i < MONO.BOARD_N; i++) {
        const mod = m.tiles[i].modifier;
        if (tileSide(i) !== side || !mod || mod.owner === seat) continue;
        m.tiles[i].modifier = null;
        ops.ev({ t: 'modifier', tile: i, by: seat, modifier: null });
        n++;
      }
      return n;
    }
    case 'STEAL_PROPERTY': {
      const r = richestRival(m, seat);
      if (!r) return 0;
      const pick = ownedTiles(m, r.seat).filter((i) => m.tiles[i].level <= (a.maxTier ?? 2)).sort((x, y) => investedValue(TILES[x], m.tiles[x].level) - investedValue(TILES[y], m.tiles[y].level))[0];
      if (pick == null) return 0;
      m.tiles[pick].owner = seat;
      ops.ev({ t: 'steal', tile: pick, from: r.seat, to: seat });
      return 1;
    }
    case 'SWAP_PROPERTY': {
      const r = richestRival(m, seat);
      if (!r) return 0;
      const mine = ownedTiles(m, seat).sort((x, y) => investedValue(TILES[x], m.tiles[x].level) - investedValue(TILES[y], m.tiles[y].level))[0];
      const theirs = ownedTiles(m, r.seat).filter((i) => m.tiles[i].level <= (a.maxTier ?? 2)).sort(byRentDesc(m))[0];
      if (mine == null || theirs == null || rentFor(m, theirs) <= rentFor(m, mine)) return 0;
      m.tiles[mine].owner = r.seat;
      m.tiles[theirs].owner = seat;
      ops.ev({ t: 'swap', a: mine, b: theirs, seat, rival: r.seat });
      return 1;
    }
    case 'GRANT': {
      let n = 0;
      if (a.shields) { me.shields += a.shields; n++; }
      if (a.coupons) { me.coupons += a.coupons; n++; }
      if (a.revive && me.revive < (a.maxRevive ?? 1)) { me.revive = Math.min(a.maxRevive ?? 1, me.revive + a.revive); n++; }
      if (n) ops.ev({ t: 'grant', seat, shields: a.shields || 0, coupons: a.coupons || 0, revive: a.revive || 0 });
      return n;
    }
    case 'IF_UNDERDOG':
      return isUnderdog(m, seat) ? runActions(ctx, a.actions) : 0;
    case 'ROLL_TABLE': {
      const total = a.outcomes.reduce((s, o) => s + o.w, 0);
      let x = ops.rand() * total, pick = a.outcomes[a.outcomes.length - 1];
      for (const o of a.outcomes) { if ((x -= o.w) < 0) { pick = o; break; } }
      ops.ev({ t: 'roll_table', seat, id: pick.id, label: pick.label });
      const n = runActions(ctx, pick.actions);
      return n || runActions(ctx, pick.fallback || []);
    }
    case 'CHOICE': {
      if (ctx.autoChoice && a.options?.length) {
        const opt = a.options[0];
        ops.ev({ t: 'choice', seat, id: opt.id, label: opt.label, byPet: true });
        return runActions(ctx, opt.actions) || runActions(ctx, opt.fallback || []);
      }
      ops.setPending({ kind: 'choice', seat, skillId: ctx.skillId, options: a.options.map((o) => ({ id: o.id, label: o.label })) });
      return 1;
    }
    case 'WARP_PICK':
      if (ctx.isPetUlt) return 0;              // pets never open a tile picker (would clobber the owner's choice)
      ops.setPending({ kind: 'warp_any', seat, canSkip: false, options: TILES.map((t) => ({ id: t.i, label: t.name })) });
      m.turn.rolled = true;                   // Magic Carpet replaces this turn's roll
      return 1;
    default:
      return 0;
  }
}

/** Skill definition for a seated player (their outfit decides the ultimate). */
export function playerSkill(p) {
  const mythic = SEASON_SKILLS[p.outfit];
  if (mythic) return { id: p.outfit, ...mythic };
  const r = p.outfitRarity >= 2 ? 2 : 1;
  return { id: `generic_${r}`, ...GENERIC_SKILLS[r] };
}

/** Skill definition for a seated player's Soul-Linked Pet: its costume's ultimate, else the generic Lv1 skill
 *  (pets Soul-Link from bond Lv1 — Dopamine Patch §3). Null only when the seat has no pet at all. */
export function petSkill(p) {
  if (!p?.petCostume) return p?.petId ? { id: 'generic_1', ...GENERIC_SKILLS[1] } : null;
  const mythic = SEASON_SKILLS[p.petCostume];
  if (mythic) return { id: p.petCostume, ...mythic };
  const r = (p.petCostumeRarity || (p.petCostume?.startsWith('epic') ? 2 : 1)) >= 2 ? 2 : 1;
  return { id: `generic_${r}`, ...GENERIC_SKILLS[r] };
}

/** Executes the caster's ultimate (or Pet Soul-Link ultimate when `skill` is provided). Returns effects count. */
export function castUltimate(m, seat, ops, { scale = 1, skill: overrideSkill = null, autoChoice = false, isPetUlt = false } = {}) {
  const p = m.players[seat];
  const skill = overrideSkill || playerSkill(p);
  const ctx = { m, seat, ops, scale, skillId: skill.id, autoChoice, isPetUlt };
  const mono = skill.monopoly || {};
  const base = mono.baseCash ? runActions(ctx, [{ action: 'GAIN_CASH', amount: mono.baseCash }]) : 0;
  if (mono.requiresOwnedTile && !ownedTiles(m, seat).length) return base + runActions(ctx, mono.fallback || []);
  const n = runActions(ctx, mono.onUltimate || []);
  return base + (n || runActions(ctx, mono.fallback || []));
}

/** Resolves a CHOICE option picked by the caster. */
export function runChoice(m, seat, skillId, optionId, ops, { scale = 1 } = {}) {
  const skill = playerSkill(m.players[seat]);
  const block = (skill.monopoly?.onUltimate || []).find((a) => a.action === 'CHOICE');
  const opt = block?.options.find((o) => o.id === optionId);
  if (!opt) return 0;
  const ctx = { m, seat, ops, scale, skillId };
  ops.ev({ t: 'choice', seat, id: opt.id, label: opt.label });
  return runActions(ctx, opt.actions) || runActions(ctx, opt.fallback || []);
}

export { PROPERTY_IDX };
