// shared/monopoly_bots.js — Easy / Hard / Insane Sky Monopoly bots (Implementation Plan §21.E.1).
// Bots are pure decision functions over the public match state; the room applies the returned action
// through the same engine calls a human uses. Hard is also the "turn watchdog" autopilot for AFK/disconnected
// humans (§21.E.2). Bot randomness is hashed from (seed, turn, seat) so it never consumes the match RNG.
import { MONO, TILES, ZONE_TILES, wrap, rentFor, netWorth, ownedTiles, takeoverCost, ownsZone } from './monopoly_rules.js';
import { legalActions, buyCostFor, upgradeCostFor } from './monopoly_engine.js';
import { playerSkill, richestRival, rivalsOf } from './skill_engine.js';

export const BOT_DIFFS = ['easy', 'hard', 'insane'];

function botRand(m, seat, salt = 0) {
  let h = (m.seed ^ Math.imul((m.turn?.n || 0) + 1, 2654435761) ^ Math.imul(seat + 1 + salt, 40503)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Highest rent a rival could charge on the board right now (cash reserve heuristic). */
function maxRivalRent(m, seat) {
  let mx = 0;
  for (const p of rivalsOf(m, seat)) for (const i of ownedTiles(m, p.seat)) mx = Math.max(mx, rentFor(m, i));
  return mx;
}

/** Zone completion analysis for tile i from `seat`'s point of view. */
function zoneInfo(m, seat, i) {
  const zone = TILES[i].zone;
  if (!zone) return { completesMine: false, blocksRival: false };
  const tiles = ZONE_TILES[zone];
  const mine = tiles.filter((k) => m.tiles[k].owner === seat).length;
  const counts = {};
  for (const k of tiles) { const o = m.tiles[k].owner; if (o != null && o !== seat) counts[o] = (counts[o] || 0) + 1; }
  const rivalMax = Math.max(0, ...Object.values(counts));
  const ownerOfI = m.tiles[i].owner;
  return {
    completesMine: mine + (ownerOfI === seat ? 0 : 1) === tiles.length,
    blocksRival: rivalMax >= tiles.length - 1 && (ownerOfI == null || counts[ownerOfI] === rivalMax),
  };
}

/** Expected value of landing on tile i (for the Insane 1d6 vs ⚡2d6 decision). */
function landValue(m, seat, i) {
  const p = m.players[seat];
  const t = m.tiles[i], tile = TILES[i];
  if (t.modifier && t.modifier.owner !== seat) {
    if (t.modifier.burnSiphon) return -t.modifier.burnSiphon;
    if (t.modifier.prison) return -300;
  }
  switch (tile.kind) {
    case 'property':
      if (t.owner == null) return p.cash >= buyCostFor(m, seat, i) ? tile.price * 0.6 + (zoneInfo(m, seat, i).completesMine ? 400 : 0) : 0;
      if (t.owner === seat) return t.level < MONO.MAX_BUILD_TIER ? tile.price * 0.3 : 0;
      return -rentFor(m, i);
    case 'casino': return 580;
    case 'airdrop': return 250;
    case 'start': return MONO.SALARY;
    case 'vault': return 220;
    case 'warp': return 150;
    case 'arena': return 0;
    default: return 0;
  }
}

function expectedRoll(m, seat, use2d6) {
  const p = m.players[seat];
  const dir = p.status?.moveDir === -1 ? -1 : 1;
  const dist = use2d6 ? [[2, 1], [3, 2], [4, 3], [5, 4], [6, 5], [7, 6], [8, 5], [9, 4], [10, 3], [11, 2], [12, 1]] : [[1, 6], [2, 6], [3, 6], [4, 6], [5, 6], [6, 6]];
  const total = dist.reduce((s, [, w]) => s + w, 0);
  let ev = 0;
  for (const [steps, w] of dist) {
    let v = landValue(m, seat, wrap(p.pos + dir * steps));
    if (dir > 0 && p.pos + steps >= MONO.BOARD_N) v += MONO.SALARY;
    ev += (v * w) / total;
  }
  return ev;
}

function nearestUnowned(m, seat) {
  const p = m.players[seat];
  for (let d = 1; d <= 12; d++) {
    const i = wrap(p.pos + d);
    if (TILES[i].kind === 'property' && m.tiles[i].owner == null) return d;
  }
  return Infinity;
}

function wantsUlt(m, seat, diff) {
  const p = m.players[seat];
  const skill = playerSkill(p);
  if (skill.monopoly?.requiresOwnedTile && !ownedTiles(m, seat).length) return diff === 'easy' && botRand(m, seat, 7) < 0.5;
  if (diff === 'easy') return botRand(m, seat, 7) < 0.5;
  if (diff === 'hard') return rivalsOf(m, seat).length > 0;
  // insane: snipe the leader, or cash in before the clock runs out / when a rival is nearly broke
  const leader = richestRival(m, seat);
  if (!leader) return false;
  const lateGame = m.round >= m.maxRounds - 2;
  const nearlyBroke = rivalsOf(m, seat).some((q) => q.cash < 300);
  return lateGame || nearlyBroke || netWorth(m, leader.seat) >= netWorth(m, seat) * 0.9;
}

function decidePending(m, seat, pd, diff) {
  const p = m.players[seat];
  const reserve = Math.min(700, Math.max(150, maxRivalRent(m, seat)));
  switch (pd.kind) {
    case 'buy': {
      const cost = pd.cost;
      if (diff === 'easy') return p.cash > 1.5 * cost ? 'buy' : 'skip';
      if (diff === 'hard') return p.cash >= cost + 300 ? 'buy' : 'skip';
      const z = zoneInfo(m, seat, pd.tile);
      return (z.completesMine || z.blocksRival ? p.cash >= cost + 100 : p.cash >= cost + reserve) ? 'buy' : 'skip';
    }
    case 'upgrade': {
      if (pd.coupon) return 'upgrade';
      const cost = pd.cost;
      if (diff === 'easy') return p.cash > 2 * cost ? 'upgrade' : 'skip';
      if (diff === 'hard') return p.cash >= cost + 300 ? 'upgrade' : 'skip';
      const mono = ownsZone(m, TILES[pd.tile].zone, seat);
      return p.cash >= cost + (mono ? 150 : reserve) ? 'upgrade' : 'skip';
    }
    case 'takeover': {
      if (diff === 'easy') return 'skip';
      const z = zoneInfo(m, seat, pd.tile);
      if (diff === 'hard') return z.completesMine && p.cash >= pd.cost + 300 ? 'takeover' : 'skip';
      return (z.completesMine || z.blocksRival) && p.cash >= pd.cost + 200 ? 'takeover' : 'skip';
    }
    case 'vault': {
      const can = (id) => pd.options.some((o) => o.id === id && !o.disabled);
      if (diff === 'easy') return 'shield';
      if (diff === 'insane' && can('sabotage')) return 'sabotage';
      return 'steal';
    }
    case 'warp':
    case 'warp_any': {
      let best = null, bestV = diff === 'easy' ? Infinity : -Infinity;
      if (diff === 'easy') return pd.canSkip ? 'skip' : pd.options[0].id;
      for (const o of pd.options) {
        const i = Number(o.id);
        let v = landValue(m, seat, i);
        if (i === 0) v = MONO.SALARY;
        if (TILES[i].kind === 'property' && m.tiles[i].owner === seat) {
          const c = upgradeCostFor(m, seat, i);
          v = c != null && p.cash >= c + 300 ? TILES[i].price * 0.5 : -1;
        }
        if (v > bestV) { bestV = v; best = o.id; }
      }
      return best ?? (pd.canSkip ? 'skip' : pd.options[0].id);
    }
    case 'choice': {
      const ids = pd.options.map((o) => o.id);
      if (diff === 'easy') return ids[0];
      const mine = ownedTiles(m, seat);
      if (mine.length && ids.includes('swap')) {
        const r = richestRival(m, seat);
        const myCheapest = [...mine].sort((a, b) => rentFor(m, a) - rentFor(m, b))[0];
        const rivalBest = r ? ownedTiles(m, r.seat).filter((i) => m.tiles[i].level <= 3).sort((a, b) => rentFor(m, b) - rentFor(m, a))[0] : null;
        if (rivalBest != null && rentFor(m, rivalBest) > rentFor(m, myCheapest) * 1.25) return 'swap';
      }
      return mine.length && ids.includes('midas') ? 'midas' : ids.includes('carpet') ? 'carpet' : ids[0];
    }
    default:
      return pd.canSkip ? 'skip' : pd.options.find((o) => !o.disabled)?.id;
  }
}

/**
 * Next action for `seat` at difficulty `diff`. Returns
 *   { type: 'ultimate' } | { type: 'roll', use2d6 } | { type: 'decide', choice } | null (not this seat's move)
 */
export function botAction(m, seat, diff = 'hard') {
  const la = legalActions(m, seat);
  if (!la.myTurn) return null;
  if (la.pending) return { type: 'decide', choice: decidePending(m, seat, la.pending, diff) };
  if (!la.canRoll) return null;
  if (la.canUlt && wantsUlt(m, seat, diff)) return { type: 'ultimate' };
  let use2d6 = false;
  if (la.can2d6 && diff === 'hard') { const d = nearestUnowned(m, seat); use2d6 = d >= 6 && d <= 10; }
  if (la.can2d6 && diff === 'insane') use2d6 = expectedRoll(m, seat, true) > expectedRoll(m, seat, false) + 40;
  return { type: 'roll', use2d6 };
}

export { takeoverCost };
