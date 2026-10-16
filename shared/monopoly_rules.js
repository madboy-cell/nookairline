// shared/monopoly_rules.js — 2.5D Sky Monopoly board data + pure math (Implementation Plan §5 Mode 1,
// §14.B PvP soft-cap, §21.L.6 net worth). Shared by the authoritative server engine, bots and the client
// renderer. No I/O, no randomness: everything here is a pure function of its inputs.

import { SEASON_SKILLS } from './season_skills.js';

export const MONO = Object.freeze({
  BOARD_N: 24,
  GRID_COLS: 6,                 // "8×6" perimeter = 24 tiles (Screen 10). Corners must be the 4 corner
  GRID_ROWS: 8,                 // events (0 START, 5 Casino, 12 Vault, 17 Arena) → 6 wide × 8 deep (portrait).
  START_CASH: 2000,
  SALARY: 400,
  START_BOOST: 3,               // ⚡ 2d6 Double-Dice charges at match start
  MAX_ROUNDS: 15,
  TURN_MS: 12000,               // server turn watchdog (§21.E.2)
  RENT_MULT: [0.35, 0.80, 1.60, 3.00, 4.50],   // Tier 0 land → Tier 4 Mythic Sovereign Monument
  UPGRADE_MULT: [0, 0.50, 0.80, 1.20],         // cost to reach Tier 1 / 2 / 3 (Tier 4 = skills only)
  MAX_BUILD_TIER: 3,
  TAKEOVER_MULT: 2.0,           // hostile takeover = 2.0 × total invested value (Tier 0–2 only)
  TAKEOVER_MAX_TIER: 2,
  MONOPOLY_MULT: 1.5,           // full 3-tile colour set
  HOME_TURF_RENT: 0.15,         // home-turf costume: +15% rent …
  HOME_TURF_DISCOUNT: 0.15,     // … and −15% upgrade cost
  ULT_MAX: 100,
  ULT_START: 20,                // pass / land START
  ULT_AIRDROP: 40,
  ULT_PER_TURN: 10,             // tunable: passive charge at the end of each own turn
  ULT_ON_RENT_PAID: 15,         // tunable: "rage" charge when you pay rent
  AIRDROP_CASH: 300,
  START_DIAMONDS: 10,           // 💎 +10 on each START lap pass (up to MAX_START_DIAMOND_LAPS)
  MAX_START_DIAMOND_LAPS: 4,    // max +40 💎 per match from laps
  CASINO_WHEEL: [               // Starlight Mini-Casino (tile 5)
    { p: 0.40, cash: 350, diamonds: 10 },
    { p: 0.40, cash: 600, diamonds: 20 },
    { p: 0.20, cash: 1000, diamonds: 40, jackpot: true },
  ],
  COLOR_SET_DIAMONDS: 25,       // 💎 +25 for completing first 3-tile color monopoly in a match
  ARENA_WIN_DIAMONDS: 15,       // 💎 +15 for winning an Arena duel (up to MAX_ARENA_DIAMOND_WINS)
  MAX_ARENA_DIAMOND_WINS: 2,    // max +30 💎 per match from Arena duels
  VAULT_STEAL: 200,             // 🧲 steal from richest rival
  ARENA_STEAL_PCT: 0.25,        // ⚔️ duel winner steals 25% of loser's cash
  LIQUIDATE_PCT: 0.5,           // forced sale value when a player can't pay
  PHOENIX_REVIVE_CASH: 500,
  COUPLE_SYNERGY: 0.15,         // +15% ultimate effect when the bound partner sits at the table
});

// PvP "Fair-Play Tactical Cap" (§14.B): in-match bonuses are smoothly soft-capped, total ≤ +20%.
export const PVP_CAPS = Object.freeze({
  startCashPct: 0.15,           // 🍀 Fortune
  rentPct: 0.10,                // 🍀 Fortune (rent bonus)
  salaryPct: 0.15,              // ⚡ Swiftness
  ultPct: 0.20,                 // 🔥 Power (ultimate charge speed)
  discountPct: 0.12,            // ✨ Luck (land & upgrade discount)
});
const SOFT_K = 60;              // stat points for ~63% of the cap
export const softCap = (stat, cap) => (stat > 0 ? cap * (1 - Math.exp(-stat / SOFT_K)) : 0);

// Home-turf themes: each zone has ONE fixed theme; each Mythic costume declares ONE `affinity` theme in its
// shared/season_skills.js entry. A new season's costume just picks an existing theme — the board, zones and
// engine never change. A 7th theme only appears with a full board redesign.
export const THEMES = Object.freeze({
  spirit:    { name: 'Spirit',    icon: '⛩️' },
  desert:    { name: 'Desert',    icon: '🏜️' },
  ocean:     { name: 'Ocean',     icon: '🌊' },
  fortune:   { name: 'Fortune',   icon: '🎰' },
  frost:     { name: 'Frost',     icon: '❄️' },
  celestial: { name: 'Celestial', icon: '🌌' },
});

// 6 property zones (§5 table), one theme each.
export const ZONES = Object.freeze({
  kitsune:  { name: 'Kitsune Shrine',  color: '#e0494f', theme: 'spirit' },
  mirage:   { name: 'Mirage Oasis',    color: '#e8b13a', theme: 'desert' },
  atlantis: { name: 'Atlantis Abyss',  color: '#2bb3a8', theme: 'ocean' },
  monte:    { name: 'Monte Carlo',     color: '#8b5bd6', theme: 'fortune' },
  glacial:  { name: 'Glacial Kingdom', color: '#6ec6f0', theme: 'frost' },
  olympus:  { name: 'Astral Olympus',  color: '#c99a1c', theme: 'celestial' },
});

const P = (name, zone, price) => ({ kind: 'property', name, zone, price });
const E = (kind, name, icon) => ({ kind, name, icon });
export const TILES = Object.freeze([
  E('start', 'START', '🛫'),
  P('Shibuya', 'kitsune', 220), P('Akiba', 'kitsune', 240), P('Golden Gai', 'kitsune', 260),
  E('airdrop', 'Airdrop', '🪂'),
  E('casino', 'Mini-Casino', '🎰'),
  P('Dune Bazaar', 'mirage', 280), P('Sultan Palace', 'mirage', 300), P('Cairo', 'mirage', 320),
  P('Santorini', 'atlantis', 340), P('Coral Reef', 'atlantis', 360), P('Siren Bay', 'atlantis', 380),
  E('vault', 'Black Market', '🎒'),
  P('Paris', 'monte', 400), P('Monaco', 'monte', 420), P('Grand Opera', 'monte', 450),
  E('warp', 'Sky Warp', '✈️'),
  E('arena', 'Arena', '⚔️'),
  P('Elsa Palace', 'glacial', 480), P('Glass Castle', 'glacial', 500), P('Aurora', 'glacial', 520),
  P('Starlight Temple', 'olympus', 560), P('Ra Pyramid', 'olympus', 600), P('Olympus', 'olympus', 650),
].map((t, i) => Object.freeze({ i, ...t })));

export const ZONE_TILES = Object.freeze(Object.fromEntries(
  Object.keys(ZONES).map((z) => [z, TILES.filter((t) => t.zone === z).map((t) => t.i)]),
));
export const PROPERTY_IDX = Object.freeze(TILES.filter((t) => t.kind === 'property').map((t) => t.i));

/** Perimeter cell of tile i: START at the bottom-right corner, then left along the bottom (near) edge,
 *  up the left side, right along the far edge and back down the right side (clockwise on screen). */
export function tileCell(i) {
  const C = MONO.GRID_COLS, R = MONO.GRID_ROWS;
  const n = ((i % MONO.BOARD_N) + MONO.BOARD_N) % MONO.BOARD_N;
  if (n < C) return { col: C - 1 - n, row: R - 1 };                    // bottom row, right → left
  if (n < C + R - 2) return { col: 0, row: R - 2 - (n - C) };          // left column, bottom → top
  if (n < 2 * C + R - 2) return { col: n - (C + R - 2), row: 0 };      // top row, left → right
  return { col: C - 1, row: 1 + (n - (2 * C + R - 2)) };               // right column, top → bottom
}
export const isCorner = (i) => [0, MONO.GRID_COLS - 1, MONO.GRID_COLS + MONO.GRID_ROWS - 2, 2 * MONO.GRID_COLS + MONO.GRID_ROWS - 3].includes(i);
/** Board side (0 bottom, 1 left, 2 top, 3 right) — used by the Pharaoh row laser. */
export function tileSide(i) {
  const { col, row } = tileCell(i);
  if (row === MONO.GRID_ROWS - 1) return 0;
  if (col === 0) return 1;
  if (row === 0) return 2;
  return 3;
}

export const wrap = (i) => ((i % MONO.BOARD_N) + MONO.BOARD_N) % MONO.BOARD_N;
/** Signed shortest step count from a to b (positive = forward). */
export function stepsBetween(a, b) {
  let d = wrap(b - a);
  if (d > MONO.BOARD_N / 2) d -= MONO.BOARD_N;
  return d;
}

// ---------------------------------------------------------------------------------- property math
/** Theme a costume is bound to (only Mythics declare one; everything else has no home turf). */
export const affinityFor = (outfitId) => SEASON_SKILLS[outfitId]?.affinity || null;

/** Home turf = the zone's theme equals the costume's single declared affinity. */
export const isHomeTurf = (tile, affinity) => !!(affinity && ZONES[tile.zone]?.theme === affinity);

export function buyCost(tile, mods = {}) {
  return Math.round(tile.price * (1 - (mods.discountPct || 0)));
}

/** Cost to go from `level` to `level + 1` (null when not buildable). */
export function upgradeCost(tile, level, { mods = {}, affinity = null } = {}) {
  if (level >= MONO.MAX_BUILD_TIER) return null;
  let c = tile.price * MONO.UPGRADE_MULT[level + 1];
  c *= 1 - (mods.discountPct || 0);
  if (isHomeTurf(tile, affinity)) c *= 1 - MONO.HOME_TURF_DISCOUNT;
  return Math.round(c);
}

/** Formula value of a tile's buildings (§21.L.6 `UpgradeValue(level)`) — Tier 4 adds no extra cash value. */
export function upgradeValue(tile, level) {
  let v = 0;
  for (let l = 1; l <= Math.min(level, MONO.MAX_BUILD_TIER); l++) v += tile.price * MONO.UPGRADE_MULT[l];
  return Math.round(v);
}
export const investedValue = (tile, level) => tile.price + upgradeValue(tile, level);
export const takeoverCost = (tile, level) => Math.round(MONO.TAKEOVER_MULT * investedValue(tile, level));
export const canTakeover = (level) => level <= MONO.TAKEOVER_MAX_TIER;

export function ownsZone(state, zone, seat) {
  return ZONE_TILES[zone].every((i) => state.tiles[i].owner === seat);
}

/**
 * Rent owed on landing (before shields / reverse traps). `state` = { tiles, players }.
 * Applies tier multiplier, colour monopoly, owner's home turf + capped Fortune rent bonus, and the tile
 * modifier's rentMult (Coral ×1.4 / Sunken ×0 / Midas ×2 / Elsa freeze ×0 / Lightning Rod ×1.5).
 */
export function rentFor(state, i) {
  const t = state.tiles[i], tile = TILES[i];
  if (t.owner == null || tile.kind !== 'property') return 0;
  const owner = state.players[t.owner];
  let r = tile.price * MONO.RENT_MULT[t.level];
  if (ownsZone(state, tile.zone, t.owner)) r *= MONO.MONOPOLY_MULT;
  if (isHomeTurf(tile, owner?.affinity)) r *= 1 + MONO.HOME_TURF_RENT;
  r *= 1 + (owner?.mods?.rentPct || 0);
  if (t.modifier && typeof t.modifier.rentMult === 'number') r *= t.modifier.rentMult;
  return Math.max(0, Math.round(r));
}

export function netWorth(state, seat) {
  const p = state.players[seat];
  if (!p || p.bankrupt) return 0;
  let v = p.cash;
  for (const i of PROPERTY_IDX) if (state.tiles[i].owner === seat) v += investedValue(TILES[i], state.tiles[i].level);
  return Math.round(v);
}

export function ownedTiles(state, seat) {
  return PROPERTY_IDX.filter((i) => state.tiles[i].owner === seat);
}

/** Owner's most valuable tile (highest rent, then highest invested value). */
export function bestTile(state, seat, filter = () => true) {
  let best = null, bestKey = -1;
  for (const i of ownedTiles(state, seat)) {
    if (!filter(i)) continue;
    const key = rentFor(state, i) * 10000 + investedValue(TILES[i], state.tiles[i].level);
    if (key > bestKey) { bestKey = key; best = i; }
  }
  return best;
}

// ---------------------------------------------------------------------------------- player stats
/**
 * Sum of the 4 universal stats from equipped gear (including optional 3D Dice Skin). Catalogs are injected so
 * this module never depends on modules that other teams are refactoring. Unknown items / missing stats count as 0.
 * `all` feeds all 4. Mythic outfits without explicit stats get +25 all (§21.D "+25% Primary Stats").
 */
export function gearStats(equipped = {}, { outfits = {}, accessories = {}, diceSkins = {} } = {}) {
  const out = { fortune: 0, swiftness: 0, power: 0, luck: 0 };
  for (const [slot, e] of Object.entries(equipped || {})) {
    if (!e?.id || slot === 'pet') continue;
    const def = slot === 'outfit' ? outfits[e.id] : slot === 'dice' ? (diceSkins[e.id] || accessories[e.id]) : accessories[e.id];
    if (!def) continue;
    const stats = def.stats || (def.rarity === 3 ? { all: 25 } : def.rarity === 2 ? { all: 12 } : { all: 2 });
    const k = 1 + 0.05 * Math.max(0, Math.min(10, e.refine | 0));   // +5% per Star-Force level
    for (const s of Object.keys(out)) out[s] += ((stats[s] || 0) + (stats.all || 0)) * k;
  }
  for (const s of Object.keys(out)) out[s] = Math.round(out[s]);
  return out;
}

/** Returns the equipped 3D Dice Skin's boardBonus object (if any), scaled by +5% per Star-Force refine level. */
export function diceBoardBonus(equipped = {}, { diceSkins = {} } = {}) {
  const d = equipped?.dice;
  if (!d?.id || !diceSkins[d.id]?.boardBonus) return null;
  const k = 1 + 0.05 * Math.max(0, Math.min(10, d.refine | 0));
  const out = {};
  for (const [key, val] of Object.entries(diceSkins[d.id].boardBonus)) {
    out[key] = +(val * k).toFixed(4);
  }
  return out;
}

// Pet family → which stat its passive feeds inside a match (old 6-family + new Soul-Bond families).
export const PET_STAT = Object.freeze({
  cats: 'fortune', chonkers: 'fortune', ragdoll: 'fortune', skywhale: 'fortune',
  dragons: 'swiftness', nyx: 'swiftness',
  spirits: 'power',
  fae: 'luck', kitsune: 'luck',
  pups: 'guardian',
});

/** PvP-capped in-match modifiers from stats (+ optional pet passive % + 3D Dice Skin boardBonus). */
export function matchMods(stats = {}, { petFamily = null, petPct = 0, diceBonus = null } = {}) {
  const s = { fortune: stats.fortune || 0, swiftness: stats.swiftness || 0, power: stats.power || 0, luck: stats.luck || 0 };
  const petStat = PET_STAT[petFamily];
  if (petStat && petStat !== 'guardian') s[petStat] += petPct;
  const db = diceBonus || {};
  return {
    startCashPct: +Math.min(PVP_CAPS.startCashPct, softCap(s.fortune, PVP_CAPS.startCashPct) + (db.startCashPct || 0)).toFixed(4),
    rentPct: +Math.min(PVP_CAPS.rentPct, softCap(s.fortune, PVP_CAPS.rentPct) + (db.rentPct || 0)).toFixed(4),
    salaryPct: +Math.min(PVP_CAPS.salaryPct, softCap(s.swiftness, PVP_CAPS.salaryPct) + (db.salaryPct || 0)).toFixed(4),
    ultPct: +Math.min(PVP_CAPS.ultPct, softCap(s.power, PVP_CAPS.ultPct) + (db.ultPct || 0)).toFixed(4),
    discountPct: +Math.min(PVP_CAPS.discountPct, softCap(s.luck, PVP_CAPS.discountPct) + (db.discountPct || 0)).toFixed(4),
    startShields: petStat === 'guardian' ? 1 : 0,
  };
}

/**
 * Profile → seat descriptor for createMatch / TableManager.playerInfo. Pure; catalogs and pet helpers are
 * injected: { outfits, accessories, diceSkins, petFamilyOf(petId), petPctOf(equippedPet) }.
 */
export function playerInfoFromProfile(p, { outfits = {}, accessories = {}, diceSkins = {}, petFamilyOf = () => null, petPctOf = () => 0 } = {}) {
  const outfitId = p?.equipped?.outfit?.id || 'newbie_outfit';
  const def = outfits[outfitId] || {};
  const pet = p?.equipped?.pet || null;
  return {
    name: p?.username || p?.id,
    lineage: p?.lineage || 'bkk',
    level: p?.level || 1,
    equipped: p?.equipped || null,
    outfit: outfitId,
    outfitRarity: def.rarity || 1,
    affinity: affinityFor(outfitId),
    diceSkin: p?.equipped?.dice?.id || null,
    diceBonus: diceBoardBonus(p?.equipped, { diceSkins }),
    petId: pet?.id || null,
    petFamily: pet?.id ? petFamilyOf(pet.id) : null,
    petPct: pet?.id ? petPctOf(pet) : 0,
    partnerId: p?.partner_id || null,
    stats: gearStats(p?.equipped, { outfits, accessories, diceSkins }),
  };
}

// ---------------------------------------------------------------------------------- podium (§5.3 + 28-Combo Matrix)
export const SEAT_FACTOR = Object.freeze({ 2: 0.60, 3: 0.80, 4: 1.00 });
export const SEAT_WEIGHT = Object.freeze({ human: 1.25, easy: 0.70, hard: 1.00, insane: 1.20 });
export const COUPLE_PODIUM_MULT = 1.25;

export const PODIUM = Object.freeze({
  DIAMONDS: [100, 70, 45, 30],           // Base 1.00× 4-Seat Podium Diamonds (1st..4th)
  GOLD: [1500, 1000, 700, 500],          // Base 1.00× 4-Seat Podium Gold
  BERRIES: [180, 110, 75, 50],           // Base 1.00× 4-Seat Podium Star-Berries
  CHEST_CHANCE: [0.50, 0.30, 0.15, 0],   // Podium Chest drop chance (1st 50%, 2nd 30%, 3rd 15%, 4th 0%)
  EXP: [180, 140, 120, 100],             // Base 1.00× 4-Seat Player EXP
  CHEST_TICKET_SHARE: 0.30,              // 30% Standard Summon Ticket, 70% Random Gear Dupe Box
  FIRST_MATCH_DIAMONDS: 150,             // Daily 1st Match High-Roller Bonus (+150 💎)
  FIRST_MATCH_TICKET: 1,                 // + 1× 🎟️ Standard Summon Ticket on 1st match of the day
  FIRST_WIN_DIAMONDS: 150,               // alias for backward compatibility
  WIN_DIAMONDS: 100,                     // baseline 1.00× 1st-place diamonds
  MAX_DIAMOND_PAYOUTS: 6,                // up to 6 diamond-rewarded matches per UTC day
});

/**
 * Pure O(N) TableScale for any 2–4 seat combination of Humans and Easy / Hard / Insane Bots:
 *   TableScale = SeatFactor(N) × avg(SeatWeight)
 * Defaults to 1.0 when `seats` is omitted or has < 2 entries.
 */
export function tableScaleForSeats(seats = []) {
  if (!Array.isArray(seats) || seats.length < 2) return 1.0;
  const n = Math.max(2, Math.min(4, seats.length));
  const sf = SEAT_FACTOR[n] ?? 1.0;
  let sum = 0;
  for (const s of seats) {
    if (!s || !s.isBot) sum += SEAT_WEIGHT.human;
    else sum += SEAT_WEIGHT[s.botDiff] ?? SEAT_WEIGHT.easy;
  }
  return +(sf * (sum / seats.length)).toFixed(4);
}

/**
 * Rewards for one finishing player across all 28 Human/Bot/Difficulty combinations.
 * - `multiplier` = full UNCAPPED Village/Gear multiplier (e.g. 2.4) applied to Gold & Berries.
 * - `seats` / `tableScale` = computes TableScale = SeatFactor(N) × avg(SeatWeight).
 * - `coupleBonus` = ×1.25 when the player's bound partner/friend sits at the same table.
 * - `firstMatchToday` (or legacy `firstWinToday`) = +150 💎 + 1× 🎟️ Standard Summon Ticket.
 * - `boardDiamonds` = live in-board 💎 earned from START laps, Mini-Casino, Color Monopoly, and Arena duels.
 */
export function podiumRewards(rank, {
  multiplier = 1,
  seats = null,
  tableScale = null,
  coupleBonus = false,
  firstMatchToday = false,
  firstWinToday = false,
  payoutsToday = 0,
  boardDiamonds = 0,
  luckBonus = 0,
} = {}) {
  const r = Math.max(1, Math.min(4, rank | 0)) - 1;
  const m = Math.max(1, multiplier);
  const ts = typeof tableScale === 'number' ? tableScale : tableScaleForSeats(seats);
  const cMult = coupleBonus ? COUPLE_PODIUM_MULT : 1;
  const scale = ts * cMult;
  const underCap = (payoutsToday | 0) < PODIUM.MAX_DIAMOND_PAYOUTS;
  const podiumDiamonds = underCap ? Math.round(PODIUM.DIAMONDS[r] * scale) : 0;
  const isFirstBonus = Boolean(firstMatchToday || firstWinToday);
  const dailyBonusDiamonds = underCap && isFirstBonus ? PODIUM.FIRST_MATCH_DIAMONDS : 0;
  const inBoardDiamonds = underCap ? Math.max(0, boardDiamonds | 0) : 0;
  const diamonds = podiumDiamonds + dailyBonusDiamonds + inBoardDiamonds;
  const baseChest = Array.isArray(PODIUM.CHEST_CHANCE) ? PODIUM.CHEST_CHANCE[r] : 0;
  const chestChance = baseChest > 0
    ? +Math.min(0.9, baseChest * Math.min(1.25, ts) + (r === 0 ? luckBonus : luckBonus * 0.5)).toFixed(4)
    : 0;
  return {
    rank: r + 1,
    tableScale: +ts.toFixed(4),
    coupleBonus: !!coupleBonus,
    gold: Math.round(PODIUM.GOLD[r] * scale * m),
    berries: Math.round(PODIUM.BERRIES[r] * scale * m),
    diamonds,
    podiumDiamonds,
    dailyBonusDiamonds,
    boardDiamonds: inBoardDiamonds,
    ticketBonus: underCap && isFirstBonus ? PODIUM.FIRST_MATCH_TICKET : 0,
    chestChance,
    exp: Math.round(PODIUM.EXP[r] * Math.max(0.6, ts) * cMult),
  };
}
