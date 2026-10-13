/**
 * Phase 4 PixiJS Visual & Particle Engine Integrity Test Suite
 *
 * Verifies:
 * 1. public/pixi_engine.js loads cleanly and attaches window.SkyPixi.
 * 2. SkyPixi exposes all core particle and motion primitives (coins, bursts, rings, lightning).
 * 3. SkyPixi.ultimates contains complete routines for all 11 Seasons of Mythic costumes.
 * 4. Safe fallback protocol functions when WebGL is unavailable.
 * 5. monopoly_fx.js integrates with SkyPixi without runtime errors.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('============================================================');
console.log('🧪 PHASE 4: PIXIJS VISUAL & PARTICLE ENGINE INTEGRITY SUITE');
console.log('============================================================\n');

let passed = 0;
let failed = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`  ✅ [PASS] ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${desc}`);
    console.error(err);
    failed++;
  }
}

// -------------------------------------------------------------
// Test 4.1: Script Syntax & Export Surface
// -------------------------------------------------------------
it('4.1 pixi_engine.js parses cleanly and attaches window.SkyPixi', () => {
  const code = fs.readFileSync(path.join(__dirname, '../public/pixi_engine.js'), 'utf8');
  assert.ok(code.length > 500, 'pixi_engine.js should have substantive code');

  const sandbox = {
    window: {},
    document: {
      readyState: 'complete',
      getElementById: () => null,
      querySelector: () => null,
      createElement: () => ({ style: {}, appendChild: () => {} }),
      addEventListener: () => {}
    },
    console: { log: () => {}, warn: () => {}, error: () => {} },
    setTimeout: () => {}
  };
  sandbox.window = sandbox;

  vm.runInNewContext(code, sandbox);
  assert.ok(sandbox.window.SkyPixi, 'window.SkyPixi should be exported');
});

// -------------------------------------------------------------
// Test 4.2: Core Particle & Motion Emitters
// -------------------------------------------------------------
it('4.2 SkyPixi exposes all hardware-accelerated particle primitives', () => {
  const code = fs.readFileSync(path.join(__dirname, '../public/pixi_engine.js'), 'utf8');
  const sandbox = {
    window: {},
    document: { readyState: 'complete', getElementById: () => null, querySelector: () => null, createElement: () => ({ style: {} }), addEventListener: () => {} },
    console: { log: () => {}, warn: () => {}, error: () => {} },
    setTimeout: () => {}
  };
  sandbox.window = sandbox;
  vm.runInNewContext(code, sandbox);

  const sp = sandbox.window.SkyPixi;
  assert.strictEqual(typeof sp.init, 'function', 'sp.init must be function');
  assert.strictEqual(typeof sp.spawnCoinBurst, 'function', 'sp.spawnCoinBurst must be function');
  assert.strictEqual(typeof sp.spawnRadialBurst, 'function', 'sp.spawnRadialBurst must be function');
  assert.strictEqual(typeof sp.spawnShockwaveRing, 'function', 'sp.spawnShockwaveRing must be function');
  assert.strictEqual(typeof sp.spawnLightning, 'function', 'sp.spawnLightning must be function');
  assert.ok(sp.ultimates, 'sp.ultimates object must exist');
});

// -------------------------------------------------------------
// Test 4.3: All 11 Seasons of Mythic Costume Ultimates
// -------------------------------------------------------------
it('4.3 SkyPixi.ultimates contains dedicated visual routines for all 11 Seasons', () => {
  const code = fs.readFileSync(path.join(__dirname, '../public/pixi_engine.js'), 'utf8');
  const sandbox = {
    window: {},
    document: { readyState: 'complete', getElementById: () => null, querySelector: () => null, createElement: () => ({ style: {} }), addEventListener: () => {} },
    console: { log: () => {}, warn: () => {}, error: () => {} },
    setTimeout: () => {}
  };
  sandbox.window = sandbox;
  vm.runInNewContext(code, sandbox);

  const u = sandbox.window.SkyPixi.ultimates;
  const expectedUltimates = [
    'wrathOfOlympus',      // S11 Zeus & Athena
    'phantomCurtainCall',  // S10 Phantom & Black Swan
    'nileSeduction',       // S9 Ramses & Cleopatra
    'solarWrath',          // S9 Ra & Sekhmet
    'absoluteZero',        // S8 Elsa
    'midnightParadox',     // S7 Cinderella
    'voidLightningTithe',  // S6 Astral Sovereign
    'abyssCataclysm',      // S5 Atlantis Drift
    'monacoGoldRush',      // S4 Monaco High-Roller
    'emeraldNagaSurge',    // S1 Mekong Naga
    'eclipseConvergence',  // S2 Solar-Lunar Deity
    'cosmicGenieWish'      // S3 Cosmic Djinn
  ];

  expectedUltimates.forEach(name => {
    assert.strictEqual(typeof u[name], 'function', `SkyPixi.ultimates.${name} must be a function`);
  });
});

// -------------------------------------------------------------
// Test 4.4: Safe Fallback Protocol
// -------------------------------------------------------------
it('4.4 SkyPixi safely returns false and avoids throwing when WebGL is inactive', () => {
  const code = fs.readFileSync(path.join(__dirname, '../public/pixi_engine.js'), 'utf8');
  const sandbox = {
    window: {},
    document: { readyState: 'complete', getElementById: () => null, querySelector: () => null, createElement: () => ({ style: {} }), addEventListener: () => {} },
    console: { log: () => {}, warn: () => {}, error: () => {} },
    setTimeout: () => {}
  };
  sandbox.window = sandbox;
  vm.runInNewContext(code, sandbox);

  const sp = sandbox.window.SkyPixi;
  assert.strictEqual(sp.isReady, false, 'isReady should be false before WebGL init');

  // Verify calling emitters without WebGL returns false without throwing
  assert.strictEqual(sp.spawnCoinBurst({ x: 0, y: 0 }, { x: 10, y: 10 }), false);
  assert.strictEqual(sp.spawnRadialBurst(50, 50), false);
  assert.strictEqual(sp.spawnShockwaveRing(50, 50), false);
  assert.strictEqual(sp.spawnLightning(0, 0, 100, 100), false);
  assert.strictEqual(sp.ultimates.wrathOfOlympus(), false);
  assert.strictEqual(sp.ultimates.phantomCurtainCall(), false);
});

// -------------------------------------------------------------
// Test 4.5: Script Tag Inclusion in index.html
// -------------------------------------------------------------
it('4.5 index.html properly loads pixi_engine.js after vendor engines', () => {
  const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
  const pixiVendorIdx = html.indexOf('vendor/pixi.min.js');
  const gsapVendorIdx = html.indexOf('vendor/gsap.min.js');
  const pixiEngineIdx = html.indexOf('pixi_engine.js');
  const monopolyFxIdx = html.indexOf('monopoly_fx.js');

  assert.ok(pixiVendorIdx !== -1, 'vendor/pixi.min.js must be present in index.html');
  assert.ok(gsapVendorIdx !== -1, 'vendor/gsap.min.js must be present in index.html');
  assert.ok(pixiEngineIdx !== -1, 'pixi_engine.js must be present in index.html');
  assert.ok(monopolyFxIdx !== -1, 'monopoly_fx.js must be present in index.html');

  assert.ok(pixiEngineIdx > pixiVendorIdx, 'pixi_engine.js must load after vendor/pixi.min.js');
  assert.ok(pixiEngineIdx > gsapVendorIdx, 'pixi_engine.js must load after vendor/gsap.min.js');
  assert.ok(pixiEngineIdx < monopolyFxIdx, 'pixi_engine.js must load before monopoly_fx.js');
});

// -------------------------------------------------------------
// Test 4.6: SkyPixi.spawnParticle primitive & safe fallback
// -------------------------------------------------------------
it('4.6 SkyPixi exposes spawnParticle and handles safe fallback & active spawning', () => {
  const code = fs.readFileSync(path.join(__dirname, '../public/pixi_engine.js'), 'utf8');
  const sandbox = {
    window: {},
    document: { readyState: 'complete', getElementById: () => null, querySelector: () => null, createElement: () => ({ style: {} }), addEventListener: () => {} },
    console: { log: () => {}, warn: () => {}, error: () => {} },
    setTimeout: () => {}
  };
  sandbox.window = sandbox;
  vm.runInNewContext(code, sandbox);

  const sp = sandbox.window.SkyPixi;
  assert.strictEqual(typeof sp.spawnParticle, 'function', 'SkyPixi.spawnParticle must be a function');
  assert.strictEqual(sp.spawnParticle({ textureName: 'bubble', x: 50, y: 50 }), false, 'Returns false without throwing when WebGL is inactive');
});

// -------------------------------------------------------------
// Test 4.7: Environmental Monument Auras & Ticker Loop Resilience
// -------------------------------------------------------------
it('4.7 Environmental Monument Auras (Temple, Waterways, Flooded) run without throwing and culls particles', async () => {
  const pixiCode = fs.readFileSync(path.join(__dirname, '../public/pixi_engine.js'), 'utf8');

  class MockContainer {
    constructor() { this.children = []; }
    addChild(c) { this.children.push(c); return c; }
    removeChild(c) {
      const idx = this.children.indexOf(c);
      if (idx !== -1) this.children.splice(idx, 1);
    }
  }

  class MockGraphics {
    constructor() {
      this.calls = [];
      this.parent = new MockContainer();
    }
    clear() { this.calls.push('clear'); return this; }
    circle(x, y, r) { this.calls.push({ fn: 'circle', x, y, r }); return this; }
    star(x, y, p, r1, r2) { this.calls.push({ fn: 'star', x, y, p, r1, r2 }); return this; }
    poly(pts) { this.calls.push({ fn: 'poly', pts }); return this; }
    fill(cfg) { this.calls.push({ fn: 'fill', cfg }); return this; }
    stroke(cfg) { this.calls.push({ fn: 'stroke', cfg }); return this; }
    destroy() { this.destroyed = true; }
  }

  class MockSprite {
    constructor(tex) {
      this.texture = tex;
      this.x = 0;
      this.y = 0;
      this.vx = 0;
      this.vy = 0;
      this.life = 0;
      this.maxLife = 40;
      this.alpha = 1;
      this.scale = { set(v) { this.v = v; } };
      this.anchor = { set(v) { this.v = v; } };
      this.parent = new MockContainer();
    }
    destroy() { this.destroyed = true; }
  }

  const mockApp = {
    init: async () => {},
    stage: new MockContainer(),
    renderer: {
      generateTexture: () => ({ id: 'mock_tex_' + Math.random() }),
      resize: (w, h) => {}
    },
    ticker: {
      listeners: [],
      add(fn) { this.listeners.push(fn); },
      step(delta = 1) { this.listeners.forEach(fn => fn({ deltaTime: delta })); },
      stop() { this.stopped = true; },
      start() { this.stopped = false; }
    }
  };

  const sandbox = {
    window: {
      monopolyState: {
        olympusTempleTile: 17,
        sacredWaterways: { 3: { creator: 'bkk', bonusRent: 0.3 } },
        floodedTiles: { 11: { floodedBy: 'dxb' } },
        properties: {
          4: { isTransmutedGold: true },
          17: { isOlympusTemple: true }
        }
      }
    },
    document: {
      readyState: 'complete',
      getElementById: (id) => {
        if (id === 'monopolyBoardWrap') return { clientWidth: 380, clientHeight: 532, appendChild: () => {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 380, height: 532 }) };
        if (id === 'skyPixiCanvas') return { width: 380, height: 532, style: {} };
        if (id.startsWith('boardTile_')) {
          return { getBoundingClientRect: () => ({ left: 50, top: 50, width: 40, height: 40 }) };
        }
        return null;
      },
      querySelector: () => null,
      createElement: () => ({ id: 'skyPixiCanvas', width: 380, height: 532, style: {} }),
      addEventListener: () => {}
    },
    PIXI: {
      Application: function() { return mockApp; },
      Container: MockContainer,
      Graphics: MockGraphics,
      Sprite: MockSprite
    },
    console: { log: () => {}, warn: () => {}, error: () => {} },
    setTimeout: (fn) => fn()
  };
  sandbox.window = Object.assign(sandbox.window, sandbox);

  vm.runInNewContext(pixiCode, sandbox);
  const sp = sandbox.window.SkyPixi;
  assert.ok(sp, 'SkyPixi must exist');

  await sp.init();
  assert.strictEqual(sp.isReady, true, 'SkyPixi must be ready after init');

  // Test explicit spawnParticle
  const directSpawn = sp.spawnParticle({ textureName: 'bubble', x: 100, y: 120, color: 0x10b981, maxLife: 30 });
  assert.strictEqual(directSpawn, true, 'Direct spawnParticle should return true');
  assert.ok(sp.activeParticles.length >= 1, 'Active particles must have direct spawn');

  // Step 50 frames to trigger tile auras (interval is 36 frames on mobile or 18 on desktop)
  for (let f = 0; f < 50; f++) {
    mockApp.ticker.step(1);
  }

  // Active particles should have been spawned by updateTileAuras without throwing
  assert.ok(sp.activeParticles.length > 0, 'Particles should be actively generated by Temple, Waterways & Flooding');

  // Test clearAll
  sp.clearAll();
  assert.strictEqual(sp.activeParticles.length, 0, 'clearAll must purge all active particles');
  assert.strictEqual(sp.activeMeshes.length, 0, 'clearAll must purge all active meshes');
});

console.log('\n============================================================');
console.log(`RESULTS: ${passed} passed, ${failed} failed`);
console.log('============================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
