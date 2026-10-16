// client/js/minigames/dock_fishing.js — In-Village Co-Op Dock Fishing (Screen 04, Section 2.F).
// The server rolls the catch at cast time and only reveals it after the reel-in; the client runs the
// bite wait + Sweet-Spot Tension Gauge and reports success / escape.
import { FISH, FISHING } from '/shared/catalog_landmarks.js';

const $ = (id) => document.getElementById(id);

export class DockFishing {
  /** @param net Net  @param ui { toast(msg), humanError(e), onCatch(result) } */
  constructor(net, ui) {
    this.net = net;
    this.ui = ui;
    this.state = 'idle';           // idle | waiting | bite | reeling | result
    this.cast = null;
    this.hold = false;
    this.raf = 0;
    this.available = false;
    this.bind();
  }

  bind() {
    $('fish-open').onclick = () => this.open();
    $('fish-close').onclick = () => this.close();
    $('fish-cast').onclick = () => this.doCast(false);
    $('fish-bait').onclick = () => this.doCast(true);
    const reel = $('fish-reel');
    const down = (e) => { e.preventDefault(); this.hold = true; reel.classList.add('held'); };
    const up = () => { this.hold = false; reel.classList.remove('held'); };
    reel.addEventListener('pointerdown', down);
    reel.addEventListener('pointerup', up); reel.addEventListener('pointercancel', up); reel.addEventListener('pointerleave', up);
    window.addEventListener('keydown', (e) => { if (e.code === 'Space' && this.state === 'reeling') { this.hold = true; e.preventDefault(); } });
    window.addEventListener('keyup', (e) => { if (e.code === 'Space') this.hold = false; });
    this.net.on('fishing_cast_ok', (m) => this.onCastOk(m))
      .on('fishing_result', (m) => this.onResult(m))
      .on('fishing_error', (m) => { this.ui.toast(`🎣 ${this.ui.humanError(m.error)}`); this.reset(); });
  }

  /** World tells us whether the local Chibi stands on / next to a dock. */
  setAvailable(on) {
    if (on === this.available) return;
    this.available = on;
    $('fish-open').hidden = !on;
    if (!on && this.state === 'idle') this.close();
  }

  open() { $('fishing-panel').hidden = false; this.reset(); this.renderCodex(); }
  close() { if (this.state === 'reeling' || this.state === 'waiting' || this.state === 'bite') return; $('fishing-panel').hidden = true; this.stop(); }
  get isOpen() { return !$('fishing-panel').hidden; }

  reset() {
    this.stop();
    this.state = 'idle';
    this.cast = null;
    $('fish-status').textContent = 'Cast your line! Free casts catch pond fish — 🍓 Bait unlocks Koi & Sunken Gear Chests.';
    $('fish-gauge').hidden = true;
    $('fish-result').hidden = true;
    $('fish-cast').disabled = false; $('fish-bait').disabled = false;
    $('fish-reel').disabled = true;
  }

  stop() { cancelAnimationFrame(this.raf); this.raf = 0; clearTimeout(this.biteTimer); }

  doCast(bait) {
    if (this.state !== 'idle' && this.state !== 'result') return;
    this.reset();
    this.state = 'casting';
    $('fish-cast').disabled = true; $('fish-bait').disabled = true;
    $('fish-status').textContent = bait ? '✨ Golden Berry Bait cast… (−5 🍓)' : '🎣 Casting…';
    this.net.send({ type: 'fishing_cast', bait });
  }

  onCastOk(m) {
    this.cast = m;
    this.state = 'waiting';
    $('fish-coop').hidden = !m.coop;
    $('fish-status').textContent = '〰️ Waiting for a bite…';
    this.biteTimer = setTimeout(() => this.startReel(), m.biteMs);
  }

  startReel() {
    this.state = 'reeling';
    $('fish-status').textContent = '❗ Something bit! HOLD to reel — keep the fish in the green zone!';
    $('fish-gauge').hidden = false;
    $('fish-reel').disabled = false;
    this.g = { fish: 0.2, zone: 0.12, zoneDir: 1, progress: 0, t: 0, width: FISHING.SWEET_SPOT_WIDTH };
    let last = performance.now();
    const tick = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (this.step(dt)) this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  /** Sweet-Spot Tension Gauge: hold = +45%/s, release = −35%/s; 3.5 s inside the zone lands it. */
  step(dt) {
    const g = this.g;
    g.t += dt;
    g.fish = Math.max(0, Math.min(1, g.fish + (this.hold ? FISHING.HOLD_SPEED : -FISHING.DRIFT_SPEED) * dt));
    // the green zone wanders (a little jittery, like a struggling fish)
    g.zone += g.zoneDir * dt * (0.16 + 0.1 * Math.sin(g.t * 2.3));
    if (g.zone < 0.02 || g.zone > 0.98 - g.width) { g.zoneDir *= -1; g.zone = Math.max(0.02, Math.min(0.98 - g.width, g.zone)); }
    const inside = g.fish >= g.zone && g.fish <= g.zone + g.width;
    g.progress = Math.max(0, Math.min(1, g.progress + (inside ? dt / (FISHING.REEL_MS / 1000) : -dt / 7)));
    $('fish-zone').style.left = `${g.zone * 100}%`; $('fish-zone').style.width = `${g.width * 100}%`;
    $('fish-icon').style.left = `${g.fish * 100}%`;
    $('fish-icon').classList.toggle('inside', inside);
    $('fish-progress').style.width = `${g.progress * 100}%`;
    if (g.progress >= 1) { this.finish(true); return false; }
    if ((g.progress <= 0 && g.t > 4) || g.t > 25) { this.finish(false); return false; }
    return true;
  }

  finish(success) {
    this.state = 'result';
    this.hold = false;
    $('fish-reel').disabled = true;
    $('fish-status').textContent = success ? '🎉 Reeling it in…' : '💨 It got away…';
    this.net.send({ type: 'fishing_reel_complete', castId: this.cast?.castId, success });
  }

  onResult(m) {
    this.state = 'result';
    $('fish-gauge').hidden = true;
    $('fish-cast').disabled = false; $('fish-bait').disabled = false;
    const box = $('fish-result');
    box.hidden = false;
    if (!m.ok) {
      box.innerHTML = `<div class="fr-title">💨 The ${FISH[m.key]?.name || 'fish'} escaped!</div><div class="fr-sub">Keep the fish inside the green zone.</div>`;
      $('fish-status').textContent = 'Try again!';
      return;
    }
    const f = FISH[m.key];
    const bits = [];
    if (m.gold) bits.push(`+${m.gold.toLocaleString('en-US')} 🪙`);
    if (m.berries) bits.push(`+${m.berries} 🍓`);
    if (m.dupe) bits.push(`+1 Duplicate: ${m.dupe.replace(/_/g, ' ')}`);
    bits.push(`+${m.exp} EXP`);
    box.innerHTML = `<img src="/assets/village/${f.sprite}.png" alt=""><div class="fr-title">${f.emoji} ${f.name}!</div>`
      + `<div class="fr-sub">${bits.join(' • ')}</div>${m.milestone ? `<div class="fr-mile">📖 Codex #${m.count}: +${m.milestone} 💎!</div>` : ''}`;
    $('fish-status').textContent = m.coop ? '🎣 Co-Op Buff Active: +35% Sunken Gear Chest Bite Rate!' : 'Nice catch! Cast again?';
    this.ui.onCatch?.(m);
    this.renderCodex();
  }

  renderCodex(profile = this.profile) {
    if (!profile) return;
    const c = profile.fish_codex || {};
    $('fish-codex').innerHTML = Object.entries(FISH).map(([k, f]) => `<span title="${f.name}">${f.emoji} ${c[k] | 0}</span>`).join('');
  }

  setProfile(p) { this.profile = p; if (this.isOpen) this.renderCodex(p); }
}
