/**
 * Nook Airline — Daily Flight Log 🔥 (client)
 * Header streak chip · Daily hub (couple streak, together-time, quests, bonus chest)
 * Streak celebration · reward toasts · diamonds that fly into your wallet
 *
 * The server owns every number (server_daily.js). This file only displays them and
 * sends intents: vault_call_tick / vault_quest_claim / vault_bonus_claim.
 */
(function () {
  const R = window.NookRewards;
  if (!R) { console.warn('[Daily] rewards.js missing'); return; }
  const D = R.DAILY;

  const $ = (id) => document.getElementById(id);
  const fmt = (n) => Number(n || 0).toLocaleString();
  const myRole = () => window.myTerminal || (window.getTerminalRole ? window.getTerminalRole() : 'bkk');
  const partnerRole = () => (myRole() === 'bkk' ? 'dxb' : 'bkk');
  const V = () => window.NookVault;
  const profiles = () => (V() && V().getProfiles ? V().getProfiles() : null);
  const me = () => { const p = profiles(); return p ? p[myRole()] : null; };
  const couple = () => { const p = profiles(); return (p && p.couple) || { streak: 0, best: 0, lastDay: '', freezes: 0, checkins: {}, history: [] }; };
  const send = (msg) => { if (typeof window.sendSignaling === 'function') window.sendSignaling(msg); };
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const S = { open: false, celebrating: false, queue: [], claiming: new Set() };

  // ---------------------------------------------------------------------------
  // Tiny WebAudio sounds (no files)
  // ---------------------------------------------------------------------------
  const Sound = (() => {
    let ctx = null;
    const ac = () => {
      if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    };
    function tone(f, t0, dur, type = 'sine', vol = 0.08) {
      const c = ac(); if (!c) return;
      const o = c.createOscillator(); const g = c.createGain();
      const t = c.currentTime + t0;
      o.type = type; o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + 0.05);
    }
    return {
      tap() { tone(760, 0, 0.06, 'triangle', 0.05); },
      claim() { [988, 1319, 1568].forEach((f, i) => tone(f, i * 0.06, 0.22, 'triangle', 0.08)); },
      gem() { tone(1800 + Math.random() * 500, 0, 0.08, 'sine', 0.04); },
      ready() { [784, 1175].forEach((f, i) => tone(f, i * 0.09, 0.25, 'sine', 0.07)); },
      chest() { tone(220, 0, 0.18, 'square', 0.04); [659, 880, 1109, 1319, 1760].forEach((f, i) => tone(f, 0.15 + i * 0.07, 0.4, 'triangle', 0.08)); },
      whoosh() { tone(180, 0, 0.5, 'sawtooth', 0.03); tone(420, 0.1, 0.4, 'sine', 0.05); },
      flame() {
        [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.1, 0.6, 'triangle', 0.08));
        tone(98, 0, 1.2, 'sine', 0.1);
      }
    };
  })();

  const isCoupleActive = () => !!(window.SkySupabase && ((window.SkySupabase.coupleStatus && window.SkySupabase.coupleStatus.isCouple) || (typeof window.SkySupabase.isCouple === 'function' && window.SkySupabase.isCouple())));

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------
  function streakView() {
    const isPair = isCoupleActive();
    const c = couple();
    const today = R.dayKey();
    const ci = c.checkins || {};
    const myCheckin = ci[myRole()] === today;

    // Solo flight: streak is personal checkin status (1 if checked in today, else 0)
    let alive = isPair ? c.streak : (myCheckin ? 1 : 0);
    let risk = '';
    if (!isPair) {
      risk = myCheckin ? 'lit' : 'pending';
    } else {
      const gap = R.daysBetween(c.lastDay, today);
      if (!c.lastDay) alive = 0;
      else if (gap === 0) risk = 'lit';
      else if (gap === 1) risk = 'pending';
      else if (gap === 2 && c.freezes > 0) risk = 'frozen';
      else { alive = 0; risk = 'broken'; }
    }

    return {
      c, today, alive, risk, isPair,
      meIn: myCheckin,
      themIn: isPair ? (ci[partnerRole()] === today) : false,
      next7: alive > 0 ? 7 - (alive % 7 || 7) + (risk === 'lit' ? 0 : 1) : 7
    };
  }

  function questView() {
    const p = me();
    const d = p && p.daily && p.daily.day === R.dayKey() ? p.daily : null;
    if (!d) return { quests: [], ready: 0, allClaimed: false, bonusReady: false, bonusClaimed: false, d: null };
    const quests = d.quests.map((q) => ({ ...q, def: R.QUEST_BY_ID[q.id] })).filter((q) => q.def);
    const ready = quests.filter((q) => !q.claimed && q.progress >= q.def.goal).length;
    const allClaimed = quests.length > 0 && quests.every((q) => q.claimed);
    return { quests, ready, allClaimed, bonusReady: allClaimed && !d.bonusClaimed, bonusClaimed: !!d.bonusClaimed, d };
  }

  function callView() {
    const p = me();
    const d = p && p.daily && p.daily.day === R.dayKey() ? p.daily : { callMin: 0, callPaid: 0 };
    const capped = d.callPaid >= D.CALL_DAILY_CHUNKS;
    const into = d.callMin % D.CALL_CHUNK_MIN;
    const left = capped ? 0 : D.CALL_CHUNK_MIN - into;
    return { min: d.callMin, paid: d.callPaid, capped, into, left, pct: capped ? 100 : (into / D.CALL_CHUNK_MIN) * 100 };
  }

  function callIsLive() {
    try {
      // `peerConnection` / `isCallActive` are top-level in app.js (shared global scope)
      // eslint-disable-next-line no-undef
      return typeof peerConnection !== 'undefined' && !!peerConnection && typeof isCallActive !== 'undefined' && isCallActive
        // eslint-disable-next-line no-undef
        && ['connected', 'completed'].includes(peerConnection.iceConnectionState);
    } catch (e) { return false; }
  }

  function resetIn() {
    const ms = R.msToReset();
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  // ---------------------------------------------------------------------------
  // CSS fire (used in chip, hub and celebration)
  // ---------------------------------------------------------------------------
  function fireHtml(size = '', state = 'lit') {
    return `
      <span class="dly-fire ${size} st-${state}" aria-hidden="true">
        <i class="f-glow"></i>
        <i class="f-outer"></i>
        <i class="f-mid"></i>
        <i class="f-core"></i>
        <i class="f-spark s1"></i><i class="f-spark s2"></i><i class="f-spark s3"></i>
      </span>`;
  }

  // ---------------------------------------------------------------------------
  // Header chip
  // ---------------------------------------------------------------------------
  function mountChip() {
    const header = $('flightHeader');
    if (!header || $('dailyChip')) return;
    let group = header.querySelector('.hdr-right');
    if (!group) {
      group = document.createElement('div');
      group.className = 'hdr-right';
      header.appendChild(group);
    }
    const chip = document.createElement('button');
    chip.id = 'dailyChip';
    chip.className = 'dly-chip';
    chip.title = 'Daily Flight Log — streak, quests & rewards';
    chip.setAttribute('aria-label', 'Open Daily Flight Log');
    chip.innerHTML = `${fireHtml('xs')}<b id="dailyChipNum">0</b><i class="dly-chip-dot" id="dailyChipDot"></i>`;
    chip.addEventListener('click', (e) => { e.stopPropagation(); open(); });
    group.appendChild(chip);
    const pill = $('vaultHeaderPill');
    if (pill) group.appendChild(pill);
  }

  function ensurePillInGroup() {
    const group = document.querySelector('#flightHeader .hdr-right');
    const pill = $('vaultHeaderPill');
    if (group && pill && pill.parentElement !== group) group.appendChild(pill);
  }

  function updateChip() {
    ensurePillInGroup();
    const chip = $('dailyChip');
    if (!chip) return;
    const isPair = isCoupleActive();
    const sv = streakView();
    const qv = questView();
    const num = $('dailyChipNum');
    const n = isPair ? String(sv.alive) : (sv.meIn ? '1' : '0');
    if (num && num.textContent !== n) {
      num.textContent = n;
      chip.classList.remove('bump'); void chip.offsetWidth; chip.classList.add('bump');
    }
    chip.classList.toggle('is-dim', sv.risk !== 'lit');
    chip.classList.toggle('is-frozen', sv.risk === 'frozen');
    if (!isPair) {
      chip.title = sv.meIn ? 'Daily Flight Log — Solo Attendance Active (+20💎 collected)' : 'Daily Flight Log — Check in today for +20💎';
    } else {
      chip.title = 'Daily Flight Log — streak, quests & rewards';
    }
    const fire = chip.querySelector('.dly-fire');
    if (fire) fire.className = `dly-fire xs st-${sv.risk === 'lit' ? 'lit' : sv.risk === 'frozen' ? 'frozen' : 'dim'}`;
    const dot = $('dailyChipDot');
    if (dot) dot.classList.toggle('on', qv.ready > 0 || qv.bonusReady);
    updateCallMini();
  }

  // Tiny "💎 in 7m" badge inside the call timer while you're on a call
  function updateCallMini() {
    const chip = $('callTimerChip');
    if (!chip) return;
    let mini = $('dlyCallMini');
    if (!mini) {
      mini = document.createElement('span');
      mini.id = 'dlyCallMini';
      mini.className = 'dly-call-mini';
      mini.title = `Earn 💎${D.CALL_CHUNK_REWARD} every ${D.CALL_CHUNK_MIN} minutes together`;
      chip.appendChild(mini);
    }
    const cv = callView();
    mini.classList.toggle('maxed', cv.capped);
    mini.innerHTML = cv.capped
      ? '💎 <b>max</b>'
      : `<i class="dly-mini-ring" style="--p:${cv.pct}"></i>💎 <b>${cv.left}m</b>`;
  }

  // ---------------------------------------------------------------------------
  // Hub sheet
  // ---------------------------------------------------------------------------
  function build() {
    if ($('dailySheet')) return;
    const el = document.createElement('div');
    el.id = 'dailySheet';
    el.className = 'dly-sheet';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = `
      <div class="dly-backdrop" data-d="close"></div>
      <section class="dly-panel profile-panel" role="dialog" aria-modal="true" aria-labelledby="dailyTitle">
        <div class="dly-panel-embers">${embers(14)}</div>

        <!-- Luxury Sunset Window Backdrop Header -->
        <div class="modal-window-backdrop flightlog-window-bg" style="background-image: url('assets/ui/header_window_flightlog.png');"></div>

        <!-- Top Navigation / Brand Bar -->
        <header class="dly-head modal-brand-head">
          <div class="modal-neora-brand-wrap">
            <img src="assets/ui/neora_logo_transparent.png" alt="NEORA — PLAY TOGETHER, STAY CLOSE." class="modal-neora-logo" onerror="this.src='assets/ui/extracted_neora_logo.png'">
          </div>
          <button class="dly-close round-close-btn" data-d="close" id="dailyCloseBtn" aria-label="Close">✕</button>
        </header>

        <!-- Title Banner -->
        <div class="modal-title-banner">
          <h2 id="dailyTitle">Daily <span class="accent-magenta">Flight Log</span></h2>
          <small id="dailyReset">New quests in 41m</small>
        </div>

        <div class="dly-body" id="dailyBody"></div>
      </section>`;
    document.body.appendChild(el);
    el.addEventListener('click', onClick);
  }

  function embers(n) {
    let h = '';
    for (let i = 0; i < n; i++) {
      h += `<i style="--x:${Math.round(Math.random() * 100)}%;--d:${(4 + Math.random() * 5).toFixed(2)}s;--delay:${(-Math.random() * 8).toFixed(2)}s;--s:${(0.5 + Math.random() * 0.9).toFixed(2)}"></i>`;
    }
    return h;
  }

  function weekTrack(sv) {
    const hist = new Set(sv.c.history || []);
    let h = '';
    for (let i = 6; i >= 0; i--) {
      const key = R.addDays(sv.today, -i);
      const d = new Date(`${key}T12:00:00Z`);
      const wd = d.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 2);
      const isToday = i === 0;
      const done = hist.has(key);
      let inner = '';
      if (!sv.isPair) {
        if (isToday) {
          inner = sv.meIn ? '<span class="day-check-mark">✓</span>' : '<span class="day-gift-box">🎁</span>';
        } else if (done) {
          inner = '<span class="day-check-mark">✓</span>';
        }
      } else {
        if (isToday && !done) {
          inner = `<span class="half l ${sv.c.checkins && sv.c.checkins.bkk === sv.today ? 'on' : ''}"></span><span class="half r ${sv.c.checkins && sv.c.checkins.dxb === sv.today ? 'on' : ''}"></span>`;
        } else if (done) {
          inner = '<span class="mini-flame">🔥</span>';
        }
      }
      const isDone = !sv.isPair ? (isToday ? sv.meIn : done) : done;
      h += `
        <div class="dly-day ${isDone ? 'done' : ''} ${isToday ? 'today today-active' : ''}" style="--i:${6 - i}">
          <div class="dly-day-dot ${isToday ? 'today-dot' : ''}">${inner}</div>
          <small class="${isToday ? 'today-text-accent' : ''}">${isToday ? 'Today' : wd}</small>
        </div>`;
    }
    return h;
  }

  function soloStreakCard(sv) {
    const mine = myRole().toUpperCase();
    const status = sv.meIn
      ? `<b class="ok">✨ Checked in for today!</b> Daily flight attendance bonus active (+20💎).`
      : `Board today to collect your daily flight attendance +20💎`;

    return `
      <!-- CARD 1: Solo Flight Attendance -->
      <article class="dly-card dly-streak dly-solo-attendance-card st-${sv.risk}" id="dailyStreakCard">
        <div class="dly-solo-attendance-top">
          <div class="dly-plane-ring-icon">
            <div class="dly-plane-ring-arc"></div>
            <div class="dly-plane-glyph">✈️</div>
          </div>
          <div class="dly-streak-info">
            <span class="dly-kicker kicker-cyan">✈️ SOLO FLIGHT ATTENDANCE</span>
            <h3>${sv.meIn ? 'Checked in today! ✨' : 'Daily Flight Check-in'}</h3>
            <div class="dly-streak-meta">
              <span>Attendance: <b>${sv.meIn ? 'Day 1 (Active)' : 'Pending Check-in'}</b></span>
              <span class="dly-solo-tag">👤 Solo Passenger</span>
            </div>
          </div>
        </div>
        <div class="dly-week">${weekTrack(sv)}</div>
        <div class="dly-checkins-pills">
          <span class="dly-status-pill ${sv.meIn ? 'in' : 'pending'}"><i class="status-dot"></i>${mine} ${sv.meIn ? 'checked in' : 'pending'}</span>
          <span class="dly-status-pill unlinked"><i class="status-dot unlinked"></i>🔗 Co-pilot: Unlinked</span>
        </div>
        <p class="dly-status-sub">${status}</p>
      </article>

      <!-- CARD 2: Couple Streak Locked Banner with Graphic -->
      <article class="dly-card dly-couple-locked-card" id="dailyCoupleLockCard">
        <span class="dly-kicker kicker-magenta">🤍 Couple Streak & Shared Chests Locked</span>
        <div class="dly-couple-locked-body">
          <div class="dly-cl-text">
            <h3>Link with a partner in Couple Sanctuary</h3>
            <p>Unlock shared 2-player frames, weekly milestone chests (+150💎), and 30-day jackpot bonuses (+500💎)!</p>
          </div>
          <div class="dly-cl-art">
            <img src="assets/ui/couple_bunnies_premium.png" alt="Couple Bunnies" class="dly-couple-bunnies-art" onerror="this.src='assets/ui/couple_bunnies.png'">
          </div>
        </div>
        <button type="button" class="dly-open-sanctuary-btn pill-btn full-width" data-d="open-sanctuary" id="dlyOpenSanctuaryFromStreak">
          <span>Link Partner in Couple Sanctuary</span> &gt;
        </button>
      </article>`;
  }

  function streakCard() {
    const sv = streakView();
    if (!sv.isPair) {
      return soloStreakCard(sv);
    }
    const partner = partnerRole().toUpperCase();
    const mine = myRole().toUpperCase();
    const freezes = Math.min(D.STREAK_FREEZE_MAX, sv.c.freezes || 0);
    const freezeHtml = Array.from({ length: D.STREAK_FREEZE_MAX }, (_, i) => `<span class="dly-freeze ${i < freezes ? 'on' : ''}" title="Streak freeze — saves one missed day">🧊</span>`).join('');
    const toNext = sv.risk === 'lit' ? 7 - (sv.alive % 7) : 7 - (sv.alive % 7);
    const toWeekly = toNext === 0 ? 7 : toNext;
    const pct = ((7 - toWeekly) / 7) * 100;

    let status;
    if (sv.risk === 'lit') status = `<b class="ok">✨ Today's flame is lit!</b> See you both tomorrow.`;
    else if (!sv.meIn) status = 'Checking you in…';
    else if (!sv.themIn) status = `<b>Waiting for ${partner}</b> to check in today 💭`;
    else status = 'Lighting today\u2019s flame…';
    if (sv.risk === 'frozen') status += ' <span class="frz">🧊 A freeze will save yesterday.</span>';
    if (sv.risk === 'broken' && sv.c.streak > 0) status = `Your ${sv.c.streak}-day flame went out — light a new one today 🕯️`;

    return `
      <article class="dly-card dly-streak st-${sv.risk}" id="dailyStreakCard">
        <div class="dly-streak-top">
          <div class="dly-streak-fire">
            ${fireHtml('lg', sv.risk === 'lit' ? 'lit' : sv.risk === 'frozen' ? 'frozen' : 'dim')}
            <span class="dly-streak-num" id="dailyStreakNum">${sv.alive}</span>
          </div>
          <div class="dly-streak-info">
            <span class="dly-kicker">🔥 Couple Streak</span>
            <h3>${sv.alive === 1 ? '1 day' : `${sv.alive} days`} together</h3>
            <div class="dly-streak-meta">
              <span title="Best streak">🏆 Best <b>${sv.c.best || 0}</b></span>
              <span class="dly-freezes">${freezeHtml}</span>
            </div>
          </div>
        </div>
        <div class="dly-week">${weekTrack(sv)}</div>
        <div class="dly-checkins">
          <span class="dly-who ${sv.meIn ? 'in' : ''}"><i></i>${mine} ${sv.meIn ? 'checked in' : '…'}</span>
          <span class="dly-who ${sv.themIn ? 'in' : ''}"><i></i>${partner} ${sv.themIn ? 'checked in' : 'not yet'}</span>
        </div>
        <p class="dly-status">${status}</p>
        <div class="dly-milestone">
          <div class="dly-milestone-row"><span>🎁 Weekly chest <b>+${D.STREAK_WEEKLY_BONUS}💎</b> + 🧊</span><b>${toWeekly} day${toWeekly === 1 ? '' : 's'} to go</b></div>
          <div class="dly-bar gold"><i style="width:${pct}%"></i></div>
          <small>Every day you both check in: <b>+${D.STREAK_DAILY}💎 each</b> · Day 30: <b>+${D.STREAK_MONTHLY_BONUS}💎</b></small>
        </div>
      </article>`;
  }

  function soloCallCard() {
    return `
      <!-- CARD 3: Together Time 1:1 Calls Gated Card -->
      <article class="dly-card dly-call-gated-card" id="dailyCallCard">
        <span class="dly-kicker kicker-amber">🔒 Together Time (Couple Only)</span>
        <div class="dly-gated-call-row">
          <div class="dly-gated-camera-circle">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M23 7l-7 5 7 5V7z"></path>
              <rect x="1" y="5" width="15" height="14" rx="3" ry="3"></rect>
            </svg>
          </div>
          <div class="dly-gated-call-text">
            <h3>1:1 Calls Gated for Couples</h3>
            <p>Private encrypted voice & video calls and call-time diamond rewards are exclusive to linked partners in Couple Sanctuary.</p>
          </div>
        </div>
        <button type="button" class="dly-gated-unlock-btn pill-btn full-width" data-d="open-sanctuary" id="dlyCallSanctuaryBtn">
          <span>Link Partner to Unlock 💓</span> &gt;
        </button>
      </article>`;
  }

  function callCard() {
    const isPair = isCoupleActive();
    if (!isPair) {
      return soloCallCard();
    }
    const cv = callView();
    const live = callIsLive();
    const R0 = 34; const C0 = 2 * Math.PI * R0;
    const dash = (C0 * cv.pct) / 100;
    const slots = Array.from({ length: D.CALL_DAILY_CHUNKS }, (_, i) => `<span class="dly-slot ${i < cv.paid ? 'on' : ''}" style="--i:${i}">💎</span>`).join('');
    return `
      <article class="dly-card dly-call ${live ? 'live' : ''}" id="dailyCallCard">
        <div class="dly-ring">
          <svg viewBox="0 0 80 80" aria-hidden="true">
            <defs><linearGradient id="dlyRingGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#67e8f9"/><stop offset="1" stop-color="#a78bfa"/></linearGradient></defs>
            <circle class="trk" cx="40" cy="40" r="${R0}"></circle>
            <circle class="val" cx="40" cy="40" r="${R0}" stroke-dasharray="${dash} ${C0}"></circle>
          </svg>
          <div class="dly-ring-mid">${cv.capped ? '<b>MAX</b><small>today</small>' : `<b>${cv.left}m</b><small>to 💎</small>`}</div>
        </div>
        <div class="dly-call-info">
          <span class="dly-kicker">📞 Together Time ${live ? '<em class="dly-live"><i></i>LIVE</em>' : ''}</span>
          <h3>${cv.min} min on call today</h3>
          <p>Earn <b>💎${D.CALL_CHUNK_REWARD}</b> every <b>${D.CALL_CHUNK_MIN} min</b> you talk — both of you!</p>
          <div class="dly-slots">${slots}<em>${cv.paid * D.CALL_CHUNK_REWARD}/${D.CALL_DAILY_CHUNKS * D.CALL_CHUNK_REWARD}</em></div>
        </div>
      </article>`;
  }

  function questsCard() {
    const qv = questView();
    if (!qv.quests.length) {
      return `<article class="dly-card dly-quests"><p class="dly-empty">Boarding today’s quests… ✈️</p></article>`;
    }
    const rows = qv.quests.map((q, i) => {
      const def = q.def;
      const done = q.progress >= def.goal;
      const state = q.claimed ? 'claimed' : done ? 'ready' : 'todo';
      const pct = Math.min(100, (q.progress / def.goal) * 100);
      const busy = S.claiming.has(q.id);
      const btn = q.claimed
        ? '<span class="dly-q-done">✓</span>'
        : done
          ? `<button class="dly-claim" data-d="claim" data-id="${q.id}" id="dailyClaim_${q.id}" ${busy ? 'disabled' : ''}><span>Claim</span><b>💎${def.reward}</b></button>`
          : `<span class="dly-q-reward">💎${def.reward}</span>`;
      return `
        <div class="dly-quest st-${state}" style="--i:${i}" id="dailyQuest_${q.id}">
          <div class="dly-q-icon">${def.icon}</div>
          <div class="dly-q-body">
            <b>${def.title}</b>
            <small>${q.claimed ? 'Completed · reward collected' : def.hint}</small>
            <div class="dly-q-prog">
              <div class="dly-bar ${state === 'todo' ? '' : 'gold'}"><i style="width:${pct}%"></i></div>
              <em>${Math.min(q.progress, def.goal)}/${def.goal}</em>
            </div>
          </div>
          <div class="dly-q-act">${btn}</div>
        </div>`;
    }).join('');

    const claimedCount = qv.quests.filter((q) => q.claimed).length;
    const chestState = qv.bonusClaimed ? 'opened' : qv.bonusReady ? 'ready' : 'locked';
    const chest = `
      <div class="dly-chest-row st-${chestState}">
        <button class="dly-chest" data-d="chest" id="dailyChestBtn" ${chestState === 'ready' ? '' : 'disabled'} aria-label="Open the daily chest">
          <span class="dly-chest-rays"></span>
          <span class="dly-chest-box">
            <span class="lid"></span><span class="body"></span><span class="lock">${chestState === 'opened' ? '✨' : chestState === 'ready' ? '★' : '🔒'}</span>
          </span>
        </button>
        <div class="dly-chest-text">
          <b>${chestState === 'opened' ? 'Daily chest opened!' : chestState === 'ready' ? 'Tap the chest to open!' : 'Daily chest'}</b>
          <small>${chestState === 'opened' ? `+${D.ALL_QUESTS_BONUS}💎 collected — come back tomorrow` : `Finish all ${qv.quests.length} quests → <b>+${D.ALL_QUESTS_BONUS}💎</b> (${claimedCount}/${qv.quests.length})`}</small>
        </div>
      </div>`;

    return `
      <article class="dly-card dly-quests" id="dailyQuestsCard">
        <div class="dly-quests-head">
          <span class="dly-kicker">📋 Today's Quests</span>
          <small>⏳ ${resetIn()}</small>
        </div>
        ${rows}
        ${chest}
      </article>`;
  }

  function render() {
    const body = $('dailyBody');
    if (!body || !S.open) return;
    body.innerHTML = streakCard() + callCard() + questsCard();
    const r = $('dailyReset');
    if (r) r.textContent = `New quests in ${resetIn()}`;
  }

  function open() {
    build();
    S.open = true;
    const sheet = $('dailySheet');
    sheet.classList.add('open');
    sheet.setAttribute('aria-hidden', 'false');
    Sound.tap();
    send({ type: 'vault_hello' });
    render();
  }

  function close() {
    S.open = false;
    const sheet = $('dailySheet');
    if (!sheet) return;
    sheet.classList.remove('open');
    sheet.setAttribute('aria-hidden', 'true');
  }

  function onClick(e) {
    const t = e.target.closest('[data-d]');
    if (!t) return;
    e.stopPropagation();
    switch (t.dataset.d) {
      case 'close': close(); break;
      case 'claim': claim(t.dataset.id, t); break;
      case 'chest': openChest(t); break;
      case 'open-sanctuary':
        close();
        if (window.SkySocialUI && typeof window.SkySocialUI.openDrawer === 'function') {
          window.SkySocialUI.openDrawer('couple');
        }
        break;
    }
  }

  function claim(id, btn) {
    if (!id || S.claiming.has(id)) return;
    S.claiming.add(id);
    btn.disabled = true;
    btn.classList.add('pressing');
    const row = $(`dailyQuest_${id}`);
    if (row) row.classList.add('claiming');
    S.pendingFlyFrom = btn.getBoundingClientRect();
    send({ type: 'vault_quest_claim', questId: id, reqId: `q_${Date.now()}` });
    setTimeout(() => { S.claiming.delete(id); }, 4000);
  }

  function openChest(btn) {
    if (btn.disabled) return;
    btn.disabled = true;
    const row = btn.closest('.dly-chest-row');
    if (row) row.classList.add('opening');
    Sound.whoosh();
    S.pendingFlyFrom = btn.getBoundingClientRect();
    setTimeout(() => send({ type: 'vault_bonus_claim', reqId: `b_${Date.now()}` }), 650);
  }

  // ---------------------------------------------------------------------------
  // Diamonds fly into the wallet pill
  // ---------------------------------------------------------------------------
  function flyGems(fromRect, count = 10, glyph = '💎') {
    const target = $('vaultHeaderPill');
    if (!target || !fromRect || reduced) { bumpPill(); return; }
    const b = target.getBoundingClientRect();
    const sx = fromRect.left + fromRect.width / 2;
    const sy = fromRect.top + fromRect.height / 2;
    const tx = b.left + 18;
    const ty = b.top + b.height / 2;
    const layer = document.createElement('div');
    layer.className = 'dly-fly-layer';
    document.body.appendChild(layer);
    let landed = 0;
    for (let i = 0; i < count; i++) {
      const g = document.createElement('span');
      g.className = 'dly-fly-gem';
      g.textContent = glyph;
      g.style.left = `${sx}px`;
      g.style.top = `${sy}px`;
      layer.appendChild(g);
      const ang = Math.random() * Math.PI * 2;
      const rad = 40 + Math.random() * 60;
      const mx = Math.cos(ang) * rad;
      const my = Math.sin(ang) * rad - 30;
      const dx = tx - sx;
      const dy = ty - sy;
      const anim = g.animate([
        { transform: 'translate(-50%,-50%) scale(0.3) rotate(0deg)', opacity: 0 },
        { transform: `translate(calc(-50% + ${mx}px), calc(-50% + ${my}px)) scale(1.25) rotate(${(Math.random() * 60 - 30).toFixed(0)}deg)`, opacity: 1, offset: 0.32 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.45) rotate(0deg)`, opacity: 0.95 }
      ], { duration: 820 + Math.random() * 380, delay: i * 45, easing: 'cubic-bezier(0.45, 0, 0.7, 0.2)', fill: 'forwards' });
      anim.onfinish = () => {
        g.remove();
        Sound.gem();
        landed += 1;
        bumpPill();
        if (landed >= count) layer.remove();
      };
    }
  }

  function bumpPill() {
    const pill = $('vaultHeaderPill');
    if (!pill) return;
    pill.classList.remove('dly-gulp'); void pill.offsetWidth; pill.classList.add('dly-gulp');
  }

  // ---------------------------------------------------------------------------
  // Rewards from the server
  // ---------------------------------------------------------------------------
  function toast(html, cls, ms) {
    if (V() && V().toast) V().toast(html, cls, ms);
  }

  function handleReward(msg) {
    switch (msg.kind) {
      case 'streak':
        queueCelebration(msg);
        break;
      case 'quest': {
        Sound.claim();
        const from = S.pendingFlyFrom || centerRect();
        S.pendingFlyFrom = null;
        flyGems(from, Math.min(14, 6 + Math.round(msg.amount / 6)));
        toast(`<div><b>${msg.icon} Quest complete!</b><span>${msg.title} · <em class="t-mythic">+${msg.amount}💎</em></span></div>`, 'dly-toast', 3200);
        break;
      }
      case 'quest_ready':
        Sound.ready();
        toast(`<div><b>✅ ${msg.title}</b><span>Ready to claim <em class="t-mythic">💎${msg.amount}</em> — tap 🔥 up top</span></div>`, 'dly-toast ready', 4200);
        { const chip = $('dailyChip'); if (chip) { chip.classList.remove('wiggle'); void chip.offsetWidth; chip.classList.add('wiggle'); } }
        break;
      case 'bonus': {
        Sound.chest();
        const from = S.pendingFlyFrom || centerRect();
        S.pendingFlyFrom = null;
        const row = document.querySelector('.dly-chest-row');
        if (row) { row.classList.remove('opening'); row.classList.add('burst'); }
        setTimeout(() => flyGems(from, 16), 250);
        if (V() && V().diamondRain) V().diamondRain(msg.amount * 4);
        toast(`<div><b>🎁 Daily chest opened!</b><span>All quests done · <em class="t-mythic">+${msg.amount}💎</em></span></div>`, 'dly-toast', 3600);
        break;
      }
      case 'call': {
        Sound.claim();
        const chip = $('callTimerChip');
        const from = chip && !chip.classList.contains('hidden') ? chip.getBoundingClientRect() : centerRect();
        flyGems(from, 8);
        toast(`<div><b>📞 ${msg.minutes} minutes together 💞</b><span>Together-time reward <em class="t-mythic">+${msg.amount}💎</em> · ${msg.chunk}/${msg.cap} today</span></div>`, 'dly-toast call', 4200);
        break;
      }
    }
    setTimeout(() => { updateChip(); render(); }, 60);
  }

  function centerRect() {
    const w = window.innerWidth; const h = window.innerHeight;
    return { left: w / 2 - 20, top: h / 2 - 20, width: 40, height: 40 };
  }

  // ---------------------------------------------------------------------------
  // 🔥 Streak celebration
  // ---------------------------------------------------------------------------
  const SEEN_KEY = () => `nook_streak_seen_${myRole()}`;

  function queueCelebration(info) {
    try { if (localStorage.getItem(SEEN_KEY()) === `${R.dayKey()}:${info.streak}`) return; } catch (e) {}
    S.queue.push(info);
    if (!S.celebrating) nextCelebration();
  }

  function nextCelebration() {
    const info = S.queue.shift();
    if (!info) { S.celebrating = false; return; }
    S.celebrating = true;
    try { localStorage.setItem(SEEN_KEY(), `${R.dayKey()}:${info.streak}`); } catch (e) {}
    celebrate(info);
  }

  /** On load: if today's streak day was completed while we were away, celebrate once. */
  function maybeCelebrateMissed() {
    const c = couple();
    if (!c.lastDay || c.lastDay !== R.dayKey() || !c.streak) return;
    let seen = '';
    try { seen = localStorage.getItem(SEEN_KEY()) || ''; } catch (e) {}
    if (seen === `${R.dayKey()}:${c.streak}`) return;
    const r = R.streakReward(c.streak);
    queueCelebration({ kind: 'streak', streak: c.streak, best: c.best, amount: r.total, weekly: r.weekly, monthly: r.monthly, freezes: c.freezes, late: true });
  }

  function celebrate(info) {
    let el = $('dailyCelebrate');
    if (!el) {
      el = document.createElement('div');
      el.id = 'dailyCelebrate';
      el.className = 'dly-celebrate';
      document.body.appendChild(el);
      el.addEventListener('click', (e) => {
        if (e.target.closest('[data-d="celebrate-done"]') || e.target.classList.contains('dly-cel-backdrop')) dismissCelebration();
      });
    }
    const prev = Math.max(0, info.streak - 1);
    const extras = [];
    if (info.weekly) extras.push(`<span class="dly-cel-badge gold">🎁 Weekly chest +${D.STREAK_WEEKLY_BONUS}💎</span>`);
    if (info.monthly) extras.push(`<span class="dly-cel-badge holo">🌟 30-day legend +${D.STREAK_MONTHLY_BONUS}💎</span>`);
    if (info.freezeEarned) extras.push('<span class="dly-cel-badge ice">🧊 Streak freeze earned</span>');
    if (info.usedFreeze) extras.push('<span class="dly-cel-badge ice">🧊 A freeze saved your streak!</span>');
    const line = info.streak === 1
      ? 'A brand-new flame — light it again tomorrow together 💞'
      : info.weekly ? `A whole week in a row. You two are unstoppable ✈️` : `You both showed up again. That\u2019s love in a long-haul 💕`;

    el.innerHTML = `
      <div class="dly-cel-backdrop"></div>
      <div class="dly-cel-stage ${info.weekly || info.monthly ? 'big' : ''}">
        <div class="dly-cel-rays"></div>
        <div class="dly-cel-embers">${embers(26)}</div>
        <div class="dly-cel-fire">${fireHtml('xl', 'lit')}</div>
        <div class="dly-cel-count">
          <span class="roll"><b class="old">${prev}</b><b class="new">${info.streak}</b></span>
        </div>
        <span class="dly-cel-kicker">🔥 COUPLE STREAK</span>
        <h2>Day ${info.streak} together!</h2>
        <p>${line}</p>
        <div class="dly-cel-reward"><span class="gem">💎</span><b>+${fmt(info.amount)}</b><small>for each of you</small></div>
        <div class="dly-cel-badges">${extras.join('')}</div>
        <button class="dly-cel-btn" data-d="celebrate-done" id="dailyCelebrateBtn">Keep the flame alive 🔥</button>
      </div>`;
    void el.offsetWidth;
    el.classList.add('show');
    Sound.whoosh();
    setTimeout(() => { el.classList.add('rolled'); Sound.flame(); if (navigator.vibrate) { try { navigator.vibrate([30, 40, 60]); } catch (e) {} } }, 900);
    setTimeout(() => { if (V() && V().diamondRain) V().diamondRain(info.amount * (info.weekly ? 2 : 4)); }, 1400);
  }

  function dismissCelebration() {
    const el = $('dailyCelebrate');
    if (!el) return;
    const btn = $('dailyCelebrateBtn');
    if (btn) flyGems(btn.getBoundingClientRect(), 10);
    el.classList.remove('show', 'rolled');
    setTimeout(() => { el.innerHTML = ''; nextCelebration(); }, 450);
    updateChip();
  }

  // ---------------------------------------------------------------------------
  // Call tick: both phones report a live call; the server pays when both agree
  // ---------------------------------------------------------------------------
  function startCallTicks() {
    setInterval(() => {
      if (callIsLive()) send({ type: 'vault_call_tick' });
      updateCallMini();
    }, 20000);
  }

  // ---------------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------------
  let celebratedOnLoad = false;
  function onProfiles() {
    updateChip();
    if (S.open) render();
    if (!celebratedOnLoad && profiles() && profiles().couple) {
      celebratedOnLoad = true;
      setTimeout(maybeCelebrateMissed, 1200);
    }
  }

  function init() {
    mountChip();
    updateChip();
    startCallTicks();
    window.addEventListener('vault:profiles', onProfiles);
    window.addEventListener('sky:couple_status_changed', onProfiles);
    setInterval(() => { updateChip(); if (S.open) { const r = $('dailyReset'); if (r) r.textContent = `New quests in ${resetIn()}`; } }, 30000);
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if ($('dailyCelebrate') && $('dailyCelebrate').classList.contains('show')) dismissCelebration();
      else if (S.open) close();
    });
    // vault.js may mount its pill after us — keep them grouped.
    setTimeout(ensurePillInGroup, 300);
  }

  window.NookDaily = { open, close, handleReward, flyGems, fireHtml, refresh: () => { updateChip(); render(); } };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
