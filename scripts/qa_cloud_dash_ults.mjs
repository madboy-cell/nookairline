#!/usr/bin/env node
// scripts/qa_cloud_dash_ults.mjs — QA for Cloud Dash custom ULT skins + polished pet ride effects
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { startServer } from '../server/server.js';
import { COSTUME_DASH_ULTS } from '../shared/cloud_dash_rules.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 4317;
const SCRATCH = '/Users/thanapat/.gemini/antigravity/brain/981da782-26a6-44d8-aa87-d7a6a0aab0f3/scratch';
fs.mkdirSync(SCRATCH, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'neora-cd-ults-qa-'));
  const dataFile = path.join(tmpDir, 'db.json');

  let srv = null;
  let browser = null;
  const consoleErrors = [];
  const consoleWarnings = [];
  const httpErrors = [];

  const outfits = Object.keys(COSTUME_DASH_ULTS);

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

    function keepRaceAlive() {
      const tableMap = srv?.tables?.mgr?.tables || srv?.tables?.tables;
      if (tableMap) {
        for (const t of tableMap.values()) {
          if (t.cloudDash) {
            t.cloudDash.status = 'playing';
            t.cloudDash.firstFinishT = null;
            t.cloudDash.dnfAt = null;
            t.cloudDash.raceT = 10;
            if (t.cloudDash.racers) {
              for (const p of t.cloudDash.racers) {
                if (p.isBot && p.r) {
                  p.r.s = 20;
                  p.r.v = 5;
                  p.r.finished = false;
                }
              }
            }
          }
        }
      }
    }

    // ----------------------------------------------------------------
    // Representative set of outfits: test ULT visuals
    // ----------------------------------------------------------------
    for (const outfit of outfits) {
      console.log(`\n========================================`);
      console.log(`[QA] Testing ULT Skin: ${outfit}`);
      console.log(`========================================`);

      keepRaceAlive();

      // Keep runner position away from track end and reset camera
      await page.evaluate(() => {
        const cd = window.__neora.cloudDashUI;
        cd.status = 'playing';
        cd.runner.s = 60;
        cd.runner.v = 22;
        cd.runner.finished = false;
        cd.camPos = null;
        cd.camLook = null;
      });
      await sleep(250);

      // Set ultDef and queue ULT input
      console.log(`[QA] Setting ultDef for ${outfit} and firing ULT...`);
      await page.evaluate(async (id) => {
        const { ultDefFor } = await import('/shared/cloud_dash_rules.js');
        const cd = window.__neora.cloudDashUI;
        cd.runner.ultDef = ultDefFor(id);
        cd.runner.ultCharge = 100;
        cd.queue.ult = 1;
      }, outfit);

      // Wait ~0.7 s after firing
      await sleep(700);

      const ultCheck = await page.evaluate(() => {
        const cd = window.__neora.cloudDashUI;
        return {
          ult: cd.runner.ult,
          ultDef: cd.runner.ultDef?.name,
          auraVis: cd.localRig?._ultAura?.visible || false,
          auraSkin: cd.localRig?._currentUltSkin || null,
          bannerText: cd.el?.banner?.textContent || '',
          fovKick: cd.fovKick,
        };
      });
      console.log(`[QA] At ~0.7s: ult=${ultCheck.ult.toFixed(2)}s, def=${ultCheck.ultDef}, auraVis=${ultCheck.auraVis}, skin=${ultCheck.auraSkin}, banner="${ultCheck.bannerText}"`);

      // Screenshot qa_ult_<id>.png
      const shotPath = path.join(SCRATCH, `qa_ult_${outfit}.png`);
      console.log(`[QA] Taking screenshot ${shotPath}...`);
      await page.screenshot({ path: shotPath });
      console.log(`[QA] Captured ${shotPath}`);

      // Wait for ult end before next
      console.log('[QA] Waiting for ult to end...');
      keepRaceAlive();
      await page.waitForFunction(() => {
        const cd = window.__neora?.cloudDashUI;
        if (cd && cd.status === 'ended') cd.status = 'playing';
        return cd && cd.runner && cd.runner.ult <= 0;
      }, { timeout: 15000 });
      console.log(`[QA] ULT ended for ${outfit}.`);
      await sleep(400);
    }

    // ----------------------------------------------------------------
    // Polish Part A verification: Surf & Flight ride screenshots
    // ----------------------------------------------------------------
    console.log(`\n========================================`);
    console.log(`[QA] Testing Polished Pet Ride: Surf (qa_pet_surf2.png)`);
    console.log(`========================================`);

    keepRaceAlive();
    await page.evaluate(() => {
      const cd = window.__neora.cloudDashUI;
      cd.status = 'playing';
      cd.runner.s = 60;
      cd.runner.v = 22;
      cd.runner.finished = false;
      cd.camPos = null;
      cd.camLook = null;
      cd.runner.rideStyle = 'surf';
      cd.runner.bond = 100;
    });

    await sleep(800);
    const surfShotPath = path.join(SCRATCH, 'qa_pet_surf2.png');
    await page.screenshot({ path: surfShotPath });
    console.log(`[QA] Captured ${surfShotPath}`);

    keepRaceAlive();
    await page.waitForFunction(() => {
      const cd = window.__neora?.cloudDashUI;
      if (cd && cd.status === 'ended') cd.status = 'playing';
      return cd && cd.runner && cd.runner.ride <= 0;
    }, { timeout: 15000 });
    await sleep(400);

    console.log(`\n========================================`);
    console.log(`[QA] Testing Polished Pet Ride: Flight (qa_pet_flight2.png)`);
    console.log(`========================================`);

    keepRaceAlive();
    await page.evaluate(() => {
      const cd = window.__neora.cloudDashUI;
      cd.status = 'playing';
      cd.runner.s = 60;
      cd.runner.v = 22;
      cd.runner.finished = false;
      cd.camPos = null;
      cd.camLook = null;
      cd.runner.rideStyle = 'flight';
      cd.runner.bond = 100;
    });

    // screenshot ~0.25 s after ride start so the beam is visible
    await sleep(250);
    const flightShotPath = path.join(SCRATCH, 'qa_pet_flight2.png');
    await page.screenshot({ path: flightShotPath });
    console.log(`[QA] Captured ${flightShotPath}`);

    keepRaceAlive();
    await page.waitForFunction(() => {
      const cd = window.__neora?.cloudDashUI;
      if (cd && cd.status === 'ended') cd.status = 'playing';
      return cd && cd.runner && cd.runner.ride <= 0;
    }, { timeout: 15000 });

    console.log('\n========================================');
    console.log('[QA] All ULT skins & pet effects tested successfully!');
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
