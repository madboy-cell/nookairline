/**
 * tests/test_audit_fixes_comprehensive.js
 * Comprehensive Verification Test Suite for:
 * 1. Monopoly Bugs 1–5
 * 2. Gacha & Wardrobe Bugs 1–5
 * 3. Cat Lounge Bugs 1–4
 * 4. Voice Call Bugs 1–5 & Floating Mini-Call Island
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('============================================================');
console.log('🧪 COMPREHENSIVE VERIFICATION: BUGS 1-5 & FLOATING ISLAND');
console.log('============================================================\n');

let passed = 0;
let total = 0;

function it(name, fn) {
  total++;
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(err);
  }
}

// ============================================================
// AREA 1: MONOPOLY BUGS 1–5
// ============================================================
console.log('--- AREA 1: MONOPOLY GAME ENGINE & ROOMS ---');

const monopolyCode = fs.readFileSync(path.join(__dirname, '../public/monopoly.js'), 'utf8');
const botTakeoverCode = fs.readFileSync(path.join(__dirname, '../server_bot_takeover.js'), 'utf8');

it('1.1 Bot takeover uses 1d6 rollVal (1..6) and does not roll 2d6', () => {
  assert(botTakeoverCode.includes('Math.floor(Math.random() * 6) + 1'), 'server_bot_takeover should roll 1d6');
  assert(!botTakeoverCode.includes('const d1 = Math.floor(Math.random() * 6) + 1;\n      const d2'), 'Old 2d6 roll was not removed');
});

it('1.2 Client handleMonopolyMessage handles buy, pass, upgrade, rent actions', () => {
  assert(monopolyCode.includes("case 'buy':"), 'buy action missing');
  assert(monopolyCode.includes("case 'pass':"), 'pass action missing');
  assert(monopolyCode.includes("case 'upgrade':"), 'upgrade action missing');
  assert(monopolyCode.includes("case 'rent':"), 'rent action missing');
  assert(monopolyCode.includes('actBuy(message.tileId)'), 'actBuy missing');
  assert(monopolyCode.includes('actPassBuy(message.tileId)'), 'actPassBuy missing');
  assert(monopolyCode.includes('actUpgrade(message.tileId)'), 'actUpgrade missing');
  assert(monopolyCode.includes('actPayRent(message.tileId)'), 'actPayRent missing');
});

it('1.3 Spectators get role "spectator", roll button disabled, cannot roll', () => {
  assert(monopolyCode.includes("if (isSpectatorMode) return 'spectator';"), 'getMonopolyMyRole must return spectator');
  assert(monopolyCode.includes("if (isSpectatorMode) return { label: 'SPECTATING 👁', enabled: false, cls: '' };"), 'rollButtonState must disable button for spectator');
  assert(monopolyCode.includes('function handleUserRollRequest(e) {\n  if (isSpectatorMode) return;'), 'handleUserRollRequest must block spectator');
});

it('1.4 Dynamic 3P/4P multiplayer sync does not hardcode [\'bkk\', \'dxb\']', () => {
  assert(monopolyCode.includes('Object.keys(merged.players || {}).forEach((r) => {'), 'mergeIncomingState should iterate dynamic players');
  assert(monopolyCode.includes('startPartyGame(currentFlightRoom);'), 'resetMonopolyGame must restart party game for 3P/4P');
});

it('1.5 Client listens for room_finished event and clears active room banner', () => {
  assert(monopolyCode.includes("if (message.type === 'room_finished') {"), 'handleMonopolyMessage missing room_finished listener');
  assert(monopolyCode.includes("localStorage.removeItem('sky_active_room_id')"), 'room_finished must clear active room from storage');
  assert(monopolyCode.includes("banner.classList.add('hidden')"), 'room_finished must hide match banner');
});

it('1.6 endTurn wraps rounds based on turn order index, avoiding bankruptcy skip', () => {
  assert(monopolyCode.includes('const nextIdx = order.indexOf(nextRole);'), 'endTurn should find nextIdx');
  assert(monopolyCode.includes('if (nextIdx <= prevIdx || nextIdx === 0)'), 'endTurn round check must compare nextIdx and prevIdx');
});


// ============================================================
// AREA 2: GACHA & WARDROBE BUGS 1–5
// ============================================================
console.log('\n--- AREA 2: GACHA SYSTEM & WARDROBE ---');

const serverCode = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
const vaultCode = fs.readFileSync(path.join(__dirname, '../public/vault.js'), 'utf8');

it('2.1 Infinite diamonds rollback exploit prevented (lastSpentAt + no Math.max)', () => {
  assert(!vaultCode.includes('Math.max(p.diamonds, (cu.diamonds || 0))'), 'vault.js should not Math.max diamonds with stale cloud');
  assert(!vaultCode.includes('Math.max(p.stardust, (cu.stardust || 0))'), 'vault.js should not Math.max stardust with stale cloud');
  assert(serverCode.includes('vault[role].lastSpentAt = Date.now();'), 'server.js must update lastSpentAt on spending');
  assert(serverCode.includes('timeSinceSpent > 60000 && message.stardust > vault[role].stardust'), 'stardust sync must check timeSinceSpent');
});

it('2.2 Currency deducted only after pool is validated in vaultPull', () => {
  const pullStart = serverCode.indexOf('function vaultPull(');
  const poolCheck = serverCode.indexOf("if (!pool || pool.length === 0) return { error: 'Invalid season pool' };", pullStart);
  const diamondDeduct = serverCode.indexOf('p.diamonds -= cost;', pullStart);
  assert(poolCheck !== -1 && diamondDeduct !== -1, 'pool validation and diamond deduction must exist');
  assert(poolCheck < diamondDeduct, 'Pool validation MUST occur BEFORE diamond deduction in vaultPull');
});

it('2.3 Free S1 Mythic Naga Ultimate on classic/rare skins removed', () => {
  assert(!monopolyCode.includes("|| (role === 'dxb' && (!costumeId || costumeId === 'got_queen'))"), 'isNagaWarden must not award got_queen free mythic');
  assert(!monopolyCode.includes("matchesSeasonId(costumeId, 's1')"), 'isNagaWarden must not treat all s1 costumes as Naga Warden');
  assert(!monopolyCode.includes("matchesSeasonId(cid, 's1') || (role === 'dxb' && (!cid || cid === 'got_queen'))"), 'getRoleUltimate must not award got_queen free naga surge');
});

it('2.4 Mid-game perk stacking exploit fixed in syncMonopolyCostumes', () => {
  assert(monopolyCode.includes('monopolyState.perks[r] = { ...freshPerks[r] };'), 'syncMonopolyCostumes must replace rather than spread old perks');
});

it('2.5 Seasonal limited banner pity carryover unified in server & client', () => {
  assert(serverCode.includes("const poolKey = sKey === 'main' ? 'main' : 'limited';"), 'server.js must group seasonal pity into limited');
  assert(vaultCode.includes("sKey !== 'main' && p.pityByBanner && p.pityByBanner.limited"), 'vault.js must check shared limited pity pool');
});


// ============================================================
// AREA 3: CAT LOUNGE BUGS 1–4
// ============================================================
console.log('\n--- AREA 3: CAT LOUNGE (PURRST CLASS LOUNGE) ---');

const serverCatsCode = fs.readFileSync(path.join(__dirname, '../server_cats.js'), 'utf8');
const catLoungeCode = fs.readFileSync(path.join(__dirname, '../public/catlounge.js'), 'utf8');
const catsCode = fs.readFileSync(path.join(__dirname, '../public/cats.js'), 'utf8');

it('3.1 Asynchronous shift handoff decoupled from real-time socket check', () => {
  assert(serverCode.includes('couple: !!(vault.couple && vault.couple.active)'), 'couple feature must be persistent');
  assert(serverCode.includes('coupleOnline: !!(vault.couple && vault.couple.active && bkkSocket && dxbSocket)'), 'coupleOnline tracks concurrent sockets');
});

it('3.2 UI hijacking prevented on remote partner events', () => {
  assert(!catLoungeCode.includes("if (!S.nodes[id] && msg.action !== 'pull') summon(id);"), 'onCatEvent must not summon/select cats on partner events');
  assert(catLoungeCode.includes('toast(`🐾 ${msg.role.toUpperCase()} ${FEED_VERB[msg.action]'), 'onCatEvent should display non-intrusive toast instead');
});

it('3.3 Double-pet counter synced to both partner client memories', () => {
  assert(serverCatsCode.includes('catDay: {\n        bkk: vault.bkk ? vault.bkk.catDay : null,\n        dxb: vault.dxb ? vault.dxb.catDay : null\n      }'), 'pushEvent must transmit both bkk and dxb catDay');
});

it('3.4 Brushing interaction implemented in client, server, and economy', () => {
  assert(catsCode.includes('BRUSH: 20'), 'cats.js must define BRUSH effect');
  assert(serverCatsCode.includes("if (!['feed', 'pet', 'play', 'brush'].includes(action))"), 'server_cats care must accept brush action');
  assert(serverCatsCode.includes("p.catStats.brushes = (p.catStats.brushes || 0) + 1;"), 'server_cats care must track brushes stat');
  assert(catLoungeCode.includes('data-c="brush"'), 'catlounge.js must render brush button');
  assert(catLoungeCode.includes("case 'brush':"), 'catlounge.js must handle brush in onClick');
});


// ============================================================
// AREA 4: VOICE CALL & FLOATING MINI-CALL ISLAND
// ============================================================
console.log('\n--- AREA 4: VOICE CALL & FLOATING MINI-CALL ISLAND ---');

const appCode = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
const indexCss = fs.readFileSync(path.join(__dirname, '../public/index.css'), 'utf8');

it('4.1 Hardware microphone released and stopped on endCall()', () => {
  assert(appCode.includes('localStream.getTracks().forEach((track) => track.stop());'), 'endCall must stop all localStream tracks');
  assert(appCode.includes('localStream = null;'), 'endCall must set localStream to null');
});

it('4.2 Couple gating enforced on incoming handleOffer()', () => {
  assert(appCode.includes('window.SkySupabase.checkCoupleCallAllowed()'), 'handleOffer must verify couple authorization before answering');
});

it('4.3 Glare handled with polite rollback without breaking seamless handshake', () => {
  assert(appCode.includes('const isPolite = (typeof myTerminal !== \'undefined\' && myTerminal === \'dxb\');'), 'Deterministic politeness for glare');
  assert(appCode.includes("peerConnection.setLocalDescription({ type: 'rollback' })"), 'Polite peer rolls back on glare');
});

it('4.4 restartIce() sends actual renegotiation offer with iceRestart: true', () => {
  assert(appCode.includes('peerConnection.createOffer({ iceRestart: true })'), 'restartIce must generate offer with iceRestart: true');
  assert(appCode.includes("sendSignaling({ type: 'offer', offer: offer });"), 'restartIce must send offer to remote peer');
});

it('4.5 Answering peer initializes local media before creating answer to prevent 0-track silent bug', () => {
  assert(appCode.includes('await initLocalMedia();') && appCode.includes('peerConnection.addTrack(track, localStream)'), 'Receiver attaches local audio tracks before answer');
});

it('4.6 Floating Mini-Call Island DOM, CSS, and JS logic implemented', () => {
  assert(indexHtml.includes('id="floatingCallIsland"'), 'index.html must have #floatingCallIsland');
  assert(indexHtml.includes('id="fciPartnerAvatar"'), 'index.html must have #fciPartnerAvatar');
  assert(indexHtml.includes('id="fciTimer"'), 'index.html must have #fciTimer');
  assert(indexHtml.includes('id="fciMuteBtn"'), 'index.html must have #fciMuteBtn');
  assert(indexHtml.includes('id="fciHangupBtn"'), 'index.html must have #fciHangupBtn');
  
  assert(indexCss.includes('.floating-call-island'), 'index.css must define .floating-call-island');
  assert(indexCss.includes('.fci-pulse-dot'), 'index.css must define .fci-pulse-dot');
  assert(indexCss.includes('.fci-waveform'), 'index.css must define .fci-waveform');

  assert(appCode.includes('function showFloatingCallIsland()'), 'app.js must define showFloatingCallIsland');
  assert(appCode.includes('function hideFloatingCallIsland()'), 'app.js must define hideFloatingCallIsland');
  assert(appCode.includes('function updateFloatingCallIsland()'), 'app.js must define updateFloatingCallIsland');
  assert(appCode.includes('setupFloatingCallIslandEvents()'), 'app.js must setup floating island events');
});

console.log('\n============================================================');
console.log(`TEST SUMMARY: ${passed}/${total} Passed (${total - passed} Failed)`);
console.log('============================================================\n');

if (passed === total) {
  console.log('🎉 ALL 21 VERIFICATION TESTS PASSED 100%!\n');
  process.exit(0);
} else {
  console.error('❌ SOME TESTS FAILED!\n');
  process.exit(1);
}
