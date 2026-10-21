#!/usr/bin/env node
// scripts/qa_cloud_dash_items.mjs — Visual QA for Cloud Dash Item Art
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { startServer } from '../server/server.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 4317;
const SCRATCH = '/Users/thanapat/.gemini/antigravity/brain/981da782-26a6-44d8-aa87-d7a6a0aab0f3/scratch';
fs.mkdirSync(SCRATCH, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'neora-cd-items-qa-'));
  const dataFile = path.join(tmpDir, 'db.json');

  let srv = null;
  let browser = null;
  const consoleErrors = [];
  const consoleWarnings = [];
  const httpErrors = [];
  let loggedTraps = null;

  const shotPaths = {
    shot1: path.join(SCRATCH, 'qa_items_1_prism.png'),
    shot2: path.join(SCRATCH, 'qa_items_2_bubble.png'),
    shot3: path.join(SCRATCH, 'qa_items_3_shield.png'),
    shot4: path.join(SCRATCH, 'qa_items_4_trap.png'),
    shot5: path.join(SCRATCH, 'qa_items_5_draft.png'),
  };

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
        consoleErrors.push(txt);
        console.error(`[Console Error] ${txt}`);
      } else if (t === 'warning' || t === 'warn') {
        consoleWarnings.push(txt);
      }
    });

    page.on('pageerror', (err) => {
      const txt = `${err.message || err}`;
      consoleErrors.push(txt);
      console.error(`[Page Error] ${txt}`);
    });

    page.on('response', (res) => {
      const status = res.status();
      if (status >= 400) {
        httpErrors.push({ url: res.url(), status });
        console.warn(`[HTTP Error] ${status} ${res.url()}`);
      }
    });

    // 1. Login as nook
    console.log('[QA] Logging in as nook...');
    await page.goto(`http://localhost:${PORT}/?dev=1&user=nook&pass=1234`, { waitUntil: 'networkidle0' });

    await page.waitForFunction(() => {
      return window.__neora?.world?.local !== undefined &&
             window.__neora?.cloudDashUI !== undefined;
    }, { timeout: 25000 });

    console.log('[QA] Logged in as nook, world spawned.');

    // 2. Open Play Hub
    console.log('[QA] Opening Play Hub...');
    await page.evaluate(() => {
      const btn = document.querySelector('.dock-btn[data-dock="play"]');
      if (btn) btn.click();
      else if (window.__neora?.mono?.openHub) window.__neora.mono.openHub();
    });

    await page.waitForSelector('.hub-wrap:not([hidden])', { timeout: 10000 });
    console.log('[QA] Play Hub is open.');
    await sleep(600);

    // 3. Switch to Cloud Dash tab
    console.log('[QA] Selecting Cloud Dash tab...');
    await page.waitForSelector('.hub-wrap:not([hidden]) button[data-tab="cloud_dash"]', { timeout: 10000 });
    await page.click('.hub-wrap:not([hidden]) button[data-tab="cloud_dash"]');
    await sleep(600);

    // 4. Click Solo button (with fallback)
    console.log('[QA] Clicking Solo button...');
    await page.waitForSelector('.hub-wrap:not([hidden]) [data-act="solo"]', { timeout: 10000 });
    await page.click('.hub-wrap:not([hidden]) [data-act="solo"]');

    const openedFast = await page.waitForFunction(() => {
      const r = document.getElementById('cloud-dash-root');
      return r && !r.hidden;
    }, { timeout: 4000 }).catch(() => null);

    if (!openedFast) {
      console.log('[QA] Attempting fallback solo launch via net room...');
      await page.evaluate(() => {
        if (window.__neora?.mono?.hub) {
          window.__neora.mono.hub.mode = 'cloud_dash';
          window.__neora.mono.hub.room.send({ type: 'table_solo', mode: 'cloud_dash', diff: 'easy' });
        }
      });
    }

    // 5. Wait for #cloud-dash-root to become visible
    console.log('[QA] Waiting for #cloud-dash-root to become visible...');
    await page.waitForFunction(() => {
      const r = document.getElementById('cloud-dash-root');
      return r && !r.hidden;
    }, { timeout: 15000 });
    console.log('[QA] #cloud-dash-root is visible!');

    // 6. Wait for GO
    console.log('[QA] Waiting for GO (countdown end)...');
    await page.waitForFunction(() => {
      const cd = window.__neora?.cloudDashUI;
      if (!cd) return false;
      return cd.status === 'playing' || (cd.goAt && performance.now() >= cd.goAt);
    }, { timeout: 10000 });
    console.log('[QA] GO! Race active.');

    // ----------------------------------------------------------------
    // Step 1: Play normally and wait for next Mystery Prism (15–30m ahead)
    // ----------------------------------------------------------------
    console.log('[QA] Step 1: Racing forward to find Mystery Prism 15-30m ahead...');
    const raceStart = Date.now();
    let lastSpace = 0;
    let lastTurn = 0;
    let laneLeft = true;
    let prismCaptured = false;

    while (Date.now() - raceStart < 40000 && !prismCaptured) {
      const now = Date.now();

      // Space every ~600ms
      if (now - lastSpace >= 600) {
        await page.keyboard.press('Space');
        lastSpace = now;
      }

      // Alternate ArrowLeft / ArrowRight every ~2s
      if (now - lastTurn >= 2000) {
        await page.keyboard.press(laneLeft ? 'ArrowLeft' : 'ArrowRight');
        laneLeft = !laneLeft;
        lastTurn = now;
      }

      // Check distance to next prism
      const prismCheck = await page.evaluate(() => {
        const cd = window.__neora?.cloudDashUI;
        if (!cd?.runner || !cd?.track?.items) return null;
        const s = cd.runner.s;
        const nextPrism = cd.track.items.find((it) => it.t === 'prism' && it.s > s);
        return {
          s,
          v: cd.runner.v,
          laneF: cd.runner.laneF,
          prismS: nextPrism ? nextPrism.s : null,
          dist: nextPrism ? (nextPrism.s - s) : null,
        };
      });

      if (prismCheck?.dist != null) {
        if (Math.round(prismCheck.s) % 40 === 0) {
          console.log(`[QA] s=${prismCheck.s.toFixed(1)}m, next prism at s=${prismCheck.prismS.toFixed(1)}m (dist=${prismCheck.dist.toFixed(1)}m)`);
        }
        if (prismCheck.dist <= 30 && prismCheck.dist >= 14) {
          console.log(`[QA] Prism spotted in range! s=${prismCheck.s.toFixed(1)}m, prismS=${prismCheck.prismS.toFixed(1)}m, dist=${prismCheck.dist.toFixed(1)}m`);
          await page.screenshot({ path: shotPaths.shot1 });
          prismCaptured = true;
          console.log(`[QA] Captured ${shotPaths.shot1}`);
          break;
        }
      }

      await sleep(100);
    }

    if (!prismCaptured) {
      console.warn('[QA WARNING] Did not encounter prism in range during window; taking fallback screenshot');
      await page.screenshot({ path: shotPaths.shot1 });
    }

    // ----------------------------------------------------------------
    // Step 2: Force-show item bubble (mochi) & press KeyQ to use it
    // ----------------------------------------------------------------
    console.log('[QA] Step 2: Force item bubble with mochi, capture, then press KeyQ...');
    await page.evaluate(async () => {
      const cd = window.__neora.cloudDashUI;
      cd.runner.items = ['mochi'];
      cd._renderItemBubble();
      const img = cd.el.item.querySelector('img');
      if (img && !img.complete) {
        await new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
        });
      }
    });

    await sleep(200);
    await page.screenshot({ path: shotPaths.shot2 });
    console.log(`[QA] Captured ${shotPaths.shot2}`);

    // Press KeyQ to drop the mochi trap
    console.log('[QA] Pressing KeyQ to use item (mochi)...');
    await page.keyboard.press('KeyQ');

    // Wait ~0.6s to 0.8s and log cd.traps
    await sleep(750);
    loggedTraps = await page.evaluate(() => {
      const cd = window.__neora?.cloudDashUI;
      return cd ? cd.traps : null;
    });
    console.log('[QA] Logged cd.traps after using mochi:', JSON.stringify(loggedTraps));

    // ----------------------------------------------------------------
    // Step 3: Force shield bubble around runner
    // ----------------------------------------------------------------
    console.log('[QA] Step 3: Force shield = 10, wait 300ms, capture...');
    await page.evaluate(() => {
      const cd = window.__neora.cloudDashUI;
      cd.runner.shield = 10;
    });
    await sleep(300);
    await page.screenshot({ path: shotPaths.shot3 });
    console.log(`[QA] Captured ${shotPaths.shot3}`);

    // ----------------------------------------------------------------
    // Step 4: Force a visible trap ahead on the road
    // ----------------------------------------------------------------
    console.log('[QA] Step 4: Force trap ahead (s + 14m), capture immediately...');
    await page.evaluate(() => {
      const cd = window.__neora.cloudDashUI;
      const trap = { id: 999, s: cd.runner.s + 14, lane: Math.round(cd.runner.laneF), owner: 3 };
      cd.traps = [trap];
      // Ensure trap persists for at least 400ms against server broadcast overrides
      const until = performance.now() + 400;
      if (!cd._origHandleState) {
        cd._origHandleState = cd._handleState;
        cd._handleState = function(m) {
          if (performance.now() < until && m && m.traps) {
            if (!m.traps.some((t) => t.id === 999)) m.traps.push(trap);
          }
          return cd._origHandleState.call(this, m);
        };
      }
    });
    // Immediately capture within ~150ms
    await page.screenshot({ path: shotPaths.shot4 });
    console.log(`[QA] Captured ${shotPaths.shot4}`);

    // ----------------------------------------------------------------
    // Step 5: Force drafting visual (golden wind overlay)
    // ----------------------------------------------------------------
    console.log('[QA] Step 5: Force drafting visual overlay (slip = 10, drafting = true)...');
    await page.evaluate(() => {
      const cd = window.__neora.cloudDashUI;
      cd.runner.slip = 10.0;
      cd.runner.drafting = true;
      cd.runner.draft = 1.0;
      if (cd.el.draft) cd.el.draft.style.opacity = '0.8';
    });
    // Wait for the CSS opacity transition (0.2s)
    await sleep(300);
    await page.screenshot({ path: shotPaths.shot5 });
    console.log(`[QA] Captured ${shotPaths.shot5}`);

    // ----------------------------------------------------------------
    // Deduplicate and summarize
    // ----------------------------------------------------------------
    const dedupErrors = Array.from(new Set(consoleErrors));
    const dedupWarnings = Array.from(new Set(consoleWarnings));

    console.log('\n========================================');
    console.log('QA CLOUD DASH ITEMS SUMMARY:');
    console.log('Screenshots:');
    for (const [k, v] of Object.entries(shotPaths)) {
      console.log(`  ${k} -> ${v} (${fs.existsSync(v) ? 'OK' : 'MISSING'})`);
    }
    console.log(`\nLogged cd.traps: ${JSON.stringify(loggedTraps, null, 2)}`);
    console.log(`\nHTTP Errors (>= 400) Count: ${httpErrors.length}`);
    httpErrors.forEach((e, i) => console.log(`  [${i + 1}] ${e.status} ${e.url}`));
    console.log(`\nConsole Errors Count: ${dedupErrors.length}`);
    dedupErrors.forEach((e, i) => console.log(`  [${i + 1}] ${e}`));
    console.log(`\nConsole Warnings Count: ${dedupWarnings.length}`);
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
    console.log('[QA] Complete.');
  }
}

main().then(() => {
  if (!process.exitCode) process.exit(0);
});
