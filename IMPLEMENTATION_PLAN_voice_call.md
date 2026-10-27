# Implementation Plan: Voice Call Reliability (iPhone Home-Screen PWA)

> Source of truth for root causes: [HANDOFF_voice_call_audit.md](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/HANDOFF_voice_call_audit.md) (RC-1 … RC-8).
> Target user: iPhone, Home-Screen installed PWA, UAE network (no VPN) ↔ Bangkok.

## Goal & Non-Goals

**Goal**
1. A call **never drops while Neora is open** (foreground).
2. A short app switch / notification glance (≤ 2–3 min) **pauses** the call and **auto-resumes** instead of ending it.
3. Clear, correct audio on iPhone (speaker/Bluetooth routing, no echo, no earpiece-only volume).

**Non-Goals (platform-impossible for a PWA, see handoff §3b)**
- Two-way voice while the iPhone is locked or while she is inside another app.
- A ringing phone-style incoming call screen.

## Ground Rules for the Implementing Agent
- Work in small, separately testable milestones (M1 → M6). Run `npm test` after every milestone; all existing tests must stay green.
- Do **not** touch unrelated game systems. Keep all existing comments/docstrings.
- Keep wire protocol **backward compatible** (new fields optional; old clients must still work).
- Each milestone ends with: tests added, `npm test` green, short changelog line appended to the bottom of this file.

---

## Milestone Overview

| # | Milestone | Fixes | Risk | Size |
| :-- | :--- | :--- | :--- | :--- |
| M1 | Stop healthy-call teardown on resume | RC-2 | Low | S |
| M2 | DPI-safe relay policy decided by server | RC-1 | Medium | M |
| M3 | iOS audio pipeline cleanup | RC-5 | Low | S |
| M4 | Survive short background / network gaps ("paused" calls) | RC-3, RC-6 | Medium | M |
| M5 | Screen-on + in-call UX | RC-4 | Low | S |
| M6 | Self-heal race fixes + startup message buffer | RC-7, RC-8 | Low–Med | M |
| M7 (opt.) | Web Push "is calling" alert | RC-8 (push) | Medium | M |
| M8 (opt.) | Short-lived TURN credentials | Security note | Low | S |

Recommended order: **M1 → M3 → M2 → M4 → M5 → M6**, ship after each (M1 + M3 alone should noticeably reduce drops).

---

## M1 — Stop `auth_resume` From Rebuilding Healthy Calls (RC-2)

**Files**: `server/voice_call_service.js`, `server/server.js`, `client/js/voice_call_client.js`, `tests/voice_call.test.js`

**Server**
1. Change `onReconnect(userId)` → `onReconnect(userId, { fromResume = false } = {})`.
2. In `onReconnect`, for an existing `connected` session:
   - If `session.graceUntil == null` **and** the session was not just restored from `recentGraceDrops` → **return without sending anything** (call is healthy; nobody actually dropped).
   - Otherwise clear `graceUntil`, set `session.lastHealAt = now()`, then send `call_connected` (`resumed: true`) as today.
3. `server.js` `auth_resume` handler → `voiceService.onReconnect(ws.userId, { fromResume: true })`. `join()` keeps current call.

**Client** (`handle('call_connected')`)
4. Add a guard at the top: if `this._state === 'connected' && this.callId === msg.callId && !msg.healed && this.pc && ['connected','completed'].includes(this.pc.iceConnectionState) && this._isLocalMicHealthy()` → update `startedAt/polite/_lastIceConfig`, hide banner, show pill, **return true without `setupWebRTC()`**.

**Tests**
- `onReconnect` on a healthy connected session sends **no** messages.
- `onReconnect` after `onDisconnect` (grace active) still sends `call_connected` to both and sets `lastHealAt`.
- Existing self-healing test still passes.

**Acceptance**: Alt-tabbing / pulling Notification Center repeatedly on either device causes **no audio interruption**.

---

## M2 — Server-Decided DPI-Safe Relay Policy (RC-1)

**Files**: `server/voice_call_service.js`, `client/js/voice_call_client.js`, `tests/voice_call.test.js`

1. Split `getIceConfig()` into:
   - `getIceConfig({ relayOnly })`.
   - When `relayOnly === true` return **only TCP/TLS relays**: `turns:sg.relay.metered.ca:443?transport=tcp`, `turns:standard.relay.metered.ca:443?transport=tcp`, `turn:sg.relay.metered.ca:80?transport=tcp` (+ `TURN_URL` env if it is TCP/TLS), and include `iceTransportPolicy: 'relay'` in the returned object.
   - When `false`, keep current list (UDP allowed, lower latency).
2. Add `shouldRelay(callerProf, calleeProf)` → `true` if either profile `lineage === 'dxb'`, or a new optional profile flag `call_relay_mode === 'force'`; env override `CALL_FORCE_RELAY=1|0`.
3. Every place that builds `ice` for `call_connected` (invite glare merge, accept, same-pair heal, `call_heal`, `onReconnect`) uses `getIceConfig({ relayOnly: shouldRelay(...) })`. Factor into one helper `iceFor(session)` to avoid duplication.
4. Client `setupWebRTC(iceConfig)`:
   - Honour `iceConfig.iceTransportPolicy === 'relay'` (in addition to the existing `?dubai=1` / `?relay=1` URL override, which stays as a debug switch).
   - **Fallback**: if the relay-only connection hasn't reached `connected` within **10 s** of the initial offer, send `call_heal` with `{ reason: 'relay_timeout', allowUdp: true }`; server then answers once with `relayOnly: false` for that session (`session.relayFallback = true`).
5. Optional: log selected candidate pair type (`pc.getStats()` → `candidate-pair` `selected`) to console for QA.

**Tests**
- `dxb` ↔ `bkk` pair: `call_connected.ice.iceServers` contains only `turns:`/`?transport=tcp` URLs and `iceTransportPolicy === 'relay'`.
- `bkk` ↔ `bkk`: unchanged list.
- `relay_timeout` heal flips the session to non-relay ICE exactly once.

**Acceptance**: On her iPhone (no URL params), `chrome://webrtc-internals`-equivalent / stats show `relay` + `tcp`/`tls`; no mid-call audio blackouts on UAE network.

---

## M3 — iOS Audio Pipeline Cleanup (RC-5)

**Files**: `client/js/voice_call_client.js`

1. **Remove WebAudio tap on the remote stream**: in `pc.ontrack`, stop calling `setupAudioAnalysis(stream, 'remote')`. Remote audio plays **only** through `#voice-remote-audio` (`autoplay`, `playsInline`).
2. **Replace VAD source** with WebRTC stats (no `AudioContext` needed):
   - Local level: `pc.getSenders()` audio sender → `getStats()` `media-source.audioLevel`.
   - Remote level: `pc.getReceivers()` audio receiver → `getSynchronizationSources()[0]?.audioLevel` (fallback `inbound-rtp.audioLevel`).
   - Poll at 250 ms instead of 100 ms; keep emitting existing `voice:speaking` events and `pillEl.dataset.speaking` so UI is unchanged.
   - Keep the old `AudioContext` path only as a fallback on non-iOS browsers if stats are unavailable (or remove entirely — implementer's choice; prefer removal for simplicity).
3. **Audio session**: on call start (`ensureLocalMedia` success) set `if (navigator.audioSession) navigator.audioSession.type = 'play-and-record'`; in `cleanup()` set back to `'auto'`.
4. Leave `voice:duck` dispatch as-is (no listeners today); optionally add a TODO note.

**Tests**: client logic isn't covered by node tests; add a small pure helper (e.g. `levelFromStats(report)`) and unit test it if practical.

**Acceptance**: On iPhone, partner voice comes from the **speaker/Bluetooth** at normal volume, no echo reported, waveform still animates.

---

## M4 — "Paused" Calls: Survive Short Background & Network Gaps (RC-3, RC-6)

**Files**: `shared/phase5_rules.js`, `server/voice_call_service.js`, `server/server.js`, `client/js/net.js`, `client/js/voice_call_client.js`, `tests/voice_call.test.js`

**Server**
1. `CALL.GRACE_MS`: `15_000` → `150_000` (2.5 min). `recentGraceDrops` TTL `90_000` → `300_000`; extract to `CALL.RESTORE_MS`.
2. In `onDisconnect`, when a connected call enters grace, notify the **other** peer: `{ type: 'call_peer_away', callId, until: graceUntil }`. In `onReconnect` (grace path), send `{ type: 'call_peer_back', callId }` before `call_connected`.
3. `call_invite` for a pair present in `recentGraceDrops` (within `RESTORE_MS`) → restore that session (same path as `call_heal` restore) instead of starting a new ring.
4. Heartbeat (`server.js`): additionally send native `ws.ping()` and treat `'pong'` frames as liveness (`ws.on('pong', () => ws.missed = 0)`), so OS-level pongs count even when page JS is throttled.

**Client — `net.js`**
5. Outbound queue: if `readyState !== 1` or not yet `connected` (auth_ok), push `call_*` messages into `this.outbox` (cap ~50, drop oldest `call_signal` candidates first); flush on `auth_ok` / `resume_ok`. Non-call messages keep current behaviour.
6. In `ws.onclose`, allow reconnect while hidden **if** `window.__neora?.voiceClient?.state` is `'connected'` or `'calling'`.

**Client — `voice_call_client.js`**
7. Handle `call_peer_away` → set `this.peerAway = true`, show pill/callbar text "💤 {name} stepped away — call resumes when they're back" (no teardown). `call_peer_back` → clear it.
8. On `call_ended` with `reason === 'grace_expired'`: if `this.pc` ICE is still `connected/completed`, keep `pc` alive for up to `RESTORE_MS` and send `call_heal` once `/ws` is healthy; otherwise current cleanup.

**Tests**
- Grace survives 2 min; expires after `GRACE_MS`.
- `call_peer_away` / `call_peer_back` emitted to the correct peer.
- Re-invite within `RESTORE_MS` restores original `callId`/`startedAt` (no new ring).

**Acceptance**: She switches to LINE for 60 s and returns → call resumes automatically within ~3 s; partner sees "stepped away" instead of "Call ended".

---

## M5 — Screen-On & In-Call UX (RC-4)

**Files**: `client/js/voice_call_client.js`, `client/css/phase5.css` (only if needed)

1. `_acquireWakeLock()` when state becomes `calling|incoming|connected`; re-acquire on `visibilitychange → visible`; release in `cleanup()`. Wrap in try/catch (fails silently on iOS < 18.4 standalone).
2. If wake lock is unavailable/fails on iOS, show a one-time toast per call: "📱 Keep Neora open & screen on for a smooth call".
3. `navigator.mediaSession.metadata = new MediaMetadata({ title: 'Call with {name}', artist: 'Neora World' })` during calls; clear on cleanup.

**Acceptance**: On iOS 18.4+ the phone doesn't auto-lock during a call; on older iOS the hint appears once.

---

## M6 — Self-Heal Race Fixes & Startup Buffer (RC-7, RC-8)

**Files**: `client/js/voice_call_client.js`, `client/js/main.js`, `server/voice_call_service.js`

1. `checkIceHealth` `failed` branch: call **only** `healCall('ice_failed')` (remove the preceding `triggerIceRestart(pc)`).
2. `setupWebRTC()`: always reset `pendingCandidates = []` (and `pendingDescription` unless it is being flushed right now) on every rebuild, not only when `!isSameCall`.
3. `healCall` fallback: 600 ms → 2500 ms; for `polite` peers resend `call_heal` once instead of the no-op `triggerIceRestart`.
4. Server `call_heal` throttle: when throttled, still reply to the requester with the current `call_connected` (or a `call_heal_throttled` ack) so the client doesn't hang.
5. `main.js`: add `pendingVoiceMsgs = []`; in the `net.emit` wrapper, if `!voiceClient && detail.type?.startsWith('call_')` push and return; replay after `new VoiceCallClient(...)`.

**Tests**: server throttle reply; existing suite green.

**Acceptance**: Wi-Fi ↔ 5G toggle mid-call on caller **and** callee heals within ~5 s; reloading the app mid-call rejoins audio.

---

## M7 (Optional) — Web Push "is calling" Alert

- VAPID keys via env; `POST /api/push/subscribe` stores subscription on profile; `sw.js` `push` → `showNotification('📞 Nook is calling', { tag: callId })`, `notificationclick` → focus/open `/`.
- Server sends push on `call_invite` when callee socket is missing or `missed ≥ 1`.
- Limits: single ping, no ringtone loop, must always show a notification (handoff §3b).

## M8 (Optional) — Short-Lived TURN Credentials

- Remove hardcoded credentials from `voice_call_client.js` `defaultIce` (fallback list becomes STUN-only).
- Server fetches/creates time-limited credentials (Metered API or HMAC TURN REST) and caches ~1 h; rotate the leaked static credentials afterwards.

---

## Final QA Matrix (iPhone Home-Screen + second device)

| Scenario | Expected |
| :--- | :--- |
| 10-min call, both apps open, UAE network | No drop; stats show relay/TCP for dxb pair |
| Desktop peer Alt-Tabs 10× | No audio interruption |
| iPhone pulls Notification Center / Control Center | No interruption |
| iPhone switches to another app 60 s, returns | Peer sees "stepped away"; auto-resume ≤ 3 s |
| iPhone away > 2.5 min | Call ends gracefully; re-call within 5 min restores session |
| Phone untouched 2 min (iOS 18.4+) | Screen stays on |
| Wi-Fi ↔ 5G mid-call (caller & callee) | Heals ≤ 5 s |
| Reload app mid-call | Rejoins call audio |
| Audio routing | Speaker/Bluetooth, normal volume, no echo |

---

## Changelog
<!-- Implementing agent: append one line per completed milestone, e.g. "2026-10-24 — M1 done, tests 175/175" -->
- 2026-10-23 — **New finding RC-9** (from user report: "she hears me, I can't hear her" after app switch/notification): iOS mutes the mic track on interruption and the client only checked `readyState === 'ended'`, so a muted track was never recovered. **Patched**: `_isLocalMicLive()` (muted + sender check), `_scheduleMicWakeCheck()` on wake/`track.onmute` (700 ms delay, 4 s throttle), `ensureLocalMedia` now acquires the new mic **before** stopping the old one and uses `replaceTrack` (no renegotiation).
- 2026-10-23 — **M1 done (server side)**: `onReconnect(userId, { fromResume })` skips healthy calls on `auth_resume`; sets `lastHealAt` when it does resume. Client-side guard intentionally **not** added (would risk a stuck callee on grace resumes).
- 2026-10-23 — **M5 partial**: Screen Wake Lock acquired on call/connect/wake, released in `cleanup()` (user's iPhone is iOS 18.4+). Media Session not added yet.
- 2026-10-23 — Tests: `npm test` 428/428; new live smoke `node scripts/smoke_voice_call.mjs` (two Chrome contexts, fake mic) passes: connect, auth_resume keeps pc, mic recovery keeps pc + audio flowing, hangup, re-call.
- Deferred by decision: M2 relay forcing (evidence points to mic, not network); revisit only if drops continue while both apps are in foreground.
