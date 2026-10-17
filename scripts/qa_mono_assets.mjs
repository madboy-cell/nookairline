#!/usr/bin/env node
// scripts/qa_mono_assets.mjs
// Static asset audit for Sky Monopoly 2.5D:
// Validates all sprite keys referenced in client/js/minigames/monopoly_25d/board_scene.js,
// checks manifest lookup (manifest_4a.json + asset_manifest.json + terrain/village assets),
// checks PNG files on disk, and verifies that every SEASON_SKILLS entry has a ULT_SPECS
// entry with valid generic fallbacks.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SEASON_SKILLS, GENERIC_SKILLS } from '../shared/season_skills.js';
import { THEMES, ZONES } from '../shared/monopoly_rules.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLIENT_ASSETS = path.join(ROOT, 'client', 'assets');
const MANIFEST_4A_PATH = path.join(CLIENT_ASSETS, 'monopoly', 'manifest_4a.json');
const ASSET_MANIFEST_PATH = path.join(CLIENT_ASSETS, 'asset_manifest.json');
const BOARD_SCENE_PATH = path.join(ROOT, 'client', 'js', 'minigames', 'monopoly_25d', 'board_scene.js');

const m4a = JSON.parse(fs.readFileSync(MANIFEST_4A_PATH, 'utf8'));
const mainManifest = JSON.parse(fs.readFileSync(ASSET_MANIFEST_PATH, 'utf8'));
const PACK_INFO = { ...(mainManifest?.sprites || {}), ...(m4a?.sprites || {}) };

const boardSceneSrc = fs.readFileSync(BOARD_SCENE_PATH, 'utf8');

function extractObject(src, varName) {
  const marker = 'const ' + varName + ' = ';
  const start = src.indexOf(marker);
  if (start === -1) throw new Error('Not found: ' + varName);
  let i = start + marker.length;
  const openChar = src[i];
  const closeChar = openChar === '{' ? '}' : ']';
  let depth = 0;
  let end = -1;
  for (let j = i; j < src.length; j++) {
    if (src[j] === openChar) depth++;
    else if (src[j] === closeChar) {
      depth--;
      if (depth === 0) {
        end = j + 1;
        break;
      }
    }
  }
  return eval('(' + src.slice(i, end) + ')');
}

const BUILDING_SPRITE = extractObject(boardSceneSrc, 'BUILDING_SPRITE');
const TRAP_SPRITE = extractObject(boardSceneSrc, 'TRAP_SPRITE');
const ULT_SPECS = extractObject(boardSceneSrc, 'ULT_SPECS');
const EVENT_ICON_SPRITE = extractObject(boardSceneSrc, 'EVENT_ICON_SPRITE');
const MONO_LANDSCAPE_THEMES = extractObject(boardSceneSrc, 'MONO_LANDSCAPE_THEMES');

const auditResults = [];

function checkAsset(category, name, type = 'sprite', customPath = null) {
  let inManifest = false;
  let filePath = null;
  let fileExists = false;

  if (type === 'sprite') {
    const info = PACK_INFO[name];
    if (info) {
      inManifest = true;
      filePath = path.join(CLIENT_ASSETS, info.file);
      fileExists = fs.existsSync(filePath);
    }
  } else if (type === 'village_icon') {
    // Loaded directly by Image tag: /assets/village/${name}.png or in PACK_INFO
    const directPath = path.join(CLIENT_ASSETS, 'village', `${name}.png`);
    const info = PACK_INFO[name];
    inManifest = !!info || fs.existsSync(directPath);
    filePath = info ? path.join(CLIENT_ASSETS, info.file) : directPath;
    fileExists = fs.existsSync(filePath);
  } else if (type === 'terrain_swatch') {
    // Loaded by loadTerrainTex: /assets/terrain/${name}.png
    const directPath = path.join(CLIENT_ASSETS, 'terrain', `${name}.png`);
    inManifest = fs.existsSync(directPath);
    filePath = directPath;
    fileExists = fs.existsSync(filePath);
  }

  const passed = inManifest && fileExists;
  auditResults.push({
    category,
    name,
    inManifest,
    fileExists,
    relPath: filePath ? path.relative(ROOT, filePath) : 'NOT FOUND',
    passed,
  });
  return passed;
}

// 1. Audit ULT_SPECS sprites
for (const [skillId, spec] of Object.entries(ULT_SPECS)) {
  checkAsset('ULT_SPECS (' + skillId + ')', spec.sprite);
}

// 2. Audit BUILDING_SPRITE (Level 1 to 3 variants a/b + Level 4 pyramid & lv4 landmark)
for (const [lvl, [prefix]] of Object.entries(BUILDING_SPRITE)) {
  for (const variant of ['a', 'b']) {
    const spriteKey = `${prefix}_${variant}`;
    checkAsset(`BUILDING Lv${lvl}`, spriteKey);
  }
}
// Sovereign Monument / Lv4 landmark check
checkAsset('BUILDING Lv4 Sovereign', 'mono_landmark_lv4');

// Verify coverage for each of the 6 property themes (zones)
const zoneThemes = Object.keys(THEMES);
for (const themeKey of zoneThemes) {
  // Each zone has properties that use buildingMesh with variants a/b across levels 1..4
  for (let lv = 1; lv <= 4; lv++) {
    const prefix = BUILDING_SPRITE[lv][0];
    const spKeyA = `${prefix}_a`;
    const spKeyB = `${prefix}_b`;
    if (!PACK_INFO[spKeyA] || !PACK_INFO[spKeyB]) {
      auditResults.push({
        category: `BUILDING Theme (${themeKey} Lv${lv})`,
        name: `${prefix}_{a,b}`,
        inManifest: false,
        fileExists: false,
        relPath: 'MISSING',
        passed: false,
      });
    }
  }
}

// 3. Audit TRAP_SPRITE
for (const [trapKey, def] of Object.entries(TRAP_SPRITE)) {
  const spriteKey = def[0];
  checkAsset(`TRAP_SPRITE (${trapKey})`, spriteKey);
}

// 4. Audit EVENT_EMBLEM_MAP / EVENT_ICON_SPRITE
for (const [evtKind, iconKey] of Object.entries(EVENT_ICON_SPRITE)) {
  checkAsset(`EVENT_EMBLEM (${evtKind})`, iconKey, 'village_icon');
}

// 5. Audit MONO_LANDSCAPE_THEMES
for (const theme of MONO_LANDSCAPE_THEMES) {
  const tId = theme.id;
  // Terrain swatches
  checkAsset(`THEME (${tId}) groundSwatch`, theme.groundSwatch, 'terrain_swatch');
  checkAsset(`THEME (${tId}) cobbleSwatch`, theme.cobbleSwatch, 'terrain_swatch');

  // Ground medal
  if (theme.groundMedal) {
    checkAsset(`THEME (${tId}) groundMedal`, theme.groundMedal);
  }

  // Props
  const propList = [
    ['northHero', theme.northHero[0]],
    ['northTree0', theme.northTrees[0]],
    ['northTree1', theme.northTrees[1]],
    ['northOuter', theme.northOuter[0]],
    ['northInner', theme.northInner[0]],
    ['centerHero', theme.centerHero[0]],
    ['wingTree0', theme.wingTrees[0]],
    ['wingTree1', theme.wingTrees[1]],
    ['westWing', theme.westWing[0]],
    ['eastWing', theme.eastWing[0]],
    ['westSub', theme.westSub[0]],
    ['eastSub', theme.eastSub[0]],
    ['plazaBush', theme.plazaBush[0]],
    ['southBridge', theme.southBridge[0]],
    ['southWestA', theme.southWestA[0]],
    ['southWestB', theme.southWestB[0]],
    ['southEastA', theme.southEastA[0]],
    ['southEastB', theme.southEastB[0]],
    ['southFrontW', theme.southFrontW[0]],
    ['southFrontE', theme.southFrontE[0]],
  ];
  for (const [slot, key] of propList) {
    checkAsset(`THEME (${tId}) ${slot}`, key);
  }
}

// 6. Center props
const centerProps = [
  'decal_plaza_medallion_circle',
  'decal_path_stepping_stones',
  'decal_grass_daisies_b',
  'decal_grass_clover_a',
  'env_streetlamp_double',
  'env_streetlamp_iron',
  'env_planter_ortho_horizontal',
  'env_fence_ortho_horizontal',
  'mono_dec_start_gate',
  'mono_dec_fountain',
  'mono_dec_shrine',
  'mono_dec_boba',
  'wnd_fountain',
  'bld_shrine',
];
for (const cp of centerProps) {
  checkAsset('CENTER PROP', cp);
}

// 7. Check every SEASON_SKILLS id has a ULT_SPECS entry
const seasonSkillChecks = [];
for (const skillId of Object.keys(SEASON_SKILLS)) {
  const hasSpec = !!ULT_SPECS[skillId];
  const spec = ULT_SPECS[skillId];
  const spriteValid = spec ? (!!PACK_INFO[spec.sprite] && fs.existsSync(path.join(CLIENT_ASSETS, PACK_INFO[spec.sprite].file))) : false;
  const passed = hasSpec && spriteValid;
  seasonSkillChecks.push({
    skillId,
    hasSpec,
    sprite: spec?.sprite || 'NONE',
    passed,
  });
}

// 8. Check GENERIC skills fallback
const genericChecks = [];
for (const [rarity, gSkill] of Object.entries(GENERIC_SKILLS)) {
  // Generic skills define vfx (e.g. 'coins'). In ultVfx, vfx maps to a fallback monument.
  const vfx = gSkill.vfx;
  const fallbackSprite = vfx === 'pillar' ? 'mono_ult_zeus' :
    vfx === 'crystal' ? 'mono_ult_glacial' :
    vfx === 'wave' ? 'mono_ult_naga' :
    vfx === 'vortex' ? 'mono_ult_astral' :
    vfx === 'projectile' ? 'mono_ult_phoenix' : 'mono_ult_roulette';

  const comboFallbackSprite = 'mono_ult_astral';
  const spriteValid = !!PACK_INFO[fallbackSprite] && fs.existsSync(path.join(CLIENT_ASSETS, PACK_INFO[fallbackSprite].file));
  const comboValid = !!PACK_INFO[comboFallbackSprite] && fs.existsSync(path.join(CLIENT_ASSETS, PACK_INFO[comboFallbackSprite].file));
  const passed = spriteValid && comboValid;
  genericChecks.push({
    name: gSkill.name,
    rarity,
    vfx,
    fallbackSprite,
    comboFallbackSprite,
    passed,
  });
}

// Print results table
console.log('='.repeat(96));
console.log('SKY MONOPOLY ASSET & SKILL AUDIT');
console.log('='.repeat(96));

let totalFailed = 0;

console.log('\n--- 1. STATIC ASSET CHECKS ---');
console.log(
  'Status | ' +
  'Category'.padEnd(30) + ' | ' +
  'Key'.padEnd(28) + ' | ' +
  'Manifest' + ' | ' +
  'Disk'
);
console.log('-'.repeat(96));

for (const r of auditResults) {
  if (!r.passed) totalFailed++;
  const status = r.passed ? 'PASS  ' : 'FAIL *';
  console.log(
    `${status} | ${r.category.padEnd(30)} | ${r.name.padEnd(28)} | ${String(r.inManifest).padEnd(8)} | ${String(r.fileExists)}`
  );
}

console.log('\n--- 2. SEASON SKILLS (13 MYTHIC + 2 SUPER MYTHIC) -> ULT_SPECS ---');
console.log(
  'Status | ' +
  'Skill ID'.padEnd(26) + ' | ' +
  'In ULT_SPECS'.padEnd(14) + ' | ' +
  'Monument Sprite'.padEnd(24)
);
console.log('-'.repeat(96));
for (const s of seasonSkillChecks) {
  if (!s.passed) totalFailed++;
  const status = s.passed ? 'PASS  ' : 'FAIL *';
  console.log(
    `${status} | ${s.skillId.padEnd(26)} | ${String(s.hasSpec).padEnd(14)} | ${s.sprite.padEnd(24)}`
  );
}

console.log('\n--- 3. GENERIC SKILL FALLBACKS ---');
console.log(
  'Status | ' +
  'Generic Skill'.padEnd(24) + ' | ' +
  'vfx'.padEnd(8) + ' | ' +
  'Solo Fallback'.padEnd(22) + ' | ' +
  'Combo Fallback'
);
console.log('-'.repeat(96));
for (const g of genericChecks) {
  if (!g.passed) totalFailed++;
  const status = g.passed ? 'PASS  ' : 'FAIL *';
  console.log(
    `${status} | ${g.name.padEnd(24)} | ${g.vfx.padEnd(8)} | ${g.fallbackSprite.padEnd(22)} | ${g.comboFallbackSprite}`
  );
}

console.log('\n' + '='.repeat(96));
if (totalFailed > 0) {
  console.error(`AUDIT FAILED: ${totalFailed} check(s) did not pass.`);
  process.exit(1);
} else {
  console.log(`AUDIT PASSED: All ${auditResults.length + seasonSkillChecks.length + genericChecks.length} checks passed with zero missing assets.`);
  process.exit(0);
}
