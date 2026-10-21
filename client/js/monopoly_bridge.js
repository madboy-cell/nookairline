// client/js/monopoly_bridge.js — glue between the room transport, the Table Hub (Screen 09), the 2.5D board
// (Screen 10) and the podium (Screen 11).
//
// "State First, Cutscene Second": every mono_turn_resolved carries the FINAL authoritative match plus the
// ordered event list. The bridge replays the events as cutscenes (dice → hops → rent coins → cut-ins),
// then reconciles the board and HUD to the final state. Controls stay locked while a cutscene plays.
//
// Integration: standalone today (own RAF loop via start()); later SceneManager can call update(dt) and
// render with board.scene / board.camera on the shared WebGL canvas.
import { MonopolyBoard, tokenModules } from './minigames/monopoly_25d/board_scene.js';
import { MonopolyHud } from './minigames/monopoly_25d/hud.js';
import { sfx } from './minigames/monopoly_25d/sfx.js';
import { TableHub } from './table_hub.js?v=mst4';
import { legalActions, scoreboard } from '/shared/monopoly_engine.js';
import { TILES, MONO, rentFor, wrap } from '/shared/monopoly_rules.js';

const fmt = (n) => Number(Math.round(n || 0)).toLocaleString('en-US');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const STATUS_TXT = { skipTurn: '❄️ FROZEN!', fixedRoll: '🌙 Sleepwalk!', moveDir: '⏪ REVERSE!', maxRoll: '🌌 SLOW-MO!', lapTax: '🎡 Heist!', discountPct: '🔥 −50% Underdog' };

export class MonopolyBridge {
  /**
   * @param {object} o
   * @param {HTMLElement} o.container   phone-shell element the overlays are appended to
   * @param {THREE.WebGLRenderer} o.renderer
   * @param {object} o.room             LocalRoom | NetRoom
   * @param {(msg) => void} [o.toast]
   * @param {() => void} [o.onExit]     leave the minigame (back to village / Town Hall)
   */
  constructor({ container, renderer, room, toast = () => {}, onExit = () => {}, onEnterMatch = () => {}, onLeaveMatch = () => {}, onCasinoStart = () => {}, onMoonDefenseStart = () => {}, onCloudDashStart = () => {} }) {
    this.onEnterMatch = onEnterMatch;
    this.onLeaveMatch = onLeaveMatch;
    this.container = container;
    this.renderer = renderer;
    this.room = room;
    this.toast = toast;
    this.onExit = onExit;
    this.onCasinoStart = onCasinoStart;
    this.onMoonDefenseStart = onMoonDefenseStart;
    this.onCloudDashStart = onCloudDashStart;
    this.queue = [];
    this.playing = false;
    this.match = null;
    this.yourSeat = null;
    this.table = null;
    this.podium = null;
    this.busyInput = false;
    this.active = false;

    this.hub = new TableHub(container, room, {
      toast,
      onClose: () => this.exit(),
      onCasinoStart: (table) => this.onCasinoStart?.(table),
      onMoonDefenseStart: (table) => this.onMoonDefenseStart?.(table),
      onCloudDashStart: (table) => this.onCloudDashStart?.(table),
    });
    this.layer = document.createElement('div');
    this.layer.className = 'mono-layer';
    this.layer.hidden = true;
    container.appendChild(this.layer);
    this.hud = new MonopolyHud(this.layer, {
      onRoll: (use2d6) => this.act({ type: 'mono_roll', use2d6 }),
      onUlt: () => this.act({ type: 'mono_ult' }),
      onPetToggleAuto: (auto) => this.room.send({ type: 'mono_pet_toggle_auto', auto }),
      onPetArm: (armed) => this.room.send({ type: 'mono_pet_arm', armed }),
      onPetCast: () => this.act({ type: 'mono_pet_cast' }),
      onDecide: (choice) => this.act({ type: 'mono_event_choice', choice }),
      onCam: () => this.toggleCam(),
      onExit: () => this.leaveMatch(),
      onRematch: () => {
        this._matchGen = (this._matchGen || 0) + 1;
        this.hud.hidePodium();
        this.hud.hideDecision();
        this.podium = null;
        this._shownPodium = null;
        this.queue = [];
        this.match = null;
        this.busyInput = false;
        this.room.send({ type: 'table_rematch' });
      },
      onMute: () => { sfx.setMuted(!sfx.muted); return sfx.muted; },
    });
    this._matchGen = 0;

    this.off = [
      room.on('table_state', (m) => this.onTableState(m)),
      room.on('mono_turn_resolved', (m) => this.enqueue(m)),
      room.on('match_victory_podium', (m) => { this.podium = m; this.pump(); }),
      room.on('table_error', (m) => { if (this.active) { this.busyInput = false; this.refreshControls(); } void m; }),
    ];
    this._resize = () => this.measureSafe();
    window.addEventListener('resize', this._resize);
    container.addEventListener('pointerdown', () => sfx.unlock(), { once: true });
  }

  // ------------------------------------------------------------------------- lifecycle
  openHub() { this.hub.open(); }

  exit() {
    this.hub.close();
    this.stopMatchView();
    this.onExit();
  }

  leaveMatch() {
    if (this.match && !this.match.ended && !confirm('Leave the match? A Hard bot will take over your seat.')) return;
    this.room.send({ type: 'table_leave' });
    this.stopMatchView();
    this.hub.table = null;
    this.hub.open();
  }

  ensureBoard() {
    if (this.board) return;
    this.board = new MonopolyBoard({ renderer: this.renderer, onFloat: (text, pos, opts) => this.hud.float(text, pos, opts) });
  }

  startMatchView() {
    this.ensureBoard();
    if (!this.active) { this.onEnterMatch(this); this.board.camForced = null; this.board.camMode = 'follow'; this.hud.setCamLabel('follow'); }
    this.active = true;
    this.layer.hidden = false;
    this.hub.close();
    this.measureSafe();
    requestAnimationFrame(() => this.measureSafe());   // after the HUD has laid out
  }

  /** Free band between the top player cards and the bottom thumb zone → the camera centres the action there. */
  measureSafe() {
    if (!this.board) return;
    const c = this.renderer.domElement.getBoundingClientRect();
    const cards = this.layer.querySelector('.mono-cards')?.getBoundingClientRect();
    const thumb = this.layer.querySelector('.mono-turn-hint')?.getBoundingClientRect();
    const top = cards && !this.layer.hidden ? cards.bottom - c.top + 8 : 0;
    const bottom = thumb && !this.layer.hidden ? c.bottom - Math.min(thumb.top, thumb.bottom) + 8 : 0;
    this.board.setSafeBand(top, bottom);
  }

  stopMatchView() {
    this._matchGen = (this._matchGen || 0) + 1;
    clearTimeout(this._botWatchdogTimer);
    if (this.active) this.onLeaveMatch(this);
    this.active = false;
    this.layer.hidden = true;
    this.queue = [];
    this.match = null;
    this.hud.hideDecision();
    this.hud.hidePodium();
    this.podium = null;
    this._shownPodium = null;
  }

  /** Own render loop for standalone use (dev page). */
  start() {
    let last = performance.now();
    const loop = (now) => {
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      this.update(dt);
      this.render();
    };
    this.raf = requestAnimationFrame(loop);
  }

  update(dt) { this.board?.update(dt); }
  render() { if (this.board) this.renderer.render(this.board.scene, this.board.camera); }

  destroy() {
    clearTimeout(this._botWatchdogTimer);
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this._resize);
    this.off.forEach((f) => f?.());
    this.hub.destroy();
    this.hud.destroy();
    this.board?.dispose();
    this.layer.remove();
  }

  _matchVer(m) {
    if (!m) return -1;
    return (m.turn?.n || 0) * 100000 + (m.eventSeq || 0) + (m.ended ? 50000 : 0);
  }

  // ------------------------------------------------------------------------- room messages
  async onTableState(m) {
    this.table = m.table;
    if (m.table?.mode === 'casino' || m.table?.mode === 'moon_bunny' || m.table?.mode === 'cloud_dash') return;
    await tokenModules;
    if ((m.table?.status === 'playing' || (m.table?.status === 'ended' && (this.active || m.resumed))) && m.match) {
      const sameMatch = Boolean(
        this.match?.tableId &&
        this.match.tableId === m.match.tableId &&
        this.match?.seed === m.match.seed &&
        !(this.match.ended && !m.match.ended)
      );
      const fresh = !this.active || !sameMatch || m.resumed;
      this.yourSeat = m.yourSeat;
      if (fresh) {
        if (!sameMatch) {
          this._matchGen = (this._matchGen || 0) + 1;
          this.hud.hidePodium();
          this.hud.hideDecision();
          this.podium = null;
          this._shownPodium = null;
          this.busyInput = false;
        }
        this.startMatchView();
        const incomingVer = this._matchVer(m.match);
        // Keep any queued turn batches that belong to the same match and are strictly newer than this table_state snapshot
        this.queue = sameMatch
          ? this.queue.filter((b) => this._matchVer(b.match) > incomingVer)
          : [];
        if (!sameMatch || incomingVer >= this._matchVer(this.match)) {
          this.applyFinal(m.match, { snap: true });
          this.hud.setPlayers(m.match.players, m.yourSeat);
          this.hud.updateCards(scoreboard(m.match), m.match.turn?.seat, m.match.players);
        }
        if (m.events?.length && (!sameMatch || incomingVer >= this._matchVer(this.match))) {
          this.enqueue({ events: m.events, match: m.match });
        } else if (this.queue.length) {
          this.pump();
        } else if (!this.playing) {
          this.refreshControls();
        }
      }
      return;
    }
    if (m.table?.status === 'lobby' && this.active && !this.podium && !m.table.solo) {
      // rematch in a multiplayer lobby → back to the hub with the same 4-seat table
      this.stopMatchView();
      this.hub.table = m.table;
      this.hub.open();
    }
  }

  enqueue(m) {
    this.queue.push(m);
    this.pump();
  }

  async pump() {
    if (this.playing) return;
    this.playing = true;
    try {
      await tokenModules;
      this.ensureBoard();
      while (this.queue.length) {
        const batch = this.queue.shift();
        const gen = this._matchGen;
        if (batch.match && this.match && (batch.match.tableId !== this.match.tableId || batch.match.seed !== this.match.seed)) {
          continue;
        }
        this.yourSeat = batch.yourSeat ?? this.yourSeat;
        this.hud.hideDecision();
        this.refreshControls(true);
        try {
          await this.playBatch(batch.events || [], batch.match, gen);
        } catch (err) {
          console.warn('[MonopolyBridge] playBatch error:', err);
        }
        if (gen !== this._matchGen) continue;
        if (batch.match) {
          const sameMatch = Boolean(
            this.match?.tableId &&
            this.match.tableId === batch.match.tableId &&
            this.match?.seed === batch.match.seed
          );
          if (sameMatch && this._matchVer(batch.match) >= this._matchVer(this.match)) {
            this.applyFinal(batch.match);
          }
        }
      }
      if (this.podium && this.match && this._shownPodium !== this.podium) {
        this._shownPodium = this.podium;
        this.match.ended = true;
        this.match.result = this.podium.result || this.match.result;
        this.board?.syncFromMatch(this.match);
        await this.showPodium();
      }
    } finally {
      this.playing = false;
    }
    // must run AFTER `playing` is released, otherwise ROLL stays locked
    if (this.queue.length || (this.podium && this.match && this._shownPodium !== this.podium)) this.pump();
    else if (!(this.podium && this.match?.ended)) this.refreshControls();
  }

  applyFinal(match, { snap = false } = {}) {
    this.match = match;
    this.board.localSeat = this.yourSeat;
    this.board.syncFromMatch(match, { snap });
    this.hud.setRound(match.round, match.maxRounds || MONO.MAX_ROUNDS, !!match.chaos);
    this.hud.updateCards(scoreboard(match), match.turn?.seat, match.players);
    this.busyInput = false;
  }

  refreshControls(busy = false) {
    clearTimeout(this._botWatchdogTimer);
    const m = this.match;
    if (!m) return;
    const seat = this.yourSeat;
    const la = seat != null ? legalActions(m, seat) : { myTurn: false };
    const me = seat != null ? m.players[seat] : null;
    const cur = m.players[m.turn?.seat];
    const lock = busy || this.playing || this.busyInput || m.ended;
    this.hud.setControls({
      myTurn: la.myTurn, canRoll: la.canRoll, can2d6: la.can2d6, canUlt: la.canUlt, boost: me?.boost ?? 0, ult: me?.ult ?? 0,
      petUlt: me?.petUlt ?? 0, petCostume: me?.petCostume || me?.equipped?.pet?.costume_id || null,
      hasPet: la.hasPet, petReady: la.petReady, canPetCast: la.canPetCast, canPetArm: la.canPetArm,
      petAuto: la.petAuto, petArmed: la.petArmed, petCastsLeft: la.petCastsLeft,
      busy: lock, waitingName: cur && !la.myTurn ? cur.name : null,
      deadline: !this.room.local && m.deadline ? m.deadline - (m.serverSkew || 0) : null,
      fixedRoll: me?.status?.fixedRoll || 0,
      moveDir: me?.status?.moveDir || 1,
      maxRoll: me?.status?.maxRoll || 0,
      skipTurn: Boolean(me?.status?.skipTurn),
    });
    if (!lock && la.pending) this.hud.showDecision(la.pending, m, seat);
    // auto camera: always follow whoever is acting; Overview is a manual toggle only
    if (!this.board.camForced) this.board.camMode = 'follow';
    this.board.followSeat = m.turn?.seat ?? this.board.followSeat;

    // Bot-turn resync watchdog: if the client is idle waiting for a bot turn for > 3.2s, resync state
    if (!lock && !m.ended && cur?.isBot && !la.myTurn && !this.queue.length) {
      const stuckVer = this._matchVer(m);
      this._botWatchdogTimer = setTimeout(() => {
        if (!this.active || this.playing || this.queue.length || this._matchVer(this.match) !== stuckVer) return;
        if (this.room?.local) {
          this.room.mgr?.tick?.();
          this.room.flush?.();
        } else if (this.room?.net) {
          if (this.room.net.ws?.readyState === 1) {
            this.room.net.send({ type: 'auth_resume' });
          } else if (!this.room.net.closedByUser) {
            this.room.net.connect();
          }
        }
      }, 3200);
    }
  }

  act(msg) {
    if (this.busyInput || this.playing) return;
    sfx.unlock();
    this.busyInput = true;
    this.hud.hideDecision();
    this.refreshControls(true);
    this.room.send(msg);
    setTimeout(() => { if (this.busyInput && !this.playing) { this.busyInput = false; this.refreshControls(); } }, 4000);
  }

  toggleCam() {
    const next = this.board.effectiveCam === 'overview' ? 'follow' : 'overview';
    this.board.setCamMode(next);
    this.hud.setCamLabel(next);
  }

  // ------------------------------------------------------------------------- cutscene replay
  async playBatch(events, final, gen = this._matchGen) {
    const b = this.board, hud = this.hud;
    const names = final.players.map((p) => p.name);
    const prevPlayers = (this.match || final).players;
    const cash = prevPlayers.map((p) => p.cash);
    const livePlayers = final.players.map((p, i) => {
      const prev = prevPlayers[i] || p;
      return {
        ...p,
        status: { ...(prev.status || p.status || {}) },
        shields: prev.shields ?? p.shields ?? 0,
        coupons: prev.coupons ?? p.coupons ?? 0,
        revive: prev.revive ?? p.revive ?? 0,
      };
    });
    const at = (seat) => (b.tokens[seat] ? { x: b.tokens[seat].x, z: b.tokens[seat].z } : 0);
    const scores = () => final.players.map((p, i) => ({
      seat: i, cash: cash[i], netWorth: scoreboard(final)[i].netWorth,
      ult: p.ult, petUlt: p.petUlt || 0, petCostume: p.petCostume || null, hasPet: !!p.hasPet, bankrupt: false,
    }));
    const firstTurnSeat = events.find((x) => x.t === 'turn' || x.t === 'dice')?.seat ?? final.turn?.seat;
    b.playbackRate = firstTurnSeat != null && final.players[firstTurnSeat]?.isBot ? 1.5 : 1;
    try {
      for (const e of events) {
        if (gen != null && gen !== this._matchGen) break;
        switch (e.t) {
          case 'turn':
            b.followSeat = e.seat;
            b.playbackRate = final.players[e.seat]?.isBot ? 1.5 : 1;
            hud.setRound(e.round, final.maxRounds || MONO.MAX_ROUNDS, !!final.chaos);
            b.syncTokenStatuses?.(livePlayers, { animate: false });
            hud.updateCards(scores(), e.seat, livePlayers);
            if (e.seat === this.yourSeat) hud.ticker('✨ Your turn!', 1200);
            break;
          case 'chaos_event':
            await b.juice?.(e, { final, hud });
            break;
          case 'dice': {
            if (!b.camForced) b.camMode = 'follow';
            b.followSeat = e.seat;
            const pst = livePlayers[e.seat]?.status || {};
            const isRev = e.dir < 0 || pst.moveDir === -1;
            const maxR = pst.maxRoll || 0;
            const fixR = pst.fixedRoll || 0;
            await b.rollDice(e.seat, e.dice, { reversed: isRev, maxRoll: maxR, fixedRoll: fixR });
            if (pst.moveDir === -1) pst.moveDir = 1;
            if (pst.maxRoll) delete pst.maxRoll;
            if (pst.fixedRoll) delete pst.fixedRoll;
            b.syncTokenStatuses?.(livePlayers, { animate: false });
            hud.updateCards(scores(), e.seat, livePlayers);
            b.float(
              `${e.boosted ? '⚡' : '🎲'} ${e.steps}${isRev ? ' ◀ REVERSE' : maxR ? ` (MAX ${maxR})` : ''}`,
              at(e.seat),
              { y: 2.6, big: true, color: isRev ? '#e8b8ff' : maxR ? '#8ff2ff' : '#fff6c2' }
            );
            break;
          }
          case 'move': {
            await b.moveToken(e.seat, e.path, e.kind);
            if (e.kind === 'walk' && Array.isArray(e.path) && e.path.length > 0) {
              const landIdx = e.path[e.path.length - 1];
              const landOwner = final.tiles[landIdx]?.owner;
              const landedOnRival = landOwner != null && landOwner !== e.seat && !final.players[landOwner]?.bankrupt;
              if (!landedOnRival) {
                const moverCash = final.players[e.seat]?.cash ?? 0;
                const minThreshold = Math.max(400, 0.20 * moverCash);
                const candidates = [wrap(landIdx - 1), wrap(landIdx + 1)];
                let bestThreat = null;
                for (const idx of candidates) {
                  const t = final.tiles[idx];
                  const tile = TILES[idx];
                  if (tile?.kind === 'property' && t?.owner != null && t.owner !== e.seat && !final.players[t.owner]?.bankrupt) {
                    const r = rentFor(final, idx);
                    if (r >= minThreshold) {
                      if (!bestThreat || r > bestThreat.rent) {
                        bestThreat = { idx, rent: r, owner: t.owner };
                      }
                    }
                  }
                }
                if (bestThreat) {
                  b.float(`😮‍💨 Phew! Dodged 🪙 ${fmt(bestThreat.rent)}`, at(e.seat), { y: 2.8, color: '#7df9ff' });
                  sfx.heartbeat?.();
                  if (e.seat === this.yourSeat) {
                    hud.ticker(`😱 1 tile from ${names[bestThreat.owner]}'s ${TILES[bestThreat.idx].name}!`, 2000);
                  }
                  const isFastBot = final.players[e.seat]?.isBot && b.playbackRate > 1;
                  if (!isFastBot) {
                    await b.wait?.(0.2);
                  }
                }
              }
            }
            break;
          }
          case 'salary':
            sfx.coin(true);
            b.float(`+${fmt(e.amount)} 🪙 ⚡+1${e.diamonds ? ` +${e.diamonds} 💎` : ''}`, at(e.seat), { y: 2.4, color: '#7dffa0' });
            if (e.underdog) {
              b.float(`🔥 Underdog Boost +${fmt(e.bonus)} 🪙`, at(e.seat), { y: 3.2, big: true, color: '#ffaa44' });
              hud.ticker(`🔥 Underdog Boost +${fmt(e.bonus)} 🪙 for ${names[e.seat]}!`, 2000);
            }
            if (e.heist) hud.ticker(`🎡 ${names[e.heist.seat]} siphoned ${fmt(e.heist.amount)} 🪙 of the salary!`);
            await b.juice?.(e, { final, hud });
            break;
          case 'color_monopoly':
            sfx.fanfare();
            b.tokens[e.seat]?.pet?.act?.('happy', 1.4);
            b.float(`🎨 COLOR MONOPOLY! +${e.diamonds} 💎`, at(e.seat), { y: 2.8, big: true, color: '#7df9ff' });
            hud.ticker(`🎨 ${names[e.seat]} completed a 3-Tile Color Monopoly (+${e.diamonds} 💎)!`, 2400);
            await b.juice?.(e, { final, hud });
            break;
          case 'cash':
            if (e.from != null) { cash[e.from] -= e.amount; hud.bumpCash(e.from, -1); }
            if (e.to != null) { cash[e.to] += e.amount; hud.bumpCash(e.to, 1); }
            if (e.from != null && e.to != null && e.reason !== 'rent') b.coins?.(e.from, e.to, e.amount);
            hud.updateCards(scores(), final.turn?.seat, livePlayers);
            break;
          case 'rent': {
            const tile = e.tile;
            if (e.shielded) {
              if (livePlayers[e.payer]) livePlayers[e.payer].shields = Math.max(0, (livePlayers[e.payer].shields || 1) - 1);
              b.float('🛡️ RENT BLOCKED!', tile, { color: '#7fe3ff', big: true });
              hud.ticker(`🛡️ ${names[e.payer]}'s Shield blocked rent on ${TILES[tile]?.name || 'tile'}!`, 1800);
              await b.playShieldEffect?.(e.payer, { broken: true });
              b.syncTokenStatuses?.(livePlayers, { animate: false });
              hud.updateCards(scores(), final.turn?.seat, livePlayers);
              break;
            }
            if (e.frozen) {
              b.float('❄️ FROZEN — 0 RENT!', tile, { color: '#9ef2ff', big: true });
              break;
            }
            b.coins(e.payer, e.owner, e.amount);
            sfx.coin(false);
            b.float(`${e.reversed ? '🎭 Reversed! ' : ''}−${fmt(e.amount)} 🪙`, tile, { color: '#ff8f8f', big: e.amount >= 600 });
            await b.wait(0.35);
            break;
          }
          case 'buy':
            sfx.buy();
            b.setOwner(e.tile, e.seat);
            b.tokens[e.seat]?.pet?.act?.('happy', 1.0);
            b.float(`🏠 ${TILES[e.tile].name}!`, e.tile, { color: '#fff' });
            await b.wait(0.3);
            break;
          case 'upgrade':
          case 'tier':
            sfx.build();
            b.setLevel(e.tile, final.tiles[e.tile].owner ?? e.seat ?? e.by, e.level);
            if (e.smite) hud.ticker(`⚡ ${names[e.by]} smote ${TILES[e.tile].name}! (−1 level)`);
            else if (e.sabotage) hud.ticker(`💣 ${TILES[e.tile].name} sabotaged!`);
            else if (e.level >= 4) hud.ticker(`☀️ ${TILES[e.tile].name} became an indestructible Golden Pyramid!`);
            await b.wait(0.4);
            break;
          case 'takeover':
            sfx.bad();
            b.setOwner(e.tile, e.seat);
            hud.ticker(`⚔️ ${names[e.seat]} seized ${TILES[e.tile].name} from ${names[e.from]}!`);
            await b.wait(0.4);
            break;
          case 'steal':
            b.setOwner(e.tile, e.to);
            hud.ticker(`🔴 ${names[e.to]} stole ${TILES[e.tile].name}!`);
            break;
          case 'swap':
            b.setOwner(e.a, final.tiles[e.a].owner); b.setOwner(e.b, final.tiles[e.b].owner);
            hud.ticker(`🏝️ Oasis Swap: ${TILES[e.a].name} ⇄ ${TILES[e.b].name}`);
            break;
          case 'liquidate':
            b.setOwner(e.tile, null); b.setLevel(e.tile, null, 0, { animate: false });
            b.float(`💸 sold +${fmt(e.value)}`, e.tile, { color: '#ffd28f' });
            break;
          case 'modifier':
            b.setModifier(e.tile, e.modifier);
            break;
          case 'status': {
            if (livePlayers[e.seat]) {
              Object.assign(livePlayers[e.seat].status, e.status || {});
            }
            b.syncTokenStatuses?.(livePlayers, { animate: true });
            hud.updateCards(scores(), final.turn?.seat, livePlayers);
            const k = Object.keys(STATUS_TXT).find((x) => e.status?.[x]);
            const tk = b.tokens[e.seat];
            const label = k === 'maxRoll' ? `🌌 SLOW-MO (MAX ${e.status.maxRoll})!` : k === 'fixedRoll' ? `🌙 ROLL ${e.status.fixedRoll}!` : STATUS_TXT[k];
            if (label && tk) b.float(label, { x: tk.x, z: tk.z }, { y: 2.5, color: '#e9dcff', big: true });
            break;
          }
          case 'grant': {
            if (livePlayers[e.seat]) {
              if (e.shields) livePlayers[e.seat].shields = (livePlayers[e.seat].shields || 0) + e.shields;
              if (e.coupons) livePlayers[e.seat].coupons = (livePlayers[e.seat].coupons || 0) + e.coupons;
              if (e.revive) livePlayers[e.seat].revive = (livePlayers[e.seat].revive || 0) + e.revive;
            }
            b.syncTokenStatuses?.(livePlayers, { animate: true });
            hud.updateCards(scores(), final.turn?.seat, livePlayers);
            const tk = b.tokens[e.seat];
            if (tk) b.float(`${e.shields ? '🛡️' : ''}${e.coupons ? '🎟️' : ''}${e.revive ? '🐦‍🔥' : ''} +1`, { x: tk.x, z: tk.z }, { y: 2.4, big: true });
            if (e.shields) b.playShieldEffect?.(e.seat, { broken: false });
            break;
          }
          case 'ult': {
            const comboEv = e.combo ? events.find((x) => x.t === 'pet_combo' && x.seat === e.seat && !x._played) : null;
            if (comboEv) {
              comboEv._played = true;
              await b.juice?.({ ...comboEv, name: e.name, icon: e.icon, ownerSkillId: e.skillId }, { final, hud });
              break;
            }
            const caster = final.players[e.seat];
            const partner = e.partnerSeat != null ? final.players[e.partnerSeat] : null;
            const finisher = events.some((x) => x.t === 'bankrupt' && x.finisher);
            await hud.cutIn({
              title: e.byPet ? (e.solo ? '🐾 PET SOUL-LINK SOLO ULTIMATE' : '🐾 PET SOUL-LINK AUTO-ULTIMATE') : 'MYTHIC ULTIMATE',
              name: e.name,
              icon: e.icon,
              caster,
              partner,
              finisher,
              byPet: !!e.byPet,
              petId: e.petId,
              petCostume: e.petCostume,
              fast: !!e.fast,
              repeat: !!e.repeat,
            });
            await b.ultVfx(e.seat, e.vfx, e, events);
            break;
          }
          case 'pet_combo':
            if (!e._played) await b.juice?.(e, { final, hud });
            break;
          case 'pet_mode':
            if (e.seat === this.yourSeat) { hud.pet.auto = !!e.auto; hud.renderPetOrb(); }
            break;
          case 'pet_arm':
            if (e.seat === this.yourSeat) { hud.pet.armed = !!e.armed; hud.renderPetOrb(); }
            break;
          case 'roll_table': hud.ticker(`🎡 Roulette: ${e.label}`); await b.wait(0.5); break;
          case 'choice': hud.ticker(`🪔 Wish: ${e.label}`); break;
          case 'event_tile':
            if (e.kind === 'casino') { sfx.coin(true); b.float(`🎰 +${fmt(e.cash)} 🪙${e.diamonds ? ` +${e.diamonds} 💎` : ''}${e.jackpot ? ' JACKPOT!' : ''}`, e.tile, { big: e.jackpot, color: '#ffe07a' }); }
            else if (e.kind === 'airdrop') b.float(`🪂 +${e.ult}% ULT • ${{ cash: '+300 🪙', shield: '🛡️ Rent Shield', coupon: '🎟️ Free Upgrade' }[e.supply]}`, e.tile, { color: '#c9ffcf' });
            else if (e.kind === 'vault') hud.ticker(`🎒 Black Market: ${{ sabotage: '💣 Tile Sabotage', shield: '🛡️ Barrier Shield', steal: '🧲 Steal 200 🪙' }[e.pick]}`);
            await b.juice?.(e, { final, hud });
            await b.wait(0.5);
            break;
          case 'duel': {
            const last = e.rolls[e.rolls.length - 1];
            hud.ticker(`⚔️ Arena Duel ${names[e.seat]} 🎲${last[0]} vs ${last[1]}🎲 ${names[e.rival]}${e.winner != null ? ` — ${names[e.winner]} steals ${fmt(e.amount)} 🪙${e.diamonds ? ` & +${e.diamonds} 💎` : ''}!` : ' — draw!'}`, 2600);
            await b.juice?.(e, { final, hud });
            await b.wait(1.2);
            break;
          }
          case 'trap': {
            const label = {
              burn: `🔥 −${e.amount}`,
              prison: '👠 Glass Slipper Prison!',
              push: '🌊 Swept +2!',
              push_forward: `⛩️ Fox Gate +${e.steps || 2}!`,
              warp: '⛩️ Spirited away!',
              teleport_cheapest: '💠 Whirlpool Warp!',
              invert_rent: `🎭 Inverted Rent +${fmt(e.amount)} 🪙!`,
            }[e.kind] || '⚡ Trap Triggered!';
            b.playTrapTrigger?.(e.seat, e.tile, e.kind);
            if (e.kind === 'prison' && livePlayers[e.seat]?.status) {
              livePlayers[e.seat].status.skipTurn = true;
              b.syncTokenStatuses?.(livePlayers, { animate: true });
              hud.updateCards(scores(), final.turn?.seat, livePlayers);
            }
            b.float(label, e.tile ?? at(e.seat), { color: '#ffd0f0', big: e.kind !== 'burn' });
            await b.wait(0.38);
            break;
          }
          case 'skip': {
            const tk = b.tokens[e.seat];
            if (tk) b.float('❄️ FROZEN — TURN SKIPPED!', { x: tk.x, z: tk.z }, { y: 2.5, color: '#8ff0ff', big: true });
            hud.ticker(`❄️ ${names[e.seat]} is Frozen — Turn Skipped!`, 1800);
            await b.playSkipTurn?.(e.seat);
            if (livePlayers[e.seat]?.status) livePlayers[e.seat].status.skipTurn = false;
            b.syncTokenStatuses?.(livePlayers, { animate: false });
            hud.updateCards(scores(), final.turn?.seat, livePlayers);
            await b.wait(0.25);
            break;
          }
          case 'revive':
            if (livePlayers[e.seat]) livePlayers[e.seat].revive = Math.max(0, (livePlayers[e.seat].revive || 1) - 1);
            hud.ticker(`🐦‍🔥 PHOENIX REBIRTH! ${names[e.seat]} rose from the ashes with ${fmt(e.cash || 500)} 🪙!`, 2600);
            b.float('🐦‍🔥 PHOENIX REBIRTH!', at(e.seat), { y: 2.7, color: '#ffb84d', big: true });
            await b.playPhoenixRevive?.(e.seat);
            hud.updateCards(scores(), final.turn?.seat, livePlayers);
            break;
          case 'shield_break':
            if (livePlayers[e.seat]) livePlayers[e.seat].shields = Math.max(0, (livePlayers[e.seat].shields || 1) - 1);
            b.float('🛡️💥 SHIELD BLOCKED!', at(e.seat), { y: 2.5, color: '#7fe3ff', big: true });
            await b.playShieldEffect?.(e.seat, { broken: true });
            b.syncTokenStatuses?.(livePlayers, { animate: false });
            hud.updateCards(scores(), final.turn?.seat, livePlayers);
            break;
          case 'phase_shift':
            sfx.fanfare();
            b.playPhaseShift?.(e.phase);
            hud.setRound(e.round, final.maxRounds || MONO.MAX_ROUNDS, !!final.chaos);
            hud.ticker(
              e.phase === 'overdrive'
                ? '🔥 STARLIGHT OVERDRIVE! 2× ULT CHARGE · 1.65× RENT!'
                : '⚡ MID-GAME ESCALATION! 1.35× ULT · 1.25× RENT · 450 🪙 SALARY!',
              3000
            );
            break;
          case 'bounty':
            sfx.fanfare();
            b.float(`💀 KO BOUNTY +${fmt(e.cash)} 🪙 +${e.ult}% ULT!`, at(e.seat), { y: 3.0, big: true, color: '#ffd86b' });
            hud.ticker(`💀 ${names[e.seat]} claimed Knockout Bounty (+${fmt(e.cash)} 🪙, +${e.ult}% ULT)!`, 2600);
            break;
          case 'bankrupt':
            sfx.bad();
            if (b.tokens[e.seat]) b.markBankrupt(b.tokens[e.seat]);
            if (livePlayers[e.seat]) livePlayers[e.seat].bankrupt = true;
            b.syncTokenStatuses?.(livePlayers, { animate: false });
            hud.ticker(`💥 ${names[e.seat]} went BANKRUPT${e.finisher ? ' — BANKRUPTCY STRIKE!' : '!'}`, 3000);
            await b.wait(0.9);
            break;
          default:
        }
      }
    } finally {
      b.playbackRate = 1;
    }
  }

  async showPodium() {
    const p = this.podium;
    if (!p) return;
    await sleep(500);
    sfx.fanfare();
    const by = p.result?.by != null ? this.match.players[p.result.by] : null;
    this.hud.showPodium({
      result: p.result,
      rewards: p.rewards,
      players: this.match.players,
      yourSeat: p.yourSeat ?? this.yourSeat,
      finisherName: by?.name || null,
      solo: this.room.local,
      highlights: this.match?.highlights || p.result?.highlights || p.highlights || null,
    });
    this.board.setCamMode('overview');
  }
}
