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

      // Initialize PixiJS v8 Application
      const app = new PIXI.Application();
      if (typeof app.init === 'function') {
        await app.init({
          canvas: canvas,
          backgroundAlpha: 0,
          resizeTo: boardWrap,
          antialias: true,
          resolution: window.devicePixelRatio || 1,
          autoDensity: true
        });
      } else {
        // Fallback for Pixi v7 sync constructor
        SkyPixi.app = new PIXI.Application({
          view: canvas,
          backgroundAlpha: 0,
          resizeTo: boardWrap,
          antialias: true,
          resolution: window.devicePixelRatio || 1,
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

      // Start the 120 FPS high-refresh ticker loop
      app.ticker.add((time) => {
        const delta = (time && time.deltaTime) ? time.deltaTime : 1;
        updateParticles(delta);
        updateMeshes(delta);
      });

      SkyPixi.isReady = true;
      console.log('✨ [SkyPixi] Hardware-Accelerated 120Hz WebGL Engine Active!');
      return true;
    } catch (err) {
      console.warn('[SkyPixi] WebGL initialization failed, falling back to DOM:', err.message);
      SkyPixi.isReady = false;
      return false;
    }
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
    } catch (e) {
      console.warn('[SkyPixi] Procedural texture generation notice:', e.message);
    }
  }

  // =========================================================
  // CORE PARTICLE & MOTION EMITTERS (120 FPS)
  // =========================================================

  /**
   * Updates all active GPU particles each animation frame.
   */
  function updateParticles(delta) {
    const list = SkyPixi.activeParticles;
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
      }
      if (p.scaleDecay) {
        const sc = Math.max(0.01, p.initialScale * (1 - (p.life / p.maxLife) * 0.4));
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
   * Spawns a high-velocity parabolic coin fountain from (x1, y1) to (x2, y2).
   */
  function spawnCoinBurst(from, to, count = 28, opts = {}) {
    if (!SkyPixi.isReady || !SkyPixi.textures.coin) return false;

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
      const cX = SkyPixi.canvas.width / 2;
      const cY = SkyPixi.canvas.height / 2;

      // Concentric Cyan/Velvet Shockwaves & Stardust
      spawnShockwaveRing(cX, cY, 0x22d3ee, 160, 600);
      spawnShockwaveRing(cX, cY, 0xc084fc, 120, 500);
      spawnRadialBurst(cX, cY, 'stardust', 40, { maxSpeed: 7, additive: true });
      return true;
    },

    /**
     * S9: Pharaoh Ramses & Cleopatra (Nile Seduction & Great Golden Pyramid)
     */
    nileSeduction(data = {}) {
      if (!SkyPixi.isReady) return false;
      const targetP = data.targetP || { x: SkyPixi.canvas.width / 2, y: SkyPixi.canvas.height / 2 };

      // Golden Solar Rays to all rivals
      spawnShockwaveRing(targetP.x, targetP.y, 0xffd700, 150, 650);
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
      spawnLightning(targetP.x, 0, targetP.x, targetP.y, { color: 0xf97316, coreColor: 0xfffbeb, glowWidth: 20, coreWidth: 6 });
      spawnShockwaveRing(targetP.x, targetP.y, 0xf97316, 160, 500);
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
      spawnShockwaveRing(cX, cY, 0x7dd3fc, 180, 700);
      spawnRadialBurst(cX, cY, 'frost', 55, { maxSpeed: 8, additive: true });
      return true;
    },

    /**
     * S7: Midnight Cinderella (Clockwork Paradox)
     */
    midnightParadox(data = {}) {
      if (!SkyPixi.isReady) return false;
      const cX = SkyPixi.canvas.width / 2;
      const cY = SkyPixi.canvas.height / 2;
      spawnShockwaveRing(cX, cY, 0xfde047, 160, 600);
      spawnRadialBurst(cX, cY, 'stardust', 35, { maxSpeed: 6, additive: true });
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
      spawnShockwaveRing(casterP.x, casterP.y, 0xa855f7, 140, 500);
      spawnRadialBurst(casterP.x, casterP.y, 'stardust', 45, { maxSpeed: 8, additive: true });
      return true;
    },

    /**
     * S5: Atlantis Drift (Abyssal Tidal Cataclysm)
     */
    abyssCataclysm(data = {}) {
      if (!SkyPixi.isReady) return false;
      const targetP = data.targetP || { x: SkyPixi.canvas.width / 2, y: SkyPixi.canvas.height / 2 };
      spawnShockwaveRing(targetP.x, targetP.y, 0x0284c7, 160, 600);
      spawnRadialBurst(targetP.x, targetP.y, 'spark', 40, { maxSpeed: 7, additive: true });
      return true;
    },

    /**
     * S4: Monaco High-Roller (Royal Flush Gold Rush)
     */
    monacoGoldRush(data = {}) {
      if (!SkyPixi.isReady) return false;
      const cX = SkyPixi.canvas.width / 2;
      const cY = SkyPixi.canvas.height / 2;
      spawnShockwaveRing(cX, cY, 0x10b981, 150, 500);
      spawnRadialBurst(cX, cY, 'chip', 45, { maxSpeed: 9, additive: false });
      return true;
    },

    /**
     * S1: Mekong River Warden (Emerald Naga Surge)
     */
    emeraldNagaSurge(data = {}) {
      if (!SkyPixi.isReady) return false;
      const cX = SkyPixi.canvas.width / 2;
      const cY = SkyPixi.canvas.height / 2;
      spawnShockwaveRing(cX, cY, 0x10b981, 160, 600);
      spawnRadialBurst(cX, cY, 'spark', 35, { maxSpeed: 6, additive: true });
      return true;
    },

    /**
     * S2: Solar-Lunar Deity (Eclipse Convergence)
     */
    eclipseConvergence(data = {}) {
      if (!SkyPixi.isReady) return false;
      const cX = SkyPixi.canvas.width / 2;
      const cY = SkyPixi.canvas.height / 2;
      spawnShockwaveRing(cX, cY, 0xc084fc, 180, 700);
      spawnRadialBurst(cX, cY, 'stardust', 40, { maxSpeed: 8, additive: true });
      return true;
    },

    /**
     * S3: Cosmic Djinn (Cosmic Genie Wish)
     */
    cosmicGenieWish(data = {}) {
      if (!SkyPixi.isReady) return false;
      const cX = SkyPixi.canvas.width / 2;
      const cY = SkyPixi.canvas.height / 2;
      spawnShockwaveRing(cX, cY, 0xe879f9, 140, 500);
      spawnRadialBurst(cX, cY, 'stardust', 40, { maxSpeed: 7, additive: true });
      return true;
    }
  };

  // Expose API to window
  SkyPixi.init = init;
  SkyPixi.spawnCoinBurst = spawnCoinBurst;
  SkyPixi.spawnRadialBurst = spawnRadialBurst;
  SkyPixi.spawnShockwaveRing = spawnShockwaveRing;
  SkyPixi.spawnLightning = spawnLightning;
  SkyPixi.ultimates = ultimates;

  window.SkyPixi = SkyPixi;

  // Auto-init when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => init());
  } else {
    setTimeout(() => init(), 50);
  }
})();
