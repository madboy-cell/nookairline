/**
 * Nook Airline — Private First-Class WebRTC Engine
 * Tailored for low-latency, encrypted Dubai-to-Bangkok calls.
 */

// --- Low-Latency Singapore Relay (Primary) + Standard Relay (Fallback) ---
const RTC_CONFIG = {
  iceServers: [
    // 1. Primary: Singapore TURNS (TLS over TCP Port 443 - Bypasses du & Etisalat DPI in Dubai)
    {
      urls: 'turns:sg.relay.metered.ca:443?transport=tcp',
      username: '3867582a8d4e4558f1a6097d',
      credential: 'trPaqBzsrXg7uShi'
    },
    // 2. Secondary: Singapore TURN over Port 443
    {
      urls: 'turn:sg.relay.metered.ca:443',
      username: '3867582a8d4e4558f1a6097d',
      credential: 'trPaqBzsrXg7uShi'
    },
    // 3. Fallback: Singapore TURN over Port 80 TCP
    {
      urls: 'turn:sg.relay.metered.ca:80?transport=tcp',
      username: '3867582a8d4e4558f1a6097d',
      credential: 'trPaqBzsrXg7uShi'
    },
    // 4. Fallback: Singapore TURN over Port 80 UDP
    {
      urls: 'turn:sg.relay.metered.ca:80',
      username: '3867582a8d4e4558f1a6097d',
      credential: 'trPaqBzsrXg7uShi'
    },
    // 5. STUN fallbacks
    {
      urls: 'stun:stun.relay.metered.ca:80'
    },
    {
      urls: 'stun:stun.l.google.com:19302'
    },
    // 6. Secondary Backup Relay: Standard Relay TURNS over Port 443 TCP
    {
      urls: 'turns:standard.relay.metered.ca:443?transport=tcp',
      username: 'f65010fdd6f7f2617f764376',
      credential: 'tvV8GFDSPqR4f2De'
    }
  ],
  // If ?dubai=1 or ?relay=1 is in URL, force 100% relay immediately
  iceTransportPolicy: (new URLSearchParams(window.location.search).get('dubai') === '1' || 
                       new URLSearchParams(window.location.search).get('relay') === '1') 
                       ? 'relay' : 'all'
};

console.log(`[ICE Policy] Active transport policy: ${RTC_CONFIG.iceTransportPolicy}`);

// State Variables
let localStream = null;
let remoteStream = null;
let peerConnection = null;
let ws = null;
let isCallActive = false;
let currentFacingMode = 'user'; // 'user' (front) or 'environment' (back)
let isMicMuted = false;
let isCameraOff = true;
let callTimerInterval = null;
let callStartTime = null;
let isCaller = false;
let partnerOfflineGraceTimer = null;
let pendingCandidates = []; // ICE candidates that arrived before the remote description
let callConnectedOnce = false; // so auto-heal rebuilds don't replay the connect chime

// Auto-heal state (rebuilds the connection when the audio degrades)
let healMonitorInterval = null;
let healBadStreak = 0;
let healMinRtt = null;
let healLastSample = null;
let healConnectedAt = 0;
let lastHealAt = 0;
let isRebuilding = false;
let healRequestTimer = null;

// Telemetry helper (no-op if telemetry.js failed to load)
function tlog(kind, data) {
  if (window.NookTelemetry) window.NookTelemetry.event(kind, data);
}
const TELEMETRY_QUIET_TYPES = new Set([
  'avatar_move', 'avatar_outfit', 'avatar_emote', 'avatar_hug', 'avatar_scenery', 'scene_change',
  'monopoly_open', 'monopoly_close', 'monopoly_action', 'monopoly_sync', 'monopoly_lobby_update', 'monopoly_start_party', 'candidate'
]);
let iceRefreshInterval = null;

// Partner & UX State
let partnerCameraOff = true;
let partnerMicMuted = false;
let wakeLock = null;
let statsInterval = null;
let chimeCtx = null;
let remoteAudioCtx = null;
let remoteAudioAnalyser = null;
let remoteVisualizerAnimId = null;
let remoteAudioSource = null;

// DOM Elements
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const remoteAudio = document.getElementById('remoteAudio');
const flightStatusCapsule = document.getElementById('flightStatusCapsule');
const capsuleDot = document.getElementById('capsuleDot');
const capsuleText = document.getElementById('capsuleText');
const capsuleCopyBtn = document.getElementById('capsuleCopyBtn');
const securityBadge = document.getElementById('securityBadge');
const connectionBadgeText = document.getElementById('connectionBadgeText');
const callTimerChip = document.getElementById('callTimerChip');
const callDuration = document.getElementById('callDuration');
const audioLounge = document.getElementById('audioLounge');
const partnerName = document.getElementById('partnerName');
const partnerMuteBadge = document.getElementById('partnerMuteBadge');
const remoteVoiceRing = document.getElementById('remoteVoiceRing');
const remoteVoiceRingOuter = document.getElementById('remoteVoiceRingOuter');
const callStage = document.getElementById('callStage');
const appContainer = document.getElementById('app');

// Buttons
const micBtn = document.getElementById('micBtn');
const micLabel = document.getElementById('micLabel');
const cameraBtn = document.getElementById('cameraBtn');
const cameraLabel = document.getElementById('cameraLabel');
const flipCameraBtn = document.getElementById('flipCameraBtn');
const callActionBtn = document.getElementById('callActionBtn');
const callActionLabel = document.getElementById('callActionLabel');
const cameraOffOverlay = document.getElementById('cameraOffOverlay');
const localPip = document.getElementById('localPip');
const audioPermissionBanner = document.getElementById('audioPermissionBanner');

// Capsule Status & Toast Helper
function updateCapsule(text, isReady = false) {
  if (capsuleText) capsuleText.textContent = text;
  if (flightStatusCapsule) {
    flightStatusCapsule.classList.toggle('ready', isReady);
  }
  if (callActionBtn) {
    callActionBtn.classList.toggle('ready-to-connect', isReady && !isCallActive);
  }

  const isCouple = !!(window.SkySupabase?.coupleStatus?.isCouple);
  const capsuleBtnLabel = document.getElementById('capsuleBtnLabel');
  const capsuleBtnIcon = document.getElementById('capsuleBtnIcon');

  if (capsuleCopyBtn) {
    if (!isCouple) {
      if (capsuleBtnIcon) capsuleBtnIcon.textContent = '💞';
      if (capsuleBtnLabel) capsuleBtnLabel.textContent = 'Pair Partner';
      capsuleCopyBtn.title = 'Open Couple Sanctuary to Link Partner';
      capsuleCopyBtn.classList.remove('is-connected');
    } else if (isReady) {
      if (capsuleBtnIcon) capsuleBtnIcon.textContent = '💚';
      if (capsuleBtnLabel) capsuleBtnLabel.textContent = 'Connected';
      capsuleCopyBtn.title = 'Partner Online • Couple Sanctuary';
      capsuleCopyBtn.classList.add('is-connected');
    } else {
      const partnerUname = window.SkySupabase?.coupleStatus?.partner?.username || 'Partner';
      if (capsuleBtnIcon) capsuleBtnIcon.textContent = '💌';
      if (capsuleBtnLabel) capsuleBtnLabel.textContent = 'Invite';
      capsuleCopyBtn.title = `Share Flight Invite Link with ${partnerUname}`;
      capsuleCopyBtn.classList.remove('is-connected');
    }
  }
}

function showToast(text) {
  let toast = document.getElementById('airlineToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'airlineToast';
    toast.className = 'airline-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = text;
  toast.classList.add('visible');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.classList.remove('visible');
  }, 2600);
}
window.showToast = showToast;

// --- Initialization ---
window.addEventListener('DOMContentLoaded', async () => {
  setupDraggablePip();
  await initLocalMedia();
  initSignaling();
  setupEventListeners();
  if (typeof initAvatarStage === 'function') {
    initAvatarStage();
  }

  // Mobile Audio Unlock: iOS Safari requires user gesture to play incoming audio stream
  const unlockAudio = () => {
    if (remoteAudio && remoteAudio.srcObject) {
      remoteAudio.play().then(() => {
        if (audioPermissionBanner) audioPermissionBanner.classList.add('hidden');
      }).catch(() => {});
    }
    if (remoteVideo && remoteVideo.srcObject) {
      remoteVideo.play().catch(() => {});
    }
    if (webAudioCtx && webAudioCtx.state === 'suspended') {
      webAudioCtx.resume();
    }
  };
  document.addEventListener('touchstart', unlockAudio, { passive: true });
  document.addEventListener('click', unlockAudio);
});

// Audio SDP Optimizer, tuned for a thin uplink behind TURN + VPN:
//  - 60 ms packets (~17 pkt/s instead of 50) => far less per-packet IP/UDP/TURN/SRTP/VPN overhead
//  - 24 kbps VBR mono voice with in-band FEC
//  - DTX: near-zero traffic while silent
const AUDIO_PTIME_MS = 60;
const AUDIO_MAX_BITRATE = 24000;

function optimizeAudioSDP(sdp) {
  if (!sdp) return sdp;
  // Match opus payload type from rtpmap
  const opusMatch = sdp.match(/a=rtpmap:(\d+) opus\/48000\/2/i);
  if (!opusMatch) return sdp;
  const pt = opusMatch[1];
  const want = {
    useinbandfec: '1',
    usedtx: '1',
    maxaveragebitrate: String(AUDIO_MAX_BITRATE),
    stereo: '0',
    'sprop-stereo': '0',
    cbr: '0'
  };

  const fmtpRegex = new RegExp(`a=fmtp:${pt} ([^\\r\\n]*)`, 'i');
  if (fmtpRegex.test(sdp)) {
    sdp = sdp.replace(fmtpRegex, (match, params) => {
      const map = new Map(
        params.split(';').map((kv) => kv.trim()).filter(Boolean).map((kv) => {
          const i = kv.indexOf('=');
          return i < 0 ? [kv, ''] : [kv.slice(0, i), kv.slice(i + 1)];
        })
      );
      Object.entries(want).forEach(([k, v]) => map.set(k, v));
      return `a=fmtp:${pt} ` + [...map].map(([k, v]) => (v === '' ? k : `${k}=${v}`)).join(';');
    });
  } else {
    sdp = sdp.replace(
      opusMatch[0],
      `${opusMatch[0]}\r\na=fmtp:${pt} ` + Object.entries(want).map(([k, v]) => `${k}=${v}`).join(';')
    );
  }

  // Ask the other side to send us 60 ms frames (each side's encoder follows the remote ptime)
  sdp = sdp.replace(/\r\na=(?:max)?ptime:\d+/g, '');
  sdp = sdp.replace(opusMatch[0], `${opusMatch[0]}\r\na=ptime:${AUDIO_PTIME_MS}\r\na=maxptime:${AUDIO_PTIME_MS}`);
  return sdp;
}

// 1. Initialize Local Media (Mic only — camera is opened on demand)
async function initLocalMedia() {
  if (window.SkySupabase && !window.SkySupabase.checkCoupleCallAllowed()) {
    console.log('[Media] Unlinked / Guest flyer: media initialization deferred to Couple Sanctuary.');
    updateBadge('Lounge Ready', true);
    return;
  }
  try {
    const constraints = {
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      },
      // Camera starts OFF and is not opened at all until the user turns it on.
      // A disabled-but-open camera still burns CPU/battery and sends black frames.
      video: false
    };

    localStream = await navigator.mediaDevices.getUserMedia(constraints);
    localVideo.srcObject = localStream;
    if (localPip) {
      localPip.classList.add('hidden');
    }
    monitorLocalAudio(localStream);
    if (window.NookTelemetry) window.NookTelemetry.watchLocalStream(localStream);
    updateBadge('Mic Ready (Camera Off)', false);
  } catch (err) {
    console.error('Failed to access media devices:', err);
    tlog('media_error', { name: err.name, message: err.message });
    updateBadge('Media Permission Denied', false);
    updateCapsule('⚠️ Camera / Mic Permission Required', false);
  }
}

// --- Camera lifecycle (only open while actually on) ---
const CAMERA_CONSTRAINTS = () => ({
  facingMode: currentFacingMode,
  width: { ideal: 1280 },
  height: { ideal: 720 },
  frameRate: { ideal: 30, max: 30 }
});

function getVideoTransceiver() {
  if (!peerConnection || !peerConnection.getTransceivers) return null;
  return peerConnection.getTransceivers().find((t) =>
    t.receiver && t.receiver.track && t.receiver.track.kind === 'video' && t.direction !== 'stopped'
  ) || null;
}

// Point the video sender at the current camera track, or at nothing (no packets) when off
async function syncVideoSender() {
  const transceiver = getVideoTransceiver();
  if (!transceiver) return;
  try {
    if (transceiver.direction !== 'sendrecv') transceiver.direction = 'sendrecv';
  } catch (_) {}
  const track = localStream ? localStream.getVideoTracks()[0] || null : null;
  if (transceiver.sender.track !== track) {
    try {
      await transceiver.sender.replaceTrack(track);
    } catch (err) {
      tlog('video_sender_error', { name: err.name, message: err.message });
    }
  }
}

async function openCamera() {
  const camStream = await navigator.mediaDevices.getUserMedia({ video: CAMERA_CONSTRAINTS() });
  const track = camStream.getVideoTracks()[0];
  localStream.getVideoTracks().forEach((t) => {
    t.stop();
    localStream.removeTrack(t);
  });
  localStream.addTrack(track);
  localVideo.srcObject = localStream;
  localVideo.style.transform = currentFacingMode === 'user' ? 'scaleX(-1)' : 'scaleX(1)';
  await syncVideoSender();
  tlog('camera_on', { facingMode: currentFacingMode, label: track.label });
}

async function closeCamera() {
  if (!localStream) return;
  localStream.getVideoTracks().forEach((t) => {
    t.stop(); // releases the hardware (green dot goes away)
    localStream.removeTrack(t);
  });
  await syncVideoSender();
  tlog('camera_off', {});
}

function applyCameraUI() {
  cameraBtn.classList.toggle('active-off', isCameraOff);
  cameraBtn.querySelector('.icon-on').classList.toggle('hidden', isCameraOff);
  cameraBtn.querySelector('.icon-off').classList.toggle('hidden', !isCameraOff);
  cameraOffOverlay.classList.toggle('hidden', !isCameraOff);
  cameraLabel.textContent = isCameraOff ? 'Camera Off' : 'Camera On';
  if (localPip) {
    localPip.classList.toggle('hidden', isCameraOff);
  }
}

function getTerminal() {
  if (window.SkySupabase && typeof window.SkySupabase.getCharacterBase === 'function') {
    const base = window.SkySupabase.getCharacterBase();
    if (base === 'bkk' || base === 'dxb') return base;
  }
  const localBase = typeof localStorage !== 'undefined' ? localStorage.getItem('sky_active_persona') : null;
  if (localBase === 'bkk' || localBase === 'dxb') return localBase;
  const path = window.location.pathname.toLowerCase();
  const params = new URLSearchParams(window.location.search);
  if (path.includes('/bkk') || params.get('terminal') === 'bkk' || params.get('role') === 'bkk') return 'bkk';
  if (path.includes('/dxb') || params.get('terminal') === 'dxb' || params.get('role') === 'dxb') return 'dxb';
  return 'bkk';
}

let myTerminal = getTerminal();
window.myTerminal = myTerminal;

// 2. Initialize WebSocket Signaling with Dedicated Terminal Support
function initSignaling() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const terminal = getTerminal();
  const wsUrl = `${protocol}//${window.location.host}/ws?terminal=${terminal}`;

  console.log(`[Signaling] Connecting to ${wsUrl}`);
  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('[Signaling] Connected to flight dispatch.');
    tlog('ws_open', { callActive: isCallActive });
    updateBadge('Connected to Flight Network', false);
    if (typeof window.onWebSocketReconnect === 'function') {
      window.onWebSocketReconnect();
    }
  };

  ws.onmessage = async (event) => {
    try {
      const data = JSON.parse(event.data);
      handleSignalingMessage(data);
    } catch (err) {
      console.error('[Signaling] Error parsing message:', err);
    }
  };

  ws.onclose = (event) => {
    tlog('ws_close', { code: event.code, reason: event.reason, wasClean: event.wasClean, callActive: isCallActive });
    // 4001 = this seat was opened on another device. Auto-reconnecting here makes both devices
    // kick each other every 3s (and game moves sent in between are lost), so wait for a tap.
    if (event.code === 4001) {
      console.log('[Signaling] Seat taken over by another device. Not reconnecting.');
      updateBadge('Open on another device', false);
      showSeatTakenOverlay();
      return;
    }
    console.log('[Signaling] Disconnected. Reconnecting in 3s...');
    updateBadge('Reconnecting to Network...', false);
    setTimeout(initSignaling, 3000);
  };

  ws.onerror = (err) => {
    console.error('[Signaling] Error:', err);
    tlog('ws_error');
  };
}

// Shown on the device that lost its seat to another device (same /bkk or /dxb link).
function showSeatTakenOverlay() {
  let el = document.getElementById('seatTakenOverlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'seatTakenOverlay';
    el.className = 'seat-taken';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.innerHTML = `
      <div class="seat-taken-card">
        <div class="seat-taken-icon">📱✈️</div>
        <h2 class="seat-taken-title">Seat ${(myTerminal || '').toUpperCase()} is open on another device</h2>
        <p class="seat-taken-text">Only one device can sit in a seat at a time, so game moves don\u2019t get lost. Keep playing there, or move the seat here.</p>
        <button class="seat-taken-btn" id="seatTakeBackBtn">Use here</button>
      </div>`;
    document.body.appendChild(el);
    el.querySelector('#seatTakeBackBtn').addEventListener('click', () => {
      el.classList.remove('open');
      updateBadge('Reconnecting to Network...', false);
      initSignaling();
    });
  }
  requestAnimationFrame(() => el.classList.add('open'));
}

// 3. Handle Signaling Messages
async function handleSignalingMessage(message) {
  if (!TELEMETRY_QUIET_TYPES.has(message.type)) {
    tlog('sig_in', { type: message.type, online: message.online, role: message.role, callActive: isCallActive });
  }
  switch (message.type) {
    case 'assigned':
      myTerminal = message.terminal;
      window.myTerminal = myTerminal;
      window.nookPartnerOnline = !!message.partnerOnline;
      const isCouple = window.SkySupabase && window.SkySupabase.coupleStatus && window.SkySupabase.coupleStatus.isCouple;
      if (typeof window.updatePartnerPresence === 'function') {
        window.updatePartnerPresence(isCouple ? !!message.partnerOnline : false);
      }
      if (typeof updateMonopolyHUD === 'function') updateMonopolyHUD();
      if (window.NookTelemetry) window.NookTelemetry.setTerminal(myTerminal);
      console.log(`[Terminal] Assigned seat: ${myTerminal.toUpperCase()}`);
      const seatTag = document.getElementById('seatTag');
      if (seatTag) seatTag.textContent = `SEAT ${myTerminal.toUpperCase()}`;
      if (partnerName) {
        partnerName.textContent = isCouple ? (window.SkySupabase.coupleStatus.partner?.username || 'Partner') : 'Co-Pilot Lounge';
      }
      if (message.partnerOnline && isCouple) {
        const partnerUname = window.SkySupabase.coupleStatus.partner?.username || 'Partner';
        updateCapsule(`💞 ${partnerUname} Boarded • Ready to Fly ✈️`, true);
        updateBadge(`${partnerUname} Boarded • Ready`, true);
      } else if (isCouple) {
        const partnerUname = window.SkySupabase.coupleStatus.partner?.username || 'Partner';
        updateCapsule(`Awaiting ${partnerUname}... ⏳`, false);
        updateBadge(`Waiting for ${partnerUname}...`, false);
      } else {
        updateCapsule('Solo Flight • Couple Sanctuary 💫', false);
        updateBadge('Solo Flight • Couple Sanctuary', false);
      }
      break;

    case 'partner_status':
      window.nookPartnerOnline = !!message.online;
      const isCoupleActive = window.SkySupabase && window.SkySupabase.coupleStatus && window.SkySupabase.coupleStatus.isCouple;
      if (typeof window.updatePartnerPresence === 'function') {
        window.updatePartnerPresence(isCoupleActive ? !!message.online : false);
      }
      if (message.online && isCoupleActive) {
        if (partnerOfflineGraceTimer) {
          clearTimeout(partnerOfflineGraceTimer);
          partnerOfflineGraceTimer = null;
          console.log('[Signaling] Partner back online, cleared offline grace timer.');
        }
        const partnerUname = window.SkySupabase.coupleStatus.partner?.username || 'Partner';
        updateCapsule(`💞 ${partnerUname} Boarded • Ready to Fly ✈️`, true);
        updateBadge(`${partnerUname} Boarded • Connected`, true);
        playCabinChime('board');
        if (typeof broadcastMyAvatar === 'function') {
          broadcastMyAvatar();
        }
        if (message.role === 'caller' && !isCallActive && window.SkySupabase?.checkCoupleCallAllowed?.()) {
          startCall();
        } else if (message.role === 'caller' && isCallActive) {
          // Partner may have reloaded mid-call: if our line doesn't recover, rebuild it fresh
          setTimeout(() => {
            const st = peerConnection ? peerConnection.iceConnectionState : 'none';
            if (isCallActive && ['disconnected', 'failed', 'closed', 'none'].includes(st)) {
              rebuildPeerConnection('partner_rejoined');
            }
          }, 6000);
        }
      } else if (!isCoupleActive) {
        updateCapsule('Solo Flight • Couple Sanctuary 💫', false);
        updateBadge('Solo Flight • Couple Sanctuary', false);
      } else {
        updateCapsule('Partner Signal Fluctuation • Reconnecting...', false);
        updateBadge('Reconnecting Line...', false);
        // Do not immediately terminate active call! Mobile phones frequently reconnect within 1-5s.
        if (isCallActive) {
          if (!partnerOfflineGraceTimer) {
            console.log('[Signaling] Partner offline received during active call. Starting 20s grace period...');
            partnerOfflineGraceTimer = setTimeout(() => {
              if (isCallActive) {
                console.log('[Signaling] Grace period expired without reconnect. Ending call.');
                playCabinChime('hangup');
                endCall(false);
              }
              partnerOfflineGraceTimer = null;
            }, 20000);
          }
        } else {
          playCabinChime('hangup');
          endCall(false);
        }
      }
      break;

    case 'media_state':
      partnerCameraOff = !!message.isCameraOff;
      partnerMicMuted = !!message.isMicMuted;
      if (partnerMuteBadge) {
        partnerMuteBadge.classList.toggle('hidden', !partnerMicMuted);
      }
      if (isCallActive) {
        const skyLounge = document.getElementById('skyLounge');
        if (skyLounge) {
          skyLounge.classList.toggle('hidden', !partnerCameraOff);
        }
      }
      break;

    case 'avatar_move':
    case 'avatar_outfit':
    case 'avatar_emote':
    case 'avatar_hug':
    case 'avatar_scenery':
    case 'scene_change':
      if (typeof handleAvatarMessage === 'function') {
        handleAvatarMessage(message);
      }
      break;

    case 'monopoly_open':
    case 'monopoly_close':
    case 'monopoly_action':
    case 'monopoly_sync':
    case 'monopoly_lobby_update':
    case 'monopoly_start_party':
    case 'room_list_update':
    case 'room_created':
    case 'room_joined':
    case 'room_update':
    case 'room_chat':
    case 'room_start':
    case 'room_error':
    case 'room_left':
      if (typeof handleMonopolyMessage === 'function') {
        handleMonopolyMessage(message);
      }
      break;

    case 'vault_profiles':
    case 'vault_pull_result':
    case 'vault_event':
    case 'vault_error':
    case 'vault_envelope_sent':
    case 'vault_envelope_received':
    case 'vault_daily':
    case 'vault_reward':
      if (window.NookVault) window.NookVault.handleMessage(message);
      break;

    case 'vault_cat_event':
    case 'vault_cat_pull_result':
    case 'vault_cat_gift_result':
    case 'vault_cat_converted':
      if (window.NookCats) window.NookCats.handleMessage(message);
      break;

    case 'offer':
      await handleOffer(message.offer, !!message.fresh);
      break;

    case 'answer':
      await handleAnswer(message.answer);
      break;

    case 'candidate':
      await handleCandidate(message.candidate);
      break;

    case 'heal_request':
      // Partner's audio went bad: the caller rebuilds the connection for both sides
      if (isCallActive && isCaller && Date.now() - lastHealAt > 20000) {
        rebuildPeerConnection('partner:' + (message.reason || 'unknown'));
      }
      break;

    case 'hangup':
      endCall(false);
      break;
  }
}

// Synchronize couple status transitions with the top capsule and cabin presence
if (typeof window !== 'undefined') {
  window.addEventListener('sky:couple_status_changed', (e) => {
    const couple = e.detail || window.SkySupabase?.coupleStatus;
    const isCouple = !!(couple && couple.isCouple);
    const partnerUname = couple?.partner?.username || 'Partner';
    const partnerNameEl = document.getElementById('partnerName');
    if (partnerNameEl) {
      partnerNameEl.textContent = isCouple ? partnerUname : 'Co-Pilot Lounge';
    }
    if (typeof window.updatePartnerPresence === 'function') {
      window.updatePartnerPresence(isCouple ? !!window.nookPartnerOnline : false);
    }
    if (isCouple && window.nookPartnerOnline) {
      updateCapsule(`💞 ${partnerUname} Boarded • Ready to Fly ✈️`, true);
      updateBadge(`${partnerUname} Boarded • Ready`, true);
    } else if (isCouple) {
      updateCapsule(`Awaiting ${partnerUname}... ⏳`, false);
      updateBadge(`Waiting for ${partnerUname}...`, false);
    } else {
      updateCapsule('Solo Flight • Couple Sanctuary 💫', false);
      updateBadge('Solo Flight • Couple Sanctuary', false);
    }
  });

  window.addEventListener('sky:character_base_changed', (e) => {
    if (e.detail && e.detail.base) {
      myTerminal = e.detail.base;
      window.myTerminal = myTerminal;
      const seatTag = document.getElementById('seatTag');
      if (seatTag) seatTag.textContent = `SEAT ${myTerminal.toUpperCase()}`;
    }
  });
}

// 4. Start WebRTC Call
async function startCall() {
  if (window.SkySupabase && !window.SkySupabase.checkCoupleCallAllowed()) {
    if (window.SkySocialUI) window.SkySocialUI.showCoupleGatingModal();
    else showToast('💞 1:1 Voice & Video calls are exclusive to linked Couple Partners in the Couple Sanctuary.');
    return;
  }
  if (!localStream) {
    await initLocalMedia();
  }
  if (isCallActive) return;
  isCallActive = true;
  isCaller = true;
  if (window.NookTelemetry) window.NookTelemetry.callStarted('caller');
  updateCallActionBtn(true);
  updateBadge('Securing Couple Line (TURNS 443)...', false);

  createPeerConnection();
  addLocalMediaToPeer();

  try {
    const rawOffer = await peerConnection.createOffer({
      offerToReceiveAudio: true
    });
    const offer = {
      type: rawOffer.type,
      sdp: optimizeAudioSDP(rawOffer.sdp)
    };
    await peerConnection.setLocalDescription(offer);

    sendSignaling({
      type: 'offer',
      offer: offer,
      fresh: true // brand-new connection: partner should drop any old one
    });

    sendSignaling({
      type: 'media_state',
      isCameraOff,
      isMicMuted
    });

    if (typeof broadcastMyAvatar === 'function') {
      broadcastMyAvatar();
    }
  } catch (err) {
    console.error('Failed to create offer:', err);
    tlog('offer_create_error', { name: err.name, message: err.message });
  }
}

// 5. Handle Incoming Call Offer (supports seamless renegotiation)
async function handleOffer(offer, fresh = false) {
  if (!isCallActive) {
    isCallActive = true;
    if (window.NookTelemetry) window.NookTelemetry.callStarted('receiver');
    updateCallActionBtn(true);
  }
  tlog('offer_received', {
    renegotiation: !!peerConnection && !fresh,
    fresh,
    signalingState: peerConnection ? peerConnection.signalingState : null
  });

  // A "fresh" offer comes from a brand-new connection on the other side (page reload or
  // auto-heal). It can't be applied to our old connection, so replace ours too.
  if (fresh) {
    isCaller = false;
    stopIceRefreshTimer();
    if (healRequestTimer) {
      clearTimeout(healRequestTimer);
      healRequestTimer = null;
    }
    if (peerConnection) {
      stopRemoteAudioVisualizer();
      remoteStream = null;
      peerConnection.close();
      peerConnection = null;
    }
  }

  // Only create a new connection if one doesn't exist yet
  if (!peerConnection) {
    createPeerConnection();
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream);
      });
    }
  }

  try {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    await flushPendingCandidates();
    // Answer with our video slot as sendrecv; it carries nothing until the camera is on
    await syncVideoSender();
    const rawAnswer = await peerConnection.createAnswer();
    const answer = {
      type: rawAnswer.type,
      sdp: optimizeAudioSDP(rawAnswer.sdp)
    };
    await peerConnection.setLocalDescription(answer);

    sendSignaling({
      type: 'answer',
      answer: answer
    });

    sendSignaling({
      type: 'media_state',
      isCameraOff,
      isMicMuted
    });

    if (typeof broadcastMyAvatar === 'function') {
      broadcastMyAvatar();
    }
  } catch (err) {
    console.error('Failed to handle offer:', err);
    tlog('offer_handle_error', { name: err.name, message: err.message });
  }
}

// 6. Handle Answer
async function handleAnswer(answer) {
  try {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    await flushPendingCandidates();
  } catch (err) {
    console.error('Failed to set remote description from answer:', err);
    tlog('answer_handle_error', { name: err.name, message: err.message });
  }
}

// 7. Handle ICE Candidate (queued until the remote description is in place)
async function handleCandidate(candidate) {
  if (!peerConnection) return;
  if (!peerConnection.remoteDescription) {
    pendingCandidates.push(candidate);
    return;
  }
  try {
    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  } catch (err) {
    console.error('Failed to add ICE candidate:', err);
  }
}

async function flushPendingCandidates() {
  const queued = pendingCandidates;
  pendingCandidates = [];
  for (const c of queued) {
    try {
      await peerConnection.addIceCandidate(new RTCIceCandidate(c));
    } catch (_) {
      // stale candidate from a previous connection — safe to ignore
    }
  }
}

// 8. Create & Configure RTCPeerConnection
function createPeerConnection() {
  if (peerConnection) {
    peerConnection.close();
  }
  pendingCandidates = [];

  peerConnection = new RTCPeerConnection(RTC_CONFIG);
  if (window.NookTelemetry) window.NookTelemetry.attachPeerConnection(peerConnection);

  // Send ICE candidates to remote peer via signaling
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      sendSignaling({
        type: 'candidate',
        candidate: event.candidate
      });
    }
  };

  // Receive remote audio/video tracks
  peerConnection.ontrack = (event) => {
    console.log('[Track Received]', event.track.kind);
    
    if (!remoteStream) {
      remoteStream = new MediaStream();
    }
    
    // Add track if not already in remote stream
    if (!remoteStream.getTracks().find(t => t.id === event.track.id)) {
      remoteStream.addTrack(event.track);
    }
    
    if (remoteVideo.srcObject !== remoteStream) {
      remoteVideo.srcObject = remoteStream;
    }
    if (remoteAudio && remoteAudio.srcObject !== remoteStream) {
      remoteAudio.srcObject = remoteStream;
      remoteAudio.volume = 1.0;
    }

    // Explicitly play on user's device (bypasses iOS autoplay policies)
    remoteVideo.play().catch(e => console.log('[Video Play Error]', e));
    if (remoteAudio) {
      remoteAudio.play().catch(e => {
        console.log('[Audio Play Error - Autoplay blocked]', e);
        if (audioPermissionBanner) audioPermissionBanner.classList.remove('hidden');
      });
    }

    if (event.track.kind === 'audio') {
      event.track.onunmute = () => {
        console.log('[Audio Live] Remote audio packet flow confirmed!');
        if (remoteAudio) remoteAudio.play().catch(() => {});
      };
      monitorRemoteAudio(remoteStream);
      startLevelPoller();
    }

    if (flightStatusCapsule) {
      flightStatusCapsule.classList.add('in-call');
    }
    if (callActionBtn) {
      callActionBtn.classList.remove('ready-to-connect');
    }
    const skyLounge = document.getElementById('skyLounge');
    const emotionDeck = document.getElementById('emotionDeck');
    if (skyLounge) {
      skyLounge.classList.toggle('hidden', !partnerCameraOff);
    }
    if (emotionDeck) {
      emotionDeck.classList.remove('hidden');
    }
    if (audioLounge) {
      audioLounge.classList.add('hidden');
    }
    startCallTimer();
    requestWakeLock();
    startStatsMonitor();
    if (!callConnectedOnce) {
      callConnectedOnce = true;
      playCabinChime('connect');
    }
    if (typeof broadcastMyAvatar === 'function') {
      broadcastMyAvatar();
    }
    updateBadge('Secure Flight Line Active', true);
  };

  // Monitor ICE Connection State
  peerConnection.oniceconnectionstatechange = () => {
    console.log(`[ICE State] ${peerConnection.iceConnectionState}`);
    if (peerConnection.iceConnectionState === 'connected' || peerConnection.iceConnectionState === 'completed') {
      updateBadge('Encrypted • Singapore Relay', true);
      startStatsMonitor();
      requestWakeLock();
      healConnectedAt = Date.now();
      startHealMonitor();
      // Start the silent 24-minute anti-throttling refresh scheduler
      if (!iceRefreshInterval && isCaller) {
        startIceRefreshTimer();
      }
    } else if (peerConnection.iceConnectionState === 'disconnected') {
      updateBadge('Reconnecting Line...', false);
    } else if (peerConnection.iceConnectionState === 'failed') {
      updateBadge('Line Interrupted • Retrying...', false);
      restartIce();
    }
  };
}

// 24-Minute Silent Socket Refresh Scheduler
function startIceRefreshTimer() {
  stopIceRefreshTimer();
  // Runs every 24 minutes (1,440,000 ms) safely ahead of du's 28-30 min daytime DPI inspection
  const TWENTY_FOUR_MINUTES = 24 * 60 * 1000;
  iceRefreshInterval = setInterval(() => {
    if (isCallActive && peerConnection) {
      triggerSilentIceRestart();
    }
  }, TWENTY_FOUR_MINUTES);
  console.log('[Socket Manager] Silent 24-minute anti-throttling scheduler active.');
}

function stopIceRefreshTimer() {
  if (iceRefreshInterval) {
    clearInterval(iceRefreshInterval);
    iceRefreshInterval = null;
  }
}

async function triggerSilentIceRestart() {
  if (!peerConnection || !isCallActive || !isCaller) return;
  console.log('🔄 [Socket Refresh] Performing seamless background socket renewal to reset du DPI timer...');
  tlog('ice_restart', { reason: 'scheduled_24min' });
  try {
    const rawOffer = await peerConnection.createOffer({ iceRestart: true });
    const offer = {
      type: rawOffer.type,
      sdp: optimizeAudioSDP(rawOffer.sdp)
    };
    await peerConnection.setLocalDescription(offer);
    sendSignaling({ type: 'offer', offer: offer });
  } catch (err) {
    console.warn('[Socket Refresh Warning]', err);
    tlog('ice_restart_error', { message: err.message });
  }
}

function restartIce() {
  if (peerConnection) {
    tlog('ice_restart', { reason: 'ice_failed' });
    peerConnection.restartIce();
  }
}

// Local audio + an always-present video slot (empty while the camera is off)
function addLocalMediaToPeer() {
  if (localStream) {
    localStream.getAudioTracks().forEach((track) => {
      peerConnection.addTrack(track, localStream);
    });
  }
  const camTrack = localStream ? localStream.getVideoTracks()[0] : null;
  peerConnection.addTransceiver(camTrack || 'video', {
    direction: 'sendrecv',
    streams: localStream ? [localStream] : []
  });
}

// --- Auto-heal ---------------------------------------------------------------
// A page refresh fixed the robot voice for a while, so do the same thing automatically:
// when the incoming audio degrades (concealment / time-stretch) or the line bloats
// (RTT far above this connection's best), build a brand-new connection. ~1-2 s blip.
const HEAL_COOLDOWN_MS = 60000;
const HEAL_SETTLE_MS = 15000;

function startHealMonitor() {
  stopHealMonitor();
  healBadStreak = 0;
  healMinRtt = null;
  healLastSample = null;
  healMonitorInterval = setInterval(checkCallHealth, 5000);
}

function stopHealMonitor() {
  if (healMonitorInterval) {
    clearInterval(healMonitorInterval);
    healMonitorInterval = null;
  }
}

function checkCallHealth() {
  if (!isCallActive || !peerConnection || isRebuilding || !window.NookTelemetry) return;
  const ice = peerConnection.iceConnectionState;
  if (ice !== 'connected' && ice !== 'completed') return;
  const s = window.NookTelemetry.getLastSample();
  if (!s || s === healLastSample || !s.verdict) return;
  healLastSample = s;
  if (Date.now() - healConnectedAt < HEAL_SETTLE_MS) return;

  const rx = s.rx || {};
  const rtt = typeof s.rttMs === 'number' && s.rttMs > 0 ? s.rttMs : null;
  if (rtt !== null) healMinRtt = healMinRtt === null ? rtt : Math.min(healMinRtt, rtt);

  // Only judge concealment while the partner is actually sending (DTX silence is ~2-3 pkt/s)
  const receiving = (Number(rx.packetsPerSec) || 0) >= 8;
  const reasons = [];
  if (receiving && (Number(rx.concealPct) || 0) >= 4) reasons.push('conceal');
  if (receiving && (Number(rx.stretchPct) || 0) >= 3) reasons.push('stretch');
  if (rtt !== null && healMinRtt !== null && rtt >= healMinRtt + 120) reasons.push('rtt_bloat');

  healBadStreak = reasons.length ? healBadStreak + 1 : 0;
  if (healBadStreak >= 2) {
    healBadStreak = 0;
    requestHeal(reasons.join('+'), s);
  }
}

function requestHeal(reason, s) {
  if (Date.now() - lastHealAt < HEAL_COOLDOWN_MS) return;
  lastHealAt = Date.now();
  const rx = s.rx || {};
  tlog('auto_heal', {
    reason,
    role: isCaller ? 'caller' : 'receiver',
    rttMs: s.rttMs,
    minRttMs: healMinRtt,
    concealPct: rx.concealPct,
    stretchPct: rx.stretchPct,
    jitterBufferMs: rx.jitterBufferMs
  });

  if (isCaller) {
    rebuildPeerConnection(reason);
    return;
  }
  // Receiver: ask the caller to rebuild; if nothing arrives (older client), do it ourselves
  sendSignaling({ type: 'heal_request', reason });
  const pcAtRequest = peerConnection;
  if (healRequestTimer) clearTimeout(healRequestTimer);
  healRequestTimer = setTimeout(() => {
    healRequestTimer = null;
    if (isCallActive && peerConnection === pcAtRequest) {
      rebuildPeerConnection(reason + ':fallback');
    }
  }, 8000);
}

// Replace the connection with a brand-new one (what a page refresh did, minus the reload)
async function rebuildPeerConnection(reason) {
  if (!isCallActive || isRebuilding) return;
  isRebuilding = true;
  isCaller = true;
  lastHealAt = Date.now();
  tlog('pc_rebuild', { reason });
  updateBadge('Refreshing Line...', false);
  try {
    stopRemoteAudioVisualizer();
    remoteStream = null;
    createPeerConnection(); // closes the old one
    addLocalMediaToPeer();
    const rawOffer = await peerConnection.createOffer({ offerToReceiveAudio: true });
    const offer = { type: rawOffer.type, sdp: optimizeAudioSDP(rawOffer.sdp) };
    await peerConnection.setLocalDescription(offer);
    sendSignaling({ type: 'offer', offer, fresh: true });
    sendSignaling({ type: 'media_state', isCameraOff, isMicMuted });
  } catch (err) {
    console.error('Connection rebuild failed:', err);
    tlog('pc_rebuild_error', { name: err.name, message: err.message });
  } finally {
    isRebuilding = false;
  }
}

function sendSignaling(data) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}
window.sendSignaling = sendSignaling;

// 9. End / Hangup Call
function endCall(sendNotification = true) {
  if (window.NookTelemetry) {
    window.NookTelemetry.callEnded(sendNotification ? 'local_hangup' : 'remote_or_timeout');
  }
  if (partnerOfflineGraceTimer) {
    clearTimeout(partnerOfflineGraceTimer);
    partnerOfflineGraceTimer = null;
  }
  if (sendNotification) {
    sendSignaling({ type: 'hangup' });
  }

  stopIceRefreshTimer();
  stopStatsMonitor();
  stopHealMonitor();
  stopLevelPoller();
  if (healRequestTimer) {
    clearTimeout(healRequestTimer);
    healRequestTimer = null;
  }
  releaseWakeLock();
  stopRemoteAudioVisualizer();
  stopLocalAudioMonitor();
  isCaller = false;
  callConnectedOnce = false;
  pendingCandidates = [];

  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }

  remoteStream = null;
  remoteVideo.srcObject = null;
  if (remoteAudio) {
    remoteAudio.srcObject = null;
  }
  if (flightStatusCapsule) {
    flightStatusCapsule.classList.remove('in-call');
    updateCapsule('Flight Ended • Tap Connect to Rejoin', true);
  }
  if (audioLounge) {
    audioLounge.classList.add('hidden');
  }
  const skyLounge = document.getElementById('skyLounge');
  if (skyLounge) {
    skyLounge.classList.remove('hidden');
  }
  const emotionDeck = document.getElementById('emotionDeck');
  if (emotionDeck) {
    emotionDeck.classList.remove('hidden');
  }
  if (appContainer) {
    appContainer.classList.remove('controls-hidden');
  }
  isCallActive = false;
  stopCallTimer();
  updateCallActionBtn(false);
  updateBadge('Call Ended', false);
  playCabinChime('hangup');
}

// --- UI Controls & Event Listeners ---
function setupEventListeners() {
  // Mic Toggle
  micBtn.addEventListener('click', () => {
    triggerHaptic(12);
    if (window.SkySupabase && !window.SkySupabase.checkCoupleCallAllowed()) {
      if (window.SkySocialUI) window.SkySocialUI.showCoupleGatingModal();
      else showToast('💞 1:1 Voice & Video calls are exclusive to linked Couple Partners in the Couple Sanctuary.');
      return;
    }
    if (!localStream) return;
    isMicMuted = !isMicMuted;
    localStream.getAudioTracks().forEach((track) => {
      track.enabled = !isMicMuted;
    });

    micBtn.classList.toggle('active-off', isMicMuted);
    micBtn.querySelector('.icon-on').classList.toggle('hidden', isMicMuted);
    micBtn.querySelector('.icon-off').classList.toggle('hidden', !isMicMuted);
    micLabel.textContent = isMicMuted ? 'Muted' : 'Mute';

    sendSignaling({
      type: 'media_state',
      isCameraOff,
      isMicMuted
    });
  });

  // Camera Toggle — actually opens/releases the camera hardware
  let cameraBusy = false;
  cameraBtn.addEventListener('click', async () => {
    triggerHaptic(12);
    if (window.SkySupabase && !window.SkySupabase.checkCoupleCallAllowed()) {
      if (window.SkySocialUI) window.SkySocialUI.showCoupleGatingModal();
      else showToast('💞 1:1 Voice & Video calls are exclusive to linked Couple Partners in the Couple Sanctuary.');
      return;
    }
    if (!localStream) {
      await initLocalMedia();
    }
    if (!localStream || cameraBusy) return;
    cameraBusy = true;
    const wantOn = isCameraOff;
    try {
      if (wantOn) {
        await openCamera();
      } else {
        await closeCamera();
      }
      isCameraOff = !wantOn;
    } catch (err) {
      console.error('Camera toggle failed:', err);
      tlog('camera_error', { name: err.name, message: err.message });
      await closeCamera().catch(() => {});
      isCameraOff = true;
    } finally {
      cameraBusy = false;
    }

    applyCameraUI();
    sendSignaling({
      type: 'media_state',
      isCameraOff,
      isMicMuted
    });
  });

  // Camera Flip (Front / Back for mobile devices)
  flipCameraBtn.addEventListener('click', async () => {
    triggerHaptic(15);
    currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
    localVideo.style.transform = currentFacingMode === 'user' ? 'scaleX(-1)' : 'scaleX(1)';

    // Camera off: just remember the choice, don't wake the camera
    if (isCameraOff || !localStream || cameraBusy) return;

    cameraBusy = true;
    try {
      // Release the current camera first (iOS can't open both at once)
      localStream.getVideoTracks().forEach((t) => t.stop());
      await openCamera();
    } catch (err) {
      console.error('Failed to flip camera:', err);
      tlog('camera_error', { name: err.name, message: err.message, during: 'flip' });
      await closeCamera().catch(() => {});
      isCameraOff = true;
      applyCameraUI();
      sendSignaling({ type: 'media_state', isCameraOff, isMicMuted });
    } finally {
      cameraBusy = false;
    }
  });

  // Primary Call Action Button (Connect / End Flight)
  callActionBtn.addEventListener('click', () => {
    triggerHaptic(20);
    if (!isCallActive && window.SkySupabase && !window.SkySupabase.checkCoupleCallAllowed()) {
      if (window.SkySocialUI) window.SkySocialUI.showCoupleGatingModal();
      else showToast('💞 1:1 Voice & Video calls are exclusive to linked Couple Partners in the Couple Sanctuary.');
      return;
    }
    // Unconditional iOS audio unlock on user gesture
    if (remoteAudio && remoteAudio.srcObject) {
      remoteAudio.play().catch(() => {});
    }
    if (webAudioCtx && webAudioCtx.state === 'suspended') {
      webAudioCtx.resume();
    }
    if (audioPermissionBanner) audioPermissionBanner.classList.add('hidden');

    if (isCallActive) {
      endCall(true);
    } else {
      startCall();
    }
  });

  // Tapping the status capsule when ready starts flight, or opens Couple Sanctuary when solo
  if (flightStatusCapsule) {
    flightStatusCapsule.addEventListener('click', (e) => {
      if (e.target.closest('#capsuleCopyBtn')) return;
      if (!isCallActive && flightStatusCapsule.classList.contains('ready')) {
        if (callActionBtn) callActionBtn.click();
      } else if (!window.SkySupabase?.coupleStatus?.isCouple) {
        if (window.SkySocialUI && typeof window.SkySocialUI.openDrawer === 'function') {
          window.SkySocialUI.openDrawer('couple');
        }
      }
    });
  }

  // Quick Action Button in Capsule (Couple Sanctuary / Flight Invite)
  if (capsuleCopyBtn) {
    capsuleCopyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      triggerHaptic(12);
      const isCouple = !!(window.SkySupabase?.coupleStatus?.isCouple);
      if (!isCouple) {
        if (window.SkySocialUI && typeof window.SkySocialUI.openDrawer === 'function') {
          window.SkySocialUI.openDrawer('couple');
        } else if (window.SkySocialUI && typeof window.SkySocialUI.showCoupleGatingModal === 'function') {
          window.SkySocialUI.showCoupleGatingModal();
        } else {
          showToast('💞 Open Social Drawer to pair your Couple Partner.');
        }
        return;
      }

      const partnerUname = window.SkySupabase?.coupleStatus?.partner?.username || 'Partner';
      if (flightStatusCapsule && flightStatusCapsule.classList.contains('ready')) {
        // Partner is connected & ready - open Couple Sanctuary
        if (window.SkySocialUI && typeof window.SkySocialUI.openDrawer === 'function') {
          window.SkySocialUI.openDrawer('couple');
        }
      } else {
        // Partner is offline - copy clean flight invite link without /dxb or /bkk
        const flightUrl = `${window.location.origin}`;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(flightUrl).then(() => {
            showToast(`💌 Flight invite link copied to share with ${partnerUname}!`);
          }).catch(() => {
            prompt('Copy flight invite link:', flightUrl);
          });
        } else {
          prompt('Copy flight invite link:', flightUrl);
        }
      }
    });
  }

  // Audio permission banner tap
  if (audioPermissionBanner) {
    audioPermissionBanner.addEventListener('click', () => {
      triggerHaptic(10);
      if (remoteAudio && remoteAudio.srcObject) {
        remoteAudio.play().catch(() => {});
      }
      if (webAudioCtx && webAudioCtx.state === 'suspended') {
        webAudioCtx.resume();
      }
      audioPermissionBanner.classList.add('hidden');
    });
  }

  // Immersive Mode (Tap Stage to toggle Header & Deck)
  if (callStage && appContainer) {
    callStage.addEventListener('click', (e) => {
      if (e.target.closest('#flightControls') || e.target.closest('#localPip') || e.target.closest('button')) {
        return;
      }
      if (isCallActive) {
        triggerHaptic(8);
        appContainer.classList.toggle('controls-hidden');
      }
    });
  }
}

function updateCallActionBtn(inCall) {
  callActionBtn.classList.toggle('in-call', inCall);
  callActionLabel.textContent = inCall ? 'End' : 'Connect';
}

function updateBadge(text, isLive) {
  connectionBadgeText.textContent = text;
  const dot = securityBadge.querySelector('.live-dot');
  if (isLive) {
    securityBadge.classList.add('connected');
    dot.classList.add('active');
  } else {
    securityBadge.classList.remove('connected');
    dot.classList.remove('active');
  }
}

// Call Duration Counter (idempotent: ontrack fires per track and again after auto-heal)
function startCallTimer() {
  if (callTimerInterval) return;
  callStartTime = Date.now();
  callTimerChip.classList.remove('hidden');
  callTimerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - callStartTime) / 1000);
    const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const secs = String(elapsed % 60).padStart(2, '0');
    callDuration.textContent = `${mins}:${secs}`;
  }, 1000);
}

function stopCallTimer() {
  clearInterval(callTimerInterval);
  callTimerInterval = null;
  callTimerChip.classList.add('hidden');
  callDuration.textContent = '00:00';
}

// Draggable PiP for Touch & Mouse
function setupDraggablePip() {
  let isDragging = false;
  let startX, startY, initialLeft, initialTop;

  const onStart = (e) => {
    isDragging = true;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const rect = localPip.getBoundingClientRect();
    startX = clientX;
    startY = clientY;
    initialLeft = rect.left;
    initialTop = rect.top;
  };

  const onMove = (e) => {
    if (!isDragging) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const dx = clientX - startX;
    const dy = clientY - startY;

    localPip.style.left = `${initialLeft + dx}px`;
    localPip.style.top = `${initialTop + dy}px`;
    localPip.style.bottom = 'auto';
    localPip.style.right = 'auto';
  };

  const onEnd = () => {
    isDragging = false;
  };

  localPip.addEventListener('mousedown', onStart);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onEnd);

  localPip.addEventListener('touchstart', onStart, { passive: true });
  window.addEventListener('touchmove', onMove, { passive: true });
  window.addEventListener('touchend', onEnd);
}

// Web Audio API Loudspeaker Routing for Mobile
let webAudioCtx = null;
function routeToLoudspeaker(stream) {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    if (!webAudioCtx) {
      webAudioCtx = new AudioContextClass();
    }
    if (webAudioCtx.state === 'suspended') {
      webAudioCtx.resume();
    }
    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) return;
    
    const audioOnlyStream = new MediaStream([audioTrack]);
    const source = webAudioCtx.createMediaStreamSource(audioOnlyStream);
    source.connect(webAudioCtx.destination);
    console.log('[WebAudio] Successfully routed audio through Web Audio API to loudspeaker');
  } catch (err) {
    console.warn('[WebAudio] Loudspeaker route notice:', err);
  }
}

// Local Mic Activity Visualizer (VU meter)
let localAudioCtx = null;
let localAudioAnimId = null;

function stopLocalAudioMonitor() {
  if (localAudioAnimId) {
    cancelAnimationFrame(localAudioAnimId);
    localAudioAnimId = null;
  }
  if (localAudioCtx) {
    try {
      if (localAudioCtx.state !== 'closed') {
        localAudioCtx.close().catch(() => {});
      }
    } catch (_) {}
    localAudioCtx = null;
  }
  if (micBtn) micBtn.classList.remove('speaking');
  if (typeof setAvatarTalking === 'function') setAvatarTalking('me', false);
}

function monitorLocalAudio(stream) {
  stopLocalAudioMonitor();
  // ?novis=1 disables visualizer AudioContexts (A/B test for iOS audio interference)
  if (window.NookTelemetry && window.NookTelemetry.flags.novis) return;
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    localAudioCtx = new AudioContextClass();
    const source = localAudioCtx.createMediaStreamSource(stream);
    const analyser = localAudioCtx.createAnalyser();
    analyser.fftSize = 64;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);

    let lastCheck = 0;
    function checkLevel(now) {
      if (!stream || (stream.active === false)) {
        stopLocalAudioMonitor();
        return;
      }
      // Throttle VU calculation to ~15 FPS (every 65ms) instead of 120 FPS
      if (!now || now - lastCheck >= 65) {
        lastCheck = now || performance.now();
        if (isMicMuted) {
          micBtn.classList.remove('speaking');
          if (typeof setAvatarTalking === 'function') setAvatarTalking('me', false);
        } else {
          analyser.getByteFrequencyData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) sum += data[i];
          const avg = sum / data.length;
          if (avg > 15) {
            micBtn.classList.add('speaking');
            if (typeof setAvatarTalking === 'function') setAvatarTalking('me', true);
          } else {
            micBtn.classList.remove('speaking');
            if (typeof setAvatarTalking === 'function') setAvatarTalking('me', false);
          }
        }
      }
      localAudioAnimId = requestAnimationFrame(checkLevel);
    }
    localAudioAnimId = requestAnimationFrame(checkLevel);
  } catch (e) {
    console.warn('[Audio Monitor Notice]', e);
  }
}

// Subtle Mobile Haptic Feedback
function triggerHaptic(duration = 12) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try { navigator.vibrate(duration); } catch (e) {}
  }
}

// First-Class Cabin Chime Synthesizer (Zero asset download, pure WebAudio)
function playCabinChime(type = 'board') {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    if (!chimeCtx) {
      chimeCtx = new AudioCtx();
    }
    if (chimeCtx.state === 'suspended') {
      chimeCtx.resume();
    }
    const now = chimeCtx.currentTime;
    if (type === 'board') {
      // First-Class Cabin boarding chime: F5 (698 Hz) -> C6 (1046 Hz)
      const osc1 = chimeCtx.createOscillator();
      const gain1 = chimeCtx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(698.46, now);
      gain1.gain.setValueAtTime(0.18, now);
      gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
      osc1.connect(gain1);
      gain1.connect(chimeCtx.destination);
      osc1.start(now);
      osc1.stop(now + 0.55);

      const osc2 = chimeCtx.createOscillator();
      const gain2 = chimeCtx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1046.5, now + 0.22);
      gain2.gain.setValueAtTime(0.2, now + 0.22);
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.95);
      osc2.connect(gain2);
      gain2.connect(chimeCtx.destination);
      osc2.start(now + 0.22);
      osc2.stop(now + 0.95);
    } else if (type === 'connect') {
      // Subtle connection chime: G5 (784 Hz)
      const osc = chimeCtx.createOscillator();
      const gain = chimeCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(783.99, now);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
      osc.connect(gain);
      gain.connect(chimeCtx.destination);
      osc.start(now);
      osc.stop(now + 0.4);
    } else if (type === 'hangup') {
      // Soft descending chime: C6 -> F5
      const osc1 = chimeCtx.createOscillator();
      const gain1 = chimeCtx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(987.77, now);
      gain1.gain.setValueAtTime(0.12, now);
      gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
      osc1.connect(gain1);
      gain1.connect(chimeCtx.destination);
      osc1.start(now);
      osc1.stop(now + 0.35);

      const osc2 = chimeCtx.createOscillator();
      const gain2 = chimeCtx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(659.25, now + 0.18);
      gain2.gain.setValueAtTime(0.12, now + 0.18);
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);
      osc2.connect(gain2);
      gain2.connect(chimeCtx.destination);
      osc2.start(now + 0.18);
      osc2.stop(now + 0.65);
    }
  } catch (e) {
    console.warn('[Cabin Chime notice]', e);
  }
}

// Remote Audio Live VU Visualizer (Dynamic Voice Halo)
function monitorRemoteAudio(stream) {
  if (window.NookTelemetry && window.NookTelemetry.flags.novis) return;
  // Never run two loops at once (ontrack can fire again after an auto-heal)
  stopRemoteAudioVisualizer();
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    if (!remoteAudioCtx) {
      remoteAudioCtx = new AudioContextClass();
    }
    if (remoteAudioCtx.state === 'suspended') {
      remoteAudioCtx.resume();
    }
    if (remoteAudioSource) {
      try { remoteAudioSource.disconnect(); } catch (_) {}
    }
    const source = remoteAudioCtx.createMediaStreamSource(stream);
    remoteAudioSource = source;
    remoteAudioAnalyser = remoteAudioCtx.createAnalyser();
    remoteAudioAnalyser.fftSize = 64;
    source.connect(remoteAudioAnalyser);
    const data = new Uint8Array(remoteAudioAnalyser.frequencyBinCount);

    const ringInner = document.getElementById('remoteVoiceRing');
    const ringOuter = document.getElementById('remoteVoiceRingOuter');

    let lastRemoteCheck = 0;
    function checkRemoteLevel(now) {
      if (!isCallActive) {
        if (ringInner) ringInner.style.transform = 'scale(1)';
        if (ringOuter) ringOuter.style.transform = 'scale(1)';
        stopRemoteAudioVisualizer();
        return;
      }
      // Throttle remote ring pulse to ~30 FPS (every 33ms) instead of 120 FPS
      if (!now || now - lastRemoteCheck >= 33) {
        lastRemoteCheck = now || performance.now();
        remoteAudioAnalyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        const avg = sum / data.length;

        if (ringInner && ringOuter) {
          if (avg > 12) {
            const scale = Math.min(1.35, 1 + (avg / 140));
            const opacity = Math.min(0.85, 0.25 + (avg / 90));
            ringInner.style.transform = `scale(${scale})`;
            ringInner.style.opacity = opacity;
            ringOuter.style.transform = `scale(${scale * 1.22})`;
            ringOuter.style.opacity = opacity * 0.55;
            if (typeof setAvatarTalking === 'function') setAvatarTalking('partner', true);
          } else {
            ringInner.style.transform = 'scale(1)';
            ringInner.style.opacity = '0.15';
            ringOuter.style.transform = 'scale(1)';
            ringOuter.style.opacity = '0';
            if (typeof setAvatarTalking === 'function') setAvatarTalking('partner', false);
          }
        }
      }
      remoteVisualizerAnimId = requestAnimationFrame(checkRemoteLevel);
    }
    remoteVisualizerAnimId = requestAnimationFrame(checkRemoteLevel);
  } catch (err) {
    console.warn('[Remote Audio Visualizer Notice]', err);
  }
}

function stopRemoteAudioVisualizer() {
  if (remoteVisualizerAnimId) {
    cancelAnimationFrame(remoteVisualizerAnimId);
    remoteVisualizerAnimId = null;
  }
  if (remoteAudioSource) {
    try { remoteAudioSource.disconnect(); } catch (_) {}
    remoteAudioSource = null;
  }
  if (remoteAudioCtx) {
    try {
      if (remoteAudioCtx.state === 'running') remoteAudioCtx.suspend().catch(() => {});
    } catch (_) {}
  }
  const ringInner = document.getElementById('remoteVoiceRing');
  const ringOuter = document.getElementById('remoteVoiceRingOuter');
  if (ringInner) {
    ringInner.style.transform = 'scale(1)';
    ringInner.style.opacity = '0.15';
  }
  if (ringOuter) {
    ringOuter.style.transform = 'scale(1)';
    ringOuter.style.opacity = '0';
  }
  if (typeof setAvatarTalking === 'function') setAvatarTalking('partner', false);
}

// Lightweight talking indicators from WebRTC's own audio levels.
// Used when visualizer AudioContexts are off (default on iPhone) so the phone's audio
// pipeline only carries the call itself.
let levelPollInterval = null;
function startLevelPoller() {
  if (!(window.NookTelemetry && window.NookTelemetry.flags.novis) || levelPollInterval) return;
  const ringInner = document.getElementById('remoteVoiceRing');
  const ringOuter = document.getElementById('remoteVoiceRingOuter');

  levelPollInterval = setInterval(async () => {
    if (!peerConnection || !isCallActive) return;
    try {
      let remoteLevel = 0;
      const receiver = peerConnection.getReceivers().find((r) => r.track && r.track.kind === 'audio');
      if (receiver && receiver.getSynchronizationSources) {
        const src = receiver.getSynchronizationSources()[0];
        if (src && typeof src.audioLevel === 'number') remoteLevel = src.audioLevel;
      }
      const remoteTalking = remoteLevel > 0.03;
      if (ringInner && ringOuter) {
        if (remoteTalking) {
          const scale = Math.min(1.35, 1 + remoteLevel * 2);
          const opacity = Math.min(0.85, 0.25 + remoteLevel * 3);
          ringInner.style.transform = `scale(${scale})`;
          ringInner.style.opacity = opacity;
          ringOuter.style.transform = `scale(${scale * 1.22})`;
          ringOuter.style.opacity = opacity * 0.55;
        } else {
          ringInner.style.transform = 'scale(1)';
          ringInner.style.opacity = '0.15';
          ringOuter.style.transform = 'scale(1)';
          ringOuter.style.opacity = '0';
        }
      }
      if (typeof setAvatarTalking === 'function') setAvatarTalking('partner', remoteTalking);

      let localLevel = 0;
      const sender = peerConnection.getSenders().find((s) => s.track && s.track.kind === 'audio');
      if (sender && !isMicMuted) {
        const stats = await sender.getStats();
        stats.forEach((r) => {
          if (r.type === 'media-source' && typeof r.audioLevel === 'number') localLevel = r.audioLevel;
        });
      }
      const localTalking = localLevel > 0.03;
      micBtn.classList.toggle('speaking', localTalking);
      if (typeof setAvatarTalking === 'function') setAvatarTalking('me', localTalking);
    } catch (_) {
      // indicators are cosmetic — never let them disturb the call
    }
  }, 300);
}

function stopLevelPoller() {
  if (levelPollInterval) {
    clearInterval(levelPollInterval);
    levelPollInterval = null;
  }
  micBtn.classList.remove('speaking');
}

// Screen WakeLock API: Prevents phone display from sleeping/throttling during long calls
async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
      console.log('[WakeLock] Screen wake lock acquired for flight duration');
      wakeLock.addEventListener('release', () => {
        console.log('[WakeLock] Screen wake lock released');
      });
    }
  } catch (err) {
    console.warn('[WakeLock Error]', err);
  }
}

function releaseWakeLock() {
  if (wakeLock) {
    wakeLock.release().catch(() => {});
    wakeLock = null;
  }
}

document.addEventListener('visibilitychange', async () => {
  if (wakeLock !== null && document.visibilityState === 'visible' && isCallActive) {
    await requestWakeLock();
  }
});

// Real-Time Latency & Network Health Ping Monitor
function startStatsMonitor() {
  stopStatsMonitor();
  statsInterval = setInterval(async () => {
    if (!peerConnection || !isCallActive) return;
    try {
      const stats = await peerConnection.getStats();
      let rtt = null;
      stats.forEach((report) => {
        if (report.type === 'candidate-pair' && (report.state === 'succeeded' || report.nominated)) {
          if (report.currentRoundTripTime !== undefined) {
            rtt = Math.round(report.currentRoundTripTime * 1000);
          }
        }
      });

      if (rtt !== null) {
        updateBadge(`⚡ ${rtt}ms • Singapore Relay`, true);
      }
    } catch (err) {
      // quiet stats fallback
    }
  }, 3000);
}

function stopStatsMonitor() {
  if (statsInterval) {
    clearInterval(statsInterval);
    statsInterval = null;
  }
}
