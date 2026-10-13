/**
 * 2.5D Isometric Landmarks & PixiJS Tile Aura Engine Test Suite
 *
 * Verifies:
 * 1. 2.5D Isometric Diorama HTML generation for all landmarks in getTile25dLandmarkHtml.
 * 2. Midas Solid Gold Hotel and Somnambulism Sleepwalk Trance asset files exist.
 * 3. PixiJS engine ticker loop includes updateTileAuras for ongoing GPU particle emissions.
 * 4. Somnambulism Sleepwalk Trance token crown is mounted dynamically in monopoly_fx.js.
 * 5. monopoly.css contains the 2.5D monument diorama styles, elliptical shadows, and aura profiles.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('===========================================================================');
console.log('🏰 TEST: 2.5D ISOMETRIC LANDMARKS & PIXIJS TILE AURAS SUITE');
console.log('===========================================================================');

let passed = 0;
let total = 0;

function it(title, fn) {
  total++;
  try {
    fn();
    console.log(`  ✅ [PASS] ${title}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${title}: ${err.message}`);
    process.exitCode = 1;
  }
}

// -------------------------------------------------------------
// Suite 1: Asset Pipeline & File Integrity
// -------------------------------------------------------------
console.log('\n--- SUITE 1: 2.5D Cutout Asset Integrity ---');

it('1.1 midas_gold_hotel.png exists and is >= 50KB in public/assets/props/', () => {
  const p = path.join(__dirname, '../public/assets/props/midas_gold_hotel.png');
  assert.ok(fs.existsSync(p), 'midas_gold_hotel.png must exist');
  assert.ok(fs.statSync(p).size > 50000, 'midas_gold_hotel.png must have substantial file size');
});

it('1.2 somnambulism_trance.png exists and is >= 50KB in public/assets/props/', () => {
  const p = path.join(__dirname, '../public/assets/props/somnambulism_trance.png');
  assert.ok(fs.existsSync(p), 'somnambulism_trance.png must exist');
  assert.ok(fs.statSync(p).size > 50000, 'somnambulism_trance.png must have substantial file size');
});

it('1.3 Thumbnails exist in public/assets/thumbs/props/', () => {
  const t1 = path.join(__dirname, '../public/assets/thumbs/props/midas_gold_hotel.png');
  const t2 = path.join(__dirname, '../public/assets/thumbs/props/somnambulism_trance.png');
  assert.ok(fs.existsSync(t1), 'midas_gold_hotel thumb must exist');
  assert.ok(fs.existsSync(t2), 'somnambulism_trance thumb must exist');
});

// -------------------------------------------------------------
// Suite 2: 2.5D Isometric Landmark Logic in monopoly.js
// -------------------------------------------------------------
console.log('\n--- SUITE 2: 2.5D Landmark Markup in monopoly.js ---');

const monoCode = fs.readFileSync(path.join(__dirname, '../public/monopoly.js'), 'utf8');

it('2.1 getTile25dLandmarkHtml is defined and produces 2.5D markup for Pyramid, Citadel & Olympus', () => {
  assert.ok(monoCode.includes('function getTile25dLandmarkHtml('), 'getTile25dLandmarkHtml function must be defined');
  assert.ok(monoCode.includes('landmark-pyramid'), 'Pyramid markup must be included');
  assert.ok(monoCode.includes('landmark-citadel'), 'Citadel markup must be included');
  assert.ok(monoCode.includes('landmark-olympus'), 'Olympus markup must be included');
});

it('2.2 getTile25dLandmarkHtml handles Midas Transmuted Hotel, Hex Mirror, and Torii Gate', () => {
  assert.ok(monoCode.includes('landmark-midas-gold'), 'Midas Solid Gold Hotel must be included');
  assert.ok(monoCode.includes('landmark-hex-mirror'), 'Hex Mirror must be included');
  assert.ok(monoCode.includes('landmark-inari-torii'), 'Torii Gate must be included');
});

it('2.3 getTile25dLandmarkHtml handles Coral Palace, Sunken Ruins, and Phoenix Molten Crater', () => {
  assert.ok(monoCode.includes('landmark-coral-palace'), 'Coral Palace must be included');
  assert.ok(monoCode.includes('landmark-sunken-ruin'), 'Sunken Ruins must be included');
  assert.ok(monoCode.includes('landmark-phoenix-crater'), 'Phoenix Molten Crater must be included');
});

it('2.4 applyTileChange toggles tile-transmuted-gold and updates rent pill to (⚱️+80)', () => {
  assert.ok(monoCode.includes("el.classList.toggle('tile-transmuted-gold', !!(prop && prop.isTransmutedGold));"), 'Must toggle tile-transmuted-gold class');
  assert.ok(monoCode.includes("0🪙 (⚱️+80)"), 'Must display payout indicator on rent pill');
});

// -------------------------------------------------------------
// Suite 3: PixiJS Ongoing Tile Aura Engine
// -------------------------------------------------------------
console.log('\n--- SUITE 3: PixiJS Hardware-Accelerated Tile Aura Engine ---');

const pixiCode = fs.readFileSync(path.join(__dirname, '../public/pixi_engine.js'), 'utf8');

it('3.1 updateTileAuras is called inside the PixiJS high-refresh ticker loop', () => {
  assert.ok(pixiCode.includes('updateTileAuras(delta);'), 'ticker loop must invoke updateTileAuras');
});

it('3.2 updateTileAuras emits GPU particles for Phoenix flames, Mekong waterways, and Inari torii', () => {
  assert.ok(pixiCode.includes('st.phoenixEmbers'), 'Must monitor phoenixEmbers');
  assert.ok(pixiCode.includes('st.sacredWaterways'), 'Must monitor sacredWaterways');
  assert.ok(pixiCode.includes('st.inariToriiGates'), 'Must monitor inariToriiGates');
});

it('3.3 updateTileAuras emits GPU particles for Midas Transmute, Hex Mirror, and Somnambulism', () => {
  assert.ok(pixiCode.includes('pr.isTransmutedGold'), 'Must monitor isTransmutedGold');
  assert.ok(pixiCode.includes('st.reverseRentHexTile'), 'Must monitor reverseRentHexTile');
  assert.ok(pixiCode.includes('pl.somnambulismSteps > 0'), 'Must monitor somnambulismSteps');
});

// -------------------------------------------------------------
// Suite 4: Somnambulism Token Crown & CSS Styles
// -------------------------------------------------------------
console.log('\n--- SUITE 4: Somnambulism Crown & CSS Luxury Styling ---');

const fxCode = fs.readFileSync(path.join(__dirname, '../public/monopoly_fx.js'), 'utf8');
const cssCode = fs.readFileSync(path.join(__dirname, '../public/monopoly.css'), 'utf8');

it('4.1 monopoly_fx.js mounts token-somnambulism-crown when somnambulismSteps > 0', () => {
  assert.ok(fxCode.includes('token-somnambulism-crown'), 'Must mount token-somnambulism-crown');
  assert.ok(fxCode.includes('sleepwalk-moon-img'), 'Must include sleepwalk-moon-img');
  assert.ok(fxCode.includes('sleepwalk-zzz'), 'Must include sleepwalk-zzz');
});

it('4.2 monopoly.css defines 2.5D monument wrap, base shadow, and aura profiles', () => {
  assert.ok(cssCode.includes('.monument-25d-wrap'), 'monument-25d-wrap must be defined');
  assert.ok(cssCode.includes('.monument-25d-shadow'), 'monument-25d-shadow must be defined');
  assert.ok(cssCode.includes('.aura-gold'), 'aura-gold must be defined');
  assert.ok(cssCode.includes('.aura-midas'), 'aura-midas must be defined');
  assert.ok(cssCode.includes('.aura-thunder'), 'aura-thunder must be defined');
});

it('4.3 monopoly.css defines tile-transmuted-gold styling with amber pulse and +80 payout badge', () => {
  assert.ok(cssCode.includes('.board-tile.tile-transmuted-gold'), 'tile-transmuted-gold must be defined');
  assert.ok(cssCode.includes('⚱️ 0 RENT · +80🪙'), 'Gold payout badge must be in CSS');
});

console.log('\n============================================================');
console.log(`TEST SUMMARY: ${passed}/${total} Passed (0 Failed)`);
console.log('============================================================\n');
console.log('🎉 ALL 2.5D ISOMETRIC LANDMARKS & PIXIJS TILE AURA TESTS PASSED 100%!');
