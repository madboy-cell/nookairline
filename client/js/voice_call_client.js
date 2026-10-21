// client/js/voice_call_client.js — Real-Time Voice Calls & Couple Switchboard Client (Screens 05, 09, 17, 25).
// WebRTC audio with perfect-negotiation, Web Audio VAD, game audio ducking, and live Social & Couple Hub.

import { renderOutfitThumbLayers, escapeHtml } from './ui_components.js?v=cd21';
import { PhotoboothUI } from './photobooth_ui.js?v=cd23';
import { resolvePetSpriteKey } from '/shared/pet_catalog.js';
import { NOOK_NEEN_COUPLE_SINCE, coupleDaysSince } from '/shared/phase5_rules.js';

const FRIEND_PRESETS = {
  mochi: {
    name: 'Mochi',
    level: 24,
    lineage: 'dxb',
    outfit: 's2_kitsune_inari',
    hair: 'hair_twin_tails',
    hairColor: 'honey',
    petSprite: '/assets/pets/cat_front.png',
    status: 'In Sky Village',
  },
  leo: {
    name: 'Leo',
    level: 26,
    lineage: 'bkk',
    outfit: 's4_casino_royale',
    hair: 'hair_spiky_hero',
    hairColor: 'midnight',
    petSprite: '/assets/pets/pup_front.png',
    status: 'In Sky Village',
  },
  neen: {
    name: 'Neen',
    level: 28,
    lineage: 'dxb',
    outfit: 's2_kitsune_inari',
    hair: 'hair_girl_waves',
    hairColor: 'coral',
    petSprite: '/assets/pets/cat_front.png',
    status: 'In Twin Sanctuary',
  },
  nook: {
    name: 'Nook',
    level: 28,
    lineage: 'bkk',
    outfit: 's1_naga_sovereign',
    hair: 'hair_boy_fluffy',
    hairColor: 'chestnut',
    petSprite: '/assets/pets/capybara_front.png',
    status: 'In Twin Sanctuary',
  },
  aria: {
    name: 'Aria',
    level: 25,
    lineage: 'dxb',
    outfit: 's5_atlantis_siren',
    hair: 'hair_high_ponytail',
    hairColor: 'lavender',
    petSprite: '/assets/pets/kitsune_t2_front.png',
    status: 'In Town Hall Plaza',
  },
};

function fmtCompact(n) {
  const num = Number(n) || 0;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2).replace(/\.00$/, '')}M`;
  if (num >= 10_000) return `${(num / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return num.toLocaleString('en-US');
}

function resolvePetImgUrl(equippedPet, fallbackUrl = '/assets/pets/cat_front.png') {
  const petId = typeof equippedPet === 'object' ? equippedPet?.id : equippedPet;
  if (!petId) return fallbackUrl;
  const tier = (typeof equippedPet === 'object' ? (equippedPet.visual_tier || equippedPet.stars) : 1) || 1;
  try {
    const spr = resolvePetSpriteKey(petId, tier, 'front');
    if (spr) return `/assets/pets/${spr}.png`;
  } catch {}
  return fallbackUrl;
}

function resolvePeerVisual(userId, fallbackName, summaryObj = null) {
  const key = String(userId || summaryObj?.id || '').toLowerCase();
  const preset = FRIEND_PRESETS[key];
  const isDxb = summaryObj?.lineage
    ? summaryObj.lineage === 'dxb'
    : (preset?.lineage ? preset.lineage === 'dxb' : key.length % 2 === 1);
  const lineage = isDxb ? 'dxb' : 'bkk';
  const eqOutfit = summaryObj?.equipped?.outfit;
  const outfit = (typeof eqOutfit === 'object' ? eqOutfit?.id : eqOutfit)
    || preset?.outfit
    || (isDxb ? 's2_kitsune_inari' : 's1_naga_sovereign');
  const appearance = summaryObj?.appearance || {
    body: isDxb ? 'girl' : 'boy',
    hair: preset?.hair || (isDxb ? 'hair_girl_waves' : 'hair_boy_fluffy'),
    hairColor: preset?.hairColor || (isDxb ? 'coral' : 'chestnut'),
  };
  const petSprite = resolvePetImgUrl(
    summaryObj?.equipped?.pet,
    preset?.petSprite || (isDxb ? '/assets/pets/cat_front.png' : '/assets/pets/capybara_front.png')
  );
  return {
    id: key,
    name: summaryObj?.username || preset?.name || fallbackName || userId || 'Sky Friend',
    level: summaryObj?.level || preset?.level || 15,
    cp: summaryObj?.cp || 1500,
    lineage,
    outfit,
    appearance,
    petSprite,
    online: summaryObj ? !!summaryObj.online : true,
    status: summaryObj?.locationLabel || preset?.status || 'In Sky Village',
    canCall: summaryObj ? !!summaryObj.canCall : true,
    hasTelelink: summaryObj ? !!summaryObj.hasTelelink : false,
    blessedToday: summaryObj ? !!summaryObj.blessedToday : false,
    partnerId: summaryObj?.partner_id || null,
    isBot: !!summaryObj?.is_bot,
  };
}

// Audio SDP Optimizer (from nookairline), tuned for Dubai-to-Bangkok TURN + VPN:
//  - 60 ms packets (~17 pkt/s instead of 50) => far less per-packet IP/UDP/TURN/SRTP/VPN overhead
//  - 24 kbps VBR mono voice with in-band FEC
//  - DTX: near-zero traffic while silent
const AUDIO_PTIME_MS = 60;
const AUDIO_MAX_BITRATE = 24000;

function optimizeAudioSDP(sdp) {
  if (!sdp || typeof sdp !== 'string') return sdp;
  const opusMatch = sdp.match(/a=rtpmap:(\d+) opus\/48000\/2/i);
  if (!opusMatch) return sdp;
  const pt = opusMatch[1];
  const want = {
    useinbandfec: '1',
    usedtx: '1',
    maxaveragebitrate: String(AUDIO_MAX_BITRATE),
    stereo: '0',
    'sprop-stereo': '0',
    cbr: '0',
  };

  const fmtpRegex = new RegExp(`a=fmtp:${pt} ([^\\r\\n]*)`, 'i');
  if (fmtpRegex.test(sdp)) {
    sdp = sdp.replace(fmtpRegex, (_match, params) => {
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

  sdp = sdp.replace(/\r\na=(?:max)?ptime:\d+/g, '');
  sdp = sdp.replace(opusMatch[0], `${opusMatch[0]}\r\na=ptime:${AUDIO_PTIME_MS}\r\na=maxptime:${AUDIO_PTIME_MS}`);
  return sdp;
}

export class VoiceCallClient {
  /**
   * @param {object} opts
   * @param {object} opts.net                 Net instance with .send(msg)
   * @param {() => object} [opts.getProfile]  Returns current user profile
   * @param {(msg: string) => void} [opts.toast]
   * @param {(id: string) => string} [opts.getUserName]
   * @param {(id: string) => void} [opts.onVisitIsland]
   * @param {(id: string) => void} [opts.onBlessPartner]
   * @param {(id: string) => void} [opts.onOpenGift]
   * @param {() => void} [opts.onOpenPlayHub]
   * @param {(type: string, payload?: object) => Promise<any>} [opts.request]
   * @param {() => void} [opts.onCoupleSyncPose]
   */
  constructor({
    net,
    getProfile = () => ({}),
    toast = console.log,
    getUserName = (id) => id,
    onVisitIsland = null,
    onBlessPartner = null,
    onOpenGift = null,
    onOpenPlayHub = null,
    request = null,
    onCoupleSyncPose = null,
    onOpenPhotobooth = null,
  } = {}) {
    this.net = net;
    this.getProfile = getProfile;
    this.toast = toast;
    this.getUserName = getUserName;
    this.onVisitIsland = onVisitIsland;
    this.onBlessPartner = onBlessPartner;
    this.onOpenGift = onOpenGift;
    this.onOpenPlayHub = onOpenPlayHub;
    this.request = request;
    this.onCoupleSyncPose = onCoupleSyncPose;
    this.onOpenPhotobooth = onOpenPhotobooth;

    this._state = 'idle'; // 'idle' | 'calling' | 'incoming' | 'connected'
    this.callId = null;
    this.peerId = null;
    this.peerName = null;
    this.isVip = false;
    this.startedAt = 0;
    this.diamondsEarned = 0;
    this.polite = false;
    this.isMuted = false;
    this.autoDuck = true;
    this.switchboardTab = 'friends'; // 'couple' | 'friends' | 'vip'
    this.switchboardOpen = false;

    // Live social directory state
    this.directory = null;
    this.loadingDirectory = false;
    this.confirmBreakOpen = false;
    this.confirmRemoveFriendId = null;
    this.friendSearchDraft = '';

    // WebRTC internals
    this.pc = null;
    this.localStream = null;
    this.remoteStream = null;
    this.makingOffer = false;
    this.ignoreOffer = false;
    this.isSettingRemoteAnswerPending = false;
    this.pendingCandidates = [];
    this.pendingDescription = null;
    this._initialNegotiationDone = false;
    this._iceHealTimer = null;
    this._iceRebuildTimer = null;
    this._iceRefreshInterval = null;
    this._lastIceConfig = null;
    this.reconnecting = false;

    // Web Audio VAD
    this.audioCtx = null;
    this.localAnalyser = null;
    this.remoteAnalyser = null;
    this.vadInterval = null;
    this.timerInterval = null;

    // DOM elements
    this.bannerEl = null;
    this.pillEl = null;
    this.switchboardEl = null;
    this.remoteAudio = null;

    this._initDom();
  }

  get state() {
    return this._state;
  }

  get isSupported() {
    return typeof window !== 'undefined' &&
      typeof window.RTCPeerConnection !== 'undefined' &&
      !!navigator?.mediaDevices?.getUserMedia;
  }

  _initDom() {
    if (typeof document === 'undefined') return;

    // 1. Incoming call banner (Screen 25 top-left)
    let banner = document.getElementById('incoming-call-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'incoming-call-banner';
      banner.hidden = true;
      document.body.appendChild(banner);
    }
    this.bannerEl = banner;
    this.bannerEl.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-call], [data-act]');
      if (!btn) return;
      const act = btn.dataset.call || btn.dataset.act;
      if (act === 'accept' || act === 'call-accept') this.accept();
      else if (act === 'decline' || act === 'call-decline') this.decline();
    });

    // 2. In-call pill (Screen 25 top-right)
    let pill = document.getElementById('voice-call-pill');
    if (!pill) {
      pill = document.createElement('div');
      pill.id = 'voice-call-pill';
      pill.hidden = true;
      document.body.appendChild(pill);
    }
    this.pillEl = pill;
    this.pillEl.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-call], [data-act]');
      if (!btn) return;
      const act = btn.dataset.call || btn.dataset.act;
      if (act === 'mute' || act === 'call-mute') this.toggleMute();
      else if (act === 'heal' || act === 'call-heal') this.healCall('manual');
      else if (act === 'hangup' || act === 'call-hangup') this.hangup();
      else if (act === 'switchboard' || act === 'call-switchboard') this.openSwitchboard();
    });

    // 3. Couple Sanctuary & Friends Switchboard Modal (Screens 17 & 18)
    let sb = document.getElementById('social-switchboard-modal');
    if (!sb) {
      sb = document.createElement('div');
      sb.id = 'social-switchboard-modal';
      sb.className = 'modal-wrap social-switchboard-modal';
      sb.hidden = true;
      document.body.appendChild(sb);
    }
    this.switchboardEl = sb;

    this.switchboardEl.addEventListener('input', (e) => {
      if (e.target.id === 'sb-friend-input') {
        this.friendSearchDraft = e.target.value;
      }
    });

    this.switchboardEl.addEventListener('keydown', (e) => {
      if (e.target.id === 'sb-friend-input' && e.key === 'Enter') {
        e.preventDefault();
        const btn = this.switchboardEl.querySelector('[data-sb-act="friend-send-input"]');
        btn?.click();
      }
    });

    this.switchboardEl.addEventListener('click', async (e) => {
      if (e.target === this.switchboardEl || e.target.closest('[data-sb-close]')) {
        this.closeSwitchboard();
        return;
      }
      const tabBtn = e.target.closest('[data-sb-tab]');
      if (tabBtn) {
        this.switchboardTab = tabBtn.dataset.sbTab || 'couple';
        this.confirmBreakOpen = false;
        this.confirmRemoveFriendId = null;
        this.renderSwitchboard();
        return;
      }
      const actBtn = e.target.closest('[data-sb-act]');
      if (!actBtn) return;
      const act = actBtn.dataset.sbAct;
      const uid = actBtn.dataset.userId;
      const p = (this.getProfile && this.getProfile()) || {};
      const partnerId = p.partner_id || this.directory?.partner?.id || null;

      if (act === 'call-user' && uid) {
        this.call(uid);
        this.renderSwitchboard();
      } else if (act === 'accept-call') {
        await this.accept();
        this.renderSwitchboard();
      } else if (act === 'decline-call') {
        this.decline();
        this.renderSwitchboard();
      } else if (act === 'hangup') {
        this.hangup();
        this.renderSwitchboard();
      } else if (act === 'heal-call') {
        this.healCall('manual');
        this.renderSwitchboard();
      } else if (act === 'toggle-mute') {
        this.toggleMute();
        this.renderSwitchboard();
      } else if (act === 'toggle-duck') {
        this.autoDuck = !this.autoDuck;
        if (typeof window !== 'undefined' && this._state === 'connected') {
          window.dispatchEvent(new CustomEvent('voice:duck', { detail: { on: this.autoDuck } }));
        }
        this.toast(`🔊 Auto-Duck Game Audio: ${this.autoDuck ? 'ON (40%)' : 'OFF'}`);
        this.renderSwitchboard();
      } else if (act === 'polaroid' || act === 'couple-polaroid') {
        this.closeSwitchboard();
        this.openPhotobooth({ mode: partnerId ? 'couple' : 'solo' });
      } else if (act === 'view-album-photo') {
        const photoId = actBtn.dataset.photoId;
        const p = (this.getProfile && this.getProfile()) || {};
        const album = Array.isArray(this.directory?.coupleAlbum)
          ? this.directory.coupleAlbum
          : (Array.isArray(p.couple_album) ? p.couple_album : []);
        const found = album.find((x) => x && x.id === photoId);
        if (found) {
          this.closeSwitchboard();
          this.openPhotobooth({ viewPhoto: found });
        }
      } else if (act === 'delete-album-photo') {
        ev.stopPropagation();
        const photoId = actBtn.dataset.photoId;
        if (photoId && this.request) {
          const r = await this.request('couple_moment', { deletePhotoId: photoId });
          if (r?.ok && r.directory) this.directory = r.directory;
          this.toast('🗑️ Removed Polaroid from scrapbook.');
          this.renderSwitchboard();
        }
      } else if (act === 'download-polaroid') {
        const polUrl = actBtn.dataset.polUrl;
        if (polUrl && typeof document !== 'undefined') {
          const a = document.createElement('a');
          a.href = polUrl;
          a.download = `neora-couple-polaroid-${Date.now()}.png`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          this.toast('📥 Downloaded Polaroid Keepsake! ✨');
        }
      } else if (act === 'bless-partner' && partnerId) {
        actBtn.disabled = true;
        if (this.onBlessPartner) await this.onBlessPartner(partnerId);
        else this.net?.send?.({ type: 'village_bless_partner', target: partnerId });
        await this.refreshDirectory();
      } else if (act === 'bless-friend' && uid) {
        actBtn.disabled = true;
        if (this.onBlessPartner) await this.onBlessPartner(uid);
        else this.net?.send?.({ type: 'village_bless_partner', target: uid });
        await this.refreshDirectory();
      } else if (act === 'sit-table') {
        this.closeSwitchboard();
        if (this.onOpenPlayHub) this.onOpenPlayHub();
      } else if (act === 'visit-partner' && partnerId) {
        this.closeSwitchboard();
        if (this.onVisitIsland) this.onVisitIsland(partnerId);
      } else if (act === 'visit-user' && uid) {
        this.closeSwitchboard();
        if (this.onVisitIsland) this.onVisitIsland(uid);
      } else if (act === 'gift-partner' || act === 'gift-user') {
        const targetId = uid || partnerId;
        this.closeSwitchboard();
        if (this.onOpenGift) this.onOpenGift(targetId);
      } else if (act === 'open-vip-bag') {
        this.closeSwitchboard();
        if (this.onOpenGift) this.onOpenGift(partnerId || '');
      } else if (act === 'couple-sync-pose') {
        if (this.onCoupleSyncPose) {
          this.onCoupleSyncPose(partnerId);
          this.renderSwitchboard();
        } else {
          if (this.request) {
            const r = await this.request('couple_moment', { kind: 'pose' });
            if (r?.ok && r.directory) this.directory = r.directory;
          } else {
            this.net?.send?.({ type: 'couple_moment', kind: 'pose' });
          }
          this.toast('🫶 Triggered Couple Sync Pose! +1 Sweet Memory & +25% Village Bonus! 💖');
          this.renderSwitchboard();
        }
      } else if (act === 'prompt-break') {
        this.confirmBreakOpen = true;
        this.renderSwitchboard();
      } else if (act === 'cancel-break') {
        this.confirmBreakOpen = false;
        this.renderSwitchboard();
      } else if (act === 'confirm-break') {
        actBtn.disabled = true;
        if (this.request) {
          const r = await this.request('couple_break', {});
          if (r?.ok) {
            this.confirmBreakOpen = false;
            if (r.directory) this.directory = r.directory;
            this.toast(`🌙 You and ${r.oldPartnerId} are taking a gentle break. Your ${r.savedStreak}d streak is saved.`);
          } else {
            this.toast(`⚠️ ${r?.error || 'Could not take a break'}`);
          }
        }
        this.renderSwitchboard();
      } else if (act === 'couple-propose' && uid) {
        actBtn.disabled = true;
        if (this.request) {
          const r = await this.request('couple_propose', { to: uid });
          if (r?.ok) {
            if (r.directory) this.directory = r.directory;
            if (r.status === 'coupled') {
              this.toast(`💞 Bound with ${r.partnerName || uid}! Twin Sky-Islands unlocked!`);
            } else {
              this.toast(`💌 Sent Couple Sanctuary proposal to ${r.targetName || uid}!`);
            }
          } else {
            this.toast(`⚠️ ${r?.error || 'Could not send proposal'}`);
          }
        }
        this.renderSwitchboard();
      } else if (act === 'couple-accept' && uid) {
        actBtn.disabled = true;
        if (this.request) {
          const r = await this.request('couple_accept', { from: uid });
          if (r?.ok) {
            if (r.directory) this.directory = r.directory;
            this.toast(`💞 Bound with ${r.partnerName || uid}! (${r.streak || 1}d Streak)`);
          } else {
            this.toast(`⚠️ ${r?.error || 'Could not accept proposal'}`);
          }
        }
        this.renderSwitchboard();
      } else if ((act === 'couple-decline' || act === 'couple-cancel') && uid) {
        actBtn.disabled = true;
        if (this.request) {
          const r = await this.request('couple_decline', { from: uid, to: uid });
          if (r?.ok && r.directory) this.directory = r.directory;
          this.toast(act === 'couple-cancel' ? '💌 Cancelled couple proposal.' : 'Closed couple proposal.');
        }
        this.renderSwitchboard();
      } else if (act === 'friend-send-input') {
        const inputEl = this.switchboardEl.querySelector('#sb-friend-input');
        const val = (inputEl?.value || this.friendSearchDraft || '').trim();
        if (!val) {
          this.toast('✏️ Enter a player username first');
          inputEl?.focus();
          return;
        }
        actBtn.disabled = true;
        if (this.request) {
          const r = await this.request('friend_request_send', { to: val });
          if (r?.ok) {
            this.friendSearchDraft = '';
            if (r.directory) this.directory = r.directory;
            if (r.status === 'accepted') {
              this.toast(`🤝 ${r.targetName || val} is now your friend!`);
            } else {
              this.toast(`📨 Friend request sent to ${r.targetName || val}!`);
            }
          } else {
            const msgMap = {
              no_such_user: `Player "${val}" not found`,
              already_friends: `You are already friends with ${val}`,
              cannot_friend_self: 'You cannot add yourself',
              request_already_sent: `Friend request already sent to ${val}`,
            };
            this.toast(`⚠️ ${msgMap[r?.error] || r?.error || 'Could not send request'}`);
          }
        }
        this.renderSwitchboard();
      } else if (act === 'friend-send' && uid) {
        actBtn.disabled = true;
        if (this.request) {
          const r = await this.request('friend_request_send', { to: uid });
          if (r?.ok) {
            if (r.directory) this.directory = r.directory;
            if (r.status === 'accepted') {
              this.toast(`🤝 ${r.targetName || uid} is now your friend!`);
            } else {
              this.toast(`📨 Friend request sent to ${r.targetName || uid}!`);
            }
          } else {
            this.toast(`⚠️ ${r?.error || 'Could not send request'}`);
          }
        }
        this.renderSwitchboard();
      } else if (act === 'friend-accept' && uid) {
        actBtn.disabled = true;
        if (this.request) {
          const r = await this.request('friend_request_accept', { from: uid });
          if (r?.ok) {
            if (r.directory) this.directory = r.directory;
            this.toast(`🤝 Accepted ${r.friendName || uid}'s friend request!`);
          } else {
            this.toast(`⚠️ ${r?.error || 'Could not accept friend request'}`);
          }
        }
        this.renderSwitchboard();
      } else if (act === 'friend-decline' && uid) {
        actBtn.disabled = true;
        if (this.request) {
          const r = await this.request('friend_request_decline', { from: uid, to: uid });
          if (r?.ok && r.directory) this.directory = r.directory;
        }
        this.renderSwitchboard();
      } else if (act === 'prompt-remove-friend' && uid) {
        this.confirmRemoveFriendId = this.confirmRemoveFriendId === uid ? null : uid;
        this.renderSwitchboard();
      } else if (act === 'cancel-remove-friend') {
        this.confirmRemoveFriendId = null;
        this.renderSwitchboard();
      } else if (act === 'friend-remove' && uid) {
        actBtn.disabled = true;
        if (this.request) {
          const r = await this.request('friend_remove', { targetId: uid });
          if (r?.ok) {
            this.confirmRemoveFriendId = null;
            if (r.directory) this.directory = r.directory;
            this.toast(`Removed ${uid} from your friend list.`);
          } else if (r?.error === 'take_break_first') {
            this.toast('💞 Take a break in the Couple tab before removing your bound partner.');
          } else {
            this.toast(`⚠️ ${r?.error || 'Could not remove friend'}`);
          }
        }
        this.renderSwitchboard();
      }
    });

    // 4. Remote audio player
    let audio = document.getElementById('voice-remote-audio');
    if (!audio) {
      audio = document.createElement('audio');
      audio.id = 'voice-remote-audio';
      audio.autoplay = true;
      audio.playsInline = true;
      audio.hidden = true;
      document.body.appendChild(audio);
    }
    this.remoteAudio = audio;

    // 5. Mobile Audio Unlock & Wake Recovery (iOS Safari + Mobile Network Handoff)
    const unlockAudio = () => {
      if (this.remoteAudio && this.remoteAudio.srcObject) {
        this.remoteAudio.play().catch(() => {});
      }
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }
      if (this._state === 'connected' && !this._isLocalMicHealthy()) {
        this._recoverLocalMic();
      }
    };
    document.addEventListener('touchstart', unlockAudio, { passive: true });
    document.addEventListener('click', unlockAudio);

    const onWakeOrOnline = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      unlockAudio();
      if (this._state === 'connected') {
        const pcState = this.pc ? (this.pc.iceConnectionState || this.pc.connectionState) : 'closed';
        if (!this.pc || pcState === 'disconnected' || pcState === 'failed' || pcState === 'closed' || this.pc.signalingState === 'closed') {
          this.healCall('wake');
        }
      }
    };
    document.addEventListener('visibilitychange', onWakeOrOnline);
    if (typeof window !== 'undefined') window.addEventListener('online', onWakeOrOnline);
  }

  // --------------------------------------------------------------------------- Live Directory Sync
  async refreshDirectory() {
    if (!this.request || this.loadingDirectory) return;
    this.loadingDirectory = true;
    try {
      const r = await this.request('social_directory', {});
      if (r && r.ok) {
        this.directory = r;
        if (this.switchboardOpen) this.renderSwitchboard();
      }
    } catch {} finally {
      this.loadingDirectory = false;
    }
  }

  onProfileUpdate() {
    if (this.switchboardOpen) {
      if (typeof document !== 'undefined' && document.activeElement?.id === 'sb-friend-input') return;
      this.renderSwitchboard();
    }
  }

  onSocialNotify() {
    if (this.switchboardOpen) {
      this.refreshDirectory();
    }
  }

  openPhotobooth(opts = {}) {
    if (this.switchboardOpen) {
      this.closeSwitchboard();
    }
    if (!this.photobooth) {
      this.photobooth = new PhotoboothUI({
        getProfile: () => (this.getProfile ? this.getProfile() : {}),
        getPartner: () => this.directory?.partner || null,
        getWorld: () => window.__neora?.world || null,
        request: this.request,
        toast: this.toast,
        onSaved: (res) => {
          if (res?.directory) this.directory = res.directory;
          if (this.switchboardOpen) this.renderSwitchboard();
        },
      });
      if (typeof window !== 'undefined' && window.__neora) {
        window.__neora.photobooth = this.photobooth;
      }
    }
    this.photobooth.open(opts);
  }

  // --------------------------------------------------------------------------- Switchboard Modal
  openSwitchboard(tab = null) {
    if (this.photobooth?.isOpen) {
      this.photobooth.close();
    }
    if (tab) {
      this.switchboardTab = tab;
    } else {
      const p = (this.getProfile && this.getProfile()) || {};
      const isCoupled = Boolean(p.partner_id || this.directory?.partner?.id);
      if (isCoupled) this.switchboardTab = 'couple';
    }
    this.switchboardOpen = true;
    this.confirmBreakOpen = false;
    this.confirmRemoveFriendId = null;
    if (this.pillEl) this.pillEl.hidden = true;
    if (this.bannerEl) this.bannerEl.hidden = true;
    if (this.switchboardEl) {
      this.switchboardEl.hidden = false;
      this.renderSwitchboard();
    }
    this.refreshDirectory();
  }

  closeSwitchboard() {
    this.switchboardOpen = false;
    this.confirmBreakOpen = false;
    this.confirmRemoveFriendId = null;
    if (this.switchboardEl) {
      this.switchboardEl.hidden = true;
    }
    if (this._state === 'connected' && this.pillEl) {
      this.pillEl.hidden = false;
    } else if (this._state === 'incoming' && this.bannerEl) {
      this.bannerEl.hidden = false;
    }
  }

  renderSwitchboard() {
    if (!this.switchboardEl || !this.switchboardOpen) return;
    const p = (this.getProfile && this.getProfile()) || {};
    const dir = this.directory;
    const myId = p.id || 'nook';
    const myName = p.username || 'Nook';
    const myLevel = p.level || 15;
    const myLineage = p.lineage || 'bkk';
    const eqOutfitRaw = p.equipped?.outfit;
    const myOutfit = (typeof eqOutfitRaw === 'object' ? eqOutfitRaw?.id : eqOutfitRaw) || 'newbie_outfit';
    const myAppearance = p.appearance || {
      body: myLineage === 'dxb' ? 'girl' : 'boy',
      hair: myLineage === 'dxb' ? 'hair_girl_waves' : 'hair_boy_fluffy',
      hairColor: 'chestnut',
    };
    const myChibiHtml = renderOutfitThumbLayers(myOutfit, {
      lineage: myLineage,
      appearance: myAppearance,
      alt: myName,
    });
    const myPetUrl = resolvePetImgUrl(p.equipped?.pet, '/assets/pets/capybara_front.png');

    // Real Couple Status (NO hardcoded fallback when single!)
    const partnerSummary = dir ? dir.partner : (p.partner_id ? { id: p.partner_id, username: p.partner_id } : null);
    const partnerId = partnerSummary?.id || p.partner_id || null;
    const isCoupled = Boolean(partnerId);
    const partnerVis = isCoupled
      ? resolvePeerVisual(partnerId, this.getUserName(partnerId), partnerSummary)
      : null;
    const partnerChibiHtml = partnerVis
      ? renderOutfitThumbLayers(partnerVis.outfit, {
          lineage: partnerVis.lineage,
          appearance: partnerVis.appearance,
          alt: partnerVis.name,
        })
      : '';

    const isNookNeen =
      (myId === 'nook' || myId === 'neen') &&
      (partnerId === 'neen' || partnerId === 'nook');
    const rawCoupleSince = isCoupled
      ? (p.couple_since || partnerSummary?.couple_since || (isNookNeen ? NOOK_NEEN_COUPLE_SINCE : null))
      : null;
    const autoSinceDays = rawCoupleSince ? coupleDaysSince(rawCoupleSince) : 0;
    const streak = isCoupled
      ? (autoSinceDays > 0 ? autoSinceDays : Math.max(1, p.couple_streak || partnerSummary?.couple_streak || 1))
      : 0;

    let coupleSinceLabel = '';
    if (rawCoupleSince) {
      const dStr = typeof rawCoupleSince === 'number'
        ? new Date(rawCoupleSince).toISOString().slice(0, 10)
        : String(rawCoupleSince).slice(0, 10);
      const parsed = new Date(`${dStr}T00:00:00Z`);
      if (!Number.isNaN(parsed.getTime())) {
        coupleSinceLabel = parsed.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          timeZone: 'UTC',
        });
      }
    }
    const isConnected = this._state === 'connected';
    const isCalling = this._state === 'calling';
    const isIncoming = this._state === 'incoming';

    // Real Call Timer (only runs when connected!)
    const elapsedSec = (isConnected && this.startedAt)
      ? Math.floor(Math.max(0, Date.now() - this.startedAt) / 1000)
      : 0;
    const mm = String(Math.floor(elapsedSec / 60)).padStart(2, '0');
    const ss = String(elapsedSec % 60).padStart(2, '0');
    const earnedToday = this.diamondsEarned || 0;

    // Live Friends & Requests from directory (or fallback to profile.friends while loading)
    const friendsList = Array.isArray(dir?.friends)
      ? dir.friends.map((f) => resolvePeerVisual(f.id, f.username, f))
      : (p.friends || [])
          .filter((fid) => fid && fid !== myId)
          .map((fid) => resolvePeerVisual(fid, this.getUserName(fid), null));

    const friendRequestsIn = Array.isArray(dir?.friendRequestsIn)
      ? dir.friendRequestsIn
      : (p.friend_requests_in || []).map((r) => ({
          from: r.from,
          fromName: r.fromName || r.from,
          user: resolvePeerVisual(r.from, r.fromName || r.from, null),
        }));
    const friendRequestsOut = Array.isArray(dir?.friendRequestsOut)
      ? dir.friendRequestsOut
      : (p.friend_requests_out || []);
    const coupleRequestsIn = Array.isArray(dir?.coupleRequestsIn)
      ? dir.coupleRequestsIn
      : (p.couple_requests_in || []).map((r) => ({
          from: r.from,
          fromName: r.fromName || r.from,
          savedStreak: p.past_couple_streaks?.[r.from] || 0,
          user: resolvePeerVisual(r.from, r.fromName || r.from, null),
        }));
    const coupleRequestOut = dir ? dir.coupleRequestOut : (p.couple_requests_out || null);
    const discoverPlayers = Array.isArray(dir?.discoverPlayers) ? dir.discoverPlayers : [];
    const pastStreaks = dir?.pastStreaks || p.past_couple_streaks || {};

    const vip = p.vip || {};
    const bag = p.bag_items || {};
    const curTab = this.switchboardTab || 'friends';
    const onlineFriendsCount = friendsList.filter((f) => f.online).length;

    // Shared 15-bar compact audio waveform HTML
    const waveHeights = [22, 36, 54, 32, 68, 88, 60, 95, 72, 50, 82, 58, 40, 28, 20];
    const waveformBarsHtml = waveHeights.map((h, i) => {
      const tone = i < 5 ? 'cyan' : (i < 10 ? 'pink' : 'gold');
      const barH = (isConnected || isCalling) ? h : Math.max(16, Math.round(h * 0.25));
      return `<span class="sb-wave-bar tone-${tone}" style="--bar-h:${barH}%;animation-delay:${(i * 0.06).toFixed(2)}s"></span>`;
    }).join('');

    // 1. Unified Royal Wood Modal Header (Identical across all 3 tabs)
    const headerSubText = isCoupled && partnerVis
      ? `💞 Bound with ${escapeHtml(partnerVis.name)} • ${coupleSinceLabel ? `Since ${coupleSinceLabel} (Day ${streak})` : `${streak}d Together`}`
      : `🌟 Single Sanctuary • ${friendsList.length} Friends`;

    const topBarHtml = `
      <header class="sb-unified-header">
        <div class="sb-unified-title-wrap">
          <div class="sb-unified-title">💞 Couple &amp; Call Hub</div>
          <div class="sb-unified-sub">${headerSubText}</div>
        </div>
        <div class="sb-unified-header-right">
          <span class="sb-curr-pill" title="Diamonds"><img src="/assets/ui/icon_diamond.png" alt="💎" /> ${fmtCompact(p.diamonds)}</span>
          <button type="button" class="x-btn sb-close-btn" data-sb-close="1" data-act="close-switchboard" aria-label="Close">✕</button>
        </div>
      </header>
    `;

    // 2. Persistent Compact Voice Call Bar (Stays fixed across ALL 3 tabs!)
    const activePeerName = escapeHtml(this.peerName || (partnerVis ? partnerVis.name : 'Friend'));
    const callBarHtml = isIncoming ? `
      <div class="sb-unified-callbar is-active">
        <div class="sb-callbar-top">
          <div class="sb-callbar-status">
            <span class="sb-live-dot"></span>
            <b>Incoming Call from ${activePeerName}!</b>
            <small>• Couple Tele-Link (+20 💎/15m)</small>
          </div>
          <div class="sb-waveform-box active sb-callbar-wave">${waveformBarsHtml}</div>
        </div>
        <div class="sb-callbar-controls">
          <button type="button" class="sb-callbar-btn is-on" data-sb-act="accept-call">
            📞 Accept &amp; Talk
          </button>
          <button type="button" class="sb-callbar-btn is-hangup" data-sb-act="decline-call">
            Busy
          </button>
        </div>
      </div>
    ` : (isConnected || isCalling) ? `
      <div class="sb-unified-callbar is-active">
        <div class="sb-callbar-top">
          <div class="sb-callbar-status">
            <span class="sb-live-dot"></span>
            <b>${isConnected ? `${this.reconnecting ? '🔄 Reconnecting' : 'Live Call'} <span class="sb-callbar-timer">${mm}:${ss}</span>` : `Ringing ${activePeerName}…`}</b>
            <small>• with ${activePeerName} (+20 💎/15m)</small>
          </div>
          <div class="sb-waveform-box active sb-callbar-wave">${waveformBarsHtml}</div>
        </div>
        <div class="sb-callbar-controls">
          <button type="button" class="sb-callbar-btn ${this.isMuted ? 'is-muted' : ''}" data-sb-act="toggle-mute">
            ${this.isMuted ? '🔇 Unmute' : '🎙️ Mute'}
          </button>
          <button type="button" class="sb-callbar-btn ${this.autoDuck ? 'is-on' : ''}" data-sb-act="toggle-duck">
            🔊 Duck: ${this.autoDuck ? 'ON' : 'OFF'}
          </button>
          <button type="button" class="sb-callbar-btn" data-sb-act="heal-call" title="Rebuild voice connection without refreshing">
            🔄 Reconnect
          </button>
          <button type="button" class="sb-callbar-btn is-hangup" data-sb-act="hangup">
            📴 End
          </button>
        </div>
      </div>
    ` : `
      <div class="sb-unified-callbar is-idle">
        <div class="sb-callbar-idle-info">
          <div class="sb-callbar-idle-title"><span><img class="sb-callbar-ico" src="/assets/ui/icon_couple_call_talk.png" alt="" /> 1-on-1 Voice Line</span> <span class="sb-callbar-earned">+20 💎/15m</span></div>
          <div class="sb-callbar-idle-sub">
            ${isCoupled && partnerVis
              ? `Free Couple Tele-Link with <b>${escapeHtml(partnerVis.name)}</b> • Today: +${earnedToday} 💎`
              : `Tap 📞 on any friend to talk • Today: +${earnedToday} 💎`}
          </div>
        </div>
        ${isCoupled && partnerVis ? `
          <button type="button" class="sb-callbar-dial-btn" data-sb-act="call-user" data-user-id="${escapeHtml(partnerId)}">
            📞 Call ${escapeHtml(partnerVis.name)}
          </button>
        ` : `
          <button type="button" class="sb-callbar-dial-btn is-secondary" data-sb-tab="friends">
            🤝 Friends
          </button>
        `}
      </div>
    `;

    // 3. Unified Segmented Wood Sub-Navigation Bar (Matches .s2-bag-subnav)
    const coupleBadge = coupleRequestsIn.length > 0
      ? `<span class="sb-tab-badge">${coupleRequestsIn.length}</span>`
      : '';
    const friendBadge = friendRequestsIn.length > 0
      ? `<span class="sb-tab-badge">${friendRequestsIn.length}</span>`
      : '';
    const tabsBarHtml = `
      <div class="s2-bag-subnav sb-directory-tabs" role="tablist">
        <button type="button" class="s2-bag-sub-btn sb-dir-tab ${curTab === 'couple' ? 'active' : ''}" data-sb-tab="couple">
          <span>💞 Couple${isCoupled ? ` (${streak}d)` : ''}</span>${coupleBadge}
        </button>
        <button type="button" class="s2-bag-sub-btn sb-dir-tab ${curTab === 'friends' ? 'active' : ''}" data-sb-tab="friends">
          <span>🤝 Friends (${onlineFriendsCount}/${friendsList.length})</span>${friendBadge}
        </button>
        <button type="button" class="s2-bag-sub-btn sb-dir-tab ${curTab === 'vip' ? 'active' : ''}" data-sb-tab="vip">
          <span>🎟️ Call VIP</span>
        </button>
      </div>
    `;

    let tabBodyHtml = '';

    // =========================================================================
    // TAB 1: 💞 COUPLE SANCTUARY (Bound Couple State OR Single / Proposal State)
    // =========================================================================
    if (curTab === 'couple') {
      if (isCoupled && partnerVis) {
        const rawStats = dir?.coupleStats || p.couple_stats || partnerSummary?.couple_stats || {};
        const isPartnerCallLive = Boolean(
          isConnected &&
          this.peerId &&
          partnerId &&
          this.peerId.toLowerCase() === partnerId.toLowerCase()
        );
        const liveCallMins = isPartnerCallLive ? Math.floor(elapsedSec / 60) : 0;
        const bestStreak = autoSinceDays > 0 ? autoSinceDays : Math.max(streak, rawStats.bestStreak || 0);
        const totalCallMins = (rawStats.callMinutes || 0) + liveCallMins;
        const callSessions = Math.max(isPartnerCallLive ? 1 : 0, rawStats.callSessions || 0);
        const callDiamonds = (rawStats.callDiamonds || 0) + (isPartnerCallLive ? (this.diamondsEarned || 0) : 0);
        const blessingsShared = rawStats.blessingsShared || 0;
        const giftsExchanged = rawStats.giftsExchanged || 0;
        const momentsCaptured = rawStats.momentsCaptured || 0;
        const coopActivities = rawStats.coopActivities || 0;

        let fmtCallDuration;
        if (totalCallMins >= 60) {
          const hrs = Math.floor(totalCallMins / 60);
          const mins = totalCallMins % 60;
          fmtCallDuration = mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
        } else if (totalCallMins > 0) {
          fmtCallDuration = `${totalCallMins}m`;
        } else if (isPartnerCallLive) {
          fmtCallDuration = `${mm}:${ss}`;
        } else {
          fmtCallDuration = '0m';
        }

        const bondScore =
          streak * 10 +
          totalCallMins * 1 +
          blessingsShared * 8 +
          giftsExchanged * 12 +
          momentsCaptured * 6 +
          coopActivities * 10;

        const bondTiers = [
          { lv: 1, icon: '🌱', title: 'Sprouting Crush', min: 0, max: 100 },
          { lv: 2, icon: '🌸', title: 'Blossom Sweethearts', min: 100, max: 300 },
          { lv: 3, icon: '🕊️', title: 'Skyward Lovers', min: 300, max: 700 },
          { lv: 4, icon: '💞', title: 'Starlight Soulmates', min: 700, max: 1500 },
          { lv: 5, icon: '👑', title: 'Eternal Sky Royals', min: 1500, max: 3000 },
          { lv: 6, icon: '🌌', title: 'Celestial Twin Flames', min: 3000, max: 6000 },
          { lv: 7, icon: '☀️', title: 'Solar & Lunar Sovereigns', min: 6000, max: 10000 },
          { lv: 8, icon: '♾️', title: 'Mythic Astral Dynasty', min: 10000, max: 20000 },
        ];
        const maxBondLv = bondTiers[bondTiers.length - 1].lv;
        const curTier = bondTiers.find((t, idx) => bondScore < t.max || idx === bondTiers.length - 1) || bondTiers[0];
        const nextTier = bondTiers[Math.min(bondTiers.length - 1, bondTiers.indexOf(curTier) + 1)];
        const tierSpan = Math.max(1, curTier.max - curTier.min);
        const tierPct = curTier.lv >= maxBondLv && bondScore >= curTier.max
          ? 100
          : Math.max(6, Math.min(100, Math.round(((bondScore - curTier.min) / tierSpan) * 100)));

        const chronicleHtml = `
          <div class="sb-love-chronicle-card" data-couple-chronicle="1">
            <div class="sb-chronicle-head">
              <div class="sb-chronicle-title-group">
                <img class="sb-chronicle-book-ico" src="/assets/ui/icon_couple_chronicle.png" alt="Love Chronicle" />
                <div class="sb-chronicle-title-text">
                  <div class="sb-chronicle-title">Our Love Chronicle</div>
                  <div class="sb-chronicle-sub">What ${escapeHtml(myName)} &amp; ${escapeHtml(partnerVis.name)} have been through</div>
                </div>
              </div>
              <span class="sb-chronicle-tier-pill">
                ${curTier.icon} Lv.${curTier.lv} ${escapeHtml(curTier.title)}
              </span>
            </div>

            <div class="sb-chronicle-xp-box">
              <div class="sb-chronicle-xp-labels">
                <span>💖 <b>${bondScore.toLocaleString()}</b> Bond Pts</span>
                <span>${curTier.lv >= maxBondLv && bondScore >= curTier.max ? '✨ Max Celestial Bond!' : `Next: ${nextTier.icon} ${escapeHtml(nextTier.title)} (${curTier.max.toLocaleString()})`}</span>
              </div>
              <div class="sb-chronicle-xp-track">
                <div class="sb-chronicle-xp-fill" style="width:${tierPct}%"></div>
              </div>
            </div>

            <div class="sb-chronicle-grid">
              <div class="sb-chronicle-stat tone-rose" data-stat="days">
                <img class="sb-chronicle-stat-ico" src="/assets/ui/icon_pet_bond.png" alt="" />
                <div class="sb-chronicle-stat-meta">
                  <div class="sb-chronicle-stat-val">${streak} ${streak === 1 ? 'Day' : 'Days'}</div>
                  <div class="sb-chronicle-stat-lbl">Days Together</div>
                  <div class="sb-chronicle-stat-sub">${coupleSinceLabel ? `Since ${coupleSinceLabel} 💖` : `Best Streak: ${bestStreak}d 🔥`}</div>
                </div>
              </div>

              <div class="sb-chronicle-stat tone-sky ${isPartnerCallLive ? 'is-live' : ''}" data-stat="calls">
                <img class="sb-chronicle-stat-ico" src="/assets/ui/icon_couple_call_talk.png" alt="" />
                <div class="sb-chronicle-stat-meta">
                  <div class="sb-chronicle-stat-val">
                    ${fmtCallDuration}
                    ${isPartnerCallLive ? '<span class="sb-chronicle-live-tag">LIVE</span>' : ''}
                  </div>
                  <div class="sb-chronicle-stat-lbl">Voice Talk Time</div>
                  <div class="sb-chronicle-stat-sub">${callSessions} ${callSessions === 1 ? 'Call' : 'Calls'} • +${fmtCompact(callDiamonds)} 💎</div>
                </div>
              </div>

              <div class="sb-chronicle-stat tone-mint" data-stat="blessings">
                <img class="sb-chronicle-stat-ico" src="/assets/ui/icon_couple_bless_can.png" alt="" />
                <div class="sb-chronicle-stat-meta">
                  <div class="sb-chronicle-stat-val">${blessingsShared}×</div>
                  <div class="sb-chronicle-stat-lbl">Land Blessings</div>
                  <div class="sb-chronicle-stat-sub">Sanctuary &amp; Care</div>
                </div>
              </div>

              <div class="sb-chronicle-stat tone-gold" data-stat="gifts">
                <img class="sb-chronicle-stat-ico" src="/assets/ui/item_gift_box.png" alt="" />
                <div class="sb-chronicle-stat-meta">
                  <div class="sb-chronicle-stat-val">${giftsExchanged} Sent</div>
                  <div class="sb-chronicle-stat-lbl">Owl Love Parcels</div>
                  <div class="sb-chronicle-stat-sub">Gifts &amp; Envelopes</div>
                </div>
              </div>

              <div class="sb-chronicle-stat tone-pink" data-stat="moments">
                <img class="sb-chronicle-stat-ico" src="/assets/ui/icon_couple_moments.png" alt="" />
                <div class="sb-chronicle-stat-meta">
                  <div class="sb-chronicle-stat-val">${momentsCaptured}×</div>
                  <div class="sb-chronicle-stat-lbl">Sweet Moments</div>
                  <div class="sb-chronicle-stat-sub">Hugs &amp; Polaroids</div>
                </div>
              </div>

              <div class="sb-chronicle-stat tone-amber" data-stat="coop">
                <img class="sb-chronicle-stat-ico" src="/assets/ui/stage_couple_nest.png" alt="" />
                <div class="sb-chronicle-stat-meta">
                  <div class="sb-chronicle-stat-val">${coopActivities}×</div>
                  <div class="sb-chronicle-stat-lbl">Co-Op Dates</div>
                  <div class="sb-chronicle-stat-sub">Flights, Fish &amp; Pets</div>
                </div>
              </div>
            </div>

            ${(() => {
              const coupleAlbum = Array.isArray(dir?.coupleAlbum)
                ? dir.coupleAlbum
                : (Array.isArray(p.couple_album) ? p.couple_album : []);
              if (!coupleAlbum.length) {
                return `
                  <div class="sb-chronicle-album-empty">
                    <span>📸 No Polaroids in your scrapbook yet — tap <b>Snap Polaroid</b> to pose together, add stickers &amp; save keepsake photos!</span>
                  </div>
                `;
              }
              return `
                <div class="sb-chronicle-album">
                  <div class="sb-chronicle-album-head">
                    <span>🖼️ <b>Shared Polaroid Scrapbook</b> (${coupleAlbum.length}/12)</span>
                    <small>Tap any Polaroid to view &amp; save PNG</small>
                  </div>
                  <div class="sb-chronicle-album-strip">
                    ${coupleAlbum.map((ph) => `
                      <div class="sb-album-polaroid-item" data-sb-act="view-album-photo" data-photo-id="${escapeHtml(ph.id)}" title="${escapeHtml(ph.caption || 'Sweet Memory')}">
                        <button type="button" class="sb-album-del-btn" data-sb-act="delete-album-photo" data-photo-id="${escapeHtml(ph.id)}" title="Remove from Scrapbook">✕</button>
                        <div class="sb-album-polaroid-img-wrap">
                          ${ph.thumbDataUrl
                            ? `<img src="${ph.thumbDataUrl}" alt="${escapeHtml(ph.caption || 'Polaroid')}" loading="lazy" />`
                            : `<div class="sb-album-polaroid-placeholder">📸</div>`}
                        </div>
                        <div class="sb-album-polaroid-cap">${escapeHtml(ph.caption || 'Sweet Memory 💖')}</div>
                      </div>
                    `).join('')}
                  </div>
                </div>
              `;
            })()}

            <div class="sb-chronicle-footer">
              <span class="sb-chronicle-chapter">📖 Day ${streak}${coupleSinceLabel ? ` (Since ${coupleSinceLabel})` : ''}: <b>${escapeHtml(myName)} &amp; ${escapeHtml(partnerVis.name)}'s Sanctuary</b></span>
              <button type="button" class="sb-chronicle-polaroid-btn" data-sb-act="couple-polaroid">
                📸 Snap Polaroid
              </button>
            </div>
          </div>
        `;

        const breakConfirmHtml = this.confirmBreakOpen ? `
          <div class="sb-break-confirm-card">
            <div class="sb-break-confirm-title">🌙 Take a Gentle Break with ${escapeHtml(partnerVis.name)}?</div>
            <div class="sb-break-confirm-desc">
              Taking a break transitions your shared <b>Twin Sky-Islands</b> back to solo islands. You will stay on each other's Friends list, and your <b>💖 ${streak}-Day Couple Streak</b> plus your entire <b>📖 Love Chronicle</b> will be safely remembered if you re-bind later.
            </div>
            <div class="sb-break-confirm-actions">
              <button type="button" class="sb-action-tile is-wood" data-sb-act="cancel-break">💞 Stay Together</button>
              <button type="button" class="sb-action-tile is-danger" data-sb-act="confirm-break">🌙 Confirm Take a Break</button>
            </div>
          </div>
        ` : `
          <div class="sb-couple-status-strip">
            <div class="sb-couple-status-info">
              <span>🏡 <b>Twin Sky-Islands Active</b> (+25% Couple Yield)</span>
              <small>📍 ${escapeHtml(partnerVis.name)}: ${escapeHtml(partnerVis.status)}</small>
            </div>
            <button type="button" class="sb-take-break-btn" data-sb-act="prompt-break">
              🌙 Take a Break
            </button>
          </div>
        `;

        tabBodyHtml = `
          <!-- Framed Couple Sanctuary Stage Card -->
          <div class="sb-sanctuary-stage sb-m18-balcony-stage">
            <div class="sb-m18-halo-banner">
              <span>💖 ${streak}-Day Couple Streak • +25% Yield</span>
            </div>

            <div class="sb-couple-avatars sb-m18-balcony-actors">
              <img class="sb-stage-pet left" src="${escapeHtml(myPetUrl)}" alt="My Pet" />
              <div class="sb-couple-col self">
                <div class="sb-floating-name">${escapeHtml(myName)}</div>
                <div class="sb-couple-chibi full-figure">${myChibiHtml}</div>
              </div>
              <div class="sb-couple-heart-bridge">
                <button type="button" class="sb-heart-hands-badge" data-sb-act="couple-polaroid" title="Open Sanctuary Polaroid Studio" style="cursor:pointer;">📸💞</button>
              </div>
              <div class="sb-couple-col partner">
                <div class="sb-floating-name">${escapeHtml(partnerVis.name)}</div>
                <div class="sb-couple-chibi full-figure">${partnerChibiHtml}</div>
              </div>
              <img class="sb-stage-pet right" src="${escapeHtml(partnerVis.petSprite)}" alt="Partner Pet" />
            </div>

            <div class="sb-stage-location-pill">
              ${partnerVis.online ? '🟢' : '⚪'} ${escapeHtml(partnerVis.name)} is ${escapeHtml(partnerVis.status)}
            </div>
          </div>

          <!-- Clean 2x2 Couple Action Grid -->
          <div class="sb-couple-action-grid">
            <button type="button" class="sb-action-tile is-gold" data-sb-act="visit-partner">
              <span class="sb-tile-ico"><img class="sb-tile-ico-img" src="/assets/ui/nav_ico_village.png" alt="" /></span>
              <span class="sb-tile-txt">
                <b>Visit Partner Isle</b>
                <small>Teleport to Sanctuary</small>
              </span>
            </button>
            <button type="button" class="sb-action-tile is-sky" data-sb-act="bless-partner" ${partnerVis.blessedToday ? 'disabled' : ''}>
              <span class="sb-tile-ico"><img class="sb-tile-ico-img" src="/assets/ui/icon_couple_bless_can.png" alt="" /></span>
              <span class="sb-tile-txt">
                <b>${partnerVis.blessedToday ? 'Blessed Today ✓' : 'Bless Partner Land'}</b>
                <small>+15% Yield &amp; +50 🪙</small>
              </span>
            </button>
            <button type="button" class="sb-action-tile is-wood" data-sb-act="gift-partner">
              <span class="sb-tile-ico"><img class="sb-tile-ico-img" src="/assets/ui/item_gift_box.png" alt="" /></span>
              <span class="sb-tile-txt">
                <b>Send Owl Gift</b>
                <small>50% Off Couple Postage</small>
              </span>
            </button>
            <button type="button" class="sb-action-tile is-pink" data-sb-act="couple-sync-pose">
              <span class="sb-tile-ico"><img class="sb-tile-ico-img" src="/assets/ui/icon_couple_moments.png" alt="" /></span>
              <span class="sb-tile-txt">
                <b>Couple Sync Pose</b>
                <small>Heart Emote &amp; +25% Buff</small>
              </span>
            </button>
          </div>

          <!-- Our Love Chronicle (Accumulated Couple Stats Scrapbook) -->
          ${chronicleHtml}

          <!-- Gentle Take a Break / Sanctuary Status Strip -->
          ${breakConfirmHtml}
        `;
      } else {
        // ---------------- SINGLE STATE (No Bound Partner) ----------------
        const incomingProposalsHtml = coupleRequestsIn.length ? `
          <div class="sb-section-card sb-proposal-alert">
            <div class="sb-section-head">💌 Incoming Couple Proposals (${coupleRequestsIn.length})</div>
            <div class="sb-contacts-list">
              ${coupleRequestsIn.map((req) => {
                const u = resolvePeerVisual(req.from, req.fromName, req.user);
                const uThumb = renderOutfitThumbLayers(u.outfit, { lineage: u.lineage, appearance: u.appearance, alt: u.name });
                const savedDays = req.savedStreak || pastStreaks[u.id] || 0;
                return `
                  <div class="sb-contact-row is-partner" data-proposal-from="${escapeHtml(u.id)}">
                    <div class="sb-contact-avatar">${uThumb}</div>
                    <div class="sb-contact-meta">
                      <div class="sb-contact-name"><b>${escapeHtml(u.name)}</b> <small>Lv.${u.level}</small></div>
                      <div class="sb-contact-status">
                        💞 Wants to bind Twin Sky-Islands!
                        ${savedDays > 0 ? `<span class="sb-saved-streak-pill">💖 Restores ${savedDays}d</span>` : ''}
                      </div>
                    </div>
                    <div class="sb-contact-actions">
                      <button type="button" class="sb-pill-act is-green" data-sb-act="couple-accept" data-user-id="${escapeHtml(u.id)}">💞 Accept</button>
                      <button type="button" class="sb-pill-act is-wood" data-sb-act="couple-decline" data-user-id="${escapeHtml(u.id)}">✕</button>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        ` : '';

        const outgoingProposalHtml = coupleRequestOut ? `
          <div class="sb-outgoing-banner">
            <span>💌 Pending Proposal sent to <b>${escapeHtml(coupleRequestOut)}</b></span>
            <button type="button" class="sb-mini-cancel-btn" data-sb-act="couple-cancel" data-user-id="${escapeHtml(coupleRequestOut)}">✕ Cancel</button>
          </div>
        ` : '';

        const eligibleFriendsHtml = friendsList.length ? `
          <div class="sb-contacts-list">
            ${friendsList.map((f) => {
              const fThumb = renderOutfitThumbLayers(f.outfit, { lineage: f.lineage, appearance: f.appearance, alt: f.name });
              const savedDays = pastStreaks[f.id] || 0;
              const busyPartner = f.partnerId && f.partnerId !== myId && !f.isBot;
              const isPendingOut = coupleRequestOut && coupleRequestOut.toLowerCase() === f.id.toLowerCase();
              return `
                <div class="sb-contact-row" data-propose-row="${escapeHtml(f.id)}">
                  <span class="sb-online-dot ${f.online ? 'is-online' : 'is-offline'}"></span>
                  <div class="sb-contact-avatar">${fThumb}</div>
                  <div class="sb-contact-meta">
                    <div class="sb-contact-name">
                      <b>${escapeHtml(f.name)}</b> <small>Lv.${f.level}</small>
                      ${savedDays > 0 ? `<span class="sb-saved-streak-pill">💖 ${savedDays}d Saved</span>` : ''}
                    </div>
                    <div class="sb-contact-status">
                      ${busyPartner ? `Bound with ${escapeHtml(f.partnerId)}` : `📍 ${escapeHtml(f.status)}`}
                    </div>
                  </div>
                  <div class="sb-contact-actions">
                    ${isPendingOut
                      ? `<button type="button" class="sb-pill-act is-wood" data-sb-act="couple-cancel" data-user-id="${escapeHtml(f.id)}">⏳ Cancel</button>`
                      : `<button type="button" class="sb-pill-act is-pink" data-sb-act="couple-propose" data-user-id="${escapeHtml(f.id)}" ${busyPartner ? 'disabled' : ''}>
                          💞 ${savedDays > 0 ? 'Re-Bind' : 'Propose'}
                        </button>`
                    }
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        ` : `
          <div class="sb-empty-card">
            <div>🤝 Add a friend first to propose a Couple Sanctuary bond!</div>
            <button type="button" class="btn-gold small" data-sb-tab="friends" style="margin-top:6px;">🤝 Go to Friends Tab</button>
          </div>
        `;

        tabBodyHtml = `
          <div class="sb-sanctuary-stage sb-m18-balcony-stage is-single-stage">
            <div class="sb-m18-halo-banner">
              <span>🌟 Single Sky Sanctuary</span>
            </div>
            <div class="sb-couple-avatars sb-m18-balcony-actors">
              <img class="sb-stage-pet left" src="${escapeHtml(myPetUrl)}" alt="My Pet" />
              <div class="sb-couple-col self">
                <div class="sb-floating-name">${escapeHtml(myName)}</div>
                <div class="sb-couple-chibi full-figure">${myChibiHtml}</div>
              </div>
              <div class="sb-couple-heart-bridge">
                <div class="sb-heart-hands-badge">✨💞</div>
              </div>
              <div class="sb-couple-col partner is-empty-slot">
                <div class="sb-floating-name">Invite Partner</div>
                <div class="sb-empty-partner-silhouette">💞</div>
              </div>
            </div>
            <div class="sb-single-perks-banner">
              🏡 Bind with a Friend for <b>Twin Sky-Islands</b>, <b>+25% Yield</b>, <b>Free 1-on-1 Calls</b> &amp; <b>50% Off Owl Postage</b>!
            </div>
          </div>

          ${incomingProposalsHtml}
          ${outgoingProposalHtml}

          <div class="sb-section-card">
            <div class="sb-section-head">💞 Propose Couple Sanctuary to a Friend</div>
            ${eligibleFriendsHtml}
          </div>
        `;
      }
    } else if (curTab === 'vip') {
      // =========================================================================
      // TAB 3: 🎟️ VIP CALL CARDS (Unified Royal Parchment Cards)
      // =========================================================================
      tabBodyHtml = `
        <div class="sb-section-card">
          <div class="sb-section-head">
            <span>🎟️ Your Tele-Link &amp; VIP Call Passes</span>
            <small>20 💎 / 15m Voice Rewards</small>
          </div>
          <div class="sb-vip-grid">
            <div class="sb-vip-Status-item ${vip.call_until > Date.now() ? 'is-active' : ''}">
              <img src="/assets/ui/item_ticket_standard.png" alt="" />
              <div>
                <div class="sb-vip-name">Sky Call Day-Pass</div>
                <div class="sb-vip-sub">${vip.call_until > Date.now() ? 'Active Pass ✅' : `300 💎 • In Bag: x${bag.vip_call_day_pass | 0}`}</div>
              </div>
            </div>
            <div class="sb-vip-Status-item ${vip.communicator ? 'is-active' : ''}">
              <img src="/assets/ui/item_vip_communicator.png" alt="" />
              <div>
                <div class="sb-vip-name">📱 VIP Communicator</div>
                <div class="sb-vip-sub">${vip.communicator ? 'Permanent Active ✅' : `2,500 💎 • In Bag: x${bag.vip_communicator | 0}`}</div>
              </div>
            </div>
            <div class="sb-vip-Status-item ${(vip.telelinks || []).length ? 'is-active' : ''}">
              <img src="/assets/ui/vip_card_telelink.png" alt="" />
              <div>
                <div class="sb-vip-name">💖 Tele-Link Couple Box</div>
                <div class="sb-vip-sub">${(vip.telelinks || []).length ? `Linked (${vip.telelinks.join(', ')}) ✅` : `4,500 💎 • In Bag: x${bag.vip_telelink_box | 0}`}</div>
              </div>
            </div>
            <div class="sb-vip-Status-item ${vip.black ? 'is-active' : ''}">
              <img src="/assets/ui/vip_card_black_sovereign.png" alt="" />
              <div>
                <div class="sb-vip-name">👑 Sovereign Black VIP</div>
                <div class="sb-vip-sub">${vip.black ? 'Sovereign Active (+30💎/15m) ✅' : `9,900 💎 • In Bag: x${bag.vip_black | 0}`}</div>
              </div>
            </div>
          </div>
          <div class="sb-vip-footer">
            <button type="button" class="btn-gold small" data-sb-act="open-vip-bag">🎒 Open Royal Bag &amp; VIP Card Shop</button>
          </div>
        </div>
      `;
    } else {
      // =========================================================================
      // TAB 2: 🤝 FRIENDS DIRECTORY (Add Friend, Incoming Requests, Live Friends, Suggested Citizens)
      // =========================================================================
      const incomingReqsHtml = friendRequestsIn.length ? `
        <div class="sb-section-card sb-friend-req-box">
          <div class="sb-section-head">📨 Incoming Friend Requests (${friendRequestsIn.length})</div>
          <div class="sb-contacts-list">
            ${friendRequestsIn.map((req) => {
              const u = resolvePeerVisual(req.from, req.fromName, req.user);
              const uThumb = renderOutfitThumbLayers(u.outfit, { lineage: u.lineage, appearance: u.appearance, alt: u.name });
              return `
                <div class="sb-contact-row" data-friend-req-from="${escapeHtml(u.id)}">
                  <span class="sb-online-dot ${u.online ? 'is-online' : 'is-offline'}"></span>
                  <div class="sb-contact-avatar">${uThumb}</div>
                  <div class="sb-contact-meta">
                    <div class="sb-contact-name"><b>${escapeHtml(u.name)}</b> <small>Lv.${u.level}</small></div>
                    <div class="sb-contact-status">Sent you a friend request!</div>
                  </div>
                  <div class="sb-contact-actions">
                    <button type="button" class="sb-pill-act is-green" data-sb-act="friend-accept" data-user-id="${escapeHtml(u.id)}">✓ Accept</button>
                    <button type="button" class="sb-pill-act is-wood" data-sb-act="friend-decline" data-user-id="${escapeHtml(u.id)}">✕</button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      ` : '';

      const friendsRowsHtml = friendsList.length ? friendsList.map((c) => {
        const cThumb = renderOutfitThumbLayers(c.outfit, {
          lineage: c.lineage,
          appearance: c.appearance,
          alt: c.name,
        });
        const isBoundPartner = isCoupled && c.id === partnerId;
        const isConfirmingRemove = this.confirmRemoveFriendId === c.id;

        const actionsStripHtml = isConfirmingRemove ? `
          <div class="sb-friend-confirm-bar">
            <span>Remove <b>${escapeHtml(c.name)}</b> from friends?</span>
            <div class="sb-friend-confirm-btns">
              <button type="button" class="sb-pill-act is-wood" data-sb-act="cancel-remove-friend">↩ Keep</button>
              <button type="button" class="sb-pill-act is-red" data-sb-act="friend-remove" data-user-id="${escapeHtml(c.id)}">🗑️ Remove</button>
            </div>
          </div>
        ` : `
          <div class="sb-friend-action-strip">
            <button type="button" class="sb-pill-act is-wood" data-sb-act="visit-user" data-user-id="${escapeHtml(c.id)}">🏠 Visit</button>
            <button type="button" class="sb-pill-act is-sky" data-sb-act="bless-friend" data-user-id="${escapeHtml(c.id)}" ${c.blessedToday ? 'disabled' : ''}>
              💧 ${c.blessedToday ? 'Blessed' : 'Bless'}
            </button>
            <button type="button" class="sb-pill-act is-wood" data-sb-act="gift-user" data-user-id="${escapeHtml(c.id)}">🎁 Gift</button>
            <button type="button" class="sb-pill-act is-green" data-sb-act="call-user" data-user-id="${escapeHtml(c.id)}">📞 Call</button>
          </div>
        `;

        return `
          <div class="sb-friend-card ${isBoundPartner ? 'is-partner' : ''}" data-contact-id="${escapeHtml(c.id)}">
            <div class="sb-friend-card-top">
              <span class="sb-online-dot ${c.online ? 'is-online' : 'is-offline'}" aria-hidden="true"></span>
              <div class="sb-contact-avatar">${cThumb}</div>
              <div class="sb-contact-meta">
                <div class="sb-contact-name">
                  <b>${escapeHtml(c.name)}</b> <small>Lv.${c.level}</small>
                  ${isBoundPartner ? '<span class="sb-partner-tag">💞 Partner</span>' : ''}
                </div>
                <div class="sb-contact-status">${c.online ? '🟢' : '⚪'} ${escapeHtml(c.status)}</div>
              </div>
              ${!isBoundPartner ? `
                <button type="button" class="sb-friend-del-btn" data-sb-act="prompt-remove-friend" data-user-id="${escapeHtml(c.id)}" title="Remove Friend">✕</button>
              ` : ''}
            </div>
            ${actionsStripHtml}
          </div>
        `;
      }).join('') : `
        <div class="sb-empty-card">No friends in your list yet. Add a friend above or from Suggested Citizens below!</div>
      `;

      const discoverHtml = discoverPlayers.length ? `
        <div class="sb-section-card sb-discover-card">
          <div class="sb-section-head">🌟 Suggested Citizens &amp; Players</div>
          <div class="sb-contacts-list">
            ${discoverPlayers.map((d) => {
              const u = resolvePeerVisual(d.id, d.username, d);
              const uThumb = renderOutfitThumbLayers(u.outfit, { lineage: u.lineage, appearance: u.appearance, alt: u.name });
              const reqPending = d.requestSent || friendRequestsOut.some((x) => x.toLowerCase() === u.id.toLowerCase());
              return `
                <div class="sb-contact-row is-discover" data-discover-id="${escapeHtml(u.id)}">
                  <span class="sb-online-dot ${u.online ? 'is-online' : 'is-offline'}"></span>
                  <div class="sb-contact-avatar">${uThumb}</div>
                  <div class="sb-contact-meta">
                    <div class="sb-contact-name">
                      <b>${escapeHtml(u.name)}</b> <small>Lv.${u.level}</small>
                      ${d.is_bot ? '<span class="sb-citizen-tag">🏛️ Citizen</span>' : ''}
                    </div>
                    <div class="sb-contact-status">📍 ${escapeHtml(u.status)}</div>
                  </div>
                  <div class="sb-contact-actions">
                    ${reqPending
                      ? `<button type="button" class="sb-pill-act is-wood" data-sb-act="friend-decline" data-user-id="${escapeHtml(u.id)}">⏳ Sent</button>`
                      : `<button type="button" class="sb-pill-act is-green" data-sb-act="friend-send" data-user-id="${escapeHtml(u.id)}">➕ Add</button>`
                    }
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      ` : '';

      tabBodyHtml = `
        <!-- Add Friend by Username Bar -->
        <div class="sb-add-friend-bar">
          <input
            type="text"
            id="sb-friend-input"
            class="rpg-input sb-friend-input"
            value="${escapeHtml(this.friendSearchDraft)}"
            placeholder="Add friend by username (e.g. leo, aria, mochi)..."
            maxlength="24"
          />
          <button type="button" class="btn-gold small sb-add-friend-btn" data-sb-act="friend-send-input">
            ➕ Add
          </button>
        </div>

        ${incomingReqsHtml}

        <!-- Friends List -->
        <div class="sb-section-card">
          <div class="sb-section-head">
            <span>🤝 Your Friends (${friendsList.length}/200)</span>
            <small>${onlineFriendsCount} Online</small>
          </div>
          <div class="sb-contacts-list">
            ${friendsRowsHtml}
          </div>
        </div>

        ${discoverHtml}
      `;
    }

    this.switchboardEl.innerHTML = `
      <section class="parchment social-switchboard-card is-unified-parchment" role="dialog" aria-label="Couple & Call Hub">
        ${topBarHtml}
        ${callBarHtml}
        ${tabsBarHtml}
        <div class="sb-hub-scroll-body">
          ${tabBodyHtml}
        </div>
      </section>
    `;
  }

  // --------------------------------------------------------------------------- UI Updates (Screen 25 Top)
  showIncomingBanner({ from, fromName, vip }) {
    if (!this.bannerEl) return;
    const name = fromName || this.getUserName(from) || from || 'Partner';
    const vis = resolvePeerVisual(from, name);
    const portraitHtml = renderOutfitThumbLayers(vis.outfit, {
      lineage: vis.lineage,
      appearance: vis.appearance,
      alt: name,
    });
    this.bannerEl.innerHTML = `
      <div class="incoming-call-avatar-wrap">
        <div class="incoming-call-avatar">
          ${portraitHtml}
        </div>
        <span class="incoming-call-vip-tag">${vip ? 'VIP Communicator' : 'Couple Tele-Link'}</span>
      </div>
      <div class="incoming-call-info">
        <span class="incoming-call-title">Incoming 1-on-1 Voice Call from 💞 <b>${escapeHtml(name)}</b> (Bound Partner)!</span>
        <span class="incoming-call-duck-pill">🔊 Crystal Voice • Auto-Duck Game Audio 40%</span>
        <span class="incoming-call-sub">💎 Earn +20 Diamonds every 15m of Couple Talk!</span>
      </div>
      <div class="incoming-call-actions">
        <button type="button" class="incoming-call-btn accept" data-call="accept" data-act="call-accept">📞 Accept &amp; Unmute</button>
        <button type="button" class="incoming-call-btn decline" data-call="decline" data-act="call-decline">Busy</button>
      </div>`;
    this.bannerEl.hidden = Boolean(this.switchboardOpen);
  }

  hideIncomingBanner() {
    if (this.bannerEl) this.bannerEl.hidden = true;
  }

  showInCallPill() {
    if (!this.pillEl) return;
    const name = this.peerName || this.getUserName(this.peerId) || this.peerId || 'Partner';
    this.pillEl.innerHTML = `
      <div class="voice-waveform-bars" aria-hidden="true">
        <span class="wave-bar"></span>
        <span class="wave-bar"></span>
        <span class="wave-bar"></span>
        <span class="wave-bar"></span>
      </div>
      <span class="voice-call-status">
        <span class="voice-peer-name">${escapeHtml(name)}</span> •
        <span id="voice-call-timer" class="voice-call-timer">00:00</span>
      </span>
      <span class="voice-call-reward">+<span class="voice-diamonds">${this.diamondsEarned}</span> 💎</span>
      <div class="voice-call-actions">
        <button type="button" class="voice-pill-btn mute" data-call="mute" data-act="call-mute" title="Mute / Unmute">${this.isMuted ? '🔇' : '🎙️'}</button>
        <button type="button" class="voice-pill-btn heal" data-call="heal" data-act="call-heal" title="Reconnect Audio Line">🔄</button>
        <button type="button" class="voice-pill-btn switchboard" data-call="switchboard" data-act="call-switchboard" title="Open Voice Switchboard">🎛️</button>
        <button type="button" class="voice-pill-btn hangup" data-call="hangup" data-act="call-hangup" title="End Call">📴</button>
      </div>`;
    this.pillEl.dataset.speaking = '';
    this.pillEl.hidden = Boolean(this.switchboardOpen);

    if (!this.timerInterval) {
      this.timerInterval = setInterval(() => this.updateTimer(), 1000);
    }
    if (this.switchboardOpen) this.renderSwitchboard();
  }

  hideInCallPill() {
    if (this.pillEl) {
      this.pillEl.hidden = true;
      this.pillEl.dataset.speaking = '';
    }
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    if (this.switchboardOpen) this.renderSwitchboard();
  }

  updateTimer() {
    if (!this.startedAt) return;
    const elapsedSec = Math.floor(Math.max(0, Date.now() - this.startedAt) / 1000);
    const mm = String(Math.floor(elapsedSec / 60)).padStart(2, '0');
    const ss = String(elapsedSec % 60).padStart(2, '0');
    if (this.pillEl) {
      const timerSpan = this.pillEl.querySelector('.voice-call-timer');
      if (timerSpan) timerSpan.textContent = `${mm}:${ss}`;
    }
    if (this.switchboardEl && this.switchboardOpen) {
      const sbTimer = this.switchboardEl.querySelector('.sb-callbar-timer');
      if (sbTimer) sbTimer.textContent = `${mm}:${ss}`;
    }
  }

  updateDiamonds() {
    if (!this.pillEl) return;
    const diamSpan = this.pillEl.querySelector('.voice-diamonds');
    if (diamSpan) diamSpan.textContent = String(this.diamondsEarned);
    if (this.switchboardOpen) this.renderSwitchboard();
  }

  // --------------------------------------------------------------------------- Actions
  async startCall(userId) {
    return this.call(userId);
  }

  async call(userId) {
    if (!this.isSupported) {
      this.toast('Voice calls not supported');
      return;
    }
    // If already connected to this exact user, heal/reconnect in-place instead of dropping
    if (this._state === 'connected' && this.peerId === userId && this.callId) {
      this.healCall('manual');
      return;
    }
    this._state = 'calling';
    this.peerId = userId;
    this.peerName = this.getUserName(userId);
    this.diamondsEarned = 0;

    await this.ensureLocalMedia();
    this.net.send({ type: 'call_invite', to: userId });
  }

  async accept() {
    if (!this.callId) return;
    if (!this.isSupported) {
      this.toast('Voice calls not supported');
      return;
    }
    this.hideIncomingBanner();
    await this.ensureLocalMedia();
    this.net.send({ type: 'call_accept', callId: this.callId });
  }

  decline() {
    if (this.callId) {
      this.net.send({ type: 'call_decline', callId: this.callId });
    }
    this.cleanup();
  }

  hangup() {
    if (this.callId) {
      this.net.send({ type: 'call_hangup', callId: this.callId });
    }
    this.cleanup();
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !this.isMuted;
      });
    }
    if (this.pillEl) {
      const muteBtn = this.pillEl.querySelector('[data-call="mute"]');
      if (muteBtn) muteBtn.textContent = this.isMuted ? '🔇' : '🎙️';
    }
    return this.isMuted;
  }

  /**
   * Triggers a coordinated two-sided WebRTC rebuild via the signaling server
   * (or local fresh ICE restart fallback) without refreshing the browser.
   */
  healCall(reason = 'auto') {
    if (this._state !== 'connected' || !this.callId) return;
    this.reconnecting = true;
    if (reason === 'manual') {
      this.toast('🔄 Reconnecting crystal voice line…');
    }
    if (!this._isLocalMicHealthy()) {
      this._recoverLocalMic();
    }
    if (this.switchboardOpen) this.renderSwitchboard();
    this.net.send({ type: 'call_heal', callId: this.callId, reason });

    // Local fallback if signaling server doesn't echo call_connected within 600ms (e.g. unit test harness)
    const prevPc = this.pc;
    setTimeout(() => {
      if (this._state === 'connected' && this.pc === prevPc && prevPc) {
        this.triggerIceRestart(prevPc, { fresh: true });
      }
    }, 600);
  }

  // --------------------------------------------------------------------------- Protocol Dispatcher
  /**
   * Dispatches incoming socket packets. Returns true if consumed.
   * @param {object} msg
   * @returns {boolean}
   */
  handle(msg) {
    if (!msg || !msg.type) return false;

    switch (msg.type) {
      case 'call_incoming': {
        this.callId = msg.callId;
        this.peerId = msg.from;
        this.peerName = msg.fromName || this.getUserName(msg.from);
        this.isVip = !!msg.vip;
        this._state = 'incoming';
        this.showIncomingBanner(msg);
        if (this.switchboardOpen) this.renderSwitchboard();
        return true;
      }
      case 'call_ringing': {
        this.callId = msg.callId;
        this._state = 'calling';
        if (this.switchboardOpen) this.renderSwitchboard();
        return true;
      }
      case 'call_connected': {
        const wasReconnecting = this.reconnecting;
        const isSameCall = this.callId === msg.callId;
        if (!isSameCall) {
          this.pendingCandidates = [];
          this.pendingDescription = null;
        }
        this.callId = msg.callId;
        this.peerId = msg.peerId;
        this.peerName = this.getUserName(msg.peerId);
        this.startedAt = msg.startedAt || this.startedAt || Date.now();
        this.polite = !!msg.polite;
        this._lastIceConfig = msg.ice || this._lastIceConfig;
        this._state = 'connected';
        this.reconnecting = false;

        this.hideIncomingBanner();
        this.showInCallPill();
        this.updateTimer();

        if (!this._isLocalMicHealthy()) {
          // Close any stale pc so incoming offers buffer safely into this.pendingDescription
          // while getUserMedia resolves (max 800ms wait before fallback).
          if (this.pc) {
            try { this.pc.close(); } catch {}
            this.pc = null;
          }
          let done = false;
          const finishSetup = () => {
            if (done) return;
            done = true;
            if (this._state === 'connected') this.setupWebRTC(this._lastIceConfig);
          };
          const timer = setTimeout(finishSetup, 800);
          this.ensureLocalMedia({ force: true }).finally(() => {
            clearTimeout(timer);
            finishSetup();
          });
        } else {
          this.setupWebRTC(this._lastIceConfig);
        }

        if (msg.healed && wasReconnecting) {
          this.toast('✅ Voice line reconnected!');
        }

        if (typeof window !== 'undefined' && this.autoDuck) {
          window.dispatchEvent(new CustomEvent('voice:duck', { detail: { on: true } }));
        }
        return true;
      }
      case 'call_signal': {
        if (this.callId && msg.callId && msg.callId !== this.callId) return false;
        this.onSignal(msg.data);
        return true;
      }
      case 'call_ended': {
        const reason = msg.reason || 'hangup';
        if (reason === 'declined') this.toast('Call declined');
        else if (reason === 'no_answer') this.toast('No answer');
        else if (reason === 'grace_expired') this.toast('⚡ Connection interrupted — auto-resuming when back online');
        else if (reason === 'hangup' && this._state === 'connected') this.toast('Call ended');

        this.cleanup();
        return true;
      }
      case 'call_busy': {
        this.toast('User is busy on another call');
        this.cleanup();
        return true;
      }
      case 'call_error': {
        const err = msg.error;
        if (err === 'call_locked') this.toast('📞 Call locked: VIP Card or Partner line required');
        else if (err === 'offline') this.toast('📞 Partner is currently offline');
        else this.toast(`📞 Call failed: ${err || 'unknown'}`);
        this.cleanup();
        return true;
      }
      case 'call_reward': {
        this.diamondsEarned += (msg.diamonds || 0);
        this.updateDiamonds();
        this.toast(`+${msg.diamonds || 20} 💎 Voice Call Reward!`);
        return true;
      }
      case 'couple_interaction': {
        const sender = msg.fromName || msg.from || 'Your partner';
        if (msg.kind === 'polaroid') {
          const cap = msg.photo?.caption ? ` ("${msg.photo.caption}")` : '';
          this.toast(`📸 ${sender} snapped a Couple Polaroid${cap}! Saved to your Love Chronicle! 💖`);
        }
        this.refreshDirectory();
        return false;
      }
      case 'action_result': {
        if (msg.action === 'call_invite' && !msg.ok) {
          const err = msg.error;
          if (err === 'call_locked') this.toast('📞 Call locked: VIP Card or Partner line required');
          else if (err === 'offline') this.toast('📞 Partner is currently offline');
          else this.toast(`📞 Call failed: ${err || 'unknown'}`);
          this.cleanup();
          return true;
        }
        return false;
      }
      default:
        return false;
    }
  }

  // --------------------------------------------------------------------------- WebRTC Internals
  _isLocalMicHealthy() {
    if (!this.localStream || typeof this.localStream.getAudioTracks !== 'function') return false;
    const tracks = this.localStream.getAudioTracks();
    return tracks.length > 0 && tracks.some((t) => t.readyState !== 'ended');
  }

  async _recoverLocalMic() {
    if (this._recoveringMic) return;
    this._recoveringMic = true;
    try {
      const stream = await this.ensureLocalMedia({ force: true });
      if (stream && this.pc && this._state === 'connected') {
        const audioTrack = stream.getAudioTracks()[0];
        if (audioTrack) {
          const senders = typeof this.pc.getSenders === 'function' ? this.pc.getSenders() : [];
          const audioSender = senders.find((s) => s.track && s.track.kind === 'audio');
          if (audioSender && typeof audioSender.replaceTrack === 'function') {
            await audioSender.replaceTrack(audioTrack);
          } else if (!senders.some((s) => s.track === audioTrack)) {
            this.pc.addTrack(audioTrack, stream);
            if (!this.polite) {
              this._sendInitialOffer(this.pc);
            }
          }
        }
      }
    } catch {} finally {
      this._recoveringMic = false;
    }
  }

  async ensureLocalMedia({ force = false } = {}) {
    if (!force && this._isLocalMicHealthy()) return this.localStream;
    if (!this.isSupported) {
      this.toast('Voice calls not supported');
      return null;
    }
    try {
      if (this.localStream) {
        try {
          this.localStream.getTracks().forEach((t) => t.stop());
        } catch {}
        this.localStream = null;
      }
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      this.localStream = stream;
      stream.getAudioTracks().forEach((track) => {
        track.enabled = !this.isMuted;
        track.onended = () => {
          if (this._state === 'connected') {
            this._recoverLocalMic();
          }
        };
      });
      if (this.pc) {
        const senders = typeof this.pc.getSenders === 'function' ? this.pc.getSenders() : [];
        stream.getTracks().forEach((track) => {
          const existingAudioSender = senders.find((s) => s.track && s.track.kind === track.kind);
          if (existingAudioSender && typeof existingAudioSender.replaceTrack === 'function') {
            existingAudioSender.replaceTrack(track).catch(() => {});
          } else if (!senders.some((s) => s.track === track)) {
            this.pc.addTrack(track, stream);
          }
        });
      }
      this.setupAudioAnalysis(stream, 'local');
      return stream;
    } catch (err) {
      console.warn('Microphone permission error', err);
      this.toast('Microphone access denied or unavailable');
      return null;
    }
  }

  setupWebRTC(iceConfig, { skipInitialOffer = false } = {}) {
    if (!this.isSupported) return;

    if (this._iceHealTimer) {
      clearTimeout(this._iceHealTimer);
      this._iceHealTimer = null;
    }
    if (this._iceRebuildTimer) {
      clearTimeout(this._iceRebuildTimer);
      this._iceRebuildTimer = null;
    }
    this._stopIceRefreshTimer();
    if (this.pc) {
      try {
        this.pc.ontrack = null;
        this.pc.onnegotiationneeded = null;
        this.pc.onicecandidate = null;
        this.pc.oniceconnectionstatechange = null;
        this.pc.onconnectionstatechange = null;
        this.pc.close();
      } catch (e) {}
      this.pc = null;
    }
    this._initialNegotiationDone = false;
    this.makingOffer = false;
    this.ignoreOffer = false;
    this.isSettingRemoteAnswerPending = false;

    const defaultIce = [
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
    let iceServers = defaultIce;
    if (iceConfig) {
      if (Array.isArray(iceConfig)) iceServers = iceConfig;
      else if (iceConfig.iceServers) iceServers = iceConfig.iceServers;
      else if (iceConfig.urls) iceServers = [iceConfig];
    }

    const searchParams = typeof window !== 'undefined' && window.location?.search
      ? new URLSearchParams(window.location.search)
      : null;
    const forceRelay = searchParams && (searchParams.get('dubai') === '1' || searchParams.get('relay') === '1');
    const rtcConfig = { iceServers };
    if (forceRelay) rtcConfig.iceTransportPolicy = 'relay';

    const pc = new window.RTCPeerConnection(rtcConfig);
    this.pc = pc;

    pc.ontrack = (event) => {
      let stream = (event.streams && event.streams[0]) || null;
      if (!stream && event.track && typeof MediaStream !== 'undefined') {
        stream = this.remoteStream || new MediaStream();
        if (!stream.getTracks().some((t) => t.id === event.track.id)) {
          stream.addTrack(event.track);
        }
      }
      this.remoteStream = stream;
      if (this.remoteAudio && stream) {
        if (this.remoteAudio.srcObject !== stream) {
          this.remoteAudio.srcObject = stream;
        }
        this.remoteAudio.volume = 1.0;
        this.remoteAudio.play().catch(() => {});
      }
      if (event.track && event.track.kind === 'audio') {
        event.track.onunmute = () => {
          if (this.remoteAudio) this.remoteAudio.play().catch(() => {});
        };
      }
      if (stream) {
        this.setupAudioAnalysis(stream, 'remote');
      }
    };

    pc.onnegotiationneeded = async () => {
      // Prevent initial offer glare: on initial connection, only the caller (!this.polite)
      // sends the initial offer via _sendInitialOffer(pc).
      if (!this._initialNegotiationDone) return;
      if (this.pc !== pc) return;
      try {
        this.makingOffer = true;
        if (typeof pc.createOffer === 'function') {
          const rawOffer = await pc.createOffer({ offerToReceiveAudio: true });
          const offer = rawOffer && rawOffer.sdp
            ? { type: rawOffer.type, sdp: optimizeAudioSDP(rawOffer.sdp) }
            : rawOffer;
          await pc.setLocalDescription(offer);
        } else {
          await pc.setLocalDescription();
        }
        this.net.send({
          type: 'call_signal',
          callId: this.callId,
          data: { description: pc.localDescription },
        });
      } catch (err) {
        console.warn('VoiceCallClient negotiation error', err);
      } finally {
        this.makingOffer = false;
      }
    };

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        this.net.send({
          type: 'call_signal',
          callId: this.callId,
          data: { candidate },
        });
      }
    };

    const checkIceHealth = () => {
      if (this.pc !== pc) return;
      const state = pc.iceConnectionState || pc.connectionState;
      if (state === 'connected' || state === 'completed') {
        this.reconnecting = false;
        if (this._iceHealTimer) {
          clearTimeout(this._iceHealTimer);
          this._iceHealTimer = null;
        }
        if (this._iceRebuildTimer) {
          clearTimeout(this._iceRebuildTimer);
          this._iceRebuildTimer = null;
        }
        if (!this.polite && !this._iceRefreshInterval) {
          this._startIceRefreshTimer(pc);
        }
        if (this.switchboardOpen) this.renderSwitchboard();
      } else if (state === 'disconnected') {
        // Stage 1: Fast ICE recovery after 3.5s of disconnected state
        if (!this._iceHealTimer) {
          this._iceHealTimer = setTimeout(() => {
            this._iceHealTimer = null;
            if (this.pc === pc && (pc.iceConnectionState === 'disconnected' || pc.connectionState === 'disconnected')) {
              if (!this.polite) {
                this.triggerIceRestart(pc);
              } else {
                // Callee can now also request a coordinated server heal!
                this.healCall('callee_disconnected');
              }
            }
          }, 3500);
        }
        // Stage 2: Full RTCPeerConnection rebuild after 8s if still wedged
        if (!this._iceRebuildTimer) {
          this._iceRebuildTimer = setTimeout(() => {
            this._iceRebuildTimer = null;
            if (this.pc === pc && (pc.iceConnectionState === 'disconnected' || pc.connectionState === 'disconnected' || pc.iceConnectionState === 'failed')) {
              this.healCall('ice_stuck');
            }
          }, 8000);
        }
      } else if (state === 'failed' || pc.connectionState === 'failed') {
        if (this._iceHealTimer) {
          clearTimeout(this._iceHealTimer);
          this._iceHealTimer = null;
        }
        if (this._iceRebuildTimer) {
          clearTimeout(this._iceRebuildTimer);
          this._iceRebuildTimer = null;
        }
        this.triggerIceRestart(pc);
        this.healCall('ice_failed');
      }
    };

    pc.oniceconnectionstatechange = checkIceHealth;
    pc.onconnectionstatechange = checkIceHealth;

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => pc.addTrack(track, this.localStream));
      this.setupAudioAnalysis(this.localStream, 'local');
    }

    // If an offer arrived before setupWebRTC ran, flush it immediately!
    if (this.pendingDescription) {
      const desc = this.pendingDescription;
      this.pendingDescription = null;
      this.onSignal({ description: desc });
      return;
    }

    // Caller (!this.polite) initiates the initial WebRTC offer immediately (zero glare)
    if (!this.polite && !skipInitialOffer) {
      this._sendInitialOffer(pc);
    }
  }

  async _sendInitialOffer(pc = this.pc, { fresh = false } = {}) {
    if (!pc || this.pc !== pc) return;
    try {
      this.makingOffer = true;
      if (typeof pc.createOffer === 'function') {
        const rawOffer = await pc.createOffer({ offerToReceiveAudio: true });
        const offer = rawOffer && rawOffer.sdp
          ? { type: rawOffer.type, sdp: optimizeAudioSDP(rawOffer.sdp) }
          : rawOffer;
        await pc.setLocalDescription(offer);
      } else {
        await pc.setLocalDescription();
      }
      this.net.send({
        type: 'call_signal',
        callId: this.callId,
        data: { description: pc.localDescription, ...(fresh ? { fresh: true } : {}) },
      });
    } catch (err) {
      console.warn('VoiceCallClient initial offer error', err);
    } finally {
      this.makingOffer = false;
    }
  }

  _startIceRefreshTimer(pc = this.pc) {
    this._stopIceRefreshTimer();
    // 24-minute silent ICE restart scheduler (resets du 28-30 min DPI timer in Dubai)
    const TWENTY_FOUR_MINUTES = 24 * 60 * 1000;
    this._iceRefreshInterval = setInterval(() => {
      if (this._state === 'connected' && this.pc === pc && !this.polite) {
        this.triggerIceRestart(pc);
      }
    }, TWENTY_FOUR_MINUTES);
  }

  _stopIceRefreshTimer() {
    if (this._iceRefreshInterval) {
      clearInterval(this._iceRefreshInterval);
      this._iceRefreshInterval = null;
    }
  }

  async triggerIceRestart(pc = this.pc, { fresh = false } = {}) {
    if (!pc || this._state !== 'connected') return;
    if (pc.signalingState === 'closed') {
      this.setupWebRTC(this._lastIceConfig);
      return;
    }
    try {
      if (typeof pc.restartIce === 'function') pc.restartIce();
      if (!this.polite && typeof pc.createOffer === 'function') {
        this.makingOffer = true;
        const rawOffer = await pc.createOffer({ iceRestart: true, offerToReceiveAudio: true });
        const offer = rawOffer && rawOffer.sdp
          ? { type: rawOffer.type, sdp: optimizeAudioSDP(rawOffer.sdp) }
          : rawOffer;
        await pc.setLocalDescription(offer);
        this.net.send({
          type: 'call_signal',
          callId: this.callId,
          data: { description: pc.localDescription, ...(fresh ? { fresh: true } : {}) },
        });
      }
    } catch (e) {
      console.warn('ICE restart error', e);
    } finally {
      this.makingOffer = false;
    }
  }

  async _flushPendingCandidates() {
    if (!this.pc || !this.pc.remoteDescription || !this.pendingCandidates.length) return;
    const queued = this.pendingCandidates;
    this.pendingCandidates = [];
    for (const c of queued) {
      try {
        await this.pc.addIceCandidate(c);
      } catch {}
    }
  }

  async onSignal(data) {
    if (!data) return;
    const { description, candidate, fresh } = data;
    if (!this.pc) {
      if (description) this.pendingDescription = description;
      if (candidate) this.pendingCandidates.push(candidate);
      return;
    }
    try {
      if (description) {
        // If the remote peer forced a fresh RTCPeerConnection rebuild, recreate ours first
        if (fresh && description.type === 'offer') {
          this.setupWebRTC(this._lastIceConfig, { skipInitialOffer: true });
        }

        // Prevent InvalidStateError ("Called in wrong state: stable") on duplicate/stale answers
        if (
          description.type === 'answer' &&
          this.pc.signalingState &&
          this.pc.signalingState !== 'have-local-offer' &&
          this.pc.signalingState !== 'have-remote-pranswer'
        ) {
          await this._flushPendingCandidates();
          return;
        }

        const readyForOffer = !this.makingOffer &&
          (this.pc.signalingState === 'stable' || this.isSettingRemoteAnswerPending);
        const offerCollision = description.type === 'offer' && !readyForOffer;
        this.ignoreOffer = !this.polite && offerCollision;
        if (this.ignoreOffer) return;

        if (this.polite && offerCollision) {
          try {
            await this.pc.setLocalDescription({ type: 'rollback' });
          } catch {}
        }

        this.isSettingRemoteAnswerPending = description.type === 'answer';
        await this.pc.setRemoteDescription(description);
        this.isSettingRemoteAnswerPending = false;
        await this._flushPendingCandidates();

        if (description.type === 'offer') {
          if (typeof this.pc.createAnswer === 'function') {
            const rawAnswer = await this.pc.createAnswer();
            const answer = rawAnswer && rawAnswer.sdp
              ? { type: rawAnswer.type, sdp: optimizeAudioSDP(rawAnswer.sdp) }
              : rawAnswer;
            await this.pc.setLocalDescription(answer);
          } else {
            await this.pc.setLocalDescription();
          }
          this._initialNegotiationDone = true;
          this.net.send({
            type: 'call_signal',
            callId: this.callId,
            data: { description: this.pc.localDescription },
          });
        } else if (description.type === 'answer') {
          this._initialNegotiationDone = true;
        }
      } else if (candidate) {
        if (!this.pc.remoteDescription) {
          this.pendingCandidates.push(candidate);
          return;
        }
        try {
          await this.pc.addIceCandidate(candidate);
        } catch (err) {
          if (!this.ignoreOffer) console.warn('ICE candidate error', err);
        }
      }
    } catch (err) {
      this.isSettingRemoteAnswerPending = false;
      console.warn('VoiceCallClient signal handling error', err);
    }
  }

  // --------------------------------------------------------------------------- VAD & Audio
  setupAudioAnalysis(stream, type) {
    if (typeof window === 'undefined') return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    try {
      if (!this.audioCtx) {
        this.audioCtx = new AudioContextClass();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }

      const source = this.audioCtx.createMediaStreamSource(stream);
      const analyser = this.audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      if (type === 'local') this.localAnalyser = analyser;
      else if (type === 'remote') this.remoteAnalyser = analyser;

      if (!this.vadInterval) {
        this.vadInterval = setInterval(() => this.runVAD(), 100);
      }
    } catch (err) {
      console.warn('VoiceCallClient audio analysis setup error', err);
    }
  }

  runVAD() {
    let localLevel = 0;
    let remoteLevel = 0;

    if (this.localAnalyser && !this.isMuted) {
      const data = new Uint8Array(this.localAnalyser.frequencyBinCount);
      this.localAnalyser.getByteFrequencyData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i];
      localLevel = Math.round(sum / data.length);
    }

    if (this.remoteAnalyser) {
      const data = new Uint8Array(this.remoteAnalyser.frequencyBinCount);
      this.remoteAnalyser.getByteFrequencyData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i];
      remoteLevel = Math.round(sum / data.length);
    }

    const VAD_THRESHOLD = 15;
    const localSpeaking = localLevel > VAD_THRESHOLD;
    const remoteSpeaking = remoteLevel > VAD_THRESHOLD;

    let speakingAttr = '';
    if (localSpeaking && remoteSpeaking) speakingAttr = 'local';
    else if (localSpeaking) speakingAttr = 'local';
    else if (remoteSpeaking) speakingAttr = 'remote';

    if (this.pillEl) {
      this.pillEl.dataset.speaking = speakingAttr;
    }

    if (typeof window !== 'undefined') {
      if (localSpeaking) {
        window.dispatchEvent(new CustomEvent('voice:speaking', { detail: { who: 'local', level: localLevel } }));
      }
      if (remoteSpeaking) {
        window.dispatchEvent(new CustomEvent('voice:speaking', { detail: { who: 'remote', level: remoteLevel } }));
      }
    }
  }

  // --------------------------------------------------------------------------- Cleanup
  cleanup() {
    this._state = 'idle';
    this.callId = null;
    this.peerId = null;
    this.peerName = null;
    this.isVip = false;
    this.startedAt = 0;
    this.diamondsEarned = 0;
    this.isMuted = false;
    this.makingOffer = false;
    this.ignoreOffer = false;
    this.isSettingRemoteAnswerPending = false;
    this.pendingCandidates = [];
    this.pendingDescription = null;
    this._initialNegotiationDone = false;
    this.reconnecting = false;

    if (this._iceHealTimer) {
      clearTimeout(this._iceHealTimer);
      this._iceHealTimer = null;
    }
    if (this._iceRebuildTimer) {
      clearTimeout(this._iceRebuildTimer);
      this._iceRebuildTimer = null;
    }
    this._stopIceRefreshTimer();
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    if (this.vadInterval) {
      clearInterval(this.vadInterval);
      this.vadInterval = null;
    }

    if (this.pc) {
      try {
        this.pc.ontrack = null;
        this.pc.onnegotiationneeded = null;
        this.pc.onicecandidate = null;
        this.pc.oniceconnectionstatechange = null;
        this.pc.onconnectionstatechange = null;
        this.pc.close();
      } catch (e) {}
      this.pc = null;
    }
    if (this.localStream) {
      try {
        this.localStream.getTracks().forEach((track) => track.stop());
      } catch (e) {}
      this.localStream = null;
    }
    if (this.remoteAudio) {
      this.remoteAudio.srcObject = null;
    }
    if (this.audioCtx) {
      try { this.audioCtx.close(); } catch (e) {}
      this.audioCtx = null;
      this.localAnalyser = null;
      this.remoteAnalyser = null;
    }

    this.hideIncomingBanner();
    this.hideInCallPill();

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('voice:duck', { detail: { on: false } }));
    }
  }
}
