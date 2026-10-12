/**
 * Nook Airline — Sky Monopoly FX engine (window.MonoFX)
 *
 * Cosmetic only: never touches game state or sync. monopoly.js decides WHAT
 * happens; this file decides how it LOOKS. Every visual has an emoji fallback,
 * so it works before the generated assets in assets/fx/ exist. An asset is used
 * only when assets/fx/manifest.json marks it "status": "ok".
 *
 * Layers:
 *   #monopolyTokenLayer  — inside the board wrap; holds the 2 persistent tokens
 *   #monopolyMomentLayer — covers the game container; coins, particles, banners
 */
(function () {
  'use strict';

  // =========================================================
  // 1. ASSET REGISTRY & FALLBACKS
  // =========================================================
  const FALLBACK = {
    coin: '🪙', flag_bkk: '🚩', flag_dxb: '🚩', house: '🏠', hotel: '🏨',
    explosion: '💥', smoke: '💨', c4: '💣', debris: '🧱', heart: '💖',
    sparkle: '✨', sword: '🗡️', shield: '🛡️', crown: '👑', gem: '💎',
    portal: '🌀', crate: '🪂', card_back: '✈️', lever: '🕹️',
    slot_cherry: '🍒', slot_lemon: '🍋', slot_star: '⭐', slot_bell: '🔔',
    slot_bag: '🎒', slot_skull: '💀',
    roulette: '🎰', loaded_die: '🎲', pearl: '🦪', starfall: '☄️', vortex: '🌌', constellation: '✨',
    supernova_core: '☄️', vortex_nebula: '🌌', constellation_sigil: '✨', monaco_chip_stack: '🎰',
    monaco_roulette_wheel: '🎰', abyssal_tidal_crest: '🌊', water: '🌊', droplet: '💧', fire: '🔥',
    naga_emerald_urn: '🐉', inari_foxfire_sigil: '🦊', eclipse_yin_yang: '🌓', djinn_magic_lamp: '🪔', phoenix_pyre_crest: '🔥',
    glacial_frost_crest: '❄️', cryo_shatter_crystal: '💎', starlight_ice_scepter: '🪄', snowdrift_blizzard_vortex: '🌀'
  };
  const SLOT_ASSET = { '🍒': 'slot_cherry', '🍋': 'slot_lemon', '⭐': 'slot_star', '🔔': 'slot_bell', '💎': 'gem', '🎒': 'slot_bag', '💀': 'slot_skull' };
  const SLOT_POOL = ['🍒', '🍋', '⭐', '🔔', '💎', '🎒', '💀'];

  const CUSTOM_SVGS = {
    monaco_chip_stack: `<svg viewBox="0 0 100 100" class="fx-svg-chip-stack"><defs><radialGradient id="chip-gold" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#fffbeb"/><stop offset="50%" stop-color="#ffd700"/><stop offset="100%" stop-color="#b45309"/></radialGradient><linearGradient id="chip-emerald" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#34d399"/><stop offset="100%" stop-color="#065f46"/></linearGradient></defs><ellipse cx="50" cy="78" rx="38" ry="14" fill="#78350f"/><ellipse cx="50" cy="74" rx="38" ry="14" fill="url(#chip-gold)" stroke="#fff" stroke-width="2"/><ellipse cx="50" cy="58" rx="38" ry="14" fill="#064e3b"/><ellipse cx="50" cy="54" rx="38" ry="14" fill="url(#chip-emerald)" stroke="#34d399" stroke-width="2"/><ellipse cx="50" cy="38" rx="38" ry="14" fill="#78350f"/><ellipse cx="50" cy="34" rx="38" ry="14" fill="url(#chip-gold)" stroke="#fffbeb" stroke-width="2"/><ellipse cx="50" cy="34" rx="22" ry="8" fill="none" stroke="#ffffff" stroke-dasharray="4 3"/><text x="50" y="38" font-size="11" font-weight="bold" fill="#fff" text-anchor="middle" font-family="sans-serif">VIP</text><circle cx="50" cy="18" r="10" fill="#ffffff" filter="drop-shadow(0 0 8px #ffd700)"/><text x="50" y="22" font-size="12" text-anchor="middle">💎</text></svg>`,
    supernova_core: `<svg viewBox="0 0 100 100" class="fx-svg-supernova"><defs><radialGradient id="sn-grad" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#ffffff"/><stop offset="35%" stop-color="#fde047"/><stop offset="70%" stop-color="#f97316"/><stop offset="100%" stop-color="transparent"/></radialGradient></defs><circle cx="50" cy="50" r="48" fill="url(#sn-grad)"/><path d="M50 0 L55 45 L100 50 L55 55 L50 100 L45 55 L0 50 L45 45 Z" fill="#ffffff" opacity="0.98"/><path d="M50 12 L54 46 L88 50 L54 54 L50 88 L46 54 L12 50 L46 46 Z" fill="#ffd700" opacity="0.88" transform="rotate(45 50 50)"/><circle cx="50" cy="50" r="14" fill="#ffffff" filter="drop-shadow(0 0 8px #fde047)"/></svg>`,
    vortex_nebula: `<svg viewBox="0 0 100 100" class="fx-svg-vortex"><defs><linearGradient id="vx-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#c084fc"/><stop offset="50%" stop-color="#38bdf8"/><stop offset="100%" stop-color="#a855f7"/></linearGradient></defs><circle cx="50" cy="50" r="46" fill="none" stroke="url(#vx-grad)" stroke-width="4.5" stroke-dasharray="14 7" opacity="0.88"/><circle cx="50" cy="50" r="32" fill="none" stroke="#e879f9" stroke-width="5" stroke-dasharray="10 5" opacity="0.92"/><circle cx="50" cy="50" r="18" fill="none" stroke="#38bdf8" stroke-width="4" stroke-dasharray="6 3"/><circle cx="50" cy="50" r="10" fill="#0f172a"/><circle cx="50" cy="50" r="5" fill="#fde047"/></svg>`,
    constellation_sigil: `<svg viewBox="0 0 120 120" class="fx-svg-constellation"><defs><radialGradient id="cs-grad" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#ffd700" stop-opacity="0.38"/><stop offset="100%" stop-color="#a855f7" stop-opacity="0"/></radialGradient></defs><circle cx="60" cy="60" r="54" fill="url(#cs-grad)" stroke="#ffd700" stroke-width="2.5" stroke-dasharray="6 3"/><circle cx="60" cy="60" r="42" fill="none" stroke="#c084fc" stroke-width="1.5"/><polygon points="60,8 74,46 112,60 74,74 60,112 46,74 8,60 46,46" fill="none" stroke="#ffd700" stroke-width="2.5"/><polygon points="60,18 70,50 102,60 70,70 60,102 50,70 18,60 50,50" fill="none" stroke="#38bdf8" stroke-width="2" transform="rotate(45 60 60)"/><circle cx="60" cy="60" r="8" fill="#ffffff" filter="drop-shadow(0 0 6px #ffd700)"/></svg>`,
    monaco_roulette_wheel: `<svg viewBox="0 0 100 100" class="fx-svg-roulette"><defs><radialGradient id="rl-gold" cx="50%" cy="50%" r="50%"><stop offset="60%" stop-color="#ffd700"/><stop offset="100%" stop-color="#b45309"/></radialGradient></defs><circle cx="50" cy="50" r="48" fill="url(#rl-gold)" stroke="#fffbeb" stroke-width="2"/><circle cx="50" cy="50" r="40" fill="#0f172a" stroke="#ffd700" stroke-width="1.5"/><circle cx="50" cy="50" r="38" fill="none" stroke="#dc2626" stroke-width="6" stroke-dasharray="6.28 6.28"/><circle cx="50" cy="50" r="26" fill="#1e293b" stroke="#ffd700" stroke-width="1"/><polygon points="50,28 53,46 50,50 47,46" fill="#ffd700"/><polygon points="50,72 53,54 50,50 47,54" fill="#ffd700"/><polygon points="28,50 46,47 50,50 46,53" fill="#ffd700"/><polygon points="72,50 54,47 50,50 54,53" fill="#ffd700"/><circle cx="50" cy="50" r="7" fill="#ffffff" filter="drop-shadow(0 0 5px #ffd700)"/><circle cx="68" cy="38" r="4.5" fill="#ffffff" filter="drop-shadow(0 0 4px #fff)"/></svg>`,
    abyssal_tidal_crest: `<svg viewBox="0 0 120 120" class="fx-svg-tidal-crest"><defs><linearGradient id="wave-curl" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stop-color="#0284c7"/><stop offset="35%" stop-color="#06b6d4"/><stop offset="70%" stop-color="#38bdf8"/><stop offset="100%" stop-color="#ffffff"/></linearGradient><radialGradient id="wave-aurora" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#67e8f9" stop-opacity="0.9"/><stop offset="50%" stop-color="#0891b2" stop-opacity="0.4"/><stop offset="100%" stop-color="#0284c7" stop-opacity="0"/></radialGradient></defs><circle cx="60" cy="60" r="56" fill="url(#wave-aurora)"/><path d="M12 78 C 22 36, 54 18, 88 30 C 110 42, 114 72, 96 90 C 78 106, 50 102, 32 90 Z" fill="url(#wave-curl)" opacity="0.95" filter="drop-shadow(0 0 12px #38bdf8)"/><path d="M26 74 C 38 42, 68 28, 92 42 C 105 52, 102 74, 85 84 C 70 94, 46 90, 32 80 Z" fill="#ffffff" opacity="0.6"/><circle cx="62" cy="44" r="7" fill="#ffffff" filter="drop-shadow(0 0 8px #67e8f9)"/><circle cx="80" cy="58" r="4.5" fill="#a5f3fc"/><circle cx="44" cy="66" r="5" fill="#cffafe"/><circle cx="68" cy="76" r="3.5" fill="#38bdf8"/></svg>`,
    naga_emerald_urn: `<svg viewBox="0 0 100 100" class="fx-svg-naga-urn"><defs><radialGradient id="naga-gold" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#fef08a"/><stop offset="60%" stop-color="#ffd700"/><stop offset="100%" stop-color="#b45309"/></radialGradient><linearGradient id="naga-jade" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#6ee7b7"/><stop offset="50%" stop-color="#10b981"/><stop offset="100%" stop-color="#064e3b"/></linearGradient></defs><ellipse cx="50" cy="85" rx="36" ry="12" fill="#064e3b"/><path d="M22 45 Q 18 80, 50 82 Q 82 80, 78 45 Q 68 32, 50 34 Q 32 32, 22 45 Z" fill="url(#naga-jade)" stroke="url(#naga-gold)" stroke-width="2.5"/><ellipse cx="50" cy="34" rx="28" ry="9" fill="url(#naga-gold)"/><path d="M40 32 Q 50 14, 50 8 Q 50 14, 60 32 Z" fill="url(#naga-gold)" stroke="#fff" stroke-width="1.5"/><circle cx="50" cy="8" r="4.5" fill="#ffffff" filter="drop-shadow(0 0 6px #10b981)"/><path d="M12 55 Q 30 65, 50 58 Q 70 50, 88 62" fill="none" stroke="#6ee7b7" stroke-width="3" opacity="0.85"/><text x="50" y="65" font-size="16" text-anchor="middle" filter="drop-shadow(0 0 4px #000)">🐉</text></svg>`,
    inari_foxfire_sigil: `<svg viewBox="0 0 100 100" class="fx-svg-inari-sigil"><defs><radialGradient id="foxfire-cyan" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#ffffff"/><stop offset="40%" stop-color="#22d3ee"/><stop offset="85%" stop-color="#ec4899"/><stop offset="100%" stop-color="transparent"/></radialGradient></defs><circle cx="50" cy="50" r="46" fill="url(#foxfire-cyan)" opacity="0.9"/><rect x="24" y="24" width="52" height="6" rx="2" fill="#dc2626" stroke="#fff" stroke-width="1"/><rect x="28" y="34" width="44" height="4" rx="1" fill="#dc2626"/><rect x="34" y="24" width="5" height="52" fill="#b91c1c"/><rect x="61" y="24" width="5" height="52" fill="#b91c1c"/><circle cx="50" cy="52" r="16" fill="#ffffff" filter="drop-shadow(0 0 8px #22d3ee)"/><text x="50" y="58" font-size="18" text-anchor="middle">🦊</text></svg>`,
    eclipse_yin_yang: `<svg viewBox="0 0 100 100" class="fx-svg-eclipse"><defs><radialGradient id="sun-corona" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#ffffff"/><stop offset="50%" stop-color="#fde047"/><stop offset="85%" stop-color="#eab308"/><stop offset="100%" stop-color="transparent"/></radialGradient></defs><circle cx="50" cy="50" r="48" fill="url(#sun-corona)"/><circle cx="50" cy="50" r="36" fill="#1e1b4b" stroke="#ffd700" stroke-width="2"/><path d="M50 14 A 36 36 0 0 1 50 86 A 18 18 0 0 1 50 50 A 18 18 0 0 0 50 14 Z" fill="#ffd700"/><circle cx="50" cy="32" r="6" fill="#1e1b4b"/><circle cx="50" cy="68" r="6" fill="#ffd700"/></svg>`,
    djinn_magic_lamp: `<svg viewBox="0 0 100 100" class="fx-svg-djinn-lamp"><defs><radialGradient id="lamp-gold" cx="45%" cy="45%" r="55%"><stop offset="0%" stop-color="#fef08a"/><stop offset="50%" stop-color="#f59e0b"/><stop offset="100%" stop-color="#78350f"/></radialGradient><radialGradient id="smoke-purple" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#f5d0fe"/><stop offset="50%" stop-color="#c084fc"/><stop offset="100%" stop-color="transparent"/></radialGradient></defs><circle cx="78" cy="24" r="18" fill="url(#smoke-purple)"/><circle cx="68" cy="18" r="14" fill="url(#smoke-purple)"/><path d="M18 64 C 18 50, 32 46, 52 46 C 72 46, 86 32, 90 28 C 88 38, 76 56, 70 64 Z" fill="url(#lamp-gold)" stroke="#fffbeb" stroke-width="1.5"/><ellipse cx="48" cy="66" rx="26" ry="12" fill="url(#lamp-gold)"/><ellipse cx="48" cy="76" rx="18" ry="6" fill="#78350f"/><path d="M22 54 C 10 54, 8 68, 18 72 C 26 75, 26 62, 32 60" fill="none" stroke="url(#lamp-gold)" stroke-width="5" stroke-linecap="round"/><circle cx="90" cy="26" r="4" fill="#ffffff" filter="drop-shadow(0 0 6px #c084fc)"/><text x="48" y="65" font-size="12" text-anchor="middle">✨</text></svg>`,
    phoenix_pyre_crest: `<svg viewBox="0 0 100 100" class="fx-svg-phoenix-pyre"><defs><radialGradient id="pyre-flame" cx="50%" cy="60%" r="50%"><stop offset="0%" stop-color="#ffffff"/><stop offset="35%" stop-color="#fef08a"/><stop offset="70%" stop-color="#f97316"/><stop offset="100%" stop-color="#dc2626"/></radialGradient></defs><path d="M50 4 C 62 25, 88 38, 88 64 C 88 84, 71 96, 50 96 C 29 96, 12 84, 12 64 C 12 38, 38 25, 50 4 Z" fill="url(#pyre-flame)" filter="drop-shadow(0 0 12px #f97316)"/><path d="M50 50 Q 20 28, 14 14 Q 28 38, 42 56 Z" fill="#ffd700" stroke="#fff" stroke-width="1"/><path d="M50 50 Q 80 28, 86 14 Q 72 38, 58 56 Z" fill="#ffd700" stroke="#fff" stroke-width="1"/><circle cx="50" cy="46" r="8" fill="#ffffff" filter="drop-shadow(0 0 6px #ffd700)"/><text x="50" y="51" font-size="14" text-anchor="middle">🔥</text></svg>`,
    glacial_frost_crest: `<svg viewBox="0 0 120 120" class="fx-svg-frost-crest"><defs><radialGradient id="frost-core-glow" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#ffffff"/><stop offset="35%" stop-color="#bae6fd"/><stop offset="70%" stop-color="#0284c7"/><stop offset="100%" stop-color="transparent"/></radialGradient><linearGradient id="frost-ray-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#ffffff"/><stop offset="50%" stop-color="#38bdf8"/><stop offset="100%" stop-color="#0369a1"/></linearGradient></defs><circle cx="60" cy="60" r="54" fill="url(#frost-core-glow)" opacity="0.85"/><polygon points="60,6 64,48 106,60 64,72 60,114 56,72 14,60 56,48" fill="url(#frost-ray-grad)" stroke="#ffffff" stroke-width="1.5" filter="drop-shadow(0 0 8px #38bdf8)"/><polygon points="60,18 64,50 96,60 64,70 60,102 56,70 24,60 56,50" fill="#e0f2fe" opacity="0.9" transform="rotate(45 60 60)"/><g stroke="#ffffff" stroke-width="2" stroke-linecap="round"><line x1="60" y1="60" x2="60" y2="12"/><line x1="60" y1="28" x2="48" y2="18"/><line x1="60" y1="28" x2="72" y2="18"/><line x1="60" y1="60" x2="60" y2="108"/><line x1="60" y1="92" x2="48" y2="102"/><line x1="60" y1="92" x2="72" y2="102"/><line x1="60" y1="60" x2="18" y2="36"/><line x1="32" y1="44" x2="22" y2="52"/><line x1="32" y1="44" x2="30" y2="30"/><line x1="60" y1="60" x2="102" y2="84"/><line x1="88" y1="76" x2="98" y2="68"/><line x1="88" y1="76" x2="90" y2="90"/><line x1="60" y1="60" x2="18" y2="84"/><line x1="32" y1="76" x2="22" y2="68"/><line x1="32" y1="76" x2="30" y2="90"/><line x1="60" y1="60" x2="102" y2="36"/><line x1="88" y1="44" x2="98" y2="52"/><line x1="88" y1="44" x2="90" y2="30"/></g><circle cx="60" cy="60" r="14" fill="#ffffff" stroke="#38bdf8" stroke-width="2.5" filter="drop-shadow(0 0 10px #38bdf8)"/><circle cx="60" cy="60" r="6" fill="#0284c7"/></svg>`,
    cryo_shatter_crystal: `<svg viewBox="0 0 100 100" class="fx-svg-cryo-crystal"><defs><linearGradient id="c-shard-1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#ffffff"/><stop offset="60%" stop-color="#7dd3fc"/><stop offset="100%" stop-color="#0284c7"/></linearGradient><linearGradient id="c-shard-2" x1="100%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#f0f9ff"/><stop offset="50%" stop-color="#38bdf8"/><stop offset="100%" stop-color="#0369a1"/></linearGradient></defs><polygon points="50,6 78,38 68,92 50,78 32,92 22,38" fill="url(#c-shard-1)" stroke="#ffffff" stroke-width="1.8" filter="drop-shadow(0 0 10px #38bdf8)"/><polygon points="50,6 50,78 22,38" fill="url(#c-shard-2)" opacity="0.88"/><polygon points="50,6 78,38 50,48" fill="#ffffff" opacity="0.6"/><circle cx="50" cy="38" r="4" fill="#ffffff" filter="drop-shadow(0 0 6px #fff)"/></svg>`,
    starlight_ice_scepter: `<svg viewBox="0 0 100 100" class="fx-svg-starlight-scepter"><defs><radialGradient id="scepter-star" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#ffffff"/><stop offset="40%" stop-color="#bae6fd"/><stop offset="80%" stop-color="#0284c7"/><stop offset="100%" stop-color="transparent"/></radialGradient><linearGradient id="scepter-shaft" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#ffffff"/><stop offset="50%" stop-color="#93c5fd"/><stop offset="100%" stop-color="#1e3a8a"/></linearGradient></defs><line x1="22" y1="78" x2="68" y2="32" stroke="url(#scepter-shaft)" stroke-width="5" stroke-linecap="round" filter="drop-shadow(0 0 6px #38bdf8)"/><line x1="26" y1="74" x2="64" y2="36" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round"/><circle cx="72" cy="28" r="22" fill="url(#scepter-star)" opacity="0.85"/><polygon points="72,10 76,24 90,28 76,32 72,46 68,32 54,28 68,24" fill="#ffffff" filter="drop-shadow(0 0 8px #7dd3fc)"/><polygon points="72,16 75,26 84,28 75,30 72,40 69,30 60,28 69,26" fill="#38bdf8" transform="rotate(45 72 28)"/><circle cx="72" cy="28" r="4.5" fill="#ffffff"/><circle cx="20" cy="80" r="5" fill="#38bdf8" stroke="#ffffff" stroke-width="1.5"/></svg>`,
    snowdrift_blizzard_vortex: `<svg viewBox="0 0 100 100" class="fx-svg-blizzard-vortex"><defs><radialGradient id="vortex-frost" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#ffffff"/><stop offset="35%" stop-color="#7dd3fc" stop-opacity="0.8"/><stop offset="75%" stop-color="#0284c7" stop-opacity="0.3"/><stop offset="100%" stop-color="transparent"/></radialGradient></defs><circle cx="50" cy="50" r="48" fill="url(#vortex-frost)"/><circle cx="50" cy="50" r="42" fill="none" stroke="#e0f2fe" stroke-width="4.5" stroke-dasharray="16 8" opacity="0.9"/><circle cx="50" cy="50" r="30" fill="none" stroke="#38bdf8" stroke-width="4" stroke-dasharray="12 6" opacity="0.85"/><circle cx="50" cy="50" r="18" fill="none" stroke="#ffffff" stroke-width="3" stroke-dasharray="8 4"/><circle cx="50" cy="50" r="8" fill="#bae6fd" filter="drop-shadow(0 0 6px #fff)"/><text x="50" y="55" font-size="12" text-anchor="middle">❄️</text></svg>`
  };

  const okAssets = {}; // name -> file
  const preloaded = [];

  function loadManifest() {
    return fetch(`assets/fx/manifest.json?t=${Date.now()}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j || !j.assets) return;
        Object.keys(j.assets).forEach((name) => {
          const a = j.assets[name];
          if (a && a.status === 'ok' && a.file) {
            okAssets[name] = a.file;
            const img = new Image();
            img.src = `assets/fx/${a.file}`;
            preloaded.push(img);
          }
        });
      })
      .catch(() => {});
  }

  function assetUrl(name) {
    return okAssets[name] ? `assets/fx/${okAssets[name]}` : null;
  }

  function emojiNode(name, cls) {
    const s = document.createElement('span');
    s.className = `fx-vis fx-emoji ${cls || ''}`;
    s.textContent = FALLBACK[name] || name || '✨';
    return s;
  }

  /** Absolutely-positioned visual for the moment layer (img or emoji span or rich SVG). */
  function visual(name, cls = '') {
    if (CUSTOM_SVGS[name]) {
      const wrap = document.createElement('div');
      wrap.className = `fx-vis fx-svg-wrap ${cls}`;
      wrap.innerHTML = CUSTOM_SVGS[name];
      return wrap;
    }
    const url = assetUrl(name);
    if (!url) return emojiNode(name, cls);
    const img = document.createElement('img');
    img.className = `fx-vis ${cls}`;
    img.alt = '';
    img.draggable = false;
    img.src = url;
    img.onerror = () => { delete okAssets[name]; img.replaceWith(emojiNode(name, cls)); };
    return img;
  }

  /** Inline HTML for a visual inside normal layout (slot cells, cards). */
  function visualHtml(name, cls = '') {
    if (CUSTOM_SVGS[name]) {
      return `<span class="fx-svg-wrap ${cls}">${CUSTOM_SVGS[name]}</span>`;
    }
    const url = assetUrl(name);
    const fb = FALLBACK[name] || '✨';
    if (!url) return `<span class="fx-emoji ${cls}">${fb}</span>`;
    return `<img class="${cls}" src="${url}" alt="" draggable="false" onerror="this.outerHTML='<span class=&quot;fx-emoji ${cls}&quot;>${fb}</span>'">`;
  }

  // =========================================================
  // 2. SMALL HELPERS
  // =========================================================
  const $ = (id) => document.getElementById(id);
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const cap = (r) => (r === 'bkk' ? 'Bkk' : r === 'dxb' ? 'Dxb' : r === 'bot1' ? 'Bot1' : 'Bot2');
  const other = (r) => (r === 'bkk' ? 'dxb' : 'bkk');
  const mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  const api = { reducedMotion: !!(mq && mq.matches) };
  if (mq && mq.addEventListener) mq.addEventListener('change', (e) => { api.reducedMotion = e.matches; });
  const T = (ms) => (api.reducedMotion ? Math.round(ms * 0.5) : ms);

  function sfx(name, ...args) {
    try {
      // AudioFX is a global const declared in monopoly.js (shared global lexical scope)
      if (typeof AudioFX !== 'undefined' && AudioFX[name]) AudioFX[name](...args);
    } catch (e) {}
  }

  function restartClass(el, cls, ms = 1000) {
    if (!el) return;
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
    clearTimeout(el[`_fx_${cls}`]);
    el[`_fx_${cls}`] = setTimeout(() => el.classList.remove(cls), ms);
  }

  function done(anim, node) {
    const fin = () => { if (node && node.parentNode) node.remove(); };
    return anim.finished.then(fin, fin);
  }

  const L = {};
  function refs() {
    L.wrap = $('monopolyBoardWrap');
    L.grid = $('monopolyBoardGrid');
    L.tokens = $('monopolyTokenLayer');
    L.moment = $('monopolyMomentLayer');
    return !!L.moment;
  }

  function relRect(el, base) {
    const r = el.getBoundingClientRect();
    const b = base.getBoundingClientRect();
    return { x: r.left - b.left + r.width / 2, y: r.top - b.top + r.height / 2, w: r.width, h: r.height };
  }

  function endpointEl(ep) {
    if (!ep) return null;
    if (ep.el) return ep.el;
    if (ep.role) return $(`monopoly${cap(ep.role)}Miles`);
    if (ep.token) return $(`${ep.token}Token`);
    if (ep.tileId != null) return $(`boardTile_${ep.tileId}`);
    if (ep.bank) return $('monopolyDiceBox');
    if (ep.machine) return $('slotMachine');
    return null;
  }

  /** Endpoint → {x,y,w,h} in moment-layer coordinates. */
  function point(ep) {
    refs();
    if (ep && ep.x != null && ep.y != null) return { w: 0, h: 0, ...ep };
    const base = L.moment;
    const el = endpointEl(ep);
    if (!base) return { x: 0, y: 0, w: 0, h: 0 };
    if (!el || !el.getClientRects().length) return { x: base.clientWidth / 2, y: base.clientHeight / 2, w: 0, h: 0 };
    return relRect(el, base);
  }

  function center() {
    refs();
    return { x: (L.moment ? L.moment.clientWidth : 300) / 2, y: (L.moment ? L.moment.clientHeight : 500) * 0.42 };
  }

  const MAX_ACTIVE_PARTICLES = 60;
  function pruneOldParticles() {
    if (!L.moment) return;
    const items = L.moment.querySelectorAll('.fx-vis:not([class*="fx-glow"])');
    let i = 0;
    while (items.length - i >= MAX_ACTIVE_PARTICLES) {
      const oldest = items[i++];
      if (oldest) oldest.remove();
      else break;
    }
  }

  /** Places a visual in the moment layer at (x,y) with a size in px. */
  function spawn(name, x, y, size, cls = '') {
    refs();
    pruneOldParticles();
    const node = visual(name, cls);
    node.style.width = `${size}px`;
    node.style.height = `${size}px`;
    node.style.fontSize = `${Math.round(size * 0.82)}px`;
    node.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
    if (L.moment) L.moment.appendChild(node);
    return node;
  }

  const at = (x, y, extra = '') => `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) ${extra}`;

  /**
   * Safely calculates the position for a rising monument (Citadel, Pyramid)
   * and its accompanying banner badge to guarantee full visibility on mobile screens
   * (e.g. iPhone 16/17/18 Pro) without clipping past moment layer boundaries.
   */
  function safeMonumentAnchor(targetP, offsetTop = 20) {
    refs();
    const W = (L.moment && L.moment.clientWidth) || 360;
    const H = (L.moment && L.moment.clientHeight) || 600;
    const pt = targetP || center();
    const safeModelX = Math.max(55, Math.min(W - 55, pt.x));
    const safeModelY = Math.max(65, Math.min(H - 65, pt.y - offsetTop));
    const safeBadgeX = Math.max(90, Math.min(W - 90, pt.x));
    // If the tile is near the top edge of screen, place badge BELOW the structure so it's fully visible
    const safeBadgeY = safeModelY < 120 ? (safeModelY + 64) : (safeModelY - 60);
    return { modelX: safeModelX, modelY: safeModelY, badgeX: safeBadgeX, badgeY: safeBadgeY };
  }

  // =========================================================
  // 3. SCREEN EFFECTS (shake, flash, vignette, ring, burst)
  // =========================================================
  function shake(level = 'light') {
    refs();
    if (api.reducedMotion || !L.wrap) return;
    const amp = { light: 2, medium: 4, heavy: 8 }[level] || 2;
    const dur = { light: 300, medium: 420, heavy: 560 }[level] || 300;
    const kf = [0, -1, 1, -0.8, 0.8, -0.5, 0.5, -0.2, 0].map((k, i) => ({
      transform: `translate(${(k * amp).toFixed(1)}px, ${((i % 2 ? 1 : -1) * k * amp * 0.5).toFixed(1)}px)`
    }));
    L.wrap.animate(kf, { duration: dur, easing: 'ease-out' });
  }

  function flash(color = '#fff', ms = 120) {
    if (!refs()) return Promise.resolve();
    const el = document.createElement('div');
    el.className = 'fx-flash';
    el.style.background = color;
    L.moment.appendChild(el);
    return done(el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ms, easing: 'ease-out' }), el);
  }

  function vignette(times = 3, cls = '') {
    if (!refs()) return Promise.resolve();
    const el = document.createElement('div');
    el.className = `fx-vignette ${cls}`;
    L.moment.appendChild(el);
    return done(el.animate([{ opacity: 0 }, { opacity: 1 }, { opacity: 0 }], { duration: T(400), iterations: times }), el);
  }

  function ring(x, y, size = 60, color = '#fde047', ms = 450) {
    if (window.SkyPixi && window.SkyPixi.isReady) {
      const numColor = typeof color === 'string' && color.startsWith('#')
        ? parseInt(color.slice(1), 16)
        : 0xfde047;
      window.SkyPixi.spawnShockwaveRing(x, y, numColor, size * 1.5, ms);
    }
    if (!refs()) return;
    const el = document.createElement('div');
    el.className = 'fx-ring';
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.borderColor = color;
    el.style.boxShadow = `0 0 24px ${color}, inset 0 0 12px ${color}`;
    L.moment.appendChild(el);
    done(el.animate([
      { transform: at(x, y, 'scale(0.2)'), opacity: 1 },
      { transform: at(x, y, 'scale(1.7)'), opacity: 0 }
    ], { duration: T(ms), easing: 'cubic-bezier(.16,1,.3,1)' }), el);
  }

  /** Particle burst with simple ballistic motion. */
  function burst({ x, y, name = 'sparkle', count = 8, spread = 120, up = 0, gravity = 300, life = 900, size = 18, filter = '', rotate = true }) {
    if (window.SkyPixi && window.SkyPixi.isReady) {
      const pixiKind = (name === 'fire' || name === 'flame') ? 'ember' :
                       (name === 'ice' || name === 'frost' || name === 'crystal') ? 'frost' :
                       (name === 'star' || name === 'stardust' || name === 'starfall') ? 'stardust' :
                       (name === 'chip' || name === 'monaco_chip') ? 'chip' : 'spark';
      window.SkyPixi.spawnRadialBurst(x, y, pixiKind, count * 2, { additive: true });
    }
    if (!refs()) return Promise.resolve();
    const isMobile = typeof window !== 'undefined' && (window.innerWidth < 640 || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
    const maxCount = isMobile ? (api.reducedMotion ? 4 : 16) : (api.reducedMotion ? 6 : count);
    const n = Math.min(count, maxCount);
    const jobs = [];
    for (let i = 0; i < n; i++) {
      const node = spawn(name, x, y, size * rand(0.75, 1.2));
      if (filter) node.style.filter = filter;
      const ang = rand(0, Math.PI * 2);
      const v = rand(0.45, 1) * spread;
      const vx = Math.cos(ang) * v;
      const vy = Math.sin(ang) * v - up;
      const rot = rotate ? rand(-360, 360) : 0;
      const sec = life / 1000;
      const frames = [];
      for (let k = 0; k <= 6; k++) {
        const t = (k / 6) * sec;
        const px = x + vx * t;
        const py = y + vy * t + 0.5 * gravity * t * t;
        frames.push({
          transform: at(px, py, `rotate(${(rot * k) / 6}deg) scale(${k === 0 ? 0.4 : 1})`),
          opacity: k < 4 ? 1 : 1 - (k - 3) / 3
        });
      }
      jobs.push(done(node.animate(frames, { duration: T(life), easing: 'linear' }), node));
    }
    return Promise.all(jobs);
  }

  function shards({ x, y, colors = ['#7f1d1d', '#b45309', '#3f3f46'], count = 6 }) {
    if (!refs()) return;
    const n = api.reducedMotion ? 3 : count;
    for (let i = 0; i < n; i++) {
      const el = document.createElement('div');
      el.className = 'fx-shard';
      el.style.background = colors[i % colors.length];
      L.moment.appendChild(el);
      const vx = rand(-260, 260);
      const vy = rand(-380, -220);
      const frames = [];
      for (let k = 0; k <= 6; k++) {
        const t = (k / 6) * 0.9;
        frames.push({ transform: at(x + vx * t, y + vy * t + 0.5 * 900 * t * t, `rotate(${k * 90}deg)`), opacity: k < 5 ? 1 : 0 });
      }
      done(el.animate(frames, { duration: T(900) }), el);
    }
  }

  // =========================================================
  // 4. NUMBER TWEEN
  // =========================================================
  const tweens = new WeakMap();
  function tween(el, from, to, ms, fmtFn, onStep) {
    if (!el) return;
    const prev = tweens.get(el);
    if (prev) cancelAnimationFrame(prev);
    const dur = T(ms);
    const t0 = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - t, 3);
      const v = from + (to - from) * e;
      el.innerHTML = fmtFn(v);
      if (onStep) onStep(v);
      if (t < 1) tweens.set(el, requestAnimationFrame(step));
      else tweens.delete(el);
    };
    tweens.set(el, requestAnimationFrame(step));
  }

  // =========================================================
  // 5. TOKENS (persistent, glide between tiles)
  // =========================================================
  const tok = { el: {}, shown: { bkk: null, dxb: null }, busy: { bkk: false, dxb: false }, lock: { bkk: false, dxb: false } };

  function mount(state) {
    refs();
    if (!L.tokens || !state || !state.players) return;
    const roles = Object.keys(state.players);
    roles.forEach((r) => {
      let el = tok.el[r];
      if (!el || !L.tokens.contains(el)) {
        el = document.createElement('div');
        const colorClass = r === 'bkk' ? 'token-color-ruby' : r === 'dxb' ? 'token-color-cyan' : r === 'bot1' ? 'token-color-emerald' : 'token-color-amber';
        el.className = `board-token token-${r} ${colorClass}`;
        el.id = `${r}Token`;
        el.innerHTML = '<span class="token-name-tag"></span><span class="token-ring"></span><span class="token-shadow"></span><span class="token-body"><img class="token-sprite" alt="" draggable="false"></span>';
        L.tokens.appendChild(el);
        tok.el[r] = el;
      }
      const nameTag = el.querySelector('.token-name-tag');
      const pName = state.players[r] && state.players[r].name;
      if (nameTag && pName) {
        const shortName = pName.length > 12 ? pName.slice(0, 11) + '…' : pName;
        nameTag.textContent = shortName;
      }
      const img = el.querySelector('.token-sprite');
      const src = state.players[r] && state.players[r].sprite;
      if (src && img.getAttribute('src') !== src) img.src = src;

      // Auto-apply S6 Mythic subtle board auras
      const cid = state.players[r] && (state.players[r].costume || '');
      if (cid.includes('supernova') || cid.includes('s6_supernova')) {
        el.classList.add('token-supernova-ready');
      }
      if (cid.includes('aegis') || cid.includes('s6_aegis')) {
        el.classList.add('token-astral-shield');
      }
      // S8 Glacial Empress / Blizzard Warden: Ice Dragon Wings & Diamond-Dust Wake
      const pData = state.players[r];
      const isFrostEmpress = (cid.includes('empress') || cid.includes('s8_empress') || cid.includes('warden') || cid.includes('s8_warden') || (typeof isFrostSovereign === 'function' && isFrostSovereign(r)));
      const hasWings = isFrostEmpress && (pData && (pData.ult >= 100 || pData.goldenRollNext || pData.hasFrostDragonWings || pData.zeroRentIceBridge || state.hadBonusRoll));
      el.classList.toggle('token-frost-dragon-wings', !!hasWings);

      // S9 Cleopatra / Ramses: Gilded Scarab Wings
      const isGilded = (cid.includes('cleopatra') || cid.includes('s9_cleopatra') || cid.includes('pharaoh') || cid.includes('s9_pharaoh') || (typeof isGildedSovereign === 'function' && isGildedSovereign(r)));
      const hasGildedWings = isGilded && (pData && (pData.ult >= 100 || pData.goldenRollNext || pData.hasGildedScarabWings || state.hadBonusRoll));
      el.classList.toggle('token-gilded-scarab-wings', !!hasGildedWings);

      // S9 Sun God Ra / Sekhmet: Solar Falcon Wings
      const isSolar = (cid.includes('s9_ra') || cid.includes('s9_sekhmet') || (cid.includes('ra') && !cid.includes('pharaoh') && !cid.includes('rapunzel')) || cid.includes('sekhmet') || (typeof isSolarDivinity === 'function' && isSolarDivinity(r)));
      const hasSolarWings = isSolar && (pData && (pData.ult >= 100 || pData.goldenRollNext || pData.hasSolarFalconWings || state.hadBonusRoll));
      el.classList.toggle('token-solar-falcon-wings', !!hasSolarWings);
    });
    // Clean up tokens that are no longer in players state
    Object.keys(tok.el).forEach((r) => {
      if (!roles.includes(r) && tok.el[r]) {
        tok.el[r].remove();
        delete tok.el[r];
        delete tok.shown[r];
      }
    });
  }

  function tileBox(tileId) {
    const t = $(`boardTile_${tileId}`);
    if (!t || !L.tokens) return null;
    const r = t.getBoundingClientRect();
    if (!r.width) return null;
    const b = L.tokens.getBoundingClientRect();
    return { x: r.left - b.left, y: r.top - b.top, w: r.width, h: r.height };
  }

  function anchor(role, tileId, positions) {
    const box = tileBox(tileId);
    if (!box) return null;
    const size = clamp(box.w * 0.58, 22, 38);
    const sharingRoles = Object.keys(positions || {}).filter((r) => positions[r] === tileId);
    const count = sharingRoles.length;
    const idx = sharingRoles.indexOf(role);

    let cx = box.x + box.w / 2;
    let cy = box.y + box.h * 0.42;
    let s = 1;

    if (count === 2) {
      cx += (idx === 0 ? -1 : 1) * box.w * 0.20;
      s = 0.92;
    } else if (count >= 3) {
      const ox = (idx % 2 === 0 ? -1 : 1) * box.w * 0.18;
      const oy = (idx < 2 ? -1 : 1) * box.h * 0.14;
      cx += ox;
      cy += oy;
      s = 0.82;
    }

    return { x: cx - size / 2, y: cy - size, size, s };
  }

  const tf = (a, dy = 0, sx = 1, sy = 1, extra = '') =>
    `translate3d(${a.x.toFixed(1)}px, ${(a.y + dy).toFixed(1)}px, 0) scale(${(a.s * sx).toFixed(3)}, ${(a.s * sy).toFixed(3)}) ${extra}`;

  function place(role, tileId) {
    const el = tok.el[role];
    tok.shown[role] = tileId;
    if (!el) return;
    const a = anchor(role, tileId, tok.shown);
    if (!a) return;
    el.style.width = `${a.size}px`;
    el.style.height = `${a.size}px`;
    el.style.transform = tf(a);
    el.style.opacity = '1';
  }

  function placeAll() {
    const roles = Object.keys(tok.shown);
    roles.forEach((r) => {
      if (!tok.busy[r] && tok.shown[r] != null) place(r, tok.shown[r]);
    });
  }

  function landFx(tileId) {
    const p = point({ tileId });
    ring(p.x, p.y + p.h * 0.1, Math.max(36, p.w * 0.9), 'rgba(255,255,255,0.85)', 450);
    burst({ x: p.x, y: p.y + p.h * 0.25, name: 'smoke', count: 3, spread: 40, up: 30, gravity: 0, life: 600, size: 16, filter: 'sepia(0.6) brightness(1.1)', rotate: false });
    sfx('playThud');
    if (window.SkyPixi && window.SkyPixi.isReady && typeof window.SkyPixi.spawnTileLanding === 'function') {
      window.SkyPixi.spawnTileLanding(p.x, p.y + p.h * 0.1);
    }
  }

  function hop(role, fromId, toId, opts = {}) {
    return new Promise((resolve) => {
      const el = tok.el[role];
      if (!el) { tok.shown[role] = toId; resolve(); return; }
      const before = { ...tok.shown, [role]: fromId };
      const after = { ...tok.shown, [role]: toId };
      const A = anchor(role, fromId, before);
      const B = anchor(role, toId, after);
      if (!A || !B) { place(role, toId); sfx('playHop'); setTimeout(resolve, 200); return; }
      tok.busy[role] = true;
      el.classList.add('hopping');
      el.style.width = `${B.size}px`;
      el.style.height = `${B.size}px`;
      const dur = T(opts.first ? 280 : opts.final ? 400 : 230);
      const arc = opts.final ? 30 : 20;
      const mid = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2, s: B.s };
      const anim = el.animate([
        { transform: tf(A), offset: 0 },
        { transform: tf(mid, -arc, 1.08, 1.08), offset: 0.45 },
        { transform: tf(B, 2, 1.14, 0.86), offset: 0.82 },
        { transform: tf(B), offset: 1 }
      ], { duration: dur, easing: 'cubic-bezier(.3,.7,.4,1)' });
      el.style.transform = tf(B);
      const shadow = el.querySelector('.token-shadow');
      if (shadow) {
        shadow.animate([
          { transform: 'scale(1)', opacity: 1 },
          { transform: 'scale(0.55)', opacity: 0.5, offset: 0.45 },
          { transform: 'scale(1.1)', opacity: 1, offset: 0.82 },
          { transform: 'scale(1)', opacity: 1 }
        ], { duration: dur });
      }
      if (opts.drift) {
        sfx('playWhoosh');
        ring(B.x, B.y, 95, '#06b6d4', 550);
        burst({ x: B.x, y: B.y, name: 'sparkle', count: 12, spread: 100, up: 60, gravity: -20, life: 750, size: 14 });
      }
      if (opts.supernova) {
        ring(mid.x, mid.y, 55, '#fde047', 350);
        burst({ x: mid.x, y: mid.y, name: 'sparkle', count: 12, spread: 85, up: 60, gravity: 0, life: 650, size: 14 });
      }
      if (opts.frostWake) {
        ring(mid.x, mid.y, 65, '#38bdf8', 350);
        burst({ x: mid.x, y: mid.y, name: 'cryo_shatter_crystal', count: 6, spread: 80, up: 45, gravity: -10, life: 550, size: 14 });
        burst({ x: mid.x, y: mid.y, name: 'sparkle', count: 12, spread: 90, up: 55, gravity: -20, life: 650, size: 16 });
      }
      if (opts.gildedWake) {
        ring(mid.x, mid.y, 65, '#fbbf24', 350);
        burst({ x: mid.x, y: mid.y, name: 'sparkle', count: 14, spread: 90, up: 60, gravity: -20, life: 650, size: 16 });
      }
      if (opts.solarWake) {
        ring(mid.x, mid.y, 70, '#ff4500', 350);
        burst({ x: mid.x, y: mid.y, name: 'fire', count: 10, spread: 85, up: 55, gravity: -30, life: 600, size: 16 });
      }
      if (opts.phantomWake) {
        ring(mid.x, mid.y, 70, '#a855f7', 350);
        burst({ x: mid.x, y: mid.y, name: 'sparkle', count: 12, spread: 85, up: 55, gravity: -20, life: 600, size: 16 });
      }
      if (opts.olympusWake) {
        ring(mid.x, mid.y, 75, '#38bdf8', 350);
        burst({ x: mid.x, y: mid.y, name: 'sparkle', count: 14, spread: 90, up: 60, gravity: -20, life: 650, size: 18 });
      }
      setTimeout(() => {
        sfx('playHop', opts.stepIndex || 0);
        restartClass($(`boardTile_${toId}`), 'step-highlight', 320);
      }, dur * 0.8);
      const finish = () => {
        tok.shown[role] = toId;
        tok.busy[role] = false;
        el.classList.remove('hopping');
        if (opts.final) {
          landFx(toId);
          if (window.gsap) {
            try {
              gsap.fromTo(el, 
                { scaleX: 1.25, scaleY: 0.78 },
                { scaleX: 1, scaleY: 1, duration: 0.35, ease: 'elastic.out(1.2, 0.4)' }
              );
            } catch (e) {}
          }
          if (opts.supernova) {
            sfx('fanfare');
            ring(B.x, B.y, 160, '#ffd700', 700);
            ring(B.x, B.y, 250, '#c084fc', 950);
            burst({ x: B.x, y: B.y, name: 'sparkle', count: 28, spread: 240, up: 180, gravity: 120, life: 1100, size: 18 });
            burst({ x: B.x, y: B.y, name: 'coin', count: 10, spread: 160, up: 140, gravity: 280, life: 900, size: 16 });
          }
          if (opts.frostWake) {
            sfx('playFrostShimmer');
            ring(B.x, B.y, 160, '#38bdf8', 700);
            ring(B.x, B.y, 250, '#e0f2fe', 950);
            burst({ x: B.x, y: B.y, name: 'cryo_shatter_crystal', count: 18, spread: 220, up: 160, gravity: 50, life: 1000, size: 18 });
            burst({ x: B.x, y: B.y, name: 'glacial_frost_crest', count: 5, spread: 180, up: 120, gravity: 30, life: 900, size: 24 });
            burst({ x: B.x, y: B.y, name: 'sparkle', count: 24, spread: 260, up: 180, gravity: -30, life: 1100, size: 20 });
          }
          if (opts.gildedWake) {
            sfx('playPassStart');
            ring(B.x, B.y, 160, '#fbbf24', 700);
            ring(B.x, B.y, 250, '#fef08a', 950);
            burst({ x: B.x, y: B.y, name: 'sparkle', count: 26, spread: 250, up: 180, gravity: -20, life: 1100, size: 20 });
            burst({ x: B.x, y: B.y, name: 'coin', count: 8, spread: 180, up: 140, gravity: 260, life: 950, size: 16 });
          }
          if (opts.solarWake) {
            sfx('playBoom');
            ring(B.x, B.y, 170, '#ff4500', 700);
            ring(B.x, B.y, 260, '#fbbf24', 950);
            burst({ x: B.x, y: B.y, name: 'fire', count: 22, spread: 260, up: 180, gravity: -40, life: 1050, size: 20 });
            burst({ x: B.x, y: B.y, name: 'sparkle', count: 20, spread: 220, up: 150, gravity: 0, life: 950, size: 18 });
          }
          if (opts.phantomWake) {
            sfx('playPhantomImpact');
            ring(B.x, B.y, 170, '#a855f7', 700);
            ring(B.x, B.y, 260, '#f43f5e', 950);
            burst({ x: B.x, y: B.y, name: 'sparkle', count: 28, spread: 250, up: 180, gravity: -30, life: 1100, size: 22 });
            burst({ x: B.x, y: B.y, name: 'coin', count: 8, spread: 180, up: 140, gravity: 260, life: 950, size: 16 });
          }
          if (opts.olympusWake) {
            sfx('playBoom');
            ring(B.x, B.y, 180, '#38bdf8', 700);
            ring(B.x, B.y, 270, '#fbbf24', 950);
            burst({ x: B.x, y: B.y, name: 'sparkle', count: 28, spread: 260, up: 180, gravity: -20, life: 1100, size: 22 });
            burst({ x: B.x, y: B.y, name: 'coin', count: 10, spread: 200, up: 160, gravity: 280, life: 950, size: 18 });
          }
        }
        placeAll();
        resolve();
      };
      anim.finished.then(finish, finish);
    });
  }

  function portalAt(tileId) {
    const p = point({ tileId });
    const node = spawn('portal', p.x, p.y, Math.max(44, p.w * 1.1));
    done(node.animate([
      { transform: at(p.x, p.y, 'scale(0) rotate(0deg)'), opacity: 0 },
      { transform: at(p.x, p.y, 'scale(1) rotate(200deg)'), opacity: 1, offset: 0.4 },
      { transform: at(p.x, p.y, 'scale(0) rotate(420deg)'), opacity: 0 }
    ], { duration: T(560), easing: 'ease-in-out' }), node);
  }

  async function teleport(role, toId) {
    const el = tok.el[role];
    if (!el) { tok.shown[role] = toId; return; }
    tok.busy[role] = true;
    const fromId = tok.shown[role];
    const A = fromId != null ? anchor(role, fromId, tok.shown) : null;
    sfx('playWhoosh');
    if (A) {
      portalAt(fromId);
      const out = el.animate([
        { transform: tf(A), opacity: 1 },
        { transform: tf(A, 0, 0.01, 0.01, 'rotate(360deg)'), opacity: 0 }
      ], { duration: T(300), easing: 'ease-in' });
      el.style.opacity = '0';
      await out.finished.catch(() => {});
    }
    tok.shown[role] = toId;
    const B = anchor(role, toId, tok.shown);
    if (B) {
      portalAt(toId);
      await sleep(T(120));
      el.style.width = `${B.size}px`;
      el.style.height = `${B.size}px`;
      el.style.transform = tf(B);
      el.style.opacity = '1';
      await el.animate([
        { transform: tf(B, 0, 0.01, 0.01), opacity: 0 },
        { transform: tf(B, 0, 1.15, 1.15), opacity: 1, offset: 0.7 },
        { transform: tf(B), opacity: 1 }
      ], { duration: T(340), easing: 'ease-out' }).finished.catch(() => {});
    }
    el.style.opacity = '1';
    tok.busy[role] = false;
    placeAll();
  }

  function syncTokens(state, opts = {}) {
    if (!state || !state.players) return;
    mount(state);
    const roles = Object.keys(state.players);
    roles.forEach((r) => {
      if (tok.busy[r] || tok.lock[r] || (typeof window !== 'undefined' && window.activeMoveLocks && window.activeMoveLocks[r])) return;
      const pos = state.players[r].pos;
      if (tok.shown[r] == null || !opts.animate) { tok.shown[r] = pos; return; }
      if (tok.shown[r] !== pos) teleport(r, pos);
    });
    placeAll();
  }

  function setActive(role) {
    Object.keys(tok.el).forEach((r) => { if (tok.el[r]) tok.el[r].classList.toggle('is-active', r === role); });
  }

  function fallToken(role) {
    const el = tok.el[role];
    if (!el) return Promise.resolve();
    tok.lock[role] = true;
    const base = el.style.transform;
    return el.animate([
      { transform: base, opacity: 1 },
      { transform: `${base} translateY(300px) rotate(540deg)`, opacity: 0 }
    ], { duration: T(900), easing: 'cubic-bezier(.5,0,.9,.5)', fill: 'forwards' }).finished.catch(() => {});
  }

  function resetTokens() {
    Object.keys(tok.el).forEach((r) => {
      tok.lock[r] = false;
      if (tok.el[r]) tok.el[r].getAnimations().forEach((a) => a.cancel());
    });
  }

  // =========================================================
  // 6. COINS & FLYING ICONS
  // =========================================================
  function bez(p0, p1, p2, t) {
    const u = 1 - t;
    return { x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x, y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y };
  }

  function arcFrames(P0, P2, spin, scaleFn) {
    const dx = P2.x - P0.x;
    const dy = P2.y - P0.y;
    const len = Math.hypot(dx, dy) || 1;
    const off = rand(30, 70) * (Math.random() < 0.5 ? -1 : 1);
    const P1 = { x: (P0.x + P2.x) / 2 + (-dy / len) * off, y: (P0.y + P2.y) / 2 + (dx / len) * off - 40 };
    const frames = [];
    for (let k = 0; k <= 8; k++) {
      const t = k / 8;
      const p = bez(P0, P1, P2, t);
      frames.push({ transform: at(p.x, p.y, `rotate(${spin * t}deg) scale(${scaleFn(t).toFixed(3)})`), opacity: k === 0 ? 0 : 1 });
    }
    return frames;
  }

  function coins({ from, to, amount = 0, delay = 0 } = {}) {
    return new Promise((resolve) => {
      setTimeout(() => {
        if (!refs()) { resolve(); return; }
        const n = api.reducedMotion ? 3 : clamp(Math.round(Math.abs(amount) / 40), 4, 14);
        const P2 = point(to);
        const b = point(from);
        if (window.SkyPixi && window.SkyPixi.isReady) {
          window.SkyPixi.spawnCoinBurst(b, P2, n * 2);
        }
        const targetEl = endpointEl(to);
        const intoTarget = !(to && to.role);
        const bumpEl = to && to.role && targetEl ? (targetEl.closest('.monopoly-player-card') || {}).querySelector?.('.player-thumb-mini') : null;
        let landed = 0;
        let lastTick = 0;
        for (let i = 0; i < n; i++) {
          const b = point(from);
          const P0 = { x: b.x + rand(-10, 10), y: b.y + rand(-10, 10) };
          const node = spawn('coin', P0.x, P0.y, 22, 'fx-coin');
          const scaleFn = (t) => {
            const s = 0.6 + 0.5 * Math.sin(Math.PI * t);
            return intoTarget && t > 0.8 ? s * (1 - ((t - 0.8) / 0.2) * 0.75) : s;
          };
          const anim = node.animate(arcFrames(P0, P2, 540, scaleFn), {
            duration: T(650), delay: T(i * 45), easing: 'cubic-bezier(.45,.05,.55,.95)', fill: 'both'
          });
          const arrive = () => {
            if (node.parentNode) node.remove();
            if (bumpEl) restartClass(bumpEl, 'coin-bump', 220);
            const now = performance.now();
            if (now - lastTick > 60) { sfx('playCoinTick'); lastTick = now; }
            landed++;
            if (landed === n) resolve();
          };
          anim.finished.then(arrive, arrive);
        }
      }, delay);
    });
  }

  function flyIcon({ from, to, name = 'sparkle', emoji = null, delay = 0 } = {}) {
    return new Promise((resolve) => {
      setTimeout(() => {
        if (!refs()) { resolve(); return; }
        const P0 = point(from);
        const P2 = point(to);
        let node;
        if (emoji) {
          node = document.createElement('span');
          node.className = 'fx-vis fx-emoji';
          node.textContent = emoji;
          node.style.width = node.style.height = '34px';
          node.style.fontSize = '28px';
          L.moment.appendChild(node);
        } else {
          node = spawn(name, P0.x, P0.y, 34);
        }
        const anim = node.animate(arcFrames(P0, P2, 0, (t) => (t < 0.2 ? 0.6 + t * 3 : 1.2 - (t - 0.2) * 0.6)), {
          duration: T(800), easing: 'cubic-bezier(.45,.05,.55,.95)', fill: 'both'
        });
        const fin = () => {
          if (node.parentNode) node.remove();
          burst({ x: P2.x, y: P2.y, count: 5, spread: 50, gravity: 0, life: 500, size: 12 });
          resolve();
        };
        anim.finished.then(fin, fin);
      }, delay);
    });
  }

  function plantFlag(tileId, role) {
    const p = point({ tileId });
    if (!p.w) return;
    const size = Math.max(28, p.h * 0.6);
    const node = spawn(role === 'dxb' ? 'flag_dxb' : 'flag_bkk', p.x, p.y, size);
    if (!assetUrl(role === 'dxb' ? 'flag_dxb' : 'flag_bkk')) node.style.filter = role === 'dxb' ? 'hue-rotate(300deg) saturate(1.4)' : 'hue-rotate(200deg) saturate(1.4)';
    done(node.animate([
      { transform: at(p.x, p.y - 30, 'scale(1.4)'), opacity: 0 },
      { transform: at(p.x, p.y, 'scale(1) rotate(0deg)'), opacity: 1, offset: 0.25 },
      { transform: at(p.x, p.y, 'rotate(8deg)'), offset: 0.35 },
      { transform: at(p.x, p.y, 'rotate(-8deg)'), offset: 0.45 },
      { transform: at(p.x, p.y, 'rotate(5deg)'), offset: 0.55 },
      { transform: at(p.x, p.y, 'rotate(0deg)'), opacity: 1, offset: 0.75 },
      { transform: at(p.x, p.y, 'scale(0.8)'), opacity: 0 }
    ], { duration: T(1300), easing: 'ease-out' }), node);
  }

  // =========================================================
  // 7. MOMENT ENGINE (queued, one at a time, ≤ 2s each)
  // =========================================================
  const queue = [];
  let running = false;
  let holds = 0;

  function banner(title, sub = '', color = '', holdMs = 1000) {
    if (!refs()) return Promise.resolve();
    const el = document.createElement('div');
    el.className = `moment-banner ${color}`;
    el.innerHTML = `<span class="mb-title"></span>${sub ? '<span class="mb-sub"></span>' : ''}`;
    el.querySelector('.mb-title').textContent = title;
    if (sub) el.querySelector('.mb-sub').textContent = sub;
    L.moment.appendChild(el);
    const total = T(260 + holdMs + 300);
    return done(el.animate([
      { transform: 'translate(-50%, -50%) scale(2.4)', opacity: 0 },
      { transform: 'translate(-50%, -50%) scale(1)', opacity: 1, offset: T(260) / total },
      { transform: 'translate(-50%, -50%) scale(1.02)', opacity: 1, offset: (T(260) + T(holdMs)) / total },
      { transform: 'translate(-50%, -85%) scale(0.9)', opacity: 0 }
    ], { duration: total, easing: 'cubic-bezier(.175,.885,.32,1.275)' }), el);
  }

  /**
   * 🏮 S7 Mythic: WISH UPON A LANTERN FESTIVAL
   * 4-Phase Cinematic Sequence:
   * 1. Golden twilight sky atmospheric vignette & sundrop charge glow.
   * 2. Procedural SVG illuminated sky lanterns floating upwards across the board.
   * 3. 3 Golden Wish Sanctuaries manifest on board tiles with floating badges.
   * 4. Detonation golden stardust shockwave, triple expanding rings & royal banner.
   */
  async function lanternFestival(d = {}) {
    if (!refs()) return;
    const casterRole = d.casterRole || d.role || 'dxb';
    const casterEl = tok.el[casterRole] || $(`${casterRole}Token`);
    const fromP = casterEl ? relRect(casterEl, L.moment) : (point({ token: casterRole }) || center());

    // 1. Audio & Theatrical Pre-Charge
    sfx('playFairytaleHarp');
    flash('rgba(253, 224, 71, 0.65)', 350);
    shake('medium');
    vignette(4, 'lantern-sky');

    if (casterEl) casterEl.classList.add('fx-token-sundrop-charge');

    // 2. Procedural SVG Floating Sky Lanterns
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'fx-mythic-overlay-svg fx-glow-gold');
    svg.setAttribute('viewBox', `0 0 ${L.moment.clientWidth || 800} ${L.moment.clientHeight || 800}`);
    svg.innerHTML = `
      <defs>
        <radialGradient id="lantern-core-grad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#ffffff" />
          <stop offset="40%" stop-color="#fef08a" />
          <stop offset="80%" stop-color="#f59e0b" />
          <stop offset="100%" stop-color="rgba(217, 119, 6, 0)" />
        </radialGradient>
        <filter id="lantern-blur" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
    `;
    L.moment.appendChild(svg);

    const lanterns = [];
    const W = L.moment.clientWidth || 800;
    const H = L.moment.clientHeight || 800;
    for (let i = 0; i < 14; i++) {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('filter', 'url(#lantern-blur)');
      const baseX = (W * 0.1) + Math.random() * (W * 0.8);
      const startY = H + 20 + Math.random() * 80;
      const speed = 0.55 + Math.random() * 0.45;
      const swayAmp = 15 + Math.random() * 20;
      const swayFreq = 0.003 + Math.random() * 0.002;
      const scale = 0.7 + Math.random() * 0.6;
      g.innerHTML = `
        <ellipse cx="0" cy="0" rx="14" ry="18" fill="url(#lantern-core-grad)" />
        <rect x="-8" y="14" width="16" height="4" rx="2" fill="#78350f" opacity="0.8" />
        <circle cx="0" cy="4" r="5" fill="#ffffff" opacity="0.9" />
      `;
      svg.appendChild(g);
      lanterns.push({ el: g, baseX, y: startY, speed, swayAmp, swayFreq, scale, seed: Math.random() * 100 });
    }

    // 3. Floating Wish Badges on board
    const wishSanctuaries = d.wishSanctuaries || [3, 7, 12];
    const badges = [];
    wishSanctuaries.forEach((tid, idx) => {
      const tCoord = point({ tileId: tid }) || { x: fromP.x + (idx * 60) - 60, y: fromP.y - 70 };
      const badge = document.createElement('div');
      badge.className = 'fx-lantern-wish-badge';
      const label = idx === 0 ? '✨ LOADED 6' : idx === 1 ? '🛡️ IMMUNITY' : '🪙 +150 COINS';
      badge.innerHTML = `🏮 WISH SANCTUARY<br><small style="font-size:10px;font-weight:700;">${label}</small>`;
      badge.style.left = `${tCoord.x}px`;
      badge.style.top = `${tCoord.y - 30}px`;
      L.moment.appendChild(badge);
      requestAnimationFrame(() => {
        badge.style.transform = 'translate(-50%, -50%) scale(1.1)';
      });
      badges.push(badge);
      ring(tCoord.x, tCoord.y, 80, '#fde047', 700);
    });

    const startTime = performance.now();
    const duration = T(950);

    try {
      while (performance.now() - startTime < duration) {
        const elapsed = performance.now() - startTime;
        lanterns.forEach(lt => {
          lt.y -= lt.speed * 8;
          const swayX = lt.baseX + Math.sin((elapsed + lt.seed * 50) * lt.swayFreq) * lt.swayAmp;
          lt.el.setAttribute('transform', `translate(${swayX.toFixed(1)}, ${lt.y.toFixed(1)}) scale(${lt.scale})`);
        });
        if (Math.random() < 0.35) {
          const randLt = lanterns[Math.floor(Math.random() * lanterns.length)];
          if (randLt && randLt.y < H && randLt.y > 0) {
            burst({ x: randLt.baseX, y: randLt.y, name: 'sparkle', count: 3, spread: 40, up: 20, life: 400, size: 12 });
          }
        }
        await sleep(35);
      }
    } finally {
      svg.remove();
      badges.forEach(b => {
        b.style.opacity = '0';
        b.style.transform = 'translate(-50%, -70%) scale(0.7)';
        setTimeout(() => b.remove(), 350);
      });
      if (casterEl) casterEl.classList.remove('fx-token-sundrop-charge');
    }

    // 4. Detonation Shockwave & Banner
    sfx('playBoom');
    flash('rgba(253, 224, 71, 0.7)', 450);
    shake('heavy');

    ring(fromP.x, fromP.y, 160, '#fde047', 600);
    ring(fromP.x, fromP.y, 280, '#fbbf24', 850);
    ring(fromP.x, fromP.y, 400, '#ffffff', 1100);

    burst({ x: fromP.x, y: fromP.y, name: 'sparkle', count: 28, spread: 260, up: 180, life: 1200, size: 22 });
    burst({ x: fromP.x, y: fromP.y, name: 'gem', count: 16, spread: 220, up: 140, life: 1000, size: 18 });

    const b = banner('🏮 WISH UPON A LANTERN FESTIVAL! ✨', '3 WISH SANCTUARIES · 1-ROUND IMMUNITY · BONUS ROLL 6!', 'gold', 1700);
    await sleep(T(1200));
    await b;
  }

  /**
   * ⏳ S7 Mythic: THE CHRONO-MIDNIGHT PARADOX
   * 4-Phase Cinematic Sequence:
   * 1. Temporal chrono-vignette shift & deep cathedral bells.
   * 2. Procedural SVG giant Roman clock face with counter-clockwise spinning hands.
   * 3. Rivals frozen in .fx-temporal-stasis & luxury hotels regressed with crumbling dust.
   * 4. Chrono-wave detonation rings & royal midnight banner.
   */
  async function midnightParadox(d = {}) {
    if (!refs()) return;
    const casterRole = d.casterRole || d.role || 'bkk';
    const casterEl = tok.el[casterRole] || $(`${casterRole}Token`);
    const fromP = casterEl ? relRect(casterEl, L.moment) : (point({ token: casterRole }) || center());
    const c = center();

    // 1. Audio & Pre-charge
    sfx('playMidnightChimes');
    flash('rgba(56, 189, 248, 0.7)', 380);
    shake('heavy');
    vignette(4, 'midnight-clock');

    if (window.SkyPixi && window.SkyPixi.isReady) {
      window.SkyPixi.ultimates.midnightParadox({ cX: c.x, cY: c.y });
    }

    if (casterEl) casterEl.classList.add('fx-token-clockwork-charge');

    const victimEls = [];
    Object.keys(tok.el).forEach(r => {
      if (r !== casterRole && tok.el[r]) {
        tok.el[r].classList.add('fx-temporal-stasis');
        victimEls.push(tok.el[r]);
      }
    });

    // 2. Procedural Giant Roman Chrono-Clock SVG
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'fx-mythic-overlay-svg fx-glow-cyan');
    svg.setAttribute('viewBox', `0 0 ${L.moment.clientWidth || 800} ${L.moment.clientHeight || 800}`);
    svg.innerHTML = `
      <defs>
        <filter id="chrono-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <radialGradient id="clock-face-grad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="rgba(56, 189, 248, 0.25)" />
          <stop offset="70%" stop-color="rgba(14, 165, 233, 0.15)" />
          <stop offset="100%" stop-color="rgba(8, 47, 73, 0)" />
        </radialGradient>
      </defs>
      <g id="chrono-clock-group" filter="url(#chrono-glow)">
        <circle cx="${c.x}" cy="${c.y}" r="110" fill="url(#clock-face-grad)" stroke="#38bdf8" stroke-width="3" stroke-dasharray="6,4" />
        <circle cx="${c.x}" cy="${c.y}" r="92" fill="none" stroke="#818cf8" stroke-width="1.5" />
        <text x="${c.x}" y="${c.y - 75}" text-anchor="middle" fill="#bae6fd" font-size="16" font-weight="900" font-family="serif">XII</text>
        <text x="${c.x + 80}" y="${c.y + 6}" text-anchor="middle" fill="#bae6fd" font-size="16" font-weight="900" font-family="serif">III</text>
        <text x="${c.x}" y="${c.y + 86}" text-anchor="middle" fill="#bae6fd" font-size="16" font-weight="900" font-family="serif">VI</text>
        <text x="${c.x - 80}" y="${c.y + 6}" text-anchor="middle" fill="#bae6fd" font-size="16" font-weight="900" font-family="serif">IX</text>
        <line id="chrono-hour-hand" x1="${c.x}" y1="${c.y}" x2="${c.x}" y2="${c.y - 45}" stroke="#ffffff" stroke-width="4" stroke-linecap="round" />
        <line id="chrono-minute-hand" x1="${c.x}" y1="${c.y}" x2="${c.x}" y2="${c.y - 70}" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round" />
        <circle cx="${c.x}" cy="${c.y}" r="6" fill="#ffffff" />
      </g>
    `;
    L.moment.appendChild(svg);

    const hourHand = svg.querySelector('#chrono-hour-hand');
    const minHand = svg.querySelector('#chrono-minute-hand');

    // 3. Floating Chrono-Badges on Rivals
    const badges = [];
    victimEls.forEach(el => {
      const vCoord = relRect(el, L.moment);
      const badge = document.createElement('div');
      badge.className = 'fx-chrono-badge';
      badge.innerHTML = `⏳ REVERSED!<br><small style="font-size:10px;">HOTELS REGRESSED</small>`;
      badge.style.left = `${vCoord.x}px`;
      badge.style.top = `${vCoord.y - 32}px`;
      L.moment.appendChild(badge);
      requestAnimationFrame(() => {
        badge.style.transform = 'translate(-50%, -50%) scale(1.1)';
      });
      badges.push(badge);
    });

    const startTime = performance.now();
    const duration = T(950);

    try {
      while (performance.now() - startTime < duration) {
        const elapsed = performance.now() - startTime;
        const minAngle = -(elapsed * 0.95);
        const hourAngle = -(elapsed * 0.15);
        if (minHand) minHand.setAttribute('transform', `rotate(${minAngle}, ${c.x}, ${c.y})`);
        if (hourHand) hourHand.setAttribute('transform', `rotate(${hourAngle}, ${c.x}, ${c.y})`);

        if (Math.random() < 0.3) {
          burst({ x: c.x + (Math.random() - 0.5) * 160, y: c.y + (Math.random() - 0.5) * 160, name: 'sparkle', count: 4, spread: 50, up: 20, life: 400, size: 12 });
        }
        await sleep(35);
      }
    } finally {
      svg.remove();
      badges.forEach(b => {
        b.style.opacity = '0';
        b.style.transform = 'translate(-50%, -70%) scale(0.7)';
        setTimeout(() => b.remove(), 350);
      });
      if (casterEl) casterEl.classList.remove('fx-token-clockwork-charge');
      victimEls.forEach(el => el.classList.remove('fx-temporal-stasis'));
    }

    // 4. Detonation Shockwave & Banner
    sfx('playBoom');
    flash('rgba(56, 189, 248, 0.7)', 450);
    shake('heavy');

    ring(c.x, c.y, 160, '#38bdf8', 600);
    ring(c.x, c.y, 280, '#818cf8', 850);
    ring(c.x, c.y, 400, '#ffffff', 1100);

    burst({ x: c.x, y: c.y, name: 'sparkle', count: 30, spread: 280, up: 180, life: 1200, size: 22 });

    const b = banner('⏳ THE CHRONO-MIDNIGHT PARADOX! 👠', 'TIME REVERSED COUNTER-CLOCKWISE FOR 2 ROUNDS · RIVAL HOTELS REGRESSED!', 'cyan', 1700);
    await sleep(T(1200));
    await b;
  }

  /**
   * 🌹 S7 Mythic: THE BREAKING OF THE ENCHANTED ROSE CURSE
   * 4-Phase Cinematic Sequence:
   * 1. Gothic enchanted ballroom vignette & enchanted rose cloche emergence.
   * 2. Slow-motion falling 4th rose petal + Beast transfigured into Prince Adam.
   * 3. Board-wide radiant acquisition wave: claims ALL vacant unowned properties simultaneously for free!
   * 4. Detonation waltz bloom, triple rings & royal rose banner.
   */
  async function breakingTheCurse(d = {}) {
    if (!refs()) return;
    const casterRole = d.casterRole || d.role || 'bkk';
    const casterEl = tok.el[casterRole] || $(`${casterRole}Token`);
    const fromP = casterEl ? relRect(casterEl, L.moment) : (point({ token: casterRole }) || center());
    const c = center();

    // 1. Audio & Pre-charge
    sfx('playEnchantedRoseWaltz');
    flash('rgba(236, 72, 153, 0.60)', 350);
    shake('light');
    vignette(3, 'rose-curse');

    if (casterEl) casterEl.classList.add('fx-token-beast-transfigure');

    // 2. High-Res 3D Enchanted Rose Cloche Prop & Stained-Glass Halo
    const clocheWrap = document.createElement('div');
    clocheWrap.className = 'fx-enchanted-rose-cloche-wrap';
    clocheWrap.style.left = `${c.x}px`;
    clocheWrap.style.top = `${c.y}px`;
    clocheWrap.innerHTML = `
      <div class="fx-cloche-halo-ring"></div>
      <img src="assets/s7/enchanted_rose_cloche.png?v=20261012v5" class="fx-enchanted-rose-cloche-img" alt="Enchanted Rose Cloche" />
    `;
    L.moment.appendChild(clocheWrap);

    // 3. Beast Hotel Demolition, Castle Upgrades & Shock Badges
    const smashedTile = d.smashedHotelTile != null ? d.smashedHotelTile : null;
    const upgradedTiles = d.upgradedTiles || [];
    const shockDmg = d.shockDamage || 180;
    const badges = [];

    // Hotel Demolition FX on smashed rival property
    if (smashedTile != null) {
      const sCoord = point({ tileId: smashedTile });
      if (sCoord) {
        ring(sCoord.x, sCoord.y, 130, '#ef4444', 800);
        burst({ x: sCoord.x, y: sCoord.y, name: 'sparkle', count: 18, spread: 100, up: 60, gravity: 120, life: 800, size: 16 });
        const smashBadge = document.createElement('div');
        smashBadge.className = 'fx-rose-turret-badge';
        smashBadge.style.background = 'linear-gradient(135deg, rgba(239,68,68,0.95), rgba(185,28,28,0.95))';
        smashBadge.style.borderColor = '#fca5a5';
        smashBadge.innerHTML = `🦁 BEAST SMASH!<br><small style="font-size:10px;">HOTEL DEMOLISHED -1 LVL!</small>`;
        smashBadge.style.left = `${sCoord.x}px`;
        smashBadge.style.top = `${sCoord.y - 32}px`;
        L.moment.appendChild(smashBadge);
        badges.push(smashBadge);
      }
    }

    // Castle Upgrade FX on player's upgraded properties
    upgradedTiles.forEach(tid => {
      const uCoord = point({ tileId: tid });
      if (uCoord) {
        ring(uCoord.x, uCoord.y, 110, '#fde047', 750);
        ring(uCoord.x, uCoord.y, 160, '#ec4899', 900);
        burst({ x: uCoord.x, y: uCoord.y, name: 'gem', count: 12, spread: 80, up: 50, life: 700, size: 16 });
        const upBadge = document.createElement('div');
        upBadge.className = 'fx-rose-turret-badge';
        upBadge.innerHTML = `🏰 CASTLE ASCENDANCE!<br><small style="font-size:10px;">+1 LEVEL & ROSE TURRET!</small>`;
        upBadge.style.left = `${uCoord.x}px`;
        upBadge.style.top = `${uCoord.y - 32}px`;
        L.moment.appendChild(upBadge);
        badges.push(upBadge);
      }
    });

    // Shock damage badge on rival token
    if (d.rivalRole) {
      const rivalEl = tok.el[d.rivalRole] || $(`${d.rivalRole}Token`);
      const rivalP = rivalEl ? relRect(rivalEl, L.moment) : point({ token: d.rivalRole });
      if (rivalP) {
        const shockBadge = document.createElement('div');
        shockBadge.className = 'fx-rose-turret-badge';
        shockBadge.style.background = 'linear-gradient(135deg, rgba(220,38,38,0.92), rgba(153,27,27,0.92))';
        shockBadge.innerHTML = `🦁 BEAST ROAR!<br><small style="font-size:11px;">-${shockDmg}🪙 SHOCK DAMAGE!</small>`;
        shockBadge.style.left = `${rivalP.x}px`;
        shockBadge.style.top = `${rivalP.y - 36}px`;
        L.moment.appendChild(shockBadge);
        badges.push(shockBadge);
        if (rivalEl) {
          rivalEl.classList.add('fx-token-spasm');
          setTimeout(() => rivalEl.classList.remove('fx-token-spasm'), 1200);
        }
      }
    }

    const badge = document.createElement('div');
    badge.className = 'fx-rose-turret-badge';
    badge.innerHTML = `🦁 BEAST RAMPAGE & RESTORATION! 🌹<br><small style="font-size:10px;">${smashedTile != null ? 'RIVAL HOTEL SMASHED · ' : ''}${upgradedTiles.length} CASTLES UPGRADED · +30% TURRETS!</small>`;
    badge.style.left = `${fromP.x}px`;
    badge.style.top = `${fromP.y - 36}px`;
    L.moment.appendChild(badge);
    requestAnimationFrame(() => {
      badge.style.transform = 'translate(-50%, -50%) scale(1.15)';
    });
    badges.push(badge);

    const startTime = performance.now();
    const duration = T(1100);

    try {
      while (performance.now() - startTime < duration) {
        if (Math.random() < 0.45) {
          burst({ x: c.x + (Math.random() - 0.5) * 120, y: c.y + (Math.random() - 0.5) * 120, name: 'gem', count: 3, spread: 45, up: 20, life: 450, size: 14 });
          burst({ x: c.x + (Math.random() - 0.5) * 100, y: c.y + (Math.random() - 0.5) * 100, name: 'sparkle', count: 4, spread: 60, up: 30, gravity: 50, life: 500, size: 12 });
        }
        await sleep(35);
      }
    } finally {
      if (clocheWrap) clocheWrap.remove();
      badges.forEach(b => {
        b.style.opacity = '0';
        b.style.transform = 'translate(-50%, -70%) scale(0.7)';
        setTimeout(() => b.remove(), 350);
      });
      if (casterEl) casterEl.classList.remove('fx-token-beast-transfigure');
    }

    // 4. Royal Restoration Chime & Rose Bloom Banner (no bomb or harsh boom)
    sfx('playCurseBreakChime');
    flash('rgba(236, 72, 153, 0.55)', 380);
    shake('light');

    ring(c.x, c.y, 160, '#ec4899', 600);
    ring(c.x, c.y, 280, '#fde047', 850);
    ring(c.x, c.y, 420, '#ffffff', 1100);

    burst({ x: fromP.x, y: fromP.y, name: 'gem', count: 28, spread: 270, up: 180, life: 1200, size: 22 });

    const smashBannerText = smashedTile != null ? 'HOTEL DEMOLISHED · ' : '';
    const upBannerText = upgradedTiles.length > 0 ? `${upgradedTiles.length} CASTLES UPGRADED · ` : '';
    const b = banner('🦁 BEAST RAMPAGE & ROSE RESTORATION! 👑', `${smashBannerText}${upBannerText}-${shockDmg}🪙 SHOCK · +30% TURRETS!`, 'pink', 2000);
    await sleep(T(1200));
    await b;
  }

  /**
   * ❄️ S8 Mythic: ABSOLUTE ZERO: CRYO-STASIS
   * 4-Phase Cinematic Sequence:
   * 1. Subzero blizzard atmospheric shift: Deep ice vignette, flash, tremor & caster pre-charge.
   * 2. Procedural Glacial Ice Fissures branching across the board from caster to target with SVG plasma glow & snowflake runes.
   * 3. Target token encased in 3D translucent ice cube block (.fx-token-frozen-block), shivering animation,
   *    floating [❄️ CRYO-STASIS! 🧊] badge (-150🪙 DEFROST / SKIP TURN), frost & stardust siphon conduits.
   * 4. Detonation shockwaves (triple cyan, frost white, and blizzard blue rings), core frost burst,
   *    and high-prestige Glacial Empress / Blizzard Warden banner.
   */
  /**
   * ❄️ S8 Mythic Ultimate: Absolute Zero — Rise of the Glacial Citadel
   * 1. Atmospheric shift: screen flash, subzero vignette, Starlight Scepter eruption
   * 2. Multi-target procedural branching ice fissures connecting to ALL rivals & Citadel tile
   * 3. ALL rivals encased in 3D translucent ice blocks (.fx-token-frozen-block) + multi-coin siphon
   * 4. Erection of the 3D Glacial Ice Citadel on target tile with ascending aura & beacon
   * 5. Detonation shockwaves, frost crest burst, and high-prestige Glacial Empress banner.
   */
  async function absoluteZero(d = {}) {
    if (!refs()) return;
    const casterRole = d.casterRole || d.role || 'dxb';
    const casterEl = tok.el[casterRole] || $(`${casterRole}Token`);
    const fromP = casterEl ? relRect(casterEl, L.moment) : (point({ token: casterRole }) || center());
    const c = center();

    // 1. Resolve all victim tokens
    const victimSiphons = Array.isArray(d.victimSiphons) && d.victimSiphons.length > 0
      ? d.victimSiphons
      : Object.keys(tok.el).filter(r => r !== casterRole).map(r => ({ role: r, amount: 150 }));

    const victimEntries = victimSiphons.map(v => {
      const el = tok.el[v.role] || $(`${v.role}Token`);
      const p = el ? relRect(el, L.moment) : point({ token: v.role });
      return { role: v.role, el, p, amount: v.amount || 150 };
    }).filter(ve => ve.p);

    const citadelTile = d.citadelTile != null ? d.citadelTile : 0;
    const citP = point({ tileId: citadelTile }) || center();
    const totalSiphoned = d.totalSiphoned != null ? d.totalSiphoned : victimEntries.reduce((sum, v) => sum + v.amount, 0);

    // Phase 1: Atmospheric Shift & Starlight Scepter Summon
    sfx('playCryoNova');
    flash('rgba(56, 189, 248, 0.88)', 400);
    shake('heavy');
    vignette(5.0, 'cryo-stasis');

    if (window.SkyPixi && window.SkyPixi.isReady) {
      window.SkyPixi.ultimates.absoluteZero({ targetP: citP });
    }

    if (casterEl) {
      casterEl.classList.add('fx-token-glacial-charge');
      casterEl.classList.add('token-frost-dragon-wings');
    }

    const scepter = spawn('starlight_ice_scepter', fromP.x, fromP.y - 45, 100, 'fx-glow-cyan');
    scepter.animate([
      { transform: at(fromP.x, fromP.y - 45, 'scale(0.2) rotate(-35deg)'), opacity: 0 },
      { transform: at(fromP.x, fromP.y - 45, 'scale(1.35) rotate(0deg)'), opacity: 1, offset: 0.35 },
      { transform: at(fromP.x, fromP.y - 45, 'scale(1.15) rotate(15deg)'), opacity: 0.95, offset: 0.75 },
      { transform: at(fromP.x, fromP.y - 45, 'scale(0.3) rotate(45deg)'), opacity: 0 }
    ], { duration: T(1500), fill: 'forwards' });

    // Phase 2: Procedural Glacial Ice Fissure SVG Layer (Branching to all victims + Citadel)
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'fx-mythic-overlay-svg fx-glow-cyan');
    svg.setAttribute('viewBox', `0 0 ${L.moment.clientWidth || 800} ${L.moment.clientHeight || 800}`);
    svg.innerHTML = `
      <defs>
        <filter id="frost-plasma-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="3" result="blur1" />
          <feGaussianBlur stdDeviation="8" result="blur2" />
          <feMerge>
            <feMergeNode in="blur2" />
            <feMergeNode in="blur1" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id="frost-ice-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#ffffff" />
          <stop offset="30%" stop-color="#e0f2fe" />
          <stop offset="65%" stop-color="#38bdf8" />
          <stop offset="100%" stop-color="#0284c7" />
        </linearGradient>
      </defs>
    `;
    L.moment.appendChild(svg);

    function generateFissurePath(x1, y1, x2, y2, segments = 12, maxOffset = 24) {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const nx = -dy / dist;
      const ny = dx / dist;
      const pts = [`${x1.toFixed(1)},${y1.toFixed(1)}`];
      const branches = [];

      for (let i = 1; i < segments; i++) {
        const t = i / segments;
        const envelope = Math.sin(t * Math.PI);
        const jitter = (Math.random() - 0.5) * 2 * maxOffset * envelope;
        const px = x1 + dx * t + nx * jitter;
        const py = y1 + dy * t + ny * jitter;
        pts.push(`${px.toFixed(1)},${py.toFixed(1)}`);

        if (Math.random() < 0.4 && envelope > 0.3) {
          const bAngle = Math.atan2(dy, dx) + (Math.random() < 0.5 ? 0.75 : -0.75);
          const bLen = (20 + Math.random() * 35) * envelope;
          const bx2 = px + Math.cos(bAngle) * bLen;
          const by2 = py + Math.sin(bAngle) * bLen;
          branches.push(`${px.toFixed(1)},${py.toFixed(1)} ${bx2.toFixed(1)},${by2.toFixed(1)}`);
        }
      }
      pts.push(`${x2.toFixed(1)},${y2.toFixed(1)}`);
      return { trunk: pts.join(' '), branches };
    }

    const gFissures = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    gFissures.setAttribute('filter', 'url(#frost-plasma-glow)');
    svg.appendChild(gFissures);

    // Phase 3: Encase ALL victims in 3D Translucent Ice Blocks & Siphon Coins
    victimEntries.forEach(ve => {
      if (ve.el) ve.el.classList.add('fx-token-frozen-block');
    });

    const badges = [];
    victimEntries.forEach(ve => {
      const badge = document.createElement('div');
      badge.className = 'fx-cryo-stasis-badge';
      badge.innerHTML = `❄️ CRYO-STASIS! 🧊<br><small style="font-size:10px;opacity:0.95;">-${ve.amount}🪙 TRIBUTE · ROLL 1-3</small>`;
      const safeVx = Math.max(65, Math.min(((L.moment && L.moment.clientWidth) || 360) - 65, ve.p.x));
      const safeVy = Math.max(30, Math.min(((L.moment && L.moment.clientHeight) || 600) - 30, ve.p.y - 36));
      badge.style.left = `${safeVx}px`;
      badge.style.top = `${safeVy}px`;
      L.moment.appendChild(badge);
      badges.push(badge);

      // Stolen frost coin streams
      coins({ from: { x: ve.p.x, y: ve.p.y }, to: { x: fromP.x, y: fromP.y }, amount: ve.amount });
      burst({ x: ve.p.x, y: ve.p.y, name: 'cryo_shatter_crystal', count: 8, spread: 90, up: 50, life: 700, size: 16 });
      burst({ x: ve.p.x, y: ve.p.y, name: 'gem', count: 8, spread: 80, up: 40, life: 600, size: 14 });
    });

    // Phase 4: Erection of the 3D Glacial Ice Citadel (clamped safely within viewport)
    const citAnchor = safeMonumentAnchor(citP, 20);
    const citadelWrap = document.createElement('div');
    citadelWrap.className = 'fx-citadel-rising-wrap';
    citadelWrap.innerHTML = `
      <div class="fx-citadel-beacon"></div>
      <img src="assets/s8/glacial_citadel.png" class="fx-citadel-hero-img" alt="Citadel" />
      <div class="fx-citadel-frost-crown">❄️👑❄️</div>
    `;
    citadelWrap.style.left = `${citAnchor.modelX}px`;
    citadelWrap.style.top = `${citAnchor.modelY}px`;
    L.moment.appendChild(citadelWrap);

    citadelWrap.animate([
      { transform: 'translate(-50%, -50%) scale(0.2) translateY(50px)', opacity: 0 },
      { transform: 'translate(-50%, -50%) scale(1.18) translateY(-8px)', opacity: 1, offset: 0.4 },
      { transform: 'translate(-50%, -50%) scale(1.0) translateY(-2px)', opacity: 0.98, offset: 0.75 },
      { transform: 'translate(-50%, -50%) scale(1.06) translateY(-4px)', opacity: 1 }
    ], { duration: T(1500), fill: 'forwards' });

    const citBadge = document.createElement('div');
    citBadge.className = 'fx-citadel-erected-badge';
    citBadge.innerHTML = `🏰 GLACIAL ICE CITADEL! 👑<br><small style="font-size:10px;opacity:0.95;">±1 TILE FROST AURA · 2× RENT</small>`;
    citBadge.style.left = `${citAnchor.badgeX}px`;
    citBadge.style.top = `${citAnchor.badgeY}px`;
    L.moment.appendChild(citBadge);
    badges.push(citBadge);

    ring(citAnchor.modelX, citAnchor.modelY, 140, '#38bdf8', 600);
    ring(citAnchor.modelX, citAnchor.modelY, 220, '#bae6fd', 850);

    const startTime = performance.now();
    const duration = T(950);

    try {
      while (performance.now() - startTime < duration) {
        let html = '';
        // Multi-target fissures to all victims
        victimEntries.forEach(ve => {
          const f = generateFissurePath(fromP.x, fromP.y, ve.p.x, ve.p.y, 12, 22);
          html += `
            <polyline points="${f.trunk}" fill="none" stroke="#38bdf8" stroke-width="6" stroke-linecap="round" opacity="0.75" />
            <polyline points="${f.trunk}" fill="none" stroke="url(#frost-ice-grad)" stroke-width="3" stroke-linecap="round" />
            <polyline points="${f.trunk}" fill="none" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" />
          `;
          f.branches.forEach(bPts => {
            html += `<polyline points="${bPts}" fill="none" stroke="#e0f2fe" stroke-width="1.8" stroke-linecap="round" opacity="0.85" />`;
          });
        });

        // Fissure to Citadel tile
        const fCit = generateFissurePath(fromP.x, fromP.y, citAnchor.modelX, citAnchor.modelY, 14, 26);
        html += `
          <polyline points="${fCit.trunk}" fill="none" stroke="#0284c7" stroke-width="7" stroke-linecap="round" opacity="0.85" />
          <polyline points="${fCit.trunk}" fill="none" stroke="#38bdf8" stroke-width="4" stroke-linecap="round" />
          <polyline points="${fCit.trunk}" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" />
        `;
        fCit.branches.forEach(bPts => {
          html += `<polyline points="${bPts}" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" opacity="0.9" />`;
        });

        gFissures.innerHTML = html;
        await sleep(40);
      }
    } finally {
      svg.remove();
      scepter.remove();
      setTimeout(() => citadelWrap.remove(), T(1800));
      badges.forEach(b => {
        b.style.opacity = '0';
        b.style.transform = 'translate(-50%, -70%) scale(0.7)';
        setTimeout(() => b.remove(), 400);
      });
      if (casterEl) casterEl.classList.remove('fx-token-glacial-charge');
      victimEntries.forEach(ve => {
        if (ve.el) {
          setTimeout(() => ve.el.classList.remove('fx-token-frozen-block'), 1400);
        }
      });
    }

    // Phase 5: Detonation Shockwave Rings, Frost Crest & Heroic Banner
    sfx('playBoom');
    sfx('playGlacialImpact');
    flash('rgba(224, 242, 254, 0.95)', 440);
    shake('heavy');

    const crest = spawn('glacial_frost_crest', fromP.x, fromP.y, 170, 'fx-glow-cyan');
    crest.animate([
      { transform: at(fromP.x, fromP.y, 'scale(0.3) rotate(-60deg)'), opacity: 0 },
      { transform: at(fromP.x, fromP.y, 'scale(1.5) rotate(0deg)'), opacity: 1, offset: 0.35 },
      { transform: at(fromP.x, fromP.y, 'scale(1.2) rotate(60deg)'), opacity: 0.95, offset: 0.75 },
      { transform: at(fromP.x, fromP.y, 'scale(2.2) rotate(120deg)'), opacity: 0 }
    ], { duration: T(1500), fill: 'forwards' });

    ring(fromP.x, fromP.y, 170, '#38bdf8', 650);
    ring(fromP.x, fromP.y, 290, '#f0f8ff', 900);
    ring(fromP.x, fromP.y, 440, '#0284c7', 1150);

    burst({ x: fromP.x, y: fromP.y, name: 'glacial_frost_crest', count: 6, spread: 260, up: 180, life: 1100, size: 28 });
    burst({ x: fromP.x, y: fromP.y, name: 'cryo_shatter_crystal', count: 20, spread: 250, up: 170, life: 1050, size: 20 });
    burst({ x: fromP.x, y: fromP.y, name: 'sparkle', count: 32, spread: 300, up: 190, life: 1250, size: 22 });
    burst({ x: fromP.x, y: fromP.y, name: 'gem', count: 18, spread: 230, up: 150, life: 980, size: 18 });

    const b = banner('❄️ ABSOLUTE ZERO: GLACIAL CITADEL! 👑', `GLOBAL FLASH FREEZE · +${totalSiphoned}🪙 TRIBUTE · 3D CITADEL RAISED!`, 'cyan', 2400);
    await sleep(T(1400));
    crest.remove();
    await b;
  }

  /**
   * 🏺 S9 Mythic Ultimate: Nile Seduction & Great Golden Pyramid
   * 1. Golden lotus ankh scepter summon above Cleopatra/Ramses + Scarab Wings
   * 2. Sandstorm & Nile solar rays branching to all victims and the Golden Pyramid
   * 3. Siphoning royal extortion gold coins from all rivals + item incineration smoke
   * 4. Erection of the 3D Great Golden Pyramid with glowing golden capstone
   * 5. Imperial solar detonation, golden scarab aura, and high-prestige banner.
   */
  async function nileSeduction(d = {}) {
    if (!refs()) return;
    const casterRole = d.casterRole || d.role || 'dxb';
    const casterEl = tok.el[casterRole] || $(`${casterRole}Token`);
    const fromP = casterEl ? relRect(casterEl, L.moment) : (point({ token: casterRole }) || center());
    const c = center();

    const victimExtortions = Array.isArray(d.victimExtortions) && d.victimExtortions.length > 0
      ? d.victimExtortions
      : Object.keys(tok.el).filter(r => r !== casterRole).map(r => ({ role: r, amount: 150 }));

    const victimEntries = victimExtortions.map(v => {
      const el = tok.el[v.role] || $(`${v.role}Token`);
      const p = el ? relRect(el, L.moment) : point({ token: v.role });
      return { role: v.role, el, p, amount: v.amount || 150 };
    }).filter(ve => ve.p);

    const pyramidTile = d.pyramidTile != null ? d.pyramidTile : 0;
    const pyrP = point({ tileId: pyramidTile }) || center();
    const extortedMiles = d.extortedMiles != null ? d.extortedMiles : victimEntries.reduce((sum, v) => sum + v.amount, 0);

    // Phase 1: Theatrical Summon & Atmospheric Shift
    sfx('playSolarHarp');
    flash('rgba(251, 191, 36, 0.85)', 400);
    shake('heavy');
    vignette(4.5, 'solar-flare');

    if (window.SkyPixi && window.SkyPixi.isReady) {
      window.SkyPixi.ultimates.nileSeduction({ targetP: pyrP });
    }

    if (casterEl) {
      casterEl.classList.add('token-gilded-scarab-wings');
    }

    // Phase 2: Procedural Solar Golden Rays & Hieroglyph SVG Layer
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'fx-mythic-overlay-svg fx-glow-gold');
    svg.setAttribute('viewBox', `0 0 ${L.moment.clientWidth || 800} ${L.moment.clientHeight || 800}`);
    svg.innerHTML = `
      <defs>
        <linearGradient id="nile-gold-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#ffffff" />
          <stop offset="35%" stop-color="#fde047" />
          <stop offset="70%" stop-color="#fbbf24" />
          <stop offset="100%" stop-color="#d97706" />
        </linearGradient>
      </defs>
      <g id="fxNileRays"></g>
    `;
    L.moment.appendChild(svg);
    const gRays = svg.querySelector('#fxNileRays');

    // 3D Golden Pyramid Rising on Target Tile (clamped safely within viewport)
    const pyrAnchor = safeMonumentAnchor(pyrP, 20);
    const pyrWrap = document.createElement('div');
    pyrWrap.className = 'fx-pyramid-rising-wrap';
    pyrWrap.style.left = `${pyrAnchor.modelX}px`;
    pyrWrap.style.top = `${pyrAnchor.modelY}px`;
    pyrWrap.innerHTML = `
      <div class="fx-pyramid-beacon"></div>
      <div class="fx-pyramid-capstone-glow">✨🏛️✨</div>
      <img src="assets/s9/golden_pyramid.png" class="fx-pyramid-hero-img" alt="Great Golden Pyramid" />
    `;
    L.moment.appendChild(pyrWrap);

    pyrWrap.animate([
      { transform: 'translate(-50%, -50%) scale(0.2) translateY(50px)', opacity: 0 },
      { transform: 'translate(-50%, -50%) scale(1.18) translateY(-8px)', opacity: 1, offset: 0.4 },
      { transform: 'translate(-50%, -50%) scale(1.0) translateY(-2px)', opacity: 0.98, offset: 0.75 },
      { transform: 'translate(-50%, -50%) scale(1.06) translateY(-4px)', opacity: 1 }
    ], { duration: T(1500), fill: 'forwards' });

    const pyrBadge = document.createElement('div');
    pyrBadge.className = 'fx-pyramid-erected-badge';
    pyrBadge.innerHTML = `🏛️ GREAT GOLDEN PYRAMID! 👑<br><small style="font-size:10px;opacity:0.95;">±1 TILE SOLAR AURA · 2× RENT</small>`;
    pyrBadge.style.left = `${pyrAnchor.badgeX}px`;
    pyrBadge.style.top = `${pyrAnchor.badgeY}px`;
    L.moment.appendChild(pyrBadge);

    const badges = [pyrBadge];
    try {
      // Golden Rays connecting caster to victims & pyramid
      let rayHtml = '';
      victimEntries.forEach(ve => {
        rayHtml += `<line x1="${fromP.x}" y1="${fromP.y}" x2="${ve.p.x}" y2="${ve.p.y}" stroke="url(#nile-gold-grad)" stroke-width="4" stroke-linecap="round" opacity="0.9" />`;
      });
      rayHtml += `<line x1="${fromP.x}" y1="${fromP.y}" x2="${pyrAnchor.modelX}" y2="${pyrAnchor.modelY}" stroke="url(#nile-gold-grad)" stroke-width="6" stroke-linecap="round" opacity="0.95" />`;
      if (gRays) gRays.innerHTML = rayHtml;

      // Phase 3: Coin Extortion Flow & Victim Shock
      victimEntries.forEach(ve => {
        ring(ve.p.x, ve.p.y, 110, '#fbbf24', 600);
        burst({ x: ve.p.x, y: ve.p.y, name: 'sparkle', count: 16, spread: 130, up: 80, life: 750, size: 16 });
        coins({ from: { role: ve.role }, to: { role: casterRole }, amount: ve.amount });

        const badge = document.createElement('div');
        badge.className = 'fx-damage-badge';
        const safeVx = Math.max(65, Math.min(((L.moment && L.moment.clientWidth) || 360) - 65, ve.p.x));
        const safeVy = Math.max(25, Math.min(((L.moment && L.moment.clientHeight) || 600) - 25, ve.p.y - 25));
        badge.style.left = `${safeVx}px`;
        badge.style.top = `${safeVy}px`;
        badge.style.borderColor = '#fbbf24';
        badge.style.color = '#fbbf24';
        badge.innerHTML = `🏺 -${ve.amount}🪙 EXTORTION`;
        L.moment.appendChild(badge);
        badges.push(badge);
      });

      ring(pyrAnchor.modelX, pyrAnchor.modelY, 140, '#ffd700', 800);
      burst({ x: pyrAnchor.modelX, y: pyrAnchor.modelY, name: 'sparkle', count: 24, spread: 220, up: 140, life: 1000, size: 20 });
      await sleep(T(900));
    } finally {
      svg.remove();
      setTimeout(() => pyrWrap.remove(), T(1800));
      badges.forEach(b => {
        b.style.opacity = '0';
        b.style.transform = 'translate(-50%, -70%) scale(0.7)';
        setTimeout(() => b.remove(), 400);
      });
    }

    // Phase 4: Detonation Shockwave Rings & Heroic Banner
    sfx('playBoom');
    if (AudioFX.playSolarImpact) AudioFX.playSolarImpact();
    flash('rgba(254, 240, 138, 0.95)', 400);
    shake('heavy');

    ring(fromP.x, fromP.y, 180, '#fbbf24', 700);
    ring(fromP.x, fromP.y, 300, '#f59e0b', 950);
    ring(fromP.x, fromP.y, 450, '#ffd700', 1200);

    burst({ x: fromP.x, y: fromP.y, name: 'coin', count: 20, spread: 260, up: 190, life: 1200, size: 22 });
    burst({ x: fromP.x, y: fromP.y, name: 'sparkle', count: 32, spread: 300, up: 200, life: 1250, size: 22 });

    const b = banner('🏺 NILE SEDUCTION & GOLDEN PYRAMID! 👑', `MIRAGE INCINERATION · +${extortedMiles}🪙 EXTORTION · GREAT PYRAMID ERECTED!`, 'gold', 2400);
    await sleep(T(1400));
    await b;
  }

  /**
   * ☀️ S9 Mythic Ultimate: Solar Wrath & Eye of Ra
   * 1. Sun God Ra / Sekhmet manifests Solar Falcon Wings & blazing Eye of Ra
   * 2. Cataclysmic solar ray strikes all rivals and strips levels from rival properties
   * 3. Siphoning scorched tribute coins + fire explosions
   * 4. Multi-ring solar shockwaves and grand banner.
   */
  async function solarWrath(d = {}) {
    if (!refs()) return;
    const casterRole = d.casterRole || d.role || 'bkk';
    const casterEl = tok.el[casterRole] || $(`${casterRole}Token`);
    const fromP = casterEl ? relRect(casterEl, L.moment) : (point({ token: casterRole }) || center());
    const c = center();

    const victimScorches = Array.isArray(d.victimScorches) && d.victimScorches.length > 0
      ? d.victimScorches
      : Object.keys(tok.el).filter(r => r !== casterRole).map(r => ({ role: r, amount: 120 }));

    const victimEntries = victimScorches.map(v => {
      const el = tok.el[v.role] || $(`${v.role}Token`);
      const p = el ? relRect(el, L.moment) : point({ token: v.role });
      return { role: v.role, el, p, amount: v.amount || 120 };
    }).filter(ve => ve.p);

    const downgradedTiles = Array.isArray(d.downgradedTiles) ? d.downgradedTiles : [];
    const scorchedMiles = d.scorchedMiles != null ? d.scorchedMiles : victimEntries.reduce((sum, v) => sum + v.amount, 0);

    // Phase 1: Theatrical Summon & Atmospheric Shift
    sfx('playSolarWrathRay');
    flash('rgba(255, 69, 0, 0.88)', 400);
    shake('heavy');
    vignette(5.0, 'solar-flare');

    if (window.SkyPixi && window.SkyPixi.isReady) {
      window.SkyPixi.ultimates.solarWrath({ targetP: c });
    }

    if (casterEl) {
      casterEl.classList.add('token-solar-falcon-wings');
    }

    // Phase 2: Procedural Solar Wrath Lightning / Rays SVG
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'fx-mythic-overlay-svg fx-glow-gold');
    svg.setAttribute('viewBox', `0 0 ${L.moment.clientWidth || 800} ${L.moment.clientHeight || 800}`);
    svg.innerHTML = `
      <defs>
        <linearGradient id="solar-ray-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#ffffff" />
          <stop offset="30%" stop-color="#fde047" />
          <stop offset="65%" stop-color="#fbbf24" />
          <stop offset="100%" stop-color="#ff4500" />
        </linearGradient>
      </defs>
      <g id="fxSolarRays"></g>
    `;
    L.moment.appendChild(svg);
    const gRays = svg.querySelector('#fxSolarRays');

    const badges = [];
    try {
      let rayHtml = '';
      victimEntries.forEach(ve => {
        rayHtml += `<line x1="${fromP.x}" y1="${fromP.y}" x2="${ve.p.x}" y2="${ve.p.y}" stroke="url(#solar-ray-grad)" stroke-width="5" stroke-linecap="round" opacity="0.95" />`;
      });
      downgradedTiles.forEach(tid => {
        const tp = point({ tileId: tid }) || center();
        rayHtml += `<line x1="${fromP.x}" y1="${fromP.y}" x2="${tp.x}" y2="${tp.y}" stroke="url(#solar-ray-grad)" stroke-width="4" stroke-linecap="round" opacity="0.9" />`;
      });
      if (gRays) gRays.innerHTML = rayHtml;

      // Phase 3: Scorch Badges & Explosions
      victimEntries.forEach(ve => {
        ring(ve.p.x, ve.p.y, 120, '#ff4500', 650);
        burst({ x: ve.p.x, y: ve.p.y, name: 'fire', count: 18, spread: 140, up: 90, life: 750, size: 18 });
        coins({ from: { role: ve.role }, to: { role: casterRole }, amount: ve.amount });

        const badge = document.createElement('div');
        badge.className = 'fx-damage-badge';
        const safeVx = Math.max(65, Math.min(((L.moment && L.moment.clientWidth) || 360) - 65, ve.p.x));
        const safeVy = Math.max(25, Math.min(((L.moment && L.moment.clientHeight) || 600) - 25, ve.p.y - 25));
        badge.style.left = `${safeVx}px`;
        badge.style.top = `${safeVy}px`;
        badge.style.borderColor = '#ff4500';
        badge.style.color = '#ff4500';
        badge.innerHTML = `🔥 -${ve.amount}🪙 SCORCHED`;
        L.moment.appendChild(badge);
        badges.push(badge);
      });

      downgradedTiles.forEach(tid => {
        const tp = point({ tileId: tid }) || center();
        ring(tp.x, tp.y, 100, '#ff4500', 600);
        burst({ x: tp.x, y: tp.y, name: 'fire', count: 14, spread: 110, up: 70, life: 650, size: 16 });
      });

      await sleep(T(900));
    } finally {
      svg.remove();
      badges.forEach(b => {
        b.style.opacity = '0';
        b.style.transform = 'translate(-50%, -70%) scale(0.7)';
        setTimeout(() => b.remove(), 400);
      });
    }

    // Phase 4: Solar Detonation & Heroic Banner
    sfx('playBoom');
    flash('rgba(255, 69, 0, 0.92)', 420);
    shake('heavy');

    ring(fromP.x, fromP.y, 190, '#ff4500', 700);
    ring(fromP.x, fromP.y, 320, '#fbbf24', 950);
    ring(fromP.x, fromP.y, 480, '#ea580c', 1200);

    burst({ x: fromP.x, y: fromP.y, name: 'fire', count: 28, spread: 290, up: 190, life: 1200, size: 22 });
    burst({ x: fromP.x, y: fromP.y, name: 'sparkle', count: 30, spread: 310, up: 200, life: 1250, size: 22 });

    const b = banner('☀️ EYE OF RA: SOLAR WRATH! 🔥', `BLAZING SOLAR STRIKE · +${scorchedMiles}🪙 SCORCHED · RIVAL TOWERS STRIPPED!`, 'gold', 2400);
    await sleep(T(1400));
    await b;
  }

  /**
   * 🎭 S10 Mythic Ultimate: Phantom Masquerade: The Grand Curtain Call
   * 1. Pipe organ chord, deep crimson/obsidian vignette, camera tremor & falling rose petals.
   * 2. 3D Venetian Harlequin Mask rises on marked hex tile (safeMonumentAnchor clamped).
   * 3. Velvet ribbon SVG rays connect caster to all victims, marionette stasis shaking on victims, gala tribute coins siphon.
   * 4. Cymbal impact, Venetian gold/rose rings, heroic banner.
   */
  /**
   * Helper: Generate a procedural jagged lightning SVG path with random sub-branches
   */
  function generateOlympusLightning(x1, y1, x2, y2, segments = 16, maxOffset = 36) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = -dy / dist;
    const ny = dx / dist;
    const pts = [`${x1.toFixed(1)},${y1.toFixed(1)}`];
    const forks = [];

    for (let i = 1; i < segments; i++) {
      const t = i / segments;
      const envelope = Math.sin(t * Math.PI);
      const jitter = (Math.random() - 0.5) * 2 * maxOffset * envelope;
      const px = x1 + dx * t + nx * jitter + (Math.random() - 0.5) * 8;
      const py = y1 + dy * t + ny * jitter + (Math.random() - 0.5) * 8;
      pts.push(`${px.toFixed(1)},${py.toFixed(1)}`);

      if (Math.random() < 0.45 && envelope > 0.25) {
        const forkAngle = Math.atan2(dy, dx) + (Math.random() < 0.5 ? 0.72 : -0.72) + (Math.random() - 0.5) * 0.3;
        const forkLen = (28 + Math.random() * 55) * envelope;
        const fx2 = px + Math.cos(forkAngle) * forkLen;
        const fy2 = py + Math.sin(forkAngle) * forkLen;
        const midFx = px + Math.cos(forkAngle) * (forkLen * 0.5) + (Math.random() - 0.5) * 12;
        const midFy = py + Math.sin(forkAngle) * (forkLen * 0.5) + (Math.random() - 0.5) * 12;
        forks.push(`M ${px.toFixed(1)} ${py.toFixed(1)} Q ${midFx.toFixed(1)} ${midFy.toFixed(1)} ${fx2.toFixed(1)} ${fy2.toFixed(1)}`);
      }
    }
    pts.push(`${x2.toFixed(1)},${y2.toFixed(1)}`);
    return {
      main: `M ${pts.join(' L ')}`,
      forks
    };
  }

  async function phantomCurtainCall(d = {}) {
    if (!refs()) return;
    const casterRole = d.casterRole || d.role || 'bkk';
    const casterEl = tok.el[casterRole] || $(`${casterRole}Token`);
    const fromP = casterEl ? relRect(casterEl, L.moment) : (point({ token: casterRole }) || center());

    const victimStasis = Array.isArray(d.victimStasis) && d.victimStasis.length > 0
      ? d.victimStasis
      : Object.keys(tok.el).filter(r => r !== casterRole).map(r => ({ role: r, amount: 150 }));

    const victimEntries = victimStasis.map(v => {
      const el = tok.el[v.role] || $(`${v.role}Token`);
      const p = el ? relRect(el, L.moment) : point({ token: v.role });
      return { role: v.role, el, p, amount: v.amount || 150 };
    }).filter(ve => ve.p);

    const hexTile = d.hexTile != null ? d.hexTile : 0;
    const hexP = point({ tileId: hexTile }) || center();
    const siphonedMiles = d.siphonedMiles != null ? d.siphonedMiles : victimEntries.reduce((sum, v) => sum + v.amount, 0);

    // Phase 1: Theatrical Summon & Atmospheric Shift
    sfx('playPhantomOrgan');
    flash('rgba(244, 63, 94, 0.85)', 420);
    shake('heavy');
    vignette(4.5, 'phantom-opera');

    if (window.SkyPixi && window.SkyPixi.isReady) {
      window.SkyPixi.ultimates.phantomCurtainCall({ cX: hexP.x, cY: hexP.y });
    }

    if (casterEl) {
      casterEl.classList.add('token-phantom-waltz-wings');
    }

    // Velvet Opera Stage Curtains Overlay
    const curtainStage = document.createElement('div');
    curtainStage.className = 'fx-opera-stage-overlay';
    curtainStage.innerHTML = `
      <img src="assets/s10/opera_curtain_left.png?v=20261012v4" class="fx-opera-curtain-half fx-opera-curtain-left" alt="Left Velvet Curtain" />
      <img src="assets/s10/opera_curtain_right.png?v=20261012v4" class="fx-opera-curtain-half fx-opera-curtain-right" alt="Right Velvet Curtain" />
    `;
    L.moment.appendChild(curtainStage);

    const curtLeft = curtainStage.querySelector('.fx-opera-curtain-left');
    const curtRight = curtainStage.querySelector('.fx-opera-curtain-right');

    if (curtLeft && curtRight) {
      curtLeft.animate([
        { transform: 'translateX(-95%)', opacity: 0 },
        { transform: 'translateX(0%)', opacity: 1, offset: 0.25 },
        { transform: 'translateX(0%)', opacity: 1, offset: 0.55 },
        { transform: 'translateX(-85%) rotate(-4deg)', opacity: 0 }
      ], { duration: T(2100), fill: 'forwards' });

      curtRight.animate([
        { transform: 'translateX(95%)', opacity: 0 },
        { transform: 'translateX(0%)', opacity: 1, offset: 0.25 },
        { transform: 'translateX(0%)', opacity: 1, offset: 0.55 },
        { transform: 'translateX(85%) rotate(4deg)', opacity: 0 }
      ], { duration: T(2100), fill: 'forwards' });
    }

    // Phase 2: Procedural Velvet Ribbon & Harp String SVG Layer
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'fx-mythic-overlay-svg fx-glow-crimson');
    svg.setAttribute('viewBox', `0 0 ${L.moment.clientWidth || 800} ${L.moment.clientHeight || 800}`);
    svg.innerHTML = `
      <defs>
        <linearGradient id="phantom-ribbon-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#ffffff" />
          <stop offset="25%" stop-color="#fb7185" />
          <stop offset="65%" stop-color="#f43f5e" />
          <stop offset="100%" stop-color="#fbbf24" />
        </linearGradient>
        <filter id="phantom-velvet-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g id="fxPhantomRibbons"></g>
    `;
    L.moment.appendChild(svg);
    const gRibbons = svg.querySelector('#fxPhantomRibbons');

    // 3D Venetian Harlequin Mask & Golden Crest Rising on Target Tile
    const maskAnchor = safeMonumentAnchor(hexP, 22);
    const maskWrap = document.createElement('div');
    maskWrap.className = 'fx-venetian-mask-wrap';
    maskWrap.style.left = `${maskAnchor.modelX}px`;
    maskWrap.style.top = `${maskAnchor.modelY}px`;
    maskWrap.innerHTML = `
      <div class="fx-mask-beacon"></div>
      <div class="fx-mask-rose-glow">🥀🎭✨</div>
      <img src="assets/s10/phantom_crest.png?v=20261012v4" class="fx-phantom-crest-img" style="position:absolute;width:115px;height:115px;opacity:0.85;animation:fxCitadelHover 2s infinite alternate;" alt="Opera Crest" />
      <img src="assets/s10/venetian_mask.png?v=20261012v4" class="fx-mask-hero-img" alt="Venetian Harlequin Mask" />
    `;
    L.moment.appendChild(maskWrap);

    maskWrap.animate([
      { transform: 'translate(-50%, -50%) scale(0.2) translateY(50px)', opacity: 0 },
      { transform: 'translate(-50%, -50%) scale(1.18) translateY(-8px)', opacity: 1, offset: 0.4 },
      { transform: 'translate(-50%, -50%) scale(1.0) translateY(-2px)', opacity: 0.98, offset: 0.75 },
      { transform: 'translate(-50%, -50%) scale(1.06) translateY(-4px)', opacity: 1 }
    ], { duration: T(1500), fill: 'forwards' });

    const maskBadge = document.createElement('div');
    maskBadge.className = 'fx-mask-erected-badge';
    maskBadge.innerHTML = `🎭 REVERSE RENT HEX! 🥀<br><small style="font-size:10px;opacity:0.95;">100% RENT INVERSION · MARIONETTE STASIS</small>`;
    maskBadge.style.left = `${maskAnchor.badgeX}px`;
    maskBadge.style.top = `${maskAnchor.badgeY}px`;
    L.moment.appendChild(maskBadge);

    // 3D Antique Marionette Control Crosses above each victim avatar
    const crossElements = [];
    victimEntries.forEach(ve => {
      const crossWrap = document.createElement('div');
      crossWrap.className = 'fx-marionette-cross-wrap';
      crossWrap.style.left = `${ve.p.x}px`;
      crossWrap.style.top = `${Math.max(45, ve.p.y - 70)}px`;
      crossWrap.innerHTML = `
        <img src="assets/s10/marionette_cross.png?v=20261012v4" class="fx-marionette-cross-img" alt="Marionette Control Cross" />
      `;
      L.moment.appendChild(crossWrap);
      crossElements.push(crossWrap);
      crossWrap.animate([
        { transform: 'translate(-50%, -120%) scale(0.2)', opacity: 0 },
        { transform: 'translate(-50%, -50%) scale(1.12)', opacity: 1, offset: 0.35 },
        { transform: 'translate(-50%, -50%) scale(1.0)', opacity: 0.95 }
      ], { duration: T(1200), fill: 'forwards' });
    });

    const badges = [maskBadge];
    try {
      // Arched velvet ribbons connecting caster to victims & hexed tile with music notes
      let ribbonHtml = '';
      victimEntries.forEach(ve => {
        const midX = (fromP.x + ve.p.x) / 2;
        const midY = (fromP.y + ve.p.y) / 2 - 45;
        const crossY = Math.max(45, ve.p.y - 70);
        // Vertical glowing puppet strings from crossbar to victim token
        ribbonHtml += `
          <line x1="${ve.p.x - 24}" y1="${crossY}" x2="${ve.p.x - 14}" y2="${ve.p.y}" stroke="#f43f5e" stroke-width="2" opacity="0.85" />
          <line x1="${ve.p.x + 24}" y1="${crossY}" x2="${ve.p.x + 14}" y2="${ve.p.y}" stroke="#f43f5e" stroke-width="2" opacity="0.85" />
          <line x1="${ve.p.x}" y1="${crossY - 18}" x2="${ve.p.x}" y2="${ve.p.y - 12}" stroke="#fbbf24" stroke-width="2.5" opacity="0.9" />
          <path d="M ${fromP.x} ${fromP.y} Q ${midX} ${midY} ${ve.p.x} ${ve.p.y}" stroke="#f43f5e" stroke-width="8" opacity="0.45" filter="url(#phantom-velvet-glow)" fill="none" />
          <path d="M ${fromP.x} ${fromP.y} Q ${midX} ${midY} ${ve.p.x} ${ve.p.y}" stroke="url(#phantom-ribbon-grad)" stroke-width="3.5" stroke-linecap="round" opacity="0.95" fill="none" />
          <text x="${midX - 12}" y="${midY - 12}" fill="#fbbf24" font-size="16" opacity="0.95">♪</text>
          <text x="${midX + 10}" y="${midY + 12}" fill="#fda4af" font-size="14" opacity="0.95">♫</text>
        `;
      });
      const tMidX = (fromP.x + maskAnchor.modelX) / 2;
      const tMidY = (fromP.y + maskAnchor.modelY) / 2 - 55;
      ribbonHtml += `
        <path d="M ${fromP.x} ${fromP.y} Q ${tMidX} ${tMidY} ${maskAnchor.modelX} ${maskAnchor.modelY}" stroke="#fbbf24" stroke-width="9" opacity="0.5" filter="url(#phantom-velvet-glow)" fill="none" />
        <path d="M ${fromP.x} ${fromP.y} Q ${tMidX} ${tMidY} ${maskAnchor.modelX} ${maskAnchor.modelY}" stroke="url(#phantom-ribbon-grad)" stroke-width="4.5" stroke-linecap="round" opacity="1" fill="none" />
        <text x="${tMidX}" y="${tMidY - 14}" fill="#ffffff" font-size="18" opacity="0.95">🎭</text>
      `;
      if (gRibbons) gRibbons.innerHTML = ribbonHtml;

      // Phase 3: Coin Tribute Siphon & Marionette Stasis
      victimEntries.forEach(ve => {
        if (ve.el) ve.el.classList.add('fx-token-marionette-stasis');
        ring(ve.p.x, ve.p.y, 140, '#f43f5e', 700);
        burst({ x: ve.p.x, y: ve.p.y, name: 'sparkle', count: 22, spread: 150, up: 95, life: 850, size: 22 });
        coins({ from: { role: ve.role }, to: { role: casterRole }, amount: ve.amount });

        const badge = document.createElement('div');
        badge.className = 'fx-damage-badge';
        const safeVx = Math.max(65, Math.min(((L.moment && L.moment.clientWidth) || 360) - 65, ve.p.x));
        const safeVy = Math.max(25, Math.min(((L.moment && L.moment.clientHeight) || 600) - 25, ve.p.y - 25));
        badge.style.left = `${safeVx}px`;
        badge.style.top = `${safeVy}px`;
        badge.style.borderColor = '#f43f5e';
        badge.style.color = '#f43f5e';
        badge.innerHTML = `🎭 -${ve.amount}🪙 STASIS`;
        L.moment.appendChild(badge);
        badges.push(badge);
      });

      await sleep(T(1150));
    } finally {
      svg.remove();
      victimEntries.forEach(ve => {
        if (ve.el) ve.el.classList.remove('fx-token-marionette-stasis');
      });
      crossElements.forEach(c => {
        c.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, fill: 'forwards' });
        setTimeout(() => c.remove(), 450);
      });
      badges.forEach(b => {
        b.style.opacity = '0';
        b.style.transform = 'translate(-50%, -70%) scale(0.7)';
        setTimeout(() => b.remove(), 400);
      });
      setTimeout(() => {
        curtainStage.remove();
        maskWrap.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 500, fill: 'forwards' });
        setTimeout(() => maskWrap.remove(), 550);
      }, T(1800));
    }

    // Phase 4: Detonation & Heroic Banner
    sfx('playPhantomImpact');
    flash('rgba(244, 63, 94, 0.88)', 420);
    shake('heavy');

    ring(fromP.x, fromP.y, 200, '#f43f5e', 700);
    ring(fromP.x, fromP.y, 340, '#fbbf24', 950);
    ring(fromP.x, fromP.y, 500, '#881337', 1200);

    burst({ x: fromP.x, y: fromP.y, name: 'sparkle', count: 36, spread: 310, up: 210, life: 1300, size: 24 });

    const b = banner('🎭 PHANTOM MASQUERADE: CURTAIN CALL! 🥀', `REVERSE RENT HEX DEPLOYED · +${siphonedMiles}🪙 GALA TRIBUTE · MARIONETTE STASIS!`, 'gold', 2400);
    await sleep(T(1400));
    await b;
  }

  /**
   * 🎭 S10 Phantom Masquerade: Reverse Rent Hex Inversion
   * Triggered when a tenant inverts a rent payment onto the landlord!
   * 1. Heavy playPhantomImpact audio & gothic velvet flash.
   * 2. 3D Venetian Gilded Mirror rises on the hexed tile with smokey rose aura.
   * 3. Radial mirror shockwave fractures outward with crystalline glass particles.
   * 4. Inverted crimson/gold light rays strike the landlord avatar.
   * 5. Siphoned coins erupt from the landlord directly into the tenant's purse.
   * 6. Heroic victory banner.
   */
  async function phantomReverseHex(d = {}) {
    if (!refs()) return;
    const tileId = d.tileId != null ? d.tileId : 0;
    const tenantRole = d.role || 'bkk';
    const landlordRole = d.owner || 'dxb';
    const amount = d.amount != null ? d.amount : 500;

    const tilePt = point({ tileId }) || center();
    const landlordEl = tok.el[landlordRole] || $(`${landlordRole}Token`);
    const tenantEl = tok.el[tenantRole] || $(`${tenantRole}Token`);
    const pLandlord = landlordEl ? relRect(landlordEl, L.moment) : (point({ token: landlordRole }) || center());
    const pTenant = tenantEl ? relRect(tenantEl, L.moment) : (point({ token: tenantRole }) || center());

    sfx('playPhantomImpact');
    flash('rgba(244, 63, 94, 0.85)', 320);
    shake('heavy');

    const mirrorAnchor = safeMonumentAnchor(tilePt, 24);

    // 1. 3D Venetian Gilded Mirror rising from tile
    const mirrorWrap = document.createElement('div');
    mirrorWrap.className = 'fx-phantom-mirror-wrap';
    mirrorWrap.style.left = `${mirrorAnchor.modelX}px`;
    mirrorWrap.style.top = `${mirrorAnchor.modelY}px`;
    mirrorWrap.innerHTML = `
      <div class="fx-mask-beacon" style="background: radial-gradient(circle, rgba(244, 63, 94, 0.6) 0%, rgba(251, 191, 36, 0.25) 50%, transparent 75%);"></div>
      <div class="fx-mask-rose-glow">🥀🪞✨</div>
      <img src="assets/s10/venetian_mirror.png?v=20261012v4" class="fx-phantom-mirror-img" alt="Venetian Gilded Mirror" />
    `;
    L.moment.appendChild(mirrorWrap);

    mirrorWrap.animate([
      { transform: 'translate(-50%, -50%) scale(0.2) translateY(40px)', opacity: 0 },
      { transform: 'translate(-50%, -50%) scale(1.15) translateY(-6px)', opacity: 1, offset: 0.35 },
      { transform: 'translate(-50%, -50%) scale(1.0) translateY(0px)', opacity: 1 }
    ], { duration: T(1200), fill: 'forwards' });

    // 2. SVG Inversion Ray Layer
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'fx-mythic-overlay-svg fx-glow-crimson');
    svg.setAttribute('viewBox', `0 0 ${L.moment.clientWidth || 800} ${L.moment.clientHeight || 800}`);
    svg.innerHTML = `
      <defs>
        <linearGradient id="reverse-ray-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#ffffff" />
          <stop offset="30%" stop-color="#fb7185" />
          <stop offset="70%" stop-color="#f43f5e" />
          <stop offset="100%" stop-color="#fbbf24" />
        </linearGradient>
        <filter id="mirror-inversion-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="4.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <g id="fxReverseRays"></g>
    `;
    L.moment.appendChild(svg);
    const gRays = svg.querySelector('#fxReverseRays');

    // Ray from mirror tile to shocked landlord
    const midX = (mirrorAnchor.modelX + pLandlord.x) / 2;
    const midY = (mirrorAnchor.modelY + pLandlord.y) / 2 - 40;
    if (gRays) {
      gRays.innerHTML = `
        <path d="M ${mirrorAnchor.modelX} ${mirrorAnchor.modelY} Q ${midX} ${midY} ${pLandlord.x} ${pLandlord.y}" stroke="#f43f5e" stroke-width="10" opacity="0.6" filter="url(#mirror-inversion-glow)" fill="none" />
        <path d="M ${mirrorAnchor.modelX} ${mirrorAnchor.modelY} Q ${midX} ${midY} ${pLandlord.x} ${pLandlord.y}" stroke="url(#reverse-ray-grad)" stroke-width="4.5" stroke-linecap="round" opacity="1" fill="none" />
      `;
    }

    if (landlordEl) landlordEl.classList.add('fx-token-marionette-stasis');

    // Burst and shockwaves
    burst({ x: mirrorAnchor.modelX, y: mirrorAnchor.modelY, name: 'sparkle', count: 24, spread: 160, up: 90, life: 800, size: 20 });
    ring(mirrorAnchor.modelX, mirrorAnchor.modelY, 140, '#f43f5e', 500);
    ring(mirrorAnchor.modelX, mirrorAnchor.modelY, 220, '#fbbf24', 700);

    burst({ x: pLandlord.x, y: pLandlord.y, name: 'sparkle', count: 20, spread: 140, up: 80, life: 750, size: 18 });
    burst({ x: pLandlord.x, y: pLandlord.y, name: 'coin', count: 12, spread: 130, up: 70, life: 750, size: 16 });
    ring(pLandlord.x, pLandlord.y, 160, '#f43f5e', 600);

    // Coins transfer from landlord to tenant
    coins({ from: { role: landlordRole }, to: { role: tenantRole }, amount });

    // Damage badge on landlord
    const badge = document.createElement('div');
    badge.className = 'fx-damage-badge';
    const safeLx = Math.max(65, Math.min(((L.moment && L.moment.clientWidth) || 360) - 65, pLandlord.x));
    const safeLy = Math.max(25, Math.min(((L.moment && L.moment.clientHeight) || 600) - 25, pLandlord.y - 25));
    badge.style.left = `${safeLx}px`;
    badge.style.top = `${safeLy}px`;
    badge.style.borderColor = '#fb7185';
    badge.style.color = '#fb7185';
    badge.innerHTML = `🪞 -${amount}🪙 REVERSED!`;
    L.moment.appendChild(badge);

    const b = banner('🎭🪞 REVERSE RENT HEX INVERSION! 🥀', `THE PHANTOM'S MIRROR INVERTED THE DEED · +${amount}🪙 EXTORTED!`, 'gold', 2200);

    try {
      await sleep(T(1000));
    } finally {
      svg.remove();
      if (landlordEl) landlordEl.classList.remove('fx-token-marionette-stasis');
      badge.style.opacity = '0';
      setTimeout(() => badge.remove(), 400);
      mirrorWrap.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, fill: 'forwards' });
      setTimeout(() => mirrorWrap.remove(), 450);
    }
    await b;
  }

  /**
   * ⚡ S11 Mythic Ultimate: Wrath of Olympus: Thunder of the Sovereign Gods
   * 1. Procedural multi-branched jagged lightning tearing from the heavens.
   * 2. Electrified scorched earth crater slams onto target tile with smoke/rubble burst.
   * 3. Golden Zeus Masterbolt Spear plunges from the sky tip-first.
   * 4. 3D Mount Olympus Temple rises behind the divine bolt.
   * 5. Spasming victim tokens, divine tribute coin siphoning, and thunderous heroic banner.
   */
  async function wrathOfOlympus(d = {}) {
    if (!refs()) return;
    const casterRole = d.casterRole || d.role || 'bkk';
    const casterEl = tok.el[casterRole] || $(`${casterRole}Token`);
    const fromP = casterEl ? relRect(casterEl, L.moment) : (point({ token: casterRole }) || center());

    const victimStrikes = Array.isArray(d.victimStrikes) && d.victimStrikes.length > 0
      ? d.victimStrikes
      : Object.keys(tok.el).filter(r => r !== casterRole).map(r => ({ role: r, amount: 150 }));

    const victimEntries = victimStrikes.map(v => {
      const el = tok.el[v.role] || $(`${v.role}Token`);
      const p = el ? relRect(el, L.moment) : point({ token: v.role });
      return { role: v.role, el, p, amount: v.amount || 150 };
    }).filter(ve => ve.p);

    const smiteTile = d.smiteTile != null ? d.smiteTile : 0;
    const smiteP = point({ tileId: smiteTile }) || center();
    const rubbleCash = d.rubbleCash != null ? d.rubbleCash : 120;
    const totalSiphoned = victimEntries.reduce((sum, v) => sum + v.amount, 0) + rubbleCash;

    // Phase 1: Theatrical Summon & Atmospheric Shift
    sfx('playOlympusThunder');
    flash('rgba(255, 255, 255, 0.95)', 140);
    setTimeout(() => flash('rgba(56, 189, 248, 0.88)', 400), 150);
    shake('heavy');
    vignette(4.5, 'olympus-storm');

    if (window.SkyPixi && window.SkyPixi.isReady) {
      window.SkyPixi.ultimates.wrathOfOlympus({ targetP: smiteP, victims: victimEntries });
    }

    if (casterEl) {
      casterEl.classList.add('token-olympus-pegasus-wings');
    }

    const templeAnchor = safeMonumentAnchor(smiteP, 20);

    // 1. Electrified Scorched Earth Crater slamming on the smitten tile
    const craterWrap = document.createElement('div');
    craterWrap.className = 'fx-lightning-crater-wrap';
    craterWrap.style.left = `${templeAnchor.modelX}px`;
    craterWrap.style.top = `${templeAnchor.modelY}px`;
    craterWrap.innerHTML = `
      <img src="assets/s11/lightning_crater.png?v=20261012v3" class="fx-lightning-crater-img" alt="Scorched Lightning Crater" />
    `;
    L.moment.appendChild(craterWrap);
    craterWrap.animate([
      { transform: 'translate(-50%, -50%) scale(0.2) rotate(0deg)', opacity: 0 },
      { transform: 'translate(-50%, -50%) scale(1.15) rotate(15deg)', opacity: 1, offset: 0.35 },
      { transform: 'translate(-50%, -50%) scale(1.0) rotate(8deg)', opacity: 1 }
    ], { duration: T(1600), fill: 'forwards' });

    // 2. Zeus Masterbolt Spear diving from the heavens
    const masterboltWrap = document.createElement('div');
    masterboltWrap.className = 'fx-zeus-masterbolt-wrap';
    masterboltWrap.style.left = `${templeAnchor.modelX}px`;
    masterboltWrap.style.top = `${templeAnchor.modelY}px`;
    masterboltWrap.innerHTML = `
      <img src="assets/s11/zeus_masterbolt.png?v=20261012v3" class="fx-zeus-masterbolt-img" alt="Zeus Masterbolt Spear" />
    `;
    L.moment.appendChild(masterboltWrap);
    masterboltWrap.animate([
      { transform: 'translate(-50%, -180%) scale(1.8)', opacity: 0 },
      { transform: 'translate(-50%, -40%) scale(1.0)', opacity: 1, offset: 0.25 },
      { transform: 'translate(-50%, -45%) scale(1.05)', opacity: 1 }
    ], { duration: T(1500), fill: 'forwards' });

    // 3. 3D Mount Olympus Temple Rising behind the Masterbolt
    const templeWrap = document.createElement('div');
    templeWrap.className = 'fx-olympus-temple-wrap';
    templeWrap.style.left = `${templeAnchor.modelX}px`;
    templeWrap.style.top = `${templeAnchor.modelY - 15}px`;
    templeWrap.innerHTML = `
      <div class="fx-temple-beacon"></div>
      <div class="fx-temple-lightning-glow">⚡🏛️✨</div>
      <img src="assets/s11/olympus_temple.png?v=20261012v3" class="fx-temple-hero-img" alt="Mount Olympus Temple" />
    `;
    L.moment.appendChild(templeWrap);

    templeWrap.animate([
      { transform: 'translate(-50%, -50%) scale(0.2) translateY(50px)', opacity: 0 },
      { transform: 'translate(-50%, -50%) scale(1.18) translateY(-8px)', opacity: 1, offset: 0.4 },
      { transform: 'translate(-50%, -50%) scale(1.0) translateY(-2px)', opacity: 0.98, offset: 0.75 },
      { transform: 'translate(-50%, -50%) scale(1.06) translateY(-4px)', opacity: 1 }
    ], { duration: T(1500), fill: 'forwards' });

    const templeBadge = document.createElement('div');
    templeBadge.className = 'fx-temple-erected-badge';
    templeBadge.innerHTML = `⚡ WRATH OF ZEUS! 🏛️<br><small style="font-size:10px;opacity:0.95;">ORBITAL LIGHTNING SMITE · +${rubbleCash}🪙 RUBBLE CASH</small>`;
    templeBadge.style.left = `${templeAnchor.badgeX}px`;
    templeBadge.style.top = `${templeAnchor.badgeY}px`;
    L.moment.appendChild(templeBadge);

    // 4. Procedural Jagged Multi-Branched Lightning SVG Layer
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'fx-olympus-lightning-svg fx-lightning-flicker');
    svg.setAttribute('viewBox', `0 0 ${L.moment.clientWidth || 800} ${L.moment.clientHeight || 800}`);
    svg.innerHTML = `
      <defs>
        <filter id="zeus-plasma-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="4" result="blur1" />
          <feGaussianBlur stdDeviation="9" result="blur2" />
          <feMerge>
            <feMergeNode in="blur2" />
            <feMergeNode in="blur1" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id="zeus-core-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#ffffff" />
          <stop offset="40%" stop-color="#7dd3fc" />
          <stop offset="100%" stop-color="#38bdf8" />
        </linearGradient>
      </defs>
      <g id="fxOlympusJaggedBolts"></g>
    `;
    L.moment.appendChild(svg);
    const gBolts = svg.querySelector('#fxOlympusJaggedBolts');

    const badges = [templeBadge];
    try {
      // Main bolt tearing from the heavens (sky top) straight into the smitten tile!
      let boltMarkup = '';
      const skyX = templeAnchor.modelX + (Math.random() - 0.5) * 60;
      const mainBolt = generateOlympusLightning(skyX, 0, templeAnchor.modelX, templeAnchor.modelY, 18, 42);
      boltMarkup += `
        <path d="${mainBolt.main}" stroke="#38bdf8" stroke-width="15" opacity="0.85" filter="url(#zeus-plasma-glow)" fill="none" stroke-linecap="round" />
        <path d="${mainBolt.main}" stroke="#ffffff" stroke-width="4" opacity="1" fill="none" stroke-linecap="round" />
      `;
      mainBolt.forks.forEach(f => {
        boltMarkup += `<path d="${f}" stroke="#7dd3fc" stroke-width="2.5" opacity="0.8" fill="none" stroke-linecap="round" />`;
      });

      // Side jagged bolts branching from caster / sky to each victim
      victimEntries.forEach(ve => {
        const vBolt = generateOlympusLightning(fromP.x, fromP.y, ve.p.x, ve.p.y, 14, 28);
        boltMarkup += `
          <path d="${vBolt.main}" stroke="#38bdf8" stroke-width="11" opacity="0.8" filter="url(#zeus-plasma-glow)" fill="none" stroke-linecap="round" />
          <path d="${vBolt.main}" stroke="#ffffff" stroke-width="3" opacity="0.95" fill="none" stroke-linecap="round" />
        `;
        vBolt.forks.forEach(f => {
          boltMarkup += `<path d="${f}" stroke="#7dd3fc" stroke-width="2" opacity="0.75" fill="none" stroke-linecap="round" />`;
        });
      });

      if (gBolts) gBolts.innerHTML = boltMarkup;

      // Rubble debris burst on impact tile
      burst({ x: templeAnchor.modelX, y: templeAnchor.modelY, name: 'smoke', count: 18, spread: 180, up: 120, life: 900, size: 28 });
      burst({ x: templeAnchor.modelX, y: templeAnchor.modelY, name: 'sparkle', count: 32, spread: 260, up: 180, life: 1000, size: 24 });

      // Phase 3: Coin Siphon & Spasms
      victimEntries.forEach(ve => {
        if (ve.el) ve.el.classList.add('fx-token-olympus-smote');
        ring(ve.p.x, ve.p.y, 140, '#38bdf8', 700);
        burst({ x: ve.p.x, y: ve.p.y, name: 'sparkle', count: 24, spread: 160, up: 110, life: 850, size: 22 });
        coins({ from: { role: ve.role }, to: { role: casterRole }, amount: ve.amount });

        const badge = document.createElement('div');
        badge.className = 'fx-damage-badge';
        const safeVx = Math.max(65, Math.min(((L.moment && L.moment.clientWidth) || 360) - 65, ve.p.x));
        const safeVy = Math.max(25, Math.min(((L.moment && L.moment.clientHeight) || 600) - 25, ve.p.y - 25));
        badge.style.left = `${safeVx}px`;
        badge.style.top = `${safeVy}px`;
        badge.style.borderColor = '#38bdf8';
        badge.style.color = '#38bdf8';
        badge.innerHTML = `⚡ -${ve.amount}🪙 SMOTE`;
        L.moment.appendChild(badge);
        badges.push(badge);
      });

      await sleep(T(1100));
    } finally {
      svg.remove();
      victimEntries.forEach(ve => {
        if (ve.el) ve.el.classList.remove('fx-token-olympus-smote');
      });
      badges.forEach(b => {
        b.style.opacity = '0';
        b.style.transform = 'translate(-50%, -70%) scale(0.7)';
        setTimeout(() => b.remove(), 400);
      });
      setTimeout(() => {
        masterboltWrap.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 500, fill: 'forwards' });
        craterWrap.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 600, fill: 'forwards' });
        templeWrap.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 500, fill: 'forwards' });
        setTimeout(() => {
          masterboltWrap.remove();
          craterWrap.remove();
          templeWrap.remove();
        }, 650);
      }, T(1800));
    }

    // Phase 4: Detonation & Heroic Banner
    sfx('playZeusBolt');
    flash('rgba(56, 189, 248, 0.94)', 420);
    shake('heavy');

    ring(fromP.x, fromP.y, 220, '#38bdf8', 750);
    ring(fromP.x, fromP.y, 360, '#fde047', 950);
    ring(fromP.x, fromP.y, 520, '#0284c7', 1200);

    burst({ x: fromP.x, y: fromP.y, name: 'sparkle', count: 40, spread: 330, up: 220, life: 1350, size: 26 });

    const b = banner('⚡ WRATH OF OLYMPUS: ZEUS THUNDER! 🏛️', `ORBITAL SMITE · +${rubbleCash}🪙 RUBBLE RECLAIMED · DIVINE PEGASUS ASCENT!`, 'gold', 2400);
    await sleep(T(1400));
    await b;
  }

  /**
   * ⚡ S11 Zeus Orbital Lightning Smite (Rolling a 6)
   * Tearing multi-branched lightning from the heavens onto the rival hotel!
   */
  async function zeusLightningSmite(d = {}) {
    if (!refs()) return;
    const tileId = d.tileId != null ? d.tileId : 0;
    const smiteP = point({ tileId }) || center();
    const rubbleCash = d.amount != null ? d.amount : 120;

    sfx('playZeusBolt');
    flash('rgba(255, 255, 255, 0.95)', 120);
    setTimeout(() => flash('rgba(56, 189, 248, 0.85)', 350), 120);
    shake('heavy');

    const smiteAnchor = safeMonumentAnchor(smiteP, 18);

    // 1. Crater
    const craterWrap = document.createElement('div');
    craterWrap.className = 'fx-lightning-crater-wrap';
    craterWrap.style.left = `${smiteAnchor.modelX}px`;
    craterWrap.style.top = `${smiteAnchor.modelY}px`;
    craterWrap.innerHTML = `
      <img src="assets/s11/lightning_crater.png?v=20261012v3" class="fx-lightning-crater-img" alt="Scorched Crater" />
    `;
    L.moment.appendChild(craterWrap);
    craterWrap.animate([
      { transform: 'translate(-50%, -50%) scale(0.2) rotate(0deg)', opacity: 0 },
      { transform: 'translate(-50%, -50%) scale(1.1) rotate(12deg)', opacity: 1, offset: 0.35 },
      { transform: 'translate(-50%, -50%) scale(1.0) rotate(6deg)', opacity: 1 }
    ], { duration: T(1500), fill: 'forwards' });

    // 2. Masterbolt Spear plunging
    const masterboltWrap = document.createElement('div');
    masterboltWrap.className = 'fx-zeus-masterbolt-wrap';
    masterboltWrap.style.left = `${smiteAnchor.modelX}px`;
    masterboltWrap.style.top = `${smiteAnchor.modelY}px`;
    masterboltWrap.innerHTML = `
      <img src="assets/s11/zeus_masterbolt.png?v=20261012v3" class="fx-zeus-masterbolt-img" alt="Zeus Masterbolt Spear" />
    `;
    L.moment.appendChild(masterboltWrap);
    masterboltWrap.animate([
      { transform: 'translate(-50%, -180%) scale(1.8)', opacity: 0 },
      { transform: 'translate(-50%, -40%) scale(1.0)', opacity: 1, offset: 0.25 },
      { transform: 'translate(-50%, -45%) scale(1.05)', opacity: 1 }
    ], { duration: T(1400), fill: 'forwards' });

    // 3. Jagged Lightning from sky
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'fx-olympus-lightning-svg fx-lightning-flicker');
    svg.setAttribute('viewBox', `0 0 ${L.moment.clientWidth || 800} ${L.moment.clientHeight || 800}`);
    svg.innerHTML = `
      <defs>
        <filter id="zeus-smite-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <g id="fxZeusSmiteBolts"></g>
    `;
    L.moment.appendChild(svg);
    const gBolts = svg.querySelector('#fxZeusSmiteBolts');

    const bolt = generateOlympusLightning(smiteAnchor.modelX, 0, smiteAnchor.modelX, smiteAnchor.modelY, 16, 38);
    let boltHtml = `
      <path d="${bolt.main}" stroke="#38bdf8" stroke-width="14" opacity="0.85" filter="url(#zeus-smite-glow)" fill="none" stroke-linecap="round" />
      <path d="${bolt.main}" stroke="#ffffff" stroke-width="4" opacity="1" fill="none" stroke-linecap="round" />
    `;
    bolt.forks.forEach(f => {
      boltHtml += `<path d="${f}" stroke="#7dd3fc" stroke-width="2.5" opacity="0.8" fill="none" stroke-linecap="round" />`;
    });
    if (gBolts) gBolts.innerHTML = boltHtml;

    burst({ x: smiteAnchor.modelX, y: smiteAnchor.modelY, name: 'smoke', count: 16, spread: 160, up: 110, life: 800, size: 24 });
    burst({ x: smiteAnchor.modelX, y: smiteAnchor.modelY, name: 'coin', count: 14, spread: 200, up: 130, life: 900, size: 20 });
    burst({ x: smiteAnchor.modelX, y: smiteAnchor.modelY, name: 'sparkle', count: 28, spread: 260, up: 160, life: 950, size: 22 });
    ring(smiteAnchor.modelX, smiteAnchor.modelY, 180, '#38bdf8', 650);
    ring(smiteAnchor.modelX, smiteAnchor.modelY, 300, '#fbbf24', 850);

    const b = banner('⚡ ZEUS ORBITAL SMITE! 🏛️', `DEMOLISHED 1 LEVEL OFF RIVAL HOTEL · +${rubbleCash}🪙 RUBBLE CASH!`, 'gold', 1900);
    await sleep(T(1000));
    svg.remove();
    setTimeout(() => {
      masterboltWrap.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, fill: 'forwards' });
      craterWrap.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 500, fill: 'forwards' });
      setTimeout(() => {
        masterboltWrap.remove();
        craterWrap.remove();
      }, 550);
    }, T(1200));
    await b;
  }

  /**
   * ⚡ S11 Mount Olympus Lightning Rod Discharge
   * Crackling arc lightning discharged from the temple directly into the trespasser!
   */
  async function lightningRodZap(d = {}) {
    if (!refs()) return;
    const fromTileId = d.fromTile != null ? d.fromTile : 0;
    const toRole = d.toRole || 'dxb';
    const ownerRole = d.ownerRole || 'bkk';
    const amount = d.amount != null ? d.amount : 40;

    const pA = point({ tileId: fromTileId }) || center();
    const victimEl = tok.el[toRole] || $(`${toRole}Token`);
    const pB = victimEl ? relRect(victimEl, L.moment) : (point({ token: toRole }) || pA);

    sfx('playZeusBolt');
    flash('rgba(56, 189, 248, 0.75)', 150);
    shake('medium');

    // 1. Temple Spire Plasma Flare
    const rodFlare = document.createElement('div');
    rodFlare.className = 'fx-zeus-rod-discharge-flash';
    rodFlare.style.left = `${pA.x}px`;
    rodFlare.style.top = `${pA.y}px`;
    L.moment.appendChild(rodFlare);
    setTimeout(() => rodFlare.remove(), 600);

    // 2. Victim Electric Shock Cage
    const shockCage = document.createElement('div');
    shockCage.className = 'fx-zeus-shock-cage';
    shockCage.style.left = `${pB.x}px`;
    shockCage.style.top = `${pB.y}px`;
    L.moment.appendChild(shockCage);
    setTimeout(() => shockCage.remove(), 750);

    // 3. Travelling Arc Plasma Bullet from Temple Spire to Victim
    const bullet = document.createElement('div');
    bullet.className = 'fx-zeus-arc-plasma-bullet';
    bullet.style.left = `${pA.x}px`;
    bullet.style.top = `${pA.y}px`;
    L.moment.appendChild(bullet);
    bullet.animate([
      { left: `${pA.x}px`, top: `${pA.y}px`, transform: 'translate(-50%, -50%) scale(1.6)', opacity: 1 },
      { left: `${pB.x}px`, top: `${pB.y}px`, transform: 'translate(-50%, -50%) scale(2.4)', opacity: 0.9, offset: 0.8 },
      { left: `${pB.x}px`, top: `${pB.y}px`, transform: 'translate(-50%, -50%) scale(3.0)', opacity: 0 }
    ], { duration: T(250), fill: 'forwards' });
    setTimeout(() => bullet.remove(), T(260));

    // 4. SVG Branching Lightning Arc (2-stage dynamic strobe)
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'fx-olympus-lightning-svg fx-lightning-flicker');
    svg.setAttribute('viewBox', `0 0 ${L.moment.clientWidth || 800} ${L.moment.clientHeight || 800}`);
    svg.innerHTML = `
      <defs>
        <filter id="zeus-zap-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="3.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <g id="fxZeusZapBolts"></g>
    `;
    L.moment.appendChild(svg);
    const gBolts = svg.querySelector('#fxZeusZapBolts');

    const renderBolts = (seg, dev) => {
      const b = generateOlympusLightning(pA.x, pA.y, pB.x, pB.y, seg, dev);
      let html = `
        <path d="${b.main}" stroke="#38bdf8" stroke-width="13" opacity="0.9" filter="url(#zeus-zap-glow)" fill="none" stroke-linecap="round" />
        <path d="${b.main}" stroke="#ffffff" stroke-width="4.5" opacity="1" fill="none" stroke-linecap="round" />
      `;
      b.forks.forEach(f => {
        html += `<path d="${f}" stroke="#7dd3fc" stroke-width="2.5" opacity="0.85" fill="none" stroke-linecap="round" />`;
      });
      return html;
    };

    if (gBolts) gBolts.innerHTML = renderBolts(14, 32);

    // Dynamic strobe jitter: re-generate fresh fork path halfway through!
    setTimeout(() => {
      if (gBolts && svg.parentNode) {
        gBolts.innerHTML = renderBolts(16, 26);
        flash('rgba(125, 211, 252, 0.45)', 90);
      }
    }, T(140));

    // Sparks and electric aura on the temple and victim
    burst({ x: pA.x, y: pA.y, name: 'sparkle', count: 18, spread: 100, up: 60, life: 650, size: 20 });
    burst({ x: pB.x, y: pB.y, name: 'sparkle', count: 24, spread: 150, up: 85, life: 800, size: 22 });
    burst({ x: pB.x, y: pB.y, name: 'coin', count: 10, spread: 120, up: 75, life: 750, size: 18 });
    ring(pA.x, pA.y, 90, '#38bdf8', 400);
    ring(pB.x, pB.y, 140, '#fbbf24', 550);
    ring(pB.x, pB.y, 200, '#38bdf8', 650);

    coins({ from: { role: toRole }, to: { role: ownerRole }, amount });

    const b = banner('⚡ LIGHTNING ROD DISCHARGE! 🏛️', `TRESPASSER ZAPPED · -${amount}🪙 THUNDER TAX!`, 'gold', 1600);
    await sleep(T(750));
    svg.remove();
    await b;
  }

  /**
   * ⚡ S11 Zeus Storm Shock (Early-Game Fallback on Roll 6)
   * When rolling 6 and no rival has a hotel, calls down a direct sky lightning bolt zapping the rival!
   */
  async function zeusStormShock(d = {}) {
    if (!refs()) return;
    const toRole = d.toRole || 'dxb';
    const fromRole = d.fromRole || 'bkk';
    const amount = d.amount != null ? d.amount : 80;

    const victimEl = tok.el[toRole] || $(`${toRole}Token`);
    const pB = victimEl ? relRect(victimEl, L.moment) : (point({ token: toRole }) || center());

    sfx('playZeusBolt');
    flash('rgba(255, 255, 255, 0.9)', 120);
    setTimeout(() => flash('rgba(56, 189, 248, 0.75)', 250), 120);
    shake('medium');

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'fx-olympus-lightning-svg fx-lightning-flicker');
    svg.setAttribute('viewBox', `0 0 ${L.moment.clientWidth || 800} ${L.moment.clientHeight || 800}`);
    svg.innerHTML = `
      <defs>
        <filter id="zeus-shock-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <g id="fxZeusShockBolts"></g>
    `;
    L.moment.appendChild(svg);
    const gBolts = svg.querySelector('#fxZeusShockBolts');

    const bolt = generateOlympusLightning(pB.x, 0, pB.x, pB.y, 14, 34);
    let boltHtml = `
      <path d="${bolt.main}" stroke="#38bdf8" stroke-width="12" opacity="0.85" filter="url(#zeus-shock-glow)" fill="none" stroke-linecap="round" />
      <path d="${bolt.main}" stroke="#ffffff" stroke-width="4" opacity="1" fill="none" stroke-linecap="round" />
    `;
    bolt.forks.forEach(f => {
      boltHtml += `<path d="${f}" stroke="#7dd3fc" stroke-width="2.5" opacity="0.8" fill="none" stroke-linecap="round" />`;
    });
    if (gBolts) gBolts.innerHTML = boltHtml;

    burst({ x: pB.x, y: pB.y, name: 'sparkle', count: 24, spread: 180, up: 120, life: 800, size: 20 });
    burst({ x: pB.x, y: pB.y, name: 'coin', count: 10, spread: 140, up: 90, life: 750, size: 18 });
    ring(pB.x, pB.y, 150, '#38bdf8', 550);

    coins({ from: { role: toRole }, to: { role: fromRole }, amount });

    const b = banner('⚡ ZEUS STORM SHOCK! 🏛️', `DIRECT LIGHTNING STRIKE · -${amount}🪙 ELECTRIC SHOCK (+10% ULT)!`, 'gold', 1800);
    await sleep(T(800));
    svg.remove();
    await b;
  }

  /**
   * 🎭 S10 Phantom Throw (Dice Landing)
   */
  async function phantomThrow(d = {}) {
    const p = point({ token: d.role }) || { x: (L.moment ? L.moment.clientWidth : 300) / 2, y: (L.moment ? L.moment.clientHeight : 500) / 2 };
    flash('rgba(244, 63, 94, 0.45)', 240);
    shake('light');

    const crest = document.createElement('div');
    crest.style.cssText = `position:absolute;left:${p.x}px;top:${p.y}px;transform:translate(-50%,-50%);pointer-events:none;z-index:35;`;
    crest.innerHTML = `
      <img src="assets/s10/phantom_crest.png?v=20261012v4" style="width:110px;height:110px;filter:drop-shadow(0 0 16px #f43f5e) drop-shadow(0 0 30px #fbbf24);" alt="Crest" />
      <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:24px;pointer-events:none;animation:fxCitadelBadgeFloat 1.2s infinite alternate;">🥀🎭✨</div>
    `;
    L.moment.appendChild(crest);
    crest.animate([
      { transform: 'translate(-50%, -50%) scale(0.2) rotate(-60deg)', opacity: 0 },
      { transform: 'translate(-50%, -50%) scale(1.3) rotate(0deg)', opacity: 1, offset: 0.4 },
      { transform: 'translate(-50%, -50%) scale(1.05) rotate(45deg)', opacity: 0.95, offset: 0.75 },
      { transform: 'translate(-50%, -50%) scale(1.4) rotate(90deg)', opacity: 0 }
    ], { duration: T(850), fill: 'forwards' });

    ring(p.x, p.y, 160, '#f43f5e', 550);
    ring(p.x, p.y, 260, '#fbbf24', 750);
    burst({ x: p.x, y: p.y, name: 'sparkle', count: 28, spread: 220, up: 140, life: 850, size: 20 });
    burst({ x: p.x, y: p.y, name: 'coin', count: 8, spread: 160, up: 100, life: 750, size: 16 });
    await sleep(T(850));
    crest.remove();
  }

  /**
   * ⚡ S11 Olympus Throw (Dice Landing)
   */
  async function olympusThrow(d = {}) {
    const p = point({ token: d.role }) || { x: (L.moment ? L.moment.clientWidth : 300) / 2, y: (L.moment ? L.moment.clientHeight : 500) / 2 };
    flash('rgba(56, 189, 248, 0.52)', 260);
    shake('medium');

    const bolt = document.createElement('div');
    bolt.style.cssText = `position:absolute;left:${p.x}px;top:${p.y}px;transform:translate(-50%,-50%);pointer-events:none;z-index:35;`;
    bolt.innerHTML = `<img src="assets/s11/zeus_masterbolt.png?v=20261012v3" style="width:95px;height:95px;filter:drop-shadow(0 0 18px #ffffff) drop-shadow(0 0 35px #38bdf8);" alt="Bolt" />`;
    L.moment.appendChild(bolt);
    bolt.animate([
      { transform: 'translate(-50%, -80%) scale(0.3) rotate(-30deg)', opacity: 0 },
      { transform: 'translate(-50%, -50%) scale(1.3) rotate(35deg)', opacity: 1, offset: 0.4 },
      { transform: 'translate(-50%, -50%) scale(1.05) rotate(45deg)', opacity: 0.95, offset: 0.75 },
      { transform: 'translate(-50%, -30%) scale(1.4) rotate(60deg)', opacity: 0 }
    ], { duration: T(850), fill: 'forwards' });

    ring(p.x, p.y, 170, '#38bdf8', 550);
    ring(p.x, p.y, 280, '#fde047', 750);
    burst({ x: p.x, y: p.y, name: 'sparkle', count: 26, spread: 240, up: 150, life: 900, size: 22 });
    await sleep(T(850));
    bolt.remove();
  }

  /**
   * 🦁 S7 Beast Unleashed: Beast Pounce (Rolling a 6 Claw Strike)
   */
  async function beastPounce(d = {}) {
    if (!refs()) return;
    const role = d.role || 'bkk';
    const targetRole = d.targetRole;
    const amount = d.amount || 70;
    const casterEl = tok.el[role] || $(`${role}Token`);
    const targetEl = targetRole ? (tok.el[targetRole] || $(`${targetRole}Token`)) : null;
    const fromP = casterEl ? relRect(casterEl, L.moment) : (point({ token: role }) || center());
    const toP = targetEl ? relRect(targetEl, L.moment) : (point({ token: targetRole }) || { x: fromP.x + 80, y: fromP.y });

    sfx('playBeastRoar');
    flash('rgba(234, 88, 12, 0.35)', 220);
    shake('light');

    const slash = document.createElement('div');
    slash.className = 'fx-beast-claw-slash';
    slash.style.left = `${toP.x}px`;
    slash.style.top = `${toP.y}px`;
    slash.innerHTML = `
      <span class="claw-scratch cs-1"></span>
      <span class="claw-scratch cs-2"></span>
      <span class="claw-scratch cs-3"></span>
    `;
    L.moment.appendChild(slash);

    ring(toP.x, toP.y, 140, '#f97316', 550);
    ring(toP.x, toP.y, 220, '#e11d48', 750);
    burst({ x: toP.x, y: toP.y, name: 'sparkle', count: 20, spread: 180, up: 90, life: 700, size: 16 });

    if (targetRole) {
      burst({ x: toP.x, y: toP.y, name: 'coin', count: 12, spread: 120, up: 80, life: 650, size: 16 });
      const pounceBadge = document.createElement('div');
      pounceBadge.className = 'fx-rose-turret-badge';
      pounceBadge.style.background = 'linear-gradient(135deg, rgba(234,88,12,0.95), rgba(185,28,28,0.95))';
      pounceBadge.innerHTML = `🦁 BEAST POUNCE!<br><small style="font-size:11px;">-${amount}🪙 CLAW STRIKE (+10% ULT)!</small>`;
      pounceBadge.style.left = `${toP.x}px`;
      pounceBadge.style.top = `${toP.y - 36}px`;
      L.moment.appendChild(pounceBadge);
      setTimeout(() => pounceBadge.remove(), 1200);
    }

    if (targetEl) {
      targetEl.classList.add('fx-token-spasm');
      setTimeout(() => targetEl.classList.remove('fx-token-spasm'), 900);
    }

    await sleep(T(750));
    slash.remove();
  }

  /**
   * 🕯️ S7 Living Staff: Torch Shield Arena Parry
   */
  async function livingStaffParry(d = {}) {
    if (!refs()) return;
    const tileId = d.tileId != null ? d.tileId : 0;
    const p = point({ tileId }) || center();

    sfx('playLivingStaffParry');
    flash('rgba(245, 158, 11, 0.55)', 300);
    shake('medium');

    const staffWrap = document.createElement('div');
    staffWrap.className = 'fx-living-staff-torch-wrap';
    staffWrap.style.left = `${p.x}px`;
    staffWrap.style.top = `${p.y}px`;
    staffWrap.innerHTML = `
      <div class="fx-torch-flame-burst"></div>
      <img src="assets/s7/living_staff_torch.png?v=20261012v5" class="fx-living-staff-torch-img" alt="Living Staff Torch" />
      <div class="fx-torch-parry-crest">🕯️ PARRY! 🕯️</div>
    `;
    L.moment.appendChild(staffWrap);

    ring(p.x, p.y, 160, '#f59e0b', 600);
    ring(p.x, p.y, 260, '#fbbf24', 850);
    burst({ x: p.x, y: p.y, name: 'sparkle', count: 24, spread: 200, up: 140, gravity: 0, life: 800, size: 18 });
    burst({ x: p.x, y: p.y, name: 'coin', count: 10, spread: 140, up: 90, life: 700, size: 15 });

    const b = banner('🕯️ LIVING STAFF TORCH PARRY! 🛡️', 'HOSTILE TAKEOVER ARENA DUEL BLOCKED & DEFLECTED!', 'gold', 1800);
    await sleep(T(1000));
    staffWrap.style.opacity = '0';
    staffWrap.style.transform = 'translate(-50%, -50%) scale(1.3)';
    staffWrap.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
    await sleep(350);
    staffWrap.remove();
    await b;
  }

  /**
   * 🪐 S6 Mythic Ultimate Rework: Supernova Celestial Tithe (Void Lightning)
   * Multi-target procedural branching vector lightning, spasming victim tokens,
   * floating shock damage badges, energy siphon conduits, and supernova shockwaves.
   */
  async function voidLightningTithe(d = {}) {
    if (!refs()) return;
    const casterRole = d.casterRole || d.role || 'bkk';
    const totalSiphoned = d.totalSiphoned != null ? d.totalSiphoned : (d.amount || 0);

    // 1. Resolve caster and victims coordinates
    const casterEl = tok.el[casterRole] || $(`${casterRole}Token`);
    const fromP = casterEl ? relRect(casterEl, L.moment) : (point({ token: casterRole }) || center());

    // Resolve victims (all other active players or provided list)
    let victims = Array.isArray(d.victims) && d.victims.length > 0 ? d.victims : [];
    if (!victims.length) {
      Object.keys(tok.el).forEach(r => {
        if (r !== casterRole) victims.push({ role: r, amount: 150 });
      });
      // If still empty (e.g. 1 player solo testing), synthesize a dramatic board target
      if (!victims.length) {
        victims.push({ role: 'dxb', amount: 150, fallbackCoord: { x: (L.moment ? L.moment.clientWidth : 400) * 0.75, y: (L.moment ? L.moment.clientHeight : 500) * 0.35 } });
      }
    }

    const victimEntries = victims.map(v => {
      const vRole = typeof v === 'string' ? v : (v.role || 'rival');
      const vAmt = (v && v.amount != null) ? v.amount : 150;
      const vEl = tok.el[vRole] || $(`${vRole}Token`);
      const vCoord = vEl ? relRect(vEl, L.moment) : (point({ token: vRole }) || v.fallbackCoord || { x: fromP.x + 120, y: fromP.y - 80 });
      return { role: vRole, el: vEl, coord: vCoord, amount: vAmt };
    });

    // 2. Audio & Theatrical Pre-Charge (Dark Void Vignette + Tremor)
    sfx('playVoidLightning');
    flash('rgba(147, 51, 234, 0.72)', 350);
    shake('heavy');
    vignette(4, 'void-tithe');

    if (window.SkyPixi && window.SkyPixi.isReady) {
      window.SkyPixi.ultimates.voidLightningTithe({ casterP: fromP, victims: victimEntries.map(v => ({ p: v.coord, amount: v.amount })) });
    }

    if (casterEl) casterEl.classList.add('fx-token-sovereign-charge');
    victimEntries.forEach(ve => {
      if (ve.el) ve.el.classList.add('fx-token-shocked');
    });

    // 3. Floating Shock BADGES on victim tokens
    const badges = [];
    victimEntries.forEach(ve => {
      const badge = document.createElement('div');
      badge.className = 'fx-shock-badge';
      badge.innerHTML = `⚡ -${ve.amount}🪙 <span style="font-size:10px;display:block;opacity:0.9;">DRAINED!</span>`;
      badge.style.left = `${ve.coord.x}px`;
      badge.style.top = `${ve.coord.y - 36}px`;
      L.moment.appendChild(badge);
      requestAnimationFrame(() => {
        badge.style.transform = 'translate(-50%, -50%) scale(1.1)';
      });
      badges.push(badge);
    });

    // 4. Procedural Branching Vector Lightning SVG
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'fx-void-lightning-svg');
    svg.setAttribute('viewBox', `0 0 ${L.moment.clientWidth || 800} ${L.moment.clientHeight || 800}`);
    svg.innerHTML = `
      <defs>
        <filter id="void-plasma-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="3" result="blur1" />
          <feGaussianBlur stdDeviation="7" result="blur2" />
          <feMerge>
            <feMergeNode in="blur2" />
            <feMergeNode in="blur1" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id="void-arc-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#ffffff" />
          <stop offset="25%" stop-color="#f0abfc" />
          <stop offset="60%" stop-color="#c084fc" />
          <stop offset="100%" stop-color="#60a5fa" />
        </linearGradient>
      </defs>
    `;
    L.moment.appendChild(svg);

    function generateLightningPath(x1, y1, x2, y2, segments = 14, maxOffset = 30) {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const nx = -dy / dist;
      const ny = dx / dist;

      const pts = [`${x1.toFixed(1)},${y1.toFixed(1)}`];
      const branches = [];

      for (let i = 1; i < segments; i++) {
        const t = i / segments;
        const envelope = Math.sin(t * Math.PI);
        const jitter = (Math.random() - 0.5) * 2 * maxOffset * envelope;
        const px = x1 + dx * t + nx * jitter + (Math.random() - 0.5) * 6;
        const py = y1 + dy * t + ny * jitter + (Math.random() - 0.5) * 6;
        pts.push(`${px.toFixed(1)},${py.toFixed(1)}`);

        // Spawn a chaotic sub-branch fork at ~25% and ~70% of arc
        if (Math.random() < 0.4 && envelope > 0.35) {
          const bAngle = Math.atan2(dy, dx) + (Math.random() < 0.5 ? 0.65 : -0.65) + (Math.random() - 0.5) * 0.4;
          const bLen = (20 + Math.random() * 45) * envelope;
          const bx2 = px + Math.cos(bAngle) * bLen;
          const by2 = py + Math.sin(bAngle) * bLen;
          branches.push(`${px.toFixed(1)},${py.toFixed(1)} ${(px + (bx2-px)*0.5 + nx*(Math.random()-0.5)*12).toFixed(1)},${(py + (by2-py)*0.5 + ny*(Math.random()-0.5)*12).toFixed(1)} ${bx2.toFixed(1)},${by2.toFixed(1)}`);
        }
      }
      pts.push(`${x2.toFixed(1)},${y2.toFixed(1)}`);
      return { trunk: pts.join(' '), branches };
    }

    // High frequency re-jitter arc loop
    const arcGroups = victimEntries.map(() => {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('filter', 'url(#void-plasma-glow)');
      svg.appendChild(g);
      return g;
    });

    const startTime = performance.now();
    const duration = T(750);

    // Initial coin & stardust siphon stream towards sovereign
    victimEntries.forEach(ve => {
      coins({ from: { x: ve.coord.x, y: ve.coord.y }, to: { x: fromP.x, y: fromP.y }, amount: Math.min(150, ve.amount) });
      burst({ x: ve.coord.x, y: ve.coord.y, name: 'supernova_core', count: 6, spread: 70, up: 30, life: 550, size: 14 });
    });

    try {
      while (performance.now() - startTime < duration) {
        // Redraw lightning arcs every frame / tick
        victimEntries.forEach((ve, idx) => {
          const g = arcGroups[idx];
          if (!g) return;
          const arc = generateLightningPath(fromP.x, fromP.y, ve.coord.x, ve.coord.y, 14, 30);

          let html = `
            <polyline points="${arc.trunk}" fill="none" stroke="#a855f7" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" opacity="0.8" />
            <polyline points="${arc.trunk}" fill="none" stroke="url(#void-arc-grad)" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" />
            <polyline points="${arc.trunk}" fill="none" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
          `;
          arc.branches.forEach(bPts => {
            html += `<polyline points="${bPts}" fill="none" stroke="#f0abfc" stroke-width="2" stroke-linecap="round" opacity="0.85" />`;
          });
          g.innerHTML = html;
        });

        // Pulsing spark bursts
        if (Math.random() < 0.4) {
          const randVe = victimEntries[Math.floor(Math.random() * victimEntries.length)];
          if (randVe) {
            burst({ x: randVe.coord.x, y: randVe.coord.y, name: 'sparkle', count: 4, spread: 60, up: 20, life: 400, size: 12 });
          }
        }
        await sleep(35);
      }
    } finally {
      // 5. Clean up lightning arcs and restore tokens
      svg.remove();
      badges.forEach(b => {
        b.style.opacity = '0';
        b.style.transform = 'translate(-50%, -70%) scale(0.7)';
        setTimeout(() => b.remove(), 350);
      });
      if (casterEl) casterEl.classList.remove('fx-token-sovereign-charge');
      victimEntries.forEach(ve => {
        if (ve.el) ve.el.classList.remove('fx-token-shocked');
      });
    }

    // 6. DETONATE SUPERNOVA SHOCKWAVE AT SOVEREIGN CORE
    sfx('playBoom');
    sfx('playSupernovaTithe');
    flash('rgba(253, 224, 71, 0.7)', 450);
    shake('heavy');

    ring(fromP.x, fromP.y, 160, '#fde047', 600);
    ring(fromP.x, fromP.y, 280, '#c084fc', 850);
    ring(fromP.x, fromP.y, 420, '#38bdf8', 1100);

    const snCore = spawn('supernova_core', fromP.x, fromP.y, 150, 'fx-glow-gold');
    snCore.animate([
      { transform: at(fromP.x, fromP.y, 'scale(0.2) rotate(0deg)'), opacity: 0 },
      { transform: at(fromP.x, fromP.y, 'scale(1.7) rotate(180deg)'), opacity: 1, offset: 0.4 },
      { transform: at(fromP.x, fromP.y, 'scale(1.3) rotate(360deg)'), opacity: 1, offset: 0.7 },
      { transform: at(fromP.x, fromP.y, 'scale(2.4) rotate(540deg)'), opacity: 0 }
    ], { duration: T(1350), easing: 'ease-out' });

    burst({ x: fromP.x, y: fromP.y, name: 'supernova_core', count: 20, spread: 280, up: 160, life: 1200, size: 28 });
    burst({ x: fromP.x, y: fromP.y, name: 'vortex_nebula', count: 12, spread: 210, up: 120, life: 1100, size: 24 });
    burst({ x: fromP.x, y: fromP.y, name: 'constellation_sigil', count: 12, spread: 190, up: 100, life: 1050, size: 20 });
    burst({ x: fromP.x, y: fromP.y, name: 'sparkle', count: 30, spread: 320, up: 200, gravity: 0, life: 1300, size: 24 });

    // 7. Heroic Banner Presentation
    const b = banner('🪐 SUPERNOVA TITHE! ⚡', `+${totalSiphoned}🪙 AIRSPACE DRAIN · 2× SHIELDS! 🌌`, 'purple', 1600);
    await sleep(T(1350));
    snCore.remove();
    await b;
  }

  /**
   * 🔱 S5 Mythic Ultimate: Abyssal Tidal Cataclysm
   * Giant surging tsunami wave rolling across board, sucking wealthiest rival into whirlpool,
   * dragging them backward 3 tiles with water rapids, waterlogging roll, and siphon drain.
   */
  async function abyssalCataclysm(d = {}) {
    if (!refs()) return;
    const casterRole = d.casterRole || d.role || 'dxb';
    const targetRole = d.targetRole || d.targetR;
    const targetP = d.targetP || {};
    const tidalDmg = d.tidalDmg != null ? d.tidalDmg : 150;

    const casterEl = tok.el[casterRole] || $(`${casterRole}Token`);
    const fromP = casterEl ? relRect(casterEl, L.moment) : (point({ token: casterRole }) || center());

    const targetEl = targetRole ? (tok.el[targetRole] || $(`${targetRole}Token`)) : null;
    const toP = targetEl ? relRect(targetEl, L.moment) : (targetRole ? point({ token: targetRole }) : { x: fromP.x + 130, y: fromP.y - 70 });

    // 1. Atmosphere: Abyssal ocean trench vignette + sonar crash
    sfx('playAbyssalWave');
    sfx('playBoom');
    flash('rgba(6, 182, 212, 0.75)', 350);
    shake('heavy');
    vignette(4, 'abyss-deep');

    if (window.SkyPixi && window.SkyPixi.isReady) {
      window.SkyPixi.ultimates.abyssCataclysm({ targetP: toP });
    }

    if (casterEl) casterEl.classList.add('fx-token-abyss-monarch');
    if (targetEl) targetEl.classList.add('fx-token-drowning');

    // 2. Floating Waterlog Badge over target
    let badge = null;
    if (targetRole) {
      badge = document.createElement('div');
      badge.className = 'fx-waterlog-badge';
      badge.innerHTML = `🌊 -3 TILES & -${tidalDmg}🪙<span style="font-size:10px;display:block;opacity:0.9;">WATERLOGGED!</span>`;
      badge.style.left = `${toP.x}px`;
      badge.style.top = `${toP.y - 36}px`;
      L.moment.appendChild(badge);
      requestAnimationFrame(() => {
        badge.style.transform = 'translate(-50%, -50%) scale(1.1)';
      });
    }

    // 3. Surging Vector Tsunami Wave rolling across board
    const waveNode = spawn('abyssal_tidal_crest', fromP.x, fromP.y, 170, 'fx-glow-cyan');
    waveNode.animate([
      { transform: at(fromP.x, fromP.y, 'scale(0.3) rotate(-30deg)'), opacity: 0 },
      { transform: at((fromP.x + toP.x) * 0.5, (fromP.y + toP.y) * 0.5 - 30, 'scale(1.8) rotate(15deg)'), opacity: 1, offset: 0.5 },
      { transform: at(toP.x, toP.y, 'scale(2.2) rotate(45deg)'), opacity: 0.9, offset: 0.85 },
      { transform: at(toP.x, toP.y, 'scale(2.6) rotate(60deg)'), opacity: 0 }
    ], { duration: T(1100), easing: 'ease-out' });

    ring(toP.x, toP.y, 140, '#06b6d4', 600);
    ring(toP.x, toP.y, 240, '#0284c7', 850);

    // 4. White-water foam & coin siphon stream back to caster
    if (targetRole) {
      coins({ from: { x: toP.x, y: toP.y }, to: { x: fromP.x, y: fromP.y }, amount: tidalDmg });
      burst({ x: toP.x, y: toP.y, name: 'water', count: 24, spread: 180, up: 140, gravity: 280, life: 900, size: 22 });
      burst({ x: toP.x, y: toP.y, name: 'abyssal_tidal_crest', count: 8, spread: 120, up: 80, life: 750, size: 18 });
    }

    // Drag target backward 3 tiles visually if position is provided
    if (targetRole && targetP.pos != null && api.tokens && api.tokens.teleport) {
      setTimeout(() => {
        api.tokens.teleport(targetRole, targetP.pos);
        sfx('playAbyssalSplash');
      }, T(600));
    }

    try {
      await sleep(T(1150));
    } finally {
      waveNode.remove();
      if (badge) {
        badge.style.opacity = '0';
        badge.style.transform = 'translate(-50%, -70%) scale(0.7)';
        setTimeout(() => badge.remove(), 350);
      }
      if (casterEl) casterEl.classList.remove('fx-token-abyss-monarch');
      if (targetEl) targetEl.classList.remove('fx-token-drowning');
    }

    // 5. Heroic Detonation & Banner
    ring(fromP.x, fromP.y, 180, '#06b6d4', 650);
    ring(fromP.x, fromP.y, 300, '#0284c7', 950);
    burst({ x: fromP.x, y: fromP.y, name: 'water', count: 26, spread: 260, up: 180, gravity: 240, life: 1100, size: 24 });
    burst({ x: fromP.x, y: fromP.y, name: 'gem', count: 14, spread: 190, up: 120, life: 950, size: 18 });

    const targetName = (targetP && targetP.name) ? targetP.name : (targetRole ? targetRole.toUpperCase() : 'RIVAL');
    const b = banner('🔱 ABYSSAL CATACLYSM! 🌊', `TSUNAMI DRAGGED ${targetName} -3 TILES · -${tidalDmg}🪙!`, 'cyan', 1600);
    await b;
  }

  /**
   * 🎰 S4 Mythic Ultimate: Royal Flush Gold Rush
   * 3D spinning Roulette Wheel at board center, fan of glowing royal cards (A-K-Q-J-10),
   * high-roller token aura, vertical chip fountain geyser (+800🪙), and locking roll 6!
   */
  async function monacoGoldRush(d = {}) {
    if (!refs()) return;
    const role = d.role || 'bkk';
    const amount = d.amount || 800;

    const casterEl = tok.el[role] || $(`${role}Token`);
    const pCoord = casterEl ? relRect(casterEl, L.moment) : (point({ token: role }) || center());
    const c = center();

    // 1. Atmosphere: Emerald felt vignette + casino chip roll & slam
    sfx('playCasinoWelcome');
    sfx('playCasinoChipRoll');
    flash('rgba(245, 158, 11, 0.72)', 350);
    shake('medium');
    vignette(4, 'monaco-vip');

    if (window.SkyPixi && window.SkyPixi.isReady) {
      window.SkyPixi.ultimates.monacoGoldRush({ cX: c.x, cY: c.y });
    }

    if (casterEl) casterEl.classList.add('fx-token-high-roller');

    // 2. Floating Gold Rush Badge over caster
    const badge = document.createElement('div');
    badge.className = 'fx-gold-rush-badge';
    badge.innerHTML = `🎰 +${amount}🪙 VIP JACKPOT!<span style="font-size:10px;display:block;opacity:0.9;">🎲 LOCKED ROLL 6!</span>`;
    badge.style.left = `${pCoord.x}px`;
    badge.style.top = `${pCoord.y - 38}px`;
    L.moment.appendChild(badge);
    requestAnimationFrame(() => {
      badge.style.transform = 'translate(-50%, -50%) scale(1.1)';
    });

    // 3. Spinning 3D SVG Roulette Wheel at center
    const wheel = spawn('monaco_roulette_wheel', c.x, c.y, 165, 'fx-glow-gold');
    wheel.animate([
      { transform: at(c.x, c.y, 'scale(0.1) rotate(0deg)'), opacity: 0 },
      { transform: at(c.x, c.y, 'scale(1.4) rotate(720deg)'), opacity: 1, offset: 0.4 },
      { transform: at(c.x, c.y, 'scale(1.15) rotate(1440deg)'), opacity: 1, offset: 0.75 },
      { transform: at(c.x, c.y, 'scale(1.8) rotate(1800deg)'), opacity: 0 }
    ], { duration: T(1350), easing: 'cubic-bezier(.1,.9,.2,1)' });

    // 4. Fan of 5 Royal Cards radiating from center
    const suits = ['A♦', 'K♦', 'Q♦', 'J♦', '10♦'];
    const cardNodes = suits.map((suit, idx) => {
      const card = document.createElement('div');
      card.className = 'fx-royal-card';
      card.textContent = suit;
      card.style.position = 'absolute';
      card.style.left = `${c.x}px`;
      card.style.top = `${c.y}px`;
      card.style.padding = '8px 12px';
      card.style.background = 'linear-gradient(135deg, #ffffff, #fef08a)';
      card.style.color = '#dc2626';
      card.style.fontWeight = '900';
      card.style.fontSize = '16px';
      card.style.border = '2px solid #ffd700';
      card.style.borderRadius = '8px';
      card.style.boxShadow = '0 0 16px rgba(253, 224, 71, 0.9)';
      card.style.pointerEvents = 'none';
      card.style.zIndex = '305';
      card.style.transform = 'translate(-50%, -50%) scale(0.2)';
      card.style.opacity = '0';
      card.style.transition = 'all 0.5s cubic-bezier(.175,.885,.32,1.275)';
      L.moment.appendChild(card);

      const angle = (-40 + idx * 20) * (Math.PI / 180);
      const dist = 110;
      const targetX = c.x + Math.sin(angle) * dist;
      const targetY = c.y - Math.cos(angle) * dist * 0.7;

      setTimeout(() => {
        card.style.opacity = '1';
        card.style.transform = `translate(${targetX - c.x}px, ${targetY - c.y}px) rotate(${-30 + idx * 15}deg) scale(1.1)`;
      }, 150 + idx * 60);

      return card;
    });

    // 5. Vertical Chip & Gold Fountain into Caster
    coins({ from: { x: c.x, y: c.y }, to: { x: pCoord.x, y: pCoord.y }, amount });
    burst({ x: c.x, y: c.y, name: 'monaco_chip_stack', count: 18, spread: 220, up: 160, life: 1100, size: 28 });
    burst({ x: pCoord.x, y: pCoord.y, name: 'coin', count: 32, spread: 280, up: 220, gravity: 400, life: 1200, size: 24 });
    burst({ x: pCoord.x, y: pCoord.y, name: 'gem', count: 16, spread: 180, up: 120, life: 950, size: 18 });

    sfx('playCasinoSlam');
    sfx('playJackpot');

    try {
      await sleep(T(1400));
    } finally {
      wheel.remove();
      cardNodes.forEach(cn => cn.remove());
      badge.style.opacity = '0';
      badge.style.transform = 'translate(-50%, -70%) scale(0.7)';
      setTimeout(() => badge.remove(), 350);
      if (casterEl) casterEl.classList.remove('fx-token-high-roller');
    }

    // 6. Rings & Luxe Banner
    ring(pCoord.x, pCoord.y, 180, '#ffd700', 700);
    ring(pCoord.x, pCoord.y, 280, '#f59e0b', 950);
    const b = banner('🎰 ROYAL GOLD RUSH! 👑', `+${amount}🪙 VIP JACKPOT · NEXT ROLL 6!`, 'gold', 1600);
    await b;
  }

  /**
   * 🐉 S1 Mythic Ultimate: Emerald Naga Surge
   * Sacred Mekong River Dragon emerging from Start Tile, slithering across the board,
   * sprouting glowing Lotus Water Domes on owned properties, and bestowing +500🪙 hoard.
   */
  async function emeraldNagaSurge(d = {}) {
    if (!refs()) return;
    const role = d.role || 'bkk';
    const amount = d.amount || 500;
    const ownedTiles = Array.isArray(d.ownedTiles) ? d.ownedTiles : [];

    const casterEl = tok.el[role] || $(`${role}Token`);
    const pCoord = casterEl ? relRect(casterEl, L.moment) : (point({ token: role }) || center());
    const startP = point({ tileId: 0 }) || { x: (L.moment ? L.moment.clientWidth : 400) * 0.15, y: (L.moment ? L.moment.clientHeight : 500) * 0.85 };

    // 1. Atmosphere: Jade river mist vignette + sacred gong
    sfx('playNagaGong');
    sfx('playNagaSurge');
    flash('rgba(16, 185, 129, 0.72)', 350);
    shake('medium');
    vignette(4, 'naga-mist');

    if (window.SkyPixi && window.SkyPixi.isReady) {
      window.SkyPixi.ultimates.emeraldNagaSurge({ cX: pCoord.x, cY: pCoord.y });
    }

    if (casterEl) casterEl.classList.add('fx-token-naga-blessed');

    // 2. Emerging Emerald Urn & Sacred Dragon
    const urn = spawn('naga_emerald_urn', startP.x, startP.y, 140, 'fx-glow-green');
    urn.animate([
      { transform: at(startP.x, startP.y, 'scale(0.2) rotate(-30deg)'), opacity: 0 },
      { transform: at(startP.x, startP.y - 40, 'scale(1.5) rotate(10deg)'), opacity: 1, offset: 0.5 },
      { transform: at(pCoord.x, pCoord.y, 'scale(1.2) rotate(0deg)'), opacity: 0.9, offset: 0.85 },
      { transform: at(pCoord.x, pCoord.y, 'scale(2.0) rotate(20deg)'), opacity: 0 }
    ], { duration: T(1350), easing: 'ease-out' });

    // 3. Sprout Lotus Water Domes on owned properties
    const domeNodes = [];
    const tilesToBless = ownedTiles.length > 0 ? ownedTiles : [1, 2, 3];
    tilesToBless.forEach((tid, idx) => {
      const tilePt = point({ tileId: tid });
      if (!tilePt) return;

      setTimeout(() => {
        const dome = document.createElement('div');
        dome.className = 'fx-lotus-dome';
        dome.style.left = `${tilePt.x}px`;
        dome.style.top = `${tilePt.y}px`;
        L.moment.appendChild(dome);
        domeNodes.push(dome);

        const badge = document.createElement('div');
        badge.className = 'fx-lotus-badge';
        badge.innerHTML = `🪷 LOTUS SHIELD!`;
        badge.style.left = `${tilePt.x}px`;
        badge.style.top = `${tilePt.y - 30}px`;
        L.moment.appendChild(badge);
        domeNodes.push(badge);

        ring(tilePt.x, tilePt.y, 100, '#10b981', 450);
        burst({ x: tilePt.x, y: tilePt.y, name: 'sparkle', count: 8, spread: 70, up: 40, life: 500, size: 14 });
      }, 300 + idx * 120);
    });

    // 4. Emerald Hoard Siphon into caster
    coins({ from: { tileId: 0 }, to: { x: pCoord.x, y: pCoord.y }, amount });
    burst({ x: pCoord.x, y: pCoord.y, name: 'coin', count: 28, spread: 260, up: 200, gravity: 350, life: 1100, size: 24 });
    burst({ x: pCoord.x, y: pCoord.y, name: 'water', count: 20, spread: 220, up: 150, life: 1000, size: 20 });
    burst({ x: pCoord.x, y: pCoord.y, name: 'naga_emerald_urn', count: 8, spread: 140, up: 80, life: 800, size: 22 });

    try {
      await sleep(T(1400));
    } finally {
      urn.remove();
      domeNodes.forEach(d => {
        d.style.opacity = '0';
        setTimeout(() => d.remove(), 400);
      });
      if (casterEl) casterEl.classList.remove('fx-token-naga-blessed');
    }

    // 5. Concentric Rings & Banner
    ring(pCoord.x, pCoord.y, 180, '#10b981', 750);
    ring(pCoord.x, pCoord.y, 280, '#ffd700', 950);
    const b = banner('🐉 EMERALD NAGA SURGE! 🪷', `+${amount}🪙 RIVER HOARD · LOTUS WATER SHIELDS!`, 'green', 1600);
    await b;
  }

  /**
   * ☀️ S2 Mythic Ultimate: Solar-Lunar Eclipse Convergence
   * Total solar eclipse blackout, diamond ring lens flare, violet stasis chains wrapping
   * all rival properties to freeze rent to 0 for 1 round!
   */
  async function eclipseConvergence(d = {}) {
    if (!refs()) return;
    const casterRole = d.casterRole || d.role || 'bkk';
    const rivalTiles = Array.isArray(d.rivalTiles) ? d.rivalTiles : [];

    const casterEl = tok.el[casterRole] || $(`${casterRole}Token`);
    const pCoord = casterEl ? relRect(casterEl, L.moment) : (point({ token: casterRole }) || center());
    const c = center();

    // 1. Atmosphere: Midnight totality blackout vignette + cosmic drone
    sfx('playEclipseConvergence');
    sfx('playBoom');
    flash('rgba(99, 102, 241, 0.78)', 400);
    shake('heavy');
    vignette(5, 'eclipse-totality');

    if (window.SkyPixi && window.SkyPixi.isReady) {
      window.SkyPixi.ultimates.eclipseConvergence({ cX: c.x, cY: c.y });
    }

    // 2. Aligning Celestial Yin-Yang Eclipse at center
    const eclipse = spawn('eclipse_yin_yang', c.x, c.y, 170, 'fx-glow-purple');
    eclipse.animate([
      { transform: at(c.x, c.y, 'scale(0.1) rotate(0deg)'), opacity: 0 },
      { transform: at(c.x, c.y, 'scale(1.5) rotate(180deg)'), opacity: 1, offset: 0.4 },
      { transform: at(c.x, c.y, 'scale(1.2) rotate(360deg)'), opacity: 1, offset: 0.75 },
      { transform: at(c.x, c.y, 'scale(2.2) rotate(540deg)'), opacity: 0 }
    ], { duration: T(1450), easing: 'ease-out' });

    // 3. Stasis Chains wrapping rival properties
    const chainNodes = [];
    const targetTiles = rivalTiles.length > 0 ? rivalTiles : [5, 9, 14, 17];
    targetTiles.forEach((tid, idx) => {
      const tilePt = point({ tileId: tid });
      if (!tilePt) return;

      setTimeout(() => {
        const chain = document.createElement('div');
        chain.className = 'fx-stasis-chains';
        chain.style.left = `${tilePt.x}px`;
        chain.style.top = `${tilePt.y}px`;
        L.moment.appendChild(chain);
        chainNodes.push(chain);

        const badge = document.createElement('div');
        badge.className = 'fx-stasis-badge';
        badge.innerHTML = `❄️ 0🪙 RENT FROZEN!`;
        badge.style.left = `${tilePt.x}px`;
        badge.style.top = `${tilePt.y - 30}px`;
        L.moment.appendChild(badge);
        chainNodes.push(badge);

        ring(tilePt.x, tilePt.y, 90, '#818cf8', 450);
        burst({ x: tilePt.x, y: tilePt.y, name: 'sparkle', count: 8, spread: 60, up: 30, life: 500, size: 14 });
      }, 350 + idx * 90);
    });

    ring(c.x, c.y, 220, '#ffd700', 800);
    ring(c.x, c.y, 340, '#6366f1', 1100);
    burst({ x: c.x, y: c.y, name: 'sparkle', count: 32, spread: 300, up: 200, gravity: 0, life: 1200, size: 22 });

    try {
      await sleep(T(1450));
    } finally {
      eclipse.remove();
      chainNodes.forEach(cn => {
        cn.style.opacity = '0';
        setTimeout(() => cn.remove(), 400);
      });
    }

    // 4. Detonation & Heroic Banner
    const b = banner('☀️ TOTAL ECLIPSE CONVERGENCE! 🌙', '0 RIVAL RENT FOR 1 ROUND · STASIS ACTIVE!', 'gold', 1600);
    await b;
  }

  /**
   * 🪔 S3 Mythic Ultimate: Cosmic Genie Wish
   * Arabian magic lamp rub, towering swirling violet stardust smoke, physical house-to-hotel
   * golden transmutation with Midas Touch, and shower of star-miles (+350🪙).
   */
  async function cosmicGenieWish(d = {}) {
    if (!refs()) return;
    const role = d.role || 'bkk';
    const amount = d.amount || 350;
    const upgradedTileId = d.upgradedTileId;

    const casterEl = tok.el[role] || $(`${role}Token`);
    const pCoord = casterEl ? relRect(casterEl, L.moment) : (point({ token: role }) || center());
    const tilePt = upgradedTileId != null ? point({ tileId: upgradedTileId }) : null;
    const destPt = tilePt || { x: pCoord.x + 120, y: pCoord.y - 80 };

    // 1. Atmosphere: Amethyst & desert gold vignette + genie wish tone
    sfx('playDjinnWish');
    flash('rgba(168, 85, 247, 0.72)', 350);
    shake('medium');
    vignette(4, 'djinn-palace');

    if (window.SkyPixi && window.SkyPixi.isReady) {
      window.SkyPixi.ultimates.cosmicGenieWish({ cX: pCoord.x, cY: pCoord.y });
    }

    // 2. Shaking Brass Lamp at caster
    const lamp = spawn('djinn_magic_lamp', pCoord.x, pCoord.y - 10, 145, 'fx-glow-purple');
    lamp.animate([
      { transform: at(pCoord.x, pCoord.y - 10, 'scale(0.2) rotate(-30deg)'), opacity: 0 },
      { transform: at(pCoord.x, pCoord.y - 30, 'scale(1.4) rotate(15deg)'), opacity: 1, offset: 0.4 },
      { transform: at((pCoord.x + destPt.x) * 0.5, (pCoord.y + destPt.y) * 0.5 - 40, 'scale(1.2) rotate(-10deg)'), opacity: 1, offset: 0.7 },
      { transform: at(destPt.x, destPt.y, 'scale(1.8) rotate(0deg)'), opacity: 0 }
    ], { duration: T(1350), easing: 'ease-out' });

    // 3. Stardust Transmutation at Target Tile
    let badge = null;
    let targetTileEl = upgradedTileId != null ? $(`boardTile_${upgradedTileId}`) : null;
    if (targetTileEl) targetTileEl.classList.add('fx-midas-glow');

    setTimeout(() => {
      badge = document.createElement('div');
      badge.className = 'fx-midas-badge';
      badge.innerHTML = upgradedTileId != null ? `✨ TRANSMUTED TO HOTEL! 🏨` : `✨ +${amount}🪙 GOLDEN DICE! 🎲`;
      badge.style.left = `${destPt.x}px`;
      badge.style.top = `${destPt.y - 32}px`;
      L.moment.appendChild(badge);
      requestAnimationFrame(() => {
        badge.style.transform = 'translate(-50%, -50%) scale(1.1)';
      });

      ring(destPt.x, destPt.y, 140, '#ffd700', 600);
      ring(destPt.x, destPt.y, 220, '#c084fc', 850);
      burst({ x: destPt.x, y: destPt.y, name: 'gem', count: 18, spread: 180, up: 120, life: 900, size: 20 });
      burst({ x: destPt.x, y: destPt.y, name: 'sparkle', count: 24, spread: 220, up: 150, life: 1000, size: 22 });
      sfx('playVictory');
    }, 450);

    // 4. Starlight Miles stream into caster
    coins({ from: { bank: true }, to: { x: pCoord.x, y: pCoord.y }, amount });
    burst({ x: pCoord.x, y: pCoord.y, name: 'sparkle', count: 24, spread: 220, up: 160, gravity: -20, life: 950, size: 20 });

    try {
      await sleep(T(1400));
    } finally {
      lamp.remove();
      if (badge) {
        badge.style.opacity = '0';
        badge.style.transform = 'translate(-50%, -70%) scale(0.7)';
        setTimeout(() => badge.remove(), 350);
      }
      if (targetTileEl) targetTileEl.classList.remove('fx-midas-glow');
    }

    // 5. Banner
    ring(pCoord.x, pCoord.y, 190, '#a855f7', 800);
    const b = banner('🪔 COSMIC GENIE WISH! ✨', `+${amount}🪙 & MYSTICAL TRANSMUTATION!`, 'purple', 1600);
    await b;
  }

  const MOMENTS = {
    async takeover_win(d) {
      const c = center();
      const h = 110;
      const s1 = spawn('sword', c.x, c.y, h);
      const s2 = spawn('sword', c.x, c.y, h);
      const dist = (L.moment.clientWidth / 2) + 60;
      const a1 = s1.animate([
        { transform: at(c.x - dist, c.y, 'rotate(40deg)') },
        { transform: at(c.x - 8, c.y, 'rotate(40deg)') }
      ], { duration: T(250), easing: 'ease-in', fill: 'forwards' });
      s2.animate([
        { transform: at(c.x + dist, c.y, 'scaleX(-1) rotate(40deg)') },
        { transform: at(c.x + 8, c.y, 'scaleX(-1) rotate(40deg)') }
      ], { duration: T(250), easing: 'ease-in', fill: 'forwards' });
      await a1.finished.catch(() => {});
      flash('rgba(255,255,255,0.85)', 90);
      sfx('playSwordClash');
      burst({ x: c.x, y: c.y - 10, count: 8, spread: 110, gravity: 120, life: 700, size: 16 });
      const b = banner('TAKEOVER!', d.text || '', '', 900);
      await sleep(T(1100));
      [s1, s2].forEach((s) => done(s.animate([{ opacity: 1 }, { opacity: 0 }], { duration: T(250), fill: 'forwards' }), s));
      await b;
    },

    async takeover_fail(d) {
      const c = center();
      const sh = spawn('shield', c.x, c.y, 96);
      await sh.animate([
        { transform: at(c.x, c.y, 'scale(2.5)'), opacity: 0 },
        { transform: at(c.x, c.y, 'scale(1)'), opacity: 1 }
      ], { duration: T(220), easing: 'ease-in', fill: 'forwards' }).finished.catch(() => {});
      sfx('playThud');
      shake('light');
      ring(c.x, c.y, 120, '#7dd3fc', 500);
      const sw = spawn('sword', c.x + 40, c.y - 30, 80);
      done(sw.animate([
        { transform: at(c.x + 40, c.y - 30, 'rotate(-30deg)'), opacity: 1 },
        { transform: at(c.x + 140, c.y + 160, 'rotate(260deg)'), opacity: 0 }
      ], { duration: T(800), easing: 'cubic-bezier(.3,0,.8,.6)' }), sw);
      await sleep(T(150));
      await banner('DEFENDED!', d.text || '', 'blue', 800);
      done(sh.animate([{ opacity: 1 }, { opacity: 0 }], { duration: T(200), fill: 'forwards' }), sh);
    },

    async hotel(d) { await dropBuilding(d, 'hotel', 220, 60, 'medium', 6, 'GRAND HOTEL'); },
    async house(d) { await dropBuilding(d, 'house', 90, 40, 'light', 3, null); },

    async c4(d) {
      const p = point({ tileId: d.tileId });
      const bomb = spawn('c4', p.x, p.y, 40);
      await bomb.animate([
        { transform: at(p.x, p.y - 40, 'scale(0.5)'), opacity: 0 },
        { transform: at(p.x, p.y, 'scale(1)'), opacity: 1 }
      ], { duration: T(250), easing: 'ease-in', fill: 'forwards' }).finished.catch(() => {});
      for (let i = 0; i < 3; i++) {
        sfx('playFuseBeep', i);
        bomb.animate([{ filter: 'none' }, { filter: 'drop-shadow(0 0 10px #ef4444) brightness(1.6)' }, { filter: 'none' }], { duration: T(170) });
        await sleep(T(180));
      }
      bomb.remove();
      const ex = spawn('explosion', p.x, p.y, 90);
      done(ex.animate([
        { transform: at(p.x, p.y, 'scale(0.2) rotate(0deg)'), opacity: 1 },
        { transform: at(p.x, p.y, 'scale(1.7) rotate(25deg)'), opacity: 1, offset: 0.5 },
        { transform: at(p.x, p.y, 'scale(1.9) rotate(30deg)'), opacity: 0 }
      ], { duration: T(700), easing: 'ease-out' }), ex);
      flash('#ffffff', 90).then(() => flash('rgba(255,120,0,0.35)', 300));
      shake('heavy');
      sfx('playBoom');
      restartClass($(`boardTile_${d.tileId}`), 'tile-blast', 1600);
      burst({ x: p.x, y: p.y, name: 'debris', count: 6, spread: 260, up: 220, gravity: 900, life: 900, size: 14 });
      shards({ x: p.x, y: p.y, count: 6 });
      setTimeout(() => burst({ x: p.x, y: p.y, name: 'smoke', count: 5, spread: 30, up: 70, gravity: 0, life: 1200, size: 30, rotate: false }), T(50));
      await sleep(T(100));
      await banner('BOOM!', d.text || '', 'orange', 800);
    },

    async jackpot(d) {
      const c = center();
      flash('rgba(250,204,21,0.45)', 250);
      const gem = spawn('gem', c.x, c.y - 10, 90);
      gem.animate([
        { transform: at(c.x, c.y - 10, 'scale(0) rotateY(0deg)') },
        { transform: at(c.x, c.y - 10, 'scale(1.3) rotateY(540deg)'), offset: 0.6 },
        { transform: at(c.x, c.y - 10, 'scale(1) rotateY(720deg)') }
      ], { duration: T(900), easing: 'ease-out', fill: 'forwards' });
      const W = L.moment.clientWidth;
      const H = L.moment.clientHeight;
      const n = api.reducedMotion ? 6 : 24;
      for (let i = 0; i < n; i++) {
        const x = rand(10, W - 10);
        const node = spawn('coin', x, -20, rand(16, 26));
        done(node.animate([
          { transform: at(x, -20, 'rotate(0deg)'), opacity: 1 },
          { transform: at(x + rand(-30, 30), H + 20, `rotate(${rand(360, 900)}deg)`), opacity: 1 }
        ], { duration: T(rand(700, 1100)), delay: T(rand(0, 600)), easing: 'cubic-bezier(.5,0,1,1)', fill: 'both' }), node);
      }
      sfx('playJackpot');
      await sleep(T(250));
      const b = banner('JACKPOT!', d.text || '+1,000 🪙', '', 1000);
      if (d.role) coins({ from: { bank: true }, to: { role: d.role }, amount: 1000, delay: T(350) });
      await b;
      done(gem.animate([{ opacity: 1 }, { opacity: 0 }], { duration: T(250), fill: 'forwards' }), gem);
    },

    async zone(d) {
      const c = center();
      const b = banner('ZONE MONOPOLY', `${d.text || ''} · RENT ×2`, '', 1100);
      const tiles = d.tiles || (d.tileId != null ? [d.tileId] : []);
      for (let i = 0; i < tiles.length; i++) {
        const tid = tiles[i];
        const p = point({ tileId: tid });
        const cr = spawn('crown', c.x, c.y, 30);
        done(cr.animate([
          { transform: at(c.x, c.y, 'scale(0.4)'), opacity: 0 },
          { transform: at(p.x, p.y - p.h * 0.3, 'scale(1)'), opacity: 1, offset: 0.8 },
          { transform: at(p.x, p.y - p.h * 0.3, 'scale(0.6)'), opacity: 0 }
        ], { duration: T(600), easing: 'ease-out' }), cr);
        setTimeout(() => {
          restartClass($(`boardTile_${tid}`), 'zone-light', 500);
          sfx('tone', 660 + i * 180, { type: 'triangle', dur: 0.18, vol: 0.14 });
        }, T(480));
        await sleep(T(180));
      }
      await b;
    },

    async shield(d) {
      const p = point({ token: d.role });
      const sh = spawn('shield', p.x, p.y, 56);
      sh.animate([
        { transform: at(p.x, p.y, 'scale(0)'), opacity: 0 },
        { transform: at(p.x, p.y, 'scale(1.2)'), opacity: 1, offset: 0.6 },
        { transform: at(p.x, p.y, 'scale(1)'), opacity: 1 }
      ], { duration: T(300), fill: 'forwards' });
      sfx('playItem');
      if (d.owner) {
        const from = point({ token: d.owner });
        for (let i = 0; i < 4; i++) {
          const node = spawn('coin', from.x, from.y, 18);
          const mid = { x: (from.x + p.x) / 2, y: Math.min(from.y, p.y) - 50 };
          done(node.animate([
            { transform: at(from.x, from.y), opacity: 0 },
            { transform: at(mid.x, mid.y), opacity: 1, offset: 0.4 },
            { transform: at(p.x, p.y - 10), opacity: 1, offset: 0.65 },
            { transform: at(p.x + rand(-60, 60), p.y - rand(40, 90), 'rotate(300deg)'), opacity: 0 }
          ], { duration: T(800), delay: T(150 + i * 60), fill: 'both' }), node);
        }
      }
      await sleep(T(200));
      await banner('BLOCKED!', d.text || '', 'blue', 700);
      done(sh.animate([{ opacity: 1 }, { opacity: 0 }], { duration: T(200), fill: 'forwards' }), sh);
    },

    async airdrop(d) {
      const p = point({ tileId: d.tileId });
      const crate = spawn('crate', p.x, p.y, 48);
      await crate.animate([
        { transform: at(p.x, p.y - 160, 'rotate(-6deg)'), opacity: 0 },
        { transform: at(p.x, p.y - 100, 'rotate(6deg)'), opacity: 1, offset: 0.3 },
        { transform: at(p.x, p.y - 40, 'rotate(-6deg)'), offset: 0.65 },
        { transform: at(p.x, p.y, 'rotate(0deg)'), opacity: 1 }
      ], { duration: T(900), easing: 'ease-in-out', fill: 'forwards' }).finished.catch(() => {});
      done(crate.animate([
        { transform: at(p.x, p.y, 'scale(1)'), opacity: 1 },
        { transform: at(p.x, p.y, 'scale(1.3)'), opacity: 0 }
      ], { duration: T(220), fill: 'forwards' }), crate);
      burst({ x: p.x, y: p.y, count: 7, spread: 70, gravity: 60, life: 600, size: 14 });
      if (d.role) {
        if (d.icon) await flyIcon({ from: { tileId: d.tileId }, to: { role: d.role }, emoji: d.icon });
        else await coins({ from: { tileId: d.tileId }, to: { role: d.role }, amount: 150 });
      }
    },

    async finalBoarding(d = {}) {
      vignette(3);
      const mult = d.mult || 2;
      const el = document.createElement('div');
      el.className = 'moment-banner red';
      el.innerHTML = `<span class="mb-title">${mult >= 2 ? 'LAST CALL' : 'FINAL BOARDING'}</span><span class="mb-sub">ALL RENT ×${mult}</span>`;
      L.moment.appendChild(el);
      const W = L.moment.clientWidth;
      await done(el.animate([
        { transform: `translate(calc(-50% - ${W}px), -50%)`, opacity: 1 },
        { transform: 'translate(-50%, -50%)', opacity: 1, offset: 0.25 },
        { transform: 'translate(-50%, -50%) scale(1.05)', opacity: 1, offset: 0.75 },
        { transform: `translate(calc(-50% + ${W}px), -50%)`, opacity: 1 }
      ], { duration: T(1800), easing: 'cubic-bezier(.2,.8,.3,1)' }), el);
    },

    async bankrupt(d) {
      refs();
      if (L.wrap) L.wrap.classList.add('fx-desat');
      sfx('playMiss');
      const fall = d.role ? fallToken(d.role) : Promise.resolve();
      await sleep(T(250));
      await banner('BANKRUPT!', d.text || '', 'red', 900);
      await fall;
    },

    // 🎰 S4 Mythic: VIP High-Roller Express
    async vip_casino(d) {
      const c = center();
      flash('rgba(234, 179, 8, 0.45)', 250);
      sfx('playJackpot');
      vignette(2);
      const card = spawn('roulette', c.x, c.y - 15, 96, 'fx-glow-gold');
      card.animate([
        { transform: at(c.x, c.y - 15, 'scale(0) rotate(-30deg)'), opacity: 0 },
        { transform: at(c.x, c.y - 15, 'scale(1.25) rotate(15deg)'), opacity: 1, offset: 0.5 },
        { transform: at(c.x, c.y - 15, 'scale(1) rotate(0deg)'), opacity: 1 }
      ], { duration: T(700), fill: 'forwards' });

      burst({ x: c.x, y: c.y, name: 'coin', count: 14, spread: 220, up: 180, gravity: 600, life: 1000, size: 20 });
      burst({ x: c.x, y: c.y, name: 'sparkle', count: 12, spread: 160, up: 120, gravity: 200, life: 900, size: 16 });

      const b = banner('🎰 VIP HIGH-ROLLER EXPRESS!', d.text || 'STRAIGHT TO SKY CASINO! 💎', 'gold', 1100);
      await sleep(T(1200));
      done(card.animate([{ opacity: 1 }, { opacity: 0 }], { duration: T(250), fill: 'forwards' }), card);
      await b;
    },

    // 🍾 S4 Mythic: VIP Casino Entrance
    async vip_casino_entrance(d) {
      const c = center();
      flash('rgba(253, 224, 71, 0.55)', 250);
      sfx('playItem');
      vignette(2);
      const rope = spawn('roulette', c.x, c.y - 20, 96, 'fx-glow-gold');
      rope.animate([
        { transform: at(c.x, c.y - 20, 'scale(0) rotateY(-90deg)'), opacity: 0 },
        { transform: at(c.x, c.y - 20, 'scale(1.25) rotateY(15deg)'), opacity: 1, offset: 0.55 },
        { transform: at(c.x, c.y - 20, 'scale(1) rotateY(0deg)'), opacity: 1 }
      ], { duration: T(650), fill: 'forwards' });
      burst({ x: c.x, y: c.y, name: 'sparkle', count: 20, spread: 200, up: 160, gravity: 150, life: 950, size: 18 });
      burst({ x: c.x, y: c.y, name: 'coin', count: 12, spread: 150, up: 130, gravity: 400, life: 850, size: 20 });
      const b = banner('🍾 VIP HIGH-ROLLER SUITE!', 'VELVET ROPES UNHITCHED · WELCOME TO SKY CASINO! 🎰', 'gold', 1200);
      await sleep(T(1250));
      done(rope.animate([{ opacity: 1 }, { opacity: 0 }], { duration: T(200), fill: 'forwards' }), rope);
      await b;
    },

    // 🏆 S4 Mythic: High-Roller Jackpot Parade (Before avatar moves)
    async jackpot_celebration(d) {
      const p = point({ token: d.role });
      flash('rgba(255, 215, 0, 0.85)', 350);
      sfx('fanfare');
      shake('heavy');
      const trophy = spawn('gem', p.x, p.y - 45, 80, 'fx-glow-gold');
      trophy.animate([
        { transform: at(p.x, p.y - 130, 'scale(2.2)'), opacity: 0 },
        { transform: at(p.x, p.y - 45, 'scale(1)'), opacity: 1 }
      ], { duration: T(520), fill: 'forwards' });

      burst({ x: p.x, y: p.y - 30, name: 'coin', count: 26, spread: 270, up: 230, gravity: 500, life: 1250, size: 22 });
      burst({ x: p.x, y: p.y - 30, name: 'sparkle', count: 22, spread: 210, up: 180, gravity: 100, life: 1150, size: 18 });
      ring(p.x, p.y, 160, '#ffd700', 650);
      ring(p.x, p.y, 250, '#f59e0b', 850);

      const el = tok.el[d.role];
      if (el) {
        el.animate([
          { transform: el.style.transform },
          { transform: `${el.style.transform} translateY(-28px) scale(1.18)`, offset: 0.35 },
          { transform: el.style.transform, offset: 0.65 },
          { transform: `${el.style.transform} translateY(-18px) scale(1.12)`, offset: 0.82 },
          { transform: el.style.transform }
        ], { duration: T(850) });
      }

      await sleep(T(350));
      const b = banner('🏆 HIGH-ROLLER JACKPOT PARADE!', '+1,000 MILES CHAMPION VICTORY! 🍾✨', 'gold', 1350);
      await sleep(T(1350));
      done(trophy.animate([{ opacity: 1 }, { opacity: 0 }], { duration: T(200), fill: 'forwards' }), trophy);
      await b;
    },

    // 🎲 S4 Mythic: Loaded Battle Die
    async loaded_die(d) {
      const c = center();
      flash('rgba(239, 68, 68, 0.4)', 180);
      sfx('playBoom');
      shake('medium');
      const die = spawn('loaded_die', c.x, c.y, 88, 'fx-glow-red');
      die.animate([
        { transform: at(c.x, c.y - 120, 'scale(2.2) rotate(180deg)'), opacity: 0 },
        { transform: at(c.x, c.y, 'scale(1) rotate(0deg)'), opacity: 1 }
      ], { duration: T(380), easing: 'cubic-bezier(.17,.89,.32,1.28)', fill: 'forwards' });

      burst({ x: c.x, y: c.y, name: 'sparkle', count: 12, spread: 200, up: 150, gravity: 400, life: 800, size: 18 });
      ring(c.x, c.y, 130, '#ef4444', 500);
      await sleep(T(300));
      const b = banner('🎲 LOADED BATTLE DIE!', `MINIMUM ROLL: ${d.minRoll || 3} GUARANTEED!`, 'orange', 900);
      await sleep(T(900));
      done(die.animate([{ opacity: 1 }, { opacity: 0 }], { duration: T(220), fill: 'forwards' }), die);
      await b;
    },

    // 👑 S4 Mythic: Monaco High-Roller Hostile Takeover
    async monaco_takeover(d) {
      const p = point({ tileId: d.tileId });
      flash('rgba(234, 179, 8, 0.65)', 300);
      shake('heavy');
      sfx('playSwordClash');

      const oldFlag = spawn('flag_dxb', p.x, p.y - 10, 48);
      done(oldFlag.animate([
        { transform: at(p.x, p.y - 10, 'scale(1) rotate(0deg)'), opacity: 1 },
        { transform: at(p.x - 35, p.y + 45, 'scale(0.3) rotate(-75deg)'), opacity: 0 }
      ], { duration: T(450), fill: 'forwards' }), oldFlag);

      const crest = spawn('crown', p.x, p.y - 20, 72, 'fx-glow-gold');
      crest.animate([
        { transform: at(p.x, p.y - 110, 'scale(2.4) rotate(-35deg)'), opacity: 0 },
        { transform: at(p.x, p.y - 20, 'scale(1.2) rotate(10deg)'), opacity: 1, offset: 0.6 },
        { transform: at(p.x, p.y - 20, 'scale(1) rotate(0deg)'), opacity: 1 }
      ], { duration: T(580), easing: 'cubic-bezier(.17,.89,.32,1.28)', fill: 'forwards' });

      burst({ x: p.x, y: p.y - 10, name: 'coin', count: 20, spread: 220, up: 190, gravity: 500, life: 1100, size: 22 });
      burst({ x: p.x, y: p.y - 10, name: 'sparkle', count: 18, spread: 180, up: 150, gravity: 150, life: 950, size: 18 });
      ring(p.x, p.y - 10, 150, '#ffd700', 650);
      ring(p.x, p.y - 10, 220, '#ef4444', 850);
      sfx('playBoom');

      await sleep(T(350));
      const b = banner('👑 MONACO HIGH-ROLLER TAKEOVER!', `${d.text ? `${d.text} ` : ''}SEIZED UNDER CASINO LAW! 🎰`, 'gold', 1300);
      await sleep(T(1300));
      done(crest.animate([{ opacity: 1 }, { opacity: 0 }], { duration: T(250), fill: 'forwards' }), crest);
      await b;
    },

    // 🎲 S4 Mythic: Monaco High-Roller Exclusive Throw FX
    async monaco_highroller_throw(d) {
      const c = center();
      flash('rgba(234, 179, 8, 0.42)', 280);
      sfx('playJackpot');
      shake('medium');

      // Golden casino chip & diamond radial explosion
      burst({ x: c.x, y: c.y, name: 'coin', count: 18, spread: 220, up: 180, gravity: 480, life: 1000, size: 24 });
      burst({ x: c.x, y: c.y, name: 'sparkle', count: 16, spread: 180, up: 140, gravity: 120, life: 850, size: 18 });
      ring(c.x, c.y, 160, '#ffd700', 600);
      ring(c.x, c.y, 240, '#ef4444', 800);

      const roulette = spawn('monaco_roulette_wheel', c.x, c.y - 28, 84, 'fx-glow-gold');
      roulette.animate([
        { transform: at(c.x, c.y - 95, 'scale(2.2) rotate(-90deg)'), opacity: 0 },
        { transform: at(c.x, c.y - 28, 'scale(1.15) rotate(15deg)'), opacity: 1, offset: 0.6 },
        { transform: at(c.x, c.y - 28, 'scale(1) rotate(0deg)'), opacity: 1 }
      ], { duration: T(500), easing: 'cubic-bezier(.16, 1, 0.3, 1)', fill: 'forwards' });

      await sleep(T(300));
      const b = banner('🎰 MONTE CARLO ROLL!', `${d.text ? `${d.text} ` : ''}ROLLED A LUXURY ${d.rollVal}! 💎`, 'gold', 1000);
      await sleep(T(1000));
      done(roulette.animate([{ opacity: 1 }, { opacity: 0 }], { duration: T(220), fill: 'forwards' }), roulette);
      await b;
    },

    // 🎰 S4 Mythic: High-Roller Casino Rake (15% Luxury House Tax)
    async casino_rake(d) {
      const fromP = point({ token: d.fromRole });
      const toP = point({ token: d.toRole });
      const tileP = d.tileId != null ? point({ tileId: d.tileId }) : fromP;
      flash('rgba(245, 158, 11, 0.65)', 260);
      sfx('playCasinoRake');
      shake('medium');

      const chipStack = spawn('monaco_chip_stack', tileP.x, tileP.y, 82, 'fx-glow-gold');
      chipStack.animate([
        { transform: at(tileP.x, tileP.y, 'scale(0.2) rotate(-25deg)'), opacity: 0 },
        { transform: at(tileP.x, tileP.y, 'scale(1.22) rotate(10deg)'), opacity: 1, offset: 0.5 },
        { transform: at(tileP.x, tileP.y, 'scale(0.3) rotate(30deg)'), opacity: 0 }
      ], { duration: T(1150), fill: 'forwards' });

      ring(tileP.x, tileP.y, 140, '#ffd700', 600);
      ring(tileP.x, tileP.y, 220, '#10b981', 800);
      ring(toP.x, toP.y, 120, '#f59e0b', 700);
      coins({ from: { token: d.fromRole }, to: { token: d.toRole }, amount: d.amount || 80, delay: T(140) });
      burst({ x: tileP.x, y: tileP.y, name: 'coin', count: 18, spread: 180, up: 140, gravity: 350, life: 900, size: 22 });
      burst({ x: toP.x, y: toP.y, name: 'gem', count: 10, spread: 120, up: 90, gravity: 120, life: 750, size: 16 });

      await sleep(T(180));
      const b = banner('🎰 HIGH-ROLLER RAKE!', `+${d.amount}🪙 LUXURY HOUSE RAKE COLLECTED! 💎`, 'gold', 1100);
      await sleep(T(1050));
      chipStack.remove();
      await b;
    },

    // 🦪 S5 Mythic: Abyssal Pearl Ward Revival
    async pearl_ward(d) {
      const p = point({ token: d.role });
      flash('rgba(34, 211, 238, 0.65)', 350);
      sfx('fanfare');
      shake('heavy');
      const pearl = spawn('pearl', p.x, p.y, 80, 'fx-glow-cyan');
      pearl.animate([
        { transform: at(p.x, p.y - 80, 'scale(0)'), opacity: 0 },
        { transform: at(p.x, p.y, 'scale(1.3)'), opacity: 1, offset: 0.6 },
        { transform: at(p.x, p.y, 'scale(1)'), opacity: 1 }
      ], { duration: T(500), fill: 'forwards' });

      ring(p.x, p.y, 180, '#22d3ee', 700);
      ring(p.x, p.y, 260, '#0284c7', 900);
      burst({ x: p.x, y: p.y, name: 'sparkle', count: 16, spread: 180, up: 160, gravity: -30, life: 1200, size: 16 });

      const el = tok.el[d.role];
      if (el) el.classList.add('token-pearl-barrier');

      await sleep(T(200));
      const b = banner('🦪 ABYSSAL PEARL WARD!', 'DEBT ABSORPTION · +150 EMERGENCY ENERGY!', 'cyan', 1200);
      await sleep(T(1200));
      done(pearl.animate([{ opacity: 1 }, { opacity: 0 }], { duration: T(250), fill: 'forwards' }), pearl);
      await b;
    },

    // 🪼 S5 Mythic: Bioluminescent Drift & Abyssal Wave Surge
    async abyssal_wave_surge(d) {
      const c = center();
      vignette(3);
      flash('rgba(6, 182, 212, 0.75)', 400);
      sfx('playWhoosh');
      shake('medium');

      const wave = spawn('abyssal_tidal_crest', c.x, c.y, 160, 'fx-glow-cyan');
      wave.animate([
        { transform: at(c.x, c.y, 'scale(0.2) rotate(-90deg)'), opacity: 0 },
        { transform: at(c.x, c.y, 'scale(1.4) rotate(0deg)'), opacity: 1, offset: 0.35 },
        { transform: at(c.x, c.y, 'scale(1.85) rotate(45deg)'), opacity: 0.95, offset: 0.7 },
        { transform: at(c.x, c.y, 'scale(2.6) rotate(100deg)'), opacity: 0 }
      ], { duration: T(1350), easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });

      ring(c.x, c.y, 170, '#38bdf8', 550);
      ring(c.x, c.y, 270, '#06b6d4', 850);
      ring(c.x, c.y, 380, '#0284c7', 1100);

      burst({ x: c.x, y: c.y, name: 'sparkle', count: 28, spread: 320, up: 220, gravity: -90, life: 1100, size: 20 });
      burst({ x: c.x, y: c.y, name: 'gem', count: 12, spread: 220, up: 150, gravity: 120, life: 950, size: 16 });

      const el = tok.el[d.role];
      if (el) {
        el.classList.add('token-abyss-surf');
        setTimeout(() => el.classList.remove('token-abyss-surf'), 2000);
      }

      await sleep(T(200));
      const b = banner('🌊 ABYSSAL TIDAL DRIFT! 🪼', 'OCEAN CURRENTS SURGE +1 EXTRA TILE! 🔱✨', 'cyan', 1350);
      await sleep(T(1350));
      wave.remove();
      await b;
    },

    async ocean_drift(d) {
      return this.abyssal_wave_surge(d);
    },

    // 🌊 S5 Mythic: Abyssal Tidal Wave Throw
    async abyssal_sovereign_throw(d) {
      const p = point({ token: d.role }) || { x: L.W / 2, y: L.H / 2 };
      flash('rgba(6, 182, 212, 0.48)', 260);
      sfx('playAbyssalSplash');
      shake('medium');

      const wave = spawn('abyssal_tidal_crest', p.x, p.y - 18, 110, 'fx-glow-cyan');
      wave.animate([
        { transform: at(p.x, p.y - 75, 'scale(0.2) rotate(-40deg)'), opacity: 0 },
        { transform: at(p.x, p.y - 18, 'scale(1.25) rotate(15deg)'), opacity: 1, offset: 0.45 },
        { transform: at(p.x, p.y - 18, 'scale(1) rotate(0deg)'), opacity: 1 }
      ], { duration: T(650), fill: 'forwards' });

      ring(p.x, p.y, 160, '#06b6d4', 550);
      ring(p.x, p.y, 240, '#38bdf8', 800);
      burst({ x: p.x, y: p.y, name: 'sparkle', count: 20, spread: 220, up: 140, gravity: -20, life: 850, size: 18 });
      burst({ x: p.x, y: p.y, name: 'gem', count: 10, spread: 180, up: 160, gravity: 260, life: 900, size: 16 });

      await sleep(T(220));
      const b = banner('🌊 ABYSSAL TIDAL WAVE! 🔱', `${d.text ? `${d.text} ` : ''}ROLLED ${d.rollVal}! OCEAN CURRENTS SUMMONED 🪼`, 'cyan', 1100);
      await sleep(T(1050));
      done(wave.animate([{ opacity: 1 }, { opacity: 0 }], { duration: T(200), fill: 'forwards' }), wave);
      await b;
    },

    // ☄️ S6 Mythic 1: Supernova Overdrive (Extra Roll on 6)
    async supernova_leap(d) {
      const c = center();
      vignette(3);
      flash('rgba(253, 224, 71, 0.85)', 350);
      sfx('fanfare');
      shake('heavy');

      const core = spawn('supernova_core', c.x, c.y, 140, 'fx-glow-gold');
      core.animate([
        { transform: at(c.x, c.y, 'scale(0.1) rotate(0deg)'), opacity: 0 },
        { transform: at(c.x, c.y, 'scale(1.5) rotate(180deg)'), opacity: 1, offset: 0.4 },
        { transform: at(c.x, c.y, 'scale(1.2) rotate(360deg)'), opacity: 1, offset: 0.7 },
        { transform: at(c.x, c.y, 'scale(2.2) rotate(540deg)'), opacity: 0 }
      ], { duration: T(1400), easing: 'ease-out' });

      ring(c.x, c.y, 180, '#fde047', 600);
      ring(c.x, c.y, 280, '#a855f7', 900);
      ring(c.x, c.y, 380, '#38bdf8', 1100);
      burst({ x: c.x, y: c.y, name: 'sparkle', count: 32, spread: 320, up: 240, gravity: 120, life: 1200, size: 22 });
      burst({ x: c.x, y: c.y, name: 'coin', count: 12, spread: 220, up: 160, gravity: 300, life: 1000, size: 18 });

      const el = tok.el[d.role];
      if (el) {
        el.classList.add('token-supernova-aura');
      }

      await sleep(T(250));
      const b = banner('★ SUPERNOVA VELOCITY! ★', 'PERFECT 6 ROLLED · BONUS ROLL UNLOCKED! ☄️✨', 'gold', 1400);
      await sleep(T(1400));
      core.remove();
      await b;
    },

    // 🌌 S6 Mythic: Astral Sovereign Dice Landing
    async astral_sovereign_throw(d) {
      const p = point({ token: d.role }) || { x: L.W / 2, y: L.H / 2 };
      flash('rgba(168, 85, 247, 0.45)', 260);
      shake('medium');

      const sigil = spawn('constellation_sigil', p.x, p.y, 125, 'fx-glow-purple');
      sigil.animate([
        { transform: at(p.x, p.y, 'scale(0.2) rotate(-90deg)'), opacity: 0 },
        { transform: at(p.x, p.y, 'scale(1.4) rotate(0deg)'), opacity: 1, offset: 0.4 },
        { transform: at(p.x, p.y, 'scale(1.1) rotate(90deg)'), opacity: 0.95, offset: 0.7 },
        { transform: at(p.x, p.y, 'scale(1.7) rotate(180deg)'), opacity: 0 }
      ], { duration: T(850), fill: 'forwards' });

      ring(p.x, p.y, 160, '#c084fc', 550);
      ring(p.x, p.y, 250, '#38bdf8', 750);
      burst({ x: p.x, y: p.y, name: 'sparkle', count: 24, spread: 220, up: 140, gravity: 0, life: 850, size: 18 });
      await sleep(T(850));
      sigil.remove();
    },

    // 🌌 S6 Mythic: Astral Tithe (Airspace Toll)
    async star_tithe(d) {
      const fromP = point({ token: d.fromRole });
      const toP = point({ token: d.toRole });
      const tileP = d.tileId != null ? point({ tileId: d.tileId }) : fromP;
      flash('rgba(168, 85, 247, 0.72)', 280);
      sfx('playAstralSiphon');
      shake('medium');

      const vortexTile = spawn('vortex_nebula', tileP.x, tileP.y, 115, 'fx-glow-purple');
      vortexTile.animate([
        { transform: at(tileP.x, tileP.y, 'scale(0.1) rotate(0deg)'), opacity: 0 },
        { transform: at(tileP.x, tileP.y, 'scale(1.35) rotate(360deg)'), opacity: 1, offset: 0.4 },
        { transform: at(tileP.x, tileP.y, 'scale(1) rotate(720deg)'), opacity: 1, offset: 0.8 },
        { transform: at(tileP.x, tileP.y, 'scale(0.2) rotate(1080deg)'), opacity: 0 }
      ], { duration: T(1250), fill: 'forwards' });

      // Receiver token celestial vortex pull
      const vortexTo = spawn('vortex_nebula', toP.x, toP.y, 90, 'fx-glow-cyan');
      vortexTo.animate([
        { transform: at(toP.x, toP.y, 'scale(0.1) rotate(180deg)'), opacity: 0 },
        { transform: at(toP.x, toP.y, 'scale(1.2) rotate(540deg)'), opacity: 0.95, offset: 0.5 },
        { transform: at(toP.x, toP.y, 'scale(0.3) rotate(900deg)'), opacity: 0 }
      ], { duration: T(1250), fill: 'forwards' });

      ring(tileP.x, tileP.y, 140, '#c084fc', 600);
      ring(tileP.x, tileP.y, 220, '#38bdf8', 850);
      ring(toP.x, toP.y, 110, '#e879f9', 700);
      coins({ from: { token: d.fromRole }, to: { token: d.toRole }, amount: d.amount || 100, delay: T(160) });
      burst({ x: tileP.x, y: tileP.y, name: 'sparkle', count: 22, spread: 200, up: 140, gravity: -30, life: 950, size: 18 });
      burst({ x: toP.x, y: toP.y, name: 'gem', count: 12, spread: 130, up: 90, gravity: 120, life: 800, size: 16 });

      await sleep(T(180));
      const b = banner('🌌 ASTRAL TITHE!', `15% AIRSPACE TOLL (+${d.amount}🪙) SIPHONED! 🪐`, 'purple', 1200);
      await sleep(T(1150));
      vortexTile.remove();
      vortexTo.remove();
      await b;
    },

    // ✨ S6 Mythic: Constellation Rebirth Revival
    async constellation_rebirth(d) {
      const p = point({ token: d.role });
      flash('rgba(255, 255, 255, 0.98)', 320);
      sfx('fanfare');
      shake('heavy');

      const sigil = spawn('constellation_sigil', p.x, p.y, 150, 'fx-glow-gold');
      sigil.animate([
        { transform: at(p.x, p.y, 'scale(0) rotate(-180deg)'), opacity: 0 },
        { transform: at(p.x, p.y, 'scale(1.6) rotate(0deg)'), opacity: 1, offset: 0.5 },
        { transform: at(p.x, p.y, 'scale(1.25) rotate(90deg)'), opacity: 1, offset: 0.8 },
        { transform: at(p.x, p.y, 'scale(2.0) rotate(180deg)'), opacity: 0 }
      ], { duration: T(1600), fill: 'forwards' });

      ring(p.x, p.y, 220, '#ffd700', 800);
      ring(p.x, p.y, 340, '#c084fc', 1100);
      ring(p.x, p.y, 450, '#38bdf8', 1300);
      burst({ x: p.x, y: p.y, name: 'gem', count: 20, spread: 280, up: 220, gravity: 350, life: 1300, size: 22 });
      burst({ x: p.x, y: p.y, name: 'sparkle', count: 40, spread: 350, up: 280, gravity: 0, life: 1500, size: 24 });

      const el = tok.el[d.role];
      if (el) {
        el.classList.add('token-astral-crown');
        el.classList.add('token-astral-shield');
      }

      await sleep(T(250));
      const b = banner('✨ CONSTELLATION REBIRTH! ✨', 'DEBT SHATTERED · +180 COSMIC ENERGY! 🌌', 'gold', 1500);
      await sleep(T(1450));
      sigil.remove();
      await b;
    },

    // 🪐 S6 Mythic: Supernova Celestial Tithe (Void Lightning Rework)
    async void_lightning_tithe(d) {
      return voidLightningTithe(d);
    },
    async astral_tithe(d) {
      return voidLightningTithe(d);
    },
    // 🔱 S5 Mythic: Abyssal Tidal Cataclysm
    async abyss_cataclysm(d) {
      return abyssalCataclysm(d);
    },
    // 🎰 S4 Mythic: Royal Flush Gold Rush
    async monaco_gold_rush(d) {
      return monacoGoldRush(d);
    },
    // 🐉 S1 Mythic: Emerald Naga Surge
    async naga_surge(d) {
      return emeraldNagaSurge(d);
    },
    // ☀️ S2 Mythic: Solar-Lunar Eclipse Convergence
    async eclipse_convergence(d) {
      return eclipseConvergence(d);
    },
    // 🪔 S3 Mythic: Cosmic Genie Wish
    async djinn_wish(d) {
      return cosmicGenieWish(d);
    },
    // 🏮 S7 Mythic: Wish Upon a Lantern Festival
    async lantern_festival(d) {
      return lanternFestival(d);
    },
    // ⏳ S7 Mythic: The Chrono-Midnight Paradox
    async midnight_paradox(d) {
      return midnightParadox(d);
    },
    // 🌹 S7 Mythic: The Breaking of the Enchanted Rose Curse
    async breaking_the_curse(d) {
      return breakingTheCurse(d);
    },
    // 🦁 S7 Mythic: Beast Unleashed (Roll 6 Claw Pounce)
    async beast_pounce(d) {
      return beastPounce(d);
    },
    // 🕯️ S7 Mythic: Living Staff Torch Shield Parry
    async living_staff_parry(d) {
      return livingStaffParry(d);
    },
    // ❄️ S8 Mythic: Absolute Zero Cryo-Stasis
    async absolute_zero(d) {
      return absoluteZero(d);
    },
    // 🏺 S9 Mythic: Nile Seduction & Great Golden Pyramid
    async nile_seduction(d) {
      return nileSeduction(d);
    },
    // ☀️ S9 Mythic: Solar Wrath & Eye of Ra
    async solar_wrath(d) {
      return solarWrath(d);
    },
    // 🎭 S10 Mythic: Phantom Masquerade Curtain Call
    async phantom_curtain_call(d) {
      return phantomCurtainCall(d);
    },
    // 🎭 S10 Mythic: Reverse Rent Hex Inversion
    async phantom_reverse_hex(d) {
      return phantomReverseHex(d);
    },
    // 🎭 S10 Mythic: Phantom Masquerade Dice Landing
    async phantom_throw(d) {
      return phantomThrow(d);
    },
    // ⚡ S11 Mythic: Wrath of Olympus
    async olympus_wrath(d) {
      return wrathOfOlympus(d);
    },
    // ⚡ S11 Mythic: Zeus Orbital Lightning Smite (Rolling a 6)
    async zeus_lightning_smite(d) {
      return zeusLightningSmite(d);
    },
    // ⚡ S11 Mythic: Zeus Storm Shock (Early-Game Direct Strike)
    async zeus_storm_shock(d) {
      return zeusStormShock(d);
    },
    // ⚡ S11 Mount Olympus: Lightning Rod Discharge
    async lightning_rod_zap(d) {
      return lightningRodZap(d);
    },
    // ⚡ S11 Mythic: Olympus Thunder Dice Landing
    async olympus_throw(d) {
      return olympusThrow(d);
    },

    // 🏺 S9 Mythic: Gilded Sovereign Dice Landing (Nile Gold Bloom)
    async gilded_sovereign_throw(d) {
      const p = point({ token: d.role }) || { x: L.W / 2, y: L.H / 2 };
      flash('rgba(251, 191, 36, 0.48)', 260);
      shake('medium');

      const crest = spawn('constellation_sigil', p.x, p.y, 130, 'fx-glow-gold');
      crest.animate([
        { transform: at(p.x, p.y, 'scale(0.2) rotate(-90deg)'), opacity: 0 },
        { transform: at(p.x, p.y, 'scale(1.4) rotate(0deg)'), opacity: 1, offset: 0.4 },
        { transform: at(p.x, p.y, 'scale(1.1) rotate(90deg)'), opacity: 0.95, offset: 0.7 },
        { transform: at(p.x, p.y, 'scale(1.7) rotate(180deg)'), opacity: 0 }
      ], { duration: T(850), fill: 'forwards' });

      ring(p.x, p.y, 160, '#fbbf24', 550);
      ring(p.x, p.y, 260, '#fef08a', 750);
      burst({ x: p.x, y: p.y, name: 'coin', count: 12, spread: 180, up: 120, life: 750, size: 18 });
      burst({ x: p.x, y: p.y, name: 'sparkle', count: 20, spread: 220, up: 140, gravity: 0, life: 850, size: 18 });
      await sleep(T(850));
      crest.remove();
    },

    // ☀️ S9 Mythic: Solar Divinity Dice Landing (Solar Flare Shockwave)
    async solar_divinity_throw(d) {
      const p = point({ token: d.role }) || { x: L.W / 2, y: L.H / 2 };
      flash('rgba(245, 158, 11, 0.52)', 260);
      shake('medium');

      const crest = spawn('supernova_core', p.x, p.y, 130, 'fx-glow-gold');
      crest.animate([
        { transform: at(p.x, p.y, 'scale(0.2) rotate(-90deg)'), opacity: 0 },
        { transform: at(p.x, p.y, 'scale(1.4) rotate(0deg)'), opacity: 1, offset: 0.4 },
        { transform: at(p.x, p.y, 'scale(1.1) rotate(90deg)'), opacity: 0.95, offset: 0.7 },
        { transform: at(p.x, p.y, 'scale(1.7) rotate(180deg)'), opacity: 0 }
      ], { duration: T(850), fill: 'forwards' });

      ring(p.x, p.y, 170, '#f59e0b', 550);
      ring(p.x, p.y, 270, '#fef08a', 750);
      burst({ x: p.x, y: p.y, name: 'fire', count: 10, spread: 180, up: 120, life: 750, size: 20 });
      burst({ x: p.x, y: p.y, name: 'sparkle', count: 20, spread: 220, up: 140, gravity: 0, life: 850, size: 18 });
      await sleep(T(850));
      crest.remove();
    },

    // ❄️ S8 Mythic: Glacial Royalty Dice Landing (Subzero Frost Bloom)
    async glacial_royalty_throw(d) {
      const p = point({ token: d.role }) || { x: L.W / 2, y: L.H / 2 };
      flash('rgba(56, 189, 248, 0.48)', 260);
      shake('medium');

      const crest = spawn('glacial_frost_crest', p.x, p.y, 130, 'fx-glow-cyan');
      crest.animate([
        { transform: at(p.x, p.y, 'scale(0.2) rotate(-90deg)'), opacity: 0 },
        { transform: at(p.x, p.y, 'scale(1.4) rotate(0deg)'), opacity: 1, offset: 0.4 },
        { transform: at(p.x, p.y, 'scale(1.1) rotate(90deg)'), opacity: 0.95, offset: 0.7 },
        { transform: at(p.x, p.y, 'scale(1.7) rotate(180deg)'), opacity: 0 }
      ], { duration: T(850), fill: 'forwards' });

      ring(p.x, p.y, 160, '#38bdf8', 550);
      ring(p.x, p.y, 260, '#f0f8ff', 750);
      burst({ x: p.x, y: p.y, name: 'cryo_shatter_crystal', count: 10, spread: 180, up: 120, life: 750, size: 16 });
      burst({ x: p.x, y: p.y, name: 'sparkle', count: 20, spread: 220, up: 140, gravity: 0, life: 850, size: 18 });
      await sleep(T(850));
      crest.remove();
    },

    // ❄️ S8 Mythic Skill: Glacial Rent Shield & Permafrost Infliction
    async frost_shield_deflection(d) {
      const payerP = point({ token: d.payerRole || d.role });
      const tileP = d.tileId != null ? point({ tileId: d.tileId }) : payerP;
      flash('rgba(56, 189, 248, 0.68)', 300);
      sfx('playFrostShield');
      shake('medium');

      const shield = spawn('glacial_frost_crest', payerP.x, payerP.y, 140, 'fx-glow-cyan');
      shield.animate([
        { transform: at(payerP.x, payerP.y, 'scale(0.3) rotate(-45deg)'), opacity: 0 },
        { transform: at(payerP.x, payerP.y, 'scale(1.3) rotate(0deg)'), opacity: 1, offset: 0.3 },
        { transform: at(payerP.x, payerP.y, 'scale(1.1) rotate(45deg)'), opacity: 0.95, offset: 0.8 },
        { transform: at(payerP.x, payerP.y, 'scale(1.5) rotate(90deg)'), opacity: 0 }
      ], { duration: T(1200), fill: 'forwards' });

      const beam = spawn('starlight_ice_scepter', tileP.x, tileP.y - 20, 80, 'fx-glow-cyan');
      beam.animate([
        { transform: at(tileP.x, tileP.y - 20, 'scale(0.4) rotate(0deg)'), opacity: 0 },
        { transform: at(tileP.x, tileP.y - 20, 'scale(1.2) rotate(180deg)'), opacity: 1, offset: 0.4 },
        { transform: at(tileP.x, tileP.y - 20, 'scale(0.5) rotate(360deg)'), opacity: 0 }
      ], { duration: T(1100), fill: 'forwards' });

      ring(payerP.x, payerP.y, 150, '#38bdf8', 600);
      ring(tileP.x, tileP.y, 130, '#0284c7', 700);
      ring(tileP.x, tileP.y, 200, '#f0f8ff', 900);

      burst({ x: payerP.x, y: payerP.y, name: 'cryo_shatter_crystal', count: 12, spread: 160, up: 110, life: 800, size: 18 });
      burst({ x: tileP.x, y: tileP.y, name: 'gem', count: 10, spread: 140, up: 90, life: 750, size: 16 });

      const b = banner('❄️ GLACIAL PERMAFROST SHIELD! 🛡️', `50% RENT (-${d.absorbed || 100}🪙) ABSORBED · PROPERTY FROSTED (-30% RENT)! 🧊`, 'cyan', 1600);
      await sleep(T(1100));
      shield.remove();
      beam.remove();
      await b;
    },

    // ❄️ S8 Mythic Skill: Arctic Snowdrift Blizzard Trap Trigger
    async snowdrift_trap(d) {
      const tileP = d.tileId != null ? point({ tileId: d.tileId }) : center();
      const victimP = d.role ? point({ token: d.role }) : tileP;
      flash('rgba(224, 242, 254, 0.75)', 320);
      sfx('playGlacialImpact');
      shake('medium');

      const vortex = spawn('snowdrift_blizzard_vortex', tileP.x, tileP.y, 135, 'fx-glow-cyan');
      vortex.animate([
        { transform: at(tileP.x, tileP.y, 'scale(0.2) rotate(0deg)'), opacity: 0 },
        { transform: at(tileP.x, tileP.y, 'scale(1.4) rotate(720deg)'), opacity: 1, offset: 0.4 },
        { transform: at(tileP.x, tileP.y, 'scale(1.0) rotate(1440deg)'), opacity: 0.95, offset: 0.8 },
        { transform: at(tileP.x, tileP.y, 'scale(1.8) rotate(2160deg)'), opacity: 0 }
      ], { duration: T(1300), fill: 'forwards' });

      const victimEl = d.role ? (tok.el[d.role] || $(`${d.role}Token`)) : null;
      if (victimEl) victimEl.classList.add('fx-token-frozen-block');

      const badge = document.createElement('div');
      badge.className = 'fx-cryo-stasis-badge';
      badge.innerHTML = `❄️ ARCTIC SNOWDRIFT! 🧊<br><small style="font-size:10px;opacity:0.95;">-1 SPEED · DEALS FROZEN</small>`;
      badge.style.left = `${victimP.x}px`;
      badge.style.top = `${victimP.y - 32}px`;
      L.moment.appendChild(badge);

      ring(tileP.x, tileP.y, 160, '#38bdf8', 650);
      ring(tileP.x, tileP.y, 250, '#f0f8ff', 900);
      burst({ x: tileP.x, y: tileP.y, name: 'cryo_shatter_crystal', count: 14, spread: 200, up: 130, life: 850, size: 18 });
      burst({ x: tileP.x, y: tileP.y, name: 'sparkle', count: 24, spread: 240, up: 160, life: 1000, size: 20 });

      const b = banner('❄️ ARCTIC SNOWDRIFT TRAP! 🧊', `${d.text || 'BLINDING BLIZZARD ENCOUNTERED'} · SPEED PENALTY!`, 'cyan', 1500);
      await sleep(T(1200));
      vortex.remove();
      badge.remove();
      if (victimEl) victimEl.classList.remove('fx-token-frozen-block');
      await b;
    },

    // ❄️ S8 Glacial Citadel: ±1 AoE Blizzard Tithe
    async citadel_tithe(d) {
      const payerP = point({ token: d.payer }) || (d.tileId != null ? point({ tileId: d.tileId }) : center());
      const ownerP = point({ token: d.owner }) || center();
      flash('rgba(56, 189, 248, 0.55)', 260);
      sfx('playFrostShield');
      shake('light');

      ring(payerP.x, payerP.y, 140, '#38bdf8', 550);
      ring(payerP.x, payerP.y, 220, '#bae6fd', 750);
      coins({ from: { x: payerP.x, y: payerP.y }, to: { x: ownerP.x, y: ownerP.y }, amount: d.amount || 100 });
      burst({ x: payerP.x, y: payerP.y, name: 'cryo_shatter_crystal', count: 10, spread: 120, up: 80, life: 750, size: 16 });
      burst({ x: payerP.x, y: payerP.y, name: 'sparkle', count: 16, spread: 140, up: 90, life: 850, size: 16 });
    },

    // 🐉 S1 Mythic: Mekong River Hoard Harvest
    async naga_hoard_claim(d) {
      const p = point({ token: d.role }) || point({ tileId: 0 });
      flash('rgba(16, 185, 129, 0.65)', 320);
      sfx('playPassStart');
      shake('medium');

      const urn = spawn('naga_emerald_urn', p.x, p.y - 20, 105, 'fx-glow-green');
      urn.animate([
        { transform: at(p.x, p.y - 85, 'scale(0.2) rotate(-20deg)'), opacity: 0 },
        { transform: at(p.x, p.y - 20, 'scale(1.28) rotate(5deg)'), opacity: 1, offset: 0.5 },
        { transform: at(p.x, p.y - 20, 'scale(1) rotate(0deg)'), opacity: 1 }
      ], { duration: T(650), fill: 'forwards' });

      ring(p.x, p.y, 160, '#10b981', 650);
      ring(p.x, p.y, 240, '#ffd700', 850);
      burst({ x: p.x, y: p.y, name: 'coin', count: 26, spread: 260, up: 200, gravity: 350, life: 1100, size: 22 });
      burst({ x: p.x, y: p.y, name: 'sparkle', count: 24, spread: 220, up: 160, gravity: -40, life: 1000, size: 18 });

      await sleep(T(250));
      const b = banner('🐉 MEKONG RIVER HOARD! 🌊', `+${d.amount}🪙 HARVESTED FROM THE SACRED RIVER URN! 🪷`, 'green', 1400);
      await sleep(T(1200));
      urn.remove();
      await b;
    },

    // 🐉 S1 Mythic: Mekong River Warden Throw
    async naga_sovereign_throw(d) {
      const p = point({ token: d.role }) || { x: L.W / 2, y: L.H / 2 };
      flash('rgba(16, 185, 129, 0.45)', 260);
      sfx('playNagaImpact');
      shake('medium');

      const urn = spawn('naga_emerald_urn', p.x, p.y - 18, 110, 'fx-glow-green');
      urn.animate([
        { transform: at(p.x, p.y - 75, 'scale(0.2) rotate(-30deg)'), opacity: 0 },
        { transform: at(p.x, p.y - 18, 'scale(1.3) rotate(10deg)'), opacity: 1, offset: 0.45 },
        { transform: at(p.x, p.y - 18, 'scale(1) rotate(0deg)'), opacity: 1 }
      ], { duration: T(650), fill: 'forwards' });

      ring(p.x, p.y, 160, '#10b981', 550);
      ring(p.x, p.y, 240, '#ffd700', 800);
      burst({ x: p.x, y: p.y, name: 'sparkle', count: 20, spread: 220, up: 140, gravity: -20, life: 850, size: 18 });
      burst({ x: p.x, y: p.y, name: 'coin', count: 12, spread: 180, up: 160, gravity: 320, life: 900, size: 20 });

      await sleep(T(220));
      const b = banner('🐉 MEKONG RIVER CALL! 🌊', `${d.text ? `${d.text} ` : ''}ROLLED ${d.rollVal}! SACRED TIDES SUMMONED 🪷`, 'green', 1100);
      await sleep(T(1050));
      done(urn.animate([{ opacity: 1 }, { opacity: 0 }], { duration: T(200), fill: 'forwards' }), urn);
      await b;
    },

    // 🐉 S1 Mythic: Bangkok River Surge (C4 Water Shields)
    async naga_river_surge(d) {
      const p = point({ token: d.role }) || { x: L.W / 2, y: L.H / 2 };
      flash('rgba(16, 185, 129, 0.7)', 350);
      sfx('playNagaSplash');
      shake('medium');

      const urn = spawn('naga_emerald_urn', p.x, p.y - 20, 110, 'fx-glow-green');
      urn.animate([
        { transform: at(p.x, p.y - 70, 'scale(0.2)'), opacity: 0 },
        { transform: at(p.x, p.y - 20, 'scale(1.2)'), opacity: 1, offset: 0.5 },
        { transform: at(p.x, p.y - 20, 'scale(1)'), opacity: 1 }
      ], { duration: T(600), fill: 'forwards' });

      ring(p.x, p.y, 180, '#10b981', 600);
      ring(p.x, p.y, 260, '#06b6d4', 850);
      burst({ x: p.x, y: p.y, name: 'water', count: 26, spread: 260, up: 180, gravity: 260, life: 950, size: 20 });

      await sleep(T(200));
      const b = banner('🌊 BANGKOK RIVER SURGE! 🐉', 'EMERALD WATER SHIELDS CAST ON BANGKOK PROPERTIES! 🛡️', 'green', 1350);
      await sleep(T(1150));
      urn.remove();
      await b;
    },

    // 🐉 S1 Mythic: Sky Bridge River Surf
    async naga_bridge_surf(d) {
      const p = point({ token: d.role }) || { x: L.W / 2, y: L.H / 2 };
      flash('rgba(6, 182, 212, 0.7)', 300);
      sfx('playWhoosh');
      shake('medium');
      ring(p.x, p.y, 160, '#06b6d4', 600);
      burst({ x: p.x, y: p.y, name: 'water', count: 24, spread: 240, up: 160, gravity: 240, life: 900, size: 18 });
      await banner('🏄‍♂️ SKY BRIDGE RIVER SURF! 🌊', 'SURFING WATER HIGHWAY DIRECTLY TO START! 🛫', 'cyan', 1200);
    },

    // 🦊 S2-A Mythic: The 3 Foxfire Tails & Haunted Lands Curse
    async inari_foxfire_curse(d) {
      const p = point({ token: d.role }) || { x: L.W / 2, y: L.H / 2 };
      flash('rgba(236, 72, 153, 0.75)', 320);
      sfx('playInariFoxfire');
      shake('medium');

      const sigil = spawn('inari_foxfire_sigil', p.x, p.y - 15, 110, 'fx-glow-purple');
      sigil.animate([
        { transform: at(p.x, p.y - 65, 'scale(0.1) rotate(-45deg)'), opacity: 0 },
        { transform: at(p.x, p.y - 15, 'scale(1.3) rotate(10deg)'), opacity: 1, offset: 0.45 },
        { transform: at(p.x, p.y - 15, 'scale(1) rotate(0deg)'), opacity: 1 }
      ], { duration: T(600), fill: 'forwards' });

      ring(p.x, p.y, 170, '#ec4899', 600);
      ring(p.x, p.y, 250, '#a855f7', 850);
      burst({ x: p.x, y: p.y, name: 'sparkle', count: 24, spread: 240, up: 160, gravity: -30, life: 950, size: 18 });

      await sleep(T(200));
      const b = banner('🦊 FOXFIRE WARD & CURSE! 🔥', 'RENT WAIVED TO 0 · SPIRIT TAIL USED · LAND CURSED! 🌸', 'magenta', 1350);
      await sleep(T(1150));
      sigil.remove();
      await b;
    },

    // 🦊 S2-A Mythic: Foxfire Tail Recharged
    async inari_tail_recharge(d) {
      const p = point({ token: d.role }) || { x: L.W / 2, y: L.H / 2 };
      flash('rgba(236, 72, 153, 0.5)', 250);
      sfx('playInariFoxfire');
      shake('light');
      ring(p.x, p.y, 140, '#ec4899', 500);
      burst({ x: p.x, y: p.y, name: 'sparkle', count: 18, spread: 180, up: 140, gravity: -20, life: 800, size: 16 });
      await banner('🦊 SPIRIT TAIL RESTORED! ✨', `${d.text || '+1 Foxfire Tail!'} (Max 3) 🌸`, 'magenta', 1000);
    },

    // 🦊 S2-A Mythic: Spirit Tribute Paid to Inari
    async inari_spirit_tribute(d) {
      const fromP = point({ token: d.fromRole }) || { x: L.W / 2, y: L.H / 2 };
      const toP = point({ token: d.toRole }) || { x: L.W / 2, y: L.H / 2 };
      flash('rgba(168, 85, 247, 0.55)', 250);
      sfx('playCoin');
      shake('light');
      ring(fromP.x, fromP.y, 130, '#a855f7', 500);
      ring(toP.x, toP.y, 140, '#ec4899', 600);
      coins({ from: { token: d.fromRole }, to: { token: d.toRole }, amount: d.amount || 40, delay: T(120) });
      burst({ x: toP.x, y: toP.y, name: 'sparkle', count: 12, spread: 140, up: 120, gravity: -20, life: 800, size: 16 });
      await sleep(T(150));
      await banner('🦊 FOXFIRE SPIRIT TRIBUTE! 🌸', `+${d.amount || 40}🪙 Paid to Inari for Visiting Cursed Land! 🔥`, 'magenta', 1100);
    },

    // 🦊 S2-A Mythic: Kitsune Foxfire Ward & Leap (Legacy Fallback)
    async inari_foxfire_leap(d) {
      const p = point({ token: d.role });
      flash('rgba(236, 72, 153, 0.75)', 320);
      sfx('playWhoosh');
      shake('medium');

      const sigil = spawn('inari_foxfire_sigil', p.x, p.y - 15, 100, 'fx-glow-purple');
      sigil.animate([
        { transform: at(p.x, p.y - 65, 'scale(0.1) rotate(-45deg)'), opacity: 0 },
        { transform: at(p.x, p.y - 15, 'scale(1.3) rotate(10deg)'), opacity: 1, offset: 0.45 },
        { transform: at(p.x, p.y - 15, 'scale(1) rotate(0deg)'), opacity: 1 }
      ], { duration: T(600), fill: 'forwards' });

      ring(p.x, p.y, 170, '#ec4899', 600);
      ring(p.x, p.y, 250, '#22d3ee', 850);
      burst({ x: p.x, y: p.y, name: 'sparkle', count: 22, spread: 240, up: 160, gravity: -30, life: 950, size: 18 });

      await sleep(T(200));
      const b = banner('🦊 KITSUNE FOXFIRE WARD! 🔥', 'RENT NEGATED · SPIRIT LEAP +1 TILE FORWARD! 🌸', 'magenta', 1300);
      await sleep(T(1100));
      sigil.remove();
      await b;
    },

    // 🦊 S2-A Mythic: Kitsune Spirit Dive Throw
    async inari_foxfire_throw(d) {
      const p = point({ token: d.role }) || { x: L.W / 2, y: L.H / 2 };
      flash('rgba(236, 72, 153, 0.48)', 260);
      sfx('playInariImpact');
      shake('light');

      const sigil = spawn('inari_foxfire_sigil', p.x, p.y - 18, 105, 'fx-glow-purple');
      sigil.animate([
        { transform: at(p.x, p.y - 65, 'scale(0.15) rotate(-60deg)'), opacity: 0 },
        { transform: at(p.x, p.y - 18, 'scale(1.25) rotate(10deg)'), opacity: 1, offset: 0.45 },
        { transform: at(p.x, p.y - 18, 'scale(1) rotate(0deg)'), opacity: 1 }
      ], { duration: T(600), fill: 'forwards' });

      ring(p.x, p.y, 160, '#ec4899', 550);
      ring(p.x, p.y, 230, '#22d3ee', 750);
      burst({ x: p.x, y: p.y, name: 'sparkle', count: 22, spread: 220, up: 150, gravity: -30, life: 850, size: 18 });

      await sleep(T(200));
      const b = banner('🦊 KITSUNE SPIRIT DIVE! 🔥', `${d.text ? `${d.text} ` : ''}ROLLED ${d.rollVal}! MYSTICAL WINDS CHANNELLED 🌸`, 'magenta', 1100);
      await sleep(T(1050));
      done(sigil.animate([{ opacity: 1 }, { opacity: 0 }], { duration: T(200), fill: 'forwards' }), sigil);
      await b;
    },

    // 🌓 S2-B Mythic: Celestial Eclipse Stance Shift
    async eclipse_stance_shift(d) {
      const p = point({ token: d.role }) || { x: L.W / 2, y: L.H / 2 };
      const isSun = d.stance === 'sun';
      flash(isSun ? 'rgba(234, 179, 8, 0.65)' : 'rgba(99, 102, 241, 0.65)', 280);
      sfx('playEclipseImpact');
      shake('light');

      const crest = spawn('eclipse_yin_yang', p.x, p.y - 20, 95, isSun ? 'fx-glow-gold' : 'fx-glow-purple');
      crest.animate([
        { transform: at(p.x, p.y - 60, 'scale(0.2) rotate(180deg)'), opacity: 0 },
        { transform: at(p.x, p.y - 20, 'scale(1.25) rotate(0deg)'), opacity: 1, offset: 0.5 },
        { transform: at(p.x, p.y - 20, 'scale(1) rotate(0deg)'), opacity: 1 }
      ], { duration: T(650), fill: 'forwards' });

      ring(p.x, p.y, 160, isSun ? '#ffd700' : '#818cf8', 650);
      burst({ x: p.x, y: p.y, name: 'sparkle', count: 18, spread: 200, up: 140, gravity: -20, life: 850, size: 16 });

      await sleep(T(200));
      const b = banner(
        isSun ? '☀️ SOLAR STANCE AWAKENED!' : '🌙 LUNAR STANCE AWAKENED!',
        `${d.text ? `${d.text} ` : ''}ROLLED ${d.rollVal || '✨'} · ${isSun ? '+20% RENT ON ALL OWNED PROPERTIES! 👑' : '-25% TOLL ON ALL RIVAL DOMAINS! 🛡️'}`,
        isSun ? 'gold' : 'indigo',
        1200
      );
      await sleep(T(1100));
      done(crest.animate([{ opacity: 1 }, { opacity: 0 }], { duration: T(200), fill: 'forwards' }), crest);
      await b;
    },

    // 🧞 S3-A Mythic: Starlight Djinn Mirage Throw
    async djinn_sovereign_throw(d) {
      const p = point({ token: d.role }) || { x: L.W / 2, y: L.H / 2 };
      flash('rgba(245, 158, 11, 0.45)', 260);
      sfx('playDjinnImpact');
      shake('light');

      const lamp = spawn('djinn_magic_lamp', p.x, p.y - 18, 105, 'fx-glow-gold');
      lamp.animate([
        { transform: at(p.x, p.y - 70, 'scale(0.2) rotate(-20deg)'), opacity: 0 },
        { transform: at(p.x, p.y - 18, 'scale(1.25) rotate(10deg)'), opacity: 1, offset: 0.45 },
        { transform: at(p.x, p.y - 18, 'scale(1) rotate(0deg)'), opacity: 1 }
      ], { duration: T(600), fill: 'forwards' });

      ring(p.x, p.y, 160, '#f59e0b', 550);
      ring(p.x, p.y, 240, '#c084fc', 800);
      burst({ x: p.x, y: p.y, name: 'gem', count: 12, spread: 200, up: 150, gravity: 240, life: 850, size: 18 });
      burst({ x: p.x, y: p.y, name: 'sparkle', count: 18, spread: 220, up: 140, gravity: -20, life: 900, size: 16 });

      await sleep(T(200));
      const b = banner('🧞 DESERT MIRAGE CAST! 🪔', `${d.text ? `${d.text} ` : ''}ROLLED ${d.rollVal}! STARLIGHT SULTAN 💎`, 'gold', 1100);
      await sleep(T(1050));
      done(lamp.animate([{ opacity: 1 }, { opacity: 0 }], { duration: T(200), fill: 'forwards' }), lamp);
      await b;
    },

    // 🧞 S3-A Mythic: Djinn Magic Carpet Flight
    async djinn_carpet_glide(d) {
      const p = point({ token: d.role });
      flash('rgba(245, 158, 11, 0.68)', 320);
      sfx('playWhoosh');
      shake('medium');

      const lamp = spawn('djinn_magic_lamp', p.x, p.y - 25, 110, 'fx-glow-gold');
      lamp.animate([
        { transform: at(p.x, p.y - 80, 'scale(0.2) rotate(-25deg)'), opacity: 0 },
        { transform: at(p.x, p.y - 25, 'scale(1.3) rotate(10deg)'), opacity: 1, offset: 0.5 },
        { transform: at(p.x, p.y - 25, 'scale(1) rotate(0deg)'), opacity: 1 }
      ], { duration: T(650), fill: 'forwards' });

      ring(p.x, p.y, 180, '#f59e0b', 700);
      ring(p.x, p.y, 260, '#c084fc', 900);
      burst({ x: p.x, y: p.y, name: 'gem', count: 14, spread: 220, up: 180, gravity: 280, life: 950, size: 18 });
      burst({ x: p.x, y: p.y, name: 'sparkle', count: 24, spread: 250, up: 160, gravity: -40, life: 1100, size: 18 });

      await sleep(T(200));
      const b = banner('🧞 MAGIC CARPET FLIGHT! 🪔', 'DOUBLES ROLLED · 100% IMMUNE TO ALL RIVAL RENT! ✨', 'gold', 1350);
      await sleep(T(1200));
      lamp.remove();
      await b;
    },

    // 🪔 S3-A Mythic: Desert Mirage Tribute Siphon
    async djinn_mirage_tribute(d) {
      const fromP = point({ token: d.fromRole });
      const toP = point({ token: d.toRole });
      flash('rgba(245, 158, 11, 0.55)', 250);
      sfx('playCoin');
      shake('light');

      ring(fromP.x, fromP.y, 120, '#f59e0b', 500);
      ring(toP.x, toP.y, 140, '#c084fc', 600);
      coins({ from: { token: d.fromRole }, to: { token: d.toRole }, amount: d.amount || 35, delay: T(120) });
      burst({ x: toP.x, y: toP.y, name: 'gem', count: 8, spread: 120, up: 100, gravity: 120, life: 750, size: 16 });

      await sleep(T(150));
      const b = banner('🪔 DESERT MIRAGE TRIBUTE! 💎', `+${d.amount || 35}🪙 SIPHONED FROM RIVAL PASSING THROUGH! 🌪️`, 'gold', 1100);
      await sleep(T(1050));
      await b;
    },

    // 🔥 S3-B Mythic: Immortal Phoenix Ascent Throw
    async phoenix_sovereign_throw(d) {
      const p = point({ token: d.role }) || { x: L.W / 2, y: L.H / 2 };
      flash('rgba(239, 68, 68, 0.55)', 280);
      sfx('playPhoenixImpact');
      shake('medium');

      const pyre = spawn('phoenix_pyre_crest', p.x, p.y - 18, 110, 'fx-glow-red');
      pyre.animate([
        { transform: at(p.x, p.y - 80, 'scale(0.2) rotate(-35deg)'), opacity: 0 },
        { transform: at(p.x, p.y - 18, 'scale(1.3) rotate(10deg)'), opacity: 1, offset: 0.45 },
        { transform: at(p.x, p.y - 18, 'scale(1) rotate(0deg)'), opacity: 1 }
      ], { duration: T(650), fill: 'forwards' });

      ring(p.x, p.y, 180, '#ef4444', 600);
      ring(p.x, p.y, 260, '#ffd700', 850);
      burst({ x: p.x, y: p.y, name: 'explosion', count: 12, spread: 220, up: 180, gravity: 200, life: 900, size: 22 });
      burst({ x: p.x, y: p.y, name: 'sparkle', count: 20, spread: 240, up: 180, gravity: -30, life: 950, size: 18 });

      await sleep(T(220));
      const b = banner('🔥 SOLAR PYRE ASCENT! 🪶', `${d.text ? `${d.text} ` : ''}ROLLED ${d.rollVal}! IMMORTAL FLAMES IGNITED ☀️`, 'red', 1100);
      await sleep(T(1050));
      done(pyre.animate([{ opacity: 1 }, { opacity: 0 }], { duration: T(200), fill: 'forwards' }), pyre);
      await b;
    },

    // 🐉 S1 Mythic: Mekong Hoard Siphoned by Rival
    async naga_hoard_siphon(d) {
      const p = point({ tileId: 0 });
      flash('rgba(16, 185, 129, 0.45)', 160);
      sfx('playMirageSiphon');
      shake('medium');
      ring(p.x, p.y, 90, '#10b981', 500);
      burst({ x: p.x, y: p.y, name: 'coin', count: 8, spread: 80, gravity: 90, life: 600, size: 16 });
      await banner('HOARD RAIDED! 🏴‍☠️', `+${d.amount}🪙 looted!`, 'green', 800);
    },

    // 🔥 S3-B Mythic: Immortal Phoenix Ash Rebirth
    async phoenix_rebirth_flare(d) {
      const p = point({ token: d.role });
      flash('rgba(239, 68, 68, 0.85)', 400);
      sfx('fanfare');
      shake('heavy');

      const pyre = spawn('phoenix_pyre_crest', p.x, p.y - 25, 120, 'fx-glow-gold');
      pyre.animate([
        { transform: at(p.x, p.y - 95, 'scale(0.1) rotate(-45deg)'), opacity: 0 },
        { transform: at(p.x, p.y - 25, 'scale(1.4) rotate(15deg)'), opacity: 1, offset: 0.45 },
        { transform: at(p.x, p.y - 25, 'scale(1) rotate(0deg)'), opacity: 1 }
      ], { duration: T(700), fill: 'forwards' });

      ring(p.x, p.y, 200, '#ef4444', 750);
      ring(p.x, p.y, 300, '#f59e0b', 1000);
      ring(p.x, p.y, 400, '#ffd700', 1200);
      burst({ x: p.x, y: p.y, name: 'explosion', count: 18, spread: 260, up: 220, gravity: 150, life: 1100, size: 24 });
      burst({ x: p.x, y: p.y, name: 'sparkle', count: 32, spread: 320, up: 260, gravity: -50, life: 1300, size: 20 });

      await sleep(T(250));
      const b = banner('🔥 IMMORTAL PHOENIX REBIRTH! 🪶', 'DEBT CONSUMED · +250 MILES & PHOENIX GRACE WARD! ☀️', 'red', 1500);
      await sleep(T(1350));
      pyre.remove();
      await b;
    },

    // 🔥 S3-B Mythic: Phoenix Ash Pot Gathering
    async phoenix_ash_pot(d) {
      const p = point({ token: d.role }) || { x: L.W / 2, y: L.H / 2 };
      flash('rgba(239, 68, 68, 0.45)', 200);
      sfx('playPhoenixFlames');
      ring(p.x, p.y, 120, '#f97316', 450);
      burst({ x: p.x, y: p.y, name: 'sparkle', count: 14, spread: 140, up: 100, gravity: -20, life: 750, size: 16 });
      await banner('🔥 ASH GATHERED! 🏺', `${d.text || 'Ash Stored in Pot'} (40% Refund at Start) 🦅`, 'red', 950);
    },

    // 🔥 S3-B Mythic: Phoenix Ash Refund at Start
    async phoenix_ash_refund(d) {
      const p = point({ token: d.role }) || { x: L.W / 2, y: L.H / 2 };
      flash('rgba(245, 158, 11, 0.8)', 350);
      sfx('playPhoenixRebirth');
      shake('medium');

      const pyre = spawn('phoenix_pyre_crest', p.x, p.y - 25, 120, 'fx-glow-gold');
      pyre.animate([
        { transform: at(p.x, p.y - 80, 'scale(0.2)'), opacity: 0 },
        { transform: at(p.x, p.y - 25, 'scale(1.3)'), opacity: 1, offset: 0.5 },
        { transform: at(p.x, p.y - 25, 'scale(1)'), opacity: 1 }
      ], { duration: T(650), fill: 'forwards' });

      ring(p.x, p.y, 180, '#f59e0b', 650);
      ring(p.x, p.y, 250, '#ef4444', 850);
      burst({ x: p.x, y: p.y, name: 'coin', count: 20, spread: 220, up: 180, gravity: 280, life: 950, size: 20 });
      burst({ x: p.x, y: p.y, name: 'sparkle', count: 22, spread: 240, up: 160, gravity: -30, life: 950, size: 18 });

      await sleep(T(200));
      const b = banner('🔥 ASH REBIRTH IGNITION! 🦅', `+${d.amount}🪙 100% ASH REFUNDED FROM THE FLAME POT! ☀️`, 'gold', 1350);
      await sleep(T(1150));
      pyre.remove();
      await b;
    },

    // 🔥 S3-B Mythic: Phoenix Casino Cleanse
    async phoenix_casino_cleanse(d) {
      const p = point({ token: d.role }) || { x: L.W / 2, y: L.H / 2 };
      flash('rgba(245, 158, 11, 0.85)', 350);
      sfx('playPhoenixImpact');
      shake('medium');
      ring(p.x, p.y, 180, '#f59e0b', 650);
      burst({ x: p.x, y: p.y, name: 'explosion', count: 14, spread: 220, up: 160, gravity: 180, life: 900, size: 20 });
      await banner('🔥 PHOENIX FLAME CLEANSE! 🎰', 'CURSED SKULL INCINERATED → CONVERTED TO +100🪙 REWARD! 🪶', 'gold', 1300);
    },

    // 🪔 S3-A Mythic: Genie's Lucky Wish
    async djinn_lucky_wish(d) {
      const p = point({ token: d.role }) || { x: L.W / 2, y: L.H / 2 };
      flash('rgba(245, 158, 11, 0.65)', 250);
      sfx('playDjinnCarpet');
      shake('light');
      ring(p.x, p.y, 150, '#f59e0b', 550);
      burst({ x: p.x, y: p.y, name: 'gem', count: 12, spread: 180, up: 140, gravity: 180, life: 800, size: 18 });
      await banner("🪔 GENIE'S LUCKY WISH! ✨", `+${d.amount}🪙 WISH MILES GRANTED BY MAGIC LAMP! 💎`, 'gold', 1100);
    },

    // 🍸 S4 Mythic: Monaco Grand Hotel VIP Dividend
    async monaco_vip_dividend(d) {
      const p = point({ token: d.role }) || { x: L.W / 2, y: L.H / 2 };
      flash('rgba(234, 179, 8, 0.75)', 280);
      sfx('playJackpot');
      shake('light');
      ring(p.x, p.y, 160, '#ffd700', 600);
      burst({ x: p.x, y: p.y, name: 'coin', count: 18, spread: 200, up: 160, gravity: 260, life: 900, size: 20 });
      await banner('🎰 GRAND HOTEL VIP DIVIDEND! 🍸', `+${d.amount}🪙 COLLECTED FROM YOUR LUXURY PENTHOUSE! 🥂`, 'gold', 1250);
    },

    // 🍌 Banana Trap Slip
    async banana_slip(d) {
      const p = point({ token: d.role }) || { x: L.W / 2, y: L.H / 2 };
      flash('rgba(250, 204, 21, 0.65)', 250);
      sfx('playBananaSlip');
      shake('medium');
      ring(p.x, p.y, 140, '#facc15', 500);
      burst({ x: p.x, y: p.y, name: 'sparkle', count: 16, spread: 180, up: 140, gravity: 200, life: 750, size: 18 });
      await banner('🍌 WHOOSH! BANANA SLIP! 💨', 'SLIPPED ON A TRAP · SLID +2 TILES FORWARD! 💫', 'gold', 1200);
    }
  };

  async function dropBuilding(d, name, dropPx, size, shakeLvl, dust, title) {
    const p = point({ tileId: d.tileId });
    const node = spawn(name, p.x, p.y, size);
    await node.animate([
      { transform: at(p.x, p.y - dropPx, 'scale(1.4)'), opacity: 0, filter: 'blur(2px)' },
      { transform: at(p.x, p.y - dropPx * 0.6, 'scale(1.3)'), opacity: 1, filter: 'blur(1px)', offset: 0.3 },
      { transform: at(p.x, p.y, 'scale(1)'), opacity: 1, filter: 'blur(0px)' }
    ], { duration: T(420), easing: 'cubic-bezier(.55,0,1,.45)', fill: 'forwards' }).finished.catch(() => {});
    sfx('playThud');
    shake(shakeLvl);
    ring(p.x, p.y, Math.max(40, p.w * 1.2), '#fde047', 500);
    burst({ x: p.x, y: p.y + p.h * 0.25, name: 'smoke', count: dust, spread: 70, up: 20, gravity: 0, life: 700, size: 20, filter: 'sepia(0.7) brightness(1.15)', rotate: false });
    let b = Promise.resolve();
    if (title) b = banner(title, d.text || '', '', 900);
    await sleep(T(title ? 900 : 250));
    await done(node.animate([
      { transform: at(p.x, p.y, 'scale(1)'), opacity: 1 },
      { transform: at(p.x + p.w * 0.3, p.y - p.h * 0.45, 'scale(0.3)'), opacity: 0 }
    ], { duration: T(350), easing: 'ease-in', fill: 'forwards' }), node);
    await b;
  }

  function moment(id, data = {}) {
    return new Promise((resolve) => {
      queue.push({ id, data, resolve });
      pump();
    });
  }

  async function pump() {
    if (running) return;
    running = true;
    while (queue.length) {
      const m = queue.shift();
      try {
        refs();
        if (L.moment && MOMENTS[m.id]) await MOMENTS[m.id](m.data || {});
      } catch (e) {
        console.warn('[MonoFX] moment failed:', m.id, e);
      }
      m.resolve();
    }
    running = false;
  }

  function busy() { return running || queue.length > 0 || holds > 0; }
  function hold(ms) { holds++; setTimeout(() => { holds = Math.max(0, holds - 1); }, ms); }

  // =========================================================
  // 8. DEFERRED TILE FX (wait for the card overlay to close)
  // =========================================================
  const deferred = [];
  function cardOverlayOpen() {
    const ov = $('balanceGameOverlay');
    return !!(ov && ov.classList.contains('active'));
  }
  function deferTileFx(fn) { deferred.push(fn); }
  function runTileFx(fn) { if (cardOverlayOpen()) deferred.push(fn); else fn(); }
  function flushTileFx() {
    const list = deferred.splice(0);
    list.forEach((fn, i) => setTimeout(() => { try { fn(); } catch (e) {} }, 300 + i * 120));
  }

  // =========================================================
  // 9. VIBE REVEAL HELPERS
  // =========================================================
  function heartBurst(x, y) {
    burst({ x, y, name: 'heart', count: 16, spread: 150, up: 140, gravity: -60, life: 1200, size: 18 });
  }

  function brokenHeart(x, y) {
    if (!refs()) return;
    const size = 64;
    ['L', 'R'].forEach((side) => {
      const node = spawn('heart', x, y, size);
      node.style.clipPath = side === 'L'
        ? 'polygon(0 0, 50% 0, 42% 25%, 56% 45%, 44% 65%, 52% 100%, 0 100%)'
        : 'polygon(50% 0, 100% 0, 100% 100%, 52% 100%, 44% 65%, 56% 45%, 42% 25%)';
      const dir = side === 'L' ? -1 : 1;
      done(node.animate([
        { transform: at(x, y, 'scale(0.6)'), opacity: 0 },
        { transform: at(x, y, 'scale(1)'), opacity: 1, offset: 0.2 },
        { transform: at(x + dir * 14, y, `rotate(${dir * 18}deg)`), opacity: 1, offset: 0.5 },
        { transform: at(x + dir * 30, y + 70, `rotate(${dir * 30}deg)`), opacity: 0 }
      ], { duration: T(1000), easing: 'ease-in' }), node);
    });
  }

  // =========================================================
  // 10. SLOT MACHINE
  // =========================================================
  function symHtml(sym) {
    const name = SLOT_ASSET[sym];
    return `<div class="slot-cell">${name ? visualHtml(name, 'slot-sym') : `<span class="fx-emoji slot-sym">${sym}</span>`}</div>`;
  }

  function slotHtml(reels) {
    const lever = assetUrl('lever')
      ? visualHtml('lever', 'lever-img')
      : '<span class="lever-rod"></span><span class="lever-knob"></span>';
    return `<div class="slot-machine-v2" id="slotMachine">
      <div class="slot-marquee"></div>
      <div class="slot-body">
        <div class="slot-windows">
          ${reels.map((s, i) => `<div class="slot-window" id="slotWin${i}"><div class="slot-strip" id="slotStrip${i}">${symHtml(s)}</div></div>`).join('')}
          <div class="slot-payline"></div>
        </div>
        <div class="slot-lever" id="slotLever"><div class="lever-arm">${lever}</div><span class="lever-base"></span></div>
      </div>
    </div>`;
  }

  function randomReels() {
    return [0, 1, 2].map(() => SLOT_POOL[Math.floor(Math.random() * SLOT_POOL.length)]);
  }

  function pullLever() {
    const lever = $('slotLever');
    if (lever) restartClass(lever, 'pulled', 650);
  }

  let slotTick = null;
  function spinSlots(finalReels, onDone) {
    pullLever();
    const machine = $('slotMachine');
    if (machine) machine.classList.add('spinning');
    const tease = finalReels[0] === finalReels[1];
    const durs = [1000, 1400, tease ? 2600 : 1800].map(T);
    let stopped = 0;
    clearInterval(slotTick);
    const startTick = (ms) => { clearInterval(slotTick); slotTick = setInterval(() => sfx('playSlotTick'), ms); };
    startTick(60);
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearInterval(slotTick);
      if (machine) machine.classList.remove('spinning');
      const w2 = $('slotWin2');
      if (w2) w2.classList.remove('tease');
      const [a, b, c] = finalReels;
      const wins = a === b && b === c ? [0, 1, 2] : a === b ? [0, 1] : b === c ? [1, 2] : a === c ? [0, 2] : [];
      wins.forEach((i) => { const w = $(`slotWin${i}`); if (w) w.classList.add('win-cell'); });
      if (onDone) onDone();
    };
    finalReels.forEach((sym, i) => {
      const strip = $(`slotStrip${i}`);
      const win = $(`slotWin${i}`);
      if (!strip || !win) { stopped++; if (stopped === 3) finish(); return; }
      const cellH = win.clientHeight || 64;
      const count = 20 + i * 6;
      let html = '';
      for (let k = 0; k < count; k++) html += symHtml(SLOT_POOL[Math.floor(Math.random() * SLOT_POOL.length)]);
      html += symHtml(sym);
      strip.innerHTML = html;
      const dist = count * cellH;
      const anim = strip.animate([
        { transform: 'translateY(0px)', filter: 'blur(0px)' },
        { transform: `translateY(${-dist * 0.15}px)`, filter: 'blur(2px)', offset: 0.1 },
        { transform: `translateY(${-dist - 12}px)`, filter: 'blur(0.5px)', offset: 0.9 },
        { transform: `translateY(${-dist}px)`, filter: 'blur(0px)' }
      ], { duration: durs[i], easing: 'cubic-bezier(.2,.7,.25,1)', fill: 'forwards' });
      const stop = () => {
        strip.style.transform = `translateY(${-dist}px)`;
        anim.cancel();
        restartClass(win, 'reel-stopped', 400);
        sfx('playReelStop');
        stopped++;
        if (i === 1 && tease) {
          const w2 = $('slotWin2');
          if (w2) w2.classList.add('tease');
          startTick(140);
          [0, 450, 900].forEach((ms) => setTimeout(() => { if (!finished) sfx('playHeartbeat'); }, T(ms)));
        }
        if (stopped === 3) finish();
      };
      anim.finished.then(stop, stop);
    });
    setTimeout(finish, Math.max(...durs) + 1500); // safety net
  }

  // =========================================================
  // 11. INIT & DEV HARNESS
  // =========================================================
  let inited = false;
  function init() {
    if (inited) return;
    inited = true;
    refs();
    loadManifest();
    if (L.wrap && window.ResizeObserver) {
      new ResizeObserver(() => placeAll()).observe(L.wrap);
    }
    window.addEventListener('orientationchange', () => setTimeout(placeAll, 300));
    if (/[?&]fxtest=1/.test(window.location.search)) buildTestPanel();
  }

  function testState() {
    return typeof monopolyState !== 'undefined' ? monopolyState : null;
  }

  const TESTS = {
    hop6: async () => {
      const st = testState(); if (!st) return;
      let pos = st.players.bkk.pos;
      for (let i = 0; i < 6; i++) { const n = (pos + 1) % 20; await hop('bkk', pos, n, { first: i === 0, final: i === 5 }); pos = n; }
      await sleep(600); place('bkk', st.players.bkk.pos);
    },
    teleport: async () => { const st = testState(); if (!st) return; await teleport('bkk', 12); await sleep(500); await teleport('bkk', st.players.bkk.pos); },
    coinsRent: () => coins({ from: { role: 'bkk' }, to: { role: 'dxb' }, amount: 400 }),
    coinsLap: () => coins({ from: { tileId: 0 }, to: { role: 'bkk' }, amount: 200 }),
    tween: () => {
      const el = $('monopolyBkkMiles'); if (!el) return;
      tween(el, 1200, 800, 900, (v) => `${Math.round(v).toLocaleString()} 🪙`);
      restartClass(el, 'miles-down', 950);
    },
    takeoverWin: () => moment('takeover_win', { text: 'Shibuya Crossing' }),
    takeoverFail: () => moment('takeover_fail', { text: 'Burj Khalifa' }),
    hotel: () => moment('hotel', { tileId: 8, text: 'rent 1,080🪙' }),
    house: () => moment('house', { tileId: 2 }),
    c4: () => moment('c4', { tileId: 12, text: 'Akihabara' }),
    jackpot: () => moment('jackpot', { role: 'bkk' }),
    zone: () => moment('zone', { tiles: [17, 18, 19], text: 'Westeros' }),
    buy: () => plantFlag(1, 'dxb'),
    shield: () => moment('shield', { role: 'bkk', owner: 'dxb' }),
    airdrop: () => moment('airdrop', { tileId: 7, role: 'bkk', icon: '💣' }),
    finalBoarding: () => moment('finalBoarding', {}),
    bankrupt: async () => {
      await moment('bankrupt', { role: 'dxb' });
      await sleep(800);
      refs(); if (L.wrap) L.wrap.classList.remove('fx-desat');
      resetTokens(); placeAll();
    },
    vibeMatch: () => { const c = center(); flash('rgba(236,72,153,0.25)', 300); heartBurst(c.x, c.y); },
    vibeMiss: () => { const c = center(); brokenHeart(c.x, c.y); shake('light'); },
    slotNormal: () => testSlot(['🍒', '🍋', '⭐']),
    slotTease: () => testSlot(['💎', '💎', '🔔']),
    slotJackpot: () => testSlot(['💎', '💎', '💎'], () => moment('jackpot', { role: 'bkk' })),
    voidLightningTithe: () => voidLightningTithe({ casterRole: 'bkk', totalSiphoned: 300, victims: [{ role: 'dxb', amount: 300 }] }),
    abyssalCataclysm: () => abyssalCataclysm({ casterRole: 'dxb', targetRole: 'bkk', targetP: { name: 'Bangkok', pos: 5 }, tidalDmg: 240 }),
    monacoGoldRush: () => monacoGoldRush({ role: 'bkk', amount: 800 }),
    emeraldNagaSurge: () => emeraldNagaSurge({ role: 'bkk', amount: 500, ownedTiles: [1, 2, 3] }),
    eclipseConvergence: () => eclipseConvergence({ casterRole: 'bkk', rivalTiles: [6, 8, 13] }),
    cosmicGenieWish: () => cosmicGenieWish({ role: 'bkk', upgradedTileId: 2, amount: 350 }),
    absoluteZero: () => absoluteZero({ casterRole: 'dxb', targetRole: 'bkk', ransomFee: 150 }),
    frostShieldDeflection: () => moment('frost_shield_deflection', { payerRole: 'dxb', ownerRole: 'bkk', absorbed: 140, tileId: 4 }),
    snowdriftTrap: () => moment('snowdrift_trap', { role: 'bkk', tileId: 8, text: 'Trapped in Arctic Snowdrift!' }),
    glacialRoyaltyThrow: () => moment('glacial_royalty_throw', { role: 'dxb', rollVal: 6 }),
    nileSeduction: () => nileSeduction({ casterRole: 'dxb', extortedMiles: 300, pyramidTile: 4 }),
    solarWrath: () => solarWrath({ casterRole: 'bkk', scorchedMiles: 240, downgradedTiles: [6, 11] })
  };

  function testSlot(reels, after) {
    if (!refs()) return;
    const box = document.createElement('div');
    box.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);pointer-events:none;';
    box.innerHTML = slotHtml(randomReels());
    L.moment.appendChild(box);
    spinSlots(reels, () => { if (after) after(); setTimeout(() => box.remove(), 1500); });
  }

  function buildTestPanel() {
    const panel = document.createElement('div');
    panel.className = 'fx-test-panel';
    Object.keys(TESTS).forEach((name) => {
      const b = document.createElement('button');
      b.textContent = name;
      b.addEventListener('click', () => { sfx('init'); TESTS[name](); });
      panel.appendChild(b);
    });
    document.body.appendChild(panel);
  }

  function test(name) { if (TESTS[name]) return TESTS[name](); console.warn('[MonoFX] unknown test', name, Object.keys(TESTS)); return null; }

  // =========================================================
  // 12. PUBLIC API
  // =========================================================
  Object.assign(api, {
    init, assetUrl, visual, visualHtml, point, center,
    tokens: { mount, place, placeAll, hop, teleport, sync: syncTokens, setActive, lock: (r, v) => { tok.lock[r] = !!v; }, reset: resetTokens, fall: fallToken },
    coins, flyIcon, plantFlag, burst, shake, flash, vignette, ring, banner,
    moment, busy, hold, tween, restartClass,
    cardOverlayOpen, deferTileFx, runTileFx, flushTileFx,
    heartBurst, brokenHeart, voidLightningTithe,
    abyssalCataclysm, monacoGoldRush, emeraldNagaSurge, eclipseConvergence, cosmicGenieWish,
    lanternFestival, midnightParadox, breakingTheCurse,
    absoluteZero, nileSeduction, solarWrath,
    phantomCurtainCall, phantomReverseHex, wrathOfOlympus, zeusLightningSmite, zeusStormShock, lightningRodZap, phantomThrow, olympusThrow,
    beastPounce, livingStaffParry,
    slot: { html: slotHtml, spin: spinSlots, randomReels, pullLever },
    clearDesat: () => { refs(); if (L.wrap) L.wrap.classList.remove('fx-desat'); },
    test
  });
  window.MonoFX = api;
})();
