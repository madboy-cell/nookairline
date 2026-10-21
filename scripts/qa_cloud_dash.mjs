#!/usr/bin/env node
// scripts/qa_cloud_dash.mjs — Visual QA & Smoke Test for Sky Cloud Dash minigame
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

async function extractRunnerSnapshot(page) {
  return await page.evaluate(() => {
    const cd = window.__neora?.cloudDashUI;
    const r = cd?.runner;
    let rivalsWithTarget = 0;
    if (cd?.rivals) {
      for (const rr of cd.rivals.values()) {
        if (rr && rr.target != null) rivalsWithTarget++;
      }
    }
    return {
      status: cd?.status ?? null,
      rivalsWithTarget,
      runner: r ? {
        s: r.s,
        v: r.v,
        laneF: r.laneF,
        y: r.y,
        bond: r.bond,
        ultCharge: r.ultCharge,
        chain: r.chain,
        ride: r.ride,
        style: r.style,
        finished: r.finished,
      } : null,
      finished: r?.finished || false,
    };
  });
}

function logRunnerState(label, snap) {
  console.log(`\n--- Runner State at ${label} ---`);
  console.log(`Status: ${snap.status}`);
  console.log(`Rivals with target: ${snap.rivalsWithTarget}`);
  if (snap.runner) {
    const r = snap.runner;
    console.log(`s: ${r.s.toFixed(2)}, v: ${r.v.toFixed(2)}, laneF: ${r.laneF.toFixed(2)}, y: ${r.y.toFixed(2)}`);
    console.log(`bond: ${r.bond.toFixed(2)}, ultCharge: ${r.ultCharge.toFixed(2)}, chain: ${r.chain}, ride: ${r.ride.toFixed(2)}, style: ${r.style}`);
  } else {
    console.log('Runner: null');
  }
}

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'neora-cd-qa-'));
  const dataFile = path.join(tmpDir, 'db.json');

  let srv = null;
  let browser = null;
  const errors = [];
  const warnings = [];
  const runnerLogs = [];

  let openedRoot = false;
  let maxS = 0;
  let finished = false;
  let resultsVisible = false;
  let resultsCardText = '';

  const shotPaths = {
    shot1: path.join(SCRATCH, 'qa_cd_1_countdown.png'),
    shot2: path.join(SCRATCH, 'qa_cd_2_race.png'),
    shot3: path.join(SCRATCH, 'qa_cd_3_race.png'),
    shot4: path.join(SCRATCH, 'qa_cd_4_race.png'),
    shot5: path.join(SCRATCH, 'qa_cd_5_results.png'),
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

    // 1. Login as nook
    console.log('[QA] Logging in as nook...');
    await page.goto(`http://localhost:${PORT}/?dev=1&user=nook&pass=1234`, { waitUntil: 'networkidle0' });

    await page.waitForFunction(() => {
      return window.__neora?.world?.local !== undefined &&
             window.__neora?.cloudDashUI !== undefined;
    }, { timeout: 25000 });

    console.log('[QA] Logged in as nook, world spawned.');
    const neoraKeys = await page.evaluate(() => Object.keys(window.__neora || {}));
    console.log('[QA] window.__neora keys:', neoraKeys);

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

    // 4. Click Solo button (with fallback if needed)
    console.log('[QA] Clicking Solo button...');
    await page.waitForSelector('.hub-wrap:not([hidden]) [data-act="solo"]', { timeout: 10000 });
    await page.click('.hub-wrap:not([hidden]) [data-act="solo"]');

    // Check if root opens soon, fallback if needed
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
    openedRoot = true;
    console.log('[QA] #cloud-dash-root is visible!');

    // Screenshot 1: ~1s after visible (countdown)
    await sleep(1000);
    await page.screenshot({ path: shotPaths.shot1 });
    console.log(`[QA] Captured ${shotPaths.shot1}`);

    // 6. Wait for GO
    console.log('[QA] Waiting for GO (countdown end)...');
    await page.waitForFunction(() => {
      const cd = window.__neora?.cloudDashUI;
      if (!cd) return false;
      return cd.status === 'playing' || (cd.goAt && performance.now() >= cd.goAt);
    }, { timeout: 10000 });
    console.log('[QA] GO! Race active.');

    const goTime = Date.now();
    let lastSpace = 0;
    let lastTurn = 0;
    let lastUlt = 0;
    let laneLeft = true;

    let shot2Done = false;
    let shot3Done = false;
    let shot4Done = false;

    // Simulate play for ~25s after GO
    console.log('[QA] Simulating 25s race gameplay (Space 450ms, Left/Right 1.7s, KeyE 5s)...');
    while (Date.now() - goTime < 26000) {
      const now = Date.now();
      const elapsed = now - goTime;

      // Space every 450ms
      if (now - lastSpace >= 450) {
        await page.keyboard.press('Space');
        lastSpace = now;
      }

      // Left/Right every 1.7s
      if (now - lastTurn >= 1700) {
        await page.keyboard.press(laneLeft ? 'ArrowLeft' : 'ArrowRight');
        laneLeft = !laneLeft;
        lastTurn = now;
      }

      // KeyE every 5s
      if (now - lastUlt >= 5000) {
        await page.keyboard.press('KeyE');
        lastUlt = now;
      }

      // Track snapshot and maxS
      const snap = await extractRunnerSnapshot(page);
      if (snap.runner?.s > maxS) maxS = snap.runner.s;
      if (snap.runner?.finished) finished = true;

      // Screenshot 2 at +6s
      if (elapsed >= 6000 && !shot2Done) {
        shot2Done = true;
        await page.screenshot({ path: shotPaths.shot2 });
        logRunnerState('+6s (qa_cd_2_race.png)', snap);
        runnerLogs.push({ time: '+6s', screenshot: 'qa_cd_2_race.png', state: snap });
        console.log(`[QA] Captured ${shotPaths.shot2}`);
      }

      // Screenshot 3 at +15s
      if (elapsed >= 15000 && !shot3Done) {
        shot3Done = true;
        await page.screenshot({ path: shotPaths.shot3 });
        logRunnerState('+15s (qa_cd_3_race.png)', snap);
        runnerLogs.push({ time: '+15s', screenshot: 'qa_cd_3_race.png', state: snap });
        console.log(`[QA] Captured ${shotPaths.shot3}`);
      }

      // Screenshot 4 at +25s
      if (elapsed >= 25000 && !shot4Done) {
        shot4Done = true;
        await page.screenshot({ path: shotPaths.shot4 });
        logRunnerState('+25s (qa_cd_4_race.png)', snap);
        runnerLogs.push({ time: '+25s', screenshot: 'qa_cd_4_race.png', state: snap });
        console.log(`[QA] Captured ${shotPaths.shot4}`);
        break;
      }

      await sleep(40);
    }

    // 7. Keep pressing Space until .cd-results is visible or 110s pass
    console.log('[QA] Advancing to finish: pressing Space until .cd-results is visible (up to 110s)...');
    const postStart = Date.now();
    let lastSpacePost = 0;

    while (Date.now() - postStart < 110000) {
      const now = Date.now();
      if (now - lastSpacePost >= 450) {
        await page.keyboard.press('Space');
        lastSpacePost = now;
      }

      const snap = await extractRunnerSnapshot(page);
      if (snap.runner?.s > maxS) maxS = snap.runner.s;
      if (snap.runner?.finished) finished = true;

      resultsVisible = await page.evaluate(() => {
        const el = document.querySelector('.cd-results');
        return el && !el.hidden;
      });

      if (resultsVisible) {
        console.log(`[QA] .cd-results overlay is now visible! (${((Date.now() - postStart) / 1000).toFixed(1)}s elapsed)`);
        break;
      }

      await sleep(50);
    }

    // Screenshot 5: results overlay
    await sleep(500);
    await page.screenshot({ path: shotPaths.shot5 });
    console.log(`[QA] Captured ${shotPaths.shot5}`);

    // Results card text
    resultsCardText = await page.evaluate(() => {
      const card = document.querySelector('.cd-card') || document.querySelector('.cd-results');
      return card ? card.innerText.trim() : '';
    });
    console.log('\n--- Results Card Text ---');
    console.log(resultsCardText || '(no card text found)');

    // Final snapshot
    const finalSnap = await extractRunnerSnapshot(page);
    if (finalSnap.runner?.s > maxS) maxS = finalSnap.runner.s;
    if (finalSnap.runner?.finished) finished = true;

    // Deduplicated errors and warnings
    const dedupErrors = Array.from(new Set(errors));
    const dedupWarnings = Array.from(new Set(warnings));

    const summary = {
      opened: openedRoot,
      maxS: Math.round(maxS * 100) / 100,
      finished: finished,
      resultsShown: resultsVisible,
      errors: dedupErrors,
      'warnings count': warnings.length,
      warningsCount: warnings.length,
    };

    console.log('\n========================================');
    console.log('QA CLOUD DASH SUMMARY JSON:');
    console.log(JSON.stringify(summary, null, 2));
    console.log('========================================');

    console.log('\n--- Screenshots ---');
    for (const [k, v] of Object.entries(shotPaths)) {
      console.log(`${k}: ${v} (${fs.existsSync(v) ? 'EXISTS' : 'MISSING'})`);
    }

    console.log('\n--- Console Errors Count: ' + dedupErrors.length + ' ---');
    dedupErrors.forEach((e, idx) => console.log(`  [${idx + 1}] ${e}`));

    console.log('\n--- Console Warnings Count: ' + dedupWarnings.length + ' (Total raw: ' + warnings.length + ') ---');
    dedupWarnings.slice(0, 10).forEach((w, idx) => console.log(`  [${idx + 1}] ${w}`));
    if (dedupWarnings.length > 10) console.log(`  ... and ${dedupWarnings.length - 10} more`);

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
    console.log('[QA] Done.');
  }
}

main().then(() => {
  if (!process.exitCode) process.exit(0);
});
