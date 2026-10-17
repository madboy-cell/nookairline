// shared/universal_room.js — Universal 4-Seat Table Hub (Implementation Plan §10.A, §11.B row 6, §21.E).
//
// Pure, transport-agnostic table manager used by BOTH the Node server (authoritative multiplayer) and the
// browser (instant "Play Solo" with bots, zero server dependency). It never touches sockets: every
// outgoing message is queued in `mgr.out` as { to: [userId…] | 'lobby', msg } and the host flushes it.
//
// c2s handled by handle(userId, msg):
//   table_create {mode, name?, options?} · table_sit {tableId, seatIdx?} · table_leave · table_set_bot {seatIdx, diff|null}
//   table_ready {ready} · table_start · table_solo {diff?, matchMode?} · table_rematch · table_list {mode?}
//   table_set_option {matchMode:'normal'|'chaos'}   (host, lobby; 🎉 Chaos Party = couple/friend/solo tables only)
//   mono_roll {use2d6} · mono_buy {choice?} · mono_event_choice {choice} · mono_ult
//   mono_pet_cast · mono_pet_arm {armed?} · mono_pet_toggle_auto {auto?}            (🐾 Soul-Link)
// s2c queued: table_state · table_list_update · mono_turn_resolved · match_victory_podium · table_error
import { MONO } from './monopoly_rules.js';
import { createMatch, roll, decide, ultimate, petUltimate, petArm, setPetAuto, drainEvents, legalActions } from './monopoly_engine.js';
import { botAction, BOT_DIFFS } from './monopoly_bots.js';

export const ROOM = Object.freeze({
  SEATS: 4,
  FIRST_TABLE_NUM: 101,
  BOT_THINK_MS: 700,            // bots "think" after the previous cutscene finished
  TURN_MS: MONO.TURN_MS,        // human turn watchdog (12 s) → Hard-bot autopilot
  RECONNECT_GRACE_MS: 60_000,   // a playing table with no connected humans is closed after this
  MAX_TABLES: 200,
  BOT_SPEED: 1.5,               // bot turns replay at 1.5× (client bridge uses the same factor)
});

export const MATCH_MODES = Object.freeze(['normal', 'chaos']);

export const MODES = Object.freeze({
  monopoly:   { label: 'Sky Monopoly', icon: '🎲', available: true,  minSeats: 2 },
  casino:     { label: 'Grand Casino', icon: '🎰', available: true,  minSeats: 1 },
  moon_bunny: { label: 'Moon Bunny',   icon: '🌙', available: false, phase: 6, minSeats: 1 },
  cloud_dash: { label: 'Cloud Dash',   icon: '☁️', available: false, phase: 6, minSeats: 1 },
});

const BOT_NAMES = ['Bot Nova', 'Bot Mochi', 'Bot Leo', 'Bot Mina'];   // by chair, so 3 bots never share a name
const BOT_OUTFITS = { easy: 'newbie_outfit', hard: 'epic_starlight_idol', insane: 's11_zeus_olympus' };
const BOT_PETS = [null, 'pet_ragdoll', 'pet_nyx', 'pet_kitsune'];         // by chair: bots bring a companion too
const BOT_PET_BOND = { easy: 1, hard: 10, insane: 20 };                   // 🐾 bond level → pet scaling

/** Match variant from a client message: { matchMode } or { options: { mode | matchMode } }. */
const matchModeOf = (m) => {
  const v = String(m?.matchMode ?? m?.options?.matchMode ?? m?.options?.mode ?? 'normal');
  return MATCH_MODES.includes(v) ? v : 'normal';
};

/** Cut-in length for an ult-like event honouring the presentation hints (fast = bot 1.2 s beat, repeat ≈ 60%). */
function ultMs(e, full) {
  if (e.fast) return 1200;
  return e.repeat ? Math.round(full * 0.6) : full;
}

/**
 * Rough cutscene duration of an event batch so bots / watchdog wait for the animation (Rule 3: the state is
 * already final — this is only pacing). Must stay in sync with client/js/monopoly_bridge.js timings.
 * `botTurn` = the acting seat is a bot → the client replays it at ROOM.BOT_SPEED.
 */
export function cutsceneMs(events = [], { botTurn = false } = {}) {
  let ms = 0;
  for (const e of events) {
    switch (e.t) {
      case 'dice': ms += 900; break;
      case 'move': ms += e.kind === 'warp' ? 700 : 260 * (e.path?.length || 1); break;
      case 'ult': ms += ultMs(e, 1600); break;
      case 'pet_combo': ms += ultMs(e, 3500); break;
      case 'chaos_event': ms += 1400; break;
      case 'duel': ms += 1400; break;
      case 'event_tile': ms += 700; break;
      case 'rent': case 'buy': case 'upgrade': case 'takeover': case 'tier': case 'steal': case 'swap': ms += 450; break;
      case 'bankrupt': ms += 1200; break;
      default:
    }
  }
  if (botTurn) ms = Math.round(ms / ROOM.BOT_SPEED);
  return Math.min(ms, 12_000);
}

export class TableManager {
  /**
   * @param {object} o
   * @param {() => number} [o.now]
   * @param {() => number} [o.seedFn]          match seed source
   * @param {(userId) => object} o.playerInfo  → { name, lineage, outfit, outfitRarity, affinity, petId, petFamily, petPct, partnerId, stats, equipped }
   * @param {(table, result) => object} [o.onMatchEnd]  → { [userId]: rewards } (server pays out; solo returns {})
   * @param {(userId, auto) => void} [o.onPetAuto]     persist the 🐾 Auto/Manual setting (server → profile)
   */
  constructor({ now = () => Date.now(), seedFn = () => (Math.random() * 2 ** 31) | 0, playerInfo, onMatchEnd = () => ({}), onPetAuto = () => {}, maxRounds = MONO.MAX_ROUNDS, games = {} } = {}) {
    this.now = now;
    this.maxRounds = maxRounds;
    this.seedFn = seedFn;
    this.playerInfo = playerInfo || ((id) => ({ name: id }));
    this.onMatchEnd = onMatchEnd;
    this.onPetAuto = onPetAuto;
    this.games = games;
    this.petAutoPref = new Map();  // userId -> last toggled Auto value (solo/local hosts without a profile store)
    this.tables = new Map();       // tableId -> table
    this.byUser = new Map();       // userId -> tableId
    this.connected = new Set();
    this.nextNum = ROOM.FIRST_TABLE_NUM;
    this.out = [];
  }

  // -------------------------------------------------------------------------------- messaging
  flush() { const o = this.out; this.out = []; return o; }
  send(to, msg) { this.out.push({ to, msg }); }
  humans(t) { return t.seats.filter((s) => s.kind === 'human').map((s) => s.userId); }
  error(userId, error, reqId = null) { this.send([userId], { type: 'table_error', error, reqId }); return { ok: false, error }; }

  publicTable(t) {
    const options = { matchMode: t.options?.matchMode || 'normal' };
    if (t.mode === 'casino') {
      options.casinoGame = t.options?.casinoGame || 'pokdeng';
    }
    return {
      id: t.id, num: t.num, name: t.name, mode: t.mode, hostId: t.hostId, status: t.status, solo: !!t.solo,
      options,
      seats: t.seats.map((s, idx) => ({ idx, kind: s.kind, userId: s.userId || null, name: s.name || null, botDiff: s.botDiff || null, ready: !!s.ready, connected: s.kind !== 'human' || this.connected.has(s.userId), lineage: s.lineage || null, outfit: s.outfit || null, level: s.level || null })),
      players: t.seats.filter((s) => s.kind !== 'empty').length,
      humans: this.humans(t).length,
    };
  }

  matchView(t) {
    if (!t.match) return null;
    const { events, ...rest } = t.match;  // events are delivered separately in order
    return { ...rest, deadline: t.deadline, seatOf: t.seatOf };
  }

  pushState(t, extra = {}) {
    const table = this.publicTable(t);
    for (const uid of this.humans(t)) this.send([uid], { type: 'table_state', table, match: this.matchView(t), yourSeat: t.seatOf?.[uid] ?? null, ...extra });
  }

  pushList(mode) {
    this.send('lobby', { type: 'table_list_update', mode, tables: this.list(mode) });
  }

  list(mode = null) {
    return [...this.tables.values()].filter((t) => (!mode || t.mode === mode) && !t.solo).map((t) => this.publicTable(t))
      .sort((a, b) => (a.status === 'lobby' ? 0 : 1) - (b.status === 'lobby' ? 0 : 1) || a.num - b.num);
  }

  // -------------------------------------------------------------------------------- lobby
  info(userId) {
    const i = this.playerInfo(userId) || {};
    return { name: i.name || userId, lineage: i.lineage || 'bkk', outfit: i.outfit || 'newbie_outfit', level: i.level || 1 };
  }

  create(userId, { mode = 'monopoly', name = null, solo = false, matchMode = 'normal', options = {}, casinoGame } = {}) {
    if (!MODES[mode]) return this.error(userId, 'bad_mode');
    if (!MODES[mode].available) return this.error(userId, 'mode_locked');
    if (this.tables.size >= ROOM.MAX_TABLES) return this.error(userId, 'too_many_tables');
    this.leave(userId, { silent: true });
    const num = this.nextNum++;
    const me = this.info(userId);
    const resolvedMatchMode = MATCH_MODES.includes(matchMode) ? matchMode : 'normal';
    const rawCg = casinoGame ?? options?.casinoGame ?? 'pokdeng';
    const resolvedCg = ['pokdeng', 'roulette'].includes(rawCg) ? rawCg : 'pokdeng';
    const tableOptions = { matchMode: resolvedMatchMode };
    if (mode === 'casino') tableOptions.casinoGame = resolvedCg;
    const t = {
      id: `t${num}`, num, mode, solo, hostId: userId, status: 'lobby', createdAt: this.now(),
      name: name || `${me.name}'s ${solo ? 'Solo' : 'VIP'} Room`,
      options: tableOptions,
      seats: Array.from({ length: ROOM.SEATS }, () => ({ kind: 'empty' })),
      match: null, seatOf: null, deadline: null, nextBotAt: 0, emptySince: null,
    };
    t.seats[0] = { kind: 'human', userId, ready: true, ...me };
    this.tables.set(t.id, t);
    this.byUser.set(userId, t.id);
    this.connected.add(userId);
    this.pushState(t);
    if (!solo) this.pushList(mode);
    return { ok: true, tableId: t.id };
  }

  sit(userId, tableId, seatIdx = null) {
    const t = this.tables.get(tableId);
    if (!t) return this.error(userId, 'no_table');
    if (t.solo && t.hostId !== userId) return this.error(userId, 'private_table');
    if (this.byUser.get(userId) === tableId) {
      // switching chairs inside the same lobby
      if (t.status !== 'lobby' || seatIdx == null) return { ok: true, tableId };
      const from = t.seats.findIndex((s) => s.userId === userId);
      const to = t.seats[seatIdx];
      if (!to || to.kind === 'human') return this.error(userId, 'seat_taken');
      [t.seats[from], t.seats[seatIdx]] = [t.seats[seatIdx], t.seats[from]];
      this.pushState(t); return { ok: true, tableId };
    }
    if (t.status !== 'lobby') {
      if (t.mode === 'casino' && t.status === 'playing') {
        // mid-session join allowed for casino
      } else {
        return this.error(userId, 'match_running');
      }
    }
    let idx = seatIdx;
    if (idx == null) idx = t.seats.findIndex((s) => s.kind === 'empty');
    if (idx < 0) idx = t.seats.findIndex((s) => s.kind === 'bot');      // "claims the next chair" (replaces a bot)
    const seat = t.seats[idx];
    if (!seat || seat.kind === 'human') return this.error(userId, 'seat_taken');
    this.leave(userId, { silent: true });
    t.seats[idx] = { kind: 'human', userId, ready: t.status === 'playing', ...this.info(userId) };
    this.byUser.set(userId, t.id);
    this.connected.add(userId);
    if (t.seatOf) t.seatOf[userId] = idx;
    this.pushState(t);
    if (!t.solo) this.pushList(t.mode);
    if (t.mode !== 'monopoly' && this.games?.[t.mode]?.onJoin) {
      try { this.games[t.mode].onJoin(t, userId, idx); } catch {}
    }
    return { ok: true, tableId: t.id, seatIdx: idx };
  }

  leave(userId, { silent = false } = {}) {
    const id = this.byUser.get(userId);
    if (!id) return { ok: true };
    this.byUser.delete(userId);
    const t = this.tables.get(id);
    if (!t) return { ok: true };
    if (t.mode !== 'monopoly' && this.games?.[t.mode]?.leave) {
      try { this.games[t.mode].leave(t, userId); } catch {}
    }
    const idx = t.seats.findIndex((s) => s.userId === userId);
    if (idx >= 0) {
      if (t.status === 'playing') {
        if (t.mode === 'monopoly') {
          // never freeze the room: the leaver's seat is taken over by a Hard bot for the rest of the match
          t.seats[idx] = { ...t.seats[idx], kind: 'bot', botDiff: 'hard', leftUserId: userId, userId: null, name: `${t.seats[idx].name} (AFK)` };
          const p = t.match.players[t.seatOf[userId]];
          if (p) { p.isBot = true; p.botDiff = 'hard'; }
        } else {
          // DO NOT convert to bot for casino
          t.seats[idx] = { kind: 'empty' };
        }
      } else t.seats[idx] = { kind: 'empty' };
    }
    if (!this.humans(t).length) this.tables.delete(t.id);
    else {
      if (t.hostId === userId) t.hostId = this.humans(t)[0];
      if (!silent) this.pushState(t);
    }
    if (!t.solo) this.pushList(t.mode);
    return { ok: true };
  }

  setBot(userId, seatIdx, diff) {
    const t = this.tableOf(userId);
    if (!t) return this.error(userId, 'no_table');
    if (t.hostId !== userId) return this.error(userId, 'host_only');
    if (t.status !== 'lobby') return this.error(userId, 'match_running');
    const s = t.seats[seatIdx];
    if (!s || s.kind === 'human') return this.error(userId, 'seat_taken');
    if (diff == null) t.seats[seatIdx] = { kind: 'empty' };
    else if (!BOT_DIFFS.includes(diff)) return this.error(userId, 'bad_diff');
    else t.seats[seatIdx] = { kind: 'bot', botDiff: diff, ready: true, name: BOT_NAMES[seatIdx % BOT_NAMES.length], lineage: seatIdx % 2 ? 'dxb' : 'bkk', outfit: BOT_OUTFITS[diff] };
    this.pushState(t);
    if (!t.solo) this.pushList(t.mode);
    return { ok: true };
  }

  setReady(userId, ready = true) {
    const t = this.tableOf(userId);
    if (!t || t.status !== 'lobby') return this.error(userId, 'no_table');
    const s = t.seats.find((q) => q.userId === userId);
    s.ready = !!ready;
    this.pushState(t);
    return { ok: true };
  }

  tableOf(userId) { return this.tables.get(this.byUser.get(userId)); }

  /** Couple / friend table: every other human is the host's partner or friend (either direction). Pure. */
  isPrivateTable(t, infos = {}) {
    if (t.solo) return true;
    const host = t.hostId;
    const hi = infos[host] || this.playerInfo(host) || {};
    return this.humans(t).every((u) => {
      if (u === host) return true;
      const ui = infos[u] || this.playerInfo(u) || {};
      return hi.partnerId === u || ui.partnerId === host || (hi.friendIds || []).includes(u) || (ui.friendIds || []).includes(host);
    });
  }

  /** 🎉 host toggles Chaos Party in the lobby (validated again at start), or casino options. */
  setOption(userId, opts = {}) {
    const t = this.tableOf(userId);
    if (!t) return this.error(userId, 'no_table');
    if (t.hostId !== userId) return this.error(userId, 'host_only');
    if (t.status !== 'lobby') return this.error(userId, 'match_running');
    const mm = opts.matchMode ?? opts.options?.matchMode;
    const cg = opts.casinoGame ?? opts.options?.casinoGame;
    let changed = false;
    if (mm != null) {
      if (!MATCH_MODES.includes(mm)) return this.error(userId, 'bad_option');
      t.options = { ...(t.options || {}), matchMode: mm };
      changed = true;
    }
    if (cg != null) {
      if (!['pokdeng', 'roulette'].includes(cg)) return this.error(userId, 'bad_option');
      t.options = { ...(t.options || {}), casinoGame: cg };
      changed = true;
    }
    if (!changed) return this.error(userId, 'bad_option');
    this.pushState(t);
    if (!t.solo) this.pushList(t.mode);
    return { ok: true };
  }

  start(userId) {
    const t = this.tableOf(userId);
    if (!t) return this.error(userId, 'no_table');
    if (t.hostId !== userId) return this.error(userId, 'host_only');
    if (t.status === 'playing') return this.error(userId, 'match_running');
    const occupied = t.seats.map((s, idx) => ({ s, idx })).filter(({ s }) => s.kind !== 'empty');
    if (occupied.length < MODES[t.mode].minSeats) return this.error(userId, 'need_players');
    if (occupied.some(({ s }) => s.kind === 'human' && s.userId !== userId && !s.ready)) return this.error(userId, 'not_ready');

    if (t.mode !== 'monopoly') {
      const g = this.games?.[t.mode];
      if (!g) return this.error(userId, 'mode_unavailable');
      t.status = 'playing';
      t.startedAt = this.now();
      t.seatOf = {};
      t.seats.forEach((s, idx) => { if (s.userId) t.seatOf[s.userId] = idx; });
      g.start(t);
      this.pushState(t);
      if (!t.solo) this.pushList(t.mode);
      return { ok: true };
    }
    const infos = {};
    for (const u of this.humans(t)) infos[u] = this.playerInfo(u) || {};
    const privateTable = this.isPrivateTable(t, infos);
    const chaos = t.options?.matchMode === 'chaos';
    if (chaos && !privateTable) return this.error(userId, 'chaos_private_only');
    t.seatOf = {};
    const players = occupied.map(({ s, idx }, k) => {
      if (s.kind === 'human') {
        t.seatOf[s.userId] = k;
        const { friendIds, ...i } = infos[s.userId];   // friend lists never enter the public match state
        void friendIds;
        const pref = this.petAutoPref.get(s.userId);
        return { ...i, ...(pref != null ? { petAuto: pref } : {}), id: s.userId, name: i.name || s.name, isBot: false, tableSeat: idx };
      }
      return { id: `bot${idx}`, name: s.name, isBot: true, botDiff: s.botDiff, lineage: s.lineage, outfit: s.outfit, equipped: { outfit: { id: s.outfit, refine: 0 } }, petId: BOT_PETS[idx] || 'pet_skywhale', petBond: BOT_PET_BOND[s.botDiff] || 1, petAuto: true, outfitRarity: s.outfit?.startsWith('s') ? 3 : s.outfit?.startsWith('epic') ? 2 : 1, tableSeat: idx };
    });
    t.match = createMatch({ players, seed: this.seedFn() >>> 0, tableId: t.id, maxRounds: this.maxRounds, mode: chaos ? 'chaos' : 'normal', publicTable: !privateTable });
    for (const p of t.match.players) p.tableSeat = players[p.seat].tableSeat;
    t.status = 'playing';
    t.startedAt = this.now();
    const events = drainEvents(t.match);
    this.schedule(t, events);
    this.pushState(t, { events });
    if (!t.solo) this.pushList(t.mode);
    return { ok: true };
  }

  /** "⚡ Play Solo Now (Instant)": private table, 3 bots, starts immediately. */
  solo(userId, { mode = 'monopoly', diff = 'hard', matchMode = 'normal', ...opts } = {}) {
    const r = this.create(userId, { mode, solo: true, matchMode, ...opts });
    if (!r.ok) return r;
    for (let k = 1; k < ROOM.SEATS; k++) this.setBot(userId, k, BOT_DIFFS.includes(diff) ? diff : 'hard');
    return { ...this.start(userId), tableId: r.tableId };
  }

  /** "Play Again (Keep 4-Seat Table!)" */
  rematch(userId) {
    const t = this.tableOf(userId);
    if (!t || t.status !== 'ended') return this.error(userId, 'no_table');
    t.status = 'lobby';
    t.match = null; t.seatOf = null; t.deadline = null; t.podiumRewards = null;
    t.seats = t.seats.map((s) => (s.leftUserId ? { kind: 'empty' } : { ...s, ready: s.kind === 'bot' || s.userId === t.hostId }));
    this.pushState(t);
    if (t.solo) return this.start(t.hostId);
    this.pushList(t.mode);
    return { ok: true };
  }

  // -------------------------------------------------------------------------------- match
  schedule(t, events, { botTurn = false } = {}) {
    const now = this.now();
    const anim = cutsceneMs(events, { botTurn });
    t.nextBotAt = now + anim + ROOM.BOT_THINK_MS;
    t.deadline = now + anim + ROOM.TURN_MS;
  }

  /** Apply one game action for match seat `seat` (human or bot) and broadcast the resolved turn. */
  apply(t, seat, action) {
    const m = t.match;
    const p = m.players[seat];
    // AFK / timeout / disconnected autopilot behaves like 🐾 Auto for this turn
    if (action.auto && m.turn?.seat === seat) m.turn.autopilot = true;
    let r;
    if (action.type === 'roll') r = roll(m, seat, { use2d6: !!action.use2d6 });
    else if (action.type === 'ultimate') r = ultimate(m, seat);
    else if (action.type === 'decide') r = decide(m, seat, { choice: action.choice });
    else if (action.type === 'pet_cast') r = petUltimate(m, seat);
    else if (action.type === 'pet_arm') r = petArm(m, seat, action.armed !== false);
    else if (action.type === 'pet_auto') r = setPetAuto(m, seat, action.auto_ !== false);
    else r = { ok: false, error: 'bad_action' };
    if (!r.ok) return r;
    const events = drainEvents(m);
    // toggles (arm / auto) never move the turn on → don't refresh the AFK watchdog (no stalling exploit)
    if (action.type !== 'pet_arm' && action.type !== 'pet_auto') this.schedule(t, events, { botTurn: !!p?.isBot });
    const view = this.matchView(t);
    for (const uid of this.humans(t)) this.send([uid], { type: 'mono_turn_resolved', tableId: t.id, events, match: view, yourSeat: t.seatOf[uid] ?? null, by: seat, auto: !!action.auto, botTurn: !!p?.isBot });
    if (m.ended) this.finish(t);
    return r;
  }

  finish(t) {
    t.status = 'ended';
    t.deadline = null;
    let rewards = {};
    try { rewards = this.onMatchEnd(t, t.match.result) || {}; } catch { rewards = {}; }
    t.podiumRewards = rewards;
    for (const uid of this.humans(t)) {
      this.send([uid], { type: 'match_victory_podium', tableId: t.id, result: t.match.result, rewards: rewards[uid] || null, yourSeat: t.seatOf[uid] ?? null });
    }
    if (!t.solo) this.pushList(t.mode);
  }

  act(userId, action) {
    const t = this.tableOf(userId);
    if (!t || t.status !== 'playing') return this.error(userId, 'no_match', action.reqId);
    const seat = t.seatOf[userId];
    if (seat == null) return this.error(userId, 'not_seated', action.reqId);
    const r = this.apply(t, seat, action);
    if (!r.ok) this.error(userId, r.error, action.reqId);
    return r;
  }

  /** 🐾 Auto/Manual toggle: works in or out of a match and is persisted through onPetAuto. */
  petAutoToggle(userId, auto, reqId = null) {
    const t = this.tableOf(userId);
    const seat = t?.status === 'playing' ? t.seatOf?.[userId] : null;
    const cur = seat != null ? t.match.players[seat]?.petAuto !== false : (this.petAutoPref.get(userId) ?? this.playerInfo(userId)?.petAuto ?? true);
    const next = typeof auto === 'boolean' ? auto : !cur;
    this.petAutoPref.set(userId, next);
    try { this.onPetAuto(userId, next); } catch { /* persistence is best-effort */ }
    if (seat != null) return this.act(userId, { type: 'pet_auto', auto_: next, reqId });
    return { ok: true, auto: next };
  }

  /** Drive bots + the 12 s watchdog. Call every ~200 ms (server) or every frame (solo). */
  tick() {
    const now = this.now();
    for (const t of [...this.tables.values()]) {
      if (t.status === 'playing') {
        if (t.mode !== 'monopoly') {
          if (this.games?.[t.mode]?.tick) {
            this.games[t.mode].tick(t, now);
          }
        } else {
          const m = t.match;
          const seat = m.turn.seat;
          const p = m.players[seat];
          const humanId = p.isBot ? null : p.id;
          const away = humanId && !this.connected.has(humanId) && !t.solo;
          if ((p.isBot || away) && now >= t.nextBotAt) {
            const a = botAction(m, seat, p.isBot ? p.botDiff : 'hard');
            if (a) this.apply(t, seat, { ...a, auto: !p.isBot });
          } else if (humanId && !t.solo && t.deadline && now >= t.deadline) {
            const a = botAction(m, seat, 'hard');                    // AFK autopilot (§21.E.2)
            if (a) this.apply(t, seat, { ...a, auto: true });
          }
        }
      }
      // close tables nobody can see any more
      const anyone = this.humans(t).some((u) => this.connected.has(u));
      if (anyone) t.emptySince = null;
      else if (t.emptySince == null) t.emptySince = now;
      else if (now - t.emptySince > ROOM.RECONNECT_GRACE_MS) {
        for (const u of this.humans(t)) this.byUser.delete(u);
        this.tables.delete(t.id);
        if (!t.solo) this.pushList(t.mode);
      }
    }
  }

  connect(userId) {
    this.connected.add(userId);
    const t = this.tableOf(userId);
    if (!t) return;
    this.pushState(t, { resumed: true });     // §21.E.2 reconnect: re-attach + live snapshot
    if (t.status === 'playing' && t.mode !== 'monopoly' && this.games?.[t.mode]?.onJoin) {
      try { this.games[t.mode].onJoin(t, userId); } catch {}
    }
    if (t.status === 'ended' && t.match?.result) {
      this.send([userId], {
        type: 'match_victory_podium',
        tableId: t.id,
        result: t.match.result,
        rewards: t.podiumRewards?.[userId] || null,
        yourSeat: t.seatOf?.[userId] ?? null,
      });
    }
  }

  disconnect(userId) {
    this.connected.delete(userId);
    const t = this.tableOf(userId);
    if (!t) return;
    if (t.mode !== 'monopoly' && this.games?.[t.mode]?.leave) {
      try { this.games[t.mode].leave(t, userId); } catch {}
    }
    if (t.status === 'lobby') this.leave(userId);
    else this.pushState(t);
  }

  /** Single entry point for every table_* / mono_* client message. */
  handle(userId, m) {
    if (m?.type === 'casino_leave') return this.leave(userId);
    if (typeof m?.type === 'string' && m.type.startsWith('casino_')) {
      const t = this.tableOf(userId) || (m.tableId ? this.tables.get(m.tableId) : null);
      if (!t) return this.error(userId, 'no_table');
      const game = this.games?.[t.mode];
      if (!game?.handle) return this.error(userId, 'mode_unavailable');
      return game.handle(t, userId, m);
    }
    switch (m.type) {
      case 'table_list': this.send([userId], { type: 'table_list_update', mode: m.mode || null, tables: this.list(m.mode || null) }); return { ok: true };
      case 'table_create': return this.create(userId, {
        mode: String(m.mode || 'monopoly'),
        name: typeof m.name === 'string' ? m.name.slice(0, 32) : null,
        matchMode: matchModeOf(m),
        options: m.options,
        casinoGame: m.casinoGame ?? m.options?.casinoGame,
      });
      case 'table_sit': return this.sit(userId, String(m.tableId || ''), Number.isInteger(m.seatIdx) ? m.seatIdx : null);
      case 'table_leave': return this.leave(userId);
      case 'table_set_bot': return this.setBot(userId, m.seatIdx | 0, m.diff == null ? null : String(m.diff));
      case 'table_ready': return this.setReady(userId, m.ready !== false);
      case 'table_start': return this.start(userId);
      case 'table_solo': return this.solo(userId, {
        mode: String(m.mode || 'monopoly'),
        diff: String(m.diff || 'hard'),
        matchMode: matchModeOf(m),
        casinoGame: m.casinoGame ?? m.options?.casinoGame,
        options: m.options,
      });
      case 'table_set_option': return this.setOption(userId, {
        matchMode: m.matchMode ?? m.options?.matchMode,
        casinoGame: m.casinoGame ?? m.options?.casinoGame,
        options: m.options,
      });
      case 'table_rematch': return this.rematch(userId);
      case 'mono_roll': return this.act(userId, { type: 'roll', use2d6: !!m.use2d6, reqId: m.reqId });
      case 'mono_ult': return this.act(userId, { type: 'ultimate', reqId: m.reqId });
      case 'mono_pet_cast': return this.act(userId, { type: 'pet_cast', reqId: m.reqId });
      case 'mono_pet_arm': return this.act(userId, { type: 'pet_arm', armed: m.armed !== false, reqId: m.reqId });
      case 'mono_pet_toggle_auto': return this.petAutoToggle(userId, typeof m.auto === 'boolean' ? m.auto : null, m.reqId);
      case 'mono_buy':
      case 'mono_event_choice': {
        const t = this.tableOf(userId);
        const pd = t?.match?.pending;
        const choice = m.choice ?? (m.type === 'mono_buy' ? pd?.options?.[0]?.id : null);
        return this.act(userId, { type: 'decide', choice, reqId: m.reqId });
      }
      default: return this.error(userId, 'bad_type', m.reqId);
    }
  }
}

export { legalActions };
