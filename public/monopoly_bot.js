/**
 * 🐱✈️ Nook Airline — Sky Monopoly Solo Bot Brain ("Captain Whiskers")
 * Provides decision heuristics for Easy and Hard bot modes.
 * Shared between the browser client and the headless simulator.
 * UMD pattern: window.NookMonoBot or module.exports
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const rules = require('./monopoly_rules.js');
    module.exports = factory(rules);
  } else {
    root.NookMonoBot = factory(root.NookMonoRules);
  }
})(typeof self !== 'undefined' ? self : this, function (Rules) {
  'use strict';

  if (!Rules && typeof window !== 'undefined' && window.NookMonoRules) {
    Rules = window.NookMonoRules;
  }

  const {
    MONO_CFG,
    MONOPOLY_TILES,
    ZONES,
    ITEMS,
    upgradeCost,
    propValue,
    ownedTileIds,
    zoneTiles,
    ownsZone,
    getTileRent,
    marketPrice
  } = Rules;

  // =========================================================
  // 1. CASH RESERVE HEURISTIC (Used in Hard mode)
  // =========================================================
  function calculateReserve(state, botRole) {
    const p = state.players[botRole];
    const pos = p ? p.pos : 0;
    let maxRentAhead = 0;

    // Check danger in the next 2..12 tiles
    for (let step = 2; step <= 12; step++) {
      const tileId = (pos + step) % 20;
      const prop = state.properties && state.properties[tileId];
      if (prop && prop.owner && prop.owner !== botRole) {
        const rent = getTileRent(state, tileId);
        if (rent > maxRentAhead) maxRentAhead = rent;
      }
    }

    const hasShield = (p && p.inventory ? p.inventory : []).includes('shield');
    // If bot has a shield, it has a guaranteed escape card for 1 big hit
    const shieldDiscount = hasShield ? 0.35 : 0.85;
    const round = state.round || 1;
    const baseMin = round <= 10 ? 50 : 90;
    return Math.max(baseMin, Math.round(maxRentAhead * shieldDiscount));
  }

  // =========================================================
  // 2. PRE-ROLL ITEM USAGE
  // =========================================================
  function preRoll(state, botRole, level = 'hard', rng = Math.random) {
    const p = state.players[botRole];
    if (!p) return null;
    const inv = p.inventory || [];
    if (!inv.length) return null;
    const oppRoles = Object.keys(state.players || {}).filter((r) => r !== botRole && !state.players[r]?.bankrupt);
    const richestOppRole = oppRoles.reduce((best, r) => (!best || (state.players[r]?.miles || 0) > (state.players[best]?.miles || 0)) ? r : best, oppRoles[0]);
    const oppPlayer = state.players[richestOppRole];
    const pos = p.pos;

    // --- EASY MODE ---
    if (level === 'easy') {
      // 50% of the time, easy bot keeps it simple and doesn't use items
      if (rng() < 0.5) return null;

      if (inv.includes('magnet') && oppPlayer && oppPlayer.miles >= 450) {
        return { useItem: 'magnet' };
      }
      if (inv.includes('golden_dice')) {
        // Pick a roll that lands on something fun (start or unowned tile)
        for (let v = 6; v >= 1; v--) {
          const tId = (pos + v) % 20;
          const t = MONOPOLY_TILES[tId];
          if (tId === 0 || (t.type === 'property' && (!state.properties || !state.properties[tId]))) {
            return { useItem: 'golden_dice', value: v };
          }
        }
      }
      if (inv.includes('c4')) {
        const targets = Object.keys(state.properties || {})
          .filter((id) => {
            const prop = state.properties[id];
            return prop && prop.owner !== botRole && !state.players[prop.owner]?.bankrupt && prop.level >= 2;
          })
          .map(Number);
        if (targets.length) {
          return { useItem: 'c4', tileId: targets[Math.floor(rng() * targets.length)] };
        }
      }
      if (inv.includes('banana') && rng() < 0.4) {
        return { useItem: 'banana' };
      }
      return null;
    }

    // --- HARD MODE ---
    // Priority 1: 💣 C4 — demolish opponent hotels or level-2 houses across all rivals
    if (inv.includes('c4')) {
      const oppProps = Object.keys(state.properties || {})
        .filter((id) => {
          const prop = state.properties[id];
          return prop && prop.owner !== botRole && !state.players[prop.owner]?.bankrupt && prop.level >= 2;
        })
        .map(Number)
        .sort((a, b) => getTileRent(state, b) - getTileRent(state, a));

      if (oppProps.length > 0) {
        return { useItem: 'c4', tileId: oppProps[0] };
      }
    }

    // Priority 2: 🧲 Magnet — steal when richest rival has a thick wallet
    if (inv.includes('magnet') && oppPlayer) {
      if (oppPlayer.miles >= 400 || (oppPlayer.miles >= 250 && oppPlayer.miles > p.miles)) {
        return { useItem: 'magnet' };
      }
    }

    // Priority 3: 🌀 Swap Portal — escape imminent hotel death or send opponent into ours
    if (inv.includes('swap') && oppPlayer) {
      let botDanger = 0;
      let oppDanger = 0;
      for (let s = 1; s <= 6; s++) {
        const bTarget = (pos + s) % 20;
        const oTarget = (oppPlayer.pos + s) % 20;
        if (state.properties[bTarget] && state.properties[bTarget].owner !== botRole && !state.players[state.properties[bTarget].owner]?.bankrupt) {
          botDanger = Math.max(botDanger, getTileRent(state, bTarget));
        }
        if (state.properties[oTarget] && state.properties[oTarget].owner === botRole) {
          oppDanger = Math.max(oppDanger, getTileRent(state, oTarget));
        }
      }

      // If bot faces significant danger or opponent is approaching bot's big rent
      if (botDanger >= 180 || (oppDanger >= 250 && botDanger < oppDanger)) {
        return { useItem: 'swap' };
      }
    }

    // Priority 4: 🎲 Golden Dice — precision strike
    if (inv.includes('golden_dice')) {
      let bestV = null;
      let bestScore = -Infinity;

      for (let v = 1; v <= 6; v++) {
        const tId = (pos + v) % 20;
        const t = MONOPOLY_TILES[tId];
        let score = 0;

        if (tId === 0) {
          score += 350; // Collect lap bonus!
          if ((state.mekongHoard || 0) >= 50) {
            score += Math.min(800, state.mekongHoard * 2.5); // Snipe Mekong Hoard!
          }
        } else if (t.type === 'property') {
          const prop = state.properties && state.properties[tId];
          if (!prop) {
            // Unowned tile: check if it completes or progresses a zone
            const zt = zoneTiles(t.zone);
            const botOwnedInZone = zt.filter((z) => state.properties[z.id] && state.properties[z.id].owner === botRole).length;
            if (botOwnedInZone === zt.length - 1) score += 950; // Completes zone!
            else if (botOwnedInZone > 0) score += 500;
            else score += 280;
            if (p.miles < t.price) score -= 300; // Can't afford
          } else if (prop.owner === botRole) {
            if (prop.level < 3 && p.miles >= upgradeCost(t)) {
              if (ownsZone(state, botRole, t.zone)) score += 550;
              else score += 320;
            }
          } else {
            // Opponent tile: danger!
            const rent = getTileRent(state, tId);
            score -= (rent * 3.5);
          }
        } else if (t.type === 'airdrop') {
          score += 260;
        } else if (t.type === 'casino') {
          score += 20;
        } else if (t.type === 'market' || t.type === 'arena') {
          score += 90;
        }

        if (score > bestScore) {
          bestScore = score;
          bestV = v;
        }
      }

      if (bestV && bestScore >= 120) {
        return { useItem: 'golden_dice', value: bestV };
      }
    }

    // Priority 5: 🍌 Banana Peel — plant behind if rival is trailing within 6 tiles
    if (inv.includes('banana')) {
      const someoneBehind = oppRoles.some((r) => {
        const dist = (pos - (state.players[r]?.pos || 0) + 20) % 20;
        return dist >= 1 && dist <= 6;
      });
      if (someoneBehind || rng() < 0.35) {
        return { useItem: 'banana' };
      }
    }

    return null;
  }

  // =========================================================
  // 3. DECISION ENGINE (Buy, Upgrade, Rent, Casino, Market, Arena)
  // =========================================================
  function decide(state, botRole, decision, level = 'hard', rng = Math.random) {
    if (!decision || !decision.type) return { act: 'pass' };
    const p = state.players[botRole];
    if (!p) return { act: 'pass' };

    switch (decision.type) {
      // -----------------------------------------------------
      // BUY PROPERTY
      // -----------------------------------------------------
      case 'buy': {
        const tile = MONOPOLY_TILES[decision.tileId];
        if (!tile || tile.type !== 'property') return { act: 'pass' };
        const cost = tile.price;
        if (p.miles < cost) return { act: 'pass' };

        // EASY: friendly, playful, cute mistakes
        if (level === 'easy') {
          // 35% cute mistake pass ("saving miles for fish snacks!")
          if (rng() < 0.35) return { act: 'pass', reason: 'cute_mistake' };
          return { act: 'buy' };
        }

        // HARD: strategic, assertive acquisition
        const reserve = calculateReserve(state, botRole);
        const zt = zoneTiles(tile.zone);
        const botCount = zt.filter((t) => state.properties[t.id] && state.properties[t.id].owner === botRole).length;
        const oppRoles = Object.keys(state.players || {}).filter((r) => r !== botRole);
        let blocksOppZone = false;
        let oppCount = 0;
        oppRoles.forEach((r) => {
          const c = zt.filter((t) => state.properties[t.id] && state.properties[t.id].owner === r).length;
          if (c > oppCount) oppCount = c;
          if (c === zt.length - 1) blocksOppZone = true;
        });
        const completesBotZone = botCount === zt.length - 1;

        // Completing our own zone is absolute top priority
        if (completesBotZone) {
          if (p.miles >= cost + 15) return { act: 'buy' };
        }

        // Blocking opponent zone is very high priority
        if (blocksOppZone) {
          if (p.miles >= cost + 25) return { act: 'buy' };
        }

        // Second tile in a zone where we have a presence
        if (botCount > 0) {
          if (p.miles >= cost + 30) return { act: 'buy' };
        }

        // Early and mid game (rounds 1..16): land grab is crucial
        if ((state.round || 1) <= 16) {
          if (p.miles >= cost + 35) return { act: 'buy' };
        }

        // Late game (round >= 18): avoid buying cheap isolated properties that waste cash
        if ((state.round || 1) >= 18 && tile.price <= 160 && botCount === 0 && oppCount === 0) {
          return { act: 'pass' };
        }

        // Standard buy: keep safe cash reserve
        if (p.miles >= cost + 30) {
          return { act: 'buy' };
        }
        return { act: 'pass' };
      }

      // -----------------------------------------------------
      // UPGRADE PROPERTY
      // -----------------------------------------------------
      case 'upgrade': {
        const tile = MONOPOLY_TILES[decision.tileId];
        if (!tile || tile.type !== 'property') return { act: 'skip' };
        const cost = upgradeCost(tile);
        if (p.miles < cost) return { act: 'skip' };

        // EASY: 75% chance to skip upgrade ("saving miles for fish treats!")
        if (level === 'easy') {
          if (rng() < 0.75) return { act: 'skip', reason: 'cute_skip' };
          return { act: 'build' };
        }

        // HARD: build up strong revenue bases
        const reserve = calculateReserve(state, botRole);
        const prop = state.properties[tile.id];
        const isCompletedZone = ownsZone(state, botRole, tile.zone);
        const nextIsHotel = prop && prop.level === 2;

        // Upgrades in completed zones are priority #1
        if (isCompletedZone) {
          return { act: 'build' };
        }

        // Level 1 -> Level 2 doubles rent, very high ROI even in uncompleted zone
        if (prop && prop.level === 1) {
          if (p.miles >= cost + 30) return { act: 'build' };
        }

        // Hotel in partial zone
        if (p.miles - cost >= Math.round(reserve * 0.4)) {
          return { act: 'build' };
        }
        return { act: 'skip' };
      }

      // -----------------------------------------------------
      // RENT CHOICE (Pay / Shield / Hostile Takeover / Cocktail Clash)
      // -----------------------------------------------------
      case 'rent': {
        const tile = MONOPOLY_TILES[decision.tileId];
        const prop = state.properties[decision.tileId];
        if (!tile || !prop) return { act: 'pay' };
        const rent = getTileRent(state, tile.id);
        const isHotel = prop.level >= 3;
        const hasShield = (p.inventory || []).includes('shield');
        const value = propValue(state, tile.id);
        const canTakeover = !isHotel && p.miles >= value;
        const loseCost = Math.round(rent * MONO_CFG.TAKEOVER_LOSE_MULT);
        const tokens = p.clashTokens != null ? p.clashTokens : (p.vibePasses || 0);
        const canClash = !isHotel && tokens > 0;

        // EASY
        if (level === 'easy') {
          if (canClash && rent >= 50 && rng() < 0.50) return { act: 'clash' };
          if (hasShield && rng() < 0.20) return { act: 'shield' };
          if (canTakeover && rng() < 0.08) return { act: 'takeover' };
          return { act: 'pay' };
        }

        // HARD
        // 1. Rent Shield priority: use on hotels, high rents (>= 180), or when rent > 30% of cash
        if (hasShield) {
          if (isHotel || rent >= 180 || rent >= p.miles * 0.30) {
            return { act: 'shield' };
          }
        }

        // 2. Cocktail Clash priority: if rent >= 80 or >= 20% of cash, take the Double-or-Nothing showdown!
        if (canClash && (rent >= 80 || rent >= p.miles * 0.20)) {
          return { act: 'clash' };
        }

        // 3. Hostile takeover: check if strategically valuable and affordable
        if (canTakeover) {
          const zt = zoneTiles(tile.zone);
          const botInZone = zt.filter((t) => state.properties[t.id] && state.properties[t.id].owner === botRole).length;
          const ownerInZone = zt.filter((t) => state.properties[t.id] && state.properties[t.id].owner === prop.owner).length;
          const completesBot = botInZone === zt.length - 1;
          const breaksOppZone = ownerInZone === zt.length;

          // Safe to lose check (accounting for Monaco loaded dice danger)
          const ownerPerks = (state.perks && state.perks[prop.owner]) || {};
          const isMonacoOwner = !!(ownerPerks.duelMinRoll || ownerPerks.loadedDice);
          const buffer = isMonacoOwner ? 160 : 50;

          const safeToLose = p.miles >= value + loseCost + buffer;
          if (safeToLose && (completesBot || breaksOppZone || prop.level >= 2)) {
            return { act: 'takeover' };
          }
        }

        return { act: 'pay' };
      }

      // -----------------------------------------------------
      // SKY CASINO
      // -----------------------------------------------------
      case 'casino': {
        if (decision.phase === 'result') return { act: 'continue' };
        const bet = MONO_CFG.CASINO_BET;
        if (p.miles < bet) return { act: 'leave' };

        // EASY: loves pulling the slot lever!
        if (level === 'easy') {
          return rng() < 0.75 ? { act: 'spin' } : { act: 'leave' };
        }

        // HARD: only gamble with disposable surplus cash
        const reserve = calculateReserve(state, botRole);
        if (p.miles >= reserve + 300) {
          return { act: 'spin' };
        }
        return { act: 'leave' };
      }

      // -----------------------------------------------------
      // BLACK MARKET
      // -----------------------------------------------------
      case 'market': {
        const offers = decision.offers || [];
        const full = (p.inventory || []).length >= MONO_CFG.MAX_ITEMS;
        if (full || !offers.length) return { act: 'leave' };

        // Item priority preference
        const priority = ['shield', 'golden_dice', 'c4', 'magnet', 'swap'];

        // EASY
        if (level === 'easy') {
          if (rng() < 0.40) return { act: 'leave' };
          const affordable = offers.filter((id) => p.miles >= marketPrice(state, botRole, id));
          if (!affordable.length) return { act: 'leave' };
          const pick = affordable[Math.floor(rng() * affordable.length)];
          return { act: 'buyItem', itemId: pick };
        }

        // HARD
        const candidates = offers
          .filter((id) => p.miles >= marketPrice(state, botRole, id) + 40)
          .sort((a, b) => priority.indexOf(a) - priority.indexOf(b));

        if (candidates.length > 0) {
          return { act: 'buyItem', itemId: candidates[0] };
        }
        return { act: 'leave' };
      }

      // -----------------------------------------------------
      // TAKEOVER ARENA
      // -----------------------------------------------------
      case 'arena': {
        const oppTiles = Object.keys(state.properties || {})
          .map(Number)
          .filter((id) => {
            const prop = state.properties[id];
            return prop && prop.owner !== botRole && !state.players[prop.owner]?.bankrupt;
          });

        const targets = oppTiles.filter((id) => {
          const prop = state.properties[id];
          const isHotel = prop.level >= 3 || prop.hotel;
          return isHotel || p.miles >= propValue(state, id);
        });
        if (!targets.length) return { act: 'leave' };

        // EASY: pick random target (hotels or properties)
        if (level === 'easy') {
          const chosen = targets[Math.floor(rng() * targets.length)];
          return { act: 'challenge', targetTileId: chosen };
        }

        // HARD: strategic target ranking (Hotel raids first for free loot, then completes bot zone > breaks opp zone > highest rent)
        targets.sort((a, b) => {
          const propA = state.properties[a];
          const propB = state.properties[b];
          const aHotel = (propA.level >= 3 || propA.hotel) ? 1 : 0;
          const bHotel = (propB.level >= 3 || propB.hotel) ? 1 : 0;
          if (aHotel !== bHotel) return bHotel - aHotel;
          const tA = MONOPOLY_TILES[a];
          const tB = MONOPOLY_TILES[b];
          const ztA = zoneTiles(tA.zone);
          const ztB = zoneTiles(tB.zone);
          const botA = ztA.filter((t) => state.properties[t.id] && state.properties[t.id].owner === botRole).length;
          const botB = ztB.filter((t) => state.properties[t.id] && state.properties[t.id].owner === botRole).length;
          const completesA = botA === ztA.length - 1 ? 1 : 0;
          const completesB = botB === ztB.length - 1 ? 1 : 0;
          if (completesA !== completesB) return completesB - completesA;
          return getTileRent(state, b) - getTileRent(state, a);
        });

        return { act: 'challenge', targetTileId: targets[0] };
      }

      default:
        return { act: 'pass' };
    }
  }

  // =========================================================
  // 4. PERSONALITY & QUOTES
  // =========================================================
  function personality(level = 'hard') {
    const isHard = level === 'hard';
    return {
      name: isHard ? 'Captain Whiskers 😈✈️' : 'Captain Whiskers 🐱✈️',
      sprite: 'assets/cats/m_captain.png',
      badge: 'BOT',
      color: isHard ? '#f59e0b' : '#38bdf8',
      quotes: {
        buy: isHard
          ? ['Prime real estate secured! 😼💼', 'Dubai Marina is mine! Luxury flights coming up ✈️💎', 'Building my airline empire! 🏰']
          : ['Ooh, this looks like a comfy spot to nap! 🐾', 'Purrr! Added a new stop to my route! 🧶', 'I love this neighborhood! 🌸'],
        upgrade: isHard
          ? ['Grand Hotel upgrade! Luxury rates now in effect 🏨💸', 'Five-star suites installed! Enjoy the bill~ 😼', 'Double houses! Rent multiplied! 🏠🏠']
          : ['Fluffing the cushions and adding cat trees! 🐱', 'More cozy rooms for everyone! ✨', 'Upgraded with extra treats! 🐟'],
        pass: isHard
          ? ['Passing. Keeping my war chest locked and loaded 💼', 'Not worth the miles. A captain knows when to save 😼']
          : ['Hmm, I like the other spot better~ 😸', 'Saving my miles for snacks! 🐟'],
        rent_pay: isHard
          ? ['A minor fee for safe passage. Watch your back! 😼💸', 'Take your rent. The game is far from over! 🔥']
          : ['Here you go! Treat yourself to something nice~ 🪙', 'Purr, fair and square! Thanks for hosting me! 💖'],
        rent_shield: isHard
          ? ['DENIED! Rent Shield deployed. You get zero coins! 🛡️😼', 'Shielded! Did you really think I’d pay that hotel? 🛡️✨']
          : ['Rent Shield! Safe and sound! 🛡️🐾', 'Shield activated! Saved by the bell! 🛡️💖'],
        takeover: isHard
          ? ['HOSTILE TAKEOVER! Hand over the keys! ⚔️🔥', 'Time to seize control! May the highest die win! ⚔️']
          : ['Ooh can I challenge for this one please? ⚔️🐾', 'Friendly duel time! Good luck! ⚔️✨'],
        c4: ['Fire in the hole! Down comes your hotel! 💣💥', 'Demolition crew arrived! Back to 1 house! 💣😼'],
        magnet: ['Siphoning your flight miles! Sluuuuurp! 🧲🪙', 'Magnetic pull! 25% of your wallet is mine! 🧲✨'],
        swap: ['Surprise! Switching seats in first class! 🌀✈️', 'Portal jump! Look where you are now! 🌀😼'],
        golden_dice: ['Loaded golden dice! Precision flight path engaged! 🎲✨', 'A captain always lands where he intends! 🎲😼'],
        win: isHard
          ? ['First Class Champion! Better luck next flight! 🏆😼👑', 'Flawless flight calculations! Victory is mine! ✈️🎉']
          : ['Purrrrr! What a fun game, friend! 💞🐾', 'Good game! That was super fun! 💖'],
        lose: isHard
          ? ['Impossible! Turbulence in my calculations! 😾🌪️', 'Well played… you really out-flew me this time! 👑✈️']
          : ['Aww you won! You’re amazing at this! 💖🎉', 'Purr, congratulations! Best pilot in the sky! 🐾✨']
      }
    };
  }

  function randomQuote(level, category) {
    const p = personality(level);
    const list = p.quotes[category] || p.quotes.buy;
    return list[Math.floor(Math.random() * list.length)];
  }

  return {
    calculateReserve,
    preRoll,
    decide,
    personality,
    randomQuote
  };
});
