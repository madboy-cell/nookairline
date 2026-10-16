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
import { TableHub } from './table_hub.js';
import { legalActions, scoreboard } from '/shared/monopoly_engine.js';
import { TILES, MONO } from '/shared/monopoly_rules.js';

const fmt = (n) => Number(Math.round(n || 0)).toLocaleString('en-US');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const STATUS_TXT = { skipTurn: '❄️ FROZEN', fixedRoll: '🌙 Sleepwalk', moveDir: '🕰️ Reverse!', lapTax: '🎡 Heist', discountPct: '🔥 −50% Underdog' };

export class MonopolyBridge {
  /**
   * @param {object} o
   * @param {HTMLElement} o.container   phone-shell element the overlays are appended to
   * @param {THREE.WebGLRenderer} o.renderer
   * @param {object} o.room             LocalRoom | NetRoom
   * @param {(msg) => void} [o.toast]
   * @param {() => void} [o.onExit]     leave the minigame (back to village / Town Hall)
   */
  constructor({ container, renderer, room, toast = () => {}, onExit = () => {}, onEnterMatch = () => {}, onLeaveMatch = () => {} }) {
    this.onEnterMatch = onEnterMatch;
    this.onLeaveMatch = onLeaveMatch;
    this.container = container;
    this.renderer = renderer;
    this.room = room;
    this.toast = toast;
    this.onExit = onExit;
    this.queue = [];
    this.playing = false;
    this.match = null;
    this.yourSeat = null;
    this.table = null;
    this.podium = null;
    this.busyInput = false;
    this.active = false;

    this.hub = new TableHub(container, room, { toast, onClose: () => this.exit() });
    this.layer = document.createElement('div');
    this.layer.className = 'mono-layer';
    this.layer.hidden = true;
    container.appendChild(this.layer);
    this.hud = new MonopolyHud(this.layer, {
      onRoll: (use2d6) => this.act({ type: 'mono_roll', use2d6 }),
      onUlt: () => this.act({ type: 'mono_ult' }),
      onDecide: (choice) => this.act({ type: 'mono_event_choice', choice }),
      onCam: () => this.toggleCam(),
      onExit: () => this.leaveMatch(),
      onRematch: () => { this.hud.hidePodium(); this.podium = null; this.room.send({ type: 'table_rematch' }); },
      onMute: () => { sfx.setMuted(!sfx.muted); return sfx.muted; },
    });

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
    if (this.active) this.onLeaveMatch(this);
    this.active = false;
    this.layer.hidden = true;
    this.queue = [];
    this.match = null;
    this.hud.hideDecision();
    this.hud.hidePodium();
    this.podium = null;
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
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this._resize);
    this.off.forEach((f) => f?.());
    this.hub.destroy();
    this.hud.destroy();
    this.board?.dispose();
    this.layer.remove();
  }

  // ------------------------------------------------------------------------- room messages
  async onTableState(m) {
    this.table = m.table;
    await tokenModules;
    if (m.table?.status === 'playing' && m.match) {
      const fresh = !this.active || this.match?.tableId !== m.match.tableId || m.resumed;
      this.yourSeat = m.yourSeat;
      if (fresh) {
        this.startMatchView();
        this.queue = [];
        this.applyFinal(m.match, { snap: true });
        this.hud.setPlayers(m.match.players, m.yourSeat);
        this.hud.updateCards(scoreboard(m.match), m.match.turn?.seat, m.match.players);
        if (m.events?.length) this.enqueue({ events: m.events, match: m.match });
        else this.refreshControls();
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
        this.yourSeat = batch.yourSeat ?? this.yourSeat;
        this.hud.hideDecision();
        this.refreshControls(true);
        await this.playBatch(batch.events || [], batch.match);
        this.applyFinal(batch.match);
      }
      if (this.podium && this.match?.ended) await this.showPodium();
    } finally {
      this.playing = false;
    }
    // must run AFTER `playing` is released, otherwise ROLL stays locked
    if (this.queue.length) this.pump();
    else if (!(this.podium && this.match?.ended)) this.refreshControls();
  }

  applyFinal(match, { snap = false } = {}) {
    this.match = match;
    this.board.syncFromMatch(match, { snap });
    this.hud.setRound(match.round, match.maxRounds || MONO.MAX_ROUNDS);
    this.hud.updateCards(scoreboard(match), match.turn?.seat, match.players);
    this.busyInput = false;
  }

  refreshControls(busy = false) {
    const m = this.match;
    if (!m) return;
    const seat = this.yourSeat;
    const la = seat != null ? legalActions(m, seat) : { myTurn: false };
    const me = seat != null ? m.players[seat] : null;
    const cur = m.players[m.turn?.seat];
    const lock = busy || this.playing || this.busyInput || m.ended;
    this.hud.setControls({
      myTurn: la.myTurn, canRoll: la.canRoll, can2d6: la.can2d6, canUlt: la.canUlt, boost: me?.boost ?? 0, ult: me?.ult ?? 0,
      busy: lock, waitingName: cur && !la.myTurn ? cur.name : null,
      deadline: !this.room.local && m.deadline ? m.deadline - (m.serverSkew || 0) : null,
      fixedRoll: me?.status?.fixedRoll || 0,
    });
    if (!lock && la.pending) this.hud.showDecision(la.pending, m, seat);
    // auto camera: always follow whoever is acting; Overview is a manual toggle only
    if (!this.board.camForced) this.board.camMode = 'follow';
    this.board.followSeat = m.turn?.seat ?? this.board.followSeat;
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
  async playBatch(events, final) {
    const b = this.board, hud = this.hud;
    const names = final.players.map((p) => p.name);
    const cash = (this.match || final).players.map((p) => p.cash);
    const at = (seat) => (b.tokens[seat] ? { x: b.tokens[seat].x, z: b.tokens[seat].z } : 0);
    const scores = () => final.players.map((p, i) => ({ seat: i, cash: cash[i], netWorth: scoreboard(final)[i].netWorth, ult: p.ult, bankrupt: false }));
    for (const e of events) {
      switch (e.t) {
        case 'turn':
          b.followSeat = e.seat;
          hud.setRound(e.round, final.maxRounds || MONO.MAX_ROUNDS);
          hud.updateCards(scores(), e.seat, final.players);
          if (e.seat === this.yourSeat) hud.ticker('✨ Your turn!', 1200);
          break;
        case 'dice':
          if (!b.camForced) b.camMode = 'follow';
          b.followSeat = e.seat;
          await b.rollDice(e.seat, e.dice);
          b.float(`${e.boosted ? '⚡' : '🎲'} ${e.steps}${e.dir < 0 ? ' ◀' : ''}`, at(e.seat), { y: 2.6, big: true, color: '#fff6c2' });
          break;
        case 'move':
          await b.moveToken(e.seat, e.path, e.kind);
          break;
        case 'salary':
          sfx.coin(true);
          b.float(`+${fmt(e.amount)} 🪙 ⚡+1${e.diamonds ? ` +${e.diamonds} 💎` : ''}`, at(e.seat), { y: 2.4, color: '#7dffa0' });
          if (e.heist) hud.ticker(`🎡 ${names[e.heist.seat]} siphoned ${fmt(e.heist.amount)} 🪙 of the salary!`);
          break;
        case 'color_monopoly':
          sfx.fanfare();
          b.float(`🎨 COLOR MONOPOLY! +${e.diamonds} 💎`, at(e.seat), { y: 2.8, big: true, color: '#7df9ff' });
          hud.ticker(`🎨 ${names[e.seat]} completed a 3-Tile Color Monopoly (+${e.diamonds} 💎)!`, 2400);
          break;
        case 'cash':
          if (e.from != null) { cash[e.from] -= e.amount; hud.bumpCash(e.from, -1); }
          if (e.to != null) { cash[e.to] += e.amount; hud.bumpCash(e.to, 1); }
          hud.updateCards(scores(), final.turn?.seat, final.players);
          break;
        case 'rent': {
          const tile = e.tile;
          if (e.shielded) { b.float('🛡️ Rent blocked!', tile, { color: '#bfe6ff' }); break; }
          if (e.frozen) { b.float('❄️ 0 rent', tile, { color: '#bfe6ff' }); break; }
          b.coins(e.payer, e.owner, e.amount);
          sfx.coin(false);
          b.float(`${e.reversed ? '🎭 Reversed! ' : ''}−${fmt(e.amount)} 🪙`, tile, { color: '#ff8f8f', big: e.amount >= 600 });
          await b.wait(0.35);
          break;
        }
        case 'buy':
          sfx.buy();
          b.setOwner(e.tile, e.seat);
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
          const k = Object.keys(STATUS_TXT).find((x) => e.status?.[x]);
          const tk = b.tokens[e.seat];
          if (k && tk) b.float(STATUS_TXT[k], { x: tk.x, z: tk.z }, { y: 2.4, color: '#e9dcff' });
          break;
        }
        case 'grant': {
          const tk = b.tokens[e.seat];
          if (tk) b.float(`${e.shields ? '🛡️' : ''}${e.coupons ? '🎟️' : ''}${e.revive ? '🐦‍🔥' : ''} +1`, { x: tk.x, z: tk.z }, { y: 2.4 });
          break;
        }
        case 'ult': {
          const caster = final.players[e.seat];
          const partner = e.partnerSeat != null ? final.players[e.partnerSeat] : null;
          const finisher = events.some((x) => x.t === 'bankrupt' && x.finisher);
          await hud.cutIn({ title: `MYTHIC ULTIMATE`, name: e.name, icon: e.icon, caster, partner, finisher });
          await b.ultVfx(e.seat, e.vfx);
          break;
        }
        case 'roll_table': hud.ticker(`🎡 Roulette: ${e.label}`); await b.wait(0.5); break;
        case 'choice': hud.ticker(`🪔 Wish: ${e.label}`); break;
        case 'event_tile':
          if (e.kind === 'casino') { sfx.coin(true); b.float(`🎰 +${fmt(e.cash)} 🪙${e.diamonds ? ` +${e.diamonds} 💎` : ''}${e.jackpot ? ' JACKPOT!' : ''}`, e.tile, { big: e.jackpot, color: '#ffe07a' }); }
          else if (e.kind === 'airdrop') b.float(`🪂 +${e.ult}% ULT • ${{ cash: '+300 🪙', shield: '🛡️ Rent Shield', coupon: '🎟️ Free Upgrade' }[e.supply]}`, e.tile, { color: '#c9ffcf' });
          else if (e.kind === 'vault') hud.ticker(`🎒 Black Market: ${{ sabotage: '💣 Tile Sabotage', shield: '🛡️ Barrier Shield', steal: '🧲 Steal 200 🪙' }[e.pick]}`);
          await b.wait(0.5);
          break;
        case 'duel': {
          const last = e.rolls[e.rolls.length - 1];
          hud.ticker(`⚔️ Arena Duel ${names[e.seat]} 🎲${last[0]} vs ${last[1]}🎲 ${names[e.rival]}${e.winner != null ? ` — ${names[e.winner]} steals ${fmt(e.amount)} 🪙${e.diamonds ? ` & +${e.diamonds} 💎` : ''}!` : ' — draw!'}`, 2600);
          await b.wait(1.2);
          break;
        }
        case 'trap': {
          const label = { burn: `🔥 −${e.amount}`, prison: '👠 Glass Slipper Prison!', push: '🌊 Swept +2!', warp: '⛩️ Spirited away!' }[e.kind];
          b.float(label, e.tile, { color: '#ffd0f0', big: e.kind !== 'burn' });
          await b.wait(0.3);
          break;
        }
        case 'skip': {
          const tk = b.tokens[e.seat];
          if (tk) b.float('❄️ Frozen — turn skipped', { x: tk.x, z: tk.z }, { y: 2.4, color: '#bfe6ff', big: true });
          await b.wait(0.7);
          break;
        }
        case 'revive': hud.ticker(`🐦‍🔥 ${names[e.seat]} rose from the ashes!`); break;
        case 'shield_break': b.float('🛡️💥', at(e.seat)); break;
        case 'bankrupt':
          sfx.bad();
          if (b.tokens[e.seat]) b.markBankrupt(b.tokens[e.seat]);
          hud.ticker(`💥 ${names[e.seat]} went BANKRUPT${e.finisher ? ' — BANKRUPTCY STRIKE!' : '!'}`, 3000);
          await b.wait(0.9);
          break;
        default:
      }
    }
  }

  async showPodium() {
    const p = this.podium;
    if (!p) return;
    await sleep(500);
    sfx.fanfare();
    const by = p.result.by != null ? this.match.players[p.result.by] : null;
    this.hud.showPodium({ result: p.result, rewards: p.rewards, players: this.match.players, yourSeat: p.yourSeat ?? this.yourSeat, finisherName: by?.name || null, solo: this.room.local });
    this.board.setCamMode('overview');
  }
}
