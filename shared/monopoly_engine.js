// shared/monopoly_engine.js — authoritative, deterministic 2.5D Sky Monopoly match (Implementation Plan §5 Mode 1).
//
// Pure state machine: the server (or the in-browser solo host) owns one plain-JSON `match` object and calls
//   roll(m, seat, { use2d6 }) · decide(m, seat, { choice }) · ultimate(m, seat)
// Every call mutates state synchronously ("State First, Cutscene Second") and appends events to `m.events`;
// callers drain them with drainEvents(m) and broadcast/animate. Randomness comes from a seeded RNG stored in
// the match itself, so a match can be replayed, saved and resumed bit-for-bit.
//
// 4-phase turn pipeline: 1) pre-roll status (skip / fixed roll / reverse) → 2) primary move (modulo math)
// → 3) tile trigger (max 1 secondary hop) → 4) atomic turn end.
import {
  MONO, TILES, PROPERTY_IDX, wrap, matchMods, rentFor, netWorth, ownedTiles, bestTile, buyCost, upgradeCost,
  takeoverCost, canTakeover, investedValue, affinityFor, ownsZone,
} from './monopoly_rules.js';
import { castUltimate, runChoice, playerSkill, richestRival } from './skill_engine.js';

// ------------------------------------------------------------------------------------------- rng
function rand(m) {
  let a = (m.rng = (m.rng + 0x6d2b79f5) | 0);
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const d6 = (m) => 1 + Math.floor(rand(m) * 6);

function ev(m, e) { m.events.push({ seq: ++m.eventSeq, ...e }); }
export function drainEvents(m) { const out = m.events; m.events = []; return out; }

// ------------------------------------------------------------------------------------------- setup
/**
 * @param {object} o
 * @param {Array} o.players [{ id, name, isBot, botDiff, outfit, outfitRarity, affinity, diceSkin, diceBonus, petId, petFamily, petPct,
 *                            partnerId, lineage, equipped, stats:{fortune,swiftness,power,luck} }] — 2..4 seats
 * @param {number} o.seed
 */
export function createMatch({ players, seed = 1, maxRounds = MONO.MAX_ROUNDS, tableId = null } = {}) {
  if (!Array.isArray(players) || players.length < 2 || players.length > 4) throw new Error('2-4 players required');
  const m = {
    v: 1, tableId, seed: seed >>> 0, rng: (seed >>> 0) || 1, round: 1, maxRounds,
    phase: 'await_roll', turn: null, pending: null, ended: false, result: null,
    bankruptCount: 0, inUlt: false, eventSeq: 0, events: [],
    tiles: TILES.map(() => ({ owner: null, level: 0, modifier: null })),
    players: players.map((q, seat) => {
      const mods = q.mods || matchMods(q.stats || {}, { petFamily: q.petFamily, petPct: q.petPct || 0, diceBonus: q.diceBonus || null });
      return {
        seat, id: q.id, name: q.name || q.id, isBot: !!q.isBot, botDiff: q.botDiff || null,
        lineage: q.lineage || 'bkk', equipped: q.equipped || null,
        outfit: q.outfit || 'newbie_outfit', outfitRarity: q.outfitRarity || 1, affinity: q.affinity || affinityFor(q.outfit),
        diceSkin: q.diceSkin || q.equipped?.dice?.id || null,
        petId: q.petId || null, petFamily: q.petFamily || null, partnerId: q.partnerId || null,
        mods, cash: Math.round(MONO.START_CASH * (1 + mods.startCashPct)), pos: 0, boost: MONO.START_BOOST, ult: 0,
        status: null, shields: mods.startShields || 0, coupons: 0, revive: 0, bankrupt: false, bankruptOrder: 0,
        boardDiamonds: 0, lapDiamondsCount: 0, colorSetClaimed: false, arenaDiamondWins: 0,
      };
    }),
  };
  ev(m, { t: 'match_start', seats: m.players.length, seed: m.seed });
  beginTurn(m, 0);
  return m;
}

// ------------------------------------------------------------------------------------------- money
function gainUlt(p, base) {
  if (p.bankrupt) return;
  p.ult = Math.min(MONO.ULT_MAX, Math.round((p.ult + base * (1 + (p.mods.ultPct || 0))) * 10) / 10);
}

/** Sell the cheapest properties at 50% until `need` cash is available. */
function raiseFunds(m, seat, need) {
  const p = m.players[seat];
  const tiles = ownedTiles(m, seat).sort((a, b) => investedValue(TILES[a], m.tiles[a].level) - investedValue(TILES[b], m.tiles[b].level));
  for (const i of tiles) {
    if (p.cash >= need) break;
    const value = Math.round(investedValue(TILES[i], m.tiles[i].level) * MONO.LIQUIDATE_PCT);
    m.tiles[i] = { owner: null, level: 0, modifier: m.tiles[i].modifier?.owner === seat ? null : m.tiles[i].modifier };
    p.cash += value;
    ev(m, { t: 'liquidate', seat, tile: i, value });
  }
}

function goBankrupt(m, seat, creditor) {
  const p = m.players[seat];
  p.bankrupt = true;
  p.bankruptOrder = ++m.bankruptCount;
  p.cash = 0; p.status = null; p.shields = 0;
  for (const i of PROPERTY_IDX) if (m.tiles[i].owner === seat) m.tiles[i] = { owner: null, level: 0, modifier: null };
  for (const t of m.tiles) if (t.modifier?.owner === seat) t.modifier = null;
  ev(m, { t: 'bankrupt', seat, by: creditor, finisher: m.inUlt });
  if (m.players.filter((q) => !q.bankrupt).length <= 1) {
    endMatch(m, m.inUlt ? 'finisher' : 'last_standing', { by: m.inUlt ? m.turn.seat : null });
  }
}

/** from/to: seat index or null (bank). Returns the amount actually paid. */
function pay(m, from, to, amount, reason) {
  amount = Math.max(0, Math.round(amount));
  if (!amount || m.ended) return 0;
  let paid = amount;
  if (from != null) {
    const p = m.players[from];
    if (p.bankrupt) return 0;
    if (p.cash < amount) raiseFunds(m, from, amount);
    if (p.cash < amount) {
      paid = p.cash;
      p.cash = 0;
      if (to != null && !m.players[to].bankrupt) m.players[to].cash += paid;
      ev(m, { t: 'cash', from, to, amount: paid, reason, short: amount - paid });
      if (p.revive > 0) {
        p.revive--;
        p.cash = MONO.PHOENIX_REVIVE_CASH;
        ev(m, { t: 'revive', seat: from, cash: p.cash });
      } else goBankrupt(m, from, to);
      return paid;
    }
    p.cash -= amount;
  }
  if (to != null && !m.players[to].bankrupt) m.players[to].cash += paid;
  ev(m, { t: 'cash', from, to, amount: paid, reason });
  return paid;
}

const discountOf = (p) => 1 - (1 - (p.mods.discountPct || 0)) * (1 - (p.status?.discountPct || 0));
export const buyCostFor = (m, seat, i) => buyCost(TILES[i], { discountPct: discountOf(m.players[seat]) });
export const upgradeCostFor = (m, seat, i) => upgradeCost(TILES[i], m.tiles[i].level, { mods: { discountPct: discountOf(m.players[seat]) }, affinity: m.players[seat].affinity });

// ------------------------------------------------------------------------------------------- movement
function passStart(m, seat) {
  const p = m.players[seat];
  const amount = Math.round(MONO.SALARY * (1 + (p.mods.salaryPct || 0)));
  const thief = m.players.find((q) => !q.bankrupt && q.seat !== seat && q.status?.lapTax);
  const cut = thief ? Math.round(amount * thief.status.lapTax) : 0;
  pay(m, null, seat, amount - cut, 'salary');
  if (cut) pay(m, null, thief.seat, cut, 'heist');
  p.boost += 1;
  gainUlt(p, MONO.ULT_START);
  let diamonds = 0;
  if ((p.lapDiamondsCount || 0) < MONO.MAX_START_DIAMOND_LAPS) {
    p.lapDiamondsCount = (p.lapDiamondsCount || 0) + 1;
    diamonds = MONO.START_DIAMONDS;
    p.boardDiamonds = (p.boardDiamonds || 0) + diamonds;
  }
  ev(m, { t: 'salary', seat, amount: amount - cut, diamonds, heist: cut ? { seat: thief.seat, amount: cut } : null });
}

function walk(m, seat, steps, dir, kind) {
  const p = m.players[seat];
  const path = [];
  let passes = 0;
  for (let s = 0; s < steps; s++) {
    p.pos = wrap(p.pos + dir);
    path.push(p.pos);
    if (dir > 0 && p.pos === 0) passes++;
  }
  ev(m, { t: 'move', seat, path, kind, dir });
  for (let k = 0; k < passes; k++) passStart(m, seat);
}

function forcedLand(m, seat, i, path, kind) {
  const p = m.players[seat];
  if (p.bankrupt) return;
  p.pos = i;
  ev(m, { t: 'move', seat, path, kind, dir: 0 });
  const t = m.tiles[i];
  if (TILES[i].kind === 'property' && t.owner != null && t.owner !== seat) payRent(m, seat, i);
}

function payRent(m, seat, i) {
  const p = m.players[seat], t = m.tiles[i];
  const owner = t.owner;
  const amount = rentFor(m, i);
  if (t.modifier?.reverseTrap && t.modifier.owner === seat) {
    ev(m, { t: 'rent', payer: owner, owner: seat, tile: i, amount, reversed: true });
    if (amount) pay(m, owner, seat, amount, 'mirror');
    return;
  }
  if (!amount) { ev(m, { t: 'rent', payer: seat, owner, tile: i, amount: 0, frozen: true }); return; }
  if (p.shields > 0) {
    p.shields--;
    ev(m, { t: 'rent', payer: seat, owner, tile: i, amount, shielded: true });
    return;
  }
  ev(m, { t: 'rent', payer: seat, owner, tile: i, amount });
  pay(m, seat, owner, amount, 'rent');
  gainUlt(p, MONO.ULT_ON_RENT_PAID);
}

// ------------------------------------------------------------------------------------------- tile trigger
function land(m, seat, i, { allowHop, via }) {
  const p = m.players[seat];
  if (p.bankrupt || m.ended) return;
  ev(m, { t: 'land', seat, tile: i, via });
  const t = m.tiles[i];
  const mod = t.modifier;
  if (mod && mod.owner !== seat && !m.players[mod.owner]?.bankrupt) {
    const consume = () => { if (mod.oneShot) { t.modifier = null; ev(m, { t: 'modifier', tile: i, modifier: null, consumed: true }); } };
    if (mod.burnSiphon) {
      ev(m, { t: 'trap', seat, tile: i, kind: 'burn', owner: mod.owner, amount: mod.burnSiphon });
      pay(m, seat, mod.owner, mod.burnSiphon, 'burn');
      if (p.bankrupt || m.ended) return;
    }
    if (mod.prison) {
      p.status = { id: mod.id, owner: mod.owner, skipTurn: true, turnsLeft: 1, fxTheme: mod.fxTheme || 'prison' };
      ev(m, { t: 'trap', seat, tile: i, kind: 'prison', owner: mod.owner });
      consume();
    }
    if (allowHop && mod.pushSteps) {
      ev(m, { t: 'trap', seat, tile: i, kind: 'push', owner: mod.owner, steps: mod.pushSteps });
      walk(m, seat, mod.pushSteps, 1, 'push');
      return land(m, seat, p.pos, { allowHop: false, via: 'push' });
    }
    if (allowHop && mod.warpToOwnerBest) {
      const dest = bestTile(m, mod.owner);
      if (dest != null) {
        ev(m, { t: 'trap', seat, tile: i, kind: 'warp', owner: mod.owner, to: dest });
        consume();
        p.pos = dest;
        ev(m, { t: 'move', seat, path: [dest], kind: 'warp', dir: 0 });
        return land(m, seat, dest, { allowHop: false, via: 'warp' });
      }
    }
  }

  const tile = TILES[i];
  switch (tile.kind) {
    case 'start':
      if (via === 'warp') passStart(m, seat);
      return;
    case 'property': {
      if (t.owner == null) {
        const cost = buyCostFor(m, seat, i);
        if (p.cash >= cost) m.pending = { kind: 'buy', seat, tile: i, cost, canSkip: true, options: [{ id: 'buy', label: `Buy ${tile.name}` }] };
        return;
      }
      if (t.owner === seat) {
        if (t.level >= MONO.MAX_BUILD_TIER) return;
        const cost = upgradeCostFor(m, seat, i);
        const coupon = p.coupons > 0;
        if (coupon || p.cash >= cost) m.pending = { kind: 'upgrade', seat, tile: i, cost: coupon ? 0 : cost, coupon, toLevel: t.level + 1, canSkip: true, options: [{ id: 'upgrade', label: 'Upgrade' }] };
        return;
      }
      const owner = t.owner;
      payRent(m, seat, i);
      if (p.bankrupt || m.ended) return;
      if (m.tiles[i].owner === owner && canTakeover(m.tiles[i].level)) {
        const cost = takeoverCost(tile, m.tiles[i].level);
        if (p.cash >= cost) m.pending = { kind: 'takeover', seat, tile: i, cost, from: owner, canSkip: true, options: [{ id: 'takeover', label: 'Hostile Takeover' }] };
      }
      return;
    }
    case 'airdrop': {
      gainUlt(p, MONO.ULT_AIRDROP);
      const r = rand(m);
      const supply = r < 1 / 3 ? 'cash' : r < 2 / 3 ? 'shield' : 'coupon';
      if (supply === 'cash') pay(m, null, seat, MONO.AIRDROP_CASH, 'airdrop');
      else if (supply === 'shield') p.shields++;
      else p.coupons++;
      ev(m, { t: 'event_tile', seat, tile: i, kind: 'airdrop', supply, ult: MONO.ULT_AIRDROP });
      return;
    }
    case 'casino': {
      let r = rand(m), slot = MONO.CASINO_WHEEL[MONO.CASINO_WHEEL.length - 1];
      for (const s of MONO.CASINO_WHEEL) { if ((r -= s.p) < 0) { slot = s; break; } }
      const diamonds = slot.diamonds || 0;
      if (diamonds) p.boardDiamonds = (p.boardDiamonds || 0) + diamonds;
      ev(m, { t: 'event_tile', seat, tile: i, kind: 'casino', cash: slot.cash, diamonds, jackpot: !!slot.jackpot });
      pay(m, null, seat, slot.cash, 'casino');
      return;
    }
    case 'vault': {
      const target = sabotageTarget(m, seat);
      m.pending = {
        kind: 'vault', seat, tile: i, canSkip: false, options: [
          { id: 'sabotage', label: '💣 Tile Sabotage (−1 Lv)', disabled: target == null },
          { id: 'shield', label: '🛡️ Barrier Shield' },
          { id: 'steal', label: `🧲 Steal ${MONO.VAULT_STEAL} 🪙 from Richest Rival` },
        ],
      };
      return;
    }
    case 'warp': {
      const options = [{ id: 0, label: 'START' }, ...ownedTiles(m, seat).map((k) => ({ id: k, label: TILES[k].name }))];
      m.pending = { kind: 'warp', seat, tile: i, canSkip: true, options };
      return;
    }
    case 'arena': {
      const rival = richestRival(m, seat);
      if (!rival) return;
      const rolls = [];
      let winner = null;
      for (let k = 0; k < 3 && winner == null; k++) {
        const a = d6(m), b = d6(m);
        rolls.push([a, b]);
        if (a !== b) winner = a > b ? seat : rival.seat;
      }
      const loser = winner == null ? null : winner === seat ? rival.seat : seat;
      const amount = loser == null ? 0 : Math.round(m.players[loser].cash * MONO.ARENA_STEAL_PCT);
      let diamonds = 0;
      if (winner != null) {
        const wPlayer = m.players[winner];
        if ((wPlayer.arenaDiamondWins || 0) < MONO.MAX_ARENA_DIAMOND_WINS) {
          wPlayer.arenaDiamondWins = (wPlayer.arenaDiamondWins || 0) + 1;
          diamonds = MONO.ARENA_WIN_DIAMONDS;
          wPlayer.boardDiamonds = (wPlayer.boardDiamonds || 0) + diamonds;
        }
      }
      ev(m, { t: 'duel', seat, rival: rival.seat, rolls, winner, amount, diamonds });
      if (amount) pay(m, loser, winner, amount, 'duel');
      return;
    }
    default:
  }
}

function sabotageTarget(m, seat) {
  const r = richestRival(m, seat);
  if (!r) return null;
  return bestTile(m, r.seat, (k) => m.tiles[k].level >= 1 && m.tiles[k].level < 4);
}

// ------------------------------------------------------------------------------------------- turn flow
function beginTurn(m, seat) {
  m.turn = { seat, rolled: false, ultUsed: false, n: (m.turn?.n || 0) + 1 };
  m.phase = 'await_roll';
  m.pending = null;
  ev(m, { t: 'turn', seat, round: m.round });
  const p = m.players[seat];
  if (p.status?.skipTurn) {
    ev(m, { t: 'skip', seat, status: p.status });
    p.status = null;
    m.turn.rolled = true;
    endTurn(m);
  }
}

function nextAliveSeat(m, from) {
  const n = m.players.length;
  for (let k = 1; k <= n; k++) {
    const s = (from + k) % n;
    if (!m.players[s].bankrupt) return s;
  }
  return from;
}

function tickModifiers(m) {
  m.tiles.forEach((t, i) => {
    if (!t.modifier) return;
    t.modifier.turnsLeft = (t.modifier.turnsLeft ?? 1) - 1;
    if (t.modifier.turnsLeft <= 0) { t.modifier = null; ev(m, { t: 'modifier', tile: i, modifier: null, expired: true }); }
  });
}

function endTurn(m) {
  if (m.ended) return;
  const cur = m.turn.seat;
  const p = m.players[cur];
  if (!p.bankrupt) {
    gainUlt(p, MONO.ULT_PER_TURN);
    if (p.status) {
      if (p.status.fresh) p.status.fresh = false;
      else if ((p.status.turnsLeft = (p.status.turnsLeft ?? 1) - 1) <= 0) p.status = null;
    }
  }
  m.pending = null;
  const next = nextAliveSeat(m, cur);
  if (next <= cur) {
    m.round++;
    tickModifiers(m);
    if (m.round > m.maxRounds) { m.round = m.maxRounds; return endMatch(m, 'rounds'); }
  }
  beginTurn(m, next);
}

function afterAction(m) {
  if (m.ended) return;
  const p = m.players[m.turn.seat];
  if (p.bankrupt) { m.pending = null; return endTurn(m); }
  if (m.pending) { m.phase = 'await_decision'; return; }
  if (m.turn.rolled) return endTurn(m);
  m.phase = 'await_roll';
}

export function ranking(m, finisherSeat = null) {
  const aliveP = m.players.filter((p) => !p.bankrupt)
    .sort((a, b) => (b.seat === finisherSeat) - (a.seat === finisherSeat) || netWorth(m, b.seat) - netWorth(m, a.seat) || b.cash - a.cash || a.seat - b.seat);
  const dead = m.players.filter((p) => p.bankrupt).sort((a, b) => b.bankruptOrder - a.bankruptOrder);
  return [...aliveP, ...dead].map((p, k) => ({
    seat: p.seat, id: p.id, name: p.name, rank: k + 1, netWorth: netWorth(m, p.seat), cash: p.cash, bankrupt: p.bankrupt,
    boardDiamonds: p.boardDiamonds || 0,
  }));
}

function endMatch(m, reason, { by = null } = {}) {
  if (m.ended) return;
  m.ended = true;
  m.phase = 'ended';
  m.pending = null;
  const rank = ranking(m, reason === 'finisher' ? by : null);
  m.result = { reason, by, winner: rank[0].seat, ranking: rank, rounds: m.round };
  ev(m, { t: 'end', reason, by, winner: rank[0].seat, ranking: rank });
}

function checkColorMonopolyBonus(m, seat, zone) {
  const p = m.players[seat];
  if (!p || p.colorSetClaimed || !zone || !ownsZone(m, zone, seat)) return;
  p.colorSetClaimed = true;
  p.boardDiamonds = (p.boardDiamonds || 0) + MONO.COLOR_SET_DIAMONDS;
  ev(m, { t: 'color_monopoly', seat, zone, diamonds: MONO.COLOR_SET_DIAMONDS });
}

// ------------------------------------------------------------------------------------------- public actions
const fail = (error) => ({ ok: false, error });
const ops = (m) => ({
  pay: (f, t, a, r) => pay(m, f, t, a, r),
  forcedLand: (s, i, path, kind) => forcedLand(m, s, i, path, kind),
  setPending: (pd) => { m.pending = { canSkip: false, ...pd }; },
  ev: (e) => ev(m, e),
  rand: () => rand(m),
});

export function legalActions(m, seat) {
  const p = m.players[seat];
  const myTurn = !m.ended && m.turn?.seat === seat && p && !p.bankrupt;
  const canRoll = myTurn && m.phase === 'await_roll';
  return {
    myTurn,
    canRoll,
    can2d6: canRoll && p.boost > 0 && !p.status?.fixedRoll,
    canUlt: canRoll && !m.turn.ultUsed && p.ult >= MONO.ULT_MAX,
    pending: myTurn && m.pending?.seat === seat ? m.pending : null,
  };
}

export function roll(m, seat, { use2d6 = false } = {}) {
  if (m.ended) return fail('match_over');
  if (m.turn.seat !== seat) return fail('not_your_turn');
  if (m.phase !== 'await_roll') return fail('bad_phase');
  const p = m.players[seat];
  const fixed = p.status?.fixedRoll || 0;
  const dir = p.status?.moveDir === -1 ? -1 : 1;
  let dice;
  let boosted = false;
  if (fixed) dice = [fixed];
  else if (use2d6 && p.boost > 0) { p.boost--; boosted = true; dice = [d6(m), d6(m)]; }
  else dice = [d6(m)];
  const steps = dice.reduce((s, d) => s + d, 0);
  m.turn.rolled = true;
  ev(m, { t: 'dice', seat, dice, steps, dir, fixed: !!fixed, boosted, diceSkin: p.diceSkin || null });
  walk(m, seat, steps, dir, 'walk');
  land(m, seat, p.pos, { allowHop: true, via: 'walk' });
  afterAction(m);
  return { ok: true, dice, steps };
}

export function ultimate(m, seat) {
  const la = legalActions(m, seat);
  if (!la.myTurn) return fail('not_your_turn');
  if (!la.canUlt) return fail('ult_not_ready');
  const p = m.players[seat];
  p.ult = 0;
  m.turn.ultUsed = true;
  const partner = p.partnerId ? m.players.find((q) => q.id === p.partnerId && !q.bankrupt) : null;
  const scale = partner ? 1 + MONO.COUPLE_SYNERGY : 1;
  const skill = playerSkill(p);
  ev(m, { t: 'ult', seat, skillId: skill.id, name: skill.name, icon: skill.icon, vfx: skill.vfx, fxTheme: skill.fxTheme, couple: !!partner, partnerSeat: partner?.seat ?? null });
  const before = m.bankruptCount;
  m.ultScale = scale;
  m.inUlt = true;
  castUltimate(m, seat, ops(m), { scale });
  m.inUlt = false;
  if (!m.ended && m.bankruptCount > before) endMatch(m, 'finisher', { by: seat });
  afterAction(m);
  return { ok: true, skillId: skill.id };
}

export function decide(m, seat, { choice } = {}) {
  if (m.ended) return fail('match_over');
  const pd = m.pending;
  if (!pd || pd.seat !== seat || m.turn.seat !== seat) return fail('no_pending');
  const skip = choice === 'skip' || choice == null;
  const opt = skip ? null : pd.options.find((o) => String(o.id) === String(choice));
  if (skip && !pd.canSkip) return fail('must_choose');
  if (!skip && (!opt || opt.disabled)) return fail('bad_choice');
  const p = m.players[seat];
  m.pending = null;
  m.phase = 'resolving';
  const T = TILES[pd.tile];
  if (!skip) {
    switch (pd.kind) {
      case 'buy': {
        const cost = buyCostFor(m, seat, pd.tile);
        if (m.tiles[pd.tile].owner != null || p.cash < cost) break;
        pay(m, seat, null, cost, 'buy');
        m.tiles[pd.tile].owner = seat;
        ev(m, { t: 'buy', seat, tile: pd.tile, cost });
        checkColorMonopolyBonus(m, seat, T.zone);
        break;
      }
      case 'upgrade': {
        const t = m.tiles[pd.tile];
        if (t.owner !== seat || t.level >= MONO.MAX_BUILD_TIER) break;
        let cost = upgradeCostFor(m, seat, pd.tile);
        if (p.coupons > 0) { p.coupons--; cost = 0; }
        if (p.cash < cost) break;
        if (cost) pay(m, seat, null, cost, 'upgrade');
        t.level++;
        ev(m, { t: 'upgrade', seat, tile: pd.tile, level: t.level, cost });
        break;
      }
      case 'takeover': {
        const t = m.tiles[pd.tile];
        const cost = takeoverCost(T, t.level);
        if (t.owner == null || t.owner === seat || !canTakeover(t.level) || p.cash < cost) break;
        const from = t.owner;
        pay(m, seat, from, cost, 'takeover');
        t.owner = seat;
        ev(m, { t: 'takeover', seat, from, tile: pd.tile, cost });
        checkColorMonopolyBonus(m, seat, T.zone);
        break;
      }
      case 'vault': {
        ev(m, { t: 'event_tile', seat, tile: pd.tile, kind: 'vault', pick: opt.id });
        if (opt.id === 'shield') { p.shields++; ev(m, { t: 'grant', seat, shields: 1 }); }
        else if (opt.id === 'steal') { const r = richestRival(m, seat); if (r) pay(m, r.seat, seat, MONO.VAULT_STEAL, 'steal'); }
        else if (opt.id === 'sabotage') {
          const k = sabotageTarget(m, seat);
          if (k != null) { const from = m.tiles[k].level; m.tiles[k].level--; ev(m, { t: 'tier', tile: k, level: m.tiles[k].level, from, by: seat, sabotage: true }); }
        }
        break;
      }
      case 'warp':
      case 'warp_any': {
        const dest = Number(opt.id);
        p.pos = dest;
        ev(m, { t: 'move', seat, path: [dest], kind: 'warp', dir: 0 });
        land(m, seat, dest, { allowHop: false, via: 'warp' });
        break;
      }
      case 'choice': {
        const before = m.bankruptCount;
        m.inUlt = true;
        runChoice(m, seat, pd.skillId, opt.id, ops(m), { scale: m.ultScale || 1 });
        m.inUlt = false;
        if (!m.ended && m.bankruptCount > before) endMatch(m, 'finisher', { by: seat });
        break;
      }
      default:
    }
  }
  afterAction(m);
  return { ok: true };
}

/** Compact public snapshot for HUD cards (cash + 👑 net worth + ult %), Screen 10. */
export function scoreboard(m) {
  return m.players.map((p) => ({
    seat: p.seat, id: p.id, name: p.name, cash: p.cash, netWorth: netWorth(m, p.seat), ult: p.ult, boost: p.boost,
    bankrupt: p.bankrupt, pos: p.pos, boardDiamonds: p.boardDiamonds || 0, diceSkin: p.diceSkin || null,
  }));
}

export { rand as _rand };
