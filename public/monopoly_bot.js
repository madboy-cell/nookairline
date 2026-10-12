/**
 * 🐱✈️ Nook Airline — Sky Monopoly Solo Bot Brain ("Captain Whiskers & Apex Sovereign")
 * Provides decision heuristics for Easy, Hard, and Insane bot modes.
 *
 * Difficulty Rules:
 *  - Easy ("Trainee Mochi 🐾"): Carefree, casual, cute mistakes, zero skills & zero ultimates.
 *  - Hard ("Capt. Whiskers 😼"): Calculative, strategic zone builder, defensive shields, zero skills & zero ultimates.
 *  - Insane ("Apex Sovereign ⚡"): God-tier AI, maximum mathematical decision-making, randomly assigned
 *                                 a Mythic costume identity with full signature skills and ultimate ability!
 *
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
  // 1. ALL 32 MYTHIC COSTUME IDENTITIES (Seasons 1 - 11)
  // =========================================================
  const ALL_MYTHIC_IDS = [
    // Season 1: Bangkok River Royalty
    's1_naga_m', 's1_kinnaree_f',
    // Season 2: Tokyo Sakura & Kitsune
    's2_inari_m', 's2_inari_f', 's2_celestial_m', 's2_celestial_f',
    // Season 3: Dubai Desert Mirage
    's3_djinn_m', 's3_djinn_f', 's3_phoenix_m', 's3_phoenix_f',
    // Season 4: Monte Carlo Casino Royale
    's4_royale_m', 's4_royale_f', 's4_roulette_m', 's4_roulette_f',
    // Season 5: Atlantis Bioluminescent Abyss
    's5_emperor_m', 's5_siren_f', 's5_leviathan_m', 's5_jellyfish_f',
    // Season 6: Starlight Odyssey
    's6_supernova_m', 's6_supernova_f', 's6_aegis_m', 's6_aegis_f',
    // Season 7: Enchanted Fairytales & Royal Crowns
    's7_sundrop_m', 's7_sundrop_f', 's7_cinderella_m', 's7_cinderella_f', 's7_belle_m', 's7_belle_f',
    // Season 8: Nordic Permafrost & Glacial Royalty
    's8_warden_m', 's8_empress_f',
    // Season 9: Egyptian Gilded Nile & Solar Divinity
    's9_pharaoh_m', 's9_cleopatra_f', 's9_ra_m', 's9_sekhmet_f',
    // Season 10: Venetian Phantom Masquerade
    's10_phantom_m', 's10_phantom_f',
    // Season 11: Mount Olympus Divinity
    's11_zeus_m', 's11_athena_f'
  ];

  function getRandomMythicId(rng = Math.random) {
    return ALL_MYTHIC_IDS[Math.floor(rng() * ALL_MYTHIC_IDS.length)];
  }

  // =========================================================
  // 2. CASH RESERVE HEURISTIC
  // =========================================================
  function calculateReserve(state, botRole, level = 'hard') {
    if (level === 'easy') {
      return 25; // Carefree, playful, minimal reserve
    }
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
    const shieldDiscount = hasShield ? 0.35 : (level === 'insane' ? 0.95 : 0.85);
    const round = state.round || 1;
    const baseMin = level === 'insane' ? (round <= 8 ? 70 : 120) : (round <= 10 ? 50 : 90);
    return Math.max(baseMin, Math.round(maxRentAhead * shieldDiscount));
  }

  // =========================================================
  // 3. TACTICAL ULTIMATE ACTIVATION (Strictly Insane Mode Only)
  // =========================================================
  function shouldUseUltimate(state, botRole, rng = Math.random) {
    const p = state.players && state.players[botRole];
    if (!p) return false;
    // CRITICAL REQUIREMENT: Easy and Hard bots MUST NOT be able to use skill and ultimate!
    if (p.botLevel !== 'insane') return false;
    if ((p.ult || 0) < 100) return false;

    // Insane Bot Maximum Decision on Ultimate Timing:
    const costumeId = String(p.costume || p.activeCostume || '').toLowerCase();
    const oppRoles = Object.keys(state.players || {}).filter((r) => r !== botRole && !state.players[r]?.bankrupt);
    const richestOpp = oppRoles.reduce((best, r) => (!best || (state.players[r]?.miles || 0) > (state.players[best]?.miles || 0)) ? r : best, oppRoles[0]);
    const maxOppMiles = richestOpp && state.players[richestOpp] ? state.players[richestOpp].miles : 0;
    const myMiles = p.miles || 0;

    // A. Siphon & Extort Ultimates (Absolute Zero, Nile Seduction, Olympus Wrath, Supernova Tithe):
    const isSiphon = costumeId.includes('warden') || costumeId.includes('empress') ||
                     costumeId.includes('cleopatra') || costumeId.includes('pharaoh') ||
                     costumeId.includes('zeus') || costumeId.includes('athena') ||
                     costumeId.includes('aegis') || costumeId.includes('astral') ||
                     costumeId.includes('supernova');
    if (isSiphon) {
      if (maxOppMiles >= 220 || myMiles < 350) return true;
    }

    // B. Demolition & Disruption Ultimates (Beast, Cinderella, Solar Wrath, Phoenix):
    const isDestruction = costumeId.includes('belle') || costumeId.includes('beast') ||
                          costumeId.includes('cinderella') || costumeId.includes('clockwork') ||
                          costumeId.includes('ra') || costumeId.includes('sekhmet');
    if (isDestruction) {
      const oppHasHotels = Object.keys(state.properties || {}).some((id) => {
        const prop = state.properties[id];
        return prop && prop.owner !== botRole && prop.level >= 2 && !state.players[prop.owner]?.bankrupt;
      });
      if (oppHasHotels || myMiles < 250) return true;
    }

    // C. Cash Surge / Monopoly Rent Buff (Monaco, Naga, Djinn, Sundrop Lantern):
    const isBuff = costumeId.includes('monaco') || costumeId.includes('roulette') ||
                   costumeId.includes('naga') || costumeId.includes('djinn') ||
                   costumeId.includes('sundrop') || costumeId.includes('rapunzel');
    if (isBuff) {
      const myPropCount = ownedTileIds(state, botRole).length;
      if (myPropCount >= 2 || myMiles < 300) return true;
    }

    // Fallback: Unleash to apply relentless momentum
    return true;
  }

  // =========================================================
  // 4. PRE-ROLL ITEM USAGE
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

    // --- EASY MODE: Casual, playful, cute mistakes ---
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

    // --- HARD MODE: Calculative & strategic, STRICTLY NO SKILLS OR ULTIMATES ---
    if (level === 'hard') {
      // Priority 1: 💣 C4 — demolish opponent hotels or level-2 houses
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
            score += 350; // Lap bonus
            if ((state.mekongHoard || 0) >= 50) {
              score += Math.min(800, state.mekongHoard * 2.5);
            }
          } else if (t.type === 'property') {
            const prop = state.properties && state.properties[tId];
            if (!prop) {
              const zt = zoneTiles(t.zone);
              const botOwnedInZone = zt.filter((z) => state.properties[z.id] && state.properties[z.id].owner === botRole).length;
              if (botOwnedInZone === zt.length - 1) score += 950; // Completes zone!
              else if (botOwnedInZone > 0) score += 500;
              else score += 280;
              if (p.miles < t.price) score -= 300;
            } else if (prop.owner === botRole) {
              if (prop.level < 3 && p.miles >= upgradeCost(t)) {
                if (ownsZone(state, botRole, t.zone)) score += 550;
                else score += 320;
              }
            } else {
              const rent = getTileRent(state, tId);
              score -= (rent * 3.5);
            }
          } else if (t.type === 'airdrop') {
            score += 260;
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

      // Priority 5: 🍌 Banana Peel — plant behind if rival is trailing
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

    // --- INSANE MODE: Peak Mathematical Optimization & Lethal Tactical Combos ---
    if (level === 'insane') {
      // 1. C4 Demolition: Destroy opponent's biggest rent engine or monopoly
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

      // 2. Swap Portal: Mathematical safety & trap analysis
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
        if (botDanger >= 150 || (oppDanger >= 200 && botDanger < oppDanger)) {
          return { useItem: 'swap' };
        }
      }

      // 3. Magnet: Optimal siphon threshold
      if (inv.includes('magnet') && oppPlayer) {
        if (oppPlayer.miles >= 320 || (oppPlayer.miles >= 200 && oppPlayer.miles > p.miles)) {
          return { useItem: 'magnet' };
        }
      }

      // 4. Golden Dice: Deep 6-tile forward trajectory optimization
      if (inv.includes('golden_dice')) {
        let bestV = null;
        let bestScore = -Infinity;

        for (let v = 1; v <= 6; v++) {
          const tId = (pos + v) % 20;
          const t = MONOPOLY_TILES[tId];
          let score = 0;

          if (tId === 0) {
            score += 450;
            if ((state.mekongHoard || 0) >= 40) {
              score += Math.min(1000, state.mekongHoard * 3);
            }
          } else if (t.type === 'property') {
            const prop = state.properties && state.properties[tId];
            if (!prop) {
              const zt = zoneTiles(t.zone);
              const botCount = zt.filter((z) => state.properties[z.id] && state.properties[z.id].owner === botRole).length;
              if (botCount === zt.length - 1) score += 1200; // Complete zone monopoly!
              else if (botCount > 0) score += 650;
              else score += 400;
              if (p.miles < t.price) score -= 400;
            } else if (prop.owner === botRole) {
              if (prop.level < 3 && p.miles >= upgradeCost(t)) {
                if (ownsZone(state, botRole, t.zone)) score += 750;
                else score += 450;
              }
            } else {
              const rent = getTileRent(state, tId);
              score -= (rent * 4.5);
            }
          } else if (t.type === 'airdrop') {
            score += 280;
          } else if (t.type === 'market') {
            score += 200;
          } else if (t.type === 'arena') {
            score += 180;
          }

          if (score > bestScore) {
            bestScore = score;
            bestV = v;
          }
        }

        if (bestV && bestScore >= 150) {
          return { useItem: 'golden_dice', value: bestV };
        }
      }

      // 5. Banana Peel: Plant trap right before bot's hotels
      if (inv.includes('banana')) {
        const someoneApproachingHotel = oppRoles.some((r) => {
          const oppPos = state.players[r]?.pos || 0;
          const dist = (pos - oppPos + 20) % 20;
          return dist >= 1 && dist <= 6;
        });
        if (someoneApproachingHotel || rng() < 0.45) {
          return { useItem: 'banana' };
        }
      }
    }

    return null;
  }

  // =========================================================
  // 5. DECISION ENGINE (Buy, Upgrade, Rent, Casino, Market, Arena)
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

        // INSANE: Ruthless Monopoly Mastery & Territory Denial
        if (level === 'insane') {
          if (completesBotZone) return { act: 'buy' }; // Always complete own monopoly
          if (blocksOppZone) return { act: 'buy' }; // Always block rival monopoly
          if (botCount > 0 && p.miles >= cost + 15) return { act: 'buy' };
          if ((state.round || 1) <= 16 && p.miles >= cost + 20) return { act: 'buy' };
          if (p.miles >= cost + 25) return { act: 'buy' };
          return { act: 'pass' };
        }

        // HARD: Strategic, assertive acquisition
        if (completesBotZone) {
          if (p.miles >= cost + 15) return { act: 'buy' };
        }
        if (blocksOppZone) {
          if (p.miles >= cost + 25) return { act: 'buy' };
        }
        if (botCount > 0) {
          if (p.miles >= cost + 30) return { act: 'buy' };
        }
        if ((state.round || 1) <= 16) {
          if (p.miles >= cost + 35) return { act: 'buy' };
        }
        if ((state.round || 1) >= 18 && tile.price <= 160 && botCount === 0 && oppCount === 0) {
          return { act: 'pass' };
        }
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

        const isCompletedZone = ownsZone(state, botRole, tile.zone);
        const prop = state.properties[tile.id];

        // INSANE: Aggressive Hotel Rush
        if (level === 'insane') {
          if (isCompletedZone) return { act: 'build' }; // Hotels in monopoly = lethal rent!
          if (prop && prop.level === 1 && p.miles >= cost + 20) return { act: 'build' };
          if (p.miles - cost >= 30) return { act: 'build' };
          return { act: 'skip' };
        }

        // HARD: build up strong revenue bases
        const reserve = calculateReserve(state, botRole, level);
        if (isCompletedZone) {
          return { act: 'build' };
        }
        if (prop && prop.level === 1) {
          if (p.miles >= cost + 30) return { act: 'build' };
        }
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

        // INSANE: Optimum Expected Value & Ruthless Takeover
        if (level === 'insane') {
          if (hasShield && (isHotel || rent >= 160 || rent >= p.miles * 0.25)) {
            return { act: 'shield' };
          }
          if (canClash && (rent >= 65 || rent >= p.miles * 0.15)) {
            return { act: 'clash' };
          }
          if (canTakeover) {
            const zt = zoneTiles(tile.zone);
            const botInZone = zt.filter((t) => state.properties[t.id] && state.properties[t.id].owner === botRole).length;
            const ownerInZone = zt.filter((t) => state.properties[t.id] && state.properties[t.id].owner === prop.owner).length;
            const completesBot = botInZone === zt.length - 1;
            const breaksOppZone = ownerInZone === zt.length;
            const safeToLose = p.miles >= value + loseCost + 30;
            if (safeToLose && (completesBot || breaksOppZone || prop.level >= 2)) {
              return { act: 'takeover' };
            }
          }
          return { act: 'pay' };
        }

        // HARD
        if (hasShield) {
          if (isHotel || rent >= 180 || rent >= p.miles * 0.30) {
            return { act: 'shield' };
          }
        }
        if (canClash && (rent >= 80 || rent >= p.miles * 0.20)) {
          return { act: 'clash' };
        }
        if (canTakeover) {
          const zt = zoneTiles(tile.zone);
          const botInZone = zt.filter((t) => state.properties[t.id] && state.properties[t.id].owner === botRole).length;
          const ownerInZone = zt.filter((t) => state.properties[t.id] && state.properties[t.id].owner === prop.owner).length;
          const completesBot = botInZone === zt.length - 1;
          const breaksOppZone = ownerInZone === zt.length;
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

        // INSANE: Only gambles if wealth is dominant
        if (level === 'insane') {
          const reserve = calculateReserve(state, botRole, level);
          if (p.miles >= reserve + 350) return { act: 'spin' };
          return { act: 'leave' };
        }

        // HARD: only gamble with disposable surplus cash
        const reserve = calculateReserve(state, botRole, level);
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

        const priority = ['golden_dice', 'shield', 'c4', 'magnet', 'swap'];

        // EASY
        if (level === 'easy') {
          if (rng() < 0.40) return { act: 'leave' };
          const affordable = offers.filter((id) => p.miles >= marketPrice(state, botRole, id));
          if (!affordable.length) return { act: 'leave' };
          const pick = affordable[Math.floor(rng() * affordable.length)];
          return { act: 'buyItem', itemId: pick };
        }

        // INSANE: Deny critical items to the human player
        if (level === 'insane') {
          const candidates = offers
            .filter((id) => p.miles >= marketPrice(state, botRole, id) + 20)
            .sort((a, b) => priority.indexOf(a) - priority.indexOf(b));

          if (candidates.length > 0) {
            return { act: 'buyItem', itemId: candidates[0] };
          }
          return { act: 'leave' };
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

        // EASY: pick random target
        if (level === 'easy') {
          const chosen = targets[Math.floor(rng() * targets.length)];
          return { act: 'challenge', targetTileId: chosen };
        }

        // HARD & INSANE: strategic target ranking
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
  // 6. PERSONALITY & QUOTES
  // =========================================================
  function personality(level = 'hard') {
    if (level === 'insane') {
      return {
        name: 'Apex Sovereign ⚡',
        sprite: 'assets/bot_captain.jpg',
        badge: 'INSANE',
        color: '#a855f7',
        quotes: {
          buy: [
            'Domain secured. The celestial ledger expands ⚡🏛️',
            'A divine conquest. Your airspace diminishes 🌌',
            'Mortals build houses; sovereigns build empires 👑'
          ],
          upgrade: [
            'Celestial Citadel constructed! Tremble before the invoice ⚡🏨',
            'Maximum prestige unlocked. First class belongs to the heavens ✨',
            'Upgraded to god-tier luxury. Rent is non-negotiable 💸'
          ],
          pass: [
            'A tactical pause. Your temporary solace will be brief ⚡',
            'Conserving treasury for the decisive strike 🪐'
          ],
          rent_pay: [
            'A token tithe from my vast treasury. Savor it while you can ⚡🪙',
            'Paid. But the universe balances all debts soon enough 🔥'
          ],
          rent_shield: [
            'DIVINE AEGIS! Your petty toll is obliterated 🛡️⚡',
            'Celestial Shield deployed! Not a single coin for you 🛡️✨'
          ],
          takeover: [
            'SOVEREIGN ANNEXATION! Step aside, the throne is mine! ⚔️⚡',
            'Yield your territory to the higher order! ⚔️👑'
          ],
          c4: [
            'Orbital strike initiated! Your luxury collapses into rubble! 💣💥',
            'Demolition decree enforced! Back to ruins! 💣⚡'
          ],
          magnet: [
            'Cosmic gravity well! Siphoning your treasury into my vault! 🧲🌌',
            'Gravitational pull: your wealth now belongs to the heavens! 🧲🪙'
          ],
          swap: [
            'Dimensional rift! Witness your complete displacement! 🌀🪐',
            'Seat swap protocol executed. Welcome to your doom! 🌀⚡'
          ],
          golden_dice: [
            'Precision celestial vectors! Landing exactly as destined! 🎲✨',
            'Fate is not random; it is calculated! 🎲⚡'
          ],
          win: [
            'FLAWLESS CELESTIAL VICTORY! The airline domain is eternally mine! 👑⚡🏛️',
            'Mortals play games; sovereigns dictate the skies! 🏆🌌'
          ],
          lose: [
            'Impossible anomaly! A disturbance in the celestial matrix! ⚡🌪️',
            'A commendable resistance… you have earned my respect! 👑'
          ]
        }
      };
    }

    const isHard = level === 'hard';
    return {
      name: isHard ? 'Captain Whiskers 😈✈️' : 'Captain Whiskers 🐱✈️',
      sprite: isHard ? 'assets/bot_captain.jpg' : 'assets/bot_mochi.jpg',
      badge: isHard ? 'WHISKERS' : 'MOCHI',
      color: isHard ? '#f59e0b' : '#10b981',
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
    ALL_MYTHIC_IDS,
    getRandomMythicId,
    calculateReserve,
    shouldUseUltimate,
    preRoll,
    decide,
    personality,
    randomQuote
  };
});
