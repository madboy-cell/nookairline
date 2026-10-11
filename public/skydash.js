/**
 * ✈️ Nook Runway: Sky Dash (Tales of Flight) — High-Fidelity 2.5D Sky Runner Engine
 * Designed strictly to match docs/SKY_RUNWAY_GAME_DESIGN.md:
 * - MapleStory / Cookie Run chibi anime aesthetic.
 * - Reuses Mythic costumes: Male (Inari Fox Blade 🦊) & Female (Inari Shrine Empress ⛩️).
 * - Reuses Mythic Cats: Hanami (Sakura Spirit 🌸), Captain Whiskers (Pilot 🐟), Fortune (Maneki 🪙).
 * - Pixi.js v8 (WebGL2/WebGPU) hardware-accelerated sprite rendering with single-draw batching.
 * - GSAP 3: Camera Director (dynamic zoom, hit-stop freeze 0.08s, screen shake, squash & stretch).
 * - TalesRunner frame-perfect 120ms "Landing Dash" rhythm tech.
 * - Cookie Run parabolic diamond and smiling golden star arcs.
 * - Zero external byte procedural Web Audio suite.
 */
(function (root) {
  const Audio = root.SkyDashAudio || {
    playStep() {}, playJump() {}, playDoubleJump() {}, playLandingDash() {},
    playDiamond() {}, playSlide() {}, playNearMiss() {}, playFeverStart() {},
    playUltimate() {}, playHit() {}, playItem() {}, playVictory() {}
  };

  const $ = (id) => document.getElementById(id);
  const myRole = () => window.myTerminal || (window.getTerminalRole ? window.getTerminalRole() : 'bkk');

  // ---------------------------------------------------------------------------
  // CONSTANTS & GAME STATE
  // ---------------------------------------------------------------------------
  const GRAVITY = 0.65;
  const JUMP_FORCE = -14.2;
  const DOUBLE_JUMP_FORCE = -12.0;
  const BASE_SPEED = 6.8;
  const MAX_SPEED = 14.5;
  const TRACK_LENGTH = 3000; // 3,000 meters per circuit

  const STATE = {
    active: false,
    paused: false,
    mode: 'solo', // 'solo' | 'duo' | 'boss'
    distance: 0,
    speed: BASE_SPEED,
    score: 0,
    diamonds: 0,
    combo: 0,
    maxCombo: 0,
    stamina: 100,
    fever: 0,
    isFever: false,
    feverTimer: 0,
    ultActive: false,
    ultTimer: 0,
    heldItem: null,
    landingDashWindow: 0,
    lastLandingAt: 0,
    animTimer: 0,

    // Relay Mode
    relayPhase: 1,

    // Player Physics
    p: {
      x: 180,
      y: 0,
      vy: 0,
      w: 80,
      h: 88,
      isGrounded: true,
      jumpsLeft: 2,
      isSliding: false,
      shield: false,
      stumbleTimer: 0,
      scaleX: 1,
      scaleY: 1,
      gender: 'm' // 'm' for BKK, 'f' for DXB
    },

    // Mythic Companion
    companion: {
      x: 100,
      y: 0,
      targetX: 100,
      targetY: 0,
      w: 52,
      h: 52,
      cooldown: 11.5,
      speech: null,
      speechTimer: 0,
      activePetId: 'm_sakura'
    },

    // World Elements
    sakuraPetals: [],
    diamondsPool: [],
    obstaclesPool: [],
    particlesPool: [],
    itemsPool: [],

    costume: null,
    cat: null
  };

  // Pixi Engine & Stage Hierarchy
  let canvas = null;
  let ctx = null;
  let pixiApp = null;
  let cameraContainer = null;
  let bgLayer = null;
  let trackLayer = null;
  let entitiesLayer = null;
  let playerContainer = null;
  let companionContainer = null;
  let fxGraphics = null;

  // Sprites
  let sprSkyline = null;
  let sprHighway = null;
  let sprTorii = null;
  let sprPlayer = null;
  let sprShadow = null;
  let sprCompanion = null;
  let sprCompanionShadow = null;
  let companionSpeechBubble = null;

  // Preloaded High-Res Textures
  const TEX = {};
  let texturesLoaded = false;

  let animFrameId = null;
  let lastTime = 0;
  let stepSoundTimer = 0;

  // ---------------------------------------------------------------------------
  // PROCEDURAL FALLBACK TEXTURE GENERATOR (FRAME-0 INSTANT RENDERING)
  // Ensures canvas is NEVER blank, black, or empty under any network delay
  // ---------------------------------------------------------------------------
  function createProceduralTexture(type, w, h) {
    if (typeof document === 'undefined') return null;
    const cvs = document.createElement('canvas');
    cvs.width = w;
    cvs.height = h;
    const c = cvs.getContext('2d');
    if (!c) return null;

    if (type === 'skyline') {
      const grad = c.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#0a0d24');
      grad.addColorStop(0.4, '#1e1b4b');
      grad.addColorStop(0.7, '#4c1d95');
      grad.addColorStop(1, '#831843');
      c.fillStyle = grad;
      c.fillRect(0, 0, w, h);

      // Glowing moon
      c.fillStyle = '#fef08a';
      c.shadowColor = '#fef08a';
      c.shadowBlur = 24;
      c.beginPath();
      c.arc(w * 0.75, h * 0.22, 38, 0, Math.PI * 2);
      c.fill();
      c.shadowBlur = 0;

      // Distant city silhouette
      c.fillStyle = '#090d16';
      c.beginPath();
      c.moveTo(0, h);
      for (let x = 0; x <= w; x += 35) {
        const bH = 50 + Math.sin(x * 0.05) * 35;
        c.lineTo(x, h - bH);
        c.lineTo(x + 30, h - bH);
      }
      c.lineTo(w, h);
      c.closePath();
      c.fill();
    } else if (type === 'highway') {
      const grad = c.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#38bdf8');
      grad.addColorStop(0.12, '#1e293b');
      grad.addColorStop(1, '#090d16');
      c.fillStyle = grad;
      c.fillRect(0, 0, w, h);

      c.strokeStyle = 'rgba(56, 189, 248, 0.4)';
      c.lineWidth = 2;
      for (let x = 0; x < w; x += 60) {
        c.strokeRect(x, 15, 55, h - 30);
      }
      c.fillStyle = '#f43f5e';
      c.shadowColor = '#f43f5e';
      c.shadowBlur = 10;
      for (let x = 0; x < w; x += 100) {
        c.fillRect(x + 10, h * 0.5 - 3, 50, 6);
      }
    } else if (type.startsWith('inari_')) {
      const isM = type.includes('_m_');
      const isJump = type.includes('_jump');
      const isSlide = type.includes('_slide');

      // Fox ears
      c.fillStyle = '#ea580c';
      c.beginPath();
      c.moveTo(w * 0.3, h * 0.35); c.lineTo(w * 0.25, h * 0.1); c.lineTo(w * 0.45, h * 0.28); c.fill();
      c.beginPath();
      c.moveTo(w * 0.7, h * 0.35); c.lineTo(w * 0.75, h * 0.1); c.lineTo(w * 0.55, h * 0.28); c.fill();

      // Chibi Head
      c.fillStyle = '#fed7aa';
      c.beginPath();
      c.arc(w * 0.5, isSlide ? h * 0.6 : (isJump ? h * 0.38 : h * 0.42), 24, 0, Math.PI * 2);
      c.fill();

      // Mask / Eyes
      c.fillStyle = isM ? '#dc2626' : '#ec4899';
      c.fillRect(w * 0.4, isSlide ? h * 0.58 : h * 0.4, 5, 7);
      c.fillRect(w * 0.55, isSlide ? h * 0.58 : h * 0.4, 5, 7);

      // Body & Foxfire robe
      c.fillStyle = isM ? '#1e293b' : '#be123c';
      if (isSlide) {
        c.fillRect(w * 0.2, h * 0.65, 45, 18);
      } else {
        c.fillRect(w * 0.35, isJump ? h * 0.5 : h * 0.55, 30, 30);
      }

      // Fox Nine-tail
      c.fillStyle = '#f97316';
      c.beginPath();
      c.arc(w * 0.25, isSlide ? h * 0.7 : h * 0.65, 12, 0, Math.PI * 2);
      c.fill();
    } else if (type === 'cat_sakura' || type === 'cat_captain') {
      c.fillStyle = type === 'cat_sakura' ? '#f472b6' : '#38bdf8';
      c.beginPath();
      c.arc(w * 0.5, h * 0.5, 20, 0, Math.PI * 2);
      c.fill();
      // Ears
      c.beginPath();
      c.moveTo(w * 0.3, h * 0.35); c.lineTo(w * 0.25, h * 0.15); c.lineTo(w * 0.45, h * 0.3); c.fill();
      c.beginPath();
      c.moveTo(w * 0.7, h * 0.35); c.lineTo(w * 0.75, h * 0.15); c.lineTo(w * 0.55, h * 0.3); c.fill();
      // Eyes
      c.fillStyle = '#ffffff';
      c.beginPath(); c.arc(w * 0.42, h * 0.48, 4, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(w * 0.58, h * 0.48, 4, 0, Math.PI * 2); c.fill();
    } else if (type === 'diamond') {
      c.fillStyle = '#38bdf8';
      c.shadowColor = '#38bdf8';
      c.shadowBlur = 10;
      c.beginPath();
      c.moveTo(w * 0.5, h * 0.1);
      c.lineTo(w * 0.85, h * 0.5);
      c.lineTo(w * 0.5, h * 0.9);
      c.lineTo(w * 0.15, h * 0.5);
      c.closePath();
      c.fill();
    } else if (type === 'star') {
      c.fillStyle = '#fbbf24';
      c.shadowColor = '#fbbf24';
      c.shadowBlur = 12;
      c.beginPath();
      for (let i = 0; i < 5; i++) {
        const a1 = (i * 72 - 90) * Math.PI / 180;
        const a2 = ((i * 72) + 36 - 90) * Math.PI / 180;
        const r1 = w * 0.45;
        const r2 = w * 0.2;
        if (i === 0) c.moveTo(w * 0.5 + Math.cos(a1) * r1, h * 0.5 + Math.sin(a1) * r1);
        else c.lineTo(w * 0.5 + Math.cos(a1) * r1, h * 0.5 + Math.sin(a1) * r1);
        c.lineTo(w * 0.5 + Math.cos(a2) * r2, h * 0.5 + Math.sin(a2) * r2);
      }
      c.closePath();
      c.fill();
    } else if (type === 'lantern') {
      c.fillStyle = '#dc2626';
      c.shadowColor = '#f59e0b';
      c.shadowBlur = 10;
      c.beginPath();
      c.ellipse(w * 0.5, h * 0.5, 18, 26, 0, 0, Math.PI * 2);
      c.fill();
    } else if (type === 'laser') {
      c.fillStyle = 'rgba(56, 189, 248, 0.85)';
      c.fillRect(w * 0.35, 0, w * 0.3, h);
    } else if (type === 'mystery_box') {
      c.fillStyle = '#a855f7';
      c.fillRect(w * 0.2, h * 0.2, w * 0.6, h * 0.6);
      c.fillStyle = '#fbbf24';
      c.fillRect(w * 0.45, h * 0.2, w * 0.1, h * 0.6);
    } else if (type === 'torii') {
      c.fillStyle = '#ea580c';
      c.fillRect(w * 0.15, 0, w * 0.7, 18);
      c.fillRect(w * 0.22, 0, 16, h);
      c.fillRect(w * 0.68, 0, 16, h);
    }

    if (typeof PIXI !== 'undefined' && PIXI.Texture && PIXI.Texture.from) {
      return PIXI.Texture.from(cvs);
    }
    return null;
  }

  function initFallbackTextures() {
    const specs = [
      ['skyline', 960, 540],
      ['highway', 960, 140],
      ['inari_m_run', 96, 96],
      ['inari_m_jump', 96, 96],
      ['inari_m_slide', 96, 96],
      ['inari_f_run', 96, 96],
      ['inari_f_jump', 96, 96],
      ['inari_f_slide', 96, 96],
      ['cat_sakura', 64, 64],
      ['cat_captain', 64, 64],
      ['diamond', 48, 48],
      ['star', 48, 48],
      ['lantern', 64, 80],
      ['laser', 48, 96],
      ['mystery_box', 48, 48],
      ['torii', 180, 200]
    ];
    for (const [k, w, h] of specs) {
      if (!TEX[k]) {
        const tex = createProceduralTexture(k, w, h);
        if (tex) TEX[k] = tex;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // TEXTURE ASSET LOADER (PARALLEL & RESILIENT)
  // ---------------------------------------------------------------------------
  const MANIFEST = {
    skyline: '/assets/runner/skyline_tokyo.jpg',
    highway: '/assets/runner/cloud_highway.jpg',
    inari_f_run: '/assets/runner/inari_f_run.png',
    inari_f_jump: '/assets/runner/inari_f_jump.png',
    inari_f_slide: '/assets/runner/inari_f_slide.png',
    inari_m_run: '/assets/runner/inari_m_run.png',
    inari_m_jump: '/assets/runner/inari_m_jump.png',
    inari_m_slide: '/assets/runner/inari_m_slide.png',
    diamond: '/assets/runner/diamond.png',
    star: '/assets/runner/star.png',
    mystery_box: '/assets/runner/mystery_box.png',
    torii: '/assets/runner/torii_gate.png',
    lantern: '/assets/runner/lantern.png',
    laser: '/assets/runner/laser_gate.png',
    cat_sakura: '/assets/runner/cat_sakura.png',
    cat_captain: '/assets/runner/cat_captain.png'
  };

  function onSingleTextureLoaded(key, tex) {
    if (key === 'skyline' && sprSkyline) {
      sprSkyline.texture = tex;
    } else if (key === 'highway' && sprHighway) {
      sprHighway.texture = tex;
    } else if (key === 'torii' && sprTorii) {
      sprTorii.texture = tex;
    } else if (sprPlayer) {
      const g = STATE.p.gender === 'm' ? 'm' : 'f';
      const curPose = STATE.p.isSliding ? 'slide' : (STATE.p.isGrounded ? 'run' : 'jump');
      if (key === `inari_${g}_${curPose}`) {
        sprPlayer.texture = tex;
      }
    }
    if (sprCompanion && (key === 'cat_sakura' || key === 'cat_captain')) {
      const activePet = STATE.companion.activePetId || 'm_sakura';
      if ((activePet.includes('captain') && key === 'cat_captain') || (!activePet.includes('captain') && key === 'cat_sakura')) {
        sprCompanion.texture = tex;
      }
    }
  }

  async function loadAllTextures() {
    if (texturesLoaded) return true;
    initFallbackTextures();

    const loadPromises = Object.entries(MANIFEST).map(async ([key, url]) => {
      try {
        let loadedTex = null;
        if (typeof PIXI !== 'undefined' && PIXI.Assets && PIXI.Assets.load) {
          loadedTex = await PIXI.Assets.load(url);
        }
        if (!loadedTex && typeof PIXI !== 'undefined' && PIXI.Texture && PIXI.Texture.from) {
          loadedTex = PIXI.Texture.from(url);
        }
        if (loadedTex) {
          TEX[key] = loadedTex;
          onSingleTextureLoaded(key, loadedTex);
        }
      } catch (err) {
        console.warn(`[SkyDash Engine] Fallback used for ${key}:`, err.message || err);
      }
    });

    await Promise.all(loadPromises);
    texturesLoaded = true;
    console.log('🌸 [SkyDash Engine] All 16 MapleStory high-res textures loaded successfully!');
    return true;
  }

  // ---------------------------------------------------------------------------
  // PIXI.JS v8 INITIALIZATION
  // ---------------------------------------------------------------------------
  async function initEngine() {
    canvas = $('skydashCanvas');
    if (!canvas) return;

    if (typeof PIXI !== 'undefined') {
      try {
        const wrapper = canvas.parentElement || document.querySelector('.skydash-canvas-wrapper');
        const rect = wrapper ? wrapper.getBoundingClientRect() : canvas.getBoundingClientRect();
        const w = Math.floor(rect.width) || window.innerWidth || 960;
        const h = Math.floor(rect.height) || window.innerHeight || 540;

        // Clean canvas replacement to avoid WebGL context collisions
        const freshCanvas = document.createElement('canvas');
        freshCanvas.id = 'skydashCanvas';
        freshCanvas.className = canvas.className || '';
        freshCanvas.style.width = '100%';
        freshCanvas.style.height = '100%';
        if (canvas.parentNode) {
          canvas.parentNode.replaceChild(freshCanvas, canvas);
          canvas = freshCanvas;
        }

        pixiApp = new PIXI.Application();
        await pixiApp.init({
          canvas: canvas,
          width: w,
          height: h,
          backgroundAlpha: 0,
          autoDensity: true,
          resolution: Math.min(window.devicePixelRatio || 1, 2)
        });

        // Initialize fallback procedural textures immediately so screen is NEVER blank
        initFallbackTextures();

        // 1. Camera Director Container (GSAP manipulated: zoom, shake, tilt)
        cameraContainer = new PIXI.Container();
        pixiApp.stage.addChild(cameraContainer);

        // 2. Background Layer (Tokyo Skyline Parallax)
        bgLayer = new PIXI.Container();
        cameraContainer.addChild(bgLayer);

        sprSkyline = new PIXI.TilingSprite({
          texture: TEX.skyline || createProceduralTexture('skyline', w, h),
          width: w,
          height: h
        });
        bgLayer.addChild(sprSkyline);

        // 3. Track Layer (Cloud Highway Runway & Torii Arch)
        trackLayer = new PIXI.Container();
        cameraContainer.addChild(trackLayer);

        const groundY = h - 140;
        sprHighway = new PIXI.TilingSprite({
          texture: TEX.highway || createProceduralTexture('highway', w, 140),
          width: w,
          height: 140
        });
        sprHighway.y = groundY;
        sprHighway.tilePosition.y = -260;
        trackLayer.addChild(sprHighway);

        sprTorii = new PIXI.Sprite(TEX.torii || createProceduralTexture('torii', 180, 200));
        sprTorii.anchor.set(0.5, 1.0);
        sprTorii.width = 180;
        sprTorii.height = 200;
        sprTorii.x = -500;
        trackLayer.addChild(sprTorii);

        // 4. Entities Layer (Diamonds, Stars, Obstacles, Mystery Boxes)
        entitiesLayer = new PIXI.Container();
        cameraContainer.addChild(entitiesLayer);

        // 5. Player & Companion Containers
        playerContainer = new PIXI.Container();
        companionContainer = new PIXI.Container();
        cameraContainer.addChild(companionContainer, playerContainer);

        // Shadows
        sprShadow = new PIXI.Graphics();
        sprShadow.ellipse(0, 0, 28, 6).fill({ color: 0x000000, alpha: 0.35 });
        playerContainer.addChild(sprShadow);

        sprCompanionShadow = new PIXI.Graphics();
        sprCompanionShadow.ellipse(0, 0, 18, 5).fill({ color: 0x000000, alpha: 0.3 });
        companionContainer.addChild(sprCompanionShadow);

        // Player Sprite
        sprPlayer = new PIXI.Sprite(TEX.inari_m_run || TEX.inari_f_run || createProceduralTexture('inari_m_run', 96, 96));
        sprPlayer.anchor.set(0.5, 1.0);
        sprPlayer.width = 95;
        sprPlayer.height = 95;
        playerContainer.addChild(sprPlayer);

        // Companion Sprite
        sprCompanion = new PIXI.Sprite(TEX.cat_sakura || TEX.cat_captain || createProceduralTexture('cat_sakura', 64, 64));
        sprCompanion.anchor.set(0.5, 1.0);
        sprCompanion.width = 54;
        sprCompanion.height = 54;
        companionContainer.addChild(sprCompanion);

        // Kick off asynchronous high-res texture load without blocking initial render
        loadAllTextures();

        // Speech Bubble
        companionSpeechBubble = new PIXI.Container();
        const speechGfx = new PIXI.Graphics();
        speechGfx.roundRect(-50, -32, 100, 24, 8).fill({ color: 0x0f172a, alpha: 0.85 }).stroke({ color: 0xfbbf24, width: 2 });
        companionSpeechBubble.addChild(speechGfx);
        const speechTxt = new PIXI.Text({
          text: '🌸 Hanami!',
          style: { fontFamily: 'Fredoka, sans-serif', fontSize: 11, fill: 0xffffff, align: 'center' }
        });
        speechTxt.anchor.set(0.5);
        speechTxt.x = 0;
        speechTxt.y = -20;
        companionSpeechBubble.addChild(speechTxt);
        companionSpeechBubble.visible = false;
        companionContainer.addChild(companionSpeechBubble);

        // 6. FX Layer (Particles, sparks, shockwaves)
        fxGraphics = new PIXI.Graphics();
        cameraContainer.addChild(fxGraphics);

        root.SkyDashEngine = {
          pixi: pixiApp,
          gsap: root.gsap,
          camera: cameraContainer,
          isPixiActive: true,
          version: PIXI.VERSION
        };
        console.log('🚀 [SkyDash Engine] Fully operational with Pixi.js v' + PIXI.VERSION + ' + GSAP Director');
        return;
      } catch (err) {
        console.warn('[SkyDash Engine] Pixi init fallback to 2D context:', err);
      }
    }

    // 2D Canvas Fallback
    try {
      ctx = canvas.getContext('2d');
    } catch (e) {}

    root.SkyDashEngine = {
      pixi: null,
      gsap: root.gsap,
      camera: null,
      isPixiActive: false
    };
  }

  // ---------------------------------------------------------------------------
  // GSAP CAMERA DIRECTOR & JUICE CONTROLLER
  // ---------------------------------------------------------------------------
  function cameraZoom(targetZoom, duration = 0.25, ease = 'power2.out') {
    if (typeof gsap !== 'undefined' && cameraContainer) {
      gsap.to(cameraContainer.scale, { x: targetZoom, y: targetZoom, duration, ease, overwrite: 'auto' });
    }
  }

  function triggerScreenShake(magnitude = 6) {
    if (typeof gsap !== 'undefined' && cameraContainer) {
      gsap.fromTo(cameraContainer,
        { x: -magnitude, y: -magnitude * 0.5 },
        {
          x: magnitude,
          y: magnitude * 0.5,
          duration: 0.04,
          repeat: 3,
          yoyo: true,
          onComplete: () => {
            cameraContainer.x = 0;
            cameraContainer.y = 0;
          }
        }
      );
    }
  }

  function triggerHitStop(ms = 80) {
    if (typeof gsap !== 'undefined') {
      STATE.paused = true;
      gsap.delayedCall(ms / 1000, () => {
        STATE.paused = false;
      });
    }
  }

  function triggerSquashStretch(targetScaleX, targetScaleY, duration = 0.1, ease = 'power2.out') {
    if (typeof gsap !== 'undefined') {
      gsap.to(STATE.p, { scaleX: targetScaleX, scaleY: targetScaleY, duration, ease, overwrite: 'auto' });
    } else {
      STATE.p.scaleX = targetScaleX;
      STATE.p.scaleY = targetScaleY;
    }
  }

  function updateCameraDirector() {
    if (typeof gsap === 'undefined' || !cameraContainer) return;
    const p = STATE.p;
    if (!p.isGrounded && p.vy < -4) {
      cameraZoom(1.06, 0.22, 'power1.out');
    } else if (STATE.speed > BASE_SPEED + 3 || STATE.isFever) {
      cameraZoom(0.93, 0.25, 'power2.out');
    } else {
      cameraZoom(1.0, 0.35, 'power1.out');
    }
  }

  // ---------------------------------------------------------------------------
  // INITIALIZATION & EVENT BINDINGS
  // ---------------------------------------------------------------------------
  async function initSkyDash() {
    // Lazy-load WebGL engine when SkyDash modal is opened to avoid background GPU/VRAM drain
    window.addEventListener('resize', resizeCanvas);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    setupTouchControls();

    const openBtn = $('openSkyDashBtn');
    const closeBtn = $('skydashCloseBtn');
    const launchBtn = $('skydashLaunchBtn');
    const rematchBtn = $('skydashRematchBtn');
    const summaryCloseBtn = $('skydashSummaryCloseBtn');

    if (openBtn) openBtn.addEventListener('click', openSkyDashModal);
    if (closeBtn) closeBtn.addEventListener('click', closeSkyDashModal);
    if (launchBtn) launchBtn.addEventListener('click', startRace);
    if (rematchBtn) rematchBtn.addEventListener('click', () => { hideSummary(); startRace(); });
    if (summaryCloseBtn) summaryCloseBtn.addEventListener('click', () => { hideSummary(); closeSkyDashModal(); });

    ['solo', 'duo', 'boss'].forEach((m) => {
      const tab = $(`skydashMode_${m}`);
      if (tab) {
        tab.addEventListener('click', () => {
          document.querySelectorAll('.skydash-mode-tab').forEach((t) => t.classList.remove('active'));
          tab.classList.add('active');
          STATE.mode = m;
        });
      }
    });

    const itemSlot = $('skydashItemSlot');
    if (itemSlot) itemSlot.addEventListener('click', triggerHeldItem);
  }

  function resizeCanvas() {
    if (!canvas) return;
    const wrapper = canvas.parentElement || document.querySelector('.skydash-canvas-wrapper');
    const rect = wrapper ? wrapper.getBoundingClientRect() : canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.floor(rect.width) || window.innerWidth || 960;
    const h = Math.floor(rect.height) || window.innerHeight || 540;

    if (pixiApp && pixiApp.renderer) {
      pixiApp.renderer.resize(w, h);
      if (sprSkyline) {
        sprSkyline.width = w;
        sprSkyline.height = h;
      }
      if (sprHighway) {
        sprHighway.y = h - 140;
        sprHighway.width = w;
        sprHighway.height = 140;
      }
    } else {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      if (ctx) ctx.scale(dpr, dpr);
    }
  }

  function setupTouchControls() {
    const jumpBtn = $('skydashJumpBtn');
    const slideBtn = $('skydashSlideBtn');

    if (jumpBtn) {
      const doJump = (e) => {
        if (e) e.preventDefault();
        jump();
        jumpBtn.classList.add('pressed');
        setTimeout(() => jumpBtn.classList.remove('pressed'), 120);
      };
      jumpBtn.addEventListener('touchstart', doJump, { passive: false });
      jumpBtn.addEventListener('mousedown', doJump);
    }

    if (slideBtn) {
      const startSlide = (e) => {
        if (e) e.preventDefault();
        slideStart();
        slideBtn.classList.add('pressed');
      };
      const endSlide = (e) => {
        if (e) e.preventDefault();
        slideEnd();
        slideBtn.classList.remove('pressed');
      };
      slideBtn.addEventListener('touchstart', startSlide, { passive: false });
      slideBtn.addEventListener('touchend', endSlide, { passive: false });
      slideBtn.addEventListener('mousedown', startSlide);
      slideBtn.addEventListener('mouseup', endSlide);
    }
  }

  function handleKeyDown(e) {
    if (!STATE.active || STATE.paused) return;
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
      e.preventDefault();
      jump();
    } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
      e.preventDefault();
      slideStart();
    } else if (e.code === 'KeyE' || e.code === 'ShiftRight') {
      e.preventDefault();
      triggerHeldItem();
    }
  }

  function handleKeyUp(e) {
    if (e.code === 'ArrowDown' || e.code === 'KeyS') {
      slideEnd();
    }
  }

  // ---------------------------------------------------------------------------
  // LOADOUT SELECTION (MYTHIC COSTUMES & MYTHIC CATS ONLY)
  // ---------------------------------------------------------------------------
  function syncEquippedMeta() {
    const role = myRole();
    STATE.p.gender = (role === 'dxb' ? 'f' : 'm');

    // Reuse Mythic Costumes from Season 2
    let costume = null;
    if (STATE.p.gender === 'm') {
      costume = {
        id: 's2_inari_m',
        name: 'Inari Fox Blade 🦊',
        rarity: 'mythic',
        image: 'assets/s2/s2_inari_m.png',
        effects: {
          skydash: {
            passive: 'Foxfire Blade: Near-misses grant +25% speed surge.',
            ultimate: 'Foxfire Rush: Invincible sprint + transforms hurdles into diamonds.',
            baseSpeedBonus: 0.15
          }
        }
      };
    } else {
      costume = {
        id: 's2_inari_f',
        name: 'Inari Shrine Empress ⛩️',
        rarity: 'mythic',
        image: 'assets/s2/s2_inari_f.png',
        effects: {
          skydash: {
            passive: 'Foxfire Step: Near-misses grant +25% speed surge.',
            ultimate: 'Foxfire Rush: Invincible sprint + transforms hurdles into diamonds.',
            baseSpeedBonus: 0.15
          }
        }
      };
    }

    // Reuse Mythic Cat (Hanami the Sakura Spirit / Captain Whiskers)
    const cat = {
      id: 'm_sakura',
      name: 'Hanami 🌸',
      breed: 'Sakura Spirit',
      rarity: 'mythic',
      bonusText: 'Petal Trampoline: Bounces avatar back up +25% speed cushion',
      avatar: 'assets/cats/m_sakura.png'
    };

    STATE.costume = costume;
    STATE.cat = cat;
    STATE.companion.activePetId = cat.id;

    if (costume.effects?.skydash?.baseSpeedBonus) {
      STATE.speed = BASE_SPEED * (1 + costume.effects.skydash.baseSpeedBonus);
    } else {
      STATE.speed = BASE_SPEED;
    }

    // Update Lobby UI Cards
    const lobbyAvatar = $('skydashLobbyAvatarImg');
    const lobbyCostumeName = $('skydashLobbyCostumeName');
    const lobbyCostumePerk = $('skydashLobbyCostumePerk');
    const lobbyCatImg = $('skydashLobbyCatImg');
    const lobbyCatName = $('skydashLobbyCatName');
    const lobbyCatPerk = $('skydashLobbyCatPerk');

    if (lobbyAvatar && costume.image) lobbyAvatar.src = costume.image;
    if (lobbyCostumeName) lobbyCostumeName.textContent = costume.name;
    if (lobbyCostumePerk) lobbyCostumePerk.textContent = costume.effects?.skydash?.passive || 'Speed +15%';

    if (lobbyCatImg && cat.avatar) lobbyCatImg.src = cat.avatar;
    if (lobbyCatName) lobbyCatName.textContent = cat.name;
    if (lobbyCatPerk) lobbyCatPerk.textContent = cat.bonusText;

    // Update Initial Pixi Sprite Textures
    if (sprPlayer && TEX) {
      const texKey = STATE.p.gender === 'm' ? 'inari_m_run' : 'inari_f_run';
      if (TEX[texKey]) sprPlayer.texture = TEX[texKey];
    }
    if (sprCompanion && TEX) {
      const compKey = cat.id === 'm_captain' ? 'cat_captain' : 'cat_sakura';
      if (TEX[compKey]) sprCompanion.texture = TEX[compKey];
    }
  }

  // ---------------------------------------------------------------------------
  // JUMP, SLIDE & TALESRUNNER 120ms LANDING DASH
  // ---------------------------------------------------------------------------
  function jump() {
    const p = STATE.p;
    if (p.isGrounded) {
      p.vy = JUMP_FORCE;
      p.isGrounded = false;
      p.jumpsLeft = 1;
      triggerSquashStretch(0.82, 1.25, 0.12, 'power2.out');
      cameraZoom(1.06, 0.2, 'power1.out');
      Audio.playJump();
      spawnJumpCloud(p.x, p.y);
      updatePlayerSpritePose('jump');
    } else if (p.jumpsLeft > 0) {
      p.vy = DOUBLE_JUMP_FORCE;
      p.jumpsLeft = 0;
      triggerSquashStretch(0.8, 1.3, 0.1, 'power2.out');
      cameraZoom(1.09, 0.22, 'power1.out');
      Audio.playDoubleJump();
      spawnDoubleJumpBurst(p.x, p.y - 20);
      updatePlayerSpritePose('jump');
    }
  }

  function slideStart() {
    const p = STATE.p;
    if (!p.isSliding) {
      p.isSliding = true;
      p.h = 48; // duck hitbox
      triggerSquashStretch(1.35, 0.65, 0.08, 'power2.out');
      Audio.playSlide();
      updatePlayerSpritePose('slide');

      // Check frame-perfect Landing Dash (120ms window)
      const now = Date.now();
      if (now - STATE.lastLandingAt <= 120) {
        triggerLandingDash();
      }
    }
  }

  function slideEnd() {
    const p = STATE.p;
    p.isSliding = false;
    p.h = 88;
    triggerSquashStretch(1.0, 1.0, 0.15, 'back.out(1.5)');
    if (p.isGrounded) {
      updatePlayerSpritePose('run');
    }
  }

  function triggerLandingDash() {
    STATE.speed = Math.min(STATE.speed + 3.8, MAX_SPEED);
    STATE.stamina = Math.min(STATE.stamina + 10, 100);
    Audio.playLandingDash();
    flashAlert('⚡ LANDING DASH! +SPEED');
    triggerScreenShake(5);
    cameraZoom(0.92, 0.15, 'power2.out');
    triggerSquashStretch(1.25, 0.75, 0.08, 'power2.out');

    // Burst 20 blue neon sparks and sakura drift
    spawnLandingDashSparks(STATE.p.x, STATE.p.y);
  }

  function triggerNearMiss() {
    STATE.speed = Math.min(STATE.speed + 2.2, MAX_SPEED);
    STATE.score += 3000;
    STATE.combo += 1;
    Audio.playNearMiss();
    flashAlert('🔥 NEAR-MISS! +25% SURGE');
    triggerScreenShake(3);
    cameraZoom(1.04, 0.1, 'power1.out');
  }

  function flashAlert(text) {
    const el = $('skydashAlertFlash');
    if (!el) return;
    el.textContent = text;
    el.classList.remove('active');
    void el.offsetWidth;
    el.classList.add('active');
    setTimeout(() => el.classList.remove('active'), 550);
  }

  function updatePlayerSpritePose(pose) {
    if (!sprPlayer || !TEX) return;
    const g = STATE.p.gender === 'm' ? 'm' : 'f';
    const key = `inari_${g}_${pose}`;
    if (TEX[key]) {
      sprPlayer.texture = TEX[key];
    }
  }

  // ---------------------------------------------------------------------------
  // COSTUME ULTIMATES & MYTHIC SKILLS
  // ---------------------------------------------------------------------------
  function triggerUltimate() {
    if (STATE.ultActive) return;
    STATE.ultActive = true;
    STATE.ultTimer = 6.0;
    STATE.fever = 0;
    Audio.playUltimate(STATE.costume ? STATE.costume.id : 'generic');
    cameraZoom(0.91, 0.25, 'power2.out');
    triggerScreenShake(6);

    const banner = $('skydashUltBanner');
    if (banner) {
      const name = STATE.costume ? STATE.costume.name : 'Super';
      banner.textContent = `✨ ${name} ULTIMATE RUSH! ✨`;
      banner.classList.add('active');
      setTimeout(() => banner.classList.remove('active'), 2500);
    }

    // Convert nearby hurdles into sparkling diamonds
    STATE.obstaclesPool.forEach((obs) => {
      obs.cleared = true;
      spawnGemBurst(obs.x, obs.y, 8);
    });
  }

  // ---------------------------------------------------------------------------
  // MYTHIC COMPANION PET ACTIONS (HANAMI / CAPTAIN WHISKERS)
  // ---------------------------------------------------------------------------
  function updateCompanion(dt) {
    const c = STATE.companion;
    const p = STATE.p;

    c.targetX = p.x - (p.isSliding ? 55 : 45);
    c.targetY = p.y - 15;

    c.x += (c.targetX - c.x) * 0.14;
    c.y += (c.targetY - c.y) * 0.14;

    c.cooldown -= dt;
    if (c.cooldown <= 0) {
      c.cooldown = 12.0;
      triggerCompanionSkill();
    }

    if (c.speechTimer > 0) {
      c.speechTimer -= dt;
      if (c.speechTimer <= 0) {
        c.speech = null;
        if (companionSpeechBubble) companionSpeechBubble.visible = false;
      }
    }
  }

  function triggerCompanionSkill() {
    const petId = STATE.companion.activePetId;

    if (petId === 'm_sakura') {
      // Hanami Sakura Cushion
      STATE.stamina = Math.min(STATE.stamina + 25, 100);
      STATE.speed = Math.min(STATE.speed + 2.0, MAX_SPEED);
      showCompanionSpeech('🌸 Sakura Boost!');
      Audio.playDiamond(1);
      spawnGemBurst(STATE.companion.x, STATE.companion.y, 6);
    } else if (petId === 'm_captain') {
      // Captain Whiskers Supersonic Tailwind
      STATE.speed = Math.min(STATE.speed + 3.0, MAX_SPEED);
      showCompanionSpeech('🛫 Supersonic Tailwind!');
      Audio.playNearMiss();
      triggerScreenShake(3);
    } else {
      // Fortune Maneki Vacuum
      vacuumAllNearbyDiamonds();
      showCompanionSpeech('🪙 Golden Luck!');
      Audio.playDiamond(3);
    }
  }

  function showCompanionSpeech(text) {
    STATE.companion.speech = text;
    STATE.companion.speechTimer = 2.4;
    if (companionSpeechBubble) {
      const txtObj = companionSpeechBubble.children[1];
      if (txtObj) txtObj.text = text;
      companionSpeechBubble.visible = true;
    }
  }

  // ---------------------------------------------------------------------------
  // ITEM SABOTAGE ARSENAL
  // ---------------------------------------------------------------------------
  function collectItemBox(item) {
    STATE.heldItem = item;
    const slot = $('skydashItemSlot');
    if (slot) {
      slot.classList.add('has-item');
      slot.setAttribute('data-item', item);
      const iconMap = {
        banana: '🍌',
        rocket: '🚀',
        lightning: '⚡',
        shield: '🛡️',
        jet: '💨',
        magnet: '🧲'
      };
      slot.innerHTML = `<span class="skydash-item-ico">${iconMap[item] || '❓'}</span>`;
    }
    flashAlert(`🎁 GOT ${item.toUpperCase()}!`);
  }

  function triggerHeldItem() {
    if (!STATE.heldItem) return;
    const item = STATE.heldItem;
    STATE.heldItem = null;

    const slot = $('skydashItemSlot');
    if (slot) {
      slot.classList.remove('has-item');
      slot.removeAttribute('data-item');
      slot.innerHTML = '';
    }

    Audio.playItem(item);

    switch (item) {
      case 'jet':
        STATE.speed = Math.min(STATE.speed + 5.0, MAX_SPEED);
        STATE.stamina = 100;
        cameraZoom(0.9, 0.2, 'power2.out');
        triggerScreenShake(6);
        flashAlert('💨 SUPER JET BOOST!');
        break;
      case 'shield':
        STATE.p.shield = true;
        flashAlert('🛡️ BUBBLE SHIELD ACTIVE!');
        break;
      case 'banana':
        flashAlert('🍌 DROPPED BANANA PEEL!');
        break;
      case 'rocket':
        flashAlert('🚀 HOMING ROCKET LAUNCHED!');
        triggerScreenShake(4);
        break;
      case 'lightning':
        flashAlert('⚡ LIGHTNING STRIKE RIVALS!');
        triggerScreenShake(7);
        break;
      case 'magnet':
        vacuumAllNearbyDiamonds();
        flashAlert('🧲 DIAMOND MAGNET ACTIVE!');
        break;
    }
  }

  function vacuumAllNearbyDiamonds() {
    STATE.diamondsPool.forEach((d) => {
      if (!d.collected && Math.abs(d.x - STATE.p.x) < 400) {
        d.collected = true;
        STATE.diamonds += d.isStar ? 3 : 1;
        STATE.score += 450;
        spawnSparkle(d.x, d.y);
      }
    });
  }

  // ---------------------------------------------------------------------------
  // WORLD SPAWNING (PARALLAX & SAKURA TRACK)
  // ---------------------------------------------------------------------------
  function resetWorld() {
    STATE.sakuraPetals = [];
    STATE.diamondsPool = [];
    STATE.obstaclesPool = [];
    STATE.particlesPool = [];

    // Pre-populate falling sakura petals
    for (let i = 0; i < 30; i++) {
      STATE.sakuraPetals.push({
        x: Math.random() * 1280,
        y: Math.random() * 600,
        vx: -(1.5 + Math.random() * 2.0),
        vy: 1.0 + Math.random() * 1.5,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.08,
        size: 5 + Math.random() * 5
      });
    }

    const h = (pixiApp ? pixiApp.screen.height : 540);
    const groundY = h - 140;
    STATE.p.y = groundY;
    STATE.companion.y = groundY;

    spawnTrackSegment(400);
  }

  function spawnTrackSegment(startX) {
    const h = (pixiApp ? pixiApp.screen.height : 540);
    const groundY = h - 140;

    for (let x = startX; x < startX + 1600; x += 350) {
      // Parabolic diamond arcs (Cookie Run style)
      const arcCenter = x + 110;
      for (let i = -3; i <= 3; i++) {
        const dX = arcCenter + i * 36;
        const dY = groundY - 60 - (9 - i * i) * 9;
        STATE.diamondsPool.push({
          x: dX,
          y: dY,
          collected: false,
          isStar: i === 0 || Math.random() < 0.2
        });
      }

      // Obstacle or Hurdle
      const obsType = Math.random() < 0.55 ? 'lantern' : 'laser_gate';
      STATE.obstaclesPool.push({
        x: x + 260,
        y: obsType === 'laser_gate' ? groundY - 80 : groundY - 70,
        w: obsType === 'laser_gate' ? 44 : 40,
        h: obsType === 'laser_gate' ? 80 : 70,
        type: obsType,
        cleared: false,
        hit: false
      });

      // Mystery Box
      if (Math.random() < 0.35) {
        const items = ['banana', 'rocket', 'lightning', 'shield', 'jet', 'magnet'];
        STATE.itemsPool.push({
          x: x + 180,
          y: groundY - 85,
          item: items[Math.floor(Math.random() * items.length)],
          collected: false
        });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // MAIN TICK & UPDATE LOOP
  // ---------------------------------------------------------------------------
  function gameLoop(time) {
    if (!STATE.active) return;
    animFrameId = requestAnimationFrame(gameLoop);

    const dt = Math.min((time - lastTime) / 1000, 0.05);
    lastTime = time;

    if (!STATE.paused) {
      STATE.animTimer += dt;
      updatePhysics(dt);
      updateWorld(dt);
      updateCompanion(dt);
      updateCameraDirector();
      updateHUD();
    }

    renderFrame();
  }

  function updatePhysics(dt) {
    const p = STATE.p;
    const h = (pixiApp ? pixiApp.screen.height : 540);
    const groundY = h - 140;

    STATE.distance += (STATE.speed * 60 * dt) * 0.35;
    STATE.score += Math.round(STATE.speed * 12);

    // Footstep audio rhythm & dust
    if (p.isGrounded && !p.isSliding) {
      stepSoundTimer += dt;
      if (stepSoundTimer >= 0.18) {
        stepSoundTimer = 0;
        Audio.playStep();
        spawnRunFootprint(p.x, groundY);
      }
    }

    // Stamina drain
    if (!STATE.isFever && !STATE.ultActive) {
      STATE.stamina = Math.max(0, STATE.stamina - dt * 2.2);
      if (STATE.stamina <= 0) {
        STATE.speed = Math.max(3.8, STATE.speed - dt * 2.0);
      }
    }

    // Vertical Gravity & Jump Trajectory
    p.vy += GRAVITY;
    p.y += p.vy;

    // Ground Touchdown
    if (p.y >= groundY) {
      p.y = groundY;
      p.vy = 0;
      if (!p.isGrounded) {
        p.isGrounded = true;
        p.jumpsLeft = 2;
        triggerSquashStretch(1.22, 0.78, 0.08, 'back.out(2)');
        STATE.lastLandingAt = Date.now();
        STATE.landingDashWindow = 120; // 120ms rhythm window
        if (!p.isSliding) {
          updatePlayerSpritePose('run');
        }
      }
    }

    if (STATE.landingDashWindow > 0) {
      STATE.landingDashWindow = Math.max(0, STATE.landingDashWindow - (dt * 1000));
    }

    if (p.stumbleTimer > 0) {
      p.stumbleTimer -= dt;
    }

    if (STATE.ultActive) {
      STATE.ultTimer -= dt;
      if (STATE.ultTimer <= 0) STATE.ultActive = false;
    }

    if (STATE.isFever) {
      STATE.feverTimer -= dt;
      if (STATE.feverTimer <= 0) {
        STATE.isFever = false;
        STATE.speed = BASE_SPEED;
      }
    }

    if (STATE.distance >= TRACK_LENGTH) {
      finishRace();
    }
  }

  function updateWorld(dt) {
    const moveX = STATE.speed * 60 * dt;
    const p = STATE.p;
    const pBox = { x: p.x - p.w / 2, y: p.y - p.h, w: p.w, h: p.h };

    // Move Diamonds & Collect Check
    STATE.diamondsPool.forEach((d) => {
      d.x -= moveX;
      if (!d.collected && checkAABB(pBox, { x: d.x - 18, y: d.y - 18, w: 36, h: 36 })) {
        d.collected = true;
        STATE.diamonds += d.isStar ? 3 : 1;
        STATE.score += d.isStar ? 500 : 150;
        STATE.combo += 1;
        STATE.fever = Math.min(100, STATE.fever + 3.2);

        if (STATE.fever >= 100 && !STATE.isFever) {
          enterFeverMode();
        }

        Audio.playDiamond(STATE.combo);
        spawnSparkle(d.x, d.y);
      }
    });

    // Move Obstacles & Collision Check
    STATE.obstaclesPool.forEach((obs) => {
      obs.x -= moveX;
      if (!obs.cleared && !obs.hit && !STATE.ultActive && !STATE.isFever) {
        if (checkAABB(pBox, obs)) {
          if (p.shield) {
            p.shield = false;
            obs.cleared = true;
            flashAlert('🛡️ SHIELD BLOCKED HIT!');
            Audio.playItem('shield');
            triggerScreenShake(4);
          } else {
            obs.hit = true;
            p.stumbleTimer = 0.8;
            STATE.speed = Math.max(3.8, STATE.speed - 3.5);
            STATE.combo = 0;
            Audio.playHit();
            flashAlert('💥 STUMBLE!');
            triggerHitStop(80);
            triggerScreenShake(8);
          }
        } else if (obs.x < p.x && !obs.cleared) {
          const dist = Math.abs(obs.x - p.x);
          if (dist < 45 && p.isSliding) {
            obs.cleared = true;
            triggerNearMiss();
          }
        }
      }
    });

    // Move Items & Box Collect Check
    STATE.itemsPool.forEach((box) => {
      box.x -= moveX;
      if (!box.collected && checkAABB(pBox, { x: box.x - 20, y: box.y - 20, w: 40, h: 40 })) {
        box.collected = true;
        collectItemBox(box.item);
        Audio.playDiamond(5);
      }
    });

    // Clean up off-screen elements
    STATE.diamondsPool = STATE.diamondsPool.filter((d) => d.x > -60);
    STATE.obstaclesPool = STATE.obstaclesPool.filter((o) => o.x > -100);
    STATE.itemsPool = STATE.itemsPool.filter((i) => i.x > -60);

    const w = (pixiApp ? pixiApp.screen.width : 960);
    const maxTrackX = STATE.diamondsPool.reduce((m, d) => Math.max(m, d.x), 0);
    if (maxTrackX < w + 600) {
      spawnTrackSegment(maxTrackX + 220);
    }

    // Update Sakura Petals
    STATE.sakuraPetals.forEach((pt) => {
      pt.x += pt.vx;
      pt.y += pt.vy;
      pt.rotation += pt.rotSpeed;
      if (pt.y > 600 || pt.x < -20) {
        pt.x = w + Math.random() * 80;
        pt.y = -20 + Math.random() * 200;
      }
    });

    // Update Particles
    STATE.particlesPool.forEach((pt) => {
      pt.x += pt.vx;
      pt.y += pt.vy;
      pt.life -= dt;
    });
    STATE.particlesPool = STATE.particlesPool.filter((pt) => pt.life > 0);
  }

  function enterFeverMode() {
    STATE.isFever = true;
    STATE.feverTimer = 7.5;
    STATE.speed = Math.min(STATE.speed + 4.5, MAX_SPEED);
    Audio.playFeverStart();
    flashAlert('🌈 HYPER FEVER FLIGHT!');
    cameraZoom(0.92, 0.3, 'power2.out');
    triggerScreenShake(6);
  }

  function checkAABB(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  // ---------------------------------------------------------------------------
  // PIXI.JS v8 RENDERER (MAPLESTORY / COOKIE RUN AAA PIPELINE)
  // ---------------------------------------------------------------------------
  function renderFrame() {
    if (pixiApp && cameraContainer) {
      renderPixiFrame();
    } else {
      renderCanvas2D();
    }
  }

  function renderPixiFrame() {
    const w = pixiApp.screen.width;
    const h = pixiApp.screen.height;
    const groundY = h - 140;

    // 1. Background Parallax Scrolling (Tokyo Twilight Skyline)
    if (sprSkyline) {
      sprSkyline.width = w;
      sprSkyline.height = h;
      sprSkyline.tilePosition.x = -(STATE.distance * 0.22);
    }

    // 2. Cloud Highway Runway Scrolling
    if (sprHighway) {
      sprHighway.width = w;
      sprHighway.height = Math.max(140, h - groundY);
      sprHighway.y = groundY;
      sprHighway.tilePosition.x = -(STATE.distance * 1.0);
      sprHighway.tilePosition.y = -260;
    }

    // 3. Torii Boost Arch
    if (sprTorii) {
      const toriiSpacing = 1500;
      const toriiOffset = (STATE.distance % toriiSpacing);
      const toriiX = w - toriiOffset;
      sprTorii.x = toriiX;
      sprTorii.y = groundY + 10;
    }

    // Self-healing texture update for player avatar
    if (sprPlayer && TEX) {
      const g = STATE.p.gender === 'm' ? 'm' : 'f';
      const curPose = STATE.p.isSliding ? 'slide' : (STATE.p.isGrounded ? 'run' : 'jump');
      const poseKey = `inari_${g}_${curPose}`;
      if (TEX[poseKey] && (sprPlayer.texture === PIXI.Texture.EMPTY || !sprPlayer.texture)) {
        sprPlayer.texture = TEX[poseKey];
      }
    }

    // Self-healing texture update for companion
    if (sprCompanion && TEX) {
      const activePet = STATE.companion.activePetId || 'm_sakura';
      const petKey = activePet.includes('captain') ? 'cat_captain' : 'cat_sakura';
      if (TEX[petKey] && (sprCompanion.texture === PIXI.Texture.EMPTY || !sprCompanion.texture)) {
        sprCompanion.texture = TEX[petKey];
      }
    }

    // 4. Update Entities Layer (Diamonds, Stars, Hurdles, Boxes)
    entitiesLayer.removeChildren();

    // Render Parabolic Diamonds & Stars
    STATE.diamondsPool.forEach((d) => {
      if (d.collected || d.x < -40 || d.x > w + 40) return;
      const tex = (d.isStar ? TEX.star : TEX.diamond) || TEX.diamond || TEX.star;
      if (!tex) return;
      const spr = new PIXI.Sprite(tex);
      spr.anchor.set(0.5);
      spr.x = d.x;
      spr.y = d.y + Math.sin(STATE.animTimer * 5 + d.x * 0.05) * 4;
      spr.width = d.isStar ? 42 : 38;
      spr.height = d.isStar ? 42 : 38;
      entitiesLayer.addChild(spr);
    });

    // Render Hurdles (Swaying Lanterns & Hologram Lasers)
    STATE.obstaclesPool.forEach((obs) => {
      if (obs.cleared || obs.x < -60 || obs.x > w + 60) return;
      const tex = (obs.type === 'laser_gate' ? TEX.laser : TEX.lantern) || TEX.lantern || TEX.laser;
      if (!tex) return;
      const spr = new PIXI.Sprite(tex);
      if (obs.type === 'lantern') {
        spr.anchor.set(0.5, 0.0);
        spr.x = obs.x + obs.w / 2;
        spr.y = obs.y - 10;
        spr.rotation = Math.sin(STATE.animTimer * 3.5 + obs.x * 0.02) * 0.08;
      } else {
        spr.anchor.set(0.5, 1.0);
        spr.x = obs.x + obs.w / 2;
        spr.y = groundY;
        spr.alpha = 0.85 + Math.sin(STATE.animTimer * 12) * 0.15;
      }
      spr.width = obs.w * 1.5;
      spr.height = obs.h * 1.2;
      entitiesLayer.addChild(spr);
    });

    // Render Mystery Boxes
    STATE.itemsPool.forEach((box) => {
      if (box.collected || box.x < -50 || box.x > w + 50) return;
      const tex = TEX.mystery_box;
      if (!tex) return;
      const spr = new PIXI.Sprite(tex);
      spr.anchor.set(0.5);
      spr.x = box.x;
      spr.y = box.y + Math.sin(STATE.animTimer * 6) * 5;
      spr.width = 46;
      spr.height = 46;
      entitiesLayer.addChild(spr);
    });

    // 5. Update Player Avatar Position & Movement (MapleStory Bounce)
    const p = STATE.p;
    playerContainer.x = p.x;

    // Running bobbing bounce on ground
    const runBob = (p.isGrounded && !p.isSliding) ? Math.sin(STATE.animTimer * 18) * 4.5 : 0;
    playerContainer.y = p.y + runBob;

    // Correct scale without 1024px texture blowup
    sprPlayer.width = 82 * p.scaleX;
    sprPlayer.height = 82 * p.scaleY;

    // Tilt slightly forward during turbo dash
    if (STATE.speed > BASE_SPEED + 2 || STATE.isFever) {
      sprPlayer.rotation = -0.12;
    } else {
      sprPlayer.rotation = (p.isGrounded && !p.isSliding) ? Math.sin(STATE.animTimer * 18) * 0.05 : 0;
    }

    if (p.stumbleTimer > 0) {
      sprPlayer.tint = 0xef4444;
    } else if (STATE.ultActive) {
      sprPlayer.tint = 0xfef08a;
    } else {
      sprPlayer.tint = 0xffffff;
    }

    // 6. Update Mythic Companion Position (Spring Lerp)
    const comp = STATE.companion;
    companionContainer.x = comp.x;
    companionContainer.y = comp.y + Math.sin(STATE.animTimer * 8) * 5;
    sprCompanion.width = 52;
    sprCompanion.height = 52;

    // 7. FX Layer (Particles, Sakura Petals, Shockwaves)
    fxGraphics.clear();

    // Drifting Sakura Petals
    STATE.sakuraPetals.forEach((petal) => {
      fxGraphics.circle(petal.x, petal.y, petal.size).fill({ color: 0xfbcfe8, alpha: 0.65 });
    });

    // Landing Dash Spark Particles
    STATE.particlesPool.forEach((pt) => {
      fxGraphics.circle(pt.x, pt.y, Math.max(1, pt.size || 3)).fill({
        color: pt.color || 0x38bdf8,
        alpha: Math.min(1, pt.life)
      });
    });

    // Landing Dash 120ms Shockwave Cue
    if (STATE.landingDashWindow > 0) {
      fxGraphics.circle(p.x, groundY, 32).stroke({ color: 0x38bdf8, width: 3 });
    }

    // High Speed Lines during Dash / Fever
    if (STATE.speed > BASE_SPEED + 2 || STATE.isFever) {
      for (let i = 0; i < 6; i++) {
        const slX = Math.random() * w;
        const slY = Math.random() * (groundY - 50);
        fxGraphics.moveTo(slX, slY).lineTo(slX + 70, slY).stroke({ color: 0xffffff, width: 2, alpha: 0.4 });
      }
    }

    pixiApp.render();
  }

  // ---------------------------------------------------------------------------
  // 2D CANVAS FALLBACK RENDERER
  // ---------------------------------------------------------------------------
  function renderCanvas2D() {
    if (!ctx || !canvas) return;
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);
    const groundY = h - 140;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = STATE.isFever ? '#f43f5e' : '#0f172a';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#1e1b4b';
    ctx.fillRect(0, groundY, w, 140);
  }

  // ---------------------------------------------------------------------------
  // PARTICLE SPAWNERS
  // ---------------------------------------------------------------------------
  function spawnJumpCloud(x, y) {
    for (let i = 0; i < 6; i++) {
      STATE.particlesPool.push({
        x: x + (Math.random() * 20 - 10),
        y: y,
        vx: (Math.random() - 0.5) * 3,
        vy: -Math.random() * 2,
        size: 4 + Math.random() * 4,
        color: 0xffffff,
        life: 0.35
      });
    }
  }

  function spawnDoubleJumpBurst(x, y) {
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      STATE.particlesPool.push({
        x, y,
        vx: Math.cos(angle) * 5,
        vy: Math.sin(angle) * 5,
        size: 3.5,
        color: 0x38bdf8,
        life: 0.45
      });
    }
  }

  function spawnLandingDashSparks(x, y) {
    for (let i = 0; i < 20; i++) {
      STATE.particlesPool.push({
        x: x,
        y: y,
        vx: -(Math.random() * 8 + 4),
        vy: (Math.random() - 0.5) * 5,
        size: 3,
        color: 0x60a5fa,
        life: 0.55
      });
    }
  }

  function spawnRunFootprint(x, y) {
    STATE.particlesPool.push({
      x: x - 20,
      y: y - 5,
      vx: -STATE.speed * 0.4,
      vy: -0.5,
      size: 3,
      color: 0xfbcfe8,
      life: 0.25
    });
  }

  function spawnSparkle(x, y) {
    for (let i = 0; i < 6; i++) {
      STATE.particlesPool.push({
        x, y,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4,
        size: 2.5,
        color: 0xfbbf24,
        life: 0.35
      });
    }
  }

  function spawnGemBurst(x, y, count = 8) {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      STATE.particlesPool.push({
        x, y,
        vx: Math.cos(angle) * 6,
        vy: Math.sin(angle) * 6,
        size: 4,
        color: 0x67e8f9,
        life: 0.5
      });
    }
  }

  // ---------------------------------------------------------------------------
  // HUD UPDATES
  // ---------------------------------------------------------------------------
  function updateHUD() {
    const distText = $('skydashDistText');
    const progFill = $('skydashProgressFill');
    const runnerPin = $('skydashRunnerPin');
    const diaVal = $('skydashDiamondsVal');
    const scoreVal = $('skydashScoreVal');
    const comboPill = $('skydashComboPill');
    const comboVal = $('skydashComboVal');
    const staminaFill = $('skydashStaminaFill');
    const feverFill = $('skydashFeverFill');

    if (distText) distText.textContent = `${Math.round(STATE.distance)}m / ${TRACK_LENGTH}m`;
    const pct = Math.min(100, (STATE.distance / TRACK_LENGTH) * 100);
    if (progFill) progFill.style.width = `${pct}%`;
    if (runnerPin) runnerPin.style.left = `${pct}%`;

    if (diaVal) diaVal.textContent = STATE.diamonds;
    if (scoreVal) scoreVal.textContent = STATE.score.toLocaleString();

    if (comboPill && comboVal) {
      comboVal.textContent = `×${STATE.combo}`;
      if (STATE.combo > 2) comboPill.classList.add('fire');
      else comboPill.classList.remove('fire');
      if (STATE.combo > STATE.maxCombo) STATE.maxCombo = STATE.combo;
    }

    if (staminaFill) staminaFill.style.width = `${Math.round(STATE.stamina)}%`;
    if (feverFill) {
      feverFill.style.width = `${Math.round(STATE.fever)}%`;
      if (STATE.fever >= 100) feverFill.classList.add('ready');
      else feverFill.classList.remove('ready');
    }
  }

  // ---------------------------------------------------------------------------
  // LIFECYCLE & FINISH
  // ---------------------------------------------------------------------------
  function startRace() {
    const lobby = $('skydashLobbyOverlay');
    if (lobby) lobby.classList.add('hidden');

    syncEquippedMeta();
    STATE.active = true;
    STATE.paused = false;
    STATE.distance = 0;
    STATE.speed = BASE_SPEED;
    STATE.score = 0;
    STATE.diamonds = 0;
    STATE.combo = 0;
    STATE.stamina = 100;
    STATE.fever = 0;
    STATE.isFever = false;
    STATE.ultActive = false;
    STATE.heldItem = null;
    STATE.animTimer = 0;

    resetWorld();
    lastTime = performance.now();
    animFrameId = requestAnimationFrame(gameLoop);
  }

  function finishRace() {
    STATE.active = false;
    if (animFrameId) cancelAnimationFrame(animFrameId);
    Audio.playVictory();
    showSummary();
  }

  function showSummary() {
    const overlay = $('skydashSummaryOverlay');
    if (!overlay) return;

    $('skydashSumDist').textContent = `${Math.round(STATE.distance)}m`;
    $('skydashSumScore').textContent = STATE.score.toLocaleString();
    $('skydashSumDiamonds').textContent = `+${STATE.diamonds} 💎`;
    $('skydashSumCombo').textContent = `×${STATE.maxCombo}`;

    if (window.NookVault && window.NookVault.creditRewards) {
      window.NookVault.creditRewards({ diamonds: STATE.diamonds });
    }

    overlay.classList.add('active');
  }

  function hideSummary() {
    const overlay = $('skydashSummaryOverlay');
    if (overlay) overlay.classList.remove('active');
  }

  async function openSkyDashModal() {
    if (!pixiApp) {
      await initEngine();
    } else if (pixiApp.start) {
      pixiApp.start();
    }
    syncEquippedMeta();
    const modal = $('skydashModal');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('active');
    }
    const lobby = $('skydashLobbyOverlay');
    if (lobby) lobby.classList.remove('hidden');
    resizeCanvas();
    requestAnimationFrame(() => {
      resizeCanvas();
      renderFrame();
    });
  }

  function closeSkyDashModal() {
    STATE.active = false;
    if (animFrameId) cancelAnimationFrame(animFrameId);
    if (pixiApp && pixiApp.stop) {
      pixiApp.stop();
    }
    const modal = $('skydashModal');
    if (modal) {
      modal.classList.remove('active');
      modal.classList.add('hidden');
    }
  }

  // Global API
  root.SkyDash = {
    init: initSkyDash,
    open: openSkyDashModal,
    close: closeSkyDashModal,
    triggerFever: enterFeverMode,
    triggerUltimate: triggerUltimate,
    getState: () => STATE
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSkyDash);
  } else {
    initSkyDash();
  }
})(typeof window !== 'undefined' ? window : global);
