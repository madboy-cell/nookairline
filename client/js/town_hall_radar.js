// client/js/town_hall_radar.js — Town Hall Royal Astrolabe Mini-Radar, Town Map Modal, and Off-Screen Wayfinder
import * as THREE from 'three';

const LANDMARK_META = {
  fountain: { icon: '🗽', cat: 'Centerpiece', color: '#38bdf8' },
  statue_1: { icon: '🏰', cat: 'Hall of Fame', color: '#facc15' },
  statue_2: { icon: '👑', cat: 'Hall of Fame', color: '#facc15' },
  statue_3: { icon: '🐾', cat: 'Hall of Fame', color: '#facc15' },
  statue_4: { icon: '🎲', cat: 'Hall of Fame', color: '#facc15' },
  statue_5: { icon: '💖', cat: 'Hall of Fame', color: '#facc15' },
  casino_palace: { icon: '🎰', cat: 'Grand Casino', color: '#c084fc' },
  monopoly_arch: { icon: '🎲', cat: 'Sky Monopoly', color: '#60a5fa' },
  forge: { icon: '🔨', cat: 'Blacksmith +10', color: '#fb923c' },
  owl_postbox: { icon: '🦉', cat: 'Gift & Mail', color: '#f472b6' },
  vip_table_1: { icon: '🪑', cat: '4-Seat Lounge', color: '#34d399' },
  vip_table_2: { icon: '🪑', cat: '4-Seat Lounge', color: '#34d399' },
  vip_table_3: { icon: '🪑', cat: '4-Seat Lounge', color: '#34d399' },
  vip_table_4: { icon: '🪑', cat: '4-Seat Lounge', color: '#34d399' },
};

export class TownHallRadar {
  /**
   * @param {object} opts
   * @param {import('./world_engine.js').WorldEngine} opts.world
   * @param {() => object} opts.getProfile
   * @param {Array<{id:string, label:string, icon:string, x:number, z:number, action:string}>} opts.landmarks
   */
  constructor({ world, getProfile, landmarks }) {
    this.world = world;
    this.getProfile = getProfile || (() => ({}));
    this.landmarks = landmarks || [];
    this.active = false;
    this.timer = null;

    this.initCanvas();
    this.initModal();
    this.initWayfinder();
  }

  initCanvas() {
    if (typeof document === 'undefined') return;
    this.canvas = document.getElementById('hud-mini-radar');
    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
      this.canvas.id = 'hud-mini-radar';
      this.canvas.className = 'hud-mini-radar';
      this.canvas.width = 64;
      this.canvas.height = 64;
      this.canvas.hidden = true;
      const hud = document.getElementById('hud') || document.body;
      hud?.appendChild(this.canvas);
    }
    this.ctx = this.canvas.getContext?.('2d') || null;
    this.onCanvasClick = () => this.openMapModal();
    this.canvas.addEventListener('click', this.onCanvasClick);
  }

  initModal() {
    if (typeof document === 'undefined') return;
    this.modalEl = document.getElementById('town-map-modal');
    if (!this.modalEl) {
      this.modalEl = document.createElement('div');
      this.modalEl.id = 'town-map-modal';
      this.modalEl.className = 'modal-wrap town-map-modal';
      this.modalEl.hidden = true;
      const app = document.getElementById('app') || document.body;
      app?.appendChild(this.modalEl);
    }
    this.onModalClick = (e) => {
      const tpBtn = e.target.closest('[data-map-tp]');
      if (tpBtn) {
        e.stopPropagation();
        const row = tpBtn.closest('[data-walk-x][data-walk-z]');
        const x = parseFloat(tpBtn.dataset.tpX ?? row?.dataset.walkX);
        const z = parseFloat(tpBtn.dataset.tpZ ?? row?.dataset.walkZ);
        if (Number.isFinite(x) && Number.isFinite(z)) {
          this.teleportTo(x, z);
          this.closeMapModal();
        }
        return;
      }

      const walkTarget = e.target.closest('[data-map-walk], [data-walk-x][data-walk-z]');
      if (walkTarget) {
        const row = walkTarget.closest('[data-walk-x][data-walk-z]') || walkTarget;
        const x = parseFloat(walkTarget.dataset.walkX ?? row.dataset.walkX);
        const z = parseFloat(walkTarget.dataset.walkZ ?? row.dataset.walkZ);
        if (Number.isFinite(x) && Number.isFinite(z)) {
          this.world?.walkTo?.(x, z);
          this.closeMapModal();
        }
        return;
      }

      if (e.target.closest('.x-btn') || e.target === this.modalEl) {
        this.closeMapModal();
      }
    };
    this.modalEl.addEventListener('click', this.onModalClick);
  }

  teleportTo(x, z) {
    if (!this.world) return;
    const tx = Math.max(-17.2, Math.min(17.2, x));
    const tz = Math.max(-17.2, Math.min(17.2, z + 1.05));
    if (this.world.input) this.world.input.tapTarget = null;
    this.world.setLocalPosition?.(tx, tz);
    this.world.local?.pet?.placeNear?.({ x: tx, z: tz, right: true });
    this.world.fx?.emit?.('fx_stardust', tx, 0.1, tz, 8, { speed: 1.1, up: 0.85, size: 0.25, life: 0.55 });
    this.world.onLocalMove?.({ x: +tx.toFixed(3), z: +tz.toFixed(3), vx: 0, vz: 0, right: true, back: true }, true);
    this.world.checkLandmarksTrigger?.(tx, tz);
  }

  initWayfinder() {
    if (typeof document === 'undefined') return;
    this.wayfinderEl = document.querySelector('.wayfinder-edge-pill');
    if (!this.wayfinderEl) {
      this.wayfinderEl = document.createElement('button');
      this.wayfinderEl.type = 'button';
      this.wayfinderEl.className = 'wayfinder-edge-pill';
      this.wayfinderEl.hidden = true;
      const app = document.getElementById('app') || document.body;
      app?.appendChild(this.wayfinderEl);
    }
    this.onWayfinderClick = () => {
      if (this.wayfinderTarget) {
        this.world?.walkTo?.(this.wayfinderTarget.x, this.wayfinderTarget.z);
      }
    };
    this.wayfinderEl.addEventListener('click', this.onWayfinderClick);
  }

  setActive(active) {
    this.active = !!active;
    if (this.canvas) this.canvas.hidden = !this.active;
    if (!this.active) {
      if (this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
      if (this.wayfinderEl) this.wayfinderEl.hidden = true;
      this.closeMapModal();
    } else {
      if (!this.timer) {
        this.timer = setInterval(() => this.tick(), 100); // 10 Hz
      }
      this.tick();
    }
  }

  tick() {
    if (!this.active || !this.world) return;
    this.drawRadar();
    this.updateWayfinder();
  }

  renderRadar() {
    this.drawRadar();
  }

  drawRadar() {
    const ctx = this.ctx;
    if (!ctx) return;
    const w = 64, h = 64, cx = 32, cy = 32;
    ctx.clearRect(0, 0, w, h);

    ctx.save();

    // 1. Royal Astrolabe Circular Face (warm deep twilight-and-gold parchment)
    ctx.beginPath();
    ctx.arc(cx, cy, 30, 0, Math.PI * 2);
    const bgGrd = ctx.createRadialGradient(cx, cy, 3, cx, cy, 30);
    bgGrd.addColorStop(0, 'rgba(58, 38, 24, 0.92)');
    bgGrd.addColorStop(0.65, 'rgba(34, 23, 18, 0.94)');
    bgGrd.addColorStop(1, 'rgba(20, 14, 12, 0.98)');
    ctx.fillStyle = bgGrd;
    ctx.fill();

    // Outer double golden compass ring
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#e5b84b';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, 27.5, 0, Math.PI * 2);
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = 'rgba(255, 226, 148, 0.45)';
    ctx.stroke();

    ctx.clip();

    const L = this.world?.local;
    const lx = L?.x ?? 0;
    const lz = L?.z ?? 0;
    const scale = 1.32; // 1m ~ 1.32px

    // 2. Astrolabe degree rings & crosshairs
    ctx.strokeStyle = 'rgba(229, 184, 75, 0.18)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(cx, cy, 16, 0, Math.PI * 2);
    ctx.moveTo(cx, 6);
    ctx.lineTo(cx, 58);
    ctx.moveTo(6, cy);
    ctx.lineTo(58, cy);
    ctx.stroke();

    // 3. Fountain center 4-point star at world (0, 0)
    const fx = cx + (0 - lx) * scale;
    const fz = cy + (0 - lz) * scale;
    if (fx >= 4 && fx <= 60 && fz >= 4 && fz <= 60) {
      ctx.save();
      ctx.translate(fx, fz);
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const r = i % 2 === 0 ? 4.2 : 1.7;
        const a = (i * Math.PI) / 4;
        if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // 4. Color-coded landmark dots
    const lms = this.landmarks.length ? this.landmarks : (this.world?.townHallScene?.landmarks || []);
    for (const lm of lms) {
      if (lm.id === 'fountain') continue; // drawn as center star
      const px = cx + (lm.x - lx) * scale;
      const py = cy + (lm.z - lz) * scale;
      if (px >= 5 && px <= 59 && py >= 5 && py <= 59) {
        const meta = LANDMARK_META[lm.id] || { color: '#fbbf24' };
        ctx.fillStyle = meta.color;
        ctx.beginPath();
        ctx.arc(px, py, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 5. Remote players (Partner heart-dot, Friend green dot, Other blue dot)
    const profile = this.getProfile() || {};
    const partnerId = profile.partner_id;
    const friends = new Set(profile.friends || []);

    for (const r of this.world?.remotes?.values?.() || []) {
      const rx = r.smooth?.x ?? r.data?.x ?? 0;
      const rz = r.smooth?.z ?? r.data?.z ?? 0;
      const px = cx + (rx - lx) * scale;
      const py = cy + (rz - lz) * scale;
      if (px >= 5 && px <= 59 && py >= 5 && py <= 59) {
        if (r.id === partnerId) {
          // Partner pink-gold heart halo dot
          ctx.fillStyle = 'rgba(244, 114, 182, 0.35)';
          ctx.beginPath();
          ctx.arc(px, py, 5.0, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#f472b6';
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(px, py, 3.1, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(px, py, 2.7, 0, Math.PI * 2);
          ctx.fillStyle = friends.has(r.id) ? '#4ade80' : '#60a5fa';
          ctx.fill();
        }
      }
    }

    // 6. Local player golden-white compass arrow in center
    if (L) {
      const vx = L.mover?.vx || 0;
      const vz = L.mover?.vz || 0;
      const heading = Math.hypot(vx, vz) > 0.15
        ? Math.atan2(vz, vx)
        : (L.rig?.facing?.back ? -Math.PI / 2 : Math.PI / 2);

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(heading + Math.PI / 2);
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#d4af37';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(0, -4.5);
      ctx.lineTo(3.4, 3.6);
      ctx.lineTo(0, 1.8);
      ctx.lineTo(-3.4, 3.6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // 7. Cardinal ticks (N / E / S / W)
    ctx.font = 'bold 7px "Fredoka", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fde047';
    ctx.fillText('N', cx, 6.5);
    ctx.fillStyle = 'rgba(254, 243, 199, 0.72)';
    ctx.fillText('S', cx, 57.5);
    ctx.fillText('W', 6.5, cy);
    ctx.fillText('E', 57.5, cy);

    ctx.restore();
  }

  updateWayfinder() {
    if (!this.wayfinderEl || !this.world?.camera || !this.world.local) return;
    const profile = this.getProfile() || {};
    const partnerId = profile.partner_id;
    if (!partnerId) {
      this.wayfinderEl.hidden = true;
      this.wayfinderTarget = null;
      return;
    }

    const partner = this.world.remotes.get(partnerId);
    if (!partner) {
      this.wayfinderEl.hidden = true;
      this.wayfinderTarget = null;
      return;
    }

    const px = partner.smooth?.x ?? partner.data?.x ?? 0;
    const pz = partner.smooth?.z ?? partner.data?.z ?? 0;
    const L = this.world.local;

    const cam = this.world.camera;
    const v = new THREE.Vector3(px, 0.6, pz).project(cam);

    const isBehind = v.z > 1.0;
    const isOffScreen = isBehind || Math.abs(v.x) > 0.85 || Math.abs(v.y) > 0.85;

    if (!isOffScreen) {
      this.wayfinderEl.hidden = true;
      this.wayfinderTarget = null;
      return;
    }

    this.wayfinderTarget = { x: px, z: pz };
    const dist = Math.round(Math.hypot(px - L.x, pz - L.z));
    const partnerName = partner.data?.username || 'Partner';

    let ndcX = v.x;
    let ndcY = v.y;
    if (isBehind) {
      ndcX = -ndcX;
      ndcY = -ndcY;
    }
    const edgeLimit = 0.82;
    const scale = edgeLimit / Math.max(Math.abs(ndcX), Math.abs(ndcY), 0.001);
    ndcX *= scale;
    ndcY *= scale;

    const ang = Math.atan2(ndcY, ndcX);
    let arrow = '↗';
    const deg = ((ang * 180) / Math.PI + 360) % 360;
    if (deg >= 337.5 || deg < 22.5) arrow = '→';
    else if (deg >= 22.5 && deg < 67.5) arrow = '↗';
    else if (deg >= 67.5 && deg < 112.5) arrow = '↑';
    else if (deg >= 112.5 && deg < 157.5) arrow = '↖';
    else if (deg >= 157.5 && deg < 202.5) arrow = '←';
    else if (deg >= 202.5 && deg < 247.5) arrow = '↙';
    else if (deg >= 247.5 && deg < 292.5) arrow = '↓';
    else if (deg >= 292.5 && deg < 337.5) arrow = '↘';

    const r = this.world.canvas.getBoundingClientRect();
    const sx = r.left + ((ndcX + 1) / 2) * r.width;
    const sy = r.top + ((1 - ndcY) / 2) * r.height;

    this.wayfinderEl.hidden = false;
    this.wayfinderEl.textContent = `💞 ${partnerName} • ${dist}m ${arrow}`;
    this.wayfinderEl.style.left = `${Math.round(sx)}px`;
    this.wayfinderEl.style.top = `${Math.round(sy)}px`;
  }

  renderMapModal() {
    if (!this.modalEl) return;
    const L = this.world?.local;
    const lx = L?.x || 0, lz = L?.z || 0;
    const lms = this.landmarks.length ? this.landmarks : (this.world?.townHallScene?.landmarks || []);

    const lmRows = lms
      .map((lm) => {
        const d = Math.round(Math.hypot(lm.x - lx, lm.z - lz));
        const meta = LANDMARK_META[lm.id] || { icon: lm.icon || '🏛️', cat: 'Landmark', color: '#fbbf24' };
        return `
        <div class="town-map-row" data-walk-x="${lm.x}" data-walk-z="${lm.z}">
          <span class="map-icon">${meta.icon || lm.icon}</span>
          <div class="map-meta">
            <span class="map-title">${lm.label}</span>
            <span class="map-coords">${meta.cat} • (${lm.x}, ${lm.z})</span>
          </div>
          <span class="map-dist">${d}m</span>
          <div class="map-actions" style="display:flex;gap:4px;flex:0 0 auto;">
            <button type="button" class="btn-gold small map-walk-btn" data-map-walk="${lm.id}" data-walk-x="${lm.x}" data-walk-z="${lm.z}">🚶 Walk</button>
            <button type="button" class="btn-gold small emerald map-tp-btn" data-map-tp="${lm.id}" data-tp-x="${lm.x}" data-tp-z="${lm.z}">⚡ TP</button>
          </div>
        </div>
      `;
      })
      .join('');

    const profile = this.getProfile() || {};
    const partnerId = profile.partner_id;
    const friends = new Set(profile.friends || []);

    const playerList = [...(this.world?.remotes?.values?.() || [])];
    const liveOnlineCount = playerList.length + (L ? 1 : 0);

    const playerRows = playerList.length
      ? playerList
          .map((r) => {
            const rx = r.smooth?.x ?? r.data?.x ?? 0;
            const rz = r.smooth?.z ?? r.data?.z ?? 0;
            const d = Math.round(Math.hypot(rx - lx, rz - lz));
            const isPartner = r.id === partnerId;
            const isFriend = friends.has(r.id);
            const icon = isPartner ? '💞' : isFriend ? '💚' : '👤';
            const lvTag = r.data?.level ? `Lv.${r.data.level}` : '';
            const titleTag = r.data?.title ? ` • ${r.data.title}` : '';
            const roleLabel = isPartner
              ? `Bound Partner${lvTag ? ` • ${lvTag}` : ''}`
              : isFriend
                ? `Friend${lvTag ? ` • ${lvTag}` : ''}${titleTag}`
                : `Citizen${lvTag ? ` • ${lvTag}` : ''}${titleTag}`;
            return `
        <div class="town-map-row" data-walk-x="${rx}" data-walk-z="${rz}">
          <span class="map-icon">${icon}</span>
          <div class="map-meta">
            <span class="map-title">${r.data?.username || 'Player'}</span>
            <span class="map-coords">${roleLabel}</span>
          </div>
          <span class="map-dist">${d}m</span>
          <div class="map-actions" style="display:flex;gap:4px;flex:0 0 auto;">
            <button type="button" class="btn-gold small map-walk-btn" data-map-walk="${r.id}" data-walk-x="${rx}" data-walk-z="${rz}">🚶 Walk</button>
            <button type="button" class="btn-gold small emerald map-tp-btn" data-map-tp="${r.id}" data-tp-x="${rx}" data-tp-z="${rz}">⚡ TP</button>
          </div>
        </div>
      `;
          })
          .join('')
      : '<div class="town-map-empty">✨ You are currently the only sovereign in this plaza instance</div>';

    this.modalEl.innerHTML = `
      <section class="parchment town-map-card">
        <div class="parchment-title">🧭 Royal Astrolabe &amp; Plaza Waypoints</div>
        <button type="button" class="x-btn" data-act="close-town-map">✕</button>
        <div class="town-map-sections">
          <div class="town-map-sec-head" style="display:flex;justify-content:space-between;align-items:center;">
            <span>🏛️ Town Hall Landmarks (${lms.length})</span>
            <span style="font-size:11px;color:#059669;">🟢 ${liveOnlineCount} Online in Plaza</span>
          </div>
          <div class="town-map-list">${lmRows}</div>
          <div class="town-map-sec-head">👥 Other Citizens Nearby (${playerList.length})</div>
          <div class="town-map-list">${playerRows}</div>
        </div>
      </section>
    `;
    this.modalEl.hidden = false;
  }

  openMapModal() {
    this.renderMapModal();
  }

  closeMapModal() {
    if (this.modalEl) this.modalEl.hidden = true;
  }

  destroy() {
    this.setActive(false);
    if (this.canvas && this.onCanvasClick) this.canvas.removeEventListener('click', this.onCanvasClick);
    if (this.modalEl && this.onModalClick) this.modalEl.removeEventListener('click', this.onModalClick);
    if (this.wayfinderEl && this.onWayfinderClick) this.wayfinderEl.removeEventListener('click', this.onWayfinderClick);
    this.canvas?.remove();
    this.modalEl?.remove();
    this.wayfinderEl?.remove();
  }
}
