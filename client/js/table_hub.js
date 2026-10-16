// client/js/table_hub.js — Universal 4-Seat Table Hub UI (Screen 09, Implementation Plan §10.A).
// 4 mode tabs · 2.5D 4-chair VIP table preview (Ready / Bot: Easy-Hard-Insane / Invite-Tap to Sit) ·
// live open tables with Hot-Join · [⚡ Play Solo Now (Instant)] [🚀 Launch 4-Player Match!].
// Talks only to a room transport (LocalRoom / NetRoom) — no game logic lives here.
import { MODES } from '/shared/universal_room.js';
import { PODIUM } from '/shared/monopoly_rules.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const portrait = (lineage) => `/assets/chibi/${lineage || 'bkk'}_base_front.png`;
const DIFF_LABEL = { easy: '🤖 Bot: Easy', hard: '🤖 Bot: Hard', insane: '🤖 Bot: Insane' };
const SEAT_ROLE = ['Host', 'Partner', 'Seat 3', 'Seat 4'];

export class TableHub {
  /**
   * @param {HTMLElement} host
   * @param {object} room   LocalRoom | NetRoom
   * @param {object} o      { toast(msg), onClose(), profile }
   */
  constructor(host, room, { toast = () => {}, onClose = () => {}, profile = null } = {}) {
    this.room = room;
    this.toast = toast;
    this.onClose = onClose;
    this.profile = profile;
    this.mode = 'monopoly';
    this.botDiff = 'hard';
    this.table = null;
    this.tables = [];
    this.root = document.createElement('div');
    this.root.className = 'hub-wrap';
    this.root.hidden = true;
    host.appendChild(this.root);
    this.off = [
      room.on('table_state', (m) => { if (m.table) { this.table = m.table.status === 'ended' ? this.table : m.table; this.render(); } }),
      room.on('table_list_update', (m) => { if (!m.mode || m.mode === this.mode) { this.tables = m.tables || []; this.render(); } }),
      room.on('table_error', (m) => this.toast(`🪑 ${HUB_ERRORS[m.error] || m.error}`)),
    ];
    this.root.addEventListener('click', (e) => this.onClick(e));
    this.root.addEventListener('change', (e) => this.onChange(e));
  }

  open() {
    this.root.hidden = false;
    this.room.send({ type: 'table_list', mode: this.mode });
    if (!this.table || this.table.status === 'ended') this.room.send({ type: 'table_create', mode: this.mode });
    this.render();
  }

  close({ leave = false } = {}) {
    this.root.hidden = true;
    if (leave) { this.room.send({ type: 'table_leave' }); this.table = null; }
  }

  get isOpen() { return !this.root.hidden; }
  get me() { return this.room.userId; }
  get isHost() { return this.table?.hostId === this.me; }

  // ------------------------------------------------------------------------- render
  render() {
    if (this.root.hidden) return;
    const t = this.table;
    const tabs = Object.entries(MODES).map(([k, m]) => `
      <button class="hub-tab ${k === this.mode ? 'on' : ''} ${m.available ? '' : 'locked'}" data-tab="${k}">
        <span class="hub-tab-ico">${m.icon}</span><span>${m.label}</span>${m.available ? '' : `<em>🔒 Phase ${m.phase}</em>`}
      </button>`).join('');
    const seats = t ? t.seats : [];
    const chair = (s, idx) => {
      const pos = ['tl', 'tr', 'bl', 'br'][idx];
      if (!s || s.kind === 'empty') {
        return `<div class="hub-chair ${pos} empty" data-seat="${idx}"><div class="hub-chair-seat"></div>
          <div class="hub-chair-badge"><b>Seat ${idx + 1}</b><span>${this.isHost ? '➕ Add Bot / Invite' : '🪑 Tap to Sit'}</span></div></div>`;
      }
      const isMe = s.userId === this.me;
      const ava = `<div class="hub-chair-ava ${s.kind === 'bot' ? 'bot' : ''}" style="background-image:url(${portrait(s.lineage)})">${s.kind === 'bot' ? '<span class="hub-bot-ico">🤖</span>' : ''}</div>`;
      const badge = s.kind === 'bot'
        ? `<div class="hub-chair-badge"><b>Seat ${idx + 1}</b><span>${DIFF_LABEL[s.botDiff]}</span>${this.isHost && t.status === 'lobby' ? `<select data-bot="${idx}">${['easy', 'hard', 'insane'].map((d) => `<option value="${d}" ${d === s.botDiff ? 'selected' : ''}>${DIFF_LABEL[d]}</option>`).join('')}<option value="">✖ Remove</option></select>` : ''}</div>`
        : `<div class="hub-chair-badge"><b>Seat ${idx + 1}</b><small>(${idx === 0 || s.userId === t.hostId ? 'Host' : SEAT_ROLE[idx]})</small><span>${s.userId === t.hostId ? '👑 ' : ''}${esc(s.name)}${s.level ? ` Lv.${s.level}` : ''}${isMe ? ' (you)' : ''}</span>
            <i class="hub-ready ${s.ready ? 'on' : ''}">${s.ready ? '✓ READY' : '… not ready'}</i>${s.connected ? '' : '<i class="hub-off">📴 offline</i>'}</div>`;
      return `<div class="hub-chair ${pos} ${s.kind}" data-seat="${idx}"><div class="hub-chair-seat"></div>${ava}${badge}</div>`;
    };
    const others = this.tables.filter((x) => x.id !== t?.id);
    const list = others.length ? others.map((x) => `
      <div class="hub-live">
        <div class="hub-live-name">${MODES[x.mode]?.icon || '🎲'} Table #${x.num} • ${esc(x.name)}</div>
        <div class="hub-live-avas">${x.seats.filter((s) => s.kind !== 'empty').map((s) => `<span style="background-image:url(${portrait(s.lineage)})">${s.kind === 'bot' ? '🤖' : ''}</span>`).join('')}</div>
        <div class="hub-live-meta">🪑 ${x.players}/4 Seats</div>
        ${x.status === 'lobby' && x.players < 4 || x.seats.some((s) => s.kind === 'bot') && x.status === 'lobby'
          ? `<button class="hub-btn green" data-join="${x.id}">🪑 Hot-Join Seat</button>`
          : `<button class="hub-btn plain" disabled>${x.status === 'playing' ? '▶ In match' : 'Full'}</button>`}
      </div>`).join('') : '<div class="hub-empty">No other open tables right now — create yours and invite friends! 💌</div>';
    const humansReady = seats.filter((s) => s.kind === 'human' && s.userId !== t?.hostId).every((s) => s.ready);
    const mySeat = seats.find((s) => s.userId === this.me);
    const launchLabel = this.isHost ? '🚀 Launch 4-Player Match!' : mySeat?.ready ? '✓ Ready! (waiting for host)' : '✋ I\'m Ready!';
    this.root.innerHTML = `
      <div class="hub">
        <div class="hub-head"><span>🎮 PLAY &amp; 4-SEAT TABLE HUB</span><button class="hub-x" data-act="close">✕</button></div>
        <div class="hub-tabs">${tabs}</div>
        <div class="hub-table-card">
          <div class="hub-table-title">🪑 ${t ? `Table #${t.num} — ${esc(t.name)}` : 'Setting up your table…'}</div>
          <div class="hub-stage">
            <div class="hub-board"><div class="hub-board-top"><span>🎲</span></div></div>
            ${[0, 1, 2, 3].map((k) => chair(seats[k], k)).join('')}
          </div>
          <div class="hub-table-tools">
            <label class="hub-botpick">🤖 Fill with <select data-act="botdiff">${['easy', 'hard', 'insane'].map((d) => `<option value="${d}" ${d === this.botDiff ? 'selected' : ''}>${DIFF_LABEL[d].replace('🤖 ', '')}</option>`).join('')}</select></label>
            <button class="hub-btn invite" data-act="invite">➕ Invite Friend / Tap to Sit</button>
          </div>
          <div class="hub-info">
            <span>🎲 Mode: <b>24-Tile 2.5D Follow-Cam</b></span>
            <span>⚡ 3x Double-Dice Boost: <b class="on">ON</b></span>
            <span>🏆 Win: <b>🪙 ${PODIUM.GOLD[3]}–${PODIUM.GOLD[0].toLocaleString('en-US')}</b> + 💎</span>
          </div>
        </div>
        <div class="hub-list">
          <div class="hub-list-title">Live Open Tables (${others.length} Active)</div>
          ${list}
        </div>
        <div class="hub-foot">
          <button class="hub-btn blue big" data-act="solo">⚡ Play Solo Now<small>(Instant)</small></button>
          <button class="hub-btn gold big" data-act="launch" ${!t || (this.isHost && !humansReady) ? '' : ''}>${launchLabel}</button>
        </div>
      </div>`;
  }

  // ------------------------------------------------------------------------- input
  onClick(e) {
    const el = e.target.closest('[data-act],[data-tab],[data-seat],[data-join]');
    if (!el || e.target.tagName === 'SELECT' || e.target.tagName === 'OPTION') return;
    const t = this.table;
    if (el.dataset.tab) {
      const m = MODES[el.dataset.tab];
      if (!m.available) { this.toast(`${m.icon} ${m.label} opens in Phase ${m.phase} 🔒`); return; }
      this.mode = el.dataset.tab; this.render(); return;
    }
    if (el.dataset.join) { this.room.send({ type: 'table_sit', tableId: el.dataset.join }); return; }
    if (el.dataset.seat != null && !el.dataset.act) {
      const idx = Number(el.dataset.seat);
      const s = t?.seats[idx];
      if (!t || t.status !== 'lobby' || !s) return;
      if (s.kind === 'empty') {
        if (this.isHost) this.room.send({ type: 'table_set_bot', seatIdx: idx, diff: this.botDiff });
        else this.room.send({ type: 'table_sit', tableId: t.id, seatIdx: idx });
      }
      return;
    }
    switch (el.dataset.act) {
      case 'close': this.close({ leave: true }); this.onClose(); break;
      case 'solo': this.room.send({ type: 'table_solo', diff: this.botDiff }); break;
      case 'invite': {
        if (!t) return;
        const code = `Table #${t.num}`;
        navigator.clipboard?.writeText?.(code).catch(() => {});
        this.toast(this.room.local ? '💌 Friend invites go live once multiplayer tables are switched on — fill seats with bots for now!' : `💌 ${code} copied — friends can Hot-Join from their Play Hub!`);
        break;
      }
      case 'launch': {
        if (!t) return;
        if (!this.isHost) { const mine = t.seats.find((s) => s.userId === this.me); this.room.send({ type: 'table_ready', ready: !mine?.ready }); return; }
        // auto-fill empty chairs with bots at the selected difficulty, then start
        t.seats.forEach((s, idx) => { if (s.kind === 'empty') this.room.send({ type: 'table_set_bot', seatIdx: idx, diff: this.botDiff }); });
        this.room.send({ type: 'table_start' });
        break;
      }
      default:
    }
  }

  onChange(e) {
    const sel = e.target;
    if (sel.dataset.act === 'botdiff') { this.botDiff = sel.value; return; }
    if (sel.dataset.bot != null) this.room.send({ type: 'table_set_bot', seatIdx: Number(sel.dataset.bot), diff: sel.value || null });
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
