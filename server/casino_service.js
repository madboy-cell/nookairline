// server/casino_service.js — Grand Starlight Casino adapter for Table Hub.
// Manages Pok-Deng and Zeus Lightning Roulette state machines, timers, wallets, and broadcasts.
import {
  CASINO,
  makeRng,
  newShoe,
  handInfo,
  dealerShouldHit,
  playerMayHit,
  isPok,
  cheerCost,
  validPokDengBet,
  settlePokDeng,
  chestChance,
  botPokDengDecision,
  validateRouletteBets,
  spinRoulette,
  settleRoulette,
} from '../shared/casino_rules.js';
import {
  executeCasinoMaterialExchange,
  validateCasinoMaterialExchange,
  CASINO_MATERIAL_EXCHANGES,
  CASINO_MATERIAL_WEEKLY_CAP,
  getIsoWeek,
} from '../shared/minigame_rewards.js';

export {
  executeCasinoMaterialExchange,
  validateCasinoMaterialExchange,
  CASINO_MATERIAL_EXCHANGES,
  CASINO_MATERIAL_WEEKLY_CAP,
  getIsoWeek,
};

const dayKey = (t) => new Date(t).toISOString().slice(0, 10);

function ensureCasinoDaily(p, tNow) {
  const day = dayKey(tNow);
  if (!p.casino_daily || p.casino_daily.day !== day) {
    p.casino_daily = { day, chests: 0, net: 0, hands: 0 };
  }
  return p.casino_daily;
}

/**
 * Creates the casino adapter injected into TableManager.
 * @param {object} opts
 * @param {object} opts.db                   database (getProfile, markProfile)
 * @param {(userIds, msg) => void} opts.send sends msg to list of userIds
 * @param {(t) => string[]} opts.humans      returns list of seated human userIds
 * @param {() => number} [opts.rng]          [0, 1) random source
 * @param {() => number} [opts.now]          timestamp source
 * @param {(p) => void} [opts.pushProfile]   push profile to client
 * @param {(hit) => void} [opts.onBigHit]    called on roulette bigHit (>= 100x)
 * @param {(p) => void} [opts.onHandSettled] called once per settled human hand
 */
export function createCasinoAdapter({
  db,
  send,
  humans,
  rng = Math.random,
  now = Date.now,
  pushProfile = () => {},
  onBigHit = () => {},
  onHandSettled = () => {},
}) {
  const getNow = () => (typeof now === 'function' ? now() : Date.now());

  const getHumans = (t) => (humans ? humans(t) : t.seats.filter((s) => s.kind === 'human' && s.userId).map((s) => s.userId));

  const sendMsg = (target, msg) => {
    if (!send) return;
    const uids = Array.isArray(target) ? target : [target];
    if (uids.length) send(uids, msg);
  };

  const sendError = (t, userId, error) => {
    sendMsg(userId, { type: 'casino_error', tableId: t.id, error });
    return { ok: false, error };
  };

  function initPokDengSeats(t) {
    return t.seats.map((s, idx) => {
      const isBot = s.kind === 'bot';
      const isHuman = s.kind === 'human';
      const p = isHuman && s.userId ? db.getProfile(s.userId) : null;
      const gold = p ? (p.gold || 0) : (isBot ? 10000 : 0);
      return {
        seat: idx,
        userId: isHuman ? s.userId : null,
        name: s.name || (isBot ? `Bot ${idx}` : null),
        isBot,
        bet: 0,
        cheer: false,
        cards: null,
        info: null,
        action: null,
        settle: null,
        gold,
      };
    });
  }

  function initRouletteSeats(t) {
    return t.seats.map((s, idx) => {
      const isBot = s.kind === 'bot';
      const isHuman = s.kind === 'human';
      const p = isHuman && s.userId ? db.getProfile(s.userId) : null;
      const gold = p ? (p.gold || 0) : (isBot ? 10000 : 0);
      return {
        seat: idx,
        userId: isHuman ? s.userId : null,
        name: s.name || (isBot ? `Bot ${idx}` : null),
        isBot,
        bets: [],
        totalBet: 0,
        gold,
      };
    });
  }

  function buildCasinoState(t) {
    const c = t.casino;
    const nowMs = getNow();
    const state = {
      type: 'casino_state',
      tableId: t.id,
      game: c.game,
      phase: c.phase,
      phaseEndsAt: c.phaseEndsAt,
      serverNow: nowMs,
      round: c.round,
      seats: c.seats.map((s) => {
        if (s.userId) {
          const p = db.getProfile(s.userId);
          if (p) s.gold = p.gold || 0;
        }
        return { ...s };
      }),
    };

    if (c.game === 'pokdeng') {
      if (c.dealerCards) {
        if (c.phase === 'deal' || c.phase === 'action') {
          // 2nd dealer card is hidden until dealer phase
          state.dealer = {
            cards: [c.dealerCards[0], { hidden: true }],
            info: null,
          };
        } else if (c.phase === 'dealer') {
          state.dealer = {
            cards: c.dealerCards,
            info: handInfo(c.dealerCards),
          };
        }
      } else {
        state.dealer = null;
      }
    } else if (c.game === 'roulette') {
      state.history = c.history || [];
      if (c.phase === 'spin' && c.spin) {
        state.strikes = c.spin.strikes;
        state.spinNumber = c.spin.number;
      } else if (c.phase === 'result' && c.spin) {
        state.strikes = c.spin.strikes;
        state.number = c.spin.number;
        state.color = c.spin.color;
      }
    }

    if (c.lastResult) {
      state.lastResult = c.lastResult;
    }

    return state;
  }

  function broadcastState(t) {
    const h = getHumans(t);
    if (!h.length) return;
    const state = buildCasinoState(t);
    sendMsg(h, state);
  }

  function sendStateTo(t, userId) {
    const state = buildCasinoState(t);
    sendMsg(userId, state);
  }

  // ------------------------------------------------------------------ POK-DENG PHASES
  function startPokDengRound(t) {
    const c = t.casino;
    c.phase = 'betting';
    c.phaseEndsAt = getNow() + CASINO.POKDENG.PHASE_MS.betting;
    c.shoe = null;
    c.dealerCards = null;
    c.dealerDrawCard = null;
    c.coupleCredited = new Set();
    c.seats = initPokDengSeats(t);

    for (const s of c.seats) {
      if (s.isBot) {
        s.bet = CASINO.CHIPS[Math.floor(rng() * 3)];
        s.cheer = false;
      }
    }
    broadcastState(t);
  }

  function enterPokDengDeal(t) {
    const c = t.casino;
    c.phase = 'deal';
    c.phaseEndsAt = getNow() + CASINO.POKDENG.PHASE_MS.deal;
    const seed = (rng() * 2 ** 31) >>> 0;
    c.seed = seed;
    c.shoe = newShoe(makeRng(seed));
    c.dealerDrawCard = null;

    // Charge cheer for seats with bet > 0
    for (const s of c.seats) {
      if (s.bet > 0 && s.cheer) {
        const cost = cheerCost(s.bet);
        if (s.userId) {
          const p = db.getProfile(s.userId);
          if (p && (p.gold || 0) >= cost) {
            p.gold -= cost;
            s.gold = p.gold;
            db.markProfile(p.id);
            pushProfile(p);
          } else {
            s.cheer = false;
          }
        }
      }
    }

    // Deal 2 cards to each seat with bet > 0
    for (const s of c.seats) {
      if (s.bet > 0) {
        s.cards = [c.shoe.pop(), c.shoe.pop()];
        s.info = handInfo(s.cards);
        s.action = isPok(s.cards) ? 'stay' : null;
      } else {
        s.cards = null;
        s.info = null;
        s.action = null;
      }
    }

    // Dealer gets 2 cards
    c.dealerCards = [c.shoe.pop(), c.shoe.pop()];
    broadcastState(t);
  }

  function enterPokDengAction(t) {
    const c = t.casino;
    c.phase = 'action';
    c.phaseEndsAt = getNow() + CASINO.POKDENG.PHASE_MS.action;

    for (const s of c.seats) {
      if (s.isBot && s.bet > 0 && s.cards && !isPok(s.cards)) {
        const dec = botPokDengDecision(s.cards);
        s.action = dec;
        if (dec === 'hit') {
          s.cards.push(c.shoe.pop());
          s.info = handInfo(s.cards);
        }
      }
    }
    broadcastState(t);
  }

  function resolveDealerFinalCards(c) {
    if (!c.dealerCards) return null;
    if (c.dealerCards.length >= 3) return c.dealerCards;
    if (c.phase === 'deal' && c.seats && c.shoe) {
      for (const s of c.seats) {
        if (s.isBot && s.bet > 0 && s.cards && !isPok(s.cards) && s.action == null) {
          const dec = botPokDengDecision(s.cards);
          s.action = dec;
          if (dec === 'hit' && c.shoe.length > 0) {
            s.cards.push(c.shoe.pop());
            s.info = handInfo(s.cards);
          }
        }
      }
    }
    if (dealerShouldHit(c.dealerCards)) {
      if (!c.dealerDrawCard && c.shoe && c.shoe.length > 0) {
        c.dealerDrawCard = c.shoe.pop();
      }
      if (c.dealerDrawCard) {
        return [...c.dealerCards, c.dealerDrawCard];
      }
    }
    return [...c.dealerCards];
  }

  function settlePokDengSeat(t, s, dealerCards, tNow) {
    if (s.settled) return s.settleResult || null;
    const settle = settlePokDeng(s.cards, dealerCards, s.bet, { cheer: !!s.cheer });
    s.settle = settle;
    s.settled = true;
    let chestWon = false;

    if (s.userId) {
      const p = db.getProfile(s.userId);
      if (p) {
        const daily = ensureCasinoDaily(p, tNow);
        if (settle.returned > 0) {
          p.gold = (p.gold || 0) + settle.returned;
        }
        if (settle.extraLoss > 0) {
          const actualLoss = Math.min(settle.extraLoss, p.gold || 0);
          p.gold = (p.gold || 0) - actualLoss;
        }
        daily.net += settle.profit;
        daily.hands += 1;

        const chance = chestChance(s.bet, { cheer: !!s.cheer });
        if (chance > 0 && daily.chests < CASINO.POKDENG.CHEST_DAILY_CAP) {
          if (rng() < chance) {
            chestWon = true;
            daily.chests += 1;
            p.bag_items = { ...(p.bag_items || {}), random_dupe_box: (p.bag_items?.random_dupe_box || 0) + 1 };
          }
        }
        s.gold = p.gold;
        const partnerId = p.partner_id || null;
        if (!t.casino.coupleCredited) t.casino.coupleCredited = new Set();
        const hasPartnerInHand = Boolean(
          partnerId &&
          (t.casino.seats?.some((q) => q && !q.isBot && q.userId === partnerId) ||
            t.seats?.some((q) => q && q.kind === 'human' && q.userId === partnerId))
        );
        let withPartner = false;
        if (hasPartnerInHand && !t.casino.coupleCredited.has(p.id)) {
          t.casino.coupleCredited.add(p.id);
          t.casino.coupleCredited.add(partnerId);
          withPartner = true;
        }
        onHandSettled(p, withPartner ? { withPartner: true } : undefined);
        db.markProfile(p.id);
        pushProfile(p);
      }
    }
    const item = { seat: s.seat, cards: s.cards, info: s.info || (s.cards ? handInfo(s.cards) : null), settle, chest: chestWon };
    s.settleResult = item;
    return item;
  }

  function enterPokDengDealer(t) {
    const c = t.casino;
    c.phase = 'dealer';
    c.phaseEndsAt = getNow() + CASINO.POKDENG.PHASE_MS.dealer;

    for (const s of c.seats) {
      if (s.bet > 0 && s.cards && s.action == null) {
        s.action = 'stay';
      }
    }

    if (dealerShouldHit(c.dealerCards) && c.dealerCards.length === 2) {
      const card = c.dealerDrawCard || (c.shoe && c.shoe.length > 0 ? c.shoe.pop() : null);
      if (card) c.dealerCards.push(card);
      c.dealerDrawCard = null;
    }
    const dealerInfo = handInfo(c.dealerCards);

    const resultSeats = [];
    const tNow = getNow();
    for (const s of c.seats) {
      if (s.bet > 0 && s.cards && !s.settled) {
        const item = settlePokDengSeat(t, s, c.dealerCards, tNow);
        resultSeats.push(item);
      }
    }

    const resultMsg = {
      type: 'casino_result',
      tableId: t.id,
      game: 'pokdeng',
      round: c.round,
      dealer: { cards: c.dealerCards, info: dealerInfo },
      seats: resultSeats,
    };
    c.lastResult = resultMsg;

    broadcastState(t);
    sendMsg(getHumans(t), resultMsg);
  }

  // ------------------------------------------------------------------ ROULETTE PHASES
  function startRouletteRound(t) {
    const c = t.casino;
    c.phase = 'betting';
    c.phaseEndsAt = getNow() + CASINO.ROULETTE.PHASE_MS.betting;
    c.spin = null;
    c.coupleCredited = new Set();
    c.seats = initRouletteSeats(t);

    const outsideTypes = ['red', 'black', 'even', 'odd'];
    for (const s of c.seats) {
      if (s.isBot) {
        const numBets = rng() < 0.5 ? 1 : 2;
        const rawBets = [];
        for (let k = 0; k < numBets; k++) {
          const type = outsideTypes[Math.floor(rng() * outsideTypes.length)];
          rawBets.push({ type, amount: CASINO.CHIPS[0] });
        }
        const v = validateRouletteBets(rawBets);
        if (v.ok) {
          s.bets = v.bets;
          s.totalBet = v.total;
        }
      }
    }
    broadcastState(t);
  }

  function enterRouletteSpin(t) {
    const c = t.casino;
    c.phase = 'spin';
    c.phaseEndsAt = getNow() + CASINO.ROULETTE.PHASE_MS.spin;
    const seed = (rng() * 2 ** 31) >>> 0;
    c.seed = seed;
    c.spin = spinRoulette(seed);
    broadcastState(t);
  }

  function settleRouletteSeat(t, s, spin, tNow) {
    if (s.settled) return s.settleResult || null;
    const res = settleRoulette(s.bets, spin);
    s.settle = res;
    s.settled = true;

    if (s.userId) {
      const p = db.getProfile(s.userId);
      if (p) {
        const daily = ensureCasinoDaily(p, tNow);
        if (res.returned > 0) {
          p.gold = (p.gold || 0) + res.returned;
        }
        daily.net += res.profit;
        daily.hands += 1;
        s.gold = p.gold;
        const partnerId = p.partner_id || null;
        if (!t.casino.coupleCredited) t.casino.coupleCredited = new Set();
        const hasPartnerInHand = Boolean(
          partnerId &&
          (t.casino.seats?.some((q) => q && !q.isBot && q.userId === partnerId) ||
            t.seats?.some((q) => q && q.kind === 'human' && q.userId === partnerId))
        );
        let withPartner = false;
        if (hasPartnerInHand && !t.casino.coupleCredited.has(p.id)) {
          t.casino.coupleCredited.add(p.id);
          t.casino.coupleCredited.add(partnerId);
          withPartner = true;
        }
        onHandSettled(p, withPartner ? { withPartner: true } : undefined);
        db.markProfile(p.id);
        pushProfile(p);

        if (res.bigHit) {
          onBigHit({
            winnerId: s.userId,
            winnerName: s.name || s.userId,
            mult: res.bigHit.mult,
            number: spin.number,
          });
        }
      }
    }
    const item = {
      seat: s.seat,
      total: res.total,
      returned: res.returned,
      profit: res.profit,
      wins: res.wins,
      bigHit: res.bigHit,
    };
    s.settleResult = item;
    return item;
  }

  function enterRouletteResult(t) {
    const c = t.casino;
    c.phase = 'result';
    c.phaseEndsAt = getNow() + CASINO.ROULETTE.PHASE_MS.result;
    const spin = c.spin;

    if (!c.history) c.history = [];
    c.history.push({ number: spin.number, color: spin.color, strikes: spin.strikes });
    if (c.history.length > 12) c.history = c.history.slice(-12);

    const resultSeats = [];
    const tNow = getNow();
    for (const s of c.seats) {
      if (s.bets && s.bets.length > 0 && !s.settled) {
        const item = settleRouletteSeat(t, s, spin, tNow);
        resultSeats.push(item);
      }
    }

    const resultMsg = {
      type: 'casino_result',
      tableId: t.id,
      game: 'roulette',
      round: c.round,
      number: spin.number,
      color: spin.color,
      strikes: spin.strikes,
      seats: resultSeats,
    };
    c.lastResult = resultMsg;

    broadcastState(t);
    sendMsg(getHumans(t), resultMsg);
  }

  return {
    start(t) {
      const game = t.options?.casinoGame === 'roulette' ? 'roulette' : 'pokdeng';
      t.casino = {
        game,
        round: 1,
        phase: 'betting',
        phaseEndsAt: 0,
        seats: [],
        dealerCards: null,
        dealerDrawCard: null,
        shoe: null,
        spin: null,
        history: [],
        lastResult: null,
      };

      if (game === 'roulette') {
        startRouletteRound(t);
      } else {
        startPokDengRound(t);
      }
    },

    tick(t, nowMs) {
      if (!t.casino) return;
      const curNow = nowMs != null ? nowMs : getNow();
      let loops = 0;
      while (curNow >= t.casino.phaseEndsAt && loops < 5) {
        loops++;
        const c = t.casino;
        if (c.game === 'pokdeng') {
          if (c.phase === 'betting') {
            enterPokDengDeal(t);
          } else if (c.phase === 'deal') {
            enterPokDengAction(t);
          } else if (c.phase === 'action') {
            enterPokDengDealer(t);
          } else if (c.phase === 'dealer') {
            if (!getHumans(t).length) break;
            c.round += 1;
            startPokDengRound(t);
          }
        } else if (c.game === 'roulette') {
          if (c.phase === 'betting') {
            enterRouletteSpin(t);
          } else if (c.phase === 'spin') {
            enterRouletteResult(t);
          } else if (c.phase === 'result') {
            if (!getHumans(t).length) break;
            c.round += 1;
            startRouletteRound(t);
          }
        }
      }
    },

    handle(t, userId, m) {
      if (!t.casino) return sendError(t, userId, 'no_casino');
      const c = t.casino;

      if (m.type === 'casino_state') {
        sendStateTo(t, userId);
        return { ok: true };
      }

      // Sky Frontier minigame materials hook (§13)
      if (m.type === 'casino_material_exchange') {
        const p = db.getProfile(userId);
        if (!p) return sendError(t, userId, 'no_profile');
        const res = executeCasinoMaterialExchange(p, m.item, getNow());
        if (!res.ok) {
          sendMsg(userId, { type: 'casino_error', tableId: t?.id, error: res.error });
          return res;
        }
        db.markProfile(p.id);
        pushProfile(p);
        sendMsg(userId, { type: 'casino_material_exchange_result', tableId: t?.id, ...res });
        return res;
      }

      if (c.game === 'pokdeng') {
        if (m.type === 'casino_bet') {
          if (c.phase !== 'betting') return sendError(t, userId, 'wrong_phase');
          const amount = Number(m.amount);
          if (!validPokDengBet(amount)) return sendError(t, userId, 'bad_bet');
          const seat = c.seats.find((s) => s.userId === userId);
          if (!seat) return sendError(t, userId, 'not_seated');
          const p = db.getProfile(userId);
          if (!p) return sendError(t, userId, 'no_profile');
          const prevBet = seat.bet || 0;
          const diff = amount - prevBet;
          if (diff > 0 && (p.gold || 0) < diff) return sendError(t, userId, 'insufficient_gold');
          p.gold = (p.gold || 0) - diff;
          seat.bet = amount;
          seat.gold = p.gold;
          db.markProfile(p.id);
          pushProfile(p);
          if (m.dealNow && c.seats.every((s) => s.isBot || !s.userId || s.bet > 0)) {
            enterPokDengDeal(t);
          } else {
            broadcastState(t);
          }
          return { ok: true, bet: amount };
        }

        if (m.type === 'casino_cheer') {
          if (c.phase !== 'betting') return sendError(t, userId, 'wrong_phase');
          const seat = c.seats.find((s) => s.userId === userId);
          if (!seat) return sendError(t, userId, 'not_seated');
          seat.cheer = !seat.cheer;
          broadcastState(t);
          return { ok: true, cheer: seat.cheer };
        }

        if (m.type === 'casino_hit') {
          if (c.phase !== 'action') return sendError(t, userId, 'wrong_phase');
          const seat = c.seats.find((s) => s.userId === userId);
          if (!seat || !seat.cards) return sendError(t, userId, 'not_seated');
          if (!playerMayHit(seat.cards) || seat.action != null) return sendError(t, userId, 'cannot_hit');
          seat.cards.push(c.shoe.pop());
          seat.info = handInfo(seat.cards);
          seat.action = 'hit';
          broadcastState(t);
          return { ok: true };
        }

        if (m.type === 'casino_stay') {
          if (c.phase !== 'action') return sendError(t, userId, 'wrong_phase');
          const seat = c.seats.find((s) => s.userId === userId);
          if (!seat || !seat.cards) return sendError(t, userId, 'not_seated');
          if (seat.action != null) return sendError(t, userId, 'already_acted');
          seat.action = 'stay';
          broadcastState(t);
          return { ok: true };
        }

        return sendError(t, userId, 'bad_type');
      }

      if (c.game === 'roulette') {
        if (m.type === 'casino_roulette_bets') {
          if (c.phase !== 'betting') return sendError(t, userId, 'wrong_phase');
          const seat = c.seats.find((s) => s.userId === userId);
          if (!seat) return sendError(t, userId, 'not_seated');
          const p = db.getProfile(userId);
          if (!p) return sendError(t, userId, 'no_profile');
          if (Array.isArray(m.bets) && m.bets.length === 0) {
            const prevTotal = seat.totalBet || 0;
            p.gold = (p.gold || 0) + prevTotal;
            seat.bets = [];
            seat.totalBet = 0;
            seat.gold = p.gold;
            if (prevTotal > 0) {
              db.markProfile(p.id);
              pushProfile(p);
            }
            broadcastState(t);
            return { ok: true };
          }
          const v = validateRouletteBets(m.bets);
          if (!v.ok) return sendError(t, userId, v.error);
          const prevTotal = seat.totalBet || 0;
          const diff = v.total - prevTotal;
          if (diff > 0 && (p.gold || 0) < diff) return sendError(t, userId, 'insufficient_gold');
          p.gold = (p.gold || 0) - diff;
          seat.bets = v.bets;
          seat.totalBet = v.total;
          seat.gold = p.gold;
          db.markProfile(p.id);
          pushProfile(p);
          if (m.spin === 'casino_spin_now' && c.seats.every((s) => s.isBot || !s.userId || s.totalBet > 0)) {
            enterRouletteSpin(t);
          } else {
            broadcastState(t);
          }
          return { ok: true, total: v.total, bets: v.bets };
        }

        return sendError(t, userId, 'bad_type');
      }

      return sendError(t, userId, 'bad_game');
    },

    leave(t, userId) {
      if (!t.casino) return;
      const c = t.casino;
      const seat = c.seats?.find((s) => s.userId === userId);
      if (!seat) return;

      if (c.game === 'pokdeng') {
        if (seat.bet > 0) {
          if (c.phase === 'betting' || !seat.cards || !c.dealerCards) {
            const p = db.getProfile(userId);
            if (p) {
              p.gold = (p.gold || 0) + seat.bet;
              db.markProfile(p.id);
              pushProfile(p);
            }
            seat.bet = 0;
            seat.cheer = false;
          } else if (!seat.settled) {
            if (seat.action == null) {
              seat.action = 'stay';
            }
            const otherHumansActive = c.seats.some(
              (s) => s && s.userId !== userId && !s.isBot && s.bet > 0 && !s.settled
            );
            const dealerFinalCards = otherHumansActive
              ? (dealerShouldHit(c.dealerCards)
                  ? [
                      ...c.dealerCards,
                      ...(c.dealerDrawCard
                        ? [c.dealerDrawCard]
                        : c.shoe && c.shoe.length > 0
                          ? [c.shoe[c.shoe.length - 1]]
                          : []),
                    ]
                  : [...c.dealerCards])
              : resolveDealerFinalCards(c);
            const tNow = getNow();
            const item = settlePokDengSeat(t, seat, dealerFinalCards, tNow);
            sendMsg(userId, {
              type: 'casino_result',
              tableId: t.id,
              game: 'pokdeng',
              round: c.round,
              dealer: { cards: dealerFinalCards, info: handInfo(dealerFinalCards) },
              seats: [item],
            });
            seat.bet = 0;
            seat.cheer = false;
            seat.cards = null;
            seat.info = null;
            seat.action = null;
          }
        }
        seat.userId = null;
        seat.name = null;
      } else if (c.game === 'roulette') {
        const hasBets = (seat.totalBet > 0) || (seat.bets && seat.bets.length > 0);
        if (hasBets) {
          if (c.phase === 'betting') {
            const p = db.getProfile(userId);
            if (p) {
              p.gold = (p.gold || 0) + seat.totalBet;
              db.markProfile(p.id);
              pushProfile(p);
            }
            seat.bets = [];
            seat.totalBet = 0;
          } else if (!seat.settled) {
            if (!c.spin) {
              const seed = (rng() * 2 ** 31) >>> 0;
              c.seed = seed;
              c.spin = spinRoulette(seed);
            }
            const tNow = getNow();
            const item = settleRouletteSeat(t, seat, c.spin, tNow);
            sendMsg(userId, {
              type: 'casino_result',
              tableId: t.id,
              game: 'roulette',
              round: c.round,
              number: c.spin.number,
              color: c.spin.color,
              strikes: c.spin.strikes,
              seats: [item],
            });
            seat.bets = [];
            seat.totalBet = 0;
          }
        }
        seat.userId = null;
        seat.name = null;
      }

      const remainingHumans = getHumans(t).filter((id) => id !== userId);
      if (remainingHumans.length) {
        const state = buildCasinoState(t);
        sendMsg(remainingHumans, state);
      }
    },

    onJoin(t, userId, seatIdx = null) {
      if (t.casino) {
        const c = t.casino;
        let seat = c.seats?.find((s) => s.userId === userId);
        if (!seat) {
          const idx = seatIdx ?? t.seats.findIndex((s) => s.userId === userId);
          if (idx >= 0 && c.seats?.[idx]) {
            seat = c.seats[idx];
            const tSeat = t.seats[idx] || {};
            const p = db.getProfile(userId);
            seat.userId = userId;
            seat.name = tSeat.name || p?.username || userId;
            seat.isBot = false;
            seat.gold = p ? (p.gold || 0) : 0;
            if (c.game === 'pokdeng') {
              seat.bet = 0;
              seat.cheer = false;
              seat.cards = null;
              seat.info = null;
              seat.action = null;
            } else if (c.game === 'roulette') {
              seat.bets = [];
              seat.totalBet = 0;
            }
          }
        }
        const allHumans = getHumans(t);
        if (allHumans.length) {
          sendMsg(allHumans, buildCasinoState(t));
          return;
        }
      }
      sendStateTo(t, userId);
    },

    exchangeMaterial(p, item, nowMs = getNow()) {
      return executeCasinoMaterialExchange(p, item, nowMs);
    },
  };
}
