// server/cloud_dash_service.js — Sky Cloud Dash V2 table adapter (Phase 6B-1).
// Plugs into shared/universal_room.js TableManager under games.cloud_dash.
//
// Netcode model (CLOUD_DASH_V2.md §6.2): each human runner is simulated on their own client
// with the shared deterministic stepRunner() and reported ~8 Hz via `cd_report`. The server
// validates progress against a plausible speed bound, simulates bots authoritatively with the same
// stepRunner(), ranks everyone, and broadcasts a compact `cd_state` every tick.
import {
  DASH_TUNING as T,
  createRunner,
  stepRunner,
  createBotBrain,
  BOT_LEVELS,
  botInput,
  computeRanking,
  maxPlausibleSpeed,
  rewardFor,
  DASH_REWARDS,
  ultDefFor,
  deliverEffect,
  MAX_WARP,
  ITEM_DEFS,
} from '../shared/cloud_dash_rules.js';
import {
  dashModsFromStats,
  getWeeklyWeather,
  ensureDashDaily,
  computeLeagueDelta,
  DASH_DAILY_CHEST_MAX,
  DASH_CHEST_BAR_MAX,
} from '../shared/dash_builds.js';
import { computeUniversalStats } from '../shared/universal_stats.js';
import { buildTrack } from '../shared/cloud_dash_track.js';
import { normalizePetId } from '../shared/pet_catalog.js';
import { defenderModsFromProfile } from '../shared/moon_defense_rules.js';
import { applyExp, expToNext, recalcPlayerCP } from '../shared/progression.js';
import { utcDay } from '../shared/village_rules.js';
import { grantPetActivityExp, checkBuildDiscovery, syncGlamourAndAttune } from './rpg_service.js';

const COUNTDOWN_MS = 3500;
const BOT_NAMES = ['Sky Mochi', 'Captain Boba', 'Lady Seraphina', 'Kitsune Kai', 'Nimbus Nana', 'Zephyr Jin'];
const BOT_OUTFITS = ['s8_glacial_elsa', 's11_zeus_olympus', 's2_kitsune_inari', 's5_atlantis_siren', 's3_sultan_djinn', 's9_pharaoh_ra'];
const BOT_PETS = ['pet_nyx', 'pet_ragdoll', 'pet_kitsune', 'pet_skywhale'];
const PLACE_DIAMONDS = [10, 6, 4, 3];
const PLACE_EXP = [120, 95, 80, 70];

const nextExp = (lv) => { const n = expToNext(lv); return Number.isFinite(n) ? n : 0; };
const r2 = (v) => Math.round(v * 100) / 100;

export function createCloudDashAdapter({
  db, send, humans, rng = Math.random, now = Date.now,
  pushProfile = () => {}, onMatchFinished = () => {}, catalogs = null,
} = {}) {
  const getNow = () => (typeof now === 'function' ? now() : Date.now());
  const getHumans = (t) => (humans ? humans(t) : t.seats.filter((s) => s.kind === 'human' && s.userId).map((s) => s.userId));
  const sendMsg = (target, msg) => {
    if (!send) return;
    const uids = Array.isArray(target) ? target : [target];
    if (uids.length) send(uids, msg);
  };

  function makeRacer(seat, idx, track, botLevel, dashMode = 'quick', weather = null) {
    const isHuman = seat.kind === 'human' && Boolean(seat.userId);
    const prof = isHuman && db ? db.getProfile(seat.userId) : null;
    if (prof) syncGlamourAndAttune(prof);
    const activePet = Array.isArray(prof?.pets) ? prof.pets.find((p) => p.uid === prof.active_pet_uid) || prof.pets[0] : null;
    const equipped = prof?.equipped || seat.equipped || { outfit: { id: seat.outfit || BOT_OUTFITS[idx % BOT_OUTFITS.length], refine: 0 } };
    const petId = prof?.equipped?.pet?.id || activePet?.id || seat.petId || BOT_PETS[idx % BOT_PETS.length];
    const petStars = Math.max(1, Math.min(3, activePet?.stars || prof?.equipped?.pet?.stars || 2));
    let podiumMult = 1;
    try { podiumMult = defenderModsFromProfile(prof || { equipped, pets: activePet ? [activePet] : [] }, catalogs)?.podiumMult || 1; } catch {}
    const lvl = seat.botDiff || botLevel || 'hard';
    const statScale = dashMode === 'league' ? 0.5 : 1;
    let mods = null;
    if (isHuman && prof) { try { mods = dashModsFromStats(computeUniversalStats(prof).bonus, { statScale, weather }); } catch (e) { mods = null; } }
    else if (!isHuman) mods = botMods(lvl, idx, track.seed, { statScale, weather });
    const outfitId = equipped?.outfit?.id || null;
    const ult = ultDefFor(outfitId);
    const r = createRunner({ seat: idx, petStars, petId: normalizePetId(petId), itemCount: track.items.length, statSpeed: isHuman ? 0 : (BOT_LEVELS[lvl]?.speed || 0), mods, ult, seed: (track.seed * 131 + idx * 7919) >>> 0 });
    return {
      seat: idx,
      id: isHuman ? seat.userId : `bot_${idx}`,
      name: prof?.username || prof?.name || seat.name || BOT_NAMES[idx % BOT_NAMES.length],
      isBot: !isHuman,
      botLevel: seat.botDiff || botLevel || 'hard',
      lineage: prof?.lineage || seat.lineage || (idx % 2 ? 'dxb' : 'bkk'),
      appearance: prof?.appearance || null,
      equipped: pruneEquipped(equipped, prof?.glamour),
      petId, petStars, podiumMult,
      streak: prof?.dash_stats?.streak | 0,
      build: mods?.build || null, ultName: ult.name, ultArch: ult.type, mods,
      r,
      brain: isHuman ? null : createBotBrain(((track.seed * 31) + idx * 7919) >>> 0, seat.botDiff || botLevel || 'hard'),
      lastReportT: 0, style: 0, coins: 0, flags: 0,
      ghostSamples: [], lastGhostSampleT: -1,
      raceCounters: { rides: 0, perfects: 0, nearMisses: 0, ults: 0, showcases: 0 },
      wasRiding: false, wasUlting: false,
    };
  }

  function pruneEquipped(eq, glamour = null) {
    const out = {};
    for (const k of ['outfit', 'hat', 'face', 'gloves', 'boots', 'wings', 'pet']) {
      if (eq?.[k]?.id) {
        out[k] = {
          id: eq[k].id,
          refine: eq[k].refine | 0,
          stars: eq[k].stars,
          ...(eq[k].hide ? { hide: true } : {}),
          ...(eq[k].glamour || glamour?.[k] ? { glamour: eq[k].glamour || glamour?.[k] } : {}),
          ...(eq[k].attune?.stat ? { attune: { stat: eq[k].attune.stat } } : {}),
        };
      }
    }
    if (glamour || eq?.glamour) out.glamour = { ...(eq?.glamour || {}), ...(glamour || {}) };
    return out;
  }

  function roster(s) {
    return s.racers.map((p) => ({
      seat: p.seat, id: p.id, name: p.name, isBot: p.isBot, lineage: p.lineage,
      appearance: p.appearance, equipped: p.equipped, petId: p.petId, petStars: p.petStars,
      streak: p.streak || 0,
      build: p.build, ultName: p.ultName, ultArch: p.ultArch, mods: p.isBot ? null : p.mods,
    }));
  }

  function serialize(t, full = false) {
    const s = t.cloudDash;
    const nowMs = getNow();
    const msg = {
      type: 'cd_state',
      tableId: t.id,
      status: s.status,
      seed: s.seed,
      dashMode: s.dashMode,
      weather: s.weather,
      goInMs: Math.max(-999999, s.goAt - nowMs),
      raceT: r2(s.raceT),
      dnfInMs: s.dnfAt ? Math.max(0, s.dnfAt - nowMs) : null,
      runners: s.racers.map((p) => ({
        seat: p.seat, s: r2(p.r.s), l: r2(p.r.laneF), y: r2(p.r.y), v: r2(p.r.v),
        ride: p.r.ride > 0 ? 1 : 0, ult: p.r.ult > 0 ? 1 : 0, st: p.r.stumble > 0 ? 1 : 0,
        fin: p.r.finished ? 1 : 0, ft: p.r.finished ? r2(p.r.finishT) : null,
        place: s.places[p.seat] || 0, style: p.isBot ? p.r.style : p.style,
        sh: p.r.shrink > 0 || p.shrunkUntil > nowMs ? 1 : 0, sd: p.r.shield > 0 || p.shield ? 1 : 0,
        dh: r2(p.r.deckH || 0), hw: p.heartWith?.length ? p.heartWith : undefined,
      })),
      traps: s.traps.map((tr) => ({ id: tr.id, s: r2(tr.s), lane: tr.lane, owner: tr.owner })),
      effects: s.effects.filter((fx) => fx.until > nowMs).map(({ id, to, kind, from }) => ({ id, to, kind, from })),
      rewards: s.rewards || null,
    };
    if (full || s.status === 'countdown') {
      msg.roster = roster(s);
      if (s.ghost) msg.ghost = s.ghost;
    }
    return msg;
  }

  function broadcast(t, full = false) {
    const uids = getHumans(t);
    if (!uids.length) return;
    sendMsg(uids, serialize(t, full));
  }

  /** Bots get a flavor build so races feel varied (hard ≈ Tier I, insane ≈ Tier II). */
  function botMods(level, idx, seed, opt = {}) {
    if (level === 'easy') return null;
    const stats = ['swiftness', 'power', 'fortune', 'luck'];
    const main = stats[(seed + idx * 3) % 4];
    const amt = level === 'insane' ? 400 : 150; // hard ≈ Tier I, insane ≈ Tier II (fair vs. new players)
    const bonus = { swiftness: 60, power: 60, fortune: 60, luck: 60, [main]: amt };
    return dashModsFromStats(bonus, opt);
  }

  /** Cross-player item / ULT effects (server-authoritative targeting). */
  function applyItem(t, from, kind, atS, lane, nowMs) {
    const s = t.cloudDash;
    const others = s.racers.filter((q) => q !== from && !q.r.finished);
    const send = (q, k) => {
      if (q.isBot) deliverEffect(q.r, k, from.seat);
      else s.effects.push({ id: ++s.fxSeq, to: q.seat, kind: k, from: from.seat, until: nowMs + 2500 });
    };
    if (kind === 'shrink') {
      if (nowMs < s.shrinkUntil) return { ok: false, error: 'shrink_active' }; // max 1 bolt on track
      const leaderSeat = Object.entries(s.places).find(([, pl]) => pl === 1)?.[0];
      let target = others.find((q) => String(q.seat) === leaderSeat) || others.slice().sort((a, b) => b.r.s - a.r.s)[0];
      if (!target) return { ok: false };
      s.shrinkUntil = nowMs + (T.SHRINK.warn + T.SHRINK.dur) * 1000;
      send(target, 'shrink');
      return { ok: true, target: target.seat };
    }
    if (kind === 'slow_all') { for (const q of others) send(q, 'slow'); return { ok: true }; }
    if (kind === 'wave') {
      // 🐋 Whale Surf: bubble rivals just behind me in my lane
      const hit = others.filter((q) => q.r.s < atS && atS - q.r.s <= T.SURF.range && Math.abs(q.r.laneF - lane) < T.SURF.lane + 0.3);
      for (const q of hit) send(q, 'bubble');
      return { ok: true, hit: hit.map((q) => q.seat) };
    }
    if (kind === 'mochi') {
      const tr = { id: ++s.fxSeq, s: Math.max(0, atS - 2.5), lane: Math.max(-1, Math.min(1, Math.round(lane))), owner: from.seat, until: s.raceT + T.TRAP.life };
      s.traps.push(tr);
      if (s.traps.length > 12) s.traps.shift();
      return { ok: true, trap: tr.id };
    }
    return { ok: false, error: 'bad_item' };
  }

  // ------------------------------------------------------------------ lifecycle
  function start(t, options = {}) {
    const nowMs = getNow();
    const dashMode = options.dashMode || t.options?.dashMode || (t.options?.matchMode === 'chaos' ? 'chaos' : 'quick');
    const isGhost = dashMode === 'ghost';
    const weatherObj = getWeeklyWeather(nowMs);
    const weather = isGhost ? null : weatherObj.id;
    const hostProf = db && t.hostId ? db.getProfile(t.hostId) : null;
    // In Ghost Trial, reuse the PB ghost's seed if available so you race the exact same course as your ghost!
    const seed = (isGhost && hostProf?.dash_ghost?.seed) ? hostProf.dash_ghost.seed : (((rng() * 2 ** 31) >>> 0) || 1);
    const track = buildTrack(seed, { weather, chaos: dashMode === 'chaos', noPrisms: isGhost });
    const occupied = t.seats.map((s, idx) => ({ s, idx })).filter(({ s }) => s.kind !== 'empty' && (!isGhost || s.kind === 'human'));
    const botLevel = dashMode === 'league' ? 'insane' : (options.diff || t.botDiff || 'hard');
    const racers = occupied.map(({ s, idx }) => makeRacer(s, idx, track, botLevel, dashMode, weather));
    // Always race 4 (except Ghost Trial solo sprint): fill empty lanes with bots
    if (!isGhost) {
      for (let idx = 0; racers.length < 4 && idx < 4; idx++) {
        if (racers.some((p) => p.seat === idx)) continue;
        racers.push(makeRacer({ kind: 'bot', botDiff: botLevel }, idx, track, botLevel, dashMode, weather));
      }
    }
    racers.sort((a, b) => a.seat - b.seat);
    // 💞 Couple Heart Slingshot: bound partner (partner_id) or friends racing together
    for (const p of racers) {
      p.heartWith = [];
      if (p.isBot || !db) continue;
      const me = db.getProfile(p.id);
      if (!me) continue;
      for (const q of racers) {
        if (q === p || q.isBot) continue;
        const qid = String(q.id).toLowerCase();
        const partner = String(me.partner_id || '').toLowerCase() === qid;
        const friend = Array.isArray(me.friends) && me.friends.some((f) => String(f).toLowerCase() === qid);
        if (partner || friend) p.heartWith.push(q.seat);
      }
    }
    t.cloudDash = {
      seed, track, racers,
      dashMode, weather,
      ghost: isGhost && hostProf?.dash_ghost ? hostProf.dash_ghost : null,
      status: 'countdown',
      goAt: nowMs + COUNTDOWN_MS,
      raceT: 0,
      firstFinishT: null, dnfAt: null,
      places: {},
      rewards: null,
      traps: [], effects: [], fxSeq: 0, shrinkUntil: 0,
    };
    broadcast(t, true);
  }

  function onJoin(t, userId) {
    const s = t.cloudDash;
    if (!s) return;
    const p = s.racers.find((q) => q.id === userId);
    if (p) {
      p.disconnected = false;
      p.isBot = false;
    }
    // Joining mid-race = spectate (racing starts on the next Run It Back)
    sendMsg(userId, serialize(t, true));
  }

  function onDisconnect(t, userId) {
    const s = t.cloudDash;
    if (!s) return;
    const p = s.racers.find((q) => q.id === userId);
    if (p && s.status !== 'ended' && !p.isBot) {
      p.disconnected = true;
      if (!p.brain) p.brain = createBotBrain((s.seed + p.seat * 104729) >>> 0, 'hard');
    }
  }

  function leave(t, userId) {
    const s = t.cloudDash;
    if (!s) return;
    const p = s.racers.find((q) => q.id === userId);
    if (p && s.status !== 'ended' && !p.isBot) {
      p.isBot = true;
      p.disconnected = false;
      p.brain = createBotBrain((s.seed + p.seat * 104729) >>> 0, 'hard');
    }
  }

  // ------------------------------------------------------------------ tick
  function tick(t, nowMs = getNow()) {
    const s = t.cloudDash;
    if (!s || s.status === 'ended') return;
    if (s.status === 'countdown') {
      if (nowMs >= s.goAt) s.status = 'playing';
      else { broadcast(t); return; }
    }
    s.raceT = (nowMs - s.goAt) / 1000;

    // Simulate bots (and temporarily disconnected humans) up to raceT with fixed steps
    const ranking0 = computeRanking(s.racers.map((p) => p.r));
    const placeOf = {};
    ranking0.forEach((ri, i) => { placeOf[s.racers[ri].seat] = i + 1; });
    s.traps = s.traps.filter((tr) => tr.until > s.raceT);
    for (const p of s.racers) {
      if (!p.isBot && !p.disconnected) continue;
      if (!p.brain) p.brain = createBotBrain((s.seed + p.seat * 104729) >>> 0, 'hard');
      const rivals = s.racers.filter((q) => q !== p).map((q) => ({ s: q.r.s, lane: q.r.laneF, y: q.r.y, seat: q.seat, dk: (q.r.deckH || 0) > 0.5 ? 1 : 0 }));
      const ctx = { track: s.track, place: placeOf[p.seat] || 1, rivals, traps: s.traps };
      let guard = 0;
      while (p.r.t + T.DT <= s.raceT && guard++ < 120) {
        const inp = botInput(p.r, ctx, p.brain, T.DT);
        for (const e of stepRunner(p.r, ctx, inp, T.DT)) {
          if (e.e === 'item_use' && (e.item === 'shrink' || e.item === 'mochi')) applyItem(t, p, e.item, e.s, e.lane, nowMs);
          else if (e.e === 'ult' && e.rivalSlow) applyItem(t, p, 'slow_all', p.r.s, 0, nowMs);
          else if (e.e === 'surf_wave') applyItem(t, p, 'wave', e.s, e.lane, nowMs);
        }
      }
      if (p.disconnected) p.lastReportT = p.r.t;
    }

    // Places + finish handling
    const ranking = computeRanking(s.racers.map((p) => p.r));
    s.places = {};
    ranking.forEach((ri, i) => { s.places[s.racers[ri].seat] = i + 1; });
    const finishers = s.racers.filter((p) => p.r.finished);
    if (finishers.length && s.firstFinishT == null) {
      s.firstFinishT = Math.min(...finishers.map((p) => p.r.finishT));
      s.dnfAt = nowMs + T.DNF_AFTER_FIRST * 1000;
    }
    const humansLeft = s.racers.filter((p) => !p.isBot && !p.r.finished).length;
    const allDone = finishers.length === s.racers.length;
    const humansDone = humansLeft === 0 && finishers.length > 0;
    if (allDone || (s.dnfAt && nowMs >= s.dnfAt) || s.raceT >= T.RACE_HARD_CAP || (humansDone && s.dnfAt && nowMs >= s.dnfAt - (T.DNF_AFTER_FIRST - 4) * 1000)) {
      finishRace(t, ranking);
      return;
    }
    broadcast(t);
  }

  // ------------------------------------------------------------------ finish & rewards
  function finishRace(t, ranking) {
    const s = t.cloudDash;
    if (!s || s.status === 'ended') return;
    s.status = 'ended';
    t.status = 'ended';
    const rewardsByUser = {};
    const dayKey = String(utcDay(getNow()));
    const coupleCredited = new Set();
    ranking.forEach((ri, i) => {
      const p = s.racers[ri];
      let place = i + 1;
      if (p.isBot) return; // bots + leavers (converted to bots) get no rewards
      const prof = db ? db.getProfile(p.id) : null;
      const finishMs = p.r.finished ? Math.round(p.r.finishT * 1000) : null;
      // In Ghost Trial, beating your PB ghost counts as 1st place; finishing without beating it counts as 2nd
      if (s.dashMode === 'ghost' && s.ghost?.ms && finishMs != null) {
        place = finishMs < s.ghost.ms ? 1 : 2;
      }
      const base = rewardFor(place, p.style);
      const mult = Math.max(1, Math.min(3, Number(p.podiumMult) || 1));
      let gold = Math.round(base.gold * mult);
      let berries = Math.round(base.berries * mult);
      let diamonds = PLACE_DIAMONDS[place - 1] || 0;
      const exp = PLACE_EXP[place - 1] || 60;
      let levelsGained = 0, levelUpDiamonds = 0, petExpGained = 0;
      let newBestTime = false, newBestStyle = false, newGhostPb = false;
      let dailyChestReward = null, chestPopped = null, chestGain = 0;
      const completedMissions = [];
      let league = null, buildUpdate = null;

      if (prof) {
        const ds = prof.dash_stats || {};
        newBestTime = finishMs != null && (!ds.bestMs || finishMs < ds.bestMs);
        newBestStyle = p.style > (ds.bestStyle || 0);
        const prevGhostMs = prof.dash_ghost?.ms || null;
        if (finishMs != null && (!prevGhostMs || finishMs < prevGhostMs)) {
          newGhostPb = s.dashMode === 'ghost';
          prof.dash_ghost = {
            ms: finishMs,
            seed: s.seed,
            name: prof.username || prof.name || p.name,
            lineage: prof.lineage || p.lineage,
            appearance: prof.appearance || p.appearance,
            equipped: pruneEquipped(prof.equipped, prof.glamour),
            petId: p.petId,
            petStars: p.petStars,
            samples: (p.ghostSamples || []).slice(0, 240),
          };
        }
        const nextStreak = place <= 2 ? (ds.streak || 0) + 1 : 0;
        prof.dash_stats = {
          played: (ds.played || 0) + 1,
          wins: (ds.wins || 0) + (place === 1 ? 1 : 0),
          podiums: (ds.podiums || 0) + (place <= 2 ? 1 : 0),
          bestMs: newBestTime ? finishMs : ds.bestMs || null,
          bestStyle: Math.max(ds.bestStyle || 0, p.style),
          streak: nextStreak,
          bestStreak: Math.max(ds.bestStreak || 0, nextStreak),
        };

        // 🔁 Daily Sky Chests, Chest Progress Bar & 3 Rotating Missions
        const daily = ensureDashDaily(prof, dayKey);
        if (place <= 2 && daily.chests < DASH_DAILY_CHEST_MAX) {
          daily.chests += 1;
          dailyChestReward = daily.chests === DASH_DAILY_CHEST_MAX
            ? { pip: daily.chests, grand: true, gold: 600, berries: 40, diamonds: 15 }
            : { pip: daily.chests, grand: false, gold: 250, berries: 15, diamonds: 5 };
          gold += dailyChestReward.gold;
          berries += dailyChestReward.berries;
          diamonds += dailyChestReward.diamonds;
        }
        chestGain = ([45, 35, 25, 20][place - 1] || 20) + Math.min(25, Math.floor((p.style || 0) / 150));
        daily.chestPts = (daily.chestPts | 0) + chestGain;
        if (daily.chestPts >= DASH_CHEST_BAR_MAX) {
          daily.chestPts -= DASH_CHEST_BAR_MAX;
          chestPopped = { gold: 350, berries: 20, diamonds: 5 };
          gold += chestPopped.gold;
          berries += chestPopped.berries;
          diamonds += chestPopped.diamonds;
        }
        const mStat = {
          rides: Math.max(0, p.raceCounters?.rides | 0),
          perfects: Math.max(0, p.raceCounters?.perfects | 0),
          nearMisses: Math.max(0, p.raceCounters?.nearMisses | 0),
          top2: place <= 2 ? 1 : 0,
          style: p.style || 0,
          coins: p.coins || 0,
          ults: Math.max(0, p.raceCounters?.ults | 0),
          showcases: Math.max(0, p.raceCounters?.showcases | 0),
        };
        for (const m of daily.missions) {
          if (m.done) continue;
          const inc = mStat[m.stat] || 0;
          if (inc > 0) {
            m.progress = Math.min(m.target, (m.progress || 0) + inc);
            if (m.progress >= m.target) {
              m.done = true;
              completedMissions.push({ id: m.id, title: m.title, icon: m.icon, reward: m.reward });
              gold += m.reward?.gold || 0;
              berries += m.reward?.berries || 0;
              diamonds += m.reward?.diamonds || 0;
            }
          }
        }

        // 🏆 Cloud League Ranked LP
        if (s.dashMode === 'league') {
          league = computeLeagueDelta(place, prof.dash_league_lp | 0);
          prof.dash_league_lp = league.afterLp;
          prof.dash_league_tier = league.afterTier.id;
          if (league.promoted) {
            league.promoDiamonds = 25;
            diamonds += 25;
          }
        }

        buildUpdate = checkBuildDiscovery(prof);
        prof.gold = (prof.gold || 0) + gold;
        prof.berries = (prof.berries || 0) + berries;
        prof.diamonds = (prof.diamonds || 0) + diamonds;
        const lv = applyExp(prof.level || 1, prof.exp || 0, exp);
        levelsGained = lv.levelsGained; levelUpDiamonds = 50 * levelsGained;
        prof.level = lv.level; prof.exp = lv.exp; prof.diamonds += levelUpDiamonds;
        if (levelsGained > 0) prof.cp = recalcPlayerCP(prof);

        // Town Hall Statue #3 (arcade) reads arcade_best — higher is better
        prof.arcade_best = Math.max(prof.arcade_best || 0, Math.round(p.style / 10));
        if (Array.isArray(prof.pets) && prof.pets.length) {
          const pr = grantPetActivityExp(prof, place <= 2 ? 30 : 15, 'cloud_dash');
          petExpGained = pr?.ok ? pr.expGained : 0;
        }
        const partnerId = prof.partner_id || null;
        const hasPartnerInRace = Boolean(
          partnerId && s.racers.some((q) => !q.isBot && q.id === partnerId)
        );
        let withPartner = false;
        if (hasPartnerInRace && !coupleCredited.has(prof.id)) {
          coupleCredited.add(prof.id);
          coupleCredited.add(partnerId);
          withPartner = true;
        }
        try { onMatchFinished(prof, withPartner ? { withPartner: true } : undefined); } catch {}
        db.markProfile?.(prof.id);
        pushProfile(prof);
      }
      rewardsByUser[p.id] = {
        place, gold, berries, diamonds: diamonds + levelUpDiamonds + (buildUpdate?.diamonds || 0), exp, multiplier: mult,
        style: p.style, coins: p.coins, finishMs, newBestTime, newBestStyle, newGhostPb,
        levelsGained, petExpGained,
        streak: prof?.dash_stats?.streak || 0,
        daily: prof?.dash_daily || null,
        dailyChestReward, chestGain, chestPopped, completedMissions,
        league, buildUpdate,
        level: prof?.level || 1, levelExp: prof?.exp || 0, levelExpNext: nextExp(prof?.level || 1),
      };
    });
    s.rewards = rewardsByUser;
    broadcast(t, false);
  }

  // ------------------------------------------------------------------ messages
  function handle(t, userId, msg) {
    const s = t.cloudDash;
    if (!s) return { ok: false, error: 'no_match' };
    const p = s.racers.find((q) => q.id === userId && !q.isBot);
    if (!p) return { ok: false, error: 'not_racing' };
    p.disconnected = false;
    switch (msg.type) {
      case 'cd_report': {
        if (s.status !== 'playing') return { ok: false, error: 'not_playing' };
        const raceT = (getNow() - s.goAt) / 1000;
        const rt = Math.min(Number(msg.t) || 0, raceT + 0.5);
        const dt = Math.max(0.05, rt - p.lastReportT);
        const maxDs = maxPlausibleSpeed() * dt * 1.15 + 3 + (msg.ult && p.r.ultDef?.type === 'warp' ? MAX_WARP : 0);
        let ns = Number(msg.s) || 0;
        if (ns - p.r.s > maxDs) { ns = p.r.s + maxDs; p.flags++; }     // too fast → clamp
        if (ns < p.r.s - 30) ns = p.r.s - 30;                           // sanity
        p.r.s = Math.max(0, Math.min(T.TRACK_LEN + T.FINISH_COAST, ns));
        p.r.laneF = Math.max(-1, Math.min(1, Number(msg.l) || 0));
        p.r.y = Math.max(-3, Math.min(4, Number(msg.y) || 0));
        p.r.v = Math.max(0, Math.min(maxPlausibleSpeed(), Number(msg.v) || 0));
        if (msg.ride && !p.wasRiding) p.raceCounters.rides++;
        if (msg.ult && !p.wasUlting) p.raceCounters.ults++;
        p.wasRiding = !!msg.ride;
        p.wasUlting = !!msg.ult;
        p.r.ride = msg.ride ? 1 : 0; p.r.ult = msg.ult ? 1 : 0; p.r.stumble = msg.st ? 1 : 0;
        if (msg.stats && typeof msg.stats === 'object') {
          const clampC = (v, m = 80) => Math.max(0, Math.min(m, Number(v) | 0));
          p.raceCounters.rides = Math.max(p.raceCounters.rides, clampC(msg.stats.rides, 15));
          p.raceCounters.perfects = Math.max(p.raceCounters.perfects, clampC(msg.stats.perfects, 60));
          p.raceCounters.nearMisses = Math.max(p.raceCounters.nearMisses, clampC(msg.stats.nearMisses, 60));
          p.raceCounters.ults = Math.max(p.raceCounters.ults, clampC(msg.stats.ults, 10));
          p.raceCounters.showcases = Math.max(p.raceCounters.showcases, clampC(msg.stats.showcases, 60));
        }
        // 👻 Record compact ghost trace (~2 Hz)
        if (rt - p.lastGhostSampleT >= 0.45 && p.ghostSamples.length < 240) {
          p.lastGhostSampleT = rt;
          p.ghostSamples.push([r2(rt), r2(p.r.s), r2(p.r.laneF), r2(p.r.y)]);
        }
        // ☁️ deck height only valid inside the deck span
        const dkSpan = s.track.deck;
        p.r.deckH = dkSpan && p.r.s >= dkSpan.ring - 2 && p.r.s <= dkSpan.s1 + 1 ? Math.max(0, Math.min(T.DECK.y, Number(msg.dh) || 0)) : 0;
        p.r.t = rt;
        p.lastReportT = rt;
        p.style = Math.max(0, Math.min(DASH_REWARDS.maxStyle, Math.round(Number(msg.style) || 0)));
        p.coins = Math.max(0, Math.min(s.track.items.length, Math.round(Number(msg.coins) || 0)));
        if (msg.fin && !p.r.finished && p.r.s >= T.TRACK_LEN - 1) {
          const minT = T.TRACK_LEN / maxPlausibleSpeed();
          p.r.finished = true;
          p.r.finishT = Math.max(minT, Math.min(raceT + 0.3, Number(msg.ft) || raceT));
          p.ghostSamples.push([r2(p.r.finishT), T.TRACK_LEN, r2(p.r.laneF), 0]);
        }
        return { ok: true };
      }
      case 'cd_item': {
        if (s.status !== 'playing') return { ok: false, error: 'not_playing' };
        const nowMs = getNow();
        const kind = String(msg.kind || '');
        if (kind === 'wave') {
          // ride-only signature, separate rate limit from items
          if (!p.r.ride || p.r.rideStyle !== 'surf' || nowMs - (p.lastWaveAt || 0) < T.SURF.every * 900) return { ok: false, error: 'bad_wave' };
          p.lastWaveAt = nowMs;
          return applyItem(t, p, 'wave', p.r.s, Math.max(-1, Math.min(1, Number(msg.lane) || 0)), nowMs);
        }
        if (nowMs - (p.lastItemAt || 0) < 800) return { ok: false, error: 'too_fast' };
        p.lastItemAt = nowMs;
        if (!['shrink', 'mochi', 'slow_all'].includes(kind)) return { ok: false, error: 'bad_item' };
        return applyItem(t, p, kind, Number(msg.s) || p.r.s, Number(msg.lane) || 0, nowMs);
      }
      default:
        return { ok: false, error: 'unknown_cd_msg' };
    }
  }

  return { start, onJoin, onDisconnect, leave, tick, handle };
}

