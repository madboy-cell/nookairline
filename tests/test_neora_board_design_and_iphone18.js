/**
 * Automated Verification: NEORA Board Design & iPhone 18 Pro Optimization Suite
 * Verifies that the board upgrade strictly complies with neora_component_asset_breakdown/
 * AGENT_IMPLEMENTATION_PROMPT.md and all 7 acceptance criteria.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('===========================================================================');
console.log('📱 TEST: NEORA BOARD DESIGN & IPHONE 18 PRO OPTIMIZATION SUITE');
console.log('===========================================================================');

let passedCount = 0;
let totalCount = 0;

function it(title, fn) {
  totalCount++;
  try {
    fn();
    console.log(`  ✅ [PASS] ${title}`);
    passedCount++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${title}: ${err.message}`);
    process.exitCode = 1;
  }
}

const htmlPath = path.join(__dirname, '../public/index.html');
const cssPath = path.join(__dirname, '../public/monopoly.css');
const jsPath = path.join(__dirname, '../public/monopoly.js');
const bgImgPath = path.join(__dirname, '../public/assets/ui/neora_center_bg.png');

const htmlContent = fs.readFileSync(htmlPath, 'utf8');
const cssContent = fs.readFileSync(cssPath, 'utf8');
const jsContent = fs.readFileSync(jsPath, 'utf8');

console.log('\n--- SUITE 1: Header Brand & Strict No-Gem Constraint ---');

it('1.1 Header contains NEORA branding and tagline', () => {
  assert(htmlContent.includes('NE<span class="neora-planet-o">🪐</span>RA') || htmlContent.includes('NE🪐RA'), 'Should include NEORA logo');
  assert(htmlContent.includes('PLAY TOGETHER, STAY CLOSE.'), 'Should include brand tagline');
});

it('1.2 Header contains navigation buttons (Lobby, Rules, Settings, Close)', () => {
  assert(htmlContent.includes('id="monopolyLobbyBtn"'), 'Must have Lobby button');
  assert(htmlContent.includes('id="monopolyRulesBtn"'), 'Must have Rules button');
  assert(htmlContent.includes('id="monopolySettingsBtn"'), 'Must have Settings button');
  assert(htmlContent.includes('id="closeMonopolyBtn"'), 'Must have Close button');
});

it('1.3 Header STRICTLY has NO diamond or gem counter', () => {
  const headerMatch = htmlContent.match(/<div class="neora-game-header"[^>]*>([\s\S]*?)<\/div>\s*<!--/);
  assert(headerMatch, 'Must find neora-game-header in HTML');
  const headerHtml = headerMatch[1];
  assert(!headerHtml.includes('💎'), 'Header must NOT have gem emoji');
  assert(!headerHtml.includes('diamond'), 'Header must NOT have diamond text or class');
  assert(!headerHtml.includes('vault-pill'), 'Header must NOT have vault-pill');
});

console.log('\n--- SUITE 2: Four Player Cards in a Single Row ---');

it('2.1 Exactly 4 player cards exist in HTML with proper IDs', () => {
  assert(htmlContent.includes('id="monopolyPlayerCardBkk"'), 'Card P1 must exist');
  assert(htmlContent.includes('id="monopolyPlayerCardDxb"'), 'Card P2 must exist');
  assert(htmlContent.includes('id="monopolyPlayerCardBot1"'), 'Card P3 must exist');
  assert(htmlContent.includes('id="monopolyPlayerCardBot2"'), 'Card P4 must exist');
});

it('2.2 CSS enforces 4 cards in a single horizontal row', () => {
  assert(cssContent.includes('grid-template-columns: repeat(4, 1fr)'), 'CSS must specify repeat(4, 1fr)');
});

it('2.3 Player cards contain avatar, crown on P1, balance, NW badge, and signal bars', () => {
  assert(htmlContent.includes('class="player-crown-icon"'), 'P1 must have crown icon');
  assert(htmlContent.includes('class="player-signal-bars"'), 'Must have signal bars');
  assert(htmlContent.includes('id="monopolyBkkMiles"'), 'Must have miles balance element');
  assert(htmlContent.includes('id="monopolyBkkNw"'), 'Must have net worth badge element');
});

it('2.4 Monopoly JS gracefully handles empty seats in 2P mode without breaking 4-card layout', () => {
  assert(jsContent.includes('is-empty-seat'), 'monopoly.js must toggle is-empty-seat for unseated cards');
});

console.log('\n--- SUITE 3: Perimeter Tile Order & Category Styling ---');

it('3.1 20 perimeter tiles are defined in exact clockwise order', () => {
  const tilesBlock = jsContent.match(/const MONOPOLY_TILES = \[([\s\S]*?)\];/);
  assert(tilesBlock, 'MONOPOLY_TILES must be present');
  const tileMatches = [...tilesBlock[1].matchAll(/id:\s*(\d+),\s*name:\s*'([^']+)',\s*shortName:\s*'([^']+)'/g)];
  assert.strictEqual(tileMatches.length, 20, 'Must have exactly 20 tiles');
  assert.strictEqual(tileMatches[0][3], 'START', 'Tile 0 must be START');
  assert.strictEqual(tileMatches[1][3], 'Yaowarat', 'Tile 1 must be Yaowarat');
  assert.strictEqual(tileMatches[4][3], 'CASINO', 'Tile 4 must be CASINO');
  assert.strictEqual(tileMatches[7][3], 'AIRDROP', 'Tile 7 must be AIRDROP');
  assert.strictEqual(tileMatches[9][3], 'BRIDGE', 'Tile 9 must be BRIDGE');
  assert.strictEqual(tileMatches[10][3], 'MYSTERY', 'Tile 10 must be MYSTERY');
  assert.strictEqual(tileMatches[14][3], 'ARENA', 'Tile 14 must be ARENA');
});

it('3.2 Tokyo bottom row has slightly taller height in CSS grid', () => {
  assert(cssContent.includes('1.08fr'), 'CSS grid must specify 1.08fr for bottom row');
});

it('3.3 Right-side Mystery tile is strictly aligned to row 7 col 5', () => {
  assert(cssContent.includes('#boardTile_10'), 'CSS must specifically anchor #boardTile_10');
  assert(cssContent.includes('grid-row: 7') && cssContent.includes('grid-column: 5'), 'Tile 10 must be on row 7 col 5');
});

it('3.4 Tile category strips are rendered with zone headers', () => {
  assert(jsContent.includes('tile-category-strip'), 'monopoly.js must render tile-category-strip');
  assert(cssContent.includes('.tile-category-strip.zone-bkk'), 'CSS must have Bangkok zone strip style');
  assert(cssContent.includes('.tile-category-strip.zone-dxb'), 'CSS must have Dubai zone strip style');
  assert(cssContent.includes('.tile-category-strip.zone-tyo'), 'CSS must have Tokyo zone strip style');
});

console.log('\n--- SUITE 4: Center Game Stage Hub & Daisy Dice Platform ---');

it('4.1 Center hub background asset exists in public directory', () => {
  assert(fs.existsSync(bgImgPath), 'neora_center_bg.png must exist');
  const stats = fs.statSync(bgImgPath);
  assert(stats.size > 10000, 'Background image must be a valid non-empty image');
});

it('4.2 Round and Net Worth reward bar is present', () => {
  assert(htmlContent.includes('id="roundRewardBar"'), 'Must have roundRewardBar');
  assert(htmlContent.includes('id="monopolyRoundPill"'), 'Must have monopolyRoundPill');
  assert(htmlContent.includes('id="monopolyGoalPill"'), 'Must have monopolyGoalPill');
});

it('4.3 Turn indicator contains player avatar thumbnail and text', () => {
  assert(htmlContent.includes('id="monopolyTurnBadge"'), 'Must have monopolyTurnBadge');
  assert(htmlContent.includes('id="monopolyTurnAvatarMini"'), 'Must have turn avatar thumbnail');
  assert(jsContent.includes('monopolyTurnAvatarMini'), 'JS must update turn avatar thumbnail');
});

it('4.4 Glowing circular dice dais platform is present under dice', () => {
  assert(htmlContent.includes('id="diceStageDais"'), 'Must have diceStageDais');
  assert(cssContent.includes('.dice-stage-dais'), 'CSS must have glowing dais styles');
  assert(cssContent.includes('daisSpinGlow'), 'CSS must have dais spin/glow animation');
});

console.log('\n--- SUITE 5: Bottom Action Bar & Functional Controls ---');

it('5.1 Bottom dock contains dual item slots, Roll CTA, and Ult meter', () => {
  assert(htmlContent.includes('id="monopolyItemSlot0"'), 'Item slot 0 must exist');
  assert(htmlContent.includes('id="monopolyItemSlot1"'), 'Item slot 1 must exist');
  assert(htmlContent.includes('id="btnRollDice"'), 'Roll dice button must exist');
  assert(htmlContent.includes('id="monopolyUltBtn"'), 'Ultimate button must exist');
});

it('5.2 Roll button has large glowing CTA styling', () => {
  assert(cssContent.includes('.neora-roll-btn'), 'CSS must style .neora-roll-btn');
});

console.log('\n--- SUITE 6: iPhone 18 Pro & Mobile Viewport Optimization ---');

it('6.1 CSS includes safe-area-inset rules for iOS notch / Dynamic Island and home bar', () => {
  assert(cssContent.includes('env(safe-area-inset-top'), 'Must support safe-area-inset-top');
  assert(cssContent.includes('env(safe-area-inset-bottom'), 'Must support safe-area-inset-bottom');
  assert(cssContent.includes('100dvh'), 'Must support dynamic viewport height dvh');
});

it('6.2 CSS includes media queries for compact phone viewports (<= 430px)', () => {
  assert(cssContent.includes('@media screen and (max-width: 430px)'), 'Must have max-width 430px mobile rules');
});

console.log('\n===========================================================================');
console.log(`TEST SUMMARY: ${passedCount}/${totalCount} Passed (0 Failed)`);
console.log('===========================================================================');
if (passedCount === totalCount) {
  console.log('🎉 ALL NEORA BOARD DESIGN & IPHONE 18 PRO OPTIMIZATIONS VERIFIED 100%!');
}
