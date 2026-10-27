#!/usr/bin/env node
// scripts/shoot_skill_vfx.mjs — Headless 3D Effekseer 20-Skill & 9-Combo Contact-Sheet Renderer & 10-Player Benchmark.
// Usage:
//   node scripts/shoot_skill_vfx.mjs --skills
//   node scripts/shoot_skill_vfx.mjs --combos
//   node scripts/shoot_skill_vfx.mjs /tmp/effekseer_all_20_skills_5x4.png --skills
//   node scripts/shoot_skill_vfx.mjs /tmp/effekseer_class_combos_3x3.png --combos
//   node scripts/shoot_skill_vfx.mjs /tmp/pollen.png sk_pollen_ring
//   node scripts/shoot_skill_vfx.mjs --bench-10p

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { SKILL_VFX_DEFS } from '../shared/skill_vfx_defs.js';

const DEFAULT_QA_DIR = '/Users/thanapat/.gemini/antigravity/brain/d838a442-5d16-4af4-a0dc-9a76cd85c51d/qa_vfx_v2';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { startServer } = await import(path.join(ROOT, 'server/server.js'));
const { default: puppeteer } = await import(path.join(ROOT, 'node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js'));

function buildSixPhases(vfxId) {
  const rec = SKILL_VFX_DEFS[vfxId];
  if (!rec) throw new Error(`Unknown vfxId: ${vfxId}`);
  const pk = rec.effekseer?.peakMs || 600;
  const t1 = Math.max(80, Math.round(pk * 0.30));
  const t2 = Math.max(t1 + 80, Math.round(pk * 0.65));
  const t3 = pk;
  const t4 = Math.round(pk * 1.25);
  const t5 = Math.round(pk * 1.55);
  const t6 = Math.round(pk * 1.90);
  return [
    { elapsedMs: t1, walkInside: false, badge: `1. Cast Start (${(t1 / 1000).toFixed(2)}s)` },
    { elapsedMs: t2, walkInside: false, badge: `2. Surge Build (${(t2 / 1000).toFixed(2)}s)` },
    { elapsedMs: t3, walkInside: false, badge: `3. Peak 3D Burst (${(t3 / 1000).toFixed(2)}s)` },
    { elapsedMs: t4, walkInside: true, badge: `4. Walk Readability (${(t4 / 1000).toFixed(2)}s)` },
    { elapsedMs: t5, walkInside: false, badge: `5. Sustain Aura (${(t5 / 1000).toFixed(2)}s)` },
    { elapsedMs: t6, walkInside: false, badge: `6. Fade Tail (${(t6 / 1000).toFixed(2)}s)` },
  ];
}

function stitchGrid(buffers, cols, rows, cellW, cellH, gap = 6) {
  const outW = cols * cellW + (cols + 1) * gap;
  const outH = rows * cellH + (rows + 1) * gap;
  const out = new PNG({ width: outW, height: outH });
  for (let i = 0; i < out.data.length; i += 4) {
    out.data[i] = 18;
    out.data[i + 1] = 24;
    out.data[i + 2] = 28;
    out.data[i + 3] = 255;
  }
  buffers.forEach((buf, idx) => {
    const src = PNG.sync.read(Buffer.from(buf));
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const ox = gap + col * (cellW + gap);
    const oy = gap + row * (cellH + gap);
    const copyW = Math.min(cellW, src.width);
    const copyH = Math.min(cellH, src.height);
    for (let y = 0; y < copyH; y++) {
      for (let x = 0; x < copyW; x++) {
        const si = (y * src.width + x) * 4;
        const di = ((oy + y) * outW + (ox + x)) * 4;
        out.data[di] = src.data[si];
        out.data[di + 1] = src.data[si + 1];
        out.data[di + 2] = src.data[si + 2];
        out.data[di + 3] = 255;
      }
    }
  });
  return PNG.sync.write(out);
}

const args = process.argv.slice(2);
const runBench = args.includes('--bench-10p');
const runCombos = args.includes('--combos');
const runSkills = args.includes('--skills');
const dirIdx = args.indexOf('--dir');
const outDir = dirIdx >= 0 ? args[dirIdx + 1] : null;
const cleanArgs = args.filter(
  (a, i) =>
    a !== '--bench-10p' &&
    a !== '--combos' &&
    a !== '--skills' &&
    a !== '--dir' &&
    (dirIdx < 0 || i !== dirIdx + 1)
);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'neora-vfx-'));
const srv = await startServer({ port: 0, dataFile: path.join(tmp, 'db.json'), quiet: true });
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

const CELL_W = 560;
const CELL_H = 380;
const DPR = runCombos ? 2 : runSkills ? 1.5 : 1;
const SCALED_W = Math.round(CELL_W * DPR);
const SCALED_H = Math.round(CELL_H * DPR);
const SCALED_GAP = Math.round(6 * DPR);

try {
  const page = await browser.newPage();
  await page.setViewport({ width: CELL_W, height: CELL_H, deviceScaleFactor: DPR });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errs.push(m.text());
  });

  await page.goto(`http://localhost:${srv.port}/?dev=1&vfx=1`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => window.__vfxStudio?.ready === true, { timeout: 20000 });
  await new Promise((r) => setTimeout(r, 450));

  if (runCombos) {
    const outPath =
      cleanArgs.find((a) => a.endsWith('.png')) ||
      path.join(outDir || DEFAULT_QA_DIR, 'effekseer_class_combos_3x3.png');
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    const comboSpecs = [
      { id: 'combo_melee_1', biome: 'meadow', dummySpriteKey: 'sf_mob_thornback_boar', dummyPos: { x: 1.95, z: 0.45 }, topBadge: '⚔️ Melee Class · Hit 1/3 (1.00× DMG)' },
      { id: 'combo_melee_2', biome: 'reef', dummySpriteKey: 'sf_mob_sakura_kitsune', dummyPos: { x: 2.00, z: 0.45 }, topBadge: '⚔️ Melee Class · Hit 2/3 (Kitsune Katana · 1.16× DMG)' },
      { id: 'combo_melee_3', biome: 'caldera', dummySpriteKey: 'sf_mob_star_gargoyle', dummyPos: { x: 2.15, z: 0.50 }, topBadge: '⚔️ Melee Finisher · Hit 3/3 (Bahamut Greatsword · 1.52× + Stun)' },
      { id: 'combo_ranged_1', biome: 'meadow', dummySpriteKey: 'sf_mob_zephyr_hare', dummyPos: { x: 3.45, z: 0.75 }, topBadge: '🏹 Ranged Class · Hit 1/3 (7.8m Range + Arrow)' },
      { id: 'combo_ranged_2', biome: 'reef', dummySpriteKey: 'sf_mob_cloud_crane', dummyPos: { x: 3.45, z: 0.75 }, topBadge: '🏹 Ranged Class · Hit 2/3 (Blossom Greatbow · Sonic Arrow)' },
      { id: 'combo_ranged_3', biome: 'caldera', dummySpriteKey: 'sf_mob_arc_automaton', dummyPos: { x: 3.45, z: 0.75 }, topBadge: '🏹 Ranged Finisher · Hit 3/3 (Astrolabe Wing-Bow · Twin Volley)' },
      { id: 'combo_magic_1', biome: 'hollow', dummySpriteKey: 'sf_mob_frost_shroom', dummyPos: { x: 3.40, z: 0.75 }, topBadge: '🪄 Magic Class · Hit 1/3 (6.5m Astral Projectile)' },
      { id: 'combo_magic_2', biome: 'reef', dummySpriteKey: 'sf_mob_bell_spirit', dummyPos: { x: 3.40, z: 0.75 }, topBadge: '🪄 Magic Class · Hit 2/3 (Nine-Tail Kagura · Amethyst Bolt)' },
      { id: 'combo_magic_3', biome: 'caldera', dummySpriteKey: 'sf_mob_chrono_sentinel', dummyPos: { x: 3.40, z: 0.75 }, topBadge: '🪄 Magic Finisher · Hit 3/3 (Solar Scepter · Comet + Party Heal)' },
    ];
    const bufs = [];
    for (const sp of comboSpecs) {
      const rec = SKILL_VFX_DEFS[sp.id];
      await page.evaluate(async (cfg) => window.__vfxStudio.renderAt(cfg), {
        vfxId: sp.id,
        biome: sp.biome || 'meadow',
        elapsedMs: rec?.effekseer?.peakMs || 250,
        dummySpriteKey: sp.dummySpriteKey,
        dummyPos: sp.dummyPos,
        topBadge: sp.topBadge,
        badge: rec?.label || sp.id,
      });
      await new Promise((r) => setTimeout(r, 85));
      bufs.push(await page.screenshot({ type: 'png' }));
    }
    fs.writeFileSync(outPath, stitchGrid(bufs, 3, 3, SCALED_W, SCALED_H, SCALED_GAP));
    console.log(`saved combos 3x3 -> ${outPath}`);
  }

  if (runSkills) {
    const outPath =
      cleanArgs.find((a) => a.endsWith('.png')) ||
      path.join(outDir || DEFAULT_QA_DIR, 'effekseer_all_20_skills_5x4.png');
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    const skillSpecs = [
      // Row 1 — 🌲 Whispering Meadow (5)
      {
        id: 'sk_pollen_ring',
        biome: 'meadow',
        dummySpriteKey: 'sf_mob_pollen_wisp',
        dummyWidth: 1.55,
        dummyPos: { x: 3.45, z: 0.65 },
        camTarget: { x: 0.85, z: 0.35, dist: 15.0 },
        topBadge: '🌲 Meadow 1/5 · Drop: Pollen Wisp (2% / ⭐Alpha 8%)',
        badge: '🌸 Golden Pollen Sanctuary · 4.4m Party Heal Seal',
      },
      {
        id: 'sk_jelly_shield',
        biome: 'meadow',
        dummySpriteKey: 'sf_mob_moss_slime',
        dummyWidth: 1.50,
        dummyPos: { x: 3.35, z: 0.65 },
        camTarget: { x: 0.85, z: 0.35, dist: 14.8 },
        topBadge: '🌲 Meadow 2/5 · Drop: Moss Slime (2% / ⭐Alpha 8%)',
        badge: '🫧 Dewdrop Aqua Canopy · 3D Bubble Shield + 40% Slow',
      },
      {
        id: 'sk_zephyr_vault',
        biome: 'meadow',
        dummySpriteKey: 'sf_mob_zephyr_hare',
        dummyWidth: 1.55,
        dummyPos: { x: 3.45, z: 0.75 },
        camTarget: { x: 1.25, z: 0.35, dist: 14.9 },
        topBadge: '🌲 Meadow 3/5 · Drop: Zephyr Hare (2% / ⭐Alpha 8%)',
        badge: '🍃 Zephyr Backstep Volley · Wind Shot + 3.4m Backflip',
      },
      {
        id: 'sk_tusk_rush',
        biome: 'meadow',
        dummySpriteKey: 'sf_mob_thornback_boar',
        dummyWidth: 1.75,
        dummyPos: { x: 4.70, z: 0.85 },
        camTarget: { x: 1.95, z: 0.35, dist: 15.2 },
        topBadge: '🌲 Meadow 4/5 · Drop: Thornback Boar (2% / ⭐Alpha 8%)',
        badge: '💨 Gale-Tusk Spiral Charge · 5.2m Drill Dash + Stun',
      },
      {
        id: 'sk_earthshatter',
        biome: 'meadow',
        dummySpriteKey: 'sf_boss_moss_golem',
        dummyWidth: 2.55,
        dummyPos: { x: 3.95, z: 0.45 },
        camTarget: { x: 1.05, z: 0.35, dist: 15.8 },
        topBadge: '👑 Meadow Boss 5/5 · Elder Moss Golem (10% × 🍀)',
        badge: '🌲 Ancient Megalith Quake · 4.8m Boulder Crater + Stun',
      },

      // Row 2 — 💎 Crystal Hollow (5)
      {
        id: 'sk_crystal_fan',
        biome: 'hollow',
        dummySpriteKey: 'sf_mob_crystal_beetle',
        dummyWidth: 1.65,
        dummyPos: { x: 3.45, z: 0.80 },
        camTarget: { x: 1.35, z: 0.35, dist: 14.8 },
        topBadge: '💎 Hollow 1/5 · Drop: Crystal Beetle (2% / ⭐Alpha 8%)',
        badge: '💎 Prism Shard Volley · 62° Cone Crystal Shatter',
      },
      {
        id: 'sk_echo_drain',
        biome: 'hollow',
        dummySpriteKey: 'sf_mob_lantern_bat',
        dummyWidth: 1.60,
        dummyPos: { x: 3.30, z: 0.65 },
        camTarget: { x: 0.85, z: 0.35, dist: 14.8 },
        topBadge: '💎 Hollow 2/5 · Drop: Lantern Bat (2% / ⭐Alpha 8%)',
        badge: '🦇 Crimson Lantern Siphon · 3.8m Vortex + 25% HP Leech',
      },
      {
        id: 'sk_frost_nova',
        biome: 'hollow',
        dummySpriteKey: 'sf_mob_frost_shroom',
        dummyWidth: 1.60,
        dummyPos: { x: 3.25, z: 0.65 },
        camTarget: { x: 0.85, z: 0.35, dist: 14.9 },
        topBadge: '💎 Hollow 3/5 · Drop: Frost Shroom (2% / ⭐Alpha 8%)',
        badge: '❄️ Permafrost Spore Nova · 4.5m Flash-Freeze Ring',
      },
      {
        id: 'sk_gravity_spin',
        biome: 'hollow',
        dummySpriteKey: 'sf_mob_quartz_golemling',
        dummyWidth: 1.65,
        dummyPos: { x: 3.35, z: 0.65 },
        camTarget: { x: 0.85, z: 0.35, dist: 14.9 },
        topBadge: '💎 Hollow 4/5 · Drop: Quartz Golemling (2% / ⭐Alpha 8%)',
        badge: '🪨 Astral Mandala Vortex · 3D Rune Orbitals + Pull',
      },
      {
        id: 'sk_prism_beam',
        biome: 'hollow',
        dummySpriteKey: 'sf_boss_crystal_weaver',
        dummyWidth: 2.65,
        dummyPos: { x: 4.05, z: 0.65 },
        camTarget: { x: 1.65, z: 0.45, dist: 16.6 },
        topBadge: '👑 Hollow Boss 5/5 · Crystal Weaver (10% × 🍀)',
        badge: '🕸️ Celestial Prism Ray · Hexagram Seal + 9.5m Laser',
      },

      // Row 3 — 🌸 Celestial Sakura Reef (5)
      {
        id: 'sk_foxfire_wisps',
        biome: 'reef',
        dummySpriteKey: 'sf_mob_sakura_kitsune',
        dummyWidth: 1.65,
        dummyPos: { x: 3.45, z: 0.75 },
        camTarget: { x: 1.30, z: 0.35, dist: 14.9 },
        topBadge: '🌸 Reef 1/5 · Drop: Shrine Kitsune (2% / ⭐Alpha 8%)',
        badge: '🔥 Nine-Shrine Foxfire Orbs · Homing Rose-Flame Burst',
      },
      {
        id: 'sk_mirror_shell',
        biome: 'reef',
        dummySpriteKey: 'sf_mob_pearl_snapper',
        dummyWidth: 1.75,
        dummyPos: { x: 3.35, z: 0.65 },
        camTarget: { x: 0.85, z: 0.35, dist: 14.9 },
        topBadge: '🌸 Reef 2/5 · Drop: Pearl Snapper (2% / ⭐Alpha 8%)',
        badge: '🛡️ Tide-Mirror Carapace · Pearl Shield + 45% Reflect',
      },
      {
        id: 'sk_tailwind_gale',
        biome: 'reef',
        dummySpriteKey: 'sf_mob_cloud_crane',
        dummyWidth: 1.80,
        dummyPos: { x: 3.40, z: 0.65 },
        camTarget: { x: 0.85, z: 0.35, dist: 15.0 },
        topBadge: '🌸 Reef 3/5 · Drop: Cloud Crane (2% / ⭐Alpha 8%)',
        badge: '🌬️ Tailwind Feather Gale · +35% Party Haste & Crit',
      },
      {
        id: 'sk_koi_whirlpool',
        biome: 'reef',
        dummySpriteKey: 'sf_mob_bell_spirit',
        dummyWidth: 1.55,
        dummyPos: { x: 3.50, z: 0.75 },
        camTarget: { x: 1.35, z: 0.35, dist: 15.0 },
        topBadge: '🌸 Reef 4/5 · Drop: Furin Bell Spirit (2% / ⭐Alpha 8%)',
        badge: '💧 Cleansing Koi Whirlpool · Vortex Pull + Party Heal',
      },
      {
        id: 'sk_sakura_tempest',
        biome: 'reef',
        dummySpriteKey: 'sf_boss_sakura_kitsune',
        dummyWidth: 2.65,
        dummyPos: { x: 3.85, z: 0.55 },
        camTarget: { x: 0.95, z: 0.35, dist: 15.8 },
        topBadge: '👑 Reef Boss 5/5 · Nine-Tail Kitsune (10% × 🍀)',
        badge: '🌸 Thousand-Petal Tempest · 5.4m Shrine Storm + Heal',
      },

      // Row 4 — ⚙️ Clockwork Star-Caldera (5)
      {
        id: 'sk_solar_meteor',
        biome: 'caldera',
        dummySpriteKey: 'sf_mob_cinder_salamander',
        dummyWidth: 1.75,
        dummyPos: { x: 3.55, z: 0.75 },
        camTarget: { x: 1.40, z: 0.35, dist: 15.2 },
        topBadge: '⚙️ Caldera 1/5 · Drop: Cinder Salamander (2% / ⭐Alpha 8%)',
        badge: '☄️ Solar Meteor Drop · Starfire Impact + Burn Crater',
      },
      {
        id: 'sk_chain_lightning',
        biome: 'caldera',
        dummySpriteKey: 'sf_mob_arc_automaton',
        dummyWidth: 1.75,
        dummyPos: { x: 3.50, z: 0.75 },
        camTarget: { x: 1.35, z: 0.35, dist: 14.9 },
        topBadge: '⚙️ Caldera 2/5 · Drop: Arc Automaton (2% / ⭐Alpha 8%)',
        badge: '⚡ Astral Chain Lightning · 4-Target Tesla Arc Surge',
      },
      {
        id: 'sk_star_brand',
        biome: 'caldera',
        dummySpriteKey: 'sf_mob_star_gargoyle',
        dummyWidth: 1.85,
        dummyPos: { x: 3.45, z: 0.75 },
        camTarget: { x: 1.30, z: 0.35, dist: 14.9 },
        topBadge: '⚙️ Caldera 3/5 · Drop: Star Gargoyle (2% / ⭐Alpha 8%)',
        badge: "🎯 Executioner's Star-Brand · Cross Slash + +25% Vuln",
      },
      {
        id: 'sk_time_dilation',
        biome: 'caldera',
        dummySpriteKey: 'sf_mob_chrono_sentinel',
        dummyWidth: 1.90,
        dummyPos: { x: 3.45, z: 0.65 },
        camTarget: { x: 0.85, z: 0.35, dist: 15.0 },
        topBadge: '⚙️ Caldera 4/5 · Drop: Chrono Sentinel (2% / ⭐Alpha 8%)',
        badge: '⏳ Chronos Time-Dilation · 65% Slow Dome + -2.5s CD',
      },
      {
        id: 'sk_supernova_cleave',
        biome: 'caldera',
        dummySpriteKey: 'sf_boss_solar_bahamut',
        dummyWidth: 2.75,
        dummyPos: { x: 4.05, z: 0.65 },
        camTarget: { x: 1.45, z: 0.40, dist: 16.2 },
        topBadge: '👑 Caldera Boss 5/5 · Solar Bahamut (10% × 🍀)',
        badge: '🐉 Supernova Star-Cleave · 95° Solar Cataclysm + Stun',
      },
    ];
    const bufs = [];
    for (const sp of skillSpecs) {
      const rec = SKILL_VFX_DEFS[sp.id];
      await page.evaluate(async (cfg) => window.__vfxStudio.renderAt(cfg), {
        vfxId: sp.id,
        biome: sp.biome,
        elapsedMs: rec?.effekseer?.peakMs || 520,
        badge: sp.badge,
        topBadge: sp.topBadge,
        dummySpriteKey: sp.dummySpriteKey,
        dummyWidth: sp.dummyWidth,
        dummyPos: sp.dummyPos,
        camTarget: sp.camTarget,
      });
      await new Promise((r) => setTimeout(r, 85));
      bufs.push(await page.screenshot({ type: 'png' }));
    }
    fs.writeFileSync(outPath, stitchGrid(bufs, 5, 4, SCALED_W, SCALED_H, SCALED_GAP));
    console.log(`saved all 20 skills 5x4 -> ${outPath}`);
  }

  if (outDir && !runSkills && !runCombos) {
    fs.mkdirSync(outDir, { recursive: true });
    const ids = cleanArgs.filter((a) => SKILL_VFX_DEFS[a]);
    for (const id of ids) {
      const phases = buildSixPhases(id);
      const bufs = [];
      for (const ph of phases) {
        await page.evaluate(async (cfg) => window.__vfxStudio.renderAt(cfg), {
          vfxId: id,
          elapsedMs: ph.elapsedMs,
          walkInside: ph.walkInside,
          badge: `${SKILL_VFX_DEFS[id].label} · ${ph.badge}`,
        });
        await new Promise((r) => setTimeout(r, 80));
        bufs.push(await page.screenshot({ type: 'png' }));
      }
      const dst = path.join(outDir, `strip_${id}.png`);
      fs.writeFileSync(dst, stitchGrid(bufs, 3, 2, CELL_W, CELL_H));
      console.log(`saved 6-phase strip -> ${dst}`);
    }
  } else if (!runCombos && !runSkills && cleanArgs.length >= 2) {
    const outPath = cleanArgs.find((a) => a.endsWith('.png'));
    const id = cleanArgs.find((a) => SKILL_VFX_DEFS[a]) || 'sk_pollen_ring';
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    const phases = buildSixPhases(id);
    const bufs = [];
    for (const ph of phases) {
      await page.evaluate(async (cfg) => window.__vfxStudio.renderAt(cfg), {
        vfxId: id,
        elapsedMs: ph.elapsedMs,
        walkInside: ph.walkInside,
        badge: `${SKILL_VFX_DEFS[id].label} · ${ph.badge}`,
      });
      await new Promise((r) => setTimeout(r, 80));
      bufs.push(await page.screenshot({ type: 'png' }));
    }
    fs.writeFileSync(outPath, stitchGrid(bufs, 3, 2, CELL_W, CELL_H));
    console.log(`saved 6-phase strip -> ${outPath}`);
  }

  if (runBench) {
    const bench = await page.evaluate(async () => {
      const full = await window.__vfxStudio.runBench10p(90);
      const t0 = performance.now();
      for (let i = 0; i < 120; i++) {
        window.__vfxStudio.efkManager.update(0.016);
      }
      const cpuUpdateAvgMs = +((performance.now() - t0) / 120).toFixed(3);
      return { ...full, cpuUpdateAvgMs };
    });
    console.log('10-Player Simultaneous Effekseer Cast Benchmark:', JSON.stringify(bench));
    if (bench.cpuUpdateAvgMs > 4.0) {
      throw new Error(`CPU Effekseer update too slow: ${bench.cpuUpdateAvgMs}ms`);
    }
  }

  if (errs.length) {
    console.error('Browser errors:', errs);
    process.exitCode = 1;
  } else {
    console.log('0 console/page errors.');
  }
} catch (err) {
  console.error('shoot_skill_vfx error:', err);
  process.exitCode = 1;
} finally {
  await browser.close();
  await srv.close?.();
  fs.rmSync(tmp, { recursive: true, force: true });
  process.exit(process.exitCode || 0);
}
