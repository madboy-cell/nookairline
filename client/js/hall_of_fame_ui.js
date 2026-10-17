// client/js/hall_of_fame_ui.js — Hall of Fame modal (Screen 06)
// 5 Statue Cards (data-hall-cat), Category tabs, Leaderboard rows with inspect/visit, Worship button

import { renderOutfitThumbLayers } from './ui_components.js';

const DEFAULT_CATEGORIES = [
  { key: 'architect', label: 'Grand Architect', icon: '🏰', scoreLabel: 'Kingdom Score' },
  { key: 'gear', label: 'Grand Warrior', icon: '⚔️', scoreLabel: 'Combat Power' },
  { key: 'arcade', label: 'Arcade Master', icon: '🕹️', scoreLabel: 'Best Wave' },
  { key: 'tycoon', label: 'Monopoly Tycoon', icon: '🪙', scoreLabel: 'Gold Won' },
  { key: 'couple', label: 'Star Couple', icon: '💞', scoreLabel: 'Couple Streak' },
];

const CAT_META = {
  architect: { shortTab: '🌸 Comfort', badge: 'Architect', icon: '🏰' },
  gear:      { shortTab: '👑 Power',   badge: '+10 Gear',  icon: '⚔️' },
  arcade:    { shortTab: '🐾 Pets',    badge: 'Arcade',    icon: '🕹️' },
  tycoon:    { shortTab: '🎲 Tycoon',  badge: 'Tycoon',    icon: '🎲' },
  couple:    { shortTab: '💖 Streak',  badge: 'Couples',   icon: '💖' },
  cp:        { shortTab: '👑 Power',   badge: '+10 Gear',  icon: '⚔️' },
  comfort:   { shortTab: '🌸 Comfort', badge: 'Architect', icon: '🏰' },
  monopoly:  { shortTab: '🎲 Tycoon',  badge: 'Tycoon',    icon: '🎲' },
  streak:    { shortTab: '💖 Streak',  badge: 'Couples',   icon: '💖' },
  pets:      { shortTab: '🐾 Pets',    badge: 'Pets',      icon: '🐾' },
};

const CHAMPION_LOOK_PRESETS = {
  nook:  { outfit: 's11_zeus_olympus',     lineage: 'bkk', appearance: { body: 'boy',  hair: 'hair_boy_fluffy',  hairColor: 'silver' } },
  beam:  { outfit: 's7_cinderella_clock',  lineage: 'dxb', appearance: { body: 'girl', hair: 'hair_girl_waves',  hairColor: 'coral' } },
  neen:  { outfit: 's8_glacial_elsa',      lineage: 'dxb', appearance: { body: 'girl', hair: 'hair_girl_waves',  hairColor: 'honey' } },
  mochi: { outfit: 's2_kitsune_inari',     lineage: 'dxb', appearance: { body: 'girl', hair: 'hair_girl_waves',  hairColor: 'chestnut' } },
  leo:   { outfit: 's4_casino_royale',     lineage: 'bkk', appearance: { body: 'boy',  hair: 'hair_boy_fluffy',  hairColor: 'midnight' } },
};

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export class HallOfFameUI {
  constructor({ request, toast = null, humanError = null, getProfile = null, rpg = null, getNet = null }) {
    this.request = request;
    this.toast = toast || ((m) => console.log(m));
    this.humanError = humanError || ((e) => e);
    this.getProfile = getProfile || (() => ({}));
    this.rpg = rpg;
    this.getNet = getNet || (() => null);

    this.selectedCat = 'architect';
    this.categories = [];
    this.worshippedToday = false;
    this.day = null;
    this.inspectUser = null;

    this.initDom();
  }

  resolvePlayerLook(userId, idx = 0) {
    const uid = String(userId || '').toLowerCase();
    const self = this.getProfile?.() || {};
    if (uid && self.id && uid === String(self.id).toLowerCase()) {
      const eqOut = self.equipped?.outfit?.id || (typeof self.equipped?.outfit === 'string' ? self.equipped.outfit : null);
      return {
        outfit: eqOut || 's11_zeus_olympus',
        lineage: self.lineage || 'bkk',
        appearance: self.appearance || { body: 'boy', hair: 'hair_boy_fluffy', hairColor: 'silver' },
      };
    }
    const rem = typeof window !== 'undefined' ? window.__neora?.world?.remotes?.get?.(uid)?.data : null;
    if (rem) {
      const eqOut = rem.equipped?.outfit?.id || (typeof rem.equipped?.outfit === 'string' ? rem.equipped.outfit : null);
      return {
        outfit: eqOut || 'rare_royal_scholar',
        lineage: rem.lineage || 'bkk',
        appearance: rem.appearance || { body: rem.lineage === 'dxb' ? 'girl' : 'boy', hair: rem.lineage === 'dxb' ? 'hair_girl_waves' : 'hair_boy_fluffy', hairColor: 'chestnut' },
      };
    }
    if (CHAMPION_LOOK_PRESETS[uid]) return CHAMPION_LOOK_PRESETS[uid];
    const fallbackKeys = Object.keys(CHAMPION_LOOK_PRESETS);
    return CHAMPION_LOOK_PRESETS[fallbackKeys[idx % fallbackKeys.length]];
  }

  initDom() {
    this.el = document.getElementById('hall-of-fame-modal');
    if (!this.el) {
      this.el = document.createElement('div');
      this.el.id = 'hall-of-fame-modal';
      this.el.className = 'modal-wrap hall-of-fame-modal';
      this.el.hidden = true;
      const app = document.getElementById('app') || document.body;
      app.appendChild(this.el);
    }
    this.el.addEventListener('click', (e) => this.onClick(e));
  }

  async open(catKey = null) {
    if (catKey) {
      if (catKey === 'statue_1' || catKey === 'comfort') this.selectedCat = 'architect';
      else if (catKey === 'statue_2' || catKey === 'cp') this.selectedCat = 'gear';
      else if (catKey === 'statue_3' || catKey === 'pets') this.selectedCat = 'arcade';
      else if (catKey === 'statue_4' || catKey === 'monopoly') this.selectedCat = 'tycoon';
      else if (catKey === 'statue_5' || catKey === 'streak') this.selectedCat = 'couple';
      else this.selectedCat = catKey;
    }

    this.el.hidden = false;
    this.el.innerHTML = `
      <section class="parchment hall-card">
        <div class="parchment-title">🏛️ Hall of Fame — Sanctuary of Champions</div>
        <button type="button" class="x-btn">✕</button>
        <div class="hall-loading">Loading Champions… ✨</div>
      </section>
    `;

    try {
      const res = await this.request('hall_list', {});
      if (res && res.ok) {
        this.categories = res.categories || [];
        this.worshippedToday = !!res.worshippedToday;
        this.day = res.day;
        if (!this.categories.some((c) => c.key === this.selectedCat) && this.categories.length) {
          this.selectedCat = this.categories[0].key;
        }
        this.render();
      } else {
        this.toast(`⚠️ ${this.humanError(res?.error || 'Failed to load Hall of Fame')}`);
        this.close();
      }
    } catch (err) {
      this.toast(`⚠️ ${err.message || 'Network error'}`);
      this.close();
    }
  }

  close() {
    if (this.el) this.el.hidden = true;
    this.inspectUser = null;
  }

  async onClick(e) {
    if (e.target.closest('.x-btn') || e.target === this.el) {
      this.close();
      return;
    }

    const statueCard = e.target.closest('[data-hall-cat]');
    if (statueCard) {
      this.selectedCat = statueCard.dataset.hallCat;
      this.render();
      return;
    }

    const tabBtn = e.target.closest('[data-cat-tab]');
    if (tabBtn) {
      this.selectedCat = tabBtn.dataset.catTab;
      this.render();
      return;
    }

    const worshipBtn = e.target.closest('[data-act="hall-worship"]');
    if (worshipBtn) {
      if (this.worshippedToday) {
        this.toast('🙏 You have already worshipped the champions today!');
        return;
      }
      try {
        worshipBtn.disabled = true;
        const res = await this.request('hall_worship', {});
        if (res && res.ok) {
          this.worshippedToday = true;
          this.toast(`🙏 Champions blessed you! +${res.gold || 200} 🪙 & +${res.diamonds || 15} 💎`);
          this.render();
        } else {
          this.toast(`⚠️ ${this.humanError(res?.error || 'Worship failed')}`);
          worshipBtn.disabled = false;
        }
      } catch (err) {
        this.toast(`⚠️ ${err.message}`);
        worshipBtn.disabled = false;
      }
      return;
    }

    const inspectBtn = e.target.closest('[data-inspect-user]');
    if (inspectBtn) {
      const uid = inspectBtn.dataset.inspectUser;
      const cat = this.getActiveCategory();
      const row = (cat?.rows || []).find((r) => r.userId === uid);
      if (row) {
        this.inspectUser = row;
        this.render();
      } else if (this.rpg?.openInspect) {
        this.rpg.openInspect(uid);
      }
      return;
    }

    const closeInspectBtn = e.target.closest('[data-act="close-inspect"]');
    if (closeInspectBtn) {
      this.inspectUser = null;
      this.render();
      return;
    }

    const visitBtn = e.target.closest('[data-visit-user]');
    if (visitBtn) {
      const uid = visitBtn.dataset.visitUser;
      const uname = visitBtn.dataset.visitName || uid || 'Player';
      const net = this.getNet?.();
      if (net && uid) {
        this.close();
        net.send({ type: 'instance_switch', to: uid });
        this.toast(`🏠 Visiting ${uname}'s Sky Kingdom!`);
      } else {
        this.toast(`🏠 Visiting ${uname}'s kingdom!`);
      }
      return;
    }
  }

  getActiveCategory() {
    return this.categories.find((c) => c.key === this.selectedCat)
      || this.categories[0]
      || DEFAULT_CATEGORIES.find((c) => c.key === this.selectedCat);
  }

  render() {
    const cats = this.categories.length ? this.categories : DEFAULT_CATEGORIES;
    const activeCat = this.getActiveCategory();

    // 5 Statue Cards in V-Formation Diorama Stage (rows[0] champion)
    const statueCardsHtml = cats.slice(0, 5).map((cat, idx) => {
      const champ = cat.rows?.[0] || null;
      const isSelected = cat.key === this.selectedCat;
      const meta = CAT_META[cat.key] || { shortTab: cat.label, badge: cat.label, icon: cat.icon || '🏆' };
      const name = champ ? esc(champ.username) : 'Vacant';
      const statVal = champ?.value != null ? Number(champ.value).toLocaleString() : '—';
      const worships = champ?.worship_count || 0;
      const look = this.resolvePlayerLook(champ?.userId || champ?.username, idx);
      const chibiHtml = renderOutfitThumbLayers(look.outfit, {
        lineage: look.lineage,
        appearance: look.appearance,
        alt: name,
      });

      return `
        <div class="hall-statue-card v-pos-${idx + 1} ${isSelected ? 'active' : ''}" data-hall-cat="${cat.key}">
          <div class="statue-pedestal-num">Pedestal ${idx + 1}</div>
          <div class="statue-badge">${meta.icon} #1 ${esc(meta.badge)}</div>
          <div class="statue-diorama-figure">
            <div class="statue-chibi-wrap">
              ${chibiHtml}
            </div>
            <img class="statue-pedestal-img" src="/assets/ui/th_statue_pedestal.png" alt="Pedestal" />
          </div>
          <div class="statue-champ-name">${name}</div>
          <div class="statue-champ-val">${statVal}</div>
          <div class="statue-worship-tag">🙏 ${worships}</div>
        </div>
      `;
    }).join('');

    // 5 Compact Category Folder Tabs
    const tabsHtml = cats.slice(0, 5).map((cat) => {
      const meta = CAT_META[cat.key] || { shortTab: `${cat.icon || '🏆'} ${cat.label}` };
      return `
        <button type="button" class="hall-cat-tab ${cat.key === this.selectedCat ? 'active' : ''}" data-cat-tab="${cat.key}">
          <span>${meta.shortTab}</span>
        </button>
      `;
    }).join('');

    // Ornate Cream-Parchment Leaderboard Rows
    const rows = activeCat?.rows || [];
    const rowsHtml = rows.length ? rows.map((r, i) => {
      const rankNum = r.rank || (i + 1);
      const rankClass = i === 0 ? 'rank-1' : (i === 1 ? 'rank-2' : (i === 2 ? 'rank-3' : ''));
      const rankBadge = i === 0 ? '🥇 1' : (i === 1 ? '🥈 2' : (i === 2 ? '🥉 3' : `#${rankNum}`));
      const valStr = r.value != null ? Number(r.value).toLocaleString() : '0';
      const titleStr = r.title ? `👑 ${esc(r.title)}` : '👑 Sky Party Founder';
      const look = this.resolvePlayerLook(r.userId || r.username, i);
      const miniChibiHtml = renderOutfitThumbLayers(look.outfit, {
        lineage: look.lineage,
        appearance: look.appearance,
        headCrop: true,
        alt: r.username,
      });

      return `
        <div class="hall-row ${rankClass}">
          <div class="hall-rank">${rankBadge}</div>
          <div class="hall-row-avatar">${miniChibiHtml}</div>
          <div class="hall-player-meta">
            <div class="hall-player-name">${esc(r.username)}</div>
            <div class="hall-player-sub">
              <span class="hall-title-pill">${titleStr}</span>
              <span class="hall-cp-tag">⚔️ CP ${Number(r.cp || 0).toLocaleString()}</span>
            </div>
          </div>
          <div class="hall-score">${valStr}</div>
          <div class="hall-actions">
            <button type="button" class="btn-gold small hall-act-btn" data-inspect-user="${esc(r.userId)}">🔍 Inspect</button>
            <button type="button" class="btn-gold small outline hall-act-btn" data-visit-user="${esc(r.userId)}" data-visit-name="${esc(r.username)}">🏠 Visit</button>
          </div>
        </div>
      `;
    }).join('') : '<div class="hall-empty">No contenders recorded in this category yet.</div>';

    // Inspect Card Modal Overlay
    let inspectOverlayHtml = '';
    if (this.inspectUser) {
      const u = this.inspectUser;
      const look = this.resolvePlayerLook(u.userId || u.username, 0);
      inspectOverlayHtml = `
        <div class="hall-inspect-modal">
          <div class="hall-inspect-card parchment">
            <div class="parchment-title">👑 Champion Dossier: ${esc(u.username)}</div>
            <div class="inspect-avatar-circle">
              ${renderOutfitThumbLayers(look.outfit, { lineage: look.lineage, appearance: look.appearance })}
            </div>
            <div class="inspect-field"><b>Title:</b> 👑 ${esc(u.title || 'Sky Party Founder')}</div>
            <div class="inspect-field"><b>Combat Power (CP):</b> ⚔️ ${Number(u.cp || 0).toLocaleString()}</div>
            <div class="inspect-field"><b>Category Record:</b> 🏆 ${u.value != null ? Number(u.value).toLocaleString() : '0'}</div>
            <div class="inspect-field"><b>Times Worshipped:</b> 🙏 ${u.worship_count || 0} times</div>
            <button type="button" class="btn-gold small" data-act="close-inspect">Close Dossier</button>
          </div>
        </div>
      `;
    }

    this.el.innerHTML = `
      <section class="parchment hall-card">
        <button type="button" class="x-btn">✕</button>

        <div class="hall-statues-stage">
          <div class="hall-stage-ribbon">
            <img src="/assets/ui/ui_ribbon_gold_title.png" alt="" class="hall-ribbon-bg" />
            <span>🏛️ HALL OF FAME LEADERBOARD</span>
          </div>

          <div class="hall-statues-grid">
            ${statueCardsHtml}
          </div>

          <div class="hall-crowd-strip">
            <img src="/assets/monopoly/gacha_vip_crowd.png" alt="" class="hall-crowd-img" />
            <span>👏 Villagers cheering at the Grand Colonnade!</span>
          </div>
        </div>

        <div class="hall-tabs hall-cat-tabs">
          ${tabsHtml}
        </div>

        <div class="hall-leaderboard-box">
          <div class="hall-rows-list">
            ${rowsHtml}
          </div>
        </div>

        <div class="hall-footer">
          <button type="button" class="btn-gold hall-worship-btn" data-act="hall-worship" ${this.worshippedToday ? 'disabled' : ''}>
            <span>${this.worshippedToday ? '✅ Worshipped Champions Today' : '🙏 Worship Statues (+100 🪙, +20 🍓 — 1/day)'}</span>
            <small>${this.worshippedToday ? '(Resets daily at 00:00 UTC)' : '(Daily Free Blessing: +200 🪙 & +15 💎!)'}</small>
          </button>
        </div>

        ${inspectOverlayHtml}
      </section>
    `;
  }
}
