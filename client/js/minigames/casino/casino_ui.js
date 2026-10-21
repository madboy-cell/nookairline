// client/js/minigames/casino/casino_ui.js — Grand Starlight Casino UI (Screens 12 & 13).
// Handles Royal Pok-Deng (Mode 2A) and Zeus Lightning Roulette (Mode 2B).
// Pure functional DOM with semantic ids, data-* hooks, Mochi 3D flying card deals,
// and Monopoly-smooth Roulette camera zoom + 60fps ivory ball physics.

import { renderOutfitThumbLayers, fmtNum } from '../../ui_components.js';
import { sfx } from '../monopoly_25d/sfx.js';

const SUITS = Object.freeze(['♠', '♥', '♦', '♣']);
const RANKS = Object.freeze(['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']);
const RED_NUMS = Object.freeze(new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]));

// Authentic European single-zero roulette wheel pocket sequence (clockwise from 0)
const EUROPEAN_WHEEL_ORDER = Object.freeze([
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
  5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
]);

// Curated seat presets so seated Chibis & bots are never bald and match Mockup 12/13
const SEAT_PRESETS = Object.freeze([
  {
    name: 'Nook',
    outfit: 's4_casino_royale',
    lineage: 'bkk',
    appearance: { body: 'boy', hair: 'hair_boy_fluffy', hairColor: 'midnight' },
    accessories: { hat: 'hat_wolf_ears', gloves: 'gloves_vorax_cyan' },
    petUrl: '/assets/pets/dragon_front.png',
    demoCards: [{ r: 1, s: 0 }, { r: 8, s: 2 }],
    demoLabel: 'POK 9! (x2)',
    demoPok: true,
    demoBet: 1000,
  },
  {
    name: 'Leo',
    outfit: 's3_sultan_djinn',
    lineage: 'bkk',
    appearance: { body: 'boy', hair: 'hair_parted_curtains', hairColor: 'chestnut' },
    accessories: {},
    petUrl: '/assets/pets/pup_front.png',
    demoCards: [{ r: 7, s: 2 }, { r: 11, s: 0 }],
    demoLabel: '7 pts',
    demoPok: false,
    demoBet: 500,
  },
  {
    name: 'Mina',
    outfit: 's7_cinderella_clock',
    lineage: 'dxb',
    appearance: { body: 'girl', hair: 'hair_girl_waves', hairColor: 'lavender' },
    accessories: {},
    petUrl: '/assets/pets/bunny_front.png',
    demoCards: [{ r: 10, s: 1 }, { r: 10, s: 2 }],
    demoLabel: '',
    demoBust: true,
    demoPok: false,
    demoBet: 500,
  },
  {
    name: 'Beam',
    outfit: 's8_glacial_elsa',
    lineage: 'dxb',
    appearance: { body: 'girl', hair: 'hair_hime_straight', hairColor: 'coral' },
    accessories: { hat: 'hat_dragon_horns' },
    petUrl: '/assets/pets/capybara_front.png',
    demoCards: [{ r: 13, s: 1 }, { r: 8, s: 3 }],
    demoLabel: '= 8 pts',
    demoPok: false,
    demoBet: 1000,
  },
]);

const CHIP_ASSETS = Object.freeze({
  100: '/assets/ui/casino_chip_100_purple.png',
  500: '/assets/ui/casino_chip_500_green.png',
  1000: '/assets/ui/casino_chip_500_blue.png',
  5000: '/assets/ui/casino_chip_1000_gold.png',
  10000: '/assets/ui/casino_chip_100_purple.png',
  20000: '/assets/ui/casino_chip_max_fire.png',
  50000: '/assets/ui/casino_chip_max_fire.png',
});

const colorOf = (n) => (n === 0 ? 'green' : RED_NUMS.has(n) ? 'red' : 'black');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function fmtCompact(n) {
  const v = Number(n) || 0;
  if (v >= 10000) return `${(v / 1000).toFixed(1)}K`;
  return fmtNum(v);
}

function pocketAngleRad(num) {
  const idx = EUROPEAN_WHEEL_ORDER.indexOf(Number(num));
  const i = idx >= 0 ? idx : 0;
  // Top of wheel is -PI/2 in screen coordinates
  return -Math.PI / 2 + (i / EUROPEAN_WHEEL_ORDER.length) * Math.PI * 2;
}

function renderCard(c, { isGolden = false, isDealerGlow = false, isCardBackPink = false, cardIdx = 0, extraCls = '' } = {}) {
  if (!c || c.hidden || c.r == null || c.s == null) {
    return `
      <span class="card casino-card card-back ${isDealerGlow ? 'is-dealer-glow' : ''} ${isCardBackPink ? 'is-pink-back' : ''} ${extraCls}" data-card="back" data-card-idx="${cardIdx}">
        <span class="card-back-inner">${isDealerGlow ? '♠' : '🌸'}</span>
      </span>`;
  }
  const isRed = c.s === 1 || c.s === 2;
  const rankStr = RANKS[c.r] || String(c.r);
  const suitStr = SUITS[c.s] || '';
  return `
    <span class="card casino-card ${isRed ? 'card-red' : 'card-black'} ${isGolden ? 'is-pok-card' : ''} ${isDealerGlow ? 'is-dealer-glow' : ''} ${extraCls}" data-r="${c.r}" data-s="${c.s}" data-card-idx="${cardIdx}">
      <span class="card-corner">${rankStr}<small>${suitStr}</small></span>
      <span class="card-pip">${suitStr}</span>
    </span>`;
}

function renderChibiAvatar(seatObj, idx, isMe, myProfile, { headCrop = false } = {}) {
  const preset = SEAT_PRESETS[idx % SEAT_PRESETS.length];
  const rawEqOutfit = isMe ? (myProfile?.equipped?.outfit?.id || myProfile?.equipped?.outfit) : null;
  const outfitId = (rawEqOutfit && rawEqOutfit !== 'starter' && rawEqOutfit !== 'newbie_outfit') ? rawEqOutfit : preset.outfit;
  const lineage = (isMe && myProfile?.lineage) || seatObj?.lineage || preset.lineage;
  const rawApp = (isMe && myProfile?.appearance) || seatObj?.appearance || preset.appearance;
  const appearance = {
    body: rawApp?.body || preset.appearance.body,
    hair: rawApp?.hair || preset.appearance.hair,
    hairColor: (!rawEqOutfit || rawEqOutfit === 'newbie_outfit') ? preset.appearance.hairColor : (rawApp?.hairColor || preset.appearance.hairColor),
  };
  const hasMyAcc = isMe && myProfile?.equipped && (myProfile.equipped.hat || myProfile.equipped.gloves || myProfile.equipped.wings);
  const accessories = hasMyAcc ? myProfile.equipped : (preset.accessories || null);
  try {
    return renderOutfitThumbLayers(outfitId, {
      lineage,
      appearance,
      accessories,
      alt: seatObj?.name || preset.name,
      headCrop,
    });
  } catch {
    const lin = lineage === 'dxb' ? 'dxb' : 'bkk';
    return `
      <div class="s2-outfit-rig-thumb ${headCrop ? 'is-head-crop' : ''}">
        <img class="s2-outfit-rig-body s2-thumb-img" src="/assets/chibi/${lin}_base_front.png" alt="" />
      </div>`;
  }
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
    this.selectedChip = 500;
    this.lastPokdengBet = 500;
    this.pendingBets = []; // for roulette: [{ type, n?, amount }]
    this.lastSpinBets = []; // for roulette rebet
    this.history = []; // last results
    this.strikes = []; // roulette strikes
    this.cheerActive = false;

    this.serverNow = 0;
    this.phaseEndsAt = 0;
    this.skew = 0;
    this.timerInterval = null;

    // Pok-Deng flying card animation tracking
    this._pokdengAnimRoundKey = null;
    this._dealtCardKeys = new Set();
    this._inflightCardKeys = new Set();
    this._dealTimers = [];

    // Roulette spin & camera zoom state
    this._wasSpinZoom = false;
    this._spinRaf = null;
    this._spinState = null;

    this.root = null;
    this.stageEl = null;
    this.fxLayer = null;
    this._initDom();
  }

  get myUserId() {
    return this.getProfile?.()?.id || null;
  }

  get myGold() {
    const pGold = this.getProfile?.()?.gold;
    if (typeof pGold === 'number') return pGold;
    const mySeat = this.state?.seats?.find((s) => s.userId === this.myUserId);
    return mySeat?.gold ?? 0;
  }

  _initDom() {
    let existing = document.getElementById('casino-root');
    if (!existing) {
      existing = document.createElement('div');
      existing.id = 'casino-root';
      existing.className = 'casino-fullscreen casino-overlay';
      existing.hidden = true;
      document.body.appendChild(existing);
    } else {
      existing.classList.add('casino-fullscreen', 'casino-overlay');
    }
    this.root = existing;
    this._ensureContainers();
    this.root.addEventListener('click', (e) => this.onClick(e));
  }

  _ensureContainers() {
    if (!this.root) return;
    if (!this.stageEl || !this.root.contains(this.stageEl)) {
      let stage = this.root.querySelector(':scope > .casino-stage-wrap');
      if (!stage) {
        stage = document.createElement('div');
        stage.className = 'casino-stage-wrap';
        this.root.appendChild(stage);
      }
      this.stageEl = stage;
    }
    if (!this.fxLayer || !this.root.contains(this.fxLayer)) {
      let fx = this.root.querySelector(':scope > .casino-fx-layer');
      if (!fx) {
        fx = document.createElement('div');
        fx.className = 'casino-fx-layer';
        fx.setAttribute('aria-hidden', 'true');
        this.root.appendChild(fx);
      }
      this.fxLayer = fx;
    }
  }

  open(table) {
    if (!table) return;
    const prevTableId = this.tableId;
    this.table = table;
    this.tableId = table.id;
    this.game = table.options?.casinoGame || table.casinoGame || 'pokdeng';
    if (this.game === 'pokdeng' && ![500, 1000, 5000, 10000, 50000].includes(this.selectedChip)) {
      this.selectedChip = 500;
    } else if (this.game === 'roulette' && ![100, 500, 1000, 5000].includes(this.selectedChip)) {
      this.selectedChip = 100;
    }

    // Preserve state if `casino_state` arrived right before `table_state`
    if (!this.state || (this.state.tableId && this.state.tableId !== table.id) || (prevTableId && prevTableId !== table.id)) {
      if (Array.isArray(table.seats) && table.seats.length) {
        this.state = {
          tableId: table.id,
          game: this.game,
          phase: 'betting',
          round: 1,
          seats: table.seats.map((s, idx) => ({
            seat: idx,
            userId: s.kind === 'human' ? s.userId : null,
            name: s.name || SEAT_PRESETS[idx]?.name || `Seat ${idx + 1}`,
            isBot: s.kind === 'bot',
            bet: s.kind === 'bot' ? (SEAT_PRESETS[idx]?.demoBet || 500) : 0,
            totalBet: 0,
            cards: null,
            info: null,
          })),
        };
      } else {
        this.state = null;
      }
      this.pendingBets = [];
      this._clearCardAnimations();
      this._stopRouletteSpinLoop();
      this._wasSpinZoom = false;
    }

    this.root.dataset.casinoGame = this.game;
    this.root.hidden = false;
    this._ensureContainers();

    this.net?.send({ type: 'casino_state', tableId: this.tableId });
    this._startTimer();
    this.render();
  }

  close() {
    this._stopTimer();
    this._clearCardAnimations();
    this._stopRouletteSpinLoop();
    this._wasSpinZoom = false;
    if (this.root) {
      this.root.hidden = true;
      this.root.innerHTML = '';
      this.stageEl = null;
      this.fxLayer = null;
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
    if (!this.state || !this.phaseEndsAt || !this.root) return;
    const now = Date.now() + this.skew;
    const remainMs = Math.max(0, this.phaseEndsAt - now);
    const remainSec = (remainMs / 1000).toFixed(1);
    const remainSecPad = String(Math.ceil(remainMs / 1000)).padStart(2, '0');

    const phaseEl = this.root.querySelector('#casino-phase');
    if (phaseEl) {
      const phaseName = (this.state.phase || '').toUpperCase();
      phaseEl.textContent = `${phaseName} • ${remainSec}s`;
    }

    const pokdengCountdown = this.root.querySelector('#pokdeng-countdown');
    if (pokdengCountdown) {
      pokdengCountdown.textContent = `🕒 ${remainSecPad}s`;
    }

    const rouletteCountdown = this.root.querySelector('#roulette-countdown');
    if (rouletteCountdown) {
      const isBetting = this.state.phase === 'betting';
      rouletteCountdown.textContent = `🕒 ${isBetting ? 'Spin in' : (this.state.phase || '').toUpperCase()} ${remainSecPad}s...`;
    }

    const rouletteBannerCountdown = this.root.querySelector('#roulette-banner-countdown');
    if (rouletteBannerCountdown) {
      rouletteBannerCountdown.textContent = `🕒 ${remainSecPad}s`;
    }

    const pct = this.phaseTotalMs ? Math.min(100, Math.max(0, (remainMs / this.phaseTotalMs) * 100)) : 0;
    const fillEl = this.root.querySelector('#casino-phase-fill');
    if (fillEl) fillEl.style.width = `${pct}%`;
    const bannerFillEl = this.root.querySelector('#pokdeng-phase-fill');
    if (bannerFillEl) bannerFillEl.style.width = `${pct}%`;
    const rouletteFillEl = this.root.querySelector('#roulette-banner-fill');
    if (rouletteFillEl) rouletteFillEl.style.width = `${pct}%`;
  }

  /**
   * Dispatches incoming socket packets (`casino_state`, `casino_Lightning`, `casino_result`, `casino_cheer_fx`, `casino_error`).
   * @param {object} msg
   * @returns {boolean}
   */
  handle(msg) {
    if (!msg || !msg.type) return false;
    if (msg.type === 'casino_state') {
      if (this.tableId && msg.tableId && msg.tableId !== this.tableId) return false;
      if (this.root.hidden) {
        this.open({ id: msg.tableId, options: { casinoGame: msg.game || 'pokdeng' } });
      }
      this.onState(msg);
      return true;
    }
    if (msg.type === 'casino_Lightning' || msg.type === 'casino_lightning') {
      if (this.tableId && msg.tableId && msg.tableId !== this.tableId) return false;
      this.strikes = Array.isArray(msg.strikes) ? msg.strikes : [];
      this.render();
      return true;
    }
    if (msg.type === 'casino_result') {
      if (this.tableId && msg.tableId && msg.tableId !== this.tableId) return false;
      this.onResult(msg);
      return true;
    }
    if (msg.type === 'casino_cheer_fx') {
      if (this.tableId && msg.tableId && msg.tableId !== this.tableId) return false;
      this.cheerActive = true;
      this.toast('🥂 Table Cheer! +5% Luck & Dupe Chest boost active!');
      this.render();
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
    const prevPhase = this.state?.phase;
    this.state = msg;
    if (msg.game) {
      this.game = msg.game;
      if (this.root) this.root.dataset.casinoGame = this.game;
    }
    this.serverNow = msg.serverNow || Date.now();
    this.phaseEndsAt = msg.phaseEndsAt || 0;
    this.skew = msg.serverNow ? (msg.serverNow - Date.now()) : 0;

    if (this.game === 'pokdeng') {
      const PHASE_MAP = { betting: 8000, deal: 2500, action: 8000, dealer: 4500 };
      this.phaseTotalMs = PHASE_MAP[msg.phase] || 8000;
    } else {
      const PHASE_MAP = { betting: 15000, spin: 5500, result: 4500 };
      this.phaseTotalMs = PHASE_MAP[msg.phase] || 15000;
    }

    if (msg.history && Array.isArray(msg.history)) {
      this.history = [...msg.history].reverse();
    }

    if (msg.strikes && Array.isArray(msg.strikes)) {
      this.strikes = msg.strikes;
    } else if (msg.phase === 'betting') {
      this.strikes = [];
    }

    if (this.game === 'pokdeng') {
      const mySeat = msg.seats?.find((s) => s.userId === this.myUserId);
      if (msg.phase === 'betting') {
        this._clearCardAnimations();
        const roundKey = `${this.tableId || msg.tableId}:${msg.round || 1}`;
        if (mySeat && (!mySeat.bet || mySeat.bet <= 0) && this._autoBetRoundKey !== roundKey) {
          this._manualBetRoundKey = null;
          const availGold = typeof this.myGold === 'number' ? this.myGold : (mySeat.gold || 0);
          const remembered = Math.min(50000, Math.max(500, Number(this.lastPokdengBet) || 500));
          const betAmt = availGold >= remembered
            ? remembered
            : (availGold >= 500 ? Math.floor(availGold) : (availGold >= 100 ? 100 : 0));
          if (betAmt > 0 && this.net?.send) {
            this._autoBetRoundKey = roundKey;
            mySeat.bet = betAmt;
            this.net.send({ type: 'casino_bet', tableId: this.tableId || msg.tableId, amount: betAmt });
          }
        }
      } else if (mySeat?.bet > 0) {
        this.lastPokdengBet = mySeat.bet;
      }
    }

    if (this.game === 'roulette') {
      if (msg.phase === 'betting') {
        this._stopRouletteSpinLoop();
        const mySeat = msg.seats?.find((s) => s.userId === this.myUserId);
        if (mySeat?.bets && !this.pendingBets.length) {
          this.pendingBets = [...mySeat.bets];
        }
      } else if (msg.phase === 'spin' && prevPhase !== 'spin') {
        const targetNum = msg.spinNumber ?? msg.number ?? (this.strikes?.[0]?.n ?? 0);
        const remainMs = Math.max(2200, (this.phaseEndsAt - (Date.now() + this.skew)) || 5500);
        this._initRouletteSpinState(targetNum, remainMs);
      }
    }

    this.render();
  }

  onResult(msg) {
    this.lastResult = msg;
    if (typeof window !== 'undefined') window.__lastCasinoResult = msg;
    if (msg.game === 'pokdeng') {
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
          setTimeout(() => this._flyWinCoins('.pokdeng-center-pot'), 220);
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
      this._stopRouletteSpinLoop();
      if (msg.number != null) {
        const topHist = this.history[0];
        if (!topHist || topHist.number !== msg.number || topHist._round !== msg.round) {
          this.history.unshift({ number: msg.number, color: msg.color, strikes: msg.strikes || [], _round: msg.round });
          if (this.history.length > 12) this.history.pop();
        }
      }
      if (msg.strikes) this.strikes = msg.strikes;

      const mySeatRes = msg.seats?.find((s) => s.userId === this.myUserId || (this.state?.seats && this.state.seats[s.seat]?.userId === this.myUserId));
      if (mySeatRes) {
        if (mySeatRes.profit > 0) {
          this.toast(`🎉 You won +${mySeatRes.profit} Gold! (Winning: #${msg.number} ${msg.color?.toUpperCase()})`);
          setTimeout(() => this._flyWinCoins('#roulette-wheel'), 180);
        } else if (mySeatRes.payout > 0) {
          this.toast(`✨ Hit payout +${mySeatRes.payout} Gold on #${msg.number} ${msg.color?.toUpperCase()}!`);
          setTimeout(() => this._flyWinCoins('#roulette-wheel'), 180);
        } else if (mySeatRes.total > 0) {
          this.toast(`⚪ Spin: #${msg.number} ${msg.color?.toUpperCase()} — No hit this spin`);
        }
        if (mySeatRes.bigHit) {
          this.toast(`⚡ BIG LIGHTNING HIT! #${mySeatRes.bigHit.n} (${mySeatRes.bigHit.mult}×)!`);
        }
      }

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
    this._ensureContainers();

    if (this.game === 'roulette') {
      this.renderRoulette();
    } else {
      this.renderPokdeng();
    }
    this.updateTimer();
  }

  // Alias preserved for backwards compatibility
  renderPokDeng() {
    return this.renderPokdeng();
  }

  renderPokdeng() {
    const s = this.state;
    const phase = s?.phase || 'betting';
    const round = s?.round || 1;
    const seats = s?.seats || [];
    const dealer = s?.dealer || { cards: [], info: null };
    const myProfile = this.getProfile?.() || null;
    const mySeat = seats.find((st) => st.userId === this.myUserId);

    // Pre-sync round card tracking so newly dealt/hit cards render with .is-awaiting-deal until Mochi's flying card lands
    this._preparePokdengCardQueue(s);

    const isActionPhase = phase === 'action';
    const hasTwoCards = mySeat?.cards?.length === 2;
    const isPokHand = !!(mySeat?.info?.pok);
    const hasActed = !!mySeat?.action;
    const canHitOrStay = isActionPhase && hasTwoCards && !isPokHand && !hasActed && (mySeat?.bet > 0);
    const isBettingPhase = phase === 'betting';

    const berries = myProfile?.berries ?? 1240;
    const diamonds = myProfile?.diamonds ?? 3870;
    const partnerName = myProfile?.partner_id ? (myProfile.partner_id === 'neen' ? 'Neen' : 'Beam') : 'Beam';

    // Dealer cards & dynamic speech bubble matching Screen 12
    const dealerIsPok = !!(dealer.info?.pok || (dealer.info?.mult > 1));
    const dealerCardsHtml = (dealer.cards && dealer.cards.length)
      ? dealer.cards.map((c, cIdx) => {
          const cardKey = `dealer:${cIdx}`;
          const awaitingCls = this._inflightCardKeys.has(cardKey) ? 'is-awaiting-deal' : '';
          return renderCard(c, { isGolden: dealerIsPok, isDealerGlow: true, cardIdx: cIdx, extraCls: awaitingCls });
        }).join('')
      : `${renderCard(null, { isDealerGlow: true, cardIdx: 0 })}${renderCard(null, { isDealerGlow: true, cardIdx: 1 })}${renderCard(null, { isDealerGlow: true, cardIdx: 2 })}`;

    const dealerInfoBanner = dealer.info?.label
      ? `${dealer.info.pok ? `${dealer.info.label.toUpperCase()}!` : dealer.info.label}${dealer.info.deng ? ` (${dealer.info.mult}x DENG)` : ''}`
      : (phase === 'betting' ? 'SHOE READY' : 'DEALING...');

    let dealerSpeech = 'Place your bets, nya~ ✨';
    if (dealer.info?.pok) {
      dealerSpeech = `${dealer.info.label}! Double Payout! ✨`;
    } else if (phase === 'deal') {
      dealerSpeech = 'Dealing lucky cards, nya~ ✨';
    } else if (phase === 'action') {
      dealerSpeech = 'Hit or Stay? I\'ll deal your 3rd card! 🐾';
    } else if (phase === 'dealer' && dealer.info?.label) {
      dealerSpeech = `${dealer.info.label}${dealer.info.deng ? ` • ${dealer.info.deng}` : ''}! ✨`;
    }

    // Total live pot across all 4 seats
    const rawPot = seats.reduce((sum, st) => sum + (Number(st?.bet) || 0), 0);
    const displayPot = rawPot;
    const occupiedCount = Math.max(4, seats.filter((st) => st && (st.userId || st.isBot)).length);

    // 4 Seated Chibi + Pet stations around the outside perimeter of the curved oval table
    // Seat 1 (top-left: Leo), Seat 2 (top-right: Mina), Seat 0 (bottom-left hero: Player), Seat 3 (bottom-right: Beam)
    const seatsHtml = [0, 1, 2, 3].map((idx) => {
      const st = seats[idx];
      const preset = SEAT_PRESETS[idx];
      const posClass = `seat-pos-${idx}`;
      const isLeftSeat = idx === 0 || idx === 1;
      const chairUrl = isLeftSeat
        ? '/assets/ui/casino_chair_velvet_left.png'
        : '/assets/ui/casino_chair_velvet_right.png';

      const isMe = st?.userId ? st.userId === this.myUserId : idx === 0;
      const isGoldenHand = !!(st?.info?.pok || (st?.info?.mult > 1));

      // Cards on the felt in front of each seat: ONLY real dealt cards or face-down card backs
      let cardsHtml = '';
      if (st?.cards && st.cards.length) {
        cardsHtml = st.cards.map((c, cIdx) => {
          const cardKey = `seat:${idx}:${cIdx}`;
          const awaitingCls = this._inflightCardKeys.has(cardKey) ? 'is-awaiting-deal' : '';
          return renderCard(c, { isGolden: isGoldenHand, cardIdx: cIdx, extraCls: awaitingCls });
        }).join('');
      } else {
        const usePinkBack = idx === 2 || idx === 3;
        cardsHtml = `${renderCard(null, { isCardBackPink: usePinkBack, cardIdx: 0 })}${renderCard(null, { isCardBackPink: usePinkBack, cardIdx: 1 })}`;
      }

      let handRibbonText = '';
      if (st?.info?.label) {
        if (st.info.pok) {
          handRibbonText = `${st.info.label.toUpperCase()}!${st.info.mult > 1 ? ` (x${st.info.mult})` : ''}`;
        } else {
          handRibbonText = `= ${st.info.label}${st.info.mult > 1 ? ` (x${st.info.mult})` : ''}`;
        }
      } else if (st?.action) {
        handRibbonText = st.action.toUpperCase();
      } else if (phase === 'betting') {
        handRibbonText = st?.bet > 0 ? `BET ${fmtNum(st.bet)}` : 'TAP CHIP TO BET';
      } else {
        handRibbonText = st?.bet > 0 ? 'DEALING...' : 'NO BET';
      }

      let settleHtml = '';
      if (st?.settle) {
        const out = st.settle.outcome;
        const color = out === 'win' ? 'text-green' : out === 'lose' ? 'text-red' : 'text-gold';
        const sign = st.settle.profit > 0 ? '+' : '';
        settleHtml = `
          <div class="casino-settle ${color}">
            ${out.toUpperCase()} ${sign}${fmtNum(st.settle.profit)} <img class="mini-coin-ico" src="/assets/ui/icon_gold.png" alt="" />${st.chest ? ' 🎁' : ''}
          </div>`;
      }

      const avatarHtml = renderChibiAvatar(st, idx, isMe, myProfile, { headCrop: false });
      const petUrl = preset.petUrl;
      const myNameLower = String(myProfile?.username || '').toLowerCase();
      let cleanName = isMe
        ? (myProfile?.username || st?.name || preset.name)
        : String(st?.name || preset.name).replace(/^Bot\s+/i, '');
      if (!isMe && st?.isBot) {
        if (cleanName.toLowerCase() === 'mochi') cleanName = 'Kiki';
        if (cleanName.toLowerCase() === myNameLower) cleanName = 'Luna';
      }
      const betVal = Number(st?.bet) || 0;
      const isPokRibbon = !!(st?.info?.pok);
      const isBustBadge = !!(st?.info?.points === 0 && st?.cards?.length === 3);

      return `
        <div class="casino-seat ${posClass} ${isLeftSeat ? 'is-left' : 'is-right'} ${isMe ? 'is-me' : ''} ${st?.isBot ? 'is-bot' : ''} ${isGoldenHand ? 'has-pok' : ''}" data-seat="${idx}">
          <!-- Outer Seated Chibi + Velvet Chair + Companion Pet -->
          <div class="casino-seat-character">
            <img class="casino-velvet-chair" src="${chairUrl}" alt="" />
            <div class="casino-avatar-wrap">
              ${avatarHtml}
            </div>
            ${(idx === 0 || idx === 3) ? `<img class="casino-seat-pet pet-pos-${idx}" src="${petUrl}" alt="" />` : ''}
            ${idx === 3 ? '<div class="casino-emote-bubble heart">❤️</div>' : ''}
            ${st?.cheer ? '<span class="casino-cheer-badge" title="Cheer +5% Luck Active">🥂</span>' : ''}
            <div class="casino-seat-header">
              <span class="casino-seat-name">${idx === 3 ? '💕 ' : ''}${esc(cleanName)}</span>
            </div>
          </div>

          <!-- Inner Felt Zone: Cards, Hand Score Ribbon & Coin Stack -->
          <div class="casino-seat-felt-zone">
            ${isBustBadge ? `<div class="pokdeng-bust-badge">Bust 💥</div>` : ''}
            <div class="casino-cards">${cardsHtml}</div>
            <div class="casino-hand-info ${isPokRibbon ? 'is-pok-ribbon' : ''}">${handRibbonText}</div>
            ${betVal > 0 ? `
              <div class="casino-seat-bet">
                <img class="mini-coin-ico" src="/assets/ui/icon_gold.png" alt="" />
                <span>${fmtNum(betVal)}</span>
              </div>` : ''}
            ${settleHtml}
          </div>
        </div>`;
    }).join('');

    this.stageEl.innerHTML = `
      <div id="casino-pokdeng" class="casino-screen pokdeng casino-overlay">
        <!-- Grand Starlight Sakura Ballroom Full-Bleed Backdrop (Screen 12) -->
        <div class="casino-ballroom-bg pokdeng-ballroom-bg" aria-hidden="true">
          <img class="ballroom-art-img" src="/assets/ui/casino_bg_pokdeng_ballroom.jpg" alt="" />
          <div class="ballroom-floor-vignette"></div>
        </div>

        <!-- Top HUD Overlay (Matching Screen 12 Mockup) -->
        <header class="casino-header pokdeng-hud-header">
          <div class="casino-call-top-row">
            <div class="casino-call-pill">
              <span class="call-phone-ico">📞</span>
              <span class="call-txt">On Call with ${esc(partnerName)} • 36:20 <b class="call-gem">(+20 💎)</b></span>
              <span class="call-phase-sep">•</span>
              <span id="casino-phase" class="casino-phase-text">${phase.toUpperCase()}</span>
              <div class="casino-phase-bar"><div id="casino-phase-fill" class="casino-phase-fill"></div></div>
            </div>
            <button type="button" class="casino-btn plain casino-leave-btn" data-act="exit" title="Leave Table">
              <span class="casino-act-alias" data-act="casino-leave">✕</span>
            </button>
          </div>

          <div class="casino-hud-sub-row">
            <div class="casino-table-plaque">
              <span class="plaque-slot-ico">🎰</span>
              <div class="plaque-lines">
                <div class="casino-round-badge">Table #${this.table?.num || this.tableId || 1}: <small>R${round}</small></div>
                <div class="casino-title">Royal Pok-Deng [${occupiedCount}/4]</div>
              </div>
            </div>

            <div class="casino-currency-cluster">
              <div class="casino-curr-pill gold" title="Your Gold Balance">
                <img src="/assets/ui/icon_gold.png" alt="" />
                <span>${fmtCompact(this.myGold)}</span>
              </div>
              <div class="casino-curr-pill berry" title="Your Star-Berries">
                <img src="/assets/ui/icon_berry.png" alt="" />
                <span>${fmtNum(berries)}</span>
              </div>
              <div class="casino-curr-pill diamond" title="Your Diamonds">
                <img src="/assets/ui/icon_diamond.png" alt="" />
                <span>${fmtNum(diamonds)}</span>
              </div>
            </div>
          </div>
        </header>

        <!-- Main Ballroom Table Stage -->
        <main id="pokdeng-table" class="casino-felt pokdeng-felt">
          ${phase === 'dealer' ? `
            <div id="pokdeng-result-showcase" class="casino-result-showcase pokdeng-result-showcase ${mySeat?.settle?.outcome === 'win' ? 'is-win' : mySeat?.settle?.outcome === 'lose' ? 'is-lose' : 'is-push'}">
              <div class="result-showcase-badge dealer-badge">
                <span class="rs-kicker">👑 DEALER HAND</span>
                <strong class="rs-main">${esc(dealerInfoBanner)}</strong>
              </div>
              <div class="result-showcase-divider">VS</div>
              <div class="result-showcase-badge player-badge">
                <span class="rs-kicker">${mySeat?.settle?.outcome === 'win' ? '🎉 YOU WON!' : mySeat?.settle?.outcome === 'lose' ? '💀 DEALER WINS' : mySeat?.settle ? '🤝 PUSH ROUND' : '👀 ROUND RESULT'}</span>
                <strong class="rs-main">
                  ${mySeat?.settle
                    ? `${mySeat.settle.profit > 0 ? '+' : ''}${fmtNum(mySeat.settle.profit)} <img class="mini-coin-ico" src="/assets/ui/icon_gold.png" alt="" /> (${esc(mySeat?.info?.label || 'Hand')})`
                    : esc(dealerInfoBanner)}
                </strong>
              </div>
            </div>` : ''}

          <!-- Mochi Cat Dealer & Crystal Cinderella Slipper Shoe (#casino-dealer) -->
          <div id="casino-dealer" class="casino-dealer-station">
            <div class="dealer-mascot-wrap">
              <div class="dealer-name-pill">Mochi</div>
              <img class="dealer-mascot-img" src="/assets/ui/casino_dealer_pokdeng.png" alt="Mochi Cat Dealer" />
              <div class="casino-dealer-bubble">${esc(dealerSpeech)}</div>
            </div>
            <div class="dealer-plaque">
              <div class="casino-cards dealer-glow-cards" id="casino-dealer-cards">${dealerCardsHtml}</div>
              <div class="casino-hand-info dealer-ribbon ${dealerIsPok ? 'is-pok-ribbon' : ''}" id="casino-dealer-info">${dealerInfoBanner}</div>
            </div>
          </div>

          <!-- 3/4 Perspective Curved Emerald-Felt & Carved Golden-Mahogany Table -->
          <div class="pokdeng-table-stage">
            <div class="pokdeng-table-oval">
              <div class="pokdeng-felt-inner-ring"></div>

              <!-- Center Gold Coin Pile, Lightning 2x Medallion & Pot Pill -->
              <div class="pokdeng-center-pot">
                <div class="center-pot-visuals">
                  <img class="pot-pile-art" src="/assets/ui/casino_pot_gold_pile.png" alt="Gold Pot & 2x Medallion" />
                  <span class="pot-mult-badge">⚡ 2x</span>
                </div>
                <div class="center-pot-pill">
                  <img src="/assets/ui/icon_gold.png" alt="" />
                  <span>Pot: <b>${fmtNum(displayPot)}</b></span>
                </div>
              </div>
            </div>
            <div class="pokdeng-table-apron"></div>

            <!-- 4 Seated Chibi + Pet Stations Positioned Around the Oval Table -->
            <div class="casino-seats-grid">
              ${seatsHtml}
            </div>
          </div>
        </main>

        <!-- Bottom Phase Prompt Banner, Chip Selector Pills & 3 Chunky Candy Action Buttons (Screen 12) -->
        <footer class="casino-footer pokdeng-footer">
          <div id="pokdeng-phase-banner" class="pokdeng-phase-banner phase-${phase} ${canHitOrStay ? 'is-my-turn' : ''}">
            <span id="pokdeng-countdown" class="pokdeng-countdown-pill">🕒 08s</span>
            <span class="pokdeng-phase-prompt">
              ${isBettingPhase
                ? (mySeat?.bet > 0
                    ? `<b>BET: ${fmtNum(mySeat.bet)}</b> ${mySeat.bet > 500 ? `<button type="button" class="pokdeng-reset-bet-btn" data-act="pokdeng-reset-bet" title="Reset bet to 500">↺ Reset</button>` : ''} — Tap chips to add (+), or tap <b>⚡ DEAL</b>!`
                    : `⚠️ <b>BET THIS ROUND!</b> — Tap 500 / 1,000 / 5,000 / 10,000 / MAX below!`)
                : phase === 'deal'
                ? `🃏 <b>DEALING CARDS...</b> Mochi is dealing from the crystal slipper shoe!`
                : phase === 'action'
                ? (canHitOrStay
                    ? `👉 <b>YOUR TURN (${mySeat?.info?.label || ''})!</b> Tap <b>HIT / DRAW</b> for a 3rd card or <b>STAY / STAND</b>!`
                    : isPokHand
                    ? `👑 <b>${mySeat?.info?.label?.toUpperCase() || 'POK'}!</b> Auto-standing — waiting for Dealer...`
                    : hasActed
                    ? `✓ <b>You chose ${String(mySeat?.action || 'stay').toUpperCase()} (${mySeat?.info?.label || ''})</b> — Waiting for Dealer...`
                    : `👀 <b>NO BET THIS ROUND</b> — Next round starts soon!`)
                : (mySeat?.settle
                    ? (mySeat.settle.outcome === 'win'
                        ? `🎉 <b>YOU WON +${fmtNum(mySeat.settle.profit)}!</b> (${mySeat?.info?.label || ''} vs Dealer ${dealer.info?.label || ''})`
                        : mySeat.settle.outcome === 'lose'
                        ? `💀 <b>DEALER WINS (${dealer.info?.label || ''})</b> — Lost ${fmtNum(Math.abs(mySeat.settle.profit))}`
                        : `🤝 <b>PUSH (${mySeat?.info?.label || ''} vs Dealer ${dealer.info?.label || ''})</b> — Stake returned!`)
                    : `👑 <b>DEALER REVEAL:</b> ${dealerInfoBanner}`)}
            </span>
            <div class="pokdeng-banner-bar"><div id="pokdeng-phase-fill" class="pokdeng-banner-fill"></div></div>
          </div>

          <div class="casino-chip-rack pokdeng-chip-rack">
            ${[500, 1000, 5000, 10000, 50000].map((amt) => `
              <button type="button" class="casino-chip pokdeng-chip-pill chip-${amt} ${amt === 50000 ? 'chip-max' : ''} ${this.selectedChip === amt ? 'selected' : ''}" data-chip="${amt}" title="${amt === 50000 ? 'Max Bet (50,000 Gold)' : `Add +${fmtNum(amt)} Gold`}" ${!isBettingPhase ? 'disabled' : ''}>
                <img class="chip-art-ico" src="${CHIP_ASSETS[amt] || CHIP_ASSETS[500]}" alt="" />
                <span class="chip-inner">${amt === 50000 ? 'MAX' : fmtNum(amt)}</span>
              </button>
            `).join('')}
            <button type="button" class="casino-btn deal-now-btn pokdeng-deal-fast-btn" data-act="pokdeng-deal" title="Lock Bet & Deal Cards Immediately" ${!isBettingPhase ? 'disabled' : ''}>
              <span>⚡ DEAL</span>
            </button>
          </div>

          <div class="casino-action-tray pokdeng-candy-tray">
            <button type="button" class="casino-btn candy-btn green ${canHitOrStay ? 'pulse-action' : ''}" data-act="pokdeng-draw" ${!canHitOrStay ? 'disabled' : ''}>
              <span class="casino-act-alias" data-act="hit">
                <img class="btn-art-ico" src="/assets/ui/casino_icon_playing_cards.png" alt="" />
                <span class="btn-lbl"><b>HIT</b><span>/ DRAW</span></span>
              </span>
            </button>
            <button type="button" class="casino-btn candy-btn gold ${canHitOrStay ? 'pulse-action' : ''}" data-act="pokdeng-stay" ${!canHitOrStay ? 'disabled' : ''}>
              <span class="casino-act-alias" data-act="stay">
                <span class="btn-crown-ico">👑</span>
                <span class="btn-lbl"><b>STAY</b><span>/ STAND</span></span>
              </span>
            </button>
            <button type="button" class="casino-btn candy-btn pink ${mySeat?.cheer ? 'is-cheering' : ''}" data-act="casino-cheer" ${!isBettingPhase ? 'disabled' : ''}>
              <span class="casino-act-alias" data-act="cheer">
                <img class="btn-art-ico" src="/assets/ui/casino_icon_champagne_toast.png" alt="" />
                <span class="btn-lbl"><b>CHEER</b><small>(+5% Luck)</small></span>
              </span>
            </button>
          </div>
        </footer>
      </div>`;

    // Launch any newly queued flying cards from Mochi's crystal slipper shoe
    this._flushPokdengCardQueue();
  }

  // --------------------------------------------------------------------------- Pok-Deng Flying Card Deal & HIT Animations
  _clearCardAnimations() {
    this._dealtCardKeys.clear();
    this._inflightCardKeys.clear();
    this._pendingFlightItems = [];
    for (const tid of this._dealTimers) {
      clearTimeout(tid);
    }
    this._dealTimers = [];
    if (this.fxLayer) {
      this.fxLayer.innerHTML = '';
    }
  }

  _preparePokdengCardQueue(s) {
    if (!s) return;
    const roundKey = `${this.tableId || s.tableId || 1}:${s.round || 1}`;
    if (this._pokdengAnimRoundKey !== roundKey || s.phase === 'betting') {
      this._pokdengAnimRoundKey = roundKey;
      this._clearCardAnimations();
      if (s.phase === 'betting') return;
    }

    const toLaunch = [];
    const seats = s.seats || [];
    const dealer = s.dealer || { cards: [] };

    // 1. Check initial 2 cards (round-robin pass 0 then pass 1)
    for (let cIdx = 0; cIdx < 2; cIdx++) {
      for (let sIdx = 0; sIdx < 4; sIdx++) {
        const st = seats[sIdx];
        const card = st?.cards?.[cIdx];
        if (!card) continue;
        const key = `seat:${sIdx}:${cIdx}`;
        if (!this._dealtCardKeys.has(key) && !this._inflightCardKeys.has(key)) {
          this._inflightCardKeys.add(key);
          toLaunch.push({
            key,
            targetType: 'seat',
            seatIdx: sIdx,
            cardIdx: cIdx,
            card,
            isHit: false,
            delayMs: toLaunch.length * 95,
          });
        }
      }
      const dCard = dealer.cards?.[cIdx];
      if (dCard) {
        const dKey = `dealer:${cIdx}`;
        if (!this._dealtCardKeys.has(dKey) && !this._inflightCardKeys.has(dKey)) {
          this._inflightCardKeys.add(dKey);
          toLaunch.push({
            key: dKey,
            targetType: 'dealer',
            seatIdx: -1,
            cardIdx: cIdx,
            card: dCard,
            isHit: false,
            delayMs: toLaunch.length * 95,
          });
        }
      }
    }

    // 2. Check 3rd card HIT draws (any human player, bot, or dealer!)
    let hitStagger = 0;
    for (let sIdx = 0; sIdx < 4; sIdx++) {
      const st = seats[sIdx];
      const card3 = st?.cards?.[2];
      if (!card3) continue;
      const key = `seat:${sIdx}:2`;
      if (!this._dealtCardKeys.has(key) && !this._inflightCardKeys.has(key)) {
        this._inflightCardKeys.add(key);
        toLaunch.push({
          key,
          targetType: 'seat',
          seatIdx: sIdx,
          cardIdx: 2,
          card: card3,
          isHit: true,
          delayMs: hitStagger * 180,
        });
        hitStagger++;
      }
    }

    const dCard3 = dealer.cards?.[2];
    if (dCard3) {
      const dKey3 = 'dealer:2';
      if (!this._dealtCardKeys.has(dKey3) && !this._inflightCardKeys.has(dKey3)) {
        this._inflightCardKeys.add(dKey3);
        toLaunch.push({
          key: dKey3,
          targetType: 'dealer',
          seatIdx: -1,
          cardIdx: 2,
          card: dCard3,
          isHit: true,
          delayMs: hitStagger * 180,
        });
      }
    }

    this._pendingFlightItems = toLaunch;
  }

  _flushPokdengCardQueue() {
    const items = this._pendingFlightItems || [];
    this._pendingFlightItems = [];
    if (!items.length) return;

    for (const item of items) {
      if (item.delayMs <= 0) {
        this._launchFlyingCard(item);
      } else {
        const tid = setTimeout(() => this._launchFlyingCard(item), item.delayMs);
        this._dealTimers.push(tid);
      }
    }
  }

  _triggerDealerShoeThrow(isHit = false) {
    if (!this.stageEl) return;
    const mascotImg = this.stageEl.querySelector('#casino-dealer .dealer-mascot-img');
    if (mascotImg) {
      mascotImg.classList.remove('dealer-paw-throw');
      void mascotImg.offsetWidth;
      mascotImg.classList.add('dealer-paw-throw');
    }
    const bubble = this.stageEl.querySelector('#casino-dealer .casino-dealer-bubble');
    if (bubble && isHit) {
      bubble.textContent = 'Here comes your lucky card, nya~ 🃏✨';
    }
  }

  _spawnSeatActionCallout(seatIdx, text, kind = 'hit') {
    if (!this.stageEl || !this.fxLayer) return;
    const seatEl = this.stageEl.querySelector(`.casino-seat[data-seat="${seatIdx}"] .casino-seat-character`);
    const rootRect = this.root.getBoundingClientRect();
    if (!seatEl || !rootRect.width) return;
    const sRect = seatEl.getBoundingClientRect();
    const badge = document.createElement('div');
    badge.className = `pokdeng-action-callout is-${kind}`;
    badge.textContent = text;
    badge.style.left = `${sRect.left - rootRect.left + sRect.width * 0.5}px`;
    badge.style.top = `${sRect.top - rootRect.top + 18}px`;
    this.fxLayer.appendChild(badge);
    setTimeout(() => badge.remove(), 1150);
  }

  _launchFlyingCard(item) {
    if (!this.root || !this.stageEl || !this.fxLayer) return;
    const rootRect = this.root.getBoundingClientRect();
    if (!rootRect.width) {
      this._inflightCardKeys.delete(item.key);
      this._dealtCardKeys.add(item.key);
      return;
    }

    // Find Mochi's crystal slipper shoe origin (#casino-dealer)
    const dealerEl = this.stageEl.querySelector('#casino-dealer .dealer-mascot-img') || this.stageEl.querySelector('#casino-dealer');
    const targetSelector = item.targetType === 'dealer'
      ? `#casino-dealer-cards .casino-card[data-card-idx="${item.cardIdx}"]`
      : `.casino-seat[data-seat="${item.seatIdx}"] .casino-card[data-card-idx="${item.cardIdx}"]`;
    const targetEl = this.stageEl.querySelector(targetSelector);

    if (!dealerEl || !targetEl) {
      this._inflightCardKeys.delete(item.key);
      this._dealtCardKeys.add(item.key);
      return;
    }

    this._triggerDealerShoeThrow(item.isHit);
    if (item.isHit && item.targetType === 'seat') {
      this._spawnSeatActionCallout(item.seatIdx, '🃏 HIT!', 'hit');
    }

    // Sound effect on card launch from shoe
    try {
      sfx.step(item.isHit ? 5 : (item.cardIdx + 1));
    } catch {}

    const dRect = dealerEl.getBoundingClientRect();
    const tRect = targetEl.getBoundingClientRect();

    // Start from Mochi's Cinderella crystal slipper shoe on the right side of #casino-dealer
    const sx = dRect.left - rootRect.left + dRect.width * 0.72;
    const sy = dRect.top - rootRect.top + dRect.height * 0.64;
    const tx = tRect.left - rootRect.left + tRect.width * 0.5;
    const ty = tRect.top - rootRect.top + tRect.height * 0.5;

    // Crystal shoe burst flash
    const burst = document.createElement('div');
    burst.className = 'shoe-deal-burst';
    burst.style.left = `${sx}px`;
    burst.style.top = `${sy}px`;
    this.fxLayer.appendChild(burst);
    setTimeout(() => burst.remove(), 420);

    // Build 3D flipping card element in persistent fxLayer
    const c = item.card;
    const isHidden = !c || c.hidden || c.r == null || c.s == null;
    const isRed = !isHidden && (c.s === 1 || c.s === 2);
    const rankStr = !isHidden ? (RANKS[c.r] || String(c.r)) : '';
    const suitStr = !isHidden ? (SUITS[c.s] || '') : '';

    const flyEl = document.createElement('div');
    flyEl.className = `pokdeng-flying-card ${item.isHit ? 'is-hit-flight' : ''}`;
    flyEl.innerHTML = `
      <div class="flying-card-inner">
        <div class="flying-card-face flying-card-back">
          <span class="card-back-inner">${item.targetType === 'dealer' ? '♠' : '🌸'}</span>
        </div>
        <div class="flying-card-face flying-card-front ${isRed ? 'card-red' : 'card-black'}">
          ${isHidden
            ? `<span class="card-back-inner">♠</span>`
            : `<span class="card-corner">${rankStr}<small>${suitStr}</small></span><span class="card-pip">${suitStr}</span>`}
        </div>
      </div>`;
    this.fxLayer.appendChild(flyEl);

    const innerEl = flyEl.querySelector('.flying-card-inner');
    const duration = item.isHit ? 470 : 380;
    const arcLift = item.isHit ? 76 : 48;
    const ctrlX = (sx + tx) * 0.5 + (tx < sx ? -28 : 28);
    const ctrlY = Math.min(sy, ty) - arcLift;
    const startTime = performance.now();
    let lastSparkleAt = 0;

    const step = (now) => {
      const rawT = Math.min(1, Math.max(0, (now - startTime) / duration));
      // Smooth easeOutCubic trajectory
      const t = 1 - Math.pow(1 - rawT, 3);
      const inv = 1 - t;

      // Quadratic Bezier position
      const x = inv * inv * sx + 2 * inv * t * ctrlX + t * t * tx;
      const y = inv * inv * sy + 2 * inv * t * ctrlY + t * t * ty;

      // Scale peaks slightly mid-arc for 2.5D depth
      const scale = item.isHit
        ? 0.58 + 0.42 * t + Math.sin(t * Math.PI) * 0.24
        : 0.62 + 0.38 * t + Math.sin(t * Math.PI) * 0.14;
      const rotZ = (1 - t) * (tx < sx ? 28 : -28);

      // 3D Y-flip reveals the card face in the second half of flight
      let flipDeg = 0;
      if (!isHidden) {
        const flipProg = Math.min(1, Math.max(0, (rawT - 0.38) / 0.52));
        flipDeg = flipProg * 180;
      }

      flyEl.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) scale(${scale.toFixed(3)}) rotate(${rotZ.toFixed(1)}deg)`;
      if (innerEl) {
        innerEl.style.transform = `rotateY(${flipDeg.toFixed(1)}deg)`;
      }

      // Stardust trail on HIT card flight
      if (item.isHit && now - lastSparkleAt > 48 && rawT < 0.9) {
        lastSparkleAt = now;
        const sp = document.createElement('span');
        sp.className = 'flying-card-sparkle';
        sp.style.left = `${x + (Math.random() - 0.5) * 14}px`;
        sp.style.top = `${y + (Math.random() - 0.5) * 14}px`;
        this.fxLayer.appendChild(sp);
        setTimeout(() => sp.remove(), 360);
      }

      if (rawT < 1) {
        requestAnimationFrame(step);
      } else {
        flyEl.remove();
        this._inflightCardKeys.delete(item.key);
        this._dealtCardKeys.add(item.key);

        // Reveal the landed card in the live DOM and trigger landing pop
        const liveTarget = this.stageEl?.querySelector(targetSelector);
        if (liveTarget) {
          liveTarget.classList.remove('is-awaiting-deal');
          liveTarget.classList.add('card-landed-pop');
          if (item.isHit) {
            liveTarget.classList.add('hit-card-landed-glow');
          }
        }
        try {
          if (item.isHit) {
            sfx.coin(true);
          } else {
            sfx.diceTick(1);
          }
        } catch {}
      }
    };

    requestAnimationFrame(step);
  }

  // --------------------------------------------------------------------------- Roulette Screen & 60fps Camera Zoom + Ball Spin Physics
  _initRouletteSpinState(targetNumber, durationMs = 5500) {
    this._stopRouletteSpinLoop();
    this._spinState = {
      startTime: performance.now(),
      duration: Math.max(2400, Math.min(6000, durationMs)),
      targetNumber: Number(targetNumber) || 0,
      lastTickIdx: -1,
      landedSfxPlayed: false,
    };
    this._startRouletteSpinLoop();
  }

  _stopRouletteSpinLoop() {
    if (this._spinRaf) {
      cancelAnimationFrame(this._spinRaf);
      this._spinRaf = null;
    }
    this._spinState = null;
  }

  _startRouletteSpinLoop() {
    if (this._spinRaf) cancelAnimationFrame(this._spinRaf);

    const tick = (now) => {
      if (!this._spinState || !this.stageEl || this.game !== 'roulette') {
        this._spinRaf = null;
        return;
      }

      const st = this._spinState;
      const elapsed = now - st.startTime;
      const p = Math.min(1, Math.max(0, elapsed / st.duration));

      const rotorEl = this.stageEl.querySelector('#roulette-wheel-rotor');
      const ballEl = this.stageEl.querySelector('#roulette-ball');
      const trailEl = this.stageEl.querySelector('#roulette-ball-trail');
      const pocketGlowEl = this.stageEl.querySelector('#roulette-pocket-highlight');
      const shockEl = this.stageEl.querySelector('#roulette-ball-shockwave');
      const spinBannerEl = this.stageEl.querySelector('#roulette-spin-banner');

      if (ballEl) {
        ballEl.hidden = false;
        // 1. Wheel rotation (clockwise 60fps inner rotor spin + subtle harmonic energy scale on outer bowl)
        const wheelEase = 1 - Math.pow(1 - p, 2.6);
        const wheelAngleRad = wheelEase * Math.PI * 8; // 4 full clockwise turns
        if (rotorEl) {
          const tiltScale = 1 + Math.sin(p * Math.PI) * 0.03;
          rotorEl.style.transform = `scale(${tiltScale.toFixed(3)})`;
          const innerRing = rotorEl.querySelector('.roulette-inner-rotor-ring');
          if (innerRing) {
            const deg = ((wheelAngleRad * 180) / Math.PI) % 360;
            innerRing.style.transform = `translate(-50%, -50%) scaleY(0.45) rotate(${deg.toFixed(1)}deg)`;
          }
        }

        // Winning pocket angle on the 35° elliptical inner wheel ring
        // Map number to front-visible lower/side arc so ball never hides behind croupier paws
        const rawIdx = EUROPEAN_WHEEL_ORDER.indexOf(Number(st.targetNumber));
        const normIdx = (rawIdx >= 0 ? rawIdx : 0) / EUROPEAN_WHEEL_ORDER.length;
        const finalPocketAngle = 0.12 * Math.PI + normIdx * 0.76 * Math.PI;

        // 2. Ivory Ball 3-Stage Physics (Orbit -> Spiral & Fret Bounces -> Pocket Lock-In)
        // Responsive radii derived dynamically from the rendered wheel rotor dimensions
        const wheelW = rotorEl?.clientWidth || 180;
        const wheelH = rotorEl?.clientHeight || 116;
        const outerRx = wheelW * 0.367;
        const outerRy = wheelH * 0.23;
        const innerRx = wheelW * 0.245;
        const innerRy = wheelH * 0.151;

        let ballAngle = 0;
        let radiusFactor = 1; // 1 = outer rim, 0 = inner pocket ring
        let bounceLiftY = 0;

        if (p < 0.62) {
          // Stage A: Fast counter-clockwise orbit on the outer mahogany rim
          const orbitT = p / 0.62;
          const orbitEase = 1 - Math.pow(1 - orbitT, 1.85);
          ballAngle = finalPocketAngle - (1 - orbitEase) * Math.PI * 2 * 5.0 - Math.PI * 1.4;
          radiusFactor = 1.0;

          // Subtle rolling ticks along the upper track
          const tickStep = Math.floor(orbitEase * 16);
          if (tickStep !== st.lastTickIdx) {
            st.lastTickIdx = tickStep;
            try { sfx.step(tickStep); } catch {}
          }
        } else if (p < 0.89) {
          // Stage B: Spiraling inward + 4 damped pocket-fret bounces (Monopoly dice bounce feel!)
          const spiralT = (p - 0.62) / 0.27;
          const spiralEase = 1 - Math.pow(1 - spiralT, 2.2);
          ballAngle = finalPocketAngle - (1 - spiralEase) * Math.PI * 1.4;
          radiusFactor = 1 - spiralEase;

          // 4 distinct damped bounces over the brass pocket frets
          const bounceCount = 4;
          const bounceWave = Math.abs(Math.sin(spiralT * Math.PI * bounceCount));
          const damping = Math.pow(1 - spiralT, 1.35);
          bounceLiftY = bounceWave * damping * (wheelH * 0.11);

          const bounceIdx = Math.floor(spiralT * bounceCount);
          const tickKey = 100 + bounceIdx;
          if (tickKey !== st.lastTickIdx) {
            st.lastTickIdx = tickKey;
            try { sfx.diceTick(bounceIdx + 1); } catch {}
          }
        } else {
          // Stage C: Locked into the winning pocket!
          const settleT = (p - 0.89) / 0.11;
          ballAngle = finalPocketAngle + Math.sin(settleT * Math.PI * 2) * (1 - settleT) * 0.04;
          radiusFactor = 0;
          bounceLiftY = 0;

          if (!st.landedSfxPlayed) {
            st.landedSfxPlayed = true;
            try { sfx.diceLand(); } catch {}
            if (shockEl) {
              shockEl.hidden = false;
              shockEl.classList.remove('is-active');
              void shockEl.offsetWidth;
              shockEl.classList.add('is-active');
            }
          }
        }

        const rx = innerRx + (outerRx - innerRx) * radiusFactor;
        const ry = innerRy + (outerRy - innerRy) * radiusFactor;
        // Center of the 35° wheel bowl pocket track
        const centerOffsetY = -wheelH * 0.016;
        const bx = Math.cos(ballAngle) * rx;
        const by = Math.sin(ballAngle) * ry + centerOffsetY - bounceLiftY;

        ballEl.style.transform = `translate3d(${bx.toFixed(1)}px, ${by.toFixed(1)}px, 0) translate(-50%, -50%)`;

        // Comet trail behind the ball while orbiting fast
        if (trailEl) {
          if (p < 0.78) {
            const trailAngle = ballAngle + 0.28 * (1 - p * 0.8);
            const tx = Math.cos(trailAngle) * rx;
            const ty = Math.sin(trailAngle) * ry + centerOffsetY - bounceLiftY * 0.6;
            trailEl.hidden = false;
            trailEl.style.opacity = String((1 - p) * 0.78);
            trailEl.style.transform = `translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, 0) translate(-50%, -50%)`;
          } else {
            trailEl.hidden = true;
          }
        }

        // Pocket highlight & shockwave coordinates once settled
        if (pocketGlowEl) {
          if (p >= 0.86) {
            const px = Math.cos(finalPocketAngle) * innerRx;
            const py = Math.sin(finalPocketAngle) * innerRy + centerOffsetY;
            pocketGlowEl.hidden = false;
            pocketGlowEl.className = `roulette-pocket-highlight ${colorOf(st.targetNumber)}`;
            pocketGlowEl.style.transform = `translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0) translate(-50%, -50%)`;
            if (shockEl) {
              shockEl.style.transform = `translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0) translate(-50%, -50%)`;
            }
          } else {
            pocketGlowEl.hidden = true;
          }
        }

        if (spinBannerEl) {
          spinBannerEl.hidden = false;
          if (p >= 0.89) {
            const col = colorOf(st.targetNumber).toUpperCase();
            spinBannerEl.innerHTML = `🎯 <b>BALL LANDED: #${st.targetNumber} ${col}!</b>`;
            spinBannerEl.classList.add('is-landed');
          } else if (p >= 0.62) {
            spinBannerEl.innerHTML = `✨ <b>BOUNCING IN POCKETS...</b>`;
            spinBannerEl.classList.remove('is-landed');
          } else {
            spinBannerEl.innerHTML = `🎡 <b>SPINNING WHEEL...</b>`;
            spinBannerEl.classList.remove('is-landed');
          }
        }
      }

      if (p < 1 && this.state?.phase === 'spin') {
        this._spinRaf = requestAnimationFrame(tick);
      } else {
        this._spinRaf = null;
      }
    };

    this._spinRaf = requestAnimationFrame(tick);
  }

  renderRoulette() {
    const s = this.state;
    const phase = s?.phase || 'betting';
    const round = s?.round || 1;
    const isBetting = phase === 'betting';
    const isSpinning = phase === 'spin';
    const isResult = phase === 'result';
    if (!isSpinning) {
      this._stopRouletteSpinLoop();
    }
    const seats = s?.seats || [];
    const myProfile = this.getProfile?.() || null;

    const berries = myProfile?.berries ?? 1240;
    const diamonds = myProfile?.diamonds ?? 3890;
    const partnerName = myProfile?.partner_id ? (myProfile.partner_id === 'neen' ? 'Neen' : 'Beam') : 'Beam';
    const occupiedCount = Math.max(4, seats.filter((st) => st && (st.userId || st.isBot)).length);

    // Floating Lightning Multiplier Banners (#roulette-strikes)
    const activeStrikes = (this.strikes && this.strikes.length) ? this.strikes : [];
    const strikesHtml = activeStrikes.length
      ? activeStrikes.map((st, i) => {
          const colName = st.label
            ? st.label
            : `${colorOf(st.n).toUpperCase()} = ${st.mult}x${i === 0 ? '!' : '!'}`;
          const tierCls = st.cls || (st.n === 0 ? 'strike-green' : i === 0 ? 'strike-red' : 'strike-gold');
          return `
            <div class="roulette-strike-item ${tierCls}">
              <span class="strike-zap">⚡</span>
              <span class="strike-num">#${st.n}</span>
              <span class="strike-mult">${colName}</span>
            </div>`;
        }).join('')
      : `
        <div class="roulette-strike-item strike-gold">
          <span class="strike-zap">⚡</span>
          <span class="strike-num">ZEUS</span>
          <span class="strike-mult">1–3 NUMBERS (50x–500x) ON SPIN!</span>
        </div>`;

    // History Strip (#roulette-history)
    const displayHistory = (this.history && this.history.length)
      ? this.history.slice(0, 6)
      : [];

    const historyHtml = displayHistory.length
      ? displayHistory.map((h) => {
          const col = h.color || colorOf(h.number);
          const strikeObj = h.strikes?.find((st) => st.n === h.number);
          const ico = strikeObj ? '⚡' : (h.number === 0 ? '👑' : (col === 'red' ? '🔴' : '⚫'));
          const multTxt = strikeObj ? ` (${strikeObj.mult}x)` : '';
          return `<span class="roulette-hist-badge ${col}">[${ico} <b>${h.number}</b>${multTxt}]</span>`;
        }).join('')
      : `<span class="roulette-hist-badge">⚡ Place chips on the grid below to bet this spin!</span>`;

    // Winning number & all winning spot flags when result is out
    const winningNum = s?.number != null ? s.number : (isResult && this.history[0] ? this.history[0].number : null);
    const hasWinningNum = winningNum != null;
    const winCol = hasWinningNum ? colorOf(winningNum) : null;
    const winDozen = hasWinningNum && winningNum > 0 ? Math.ceil(winningNum / 12) : 0;
    const winColIdx = hasWinningNum && winningNum > 0 ? (((winningNum - 1) % 3) + 1) : 0;
    const isWinLow = hasWinningNum && winningNum >= 1 && winningNum <= 18;
    const isWinHigh = hasWinningNum && winningNum >= 19 && winningNum <= 36;
    const isWinEven = hasWinningNum && winningNum > 0 && winningNum % 2 === 0;
    const isWinOdd = hasWinningNum && winningNum > 0 && winningNum % 2 === 1;

    const winningStrike = hasWinningNum ? this.strikes?.find((st) => st.n === winningNum) : null;
    const winningOrbHtml = (hasWinningNum && !isResult)
      ? `
        <div class="roulette-winning-orb ${winCol}">
          <span class="win-orb-num">${winningNum === 0 ? '👑 0' : `#${winningNum}`}</span>
          <span class="win-orb-sub">${winningStrike ? `⚡ ${winningStrike.mult}×` : winCol.toUpperCase()}</span>
        </div>`
      : '';

    // Resting ball & pocket highlight during result phase
    let restingBallStyle = ' hidden';
    let restingPocketStyle = ' hidden';
    let restingPocketCls = '';
    if (isResult && hasWinningNum) {
      const rawIdx = EUROPEAN_WHEEL_ORDER.indexOf(Number(winningNum));
      const normIdx = (rawIdx >= 0 ? rawIdx : 0) / EUROPEAN_WHEEL_ORDER.length;
      const ang = 0.12 * Math.PI + normIdx * 0.76 * Math.PI;
      const px = (Math.cos(ang) * 44).toFixed(1);
      const py = (Math.sin(ang) * 17 - 2).toFixed(1);
      restingBallStyle = ` style="transform: translate3d(${px}px, ${py}px, 0) translate(-50%, -50%);"`;
      restingPocketStyle = ` style="transform: translate3d(${px}px, ${py}px, 0) translate(-50%, -50%);"`;
      restingPocketCls = winCol;
    }

    const myTotalBet = this.pendingBets.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
    const myLastSettle = isResult
      ? this.lastResult?.seats?.find((st) => st.userId === this.myUserId || (seats[st.seat]?.userId === this.myUserId))
      : null;
    const hitReturn = Number(myLastSettle?.returned ?? myLastSettle?.payout ?? 0);

    let plaqueTopHtml = '';
    let plaqueSubTxt = '';
    if (isResult && myLastSettle && myLastSettle.profit > 0) {
      plaqueTopHtml = `🎉 <b>+${fmtNum(myLastSettle.profit)}</b> <img src="/assets/ui/icon_gold.png" alt="" />`;
      plaqueSubTxt = myLastSettle.bigHit ? `⚡ ${myLastSettle.bigHit.mult}× LIGHTNING WIN!` : 'ROUND WIN!';
    } else if (isResult && hitReturn > 0) {
      plaqueTopHtml = `✨ <b>PAYOUT +${fmtNum(hitReturn)}</b> <img src="/assets/ui/icon_gold.png" alt="" />`;
      plaqueSubTxt = `#${winningNum} ${winCol.toUpperCase()} HIT!`;
    } else if (isResult && hasWinningNum) {
      plaqueTopHtml = `🎯 <b>#${winningNum} ${winCol.toUpperCase()}</b>`;
      plaqueSubTxt = myLastSettle?.total > 0 ? `NO HIT (-${fmtNum(myLastSettle.total)} <img class="mini-coin-ico" src="/assets/ui/icon_gold.png" alt="" />)` : 'ROUND COMPLETE';
    } else if (isSpinning) {
      plaqueTopHtml = `⚡ <b>SPINNING...</b>`;
      plaqueSubTxt = myTotalBet > 0 ? `BET LOCKED: ${fmtNum(myTotalBet)} <img class="mini-coin-ico" src="/assets/ui/icon_gold.png" alt="" />` : 'WATCHING SPIN';
    } else if (myTotalBet > 0) {
      plaqueTopHtml = `<img src="/assets/ui/icon_gold.png" alt="" /> <b>BET: ${fmtNum(myTotalBet)}</b>`;
      plaqueSubTxt = 'TAP ⚡ SPIN WHEN READY!';
    } else {
      plaqueTopHtml = `<img src="/assets/ui/icon_gold.png" alt="" /> <b>BET THIS ROUND!</b>`;
      plaqueSubTxt = 'TAP GRID CELLS BELOW';
    }

    // Prominent Result Showcase Overlay Banner when results are out
    let resultShowcaseHtml = '';
    if (isResult && hasWinningNum) {
      const parityTag = winningNum === 0 ? 'STARLIGHT CROWN' : `${isWinEven ? 'EVEN' : 'ODD'} • ${winDozen === 1 ? '1–12' : winDozen === 2 ? '13–24' : '25–36'}`;
      const hasHit = hitReturn > 0 || (myLastSettle?.profit || 0) > 0;
      const outcomeCls = hasHit ? 'is-win' : (myLastSettle?.total > 0 ? 'is-lose' : 'is-watch');
      const outcomeTitle = myLastSettle?.profit > 0
        ? `🎉 YOU WON +${fmtNum(myLastSettle.profit)} <img class="mini-coin-ico" src="/assets/ui/icon_gold.png" alt="" />!`
        : (hasHit
            ? `✨ HIT PAYOUT: +${fmtNum(hitReturn)} <img class="mini-coin-ico" src="/assets/ui/icon_gold.png" alt="" />!`
            : (myLastSettle?.total > 0
                ? `💀 NO HIT THIS SPIN (-${fmtNum(myLastSettle.total)} <img class="mini-coin-ico" src="/assets/ui/icon_gold.png" alt="" />)`
                : `🎯 WINNING NUMBER: #${winningNum} ${winCol.toUpperCase()}`));
      const outcomeSub = hasHit
        ? (myLastSettle.bigHit ? `⚡ ${myLastSettle.bigHit.mult}× LIGHTNING MULTIPLIER HIT!` : `Total Payout: +${fmtNum(hitReturn || myLastSettle.profit)} <img class="mini-coin-ico" src="/assets/ui/icon_gold.png" alt="" /> • Winning spots lit below!`)
        : `Winning spots highlighted on the mat below!`;

      resultShowcaseHtml = `
        <div id="roulette-result-showcase" class="casino-result-showcase roulette-result-showcase ${outcomeCls}">
          <div class="roulette-result-medallion ${winCol}">
            <span class="rmed-num">${winningNum === 0 ? '👑 0' : `#${winningNum}`}</span>
            <span class="rmed-col">${winningStrike ? `⚡ ${winningStrike.mult}×` : winCol.toUpperCase()}</span>
          </div>
          <div class="roulette-result-details">
            <div class="rres-tags">${winCol.toUpperCase()} • ${parityTag}</div>
            <div class="rres-outcome">${outcomeTitle}</div>
            <div class="rres-sub">${outcomeSub}</div>
          </div>
        </div>`;
    }

    // 4 Seated Chibis around the Circular Roulette Table (#roulette-seats, .casino-seat[data-seat="0..3"])
    const renderTableSeat = (idx) => {
      const st = seats[idx];
      const preset = SEAT_PRESETS[idx];
      const isMe = st?.userId ? st.userId === this.myUserId : idx === 0;
      const name = isMe ? (myProfile?.username || st?.name || preset.name) : String(st?.name || preset.name).replace(/^Bot\s+/i, '');
      const isLeft = idx === 0 || idx === 1;
      const chairUrl = isLeft ? '/assets/ui/casino_chair_velvet_left.png' : '/assets/ui/casino_chair_velvet_right.png';
      const avatarHtml = renderChibiAvatar(st, idx, isMe, myProfile, { headCrop: false });
      return `
        <div class="casino-seat roulette-table-seat r-seat-${idx} ${isMe ? 'is-me' : ''} ${!st || (!st.userId && !st.isBot) ? 'empty' : ''}" data-seat="${idx}">
          <img class="r-seat-chair" src="${chairUrl}" alt="" />
          <div class="r-seat-avatar">${avatarHtml}</div>
          ${(idx === 0 || idx === 3) ? `<img class="r-seat-pet" src="${preset.petUrl}" alt="" />` : ''}
          ${idx === 2 ? `<div class="r-seat-emotes"><span class="r-emote top">🤩</span><span class="r-emote bot">🥂</span></div>` : ''}
          <span class="r-seat-name">${esc(name)}</span>
        </div>`;
    };

    // Chip overlay lookup — during result phase, show the bets from the spin that just resolved (`lastSpinBets`)
    const displayBets = (isResult && !this.pendingBets.length && this.lastSpinBets.length)
      ? this.lastSpinBets
      : this.pendingBets;
    const betAmountFor = (type, n = null) => {
      const match = displayBets.find((b) => b.type === type && (n == null || b.n === n));
      return match ? match.amount : 0;
    };

    const chipTag = (amt) => {
      if (amt > 0) {
        const chipImg = amt >= 5000 ? CHIP_ASSETS[5000] : amt >= 1000 ? CHIP_ASSETS[1000] : amt >= 500 ? CHIP_ASSETS[500] : CHIP_ASSETS[100];
        return `
          <span class="bet-chip">
            <img src="${chipImg}" alt="" />
            <b>${amt >= 1000 ? `${+(amt / 1000).toFixed(1)}k` : amt}</b>
          </span>`;
      }
      return '';
    };

    // Top 0 (Green) Starlight Crown bar
    const zeroBet = betAmountFor('straight', 0);
    const zeroStrike = this.strikes.find((st) => st.n === 0);
    const zeroTopBanner = `
      <div class="roulette-cell green zero-banner ${zeroStrike ? 'struck' : ''} ${winningNum === 0 ? 'winning-cell' : ''}"
           data-bet-type="straight" data-n="0" data-bet-kind="straight" data-bet-target="0">
        <span class="zero-crown-lbl">👑 <b>0</b> Starlight Crown</span>
        ${zeroStrike ? `<span class="strike-micro-tag">⚡${zeroStrike.mult}x</span>` : ''}
        ${chipTag(zeroBet)}
      </div>`;

    // Horizontal European Roulette Layout (3 rows × 12 columns: top row 3..36, middle row 2..35, bottom row 1..34)
    const ROW_ORDER = [3, 2, 1];
    let numbersGrid = '';
    for (const rMod of ROW_ORDER) {
      for (let colIdx = 0; colIdx < 12; colIdx++) {
        const num = colIdx * 3 + rMod;
        const color = colorOf(num);
        const amt = betAmountFor('straight', num);
        const strikeObj = this.strikes.find((st) => st.n === num);
        const isWinning = winningNum === num;
        numbersGrid += `
          <div class="roulette-cell num-cell ${color} ${strikeObj ? 'struck' : ''} ${isWinning ? 'winning-cell' : ''}"
               data-bet-type="straight" data-n="${num}" data-bet-kind="straight" data-bet-target="${num}">
            <span class="cell-num-txt">${strikeObj ? `⚡${num}` : num}</span>
            ${chipTag(amt)}
          </div>`;
      }
    }

    // Right-side 2:1 Columns (Col 3, Col 2, Col 1 matching the 3 horizontal rows)
    const colCells = [3, 2, 1].map((c) => {
      const amt = betAmountFor('column', c);
      const isWinCol = winColIdx === c;
      return `
        <div class="roulette-cell outside col ${isWinCol ? 'winning-cell' : ''}"
             data-bet-type="column" data-n="${c}" data-bet-kind="column" data-bet-target="${c}">
          <span class="roulette-target-alias" data-bet-type="column" data-n="${c}" data-bet-kind="column" data-bet-target="column:${c}">
            2:1 ${chipTag(amt)}
          </span>
        </div>`;
    }).join('');

    // Dozens row (1-12 (3x), 13-24 (3x), 25-36 (3x))
    const dozenCells = [1, 2, 3].map((d) => {
      const label = d === 1 ? '1–12 (3x)' : d === 2 ? '13–24 (3x)' : '25–36 (3x)';
      const amt = betAmountFor('dozen', d);
      const isWinDoz = winDozen === d;
      return `
        <div class="roulette-cell outside dozen ${d === 3 ? 'is-lightning-dozen' : ''} ${isWinDoz ? 'winning-cell' : ''}"
             data-bet-type="dozen" data-n="${d}" data-bet-kind="dozen" data-bet-target="${d}">
          <span class="roulette-target-alias" data-bet-type="dozen" data-n="${d}" data-bet-kind="dozen" data-bet-target="dozen:${d}">
            ${label} ${chipTag(amt)}
          </span>
        </div>`;
    }).join('');

    // Outside bets (RED, BLACK, EVEN, ODD, 1-18, 19-36)
    const lowAmt = betAmountFor('low');
    const evenAmt = betAmountFor('even');
    const redAmt = betAmountFor('red');
    const blackAmt = betAmountFor('black');
    const oddAmt = betAmountFor('odd');
    const highAmt = betAmountFor('high');

    // Smooth camera zoom class management across DOM re-renders
    const shouldZoom = isSpinning;
    const initialZoomClass = (shouldZoom && this._wasSpinZoom) ? 'is-spin-zoom' : '';

    this.stageEl.innerHTML = `
      <div id="casino-roulette" class="casino-screen roulette casino-overlay ${initialZoomClass} ${isResult ? 'is-result-phase' : ''}">
        <!-- Zeus Celestial Night Colonnade & Lightning Backdrop (Screen 13) -->
        <div class="casino-ballroom-bg roulette-ballroom-bg" aria-hidden="true">
          <img class="ballroom-art-img" src="/assets/ui/casino_bg_roulette_celestial.jpg" alt="" />
          <div class="ballroom-floor-vignette"></div>
        </div>

        <!-- Top HUD Overlay (Matching Screen 13 Mockup) -->
        <header class="casino-header roulette-hud-header">
          <div class="roulette-hud-left">
            <div class="casino-table-plaque">
              <span class="plaque-slot-ico">🎰</span>
              <div class="plaque-lines">
                <div class="casino-round-badge">Casino Table #${this.table?.num || this.tableId || 2}: <small>R${round}</small></div>
                <div class="casino-title">Zeus Lightning Roulette [${occupiedCount}/4]</div>
              </div>
            </div>

            <div class="casino-call-pill roulette-call-pill">
              <span class="call-phone-ico">📞</span>
              <span class="call-txt">On Call with ${esc(partnerName)} • 38:45 <b class="call-gem">(+20 💎)</b></span>
              <span id="casino-phase" class="casino-phase-text" hidden>${phase.toUpperCase()}</span>
              <div class="casino-phase-bar" hidden><div id="casino-phase-fill" class="casino-phase-fill"></div></div>
            </div>
          </div>

          <div class="roulette-hud-right">
            <div class="casino-curr-pill gold" title="Your Gold Balance">
              <img src="/assets/ui/icon_gold.png" alt="" />
              <span>${fmtCompact(this.myGold)}</span>
            </div>
            <div class="casino-curr-pill berry" title="Your Star-Berries">
              <img src="/assets/ui/icon_berry.png" alt="" />
              <span>${fmtNum(berries)}</span>
            </div>
            <div class="casino-curr-pill diamond" title="Your Diamonds">
              <img src="/assets/ui/icon_diamond.png" alt="" />
              <span>${fmtNum(diamonds)}</span>
            </div>
            <button type="button" class="casino-btn plain casino-leave-btn" data-act="exit" title="Leave Table">
              <span class="casino-act-alias" data-act="casino-leave">✕</span>
            </button>
          </div>
        </header>

        <!-- Upper 2.5D Circular Roulette Table Diorama & Lightning Multipliers (.roulette-wheel-area) -->
        <section class="roulette-wheel-area">
          <!-- Lightning Multiplier Banners (#roulette-strikes) -->
          <div id="roulette-strikes" class="roulette-strikes">${strikesHtml}</div>

          <!-- Dynamic Bet / Win Status Plaque -->
          <div class="roulette-lightning-win-plaque">
            <div class="lwin-top">${plaqueTopHtml}</div>
            <div class="lwin-sub">${plaqueSubTxt}</div>
          </div>

          <!-- 2.5D Circular Emerald-Felt & Gold Roulette Table Stage -->
          <div id="roulette-seats" class="roulette-circular-stage">
            <!-- Calico Tuxedo Cat Croupier Behind Wheel -->
            <div class="roulette-dealer-wrap">
              <img class="roulette-dealer-img" src="/assets/ui/casino_dealer_roulette.png" alt="VIP Tuxedo Cat Croupier" />
            </div>

            <!-- Circular Emerald & Carved Mahogany Table Surface -->
            <div class="roulette-circular-table">
              <div class="roulette-table-felt-ring"></div>

              <!-- Centerpiece Ornate Golden & Emerald Roulette Wheel (#roulette-wheel) -->
              <div id="roulette-wheel" class="roulette-wheel-wrap ${isSpinning ? 'is-spinning' : ''}">
                <div id="roulette-wheel-rotor" class="roulette-wheel-rotor">
                  <div class="roulette-inner-rotor-ring"></div>
                  <img class="roulette-wheel-img" src="/assets/ui/casino_roulette_wheel.png" alt="European Roulette Wheel" />
                </div>

                <!-- 60fps 2.5D Elliptical Ivory Ball & Pocket Highlight Track -->
                <div id="roulette-ball-track" class="roulette-ball-track" aria-hidden="true">
                  <div id="roulette-pocket-highlight" class="roulette-pocket-highlight ${restingPocketCls}"${restingPocketStyle}></div>
                  <div id="roulette-ball-trail" class="roulette-ball-trail" hidden></div>
                  <div id="roulette-ball" class="roulette-ball"${restingBallStyle}>
                    <span class="ball-shine"></span>
                  </div>
                  <div id="roulette-ball-shockwave" class="roulette-ball-shockwave" hidden></div>
                </div>

                ${winningOrbHtml}
                <div id="roulette-spin-banner" class="roulette-spin-float-pill" ${!isSpinning ? 'hidden' : ''}>🎡 <b>SPINNING WHEEL...</b></div>
              </div>

              <!-- 3D Chip Stacks & Callout Pills on the Circular Felt -->
              <img class="roulette-felt-chips left" src="/assets/ui/casino_chip_stacks_felt.png" alt="" />
              <div class="roulette-felt-callouts">
                <div class="felt-callout-pill gold">👑 0 (10x)</div>
                <div class="felt-callout-pill red">🔴 RED (2x)</div>
              </div>
            </div>

            <!-- 4 Seated Chibis + Pets Around the Circular Table -->
            ${renderTableSeat(0)}
            ${renderTableSeat(1)}
            ${renderTableSeat(2)}
            ${renderTableSeat(3)}

            ${resultShowcaseHtml}
          </div>
        </section>

        <!-- Middle Spin History & Countdown Strip (.roulette-top-strip) -->
        <section class="roulette-top-strip">
          <div id="roulette-history" class="roulette-history">${historyHtml}</div>
          <div class="roulette-strip-right">
            <div id="roulette-countdown" class="roulette-countdown">🕒 ${isBetting ? 'Spin in' : phase.toUpperCase()} 15s...</div>
            <button type="button" class="casino-btn strip-mini-btn" data-act="roulette-clear" title="Clear Bets" ${!isBetting || !this.pendingBets.length ? 'disabled' : ''}>
              <span class="casino-act-alias" data-act="clear">🗑️</span>
            </button>
            <button type="button" class="casino-btn strip-mini-btn" data-act="roulette-spin" title="Lock & Spin Now" ${!isBetting ? 'disabled' : ''}>⚡</button>
          </div>
        </section>

        <!-- Perspective Horizontal European Roulette Betting Felt (#roulette-grid) -->
        <main class="casino-felt roulette-felt">
          <div id="roulette-grid" class="roulette-grid-container ${isBetting && myTotalBet === 0 ? 'needs-bet-glow' : ''}">
            ${zeroTopBanner}

            <div class="roulette-board-body">
              <div class="roulette-cell green zero-wing ${winningNum === 0 ? 'winning-cell' : ''}"
                   data-bet-type="straight" data-n="0" data-bet-kind="straight" data-bet-target="0">
                <span>0</span>
              </div>
              <div class="roulette-numbers-grid">
                ${numbersGrid}
              </div>
              <div class="roulette-cols-col">
                ${colCells}
              </div>
            </div>

            <div class="roulette-dozens-row">
              <div class="roulette-cell outside low ${isWinLow ? 'winning-cell' : ''}" data-bet-type="low" data-bet-kind="low" data-bet-target="low">1-18 ${chipTag(lowAmt)}</div>
              ${dozenCells}
              <div class="roulette-cell outside high ${isWinHigh ? 'winning-cell' : ''}" data-bet-type="high" data-bet-kind="high" data-bet-target="high">19-36 ${chipTag(highAmt)}</div>
            </div>

            <div class="roulette-outside-row">
              <div class="roulette-cell outside red ${winCol === 'red' ? 'winning-cell' : ''}" data-bet-type="red" data-bet-kind="red" data-bet-target="red">🔴 RED (2x) ${chipTag(redAmt)}</div>
              <div class="roulette-cell outside black ${winCol === 'black' ? 'winning-cell' : ''}" data-bet-type="black" data-bet-kind="black" data-bet-target="black">⚫ BLACK (2x) ${chipTag(blackAmt)}</div>
              <div class="roulette-cell outside even ${isWinEven ? 'winning-cell' : ''}" data-bet-type="even" data-bet-kind="even" data-bet-target="even">✦ EVEN (2x) ${chipTag(evenAmt)}</div>
              <div class="roulette-cell outside odd ${isWinOdd ? 'winning-cell' : ''}" data-bet-type="odd" data-bet-kind="odd" data-bet-target="odd">🔥 ODD (2x) ${chipTag(oddAmt)}</div>
            </div>
          </div>
        </main>

        <!-- Bottom Player Bet Time Banner, Chip Selector Pills & 3 Beveled Action Buttons (Screen 13) -->
        <footer class="casino-footer roulette-footer">
          <div id="roulette-phase-banner" class="pokdeng-phase-banner roulette-phase-banner phase-${phase} ${isBetting && myTotalBet === 0 ? 'needs-bet-pulse' : ''}">
            <span id="roulette-banner-countdown" class="pokdeng-countdown-pill">🕒 15s</span>
            <span class="pokdeng-phase-prompt">
              ${isBetting
                ? (myTotalBet > 0
                    ? `<img class="mini-coin-ico" src="/assets/ui/icon_gold.png" alt="" /> <b>YOUR BET: ${fmtNum(myTotalBet)}</b> (${this.pendingBets.length} spot${this.pendingBets.length > 1 ? 's' : ''}) — Tap grid for more or tap <b>⚡ SPIN</b>!`
                    : `⚠️ <b>PLAYER BET TIME!</b> Tap numbers or RED / BLACK on the felt above to bet!`)
                : isSpinning
                ? `🎡 <b>NO MORE BETS — WHEEL SPINNING!</b> Watch the ivory ball in the zoomed wheel!`
                : (myLastSettle && myLastSettle.profit > 0
                    ? `🎉 <b>YOU WON +${fmtNum(myLastSettle.profit)}!</b> Ball landed on <b>#${winningNum} ${colorOf(winningNum || 0).toUpperCase()}</b>!`
                    : hitReturn > 0
                    ? `✨ <b>HIT PAYOUT +${fmtNum(hitReturn)}!</b> Ball landed on <b>#${winningNum} ${colorOf(winningNum || 0).toUpperCase()}</b>!`
                    : `🎯 <b>WINNING NUMBER: #${winningNum ?? 0} ${colorOf(winningNum || 0).toUpperCase()}</b> — Next betting round starts soon!`)}
            </span>
            <div class="pokdeng-banner-bar"><div id="roulette-banner-fill" class="pokdeng-banner-fill"></div></div>
          </div>

          <div class="roulette-chip-bar">
            <span class="chip-rack-arrow">❮</span>
            <div class="casino-chip-rack roulette-pill-rack">
              ${[
                { amt: 100, cls: 'pill-green', lbl: '100', ico: '/assets/ui/icon_gold.png' },
                { amt: 500, cls: 'pill-blue', lbl: '500', ico: '/assets/ui/icon_gold.png' },
                { amt: 1000, cls: 'pill-gold', lbl: '1,000', ico: '/assets/ui/icon_gold.png' },
                { amt: 5000, cls: 'pill-red chip-max', lbl: 'MAX', ico: '/assets/ui/fx_flame.png' },
              ].map((c) => `
                <button type="button" class="casino-chip roulette-chip-pill chip-${c.amt} ${c.cls} ${this.selectedChip === c.amt ? 'selected' : ''}" data-chip="${c.amt}" ${!isBetting ? 'disabled' : ''}>
                  <img class="r-pill-ico" src="${c.ico}" alt="" />
                  <span class="chip-inner">${c.lbl}</span>
                </button>
              `).join('')}
            </div>
            <button type="button" class="casino-btn deal-now-btn pokdeng-deal-fast-btn roulette-spin-fast-btn" data-act="roulette-spin" title="Lock Bets & Spin Wheel Immediately" ${!isBetting ? 'disabled' : ''}>
              <span>⚡ SPIN</span>
            </button>
          </div>

          <div class="casino-action-tray roulette-action-tray">
            <button type="button" class="casino-btn candy-btn slate" data-act="roulette-rebet" ${!isBetting || !this.lastSpinBets.length ? 'disabled' : ''}>
              <span class="casino-act-alias" data-act="rebet">🔄 Re-Bet</span>
            </button>
            <button type="button" class="casino-btn candy-btn slate" data-act="roulette-double" ${!isBetting || !this.pendingBets.length ? 'disabled' : ''}>
              <span class="casino-act-alias" data-act="double">✖2 Double Bet</span>
            </button>
            <button type="button" class="casino-btn candy-btn gold cheer-wide" data-act="casino-cheer" title="Cheer Table (+5% Luck)">
              <span class="casino-act-alias" data-act="cheer">
                <img class="btn-art-ico" src="/assets/ui/casino_icon_champagne_toast.png" alt="" />
                <span class="btn-lbl"><b>Cheer Table</b><small>(+5% Luck)</small></span>
              </span>
            </button>
          </div>
        </footer>
      </div>`;

    // Trigger smooth Monopoly-style camera zoom transition when entering spin phase
    const screenEl = this.stageEl.querySelector('#casino-roulette');
    if (shouldZoom && !this._wasSpinZoom && screenEl) {
      void screenEl.offsetWidth;
      screenEl.classList.add('is-spin-zoom');
      this._wasSpinZoom = true;
    } else if (!shouldZoom && this._wasSpinZoom) {
      this._wasSpinZoom = false;
    }

    // Ensure spin RAF loop is running if we are in spin phase
    if (isSpinning) {
      if (!this._spinState) {
        const targetNum = s?.spinNumber ?? s?.number ?? (this.strikes?.[0]?.n ?? 0);
        const remainMs = Math.max(2200, (this.phaseEndsAt - (Date.now() + this.skew)) || 5500);
        this._initRouletteSpinState(targetNum, remainMs);
      } else if (!this._spinRaf) {
        this._startRouletteSpinLoop();
      }
    }
  }

  // --------------------------------------------------------------------------- Flying Win Coins FX
  _flyWinCoins(originSelector) {
    if (!this.root || !this.stageEl || !this.fxLayer) return;
    const rootRect = this.root.getBoundingClientRect();
    const originEl = this.stageEl.querySelector(originSelector);
    const destEl = this.stageEl.querySelector('.casino-curr-pill.gold');
    if (!rootRect.width || !originEl || !destEl) return;

    const oRect = originEl.getBoundingClientRect();
    const dRect = destEl.getBoundingClientRect();
    const sx = oRect.left - rootRect.left + oRect.width * 0.5;
    const sy = oRect.top - rootRect.top + oRect.height * 0.5;
    const tx = dRect.left - rootRect.left + dRect.width * 0.5;
    const ty = dRect.top - rootRect.top + dRect.height * 0.5;

    try { sfx.coinStream(10, 0.55); } catch {}

    for (let i = 0; i < 10; i++) {
      setTimeout(() => {
        if (!this.fxLayer) return;
        const coin = document.createElement('img');
        coin.src = '/assets/ui/icon_gold.png';
        coin.className = 'casino-flying-coin';
        this.fxLayer.appendChild(coin);

        const startX = sx + (Math.random() - 0.5) * 44;
        const startY = sy + (Math.random() - 0.5) * 28;
        const ctrlX = (startX + tx) * 0.5 + (Math.random() - 0.5) * 90;
        const ctrlY = Math.min(startY, ty) - 40 - Math.random() * 40;
        const dur = 520 + Math.random() * 140;
        const t0 = performance.now();

        const stepCoin = (now) => {
          const p = Math.min(1, (now - t0) / dur);
          const ease = 1 - Math.pow(1 - p, 2.4);
          const inv = 1 - ease;
          const x = inv * inv * startX + 2 * inv * ease * ctrlX + ease * ease * tx;
          const y = inv * inv * startY + 2 * inv * ease * ctrlY + ease * ease * ty;
          const sc = 0.75 + Math.sin(p * Math.PI) * 0.45;
          coin.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%) scale(${sc.toFixed(2)})`;
          if (p < 1) {
            requestAnimationFrame(stepCoin);
          } else {
            coin.remove();
          }
        };
        requestAnimationFrame(stepCoin);
      }, i * 52);
    }
  }

  // Normalizes pending bets for server validation (`ROULETTE_BET_TYPES`)
  _serializeBetsForServer(bets) {
    const merged = new Map();
    for (const b of bets) {
      let type = b.type;
      let n = b.n;
      if (type === 'low') {
        type = 'even';
        n = undefined;
      } else if (type === 'high') {
        type = 'odd';
        n = undefined;
      }
      const key = `${type}:${n ?? ''}`;
      const prev = merged.get(key);
      merged.set(key, { type, ...(n != null ? { n } : {}), amount: (prev?.amount || 0) + b.amount });
    }
    return [...merged.values()];
  }

  // --------------------------------------------------------------------------- Input
  onClick(e) {
    const el = e.target.closest('[data-act],[data-chip],[data-bet-type],[data-bet-kind]');
    if (!el) return;

    const btn = el.closest('button');
    if (btn && btn.disabled) return;

    // Chip selection (accumulates in Pok-Deng up to 50,000 MAX)
    if (el.dataset.chip) {
      const rawChip = Number(el.dataset.chip);
      this.selectedChip = rawChip;
      try { sfx.coin(true); } catch {}
      if (this.game === 'pokdeng') {
        if (!this.state || this.state.phase === 'betting') {
          const mySeat = this.state?.seats?.find((s) => s.userId === this.myUserId);
          const roundKey = `${this.tableId || this.state?.tableId || 1}:${this.state?.round || 1}`;
          const currentEscrowed = Number(mySeat?.bet) || 0;
          const totalAvail = Math.max(0, (typeof this.myGold === 'number' ? this.myGold : (mySeat?.gold || 0)) + currentEscrowed);
          const maxAllowed = Math.min(50000, Math.floor(totalAvail));

          let targetBet;
          if (rawChip >= 50000) {
            targetBet = maxAllowed >= 100 ? maxAllowed : 50000;
          } else if (this._manualBetRoundKey === roundKey || currentEscrowed > 500) {
            targetBet = currentEscrowed + rawChip;
          } else {
            // First manual chip tap when starting from default 500: if user tapped 10,000, start at 10,000 so 2 taps = 20,000
            targetBet = (currentEscrowed === 500 && rawChip === 500) ? 1000 : rawChip;
          }

          if (maxAllowed >= 100 && targetBet > maxAllowed) {
            targetBet = maxAllowed;
          }
          targetBet = Math.min(50000, Math.max(100, Math.floor(targetBet)));
          this._manualBetRoundKey = roundKey;
          this.lastPokdengBet = targetBet;
          if (mySeat) mySeat.bet = targetBet;
          this.net.send({ type: 'casino_bet', tableId: this.tableId, amount: targetBet });
        }
      }
      this.render();
      return;
    }

    // Roulette betting spot clicked
    if (el.dataset.betType || el.dataset.betKind) {
      if (this.game !== 'roulette' || this.state?.phase !== 'betting') return;
      const type = el.dataset.betType || el.dataset.betKind;
      let n;
      if (el.dataset.n != null) {
        n = Number(el.dataset.n);
      } else if (el.dataset.betTarget != null && (type === 'straight' || type === 'dozen' || type === 'column')) {
        const rawTarget = String(el.dataset.betTarget).split(':').pop();
        n = Number(rawTarget);
      }
      try { sfx.coin(true); } catch {}
      this.addRouletteBet(type, n, this.selectedChip);
      return;
    }

    // Action buttons (supports both canonical and alias hooks: casino_action, casino_spin_now, table_leave)
    switch (el.dataset.act) {
      case 'exit':
      case 'casino-leave': {
        this.net.send({ type: 'casino_leave', tableId: this.tableId });
        this.close();
        this.onExit();
        break;
      }
      case 'pokdeng-reset-bet': {
        if (!this.state || this.state.phase === 'betting') {
          this._manualBetRoundKey = null;
          this.selectedChip = 500;
          this.lastPokdengBet = 500;
          const mySeat = this.state?.seats?.find((s) => s.userId === this.myUserId);
          const currentEscrowed = Number(mySeat?.bet) || 0;
          const totalAvail = Math.max(0, (typeof this.myGold === 'number' ? this.myGold : (mySeat?.gold || 0)) + currentEscrowed);
          const resetAmt = totalAvail >= 500 ? 500 : (totalAvail >= 100 ? 100 : 500);
          if (mySeat) mySeat.bet = resetAmt;
          this.net.send({ type: 'casino_bet', tableId: this.tableId, amount: resetAmt });
          this.render();
        }
        break;
      }
      case 'pokdeng-deal': {
        if (!this.state || this.state.phase === 'betting') {
          const mySeat = this.state?.seats?.find((s) => s.userId === this.myUserId);
          const amt = mySeat?.bet || this.lastPokdengBet || this.selectedChip || 500;
          this.lastPokdengBet = amt;
          this.net.send({ type: 'casino_bet', tableId: this.tableId, amount: amt, dealNow: true });
        }
        break;
      }
      case 'hit':
      case 'pokdeng-draw': {
        this._triggerDealerShoeThrow(true);
        this.net.send({ type: 'casino_hit', action: 'casino_action', tableId: this.tableId });
        break;
      }
      case 'stay':
      case 'pokdeng-stay': {
        const mySeatIdx = this.state?.seats?.findIndex((s) => s.userId === this.myUserId) ?? 0;
        this._spawnSeatActionCallout(mySeatIdx >= 0 ? mySeatIdx : 0, '👑 STAY', 'stay');
        this.net.send({ type: 'casino_stay', action: 'casino_action', tableId: this.tableId });
        break;
      }
      case 'cheer':
      case 'casino-cheer': {
        if (this.game === 'pokdeng') {
          this.net.send({ type: 'casino_cheer', tableId: this.tableId });
        } else {
          this.toast('🥂 Cheers to the table! May Zeus Lightning strike your numbers!');
        }
        break;
      }
      case 'rebet':
      case 'roulette-rebet': {
        if (!this.lastSpinBets.length || this.state?.phase !== 'betting') return;
        this.pendingBets = JSON.parse(JSON.stringify(this.lastSpinBets));
        this.net.send({ type: 'casino_roulette_bets', tableId: this.tableId, bets: this._serializeBetsForServer(this.pendingBets) });
        this.render();
        break;
      }
      case 'double':
      case 'roulette-double': {
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
        this.net.send({ type: 'casino_roulette_bets', tableId: this.tableId, bets: this._serializeBetsForServer(this.pendingBets) });
        this.render();
        break;
      }
      case 'clear':
      case 'roulette-clear': {
        if (this.state?.phase !== 'betting') return;
        this.pendingBets = [];
        this.net.send({ type: 'casino_roulette_bets', tableId: this.tableId, bets: [] });
        this.render();
        break;
      }
      case 'roulette-spin': {
        if (this.state?.phase !== 'betting') return;
        if (this.pendingBets.length) {
          this.net.send({ type: 'casino_roulette_bets', spin: 'casino_spin_now', tableId: this.tableId, bets: this._serializeBetsForServer(this.pendingBets) });
          this.toast('⚡ Bets locked in! Zooming in on the wheel...');
        } else {
          this.toast('🎰 Tap numbers or RED / BLACK on the felt first!');
        }
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

    this.net.send({ type: 'casino_roulette_bets', tableId: this.tableId, bets: this._serializeBetsForServer(this.pendingBets) });
    this.render();
  }
}
