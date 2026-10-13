/**
 * test_victory_ceremony_and_reward_banner.js
 * Comprehensive unit and integration test for the NEORA Victory Ceremony & Reward Banner.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('============================================================');
console.log('🏆 TEST: NEORA VICTORY CEREMONY & REWARD BANNER SUITE');
console.log('============================================================\n');

let passed = 0;
let failed = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`  ✅ [PASS] ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${desc}`);
    console.error(`     ${err.message}`);
    failed++;
  }
}

const monopolyJs = fs.readFileSync(path.join(__dirname, '../public/monopoly.js'), 'utf8');
const monopolyCss = fs.readFileSync(path.join(__dirname, '../public/monopoly.css'), 'utf8');

console.log('--- SUITE 1: DOM INJECTION & CRITICAL SELECTORS (BUG A FIX) ---');

it('1.1 victoryDiamonds ID is strictly present in renderVictory template', () => {
  assert(monopolyJs.includes('id="victoryDiamonds"'), 'Missing id="victoryDiamonds" in monopoly.js');
  // Must be embedded inside the innerHTML template
  assert(monopolyJs.includes('${diamondsHtml}'), 'diamondsHtml must be included in renderVictory HTML');
});

it('1.2 victoryDiamonds element contains <b> and <small> required by vault:award', () => {
  assert(monopolyJs.includes('<div class="victory-diamonds'), 'victory-diamonds container class missing');
  assert(monopolyJs.includes('<div class="vd-info">') || monopolyJs.includes('<b>'), '<b> tag inside victory-diamonds missing');
});

it('1.3 victoryLootBox ID is strictly present with .loot-chip.diamonds b selector', () => {
  assert(monopolyJs.includes('id="victoryLootBox"'), 'Missing id="victoryLootBox" in monopoly.js');
  assert(monopolyJs.includes('class="loot-chip diamonds"'), 'Missing .loot-chip.diamonds class');
  assert(monopolyJs.includes('window.addEventListener(\'vault:award\''), 'vault:award listener missing');
  assert(monopolyJs.includes('window.addEventListener(\'vault:bot_result\''), 'vault:bot_result listener missing');
});

it('1.4 vault:bot_result updates both #victoryDiamonds and #victoryLootBox', () => {
  const botResultMatch = monopolyJs.match(/window\.addEventListener\('vault:bot_result'[\s\S]*?\}\);/);
  assert(botResultMatch, 'vault:bot_result listener not found');
  const code = botResultMatch[0];
  assert(code.includes("el = $m('victoryDiamonds')"), 'victoryDiamonds lookup missing in vault:bot_result');
  assert(code.includes("lb = $m('victoryLootBox')"), 'victoryLootBox lookup missing in vault:bot_result');
});

console.log('\n--- SUITE 2: ERGONOMIC VIP BUTTON DOCK & STYLING (BUGS B & C FIX) ---');

it('2.1 NEORA 2-tier action dock structure is rendered in renderVictory', () => {
  assert(monopolyJs.includes('neora-victory-dock') || monopolyJs.includes('neora-action-dock'), 'Missing dock container');
  assert(monopolyJs.includes('dock-primary-row'), 'Missing primary button row');
  assert(monopolyJs.includes('dock-secondary-row'), 'Missing secondary button row');
});

it('2.2 Primary row features Golden VIP button and Quick Vault Gacha button', () => {
  assert(monopolyJs.includes('neora-btn-primary'), 'neora-btn-primary class missing');
  assert(monopolyJs.includes('id="btnOpenVaultTogether"'), 'btnOpenVaultTogether missing');
  assert(monopolyJs.includes('neora-btn-vault'), 'neora-btn-vault class missing');
});

it('2.3 Secondary row features Departures Lounge and Clean Exit to Cabin', () => {
  assert(monopolyJs.includes('neora-btn-lobby') || monopolyJs.includes('neora-btn-secondary'), 'Departures button class missing');
  assert(monopolyJs.includes('data-act="mode"'), 'data-act="mode" missing');
  assert(monopolyJs.includes('neora-btn-exit') || monopolyJs.includes('neora-btn-tertiary'), 'Exit button class missing');
  assert(monopolyJs.includes('data-act="close"'), 'data-act="close" missing');
});

it('2.4 Legacy property buttons (.btn-buy-prop / .btn-pass-prop) removed from victory ceremony', () => {
  const renderVictoryCode = monopolyJs.substring(
    monopolyJs.indexOf('function renderVictory()'),
    monopolyJs.indexOf('// Replace the estimate with the server')
  );
  assert(!renderVictoryCode.includes('btn-buy-prop'), 'btn-buy-prop still found in renderVictory');
  assert(!renderVictoryCode.includes('btn-pass-prop'), 'btn-pass-prop still found in renderVictory');
});

console.log('\n--- SUITE 3: SPECTATOR GATING & CLEAN EXIT (BUGS D & E FIX) ---');

it('3.1 Spectators are gated from rematch / play again buttons', () => {
  const spectatorBlock = monopolyJs.match(/if\s*\(isSpectator\)\s*\{[\s\S]*?actionsHtml\s*=[\s\S]*?\}/);
  assert(spectatorBlock, 'isSpectator dock branch not found');
  const code = spectatorBlock[0];
  assert(!code.includes('data-act="again"'), 'Spectators must not have data-act="again"');
  assert(!code.includes('data-act="rematch"'), 'Spectators must not have data-act="rematch"');
  assert(code.includes('RETURN TO DEPARTURES') || code.includes('data-act="mode"'), 'Spectators should have return to departures');
});

it('3.2 Spectators do not see fake 0 diamond payout loot box', () => {
  assert(monopolyJs.includes('isSpectator ? \'Flight Crew Payout Breakdown\' : \'First-Class Flight Settlement\''), 'Spectator title differentiation missing');
  assert(monopolyJs.includes('SPECTATING COMPLETE') || monopolyJs.includes('spectator-deck'), 'Spectator diamonds banner missing');
});

it('3.3 Exiting game when gameOver is true does not mark player as away', () => {
  const closeMatch = monopolyJs.match(/function closeMonopolyGame\(broadcast = true\)\s*\{[\s\S]*?const modal = \$m\('monopolyModal'\);/);
  assert(closeMatch, 'closeMonopolyGame definition not found');
  assert(closeMatch[0].includes('if (!monopolyState?.gameOver)'), 'Must check !monopolyState?.gameOver before activeMatch away penalty');
});

it('3.4 Insane bot difficulty is supported with proper 950 diamond payout calculation', () => {
  assert(monopolyJs.includes("bLevel === 'insane'"), 'bLevel === "insane" check missing');
  assert(monopolyJs.includes('950 : 50'), 'Insane 950 win / 50 rebate payout missing');
});

it('3.5 Draw / tie games render perfect draw title and tied crew placements', () => {
  assert(monopolyJs.includes("IT'S A PERFECT DRAW!"), 'Draw title missing');
  assert(monopolyJs.includes('TIED CREW'), 'Tied crew rank title missing');
});

console.log('\n--- SUITE 4: RESPONSIVE DESIGN & MOBILE SAFETY (IPHONE 16/18 PRO) ---');

it('4.1 CSS provides internal scrollable body with flex layout', () => {
  assert(monopolyCss.includes('.neora-victory-card') || monopolyCss.includes('.victory-card'), '.neora-victory-card rule missing');
  assert(monopolyCss.includes('.victory-scroll-body') || monopolyCss.includes('.neora-victory-scroll'), '.victory-scroll-body rule missing');
  assert(monopolyCss.includes('overflow-y: auto'), 'overflow-y: auto missing in victory scroll body');
});

it('4.2 Dock is anchored with flex: 0 0 auto and safe-area insets', () => {
  assert(monopolyCss.includes('.neora-action-dock') || monopolyCss.includes('.neora-victory-dock'), '.neora-action-dock rule missing');
  assert(monopolyCss.includes('env(safe-area-inset-bottom'), 'safe-area-inset-bottom missing in dock padding');
});

it('4.3 Mobile media query (<= 430px) scales victory modal dynamically with 100dvh', () => {
  const mobileQuery = monopolyCss.substring(monopolyCss.lastIndexOf('@media screen and (max-width: 430px)'));
  assert(mobileQuery.includes('100dvh'), '100dvh dynamic viewport height missing in mobile query');
  assert(mobileQuery.includes('.neora-btn-primary'), '.neora-btn-primary scaling missing in mobile query');
});

console.log('\n============================================================');
console.log(`TEST SUMMARY: ${passed}/${passed + failed} Passed (${failed} Failed)`);
console.log('============================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL VICTORY CEREMONY & REWARD BANNER VERIFICATIONS PASSED 100%!\n');
}
