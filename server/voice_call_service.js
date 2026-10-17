// server/voice_call_service.js — Phase 5 WebRTC voice call signaling, glare resolution, timeout and rewards.
import { CALL } from '../shared/phase5_rules.js';

export function createVoiceCallService({
  getProfile = () => null,
  isOnline = () => true,
  send = () => {},
  now = Date.now,
  canCall,
  grant = () => {},
} = {}) {
  // Map<callId, Session>
  // Session: { callId, callerId, calleeId, state: 'ringing'|'connected', createdAt, startedAt, lastRewardAt, chunks, graceUntil }
  const sessions = new Map();

  function getIceConfig() {
    const iceServers = [
      { urls: 'stun:stun.l.google.com:19302' },
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

      // 1. Glare check: is 'to' currently ringing 'uid'?
      for (const s of sessions.values()) {
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

          return { ok: true, merged: true, callId: s.callId };
        }
      }

      // 2. Caller busy check
      if (activeCallOf(uid)) {
        return { ok: false, error: 'busy' };
      }

      // 3. Callee busy check
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

      send(session.callerId, { type: 'call_ended', callId, reason: 'declined' });
      sessions.delete(callId);
      return { ok: true, callId };
    }

    if (type === 'call_hangup') {
      const callId = m?.callId;
      const session = sessions.get(callId);
      if (!session) {
        return { ok: false, error: 'no_such_call' };
      }
      if (session.callerId !== uid && session.calleeId !== uid) {
        return { ok: false, error: 'not_participant' };
      }

      const nowMs = now();
      const durationMs = session.startedAt ? Math.max(0, nowMs - session.startedAt) : 0;
      send(session.callerId, {
        type: 'call_ended',
        callId,
        reason: 'hangup',
        durationMs,
        chunks: session.chunks,
      });
      send(session.calleeId, {
        type: 'call_ended',
        callId,
        reason: 'hangup',
        durationMs,
        chunks: session.chunks,
      });
      sessions.delete(callId);

      return { ok: true, callId, durationMs, chunks: session.chunks };
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

          const callerProf = getProfile?.(session.callerId);
          const calleeProf = getProfile?.(session.calleeId);
          const hasBlack = !!(callerProf?.vip?.black || calleeProf?.vip?.black);
          const diamonds = hasBlack ? CALL.DIAMONDS_BLACK : CALL.DIAMONDS;
          const exp = CALL.EXP;

          if (typeof grant === 'function') {
            grant(session.callerId, { diamonds, exp });
            grant(session.calleeId, { diamonds, exp });
          }

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
    const session = activeCallOf(userId);
    if (!session) return;

    if (session.state === 'connected') {
      const uid = String(userId);
      const otherId = (uid === session.callerId) ? session.calleeId : session.callerId;
      if (typeof isOnline === 'function' && isOnline(otherId)) {
        session.graceUntil = null;
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
