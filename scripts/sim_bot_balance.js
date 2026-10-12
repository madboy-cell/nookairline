/**
 * 🎲 Sky Monopoly — Bot Balance & Winrate Simulator
 * Evaluates game balance across Bot Easy, Bot Hard, and Bot Insane against a Player with a Random Mythic identity.
 *
 * Difficulty Rules:
 *  - Player: Competent strategist equipped with a randomly assigned Mythic costume (perks + signature ultimate).
 *  - Bot Easy ("Trainee Mochi 🐾"): Carefree, casual, skips upgrades 75%, mistakes, ZERO skills & ZERO ultimates.
 *  - Bot Hard ("Capt. Whiskers 😼"): High-IQ monopoly strategist, calculates cash reserve, zone builder, ZERO skills & ZERO ultimates.
 *  - Bot Insane ("Apex Sovereign ⚡"): God-tier AI, maximum math, 6-tile forward trajectory optimization,
 *                                   equipped with a randomly assigned Mythic costume (perks + tactical signature ultimate).
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
  getTileRent,
  netWorth,
  applyCharge,
  marketPrice,
  d6
} = Rules;

const ITEM_IDS = Object.keys(ITEMS);

// =========================================================
// 1. MYTHIC PERK & ULTIMATE REGISTRY
// =========================================================
const MYTHIC_DEFINITIONS = {
  // Season 1: Bangkok
  s1_naga_m: { name: 'Emerald Naga Prince', perk: 'lapBonus', ult: 'siphon' },
  s1_kinnaree_f: { name: 'Golden Kinnaree Princess', perk: 'lapBonus', ult: 'cash_surge' },

  // Season 2: Tokyo
  s2_inari_m: { name: 'Kyoto Inari Lord', perk: 'foxfireShield', ult: 'cash_surge' },
  s2_inari_f: { name: 'Crimson Kitsune Shrine-Maiden', perk: 'foxfireShield', ult: 'reverse_hex' },
  s2_celestial_m: { name: 'Edo Tsukuyomi Lord', perk: 'startMiles', ult: 'siphon' },
  s2_celestial_f: { name: 'Amaterasu Sun Empress', perk: 'supernova6', ult: 'demolition' },

  // Season 3: Dubai
  s3_djinn_m: { name: 'Mirage Desert Sultan', perk: 'startMiles', ult: 'cash_surge' },
  s3_djinn_f: { name: 'Dune Oasis Sultana', perk: 'lapBonus', ult: 'siphon' },
  s3_phoenix_m: { name: 'Solaris Flame Phoenix Lord', perk: 'phoenixRebirth', ult: 'demolition' },
  s3_phoenix_f: { name: 'Crimson Phoenix Maiden', perk: 'phoenixRebirth', ult: 'demolition' },

  // Season 4: Monte Carlo
  s4_royale_m: { name: 'Casino Royale Baron', perk: 'vipExpress', ult: 'cash_surge' },
  s4_royale_f: { name: 'Monte Carlo Grand Dame', perk: 'vipExpress', ult: 'cash_surge' },
  s4_roulette_m: { name: 'Roulette Grand Duke', perk: 'loadedBattleDice', ult: 'demolition' },
  s4_roulette_f: { name: 'Golden Roulette Marquise', perk: 'loadedBattleDice', ult: 'siphon' },

  // Season 5: Atlantis
  s5_emperor_m: { name: 'Abyssal Triton Emperor', perk: 'oceanDrift', ult: 'demolition' },
  s5_siren_f: { name: 'Bioluminescent Coral Siren', perk: 'oceanDrift', ult: 'siphon' },
  s5_leviathan_m: { name: 'Trench Leviathan Sovereign', perk: 'startMiles', ult: 'demolition' },
  s5_jellyfish_f: { name: 'Ethereal Moon-Jelly Priestess', perk: 'frostShield', ult: 'siphon' },

  // Season 6: Starlight
  s6_supernova_m: { name: 'Supernova Sovereign', perk: 'supernova6', ult: 'supernova_burst' },
  s6_supernova_f: { name: 'Starlight Empress', perk: 'supernova6', ult: 'supernova_burst' },
  s6_aegis_m: { name: 'Aegis Vanguard Commander', perk: 'starlightWard', ult: 'cash_surge' },
  s6_aegis_f: { name: 'Cosmic Aegis Sentinel', perk: 'starlightWard', ult: 'reverse_hex' },

  // Season 7: Fairytales
  s7_sundrop_m: { name: 'Corona Sun Prince', perk: 'startMiles', ult: 'cash_surge' },
  s7_sundrop_f: { name: 'Sundrop Blossom Princess', perk: 'frostShield', ult: 'reverse_hex' },
  s7_cinderella_m: { name: 'Glass Slipper Prince', perk: 'loadedBattleDice', ult: 'cash_surge' },
  s7_cinderella_f: { name: 'Midnight Starlight Queen', perk: 'frostShield', ult: 'reverse_hex' },
  s7_belle_m: { name: 'Enchanted Beast Adam', perk: 'loadedBattleDice', ult: 'demolition' },
  s7_belle_f: { name: 'Golden Rose Belle', perk: 'lapBonus', ult: 'cash_surge' },

  // Season 8: Nordic
  s8_glacier_m: { name: 'Jotunheim Frost Sovereign', perk: 'frostShield', ult: 'siphon' },
  s8_glacier_f: { name: 'Aurora Glacial Queen', perk: 'frostShield', ult: 'siphon' },

  // Season 9: Olympus
  s9_olympus_m: { name: 'Olympian Thunder King Zeus', perk: 'zeusSmite', ult: 'demolition' },
  s9_olympus_f: { name: 'Hera Celestial Sovereign', perk: 'zeusSmite', ult: 'demolition' }
};

const ALL_MYTHIC_KEYS = Object.keys(MYTHIC_DEFINITIONS);

function getRandomMythic() {
  const k = ALL_MYTHIC_KEYS[Math.floor(Math.random() * ALL_MYTHIC_KEYS.length)];
  return { id: k, ...MYTHIC_DEFINITIONS[k] };
}

// =========================================================
// 2. PLAYER & STATE FACTORY
// =========================================================
function createSimPlayer(role, policyType) {
  const p = {
    role,
    policyType,
    botLevel: policyType,
    isBot: policyType !== 'human',
    pos: 0,
    miles: MONO_CFG.START_MILES,
    inventory: [],
    ult: 0,
    mythic: null,
    costume: null,
    activeCostume: null,
    phoenixUsed: false,
    ultCasts: 0
  };

  // Assign mythic costume identity if player (human proxy) or insane bot
  if (policyType === 'human' || policyType === 'insane') {
    p.mythic = getRandomMythic();
    p.costume = p.mythic.id;
    p.activeCostume = p.mythic.id;
    // Immediate starting perks
    if (p.mythic.perk === 'startMiles') p.miles += 150;
    if (p.mythic.perk === 'foxfireShield') p.inventory.push('shield');
  }

  return p;
}

function createSimState(starter = 'bkk', policyBkk = 'human', policyDxb = 'easy') {
  return {
    version: MONO_CFG.VERSION,
    currentTurn: starter,
    round: 1,
    players: {
      bkk: createSimPlayer('bkk', policyBkk),
      dxb: createSimPlayer('dxb', policyDxb)
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
// 3. ULTIMATE ABILITY ENGINE
// =========================================================
function chargeUlt(p, amt) {
  // Easy and Hard bots NEVER charge or cast ultimate!
  if (!p) return;
  if (p.botLevel === 'easy' || p.botLevel === 'hard') return;
  p.ult = Math.min(100, (p.ult || 0) + amt);
}

function executeSimUltimate(state, role) {
  const p = state.players[role];
  const opp = otherRole(role);
  const oppP = state.players[opp];
  if (!p.mythic || p.ult < 100) return;

  p.ult = 0;
  p.ultCasts = (p.ultCasts || 0) + 1;
  const ultType = p.mythic.ult;

  switch (ultType) {
    case 'siphon': {
      // Siphon 15% (min 100) from opponent
      const siphonAmt = Math.min(oppP.miles, Math.max(100, Math.floor(oppP.miles * 0.18)));
      oppP.miles -= siphonAmt;
      p.miles += siphonAmt;
      break;
    }
    case 'demolition': {
      // 180 smite damage + degrade highest enemy property
      const dmg = Math.min(oppP.miles, 180);
      oppP.miles -= dmg;
      p.miles += Math.floor(dmg * 0.5);

      if (oppP.mythic?.perk !== 'starlightWard') {
        const oppHotels = ownedTileIds(state, opp).filter((tid) => state.properties[tid].level >= 2);
        if (oppHotels.length) {
          oppHotels.sort((a, b) => getTileRent(state, b) - getTileRent(state, a));
          state.properties[oppHotels[0]].level -= 1;
        }
      }
      break;
    }
    case 'cash_surge': {
      // +350 miles instant + 1 free shield/golden dice
      p.miles += 350;
      if (p.inventory.length < MONO_CFG.MAX_ITEMS) {
        p.inventory.push(Math.random() < 0.5 ? 'shield' : 'golden_dice');
      }
      break;
    }
    case 'reverse_hex': {
      // Deploy shield + siphon 100 miles
      if (p.inventory.length < MONO_CFG.MAX_ITEMS) p.inventory.push('shield');
      const hex = Math.min(oppP.miles, 120);
      oppP.miles -= hex;
      p.miles += hex;
      break;
    }
    case 'supernova_burst': {
      // Supernova teleport: +6 tiles & lap bonus
      p.pos = (p.pos + 6) % 20;
      p.miles += MONO_CFG.LAP_BONUS;
      break;
    }
    default:
      p.miles += 200;
  }
}

// =========================================================
// 4. POLICIES & DECISION HEURISTICS
// =========================================================

// Human Proxy: competent human who understands properties & uses items
function humanPreRoll(state, role) {
  const p = state.players[role];
  const opp = otherRole(role);
  const oppP = state.players[opp];
  const inv = p.inventory || [];

  // Tactical Ultimate Check for Player
  if (p.ult >= 100) {
    executeSimUltimate(state, role);
  }

  if (!inv.length) return null;

  // Golden Dice
  if (inv.includes('golden_dice')) {
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
  if (inv.includes('c4') && oppP.mythic?.perk !== 'starlightWard') {
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

      if (hasShield && rent >= 200) return { act: 'shield' };
      if (!isHotel && p.miles >= val + 150) return { act: 'takeover' };
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
    case 'insane':
      return {
        preRoll: (s, r) => {
          // Tactical ultimate execution
          const p = s.players[r];
          if (p.ult >= 100 && Bot.shouldUseUltimate(s, r)) {
            executeSimUltimate(s, r);
          }
          return Bot.preRoll(s, r, 'insane');
        },
        decide: (s, r, d) => Bot.decide(s, r, d, 'insane')
      };
    case 'human':
      return {
        preRoll: humanPreRoll,
        decide: humanDecide
      };
    default:
      throw new Error(`Unknown policy: ${name}`);
  }
}

// =========================================================
// 5. CORE SIMULATION STEP WITH PERKS & RESURRECTIONS
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

function handleCharge(state, payerRole, amount, receiverRole) {
  const p = state.players[payerRole];
  const opp = otherRole(payerRole);

  const res = applyCharge(state, payerRole, amount, receiverRole);
  if (res.bankrupt) {
    // Check Phoenix Rebirth perk
    if (p.mythic?.perk === 'phoenixRebirth' && !p.phoenixUsed) {
      p.phoenixUsed = true;
      p.miles = 350;
      return { bankrupt: false, paid: res.paid, phoenixRebirth: true };
    }
    state.gameOver = {
      winner: opp,
      reason: 'bankrupt',
      round: state.round,
      netWorth: { bkk: netWorth(state, 'bkk'), dxb: netWorth(state, 'dxb') }
    };
  }
  return res;
}

function simulateGame(policyBkkName, policyDxbName, starter = 'bkk') {
  const policies = {
    bkk: getPolicy(policyBkkName),
    dxb: getPolicy(policyDxbName)
  };

  const state = createSimState(starter, policyBkkName, policyDxbName);

  while (!state.gameOver && state.round <= MONO_CFG.MAX_ROUNDS) {
    const role = state.currentTurn;
    const opp = otherRole(role);
    const p = state.players[role];
    const oppP = state.players[opp];
    const policy = policies[role];

    // 1. Pre-roll Item Action & Ultimate Check
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
          if (oppP.mythic?.perk !== 'starlightWard') {
            state.properties[tid].level = 1;
          }
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

    // Passive perk: Supernova bonus roll on 6
    if (rollVal === 6 && p.mythic?.perk === 'supernova6') {
      p.miles += 50;
      chargeUlt(p, 20);
    }

    // Passive perk: Zeus Smite on 6
    if (rollVal === 6 && p.mythic?.perk === 'zeusSmite') {
      const smiteDmg = Math.min(oppP.miles, 120);
      oppP.miles -= smiteDmg;
      p.miles += smiteDmg;
    }

    if (rollVal === 6) {
      chargeUlt(p, 15);
    }

    // 2. Advance Position (passive Ocean Drift +1 step)
    let moveSteps = rollVal + (p.mythic?.perk === 'oceanDrift' ? 1 : 0);
    const oldPos = p.pos;
    p.pos = (oldPos + moveSteps) % 20;

    // Lap bonus (pass START)
    if (p.pos < oldPos || p.pos === 0) {
      let lapBonus = MONO_CFG.LAP_BONUS;
      if (p.mythic?.perk === 'lapBonus') lapBonus += 60;
      p.miles += lapBonus;
      chargeUlt(p, 25);
    }

    // 3. Resolve Landing
    const tile = MONOPOLY_TILES[p.pos];

    if (tile.type === 'bridge') {
      p.pos = oppP.pos;
    } else if (tile.type === 'airdrop') {
      chargeUlt(p, 15);
      if (p.inventory.length < MONO_CFG.MAX_ITEMS) {
        const item = ITEM_IDS[Math.floor(Math.random() * ITEM_IDS.length)];
        p.inventory.push(item);
      } else {
        p.miles += MONO_CFG.AIRDROP_FULL_CASH;
      }
    } else if (tile.type === 'casino') {
      chargeUlt(p, 15);
      const dec = policy.decide(state, role, { type: 'casino', tileId: tile.id, phase: 'offer' });
      if (dec.act === 'spin' && p.miles >= MONO_CFG.CASINO_BET) {
        p.miles -= MONO_CFG.CASINO_BET;
        let x = Math.random();
        let out = CASINO_TABLE[CASINO_TABLE.length - 1];
        for (const row of CASINO_TABLE) {
          if (x < row.p) { out = row; break; }
          x -= row.p;
        }

        let multiplier = (p.mythic?.perk === 'vipExpress') ? 1.25 : 1.0;

        if (out.item) {
          if (p.inventory.length < MONO_CFG.MAX_ITEMS) {
            const item = ITEM_IDS[Math.floor(Math.random() * ITEM_IDS.length)];
            p.inventory.push(item);
          } else {
            p.miles += Math.round(MONO_CFG.AIRDROP_FULL_CASH * multiplier);
          }
        } else if (out.miles > 0) {
          p.miles += Math.round(out.miles * multiplier);
        } else if (out.miles < 0) {
          const r = handleCharge(state, role, -out.miles, null);
          if (r.bankrupt) break;
        }
        if (out.id === 'jackpot') state.stats.jackpots++;
      }
    } else if (tile.type === 'market') {
      chargeUlt(p, 15);
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
      chargeUlt(p, 15);
      const dec = policy.decide(state, role, { type: 'arena', tileId: tile.id });
      if (dec.act === 'challenge' && dec.targetTileId != null) {
        const targetId = dec.targetTileId;
        const val = propValue(state, targetId);
        if (p.miles >= val && state.properties[targetId] && state.properties[targetId].owner === opp) {
          let aRoll = d6();
          let dRoll = d6();
          if (p.mythic?.perk === 'loadedBattleDice') aRoll = Math.max(4, aRoll);
          if (oppP.mythic?.perk === 'loadedBattleDice') dRoll = Math.max(4, dRoll);

          if (aRoll > dRoll) {
            const r = handleCharge(state, role, val, opp);
            if (!r.bankrupt) {
              state.properties[targetId].owner = role;
              state.stats.takeovers[role]++;
            } else {
              break;
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
        let rent = getTileRent(state, tile.id);

        // Passive Frost Shield: 50% discount on opponent rent
        if (p.mythic?.perk === 'frostShield') {
          rent = Math.round(rent * 0.5);
        }

        const dec = policy.decide(state, role, { type: 'rent', tileId: tile.id });
        if (dec.act === 'shield') {
          const sIdx = p.inventory.indexOf('shield');
          if (sIdx !== -1) p.inventory.splice(sIdx, 1);
        } else if (dec.act === 'takeover') {
          const val = propValue(state, tile.id);
          let aRoll = d6();
          let dRoll = d6();
          if (p.mythic?.perk === 'loadedBattleDice') aRoll = Math.max(4, aRoll);
          if (oppP.mythic?.perk === 'loadedBattleDice') dRoll = Math.max(4, dRoll);

          if (aRoll > dRoll) {
            const r = handleCharge(state, role, val, opp);
            if (!r.bankrupt) {
              state.properties[tile.id].owner = role;
              state.stats.takeovers[role]++;
            } else {
              break;
            }
          } else {
            const r = handleCharge(state, role, Math.round(rent * MONO_CFG.TAKEOVER_LOSE_MULT), opp);
            state.stats.rentPaid[role] += r.paid;
            chargeUlt(p, 25);
            if (r.bankrupt) break;
          }
        } else {
          // Normal rent pay
          const r = handleCharge(state, role, rent, opp);
          state.stats.rentPaid[role] += r.paid;
          chargeUlt(p, 25);
          if (r.bankrupt) break;
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

  return {
    ...state.gameOver,
    bkkUltCasts: state.players.bkk.ultCasts,
    dxbUltCasts: state.players.dxb.ultCasts,
    bkkMythic: state.players.bkk.mythic?.name || 'None',
    dxbMythic: state.players.dxb.mythic?.name || 'None'
  };
}

// =========================================================
// 6. BATCH EXPERIMENT RUNNER
// =========================================================
function runTournamentMatchup(playerPolicy, botPolicy, totalGames = 1500) {
  console.log(`\n============================================================`);
  console.log(`🎯 SIMULATION: ${playerPolicy.toUpperCase()} (Random Mythic) vs ${botPolicy.toUpperCase()} (${totalGames.toLocaleString()} games)`);
  console.log(`============================================================`);

  const results = {
    playerWins: 0,
    botWins: 0,
    draws: 0,
    totalRounds: 0,
    playerUltCasts: 0,
    botUltCasts: 0,
    reasons: { target: 0, bankrupt: 0, cap: 0, draw: 0 }
  };

  const startTime = Date.now();

  for (let i = 0; i < totalGames; i++) {
    const starter = (i % 2 === 0) ? 'bkk' : 'dxb';
    // bkk is always Player, dxb is always Bot
    const outcome = simulateGame(playerPolicy, botPolicy, starter);

    results.totalRounds += outcome.round;
    results.reasons[outcome.reason] = (results.reasons[outcome.reason] || 0) + 1;
    results.playerUltCasts += outcome.bkkUltCasts || 0;
    results.botUltCasts += outcome.dxbUltCasts || 0;

    if (outcome.winner === 'bkk') results.playerWins++;
    else if (outcome.winner === 'dxb') results.botWins++;
    else results.draws++;
  }

  const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(2);
  const avgRounds = (results.totalRounds / totalGames).toFixed(2);
  const playerRate = ((results.playerWins / totalGames) * 100).toFixed(1);
  const botRate = ((results.botWins / totalGames) * 100).toFixed(1);
  const drawRate = ((results.draws / totalGames) * 100).toFixed(1);
  const avgPlayerUlts = (results.playerUltCasts / totalGames).toFixed(2);
  const avgBotUlts = (results.botUltCasts / totalGames).toFixed(2);

  console.log(`⏱️ Completed in ${elapsedSec}s`);
  console.log(`📊 Results:`);
  console.log(`  Player (Random Mythic) Wins: ${results.playerWins} (${playerRate}%)`);
  console.log(`  Bot (${botPolicy}) Wins:           ${results.botWins} (${botRate}%)`);
  console.log(`  Draws:                       ${results.draws} (${drawRate}%)`);
  console.log(`  Avg Rounds per Game:         ${avgRounds}`);
  console.log(`  Avg Player Ultimates Cast:   ${avgPlayerUlts}`);
  console.log(`  Avg Bot Ultimates Cast:      ${avgBotUlts}`);
  console.log(`  End Reasons: Target NW: ${results.reasons.target || 0}, Bankruptcy: ${results.reasons.bankrupt || 0}, Cap: ${results.reasons.cap || 0}, Draw: ${results.reasons.draw || 0}`);

  return {
    playerPolicy,
    botPolicy,
    totalGames,
    playerWins: results.playerWins,
    botWins: results.botWins,
    draws: results.draws,
    playerRate: Number(playerRate),
    botRate: Number(botRate),
    drawRate: Number(drawRate),
    avgRounds: Number(avgRounds),
    avgPlayerUlts: Number(avgPlayerUlts),
    avgBotUlts: Number(avgBotUlts),
    reasons: results.reasons
  };
}

function runAllBalanceSimulations() {
  const t0 = Date.now();
  console.log(`🚀 Starting Sky Monopoly Bot Balance Verification...`);
  console.log(`Total Mythic Identities In Pool: ${ALL_MYTHIC_KEYS.length}`);

  // 1. Player (Random Mythic) vs Bot Easy (Zero Skill/Ult)
  const vsEasy = runTournamentMatchup('human', 'easy', 2000);

  // 2. Player (Random Mythic) vs Bot Hard (Zero Skill/Ult)
  const vsHard = runTournamentMatchup('human', 'hard', 2000);

  // 3. Player (Random Mythic) vs Bot Insane (Random Mythic, Max Decision)
  const vsInsane = runTournamentMatchup('human', 'insane', 2000);

  const totalTime = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n========================================================================`);
  console.log(`🏆 FINAL TOURNAMENT BALANCE REPORT (${totalTime}s)`);
  console.log(`========================================================================`);
  console.log(`Matchup                                  | Player Win% | Bot Win% | Draws% | Avg Rds | Bot Ults`);
  console.log(`------------------------------------------------------------------------`);
  [vsEasy, vsHard, vsInsane].forEach((m) => {
    const name = `Player (Mythic) vs Bot ${m.botPolicy.toUpperCase()}`.padEnd(40);
    const p = `${m.playerRate}%`.padStart(11);
    const b = `${m.botRate}%`.padStart(8);
    const d = `${m.drawRate}%`.padStart(6);
    const r = `${m.avgRounds}`.padStart(7);
    const u = `${m.avgBotUlts}`.padStart(8);
    console.log(`${name} | ${p} | ${b} | ${d} | ${r} | ${u}`);
  });
  console.log(`========================================================================\n`);

  return { vsEasy, vsHard, vsInsane };
}

if (require.main === module) {
  runAllBalanceSimulations();
}

module.exports = {
  simulateGame,
  runTournamentMatchup,
  runAllBalanceSimulations
};
