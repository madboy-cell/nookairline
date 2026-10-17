// client/js/dressup.js — dev-only paper-doll calibration page (Implementation Plan Section 22.F).
// Open: /?dev=1&dressup=1   (optional &lineage=dxb&item=hat_cat_headset)
// Renders the mannequin in all 3 views (Front-3/4, Side, Back-3/4) with one accessory attached.
//   ← ↑ → ↓  nudge offset (0.01 head-heights, Shift = 0.05)     + / −  scale (±0.02, Shift ±0.1)
//   V        edit the shared offset or a per-view override       S      save back to shared/accessory_attach.js
import * as THREE from 'three';
import { loadManifest } from './assets.js';
import { ChibiRig, CHIBI_HEIGHT } from './chibi_rig.js';
import { ATTACH, getAttachDef } from '/shared/accessory_attach.js';
import { ACCESSORIES } from '/shared/catalog_gear_pets.js';
import { HAIRSTYLES, hairAttach, HAIR_COLORS } from '/shared/hair_catalog.js';

const VIEWS = ['front', 'side', 'back'];
// v2 cosmetic parts may not be in the gear catalog yet: ears/horns live in the hat slot, tails in the Back (wings) slot
const SLOT_OF = (id) => ACCESSORIES[id]?.slot || (id?.startsWith('back_') ? 'wings' : id?.startsWith('hat_') ? 'hat' : undefined);

export async function startDressUp(params) {
  document.getElementById('gate')?.classList.add('hidden');
  const wrap = document.createElement('div');
  wrap.id = 'dressup';
  wrap.style.cssText = 'position:fixed;inset:0;z-index:50;background:linear-gradient(#cfe8ff,#fff6e3);font:14px system-ui,sans-serif;color:#3a2415;display:flex;flex-direction:column';
  wrap.innerHTML = `
    <div style="padding:10px 12px;background:#fbf2de;border-bottom:3px solid #8a5a2b;display:flex;gap:8px;flex-wrap:wrap;align-items:center">
      <b>🧩 Dress-Up Calibration</b>
      <select id="du-lineage"><option value="boy">Boy (v2)</option><option value="girl">Girl (v2)</option><option value="bkk">Wolf Prince (bkk, legacy)</option><option value="dxb">Dragon Princess (dxb, legacy)</option></select>
      <select id="du-hair"><option value="">no hair</option>${Object.keys(HAIRSTYLES).map((k) => `<option value="${k}">💇 ${HAIRSTYLES[k].name}</option>`).join('')}</select>
      <select id="du-color" title="hair colour">${Object.entries(HAIR_COLORS).map(([k, c]) => `<option value="${k}">🎨 ${c.name}</option>`).join('')}</select>
      <select id="du-target"><option value="item">edit: item</option><option value="hair">edit: hair</option></select>
      <select id="du-item"></select>
      <select id="du-mode"><option value="all">offset: all views</option>${VIEWS.map((v) => `<option value="${v}">override: ${v}</option>`).join('')}</select>
      <button id="du-save">💾 Save (S)</button>
      <span id="du-read" style="font-family:ui-monospace,monospace"></span>
    </div>
    <div id="du-stage" style="flex:1;position:relative"></div>
    <div style="padding:6px 12px;font-size:12px;opacity:.8">← ↑ → ↓ nudge • Shift = ×5 • + / − scale • V cycles edit mode • S saves to shared/accessory_attach.js</div>`;
  document.body.appendChild(wrap);
  const $ = (id) => wrap.querySelector(`#${id}`);

  let customColorPicked = false;
  function syncHairDefaultColor() {
    if (!customColorPicked) {
      const hDef = HAIRSTYLES[$('du-hair').value];
      if (hDef?.defaultColor) {
        $('du-color').value = hDef.defaultColor;
      } else {
        $('du-color').value = 'chestnut';
      }
    }
  }

  const items = [...new Set([...Object.keys(ATTACH), ...Object.keys(ACCESSORIES).filter((k) => ['hat', 'face', 'gloves', 'boots', 'wings'].includes(SLOT_OF(k)))])];
  $('du-item').innerHTML = `<option value="">no item</option>` + items.map((k) => `<option value="${k}">${SLOT_OF(k)} • ${ACCESSORIES[k]?.name || k}</option>`).join('');
  if (params.get('item') === 'none') $('du-item').value = '';
  else if (params.get('item') && items.includes(params.get('item'))) $('du-item').value = params.get('item');
  else $('du-item').value = items[0] || '';
  if (['boy', 'girl', 'bkk', 'dxb'].includes(params.get('lineage'))) $('du-lineage').value = params.get('lineage');
  if (params.get('hair') && HAIRSTYLES[params.get('hair')]) $('du-hair').value = params.get('hair');
  if (params.get('color') && params.get('color') !== 'default') {
    customColorPicked = true;
    const col = params.get('color');
    if (HAIR_COLORS[col]) {
      $('du-color').value = col;
    } else {
      const hex = col.startsWith('#') ? col.toLowerCase() : `#${col.toLowerCase()}`;
      const foundKey = Object.keys(HAIR_COLORS).find((k) => HAIR_COLORS[k].hex.toLowerCase() === hex);
      if (foundKey) {
        $('du-color').value = foundKey;
      } else {
        const customHex = col.startsWith('#') ? col : `#${col}`;
        const opt = document.createElement('option');
        opt.value = customHex;
        opt.textContent = `🎨 Custom (${customHex})`;
        $('du-color').appendChild(opt);
        $('du-color').value = customHex;
      }
    }
  }
  syncHairDefaultColor();
  if (params.get('target') === 'hair') $('du-target').value = 'hair';
  let hairEdit = null;

  const stage = $('du-stage');
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  stage.appendChild(renderer.domElement);
  await loadManifest(renderer);

  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-3, 3, 2, -0.2, 0.1, 50);
  cam.position.set(0, 1.0, 10);
  const resize = () => {
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h);
    // the 3 mannequins span x ≈ −2.4…2.4 and y ≈ -0.1…2.1
    const aspect = w / h;
    const halfW = Math.max(2.5, 1.25 * aspect), halfH = Math.max(1.25, halfW / aspect);
    Object.assign(cam, { left: -halfW, right: halfW, top: halfH, bottom: -halfH });
    cam.updateProjectionMatrix();
  };
  const onResize = resize;
  addEventListener('resize', onResize);
  onResize();

  let rigs = [];
  let edit = null;                                  // working copy of the attach data
  const state = { mode: 'all', dirty: false };

  async function build() {
    for (const r of rigs) { scene.remove(r.ROOT); r.dispose(); }
    const lineage = $('du-lineage').value, id = $('du-item').value;
    edit = id ? JSON.parse(JSON.stringify(getAttachDef(id, SLOT_OF(id)))) : { offset: [0, 0], scale: 1 };
    const hairId = $('du-hair').value;
    hairEdit = hairId ? JSON.parse(JSON.stringify(hairAttach(hairId))) : null;
    rigs = VIEWS.map((v, i) => {
      const rig = new ChibiRig({ lineage, name: v.toUpperCase(), sub: '', wings: null });
      rig.ROOT.position.set((i - 1) * 1.6, 0, 0);
      rig.shadow.visible = false;
      scene.add(rig.ROOT);
      return rig;
    });
    await Promise.all(rigs.map((r) => r.ready));
    window.__dressupRigs = rigs;
    const eq = { outfit: { id: params.get('outfit') || 'newbie_outfit' } };
    if (id && SLOT_OF(id)) eq[SLOT_OF(id)] = { id };
    if (params.get('back')) eq.wings = { id: params.get('back') };   // Back slot preview (wings / tails) next to the edited item
    await Promise.all(rigs.map(async (r, i) => {
      await r.setEquipment(eq);
      if (hairId) await r.setHair(hairId, $('du-color').value);
      r.applyView(VIEWS[i], true);
    }));
    readout();
  }

  const target = () => ($('du-target').value === 'hair' && hairEdit ? hairEdit : edit);
  function readout() {
    const t = target();
    const o = state.mode === 'all' ? t.offset : (t.offsets?.[state.mode] || t.offset);
    $('du-read').textContent = `${t === hairEdit ? '💇 hair ' : ''}offset [${o.map((v) => v.toFixed(3)).join(', ')}]  scale ${(state.mode !== 'all' && t.scales?.[state.mode] != null ? t.scales[state.mode] : t.scale).toFixed(3)}  ${state.dirty ? '• unsaved' : ''}`;
  }

  function apply() {
    const id = $('du-item').value;
    rigs.forEach((r, i) => { r.setAttachOverride(id, edit); if (hairEdit) r.setHairOverride(hairEdit); r.applyView(VIEWS[i], true); });
    state.dirty = true;
    readout();
  }

  // +/- edits the shared scale in "all views" mode, or a per-view `scales[view]` (own side/back drawings)
  function scaleBy(d) {
    const t = target();
    if (state.mode === 'all') t.scale = Math.min(4, Math.max(0.05, t.scale + d));
    else {
      t.scales = t.scales || {};
      t.scales[state.mode] = Math.min(4, Math.max(0.05, (t.scales[state.mode] ?? t.scale) + d));
    }
    apply();
  }

  function nudge(dx, dy) {
    const t = target();
    if (state.mode === 'all') t.offset = [t.offset[0] + dx, t.offset[1] + dy];
    else {
      t.offsets = t.offsets || {};
      const cur = t.offsets[state.mode] || [...t.offset];
      t.offsets[state.mode] = [cur[0] + dx, cur[1] + dy];
    }
    apply();
  }

  async function save() {
    if (target() === hairEdit) {
      // hair attach lives in shared/hair_catalog.js: print the calibrated value to paste there
      const line = JSON.stringify({ offset: hairEdit.offset.map((v) => +v.toFixed(3)), scale: +hairEdit.scale.toFixed(3), ...(hairEdit.offsets ? { offsets: hairEdit.offsets } : {}) });
      console.log(`[dressup] ${$('du-hair').value} attach: ${line}`);
      $('du-read').textContent += `  📋 ${line}`;
      return;
    }
    const itemId = $('du-item').value;
    const res = await fetch('/api/dev/attach', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ itemId, attach: edit }) });
    const data = await res.json().catch(() => ({}));
    if (res.ok) { ATTACH[itemId] = data.attach; state.dirty = false; readout(); $('du-read').textContent += '  ✅ saved'; }
    else $('du-read').textContent += `  ❌ ${data.error || res.status}`;
  }

  const onKeyDown = (e) => {
    if (e.target.tagName === 'SELECT') return;
    const k = e.shiftKey ? 5 : 1;
    const map = { ArrowLeft: [-0.01, 0], ArrowRight: [0.01, 0], ArrowUp: [0, 0.01], ArrowDown: [0, -0.01] };
    if (map[e.key]) { e.preventDefault(); nudge(map[e.key][0] * k, map[e.key][1] * k); }
    else if (e.key === '+' || e.key === '=') scaleBy(0.02 * k);
    else if (e.key === '-' || e.key === '_') scaleBy(-0.02 * k);
    else if (e.key === 'v' || e.key === 'V') { const m = ['all', ...VIEWS]; state.mode = m[(m.indexOf(state.mode) + 1) % m.length]; $('du-mode').value = state.mode; readout(); }
    else if (e.key === 's' || e.key === 'S') save();
  };
  addEventListener('keydown', onKeyDown);
  $('du-mode').onchange = () => { state.mode = $('du-mode').value; readout(); };
  $('du-save').onclick = save;
  $('du-lineage').onchange = build;
  $('du-item').onchange = build;
  $('du-hair').onchange = () => {
    syncHairDefaultColor();
    build();
  };
  const onColorChange = () => {
    customColorPicked = true;
    const col = $('du-color').value;
    rigs.forEach((r) => {
      if (r.hair) {
        r.setHair(r.hair.id, col).then(() => {
          if (hairEdit) r.setHairOverride(hairEdit);
        });
      }
    });
  };
  $('du-color').onchange = onColorChange;
  $('du-color').oninput = onColorChange;
  $('du-target').onchange = readout;

  await build();
  let rafId = 0;
  function loop() {
    for (const r of rigs) r.syncBones();
    renderer.render(scene, cam);
    rafId = requestAnimationFrame(loop);
  }
  rafId = requestAnimationFrame(loop);

  // Dev calibration page has no in-app exit/unmount path (devs reload page);
  // dispose() performs cleanup of event listeners, RAF loop, and 3D resources.
  function dispose() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    removeEventListener('resize', onResize);
    removeEventListener('keydown', onKeyDown);
    for (const r of rigs) { scene.remove(r.ROOT); r.dispose(); }
    renderer.dispose();
    wrap.remove();
  }

  window.__dressup = { get rigs() { return rigs; }, get edit() { return edit; }, get hairEdit() { return hairEdit; }, nudge, apply, CHIBI_HEIGHT, dispose };
  return { dispose };
}
