// client/js/minigames/dock_fishing.js — In-Village Co-Op Dock Fishing (Screen 04, Section 2.F).
// Clean, cozy, visual-first Mockup 04 UI + Sunken Chest Target Pin & Angler's Exchange.
import { FISH, FISHING, ANGLER_EXCHANGE } from '/shared/catalog_landmarks.js';
import { resolveItemVisual, renderIconThumb, shortenGearName, escapeHtml } from '../ui_components.js';

const $ = (id) => document.getElementById(id);

const SHORT_OFFER_META = {
  chest_targeted:    { title: 'Sunken Gear Chest',   rewardTag: '🔨 +1 Pinned Dupe' },
  chest_koi_express: { title: 'Koi Reliquary Chest', rewardTag: '👑 +1 Dupe & 500 🪙' },
  gacha_ticket:      { title: 'Summon Ticket',       rewardTag: '🎟️ +1 Gacha Pull' },
  blessed_scroll:    { title: 'Blessed Forge Scroll', rewardTag: '📜 +1 Scroll (+15%)' },
  pet_sashimi:       { title: 'Pet Sashimi Feast',   rewardTag: '🐾 +60 EXP & 40 🍓' },
  starlight_shards:  { title: 'Starlight Shards',    rewardTag: '⭐ +25 Shards' },
  angler_diamonds:   { title: 'Sunken Pearl Pouch',  rewardTag: '💎 +100 Diamonds' },
};

const SHORT_FISH_NAME = {
  minnow: 'Silver Minnow',
  crab:   'Coral Crab',
  koi:    'Golden Koi',
  chest:  'Sunken Chest',
};

export class DockFishing {
  /** @param net Net  @param ui { toast(msg), humanError(e), onCast?(bait), onBite?(key), onCatch?(result), onOpenForge?() } */
  constructor(net, ui) {
    this.net = net;
    this.ui = ui;
    this.state = 'idle';           // idle | casting | waiting | reeling | result
    this.activeTab = 'pier';       // pier | exchange | codex
    this.useBait = true;           // default to Golden Berry Bait
    this.cast = null;
    this.hold = false;
    this.perfectHook = false;
    this.reelStartedAt = 0;
    this.lastTickSfxAt = 0;
    this.raf = 0;
    this.available = false;
    this.sessionHaul = { minnow: 0, crab: 0, koi: 0, chest: 0 };
    this._audioCtx = null;
    this.bind();
  }

  bind() {
    $('fish-open').onclick = () => this.open();
    $('fish-close').onclick = () => this.close();
    $('fish-cast').onclick = () => {
      this.useBait = false;
      this.syncBaitUi();
      this.doCast(false);
    };
    $('fish-bait').onclick = () => {
      this.useBait = true;
      this.syncBaitUi();
      this.doCast(true);
    };

    const baitSlot = $('fish-bait-slot');
    if (baitSlot) {
      baitSlot.onclick = () => {
        if (this.state === 'reeling' || this.state === 'waiting') return;
        this.useBait = !this.useBait;
        this.playSfx('toggle');
        this.syncBaitUi();
      };
    }

    const logBtn = $('fish-log-btn');
    if (logBtn) {
      logBtn.onclick = () => {
        if (this.state === 'reeling') return;
        const nextTab = this.activeTab === 'exchange' ? 'pier' : 'exchange';
        this.switchTab(nextTab);
      };
    }

    const panel = $('fishing-panel');
    if (panel) {
      panel.addEventListener('click', (e) => {
        const tabBtn = e.target.closest('[data-fish-tab]');
        if (tabBtn) {
          if (this.state === 'reeling') return;
          this.switchTab(tabBtn.dataset.fishTab);
          return;
        }
        const openTabBtn = e.target.closest('[data-open-fish-tab]');
        if (openTabBtn) {
          if (this.state === 'reeling') return;
          this.switchTab(openTabBtn.dataset.openFishTab);
          return;
        }
        const targetBtn = e.target.closest('[data-fish-target]');
        if (targetBtn) {
          const itemId = targetBtn.dataset.fishTarget || '';
          this.playSfx('toggle');
          this.net.send({ type: 'fishing_set_target', itemId: itemId || null });
          return;
        }
        const exBtn = e.target.closest('[data-fish-exchange]');
        if (exBtn && !exBtn.disabled) {
          const offerId = exBtn.dataset.fishExchange;
          this.net.send({ type: 'fishing_exchange', offerId });
          return;
        }
        const forgeBtn = e.target.closest('[data-act="fish-open-forge"]');
        if (forgeBtn) {
          if (this.state === 'reeling' || this.state === 'waiting') return;
          this.close();
          this.ui?.onOpenForge?.();
        }
      });
    }

    const reel = $('fish-reel');
    const arcTrack = $('fish-arc-track');
    const down = (e) => {
      e.preventDefault();
      if (this.state === 'idle' || this.state === 'result') {
        if (this.activeTab !== 'pier') this.switchTab('pier');
        const canAffordBait = (this.profile?.berries | 0) >= FISHING.BAIT_COST_BERRIES;
        this.doCast(this.useBait && canAffordBait);
        return;
      }
      if (this.state === 'reeling') {
        this.engageHold();
      }
    };
    const up = () => {
      this.hold = false;
      reel?.classList.remove('held');
    };
    reel.addEventListener('pointerdown', down);
    reel.addEventListener('pointerup', up);
    reel.addEventListener('pointercancel', up);
    reel.addEventListener('pointerleave', up);

    if (arcTrack) {
      arcTrack.addEventListener('pointerdown', (e) => {
        if (this.state === 'reeling') {
          e.preventDefault();
          this.engageHold();
        }
      });
      arcTrack.addEventListener('pointerup', up);
      arcTrack.addEventListener('pointercancel', up);
      arcTrack.addEventListener('pointerleave', up);
    }

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && this.state === 'reeling') {
        e.preventDefault();
        this.engageHold();
      }
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') up();
    });

    this.net
      .on('fishing_cast_ok', (m) => this.onCastOk(m))
      .on('fishing_result', (m) => this.onResult(m))
      .on('fishing_target_ok', (m) => {
        if (this.profile) this.profile.fish_target_item = m.targetItem || null;
        this.playSfx('perfect');
        const vis = m.targetItem ? resolveItemVisual(m.targetItem, this.profile?.lineage || 'bkk') : null;
        this.ui.toast(vis ? `🎯 Pinned: ${shortenGearName(vis.name)}` : '🎯 Target: Auto');
        this.refreshAllViews();
      })
      .on('fishing_exchange_ok', (m) => this.onExchangeOk(m))
      .on('fishing_error', (m) => {
        this.ui.toast(`🎣 ${this.ui.humanError(m.error)}`);
        this.reset();
      });
  }

  engageHold() {
    const now = performance.now();
    if (!this.hold && this.reelStartedAt > 0 && now - this.reelStartedAt <= (FISHING.PERFECT_HOOK_WINDOW_MS || 650) && !this.perfectHook) {
      this.perfectHook = true;
      if (this.g) {
        this.g.width = Math.min(0.42, FISHING.SWEET_SPOT_WIDTH * 1.25);
      }
      this.playSfx('perfect');
    }
    this.hold = true;
    $('fish-reel')?.classList.add('held');
  }

  switchTab(tab) {
    this.activeTab = tab || 'pier';
    this.playSfx('toggle');
    document.querySelectorAll('#fishing-panel [data-fish-tab]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.fishTab === this.activeTab);
    });
    const pier = $('fish-view-pier');
    const ex = $('fish-view-exchange');
    const codex = $('fish-view-codex');
    if (pier) pier.hidden = this.activeTab !== 'pier';
    if (ex) ex.hidden = this.activeTab !== 'exchange';
    if (codex) codex.hidden = this.activeTab !== 'codex';
    this.syncBottomCta();
    this.refreshAllViews();
  }

  /** World tells us whether the local Chibi stands on / next to a dock. */
  setAvailable(on) {
    if (on === this.available) return;
    this.available = on;
    $('fish-open').hidden = !on;
    if (!on && this.state === 'idle') this.close();
  }

  open(initialTab = 'pier') {
    $('fishing-panel').hidden = false;
    $('hud')?.classList.add('fishing-open');
    this.reset();
    this.switchTab(initialTab);
  }

  close() {
    if (this.state === 'reeling' || this.state === 'waiting' || this.state === 'bite') return;
    $('fishing-panel').hidden = true;
    $('hud')?.classList.remove('fishing-open');
    this.stop();
  }

  get isOpen() { return !$('fishing-panel').hidden; }

  reset() {
    this.stop();
    this.state = 'idle';
    this.cast = null;
    this.hold = false;
    this.perfectHook = false;
    this.reelStartedAt = 0;
    $('fish-status').textContent = 'Tap Cast to fish ✨';
    $('fish-gauge').hidden = false;
    $('fish-gauge').classList.remove('is-reeling', 'is-waiting');
    $('fish-result').hidden = true;
    const bobber = $('fish-bobber');
    if (bobber) bobber.hidden = true;
    $('fish-cast').disabled = false;
    $('fish-bait').disabled = false;
    $('fish-reel').disabled = false;
    $('fish-zone').style.left = '34%';
    $('fish-zone').style.width = `${FISHING.SWEET_SPOT_WIDTH * 100}%`;
    const icon = $('fish-icon');
    if (icon) {
      icon.style.left = '48%';
      icon.style.transform = 'translate(-50%, -6px)';
      icon.classList.remove('inside');
    }
    $('fish-progress').style.width = '0%';
    this.syncBaitUi();
    this.syncBottomCta();
    this.refreshAllViews();
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    clearTimeout(this.biteTimer);
  }

  syncBaitUi() {
    const berries = this.profile?.berries | 0;
    const lbl = $('fish-bait-slot-lbl');
    if (lbl) {
      lbl.innerHTML = this.useBait
        ? `🍓 Bait (−5)<br><small>x${berries.toLocaleString('en-US')}</small>`
        : `🪱 Free Cast<br><small>0 🍓</small>`;
    }
    const chip = $('fish-bait-mode-chip');
    if (chip) {
      chip.textContent = this.useBait ? 'ON' : 'FREE';
      chip.classList.toggle('off', !this.useBait);
    }
    this.syncBottomCta();
  }

  syncBottomCta(pct = 0) {
    const reelBtn = $('fish-reel');
    const lbl = $('fish-reel-label');
    const logChip = $('fish-log-btn-chip');
    if (logChip) {
      logChip.textContent = this.activeTab === 'exchange' ? '🎣 FISH' : '🎁 SHOP';
    }
    if (!reelBtn || !lbl) return;
    if (this.state === 'reeling') {
      reelBtn.disabled = false;
      reelBtn.classList.add('is-reeling-cta');
      lbl.textContent = `HOLD TO REEL! (${Math.round(pct * 100)}%)`;
    } else if (this.state === 'waiting' || this.state === 'casting') {
      reelBtn.disabled = true;
      reelBtn.classList.remove('is-reeling-cta');
      lbl.textContent = 'WAITING…';
    } else {
      reelBtn.disabled = false;
      reelBtn.classList.remove('is-reeling-cta');
      lbl.textContent = this.useBait ? 'CAST LINE (5 🍓)' : 'FREE CAST';
    }
  }

  doCast(bait) {
    if (this.state !== 'idle' && this.state !== 'result') return;
    this.useBait = !!bait;
    this.reset();
    this.state = 'casting';
    $('fish-cast').disabled = true;
    $('fish-bait').disabled = true;
    $('fish-status').textContent = bait ? '✨ Casting Berry Bait…' : '🎣 Casting line…';
    this.playSfx('cast');
    this.ui?.onCast?.(bait);
    this.syncBottomCta();
    this.net.send({ type: 'fishing_cast', bait });
  }

  onCastOk(m) {
    this.cast = m;
    this.state = 'waiting';
    if (this.profile && typeof m.baitPity === 'number') {
      this.profile.fish_bait_pity = m.baitPity;
    }
    const coopBanner = $('fish-coop');
    if (coopBanner) {
      coopBanner.hidden = !m.coop;
    }
    $('fish-gauge').classList.add('is-waiting');
    const bobber = $('fish-bobber');
    if (bobber) bobber.hidden = false;
    $('fish-status').textContent = '〰️ Waiting for a bite…';
    this.syncBottomCta();
    this.renderSummary();
    this.biteTimer = setTimeout(() => this.startReel(), m.biteMs);
  }

  startReel() {
    this.state = 'reeling';
    this.reelStartedAt = performance.now();
    this.perfectHook = false;
    const hintKey = this.cast?.fishKeyHint || (this.cast?.bait ? 'koi' : 'minnow');
    const fishMeta = FISH[hintKey] || FISH.koi;
    const iconImg = $('fish-icon-img');
    if (iconImg) iconImg.src = `/assets/village/${fishMeta.sprite}.png`;
    const bobber = $('fish-bobber');
    if (bobber) bobber.hidden = true;
    $('fish-gauge').classList.remove('is-waiting');
    $('fish-gauge').classList.add('is-reeling');
    $('fish-status').textContent = '❗ Hold to keep in Green!';
    $('fish-gauge').hidden = false;
    $('fish-reel').disabled = false;
    this.playSfx('bite');
    this.ui?.onBite?.(hintKey);

    this.g = {
      fish: 0.22,
      zone: 0.14,
      zoneDir: 1,
      progress: 0,
      t: 0,
      width: FISHING.SWEET_SPOT_WIDTH,
      behavior: fishMeta.behavior || 'calm',
    };
    this.syncBottomCta(0);
    let last = performance.now();
    const tick = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (this.step(dt, now)) this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  /** Sweet-Spot Tension Gauge: hold = +45%/s, release = −35%/s; 3.5 s inside the zone lands it. */
  step(dt, now = performance.now()) {
    const g = this.g;
    g.t += dt;
    const prevFish = g.fish;
    g.fish = Math.max(0, Math.min(1, g.fish + (this.hold ? FISHING.HOLD_SPEED : -FISHING.DRIFT_SPEED) * dt));

    const speedMult = g.behavior === 'darter' ? 1.15 : g.behavior === 'treasure' ? 1.22 : g.behavior === 'heavy' ? 0.92 : 1.0;
    const wave = Math.sin(g.t * (g.behavior === 'darter' ? 3.1 : 2.3)) * 0.1;
    g.zone += g.zoneDir * dt * (0.16 * speedMult + wave);
    if (g.zone < 0.03 || g.zone > 0.97 - g.width) {
      g.zoneDir *= -1;
      g.zone = Math.max(0.03, Math.min(0.97 - g.width, g.zone));
    }

    const inside = g.fish >= g.zone && g.fish <= g.zone + g.width;
    g.progress = Math.max(0, Math.min(1, g.progress + (inside ? dt / (FISHING.REEL_MS / 1000) : -dt / 7)));

    $('fish-zone').style.left = `${g.zone * 100}%`;
    $('fish-zone').style.width = `${g.width * 100}%`;

    const clampedPct = 6 + g.fish * 88;
    const normX = (g.fish - 0.5) * 2;
    const arcLiftPx = -8 * (1 - normX * normX);
    const vel = (g.fish - prevFish) / Math.max(dt, 0.001);
    const tiltDeg = Math.max(-14, Math.min(14, -vel * 18));

    const icon = $('fish-icon');
    if (icon) {
      icon.style.left = `${clampedPct}%`;
      icon.style.transform = `translate(-50%, ${arcLiftPx.toFixed(1)}px) rotate(${tiltDeg.toFixed(1)}deg)`;
      icon.classList.toggle('inside', inside);
    }

    $('fish-progress').style.width = `${g.progress * 100}%`;
    const pctInt = Math.round(g.progress * 100);
    $('fish-status').innerHTML = inside
      ? `🎯 <b>Reeling: ${pctInt}%</b> ${this.perfectHook ? '⚡' : ''}`
      : `⚠️ <b>Keep in Green! (${pctInt}%)</b>`;
    this.syncBottomCta(g.progress);

    if (this.hold && now - this.lastTickSfxAt > 95) {
      this.lastTickSfxAt = now;
      this.playSfx('tick', g.progress);
    }

    if (g.progress >= 1) { this.finish(true); return false; }
    if ((g.progress <= 0 && g.t > 4) || g.t > 25) { this.finish(false); return false; }
    return true;
  }

  finish(success) {
    this.state = 'result';
    this.hold = false;
    $('fish-reel')?.classList.remove('held');
    $('fish-gauge')?.classList.remove('is-reeling', 'is-waiting');
    $('fish-reel').disabled = true;
    $('fish-status').textContent = success ? '🎉 Got it!' : '💨 Escaped…';
    this.net.send({
      type: 'fishing_reel_complete',
      castId: this.cast?.castId,
      success,
      perfectHook: this.perfectHook,
    });
  }

  onResult(m) {
    this.state = 'result';
    $('fish-gauge').hidden = false;
    $('fish-gauge').classList.remove('is-reeling', 'is-waiting');
    $('fish-cast').disabled = false;
    $('fish-bait').disabled = false;
    $('fish-reel').disabled = false;
    if (this.profile && typeof m.baitPity === 'number') {
      this.profile.fish_bait_pity = m.baitPity;
    }
    this.syncBottomCta();

    const box = $('fish-result');
    box.hidden = false;
    if (!m.ok) {
      this.playSfx('escape');
      box.innerHTML = `<div class="fr-title">💨 Escaped!</div>`;
      $('fish-status').textContent = 'Tap Cast to try again!';
      this.refreshAllViews();
      return;
    }

    this.playSfx('catch');
    this.sessionHaul[m.key] = (this.sessionHaul[m.key] | 0) + 1;
    const f = FISH[m.key];
    const lin = this.profile?.lineage || 'bkk';
    const bits = [];
    if (m.gold) bits.push(`+${m.gold.toLocaleString('en-US')} 🪙`);
    if (m.berries) bits.push(`+${m.berries} 🍓`);
    if (m.dupe) {
      const dupeVis = resolveItemVisual(m.dupe, lin);
      bits.push(`+1 ${shortenGearName(dupeVis.name)} Dupe`);
    }
    if (m.milestone) bits.push(`+${m.milestone} 💎`);

    const weightTag = m.weightKg
      ? `<span class="fr-weight ${m.isCrown ? 'crown' : ''}">${m.isCrown ? '👑 ' : ''}${m.weightKg} kg</span>`
      : '';

    box.innerHTML = `
      <div class="fr-card rarity-${f.rarity || 'common'}">
        <img src="/assets/village/${f.sprite}.png" alt="${escapeHtml(f.name)}" class="fr-sprite">
        <div class="fr-copy">
          <div class="fr-title">${escapeHtml(SHORT_FISH_NAME[m.key] || f.name)} ${weightTag}</div>
          <div class="fr-sub">${bits.join(' • ')}</div>
        </div>
      </div>
    `;

    $('fish-status').textContent = 'Nice catch! ✨';
    this.ui.onCatch?.(m);
    this.refreshAllViews();
  }

  onExchangeOk(m) {
    this.playSfx('exchange');
    this.ui.toast(`🎁 Traded: ${m.offerName}!`);
    this.refreshAllViews();
  }

  getBasket(profile = this.profile) {
    if (!profile) return { minnow: 0, crab: 0, koi: 0, chest: 0 };
    if (profile.fish_basket && typeof profile.fish_basket === 'object') {
      return {
        minnow: profile.fish_basket.minnow | 0,
        crab: profile.fish_basket.crab | 0,
        koi: profile.fish_basket.koi | 0,
        chest: profile.fish_basket.chest | 0,
      };
    }
    const c = profile.fish_codex || {};
    return {
      minnow: c.minnow | 0,
      crab: c.crab | 0,
      koi: c.koi | 0,
      chest: c.chest | 0,
    };
  }

  refreshAllViews(profile = this.profile) {
    this.syncBaitUi();
    this.renderSummary(profile);
    this.renderExchange(profile);
    this.renderCodex(profile);
  }

  renderSummary(profile = this.profile) {
    if (!profile) return;
    const basket = this.getBasket(profile);
    const pity = profile.fish_bait_pity | 0;

    const haulEl = $('fish-haul-line');
    if (haulEl) {
      haulEl.innerHTML = `
        <span class="haul-pill" title="Silver Minnow"><img src="/assets/village/fish_minnow.png" alt=""> <b>${basket.minnow}</b></span>
        <span class="haul-pill" title="Coral Crab"><img src="/assets/village/fish_crab.png" alt=""> <b>${basket.crab}</b></span>
        <span class="haul-pill" title="Golden Koi"><img src="/assets/village/fish_koi.png" alt=""> <b>${basket.koi}</b></span>
        <span class="haul-pill" title="Sunken Chest"><img src="/assets/village/fish_chest.png" alt=""> <b>${basket.chest}</b></span>
        <button type="button" class="haul-pill pity-pill" data-open-fish-tab="exchange" title="Sunken Chest Guarantee">
          🗝️ <b>${pity}/${FISHING.BAIT_CHEST_PITY || 10}</b>
        </button>
      `;
    }

    const affordableCount = ANGLER_EXCHANGE.filter((o) =>
      Object.entries(o.cost || {}).every(([k, need]) => (basket[k] | 0) >= need)
    ).length;
    const badge = $('fish-exchange-badge');
    if (badge) {
      badge.textContent = `${affordableCount}`;
      badge.classList.toggle('ready', affordableCount > 0);
    }
  }

  renderExchange(profile = this.profile) {
    const wrap = $('fish-exchange-content');
    if (!wrap || !profile) return;
    const lin = profile.lineage || 'bkk';
    const appearance = profile.appearance || null;
    const basket = this.getBasket(profile);
    const inv = profile.inventory || {};
    const ownedIds = Object.keys(inv);
    const targetId = profile.fish_target_item && inv[profile.fish_target_item] ? profile.fish_target_item : null;
    const activeTargetId = targetId || profile.equipped?.outfit?.id || ownedIds[0] || 'newbie_outfit';

    const gearChipsHtml = ownedIds.map((id) => {
      const vis = resolveItemVisual(id, lin);
      const entry = inv[id] || { refine: 0, dupes: 0 };
      const isSelected = id === targetId || (!targetId && id === activeTargetId);
      return `
        <button type="button" class="fish-gear-chip ${isSelected ? 'selected' : ''}" data-fish-target="${escapeHtml(id)}" title="${escapeHtml(vis.name)}">
          ${renderIconThumb(id, { lineage: lin, appearance, size: 36, refine: entry.refine })}
          <span class="chip-dupe-count">x${entry.dupes | 0}</span>
        </button>
      `;
    }).join('');

    const offersHtml = ANGLER_EXCHANGE.map((o) => {
      const meta = SHORT_OFFER_META[o.id] || { title: o.name, rewardTag: o.badge };
      const costEntries = Object.entries(o.cost || {});
      const canAfford = costEntries.every(([k, need]) => (basket[k] | 0) >= need);
      const costPills = costEntries.map(([k, need]) => {
        const f = FISH[k];
        const have = basket[k] | 0;
        const ok = have >= need;
        return `
          <span class="ex-cost-pill ${ok ? 'ok' : 'short'}">
            <img src="/assets/village/${f.sprite}.png" alt="">
            <b>${have}/${need}</b>
          </span>
        `;
      }).join('');

      return `
        <div class="fish-ex-card rarity-${o.rarity}">
          <div class="ex-ico-frame">
            <img src="${o.icon}" alt="${escapeHtml(meta.title)}">
          </div>
          <div class="ex-card-mid">
            <div class="ex-title-inline">${escapeHtml(meta.title)}</div>
            <div class="ex-costs">
              <span class="ex-rarity-tag">${meta.rewardTag}</span>
              ${costPills}
            </div>
          </div>
          <button type="button" class="ex-trade-btn ${canAfford ? 'can-trade' : ''}" data-fish-exchange="${o.id}" ${canAfford ? '' : 'disabled'}>
            ${canAfford ? 'Trade' : 'Locked'}
          </button>
        </div>
      `;
    }).join('');

    wrap.innerHTML = `
      <div class="fish-target-box">
        <div class="target-box-hdr">
          <span class="target-compass-tag">🎯 Pin Chest Dupe</span>
          <button type="button" class="fish-forge-jump-btn" data-act="fish-open-forge">🔨 Forge</button>
        </div>
        <div class="fish-gear-strip">${gearChipsHtml}</div>
      </div>

      <div class="fish-basket-bar">
        <span class="basket-item"><img src="/assets/village/fish_minnow.png" alt=""> <b>${basket.minnow}</b></span>
        <span class="basket-item"><img src="/assets/village/fish_crab.png" alt=""> <b>${basket.crab}</b></span>
        <span class="basket-item"><img src="/assets/village/fish_koi.png" alt=""> <b>${basket.koi}</b></span>
        <span class="basket-item"><img src="/assets/village/fish_chest.png" alt=""> <b>${basket.chest}</b></span>
      </div>

      <div class="fish-ex-list">${offersHtml}</div>
    `;
  }

  renderCodex(profile = this.profile) {
    if (!profile) return;
    const c = profile.fish_codex || {};
    const rec = profile.fish_records || {};
    const codexFooter = $('fish-codex');
    if (codexFooter) {
      codexFooter.innerHTML = Object.entries(FISH)
        .map(([k, f]) => `<span title="${escapeHtml(f.name)}">${f.emoji} ${c[k] | 0}</span>`)
        .join('');
    }

    const detailGrid = $('fish-codex-detail');
    if (!detailGrid) return;
    detailGrid.innerHTML = Object.entries(FISH).map(([k, f]) => {
      const count = c[k] | 0;
      const bestKg = rec[k] || 0;
      const nextMile = FISHING.CODEX_MILESTONES.find((m) => count < m) || 50;
      const pct = Math.min(100, Math.round((count / nextMile) * 100));
      const stars = '★'.repeat(f.stars || 1);
      return `
        <div class="codex-species-card rarity-${f.rarity || 'common'}">
          <div class="codex-top">
            <img src="/assets/village/${f.sprite}.png" alt="${escapeHtml(f.name)}" class="codex-sprite">
            <div class="codex-head-meta">
              <span class="codex-stars">${stars}</span>
              <div class="codex-name">${escapeHtml(SHORT_FISH_NAME[k] || f.name)}</div>
              <div class="codex-caught">x<b>${count}</b> ${bestKg ? `• 👑 ${bestKg}kg` : ''}</div>
            </div>
          </div>
          <div class="codex-mile-bar">
            <div class="codex-mile-fill" style="width:${pct}%"></div>
            <span class="codex-mile-txt">💎 ${count}/${nextMile} (+${FISHING.CODEX_DIAMONDS})</span>
          </div>
        </div>
      `;
    }).join('');
  }

  setProfile(p) {
    this.profile = p;
    this.refreshAllViews(p);
  }

  playSfx(kind, progress = 0) {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!this._audioCtx) this._audioCtx = new Ctx();
      const ctx = this._audioCtx;
      if (ctx.state === 'suspended') ctx.resume();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (kind === 'cast') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(520, now);
        osc.frequency.exponentialRampToValueAtTime(240, now + 0.18);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.21);
      } else if (kind === 'bite') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(587.33, now);
        osc.frequency.setValueAtTime(880, now + 0.08);
        gain.gain.setValueAtTime(0.11, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
        osc.start(now);
        osc.stop(now + 0.25);
      } else if (kind === 'perfect') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(659.25, now);
        osc.frequency.setValueAtTime(987.77, now + 0.07);
        osc.frequency.setValueAtTime(1318.5, now + 0.14);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.31);
      } else if (kind === 'tick') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(320 + progress * 420, now);
        gain.gain.setValueAtTime(0.035, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
        osc.start(now);
        osc.stop(now + 0.05);
      } else if (kind === 'catch' || kind === 'exchange') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.08);
        osc.frequency.setValueAtTime(783.99, now + 0.16);
        osc.frequency.setValueAtTime(1046.5, now + 0.24);
        gain.gain.setValueAtTime(0.11, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        osc.start(now);
        osc.stop(now + 0.46);
      } else if (kind === 'escape') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(360, now);
        osc.frequency.exponentialRampToValueAtTime(160, now + 0.25);
        gain.gain.setValueAtTime(0.07, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
        osc.start(now);
        osc.stop(now + 0.27);
      } else if (kind === 'toggle') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(640, now);
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.06);
      }
    } catch { /* ignore audio errors in headless mode */ }
  }
}
