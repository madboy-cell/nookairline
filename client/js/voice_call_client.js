// client/js/voice_call_client.js — Real-Time Voice Calls & Couple Switchboard Client (Screens 05, 09, 17, 25).
// WebRTC audio with perfect-negotiation, Web Audio VAD, game audio ducking, and floating UI widgets.

import { renderOutfitThumbLayers, escapeHtml } from './ui_components.js';

const FRIEND_PRESETS = {
  neen: { name: 'Neen', lineage: 'dxb', outfit: 'season2_sakura', hair: 'hair_girl_waves', hairColor: 'coral', status: 'Online • Twin Sanctuary' },
  nook: { name: 'Nook', lineage: 'bkk', outfit: 'season1_royal_court', hair: 'hair_boy_fluffy', hairColor: 'silver', status: 'Online • Royal Castle' },
  mochi: { name: 'Lady Mochi', lineage: 'dxb', outfit: 'season4_gilded', hair: 'hair_girl_twintails', hairColor: 'blonde', status: 'Online • Grand Town Hall' },
  leo: { name: 'Sir Leo', lineage: 'bkk', outfit: 'season3_shadow_emperor', hair: 'hair_boy_spiky', hairColor: 'obsidian', status: 'Online • Monopoly Lobby' },
  aria: { name: 'Aria Star', lineage: 'dxb', outfit: 'season5_starlight_diva', hair: 'hair_girl_ponytail', hairColor: 'lavender', status: 'Online • Wishing Fountain' },
};

function resolvePeerVisual(userId, fallbackName) {
  const key = String(userId || '').toLowerCase();
  const preset = FRIEND_PRESETS[key];
  if (preset) return preset;
  const isDxb = key.length % 2 === 1;
  return {
    name: fallbackName || userId || 'Sky Friend',
    lineage: isDxb ? 'dxb' : 'bkk',
    outfit: isDxb ? 'season2_sakura' : 'season1_royal_court',
    hair: isDxb ? 'hair_girl_waves' : 'hair_boy_fluffy',
    hairColor: isDxb ? 'coral' : 'silver',
    status: 'Online • Sky Archipelago',
  };
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
  } = {}) {
    this.net = net;
    this.getProfile = getProfile;
    this.toast = toast;
    this.getUserName = getUserName;
    this.onVisitIsland = onVisitIsland;
    this.onBlessPartner = onBlessPartner;
    this.onOpenGift = onOpenGift;
    this.onOpenPlayHub = onOpenPlayHub;

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
    this.switchboardTab = 'couple';
    this.switchboardOpen = false;

    // WebRTC internals
    this.pc = null;
    this.localStream = null;
    this.remoteStream = null;
    this.makingOffer = false;
    this.ignoreOffer = false;
    this.isSettingRemoteAnswerPending = false;

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
      else if (act === 'hangup' || act === 'call-hangup') this.hangup();
      else if (act === 'switchboard' || act === 'call-switchboard') this.openSwitchboard();
    });

    // 3. Couple Sanctuary & Voice Call Switchboard Modal (Screen 17)
    let sb = document.getElementById('social-switchboard-modal');
    if (!sb) {
      sb = document.createElement('div');
      sb.id = 'social-switchboard-modal';
      sb.className = 'modal-wrap social-switchboard-modal';
      sb.hidden = true;
      document.body.appendChild(sb);
    }
    this.switchboardEl = sb;
    this.switchboardEl.addEventListener('click', (e) => {
      if (e.target === this.switchboardEl || e.target.closest('[data-sb-close]')) {
        this.closeSwitchboard();
        return;
      }
      const tabBtn = e.target.closest('[data-sb-tab]');
      if (tabBtn) {
        this.switchboardTab = tabBtn.dataset.sbTab || 'couple';
        this.renderSwitchboard();
        return;
      }
      const actBtn = e.target.closest('[data-sb-act]');
      if (!actBtn) return;
      const act = actBtn.dataset.sbAct;
      const uid = actBtn.dataset.userId;
      const p = (this.getProfile && this.getProfile()) || {};
      const partnerId = p.partner_id || (p.id === 'neen' ? 'nook' : 'neen');

      if (act === 'call-user' && uid) {
        this.call(uid);
        this.renderSwitchboard();
      } else if (act === 'hangup') {
        this.hangup();
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
      } else if (act === 'polaroid') {
        this.toast('📸 Captured Couple Sanctuary Polaroid! +5 Couple Mood 💕');
      } else if (act === 'bless-partner') {
        if (this.onBlessPartner) this.onBlessPartner(partnerId);
        else this.net?.send?.({ type: 'village_bless_partner', target: partnerId });
        this.toast(`💧 Sent Starlight Blessing (+15% Yield) to ${this.getUserName(partnerId)}!`);
      } else if (act === 'visit-partner') {
        this.closeSwitchboard();
        if (this.onVisitIsland) this.onVisitIsland(partnerId);
      } else if (act === 'visit-user' && uid) {
        this.closeSwitchboard();
        if (this.onVisitIsland) this.onVisitIsland(uid);
      } else if ((act === 'gift-partner' || act === 'gift-user')) {
        const targetId = uid || partnerId;
        this.closeSwitchboard();
        if (this.onOpenGift) this.onOpenGift(targetId);
      } else if (act === 'open-vip-bag') {
        this.closeSwitchboard();
        if (this.onOpenGift) this.onOpenGift(partnerId);
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
  }

  // --------------------------------------------------------------------------- Switchboard Modal (Screen 17)
  openSwitchboard(tab = null) {
    if (tab) this.switchboardTab = tab;
    this.switchboardOpen = true;
    if (this.switchboardEl) {
      this.switchboardEl.hidden = false;
      this.renderSwitchboard();
    }
  }

  closeSwitchboard() {
    this.switchboardOpen = false;
    if (this.switchboardEl) {
      this.switchboardEl.hidden = true;
    }
  }

  renderSwitchboard() {
    if (!this.switchboardEl || !this.switchboardOpen) return;
    const p = (this.getProfile && this.getProfile()) || {};
    const myId = p.id || 'nook';
    const myName = p.username || 'Nook';
    const myLineage = p.lineage || 'bkk';
    const eqOutfitRaw = p.equipped?.outfit;
    const myOutfit = (typeof eqOutfitRaw === 'object' ? eqOutfitRaw?.id : eqOutfitRaw) || 'season1_royal_court';
    const myChibiHtml = renderOutfitThumbLayers(myOutfit, {
      lineage: myLineage,
      appearance: p.appearance,
      alt: myName,
    });

    const partnerId = p.partner_id || (myId === 'neen' ? 'nook' : 'neen');
    const partnerVis = resolvePeerVisual(partnerId, p.partner_name || this.getUserName(partnerId));
    const partnerChibiHtml = renderOutfitThumbLayers(partnerVis.outfit, {
      lineage: partnerVis.lineage,
      appearance: { hair: partnerVis.hair, hairColor: partnerVis.hairColor },
      alt: partnerVis.name,
    });

    const streak = p.couple_streak ?? 14;
    const isConnected = this._state === 'connected';
    const isCalling = this._state === 'calling';
    const activePeerName = this.peerName || partnerVis.name;

    const elapsedSec = (isConnected && this.startedAt)
      ? Math.floor(Math.max(0, Date.now() - this.startedAt) / 1000)
      : 0;
    const mm = String(Math.floor(elapsedSec / 60)).padStart(2, '0');
    const ss = String(elapsedSec % 60).padStart(2, '0');

    // Friends list for directory
    const rawFriends = Array.isArray(p.friends) && p.friends.length
      ? p.friends
      : ['neen', 'mochi', 'leo'].filter((id) => id !== myId);
    const allContacts = [
      { id: partnerId, isPartner: true, ...partnerVis },
      ...rawFriends
        .filter((fid) => fid !== partnerId && fid !== myId)
        .map((fid) => ({ id: fid, isPartner: false, ...resolvePeerVisual(fid, this.getUserName(fid)) })),
    ];

    const vip = p.vip || {};
    const bag = p.bag_items || {};
    const curTab = this.switchboardTab || 'couple';

    let directoryBodyHtml = '';
    if (curTab === 'vip') {
      directoryBodyHtml = `
        <div class="sb-vip-grid">
          <div class="sb-vip-Status-item ${vip.call_until > Date.now() ? 'is-active' : ''}">
            <img src="/assets/ui/item_ticket_standard.png" alt="" />
            <div>
              <div class="sb-vip-name">Sky Call Day-Pass</div>
              <div class="sb-vip-sub">${vip.call_until > Date.now() ? 'Active Pass ✅' : `In Bag: x${bag.vip_call_day_pass | 0}`}</div>
            </div>
          </div>
          <div class="sb-vip-Status-item ${vip.communicator ? 'is-active' : ''}">
            <img src="/assets/ui/item_vip_communicator.png" alt="" />
            <div>
              <div class="sb-vip-name">📱 VIP Communicator</div>
              <div class="sb-vip-sub">${vip.communicator ? 'Permanent Active ✅' : `In Bag: x${bag.vip_communicator | 0}`}</div>
            </div>
          </div>
          <div class="sb-vip-Status-item ${(vip.telelinks || []).length ? 'is-active' : ''}">
            <img src="/assets/ui/vip_card_telelink.png" alt="" />
            <div>
              <div class="sb-vip-name">💖 Tele-Link Couple Box</div>
              <div class="sb-vip-sub">${(vip.telelinks || []).length ? `Linked (${vip.telelinks.join(', ')}) ✅` : `In Bag: x${bag.vip_telelink_box | 0}`}</div>
            </div>
          </div>
          <div class="sb-vip-Status-item ${vip.black ? 'is-active' : ''}">
            <img src="/assets/ui/vip_card_black_sovereign.png" alt="" />
            <div>
              <div class="sb-vip-name">👑 Sovereign Black VIP</div>
              <div class="sb-vip-sub">${vip.black ? 'Sovereign Active (+30💎/15m) ✅' : `In Bag: x${bag.vip_black | 0}`}</div>
            </div>
          </div>
        </div>
        <div class="sb-vip-footer">
          <button type="button" class="btn-gold small" data-sb-act="open-vip-bag">🎒 Open Royal Bag &amp; VIP Card Shop</button>
        </div>
      `;
    } else {
      const filteredContacts = curTab === 'couple'
        ? allContacts.filter((c) => c.isPartner)
        : allContacts;
      directoryBodyHtml = `
        <div class="sb-contacts-list">
          ${filteredContacts.map((c) => {
            const cThumb = renderOutfitThumbLayers(c.outfit, {
              lineage: c.lineage,
              appearance: { hair: c.hair, hairColor: c.hairColor },
              alt: c.name,
            });
            return `
              <div class="sb-contact-row ${c.isPartner ? 'is-partner' : ''}" data-contact-id="${escapeHtml(c.id)}">
                <div class="sb-contact-avatar">${cThumb}</div>
                <div class="sb-contact-meta">
                  <div class="sb-contact-name">
                    ${escapeHtml(c.name)}
                    <span class="sb-contact-tag ${c.isPartner ? 'partner' : 'friend'}">
                      ${c.isPartner ? '💕 Bound Partner' : '🤝 Sky Friend'}
                    </span>
                  </div>
                  <div class="sb-contact-status">🟢 ${escapeHtml(c.status)}</div>
                </div>
                <div class="sb-contact-actions">
                  <button type="button" class="btn-gold small sb-btn-call" data-sb-act="call-user" data-user-id="${escapeHtml(c.id)}">📞 Call</button>
                  <button type="button" class="btn-gold small outline sb-btn-gift" data-sb-act="gift-user" data-user-id="${escapeHtml(c.id)}">🎁 Gift</button>
                  <button type="button" class="btn-gold small outline sb-btn-visit" data-sb-act="visit-user" data-user-id="${escapeHtml(c.id)}">🏠 Visit</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    this.switchboardEl.innerHTML = `
      <section class="parchment social-switchboard-card" role="dialog" aria-label="Couple Sanctuary & Voice Switchboard">
        <div class="parchment-title">💖 COUPLE &amp; VOICE SWITCHBOARD</div>
        <button type="button" class="x-btn" data-sb-close="1" data-act="close-switchboard" aria-label="Close">✕</button>

        <!-- 1. Top Rainbow Couple Sanctuary Card -->
        <div class="sb-sanctuary-stage">
          <div class="sb-rainbow-arc"></div>
          <div class="sb-couple-avatars">
            <div class="sb-couple-col">
              <div class="sb-couple-chibi">${myChibiHtml}</div>
              <div class="sb-couple-lbl">${escapeHtml(myName)}</div>
            </div>
            <div class="sb-couple-heart-bridge">
              <div class="sb-heart-pulse">💞</div>
              <div class="sb-streak-pill">💖 Streak: <b>${streak} Days</b> • +15% Yield</div>
            </div>
            <div class="sb-couple-col">
              <div class="sb-couple-chibi">${partnerChibiHtml}</div>
              <div class="sb-couple-lbl">${escapeHtml(partnerVis.name)}</div>
            </div>
          </div>
          <div class="sb-sanctuary-actions">
            <button type="button" class="btn-gold small" data-sb-act="bless-partner">💧 Bless (+15%)</button>
            <button type="button" class="btn-gold small outline" data-sb-act="visit-partner">🏠 Partner Isle</button>
            <button type="button" class="btn-gold small outline" data-sb-act="gift-partner">🦉 Owl Gift</button>
          </div>
        </div>

        <!-- 2. Center Voice Call Switchboard Card -->
        <div class="sb-voice-console ${isConnected ? 'is-live' : (isCalling ? 'is-calling' : '')}">
          <div class="sb-console-head">
            <div class="sb-console-status">
              <span class="sb-status-dot ${isConnected ? 'live' : (isCalling ? 'calling' : 'idle')}"></span>
              <b>${isConnected ? `On Call with ${escapeHtml(activePeerName)} (${mm}:${ss})` : (isCalling ? `Ringing ${escapeHtml(activePeerName)}...` : 'Sky Tele-Link Switchboard Ready')}</b>
            </div>
            <div class="sb-console-reward">💎 +20 Diamonds / 15m Talk ${this.diamondsEarned ? `• Earned: +${this.diamondsEarned} 💎` : ''}</div>
          </div>

          <div class="sb-waveform-box ${isConnected ? 'active' : ''}">
            <span class="sb-wave-bar"></span>
            <span class="sb-wave-bar"></span>
            <span class="sb-wave-bar"></span>
            <span class="sb-wave-bar"></span>
            <span class="sb-wave-bar"></span>
            <span class="sb-wave-bar"></span>
            <span class="sb-wave-bar"></span>
            <span class="sb-wave-bar"></span>
            <span class="sb-wave-bar"></span>
          </div>

          <div class="sb-console-controls">
            <button type="button" class="sb-ctrl-pill ${this.isMuted ? 'is-muted' : ''}" data-sb-act="toggle-mute">
              ${this.isMuted ? '🔇 Unmute Mic' : '🎙️ Mute Mic'}
            </button>
            <button type="button" class="sb-ctrl-pill ${this.autoDuck ? 'is-on' : ''}" data-sb-act="toggle-duck">
              🔊 Auto-Duck: <b>${this.autoDuck ? 'ON' : 'OFF'}</b>
            </button>
            <button type="button" class="sb-ctrl-pill" data-sb-act="polaroid">
              📷 Couple Polaroid
            </button>
            ${(isConnected || isCalling)
              ? `<button type="button" class="btn-gold small sb-hangup-btn" data-sb-act="hangup">📴 End Call</button>`
              : `<button type="button" class="btn-gold small sb-call-partner-btn" data-sb-act="call-user" data-user-id="${escapeHtml(partnerId)}">📞 Call ${escapeHtml(partnerVis.name)}</button>`
            }
          </div>
        </div>

        <!-- 3. Bottom 3-Tab Social Directory -->
        <div class="sb-directory-section">
          <div class="sb-directory-tabs">
            <button type="button" class="sb-dir-tab ${curTab === 'couple' ? 'active' : ''}" data-sb-tab="couple">💖 Couple Sanctuary</button>
            <button type="button" class="sb-dir-tab ${curTab === 'friends' ? 'active' : ''}" data-sb-tab="friends">🤝 Friends Online (${allContacts.length})</button>
            <button type="button" class="sb-dir-tab ${curTab === 'vip' ? 'active' : ''}" data-sb-tab="vip">🎟️ VIP Calling Cards</button>
          </div>
          <div class="sb-directory-body">
            ${directoryBodyHtml}
          </div>
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
      appearance: { hair: vis.hair, hairColor: vis.hairColor },
      alt: name,
    });
    this.bannerEl.innerHTML = `
      <div class="incoming-call-avatar">
        ${portraitHtml}
      </div>
      <div class="incoming-call-info">
        <div class="incoming-call-kicker">${vip ? '📱 VIP Communicator • Free Call' : '💖 Couple Tele-Link • Incoming Call'}</div>
        <span class="incoming-call-title">📞 Incoming 1-on-1 Call from <b>${escapeHtml(name)}</b></span>
        <span class="incoming-call-sub">💎 +20 Diamonds / 15m Couple Talk!</span>
      </div>
      <div class="incoming-call-actions">
        <button type="button" class="incoming-call-btn accept" data-call="accept" data-act="call-accept">📞 Accept &amp; Unmute</button>
        <button type="button" class="incoming-call-btn decline" data-call="decline" data-act="call-decline">📵 Busy</button>
      </div>`;
    this.bannerEl.hidden = false;
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
        <button type="button" class="voice-pill-btn switchboard" data-call="switchboard" data-act="call-switchboard" title="Open Voice Switchboard">🎛️</button>
        <button type="button" class="voice-pill-btn hangup" data-call="hangup" data-act="call-hangup" title="End Call">📴</button>
      </div>`;
    this.pillEl.dataset.speaking = '';
    this.pillEl.hidden = false;

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
    if (!this.pillEl || !this.startedAt) return;
    const elapsedSec = Math.floor(Math.max(0, Date.now() - this.startedAt) / 1000);
    const mm = String(Math.floor(elapsedSec / 60)).padStart(2, '0');
    const ss = String(elapsedSec % 60).padStart(2, '0');
    const timerSpan = this.pillEl.querySelector('.voice-call-timer');
    if (timerSpan) timerSpan.textContent = `${mm}:${ss}`;
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
        return true;
      }
      case 'call_ringing': {
        this.callId = msg.callId;
        this._state = 'calling';
        if (this.switchboardOpen) this.renderSwitchboard();
        return true;
      }
      case 'call_connected': {
        this.callId = msg.callId;
        this.peerId = msg.peerId;
        this.peerName = this.getUserName(msg.peerId);
        this.startedAt = msg.startedAt || Date.now();
        this.polite = !!msg.polite;
        this._state = 'connected';

        this.hideIncomingBanner();
        this.showInCallPill();

        this.setupWebRTC(msg.ice);

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
        else if (reason === 'hangup' && this._state === 'connected') this.toast('Call ended');

        this.cleanup();
        return true;
      }
      case 'call_busy': {
        this.toast('User is busy on another call');
        this.cleanup();
        return true;
      }
      case 'call_reward': {
        this.diamondsEarned += (msg.diamonds || 0);
        this.updateDiamonds();
        this.toast(`+${msg.diamonds || 20} 💎 Voice Call Reward!`);
        return true;
      }
      case 'action_result': {
        if (msg.action === 'call_invite' && !msg.ok) {
          const err = msg.error;
          if (err === 'call_locked') this.toast('📞 Call locked: VIP Card or Partner line required');
          else if (err === 'offline') this.toast('📞 User is offline');
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
  async ensureLocalMedia() {
    if (this.localStream) return this.localStream;
    if (!this.isSupported) {
      this.toast('Voice calls not supported');
      return null;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.localStream = stream;
      if (this.pc) {
        stream.getTracks().forEach((track) => this.pc.addTrack(track, stream));
      }
      this.setupAudioAnalysis(stream, 'local');
      return stream;
    } catch (err) {
      console.warn('Microphone permission error', err);
      this.toast('Microphone access denied or unavailable');
      return null;
    }
  }

  setupWebRTC(iceConfig) {
    if (!this.isSupported) return;

    const defaultIce = [{ urls: 'stun:stun.l.google.com:19302' }];
    let iceServers = defaultIce;
    if (iceConfig) {
      if (Array.isArray(iceConfig)) iceServers = iceConfig;
      else if (iceConfig.iceServers) iceServers = iceConfig.iceServers;
      else if (iceConfig.urls) iceServers = [iceConfig];
    }

    const pc = new window.RTCPeerConnection({ iceServers });
    this.pc = pc;

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => pc.addTrack(track, this.localStream));
      this.setupAudioAnalysis(this.localStream, 'local');
    }

    pc.ontrack = (event) => {
      this.remoteStream = event.streams[0];
      if (this.remoteAudio) {
        this.remoteAudio.srcObject = event.streams[0];
        this.remoteAudio.play().catch(() => {});
      }
      this.setupAudioAnalysis(event.streams[0], 'remote');
    };

    pc.onnegotiationneeded = async () => {
      try {
        this.makingOffer = true;
        await pc.setLocalDescription();
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

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        try { pc.restartIce(); } catch (e) { console.warn('ICE restart error', e); }
      }
    };
  }

  async onSignal(data) {
    if (!this.pc || !data) return;
    const { description, candidate } = data;
    try {
      if (description) {
        const readyForOffer = !this.makingOffer &&
          (this.pc.signalingState === 'stable' || this.isSettingRemoteAnswerPending);
        const offerCollision = description.type === 'offer' && !readyForOffer;
        this.ignoreOffer = !this.polite && offerCollision;
        if (this.ignoreOffer) return;

        this.isSettingRemoteAnswerPending = description.type === 'answer';
        await this.pc.setRemoteDescription(description);
        this.isSettingRemoteAnswerPending = false;

        if (description.type === 'offer') {
          await this.pc.setLocalDescription();
          this.net.send({
            type: 'call_signal',
            callId: this.callId,
            data: { description: this.pc.localDescription },
          });
        }
      } else if (candidate) {
        try {
          await this.pc.addIceCandidate(candidate);
        } catch (err) {
          if (!this.ignoreOffer) console.warn('ICE candidate error', err);
        }
      }
    } catch (err) {
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

    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    if (this.vadInterval) {
      clearInterval(this.vadInterval);
      this.vadInterval = null;
    }

    if (this.pc) {
      try { this.pc.close(); } catch (e) {}
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
