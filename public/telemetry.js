/**
 * Nook Airline — Call Telemetry ("mini Sentry")
 *
 * Runs on each phone. Every 5 seconds it samples WebRTC getStats() and records
 * the numbers that explain "robot voice": packet loss, jitter, jitter-buffer delay,
 * concealment (synthetic filler audio) and time-stretching (accelerate/decelerate).
 * It also records lifecycle events (WebSocket, ICE, tracks, AudioContexts, errors).
 *
 * Everything is buffered locally and shipped to POST /api/telemetry, so nothing is
 * lost when the signaling socket drops. Logs are stored server-side in logs/*.jsonl
 * and shown live at /debug.
 *
 * URL flags:
 *   ?debug=1  -> show a small live stats overlay with a "Robot now" marker button
 *   ?novis=1  -> disable the voice-ring visualizers (extra AudioContexts) for A/B tests
 */
(function () {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  const IS_IOS = /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const FLAGS = {
    debug: params.get('debug') === '1',
    // Visualizer AudioContexts are off by default on iPhone/iPad so the audio pipeline only
    // carries the call. ?vis=1 forces them on, ?novis=1 forces them off anywhere.
    novis: params.get('novis') === '1' || (IS_IOS && params.get('vis') !== '1'),
    ios: IS_IOS
  };

  const SESSION_ID = Math.random().toString(36).slice(2, 10);
  const SAMPLE_MS = 5000;
  const FLUSH_MS = 5000;
  const MAX_QUEUE = 3000;

  let terminal = detectTerminal();
  let callId = null;
  let queue = [];
  let flushing = false;
  let statsTimer = null;
  let activePc = null;
  let prev = null;
  let lastSample = null;
  const audioContexts = [];

  function detectTerminal() {
    const p = window.location.pathname.toLowerCase();
    if (p.includes('/bkk') || params.get('terminal') === 'bkk') return 'bkk';
    if (p.includes('/dxb') || params.get('terminal') === 'dxb') return 'dxb';
    return '';
  }

  // ---------------------------------------------------------------------------
  // Event queue + shipping
  // ---------------------------------------------------------------------------
  function event(kind, data) {
    const entry = {
      t: Date.now(),
      kind,
      session: SESSION_ID,
      terminal,
      callId,
      data: data || {}
    };
    queue.push(entry);
    if (queue.length > MAX_QUEUE) queue.splice(0, queue.length - MAX_QUEUE);
    if (FLAGS.debug && kind !== 'stats') renderOverlayEvent(entry);
  }

  async function flush(useBeacon) {
    if (flushing || queue.length === 0) return;
    const batch = queue.splice(0, 250);
    const body = JSON.stringify({ events: batch });

    if (useBeacon && navigator.sendBeacon) {
      const ok = navigator.sendBeacon('/api/telemetry', new Blob([body], { type: 'text/plain' }));
      if (!ok) queue.unshift(...batch);
      return;
    }

    flushing = true;
    try {
      const res = await fetch('/api/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body,
        keepalive: body.length < 60000
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
    } catch (err) {
      // Network blip: put the batch back and retry on the next tick
      queue.unshift(...batch);
    } finally {
      flushing = false;
    }
  }

  setInterval(() => flush(false), FLUSH_MS);
  window.addEventListener('pagehide', () => {
    event('page_hide');
    flush(true);
  });
  document.addEventListener('visibilitychange', () => {
    event('visibility', { state: document.visibilityState });
    if (document.visibilityState === 'hidden') flush(true);
  });
  window.addEventListener('online', () => event('net_online'));
  window.addEventListener('offline', () => event('net_offline'));
  if (navigator.connection && navigator.connection.addEventListener) {
    navigator.connection.addEventListener('change', () => event('net_change', connectionInfo()));
  }
  window.addEventListener('error', (e) => {
    event('js_error', {
      message: e.message,
      source: e.filename,
      line: e.lineno,
      col: e.colno
    });
  });
  window.addEventListener('unhandledrejection', (e) => {
    const reason = e.reason;
    event('js_rejection', { message: reason && reason.message ? reason.message : String(reason) });
  });

  function connectionInfo() {
    const c = navigator.connection;
    if (!c) return {};
    return { type: c.type, effectiveType: c.effectiveType, downlink: c.downlink, rtt: c.rtt, saveData: c.saveData };
  }

  // ---------------------------------------------------------------------------
  // AudioContext tracker: counts every AudioContext the app creates (iOS Safari
  // is sensitive to multiple contexts / mismatched sample rates during a call)
  // ---------------------------------------------------------------------------
  (function wrapAudioContext() {
    const Orig = window.AudioContext || window.webkitAudioContext;
    if (!Orig) return;
    function TrackedAudioContext(...args) {
      const ctx = new Orig(...args);
      audioContexts.push(ctx);
      const origin = (new Error().stack || '').split('\n').slice(2, 4).map((s) => s.trim()).join(' | ');
      event('audioctx_created', {
        count: audioContexts.length,
        sampleRate: ctx.sampleRate,
        state: ctx.state,
        baseLatency: ctx.baseLatency,
        origin
      });
      ctx.addEventListener('statechange', () => {
        event('audioctx_state', { sampleRate: ctx.sampleRate, state: ctx.state, count: audioContexts.length });
      });
      return ctx;
    }
    TrackedAudioContext.prototype = Orig.prototype;
    window.AudioContext = TrackedAudioContext;
    if (window.webkitAudioContext) window.webkitAudioContext = TrackedAudioContext;
  })();

  // ---------------------------------------------------------------------------
  // WebRTC stats sampling
  // ---------------------------------------------------------------------------
  function attachPeerConnection(pc) {
    detachPeerConnection();
    activePc = pc;
    prev = null;

    pc.addEventListener('iceconnectionstatechange', () => event('ice_state', { state: pc.iceConnectionState }));
    pc.addEventListener('connectionstatechange', () => event('pc_state', { state: pc.connectionState }));
    pc.addEventListener('icegatheringstatechange', () => event('ice_gathering', { state: pc.iceGatheringState }));
    pc.addEventListener('signalingstatechange', () => event('signaling_state', { state: pc.signalingState }));
    pc.addEventListener('icecandidateerror', (e) => {
      event('ice_candidate_error', { url: e.url, errorCode: e.errorCode, errorText: e.errorText });
    });
    pc.addEventListener('track', (e) => {
      const track = e.track;
      event('remote_track', { kind: track.kind, muted: track.muted, readyState: track.readyState });
      track.addEventListener('mute', () => event('remote_track_mute', { kind: track.kind }));
      track.addEventListener('unmute', () => event('remote_track_unmute', { kind: track.kind }));
      track.addEventListener('ended', () => event('remote_track_ended', { kind: track.kind }));
    });

    statsTimer = setInterval(() => sample(pc), SAMPLE_MS);
    event('pc_attached');
  }

  function detachPeerConnection() {
    if (statsTimer) clearInterval(statsTimer);
    statsTimer = null;
    activePc = null;
    prev = null;
  }

  function watchLocalStream(stream) {
    if (!stream) return;
    stream.getAudioTracks().forEach((track) => {
      const settings = track.getSettings ? track.getSettings() : {};
      event('mic_ready', {
        label: track.label,
        sampleRate: settings.sampleRate,
        channelCount: settings.channelCount,
        echoCancellation: settings.echoCancellation,
        noiseSuppression: settings.noiseSuppression,
        autoGainControl: settings.autoGainControl,
        latency: settings.latency
      });
      track.addEventListener('mute', () => event('mic_mute_by_os'));
      track.addEventListener('unmute', () => event('mic_unmute_by_os'));
      track.addEventListener('ended', () => event('mic_ended'));
    });
  }

  function num(v) {
    return typeof v === 'number' && isFinite(v) ? v : 0;
  }

  function delta(cur, old, key) {
    if (!cur || !old) return 0;
    return Math.max(0, num(cur[key]) - num(old[key]));
  }

  function round(v, d = 1) {
    const f = Math.pow(10, d);
    return Math.round(v * f) / f;
  }

  async function sample(pc) {
    if (!pc || pc !== activePc || pc.connectionState === 'closed') return;
    let report;
    try {
      report = await pc.getStats();
    } catch (err) {
      event('stats_error', { message: err.message });
      return;
    }

    let inbound = null;
    let outbound = null;
    let remoteInbound = null;
    let pair = null;
    let videoBytesOut = 0;
    let selectedPairId = null;
    const codecs = {};

    report.forEach((r) => {
      if (r.type === 'transport' && r.selectedCandidatePairId) selectedPairId = r.selectedCandidatePairId;
      if (r.type === 'codec') codecs[r.id] = r;
    });

    report.forEach((r) => {
      const kind = r.kind || r.mediaType;
      if (r.type === 'inbound-rtp' && kind === 'audio') inbound = r;
      if (r.type === 'outbound-rtp' && kind === 'audio') outbound = r;
      if (r.type === 'outbound-rtp' && kind === 'video') videoBytesOut += num(r.bytesSent);
      if (r.type === 'remote-inbound-rtp' && kind === 'audio') remoteInbound = r;
      if (r.type === 'candidate-pair') {
        if (selectedPairId ? r.id === selectedPairId : (r.selected || (r.nominated && r.state === 'succeeded'))) {
          pair = r;
        }
      }
    });

    const local = pair ? report.get(pair.localCandidateId) : null;
    const remote = pair ? report.get(pair.remoteCandidateId) : null;
    const inCodec = inbound && inbound.codecId ? codecs[inbound.codecId] : null;
    const outCodec = outbound && outbound.codecId ? codecs[outbound.codecId] : null;

    const now = performance.now();
    const cur = { at: now, inbound, outbound, pair, videoBytesOut };
    const dt = prev ? (now - prev.at) / 1000 : 0;

    const s = {
      path: {
        localType: local ? local.candidateType : null,
        localProtocol: local ? local.protocol : null,
        relayProtocol: local ? local.relayProtocol || null : null,
        relayUrl: local ? local.url || null : null,
        remoteType: remote ? remote.candidateType : null,
        remoteProtocol: remote ? remote.protocol : null
      },
      rttMs: pair && pair.currentRoundTripTime !== undefined ? Math.round(pair.currentRoundTripTime * 1000) : null,
      availOutKbps: pair && pair.availableOutgoingBitrate ? Math.round(pair.availableOutgoingBitrate / 1000) : null,
      inCodec: inCodec ? { mime: inCodec.mimeType, fmtp: inCodec.sdpFmtpLine } : null,
      outCodec: outCodec ? { mime: outCodec.mimeType, fmtp: outCodec.sdpFmtpLine } : null,
      audioContexts: audioContexts.map((c) => c.sampleRate + ':' + c.state),
      visible: document.visibilityState
    };

    if (inbound) {
      s.rx = {
        jitterMs: round(num(inbound.jitter) * 1000),
        audioLevel: round(num(inbound.audioLevel), 3),
        packetsLostTotal: num(inbound.packetsLost),
        concealmentEventsTotal: num(inbound.concealmentEvents)
      };
    }
    if (remoteInbound) {
      s.partnerSeesOurStream = {
        fractionLostPct: round(num(remoteInbound.fractionLost) * 100),
        jitterMs: round(num(remoteInbound.jitter) * 1000),
        rttMs: remoteInbound.roundTripTime !== undefined ? Math.round(remoteInbound.roundTripTime * 1000) : null
      };
    }

    if (prev && dt > 0) {
      const pi = prev.inbound;
      const po = prev.outbound;

      if (inbound && pi) {
        const recv = delta(inbound, pi, 'packetsReceived');
        const lost = delta(inbound, pi, 'packetsLost');
        const samples = delta(inbound, pi, 'totalSamplesReceived');
        const concealed = delta(inbound, pi, 'concealedSamples') - delta(inbound, pi, 'silentConcealedSamples');
        const inserted = delta(inbound, pi, 'insertedSamplesForDeceleration');
        const removed = delta(inbound, pi, 'removedSamplesForAcceleration');
        const jbDelay = delta(inbound, pi, 'jitterBufferDelay');
        const jbEmitted = delta(inbound, pi, 'jitterBufferEmittedCount');

        s.rx.lossPct = recv + lost > 0 ? round((lost / (recv + lost)) * 100) : 0;
        s.rx.packetsPerSec = round(recv / dt);
        s.rx.kbps = round((delta(inbound, pi, 'bytesReceived') * 8) / dt / 1000);
        s.rx.concealPct = samples > 0 ? round((Math.max(0, concealed) / samples) * 100) : 0;
        s.rx.stretchPct = samples > 0 ? round(((inserted + removed) / samples) * 100) : 0;
        s.rx.jitterBufferMs = jbEmitted > 0 ? Math.round((jbDelay / jbEmitted) * 1000) : null;
        s.rx.discarded = delta(inbound, pi, 'packetsDiscarded');
        s.rx.fecPackets = delta(inbound, pi, 'fecPacketsReceived');
      }

      if (outbound && po) {
        s.tx = {
          kbps: round((delta(outbound, po, 'bytesSent') * 8) / dt / 1000),
          packetsPerSec: round(delta(outbound, po, 'packetsSent') / dt),
          retransmitted: delta(outbound, po, 'retransmittedPacketsSent'),
          targetKbps: outbound.targetBitrate ? Math.round(outbound.targetBitrate / 1000) : null
        };
      }
      s.txVideoKbps = round((Math.max(0, videoBytesOut - num(prev.videoBytesOut)) * 8) / dt / 1000);

      // Verdict: concealment / time-stretch are what you hear as "robot voice"
      const conceal = s.rx ? num(s.rx.concealPct) : 0;
      const stretch = s.rx ? num(s.rx.stretchPct) : 0;
      const loss = s.rx ? num(s.rx.lossPct) : 0;
      if (conceal >= 5 || stretch >= 5 || loss >= 5) s.verdict = 'bad';
      else if (conceal >= 1 || stretch >= 1 || loss >= 1) s.verdict = 'warn';
      else s.verdict = 'ok';
    }

    prev = cur;
    lastSample = s;
    event('stats', s);
    if (FLAGS.debug) renderOverlayStats(s);
  }

  // ---------------------------------------------------------------------------
  // Call lifecycle helpers
  // ---------------------------------------------------------------------------
  function callStarted(role) {
    callId = terminal + '-' + Date.now().toString(36);
    event('call_start', { role });
  }

  function callEnded(reason) {
    event('call_end', { reason });
    detachPeerConnection();
    callId = null;
    flush(false);
  }

  function setTerminal(t) {
    if (t && t !== terminal) {
      terminal = t;
      event('terminal_assigned', { terminal: t });
    }
  }

  function mark(note) {
    event('user_mark', { note: note || 'robot', lastSample });
    flush(false);
  }

  // ---------------------------------------------------------------------------
  // Optional debug overlay (?debug=1)
  // ---------------------------------------------------------------------------
  let overlay = null;
  let overlayStats = null;
  let overlayEvents = null;

  function ensureOverlay() {
    if (overlay || !document.body) return;
    overlay = document.createElement('div');
    overlay.id = 'nookTelemetryOverlay';
    overlay.style.cssText = [
      'position:fixed', 'left:8px', 'bottom:8px', 'z-index:99999', 'width:230px',
      'font:11px/1.35 ui-monospace,Menlo,monospace', 'color:#e8f0ff',
      'background:rgba(10,14,24,0.82)', 'backdrop-filter:blur(8px)', '-webkit-backdrop-filter:blur(8px)',
      'border:1px solid rgba(255,255,255,0.12)', 'border-radius:12px', 'padding:8px 10px',
      'pointer-events:auto'
    ].join(';');
    overlayStats = document.createElement('div');
    overlayStats.textContent = 'Waiting for call stats…';
    overlayEvents = document.createElement('div');
    overlayEvents.style.cssText = 'margin-top:6px;max-height:70px;overflow:hidden;opacity:0.7';
    const btn = document.createElement('button');
    btn.id = 'telemetryMarkRobotBtn';
    btn.type = 'button';
    btn.textContent = '🤖 Robot now';
    btn.style.cssText = 'margin-top:6px;width:100%;padding:6px;border:0;border-radius:8px;background:#e5484d;color:#fff;font-weight:600';
    btn.addEventListener('click', () => {
      mark('robot');
      btn.textContent = '✓ Marked';
      setTimeout(() => (btn.textContent = '🤖 Robot now'), 1500);
    });
    overlay.appendChild(overlayStats);
    overlay.appendChild(btn);
    overlay.appendChild(overlayEvents);
    document.body.appendChild(overlay);
  }

  function renderOverlayStats(s) {
    ensureOverlay();
    if (!overlayStats) return;
    const rx = s.rx || {};
    const color = s.verdict === 'bad' ? '#ff6b6b' : s.verdict === 'warn' ? '#ffd166' : '#5ee6a8';
    const path = s.path.localType === 'relay'
      ? 'relay/' + (s.path.relayProtocol || '?')
      : (s.path.localType || '?') + '/' + (s.path.localProtocol || '?');
    overlayStats.innerHTML =
      '<b style="color:' + color + '">' + (s.verdict || '…').toUpperCase() + '</b> · ' + terminal.toUpperCase() + '<br>' +
      'loss ' + (rx.lossPct ?? '-') + '% · conceal ' + (rx.concealPct ?? '-') + '%<br>' +
      'stretch ' + (rx.stretchPct ?? '-') + '% · jbuf ' + (rx.jitterBufferMs ?? '-') + 'ms<br>' +
      'jitter ' + (rx.jitterMs ?? '-') + 'ms · rtt ' + (s.rttMs ?? '-') + 'ms<br>' +
      'path ' + path + ' · rx ' + (rx.kbps ?? '-') + 'kbps';
  }

  function renderOverlayEvent(entry) {
    ensureOverlay();
    if (!overlayEvents) return;
    const line = document.createElement('div');
    line.textContent = new Date(entry.t).toLocaleTimeString() + ' ' + entry.kind;
    overlayEvents.prepend(line);
    while (overlayEvents.childNodes.length > 5) overlayEvents.removeChild(overlayEvents.lastChild);
  }

  // ---------------------------------------------------------------------------
  // Session start
  // ---------------------------------------------------------------------------
  event('session_start', {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    url: window.location.pathname + window.location.search,
    screen: window.screen ? window.screen.width + 'x' + window.screen.height : null,
    flags: FLAGS,
    connection: connectionInfo()
  });

  window.NookTelemetry = {
    flags: FLAGS,
    sessionId: SESSION_ID,
    event,
    flush,
    mark,
    setTerminal,
    attachPeerConnection,
    detachPeerConnection,
    watchLocalStream,
    callStarted,
    callEnded,
    getLastSample: () => lastSample
  };
})();
