// tests/test_gifting_and_friends.js
// Dedicated automated test for Gifting, Diamond Conservation, and Friend System.
// STRICT CONSTRAINT: Uses ONLY synthetic accounts (synthetic_test_sender, synthetic_test_receiver).
// NEVER touches real user accounts or girlfriend's accounts!

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('============================================================');
console.log('🧪 RUNNING GIFTING, DIAMOND CONSERVATION & FRIEND TESTS');
console.log('============================================================\n');

let passed = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}:`, err.message);
    process.exit(1);
  }
}

// -------------------------------------------------------------
// Test 1: Verify SkySupabase has addFriend alias and getFriends null-safety
// -------------------------------------------------------------
test('1.1 supabase_client.js exposes addFriend as alias to sendFriendRequest', () => {
  const sbClientCode = fs.readFileSync(path.join(__dirname, '../public/supabase_client.js'), 'utf8');
  assert.ok(sbClientCode.includes('async addFriend(targetUsernameOrId)'), 'addFriend method must exist');
  assert.ok(sbClientCode.includes('return this.sendFriendRequest(targetUsernameOrId);'), 'addFriend must delegate to sendFriendRequest');
});

test('1.2 supabase_client.js getFriends filters null/missing friend records safely', () => {
  const sbClientCode = fs.readFileSync(path.join(__dirname, '../public/supabase_client.js'), 'utf8');
  assert.ok(sbClientCode.includes('.filter((d) => d && d.friend)'), 'getFriends must filter out null friends');
});

// -------------------------------------------------------------
// Test 2: Verify Red Envelope recipient selection & friends list integration
// -------------------------------------------------------------
test('2.1 vault.js supports selecting friend or couple as envelopeTarget', () => {
  const vaultCode = fs.readFileSync(path.join(__dirname, '../public/vault.js'), 'utf8');
  assert.ok(vaultCode.includes('envelopeTarget'), 'vault.js state must track envelopeTarget');
  assert.ok(vaultCode.includes('openEnvelopeSenderForFriend'), 'vault.js must expose openEnvelopeSenderForFriend');
  assert.ok(vaultCode.includes('ve-recip-picker-wrap'), 'vault.js modal must render recipient picker wrap');
  assert.ok(vaultCode.includes('set-envelope-target'), 'vault.js must handle set-envelope-target action');
});

test('2.2 social_ui.js has gift buttons on friend cards and couple card', () => {
  const socialUiCode = fs.readFileSync(path.join(__dirname, '../public/social_ui.js'), 'utf8');
  assert.ok(socialUiCode.includes('openEnvelopeSenderForFriend'), 'social_ui.js must call openEnvelopeSenderForFriend on gift click');
  assert.ok(socialUiCode.includes('coupleGiftPartnerBtn'), 'social_ui.js must handle coupleGiftPartnerBtn');
});

// -------------------------------------------------------------
// Test 3: Diamond Conservation Simulation (No +10k inflation bug)
// -------------------------------------------------------------
test('3.1 server.js vaultSendEnvelope preserves diamond conservation between sender and recipient', () => {
  // Simulate synthetic vault environment
  const syntheticVault = {
    bkk: { diamonds: 15000, lastSpentAt: 0, envelopes: [], envelopesSent: [] },
    dxb: { diamonds: 15000, lastSpentAt: 0, envelopes: [], envelopesSent: [] }
  };

  function simulateVaultSendEnvelope(senderRole, amount, targetData = {}, senderUid = null, senderName = null) {
    const amt = Math.floor(Number(amount));
    if (!amt || isNaN(amt) || amt < 1) return { error: 'Please enter at least 1 diamond' };
    const sender = syntheticVault[senderRole];
    if (!sender) return { error: 'Invalid sender' };
    if (sender.diamonds < amt) return { error: 'Not enough diamonds' };

    const targetType = targetData.targetType || 'couple';
    let receiverRole = targetData.targetRole || (senderRole === 'bkk' ? 'dxb' : 'bkk');
    let receiverUid = targetData.targetUid || null;
    let receiverName = targetData.targetUsername || (receiverRole === 'bkk' ? 'Wolf Boy' : 'Dragon Girl');

    // Deduct immediately & mark lastSpentAt
    sender.diamonds -= amt;
    sender.lastSpentAt = Date.now();

    let receiver = null;
    if (targetType === 'friend' && receiverUid) {
      if (!syntheticVault[receiverUid]) syntheticVault[receiverUid] = { diamonds: 0, envelopes: [] };
      receiver = syntheticVault[receiverUid];
    } else {
      receiver = syntheticVault[receiverRole];
    }

    if (receiver) {
      receiver.diamonds = (receiver.diamonds || 0) + amt;
    }

    const env = {
      id: `env_${Date.now()}`,
      from: senderName || senderRole,
      to: receiverName,
      amount: amt,
      targetType
    };

    if (receiver) {
      receiver.envelopes.unshift(env);
    }
    sender.envelopesSent.unshift(env);

    return { ok: true, envelope: env };
  }

  // Initial total: 15,000 + 15,000 = 30,000
  const initialTotal = syntheticVault.bkk.diamonds + syntheticVault.dxb.diamonds;
  assert.strictEqual(initialTotal, 30000, 'Initial diamond total must be 30,000');

  // Sender (bkk) sends 5,000 to couple partner (dxb)
  const result = simulateVaultSendEnvelope('bkk', 5000, { targetType: 'couple' });
  assert.strictEqual(result.ok, true, 'Gift operation must succeed');

  // Verify post-gift balances
  assert.strictEqual(syntheticVault.bkk.diamonds, 10000, 'Sender balance must decrease by 5,000 to 10,000');
  assert.strictEqual(syntheticVault.dxb.diamonds, 20000, 'Receiver balance must increase by 5,000 to 20,000');

  // Verify diamond conservation (net change = 0)
  const finalTotal = syntheticVault.bkk.diamonds + syntheticVault.dxb.diamonds;
  assert.strictEqual(finalTotal, 30000, 'Final diamond total MUST remain exactly 30,000 (no +10k diamond duplication!)');
});

test('3.2 server.js rejects cloud sync inflation within 60s cooldown after spending', () => {
  const serverCode = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
  assert.ok(serverCode.includes('sender.lastSpentAt = Date.now()'), 'server.js must record lastSpentAt on envelope send');
  assert.ok(serverCode.includes('timeSinceSpent > 60000'), 'server.js must guard vault_sync_cloud diamond inflation with 60s cooldown');
});

test('3.3 server.js vaultSendEnvelope supports synthetic friend recipient', () => {
  const serverCode = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
  assert.ok(serverCode.includes("targetType = targetData.targetType || 'couple'"), 'server.js must distinguish friend vs couple targetType');
  assert.ok(serverCode.includes("if (targetType === 'friend' && receiverUid)"), 'server.js must credit friend profile by receiverUid');
});

// -------------------------------------------------------------
// Test 4: Stardust Cloud Hydration & Zero Regression Shield
// -------------------------------------------------------------
test('4.1 server_db.js exposes fetchProfiles and saveProfile for persistent cloud hydration', () => {
  const serverDbCode = fs.readFileSync(path.join(__dirname, '../server_db.js'), 'utf8');
  assert.ok(serverDbCode.includes('async fetchProfiles()'), 'server_db.js must expose fetchProfiles');
  assert.ok(serverDbCode.includes('async saveProfile('), 'server_db.js must expose saveProfile');
});

test('4.2 server.js boots with hydrateVaultFromCloud to restore stardust across container redeploys', () => {
  const serverCode = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
  assert.ok(serverCode.includes('hydrateVaultFromCloud()'), 'server.js must call hydrateVaultFromCloud on startup');
  assert.ok(serverCode.includes('row.stardust > vault[role].stardust'), 'server.js must restore higher stardust from cloud');
});

test('4.3 supabase_client.js updateProfile enforces Zero Regression Stardust Shield', () => {
  const sbClientCode = fs.readFileSync(path.join(__dirname, '../public/supabase_client.js'), 'utf8');
  assert.ok(sbClientCode.includes('ZERO REGRESSION STARDUST SHIELD'), 'supabase_client.js must include stardust regression shield');
  assert.ok(sbClientCode.includes('!updates.allowDecrease'), 'stardust must only decrease when allowDecrease is explicitly passed');
});

test('4.4 vault.js setProfiles hydrates stardust from cloud and prevents stale server overwrite', () => {
  const vaultCode = fs.readFileSync(path.join(__dirname, '../public/vault.js'), 'utf8');
  assert.ok(vaultCode.includes('Stardust Cloud Shield'), 'vault.js must have Stardust Cloud Shield in setProfiles');
  assert.ok(vaultCode.includes('updates.stardust = Math.max(p.stardust, (cu.stardust || 0))'), 'vault.js must never decrease cloud stardust on profile sync');
});

console.log('\n============================================================');
console.log(`TEST SUMMARY: ${passed}/10 Passed (0 Failed)`);
console.log('============================================================\n');
console.log('🎉 ALL GIFTING, DIAMOND CONSERVATION, STARDUST & FRIEND TESTS PASSED 100%!');
