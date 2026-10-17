#!/usr/bin/env node
// scripts/smoke_phase5.js — Phase 5 live smoke test
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { startServer } from '../server/server.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SHOTS = path.join(ROOT, 'qa_artifacts', 'phase5');
fs.mkdirSync(SHOTS, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run() {
  console.log('🚀 Starting Neora World V2 server on port 4005...');
  const srv = await startServer({ port: 4005, quiet: true });

  const errors = [];
  const logError = (msg) => {
    // Ignore harmless favicon or webgl warnings if any
    if (msg.includes('favicon.ico')) return;
    errors.push(msg);
  };

  console.log('🌐 Launching Chrome (390x844)...');
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: [
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--ignore-gpu-blocklist',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });

  page.on('pageerror', (err) => {
    console.error('  [pageerror]', err.message);
    logError(`PAGE: ${err.message}`);
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.error('  [console.error]', msg.text());
      logError(`CONSOLE: ${msg.text()}`);
    }
  });

  const results = {};

  try {
    console.log('🔑 Logging in as nook...');
    await page.goto('http://localhost:4005/?dev=1&user=nook&pass=1234', { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => window.__neora?.world?.local !== undefined, { timeout: 15000 });
    console.log('✅ Logged in as nook, world spawned.');
    await sleep(1500);

    // -------------------------------------------------------------------------
    // Step (a): Town Hall dock -> confirm townhall scene + radar, walk near fountain -> #landmark-prompt
    // -------------------------------------------------------------------------
    console.log('\n--- Step (a): Town Hall dock, radar, fountain landmark prompt ---');
    await page.evaluate(() => {
      document.querySelector('.dock-btn[data-dock="townhall"]')?.click();
    });

    await page.waitForFunction(() => {
      const thActive = window.__neora?.world?._townhallMode;
      const thRoot = window.__neora?.world?.scene?.getObjectByName('townhall_root');
      const radarEl = document.getElementById('hud-mini-radar');
      return thActive && thRoot?.visible && radarEl && !radarEl.hidden;
    }, { timeout: 8000 });
    console.log('✅ Town Hall scene active, townhall_root visible, radar visible');

    // Walk near fountain (0, 0) — player spawns at (0, 6)
    await page.evaluate(() => {
      window.__neora.world.walkTo(0, 1.2);
    });

    await page.waitForFunction(() => {
      const prompt = document.getElementById('landmark-prompt');
      return prompt && !prompt.hidden && prompt.dataset.landmark === 'fountain';
    }, { timeout: 10000 });
    console.log('✅ Walked near fountain, #landmark-prompt visible with fountain!');

    const shotA = path.join(SHOTS, '01_townhall_fountain.png');
    await page.screenshot({ path: shotA });
    results.stepA = { ok: true, screenshot: shotA };

    // -------------------------------------------------------------------------
    // Step (b): Hall of Fame -> hall_list rows render, worship succeeds once then disabled
    // -------------------------------------------------------------------------
    console.log('\n--- Step (b): Hall of Fame modal, leaderboard rows, worship once ---');
    await page.evaluate(() => {
      window.__neora.hallOfFameUI.open('statue_1');
    });

    await page.waitForFunction(() => {
      const modal = document.getElementById('hall-of-fame-modal');
      const rows = modal?.querySelectorAll('.hall-row');
      return modal && !modal.hidden && rows && rows.length > 0;
    }, { timeout: 6000 });
    console.log('✅ Hall of Fame modal open, hall_list rows rendered');

    // Click worship button
    await page.evaluate(() => {
      const btn = document.querySelector('[data-act="hall-worship"]');
      btn?.click();
    });

    await page.waitForFunction(() => {
      const btn = document.querySelector('[data-act="hall-worship"]');
      return btn && btn.disabled;
    }, { timeout: 6000 });
    console.log('✅ Worship succeeded, button is now disabled!');

    const shotB = path.join(SHOTS, '02_hall_of_fame_worshipped.png');
    await page.screenshot({ path: shotB });
    results.stepB = { ok: true, screenshot: shotB };

    // Close Hall of Fame
    await page.evaluate(() => {
      window.__neora.hallOfFameUI.close();
    });
    await sleep(500);

    // -------------------------------------------------------------------------
    // Step (c): Table Hub Casino tab -> solo Pok-Deng -> bet 100 in betting phase -> wait cycle -> casino_result
    // -------------------------------------------------------------------------
    console.log('\n--- Step (c): Table Hub -> Solo Pok-Deng, bet 100, wait cycle ---');
    await page.evaluate(() => {
      document.querySelector('.dock-btn[data-dock="play"]')?.click();
    });
    await page.waitForSelector('.hub-wrap:not([hidden])', { timeout: 5000 });

    // Switch to casino tab
    await page.evaluate(() => {
      document.querySelector('[data-tab="casino"]')?.click();
    });
    await sleep(400);

    // Start Solo Pok-Deng
    const goldBeforePokdeng = await page.evaluate(() => window.__neora.state.profile.gold);
    await page.evaluate(() => {
      document.querySelector('[data-act="solo"]')?.click();
    });

    await page.waitForSelector('#casino-root:not([hidden])', { timeout: 6000 });
    console.log('✅ #casino-root visible in Pok-Deng');

    // Wait for betting phase
    await page.waitForFunction(() => {
      const fill = document.getElementById('casino-phase');
      const chip = document.querySelector('.casino-chip[data-chip="100"]');
      return fill?.textContent?.includes('BETTING') && chip && !chip.disabled;
    }, { timeout: 15000 });

    // Place bet 100
    await page.evaluate(() => {
      document.querySelector('.casino-chip[data-chip="100"]')?.click();
    });
    console.log('✅ Placed 100 chip bet in betting phase');

    // Wait for settle/result (action -> dealer -> result, ~12s cycle)
    await page.waitForFunction(() => {
      return window.__lastCasinoResult?.game === 'pokdeng' || document.querySelector('.casino-settle') !== null;
    }, { timeout: 25000 });

    const goldAfterPokdeng = await page.evaluate(() => window.__neora.state.profile.gold);
    console.log(`✅ Pok-Deng cycle completed! Gold before: ${goldBeforePokdeng}, after: ${goldAfterPokdeng}`);

    const shotC = path.join(SHOTS, '03_pokdeng_result.png');
    await page.screenshot({ path: shotC });
    results.stepC = { ok: true, goldBefore: goldBeforePokdeng, goldAfter: goldAfterPokdeng, screenshot: shotC };

    // Exit Pok-Deng
    await page.evaluate(() => {
      document.querySelector('.casino-btn[data-act="exit"]')?.click();
    });
    await sleep(600);

    // -------------------------------------------------------------------------
    // Step (d): Roulette solo: place red 100, wait cycle -> result
    // -------------------------------------------------------------------------
    console.log('\n--- Step (d): Table Hub -> Solo Roulette, place red 100, wait cycle ---');
    await page.evaluate(() => {
      document.querySelector('.dock-btn[data-dock="play"]')?.click();
    });
    await page.waitForSelector('.hub-wrap:not([hidden])', { timeout: 5000 });

    await page.evaluate(() => {
      document.querySelector('[data-tab="casino"]')?.click();
    });
    await sleep(400);

    // Select roulette game
    await page.evaluate(() => {
      document.querySelector('[data-casino-game="roulette"]')?.click();
    });
    await sleep(300);

    // Start solo roulette
    await page.evaluate(() => {
      document.querySelector('[data-act="solo"]')?.click();
    });

    await page.waitForSelector('#casino-root:not([hidden])', { timeout: 10000 });
    console.log('✅ #casino-root visible in Roulette');

    // Wait for betting phase in roulette
    await page.waitForFunction(() => {
      const fill = document.getElementById('casino-phase');
      const redSpot = document.querySelector('[data-bet-type="red"]');
      return fill?.textContent?.includes('BETTING') && redSpot !== null;
    }, { timeout: 18000 });

    // Select chip 100 and click red spot
    await page.evaluate(() => {
      document.querySelector('.casino-chip[data-chip="100"]')?.click();
      document.querySelector('[data-bet-type="red"]')?.click();
    });
    console.log('✅ Placed red 100 bet on roulette wheel');

    // Wait for spin -> result phase (~15s)
    await page.waitForFunction(() => {
      const phase = document.getElementById('casino-phase')?.textContent || '';
      return window.__lastCasinoResult?.game === 'roulette' || phase.includes('RESULT') || document.querySelector('.roulette-hist-badge') !== null;
    }, { timeout: 25000 });
    console.log('✅ Roulette cycle resolved, result phase reached!');

    const shotD = path.join(SHOTS, '04_roulette_result.png');
    await page.screenshot({ path: shotD });
    results.stepD = { ok: true, screenshot: shotD };

    // Exit Roulette
    await page.evaluate(() => {
      document.querySelector('.casino-btn[data-act="exit"]')?.click();
    });
    await sleep(600);

    // -------------------------------------------------------------------------
    // Step (e): Bag tab: passport card renders; founder claim works once for nook
    // -------------------------------------------------------------------------
    console.log('\n--- Step (e): Bag tab -> passport card, founder claim once ---');
    await page.evaluate(() => {
      window.__neora?.rpg?.open('wardrobe', { tab: 'bag' });
    });
    await sleep(500);

    // Verify passport card renders
    await page.waitForSelector('#passport-card', { timeout: 6000 });
    await page.evaluate(() => {
      document.getElementById('passport-card')?.scrollIntoView({ behavior: 'instant', block: 'center' });
    });
    await sleep(300);
    console.log('✅ Passport card is rendered in the Bag tab');

    const shotE1 = path.join(SHOTS, '05_passport_card.png');
    await page.screenshot({ path: shotE1 });
    results.stepE_passport = { ok: true, screenshot: shotE1 };

    // Open founder modal
    await page.evaluate(() => {
      document.querySelector('[data-act="open-founder"]')?.click();
    });
    await page.waitForSelector('#founder-modal:not([hidden])', { timeout: 5000 });
    console.log('✅ Founder modal opened');

    // Click founder claim button
    await page.evaluate(() => {
      document.querySelector('[data-act="founder-claim"]')?.click();
    });

    // Verify founder claim disabled
    await page.waitForFunction(() => {
      const btn = document.querySelector('[data-act="founder-claim"]');
      return btn && btn.disabled;
    }, { timeout: 6000 });
    console.log('✅ Founder claim succeeded and button is now disabled!');

    const shotE2 = path.join(SHOTS, '06_founder_claimed.png');
    await page.screenshot({ path: shotE2 });
    results.stepE_founder = { ok: true, screenshot: shotE2 };

  } finally {
    await browser.close();
    await srv.close();
  }

  console.log('\n=========================================');
  console.log('📊 Smoke Test Summary:');
  console.log('Step (a) Town Hall & Fountain:', results.stepA?.ok ? 'PASS' : 'FAIL');
  console.log('Step (b) Hall of Fame & Worship:', results.stepB?.ok ? 'PASS' : 'FAIL');
  console.log('Step (c) Solo Pok-Deng:', results.stepC?.ok ? 'PASS' : 'FAIL');
  console.log('Step (d) Solo Roulette:', results.stepD?.ok ? 'PASS' : 'FAIL');
  console.log('Step (e) Passport & Founder Claim:', results.stepE_founder?.ok ? 'PASS' : 'FAIL');
  console.log('Console/Page Errors count:', errors.length);
  if (errors.length) {
    console.log('Errors:', errors);
  }
  console.log('=========================================');

  if (errors.length > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Smoke test failed:', err);
  process.exit(1);
});
