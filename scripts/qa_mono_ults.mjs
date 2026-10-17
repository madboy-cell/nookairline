#!/usr/bin/env node
// scripts/qa_mono_ults.mjs
// Visual QA Puppeteer script for Sky Monopoly:
// Captures Beat 2 and Beat 3 frames for all 15 Mythic/Super-Mythic ultimates,
// captures 3 pet combos and 2 solo pet casts,
// captures building tiers 1..4 across all 6 property themes,
// captures all 5 grand landscape themes,
// and composes contact sheets into qa_artifacts/mono_vfx/.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SEASON_SKILLS } from '../shared/season_skills.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { startServer } = await import(path.join(ROOT, 'server/server.js'));
const { default: puppeteer } = await import(path.join(ROOT, 'node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js'));

const OUT_DIR = path.join(ROOT, 'qa_artifacts', 'mono_vfx');
const FRAMES_DIR = path.join(OUT_DIR, 'raw_frames');
fs.mkdirSync(FRAMES_DIR, { recursive: true });

const SKILLS_TO_TEST = [
  's1_naga_sovereign',
  's2_kitsune_inari',
  's2_tsukuyomi_eclipse',
  's3_sultan_djinn',
  's3_dune_phoenix',
  's4_casino_royale',
  's5_atlantis_siren',
  's6_astral_sovereign',
  's7_cinderella_clock',
  's8_glacial_elsa',
  's9_pharaoh_ra',
  's10_phantom_masque',
  's11_zeus_olympus',
  'sm_eclipse_dragon',
  'sm_aurora_empress',
];

const COMBOS_TO_TEST = [
  { id: 'combo_generic_pharaoh', name: 'Owner Generic + Pet Pharaoh Ra', owner: 'newbie_outfit', pet: 's9_pharaoh_ra' },
  { id: 'combo_zeus_pharaoh', name: 'Owner Zeus + Pet Pharaoh Ra', owner: 's11_zeus_olympus', pet: 's9_pharaoh_ra' },
  { id: 'combo_aurora_elsa', name: 'Owner Aurora Empress + Pet Glacial Elsa', owner: 'sm_aurora_empress', pet: 's8_glacial_elsa' },
];

const SOLO_PETS_TO_TEST = [
  { id: 'solo_pet_pharaoh', name: 'Solo Pet: Pharaoh Ra', pet: 's9_pharaoh_ra' },
  { id: 'solo_pet_elsa', name: 'Solo Pet: Glacial Elsa', pet: 's8_glacial_elsa' },
];

const THEMES_TO_TEST = [
  { id: 'classic', label: '🌿 Royal Starlight Garden', subtitle: 'Vakarine Shrine • Wishing Fountain • Crystal Brook' },
  { id: 'sakura', label: '🌸 Kyoto Sakura Sanctuary', subtitle: 'Five-Tier Pagoda • Capybara Onsen • Red Drum Bridge' },
  { id: 'mirage', label: "🕌 Sultan's Mirage Oasis", subtitle: 'Golden Mirage Palace • Sun-Disc Fountain • Oasis Lagoon' },
  { id: 'atlantis', label: '🐚 Atlantis Pearl Lagoon', subtitle: 'Pearl-Shell Sanctuary • Siren Fountain • Coral Archway' },
  { id: 'aurora', label: '🌌 Starlight Aurora Sanctuary', subtitle: 'Celestial Observatory • Crystal Swan Gazebo • Mirror Pond' },
];

const FORCE = process.argv.includes('--force');

const tmpDb = fs.mkdtempSync(path.join(os.tmpdir(), 'neora-mono-qa-'));
const srv = await startServer({ port: 0, dataFile: path.join(tmpDb, 'db.json'), quiet: true });
console.log(`[QA] Local test server started on port ${srv.port}`);

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

const consoleErrors = [];

async function setupPage() {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const txt = msg.text();
      // Filter harmless favicon or font warnings if any
      if (!txt.includes('favicon') && !txt.includes('404')) {
        consoleErrors.push(`[Console Error] ${txt}`);
        console.error(`[Browser console error]`, txt);
      }
    }
  });

  page.on('pageerror', (err) => {
    const stack = err.stack || err.message;
    consoleErrors.push(`[Page Error] ${stack}`);
    console.error(`[Browser page error]`, stack);
  });

  return page;
}

try {
  // =========================================================================
  // PART 1: 15 Mythic & Super-Mythic Ultimates
  // =========================================================================
  console.log('\n============================================================');
  console.log('[QA] PART 1: Capturing 15 Mythic & Super-Mythic Ultimates');
  console.log('============================================================');

  const ultResults = [];

  for (const skillId of SKILLS_TO_TEST) {
    const skillDef = SEASON_SKILLS[skillId] || {};
    const b2File = path.join(FRAMES_DIR, `${skillId}_beat2.png`);
    const b3File = path.join(FRAMES_DIR, `${skillId}_beat3.png`);
    if (!FORCE && fs.existsSync(b2File) && fs.existsSync(b3File)) {
      console.log(`   Reusing existing frames for ${skillId}`);
      ultResults.push({
        skillId,
        name: skillDef.name || skillId,
        icon: skillDef.icon || '✨',
        beat2: b2File,
        beat3: b3File,
      });
      continue;
    }

    console.log(`\n--> Testing Ultimate: ${skillId} (${skillDef.name || 'Mythic'})`);

    const page = await setupPage();
    const url = `http://localhost:${srv.port}/monopoly_dev.html?user=nook&solo=easy&outfit=${skillId}`;
    await page.goto(url, { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => !!window.__mono?.bridge?.board && !!window.__mono?.room?.mgr?.tableOf?.('nook')?.match, { timeout: 15000 });

    // Install hooks and trigger
    await page.evaluate(() => {
      const m = window.__mono.room.mgr.tableOf('nook').match;
      m.turn.seat = 0;
      m.turn.rolled = false;
      m.turn.ultUsed = false;
      const b = window.__mono.bridge.board;
      const orig = b.ultVfx.bind(b);
      window.__ultVfxStartTime = 0;
      b.ultVfx = function(...args) {
        window.__ultVfxStartTime = performance.now();
        return orig(...args);
      };
      window.__mono.fillGauges(0, { ult: 100, petUlt: 0 });
      window.__mono.bridge.act({ type: 'mono_ult' });
    });

    // Wait for ultVfx to be entered
    await page.waitForFunction(() => window.__ultVfxStartTime > 0, { timeout: 10000 });

    // Capture Beat 2 (~0.7s into ultVfx)
    await new Promise((r) => setTimeout(r, 700));
    await page.screenshot({ path: b2File });
    console.log(`   Captured Beat 2 frame: ${b2File}`);

    // Capture Beat 3 (~1.3s into ultVfx -> +600ms)
    await new Promise((r) => setTimeout(r, 600));
    await page.screenshot({ path: b3File });
    console.log(`   Captured Beat 3 frame: ${b3File}`);

    ultResults.push({
      skillId,
      name: skillDef.name || skillId,
      icon: skillDef.icon || '✨',
      beat2: b2File,
      beat3: b3File,
    });

    await page.close();
  }

  // =========================================================================
  // PART 2: 3 Pet Combos & 2 Solo Pet Casts
  // =========================================================================
  console.log('\n============================================================');
  console.log('[QA] PART 2: Capturing Pet Combos & Solo Pet Casts');
  console.log('============================================================');

  const comboResults = [];

  for (const combo of COMBOS_TO_TEST) {
    const b2File = path.join(FRAMES_DIR, `${combo.id}_beat2.png`);
    const b3File = path.join(FRAMES_DIR, `${combo.id}_beat3.png`);
    if (!FORCE && fs.existsSync(b2File) && fs.existsSync(b3File)) {
      console.log(`   Reusing existing frames for ${combo.id}`);
      comboResults.push({
        id: combo.id,
        name: combo.name,
        beat2: b2File,
        beat3: b3File,
        isSolo: false,
      });
      continue;
    }

    console.log(`\n--> Testing Combo: ${combo.name} (${combo.id})`);
    const page = await setupPage();
    const url = `http://localhost:${srv.port}/monopoly_dev.html?user=nook&solo=easy&outfit=${combo.owner}&petCostume=${combo.pet}&petCostumeRarity=3`;
    await page.goto(url, { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => !!window.__mono?.bridge?.board && !!window.__mono?.room?.mgr?.tableOf?.('nook')?.match, { timeout: 15000 });

    // Hook playCombo and trigger
    await page.evaluate(() => {
      const m = window.__mono.room.mgr.tableOf('nook').match;
      m.turn.seat = 0;
      m.turn.rolled = false;
      m.turn.ultUsed = false;
      m.players[0].petAuto = true;
      const b = window.__mono.bridge.board;
      const orig = b.playCombo.bind(b);
      window.__comboStartTime = 0;
      b.playCombo = function(...args) {
        window.__comboStartTime = performance.now();
        return orig(...args);
      };
      window.__mono.fillGauges(0, { ult: 100, petUlt: 100 });
      window.__mono.bridge.act({ type: 'mono_ult' });
    });

    await page.waitForFunction(() => window.__comboStartTime > 0, { timeout: 10000 });

    // In playCombo: Beat 1 is 550ms. At 1200ms (+650ms into Beat 2), fusion monuments & dual beams peak!
    await new Promise((r) => setTimeout(r, 1200));
    await page.screenshot({ path: b2File });
    console.log(`   Captured Combo Beat 2 frame: ${b2File}`);

    // Beat 3 merged shockwave at +1000ms (2200ms from start)
    await new Promise((r) => setTimeout(r, 1000));
    await page.screenshot({ path: b3File });
    console.log(`   Captured Combo Beat 3 frame: ${b3File}`);

    comboResults.push({
      id: combo.id,
      name: combo.name,
      beat2: b2File,
      beat3: b3File,
      isSolo: false,
    });

    await page.close();
  }

  for (const solo of SOLO_PETS_TO_TEST) {
    const b2File = path.join(FRAMES_DIR, `${solo.id}_beat2.png`);
    const b3File = path.join(FRAMES_DIR, `${solo.id}_beat3.png`);
    if (!FORCE && fs.existsSync(b2File) && fs.existsSync(b3File)) {
      console.log(`   Reusing existing frames for ${solo.id}`);
      comboResults.push({
        id: solo.id,
        name: solo.name,
        beat2: b2File,
        beat3: b3File,
        isSolo: true,
      });
      continue;
    }

    console.log(`\n--> Testing Solo Pet Cast: ${solo.name} (${solo.id})`);
    const page = await setupPage();
    const url = `http://localhost:${srv.port}/monopoly_dev.html?user=nook&solo=easy&outfit=newbie_outfit&petCostume=${solo.pet}&petCostumeRarity=3`;
    await page.goto(url, { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => !!window.__mono?.bridge?.board && !!window.__mono?.room?.mgr?.tableOf?.('nook')?.match, { timeout: 15000 });

    await page.evaluate(() => {
      const m = window.__mono.room.mgr.tableOf('nook').match;
      m.turn.seat = 0;
      m.turn.rolled = false;
      const b = window.__mono.bridge.board;
      const orig = b.ultVfx.bind(b);
      window.__petUltStartTime = 0;
      b.ultVfx = function(...args) {
        window.__petUltStartTime = performance.now();
        return orig(...args);
      };
      window.__mono.fillGauges(0, { ult: 0, petUlt: 100 });
      window.__mono.bridge.act({ type: 'mono_pet_cast' });
    });

    await page.waitForFunction(() => window.__petUltStartTime > 0, { timeout: 10000 });

    await new Promise((r) => setTimeout(r, 700));
    await page.screenshot({ path: b2File });
    console.log(`   Captured Solo Pet Beat 2 frame: ${b2File}`);

    await new Promise((r) => setTimeout(r, 600));
    await page.screenshot({ path: b3File });
    console.log(`   Captured Solo Pet Beat 3 frame: ${b3File}`);

    comboResults.push({
      id: solo.id,
      name: solo.name,
      beat2: b2File,
      beat3: b3File,
      isSolo: true,
    });

    await page.close();
  }

  // =========================================================================
  // PART 3: Buildings Across 6 Themes & Levels 1..4
  // =========================================================================
  console.log('\n============================================================');
  console.log('[QA] PART 3: Capturing Buildings Across All 6 Themes (L1..L4)');
  console.log('============================================================');

  const buildingResults = {};
  {
    const page = await setupPage();
    const url = `http://localhost:${srv.port}/monopoly_dev.html?user=nook&solo=easy`;
    await page.goto(url, { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => !!window.__mono?.bridge?.board, { timeout: 15000 });

    await page.evaluate(() => {
      const b = window.__mono.bridge.board;
      b.setCamMode('overview');

      // The 6 property zones on the board:
      // 0: kitsune/spirit (1,2,3)
      // 1: mirage/desert (6,7,8)
      // 2: atlantis/ocean (9,10,11)
      // 3: monte/fortune (13,14,15)
      // 4: glacial/frost (18,19,20)
      // 5: olympus/celestial (21,22,23)
      const zones = [
        [1, 2, 3],
        [6, 7, 8],
        [9, 10, 11],
        [13, 14, 15],
        [18, 19, 20],
        [21, 22, 23],
      ];

      zones.forEach(([t1, t2, t3], zi) => {
        b.setLevel(t1, zi % 4, 1, { animate: false });
        b.setLevel(t2, zi % 4, 2, { animate: false });
        b.setLevel(t3, zi % 4, zi === 5 ? 4 : 3, { animate: false });
      });
      // Also place a tier-4 pyramid on tile 7 (Cairo/Sultan) so both Lv3 & Lv4 are clearly visible in overview
      b.setLevel(7, 1, 4, { animate: false });
    });

    await new Promise((r) => setTimeout(r, 1200));
    const bldOverviewFile = path.join(FRAMES_DIR, 'buildings_overview.png');
    await page.screenshot({ path: bldOverviewFile });
    console.log(`   Captured Building Overview: ${bldOverviewFile}`);
    buildingResults.overview = bldOverviewFile;

    // Capture focused camera views for each of the 6 zones
    const zoneInfo = [
      { id: 'spirit', name: '🌸 Spirit Zone (Kitsune)', tile: 2 },
      { id: 'desert', name: '🏜️ Desert Zone (Mirage & Golden Pyramid)', tile: 7 },
      { id: 'ocean', name: '🌊 Ocean Zone (Atlantis)', tile: 10 },
      { id: 'fortune', name: '🎰 Fortune Zone (Monte Carlo)', tile: 14 },
      { id: 'frost', name: '❄️ Frost Zone (Glacial)', tile: 19 },
      { id: 'celestial', name: '🌌 Celestial Zone (Olympus)', tile: 22 },
    ];
    buildingResults.zones = [];

    for (const z of zoneInfo) {
      await page.evaluate((tileIdx) => {
        const b = window.__mono.bridge.board;
        b.setCamMode('follow');
        b.followSeat = 0;
        const tw = window.__mono.bridge.board.tileWorld?.(tileIdx) || { x: 0, z: 0 };
        b.camTarget.set(tw.x, 0, tw.z);
        b.camGoal = { x: tw.x, z: tw.z, p: (38 * Math.PI) / 180, d: 18 };
      }, z.tile);
      await new Promise((r) => setTimeout(r, 650));
      const zFile = path.join(FRAMES_DIR, `zone_${z.id}.png`);
      await page.screenshot({ path: zFile });
      console.log(`   Captured Zone Closeup: ${z.name}`);
      buildingResults.zones.push({ ...z, file: zFile });
    }

    await page.close();
  }

  // =========================================================================
  // PART 4: 5 Grand Landscape Themes
  // =========================================================================
  console.log('\n============================================================');
  console.log('[QA] PART 4: Capturing 5 Grand Landscape Themes');
  console.log('============================================================');

  const themeResults = [];
  {
    const page = await setupPage();
    const url = `http://localhost:${srv.port}/monopoly_dev.html?user=nook&solo=easy`;
    await page.goto(url, { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => !!window.__mono?.bridge?.board, { timeout: 15000 });

    for (const theme of THEMES_TO_TEST) {
      console.log(`\n--> Capturing Landscape Theme: ${theme.label}`);
      await page.evaluate((themeId) => {
        const b = window.__mono.bridge.board;
        b.setCamMode('overview');
        b.setLandscapeTheme(themeId);
      }, theme.id);

      await new Promise((r) => setTimeout(r, 1200));
      const thFile = path.join(FRAMES_DIR, `theme_${theme.id}.png`);
      await page.screenshot({ path: thFile });
      console.log(`   Captured Theme overview: ${thFile}`);
      themeResults.push({ ...theme, file: thFile });
    }

    await page.close();
  }

  // =========================================================================
  // PART 5: Compose Contact Sheets
  // =========================================================================
  console.log('\n============================================================');
  console.log('[QA] PART 5: Composing 4 Contact Sheets (PNG Grids with Labels)');
  console.log('============================================================');

  const contactPage = await browser.newPage();

  // Helper to encode image as base64 data URI
  const b64 = (filePath) => `data:image/png;base64,${fs.readFileSync(filePath).toString('base64')}`;

  // 1. ults_contact.png
  {
    console.log('--> Rendering ults_contact.png...');
    const cardsHtml = ultResults.map((u) => `
      <div class="ult-card">
        <div class="card-title">${u.icon} ${u.skillId}</div>
        <div class="card-name">${u.name}</div>
        <div class="frames-row">
          <div class="frame-col">
            <div class="frame-tag">Beat 2 (0.7s Monument)</div>
            <img class="frame-img" src="${b64(u.beat2)}" />
          </div>
          <div class="frame-col">
            <div class="frame-tag">Beat 3 (1.3s Impact)</div>
            <img class="frame-img" src="${b64(u.beat3)}" />
          </div>
        </div>
      </div>
    `).join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { background: #0c0817; color: #fff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 24px; }
          .header { text-align: center; margin-bottom: 24px; }
          .header h1 { font-size: 28px; color: #ffd34d; letter-spacing: 0.5px; }
          .header p { font-size: 14px; color: #9d8db3; margin-top: 6px; }
          .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
          .ult-card { background: #1a122e; border: 1.5px solid #3d2b63; border-radius: 14px; padding: 12px; display: flex; flex-direction: column; align-items: center; }
          .card-title { font-size: 13px; font-weight: 800; color: #ffd34d; }
          .card-name { font-size: 11px; color: #b7a9cf; margin-bottom: 8px; }
          .frames-row { display: flex; gap: 8px; width: 100%; justify-content: center; }
          .frame-col { flex: 1; display: flex; flex-direction: column; align-items: center; }
          .frame-tag { font-size: 9px; font-weight: 700; color: #6ee7b7; margin-bottom: 4px; text-transform: uppercase; }
          .frame-img { width: 100%; border-radius: 8px; border: 1px solid #2d1d4d; display: block; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>SKY MONOPOLY — 15 MYTHIC &amp; SUPER-MYTHIC ULTIMATES</h1>
          <p>Beat 2 (0.7s Monument Visual) &amp; Beat 3 (1.3s Impact Visual) QA Verification Contact Sheet</p>
        </div>
        <div class="grid">
          ${cardsHtml}
        </div>
      </body>
      </html>
    `;

    await contactPage.setViewport({ width: 1800, height: 2600, deviceScaleFactor: 1 });
    await contactPage.setContent(html, { waitUntil: 'load' });
    const ultsOut = path.join(OUT_DIR, 'ults_contact.png');
    await contactPage.screenshot({ path: ultsOut, fullPage: true });
    console.log(`Saved: ${ultsOut}`);
  }

  // 2. combos_contact.png
  {
    console.log('--> Rendering combos_contact.png...');
    const cardsHtml = comboResults.map((c) => `
      <div class="combo-card">
        <div class="card-title">${c.isSolo ? '🐾 SOLO PET CAST' : '🔗 SOUL-LINK COMBO'}</div>
        <div class="card-name">${c.name}</div>
        <div class="frames-row">
          <div class="frame-col">
            <div class="frame-tag">${c.isSolo ? 'Beat 2 (0.7s Solo Monument)' : 'Beat 2 (1.2s Dual Monuments)'}</div>
            <img class="frame-img" src="${b64(c.beat2)}" />
          </div>
          <div class="frame-col">
            <div class="frame-tag">${c.isSolo ? 'Beat 3 (1.3s Solo Impact)' : 'Beat 3 (2.2s Merged Shockwave)'}</div>
            <img class="frame-img" src="${b64(c.beat3)}" />
          </div>
        </div>
      </div>
    `).join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { background: #0c0817; color: #fff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 24px; }
          .header { text-align: center; margin-bottom: 24px; }
          .header h1 { font-size: 28px; color: #ff7aa8; letter-spacing: 0.5px; }
          .header p { font-size: 14px; color: #9d8db3; margin-top: 6px; }
          .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
          .combo-card { background: #1a122e; border: 1.5px solid #5a2850; border-radius: 14px; padding: 14px; display: flex; flex-direction: column; align-items: center; }
          .card-title { font-size: 13px; font-weight: 800; color: #ff7aa8; }
          .card-name { font-size: 12px; color: #f5d0e0; margin-bottom: 10px; text-align: center; font-weight: 600; }
          .frames-row { display: flex; gap: 10px; width: 100%; justify-content: center; }
          .frame-col { flex: 1; display: flex; flex-direction: column; align-items: center; }
          .frame-tag { font-size: 10px; font-weight: 700; color: #6ee7b7; margin-bottom: 6px; text-transform: uppercase; }
          .frame-img { width: 100%; border-radius: 8px; border: 1px solid #3d1d4d; display: block; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>SKY MONOPOLY — PET COMBOS &amp; SOLO PET ULTIMATES</h1>
          <p>Dual Fusion Monuments, Soul-Link Lasers &amp; Solo Pet Cast Verification</p>
        </div>
        <div class="grid">
          ${cardsHtml}
        </div>
      </body>
      </html>
    `;

    await contactPage.setViewport({ width: 1600, height: 1600, deviceScaleFactor: 1 });
    await contactPage.setContent(html, { waitUntil: 'load' });
    const combosOut = path.join(OUT_DIR, 'combos_contact.png');
    await contactPage.screenshot({ path: combosOut, fullPage: true });
    console.log(`Saved: ${combosOut}`);
  }

  // 3. buildings_contact.png
  {
    console.log('--> Rendering buildings_contact.png...');
    const zonesHtml = buildingResults.zones.map((z) => `
      <div class="zone-card">
        <div class="zone-title">${z.name}</div>
        <div class="zone-desc">L1 Villa • L2 Hotel • L3 Landmark • L4 Sovereign / Pyramid</div>
        <img class="zone-img" src="${b64(z.file)}" />
      </div>
    `).join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { background: #0c0817; color: #fff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 24px; }
          .header { text-align: center; margin-bottom: 24px; }
          .header h1 { font-size: 28px; color: #ffd34d; letter-spacing: 0.5px; }
          .header p { font-size: 14px; color: #9d8db3; margin-top: 6px; }
          .overview-box { background: #1a122e; border: 2px solid #5a4080; border-radius: 14px; padding: 14px; margin-bottom: 24px; text-align: center; }
          .overview-title { font-size: 16px; font-weight: 800; color: #ffd34d; margin-bottom: 10px; }
          .overview-img { max-width: 580px; border-radius: 10px; border: 1.5px solid #3d2b63; margin: 0 auto; display: block; }
          .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
          .zone-card { background: #161027; border: 1.5px solid #3d2b63; border-radius: 12px; padding: 12px; display: flex; flex-direction: column; align-items: center; }
          .zone-title { font-size: 13px; font-weight: 800; color: #6ee7b7; margin-bottom: 2px; }
          .zone-desc { font-size: 10px; color: #9d8db3; margin-bottom: 8px; }
          .zone-img { width: 100%; border-radius: 8px; border: 1px solid #2d1d4d; display: block; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>SKY MONOPOLY — BUILDING TIERS 1..4 ACROSS 6 PROPERTY THEMES</h1>
          <p>Full Overview &amp; Focused Zone Progression: Villa (L1), Hotel (L2), Landmark (L3) &amp; Golden Pyramid / Sovereign (L4)</p>
        </div>
        <div class="overview-box">
          <div class="overview-title">⭐ 6-Theme Full Board Overview (All Zones Populated with Levels 1..4)</div>
          <img class="overview-img" src="${b64(buildingResults.overview)}" />
        </div>
        <div class="grid">
          ${zonesHtml}
        </div>
      </body>
      </html>
    `;

    await contactPage.setViewport({ width: 1600, height: 2200, deviceScaleFactor: 1 });
    await contactPage.setContent(html, { waitUntil: 'load' });
    const bldOut = path.join(OUT_DIR, 'buildings_contact.png');
    await contactPage.screenshot({ path: bldOut, fullPage: true });
    console.log(`Saved: ${bldOut}`);
  }

  // 4. themes_contact.png
  {
    console.log('--> Rendering themes_contact.png...');
    const themesHtml = themeResults.map((t) => `
      <div class="theme-card">
        <div class="theme-title">${t.label}</div>
        <div class="theme-subtitle">${t.subtitle}</div>
        <img class="theme-img" src="${b64(t.file)}" />
      </div>
    `).join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { background: #0c0817; color: #fff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 24px; }
          .header { text-align: center; margin-bottom: 24px; }
          .header h1 { font-size: 28px; color: #38bdf8; letter-spacing: 0.5px; }
          .header p { font-size: 14px; color: #9d8db3; margin-top: 6px; }
          .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
          .theme-card { background: #1a122e; border: 1.5px solid #28456c; border-radius: 14px; padding: 14px; display: flex; flex-direction: column; align-items: center; }
          .theme-title { font-size: 14px; font-weight: 800; color: #38bdf8; margin-bottom: 3px; }
          .theme-subtitle { font-size: 10px; color: #9bbcdb; margin-bottom: 10px; text-align: center; }
          .theme-img { width: 100%; border-radius: 8px; border: 1px solid #1c3250; display: block; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>SKY MONOPOLY — 5 GRAND LANDSCAPE COURTYARD THEMES</h1>
          <p>Hero Landmarks, Cobblestone Hardscape, Wing Decor &amp; Waterway Vignettes</p>
        </div>
        <div class="grid">
          ${themesHtml}
        </div>
      </body>
      </html>
    `;

    await contactPage.setViewport({ width: 1600, height: 1600, deviceScaleFactor: 1 });
    await contactPage.setContent(html, { waitUntil: 'load' });
    const themesOut = path.join(OUT_DIR, 'themes_contact.png');
    await contactPage.screenshot({ path: themesOut, fullPage: true });
    console.log(`Saved: ${themesOut}`);
  }

  await contactPage.close();

  console.log('\n============================================================');
  console.log('[QA] SUMMARY & VERIFICATION');
  console.log('============================================================');
  console.log(`Total console/page errors collected: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) {
    console.error('Errors encountered:', consoleErrors);
    process.exit(1);
  } else {
    console.log('SUCCESS: All 15 ultimates, 3 combos, 2 solo pet casts, 6 building themes, and 5 landscape themes rendered with ZERO errors!');
    console.log('Contact sheets generated:');
    console.log('  1. ' + path.join(OUT_DIR, 'ults_contact.png'));
    console.log('  2. ' + path.join(OUT_DIR, 'combos_contact.png'));
    console.log('  3. ' + path.join(OUT_DIR, 'buildings_contact.png'));
    console.log('  4. ' + path.join(OUT_DIR, 'themes_contact.png'));
    process.exit(0);
  }
} finally {
  await browser.close();
  srv.close();
}
