// shared/casino_rules.js — Grand Starlight Casino: pure deterministic math (no I/O, no Math.random).
// Mode 2A Royal Pok-Deng (Screen 12) + Mode 2B Zeus Lightning Roulette (Screen 13).
// The server (server/casino_service.js) owns timing, wallets and persistence; this module only computes.
//
// Economy model (all amounts in 🪙 gold):
//   • A bet is ESCROWED (deducted) when placed.
//   • Settlement returns `returned` (credited back, already includes the stake on win/push) and, for Pok-Deng
//     losses against a Deng hand, `extraLoss` (additional deduction, the service clamps it to the wallet).
//   • House edge comes from a small commission on Pok-Deng profit and from roulette multipliers below fair odds.
//     Both are tunable constants; tests/casino.test.js measures RTP by Monte-Carlo so tuning stays honest.

export const CASINO = Object.freeze({
  CHIPS: Object.freeze([500, 1000, 5000, 10000]),
  POKDENG: Object.freeze({
    CHIPS: Object.freeze([500, 1000, 5000, 10000]),
    PHASE_MS: Object.freeze({ betting: 8000, deal: 2500, action: 8000, dealer: 4500 }),   // 23 s hand cycle
    MAX_BET: 50000,
    COMMISSION: 0.05,          // 5% of PROFIT on a win (house edge; Cheer offsets it)
    CHEER_COST_PCT: 0.05,      // 🥂 Cheer costs 5% of the bet (min CHEER_MIN) …
    CHEER_MIN: 10,
    CHEER_BONUS_PCT: 0.05,     // … and pays +5% of profit on a win …
    CHEER_CHEST_BONUS: 0.05,   // … and +5% Sunken Dupe Chest chance
    CHEST_BASE: 0.10,          // post-hand Sunken Dupe Chest chance
    CHEST_MIN_BET: 500,        // anti-farm: chest only rolls on bets ≥ 500
    CHEST_DAILY_CAP: 5,        // anti-farm: max chests per UTC day per player
    DEALER_HIT_MAX: 4,         // dealer hits on 0–4, stands on 5–9
  }),
  ROULETTE: Object.freeze({
    PHASE_MS: Object.freeze({ betting: 15000, spin: 5500, result: 4500 }),              // 25 s spin cycle
    MAX_BET_PER_SPOT: 5000,
    MAX_TOTAL_BET: 25000,
    MAX_SPOTS: 20,
    PAYOUT: Object.freeze({ straight: 30, dozen: 3, column: 3, red: 2, black: 2, even: 2, odd: 2, low: 2, high: 2 }), // TOTAL return × stake
    STRIKE_COUNT_W: Object.freeze([[1, 50], [2, 35], [3, 15]]),                          // weights (%)
    STRIKE_MULT_W: Object.freeze([[50, 50], [100, 30], [200, 15], [500, 5]]),
    CHEER_BANNER_MIN_MULT: 100,                                                          // 100×+ → global_cheer_banner
  }),
});

// ------------------------------------------------------------------------------------------------ RNG
/** mulberry32 — returns a () => [0,1) generator. Same seed ⇒ same sequence on server and tests. */
export function makeRng(seed) {
  let a = (seed >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pickWeighted = (rng, table) => {
  const total = table.reduce((s, [, w]) => s + w, 0);
  let r = rng() * total;
  for (const [v, w] of table) { if ((r -= w) < 0) return v; }
  return table[table.length - 1][0];
};

// ------------------------------------------------------------------------------------------- POK-DENG
// Card = { r: 1..13 (A..K), s: 0..3 (♠♥♦♣) }
export const SUITS = Object.freeze(['♠', '♥', '♦', '♣']);
export const RANKS = Object.freeze(['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']);
export const cardLabel = (c) => `${RANKS[c.r]}${SUITS[c.s]}`;

/** Fresh 52-card shoe, Fisher-Yates shuffled (reshuffled every hand). */
export function newShoe(rng) {
  const shoe = [];
  for (let s = 0; s < 4; s++) for (let r = 1; r <= 13; r++) shoe.push({ r, s });
  for (let i = shoe.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shoe[i], shoe[j]] = [shoe[j], shoe[i]];
  }
  return shoe;
}

export const cardPoint = (c) => (c.r >= 10 ? 0 : c.r);                       // A=1, 2..9 face, 10/J/Q/K = 0
export const handPoints = (cards) => cards.reduce((s, c) => s + cardPoint(c), 0) % 10;
export const isPok = (cards) => cards.length === 2 && handPoints(cards) >= 8;  // Pok 8 / Pok 9 (2 cards only)

function isStraight3(cards) {
  if (cards.length !== 3) return false;
  const r = cards.map((c) => c.r).sort((a, b) => a - b);
  if (r[1] === r[0] + 1 && r[2] === r[1] + 1) return true;
  return r[0] === 1 && r[1] === 12 && r[2] === 13;                               // Q-K-A
}

/** Deng multiplier: 1× normal · 2× 2-card flush/pair · 3× 3-card flush/straight/3 face · 5× 3-of-a-kind. */
export function dengMult(cards) {
  if (cards.length === 2) return (cards[0].s === cards[1].s || cards[0].r === cards[1].r) ? 2 : 1;
  if (cards.length === 3) {
    const [a, b, c] = cards;
    if (a.r === b.r && b.r === c.r) return 5;
    if ((a.s === b.s && b.s === c.s) || isStraight3(cards) || cards.every((x) => x.r >= 11)) return 3;
  }
  return 1;
}

export function handInfo(cards) {
  const pts = handPoints(cards);
  const pok = isPok(cards);
  const mult = dengMult(cards);
  return { points: pts, pok, mult, label: pok ? `Pok ${pts}` : `${pts} pts`, deng: mult > 1 ? `${mult} Deng` : '' };
}

export const dealerShouldHit = (cards) => cards.length === 2 && !isPok(cards) && handPoints(cards) <= CASINO.POKDENG.DEALER_HIT_MAX;
export const playerMayHit = (cards) => cards.length === 2 && !isPok(cards);

/** +1 player wins, -1 dealer wins, 0 push. Pok beats non-Pok; Pok 9 > Pok 8; otherwise higher points. */
export function comparePokDeng(player, dealer) {
  const p = handInfo(player), d = handInfo(dealer);
  if (p.pok || d.pok) {
    if (p.pok && !d.pok) return 1;
    if (d.pok && !p.pok) return -1;
  }
  return p.points > d.points ? 1 : p.points < d.points ? -1 : 0;
}

export const cheerCost = (bet) => Math.max(CASINO.POKDENG.CHEER_MIN, Math.round(bet * CASINO.POKDENG.CHEER_COST_PCT));

export function validPokDengBet(bet) {
  return Number.isInteger(bet) && bet >= 100 && bet <= CASINO.POKDENG.MAX_BET;
}

/**
 * Settle one seat vs the dealer. `bet` was already escrowed (cheer cost is charged separately, never refunded).
 * @returns {{ outcome:'win'|'lose'|'push', returned:number, extraLoss:number, profit:number, mult:number, dealerMult:number }}
 */
export function settlePokDeng(playerCards, dealerCards, bet, { cheer = false } = {}) {
  const P = CASINO.POKDENG;
  const cmp = comparePokDeng(playerCards, dealerCards);
  const mult = dengMult(playerCards), dealerMult = dengMult(dealerCards);
  if (cmp > 0) {
    const gross = bet * mult;
    const profit = Math.floor(gross * (1 - P.COMMISSION)) + (cheer ? Math.floor(gross * P.CHEER_BONUS_PCT) : 0);
    return { outcome: 'win', returned: bet + profit, extraLoss: 0, profit, mult, dealerMult };
  }
  if (cmp < 0) {
    const extraLoss = bet * (dealerMult - 1);                                     // loser pays the dealer's Deng
    return { outcome: 'lose', returned: 0, extraLoss, profit: -(bet + extraLoss), mult, dealerMult };
  }
  return { outcome: 'push', returned: bet, extraLoss: 0, profit: 0, mult, dealerMult };
}

/** Sunken Dupe Chest chance after a settled hand (service enforces the daily cap). */
export function chestChance(bet, { cheer = false } = {}) {
  const P = CASINO.POKDENG;
  if (bet < P.CHEST_MIN_BET) return 0;
  return P.CHEST_BASE + (cheer ? P.CHEER_CHEST_BONUS : 0);
}

/**
 * Run a whole hand deterministically (used by the service and by tests).
 * seats: [{ seat, bet, cheer, decide?: (cards, info) => 'hit'|'stay' }]  — decide defaults to a simple bot.
 * Returns { dealer:{cards,info}, seats:[{ seat, cards, info, action, settle }] }.
 */
export const botPokDengDecision = (cards) => (handPoints(cards) <= 3 ? 'hit' : 'stay');

export function playPokDengHand(seed, seats) {
  const rng = makeRng(seed);
  const shoe = newShoe(rng);
  const draw = () => shoe.pop();
  const hands = seats.map((s) => ({ ...s, cards: [draw(), draw()] }));
  const dealer = [draw(), draw()];
  for (const h of hands) {
    h.action = 'stay';
    if (playerMayHit(h.cards)) {
      h.action = (h.decide || botPokDengDecision)(h.cards, handInfo(h.cards)) === 'hit' ? 'hit' : 'stay';
      if (h.action === 'hit') h.cards.push(draw());
    }
  }
  if (dealerShouldHit(dealer)) dealer.push(draw());
  return {
    dealer: { cards: dealer, info: handInfo(dealer) },
    seats: hands.map((h) => ({ seat: h.seat, cards: h.cards, info: handInfo(h.cards), action: h.action, settle: settlePokDeng(h.cards, dealer, h.bet, { cheer: !!h.cheer }) })),
  };
}

// ------------------------------------------------------------------------------------- ZEUS ROULETTE
export const RED = Object.freeze(new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]));
export const colorOf = (n) => (n === 0 ? 'green' : RED.has(n) ? 'red' : 'black');
export const ROULETTE_BET_TYPES = Object.freeze(['straight', 'dozen', 'column', 'red', 'black', 'even', 'odd', 'low', 'high']);

/** Bet = { type, n? (straight 0–36 | dozen 1–3 | column 1–3), amount }. */
export function betWins(bet, n) {
  switch (bet.type) {
    case 'straight': return bet.n === n;
    case 'dozen': return n > 0 && Math.ceil(n / 12) === bet.n;
    case 'column': return n > 0 && ((n - 1) % 3) + 1 === bet.n;
    case 'red': return colorOf(n) === 'red';
    case 'black': return colorOf(n) === 'black';
    case 'even': return n > 0 && n % 2 === 0;
    case 'odd': return n % 2 === 1;
    case 'low': return n >= 1 && n <= 18;
    case 'high': return n >= 19 && n <= 36;
    default: return false;
  }
}

/** Normalises + validates a bet list. Returns { ok, bets, total } or { ok:false, error }. Same spot+type merges. */
export function validateRouletteBets(raw) {
  const R = CASINO.ROULETTE;
  if (!Array.isArray(raw) || !raw.length) return { ok: false, error: 'no_bets' };
  const merged = new Map();
  for (const b of raw) {
    const type = String(b?.type || '');
    if (!ROULETTE_BET_TYPES.includes(type)) return { ok: false, error: 'bad_type' };
    const amount = Number(b.amount);
    if (!Number.isInteger(amount) || amount <= 0) return { ok: false, error: 'bad_amount' };
    let n = null;
    if (type === 'straight') { n = Number(b.n); if (!Number.isInteger(n) || n < 0 || n > 36) return { ok: false, error: 'bad_number' }; }
    if (type === 'dozen' || type === 'column') { n = Number(b.n); if (![1, 2, 3].includes(n)) return { ok: false, error: 'bad_number' }; }
    const key = `${type}:${n ?? ''}`;
    const prev = merged.get(key);
    merged.set(key, { type, ...(n != null ? { n } : {}), amount: (prev?.amount || 0) + amount });
  }
  const bets = [...merged.values()];
  if (bets.length > R.MAX_SPOTS) return { ok: false, error: 'too_many_spots' };
  if (bets.some((b) => b.amount > R.MAX_BET_PER_SPOT)) return { ok: false, error: 'spot_limit' };
  const total = bets.reduce((s, b) => s + b.amount, 0);
  if (total > R.MAX_TOTAL_BET) return { ok: false, error: 'total_limit' };
  return { ok: true, bets, total };
}

/** Spin + Zeus Lightning for one round (deterministic from seed). strikes: [{ n, mult }] with distinct n. */
export function spinRoulette(seed) {
  const R = CASINO.ROULETTE;
  const rng = makeRng(seed);
  const number = Math.floor(rng() * 37);
  const count = pickWeighted(rng, R.STRIKE_COUNT_W);
  const strikes = [];
  while (strikes.length < count) {
    const n = Math.floor(rng() * 37);
    if (strikes.some((s) => s.n === n)) continue;
    strikes.push({ n, mult: pickWeighted(rng, R.STRIKE_MULT_W) });
  }
  return { number, color: colorOf(number), strikes };
}

/**
 * Settle a player's (validated) bets against a spin. Lightning only boosts STRAIGHT-UP bets on a struck number.
 * @returns {{ total, returned, profit, wins:[{type,n,amount,mult,lightning}], bigHit:{n,mult}|null }}
 */
export function settleRoulette(bets, spin) {
  const R = CASINO.ROULETTE;
  let total = 0, returned = 0, bigHit = null;
  const wins = [];
  for (const b of bets) {
    total += b.amount;
    if (!betWins(b, spin.number)) continue;
    let mult = R.PAYOUT[b.type];
    let lightning = false;
    if (b.type === 'straight') {
      const strike = spin.strikes.find((s) => s.n === b.n);
      if (strike) { mult = strike.mult; lightning = true; }
    }
    returned += b.amount * mult;
    wins.push({ type: b.type, ...(b.n != null ? { n: b.n } : {}), amount: b.amount, mult, lightning });
    if (lightning && mult >= R.CHEER_BANNER_MIN_MULT && (!bigHit || mult > bigHit.mult)) bigHit = { n: b.n, mult };
  }
  return { total, returned, profit: returned - total, wins, bigHit };
}
