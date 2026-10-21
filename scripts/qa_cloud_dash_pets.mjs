#!/usr/bin/env node
// scripts/qa_cloud_dash_pets.mjs — QA for Cloud Dash Pet Ride 4 unique family styles: pounce, flight, blink, surf
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
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'neora-cd-pets-qa-'));
  const dataFile = path.join(tmpDir, 'db.json');

  let srv = null;
  let browser = null;
  const consoleErrors = [];
  const consoleWarnings = [];
  const httpErrors = [];

  const styles = ['pounce', 'flight', 'blink', 'surf'];
  const shotPaths = {};
  for (const s of styles) {
    shotPaths[s] = path.join(SCRATCH, `qa_pet_${s}.png`);
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
    // For each style in ['pounce', 'flight', 'blink', 'surf']:
    // ----------------------------------------------------------------
    for (const style of styles) {
      console.log(`\n========================================`);
      console.log(`[QA] Testing Ride Style: ${style}`);
      console.log(`========================================`);

      // Keep runner position away from track end
      await page.evaluate(() => {
        const cd = window.__neora.cloudDashUI;
        if (cd.runner.s > 750) cd.runner.s = 50;
        cd.runner.finished = false;
      });

      // Set ride style and full bond
      console.log(`[QA] Setting cd.runner.rideStyle = '${style}'; cd.runner.bond = 100...`);
      await page.evaluate((st) => {
        const cd = window.__neora.cloudDashUI;
        cd.runner.rideStyle = st;
        cd.runner.bond = 100;
      }, style);

      // Wait 0.8 s
      await sleep(800);

      const rideCheck = await page.evaluate(() => {
        const cd = window.__neora.cloudDashUI;
        return {
          ride: cd.runner.ride,
          rideStyle: cd.runner.rideStyle,
          y: cd.runner.y,
          vy: cd.runner.vy,
          blink: cd.runner.blink,
          s: cd.runner.s,
        };
      });
      console.log(`[QA] At 0.8s: ride=${rideCheck.ride.toFixed(2)}s, style=${rideCheck.rideStyle}, y=${rideCheck.y.toFixed(2)}, blink=${rideCheck.blink}`);

      if (style === 'blink') {
        console.log('[QA] Pressing ArrowLeft, waiting 250ms, then ArrowRight...');
        await page.keyboard.press('ArrowLeft');
        await sleep(250);
        await page.keyboard.press('ArrowRight');
        await sleep(150);
      } else if (style === 'flight') {
        console.log('[QA] Waiting for breath event / plasma beam...');
        await page.waitForFunction(() => {
          const cd = window.__neora?.cloudDashUI;
          return cd && (cd.runner.breathT > 0 || cd.plasmaBeamPool?.some((b) => b.visible));
        }, { timeout: 2000 }).catch(() => null);
        await sleep(400);
      } else {
        await sleep(400);
      }

      // Capture screenshot at ~1.2s into the ride
      console.log(`[QA] Taking screenshot ${shotPaths[style]}...`);
      await page.screenshot({ path: shotPaths[style] });
      console.log(`[QA] Captured ${shotPaths[style]}`);

      // Verify what's in runtime state
      const postShot = await page.evaluate(() => {
        const cd = window.__neora.cloudDashUI;
        return {
          ride: cd.runner.ride,
          rideStyle: cd.runner.rideStyle,
          y: cd.runner.y,
          vy: cd.runner.vy,
          blink: cd.runner.blink,
          activeWisps: cd.localRig?._wisps?.filter((w) => w.visible).length || 0,
          surfWaveVis: cd.localRig?._surfWave?.visible || false,
          activeBeams: cd.plasmaBeamPool?.filter((b) => b.visible).length || 0,
          activeHeartWaves: cd.heartWavePool?.filter((h) => h.visible).length || 0,
          activeAfterimages: cd.afterimagePool?.filter((a) => a.visible).length || 0,
        };
      });
      console.log(`[QA] Post-shot state:`, JSON.stringify(postShot, null, 2));

      // Wait for ride to end before proceeding to next style
      console.log(`[QA] Waiting for ride to end (~6 s)...`);
      await page.waitForFunction(() => {
        const cd = window.__neora?.cloudDashUI;
        return cd && cd.runner.ride <= 0;
      }, { timeout: 10000 });
      console.log(`[QA] Ride ended for ${style}.`);
      await sleep(500);
    }

    console.log('\n========================================');
    console.log('[QA] All 4 styles tested successfully!');
    console.log(`[QA] Console Errors: ${consoleErrors.length}`);
    console.log(`[QA] HTTP >= 400 Errors: ${httpErrors.length}`);
    if (consoleErrors.length > 0) {
      console.log('[QA] Console error details:', consoleErrors);
    }
    if (httpErrors.length > 0) {
      console.log('[QA] HTTP error details:', httpErrors);
    }
    console.log('========================================');

    if (consoleErrors.length > 0 || httpErrors.length > 0) {
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('[QA FATAL ERROR]', err);
    process.exitCode = 1;
  } finally {
    if (browser) {
      try { await browser.close(); } catch {}
    }
    if (srv) {
      try { await srv.close(); } catch {}
    }
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
    console.log('[QA] Cleanup complete.');
  }
}

main();
