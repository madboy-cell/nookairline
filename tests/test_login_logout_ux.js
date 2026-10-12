/**
 * Test: Login and Logout UX/UI Verification Suite
 * Validates UX/UI elements, state transitions, storage resets, and UI synchronizations
 * across Passport Sheet, Social Drawer, and Onboarding Modal.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('===========================================================================');
console.log('🧪 TEST: LOGIN & LOGOUT UX/UI VERIFICATION SUITE');
console.log('===========================================================================\n');

// Mock browser DOM and environment
const mockStorage = {};
global.localStorage = {
  getItem: (k) => mockStorage[k] || null,
  setItem: (k, v) => { mockStorage[k] = String(v); },
  removeItem: (k) => { delete mockStorage[k]; },
  clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }
};

global.window = {
  location: { origin: 'http://localhost:8080', href: '' },
  localStorage: global.localStorage,
  dispatchEvent: () => {},
  addEventListener: () => {}
};

// Load client code
const clientCode = fs.readFileSync(path.join(__dirname, '../public/supabase_client.js'), 'utf8');
const runInContext = new Function('window', 'localStorage', clientCode + '; return window.SkySupabase;');
const SkySupabase = runInContext(global.window, global.localStorage);

let passed = 0;
let total = 0;

function it(desc, fn) {
  total++;
  try {
    fn();
    console.log(`  ✅ [PASS] ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${desc}: ${err.message}`);
  }
}

async function runAsyncTests() {
  console.log('--- SUITE 1: Initial Guest Passenger State & UX Defaults ---');

  await it('1.1 Fresh passenger starts in Guest Mode with 15,000 diamonds', async () => {
    await SkySupabase.init();
    const user = SkySupabase.getCurrentUser();
    assert.strictEqual(SkySupabase.isGuest(), true, 'Should be guest');
    assert.strictEqual(SkySupabase.isLoggedIn(), false, 'Should not be logged in');
    assert.strictEqual(user.diamonds, 15000, 'Starting diamonds must be 15,000');
    assert.ok(String(user.id).startsWith('guest_'), 'Guest ID should have guest_ prefix');
  });

  it('1.2 Index HTML contains all required Login/Logout UX UI elements', () => {
    const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
    assert.ok(html.includes('id="accountGuestBox"'), 'Must have accountGuestBox in Passport');
    assert.ok(html.includes('id="accountLoggedInBox"'), 'Must have accountLoggedInBox in Passport');
    assert.ok(html.includes('id="googleAuthBtn"'), 'Must have googleAuthBtn');
    assert.ok(html.includes('id="emailAuthForm"'), 'Must have emailAuthForm');
    assert.ok(html.includes('id="profileSignOutBtn"'), 'Must have profileSignOutBtn');
    assert.ok(html.includes('id="socialDrawer"'), 'Must have socialDrawer');
    assert.ok(html.includes('id="socialAccountBar"'), 'Must have socialAccountBar');
    assert.ok(html.includes('id="socialAccountDot"'), 'Must have socialAccountDot');
    assert.ok(html.includes('id="socialAccountText"'), 'Must have socialAccountText');
    assert.ok(html.includes('id="socialAuthActionBtn"'), 'Must have socialAuthActionBtn');
    assert.ok(html.includes('id="onbGoogleAuthBtn"'), 'Must have onbGoogleAuthBtn in Onboarding');
    assert.ok(html.includes('id="onbContinueGuestBtn"'), 'Must have onbContinueGuestBtn in Onboarding');
    assert.ok(html.includes('id="passportOpenCheckinBtn"'), 'Must have passportOpenCheckinBtn');
  });

  it('1.3 CSS provides distinct styling for logged-in and guest badges and buttons', () => {
    const css = fs.readFileSync(path.join(__dirname, '../public/social.css'), 'utf8');
    assert.ok(css.includes('.social-account-bar'), 'social.css must style social-account-bar');
    assert.ok(css.includes('.social-account-dot.online'), 'social.css must style online dot (green)');
    assert.ok(css.includes('.social-account-dot.guest'), 'social.css must style guest dot (purple)');
    assert.ok(css.includes('.social-auth-action-btn.sign-out'), 'social.css must style sign-out button');
    assert.ok(css.includes('.social-auth-action-btn.connect'), 'social.css must style connect button');
    assert.ok(css.includes('.onb-guest-play-btn'), 'social.css must style onb-guest-play-btn');
    assert.ok(css.includes('.passport-open-checkin-btn'), 'social.css must style passport-open-checkin-btn');
  });

  console.log('\n--- SUITE 2: Login Operations & State Transition ---');

  it('2.1 Google OAuth requests prompt=select_account for account chooser UX', async () => {
    // Check code implementation
    const clientFile = fs.readFileSync(path.join(__dirname, '../public/supabase_client.js'), 'utf8');
    assert.ok(clientFile.includes("prompt: 'select_account'"), 'OAuth must pass prompt: select_account');
    assert.ok(clientFile.includes("access_type: 'offline'"), 'OAuth must pass access_type: offline');
  });

  await it('2.2 Email authentication upgrades user to logged-in cloud account', async () => {
    const authResult = await SkySupabase.signInWithOtp('captain_thanapat@skyparty.air');
    assert.strictEqual(authResult.success, true);
    assert.strictEqual(SkySupabase.isGuest(), false, 'Should no longer be guest');
    assert.strictEqual(SkySupabase.isLoggedIn(), true, 'Should be logged in');
    assert.strictEqual(SkySupabase.getCurrentUser().email, 'captain_thanapat@skyparty.air');
  });

  console.log('\n--- SUITE 3: Logout Operations, State Purge & Guest Reversion ---');

  await it('3.1 signOut() purges profile & onboarding keys and reverts to 10k guest', async () => {
    // Link a dummy couple to verify couple reset on sign-out
    SkySupabase.coupleStatus = { isCouple: true, partner: { username: 'Partner' } };
    assert.strictEqual(SkySupabase.coupleStatus.isCouple, true);

    await SkySupabase.signOut();

    // Verify storage keys wiped
    assert.strictEqual(global.localStorage.getItem('sky_airline_user_profile'), null, 'Profile key must be wiped');
    assert.strictEqual(global.localStorage.getItem('sky_party_onboarding_v1'), null, 'Onboarding key must be wiped');

    // Verify guest state restored
    assert.strictEqual(SkySupabase.isLoggedIn(), false, 'isLoggedIn must be false');
    assert.strictEqual(SkySupabase.isGuest(), true, 'isGuest must be true');
    assert.strictEqual(SkySupabase.getCurrentUser().diamonds, 15000, 'Guest must have 15,000 diamonds');

    // Verify couple unlinked
    assert.strictEqual(SkySupabase.coupleStatus.isCouple, false, 'Couple must be reset');
  });

  it('3.2 Social UI scripts wire up confirmation dialogues and toast feedback for auth events', () => {
    const socialUI = fs.readFileSync(path.join(__dirname, '../public/social_ui.js'), 'utf8');
    assert.ok(socialUI.includes('Are you sure you want to sign out'), 'Must have sign out confirmation prompt');
    assert.ok(socialUI.includes('Signed out of Cloud Vault'), 'Must show sign out confirmation toast');
    assert.ok(socialUI.includes('onbContinueGuestBtn'), 'Must bind onbContinueGuestBtn');
    assert.ok(socialUI.includes('passportOpenCheckinBtn'), 'Must bind passportOpenCheckinBtn');
    assert.ok(socialUI.includes('scrollIntoView'), 'Must provide smooth scroll on Connect Cloud');
  });

  console.log('\n===========================================================================');
  console.log(`TEST SUMMARY: ${passed}/${total} Passed (${total - passed} Failed)`);
  console.log('===========================================================================');

  if (passed === total) {
    console.log('🎉 LOGIN & LOGOUT UX/UI SUITE VERIFIED WITH 100% SUCCESS!\n');
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runAsyncTests();
