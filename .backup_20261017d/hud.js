// client/js/minigames/monopoly_25d/hud.js — DOM HUD for Sky Monopoly (Screens 10 & 11).
// Top 12%: 4 player cards (🪙 cash + 👑 net worth + ult ring) · Bottom 16% thumb zone: [1d6 | ⚡2d6] toggle,
// winged ROLL button, rainbow ULTIMATE orb, Overview cam toggle · decision bottom-sheet · anime cut-in ·
// victory podium. Pure presentation: every button only calls the handler passed in by the bridge.
import { MONO, TILES, ZONES, THEMES, rentFor, upgradeCost, PODIUM } from '/shared/monopoly_rules.js';
import { skillFor, GENERIC_SKILLS } from '/shared/season_skills.js';
import { resolvePetSpriteKey } from '/shared/pet_catalog.js';
import { SEAT_COLORS, juiceBus } from './board_scene.js';

const TIER_NAME = ['Land', '🏡 Cozy Villa', '🏢 Luxury Hotel', '🏰 Realm Landmark', '☀️ Sovereign Monument'];
const fmt = (n) => Number(Math.round(n || 0)).toLocaleString('en-US');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SEAT_DEFAULT_HAIRS = ['hair_boy_fluffy', 'hair_twin_tails', 'hair_spiky_hero', 'hair_girl_waves'];
export const portraitUrl = (lineage, player = null) => {
  const lin = (typeof lineage === 'object' ? lineage?.lineage : lineage) || 'bkk';
  const p = typeof lineage === 'object' ? lineage : player;
  const outfit = p?.outfit || p?.equipped?.outfit?.id || (typeof p?.equipped?.outfit === 'string' ? p.equipped.outfit : null);
  if (outfit && outfit !== 'newbie_outfit') return `/assets/chibi/${lin}_${outfit}_front.png`;
  return `/assets/chibi/${lin}_base_front.png`;
};
export const portraitBgCss = (lineage, player = null) => {
  const lin = (typeof lineage === 'object' ? lineage?.lineage : lineage) || 'bkk';
  const p = typeof lineage === 'object' ? lineage : player;
  const outfit = p?.outfit || p?.equipped?.outfit?.id || (typeof p?.equipped?.outfit === 'string' ? p.equipped.outfit : null);
  const hairRaw = p?.hair || p?.equipped?.hair?.id || (typeof p?.equipped?.hair === 'string' ? p.equipped.hair : null) || SEAT_DEFAULT_HAIRS[(p?.seat ?? (lin === 'dxb' || lin === 'girl' ? 3 : 0)) % 4];
  const hairKey = String(hairRaw).startsWith('hair_') ? hairRaw : `hair_${hairRaw}`;
  const hasOutfit = Boolean(outfit && outfit !== 'newbie_outfit');
  const imgs = [`url(/assets/chibi/${hairKey}_front.png)`];
  if (hasOutfit) imgs.push(`url(/assets/chibi/${lin}_${outfit}_front.png)`);
  imgs.push(`url(/assets/chibi/${lin}_base_front.png)`);
  const sizes = hasOutfit ? '92% auto, 142% auto, 142% auto' : '92% auto, 142% auto';
  const pos = hasOutfit ? '50% -8%, 50% 8%, 50% 8%' : '50% -8%, 50% 8%';
  return `${imgs.join(', ')};background-size:${sizes};background-position:${pos};background-repeat:no-repeat`;
};

export class MonopolyHud {
  /**
   * @param {HTMLElement} host   element that overlays the canvas (position: relative/absolute)
   * @param {object} h           handlers { onRoll(use2d6), onUlt(), onPetToggleAuto(auto), onPetArm(armed), onPetCast(), onCam(), onDecide(choice), onExit(), onRematch(), onMute() }
   */
  constructor(host, h = {}) {
    this.h = h;
    this.use2d6 = false;
    this._cashShown = new Map();
    juiceBus.hud = this;
    this.root = document.createElement('div');
    this.root.className = 'mono-hud';
    this.root.innerHTML = `
      <div class="mono-top">
        <div class="mono-round"><span class="mono-round-txt">Round 1 / ${MONO.MAX_ROUNDS}</span><button class="mono-mini mono-theme" title="Cycle Courtyard Theme">🌿</button><button class="mono-mini mono-mute" title="Sound">🔊</button><button class="mono-mini mono-exit" title="Leave">✕</button></div>
        <div class="mono-cards"></div>
      </div>
      <div class="mono-ticker" hidden></div>
      <div class="mono-floats"></div>
      <div class="mono-cutin" hidden></div>
      <div class="mono-bottom mono-controls">
        <div class="mono-turn-hint"></div>
        <div class="mono-dice-toggle" data-act="boost">
          <button data-d="1" class="on">🎲 1d6</button>
          <span class="mono-dice-sep">|</span>
          <button data-d="2">⚡ 2d6 <b class="mono-boost">×3</b></button>
        </div>
        <button class="mono-roll" data-act="roll">
          <img class="mono-roll-winged-bg" src="/assets/ui/ui_btn_roll_winged.png" alt="" />
          <span class="wing l"></span>
          <span class="mono-roll-face">🎲</span>
          <span class="wing r"></span>
          <span class="mono-roll-txt">ROLL</span>
        </button>
        <div class="mono-left-side">
          <button type="button" class="mono-pet-ult unlinked" data-act="pet-orb" title="Pet Soul-Link — joins your Ultimate as a combo">
            <span class="mono-pet-ult-orb"><span class="mono-pet-ult-fill"></span><span class="mono-pet-ult-ico">🐾</span><span class="mono-pet-ult-pct">0%</span></span>
            <span class="mono-pet-auto-chip on" data-act="pet-auto" role="switch" aria-checked="true" title="Tap to switch Auto / Manual">AUTO</span>
            <span class="mono-ult-txt">PET ULT</span>
            <span class="mono-ult-sub mono-pet-ult-sub">Soul-Link</span>
          </button>
        </div>
        <div class="mono-side">
          <button class="mono-ult" data-act="ult">
            <span class="mono-ult-orb">
              <img class="mono-ult-rainbow-img" src="/assets/ui/ui_orb_ult_rainbow.png" alt="" />
              <span class="mono-ult-fill"></span>
              <span class="mono-ult-ico">⚡</span>
              <span class="mono-ult-pct">0%</span>
            </span>
            <span class="mono-ult-txt">⚡ ULTIMATE</span>
            <span class="mono-ult-sub mono-owner-ult-sub">Ultimate</span>
          </button>
          <button class="mono-cam" data-act="cam">📹 <span>Overview</span></button>
        </div>
      </div>
      <div class="mono-sheet" hidden></div>
      <div class="mono-podium" hidden></div>
      <div class="mono-intro" hidden></div>`;
    host.appendChild(this.root);
    const $ = (s) => this.root.querySelector(s);
    this.el = {
      cards: $('.mono-cards'), round: $('.mono-round-txt'), ticker: $('.mono-ticker'), floats: $('.mono-floats'),
      cutin: $('.mono-cutin'), roll: $('.mono-roll'), toggle: $('.mono-dice-toggle'), boost: $('.mono-boost'),
      ult: $('.mono-ult'), ultFill: $('.mono-ult-fill'), ultIco: $('.mono-ult-ico'), ultPct: $('.mono-ult-pct'), ultSub: $('.mono-owner-ult-sub'),
      petUlt: $('.mono-pet-ult'), petUltFill: $('.mono-pet-ult-fill'), petUltIco: $('.mono-pet-ult-ico'), petUltPct: $('.mono-pet-ult-pct'), petUltSub: $('.mono-pet-ult-sub'),
      petAuto: $('.mono-pet-auto-chip'),
      cam: $('.mono-cam'), hint: $('.mono-turn-hint'),
      sheet: $('.mono-sheet'), podium: $('.mono-podium'), intro: $('.mono-intro'), themeBtn: $('.mono-theme'), mute: $('.mono-mute'),
    };
    this.el.intro?.addEventListener('pointerdown', () => this.hideMatchIntro());
    this.el.toggle.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b || b.disabled) return;
      this.use2d6 = b.dataset.d === '2';
      this.el.toggle.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    });
    this.el.roll.addEventListener('click', () => {
      this.hideMatchIntro();
      if (!this.el.roll.disabled) this.h.onRoll?.(this.use2d6);
    });
    this.el.ult.addEventListener('click', () => {
      if (!this.el.ult.disabled) {
        this.h.onUlt?.();
      } else if (this.mySkill) {
        this.ticker(`${this.mySkill.icon} <b>${esc(this.mySkill.name)}</b>: ${esc(this.mySkill.desc || '')}`, 3200);
      }
    });
    this.pet = { hasPet: false, auto: true, armed: false, ready: false, canCast: false, canArm: false, castsLeft: null, pct: 0, busy: false };
    this.el.petUlt.addEventListener('click', (e) => {
      const ps = this.pet;
      // AUTO chip → toggle Auto / Manual (saved per account)
      if (e.target.closest('.mono-pet-auto-chip')) {
        if (!ps.hasPet) return;
        ps.auto = !ps.auto;
        this.renderPetOrb();
        this.h.onPetToggleAuto?.(ps.auto);
        this.ticker(ps.auto ? '🐾 <b>AUTO</b>: your pet joins every Ultimate as a 🔗 Soul-Link Combo' : '🐾 <b>MANUAL</b>: tap the orb to 🔗 link your pet, tap again to cast solo', 2600);
        return;
      }
      const name = this.myPetSkill ? esc(this.myPetSkill.name) : 'Soul-Link';
      if (!ps.hasPet) { this.ticker('🐾 <b>Pet Soul-Link</b>: equip a companion in the Pet Sanctuary to fight beside you!', 3200); return; }
      if (ps.castsLeft === 0) { this.ticker('🐾 Your pet has used all its casts this match — rest up! 💤', 2400); return; }
      if (!ps.ready) { this.ticker(`🐾 <b>${name}</b>: charging (${ps.pct}%)… When full it joins your Ultimate as a 🔗 Soul-Link Combo (+15%)`, 3200); return; }
      if (!ps.auto && !ps.armed && ps.canArm) {           // Manual: 1st tap = link
        ps.armed = true; this.renderPetOrb(); this.h.onPetArm?.(true);
        this.ticker('🔗 <b>Linked!</b> Cast your Ultimate for a Soul-Link Combo — or tap again to cast solo', 2800);
        return;
      }
      if (ps.canCast && !ps.busy) { this.h.onPetCast?.(); return; }   // solo cast (your turn, before rolling)
      if (!ps.auto && ps.armed) { ps.armed = false; this.renderPetOrb(); this.h.onPetArm?.(false); this.ticker('🐾 Link released', 1400); return; }
      this.ticker('🐾 Pet is full — it joins your next Ultimate 🔗 (solo cast: on your turn before rolling)', 2600);
    });
    this.el.cam.addEventListener('click', () => this.h.onCam?.());
    $('.mono-exit').addEventListener('click', () => this.h.onExit?.());
    this.el.themeBtn?.addEventListener('click', () => {
      const next = juiceBus.board?.cycleLandscapeTheme?.();
      if (next) this.ticker(`<b>${esc(next.label)}</b> Courtyard`, 2000);
    });
    if (juiceBus.board?.currentTheme) this.setThemeLabel(juiceBus.board.currentTheme);
    this.el.mute.addEventListener('click', () => { const m = this.h.onMute?.(); this.el.mute.textContent = m ? '🔇' : '🔊'; });
  }

  setThemeLabel(theme) {
    if (!this.el?.themeBtn || !theme) return;
    const icon = String(theme.label || '🌿').split(' ')[0] || '🌿';
    this.el.themeBtn.textContent = icon;
    this.el.themeBtn.title = `Courtyard Theme: ${theme.label || theme.key} (tap to rotate)`;
  }

  /** Smooth Match Intro & 100% Ready Theme Reveal banner on Round 1 start. */
  showMatchIntro({ theme, players = [], yourSeat = 0, chaos = false, maxRounds = MONO.MAX_ROUNDS } = {}) {
    const el = this.el?.intro;
    if (!el) return;
    cancelAnimationFrame(this._introRaf);
    clearTimeout(this._introHideT);
    if (typeof document !== 'undefined') {
      document.querySelectorAll('#toast, .toast, .s2-toast, .hud-toast').forEach((t) => { t.hidden = true; t.classList.remove('show', 'visible'); });
    }
    const th = theme || juiceBus.board?.currentTheme || { emoji: '🌿', name: 'Royal Starlight Garden', subtitle: 'Vakarine Shrine • Wishing Fountain • Crystal Brook', accent: '#48b8e8' };
    const rosterHtml = players.map((p, idx) => {
      const seat = p.seat ?? idx;
      const sk = skillFor(p.outfit, p.outfitRarity || 1);
      const pHas = !!(p.hasPet || p.petId || p.petCostume);
      return `
        <div class="mono-intro-pcard" style="--seat:${SEAT_COLORS[seat % 4]}">
          <div class="mono-intro-pava" style="background-image:${portraitBgCss(p.lineage, p)}">
            <span class="mono-intro-ptag">P${seat + 1}</span>
            ${pHas ? '<span class="mono-intro-ppet">🐾</span>' : ''}
          </div>
          <div class="mono-intro-pname">${esc(p.name)}${seat === yourSeat ? ' <i>(you)</i>' : ''}${p.isBot ? ' 🤖' : ''}</div>
          <div class="mono-intro-pskill">${sk?.icon || '⚡'} ${esc(sk?.name || 'Ultimate')}</div>
          <div class="mono-intro-pready" data-pready="${seat}">SYNCING…</div>
        </div>`;
    }).join('');
    el.style.setProperty('--theme-accent', th.accent || '#48b8e8');
    el.innerHTML = `
      <div class="mono-intro-card ${chaos ? 'chaos' : ''}">
        <div class="mono-intro-pill">${chaos ? '🎉 CHAOS PARTY MODE' : '✈️ SKY MONOPOLY'} • ${maxRounds} ROUNDS</div>
        <div class="mono-intro-theme">
          <div class="mono-intro-emoji">${th.emoji || '🌿'}</div>
          <div class="mono-intro-tmeta">
            <div class="mono-intro-tkicker">COURTYARD REALM THEME</div>
            <div class="mono-intro-tname">${esc(th.name || 'Royal Starlight Garden')}</div>
            <div class="mono-intro-tsub">${esc(th.subtitle || 'Vakarine Shrine • Wishing Fountain • Crystal Brook')}</div>
          </div>
        </div>
        <div class="mono-intro-roster">${rosterHtml}</div>
        <div class="mono-intro-prog-wrap">
          <div class="mono-intro-prog-head">
            <span class="mono-intro-prog-status">✨ Syncing Sky Island &amp; 4 Tycoons…</span>
            <b class="mono-intro-prog-pct">28%</b>
          </div>
          <div class="mono-intro-prog-bar"><span class="mono-intro-prog-fill" style="width:28%"></span></div>
        </div>
      </div>`;
    el.hidden = false;
    el.classList.remove('closing', 'ready');
    void el.offsetWidth;
    el.classList.add('open');

    const fillEl = el.querySelector('.mono-intro-prog-fill');
    const pctEl = el.querySelector('.mono-intro-prog-pct');
    const statusEl = el.querySelector('.mono-intro-prog-status');
    const readyBadges = [...el.querySelectorAll('.mono-intro-pready')];
    const t0 = performance.now();
    const fillDur = 540;
    let markedReady = false;

    const step = (now) => {
      const elapsed = now - t0;
      const timeK = Math.min(1, elapsed / fillDur);
      const easeK = 1 - Math.pow(1 - timeK, 3);
      const texRatio = juiceBus.board?.getThemeLoadProgress?.(th) ?? 1;
      // Blend actual texture readiness with smooth time curve (never stalls past fillDur)
      const pct = timeK >= 1 ? 100 : Math.min(99, Math.round((0.28 + 0.72 * (0.65 * easeK + 0.35 * texRatio)) * 100));
      if (fillEl) fillEl.style.width = `${pct}%`;
      if (pctEl) pctEl.textContent = `${pct}%`;
      readyBadges.forEach((b, idx) => {
        const threshold = 40 + idx * 14;
        if (pct >= threshold && !b.classList.contains('done')) {
          b.classList.add('done');
          b.textContent = '✓ 100%';
        }
      });
      if (pct < 100) {
        this._introRaf = requestAnimationFrame(step);
      } else if (!markedReady) {
        markedReady = true;
        el.classList.add('ready');
        if (statusEl) statusEl.innerHTML = '🎲 <b>ALL PLAYERS 100% READY — LET&#39;S ROLL!</b>';
        this._introHideT = setTimeout(() => this.hideMatchIntro(), 460);
      }
    };
    this._introRaf = requestAnimationFrame(step);
  }

  hideMatchIntro() {
    const el = this.el?.intro;
    if (!el || el.hidden || el.classList.contains('closing')) return;
    cancelAnimationFrame(this._introRaf);
    clearTimeout(this._introHideT);
    el.classList.add('closing');
    this._introHideT = setTimeout(() => {
      el.hidden = true;
      el.classList.remove('open', 'closing', 'ready');
    }, 340);
  }

  show(on = true) { this.root.hidden = !on; if (!on) this.hideMatchIntro(); }
  destroy() {
    cancelAnimationFrame(this._introRaf);
    clearTimeout(this._introHideT);
    if (juiceBus.hud === this) juiceBus.hud = null;
    this.root.remove();
    clearInterval(this.timer);
  }

  // ------------------------------------------------------------------------- cards
  setPlayers(players, yourSeat) {
    this.players = players;
    this.yourSeat = yourSeat;
    this._cashShown.clear();
    const me = players[yourSeat] || players[0];
    const myDiceSkin = me?.diceSkin || me?.equipped?.dice?.id || null;
    const rollFace = this.root.querySelector('.mono-roll-face');
    if (rollFace) {
      rollFace.innerHTML = myDiceSkin
        ? `<img src="/assets/ui/${esc(myDiceSkin)}.png" alt="🎲" style="width:24px;height:24px;object-fit:contain;vertical-align:middle;" />`
        : '🎲';
    }
    this.mySkill = me ? skillFor(me.outfit, me.outfitRarity || 1) : null;
    if (this.mySkill) {
      this.el.ultIco.textContent = this.mySkill.icon || '⚡';
      this.el.ultSub.textContent = this.mySkill.name;
      this.el.ult.title = `${this.mySkill.icon} ${this.mySkill.name} — ${this.mySkill.desc || ''}`;
    }
    const hasPet = !!(me?.hasPet || me?.petId || me?.petCostume || me?.equipped?.pet?.id);
    const petCid = me?.petCostume || me?.equipped?.pet?.costume_id || null;
    this.myPetSkill = hasPet
      ? (petCid ? skillFor(petCid, me?.petCostumeRarity || (petCid.startsWith('s') ? 3 : 1)) : GENERIC_SKILLS[1])
      : null;
    this.pet.hasPet = hasPet;
    this.pet.auto = me?.petAuto !== false;
    this.pet.armed = !!me?.petArmed;
    if (hasPet && this.myPetSkill) {
      this.el.petUlt.classList.remove('unlinked');
      this.el.petUltIco.textContent = this.myPetSkill.icon || '🐾';
      this.el.petUltSub.textContent = `🐾 ${this.myPetSkill.name}`;
      const ratePct = Math.round((me?.petRate || 0.55) * 100);
      const potPct = Math.round((me?.petPotency || 0.30) * 100);
      this.el.petUlt.title = `🐾 Pet Soul-Link (Lv.${me?.petBond || 1}): ${this.myPetSkill.icon} ${this.myPetSkill.name} (${ratePct}% Charge • ${potPct}% Echo) — ${this.myPetSkill.desc || ''}`;
    } else {
      this.el.petUlt.classList.add('unlinked');
      this.el.petUltIco.textContent = '🐾';
      this.el.petUltSub.textContent = 'No Companion';
      this.el.petUltPct.textContent = '—';
      this.el.petUlt.title = 'Equip a companion in Pet Sanctuary to unlock Pet Soul-Link Combos from Bond Lv. 1!';
    }
    this.renderPetOrb();
    this.el.cards.innerHTML = players.map((p) => {
      const sk = skillFor(p.outfit, p.outfitRarity || 1);
      const pHas = !!(p.hasPet || p.petId || p.petCostume);
      const pSk = pHas ? (p.petCostume ? skillFor(p.petCostume, p.petCostumeRarity || 3) : GENERIC_SKILLS[1]) : null;
      this._cashShown.set(p.seat, p.cash || 0);
      return `
      <div class="mono-card mono-pcard" data-seat="${p.seat}" style="--seat:${SEAT_COLORS[p.seat % 4]}" title="${esc(`${p.name}: ${sk.icon} ${sk.name} — ${sk.desc || ''}`)}">
        <div class="mono-card-tag">P${p.seat + 1}</div>
        <div class="mono-card-ava-wrap">
          <div class="mono-card-ava" style="background-image:${portraitBgCss(p.lineage, p)}"></div>
          ${pHas ? `<span class="mono-card-pet-pip" title="${pSk ? esc(`🐾 ${pSk.name}`) : '🐾 Pet'}">🐾</span>` : ''}
          <div class="mono-card-status"></div>
        </div>
        <div class="mono-card-name">${esc(p.name)}${p.seat === yourSeat ? ' <i>(you)</i>' : ''}${p.isBot ? ' 🤖' : ''}</div>
        <div class="mono-card-row">🪙 <b class="cash">${fmt(p.cash)}</b></div>
        <div class="mono-card-row">👑 <b class="nw">${fmt(p.cash)}</b></div>
        <div class="mono-card-ult" title="Owner Ultimate (${esc(sk.name)})"><span></span></div>
        <div class="mono-card-pet-ult" ${pHas ? '' : 'hidden'} title="${pSk ? esc(`🐾 Pet Soul-Link: ${pSk.name}`) : ''}"><span></span></div>
      </div>`;
    }).join('');
  }

  renderPetOrb() {
    const ps = this.pet;
    const chip = this.el.petAuto;
    if (chip) {
      chip.classList.toggle('on', !!ps.auto);
      chip.setAttribute('aria-checked', ps.auto ? 'true' : 'false');
      chip.textContent = ps.auto ? 'AUTO' : (ps.armed ? '🔗 LINKED' : 'MANUAL');
    }
    this.el.petUlt.classList.toggle('unlinked', !ps.hasPet);
    this.el.petUlt.classList.toggle('ready', !!(ps.hasPet && ps.ready && ps.castsLeft !== 0));
    this.el.petUlt.classList.toggle('armed', !!(ps.hasPet && (ps.auto ? ps.ready : ps.armed)));
    this.el.petUlt.classList.toggle('capped', ps.castsLeft === 0);
    if (this.el.petUltFill) this.el.petUltFill.style.height = `${ps.hasPet ? ps.pct : 0}%`;
    if (this.el.petUltPct) {
      this.el.petUltPct.textContent = !ps.hasPet ? '—' : ps.castsLeft === 0 ? 'MAX' : (!ps.auto && ps.armed) ? '🔗' : `${ps.pct}%`;
    }
  }

  /** Smoothly rolls a player card's cash number from its previous value to `target`. */
  _rollCash(el, seat, target) {
    if (!el) return;
    const prev = this._cashShown.get(seat) ?? target;
    this._cashShown.set(seat, target);
    if (prev === target) { el.textContent = fmt(target); return; }
    const start = performance.now(), dur = 420;
    const tick = (now) => {
      const k = Math.min(1, (now - start) / dur);
      const ease = 1 - Math.pow(1 - k, 3);
      el.textContent = fmt(prev + (target - prev) * ease);
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  updateCards(scores, turnSeat, players = this.players) {
    for (const s of scores) {
      const c = this.el.cards.querySelector(`[data-seat="${s.seat}"]`);
      if (!c) continue;
      this._rollCash(c.querySelector('.cash'), s.seat, s.cash);
      c.querySelector('.nw').textContent = fmt(s.netWorth);
      c.querySelector('.mono-card-ult span').style.width = `${Math.min(100, s.ult)}%`;
      const p = players?.[s.seat];
      const petUltVal = s.petUlt ?? p?.petUlt ?? 0;
      const petBar = c.querySelector('.mono-card-pet-ult');
      if (petBar) {
        const hasPetLink = Boolean(s.hasPet || p?.hasPet || s.petCostume || p?.petCostume);
        petBar.hidden = !hasPetLink;
        if (hasPetLink) petBar.querySelector('span').style.width = `${Math.min(100, petUltVal)}%`;
      }
      c.classList.toggle('turn', s.seat === turnSeat);
      c.classList.toggle('bankrupt', !!s.bankrupt);
      c.classList.toggle('ult-ready', s.ult >= 100);
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

  setRound(round, max, chaos = false) {
    this.el.round.textContent = `${chaos ? '🎉 Chaos ' : ''}Round ${Math.min(round, max)} / ${max}`;
  }

  // ------------------------------------------------------------------------- controls
  setControls({ myTurn, canRoll, can2d6, boost, canUlt, ult, petUlt, petCostume, hasPet, petReady, canPetCast, canPetArm, petAuto, petArmed, petCastsLeft, busy, waitingName, deadline, fixedRoll }) {
    const enabled = canRoll && !busy;
    this.el.roll.disabled = !enabled;
    this.el.roll.classList.toggle('pulse', enabled);
    this.el.boost.textContent = `×${boost ?? 0}`;
    const b2 = this.el.toggle.querySelector('[data-d="2"]');
    b2.disabled = !can2d6;
    if (!can2d6 && this.use2d6) { this.use2d6 = false; this.el.toggle.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x.dataset.d === '1')); }
    this.el.ult.disabled = !(canUlt && !busy);
    this.el.ult.classList.toggle('ready', !!canUlt && !busy);
    const ultPctVal = Math.min(100, Math.round(ult || 0));
    this.el.ultFill.style.height = `${ultPctVal}%`;
    if (this.el.ultPct) this.el.ultPct.textContent = `${ultPctVal}%`;
    const pHas = hasPet != null ? !!hasPet : Boolean(petCostume || this.pet.hasPet);
    const pPct = pHas ? Math.min(100, Math.round(petUlt || 0)) : 0;
    Object.assign(this.pet, {
      hasPet: pHas,
      pct: pPct,
      ready: petReady != null ? !!petReady : pPct >= 100,
      canCast: !!canPetCast,
      canArm: canPetArm != null ? !!canPetArm : pHas,
      auto: petAuto != null ? !!petAuto : this.pet.auto,
      armed: petArmed != null ? !!petArmed : this.pet.armed,
      castsLeft: petCastsLeft !== undefined ? petCastsLeft : this.pet.castsLeft,
      busy: !!busy,
    });
    this.renderPetOrb();
    this.deadline = deadline || null;
    clearInterval(this.timer);
    const hint = () => {
      const comboReady = myTurn && canUlt && this.pet.ready && (this.pet.auto || this.pet.armed);
      let t = myTurn
        ? (fixedRoll ? `🌙 Sleepwalk — you will move exactly ${fixedRoll}` : comboReady ? '🔗 Soul-Link Combo ready! Tap ULTIMATE or Roll 🎲' : 'Your turn! Roll the dice 🎲')
        : waitingName ? `⏳ ${esc(waitingName)} is playing…` : '';
      if (busy) t = '';
      if (myTurn && this.deadline && !busy) { const s = Math.max(0, Math.ceil((this.deadline - Date.now()) / 1000)); t += ` <b class="mono-timer">${s}s</b>`; }
      this.el.hint.innerHTML = t;
    };
    hint();
    if (myTurn && this.deadline) this.timer = setInterval(hint, 500);
  }

  setCamLabel(mode) { this.el.cam.querySelector('span').textContent = mode === 'follow' ? 'Follow' : 'Overview'; }

  // ------------------------------------------------------------------------- transient fx & juiceBus hooks
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

  /** Fly coin / diamond icons from a board screen position into a player's top card. */
  flyIcons(seat, icon = '🪙', count = 4, fromPos = null, { delay = 0 } = {}) {
    const card = this.el.cards.querySelector(`[data-seat="${seat}"]`);
    if (!card) return;
    const r = this.root.getBoundingClientRect();
    const cr = card.getBoundingClientRect();
    const sx = (fromPos?.x ?? (r.left + r.width / 2)) - r.left;
    const sy = (fromPos?.y ?? (r.top + r.height / 2)) - r.top;
    const tx = cr.left + cr.width / 2 - r.left;
    const ty = cr.top + cr.height / 2 - r.top;
    const n = Math.min(8, Math.max(1, count | 0));
    for (let i = 0; i < n; i++) {
      setTimeout(() => {
        const sp = document.createElement('span');
        sp.className = 'mono-fly-ico';
        sp.textContent = icon;
        sp.style.left = `${sx + (Math.random() - 0.5) * 24}px`;
        sp.style.top = `${sy + (Math.random() - 0.5) * 18}px`;
        sp.style.setProperty('--dx', `${tx - sx}px`);
        sp.style.setProperty('--dy', `${ty - sy}px`);
        this.el.floats.appendChild(sp);
        setTimeout(() => { sp.remove(); this.bumpCash(seat, 1); }, 560);
      }, delay + i * 55);
    }
  }

  tension(on = true) { this.root.classList.toggle('mono-tension', !!on); }
  heartbeat() {
    this.root.classList.remove('mono-hb');
    void this.root.offsetWidth;
    this.root.classList.add('mono-hb');
  }

  confetti(count = 36) {
    const colors = ['#ffd86b', '#ff5a7a', '#3d8bfd', '#2fbf71', '#d946ef', '#38bdf8'];
    for (let i = 0; i < count; i++) {
      const c = document.createElement('span');
      c.className = 'mono-confetti';
      c.style.left = `${Math.random() * 100}%`;
      c.style.background = colors[i % colors.length];
      c.style.animationDelay = `${Math.random() * 0.45}s`;
      c.style.setProperty('--drift', `${(Math.random() - 0.5) * 90}px`);
      this.el.floats.appendChild(c);
      setTimeout(() => c.remove(), 2400);
    }
  }

  chaosBanner(kind, ev = {}) {
    const meta = {
      meteor: ['☄️ CHAOS EVENT: METEOR RAIN!', `Meteors struck ${ev.hits?.length || 0} buildings!`],
      rent_x2: ['🔥 CHAOS EVENT: DOUBLE RENT ZONE!', `${ZONES[ev.zone]?.name || 'Zone'} rent is 2× this round!`],
      swap: ['🌀 CHAOS EVENT: POSITION SWAP!', 'Two tycoons swapped places on the board!'],
      gold_rain: ['🪙 CHAOS EVENT: SKY GOLD RAIN!', `Everyone receives +🪙 ${fmt(ev.amount || 300)}!`],
    }[kind] || ['🎉 CHAOS PARTY EVENT!', 'Expect the unexpected!'];
    this.ticker(`<b>${meta[0]}</b> — ${meta[1]}`, 3000);
  }

  /** Diagonal split Chibi + Pet cut-in with 🔗 SOUL-LINK COMBO ribbon. */
  comboCutin({ name, icon, caster, petId = null, petCostume = null, bonus = 0.15, chaos = false, fast = false }) {
    const el = this.el.cutin;
    const petSpr = resolvePetSpriteKey(petId || caster?.petId || 'pet_ragdoll', 3, 'cast');
    const petPortrait = `/assets/pets/${petSpr}.png`;
    const ownerPortrait = portraitUrl(caster?.lineage, caster || { outfit: petCostume });
    const bonusPct = Math.round((bonus || (chaos ? 0.30 : 0.15)) * 100);
    const dur = fast ? 750 : 1450;
    el.innerHTML = `
      <div class="mono-cutin-band combo-split ${chaos ? 'chaos' : ''}">
        <div class="mono-combo-half owner"><div class="mono-cutin-face" style="background-image:url(${ownerPortrait})"></div></div>
        <div class="mono-combo-ribbon">🔗 SOUL-LINK COMBO +${bonusPct}%</div>
        <div class="mono-combo-half pet"><div class="mono-cutin-face" style="background-image:url(${petPortrait});background-size:115% auto;background-position:50% 45%;"></div></div>
        <div class="mono-cutin-name">${icon || '⚡'} ${esc(name || 'Soul-Link Surge')}</div>
        <div class="mono-cutin-who">${esc(caster?.name || 'Tycoon')} &amp; 🐾 ${esc(caster?.equipped?.pet?.nickname || 'Companion')}</div>
      </div>`;
    el.hidden = false;
    el.classList.remove('play'); void el.offsetWidth; el.classList.add('play');
    return new Promise((res) => setTimeout(() => { el.hidden = true; res(); }, dur));
  }

  /** 1.2 s anime hero cut-in banner; dual Couple Finisher banner or Pet Soul-Link banner. */
  cutIn({ title, name, icon, caster, partner = null, finisher = false, byPet = false, petId = null, petCostume = null, fast = false, repeat = false }) {
    const el = this.el.cutin;
    const petSpr = byPet ? resolvePetSpriteKey(petId || caster?.petId || 'pet_ragdoll', 2, 'cast') : null;
    const petPortrait = petSpr ? `/assets/pets/${petSpr}.png` : portraitUrl(caster?.lineage, caster);
    const linkedPortrait = petCostume ? portraitUrl(caster?.lineage, { lineage: caster?.lineage, outfit: petCostume }) : null;
    const dur = fast ? 650 : repeat ? 850 : 1250;
    el.innerHTML = `
      <div class="mono-cutin-band ${partner ? 'couple' : ''} ${byPet ? 'pet-ult' : ''}">
        <div class="mono-cutin-title">${icon || '⚡'} ${esc(title || (byPet ? '🐾 PET SOUL-LINK ULTIMATE' : 'MYTHIC ULTIMATE'))}${partner ? ' • 💞 COUPLE SYNERGY +15%' : ''}${byPet ? ' • SOUL-ECHO' : ''}</div>
        <div class="mono-cutin-faces">
          <div class="mono-cutin-face" style="background-image:url(${byPet ? petPortrait : portraitUrl(caster?.lineage, caster)});${byPet ? 'background-size:115% auto;background-position:50% 45%;' : ''}"></div>
          ${byPet && linkedPortrait ? `<div class="mono-cutin-face" style="background-image:url(${linkedPortrait})"></div>` : ''}
          ${partner ? `<div class="mono-cutin-face" style="background-image:url(${portraitUrl(partner.lineage, partner)})"></div>` : ''}
        </div>
        <div class="mono-cutin-name">${esc(name)}${finisher ? '<br><span class="strike">BANKRUPTCY STRIKE!</span>' : ''}</div>
        <div class="mono-cutin-who">${byPet ? `🐾 ${esc(caster?.equipped?.pet?.nickname || caster?.name || 'Companion')} (${esc(caster?.name || '')})` : `${esc(caster?.name || '')}${partner ? ` &amp; ${esc(partner.name)}` : ''}`}</div>
      </div>`;
    el.hidden = false;
    el.classList.remove('play'); void el.offsetWidth; el.classList.add('play');
    return new Promise((res) => setTimeout(() => { el.hidden = true; res(); }, dur));
  }

  // ------------------------------------------------------------------------- decisions
  showDecision(pd, m, seat) {
    const s = this.el.sheet;
    const p = m.players[seat];
    const tile = pd.tile != null ? TILES[pd.tile] : null;
    const zone = tile?.zone ? ZONES[tile.zone] : null;
    const btn = (id, label, cls = 'gold', disabled = false) => `<button class="mono-btn ${cls}" data-choice="${esc(id)}" ${disabled ? 'disabled' : ''}>${label}</button>`;
    let body = '', actions = '';
    // Real rent the tile would charge at tier `l` if `ownerSeat` owned it (colour set, home turf, mods, tile buffs/traps).
    const realRent = (l, ownerSeat) => {
      try {
        const tiles = m.tiles.map((t, j) => (j === pd.tile ? { ...t, owner: ownerSeat, level: l } : t));
        return rentFor({ tiles, players: m.players }, pd.tile);
      } catch { return Math.round(tile.price * MONO.RENT_MULT[l]); }
    };
    const rentRow = (lvl, ownerSeat = seat) => {
      if (!tile || tile.kind !== 'property') return '';
      const rows = [0, 1, 2, 3].map((l) => `<span class="${l === lvl ? 'cur' : ''}">${TIER_NAME[l].replace(/^[^ ]+ /, '')}</span><b class="${l === lvl ? 'cur' : ''}">🪙 ${fmt(realRent(l, ownerSeat))}</b>`).join('');
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
      case 'takeover': {
        const lvl = m.tiles[pd.tile]?.level ?? 0;
        const paid = pd.rentPaid > 0
          ? `<div class="mono-note">✅ Rent paid: 🪙 ${fmt(pd.rentPaid)} to <b>${esc(m.players[pd.from]?.name)}</b></div>`
          : `<div class="mono-note">✅ No rent owed this time</div>`;
        body = `${head}${paid}<div class="mono-note big">⚔️ Optional: Hostile Takeover</div><div class="mono-note">Pay 2× its invested value — ${esc(m.players[pd.from]?.name)} receives the cash. Rent you'd earn here:</div>${rentRow(lvl, seat)}`;
        actions = btn('takeover', `⚔️ Seize for 🪙 ${fmt(pd.cost)}`, 'red', p.cash < pd.cost) + btn('skip', '👣 Keep walking', 'plain');
        break;
      }
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
  showPodium({ result, rewards, players, yourSeat, finisherName = null, solo = false, highlights = null }) {
    const el = this.el.podium;
    const rank = result.ranking;
    const hl = highlights || result?.highlights || {};
    const pillar = (r, cls) => {
      if (!r) return '<div class="mono-pillar empty"></div>';
      const p = players[r.seat];
      const petId = p?.petId || p?.equipped?.pet?.id || null;
      const petSpr = petId ? `/assets/pets/${resolvePetSpriteKey(petId, 1, 'front')}.png` : null;
      return `<div class="mono-pillar ${cls}" style="--seat:${SEAT_COLORS[r.seat % 4]}">
        <div class="mono-pillar-stage">
          <div class="mono-pillar-ava" style="background-image:${portraitBgCss(p?.lineage, p)}"></div>
          ${petSpr ? `<img class="mono-pillar-pet" src="${petSpr}" alt="" />` : ''}
          ${r.rank === 1 ? '<span class="mono-pillar-trophy">🏆</span>' : ''}
        </div>
        <div class="mono-pillar-block">
          <div class="mono-pillar-rank">${r.rank}</div>
          <div class="mono-pillar-name">${r.rank === 1 ? '👑 ' : ''}${esc(r.name)}</div>
          <div class="mono-pillar-nw">👑 ${fmt(r.netWorth)}</div>
          ${r.rank === 1 ? '<div class="mono-pillar-ribbon">👑 VICTORY!</div>' : ''}
        </div>
      </div>`;
    };
    const mine = rank.find((r) => r.seat === yourSeat);
    const rw = rewards || (mine ? { gold: PODIUM.GOLD[mine.rank - 1], berries: PODIUM.BERRIES[mine.rank - 1], diamonds: PODIUM.DIAMONDS[mine.rank - 1] + (mine.boardDiamonds || 0), podiumDiamonds: PODIUM.DIAMONDS[mine.rank - 1], boardDiamonds: mine.boardDiamonds || 0, exp: PODIUM.EXP[mine.rank - 1], levelsGained: 0, levelUpDiamonds: 0, preview: true } : null);
    const reason = { rounds: `🏁 ${result.rounds} rounds complete — ranked by 👑 Net Worth`, last_standing: '💥 Last tycoon standing!', finisher: '⚡ MYTHIC FINISHER — BANKRUPTCY STRIKE!' }[result.reason] || '';
    const diamondParts = [];
    if (rw?.podiumDiamonds) diamondParts.push(`${rw.podiumDiamonds} Podium${rw.chaos ? ' ×0.5 Chaos' : ''}`);
    if (rw?.dailyBonusDiamonds) diamondParts.push(`+${rw.dailyBonusDiamonds} Daily 1st`);
    if (rw?.boardDiamonds) diamondParts.push(`+${rw.boardDiamonds} Board`);
    if (rw?.levelUpDiamonds) diamondParts.push(`+${rw.levelUpDiamonds} Level-Up`);
    const expVal = rw?.exp ?? (mine ? PODIUM.EXP[mine.rank - 1] : 0);
    const lvUp = rw?.levelsGained || 0;
    const chestImg = rw?.chestReward === 'ticket_standard' ? '/assets/ui/item_ticket_standard.png' : '/assets/ui/item_dupe_box.png';

    // Moments of the Match strip (up to 3 cards)
    const momentCards = [];
    if (hl.bigRent && hl.bigRent.amount > 0) {
      const payer = players[hl.bigRent.seat]?.name || `Player ${hl.bigRent.seat + 1}`;
      const owner = players[hl.bigRent.owner]?.name || `Player ${hl.bigRent.owner + 1}`;
      momentCards.push({
        key: 'bigRent',
        emoji: '💸',
        label: 'Biggest Rent',
        val: `🪙 ${fmt(hl.bigRent.amount)}`,
        sub: `${esc(payer)} → ${esc(owner)}`,
      });
    }
    if (hl.bigTakeover && hl.bigTakeover.cost > 0) {
      const seizer = players[hl.bigTakeover.seat]?.name || `Player ${hl.bigTakeover.seat + 1}`;
      const from = players[hl.bigTakeover.from]?.name || `Player ${hl.bigTakeover.from + 1}`;
      momentCards.push({
        key: 'takeover',
        emoji: '⚔️',
        label: 'Boldest Takeover',
        val: `🪙 ${fmt(hl.bigTakeover.cost)}`,
        sub: `${esc(seizer)} from ${esc(from)}`,
      });
    }
    if (Array.isArray(hl.rentEarned)) {
      let maxRent = 0, landlordSeat = -1;
      hl.rentEarned.forEach((amt, s) => {
        if (amt > maxRent) { maxRent = amt; landlordSeat = s; }
      });
      if (maxRent > 0 && landlordSeat >= 0) {
        const name = players[landlordSeat]?.name || `Player ${landlordSeat + 1}`;
        momentCards.push({
          key: 'landlord',
          emoji: '🏰',
          label: 'Top Landlord',
          val: `🪙 ${fmt(maxRent)}`,
          sub: esc(name),
        });
      }
    }
    if (Array.isArray(hl.ults)) {
      let maxUlts = 0, ultMasterSeat = -1;
      hl.ults.forEach((count, s) => {
        if (count > maxUlts) { maxUlts = count; ultMasterSeat = s; }
      });
      if (maxUlts >= 2 && ultMasterSeat >= 0) {
        const name = players[ultMasterSeat]?.name || `Player ${ultMasterSeat + 1}`;
        momentCards.push({
          key: 'ultMaster',
          emoji: '✨',
          label: 'Ult Master',
          val: `${maxUlts} Ults`,
          sub: esc(name),
        });
      }
    }
    const chosenMoments = momentCards.slice(0, 3);
    const momentsHtml = chosenMoments.length ? `
      <div class="mono-moments">
        <div class="mono-moments-title">✨ Moments of the Match</div>
        <div class="mono-moments-grid">
          ${chosenMoments.map((m) => `
            <div class="mono-moment-card">
              <div class="mono-moment-header">
                <span class="mono-moment-icon" data-icon="${m.key}">
                  <img src="/assets/ui/moments/${m.key}.png" class="mono-moment-img" alt="" onerror="this.style.display='none';if(this.nextElementSibling)this.nextElementSibling.style.display='inline-block';" onload="this.style.display='inline-block';if(this.nextElementSibling)this.nextElementSibling.style.display='none';" style="display:none;" />
                  <span class="mono-moment-emoji">${m.emoji}</span>
                </span>
                <span class="mono-moment-label">${m.label}</span>
              </div>
              <div class="mono-moment-val">${m.val}</div>
              <div class="mono-moment-sub">${m.sub}</div>
            </div>
          `).join('')}
        </div>
      </div>` : '';

    el.innerHTML = `
      ${result.reason === 'finisher' ? `<div class="mono-finisher">⚡ MYTHIC FINISHER${finisherName ? `: ${esc(finisherName)}` : ''}<br><b>BANKRUPTCY STRIKE!</b></div>` : ''}
      <div class="mono-podium-title">${mine?.rank === 1 ? '👑 VICTORY!' : mine ? `You placed #${mine.rank}` : 'Match Over'}</div>
      <div class="mono-podium-reason">${reason}</div>
      <div class="mono-pillars">${pillar(rank[1], 'second')}${pillar(rank[0], 'first')}${pillar(rank[2], 'third')}${pillar(rank[3], 'fourth')}</div>
      ${momentsHtml}
      ${rw ? `<div class="mono-rewards">
        <div class="mono-rewards-title">🏆 ${mine?.rank === 1 ? 'VICTORY' : 'MATCH'} REWARDS ${rw.chaos ? '<i>(🎉 Chaos Party • 0.5× 💎 • Free Cap)</i> ' : ''}${rw.tableScale ? `<i>(Table ${Number(rw.tableScale).toFixed(2)}×${rw.coupleBonus ? ' • 💞 Couple' : ''})</i>` : ''}${rw.preview ? ' <i>(preview)</i>' : ''}</div>
        <div class="mono-rewards-body">
          <div class="mono-rewards-list">
            ${rw.diamonds ? `<div class="mono-reward-row">✨ <b>+${fmt(rw.diamonds)}</b> 💎 Diamonds ${diamondParts.length > 1 ? `<small>(${diamondParts.join(' ')})</small>` : ''}</div>` : ''}
            <div class="mono-reward-row">🪙 <b>+${fmt(rw.gold)}</b> Gold &amp; 🍓 <b>+${fmt(rw.berries)}</b> Star-Berries${rw.multiplier ? ` <i>(${rw.multiplier}x Multiplier)</i>` : ''}</div>
            ${expVal ? `<div class="mono-reward-row mono-exp-row">⭐ <b>+${fmt(expVal)} EXP</b> <span class="mono-exp-bar"><span class="mono-exp-fill" style="width:${lvUp ? 100 : 78}%"></span></span>${lvUp ? ` <b class="mono-lvup-badge">🎉 LEVEL UP +${lvUp}!${rw.levelUpDiamonds ? ` (+${rw.levelUpDiamonds} 💎)` : ''}</b>` : ''}</div>` : ''}
            ${rw.ticketBonus ? `<div class="mono-reward-row">🎟️ <b>+${rw.ticketBonus} Standard Gacha Ticket</b> (Daily 1st Match!)</div>` : ''}
            ${rw.chest ? `<div class="mono-reward-row">🎁 Bonus Podium Chest: <b>${rw.chestReward === 'ticket_standard' ? '🎟️ Standard Gacha Ticket!' : '📦 Random Dupe Box!'}</b></div>` : ''}
          </div>
          <div class="mono-rewards-chest ${rw.chest ? 'won' : ''}">
            <img src="${chestImg}" alt="Couture Chest" />
            <span>${rw.chest ? (rw.chestReward === 'ticket_standard' ? '🎟️ Gacha Ticket!' : '🎁 Couture Box!') : '🎁 Couture Chest'}</span>
          </div>
        </div>
      </div>` : ''}
      <div class="mono-podium-actions">
        <button class="mono-btn wood" data-act="exit">🏛️ Town Hall / Village</button>
        <button class="mono-btn gold" data-act="again">🔄 Play Again<small>(Keep 4-Seat Table!)</small></button>
      </div>`;
    el.hidden = false;
    this.tension(false);
    if (!mine || mine.rank <= 3) this.confetti(mine?.rank === 1 ? 48 : 28);
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
