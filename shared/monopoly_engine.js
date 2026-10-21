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
  MONO, CHAOS, TILES, ZONES, ZONE_TILES, PROPERTY_IDX, wrap, stepsBetween, matchMods, rentFor, netWorth, ownedTiles, bestTile, buyCost, upgradeCost,
  takeoverCost, canTakeover, investedValue, affinityFor, ownsZone, petMatchStats,
} from './monopoly_rules.js';
import { castUltimate, runChoice, playerSkill, petSkill, richestRival } from './skill_engine.js';

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
 *                            petCostume, petCostumeRarity, petBond, petAuto, partnerId, lineage, equipped, stats:{fortune,swiftness,power,luck} }] — 2..4 seats
 * @param {number} o.seed
 * @param {'normal'|'chaos'} [o.mode]   🎉 Chaos Party = 10 rounds, max pets, ×2 ult gain, a Chaos Event every round
 * @param {boolean} [o.publicTable]     non-couple/friend multiplayer table → pet potency squeezed toward 0.5
 */
export function createMatch({ players, seed = 1, maxRounds = MONO.MAX_ROUNDS, tableId = null, mode = 'normal', publicTable = false } = {}) {
  if (!Array.isArray(players) || players.length < 2 || players.length > 4) throw new Error('2-4 players required');
  const chaos = mode === 'chaos';
  const m = {
    v: 2, tableId, seed: seed >>> 0, rng: (seed >>> 0) || 1, round: 1, maxRounds: chaos ? CHAOS.MAX_ROUNDS : maxRounds,
    mode: chaos ? 'chaos' : 'normal', chaos, publicTable: !!publicTable && !chaos, ultSeen: {},
    phase: 'await_roll', turn: null, pending: null, ended: false, result: null,
    bankruptCount: 0, inUlt: false, eventSeq: 0, events: [],
    highlights: {
      bigRent: null,
      bigTakeover: null,
      ults: Array(players.length).fill(0),
      rentEarned: Array(players.length).fill(0),
      dodges: Array(players.length).fill(0),
    },
    tiles: TILES.map(() => ({ owner: null, level: 0, modifier: null })),
    players: players.map((q, seat) => {
      const mods = q.mods || matchMods(q.stats || {}, { petFamily: q.petFamily, petPct: q.petPct || 0, diceBonus: q.diceBonus || null });
      const petCostume = q.petCostume || q.equipped?.pet?.costume_id || null;
      const petCostumeRarity = q.petCostumeRarity || (petCostume?.startsWith('s') ? 3 : petCostume?.startsWith('epic') ? 2 : 1);
      const petId = q.petId || q.pet || q.equipped?.pet?.id || null;
      const hasPet = !!(petId || petCostume);
      const petBond = Math.max(1, Number(q.petBond ?? q.petBondLv ?? q.equipped?.pet?.bond_lv) || 1);
      const petForStats = Array.isArray(q.petSlots)
        ? { stars: q.petStars || 2, bond_lv: petBond, slots: q.petSlots }
        : (Array.isArray(q.equipped?.pet?.slots) ? q.equipped.pet : null);
      const ps = petMatchStats({ bond: petBond, chaos, publicTable: !!publicTable, pet: petForStats });
      return {
        seat, id: q.id, name: q.name || q.id, isBot: !!q.isBot, botDiff: q.botDiff || null,
        lineage: q.lineage || 'bkk', equipped: q.equipped || null,
        outfit: q.outfit || 'newbie_outfit', outfitRarity: q.outfitRarity || 1, affinity: q.affinity || affinityFor(q.outfit),
        diceSkin: q.diceSkin || q.equipped?.dice?.id || null,
        petId, petFamily: q.petFamily || null,
        petCostume, petCostumeRarity,
        // 🐾 Soul-Link: bond-scaled gauge, Auto/Manual + arm state, per-match cast cap (null = unlimited)
        hasPet, petBond, petRate: hasPet ? ps.rate : 0, petPotency: hasPet ? ps.potency : 0, petUlt: hasPet ? ps.start : 0,
        petAuto: q.petAuto !== false, petArmed: false, petHeld: 0, petCasts: 0, petCombos: 0,
        petCap: chaos ? null : MONO.PET_MAX_CASTS, ultGain: chaos ? CHAOS.ULT_GAIN : 1,
        partnerId: q.partnerId || null,
        mods, cash: Math.round(MONO.START_CASH * (1 + mods.startCashPct)) + seat * (chaos ? CHAOS.SEAT_COMP_CASH : MONO.SEAT_COMP_CASH), pos: 0, boost: MONO.START_BOOST, ult: 0,
        status: null, shields: mods.startShields || 0, coupons: 0, revive: 0, bankrupt: false, bankruptOrder: 0,
        boardDiamonds: 0, lapDiamondsCount: 0, colorSetClaimed: false, arenaDiamondWins: 0,
      };
    }),
  };
  ev(m, { t: 'match_start', seats: m.players.length, seed: m.seed, mode: m.mode, maxRounds: m.maxRounds });
  if (m.chaos) chaosEvent(m);
  beginTurn(m, 0);
  return m;
}

// ------------------------------------------------------------------------------------------- money
const petCapped = (p) => p.petCap != null && (p.petCasts || 0) >= p.petCap;
const petFull = (p) => !!p.hasPet && !petCapped(p) && (p.petUlt || 0) >= MONO.ULT_MAX;

function gainUlt(p, base, m = null) {
  if (p.bankrupt) return;
  const phaseMult = (!m || m.chaos)
    ? 1
    : m.round >= MONO.OVERDRIVE_ROUND
      ? MONO.OVERDRIVE_ULT_MULT
      : m.round >= MONO.MID_ROUND
        ? MONO.MID_ULT_MULT
        : 1;
  const mult = (1 + (p.mods.ultPct || 0)) * (p.ultGain || 1) * phaseMult;
  p.ult = Math.min(MONO.ULT_MAX, Math.round((p.ult + base * mult) * 10) / 10);
  if (p.hasPet && !petCapped(p)) {
    // overflow past 100% is banked (up to PET_BANK_MAX) and carried into the next fill — charge is never wasted
    const raw = Math.round(((p.petUlt || 0) + base * (p.petRate ?? MONO.PET_ULT_RATE) * mult) * 10) / 10;
    if (raw > MONO.ULT_MAX) p.petBank = Math.min(MONO.PET_BANK_MAX, Math.round(((p.petBank || 0) + raw - MONO.ULT_MAX) * 10) / 10);
    p.petUlt = Math.min(MONO.ULT_MAX, raw);
  }
}

/** Auto-upgrade the cheapest buildable (< Tier 3) property owned by `seat` for free. Returns tile index or null. */
function freeUpgradeCheapest(m, seat, reason = 'bonus') {
  const candidates = ownedTiles(m, seat)
    .filter((k) => m.tiles[k].level < MONO.MAX_BUILD_TIER)
    .sort((a, b) => m.tiles[a].level - m.tiles[b].level || investedValue(TILES[a], m.tiles[a].level) - investedValue(TILES[b], m.tiles[b].level));
  if (!candidates.length) return null;
  const i = candidates[0];
  m.tiles[i].level++;
  ev(m, { t: 'upgrade', seat, tile: i, level: m.tiles[i].level, cost: 0, [reason]: true });
  return i;
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
  const killerSeat = creditor ?? (m.inUlt ? m.turn?.seat : null);
  if (killerSeat != null && killerSeat !== seat && !m.players[killerSeat]?.bankrupt) {
    const killer = m.players[killerSeat];
    killer.kills = (killer.kills || 0) + 1;
    killer.cash += MONO.KILL_BOUNTY_CASH;
    gainUlt(killer, MONO.KILL_BOUNTY_ULT, m);
    const upgradedTile = freeUpgradeCheapest(m, killerSeat, 'bountyUpgrade');
    ev(m, { t: 'bounty', seat: killerSeat, victim: seat, cash: MONO.KILL_BOUNTY_CASH, ult: MONO.KILL_BOUNTY_ULT, upgradedTile });
  }
  if (m.players.filter((q) => !q.bankrupt).length <= 1) {
    endMatch(m, m.inUlt ? 'finisher' : 'last_standing', { by: m.inUlt ? m.turn.seat : killerSeat });
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
  const baseSalary = (!m.chaos && m.round >= MONO.MID_ROUND) ? MONO.MID_SALARY : MONO.SALARY;
  let amount = Math.round(baseSalary * (1 + (p.mods.salaryPct || 0)));
  let underdog = false;
  let bonus = 0;
  const alive = m.players.filter((q) => !q.bankrupt);
  if (!p.bankrupt && alive.length > 1) {
    const myNw = netWorth(m, seat);
    const isStrictlyLast = alive.every((q) => q.seat === seat || netWorth(m, q.seat) > myNw);
    const leaderNw = Math.max(...alive.map((q) => netWorth(m, q.seat)));
    if (isStrictlyLast && myNw < MONO.UNDERDOG_GAP * leaderNw) {
      underdog = true;
      const boosted = Math.round(amount * (1 + MONO.UNDERDOG_SALARY_BONUS));
      bonus = boosted - amount;
      amount = boosted;
    }
  }
  const thief = m.players.find((q) => !q.bankrupt && q.seat !== seat && q.status?.lapTax);
  const cut = thief ? Math.round(amount * thief.status.lapTax) : 0;
  pay(m, null, seat, amount - cut, 'salary');
  if (cut) pay(m, null, thief.seat, cut, 'heist');
  p.boost += 1;
  gainUlt(p, MONO.ULT_START, m);
  let diamonds = 0;
  if ((p.lapDiamondsCount || 0) < MONO.MAX_START_DIAMOND_LAPS) {
    p.lapDiamondsCount = (p.lapDiamondsCount || 0) + 1;
    diamonds = MONO.START_DIAMONDS;
    p.boardDiamonds = (p.boardDiamonds || 0) + diamonds;
  }
  const lapUpgradedTile = (!m.chaos && m.round >= MONO.LAP_AUTO_UPGRADE_ROUND)
    ? freeUpgradeCheapest(m, seat, 'lapBonus')
    : null;
  ev(m, {
    t: 'salary',
    seat,
    amount: amount - cut,
    diamonds,
    heist: cut ? { seat: thief.seat, amount: cut } : null,
    ...(lapUpgradedTile != null ? { lapUpgradedTile } : {}),
    ...(underdog ? { underdog: true, bonus } : {}),
  });
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
  if (t.modifier?.reverseTrap && !m.players[t.modifier.owner]?.bankrupt) {
    const mirrorOwner = t.modifier.owner;
    ev(m, { t: 'rent', payer: owner, owner: mirrorOwner, tile: i, amount, reversed: true });
    if (amount && owner !== mirrorOwner) pay(m, owner, mirrorOwner, amount, 'mirror');
    return 0;
  }
  if (!amount) { ev(m, { t: 'rent', payer: seat, owner, tile: i, amount: 0, frozen: true }); return 0; }
  if (p.shields > 0) {
    p.shields--;
    ev(m, { t: 'rent', payer: seat, owner, tile: i, amount, shielded: true });
    return 0;
  }
  ev(m, { t: 'rent', payer: seat, owner, tile: i, amount });
  const paid = pay(m, seat, owner, amount, 'rent');
  if (t.modifier?.grantOwnerCoupon && !m.players[owner]?.bankrupt) {
    m.players[owner].coupons = (m.players[owner].coupons || 0) + 1;
    ev(m, { t: 'grant', seat: owner, coupons: 1, tile: i });
  }
  gainUlt(p, MONO.ULT_ON_RENT_PAID, m);
  if (m.highlights && paid > 0) {
    m.highlights.rentEarned[owner] = (m.highlights.rentEarned[owner] || 0) + paid;
    if (!m.highlights.bigRent || paid > m.highlights.bigRent.amount) {
      m.highlights.bigRent = { seat, owner, amount: paid, tile: i };
    }
  }
  return amount;
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
      if (mod.stealCoupon && p.coupons > 0 && !m.players[mod.owner]?.bankrupt) {
        p.coupons--;
        m.players[mod.owner].coupons = (m.players[mod.owner].coupons || 0) + 1;
        ev(m, { t: 'grant', seat: mod.owner, coupons: 1, from: seat, tile: i });
      }
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
    if (allowHop && mod.pullTowardOwnerBest) {
      const dest = bestTile(m, mod.owner);
      if (dest != null && dest !== p.pos) {
        const d = stepsBetween(p.pos, dest);
        if (d !== 0) {
          const stepDir = Math.sign(d);
          const steps = Math.min(mod.pullTowardOwnerBest, Math.abs(d));
          ev(m, { t: 'trap', seat, tile: i, kind: 'push', owner: mod.owner, steps: stepDir * steps });
          walk(m, seat, steps, stepDir, 'push');
          return land(m, seat, p.pos, { allowHop: false, via: 'push' });
        }
      }
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
      const rentPaid = payRent(m, seat, i);
      if (p.bankrupt || m.ended) return;
      if (allowHop && m.tiles[i].owner === owner && canTakeover(m.tiles[i].level)) {
        const cost = takeoverCost(tile, m.tiles[i].level);
        if (p.cash >= cost) m.pending = { kind: 'takeover', seat, tile: i, cost, from: owner, rentPaid, canSkip: true, options: [{ id: 'takeover', label: 'Hostile Takeover' }] };
      }
      return;
    }
    case 'airdrop': {
      gainUlt(p, MONO.ULT_AIRDROP, m);
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
  // 🐾 The pet never casts at turn start any more — it waits for its owner (Soul-Link Combo). Count the owner's
  // turns that start with BOTH gauges full (a combo was on the table but not taken) so Auto can release it.
  if (petFull(p) && p.ult >= MONO.ULT_MAX) p.petHeld = (p.petHeld || 0) + 1;
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

/** Auto (or AFK / bot / autopilot) behaviour applies to this seat right now. */
const petAutoOn = (m, p) => !!(p.petAuto || p.isBot || (m.turn?.seat === p.seat && m.turn?.autopilot));

function endTurn(m) {
  if (m.ended) return;
  const cur = m.turn.seat;
  const p = m.players[cur];
  if (!p.bankrupt) gainUlt(p, MONO.ULT_PER_TURN, m);
  // 🐾 Auto: full for PET_HOLD_TURNS of your turns with no combo → solo-cast; also on your last turn of the
  // match, so the charge is never wasted.
  const lastTurn = m.round >= m.maxRounds;
  if (!p.bankrupt && petFull(p) && petAutoOn(m, p) && ((p.petHeld || 0) >= MONO.PET_HOLD_TURNS || lastTurn)) {
    petCast(m, cur, { reason: lastTurn ? 'final' : 'auto_hold' });
    if (m.ended) return;
  }
  if (!p.bankrupt && p.status) {
    if (p.status.fresh) p.status.fresh = false;
    else if ((p.status.turnsLeft = (p.status.turnsLeft ?? 1) - 1) <= 0) p.status = null;
  }
  m.pending = null;
  const next = nextAliveSeat(m, cur);
  if (next <= cur) {
    m.round++;
    tickModifiers(m);
    if (m.round > m.maxRounds) { m.round = m.maxRounds; return endMatch(m, 'rounds'); }
    if (!m.chaos && (m.round === MONO.MID_ROUND || m.round === MONO.OVERDRIVE_ROUND)) {
      ev(m, { t: 'phase_shift', round: m.round, phase: m.round >= MONO.OVERDRIVE_ROUND ? 'overdrive' : 'mid' });
    }
    if (m.chaos) chaosEvent(m);
  }
  beginTurn(m, next);
}

// ------------------------------------------------------------------------------------------- 🎉 chaos party
/** One random Chaos Event at the start of every round (deterministic: uses the match RNG). */
function chaosEvent(m) {
  const alive = m.players.filter((q) => !q.bankrupt);
  const pool = CHAOS.EVENTS.filter((k) => k !== 'swap' || alive.length >= 2);
  const kind = pool[Math.floor(rand(m) * pool.length)];
  const round = m.round;
  switch (kind) {
    case 'meteor': {
      const bag = [...PROPERTY_IDX];
      const tiles = [];
      for (let k = 0; k < CHAOS.METEOR_TILES && bag.length; k++) tiles.push(bag.splice(Math.floor(rand(m) * bag.length), 1)[0]);
      const hits = [];
      for (const i of tiles) {
        const t = m.tiles[i];
        if (t.owner != null && t.level >= 1 && t.level < 4) { hits.push({ tile: i, from: t.level, to: t.level - 1 }); t.level--; }
      }
      ev(m, { t: 'chaos_event', kind, round, tiles, hits });
      for (const h of hits) ev(m, { t: 'tier', tile: h.tile, level: h.to, from: h.from, by: null, chaos: true, meteor: true });
      return;
    }
    case 'rent_x2': {
      const zones = Object.keys(ZONES);
      const zone = zones[Math.floor(rand(m) * zones.length)];
      const tiles = ZONE_TILES[zone];
      ev(m, { t: 'chaos_event', kind, round, zone, tiles, mult: 2 });
      for (const i of tiles) {
        m.tiles[i].modifier = { id: 'chaos_rent_x2', owner: null, rentMult: 2, turnsLeft: 1, fxTheme: 'chaos', chaos: true };
        ev(m, { t: 'modifier', tile: i, by: null, modifier: m.tiles[i].modifier });
      }
      return;
    }
    case 'swap': {
      const a = alive[Math.floor(rand(m) * alive.length)];
      const rest = alive.filter((q) => q !== a);
      const b = rest[Math.floor(rand(m) * rest.length)];
      [a.pos, b.pos] = [b.pos, a.pos];
      ev(m, { t: 'chaos_event', kind, round, a: a.seat, b: b.seat, posA: a.pos, posB: b.pos });
      ev(m, { t: 'move', seat: a.seat, path: [a.pos], kind: 'warp', dir: 0, chaos: true });
      ev(m, { t: 'move', seat: b.seat, path: [b.pos], kind: 'warp', dir: 0, chaos: true });
      return;
    }
    default: {   // gold_rain
      ev(m, { t: 'chaos_event', kind: 'gold_rain', round, amount: CHAOS.GOLD_RAIN, seats: alive.map((q) => q.seat) });
      for (const q of alive) pay(m, null, q.seat, CHAOS.GOLD_RAIN, 'chaos');
    }
  }
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
  m.result = { reason, by, winner: rank[0].seat, ranking: rank, rounds: m.round, highlights: m.highlights };
  ev(m, { t: 'end', reason, by, winner: rank[0].seat, ranking: rank, highlights: m.highlights });
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
  walkSelf: (s, steps, kind = 'dive') => { walk(m, s, steps, 1, kind); },
  setPending: (pd) => { m.pending = { canSkip: false, ...pd }; },
  ev: (e) => ev(m, e),
  rand: () => rand(m),
});

export function legalActions(m, seat) {
  const p = m.players[seat];
  const myTurn = !m.ended && m.turn?.seat === seat && p && !p.bankrupt;
  const canRoll = myTurn && m.phase === 'await_roll';
  const alive = !m.ended && p && !p.bankrupt;
  return {
    myTurn,
    canRoll,
    can2d6: canRoll && p.boost > 0 && !p.status?.fixedRoll && !p.status?.maxRoll,
    canUlt: canRoll && !m.turn.ultUsed && p.ult >= MONO.ULT_MAX,
    pending: myTurn && m.pending?.seat === seat ? m.pending : null,
    // 🐾 Soul-Link
    hasPet: !!p?.hasPet,
    petReady: !!(alive && petFull(p)),
    canPetCast: !!(canRoll && petFull(p)),
    canPetArm: !!(alive && p.hasPet && !petCapped(p)),
    petAuto: p?.petAuto !== false,
    petArmed: !!p?.petArmed,
    petCastsLeft: p?.hasPet ? (p.petCap == null ? null : Math.max(0, p.petCap - (p.petCasts || 0))) : 0,
  };
}

export function roll(m, seat, { use2d6 = false } = {}) {
  if (m.ended) return fail('match_over');
  if (m.turn.seat !== seat) return fail('not_your_turn');
  if (m.phase !== 'await_roll') return fail('bad_phase');
  const p = m.players[seat];
  const fixed = p.status?.fixedRoll || 0;
  const maxRoll = p.status?.maxRoll || 0;
  const dir = p.status?.moveDir === -1 ? -1 : 1;
  let dice;
  let boosted = false;
  if (fixed) dice = [fixed];
  else if (maxRoll) dice = [Math.min(maxRoll, d6(m))];
  else if (use2d6 && p.boost > 0) { p.boost--; boosted = true; dice = [d6(m), d6(m)]; }
  else dice = [d6(m)];
  const steps = dice.reduce((s, d) => s + d, 0);
  m.turn.rolled = true;
  ev(m, { t: 'dice', seat, dice, steps, dir, fixed: !!fixed, maxRoll: maxRoll || undefined, boosted, diceSkin: p.diceSkin || null });
  walk(m, seat, steps, dir, 'walk');
  land(m, seat, p.pos, { allowHop: true, via: 'walk' });
  afterAction(m);
  return { ok: true, dice, steps };
}

/**
 * Presentation hints for cut-ins (Dopamine Patch §2 speed rules). Pure pacing data; never affects state.
 *   fast   — bot seat → play the ult as a single ~1.2 s beat
 *   repeat — this exact cinematic already played this match → trim to ~60%
 */
function hints(m, p, key) {
  m.ultSeen ||= {};
  const n = m.ultSeen[key] || 0;
  m.ultSeen[key] = n + 1;
  return { fast: !!p.isBot, repeat: n > 0 };
}

/** Core pet cast (solo or combo). Returns true when it fired. */
function petCast(m, seat, { combo = false, reason = 'manual', ownerSkillId = null } = {}) {
  const p = m.players[seat];
  if (!p || p.bankrupt || m.ended || !petFull(p)) return false;
  const skill = petSkill(p);
  if (!skill) return false;
  p.petUlt = Math.min(MONO.ULT_MAX, p.petBank || 0);
  p.petBank = 0;
  p.petHeld = 0;
  p.petArmed = false;
  p.petCasts = (p.petCasts || 0) + 1;
  const bonus = combo ? (m.chaos ? CHAOS.COMBO_BONUS : MONO.PET_COMBO_BONUS) : 0;
  const potency = Math.round((p.petPotency || MONO.PET_ULT_SCALE) * (1 + bonus) * 10000) / 10000;
  const base = {
    seat, byPet: true, petId: p.petId || 'pet_ragdoll', petCostume: p.petCostume || null,
    skillId: skill.id, name: skill.name, icon: skill.icon, vfx: skill.vfx, fxTheme: skill.fxTheme,
    potency, petCasts: p.petCasts, petCastsLeft: p.petCap == null ? null : Math.max(0, p.petCap - p.petCasts),
  };
  if (combo) {
    p.petCombos = (p.petCombos || 0) + 1;
    ev(m, { t: 'pet_combo', ...base, outfitId: p.outfit, ownerSkillId, bonus, chaos: !!m.chaos, ...hints(m, p, `combo:${ownerSkillId}:${skill.id}`) });
  } else {
    ev(m, { t: 'ult', ...base, couple: false, partnerSeat: null, solo: true, reason, ...hints(m, p, `pet:${skill.id}`) });
  }
  if (m.highlights) m.highlights.ults[seat] = (m.highlights.ults[seat] || 0) + 1;
  const before = m.bankruptCount;
  m.inUlt = true;
  castUltimate(m, seat, ops(m), { scale: potency, skill, autoChoice: true, isPetUlt: true });
  m.inUlt = false;
  if (!m.ended && m.bankruptCount > before && (m.round >= MONO.OVERDRIVE_ROUND || m.players.filter((q) => !q.bankrupt).length <= 1)) {
    endMatch(m, 'finisher', { by: seat });
  }
  return true;
}

/** Will the pet join the owner's ult as a Soul-Link Combo? (Auto, armed in Manual, or bot/autopilot) */
const petWillCombo = (m, p) => petFull(p) && (petAutoOn(m, p) || !!p.petArmed);

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
  const willCombo = petWillCombo(m, p);
  ev(m, { t: 'ult', seat, skillId: skill.id, name: skill.name, icon: skill.icon, vfx: skill.vfx, fxTheme: skill.fxTheme, couple: !!partner, partnerSeat: partner?.seat ?? null, combo: willCombo, ...hints(m, p, `ult:${skill.id}`) });
  if (m.highlights) m.highlights.ults[seat] = (m.highlights.ults[seat] || 0) + 1;
  const ultEv = m.events[m.events.length - 1];
  const before = m.bankruptCount;
  m.ultScale = scale;
  m.inUlt = true;
  castUltimate(m, seat, ops(m), { scale });
  m.inUlt = false;
  if (!m.ended && m.bankruptCount > before && (m.round >= MONO.OVERDRIVE_ROUND || m.players.filter((q) => !q.bankrupt).length <= 1)) {
    endMatch(m, 'finisher', { by: seat });
  }
  // 🔗 Soul-Link Combo: the pet casts right after its owner (+15%, Chaos +30%)
  let combo = false;
  if (willCombo && !m.ended && !p.bankrupt) combo = petCast(m, seat, { combo: true, ownerSkillId: skill.id });
  if (ultEv) ultEv.combo = combo;
  afterAction(m);
  return { ok: true, skillId: skill.id, combo };
}

/** 🐾 Manual solo cast — any time on your turn before rolling. */
export function petUltimate(m, seat) {
  const la = legalActions(m, seat);
  if (!la.myTurn) return fail('not_your_turn');
  if (!la.canPetCast) return fail('pet_not_ready');
  petCast(m, seat, { reason: 'manual' });
  afterAction(m);
  return { ok: true };
}

/** 🐾 Arm / disarm the pet for the next owner ult (Manual mode). Allowed any time during the match. */
export function petArm(m, seat, armed = true) {
  const p = m.players[seat];
  if (m.ended || !p || p.bankrupt) return fail('match_over');
  if (!p.hasPet) return fail('no_pet');
  if (petCapped(p)) return fail('pet_capped');
  p.petArmed = !!armed;
  ev(m, { t: 'pet_arm', seat, armed: p.petArmed });
  return { ok: true, armed: p.petArmed };
}

/** 🐾 Toggle Auto/Manual for a seat (persisting it to the profile is the host's job). */
export function setPetAuto(m, seat, auto = true) {
  const p = m.players[seat];
  if (!p) return fail('not_seated');
  p.petAuto = !!auto;
  ev(m, { t: 'pet_mode', seat, auto: p.petAuto });
  return { ok: true, auto: p.petAuto };
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
        if (m.highlights) {
          if (!m.highlights.bigTakeover || cost > m.highlights.bigTakeover.cost) {
            m.highlights.bigTakeover = { seat, from, cost, tile: pd.tile };
          }
        }
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
        if (!m.ended && m.bankruptCount > before && (m.round >= MONO.OVERDRIVE_ROUND || m.players.filter((q) => !q.bankrupt).length <= 1)) {
          endMatch(m, 'finisher', { by: seat });
        }
        break;
      }
      default:
    }
  }
  afterAction(m);
  return { ok: true };
}

/** Compact public snapshot for HUD cards (cash + 👑 net worth + ult % + 🐾 petUlt %), Screen 10. */
export function scoreboard(m) {
  return m.players.map((p) => ({
    seat: p.seat, id: p.id, name: p.name, cash: p.cash, netWorth: netWorth(m, p.seat), ult: p.ult,
    petUlt: p.petUlt || 0, petCostume: p.petCostume || null, boost: p.boost,
    hasPet: !!p.hasPet, petAuto: p.petAuto !== false, petArmed: !!p.petArmed, petCasts: p.petCasts || 0, petCap: p.petCap ?? null,
    bankrupt: p.bankrupt, pos: p.pos, boardDiamonds: p.boardDiamonds || 0, diceSkin: p.diceSkin || null,
  }));
}

export { rand as _rand };
