// client/js/minigames/cloud_dash_coach.js — 🐾 Pet Coach: just-in-time, self-retiring tips for Sky Cloud Dash.
// Your own pet "talks" in a speech bubble at the exact moment a tip matters; a ghost hand shows the gesture.
// Each tip retires once the player has demonstrated the skill (mastery), so veterans never see them.
import { DASH_TUNING as T } from '/shared/cloud_dash_rules.js';

const STORE = 'cd_coach_v1';
const MAX_SHOWS = 4;          // a tip is shown at most this many times in total, even if never mastered
const GAP_SEC = 3.2;          // minimum pause between bubbles
const BUBBLE_SEC = 2.6;

/** Tip catalog. `need` = how many demonstrations retire the tip. `hand` = ghost-hand gesture. */
const TIPS = {
  lane:    { need: 3, hand: 'swipe', icon: '⛈️', text: 'Storm cloud! <b>Swipe ⟷</b> to dodge' },
  jump:    { need: 3, hand: 'tap',   icon: '🪽', text: '<b>Tap</b> to hop right over it!' },
  perfect: { need: 3, hand: 'tap',   icon: '✨', text: 'Tap again <b>just as you land</b> → NICE DASH!' },
  glide:   { need: 2, hand: 'hold',  icon: '🪂', text: 'Gap ahead! <b>Jump + HOLD</b> to glide' },
  bond:    { need: 2, hand: null,    icon: '💖', text: 'More jellies… I\'m about to <b>grow</b>!' },
  ride:    { need: 2, hand: null,    icon: '💥', text: 'Hop on! We <b>smash everything</b>!' },
  ult:     { need: 2, hand: 'ult',   icon: '🌈', text: 'Your <b>ULT</b> is ready — tap 🌈!' },
  mach:    { need: 1, hand: null,    icon: '🔥', text: '3 NICE DASH in a row = <b>MACH WING</b>!' },
  deck:    { need: 1, hand: 'tap',   icon: '☁️', text: 'Jump through the golden ring in the middle lane! ☁️' },
  apex:    { need: 1, hand: 'swipe', icon: '🏎️', text: 'Hug the inside lane on curves for an Apex spark! 🏎️' },
  heart:   { need: 1, hand: null,    icon: '💞', text: 'Stay close to your partner — hearts are charging! 💞' },
};

const WHISPERS = [
  { id: 'rocket', need: 1, text: '🚀 Psst… <b>jump right on GO</b> for a Rocket Start!' },
  { id: 'perfect', text: '✨ Tap jump <b>as you land</b> to chain NICE DASH boosts' },
  { id: 'bond', text: '🐾 Jelly lines fill my paw ring — then <b>we ride!</b>' },
  { id: 'glide', text: '🪂 <b>Hold</b> jump in the air to glide over gaps' },
  { id: 'ult', text: '🌈 Save your <b>ULT</b> for a Pet Ride → SYNERGY BURST!' },
];

export class DashCoach {
  constructor(root, userId, petSprite = 'ragdoll') {
    this.root = root;
    this.key = `${STORE}:${userId || 'guest'}`;
    this.petSprite = String(petSprite || 'ragdoll').replace(/^pet_/, '');
    this.data = this._load();
    this.cool = 1.5; this.showing = 0; this.current = null;
    this.cloudIdx = 0; this.pitIdx = 0; this.landings = 0; this.ultReadyT = 0;
    this._buildDom();
  }

  setPetSprite(sprite) {
    if (sprite) this.petSprite = String(sprite).replace(/^pet_/, '');
  }

  get enabled() { return this.data.enabled !== false; }
  setEnabled(on) { this.data.enabled = !!on; this._save(); if (!on) this._hide(); }

  _load() {
    try { return { enabled: true, shows: {}, done: {}, races: 0, ...JSON.parse(localStorage.getItem(this.key) || '{}') }; }
    catch { return { enabled: true, shows: {}, done: {}, races: 0 }; }
  }
  _save() { try { localStorage.setItem(this.key, JSON.stringify(this.data)); } catch {} }

  mastered(id) { const need = TIPS[id]?.need ?? WHISPERS.find((w) => w.id === id)?.need ?? 1; return (this.data.done[id] || 0) >= need; }
  _credit(id, n = 1) { this.data.done[id] = (this.data.done[id] || 0) + n; if (this.current === id && this.mastered(id)) this._hide(); this._save(); }

  // ---------------------------------------------------------------- race lifecycle
  newRace(petSprite = null) {
    if (petSprite) this.setPetSprite(petSprite);
    this.cloudIdx = 0; this.pitIdx = 0; this.landings = 0; this.ultReadyT = 0; this.cool = 1.5;
    this.data.races = (this.data.races || 0) + 1; this._save();
    this._hide();
  }

  /** One whisper line for the countdown (null when everything is learned or tips are off). */
  countdownWhisper() {
    if (!this.enabled) return null;
    const w = WHISPERS.find((x) => !this.mastered(x.id) && (x.id !== 'rocket' || (this.data.shows.rocket || 0) < 5));
    if (!w) return null;
    this.data.shows[w.id] = (this.data.shows[w.id] || 0) + (w.id === 'rocket' ? 1 : 0);
    this._save();
    return w.text;
  }

  // ---------------------------------------------------------------- mastery from gameplay events
  onEvent(e, r) {
    switch (e.e) {
      case 'lane': break;
      case 'near': this._credit('lane'); break;
      case 'perfect': this._credit('perfect'); break;
      case 'mach': this._credit('mach'); break;
      case 'ride_start': this._credit('bond'); this._maybe('ride', true); this._credit('ride'); break;
      case 'ult': this._credit('ult'); break;
      case 'rocket': this._credit('rocket'); break;
      case 'land': this.landings++; break;
      case 'deck_enter':
      case 'deck': this._credit('deck'); break;
      case 'apex': this._credit('apex'); break;
      case 'heart': this._credit('heart'); break;
      default: break;
    }
    void r;
  }

  // ---------------------------------------------------------------- per-frame triggers
  update(dt, r, track, petScreen) {
    this.cool -= dt;
    if (this.showing > 0) {
      this.showing -= dt;
      this._place(petScreen);
      if (this.showing <= 0) this._hide();
    }
    if (r.finished) { this._hide(); return; }
    if (!this.enabled || !track || r.rescue > 0 || r.t < 1.2) return;

    // passive mastery: clouds cleared without a hit (by jumping or dodging), gaps crossed without rescue
    const items = track.items;
    while (this.cloudIdx < items.length && items[this.cloudIdx].s < r.s - 1) {
      const it = items[this.cloudIdx++];
      if (it.t !== 'cloud' || r.taken[this.cloudIdx - 1] !== 1 || r.deck) continue;
      if (r.stumble <= 0) {
        if (Math.abs(r.laneF - it.lane) < T.HURT_LANE) this._credit('jump'); else this._credit('lane', 0.5);
      }
    }
    while (this.pitIdx < track.pits.length && track.pits[this.pitIdx].s1 < r.s - 0.5) {
      this.pitIdx++;
      if (r.rescue <= 0 && r.grounded) this._credit('glide');
    }
    if (r.deck) this._credit('deck');
    if (r.apexes > 0) this._credit('apex');
    if (r.heartBoost > 0) this._credit('heart');
    if (r.ultCharge >= 100 && r.ult <= 0) this.ultReadyT += dt; else this.ultReadyT = 0;

    if (this.showing > 0 || this.cool > 0) return;

    // contextual triggers for deck, apex, heart mechanics
    if (track.deck && !r.deck && track.deck.ring > r.s && (track.deck.ring - r.s) <= 25 && (track.deck.ring - r.s) >= 3) {
      if (this._maybe('deck')) return;
    }
    if (track.bends && !r.deck) {
      const bend = track.bends.find((b) => r.s >= b.s0 - 2 && r.s <= b.s0 + 12);
      if (bend && Math.abs(r.laneF - bend.dir) >= 0.5) {
        const hand = bend.dir < 0 ? 'point-left' : 'point-right';
        if (this._maybe('apex', false, hand)) return;
      }
    }
    if (r.hearting) {
      if (this._maybe('heart')) return;
    }

    // on the Upper Cloud Deck the road hazards below don't apply
    if (r.deck) return;

    // what's coming? (look ahead ~1.8 s for clouds in my lane, ~2.2 s for gaps)
    const lane = Math.round(r.laneT);
    let cloudAhead = null;
    for (let i = r.cursor; i < items.length; i++) {
      const it = items[i];
      if (it.s > r.s + r.v * 1.8) break;
      if (it.t === 'cloud' && !r.taken[i] && it.lane === lane && it.s > r.s + 2) { cloudAhead = it.s - r.s; break; }
    }
    const pit = track.pits.find((p) => p.s0 > r.s && p.s0 - r.s < r.v * 2.2);

    if (pit && r.ride <= 0 && this._maybe('glide')) return;
    if (cloudAhead != null && r.ride <= 0 && r.ult <= 0) {
      if (!this.mastered('lane') && this._maybe('lane')) return;
      if (cloudAhead < r.v * 1.2 && this._maybe('jump')) return;
    }
    if (r.grounded && this.landings >= 2 && r.landT < 0.5 && this._maybe('perfect')) return;
    if (r.perfectStreak === 2 && this._maybe('mach')) return;
    if (r.bond >= 80 && r.ride <= 0 && this._maybe('bond')) return;
    if (this.ultReadyT > 1.5 && this._maybe('ult')) return;
  }

  _maybe(id, force = false, handOverride = null) {
    if (!this.enabled || this.mastered(id) || (this.data.shows[id] || 0) >= MAX_SHOWS) return false;
    if (!force && (this.showing > 0 || this.cool > 0)) return false;
    this.data.shows[id] = (this.data.shows[id] || 0) + 1;
    this._save();
    this._show(id, handOverride);
    return true;
  }

  // ---------------------------------------------------------------- results "Next Goal"
  /** A single personalized goal for the results card, based on this race. */
  nextGoal(stats) {
    const { perfects = 0, maxStreak = 0, rides = 0, hits = 0, rescues = 0, place = 4, ults = 0, finishMs = null, bestMs = null } = stats;
    if (hits >= 4) return { icon: '⛈️', text: `Dodge earlier — ${hits} storm-cloud bumps cost you speed` };
    if (rescues >= 1 && !this.mastered('glide')) return { icon: '🪂', text: 'Jump + <b>hold</b> over gaps — no Pet Rescue needed!' };
    if (maxStreak < 3) return { icon: '🔥', text: `Chain <b>3 NICE DASH</b> in a row for Mach Wing (best: ${maxStreak})` };
    if (rides < 3) return { icon: '🐾', text: `Follow jelly lines to ride your pet more (${rides} ride${rides === 1 ? '' : 's'} this race)` };
    if (ults < 1) return { icon: '🌈', text: 'Fire your ULT during a Pet Ride → <b>SYNERGY BURST</b>!' };
    if (place > 1) return { icon: '🏆', text: `You're ${place - 1} place${place === 2 ? '' : 's'} from the crown — Run It Back!` };
    if (bestMs && finishMs) return { icon: '⏱️', text: `Beat your best: <b>${(bestMs / 1000).toFixed(2)}s</b>` };
    return { icon: '✨', text: `${perfects} NICE DASH — can you top it?` };
  }

  // ---------------------------------------------------------------- DOM
  _buildDom() {
    const st = document.createElement('style');
    st.textContent = `
.cdc-bubble{position:absolute;z-index:6;width:max-content;max-width:min(256px,74vw);padding:8px 13px 8px 10px;border-radius:18px;background:linear-gradient(180deg,#fff9ea 0%,#f4e0b8 100%);color:#3a2415;border:2.5px solid #d49a2a;
  font:800 13.5px/1.25 var(--font-display,sans-serif);box-shadow:0 6px 18px rgba(58,36,21,.35),0 0 0 1.5px rgba(255,250,230,.85) inset,0 2px 0 #3a2415;pointer-events:none;transform-origin:50% 100%;
  display:flex;gap:8px;align-items:center;opacity:0;transform:translate(-50%,-100%) scale(.5)}
.cdc-bubble b{color:#b8326a}
.cdc-bubble .cdc-pet-ava,.cdc-whisper .cdc-pet-ava{width:30px;height:30px;border-radius:50%;background:radial-gradient(circle,#fffdf5 0%,#f5cb6c 100%);border:1.5px solid #b57b1e;box-shadow:0 1px 3px rgba(0,0,0,.25);display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden}
.cdc-bubble .cdc-pet-ava img,.cdc-whisper .cdc-pet-ava img{width:26px;height:26px;object-fit:contain}
.cdc-bubble .cdc-ico{font-size:19px;filter:drop-shadow(0 1px 2px rgba(0,0,0,.15))}
.cdc-bubble::after{content:'';position:absolute;left:50%;bottom:-10px;margin-left:-9px;border:9px solid transparent;border-top-color:#d49a2a;border-bottom:0;filter:drop-shadow(0 2px 0 #3a2415)}
.cdc-bubble.show{animation:cdcIn .32s cubic-bezier(.2,1.6,.4,1) forwards}
.cdc-bubble.hide{animation:cdcOut .22s ease-in forwards}
.cdc-hand{position:absolute;left:50%;bottom:28%;font-size:46px;pointer-events:none;opacity:0;filter:drop-shadow(0 4px 6px rgba(0,0,0,.25));z-index:5}
.cdc-hand.swipe{animation:cdcSwipe 1.1s ease-in-out 2}
.cdc-hand.tap,.cdc-hand.ult{animation:cdcTap .55s ease-in-out 4}
.cdc-hand.hold{animation:cdcHold 1.3s ease-in-out 2}
.cdc-hand.point-left{left:28%;animation:cdcTap .55s ease-in-out 4}
.cdc-hand.point-right{left:72%;animation:cdcTap .55s ease-in-out 4}
.cdc-hand.ult{left:auto;right:150px;bottom:110px}
.cdc-whisper{position:absolute;left:50%;top:calc(env(safe-area-inset-top,0px) + 124px);transform:translateX(-50%);padding:7px 14px 7px 10px;border-radius:18px;background:linear-gradient(180deg,#fff9ea 0%,#f4e0b8 100%);border:2.5px solid #d49a2a;
  color:#3a2415;font:800 13.5px/1.2 var(--font-display,sans-serif);box-shadow:0 6px 16px rgba(58,36,21,.35),0 2px 0 #3a2415;white-space:nowrap;pointer-events:none;display:inline-flex;gap:8px;align-items:center;animation:cdcFade 3.2s ease forwards}
.cdc-whisper b{color:#b8326a}
.cd-goal{display:flex;gap:8px;align-items:center;justify-content:center;margin:8px 0 2px;padding:8px 10px;border-radius:14px;background:linear-gradient(90deg,#fff9ea,#f6e5c0);border:1.5px solid #d49a2a;
  font:800 13px/1.25 sans-serif;color:#3a2415;box-shadow:inset 0 1px 0 #fff}
.cd-goal b{color:#b8326a}.cd-goal i{font-style:normal;font-size:20px}
.cd-tips-toggle{border:0;background:none;color:#6b4423;font:800 11.5px sans-serif;margin-top:8px;text-decoration:underline;cursor:pointer}
@keyframes cdcIn{from{opacity:0;transform:translate(-50%,-100%) scale(.5)}to{opacity:1;transform:translate(-50%,-100%) scale(1)}}
@keyframes cdcOut{from{opacity:1;transform:translate(-50%,-100%) scale(1)}to{opacity:0;transform:translate(-50%,-110%) scale(.85)}}
@keyframes cdcSwipe{0%{opacity:0;transform:translateX(-90px)}20%{opacity:.85}50%{transform:translateX(60px)}70%{opacity:.85}100%{opacity:0;transform:translateX(90px)}}
@keyframes cdcTap{0%,100%{opacity:.85;transform:translate(-50%,0) scale(1)}50%{opacity:.85;transform:translate(-50%,8px) scale(.86)}}
@keyframes cdcHold{0%{opacity:0;transform:translate(-50%,0)}20%{opacity:.85;transform:translate(-50%,8px) scale(.88)}85%{opacity:.85;transform:translate(-50%,8px) scale(.88)}100%{opacity:0}}
@keyframes cdcFade{0%{opacity:0;transform:translate(-50%,8px)}12%{opacity:1;transform:translate(-50%,0)}80%{opacity:1}100%{opacity:0}}
`;
    document.head.appendChild(st);
    this.bubble = document.createElement('div');
    this.bubble.className = 'cdc-bubble';
    this.hand = document.createElement('div');
    this.hand.className = 'cdc-hand';
    this.hand.textContent = '👆';
    this.root.appendChild(this.bubble);
    this.root.appendChild(this.hand);
  }

  _show(id, handOverride = null) {
    const tip = TIPS[id];
    this.current = id;
    this.root.querySelectorAll('.cdc-whisper').forEach((el) => el.remove());
    const sp = this.petSprite || 'ragdoll';
    const avaHtml = `<span class="cdc-pet-ava"><img src="/assets/pets/${sp}_emo_joy.png" alt="" onerror="this.replaceWith('🐾')"></span>`;
    this.bubble.innerHTML = `${avaHtml}<span class="cdc-ico">${tip.icon}</span><span>${tip.text}</span>`;
    this.bubble.className = 'cdc-bubble';
    void this.bubble.offsetWidth;
    this.bubble.className = 'cdc-bubble show';
    this.showing = BUBBLE_SEC;
    this.cool = BUBBLE_SEC + GAP_SEC;
    this.hand.className = 'cdc-hand';
    const h = handOverride || tip.hand;
    if (h) {
      this.hand.textContent = h === 'point-left' ? '👈' : h === 'point-right' ? '👉' : '👆';
      void this.hand.offsetWidth;
      this.hand.className = `cdc-hand ${h}`;
    }
  }

  _hide() {
    if (!this.current) return;
    this.current = null; this.showing = 0;
    this.bubble.className = 'cdc-bubble hide';
    this.hand.className = 'cdc-hand';
    this.hand.textContent = '👆';
  }

  _place(p) {
    if (!p) { this.bubble.style.left = '50%'; this.bubble.style.top = '156px'; return; }
    const w = this.root.clientWidth || window.innerWidth;
    const x = Math.max(128, Math.min(w - 128, p.x));
    const y = Math.max(138, Math.min(168, p.y - 110));
    this.bubble.style.left = `${x}px`;
    this.bubble.style.top = `${y}px`;
  }

  whisper(text) {
    if (!text) return;
    this.root.querySelectorAll('.cdc-whisper').forEach((el) => el.remove());
    const sp = this.petSprite || 'ragdoll';
    const avaHtml = `<span class="cdc-pet-ava"><img src="/assets/pets/${sp}_emo_joy.png" alt="" onerror="this.replaceWith('🐾')"></span>`;
    const d = document.createElement('div');
    d.className = 'cdc-whisper';
    d.innerHTML = `${avaHtml}<span>${text}</span>`;
    this.root.appendChild(d);
    setTimeout(() => d.remove(), 3300);
  }
}
