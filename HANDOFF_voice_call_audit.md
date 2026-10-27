# HANDOFF: Voice Call & Background Reliability Audit (iOS Home-Screen PWA)

> Engineering audit and handoff for resolving **voice call drops** and **background suspension** in Neora World V2.
> **No production code was modified during this audit.**

---

## 0. User Report & Confirmed Environment

- **Reported By**: Partner user (`neen`, `lineage: 'dxb'`) calling with `nook` (`lineage: 'bkk'`).
- **Device & Install Mode**: **iPhone**, installed via Safari **"Add to Home Screen"** (`display: "standalone"`, `apple-mobile-web-app-capable="yes"`).
- **Network**: Direct mobile/Wi-Fi connection **without VPN** (UAE carrier DPI environment — du / Etisalat ↔ Bangkok).
- **Symptoms**:
  1. **App does not run in background**: Switching apps or letting the iPhone lock stops the app / drops the call; incoming calls do not ring when the app is closed or backgrounded.
  2. **Voice calls drop intermittently**: Calls cut out or disconnect mid-conversation even when using the app normally.

---

## 1. Relevant Codebase Map

| File | Role | Key Lines |
| :--- | :--- | :--- |
| [client/js/voice_call_client.js](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/client/js/voice_call_client.js) | WebRTC `RTCPeerConnection`, Opus SDP optimizer, ICE health/heal timers, WebAudio VAD, Switchboard & Call Pill UI | `L126-162` (`optimizeAudioSDP`), `L593-631` (`<audio>` & wake listeners), `L1702-1833` (`healCall` & `handle`), `L1966-2346` (`setupWebRTC`, `triggerIceRestart`, `onSignal`), `L2349-2495` (`setupAudioAnalysis`, `cleanup`) |
| [server/voice_call_service.js](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/server/voice_call_service.js) | Server signaling (`call_*`), glare merge, TURN/STUN config, 15s grace timer, 90s `recentGraceDrops`, 15m diamond rewards | `L18-61` (`getIceConfig`), `L78-174` (`call_invite`), `L332-396` (`call_heal`), `L422-499` (`tick`), `L501-575` (`onDisconnect`, `onReconnect`) |
| [client/js/net.js](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/client/js/net.js) | Shared `/ws` WebSocket client, JSON `ping`/`pong`, reconnect backoff, `visibilitychange` `auth_resume` | `L42-53`, `L80`, `L87-103` (`onclose` hidden guard), `L107` (`send`), `L117-121` (`onVisibility`) |
| [server/server.js](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/server/server.js) | `/ws` lifecycle, `join`/`leave`, `auth_resume`, 25s JSON heartbeat termination | `L74-82` (`NET`), `L761-896` (`join`/`leave`), `L1561-1610` (`auth` & `auth_resume`), `L1690-1696` (`heartbeat`) |
| [shared/phase5_rules.js](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/shared/phase5_rules.js) | Shared call constants (`RING_MS: 30000`, `GRACE_MS: 15000`, `CHUNK_MS: 900000`) | `L131-139` (`CALL`) |
| [client/js/main.js](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/client/js/main.js) | Dynamic import of `VoiceCallClient` and `/ws` message routing | `L1248-1269`, `L1346-1399`, `L1647-1654`, `L1731` |
| [client/manifest.json](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/client/manifest.json) | PWA manifest (`"start_url": "/"`, `"display": "standalone"`) | `L1-14` |
| [client/index.html](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/client/index.html) | iOS standalone meta tags (`apple-mobile-web-app-capable`) | `L7-12` |
| [client/js/pwa_gate.js](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/client/js/pwa_gate.js) | Enforces "Add to Home Screen" install on mobile browsers | `L26-61` |
| [client/sw.js](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/client/sw.js) | Service Worker (asset caching only; network-first for `.js`, no Web Push) | `L1-27` |
| [tests/voice_call.test.js](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/tests/voice_call.test.js) | Unit tests for `voice_call_service.js` (`node --test tests/voice_call.test.js`) | `L1-367` |

---

## 2. Root-Cause Findings (Ordered by Impact)

### RC-1 (Critical — Foreground Drops on Her iPhone): Home-Screen PWA Strips `?dubai=1` AND WebRTC Candidate Priority Defeats `turns:443?transport=tcp`
- **Where**: [manifest.json](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/client/manifest.json#L4), [`VoiceCallClient.setupWebRTC`](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/client/js/voice_call_client.js#L2036-L2041), [`getIceConfig`](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/server/voice_call_service.js#L18-L61).
- **Mechanism**:
  1. `setupWebRTC` only sets `rtcConfig.iceTransportPolicy = 'relay'` if `window.location.search` contains `?dubai=1` or `?relay=1`.
  2. `manifest.json` hardcodes `"start_url": "/"`. Launching from the iPhone Home Screen **always strips query parameters**, so `forceRelay` is **always `false`** on her installed app (even when `profile.lineage === 'dxb'` or calling a `'dxb'` partner).
  3. `getIceConfig()` lists `turns:sg.relay.metered.ca:443?transport=tcp` first in the `iceServers` array assuming WebRTC tries servers in array order. **WebRTC ignores array order** and ranks gathered candidates by RFC 8445 protocol priority:
     - `host` (`126`) > `srflx` STUN UDP (`100`) > `relay` TURN UDP `:443`/`:80` (`2`) > `relay` TURN TCP `:80` (`1`) > `relay` TURNS TLS/TCP `:443` (`0`).
  4. Without a VPN in UAE, initial STUN/TURN **UDP** packets often pass briefly before carrier DPI (du/Etisalat) or NAT throttles/blackholes the sustained UDP SRTP stream mid-call — causing sudden audio loss seconds or minutes into a call because `turns:...:443?transport=tcp` was out-prioritized by UDP entries.

---

### RC-2 (Critical — Random Drops When Either User Switches Tabs): `auth_resume` Unconditionally Destroys & Rebuilds Healthy Calls
- **Where**: [`Net.onVisibility`](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/client/js/net.js#L117-L121) → [`server.js` (`auth_resume`)](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/server/server.js#L1578-L1609) → [`voiceService.onReconnect`](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/server/voice_call_service.js#L550-L574) → [`VoiceCallClient.handle('call_connected')`](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/client/js/voice_call_client.js#L1749-L1793).
- **Mechanism**:
  1. Whenever **either** user brings the app/tab back to `visibilityState === 'visible'` (e.g., Alt-Tabbing for 1 second on desktop, or swiping Notification Center / Control Center on iOS), `Net.onVisibility` sends `{ type: 'auth_resume' }` even if `/ws` never disconnected.
  2. `server.js` calls `voiceService.onReconnect(ws.userId)`, which **does not check if `session.graceUntil` was set**. It unconditionally sends `call_connected` (`resumed: true`) to **both** peers.
  3. Both clients receive `call_connected` and unconditionally call `setupWebRTC()`, which executes **`this.pc.close()`** (`L1985`) on a completely healthy call — causing a multi-second audio cutout every time anyone switches tabs.
  4. **Fatal combination**: If Peer A switches back to their browser tab while Peer B's iPhone is momentarily backgrounded, Peer A's `auth_resume` closes Peer A's `pc` and sends a fresh SDP `offer` to Peer B — whose suspended iOS JS cannot generate an `answer`, **immediately killing the call**.
  5. Additionally, `onReconnect` does not update `session.lastHealAt`, so if [`onWakeOrOnline`](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/client/js/voice_call_client.js#L619-L628) simultaneously sends `call_heal`, the server emits **two** back-to-back `call_connected` rebuilds that collide mid-negotiation.

---

### RC-3 (Critical — Background Call Kill-Switch): Server `/ws` JSON Heartbeat + Hidden Reconnect Block + 15s `grace_expired` `pc.close()`
- **Where**: [`server.js` (`heartbeat`)](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/server/server.js#L1690-L1696), [`Net.connect`](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/client/js/net.js#L80), [`Net.onclose`](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/client/js/net.js#L92-L93), [`CALL.GRACE_MS`](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/shared/phase5_rules.js#L137), [`voiceService.tick`](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/server/voice_call_service.js#L431-L466), [`VoiceCallClient.handle('call_ended')`](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/client/js/voice_call_client.js#L1809-L1829).
- **Mechanism**:
  1. When backgrounded (`document.visibilityState === 'hidden'`), iOS freezes JS execution on the main thread.
  2. Server sends application-level JSON `{ type: 'ping' }` every **25s** (`HEARTBEAT_MS: 25000`). With JS frozen, client cannot send `{ type: 'pong' }`. After 2 missed pongs (**50–75s**), server calls `ws.terminate()`.
  3. `Net.onclose` explicitly refuses to reconnect while hidden (`if (document.visibilityState === 'hidden') return;`), even if an active call is in progress.
  4. `voiceService.onDisconnect` sets `graceUntil = now + 15000` (15s).
  5. 15s later, `voiceService.tick` deletes the session and sends `call_ended` (`reason: 'grace_expired'`) to **the foreground peer**, whose client runs `this.cleanup()` → **`this.pc.close()`**, killing WebRTC media even if the native audio transport was still alive.
  6. After another **90s** (`recentGraceDrops` TTL in `voice_call_service.js:339, 525`), automatic resume on wake also expires.

---

### RC-4 (High — Hands-Free Calls Drop After 30–60s): Missing Screen Wake Lock & MediaSession
- **Where**: [client/js/voice_call_client.js](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/client/js/voice_call_client.js) (missing `navigator.wakeLock` and `navigator.mediaSession`).
- **Mechanism**: When she is talking hands-free with Neora open on her table and doesn't touch the canvas for 30–60s, iOS auto-locks the screen. Screen lock immediately transitions the standalone PWA to background/suspended state, cutting mic capture and triggering RC-3.
- **Platform caveat (verified)**: `navigator.wakeLock.request('screen')` exists in Safari since iOS 16.4, but it was **broken in Home-Screen (standalone) web apps until iOS 18.4** ([WebKit #254545](https://bugs.webkit.org/show_bug.cgi?id=254545)). On iOS < 18.4 a UX fallback ("keep Neora open / screen on") is required.

---

### RC-5 (High — iOS Audio Interruption & Memory Eviction): WebAudio `AudioContext` Attached to Call Streams + Hard iOS Standalone PWA Limits
- **Where**: [`setupAudioAnalysis`](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/client/js/voice_call_client.js#L2349-L2376).
- **Mechanism**:
  1. **Hard OS limit**: iOS standalone WebKit PWAs do **not** have native `UIBackgroundModes: ["voip", "audio"]` or CallKit entitlements. Long-term locked-screen or cross-app microphone capture is blocked by iOS itself unless wrapped in a native shell (e.g., Capacitor).
  2. **WebAudio interference**: `setupAudioAnalysis` creates an `AudioContext` and hooks both `localStream` and `remoteStream` via `createMediaStreamSource` + a `100ms` `setInterval` VAD purely to animate waveform CSS bars. On iOS WebKit, `AudioContext` obeys the hardware silent switch / lock-screen interruption rules and conflicts with WebRTC's voice-chat `PlayAndRecord` session. Additionally, up to **9 separate `AudioContext` instances** exist across client modules alongside the Three.js WebGL context, increasing iOS Jetsam background memory kills.
     - **Verified (research)**: routing a **remote** WebRTC stream through `createMediaStreamSource` on iOS Safari is known to (a) detach it from the native pipeline and degrade **echo cancellation** (echo/feedback), (b) route output to the **quiet earpiece**, and (c) go **silent** when the context becomes `suspended`/`interrupted`. Best practice: remote audio only via `<audio playsinline autoplay>`. This may explain "voice disappeared" reports that are not real disconnects.
  3. **Missing audio session hint**: `navigator.audioSession.type = 'play-and-record'` (Safari 16.4+, [MDN](https://developer.mozilla.org/en-US/docs/Web/API/AudioSession)) is never set. It improves speaker/Bluetooth routing and ignores the mute switch, but does **not** keep background mic alive.
  3. *(Side note)*: `window.dispatchEvent(new CustomEvent('voice:duck', ...))` (`L370, 1800, 2493`) currently has zero listeners in the codebase, so game SFX/music are not actually ducked during calls.

---

### RC-6 (Medium-High — Drops on Brief Wi-Fi ↔ 5G Handoffs): Silent Packet Loss in `Net.send()`
- **Where**: [`Net.send`](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/client/js/net.js#L107) and [server/server.js](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/server/server.js#L1561-L1562).
- **Mechanism**: `Net.send` silently drops messages whenever `ws.readyState !== 1` (and the server silently drops messages sent after `ws.onopen` before `auth` completes). During a 2–5s mobile network handoff, both ICE and `/ws` blip together; when the 3.5s `_iceHealTimer` fires `triggerIceRestart` / `healCall` before `/ws` finishes `auth_ok`, `pc` transitions to `'have-local-offer'` while the outgoing SDP offer is silently discarded, leaving `pc` wedged. Meanwhile, `CALL.GRACE_MS` (`15000ms`) is shorter than 4 `Net` backoff retries (`0.15 + 1 + 2 + 4 + 8 = 15.15s`).

---

### RC-7 (Medium — Broken Self-Heal Edge Cases): Double-Fire on `failed`, Callee (`polite: true`) No-Op Fallback, and Stale Candidates
- **Where**: [`VoiceCallClient`](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/client/js/voice_call_client.js#L1702-L1721), [`L1755-L1759`](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/client/js/voice_call_client.js#L1755-L1759), [`L2151-L2162`](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/client/js/voice_call_client.js#L2151-L2162), [`L2230-L2256`](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/client/js/voice_call_client.js#L2230-L2256); [`voice_call_service.js`](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/server/voice_call_service.js#L368-L370).
- **Mechanism**:
  1. On `state === 'failed'` (`L2160-2161`), client calls `this.triggerIceRestart(pc)` **and immediately** `this.healCall('ice_failed')`, sending a stale offer from the old `pc` right before `call_connected` destroys and recreates `pc`.
  2. `healCall()` sets a **600ms** local fallback timer (`L1716`), which is tighter than international mobile RTT spikes and shorter than the server's **1200ms** silent throttle (`voice_call_service.js:368` returns `{ throttled: true }` with no socket reply). When that fallback fires on the **callee** (`this.polite === true`), `triggerIceRestart` (`L2238`: `if (!this.polite)`) **never creates an offer**, making the fallback a complete no-op.
  3. On `call_connected` (`L1755-1759`), `pendingCandidates` and `pendingDescription` are only cleared `if (!isSameCall)`, allowing stale pre-heal candidates to flush onto a newly recreated `RTCPeerConnection`.
  4. If a call hits `grace_expired` and a user manually taps Call within 90s, `call_invite` (`voice_call_service.js:78-174`) does not check `recentGraceDrops`, starting a fresh ring instead of seamlessly restoring the dropped session.

---

### RC-8 (Medium — Reload Race & No Background Ringing): Unbuffered Dynamic Import + No Web Push
- **Where**: [client/js/main.js](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/client/js/main.js#L1266), [`L1349`](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/client/js/main.js#L1349), [`L1731`](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/client/js/main.js#L1731); [client/sw.js](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/client/sw.js#L1-L27).
- **Mechanism**:
  1. `main.js` calls `net.connect()` synchronously (`L1731`) while dynamically importing `./voice_call_client.js` (`L1349`) **without a `pendingVoiceMsgs` queue** (unlike `pendingCasinoMsg` / `pendingCdMsg`). Because `sw.js` fetches `.js` network-first (`no-cache`), an iOS reload mid-call can receive `auth_ok` + `call_connected` before `voiceClient` finishes loading, dropping `call_connected` on the floor.
  2. `sw.js` has no `push` / `notificationclick` listeners (and server has no Web Push VAPID sender), so iOS 16.4+ Home-Screen PWAs cannot show incoming call banners when backgrounded/closed.

---

## 3. Recommended Development Roadmap for Next Agent

### Phase A: High-Impact Web/PWA Fixes (Solves Foreground Drops & Short App Switches)

1. **Auto-Enforce DPI-Safe TURN Relay (`turns:443?transport=tcp`) Without URL Params**:
   - In `voice_call_service.js` (`getIceConfig`), pass caller/callee profiles (`lineage === 'dxb'` or configurable relay mode). When either participant is `'dxb'` (or on ICE fallback), serve **only TCP/TLS 443 TURN relays** (`turns:sg.relay.metered.ca:443?transport=tcp`, `turns:standard.relay.metered.ca:443?transport=tcp`, plus `:80?transport=tcp` fallback) — omitting UDP TURN/STUN or setting `forceRelay: true` in the `call_connected` payload so `setupWebRTC` sets `iceTransportPolicy: 'relay'` regardless of `manifest.json`'s `start_url`.
   - Consider time-limited REST TURN credentials (Metered Secret Key API or Cloudflare Calls TURN) if static Metered credentials hit quota limits.

2. **Stop `auth_resume` From Tearing Down Healthy Calls**:
   - **Server** (`voice_call_service.js:onReconnect`): Add an explicit parameter `{ fromResume: true }`. Only broadcast `call_connected` (`resumed: true`) if `session.graceUntil !== null` (or if restored from `recentGraceDrops`), and record `session.lastHealAt = nowMs`.
   - **Client** (`voice_call_client.js:handle('call_connected')`): If `this._state === 'connected'`, `this.callId === msg.callId`, `!msg.healed`, `this.pc` is already `'connected'`/`'completed'`, and `_isLocalMicHealthy()`, **keep the existing `RTCPeerConnection` untouched** instead of calling `setupWebRTC()`.

3. **Decouple Active Calls From Background `/ws` Sleep**:
   - Increase `CALL.GRACE_MS` in `shared/phase5_rules.js` from `15_000` (15s) to at least `120_000`–`180_000` (2–3 minutes), and extend `recentGraceDrops` to 5 minutes.
   - In `server/server.js`, use native WebSocket protocol `ws.ping()` frames alongside app pings, and relax `MAX_MISSED_PONGS` when `voiceService.activeCallOf(ws.userId)?.state === 'connected'`.
   - In `client/js/net.js`, allow `/ws` auto-reconnect even when `document.visibilityState === 'hidden'` **if** a voice call is currently active (`window.__neora?.voiceClient?.state !== 'idle'`).
   - In `voice_call_client.js`, when `grace_expired` arrives on the foreground peer, check if `this.pc?.iceConnectionState` is still `'connected'`/`'completed'` before tearing down `this.pc`.

4. **Prevent iPhone Screen Auto-Lock & iOS AudioContext Conflicts**:
   - Acquire `navigator.wakeLock.request('screen')` while `_state` is `'calling' | 'incoming' | 'connected'`, re-acquiring on `visibilitychange -> visible`, and release in `cleanup()` (effective in Home-Screen PWAs only on **iOS 18.4+**; show a "keep Neora open" hint otherwise).
   - Set `navigator.audioSession.type = 'play-and-record'` during calls (restore `'auto'` on cleanup).
   - Register `navigator.mediaSession` metadata and action handlers (`hangup` / `pause`) while in a call.
   - On iOS (`env.iOS`), avoid attaching `remoteStream` / `localStream` to a WebAudio `AudioContext` in `setupAudioAnalysis` (use `RTCRtpReceiver.getSynchronizationSources()` / `pc.getStats()` audioLevel for lightweight VAD instead of `AudioContext` + `100ms` FFT).

5. **Harden Signaling Queue, Heal Races & Startup Buffering**:
   - Queue outbound `call_*` messages in `Net` (or `VoiceCallClient`) while `/ws` is reconnecting/authenticating and flush immediately upon `auth_ok` / `resume_ok`.
   - In `checkIceHealth` (`state === 'failed'`), call **only** `healCall('ice_failed')` (do not also call `triggerIceRestart(pc)` right before `pc` is replaced).
   - Clear `this.pendingCandidates = []` and `this.pendingDescription = null` on **every** `setupWebRTC()` / `healed` rebuild, even when `isSameCall === true`.
   - Fix `healCall` local fallback (`600ms` → `2500ms`, and allow polite peer to send `{ type: 'call_heal' }` retry rather than a no-op `triggerIceRestart`).
   - Add a `pendingVoiceMsgs` array in `client/js/main.js` so `call_incoming` / `call_connected` arriving before `import('./voice_call_client.js')` resolves are replayed once constructed.

---

### Phase B: Incoming Call Alerts While Closed (Web Push — Optional Web Enhancement)
- Implement VAPID Web Push subscription + `push` & `notificationclick` handlers in `client/sw.js` (supported on iOS 16.4+ Home-Screen PWAs) so `call_invite` pushes a native iOS banner when the recipient's `/ws` is offline or unresponsive.
- **Verified limits**: every push **must** call `showNotification()` (no silent push, or permission gets revoked); only a single system ping (no looping ringtone, no custom sound); no CallKit-style call screen — tapping opens the PWA. Treat it as a "Nook is calling 📞" alert only. ([WebKit blog](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/))

---

### Phase C: True Locked-Screen / Multi-App iOS Background VoIP (Requires Native App — NOT just a wrapper)
- **Constraint**: Pure iOS Home-Screen PWAs **cannot** keep the microphone active when the user locks the iPhone or switches into other apps — `getUserMedia` is muted by iOS ([WebKit #226620](https://bugs.webkit.org/show_bug.cgi?id=226620)). No web trick (silent audio, Media Session, `audioSession`) changes this.
- **Correction (verified)**: A plain **Capacitor/WKWebView wrapper is NOT sufficient**. Even with `UIBackgroundModes: audio`, `getUserMedia` mic capture inside `WKWebView` still drops in background ([WebKit #241480](https://bugs.webkit.org/show_bug.cgi?id=241480)).
- **Real solution (if required)**: native iOS app shell whose **call audio runs in a native WebRTC stack** (e.g. a native WebRTC / LiveKit plugin, not the web view), with `UIBackgroundModes: ["audio", "voip"]`, `AVAudioSession(.playAndRecord, mode: .voiceChat, options: [.allowBluetooth, .defaultToSpeaker])`, PushKit + CallKit for lock-screen ringing. This is a product-level project, not a bug fix.

---

## 3b. Platform Fact-Check Summary (verified by research, 2026-10-23)

| Topic | Verdict |
| :--- | :--- |
| Screen Wake Lock in Home-Screen PWA | Works only on **iOS 18.4+** (broken in standalone before that) |
| Background two-way WebRTC in PWA | **Not possible** — mic muted on lock/app-switch; inbound audio may continue ~30–40s |
| `navigator.audioSession` | Safari 16.4+; use `'play-and-record'` for routing; does not enable background |
| WebAudio on remote WebRTC stream (iOS) | **Avoid** — breaks AEC, earpiece routing, silent on interruption |
| Web Push for calls | Notification ping only; no ringing loop / call UI |
| ICE priority | RFC 8445 priority, not array order; UDP beats TCP; `iceTransportPolicy:'relay'` + only `turns:` TCP URLs forces TLS/443 |
| Capacitor wrapper alone | **Insufficient** for locked-screen calls (WKWebView mic drops in background) |

## 3c. Security Note
- Metered TURN usernames/credentials are **hardcoded in both** `server/voice_call_service.js` (`getIceConfig`) and `client/js/voice_call_client.js` (`setupWebRTC` `defaultIce`), so they are publicly readable in shipped JS. Recommend server-issued **short-lived TURN credentials** and rotating the current ones (cost/abuse risk, not a reliability issue).

> 📋 The step-by-step implementation plan lives in [IMPLEMENTATION_PLAN_voice_call.md](file:///Users/thanapat/Documents/neora-world-v3/neora-world-v2/IMPLEMENTATION_PLAN_voice_call.md).

---

## 4. Verification Checklist for Next Agent

- [ ] Run existing suite: `cd neora-world-v2 && npm test` (ensure `tests/voice_call.test.js` and all suite tests pass).
- [ ] Add unit tests in `tests/voice_call.test.js` covering:
  - `onReconnect` during a healthy call (`graceUntil === null`) does **not** emit redundant `call_connected` teardowns.
  - `'dxb'` lineage calls receive DPI-safe relay-only / TLS-TCP ICE config without requiring URL query params.
  - Extended `GRACE_MS` survival and `call_invite` seamless restoration from `recentGraceDrops`.
- [ ] Manual iPhone Home-Screen QA:
  - Start call from Home-Screen icon → leave phone untouched for 2+ minutes (verify Screen Wake Lock prevents sleep).
  - Have desktop/other peer Alt-Tab repeatedly during call (verify zero audio reset).
  - Toggle Wi-Fi ↔ 5G mid-call on both caller (`polite: false`) and callee (`polite: true`) (verify clean auto-heal within seconds).
