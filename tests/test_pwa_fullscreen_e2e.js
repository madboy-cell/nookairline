/**
 * Sky Party — End-to-End PWA & Fullscreen Detection Verification Suite
 * Tests real user mobile journeys: iOS Safari, Android PWA, Standalone Mode, Snooze, and Passport Integration.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const http = require('http');

console.log('===========================================================================');
console.log('📱 TEST: SKY PARTY PWA & FULLSCREEN DETECTION E2E SUITE');
console.log('===========================================================================\n');

let passedCount = 0;
let totalCount = 0;

function it(title, fn) {
  totalCount++;
  try {
    fn();
    console.log(`  ✅ [PASS] ${title}`);
    passedCount++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${title}: ${err.message}`);
    process.exitCode = 1;
  }
}

async function itAsync(title, fn) {
  totalCount++;
  try {
    await fn();
    console.log(`  ✅ [PASS] ${title}`);
    passedCount++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${title}: ${err.message}`);
    process.exitCode = 1;
  }
}

// -------------------------------------------------------------
// Suite 1: Markup, Assets & Manifest Integrity
// -------------------------------------------------------------
console.log('--- SUITE 1: Markup, Assets & PWA Manifest Integrity ---');

const indexHtml = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
const manifestRaw = fs.readFileSync(path.join(__dirname, '../public/manifest.json'), 'utf8');
const swRaw = fs.readFileSync(path.join(__dirname, '../public/sw.js'), 'utf8');
const cssRaw = fs.readFileSync(path.join(__dirname, '../public/pwa_prompt.css'), 'utf8');
const jsRaw = fs.readFileSync(path.join(__dirname, '../public/pwa_prompt.js'), 'utf8');

it('1.1 manifest.json is valid and configured for standalone PWA', () => {
  const manifest = JSON.parse(manifestRaw);
  assert.strictEqual(manifest.display, 'standalone', 'display must be standalone');
  assert.strictEqual(manifest.start_url, './', 'start_url must be ./');
  assert.ok(manifest.name.includes('Sky Party'), 'name must contain Sky Party');
  assert.ok(manifest.icons && manifest.icons.length >= 2, 'must contain at least 2 icons');
  
  // Verify icon files exist
  manifest.icons.forEach(icon => {
    const iconPath = path.join(__dirname, '../public', icon.src);
    assert.ok(fs.existsSync(iconPath), `Icon file ${icon.src} must exist`);
  });
});

it('1.2 sw.js contains install, activate, and network-first fetch handlers', () => {
  assert.ok(swRaw.includes("addEventListener('install'"), 'sw must handle install');
  assert.ok(swRaw.includes("addEventListener('activate'"), 'sw must handle activate');
  assert.ok(swRaw.includes("addEventListener('fetch'"), 'sw must handle fetch');
  assert.ok(swRaw.includes('clients.claim()'), 'sw must claim clients');
});

it('1.3 index.html contains iOS meta tags and manifest link', () => {
  assert.ok(indexHtml.includes('<meta name="apple-mobile-web-app-capable" content="yes">'), 'apple-mobile-web-app-capable must be yes');
  assert.ok(indexHtml.includes('<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">'), 'apple-mobile status bar must be black-translucent');
  assert.ok(indexHtml.includes('<link rel="manifest" href="manifest.json">'), 'must link manifest.json');
  assert.ok(indexHtml.includes('pwa_prompt.css'), 'must link pwa_prompt.css');
  assert.ok(indexHtml.includes('pwa_prompt.js'), 'must load pwa_prompt.js');
  assert.ok(indexHtml.includes('id="passportPwaInstallBtn"'), 'must have passportPwaInstallBtn in passport sheet');
});

it('1.4 pwa_prompt.css includes glassmorphic luxury styling and animations', () => {
  assert.ok(cssRaw.includes('.sky-pwa-banner'), 'must style .sky-pwa-banner');
  assert.ok(cssRaw.includes('backdrop-filter: blur'), 'must use glassmorphic backdrop-filter');
  assert.ok(cssRaw.includes('pwaArrowBounce'), 'must contain pwaArrowBounce animation');
  assert.ok(cssRaw.includes('.pwa-safari-arrow-indicator'), 'must style safari arrow indicator');
});

// -------------------------------------------------------------
// Suite 2: Real User Scenario — iPhone Safari Mobile User
// -------------------------------------------------------------
console.log('\n--- SUITE 2: Real User — iPhone Safari Passenger Experience ---');

function createMockDom(initialStorage = {}, initialUa = '', isStandalone = false, width = 390) {
  const storage = { ...initialStorage };
  const elements = {};

  const mockLocalStorage = {
    getItem: (k) => (k in storage ? storage[k] : null),
    setItem: (k, v) => { storage[k] = String(v); },
    removeItem: (k) => { delete storage[k]; },
    clear: () => { Object.keys(storage).forEach(k => delete storage[k]); },
    _dump: () => storage
  };

  const mockDoc = {
    readyState: 'complete',
    body: {
      appendChild: (el) => { elements[el.id] = el; }
    },
    createElement: (tag) => {
      const el = {
        tagName: tag.toUpperCase(),
        id: '',
        className: '',
        classList: {
          _classes: new Set(),
          add(c) { this._classes.add(c); el.className = Array.from(this._classes).join(' '); },
          remove(c) { this._classes.delete(c); el.className = Array.from(this._classes).join(' '); },
          contains(c) { return this._classes.has(c); }
        },
        attributes: {},
        setAttribute(k, v) { this.attributes[k] = String(v); },
        getAttribute(k) { return this.attributes[k] || null; },
        innerHTML: '',
        style: {},
        listeners: {},
        addEventListener(evt, fn) {
          if (!this.listeners[evt]) this.listeners[evt] = [];
          this.listeners[evt].push(fn);
        },
        click() {
          if (this.listeners['click']) {
            this.listeners['click'].forEach(fn => fn({ preventDefault: () => {}, stopPropagation: () => {} }));
          }
        }
      };
      return el;
    },
    getElementById: (id) => {
      if (elements[id]) return elements[id];
      // Search nested elements within innerHTML if needed
      for (const parentId of Object.keys(elements)) {
        const parent = elements[parentId];
        if (parent.innerHTML && parent.innerHTML.includes(`id="${id}"`)) {
          if (!elements[id]) {
            const child = mockDoc.createElement('div');
            child.id = id;
            child.innerHTML = '';
            elements[id] = child;
          }
          return elements[id];
        }
      }
      return null;
    },
    addEventListener: () => {}
  };

  const mockWin = {
    navigator: {
      userAgent: initialUa,
      platform: 'iPhone',
      standalone: isStandalone,
      serviceWorker: { register: () => Promise.resolve({ scope: '/' }) }
    },
    location: { protocol: 'https:', href: 'https://neoraworld.com' },
    innerWidth: width,
    localStorage: mockLocalStorage,
    matchMedia: (q) => ({ matches: q.includes('standalone') ? isStandalone : false }),
    addEventListener: (evt, fn) => {
      if (!mockWin._listeners) mockWin._listeners = {};
      if (!mockWin._listeners[evt]) mockWin._listeners[evt] = [];
      mockWin._listeners[evt].push(fn);
    },
    _fire: (evt, data) => {
      if (mockWin._listeners && mockWin._listeners[evt]) {
        mockWin._listeners[evt].forEach(fn => fn(data));
      }
    }
  };

  return { mockWin, mockDoc, mockLocalStorage, elements };
}

it('2.1 iPhone Safari user (not standalone) is detected accurately', () => {
  const IPHONE_SAFARI_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
  const { mockWin, mockDoc, mockLocalStorage } = createMockDom({}, IPHONE_SAFARI_UA, false, 393);

  const evalFn = new Function('window', 'document', 'navigator', 'localStorage', jsRaw + '; return window.SkyPWA;');
  const SkyPWA = evalFn(mockWin, mockDoc, mockWin.navigator, mockLocalStorage);

  assert.strictEqual(SkyPWA.isStandalone(), false, 'Must not be standalone on Safari browser');
  assert.strictEqual(SkyPWA.isMobile(), true, 'Must detect as mobile device');
  assert.strictEqual(SkyPWA.getPlatform(), 'ios-safari', 'Must identify platform as ios-safari');
  assert.strictEqual(SkyPWA.isSnoozed(), false, 'Fresh user must not be snoozed');
});

it('2.2 SkyPWA.show() renders iOS Share icon guide and animated arrow for iPhone user', () => {
  const IPHONE_SAFARI_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
  const { mockWin, mockDoc, mockLocalStorage, elements } = createMockDom({}, IPHONE_SAFARI_UA, false, 393);

  const evalFn = new Function('window', 'document', 'navigator', 'localStorage', jsRaw + '; return window.SkyPWA;');
  const SkyPWA = evalFn(mockWin, mockDoc, mockWin.navigator, mockLocalStorage);

  SkyPWA.show(false);

  const banner = elements['skyPwaInstallPrompt'];
  assert.ok(banner, 'Banner element must be created');
  assert.ok(banner.classList.contains('visible'), 'Banner must have visible class');
  assert.strictEqual(banner.getAttribute('aria-hidden'), 'false', 'aria-hidden must be false');

  const stepsCard = elements['pwaStepsCard'];
  assert.ok(stepsCard, 'pwaStepsCard must be created');
  assert.ok(stepsCard.innerHTML.includes('Share'), 'Must contain Share guidance in steps');
  assert.ok(stepsCard.innerHTML.includes('Add to Home Screen'), 'Must contain Add to Home Screen in steps');

  const safariArrow = elements['pwaSafariArrow'];
  assert.ok(safariArrow, 'Safari bouncing arrow must exist');
  assert.strictEqual(safariArrow.classList.contains('hidden'), false, 'Safari arrow must not be hidden on iOS');
});

// -------------------------------------------------------------
// Suite 3: Dismissal & 7-Day Snooze Persistence
// -------------------------------------------------------------
console.log('\n--- SUITE 3: Passenger Snooze & Politeness Persistence ---');

it('3.1 Tapping "Maybe Later" dismisses the banner and records 7-day snooze', () => {
  const IPHONE_SAFARI_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
  const { mockWin, mockDoc, mockLocalStorage, elements } = createMockDom({}, IPHONE_SAFARI_UA, false, 393);

  const evalFn = new Function('window', 'document', 'navigator', 'localStorage', jsRaw + '; return window.SkyPWA;');
  const SkyPWA = evalFn(mockWin, mockDoc, mockWin.navigator, mockLocalStorage);

  SkyPWA.show(false);
  const banner = elements['skyPwaInstallPrompt'];
  assert.ok(banner.classList.contains('visible'), 'Banner initially visible');

  // Passenger taps "Maybe Later 🍃"
  const secBtn = elements['pwaActionSecondaryBtn'];
  secBtn.click();

  assert.strictEqual(banner.classList.contains('visible'), false, 'Banner visible class must be removed');
  assert.strictEqual(banner.getAttribute('aria-hidden'), 'true', 'aria-hidden must be true');

  const dismissedAt = mockLocalStorage.getItem('sky_pwa_prompt_dismissed_at');
  assert.ok(dismissedAt, 'Snooze timestamp must be saved in localStorage');
  assert.strictEqual(SkyPWA.isSnoozed(), true, 'SkyPWA.isSnoozed() must return true');

  // Next reload check: prompt must NOT show
  banner.classList.remove('visible');
  SkyPWA.show(false);
  assert.strictEqual(banner.classList.contains('visible'), false, 'Prompt must remain suppressed while snoozed');
});

it('3.2 Snooze expires after 7 days and allows prompt to reappear', () => {
  const eightDaysAgo = Date.now() - (8 * 24 * 60 * 60 * 1000);
  const { mockWin, mockDoc, mockLocalStorage, elements } = createMockDom(
    { 'sky_pwa_prompt_dismissed_at': String(eightDaysAgo) },
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    false,
    393
  );

  const evalFn = new Function('window', 'document', 'navigator', 'localStorage', jsRaw + '; return window.SkyPWA;');
  const SkyPWA = evalFn(mockWin, mockDoc, mockWin.navigator, mockLocalStorage);

  assert.strictEqual(SkyPWA.isSnoozed(), false, 'Expired snooze must return false');
  SkyPWA.show(false);
  const banner = elements['skyPwaInstallPrompt'];
  assert.ok(banner && banner.classList.contains('visible'), 'Banner must be visible again after snooze expires');
});

// -------------------------------------------------------------
// Suite 4: Standalone / Fullscreen PWA Experience
// -------------------------------------------------------------
console.log('\n--- SUITE 4: Real User — Installed Standalone PWA Suppression ---');

it('4.1 When passenger launches from Home Screen, prompt is completely suppressed', () => {
  const IPHONE_SAFARI_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
  // navigator.standalone = true indicates opened as Home Screen app!
  const { mockWin, mockDoc, mockLocalStorage, elements } = createMockDom({}, IPHONE_SAFARI_UA, true, 393);

  const evalFn = new Function('window', 'document', 'navigator', 'localStorage', jsRaw + '; return window.SkyPWA;');
  const SkyPWA = evalFn(mockWin, mockDoc, mockWin.navigator, mockLocalStorage);

  assert.strictEqual(SkyPWA.isStandalone(), true, 'Must identify as standalone mode');
  SkyPWA.show(false);

  const banner = elements['skyPwaInstallPrompt'];
  assert.ok(!banner || !banner.classList.contains('visible'), 'Prompt must NEVER be shown to installed PWA passengers');
});

// -------------------------------------------------------------
// Suite 5: Real User — Android / Chromium 1-Tap Install
// -------------------------------------------------------------
console.log('\n--- SUITE 5: Real User — Android / Chromium 1-Tap Install Flow ---');

it('5.1 Android Chrome user captures beforeinstallprompt and enables 1-tap installation', async () => {
  const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36';
  const { mockWin, mockDoc, mockLocalStorage, elements } = createMockDom({}, ANDROID_UA, false, 412);

  const evalFn = new Function('window', 'document', 'navigator', 'localStorage', jsRaw + '; return window.SkyPWA;');
  const SkyPWA = evalFn(mockWin, mockDoc, mockWin.navigator, mockLocalStorage);

  assert.strictEqual(SkyPWA.getPlatform(), 'android', 'Platform must be android');

  // Simulate Chromium firing beforeinstallprompt
  let promptCalled = false;
  const mockBeforeInstallPromptEvent = {
    preventDefault: () => {},
    prompt: () => { promptCalled = true; },
    userChoice: Promise.resolve({ outcome: 'accepted' })
  };

  mockWin._fire('beforeinstallprompt', mockBeforeInstallPromptEvent);

  SkyPWA.show(false);
  const priBtn = elements['pwaActionPrimaryBtn'];
  assert.ok(priBtn, 'Primary action button must exist');
  assert.ok(priBtn.innerHTML.includes('Install Sky Party'), 'Primary button must say Install Sky Party for Android');

  // User taps 1-tap install
  await SkyPWA.installApp();
  assert.strictEqual(promptCalled, true, 'deferredPrompt.prompt() must be called');
  assert.strictEqual(mockLocalStorage.getItem('sky_pwa_prompt_dismissed_at') !== null, true, 'Should snooze on install');
});

// -------------------------------------------------------------
// Suite 6: Passenger Passport / Settings Manual Re-open
// -------------------------------------------------------------
console.log('\n--- SUITE 6: Passenger Passport & Settings Manual Access ---');

it('6.1 Passenger can open Fullscreen Guide from Passport even if previously snoozed', () => {
  const IPHONE_SAFARI_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
  const { mockWin, mockDoc, mockLocalStorage, elements } = createMockDom(
    { 'sky_pwa_prompt_dismissed_at': String(Date.now()) },
    IPHONE_SAFARI_UA,
    false,
    393
  );

  const evalFn = new Function('window', 'document', 'navigator', 'localStorage', jsRaw + '; return window.SkyPWA;');
  const SkyPWA = evalFn(mockWin, mockDoc, mockWin.navigator, mockLocalStorage);

  assert.strictEqual(SkyPWA.isSnoozed(), true, 'Passenger is snoozed');

  // Calling show(true) forces display
  SkyPWA.show(true);
  const banner = elements['skyPwaInstallPrompt'];
  assert.ok(banner.classList.contains('visible'), 'Force show must open banner regardless of snooze');
});

// -------------------------------------------------------------
// Suite 7: Local Server HTTP Asset Delivery
// -------------------------------------------------------------
console.log('\n--- SUITE 7: HTTP Asset Delivery Verification ---');

async function testHttpDelivery() {
  const express = require('express');
  const app = express();
  app.use(express.static(path.join(__dirname, '../public')));

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;

  function fetchUrl(pathname) {
    return new Promise((resolve, reject) => {
      http.get(`http://localhost:${port}${pathname}`, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
      }).on('error', reject);
    });
  }

  try {
    const manifestRes = await fetchUrl('/manifest.json');
    assert.strictEqual(manifestRes.status, 200, 'manifest.json must return 200');
    assert.ok(manifestRes.body.includes('Sky Party'), 'manifest body contains Sky Party');

    const swRes = await fetchUrl('/sw.js');
    assert.strictEqual(swRes.status, 200, 'sw.js must return 200');
    assert.ok(swRes.body.includes('addEventListener'), 'sw body contains addEventListener');

    const pwaJsRes = await fetchUrl('/pwa_prompt.js');
    assert.strictEqual(pwaJsRes.status, 200, 'pwa_prompt.js must return 200');
    assert.ok(pwaJsRes.body.includes('SkyPWA'), 'pwa_prompt.js body contains SkyPWA');

    const pwaCssRes = await fetchUrl('/pwa_prompt.css');
    assert.strictEqual(pwaCssRes.status, 200, 'pwa_prompt.css must return 200');
    assert.ok(pwaCssRes.body.includes('sky-pwa-banner'), 'pwa_prompt.css contains sky-pwa-banner');
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

async function run() {
  await itAsync('7.1 Local server serves manifest, service worker, and prompt assets with HTTP 200', async () => {
    await testHttpDelivery();
  });

  console.log('\n===========================================================================');
  console.log(`🏁 TEST COMPLETE: ${passedCount} / ${totalCount} PASSED`);
  console.log('===========================================================================');
  if (passedCount !== totalCount) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

run();
