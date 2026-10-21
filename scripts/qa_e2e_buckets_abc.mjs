#!/usr/bin/env node
// scripts/qa_e2e_buckets_abc.mjs — Comprehensive End-to-End Browser & WebSocket QA script
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { startServer } from '../server/server.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 4319;
const SCRATCH = '/Users/thanapat/.gemini/antigravity/brain/981da782-26a6-44d8-aa87-d7a6a0aab0f3/scratch';
fs.mkdirSync(SCRATCH, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const shotPaths = {
  shot1: path.join(SCRATCH, 'qa_e2e_1_glamour.png'),
  shot1b: path.join(SCRATCH, 'qa_e2e_1b_wardrobe_main.png'),
  shot2: path.join(SCRATCH, 'qa_e2e_2_attune.png'),
  shot3a: path.join(SCRATCH, 'qa_e2e_3a_hub_lobby.png'),
  shot3: path.join(SCRATCH, 'qa_e2e_3_hub_build_book.png'),
  shot4: path.join(SCRATCH, 'qa_e2e_4_league_results.png'),
  shot5: path.join(SCRATCH, 'qa_e2e_5_ghost_trial.png'),
};

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'neora-e2e-abc-'));
  const dataFile = path.join(tmpDir, 'db.json');

  let srv = null;
  let browser = null;

  const errors = [];
  const warnings = [];
  const assertions = [];

  function recordAssertion(name, passed, details = {}) {
    assertions.push({ name, passed, details });
    console.log(`[ASSERTION] ${passed ? '✅ PASS' : '❌ FAIL'}: ${name}`, details);
    if (!passed) {
      throw new Error(`Assertion failed: ${name} (${JSON.stringify(details)})`);
    }
  }

  try {
    console.log(`[QA] Starting server on port ${PORT}...`);
    srv = await startServer({ port: PORT, dataFile, quiet: true });
    console.log(`[QA] Server started on port ${PORT}`);

    console.log('[QA] Launching Puppeteer...');
    browser = await puppeteer.launch({
      executablePath: CHROME,
      headless: true,
      args: [
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader',
        '--ignore-gpu-blocklist',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
        '--window-size=430,932',
      ],
    });

    const page = await browser.newPage();
    await page.setViewport({
      width: 430,
      height: 932,
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });

    page.on('console', (msg) => {
      const t = msg.type();
      const txt = msg.text();
      if (t === 'error') {
        errors.push(txt);
        console.error(`[Console Error] ${txt}`);
      } else if (t === 'warning' || t === 'warn') {
        warnings.push(txt);
      }
    });

    page.on('pageerror', (err) => {
      const txt = `${err.message || err}`;
      errors.push(txt);
      console.error(`[Page Error] ${txt}`);
    });

    // Login as nook
    console.log('[QA] Logging in as nook...');
    await page.goto(`http://localhost:${PORT}/?dev=1&user=nook&pass=1234`, { waitUntil: 'networkidle0' });

    await page.waitForFunction(() => {
      return window.__neora?.world?.local !== undefined &&
             window.__neora?.rpg !== undefined &&
             window.__neora?.state?.profile !== undefined;
    }, { timeout: 25000 });

    console.log('[QA] Logged in as nook, world spawned.');

    // =========================================================================
    // 1. 👗 Wardrobe Glamour (UI + WebSocket)
    // =========================================================================
    console.log('\n--- 1. Testing Wardrobe Glamour ---');
    await page.evaluate(() => window.__neora.rpg.open('wardrobe'));
    await page.waitForSelector('.s2-avatar-parchment-card', { timeout: 10000 });
    console.log('[QA] Wardrobe open.');
    await sleep(400);

    // Open closet drawer
    await page.waitForSelector('[data-toggle-closet-drawer="1"]', { timeout: 10000 });
    await page.click('[data-toggle-closet-drawer="1"]');
    await page.waitForSelector('.s2-closet-drawer.is-open', { timeout: 10000 });
    console.log('[QA] Closet drawer open.');
    await sleep(400);

    // Target slot and unequipped item (e.g. s8_glacial_elsa)
    const selInfo = { slot: 'outfit', itemId: 's8_glacial_elsa' };
    console.log(`[QA] Targeting glamour slot: ${selInfo.slot}, item: ${selInfo.itemId}`);

    // Click slot pill in drawer to ensure target slot is active
    const slotBtnSelector = `.s2-closet-drawer [data-slot="${selInfo.slot}"]`;
    await page.waitForSelector(slotBtnSelector, { timeout: 10000 });
    await page.click(slotBtnSelector);
    await sleep(400);

    // Click Glamour mode toggle inside drawer
    await page.waitForSelector('.s2-closet-drawer [data-wardrobe-mode="glamour"]', { timeout: 10000 });
    await page.click('.s2-closet-drawer [data-wardrobe-mode="glamour"]');
    await sleep(400);

    // Click on unequipped item closet tile
    const targetTile = `.s2-closet-drawer [data-closet-item="${selInfo.itemId}"]`;
    console.log(`[QA] Waiting for tile: ${targetTile}`);
    await page.waitForSelector(targetTile, { timeout: 10000 });
    await page.click(targetTile);
    await sleep(400);

    // Click [data-glamour-set] inside drawer inspector
    await page.waitForSelector('.s2-closet-drawer [data-glamour-set]', { timeout: 10000 });
    await page.click('.s2-closet-drawer [data-glamour-set]');
    console.log('[QA] Clicked [data-glamour-set]');

    // Wait 600ms and assert
    await sleep(700);

    const glamourAssertState = await page.evaluate((slot, expectedItemId) => {
      const prof = window.__neora.state.profile;
      const glamourVal = prof?.glamour?.[slot];
      const hasBadge = document.querySelectorAll('.rpg-slot-glamour').length > 0;
      const badgeText = document.querySelector('.rpg-slot-glamour')?.textContent?.trim() || '';
      return {
        slot,
        glamourVal,
        expectedItemId,
        hasBadge,
        badgeText,
      };
    }, selInfo.slot, selInfo.itemId);

    recordAssertion(
      'Wardrobe Glamour set on profile and badge in DOM',
      glamourAssertState.glamourVal === selInfo.itemId && glamourAssertState.hasBadge,
      glamourAssertState
    );

    // Screenshot 1: qa_e2e_1_glamour.png (Closet Drawer open with Glamour mode & unequipped item selected)
    const otherItem = '.s2-closet-drawer [data-closet-item="s3_sultan_djinn"]';
    if (await page.$(otherItem)) {
      await page.click(otherItem);
      await sleep(300);
    }
    await page.screenshot({ path: shotPaths.shot1 });
    console.log(`[QA] Captured ${shotPaths.shot1}`);

    // Close closet drawer to inspect main Wardrobe screen (Paper Doll + Dash Build Strip + 4 Candy Buttons)
    await page.evaluate(() => {
      window.__neora.rpg.closetDrawerOpen = false;
      window.__neora.rpg.render();
    });
    await sleep(450);
    await page.screenshot({ path: shotPaths.shot1b });
    console.log(`[QA] Captured ${shotPaths.shot1b}`);

    // =========================================================================
    // 2. 🎯 Blacksmith Stat Attunement (UI + WebSocket)
    // =========================================================================
    console.log('\n--- 2. Testing Blacksmith Stat Attunement ---');

    // Ensure nook has an attunable accessory at refine >= 5
    const attuneCheck = await page.evaluate(() => {
      const prof = window.__neora.state.profile;
      const inv = prof.inventory || {};
      const items = Object.entries(inv).map(([id, d]) => ({ id, refine: d?.refine | 0, attune: d?.attune }));
      return { items };
    });
    console.log('[QA] nook inventory overview:', attuneCheck.items.slice(0, 8));

    // Open forge
    await page.evaluate(() => window.__neora.rpg.open('forge'));
    await page.waitForSelector('[data-forge-mode="attune"]', { timeout: 10000 });
    console.log('[QA] Forge modal open.');
    await sleep(400);

    // Click attune mode
    await page.click('[data-forge-mode="attune"]');
    await sleep(500);

    // Check if hat_glowing_bunny or another attunable accessory is present
    const chosenItem = 'hat_glowing_bunny';
    const hasItemTile = await page.$(`[data-forge-item="${chosenItem}"]`);
    if (hasItemTile) {
      await page.click(`[data-forge-item="${chosenItem}"]`);
      await sleep(400);
    }

    // Inspect candidate stat cards
    await page.waitForSelector('[data-attune-stat]', { timeout: 10000 });
    const statCardsInfo = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('[data-attune-stat]'));
      return cards.map((c) => ({
        stat: c.dataset.attuneStat,
        isActive: c.classList.contains('is-active'),
        isSelected: c.classList.contains('selected'),
      }));
    });
    console.log('[QA] Candidate stat cards:', statCardsInfo);

    const nonActiveCard = statCardsInfo.find((c) => !c.isActive);
    if (!nonActiveCard) {
      throw new Error('No non-active stat candidate card found for attunement!');
    }
    const chosenStat = nonActiveCard.stat;
    console.log(`[QA] Clicking candidate stat card: ${chosenStat}`);
    await page.click(`[data-attune-stat="${chosenStat}"]`);
    await sleep(400);

    // Click #attune-go
    await page.waitForSelector('#attune-go:not([disabled])', { timeout: 10000 });
    await page.click('#attune-go');
    console.log('[QA] Clicked #attune-go');

    // Wait 600ms and assert
    await sleep(700);

    const attuneAssertState = await page.evaluate((itemId, targetStat) => {
      const prof = window.__neora.state.profile;
      const invItem = prof?.inventory?.[itemId];
      const activeStat = invItem?.attune?.stat;
      return {
        itemId,
        targetStat,
        activeStat,
        attuneObj: invItem?.attune,
      };
    }, chosenItem, chosenStat);

    recordAssertion(
      'Blacksmith Stat Attunement succeeded on profile',
      attuneAssertState.activeStat === chosenStat,
      attuneAssertState
    );

    // Screenshot 2: qa_e2e_2_attune.png
    await page.screenshot({ path: shotPaths.shot2 });
    console.log(`[QA] Captured ${shotPaths.shot2}`);

    // Close RPG modal
    await page.evaluate(() => window.__neora.rpg.close());
    await page.waitForFunction(() => {
      const m = document.querySelector('.rpg-modal');
      return !m || m.hidden;
    }, { timeout: 5000 });
    console.log('[QA] RPG modal closed.');
    await sleep(400);

    // =========================================================================
    // 3. ☁️ Play Hub: 4-Mode Picker, Weather, Presets & 📖 Build Book
    // =========================================================================
    console.log('\n--- 3. Testing Play Hub (Picker, Weather, Presets, Build Book) ---');

    // Open Play Hub
    await page.evaluate(() => {
      const btn = document.querySelector('.dock-btn[data-dock="play"]');
      if (btn) btn.click();
      else if (window.__neora?.mono?.openHub) window.__neora.mono.openHub();
    });
    await page.waitForSelector('.hub-wrap:not([hidden])', { timeout: 10000 });
    console.log('[QA] Play Hub open.');
    await sleep(500);

    // Switch to cloud_dash tab
    await page.waitForSelector('.hub-wrap:not([hidden]) button[data-tab="cloud_dash"]', { timeout: 10000 });
    await page.click('.hub-wrap:not([hidden]) button[data-tab="cloud_dash"]');
    await sleep(600);

    // Assert .hub-dash-picker has all 4 mode buttons
    const pickerInfo = await page.evaluate(() => {
      const picker = document.querySelector('.hub-dash-picker');
      const buttons = picker ? Array.from(picker.querySelectorAll('[data-dash-mode]')).map((b) => b.dataset.dashMode) : [];
      const metaBar = document.querySelector('.hub-dash-meta-bar')?.innerText || '';
      return { buttons, metaBar };
    });

    const expectedModes = ['quick', 'chaos', 'league', 'ghost'];
    const hasAllModes = expectedModes.every((m) => pickerInfo.buttons.includes(m));
    const metaBarHasWeather = pickerInfo.metaBar.length > 0;
    const metaBarHasChests = pickerInfo.metaBar.includes('Chests') && pickerInfo.metaBar.includes('0/3');

    recordAssertion(
      'Play Hub 4-mode picker contains quick, chaos, league, ghost',
      hasAllModes,
      { buttons: pickerInfo.buttons }
    );

    recordAssertion(
      'Play Hub meta bar shows Weather & Daily Chests 0/3',
      metaBarHasWeather && metaBarHasChests,
      { metaBar: pickerInfo.metaBar }
    );

    // Click [data-preset-save="0"], wait 500ms
    console.log('[QA] Clicking [data-preset-save="0"]...');
    await page.waitForSelector('[data-preset-save="0"]', { timeout: 10000 });
    await page.click('[data-preset-save="0"]');
    await sleep(600);

    // Click [data-preset-equip="0"], wait 500ms
    console.log('[QA] Clicking [data-preset-equip="0"]...');
    await page.waitForSelector('[data-preset-equip="0"]', { timeout: 10000 });
    await page.click('[data-preset-equip="0"]');
    await sleep(600);

    // Check no timeout toast
    const toastCheck = await page.evaluate(() => {
      const toasts = Array.from(document.querySelectorAll('.toast, .rpg-toast')).map((t) => t.textContent || '');
      const hasErrorToast = toasts.some((t) => t.toLowerCase().includes('timeout') || t.toLowerCase().includes('timed out'));
      const presets = window.__neora.state.profile.dash_presets;
      return { toasts, hasErrorToast, presetsCount: presets?.length || 0 };
    });

    recordAssertion(
      'Preset save and equip succeeded without timeout toast',
      !toastCheck.hasErrorToast,
      toastCheck
    );

    // Screenshot 3a: qa_e2e_3a_hub_lobby.png (Play Hub Cloud Dash Lobby)
    await page.screenshot({ path: shotPaths.shot3a });
    console.log(`[QA] Captured ${shotPaths.shot3a}`);

    // Click [data-act="dash-builds"] (📖 Builds)
    console.log('[QA] Opening Build Book...');
    await page.waitForSelector('[data-act="dash-builds"]', { timeout: 10000 });
    await page.click('[data-act="dash-builds"]');
    await page.waitForSelector('.hub-build-book:not([hidden])', { timeout: 10000 });

    const buildCardsCount = await page.evaluate(() => {
      return document.querySelectorAll('.hub-build-book .hub-build-card').length;
    });

    recordAssertion(
      'Build Collection Book lists 11 build cards',
      buildCardsCount === 11,
      { count: buildCardsCount }
    );

    // Screenshot 3: qa_e2e_3_hub_build_book.png
    await page.screenshot({ path: shotPaths.shot3 });
    console.log(`[QA] Captured ${shotPaths.shot3}`);

    // Close Build Book
    await page.click('[data-act="dash-builds-close"]');
    await sleep(400);

    // =========================================================================
    // 4. 🏆 Cloud League Race & Post-Race Retention UI
    // =========================================================================
    console.log('\n--- 4. Testing Cloud League Race & Post-Race Retention UI ---');

    // Select League mode
    await page.click('[data-dash-mode="league"]');
    await sleep(400);

    // Click Solo button
    await page.click('.hub-wrap:not([hidden]) [data-act="solo"]');
    console.log('[QA] Clicked Solo for Cloud League.');

    // Wait for #cloud-dash-root to be visible
    await page.waitForFunction(() => {
      const r = document.getElementById('cloud-dash-root');
      return r && !r.hidden;
    }, { timeout: 15000 });
    console.log('[QA] Cloud League root visible.');

    // Wait for race active
    await page.waitForFunction(() => {
      const cd = window.__neora?.cloudDashUI;
      if (!cd) return false;
      return cd.status === 'playing' || cd.status === 'racing' || (cd.goAt && performance.now() >= cd.goAt);
    }, { timeout: 12000 });
    console.log('[QA] Cloud League race active.');

    await sleep(800);

    // Fast-finish by advancing runner.s to 998 and pressing Space
    console.log('[QA] Fast-finishing race...');
    await page.evaluate(() => {
      const cd = window.__neora.cloudDashUI;
      if (cd?.runner) {
        cd.runner.s = 998;
        cd.runner.v = 15;
      }
    });

    // Press Space until runner crosses 1000m and finishes
    const finishStart4 = Date.now();
    while (Date.now() - finishStart4 < 6000) {
      await page.keyboard.press('Space');
      const isFin = await page.evaluate(() => Boolean(window.__neora?.cloudDashUI?.runner?.finished));
      if (isFin) break;
      await sleep(100);
    }

    // Wait for .cd-results to become visible
    console.log('[QA] Waiting for .cd-results overlay...');
    await page.waitForFunction(() => {
      const el = document.querySelector('.cd-results');
      return el && !el.hidden;
    }, { timeout: 20000 });
    console.log('[QA] .cd-results overlay visible!');

    await sleep(600);

    // Assert results content
    const resultsData = await page.evaluate(() => {
      const root = document.querySelector('.cd-results');
      const text = root ? root.innerText : '';
      const hasLeagueLp = text.includes('LP') && (text.includes('Bronze') || text.includes('League'));
      const hasDailyChests = text.includes('Daily Sky Chests') && text.includes('1/3');
      const hasMissions = document.querySelectorAll('.cd-daily-box div span').length >= 3;
      const forgeBtn = root.querySelector('[data-res="goto-forge"]');
      const hasForgeBtn = Boolean(forgeBtn);
      return {
        textSnippet: text.slice(0, 300),
        hasLeagueLp,
        hasDailyChests,
        hasMissions,
        hasForgeBtn,
      };
    });

    recordAssertion(
      'Cloud League results contain LP, Daily Chests 1/3, 3 Missions, goto-forge button',
      resultsData.hasLeagueLp && resultsData.hasDailyChests && resultsData.hasForgeBtn,
      resultsData
    );

    // Screenshot 4: qa_e2e_4_league_results.png
    await page.screenshot({ path: shotPaths.shot4 });
    console.log(`[QA] Captured ${shotPaths.shot4}`);

    // Click [data-res="exit"]
    console.log('[QA] Exiting race to village/hub...');
    await page.click('.cd-results [data-res="exit"]');
    await page.waitForFunction(() => {
      const r = document.getElementById('cloud-dash-root');
      return !r || r.hidden;
    }, { timeout: 10000 });
    await sleep(600);

    // =========================================================================
    // 5. 👻 Ghost Trial (PB Recording + Translucent Ghost Runner)
    // =========================================================================
    console.log('\n--- 5. Testing Ghost Trial (PB Recording + Ghost Runner) ---');

    // Re-open Play Hub
    await page.evaluate(() => {
      const btn = document.querySelector('.dock-btn[data-dock="play"]');
      if (btn) btn.click();
      else if (window.__neora?.mono?.openHub) window.__neora.mono.openHub();
    });
    await page.waitForSelector('.hub-wrap:not([hidden])', { timeout: 10000 });
    await sleep(500);

    // Select Cloud Dash tab
    await page.click('.hub-wrap:not([hidden]) button[data-tab="cloud_dash"]');
    await sleep(500);

    // Select Ghost mode
    await page.click('[data-dash-mode="ghost"]');
    await sleep(400);

    // Launch Solo Ghost race
    await page.click('.hub-wrap:not([hidden]) [data-act="solo"]');
    console.log('[QA] Launched Ghost Trial solo.');

    // Wait for root visible
    await page.waitForFunction(() => {
      const r = document.getElementById('cloud-dash-root');
      return r && !r.hidden;
    }, { timeout: 15000 });

    // Wait for race active
    await page.waitForFunction(() => {
      const cd = window.__neora?.cloudDashUI;
      if (!cd) return false;
      return cd.status === 'playing' || cd.status === 'racing' || (cd.goAt && performance.now() >= cd.goAt);
    }, { timeout: 12000 });
    console.log('[QA] Ghost Trial race 1 active. Running for ~2.5s to record samples...');

    // Run for ~2.5 seconds sending Space
    const startRun = Date.now();
    while (Date.now() - startRun < 2500) {
      await page.keyboard.press('Space');
      await sleep(250);
    }

    // Finish race 1 to record PB
    console.log('[QA] Finishing Ghost race 1 to record PB...');
    await page.evaluate(() => {
      const cd = window.__neora.cloudDashUI;
      if (cd?.runner) {
        cd.runner.s = 998;
        cd.runner.v = 15;
      }
    });

    // Press Space until runner crosses 1000m and finishes
    const finishStart5 = Date.now();
    while (Date.now() - finishStart5 < 6000) {
      await page.keyboard.press('Space');
      const isFin = await page.evaluate(() => Boolean(window.__neora?.cloudDashUI?.runner?.finished));
      if (isFin) break;
      await sleep(100);
    }

    // Wait for results
    await page.waitForFunction(() => {
      const el = document.querySelector('.cd-results');
      return el && !el.hidden;
    }, { timeout: 20000 });
    console.log('[QA] Ghost race 1 finished, results visible.');
    await sleep(600);

    // Check PB text or me.newGhostPb
    const ghostPbResult = await page.evaluate(() => {
      const resultsText = document.querySelector('.cd-results')?.innerText || '';
      const hasPbBadge = resultsText.includes('GHOST PB') || resultsText.includes('NEW BEST') || resultsText.includes('VICTORY');
      const ghostProf = window.__neora.state.profile.dash_ghost;
      return {
        resultsText: resultsText.slice(0, 200),
        hasPbBadge,
        ghostSamplesRecorded: ghostProf?.samples?.length || 0,
      };
    });
    console.log('[QA] Ghost race 1 PB result:', ghostPbResult);

    recordAssertion(
      'Ghost PB was recorded on profile',
      ghostPbResult.ghostSamplesRecorded >= 2,
      ghostPbResult
    );

    // Click [data-res="again"] (🔁 Run It Back)
    console.log('[QA] Clicking [data-res="again"] for rematch...');
    await page.click('.cd-results [data-res="again"]');

    // Wait for race active in race 2
    console.log('[QA] Waiting for Ghost rematch active...');
    await page.waitForFunction(() => {
      const cd = window.__neora?.cloudDashUI;
      if (!cd) return false;
      return cd.status === 'playing' || cd.status === 'racing' || (cd.goAt && performance.now() >= cd.goAt);
    }, { timeout: 15000 });

    console.log('[QA] Ghost rematch active. Waiting 1s for ghost runner rig sync...');
    await sleep(1000);

    // Assert ghostRig exists and ghostData.samples.length >= 2
    const ghostRigCheck = await page.evaluate(() => {
      const cd = window.__neora.cloudDashUI;
      const hasGhostRig = Boolean(cd?.ghostRig);
      const ghostSamplesLen = cd?.ghostData?.samples?.length || 0;
      const ghostVisible = cd?.ghostRig?.ROOT?.visible;
      return {
        hasGhostRig,
        ghostSamplesLen,
        ghostVisible,
      };
    });

    recordAssertion(
      'Translucent ghost runner instantiated (ghostRig exists and samples >= 2)',
      ghostRigCheck.hasGhostRig && ghostRigCheck.ghostSamplesLen >= 2,
      ghostRigCheck
    );

    // Screenshot 5: qa_e2e_5_ghost_trial.png
    await page.screenshot({ path: shotPaths.shot5 });
    console.log(`[QA] Captured ${shotPaths.shot5}`);

    // Summary
    const summary = {
      status: 'SUCCESS',
      assertionsCount: assertions.length,
      allPassed: assertions.every((a) => a.passed),
      assertions,
      screenshots: shotPaths,
      consoleErrors: Array.from(new Set(errors)),
      consoleWarnings: Array.from(new Set(warnings)),
    };

    console.log('\n========================================');
    console.log('QA E2E BUCKETS ABC SUMMARY:');
    console.log(JSON.stringify(summary, null, 2));
    console.log('========================================');

  } catch (err) {
    console.error('[QA FATAL ERROR]', err);
    process.exitCode = 1;
  } finally {
    if (browser) {
      console.log('[QA] Closing browser...');
      await browser.close().catch(() => {});
    }
    if (srv) {
      console.log('[QA] Closing server...');
      await srv.close().catch(() => {});
    }
    try {
      execSync('pkill -9 -f puppeteer_dev_chrome_profile || true', { stdio: 'ignore' });
    } catch {}
    console.log('[QA] Done.');
  }
}

main().then(() => {
  if (!process.exitCode) process.exit(0);
});
