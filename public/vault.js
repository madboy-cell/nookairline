/**
 * Nook Airline — The Vault 💎
 * Wardrobe (what you own) · Codex (every costume, couple collection) · Gacha (season banner)
 *
 * The server owns all currency, pity and pull results (see server.js "Vault").
 * This file is purely presentation + intent messages (vault_pull / vault_equip / ...).
 */
(function () {
  const C = window.NookCostumes;
  if (!C) { console.warn('[Vault] costumes.js missing'); return; }

  const $ = (id) => document.getElementById(id);
  const fmt = (n) => Number(n || 0).toLocaleString();
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const RANK = { classic: 0, rare: 1, epic: 2, mythic: 3 };
  const E = C.ECONOMY;
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const S = {
    profiles: null,
    tab: 'wardrobe',
    filter: 'all',
    selected: null,
    open: false,
    pulling: false,
    pending: null,
    pendingTimer: null,
    pendingEquip: null,
    reqSeq: 0,
    skip: false,
    waiters: [],
    seenNew: new Set(),
    lastAward: null,
    gachaSeason: 's7',
    codexSeason: 'all',
    featuredMythicIdx: 0,
    envelopeModalOpen: false,
    envelopeTab: 'send',
    envelopeAmount: 50,
    envelopeMessage: 'Good luck pulling Mythic in Season 7 Enchanted Fairytales! 👑🏮✨',
    envelopeBlessing: 'mythic',
    showingEnvelope: null
  };

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  const myRole = () => {
    if (window.SkySupabase && typeof window.SkySupabase.getCharacterBase === 'function') {
      return window.SkySupabase.getCharacterBase();
    }
    return window.myTerminal || (window.getTerminalRole ? window.getTerminalRole() : 'bkk');
  };
  const partnerRole = () => (myRole() === 'bkk' ? 'dxb' : 'bkk');
  const me = () => (S.profiles ? S.profiles[myRole()] : null);
  const them = () => (S.profiles ? S.profiles[partnerRole()] : null);
  const isCoupleActive = () => !!(window.SkySupabase && ((window.SkySupabase.coupleStatus && window.SkySupabase.coupleStatus.isCouple) || (typeof window.SkySupabase.isCouple === 'function' && window.SkySupabase.isCouple())));
  const chars = () => window.MAPLE_CHARACTERS || {};
  const currentCharId = () => { const a = window.getMyAvatar && window.getMyAvatar(); return a ? a.characterId : null; };
  const rarityOf = (id) => (C.BY_ID[id] ? C.BY_ID[id].rarity : 'classic');
  const send = (msg) => { if (typeof window.sendSignaling === 'function') window.sendSignaling(msg); };
  const label = (r) => (r === 'classic' ? 'CLASSIC' : C.RARITY[r].label);
  const stars = (r) => (r === 'classic' ? '' : C.RARITY[r].stars);
  const roleTag = (r) => r.toUpperCase();

  function owns(role, id) {
    if (!C.BY_ID[id]) return true; // classic outfits are free

    // 1. Cloud-First: Always check current Supabase authenticated user's inventory
    if (window.SkySupabase && window.SkySupabase.currentUser) {
      const cloudInv = window.SkySupabase.currentUser.inventory;
      if (Array.isArray(cloudInv) && cloudInv.includes(id)) return true;
    }

    // 2. Local storage backup check
    try {
      const localProfile = JSON.parse(localStorage.getItem('sky_user_profile') || '{}');
      if (Array.isArray(localProfile.inventory) && localProfile.inventory.includes(id)) return true;
    } catch (_) {}

    // 3. In-memory / server profiles check
    const p = S.profiles && S.profiles[role];
    if (p && p.owned && p.owned[id] > 0) return true;
    const term = window.myTerminal || 'bkk';
    const termP = S.profiles && S.profiles[term];
    if (termP && termP.owned && termP.owned[id] > 0) return true;
    const c = C.BY_ID[id];
    if (c && c.pair && termP && termP.owned) {
      const pairCostumes = Object.values(C.BY_ID).filter((x) => x.pair === c.pair);
      if (pairCostumes.some((x) => termP.owned[x.id] > 0)) return true;
    }
    return false;
  }
  function copies(role, id) {
    const p = S.profiles && S.profiles[role];
    let count = (p && p.owned && p.owned[id]) || 0;
    if (count === 0 && owns(role, id)) count = 1;
    return count;
  }
  function bestOf(results) {
    return results.reduce((a, b) => (RANK[b.rarity] > RANK[a.rarity] ? b : a), results[0]);
  }
  function motes(n, cls = 'v-mote') {
    let h = '';
    for (let i = 0; i < n; i++) {
      const x = Math.round(Math.random() * 100);
      const d = (2.6 + Math.random() * 3.4).toFixed(2);
      const delay = (-Math.random() * 6).toFixed(2);
      const s = (0.5 + Math.random() * 0.9).toFixed(2);
      h += `<i class="${cls}" style="--x:${x}%;--d:${d}s;--delay:${delay}s;--s:${s}"></i>`;
    }
    return h;
  }
  // Same random motes across re-renders so the DOM patcher doesn't restart them every tap.
  const moteMemo = {};
  const stableMotes = (n, cls = 'v-mote') => (moteMemo[`${cls}:${n}`] ||= motes(n, cls));

  // ---------------------------------------------------------------------------
  // Images: thumbnails, warm cache, progressive full-res sprites
  // ---------------------------------------------------------------------------
  // Grid cards use 300px thumbs (scripts/make_thumbs.js); hero stages upgrade thumb -> full.
  const thumbOf = (src) => {
    if (!src) return src;
    let s = src.startsWith('assets/') && !src.startsWith('assets/thumbs/') ? src.replace('assets/', 'assets/thumbs/') : src;
    if (!s.includes('?v=')) s += '?v=20261012v3';
    return s;
  };
  const Img = { full: new Set(), loading: new Set() };
  const PULL_UI = ['assets/ui/summon_circle.png', 'assets/ui/lantern_rare.png', 'assets/ui/lantern_epic.png', 'assets/ui/lantern_mythic.png', 'assets/ui/crest.png', 'assets/ui/banner_s1.jpg', 'assets/ui/banner_s2.jpg', 'assets/ui/banner_s3.jpg', 'assets/ui/banner_s4.jpg', 'assets/ui/banner_s5.jpg', 'assets/ui/banner_s6.jpg', 'assets/ui/banner_s7.jpg'];

  /** Preload an image via browser cache without pinning uncollectable HTMLImageElement in memory. */
  function preload(src, onReady) {
    if (!src) return;
    const im = new Image();
    im.decoding = 'async';
    const done = () => {
      if (onReady) onReady();
      im.onload = null;
      im.onerror = null;
    };
    im.onload = () => {
      if (im.decode) im.decode().then(done, done);
      else done();
    };
    im.onerror = done;
    im.src = src;
  }

  /** Full-res sprite once it is decoded; until then the (already cached) thumb. */
  function heroSrc(full) {
    if (!full || Img.full.has(full)) return full;
    if (!Img.loading.has(full)) {
      Img.loading.add(full);
      preload(full, () => {
        Img.full.add(full);
        document.querySelectorAll('img[data-full]').forEach((el) => {
          if (el.dataset.full === full && el.getAttribute('src') !== full) el.src = full;
        });
      });
    }
    return thumbOf(full);
  }
  const heroImgAttrs = (full) => `src="${heroSrc(full)}" data-full="${full}" onerror="this.onerror=null;this.src=this.dataset.full"`;

  let warmed = false;
  function warmImages() {
    const cur = chars()[currentCharId()];
    if (cur) heroSrc(cur.sprite);
    if (warmed) return;
    warmed = true;
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 350));
    idle(() => {
      // Warm pull fx assets so gacha reveals stay lightning-fast without blowing RAM budget
      PULL_UI.forEach((u) => preload(u));
    });
  }

  // ---------------------------------------------------------------------------
  // Minimal DOM patcher: re-render without recreating unchanged nodes (no image flicker)
  // ---------------------------------------------------------------------------
  const KEEP_CLASSES = ['equip-pop'];
  function morph(live, html) {
    const tpl = document.createElement('template');
    tpl.innerHTML = html;
    patchChildren(live, tpl.content);
  }
  function patchChildren(a, b) {
    const pool = new Map();
    for (const c of a.childNodes) if (c.nodeType === 1 && c.id) pool.set(c.id, c);
    let cur = a.firstChild;
    for (const y of Array.from(b.childNodes)) {
      let x = null;
      if (y.nodeType === 1 && y.id && pool.has(y.id)) {
        x = pool.get(y.id);
        pool.delete(y.id);
      } else if (cur && !(cur.nodeType === 1 && cur.id) && !(y.nodeType === 1 && y.id)
          && cur.nodeType === y.nodeType && cur.nodeName === y.nodeName) {
        x = cur;
      }
      if (!x) { a.insertBefore(y, cur); continue; }
      if (x === cur) cur = cur.nextSibling; else a.insertBefore(x, cur);
      if (x.nodeType === 1) { patchAttrs(x, y); patchChildren(x, y); }
      else if (x.nodeValue !== y.nodeValue) x.nodeValue = y.nodeValue;
    }
    while (cur) { const nx = cur.nextSibling; a.removeChild(cur); cur = nx; }
  }
  function patchAttrs(x, y) {
    for (const { name, value } of Array.from(y.attributes)) {
      let v = value;
      if (name === 'class') KEEP_CLASSES.forEach((k) => { if (x.classList.contains(k) && !y.classList.contains(k)) v += ` ${k}`; });
      if (name === 'src' && x.dataset.full && x.getAttribute('src') === x.dataset.full && value === thumbOf(x.dataset.full)) continue; // never downgrade a hero sprite
      if (x.getAttribute(name) !== v) x.setAttribute(name, v);
    }
    for (const { name } of Array.from(x.attributes)) if (!y.hasAttribute(name)) x.removeAttribute(name);
  }

  // Tiny WebAudio synth so pulls feel tactile without loading audio files.
  const Sound = (() => {
    let ctx = null;
    function ac() {
      if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }
    function tone(freq, t0, dur, type = 'sine', vol = 0.1) {
      const c = ac(); if (!c) return;
      const o = c.createOscillator(); const g = c.createGain();
      const t = c.currentTime + t0;
      o.type = type; o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(c.destination);
      o.start(t); o.stop(t + dur + 0.05);
    }
    return {
      tap() { tone(700, 0, 0.07, 'triangle', 0.06); },
      drop() { tone(260, 0, 0.18, 'sine', 0.14); tone(150, 0.06, 0.3, 'sine', 0.1); },
      wobble() { tone(520, 0, 0.06, 'triangle', 0.05); tone(580, 0.09, 0.06, 'triangle', 0.05); },
      upgrade() { tone(440, 0, 0.12, 'square', 0.04); tone(880, 0.08, 0.3, 'triangle', 0.09); },
      crack() { tone(1400, 0, 0.08, 'square', 0.04); tone(200, 0, 0.2, 'sawtooth', 0.05); },
      flip() { tone(1100 + Math.random() * 200, 0, 0.05, 'triangle', 0.05); },
      rare() { [784, 988, 1175].forEach((f, i) => tone(f, i * 0.07, 0.3, 'triangle', 0.08)); },
      epic() { [659, 831, 988, 1319].forEach((f, i) => tone(f, i * 0.08, 0.5, 'triangle', 0.09)); },
      mythic() {
        [523, 659, 784, 1047, 1319, 1568, 2093].forEach((f, i) => tone(f, i * 0.09, 0.9, 'sine', 0.11));
        tone(98, 0, 1.6, 'sawtooth', 0.04);
      },
      envelopeOpen() {
        [392.00, 440.00, 523.25, 587.33, 659.25, 783.99, 1046.50, 1318.51].forEach((f, i) => tone(f, i * 0.07, 0.45, 'triangle', 0.09));
        tone(196.00, 0, 0.9, 'sine', 0.16);
        tone(130.81, 0.04, 1.2, 'sawtooth', 0.05);
      },
      envelopeSend() {
        [523.25, 659.25, 783.99, 1046.50].forEach((f, i) => tone(f, i * 0.06, 0.25, 'sine', 0.08));
      },
      coin() { [1319, 1760].forEach((f, i) => tone(f, i * 0.06, 0.2, 'triangle', 0.07)); }
    };
  })();

  // ---------------------------------------------------------------------------
  // DOM scaffold
  // ---------------------------------------------------------------------------
  function build() {
    if ($('vaultSheet')) return;
    const el = document.createElement('div');
    el.id = 'vaultSheet';
    el.className = 'vault-sheet';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = `
      <div class="vault-backdrop" data-action="close"></div>
      <section class="vault-panel" role="dialog" aria-modal="true" aria-labelledby="vaultTitle">
        <div class="vault-panel-glow"></div>
        <header class="vault-head">
          <div class="vault-title-wrap">
            <h2 class="vault-title" id="vaultTitle">The Vault</h2>
            <span class="vault-season-chip" id="vaultSeasonChip">${(C.SEASONS[S.gachaSeason || 's3'] || C.SEASONS.s3).icon} ${(S.gachaSeason || 's3').toUpperCase()} · ${(C.SEASONS[S.gachaSeason || 's3'] || C.SEASONS.s3).name}</span>
          </div>
          <div class="vault-wallet">
            <button class="vault-coin diamonds neora-gem-counter" id="vaultDiamonds" data-action="tab" data-tab="gacha" title="Diamonds — Tap to pull Gacha">
              <span class="neora-diamond-wrap">
                <svg class="neora-diamond-svg" width="16" height="14" viewBox="0 0 24 22" fill="none">
                  <path d="M12 21.5L1.5 8.5L5.5 1.5H18.5L22.5 8.5L12 21.5Z" fill="url(#gem_body_vd)" stroke="#a5f3fc" stroke-width="0.8"/>
                  <path d="M5.5 1.5L8.5 8.5L12 21.5L15.5 8.5L18.5 1.5" stroke="#ffffff" stroke-width="0.7" stroke-opacity="0.8"/>
                  <path d="M1.5 8.5H22.5" stroke="#ffffff" stroke-width="0.7" stroke-opacity="0.8"/>
                  <path d="M8.5 8.5L12 1.5L15.5 8.5" stroke="#ffffff" stroke-width="0.7" stroke-opacity="0.8"/>
                  <defs>
                    <linearGradient id="gem_body_vd" x1="12" y1="1.5" x2="12" y2="21.5" gradientUnits="userSpaceOnUse">
                      <stop stop-color="#38bdf8"/>
                      <stop offset="0.5" stop-color="#818cf8"/>
                      <stop offset="1" stop-color="#c084fc"/>
                    </linearGradient>
                  </defs>
                </svg>
              </span>
              <b>—</b>
            </button>
            <button class="vault-coin stardust" id="vaultStardust" data-action="tab" data-tab="wardrobe" title="Stardust — Tap to craft in Wardrobe">✨ <b>—</b></button>
            <button class="vault-coin tickets" id="vaultTickets" data-action="tab" data-tab="gacha" style="display:none;" title="Lucky Flight Tickets — VIP Gacha Pulls">🎟️ <b>—</b></button>
            <button class="vault-coin red-envelope-btn" id="vaultRedEnvelopeBtn" data-action="open-envelope-sender" title="Send Chinese Red Envelope (Ang Pao) to Partner">🧧 <b>Gift</b><span class="gift-gem"> 💎</span></button>
          </div>
          <button class="vault-close" id="vaultCloseBtn" data-action="close" aria-label="Close the Vault">✕</button>
        </header>
        <nav class="vault-tabs" id="vaultTabs" role="tablist" data-active="wardrobe">
          <button class="vault-tab" role="tab" data-action="tab" data-tab="wardrobe" id="vaultTabWardrobe">👗 Wardrobe</button>
          <button class="vault-tab" role="tab" data-action="tab" data-tab="codex" id="vaultTabCodex">📖 Codex</button>
          <button class="vault-tab" role="tab" data-action="tab" data-tab="gacha" id="vaultTabGacha">🎰 Gacha</button>
          <span class="vault-tab-ink"></span>
        </nav>
        <div class="vault-base-switcher" id="vaultBaseSwitcher" title="Switch Character Base">
          <button class="vault-base-pill active" id="vaultBaseBkk" data-action="switch-base" data-base="bkk" type="button">🐺 Wolf Boy</button>
          <button class="vault-base-pill" id="vaultBaseDxb" data-action="switch-base" data-base="dxb" type="button">🐉 Dragon Girl</button>
        </div>
        <div class="vault-body" id="vaultBody"></div>
        <div class="vault-inspect" id="vaultInspect"></div>
        <div class="vault-envelope-modal" id="vaultEnvelopeModal"></div>
      </section>
      <div class="vault-pull-fx" id="vaultPullFx"></div>`;
    document.body.appendChild(el);
    el.addEventListener('click', onClick);
    el.addEventListener('touchend', (e) => {
      const t = e.target.closest('[data-action]');
      if (!t) return;
      if (t.dataset.action === 'close') {
        e.preventDefault();
        e.stopPropagation();
        close();
      }
    }, { passive: false });
  }

  function ensureToastLayer() {
    let t = $('vaultToasts');
    if (!t) {
      t = document.createElement('div');
      t.id = 'vaultToasts';
      t.className = 'vault-toasts';
      document.body.appendChild(t);
    }
    return t;
  }

  function mountPills() {
    const group = document.querySelector('#flightHeader .hdr-right') || $('flightHeader');
    if (group && !$('vaultHeaderPill')) {
      const b = document.createElement('button');
      b.id = 'vaultHeaderPill';
      b.className = 'vault-pill neora-gem-counter';
      b.title = 'Your diamonds — open the Vault';
      b.setAttribute('type', 'button');
      b.setAttribute('aria-label', 'Diamond Balance. Open Vault');
      b.innerHTML = `
        <span class="neora-diamond-wrap">
          <svg class="neora-diamond-svg" width="18" height="16" viewBox="0 0 24 22" fill="none">
            <path d="M12 21.5L1.5 8.5L5.5 1.5H18.5L22.5 8.5L12 21.5Z" fill="url(#gem_body_hdr)" stroke="#a5f3fc" stroke-width="0.8"/>
            <path d="M5.5 1.5L8.5 8.5L12 21.5L15.5 8.5L18.5 1.5" stroke="#ffffff" stroke-width="0.7" stroke-opacity="0.8"/>
            <path d="M1.5 8.5H22.5" stroke="#ffffff" stroke-width="0.7" stroke-opacity="0.8"/>
            <path d="M8.5 8.5L12 1.5L15.5 8.5" stroke="#ffffff" stroke-width="0.7" stroke-opacity="0.8"/>
            <defs>
              <linearGradient id="gem_body_hdr" x1="12" y1="1.5" x2="12" y2="21.5" gradientUnits="userSpaceOnUse">
                <stop stop-color="#38bdf8"/>
                <stop offset="0.5" stop-color="#818cf8"/>
                <stop offset="1" stop-color="#c084fc"/>
              </linearGradient>
            </defs>
          </svg>
        </span>
        <b>5,000</b>
        <span class="vault-plus-btn" title="Open Gacha Vault">+</span>`;
      b.addEventListener('click', (e) => { e.stopPropagation(); open('gacha'); });
      
      const mailBtn = document.getElementById('flightHeaderMailBtn');
      if (mailBtn && mailBtn.parentElement === group) {
        group.insertBefore(b, mailBtn);
      } else {
        group.appendChild(b);
      }
    }
  }

  function updatePills() {
    const p = me();
    const d = p ? fmt(p.diamonds) : '—';
    ['vaultHeaderPill'].forEach((id) => {
      const el = $(id); if (!el) return;
      const b = el.querySelector('b');
      if (b && b.textContent !== d) {
        b.textContent = d;
        el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
      }
    });
    const dEl = $('vaultDiamonds');
    if (dEl) {
      dEl.querySelector('b').textContent = d;
      dEl.setAttribute('data-tooltip', `💎 ${d} Diamonds · Tap to pull Gacha`);
    }
    const sEl = $('vaultStardust');
    if (sEl) {
      const sVal = p ? fmt(p.stardust) : '—';
      sEl.querySelector('b').textContent = sVal;
      sEl.setAttribute('data-tooltip', `✨ ${sVal} Stardust · Tap to craft in Wardrobe`);
    }
    const tEl = $('vaultTickets');
    if (tEl) {
      const tCount = p && p.tickets ? p.tickets : 0;
      tEl.querySelector('b').textContent = tCount > 0 ? fmt(tCount) : '0';
      tEl.setAttribute('data-tooltip', `🎟️ ${tCount} Lucky Tickets · VIP Gacha Pulls`);
      tEl.style.display = tCount > 0 ? 'inline-flex' : 'none';
    }
    const deckBtn = $('openWardrobeBtn');
    if (deckBtn) deckBtn.classList.toggle('vault-can-pull', !!(p && p.diamonds >= E.PULL_1));
    const isPair = isCoupleActive();
    const unclaimed = p && Array.isArray(p.envelopes) ? p.envelopes.filter((e) => !e.claimed) : [];
    const rEl = $('vaultRedEnvelopeBtn');
    if (rEl) {
      rEl.classList.toggle('has-gift', unclaimed.length > 0);
      rEl.classList.toggle('vault-gift-locked', !isPair && unclaimed.length === 0);
      if (unclaimed.length > 0) {
        rEl.innerHTML = `🧧 <b>Claim (${unclaimed.length})!</b>`;
        rEl.setAttribute('data-tooltip', `🧧 ${unclaimed.length} Red Envelopes waiting to be claimed!`);
      } else if (!isPair) {
        rEl.innerHTML = `🧧 <b>Gift</b> <span style="opacity:0.75;font-size:11px;">🔒</span>`;
        rEl.setAttribute('data-tooltip', `🔒 Gifting Red Envelopes is exclusive to linked couples in Couple Sanctuary`);
      } else {
        rEl.innerHTML = `🧧 <b>Gift</b><span class="gift-gem"> 💎</span>`;
        rEl.setAttribute('data-tooltip', `🧧 Send Chinese Red Envelope (Ang Pao) to Partner`);
      }
    }
    if (deckBtn) {
      deckBtn.classList.toggle('vault-has-envelope', unclaimed.length > 0);
    }
  }

  // ---------------------------------------------------------------------------
  // Open / close / tabs
  // ---------------------------------------------------------------------------
  function open(tab) {
    if (typeof window !== 'undefined' && (window.scrollX > 0 || window.pageXOffset > 0)) {
      window.scrollTo(0, window.scrollY || window.pageYOffset || 0);
    }
    build();
    if (tab) S.tab = tab;
    S.selected = currentCharId();
    S.open = true;
    const sheet = $('vaultSheet');
    sheet.classList.add('open');
    const cloudInv = (window.SkySupabase && window.SkySupabase.currentUser && Array.isArray(window.SkySupabase.currentUser.inventory))
      ? window.SkySupabase.currentUser.inventory
      : [];
    const cu = window.SkySupabase && window.SkySupabase.currentUser;
    send({
      type: 'vault_hello',
      terminal: myRole(),
      inventory: cloudInv,
      diamonds: cu?.diamonds,
      stardust: cu?.stardust
    });
    warmImages();
    render();
  }

  function close() {
    stopGachaTicker();
    if (S.pulling) return;
    closeInspect();
    S.open = false;
    const sheet = $('vaultSheet');
    if (!sheet) return;
    sheet.classList.remove('open');
    sheet.setAttribute('aria-hidden', 'true');
  }

  function setTab(tab) {
    if (S.tab === tab) return;
    S.tab = tab;
    Sound.tap();
    render();
    const body = $('vaultBody'); if (body) body.scrollTop = 0;
  }

  function updateVaultBaseSwitcher() {
    const cur = myRole();
    const bkk = $('vaultBaseBkk');
    const dxb = $('vaultBaseDxb');
    if (bkk) bkk.classList.toggle('active', cur === 'bkk');
    if (dxb) dxb.classList.toggle('active', cur === 'dxb');
  }

  function render() {
    if (!S.open) return;
    updatePills();
    updateVaultBaseSwitcher();
    const tabs = $('vaultTabs');
    if (tabs) {
      tabs.dataset.active = S.tab;
      tabs.querySelectorAll('.vault-tab').forEach((t) => {
        const on = t.dataset.tab === S.tab;
        t.classList.toggle('active', on);
        t.setAttribute('aria-selected', on ? 'true' : 'false');
      });
    }
    const body = $('vaultBody');
    if (!body) return;
    if (!S.profiles) {
      body.innerHTML = '<div class="vault-loading"><span class="vault-spinner"></span>Opening the vault…</div>';
      body.dataset.tab = '';
      return;
    }
    const scroll = body.scrollTop;
    body.className = `vault-body tab-${S.tab}`;
    // Patch instead of innerHTML so unchanged cards/images stay put (no reload flash).
    // A tab switch still rebuilds so its entrance animations play.
    const html = S.tab === 'wardrobe' ? renderWardrobe() : S.tab === 'codex' ? renderCodex() : renderGacha();
    if (body.dataset.tab === S.tab) morph(body, html);
    else { body.innerHTML = html; body.dataset.tab = S.tab; }
    body.scrollTop = scroll;
    if (S.tab === 'gacha') startGachaTicker();
    else stopGachaTicker();
  }

  // ---------------------------------------------------------------------------
  // Shared card
  // ---------------------------------------------------------------------------
  function cardHtml(item, o = {}) {
    const r = item.rarity || 'classic';
    const cls = [
      'v-card', `rf-${r}`,
      o.selected ? 'is-selected' : '',
      o.locked ? 'is-locked' : '',
      o.equipped ? 'is-equipped' : '',
      o.small ? 'is-small' : ''
    ].join(' ');
    return `
      <button class="${cls}" data-action="${o.action || 'select'}" data-id="${item.id}" id="vcard_${o.prefix || 'w'}_${item.id}" aria-label="${o.locked ? 'Locked costume' : item.name}">
        <span class="v-card-bg"></span>
        <span class="v-card-foil"></span>
        <span class="v-card-art"><img src="${thumbOf(item.sprite)}" data-src-full="${item.sprite}" alt="" loading="lazy" decoding="async" draggable="false" onerror="this.onerror=null;this.src=this.dataset.srcFull"></span>
        ${r !== 'classic' ? `<span class="v-card-stars">${stars(r)}</span>` : ''}
        ${o.count > 1 ? `<span class="v-card-count">×${o.count}</span>` : ''}
        ${o.equipped ? '<span class="v-card-check" title="Wearing">✓</span>' : ''}
        ${o.isNew ? '<span class="v-card-new">NEW</span>' : ''}
        ${o.price ? `<span class="v-card-price">✨ ${fmt(o.price)}</span>` : ''}
        <span class="v-card-name">${o.locked ? '???' : item.name}</span>
      </button>`;
  }

  function perkBlock(costume, r) {
    if (!costume) {
      return `
        <div class="v-perk pk-classic">
          <div class="v-perk-icon">🎨</div>
          <div class="v-perk-text">
            <div class="v-perk-tag">Classic outfit</div>
            <div class="v-perk-name">Pure style</div>
            <div class="v-perk-desc">Free forever. No game perk — season costumes carry those.</div>
          </div>
        </div>`;
    }
    const perk = C.PERKS[costume.perk];
    return `
      <div class="v-perk pk-${r}">
        <div class="v-perk-icon">${perk.icon}</div>
        <div class="v-perk-text">
          <div class="v-perk-tag">🎲 Monopoly perk · active while worn</div>
          <div class="v-perk-name">${perk.name}</div>
          <div class="v-perk-desc">${perk.desc}</div>
        </div>
      </div>`;
  }

  // ---------------------------------------------------------------------------
  // ⚡ MYTHIC IN-BOARD ULTIMATE ABILITIES
  // Replaces couple resonance on all Mythic costumes to showcase signature powers
  // ---------------------------------------------------------------------------
  const MYTHIC_ULTIMATES = {
    // S1: Bangkok After Dark
    s1_naga_m: {
      icon: '🐉',
      badge: '⚡ S1 IN-BOARD ULTIMATE',
      title: 'Emerald Naga Surge',
      desc: 'Naga serpent blesses all Bangkok properties with Lotus Shields and bestows +500🪙 sacred river hoard!'
    },
    s1_kinnaree_f: {
      icon: '🪽',
      badge: '⚡ S1 IN-BOARD ULTIMATE',
      title: 'Emerald Naga Surge',
      desc: 'Naga serpent blesses all Bangkok properties with Lotus Shields and bestows +500🪙 sacred river hoard!'
    },
    // S2: Tokyo Sakura Reverie
    s2_inari_m: {
      icon: '🦊',
      badge: '⚡ S2 IN-BOARD ULTIMATE',
      title: 'Nine-Tail Foxfire Mirage',
      desc: 'Summons 3 sacred Foxfire Spirit Tails and manifests 2 cursed spirit traps on rival airport tiles!'
    },
    s2_inari_f: {
      icon: '⛩️',
      badge: '⚡ S2 IN-BOARD ULTIMATE',
      title: 'Nine-Tail Foxfire Mirage',
      desc: 'Summons 3 sacred Foxfire Spirit Tails and manifests 2 cursed spirit traps on rival airport tiles!'
    },
    s2_celestial_m: {
      icon: '🌙',
      badge: '⚡ S2 IN-BOARD ULTIMATE',
      title: 'Solar-Lunar Convergence',
      desc: 'Total eclipse inverts air traffic: rivals collect 0 rent for 1 lap and all airport taxes funnel into your vault!'
    },
    s2_celestial_f: {
      icon: '☀️',
      badge: '⚡ S2 IN-BOARD ULTIMATE',
      title: 'Solar-Lunar Convergence',
      desc: 'Total eclipse inverts air traffic: rivals collect 0 rent for 1 lap and all airport taxes funnel into your vault!'
    },
    // S3: Venice / Desert Mirage
    s3_djinn_m: {
      icon: '🪔',
      badge: '⚡ S3 IN-BOARD ULTIMATE',
      title: 'Cosmic Genie Wish',
      desc: 'Rub the magic lamp: grants an instant free Landmark upgrade and +350🪙 gold wish grant!'
    },
    s3_djinn_f: {
      icon: '🌌',
      badge: '⚡ S3 IN-BOARD ULTIMATE',
      title: 'Cosmic Genie Wish',
      desc: 'Rub the magic lamp: grants an instant free Landmark upgrade and +350🪙 gold wish grant!'
    },
    s3_phoenix_m: {
      icon: '🔥',
      badge: '⚡ S3 IN-BOARD ULTIMATE',
      title: 'Phoenix Rebirth Flame',
      desc: 'Sacred fire incinerates debts, claims +450🪙 from the Ash Pot, and teleports player to START with ×2 Lap Bonus!'
    },
    s3_phoenix_f: {
      icon: '🪷',
      badge: '⚡ S3 IN-BOARD ULTIMATE',
      title: 'Phoenix Rebirth Flame',
      desc: 'Sacred fire incinerates debts, claims +450🪙 from the Ash Pot, and teleports player to START with ×2 Lap Bonus!'
    },
    // S4: Monaco High-Roller
    s4_royale_m: {
      icon: '🍸',
      badge: '⚡ S4 IN-BOARD ULTIMATE',
      title: 'Royal Flush Gold Rush',
      desc: 'Golden roulette cascade: +800🪙 instant High-Roller payout, 3× rent on all your properties, and next roll locked for speed!'
    },
    s4_royale_f: {
      icon: '💎',
      badge: '⚡ S4 IN-BOARD ULTIMATE',
      title: 'Royal Flush Gold Rush',
      desc: 'Golden roulette cascade: +800🪙 instant High-Roller payout, 3× rent on all your properties, and next roll locked for speed!'
    },
    s4_roulette_m: {
      icon: '🎲',
      badge: '⚡ S4 IN-BOARD ULTIMATE',
      title: 'Royal Flush Gold Rush',
      desc: 'Loaded roulette spin: +800🪙 instant High-Roller payout, 3× rent on all your properties, and next roll locked for speed!'
    },
    s4_roulette_f: {
      icon: '🎡',
      badge: '⚡ S4 IN-BOARD ULTIMATE',
      title: 'Royal Flush Gold Rush',
      desc: 'Loaded roulette spin: +800🪙 instant High-Roller payout, 3× rent on all your properties, and next roll locked for speed!'
    },
    // S5: Atlantis Drift
    s5_emperor_m: {
      icon: '🔱',
      badge: '⚡ S5 IN-BOARD ULTIMATE',
      title: 'Abyssal Tidal Cataclysm',
      desc: 'Bioluminescent sea storm drags the leading rival backward 3 tiles directly into treacherous waters!'
    },
    s5_siren_f: {
      icon: '🦪',
      badge: '⚡ S5 IN-BOARD ULTIMATE',
      title: 'Abyssal Tidal Cataclysm',
      desc: 'Bioluminescent sea storm drags the leading rival backward 3 tiles directly into treacherous waters!'
    },
    s5_leviathan_m: {
      icon: '🐉',
      badge: '⚡ S5 IN-BOARD ULTIMATE',
      title: 'Abyssal Tidal Cataclysm',
      desc: 'Bioluminescent sea storm drags the leading rival backward 3 tiles directly into treacherous waters!'
    },
    s5_jellyfish_f: {
      icon: '🪼',
      badge: '⚡ S5 IN-BOARD ULTIMATE',
      title: 'Abyssal Tidal Cataclysm',
      desc: 'Bioluminescent sea storm drags the leading rival backward 3 tiles directly into treacherous waters!'
    },
    // S6: Astral Sovereign
    s6_supernova_m: {
      icon: '🪐',
      badge: '⚡ S6 IN-BOARD ULTIMATE',
      title: 'Supernova Celestial Tithe',
      desc: 'Summons cosmic stardust shockwave, siphons 25% rent from all rivals, and grants 2× Celestial Shield on all territories!'
    },
    s6_supernova_f: {
      icon: '🐉',
      badge: '⚡ S6 IN-BOARD ULTIMATE',
      title: 'Supernova Celestial Tithe',
      desc: 'Summons cosmic stardust shockwave, siphons 25% rent from all rivals, and grants 2× Celestial Shield on all territories!'
    },
    s6_aegis_m: {
      icon: '🌌',
      badge: '⚡ S6 IN-BOARD ULTIMATE',
      title: 'Supernova Celestial Tithe',
      desc: 'Summons cosmic stardust shockwave, siphons 25% rent from all rivals, and grants 2× Celestial Shield on all territories!'
    },
    s6_aegis_f: {
      icon: '✨',
      badge: '⚡ S6 IN-BOARD ULTIMATE',
      title: 'Supernova Celestial Tithe',
      desc: 'Summons cosmic stardust shockwave, siphons 25% rent from all rivals, and grants 2× Celestial Shield on all territories!'
    },
    // S7: Enchanted Fairytales & Royal Crowns
    s7_sundrop_m: {
      icon: '🏮',
      badge: '⚡ S7 IN-BOARD ULTIMATE',
      title: 'Wish Upon a Lantern Festival',
      desc: 'Releases illuminated sky lanterns across the board! Grants 1-Round Bankruptcy Immunity, spawns 3 golden Wish Sanctuaries, and awards a loaded bonus roll!'
    },
    s7_sundrop_f: {
      icon: '🏮',
      badge: '⚡ S7 IN-BOARD ULTIMATE',
      title: 'Wish Upon a Lantern Festival',
      desc: 'Releases illuminated sky lanterns across the board! Grants 1-Round Bankruptcy Immunity, spawns 3 golden Wish Sanctuaries, and awards a loaded bonus roll!'
    },
    s7_cinderella_m: {
      icon: '⏳',
      badge: '⚡ S7 IN-BOARD ULTIMATE',
      title: 'The Chrono-Midnight Paradox',
      desc: 'Cathedral bells toll 12:00! Inverts board runway direction counter-clockwise for 2 rounds, transmuting rival hotels back into basic cottages!'
    },
    s7_cinderella_f: {
      icon: '👠',
      badge: '⚡ S7 IN-BOARD ULTIMATE',
      title: 'The Chrono-Midnight Paradox',
      desc: 'Cathedral bells toll 12:00! Inverts board runway direction counter-clockwise for 2 rounds, transmuting rival hotels back into basic cottages!'
    },
    s7_belle_m: {
      icon: '🦁',
      badge: '⚡ S7 IN-BOARD ULTIMATE',
      title: 'The Breaking of the Enchanted Rose Curse',
      desc: 'The final rose petal falls! Radiant curse-break pillar claims ALL vacant unowned properties board-wide for free with permanent Enchanted Turrets!'
    },
    s7_belle_f: {
      icon: '🌹',
      badge: '⚡ S7 IN-BOARD ULTIMATE',
      title: 'The Breaking of the Enchanted Rose Curse',
      desc: 'The final rose petal falls! Radiant curse-break pillar claims ALL vacant unowned properties board-wide for free with permanent Enchanted Turrets!'
    },
    // S8: Nordic Aurora & Glacial Royalty
    s8_warden_m: {
      icon: '🐺',
      badge: '⚡ S8 IN-BOARD ULTIMATE',
      title: 'Absolute Zero: Rise of the Glacial Citadel',
      desc: 'Blinding subzero flash freeze encases ALL rivals in ice blocks, siphoning cash tribute! Raises the 3D Glacial Ice Citadel with ±1 AoE frost aura, locks roll to Golden 6, and glides on a zero-rent ice bridge.'
    },
    s8_empress_f: {
      icon: '❄️',
      badge: '⚡ S8 IN-BOARD ULTIMATE',
      title: 'Absolute Zero: Rise of the Glacial Citadel',
      desc: 'Blinding subzero flash freeze encases ALL rivals in ice blocks, siphoning cash tribute! Raises the 3D Glacial Ice Citadel with ±1 AoE frost aura, locks roll to Golden 6, and glides on a zero-rent ice bridge.'
    },
    // S9: Egyptian Mirage & Solar Dynasty
    s9_pharaoh_m: {
      icon: '🏺',
      badge: '⚡ S9 IN-BOARD ULTIMATE',
      title: 'Decree of the Nile: Ascent of the Golden Pyramid',
      desc: 'Royal solar decree extorts 20% gold dowry from rivals! Ascends the highest property into the 3D Great Golden Pyramid (+150🪙 passive treasury each lap, 2× rent), pulls the nearest rival forward with a magnetic golden tether, and glides with Golden Scarab Wings.'
    },
    s9_cleopatra_f: {
      icon: '🏺',
      badge: '⚡ S9 IN-BOARD ULTIMATE',
      title: 'Decree of the Nile: Ascent of the Golden Pyramid',
      desc: 'Royal solar decree extorts 20% gold dowry from rivals! Ascends the highest property into the 3D Great Golden Pyramid (+150🪙 passive treasury each lap, 2× rent), pulls the nearest rival forward with a magnetic golden tether, and glides with Golden Scarab Wings.'
    },
    s9_ra_m: {
      icon: '☀️',
      badge: '⚡ S9 IN-BOARD ULTIMATE',
      title: 'Daybreak of Heliopolis: Wrath of the Sun Disk',
      desc: 'Blinding high-noon solar flare incinerates the sky! Desert Sandstorm sweeps ALL rivals 3-6 tiles forward across active hazards, Eye of Ra death ray downgrades 1 rival hotel into gold tribute, and charges ahead with Blazing Solar Falcon Wings!'
    },
    s9_sekhmet_f: {
      icon: '☀️',
      badge: '⚡ S9 IN-BOARD ULTIMATE',
      title: 'Daybreak of Heliopolis: Wrath of the Sun Disk',
      desc: 'Blinding high-noon solar flare incinerates the sky! Desert Sandstorm sweeps ALL rivals 3-6 tiles forward across active hazards, Eye of Ra death ray downgrades 1 rival hotel into gold tribute, and charges ahead with Blazing Solar Falcon Wings!'
    },
    // S10: Phantom Masquerade
    s10_phantom_m: {
      icon: '🎭',
      badge: '⚡ S10 IN-BOARD ULTIMATE',
      title: 'Phantom Masquerade: The Grand Curtain Call',
      desc: 'Orchestral overture shakes the board! Summons the 3D Venetian Harlequin Mask, hexes rivals into Marionette Stasis (movement rolls restricted to 1-3), reverses 100% of rent on marked tiles, and siphons gala tribute!'
    },
    s10_phantom_f: {
      icon: '🎭',
      badge: '⚡ S10 IN-BOARD ULTIMATE',
      title: 'Phantom Masquerade: The Grand Curtain Call',
      desc: 'Orchestral overture shakes the board! Summons the 3D Venetian Harlequin Mask, hexes rivals into Marionette Stasis (movement rolls restricted to 1-3), reverses 100% of rent on marked tiles, and siphons gala tribute!'
    },
    // S11: Pantheon of the Gods
    s11_zeus_m: {
      icon: '⚡',
      badge: '⚡ S11 IN-BOARD ULTIMATE',
      title: 'Wrath of Olympus: Thunder of the Sovereign Gods',
      desc: 'Celestial thunder cracks the heavens! Summons the 3D Mount Olympus Temple, calls down multi-target orbital lightning smiting 1 level off the highest rival hotel (+120🪙 rubble cash), bypasses hazard strips with Pegasus flight, and strikes rivals with divine shockwaves!'
    },
    s11_athena_f: {
      icon: '⚡',
      badge: '⚡ S11 IN-BOARD ULTIMATE',
      title: 'Wrath of Olympus: Thunder of the Sovereign Gods',
      desc: 'Celestial thunder cracks the heavens! Summons the 3D Mount Olympus Temple, calls down multi-target orbital lightning smiting 1 level off the highest rival hotel (+120🪙 rubble cash), bypasses hazard strips with Pegasus flight, and strikes rivals with divine shockwaves!'
    }
  };

  function matchSeason(id, season) {
    if (!id || !season) return false;
    const s = String(id).toLowerCase();
    const tgt = String(season).toLowerCase();
    return s === tgt || s.startsWith(tgt + '_') || s.includes('_' + tgt + '_') || s.endsWith('_' + tgt);
  }

  function getMythicUltimate(costumeId) {
    if (!costumeId) return null;
    if (MYTHIC_ULTIMATES[costumeId]) return MYTHIC_ULTIMATES[costumeId];
    const cid = String(costumeId).toLowerCase();
    if (matchSeason(cid, 's11') || cid.includes('zeus') || cid.includes('athena') || cid.includes('olympus') || cid.includes('pantheon')) {
      return MYTHIC_ULTIMATES.s11_zeus_m;
    }
    if (matchSeason(cid, 's10') || cid.includes('phantom') || cid.includes('masquerade') || cid.includes('black_swan') || cid.includes('curtain_call')) {
      return MYTHIC_ULTIMATES.s10_phantom_m;
    }
    if (cid.includes('s9_ra') || cid.includes('s9_sekhmet') || cid.includes('solar') || cid.includes('heliopolis') || (cid.includes('ra') && !cid.includes('rapunzel')) || cid.includes('sekhmet')) {
      return MYTHIC_ULTIMATES.s9_ra_m;
    }
    if (matchSeason(cid, 's9') || cid.includes('cleopatra') || cid.includes('pharaoh') || cid.includes('gilded') || cid.includes('pyramid') || cid.includes('nile')) {
      return MYTHIC_ULTIMATES.s9_cleopatra_f;
    }
    if (matchSeason(cid, 's8') || cid.includes('empress') || cid.includes('warden') || cid.includes('frost') || cid.includes('glacial') || cid.includes('cryo') || cid.includes('absolute')) {
      return MYTHIC_ULTIMATES.s8_empress_f;
    }
    if (cid.includes('s7_sundrop') || cid.includes('sundrop') || cid.includes('rapunzel') || cid.includes('flynn')) {
      return MYTHIC_ULTIMATES.s7_sundrop_f;
    }
    if (cid.includes('s7_cinderella') || cid.includes('cinderella') || cid.includes('charming')) {
      return MYTHIC_ULTIMATES.s7_cinderella_f;
    }
    if (cid.includes('s7_belle') || cid.includes('belle') || cid.includes('beast') || cid.includes('adam')) {
      return MYTHIC_ULTIMATES.s7_belle_f;
    }
    if (matchSeason(cid, 's6') || cid.includes('astral') || cid.includes('supernova') || cid.includes('aegis')) {
      return MYTHIC_ULTIMATES.s6_supernova_m;
    }
    if (matchSeason(cid, 's5') || cid.includes('atlantis') || cid.includes('abyss') || cid.includes('emperor') || cid.includes('siren')) {
      return MYTHIC_ULTIMATES.s5_emperor_m;
    }
    if (matchSeason(cid, 's4') || cid.includes('monaco') || cid.includes('royale') || cid.includes('roulette')) {
      return MYTHIC_ULTIMATES.s4_royale_m;
    }
    if (matchSeason(cid, 's3') || cid.includes('djinn')) {
      return MYTHIC_ULTIMATES.s3_djinn_m;
    }
    if (cid.includes('phoenix')) {
      return MYTHIC_ULTIMATES.s3_phoenix_m;
    }
    if (cid.includes('inari') || cid.includes('fox')) {
      return MYTHIC_ULTIMATES.s2_inari_m;
    }
    if (cid.includes('celestial') || cid.includes('eclipse') || cid.includes('amaterasu') || cid.includes('tsukuyomi')) {
      return MYTHIC_ULTIMATES.s2_celestial_f;
    }
    if (matchSeason(cid, 's1') || cid.includes('naga') || cid.includes('kinnaree')) {
      return MYTHIC_ULTIMATES.s1_naga_m;
    }
    return null;
  }

  function ultimateBlock(costumeId) {
    const ult = getMythicUltimate(costumeId);
    if (!ult) return '';
    const cid = String(costumeId || '').toLowerCase();
    const isS8 = matchSeason(cid, 's8') || cid.includes('empress') || cid.includes('warden') || cid.includes('frost') || cid.includes('glacial');
    const isS9 = matchSeason(cid, 's9') || cid.includes('cleopatra') || cid.includes('pharaoh') || cid.includes('ra') || cid.includes('sekhmet') || cid.includes('gilded') || cid.includes('solar');
    const isS10 = matchSeason(cid, 's10') || cid.includes('phantom') || cid.includes('masquerade') || cid.includes('black_swan');
    const isS11 = matchSeason(cid, 's11') || cid.includes('zeus') || cid.includes('athena') || cid.includes('olympus');
    return `
      <div class="v-ultimate ${isS8 ? 'theme-s8' : ''} ${isS9 ? 'theme-s9' : ''} ${isS10 ? 'theme-s10' : ''} ${isS11 ? 'theme-s11' : ''}">
        <span class="v-ult-icon">${ult.icon}</span>
        <div>
          <div class="v-ult-tag">${ult.badge} · CHARGED IN MATCH</div>
          <b class="v-ult-title">${ult.title}</b>
          <span class="v-ult-desc">${ult.desc}</span>
        </div>
      </div>`;
  }

  // ---------------------------------------------------------------------------
  // 👗 WARDROBE
  // ---------------------------------------------------------------------------
  function wardrobeItems() {
    const role = myRole();
    const all = chars();
    const season = C.COSTUMES
      .filter((c) => c.role === role && owns(role, c.id) && all[c.id])
      .sort((a, b) => RANK[b.rarity] - RANK[a.rarity])
      .map((c) => all[c.id]);
    const classic = Object.values(all).filter((c) => (c.rarity || 'classic') === 'classic');
    return [...season, ...classic];
  }

  function renderWardrobe() {
    const all = chars();
    const equipped = currentCharId();
    if (!S.selected || !all[S.selected]) S.selected = equipped;
    const item = all[S.selected] || all[equipped] || Object.values(all)[0];
    const r = item.rarity || 'classic';
    const costume = C.BY_ID[item.id] || null;
    const wearing = equipped === item.id;

    const partnerEq = them() && them().equipped;
    const pc = C.BY_ID[partnerEq];
    let resonanceOrUlt = '';
    if (costume) {
      if (r === 'mythic') {
        // Mythic costumes cut out couple resonance and showcase their in-board Ultimate Ability!
        resonanceOrUlt = ultimateBlock(costume.id);
      } else {
        const isPair = isCoupleActive();
        const on = isPair && pc && pc.pair === costume.pair && pc.season === costume.season;
        const mate = C.COSTUMES.find((c) => c.pair === costume.pair && c.role !== costume.role);
        resonanceOrUlt = `
          <div class="v-resonance ${on ? 'on' : ''}">
            <span class="v-res-icon">💞</span>
            <div>
              <b>Couple Resonance ${on ? '· ACTIVE' : ''}</b>
              <span>${on ? C.RESONANCE.desc : (isPair ? `Both wear the ${mate ? mate.name : 'matching'} set → +25 miles each per lap` : `Link partner & both wear the ${mate ? mate.name : 'matching'} set → +25 miles each per lap`)}</span>
            </div>
          </div>`;
      }
    }

    const items = wardrobeItems();
    const counts = { all: items.length, mythic: 0, epic: 0, rare: 0, classic: 0 };
    items.forEach((i) => { counts[i.rarity || 'classic'] += 1; });
    const list = S.filter === 'all' ? items : items.filter((i) => (i.rarity || 'classic') === S.filter);
    const chips = ['all', 'mythic', 'epic', 'rare', 'classic'].map((f) => `
      <button class="v-chip chip-${f} ${S.filter === f ? 'active' : ''}" data-action="filter" data-filter="${f}" id="vaultFilter_${f}">
        ${f === 'all' ? 'All' : f[0].toUpperCase() + f.slice(1)} <i>${counts[f]}</i>
      </button>`).join('');

    const grid = list.length
      ? list.map((i) => cardHtml(i, {
          selected: i.id === item.id,
          equipped: i.id === equipped,
          count: copies(myRole(), i.id),
          isNew: S.seenNew.has(i.id)
        })).join('')
      : `<div class="v-empty">No ${S.filter} costumes yet. <button class="v-link" data-action="tab" data-tab="gacha">Try the Gacha →</button></div>`;

    return `
      <div class="vw-layout">
        <div class="vw-stage stage-${r}" id="vaultStage">
          <div class="vw-stage-bg"></div>
          <div class="vw-rays"></div>
          <div class="vw-motes">${r === 'classic' ? '' : stableMotes(r === 'mythic' ? 22 : r === 'epic' ? 14 : 8)}</div>
          <div class="vw-pedestal"><span></span></div>
          <img class="vw-sprite" ${heroImgAttrs(item.sprite)} alt="${item.name}" draggable="false">
          <div class="vw-info">
            <span class="v-rarity-badge rb-${r}">${stars(r)} ${label(r)}</span>
            <h3 class="vw-name">${item.name}</h3>
            <p class="vw-sub">${item.subtitle || ''}</p>
          </div>
        </div>
        <div class="vw-side">
          ${perkBlock(costume, r)}
          ${resonanceOrUlt}
          <button class="v-wear-btn ${wearing ? 'is-wearing' : ''} wb-${r}" data-action="wear" data-id="${item.id}" id="vaultWearBtn" ${wearing ? 'disabled' : ''}>
            ${wearing ? '✓ Wearing now' : '✨ Wear this look'}
          </button>
          <div class="v-chips">${chips}</div>
          <div class="v-grid">${grid}</div>
        </div>
      </div>`;
  }

  // ---------------------------------------------------------------------------
  // 📖 CODEX
  // ---------------------------------------------------------------------------
  function renderCodex() {
    const activeSeason = S.codexSeason || 'all';
    const allCostumes = C.COSTUMES;
    const scopedCostumes = activeSeason === 'all' ? allCostumes : allCostumes.filter((c) => c.season === activeSeason);

    const mine = scopedCostumes.filter((c) => c.role === myRole());
    const theirs = scopedCostumes.filter((c) => c.role === partnerRole());
    const myOwned = mine.filter((c) => owns(myRole(), c.id)).length;
    const theirOwned = theirs.filter((c) => owns(partnerRole(), c.id)).length;
    const total = scopedCostumes.length;
    const both = myOwned + theirOwned;
    const pct = total > 0 ? Math.round((both / total) * 100) : 0;

    const s1Total = allCostumes.filter((c) => c.season === 's1').length;
    const s2Total = allCostumes.filter((c) => c.season === 's2').length;
    const s3Total = allCostumes.filter((c) => c.season === 's3').length;
    const s4Total = allCostumes.filter((c) => c.season === 's4').length;
    const s5Total = allCostumes.filter((c) => c.season === 's5').length;
    const s6Total = allCostumes.filter((c) => c.season === 's6').length;
    const s7Total = allCostumes.filter((c) => c.season === 's7').length;
    const s8Total = allCostumes.filter((c) => c.season === 's8').length;
    const s9Total = allCostumes.filter((c) => c.season === 's9').length;
    const s10Total = allCostumes.filter((c) => c.season === 's10').length;
    const s11Total = allCostumes.filter((c) => c.season === 's11').length;

    const pairs = [];
    scopedCostumes.forEach((c) => { if (!pairs.includes(c.pair)) pairs.push(c.pair); });

    const rows = pairs.map((pair) => {
      const set = scopedCostumes.filter((c) => c.pair === pair);
      const bkk = set.find((c) => c.role === 'bkk');
      const dxb = set.find((c) => c.role === 'dxb');
      const r = (set[0] && set[0].rarity) || 'rare';
      const perk = (set[0] && C.PERKS[set[0].perk]) || { icon: '✨', name: 'Perk' };
      const complete = bkk && dxb && owns('bkk', bkk.id) && owns('dxb', dxb.id);
      const half = (c, role) => {
        if (!c) {
          const who = role === myRole() ? 'You' : 'Partner';
          return `
            <div class="vc-half">
              <span class="vc-who ${role === myRole() ? 'me' : ''}">${who} · ${roleTag(role)}</span>
              <div class="v-card is-locked" style="display:flex;align-items:center;justify-content:center;min-height:100px;opacity:0.4;">
                <span style="font-size:11px;color:var(--v-dim);">—</span>
              </div>
            </div>`;
        }
        const item = chars()[c.id] || { id: c.id, name: c.name, sprite: c.sprite, rarity: c.rarity };
        const locked = !owns(c.role, c.id);
        const who = c.role === myRole() ? 'You' : 'Partner';
        return `
          <div class="vc-half">
            <span class="vc-who ${c.role === myRole() ? 'me' : ''}">${who} · ${roleTag(c.role)}</span>
            ${cardHtml(item, { action: 'inspect', locked, prefix: 'c', count: copies(c.role, c.id) })}
          </div>`;
      };
      return `
        <article class="vc-pair vp-${r} ${complete ? 'complete' : ''}">
          <header class="vc-pair-head">
            <span class="v-rarity-badge rb-${r}">${stars(r)} ${label(r)}</span>
            <span class="vc-pair-name">${set[0] ? set[0].name.replace(/\s[\u{1F300}-\u{1FAFF}]$/u, '') : 'Couple Set'}</span>
            ${complete ? '<span class="vc-complete">💞 Pair complete</span>' : ''}
          </header>
          <div class="vc-pair-body">
            ${half(bkk, 'bkk')}
            <div class="vc-link"><span>${perk.icon}</span><small>${perk.name}</small></div>
            ${half(dxb, 'dxb')}
          </div>
        </article>`;
    }).join('');

    const classic = Object.values(chars()).filter((c) => (c.rarity || 'classic') === 'classic');
    const seasonHeader = activeSeason === 's1' ? C.SEASONS.s1 : activeSeason === 's2' ? C.SEASONS.s2 : activeSeason === 's3' ? C.SEASONS.s3 : activeSeason === 's4' ? C.SEASONS.s4 : activeSeason === 's5' ? C.SEASONS.s5 : activeSeason === 's6' ? C.SEASONS.s6 : activeSeason === 's7' ? C.SEASONS.s7 : activeSeason === 's8' ? C.SEASONS.s8 : activeSeason === 's9' ? C.SEASONS.s9 : activeSeason === 's10' ? C.SEASONS.s10 : activeSeason === 's11' ? C.SEASONS.s11 : {
      name: 'All Seasons',
      tagline: 'Your complete shared journey across Bangkok, Tokyo, Dubai, Monaco, Atlantis, Starlight, Fairytales, Nordic Aurora, Egypt, Venice & Olympus ✨',
      icon: '💎'
    };

    return `
      <div class="vc-filter-bar">
        <button class="vc-fbtn ${activeSeason === 'all' ? 'active' : ''}" data-action="set-codex-season" data-season="all">
          <span>💎 All (${allCostumes.length / 2} Pairs)</span>
        </button>
        <button class="vc-fbtn ${activeSeason === 's11' ? 'active' : ''}" data-action="set-codex-season" data-season="s11">
          <span>⚡ S11: Olympus (${s11Total / 2} Pairs)</span>
        </button>
        <button class="vc-fbtn ${activeSeason === 's10' ? 'active' : ''}" data-action="set-codex-season" data-season="s10">
          <span>🎭 S10: Venice (${s10Total / 2} Pairs)</span>
        </button>
        <button class="vc-fbtn ${activeSeason === 's9' ? 'active' : ''}" data-action="set-codex-season" data-season="s9">
          <span>☀️ S9: Egypt (${s9Total / 2} Pairs)</span>
        </button>
        <button class="vc-fbtn ${activeSeason === 's8' ? 'active' : ''}" data-action="set-codex-season" data-season="s8">
          <span>❄️ S8: Glacial (${s8Total / 2} Pairs)</span>
        </button>
        <button class="vc-fbtn ${activeSeason === 's7' ? 'active' : ''}" data-action="set-codex-season" data-season="s7">
          <span>👑 S7: Fairytales (${s7Total / 2} Pairs)</span>
        </button>
        <button class="vc-fbtn ${activeSeason === 's6' ? 'active' : ''}" data-action="set-codex-season" data-season="s6">
          <span>🌌 S6: Starlight (${s6Total / 2} Pairs)</span>
        </button>
        <button class="vc-fbtn ${activeSeason === 's5' ? 'active' : ''}" data-action="set-codex-season" data-season="s5">
          <span>🔱 S5: Atlantis (${s5Total / 2} Pairs)</span>
        </button>
        <button class="vc-fbtn ${activeSeason === 's4' ? 'active' : ''}" data-action="set-codex-season" data-season="s4">
          <span>🎰 S4: Monaco (${s4Total / 2} Pairs)</span>
        </button>
        <button class="vc-fbtn ${activeSeason === 's3' ? 'active' : ''}" data-action="set-codex-season" data-season="s3">
          <span>🏜️ S3: Dubai (${s3Total / 2} Pairs)</span>
        </button>
        <button class="vc-fbtn ${activeSeason === 's2' ? 'active' : ''}" data-action="set-codex-season" data-season="s2">
          <span>🌸 S2: Tokyo (${s2Total / 2} Pairs)</span>
        </button>
        <button class="vc-fbtn ${activeSeason === 's1' ? 'active' : ''}" data-action="set-codex-season" data-season="s1">
          <span>🌃 S1: Bangkok (${s1Total / 2} Pairs)</span>
        </button>
      </div>

      <div class="vc-hero">
        <div class="vc-hero-text">
          <span class="vc-kicker">Couple Codex</span>
          <h3>${seasonHeader.icon} ${seasonHeader.name}</h3>
          <p>${seasonHeader.tagline}</p>
        </div>
        <div class="vc-progress">
          <div class="vc-ring" style="--p:${pct}"><b>${pct}%</b><small>together</small></div>
          <div class="vc-counts">
            <span><i class="dot me"></i>You <b>${myOwned}/${mine.length}</b></span>
            <span><i class="dot partner"></i>Partner <b>${theirOwned}/${theirs.length}</b></span>
          </div>
        </div>
      </div>
      <div class="vc-pairs">${rows}</div>
      <details class="vc-classic">
        <summary>🎨 Classic Collection <i>${classic.length} outfits · always unlocked</i></summary>
        <div class="v-grid small">${classic.map((c) => cardHtml(c, { action: 'inspect', small: true, prefix: 'cc' })).join('')}</div>
      </details>`;
  }

  // ---------------------------------------------------------------------------
  // 🎰 GACHA
  // ---------------------------------------------------------------------------
  function formatShortTime(ms) {
    if (ms <= 0) return 'Ended';
    const s = Math.floor(ms / 1000);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (d > 0) return `${d}d ${h}h left`;
    if (h > 0) return `${h}h ${m}m left`;
    return `${m}m left`;
  }

  function formatLongTime(ms) {
    if (ms <= 0) return 'Season Ended';
    const s = Math.floor(ms / 1000);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (d > 0) return `${d}d ${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m remaining`;
    return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(sec).padStart(2, '0')}s remaining`;
  }

  function getActiveGachaSeasons() {
    const banners = (S.profiles && S.profiles.banners) || {};
    const now = Date.now();
    const active = [];
    Object.keys(C.SEASONS).forEach((k) => {
      const s = C.SEASONS[k];
      if (s.archived) return;
      const sched = banners[k];
      const endsAt = s.endsAt || sched?.endsAt;
      if (endsAt && now > endsAt) return;
      active.push({ ...s, endsAt: endsAt || null });
    });
    // Permanent main banner is always pinned first, followed by active limited seasons
    active.sort((a, b) => {
      if (a.isMain || a.id === 'main') return -1;
      if (b.isMain || b.id === 'main') return 1;
      return 0;
    });
    return active;
  }

  let _gachaTicker = null;
  function startGachaTicker() {
    if (_gachaTicker) clearInterval(_gachaTicker);
    _gachaTicker = setInterval(() => {
      if (S.tab !== 'gacha' || !S.open) {
        clearInterval(_gachaTicker);
        _gachaTicker = null;
        return;
      }
      let anyExpired = false;
      document.querySelectorAll('.vg-countdown-val').forEach((el) => {
        const ends = Number(el.dataset.endsAt);
        if (!ends) return;
        const diff = ends - Date.now();
        if (diff <= 0) {
          anyExpired = true;
          el.textContent = 'Season Ended';
        } else {
          el.textContent = `⏳ ${formatLongTime(diff)}`;
        }
      });
      document.querySelectorAll('.vg-snav-timer, .vg-ribbon-timer').forEach((el) => {
        const ends = Number(el.dataset.endsAt);
        if (!ends) return;
        const diff = ends - Date.now();
        if (diff <= 0) {
          anyExpired = true;
          el.textContent = '⏳ Ended';
        } else {
          el.textContent = `⏳ ${formatShortTime(diff)}`;
        }
      });
      if (anyExpired) {
        render();
      }
    }, 1000);
  }

  function stopGachaTicker() {
    if (_gachaTicker) {
      clearInterval(_gachaTicker);
      _gachaTicker = null;
    }
  }

  function stepGachaSeason(dir) {
    const activeSeasons = getActiveGachaSeasons();
    if (!activeSeasons || activeSeasons.length <= 1) return;
    const curIdx = activeSeasons.findIndex((s) => s.id === (S.gachaSeason || activeSeasons[0].id));
    const nextIdx = (curIdx + dir + activeSeasons.length) % activeSeasons.length;
    S.gachaSeason = activeSeasons[nextIdx].id;
    S.featuredMythicIdx = 0;
    Sound.flip();
    render();
    scrollActiveGachaRibbon();
  }

  function scrollActiveGachaRibbon() {
    requestAnimationFrame(() => {
      const ribbon = document.querySelector('.vg-season-ribbon');
      if (!ribbon) return;
      const activeChip = ribbon.querySelector(`.vg-ribbon-chip[data-season="${S.gachaSeason}"]`);
      if (!activeChip) return;
      // Scroll the ribbon container only, NEVER the outer window or page
      const targetLeft = activeChip.offsetLeft - (ribbon.clientWidth / 2) + (activeChip.offsetWidth / 2);
      ribbon.scrollTo({ left: Math.max(0, targetLeft), behavior: 'smooth' });
      // Strictly guard against horizontal scroll on parent document/body/window
      if (typeof window !== 'undefined' && (window.scrollX > 0 || window.pageXOffset > 0)) {
        window.scrollTo(0, window.scrollY || window.pageYOffset || 0);
      }
      if (document.documentElement.scrollLeft !== 0) document.documentElement.scrollLeft = 0;
      if (document.body.scrollLeft !== 0) document.body.scrollLeft = 0;
      const body = $('vaultBody');
      if (body && body.scrollLeft !== 0) body.scrollLeft = 0;
    });
  }

  function renderGacha() {
    const role = myRole();
    const p = me();
    const activeSeasons = getActiveGachaSeasons();
    if (activeSeasons.length > 0 && !activeSeasons.some((s) => s.id === S.gachaSeason)) {
      S.gachaSeason = activeSeasons[0].id;
    }
    if (activeSeasons.length === 0) {
      return `
        <div class="vg-empty-state" style="padding:48px 20px;text-align:center;color:var(--v-dim);">
          <div style="font-size:48px;margin-bottom:12px;">✨</div>
          <h3 style="font:800 18px var(--v-font-d);color:#fff;margin-bottom:8px;">No Active Banners Right Now</h3>
          <p style="font-size:13px;max-width:320px;margin:0 auto 16px;">The current gacha seasons have concluded. Past collections can still be viewed in the <strong>📖 Codex</strong> tab. Check back soon for the next destination or limited rerun!</p>
        </div>
      `;
    }

    const sKey = S.gachaSeason || activeSeasons[0].id;
    const season = C.SEASONS[sKey] || activeSeasons[0];
    const bannerSched = (S.profiles && S.profiles.banners && S.profiles.banners[sKey]) || null;
    const bannerEndsAt = bannerSched?.endsAt || season.endsAt || null;
    const msRemaining = bannerEndsAt ? Math.max(0, bannerEndsAt - Date.now()) : null;
    const isUrgent = msRemaining != null && msRemaining < 86400000;
    const pool = C.poolFor(role, sKey);
    const mythics = pool.filter((c) => c.rarity === 'mythic');
    const epics = pool.filter((c) => c.rarity === 'epic');

    const heroMythic = mythics[S.featuredMythicIdx % (mythics.length || 1)] || pool[0];
    // Per-banner pity separation: read the active banner's specific pity counter
    const bannerPity = (p.pityByBanner && p.pityByBanner[sKey]) || (p.pity && !p.pityByBanner ? p.pity : { epic: 0, mythic: 0 });
    const pMythicPity = bannerPity.mythic || 0;
    const pEpicPity = bannerPity.epic || 0;
    const mythicLeft = Math.max(1, E.MYTHIC_HARD_PITY - pMythicPity);
    const epicLeft = Math.max(1, E.EPIC_PITY - pEpicPity);
    const mythicPct = Math.min(100, (pMythicPity / E.MYTHIC_HARD_PITY) * 100);
    const epicPct = Math.min(100, (pEpicPity / E.EPIC_PITY) * 100);
    const soft = pMythicPity >= E.MYTHIC_SOFT_PITY;
    const can1 = p.diamonds >= E.PULL_1;
    const can10 = p.diamonds >= E.PULL_10;
    const mPerk = C.PERKS[heroMythic.perk] || { icon: '✨', name: 'Perk', desc: '' };

    const shop = pool
      .slice()
      .sort((a, b) => RANK[b.rarity] - RANK[a.rarity])
      .map((c) => {
        const item = chars()[c.id];
        const have = owns(role, c.id);
        const price = C.RARITY[c.rarity].shop;
        const afford = p.stardust >= price;
        return `
          <div class="vg-shop-item ${have ? 'owned' : ''}">
            ${cardHtml(item, { action: 'inspect', locked: !have, prefix: 's', small: true })}
            <button class="vg-shop-btn" data-action="exchange" data-id="${c.id}" id="vaultExchange_${c.id}" ${have || !afford ? 'disabled' : ''}>
              ${have ? 'Owned' : `✨ ${fmt(price)}`}
            </button>
          </div>`;
      }).join('');

    const isS7 = sKey === 's7';
    const isS6 = sKey === 's6';
    const isS5 = sKey === 's5';
    const isS4 = sKey === 's4';
    const isS3 = sKey === 's3';
    const isS2 = sKey === 's2';
    const motesHtml = isS7 ? stableMotes(24, 'vg-fairytale') : isS6 ? stableMotes(22, 'vg-stardust') : isS5 ? stableMotes(20, 'vg-bubbles') : isS4 ? stableMotes(18, 'vg-chips') : isS3 ? stableMotes(18, 'vg-sand') : isS2 ? stableMotes(18, 'vg-sakura') : stableMotes(14, 'vg-lantern');

    return `
      <div class="vg-season-ribbon" role="tablist" aria-label="Gacha Destinations">
        ${activeSeasons.map((s) => {
          const isAct = s.id === sKey;
          const leftMs = s.endsAt ? Math.max(0, s.endsAt - Date.now()) : null;
          const timerText = leftMs != null ? formatShortTime(leftMs) : '';
          const shortName = s.name.split(':')[0].trim();
          return `
            <button class="vg-ribbon-chip ${isAct ? 'active' : ''} ${s.isMain ? 'is-main-banner' : ''}" data-action="set-gacha-season" data-season="${s.id}" id="vaultGacha_${s.id}Btn" role="tab" aria-selected="${isAct}">
              ${s.isMain ? '<span class="vg-ribbon-badge main-badge">PERMANENT</span>' : (s.id === 's11' ? '<span class="vg-ribbon-badge">NEW</span>' : '')}
              <span class="vg-ribbon-icon">${s.icon || '✨'}</span>
              <span class="vg-ribbon-label">${shortName}</span>
              ${timerText ? `<span class="vg-ribbon-timer" data-ends-at="${s.endsAt}">⏳ ${timerText}</span>` : (s.isMain ? '<span class="vg-ribbon-timer perm">♾️ Forever</span>' : '')}
            </button>
          `;
        }).join('')}
      </div>

      <div class="vg-banner season-${sKey}" id="vgBanner" data-swipeable="true">
        <div class="vg-sky">
          <div class="vg-art" style="background-image: linear-gradient(90deg, rgba(9, 4, 28, 0.88) 0%, rgba(9, 4, 28, 0.55) 38%, rgba(9, 4, 28, 0.05) 70%), linear-gradient(0deg, rgba(9, 4, 28, 0.7), transparent 40%), url('${season.banner}')"></div>
          <div class="vg-neon">${motesHtml}</div>
        </div>
        <div class="vg-banner-copy">
          <div class="vg-kicker-row">
            <span class="vg-kicker">${season.icon || '✨'} ${season.isMain ? 'Permanent Standard Collection' : `Limited ${season.name} Banner`}</span>
            ${bannerEndsAt ? `
              <span class="vg-banner-timer ${isUrgent ? 'urgent' : ''}">
                <span class="vg-timer-dot"></span>
                <span class="vg-countdown-val" data-ends-at="${bannerEndsAt}">⏳ ${formatLongTime(bannerEndsAt - Date.now())}</span>
              </span>
            ` : (season.isMain ? `
              <span class="vg-banner-timer permanent-timer">
                <span class="vg-timer-dot green"></span>
                <span class="vg-countdown-val perm">♾️ Permanent Standard Pool</span>
              </span>
            ` : '')}
            ${!season.isMain && mythics.length > 1 ? `<button class="vg-toggle-featured" data-action="toggle-featured-mythic" title="Toggle featured Mythic">⇄ Switch ${mythics[(S.featuredMythicIdx + 1) % mythics.length].name.split(' ')[0]}</button>` : ''}
          </div>
          <h3 class="vg-title">${season.name.replace(' ', '<br><em>')}</em></h3>
          <p class="vg-tag">${season.tagline}</p>
          ${season.isMain ? `
            <div class="vg-feature vg-feature-allstars">
              <span class="v-rarity-badge rb-allstars">⭐ PERMANENT ALL-STAR COLLECTION</span>
              <b>All Legendary Realms & Costumes</b>
              <small>✈️ <b>Unbounded Horizon</b>: All Mythic & Epic costumes from every destination. Pity never expires!</small>
              <div class="vg-feature-sub allstars-stats">
                <span class="vg-stat-pill mythic">👑 ${mythics.length} Mythics</span>
                <span class="vg-stat-pill epic">💜 ${epics.length} Epics</span>
                <span class="vg-stat-pill total">💎 ${pool.length} Total</span>
              </div>
            </div>
          ` : `
            <div class="vg-feature">
              <span class="v-rarity-badge rb-mythic">⭐⭐⭐ ${mythics.length > 1 ? 'MYTHIC · DOUBLE FEATURE' : 'MYTHIC'}</span>
              <b>${heroMythic.name}</b>
              <small>${mPerk.icon} <b>${mPerk.name}</b>: ${mPerk.desc}</small>
              ${mythics.length > 1 ? `<div class="vg-feature-sub">Also featuring: <b>${mythics.filter(m => m.id !== heroMythic.id).map(m => m.name).join(', ')}</b></div>` : ''}
            </div>
          `}
        </div>
        ${season.isMain ? `
          <div class="vg-hero-wrap allstars-crest-wrap">
            <div class="vg-hero-halo gold-halo"></div>
            <img class="vg-hero allstars-crest" src="assets/ui/sky_party_crest.png" alt="Sky Party Grand All-Stars" draggable="false">
          </div>
        ` : `
          <div class="vg-hero-wrap">
            <div class="vg-hero-halo"></div>
            <img class="vg-hero" ${heroImgAttrs(heroMythic.sprite)} alt="${heroMythic.name}" draggable="false">
          </div>
        `}
        <div class="vg-epics ${season.isMain ? 'allstars-epics' : ''}">
          ${(season.isMain ? epics.slice(0, 8) : epics).map((c) => `<div class="vg-epic"><img ${heroImgAttrs(c.sprite)} alt="${c.name}" draggable="false"><span>${c.name}</span></div>`).join('')}
        </div>
      </div>

      ${activeSeasons.length > 1 ? `
        <div class="vg-banner-controls">
          <button class="vg-banner-nav-btn prev" data-action="prev-gacha-season" aria-label="Previous banner" title="Previous banner">‹</button>
          <div class="vg-banner-dots">
            ${activeSeasons.map((s, idx) => `
              <button class="vg-banner-dot ${s.id === sKey ? 'active' : ''}" data-action="set-gacha-season" data-season="${s.id}" aria-label="Go to banner ${idx + 1}"></button>
            `).join('')}
          </div>
          <button class="vg-banner-nav-btn next" data-action="next-gacha-season" aria-label="Next banner" title="Next banner">›</button>
        </div>
      ` : ''}

      <div class="vg-pity">
        <div class="vg-pity-item mythic ${soft ? 'soft' : ''}">
          <div class="vg-pity-row"><span>🌟 Mythic guaranteed within</span><b>${mythicLeft} <small class="vg-pity-sub">(${pMythicPity}/${E.MYTHIC_HARD_PITY})</small></b></div>
          <div class="vg-bar"><i style="width:${mythicPct}%"></i></div>
          ${soft ? '<small class="vg-soft">🔥 Soft pity active — Mythic odds rising every pull</small>' : ''}
        </div>
        <div class="vg-pity-item epic">
          <div class="vg-pity-row"><span>💜 Epic or better within</span><b>${epicLeft} <small class="vg-pity-sub">(${pEpicPity}/${E.EPIC_PITY})</small></b></div>
          <div class="vg-bar"><i style="width:${epicPct}%"></i></div>
        </div>
      </div>

      <div class="vg-actions">
        ${p && p.tickets > 0 ? `
          <button class="vg-pull ticket-pull" data-action="pull-ticket" id="vaultPullTicket" title="Use 1 Lucky Flight Ticket for a free VIP pull">
            <span class="vg-pull-ribbon">VIP TICKET</span>
            <span class="vg-pull-label">Free Pull ×1</span>
            <span class="vg-pull-cost">🎟️ ${p.tickets} Available</span>
          </button>
        ` : ''}
        <button class="vg-pull one" data-action="pull" data-count="1" id="vaultPull1" ${can1 ? '' : 'disabled'}>
          <span class="vg-pull-label">Pull ×1</span>
          <span class="vg-pull-cost">💎 ${E.PULL_1}</span>
        </button>
        <button class="vg-pull ten" data-action="pull" data-count="10" id="vaultPull10" ${can10 ? '' : 'disabled'}>
          <span class="vg-pull-ribbon">-10%</span>
          <span class="vg-pull-label">Pull ×10</span>
          <span class="vg-pull-cost">💎 ${E.PULL_10} <s>${E.PULL_1 * 10}</s></span>
        </button>
      </div>
      <p class="vg-rates">
        <b class="t-mythic">Mythic 3%</b> · <b class="t-epic">Epic 17%</b> · <b class="t-rare">Rare 80%</b>
        · Epic+ every ${E.EPIC_PITY} · Mythic by ${E.MYTHIC_HARD_PITY} · Pity carries over
      </p>

      <section class="vg-section">
        <h4>✨ Stardust Exchange · ${season.name}</h4>
        <p>Duplicates melt into stardust (Rare ${C.RARITY.rare.dust} · Epic ${C.RARITY.epic.dust} · Mythic ${C.RARITY.mythic.dust}). Trade it for any piece you're missing.</p>
        <div class="vg-shop">${shop}</div>
      </section>

      <section class="vg-section">
        <h4>💎 How to earn diamonds & tickets</h4>
        <ul class="vg-earn">
          <li><span>🔥</span>4P vs 2 Hard Bots (1st Place)<b>+1,150💎 + 🎟️ Ticket</b></li>
          <li><span>🤝</span>Flight Syndicate Dividend (Partner 10-Pull!)<b>+900💎</b></li>
          <li><span>💥</span>Whiskers Landmark Demolition Bounty<b>+100💎 each</b></li>
          <li><span>💞</span>Couple Vibe Match + Golden Shield<b>+35💎 each</b></li>
          <li><span>🏆</span>Couple Monopoly win<b>+${E.WIN}💎</b></li>
          <li><span>🤝</span>Couple Monopoly finish<b>+${E.LOSS}💎</b></li>
          <li><span>😈</span>Solo vs Hard Captain Whiskers<b>+450💎</b></li>
          <li><span>☀️</span>First game of the day<b>+${E.DAILY_FIRST_GAME}💎</b></li>
        </ul>
        <p class="vg-fine">Perks lock in when a new Monopoly game starts. They never touch Vibe Check answers 💯</p>
      </section>`;
  }

  // ---------------------------------------------------------------------------
  // Inspect sheet (Codex / shop)
  // ---------------------------------------------------------------------------
  function inspect(id) {
    const c = C.BY_ID[id];
    const item = chars()[id] || (c ? { id: c.id, name: c.name, sprite: c.sprite, rarity: c.rarity, subtitle: c.subtitle } : null);
    if (!item) return;
    const r = (c && c.rarity) || (item && item.rarity) || 'classic';
    const role = c ? c.role : myRole();
    const locked = c ? !owns(role, id) : false;
    const mineToWear = !c || (c.role === myRole() && !locked);
    const box = $('vaultInspect');
    if (!box) return;
    const seasonLabel = c && C.SEASONS[c.season] ? C.SEASONS[c.season].name : '';
    box.innerHTML = `
      <div class="vi-backdrop" data-action="inspect-close"></div>
      <div class="vi-card stage-${r} ${locked ? 'locked' : ''}">
        <button class="vi-close" data-action="inspect-close" aria-label="Close">✕</button>
        <div class="vi-art" ${locked ? 'data-action="toggle-inspect-silhouette" title="Tap to toggle preview / shadow"' : ''}>
          <div class="vw-rays"></div>
          <img ${heroImgAttrs(item.sprite)} alt="${item.name}" draggable="false">
          ${locked ? '<span class="vi-preview-chip"><span class="vi-st-icon">👁️</span> <span class="vi-st-text">Codex Preview</span></span>' : ''}
        </div>
        <span class="v-rarity-badge rb-${r}">${stars(r)} ${label(r)}${locked ? ' · Preview' : ''}</span>
        <h3>${item.name}</h3>
        <p class="vi-sub">${item.subtitle || ''}${c ? ` · ${roleTag(c.role)} version` : ''}</p>
        ${perkBlock(c, r)}
        ${r === 'mythic' && c ? ultimateBlock(c.id) : ''}
        <p class="vi-how">${c
          ? (locked ? `🔒 Unowned · 🎰 ${seasonLabel} Gacha · or ✨ ${fmt(C.RARITY[r].shop)} stardust${c.role !== myRole() ? ' (partner\u2019s side)' : ''}` : `✅ Owned${copies(role, id) > 1 ? ` · ×${copies(role, id)}` : ''}`)
          : '🎁 Free classic outfit'}</p>
        ${mineToWear ? `<button class="v-wear-btn wb-${r}" data-action="wear" data-id="${id}" ${currentCharId() === id ? 'disabled' : ''}>${currentCharId() === id ? '✓ Wearing now' : '✨ Wear this look'}</button>` : ''}
      </div>`;
    box.classList.add('open');
  }
  function closeInspect() {
    const box = $('vaultInspect');
    if (box) { box.classList.remove('open'); box.innerHTML = ''; }
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------
  function onClick(e) {
    const t = e.target.closest('[data-action]');
    if (!t) return;
    e.stopPropagation();
    const a = t.dataset.action;
    const id = t.dataset.id;
    switch (a) {
      case 'close': close(); break;
      case 'switch-base': {
        const base = t.dataset.base;
        if (window.SkySupabase && typeof window.SkySupabase.updateCharacterBase === 'function') {
          window.SkySupabase.updateCharacterBase(base);
        }
        updateVaultBaseSwitcher();
        Sound.tap();
        render();
        break;
      }
      case 'tab':
        closeInspect();
        setTab(t.dataset.tab);
        if (t.id === 'vaultStardust') {
          const p = me();
          toast(`✨ ${p ? fmt(p.stardust) : 0} Stardust — Spend in Wardrobe to craft outfits!`);
        }
        break;
      case 'filter': S.filter = t.dataset.filter; Sound.tap(); render(); break;
      case 'set-gacha-season':
        S.gachaSeason = t.dataset.season;
        S.featuredMythicIdx = 0;
        Sound.tap();
        render();
        scrollActiveGachaRibbon();
        break;
      case 'prev-gacha-season':
        stepGachaSeason(-1);
        break;
      case 'next-gacha-season':
        stepGachaSeason(1);
        break;
      case 'set-codex-season':
        S.codexSeason = t.dataset.season;
        Sound.tap();
        render();
        break;
      case 'toggle-featured-mythic':
        S.featuredMythicIdx = (S.featuredMythicIdx || 0) + 1;
        Sound.tap();
        render();
        break;
      case 'select':
        S.selected = id; S.seenNew.delete(id); Sound.tap(); render();
        if (window.innerWidth < 760) { const b = $('vaultBody'); if (b) b.scrollTo({ top: 0, behavior: 'smooth' }); }
        break;
      case 'wear': equip(id); break;
      case 'inspect': Sound.tap(); inspect(id); break;
      case 'inspect-close': closeInspect(); break;
      case 'toggle-inspect-silhouette': {
        const card = $('vaultInspect')?.querySelector('.vi-card');
        if (card) {
          card.classList.toggle('show-silhouette');
          const isSil = card.classList.contains('show-silhouette');
          const txt = card.querySelector('.vi-st-text');
          if (txt) txt.textContent = isSil ? 'Shadow' : 'Codex Preview';
        }
        break;
      }
      case 'pull': pull(Number(t.dataset.count) === 10 ? 10 : 1); break;
      case 'pull-ticket': pullTicket(); break;
      case 'open-envelope-sender': openEnvelopeSender(t.dataset.amount); break;
      case 'open-sanctuary':
        closeEnvelopeModal();
        close();
        if (window.SkySocialUI && typeof window.SkySocialUI.openDrawer === 'function') {
          window.SkySocialUI.openDrawer('couple');
        }
        break;
      case 'close-envelope-modal': closeEnvelopeModal(); break;
      case 'envelope-tab': S.envelopeTab = t.dataset.tab; Sound.tap(); renderEnvelopeModal(); break;
      case 'set-envelope-amt': S.envelopeAmount = Number(t.dataset.amount) || 50; Sound.tap(); renderEnvelopeModal(); break;
      case 'set-envelope-blessing': S.envelopeBlessing = t.dataset.blessing; S.envelopeMessage = t.dataset.text; Sound.tap(); renderEnvelopeModal(); break;
      case 'send-envelope': submitEnvelope(); break;
      case 'exchange': exchange(id); break;
      case 'skip': doSkip(); break;
      case 'pull-done': finishPull(); break;
      case 'pull-again': finishPull(); pull(Number(t.dataset.count) === 10 ? 10 : 1); break;
      case 'pull-wear': finishPull(); S.tab = 'wardrobe'; S.selected = id; equip(id); break;
      case 'pull-card': revealOne(t); break;
    }
  }

  function equip(id) {
    const all = chars();
    if (!all[id] || !window.equipAvatarCharacter) return;
    if (C.BY_ID[id] && !owns(myRole(), id)) { toast('🔒 You don\u2019t own this costume yet'); return; }
    window.equipAvatarCharacter(id, true);
    S.pendingEquip = id;
    if (me()) me().equipped = id;
    send({ type: 'vault_equip', costumeId: id, manual: true });
    S.selected = id;
    S.seenNew.delete(id);
    const r = rarityOf(id);
    if (r === 'mythic') Sound.mythic(); else if (r === 'epic') Sound.epic(); else if (r === 'rare') Sound.rare(); else Sound.tap();
    closeInspect();
    render();
    const stage = $('vaultStage');
    if (stage) { stage.classList.remove('equip-pop'); void stage.offsetWidth; stage.classList.add('equip-pop'); }

    // Synchronize to Monopoly v2 and v1
    if (typeof window.syncMonopolyCostumes === 'function') {
      window.syncMonopolyCostumes();
    } else if (window.NookMonoV2 && typeof window.NookMonoV2.syncLoadout === 'function') {
      window.NookMonoV2.syncLoadout();
    }
    if (typeof updateLobbySeats === 'function') {
      updateLobbySeats();
    }
  }

  function pull(count) {
    const p = me();
    if (S.pulling || !p) return;
    const cost = count === 10 ? E.PULL_10 : E.PULL_1;
    if (p.diamonds < cost) { toast(`💎 Need ${fmt(cost)} diamonds — win a Monopoly game!`); return; }
    S.pulling = true;
    const reqId = `p${++S.reqSeq}_${Date.now()}`;
    const season = S.gachaSeason || 's5';
    S.pending = { reqId, count, season };
    clearTimeout(S.pendingTimer);
    S.pendingTimer = setTimeout(() => {
      if (S.pending && S.pending.reqId === reqId) {
        S.pending = null; S.pulling = false;
        closePullFx();
        toast('📡 The vault didn\u2019t answer — check your connection');
      }
    }, 9000);
    Sound.tap();
    openPullFx();
    const pullerName = (window.SkySupabase && window.SkySupabase.getCurrentUser()?.username) ||
                       (myRole() === 'dxb' ? 'Dragon Girl 🐉' : 'Wolf Boy 🐺');
    send({ type: 'vault_pull', count, reqId, season, username: pullerName });
  }

  function pullTicket() {
    const p = me();
    if (S.pulling || !p) return;
    if ((p.tickets || 0) < 1) { toast('🎟️ No Lucky Flight Tickets remaining'); return; }
    S.pulling = true;
    const reqId = `pt${++S.reqSeq}_${Date.now()}`;
    const season = S.gachaSeason || 'main';
    S.pending = { reqId, count: 1, season };
    clearTimeout(S.pendingTimer);
    S.pendingTimer = setTimeout(() => {
      if (S.pending && S.pending.reqId === reqId) {
        S.pending = null; S.pulling = false;
        closePullFx();
        toast('📡 The vault didn\u2019t answer — check your connection');
      }
    }, 9000);
    Sound.tap();
    openPullFx();
    const pullerName = (window.SkySupabase && window.SkySupabase.getCurrentUser()?.username) ||
                       (myRole() === 'dxb' ? 'Dragon Girl 🐉' : 'Wolf Boy 🐺');
    send({ type: 'vault_pull', count: 1, reqId, season, useTicket: true, username: pullerName });
  }

  function exchange(id) {
    const c = C.BY_ID[id];
    const p = me();
    if (!c || !p || S.pulling) return;
    const price = C.RARITY[c.rarity].shop;
    if (p.stardust < price) { toast('✨ Not enough stardust'); return; }
    if (!window.confirm(`Trade ✨ ${price} stardust for ${c.name}?`)) return;
    S.pulling = true;
    const reqId = `x${++S.reqSeq}_${Date.now()}`;
    S.pending = { reqId, count: 1 };
    openPullFx();
    const pullerName = (window.SkySupabase && window.SkySupabase.getCurrentUser()?.username) ||
                       (myRole() === 'dxb' ? 'Dragon Girl 🐉' : 'Wolf Boy 🐺');
    send({ type: 'vault_exchange', costumeId: id, reqId, username: pullerName });
  }

  // ---------------------------------------------------------------------------
  // 🎇 Pull animation
  // ---------------------------------------------------------------------------
  function wait(ms) {
    if (S.skip) return Promise.resolve();
    return new Promise((res) => {
      const t = setTimeout(res, reduced ? ms * 0.5 : ms);
      S.waiters.push(() => { clearTimeout(t); res(); });
    });
  }
  function doSkip() {
    S.skip = true;
    S.waiters.splice(0).forEach((f) => f());
  }

  function openPullFx() {
    const fx = $('vaultPullFx');
    if (!fx) return;
    S.skip = false;
    fx.className = 'vault-pull-fx active';
    fx.innerHTML = `
      <div class="vp-dim"></div>
      <div class="vp-sky">${motes(30, 'vp-star')}</div>
      <div class="vp-embers">${motes(18, 'vp-ember')}</div>
      <div class="vp-circle"><img src="assets/ui/summon_circle.png" alt="" draggable="false"></div>
      <div class="vp-pillar"></div>
      <div class="vp-stage" id="vpStage">
        <div class="vp-lantern t-rare" id="vpLantern">
          <div class="vp-lantern-inner">
            <span class="vp-lantern-glow"></span>
            <img class="ln ln-rare" src="assets/ui/lantern_rare.png" alt="" draggable="false">
            <img class="ln ln-epic" src="assets/ui/lantern_epic.png" alt="" draggable="false">
            <img class="ln ln-mythic" src="assets/ui/lantern_mythic.png" alt="" draggable="false">
          </div>
        </div>
      </div>
      <div class="vp-shock" id="vpShock"></div>
      <div class="vp-splash" id="vpSplash"></div>
      <div class="vp-flash" id="vpFlash"></div>
      <button class="vp-skip" data-action="skip" id="vaultSkipBtn">Skip ⏭</button>`;
  }

  function closePullFx() {
    const fx = $('vaultPullFx');
    if (fx) { fx.className = 'vault-pull-fx'; fx.innerHTML = ''; }
    S.waiters.splice(0).forEach((f) => f());
  }

  function finishPull() {
    S.pulling = false;
    closePullFx();
    render();
  }

  function flash(color = '#fff') {
    const f = $('vpFlash');
    if (!f) return;
    f.style.setProperty('--flash', color);
    f.classList.remove('go'); void f.offsetWidth; f.classList.add('go');
  }
  function retrigger(el, cls) {
    if (!el) return;
    el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
  }
  function shock(r) {
    const s = $('vpShock');
    if (!s || S.skip) return;
    s.className = `vp-shock s-${r}`;
    void s.offsetWidth;
    s.classList.add('go');
  }
  function quake() {
    const fx = $('vaultPullFx');
    if (fx && !S.skip) retrigger(fx, 'quake');
  }
  // Full-screen rarity word that slams in before the card reveal.
  async function splash(r, count) {
    const box = $('vpSplash');
    if (!box || S.skip) return;
    const ms = r === 'mythic' ? 1500 : r === 'epic' ? 1100 : 750;
    box.style.setProperty('--sd', `${ms}ms`);
    box.innerHTML = `
      <i class="vs-band b-${r}"></i>
      <div class="vs-word s-${r}">
        <small>${count > 1 ? `${count}× Lantern Wish` : 'Lantern Wish'}</small>
        <b>${r === 'rare' ? 'RARE' : `✦ ${label(r)} ✦`}</b>
        <span>${stars(r)}</span>
      </div>`;
    box.className = `vp-splash go`;
    await wait(ms);
    box.className = 'vp-splash';
    box.innerHTML = '';
  }

  async function playPull(results, opts = {}) {
    const fx = $('vaultPullFx');
    if (!fx) return;
    if (!fx.classList.contains('active')) openPullFx();
    const best = bestOf(results);
    const lan = $('vpLantern');

    // 1) A wish lantern rises out of the summon circle
    fx.classList.add('summoning');
    Sound.drop();
    lan.classList.add('rise');
    await wait(1150);
    // 2) It hovers and breathes — tease the rarity
    lan.classList.add('bob'); Sound.wobble();
    await wait(650);
    if (RANK[best.rarity] >= 2) {
      lan.classList.replace('t-rare', 't-epic'); retrigger(lan, 'surge');
      Sound.upgrade(); flash('#c084fc'); shock('epic');
      fx.classList.add('is-epic');
      await wait(850);
    }
    if (best.rarity === 'mythic') {
      lan.classList.replace('t-epic', 't-mythic'); retrigger(lan, 'surge');
      Sound.upgrade(); flash('#fde68a'); shock('mythic'); quake();
      fx.classList.add('is-mythic');
      await wait(1300);
    }
    // 3) Burst into light
    Sound.crack();
    lan.classList.add('burst');
    shock(best.rarity);
    if (best.rarity === 'mythic') quake();
    if (window.SkyPixi && window.SkyPixi.isReady) {
      const cX = window.innerWidth / 2;
      const cY = window.innerHeight / 2;
      const col = best.rarity === 'mythic' ? 0xffd700 : best.rarity === 'epic' ? 0xc084fc : 0x38bdf8;
      window.SkyPixi.spawnShockwaveRing(cX, cY, col, 220, 700);
      window.SkyPixi.spawnRadialBurst(cX, cY, 'stardust', best.rarity === 'mythic' ? 60 : 35, { additive: true });
    }
    await wait(260);
    flash(best.rarity === 'mythic' ? '#fff7d6' : '#ffffff');
    lan.style.visibility = 'hidden';
    await wait(180);

    // 4) Rarity splash, then the reveal
    await splash(best.rarity, results.length);
    const stage = $('vpStage');
    if (!stage) return;
    fx.classList.add('revealed');
    results.forEach((r) => { if (!r.dupe) S.seenNew.add(r.id); });
    if (results.length === 1) renderSingle(stage, results[0], opts);
    else await renderMulti(stage, results);
  }

  function burstHtml(r) {
    const n = r === 'mythic' ? 36 : r === 'epic' ? 22 : 12;
    let h = '';
    for (let i = 0; i < n; i++) {
      const ang = (360 / n) * i + Math.random() * 10;
      const dist = 120 + Math.random() * (r === 'mythic' ? 220 : 120);
      h += `<i style="--a:${ang}deg;--r:${dist}px;--d:${(0.7 + Math.random() * 0.7).toFixed(2)}s"></i>`;
    }
    return `<div class="vp-burst b-${r}">${h}</div>`;
  }

  function renderSingle(stage, res, opts) {
    const item = chars()[res.id];
    const c = C.BY_ID[res.id];
    const r = res.rarity;
    const perk = C.PERKS[c.perk];
    const p = me();
    if (r === 'mythic') Sound.mythic(); else if (r === 'epic') Sound.epic(); else Sound.rare();
    const skip = $('vaultSkipBtn'); if (skip) skip.remove();
    stage.innerHTML = `
      <div class="vp-reveal single rv-${r}">
        <div class="vp-rays"></div>
        ${burstHtml(r)}
        <div class="vp-bigcard rf-${r}">
          <span class="v-card-bg"></span>
          <span class="v-card-foil"></span>
          <img src="${item.sprite}" alt="${item.name}" draggable="false">
          <span class="vp-bigcard-stars">${stars(r)}</span>
        </div>
        <div class="vp-meta">
          <span class="v-rarity-badge rb-${r} stamp">${label(r)}</span>
          <h3>${item.name}</h3>
          <p class="vp-perk">${perk.icon} <b>${perk.name}</b> — ${perk.desc}</p>
          <p class="vp-status ${res.dupe ? 'dupe' : 'new'}">${opts.exchanged ? '✨ Exchanged with stardust!' : res.dupe ? `Duplicate → +${res.dust} ✨ stardust` : '🎉 NEW costume unlocked!'}</p>
        </div>
        <div class="vp-buttons">
          ${currentCharId() !== res.id ? `<button class="vp-btn primary wb-${r}" data-action="pull-wear" data-id="${res.id}">✨ Wear now</button>` : ''}
          ${!opts.exchanged && p && p.diamonds >= E.PULL_1 ? '<button class="vp-btn" data-action="pull-again" data-count="1">Pull again · 💎100</button>' : ''}
          <button class="vp-btn ghost" data-action="pull-done">Continue</button>
        </div>
      </div>`;
  }

  async function renderMulti(stage, results) {
    const slots = results.map((res, i) => {
      const item = chars()[res.id];
      return `
        <button class="vp-slot rv-${res.rarity}" data-action="pull-card" data-idx="${i}" style="--i:${i}">
          <span class="vp-flip">
            <span class="vp-face back"><img class="vp-back-crest" src="assets/ui/crest.png" alt="" draggable="false"></span>
            <span class="vp-face front rf-${res.rarity}">
              <span class="v-card-bg"></span>
              <span class="v-card-foil"></span>
              <img src="${item.sprite}" alt="${item.name}" draggable="false">
              <span class="vp-slot-stars">${stars(res.rarity)}</span>
              ${res.dupe ? `<span class="vp-slot-dust">+${res.dust}✨</span>` : '<span class="vp-slot-new">NEW</span>'}
              <span class="vp-slot-name">${item.name}</span>
            </span>
          </span>
        </button>`;
    }).join('');
    stage.innerHTML = `
      <div class="vp-reveal multi">
        <div class="vp-multi-grid">${slots}</div>
        <div class="vp-summary" id="vpSummary"></div>
      </div>`;
    await wait(350);
    const cards = Array.from(stage.querySelectorAll('.vp-slot'));
    // Reveal low → high so the best lands last.
    const order = cards.map((el, i) => ({ el, r: results[i].rarity, i })).sort((a, b) => RANK[a.r] - RANK[b.r] || a.i - b.i);
    for (const o of order) {
      if (o.el.classList.contains('flipped')) continue;
      revealOne(o.el, true);
      await wait(o.r === 'mythic' ? 900 : o.r === 'epic' ? 420 : 170);
    }
    cards.forEach((el) => revealOne(el, true));
    showMultiSummary(results);
  }

  function revealOne(el, silent) {
    if (!el || el.classList.contains('flipped')) return;
    el.classList.add('flipped');
    const r = Array.from(el.classList).find((c) => c.startsWith('rv-')).slice(3);
    if (r === 'mythic') { Sound.mythic(); flash('#fde68a'); const fx = $('vaultPullFx'); if (fx) fx.classList.add('is-mythic'); }
    else if (r === 'epic') { Sound.epic(); }
    else if (!silent || !S.skip) Sound.flip();
  }

  function showMultiSummary(results) {
    const box = $('vpSummary');
    if (!box) return;
    const skip = $('vaultSkipBtn'); if (skip) skip.remove();
    const fresh = results.filter((r) => !r.dupe).length;
    const dust = results.reduce((s, r) => s + (r.dust || 0), 0);
    const best = bestOf(results);
    const p = me();
    box.innerHTML = `
      <p class="vp-sum-line">
        <span class="t-${best.rarity}">Best: ${label(best.rarity)}</span>
        · ${fresh} new
        ${dust ? `· +${dust} ✨ stardust` : ''}
      </p>
      <div class="vp-buttons">
        ${!best.dupe && best.rarity !== 'rare' ? `<button class="vp-btn primary wb-${best.rarity}" data-action="pull-wear" data-id="${best.id}">✨ Wear ${chars()[best.id].name}</button>` : ''}
        ${p && p.diamonds >= E.PULL_10 ? '<button class="vp-btn" data-action="pull-again" data-count="10">Pull ×10 · 💎900</button>' : ''}
        <button class="vp-btn ghost" data-action="pull-done">Continue</button>
      </div>`;
    box.classList.add('show');
  }

  // ---------------------------------------------------------------------------
  // Toasts & celebrations
  // ---------------------------------------------------------------------------
  function toast(html, cls = '', ms = 3600) {
    const layer = ensureToastLayer();
    const t = document.createElement('div');
    t.className = `vault-toast ${cls}`;
    t.innerHTML = html;
    layer.appendChild(t);
    requestAnimationFrame(() => t.classList.add('in'));
    setTimeout(() => { t.classList.remove('in'); t.classList.add('out'); setTimeout(() => t.remove(), 500); }, ms);
  }

  function diamondRain(amount) {
    const layer = ensureToastLayer();
    const rain = document.createElement('div');
    rain.className = 'vault-rain';
    const n = Math.min(40, 10 + Math.round(amount / 25));
    let h = '';
    for (let i = 0; i < n; i++) {
      h += `<i style="--x:${Math.random() * 100}%;--d:${(1.4 + Math.random() * 1.4).toFixed(2)}s;--delay:${(Math.random() * 0.8).toFixed(2)}s;--s:${(0.7 + Math.random() * 0.8).toFixed(2)}">💎</i>`;
    }
    rain.innerHTML = h;
    layer.appendChild(rain);
    setTimeout(() => rain.remove(), 3600);
  }

  function partnerToast(msg) {
    if (msg.role === myRole()) return; // Don't show toast to the summoner on their own screen
    if (msg.kind === 'bot_hard_win') {
      const who = msg.username || (msg.role === 'dxb' ? 'Dragon Girl 🐉' : 'Wolf Boy 🐺');
      toast(`<div><b>😼 ${who} defeated Hard Captain Whiskers!</b><span>+${fmt(msg.payout)} 💎 banked${msg.streak > 1 ? ` · ${msg.streak}x Streak! 🔥` : ''}</span></div>`, 't-mythic', 5000);
      return;
    }
    if (msg.kind !== 'pull' || !msg.best) return;
    const c = C.BY_ID[msg.best.id];
    if (!c) return;
    const r = msg.best.rarity;
    const who = msg.username || (msg.role === 'dxb' ? 'Dragon Girl 🐉' : 'Wolf Boy 🐺');
    const hype = r === 'mythic' ? '🌟 MYTHIC DROP!' : r === 'epic' ? '💜 EPIC SUMMON!' : '💎 LUCKY DRAW';
    
    // Server-wide celebratory audio & particle FX for rare reveals
    if (r === 'mythic') {
      try { Sound.mythic(); } catch (e) {}
      try { diamondRain(60); } catch (e) {}
    } else if (r === 'epic') {
      try { Sound.epic(); } catch (e) {}
      try { diamondRain(25); } catch (e) {}
    }

    toast(`
      <img class="vt-art" src="${thumbOf(c.sprite)}" alt="">
      <div><b>${hype}</b><span><b>${who}</b> pulled ×${msg.count || 1} · Best: <em class="t-${r}">${label(r)}</em> · ${c.name}</span></div>`,
      `t-${r} with-art`, r === 'mythic' ? 7000 : (r === 'epic' ? 5200 : 4200));
  }

  function onAward(award) {
    const mine = award.payouts && award.payouts[myRole()];
    if (!mine) return;
    S.lastAward = award;
    try { window.dispatchEvent(new CustomEvent('vault:award', { detail: award })); } catch (e) {}
    Sound.coin();
    diamondRain(mine.total);
    const parts = [`${mine.won ? '🏆 1st' : `Rank #${mine.rank || 2}`} +${mine.base}💎`];
    if (mine.syndicate) parts.push(`🤝 Syndicate +${mine.syndicate}💎`);
    if (mine.bounty) parts.push(`💥 Bounty +${mine.bounty}💎`);
    if (mine.vibe) parts.push(`💞 Chemistry +${mine.vibe}💎`);
    if (mine.daily) parts.push(`☀️ Daily +${mine.daily}💎`);
    if (mine.tickets) parts.push(`🎟️ +${mine.tickets} Ticket${mine.tickets > 1 ? 's' : ''}`);
    if (mine.fish) parts.push(`🐟 +${mine.fish} Salmon`);
    if (mine.stardust) parts.push(`✨ +${mine.stardust} Stardust`);
    toast(`<div><b>+${fmt(mine.total)} 💎 earned!</b><span>${parts.join(' · ')}</span></div>`, 't-award', 6200);
  }

  // ---------------------------------------------------------------------------
  // Server → client
  // ---------------------------------------------------------------------------
  function syncEquipped() {
    const p = me();
    if (!p || !window.equipAvatarCharacter) return;
    const local = currentCharId();
    if (S.pendingEquip) {
      if (p.equipped === S.pendingEquip) S.pendingEquip = null;
      return; // wait for our own equip to land before trusting the server copy
    }
    if (!p.equipped) {
      if (local) { p.equipped = local; send({ type: 'vault_equip', costumeId: local }); }
      return;
    }
    if (p.equipped !== local && chars()[p.equipped]) {
      if (C.BY_ID[p.equipped] && !owns(myRole(), p.equipped)) return;
      window.equipAvatarCharacter(p.equipped, true);
    }
  }

  // ---------------------------------------------------------------------------
  // Chinese Red Envelope (Ang Pao / 紅包) Gift System
  // ---------------------------------------------------------------------------
  function envelopeRain(amount) {
    const layer = ensureToastLayer();
    const rain = document.createElement('div');
    rain.className = 'vault-rain envelope-rain';
    const n = Math.min(50, 16 + Math.round(amount / 20));
    const icons = ['🧧', '💎', '✨', '🪙', '🌸'];
    let h = '';
    for (let i = 0; i < n; i++) {
      const ic = icons[i % icons.length];
      h += `<i style="--x:${Math.random() * 100}%;--d:${(1.6 + Math.random() * 1.6).toFixed(2)}s;--delay:${(Math.random() * 0.9).toFixed(2)}s;--s:${(0.8 + Math.random() * 0.9).toFixed(2)}">${ic}</i>`;
    }
    rain.innerHTML = h;
    layer.appendChild(rain);
    setTimeout(() => rain.remove(), 4200);
  }

  function openEnvelopeSender(initialAmt) {
    const isPair = isCoupleActive();
    const p = me();
    const unclaimed = p && Array.isArray(p.envelopes) ? p.envelopes.filter((e) => !e.claimed) : [];
    if (!isPair && unclaimed.length === 0) {
      if (window.SkySocialUI && typeof window.SkySocialUI.showCoupleGatingModal === 'function') {
        window.SkySocialUI.showCoupleGatingModal('Red Envelope Gifting');
        return;
      }
    }
    build();
    S.envelopeModalOpen = true;
    if (initialAmt) S.envelopeAmount = Number(initialAmt) || 50;
    renderEnvelopeModal();
    const modal = $('vaultEnvelopeModal');
    if (modal) modal.classList.add('open');
  }

  function closeEnvelopeModal() {
    S.envelopeModalOpen = false;
    const modal = $('vaultEnvelopeModal');
    if (modal) modal.classList.remove('open');
  }

  function renderEnvelopeModal() {
    const modal = $('vaultEnvelopeModal');
    if (!modal) return;
    const p = me();
    const diamonds = p ? p.diamonds : 0;
    const partner = partnerRole().toUpperCase();
    const envelopesReceived = (p && p.envelopes) || [];
    const envelopesSent = (p && p.envelopesSent) || [];
    const allHistory = [
      ...envelopesReceived.map((e) => ({ ...e, dir: 'in' })),
      ...envelopesSent.map((e) => ({ ...e, dir: 'out' }))
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const isSend = S.envelopeTab === 'send';
    const presets = [
      { amt: 50, label: '🍬 Sweet', desc: 'A little treat' },
      { amt: 100, label: '🎰 1× Pull', desc: 'A lucky wish' },
      { amt: 520, label: '❤️ 520', desc: '我愛你 · Love You' },
      { amt: 888, label: '🌟 888', desc: '發發發 · Prosperity' },
      { amt: 900, label: '🌸 10× Pull', desc: 'Full 10-Pull' }
    ];
    const curAmt = Math.max(1, Math.min(diamonds > 0 ? diamonds : 9999, Number(S.envelopeAmount) || 50));
    const canSend = diamonds >= curAmt && curAmt >= 1;

    const blessings = [
      { key: 'mythic', icon: '🌸', text: 'Good luck pulling Mythic in Season 2!' },
      { key: 'love', icon: '❤️', text: 'For you with all my love and hugs! ❤️' },
      { key: 'fortune', icon: '🧧', text: '大吉大利 · Gong Xi Fa Cai & great luck!' },
      { key: 'wish', icon: '✨', text: 'May your next 10-pull shine bright gold!' }
    ];
    const curMsg = S.envelopeMessage !== undefined ? S.envelopeMessage : blessings[0].text;

    let bodyHtml = '';
    if (isSend) {
      if (!isCoupleActive()) {
        bodyHtml = `
          <div class="ve-send-pane" style="text-align:center;padding:36px 20px;">
            <div style="font-size:48px;margin-bottom:12px;">🧧🔒</div>
            <h3 style="font-family:'Outfit',sans-serif;font-size:1.2rem;font-weight:800;color:#fff;margin:0 0 8px;">Couple Gifting Locked</h3>
            <p style="font-size:0.86rem;line-height:1.5;color:rgba(255,255,255,0.75);max-width:320px;margin:0 auto 20px;">
              Red Envelopes (Ang Pao) let partners send lucky diamonds and blessings to each other. Link your co-pilot in Couple Sanctuary to unlock gifting!
            </p>
            <button type="button" class="dly-open-sanctuary-btn" data-action="open-sanctuary" id="veOpenSanctuaryBtn">
              <span>Link Partner in Couple Sanctuary 💞</span>
            </button>
          </div>`;
      } else {
        bodyHtml = `
        <div class="ve-send-pane">
          <div class="ve-target-card">
            <div class="ve-target-avatar">
              <span class="ve-target-flag">${partner === 'DXB' ? '🇦🇪 DXB' : '🇹🇭 BKK'}</span>
            </div>
            <div class="ve-target-info">
              <h4>Gift Red Envelope to <b>${partner}</b></h4>
              <p>Traditional Chinese Ang Pao with sparkling diamonds & warm blessings</p>
            </div>
            <div class="ve-my-balance">
              <small>Your Balance</small>
              <b>💎 ${fmt(diamonds)}</b>
            </div>
          </div>

          <div class="ve-section">
            <label class="ve-label">Choose Gift Amount 💎</label>
            <div class="ve-presets-grid">
              ${presets.map((pr) => `
                <button type="button" class="ve-preset-btn ${curAmt === pr.amt ? 'selected' : ''}" data-action="set-envelope-amt" data-amount="${pr.amt}">
                  <span class="ve-p-amt">💎 ${pr.amt}</span>
                  <span class="ve-p-tag">${pr.label}</span>
                </button>
              `).join('')}
              <button type="button" class="ve-preset-btn ${curAmt === diamonds && diamonds > 0 ? 'selected' : ''}" data-action="set-envelope-amt" data-amount="${diamonds}" ${diamonds < 1 ? 'disabled' : ''}>
                <span class="ve-p-amt">💎 MAX</span>
                <span class="ve-p-tag">All In (${diamonds})</span>
              </button>
            </div>

            <div class="ve-custom-row">
              <span class="ve-custom-prefix">💎</span>
              <input type="number" id="veCustomAmountInput" class="ve-input" min="1" max="${diamonds}" value="${curAmt}" placeholder="Custom amount...">
            </div>
          </div>

          <div class="ve-section">
            <label class="ve-label">Lucky Blessing & Message 🧧</label>
            <div class="ve-blessings-chips">
              ${blessings.map((b) => `
                <button type="button" class="ve-chip ${curMsg === b.text ? 'selected' : ''}" data-action="set-envelope-blessing" data-blessing="${b.key}" data-text="${b.text}">
                  ${b.icon} ${b.text.slice(0, 24)}...
                </button>
              `).join('')}
            </div>
            <input type="text" id="veCustomMsgInput" class="ve-input" maxlength="90" value="${curMsg.replace(/"/g, '&quot;')}" placeholder="Write a sweet message...">
          </div>

          <div class="ve-preview-envelope">
            <div class="ve-prev-art" style="background-image: url('assets/ui/red_envelope.jpg')">
              <div class="ve-prev-knot">福</div>
              <div class="ve-prev-badge">💎 ${fmt(curAmt)}</div>
            </div>
            <div class="ve-prev-text">
              <small>Preview for ${partner}</small>
              <p>“${curMsg || '大吉大利 · Good fortune!'}”</p>
            </div>
          </div>

          <div class="ve-submit-row">
            <button type="button" class="ve-send-btn ${canSend ? '' : 'disabled'}" data-action="send-envelope" ${canSend ? '' : 'disabled'}>
              <span class="ve-send-glow"></span>
              🧧 Seal & Send Red Envelope · 💎 ${fmt(curAmt)}
            </button>
            ${!canSend ? `<small class="ve-error-tip">⚠️ Not enough diamonds in your vault (balance: ${diamonds}💎)</small>` : ''}
          </div>
        </div>`;
      }
    } else {
      // History Pane
      bodyHtml = `
        <div class="ve-history-pane">
          ${allHistory.length === 0 ? `
            <div class="ve-history-empty">
              <span class="ve-empty-icon">🧧</span>
              <h4>No Red Envelopes Yet</h4>
              <p>Send a red envelope to surprise ${partner} with diamonds and lucky blessings!</p>
              <button class="ve-tab-switch-btn" data-action="envelope-tab" data-tab="send">Send First Red Envelope ✨</button>
            </div>
          ` : `
            <div class="ve-history-list">
              ${allHistory.map((h) => {
                const isReceived = h.dir === 'in';
                const date = new Date(h.timestamp);
                const timeStr = isNaN(date.getTime()) ? '' : `${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ${date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
                return `
                  <div class="ve-history-item ${isReceived ? 'received' : 'sent'}">
                    <div class="ve-h-icon">${isReceived ? '🧧' : '📤'}</div>
                    <div class="ve-h-content">
                      <div class="ve-h-head">
                        <b>${isReceived ? `From ${h.from.toUpperCase()}` : `Sent to ${h.to.toUpperCase()}`}</b>
                        <span class="ve-h-amt ${isReceived ? 'gain' : 'cost'}">${isReceived ? '+' : '-'}💎 ${fmt(h.amount)}</span>
                      </div>
                      ${h.message ? `<p class="ve-h-msg">“${h.message}”</p>` : ''}
                      <small class="ve-h-time">${timeStr}</small>
                    </div>
                  </div>`;
              }).join('')}
            </div>
          `}
        </div>`;
    }

    modal.innerHTML = `
      <div class="ve-dialog" role="dialog" aria-modal="true" aria-labelledby="veDialogTitle">
        <header class="ve-dialog-header">
          <div class="ve-header-tabs">
            <button class="ve-header-tab ${isSend ? 'active' : ''}" data-action="envelope-tab" data-tab="send">
              🧧 Send Red Envelope
            </button>
            <button class="ve-header-tab ${!isSend ? 'active' : ''}" data-action="envelope-tab" data-tab="history">
              📜 Keepsakes (${allHistory.length})
            </button>
          </div>
          <button class="ve-close-x" data-action="close-envelope-modal" aria-label="Close">✕</button>
        </header>
        <div class="ve-dialog-body">${bodyHtml}</div>
      </div>`;

    const amtInput = $('veCustomAmountInput');
    if (amtInput) {
      amtInput.addEventListener('input', (e) => {
        const v = Math.max(1, Math.min(diamonds > 0 ? diamonds : 9999, Number(e.target.value) || 1));
        S.envelopeAmount = v;
        const btn = modal.querySelector('.ve-send-btn');
        if (btn) btn.innerHTML = `<span class="ve-send-glow"></span>🧧 Seal & Send Red Envelope · 💎 ${fmt(v)}`;
        const prevB = modal.querySelector('.ve-prev-badge');
        if (prevB) prevB.textContent = `💎 ${fmt(v)}`;
      });
    }
    const msgInput = $('veCustomMsgInput');
    if (msgInput) {
      msgInput.addEventListener('input', (e) => {
        S.envelopeMessage = e.target.value;
        const prevT = modal.querySelector('.ve-prev-text p');
        if (prevT) prevT.textContent = `“${e.target.value || '大吉大利 · Good fortune!'}”`;
      });
    }
  }

  function submitEnvelope() {
    if (!isCoupleActive()) {
      if (window.SkySocialUI && typeof window.SkySocialUI.showCoupleGatingModal === 'function') {
        window.SkySocialUI.showCoupleGatingModal('Red Envelope Gifting');
      } else {
        toast('🔒 Gifting is exclusive to linked couples in Couple Sanctuary');
      }
      return;
    }
    const p = me();
    if (!p) return;
    const amt = Math.floor(Number(S.envelopeAmount) || 0);
    if (amt < 1) { toast('⚠️ Please select at least 1 diamond'); return; }
    if (p.diamonds < amt) { toast(`⚠️ Not enough diamonds (you have ${p.diamonds}💎)`); return; }
    const msg = (S.envelopeMessage || '').trim() || '大吉大利 · Good fortune and joy!';
    const blessing = S.envelopeBlessing || 'luck';
    send({
      type: 'vault_send_envelope',
      amount: amt,
      message: msg,
      blessing: blessing,
      reqId: `env_${Date.now()}`
    });
    Sound.envelopeSend();
  }

  function ensureEnvelopeReveal() {
    let r = $('vaultEnvelopeReveal');
    if (!r) {
      r = document.createElement('div');
      r.id = 'vaultEnvelopeReveal';
      r.className = 'vault-envelope-reveal';
      document.body.appendChild(r);
      r.addEventListener('click', onRevealClick);
    }
    return r;
  }

  function showEnvelopeReveal(env) {
    if (!env) return;
    S.showingEnvelope = env;
    const r = ensureEnvelopeReveal();
    Sound.envelopeSend();
    r.classList.remove('revealed', 'unsealed');
    r.innerHTML = `
      <div class="ver-backdrop" data-action="close-reveal"></div>
      <div class="ver-stage">
        <div class="ver-motes">${stableMotes(18, 'ver-gold-mote')}</div>
        <div class="ver-envelope-wrap" id="verEnvelopeWrap">
          <div class="ver-envelope" style="background-image: linear-gradient(180deg, rgba(168, 18, 31, 0.55), rgba(110, 10, 20, 0.88)), url('assets/ui/red_envelope.jpg')">
            <div class="ver-flap" id="verFlap">
              <div class="ver-flap-inner"></div>
            </div>
            <div class="ver-gold-trim"></div>
            
            <div class="ver-seal" id="verSeal" data-action="open-envelope-seal" title="Tap to open Red Envelope!">
              <div class="ver-seal-ring"></div>
              <span class="ver-seal-glyph">開</span>
              <span class="ver-seal-hint">TAP TO OPEN</span>
            </div>

            <div class="ver-banner-info">
              <span class="ver-tag">🧧 SPECIAL RED ENVELOPE</span>
              <h3>From ${env.from.toUpperCase()}</h3>
              <p>Touch the golden seal to unlock your gift</p>
            </div>

            <div class="ver-gift-card" id="verGiftCard">
              <div class="ver-card-top-trim"></div>
              <span class="ver-card-auspicious">大吉大利 · 恭喜發財</span>
              <div class="ver-amount-badge">
                <span class="ver-gem">💎</span>
                <span class="ver-amt-num">+${fmt(env.amount)}</span>
                <small class="ver-amt-label">DIAMONDS</small>
              </div>
              ${env.message ? `<div class="ver-msg-quote">“${env.message}”</div>` : ''}
              <div class="ver-from-note">With endless love from <b>${env.from.toUpperCase()}</b> ❤️</div>
              <button class="ver-claim-btn" data-action="claim-envelope" data-id="${env.id}">
                ✨ Claim & Thank ${env.from.toUpperCase()}
              </button>
            </div>
          </div>
        </div>
      </div>`;
    r.classList.add('active');
  }

  function triggerEnvelopeOpen() {
    const env = S.showingEnvelope;
    if (!env) return;
    const r = $('vaultEnvelopeReveal');
    if (!r) return;
    const seal = $('verSeal');
    if (seal) seal.classList.add('breaking');
    Sound.envelopeOpen();
    setTimeout(() => {
      r.classList.add('unsealed');
      const flap = $('verFlap');
      if (flap) flap.classList.add('open');
      envelopeRain(env.amount);
      flash('#fde68a');
    }, 400);
  }

  function claimCurrentEnvelope(envId) {
    const env = S.showingEnvelope;
    const id = envId || (env && env.id);
    if (id) {
      send({ type: 'vault_claim_envelope', envelopeId: id });
    }
    const r = $('vaultEnvelopeReveal');
    if (r) {
      r.classList.remove('active');
      setTimeout(() => { r.innerHTML = ''; }, 400);
    }
    S.showingEnvelope = null;
    Sound.coin();
    toast(`💎 Claimed +${env ? fmt(env.amount) : ''} diamonds from ${env ? env.from.toUpperCase() : 'partner'}!`);
    updatePills();
  }

  function onRevealClick(e) {
    const t = e.target.closest('[data-action]');
    if (!t) return;
    e.stopPropagation();
    const a = t.dataset.action;
    switch (a) {
      case 'open-envelope-seal': triggerEnvelopeOpen(); break;
      case 'claim-envelope': claimCurrentEnvelope(t.dataset.id); break;
      case 'close-reveal':
        if ($('vaultEnvelopeReveal') && $('vaultEnvelopeReveal').classList.contains('unsealed')) {
          claimCurrentEnvelope();
        } else {
          const r = $('vaultEnvelopeReveal');
          if (r) r.classList.remove('active');
          S.showingEnvelope = null;
        }
        break;
    }
  }

  function checkPendingEnvelopes() {
    const p = me();
    if (!p || !Array.isArray(p.envelopes)) return;
    const unclaimed = p.envelopes.find((e) => !e.claimed);
    if (unclaimed && !S.showingEnvelope) {
      setTimeout(() => {
        if (!S.showingEnvelope) showEnvelopeReveal(unclaimed);
      }, 700);
    }
  }

  function setProfiles(profiles) {
    if (!profiles || !profiles.bkk || !profiles.dxb) return;
    S.profiles = profiles;

    // 🔥 CRITICAL: Cloud Hydration Guard
    // Merge cloud Supabase inventory into local S.profiles[myRole()].owned so server restarts NEVER wipe player wardrobe!
    try {
      const role = myRole();
      if (S.profiles[role]) {
        if (!S.profiles[role].owned) S.profiles[role].owned = {};
        const cloudInv = (window.SkySupabase && window.SkySupabase.currentUser && Array.isArray(window.SkySupabase.currentUser.inventory))
          ? window.SkySupabase.currentUser.inventory
          : [];
        cloudInv.forEach((costumeId) => {
          if (!S.profiles[role].owned[costumeId] || S.profiles[role].owned[costumeId] < 1) {
            S.profiles[role].owned[costumeId] = 1;
          }
        });
      }
    } catch (e) {
      console.warn('[Vault] Cloud hydration error:', e);
    }

    updatePills();
    syncEquipped();
    if (S.open && !S.pulling) render();
    if (S.envelopeModalOpen) renderEnvelopeModal();
    checkPendingEnvelopes();
    try { window.dispatchEvent(new CustomEvent('vault:profiles', { detail: profiles })); } catch (e) {}

    // Synchronize to Monopoly v2 and v1
    if (typeof window.syncMonopolyCostumes === 'function') {
      window.syncMonopolyCostumes();
    } else if (window.NookMonoV2 && typeof window.NookMonoV2.syncLoadout === 'function') {
      window.NookMonoV2.syncLoadout();
    }
    if (typeof updateLobbySeats === 'function') {
      updateLobbySeats();
    }

    // Synchronize diamonds, inventory, and isolated per-banner pity to Supabase user profile
    try {
      const p = me();
      if (p && window.SkySupabase && typeof window.SkySupabase.updateProfile === 'function') {
        const updates = {};
        if (typeof p.diamonds === 'number') updates.diamonds = p.diamonds;
        if (typeof p.stardust === 'number') updates.stardust = p.stardust;
        if (p.pityByBanner) updates.pity = p.pityByBanner;
        
        // 🔥 CRITICAL FIX: NEVER blind-overwrite inventory with an empty or diminished set!
        // Always UNION existing Supabase inventory with newly owned costumes:
        const currentCloud = (window.SkySupabase.currentUser && Array.isArray(window.SkySupabase.currentUser.inventory))
          ? window.SkySupabase.currentUser.inventory
          : [];
        const localOwned = p.owned ? Object.keys(p.owned) : [];
        const mergedInventory = Array.from(new Set([...currentCloud, ...localOwned]));
        if (mergedInventory.length > 0) {
          updates.inventory = mergedInventory;
        }
        window.SkySupabase.updateProfile(updates);
      }
    } catch (_) {}
  }

  function handleMessage(msg) {
    switch (msg.type) {
      case 'vault_profiles':
        setProfiles(msg.profiles);
        if (msg.award) onAward(msg.award);
        break;
      case 'vault_pull_result': {
        if (msg.profiles) { setProfiles(msg.profiles); }
        if (msg.results && Array.isArray(msg.results)) {
          const pulledIds = msg.results.map(r => r.id).filter(Boolean);
          if (pulledIds.length > 0 && window.SkySupabase && typeof window.SkySupabase.updateProfile === 'function') {
            const currentCloud = (window.SkySupabase.currentUser && Array.isArray(window.SkySupabase.currentUser.inventory))
              ? window.SkySupabase.currentUser.inventory
              : [];
            const mergedInventory = Array.from(new Set([...currentCloud, ...pulledIds]));
            window.SkySupabase.updateProfile({ inventory: mergedInventory });
          }
        }
        if (S.pending && msg.reqId === S.pending.reqId) {
          S.pending = null;
          clearTimeout(S.pendingTimer);
          // Start fetching the prizes now; the lantern animation buys a few seconds.
          (msg.results || []).forEach((r) => { const it = chars()[r.id]; if (it) heroSrc(it.sprite); });
          playPull(msg.results || [], { exchanged: !!msg.exchanged });
        }
        break;
      }
      case 'vault_event':
        setProfiles(msg.profiles);
        partnerToast(msg);
        break;
      case 'vault_envelope_sent':
        setProfiles(msg.profiles);
        Sound.envelopeSend();
        toast(`🧧 Red envelope with 💎 ${fmt(msg.envelope.amount)} sent to ${partnerRole().toUpperCase()}!`);
        closeEnvelopeModal();
        break;
      case 'vault_envelope_received':
        setProfiles(msg.profiles);
        if (msg.envelope) showEnvelopeReveal(msg.envelope);
        break;
      case 'vault_bot_started':
        if (msg.profiles) setProfiles(msg.profiles);
        break;
      case 'vault_bot_result':
        if (msg.profiles) setProfiles(msg.profiles);
        try { window.dispatchEvent(new CustomEvent('vault:bot_result', { detail: msg })); } catch (e) {}
        if (msg.payout > 0) {
          Sound.coin();
          diamondRain(msg.payout);
          toast(`<div><b>+${fmt(msg.payout)} 💎 banked!</b><span>${msg.breakdown || 'Captain Whiskers match'}</span></div>`, 't-award', 5200);
        }
        break;
      // 🔥 Daily Flight Log: lightweight progress pushes + reward celebrations
      case 'vault_daily':
        if (msg.profiles && msg.profiles.bkk && msg.profiles.dxb) setProfiles(msg.profiles);
        else if (S.profiles && msg.role && S.profiles[msg.role]) {
          S.profiles[msg.role].daily = msg.daily;
          try { window.dispatchEvent(new CustomEvent('vault:profiles', { detail: S.profiles })); } catch (e) {}
        }
        break;
      case 'vault_reward':
        if (window.NookDaily) window.NookDaily.handleReward(msg);
        break;
      case 'vault_error':
        if (msg.scope === 'cats') { if (window.NookCats) window.NookCats.handleMessage(msg); break; }
        if (S.pending && (!msg.reqId || msg.reqId === S.pending.reqId)) {
          S.pending = null;
          clearTimeout(S.pendingTimer);
          S.pulling = false;
          closePullFx();
        }
        toast(`⚠️ ${msg.error || 'Vault error'}`);
        render();
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // Public helpers for mini-games
  // ---------------------------------------------------------------------------
  function equippedOf(role) {
    const isMe = role === myRole();
    if (isMe) {
      const a = window.getMyAvatar && window.getMyAvatar();
      if (a && a.characterId) return a.characterId;
    } else {
      const pa = window.getPartnerAvatar && window.getPartnerAvatar();
      if (pa && pa.characterId) return pa.characterId;
    }
    const p = S.profiles && S.profiles[role];
    return (p && p.equipped) || null;
  }

  /** { bkk: effects, dxb: effects } for Monopoly, from what each person is wearing. */
  function monopolyPerks() {
    const b = equippedOf('bkk');
    const d = equippedOf('dxb');
    const safe = (id, role) => (C.BY_ID[id] && C.BY_ID[id].role === role && owns(role, id) ? id : null);
    const bid = safe(b, 'bkk');
    const did = safe(d, 'dxb');
    return {
      bkk: { costume: bid, ...C.monopolyEffects(bid, did) },
      dxb: { costume: did, ...C.monopolyEffects(did, bid) }
    };
  }

  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartTime = 0;
  let isSwipingBanner = false;

  function onBannerTouchStart(e) {
    if (S.tab !== 'gacha' || !S.open) return;
    const banner = e.target.closest('.vg-banner');
    if (!banner || e.target.closest('button, [data-action]')) return;
    const t = e.touches ? e.touches[0] : e;
    touchStartX = t.clientX;
    touchStartY = t.clientY;
    touchStartTime = Date.now();
    isSwipingBanner = true;
  }

  function onBannerTouchEnd(e) {
    if (!isSwipingBanner || S.tab !== 'gacha' || !S.open) return;
    isSwipingBanner = false;
    const t = e.changedTouches ? e.changedTouches[0] : e;
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;
    const dt = Date.now() - touchStartTime;

    // Horizontal swipe threshold: > 45px and predominantly horizontal
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3 && dt < 650) {
      if (dx < 0) {
        stepGachaSeason(1);
      } else {
        stepGachaSeason(-1);
      }
    }
  }

  function init() {
    build();
    mountPills();
    ensureToastLayer();
    updatePills();
    const sheet = $('vaultSheet');
    if (sheet) {
      sheet.addEventListener('touchstart', onBannerTouchStart, { passive: true });
      sheet.addEventListener('touchend', onBannerTouchEnd, { passive: true });
    }
    const deckBtn = $('openWardrobeBtn');
    if (deckBtn) {
      deckBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        open('wardrobe');
      });
    }
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || !S.open) return;
      if ($('vaultInspect') && $('vaultInspect').classList.contains('open')) closeInspect();
      else if (S.pulling) doSkip();
      else close();
    });
    window.addEventListener('sky:character_base_changed', () => {
      updateVaultBaseSwitcher();
      if (S.open) render();
    });
    window.addEventListener('sky:auth_state_changed', (e) => {
      const u = e.detail?.user;
      if (u && Array.isArray(u.inventory)) {
        const r = myRole();
        if (S.profiles && S.profiles[r]) {
          if (!S.profiles[r].owned) S.profiles[r].owned = {};
          u.inventory.forEach((id) => {
            if (!S.profiles[r].owned[id]) S.profiles[r].owned[id] = 1;
          });
        }
        send({
          type: 'vault_sync_cloud',
          terminal: r,
          inventory: u.inventory,
          diamonds: u.diamonds,
          stardust: u.stardust
        });
        updatePills();
        if (S.open) render();
      }
    });
    window.addEventListener('sky:couple_status_changed', () => {
      updatePills();
      if (S.envelopeModalOpen) renderEnvelopeModal();
      if (S.open) render();
    });
  }

  window.NookVault = {
    open, close, handleMessage, monopolyPerks, equippedOf, getMythicUltimate,
    getProfiles: () => S.profiles,
    getMyProfile: me,
    lastAward: () => S.lastAward,
    toast,
    diamondRain,
    sound: Sound,
    send
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
