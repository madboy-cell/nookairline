/**
 * Nook Airline — 🐾 Purrst Class Lounge (client)
 *
 *   Lounge   · cats wander the cabin, blink, nap, ask for things, bring gifts
 *              tap = say hi · rub = pet (purr + hearts) · Feed = bowl · Play = feather on a string
 *   Capsule  · Kitty Capsule gacha with crank, drop, crack-open reveal (×1 / ×10)
 *   Catdex   · all 27 cats, silhouettes for the ones you haven't met yet
 *
 * The server owns every number (server_cats.js). This file only animates and sends intents.
 */
(function () {
  const C = window.NookCatsData;
  if (!C) { console.warn('[Cats] cats.js missing'); return; }
  const E = C.ECON;

  const $ = (id) => document.getElementById(id);
  const fmt = (n) => Number(n || 0).toLocaleString();
  const myRole = () => {
    if (window.SkySupabase && typeof window.SkySupabase.getCharacterBase === 'function') {
      return window.SkySupabase.getCharacterBase();
    }
    return window.myTerminal || (window.getTerminalRole ? window.getTerminalRole() : 'bkk');
  };
  const partnerRole = () => (myRole() === 'bkk' ? 'dxb' : 'bkk');
  const isCoupleActive = () => !!(window.SkySupabase && ((window.SkySupabase.coupleStatus && window.SkySupabase.coupleStatus.isCouple) || (typeof window.SkySupabase.isCouple === 'function' && window.SkySupabase.isCouple())));
  const V = () => window.NookVault;
  const profiles = () => (V() && V().getProfiles ? V().getProfiles() : null);
  const me = () => { const p = profiles(); return p ? p[myRole()] : null; };
  const lounge = () => { const p = profiles(); return p && p.cats ? p.cats : null; };
  const owned = () => { const L = lounge(); return L ? L.owned || {} : {}; };
  const send = (msg) => { if (typeof window.sendSignaling === 'function') window.sendSignaling(msg); };
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const sprite = (id, sleep) => `assets/cats/${id}${sleep ? '_sleep' : ''}.png`;
  const today = () => C.dayKey();
  const haptic = (p) => { if (navigator.vibrate) { try { navigator.vibrate(p); } catch (e) {} } };

  const S = {
    open: false,
    tab: 'lounge',
    sel: null,
    visible: [],          // cat ids currently in the room
    spots: {},            // catId -> spot id
    nodes: {},            // catId -> element
    roamTimers: {},
    blinkTimers: {},
    woke: {},             // catId -> nap window they were woken in
    ptr: null,
    petting: null,
    lastPetSent: 0,
    play: null,
    pulling: false,
    pending: null,
    reveal: null,
    feed: [],
    capReachedShown: '',
    lastOwnedKey: ''
  };

  // ---------------------------------------------------------------------------
  // 🔊 Synth sounds (no audio files): meow, purr, chomp, pop, crank…
  // ---------------------------------------------------------------------------
  const Sound = (() => {
    let ctx = null;
    let purr = null;
    const ac = () => {
      if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    };
    let noiseBuf = null;
    function noise(c) {
      if (noiseBuf) return noiseBuf;
      noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
      const d = noiseBuf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
      return noiseBuf;
    }
    function tone(f, t0, dur, type = 'sine', vol = 0.07, f2) {
      const c = ac(); if (!c) return;
      const o = c.createOscillator(); const g = c.createGain();
      const t = c.currentTime + t0;
      o.type = type; o.frequency.setValueAtTime(f, t);
      if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + 0.05);
    }
    function burst(t0, dur, freq, vol) {
      const c = ac(); if (!c) return;
      const src = c.createBufferSource(); src.buffer = noise(c);
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 1.2;
      const g = c.createGain(); const t = c.currentTime + t0;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f); f.connect(g); g.connect(c.destination);
      src.start(t, Math.random()); src.stop(t + dur + 0.05);
    }
    return {
      /** "m-ia-ow": a sawtooth through a sweeping band-pass, pitch per cat. */
      meow(p = 1, vol = 0.07, short = false) {
        const c = ac(); if (!c) return;
        const t = c.currentTime;
        const L = short ? 0.28 : 0.52;
        const f0 = 470 * p;
        const o = c.createOscillator(); o.type = 'sawtooth';
        o.frequency.setValueAtTime(f0 * 0.85, t);
        o.frequency.linearRampToValueAtTime(f0 * 1.5, t + L * 0.25);
        o.frequency.linearRampToValueAtTime(f0 * 1.3, t + L * 0.55);
        o.frequency.exponentialRampToValueAtTime(f0 * 0.72, t + L);
        const o2 = c.createOscillator(); o2.type = 'sine';
        o2.frequency.setValueAtTime(f0 * 1.7, t);
        o2.frequency.linearRampToValueAtTime(f0 * 3, t + L * 0.25);
        o2.frequency.exponentialRampToValueAtTime(f0 * 1.4, t + L);
        const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 2.4;
        bp.frequency.setValueAtTime(700, t);
        bp.frequency.linearRampToValueAtTime(1900 * p, t + L * 0.3);
        bp.frequency.exponentialRampToValueAtTime(800, t + L);
        const g = c.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.05);
        g.gain.setValueAtTime(vol, t + L * 0.6);
        g.gain.exponentialRampToValueAtTime(0.0001, t + L);
        const g2 = c.createGain(); g2.gain.value = 0.25;
        o.connect(bp); bp.connect(g); o2.connect(g2); g2.connect(g); g.connect(c.destination);
        o.start(t); o2.start(t); o.stop(t + L + 0.05); o2.stop(t + L + 0.05);
      },
      /** Continuous purr: brown noise, low-passed, amplitude-modulated at ~24 Hz. */
      purrStart(vol = 0.32) {
        const c = ac(); if (!c || purr) return;
        const src = c.createBufferSource(); src.buffer = noise(c); src.loop = true;
        const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320;
        const hum = c.createOscillator(); hum.type = 'sine'; hum.frequency.value = 52;
        const humG = c.createGain(); humG.gain.value = 0.35;
        const am = c.createGain(); am.gain.value = 0.5;
        const lfo = c.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 23 + Math.random() * 4;
        const lfoG = c.createGain(); lfoG.gain.value = 0.5;
        const out = c.createGain(); out.gain.value = 0.0001;
        lfo.connect(lfoG); lfoG.connect(am.gain);
        src.connect(lp); lp.connect(am); hum.connect(humG); humG.connect(am); am.connect(out); out.connect(c.destination);
        const t = c.currentTime;
        out.gain.exponentialRampToValueAtTime(vol, t + 0.35);
        src.start(t); hum.start(t); lfo.start(t);
        purr = { src, hum, lfo, out };
      },
      purrStop() {
        const c = ctx; if (!c || !purr) return;
        const p = purr; purr = null;
        const t = c.currentTime;
        p.out.gain.cancelScheduledValues(t);
        p.out.gain.setValueAtTime(Math.max(0.0001, p.out.gain.value), t);
        p.out.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
        [p.src, p.hum, p.lfo].forEach((n) => { try { n.stop(t + 0.5); } catch (e) {} });
      },
      chomp() { [0, 0.16, 0.32, 0.5].forEach((d) => burst(d, 0.07, 900 + Math.random() * 400, 0.12)); },
      pop() { tone(500, 0, 0.12, 'sine', 0.1, 1300); burst(0, 0.05, 2400, 0.05); },
      boing() { tone(220, 0, 0.25, 'sine', 0.09, 660); },
      tap() { tone(880, 0, 0.05, 'triangle', 0.04); },
      heart() { tone(1320 + Math.random() * 300, 0, 0.09, 'sine', 0.025); },
      fish() { tone(1500 + Math.random() * 400, 0, 0.07, 'sine', 0.035); },
      crank(n = 6) { for (let i = 0; i < n; i++) { tone(1600, i * 0.09, 0.03, 'square', 0.025); burst(i * 0.09, 0.03, 3000, 0.03); } },
      clunk() { tone(140, 0, 0.18, 'triangle', 0.12, 70); burst(0, 0.08, 400, 0.08); },
      rattle() { for (let i = 0; i < 5; i++) burst(i * 0.07, 0.05, 1800 + i * 200, 0.05); },
      crack() { burst(0, 0.12, 2600, 0.12); tone(700, 0, 0.18, 'triangle', 0.06, 1400); },
      sparkle() { [1568, 2093, 2637, 3136].forEach((f, i) => tone(f, i * 0.06, 0.25, 'sine', 0.04)); },
      gift() { [784, 988, 1175, 1568].forEach((f, i) => tone(f, i * 0.07, 0.3, 'triangle', 0.06)); },
      catch() { tone(990, 0, 0.08, 'triangle', 0.06); tone(1480, 0.07, 0.12, 'triangle', 0.06); },
      reveal(rarity) {
        const base = { common: [659, 784, 988], rare: [659, 880, 1109, 1319], epic: [587, 784, 988, 1175, 1568], mythic: [523, 659, 784, 1047, 1319, 1568, 2093] }[rarity] || [784];
        base.forEach((f, i) => tone(f, i * 0.08, 0.5, 'triangle', 0.07));
        if (rarity === 'mythic') { tone(65, 0, 1.6, 'sine', 0.12); setTimeout(() => Sound.sparkle(), 500); }
      }
    };
  })();

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------
  function catState(id) { return owned()[id] || null; }
  function needs(id) {
    const st = catState(id);
    return st ? C.needsAt(st, Date.now(), C.decayMult(owned())) : { hunger: 0, love: 0, fun: 0 };
  }
  function moodOfCat(id) { return C.moodOf(needs(id)); }
  function myDay() {
    const p = me();
    return p && p.catDay && p.catDay.day === today() ? p.catDay : { careFish: 0, gifts: 0, doublePets: 0 };
  }
  function giftReady(id) {
    const st = catState(id);
    if (!st) return false;
    if (st.gifts && st.gifts[myRole()] === today()) return false;
    if (myDay().gifts >= C.giftCap(owned())) return false;
    return moodOfCat(id) >= E.GIFT_MOOD;
  }
  function ownedIds() {
    const o = owned();
    return C.CATS.filter((c) => o[c.id]).map((c) => c.id);
  }
  function napWindow() { return Math.floor(Date.now() / (7 * 60 * 1000)); }
  function hash(str) { let h = 7; for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0; return h; }
  function isNapping(id) {
    if (S.sel === id && S.petting) return false;
    if (S.play && S.play.id === id) return false;
    const w = napWindow();
    if (S.woke[id] === w) return false;
    const n = needs(id);
    if (n.fun >= 97) return true;                       // just played hard → nap
    return hash(`${id}:${w}`) % 6 === 0;                // ~1 in 6 windows they doze off
  }
  function bondText(id) {
    const st = catState(id);
    const def = C.BY_ID[id];
    if (!st || !def) return '';
    const b = (st.care && st.care.bkk) || 0;
    const d = (st.care && st.care.dxb) || 0;
    if (b + d < 6) return `${def.name} is still getting to know you both`;
    if (Math.abs(b - d) / (b + d) < 0.12) return `${def.name} loves you both equally 💞`;
    return `${def.name} prefers ${b > d ? 'BKK' : 'DXB'} 💕`;
  }

  function soloBondData(id) {
    const st = catState(id);
    const def = C.BY_ID[id];
    if (!st || !def) return { level: 1, pct: 20, text: 'Getting acquainted ✨' };
    const myRoleKey = myRole();
    const myCare = (st.care && st.care[myRoleKey]) || (st.care && (st.care.bkk || 0) + (st.care.dxb || 0)) || 0;
    let level = 1;
    let pct = Math.min(100, Math.round((myCare / 5) * 100));
    let text = `${def.name} is warming up to you nicely ✨`;
    if (myCare >= 30) {
      level = 4;
      pct = 100;
      text = `Soulmate Fluff — Inseparable best friends forever! 💖👑`;
    } else if (myCare >= 15) {
      level = 3;
      pct = Math.round(50 + ((myCare - 15) / 15) * 50);
      text = `${def.name} purrs happily whenever you walk in 🥰`;
    } else if (myCare >= 5) {
      level = 2;
      pct = Math.round(25 + ((myCare - 5) / 10) * 25);
      text = `${def.name} loves your gentle pats and treats 💕`;
    }
    return { level, pct, text };
  }

  // ---------------------------------------------------------------------------
  // Shell
  // ---------------------------------------------------------------------------
  function build() {
    if ($('catLounge')) return;
    const el = document.createElement('div');
    el.id = 'catLounge';
    el.className = 'cl-sheet';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = `
      <div class="cl-backdrop" data-c="close"></div>
      <section class="cl-panel" role="dialog" aria-modal="true" aria-labelledby="clTitle">
        <header class="cl-head">
          <div class="cl-head-text">
            <h2 id="clTitle"><span class="cl-paw">🐾</span> Purrst Class Lounge</h2>
            <small id="clSub">Your shared cat lounge</small>
          </div>
          <div class="cl-pills">
            <span class="cl-pill fish" id="clFishPill" title="Your fish — the cat currency"><i>🐟</i><b>0</b></span>
            <span class="cl-pill gem" id="clGemPill" title="Your diamonds"><i>💎</i><b>0</b></span>
          </div>
          <button class="cl-close" data-c="close" id="clCloseBtn" aria-label="Close the lounge">✕</button>
        </header>
        <nav class="cl-tabs" role="tablist">
          <button class="cl-tab on" data-c="tab" data-tab="lounge" id="clTabLounge" role="tab">🛋️ Lounge</button>
          <button class="cl-tab" data-c="tab" data-tab="capsule" id="clTabCapsule" role="tab">🎰 Kitty Capsule</button>
          <button class="cl-tab" data-c="tab" data-tab="dex" id="clTabDex" role="tab">📖 Catdex <em id="clDexCount">0/27</em></button>
          <i class="cl-tab-ink" id="clTabInk"></i>
        </nav>
        <div class="cl-body" id="clBody">
          <div class="cl-view on" data-view="lounge" id="clViewLounge">
            <div class="cl-scene" id="clScene">
              <div class="cl-world" id="clWorld">
                <div class="cl-bg"></div>
                <div class="cl-sunbeam"></div>
                <div class="cl-dust">${dust(14)}</div>
                <div class="cl-floor" id="clFloor"></div>
                <div class="cl-fx" id="clFx"></div>
              </div>
              <div class="cl-scene-hint" id="clHint">Tap a cat to say hi · rub to pet 🫶</div>
              <div class="cl-play-hud hidden" id="clPlayHud"><span>🪶 Wiggle the feather near the cat!</span><b id="clPlayCount">0/3</b><button data-c="play-done" id="clPlayDone">Done</button></div>
            </div>
            <div class="cl-care" id="clCare"></div>
            <div class="cl-roster-wrap">
              <div class="cl-roster-head"><span>Your cats</span><small id="clRosterNote"></small></div>
              <div class="cl-roster" id="clRoster"></div>
            </div>
            <div class="cl-feed" id="clFeed"></div>
          </div>
          <div class="cl-view" data-view="capsule" id="clViewCapsule"></div>
          <div class="cl-view" data-view="dex" id="clViewDex"></div>
        </div>
        <div class="cl-reveal" id="clReveal" aria-live="polite"></div>
      </section>`;
    document.body.appendChild(el);
    el.addEventListener('click', onClick);
    el.addEventListener('touchend', (e) => {
      const t = e.target.closest('[data-c]');
      if (!t) return;
      if (t.dataset.c === 'close') {
        e.preventDefault();
        e.stopPropagation();
        close();
      }
    }, { passive: false });
    const scene = $('clScene');
    scene.addEventListener('pointerdown', onPointerDown);
    scene.addEventListener('pointermove', onPointerMove);
    scene.addEventListener('pointerup', onPointerUp);
    scene.addEventListener('pointercancel', onPointerUp);
    scene.addEventListener('pointerleave', (e) => { if (S.petting && e.pointerType === 'mouse') onPointerUp(e); });
    $('clReveal').addEventListener('click', onRevealClick);
  }

  function dust(n) {
    let h = '';
    for (let i = 0; i < n; i++) h += `<i style="--x:${rand(25, 75).toFixed(1)}%;--y:${rand(30, 90).toFixed(1)}%;--d:${rand(6, 12).toFixed(1)}s;--delay:${(-rand(0, 10)).toFixed(1)}s"></i>`;
    return h;
  }

  // ---------------------------------------------------------------------------
  // Open / close / tabs
  // ---------------------------------------------------------------------------
  function open(tab) {
    build();
    S.open = true;
    const el = $('catLounge');
    el.classList.add('open');
    el.setAttribute('aria-hidden', 'false');
    document.body.classList.add('cl-lock');
    send({ type: 'vault_cat_hello' });
    setTab(tab || S.tab || 'lounge', true);
    renderAll();
    Sound.tap();
    if (!lounge()) $('clCare').innerHTML = waitingHtml();
    armHelloTimeout();
  }

  /** Shown in every tab until the server hands us the shared lounge. */
  function waitingHtml() {
    if (S.helloFailed) {
      return '<div class="cl-loading"><span class="cl-loading-paw">😿</span><b>The lounge didn’t answer</b><small>The server may need a restart to load the cats</small><button class="cl-rv-btn" data-c="retry" id="clRetryBtn" style="margin-top:12px">Try again</button></div>';
    }
    return '<div class="cl-loading"><span class="cl-loading-paw">🐾</span><b>Opening the lounge…</b><small>The cats are fluffing their cushions</small></div>';
  }

  function armHelloTimeout() {
    clearTimeout(S.helloTimer);
    if (lounge()) { S.helloFailed = false; return; }
    S.helloTimer = setTimeout(() => {
      if (lounge() || !S.open) return;
      S.helloFailed = true;
      renderWaiting();
    }, 6000);
  }

  function renderWaiting() {
    ['clCare', 'clViewCapsule', 'clViewDex'].forEach((id) => { const el = $(id); if (el) el.innerHTML = waitingHtml(); });
  }

  function retryHello() {
    S.helloFailed = false;
    renderWaiting();
    send({ type: 'vault_cat_hello' });
    armHelloTimeout();
  }

  function close() {
    S.open = false;
    endPlay(true);
    endPet();
    const el = $('catLounge');
    if (el) {
      el.classList.remove('open');
      el.setAttribute('aria-hidden', 'true');
    }
    document.body.classList.remove('cl-lock');
    Object.values(S.roamTimers).forEach(clearTimeout);
    Object.values(S.blinkTimers).forEach(clearTimeout);
    S.roamTimers = {};
    S.blinkTimers = {};
    const floor = $('clFloor');
    if (floor) floor.innerHTML = '';
    S.nodes = {};
    S.spots = {};
    S.visible = [];
    S.ptr = null;
  }

  function setTab(tab, instant) {
    S.tab = tab;
    document.querySelectorAll('#catLounge .cl-tab').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
    document.querySelectorAll('#catLounge .cl-view').forEach((v) => v.classList.toggle('on', v.dataset.view === tab));
    const btn = document.querySelector(`#catLounge .cl-tab[data-tab="${tab}"]`);
    const ink = $('clTabInk');
    if (btn && ink) {
      ink.style.transition = instant ? 'none' : '';
      ink.style.left = `${btn.offsetLeft}px`;
      ink.style.width = `${btn.offsetWidth}px`;
    }
    if (tab !== 'lounge') {
      endPlay(true);
      endPet();
    }
    if (tab === 'capsule') renderCapsule();
    if (tab === 'dex') renderDex();
    if (tab === 'lounge') { syncScene(); renderCare(); renderRoster(); renderFeed(); }
    const body = $('clBody'); if (body) body.scrollTop = 0;
  }

  function renderAll() {
    if (!S.open) return;
    renderHead();
    if (!lounge()) return;
    if (S.tab === 'lounge') { syncScene(); renderCare(); renderRoster(); renderFeed(); }
    if (S.tab === 'capsule' && !S.pulling) renderCapsule();
    if (S.tab === 'dex') renderDex();
  }

  function renderHead() {
    const p = me();
    const fp = $('clFishPill'); const gp = $('clGemPill');
    if (fp) fp.querySelector('b').textContent = p ? fmt(p.fish || 0) : '0';
    if (gp) gp.querySelector('b').textContent = p ? fmt(p.diamonds || 0) : '0';
    const ids = ownedIds();
    const dc = $('clDexCount'); if (dc) dc.textContent = `${ids.length}/${C.CATS.length}`;
    const sub = $('clSub');
    const isPair = isCoupleActive();
    if (sub) {
      sub.textContent = ids.length
        ? `${ids.length} cat${ids.length === 1 ? '' : 's'} · ${isPair ? `shared with ${partnerRole().toUpperCase()} 💞` : 'Purrst Class Sanctuary 🐾'}`
        : (isPair ? 'Your shared cat lounge' : 'Purrst Class Cat Lounge');
    }
  }

  function bumpPill(id) {
    const el = $(id); if (!el) return;
    el.classList.remove('gulp'); void el.offsetWidth; el.classList.add('gulp');
  }

  // ---------------------------------------------------------------------------
  // 🛋️ Scene — which cats are in the room, where they stand, how they move
  // ---------------------------------------------------------------------------
  function pickVisible() {
    const ids = ownedIds();
    const keep = S.visible.filter((id) => ids.includes(id));
    const score = (id) => (giftReady(id) ? 200 : 0) + (100 - moodOfCat(id)) + ((catState(id).at || 0) / 1e13);
    const rest = ids.filter((id) => !keep.includes(id)).sort((a, b) => score(b) - score(a));
    const out = keep.concat(rest).slice(0, E.LOUNGE_VISIBLE);
    if (S.sel && ids.includes(S.sel) && !out.includes(S.sel)) out[out.length - 1] = S.sel;
    return out;
  }

  function freeSpots(exceptId) {
    const used = new Set(Object.entries(S.spots).filter(([id]) => id !== exceptId && S.visible.includes(id)).map(([, s]) => s));
    return C.SPOTS.filter((s) => s.id !== 'bowl' && !used.has(s.id));
  }

  function spotById(id) { return C.SPOTS.find((s) => s.id === id) || C.SPOTS[0]; }

  function syncScene() {
    const floor = $('clFloor');
    if (!floor || !lounge()) return;
    const next = pickVisible();
    // Remove cats that left the room
    Object.keys(S.nodes).forEach((id) => {
      if (!next.includes(id)) {
        const n = S.nodes[id];
        if (n) {
          n.classList.add('leaving');
          setTimeout(() => { if (n.parentNode) n.remove(); }, 500);
        }
        delete S.nodes[id];
        delete S.spots[id];
        clearTimeout(S.roamTimers[id]);
        clearTimeout(S.blinkTimers[id]);
        delete S.roamTimers[id];
        delete S.blinkTimers[id];
      }
    });
    S.visible = next;
    next.forEach((id, i) => {
      const existing = S.nodes[id];
      if (!existing || !existing.isConnected) {
        addCat(id, i);
      } else {
        existing.classList.remove('leaving');
        if (!S.roamTimers[id]) scheduleRoam(id);
        if (!S.blinkTimers[id]) scheduleBlink(id);
      }
      decorateCat(id);
    });
    const hint = $('clHint');
    if (hint) hint.classList.toggle('gone', !!S.sel);
  }

  function addCat(id, i) {
    const def = C.BY_ID[id];
    const floor = $('clFloor');
    const el = document.createElement('div');
    el.className = `cl-cat r-${def.rarity}`;
    el.dataset.id = id;
    el.id = `clCat_${id}`;
    el.innerHTML = `
      <div class="cl-cat-ring"></div>
      <div class="cl-cat-shadow"></div>
      <div class="cl-cat-hop">
        <div class="cl-cat-react">
          <div class="cl-cat-flip">
            <div class="cl-cat-body">
              ${def.rarity === 'mythic' ? '<div class="cl-cat-aura"></div>' : ''}
              <img class="eo" src="${sprite(id)}" alt="${def.name}" draggable="false">
              <img class="es" src="${sprite(id, true)}" alt="" draggable="false" aria-hidden="true">
            </div>
          </div>
        </div>
      </div>
      <div class="cl-cat-zzz"><i>z</i><i>z</i><i>Z</i></div>
      <div class="cl-cat-bubble"></div>
      <button class="cl-gift" data-c="gift" data-id="${id}" id="clGift_${id}" aria-label="Open ${def.name}'s gift"><i class="lid"></i><i class="box"></i><i class="bow"></i></button>
      <div class="cl-cat-name">${def.name}</div>`;
    floor.appendChild(el);
    S.nodes[id] = el;
    // Pick a spot: nappers prefer cosy places, new arrivals walk in from the door (right side)
    const free = freeSpots(id);
    const pref = isNapping(id) ? free.filter((s) => s.nap) : free;
    const spot = (pref.length ? pref : free)[0] ? pick(pref.length ? pref : free) : C.SPOTS[i % C.SPOTS.length];
    S.spots[id] = spot.id;
    const fresh = catState(id) && Date.now() - (catState(id).at || 0) < 15000;
    if (fresh && !reduced) {
      place(el, { x: 104, y: spot.y, s: spot.s }, true);
      requestAnimationFrame(() => requestAnimationFrame(() => walkTo(id, spot)));
    } else {
      place(el, spot, true);
      el.classList.add('pop-in');
      el.style.animationDelay = `${i * 70}ms`;
    }
    scheduleRoam(id);
    scheduleBlink(id);
  }

  function place(el, spot, instant) {
    if (instant) el.style.transition = 'none';
    el.style.left = `${spot.x}%`;
    el.style.bottom = `${spot.y}%`;
    el.style.setProperty('--s', spot.s);
    el.style.zIndex = String(100 - Math.round(spot.y));
    if (instant) { void el.offsetWidth; el.style.transition = ''; }
  }

  function walkTo(id, spot) {
    const el = S.nodes[id];
    if (!el) return;
    const curX = parseFloat(el.style.left) || spot.x;
    const dist = Math.hypot(spot.x - curX, spot.y - (parseFloat(el.style.bottom) || spot.y));
    const dur = Math.max(0.7, Math.min(2.6, dist / 26));
    el.style.setProperty('--walk', `${dur}s`);
    el.classList.toggle('flip', spot.x < curX);
    el.classList.add('walking');
    // Jumping up to the sofa / tree / box is a hop, not a walk
    if (Math.abs(spot.y - (parseFloat(el.style.bottom) || 0)) > 18) el.classList.add('leap');
    place(el, spot);
    clearTimeout(el._walkT);
    el._walkT = setTimeout(() => { el.classList.remove('walking', 'leap'); }, dur * 1000);
  }

  function scheduleRoam(id) {
    clearTimeout(S.roamTimers[id]);
    S.roamTimers[id] = setTimeout(() => {
      if (!S.open || !S.nodes[id]) return;
      const busy = (S.sel === id && (S.petting || S.feeding)) || (S.play && S.play.id === id) || isNapping(id);
      if (!busy && document.visibilityState === 'visible') {
        const free = freeSpots(id).filter((s) => s.id !== S.spots[id]);
        if (free.length) {
          const s = pick(free);
          S.spots[id] = s.id;
          walkTo(id, s);
        }
      }
      scheduleRoam(id);
    }, rand(7000, 15000));
  }

  function scheduleBlink(id) {
    clearTimeout(S.blinkTimers[id]);
    S.blinkTimers[id] = setTimeout(() => {
      const el = S.nodes[id];
      if (!el || !S.open) return;
      if (!el.classList.contains('asleep') && !el.classList.contains('bliss')) {
        el.classList.add('blink');
        setTimeout(() => el.classList.remove('blink'), 130);
        // Sometimes a double-blink — very cat
        if (Math.random() < 0.25) setTimeout(() => { el.classList.add('blink'); setTimeout(() => el.classList.remove('blink'), 110); }, 280);
      }
      // Little idle flourishes
      if (Math.random() < 0.18 && !el.classList.contains('asleep')) react(id, pick(['tilt', 'wiggle', 'stretch']));
      scheduleBlink(id);
    }, rand(2200, 5600));
  }

  const WANT_ICON = { hunger: null, love: '💕', fun: '🧶' };

  /** Update one cat's mood / nap / bubble / gift visuals from the latest state. */
  function decorateCat(id) {
    const el = S.nodes[id];
    if (!el) return;
    const def = C.BY_ID[id];
    const n = needs(id);
    const mood = C.moodOf(n);
    const mi = C.moodInfo(mood);
    el.classList.remove('m-joy', 'm-happy', 'm-okay', 'm-sulky');
    el.classList.add(`m-${mi.key}`);
    el.classList.toggle('sel', S.sel === id);
    const nap = isNapping(id);
    el.classList.toggle('asleep', nap);
    const want = C.wantOf(n);
    const bubble = el.querySelector('.cl-cat-bubble');
    let b = '';
    if (!nap) {
      if (mi.key === 'sulky') b = '<span class="cloud">☁️</span>';
      else if (want) b = want === 'hunger' ? def.food : WANT_ICON[want];
      else if (mi.key === 'joy') b = '<span class="heart">♥</span>';
    }
    if (bubble.dataset.b !== b) {
      bubble.dataset.b = b;
      bubble.innerHTML = b;
      bubble.classList.toggle('on', !!b);
      bubble.classList.toggle('soft', mi.key === 'joy');
    }
    el.classList.toggle('has-gift', giftReady(id));
    el.style.setProperty('--glow', C.RARITY[def.rarity].glow);
  }

  function react(id, kind, ms) {
    const el = S.nodes[id];
    if (!el) return;
    const r = el.querySelector('.cl-cat-react');
    const cls = `rx-${kind}`;
    r.classList.remove(cls); void r.offsetWidth; r.classList.add(cls);
    clearTimeout(r[`_${kind}`]);
    r[`_${kind}`] = setTimeout(() => r.classList.remove(cls), ms || 900);
  }

  function say(id, html, ms = 1600) {
    const el = S.nodes[id];
    if (!el) return;
    let sp = el.querySelector('.cl-cat-say');
    if (!sp) { sp = document.createElement('div'); sp.className = 'cl-cat-say'; el.appendChild(sp); }
    sp.innerHTML = html;
    sp.classList.remove('on'); void sp.offsetWidth; sp.classList.add('on');
    clearTimeout(sp._t);
    sp._t = setTimeout(() => sp.classList.remove('on'), ms);
  }

  // ---------------------------------------------------------------------------
  // ✨ Particles (in world coordinates so they stick to the cats)
  // ---------------------------------------------------------------------------
  function worldPoint(clientX, clientY) {
    const w = $('clWorld').getBoundingClientRect();
    return { x: ((clientX - w.left) / w.width) * 100, y: ((clientY - w.top) / w.height) * 100 };
  }
  function catHead(id) {
    const el = S.nodes[id];
    if (!el) return { x: 50, y: 50 };
    const r = el.querySelector('.cl-cat-body').getBoundingClientRect();
    return worldPoint(r.left + r.width / 2, r.top + r.height * 0.28);
  }
  function catFeet(id) {
    const el = S.nodes[id];
    if (!el) return { x: 50, y: 90 };
    const r = el.querySelector('.cl-cat-body').getBoundingClientRect();
    return worldPoint(r.left + r.width / 2, r.bottom - r.height * 0.04);
  }
  function fx(cls, html, at, vars = {}, life = 1400) {
    const layer = $('clFx');
    if (!layer) return null;
    const p = document.createElement('span');
    p.className = `cl-p ${cls}`;
    p.innerHTML = html;
    p.style.left = `${at.x}%`;
    p.style.top = `${at.y}%`;
    Object.entries(vars).forEach(([k, v]) => p.style.setProperty(k, v));
    layer.appendChild(p);
    setTimeout(() => p.remove(), life);
    return p;
  }
  function hearts(at, n = 3) {
    for (let i = 0; i < n; i++) {
      fx('heart', pick(['💗', '💕', '💖', '♥', '💞']), { x: at.x + rand(-3, 3), y: at.y + rand(-2, 2) }, { '--dx': `${rand(-40, 40).toFixed(0)}px`, '--dy': `${rand(-90, -50).toFixed(0)}px`, '--r': `${rand(-30, 30).toFixed(0)}deg`, '--delay': `${i * 80}ms` }, 1600);
    }
  }
  function sparkles(at, n = 6, color) {
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + rand(-0.3, 0.3);
      fx('spark', '✦', at, { '--dx': `${(Math.cos(a) * rand(30, 60)).toFixed(0)}px`, '--dy': `${(Math.sin(a) * rand(30, 60)).toFixed(0)}px`, '--c': color || '#fde68a' }, 900);
    }
  }
  function pop(at, html, cls = '') { fx(`pop ${cls}`, html, at, {}, 1500); }

  /** Fly glyphs from a screen rect to a pill. */
  function flyTo(fromRect, glyph, count, pillId, sound) {
    const target = $(pillId);
    if (!target || !fromRect || reduced) { bumpPill(pillId); return; }
    const b = target.getBoundingClientRect();
    const sx = fromRect.left + fromRect.width / 2; const sy = fromRect.top + fromRect.height / 2;
    const tx = b.left + 14; const ty = b.top + b.height / 2;
    for (let i = 0; i < count; i++) {
      const g = document.createElement('span');
      g.className = 'cl-fly';
      g.textContent = glyph;
      g.style.left = `${sx}px`; g.style.top = `${sy}px`;
      document.body.appendChild(g);
      const ang = rand(0, Math.PI * 2); const rad = rand(30, 70);
      const anim = g.animate([
        { transform: 'translate(-50%,-50%) scale(0.3)', opacity: 0 },
        { transform: `translate(calc(-50% + ${Math.cos(ang) * rad}px), calc(-50% + ${Math.sin(ang) * rad - 24}px)) scale(1.2) rotate(${rand(-30, 30)}deg)`, opacity: 1, offset: 0.3 },
        { transform: `translate(calc(-50% + ${tx - sx}px), calc(-50% + ${ty - sy}px)) scale(0.5)`, opacity: 0.9 }
      ], { duration: rand(700, 1000), delay: i * 50, easing: 'cubic-bezier(0.45, 0, 0.7, 0.2)', fill: 'forwards' });
      anim.onfinish = () => { g.remove(); bumpPill(pillId); if (sound) sound(); };
    }
  }

  // ---------------------------------------------------------------------------
  // 🫶 Pointer: tap = select, rub = pet, play mode = move the feather
  // ---------------------------------------------------------------------------
  function onPointerDown(e) {
    if (S.play) { movePlayTarget(e); return; }
    if (e.target.closest('.cl-gift')) return;
    const catEl = e.target.closest('.cl-cat');
    if (!catEl) return;
    const id = catEl.dataset.id;
    S.ptr = { id, x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, dist: 0, rub: 0, pid: e.pointerId };
    try { $('clScene').setPointerCapture(e.pointerId); } catch (err) {}
  }

  function onPointerMove(e) {
    if (S.play) { movePlayTarget(e); return; }
    if (!S.ptr || e.pointerId !== S.ptr.pid) return;
    const d = Math.hypot(e.clientX - S.ptr.lx, e.clientY - S.ptr.ly);
    S.ptr.lx = e.clientX; S.ptr.ly = e.clientY;
    S.ptr.dist += d;
    if (!S.petting && S.ptr.dist > 14) startPet(S.ptr.id);
    if (S.petting) {
      // Only strokes that are actually over the cat count
      const body = S.nodes[S.ptr.id] && S.nodes[S.ptr.id].querySelector('.cl-cat-body').getBoundingClientRect();
      const over = body && e.clientX > body.left - 10 && e.clientX < body.right + 10 && e.clientY > body.top - 10 && e.clientY < body.bottom + 10;
      if (!over) return;
      S.ptr.rub += d;
      if (S.ptr.rub > 70) {
        S.ptr.rub = 0;
        stroke(S.ptr.id, e.clientX, e.clientY);
      }
    }
  }

  function onPointerUp(e) {
    if (S.play) return;
    if (!S.ptr) return;
    const p = S.ptr;
    S.ptr = null;
    try { $('clScene').releasePointerCapture(p.pid); } catch (err) {}
    if (S.petting) { endPet(); return; }
    if (p.dist < 14) tapCat(p.id);
  }

  function tapCat(id) {
    const def = C.BY_ID[id];
    const wasNapping = isNapping(id);
    if (wasNapping) {
      S.woke[id] = napWindow();
      decorateCat(id);
      react(id, 'stretch', 1100);
      say(id, pick(['*yawn* 🥱', 'mrrrp…?', '5 more minutes…']));
      Sound.meow(def.meow * 0.85, 0.06, true);
    } else {
      react(id, 'hop', 600);
      Sound.meow(def.meow, 0.07, Math.random() < 0.5);
      say(id, pick(['mrrp? 💕', 'meow!', 'nya~', `*${def.name} stares*`, 'prrrt!', '♡']), 1300);
    }
    hearts(catHead(id), 1);
    select(id);
  }

  function select(id) {
    if (S.sel !== id) {
      S.sel = id;
      Object.keys(S.nodes).forEach(decorateCat);
      renderCare();
      renderRoster();
      const hint = $('clHint'); if (hint) hint.classList.add('gone');
    }
  }

  function startPet(id) {
    const el = S.nodes[id];
    if (!el) return;
    S.petting = id;
    S.woke[id] = napWindow();
    select(id);
    el.classList.add('bliss');
    el.classList.remove('asleep');
    Sound.purrStart();
    haptic(10);
  }

  function stroke(id, cx, cy) {
    const at = worldPoint(cx, cy);
    hearts({ x: at.x, y: at.y - 2 }, Math.random() < 0.5 ? 2 : 1);
    Sound.heart();
    react(id, 'squish', 380);
    haptic(6);
    const now = Date.now();
    if (now - S.lastPetSent > 720) {
      S.lastPetSent = now;
      S.lastPetAt = at;
      send({ type: 'vault_cat_care', catId: id, action: 'pet' });
    }
  }

  function endPet() {
    if (!S.petting) return;
    const id = S.petting;
    S.petting = null;
    Sound.purrStop();
    const el = S.nodes[id];
    if (el) {
      el.classList.remove('bliss');
      react(id, 'wiggle', 800);
      decorateCat(id);
    }
  }

  // ---------------------------------------------------------------------------
  // 🍣 Feed
  // ---------------------------------------------------------------------------
  function feed(id, fromPartner) {
    const el = S.nodes[id];
    const def = C.BY_ID[id];
    if (!el) return;
    S.feeding = true;
    const feet = catFeet(id);
    const bowl = fx('bowl', `<span class="food">${def.food}${def.food}${def.food}</span><span class="dish"></span>${fromPartner ? `<em>${partnerRole().toUpperCase()}</em>` : ''}`, { x: feet.x + (el.classList.contains('flip') ? -6 : 6), y: feet.y - 1 }, {}, 3200);
    setTimeout(() => {
      el.classList.add('nom');
      Sound.chomp();
      say(id, pick(['nom nom nom', 'mmm~ 😋', '*crunch crunch*', 'nyom!']), 1500);
      let k = 0;
      const crumbs = setInterval(() => {
        const at = catFeet(id);
        fx('crumb', '', { x: at.x + rand(-4, 4), y: at.y - rand(2, 6) }, { '--dx': `${rand(-30, 30).toFixed(0)}px`, '--dy': `${rand(-30, -10).toFixed(0)}px` }, 700);
        if (++k > 6) clearInterval(crumbs);
      }, 180);
    }, 520);
    setTimeout(() => {
      if (bowl) bowl.classList.add('empty');
      el.classList.remove('nom');
      react(id, 'hop', 600);
      hearts(catHead(id), 3);
      S.feeding = false;
      decorateCat(id);
    }, 2100);
  }

  // ---------------------------------------------------------------------------
  // 🪶 Play — a feather on a string; the cat stalks it and pounces
  // ---------------------------------------------------------------------------
  function startPlay(id) {
    const el = S.nodes[id];
    if (!el || S.play) return;
    endPet();
    S.woke[id] = napWindow();
    decorateCat(id);
    const layer = $('clFx');
    const wand = document.createElement('div');
    wand.className = 'cl-wand';
    wand.innerHTML = '<i class="string"></i><span class="feather">🪶</span><i class="bead"></i>';
    layer.appendChild(wand);
    const start = catHead(id);
    S.play = {
      id, wand, catches: 0, lastPounce: 0, lastInput: 0, t0: performance.now(),
      wx: start.x + 10, wy: 30, tx: start.x + 10, ty: 40, vx: 0,
      cx: parseFloat(el.style.left), sent: false
    };
    el.classList.add('stalking');
    el.style.transition = 'none';
    $('clScene').classList.add('playing');
    $('clPlayHud').classList.remove('hidden');
    $('clPlayCount').textContent = `0/3`;
    say(id, '👀 !!', 1000);
    Sound.meow(C.BY_ID[id].meow * 1.1, 0.06, true);
    requestAnimationFrame(playLoop);
  }

  function movePlayTarget(e) {
    if (!S.play) return;
    const at = worldPoint(e.clientX, e.clientY);
    S.play.tx = Math.max(8, Math.min(92, at.x));
    S.play.ty = Math.max(8, Math.min(94, at.y));
    S.play.lastInput = performance.now();
  }

  function playLoop(now) {
    const P = S.play;
    if (!P) return;
    const el = S.nodes[P.id];
    if (!el) { endPlay(true); return; }
    // Idle: the toy dangles and dips on its own so the cat still has fun
    if (now - P.lastInput > 1400) {
      const t = (now - P.t0) / 1000;
      P.tx = P.cx + Math.sin(t * 1.3) * 16;
      P.ty = 52 + Math.sin(t * 2.1) * 26;
    }
    const px = P.wx;
    P.wx += (P.tx - P.wx) * 0.22;
    P.wy += (P.ty - P.wy) * 0.22;
    P.vx = P.wx - px;
    P.wand.style.left = `${P.wx}%`;
    P.wand.style.top = `${P.wy}%`;
    P.wand.style.setProperty('--sway', `${Math.max(-35, Math.min(35, -P.vx * 9))}deg`);
    // The cat stalks horizontally along the floor
    const spot = spotById(S.spots[P.id]);
    const dx = P.wx - P.cx;
    if (!el.classList.contains('pounce')) {
      P.cx += Math.max(-0.55, Math.min(0.55, dx * 0.035));
      P.cx = Math.max(14, Math.min(86, P.cx));
      el.style.left = `${P.cx}%`;
      if (Math.abs(dx) > 2) el.classList.toggle('flip', dx < 0);
      el.classList.toggle('crouch', Math.abs(dx) < 16);
    }
    // Pounce when the feather dips close to the cat
    const head = catHead(P.id);
    const near = Math.abs(P.wx - P.cx) < 9 && P.wy > head.y - 22 && P.wy < head.y + 26;
    if (near && now - P.lastPounce > 950 && !el.classList.contains('pounce')) {
      P.lastPounce = now;
      el.classList.add('pounce');
      Sound.boing();
      setTimeout(() => {
        if (!S.play) return;
        const h = catHead(P.id);
        const caught = Math.abs(P.wx - P.cx) < 12 && Math.abs(P.wy - h.y) < 30;
        if (caught) {
          P.catches += 1;
          Sound.catch();
          sparkles({ x: P.wx, y: P.wy }, 7, '#a5f3fc');
          P.wand.classList.remove('hit'); void P.wand.offsetWidth; P.wand.classList.add('hit');
          pop({ x: P.wx, y: P.wy - 6 }, P.catches >= 3 ? 'Gotcha!! 🎉' : pick(['catch!', 'got it!', 'pounce!']));
          $('clPlayCount').textContent = `${Math.min(3, P.catches)}/3`;
          haptic([8, 30, 8]);
          if (P.catches >= 3 && !P.sent) {
            P.sent = true;
            send({ type: 'vault_cat_care', catId: P.id, action: 'play' });
            setTimeout(() => endPlay(false), 900);
          }
        } else {
          pop({ x: h.x, y: h.y - 8 }, pick(['missed! 😼', 'so close…', 'hmph']), 'miss');
        }
      }, 260);
      setTimeout(() => el.classList.remove('pounce'), 620);
    }
    requestAnimationFrame(playLoop);
  }

  function endPlay(silent) {
    const P = S.play;
    if (!P) return;
    S.play = null;
    const el = S.nodes[P.id];
    P.wand.classList.add('bye');
    setTimeout(() => P.wand.remove(), 400);
    const scene = $('clScene'); if (scene) scene.classList.remove('playing');
    const hud = $('clPlayHud'); if (hud) hud.classList.add('hidden');
    if (el) {
      el.classList.remove('stalking', 'crouch', 'pounce');
      el.style.transition = '';
      // Settle onto the nearest free spot
      const free = freeSpots(P.id).concat([spotById(S.spots[P.id])]);
      const best = free.sort((a, b) => Math.abs(a.x - P.cx) + Math.abs(a.y - 10) * 0.5 - (Math.abs(b.x - P.cx) + Math.abs(b.y - 10) * 0.5))[0];
      S.spots[P.id] = best.id;
      walkTo(P.id, best);
      if (!silent && P.catches >= 3) { react(P.id, 'dance', 1400); hearts(catHead(P.id), 4); }
    }
    renderCare();
  }

  // ---------------------------------------------------------------------------
  // 🎁 Gifts
  // ---------------------------------------------------------------------------
  function openGift(id, btn) {
    if (!btn || btn.disabled) return;
    btn.disabled = true;
    btn.classList.add('opening');
    Sound.rattle();
    S.giftFrom = btn.getBoundingClientRect();
    react(id, 'hop', 600);
    setTimeout(() => send({ type: 'vault_cat_gift', catId: id, reqId: `g_${Date.now()}` }), 450);
    setTimeout(() => { btn.disabled = false; btn.classList.remove('opening'); }, 4000);
  }

  function onGiftResult(msg) {
    const def = C.BY_ID[msg.catId];
    const it = msg.items || {};
    const from = S.giftFrom || centerRect();
    S.giftFrom = null;
    Sound.gift();
    const node = S.nodes[msg.catId];
    if (node) {
      const btn = node.querySelector('.cl-gift');
      if (btn) { btn.classList.remove('opening'); btn.classList.add('burst'); setTimeout(() => btn.classList.remove('burst'), 900); }
      sparkles(catHead(msg.catId), 10, C.RARITY[def.rarity].color);
      say(msg.catId, pick(['for you! 🎁', 'I found this~', 'a present 💝', '*proud mrrp*']), 1800);
    }
    if (it.fish) flyTo(from, '🐟', Math.min(10, 4 + Math.round(it.fish / 3)), 'clFishPill', Sound.fish);
    if (it.diamonds) setTimeout(() => flyTo(from, '💎', Math.min(10, 4 + Math.round(it.diamonds / 3)), 'clGemPill', Sound.fish), 200);
    if (it.stardust) setTimeout(() => flyTo(from, '✨', 6, 'clGemPill'), 350);
    const parts = [`🐟 ${it.fish}`];
    if (it.diamonds) parts.push(`<em class="t-mythic">💎 ${it.diamonds}</em>`);
    if (it.stardust) parts.push(`✨ ${it.stardust} stardust`);
    toast(`<div><b>🎁 ${def.name} brought you a gift!</b><span>${parts.join(' · ')}</span></div>`, 'cl-toast', 3600);
  }

  // ---------------------------------------------------------------------------
  // Care card / roster / activity feed
  // ---------------------------------------------------------------------------
  function bar(key, icon, label, v) {
    const lvl = v < 30 ? 'low' : v < 60 ? 'mid' : 'high';
    return `
      <div class="cl-need n-${key} ${lvl}">
        <span class="cl-need-ic">${icon}</span>
        <div class="cl-need-main"><div class="cl-need-top"><b>${label}</b><em>${Math.round(v)}</em></div><div class="cl-need-bar"><i style="width:${v}%"></i></div></div>
      </div>`;
  }

  function stars(n) {
    return Array.from({ length: E.MAX_STARS }, (_, i) => `<i class="${i < n ? 'on' : ''}">★</i>`).join('');
  }

  function renderCare() {
    const box = $('clCare');
    if (!box || !lounge()) return;
    const id = S.sel && catState(S.sel) ? S.sel : null;
    if (!id) { box.innerHTML = summaryCard(); return; }
    const def = C.BY_ID[id];
    const st = catState(id);
    const n = needs(id);
    const mood = C.moodOf(n);
    const mi = C.moodInfo(mood);
    const R = C.RARITY[def.rarity];
    const st2 = st.care || {};
    const b = st2.bkk || 0; const d = st2.dxb || 0;
    const bkkPct = b + d ? Math.round((b / (b + d)) * 100) : 50;
    const gift = giftReady(id);
    const capped = myDay().careFish >= E.CARE_FISH_CAP;
    const full = n.hunger >= E.FULL_AT;
    const tired = n.fun >= E.TIRED_AT;
    box.innerHTML = `
      <article class="cl-card r-${def.rarity}" style="--rc:${R.color};--rg:${R.glow}">
        <div class="cl-card-top">
          <button class="cl-card-thumb" data-c="hello" data-id="${id}" id="clCardThumb" aria-label="Say hi to ${def.name}"><img src="${sprite(id)}" alt=""></button>
          <div class="cl-card-id">
            <div class="cl-card-name"><b>${def.name}</b><span class="cl-rpill">${R.label}</span></div>
            <div class="cl-stars" title="Stars — duplicates add a star">${stars(st.stars || 1)}</div>
            <small>${def.breed} · <span class="cl-mood m-${mi.key}">${mi.emoji} ${mi.label}</span></small>
          </div>
          ${gift ? `<button class="cl-card-gift" data-c="gift" data-id="${id}" id="clCardGift">🎁<span>Gift!</span></button>` : ''}
        </div>
        <p class="cl-line">“${def.line}”${def.perkText ? `<span class="cl-perk">✦ ${def.perkText}</span>` : ''}</p>
        <div class="cl-needs">
          ${bar('hunger', def.food, 'Hunger', n.hunger)}
          ${bar('love', '💕', 'Love', n.love)}
          ${bar('fun', '🧶', 'Fun', n.fun)}
        </div>
        ${isCoupleActive() ? `
        <div class="cl-bond">
          <span class="cl-bond-l">BKK</span>
          <div class="cl-bond-bar"><i style="width:${bkkPct}%"></i><b style="left:${bkkPct}%">💗</b></div>
          <span class="cl-bond-r">DXB</span>
          <small>${bondText(id)}</small>
        </div>` : (() => {
          const sb = soloBondData(id);
          return `
        <div class="cl-bond cl-bond-solo">
          <span class="cl-bond-l">🐾 Affection</span>
          <div class="cl-bond-bar"><i style="width:${sb.pct}%"></i><b style="left:${sb.pct}%">💖</b></div>
          <span class="cl-bond-r">Lv.${sb.level}</span>
          <small>${sb.text}</small>
        </div>`;
        })()}
        <div class="cl-actions">
          <button class="cl-act feed ${full ? 'meh' : ''}" data-c="feed" data-id="${id}" id="clActFeed"><span class="ic">${def.food}</span><b>Feed</b><small>${full ? 'Full 😽' : capped ? 'Yum' : `+${E.CARE_FISH.feed}🐟`}</small></button>
          <button class="cl-act pet" data-c="pet" data-id="${id}" id="clActPet"><span class="ic">🫶</span><b>Pet</b><small>${capped ? 'Rub me' : `+${E.CARE_FISH.pet}🐟 / rub`}</small></button>
          <button class="cl-act brush" data-c="brush" data-id="${id}" id="clActBrush"><span class="ic">🪮</span><b>Brush</b><small>${capped ? 'Groom' : `+${(E.CARE_FISH && E.CARE_FISH.brush) || 2}🐟`}</small></button>
          <button class="cl-act play ${tired ? 'meh' : ''}" data-c="play" data-id="${id}" id="clActPlay"><span class="ic">🪶</span><b>Play</b><small>${tired ? 'Sleepy 😴' : capped ? 'Zoomies' : `+${E.CARE_FISH.play}🐟`}</small></button>
        </div>
      </article>`;
  }

  function summaryCard() {
    const L = lounge();
    const day = myDay();
    const fed = L.fed && L.fed.day === today() ? L.fed : { bkk: false, dxb: false, paid: false };
    const cap = C.giftCap(owned());
    const ready = ownedIds().filter(giftReady).length;
    const hungry = ownedIds().filter((id) => needs(id).hunger < 40).length;
    return `
      <article class="cl-card summary">
        <div class="cl-sum-head"><b>Welcome to the lounge 🐾</b><small>Tap any cat to care for it</small></div>
        <div class="cl-sum-grid">
          <div class="cl-sum"><span>🐟</span><b>${day.careFish}/${E.CARE_FISH_CAP}</b><small>care fish today</small><div class="cl-need-bar"><i style="width:${(day.careFish / E.CARE_FISH_CAP) * 100}%"></i></div></div>
          <div class="cl-sum"><span>🎁</span><b>${day.gifts}/${cap}</b><small>gifts opened${ready ? ` · <em>${ready} waiting</em>` : ''}</small><div class="cl-need-bar gold"><i style="width:${(day.gifts / cap) * 100}%"></i></div></div>
        </div>
        ${isCoupleActive() ? `
        <div class="cl-handoff ${fed.paid ? 'done' : ''}">
          <span class="cl-ho-ic">🤝</span>
          <div><b>Shift handoff</b><small>${fed.paid ? `Both of you fed the cats today — +${E.HANDOFF_BONUS}🐟 each collected!` : `When BKK <i>and</i> DXB both feed a cat today: <b>+${E.HANDOFF_BONUS}🐟 each</b>`}</small></div>
          <div class="cl-ho-who"><span class="${fed.bkk ? 'on' : ''}">BKK</span><span class="${fed.dxb ? 'on' : ''}">DXB</span></div>
        </div>
        ` : `
        <div class="cl-handoff cl-handoff-locked">
          <span class="cl-ho-ic">🔒</span>
          <div><b>Couple Shift Handoff Locked</b><small>Link a partner in Couple Sanctuary to unlock daily double-feed bonus (+${E.HANDOFF_BONUS}🐟 each)!</small></div>
        </div>
        `}
        <p class="cl-sum-tip">${hungry ? `🍣 ${hungry} hungry cat${hungry === 1 ? '' : 's'} · ` : ''}${isCoupleActive() ? `🫶 Pet the same cat at the same time as ${partnerRole().toUpperCase()} for a <b>double purr</b> bonus (${day.doublePets}/${E.DOUBLE_PET_MAX})` : `🐾 Feed and pet your cute cats to earn fish and unlock daily lounge gifts!`}</p>
      </article>`;
  }

  function renderRoster() {
    const box = $('clRoster');
    if (!box) return;
    const ids = ownedIds();
    const note = $('clRosterNote');
    if (note) note.textContent = ids.length > E.LOUNGE_VISIBLE ? `${E.LOUNGE_VISIBLE} in the room · tap to invite` : `${ids.length} in the room`;
    box.innerHTML = ids.map((id) => {
      const def = C.BY_ID[id];
      const mi = C.moodInfo(moodOfCat(id));
      return `
        <button class="cl-ros r-${def.rarity} ${S.sel === id ? 'on' : ''} ${S.visible.includes(id) ? 'here' : ''}" data-c="summon" data-id="${id}" id="clRos_${id}" title="${def.name}">
          <img src="${sprite(id)}" alt="" loading="lazy">
          <i class="mood m-${mi.key}"></i>
          ${giftReady(id) ? '<i class="gdot">🎁</i>' : ''}
          <span>${def.name}</span>
        </button>`;
    }).join('') + `<button class="cl-ros add" data-c="tab" data-tab="capsule" id="clRosAdd"><b>＋</b><span>Adopt</span></button>`;
  }

  function summon(id) {
    select(id);
    if (!S.visible.includes(id)) {
      // Swap out the cat that's been in the room the longest (never the selected one)
      const out = S.visible.find((x) => x !== id) || S.visible[0];
      S.visible = S.visible.map((x) => (x === out ? id : x));
      if (S.visible.length < E.LOUNGE_VISIBLE && !S.visible.includes(id)) S.visible.push(id);
      syncScene();
      setTimeout(() => { const def = C.BY_ID[id]; if (def) { Sound.meow(def.meow, 0.06, true); say(id, 'I’m here! 💕', 1200); } }, 350);
    } else {
      react(id, 'hop', 600);
    }
  }

  const FEED_VERB = { feed: 'fed', play: 'played with', gift: 'opened a gift from', pull: 'adopted', pet: 'petted', brush: 'brushed' };
  function addFeed(role, action, catId, extra) {
    const def = C.BY_ID[catId];
    if (!def) return;
    S.feed.unshift({ t: Date.now(), role, action, catId, extra });
    if (S.feed.length > 4) S.feed.length = 4;
    renderFeed();
  }
  function renderFeed() {
    const box = $('clFeed');
    if (!box) return;
    if (!S.feed.length) {
      const L = lounge();
      const recent = (L && L.log ? L.log : []).slice(0, 3).map((x) => ({ ...x, action: x.kind }));
      S.feed = recent;
    }
    box.innerHTML = S.feed.slice(0, 3).map((f) => {
      const def = C.BY_ID[f.catId];
      if (!def) return '';
      const who = f.role === myRole() ? 'You' : f.role.toUpperCase();
      const ago = timeAgo(f.t);
      return `<div class="cl-feed-row"><img src="${sprite(f.catId)}" alt=""><span><b>${who}</b> ${FEED_VERB[f.action] || f.action} <b>${def.name}</b></span><small>${ago}</small></div>`;
    }).join('');
  }
  function timeAgo(t) {
    const s = Math.max(0, (Date.now() - t) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
  }

  // ---------------------------------------------------------------------------
  // 🎰 Kitty Capsule
  // ---------------------------------------------------------------------------
  function renderCapsule() {
    const box = $('clViewCapsule');
    if (!box) return;
    if (!lounge()) { box.innerHTML = waitingHtml(); return; }
    const p = me() || {};
    const pity = p.catPity || { epic: 0, mythic: 0 };
    const fish = p.fish || 0;
    const epicIn = Math.max(1, E.EPIC_PITY - pity.epic);
    const mythIn = Math.max(1, E.MYTHIC_HARD - pity.mythic);
    const o = owned();
    const mythics = C.CATS.filter((c) => c.rarity === 'mythic');
    box.innerHTML = `
      <div class="cl-cap">
        <div class="cl-cap-stage">
          <div class="cl-cap-rays"></div>
          <div class="cl-cap-sparkles">${dust(10)}</div>
          <div class="cl-machine" id="clMachine">
            <img src="assets/ui/kitty_machine.png" alt="Kitty Capsule machine" draggable="false">
            <div class="cl-globe" aria-hidden="true">${['#f9a8d4', '#7dd3fc', '#c084fc', '#fff', '#f9a8d4', '#7dd3fc'].map((c, i) => `<i style="--c:${c};--i:${i}"></i>`).join('')}</div>
            <div class="cl-crank" id="clCrank" aria-hidden="true"><i></i></div>
            <div class="cl-chute" id="clChute" aria-hidden="true"></div>
          </div>
        </div>
        <div class="cl-odds">
          ${['common', 'rare', 'epic', 'mythic'].map((r) => `<span class="r-${r}"><i></i>${C.RARITY[r].label} <b>${r === 'common' ? Math.round((1 - E.RATES.mythic - E.RATES.epic - E.RATES.rare) * 100) : Math.round(E.RATES[r] * 100)}%</b></span>`).join('')}
        </div>
        <div class="cl-pity">
          <div><span>💜 Epic or better within</span><b>${epicIn}</b></div>
          <div><span>🌟 Mythic guaranteed within</span><b>${mythIn}</b></div>
        </div>
        <div class="cl-pull-row">
          <button class="cl-pull one" data-c="pull" data-n="1" id="clPull1" ${fish < E.PULL_1 ? 'disabled' : ''}><b>Adopt ×1</b><span>🐟 ${E.PULL_1}</span></button>
          <button class="cl-pull ten" data-c="pull" data-n="10" id="clPull10" ${fish < E.PULL_10 ? 'disabled' : ''}><em class="cl-pull-tag">Epic+ inside</em><b>Adopt ×10</b><span>🐟 ${E.PULL_10}</span></button>
        </div>
        <div class="cl-convert">
          <div class="cl-convert-head"><b>Need more fish?</b><small>Trade diamonds → fish (one-way)</small></div>
          <div class="cl-convert-row">
            ${E.CONVERT.map((c) => `<button class="cl-cv" data-c="convert" data-pack="${c.id}" id="clConvert_${c.id}" ${(p.diamonds || 0) < c.diamonds ? 'disabled' : ''}><span>💎 ${c.diamonds}</span><i>→</i><b>🐟 ${c.fish}</b>${c.fish > c.diamonds * 3 ? `<em>+${c.fish - c.diamonds * 3}</em>` : ''}</button>`).join('')}
          </div>
          <small class="cl-convert-tip">Earn fish free: feed 🍣 pet 🫶 play 🪶 (up to ${E.CARE_FISH_CAP}/day) and open cat gifts 🎁</small>
        </div>
        <div class="cl-myth">
          <div class="cl-myth-head"><b>✦ The five Mythics ✦</b><small>Each one changes the lounge a little</small></div>
          <div class="cl-myth-row">
            ${mythics.map((m) => `<div class="cl-myth-card ${o[m.id] ? 'have' : ''}" id="clMyth_${m.id}"><img src="${sprite(m.id)}" alt=""><b>${o[m.id] ? m.name : '???'}</b><small>${m.perkText}</small></div>`).join('')}
          </div>
        </div>
      </div>`;
  }

  function doPull(n) {
    if (S.pulling) return;
    const p = me() || {};
    const cost = n === 10 ? E.PULL_10 : E.PULL_1;
    if ((p.fish || 0) < cost) { toast(`🐟 Need ${cost} fish — care for the cats or trade some 💎`); return; }
    S.pulling = true;
    const reqId = `cp_${Date.now()}`;
    S.pending = { reqId, n };
    // Machine wind-up starts immediately; the reveal waits for the server
    const m = $('clMachine');
    if (m) { m.classList.remove('crank'); void m.offsetWidth; m.classList.add('crank'); }
    Sound.crank(8);
    document.querySelectorAll('#clViewCapsule .cl-pull').forEach((b) => { b.disabled = true; });
    send({ type: 'vault_cat_pull', count: n, reqId });
    S.pendingTimer = setTimeout(() => {
      if (!S.pending) return;
      S.pending = null; S.pulling = false;
      if (m) m.classList.remove('crank');
      toast('📡 The capsule machine didn’t answer — check your connection');
      renderCapsule();
    }, 9000);
  }

  function onPullResult(msg) {
    if (!S.pending || msg.reqId !== S.pending.reqId) return;
    clearTimeout(S.pendingTimer);
    S.pending = null;
    // Spend shows right away; the new cats join the lounge/Catdex once the reveal closes
    if (msg.profiles && msg.profiles.bkk) {
      S.pullProfiles = msg.profiles;
      const p = profiles();
      const r = myRole();
      if (p && p[r] && msg.profiles[r]) { p[r].fish = msg.profiles[r].fish; p[r].diamonds = msg.profiles[r].diamonds; renderHead(); }
    }
    const results = msg.results || [];
    results.forEach((r) => { const im = new Image(); im.src = sprite(r.id); });
    const best = results.reduce((a, b) => (C.RARITY[b.rarity].rank > C.RARITY[a.rarity].rank ? b : a), results[0]);
    const m = $('clMachine');
    setTimeout(() => {
      Sound.clunk();
      if (m) {
        m.classList.add('drop');
        const ch = $('clChute');
        if (ch) ch.style.setProperty('--cc', C.RARITY[best.rarity].color);
        if (best.rarity === 'mythic') m.classList.add('mythic-shake');
      }
    }, 900);
    setTimeout(() => {
      if (m) m.classList.remove('crank', 'drop', 'mythic-shake');
      showReveal(results);
    }, 1700);
  }

  // ---------------------------------------------------------------------------
  // Capsule reveal overlay
  // ---------------------------------------------------------------------------
  function capsuleHtml(rarity, i) {
    return `<div class="cl-capsule r-${rarity}" style="--i:${i || 0}"><i class="top"></i><i class="bot"></i><i class="band"></i><i class="shine"></i></div>`;
  }

  function showReveal(results) {
    const box = $('clReveal');
    S.reveal = { results, opened: new Set(), single: results.length === 1 };
    box.className = 'cl-reveal on';
    if (results.length === 1) {
      const r = results[0];
      box.innerHTML = `
        <div class="cl-rv-bg r-${r.rarity}"></div>
        <div class="cl-rv-rays r-${r.rarity}"></div>
        <div class="cl-rv-one" data-rv="open1">
          ${capsuleHtml(r.rarity)}
          <p class="cl-rv-hint">Tap the capsule to open it</p>
        </div>`;
      if (r.rarity === 'mythic') { box.classList.add('mythic'); Sound.sparkle(); }
      Sound.pop();
    } else {
      box.innerHTML = `
        <div class="cl-rv-bg r-${bestOf(results).rarity}"></div>
        <div class="cl-rv-ten">
          <h3>10 capsules!</h3>
          <div class="cl-rv-grid">${results.map((r, i) => `<button class="cl-rv-slot" data-rv="slot" data-i="${i}" id="clRvSlot_${i}">${capsuleHtml(r.rarity, i)}</button>`).join('')}</div>
          <div class="cl-rv-actions">
            <button class="cl-rv-btn" data-rv="openall" id="clRvOpenAll">✨ Open all</button>
          </div>
        </div>`;
      results.forEach((_, i) => setTimeout(() => Sound.tap(), i * 70));
    }
  }

  function bestOf(results) {
    return results.reduce((a, b) => (C.RARITY[b.rarity].rank > C.RARITY[a.rarity].rank ? b : a), results[0]);
  }

  function resultBadge(r) {
    if (r.isNew) return '<span class="cl-badge new">NEW!</span>';
    if (r.refund) return `<span class="cl-badge refund">★MAX · +${r.refund}🐟</span>`;
    return `<span class="cl-badge up">★ Star up · ${r.stars}★</span>`;
  }

  function bigCard(r) {
    const def = C.BY_ID[r.id];
    const R = C.RARITY[r.rarity];
    return `
      <div class="cl-rv-card r-${r.rarity}" style="--rc:${R.color};--rg:${R.glow}">
        <div class="cl-rv-burst"></div>
        <div class="cl-rv-conf">${confetti(r.rarity === 'mythic' ? 34 : r.rarity === 'epic' ? 24 : 14, R.color)}</div>
        <div class="cl-rv-cat"><img src="${sprite(r.id)}" alt="${def.name}"><img class="es" src="${sprite(r.id, true)}" alt=""></div>
        <div class="cl-rv-text">
          <span class="cl-rv-rar">${r.rarity === 'mythic' ? '✦ MYTHIC ✦' : R.label.toUpperCase()}</span>
          <h3>${def.name}</h3>
          <small>${def.breed}</small>
          ${resultBadge(r)}
          ${def.perkText ? `<p class="cl-rv-perk">✦ ${def.perkText}</p>` : ''}
        </div>
      </div>`;
  }

  function confetti(n, color) {
    const cols = [color, '#fff', '#fbcfe8', '#fde68a'];
    let h = '';
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2); const d = rand(80, 220);
      h += `<i style="--dx:${(Math.cos(a) * d).toFixed(0)}px;--dy:${(Math.sin(a) * d - 40).toFixed(0)}px;--c:${pick(cols)};--r:${rand(-360, 360).toFixed(0)}deg;--delay:${rand(0, 0.15).toFixed(2)}s"></i>`;
    }
    return h;
  }

  function onRevealClick(e) {
    const R = S.reveal;
    if (!R) return;
    const t = e.target.closest('[data-rv]');
    const action = t ? t.dataset.rv : null;
    if (R.single) {
      if (action === 'open1' && !R.opened.size) { openSingle(); return; }
      if (R.opened.size && R.done) { finishReveal(); return; }
      return;
    }
    if (action === 'slot') { openSlot(Number(t.dataset.i)); return; }
    if (action === 'openall') { openAll(); return; }
    if (action === 'done') { finishReveal(); return; }
    if (action === 'zoom') { zoomSlot(Number(t.dataset.i)); return; }
    if (action === 'unzoom') { const z = document.querySelector('.cl-rv-zoom'); if (z) z.remove(); }
  }

  function openSingle() {
    const R = S.reveal;
    const r = R.results[0];
    R.opened.add(0);
    const wrap = document.querySelector('.cl-rv-one');
    const cap = wrap.querySelector('.cl-capsule');
    cap.classList.add('cracking');
    Sound.rattle();
    haptic([10, 40, 10, 40, 20]);
    setTimeout(() => {
      Sound.crack();
      cap.classList.add('open');
      wrap.insertAdjacentHTML('beforeend', bigCard(r));
      const box = $('clReveal');
      box.classList.add('opened');
      setTimeout(() => { Sound.reveal(r.rarity); Sound.meow(C.BY_ID[r.id].meow, 0.08); }, 120);
      if (r.rarity === 'mythic' || r.rarity === 'epic') { haptic([30, 50, 80]); if (V() && V().diamondRain && r.rarity === 'mythic') V().diamondRain(400); }
      const hint = wrap.querySelector('.cl-rv-hint');
      if (hint) hint.textContent = 'Tap anywhere to continue';
      setTimeout(() => { R.done = true; }, 700);
      // Blink once she's out — alive!
      setTimeout(() => { const c = wrap.querySelector('.cl-rv-cat'); if (c) { c.classList.add('blink'); setTimeout(() => c.classList.remove('blink'), 140); } }, 1500);
    }, 900);
  }

  function openSlot(i) {
    const R = S.reveal;
    if (R.opened.has(i)) { zoomSlot(i); return; }
    R.opened.add(i);
    const r = R.results[i];
    const def = C.BY_ID[r.id];
    const slot = $(`clRvSlot_${i}`);
    if (!slot) return;
    const cap = slot.querySelector('.cl-capsule');
    cap.classList.add('cracking');
    setTimeout(() => {
      cap.classList.add('open');
      Sound.pop();
      slot.classList.add('revealed', `r-${r.rarity}`);
      slot.dataset.rv = 'zoom';
      slot.insertAdjacentHTML('beforeend', `<img class="cl-rv-thumb" src="${sprite(r.id)}" alt="${def.name}"><span class="cl-rv-name">${def.name}</span>${r.isNew ? '<em class="cl-rv-new">NEW</em>' : r.refund ? '<em class="cl-rv-new max">+🐟</em>' : `<em class="cl-rv-new up">${r.stars}★</em>`}`);
      if (r.rarity === 'epic' || r.rarity === 'mythic') { Sound.reveal(r.rarity); slot.classList.add('flash'); }
      if (R.opened.size === R.results.length) allOpened();
    }, reduced ? 50 : 380);
  }

  function openAll() {
    const R = S.reveal;
    const btn = $('clRvOpenAll'); if (btn) btn.disabled = true;
    // Commons first, the best saved for last
    const order = R.results.map((r, i) => i).filter((i) => !R.opened.has(i)).sort((a, b) => C.RARITY[R.results[a].rarity].rank - C.RARITY[R.results[b].rarity].rank);
    order.forEach((i, k) => setTimeout(() => openSlot(i), k * 260));
  }

  function allOpened() {
    const R = S.reveal;
    const best = bestOf(R.results);
    const news = R.results.filter((r) => r.isNew).length;
    const act = document.querySelector('.cl-rv-actions');
    if (act) act.innerHTML = `<span class="cl-rv-sum">${news ? `🎉 ${news} new cat${news === 1 ? '' : 's'}!` : 'Lots of star-ups ⭐'}</span><button class="cl-rv-btn" data-rv="done" id="clRvDone">Welcome them home 🏠</button>`;
    if (best.rarity === 'mythic') setTimeout(() => zoomSlot(R.results.indexOf(best)), 500);
  }

  function zoomSlot(i) {
    const r = S.reveal && S.reveal.results[i];
    if (!r) return;
    const box = $('clReveal');
    const old = box.querySelector('.cl-rv-zoom'); if (old) old.remove();
    box.insertAdjacentHTML('beforeend', `<div class="cl-rv-zoom" data-rv="unzoom">${bigCard(r)}<p class="cl-rv-hint">Tap to go back</p></div>`);
    Sound.reveal(r.rarity);
    Sound.meow(C.BY_ID[r.id].meow, 0.07, true);
  }

  function finishReveal() {
    const R = S.reveal;
    S.reveal = null;
    S.pulling = false;
    if (S.pullProfiles) {
      const fresh = S.pullProfiles;
      S.pullProfiles = null;
      if (V() && V().handleMessage) V().handleMessage({ type: 'vault_profiles', profiles: fresh });
    }
    const box = $('clReveal');
    box.classList.add('closing');
    setTimeout(() => { box.className = 'cl-reveal'; box.innerHTML = ''; }, 380);
    if (R) {
      const best = bestOf(R.results);
      // Bring the best new friend straight into the room
      S.sel = best.id;
      if (!S.visible.includes(best.id)) {
        const out = S.visible.find((x) => x !== best.id);
        if (S.visible.length >= E.LOUNGE_VISIBLE && out) S.visible = S.visible.map((x) => (x === out ? best.id : x));
        else S.visible.push(best.id);
      }
      setTab('lounge');
      setTimeout(() => {
        const def = C.BY_ID[best.id];
        say(best.id, R.results.find((r) => r.id === best.id && r.isNew) ? 'Hi! I live here now 💕' : 'Missed me? ✨', 1800);
        Sound.meow(def.meow, 0.07);
      }, 900);
    }
    renderAll();
  }

  // ---------------------------------------------------------------------------
  // 📖 Catdex
  // ---------------------------------------------------------------------------
  function renderDex() {
    const box = $('clViewDex');
    if (!box) return;
    if (!lounge()) { box.innerHTML = waitingHtml(); return; }
    const o = owned();
    const total = C.CATS.length;
    const have = ownedIds().length;
    const pct = (have / total) * 100;
    const ring = 2 * Math.PI * 30;
    const sections = ['mythic', 'epic', 'rare', 'common'].map((r) => {
      const list = C.CATS.filter((c) => c.rarity === r);
      const got = list.filter((c) => o[c.id]).length;
      return `
        <section class="cl-dex-sec r-${r}">
          <h4><span>${r === 'mythic' ? '✦ ' : ''}${C.RARITY[r].label}</span><em>${got}/${list.length}</em></h4>
          <div class="cl-dex-grid">
            ${list.map((c) => {
              const st = o[c.id];
              return `
                <button class="cl-dex ${st ? 'have' : 'locked'} r-${r}" data-c="dex" data-id="${c.id}" id="clDex_${c.id}">
                  <img src="${sprite(c.id)}" alt="" loading="lazy">
                  <b>${st ? c.name : '???'}</b>
                  ${st ? `<span class="cl-stars mini">${stars(st.stars || 1)}</span>` : `<small>${c.breed.split(' ')[0]}…</small>`}
                </button>`;
            }).join('')}
          </div>
        </section>`;
    }).join('');
    const isPair = isCoupleActive();
    box.innerHTML = `
      <div class="cl-dex-head">
        <svg viewBox="0 0 70 70" class="cl-dex-ring" aria-hidden="true"><circle cx="35" cy="35" r="30" class="trk"/><circle cx="35" cy="35" r="30" class="val" stroke-dasharray="${(ring * pct) / 100} ${ring}"/></svg>
        <div><b>${have} / ${total} cats adopted</b><small>${isPair ? 'Shared by BKK &amp; DXB · every cat lives in one lounge' : 'Your personal Purrst Class sanctuary collection'}</small></div>
      </div>
      ${sections}`;
  }

  // ---------------------------------------------------------------------------
  // Clicks
  // ---------------------------------------------------------------------------
  function onClick(e) {
    const t = e.target.closest('[data-c]');
    if (!t) return;
    e.stopPropagation();
    const id = t.dataset.id;
    switch (t.dataset.c) {
      case 'close': close(); break;
      case 'tab': Sound.tap(); setTab(t.dataset.tab); break;
      case 'hello': if (S.nodes[id]) tapCat(id); break;
      case 'summon': Sound.tap(); summon(id); break;
      case 'gift': openGift(id, t); break;
      case 'feed': {
        if (!S.nodes[id]) summon(id);
        const n = needs(id);
        if (n.hunger >= E.FULL_AT) {
          say(id, '😽 I’m full!', 1400); react(id, 'shake', 700);
          // Still counts as your feeding round for the 🤝 shift handoff
          send({ type: 'vault_cat_care', catId: id, action: 'feed' });
          break;
        }
        t.disabled = true; setTimeout(() => { t.disabled = false; }, E.FEED_COOLDOWN_MS);
        S.feedFrom = t.getBoundingClientRect();
        feed(id);
        send({ type: 'vault_cat_care', catId: id, action: 'feed' });
        break;
      }
      case 'pet': {
        if (!S.nodes[id]) summon(id);
        const el = S.nodes[id];
        if (!el) break;
        S.woke[id] = napWindow();
        el.classList.add('bliss');
        Sound.purrStart(0.22);
        hearts(catHead(id), 3);
        react(id, 'squish', 500);
        setTimeout(() => { el.classList.remove('bliss'); Sound.purrStop(); decorateCat(id); }, 900);
        if (Date.now() - S.lastPetSent > 720) {
          S.lastPetSent = Date.now();
          S.lastPetAt = catHead(id);
          send({ type: 'vault_cat_care', catId: id, action: 'pet' });
        }
        // Teach the rub gesture once
        try {
          if (!localStorage.getItem('nook_cat_rubtip')) { localStorage.setItem('nook_cat_rubtip', '1'); toast('<div><b>🫶 Tip</b><span>Rub your finger over a cat to pet it continuously — listen for the purr!</span></div>', 'cl-toast', 4200); }
        } catch (err) {}
        break;
      }
      case 'brush': {
        if (!S.nodes[id]) summon(id);
        const el = S.nodes[id];
        if (!el) break;
        t.disabled = true; setTimeout(() => { t.disabled = false; }, 1200);
        S.woke[id] = napWindow();
        Sound.purrStart(0.18);
        hearts(catHead(id), 2);
        react(id, 'squish', 600);
        say(id, id === 'r_persian' ? '✨ Royal grooming approved! 👑' : '✨ So fluffy and clean! 🪮', 1400);
        setTimeout(() => { Sound.purrStop(); decorateCat(id); }, 800);
        send({ type: 'vault_cat_care', catId: id, action: 'brush' });
        break;
      }
      case 'play': {
        if (!S.nodes[id]) summon(id);
        const n = needs(id);
        if (n.fun >= E.TIRED_AT) { say(id, '😴 too sleepy…', 1400); break; }
        startPlay(id);
        break;
      }
      case 'play-done': endPlay(true); break;
      case 'pull': doPull(Number(t.dataset.n) === 10 ? 10 : 1); break;
      case 'retry': retryHello(); break;
      case 'convert': {
        const pack = E.CONVERT.find((c) => c.id === t.dataset.pack);
        if (!pack) break;
        t.disabled = true;
        S.convertFrom = t.getBoundingClientRect();
        send({ type: 'vault_cat_convert', pack: pack.id, reqId: `cv_${Date.now()}` });
        break;
      }
      case 'dex': {
        if (catState(id)) { setTab('lounge'); summon(id); }
        else { const def = C.BY_ID[id]; toast(`🎰 A ${C.RARITY[def.rarity].label} cat — find them in the Kitty Capsule`); }
        break;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Server messages
  // ---------------------------------------------------------------------------
  function toast(html, cls, ms) { if (V() && V().toast) V().toast(html, cls, ms); }
  function centerRect() { const w = window.innerWidth; const h = window.innerHeight; return { left: w / 2 - 20, top: h / 2 - 20, width: 40, height: 40 }; }

  /** Patch the shared profile object in place (cheap updates for frequent care events). */
  function applyEvent(msg) {
    const p = profiles();
    if (!p) return;
    if (msg.profiles && msg.profiles.bkk) { if (V() && V().handleMessage) V().handleMessage({ type: 'vault_profiles', profiles: msg.profiles }); return; }
    if (p.cats && msg.cat && msg.catId) p.cats.owned[msg.catId] = msg.cat;
    if (p.cats && msg.fed) p.cats.fed = msg.fed;
    if (msg.fish) ['bkk', 'dxb'].forEach((r) => { if (p[r] && typeof msg.fish[r] === 'number') p[r].fish = msg.fish[r]; });
    if (msg.catDay) Object.entries(msg.catDay).forEach(([r, d]) => { if (p[r] && d) p[r].catDay = d; });
  }

  function onCatEvent(msg) {
    const mine = msg.role === myRole();
    applyEvent(msg);
    const id = msg.catId;
    const def = C.BY_ID[id];
    if (msg.soft) {
      if (mine && msg.soft === 'tired') say(id, '😴 too sleepy…', 1400);
      handleBonuses(msg, id, def);
      refreshLight();
      return;
    }
    if (mine) {
      if (msg.gain > 0) {
        const at = msg.action === 'pet' && S.lastPetAt ? S.lastPetAt : S.nodes[id] ? catHead(id) : null;
        if (at && S.open) pop({ x: at.x + 4, y: at.y - 6 }, `+${msg.gain}🐟`, 'fish');
        const from = msg.action === 'feed' && S.feedFrom ? S.feedFrom : null;
        if (from) flyTo(from, '🐟', 3, 'clFishPill', Sound.fish); else bumpPill('clFishPill');
      } else if (msg.action !== 'pet' && myDay().careFish >= E.CARE_FISH_CAP && S.capReachedShown !== today()) {
        S.capReachedShown = today();
        toast(`<div><b>🐟 Daily care fish maxed (${E.CARE_FISH_CAP})</b><span>The cats still love the attention — gifts keep coming 🎁</span></div>`, 'cl-toast', 3600);
      }
      if (msg.action === 'play') { hearts(catHead(id), 4); }
      if (msg.action !== 'pet') addFeed(msg.role, msg.action, id);
    } else if (S.open && def && isCoupleActive()) {
      // 👻 Partner presence: you see their hand / bowl / toy in your lounge
      if (msg.action !== 'pet') addFeed(msg.role, msg.action, id);
      if (!S.nodes[id]) {
        toast(`🐾 ${msg.role.toUpperCase()} ${FEED_VERB[msg.action] || 'cared for'} ${def.name}`);
        handleBonuses(msg, id, def);
        refreshLight();
        return;
      }
      if (msg.action === 'pet') {
        const h = catHead(id);
        const g = fx('ghost', `🫳<em>${msg.role.toUpperCase()}</em>`, { x: h.x, y: h.y - 4 }, {}, 1300);
        if (g) g.classList.add('rub');
        hearts(h, 2);
        react(id, 'squish', 400);
        const el = S.nodes[id];
        if (el && !S.petting) { el.classList.add('bliss'); clearTimeout(el._pb); el._pb = setTimeout(() => { el.classList.remove('bliss'); decorateCat(id); }, 1100); }
      } else if (msg.action === 'brush') {
        const h = catHead(id);
        fx('ghost', `🪮<em>${msg.role.toUpperCase()}</em>`, { x: h.x, y: h.y - 4 }, {}, 1300);
        hearts(h, 2);
        react(id, 'squish', 400);
        say(id, `${msg.role.toUpperCase()} brushed my coat! ✨`, 1400);
      } else if (msg.action === 'feed') {
        feed(id, true);
      } else if (msg.action === 'play') {
        react(id, 'dance', 1400);
        hearts(catHead(id), 3);
        say(id, `${msg.role.toUpperCase()} played with me! 🪶`, 1600);
      } else if (msg.action === 'gift') {
        sparkles(catHead(id), 8);
      } else if (msg.action === 'pull' && msg.best) {
        const R = C.RARITY[msg.best.rarity];
        toast(`<div><b>🎰 ${msg.role.toUpperCase()} opened ${msg.count > 1 ? `${msg.count} capsules` : 'a capsule'}!</b><span>Best: <em style="color:${R.color}">${R.label} ${def.name}</em>${msg.best.isNew ? ' — new to the lounge! 🏠' : ''}</span></div>`, 'cl-toast', 4200);
      }
    } else if (!mine && def && isCoupleActive() && msg.action === 'pull' && msg.best && msg.best.rarity !== 'common') {
      const R = C.RARITY[msg.best.rarity];
      toast(`<div><b>🐾 ${msg.role.toUpperCase()} adopted ${def.name}!</b><span><em style="color:${R.color}">${R.label}</em> · come say hi in the Cat Lounge</span></div>`, 'cl-toast', 4200);
    }
    handleBonuses(msg, id, def);
    refreshLight();
  }

  function handleBonuses(msg, id, def) {
    if (!isCoupleActive()) return;
    (msg.bonuses || []).forEach((b) => {
      if (b.kind === 'handoff') {
        Sound.gift();
        toast(`<div><b>🤝 Shift handoff complete!</b><span>BKK &amp; DXB both fed the cats today · <em class="t-mythic">+${b.amount}🐟 each</em></span></div>`, 'cl-toast', 4200);
        bumpPill('clFishPill');
      }
      if (b.kind === 'double') {
        Sound.sparkle();
        if (S.open && S.nodes[id]) { const h = catHead(id); pop({ x: h.x, y: h.y - 12 }, '💞 DOUBLE PURR!', 'double'); hearts(h, 6); }
        toast(`<div><b>💞 Double purr!</b><span>You both petted ${def ? def.name : 'a cat'} at once · <em class="t-mythic">+${b.amount}🐟 each</em></span></div>`, 'cl-toast', 3200);
      }
    });
  }

  function onConverted(msg) {
    Sound.gift();
    const from = S.convertFrom || centerRect();
    S.convertFrom = null;
    flyTo(from, '🐟', 8, 'clFishPill', Sound.fish);
    toast(`<div><b>🐟 +${msg.pack.fish} fish</b><span>Traded 💎${msg.pack.diamonds}</span></div>`, 'cl-toast', 2600);
  }

  function handleMessage(msg) {
    switch (msg.type) {
      case 'vault_cat_event': onCatEvent(msg); break;
      case 'vault_cat_pull_result': onPullResult(msg); break;
      case 'vault_cat_gift_result': onGiftResult(msg); break;
      case 'vault_cat_converted': onConverted(msg); break;
      case 'vault_error':
        if (S.pending && (!msg.reqId || msg.reqId === S.pending.reqId)) {
          clearTimeout(S.pendingTimer);
          S.pending = null; S.pulling = false;
          const m = $('clMachine'); if (m) m.classList.remove('crank', 'drop');
          renderCapsule();
        }
        toast(`😿 ${msg.error || 'Something went wrong'}`);
        break;
    }
  }

  /** Light refresh after small patches: decorations, card, roster, pills — no scene rebuild. */
  function refreshLight() {
    updateDock();
    if (!S.open) return;
    renderHead();
    if (S.tab === 'lounge') {
      Object.keys(S.nodes).forEach(decorateCat);
      if (!S.play) renderCare();
      renderRoster();
    }
  }

  function onProfiles() {
    updateDock();
    if (!S.open) return;
    if (lounge()) {
      S.helloFailed = false;
      clearTimeout(S.helloTimer);
    }
    // Don't rebuild the room mid-crank/reveal; finishReveal applies the latest state
    if (S.pulling || S.reveal) { renderHead(); return; }
    const key = ownedIds().join(',');
    if (key !== S.lastOwnedKey) { S.lastOwnedKey = key; renderAll(); return; }
    renderHead();
    if (S.tab === 'lounge') {
      syncScene();
      if (!S.play) renderCare();
      renderRoster();
    }
    if (S.tab === 'capsule' && !S.pulling) renderCapsule();
    if (S.tab === 'dex') renderDex();
  }

  // ---------------------------------------------------------------------------
  // Dock tile
  // ---------------------------------------------------------------------------
  function mountDock() {
    const deck = $('emotionDeck');
    if (!deck || $('openCatsBtn')) return;
    const b = document.createElement('button');
    b.className = 'emote-btn cats-btn';
    b.id = 'openCatsBtn';
    b.title = 'Purrst Class Lounge — your shared cats';
    b.innerHTML = '<span class="emote-icon"><img src="assets/ui/icon_cats.png" alt="" draggable="false"></span><span class="emote-label">Cats</span><i class="cats-dot" id="catsDot"></i>';
    b.addEventListener('click', (e) => { e.stopPropagation(); open(); });
    const scenery = $('openSceneryBtn');
    deck.insertBefore(b, scenery || null);
    deck.classList.add('has-cats');
  }

  function updateDock() {
    const dot = $('catsDot');
    if (!dot) return;
    if (!lounge()) { dot.className = 'cats-dot new'; dot.textContent = 'NEW'; return; }
    const ids = ownedIds();
    const gifts = ids.filter(giftReady).length;
    const hungry = ids.filter((id) => needs(id).hunger < 30).length;
    dot.textContent = gifts ? String(gifts) : hungry ? '!' : '';
    dot.className = `cats-dot ${gifts ? 'gift' : hungry ? 'hungry' : ''}`;
  }

  // ---------------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------------
  function init() {
    mountDock();
    updateDock();
    window.addEventListener('vault:profiles', onProfiles);
    window.addEventListener('sky:couple_status_changed', () => { if (S.open) onProfiles(); });
    // Needs decay continuously — refresh bars / bubbles / naps every 20s
    setInterval(() => {
      updateDock();
      if (S.open && S.tab === 'lounge' && !S.petting && !S.play) { Object.keys(S.nodes).forEach(decorateCat); renderCare(); renderFeed(); }
    }, 20000);
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || !S.open) return;
      if (S.reveal) { if (S.reveal.done || !S.reveal.single) finishReveal(); }
      else if (S.play) endPlay(true);
      else close();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') {
        endPet();
        Sound.purrStop();
      } else if (S.open && S.tab === 'lounge') {
        syncScene();
      }
    });
    window.addEventListener('resize', () => { if (S.open) setTab(S.tab, true); });
  }

  window.NookCats = { open, close, handleMessage, refresh: onProfiles };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
