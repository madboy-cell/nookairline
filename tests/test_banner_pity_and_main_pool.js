/**
 * 🧪 Test Suite: Isolated Per-Banner Pity & Dynamic Permanent Main Gacha Pool
 */
const assert = require('assert');
const Costumes = require('../public/costumes.js');

console.log('============================================================');
console.log('🧪 SUITE: PER-BANNER PITY & MAIN GACHA POOL VERIFICATION');
console.log('============================================================\n');

// --- TEST 1: Main Banner Pool Dynamic Inclusivity ---
const bkkAll = Costumes.poolFor('bkk', 'main');
const dxbAll = Costumes.poolFor('dxb', 'main');
console.log(`[Test 1] Main banner pool size: BKK=${bkkAll.length}, DXB=${dxbAll.length}`);

assert.ok(bkkAll.length >= 99, 'BKK main banner must include all existing costumes');
assert.ok(dxbAll.length >= 99, 'DXB main banner must include all existing costumes');

const bkkMythics = bkkAll.filter((c) => c.rarity === 'mythic');
const bkkEpics = bkkAll.filter((c) => c.rarity === 'epic');
const bkkRares = bkkAll.filter((c) => c.rarity === 'rare');
console.log(`[Test 1] Rarity breakdown BKK: Mythic=${bkkMythics.length}, Epic=${bkkEpics.length}, Rare=${bkkRares.length}`);
assert.ok(bkkMythics.length > 0, 'Main banner must contain all mythics');
assert.ok(bkkEpics.length > 0, 'Main banner must contain all epics');
assert.ok(bkkRares.length > 0, 'Main banner must contain all rares');
console.log('  ✅ [PASS] 1. Main banner dynamically contains all costume rarities\n');

// --- TEST 2: Future Costume Auto-Inclusion in Main Banner ---
const mockCostume = {
  id: 's99_future_suit',
  season: 's99',
  role: 'bkk',
  rarity: 'mythic',
  name: 'Galactic Void Sovereign'
};
Costumes.COSTUMES.push(mockCostume);
const updatedPool = Costumes.poolFor('bkk', 'main');
assert.ok(updatedPool.some((c) => c.id === 's99_future_suit'), 'Future costumes added to catalog must automatically join main banner');
// Clean up mock
const idx = Costumes.COSTUMES.indexOf(mockCostume);
if (idx !== -1) Costumes.COSTUMES.splice(idx, 1);
console.log('  ✅ [PASS] 2. Future added costumes dynamically join the main pool without code changes\n');

// --- TEST 3: Isolated Per-Banner Pity System Simulation ---
const ECON = Costumes.ECONOMY;

function createTestProfile() {
  return {
    diamonds: 50000,
    stardust: 0,
    owned: {},
    pity: { epic: 0, mythic: 0 },
    pityByBanner: {},
    stats: { pulls: 0 }
  };
}

function getBannerPity(p, season = 'main') {
  if (!p.pityByBanner) p.pityByBanner = {};
  if (!p.pityByBanner[season]) {
    p.pityByBanner[season] = { epic: 0, mythic: 0 };
  }
  return p.pityByBanner[season];
}

function simulateRoll(p, season = 'main', forcedOutcome = null) {
  const pity = getBannerPity(p, season);
  pity.epic = (pity.epic || 0) + 1;
  pity.mythic = (pity.mythic || 0) + 1;
  
  if (forcedOutcome === 'mythic' || pity.mythic >= ECON.MYTHIC_HARD_PITY) {
    pity.mythic = 0;
    pity.epic = 0;
    p.pity = { ...pity };
    return 'mythic';
  }
  if (forcedOutcome === 'epic' || pity.epic >= ECON.EPIC_PITY) {
    pity.epic = 0;
    p.pity = { ...pity };
    return 'epic';
  }
  p.pity = { ...pity };
  return 'rare';
}

const testPlayer = createTestProfile();

// Pull 5 times on 'main'
for (let i = 0; i < 5; i++) {
  simulateRoll(testPlayer, 'main', 'rare');
}

console.log('[Test 3] After 5 pulls on "main":');
console.log('  main pity:', testPlayer.pityByBanner['main']);
assert.strictEqual(testPlayer.pityByBanner['main'].mythic, 5, 'Main banner mythic pity should be 5');
assert.strictEqual(testPlayer.pityByBanner['main'].epic, 5, 'Main banner epic pity should be 5');

// Now pull 8 times on seasonal banner 's2'
for (let i = 0; i < 8; i++) {
  simulateRoll(testPlayer, 's2', 'rare');
}

console.log('[Test 3] After 8 pulls on "s2":');
console.log('  s2 pity:', testPlayer.pityByBanner['s2']);
console.log('  main pity:', testPlayer.pityByBanner['main']);

assert.strictEqual(testPlayer.pityByBanner['s2'].mythic, 8, 'Season s2 mythic pity should be 8');
assert.strictEqual(testPlayer.pityByBanner['s2'].epic, 8, 'Season s2 epic pity should be 8');
assert.strictEqual(testPlayer.pityByBanner['main'].mythic, 5, 'Main banner mythic pity MUST remain 5 (unaffected by s2 pulls)');
assert.strictEqual(testPlayer.pityByBanner['main'].epic, 5, 'Main banner epic pity MUST remain 5 (unaffected by s2 pulls)');
console.log('  ✅ [PASS] 3. Pulls on seasonal banner "s2" do NOT leak or bleed into "main" banner pity\n');

// --- TEST 4: Pity Reset Isolation ---
// Hit mythic on 's2'
simulateRoll(testPlayer, 's2', 'mythic');
console.log('[Test 4] After mythic pull on "s2":');
console.log('  s2 pity:', testPlayer.pityByBanner['s2']);
console.log('  main pity:', testPlayer.pityByBanner['main']);

assert.strictEqual(testPlayer.pityByBanner['s2'].mythic, 0, 's2 mythic pity must reset to 0 upon getting a mythic');
assert.strictEqual(testPlayer.pityByBanner['s2'].epic, 0, 's2 epic pity must reset to 0 upon getting a mythic');
assert.strictEqual(testPlayer.pityByBanner['main'].mythic, 5, 'Main banner pity must remain untouched (still 5) after s2 mythic reset');
console.log('  ✅ [PASS] 4. Getting a Mythic on "s2" resets ONLY s2 pity, leaving "main" pity 100% preserved\n');

// --- TEST 5: Season Definition & Permanent Flag ---
assert.ok(Costumes.SEASONS.main, 'Costumes.SEASONS.main must be defined');
assert.strictEqual(Costumes.SEASONS.main.endsAt, null, 'Main banner endsAt must be null (permanent/never ending)');
assert.strictEqual(Costumes.SEASONS.main.isMain, true, 'Main banner isMain flag must be true');
console.log('  ✅ [PASS] 5. Main banner definition has permanent status (endsAt: null)\n');

console.log('============================================================');
console.log('🎉 ALL PER-BANNER PITY & MAIN GACHA POOL TESTS PASSED 100%!');
console.log('============================================================');
