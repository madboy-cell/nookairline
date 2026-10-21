// server/voice_call_service.js — Phase 5 WebRTC voice call signaling, glare resolution, timeout and rewards.
import { CALL } from '../shared/phase5_rules.js';

export function createVoiceCallService({
  getProfile = () => null,
  isOnline = () => true,
  send = () => {},
  now = Date.now,
  canCall,
  grant = () => {},
  onCallActivity = () => {},
} = {}) {
  // Map<callId, Session>
  // Session: { callId, callerId, calleeId, state: 'ringing'|'connected', createdAt, startedAt, lastRewardAt, chunks, graceUntil }
  const sessions = new Map();
  const recentGraceDrops = new Map(); // Map<userId, { callId, callerId, calleeId, createdAt, startedAt, lastRewardAt, chunks, expiredAt }>

  function getIceConfig() {
    const iceServers = [
      // 1. Primary: Singapore TURNS (TLS over TCP Port 443 - Bypasses du & Etisalat DPI)
      {
        urls: 'turns:sg.relay.metered.ca:443?transport=tcp',
        username: '3867582a8d4e4558f1a6097d',
        credential: 'trPaqBzsrXg7uShi',
      },
      // 2. Secondary: Singapore TURN over Port 443
      {
        urls: 'turn:sg.relay.metered.ca:443',
        username: '3867582a8d4e4558f1a6097d',
        credential: 'trPaqBzsrXg7uShi',
      },
      // 3. Fallback: Singapore TURN over Port 80 TCP
      {
        urls: 'turn:sg.relay.metered.ca:80?transport=tcp',
        username: '3867582a8d4e4558f1a6097d',
        credential: 'trPaqBzsrXg7uShi',
      },
      // 4. Fallback: Singapore TURN over Port 80 UDP
      {
        urls: 'turn:sg.relay.metered.ca:80',
        username: '3867582a8d4e4558f1a6097d',
        credential: 'trPaqBzsrXg7uShi',
      },
      // 5. STUN fallbacks
      { urls: 'stun:stun.relay.metered.ca:80' },
      { urls: 'stun:stun.l.google.com:19302' },
      // 6. Secondary Backup Relay: Standard Relay TURNS over Port 443 TCP
      {
        urls: 'turns:standard.relay.metered.ca:443?transport=tcp',
        username: 'f65010fdd6f7f2617f764376',
        credential: 'tvV8GFDSPqR4f2De',
      },
    ];
    if (process.env.TURN_URL) {
      const turn = { urls: process.env.TURN_URL };
      if (process.env.TURN_USER) turn.username = process.env.TURN_USER;
      if (process.env.TURN_PASS) turn.credential = process.env.TURN_PASS;
      iceServers.push(turn);
    }
    return { iceServers };
  }

  function activeCallOf(userId) {
    if (!userId) return null;
    const uid = String(userId);
    for (const s of sessions.values()) {
      if (s.callerId === uid || s.calleeId === uid) {
        return s;
      }
    }
    return null;
  }

  function handle(userId, m) {
    const uid = String(userId);
    const type = m?.type;

    if (type === 'call_invite') {
      const to = m?.to ? String(m.to) : null;
      if (!to || to === uid) {
        return { ok: false, error: 'invalid_target' };
      }

      // 1. Same-pair check: glare merge, duplicate ring refresh, or connected session heal
      for (const s of sessions.values()) {
        const samePair =
          (s.callerId === uid && s.calleeId === to) ||
          (s.callerId === to && s.calleeId === uid);
        if (!samePair) continue;

        if (s.state === 'ringing' && s.callerId === to && s.calleeId === uid) {
          // Glare detected! Merge into one session.
          // Caller = min(uid, to), Callee = max(uid, to).
          const [mergedCaller, mergedCallee] = [uid, to].sort();
          s.callerId = mergedCaller;
          s.calleeId = mergedCallee;
          s.state = 'connected';
          s.startedAt = now();
          s.lastRewardAt = s.startedAt;
          s.chunks = 0;
          s.recordedMinutes = 0;
          s.graceUntil = null;

          const ice = getIceConfig();
          // Callee is polite, caller is not
          send(s.callerId, {
            type: 'call_connected',
            callId: s.callId,
            peerId: s.calleeId,
            startedAt: s.startedAt,
            polite: false,
            ice,
          });
          send(s.calleeId, {
            type: 'call_connected',
            callId: s.callId,
            peerId: s.callerId,
            startedAt: s.startedAt,
            polite: true,
            ice,
          });
          onCallActivity(s.callerId, s.calleeId, { kind: 'connected' });

          return { ok: true, merged: true, callId: s.callId };
        }

        if (s.state === 'ringing' && s.callerId === uid && s.calleeId === to) {
          // Caller tapped Call again while already ringing the same peer: refresh ring
          s.createdAt = now();
          const callerProf = getProfile(uid);
          const isVip = !!(callerProf?.vip?.black || callerProf?.vip?.communicator);
          send(to, {
            type: 'call_incoming',
            callId: s.callId,
            from: uid,
            fromName: callerProf?.username || uid,
            vip: isVip,
          });
          send(uid, {
            type: 'call_ringing',
            callId: s.callId,
          });
          return { ok: true, callId: s.callId, refreshed: true };
        }

        if (s.state === 'connected') {
          // Same pair already in a connected session: heal/resume both ends immediately instead of returning busy!
          s.graceUntil = null;
          s.lastHealAt = now();
          const ice = getIceConfig();
          send(s.callerId, {
            type: 'call_connected',
            callId: s.callId,
            peerId: s.calleeId,
            startedAt: s.startedAt,
            polite: false,
            resumed: true,
            healed: true,
            ice,
          });
          send(s.calleeId, {
            type: 'call_connected',
            callId: s.callId,
            peerId: s.callerId,
            startedAt: s.startedAt,
            polite: true,
            resumed: true,
            healed: true,
            ice,
          });
          return { ok: true, resumed: true, healed: true, callId: s.callId };
        }
      }

      // 2. Caller busy check (with a third party)
      if (activeCallOf(uid)) {
        return { ok: false, error: 'busy' };
      }

      // 3. Callee busy check (with a third party)
      if (activeCallOf(to)) {
        send(uid, { type: 'call_busy', callId: null, to });
        return { ok: false, error: 'busy' };
      }

      // 4. Callee offline check
      if (typeof isOnline === 'function' && !isOnline(to)) {
        send(uid, { type: 'call_error', error: 'offline', to });
        return { ok: false, error: 'offline' };
      }

      // 5. Permission check
      const callerProf = getProfile(uid);
      const calleeProf = getProfile(to);
      if (typeof canCall === 'function') {
        const check = canCall(callerProf, calleeProf, now());
        if (!check || !check.ok) {
          const err = check?.error || 'call_locked';
          send(uid, { type: 'call_error', error: err, to });
          return { ok: false, error: err };
        }
      }

      // 6. Normal invite
      const nowMs = now();
      const callId = `call_${nowMs}_${Math.random().toString(36).slice(2, 8)}`;
      const session = {
        callId,
        callerId: uid,
        calleeId: to,
        state: 'ringing',
        createdAt: nowMs,
        startedAt: null,
        lastRewardAt: null,
        chunks: 0,
        recordedMinutes: 0,
        graceUntil: null,
      };
      sessions.set(callId, session);

      const isVip = !!(callerProf?.vip?.black || callerProf?.vip?.communicator);
      send(to, {
        type: 'call_incoming',
        callId,
        from: uid,
        fromName: callerProf?.username || uid,
        vip: isVip,
      });
      send(uid, {
        type: 'call_ringing',
        callId,
      });

      return { ok: true, callId };
    }

    if (type === 'call_accept') {
      const callId = m?.callId;
      const session = sessions.get(callId);
      if (!session || session.state !== 'ringing') {
        return { ok: false, error: 'no_such_call' };
      }
      if (session.calleeId !== uid) {
        return { ok: false, error: 'not_callee' };
      }

      session.state = 'connected';
      session.startedAt = now();
      session.lastRewardAt = session.startedAt;
      session.chunks = 0;
      session.recordedMinutes = 0;
      session.graceUntil = null;

      const ice = getIceConfig();
      send(session.callerId, {
        type: 'call_connected',
        callId,
        peerId: session.calleeId,
        startedAt: session.startedAt,
        polite: false,
        ice,
      });
      send(session.calleeId, {
        type: 'call_connected',
        callId,
        peerId: session.callerId,
        startedAt: session.startedAt,
        polite: true,
        ice,
      });
      onCallActivity(session.callerId, session.calleeId, { kind: 'connected' });

      return { ok: true, callId };
    }

    if (type === 'call_decline') {
      const callId = m?.callId;
      const session = sessions.get(callId);
      if (!session || session.state !== 'ringing') {
        return { ok: false, error: 'no_such_call' };
      }
      if (session.callerId !== uid && session.calleeId !== uid) {
        return { ok: false, error: 'not_participant' };
      }

      recentGraceDrops.delete(session.callerId);
      recentGraceDrops.delete(session.calleeId);
      send(session.callerId, { type: 'call_ended', callId, reason: 'declined' });
      sessions.delete(callId);
      return { ok: true, callId };
    }

    if (type === 'call_hangup') {
      const callId = m?.callId;
      const session = sessions.get(callId) || activeCallOf(uid);
      if (!session) {
        recentGraceDrops.delete(uid);
        return { ok: false, error: 'no_such_call' };
      }
      if (session.callerId !== uid && session.calleeId !== uid) {
        return { ok: false, error: 'not_participant' };
      }

      recentGraceDrops.delete(session.callerId);
      recentGraceDrops.delete(session.calleeId);
      const nowMs = now();
      const durationMs = session.startedAt ? Math.max(0, nowMs - session.startedAt) : 0;
      const totalMins = durationMs >= 15000 ? Math.max(1, Math.round(durationMs / 60000)) : 0;
      const unrecMins = Math.max(0, totalMins - (session.recordedMinutes || 0));
      if (unrecMins > 0) {
        onCallActivity(session.callerId, session.calleeId, { kind: 'ended', minutes: unrecMins });
      }
      send(session.callerId, {
        type: 'call_ended',
        callId: session.callId,
        reason: 'hangup',
        durationMs,
        chunks: session.chunks,
      });
      send(session.calleeId, {
        type: 'call_ended',
        callId: session.callId,
        reason: 'hangup',
        durationMs,
        chunks: session.chunks,
      });
      sessions.delete(session.callId);

      return { ok: true, callId: session.callId, durationMs, chunks: session.chunks };
    }

    if (type === 'call_heal') {
      const nowMs = now();
      let session = (m?.callId && sessions.get(m.callId)) || activeCallOf(uid);

      // If the session just expired via grace_expired within the last 90s, restore it seamlessly!
      if (!session) {
        const rec = recentGraceDrops.get(uid);
        if (rec && nowMs - rec.expiredAt <= 90_000) {
          const otherId = uid === rec.callerId ? rec.calleeId : rec.callerId;
          if ((!isOnline || isOnline(otherId)) && !activeCallOf(otherId)) {
            recentGraceDrops.delete(rec.callerId);
            recentGraceDrops.delete(rec.calleeId);
            session = {
              callId: rec.callId,
              callerId: rec.callerId,
              calleeId: rec.calleeId,
              state: 'connected',
              createdAt: rec.createdAt,
              startedAt: rec.startedAt,
              lastRewardAt: rec.lastRewardAt,
              chunks: rec.chunks,
              recordedMinutes: rec.recordedMinutes || 0,
              graceUntil: null,
              lastHealAt: 0,
            };
            sessions.set(session.callId, session);
          }
        }
      }

      if (!session || session.state !== 'connected') {
        return { ok: false, error: 'no_such_call' };
      }
      if (session.callerId !== uid && session.calleeId !== uid) {
        return { ok: false, error: 'not_participant' };
      }
      if (session.lastHealAt && nowMs - session.lastHealAt < 1200) {
        return { ok: true, callId: session.callId, throttled: true };
      }

      session.lastHealAt = nowMs;
      session.graceUntil = null;
      const ice = getIceConfig();
      send(session.callerId, {
        type: 'call_connected',
        callId: session.callId,
        peerId: session.calleeId,
        startedAt: session.startedAt,
        polite: false,
        resumed: true,
        healed: true,
        ice,
      });
      send(session.calleeId, {
        type: 'call_connected',
        callId: session.callId,
        peerId: session.callerId,
        startedAt: session.startedAt,
        polite: true,
        resumed: true,
        healed: true,
        ice,
      });
      return { ok: true, callId: session.callId, healed: true };
    }

    if (type === 'call_signal') {
      const callId = m?.callId;
      const session = sessions.get(callId);
      if (!session) {
        return { ok: false, error: 'no_such_call' };
      }
      if (session.callerId !== uid && session.calleeId !== uid) {
        return { ok: false, error: 'not_participant' };
      }

      const data = m?.data;
      const str = typeof data === 'string' ? data : JSON.stringify(data ?? {});
      if (Buffer.byteLength(str, 'utf8') > CALL.SIGNAL_MAX) {
        return { ok: false, error: 'signal_too_large' };
      }

      const peerId = (uid === session.callerId) ? session.calleeId : session.callerId;
      send(peerId, { type: 'call_signal', callId, data });
      return { ok: true };
    }

    return { ok: false, error: 'unknown_message' };
  }

  function tick(nowMs = now()) {
    for (const [callId, session] of sessions.entries()) {
      if (session.state === 'ringing') {
        if (nowMs - session.createdAt >= CALL.RING_MS) {
          send(session.callerId, { type: 'call_ended', callId, reason: 'no_answer' });
          send(session.calleeId, { type: 'call_ended', callId, reason: 'no_answer' });
          sessions.delete(callId);
        }
      } else if (session.state === 'connected') {
        if (session.graceUntil && nowMs >= session.graceUntil) {
          const durationMs = session.startedAt ? Math.max(0, nowMs - session.startedAt) : 0;
          const totalMins = durationMs >= 15000 ? Math.max(1, Math.round(durationMs / 60000)) : 0;
          const unrecMins = Math.max(0, totalMins - (session.recordedMinutes || 0));
          if (unrecMins > 0) {
            onCallActivity(session.callerId, session.calleeId, { kind: 'ended', minutes: unrecMins });
          }
          const dropRecord = {
            callId,
            callerId: session.callerId,
            calleeId: session.calleeId,
            createdAt: session.createdAt,
            startedAt: session.startedAt,
            lastRewardAt: session.lastRewardAt,
            chunks: session.chunks,
            recordedMinutes: Math.max(session.recordedMinutes || 0, totalMins),
            expiredAt: nowMs,
          };
          recentGraceDrops.set(session.callerId, dropRecord);
          recentGraceDrops.set(session.calleeId, dropRecord);
          send(session.callerId, {
            type: 'call_ended',
            callId,
            reason: 'grace_expired',
            durationMs,
            chunks: session.chunks,
          });
          send(session.calleeId, {
            type: 'call_ended',
            callId,
            reason: 'grace_expired',
            durationMs,
            chunks: session.chunks,
          });
          sessions.delete(callId);
          continue;
        }

        const CHUNK_MS = CALL.CHUNK_MS;
        while (nowMs - session.lastRewardAt >= CHUNK_MS) {
          session.chunks += 1;
          session.lastRewardAt += CHUNK_MS;
          session.recordedMinutes = (session.recordedMinutes || 0) + 15;

          const callerProf = getProfile?.(session.callerId);
          const calleeProf = getProfile?.(session.calleeId);
          const hasBlack = !!(callerProf?.vip?.black || calleeProf?.vip?.black);
          const diamonds = hasBlack ? CALL.DIAMONDS_BLACK : CALL.DIAMONDS;
          const exp = CALL.EXP;

          if (typeof grant === 'function') {
            grant(session.callerId, { diamonds, exp });
            grant(session.calleeId, { diamonds, exp });
          }
          onCallActivity(session.callerId, session.calleeId, { kind: 'reward', minutes: 15, diamonds });

          const payload = {
            type: 'call_reward',
            callId,
            diamonds,
            exp,
            chunks: session.chunks,
          };
          send(session.callerId, payload);
          send(session.calleeId, payload);
        }
      }
    }
  }

  function onDisconnect(userId) {
    const session = activeCallOf(userId);
    if (!session) return;

    const uid = String(userId);
    if (session.state === 'ringing') {
      const peerId = (uid === session.callerId) ? session.calleeId : session.callerId;
      send(peerId, { type: 'call_ended', callId: session.callId, reason: 'disconnected' });
      sessions.delete(session.callId);
    } else if (session.state === 'connected') {
      if (!session.graceUntil) {
        session.graceUntil = now() + CALL.GRACE_MS;
      }
    }
  }

  function onReconnect(userId) {
    const uid = String(userId);
    let session = activeCallOf(uid);

    // If the session just expired via grace_expired within 90s and both peers are online, restore it!
    if (!session) {
      const rec = recentGraceDrops.get(uid);
      const nowMs = now();
      if (rec && nowMs - rec.expiredAt <= 90_000) {
        const otherId = (uid === rec.callerId) ? rec.calleeId : rec.callerId;
        if (typeof isOnline === 'function' && isOnline(otherId) && !activeCallOf(otherId)) {
          recentGraceDrops.delete(rec.callerId);
          recentGraceDrops.delete(rec.calleeId);
          session = {
            callId: rec.callId,
            callerId: rec.callerId,
            calleeId: rec.calleeId,
            state: 'connected',
            createdAt: rec.createdAt,
            startedAt: rec.startedAt,
            lastRewardAt: rec.lastRewardAt,
            chunks: rec.chunks,
            recordedMinutes: rec.recordedMinutes || 0,
            graceUntil: null,
            lastHealAt: nowMs,
          };
          sessions.set(session.callId, session);
        }
      }
    }

    if (!session) return;

    if (session.state === 'connected') {
      const otherId = (uid === session.callerId) ? session.calleeId : session.callerId;
      if (typeof isOnline === 'function' && isOnline(otherId)) {
        session.graceUntil = null;
        const ice = getIceConfig();
        send(session.callerId, {
          type: 'call_connected',
          callId: session.callId,
          peerId: session.calleeId,
          startedAt: session.startedAt,
          polite: false,
          resumed: true,
          ice,
        });
        send(session.calleeId, {
          type: 'call_connected',
          callId: session.callId,
          peerId: session.callerId,
          startedAt: session.startedAt,
          polite: true,
          resumed: true,
          ice,
        });
      }
    }
  }

  return {
    sessions,
    handle,
    tick,
    onDisconnect,
    onReconnect,
    activeCallOf,
  };
}
