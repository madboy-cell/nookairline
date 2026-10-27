// tests/voice_call.test.js — Phase 5 Voice Call Service tests (node:test).
import test from 'node:test';
import assert from 'node:assert/strict';
import { CALL } from '../shared/phase5_rules.js';
import { ensurePhase5, createDailyService } from '../server/daily_service.js';
import { createVoiceCallService } from '../server/voice_call_service.js';

function makeProfile(id, overrides = {}) {
  const p = {
    id,
    username: id.toUpperCase(),
    gold: 5000,
    diamonds: 500,
    berries: 500,
    friends: [],
    partner_id: null,
    level: 10,
    exp: 0,
    ...overrides,
  };
  return ensurePhase5(p);
}

function createTestHarness({ profiles = [], now = () => 1000000 } = {}) {
  const pMap = new Map();
  for (const p of profiles) pMap.set(p.id, p);

  const sentMessages = [];
  const onlineUsers = new Set(profiles.map((p) => p.id));
  const granted = [];

  const getProfile = (id) => pMap.get(id);
  const isOnline = (id) => onlineUsers.has(id);
  const send = (to, msg) => { sentMessages.push({ to, msg }); };
  const grant = (userId, rewards) => { granted.push({ userId, ...rewards }); };

  const dailyService = createDailyService({
    db: { getProfile, markProfile: () => {} },
    now,
  });

  const voiceService = createVoiceCallService({
    getProfile,
    isOnline,
    send,
    now,
    canCall: dailyService.canCall,
    grant,
  });

  return {
    pMap,
    sentMessages,
    onlineUsers,
    granted,
    voiceService,
    getSentFor: (userId) => sentMessages.filter((m) => m.to === userId).map((m) => m.msg),
  };
}

test('invite -> accept -> signal relay -> hangup', () => {
  let currentTime = 1000000;
  const now = () => currentTime;

  const u1 = makeProfile('u1', { partner_id: 'u2' });
  const u2 = makeProfile('u2', { partner_id: 'u1' });
  const h = createTestHarness({ profiles: [u1, u2], now });

  // 1. Invite
  const invRes = h.voiceService.handle('u1', { type: 'call_invite', to: 'u2' });
  assert.equal(invRes.ok, true);
  const callId = invRes.callId;

  const u2Msgs = h.getSentFor('u2');
  const u1Msgs = h.getSentFor('u1');
  assert.equal(u2Msgs[0].type, 'call_incoming');
  assert.equal(u2Msgs[0].callId, callId);
  assert.equal(u2Msgs[0].from, 'u1');
  assert.equal(u1Msgs[0].type, 'call_ringing');
  assert.equal(u1Msgs[0].callId, callId);

  // 2. Accept
  currentTime += 2000;
  const accRes = h.voiceService.handle('u2', { type: 'call_accept', callId });
  assert.equal(accRes.ok, true);

  const u1Conn = h.getSentFor('u1').find((m) => m.type === 'call_connected');
  const u2Conn = h.getSentFor('u2').find((m) => m.type === 'call_connected');
  assert.ok(u1Conn);
  assert.ok(u2Conn);
  assert.equal(u1Conn.polite, false); // caller is not polite
  assert.equal(u2Conn.polite, true);  // callee is polite
  assert.ok(Array.isArray(u1Conn.ice.iceServers));

  // 3. Signal relay
  const sigData = { type: 'offer', sdp: 'v=0...' };
  const sigRes = h.voiceService.handle('u1', { type: 'call_signal', callId, data: sigData });
  assert.equal(sigRes.ok, true);

  const u2Sig = h.getSentFor('u2').find((m) => m.type === 'call_signal');
  assert.ok(u2Sig);
  assert.deepEqual(u2Sig.data, sigData);

  // Signal size cap (CALL.SIGNAL_MAX = 16384 bytes)
  const hugeData = 'x'.repeat(16385);
  const hugeRes = h.voiceService.handle('u1', { type: 'call_signal', callId, data: hugeData });
  assert.equal(hugeRes.ok, false);
  assert.equal(hugeRes.error, 'signal_too_large');

  // 4. Hangup
  currentTime += 5000;
  const hangRes = h.voiceService.handle('u1', { type: 'call_hangup', callId });
  assert.equal(hangRes.ok, true);
  assert.equal(hangRes.durationMs, 5000);

  const u1End = h.getSentFor('u1').find((m) => m.type === 'call_ended' && m.reason === 'hangup');
  const u2End = h.getSentFor('u2').find((m) => m.type === 'call_ended' && m.reason === 'hangup');
  assert.ok(u1End);
  assert.ok(u2End);
  assert.equal(h.voiceService.activeCallOf('u1'), null);
});

test('locked when not partner/friend without vip', () => {
  let currentTime = 1000000;
  const now = () => currentTime;

  const u1 = makeProfile('u1');
  const stranger = makeProfile('stranger');
  const friendNoVip = makeProfile('friend_no_vip');
  u1.friends = ['friend_no_vip'];

  const h = createTestHarness({ profiles: [u1, stranger, friendNoVip], now });

  // 1. Calling stranger -> call_locked
  const r1 = h.voiceService.handle('u1', { type: 'call_invite', to: 'stranger' });
  assert.equal(r1.ok, false);
  assert.equal(r1.error, 'call_locked');

  // 2. Calling friend without any VIP privilege -> call_locked
  const r2 = h.voiceService.handle('u1', { type: 'call_invite', to: 'friend_no_vip' });
  assert.equal(r2.ok, false);
  assert.equal(r2.error, 'call_locked');

  // 3. Grant Day Pass -> call succeeds!
  u1.vip.call_until = currentTime + 3600000;
  const r3 = h.voiceService.handle('u1', { type: 'call_invite', to: 'friend_no_vip' });
  assert.equal(r3.ok, true);
  assert.ok(r3.callId);
});

test('busy', () => {
  let currentTime = 1000000;
  const now = () => currentTime;

  const u1 = makeProfile('u1', { partner_id: 'u2' });
  const u2 = makeProfile('u2', { partner_id: 'u1' });
  const u3 = makeProfile('u3', { partner_id: 'u2' });
  const h = createTestHarness({ profiles: [u1, u2, u3], now });

  // u1 calls u2 and connects
  const inv = h.voiceService.handle('u1', { type: 'call_invite', to: 'u2' });
  h.voiceService.handle('u2', { type: 'call_accept', callId: inv.callId });

  // u3 tries to call u2 while u2 is in call
  const busyRes = h.voiceService.handle('u3', { type: 'call_invite', to: 'u2' });
  assert.equal(busyRes.ok, false);
  assert.equal(busyRes.error, 'busy');

  const u3Msgs = h.getSentFor('u3');
  assert.equal(u3Msgs[0].type, 'call_busy');

  // u1 tries to call u3 while u1 is already in call
  const u1Busy = h.voiceService.handle('u1', { type: 'call_invite', to: 'u3' });
  assert.equal(u1Busy.ok, false);
  assert.equal(u1Busy.error, 'busy');
});

test('glare merge', () => {
  let currentTime = 1000000;
  const now = () => currentTime;

  // uA and uB invite each other almost simultaneously
  const uA = makeProfile('user_a', { partner_id: 'user_b' });
  const uB = makeProfile('user_b', { partner_id: 'user_a' });
  const h = createTestHarness({ profiles: [uA, uB], now });

  // 1. uB calls uA -> state is ringing
  const inv1 = h.voiceService.handle('user_b', { type: 'call_invite', to: 'user_a' });
  assert.equal(inv1.ok, true);

  // 2. uA calls uB while uB is ringing uA -> Glare merge!
  const inv2 = h.voiceService.handle('user_a', { type: 'call_invite', to: 'user_b' });
  assert.equal(inv2.ok, true);
  assert.equal(inv2.merged, true);

  // Session auto-connected with caller = min(user_a, user_b) = 'user_a'
  const session = h.voiceService.activeCallOf('user_a');
  assert.ok(session);
  assert.equal(session.state, 'connected');
  assert.equal(session.callerId, 'user_a');
  assert.equal(session.calleeId, 'user_b');

  const aMsgs = h.getSentFor('user_a');
  const bMsgs = h.getSentFor('user_b');
  const aConn = aMsgs.find((m) => m.type === 'call_connected');
  const bConn = bMsgs.find((m) => m.type === 'call_connected');
  assert.ok(aConn);
  assert.ok(bConn);
  assert.equal(aConn.polite, false);
  assert.equal(bConn.polite, true);
});

test('ring timeout', () => {
  let currentTime = 1000000;
  const now = () => currentTime;

  const u1 = makeProfile('u1', { partner_id: 'u2' });
  const u2 = makeProfile('u2', { partner_id: 'u1' });
  const h = createTestHarness({ profiles: [u1, u2], now });

  const inv = h.voiceService.handle('u1', { type: 'call_invite', to: 'u2' });
  assert.equal(inv.ok, true);

  // Tick before 30 s
  currentTime += 29000;
  h.voiceService.tick(currentTime);
  assert.ok(h.voiceService.activeCallOf('u1'));

  // Tick at 30 s (CALL.RING_MS)
  currentTime += 1001;
  h.voiceService.tick(currentTime);

  // Both should receive call_ended with reason 'no_answer'
  const u1End = h.getSentFor('u1').find((m) => m.type === 'call_ended');
  const u2End = h.getSentFor('u2').find((m) => m.type === 'call_ended');
  assert.ok(u1End);
  assert.ok(u2End);
  assert.equal(u1End.reason, 'no_answer');
  assert.equal(u2End.reason, 'no_answer');
  assert.equal(h.voiceService.activeCallOf('u1'), null);
});

test('15-min ticker grants both (+30 black)', () => {
  let currentTime = 1000000;
  const now = () => currentTime;

  const u1 = makeProfile('u1', { partner_id: 'u2' });
  const u2 = makeProfile('u2', { partner_id: 'u1' });
  const h = createTestHarness({ profiles: [u1, u2], now });

  const inv = h.voiceService.handle('u1', { type: 'call_invite', to: 'u2' });
  h.voiceService.handle('u2', { type: 'call_accept', callId: inv.callId });

  // 1. Advance by 14 minutes -> no rewards yet
  currentTime += 14 * 60 * 1000;
  h.voiceService.tick(currentTime);
  assert.equal(h.granted.length, 0);

  // 2. Advance to 15 minutes -> standard reward (+20 diamonds, +50 EXP)
  currentTime += 1 * 60 * 1000;
  h.voiceService.tick(currentTime);
  assert.equal(h.granted.length, 2); // both u1 and u2
  assert.equal(h.granted[0].diamonds, 20);
  assert.equal(h.granted[0].exp, 50);
  assert.equal(h.granted[1].diamonds, 20);
  assert.equal(h.granted[1].exp, 50);

  const u1Rew = h.getSentFor('u1').find((m) => m.type === 'call_reward');
  assert.ok(u1Rew);
  assert.equal(u1Rew.chunks, 1);
  assert.equal(u1Rew.diamonds, 20);

  // 3. One party obtains Black VIP -> ticker upgrades to +30 diamonds
  u1.vip.black = true;
  currentTime += 15 * 60 * 1000;
  h.voiceService.tick(currentTime);

  assert.equal(h.granted.length, 4);
  assert.equal(h.granted[2].diamonds, 30);
  assert.equal(h.granted[3].diamonds, 30);

  const u1Rew2 = h.getSentFor('u1').filter((m) => m.type === 'call_reward')[1];
  assert.equal(u1Rew2.chunks, 2);
  assert.equal(u1Rew2.diamonds, 30);
});

test('grace expiry ends call', () => {
  let currentTime = 1000000;
  const now = () => currentTime;

  const u1 = makeProfile('u1', { partner_id: 'u2' });
  const u2 = makeProfile('u2', { partner_id: 'u1' });
  const h = createTestHarness({ profiles: [u1, u2], now });

  const inv = h.voiceService.handle('u1', { type: 'call_invite', to: 'u2' });
  h.voiceService.handle('u2', { type: 'call_accept', callId: inv.callId });

  // Disconnect u1
  currentTime += 10000;
  h.voiceService.onDisconnect('u1');

  // Within 15s grace period: call survives
  currentTime += 10000;
  h.voiceService.tick(currentTime);
  assert.ok(h.voiceService.activeCallOf('u2'));

  // Exceed 15s grace (CALL.GRACE_MS = 15000 ms)
  currentTime += 6000;
  h.voiceService.tick(currentTime);

  const u2End = h.getSentFor('u2').find((m) => m.type === 'call_ended' && m.reason === 'grace_expired');
  assert.ok(u2End);
  assert.equal(h.voiceService.activeCallOf('u1'), null);
});

test('self-healing: call_heal from either peer, same-pair re-dial resume, and 90s post-grace auto-recovery', () => {
  let currentTime = 1000000;
  const now = () => currentTime;

  const u1 = makeProfile('u1', { partner_id: 'u2' });
  const u2 = makeProfile('u2', { partner_id: 'u1' });
  const h = createTestHarness({ profiles: [u1, u2], now });

  // 1. Connect u1 and u2
  const inv = h.voiceService.handle('u1', { type: 'call_invite', to: 'u2' });
  currentTime += 1000;
  h.voiceService.handle('u2', { type: 'call_accept', callId: inv.callId });
  const origStartedAt = h.voiceService.activeCallOf('u1').startedAt;

  // 2. Callee (u2, polite=true) triggers call_heal -> both receive call_connected (resumed: true, healed: true)
  currentTime += 5000;
  h.sentMessages.length = 0;
  const healRes = h.voiceService.handle('u2', { type: 'call_heal', callId: inv.callId });
  assert.equal(healRes.ok, true);
  assert.equal(healRes.healed, true);

  const u1Heal = h.getSentFor('u1').find((m) => m.type === 'call_connected');
  const u2Heal = h.getSentFor('u2').find((m) => m.type === 'call_connected');
  assert.ok(u1Heal && u1Heal.resumed && u1Heal.healed);
  assert.ok(u2Heal && u2Heal.resumed && u2Heal.healed);
  assert.equal(u1Heal.startedAt, origStartedAt);

  // 3. Same-pair re-dial while connected heals instead of returning busy
  currentTime += 3000;
  h.sentMessages.length = 0;
  const redialRes = h.voiceService.handle('u1', { type: 'call_invite', to: 'u2' });
  assert.equal(redialRes.ok, true);
  assert.equal(redialRes.resumed, true);
  assert.equal(redialRes.healed, true);

  // 4. Post-grace auto-recovery within 90s when disconnected peer reconnects
  currentTime += 5000;
  h.voiceService.onDisconnect('u2');
  currentTime += 16000; // Exceeds 15s grace
  h.voiceService.tick(currentTime);
  assert.equal(h.voiceService.activeCallOf('u1'), null);

  // 25 seconds later (< 90s), u2's mobile network comes back online -> auto-restores call!
  currentTime += 25000;
  h.sentMessages.length = 0;
  h.voiceService.onReconnect('u2');
  const restored = h.voiceService.activeCallOf('u1');
  assert.ok(restored);
  assert.equal(restored.state, 'connected');
  assert.equal(restored.startedAt, origStartedAt);
});

test('auth_resume on a healthy call does not rebuild WebRTC; real reconnects still resume', () => {
  let currentTime = 1000000;
  const now = () => currentTime;

  const u1 = makeProfile('u1', { partner_id: 'u2' });
  const u2 = makeProfile('u2', { partner_id: 'u1' });
  const h = createTestHarness({ profiles: [u1, u2], now });

  const inv = h.voiceService.handle('u1', { type: 'call_invite', to: 'u2' });
  currentTime += 1000;
  h.voiceService.handle('u2', { type: 'call_accept', callId: inv.callId });

  // 1. Tab switch / notification glance: auth_resume on a socket that never dropped -> no messages at all
  currentTime += 5000;
  h.sentMessages.length = 0;
  h.voiceService.onReconnect('u1', { fromResume: true });
  h.voiceService.onReconnect('u2', { fromResume: true });
  assert.equal(h.sentMessages.length, 0);
  assert.equal(h.voiceService.activeCallOf('u1').state, 'connected');

  // 2. Socket actually dropped (grace pending) and auth_resume arrives -> both peers get call_connected
  h.voiceService.onDisconnect('u2');
  currentTime += 3000;
  h.sentMessages.length = 0;
  h.voiceService.onReconnect('u2', { fromResume: true });
  assert.ok(h.getSentFor('u1').some((m) => m.type === 'call_connected' && m.resumed));
  assert.ok(h.getSentFor('u2').some((m) => m.type === 'call_connected' && m.resumed));
  const s = h.voiceService.activeCallOf('u1');
  assert.equal(s.graceUntil, null);
  assert.equal(s.lastHealAt, currentTime);

  // 3. Fresh socket join (e.g. page reload) without fromResume -> still resumes so the reloaded client rejoins audio
  currentTime += 5000;
  h.sentMessages.length = 0;
  h.voiceService.onReconnect('u1');
  assert.ok(h.getSentFor('u1').some((m) => m.type === 'call_connected'));
  assert.ok(h.getSentFor('u2').some((m) => m.type === 'call_connected'));
});

