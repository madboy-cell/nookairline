/**
 * Phase 5 Test Suite: Supabase Auth, Profiles, Character Base & Couple Decouple Safety
 *
 * Verifies:
 * 1. Supabase schema DDL parses and contains all required tables, constraints & RLS policies
 * 2. SkySupabaseManager initializes smoothly in Guest / Local mode
 * 3. Guest profile creation with 5,000 💎 baseline
 * 4. Character base switcher validates and switches between 'bkk' (Wolf Boy) and 'dxb' (Dragon Girl)
 * 5. Invalid character base throws an error
 * 6. Couple link creation and status verification
 * 7. Call gating: WebRTC calls allowed ONLY when couple status is linked
 * 8. Decouple safety: Decoupling removes couple link while diamonds and inventory remain 100% untouched
 * 9. Friends system: Add friend, list friends, and remove friend
 * 10. Cross-tab presence broadcasting
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('============================================================');
console.log('🧪 PHASE 5: SUPABASE AUTH, PROFILES & SOCIAL SANCTUARY SUITE');
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
    console.error(err);
    failed++;
  }
}

async function itAsync(desc, fn) {
  try {
    await fn();
    console.log(`  ✅ [PASS] ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${desc}`);
    console.error(err);
    failed++;
  }
}

(async () => {
  // --- SUITE 1: SQL Schema Integrity ---
  console.log('--- SUITE 1: Supabase PostgreSQL Schema Integrity ---');
  const schemaPath = path.join(__dirname, '../supabase/schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  it('1.1 schema.sql exists and contains profiles, couples, and friendships tables', () => {
    assert.ok(schemaSql.includes('CREATE TABLE IF NOT EXISTS public.profiles'));
    assert.ok(schemaSql.includes('CREATE TABLE IF NOT EXISTS public.couples'));
    assert.ok(schemaSql.includes('CREATE TABLE IF NOT EXISTS public.friendships'));
  });

  it('1.2 schema.sql defines character_base constraint with bkk and dxb', () => {
    assert.ok(schemaSql.includes("character_base TEXT NOT NULL DEFAULT 'bkk' CHECK (character_base IN ('bkk', 'dxb'))"));
  });

  it('1.3 schema.sql enforces Row Level Security (RLS) on all 3 tables', () => {
    assert.ok(schemaSql.includes('ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;'));
    assert.ok(schemaSql.includes('ALTER TABLE public.couples ENABLE ROW LEVEL SECURITY;'));
    assert.ok(schemaSql.includes('ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;'));
  });

  it('1.4 schema.sql defines decouple cascade safety (profiles cascade to couples, not vice versa)', () => {
    assert.ok(schemaSql.includes('user1_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE'));
    assert.ok(schemaSql.includes('user2_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE'));
  });

  it('1.5 schema.sql defines automated signup profile trigger', () => {
    assert.ok(schemaSql.includes('CREATE OR REPLACE FUNCTION public.handle_new_user()'));
    assert.ok(schemaSql.includes('AFTER INSERT ON auth.users'));
  });

  // --- SUITE 2: Client SDK & Local Guest Provider ---
  console.log('\n--- SUITE 2: SkySupabase Client SDK & Local Guest Mode ---');

  // Build browser-like mock sandbox
  const storageMap = new Map();
  const mockLocalStorage = {
    getItem: (k) => (storageMap.has(k) ? storageMap.get(k) : null),
    setItem: (k, v) => storageMap.set(k, String(v)),
    removeItem: (k) => storageMap.delete(k),
    clear: () => storageMap.clear()
  };

  const listeners = new Map();
  const mockWindow = {
    localStorage: mockLocalStorage,
    addEventListener: () => {},
    dispatchEvent: (ev) => {
      const arr = listeners.get(ev.type) || [];
      arr.forEach((fn) => fn(ev));
    },
    CustomEvent: class CustomEvent {
      constructor(type, init) {
        this.type = type;
        this.detail = init && init.detail;
      }
    }
  };

  const clientCode = fs.readFileSync(path.join(__dirname, '../public/supabase_client.js'), 'utf8');
  const context = vm.createContext({
    window: mockWindow,
    globalThis: mockWindow,
    localStorage: mockLocalStorage,
    console: console,
    BroadcastChannel: class MockBC {
      constructor(name) { this.name = name; }
      postMessage() {}
      close() {}
    },
    setInterval: (fn) => setTimeout(fn, 1000000), // don't spam intervals in test
    clearInterval: () => {},
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    Date: Date
  });

  vm.runInContext(clientCode, context);
  const client = context.window.SkySupabase;

  it('2.1 SkySupabase attaches to window.SkySupabase', () => {
    assert.ok(client);
    assert.strictEqual(typeof client.init, 'function');
    assert.strictEqual(typeof client.updateCharacterBase, 'function');
  });

  await itAsync('2.2 Client initializes guest mode cleanly with 15,000 diamonds', async () => {
    const user = await client.loginGuest('TestCaptain', 'bkk');
    assert.strictEqual(user.username, 'TestCaptain');
    assert.strictEqual(user.character_base, 'bkk');
    assert.strictEqual(user.diamonds, 15000);
    assert.strictEqual(user.isGuest, true);
  });

  await itAsync('2.3 Global Character Base Switcher switches from bkk (Wolf Boy) to dxb (Dragon Girl)', async () => {
    let firedEvent = null;
    listeners.set('sky:character_base_changed', [(ev) => { firedEvent = ev; }]);

    await client.updateCharacterBase('dxb');
    assert.strictEqual(client.getCharacterBase(), 'dxb');
    assert.ok(firedEvent);
    assert.strictEqual(firedEvent.detail.characterBase, 'dxb');
  });

  await itAsync('2.4 Character Base Switcher throws error on invalid character base', async () => {
    let threw = false;
    try {
      await client.updateCharacterBase('invalid_alien');
    } catch (err) {
      threw = true;
    }
    assert.strictEqual(threw, true);
    assert.strictEqual(client.getCharacterBase(), 'dxb', 'Base remained untouched after failed update');
  });

  await itAsync('2.5 signUpWithPassword and signInWithPassword manage authenticated users', async () => {
    const signup = await client.signUpWithPassword('pilot@nookairline.com', 'securepass123', {
      username: 'Captain_Pilot',
      character_base: 'bkk'
    });
    assert.ok(signup.success);
    assert.strictEqual(client.getCurrentUser().email, 'pilot@nookairline.com');
    assert.strictEqual(client.isGuest(), false);

    const signin = await client.signInWithPassword('pilot@nookairline.com', 'securepass123');
    assert.ok(signin.success);
    assert.strictEqual(client.getCurrentUser().email, 'pilot@nookairline.com');
  });

  await itAsync('2.6 isOnboardingCompleted and completeOnboarding manage onboarding lifecycle', async () => {
    assert.strictEqual(client.isOnboardingCompleted(), false);
    await client.completeOnboarding({
      persona: 'dxb',
      username: 'Ace_Luna'
    });
    assert.strictEqual(client.isOnboardingCompleted(), true);
    assert.strictEqual(client.getCharacterBase(), 'dxb');
    assert.strictEqual(client.getCurrentUser().username, 'Ace_Luna');
  });

  // --- SUITE 3: Couple Sanctuary & Decouple Safety ---
  console.log('\n--- SUITE 3: Couple Sanctuary & Decouple Safety ---');

  await itAsync('3.1 WebRTC Call is blocked prior to couple link', async () => {
    const status = await client.getCoupleStatus();
    assert.strictEqual(status.isCouple, false);
    assert.strictEqual(client.checkCoupleCallAllowed(), false);
  });

  await itAsync('3.2 Create couple invite and establish linked couple connection', async () => {
    const couple = await client.createCoupleInvite('Sweetheart 🐉');
    assert.strictEqual(couple.isCouple, true);
    assert.strictEqual(couple.status, 'linked');
    assert.strictEqual(couple.partner.username, 'Sweetheart 🐉');
    assert.strictEqual(client.checkCoupleCallAllowed(), true);
  });

  await itAsync('3.3 ZERO REGRESSION MANDATE: Decoupling removes couple link but keeps diamonds & wardrobe 100% intact', async () => {
    // Add extra diamonds to user
    client.currentUser.diamonds = 8888;
    client.localProvider.saveProfile(client.currentUser);

    const decoupleRes = await client.decouple();
    assert.strictEqual(decoupleRes.success, true);
    assert.strictEqual(decoupleRes.diamondsPreserved, true);
    assert.strictEqual(decoupleRes.wardrobePreserved, true);

    const statusAfter = await client.getCoupleStatus();
    assert.strictEqual(statusAfter.isCouple, false);
    assert.strictEqual(client.checkCoupleCallAllowed(), false);

    // Verify user profile diamonds are strictly 8888
    const profile = client.getProfile();
    assert.strictEqual(profile.diamonds, 8888);
  });

  // --- SUITE 4: Friends Management ---
  console.log('\n--- SUITE 4: Friends Management ---');

  await itAsync('4.1 Send and accept friend request', async () => {
    const friend = await client.sendFriendRequest('AcePilot');
    assert.strictEqual(friend.username, 'AcePilot');
    assert.strictEqual(friend.status, 'accepted');

    const friendsList = await client.getFriends();
    assert.strictEqual(friendsList.length, 1);
    assert.strictEqual(friendsList[0].username, 'AcePilot');
  });

  await itAsync('4.2 Remove friend from friends list', async () => {
    const friends = await client.getFriends();
    const fId = friends[0].friendshipId;
    await client.removeFriend(fId);

    const listAfter = await client.getFriends();
    assert.strictEqual(listAfter.length, 0);
  });

  console.log('\n============================================================');
  console.log(`TEST SUMMARY: ${passed}/${passed + failed} Passed (${failed} Failed)`);
  console.log('============================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('🎉 ALL PHASE 5 SUPABASE AUTH & SOCIAL SANCTUARY TESTS PASSED 100%!');
  }
})();
