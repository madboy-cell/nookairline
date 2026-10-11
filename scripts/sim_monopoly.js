/**
 * 🎲 Sky Monopoly — Monte Carlo Headless Game Simulator
 * Simulates thousands of complete Monopoly games between bot policies
 * and human proxies to measure win rates, round counts, and economy balance.
 */
const Rules = require('../public/monopoly_rules.js');
const Bot = require('../public/monopoly_bot.js');

const {
  MONO_CFG,
  MONOPOLY_TILES,
  ZONES,
  ITEMS,
  CASINO_TABLE,
  otherRole,
  upgradeCost,
  propValue,
  ownedTileIds,
  zoneTiles,
  ownsZone,
  finalBoardingMult,
  isFinalBoarding,
  getTileRent,
  netWorth,
  applyCharge,
  marketPrice,
  d6
} = Rules;

const ITEM_IDS = Object.keys(ITEMS);

// =========================================================
// 1. STATE INITIALIZATION
// =========================================================
function createSimPlayer(role) {
  return {
    role,
    pos: 0,
    miles: MONO_CFG.START_MILES,
    inventory: [],
    vibePasses: 0 // No vibe check in bot mode
  };
}

function createSimState(starter = 'bkk') {
  return {
    version: MONO_CFG.VERSION,
    currentTurn: starter,
    round: 1,
    players: {
      bkk: createSimPlayer('bkk'),
      dxb: createSimPlayer('dxb')
    },
    properties: {}, // tileId -> { owner, level }
    stats: {
      takeovers: { bkk: 0, dxb: 0 },
      rentPaid: { bkk: 0, dxb: 0 },
      jackpots: 0
    },
    gameOver: null
  };
}

// =========================================================
// 2. POLICIES
// =========================================================

// Human Proxy: plays like a competent human without calculating deep math
function humanPreRoll(state, role) {
  const p = state.players[role];
  const opp = otherRole(role);
  const oppP = state.players[opp];
  const inv = p.inventory || [];
  if (!inv.length) return null;

  // Golden Dice
  if (inv.includes('golden_dice')) {
    // Check if a roll 1..6 lands on a zone-completing unowned tile or upgrading own tile
    for (let r = 1; r <= 6; r++) {
      const targetId = (p.pos + r) % 20;
      const t = MONOPOLY_TILES[targetId];
      if (t.type === 'property') {
        const prop = state.properties[targetId];
        if (!prop && p.miles >= t.price) {
          const zt = zoneTiles(t.zone);
          const owned = zt.filter((x) => state.properties[x.id] && state.properties[x.id].owner === role).length;
          if (owned >= 1) return { useItem: 'golden_dice', value: r };
        }
      }
    }
  }

  // C4
  if (inv.includes('c4')) {
    const oppHotels = ownedTileIds(state, opp).filter((tid) => state.properties[tid].level >= 2);
    if (oppHotels.length) {
      oppHotels.sort((a, b) => getTileRent(state, b) - getTileRent(state, a));
      return { useItem: 'c4', tileId: oppHotels[0] };
    }
  }

  // Magnet
  if (inv.includes('magnet') && oppP.miles >= 450) {
    return { useItem: 'magnet' };
  }

  // Swap
  if (inv.includes('swap')) {
    // Check if player is approaching opponent hotel in 2..7 steps
    for (let step = 2; step <= 7; step++) {
      const tid = (p.pos + step) % 20;
      const prop = state.properties[tid];
      if (prop && prop.owner === opp && prop.level >= 2 && p.miles < 500) {
        return { useItem: 'swap' };
      }
    }
  }

  return null;
}

function humanDecide(state, role, decision) {
  const p = state.players[role];
  const opp = otherRole(role);

  switch (decision.type) {
    case 'buy': {
      const tile = MONOPOLY_TILES[decision.tileId];
      // Human buys if they have at least 80 miles left after purchase
      if (p.miles >= tile.price + 80) return { act: 'buy' };
      return { act: 'pass' };
    }
    case 'upgrade': {
      const tile = MONOPOLY_TILES[decision.tileId];
      const cost = upgradeCost(tile);
      if (p.miles >= cost + 120) return { act: 'build' };
      return { act: 'skip' };
    }
    case 'rent': {
      const tile = MONOPOLY_TILES[decision.tileId];
      const prop = state.properties[decision.tileId];
      const rent = getTileRent(state, tile.id);
      const val = propValue(state, tile.id);
      const isHotel = prop.level >= 3;
      const hasShield = p.inventory.includes('shield');

      if (hasShield && rent >= 220) return { act: 'shield' };
      if (!isHotel && p.miles >= val + 150) {
        // Human attempts takeover if they have comfortable cash
        return { act: 'takeover' };
      }
      return { act: 'pay' };
    }
    case 'casino': {
      if (decision.phase === 'offer') {
        if (p.miles >= 400 && Math.random() < 0.4) return { act: 'spin' };
        return { act: 'leave' };
      }
      return { act: 'continue' };
    }
    case 'market': {
      const offers = decision.offers || [];
      if (p.inventory.length < MONO_CFG.MAX_ITEMS) {
        if (offers.includes('shield') && p.miles >= marketPrice(state, role, 'shield') + 100) {
          return { act: 'buyItem', itemId: 'shield' };
        }
        if (offers.includes('golden_dice') && p.miles >= marketPrice(state, role, 'golden_dice') + 100) {
          return { act: 'buyItem', itemId: 'golden_dice' };
        }
      }
      return { act: 'leave' };
    }
    case 'arena': {
      const targets = ownedTileIds(state, opp).filter((tid) => state.properties[tid].level < 3);
      if (!targets.length) return { act: 'skip' };
      targets.sort((a, b) => propValue(state, b) - propValue(state, a));
      for (const tid of targets) {
        if (p.miles >= propValue(state, tid)) {
          return { act: 'challenge', targetTileId: tid };
        }
      }
      return { act: 'skip' };
    }
    default:
      return { act: 'pass' };
  }
}

// Random Policy
function randomPreRoll() { return null; }
function randomDecide(state, role, decision) {
  const p = state.players[role];
  switch (decision.type) {
    case 'buy': {
      const tile = MONOPOLY_TILES[decision.tileId];
      return p.miles >= tile.price && Math.random() < 0.5 ? { act: 'buy' } : { act: 'pass' };
    }
    case 'upgrade': {
      const tile = MONOPOLY_TILES[decision.tileId];
      const cost = upgradeCost(tile);
      return p.miles >= cost && Math.random() < 0.5 ? { act: 'build' } : { act: 'skip' };
    }
    case 'rent': {
      if (p.inventory.includes('shield') && Math.random() < 0.5) return { act: 'shield' };
      return { act: 'pay' };
    }
    case 'casino':
      return { act: Math.random() < 0.5 ? 'spin' : 'leave' };
    case 'market':
      return { act: 'leave' };
    case 'arena':
      return { act: 'skip' };
    default:
      return { act: 'pass' };
  }
}

function getPolicy(name) {
  switch (name) {
    case 'hard':
      return {
        preRoll: (s, r) => Bot.preRoll(s, r, 'hard'),
        decide: (s, r, d) => Bot.decide(s, r, d, 'hard')
      };
    case 'easy':
      return {
        preRoll: (s, r) => Bot.preRoll(s, r, 'easy'),
        decide: (s, r, d) => Bot.decide(s, r, d, 'easy')
      };
    case 'human':
      return {
        preRoll: humanPreRoll,
        decide: humanDecide
      };
    case 'random':
      return {
        preRoll: randomPreRoll,
        decide: randomDecide
      };
    default:
      throw new Error(`Unknown policy: ${name}`);
  }
}

// =========================================================
// 3. CORE SIMULATION STEP
// =========================================================
function checkGameOver(state) {
  if (state.gameOver) return true;
  const nwBkk = netWorth(state, 'bkk');
  const nwDxb = netWorth(state, 'dxb');
  if (nwBkk >= MONO_CFG.WIN_NET_WORTH || nwDxb >= MONO_CFG.WIN_NET_WORTH) {
    state.gameOver = {
      winner: nwBkk >= nwDxb ? 'bkk' : 'dxb',
      reason: 'target',
      round: state.round,
      netWorth: { bkk: nwBkk, dxb: nwDxb }
    };
    return true;
  }
  return false;
}

function simulateGame(policyBkkName, policyDxbName, starter = 'bkk') {
  const policies = {
    bkk: getPolicy(policyBkkName),
    dxb: getPolicy(policyDxbName)
  };

  const state = createSimState(starter);

  while (!state.gameOver && state.round <= MONO_CFG.MAX_ROUNDS) {
    const role = state.currentTurn;
    const opp = otherRole(role);
    const p = state.players[role];
    const oppP = state.players[opp];
    const policy = policies[role];

    // 1. Pre-roll Item Action
    let rollVal = d6();
    const itemAction = policy.preRoll(state, role);
    if (itemAction && itemAction.useItem) {
      const idx = p.inventory.indexOf(itemAction.useItem);
      if (idx !== -1) p.inventory.splice(idx, 1);

      if (itemAction.useItem === 'golden_dice') {
        rollVal = itemAction.value || 6;
      } else if (itemAction.useItem === 'c4') {
        const tid = itemAction.tileId;
        if (tid != null && state.properties[tid] && state.properties[tid].level >= 2) {
          state.properties[tid].level = 1;
        }
      } else if (itemAction.useItem === 'magnet') {
        const targetMiles = Math.max(0, oppP.miles);
        const steal = Math.round(targetMiles * (MONO_CFG.MAGNET_RATE || 0.25));
        oppP.miles -= steal;
        p.miles += steal;
      } else if (itemAction.useItem === 'swap') {
        const tmp = p.pos;
        p.pos = oppP.pos;
        oppP.pos = tmp;
      }
    }

    // 2. Advance Position
    const oldPos = p.pos;
    p.pos = (oldPos + rollVal) % 20;

    // Lap bonus (pass START)
    if (p.pos < oldPos || p.pos === 0) {
      p.miles += MONO_CFG.LAP_BONUS;
    }

    // 3. Resolve Landing
    const tile = MONOPOLY_TILES[p.pos];

    if (tile.type === 'bridge') {
      p.pos = oppP.pos;
    } else if (tile.type === 'airdrop') {
      if (p.inventory.length < MONO_CFG.MAX_ITEMS) {
        const item = ITEM_IDS[Math.floor(Math.random() * ITEM_IDS.length)];
        p.inventory.push(item);
      } else {
        p.miles += MONO_CFG.AIRDROP_FULL_CASH;
      }
    } else if (tile.type === 'casino') {
      const dec = policy.decide(state, role, { type: 'casino', tileId: tile.id, phase: 'offer' });
      if (dec.act === 'spin' && p.miles >= MONO_CFG.CASINO_BET) {
        p.miles -= MONO_CFG.CASINO_BET;
        let x = Math.random();
        let out = CASINO_TABLE[CASINO_TABLE.length - 1];
        for (const row of CASINO_TABLE) {
          if (x < row.p) { out = row; break; }
          x -= row.p;
        }
        if (out.item) {
          if (p.inventory.length < MONO_CFG.MAX_ITEMS) {
            const item = ITEM_IDS[Math.floor(Math.random() * ITEM_IDS.length)];
            p.inventory.push(item);
          } else {
            p.miles += MONO_CFG.AIRDROP_FULL_CASH;
          }
        } else if (out.miles > 0) {
          p.miles += out.miles;
        } else if (out.miles < 0) {
          const r = applyCharge(state, role, -out.miles, null);
          if (r.bankrupt) {
            state.gameOver = { winner: opp, reason: 'bankrupt', round: state.round, netWorth: { bkk: netWorth(state, 'bkk'), dxb: netWorth(state, 'dxb') } };
            break;
          }
        }
        if (out.id === 'jackpot') state.stats.jackpots++;
      }
    } else if (tile.type === 'market') {
      const offers = ITEM_IDS.slice().sort(() => Math.random() - 0.5).slice(0, 3);
      const dec = policy.decide(state, role, { type: 'market', tileId: tile.id, offers });
      if (dec.act === 'buyItem' && dec.itemId && p.inventory.length < MONO_CFG.MAX_ITEMS) {
        const pr = marketPrice(state, role, dec.itemId);
        if (p.miles >= pr) {
          p.miles -= pr;
          p.inventory.push(dec.itemId);
        }
      }
    } else if (tile.type === 'arena') {
      const dec = policy.decide(state, role, { type: 'arena', tileId: tile.id });
      if (dec.act === 'challenge' && dec.targetTileId != null) {
        const targetId = dec.targetTileId;
        const val = propValue(state, targetId);
        if (p.miles >= val && state.properties[targetId] && state.properties[targetId].owner === opp) {
          const aRoll = d6();
          const dRoll = d6();
          if (aRoll > dRoll) { // attacker wins strictly; defender wins ties
            const r = applyCharge(state, role, val, opp);
            if (!r.bankrupt) {
              state.properties[targetId].owner = role;
              state.stats.takeovers[role]++;
            }
          }
        }
      }
    } else if (tile.type === 'property') {
      const prop = state.properties[tile.id];
      if (!prop) {
        // Unowned
        const dec = policy.decide(state, role, { type: 'buy', tileId: tile.id });
        if (dec.act === 'buy' && p.miles >= tile.price) {
          p.miles -= tile.price;
          state.properties[tile.id] = { owner: role, level: 1 };
        }
      } else if (prop.owner === role) {
        // Own property
        if (prop.level < 3) {
          const dec = policy.decide(state, role, { type: 'upgrade', tileId: tile.id });
          if (dec.act === 'build') {
            const cost = upgradeCost(tile);
            if (p.miles >= cost) {
              p.miles -= cost;
              prop.level++;
            }
          }
        }
      } else {
        // Opponent property (Rent due)
        const rent = getTileRent(state, tile.id);
        const dec = policy.decide(state, role, { type: 'rent', tileId: tile.id });
        if (dec.act === 'shield') {
          const sIdx = p.inventory.indexOf('shield');
          if (sIdx !== -1) p.inventory.splice(sIdx, 1);
        } else if (dec.act === 'takeover') {
          const val = propValue(state, tile.id);
          const aRoll = d6();
          const dRoll = d6();
          if (aRoll > dRoll) { // attacker won duel
            const r = applyCharge(state, role, val, opp);
            if (!r.bankrupt) {
              state.properties[tile.id].owner = role;
              state.stats.takeovers[role]++;
            } else {
              state.gameOver = { winner: opp, reason: 'bankrupt', round: state.round, netWorth: { bkk: netWorth(state, 'bkk'), dxb: netWorth(state, 'dxb') } };
              break;
            }
          } else { // defender held tile
            const r = applyCharge(state, role, Math.round(rent * MONO_CFG.TAKEOVER_LOSE_MULT), opp);
            state.stats.rentPaid[role] += r.paid;
            if (r.bankrupt) {
              state.gameOver = { winner: opp, reason: 'bankrupt', round: state.round, netWorth: { bkk: netWorth(state, 'bkk'), dxb: netWorth(state, 'dxb') } };
              break;
            }
          }
        } else {
          // Normal rent pay
          const r = applyCharge(state, role, rent, opp);
          state.stats.rentPaid[role] += r.paid;
          if (r.bankrupt) {
            state.gameOver = { winner: opp, reason: 'bankrupt', round: state.round, netWorth: { bkk: netWorth(state, 'bkk'), dxb: netWorth(state, 'dxb') } };
            break;
          }
        }
      }
    }

    if (checkGameOver(state)) break;

    // Advance turn
    state.currentTurn = opp;
    if (state.currentTurn === 'bkk') {
      state.round++;
      if (state.round > MONO_CFG.MAX_ROUNDS) {
        const nwBkk = netWorth(state, 'bkk');
        const nwDxb = netWorth(state, 'dxb');
        state.gameOver = {
          winner: nwBkk === nwDxb ? null : (nwBkk > nwDxb ? 'bkk' : 'dxb'),
          reason: nwBkk === nwDxb ? 'draw' : 'cap',
          round: MONO_CFG.MAX_ROUNDS,
          netWorth: { bkk: nwBkk, dxb: nwDxb }
        };
        break;
      }
    }
  }

  return state.gameOver;
}

// =========================================================
// 4. BATCH EXPERIMENT RUNNER
// =========================================================
function runMatchup(p1Name, p2Name, totalGames = 5000) {
  console.log(`\n============================================================`);
  console.log(`RUNNING SIMULATION: ${p1Name.toUpperCase()} vs ${p2Name.toUpperCase()} (${totalGames.toLocaleString()} games)`);
  console.log(`============================================================`);

  const results = {
    p1Wins: 0,
    p2Wins: 0,
    draws: 0,
    totalRounds: 0,
    reasons: { target: 0, bankrupt: 0, cap: 0, draw: 0 }
  };

  const startTime = Date.now();

  for (let i = 0; i < totalGames; i++) {
    // Alternate starter to eliminate first-player bias
    const starter = (i % 2 === 0) ? 'bkk' : 'dxb';
    const outcome = simulateGame(p1Name, p2Name, starter);

    results.totalRounds += outcome.round;
    results.reasons[outcome.reason] = (results.reasons[outcome.reason] || 0) + 1;

    if (outcome.winner === 'bkk') results.p1Wins++;
    else if (outcome.winner === 'dxb') results.p2Wins++;
    else results.draws++;
  }

  const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(2);
  const avgRounds = (results.totalRounds / totalGames).toFixed(2);
  const p1Rate = ((results.p1Wins / totalGames) * 100).toFixed(1);
  const p2Rate = ((results.p2Wins / totalGames) * 100).toFixed(1);
  const drawRate = ((results.draws / totalGames) * 100).toFixed(1);

  // Real-world time estimate:
  // Human turn: ~10-12s, Bot turn: ~2-3s -> Average round (both players) = ~14s
  const avgMins = ((results.totalRounds / totalGames) * 14 / 60).toFixed(1);

  console.log(`Completed in ${elapsedSec}s`);
  console.log(`Results:`);
  console.log(`  ${p1Name} wins: ${results.p1Wins} (${p1Rate}%)`);
  console.log(`  ${p2Name} wins: ${results.p2Wins} (${p2Rate}%)`);
  console.log(`  Draws:     ${results.draws} (${drawRate}%)`);
  console.log(`  Avg Rounds: ${avgRounds} (Est. ${avgMins} mins per real game)`);
  console.log(`  End Reasons: Target NW: ${results.reasons.target || 0}, Bankruptcy: ${results.reasons.bankrupt || 0}, 24-Round Cap: ${results.reasons.cap || 0}, Draw: ${results.reasons.draw || 0}`);

  return {
    p1Name,
    p2Name,
    totalGames,
    p1Wins: results.p1Wins,
    p2Wins: results.p2Wins,
    draws: results.draws,
    p1Rate: Number(p1Rate),
    p2Rate: Number(p2Rate),
    drawRate: Number(drawRate),
    avgRounds: Number(avgRounds),
    avgMins: Number(avgMins),
    reasons: results.reasons
  };
}

function runAllSimulations() {
  const t0 = Date.now();
  console.log(`✈️ Starting Sky Monopoly Monte Carlo Headless Tournament...`);

  // Target targets from spec:
  // Human-proxy vs Hard ≈ 40–45% human win
  // Human-proxy vs Easy ≈ 70% human win
  const hardVsHuman = runMatchup('hard', 'human', 5000);
  const easyVsHuman = runMatchup('easy', 'human', 5000);
  const hardVsEasy  = runMatchup('hard', 'easy', 5000);
  const randomVsRandom = runMatchup('random', 'random', 2000);

  const totalTime = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n🎉 Tournament finished in ${totalTime}s!`);

  console.log(`\n=================== SUMMARY TABLE ===================`);
  console.log(`Matchup                 | P1 Win% | P2 Win% | Draws% | Avg Rds | Est Mins`);
  console.log(`-----------------------------------------------------`);
  [hardVsHuman, easyVsHuman, hardVsEasy, randomVsRandom].forEach((m) => {
    const name = `${m.p1Name} vs ${m.p2Name}`.padEnd(23);
    const p1 = `${m.p1Rate}%`.padStart(7);
    const p2 = `${m.p2Rate}%`.padStart(7);
    const dr = `${m.drawRate}%`.padStart(6);
    const rds = `${m.avgRounds}`.padStart(7);
    const mins = `${m.avgMins}m`.padStart(8);
    console.log(`${name} | ${p1} | ${p2} | ${dr} | ${rds} | ${mins}`);
  });
  console.log(`=====================================================\n`);

  return { hardVsHuman, easyVsHuman, hardVsEasy, randomVsRandom };
}

if (require.main === module) {
  runAllSimulations();
}

module.exports = {
  simulateGame,
  runMatchup,
  runAllSimulations
};
