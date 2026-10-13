/**
 * Test: Friend Request Capabilities & Soft Couple Break Wording
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('============================================================');
console.log('🧪 TEST: FRIEND REQUESTS & SOFT COUPLE BREAK SUITE');
console.log('============================================================\n');

function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(err);
    process.exit(1);
  }
}

async function runTestAsync(name, fn) {
  try {
    await fn();
    console.log(`  ✅ [PASS] ${name}`);
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(err);
    process.exit(1);
  }
}

// -------------------------------------------------------------
// 1. DOM Markup Validation for Soft Break Wording
// -------------------------------------------------------------
runTest('1.1 index.html uses soft Take a Break wording instead of harsh Decouple', () => {
  const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
  assert.ok(html.includes('id="coupleDecoupleBtn"'), 'Button ID must remain coupleDecoupleBtn for compatibility');
  assert.ok(html.includes('Take a Break'), 'Button label must be Take a Break');
  assert.ok(!html.includes('💔 Decouple'), 'Harsh broken heart Decouple text must be replaced');
  assert.ok(html.includes('Peace of Mind'), 'Safety hint must provide sweet Peace of Mind reassurance');
});

runTest('1.2 social_ui.js uses gentle confirmation prompt when taking a couple break', () => {
  const code = fs.readFileSync(path.join(__dirname, '../public/social_ui.js'), 'utf8');
  assert.ok(code.includes('sweet break for now'), 'Confirmation dialog must use gentle, loving tone');
  assert.ok(!code.includes('Are you sure you want to decouple?'), 'Harsh decouple prompt must be eliminated');
});

// -------------------------------------------------------------
// 2. SkySupabase Friend System & Couple Break Logic
// -------------------------------------------------------------
runTest('2.1 supabase_client.js exposes takeBreak as soft alias to decouple', () => {
  const code = fs.readFileSync(path.join(__dirname, '../public/supabase_client.js'), 'utf8');
  assert.ok(code.includes('async takeBreak()'), 'takeBreak method must exist');
  assert.ok(code.includes('return this.decouple();'), 'takeBreak must delegate to decouple');
});

runTest('2.2 supabase_client.js guards against self-friending', () => {
  const code = fs.readFileSync(path.join(__dirname, '../public/supabase_client.js'), 'utf8');
  assert.ok(code.includes('Cannot add yourself as a friend') || code.includes('cannot add yourself as a friend'), 'Self-add guard must exist');
});

runTest('2.3 supabase_client.js queries friendships bi-directionally (sender and receiver)', () => {
  const code = fs.readFileSync(path.join(__dirname, '../public/supabase_client.js'), 'utf8');
  assert.ok(code.includes('sender:profiles!friendships_user_id_fkey'), 'Must fetch sender profile');
  assert.ok(code.includes('friend:profiles!friendships_friend_id_fkey'), 'Must fetch receiver profile');
  assert.ok(code.includes('.or(`user_id.eq.'), 'Must query where current user is user_id or friend_id');
});

(async () => {
  // -------------------------------------------------------------
  // 3. Functional Simulation of Friends & Break
  // -------------------------------------------------------------
  await runTestAsync('3.1 Local Provider handles addFriend, mutual listing, and takeBreak', async () => {
    // Load supabase_client in simulated environment
    const storage = {};
    const ctx = {
      window: null,
      console,
      setTimeout,
      clearTimeout,
      setInterval,
      clearInterval,
      localStorage: {
        getItem: (k) => storage[k] || null,
        setItem: (k, v) => { storage[k] = String(v); },
        removeItem: (k) => { delete storage[k]; }
      },
      dispatchEvent: () => {},
      CustomEvent: class { constructor(t, d) { this.type = t; this.detail = d; } }
    };
    ctx.window = ctx;

    const sbCode = fs.readFileSync(path.join(__dirname, '../public/supabase_client.js'), 'utf8');
    vm.createContext(ctx);
    vm.runInContext(sbCode, ctx);

    const client = ctx.SkySupabase;
    client.currentUser = { id: 'user_wolf_1', username: 'WolfBoy', character_base: 'bkk', diamonds: 15000 };

    // 1. Cannot add self
    let threwSelf = false;
    try {
      await client.addFriend('WolfBoy');
    } catch (e) {
      threwSelf = true;
    }
    assert.strictEqual(threwSelf, true, 'Adding self must throw error');

    // 2. Add companion DragonGirl
    const friend = await client.addFriend('DragonGirl');
    assert.ok(friend);
    assert.strictEqual(friend.username, 'DragonGirl');

    // 3. List friends
    const friends = await client.getFriends();
    assert.strictEqual(friends.length, 1);
    assert.strictEqual(friends[0].username, 'DragonGirl');

    // 4. Test soft takeBreak
    client.coupleStatus = { isCouple: true, coupleId: 'couple_test_1', partner: 'DragonGirl' };
    const breakRes = await client.takeBreak();
    assert.strictEqual(breakRes.success, true);
    assert.strictEqual(breakRes.diamondsPreserved, true);
    assert.strictEqual(client.coupleStatus.isCouple, false);
  });

  console.log('\n============================================================');
  console.log('🎉 ALL FRIEND REQUEST & SOFT COUPLE BREAK TESTS PASSED 100%!');
  console.log('============================================================\n');
  process.exit(0);
})();
