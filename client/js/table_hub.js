// client/js/table_hub.js — Universal 4-Seat Table Hub UI (Screen 09, Implementation Plan §10.A).
// 4 mode tabs · 2.5D 4-chair VIP table preview (Ready / Bot: Easy-Hard-Insane / Invite-Tap to Sit) ·
// live open tables with Hot-Join · [⚡ Play Solo Now (Instant)] [🚀 Launch 4-Player Match!].
// Talks only to a room transport (LocalRoom / NetRoom) — no game logic lives here.
import { MODES } from '/shared/universal_room.js';
import { PODIUM } from '/shared/monopoly_rules.js';

export const HUB_MODES = Object.freeze({
  ...MODES,
  casino: { ...(MODES.casino || {}), label: 'Grand Casino', icon: '🎰', available: true, minSeats: 1 },
});

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const portrait = (lineage, seat = null) => {
  const lin = (typeof lineage === 'object' ? lineage?.lineage : lineage) || 'bkk';
  const s = typeof lineage === 'object' ? lineage : seat;
  const outfit = s?.outfit || s?.equipped?.outfit?.id || (typeof s?.equipped?.outfit === 'string' ? s.equipped.outfit : null);
  if (outfit && outfit !== 'newbie_outfit') return `/assets/chibi/${lin}_${outfit}_front.png`;
  return `/assets/chibi/${lin}_base_front.png`;
};
const DIFF_LABEL = { easy: '🤖 Bot: Easy', hard: '🤖 Bot: Hard (400💎)', insane: '🤖 Bot: Insane (950💎)' };
const DIFF_SHORT = { easy: 'Bot: Easy', hard: 'Bot: Hard', insane: 'Bot: Insane' };
const SEAT_ROLE = ['Host', 'Partner', 'Seat 3', 'Seat 4'];
const modeOf = (t) => t?.options?.matchMode || t?.matchMode || null;

export class TableHub {
  /**
   * @param {HTMLElement} host
   * @param {object} room   LocalRoom | NetRoom
   * @param {object} o      { toast(msg), onClose(), profile, onCreate, onJoin, onSeatClick, onReady, onStart, onSolo, onAddBot, onLeave, onModeChange, onCasinoStart }
   */
  constructor(host, room, {
    toast = () => {}, onClose = () => {}, profile = null,
    onCreate = null, onJoin = null, onSeatClick = null, onReady = null,
    onStart = null, onSolo = null, onAddBot = null, onLeave = null, onModeChange = null,
    onCasinoStart = () => {},
  } = {}) {
    this.room = room;
    this.toast = toast;
    this.onClose = onClose;
    this.profile = profile;
    this.onCreate = onCreate;
    this.onJoin = onJoin;
    this.onSeatClick = onSeatClick;
    this.onReady = onReady;
    this.onStart = onStart;
    this.onSolo = onSolo;
    this.onAddBot = onAddBot;
    this.onLeave = onLeave;
    this.onModeChange = onModeChange;
    this.onCasinoStart = onCasinoStart;
    this.mode = 'monopoly';
    this.matchMode = 'normal';
    this.casinoGame = 'pokdeng';
    this.botDiff = 'hard';
    this.table = null;
    this.tables = [];
    this._casinoStarted = false;
    this._casinoStartedTableId = null;
    this.root = document.createElement('div');
    this.root.className = 'hub-wrap';
    this.root.hidden = true;
    host.appendChild(this.root);
    this.off = [
      room.on('table_state', (m) => {
        if (m.table) {
          this.table = m.table;
          if (m.table.mode) this.mode = m.table.mode;
          if (m.table.options?.casinoGame) this.casinoGame = m.table.options.casinoGame;
          if (modeOf(m.table)) this.matchMode = modeOf(m.table);
          if (m.table.mode === 'casino' && m.table.status === 'playing') {
            if (!this._casinoStarted || this._casinoStartedTableId !== m.table.id) {
              this._casinoStarted = true;
              this._casinoStartedTableId = m.table.id;
              this.onCasinoStart(m.table);
            }
          } else if (m.table.status !== 'playing') {
            this._casinoStarted = false;
            this._casinoStartedTableId = null;
          }
          this.render();
        }
      }),
      room.on('table_list_update', (m) => { if (!m.mode || m.mode === this.mode) { this.tables = m.tables || []; this.render(); } }),
      room.on('table_error', (m) => this.toast(`🪑 ${HUB_ERRORS[m.error] || m.error}`)),
    ];
    this.root.addEventListener('click', (e) => this.onClick(e));
    this.root.addEventListener('change', (e) => this.onChange(e));
  }

  open() {
    this.root.hidden = false;
    this.room.send({ type: 'table_list', mode: this.mode });
    if (!this.table || this.table.status === 'ended') {
      if (this.mode === 'casino') {
        this.room.send({ type: 'table_create', mode: 'casino', options: { casinoGame: this.casinoGame } });
        this.onCreate?.('casino', this.casinoGame);
      } else {
        this.room.send({ type: 'table_create', mode: this.mode, matchMode: this.matchMode });
        this.onCreate?.(this.mode, this.matchMode);
      }
    }
    this.render();
  }

  close({ leave = false } = {}) {
    this.root.hidden = true;
    if (leave) {
      this.room.send({ type: 'table_leave' });
      this.onLeave?.();
      this.table = null;
    }
  }

  get isOpen() { return !this.root.hidden; }
  get me() { return this.room.userId; }
  get isHost() { return this.table?.hostId === this.me; }

  // ------------------------------------------------------------------------- render
  render() {
    if (this.root.hidden) return;
    const t = this.table;
    const isCasino = this.mode === 'casino';
    const activeCasinoGame = (t?.options?.casinoGame || t?.casinoGame || this.casinoGame || 'pokdeng');
    const isChaos = !isCasino && ((modeOf(t) || this.matchMode) === 'chaos');
    const tabs = Object.entries(HUB_MODES).map(([k, m]) => `
      <button class="hub-tab ${k === this.mode ? 'on' : ''} ${m.available ? '' : 'locked'}" data-tab="${k}">
        <span class="hub-tab-ico">${m.icon}</span><span>${m.label}</span>${m.available ? '' : `<em>🔒 Phase ${m.phase}</em>`}
      </button>`).join('');
    const seats = t ? t.seats : [];
    const resolveSeatHair = (s) => {
      const isMe = s?.userId === this.me;
      const app = (isMe && this.profile?.appearance) ? this.profile.appearance : (s?.appearance || null);
      const lin = s?.lineage || (isMe ? this.profile?.lineage : 'bkk') || 'bkk';
      const isGirl = app?.body === 'girl' || (!app?.body && lin === 'dxb');
      const hairId = s?.hair || app?.hair || (isGirl ? 'hair_girl_waves' : 'hair_boy_fluffy');
      return `/assets/chibi/${hairId}_front.png`;
    };
    const chair = (s, idx) => {
      const pos = ['tl', 'tr', 'bl', 'br'][idx];
      if (!s || s.kind === 'empty') {
        return `<div class="hub-chair ${pos} empty" data-seat="${idx}">
          <div class="hub-chair-seat">🪑</div>
          <div class="hub-chair-badge empty-pill">
            <b>Seat ${idx + 1}</b>
            <span class="hub-sit-pill">${this.isHost ? '➕ Invite / Bot' : '➕ Sit Here'}</span>
          </div>
        </div>`;
      }
      const isMe = s.userId === this.me;
      const bodyUrl = portrait(s.lineage, s);
      const hairUrl = resolveSeatHair(s);
      const ava = `<div class="hub-chair-ava ${s.kind === 'bot' ? 'bot' : ''}">
        <img class="hub-ava-body" src="${bodyUrl}" alt="" />
        <img class="hub-ava-hair" src="${hairUrl}" alt="" />
        ${s.kind === 'bot' ? '<span class="hub-bot-ico">🤖</span>' : ''}
      </div>`;
      const badge = s.kind === 'bot'
        ? `<div class="hub-chair-badge bot-badge">
            <b>Seat ${idx + 1}</b>
            ${this.isHost && t.status === 'lobby'
              ? `<select class="hub-bot-select" data-bot="${idx}">${['easy', 'hard', 'insane'].map((d) => `<option value="${d}" ${d === s.botDiff ? 'selected' : ''}>${DIFF_LABEL[d]}</option>`).join('')}<option value="">✖ Remove</option></select>`
              : `<span class="hub-bot-pill">${DIFF_LABEL[s.botDiff] || DIFF_SHORT[s.botDiff]}</span>`}
          </div>`
        : `<div class="hub-chair-badge human-badge">
            <div class="hub-seat-head"><b>Seat ${idx + 1}</b> <small>(${idx === 0 || s.userId === t.hostId ? 'Host' : SEAT_ROLE[idx]})</small></div>
            <span class="hub-seat-name">${s.userId === t.hostId ? '👑 ' : ''}${esc(s.name)}${s.level ? ` Lv.${s.level}` : ''}${isMe ? ' <em>(you)</em>' : ''}</span>
            <i class="hub-ready ${s.ready ? 'on' : ''}">${s.ready ? '✓ READY' : '… not ready'}</i>${s.connected ? '' : '<i class="hub-off">📴 offline</i>'}
          </div>`;
      return `<div class="hub-chair ${pos} ${s.kind}" data-seat="${idx}">${ava}${badge}</div>`;
    };
    const others = this.tables.filter((x) => x.id !== t?.id);
    const list = others.length ? others.map((x) => {
      const tableCasino = x.mode === 'casino';
      const casinoGame = x.options?.casinoGame || x.casinoGame || (tableCasino ? 'pokdeng' : null);
      const tag = tableCasino
        ? ` <b class="hub-casino-tag" data-casino-game="${esc(casinoGame)}">${casinoGame === 'roulette' ? '⚡ Roulette' : '🀄 Pok-Deng'}</b>`
        : (modeOf(x) === 'chaos' ? ' <b class="hub-chaos-tag">🎉 CHAOS</b>' : '');
      const canHotJoin = (x.status === 'lobby' && x.players < 4) ||
        (x.seats.some((s) => s.kind === 'bot') && x.status === 'lobby') ||
        (tableCasino && x.status === 'playing' && x.players < 4);
      return `
      <div class="hub-live" ${tableCasino ? `data-casino-game="${esc(casinoGame)}"` : ''}>
        <div class="hub-live-name">${HUB_MODES[x.mode]?.icon || '🎲'} Table #${x.num} • ${esc(x.name)}${tag}</div>
        <div class="hub-live-avas">${x.seats.filter((s) => s.kind !== 'empty').map((s) => `<span style="background-image:url(${portrait(s.lineage, s)})">${s.kind === 'bot' ? '🤖' : ''}</span>`).join('')}</div>
        <div class="hub-live-meta">🪑 ${x.players}/4 Seats</div>
        ${canHotJoin
          ? `<button class="hub-btn green" data-join="${x.id}">🪑 Hot-Join Seat</button>`
          : `<button class="hub-btn plain" disabled>${x.status === 'playing' ? '▶ In match' : 'Full'}</button>`}
      </div>`;
    }).join('') : '<div class="hub-empty">No other open tables right now — create yours and invite friends! 💌</div>';
    const humansReady = seats.filter((s) => s.kind === 'human' && s.userId !== t?.hostId).every((s) => s.ready);
    const mySeat = seats.find((s) => s.userId === this.me);
    const launchLabel = this.isHost
      ? (isCasino ? `🚀 Enter Casino (${activeCasinoGame === 'roulette' ? 'Roulette' : 'Pok-Deng'})!` : `🚀 Launch ${isChaos ? 'Chaos ' : '4-Player '}Match!`)
      : mySeat?.ready ? '✓ Ready! (waiting for host)' : '✋ I\'m Ready!';
    const cleanRoomName = t ? String(t.name || '').replace(/\s*VIP\s*Room\s*$/i, '').trim() : '';
    const casinoPicker = `
      <div class="hub-casino-picker" role="radiogroup" aria-label="Casino Game">
        <button type="button" class="hub-btn ${activeCasinoGame === 'pokdeng' ? 'gold' : 'plain'}" data-casino-game="pokdeng" ${t && !this.isHost ? 'disabled' : ''}>
          🀄 Pok-Deng
        </button>
        <button type="button" class="hub-btn ${activeCasinoGame === 'roulette' ? 'gold' : 'plain'}" data-casino-game="roulette" ${t && !this.isHost ? 'disabled' : ''}>
          ⚡ Roulette
        </button>
      </div>`;
    const infoStrip = isCasino
      ? (activeCasinoGame === 'roulette'
          ? `<span>🎰 <b>Zeus Lightning Roulette</b></span>
             <span>⚡ <b>Up to 500× Lightning!</b></span>
             <span>🪙 <b>Max Total Bet: 25,000</b></span>`
          : `<span>🀄 <b>Royal Pok-Deng</b></span>
             <span>⚡ <b>Pok 8 / 9 • Up to 5× Deng</b></span>
             <span>🎁 <b>Sunken Dupe Chests</b></span>`)
      : `<span>🎲 <b>24-Tile 2.5D Follow-Cam</b></span>
         <span>⚡ <b>${isChaos ? '10R • 2× Ult • Chaos!' : '2d6 Boost: ON'}</b></span>
         <span>🏆 <b>Win: ${isChaos ? '💎×0.5' : '600–950 💎'} + 🪙 ${PODIUM.GOLD[0].toLocaleString('en-US')}</b></span>`;

    this.root.innerHTML = `
      <div class="hub">
        <div class="hub-head"><span>🎮 PLAY &amp; 4-SEAT TABLE HUB</span><button class="hub-x" data-act="close">✕</button></div>
        <div class="hub-tabs">${tabs}</div>
        <div class="hub-table-card ${isChaos ? 'chaos' : ''} ${isCasino ? 'casino' : ''}">
          <div class="hub-table-title">
            <span class="hub-table-title-txt">🪑 ${t ? `Table #${t.num} — ${esc(cleanRoomName)} ${isCasino ? 'Grand Casino' : 'VIP Room'}` : 'Setting up your VIP Table…'}</span>
            ${isCasino ? casinoPicker : `
              <button type="button" class="hub-btn ${isChaos ? 'chaos-on' : 'chaos-off'}" data-act="chaos" ${t && !this.isHost ? 'disabled' : ''}>
                ${isChaos ? '🎉 Chaos Party: ON' : '🎉 Chaos Party'}
              </button>
            `}
          </div>
          <div class="hub-stage hub-stage-diorama">
            <div class="hub-board"><div class="hub-board-top"><span>${isCasino ? (activeCasinoGame === 'roulette' ? '⚡' : '🀄') : (isChaos ? '🎉' : '🎲')}</span></div></div>
            <img class="hub-vip-table-img" src="/assets/ui/stage_vip_table_4seat.png" alt="4-Seat VIP Table" />
            ${[0, 1, 2, 3].map((k) => chair(seats[k], k)).join('')}
          </div>
          <div class="hub-table-tools">
            <label class="hub-botpick">🤖 Default Bot: <select data-act="botdiff">${['easy', 'hard', 'insane'].map((d) => `<option value="${d}" ${d === this.botDiff ? 'selected' : ''}>${DIFF_SHORT[d]}</option>`).join('')}</select></label>
            <button class="hub-btn invite" data-act="invite">➕ Invite Friend</button>
          </div>
          <div class="hub-info">
            ${infoStrip}
          </div>
        </div>
        <div class="hub-list">
          <div class="hub-list-title">Live Open Tables (${others.length} Active)</div>
          ${list}
        </div>
        <div class="hub-foot">
          <button class="hub-btn blue big" data-act="solo">⚡ Play Solo ${isCasino ? (activeCasinoGame === 'roulette' ? 'Roulette' : 'Pok-Deng') : (isChaos ? 'Chaos' : 'Now')}<small>(Instant)</small></button>
          <button class="hub-btn gold big" data-act="launch" ${!t || (this.isHost && !isCasino && !humansReady) ? '' : ''}>${launchLabel}</button>
        </div>
      </div>`;
  }

  // ------------------------------------------------------------------------- input
  onClick(e) {
    const el = e.target.closest('[data-act],[data-tab],[data-seat],[data-join],[data-casino-game]');
    if (!el || e.target.tagName === 'SELECT' || e.target.tagName === 'OPTION') return;
    const t = this.table;
    if (el.dataset.tab) {
      const tabKey = el.dataset.tab;
      const m = HUB_MODES[tabKey];
      if (!m.available) { this.toast(`${m.icon} ${m.label} opens in Phase ${m.phase} 🔒`); return; }
      const prevMode = this.mode;
      this.mode = tabKey;
      this.onModeChange?.(this.mode);
      this.room.send({ type: 'table_list', mode: this.mode });
      if (this.isHost && t?.status === 'lobby' && prevMode !== this.mode) {
        if (this.mode === 'casino') {
          this.room.send({ type: 'table_create', mode: 'casino', options: { casinoGame: this.casinoGame } });
        } else if (this.mode === 'monopoly') {
          this.room.send({ type: 'table_create', mode: 'monopoly', matchMode: this.matchMode });
        }
      }
      this.render();
      return;
    }
    const casinoGameBtn = el.dataset.casinoGame ? el : el.closest('[data-casino-game]');
    if (casinoGameBtn && casinoGameBtn.dataset.casinoGame && !el.dataset.join && !el.dataset.act) {
      const game = casinoGameBtn.dataset.casinoGame;
      this.casinoGame = game;
      if (t && this.isHost) {
        this.room.send({ type: 'table_set_option', casinoGame: game });
      }
      this.render();
      return;
    }
    if (el.dataset.join) {
      this.room.send({ type: 'table_sit', tableId: el.dataset.join });
      this.onJoin?.(el.dataset.join);
      return;
    }
    if (el.dataset.seat != null && !el.dataset.act) {
      const idx = Number(el.dataset.seat);
      const s = t?.seats[idx];
      this.onSeatClick?.(idx, s);
      if (!t || t.status !== 'lobby' || !s) return;
      if (s.kind === 'empty') {
        if (this.isHost) {
          this.room.send({ type: 'table_set_bot', seatIdx: idx, diff: this.botDiff });
          this.onAddBot?.(idx, this.botDiff);
        } else {
          this.room.send({ type: 'table_sit', tableId: t.id, seatIdx: idx });
        }
      }
      return;
    }
    switch (el.dataset.act) {
      case 'close': this.close({ leave: true }); this.onClose(); break;
      case 'chaos': {
        this.matchMode = (modeOf(t) || this.matchMode) === 'chaos' ? 'normal' : 'chaos';
        if (t && this.isHost) this.room.send({ type: 'table_set_option', matchMode: this.matchMode });
        this.toast(this.matchMode === 'chaos' ? '🎉 Chaos Party ON — Max Pets, 2× Ult Gauge, Round Chaos Events & 10 Rounds!' : '⚖️ Standard Mode selected');
        this.render();
        break;
      }
      case 'solo':
        if (this.mode === 'casino') {
          this.room.send({ type: 'table_solo', mode: 'casino', diff: this.botDiff, casinoGame: this.casinoGame, options: { casinoGame: this.casinoGame } });
          this.onSolo?.(this.botDiff, this.casinoGame);
        } else {
          this.room.send({ type: 'table_solo', diff: this.botDiff, matchMode: this.matchMode });
          this.onSolo?.(this.botDiff, this.matchMode);
        }
        break;
      case 'invite': {
        if (!t) return;
        const code = `Table #${t.num}`;
        navigator.clipboard?.writeText?.(code).catch(() => {});
        this.toast(this.room.local ? '💌 Friend invites go live once multiplayer tables are switched on — fill seats with bots for now!' : `💌 ${code} copied — friends can Hot-Join from their Play Hub!`);
        break;
      }
      case 'launch': {
        if (!t) return;
        if (!this.isHost) {
          const mine = t.seats.find((s) => s.userId === this.me);
          const nextReady = !mine?.ready;
          this.room.send({ type: 'table_ready', ready: nextReady });
          this.onReady?.(nextReady);
          return;
        }
        if (this.mode === 'casino') {
          this.room.send({ type: 'table_start' });
          this.onStart?.();
          return;
        }
        // auto-fill empty chairs with bots at the selected difficulty, then start
        t.seats.forEach((s, idx) => { if (s.kind === 'empty') this.room.send({ type: 'table_set_bot', seatIdx: idx, diff: this.botDiff }); });
        this.room.send({ type: 'table_start' });
        this.onStart?.();
        break;
      }
      default:
    }
  }

  onChange(e) {
    const sel = e.target;
    if (sel.dataset.act === 'botdiff') { this.botDiff = sel.value; return; }
    if (sel.dataset.bot != null) {
      const idx = Number(sel.dataset.bot);
      const diff = sel.value || null;
      this.room.send({ type: 'table_set_bot', seatIdx: idx, diff });
      this.onAddBot?.(idx, diff);
    }
  }

  destroy() { this.off.forEach((f) => f?.()); this.root.remove(); }
}

const HUB_ERRORS = {
  need_players: 'Add at least one more player or bot',
  not_ready: 'Waiting for everyone to tap Ready',
  host_only: 'Only the host can do that',
  seat_taken: 'That seat is taken',
  match_running: 'That table is already playing',
  mode_locked: 'This mode unlocks in a later phase',
  no_table: 'Table closed',
  private_table: 'That table is private',
  not_your_turn: 'Not your turn yet',
  ult_not_ready: 'Ultimate not charged yet',
};
