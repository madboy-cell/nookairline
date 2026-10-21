#!/usr/bin/env node
// scripts/qa_cloud_dash_showcase.mjs — Showcase QA for Cloud Dash Deck, Apex, Heart, and Vault mechanics
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
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'neora-cd-showcase-qa-'));
  const dataFile = path.join(tmpDir, 'db.json');

  let srv = null;
  let browser = null;
  const consoleErrors = [];
  const consoleWarnings = [];
  const httpErrors = [];

  const shotPaths = {
    shot1: path.join(SCRATCH, 'qa_sc_1_ring.png'),
    shot2: path.join(SCRATCH, 'qa_sc_2_deck.png'),
    shot3: path.join(SCRATCH, 'qa_sc_3_apex.png'),
    shot4: path.join(SCRATCH, 'qa_sc_4_heart.png'),
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
    await sleep(400);

    // ----------------------------------------------------------------
    // Step 1: Teleport before deck ring, jump through ring onto deck
    // ----------------------------------------------------------------
    console.log('[QA] Teleporting to before deck ring (s = deck.ring - 14, lane = 0)...');
    await page.evaluate(() => {
      const cd = window.__neora.cloudDashUI;
      cd.runner.s = cd.track.deck.ring - 14;
      cd.runner.laneT = 0;
      cd.runner.laneF = 0;
      cd.runner.y = 0;
      cd.runner.vy = 0;
      cd.runner.deck = false;
      cd.runner.deckH = 0;
      cd.runner.grounded = true;
    });

    let shot1Taken = false;
    let jumped = false;
    const ringWaitStart = Date.now();
    while (Date.now() - ringWaitStart < 8000) {
      const status = await page.evaluate(() => {
        const cd = window.__neora.cloudDashUI;
        const ring = cd.track.deck.ring;
        const dist = ring - cd.runner.s;
        return { dist, s: cd.runner.s, v: cd.runner.v, deck: cd.runner.deck, deckH: cd.runner.deckH, y: cd.runner.y };
      });

      if (!shot1Taken && status.dist <= 8.5) {
        console.log(`[QA] At dist=${status.dist.toFixed(2)}m before ring, taking qa_sc_1_ring.png`);
        await page.screenshot({ path: shotPaths.shot1 });
        shot1Taken = true;
        console.log(`[QA] Captured ${shotPaths.shot1}`);
      }

      if (!jumped && status.dist < status.v * 0.25) {
        console.log(`[QA] Jumping through golden ring at dist=${status.dist.toFixed(2)}m (v=${status.v.toFixed(2)}m/s)`);
        await page.keyboard.press('Space');
        jumped = true;
      }

      if (status.deck) {
        console.log(`[QA] Deck entered! Runner s=${status.s.toFixed(2)}, deck=${status.deck}, deckH=${status.deckH.toFixed(2)}`);
        break;
      }

      await sleep(16);
    }

    if (!shot1Taken) {
      console.warn('[QA WARNING] Fallback capture for shot1');
      await page.screenshot({ path: shotPaths.shot1 });
    }

    // Wait ~1.5s after deck entry
    console.log('[QA] Waiting ~1.5s after deck entry...');
    await sleep(1500);

    const deckCheck = await page.evaluate(() => {
      const cd = window.__neora.cloudDashUI;
      return {
        deck: cd.runner.deck,
        deckH: cd.runner.deckH,
        s: cd.runner.s,
        y: cd.runner.y,
        decks: cd.runner.decks,
      };
    });
    console.log(`[QA] Deck status: cd.runner.deck===${deckCheck.deck} (decks=${deckCheck.decks}, deckH=${deckCheck.deckH.toFixed(2)}, s=${deckCheck.s.toFixed(1)}, y=${deckCheck.y.toFixed(2)})`);
    await page.screenshot({ path: shotPaths.shot2 });
    console.log(`[QA] Captured ${shotPaths.shot2}`);

    // ----------------------------------------------------------------
    // Step 2: Teleport into bend 4 for Apex Carve
    // ----------------------------------------------------------------
    console.log('[QA] Teleporting into bend 4 for Apex Carve...');
    const bendInfo = await page.evaluate(() => {
      const cd = window.__neora.cloudDashUI;
      const b = cd.track.bends[4];
      cd.runner.s = b.s0 + 1;
      cd.runner.laneT = b.dir;
      cd.runner.laneF = b.dir;
      cd.runner.grounded = true;
      cd.runner.y = 0;
      cd.runner.vy = 0;
      cd.runner.deck = false;
      cd.runner.deckH = 0;
      return { b, s: cd.runner.s, laneF: cd.runner.laneF, apexes: cd.runner.apexes };
    });
    console.log(`[QA] Teleported into bend 4: s0=${bendInfo.b.s0.toFixed(1)}, s1=${bendInfo.b.s1.toFixed(1)}, dir=${bendInfo.b.dir}, initial apexes=${bendInfo.apexes}`);

    console.log('[QA] Waiting 0.6s in inside lane to trigger Apex...');
    await sleep(600);

    const apexCheck = await page.evaluate(() => {
      const cd = window.__neora.cloudDashUI;
      return {
        apexes: cd.runner.apexes,
        apex: cd.runner.apex,
        s: cd.runner.s,
        laneF: cd.runner.laneF,
      };
    });
    console.log(`[QA] Apex status: cd.runner.apexes=${apexCheck.apexes}, apexBoost=${apexCheck.apex.toFixed(2)}, s=${apexCheck.s.toFixed(1)}, laneF=${apexCheck.laneF.toFixed(2)}`);
    await page.screenshot({ path: shotPaths.shot3 });
    console.log(`[QA] Captured ${shotPaths.shot3}`);

    // ----------------------------------------------------------------
    // Step 3: HUD Heart meter
    // ----------------------------------------------------------------
    console.log('[QA] Testing HUD Heart meter...');
    await page.evaluate(() => {
      const cd = window.__neora.cloudDashUI;
      Object.defineProperty(cd, 'heartWith', {
        get() { return [1]; },
        set() {},
        configurable: true,
      });
      cd.runner.heart = 60;
      cd.runner.hearting = true;
      const r1 = cd.rivals.get(1);
      if (r1) {
        if (!r1.disp) r1.disp = { s: cd.runner.s + 3, l: cd.runner.laneF, y: 0, dh: 0 };
        else { r1.disp.s = cd.runner.s + 3; r1.disp.l = cd.runner.laneF; }
      }
      cd._updateHud(true);
    });
    await sleep(50);
    await page.screenshot({ path: shotPaths.shot4 });
    console.log(`[QA] Captured ${shotPaths.shot4}`);

    // ----------------------------------------------------------------
    // Summary
    // ----------------------------------------------------------------
    const dedupErrors = Array.from(new Set(consoleErrors));
    const dedupWarnings = Array.from(new Set(consoleWarnings));

    console.log('\n========================================');
    console.log('QA CLOUD DASH SHOWCASE SUMMARY:');
    console.log('Screenshots:');
    for (const [k, v] of Object.entries(shotPaths)) {
      console.log(`  ${k} -> ${v} (${fs.existsSync(v) ? 'OK' : 'MISSING'})`);
    }
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
