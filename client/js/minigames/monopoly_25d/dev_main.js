// client/js/minigames/monopoly_25d/dev_main.js — boots the Step 4 standalone preview (/monopoly_dev).
//   ?user=nook&pass=1234  sign in with a real (seeded) account so the board shows your real chibi, outfit & pet
//   ?autoplay=1           a Hard bot plays your seat too (visual QA / screenshots)
//   ?solo=insane          skip the hub and start a solo match vs Insane bots immediately
//   ?rounds=3             shorter match (QA only; the real rule is 15 rounds)
import * as THREE from 'three';
import { loadManifest } from '../../assets.js';
import { LocalRoom } from './room_client.js';
import { MonopolyBridge } from '../../monopoly_bridge.js';
import { botAction } from '/shared/monopoly_bots.js';
import { playerInfoFromProfile } from '/shared/monopoly_rules.js';
import { OUTFITS } from '/shared/costumes_catalog.js';

const params = new URLSearchParams(location.search);
const app = document.getElementById('app');
const canvas = document.getElementById('world');

let toastT = 0;
function toast(msg, ms = 2400) {
  const t = document.getElementById('dev-toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ms);
}

function applyUiScale() {
  const w = app.clientWidth || innerWidth, h = app.clientHeight || innerHeight;
  document.documentElement.style.setProperty('--ui-scale', Math.max(0.82, Math.min(1.25, Math.min(w / 402, h / 874))).toFixed(3));
}

async function loadProfile() {
  const user = params.get('user') || 'nook';
  const pass = params.get('pass') || '1234';
  try {
    const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: user, password: pass }) });
    if (res.ok) return (await res.json()).profile;
  } catch { /* offline preview */ }
  return { id: user, username: user, lineage: 'bkk', level: 28, equipped: { outfit: { id: 's11_zeus_olympus', refine: 10 }, pet: { id: 'pet_night_fury' } }, partner_id: null };
}

async function boot() {
  applyUiScale();
  addEventListener('resize', applyUiScale);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  const isTouch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isTouch ? 1.5 : 2));
  const size = () => renderer.setSize(canvas.clientWidth || innerWidth, canvas.clientHeight || innerHeight, false);
  size(); addEventListener('resize', size);
  await loadManifest(renderer);

  const profile = await loadProfile();
  if (params.get('outfit')) {
    if (!profile.equipped) profile.equipped = {};
    profile.equipped.outfit = { id: params.get('outfit'), refine: 10 };
  }
  if (params.get('petCostume')) {
    if (!profile.equipped) profile.equipped = {};
    if (!profile.equipped.pet) profile.equipped.pet = { id: 'pet_night_fury' };
    profile.equipped.pet.costume_id = params.get('petCostume');
    const r = Number(params.get('petCostumeRarity')) || 3;
    profile.equipped.pet.costume_rarity = r;
    if (Array.isArray(profile.pets)) {
      const ep = profile.pets.find((x) => x.id === profile.equipped.pet.id || x.uid === profile.equipped.pet.uid);
      if (ep) {
        ep.costume_id = params.get('petCostume');
        ep.costume_rarity = r;
      }
    }
  }
  let accessories = {};
  try { ({ ACCESSORIES: accessories } = await import('/shared/catalog_gear_pets.js')); } catch { /* catalog mid-refactor: stats default to 0 */ }
  const info = playerInfoFromProfile(profile, { outfits: OUTFITS, accessories });
  const room = new LocalRoom({ userId: profile.id, playerInfo: (id) => (id === profile.id ? info : { name: id }), maxRounds: Number(params.get('rounds')) || undefined });
  const bridge = new MonopolyBridge({ container: app, renderer, room, toast, onExit: () => bridge.openHub() });
  bridge.ensureBoard();
  bridge.start();
  window.__mono = {
    bridge, room, profile, info,
    fillGauges(seat = 0, { ult = 100, petUlt = 100 } = {}) {
      const t = room.mgr?.tableOf?.(profile.id);
      if (t?.match?.players?.[seat]) {
        t.match.players[seat].ult = ult;
        t.match.players[seat].petUlt = petUlt;
        bridge.refreshControls();
      }
    },
  };

  if (params.get('solo')) room.send({ type: 'table_solo', diff: params.get('solo') });
  else bridge.openHub();

  if (params.has('autoplay')) {
    setInterval(() => {
      const m = bridge.match;
      if (!m || m.ended || bridge.playing || bridge.busyInput || bridge.yourSeat == null) return;
      const a = botAction(m, bridge.yourSeat, 'hard');
      if (!a) return;
      if (a.type === 'roll') bridge.act({ type: 'mono_roll', use2d6: a.use2d6 });
      else if (a.type === 'ultimate') bridge.act({ type: 'mono_ult' });
      else bridge.act({ type: 'mono_event_choice', choice: a.choice });
    }, 400);
  }
  toast(`🎲 Welcome ${info.name}! Tap ⚡ Play Solo Now to try Sky Monopoly`);
}

boot().catch((e) => { console.error(e); toast(`Boot failed: ${e.message}`, 8000); });
