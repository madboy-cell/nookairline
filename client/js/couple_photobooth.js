// client/js/couple_photobooth.js
// In-World Proximity Couple Interaction Bar (Hug, Heart-Hands, Kiss, Ballroom Spin, Tart Picnic)
// + Screen 19 Interactive Night-Cycle Photobooth & Synchronous WebGL Polaroid Keepsake Studio.

const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );

export const COUPLE_POSES = [
  {
    id: 'hug',
    shortLabel: 'Hug',
    label: 'Warm Hug',
    emoji: '🤗',
    icon: '/assets/ui/couple_prop_hug_cloud.png',
    toastText: 'shared a Warm Snuggle Hug',
    caption: 'Warm Sanctuary Embrace 🤗💞',
  },
  {
    id: 'heart_hands',
    shortLabel: 'Heart',
    label: 'Heart-Hands',
    emoji: '🫶',
    icon: '/assets/ui/couple_prop_heart_hands.png',
    toastText: 'formed a Crystal Heart-Hands pose',
    caption: 'Twin Sky-Islands Heart-Hands 🫶✨',
  },
  {
    id: 'kiss',
    shortLabel: 'Kiss',
    label: 'Sweet Kiss',
    emoji: '😘',
    icon: '/assets/ui/couple_prop_kiss_blush.png',
    toastText: 'shared a Sweet Sanctuary Kiss',
    caption: 'Sweet Starlight Kiss 😘💌',
  },
  {
    id: 'dance',
    shortLabel: 'Spin',
    label: 'Ballroom Spin',
    emoji: '💃',
    icon: '/assets/ui/icon_couple_moments.png',
    toastText: 'danced a Starlight Ballroom Spin',
    caption: 'Moonlit Ballroom Waltz 💃✨',
  },
  {
    id: 'picnic',
    shortLabel: 'Picnic',
    label: 'Tart Picnic',
    emoji: '🧺',
    icon: '/assets/ui/couple_prop_picnic_set.png',
    toastText: 'hosted a Cozy Berry Tart Picnic',
    caption: 'Strawberry Tart & Boba Picnic 🧺🍓',
  },
];

export const PHOTOBOOTH_MOODS = [
  { id: 'night', icon: '🌙', label: 'Starlight Night Cycle', short: 'Starlight Night' },
  { id: 'sunset', icon: '🌅', label: 'Golden Hour Sunset', short: 'Golden Sunset' },
  { id: 'sakura', icon: '🌸', label: 'Sakura Petal Breeze', short: 'Sakura Breeze' },
  { id: 'sunny', icon: '☀️', label: 'Sunny Sky Meadow', short: 'Sunny Meadow' },
];

const POLAROID_STORAGE_KEY = 'neora_couple_polaroids_v1';

export function loadSavedPolaroids() {
  try {
    const raw = localStorage.getItem(POLAROID_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function savePolaroidEntry(entry) {
  try {
    const cur = loadSavedPolaroids();
    const next = [entry, ...cur.filter((x) => x && x.id !== entry.id)].slice(0, 6);
    localStorage.setItem(POLAROID_STORAGE_KEY, JSON.stringify(next));
    return next;
  } catch {
    return [];
  }
}

export class CouplePhotoboothUI {
  constructor({ world, getProfile, request, toast, getVoiceClient, onApplyMood } = {}) {
    this.world = world;
    this.getProfile = getProfile || (() => null);
    this.request = request || null;
    this.toast = toast || (() => {});
    this.getVoiceClient = getVoiceClient || (() => null);
    this.onApplyMood = onApplyMood || null;

    this.nearPartner = false;
    this.partnerInfo = null;
    this.manualShowUntil = 0;
    this.dismissedUntil = 0;
    this.activePose = 'heart_hands';
    this.activeMood = 'night';
    this.photoModeOpen = false;
    this.uiHidden = false;
    this.camFlipped = false;
    this.latestPolaroid = null;

    this._savedCamDist = null;
    this._savedMood = null;
    this._callTickTimer = null;

    this.proxBarEl = null;
    this.overlayEl = null;

    this._initDom();
    this._bindWorldCallbacks();
  }

  _initDom() {
    if (typeof document === 'undefined') return;

    // 1. Floating In-World Proximity Couple Interaction Bar
    let bar = document.getElementById('couple-proximity-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'couple-proximity-bar';
      bar.className = 'couple-proximity-bar';
      bar.hidden = true;
      document.body.appendChild(bar);
    }
    this.proxBarEl = bar;

    this.proxBarEl.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-cp-act]');
      if (!btn) return;
      const act = btn.dataset.cpAct;
      if (act === 'pose') {
        const pose = btn.dataset.cpPose || 'hug';
        this.triggerInWorldInteraction(pose);
      } else if (act === 'photobooth') {
        this.openPhotobooth({ initialPose: this.activePose || 'heart_hands' });
      } else if (act === 'dismiss') {
        this.dismissedUntil = Date.now() + 12000;
        this.updateProximityBarVisibility();
      }
    });

    // 2. Screen 19 Full-Screen Photobooth Overlay
    let ov = document.getElementById('couple-photobooth-overlay');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'couple-photobooth-overlay';
      ov.className = 'couple-photobooth-overlay';
      ov.hidden = true;
      document.body.appendChild(ov);
    }
    this.overlayEl = ov;

    this.overlayEl.addEventListener('click', (e) => {
      // If UI is hidden, tapping anywhere restores UI
      if (this.uiHidden && !e.target.closest('[data-pb-act]')) {
        this.uiHidden = false;
        this.renderPhotobooth();
        return;
      }
      const btn = e.target.closest('[data-pb-act]');
      if (!btn) return;
      const act = btn.dataset.pbAct;
      if (act === 'close') {
        this.closePhotobooth();
      } else if (act === 'cycle-mood') {
        this.cycleMood();
      } else if (act === 'set-mood') {
        this.setPhotoboothMood(btn.dataset.pbMood || 'night');
      } else if (act === 'flip-cam') {
        this.toggleCameraAngle();
      } else if (act === 'hide-ui') {
        this.uiHidden = !this.uiHidden;
        this.renderPhotobooth();
      } else if (act === 'select-pose') {
        const pose = btn.dataset.pbPose || 'heart_hands';
        this.selectPhotoboothPose(pose);
      } else if (act === 'snap-polaroid') {
        this.snapPolaroidKeepsake();
      } else if (act === 'close-polaroid') {
        this.latestPolaroid = null;
        this.renderPhotobooth();
      } else if (act === 'save-polaroid') {
        this.downloadLatestPolaroid();
      } else if (act === 'share-polaroid') {
        this.shareLatestPolaroid();
      } else if (act === 'open-studio') {
        const curPose = this.activePose;
        this.closePhotobooth();
        const poseMap = { hug: 'sweet_hug', kiss: 'kiss_blush', picnic: 'picnic_date', heart_hands: 'heart_hands', dance: 'peace_jump' };
        window.__neora?.voiceClient?.openPhotobooth?.({ mode: 'couple', pose: poseMap[curPose] || 'heart_hands', backdrop: 'live_world' });
      }
    });
  }

  _bindWorldCallbacks() {
    if (!this.world) return;
    this.world.onPartnerProximity = (payload) => {
      const near = typeof payload === 'object' && payload !== null ? payload.near : payload;
      const partner = typeof payload === 'object' && payload !== null ? payload.partner : null;
      const dist = typeof payload === 'object' && payload !== null ? payload.dist : 0;
      const wasNear = this.nearPartner;
      this.nearPartner = Boolean(near);
      if (!this.nearPartner && wasNear) {
        this.dismissedUntil = 0;
      }
      if (partner) {
        this.partnerInfo = {
          id: partner.id,
          username: partner.username || partner.data?.username || partner.id,
          dist,
        };
      }
      this.updateProximityBarVisibility();
    };

    this.world.onCoupleStageEnd = () => {
      if (this._poseEndTimer) {
        clearTimeout(this._poseEndTimer);
        this._poseEndTimer = null;
      }
      this.activePose = null;
      if (!this.photoModeOpen) {
        this.manualShowUntil = 0;
        this.dismissedUntil = Date.now() + 6000;
        this.renderProximityBar();
        this.updateProximityBarVisibility();
      }
    };

    this.world.onPartnerTap = (payload) => {
      const partnerEnt = payload?.id ? payload : this.world.getPartnerEntity?.();
      if (!partnerEnt) return;
      this.partnerInfo = {
        id: partnerEnt.id,
        username: partnerEnt.username || partnerEnt.data?.username || partnerEnt.id,
        dist: 0,
      };
      this.dismissedUntil = 0;
      this.manualShowUntil = Date.now() + 9000;
      this.renderProximityBar();
      this.updateProximityBarVisibility();
      this.world.local?.pet?.showEmote?.('love');
      this.world.getPartnerEntity?.()?.pet?.showEmote?.('love');
    };
  }

  _canShowProximityBar() {
    if (!this.proxBarEl) return false;
    if (this.photoModeOpen) return false;
    const p = this.getProfile();
    if (!p?.partner_id) return false;
    const hud = document.getElementById('hud');
    if (!hud || hud.hidden) return false;
    const scene = hud.dataset.scene;
    if (scene !== 'VILLAGE' && scene !== 'TOWN_HALL') return false;
    const modal = document.getElementById('modal');
    if (modal && !modal.hidden) return false;
    const sb = document.getElementById('social-switchboard-modal');
    if (sb && !sb.hidden) return false;

    const now = Date.now();
    if (now < this.dismissedUntil && now >= this.manualShowUntil) return false;
    const stageActive = Boolean(this.world?.coupleStage?.active);
    return this.nearPartner || now < this.manualShowUntil || stageActive;
  }

  updateProximityBarVisibility() {
    if (!this.proxBarEl) return;
    const shouldShow = this._canShowProximityBar();
    if (shouldShow) {
      if (this.proxBarEl.hidden || !this.proxBarEl.innerHTML) {
        this.renderProximityBar();
      }
      this.proxBarEl.hidden = false;
    } else {
      this.proxBarEl.hidden = true;
    }
  }

  renderProximityBar() {
    if (!this.proxBarEl) return;
    const p = this.getProfile() || {};
    const partnerName =
      this.partnerInfo?.username ||
      this.world?.getPartnerEntity?.()?.data?.username ||
      p.partner_id ||
      'Partner';

    const poseBtnsHtml = COUPLE_POSES.map((pose) => {
      const isAct = this.world?.coupleStage?.active && this.activePose === pose.id;
      return `
        <button
          type="button"
          class="cp-prox-btn ${isAct ? 'is-active' : ''}"
          data-cp-act="pose"
          data-cp-pose="${esc(pose.id)}"
          title="${esc(pose.label)}"
        >
          <span class="cp-prox-ico-wrap">
            <img class="cp-prox-ico" src="${esc(pose.icon)}" alt="" />
          </span>
          <span class="cp-prox-lbl">${esc(pose.shortLabel)}</span>
        </button>
      `;
    }).join('');

    this.proxBarEl.innerHTML = `
      <div class="cp-prox-card" role="region" aria-label="Couple Proximity Interactions">
        <div class="cp-prox-head">
          <span class="cp-prox-title">💞 Near <b>${esc(partnerName)}</b> • Couple Interact</span>
          <span class="cp-prox-buff-pill">+25% Harmony</span>
          <button type="button" class="cp-prox-close" data-cp-act="dismiss" title="Hide">✕</button>
        </div>
        <div class="cp-prox-actions">
          ${poseBtnsHtml}
          <button
            type="button"
            class="cp-prox-btn is-camera"
            data-cp-act="photobooth"
            title="Open Couple Photobooth"
          >
            <span class="cp-prox-ico-wrap">📸</span>
            <span class="cp-prox-lbl">Photo</span>
          </button>
        </div>
      </div>
    `;
  }

  async triggerInWorldInteraction(poseId = 'hug', { fromRemote = false, remoteName = null, x = null, z = null, role = null } = {}) {
    const poseMeta = COUPLE_POSES.find((x) => x.id === poseId) || COUPLE_POSES[0];
    const ACTION_DUR_SEC = 2.5;
    const ACTION_DUR_MS = ACTION_DUR_SEC * 1000;
    if (!fromRemote) {
      this._lastLocalTriggerAt = Date.now();
    }
    this.activePose = poseMeta.id;
    this.dismissedUntil = 0;
    this.manualShowUntil = Date.now() + ACTION_DUR_MS;
    if (this._poseEndTimer) {
      clearTimeout(this._poseEndTimer);
      this._poseEndTimer = null;
    }

    let st = null;
    if (this.world) {
      st = this.world.playCoupleStage(poseMeta.id, {
        loop: this.photoModeOpen,
        dur: ACTION_DUR_SEC,
        stageAtBridge: this.photoModeOpen,
        x,
        z,
        role,
      });
    }

    this.renderProximityBar();
    this.updateProximityBarVisibility();

    // Schedule dismissal timer synchronously BEFORE any async network request so rapid clicks never leak timers
    this._poseEndTimer = setTimeout(() => {
      this._poseEndTimer = null;
      if (!this.photoModeOpen) {
        this.activePose = null;
        this.manualShowUntil = 0;
        this.dismissedUntil = Date.now() + 6000;
        if (this.world?.coupleStage?.active && !this.world.coupleStage.loop) {
          this.world.stopCoupleStage();
        } else {
          this.renderProximityBar();
          this.updateProximityBarVisibility();
        }
      }
    }, ACTION_DUR_MS + 60);

    const p = this.getProfile() || {};
    const partnerName =
      remoteName ||
      this.partnerInfo?.username ||
      this.world?.getPartnerEntity?.()?.data?.username ||
      p.partner_id ||
      'Partner';

    if (!fromRemote) {
      this.toast(
        `${poseMeta.emoji} You & ${partnerName} ${poseMeta.toastText}! (+1 Sweet Memory & +25% Harmony Buff 💕)`,
        2400
      );
      if (this.request) {
        try {
          const r = await this.request('couple_moment', {
            kind: 'pose',
            pose: poseMeta.id,
            x: typeof st?.cx === 'number' ? +st.cx.toFixed(3) : null,
            z: typeof st?.cz === 'number' ? +st.cz.toFixed(3) : null,
            initiatorRole: st?.localRole || 'left',
          });
          const vc = this.getVoiceClient?.();
          if (r?.ok && r.directory && vc) {
            vc.directory = r.directory;
            if (vc.switchboardOpen) vc.renderSwitchboard();
          }
        } catch {}
      }
    } else {
      this.toast(
        `💞 ${partnerName} ${poseMeta.toastText} with you! (+25% Couple Harmony Buff ✨)`,
        2400
      );
    }
  }

  onRemoteInteraction(msg) {
    if (!msg || msg.kind === 'polaroid') return;
    // Ignore bounce-back echo if we just initiated a couple pose within the last 2.2s
    if (!this.photoModeOpen && this._lastLocalTriggerAt && Date.now() - this._lastLocalTriggerAt < 2200) {
      return;
    }
    const pose = msg.pose || 'hug';
    const fromName = msg.fromName || msg.from || 'Your Partner';
    if (this.photoModeOpen) {
      this.selectPhotoboothPose(pose, { notifyServer: false });
      this.toast(`💞 ${fromName} switched pose to ${pose}!`, 2200);
      return;
    }
    const partnerRole = msg.initiatorRole === 'left' ? 'right' : (msg.initiatorRole === 'right' ? 'left' : null);
    this.triggerInWorldInteraction(pose, {
      fromRemote: true,
      remoteName: fromName,
      x: typeof msg.x === 'number' && Number.isFinite(msg.x) ? msg.x : null,
      z: typeof msg.z === 'number' && Number.isFinite(msg.z) ? msg.z : null,
      role: partnerRole,
    });
  }

  // ===========================================================================
  // SCREEN 19: INTERACTIVE NIGHT-CYCLE PHOTOBOOTH & POLAROID KEEPSAKE CAMERA
  // ===========================================================================
  openPhotobooth({ initialPose = 'heart_hands', initialMood = 'night' } = {}) {
    if (!this.world || !this.overlayEl) return;

    const vc = this.getVoiceClient?.();
    if (vc?.switchboardOpen) {
      vc.closeSwitchboard();
    }

    this.photoModeOpen = true;
    this.uiHidden = false;
    this.camFlipped = false;
    this.latestPolaroid = null;
    this.activePose = COUPLE_POSES.some((x) => x.id === initialPose) ? initialPose : 'heart_hands';
    this.activeMood = PHOTOBOOTH_MOODS.some((x) => x.id === initialMood) ? initialMood : 'night';

    // Save camera distance & current mood so we restore cleanly on exit
    this._savedCamDist = this.world.camDist || 22;
    const p = this.getProfile();
    this._savedMood = p?.village?.mood || 'auto';

    // Hide standard HUD & proximity bar
    const hud = document.getElementById('hud');
    if (hud) hud.hidden = true;
    if (this.proxBarEl) this.proxBarEl.hidden = true;

    // Stage couple on the Rainbow Heart Bridge (or current spot in Town Hall)
    this.world.playCoupleStage(this.activePose, {
      loop: true,
      dur: 999,
      stageAtBridge: true,
    });

    // Zoom camera for an intimate, full-figure 2.5D portrait shot
    this.world.camDist = 14.5;
    if (this.world.setMood) this.world.setMood(this.activeMood);
    else this.world.plaza?.setMood?.(this.activeMood);

    this.overlayEl.hidden = false;
    this.renderPhotobooth();

    if (this._callTickTimer) clearInterval(this._callTickTimer);
    this._callTickTimer = setInterval(() => {
      if (!this.photoModeOpen) return;
      const timerEl = this.overlayEl?.querySelector('#pb-call-timer-txt');
      const vcNow = this.getVoiceClient?.();
      if (timerEl && vcNow?.state === 'connected' && vcNow.startedAt) {
        const sec = Math.max(0, Math.floor((Date.now() - vcNow.startedAt) / 1000));
        const mm = String(Math.floor(sec / 60)).padStart(2, '0');
        const ss = String(sec % 60).padStart(2, '0');
        timerEl.textContent = `📞 On Call ${mm}:${ss} • +${vcNow.diamondsEarned || 20} 💎`;
      }
    }, 1000);
  }

  closePhotobooth() {
    if (!this.photoModeOpen) return;
    this.photoModeOpen = false;
    this.uiHidden = false;
    this.latestPolaroid = null;

    if (this._callTickTimer) {
      clearInterval(this._callTickTimer);
      this._callTickTimer = null;
    }

    if (this.overlayEl) {
      this.overlayEl.hidden = true;
    }

    if (this.world) {
      this.world.stopCoupleStage();
      if (this._savedCamDist) this.world.camDist = this._savedCamDist;
      if (this.onApplyMood && this._savedMood) {
        this.onApplyMood(this._savedMood);
      }
    }

    const hud = document.getElementById('hud');
    if (hud) hud.hidden = false;
    this.updateProximityBarVisibility();
  }

  cycleMood() {
    const idx = PHOTOBOOTH_MOODS.findIndex((m) => m.id === this.activeMood);
    const next = PHOTOBOOTH_MOODS[(idx + 1) % PHOTOBOOTH_MOODS.length];
    this.setPhotoboothMood(next.id);
  }

  setPhotoboothMood(moodId) {
    const m = PHOTOBOOTH_MOODS.find((x) => x.id === moodId) || PHOTOBOOTH_MOODS[0];
    this.activeMood = m.id;
    if (this.world?.setMood) this.world.setMood(m.id);
    else this.world?.plaza?.setMood?.(m.id);
    this.renderPhotobooth();
  }

  toggleCameraAngle() {
    this.camFlipped = !this.camFlipped;
    if (this.world) {
      this.world.camDist = this.camFlipped ? 12.2 : 14.5;
      if (this.world.coupleStage?.active) {
        this.world.camTarget.set(
          this.world.coupleStage.cx + (this.camFlipped ? 0.35 : 0),
          0.42,
          this.world.coupleStage.cz + (this.camFlipped ? -0.35 : 0.15)
        );
      }
    }
    this.renderPhotobooth();
  }

  selectPhotoboothPose(poseId, { notifyServer = true } = {}) {
    const poseMeta = COUPLE_POSES.find((x) => x.id === poseId) || COUPLE_POSES[0];
    this.activePose = poseMeta.id;
    if (this.world) {
      this.world.playCoupleStage(poseMeta.id, {
        loop: true,
        dur: 999,
        stageAtBridge: false,
      });
    }
    this.renderPhotobooth();
    if (notifyServer && this.request) {
      this.request('couple_moment', { kind: 'pose', pose: poseMeta.id }).catch(() => {});
    }
  }

  async snapPolaroidKeepsake() {
    if (!this.world) return;
    const p = this.getProfile() || {};
    const partnerEnt = this.world.getPartnerEntity?.();
    const partnerName =
      partnerEnt?.data?.username ||
      this.partnerInfo?.username ||
      p.partner_id ||
      'Partner';
    const myName = p.username || 'You';
    const streak = Math.max(1, Number(p.couple_streak || 1));
    const poseMeta = COUPLE_POSES.find((x) => x.id === this.activePose) || COUPLE_POSES[0];
    const moodMeta = PHOTOBOOTH_MOODS.find((x) => x.id === this.activeMood) || PHOTOBOOTH_MOODS[0];
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    // Camera shutter flash
    const flashEl = this.overlayEl?.querySelector('#pb-flash-overlay');
    if (flashEl) {
      flashEl.classList.remove('is-flashing');
      void flashEl.offsetWidth;
      flashEl.classList.add('is-flashing');
    }

    const title = `💞 ${myName} & ${partnerName} — Day ${streak} 💖`;
    const subtitle = `${poseMeta.caption} • ${moodMeta.short} • ${dateStr}`;

    const cap = this.world.capturePolaroid({
      coupleNames: `${myName} 💖 ${partnerName}`,
      title,
      subtitle,
      poseLabel: `${poseMeta.emoji} ${poseMeta.label}`,
      streak,
      dateText: dateStr,
      dateStr,
      moodLabel: `${moodMeta.icon} ${moodMeta.short}`,
    });
    const dataUrl = typeof cap === 'string' ? cap : cap?.dataUrl;
    const thumbDataUrl = typeof cap === 'object' && cap?.thumbDataUrl ? cap.thumbDataUrl : dataUrl;
    const photoId = `pol_${Date.now()}`;

    if (dataUrl) {
      const entry = {
        id: photoId,
        dataUrl,
        thumbDataUrl,
        title,
        subtitle,
        pose: poseMeta.id,
        poseLabel: `${poseMeta.emoji} ${poseMeta.label}`,
        mood: moodMeta.id,
        streak,
        dateStr,
        createdAt: Date.now(),
      };
      this.latestPolaroid = entry;
      savePolaroidEntry(entry);
    }

    if (this.request) {
      try {
        const r = await this.request('couple_moment', {
          kind: 'polaroid',
          pose: poseMeta.id,
          mood: moodMeta.id,
          photo: {
            id: photoId,
            caption: `${poseMeta.emoji} ${poseMeta.label} • Day ${streak}`,
            pose: poseMeta.id,
            backdrop: moodMeta.id,
            thumbDataUrl,
          },
        });
        const vc = this.getVoiceClient?.();
        if (r?.ok && r.directory && vc) {
          vc.directory = r.directory;
        }
      } catch {}
    }

    this.toast('📸 Snapped Polaroid Keepsake! +1 Sweet Memory saved to Love Chronicle! 💖', 3000);
    this.renderPhotobooth();
  }

  downloadLatestPolaroid() {
    if (!this.latestPolaroid?.dataUrl) return;
    const a = document.createElement('a');
    a.href = this.latestPolaroid.dataUrl;
    a.download = `neora-polaroid-day${this.latestPolaroid.streak || 1}-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    this.toast('📥 Saved Polaroid Keepsake to your Photos! ✨', 2400);
  }

  async shareLatestPolaroid() {
    if (!this.latestPolaroid?.dataUrl) return;
    try {
      if (navigator.share) {
        const res = await fetch(this.latestPolaroid.dataUrl);
        const blob = await res.blob();
        const file = new File([blob], `neora-couple-polaroid.png`, { type: 'image/png' });
        if (!navigator.canShare || navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: this.latestPolaroid.title,
            text: `${this.latestPolaroid.title} — ${this.latestPolaroid.subtitle}`,
            files: [file],
          });
          this.toast('📤 Shared Polaroid Keepsake! 💞', 2200);
          return;
        }
      }
    } catch {}
    this.downloadLatestPolaroid();
  }

  renderPhotobooth() {
    if (!this.overlayEl) return;
    const p = this.getProfile() || {};
    const partnerEnt = this.world?.getPartnerEntity?.();
    const partnerName =
      partnerEnt?.data?.username ||
      this.partnerInfo?.username ||
      p.partner_id ||
      'Partner';
    const myName = p.username || 'You';
    const streak = Math.max(1, Number(p.couple_streak || 1));
    const moodMeta = PHOTOBOOTH_MOODS.find((x) => x.id === this.activeMood) || PHOTOBOOTH_MOODS[0];
    const poseMeta = COUPLE_POSES.find((x) => x.id === this.activePose) || COUPLE_POSES[0];

    const vc = this.getVoiceClient?.();
    const isCallLive = vc?.state === 'connected';
    let callBadgeTxt = `💞 ${esc(myName)} &amp; ${esc(partnerName)} • Day ${streak} 💖`;
    if (isCallLive && vc.startedAt) {
      const sec = Math.max(0, Math.floor((Date.now() - vc.startedAt) / 1000));
      const mm = String(Math.floor(sec / 60)).padStart(2, '0');
      const ss = String(sec % 60).padStart(2, '0');
      callBadgeTxt = `📞 On Call ${mm}:${ss} • +${vc.diamondsEarned || 20} 💎`;
    }

    const moodPillsHtml = PHOTOBOOTH_MOODS.map((m) => `
      <button
        type="button"
        class="pb-mood-chip ${m.id === this.activeMood ? 'is-active' : ''}"
        data-pb-act="set-mood"
        data-pb-mood="${esc(m.id)}"
      >
        <span>${m.icon}</span>
        <span>${esc(m.short)}</span>
      </button>
    `).join('');

    const poseCardsHtml = COUPLE_POSES.map((pose) => {
      const active = pose.id === this.activePose;
      return `
        <button
          type="button"
          class="pb-pose-card ${active ? 'is-active' : ''}"
          data-pb-act="select-pose"
          data-pb-pose="${esc(pose.id)}"
        >
          <div class="pb-pose-thumb">
            <img src="${esc(pose.icon)}" alt="" />
          </div>
          <div class="pb-pose-name">${pose.emoji} ${esc(pose.label)}</div>
          ${active ? '<span class="pb-pose-active-tag">ACTIVE</span>' : ''}
        </button>
      `;
    }).join('');

    const polaroidModalHtml = this.latestPolaroid ? `
      <div class="pb-polaroid-modal" data-pb-polaroid-card="1">
        <div class="pb-polaroid-frame">
          <div class="pb-polaroid-Header-badges">
            <span class="pb-polaroid-pin">📌 Keepsake Saved</span>
            <button type="button" class="pb-polaroid-x" data-pb-act="close-polaroid" title="Close Preview">✕</button>
          </div>
          <img
            class="pb-polaroid-img"
            src="${this.latestPolaroid.dataUrl}"
            alt="${esc(this.latestPolaroid.title)}"
          />
          <div class="pb-polaroid-actions">
            <button type="button" class="pb-pol-btn is-save" data-pb-act="save-polaroid">
              📥 Save to Photos
            </button>
            <button type="button" class="pb-pol-btn is-share" data-pb-act="share-polaroid">
              📤 Share to LINE / IG
            </button>
          </div>
        </div>
      </div>
    ` : '';

    this.overlayEl.innerHTML = `
      <div id="pb-flash-overlay" class="pb-flash-overlay"></div>

      ${this.uiHidden ? `
        <button type="button" class="pb-restore-ui-pill" data-pb-act="hide-ui">
          ✨ Tap to Show Photobooth UI
        </button>
      ` : `
        <!-- Top Camera Controls Bar -->
        <header class="pb-top-bar">
          <div class="pb-top-row">
            <button type="button" class="pb-mode-cycle-btn" data-pb-act="cycle-mood" title="Switch Sky Atmosphere">
              <span>${moodMeta.icon}</span>
              <span>Mode: <b>${esc(moodMeta.label)}</b></span>
            </button>

            <div class="pb-call-pill ${isCallLive ? 'is-live' : ''}">
              <span id="pb-call-timer-txt">${callBadgeTxt}</span>
            </div>

            <div class="pb-cam-tools">
              <button type="button" class="pb-tool-btn" data-pb-act="open-studio" title="Open Polaroid Studio (Frames, Stickers &amp; Custom Captions)">
                🎨 Studio
              </button>
              <button type="button" class="pb-tool-btn ${this.camFlipped ? 'is-active' : ''}" data-pb-act="flip-cam">
                🔄 Flip Cam
              </button>
              <button type="button" class="pb-tool-btn" data-pb-act="hide-ui">
                ✨ Hide UI
              </button>
              <button type="button" class="pb-tool-btn is-exit" data-pb-act="close">
                ✕ Exit
              </button>
            </div>
          </div>

          <div class="pb-mood-strip">
            ${moodPillsHtml}
          </div>
        </header>

        <!-- Center Stage Floating Banner -->
        <div class="pb-stage-caption-pill">
          <span>${poseMeta.emoji} <b>${esc(poseMeta.label)}</b> — ${esc(poseMeta.caption)}</span>
        </div>

        ${polaroidModalHtml}

        <!-- Bottom Royal Wood Pose Tray & Golden Shutter -->
        <footer class="pb-bottom-dock">
          <div class="pb-pose-tray">
            <div class="pb-pose-tray-head">
              <span>💞 COUPLE INTERACTION POSES (REAL-TIME 2.5D STAGE)</span>
              <small>+25% Harmony Buff Active ✨</small>
            </div>
            <div class="pb-pose-grid">
              ${poseCardsHtml}
            </div>
            <button type="button" class="pb-shutter-btn" data-pb-act="snap-polaroid">
              <span class="pb-shutter-ico">📷</span>
              <span>SNAP POLAROID KEEPSAKE!</span>
            </button>
          </div>
        </footer>
      `}
    `;
  }
}
