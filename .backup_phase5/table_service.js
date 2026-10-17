// server/table_service.js — Step 4 server side of the Universal 4-Seat Table Hub + Sky Monopoly.
//
// Self-contained so server.js only needs a few lines to adopt it (see INTEGRATION at the bottom):
//   • owns one shared/universal_room.js TableManager (authoritative tables, bots, watchdog)
//   • maps DB profiles → seats with the SAME mapping the browser solo host uses
//   • pays the Victory Podium (Plan §5.3 / §14.B): uncapped gold & berry multiplier, daily diamond rules,
//     35% gear-chest roll on 1st place, player EXP
//   • delivers queued room messages to sockets ('lobby' = every connected player)
import { TableManager } from '../shared/universal_room.js';
import { playerInfoFromProfile, podiumRewards, matchMods, PODIUM } from '../shared/monopoly_rules.js';
import { applyExp, expToNext } from '../shared/progression.js';
import { grantPetActivityExp } from './rpg_service.js';

export const TABLE_TYPES = new Set([
  'table_list', 'table_create', 'table_sit', 'table_leave', 'table_set_bot', 'table_ready', 'table_start', 'table_solo', 'table_rematch',
  'table_set_option',
  'mono_roll', 'mono_ult', 'mono_buy', 'mono_event_choice',
  'mono_pet_cast', 'mono_pet_arm', 'mono_pet_toggle_auto',
]);
export const isTableMessage = (type) => TABLE_TYPES.has(type);

export const MATCH_EXP = [180, 140, 120, 100];       // base 1.00× player EXP by rank
const MAX_MULTIPLIER = 3.0;                          // safety cap on the uncapped podium multiplier
const dayKey = (now) => new Date(now).toISOString().slice(0, 10);
const nextExp = (lv) => { const n = expToNext(lv); return Number.isFinite(n) ? n : 0; };   // 0 = max level

/**
 * Full UNCAPPED Village & Gear multiplier for the post-match chest (§14.B "e.g. 2.4x"):
 * 1 + Patisserie post-match gold % + Fortune stat % (gear + pet) — capped at 3.0x for safety.
 */
export function podiumMultiplier(profile, info, { patisseriePct = () => 0 } = {}) {
  const lv = profile?.village?.levels?.patisserie || 1;
  const fortune = (info?.stats?.fortune || 0) + (info?.petFamily && ['cats', 'chonkers', 'ragdoll', 'skywhale'].includes(info.petFamily) ? info.petPct || 0 : 0);
  return Math.min(MAX_MULTIPLIER, Math.round((1 + patisseriePct(lv) / 100 + fortune / 100) * 100) / 100);
}

/**
 * @param {object} o
 * @param {object} o.db                 server Database (getProfile / markProfile)
 * @param {(userId, msg) => void} o.sendTo
 * @param {() => Iterable<string>} o.onlineIds   every connected userId (for 'lobby' broadcasts)
 * @param {(profile) => void} [o.pushProfile]
 * @param {object} [o.catalogs]         { outfits, accessories, diceSkins, petFamilyOf, petPctOf, patisseriePct }
 * @param {() => number} [o.rng] · [o.now] · [o.log] · [o.tickMs]
 */
export function createTableService({ db, sendTo, onlineIds, pushProfile = () => {}, catalogs = {}, rng = Math.random, now = () => Date.now(), log = console, tickMs = 200 } = {}) {
  const info = (userId) => {
    const p = db.getProfile(userId);
    return p ? playerInfoFromProfile(p, catalogs) : null;
  };

  function payout(table, result) {
    const out = {};
    const seats = table.match.players;
    const chaos = !!table.match.chaos;
    const t = now();
    for (const r of result.ranking) {
      const seat = seats[r.seat];
      if (seat.isBot) continue;
      const prof = db.getProfile(seat.id);
      if (!prof) continue;
      const daily = prof.mono_daily?.day === dayKey(t) ? prof.mono_daily : { day: dayKey(t), wins: 0, payouts: 0, matches: 0 };
      const partnerId = prof.partner_id || seat.partnerId || null;
      const coupleBonus = Boolean(partnerId && seats.some((q) => !q.isBot && q.id === partnerId));
      const i = info(seat.id);
      const multiplier = podiumMultiplier(prof, i, catalogs);
      const luckBonus = Math.min(0.25, (i?.stats?.luck || 0) / 400);
      const rw = podiumRewards(r.rank, {
        multiplier,
        seats,
        coupleBonus,
        firstMatchToday: (daily.matches || 0) === 0,
        payoutsToday: daily.payouts,
        boardDiamonds: r.boardDiamonds || 0,
        luckBonus,
        chaos,
      });
      prof.gold = (prof.gold || 0) + rw.gold;
      prof.berries = (prof.berries || 0) + rw.berries;
      prof.diamonds = (prof.diamonds || 0) + rw.diamonds;
      if (rw.ticketBonus > 0) {
        prof.bag_items = { ...(prof.bag_items || {}), ticket_standard: (prof.bag_items?.ticket_standard || 0) + rw.ticketBonus };
      }
      // 🎉 Chaos Party matches never touch the daily counters (no cap use, no 1st-match bonus consumed)
      if (!chaos) {
        daily.matches = (daily.matches || 0) + 1;
        if (r.rank === 1) daily.wins++;
        if (rw.podiumDiamonds > 0 || rw.dailyBonusDiamonds > 0) daily.payouts++;
      }
      prof.mono_daily = daily;
      const chest = rw.chestChance > 0 && rng() < rw.chestChance;
      let chestReward = null;
      if (chest) {
        chestReward = rng() < PODIUM.CHEST_TICKET_SHARE ? 'ticket_standard' : 'random_dupe_box';
        prof.bag_items = { ...(prof.bag_items || {}), [chestReward]: (prof.bag_items?.[chestReward] || 0) + 1 };
      }
      const exp = rw.exp || MATCH_EXP[r.rank - 1] || 0;
      const levelBefore = prof.level || 1, levelExpBefore = prof.exp || 0;
      const lv = applyExp(levelBefore, levelExpBefore, exp);
      const levelUpDiamonds = 50 * lv.levelsGained;
      prof.level = lv.level; prof.exp = lv.exp; prof.diamonds += levelUpDiamonds;
      prof.mono_stats = { played: (prof.mono_stats?.played || 0) + 1, wins: (prof.mono_stats?.wins || 0) + (r.rank === 1 ? 1 : 0) };
      let petExpRes = null;
      if (Array.isArray(prof.pets) && prof.pets.length > 0) {
        petExpRes = grantPetActivityExp(prof, 25, 'monopoly');
      }
      db.markProfile(prof.id);
      pushProfile(prof);
      out[seat.id] = {
        ...rw, multiplier, chest, chestReward, exp, levelsGained: lv.levelsGained, levelUpDiamonds,
        // podium EXP bar: before → after (levelExpNext 0 = max level)
        levelBefore, levelExpBefore, levelExpNextBefore: nextExp(levelBefore),
        level: lv.level, levelExp: lv.exp, levelExpNext: nextExp(lv.level),
        petCombos: seat.petCombos || 0, petCasts: seat.petCasts || 0,
        petExpGained: petExpRes?.ok ? petExpRes.expGained : 0,
        chaos: !!chaos,
      };
    }
    log.info?.(`[tables] ${table.id} ended (${result.reason}) winner=${table.match.players[result.winner]?.id}`);
    return out;
  }

  /** 🐾 persist the Auto/Manual pet toggle on the profile (default Auto when unset). */
  function onPetAuto(userId, auto) {
    const prof = db.getProfile(userId);
    if (!prof) return;
    prof.mono_pet_auto = !!auto;
    db.markProfile(prof.id);
  }

  const mgr = new TableManager({ now, playerInfo: info, onMatchEnd: payout, onPetAuto, seedFn: () => (rng() * 2 ** 31) >>> 0 });

  function flush() {
    for (const { to, msg } of mgr.flush()) {
      if (to === 'lobby') for (const id of onlineIds()) sendTo(id, msg);
      else for (const id of to) sendTo(id, msg);
    }
  }

  const timer = setInterval(() => { try { mgr.tick(); flush(); } catch (e) { log.error?.('[tables] tick', e); } }, tickMs);
  timer.unref?.();

  return {
    mgr,
    isTableMessage,
    handle(userId, m) { const r = mgr.handle(userId, m); flush(); return r; },
    connect(userId) { mgr.connect(userId); flush(); },
    disconnect(userId) { mgr.disconnect(userId); flush(); },
    tick() { mgr.tick(); flush(); },
    close() { clearInterval(timer); },
    _payout: payout,
    _matchMods: matchMods,
  };
}

/* INTEGRATION (apply once the parallel agents are done editing server.js — ~10 lines):
 *   import { createTableService } from './table_service.js';
 *   import { OUTFITS } from '../shared/costumes_catalog.js';
 *   import { ACCESSORIES, getPetDef } from '../shared/catalog_gear_pets.js';
 *   import { petPassivePct } from '../shared/rpg_rules.js';
 *   import { CORE } from '../shared/catalog_landmarks.js';
 *   const tables = createTableService({ db, log, rng,
 *     sendTo: (id, msg) => send(sockets.get(id), msg), onlineIds: () => sockets.keys(), pushProfile,
 *     catalogs: { outfits: OUTFITS, accessories: ACCESSORIES, petFamilyOf: (id) => getPetDef(id)?.family,
 *                 petPctOf: (pet) => petPassivePct(pet.id, pet.stars, pet.level), patisseriePct: CORE.patisserie.matchGoldPct } });
 *   join():      tables.connect(p.id);
 *   leave():     tables.disconnect(ws.userId);
 *   on message:  if (tables.isTableMessage(m.type)) { tables.handle(ws.userId, m); break; }
 *   close():     tables.close();
 */
