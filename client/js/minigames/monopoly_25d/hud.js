// client/js/minigames/monopoly_25d/hud.js — DOM HUD for Sky Monopoly (Screens 10 & 11).
// Top 12%: 4 player cards (🪙 cash + 👑 net worth + ult ring) · Bottom 16% thumb zone: [1d6 | ⚡2d6] toggle,
// winged ROLL button, rainbow ULTIMATE orb, Overview cam toggle · decision bottom-sheet · anime cut-in ·
// victory podium. Pure presentation: every button only calls the handler passed in by the bridge.
import { MONO, TILES, ZONES, THEMES, rentFor, upgradeCost, PODIUM } from '/shared/monopoly_rules.js';
import { SEAT_COLORS } from './board_scene.js';

const TIER_NAME = ['Land', '🏡 Cozy Villa', '🏢 Luxury Hotel', '🏰 Realm Landmark', '☀️ Sovereign Monument'];
const fmt = (n) => Number(Math.round(n || 0)).toLocaleString('en-US');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const portraitUrl = (lineage) => `/assets/chibi/${lineage || 'bkk'}_base_front.png`;

export class MonopolyHud {
  /**
   * @param {HTMLElement} host   element that overlays the canvas (position: relative/absolute)
   * @param {object} h           handlers { onRoll(use2d6), onUlt(), onCam(), onDecide(choice), onExit(), onRematch(), onMute() }
   */
  constructor(host, h = {}) {
    this.h = h;
    this.use2d6 = false;
    this.root = document.createElement('div');
    this.root.className = 'mono-hud';
    this.root.innerHTML = `
      <div class="mono-top">
        <div class="mono-round"><span class="mono-round-txt">Round 1 / ${MONO.MAX_ROUNDS}</span><button class="mono-mini mono-mute" title="Sound">🔊</button><button class="mono-mini mono-exit" title="Leave">✕</button></div>
        <div class="mono-cards"></div>
      </div>
      <div class="mono-ticker" hidden></div>
      <div class="mono-floats"></div>
      <div class="mono-cutin" hidden></div>
      <div class="mono-bottom">
        <div class="mono-turn-hint"></div>
        <div class="mono-dice-toggle"><button data-d="1" class="on">🎲 1d6</button><button data-d="2">⚡ 2d6 <b class="mono-boost">×3</b></button></div>
        <button class="mono-roll"><span class="wing l"></span><span class="mono-roll-face">🎲</span><span class="mono-roll-txt">ROLL</span><span class="wing r"></span></button>
        <div class="mono-side">
          <button class="mono-ult"><span class="mono-ult-orb"><span class="mono-ult-fill"></span><span class="mono-ult-ico">⚡</span></span><span class="mono-ult-txt">ULTIMATE</span></button>
          <button class="mono-cam">🎥 <span>Follow</span></button>
        </div>
      </div>
      <div class="mono-sheet" hidden></div>
      <div class="mono-podium" hidden></div>`;
    host.appendChild(this.root);
    const $ = (s) => this.root.querySelector(s);
    this.el = {
      cards: $('.mono-cards'), round: $('.mono-round-txt'), ticker: $('.mono-ticker'), floats: $('.mono-floats'),
      cutin: $('.mono-cutin'), roll: $('.mono-roll'), toggle: $('.mono-dice-toggle'), boost: $('.mono-boost'),
      ult: $('.mono-ult'), ultFill: $('.mono-ult-fill'), cam: $('.mono-cam'), hint: $('.mono-turn-hint'),
      sheet: $('.mono-sheet'), podium: $('.mono-podium'), mute: $('.mono-mute'),
    };
    this.el.toggle.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b || b.disabled) return;
      this.use2d6 = b.dataset.d === '2';
      this.el.toggle.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    });
    this.el.roll.addEventListener('click', () => { if (!this.el.roll.disabled) this.h.onRoll?.(this.use2d6); });
    this.el.ult.addEventListener('click', () => { if (!this.el.ult.disabled) this.h.onUlt?.(); });
    this.el.cam.addEventListener('click', () => this.h.onCam?.());
    $('.mono-exit').addEventListener('click', () => this.h.onExit?.());
    this.el.mute.addEventListener('click', () => { const m = this.h.onMute?.(); this.el.mute.textContent = m ? '🔇' : '🔊'; });
  }

  show(on = true) { this.root.hidden = !on; }
  destroy() { this.root.remove(); clearInterval(this.timer); }

  // ------------------------------------------------------------------------- cards
  setPlayers(players, yourSeat) {
    this.players = players;
    this.yourSeat = yourSeat;
    const myDiceSkin = players[yourSeat]?.diceSkin || players[yourSeat]?.equipped?.dice?.id || null;
    const rollFace = this.root.querySelector('.mono-roll-face');
    if (rollFace) {
      rollFace.innerHTML = myDiceSkin
        ? `<img src="/assets/ui/${esc(myDiceSkin)}.png" alt="🎲" style="width:24px;height:24px;object-fit:contain;vertical-align:middle;" />`
        : '🎲';
    }
    this.el.cards.innerHTML = players.map((p) => `
      <div class="mono-card" data-seat="${p.seat}" style="--seat:${SEAT_COLORS[p.seat % 4]}">
        <div class="mono-card-tag">P${p.seat + 1}</div>
        <div class="mono-card-ava" style="background-image:url(${portraitUrl(p.lineage)})"></div>
        <div class="mono-card-name">${esc(p.name)}${p.seat === yourSeat ? ' <i>(you)</i>' : ''}${p.isBot ? ' 🤖' : ''}</div>
        <div class="mono-card-row">🪙 <b class="cash">${fmt(p.cash)}</b></div>
        <div class="mono-card-row">👑 <b class="nw">${fmt(p.cash)}</b></div>
        <div class="mono-card-ult"><span></span></div>
        <div class="mono-card-status"></div>
      </div>`).join('');
  }

  updateCards(scores, turnSeat, players = this.players) {
    for (const s of scores) {
      const c = this.el.cards.querySelector(`[data-seat="${s.seat}"]`);
      if (!c) continue;
      c.querySelector('.cash').textContent = fmt(s.cash);
      c.querySelector('.nw').textContent = fmt(s.netWorth);
      c.querySelector('.mono-card-ult span').style.width = `${Math.min(100, s.ult)}%`;
      c.classList.toggle('turn', s.seat === turnSeat);
      c.classList.toggle('bankrupt', !!s.bankrupt);
      c.classList.toggle('ult-ready', s.ult >= 100);
      const p = players?.[s.seat];
      const st = p?.status;
      const icons = [];
      if (st?.skipTurn) icons.push('❄️');
      if (st?.fixedRoll) icons.push('🌙');
      if (st?.moveDir === -1) icons.push('🕰️');
      if (st?.lapTax) icons.push('🎡');
      if (st?.discountPct) icons.push('🔥');
      if (p?.shields) icons.push(`🛡️${p.shields > 1 ? p.shields : ''}`);
      if (p?.coupons) icons.push('🎟️');
      if (p?.revive) icons.push('🐦‍🔥');
      if (p?.boardDiamonds) icons.push(`💎${p.boardDiamonds}`);
      c.querySelector('.mono-card-status').textContent = icons.join(' ');
    }
  }

  /** Animate a single card's cash by delta (used while replaying events). */
  bumpCash(seat, delta) {
    const c = this.el.cards.querySelector(`[data-seat="${seat}"]`);
    if (!c || !delta) return;
    c.classList.remove('gain', 'loss');
    void c.offsetWidth;
    c.classList.add(delta > 0 ? 'gain' : 'loss');
  }

  setRound(round, max) { this.el.round.textContent = `Round ${Math.min(round, max)} / ${max}`; }

  // ------------------------------------------------------------------------- controls
  setControls({ myTurn, canRoll, can2d6, boost, canUlt, ult, busy, waitingName, deadline, fixedRoll }) {
    const enabled = canRoll && !busy;
    this.el.roll.disabled = !enabled;
    this.el.roll.classList.toggle('pulse', enabled);
    this.el.boost.textContent = `×${boost ?? 0}`;
    const b2 = this.el.toggle.querySelector('[data-d="2"]');
    b2.disabled = !can2d6;
    if (!can2d6 && this.use2d6) { this.use2d6 = false; this.el.toggle.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x.dataset.d === '1')); }
    this.el.ult.disabled = !(canUlt && !busy);
    this.el.ult.classList.toggle('ready', !!canUlt && !busy);
    this.el.ultFill.style.height = `${Math.min(100, ult || 0)}%`;
    this.deadline = deadline || null;
    clearInterval(this.timer);
    const hint = () => {
      let t = myTurn ? (fixedRoll ? `🌙 Sleepwalk — you will move exactly ${fixedRoll}` : 'Your turn! Roll the dice 🎲') : waitingName ? `⏳ ${esc(waitingName)} is playing…` : '';
      if (busy) t = '';
      if (myTurn && this.deadline && !busy) { const s = Math.max(0, Math.ceil((this.deadline - Date.now()) / 1000)); t += ` <b class="mono-timer">${s}s</b>`; }
      this.el.hint.innerHTML = t;
    };
    hint();
    if (myTurn && this.deadline) this.timer = setInterval(hint, 500);
  }

  setCamLabel(mode) { this.el.cam.querySelector('span').textContent = mode === 'follow' ? 'Follow' : 'Overview'; }

  // ------------------------------------------------------------------------- transient fx
  ticker(text, ms = 2200) {
    const t = this.el.ticker;
    t.innerHTML = text;
    t.hidden = false;
    t.classList.remove('show'); void t.offsetWidth; t.classList.add('show');
    clearTimeout(this.tickT);
    this.tickT = setTimeout(() => { t.hidden = true; }, ms);
  }

  float(text, pos, { color = '#fff', big = false } = {}) {
    if (!pos) return;
    const r = this.root.getBoundingClientRect();
    const d = document.createElement('div');
    d.className = `mono-float${big ? ' big' : ''}`;
    d.style.left = `${pos.x - r.left}px`;
    d.style.top = `${pos.y - r.top}px`;
    d.style.color = color;
    d.textContent = text;
    this.el.floats.appendChild(d);
    setTimeout(() => d.remove(), 1400);
  }

  /** 1.2 s anime hero cut-in banner; dual Couple Finisher banner when the partner is seated. */
  cutIn({ title, name, icon, caster, partner = null, finisher = false }) {
    const el = this.el.cutin;
    el.innerHTML = `
      <div class="mono-cutin-band ${partner ? 'couple' : ''}">
        <div class="mono-cutin-title">${icon || '⚡'} ${esc(title || 'MYTHIC ULTIMATE')}${partner ? ' • 💞 COUPLE SYNERGY +15%' : ''}</div>
        <div class="mono-cutin-faces">
          <div class="mono-cutin-face" style="background-image:url(${portraitUrl(caster?.lineage)})"></div>
          ${partner ? `<div class="mono-cutin-face" style="background-image:url(${portraitUrl(partner.lineage)})"></div>` : ''}
        </div>
        <div class="mono-cutin-name">${esc(name)}${finisher ? '<br><span class="strike">BANKRUPTCY STRIKE!</span>' : ''}</div>
        <div class="mono-cutin-who">${esc(caster?.name || '')}${partner ? ` &amp; ${esc(partner.name)}` : ''}</div>
      </div>`;
    el.hidden = false;
    el.classList.remove('play'); void el.offsetWidth; el.classList.add('play');
    return new Promise((res) => setTimeout(() => { el.hidden = true; res(); }, 1250));
  }

  // ------------------------------------------------------------------------- decisions
  showDecision(pd, m, seat) {
    const s = this.el.sheet;
    const p = m.players[seat];
    const tile = pd.tile != null ? TILES[pd.tile] : null;
    const zone = tile?.zone ? ZONES[tile.zone] : null;
    const btn = (id, label, cls = 'gold', disabled = false) => `<button class="mono-btn ${cls}" data-choice="${esc(id)}" ${disabled ? 'disabled' : ''}>${label}</button>`;
    let body = '', actions = '';
    const rentRow = (lvl) => {
      if (!tile || tile.kind !== 'property') return '';
      const rows = [0, 1, 2, 3].map((l) => `<span class="${l === lvl ? 'cur' : ''}">${TIER_NAME[l].replace(/^[^ ]+ /, '')}</span><b class="${l === lvl ? 'cur' : ''}">🪙 ${fmt(tile.price * MONO.RENT_MULT[l])}</b>`).join('');
      return `<div class="mono-rents">${rows}</div>`;
    };
    const head = tile ? `<div class="mono-tilecard" style="--zone:${zone?.color || '#9bb'}"><div class="mono-tilecard-strip">${zone ? `${THEMES[zone.theme]?.icon || ''} ${esc(zone.name)}${p.affinity && p.affinity === zone.theme ? ' • ⭐ HOME TURF +15%' : ''}` : esc(tile.name)}</div><div class="mono-tilecard-name">${tile.icon || ''} ${esc(tile.name)}</div>${tile.price ? `<div class="mono-tilecard-price">Base 🪙 ${fmt(tile.price)}</div>` : ''}</div>` : '';
    switch (pd.kind) {
      case 'buy':
        body = `${head}${rentRow(0)}<div class="mono-note">You have 🪙 ${fmt(p.cash)} → 🪙 ${fmt(p.cash - pd.cost)} after buying</div>`;
        actions = btn('buy', `🏠 Buy for 🪙 ${fmt(pd.cost)}`) + btn('skip', 'Skip', 'plain');
        break;
      case 'upgrade':
        body = `${head}<div class="mono-note big">Build ${TIER_NAME[pd.toLevel]}</div>${rentRow(pd.toLevel)}${pd.coupon ? '<div class="mono-note">🎟️ Free Upgrade Coupon will be used!</div>' : ''}`;
        actions = btn('upgrade', pd.coupon ? '🎟️ Upgrade FREE' : `⬆️ Upgrade 🪙 ${fmt(pd.cost)}`) + btn('skip', 'Not now', 'plain');
        break;
      case 'takeover':
        body = `${head}<div class="mono-note big">⚔️ Hostile Takeover from <b>${esc(m.players[pd.from]?.name)}</b></div><div class="mono-note">Pay 2× its invested value — they receive the cash.</div>`;
        actions = btn('takeover', `⚔️ Seize for 🪙 ${fmt(pd.cost)}`, 'red', p.cash < pd.cost) + btn('skip', 'Leave it', 'plain');
        break;
      case 'vault':
        body = `${head}<div class="mono-note">Pick 1 tactical gadget</div>`;
        actions = pd.options.map((o) => btn(o.id, o.label, 'card', o.disabled)).join('');
        break;
      case 'warp':
      case 'warp_any':
        body = `<div class="mono-note big">${pd.kind === 'warp' ? '✈️ Sky Warp — fly to START or one of your lands' : '🧞 Magic Carpet — fly anywhere!'}</div>`;
        actions = `<div class="mono-warp-grid">${pd.options.map((o) => btn(o.id, `${TILES[o.id].icon || ''} ${esc(o.label)}`, 'chip')).join('')}</div>${pd.canSkip ? btn('skip', 'Stay here', 'plain') : ''}`;
        break;
      case 'choice':
        body = '<div class="mono-note big">🪔 Choose your Cosmic Wish</div>';
        actions = pd.options.map((o) => btn(o.id, esc(o.label), 'card')).join('');
        break;
      default:
        actions = pd.options.map((o) => btn(o.id, esc(o.label), 'card', o.disabled)).join('') + (pd.canSkip ? btn('skip', 'Skip', 'plain') : '');
    }
    s.innerHTML = `<div class="mono-sheet-card">${body}<div class="mono-sheet-actions">${actions}</div></div>`;
    s.hidden = false;
    s.onclick = (e) => {
      const b = e.target.closest('[data-choice]');
      if (!b || b.disabled) return;
      s.hidden = true;
      const raw = b.dataset.choice;
      this.h.onDecide?.(/^\d+$/.test(raw) ? Number(raw) : raw);
    };
  }

  hideDecision() { this.el.sheet.hidden = true; }

  // ------------------------------------------------------------------------- podium (Screen 11)
  showPodium({ result, rewards, players, yourSeat, finisherName = null, solo = false }) {
    const el = this.el.podium;
    const rank = result.ranking;
    const pillar = (r, cls) => {
      if (!r) return '<div class="mono-pillar empty"></div>';
      const p = players[r.seat];
      return `<div class="mono-pillar ${cls}" style="--seat:${SEAT_COLORS[r.seat % 4]}">
        <div class="mono-pillar-ava" style="background-image:url(${portraitUrl(p?.lineage)})"></div>
        <div class="mono-pillar-block"><div class="mono-pillar-rank">${r.rank}</div><div class="mono-pillar-name">${r.rank === 1 ? '👑 ' : ''}${esc(r.name)}</div><div class="mono-pillar-nw">👑 ${fmt(r.netWorth)}</div></div>
      </div>`;
    };
    const mine = rank.find((r) => r.seat === yourSeat);
    const rw = rewards || (mine ? { gold: PODIUM.GOLD[mine.rank - 1], berries: PODIUM.BERRIES[mine.rank - 1], diamonds: PODIUM.DIAMONDS[mine.rank - 1] + (mine.boardDiamonds || 0), podiumDiamonds: PODIUM.DIAMONDS[mine.rank - 1], boardDiamonds: mine.boardDiamonds || 0, preview: true } : null);
    const reason = { rounds: `🏁 ${result.rounds} rounds complete — ranked by 👑 Net Worth`, last_standing: '💥 Last tycoon standing!', finisher: '⚡ MYTHIC FINISHER — BANKRUPTCY STRIKE!' }[result.reason] || '';
    const diamondParts = [];
    if (rw?.podiumDiamonds) diamondParts.push(`${rw.podiumDiamonds} Podium`);
    if (rw?.dailyBonusDiamonds) diamondParts.push(`+${rw.dailyBonusDiamonds} Daily 1st`);
    if (rw?.boardDiamonds) diamondParts.push(`+${rw.boardDiamonds} Board`);
    el.innerHTML = `
      ${result.reason === 'finisher' ? `<div class="mono-finisher">⚡ MYTHIC FINISHER${finisherName ? `: ${esc(finisherName)}` : ''}<br><b>BANKRUPTCY STRIKE!</b></div>` : ''}
      <div class="mono-podium-title">${mine?.rank === 1 ? '🏆 VICTORY!' : mine ? `You placed #${mine.rank}` : 'Match Over'}</div>
      <div class="mono-podium-reason">${reason}</div>
      <div class="mono-pillars">${pillar(rank[1], 'second')}${pillar(rank[0], 'first')}${pillar(rank[2], 'third')}${pillar(rank[3], 'fourth')}</div>
      ${rw ? `<div class="mono-rewards">
        <div class="mono-rewards-title">🏆 ${mine?.rank === 1 ? 'VICTORY' : 'MATCH'} REWARDS ${rw.tableScale ? `<i>(Table ${Number(rw.tableScale).toFixed(2)}×${rw.coupleBonus ? ' • 💞 Couple' : ''})</i>` : ''}${rw.preview ? ' <i>(preview)</i>' : ''}</div>
        ${rw.diamonds ? `<div class="mono-reward-row">💎 <b>+${fmt(rw.diamonds)}</b> Diamonds ${diamondParts.length > 1 ? `<small>(${diamondParts.join(' ')})</small>` : ''}</div>` : ''}
        <div class="mono-reward-row">🪙 <b>+${fmt(rw.gold)}</b> Gold &amp; 🍓 <b>+${fmt(rw.berries)}</b> Star-Berries${rw.multiplier ? ` <i>(${rw.multiplier}x)</i>` : ''}</div>
        ${rw.ticketBonus ? `<div class="mono-reward-row">🎟️ <b>+${rw.ticketBonus} Standard Gacha Ticket</b> (Daily 1st Match!)</div>` : ''}
        ${rw.chest ? `<div class="mono-reward-row">🎁 Bonus Podium Chest: <b>${rw.chestItem === 'ticket_standard' ? '🎟️ Standard Gacha Ticket!' : '📦 Random Dupe Box!'}</b></div>` : ''}
      </div>` : ''}
      <div class="mono-podium-actions">
        <button class="mono-btn wood" data-act="exit">🏛️ Town Hall Plaza</button>
        <button class="mono-btn gold" data-act="again">🔄 Play Again<small>(Keep 4-Seat Table!)</small></button>
      </div>`;
    el.hidden = false;
    el.onclick = (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      if (b.dataset.act === 'exit') this.h.onExit?.();
      else this.h.onRematch?.();
    };
    void solo;
  }

  hidePodium() { this.el.podium.hidden = true; }
}

export { TIER_NAME, rentFor, upgradeCost };
