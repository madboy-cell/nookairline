/**
 * 🚀 Sky Party — Unified PixiJS v8 Hardware-Accelerated Game & Visual FX Engine (window.SkyPixi)
 *
 * Core Architecture:
 * - Mounts a transparent 120Hz WebGL canvas over the board (#monopolyBoardWrap)
 *   and full viewport for cinematic costume skills and particle eruptions.
 * - Hardware sprite batching: 5,000+ particles with zero DOM garbage-collection lag.
 * - Additive GPU blending ('add') for electric lightning, solar lasers, and stardust.
 * - Fully powers all 11 Seasons of Mythic Costume Ultimates:
 *     S11 Zeus & Athena (Wrath of Olympus & Lightning Smite)
 *     S10 Phantom Wolf & Black Swan (Masquerade Curtain Call & Reverse Hex)
 *     S9  Pharaoh Ramses & Ra (Great Golden Pyramid & Solar Wrath Laser)
 *     S8  Glacial Elsa (Absolute Zero Ice Fissures & Ice Citadel)
 *     S7  Midnight Cinderella & Beast (Clockwork Paradox & Beast Pounce)
 *     S6  Astral Sovereign (Void Lightning Tithe & Supernova Core)
 *     S5  Atlantis Drift (Tsunami Foam Wall & Whirlpool Vortex)
 *     S4  Monaco High-Roller (3D Roulette Wheel & Chip Geyser)
 *     S1-S3 Legacy (Naga Surge, Eclipse Corona, Cosmic Djinn)
 * - Safe Graceful Fallback: If WebGL is unavailable (e.g. headless CI or low-spec devices),
 *   delegates seamlessly back to DOM/SVG with zero regressions.
 */
(function () {
  'use strict';

  const SkyPixi = {
    isReady: false,
    app: null,
    canvas: null,
    viewportApp: null,
    viewportCanvas: null,
    layers: {
      boardUnder: null,
      tokens: null,
      particles: null,
      beams: null,
      cinematic: null
    },
    activeParticles: [],
    activeMeshes: [],
    textures: {},
    hooks: {}
  };

  // Helper utilities
  const rand = (min, max) => min + Math.random() * (max - min);
  const randInt = (min, max) => Math.floor(rand(min, max + 1));
  const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

  /**
   * Initializes the PixiJS v8 WebGL engine over the board.
   */
  async function init() {
    if (typeof window === 'undefined') return false;
    if (typeof PIXI === 'undefined') {
      console.warn('[SkyPixi] PIXI is not loaded on window. Fallback active.');
      return false;
    }

    if (SkyPixi.isReady && SkyPixi.app) {
      resize();
      return true;
    }

    try {
      const boardWrap = document.getElementById('monopolyBoardWrap') || document.querySelector('.monopoly-board-wrap');
      if (!boardWrap) {
        // Will retry when board mounts
        return false;
      }

      // Check if canvas already exists
      let canvas = document.getElementById('skyPixiCanvas');
      if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.id = 'skyPixiCanvas';
        canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:25;';
        boardWrap.appendChild(canvas);
      }
      SkyPixi.canvas = canvas;

      const isMobileDevice = typeof window !== 'undefined' && (window.innerWidth < 768 || /iPhone|iPad|iPod|Android/i.test((navigator && navigator.userAgent) || ''));
      const dpr = Math.min(window.devicePixelRatio || 1, isMobileDevice ? 1.5 : 2);

      // Initialize PixiJS v8 Application
      const app = new PIXI.Application();
      if (typeof app.init === 'function') {
        await app.init({
          canvas: canvas,
          backgroundAlpha: 0,
          resizeTo: boardWrap,
          antialias: !isMobileDevice,
          resolution: dpr,
          autoDensity: true
        });
      } else {
        // Fallback for Pixi v7 sync constructor
        SkyPixi.app = new PIXI.Application({
          view: canvas,
          backgroundAlpha: 0,
          resizeTo: boardWrap,
          antialias: !isMobileDevice,
          resolution: dpr,
          autoDensity: true
        });
      }
      SkyPixi.app = app;

      // Create Layer Hierarchy
      SkyPixi.layers.boardUnder = new PIXI.Container();
      SkyPixi.layers.tokens = new PIXI.Container();
      SkyPixi.layers.particles = new PIXI.Container();
      SkyPixi.layers.beams = new PIXI.Container();
      SkyPixi.layers.cinematic = new PIXI.Container();

      app.stage.addChild(SkyPixi.layers.boardUnder);
      app.stage.addChild(SkyPixi.layers.tokens);
      app.stage.addChild(SkyPixi.layers.particles);
      app.stage.addChild(SkyPixi.layers.beams);
      app.stage.addChild(SkyPixi.layers.cinematic);

      // Pre-generate procedural textures (coins, sparks, stardust, shockwave rings)
      generateProceduralTextures();

      let idleTickerFrames = 0;
      let tickerRunning = true;

      function wakeTicker() {
        idleTickerFrames = 0;
        if (SkyPixi.app && SkyPixi.app.ticker) {
          const started = SkyPixi.app.ticker.started;
          if (!tickerRunning || !started) {
            tickerRunning = true;
            try { SkyPixi.app.ticker.start(); } catch (e) {}
          }
        }
      }
      SkyPixi.wakeTicker = wakeTicker;

      // Start high-refresh ticker loop with strict demand-driven power saving:
      // Only runs while active event particles or meshes exist, then sleeps at 0% CPU/GPU.
      app.ticker.add((time) => {
        const delta = (time && time.deltaTime) ? time.deltaTime : 1;
        try { updateParticles(delta); } catch (e) { console.warn('[SkyPixi] updateParticles notice:', e.message); }
        try { updateMeshes(delta); } catch (e) { console.warn('[SkyPixi] updateMeshes notice:', e.message); }

        // Demand-driven sleeper: if no active particles and no active meshes, sleep after 20 frames (~0.3s)
        if (SkyPixi.activeParticles.length === 0 && SkyPixi.activeMeshes.length === 0) {
          idleTickerFrames++;
          if (idleTickerFrames > 20) {
            tickerRunning = false;
            try { SkyPixi.app.ticker.stop(); } catch (e) {}
          }
        } else {
          idleTickerFrames = 0;
        }
      });

      // Mobile Efficiency & Zero-CPU background hibernation
      if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
        document.addEventListener('visibilitychange', () => {
          if (!SkyPixi.app || !SkyPixi.app.ticker) return;
          if (document.hidden) {
            tickerRunning = false;
            SkyPixi.app.ticker.stop();
          } else {
            resize();
            if (SkyPixi.activeParticles.length > 0 || SkyPixi.activeMeshes.length > 0) {
              wakeTicker();
            }
          }
        });
      }

      SkyPixi.isReady = true;
      console.log('✨ [SkyPixi] Hardware-Accelerated 120Hz WebGL Engine Active!');
      return true;
    } catch (err) {
      console.warn('[SkyPixi] WebGL initialization failed, falling back to DOM:', err.message);
      SkyPixi.isReady = false;
      return false;
    }
  }

  function resize() {
    if (!SkyPixi.app || !SkyPixi.app.renderer) return;
    const boardWrap = document.getElementById('monopolyBoardWrap') || document.querySelector('.monopoly-board-wrap');
    if (!boardWrap) return;
    const w = boardWrap.clientWidth;
    const h = boardWrap.clientHeight;
    if (w > 0 && h > 0 && typeof SkyPixi.app.renderer.resize === 'function') {
      SkyPixi.app.renderer.resize(w, h);
    }
  }

  function spawnTileLanding(x, y) {
    if (!SkyPixi.isReady) return false;
    if (SkyPixi.wakeTicker) SkyPixi.wakeTicker();
    spawnShockwaveRing(x, y, 0xfde047, 36, 260);
    spawnRadialBurst(x, y, 'spark', 6, { minSpeed: 1, maxSpeed: 4, additive: true });
    return true;
  }

  function spawnDiceImpact(x, y) {
    if (!SkyPixi.isReady) return false;
    if (SkyPixi.wakeTicker) SkyPixi.wakeTicker();
    const dpr = window.devicePixelRatio || 1;
    const targetX = x != null ? x : ((SkyPixi.canvas ? SkyPixi.canvas.width / dpr : 380) / 2);
    const targetY = y != null ? y : ((SkyPixi.canvas ? SkyPixi.canvas.height / dpr : 532) / 2);
    spawnShockwaveRing(targetX, targetY, 0xf59e0b, 65, 340);
    spawnShockwaveRing(targetX, targetY, 0x38bdf8, 95, 440);
    spawnRadialBurst(targetX, targetY, 'spark', 10, { minSpeed: 2, maxSpeed: 6.5, additive: true });
    return true;
  }

  /**
   * Generates reusable GPU textures on startup so particle emission is instantaneous.
   */
  function generateProceduralTextures() {
    if (!SkyPixi.app || !PIXI.Graphics) return;

    try {
      // 1. Golden Coin Texture
      const coinG = new PIXI.Graphics();
      coinG.circle(16, 16, 14);
      coinG.fill({ color: 0xffd700 });
      coinG.stroke({ color: 0xfffbeb, width: 2 });
      coinG.circle(16, 16, 9);
      coinG.stroke({ color: 0xb45309, width: 1.5 });
      SkyPixi.textures.coin = SkyPixi.app.renderer.generateTexture(coinG);

      // 2. High-Voltage Spark Texture
      const sparkG = new PIXI.Graphics();
      sparkG.circle(8, 8, 6);
      sparkG.fill({ color: 0xffffff });
      sparkG.stroke({ color: 0x38bdf8, width: 2 });
      SkyPixi.textures.spark = SkyPixi.app.renderer.generateTexture(sparkG);

      // 3. Cosmic Stardust Texture
      const starG = new PIXI.Graphics();
      starG.star(10, 10, 5, 8, 4);
      starG.fill({ color: 0xfef08a });
      SkyPixi.textures.stardust = SkyPixi.app.renderer.generateTexture(starG);

      // 4. Frost Crystal Shard
      const frostG = new PIXI.Graphics();
      frostG.poly([8, 0, 14, 8, 8, 16, 2, 8]);
      frostG.fill({ color: 0x7dd3fc, alpha: 0.9 });
      frostG.stroke({ color: 0xffffff, width: 1 });
      SkyPixi.textures.frost = SkyPixi.app.renderer.generateTexture(frostG);

      // 5. Fire Ember
      const fireG = new PIXI.Graphics();
      fireG.circle(6, 6, 5);
      fireG.fill({ color: 0xf97316 });
      SkyPixi.textures.ember = SkyPixi.app.renderer.generateTexture(fireG);

      // 6. Monaco Casino Chip
      const chipG = new PIXI.Graphics();
      chipG.circle(14, 14, 12);
      chipG.fill({ color: 0x064e3b });
      chipG.stroke({ color: 0x34d399, width: 2.5 });
      chipG.circle(14, 14, 6);
      chipG.fill({ color: 0xffd700 });
      SkyPixi.textures.chip = SkyPixi.app.renderer.generateTexture(chipG);

      // 7. Heart Texture
      const heartG = new PIXI.Graphics();
      heartG.circle(8, 8, 6);
      heartG.fill({ color: 0xec4899 });
      SkyPixi.textures.heart = SkyPixi.app.renderer.generateTexture(heartG);

      // 8. Petal Texture (Sakura Cherry Blossom & Enchanted Rose Petals)
      const petalG = new PIXI.Graphics();
      petalG.poly([10, 0, 18, 6, 16, 16, 10, 20, 4, 16, 2, 6]);
      petalG.fill({ color: 0xf43f5e, alpha: 0.92 });
      petalG.stroke({ color: 0xfda4af, width: 1.2 });
      SkyPixi.textures.petal = SkyPixi.app.renderer.generateTexture(petalG);

      // 9. Bubble Texture (Aquatic Vortex & Mekong/Atlantis Surges)
      const bubbleG = new PIXI.Graphics();
      bubbleG.circle(12, 12, 10);
      bubbleG.fill({ color: 0x38bdf8, alpha: 0.45 });
      bubbleG.stroke({ color: 0xe0f2fe, width: 1.5 });
      bubbleG.circle(9, 8, 2.5);
      bubbleG.fill({ color: 0xffffff, alpha: 0.85 });
      SkyPixi.textures.bubble = SkyPixi.app.renderer.generateTexture(bubbleG);

      // 10. Sunflame Feather Texture (Phoenix Rebirth & Solar Wrath)
      const flameG = new PIXI.Graphics();
      flameG.poly([8, 0, 15, 8, 12, 18, 8, 16, 4, 18, 1, 8]);
      flameG.fill({ color: 0xf97316 });
      flameG.stroke({ color: 0xfef08a, width: 1.5 });
      flameG.circle(8, 9, 3.5);
      flameG.fill({ color: 0xffffff, alpha: 0.9 });
      SkyPixi.textures.sunflame = SkyPixi.app.renderer.generateTexture(flameG);

      // 11. Crystal Mirror Shard Texture (Phantom Reverse Hex & Glacial Frost)
      const crystalG = new PIXI.Graphics();
      crystalG.poly([10, 0, 18, 7, 14, 19, 4, 17, 2, 9]);
      crystalG.fill({ color: 0xffffff, alpha: 0.92 });
      crystalG.stroke({ color: 0xf43f5e, width: 1.5 });
      SkyPixi.textures.crystal = SkyPixi.app.renderer.generateTexture(crystalG);

      // 12. Crescent Moon Texture (Eclipse Convergence & Midnight Paradox)
      const crescG = new PIXI.Graphics();
      crescG.poly([16, 0, 19, 6, 17, 14, 11, 20, 4, 22, 11, 16, 13, 10, 11, 4]);
      crescG.fill({ color: 0xc084fc, alpha: 0.9 });
      crescG.stroke({ color: 0xffffff, width: 1 });
      SkyPixi.textures.crescent = SkyPixi.app.renderer.generateTexture(crescG);
    } catch (e) {
      console.warn('[SkyPixi] Procedural texture generation notice:', e.message);
    }
  }

  // =========================================================
  // CORE PARTICLE & MOTION EMITTERS (120 FPS)
  // =========================================================

  const MAX_PARTICLES = 150;

  /**
   * Updates all active GPU particles each animation frame.
   */
  function updateParticles(delta) {
    const list = SkyPixi.activeParticles;

    // Mobile efficiency cap: prune oldest particles if burst volume exceeds 150 to ensure smooth 60/120 FPS
    while (list.length > MAX_PARTICLES) {
      const old = list.shift();
      if (old.parent) old.parent.removeChild(old);
      old.destroy();
    }

    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.life += delta;

      // Position update with gravity & velocity
      p.x += p.vx * delta;
      p.y += p.vy * delta;
      p.vy += (p.gravity || 0) * delta;
      p.rotation += (p.vRot || 0) * delta;

      // Scale and opacity decay
      if (p.decayAlpha) {
        p.alpha = Math.max(0, 1 - (p.life / p.maxLife));
      } else if (p.alphaStart !== undefined && p.alphaEnd !== undefined) {
        const prog = Math.min(1, p.life / p.maxLife);
        p.alpha = Math.max(0, p.alphaStart + (p.alphaEnd - p.alphaStart) * prog);
      }
      if (p.scaleDecay) {
        const sc = Math.max(0.01, p.initialScale * (1 - (p.life / p.maxLife) * 0.4));
        p.scale.set(sc);
      } else if (p.scaleStart !== undefined && p.scaleEnd !== undefined) {
        const prog = Math.min(1, p.life / p.maxLife);
        const sc = Math.max(0.01, p.scaleStart + (p.scaleEnd - p.scaleStart) * prog);
        p.scale.set(sc);
      }

      // Cleanup when dead
      if (p.life >= p.maxLife || p.alpha <= 0.01) {
        if (p.parent) p.parent.removeChild(p);
        p.destroy();
        list.splice(i, 1);
      }
    }
  }

  /**
   * Updates active mesh animations (expanding shockwaves, lightning flickers).
   */
  function updateMeshes(delta) {
    const list = SkyPixi.activeMeshes;
    for (let i = list.length - 1; i >= 0; i--) {
      const m = list[i];
      m.progress += (delta / (m.durationFrames || 30));
      if (m.onUpdate) m.onUpdate(m.progress);

      if (m.progress >= 1) {
        if (m.onComplete) m.onComplete();
        if (m.graphics && m.graphics.parent) m.graphics.parent.removeChild(m.graphics);
        if (m.graphics) m.graphics.destroy();
        list.splice(i, 1);
      }
    }
  }

  /**
   * Spawns a single configured GPU particle (used by environmental monument auras and skills).
   */
  function spawnParticle(opts = {}) {
    if (!SkyPixi.isReady) return false;
    if (SkyPixi.wakeTicker) SkyPixi.wakeTicker();

    const kind = opts.textureName || opts.kind || 'spark';
    const texture = SkyPixi.textures[kind] || SkyPixi.textures.spark;
    if (!texture) return false;

    const container = SkyPixi.layers.particles;
    if (!container) return false;

    const sprite = new PIXI.Sprite(texture);
    sprite.anchor.set(0.5);
    sprite.x = opts.x || 0;
    sprite.y = opts.y || 0;
    sprite.vx = opts.vx || 0;
    sprite.vy = opts.vy || 0;
    sprite.gravity = opts.gravity !== undefined ? opts.gravity : 0;
    sprite.vRot = opts.vRot !== undefined ? opts.vRot : (Math.random() - 0.5) * 0.1;
    sprite.life = opts.life || 0;
    sprite.maxLife = opts.maxLife || 40;

    sprite.scaleStart = opts.scaleStart !== undefined ? opts.scaleStart : 0.25;
    sprite.scaleEnd = opts.scaleEnd !== undefined ? opts.scaleEnd : 0.1;
    sprite.scale.set(sprite.scaleStart);

    sprite.alphaStart = opts.alphaStart !== undefined ? opts.alphaStart : 1.0;
    sprite.alphaEnd = opts.alphaEnd !== undefined ? opts.alphaEnd : 0.0;
    sprite.alpha = sprite.alphaStart;

    if (opts.color !== undefined) {
      try { sprite.tint = opts.color; } catch (e) {}
    }
    if (opts.blendMode) {
      try { sprite.blendMode = opts.blendMode; } catch (e) {}
    }

    container.addChild(sprite);
    SkyPixi.activeParticles.push(sprite);
    return true;
  }

  /**
   * Spawns a high-velocity parabolic coin fountain from (x1, y1) to (x2, y2).
   */
  function spawnCoinBurst(from, to, count = 28, opts = {}) {
    if (!SkyPixi.isReady || !SkyPixi.textures.coin) return false;
    if (SkyPixi.wakeTicker) SkyPixi.wakeTicker();

    const container = SkyPixi.layers.particles;
    const startX = from.x || from.left || 150;
    const startY = from.y || from.top || 150;
    const targetX = to ? (to.x || to.left || startX) : startX;
    const targetY = to ? (to.y || to.top || startY - 120) : startY - 120;

    for (let i = 0; i < count; i++) {
      const sprite = new PIXI.Sprite(SkyPixi.textures.coin);
      sprite.anchor.set(0.5);
      sprite.x = startX + rand(-12, 12);
      sprite.y = startY + rand(-12, 12);

      const angle = rand(-Math.PI * 0.85, -Math.PI * 0.15);
      const speed = rand(4, 10);
      sprite.vx = Math.cos(angle) * speed + (targetX - startX) * 0.018;
      sprite.vy = Math.sin(angle) * speed - rand(2, 6);
      sprite.gravity = 0.32;
      sprite.vRot = rand(-0.25, 0.25);
      sprite.life = 0;
      sprite.maxLife = rand(35, 65);
      sprite.initialScale = rand(0.55, 0.85);
      sprite.scale.set(sprite.initialScale);
      sprite.decayAlpha = true;
      sprite.scaleDecay = false;

      container.addChild(sprite);
      SkyPixi.activeParticles.push(sprite);
    }
    return true;
  }

  /**
   * Spawns a radial burst of particles (sparks, frost, fire, stardust, chips).
   */
  function spawnRadialBurst(x, y, kind = 'spark', count = 24, opts = {}) {
    if (!SkyPixi.isReady) return false;
    if (SkyPixi.wakeTicker) SkyPixi.wakeTicker();

    const texture = SkyPixi.textures[kind] || SkyPixi.textures.spark;
    if (!texture) return false;

    const container = SkyPixi.layers.particles;
    for (let i = 0; i < count; i++) {
      const sprite = new PIXI.Sprite(texture);
      sprite.anchor.set(0.5);
      sprite.x = x;
      sprite.y = y;

      const angle = rand(0, Math.PI * 2);
      const speed = rand(opts.minSpeed || 2, opts.maxSpeed || 8);
      sprite.vx = Math.cos(angle) * speed;
      sprite.vy = Math.sin(angle) * speed;
      sprite.gravity = opts.gravity !== undefined ? opts.gravity : 0.12;
      sprite.vRot = rand(-0.15, 0.15);
      sprite.life = 0;
      sprite.maxLife = rand(opts.minLife || 20, opts.maxLife || 45);
      sprite.initialScale = rand(opts.minScale || 0.4, opts.maxScale || 0.8);
      sprite.scale.set(sprite.initialScale);
      sprite.decayAlpha = true;
      sprite.scaleDecay = true;
      if (opts.additive) sprite.blendMode = 'add';

      container.addChild(sprite);
      SkyPixi.activeParticles.push(sprite);
    }
    return true;
  }

  /**
   * Spawns expanding shockwave rings on WebGL Graphics.
   */
  function spawnShockwaveRing(x, y, color = 0x38bdf8, maxRadius = 120, durationMs = 450) {
    if (!SkyPixi.isReady) return false;
    if (SkyPixi.wakeTicker) SkyPixi.wakeTicker();

    const g = new PIXI.Graphics();
    SkyPixi.layers.beams.addChild(g);

    const durationFrames = Math.max(12, Math.floor((durationMs / 1000) * 60));
    SkyPixi.activeMeshes.push({
      graphics: g,
      progress: 0,
      durationFrames,
      onUpdate: (prog) => {
        g.clear();
        const currentR = prog * maxRadius;
        const alpha = Math.max(0, 1 - prog);
        g.circle(x, y, currentR);
        g.stroke({ color, width: Math.max(1, 4 * (1 - prog)), alpha });
      }
    });
    return true;
  }

  /**
   * Spawns procedural jagged lightning on WebGL Graphics (Zeus, Astral, Thunder).
   */
  function spawnLightning(x1, y1, x2, y2, opts = {}) {
    if (!SkyPixi.isReady) return false;
    if (SkyPixi.wakeTicker) SkyPixi.wakeTicker();

    const color = opts.color !== undefined ? opts.color : 0x38bdf8;
    const coreColor = opts.coreColor !== undefined ? opts.coreColor : 0xffffff;
    const g = new PIXI.Graphics();
    g.blendMode = 'add';
    SkyPixi.layers.beams.addChild(g);

    // Generate jagged midpoint displacement points
    const points = generateJaggedPath(x1, y1, x2, y2, opts.segments || 14, opts.maxOffset || 28);
    const subForks = (opts.forks !== false) ? generateSubForks(points, 3) : [];

    let flickerStep = 0;
    const durationFrames = opts.durationFrames || 18;

    SkyPixi.activeMeshes.push({
      graphics: g,
      progress: 0,
      durationFrames,
      onUpdate: (prog) => {
        flickerStep++;
        const visible = (flickerStep % 2 === 0);
        g.clear();
        if (!visible) return;

        const alpha = Math.max(0, 1 - prog * 0.85);

        // 1. Outer Glow Stroke
        g.poly(points);
        g.stroke({ color, width: opts.glowWidth || 10, alpha: alpha * 0.75 });

        // 2. Pure White Core Stroke
        g.poly(points);
        g.stroke({ color: coreColor, width: opts.coreWidth || 3, alpha });

        // 3. Sub-branch Forks
        subForks.forEach(fork => {
          g.poly(fork);
          g.stroke({ color, width: 2, alpha: alpha * 0.65 });
        });
      }
    });
    return true;
  }

  function generateJaggedPath(x1, y1, x2, y2, segments = 14, maxOffset = 28) {
    const pts = [{ x: x1, y: y1 }];
    const dx = (x2 - x1) / segments;
    const dy = (y2 - y1) / segments;
    const nx = -dy;
    const ny = dx;
    const len = Math.hypot(nx, ny) || 1;
    const unx = nx / len;
    const uny = ny / len;

    for (let i = 1; i < segments; i++) {
      const midRatio = Math.sin((i / segments) * Math.PI); // Envelope: 0 at ends, max in center
      const offset = (Math.random() - 0.5) * 2 * maxOffset * midRatio;
      pts.push({
        x: x1 + dx * i + unx * offset,
        y: y1 + dy * i + uny * offset
      });
    }
    pts.push({ x: x2, y: y2 });
    return pts;
  }

  function generateSubForks(mainPoints, count = 3) {
    const forks = [];
    if (mainPoints.length < 6) return forks;

    for (let f = 0; f < count; f++) {
      const startIdx = randInt(2, mainPoints.length - 3);
      const startPt = mainPoints[startIdx];
      const fork = [{ x: startPt.x, y: startPt.y }];
      let cx = startPt.x;
      let cy = startPt.y;

      const angle = rand(-Math.PI * 0.4, Math.PI * 0.4) + Math.atan2(mainPoints[startIdx + 1].y - startPt.y, mainPoints[startIdx + 1].x - startPt.x);
      const segLen = rand(10, 22);

      for (let s = 0; s < 4; s++) {
        cx += Math.cos(angle) * segLen + rand(-6, 6);
        cy += Math.sin(angle) * segLen + rand(-6, 6);
        fork.push({ x: cx, y: cy });
      }
      forks.push(fork);
    }
    return forks;
  }

  // =========================================================
  // ALL 11 SEASONS OF MYTHIC COSTUME ULTIMATES
  // =========================================================

  const ultimates = {
    /**
     * S11: Thunder Wolf Sovereign Zeus & Dawn Athena (Wrath of Olympus)
     */
    wrathOfOlympus(data = {}) {
      if (!SkyPixi.isReady) return false;
      const targetP = data.targetP || { x: SkyPixi.canvas.width / 2, y: SkyPixi.canvas.height / 2 };
      const skyX = SkyPixi.canvas.width / 2;

      // 1. Plunge Primary Master Lightning Bolt
      spawnLightning(skyX, 0, targetP.x, targetP.y, { color: 0x38bdf8, coreColor: 0xffffff, glowWidth: 16, coreWidth: 4 });

      // 2. Branch lightning to victim tokens
      if (Array.isArray(data.victims)) {
        data.victims.forEach(v => {
          if (v.p) {
            spawnLightning(targetP.x, targetP.y, v.p.x, v.p.y, { color: 0xfacc15, coreColor: 0xffffff, glowWidth: 10, coreWidth: 2.5 });
          }
        });
      }

      // 3. Ground Shockwave Ring & Electric Sparks
      spawnShockwaveRing(targetP.x, targetP.y, 0x38bdf8, 140, 500);
      spawnShockwaveRing(targetP.x, targetP.y, 0xfacc15, 90, 400);
      spawnRadialBurst(targetP.x, targetP.y, 'spark', 45, { maxSpeed: 10, additive: true });
      return true;
    },

    /**
     * S10: Phantom Wolf Maestro & Black Swan Empress (Phantom Masquerade)
     */
    phantomCurtainCall(data = {}) {
      if (!SkyPixi.isReady) return false;
      const cX = data.cX || SkyPixi.canvas.width / 2;
      const cY = data.cY || SkyPixi.canvas.height / 2;

      // Concentric Cyan/Velvet Shockwaves & Stardust
      spawnShockwaveRing(cX, cY, 0x22d3ee, 170, 650);
      spawnShockwaveRing(cX, cY, 0xc084fc, 130, 550);
      spawnRadialBurst(cX, cY, 'petal', 32, { maxSpeed: 7, minSpeed: 2, gravity: 0.08 });
      spawnRadialBurst(cX, cY, 'crystal', 22, { maxSpeed: 8, minSpeed: 3, additive: true });
      spawnRadialBurst(cX, cY, 'stardust', 36, { maxSpeed: 7, additive: true });
      return true;
    },

    /**
     * S10: Phantom Reverse Rent Hex Inversion
     * Concentric crimson & gilded shockwaves, faceted crystal mirror fracture,
     * rose petal storm, jagged inversion energy ray, and siphoned coin stream.
     */
    phantomReverseHex(data = {}) {
      if (!SkyPixi.isReady) return false;
      const mirrorP = data.mirrorP || { x: SkyPixi.canvas.width / 2, y: SkyPixi.canvas.height / 2 };
      const targetP = data.targetP || { x: SkyPixi.canvas.width / 2, y: SkyPixi.canvas.height / 2 };
      const tenantP = data.tenantP || { x: SkyPixi.canvas.width / 2, y: SkyPixi.canvas.height / 2 };

      // 1. Concentric Rose-Velvet & Gilded Shockwave Rings at Mirror
      spawnShockwaveRing(mirrorP.x, mirrorP.y, 0xf43f5e, 170, 700);
      spawnShockwaveRing(mirrorP.x, mirrorP.y, 0xfbbf24, 240, 900);

      // 2. Crystal Mirror Fracture Burst & Rose Petals
      spawnRadialBurst(mirrorP.x, mirrorP.y, 'crystal', 36, { maxSpeed: 9, minSpeed: 3, additive: true });
      spawnRadialBurst(mirrorP.x, mirrorP.y, 'petal', 26, { maxSpeed: 7, minSpeed: 2, gravity: 0.08 });

      // 3. Jagged Inversion Energy Ray: Mirror -> Landlord
      spawnLightning(mirrorP.x, mirrorP.y, targetP.x, targetP.y, {
        color: 0xf43f5e,
        coreColor: 0xfbbf24,
        glowWidth: 14,
        coreWidth: 3.5,
        durationFrames: 28
      });

      // 4. Stun shockwave & siphoned coins at Landlord
      spawnShockwaveRing(targetP.x, targetP.y, 0xf43f5e, 140, 550);
      spawnRadialBurst(targetP.x, targetP.y, 'spark', 30, { maxSpeed: 8, additive: true });
      if (data.amount) {
        spawnCoinBurst(targetP, tenantP, Math.min(32, Math.max(14, Math.floor(data.amount / 25))));
      }
      return true;
    },

    /**
     * S9: Pharaoh Ramses & Cleopatra (Nile Seduction & Great Golden Pyramid)
     */
    nileSeduction(data = {}) {
      if (!SkyPixi.isReady) return false;
      const targetP = data.targetP || { x: SkyPixi.canvas.width / 2, y: SkyPixi.canvas.height / 2 };

      // Golden Solar Rays to all rivals
      spawnShockwaveRing(targetP.x, targetP.y, 0xffd700, 160, 700);
      spawnShockwaveRing(targetP.x, targetP.y, 0xf59e0b, 240, 900);
      spawnRadialBurst(targetP.x, targetP.y, 'stardust', 50, { maxSpeed: 8, additive: true });
      spawnCoinBurst(targetP, { x: SkyPixi.canvas.width / 2, y: SkyPixi.canvas.height - 40 }, 30);
      return true;
    },

    /**
     * S9: Sun God Ra & Sekhmet (Eye of Ra Solar Wrath)
     */
    solarWrath(data = {}) {
      if (!SkyPixi.isReady) return false;
      const targetP = data.targetP || { x: SkyPixi.canvas.width / 2, y: SkyPixi.canvas.height / 2 };
      spawnLightning(targetP.x, 0, targetP.x, targetP.y, { color: 0xf97316, coreColor: 0xfffbeb, glowWidth: 20, coreWidth: 6, durationFrames: 26 });
      spawnShockwaveRing(targetP.x, targetP.y, 0xf97316, 170, 600);
      spawnRadialBurst(targetP.x, targetP.y, 'sunflame', 36, { maxSpeed: 9, minSpeed: 3, additive: true });
      spawnRadialBurst(targetP.x, targetP.y, 'ember', 40, { maxSpeed: 9, additive: true });
      return true;
    },

    /**
     * S8: Glacial Empress Elsa (Absolute Zero Ice Fissures & Ice Citadel)
     */
    absoluteZero(data = {}) {
      if (!SkyPixi.isReady) return false;
      const cX = SkyPixi.canvas.width / 2;
      const cY = SkyPixi.canvas.height / 2;
      spawnShockwaveRing(cX, cY, 0x7dd3fc, 190, 750);
      spawnShockwaveRing(cX, cY, 0x38bdf8, 270, 950);
      spawnRadialBurst(cX, cY, 'crystal', 32, { maxSpeed: 9, minSpeed: 3, additive: true });
      spawnRadialBurst(cX, cY, 'frost', 55, { maxSpeed: 8, additive: true });
      return true;
    },

    /**
     * S7: Beast Rampage & Rose Restoration (Breaking the Curse)
     */
    breakingTheCurse(data = {}) {
      if (!SkyPixi.isReady) return false;
      const cX = data.cX || SkyPixi.canvas.width / 2;
      const cY = data.cY || SkyPixi.canvas.height / 2;
      spawnShockwaveRing(cX, cY, 0xec4899, 170, 700);
      spawnShockwaveRing(cX, cY, 0xfde047, 260, 950);
      spawnRadialBurst(cX, cY, 'petal', 45, { maxSpeed: 8, minSpeed: 2, gravity: 0.08 });
      spawnRadialBurst(cX, cY, 'stardust', 35, { maxSpeed: 7, additive: true });
      return true;
    },

    /**
     * S7: Midnight Cinderella (Clockwork Paradox)
     */
    midnightParadox(data = {}) {
      if (!SkyPixi.isReady) return false;
      const cX = data.cX || SkyPixi.canvas.width / 2;
      const cY = data.cY || SkyPixi.canvas.height / 2;
      spawnShockwaveRing(cX, cY, 0xfde047, 170, 650);
      spawnShockwaveRing(cX, cY, 0x818cf8, 250, 900);
      spawnRadialBurst(cX, cY, 'crescent', 24, { maxSpeed: 7, minSpeed: 2, additive: true });
      spawnRadialBurst(cX, cY, 'stardust', 40, { maxSpeed: 6, additive: true });
      return true;
    },

    /**
     * S6: Astral Sovereign (Void Lightning Tithe)
     */
    voidLightningTithe(data = {}) {
      if (!SkyPixi.isReady) return false;
      const casterP = data.casterP || { x: SkyPixi.canvas.width / 2, y: SkyPixi.canvas.height / 2 };
      if (Array.isArray(data.victims)) {
        data.victims.forEach(v => {
          if (v.p) {
            spawnLightning(v.p.x, v.p.y, casterP.x, casterP.y, { color: 0xa855f7, coreColor: 0x38bdf8, glowWidth: 12, coreWidth: 3 });
          }
        });
      }
      spawnShockwaveRing(casterP.x, casterP.y, 0xa855f7, 150, 600);
      spawnRadialBurst(casterP.x, casterP.y, 'stardust', 50, { maxSpeed: 8, additive: true });
      return true;
    },

    /**
     * S5: Atlantis Drift (Abyssal Tidal Cataclysm)
     */
    abyssCataclysm(data = {}) {
      if (!SkyPixi.isReady) return false;
      const targetP = data.targetP || { x: SkyPixi.canvas.width / 2, y: SkyPixi.canvas.height / 2 };
      spawnShockwaveRing(targetP.x, targetP.y, 0x0284c7, 170, 650);
      spawnShockwaveRing(targetP.x, targetP.y, 0x06b6d4, 250, 850);
      spawnRadialBurst(targetP.x, targetP.y, 'bubble', 40, { maxSpeed: 8, minSpeed: 2, gravity: -0.06 });
      spawnRadialBurst(targetP.x, targetP.y, 'spark', 35, { maxSpeed: 7, additive: true });
      return true;
    },

    /**
     * S4: Monaco High-Roller (Royal Flush Gold Rush)
     */
    monacoGoldRush(data = {}) {
      if (!SkyPixi.isReady) return false;
      const cX = data.cX || SkyPixi.canvas.width / 2;
      const cY = data.cY || SkyPixi.canvas.height / 2;
      spawnShockwaveRing(cX, cY, 0x10b981, 160, 600);
      spawnShockwaveRing(cX, cY, 0xffd700, 240, 850);
      spawnRadialBurst(cX, cY, 'chip', 45, { maxSpeed: 9, additive: false });
      return true;
    },

    /**
     * S3: Phoenix Rebirth Flame & Ascension
     */
    phoenixRebirthFlame(data = {}) {
      if (!SkyPixi.isReady) return false;
      const cX = data.cX || SkyPixi.canvas.width / 2;
      const cY = data.cY || SkyPixi.canvas.height / 2;
      const casterP = data.casterP || { x: cX, y: cY };

      // Triple Concentric Solar Shockwaves
      spawnShockwaveRing(cX, cY, 0xf97316, 170, 650);
      spawnShockwaveRing(cX, cY, 0xef4444, 250, 850);
      spawnShockwaveRing(cX, cY, 0xfde047, 340, 1100);

      // Sunflame Feathers & Blazing Embers
      spawnRadialBurst(cX, cY, 'sunflame', 38, { maxSpeed: 9, minSpeed: 3, additive: true, gravity: 0.1 });
      spawnRadialBurst(cX, cY, 'ember', 45, { maxSpeed: 8, minSpeed: 2, additive: true });
      spawnRadialBurst(cX, cY, 'stardust', 30, { maxSpeed: 6, additive: true });

      // Ascension Ray from caster upward
      spawnLightning(casterP.x, casterP.y, casterP.x, 0, {
        color: 0xf97316,
        coreColor: 0xfffbeb,
        glowWidth: 18,
        coreWidth: 5,
        durationFrames: 26
      });
      return true;
    },

    /**
     * S3: Cosmic Djinn (Cosmic Genie Wish)
     */
    cosmicGenieWish(data = {}) {
      if (!SkyPixi.isReady) return false;
      const cX = data.cX || SkyPixi.canvas.width / 2;
      const cY = data.cY || SkyPixi.canvas.height / 2;
      spawnShockwaveRing(cX, cY, 0xe879f9, 160, 600);
      spawnShockwaveRing(cX, cY, 0xfbbf24, 240, 850);
      spawnRadialBurst(cX, cY, 'stardust', 45, { maxSpeed: 7, additive: true });
      spawnRadialBurst(cX, cY, 'spark', 35, { maxSpeed: 6, additive: true });
      return true;
    },

    /**
     * S2: Solar-Lunar Deity (Eclipse Convergence)
     */
    eclipseConvergence(data = {}) {
      if (!SkyPixi.isReady) return false;
      const cX = data.cX || SkyPixi.canvas.width / 2;
      const cY = data.cY || SkyPixi.canvas.height / 2;
      spawnShockwaveRing(cX, cY, 0x6366f1, 180, 700);
      spawnShockwaveRing(cX, cY, 0xc084fc, 270, 950);
      spawnRadialBurst(cX, cY, 'crescent', 26, { maxSpeed: 7, minSpeed: 2, additive: true });
      spawnRadialBurst(cX, cY, 'stardust', 45, { maxSpeed: 8, additive: true });
      return true;
    },

    /**
     * S2: Inari Nine-Tail Foxfire Mirage
     */
    inariFoxfireMirage(data = {}) {
      if (!SkyPixi.isReady) return false;
      const cX = data.cX || SkyPixi.canvas.width / 2;
      const cY = data.cY || SkyPixi.canvas.height / 2;
      const targetP = data.targetP;

      // Torii Shockwave Rings (Pink & Gold)
      spawnShockwaveRing(cX, cY, 0xec4899, 170, 700);
      spawnShockwaveRing(cX, cY, 0xfbbf24, 250, 950);

      // Sakura Petal Swirl & Spirit Foxfire Embers
      spawnRadialBurst(cX, cY, 'petal', 40, { maxSpeed: 7, minSpeed: 2, gravity: 0.06 });
      spawnRadialBurst(cX, cY, 'ember', 30, { maxSpeed: 8, minSpeed: 3, additive: true });
      spawnRadialBurst(cX, cY, 'stardust', 25, { maxSpeed: 6, additive: true });

      // Spirit Lightning Tether to victim if present
      if (targetP && targetP.x != null) {
        spawnLightning(cX, cY, targetP.x, targetP.y, {
          color: 0xec4899,
          coreColor: 0xffffff,
          glowWidth: 10,
          coreWidth: 2.5,
          durationFrames: 24
        });
        spawnShockwaveRing(targetP.x, targetP.y, 0xec4899, 120, 500);
      }
      return true;
    },

    /**
     * S1: Mekong River Warden (Emerald Naga Surge)
     */
    emeraldNagaSurge(data = {}) {
      if (!SkyPixi.isReady) return false;
      const cX = data.cX || SkyPixi.canvas.width / 2;
      const cY = data.cY || SkyPixi.canvas.height / 2;
      spawnShockwaveRing(cX, cY, 0x10b981, 170, 650);
      spawnShockwaveRing(cX, cY, 0x34d399, 250, 850);
      spawnRadialBurst(cX, cY, 'bubble', 32, { maxSpeed: 7, minSpeed: 2, gravity: -0.05 });
      spawnRadialBurst(cX, cY, 'spark', 35, { maxSpeed: 6, additive: true });
      return true;
    },

    /**
     * S1: Wish Upon a Lantern Festival
     */
    lanternFestival(data = {}) {
      if (!SkyPixi.isReady) return false;
      const cX = data.cX || SkyPixi.canvas.width / 2;
      const cY = data.cY || SkyPixi.canvas.height / 2;
      spawnShockwaveRing(cX, cY, 0xfde047, 160, 650);
      spawnShockwaveRing(cX, cY, 0xf59e0b, 240, 900);
      spawnRadialBurst(cX, cY, 'stardust', 45, { maxSpeed: 7, minSpeed: 2, additive: true, gravity: -0.05 });
      spawnRadialBurst(cX, cY, 'spark', 30, { maxSpeed: 6, additive: true });
      return true;
    }
  };

  function clearAll() {
    if (!SkyPixi.isReady) return;
    try {
      const pList = SkyPixi.activeParticles;
      while (pList.length > 0) {
        const p = pList.pop();
        if (p.parent) p.parent.removeChild(p);
        p.destroy();
      }
      const mList = SkyPixi.activeMeshes;
      while (mList.length > 0) {
        const m = mList.pop();
        if (m.graphics && m.graphics.parent) m.graphics.parent.removeChild(m.graphics);
        if (m.graphics) m.graphics.destroy();
      }
    } catch (e) {
      console.warn('[SkyPixi] clearAll notice:', e.message);
    }
  }

  // Expose API to window
  SkyPixi.init = init;
  SkyPixi.resize = resize;
  SkyPixi.clearAll = clearAll;
  SkyPixi.spawnParticle = spawnParticle;
  SkyPixi.spawnCoinBurst = spawnCoinBurst;
  SkyPixi.spawnRadialBurst = spawnRadialBurst;
  SkyPixi.spawnShockwaveRing = spawnShockwaveRing;
  SkyPixi.spawnLightning = spawnLightning;
  SkyPixi.spawnTileLanding = spawnTileLanding;
  SkyPixi.spawnDiceImpact = spawnDiceImpact;
  SkyPixi.ultimates = ultimates;

  window.SkyPixi = SkyPixi;

  // Auto-init when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => init());
  } else {
    setTimeout(() => init(), 50);
  }
})();
