// client/js/heart_isle_ui.js — Couples: Heart Isle UI (Master Plan v2 §12).
// Shared Chest modal (deposit / withdraw), a minimal "Decorate Heart Isle" placement mode and the
// couple mailbox. Server actions: hi_state, hi_place, hi_remove, hi_deposit, hi_withdraw, couple_send.
import { heartIslandOf, worldToCell } from '/shared/village_rules.js';

const DECOR_CHOICES = [
  ['heart_arch', '💗', 'Heart Arch'],
  ['twin_lanterns', '🏮', 'Twin Lanterns'],
  ['rose_hedge', '🌹', 'Rose Hedge'],
  ['couple_bench', '🪑', 'Couple Bench'],
  ['photo_booth', '📸', 'Photo Booth (2×2)'],
  ['wisteria_pergola', '🪻', 'Wisteria Pergola (2×2)'],
  ['dec_nookairline_museum', '✈️', 'NookAirline Museum (2×2)'],
  ['wnd_ferris', '🎡', 'Couple Ferris Wheel (4×4, if owned)'],
];

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export class HeartIsleUI {
  constructor({ world, request, toast = () => {}, humanError = (e) => e, openModal, closeModal = () => {} } = {}) {
    this.world = world;
    this.request = request;
    this.toast = toast;
    this.humanError = humanError;
    this.openModal = openModal;
    this.closeModal = closeModal;
    this.placing = null;          // decor type while in decorate mode
    this.btn = null;
  }

  /** Wrap the engine's pick handler and add the HUD button (call after main.js sets world.onPick). */
  install(hudEl) {
    const prev = this.world.onPick;
    this.world.onPick = (pk, hit) => this.onPick(pk, hit) || !!prev?.(pk, hit);
    if (hudEl && !document.getElementById('act-heart-isle')) {
      const b = document.createElement('button');
      b.id = 'act-heart-isle';
      b.className = 'act';
      b.hidden = true;
      b.innerHTML = '<span class="ico">💞</span><span class="act-txt"><span>Decorate Heart Isle</span></span>';
      b.onclick = () => this.toggleDecorate();
      hudEl.appendChild(b);
      this.btn = b;
    }
    this._timer = setInterval(() => this.syncButton(), 1000);
    return this;
  }

  get heart() { return heartIslandOf(this.world?.layout); }

  syncButton() {
    if (!this.btn) return;
    const h = this.heart;
    const show = !!h && !h.village?.frozen;
    this.btn.hidden = !show;
    if (!show && this.placing) this.placing = null;
    const label = this.btn.querySelector('.act-txt span');
    if (label) label.textContent = this.placing ? 'Done Decorating' : 'Decorate Heart Isle';
  }

  onPick(pk, hit) {
    const h = this.heart;
    if (!pk || !h || pk.owner !== h.owner) return false;
    if (pk.kind === 'heart_chest') { this.openChest(); return true; }
    if (!this.placing) return false;
    if (pk.kind === 'heart_decor') { this.confirmRemove(pk); return true; }
    if (pk.kind === 'heart_ground' && hit) { this.placeAt(h, hit); return true; }
    return false;
  }

  toggleDecorate() {
    if (this.placing) { this.placing = null; this.syncButton(); this.toast('💞 Decorating done'); return; }
    const body = `<div class="hi-decor-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${
      DECOR_CHOICES.map(([k, ico, name]) => `<button class="btn-gold small" data-decor="${k}">${ico} ${esc(name)}</button>`).join('')
    }</div><p style="opacity:.75;margin-top:8px">Pick a decor, then tap an empty cell on the Heart Isle. Tap placed decor to remove it.</p>`;
    this.openModal('💞 Decorate Heart Isle', body, [{ label: 'Close' }], (root) => {
      root.querySelectorAll('[data-decor]').forEach((el) => {
        el.onclick = () => {
          this.placing = el.dataset.decor;
          this.closeModal();
          this.syncButton();
          this.toast('💞 Tap a cell on the Heart Isle to place it');
        };
      });
    });
  }

  async placeAt(h, hit) {
    const { gx, gy } = worldToCell(h, hit.x, hit.z);
    const r = await this.request('hi_place', { decor: this.placing, x: gx, y: gy });
    this.toast(r.ok ? '💞 Placed!' : `💔 ${this.humanError(r.error)}`);
  }

  confirmRemove(pk) {
    this.openModal('Remove decor?', `<p>Remove <b>${esc(pk.type)}</b> from your Heart Isle?</p>`, [
      { label: 'Remove', onClick: async () => { const r = await this.request('hi_remove', { id: pk.uid }); if (!r.ok) this.toast(`💔 ${this.humanError(r.error)}`); } },
      { label: 'Cancel' },
    ]);
  }

  // ------------------------------------------------------------------ Shared Chest
  async openChest() {
    const st = await this.request('hi_state');
    if (!st.ok || !st.isle) { this.toast(`💔 ${this.humanError(st.error || 'not_coupled')}`); return; }
    const frozen = !!st.isle.frozen;
    const rows = (items, verb) => {
      const entries = Object.entries(items || {}).filter(([, n]) => n > 0);
      if (!entries.length) return '<p style="opacity:.6">Empty</p>';
      return entries.map(([id, n]) => `<div class="hi-row" style="display:flex;align-items:center;gap:6px;margin:3px 0">
        <span style="flex:1">${esc(id)} × ${n}</span>
        ${frozen ? '' : `<button class="btn-gold small" data-act="${verb}" data-id="${esc(id)}" data-n="1">1</button>
        <button class="btn-gold small" data-act="${verb}" data-id="${esc(id)}" data-n="${Math.min(10, n)}">${Math.min(10, n)}</button>
        <button class="btn-gold small" data-act="${verb}" data-id="${esc(id)}" data-n="${n}">All</button>
        ${verb === 'hi_deposit' && st.mail ? `<button class="btn-gold small" title="Send to partner" data-act="couple_send" data-id="${esc(id)}" data-n="${Math.min(10, n)}">💌${Math.min(10, n)}</button>` : ''}`}</div>`).join('');
    };
    const mine = { ...(st.stores?.warehouse || {}), ...(st.stores?.pantry || {}) };
    const mail = st.mail ? `<p style="opacity:.75">💌 Mailbox today: ${st.mail.sentToday} sent · ${st.mail.remaining == null ? 'unlimited' : `${st.mail.remaining} left`}</p>` : '';
    const body = `${frozen ? '<p>🕊️ Memory Isle: read-only</p>' : ''}
      <h4>🎁 Shared Chest</h4>${rows(st.isle.storage, 'hi_withdraw')}
      ${frozen ? '' : `<h4>🏠 Your Stores</h4>${rows(mine, 'hi_deposit')}
      <p style="opacity:.75">Tap a number to deposit it into the chest, or 💌 to mail it to your partner.</p>${mail}`}`;
    this.openModal('💞 Heart Isle Chest', body, [{ label: 'Close' }], (root) => {
      root.querySelectorAll('[data-act]').forEach((el) => {
        el.onclick = async () => {
          const items = { [el.dataset.id]: Number(el.dataset.n) };
          const type = el.dataset.act;
          const r = await this.request(type, { items });
          this.toast(r.ok ? (type === 'couple_send' ? '💌 Sent!' : '💞 Done') : `💔 ${this.humanError(r.error)}`);
          if (r.ok) this.openChest();
        };
      });
    });
  }
}
