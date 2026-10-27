// client/js/table_hub.js — Universal 4-Seat Table Hub UI (Screen 09, Implementation Plan §10.A).
// 4 mode tabs · 2.5D 4-chair VIP table preview (Ready / Bot: Easy-Hard-Insane / Invite-Tap to Sit) ·
// live open tables with Hot-Join · [⚡ Play Solo Now (Instant)] [🚀 Launch 4-Player Match!].
// Talks only to a room transport (LocalRoom / NetRoom) — no game logic lives here.
import { MODES } from '/shared/universal_room.js';
import { PODIUM } from '/shared/monopoly_rules.js';
import { ALL_BUILDS, BUILD_PERKS, detectBuild, getWeeklyWeather, leagueTierFor, DASH_DAILY_CHEST_MAX } from '/shared/dash_builds.js';
import { computeUniversalStats } from '/shared/universal_stats.js';
import { normalizePetId, PETS } from '/shared/pet_catalog.js';
import { MONSTER_SKILLS } from '/shared/combat_rules.js';

const modesBase = { ...MODES };
delete modesBase.moon_bunny;

export const HUB_MODES = Object.freeze({
  ...modesBase,
  monopoly: { ...(MODES.monopoly || {}), label: 'Sky Monopoly', icon: '🎲', iconImg: '/assets/ui/dice_zeus_thunder.png', available: true, minSeats: 2 },
  casino: { ...(MODES.casino || {}), label: 'Grand Casino', icon: '🎰', iconImg: '/assets/monopoly/mono_ult_roulette.png', available: true, minSeats: 1 },
  sky_frontier: { label: 'Sky Frontier', icon: '🏝️', available: true, minSeats: 1 },
  cloud_dash: { ...(MODES.cloud_dash || {}), label: 'Cloud Dash', icon: '☁️', iconImg: '/assets/ui/icon_cloud_dash.png', available: true, minSeats: 1 },
});

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const portrait = (lineage, seat = null) => {
  const lin = (typeof lineage === 'object' ? lineage?.lineage : lineage) || 'bkk';
  const s = typeof lineage === 'object' ? lineage : seat;
  const outfit = s?.outfit || s?.equipped?.outfit?.id || (typeof s?.equipped?.outfit === 'string' ? s.equipped.outfit : null);
  if (outfit && outfit !== 'newbie_outfit') return `/assets/chibi/${lin}_${outfit}_front.png`;
  return `/assets/chibi/${lin}_base_front.png`;
};
const DIFF_LABEL = { easy: '🤖 Bot: Easy', hard: '🤖 Bot: Hard (400💎)', insane: '🤖 Bot: Insane (950💎)' };
const DIFF_SHORT = { easy: 'Bot: Easy', hard: 'Bot: Hard', insane: 'Bot: Insane' };
const SEAT_ROLE = ['Host', 'Partner', 'Seat 3', 'Seat 4'];
const modeOf = (t) => t?.options?.matchMode || t?.matchMode || null;

export class TableHub {
  /**
   * @param {HTMLElement} host
   * @param {object} room   LocalRoom | NetRoom
   * @param {object} o      { toast(msg), onClose(), profile, onCreate, onJoin, onSeatClick, onReady, onStart, onSolo, onAddBot, onLeave, onModeChange, onCasinoStart, onMoonDefenseStart, onCloudDashStart }
   */
  constructor(host, room, {
    toast = () => {}, onClose = () => {}, profile = null,
    onCreate = null, onJoin = null, onSeatClick = null, onReady = null,
    onStart = null, onSolo = null, onAddBot = null, onLeave = null, onModeChange = null,
    onCasinoStart = () => {}, onMoonDefenseStart = () => {}, onCloudDashStart = () => {},
  } = {}) {
    this.room = room;
    this.toast = toast;
    this.onClose = onClose;
    this.profile = profile;
    this.onCreate = onCreate;
    this.onJoin = onJoin;
    this.onSeatClick = onSeatClick;
    this.onReady = onReady;
    this.onStart = onStart;
    this.onSolo = onSolo;
    this.onAddBot = onAddBot;
    this.onLeave = onLeave;
    this.onModeChange = onModeChange;
    this.onCasinoStart = onCasinoStart;
    this.onMoonDefenseStart = onMoonDefenseStart;
    this.onCloudDashStart = onCloudDashStart;
    this.mode = 'monopoly';
    this.matchMode = 'normal';
    this.casinoGame = 'pokdeng';
    this.dashMode = 'quick';
    this.buildBookOpen = false;
    this.botDiff = 'hard';
    this.table = null;
    this.tables = [];
    this._casinoStarted = false;
    this._casinoStartedTableId = null;
    this._moonStarted = false;
    this._moonStartedTableId = null;
    this._cdStarted = false;
    this._cdStartedTableId = null;
    this._frontierScrollTop = 0;
    if (!document.getElementById('hub-dash-styles')) {
      const st = document.createElement('style');
      st.id = 'hub-dash-styles';
      st.textContent = `
body:has(.hub-wrap:not([hidden])) #hud-guide-pill,
body:has(.hub-wrap:not([hidden])) #hud-couple-pill{display:none!important}
body:has(.hub-wrap:not([hidden])) #toast{top:calc(var(--safe-top, 0px) + 58px)!important;z-index:120!important}
.hub{position:relative}
.frontier-hub-card{overscroll-behavior:contain;-webkit-overflow-scrolling:touch}
.hub-btn,.hub-tab,.hub-x{touch-action:manipulation;-webkit-tap-highlight-color:transparent}
.hub-table-card.dash{background:radial-gradient(ellipse at 50% 48%,#2e5b9e 0%,#1d3a6e 64%,#102244 100%);border-color:#e6b44c}
.hub-table-card.dash .hub-stage.hub-stage-diorama{height:calc(152px * var(--s))}
.hub-table-card.dash .hub-board,.hub-table-card.dash .hub-vip-table-img{display:none}
.hub-dash-diorama{position:absolute;left:50%;top:50%;width:162px;height:114px;transform:translate(-50%,-50%);pointer-events:none;z-index:1;display:flex;align-items:center;justify-content:center}
.hub-dash-preview-img{width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 6px 14px rgba(0,0,0,.55)) drop-shadow(0 0 14px rgba(255,216,107,.5))}
.hub-dash-pet-emblem{position:absolute;right:2px;bottom:2px;width:40px;height:40px;border-radius:50%;background:radial-gradient(circle,#fff9ea 0%,#f5cb6c 75%,#b87a1a 100%);border:2px solid #3a2415;box-shadow:0 3px 8px rgba(0,0,0,.55),0 0 0 1.5px #ffd97d inset;display:flex;align-items:center;justify-content:center;overflow:hidden}
.hub-dash-pet-emblem img{width:34px;height:34px;object-fit:contain;filter:drop-shadow(0 1px 2px rgba(0,0,0,.35))}
.hub-dash-picker{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px;padding:5px 8px 4px;background:rgba(16,30,62,.58);border-bottom:1.5px solid rgba(230,180,76,.35)}
.hub-dash-btn{font-size:.78em;padding:4px 3px;border-radius:10px;font-weight:900;line-height:1.15;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hub-dash-btn small{display:inline;font-size:.86em;font-weight:800;opacity:.92}
.hub-dash-meta-bar{display:flex;gap:5px;align-items:center;justify-content:space-between;flex-wrap:wrap;padding:4px 8px;background:rgba(12,22,48,.68);border-bottom:1.5px solid rgba(230,180,76,.3);font-size:.75em;font-weight:800;color:#fff8e7}
.hub-weather-pill{background:linear-gradient(180deg,rgba(68,120,210,.55),rgba(38,76,150,.65));border:1px solid rgba(165,210,255,.55);border-radius:8px;padding:2px 6px;color:#f0f8ff;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hub-chest-pill{background:linear-gradient(180deg,rgba(215,138,38,.55),rgba(148,84,18,.65));border:1px solid rgba(255,220,130,.6);border-radius:8px;padding:2px 6px;color:#fff6d6;white-space:nowrap}
.hub-streak-pill{background:linear-gradient(180deg,#e63946,#9d0208);border:1px solid #ffd166;border-radius:8px;padding:2px 6px;color:#fff5b0;white-space:nowrap}
.hub-preset-bar{display:flex;gap:4px;align-items:center;justify-content:space-between;flex-wrap:nowrap;padding:4px 6px;background:rgba(16,28,58,.75);border-top:1.5px solid rgba(230,180,76,.35);font-size:.74em;font-weight:800}
.hub-preset-label{color:#ffe8a3;font-weight:900;white-space:nowrap;font-size:1.05em}
.hub-preset-slots{display:flex;gap:3px;flex:1;min-width:0}
.hub-preset-slot{display:inline-flex;align-items:center;flex:1;min-width:0;background:linear-gradient(180deg,#fff8e6,#ebd2a0);border:1.5px solid #8a5a2b;border-radius:8px;padding:1px;box-shadow:inset 0 1px 0 rgba(255,255,255,.75),0 2px 0 #3a2415}
.hub-preset-btn{background:none;border:0;color:#3a1d04;font:900 .9em var(--font,inherit);cursor:pointer;padding:2px 3px;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:center;box-shadow:none}
.hub-preset-btn:active{transform:translateY(1px)}
.hub-preset-save{background:rgba(138,90,43,.16);border:0;border-left:1px solid rgba(138,90,43,.35);border-radius:0 6px 6px 0;cursor:pointer;font-size:.88em;padding:2px 3px;line-height:1;box-shadow:none}
.hub-preset-save:active{transform:scale(.95)}
.hub-builds-toggle{background:linear-gradient(180deg,#ffe896 0%,#f0a828 100%);color:#3a1d04;border:2px solid #3a2415;border-radius:9px;padding:3px 6px;font:900 .92em var(--font,inherit);cursor:pointer;white-space:nowrap;box-shadow:inset 0 1.5px 0 rgba(255,255,255,.8),0 2.5px 0 #3a2415}
.hub-builds-toggle:active{transform:translateY(1px)}
.hub-build-book-backdrop{position:absolute;inset:0;z-index:95;background:rgba(24,12,4,.75);display:flex;flex-direction:column;border-radius:17px;overflow:hidden}
.hub-build-book{flex:1;display:flex;flex-direction:column;min-height:0;background:linear-gradient(180deg,#fff8e8 0%,#f5e2bc 100%);color:#3a2415;box-sizing:border-box}
.hub-build-book-header{position:relative;display:flex;align-items:center;justify-content:center;padding:9px 42px;color:#fff8e7;font-weight:900;background:linear-gradient(180deg,#8f582a 0%,#5c3416 100%);border-bottom:3px solid #3a2415;box-shadow:inset 0 1.5px 0 rgba(255,232,178,.45);text-shadow:0 2px 0 #2a1406}
.hub-build-book-header h3{margin:0;font-size:1.05em;font-weight:900;color:#fff8e7;text-align:center}
.hub-build-book-list{flex:1;min-height:0;overflow-y:auto;padding:8px 10px 12px;display:flex;flex-direction:column;gap:7px}
.hub-build-active-banner{display:flex;align-items:center;justify-content:space-between;gap:6px;padding:6px 10px;border-radius:11px;background:linear-gradient(180deg,#fff4c2 0%,#f7cb60 100%);border:2px solid #9a5a10;color:#3a1d04;font-weight:900;font-size:.92em;box-shadow:inset 0 1px 0 rgba(255,255,255,.85),0 2px 0 #6b3f1f}
.hub-build-sec-head{font-size:.82em;font-weight:900;color:#6b3410;text-transform:uppercase;letter-spacing:.4px;margin:4px 2px 0;display:flex;align-items:center;justify-content:space-between}
.hub-build-card{border:2px solid #c9932c;border-radius:12px;background:linear-gradient(180deg,#fffdf8 0%,#f8ebd0 100%);padding:7px 9px;text-align:left;color:#3a2008;box-shadow:inset 0 1px 0 #fff,0 2px 0 rgba(138,90,43,.22)}
.hub-build-card.is-current{border-color:#2e8b2a;background:linear-gradient(180deg,#f7fff5 0%,#e3f7de 100%);box-shadow:0 0 0 2px rgba(46,139,42,.3),0 2px 0 #1e6b1a}
.hub-build-card.locked{background:linear-gradient(180deg,#f5ead4 0%,#ead8b8 100%);border-color:#b59463;border-style:dashed;opacity:.92}
.hub-build-card-head{display:flex;align-items:center;gap:6px}
.hub-build-icon{font-size:1.25em;line-height:1;display:inline-flex;align-items:center;gap:1px}
.hub-build-name{font-weight:900;font-size:1em;flex:1;color:#3a1d04}
.hub-build-badge{font-weight:900;font-size:.76em;border-radius:999px;padding:2px 7px;background:#f0dfc0;border:1px solid #b58442;color:#5c3416;white-space:nowrap}
.hub-build-badge.active{background:linear-gradient(180deg,#6ee755,#268e22);border-color:#165614;color:#fff;text-shadow:0 1px 0 rgba(0,0,0,.35)}
.hub-build-badge.hybrid{background:linear-gradient(180deg,#ffe596,#f0a828);border-color:#9a5a10;color:#3a1d04}
.hub-build-badge.locked{background:#e2d1b3;border-color:#a6885b;color:#6b4c28}
.hub-build-desc{margin:3px 0 2px;font-size:.82em;font-weight:700;color:#5c3416;line-height:1.25}
.hub-build-hint{margin:3px 0 1px;font-size:.82em;font-weight:800;color:#8f2d14;line-height:1.25}
.hub-build-perks{margin:4px 0 0;padding-left:0;list-style:none;font-size:.8em;font-weight:800;line-height:1.35;color:#1f6e26}
.hub-build-perks li{margin:1px 0}
.hub-build-perks li.tier-locked{color:#7a5835;font-weight:700}
`;
      document.head.appendChild(st);
    }
    this.root = document.createElement('div');
    this.root.className = 'hub-wrap';
    this.root.hidden = true;
    host.appendChild(this.root);
    this.off = [
      room.on('table_state', (m) => {
        if (m.table) {
          const prevTableId = this.table?.id;
          const prevTableMode = this.table?.mode || null;
          this.table = m.table;
          const isMyHost = m.table.hostId === this.me;
          if (m.table.mode && (isMyHost || m.table.status === 'playing' || prevTableId !== m.table.id || m.table.mode !== prevTableMode)) {
            this.mode = m.table.mode;
          }
          if (m.table.options?.casinoGame) this.casinoGame = m.table.options.casinoGame;
          if (m.table.options?.dashMode) this.dashMode = m.table.options.dashMode;
          if (modeOf(m.table)) this.matchMode = modeOf(m.table);
          if (m.table.mode === 'casino' && m.table.status === 'playing') {
            if (!this._casinoStarted || this._casinoStartedTableId !== m.table.id) {
              this._casinoStarted = true;
              this._casinoStartedTableId = m.table.id;
              this.onCasinoStart(m.table);
            }
          } else if (m.table.mode === 'moon_bunny' && m.table.status === 'playing') {
            if (!this._moonStarted || this._moonStartedTableId !== m.table.id) {
              this._moonStarted = true;
              this._moonStartedTableId = m.table.id;
              this.root.hidden = true;
              this.onMoonDefenseStart(m.table);
            }
          } else if (m.table.mode === 'cloud_dash' && m.table.status === 'playing') {
            if (!this._cdStarted || this._cdStartedTableId !== m.table.id) {
              this._cdStarted = true;
              this._cdStartedTableId = m.table.id;
              this.root.hidden = true;
              this.onCloudDashStart(m.table);
            }
          } else if (m.table.status !== 'playing') {
            const wasInMinigame = !!(this._casinoStarted || this._moonStarted || this._cdStarted);
            this._casinoStarted = false;
            this._casinoStartedTableId = null;
            this._moonStarted = false;
            this._moonStartedTableId = null;
            this._cdStarted = false;
            this._cdStartedTableId = null;
            if (m.table.status === 'lobby' && wasInMinigame) {
              window.__neora?.casinoUI?.close?.();
              window.__neora?.moonDefenseUI?.close?.();
              window.__neora?.cloudDashUI?.close?.();
              this.root.hidden = false;
            }
          }
          this.render();
        }
      }),
      room.on('table_list_update', (m) => { if (!m.mode || m.mode === this.mode) { this.tables = m.tables || []; this.render(); } }),
      room.on('table_error', (m) => this.toast(`🪑 ${HUB_ERRORS[m.error] || m.error}`)),
    ];
    this.root.addEventListener('click', (e) => this.onClick(e));
    this.root.addEventListener('change', (e) => this.onChange(e));
  }

  open() {
    this.root.hidden = false;
    if (this.mode !== 'sky_frontier') {
      this.room.send({ type: 'table_list', mode: this.mode });
      if (!this.table || this.table.status === 'ended') {
        if (this.mode === 'casino') {
          this.room.send({ type: 'table_create', mode: 'casino', options: { casinoGame: this.casinoGame } });
          this.onCreate?.('casino', this.casinoGame);
        } else if (this.mode === 'cloud_dash') {
          this.room.send({ type: 'table_create', mode: 'cloud_dash', dashMode: this.dashMode, options: { dashMode: this.dashMode } });
          this.onCreate?.('cloud_dash', this.dashMode);
        } else {
          this.room.send({ type: 'table_create', mode: this.mode, matchMode: this.matchMode });
          this.onCreate?.(this.mode, this.matchMode);
        }
      }
    }
    this.render();
  }

  close({ leave = false } = {}) {
    this.root.hidden = true;
    if (leave) {
      this.room.send({ type: 'table_leave' });
      this.onLeave?.();
      this.table = null;
    }
  }

  get liveProfile() { return window.__neora?.state?.profile || this.profile || {}; }
  get isOpen() { return !this.root.hidden; }
  get me() { return this.room.userId; }
  get isHost() { return this.table?.hostId === this.me; }
  get tab() { return this.mode; }
  set tab(v) { this.mode = v; }

  // ------------------------------------------------------------------------- render
  render() {
    if (this.root.hidden) return;
    const prevFrontierCard = this.root.querySelector?.('.frontier-hub-card');
    if (prevFrontierCard) this._frontierScrollTop = prevFrontierCard.scrollTop || 0;
    const t = this.table;
    const tableMode = (t && !this.isHost && t.mode) ? t.mode : this.mode;
    const isCasino = tableMode === 'casino';
    const isMoon = tableMode === 'moon_bunny';
    const isDash = tableMode === 'cloud_dash';
    const prof = this.liveProfile;
    const activeCasinoGame = (t?.options?.casinoGame || t?.casinoGame || this.casinoGame || 'pokdeng');
    const isChaos = !isCasino && !isMoon && !isDash && (((t?.status === 'lobby' ? modeOf(t) : null) || this.matchMode) === 'chaos');
    const tabs = Object.entries(HUB_MODES).map(([k, m]) => `
      <button class="hub-tab ${(k === this.mode || k === this.tab) ? 'on' : ''} ${m.available ? '' : 'locked'}" data-tab="${k}">
        <span class="hub-tab-ico">${m.iconImg ? `<img class="hub-tab-img" src="${m.iconImg}" alt="${esc(m.label)}">` : m.icon}</span><span>${m.label}</span>${m.available ? '' : `<em>🔒 Phase ${m.phase}</em>`}
      </button>`).join('');

    if (this.mode === 'sky_frontier' || this.tab === 'sky_frontier') {
      const unlockedSkillsMap = (prof?.frontier?.skills?.unlocked && typeof prof.frontier.skills.unlocked === 'object')
        ? prof.frontier.skills.unlocked
        : {};
      const skillStatsByReg = {
        meadow: { have: 0, total: 0 },
        hollow: { have: 0, total: 0 },
        reef: { have: 0, total: 0 },
        caldera: { have: 0, total: 0 },
      };
      let totalSkillsUnlocked = 0;
      for (const sk of Object.values(MONSTER_SKILLS || {})) {
        const reg = sk?.region;
        if (!reg || !skillStatsByReg[reg]) continue;
        skillStatsByReg[reg].total += 1;
        if ((Number(unlockedSkillsMap[sk.id]) || 0) > 0) {
          skillStatsByReg[reg].have += 1;
          totalSkillsUnlocked += 1;
        }
      }
      const skillLabel = (reg) => {
        const st = skillStatsByReg[reg] || { have: 0, total: 5 };
        return `📜 ${st.have}/${st.total || 5} Skills`;
      };

      const hollowUnlocked = Boolean(
        prof?.frontier?.unlocks?.regions?.includes('hollow')
        || prof?.frontier?.unlocks?.gates?.includes('hollow')
        || (prof?.story?.chapter || 0) >= 2
        || prof?.story?.completed?.includes?.(1)
        || (prof?.story?.progress?.c2_visit_gate_hollow || 0) >= 1
      );
      const reefUnlocked = Boolean(
        prof?.frontier?.unlocks?.regions?.includes('reef')
        || prof?.frontier?.unlocks?.gates?.includes('reef')
        || (prof?.story?.chapter || 0) >= 6
        || prof?.story?.completed?.includes?.(5)
        || ((prof?.story?.chapter || 0) >= 5 && (prof?.story?.progress?.c5_visit_gate_reef || 0) >= 1)
      );
      const calderaUnlocked = Boolean(
        prof?.frontier?.unlocks?.regions?.includes('caldera')
        || prof?.frontier?.unlocks?.gates?.includes('caldera')
        || (prof?.story?.chapter || 0) >= 7
        || prof?.story?.completed?.includes?.(6)
      );
      const hasPartner = Boolean(prof?.partner_id);
      const partnerStoryCh = Number(prof?.partner_story_chapter) || 0;
      const partnerRegs = Array.isArray(prof?.partner_regions) ? prof.partner_regions : [];
      const hollowGuestUnlocked = !hollowUnlocked && hasPartner && (partnerRegs.includes('hollow') || partnerStoryCh >= 2);
      const reefGuestUnlocked = !reefUnlocked && hasPartner && (partnerRegs.includes('reef') || partnerStoryCh >= 6);
      const calderaGuestUnlocked = !calderaUnlocked && hasPartner && (partnerRegs.includes('caldera') || partnerStoryCh >= 7);

      const hollowOpen = hollowUnlocked || hollowGuestUnlocked;
      const reefOpen = reefUnlocked || reefGuestUnlocked;
      const calderaOpen = calderaUnlocked || calderaGuestUnlocked;

      this.root.innerHTML = `
      <div class="hub">
        <div class="hub-head"><span>🎮 PLAY &amp; 4-SEAT TABLE HUB</span><button class="hub-x" data-act="close">✕</button></div>
        <div class="hub-tabs">${tabs}</div>
        <div class="hub-table-card frontier-hub-card" style="padding:14px 13px;background:linear-gradient(180deg,#241810 0%,#1a1008 100%);border:2px solid #C9A45C;border-radius:18px;box-shadow:0 8px 24px rgba(0,0,0,0.55);color:#FFF8E7;max-height:66vh;overflow-y:auto;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
            <span style="font-size:26px;">🏝️</span>
            <div>
              <div style="font-size:15.5px;font-weight:900;color:#FFE6A3;letter-spacing:0.3px;">🏝️ Sky Frontier — Living Ecology (4 Regions • 📜 ${totalSkillsUnlocked}/20 Skills)</div>
              <div style="font-size:11px;color:#C9B29B;margin-top:2px;line-height:1.35;">Up to 10 heroes per shard • Hunt Habitat Packs &amp; ⭐ Alpha Elites • Collect 20 Monster Skill Scrolls</div>
            </div>
          </div>

          <div style="display:flex;flex-direction:column;gap:9px;margin:12px 0 4px;">
            <div class="sf-region-card" data-region="meadow" style="background:rgba(255,255,255,0.06);border:1.5px solid rgba(134,239,172,0.5);border-radius:14px;padding:10px 12px;">
              <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;flex-wrap:wrap;">
                <b style="font-size:13px;color:#86EFAC;">🌲 Whispering Meadow (Region 1)</b>
                <span style="font-size:10px;font-weight:800;padding:2px 8px;border-radius:999px;background:#15803D;color:#fff;">Open • ${skillLabel('meadow')}</span>
              </div>
              <div style="font-size:11px;color:#E2E8F0;margin-top:3px;line-height:1.35;">
                4 Habitats (Slime, Wisp, Zephyr Hare, Boar) • Wood, Stone, Sky Wheat • Boss: Elder Moss Golem
              </div>
              <div style="margin-top:7px;display:flex;justify-content:flex-end;">
                <button type="button" id="hub-enter-frontier" class="hub-btn gold" data-act="enter-frontier" data-region="meadow" style="padding:6px 13px;font-size:12px;font-weight:900;background:linear-gradient(180deg,#22C55E,#15803D);border:1.5px solid #BBF7D0;color:#FFF;cursor:pointer;border-radius:10px;">
                  🌲 Enter Whispering Meadow ▸
                </button>
              </div>
            </div>

            <div class="sf-region-card" data-region="hollow" style="background:${hollowOpen ? 'rgba(56,189,248,0.10)' : 'rgba(255,255,255,0.04)'};border:1.5px solid ${hollowOpen ? 'rgba(103,232,249,0.65)' : 'rgba(201,164,92,0.3)'};border-radius:14px;padding:10px 12px;${hollowOpen ? '' : 'opacity:0.88;'}">
              <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;flex-wrap:wrap;">
                <b style="font-size:13px;color:${hollowOpen ? '#67E8F9' : '#93C5FD'};">💎 Crystal Hollow (Region 2)</b>
                <span id="hub-hollow-badge" style="font-size:10px;font-weight:800;padding:2px 8px;border-radius:999px;background:${hollowOpen ? '#0E7490' : '#1E3A8A'};color:${hollowOpen ? '#ECFEFF' : '#93C5FD'};border:1px solid ${hollowOpen ? '#67E8F9' : 'transparent'};">${hollowUnlocked ? `Open • ${skillLabel('hollow')}` : hollowGuestUnlocked ? `💞 Co-Op • ${skillLabel('hollow')}` : `🔒 Story Ch.2 • ${skillLabel('hollow')}`}</span>
              </div>
              <div style="font-size:11px;color:#E2E8F0;margin-top:3px;line-height:1.35;">
                4 Habitats (Frostcap, Beetle, Bat, Golemling) • Crystal, Quartz &amp; Mithril • Boss: Hollow Crystal Weaver
              </div>
              <div style="margin-top:7px;display:flex;align-items:center;justify-content:flex-end;gap:8px;flex-wrap:wrap;">
                ${hollowUnlocked
                  ? `<button type="button" id="hub-enter-hollow" class="hub-btn gold" data-act="enter-frontier" data-region="hollow" style="padding:6px 13px;font-size:12px;font-weight:900;background:linear-gradient(180deg,#06B6D4,#0E7490);border:1.5px solid #A5F3FC;color:#FFF;box-shadow:0 3px 12px rgba(6,182,212,0.4);cursor:pointer;border-radius:10px;">
                      💎 Enter Crystal Hollow ▸
                    </button>`
                  : hollowGuestUnlocked
                    ? `<button type="button" id="hub-enter-hollow-guest" class="hub-btn" data-act="enter-frontier" data-region="hollow" style="padding:5px 11px;font-size:11px;font-weight:800;background:rgba(30,58,138,0.65);border:1px solid #93C5FD;color:#DBEAFE;cursor:pointer;border-radius:10px;">
                        💞 Join Partner in Hollow ▸
                      </button>`
                    : `${hasPartner ? `<span style="font-size:10px;font-weight:800;color:#CBD5E1;">💞 Or join Partner inside Frontier</span>` : ''}
                      <button type="button" class="hub-btn" data-act="locked-frontier-info" data-region="hollow" style="padding:5px 11px;font-size:11px;font-weight:800;background:rgba(30,41,59,0.75);border:1px solid rgba(147,197,253,0.45);color:#CBD5E1;cursor:pointer;border-radius:10px;">
                        🔒 Story Ch.2 ⓘ
                      </button>`}
              </div>
            </div>

            <div class="sf-region-card" data-region="reef" style="background:${reefOpen ? 'rgba(244,114,182,0.11)' : 'rgba(255,255,255,0.04)'};border:1.5px solid ${reefOpen ? 'rgba(249,168,212,0.7)' : 'rgba(201,164,92,0.28)'};border-radius:14px;padding:10px 12px;${reefOpen ? '' : 'opacity:0.88;'}">
              <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;flex-wrap:wrap;">
                <b style="font-size:13px;color:${reefOpen ? '#F9A8D4' : '#FBCFE8'};">🌸 Celestial Sakura Reef (Region 3)</b>
                <span id="hub-reef-badge" style="font-size:10px;font-weight:800;padding:2px 8px;border-radius:999px;background:${reefOpen ? '#9D174D' : '#4C1D95'};color:#FDF2F8;border:1px solid ${reefOpen ? '#F9A8D4' : 'transparent'};">${reefUnlocked ? `Open • ${skillLabel('reef')}` : reefGuestUnlocked ? `💞 Co-Op • ${skillLabel('reef')}` : `🔒 Story Ch.5 • ${skillLabel('reef')}`}</span>
              </div>
              <div style="font-size:11px;color:#E2E8F0;margin-top:3px;line-height:1.35;">
                4 Habitats (Kitsune, Snapper, Crane, Bell Spirit) • Sakura Timber, Pearl &amp; Lotus • Boss: Lady Tamamo
              </div>
              <div style="margin-top:7px;display:flex;align-items:center;justify-content:flex-end;gap:8px;flex-wrap:wrap;">
                ${reefUnlocked
                  ? `<button type="button" id="hub-enter-reef" class="hub-btn gold" data-act="enter-frontier" data-region="reef" style="padding:6px 13px;font-size:12px;font-weight:900;background:linear-gradient(180deg,#EC4899,#BE185D);border:1.5px solid #FBCFE8;color:#FFF;box-shadow:0 3px 12px rgba(236,72,153,0.4);cursor:pointer;border-radius:10px;">
                      🌸 Enter Sakura Reef ▸
                    </button>`
                  : reefGuestUnlocked
                    ? `<button type="button" id="hub-enter-reef-guest" class="hub-btn" data-act="enter-frontier" data-region="reef" style="padding:5px 11px;font-size:11px;font-weight:800;background:rgba(131,24,67,0.65);border:1px solid #F9A8D4;color:#FCE7F3;cursor:pointer;border-radius:10px;">
                        💞 Join Partner in Reef ▸
                      </button>`
                    : `${hasPartner ? `<span style="font-size:10px;font-weight:800;color:#CBD5E1;">💞 Or join Partner inside Frontier</span>` : ''}
                      <button type="button" class="hub-btn" data-act="locked-frontier-info" data-region="reef" style="padding:5px 11px;font-size:11px;font-weight:800;background:rgba(30,41,59,0.75);border:1px solid rgba(249,168,212,0.45);color:#CBD5E1;cursor:pointer;border-radius:10px;">
                        🔒 Story Ch.5 ⓘ
                      </button>`}
              </div>
            </div>

            <div class="sf-region-card" data-region="caldera" style="background:${calderaOpen ? 'rgba(245,158,11,0.11)' : 'rgba(255,255,255,0.04)'};border:1.5px solid ${calderaOpen ? 'rgba(252,211,77,0.7)' : 'rgba(201,164,92,0.28)'};border-radius:14px;padding:10px 12px;${calderaOpen ? '' : 'opacity:0.88;'}">
              <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;flex-wrap:wrap;">
                <b style="font-size:13px;color:${calderaOpen ? '#FCD34D' : '#FDE68A'};">⚙️ Clockwork Star-Caldera (Region 4)</b>
                <span id="hub-caldera-badge" style="font-size:10px;font-weight:800;padding:2px 8px;border-radius:999px;background:${calderaOpen ? '#92400E' : '#3B0764'};color:#FEF3C7;border:1px solid ${calderaOpen ? '#FCD34D' : 'transparent'};">${calderaUnlocked ? `Open • ${skillLabel('caldera')}` : calderaGuestUnlocked ? `💞 Co-Op • ${skillLabel('caldera')}` : `🔒 Story Ch.6 • ${skillLabel('caldera')}`}</span>
              </div>
              <div style="font-size:11px;color:#E2E8F0;margin-top:3px;line-height:1.35;">
                4 Habitats (Salamander, Automaton, Gargoyle, Sentinel) • Orichalcum &amp; Astral Prism • Boss: Solar Bahamut
              </div>
              <div style="margin-top:7px;display:flex;align-items:center;justify-content:flex-end;gap:8px;flex-wrap:wrap;">
                ${calderaUnlocked
                  ? `<button type="button" id="hub-enter-caldera" class="hub-btn gold" data-act="enter-frontier" data-region="caldera" style="padding:6px 13px;font-size:12px;font-weight:900;background:linear-gradient(180deg,#F59E0B,#B45309);border:1.5px solid #FDE68A;color:#FFF;box-shadow:0 3px 12px rgba(245,158,11,0.4);cursor:pointer;border-radius:10px;">
                      ⚙️ Enter Star-Caldera ▸
                    </button>`
                  : calderaGuestUnlocked
                    ? `<button type="button" id="hub-enter-caldera-guest" class="hub-btn" data-act="enter-frontier" data-region="caldera" style="padding:5px 11px;font-size:11px;font-weight:800;background:rgba(120,53,15,0.65);border:1px solid #FCD34D;color:#FEF3C7;cursor:pointer;border-radius:10px;">
                        💞 Join Partner in Caldera ▸
                      </button>`
                    : `${hasPartner ? `<span style="font-size:10px;font-weight:800;color:#CBD5E1;">💞 Or join Partner inside Frontier</span>` : ''}
                      <button type="button" class="hub-btn" data-act="locked-frontier-info" data-region="caldera" style="padding:5px 11px;font-size:11px;font-weight:800;background:rgba(30,41,59,0.75);border:1px solid rgba(252,211,77,0.45);color:#CBD5E1;cursor:pointer;border-radius:10px;">
                        🔒 Story Ch.6 ⓘ
                      </button>`}
              </div>
            </div>
          </div>
        </div>
      </div>`;
      const nextFrontierCard = this.root.querySelector?.('.frontier-hub-card');
      if (nextFrontierCard && this._frontierScrollTop > 0) {
        nextFrontierCard.scrollTop = this._frontierScrollTop;
      }
      return;
    }
    const seats = t ? t.seats : [];
    const resolveSeatHair = (s) => {
      const isMe = s?.userId === this.me;
      const app = (isMe && this.profile?.appearance) ? this.profile.appearance : (s?.appearance || null);
      const lin = s?.lineage || (isMe ? this.profile?.lineage : 'bkk') || 'bkk';
      const isGirl = app?.body === 'girl' || (!app?.body && lin === 'dxb');
      const hairId = s?.hair || app?.hair || (isGirl ? 'hair_girl_waves' : 'hair_boy_fluffy');
      return `/assets/chibi/${hairId}_front.png`;
    };
    const chair = (s, idx) => {
      const pos = ['tl', 'tr', 'bl', 'br'][idx];
      if (!s || s.kind === 'empty') {
        return `<div class="hub-chair ${pos} empty" data-seat="${idx}">
          <div class="hub-chair-seat">🪑</div>
          <div class="hub-chair-badge empty-pill">
            <b>Seat ${idx + 1}</b>
            <span class="hub-sit-pill">${this.isHost ? '➕ Invite / Bot' : '➕ Sit Here'}</span>
          </div>
        </div>`;
      }
      const isMe = s.userId === this.me;
      const bodyUrl = portrait(s.lineage, s);
      const hairUrl = resolveSeatHair(s);
      const ava = `<div class="hub-chair-ava ${s.kind === 'bot' ? 'bot' : ''}">
        <img class="hub-ava-body" src="${bodyUrl}" alt="" />
        <img class="hub-ava-hair" src="${hairUrl}" alt="" />
        ${s.kind === 'bot' ? '<span class="hub-bot-ico">🤖</span>' : ''}
      </div>`;
      const badge = s.kind === 'bot'
        ? `<div class="hub-chair-badge bot-badge">
            <b>Seat ${idx + 1}</b>
            ${this.isHost && t.status === 'lobby'
              ? `<select class="hub-bot-select" data-bot="${idx}">${['easy', 'hard', 'insane'].map((d) => `<option value="${d}" ${d === s.botDiff ? 'selected' : ''}>${DIFF_LABEL[d]}</option>`).join('')}<option value="">✖ Remove</option></select>`
              : `<span class="hub-bot-pill">${DIFF_LABEL[s.botDiff] || DIFF_SHORT[s.botDiff]}</span>`}
          </div>`
        : `<div class="hub-chair-badge human-badge">
            <div class="hub-seat-head"><b>Seat ${idx + 1}</b> <small>(${idx === 0 || s.userId === t.hostId ? 'Host' : SEAT_ROLE[idx]})</small></div>
            <span class="hub-seat-name">${s.userId === t.hostId ? '👑 ' : ''}${esc(s.name)}${s.level ? ` Lv.${s.level}` : ''}${isMe ? ' <em>(you)</em>' : ''}</span>
            <i class="hub-ready ${s.ready ? 'on' : ''}">${s.ready ? '✓ READY' : '… not ready'}</i>${s.connected ? '' : '<i class="hub-off">📴 offline</i>'}
          </div>`;
      return `<div class="hub-chair ${pos} ${s.kind}" data-seat="${idx}">${ava}${badge}</div>`;
    };
    const others = this.tables.filter((x) => x.id !== t?.id);
    const list = others.length ? others.map((x) => {
      const tableCasino = x.mode === 'casino';
      const tableMoon = x.mode === 'moon_bunny';
      const tableDash = x.mode === 'cloud_dash';
      const casinoGame = x.options?.casinoGame || x.casinoGame || (tableCasino ? 'pokdeng' : null);
      const tag = tableCasino
        ? ` <b class="hub-casino-tag" data-casino-game="${esc(casinoGame)}">${casinoGame === 'roulette' ? '⚡ Roulette' : '🀄 Pok-Deng'}</b>`
        : tableMoon
          ? ' <b class="hub-chaos-tag">🌙 5-WAVE SIEGE</b>'
          : tableDash
            ? ' <b class="hub-chaos-tag">☁️ SKY RACE</b>'
            : (modeOf(x) === 'chaos' ? ' <b class="hub-chaos-tag">🎉 CHAOS</b>' : '');
      const hasOpenOrBotSeat = (x.humans ?? x.players) < 4 || x.seats.some((s) => s.kind === 'bot' || s.kind === 'empty');
      const isSeatedHere = x.seats.some((s) => s.kind === 'human' && s.userId === this.me);
      const canJoinLobby = x.status === 'lobby' && hasOpenOrBotSeat;
      const canRejoin = x.status === 'playing' && isSeatedHere;
      return `
      <div class="hub-live" ${tableCasino ? `data-casino-game="${esc(casinoGame)}"` : ''}>
        <div class="hub-live-name">${HUB_MODES[x.mode]?.icon || '🎲'} Table #${x.num} • ${esc(x.name)}${tag}</div>
        <div class="hub-live-avas">${x.seats.filter((s) => s.kind !== 'empty').map((s) => `<span style="background-image:url(${portrait(s.lineage, s)})">${s.kind === 'bot' ? '🤖' : ''}</span>`).join('')}</div>
        <div class="hub-live-meta">🪑 ${x.players}/4 Seats</div>
        ${canRejoin
          ? `<button class="hub-btn green" data-join="${x.id}">🔄 Rejoin Match</button>`
          : canJoinLobby
            ? `<button class="hub-btn green" data-join="${x.id}">🪑 Join Seat</button>`
            : `<button class="hub-btn plain" disabled>${x.status === 'playing' ? '▶ In match' : 'Full'}</button>`}
      </div>`;
    }).join('') : '<div class="hub-empty">No other open tables right now — create yours and invite friends! 💌</div>';
    const humansReady = seats.filter((s) => s.kind === 'human' && s.userId !== t?.hostId).every((s) => s.ready);
    const mySeat = seats.find((s) => s.userId === this.me);
    const launchLabel = this.isHost
      ? (isCasino
          ? `🚀 Enter Casino (${activeCasinoGame === 'roulette' ? 'Roulette' : 'Pok-Deng'})!`
          : isMoon
            ? '🚀 Launch Moon Defense!'
            : isDash
              ? (this.dashMode === 'ghost' ? '👻 Launch Ghost Sprint!' : '🚀 Launch Cloud Dash!')
              : `🚀 Launch ${isChaos ? 'Chaos ' : '4-Player '}Match!`)
      : mySeat?.ready ? '✓ Ready! (waiting for host)' : '✋ I\'m Ready!';
    const cleanRoomName = t ? String(t.name || '').replace(/\s*VIP\s*Room\s*$/i, '').trim() : '';
    const casinoPicker = `
      <div class="hub-casino-picker" role="radiogroup" aria-label="Casino Game">
        <button type="button" class="hub-btn ${activeCasinoGame === 'pokdeng' ? 'gold' : 'plain'}" data-casino-game="pokdeng" ${t && !this.isHost ? 'disabled' : ''}>
          🀄 Pok-Deng
        </button>
        <button type="button" class="hub-btn ${activeCasinoGame === 'roulette' ? 'gold' : 'plain'}" data-casino-game="roulette" ${t && !this.isHost ? 'disabled' : ''}>
          ⚡ Roulette
        </button>
      </div>`;
    const goldIco = '<img class="inline-curr-ico" src="/assets/ui/icon_gold.png" alt="">';
    const berryIco = '<img class="inline-curr-ico" src="/assets/ui/icon_berry.png" alt="">';
    const diaIco = '<img class="inline-curr-ico" src="/assets/ui/icon_diamond.png" alt="">';
    const cakeIco = '<img class="inline-curr-ico" src="/assets/monopoly/mb_star_mochi_cake.png" alt="">';
    const swordIco = '<img class="inline-curr-ico" src="/assets/ui/mb_card_slayer.png" alt="">';
    const fmtCoins = (s) => String(s ?? '').replace(/🪙/g, goldIco);

    const lTier = leagueTierFor(prof.dash_league_lp || 0);
    const dashPicker = isDash ? `
      <div class="hub-dash-picker" role="radiogroup" aria-label="Cloud Dash Mode">
        <button type="button" class="hub-btn hub-dash-btn ${this.dashMode === 'quick' ? 'gold' : 'plain'}" data-dash-mode="quick" ${t && !this.isHost ? 'disabled' : ''}>⚡ Quick</button>
        <button type="button" class="hub-btn hub-dash-btn ${this.dashMode === 'chaos' ? 'gold' : 'plain'}" data-dash-mode="chaos" ${t && !this.isHost ? 'disabled' : ''}>🎉 Chaos</button>
        <button type="button" class="hub-btn hub-dash-btn ${this.dashMode === 'league' ? 'gold' : 'plain'}" data-dash-mode="league" title="${esc(lTier.name)} (${lTier.lp} LP)" ${t && !this.isHost ? 'disabled' : ''}>${lTier.icon} League</button>
        <button type="button" class="hub-btn hub-dash-btn ${this.dashMode === 'ghost' ? 'gold' : 'plain'}" data-dash-mode="ghost" ${t && !this.isHost ? 'disabled' : ''}>👻 Ghost</button>
      </div>` : '';
    const w = getWeeklyWeather();
    const chests = prof.dash_daily?.day === new Date().toISOString().slice(0, 10) ? (prof.dash_daily?.chests || 0) : 0;
    const chestPips = Array.from({ length: DASH_DAILY_CHEST_MAX }, (_, i) => i < chests ? '🎁' : '📦').join('');
    const streakFlame = (prof.dash_stats?.streak || 0) >= 2 ? `<span class="hub-streak-pill">🔥 Streak ×${prof.dash_stats.streak}</span>` : '';
    const dashMetaBar = isDash ? `
      <div class="hub-dash-meta-bar">
        <span class="hub-weather-pill" title="${esc(w.desc)}">${w.icon} <b>${esc(w.name)}:</b> ${esc(w.desc)}</span>
        <span class="hub-chest-pill">${chestPips} Chests ${chests}/${DASH_DAILY_CHEST_MAX}</span>
        ${streakFlame}
      </div>
    ` : '';
    const presets = prof.dash_presets || [{ name: '⚡ Speed' }, { name: '🪙 Farm' }, { name: '🍀 Chaos' }];
    const presetBar = isDash ? `
      <div class="hub-preset-bar">
        <span class="hub-preset-label" title="Loadout Presets">🎒</span>
        <div class="hub-preset-slots">
          ${presets.map((p, idx) => `
            <div class="hub-preset-slot">
              <button type="button" class="hub-btn hub-preset-btn" data-preset-equip="${idx}" title="Equip ${esc(p.name || `Preset ${idx + 1}`)}">${fmtCoins(esc(p.name || `Preset ${idx + 1}`))}</button>
              <button type="button" class="hub-btn hub-preset-save" data-preset-save="${idx}" title="Save current gear & pet to ${esc(p.name || `Preset ${idx + 1}`)}">💾</button>
            </div>
          `).join('')}
        </div>
        <button type="button" class="hub-btn hub-builds-toggle" data-act="dash-builds">📖 Builds</button>
      </div>
    ` : '';

    let buildBookModal = '';
    if (isDash && this.buildBookOpen) {
      const curBuild = detectBuild(computeUniversalStats(prof).bonus);
      const curTierRoman = ['', 'I', 'II', 'III', 'IV'][curBuild.tier] || '';
      const foundList = prof.dash_builds_found || ['balanced'];
      const coreBuilds = ALL_BUILDS.filter((b) => b.kind !== 'hybrid');
      const hybridBuilds = ALL_BUILDS.filter((b) => b.kind === 'hybrid');
      const foundHybridsCount = hybridBuilds.filter((b) => foundList.includes(b.id)).length;

      const renderCoreCard = (b) => {
        const isCurrent = curBuild.id === b.id;
        const maxTier = prof.dash_build_tiers?.[b.id] || (isCurrent ? curBuild.tier : 0);
        const tierBadge = maxTier ? ` · Tier ${['', 'I', 'II', 'III', 'IV'][maxTier] || maxTier}` : '';
        const badgeText = isCurrent
          ? `✓ ACTIVE${curTierRoman ? ` (${curTierRoman})` : ''}`
          : (b.kind === 'balanced' ? 'All-Rounder' : `Core Path${tierBadge}`);
        return `
          <div class="hub-build-card unlocked ${b.kind} ${isCurrent ? 'is-current' : ''}">
            <div class="hub-build-card-head">
              <span class="hub-build-icon">${fmtCoins(b.icon)}</span>
              <span class="hub-build-name">${esc(b.name)}</span>
              <span class="hub-build-badge ${isCurrent ? 'active' : b.kind}">${badgeText}</span>
            </div>
            <p class="hub-build-desc">${fmtCoins(esc(b.tip || ''))}</p>
            <ul class="hub-build-perks">
              ${(b.perks || []).map((p, i) => {
                const tierUnlocked = b.kind === 'balanced' || (isCurrent ? i < curBuild.tier : i < maxTier);
                return `<li class="${tierUnlocked ? '' : 'tier-locked'}">${tierUnlocked ? '✅' : '🔸'} ${fmtCoins(esc(p))}</li>`;
              }).join('')}
            </ul>
          </div>`;
      };

      const renderHybridCard = (b) => {
        const isCurrent = curBuild.id === b.id;
        const found = foundList.includes(b.id) || isCurrent;
        if (found) {
          return `
            <div class="hub-build-card unlocked hybrid ${isCurrent ? 'is-current' : ''}">
              <div class="hub-build-card-head">
                <span class="hub-build-icon">${fmtCoins(b.icon)}</span>
                <span class="hub-build-name">${esc(b.name)}</span>
                <span class="hub-build-badge ${isCurrent ? 'active' : 'hybrid'}">${isCurrent ? '✓ ACTIVE HYBRID' : '✦ Discovered'}</span>
              </div>
              <p class="hub-build-desc">${fmtCoins(esc(b.tip || ''))}</p>
              <ul class="hub-build-perks">
                ${(b.perks || []).map((p) => `<li>✅ ${fmtCoins(esc(p))}</li>`).join('')}
              </ul>
            </div>`;
        }
        const statPair = (b.stats || []).map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(' + ');
        return `
          <div class="hub-build-card locked hybrid">
            <div class="hub-build-card-head">
              <span class="hub-build-icon">🔒</span>
              <span class="hub-build-name">Secret Hybrid: ${esc(statPair)}</span>
              <span class="hub-build-badge locked">+50 ${diaIco} Bonus</span>
            </div>
            <p class="hub-build-hint">Raise both ${esc(statPair)} to Tier II+ (325+ pts) to unlock this secret combo!</p>
          </div>`;
      };

      buildBookModal = `
        <div class="hub-build-book-backdrop">
          <div class="hub-build-book">
            <div class="hub-build-book-header">
              <h3>📖 Cloud Dash Build Tome</h3>
              <button type="button" class="hub-x" data-act="dash-builds-close">✕</button>
            </div>
            <div class="hub-build-book-list">
              <div class="hub-build-active-banner">
                <span>☁️ Active Build: <b>${fmtCoins(curBuild.icon)} ${esc(curBuild.name)}${curTierRoman ? ` (Tier ${curTierRoman})` : ''}</b></span>
                <span>Hybrids: ${foundHybridsCount}/${hybridBuilds.length}</span>
              </div>
              <div class="hub-build-sec-head">
                <span>⚡ Core Stat Paths &amp; Starter (5)</span>
                <span>Tiers I–IV</span>
              </div>
              ${coreBuilds.map(renderCoreCard).join('')}
              <div class="hub-build-sec-head">
                <span>🔍 Secret Hybrid Combos (${foundHybridsCount}/${hybridBuilds.length})</span>
                <span>First Discovery: +50 ${diaIco}</span>
              </div>
              ${hybridBuilds.map(renderHybridCard).join('')}
            </div>
          </div>
        </div>
      `;
    }

    const infoStrip = isCasino
      ? (activeCasinoGame === 'roulette'
          ? `<span>🎰 <b>Zeus Lightning Roulette</b></span>
             <span>⚡ <b>Up to 500× Lightning!</b></span>
             <span>${goldIco} <b>Max Total Bet: 25,000</b></span>`
          : `<span>🀄 <b>Royal Pok-Deng</b></span>
             <span>⚡ <b>Pok 8 / 9 • Up to 5× Deng</b></span>
             <span>🎁 <b>Sunken Dupe Chests</b></span>`)
      : isMoon
        ? `<span>🏝️ <b>Co-Op Island Defense × Element TD</b></span>
           <span>🧱 <b>18×18 Cove Grid • Element Fusion</b></span>
           <span>⚡ <b>Hero Roaming + Boss Charms</b></span>`
        : isDash
          ? `<span>🐾 <b>Ride your Pet!</b></span>
             <span>⚡ <b>Perfect Dash-Jumps</b></span>
             <span>🏆 <b>${goldIco} 600 + ${diaIco} 10</b></span>`
          : `<span>🎲 <b>24-Tile 2.5D Follow-Cam</b></span>
             <span>⚡ <b>${isChaos ? '10R • 2× Ult • Chaos!' : '2d6 Boost: ON'}</b></span>
             <span>🏆 <b>Win: ${isChaos ? '💎×0.5' : '600–950 💎'} + ${goldIco} ${PODIUM.GOLD[0].toLocaleString('en-US')}</b></span>`;

    const moonStageOverlay = isMoon ? `
      <div class="hub-moon-diorama" aria-hidden="true">
        <img class="hub-moon-ring" src="/assets/ui/fx_magic_circle.png" alt="" />
        <img class="hub-moon-bunny" src="/assets/monopoly/mb_moon_bunny_idle.png" alt="" />
        <img class="hub-moon-cake" src="/assets/monopoly/mb_star_mochi_cake.png" alt="" />
        <img class="hub-moon-boss" src="/assets/monopoly/mb_king_mochi_boss.png" alt="" />
      </div>
    ` : '';
    const eqPetId = normalizePetId(prof.equipped?.pet?.id || prof.petId || 'pet_ragdoll');
    const eqPetSprite = PETS[eqPetId]?.sprite || 'ragdoll';
    const dashStageOverlay = isDash ? `
      <div class="hub-dash-diorama" aria-hidden="true">
        <img class="hub-dash-preview-img" src="/assets/ui/cd_stage_preview.png" alt="Sky Cloud Dash Race Stage" onerror="if(!this.dataset.fb){this.dataset.fb=1;this.src='/assets/cloud_dash/cd_stage_preview.png';}" />
        <div class="hub-dash-pet-emblem" title="${esc(PETS[eqPetId]?.name || 'Companion Pet')}">
          <img src="/assets/pets/${eqPetSprite}_emo_joy.png" alt="" onerror="this.replaceWith('🐾')" />
        </div>
      </div>
    ` : '';

    this.root.innerHTML = `
      <div class="hub">
        <div class="hub-head"><span>🎮 PLAY &amp; 4-SEAT TABLE HUB</span><button class="hub-x" data-act="close">✕</button></div>
        <div class="hub-tabs">${tabs}</div>
        <div class="hub-table-card ${isChaos ? 'chaos' : ''} ${isCasino ? 'casino' : ''} ${isMoon ? 'moon' : ''} ${isDash ? 'dash' : ''}">
          <div class="hub-table-title">
            <span class="hub-table-title-txt">🪑 ${t ? `Table #${t.num} — ${esc(cleanRoomName)} ${isCasino ? 'Grand Casino' : isMoon ? 'Moon Sanctuary' : isDash ? 'Sky Racers' : 'VIP Room'}` : 'Setting up your VIP Table…'}</span>
            ${isCasino ? casinoPicker : isMoon ? `<span class="hub-moon-pill"><img src="/assets/ui/mb_tab_moon_emblem.png" alt=""> Island Defense × Element TD</span>` : isDash ? `<span class="hub-moon-pill"><img src="/assets/ui/icon_cloud_dash.png" alt="" onerror="this.remove()"> 4-Racer Sky Race</span>` : `
              <button type="button" class="hub-btn ${isChaos ? 'chaos-on' : 'chaos-off'}" data-act="chaos" ${t && !this.isHost ? 'disabled' : ''}>
                ${isChaos ? '🎉 Chaos Party: ON' : '🎉 Chaos Party'}
              </button>
            `}
          </div>
          ${dashPicker}
          ${dashMetaBar}
          <div class="hub-stage hub-stage-diorama">
            <div class="hub-board"><div class="hub-board-top"><span>${isCasino ? (activeCasinoGame === 'roulette' ? '⚡' : '🀄') : isMoon ? '🌙' : isDash ? '☁️' : (isChaos ? '🎉' : '🎲')}</span></div></div>
            <img class="hub-vip-table-img" src="/assets/ui/stage_vip_table_4seat.png" alt="4-Seat VIP Table" />
            ${moonStageOverlay}
            ${dashStageOverlay}
            ${[0, 1, 2, 3].map((k) => chair(seats[k], k)).join('')}
          </div>
          ${presetBar}
          <div class="hub-table-tools">
            <label class="hub-botpick">🤖 Default Bot: <select data-act="botdiff">${['easy', 'hard', 'insane'].map((d) => `<option value="${d}" ${d === this.botDiff ? 'selected' : ''}>${DIFF_SHORT[d]}</option>`).join('')}</select></label>
            <button class="hub-btn invite" data-act="invite">➕ Invite Friend</button>
          </div>
          <div class="hub-info">
            ${infoStrip}
          </div>
        </div>
        <div class="hub-list">
          <div class="hub-list-title">Live Open Tables (${others.length} Active)</div>
          ${list}
        </div>
        <div class="hub-foot">
          <button class="hub-btn blue big" data-act="solo">⚡ Play Solo ${isCasino ? (activeCasinoGame === 'roulette' ? 'Roulette' : 'Pok-Deng') : isMoon ? 'Moon Sanctuary' : isDash ? (this.dashMode === 'ghost' ? 'Ghost Sprint' : 'Cloud Dash') : (isChaos ? 'Chaos' : 'Now')}<small>(Instant)</small></button>
          <button class="hub-btn gold big" data-act="launch" ${!t || (this.isHost && !isCasino && !isMoon && !isDash && !humansReady) ? '' : ''}>${launchLabel}</button>
        </div>
        ${buildBookModal}
      </div>`;
  }

  // ------------------------------------------------------------------------- input
  onClick(e) {
    const el = e.target.closest('#hub-enter-frontier,[data-act],[data-tab],[data-seat],[data-join],[data-casino-game],[data-dash-mode],[data-preset-equip],[data-preset-save]');
    if (!el || e.target.tagName === 'SELECT' || e.target.tagName === 'OPTION') return;
    if (el.id === 'hub-enter-frontier' || el.id === 'hub-enter-hollow' || el.dataset.act === 'enter-frontier') {
      const region = el.dataset.region || el.closest('[data-region]')?.dataset?.region || 'meadow';
      this.close({ leave: true });
      window.__neora?.enterFrontier?.(region);
      return;
    }
    if (el.dataset.act === 'locked-frontier-info') {
      const reg = el.dataset.region || 'hollow';
      const hasPartner = Boolean(this.liveProfile?.partner_id);
      const coOpNote = hasPartner ? ' (Or step in together once your Partner unlocks it!)' : '';
      const unlockTips = {
        hollow: `🔒 Crystal Hollow unlocks in 📜 Story Ch. 2: Echoes Below!${coOpNote}`,
        reef: `🔒 Celestial Sakura Reef unlocks at 📜 Story Ch. 5: Blossom Tides!${coOpNote}`,
        caldera: `🔒 Clockwork Star-Caldera unlocks after 📜 Story Ch. 6: Starforge Ascent!${coOpNote}`,
      };
      this.toast(unlockTips[reg] || '🔒 Progress your Base Camp Story Board to unlock this region!', 3200);
      return;
    }
    const t = this.table;
    if (el.dataset.tab) {
      const tabKey = el.dataset.tab;
      const m = HUB_MODES[tabKey];
      if (m && !m.available) { this.toast(`${m.icon} ${m.label} opens in Phase ${m.phase} 🔒`); return; }
      const prevMode = this.mode;
      this.mode = tabKey;
      this.onModeChange?.(this.mode);
      if (this.mode !== 'sky_frontier') {
        this.room.send({ type: 'table_list', mode: this.mode });
        if (this.isHost && t?.status === 'lobby' && prevMode !== this.mode) {
          this.room.send({
            type: 'table_set_option',
            mode: this.mode,
            casinoGame: this.mode === 'casino' ? this.casinoGame : undefined,
            dashMode: this.mode === 'cloud_dash' ? this.dashMode : undefined,
            matchMode: this.mode === 'monopoly' ? this.matchMode : undefined,
          });
        }
      }
      this.render();
      return;
    }
    const casinoGameBtn = el.dataset.casinoGame ? el : el.closest('[data-casino-game]');
    if (casinoGameBtn && casinoGameBtn.dataset.casinoGame && !el.dataset.join && !el.dataset.act) {
      const game = casinoGameBtn.dataset.casinoGame;
      this.casinoGame = game;
      if (t && this.isHost) {
        this.room.send({ type: 'table_set_option', casinoGame: game });
      }
      this.render();
      return;
    }
    if (el.dataset.dashMode && !el.dataset.join && !el.dataset.act) {
      this.dashMode = el.dataset.dashMode;
      if (t && this.isHost && t.status === 'lobby') {
        this.room.send({ type: 'table_set_option', dashMode: this.dashMode });
      }
      this.render();
      return;
    }
    if (el.dataset.presetEquip != null) {
      const idx = Number(el.dataset.presetEquip);
      const prof = this.liveProfile;
      const presets = prof.dash_presets || [{ name: '⚡ Speed' }, { name: '🪙 Farm' }, { name: '🍀 Chaos' }];
      const p = presets[idx] || { name: `Preset ${idx + 1}` };
      const req = window.__neora?.request?.('dash_preset_equip', { slotIdx: idx });
      if (req?.then) {
        req.then((res) => {
          if (res?.presets && prof) prof.dash_presets = res.presets;
          const buildName = res?.buildUpdate?.after?.name || res?.preset?.name || 'Updated';
          this.toast(`🎒 Equipped ${p.name}! (Build: ${buildName})`);
          this.render();
        }).catch((err) => {
          this.toast(`❌ ${err?.message || err}`);
        });
      } else {
        this.toast(`🎒 Equipped ${p.name}! (Build: Updated)`);
        this.render();
      }
      return;
    }
    if (el.dataset.presetSave != null) {
      const idx = Number(el.dataset.presetSave);
      const prof = this.liveProfile;
      const presets = prof.dash_presets || [{ name: '⚡ Speed' }, { name: '🪙 Farm' }, { name: '🍀 Chaos' }];
      const pName = presets[idx]?.name || `Preset ${idx + 1}`;
      const req = window.__neora?.request?.('dash_preset_save', { slotIdx: idx, name: pName });
      if (req?.then) {
        req.then((res) => {
          if (res?.presets && prof) prof.dash_presets = res.presets;
          this.toast(`💾 Saved current gear & pet to ${pName}!`);
          this.render();
        }).catch((err) => {
          this.toast(`❌ ${err?.message || err}`);
        });
      } else {
        this.toast(`💾 Saved current gear & pet to ${pName}!`);
        this.render();
      }
      return;
    }
    if (el.dataset.join) {
      this.room.send({ type: 'table_sit', tableId: el.dataset.join });
      this.onJoin?.(el.dataset.join);
      return;
    }
    if (el.dataset.seat != null && !el.dataset.act) {
      const idx = Number(el.dataset.seat);
      const s = t?.seats[idx];
      this.onSeatClick?.(idx, s);
      if (!t || t.status !== 'lobby' || !s) return;
      if (s.kind === 'empty') {
        if (this.isHost) {
          this.room.send({ type: 'table_set_bot', seatIdx: idx, diff: this.botDiff });
          this.onAddBot?.(idx, this.botDiff);
        } else {
          this.room.send({ type: 'table_sit', tableId: t.id, seatIdx: idx });
        }
      }
      return;
    }
    switch (el.dataset.act) {
      case 'close': this.close({ leave: true }); this.onClose(); break;
      case 'dash-builds':
        this.buildBookOpen = !this.buildBookOpen;
        this.render();
        break;
      case 'dash-builds-close':
        this.buildBookOpen = false;
        this.render();
        break;
      case 'chaos': {
        const curMode = (t?.status === 'lobby' ? modeOf(t) : null) || this.matchMode;
        this.matchMode = curMode === 'chaos' ? 'normal' : 'chaos';
        if (t && this.isHost && t.status === 'lobby') this.room.send({ type: 'table_set_option', matchMode: this.matchMode });
        this.toast(this.matchMode === 'chaos' ? '🎉 Chaos Party ON — Max Pets, 2× Ult Gauge, Round Chaos Events & 10 Rounds!' : '⚖️ Standard Mode selected');
        this.render();
        break;
      }
      case 'solo': {
        const hasGuests = t && this.isHost && t.status === 'lobby' && (t.seats || []).some((s) => s.kind === 'human' && s.userId && s.userId !== this.me);
        if (hasGuests && !(this.mode === 'cloud_dash' && this.dashMode === 'ghost')) {
          if (t.mode !== 'moon_bunny' && t.mode !== 'cloud_dash' && t.mode !== 'casino') {
            t.seats.forEach((s, idx) => { if (s.kind === 'empty') this.room.send({ type: 'table_set_bot', seatIdx: idx, diff: this.botDiff }); });
          }
          this.room.send({ type: 'table_start' });
          this.onStart?.();
          break;
        }
        if (this.mode === 'casino') {
          this.room.send({ type: 'table_solo', mode: 'casino', diff: this.botDiff, casinoGame: this.casinoGame, options: { casinoGame: this.casinoGame } });
          this.onSolo?.(this.botDiff, this.casinoGame);
        } else if (this.mode === 'moon_bunny') {
          this.room.send({ type: 'table_solo', mode: 'moon_bunny', diff: this.botDiff });
          this.onSolo?.(this.botDiff, 'moon_bunny');
        } else if (this.mode === 'cloud_dash') {
          this.room.send({ type: 'table_solo', mode: 'cloud_dash', diff: this.botDiff, dashMode: this.dashMode, options: { dashMode: this.dashMode } });
          this.onSolo?.(this.botDiff, 'cloud_dash');
        } else {
          this.room.send({ type: 'table_solo', diff: this.botDiff, matchMode: this.matchMode });
          this.onSolo?.(this.botDiff, this.matchMode);
        }
        break;
      }
      case 'invite': {
        if (!t) return;
        const code = `Table #${t.num}`;
        navigator.clipboard?.writeText?.(code).catch(() => {});
        this.toast(this.room.local ? '💌 Friend invites go live once multiplayer tables are switched on — fill seats with bots for now!' : `💌 ${code} copied — friends can Hot-Join from their Play Hub!`);
        break;
      }
      case 'launch': {
        if (this.mode === 'cloud_dash' && this.dashMode === 'ghost') {
          this.room.send({ type: 'table_solo', mode: 'cloud_dash', diff: this.botDiff, dashMode: 'ghost', options: { dashMode: 'ghost' } });
          this.onSolo?.(this.botDiff, 'cloud_dash');
          return;
        }
        if (!t) return;
        if (!this.isHost) {
          const mine = t.seats.find((s) => s.userId === this.me);
          const nextReady = !mine?.ready;
          this.room.send({ type: 'table_ready', ready: nextReady });
          this.onReady?.(nextReady);
          return;
        }
        if (t.mode === 'casino' || t.mode === 'moon_bunny' || t.mode === 'cloud_dash' || this.mode === 'casino') {
          this.room.send({ type: 'table_start' });
          this.onStart?.();
          return;
        }
        const modeSpec = HUB_MODES[t.mode || this.mode] || MODES[t.mode || this.mode] || { minSeats: 2 };
        const filledCount = (t.seats || []).filter((s) => s && s.kind !== 'empty').length;
        if (filledCount < modeSpec.minSeats) {
          t.seats.forEach((s, idx) => { if (s.kind === 'empty') this.room.send({ type: 'table_set_bot', seatIdx: idx, diff: this.botDiff }); });
        }
        this.room.send({ type: 'table_start' });
        this.onStart?.();
        break;
      }
      default:
    }
  }

  onChange(e) {
    const sel = e.target;
    if (sel.dataset.act === 'botdiff') { this.botDiff = sel.value; return; }
    if (sel.dataset.bot != null) {
      const idx = Number(sel.dataset.bot);
      const diff = sel.value || null;
      this.room.send({ type: 'table_set_bot', seatIdx: idx, diff });
      this.onAddBot?.(idx, diff);
    }
  }

  destroy() { this.off.forEach((f) => f?.()); this.root.remove(); }
}

const HUB_ERRORS = {
  need_players: 'Add at least one more player or bot',
  not_ready: 'Waiting for everyone to tap Ready',
  host_only: 'Only the host can do that',
  seat_taken: 'That seat is taken',
  match_running: 'That table is already playing',
  mode_locked: 'This mode unlocks in a later phase',
  no_table: 'Table closed',
  private_table: 'That table is private',
  not_your_turn: 'Not your turn yet',
  ult_not_ready: 'Ultimate not charged yet',
};
