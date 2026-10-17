// client/js/minigames/casino/casino_ui.js — Grand Starlight Casino UI (Screens 12 & 13).
// Handles Pok-Deng (Mode 2A) and Zeus Lightning Roulette (Mode 2B).
// Pure functional DOM with semantic ids and data-* hooks.

const SUITS = Object.freeze(['♠', '♥', '♦', '♣']);
const RANKS = Object.freeze(['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']);
const RED_NUMS = Object.freeze(new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]));

const colorOf = (n) => (n === 0 ? 'green' : RED_NUMS.has(n) ? 'red' : 'black');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function renderCard(c) {
  if (!c || c.r == null || c.s == null) {
    return '<span class="card card-back" data-card="back">🂠</span>';
  }
  const isRed = c.s === 1 || c.s === 2;
  const rankStr = RANKS[c.r] || String(c.r);
  const suitStr = SUITS[c.s] || '';
  return `<span class="card ${isRed ? 'card-red' : 'card-black'}" data-r="${c.r}" data-s="${c.s}">${rankStr}${suitStr}</span>`;
}

export class CasinoUI {
  /**
   * @param {object} opts
   * @param {object} opts.net         Net instance with .send(msg)
   * @param {() => object} opts.getProfile  Returns player profile with .id, .gold, etc.
   * @param {(msg: string) => void} opts.toast
   * @param {() => void} opts.onExit
   */
  constructor({ net, getProfile, toast, onExit }) {
    this.net = net;
    this.getProfile = getProfile;
    this.toast = toast || console.log;
    this.onExit = onExit || (() => {});

    this.table = null;
    this.tableId = null;
    this.game = 'pokdeng'; // 'pokdeng' | 'roulette'
    this.state = null;
    this.selectedChip = 100;
    this.pendingBets = []; // for roulette: [{ type, n?, amount }]
    this.lastSpinBets = []; // for roulette rebet
    this.history = []; // last results
    this.strikes = []; // roulette strikes

    this.serverNow = 0;
    this.phaseEndsAt = 0;
    this.skew = 0;
    this.timerInterval = null;

    this.root = null;
    this._initDom();
  }

  get myUserId() {
    return this.getProfile?.()?.id || null;
  }

  _initDom() {
    let existing = document.getElementById('casino-root');
    if (!existing) {
      existing = document.createElement('div');
      existing.id = 'casino-root';
      existing.className = 'casino-fullscreen';
      existing.hidden = true;
      document.body.appendChild(existing);
    }
    this.root = existing;
    this.root.addEventListener('click', (e) => this.onClick(e));
  }

  open(table) {
    if (!table) return;
    this.table = table;
    this.tableId = table.id;
    this.game = table.options?.casinoGame || table.casinoGame || 'pokdeng';
    this.state = null;
    this.pendingBets = [];
    this.root.dataset.casinoGame = this.game;
    this.root.hidden = false;

    this._startTimer();
    this.render();
  }

  close() {
    this._stopTimer();
    if (this.root) {
      this.root.hidden = true;
      this.root.innerHTML = '';
    }
    this.table = null;
    this.tableId = null;
    this.state = null;
  }

  _startTimer() {
    this._stopTimer();
    this.timerInterval = setInterval(() => this.updateTimer(), 100);
  }

  _stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  updateTimer() {
    if (!this.state || !this.phaseEndsAt) return;
    const now = Date.now() + this.skew;
    const remainMs = Math.max(0, this.phaseEndsAt - now);
    const remainSec = (remainMs / 1000).toFixed(1);

    const phaseEl = this.root.querySelector('#casino-phase');
    if (phaseEl) {
      const phaseName = (this.state.phase || '').toUpperCase();
      phaseEl.textContent = `${phaseName} • ${remainSec}s`;
    }

    const rouletteCountdown = this.root.querySelector('#roulette-countdown');
    if (rouletteCountdown) {
      const isBetting = this.state.phase === 'betting';
      rouletteCountdown.textContent = `⏱️ ${isBetting ? 'Spin in' : (this.state.phase || '').toUpperCase()} ${remainSec}s...`;
    }

    const fillEl = this.root.querySelector('#casino-phase-fill');
    if (fillEl && this.phaseTotalMs) {
      const pct = Math.min(100, Math.max(0, (remainMs / this.phaseTotalMs) * 100));
      fillEl.style.width = `${pct}%`;
    }
  }

  /**
   * Dispatches incoming socket packets. Returns true if handled.
   * @param {object} msg
   * @returns {boolean}
   */
  handle(msg) {
    if (!msg || !msg.type) return false;
    if (msg.type === 'casino_state') {
      if (this.tableId && msg.tableId && msg.tableId !== this.tableId) return false;
      this.onState(msg);
      return true;
    }
    if (msg.type === 'casino_result') {
      if (this.tableId && msg.tableId && msg.tableId !== this.tableId) return false;
      this.onResult(msg);
      return true;
    }
    if (msg.type === 'casino_error') {
      if (this.tableId && msg.tableId && msg.tableId !== this.tableId) return false;
      this.onError(msg);
      return true;
    }
    return false;
  }

  onState(msg) {
    this.state = msg;
    if (msg.game) {
      this.game = msg.game;
      this.root.dataset.casinoGame = this.game;
    }
    this.serverNow = msg.serverNow || Date.now();
    this.phaseEndsAt = msg.phaseEndsAt || 0;
    this.skew = msg.serverNow ? (msg.serverNow - Date.now()) : 0;

    // Approximate total ms for the current phase bar
    if (this.game === 'pokdeng') {
      const PHASE_MAP = { betting: 4000, deal: 2000, action: 4000, dealer: 2000 };
      this.phaseTotalMs = PHASE_MAP[msg.phase] || 4000;
    } else {
      const PHASE_MAP = { betting: 8000, spin: 5000, result: 2000 };
      this.phaseTotalMs = PHASE_MAP[msg.phase] || 8000;
    }

    if (msg.history && Array.isArray(msg.history)) {
      this.history = msg.history;
    }

    if (msg.strikes && Array.isArray(msg.strikes)) {
      this.strikes = msg.strikes;
    } else if (msg.phase === 'betting') {
      this.strikes = [];
    }

    if (msg.phase === 'betting' && this.game === 'roulette') {
      // Sync pending bets with the seat if provided
      const mySeat = msg.seats?.find((s) => s.userId === this.myUserId);
      if (mySeat?.bets && !this.pendingBets.length) {
        this.pendingBets = [...mySeat.bets];
      }
    }

    this.render();
  }

  onResult(msg) {
    if (msg.game === 'pokdeng') {
      // Settle results for pokdeng
      if (this.state) {
        if (msg.dealer) this.state.dealer = msg.dealer;
        if (msg.seats && this.state.seats) {
          msg.seats.forEach((rSeat) => {
            const curSeat = this.state.seats.find((s) => s.seat === rSeat.seat);
            if (curSeat) {
              if (rSeat.cards) curSeat.cards = rSeat.cards;
              if (rSeat.info) curSeat.info = rSeat.info;
              if (rSeat.settle) curSeat.settle = rSeat.settle;
              curSeat.chest = !!rSeat.chest;
            }
          });
        }
      }

      const mySeatRes = msg.seats?.find((s) => s.userId === this.myUserId || (this.state?.seats && this.state.seats[s.seat]?.userId === this.myUserId));
      if (mySeatRes?.settle) {
        const out = mySeatRes.settle.outcome;
        const myLabel = mySeatRes.info?.label || '';
        const dLabel = msg.dealer?.info?.label || '';
        if (out === 'win') {
          this.toast(`🎉 You won +${mySeatRes.settle.profit} 🪙! (${myLabel} vs Dealer ${dLabel})`);
        } else if (out === 'lose') {
          this.toast(`💀 Lost ${Math.abs(mySeatRes.settle.profit)} 🪙 (${myLabel} vs Dealer ${dLabel})`);
        } else {
          this.toast(`🤝 Push (${myLabel} vs Dealer ${dLabel})`);
        }
        if (mySeatRes.chest) {
          this.toast('🎁 Sunken Dupe Chest discovered!');
        }
      }
    } else if (msg.game === 'roulette') {
      // Record history
      if (msg.number != null) {
        this.history.unshift({ number: msg.number, color: msg.color, strikes: msg.strikes || [] });
        if (this.history.length > 12) this.history.pop();
      }
      if (msg.strikes) this.strikes = msg.strikes;

      const mySeatRes = msg.seats?.find((s) => s.userId === this.myUserId || (this.state?.seats && this.state.seats[s.seat]?.userId === this.myUserId));
      if (mySeatRes) {
        if (mySeatRes.profit > 0) {
          this.toast(`🎉 You won +${mySeatRes.profit} 🪙! (Winning: ${msg.number} ${msg.color?.toUpperCase()})`);
        } else if (mySeatRes.total > 0 && mySeatRes.profit <= 0) {
          this.toast(`⚪ Spin: ${msg.number} ${msg.color?.toUpperCase()} — No hit this spin`);
        }
        if (mySeatRes.bigHit) {
          this.toast(`⚡ BIG LIGHTNING HIT! #${mySeatRes.bigHit.n} (${mySeatRes.bigHit.mult}×)!`);
        }
      }

      // Store pendingBets into lastSpinBets for re-bet
      if (this.pendingBets.length) {
        this.lastSpinBets = JSON.parse(JSON.stringify(this.pendingBets));
      }
      this.pendingBets = [];
    }

    this.render();
  }

  onError(msg) {
    const ERR_MAP = {
      not_in_table: 'You are not seated at this table',
      wrong_phase: 'Action not allowed in this phase',
      insufficient_gold: 'Not enough gold in your wallet!',
      already_acted: 'Already acted this round',
      already_pok: 'Pok hands cannot draw cards',
      not_your_hand: 'Wait for your turn',
      no_bets: 'No bets placed',
      too_many_spots: 'Maximum 20 spots allowed',
      spot_limit: 'Maximum 5,000 gold per spot',
      total_limit: 'Maximum 25,000 gold total bet',
      bad_type: 'Invalid bet type',
      bad_number: 'Invalid roulette number',
      bad_amount: 'Invalid bet amount',
    };
    this.toast(`🎰 ${ERR_MAP[msg.error] || msg.error}`);
  }

  // --------------------------------------------------------------------------- Renderers
  render() {
    if (!this.root || this.root.hidden) return;

    if (this.game === 'roulette') {
      this.renderRoulette();
    } else {
      this.renderPokDeng();
    }
    this.updateTimer();
  }

  renderPokDeng() {
    const s = this.state;
    const phase = s?.phase || 'betting';
    const round = s?.round || 1;
    const seats = s?.seats || [];
    const dealer = s?.dealer || { cards: [], info: null };
    const mySeat = seats.find((st) => st.userId === this.myUserId);

    // Hit / Stay rule: enabled only in action phase for your non-Pok 2-card hand
    const isActionPhase = phase === 'action';
    const hasTwoCards = mySeat?.cards?.length === 2;
    const isPokHand = !!(mySeat?.info?.pok);
    const hasActed = !!mySeat?.action;
    const canHitOrStay = isActionPhase && hasTwoCards && !isPokHand && !hasActed && (mySeat?.bet > 0);

    const isBettingPhase = phase === 'betting';

    // Dealer cards
    const dealerCardsHtml = (dealer.cards && dealer.cards.length)
      ? dealer.cards.map((c) => renderCard(c)).join('')
      : '<span class="card card-back">🂠</span><span class="card card-back">🂠</span>';

    // 4 seats
    const seatsHtml = [0, 1, 2, 3].map((idx) => {
      const st = seats[idx];
      if (!st || (!st.userId && !st.isBot)) {
        return `
          <div class="casino-seat empty" data-seat="${idx}">
            <div class="casino-seat-header"><span class="casino-seat-name">Seat ${idx + 1} (Empty)</span></div>
            <div class="casino-cards"></div>
            <div class="casino-hand-info">Waiting...</div>
          </div>`;
      }
      const isMe = st.userId === this.myUserId;
      const cardsHtml = (st.cards && st.cards.length)
        ? st.cards.map((c) => renderCard(c)).join('')
        : (st.bet > 0 ? '<span class="card card-back">🂠</span><span class="card card-back">🂠</span>' : '');

      const handInfoText = st.info?.label ? `${st.info.label}${st.info.deng ? ` • ${st.info.deng}` : ''}` : '';
      let settleHtml = '';
      if (st.settle) {
        const out = st.settle.outcome;
        const color = out === 'win' ? 'text-green' : out === 'lose' ? 'text-red' : 'text-gold';
        const sign = st.settle.profit > 0 ? '+' : '';
        settleHtml = `<div class="casino-settle ${color}">${out.toUpperCase()} ${sign}${st.settle.profit}🪙${st.chest ? ' 🎁 Chest!' : ''}</div>`;
      }

      return `
        <div class="casino-seat ${isMe ? 'is-me' : ''} ${st.isBot ? 'is-bot' : ''}" data-seat="${idx}">
          <div class="casino-seat-header">
            <span class="casino-seat-name">${st.isBot ? '🤖 ' : (isMe ? '👤 ' : '')}${esc(st.name || `Seat ${idx + 1}`)}${isMe ? ' (You)' : ''}</span>
            ${st.cheer ? '<span class="casino-cheer-badge" title="Cheer Active">🥂</span>' : ''}
          </div>
          <div class="casino-seat-bet">🪙 ${st.bet || 0}</div>
          <div class="casino-cards">${cardsHtml}</div>
          <div class="casino-hand-info">${handInfoText || (st.action ? `Action: ${st.action}` : '')}</div>
          ${settleHtml}
        </div>`;
    }).join('');

    this.root.innerHTML = `
      <div class="casino-screen pokdeng">
        <header class="casino-header">
          <div class="casino-header-left">
            <div class="casino-title">🎰 Table #${this.table?.num || this.tableId || 1}: Royal Pok-Deng</div>
            <div class="casino-round-badge">Round ${round}</div>
          </div>
          <div class="casino-header-center">
            <div id="casino-phase" class="casino-phase-text">${phase.toUpperCase()}</div>
            <div class="casino-phase-bar"><div id="casino-phase-fill" class="casino-phase-fill"></div></div>
          </div>
          <div class="casino-header-right">
            <button type="button" class="casino-btn plain" data-act="exit">🚪 Exit</button>
          </div>
        </header>

        <main class="casino-felt pokdeng-felt">
          <!-- Dealer area -->
          <div id="casino-dealer" class="casino-dealer-station">
            <div class="casino-dealer-badge">👑 DEALER (Mochi Cat)</div>
            <div class="casino-cards" id="casino-dealer-cards">${dealerCardsHtml}</div>
            <div class="casino-hand-info" id="casino-dealer-info">${dealer.info?.label ? `${dealer.info.label}${dealer.info.deng ? ` • ${dealer.info.deng}` : ''}` : ''}</div>
          </div>

          <!-- 4 player seats -->
          <div class="casino-seats-grid">
            ${seatsHtml}
          </div>
        </main>

        <footer class="casino-footer">
          <!-- Chip rack -->
          <div class="casino-chip-rack">
            ${[100, 500, 1000, 5000].map((amt) => `
              <button type="button" class="casino-chip ${amt === 5000 ? 'chip-max' : ''} ${this.selectedChip === amt ? 'selected' : ''}" data-chip="${amt}" ${!isBettingPhase ? 'disabled' : ''}>
                ${amt === 5000 ? 'MAX' : amt}
              </button>
            `).join('')}
          </div>

          <!-- Action tray -->
          <div class="casino-action-tray">
            <button type="button" class="casino-btn green" data-act="hit" ${!canHitOrStay ? 'disabled' : ''}>🃏 HIT / DRAW</button>
            <button type="button" class="casino-btn gold" data-act="stay" ${!canHitOrStay ? 'disabled' : ''}>👑 STAY / STAND</button>
            <button type="button" class="casino-btn pink" data-act="cheer" ${!isBettingPhase ? 'disabled' : ''}>🥂 CHEER (+5% Luck)</button>
          </div>
        </footer>
      </div>`;
  }

  renderRoulette() {
    const s = this.state;
    const phase = s?.phase || 'betting';
    const round = s?.round || 1;
    const isBetting = phase === 'betting';

    // Strikes HTML
    const strikesHtml = (this.strikes && this.strikes.length)
      ? this.strikes.map((st) => `
          <div class="roulette-strike-item">⚡ #${st.n} ${colorOf(st.n).toUpperCase()} = ${st.mult}× LIGHTNING!</div>
        `).join('')
      : '<div class="roulette-strike-empty">⚡ Zeus Lightning strikes when the wheel spins!</div>';

    // History HTML
    const historyHtml = (this.history && this.history.length)
      ? this.history.map((h) => {
          const isStruck = h.strikes && h.strikes.length;
          const strikeBadge = isStruck ? ` (${h.strikes[0].mult}×)` : '';
          return `<span class="roulette-hist-badge ${colorOf(h.number)}">${isStruck ? '⚡ ' : ''}${h.number}${strikeBadge}</span>`;
        }).join('')
      : '<span class="roulette-hist-empty">No spins yet</span>';

    // Chip overlay lookup for bets
    const betAmountFor = (type, n = null) => {
      const match = this.pendingBets.find((b) => b.type === type && (n == null || b.n === n));
      return match ? match.amount : 0;
    };

    const chipTag = (amt) => (amt > 0 ? `<span class="bet-chip">${amt >= 1000 ? `${amt / 1000}k` : amt}</span>` : '');

    // 0 cell
    const zeroBet = betAmountFor('straight', 0);
    const zeroCell = `<div class="roulette-cell green zero" data-bet-type="straight" data-n="0">👑 0 ${chipTag(zeroBet)}</div>`;

    // 1-36 grid
    let numbersGrid = '';
    for (let r = 0; r < 12; r++) {
      // 3 numbers per row: col 1 = 3*r+1, col 2 = 3*r+2, col 3 = 3*r+3
      for (let c = 1; c <= 3; c++) {
        const num = r * 3 + c;
        const color = colorOf(num);
        const amt = betAmountFor('straight', num);
        const isStruck = this.strikes.some((st) => st.n === num);
        numbersGrid += `
          <div class="roulette-cell num-cell ${color} ${isStruck ? 'struck' : ''}" data-bet-type="straight" data-n="${num}">
            ${isStruck ? '⚡' : ''}${num} ${chipTag(amt)}
          </div>`;
      }
    }

    // Dozens & columns
    const dozenCells = [1, 2, 3].map((d) => {
      const label = d === 1 ? '1st 12 (3×)' : d === 2 ? '2nd 12 (3×)' : '3rd 12 (3×)';
      const amt = betAmountFor('dozen', d);
      return `<div class="roulette-cell outside dozen" data-bet-type="dozen" data-n="${d}">${label} ${chipTag(amt)}</div>`;
    }).join('');

    const colCells = [1, 2, 3].map((c) => {
      const amt = betAmountFor('column', c);
      return `<div class="roulette-cell outside col" data-bet-type="column" data-n="${c}">Col ${c} (3×) ${chipTag(amt)}</div>`;
    }).join('');

    // Outside bets
    const redAmt = betAmountFor('red');
    const blackAmt = betAmountFor('black');
    const evenAmt = betAmountFor('even');
    const oddAmt = betAmountFor('odd');

    const totalBet = this.pendingBets.reduce((sum, b) => sum + b.amount, 0);

    this.root.innerHTML = `
      <div class="casino-screen roulette">
        <header class="casino-header">
          <div class="casino-header-left">
            <div class="casino-title">🎰 Table #${this.table?.num || this.tableId || 2}: Zeus Lightning Roulette</div>
            <div class="casino-round-badge">Round ${round}</div>
          </div>
          <div class="casino-header-center">
            <div id="casino-phase" class="casino-phase-text">${phase.toUpperCase()}</div>
            <div class="casino-phase-bar"><div id="casino-phase-fill" class="casino-phase-fill"></div></div>
          </div>
          <div class="casino-header-right">
            <button type="button" class="casino-btn plain" data-act="exit">🚪 Exit</button>
          </div>
        </header>

        <section class="roulette-top-strip">
          <div id="roulette-strikes" class="roulette-strikes">${strikesHtml}</div>
          <div class="roulette-status-line">
            <div id="roulette-history" class="roulette-history">${historyHtml}</div>
            <div id="roulette-countdown" class="roulette-countdown">⏱️ ${isBetting ? 'Spin in' : phase.toUpperCase()} 00s...</div>
          </div>
        </section>

        <main class="casino-felt roulette-felt">
          <!-- Betting grid -->
          <div class="roulette-grid-container">
            ${zeroCell}
            <div class="roulette-numbers-grid">
              ${numbersGrid}
            </div>
            <div class="roulette-cols-row">
              ${colCells}
            </div>
            <div class="roulette-dozens-row">
              ${dozenCells}
            </div>
            <div class="roulette-outside-row">
              <div class="roulette-cell outside red" data-bet-type="red">🔴 RED (2×) ${chipTag(redAmt)}</div>
              <div class="roulette-cell outside black" data-bet-type="black">⚫ BLACK (2×) ${chipTag(blackAmt)}</div>
              <div class="roulette-cell outside even" data-bet-type="even">✨ EVEN (2×) ${chipTag(evenAmt)}</div>
              <div class="roulette-cell outside odd" data-bet-type="odd">🔥 ODD (2×) ${chipTag(oddAmt)}</div>
            </div>
          </div>
        </main>

        <footer class="casino-footer">
          <div class="roulette-bet-summary">Current Bets: 🪙 <b>${totalBet}</b> / 25,000</div>
          <!-- Chip rack -->
          <div class="casino-chip-rack">
            ${[100, 500, 1000, 5000].map((amt) => `
              <button type="button" class="casino-chip ${amt === 5000 ? 'chip-max' : ''} ${this.selectedChip === amt ? 'selected' : ''}" data-chip="${amt}">
                ${amt === 5000 ? 'MAX' : amt}
              </button>
            `).join('')}
          </div>

          <!-- Roulette betting action tray -->
          <div class="casino-action-tray">
            <button type="button" class="casino-btn teal" data-act="rebet" ${!isBetting || !this.lastSpinBets.length ? 'disabled' : ''}>🔄 Re-Bet</button>
            <button type="button" class="casino-btn purple" data-act="double" ${!isBetting || !this.pendingBets.length ? 'disabled' : ''}>✖2 Double</button>
            <button type="button" class="casino-btn red" data-act="clear" ${!isBetting || !this.pendingBets.length ? 'disabled' : ''}>🗑️ Clear</button>
          </div>
        </footer>
      </div>`;
  }

  // --------------------------------------------------------------------------- Input
  onClick(e) {
    const el = e.target.closest('[data-act],[data-chip],[data-bet-type]');
    if (!el) return;

    // Chip selection
    if (el.dataset.chip) {
      this.selectedChip = Number(el.dataset.chip);
      if (this.game === 'pokdeng') {
        if (this.state?.phase === 'betting') {
          this.net.send({ type: 'casino_bet', tableId: this.tableId, amount: this.selectedChip });
        }
      }
      this.render();
      return;
    }

    // Roulette betting spot clicked
    if (el.dataset.betType) {
      if (this.game !== 'roulette' || this.state?.phase !== 'betting') return;
      const type = el.dataset.betType;
      const n = el.dataset.n != null ? Number(el.dataset.n) : undefined;
      this.addRouletteBet(type, n, this.selectedChip);
      return;
    }

    // Action buttons
    switch (el.dataset.act) {
      case 'exit': {
        this.net.send({ type: 'casino_leave', tableId: this.tableId });
        this.close();
        this.onExit();
        break;
      }
      case 'hit': {
        this.net.send({ type: 'casino_hit', tableId: this.tableId });
        break;
      }
      case 'stay': {
        this.net.send({ type: 'casino_stay', tableId: this.tableId });
        break;
      }
      case 'cheer': {
        this.net.send({ type: 'casino_cheer', tableId: this.tableId });
        break;
      }
      case 'rebet': {
        if (!this.lastSpinBets.length || this.state?.phase !== 'betting') return;
        this.pendingBets = JSON.parse(JSON.stringify(this.lastSpinBets));
        this.net.send({ type: 'casino_roulette_bets', tableId: this.tableId, bets: this.pendingBets });
        this.render();
        break;
      }
      case 'double': {
        if (!this.pendingBets.length || this.state?.phase !== 'betting') return;
        const doubled = this.pendingBets.map((b) => ({ ...b, amount: b.amount * 2 }));
        if (doubled.some((b) => b.amount > 5000)) {
          this.toast('🎰 Double exceeds 5,000 spot limit!');
          return;
        }
        const total = doubled.reduce((sum, b) => sum + b.amount, 0);
        if (total > 25000) {
          this.toast('🎰 Double exceeds 25,000 total bet limit!');
          return;
        }
        this.pendingBets = doubled;
        this.net.send({ type: 'casino_roulette_bets', tableId: this.tableId, bets: this.pendingBets });
        this.render();
        break;
      }
      case 'clear': {
        if (this.state?.phase !== 'betting') return;
        this.pendingBets = [];
        this.net.send({ type: 'casino_roulette_bets', tableId: this.tableId, bets: [] });
        this.render();
        break;
      }
      default:
    }
  }

  addRouletteBet(type, n, amount) {
    const existing = this.pendingBets.find((b) => b.type === type && (n == null || b.n === n));
    const currentSpot = existing ? existing.amount : 0;
    if (currentSpot + amount > 5000) {
      this.toast('🎰 Maximum 5,000 gold per spot!');
      return;
    }
    const currentTotal = this.pendingBets.reduce((sum, b) => sum + b.amount, 0);
    if (currentTotal + amount > 25000) {
      this.toast('🎰 Maximum 25,000 total bet limit!');
      return;
    }

    if (existing) {
      existing.amount += amount;
    } else {
      if (this.pendingBets.length >= 20) {
        this.toast('🎰 Maximum 20 spots allowed!');
        return;
      }
      this.pendingBets.push({ type, ...(n != null ? { n } : {}), amount });
    }

    this.net.send({ type: 'casino_roulette_bets', tableId: this.tableId, bets: this.pendingBets });
    this.render();
  }
}
